#!/usr/bin/env node
// MA-OCT-002b B1 — effective schedules + drift (spec 002 rev 1.3 §6.2, AC-b1, R-4). Runs the REAL ops-api.js +
// schedules.js on node:sqlite with the real 12 Oct registry load and a fake Cloudflare API. 0 network.
//   node App/Ops/tests/schedules-contract.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const sha = s => createHash('sha256').update(s).digest('hex');
const DAY = 86400000;

let NOW = Date.parse('2026-10-31T08:00:30Z');
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
let CF = {}, cfCalls = 0, cfFail = {};
globalThis.fetch = async (u, init) => {
  const m = String(u).match(/\/workers\/scripts\/([^/]+)\/schedules$/);
  if (m) { cfCalls++; const w = decodeURIComponent(m[1]);
    if (init?.headers?.Authorization !== 'Bearer read-token') return new Response('{"success":false,"errors":[{"code":10000}]}', { status: 403 });
    if (cfFail[w]) return new Response('{"success":false,"errors":[{"code":7003}]}', { status: 500 });
    if (!(w in CF)) return new Response('{"success":false,"errors":[{"code":10007,"message":"script not found"}]}', { status: 404 });
    return new Response(JSON.stringify({ success: true, result: { schedules: CF[w].map(cron => ({ cron, created_on: 'x', modified_on: 'x' })) } }), { status: 200 }); }
  return (String(u).startsWith('https://api.cloudflare.com/client/v4/graphql')
  ? new Response(JSON.stringify({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { readQueries: 1, writeQueries: 1, rowsRead: 10, rowsWritten: 1234 } }] }] } } }), { status: 200 })
  : new Response('no network', { status: 599 })); };

const KEY_HC = 'test-hc-key-0001';
const { default: worker } = await import('../src/ops-api.js');
const baseEnv = { DB, OPS_INGEST_ENABLED: 'true', OPS_SWEEP_ENABLED: 'true', OPS_SWEEP_DAILY_RAISE_CAP: '100', CF_ACCOUNT_TAG: 'acct', CF_ANALYTICS_TOKEN: 'x',
                  OPS_INGEST_KEYS: JSON.stringify({ 'health-check-local': sha(KEY_HC) }) };
let runN = 0;
let sweep = async function (env = baseEnv, lookback_days = 14) {
  const resp = await worker.fetch(new Request('https://meridian-ops.test/api/ops/ingest/sweep', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ops-Emitter': 'health-check-local', 'X-Ops-Ingest-Key': KEY_HC },
    body: JSON.stringify({ v: 1, run_id: `00000000-0000-4000-8000-${String(++runN).padStart(12, '0')}`, lookback_days }) }), env, { waitUntil() {} });
  return { status: resp.status, body: await resp.json() };
}

const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const S = await import('../src/schedules.js');
// The runner posts the sweep's own end event after each sweep (firstSweepToday keys on it), as in production.
let hcN = 0;
const hcEnd = () => { const id = `hc-${++hcN}`; const ins = db.prepare(`INSERT INTO ops_job_run (run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, end_only, contract_version)
  VALUES (?, ?, ?, 'local.health-check', 'health-check-local', 'launchd', ?, ?, 0, 1)`);
  ins.run(id, 'start', 'start', iso(NOW - 1000), null); ins.run(id, 'end', 'success', iso(NOW - 1000), iso(NOW)); };
const _sweep = sweep;
sweep = async (...a) => { const out = await _sweep(...a); hcEnd(); return out; };

const { intendedDrift, parseCfCron } = await import('../src/lateness.js');
const LIVE = { 'meridian-holdings': ['0 4 * * sun'], 'meridian-entities-seed': ['0 4 * * mon'], 'meridian-entities-enrich': ['0 6 * * *', '50 6 * * *'],
               'meridian-bootstrap': ['0 */4 * * *'], 'meridian-entities-delta': [], 'meridian-entities-figi': [] };
const env = { ...baseEnv, CF_WORKERS_READ_TOKEN: 'read-token' };
const reset = () => { freshDb(); CF = structuredClone(LIVE); cfCalls = 0; cfFail = {};
  // registry as live on 29 Oct (seed fixed to 'mon' on 24 Sep, MA-OCT-012)
  db.prepare(`UPDATE ops_job_registry SET intended_schedule = ? WHERE job_id = 'cf.meridian-entities-seed'`).run(JSON.stringify({ kind: 'cf_cron', exprs: ['0 4 * * mon'], tz: 'UTC' })); };

// --- pure: normalisation, T-D1, T-D2 ---
check('[norm] names ↔ CF numbers (1 = Sunday): "0 4 * * sun" ≡ "0 4 * * 1", "MON" ≡ 2, months too',
  S.normExpr('0 4 * * sun') === S.normExpr('0 4 * * 1') && S.normExpr('0 4 * * MON') === '0 4 * * 2' && S.normExpr('0 0 1 jan *') === '0 0 1 1 *', S.normExpr('0 4 * * sun'));
