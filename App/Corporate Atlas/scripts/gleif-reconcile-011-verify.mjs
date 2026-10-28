#!/usr/bin/env node
// MA-OCT-011 verification (spec rev 1.9 §9; rev 1.10 numbers where the build findings moved them).
//
//   sample   --plan <dir> --out <file> [--n 50] [--min-a 15] [--seed S]
//            Fri 16 freshness-gate sample: ≤ 50 plan rows, stratified, ≥ 15 A rows (R-1 (a)).
//            With --n 25 --min-a 10 it is the post-run API spot-check list (R-1 (c)).
//   fetch    --sample <file> --out <dir> --confirm-gleif-calls <N>
//            One GET /lei-records/{lei} per sampled LEI, hard cap 50, refuses without
//            --confirm-gleif-calls equal to the sample size. NOT run in MA-OCT-011.BUILD (0 GLEIF calls).
//   compare  --sample <file> --responses <dir>     offline: ≥ 98% agreement, any A identity mismatch = E-4 trigger
//   postrun  --plan <dir> --pre <export dir> --post <export dir> --out <file> [--seed S]
//            §9 post-run checks computed locally from X1/X2 exports (V3; no COUNT on D1),
//            plus the 200-row sampled diff against gleif_006.db with ≥ 25 E-A edges (E-3).
//
// Reads gleif_006.db read-only. Writes only to the given output paths.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GC_SOURCE, isNull, sha256, sha256File } from '../lib/gleif-reconcile-011-core.mjs';
import { BASIS, loadExport, openGc, parseArgs, phase3 } from './gleif-reconcile-011-plan.mjs';

const DIR = 'IS_DIRECTLY_CONSOLIDATED_BY', ULT = 'IS_ULTIMATELY_CONSOLIDATED_BY';
const GLEIF_API = 'https://api.gleif.org/api/v1/lei-records/';
const MAX_GLEIF_CALLS = 50;

