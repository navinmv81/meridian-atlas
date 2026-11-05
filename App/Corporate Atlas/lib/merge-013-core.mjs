// merge-013-core.mjs — MA-OCT-013 KI 22.41 duplicate-entity merge (spec rev 1
// e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098), pure functions.
// Used by scripts/merge-013.mjs (runner) and tests/merge-013.test.mjs. Entities domain only.
//
// Contents:
//   constants, caps and the index precondition list (§8, §9)
//   table allow-list for every rendered statement (§6.4; ETF MF-2)
//   identity guard I-1 (§5.2) and the seed's normalizeName loader (§5.3)
//   plan builder with the plan-time assertions (M-6 disjointness, N-2, R guard, Filings hold, do_not_merge)
//   statement renderer: step-1 token with predicate P, steps 2–6 gated on T, (iii) LEI step 7 (§6.2)
//   restore renderer in the Arch M-1 order (§11), read-back classes (§6.2)
//   calendar (§9 bands, 21:58–22:02, 23:15 / 23:30), budget gate, remainder file (§9)

import { homedir } from 'node:os';
import path from 'node:path';
import { headroomDecision, LIMITS, lit, sha256, stableStringify } from './gleif-reconcile-011-core.mjs';

// ── Constants ────────────────────────────────────────────────────────────

export const PACKET = 'MA-OCT-013';
export const JOB_ID = 'manual.entity-merge-013';
export const EMITTER = 'merge-013';
export const DEFAULT_WORK_DIR = path.join(homedir(), 'MeridianAtlas-work', 'merge-013');
export const PAUSE_FLAG_NAME = '.merge-013-paused';
export const STOP_FLAG_NAME = '.merge-013-stop';
export const OWN_FREEZE_PREFIX = '013 run';
export const BOOST_JOB_ID = 'local.entities-enrich-boost';
export const BOOST_EVENING_FROM = '17:45';                  // the boost's 17:50 UTC fire (GMT bands)
export const EXPECTED_MAX_DURATION_S = 900;                 // Ops M-1: per batch
export const RUN_DATE = '2026-11-05';                       // ML-1104-2: the only day with the 33k / 70k caps

export const BATCH_SIZE = 50;
export const LIMITS_013 = Object.freeze({
  runDay: { own: 33000, account: 70000 },                   // Thu 5 only (ML-1104-2 / ML-1029-4)
  otherDay: { own: 25000, account: 60000 },                 // any other day unless the Founder re-approves
  writeOverrunFactor: 1.3,
  racedPct: 0.005,                                          // stop: raced above 0.5% of a batch
  rMax: 5000, rTolerance: 0.2, repointWritesMax: 10000,     // L11-13 runtime second guard
  noStartFrom: '23:15', noWriteFrom: '23:30',               // ML-1104-2
  ownSweepSlot: ['21:58', '22:02']                          // Ops N-1, Arch N-5
});

// §8 counting basis (006): writes per row, indexes included.
export const COST = Object.freeze({
  dupDelete: 10,        // 1 + 9 entity_master indexes (phase3 skipped: lei IS NULL)
  queueDelete: 2,       // 1 + idx_enrich_queue_status
  survivorKey: 3,       // 1 + idx_entity_master_normalized + the UNIQUE autoindex
  redirect: 1,          // rowid table, no index
  iemRepoint: 2,        // 1 + idx_iem_entity_key
  cikFill: 1,           // cik is unindexed
  lei: 7,               // as 011 A incl. Level 2 (≈ 6.3, rounded up)
  heartbeatsPerBatch: 12 // 2 events × ≈ 6 row-writes
});
export const mergeCost = m => COST.dupDelete + COST.queueDelete + COST.survivorKey + COST.redirect + COST.iemRepoint * m.iem_keys.length + (m.cik_fill ? COST.cikFill : 0);

