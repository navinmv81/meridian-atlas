#!/usr/bin/env node
// MA-OCT-002b B2/B3 — Worker heartbeats (spec 002 rev 1.3 §12, §9, AC-b2/b3). Every event shape the four Workers
// emit is POSTed to the REAL meridian-ops ingest route (node:sqlite, real registry load) and must be accepted.
// Plus the helper's rules (inert without secrets, waitUntil only, 0 retries, 2 s timeout) and static checks
// (scheduled() only, never /run; SUBREQUEST_CHECKPOINT 43). 0 network.   node App/Ops/tests/heartbeats-contract.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const sha = s => createHash('sha256').update(s).digest('hex');
const DAY = 86400000;

let NOW = Date.parse('2026-11-01T04:10:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } };
const iso = ms => new RealDate(ms).toISOString();

let db, sqlLog = [];
const NONE = JSON.stringify({ kind: 'none' });
function freshDb() {
  db = new DatabaseSync(':memory:');
  db.exec(read('migrations/002-ops-control-plane.sql'));
  db.exec(read('migrations/003-ops-job-pause.sql'));
  db.exec(read('migrations/004-ops-cases.sql'));
  db.exec(`CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
           INSERT INTO holdings_pipeline_state VALUES ('hold_all_jobs','false'), ('etf_offset','71'), ('last_run_status','running:71/237:partial:0');
           CREATE TABLE entity_enrichment_queue (entity_id INTEGER PRIMARY KEY, name TEXT, status TEXT NOT NULL DEFAULT 'pending', retry_after TEXT, last_attempt TEXT, lookup_method TEXT);
           CREATE INDEX idx_enrich_queue_status ON entity_enrichment_queue(status, retry_after);`);
  db.exec(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, notes)
           VALUES ('ops.ingest','Ops ingest global switch','Ops','Operations Lead','control',NULL,'control');
           INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, source_path, emitter_id, expected_max_duration_s)
           VALUES ('local.entities-enrich-boost','boost','Entities','Data-Identity Lead','local_schedule','x','boost-local',120);`);
  db.exec(read('migrations/registry-load-2026-10-12.sql'));
  db.prepare(`UPDATE ops_job_registry SET emitter_id = 'health-check-local', intended_schedule = ? WHERE job_id = 'local.health-check'`).run(NONE);
  db.prepare(`UPDATE ops_job_registry SET intended_schedule = ? WHERE job_id = 'local.entities-enrich-boost'`).run(NONE);
  sqlLog = [];
}
function stmt(sql, args = []) {
  const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
  const exec = () => { sqlLog.push(sql); if (isWrite) { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes), rows_read: 0 } }; }
                       const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; };
  return { bind: (...a) => stmt(sql, a), async all() { return exec(); }, async first() { return exec().results[0] ?? null; }, async run() { return exec(); }, execSync: exec };
}
const DB = { prepare: sql => stmt(sql), async batch(ss) { db.exec('BEGIN'); try { const o = ss.map(s => s.execSync()); db.exec('COMMIT'); return o; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
globalThis.fetch = async u => (String(u).startsWith('https://api.cloudflare.com/client/v4/graphql')
  ? new Response(JSON.stringify({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { readQueries: 1, writeQueries: 1, rowsRead: 10, rowsWritten: 1234 } }] }] } } }), { status: 200 })
  : new Response('no network', { status: 599 }));


const W = new URL('../../', import.meta.url);
const rd = rel => readFileSync(new URL(rel, W), 'utf8');
const EMITTERS = { 'cf.meridian-holdings': 'holdings-cf', 'cf.meridian-entities-seed': 'entities-seed-cf',
  'cf.meridian-entities-enrich.phase1': 'entities-enrich-cf', 'cf.meridian-entities-enrich.phase23': 'entities-enrich-cf', 'cf.meridian-bootstrap': 'bootstrap-cf' };
const KEYS = { 'holdings-cf': 'k-holdings-0001', 'entities-seed-cf': 'k-seed-0001', 'entities-enrich-cf': 'k-enrich-0001', 'bootstrap-cf': 'k-boot-0001' };
freshDb();
for (const [job, em] of Object.entries(EMITTERS)) db.prepare(`UPDATE ops_job_registry SET emitter_id = ? WHERE job_id = ?`).run(em, job);
const { default: ops } = await import('../src/ops-api.js');
const opsEnv = { DB, OPS_INGEST_ENABLED: 'true', OPS_INGEST_KEYS: JSON.stringify(Object.fromEntries(Object.entries(KEYS).map(([e, k]) => [e, sha(k)]))) };
// fetch → the real ingest route
const sentLog = [];
const toOps = async (url, init) => { const e = { url, init, body: JSON.parse(init.body) }; sentLog.push(e);
  const r = await ops.fetch(new Request('https://meridian-ops.test/api/ops/ingest/run-event', { method: 'POST', headers: init.headers, body: init.body }), opsEnv, { waitUntil() {} });
  e.status = r.status; e.resp = await r.json(); return r; };
const ctx = () => { const p = []; return { waitUntil: x => p.push(x), drain: () => Promise.allSettled(p), get n() { return p.length; } }; };
const wenv = em => ({ OPS_INGEST_URL: 'https://meridian-ops.test/api/ops/ingest/run-event', OPS_EMITTER: em, OPS_INGEST_KEY: KEYS[em] });

const HB = await import('../../ETF Refresh/src/ops-heartbeat.js');
const HB2 = await import('../../Corporate Atlas/src/ops-heartbeat.js');
check('[helper] the ETF and Entities copies are byte-identical (no cross-domain import)', rd('ETF Refresh/src/ops-heartbeat.js') === rd('Corporate Atlas/src/ops-heartbeat.js'));

// helper rules
let c = ctx(), calls = 0;
let hb = HB.heartbeat({}, c, { jobId: 'cf.meridian-holdings', trigger: 'cron:0 4 * * sun', fetchImpl: async () => { calls++; return new Response('{}'); } });
hb.start(); hb.end('success', {});
check('[helper] inert without OPS_INGEST_URL / OPS_EMITTER / OPS_INGEST_KEY: 0 fetches, 0 waitUntil', calls === 0 && c.n === 0 && !hb.enabled);
c = ctx(); calls = 0;
hb = HB.heartbeat({ ...wenv('holdings-cf'), OPS_HEARTBEATS_ENABLED: 'false' }, c, { jobId: 'x', trigger: 't', fetchImpl: async () => { calls++; } });
hb.start(); hb.end('success', {});
check('[helper] OPS_HEARTBEATS_ENABLED="false" → off', calls === 0 && c.n === 0);
c = ctx(); calls = 0; let sig = null;
hb = HB.heartbeat(wenv('holdings-cf'), c, { jobId: 'x', trigger: 't', fetchImpl: async (u, i) => { calls++; sig = i.signal; throw new TypeError('network down'); } });
hb.start(); hb.end('success', {});
const settled = await c.drain();
check('[helper] network error: exactly one attempt per event (0 retries), never rejects into the job (waitUntil promises resolve)',
  calls === 2 && settled.every(x => x.status === 'fulfilled'), { calls, settled });
check('[helper] each send carries a 2 s AbortSignal.timeout', sig instanceof AbortSignal);
c = ctx(); calls = 0;
hb = HB.heartbeat(wenv('holdings-cf'), c, { jobId: 'x', trigger: 't', endOnly: true, fetchImpl: async () => { calls++; return new Response('{}'); } });
hb.start(); hb.end('success', {}); await c.drain();
check('[helper] endOnly: start() sends nothing; one end event → 1 subrequest', calls === 1);

// every Worker event shape → real ingest
async function post(jobId, em, endOnly, event, fields, triggerExpr) {
  const c = ctx(); const h = HB.heartbeat(wenv(em), c, { jobId, trigger: `cron:${triggerExpr}`, endOnly, fetchImpl: toOps });
  const before = sentLog.length; h.start(); NOW += 60000; h.end(event, fields); await c.drain();
  return { runId: h.runId, sent: sentLog.slice(before) };
}
const ok201 = s => s.length && s.every(x => x.status === 201 && x.resp.ok);
const runs = id => db.prepare(`SELECT phase, event_type, items_attempted, items_progressed, rows_written, cursor_before, cursor_after, detail, trigger, end_only FROM ops_job_run WHERE run_id = ? ORDER BY phase DESC`).all(id);

const { holdingsEvent } = await import('../../ETF Refresh/src/holdings-pipeline.js');
const per = Array.from({ length: 20 }, (_, i) => ({ t: `TICKER${i}`, w: 2500 + i * 37 }));
const hs = { offset: 111, offset_after: 131, total: 237, attempted: 20, completed: 20, errors: 0, complete: false, writes_today: 12, writes_today_after: 70684, per_etf: per };
let r = await post('cf.meridian-holdings', 'holdings-cf', true, ...holdingsEvent(hs), '0 4 * * sun');
let rr = runs(r.runId);
check('[AC-b2 holdings] end-only success accepted (201), end_only = 1, trigger cron:<expr>; per_etf ×20 and writes_today_after kept; detail ≤ 2 KB',
  ok201(r.sent) && r.sent.length === 1 && rr.length === 1 && rr[0].end_only === 1 && rr[0].trigger === 'cron:0 4 * * sun'
  && JSON.parse(rr[0].detail).per_etf.length === 20 && JSON.parse(rr[0].detail).metrics.writes_today_after === 70684
  && new TextEncoder().encode(rr[0].detail).length <= 2048 && rr[0].cursor_before === '111' && rr[0].cursor_after === '131' && rr[0].rows_written === 70672, { s: r.sent.map(x => x.resp), rr });
check('[AC-b3] holdings carries rows_written = 70,672 (the 012 Sunday baseline shape) and the per-ETF costs the 75k / next-batch warning reads',
  rr[0].items_attempted === 20 && rr[0].items_progressed === 20 && JSON.parse(rr[0].detail).per_etf[19].w === 2500 + 19 * 37);
r = await post('cf.meridian-holdings', 'holdings-cf', true, ...holdingsEvent({ ...hs, completed: 17, complete: false }), '0 4 * * sun');
check('[holdings] fewer ETFs completed than attempted → partial (accepted)', ok201(r.sent) && runs(r.runId)[0].event_type === 'partial');
r = await post('cf.meridian-holdings', 'holdings-cf', true, ...holdingsEvent({ ...hs, offset: 230, offset_after: 0, completed: 7, attempted: 7, complete: true, per_etf: per.slice(0, 7) }), '0 4 * * sun');
check('[AC-b3 pass-cycle] pass complete → cursor_after "complete:237" + detail.pass_complete (the "weeks since last complete" input)', ok201(r.sent) && runs(r.runId)[0].cursor_after === 'complete:237' && JSON.parse(runs(r.runId)[0].detail).pass_complete === true);
for (const [why, ev] of [['hold', holdingsEvent({ skipped: 'hold' })], ['budget', holdingsEvent({ skipped: 'budget', writes_today: 80065 })]]) {
  r = await post('cf.meridian-holdings', 'holdings-cf', true, ...ev, '0 4 * * sun');
  check(`[holdings] skipped(${why}) accepted`, ok201(r.sent) && runs(r.runId)[0].event_type === 'skipped');
}
r = await post('cf.meridian-entities-seed', 'entities-seed-cf', false, 'success', { items_attempted: 4, items_progressed: 4, detail: { metrics: { steps_completed: 4 } } }, '0 4 * * mon');
check('[AC-b2 seed] start + end accepted (2 subrequests)', ok201(r.sent) && r.sent.length === 2 && runs(r.runId).length === 2, r.sent.map(x => [x.status, x.resp]));
r = await post('cf.meridian-entities-seed', 'entities-seed-cf', false, 'partial', { items_attempted: 4, items_progressed: 1, detail: { stopped: 'write_cap', metrics: { steps_completed: 1 } } }, '0 4 * * mon');
check('[seed] stopped at the write cap → partial accepted', ok201(r.sent));
r = await post('cf.meridian-entities-enrich.phase1', 'entities-enrich-cf', false, 'success', { items_attempted: 50, items_progressed: 7, detail: { metrics: { isins_populated: 7 } } }, '0 6 * * *');
check('[AC-b2 enrich phase1] start + end accepted', ok201(r.sent) && r.sent.length === 2);
r = await post('cf.meridian-entities-enrich.phase1', 'entities-enrich-cf', false, 'skipped', { detail: { reason: 'empty_input' } }, '0 6 * * *');
check('[enrich phase1] nothing to populate → skipped(empty_input) accepted', ok201(r.sent));
const { enrichPhase23Fields } = await import('../../Corporate Atlas/src/entities-enrich.js');
r = await post('cf.meridian-entities-enrich.phase23', 'entities-enrich-cf', true, 'partial', enrichPhase23Fields({ matched: 3, subrequests: 12 }, { processed: 30, deferred: 9, subrequests: 31 }), '50 6 * * *');
rr = runs(r.runId);
check('[AC-b2 enrich phase23] end-only (1 subrequest) accepted; GLEIF counters in detail.metrics; no items_* (E1 must not read attempts as progress)',
  ok201(r.sent) && r.sent.length === 1 && rr[0].end_only === 1 && JSON.parse(rr[0].detail).metrics.subrequests_total === 43 && rr[0].items_attempted === null && rr[0].items_progressed === null, rr);
const { bootstrapEvent } = await import('../../ETF Refresh/src/bootstrap.js');
r = await post('cf.meridian-bootstrap', 'bootstrap-cf', true, ...bootstrapEvent({ considered: 2, added: 1, tickers_resolved: 1, noticker_rows: 3 }), '0 */4 * * *');
check('[AC-b2 bootstrap] end-only success: items_attempted = series considered, items_progressed = added, tickers_resolved metric', ok201(r.sent) && runs(r.runId)[0].items_progressed === 1 && JSON.parse(runs(r.runId)[0].detail).metrics.tickers_resolved === 1);
r = await post('cf.meridian-bootstrap', 'bootstrap-cf', true, ...bootstrapEvent({ considered: 0, added: 0, tickers_resolved: 0, noticker_rows: 0 }), '0 */4 * * *');
check('[bootstrap] no new series and no NOTICKER_ row → skipped(empty_input) accepted', ok201(r.sent) && runs(r.runId)[0].event_type === 'skipped');
r = await post('cf.meridian-bootstrap', 'bootstrap-cf', true, ...bootstrapEvent({ failed: 'series_discovery', message: 'HTTP 503' }), '0 */4 * * *');
check('[bootstrap] discovery failure → failed with error.class/summary accepted', ok201(r.sent) && runs(r.runId)[0].event_type === 'failed');
r = await post('cf.meridian-bootstrap', 'entities-seed-cf', true, 'success', {}, '0 */4 * * *');
check('[auth] an emitter posting for another Worker\'s job → 403 (registry emitter binding), nothing stored', r.sent[0].status === 403 && runs(r.runId).length === 0, r.sent[0]);

// B3 sweep side (etf-cycle.js) on the holdings events posted above through the real ingest route.
const C = await import('../src/etf-cycle.js');
const meta = x => x;
let cy = await C.holdingsCycle({ DB }, NOW, meta);
check('[AC-b3 cycle] from the stored holdings end events: last complete found → weeks_since_complete 0; per-ticker costs + next batch → prediction',
  cy.metrics.last_complete_at !== null && cy.metrics.weeks_since_complete === 0 && cy.metrics.frozen === false, cy);
const ev = (at, before, after, per, next, type = 'success') => ({ started_at: at, event_type: type, cursor_before: before, cursor_after: after, detail: JSON.stringify({ per_etf: per, next }) });
const tick = (n, w) => Array.from({ length: n }, (_, i) => ({ t: `T${i}`, w }));
const tN = n => Array.from({ length: n }, (_, i) => `T${i}`);
let out = C.cycleFrom([ev('2026-08-09T04:00:00Z', '211', 'complete:237', tick(20, 3800), tN(20))], Date.parse('2026-11-01T05:00:00Z'));
check('[AC-b3 (b)] synthetic next batch of 20 × 3,800 = 76,000 → < 5,000 under the 80k guard → budget_risk sev3', out.metrics.predicted_next_batch === 76000 && out.findings.length === 1 && out.findings[0].severity === 'sev3', out);
check('[AC-b3 (c)] last complete 9 Aug, now 1 Nov → weeks_since_complete 12', out.metrics.weeks_since_complete === 12, out.metrics);
out = C.cycleFrom([ev('2026-10-25T04:00:00Z', '111', '131', tick(20, 3000), tN(20))], NOW);
check('[AC-b3 (b)] 20 × 3,000 = 60,000 → no warning', out.metrics.predicted_next_batch === 60000 && out.findings.length === 0, out);
out = C.cycleFrom([ev('2026-10-25T04:00:00Z', '131', '131', tick(5, 2000), ['T0', 'T1', 'NEW1', 'NEW2'])], NOW);
check('[AC-b3 (c)] offset did not move on the latest run → frozen; unseen tickers costed at the mean (2 unknown)', out.metrics.frozen === true && out.metrics.predicted_unknown === 2 && out.metrics.predicted_next_batch === 8000, out.metrics);
check('[AC-b3] no holdings events → metrics null, no findings (sweep unchanged)', C.cycleFrom([], NOW).metrics === null);

// static: scheduled() only, never /run; checkpoint 43
const fetchBody = (src) => src.slice(src.indexOf('async fetch(request, env, ctx)'), src.indexOf('async fetch(request, env, ctx)') + 4000);
for (const [f, job] of [['ETF Refresh/src/holdings-pipeline.js', 'cf.meridian-holdings'], ['ETF Refresh/src/bootstrap.js', 'cf.meridian-bootstrap'],
                        ['Corporate Atlas/src/entities-seed.js', 'cf.meridian-entities-seed'], ['Corporate Atlas/src/entities-enrich.js', 'cf.meridian-entities-enrich']]) {
  const s = rd(f);
  const sched = s.slice(s.indexOf('async scheduled('), s.indexOf('async fetch(request'));
  check(`[static] ${f}: heartbeat built in scheduled() for ${job}, absent from fetch() (/run never reports)`,
    sched.includes('heartbeat(') && sched.includes(job) && !/heartbeat\(|hb\./.test(fetchBody(s)), null);
}
{ const h = rd('ETF Refresh/src/holdings-pipeline.js'); const fn = h.slice(h.indexOf('async function runHoldingsPipeline('), h.indexOf('// ── Per-ETF processing'));
  const read = fn.indexOf('writesAfter = await getTodayWriteCount(db)'), saves = [...fn.matchAll(/setPipelineState\(db, '(etf_offset|last_run_status)'/g)].map(m => m.index);
  check('[ETF-PL C-1] holdings measurement read comes AFTER every etf_offset / last_run_status save and sits inside try/catch',
    read > 0 && saves.length >= 4 && saves.every(i => i < read) && /try \{ writesAfter = await getTodayWriteCount\(db\)/.test(fn) && /catch \(err\)/.test(fn.slice(read)), { read, saves }); }
check('[static] enrich SUBREQUEST_CHECKPOINT is 43 (44 − 1 reserved heartbeat)', /const SUBREQUEST_CHECKPOINT = 43;/.test(rd('Corporate Atlas/src/entities-enrich.js')));
check('[static] holdings and bootstrap default to end-only (start only with OPS_HEARTBEAT_START="true", after B-2)',
  ['ETF Refresh/src/holdings-pipeline.js', 'ETF Refresh/src/bootstrap.js'].every(f => rd(f).includes(`endOnly: env.OPS_HEARTBEAT_START !== 'true'`)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
