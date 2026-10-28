#!/usr/bin/env node
// MA-OCT-011 plan generator (spec rev 1.9 §3.0–§3.4, §4.1, §4.2c, §11 R-3).
//
//   node gleif-reconcile-011-plan.mjs export   --out <dir> [--max-reads N]      (X1/X2 keyset export; read-only D1)
//   node gleif-reconcile-011-plan.mjs generate --export <dir|d2> --out <dir> [--expect-006-final]
//
// `generate` is local only: 0 D1 reads, 0 GLEIF calls. It reads the export
// (fresh keyset export, or the 29 Sep D2 export for the dry run), the pinned
// 006 FINAL inputs (SHA-checked) and gleif_006.db (opened read-only), and
// writes a SHA-pinned plan file plus the hand-off and review lists. The runner
// executes only that plan.
//
// N-2: every statement carries tier tags; a write is planned only when its
// backing 006 FINAL classification row is a high-confidence tier. Excluded
// tiers (T1_LAPSED, T1+/T1c, N+, D5-3, D7-2, the 9 D7-1 government rows, the 24
// wrong-LEI rows) are never emitted — asserted before the plan is written.

import { appendFileSync, createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  EM_COLS, ENRICH_VERSION, GC_SOURCE, LIMITS, MATCH_SOURCE_A, RUN_TS, STEP_ORDER,
  EDGE_COST, INSERT_EM_COST, QUEUE_COST, isNull, sha256, sha256File, stableStringify, updateCost,
  wranglerTransport, writeJsonAtomic, ensureDir, lit, workPaths
} from '../lib/gleif-reconcile-011-core.mjs';
import { normalizeName } from '../src/entities-seed.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO = path.resolve(CORP_DIR, '..', '..');
const W6 = path.join(homedir(), 'MeridianAtlas-work', 'gleif-006');

// Pinned 006 FINAL inputs (spec Appendix A; hashes re-verified 13 Oct).
export const BASIS = {
  gleif_006_db:   { path: path.join(W6, 'gleif_006.db'), sha256: 'bd704c14c3ce862cff572e8922004248fb1178a1cede816956b8bb6c5e05b047', big: true },
  classification: { path: path.join(REPO, 'claude', 'MA-OCT-006_classification.csv'), sha256: 'cb3b3a841147235d0d2189fec0fba481758676602015d62cc49ae9babc13df64' },
  tiers:          { path: path.join(W6, 'day4', 'h12_tiers.csv'), sha256: 'a280c3c23b8a67ce1a985d97b4defe2c973dd8dba736c6999fadf26d751427c9' },
  pairs:          { path: path.join(W6, 'day3', 'norm_hidden_duplicates.csv'), sha256: '9cafca93e62a7a234d12f10a7cce63f60c8b527bde4da8250a79378aac035a95' },
  wrong:          { path: path.join(W6, 'day6', 'wrong_lei_detail.csv'), sha256: '41502aa7666e8aa36a396d3e4e5055d6562c381e363e9ffef257450efcb51c01' },
  d2_em:          { path: path.join(W6, 'day2', 'd2_entity_master.csv'), sha256: 'ad4d40a0ba21a07f70a88e7bda7eee1d0d26a8b8a7876f87b77af7a2d45abd62' },
  d2_queue:       { path: path.join(W6, 'day2', 'd3_queue.csv'), sha256: '23a52f9483a9b387c5ce40f8f050c742e82cc8d0bb7fb48014c0020a61299f2f' },
  d2_rel:         { path: path.join(W6, 'day2', 'd4_relationships.csv'), sha256: 'aa2f30a01202aa7c345ef7f5a1a131d55ffb0c92b4758c76c07b848e82ba4feb' }
};

// Spec rev 1.9 figures on the 29 Sep export basis (§3, §4.2, §15, Appendix A).
export const EXPECT_006_FINAL = {
  a_rows: 3677, a_base_rows: 4109, a_base_leis: 3717, a_case_i: 3285, a_case_ii_single: 44, a_case_ii_shared: 348,
  a_case_iii_leis: 3, a_case_iv_leis: 31, a_case_iv_rows: 62, a_case_v_leis: 6, a_case_v_rows: 19, twins_013: 392,
  a_l2_rr_direct: 514, a_l2_rr_ultimate: 556, a_l2_rx_direct: 3163, a_l2_rx_ultimate: 3121,
  b_rows: 7436, b_l2_rx_direct: 7358, b_l2_rr_direct: 71, b_l2_neither_direct: 7, b_l2_rx_ultimate: 7355, b_l2_rr_ultimate: 74,
  rc15_total: 859, rc15_in_cr: 830, rc15_in_c: 1, rc15_standalone: 29,
  c_entities: 812, c_direct: 728, c_ultimate: 801, c_outside_pool: 738, c_outside_direct: 657, c_outside_ultimate: 727,
  // P / E-C / E-A (finding F-2): 51 missing parent LEIs are also A targets and 6 are the GC
  // match of a T1_LAPSED no-LEI row. The spec's 365 parents = 308 inserted + 51 created by A
  // + 6 deferred; its 728 E-C edges = 680 E-C + 45 ECA (after A) + 3 deferred. With the
  // double claim removed, E-1 excludes only the 1 wrong-LEI parent: Q52's 299 = 298 + 1,
  // and 298 + 1 + 215 deferred = 514 (Q51).
  p_planned_parents: 365, p_rows: 308, p_a_overlap: 51, p_identity_deferred: 6, p_distinct_parents: 705,
  ec_edges_planned: 728, ec_edges: 680, eca_edges: 45, ec_identity_deferred: 3,
  ea_parent_present: 299, ea_edges: 298, ea_excluded_e1: 1, ea_deferred: 215,
  cr_entities: 8345, cr_direct: 8333, cr_ultimate: 8263, cr_ultimate_only: 12, cr_field_writes: 16596, cr_with_c: 92, cr_standalone: 8253,
  no_reason_nld: 128, q_rows: 3677,
  // OQ-12 report-only lists (never written)
  ro_t1_lapsed: 1342, ro_t1plus_t1c: 1739, ro_nplus: 852, ro_review: 2336
};

const DIR = 'IS_DIRECTLY_CONSOLIDATED_BY', ULT = 'IS_ULTIMATELY_CONSOLIDATED_BY';
const RXC = { [DIR]: 'DIRECT_ACCOUNTING_CONSOLIDATION_PARENT', [ULT]: 'ULTIMATE_ACCOUNTING_CONSOLIDATION_PARENT' };
const NLD = 'NO_LINK_DECLARED';
const KI229 = new Set(['1565|3', '2247|143', '2476|49', '6980|194']);   // KI 22.9's 4 edges (child|parent, either order checked)
const NUMERIC = new Set(['entity_id', 'gleif_enrichment_version', 'parent_entity_id', 'child_entity_id', 'rowid', 'isin_match_count', 'etf_holding_count', 'has_etf_holdings', 'has_13f_filings', 'has_market_data']);

// ── Input readers ────────────────────────────────────────────────────────