// §9: hard stop before any write if any of these is missing (name AND column list).
export const REQUIRED_INDEXES = Object.freeze([
  ['idx_iem_entity_key', 'instrument_entity_map', ['entity_id', 'instrument_key']],
  ['idx_bil_entity', 'bond_issuer_link', ['entity_id']],
  ['idx_entity_isin_map_entity', 'entity_isin_map', ['entity_id']],
  ['idx_exposure_entity', 'entity_exposure_monthly', ['entity_id', 'report_month']],
  ['idx_exposure_holder', 'entity_exposure_monthly', ['holder_entity_id', 'report_month']],
  ['idx_entity_rel_child', 'entity_relationships', ['child_entity_id']],
  ['idx_entity_rel_parent', 'entity_relationships', ['parent_entity_id']],
  ['idx_mqp_entity_id', 'managerissuerpositionquarterly', ['entity_id']],
  ['idx_ies_entity_id', 'issuereventstream', ['entity_id']],
  ['idx_ips_entity_id', 'issuerperiodsummary', ['entity_id']],
  ['idx_financialfact_cik_tag', 'financialfact_reported', ['cik', 'xbrl_tag']],
  ['idx_entity_master_lei', 'entity_master', ['lei']],
  ['idx_entity_master_normalized', 'entity_master', ['normalized_name']]
].map(([name, table, cols]) => Object.freeze({ name, table, cols })));

export const INDEX_QUERY = `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name IN (${REQUIRED_INDEXES.map(i => lit(i.name)).join(', ')})`;

// rows: sqlite_master rows { name, tbl_name, sql }. Returns the list of missing / mismatched indexes.
export function indexPrecondition(rows) {
  const byName = new Map((rows || []).map(r => [r.name, r]));
  const bad = [];
  for (const ix of REQUIRED_INDEXES) {
    const r = byName.get(ix.name);
    if (!r) { bad.push(`${ix.name}: missing`); continue; }
    const m = /\bON\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([^)]*)\)/i.exec(r.sql || '');
    const cols = m ? m[2].split(',').map(c => c.trim().replace(/"/g, '').split(/\s+/)[0]) : [];
    if (r.tbl_name !== ix.table || !m || m[1] !== ix.table || cols.join(',') !== ix.cols.join(',')) bad.push(`${ix.name}: expected ${ix.table}(${ix.cols.join(', ')}), found ${r.sql}`);
  }
  return bad;
}

// ── Table allow-list (§6.4, ETF MF-2): refused at plan and at execute ─────

export const WRITE_TABLES = new Set(['entity_merge_redirect', 'entity_master', 'entity_enrichment_queue', 'instrument_entity_map']);
export const GUARD_TABLES = new Set(['entity_relationships', 'entity_isin_map', 'entity_exposure_monthly', 'bond_issuer_link', 'fund_entity_link',
  'managerissuerpositionquarterly', 'issuereventstream', 'issuerperiodsummary', 'financialfact_reported']);
// Read-only extras outside any merge statement: catalog, the global hold, Ops reads (do_not_merge §5.5, boost pause / end event T-16, R-4 recon).
export const READ_EXTRA_TABLES = new Set(['sqlite_master', 'holdings_pipeline_state', 'ops_data_quality_ticket', 'ops_job_pause', 'ops_job_run']);

export class AllowListError extends Error { constructor(m) { super(m); this.name = 'AllowListError'; } }

const stripLiterals = sql => sql.replace(/'(?:[^']|'')*'/g, "''");
// Returns { target, tables } or throws AllowListError (exec_refused).
export function checkStatement(sql) {
  const bare = stripLiterals(sql);
  const tables = [...bare.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)].map(m => m[1]);
  const w = /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|REPLACE\s+INTO)\s+"?([A-Za-z_][A-Za-z0-9_]*)/i.exec(bare);
  const target = w ? w[1] : null;
  if (/^\s*(ALTER|DROP|PRAGMA|ATTACH|REPLACE)\b/i.test(bare)) throw new AllowListError(`exec_refused: ${bare.trim().split(/\s+/)[0]} is never sent by 013`);
  if (target && /^\s*CREATE/i.test(bare) && target !== 'entity_merge_redirect') throw new AllowListError(`exec_refused: CREATE ${target} (only entity_merge_redirect)`);
  if (target && !WRITE_TABLES.has(target)) throw new AllowListError(`exec_refused: write target ${target} is not one of ${[...WRITE_TABLES].join(', ')}`);
  for (const t of tables) {
    if (!WRITE_TABLES.has(t) && !GUARD_TABLES.has(t) && !READ_EXTRA_TABLES.has(t)) throw new AllowListError(`exec_refused: table ${t} is outside the 013 allow-list`);
  }
  return { target, tables };
}

// ── Identity guard I-1 (§5.2; port of spec1/identity_guard.py 9ce6b4a0…) ──

