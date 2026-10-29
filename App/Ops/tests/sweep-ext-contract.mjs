#!/usr/bin/env node
// MA-OCT-003 test 3 (spec rev 1 §15 step 3): sweep extensions §9.1–§9.5 — AC-9, AC-10, AC-11, the
// auto-resolve cap and the switches. Runs the REAL ops-api.js sweep (with sweep-ext.js) in Node on
// in-memory SQLite (real migrations 002–004, the real A1 registry load, the real M2 seed file).
// 002a's tests/sweep-contract.mjs (23 cases) is left byte-identical as the regression baseline and still
// passes; this file holds the 003 cases. No network, no remote D1.
//   Usage: node App/Ops/tests/sweep-ext-contract.mjs

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const sha = s => createHash('sha256').update(s).digest('hex');
const DAY = 86400000;

let NOW = Date.parse('2026-10-22T12:00:00Z');
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

const KEY_HC = 'test-hc-key-0001';
const { default: worker } = await import('../src/ops-api.js');
const baseEnv = { DB, OPS_INGEST_ENABLED: 'true', OPS_SWEEP_ENABLED: 'true', OPS_SWEEP_DAILY_RAISE_CAP: '100', CF_ACCOUNT_TAG: 'acct', CF_ANALYTICS_TOKEN: 'x',
                  OPS_INGEST_KEYS: JSON.stringify({ 'health-check-local': sha(KEY_HC) }) };
let runN = 0;
async function sweep(env = baseEnv, lookback_days = 14) {
  const resp = await worker.fetch(new Request('https://meridian-ops.test/api/ops/ingest/sweep', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ops-Emitter': 'health-check-local', 'X-Ops-Ingest-Key': KEY_HC },
    body: JSON.stringify({ v: 1, run_id: `00000000-0000-4000-8000-${String(++runN).padStart(12, '0')}`, lookback_days }) }), env, { waitUntil() {} });
  return { status: resp.status, body: await resp.json() };
}
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
let rid = 0;
function run(job, emitter, startedMs, { type = 'success', attempted = null, progressed = null, cursor = null, error_class = null, detail = null } = {}) {
  const id = `run-${String(++rid).padStart(6, '0')}`;
  const ins = db.prepare(`INSERT INTO ops_job_run (run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, items_attempted, items_progressed,
                          cursor_after, error_class, detail, end_only, contract_version) VALUES (?, ?, ?, ?, ?, 'launchd', ?, ?, ?, ?, ?, ?, ?, 0, 1)`);
  ins.run(id, 'start', 'start', job, emitter, iso(startedMs), null, null, null, null, null, null);
  ins.run(id, 'end', type, job, emitter, iso(startedMs), iso(startedMs + 60000), attempted, progressed, cursor, error_class, detail ? JSON.stringify(detail) : null);
  return id;
}
const register = (job, mode, emitter, extra = {}) => db.prepare(`INSERT OR REPLACE INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, intended_schedule, status, created_at)
  VALUES (?, ?, 'Entities', 'Data-Identity Lead', ?, ?, ?, ?, ?)`).run(job, job, mode, emitter, extra.schedule || NONE, extra.status || 'active', extra.created_at || iso(NOW));
const cases = type => db.prepare(`SELECT * FROM ops_exception WHERE exception_type = ? ORDER BY exception_id`).all(type);

// ================= (A) AC-9: one open case per (job, condition) + 30-day snooze ======================
freshDb();
register('local.firds-weekly-seed', 'local_schedule', 'firds-local');
const frozen = () => { for (const h of [3, 2, 1]) run('local.firds-weekly-seed', 'firds-local', NOW - h * 3600000, { attempted: 5, progressed: 5, cursor: 'c1' }); };
frozen();
const a1 = await sweep();
const fz1 = cases('job_frozen');
check('[AC-9] day 1: a frozen job raises 1 job_frozen case, keyed job_frozen:<job>:<cursor>:<UTC date>', a1.status === 200 && fz1.length === 1
  && fz1[0].dedupe_key === 'job_frozen:local.firds-weekly-seed:c1:2026-10-22' && fz1[0].job_id === 'local.firds-weekly-seed', { a1: a1.body, fz1 });