// RFC 4180 CSV (quoted fields, doubled quotes, embedded newlines). `\N` = NULL.
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += ch; i++; continue;
    }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === ',') { row.push(f); f = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += ch; i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const [hdr, ...body] = rows;
  return body.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(hdr.map((h, k) => [h, r[k]])));
}

function typed(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    if (v === '\\N' || v === undefined) o[k] = null;
    else if (NUMERIC.has(k) && v !== '' && /^-?\d+$/.test(v)) o[k] = Number(v);
    else o[k] = v;
  }
  return o;
}
const csvRows = p => parseCsv(readFileSync(p, 'utf8')).map(typed);

async function jsonlRows(p) {
  const out = [];
  const rl = readline.createInterface({ input: createReadStream(p, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) if (line.trim()) out.push(JSON.parse(line));
  return out;
}

// An export is either the 29 Sep D2 (dry run; NOT releasable: it lacks most
// Level 1 columns, which are then taken as NULL) or a fresh keyset export
// directory written by `export` (JSONL + manifest.json).
async function loadExport(spec) {
  if (spec === 'd2') {
    const em = csvRows(BASIS.d2_em.path);
    const missing = EM_COLS.filter(c => !(c in em[0]));
    for (const r of em) for (const c of missing) r[c] = c === 'gleif_enrichment_version' ? 1 : null;
    return { kind: 'd2', releasable: false, missing_columns: missing, em, queue: csvRows(BASIS.d2_queue.path), rel: csvRows(BASIS.d2_rel.path),
             shas: { em: BASIS.d2_em.sha256, queue: BASIS.d2_queue.sha256, rel: BASIS.d2_rel.sha256 } };
  }
  const man = JSON.parse(readFileSync(path.join(spec, 'manifest.json'), 'utf8'));
  const shas = {};
  for (const k of ['em', 'queue', 'rel']) {
    const p = path.join(spec, man.files[k].file);
    shas[k] = sha256File(p);
    if (shas[k] !== man.files[k].sha256) throw new Error(`export ${k}: SHA mismatch with manifest`);
  }
  const em = await jsonlRows(path.join(spec, man.files.em.file));
  const missing = EM_COLS.filter(c => !(c in em[0]));
  if (missing.length) throw new Error(`fresh export lacks columns: ${missing.join(', ')}`);
  return { kind: 'fresh', releasable: true, missing_columns: [], em, queue: await jsonlRows(path.join(spec, man.files.queue.file)),
           rel: await jsonlRows(path.join(spec, man.files.rel.file)), shas, manifest: man };
}

function verifyBasis({ skipBig = false } = {}) {
  const out = {};
  for (const [k, b] of Object.entries(BASIS)) {
    if (!existsSync(b.path)) throw new Error(`basis input missing: ${b.path}`);
    const got = b.big && skipBig ? null : sha256File(b.path);
    if (got !== null && got !== b.sha256) throw new Error(`basis ${k}: SHA ${got} != pinned ${b.sha256}`);
    out[k] = { path: b.path, sha256: b.sha256, verified: got !== null };
  }
  return out;
}

// ── Golden Copy accessor (gleif_006.db, read-only) ───────────────────────

async function openGc(dbPath) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const meta = Object.fromEntries(db.prepare('SELECT k, v FROM meta').all().map(r => [r.k, r.v]));
  if (meta.gc_publish_date !== '2026-09-28 16:00:00 UTC') throw new Error(`gleif_006.db publication ${meta.gc_publish_date} is not the pinned 28 Sep publication`);
  const qLei = db.prepare('SELECT * FROM gc_lei WHERE lei = ?');
  const qRr = db.prepare("SELECT parent_id FROM rr WHERE child_lei = ? AND rel_type = ? AND rel_status = 'ACTIVE' AND parent_id_type = 'LEI'");
  const qRx = db.prepare('SELECT reasons_all, refs FROM rx WHERE lei = ? AND category = ?');
  const cache = new Map();
  const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  return {
    meta,
    lei: l => memo('L' + l, () => { const r = qLei.get(l); return r ? { ...r } : null; }),
    // One ACTIVE RR parent per (child, type) on this publication; >1 is a plan error.
    rr: (l, t) => memo(`R${t}${l}`, () => {
      const ps = [...new Set(qRr.all(l, t).map(r => r.parent_id))].sort();
      if (ps.length > 1) throw new Error(`RR ${t} for ${l}: ${ps.length} ACTIVE parents`);
      return ps[0] || null;
    }),
    // Verbatim GLEIF reason list (pipe-joined, as 006 classified it: day5_classify.py rx_reason).
    rx: (l, t) => memo(`X${t}${l}`, () => { const r = qRx.get(l, RXC[t]); return r ? r.reasons_all : null; }),
    close: () => db.close()
  };
}

// ── Plan construction ────────────────────────────────────────────────────

export const phase3 = r => !isNull(r.lei) && r.type !== 'fund' &&
  (isNull(r.lei_status) || (isNull(r.direct_parent_lei) && isNull(r.ultimate_parent_lei) && isNull(r.direct_parent_exception)));

export async function buildPlan({ exp, gc, basisRows, runLabel = 'MA-OCT-011' }) {
  const { cl, tiers, pairs, wrongRows, d2 } = basisRows;
  const counts = {}; const inc = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };
  const lists = {
    a_withheld: [], handoff_twins: [], handoff_deferred: [], review_shared_no_pair: [], review_gov: [], ea_deferred: [], ea_excluded: [],
    parent_collision: [], contradicted: [], pool_not_in_006_basis: [], not_in_006_tier: [], no_reason_nld: [], reason_not_overwritten: [],
    gc_missing: [], queue_not_closable: [], edge_skipped: [], p_deferred_identity: [], report_only_tiers: {}
  };

  // Basis sets.
  const clIdx = new Map(cl.map(r => [`${r.entity_id}|${r.field}`, r]));
  const wrong = new Set(wrongRows.filter(r => r.day6_verdict === 'wrong LEI').map(r => String(r.entity_id)));
  wrong.delete('2014');                                               // D6-4: OPAP rename, not W
  if (wrong.size !== 24) throw new Error(`wrong-LEI set is ${wrong.size}, expected 24`);
  const gov9 = new Set(cl.filter(r => r.field === 'lei' && String(r.evidence_ref).includes('D6-1 government')).map(r => String(r.entity_id)));
  if (gov9.size !== 9) throw new Error(`D7-1 government set is ${gov9.size}, expected 9`);
  const side = new Map();                                             // entity_id → { pair, side }
  pairs.forEach((p, k) => { side.set(String(p.entity_id), { pair: k, side: 'old' }); side.set(String(p.collides_with), { pair: k, side: 'new' }); });
  const d2ById = new Map(d2.map(r => [String(r.entity_id), r]));
  const pool29 = new Set(d2.filter(r => phase3(r) && !wrong.has(String(r.entity_id))).map(r => String(r.entity_id)));
  const rc15 = new Set(cl.filter(r => r.rc_id === 'RC-15' && r.field === 'name' && r.confidence === 'high').map(r => String(r.entity_id)));
  counts.pool29 = pool29.size; counts.rc15_total = rc15.size;

  const highTier = (eid, field, cats) => { const r = clIdx.get(`${eid}|${field}`); return !!r && cats.includes(r.category) && r.confidence === 'high'; };

  // Export indexes.
  const E = new Map(exp.em.map(r => [String(r.entity_id), r]));
  const byLei = new Map();
  for (const r of exp.em) if (!isNull(r.lei)) { const k = r.lei; if (!byLei.has(k)) byLei.set(k, []); byLei.get(k).push(String(r.entity_id)); }
  const keyset = new Set(exp.em.map(r => `${r.normalized_name}|${r.type}`));
  const queue = new Map(exp.queue.map(r => [String(r.entity_id), r]));
  const edges = new Set(exp.rel.filter(r => r.relationship_type === 'legal_parent').map(r => `${r.parent_entity_id}|${r.child_entity_id}`));

  const prov = { gleif_enrichment_version: ENRICH_VERSION, gleif_last_updated: RUN_TS, lei_validation_source: GC_SOURCE };
  const plannedUpdates = new Map();       // entity_id → { step, set, tiers:Set, pre, lei_free, notes }
  const want = (eid, row, col, val, tier) => {
    const u = plannedUpdates.get(eid) || { set: {}, tiers: new Set(), row };
    if (row[col] !== val) u.set[col] = val;
    u.tiers.add(tier);
    plannedUpdates.set(eid, u);
  };

  // Level 2 for one LEI: RR mirrors or RX reasons (only into empty fields;
  // an existing different parent is a contradiction → the plan fails, §3.3).
  const parentNames = new Map();
  const gcName = l => { const g = gc.lei(l); return g ? g.legal_name : null; };
  function level2(eid, row, lei, tierRr, tierRx, opts = {}) {
    const res = { rr: {}, rx: {} };
    for (const [t, lc, nc, ec] of [[DIR, 'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception'],
                                    [ULT, 'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception']]) {
      const tag = t === DIR ? 'direct' : 'ultimate';
      const p = gc.rr(lei, t);
      if (p) {
        if (!isNull(row[lc])) { if (row[lc] !== p) lists.contradicted.push({ entity_id: eid, field: lc, d1: row[lc], rr: p }); continue; }
        if (opts.requireTier && !highTier(eid, lc, ['c', 'd'])) { lists.not_in_006_tier.push({ entity_id: eid, field: lc, why: 'RR gap not (c)/(d) high' }); continue; }
        const nm = gcName(p);
        if (!nm) { lists.gc_missing.push({ entity_id: eid, parent_lei: p }); continue; }
        parentNames.set(p, nm);
        want(eid, row, lc, p, tierRr); want(eid, row, nc, nm, tierRr);
        if (!isNull(row[ec]) && t === DIR) want(eid, row, ec, null, tierRr);       // KI 22.43: drop the wrong marker
        res.rr[tag] = p;
        continue;
      }
      if (!isNull(row[lc])) continue;                                              // D1 holds a parent GLEIF no longer lists: leave it
      const rx = gc.rx(lei, t);
      if (!rx) { res.rx[tag] = null; continue; }
      if (!isNull(row[ec]) && row[ec] !== NLD) { if (row[ec] !== rx) lists.reason_not_overwritten.push({ entity_id: eid, field: ec, d1: row[ec], rx }); continue; }
      if (opts.requireTier && !highTier(eid, lc, ['b'])) { lists.not_in_006_tier.push({ entity_id: eid, field: ec, why: 'RX gap not (b) high' }); continue; }
      if (row[ec] !== rx) { want(eid, row, ec, rx, tierRx); res.rx[tag] = rx; }
    }
    return res;
  }

  // ---- A (§3.1, L11-7) --------------------------------------------------
  const a6 = tiers.filter(t => t.tier === 'T1' && t.gc_reg_status !== 'DUPLICATE' && !gov9.has(String(t.entity_id)));
  counts.a_base_rows = a6.length; counts.a_base_leis = new Set(a6.map(t => t.gc_lei)).size;
  for (const t of a6) if (!highTier(t.entity_id, 'lei', ['d'])) throw new Error(`A base row ${t.entity_id} is not classification lei (d) high (Q77)`);
  const byGc = new Map();
  for (const t of a6) { if (!byGc.has(t.gc_lei)) byGc.set(t.gc_lei, []); byGc.get(t.gc_lei).push(String(t.entity_id)); }
  const aTargets = [];                    // { eid, lei, case }
  for (const [lei, ids] of byGc) {
    if (ids.length === 1) {
      const s = side.get(ids[0]);
      if (!s) { aTargets.push({ eid: ids[0], lei, case: 'i' }); inc('a_case_i'); }
      else if (s.side === 'old') { aTargets.push({ eid: ids[0], lei, case: 'ii_single' }); inc('a_case_ii_single'); twin(ids[0], lei); }
      else { inc('a_case_iii_leis'); deferred(lei, ids, 'iii: match only on the newer side of a KI 22.41 pair'); }
      continue;
    }
    const sides = ids.map(i => side.get(i));
    if (ids.length === 2 && sides.every(Boolean) && sides[0].pair === sides[1].pair && sides[0].side !== sides[1].side) {
      const old = ids[sides[0].side === 'old' ? 0 : 1];
      aTargets.push({ eid: old, lei, case: 'ii_shared' }); inc('a_case_ii_shared'); twin(old, lei);
    } else if (sides.every(s => !s)) {
      inc('a_case_iv_leis'); inc('a_case_iv_rows', ids.length);
      lists.review_shared_no_pair.push({ lei, entity_ids: ids, why: 'iv: LEI shared by rows in no KI 22.41 pair → manual review (MA-OCT-004)' });
    } else {
      inc('a_case_v_leis'); inc('a_case_v_rows', ids.length);
      deferred(lei, ids, 'v: LEI spread over more than one pair, or a pair plus an outside row');
    }
  }
  function twin(oldId, lei) {
    const s = side.get(oldId); const newId = String(pairs[s.pair].collides_with);
    const q = queue.get(newId);
    lists.handoff_twins.push({ survivor_entity_id: oldId, twin_entity_id: newId, lei, twin_row: E.get(newId) || null, twin_queue_row: q || null, rule: 'S1: older (drift) row survives; 013 deletes the newer twin' });
  }
  function deferred(lei, ids, why) {
    for (const id of ids) {
      const g = gc.lei(lei);
      lists.handoff_deferred.push({ lei, entity_id: id, why, row: E.get(id) || null, payload: g ? fullPayload(lei, g) : null });
    }
  }
  function fullPayload(lei, g) {          // R-3: Level 1 + Level 2 + GC provenance, so 013 never reads gleif_006.db
    const d = gc.rr(lei, DIR), u = gc.rr(lei, ULT);
    return {
      level1: { lei, lei_status: g.entity_status, entity_status: g.entity_status, lei_registration_status: g.registration_status, legal_name: g.legal_name,
                legal_jurisdiction: g.jurisdiction, legal_address_country: g.legal_country, hq_country: g.hq_country, legal_form_code: g.legal_form_code,
                entity_category: g.category, lei_last_updated: g.last_update, lei_next_renewal: g.next_renewal },
      level2: { direct_parent_lei: d, direct_parent_name: d ? gcName(d) : null, direct_parent_exception: d ? null : gc.rx(lei, DIR),
                ultimate_parent_lei: u, ultimate_parent_name: u ? gcName(u) : null, ultimate_parent_exception: u ? null : gc.rx(lei, ULT) },
      provenance: { publication: GC_SOURCE, gc_publish_date: gc.meta.gc_publish_date, gc_lei_record: lei, managing_lou: g.managing_lou,
                    rr_records: [d && { child: lei, parent: d, rel_type: DIR }, u && { child: lei, parent: u, rel_type: ULT }].filter(Boolean),
                    rx_records: [!d && gc.rx(lei, DIR) && { lei, category: RXC[DIR] }, !u && gc.rx(lei, ULT) && { lei, category: RXC[ULT] }].filter(Boolean),
                    lei_validation_source: GC_SOURCE, match_source: MATCH_SOURCE_A }
    };
  }
  for (const id of gov9) lists.review_gov.push({ entity_id: id, why: 'D6-1 / D7-1 government row: automated LEI withheld, manual review (RC-A2)' });

  // ---- Fresh-export validation of A targets -----------------------------
  const aPlanned = new Map();             // lei → eid
  for (const t of aTargets) {
    const r = E.get(t.eid), d = d2ById.get(t.eid);
    const g = gc.lei(t.lei);
    const why = !r ? 'row absent from the export' : !isNull(r.lei) ? 'row now holds an LEI' :
                (!d || r.name !== d.name || r.normalized_name !== d.normalized_name) ? 'name/normalized_name changed since the 006 match' :
                byLei.has(t.lei) ? 'LEI now on another row' : !g ? 'GC record missing' :
                (wrong.has(t.eid) || gov9.has(t.eid)) ? 'excluded set' : null;
    if (why) { lists.a_withheld.push({ entity_id: t.eid, lei: t.lei, case: t.case, why }); continue; }
    aPlanned.set(t.lei, t.eid);
  }

  // ---- B / C / C-reasons / RC-15 over LEI-bearing rows (§3.2–§3.4) ------
  const cDirect = new Set(), cUlt = new Set(), bRows = new Set(), crRows = new Map(), rc15Hit = new Set();
  const parentNeeds = new Map();          // parent lei → { from: Set(eid) } for P (C basis only, L11-10)
  const ecEdges = [];
  for (const r of exp.em) {
    const eid = String(r.entity_id);
    if (isNull(r.lei) || r.type === 'fund' || wrong.has(eid) || gov9.has(eid)) continue;
    const inPool = phase3(r);
    if (inPool && !pool29.has(eid)) { lists.pool_not_in_006_basis.push({ entity_id: eid, lei: r.lei }); continue; }
    const lei = r.lei;
    if (inPool) {                                                     // B: hydration of a pool row
      const g = gc.lei(lei);
      if (!g) { lists.gc_missing.push({ entity_id: eid, lei }); continue; }
      bRows.add(eid);
      const T = 'B:hydration-high';
      if (r.name === lei) want(eid, r, 'name', g.legal_name, T);
      if (isNull(r.lei_status)) want(eid, r, 'lei_status', g.entity_status, T);   // L11-5; a held lei_status is never touched
      want(eid, r, 'entity_status', g.entity_status, T);
      want(eid, r, 'lei_registration_status', g.registration_status, T);
      want(eid, r, 'legal_name', g.legal_name, T);
      want(eid, r, 'legal_jurisdiction', g.jurisdiction, T);
      want(eid, r, 'legal_address_country', g.legal_country, T);
      if (isNull(r.country)) want(eid, r, 'country', g.legal_country, T);
      const l2 = level2(eid, r, lei, 'C:RR-parent-high', 'B:reason-(b)-high', { requireTier: true });
      tallyL2('b', l2);
      noteParents(eid, r, l2);
    } else {
      const before = plannedUpdates.get(eid)?.set ? Object.keys(plannedUpdates.get(eid).set).length : 0;
      const l2 = level2(eid, r, lei, 'C:RR-parent-high', 'CR:reason-(b)-high', { requireTier: true });
      noteParents(eid, r, l2);
      const reasons = Object.entries(l2.rx).filter(([, v]) => v);
      if (reasons.length) crRows.set(eid, reasons.map(([k]) => k));
      // 128: NLD rows GLEIF gives no reason for keep the marker (Q62/Q67).
      if (r.direct_parent_exception === NLD && !l2.rr.direct && isNull(r.direct_parent_lei) && !gc.rx(lei, DIR)) lists.no_reason_nld.push({ entity_id: eid, lei });
      void before;
    }
    if (rc15.has(eid) && r.name === lei && !inPool) {                // RC-15: name + legal_name only (L11-11)
      const g = gc.lei(lei);
      if (g) { want(eid, r, 'name', g.legal_name, 'RC15:name-high'); want(eid, r, 'legal_name', g.legal_name, 'RC15:name-high'); rc15Hit.add(eid); }
    }
  }
  function noteParents(eid, r, l2) {
    if (l2.rr.direct) { cDirect.add(eid); need(l2.rr.direct, eid); ecEdges.push({ child: eid, child_lei: r.lei, parent_lei: l2.rr.direct }); }
    if (l2.rr.ultimate) { cUlt.add(eid); need(l2.rr.ultimate, eid); }
  }
  function need(p, eid) { if (!parentNeeds.has(p)) parentNeeds.set(p, new Set()); parentNeeds.get(p).add(eid); }
  function tallyL2(prefix, l2) {
    for (const tag of ['direct', 'ultimate']) {
      if (l2.rr[tag]) inc(`${prefix}_l2_rr_${tag}`); else if (l2.rx[tag]) inc(`${prefix}_l2_rx_${tag}`); else inc(`${prefix}_l2_neither_${tag}`);
    }
  }

  // ---- P: missing parent rows (C basis only; L11-10) --------------------
  counts.p_distinct_parents = parentNeeds.size;
  const pInserts = [];
  const pKeys = new Set();
  // Finding F-2: a missing parent LEI that is also the 006 GC match of an existing
  // no-LEI row must not get a new holding row (that would duplicate the entity).
  //   - an A target (aPlanned): the parent row is created by A; its E-C edge runs after A (step ECA);
  //   - any other 006 tier match (e.g. T1_LAPSED): deferred and listed; edges wait.
  const tierLei = new Map();
  for (const t of tiers) { if (!tierLei.has(t.gc_lei)) tierLei.set(t.gc_lei, []); tierLei.get(t.gc_lei).push({ entity_id: String(t.entity_id), tier: t.tier, exclusion: t.exclusion || null }); }
  const pDeferred = new Set();
  for (const p of [...parentNeeds.keys()].sort()) {
    if (byLei.has(p)) continue;
    if (aPlanned.has(p)) { inc('p_a_overlap'); continue; }
    if (tierLei.has(p)) { pDeferred.add(p); lists.p_deferred_identity.push({ parent_lei: p, children: [...parentNeeds.get(p)], matched_no_lei_rows: tierLei.get(p),
      why: 'parent LEI is the 006 GC match of an existing no-LEI row outside A: a new holding row would duplicate it (F-2)' }); continue; }
    const g = gc.lei(p);
    if (!g || !g.legal_name) { lists.gc_missing.push({ parent_lei: p }); continue; }
    const nn = normalizeName(g.legal_name);
    if (nn !== g.legal_name_norm) throw new Error(`normalizer parity break for ${p}: JS ${nn} vs GC ${g.legal_name_norm}`);
    const key = `${nn}|holding`;
    if (keyset.has(key) || pKeys.has(key)) { lists.parent_collision.push({ parent_lei: p, normalized_name: nn, why: keyset.has(key) ? 'existing holding key' : 'key shared by two new parents' }); continue; }
    pKeys.add(key);
    const values = { name: g.legal_name, normalized_name: nn, type: 'holding', lei: p, lei_status: g.entity_status, country: g.legal_country,
      legal_name: g.legal_name, entity_category: g.category, entity_status: g.entity_status, legal_address_country: g.legal_country,
      hq_country: g.hq_country, legal_jurisdiction: g.jurisdiction, legal_form_code: g.legal_form_code, lei_registration_status: g.registration_status,
      lei_last_updated: g.last_update, lei_next_renewal: g.next_renewal };
    for (const [t, lc, nc, ec] of [[DIR, 'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception'], [ULT, 'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception']]) {
      const gp = gc.rr(p, t);                                         // its own mirrors only; no cascade
      if (gp && gcName(gp)) { values[lc] = gp; values[nc] = gcName(gp); } else { const rx = gc.rx(p, t); if (rx) values[ec] = rx; }
    }
    Object.assign(values, prov);
    pInserts.push({ kind: 'em_insert', step: 'P', key: `P:${p}`, values, tiers: ['P:RR-parent-high'], est_writes: INSERT_EM_COST });
  }
  const pLeis = new Set(pInserts.map(s => s.values.lei));

  // ---- E-C edges ---------------------------------------------------------
  const holderOk = (l) => { const h = byLei.get(l) || []; return (h.length === 1) || (h.length === 0 && pLeis.has(l)); };
  const ecStmts = [], ecaStmts = [];
  for (const e of ecEdges) {
    const holders = byLei.get(e.parent_lei) || [];
    if (!holders.length && aPlanned.has(e.parent_lei)) {          // parent row created by A (F-2)
      ecaStmts.push({ kind: 'edge_insert', step: 'ECA', key: `ECA:${e.child}`, child_entity_id: Number(e.child), child_lei: e.child_lei, parent_lei: e.parent_lei,
        depends_on: [`A:${aPlanned.get(e.parent_lei)}`], tiers: ['EC:RR-direct-high', 'ECA:parent-created-by-A(F-2)'], est_writes: EDGE_COST });
      continue;
    }
    if (!holders.length && pDeferred.has(e.parent_lei)) { lists.edge_skipped.push({ ...e, step: 'EC', why: 'parent deferred (F-2 identity overlap)' }); inc('ec_identity_deferred'); continue; }
    if (!holderOk(e.parent_lei)) { lists.edge_skipped.push({ ...e, step: 'EC', why: holders.length > 1 ? 'parent LEI held by more than one row' : 'parent row absent (collision or GC gap)' }); continue; }
    if (holders.length === 1 && (edges.has(`${holders[0]}|${e.child}`))) { inc('ec_already_present'); continue; }
    if (holders.length === 1 && (KI229.has(`${e.child}|${holders[0]}`) || KI229.has(`${holders[0]}|${e.child}`))) { lists.edge_skipped.push({ ...e, step: 'EC', why: 'KI 22.9 edge' }); continue; }
    ecStmts.push({ kind: 'edge_insert', step: 'EC', key: `EC:${e.child}`, child_entity_id: Number(e.child), child_lei: e.child_lei, parent_lei: e.parent_lei, tiers: ['EC:RR-direct-high'], est_writes: EDGE_COST });
  }

  // ---- A statements, A Level 2, E-A, Q ----------------------------------
  const aStmts = [], eaStmts = [], qStmts = [];
  for (const [lei, eid] of [...aPlanned].sort((x, y) => Number(x[1]) - Number(y[1]))) {
    const r = E.get(eid), g = gc.lei(lei);
    const T = 'A:T1-high';
    want(eid, r, 'lei', lei, T);
    if (isNull(r.lei_status)) want(eid, r, 'lei_status', g.entity_status, T);
    want(eid, r, 'entity_status', g.entity_status, T);
    want(eid, r, 'lei_registration_status', g.registration_status, T);
    want(eid, r, 'legal_name', g.legal_name, T);
    want(eid, r, 'legal_jurisdiction', g.jurisdiction, T);
    want(eid, r, 'legal_address_country', g.legal_country, T);
    want(eid, r, 'hq_country', g.hq_country, T);
    want(eid, r, 'legal_form_code', g.legal_form_code, T);
    want(eid, r, 'entity_category', g.category, T);
    want(eid, r, 'lei_last_updated', g.last_update, T);
    want(eid, r, 'lei_next_renewal', g.next_renewal, T);
    want(eid, r, 'match_source', MATCH_SOURCE_A, T);
    const l2 = level2(eid, r, lei, 'A-L2:T1xRR-high(L11-16)', 'A-L2:T1xRX-high(L11-16)');
    tallyL2('a', l2);
    const u = plannedUpdates.get(eid);
    u.step = 'A'; u.lei_free = lei; u.guard = { lei: null, name: r.name, normalized_name: r.normalized_name };
    // E-A (E-1, E-2, E-5): direct only; parent resolved by LEI only, after P.
    if (l2.rr.direct) {
      const p = l2.rr.direct;
      const holders = [...(byLei.get(p) || []), ...(pLeis.has(p) ? ['P'] : []), ...(aPlanned.has(p) ? [aPlanned.get(p)] : [])];
      const excl = holders.length > 1 ? 'parent LEI held by more than one row' :
                   holders.length === 1 && side.get(holders[0])?.side === 'new' ? 'parent on the newer side of a KI 22.41 pair' :
                   holders.length === 1 && wrong.has(holders[0]) ? 'parent is a wrong-LEI row (RC-12)' :
                   holders.length === 1 && gov9.has(holders[0]) ? 'parent is a D7-1 government row' : null;
      if (!holders.length) lists.ea_deferred.push({ child_entity_id: eid, child_lei: lei, parent_lei: p, why: 'parent row absent after P (L11-10)' });
      else if (excl) lists.ea_excluded.push({ child_entity_id: eid, child_lei: lei, parent_lei: p, why: excl });
      else eaStmts.push({ kind: 'edge_insert', step: 'EA', key: `EA:${eid}`, child_entity_id: Number(eid), child_lei: lei, parent_lei: p,
        depends_on: [`A:${eid}`, ...(aPlanned.has(p) ? [`A:${aPlanned.get(p)}`] : [])], tiers: ['EA:T1xRR-direct(E-1..E-5)'], est_writes: EDGE_COST });
    }
    const q = queue.get(eid);
    if (q && (q.status === 'pending' || q.status === 'failed')) {
      qStmts.push({ kind: 'q_update', step: 'Q', key: `Q:${eid}`, entity_id: Number(eid), pre_status: q.status, depends_on: [`A:${eid}`], tiers: ['Q:follows-A-high'], est_writes: QUEUE_COST });
    } else lists.queue_not_closable.push({ entity_id: eid, status: q ? q.status : null });
  }

  // ---- Collapse per-entity updates into statements ----------------------
  const updates = { B: [], C: [], CR: [], RC15: [], A: [] };
  for (const [eid, u] of plannedUpdates) {
    if (!Object.keys(u.set).length) continue;
    const row = u.row;
    const set = { ...u.set, ...prov };
    const pre = Object.fromEntries(Object.keys(u.set).map(c => [c, row[c] ?? null]));
    if (u.guard) Object.assign(pre, u.guard);
    const step = u.step || (bRows.has(eid) ? 'B' : (cDirect.has(eid) || cUlt.has(eid)) ? 'C' : crRows.has(eid) ? 'CR' : rc15Hit.has(eid) ? 'RC15' : null);
    if (!step) throw new Error(`entity ${eid}: update with no step`);
    const s = { kind: 'em_update', step, key: `${step}:${eid}`, entity_id: Number(eid), lei: row.lei ?? u.lei_free ?? null, set, pre,
                tiers: [...u.tiers].sort(), est_writes: updateCost(row, u.set) };
    if (u.lei_free) s.lei_free = u.lei_free;
    // §4.2c / L11-15: a B row that live Phase 3 drains between the export and
    // its batch misses its CAS (raced). It is then upgraded by this reviewed
    // follow-up C-reasons CAS on ='NO_LINK_DECLARED' — never clobbered.
    if (step === 'B') {
      const fs = {};
      for (const [ec] of [['direct_parent_exception'], ['ultimate_parent_exception']]) if (!isNull(u.set[ec])) fs[ec] = u.set[ec];
      if (Object.keys(fs).length) {
        s.fallback = { set: { ...fs, ...prov },
          pre: { direct_parent_exception: NLD, direct_parent_lei: null, ultimate_parent_lei: null, ...('ultimate_parent_exception' in fs ? { ultimate_parent_exception: null } : {}) },
          tiers: ['CR:reason-(b)-high(§4.2c fallback)'] };
      }
    }
    updates[step].push(s);
  }

  // Counts in the spec's vocabulary.
  counts.b_rows = updates.B.length; counts.a_rows = updates.A.length; counts.q_rows = qStmts.length;
  counts.c_entities = new Set([...cDirect, ...cUlt]).size; counts.c_direct = cDirect.size; counts.c_ultimate = cUlt.size;
  counts.c_outside_pool = [...new Set([...cDirect, ...cUlt])].filter(e => !bRows.has(e)).length;
  counts.c_outside_direct = [...cDirect].filter(e => !bRows.has(e)).length; counts.c_outside_ultimate = [...cUlt].filter(e => !bRows.has(e)).length;
  counts.p_identity_deferred = pDeferred.size; counts.p_planned_parents = pInserts.length + (counts.p_a_overlap || 0) + pDeferred.size;
  counts.eca_edges = ecaStmts.length; counts.ec_edges_planned = ecStmts.length + ecaStmts.length + (counts.ec_identity_deferred || 0);
  counts.p_rows = pInserts.length; counts.ec_edges = ecStmts.length; counts.ea_edges = eaStmts.length; counts.ea_deferred = lists.ea_deferred.length;
  counts.ea_excluded_e1 = lists.ea_excluded.length; counts.ea_parent_present = eaStmts.length + lists.ea_excluded.length;
  counts.cr_entities = crRows.size; counts.cr_direct = [...crRows.values()].filter(v => v.includes('direct')).length;
  counts.cr_ultimate = [...crRows.values()].filter(v => v.includes('ultimate')).length;
  counts.cr_ultimate_only = [...crRows.values()].filter(v => v.length === 1 && v[0] === 'ultimate').length;
  counts.cr_field_writes = [...crRows.values()].reduce((a, v) => a + v.length, 0);
  counts.cr_with_c = [...crRows.keys()].filter(e => cDirect.has(e) || cUlt.has(e)).length;
  counts.cr_standalone = updates.CR.length;
  counts.rc15_in_cr = [...rc15Hit].filter(e => crRows.has(e)).length;          // Q64 basis: RC-15 ∩ rxset (one of them is also a C row)
  counts.rc15_in_c = [...rc15Hit].filter(e => cDirect.has(e) || cUlt.has(e)).length;
  counts.rc15_standalone = updates.RC15.length;
  counts.twins_013 = lists.handoff_twins.length; counts.no_reason_nld = lists.no_reason_nld.length;
  counts.a_withheld = lists.a_withheld.length; counts.contradicted = lists.contradicted.length;
  counts.parent_collision = lists.parent_collision.length; counts.pool_not_in_006_basis = lists.pool_not_in_006_basis.length;
  counts.handoff_deferred_leis = new Set(lists.handoff_deferred.map(x => x.lei)).size; counts.handoff_deferred_rows = lists.handoff_deferred.length;
  if (lists.contradicted.length) throw new Error(`${lists.contradicted.length} contradicted parent(s): the run stops (§3.3)`);

  // ---- N-2 assertions (§11) ---------------------------------------------
  const all = [...pInserts, ...updates.B, ...updates.C, ...updates.CR, ...updates.RC15, ...ecStmts, ...updates.A, ...ecaStmts, ...eaStmts, ...qStmts];
  for (const s of all) {
    if (!s.tiers?.length) throw new Error(`${s.key}: no tier tag (N-2)`);
    const id = s.entity_id !== undefined ? String(s.entity_id) : s.child_entity_id !== undefined ? String(s.child_entity_id) : null;
    if (id && (wrong.has(id) || gov9.has(id))) throw new Error(`${s.key}: excluded row (wrong-LEI / D7-1) emitted`);
    if (s.kind === 'em_update' && s.step === 'A' && !highTier(id, 'lei', ['d'])) throw new Error(`${s.key}: A row not (d) high`);
    if (s.kind === 'em_update') for (const c of ['normalized_name', 'type']) if (c in s.set) throw new Error(`${s.key}: writes ${c}`);
    if (s.kind === 'em_update' && 'country' in s.set && !isNull(s.pre.country)) throw new Error(`${s.key}: overwrites a non-NULL country`);
    if (s.kind === 'em_update' && 'lei' in s.set && !isNull(E.get(id).lei)) throw new Error(`${s.key}: overwrites an LEI`);
    if (s.kind === 'em_update' && 'name' in s.set && E.get(id).name !== E.get(id).lei) throw new Error(`${s.key}: overwrites a non-placeholder name`);
  }
  // Report-only tiers (never written; listed for MA-OCT-004 / later packets).
  // OQ-12 (spec rev 1.10 §3.5, Data-Identity Lead): definitions on 006 FINAL, field = 'lei'.
  const leiRows = cl.filter(r => r.field === 'lei');
  const toks = r => String(r.evidence_ref).split(';');
  const REVIEW_RE = /GC fuzzy [0-9.]+:|GC exact name -> >|GC fuzzy >=[0-9.]+ -> \d+ LEIs|T2_country_disagrees|DUPLICATE/;
  const ro = {
    T1_LAPSED: leiRows.filter(r => r.category === 'd' && r.confidence === 'medium' && toks(r).includes('T1_LAPSED(D5-4)')),
    T1plus_T1c: leiRows.filter(r => r.category === 'd' && r.confidence === 'medium' && (toks(r).includes('T1+') || toks(r).includes('T1c'))),
    Nplus_duplicates: leiRows.filter(r => r.category === 'c' && r.confidence === 'medium'),
    review_tiers: leiRows.filter(r => r.category === 'a' && r.confidence === 'high' && REVIEW_RE.test(r.evidence_ref))
  };
  for (const [k, rows] of Object.entries(ro)) {
    lists.report_only_tiers[k] = rows.map(r => String(r.entity_id));
    if (rows.some(r => gov9.has(String(r.entity_id)))) throw new Error(`report-only list ${k} contains a D7-1 government row`);
  }
  counts.ro_t1_lapsed = ro.T1_LAPSED.length; counts.ro_t1plus_t1c = ro.T1plus_T1c.length;
  counts.ro_nplus = ro.Nplus_duplicates.length; counts.ro_review = ro.review_tiers.length;
  // Never a write input: none of these rows may carry a planned statement.
  const roIds = new Set(Object.values(lists.report_only_tiers).flat());
  for (const s of all) { const id = String(s.entity_id ?? s.child_entity_id ?? ''); if (id && roIds.has(id) && s.step === 'A') throw new Error(`${s.key}: A write on a report-only tier row`); }

  // ---- Batches (≤ 250 statements; §4.1, §4.4 order) ---------------------
  updates.B.sort((x, y) => (y.lei < x.lei ? -1 : y.lei > x.lei ? 1 : 0));   // L11-15: descending LEI
  for (const k of ['C', 'CR', 'RC15', 'A']) updates[k].sort((x, y) => x.entity_id - y.entity_id);
  const byStep = { P: pInserts, B: updates.B, C: updates.C, CR: updates.CR, RC15: updates.RC15, EC: ecStmts, A: updates.A, ECA: ecaStmts, EA: eaStmts, Q: qStmts };
  const batches = [];
  for (const step of STEP_ORDER) {
    const ss = byStep[step];
    for (let i = 0, n = 1; i < ss.length; i += LIMITS.maxStatementsPerBatch, n++) {
      const statements = ss.slice(i, i + LIMITS.maxStatementsPerBatch);
      const id = `${step}-${String(n).padStart(3, '0')}`;
      batches.push({ id, step, seq: batches.length, statements, n_statements: statements.length,
        est_writes: statements.reduce((a, s) => a + s.est_writes, 0), est_reads: statements.length * 4 + 10,
        a_pilot: step === 'A' && n === 1 });
    }
  }
  const est = Object.fromEntries(STEP_ORDER.map(s => [s, byStep[s].reduce((a, x) => a + x.est_writes, 0)]));
  const heartbeatWrites = batches.length * 2 * LIMITS.eventRowWrites;
  lists.wrong_ids = [...wrong].sort((a, b) => a - b); lists.gov_ids = [...gov9].sort((a, b) => a - b);
  return { counts, lists, batches, est_writes_by_step: est, est_writes_total: Object.values(est).reduce((a, b) => a + b, 0), heartbeat_writes_est: heartbeatWrites };
}