const CANON = [['PUBLIC LIMITED COMPANY', 'PLC'], ['P L C', 'PLC'], ['LIMITED', 'LTD'], ['CORPORATION', 'CORP'], ['INCORPORATED', 'INC'],
  ['COMPANY', 'CO'], ['S A', 'SA'], ['N V', 'NV'], ['B V', 'BV'], ['S P A', 'SPA'], ['L L C', 'LLC'], ['L P', 'LP']];
const FORMS = new Set(['PLC', 'LTD', 'CORP', 'INC', 'CO', 'SA', 'NV', 'BV', 'SE', 'AG', 'SPA', 'AB', 'ASA', 'OYJ', 'LLC', 'LP', 'PTE', 'GMBH']);
function toks(s) {
  let t = String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/\./g, '').replace(/'/g, '');
  t = t.replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
  for (const [a, b] of CANON) t = t.replace(new RegExp(`\\b${a}\\b`, 'g'), b);
  return t.split(' ').filter(Boolean);
}
export const i1Stem = s => toks(s).filter(t => !FORMS.has(t)).join(' ');
export const i1Form = s => [...new Set(toks(s).filter(t => FORMS.has(t)))].sort().join(',');
// null = mergeable; otherwise the reason it goes to the review list.
export function i1Verdict(survName, survCountry, dupName, dupCountry) {
  if (i1Stem(survName) !== i1Stem(dupName)) return 'stem_differs';
  const fs = i1Form(survName), fd = i1Form(dupName);
  if (fs === fd) return null;
  if ((!fd || !fs) && (!survCountry || !dupCountry || survCountry === dupCountry)) return null;
  return 'form_class_differs';
}
// §5.2 tables. Rejects are never merged by 013; sign-eligible need a Data-Identity signature file.
export const I1_REJECTS = Object.freeze([[110851, 111491], [110460, 95732], [111751, 96097]]);
export const I1_SIGN_ELIGIBLE = Object.freeze([[26150, 230822], [27008, 226582], [27067, 227046], [27580, 223774], [29350, 229248], [107305, 92126]]);
export const PROTECTED_IDS = Object.freeze([103540]);
const pairKey = (s, d) => `${Number(s)}:${Number(d)}`;

// Signature file: { signed_by, signed_at, pairs: [{ surv, dup }] }. Refused if it names a reject or a pair outside the 6.
export function parseSignatures(sig) {
  if (!sig) return new Set();
  if (!sig.signed_by || !sig.signed_at || !Array.isArray(sig.pairs)) throw new Error('I-1 signature file: signed_by, signed_at and pairs[] are required');
  const eligible = new Set(I1_SIGN_ELIGIBLE.map(([s, d]) => pairKey(s, d)));
  const rejects = new Set(I1_REJECTS.map(([s, d]) => pairKey(s, d)));
  const out = new Set();
  for (const p of sig.pairs) {
    const k = pairKey(p.surv, p.dup);
    if (rejects.has(k)) throw new Error(`I-1 signature file names reject pair ${k} (never merged by 013)`);
    if (!eligible.has(k)) throw new Error(`I-1 signature file names ${k}, which is not one of the 6 sign-eligible pairs`);
    out.add(k);
  }
  return out;
}

// §5.3: the live seed's normalizeName, read from entities-seed.js source text (no import of a Worker module).
export function loadSeedNormalizeName(srcText) {
  const m = srcText.match(/export function normalizeName\(name\)\s*\{[\s\S]*?\n\}/);
  if (!m) throw new Error('normalizeName not found in entities-seed.js');
  return new Function(m[0].replace('export function normalizeName', 'return function normalizeName'))();
}

// ── Plan builder (§5, §6, §9) ────────────────────────────────────────────

export class PlanRefused extends Error { constructor(m, detail) { super(m); this.name = 'PlanRefused'; this.detail = detail; } }