NOW += DAY; const a2 = await sweep();
NOW += DAY; const a3 = await sweep();
check('[AC-9] days 2 and 3: the persisting condition is suppressed (S2), 0 new cases', cases('job_frozen').length === 1 && a2.body.suppressed >= 1 && a3.body.suppressed >= 1
  && a2.body.raised === 0 && a3.body.raised === 0, { a2: a2.body, a3: a3.body });
check('[§9.1] suppressed findings count in already_open; S2 rows_read reported per job (≤ 190)', a3.body.already_open >= a3.body.suppressed
  && (a3.body.s2_rows_read['local.firds-weekly-seed'] ?? 99) <= 190, a3.body);
db.prepare(`UPDATE ops_exception SET status = 'resolved', resolution = 'accepted_risk', resolved_by = 'founder@example.test', resolved_at = ? WHERE exception_id = ?`).run(iso(NOW), fz1[0].exception_id);
NOW += DAY; frozen(); const a4 = await sweep();
NOW += 27 * DAY; frozen(); const a5 = await sweep();          // 28 days after the accepted_risk resolve
check('[AC-9] after resolve accepted_risk: 0 raises for 30 days (checked at +1 d and +28 d)', cases('job_frozen').length === 1 && a4.body.suppressed >= 1 && a5.body.suppressed >= 1, { a4: a4.body.suppressed, a5: a5.body.suppressed });
NOW += 3 * DAY; frozen(); const a6 = await sweep();           // 31 days after
check('[AC-9] the snooze ends after 30 days: the condition raises again', cases('job_frozen').length === 2 && a6.body.raised >= 1, cases('job_frozen').map(c => c.dedupe_key));
const fz2 = cases('job_frozen')[1];
db.prepare(`UPDATE ops_exception SET status = 'resolved', resolution = 'fixed', resolved_by = 'founder@example.test', resolved_at = ? WHERE exception_id = ?`).run(iso(NOW), fz2.exception_id);
NOW += DAY; frozen(); const a7 = await sweep();
check('[AC-9] after resolve fixed: the next day\'s sweep raises a new case if the condition persists', cases('job_frozen').length === 3 && a7.body.raised >= 1, cases('job_frozen').map(c => [c.dedupe_key, c.status]));
const plan = sql => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(r => r.detail).join(' | ');
const { S2_SQL } = await import('../src/sweep-ext.js');
const ps2 = plan(S2_SQL.replace('?1', "'j'").replace('?1', "'j'").replace('?2', "'2026-09-01'"));
check('[A3-4 plan] S2 = two seeks on idx_ops_exception_job_cond (open/ack; resolved + resolved_at range), no SCAN',
  (ps2.match(/SEARCH ops_exception USING (COVERING )?INDEX idx_ops_exception_job_cond \(job_id=\? AND exception_type=\? AND status=\?/g) || []).length >= 2
  && /resolved_at>\?/.test(ps2) && !/SCAN ops_exception/.test(ps2), ps2);

// ================= (B) AC-10: GLEIF catalogue E1, E2, E4, E5, E6 + M2 seeds ==========================
async function scenarioB(env) {
  NOW = Date.parse('2026-10-22T12:00:00Z');
  freshDb();
  db.exec(read('migrations/m2-seed-gleif-cases.sql'));
  for (const h of [5, 2]) run('local.entities-enrich-boost', 'boost-local', NOW - h * 3600000, { attempted: 10, progressed: 0 });      // E1 (+ F4)
  db.prepare(`INSERT INTO entity_enrichment_queue (entity_id, name, status, last_attempt) VALUES (1,'stuck','in_progress','2026-06-11 22:04:02'),
              (2,'recent','in_progress',?), (3,'pending','pending',NULL)`).run(iso(NOW - 3600000).replace('T', ' ').slice(0, 19));          // E2: only row 1
  db.prepare(`UPDATE ops_job_registry SET status = 'held', created_at = '2026-09-01T00:00:00Z' WHERE job_id IN ('cf.meridian-entities-enrich.phase1','cf.meridian-entities-delta')`).run();   // E4
  register('local.test-auth', 'local_schedule', 'test-local');
  run('local.test-auth', 'test-local', NOW - 5 * 3600000, { type: 'failed', error_class: 'CF_API_10000' });
  run('local.test-auth', 'test-local', NOW - 2 * 3600000, { type: 'failed', error_class: 'wrangler_auth_10000' });                    // E5
  register('local.test-blind', 'local_schedule', 'test-blind');
  run('local.test-blind', 'test-blind', NOW - 3600000, { attempted: 3, progressed: 3, detail: { metrics: { guard_blind: 1 } } });   // E6
  register('manual.gleif-reconcile-011', 'manual', 'gleif-011');
  for (const h of [4, 1]) run('manual.gleif-reconcile-011', 'gleif-011', NOW - h * 3600000, { attempted: 250, progressed: 0 });      // resumed batches (raced rows)
  return sweep(env);
}
const b1 = await scenarioB(baseEnv);
const byType = t => cases(t);
check('[AC-10] E1 gleif_no_progress sev2 raised once, for the boost', byType('gleif_no_progress').length === 1 && byType('gleif_no_progress')[0].severity === 'sev2'
  && byType('gleif_no_progress')[0].job_id === 'local.entities-enrich-boost', byType('gleif_no_progress'));
check('[AC-10] no job_frozen for the E1 job (F4 branch replaced)', !cases('job_frozen').some(c => c.job_id === 'local.entities-enrich-boost'), cases('job_frozen'));
check('[AC-10] E2 gleif_stuck_in_progress sev3 raised once, job_id = cf.meridian-entities-enrich.phase23 (003-1); counts only the > 24 h row',
  byType('gleif_stuck_in_progress').length === 1 && byType('gleif_stuck_in_progress')[0].job_id === 'cf.meridian-entities-enrich.phase23'
  && byType('gleif_stuck_in_progress')[0].severity === 'sev3' && /^GLEIF-E2: 1 /.test(byType('gleif_stuck_in_progress')[0].title), byType('gleif_stuck_in_progress'));
const e4 = byType('gleif_frozen_source');
check('[AC-10] E4 gleif_frozen_source sev3 raised for the held phase1 job; the delta case is the seeded EXC-M-000002 only (S2 suppression)',
  e4.length === 2 && e4.filter(c => c.job_id === 'cf.meridian-entities-delta').length === 1 && e4.find(c => c.job_id === 'cf.meridian-entities-delta').case_ref === 'EXC-M-000002'
  && e4.some(c => c.job_id === 'cf.meridian-entities-enrich.phase1' && c.raised_via === 'ingest_auto' && c.severity === 'sev3'), e4.map(c => [c.case_ref, c.job_id]));
check('[AC-10] E5 local_auth_failure sev3 raised once', byType('local_auth_failure').length === 1 && byType('local_auth_failure')[0].severity === 'sev3' && byType('local_auth_failure')[0].job_id === 'local.test-auth', byType('local_auth_failure'));
check('[AC-10] E6 blind_guard sev4 raised once', byType('blind_guard').length === 1 && byType('blind_guard')[0].severity === 'sev4', byType('blind_guard'));
check('[AC-10] no E1 for the 011 runner (excluded from GLEIF_JOBS; 003-4, N3-1)', !byType('gleif_no_progress').some(c => c.job_id === 'manual.gleif-reconcile-011'), byType('gleif_no_progress'));
check('[AC-10] M2 seeds present: EXC-M-000001 (E3) and EXC-M-000002 (E4 delta)', !!db.prepare(`SELECT 1 FROM ops_exception WHERE case_ref = 'EXC-M-000001' AND exception_type = 'gleif_orphaned_backlog'`).get()
  && !!db.prepare(`SELECT 1 FROM ops_exception WHERE case_ref = 'EXC-M-000002'`).get(), null);
check('[§9.5] response: gleif_checks {e2: 1, e4: 2}, suppressed ≥ 1, auto_resolved [] (switch absent), rows_read ≤ 1,000',
  b1.body.gleif_checks.e2 === 1 && b1.body.gleif_checks.e4 === 2 && b1.body.suppressed >= 1 && Array.isArray(b1.body.auto_resolved) && b1.body.auto_resolved.length === 0 && b1.body.rows_read <= 1000, b1.body);
const e2q = plan(`SELECT entity_id, last_attempt FROM entity_enrichment_queue WHERE status = 'in_progress' AND last_attempt < '2026-10-21 12:00:00' LIMIT 50`);
check('[plan] E2: SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)', /SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status \(status=\?/.test(e2q), e2q);
const e4q = plan(`SELECT MAX(started_at) AS last FROM ops_job_run WHERE job_id = 'x' AND event_type = 'success'`);
check('[plan] E4: idx_ops_job_run_job_type_at', /idx_ops_job_run_job_type_at/.test(e4q), e4q);
// Once a UTC day: after a health-check end event today, E2/E4 are not re-evaluated, and nothing re-raises.
run('local.health-check', 'health-check-local', NOW - 600000, { attempted: 1, progressed: 1 });
const before2 = n(`SELECT COUNT(*) n FROM ops_exception`);
const qb = sqlLog.length;
const b2 = await sweep();
check('[AC-10] a later sweep the same day raises none of these again; E2/E4 not re-run (gleif_checks null, no queue read)',
  n(`SELECT COUNT(*) n FROM ops_exception`) === before2 && b2.body.gleif_checks.e2 === null && b2.body.gleif_checks.e4 === null
  && !sqlLog.slice(qb).some(s => /entity_enrichment_queue/.test(s)), b2.body);
// Switch: OPS_SWEEP_GLEIF_CHECKS="false"
const q0 = sqlLog.length;
const b3 = await scenarioB({ ...baseEnv, OPS_SWEEP_GLEIF_CHECKS: 'false' });
check('[switch] OPS_SWEEP_GLEIF_CHECKS="false": no E1, E2, E4, E5 or E6 raised and the queue is never read', ['gleif_no_progress', 'gleif_stuck_in_progress', 'local_auth_failure', 'blind_guard'].every(t => byType(t).length === 0)
  && byType('gleif_frozen_source').length === 1 && !sqlLog.some(s => /entity_enrichment_queue/.test(s)) && b3.body.gleif_checks.e2 === null, b3.body);
check('[switch] …and with E1 off, the boost\'s F4 job_frozen is raised as before 003', cases('job_frozen').some(c => c.job_id === 'local.entities-enrich-boost'), cases('job_frozen'));

// ================= (C) AC-11: auto-resolve of replayed job_missed (F-1) ===============================
NOW = Date.parse('2026-10-22T20:00:00Z');
freshDb();
db.prepare(`UPDATE ops_job_registry SET intended_schedule = ? WHERE job_id = 'local.entities-enrich-boost'`).run(JSON.stringify({ kind: 'launchd_calendar', tz: 'Europe/London',
  entries: [{ hour: 11, minute: 50 }, { hour: 17, minute: 50 }], on_time_tol_s: 540, grace_s: 10800, observed_since: '2026-10-20T00:00:00Z' }));
for (const s of ['2026-10-20T10:50:00Z', '2026-10-20T16:50:00Z', '2026-10-22T16:50:00Z']) run('local.entities-enrich-boost', 'boost-local', Date.parse(s) + 60000, { attempted: 10, progressed: 10 });
const c1 = await sweep();
const missed = cases('job_missed').map(c => c.dedupe_key).sort();
const K = s => `job_missed:local.entities-enrich-boost:${s}`;
check('[fixture] three missed slots raised: 21 Oct 10:50Z, 21 Oct 16:50Z, 22 Oct 10:50Z', c1.status === 200 && missed.join() === [K('2026-10-21T10:50Z'), K('2026-10-21T16:50Z'), K('2026-10-22T10:50Z')].join(), missed);
const caseOf = slot => db.prepare(`SELECT * FROM ops_exception WHERE dedupe_key = ?`).get(K(slot));
const S2c = caseOf('2026-10-21T16:50Z');
// A human resolves and then reopens S2 (events as cases.js writes them).
const ev = (id, type) => db.prepare(`INSERT INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key) VALUES ('exception', ?, ?, 'founder@example.test', 'access_jwt', ?, ?)`)
  .run(String(id), type, iso(NOW), `act:test-${type}-${id}`);
db.prepare(`UPDATE ops_exception SET status = 'resolved', resolution = 'transient', resolved_by = 'founder@example.test', resolved_at = ? WHERE exception_id = ?`).run(iso(NOW), S2c.exception_id); ev(S2c.exception_id, 'resolved');
db.prepare(`UPDATE ops_exception SET status = 'open', resolution = NULL, resolved_by = NULL, resolved_at = NULL WHERE exception_id = ?`).run(S2c.exception_id); ev(S2c.exception_id, 'reopened');
// Replayed runs (outbox) now match all three slots.
const rS1 = run('local.entities-enrich-boost', 'boost-local', Date.parse('2026-10-21T13:00:00Z'), { attempted: 10, progressed: 10, detail: { slot: '2026-10-21T10:50Z' } });
run('local.entities-enrich-boost', 'boost-local', Date.parse('2026-10-21T19:00:00Z'), { attempted: 10, progressed: 10, detail: { slot: '2026-10-21T16:50Z' } });
const rS3 = run('local.entities-enrich-boost', 'boost-local', Date.parse('2026-10-22T13:00:00Z'), { attempted: 10, progressed: 10, detail: { slot: '2026-10-22T10:50Z' } });
// Out of window: a job_missed case for a slot older than the lookback.
db.prepare(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, job_id, raised_by, raised_via, dedupe_key)
            VALUES ('EXC-S-00000000OLD1', 'job_missed', 'sev3', 'open', 'old', 'local.entities-enrich-boost', 'service:health-check-local', 'ingest_auto', ?)`).run(K('2026-09-01T10:50Z'));
const evN = () => n(`SELECT COUNT(*) n FROM ops_case_event`);
const e0 = evN();
const c2 = await sweep({ ...baseEnv, OPS_SWEEP_AUTORESOLVE: 'false' });
check('[AC-11] with OPS_SWEEP_AUTORESOLVE="false": no case changes, 0 events', cases('job_missed').every(c => c.status === 'open') && evN() === e0 && c2.body.auto_resolved.length === 0, c2.body);
const c2b = await sweep();                      // switch absent → off (only exactly "true" enables)
check('[switch] OPS_SWEEP_AUTORESOLVE absent → off', cases('job_missed').every(c => c.status === 'open') && evN() === e0, c2b.body.auto_resolved);
const c3 = await sweep({ ...baseEnv, OPS_SWEEP_AUTORESOLVE: 'true' });
const S1c = caseOf('2026-10-21T10:50Z'), S3c = caseOf('2026-10-22T10:50Z');
const arEv = db.prepare(`SELECT * FROM ops_case_event WHERE event_type = 'auto_resolved' ORDER BY event_id`).all();
check('[AC-11] "true": the replayed cases are resolved, resolution replayed, resolved_by service:health-check-local', S1c.status === 'resolved' && S1c.resolution === 'replayed'
  && S1c.resolved_by === 'service:health-check-local' && S3c.status === 'resolved' && c3.body.auto_resolved.length === 2, { S1c, S3c, ar: c3.body.auto_resolved });
check('[AC-11] exactly 1 auto_resolved event per case, naming the matched run; actor_source ingest_key; key autoresolve:<case_ref>:<now>',
  arEv.length === 2 && arEv.every(e => e.actor_source === 'ingest_key' && /^autoresolve:EXC-S-[0-9A-F]+:\d{4}-/.test(e.idempotency_key))
  && JSON.parse(arEv.find(e => e.subject_id === String(S1c.exception_id)).payload).run_id === rS1 && JSON.parse(arEv.find(e => e.subject_id === String(S3c.exception_id)).payload).run_id === rS3, arEv);
check('[AC-11] the reopened case is untouched and counted in autoresolve_skipped_reopened (A3-3(b))', caseOf('2026-10-21T16:50Z').status === 'open' && c3.body.autoresolve_skipped_reopened === 1, c3.body);
check('[§9.4] a slot outside the lookback window is never auto-resolved', db.prepare(`SELECT status FROM ops_exception WHERE case_ref = 'EXC-S-00000000OLD1'`).get().status === 'open', null);
const e3 = evN(), x3 = JSON.stringify(cases('job_missed'));
const c4 = await sweep({ ...baseEnv, OPS_SWEEP_AUTORESOLVE: 'true' });
check('[AC-11] a repeat sweep writes 0 (no event, no row change); the reopened case is skipped again', evN() === e3 && JSON.stringify(cases('job_missed')) === x3
  && c4.body.auto_resolved.length === 0 && c4.body.autoresolve_skipped_reopened === 1, c4.body);
const orphan = n(`SELECT COUNT(*) n FROM ops_exception x WHERE x.resolution = 'replayed' AND NOT EXISTS (SELECT 1 FROM ops_case_event e WHERE e.subject_type = 'exception'
                   AND e.subject_id = CAST(x.exception_id AS TEXT) AND e.event_type = 'auto_resolved' AND e.occurred_at = x.updated_at)`);
check('[§8.4] every auto-resolved case has its event at the same :now', orphan === 0, orphan);

// ================= (D) caps: auto-resolve ≤ 20 per call, counted apart from raises ========================
NOW = Date.parse('2026-10-22T23:30:00Z');
freshDb();
register('local.cap-test', 'local_schedule', 'cap-local', { schedule: JSON.stringify({ kind: 'launchd_calendar', tz: 'UTC',
  entries: Array.from({ length: 24 }, (_, h) => ({ hour: h, minute: 0 })), on_time_tol_s: 60, grace_s: 600, observed_since: '2026-10-22T00:00:00Z' }) });
for (let h = 0; h < 22; h++) {
  const slot = `2026-10-22T${String(h).padStart(2, '0')}:00Z`;
  db.prepare(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, job_id, raised_by, raised_via, dedupe_key)
              VALUES (?, 'job_missed', 'sev3', 'open', 't', 'local.cap-test', 'service:health-check-local', 'ingest_auto', ?)`).run(`EXC-S-${String(h).padStart(12, '0')}`, `job_missed:local.cap-test:${slot}`);
  run('local.cap-test', 'cap-local', Date.parse(`${slot.slice(0, -1)}:00Z`) + 20000, { attempted: 1, progressed: 1, detail: { slot } });
}
run('local.cap-test', 'cap-local', Date.parse('2026-10-22T22:00:20Z'), { attempted: 1, progressed: 1 });
run('local.cap-test', 'cap-local', Date.parse('2026-10-22T23:00:20Z'), { attempted: 1, progressed: 1 });
const d1 = await sweep({ ...baseEnv, OPS_SWEEP_AUTORESOLVE: 'true', OPS_SWEEP_DAILY_RAISE_CAP: '1' }, 1);
check('[cap] 22 replayed job_missed cases: ≤ 20 auto-resolved per call; the other 2 stay open', d1.body.auto_resolved.length === 20
  && n(`SELECT COUNT(*) n FROM ops_exception WHERE exception_type = 'job_missed' AND status = 'open'`) === 2, { ar: d1.body.auto_resolved.length });
check('[cap] auto-resolves are counted apart from raises (a daily raise cap of 1 does not limit them)', d1.body.daily_cap === 1 && d1.body.auto_resolved.length === 20, d1.body.daily_cap);
const d2 = await sweep({ ...baseEnv, OPS_SWEEP_AUTORESOLVE: 'true' }, 1);
check('[cap] the next call resolves the remaining 2', d2.body.auto_resolved.length === 2 && n(`SELECT COUNT(*) n FROM ops_exception WHERE exception_type = 'job_missed' AND status = 'open'`) === 0, d2.body.auto_resolved.length);
check('[budget] sweep rows_read ≤ 1,000 with 22 candidates', d1.body.rows_read <= 1000 && d2.body.rows_read <= 1000, [d1.body.rows_read, d2.body.rows_read]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