const td1 = parseCfCron('0 4 * * 1');
check('[T-D1] intended "0 4 * * 1" ("Monday" in the comment) resolves to SUNDAY under CF semantics and raises numeric_dow',
  intendedDrift({ kind: 'cf_cron', exprs: ['0 4 * * 1'] }, NOW).some(d => d.type === 'numeric_dow') && S.normExpr('0 4 * * 1') === S.normExpr('0 4 * * sun'), td1);
const boost = { kind: 'launchd_calendar', tz: 'Europe/London', entries: [{ hour: 11, minute: 50 }, { hour: 17, minute: 50 }], utc_targets: ['10:50', '16:50'], installed_utc_offset: '+01:00' };
check('[T-D2] boost installed at +01:00: from Sun 25 Oct (GMT) dst_shift is raised (002a evaluator, unchanged)',
  intendedDrift(boost, Date.parse('2026-10-26T09:00:00Z')).some(d => d.type === 'dst_shift') && !intendedDrift(boost, Date.parse('2026-10-20T09:00:00Z')).some(d => d.type === 'dst_shift'));

// --- workerDrift ---
const J = (job_id, worker_name, exprs, status = 'active') => ({ job_id, worker_name, status, intended_schedule: JSON.stringify(exprs ? { kind: 'cf_cron', exprs } : { kind: 'none' }) });
const E = exprs => ({ kind: exprs.length ? 'cf_cron' : 'none', exprs });
const enrich = [J('p1', 'meridian-entities-enrich', ['0 6 * * *']), J('p23', 'meridian-entities-enrich', ['50 6 * * *'])];
check('[drift] match (names vs numbers) → none', S.workerDrift([J('h', 'meridian-holdings', ['0 4 * * sun'])], E(['0 4 * * 1'])).length === 0);
const mm = S.workerDrift([J('s', 'meridian-entities-seed', ['0 4 * * mon'])], E(['0 4 * * 1']));
check('[drift] seed intended mon, live "0 4 * * 1" (= Sunday, the KI 22.1 bug) → expr_mismatch sev2', mm.length === 1 && mm[0].type === 'expr_mismatch' && mm[0].severity === 'sev2', mm);
check('[drift] intended cron, no trigger → missing_trigger', S.workerDrift([J('b', 'meridian-bootstrap', ['0 */4 * * *'])], E([]))[0]?.type === 'missing_trigger');
const ut = S.workerDrift([J('d', 'meridian-entities-delta', null, 'held')], E(['0 3 * * *']));
check('[drift] held delta reactivated with a trigger → unexpected_trigger sev2', ut.length === 1 && ut[0].type === 'unexpected_trigger', ut);
check('[drift] Worker 404 for an active cron job → not_deployed', S.workerDrift([J('h', 'meridian-holdings', ['0 4 * * sun'])], { kind: 'not_deployed' })[0]?.type === 'not_deployed');
check('[drift] enrich: two jobs share one Worker; both triggers present → no drift for either job', S.workerDrift(enrich, E(['0 6 * * *', '50 6 * * *'])).length === 0);
const en = S.workerDrift(enrich, E(['0 6 * * *']));
check('[drift] enrich phase23 trigger gone → expr_mismatch on p23 only (missing "50 6 * * *")', en.length === 1 && en[0].job_id === 'p23' && en[0].missing[0] === '50 6 * * *', en);
check('[drift] a non-cron job (figi, kind none) on a Worker with no triggers → none', S.workerDrift([J('f', 'meridian-entities-figi', null)], E([])).length === 0);

// --- refreshSchedules + sweep (AC-b1) ---
reset();
const regWorkers = db.prepare(`SELECT COUNT(DISTINCT worker_name) n FROM ops_job_registry WHERE worker_name IN (${S.SCHEDULE_WORKERS.map(() => '?').join(',')})`).get(...S.SCHEDULE_WORKERS).n;
let r = await sweep(env);
check('[sweep] first sweep of the UTC day: schedules checked for the R-4 set with exactly one CF call per Worker (≤ 6 subrequests)',
  r.status === 200 && r.body.schedules?.checked === regWorkers && cfCalls === regWorkers && regWorkers <= 6, { body: r.body.schedules, cfCalls, regWorkers });
const effRows = db.prepare(`SELECT job_id, effective_schedule FROM ops_job_registry WHERE effective_schedule IS NOT NULL ORDER BY job_id`).all();
check('[sweep] effective_schedule written for each job of those Workers; audit row per change (ops_control/registry_updated, source cf_api)',
  effRows.length === r.body.schedules.updated && n(`SELECT COUNT(*) n FROM ops_case_event WHERE subject_type='ops_control' AND event_type='registry_updated' AND json_extract(payload,'$.source')='cf_api'`) === effRows.length, effRows);