// input:
//   measured     plan-rev1.json { run_default[], sign_eligible[], held{} }  (the measured set; candidates ⊆ it)
//   three        core.json three[] (holders for the M-6 "holder is a candidate" check)
//   em           Map entity_id → entity_master row (plan-time export, incl. cik)
//   iem          Map dup → [instrument_key, …] (instrument_entity_map rows on the duplicate)
//   queue        Map dup → queue status
//   filingsRefs  Set of dup ids with any row in the 4 Filings/13F tables (§5.4)
//   doNotMerge   Set of ids in any do_not_merge pair (§5.5 item 2)
//   redirects    Set of existing entity_merge_redirect.duplicate_id
//   signatures   Set 'surv:dup' from parseSignatures
//   normalizeName  the live seed function
//   rExpected    measured R for this set (62 on Thu 5) or null to skip the ±20% check
//   lei          (iii) items [{ lei, dup, payload }] from the 011 hand-off
export function buildPlan(input) {
  const { measured, three = [], em, iem, queue, filingsRefs = new Set(), doNotMerge = new Set(), redirects = new Set(),
          signatures = new Set(), normalizeName, rExpected = null, lei = [], batchSize = BATCH_SIZE } = input;
  if (typeof normalizeName !== 'function') throw new Error('buildPlan: normalizeName required');
  const rejectKeys = new Set(I1_REJECTS.map(([s, d]) => pairKey(s, d)));
  const eligibleKeys = new Set(I1_SIGN_ELIGIBLE.map(([s, d]) => pairKey(s, d)));
  const protectedIds = new Set(PROTECTED_IDS);
  const held = { do_not_merge: [], protected: [], i1_reject: [], i1_unsigned: [], i1_review_new: [], state_changed: [], n2_mismatch: [], filings_13f_referenced: [], no_queue_row: [] };
  const cands = [...measured.run_default.map(x => ({ ...x, src: 'default' })),
                 ...measured.sign_eligible.map(x => ({ ...x, src: 'sign_eligible' }))];
  // cik holders across the whole export (entity_master.cik has no index; §5.5 item 1).
  const cikHolders = new Map();
  for (const r of em.values()) if (r.cik) { if (!cikHolders.has(r.cik)) cikHolders.set(r.cik, []); cikHolders.get(r.cik).push(Number(r.entity_id)); }
  const merges = [];
  for (const c of cands) {
    const k = pairKey(c.surv, c.dup);
    const rec = { surv: c.surv, dup: c.dup };
    if (c.shape !== 'two') throw new PlanRefused(`candidate ${k} is not a two-way pair (three-way / OTP are held to November, §5.3)`);
    if (rejectKeys.has(k)) throw new PlanRefused(`I-1 reject pair ${k} is in the candidate set`);
    if (protectedIds.has(c.dup) || protectedIds.has(c.surv)) { held.protected.push(rec); continue; }
    if (doNotMerge.has(c.dup) || doNotMerge.has(c.surv)) { held.do_not_merge.push(rec); continue; }
    if (c.src === 'sign_eligible' && !signatures.has(k)) { held.i1_unsigned.push(rec); continue; }
    const d = em.get(c.dup), s = em.get(c.surv);
    if (!d || !s || d.lei !== null && d.lei !== undefined || d.type !== s.type || d.normalized_name === s.normalized_name) {
      held.state_changed.push({ ...rec, why: !d ? 'dup absent' : !s ? 'survivor absent' : (d.lei ? 'dup has an LEI' : d.type !== s.type ? 'type differs' : 'keys already equal') }); continue;
    }
    if (c.src === 'default' && !eligibleKeys.has(k)) {
      const v = i1Verdict(s.name, s.country, d.name, d.country);
      if (v) { held.i1_review_new.push({ ...rec, why: v, surv_name: s.name, dup_name: d.name }); continue; }
    }
    if (normalizeName(d.name) !== d.normalized_name || normalizeName(s.name) !== d.normalized_name) {
      held.n2_mismatch.push({ ...rec, nn_dup: normalizeName(d.name), nn_surv: normalizeName(s.name), dup_key: d.normalized_name }); continue;
    }
    if (filingsRefs.has(c.dup)) { held.filings_13f_referenced.push(rec); continue; }
    if (!queue.has(c.dup)) { held.no_queue_row.push(rec); continue; }
    const others = (d.cik ? cikHolders.get(d.cik) || [] : []).filter(id => id !== Number(c.dup));
    const cik_fill = !!d.cik && !s.cik && others.length === 0;
    merges.push({
      dup: Number(c.dup), surv: Number(c.surv), type: d.type, src: c.src,
      dup_name: d.name, dup_key: d.normalized_name, dup_cik: d.cik ?? null, dup_upd: d.updated_at ?? null,
      surv_key: s.normalized_name, surv_lei: s.lei ?? null, surv_cik: s.cik ?? null, surv_upd: s.updated_at ?? null,
      iem_keys: [...(iem.get(c.dup) || [])].sort(), q_status: queue.get(c.dup), cik_fill
    });
  }
  assertDisjoint(merges, redirects, three);
  // L11-13 runtime second guard on R (instrument_entity_map repoints).
  const R = merges.reduce((a, m) => a + m.iem_keys.length, 0);
  if (R > LIMITS_013.rMax) throw new PlanRefused(`R ${R} > ${LIMITS_013.rMax}`);
  if (R * COST.iemRepoint > LIMITS_013.repointWritesMax) throw new PlanRefused(`repoint writes ${R * COST.iemRepoint} > ${LIMITS_013.repointWritesMax}`);
  if (rExpected !== null && Math.abs(R - rExpected) > LIMITS_013.rTolerance * rExpected) throw new PlanRefused(`R ${R} differs from the measured ${rExpected} by more than 20%`);
  // (iii) LEIs: only for survivors whose merge is in this plan.
  const byDup = new Map(merges.map(m => [m.dup, m]));
  const leiItems = [];
  for (const it of lei) {
    const m = byDup.get(Number(it.dup));
    if (!m) continue;
    leiItems.push({ lei: it.lei, surv: m.surv, dup: m.dup, post_key: m.dup_key, set: leiSetColumns(it.payload) });
  }
  const batches = [];
  for (let i = 0; i < merges.length; i += batchSize) {
    const ms = merges.slice(i, i + batchSize);
    batches.push({ id: `B${String(batches.length + 1).padStart(2, '0')}`, pilot: batches.length === 0, merges: ms,
                   declared_writes: ms.reduce((a, m) => a + mergeCost(m), 0) + COST.heartbeatsPerBatch });
  }
  const totals = {
    merges: merges.length, batches: batches.length, R, cik_fills: merges.filter(m => m.cik_fill).length, lei: leiItems.length,
    declared_writes: batches.reduce((a, b) => a + b.declared_writes, 0) + leiItems.length * COST.lei,
    held: Object.fromEntries(Object.entries(held).map(([k, v]) => [k, v.length]))
  };
  return { packet: PACKET, job_id: JOB_ID, batches, lei: leiItems, held, totals };
}

