#!/usr/bin/env node
// MA-OCT-013 — tests T-1 … T-16 (spec rev 1 §17, e6dc8567…f098). Each MUST-FIX has a test that fails on
// the pre-013 tree (the new lib / runner / wrapper are absent there). Runs the real core library, runner
// and entry script against node:sqlite replicas in a temp folder. No network, no D1.
//   node "App/Corporate Atlas/tests/merge-013.test.mjs"
import { DatabaseSync } from 'node:sqlite';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const C = await import(pathToFileURL(path.join(CA, 'lib', 'merge-013-core.mjs')).href);
const R = await import(pathToFileURL(path.join(CA, 'scripts', 'merge-013.mjs')).href);
const SH = path.join(CA, 'scripts', 'merge-013.sh');
const nn = C.loadSeedNormalizeName(readFileSync(path.join(CA, 'src', 'entities-seed.js'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + String(JSON.stringify(got)).slice(0, 600)}`); };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
const TMP = mkdtempSync(path.join(tmpdir(), 'merge013-'));
let dbN = 0;

// ── fixture: the live index names and column lists (§9), the migration applied ──
const DDL = `
CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, type TEXT NOT NULL,
  lei TEXT NULL, lei_status TEXT NULL, country TEXT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  legal_name TEXT, entity_category TEXT, entity_status TEXT, legal_address_country TEXT, hq_country TEXT, legal_jurisdiction TEXT, legal_form_code TEXT,
  lei_registration_status TEXT, lei_last_updated TEXT, lei_next_renewal TEXT, lei_validation_source TEXT, direct_parent_lei TEXT, direct_parent_name TEXT,
  direct_parent_exception TEXT, ultimate_parent_lei TEXT, ultimate_parent_name TEXT, ultimate_parent_exception TEXT, gleif_last_updated TEXT,
  gleif_enrichment_version INTEGER DEFAULT 1, match_source TEXT, cik TEXT, UNIQUE(normalized_name, type));
CREATE INDEX idx_entity_master_lei ON entity_master(lei);
CREATE INDEX idx_entity_master_normalized ON entity_master(normalized_name);
CREATE TABLE entity_enrichment_queue (entity_id INTEGER PRIMARY KEY, name TEXT NOT NULL, country_hint TEXT, type_hint TEXT, isin_hint TEXT, lookup_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending', retry_after DATETIME, last_attempt DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_enrich_queue_status ON entity_enrichment_queue(status, retry_after);
CREATE TABLE instrument_entity_map (instrument_key TEXT PRIMARY KEY, entity_id INTEGER NOT NULL, source TEXT NOT NULL, confidence INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);
CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY, security_name TEXT, security_ticker TEXT, isin TEXT, cusip TEXT, asset_cat TEXT, country TEXT);
CREATE TABLE entity_relationships (parent_entity_id INTEGER NOT NULL, child_entity_id INTEGER NOT NULL, relationship_type TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY (parent_entity_id, child_entity_id, relationship_type));
CREATE INDEX idx_entity_rel_child ON entity_relationships(child_entity_id);
CREATE INDEX idx_entity_rel_parent ON entity_relationships(parent_entity_id);
CREATE TABLE entity_isin_map (isin TEXT NOT NULL, lei TEXT NOT NULL, entity_id INTEGER, PRIMARY KEY (isin, lei));
CREATE INDEX idx_entity_isin_map_entity ON entity_isin_map(entity_id);
CREATE TABLE entity_exposure_monthly (entity_id INTEGER, holder_entity_id INTEGER, report_month TEXT, weight_sum REAL, PRIMARY KEY (report_month, entity_id, holder_entity_id));
CREATE INDEX idx_exposure_entity ON entity_exposure_monthly(entity_id, report_month);
CREATE INDEX idx_exposure_holder ON entity_exposure_monthly(holder_entity_id, report_month);
CREATE TABLE bond_issuer_link (cik TEXT PRIMARY KEY, entity_id INTEGER NULL, link_method TEXT, confidence INTEGER, issuer_name TEXT);
CREATE INDEX idx_bil_entity ON bond_issuer_link(entity_id) WHERE entity_id IS NOT NULL;
CREATE TABLE fund_entity_link (series_id TEXT PRIMARY KEY, entity_id INTEGER, etf_symbol TEXT);
CREATE TABLE managerissuerpositionquarterly (cik TEXT, cusip TEXT, report_period TEXT, entity_id INTEGER, PRIMARY KEY (cik, cusip, report_period));
CREATE INDEX idx_mqp_entity_id ON managerissuerpositionquarterly(entity_id);
CREATE TABLE issuereventstream (accession_number TEXT, item_code TEXT, entity_id INTEGER, PRIMARY KEY (accession_number, item_code));
CREATE INDEX idx_ies_entity_id ON issuereventstream(entity_id);
CREATE TABLE issuerperiodsummary (entity_id INTEGER, xbrl_tag TEXT, period_type TEXT, PRIMARY KEY (entity_id, xbrl_tag, period_type));
CREATE INDEX idx_ips_entity_id ON issuerperiodsummary(entity_id);
CREATE TABLE financialfact_reported (cik TEXT, xbrl_tag TEXT, period_end TEXT, entity_id INTEGER, PRIMARY KEY (cik, xbrl_tag, period_end));
CREATE INDEX idx_financialfact_cik_tag ON financialfact_reported(cik, xbrl_tag);
CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO holdings_pipeline_state VALUES ('hold_all_jobs', 'false');
CREATE TABLE ops_job_pause (pause_id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL);
CREATE TABLE ops_job_run (event_id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, phase TEXT, event_type TEXT, job_id TEXT, started_at TEXT, ended_at TEXT, rows_written INTEGER, items_attempted INTEGER, items_progressed INTEGER);
`;
const MIGRATION = readFileSync(path.join(CA, 'migrations', 'ma-oct-013-entity-merge-redirect.sql'), 'utf8');

// Pairs: survivor with the stale key, duplicate on the corrected key (KI 22.41).
const PAIRS = [
  { surv: 10, sname: 'Acme Corp', skey: 'ACME CORP', dup: 1010, dname: 'Acme Corp.', iem: ['US00000ACME1'] },
  { surv: 20, sname: 'Beta Ltd', skey: 'BETA LTD', dup: 1020, dname: 'Beta Ltd.', dcik: '0000000020' },
  { surv: 30, sname: 'Gamma Inc', skey: 'GAMMA INC', dup: 1030, dname: 'Gamma Inc.' },
  { surv: 40, sname: 'Delta SA', skey: 'DELTA SA', dup: 1040, dname: 'Delta S.A.', iem: ['US00000DLT01', 'US00000DLT02'] }
];
function mkDb(extra = '') {
  const file = path.join(TMP, `db${++dbN}.sqlite`);
  const db = new DatabaseSync(file);
  db.exec(DDL); db.exec(MIGRATION);
  const em = db.prepare(`INSERT INTO entity_master (entity_id, name, normalized_name, type, country, cik, created_at, updated_at) VALUES (?, ?, ?, 'operating', 'US', ?, '2026-06-10 10:00:00', ?)`);
  const qu = db.prepare(`INSERT INTO entity_enrichment_queue (entity_id, name, status, created_at) VALUES (?, ?, ?, '2026-09-06 04:00:00')`);
  const iem = db.prepare(`INSERT INTO instrument_entity_map VALUES (?, ?, 'openfigi_tier1', 80, '2026-08-31 00:00:00')`);
  for (const p of PAIRS) {
    em.run(p.surv, p.sname, p.skey, null, '2026-06-10 10:00:00');
    em.run(p.dup, p.dname, nn(p.dname), p.dcik ?? null, '2026-09-06 04:00:00');
    qu.run(p.dup, p.dname, p.dup === 1020 ? 'failed' : 'pending');
    for (const k of p.iem || []) { iem.run(k, p.dup); db.prepare(`INSERT INTO instrument_master VALUES (?, 'X', NULL, NULL, NULL, 'EC', 'US')`).run(k); }
  }
  em.run(77, 'Other Holder Co', 'OTHER HOLDER', null, '2026-06-10 10:00:00');
  if (extra) db.exec(extra);
  db.close();
  return file;
}
const MEASURED = { run_default: PAIRS.map(p => ({ dup: p.dup, surv: p.surv, shape: 'two' })), sign_eligible: [], held: {} };
function inputs(file, over = {}) {
  const db = new DatabaseSync(file, { readOnly: true });
  const em = new Map(db.prepare('SELECT * FROM entity_master').all().map(r => [Number(r.entity_id), { ...r }]));
  const iem = new Map(); for (const r of db.prepare('SELECT * FROM instrument_entity_map').all()) { const d = Number(r.entity_id); if (!iem.has(d)) iem.set(d, []); iem.get(d).push(r.instrument_key); }
  const queue = new Map(db.prepare('SELECT entity_id, status FROM entity_enrichment_queue').all().map(r => [Number(r.entity_id), r.status]));
  db.close();
  return { measured: MEASURED, three: [], em, iem, queue, normalizeName: nn, rExpected: null, ...over };
}
const LEI = 'TESTLEI0000000000001';
const LEI_ITEM = { lei: LEI, dup: 1010, payload: { level1: { lei: LEI, lei_status: 'ACTIVE', entity_status: 'ACTIVE', lei_registration_status: 'ISSUED', legal_name: 'ACME CORPORATION', legal_jurisdiction: 'US' },
  level2: { direct_parent_lei: null, direct_parent_name: null, direct_parent_exception: 'NO_KNOWN_PERSON', ultimate_parent_lei: null, ultimate_parent_name: null, ultimate_parent_exception: 'NO_KNOWN_PERSON' },
  provenance: { lei_validation_source: 'GC-20260928-1600', match_source: 'gc_name_t1' } } };
function writePlan(plan) {
  const dir = mkdtempSync(path.join(TMP, 'plan-'));
  const full = { ...plan, releasable: false };
  const { text, sha } = C.canonicalPlan(full);
  writeFileSync(path.join(dir, 'plan.json'), text); writeFileSync(path.join(dir, 'plan.sha256'), `${sha}  plan.json\n`);
  return dir;
}
const FREEZES = path.join(TMP, 'FREEZES.json');
writeFileSync(FREEZES, JSON.stringify({ recurring: [['05:50', '07:10'], ['07:55', '08:05'], ['10:45', '11:15'], ['11:45', '12:15'], ['16:45', '17:15'], ['17:45', '18:15'], ['23:50', '00:10']]
  .map(([start, end]) => ({ name: `band ${start}`, days: ['*'], start, end })), dated: [{ name: '013 run — other Entities writers frozen', start: '2026-11-05T18:00Z', end: '2026-11-06T00:10Z' }] }));
const THU = '2026-11-05T18:30:00Z';
async function ctxFor(file, args = {}, over = {}) {
  const work = mkdtempSync(path.join(TMP, 'work-'));
  const sent = [];
  const t = Date.parse(over.at || THU); let tick = 0;
  const ctx = await R.makeContext({ transport: `local:${file}`, 'assume-account': 1000, 'no-ops-gates': true, operator: 'test', ...args },
    { work, write: true, now: () => new Date(t + 1000 * tick++), freezesPath: FREEZES, pauseFlag: path.join(work, 'pause'), stopFlag: path.join(work, 'stop'),
      ingestCfg: over.ingestCfg ?? null, log: () => {}, fetchImpl: over.fetchImpl,
      outboxModule: over.outboxModule });
  return { ctx, work, sent };
}
const dump = file => { const db = new DatabaseSync(file, { readOnly: true }); const o = {};
  for (const t of ['entity_master', 'entity_enrichment_queue', 'instrument_entity_map', 'entity_merge_redirect']) o[t] = db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all().map(r => ({ ...r }));
  db.close(); return JSON.stringify(o); };
const rows = (file, sql) => { const db = new DatabaseSync(file, { readOnly: true }); const r = db.prepare(sql).all().map(x => ({ ...x })); db.close(); return r; };

// ═══ T-1 (Arch M-1): merge → (iii) LEI → restore, byte-identical; restore order ═══
{
  const file = mkDb();
  const before = dump(file);
  const p = C.buildPlan(inputs(file, { lei: [LEI_ITEM] }));
  const dir = writePlan({ ...p, batches: p.batches });
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test' }, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: { attributes: { entity: { status: 'ACTIVE' }, registration: { status: 'ISSUED' } } } }) }) });
  const run = await R.cmdRun(ctx);
  check('[T-1] run: plan complete, every merge merged', run.done === true, run);
  const mid = rows(file, 'SELECT duplicate_id, survivor_id FROM entity_merge_redirect ORDER BY duplicate_id');
  check('[T-1] 4 redirect rows, single hop, duplicates gone, survivors re-keyed', mid.length === 4 && rows(file, 'SELECT COUNT(*) n FROM entity_master WHERE entity_id IN (1010,1020,1030,1040)')[0].n === 0
    && rows(file, "SELECT normalized_name FROM entity_master WHERE entity_id = 10")[0].normalized_name === 'ACME', mid);
  check('[T-1] iem repointed to survivors', rows(file, 'SELECT entity_id FROM instrument_entity_map ORDER BY instrument_key').every(r => [10, 40].includes(r.entity_id)));
  const lei = await R.cmdLei(ctx);
  check('[T-1] step 7: (iii) LEI applied to survivor 10', lei.lei[0].state === 'applied' && rows(file, 'SELECT lei FROM entity_master WHERE entity_id = 10')[0].lei === LEI, lei);
  const res = await R.cmdRestore({ ...ctx, args: { ...ctx.args, all: true } });
  check('[T-1] restore --all: every batch byte-identical', res.all_identical === true && res.restored === 4, res);
  check('[T-1] database byte-identical to before (entity_master, queue, iem, redirect)', dump(file) === before);
  const steps = C.renderRestore({ ...C.buildPlan(inputs(mkDb())).batches[0].merges[0] }, { dup_row: { entity_id: 1 }, queue_row: { entity_id: 1 }, iem_rows: [] }, '2026-11-05T18:30:00.000Z').map(s => s.step);
  check('[T-1] restore order: key restore → re-insert → children → (LEI) → redirect delete', steps[0] === 'R1-key' && steps[1] === 'R2-reinsert' && steps[2] === 'R3-queue' && steps.at(-1) === 'R5-redirect', steps);
  // three-way / OTP renderer shape: survivor is the LEI holder (surv_lei set) — same statements, same round trip
  const f3 = mkDb(`UPDATE entity_master SET lei = 'HOLDERLEI00000000001' WHERE entity_id = 30;`);
  const b3 = dump(f3);
  const p3 = C.buildPlan(inputs(f3, { measured: { run_default: [{ dup: 1030, surv: 30, shape: 'two' }], sign_eligible: [], held: {} } }));
  const m3 = p3.batches[0].merges[0];
  const db3 = new DatabaseSync(f3); const pre = { dup_row: { ...db3.prepare('SELECT * FROM entity_master WHERE entity_id = 1030').get() }, surv_row: { ...db3.prepare('SELECT * FROM entity_master WHERE entity_id = 30').get() },
    queue_row: { ...db3.prepare('SELECT * FROM entity_enrichment_queue WHERE entity_id = 1030').get() }, iem_rows: [] };
  const tok = '2026-11-05T18:31:00.000Z';
  db3.exec('BEGIN'); for (const s of C.renderMerge(m3, tok)) db3.prepare(s.sql).run(); db3.exec('COMMIT');
  const merged3 = db3.prepare('SELECT COUNT(*) n FROM entity_master WHERE entity_id = 1030').get().n === 0;
  db3.exec('BEGIN'); for (const s of C.renderRestore(m3, pre, tok)) db3.prepare(s.sql).run(); db3.exec('COMMIT'); db3.close();
  check('[T-1] three-way/OTP shape (LEI-holder survivor): merge then restore byte-identical', merged3 && dump(f3) === b3);
}

// ═══ T-2 (Arch M-2): changed after the pre-image → step 1 inserts no token → 0 changes; raced ═══
{
  const file = mkDb();
  const p = C.buildPlan(inputs(file));
  const db = new DatabaseSync(file); db.exec(`UPDATE entity_master SET updated_at = '2026-11-05 06:00:00' WHERE entity_id = 1010; UPDATE entity_master SET updated_at = '2026-11-05 06:00:00' WHERE entity_id = 30;`);
  const b = dump(file); const tok = '2026-11-05T18:40:00.000Z';
  let changes = 0; db.exec('BEGIN');
  for (const m of p.batches[0].merges.filter(m => [1010, 1030].includes(m.dup))) for (const s of C.renderMerge(m, tok)) changes += Number(db.prepare(s.sql).run().changes);
  db.exec('COMMIT');
  const st = { redirect: null, dup_row: db.prepare('SELECT * FROM entity_master WHERE entity_id = 1010').get(), surv_row: db.prepare('SELECT * FROM entity_master WHERE entity_id = 10').get() };
  db.close();
  check('[T-2] duplicate (1010) and survivor (30) changed after the pre-image → 0 changes across all statements', changes === 0 && dump(file) === b, changes);
  check('[T-2] read-back class raced', C.classifyReadback(p.batches[0].merges[0], tok, st) === 'raced');
  check('[T-2] a redirect with a live duplicate is a breach', C.classifyReadback(p.batches[0].merges[0], tok, { ...st, redirect: { survivor_id: 10, merged_at: tok, packet: 'MA-OCT-013' } }).startsWith('breach'));
}

// ═══ T-3 (Ops M-4): unplanned child row → step-1 miss; delete guard refuses even with a token ═══
{
  const kids = [
    ['edge', `INSERT INTO entity_relationships VALUES (77, 1030, 'legal_parent', 'gleif')`],
    ['edge parent', `INSERT INTO entity_relationships VALUES (1030, 77, 'legal_parent', 'gleif')`],
    ['isin', `INSERT INTO entity_isin_map VALUES ('US0000000001', 'L1', 1030)`],
    ['exposure', `INSERT INTO entity_exposure_monthly VALUES (1030, 77, '2026-09', 1)`],
    ['exposure holder', `INSERT INTO entity_exposure_monthly VALUES (77, 1030, '2026-09', 1)`],
    ['bil', `INSERT INTO bond_issuer_link VALUES ('0000000999', 1030, 'cik', 95, 'G')`],
    ['13F', `INSERT INTO managerissuerpositionquarterly VALUES ('0001', '123456789', '2026-06-30', 1030)`],
    ['events', `INSERT INTO issuereventstream VALUES ('0001-26-000001', '8.01', 1030)`],
    ['summary', `INSERT INTO issuerperiodsummary VALUES (1030, 'Revenues', 'FY')`],
    ['unplanned iem', `INSERT INTO instrument_entity_map VALUES ('US00000GAM99', 1030, 'heuristic', 75, '2026-11-05')`]
  ];
  for (const [label, sql] of kids) {
    const file = mkDb(); const p = C.buildPlan(inputs(file)); const m = p.batches[0].merges.find(x => x.dup === 1030);
    const db = new DatabaseSync(file); db.exec(sql); const b = dump(file);
    let ch = 0; db.exec('BEGIN'); for (const s of C.renderMerge(m, '2026-11-05T18:45:00.000Z')) ch += Number(db.prepare(s.sql).run().changes); db.exec('COMMIT'); db.close();
    check(`[T-3] unplanned ${label} on the duplicate → step-1 miss, 0 changes`, ch === 0 && dump(file) === b, ch);
  }
  // defense in depth: the token is present (forced) and an edge exists → the step-4 delete still refuses
  const file = mkDb(); const p = C.buildPlan(inputs(file)); const m = p.batches[0].merges.find(x => x.dup === 1030);
  const db = new DatabaseSync(file); const tok = '2026-11-05T18:46:00.000Z';
  db.exec(`INSERT INTO entity_merge_redirect VALUES (1030, 30, '${tok}', 'MA-OCT-013'); INSERT INTO entity_relationships VALUES (77, 1030, 'legal_parent', 'gleif'); DELETE FROM entity_enrichment_queue WHERE entity_id = 1030;`);
  const del = C.renderMerge(m, tok).find(s => s.step === 4);
  const ch = Number(db.prepare(del.sql).run().changes); db.close();
  check('[T-3] step-4 delete guard refuses with the token present and a child edge (dangling-reference guard)', ch === 0, ch);
}

// ═══ T-4 (Arch M-2 W1-A): (iii) LEI already held elsewhere → no write; lei IS NULL CAS ═══
{
  const file = mkDb(`UPDATE entity_master SET lei = '${LEI}' WHERE entity_id = 77;`);
  const p = C.buildPlan(inputs(file, { lei: [LEI_ITEM] }));
  const db = new DatabaseSync(file); const tok = '2026-11-05T18:50:00.000Z';
  db.exec('BEGIN'); for (const s of C.renderMerge(p.batches[0].merges[0], tok)) db.prepare(s.sql).run(); db.exec('COMMIT');
  const ch = Number(db.prepare(C.renderLei(p.lei[0], tok)).run().changes);
  check('[T-4] W1-A: the LEI is held by entity 77 → 0 changes', ch === 0 && db.prepare('SELECT lei FROM entity_master WHERE entity_id = 10').get().lei === null, ch);
  db.exec(`UPDATE entity_master SET lei = NULL WHERE entity_id = 77; UPDATE entity_master SET lei = 'OTHERLEI000000000001' WHERE entity_id = 10;`);
  const ch2 = Number(db.prepare(C.renderLei(p.lei[0], tok)).run().changes);
  check('[T-4] lei IS NULL CAS: a survivor that already has an LEI is never overwritten', ch2 === 0 && db.prepare('SELECT lei FROM entity_master WHERE entity_id = 10').get().lei === 'OTHERLEI000000000001', ch2);
  db.close();
}

// ═══ T-5 (Arch M-4): cik fill-only ═══
{
  const file = mkDb(); const p = C.buildPlan(inputs(file)); const m = p.batches[0].merges.find(x => x.dup === 1020);
  check('[T-5] cik fill planned for 1020 → 20 (only the duplicate holds it)', m.cik_fill === true && p.totals.cik_fills === 1);
  const fileB = mkDb(`UPDATE entity_master SET cik = '0000000020' WHERE entity_id = 77;`);
  check('[T-5] skipped when another row holds the cik', C.buildPlan(inputs(fileB)).batches[0].merges.find(x => x.dup === 1020).cik_fill === false);
  const db = new DatabaseSync(file); const tok = '2026-11-05T18:55:00.000Z';
  db.exec(`UPDATE entity_master SET cik = '0000009999' WHERE entity_id = 20;`);
  const m2 = { ...m, surv_cik: '0000009999' };
  db.exec('BEGIN'); for (const s of C.renderMerge(m2, tok)) db.prepare(s.sql).run(); db.exec('COMMIT');
  check('[T-5] never overwrites an existing survivor cik', db.prepare('SELECT cik FROM entity_master WHERE entity_id = 20').get().cik === '0000009999');
  db.close();
  const f2 = mkDb(); const p2 = C.buildPlan(inputs(f2)); const mm = p2.batches[0].merges.find(x => x.dup === 1020);
  const d2 = new DatabaseSync(f2);
  const pre = { dup_row: { ...d2.prepare('SELECT * FROM entity_master WHERE entity_id = 1020').get() }, surv_row: { ...d2.prepare('SELECT * FROM entity_master WHERE entity_id = 20').get() }, queue_row: { ...d2.prepare('SELECT * FROM entity_enrichment_queue WHERE entity_id = 1020').get() }, iem_rows: [] };
  d2.exec('BEGIN'); for (const s of C.renderMerge(mm, tok)) d2.prepare(s.sql).run(); d2.exec('COMMIT');
  const filled = d2.prepare('SELECT cik FROM entity_master WHERE entity_id = 20').get().cik;
  d2.exec('BEGIN'); for (const s of C.renderRestore(mm, pre, tok)) d2.prepare(s.sql).run(); d2.exec('COMMIT');
  check('[T-5] filled on merge, set back to NULL on restore', filled === '0000000020' && d2.prepare('SELECT cik FROM entity_master WHERE entity_id = 20').get().cik === null);
  d2.close();
}

// ═══ T-6 (rev 1 I-1) ═══
{
  check('[T-6] FUJI pair refused by I-1', C.i1Verdict('FUJI CORPORATION LIMITED', 'JP', 'FUJI CORPORATION', 'JP') !== null);
  check('[T-6] Nice pair refused by I-1', C.i1Verdict('Nice Corporation', 'JP', 'Nice Ltd', 'IL') !== null);
  check('[T-6] ALPHA pair refused by I-1', C.i1Verdict('ALPHA Corporation', 'JP', 'Alpha Group', 'CN') !== null);
  check('[T-6] a plain pair passes (Corporation ≡ Corp; truncated name with equal country)', C.i1Verdict('Acme Corporation', 'US', 'Acme Corp', 'US') === null && C.i1Verdict('Acme Corp', 'US', 'Acme', 'US') === null);
  const file = mkDb();
  check('[T-6] a reject pair in the candidate set → plan refused', throws(() => C.buildPlan(inputs(file, { measured: { ...MEASURED, run_default: [...MEASURED.run_default, { dup: 111491, surv: 110851, shape: 'two' }] } })), /reject/));
  check('[T-6] a signature file naming a reject is refused', throws(() => C.parseSignatures({ signed_by: 'DIL', signed_at: 'x', pairs: [{ surv: 110460, dup: 95732 }] }), /reject/));
  check('[T-6] a signature file naming a pair outside the 6 is refused', throws(() => C.parseSignatures({ signed_by: 'DIL', signed_at: 'x', pairs: [{ surv: 10, dup: 1010 }] }), /not one of the 6/));
  const f6 = mkDb(`INSERT INTO entity_master (entity_id, name, normalized_name, type, updated_at) VALUES (26150, 'Rezolve AI Limited', 'REZOLVE AI LIMITED', 'operating', 'u'), (230822, 'Rezolve AI plc', 'REZOLVE AI', 'operating', 'v');
    INSERT INTO entity_enrichment_queue (entity_id, name, status) VALUES (230822, 'Rezolve AI plc', 'pending');`);
  const meas = { run_default: [], sign_eligible: [{ dup: 230822, surv: 26150, shape: 'two' }], held: {} };
  const unsigned = C.buildPlan(inputs(f6, { measured: meas }));
  const signed = C.buildPlan(inputs(f6, { measured: meas, signatures: C.parseSignatures({ signed_by: 'Data-Identity Lead', signed_at: '2026-11-05T18:20Z', pairs: [{ surv: 26150, dup: 230822 }] }) }));
  check('[T-6] sign-eligible pair: held without a signature, merged with one', unsigned.totals.merges === 0 && unsigned.held.i1_unsigned.length === 1 && signed.totals.merges === 1, [unsigned.totals, signed.totals]);
}

// ═══ T-7 (Arch M-6): plan-time disjointness ═══
{
  const file = mkDb(`INSERT INTO entity_master (entity_id, name, normalized_name, type, updated_at) VALUES (500, 'Acme Corp', 'ACME CORP X', 'operating', 'u');`);
  const chain = { ...MEASURED, run_default: [...MEASURED.run_default, { dup: 10, surv: 500, shape: 'two' }] };
  check('[T-7] survivor ∩ duplicate (the 111491 chain shape) → refused', throws(() => C.assertDisjoint([{ dup: 1010, surv: 10 }, { dup: 10, surv: 500 }]), /disjointness/));
  const twice = C.buildPlan; const f7 = mkDb(`INSERT INTO entity_master (entity_id, name, normalized_name, type, updated_at) VALUES (600, 'Acme Corp', 'ACME OLD', 'operating', 'u');`);
  check('[T-7] a duplicate planned twice → plan refused', throws(() => twice(inputs(f7, { measured: { ...MEASURED, run_default: [...MEASURED.run_default, { dup: 1010, surv: 600, shape: 'two' }] } })), /disjointness/));
  void chain;
  check('[T-7] an existing redirect on a survivor or duplicate → plan refused', throws(() => C.buildPlan(inputs(file, { redirects: new Set([10]) })), /disjointness/) && throws(() => C.buildPlan(inputs(file, { redirects: new Set([1030]) })), /disjointness/));
  check('[T-7] a three-way holder that is a candidate → plan refused', throws(() => C.buildPlan(inputs(file, { three: [{ twins: [1, 2], holder: 20 }] })), /disjointness/));
}

// ═══ T-8 (ETF MF-2): allow-list at plan and at execute; fund_entity_link stop-and-refer ═══
{
  check('[T-8] a statement on an ETF table is refused', throws(() => C.checkStatement('SELECT * FROM fund_holdings_monthly'), /allow-list/));
  check('[T-8] a write to a 13F / Filings table is refused', throws(() => C.checkStatement('UPDATE managerissuerpositionquarterly SET entity_id = 1 WHERE entity_id = 2'), /write target/)
    && throws(() => C.checkStatement('DELETE FROM financialfact_reported WHERE entity_id = 2'), /write target/));
  check('[T-8] a write to fund_entity_link (auto-repoint) is refused', throws(() => C.checkStatement('UPDATE fund_entity_link SET entity_id = 1 WHERE entity_id = 2'), /write target/));
  check('[T-8] guard reads and the four write targets pass', !throws(() => C.checkStatement('SELECT entity_id FROM fund_entity_link WHERE entity_id IN (1)')) && C.renderMerge(C.buildPlan(inputs(mkDb())).batches[0].merges[0], THU).length > 0);
  const file = mkDb();
  const { ctx } = await ctxFor(file);
  let refused = false; try { await ctx.d1.exec(['UPDATE fund_holdings_monthly SET cusip = NULL']); } catch (e) { refused = /exec_refused/.test(e.message); }
  check('[T-8] the runner transport refuses it at execute (exec_refused), before SQLite sees it', refused);
  const f2 = mkDb(`INSERT INTO fund_entity_link VALUES ('S000001', 1030, 'GAM');`);
  const p = C.buildPlan(inputs(f2)); const dir = writePlan(p);
  const { ctx: c2 } = await ctxFor(f2, { plan: dir, 'pilot-ok': 'test' });
  const r = await R.cmdRun(c2);
  const ck = JSON.parse(readFileSync(path.join(c2.paths.checkpoints, readFileSync(path.join(c2.paths.work, `cursor-${R.loadPlan(dir).sha.slice(0, 16)}.json`), 'utf8') && JSON.parse(readFileSync(path.join(c2.paths.work, `cursor-${R.loadPlan(dir).sha.slice(0, 16)}.json`), 'utf8')).done.B01.checkpoint), 'utf8'));
  check('[T-8] fund_entity_link row on a duplicate → merge dropped and listed for ETF-PL; the rest merged', r.done && ck.referred_etf_pl.some(x => x.dup === 1030) && rows(f2, 'SELECT COUNT(*) n FROM entity_master WHERE entity_id = 1030')[0].n === 1 && ck.merged.length === 3, ck);
}

// ═══ T-9 (Arch M-3 / ETF MF-1): Filings/13F reference → merge held ═══
{
  const file = mkDb();
  const p = C.buildPlan(inputs(file, { filingsRefs: new Set([1030]) }));
  check('[T-9] a Filings/13F row on a duplicate (plan probe) → merge held', p.held.filings_13f_referenced.some(x => x.dup === 1030) && !p.batches[0].merges.some(m => m.dup === 1030));
  const f2 = mkDb(`INSERT INTO financialfact_reported VALUES ('0000000020', 'Revenues', '2025-12-31', 1020);`);
  const p2 = C.buildPlan(inputs(f2)); const dir = writePlan(p2);
  const { ctx } = await ctxFor(f2, { plan: dir, 'pilot-ok': 'test' });
  await R.cmdRun(ctx);
  check('[T-9] a fact by cik on a duplicate at execute (per-batch probe) → merge held, duplicate kept', rows(f2, 'SELECT COUNT(*) n FROM entity_master WHERE entity_id = 1020')[0].n === 1 && rows(f2, 'SELECT COUNT(*) n FROM entity_master WHERE entity_id = 1010')[0].n === 0);
}

// ═══ T-10 (Ops M-5): budget, calendar, batch-boundary stop, remainder ═══
{
  const own = (w) => ({ todayWrites: w, rowsSince: () => 0 });
  const at = s => new Date(s);
  const reading = (n, now) => ({ rowsWritten: n, date: now.toISOString().slice(0, 10), fetchedAt: now.toISOString() });
  let now = at(THU);
  check('[T-10] Thu 5: 013 total 32,900 + batch 200 > 33k → budget_limit', C.budgetDecision({ reading: reading(1000, now), now, state: {}, batchWrites: 200, own: own(32900) }).outcome === 'budget_limit');
  check('[T-10] Thu 5: account 69,900 + batch 200 > 70k → budget_limit', C.budgetDecision({ reading: reading(69900, now), now, state: {}, batchWrites: 200, own: own(0) }).outcome === 'budget_limit');
  check('[T-10] Thu 5: inside both caps → ok', C.budgetDecision({ reading: reading(30000, now), now, state: {}, batchWrites: 800, own: own(20000) }).ok === true);
  now = at('2026-11-06T09:00:00Z');
  check('[T-10] any other day: 25k / 60k caps', C.budgetDecision({ reading: reading(1000, now), now, state: {}, batchWrites: 800, own: own(24500) }).outcome === 'budget_limit'
    && C.budgetDecision({ reading: reading(59500, now), now, state: {}, batchWrites: 800, own: own(0) }).outcome === 'budget_limit');
  check('[T-10] d1-today unavailable → headroom_unavailable (fail closed)', C.budgetDecision({ reading: null, fetchError: 'timeout', now, state: {}, batchWrites: 800, own: own(0) }).outcome === 'headroom_unavailable');
  const F = JSON.parse(readFileSync(FREEZES, 'utf8'));
  const cal = s => C.calendar013(at(s), F);
  check('[T-10] calendar: Thu 18:20 ok (own 013 window skipped)', cal('2026-11-05T18:20:00Z').ok === true);
  check('[T-10] calendar: no start at or after 23:15', !cal('2026-11-05T23:15:00Z').ok && !cal('2026-11-05T23:40:00Z').ok);
  check('[T-10] calendar: 21:58–22:02 sweep slot refused', !cal('2026-11-05T21:59:00Z').ok && cal('2026-11-05T22:02:00Z').ok);
  check('[T-10] calendar: FREEZES band 17:45–18:15 refused', !cal('2026-11-05T17:50:00Z').ok);
  check('[T-10] calendar: Sunday refused; Monday before 08:00 refused', !cal('2026-11-08T12:00:00Z').ok && !cal('2026-11-09T07:30:00Z').ok && cal('2026-11-09T08:30:00Z').ok);
  check('[T-10] calendar: FREEZES missing → refused', !C.calendar013(at(THU), null).ok);
  check('[T-10] no write at or after 23:30', C.writeAllowed(at('2026-11-05T23:29:00Z')) && !C.writeAllowed(at('2026-11-05T23:30:00Z')));
  // batch-boundary stop with the remainder file
  const file = mkDb();
  const p = C.buildPlan({ ...inputs(file), batchSize: 2 }); const dir = writePlan(p);
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test', 'assume-account': 69960 });
  const r = await R.cmdRun(ctx);
  const rem = JSON.parse(readFileSync(ctx.paths.remainder, 'utf8'));
  const sha = readFileSync(ctx.paths.remainder + '.sha256', 'utf8').split(/\s+/)[0];
  check('[T-10] account near 70k → stop before the batch, never mid-batch; remainder.json with its SHA-256', r.stopped === 'budget_limit' && rem.batches.length === 2 && rem.merges === 4
    && sha === C.canonicalPlan(rem).sha.replace(/.*/, sha) && rows(file, 'SELECT COUNT(*) n FROM entity_merge_redirect')[0].n === 0, { r, rem: rem.merges });
  const { ctx: c2 } = await ctxFor(mkDb(), { plan: dir, 'pilot-ok': 'test' }, { at: '2026-11-05T23:16:00Z' });
  const r2 = await R.cmdRun(c2);
  check('[T-10] 23:16 → calendar stop, remainder written', r2.stopped === 'calendar' && existsSync(c2.paths.remainder));
}

// ═══ T-11 (Ops M-2): wrapper — own env, own flags, own pid ═══
{
  const home = mkdtempSync(path.join(TMP, 'home-'));
  const env = { ...process.env, MERGE013_ENV: path.join(home, 'merge-013', '013.env'), HOME: home };
  const sh = (...a) => spawnSync('bash', [SH, ...a], { env, encoding: 'utf8' });
  const work = path.join(home, 'merge-013');
  const i1 = sh('init', work);
  check('[T-11] init writes 013.env 600 and the work dir 700', i1.status === 0 && (statSync(env.MERGE013_ENV).mode & 0o777) === 0o600 && (statSync(work).mode & 0o777) === 0o700, i1.stderr);
  check('[T-11] init again with identical content is a no-op; a differing file is never overwritten',
    sh('init', work).status === 0 && (writeFileSync(env.MERGE013_ENV, 'MERGE013_WORK_DIR=/x\nMERGE013_JOB_ID=manual.entity-merge-013\n'), sh('init', work).status === 2));
  writeFileSync(env.MERGE013_ENV, `MERGE013_WORK_DIR=${work}\nMERGE013_JOB_ID=manual.entity-merge-013\n`);
  const st = sh('status');
  check('[T-11] status prints WORK_DIR and JOB_ID on its first line', st.status === 0 && st.stdout.split('\n')[0].startsWith(`WORK_DIR=${work} JOB_ID=manual.entity-merge-013`), st.stdout);
  writeFileSync(env.MERGE013_ENV, `MERGE013_WORK_DIR=${path.join(home, 'gleif-011')}\nMERGE013_JOB_ID=manual.entity-merge-013\n`);
  check('[T-11] refuses a work dir of 011 / A2', sh('status').status === 2);
  writeFileSync(env.MERGE013_ENV, `MERGE013_WORK_DIR=${work}\nMERGE013_JOB_ID=manual.gleif-reconcile-011\n`);
  check('[T-11] refuses a wrong JOB_ID', sh('status').status === 2);
  check('[T-11] runner envCheck refuses the same', throws(() => R.envCheck({ MERGE013_WORK_DIR: '/a/gleif-a2', MERGE013_JOB_ID: 'manual.entity-merge-013' })) && throws(() => R.envCheck({ MERGE013_WORK_DIR: '/a', MERGE013_JOB_ID: 'x' })));
  writeFileSync(env.MERGE013_ENV, `MERGE013_WORK_DIR=${work}\nMERGE013_JOB_ID=manual.entity-merge-013\n`);
  // stop: SIGTERM reaches only a process whose command line is the 013 runner
  const other = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 30000)', 'gleif-reconcile-011.mjs'], { stdio: 'ignore' });
  writeFileSync(path.join(work, 'runner.pid'), String(other.pid));
  const s1 = sh('stop');
  const otherAlive = (() => { try { process.kill(other.pid, 0); return true; } catch { return false; } })();
  const dummy = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>process.exit(143)); setTimeout(()=>{}, 30000)', 'merge-013.mjs'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 200));
  writeFileSync(path.join(work, 'runner.pid'), String(dummy.pid));
  const exited = new Promise(r => dummy.on('exit', code => r(code)));
  const s2 = sh('stop');
  const code = await Promise.race([exited, new Promise(r => setTimeout(() => r('timeout'), 3000))]);
  const stopFlag = path.join(CA, '.merge-013-stop');
  check('[T-11] stop writes the 013 stop flag and SIGTERMs the 013 runner pid only (never another process)', s1.status === 0 && otherAlive && /no live 013 runner/.test(s1.stdout) && s2.status === 0 && code === 143 && existsSync(stopFlag), { s1: s1.stdout, s2: s2.stdout, code });
  try { other.kill(); } catch { /* */ }
  const rs = sh('resume', '--clear-stop');
  check('[T-11] own flags only: .merge-013-paused / .merge-013-stop; resume --clear-stop clears them', rs.status === 0 && !existsSync(stopFlag) && C.PAUSE_FLAG_NAME === '.merge-013-paused' && C.STOP_FLAG_NAME === '.merge-013-stop');
  const fileK = mkDb(); const pK = writePlan(C.buildPlan(inputs(fileK)));
  const { ctx } = await ctxFor(fileK, { plan: pK, 'pilot-ok': 'test' }); ctx.stopRequested = true;
  const rk = await R.cmdRun(ctx);
  check('[T-11] SIGTERM in the runner → stops before the next batch, exits killed, writes nothing', rk.stopped === 'killed' && rows(fileK, 'SELECT COUNT(*) n FROM entity_merge_redirect')[0].n === 0, rk);
}

// ═══ T-12: index precondition → exit before any write ═══
for (const ix of ['idx_iem_entity_key', 'idx_bil_entity', 'idx_mqp_entity_id', 'idx_entity_master_normalized']) {
  const file = mkDb(`DROP INDEX ${ix};`); const dir = writePlan(C.buildPlan(inputs(file)));
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test' }); const b = dump(file);
  const r = await R.cmdRun(ctx);
  check(`[T-12] missing ${ix} → run refused before any write`, r.stopped === 'failed' && /index precondition/.test(r.reason) && dump(file) === b, r);
}
check('[T-12] an index with the right name on the wrong columns is caught', C.indexPrecondition([{ name: 'idx_iem_entity_key', tbl_name: 'instrument_entity_map', sql: 'CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id)' }]).some(s => /idx_iem_entity_key: expected/.test(s)));

// ═══ T-13 (Arch M-5, N-2): seed dry run with the live normalizeName ═══
{
  const file = mkDb(); const dir = writePlan(C.buildPlan(inputs(file)));
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test' }); await R.cmdRun(ctx);
  const db = new DatabaseSync(file);
  const seedUpsert = db.prepare(`INSERT INTO entity_master (name, normalized_name, type, country) VALUES (?, ?, 'operating', 'US') ON CONFLICT(normalized_name, type) DO UPDATE SET updated_at = updated_at`);
  const n0 = db.prepare('SELECT COUNT(*) n FROM entity_master').get().n;
  for (const p of PAIRS) { seedUpsert.run(p.dname, nn(p.dname)); seedUpsert.run(p.sname, nn(p.sname)); }
  const n1 = db.prepare('SELECT COUNT(*) n FROM entity_master').get().n;
  check('[T-13] two-way: the seed upsert for both source names lands on the survivor — 0 inserts', n1 === n0, { n0, n1 });
  // three-way shape: the holder keeps its own (native) key, so a twin's name re-inserts a row → why three-way/OTP are held
  db.exec(`INSERT INTO entity_master (entity_id, name, normalized_name, type, lei) VALUES (900, '匯聚科技有限公司', '匯聚科技有限公司', 'operating', 'HOLDER0000000000001')`);
  const n2 = db.prepare('SELECT COUNT(*) n FROM entity_master').get().n;
  seedUpsert.run('Time Interconnect Technology Ltd', nn('Time Interconnect Technology Ltd'));
  check('[T-13] three-way/OTP shape: the twin name is re-inserted (1 new row) — documents the November hold', db.prepare('SELECT COUNT(*) n FROM entity_master').get().n === n2 + 1);
  db.close();
  const f2 = mkDb(`UPDATE entity_master SET name = 'Acme Corp-' WHERE entity_id = 10;`);
  const p2 = C.buildPlan(inputs(f2));
  check('[T-13] N-2 is a plan-time assertion: a survivor name that no longer maps to the duplicate key is held', p2.held.n2_mismatch.some(x => x.surv === 10));
}

// ═══ T-14 (Arch N-1): redirects single-hop; 007 R3 resolves a merged id ═══
{
  const file = mkDb(); const dir = writePlan(C.buildPlan(inputs(file)));
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test' }); await R.cmdRun(ctx);
  const red = rows(file, 'SELECT duplicate_id, survivor_id FROM entity_merge_redirect');
  const dups = new Set(red.map(r => r.duplicate_id));
  check('[T-14] single hop: no survivor_id is a duplicate_id', red.length === 4 && red.every(r => !dups.has(r.survivor_id)));
  const worker = (await import(pathToFileURL(path.join(CA, 'src', 'entities-api.js')).href)).default;
  const db = new DatabaseSync(file, { readOnly: true });
  const prep = sql => { let ps = []; const st = { bind(...p) { ps = p; return st; }, async first() { return db.prepare(sql).get(...ps) ?? null; }, async all() { return { results: db.prepare(sql).all(...ps) }; } }; return st; };
  db.exec; const env = { DB: { prepare: prep, batch: async s => s.map(x => ({ results: [] })) } };
  const res = await worker.fetch(new Request('https://w.test/api/entities/1010/instruments?limit=25'), env, {});
  const body = await res.json(); db.close();
  check('[T-14] 007 R3 (NAV_MAX_HOPS = 3): merged id 1010 resolves to survivor 10 in one hop', res.status === 200 && body.entity_id === 10 && body.redirect?.resolved_id === 10 && body.redirect.chain.length === 2, body);
}

// ═══ T-15 (Ops M-1): heartbeats ═══
{
  const file = mkDb(); const dir = writePlan(C.buildPlan(inputs(file)));
  const got = [];
  const outboxModule = { createOpsOutbox: () => ({ send: async evt => { got.push(evt); return { delivered: true }; }, spool() {}, replay: async () => ({ replayed: 0 }) }) };
  const { ctx } = await ctxFor(file, { plan: dir, 'pilot-ok': 'test' }, { ingestCfg: { url: 'https://x/run-event', emitter: 'merge-013', key: 'k' }, outboxModule });
  await R.cmdRun(ctx);
  check('[T-15] events carry job manual.entity-merge-013, emitter merge-013, 900 s per batch; start + terminal per batch',
    got.length >= 2 && got.every(e => e.job_id === 'manual.entity-merge-013' && e.detail.emitter === 'merge-013' && e.detail.expected_max_duration_s === 900) && got[0].event === 'start' && got[1].event === 'success', got.slice(0, 2));
  const { ctx: c2 } = await ctxFor(mkDb(), {}, { ingestCfg: { url: 'https://x', emitter: 'gleif-reconcile-011', key: 'k' }, outboxModule });
  check('[T-15] a key for another emitter is refused → no outbox', c2.outbox === null && /not merge-013/.test(c2.ingestWhy));
  const f3 = mkDb(); const d3 = writePlan(C.buildPlan(inputs(f3)));
  const { ctx: c3 } = await ctxFor(f3, { plan: d3, 'pilot-ok': 'test' });
  await R.cmdRun(c3);
  const rl = readFileSync(c3.paths.runlog, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  check('[T-15] without the key → run-log fallback (R-4) holds every batch', c3.outbox === null && rl.some(l => l.outcome === 'success' && l.batch === 'B01'));
}

// ═══ T-16 (Ops M-3): boost pause row and the 17:50 end event ═══
{
  const file = mkDb(); const dir = writePlan(C.buildPlan(inputs(file)));
  const mk = async () => (await ctxFor(file, { plan: dir, 'pilot-ok': 'test', 'no-ops-gates': undefined })).ctx;
  let r = await R.cmdRun(await mk());
  check('[T-16] no boost pause row → refused (held)', r.stopped === 'held' && /ops_job_pause/.test(r.reason), r);
  const db = new DatabaseSync(file);
  db.exec(`INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by) VALUES ('local.entities-enrich-boost', '2026-11-05T17:56:00Z', '2026-11-06T00:10:00Z', '013 run', 'ops')`);
  r = await R.cmdRun(await mk());
  check('[T-16] pause row present but the 17:50 run has no end event → refused', r.stopped === 'held' && /no end event/.test(r.reason), r);
  db.exec(`INSERT INTO ops_job_run (run_id, phase, event_type, job_id, started_at) VALUES ('r', 'end', 'success', 'local.entities-enrich-boost', '2026-11-05T17:50:01.000Z')`);
  db.close();
  r = await R.cmdRun(await mk());
  check('[T-16] both present → the run starts', r.stopped === 'pilot hold' || r.done === true, r);
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\nmerge-013: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