check('[sweep] live = intended → 0 schedule_drift cases', n(`SELECT COUNT(*) n FROM ops_exception WHERE exception_type='schedule_drift'`) === 0 && r.body.schedules.drift === 0, r.body.schedules);
NOW += 4 * 3600000; cfCalls = 0;
r = await sweep(env);
check('[sweep] later sweeps the same UTC day: 0 CF calls, schedules null', cfCalls === 0 && r.body.schedules === null, { cfCalls, s: r.body.schedules });
NOW = Date.parse('2026-11-01T08:00:30Z'); cfCalls = 0;
const writesBefore = n(`SELECT COUNT(*) n FROM ops_case_event WHERE event_type='registry_updated'`);
r = await sweep(env);
check('[sweep] next day, nothing changed: 0 registry writes (write only on change)', r.body.schedules.updated === 0 && n(`SELECT COUNT(*) n FROM ops_case_event WHERE event_type='registry_updated'`) === writesBefore, r.body.schedules);

// AC-b1: a deliberate test mismatch raises schedule_drift ONCE.
CF['meridian-entities-seed'] = ['0 4 * * 1'];          // the KI 22.1 numeric expression redeployed
NOW = Date.parse('2026-11-02T08:00:30Z');
r = await sweep(env);
const sd = db.prepare(`SELECT job_id, severity, dedupe_key, title FROM ops_exception WHERE exception_type='schedule_drift'`).all();
check('[AC-b1] deliberate mismatch → exactly 1 schedule_drift case (sev2, seed, expr_mismatch), effective_schedule updated + audited',
  sd.length === 1 && sd[0].job_id === 'cf.meridian-entities-seed' && sd[0].severity === 'sev2' && /expr_mismatch/.test(sd[0].dedupe_key)
  && JSON.parse(db.prepare(`SELECT effective_schedule e FROM ops_job_registry WHERE job_id='cf.meridian-entities-seed'`).get().e).exprs[0] === '0 4 * * 1', sd);
NOW = Date.parse('2026-11-03T08:00:30Z');
r = await sweep(env);
check('[AC-b1] same mismatch next day → still 1 case (stable dedupe key), 0 new raises from it', n(`SELECT COUNT(*) n FROM ops_exception WHERE exception_type='schedule_drift'`) === 1, r.body);

// /api/ops/admin/jobs carries the effective-side drift (stored, no route added) — call the reader directly.
const reg = db.prepare(`SELECT * FROM ops_job_registry`).all();
const seed = reg.find(j => j.job_id === 'cf.meridian-entities-seed');
check('[read] storedDrift on the jobs read: seed shows expr_mismatch from the stored effective_schedule (0 reads)', S.storedDrift(seed, reg)[0]?.type === 'expr_mismatch', S.storedDrift(seed, reg));

// fail-soft paths
reset(); cfFail['meridian-bootstrap'] = true;
r = await sweep(env);
check('[soft] one Worker API error → recorded in schedules.errors, no write and no drift for it, sweep 200',
  r.status === 200 && r.body.schedules.errors['meridian-bootstrap'] && !db.prepare(`SELECT effective_schedule e FROM ops_job_registry WHERE job_id='cf.meridian-bootstrap'`).get().e, r.body.schedules);
reset(); cfCalls = 0;
r = await sweep(baseEnv);
check('[soft] no CF_WORKERS_READ_TOKEN → skipped "no_token", 0 CF calls, 0 writes', r.body.schedules?.skipped === 'no_token' && cfCalls === 0, r.body.schedules);
reset(); cfCalls = 0;
r = await sweep({ ...env, OPS_SCHEDULES_ENABLED: 'false' });
check('[soft] OPS_SCHEDULES_ENABLED="false" → skipped "disabled", 0 CF calls', r.body.schedules?.skipped === 'disabled' && cfCalls === 0, r.body.schedules);
reset(); delete CF['meridian-holdings'];
r = await sweep(env);
check('[drift] holdings Worker missing (404 / 10007) → not_deployed sev2', db.prepare(`SELECT COUNT(*) n FROM ops_exception WHERE exception_type='schedule_drift' AND job_id='cf.meridian-holdings' AND dedupe_key LIKE '%not_deployed%'`).get().n === 1);

// static: no new route
const src = read('src/ops-api.js');
check('[routes] B1 adds no meridian-ops route (no new path literal; drift on /admin/jobs, schedules in the sweep body)', !/path === '\/api\/ops\/[^']*schedul/i.test(src) && !/schedules'/.test(src.match(/path === '[^']+'/g).join()), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