// M-6 disjointness (§5.1): refuses the plan when false. Every redirect is then single-hop.
export function assertDisjoint(merges, redirects = new Set(), three = []) {
  const dupIds = new Set(merges.map(m => m.dup)), survIds = new Set(merges.map(m => m.surv));
  const viol = [];
  if (dupIds.size !== merges.length) viol.push('a duplicate appears twice');
  for (const s of survIds) if (dupIds.has(s)) viol.push(`${s} is both survivor and duplicate`);
  for (const s of survIds) if (redirects.has(s)) viol.push(`survivor ${s} is an existing redirect duplicate`);
  for (const d of dupIds) if (redirects.has(d)) viol.push(`duplicate ${d} already has a redirect row`);
  for (const t of three) if (dupIds.has(Number(t.holder)) || survIds.has(Number(t.holder))) viol.push(`three-way holder ${t.holder} is a candidate`);
  if (viol.length) throw new PlanRefused(`M-6 disjointness: ${viol.length} violation(s)`, viol);
}

// 011 hand-off payload → entity_master SET columns (as 011 step A, incl. Level 2 and provenance; §6.2 step 7).
const LEI_COLS = ['lei', 'lei_status', 'entity_status', 'lei_registration_status', 'legal_name', 'legal_jurisdiction', 'legal_address_country', 'hq_country',
  'legal_form_code', 'entity_category', 'lei_last_updated', 'lei_next_renewal', 'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception',
  'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception', 'lei_validation_source', 'match_source', 'gleif_enrichment_version', 'gleif_last_updated'];
export const RUN_TOKEN = '@TOKEN';
export function leiSetColumns(payload) {
  const p = { ...(payload.level1 || {}), ...(payload.level2 || {}) };
  const prov = payload.provenance || {};
  const set = {};
  for (const c of LEI_COLS.slice(0, 18)) set[c] = p[c] ?? null;
  set.lei_validation_source = prov.lei_validation_source ?? null;
  set.match_source = prov.match_source ?? 'gc_name_t1';
  set.gleif_enrichment_version = 11;
  set.gleif_last_updated = RUN_TOKEN;
  if (!set.lei) throw new Error('(iii) payload without lei');
  return set;
}

export function canonicalPlan(plan) { const text = stableStringify(plan) + '\n'; return { text, sha: sha256(text) }; }