// ── generate ─────────────────────────────────────────────────────────────

async function generate(args) {
  const out = args.out; if (!out) throw new Error('--out <dir> required');
  if (existsSync(out) && readdirSync(out).length) throw new Error(`--out ${out} is not empty (plans are never overwritten)`);
  ensureDir(out);
  const basis = verifyBasis({ skipBig: !!args['skip-db-hash'] });
  const exp = await loadExport(args.export || 'd2');
  const basisRows = {
    cl: csvRows(BASIS.classification.path).map(r => ({ ...r, entity_id: String(r.entity_id) })),
    tiers: csvRows(BASIS.tiers.path), pairs: csvRows(BASIS.pairs.path), wrongRows: csvRows(BASIS.wrong.path),
    d2: csvRows(BASIS.d2_em.path)
  };
  const gc = await openGc(BASIS.gleif_006_db.path);
  const built = await buildPlan({ exp, gc, basisRows });
  gc.close();

  // Lists and hand-off files, each with its SHA in the plan header.
  const files = {};
  const put = (name, obj) => { const p = path.join(out, name); const t = JSON.stringify(obj, null, 1) + '\n'; writeFileSync(p, t, { mode: 0o600 }); files[name] = sha256(t); };
  put('handoff-013.json', { packet: 'MA-OCT-011 → MA-OCT-013', rule: 'S1 (Founder, 3 Oct)', gc_source: GC_SOURCE,
    twins: built.lists.handoff_twins, deferred_leis: built.lists.handoff_deferred,
    counts: { twins: built.lists.handoff_twins.length, deferred_leis: built.counts.handoff_deferred_leis, deferred_rows: built.counts.handoff_deferred_rows } });
  put('review-lists.json', { shared_no_pair: built.lists.review_shared_no_pair, government_d71: built.lists.review_gov, no_reason_nld: built.lists.no_reason_nld,
    ea_deferred: built.lists.ea_deferred, ea_excluded: built.lists.ea_excluded,
    // OQ-12 definitions (spec rev 1.10 §3.5); reconciled: 1,342 / 1,739 / 852 / 2,336. Close-out deliverable only.
    report_only_tiers: Object.fromEntries(Object.entries(built.lists.report_only_tiers).map(([k, v]) => [k, { n: v.length, entity_ids: v }])) });
  put('exceptions.json', { parent_collision: built.lists.parent_collision, a_withheld: built.lists.a_withheld, pool_not_in_006_basis: built.lists.pool_not_in_006_basis,
    not_in_006_tier: built.lists.not_in_006_tier, reason_not_overwritten: built.lists.reason_not_overwritten, gc_missing: built.lists.gc_missing,
    queue_not_closable: built.lists.queue_not_closable, edge_skipped: built.lists.edge_skipped, contradicted: built.lists.contradicted,
    p_deferred_identity: built.lists.p_deferred_identity, wrong_ids: built.lists.wrong_ids, gov_ids: built.lists.gov_ids });

  const plan = {
    plan_version: 1, packet: 'MA-OCT-011',
    // Rev 1.10 is cited because STATUS_BOARD.md shows it APPROVED (Founder, 15 Oct) at generation time (MA-OCT-011.FRI item 5).
    spec: ['claude/MA-OCT-011_Spec.md rev 1.9 e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22 (copy claude/packets/MA-OCT-011_Spec_rev1.9.md)',
           'claude/MA-OCT-011_Spec.md rev 1.10 6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa (APPROVED 15 Oct; governing)'],
    generated_at: new Date().toISOString(), generator: 'App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs',
    releasable: exp.releasable, export: { kind: exp.kind, shas: exp.shas, missing_columns: exp.missing_columns },
    basis, gc_source: GC_SOURCE, run_ts_placeholder: RUN_TS, counts: built.counts,
    est_writes_by_step: built.est_writes_by_step, est_writes_total: built.est_writes_total, heartbeat_writes_est: built.heartbeat_writes_est,
    files, batches: built.batches
  };
  const text = stableStringify(plan) + '\n';
  const planSha = sha256(text);                                   // = `shasum -a 256 plan.json`
  writeFileSync(path.join(out, 'plan.json'), text, { mode: 0o600 });
  writeFileSync(path.join(out, 'plan.sha256'), `${planSha}  plan.json\n`, { mode: 0o600 });

  console.log(JSON.stringify({ plan: path.join(out, 'plan.json'), plan_sha256: planSha, releasable: exp.releasable, batches: built.batches.length,
    est_writes_total: built.est_writes_total, heartbeat_writes_est: built.heartbeat_writes_est, est_writes_by_step: built.est_writes_by_step, counts: built.counts, files }, null, 1));

  if (args['expect-006-final']) {
    const diffs = Object.entries(EXPECT_006_FINAL).filter(([k, v]) => built.counts[k] !== v).map(([k, v]) => `${k}: got ${built.counts[k]}, spec ${v}`);
    if (diffs.length) { console.error('EXPECT-006-FINAL MISMATCH:\n  ' + diffs.join('\n  ')); process.exitCode = 3; }
    else console.log(`EXPECT-006-FINAL: all ${Object.keys(EXPECT_006_FINAL).length} spec figures reproduced`);
  }
}