// Deterministic PRNG (mulberry32) so a sample is reproducible from its seed.
function rng(seed) {
  let a = [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick(arr, n, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
function loadPlanFile(dir) {
  const text = readFileSync(path.join(dir, 'plan.json'), 'utf8');
  const pinned = readFileSync(path.join(dir, 'plan.sha256'), 'utf8').split(/\s+/)[0];
  if (sha256(text) !== pinned) throw new Error('plan.json does not match plan.sha256');
  return { plan: JSON.parse(text), sha: pinned };
}
const stmts = (plan, steps) => plan.batches.filter(b => steps.includes(b.step)).flatMap(b => b.statements);

// ── sample ───────────────────────────────────────────────────────────────

export function selectSample(plan, { n = 50, minA = 15, seed = 'MA-OCT-011' } = {}) {
  if (n > MAX_GLEIF_CALLS) throw new Error(`sample size ${n} > ${MAX_GLEIF_CALLS} (one GLEIF call per row)`);
  const r = rng(seed);
  const lei = s => s.kind === 'em_insert' ? s.values.lei : (s.set?.lei || s.lei);
  const a = stmts(plan, ['A']).map(s => ({ step: 'A', key: s.key, entity_id: s.entity_id, lei: lei(s), expect: s.set }));
  const others = stmts(plan, ['P', 'B', 'C', 'CR', 'RC15']).filter(s => lei(s))
    .map(s => ({ step: s.step, key: s.key, entity_id: s.entity_id ?? null, lei: lei(s), expect: s.kind === 'em_insert' ? s.values : s.set }));
  const nA = Math.max(minA, Math.round(n * a.length / (a.length + others.length)));
  const rows = [...pick(a, nA, r), ...pick(others, n - nA, r)];
  const leis = new Set();
  const out = rows.filter(x => !leis.has(x.lei) && leis.add(x.lei));
  return { seed, n: out.length, a_rows: out.filter(x => x.step === 'A').length, rows: out };
}

// ── fetch (GLEIF; capped; confirmed) ─────────────────────────────────────

async function fetchSample(args) {
  const s = JSON.parse(readFileSync(args.sample, 'utf8'));
  const n = s.rows.length;
  if (n > MAX_GLEIF_CALLS) throw new Error(`sample has ${n} rows > ${MAX_GLEIF_CALLS}`);
  if (Number(args['confirm-gleif-calls']) !== n) throw new Error(`refused: pass --confirm-gleif-calls ${n} to make ${n} GLEIF calls (the ≤ 50-call freshness allowance, Fri 16 gate)`);
  mkdirSync(args.out, { recursive: true });
  const ledger = [];
  for (const row of s.rows) {
    const t0 = Date.now();
    let status = null, body = null;
    try { const resp = await fetch(GLEIF_API + encodeURIComponent(row.lei), { signal: AbortSignal.timeout(10000) }); status = resp.status; body = await resp.text(); }
    catch (e) { status = `error:${e.name}`; }
    writeFileSync(path.join(args.out, `${row.lei}.json`), body ?? '', { mode: 0o600 });
    ledger.push({ lei: row.lei, status, ms: Date.now() - t0, utc: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 1200));          // well under GLEIF's public rate limit
  }
  writeFileSync(path.join(args.out, 'calls.jsonl'), ledger.map(x => JSON.stringify(x)).join('\n') + '\n');
  console.log(JSON.stringify({ calls: ledger.length, out: args.out }));
}

// ── compare (offline) ────────────────────────────────────────────────────

export function compareRow(row, api) {
  const at = api?.data?.attributes; if (!at) return { lei: row.lei, step: row.step, ok: false, why: 'no API record' };
  const e = at.entity || {}, reg = at.registration || {};
  const checks = [];
  // With a GC snapshot (the CLI always attaches one), every row is compared on the same four
  // Golden Copy fields, so rows whose plan sets no Level 1 (C-reasons) are still tested.
  const exp = row.gc ? { lei: row.lei, legal_name: row.gc.legal_name, legal_address_country: row.gc.legal_country,
                         entity_status: row.gc.entity_status, lei_registration_status: row.gc.registration_status } : (row.expect || {});
  if ('legal_name' in exp) checks.push(['legal_name', exp.legal_name, e.legalName?.name]);
  if ('legal_address_country' in exp) checks.push(['legal_address_country', exp.legal_address_country, e.legalAddress?.country]);
  if ('entity_status' in exp) checks.push(['entity_status', exp.entity_status, e.status]);
  if ('lei_registration_status' in exp) checks.push(['lei_registration_status', exp.lei_registration_status, reg.status]);
  if ('lei' in exp) checks.push(['lei', exp.lei, api.data.id]);
  const bad = checks.filter(([, a, b]) => !isNull(a) && a !== b);
  // A identity check (R-1 (a)): the LEI must still name the same legal entity in the same country.
  const identity = row.step === 'A' ? bad.filter(([f]) => f === 'legal_name' || f === 'legal_address_country' || f === 'lei') : [];
  return { lei: row.lei, step: row.step, ok: bad.length === 0, mismatches: bad.map(([f, a, b]) => ({ field: f, plan: a, api: b })), a_identity_mismatch: identity.length > 0 };
}

function compare(args) {
  const s = JSON.parse(readFileSync(args.sample, 'utf8'));
  const res = s.rows.map(row => {
    const f = path.join(args.responses, `${row.lei}.json`);
    let api = null; try { api = JSON.parse(readFileSync(f, 'utf8')); } catch { /* missing/unparseable */ }
    return compareRow(row, api);
  });
  const ok = res.filter(x => x.ok).length;
  const out = { sample_sha256: sha256File(args.sample), n: res.length, agree: ok, pct: Math.round(1000 * ok / res.length) / 10,
    a_rows: res.filter(x => x.step === 'A').length, a_identity_mismatches: res.filter(x => x.a_identity_mismatch).map(x => x.lei),
    gate: ok / res.length >= 0.98 && !res.some(x => x.a_identity_mismatch) && res.filter(x => x.step === 'A').length >= 15 ? 'PASS' : 'STOP', rows: res };
  console.log(JSON.stringify(out, null, 1));
  if (args.out) writeFileSync(args.out, JSON.stringify(out, null, 1) + '\n');
  return out;
}

// ── LEI-bearing rows on both bases (ML-1015-1) ───────────────────────────
//
// Whole-table (governing): expected = 20,612 + drift, where 20,612 = 16,627 (29 Sep)
// + 3,677 A + 308 P, and drift = LEI rows added by other writers since the 29 Sep
// export, explained in two parts from the exports: before the run (fresh pre-run
// export − 16,627) and during the run (LEI rows in the post-run export that 011
// did not create, beyond the pre-run export). PASS/FAIL uses this basis.
// 29 Sep export basis (traceability): 16,627 + A applied = 20,304.
export const BASE_29SEP = { lei_rows: 16627, a_rows: 3677, p_rows: 308 };

export function leiBases({ preLeiRows, postLeiRows, aApplied, pNew, base = BASE_29SEP }) {
  const own = aApplied + pNew;                              // LEI rows 011 created in this run
  const other = postLeiRows - own;                           // everyone else's LEI rows at the post-run export
  const driftBefore = preLeiRows - base.lei_rows;
  const driftDuring = other - preLeiRows;
  const drift = driftBefore + driftDuring;
  const expected = base.lei_rows + base.a_rows + base.p_rows + drift;
  return {
    whole_table: { governing: true, observed: postLeiRows, expected, expected_29sep: base.lei_rows + base.a_rows + base.p_rows, drift,
      drift_explained: { before_run_other_writers: driftBefore, during_run_other_writers: driftDuring },
      unexplained: postLeiRows - expected, pass: postLeiRows === expected },
    export_29sep: { observed: base.lei_rows + aApplied, expected: base.lei_rows + base.a_rows, note: 'traceability: 16,627 + A applied; excludes new parent rows and drift' }
  };
}

// ── postrun (§9, from exports) ───────────────────────────────────────────

// aDeferred (MA-OCT-011.CLOSE; Founder "Defer A", ML-1021-2): base A = 0; pRaced = plan P rows whose CAS raced
// (their LEI row was created by another writer, so it is counted in drift, not as 011's P).
export async function postrun({ planDir, pre, post, gc, seed = 'MA-OCT-011-postrun', sampleN = 200, minEA = 25, aDeferred = false, pRaced = 0 }) {
  const { plan } = loadPlanFile(planDir);
  const E0 = new Map(pre.em.map(r => [String(r.entity_id), r]));
  const E1 = new Map(post.em.map(r => [String(r.entity_id), r]));
  const dup = em => { const m = new Map(); for (const r of em) if (!isNull(r.lei)) m.set(r.lei, (m.get(r.lei) || 0) + 1); return new Set([...m].filter(([, n]) => n > 1).map(([l]) => l)); };
  const d0 = dup(pre.em), d1 = dup(post.em);
  const touched = post.em.filter(r => r.gleif_enrichment_version === 11);
  const newRows = post.em.filter(r => !E0.has(String(r.entity_id)));
  const edges = rs => new Set(rs.filter(r => r.relationship_type === 'legal_parent').map(r => `${r.parent_entity_id}|${r.child_entity_id}`));
  const e0 = edges(pre.rel), e1 = edges(post.rel);
  const wrongIds = new Set(JSON.parse(readFileSync(path.join(planDir, 'exceptions.json'), 'utf8')).wrong_ids || []);
  // Invariants on every touched pre-existing row (pre-image diff).
  const inv = { normalized_name_or_type_changed: 0, lei_overwritten: 0, country_overwritten: 0, non_placeholder_name_changed: 0 };
  for (const r of touched) {
    const o = E0.get(String(r.entity_id)); if (!o) continue;
    if (o.normalized_name !== r.normalized_name || o.type !== r.type) inv.normalized_name_or_type_changed++;
    if (!isNull(o.lei) && o.lei !== r.lei) inv.lei_overwritten++;
    if (!isNull(o.country) && o.country !== r.country) inv.country_overwritten++;
    if (o.name !== o.lei && o.name !== r.name) inv.non_placeholder_name_changed++;
  }
  const ki229 = ['3|1565', '143|2247', '49|2476', '194|6980', '1565|3', '2247|143', '2476|49', '6980|194'];
  const counts = {
    lei_rows_pre: pre.em.filter(r => !isNull(r.lei)).length,
    lei_rows_post_excl_new_parents: post.em.filter(r => !isNull(r.lei)).length - newRows.filter(r => r.type === 'holding' && !isNull(r.lei)).length,
    new_parent_rows: newRows.filter(r => r.type === 'holding' && r.gleif_enrichment_version === 11).length,
    phase3_pool: post.em.filter(phase3).length,
    no_link_declared: post.em.filter(r => r.direct_parent_exception === 'NO_LINK_DECLARED').length,
    ultimate_parent_exception_on_existing_rows: post.em.filter(r => E0.has(String(r.entity_id)) && !isNull(r.ultimate_parent_exception)).length,
    legal_parent_edges_pre: e0.size, legal_parent_edges_post: e1.size,
    new_duplicate_leis: [...d1].filter(l => !d0.has(l)).length,
    ki229_edges_unchanged: ki229.filter(k => e0.has(k)).every(k => e1.has(k)),
    a_rows: post.em.filter(r => r.match_source === 'gc_name_t1').length,
    wrong_lei_rows_touched: [...wrongIds].filter(id => E1.get(String(id))?.gleif_enrichment_version === 11).length,
    ...inv
  };
  // Sampled diff: 200 random touched rows against gleif_006.db, ≥ 25 of them E-A children (E-3).
  const r = rng(seed);
  const eaKeys = new Set(stmts(plan, ['EA']).map(s => String(s.child_entity_id)));
  const eaTouched = touched.filter(x => eaKeys.has(String(x.entity_id)));
  const nEA = Math.min(Math.max(minEA, 0), eaTouched.length);
  const rest = touched.filter(x => !eaKeys.has(String(x.entity_id)));
  const sample = [...pick(eaTouched, nEA, r), ...pick(rest, sampleN - nEA, r)];
  const parentId = new Map(post.em.filter(x => !isNull(x.lei)).map(x => [x.lei, x.entity_id]));
  // Compare only the columns 011 wrote on each row (the plan's SET list; every column of a
  // P insert). A C / C-reasons row keeps its own Level 1 (RC-8), which may differ from GC.
  const written = new Map();
  for (const st of stmts(plan, ['P', 'B', 'C', 'CR', 'RC15', 'A'])) {
    if (st.kind === 'em_update') written.set(String(st.entity_id), new Set([...(written.get(String(st.entity_id)) || []), ...Object.keys(st.set), ...Object.keys(st.fallback?.set || {})]));
    if (st.kind === 'em_insert') written.set('lei:' + st.values.lei, new Set(Object.keys(st.values)));
  }
  const diffs = [];
  for (const x of sample) {
    const g = gc.lei(x.lei); const bad = [];
    const w = written.get(String(x.entity_id)) || written.get('lei:' + x.lei) || new Set();
    if (!g) bad.push('no GC record');
    else {
      if (w.has('legal_name') && x.legal_name !== g.legal_name) bad.push('legal_name');
      if (w.has('legal_jurisdiction') && x.legal_jurisdiction !== g.jurisdiction) bad.push('legal_jurisdiction');
      if (w.has('entity_status') && x.entity_status !== g.entity_status) bad.push('entity_status');
      for (const [t, lc, ec] of [[DIR, 'direct_parent_lei', 'direct_parent_exception'], [ULT, 'ultimate_parent_lei', 'ultimate_parent_exception']]) {
        const p = gc.rr(x.lei, t);
        if (w.has(lc) && x[lc] !== p) bad.push(lc);
        if (w.has(ec) && !isNull(x[ec]) && x[ec] !== gc.rx(x.lei, t)) bad.push(ec);
      }
      if (!w.size) bad.push('no planned statement for a version-11 row');
      if (eaKeys.has(String(x.entity_id))) {
        const p = gc.rr(x.lei, DIR); const pid = parentId.get(p);
        if (!pid || !e1.has(`${pid}|${x.entity_id}`)) bad.push('E-A edge');
      }
    }
    diffs.push({ entity_id: x.entity_id, lei: x.lei, ea: eaKeys.has(String(x.entity_id)), ok: bad.length === 0, bad });
  }
  const sampled = { n: diffs.length, ea_edges: diffs.filter(d => d.ea).length, matches: diffs.filter(d => d.ok).length, mismatches: diffs.filter(d => !d.ok) };
  const preLei = new Set(pre.em.filter(x => !isNull(x.lei)).map(x => String(x.entity_id)));
  const aApplied = post.em.filter(x => x.match_source === 'gc_name_t1' && x.gleif_enrichment_version === 11 && !isNull(x.lei) && E0.has(String(x.entity_id)) && !preLei.has(String(x.entity_id))).length;
  const pNew = newRows.filter(x => x.type === 'holding' && x.gleif_enrichment_version === 11 && !isNull(x.lei)).length;
  const lei_rows = leiBases({ preLeiRows: preLei.size, postLeiRows: post.em.filter(x => !isNull(x.lei)).length, aApplied, pNew,
    base: { ...BASE_29SEP, a_rows: aDeferred ? 0 : (plan.counts.a_rows ?? BASE_29SEP.a_rows), p_rows: (plan.counts.p_rows ?? BASE_29SEP.p_rows) - pRaced } });
  if (aDeferred) lei_rows.nominal_a_deferred = { expected: BASE_29SEP.lei_rows + BASE_29SEP.a_rows + BASE_29SEP.p_rows - BASE_29SEP.a_rows, rule: '20,612 − 3,677 A = 16,935 ± traced drift' };
  const sampleOk = sampled.matches === sampled.n && (aDeferred || sampled.ea_edges >= Math.min(minEA, eaTouched.length));
  if (aDeferred) sampled.ea_part = 'not applicable (A deferred: no A or E-A rows written)';
  return { gc_source: GC_SOURCE, lei_rows, counts, sampled_diff: sampled, pass: sampleOk && lei_rows.whole_table.pass };
}

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  (async () => {
    if (cmd === 'sample') {
      const { plan, sha } = loadPlanFile(args.plan);
      const s = { plan_sha256: sha, ...selectSample(plan, { n: Number(args.n || 50), minA: Number(args['min-a'] || 15), seed: args.seed || 'MA-OCT-011' }) };
      const gcdb = await openGc(BASIS.gleif_006_db.path);
      for (const r of s.rows) { const g = gcdb.lei(r.lei); r.gc = g && { legal_name: g.legal_name, legal_country: g.legal_country, entity_status: g.entity_status, registration_status: g.registration_status, publication: GC_SOURCE }; }
      gcdb.close();
      writeFileSync(args.out, JSON.stringify(s, null, 1) + '\n', { mode: 0o600 });
      console.log(JSON.stringify({ out: args.out, sha256: sha256File(args.out), n: s.n, a_rows: s.a_rows, by_step: s.rows.reduce((a, x) => (a[x.step] = (a[x.step] || 0) + 1, a), {}) }));
    } else if (cmd === 'fetch') await fetchSample(args);
    else if (cmd === 'compare') compare(args);
    else if (cmd === 'postrun') {
      const gc = await openGc(BASIS.gleif_006_db.path);
      const out = await postrun({ planDir: args.plan, pre: await loadExport(args.pre), post: await loadExport(args.post), gc, seed: args.seed, aDeferred: !!args['a-deferred'], pRaced: Number(args['p-raced'] || 0) });
      gc.close();
      writeFileSync(args.out, JSON.stringify(out, null, 1) + '\n');
      console.log(JSON.stringify({ out: args.out, sha256: sha256File(args.out), pass: out.pass, lei_rows: out.lei_rows, counts: out.counts, sampled: { n: out.sampled_diff.n, ea: out.sampled_diff.ea_edges, matches: out.sampled_diff.matches } }, null, 1));
    } else { console.error('usage: gleif-reconcile-011-verify.mjs sample|fetch|compare|postrun …'); process.exit(2); }
  })().catch(e => { console.error('VERIFY ERROR:', e.message); process.exit(1); });
}