// ── Statement renderer (§6.2) ────────────────────────────────────────────

const T = (m, tok) => `EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id = ${lit(m.dup)} AND merged_at = ${lit(tok)})`;
// The nine reference probes (step 1 and the step-4 delete guard), each on its index.
export const NINE = dup => [
  `NOT EXISTS (SELECT 1 FROM entity_relationships WHERE child_entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM entity_relationships WHERE parent_entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM entity_isin_map WHERE entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM entity_exposure_monthly WHERE entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM entity_exposure_monthly WHERE holder_entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM bond_issuer_link WHERE entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM managerissuerpositionquarterly WHERE entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM issuereventstream WHERE entity_id = ${lit(dup)})`,
  `NOT EXISTS (SELECT 1 FROM issuerperiodsummary WHERE entity_id = ${lit(dup)})`
];

// One merge → its ordered statements. Step 1 is the only place a merge can miss; every later statement needs T.
export function renderMerge(m, tok) {
  if (!tok || !/^\d{4}-\d{2}-\d{2}T/.test(tok)) throw new Error('renderMerge: token must be an ISO timestamp');
  const P = [
    `EXISTS (SELECT 1 FROM entity_master WHERE entity_id = ${lit(m.dup)} AND lei IS NULL AND type = ${lit(m.type)} AND name = ${lit(m.dup_name)} AND normalized_name = ${lit(m.dup_key)} AND cik IS ${lit(m.dup_cik)} AND updated_at IS ${lit(m.dup_upd)})`,
    `EXISTS (SELECT 1 FROM entity_master WHERE entity_id = ${lit(m.surv)} AND type = ${lit(m.type)} AND normalized_name = ${lit(m.surv_key)} AND lei IS ${lit(m.surv_lei)} AND cik IS ${lit(m.surv_cik)} AND updated_at IS ${lit(m.surv_upd)})`,
    `(SELECT COUNT(*) FROM instrument_entity_map WHERE entity_id = ${lit(m.dup)}) = ${lit(m.iem_keys.length)}`,
    ...(m.iem_keys.length ? [`(SELECT COUNT(*) FROM instrument_entity_map WHERE entity_id = ${lit(m.dup)} AND instrument_key IN (${m.iem_keys.map(lit).join(', ')})) = ${lit(m.iem_keys.length)}`] : []),
    `EXISTS (SELECT 1 FROM entity_enrichment_queue WHERE entity_id = ${lit(m.dup)} AND status = ${lit(m.q_status)})`,
    ...NINE(m.dup),
    `NOT EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id IN (${lit(m.dup)}, ${lit(m.surv)}))`,
    `NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = ${lit(m.dup_key)} AND type = ${lit(m.type)} AND entity_id NOT IN (${lit(m.dup)}))`
  ];
  const t = T(m, tok);
  const out = [
    { step: 1, sql: `INSERT INTO entity_merge_redirect (duplicate_id, survivor_id, merged_at, packet) SELECT ${lit(m.dup)}, ${lit(m.surv)}, ${lit(tok)}, ${lit(PACKET)} WHERE ${P.join(' AND ')}` },
    ...m.iem_keys.map(k => ({ step: 2, sql: `UPDATE instrument_entity_map SET entity_id = ${lit(m.surv)} WHERE instrument_key = ${lit(k)} AND entity_id = ${lit(m.dup)} AND ${t}` })),
    { step: 3, sql: `DELETE FROM entity_enrichment_queue WHERE entity_id = ${lit(m.dup)} AND status = ${lit(m.q_status)} AND ${t}` },
    { step: 4, sql: `DELETE FROM entity_master WHERE entity_id = ${lit(m.dup)} AND lei IS NULL AND normalized_name = ${lit(m.dup_key)} AND ${t} ` +
                    `AND NOT EXISTS (SELECT 1 FROM instrument_entity_map WHERE entity_id = ${lit(m.dup)}) AND NOT EXISTS (SELECT 1 FROM entity_enrichment_queue WHERE entity_id = ${lit(m.dup)}) AND ${NINE(m.dup).join(' AND ')}` },
    { step: 5, sql: `UPDATE entity_master SET normalized_name = ${lit(m.dup_key)} WHERE entity_id = ${lit(m.surv)} AND normalized_name = ${lit(m.surv_key)} AND ${t} ` +
                    `AND NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = ${lit(m.dup_key)} AND type = ${lit(m.type)})` }
  ];
  if (m.cik_fill) out.push({ step: 6, sql: `UPDATE entity_master SET cik = ${lit(m.dup_cik)} WHERE entity_id = ${lit(m.surv)} AND cik IS NULL AND ${t}` });
  for (const s of out) checkStatement(s.sql);
  return out;
}