// ── export (X1 / X2 keyset; read-only D1) ────────────────────────────────

async function exportKeyset(args) {
  const out = args.out; if (!out) throw new Error('--out <dir> required');
  if (existsSync(out) && readdirSync(out).length) throw new Error(`--out ${out} is not empty`);
  ensureDir(out);
  let maxReads = Number(args['max-reads'] || 80000);
  // R9-1: once the ceiling record exists (after Friday's export), an export may use only the remaining headroom.
  if (!(typeof args.transport === 'string' && args.transport.startsWith('local:'))) {
    const core = await import('../lib/gleif-reconcile-011-core.mjs');
    const tot = core.readTotals(core.workPaths(args.work), new Date());
    if (tot.cfg) maxReads = Math.min(maxReads, tot.ceiling - tot.cumulative, tot.day_max - tot.today);
    if (maxReads <= 0) throw new Error(`R9-1: no read headroom left (cumulative ${tot.cumulative} / ceiling ${tot.ceiling})`);
  }
  const page = 5000;
  // --transport local:<db> exports a local replica in the same format (dry run / post-run checks).
  const t = args.transport;
  const d1 = t && typeof t === 'object' ? t
    : typeof t === 'string' && t.startsWith('local:') ? await (await import('../lib/gleif-reconcile-011-core.mjs')).localTransport(t.slice(6), { readOnly: true })
    : wranglerTransport({ cwd: CORP_DIR, config: path.join(CORP_DIR, 'wrangler-entities-enrich.toml'), readOnly: true,
        // R9-1: export reads go into the work-folder D1 ledger, which the runner's cumulative read ceiling sums.
        ledger: e => { const L = workPaths(args.work).ledger; ensureDir(path.dirname(L)); appendFileSync(L, JSON.stringify(e) + '\n'); } });
  let reads = 0;
  const specs = [
    { k: 'em', file: 'entity_master.jsonl', sql: last => `SELECT ${EM_COLS.join(', ')} FROM entity_master WHERE entity_id > ${lit(last)} ORDER BY entity_id LIMIT ${page}`, key: 'entity_id' },
    { k: 'queue', file: 'queue.jsonl', sql: last => `SELECT entity_id, name, status, retry_after, last_attempt FROM entity_enrichment_queue WHERE entity_id > ${lit(last)} ORDER BY entity_id LIMIT ${page}`, key: 'entity_id' },
    { k: 'rel', file: 'relationships.jsonl', sql: last => `SELECT rowid, parent_entity_id, child_entity_id, relationship_type, source FROM entity_relationships WHERE rowid > ${lit(last)} ORDER BY rowid LIMIT ${page}`, key: 'rowid' }
  ];
  const files = {}, pages = [];
  for (const s of specs) {
    let last = 0, lines = [];
    for (;;) {
      const [r] = await d1.exec([s.sql(last)], { label: `X-${s.k}` });
      const rr = r.meta.rows_read || 0; reads += rr;
      pages.push({ table: s.k, last, rows: r.results.length, rows_read: rr, rows_written: r.meta.rows_written || 0 });
      if (rr > LIMITS.maxReadsPerExecution) throw new Error(`export page read ${rr} > ${LIMITS.maxReadsPerExecution}: abort`);
      if (reads > maxReads) throw new Error(`export read budget ${maxReads} exceeded (${reads}): abort`);
      if (!r.results.length) break;
      for (const x of r.results) lines.push(JSON.stringify(x));
      last = r.results[r.results.length - 1][s.key];
      if (r.results.length < page) break;
    }
    const text = lines.join('\n') + '\n';
    writeFileSync(path.join(out, s.file), text, { mode: 0o600 });
    files[s.k] = { file: s.file, rows: lines.length, sha256: sha256(text) };
  }
  const man = { exported_at: new Date().toISOString(), db: 'meridian-etf', reads, files, pages };
  writeJsonAtomic(path.join(out, 'manifest.json'), man);
  console.log(JSON.stringify({ out, reads, files }, null, 1));
  return man;
}

// ── CLI ──────────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) { const k = x.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) a[k] = true; else { a[k] = nx; i++; } }
    else a._.push(x);
  }
  return a;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const run = cmd === 'generate' ? generate : cmd === 'export' ? exportKeyset : null;
  if (!run) { console.error('usage: gleif-reconcile-011-plan.mjs generate --export <dir|d2> --out <dir> [--expect-006-final] | export --out <dir> [--max-reads N]'); process.exit(2); }
  run(args).catch(e => { console.error('PLAN ERROR:', e.message); process.exit(1); });
}

export { verifyBasis, loadExport, openGc, csvRows, exportKeyset };