// Step 7: one (iii) LEI onto its survivor (W1-A: no other row holds it; lei IS NULL CAS; post-merge key).
export function renderLei(item, tok) {
  const set = Object.fromEntries(Object.entries(item.set).map(([k, v]) => [k, v === RUN_TOKEN ? tok : v]));
  const sql = `UPDATE entity_master SET ${Object.entries(set).map(([k, v]) => `${k} = ${lit(v)}`).join(', ')} WHERE entity_id = ${lit(item.surv)} AND lei IS NULL ` +
    `AND normalized_name = ${lit(item.post_key)} AND EXISTS (SELECT 1 FROM entity_merge_redirect WHERE survivor_id = ${lit(item.surv)} AND packet = ${lit(PACKET)}) ` +
    `AND NOT EXISTS (SELECT 1 FROM entity_master WHERE lei = ${lit(set.lei)})`;
  checkStatement(sql);
  return sql;
}

// ── Restore renderer (§11, Arch M-1 / B13-4 order) ───────────────────────
//
// pre: { dup_row, surv_row, queue_row, iem_rows[] } as pre-imaged before the batch (every column).
// lei: the (iii) item applied to this survivor, or null. Each statement needs the merge's redirect row.

export function renderRestore(m, pre, tok, lei = null) {
  if (!pre?.dup_row || !pre?.queue_row) throw new Error(`restore ${m.dup}: pre-image incomplete`);
  const t = T(m, tok);
  // B-1 should-fix: the re-inserts are no-ops when the row is already back (a partially applied merge or restore),
  // so a restore never aborts on a PK conflict and is safe to repeat.
  const ins = (table, row) => { const cols = Object.keys(row); return `INSERT INTO ${table} (${cols.join(', ')}) SELECT ${cols.map(c => lit(row[c])).join(', ')} WHERE ${t} AND NOT EXISTS (SELECT 1 FROM ${table} WHERE entity_id = ${lit(m.dup)})`; };
  const out = [
    { step: 'R1-key', sql: `UPDATE entity_master SET normalized_name = ${lit(m.surv_key)} WHERE entity_id = ${lit(m.surv)} AND normalized_name = ${lit(m.dup_key)} AND ${t}` },
    { step: 'R2-reinsert', sql: ins('entity_master', pre.dup_row) },
    { step: 'R3-queue', sql: ins('entity_enrichment_queue', pre.queue_row) },
    ...(pre.iem_rows || []).map(r => ({ step: 'R3-iem', sql: `UPDATE instrument_entity_map SET entity_id = ${lit(m.dup)} WHERE instrument_key = ${lit(r.instrument_key)} AND entity_id = ${lit(m.surv)} AND ${t}` })),
    ...(m.cik_fill ? [{ step: 'R3-cik', sql: `UPDATE entity_master SET cik = NULL WHERE entity_id = ${lit(m.surv)} AND cik = ${lit(m.dup_cik)} AND ${t}` }] : [])
  ];
  if (lei) {
    const back = Object.keys(lei.set).map(c => `${c} = ${lit(pre.surv_row[c])}`).join(', ');
    out.push({ step: 'R4-lei', sql: `UPDATE entity_master SET ${back} WHERE entity_id = ${lit(m.surv)} AND lei = ${lit(lei.set.lei)} AND ${t}` });
  }
  out.push({ step: 'R5-redirect', sql: `DELETE FROM entity_merge_redirect WHERE duplicate_id = ${lit(m.dup)} AND packet = ${lit(PACKET)} AND merged_at = ${lit(tok)}` });
  for (const s of out) checkStatement(s.sql);
  return out;
}

// ── Read-back (§6.2) ─────────────────────────────────────────────────────
// state: { redirect: row|null, dup_row: row|null, surv_row: row|null }
// → 'merged' | 'raced' | 'breach:<why>'
export function classifyReadback(m, tok, st) {
  const red = st.redirect && Number(st.redirect.survivor_id) === m.surv && st.redirect.merged_at === tok && st.redirect.packet === PACKET;
  if (red && !st.dup_row && st.surv_row && st.surv_row.normalized_name === m.dup_key) return 'merged';
  if (!st.redirect && st.dup_row && st.surv_row && st.surv_row.normalized_name === m.surv_key) return 'raced';
  if (st.redirect && st.dup_row) return 'breach:redirect with a live duplicate';
  if (!st.redirect && !st.dup_row) return 'breach:duplicate gone without a redirect';
  return 'breach:unexpected state';
}

// ── Calendar (§9) ────────────────────────────────────────────────────────

const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inWin = (min, a, b) => { const x = hm(a), y = hm(b); return x <= y ? (min >= x && min < y) : (min >= x || min < y); };

// Batch-start check. freezes: loaded FREEZES.json (recurring[], dated[]). The dated '013 run …' window
// freezes the OTHER Entities writers and is skipped for 013 itself.
export function calendar013(now, freezes) {
  const dow = DOW[now.getUTCDay()], min = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (dow === 'Sun') return { ok: false, reason: 'calendar: no batches on Sunday' };
  if (dow === 'Mon' && min < hm('08:00')) return { ok: false, reason: 'calendar: Monday before 08:00 UTC' };
  if (min >= hm(LIMITS_013.noStartFrom) || min < hm('00:10')) return { ok: false, reason: `calendar: no batch starts at or after ${LIMITS_013.noStartFrom} UTC (ML-1104-2)` };
  if (inWin(min, ...LIMITS_013.ownSweepSlot)) return { ok: false, reason: `calendar: own sweep slot ${LIMITS_013.ownSweepSlot.join('–')} UTC` };
  if (!freezes || !Array.isArray(freezes.recurring) || !Array.isArray(freezes.dated)) return { ok: false, reason: 'freezes: FREEZES.json not loaded (fail closed)' };
  for (const f of freezes.recurring) {
    const days = f.days || [];
    if ((days.includes('*') || days.includes(dow)) && inWin(min, f.start, f.end)) return { ok: false, reason: `freeze: ${f.name} ${f.start}–${f.end} UTC` };
  }
  for (const f of freezes.dated) {
    if (String(f.name).startsWith(OWN_FREEZE_PREFIX)) continue;
    const s = Date.parse(f.start), e = Date.parse(f.end);
    if (Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e) return { ok: false, reason: `freeze: ${f.name} ${f.start}→${f.end}` };
  }
  return { ok: true };
}
export const writeAllowed = now => (now.getUTCHours() * 60 + now.getUTCMinutes()) < hm(LIMITS_013.noWriteFrom);

// ── Budget (§9): 33k / 70k on Thu 5, else 25k / 60k ──────────────────────

export const capsFor = now => (now.toISOString().slice(0, 10) === RUN_DATE ? LIMITS_013.runDay : LIMITS_013.otherDay);

// The 011 headroom rules (fresh ≤ 120 s, today's date, F-1 own unpolled rows, F-2 monotonic), with 013's caps.
export function budgetDecision({ reading, fetchError, now, state, batchWrites, own }) {
  const caps = capsFor(now);
  const d = headroomDecision({ reading, fetchError, now, state, batchWrites, own, limits: { ...LIMITS, accountCeiling: caps.account, ownDailyCap: caps.own } });
  if (!d.ok && d.outcome === 'budget_limit' && d.detail?.reason === '011 daily cap') d.detail.reason = `013 daily cap ${caps.own}`;
  if (!d.ok && d.outcome === 'budget_limit' && d.detail?.reason === 'account ceiling') d.detail.reason = `account ceiling ${caps.account}`;
  return { ...d, caps };
}

// ── Remainder (§9, ML-1104-2) ────────────────────────────────────────────
export function remainderOf(plan, planSha, nextIndex, reason, now) {
  const rest = plan.batches.slice(nextIndex);
  const body = {
    packet: PACKET, plan_sha256: planSha, reason, utc: now.toISOString(),
    next_eligible: 'next eligible weekday ≥ 08:05Z under a new Control (never Sunday; Monday only after 08:00); fresh plan-time re-check; caps 25k / 60k unless re-approved',
    batches: rest.map(b => ({ id: b.id, merges: b.merges.map(m => ({ dup: m.dup, surv: m.surv })) })),
    merges: rest.reduce((a, b) => a + b.merges.length, 0)
  };
  const text = stableStringify(body) + '\n';
  return { body, text, sha: sha256(text) };
}
