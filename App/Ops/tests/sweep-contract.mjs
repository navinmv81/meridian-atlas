#!/usr/bin/env node
// MA-OCT-002a A3 — contract test for POST /api/ops/ingest/sweep (spec 002 rev 1.3 §7.2–§7.3, R-E, B-1;
// test plan §19.3 step 2: auth, switches, caps, dedupe). Runs the REAL ops-api.js handler in Node on an
// in-memory SQLite D1 (real 002/003 migrations + the real A1 registry load), with Cloudflare analytics
// stubbed. No network, no remote D1.   Usage: node App/Ops/tests/sweep-contract.mjs

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };
const sha = s => createHash('sha256').update(s).digest('hex');

// Fixed clock: Mon 19 Oct 2026 12:00Z (a Monday, so the Sunday writes check runs).
const NOW = Date.parse('2026-10-19T12:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } };

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(read('migrations/002-ops-control-plane.sql'));
  db.exec(read('migrations/003-ops-job-pause.sql'));
  db.exec(`CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
           INSERT INTO holdings_pipeline_state VALUES ('hold_all_jobs','false'), ('etf_offset','71'), ('last_run_status','running:71/237:partial:0'),
                                                      ('writes_today_2026-10-18','76012');`);
  db.exec(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, notes)
           VALUES ('ops.ingest','Ops ingest global switch','Ops','Operations Lead','control',NULL,'control');
           INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, source_path, emitter_id, expected_max_duration_s)
           VALUES ('local.entities-enrich-boost','boost','Entities','Data-Identity Lead','local_schedule','x','boost-local',120);`);
  db.exec(read('migrations/registry-load-2026-10-12.sql'));
  // A3 registry update (as registry-sync will generate it): health-check emitter + 4 slots, observed since 18 Oct.
  db.prepare(`UPDATE ops_job_registry SET emitter_id = 'health-check-local', intended_schedule = ? WHERE job_id = 'local.health-check'`)
    .run(JSON.stringify({ kind: 'launchd_calendar', tz: 'Europe/London', entries: [8, 12, 18, 22].map(h => ({ hour: h, minute: 0 })), on_time_tol_s: 900, grace_s: 28800, observed_since: '2026-10-18T00:00:00Z' }));
  return db;
}
let db = freshDb();
// D1 mock over node:sqlite: reads via .all(), writes via .run() (meta.changes); batch() runs in order.
function stmt(sql, args = []) {
  const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
  return {
    bind: (...a) => stmt(sql, a),
    async all() { const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes) } }; },
    exec() { return isWrite ? this.run() : this.all(); }
  };
}
const DB = { prepare: sql => stmt(sql), batch: async ss => { const out = []; for (const st of ss) out.push(await st.exec()); return out; } };

// Stub Cloudflare analytics (d1Totals → GraphQL).
let analyticsWritten = 1234;
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).startsWith('https://api.cloudflare.com/client/v4/graphql')
  ? new Response(JSON.stringify({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { readQueries: 1, writeQueries: 1, rowsRead: 10, rowsWritten: analyticsWritten } }] }] } } }), { status: 200 })
  : realFetch(u, o);

const KEY_HC = 'test-hc-key-0001', KEY_BOOST = 'test-boost-key-0001';
const { default: worker } = await import('../src/ops-api.js');
const baseEnv = { DB, OPS_INGEST_ENABLED: 'true', OPS_SWEEP_ENABLED: 'true', OPS_SWEEP_DAILY_RAISE_CAP: '100', CF_ACCOUNT_TAG: 'acct', CF_ANALYTICS_TOKEN: 'x',
                  OPS_INGEST_KEYS: JSON.stringify({ 'health-check-local': sha(KEY_HC), 'boost-local': sha(KEY_BOOST) }) };
let runN = 0;
async function sweepCall({ emitter = 'health-check-local', key = KEY_HC, env = baseEnv, body } = {}) {
  const b = body ?? { v: 1, run_id: `00000000-0000-4000-8000-${String(++runN).padStart(12, '0')}`, lookback_days: 14 };
  const headers = { 'Content-Type': 'application/json' };
  if (emitter) headers['X-Ops-Emitter'] = emitter;
  if (key) headers['X-Ops-Ingest-Key'] = key;
  const resp = await worker.fetch(new Request('https://meridian-ops.test/api/ops/ingest/sweep', { method: 'POST', headers, body: JSON.stringify(b) }), env, { waitUntil() {} });
  return { status: resp.status, body: await resp.json(), acao: resp.headers.get('access-control-allow-origin') };
}
const count = (sql, ...a) => db.prepare(sql).get(...a).n;

// --- auth ----------------------------------------------------------------------
check('[auth] no key → 401', (await sweepCall({ emitter: null, key: null })).status === 401, null);
check('[auth] wrong key → 401', (await sweepCall({ key: 'nope' })).status === 401, null);
const other = await sweepCall({ emitter: 'boost-local', key: KEY_BOOST });
check('[auth] another emitter\'s valid key → 403 (sweep is bound to local.health-check)', other.status === 403, other);
check('[auth] 0 exceptions written by rejected calls', count(`SELECT COUNT(*) n FROM ops_exception`) === 0, null);

// --- switches ------------------------------------------------------------------
const hard = await sweepCall({ env: { ...baseEnv, OPS_SWEEP_ENABLED: 'false' } });
check('[switch] OPS_SWEEP_ENABLED=false → 202 sweep_disabled', hard.status === 202 && hard.body.reason === 'sweep_disabled', hard.body);
db.exec(`UPDATE ops_job_registry SET ingest_enabled = 0 WHERE job_id = 'ops.ingest'`);
const glob = await sweepCall();
db.exec(`UPDATE ops_job_registry SET ingest_enabled = 1 WHERE job_id = 'ops.ingest'; UPDATE ops_job_registry SET ingest_enabled = 0 WHERE job_id = 'local.health-check'`);
const job = await sweepCall();
db.exec(`UPDATE ops_job_registry SET ingest_enabled = 1 WHERE job_id = 'local.health-check'`);
check('[switch] global ingest off → 202 ingest_disabled', glob.status === 202 && glob.body.reason === 'ingest_disabled', glob.body);
check('[switch] per-job (local.health-check) off → 202 job_ingest_disabled', job.status === 202 && job.body.reason === 'job_ingest_disabled', job.body);
check('[switch] 0 exceptions written while switched off', count(`SELECT COUNT(*) n FROM ops_exception`) === 0, null);
check('[body] v != 1 → 400', (await sweepCall({ body: { v: 2, run_id: 'x1' } })).status === 400, null);

// --- first sweep: real findings from the registry state ----------------------------
// No runs at all: the boost (emitter, observed from the start) misses all 14 slots of 12–19 Oct;
// the health-check's own slots since 18 Oct are missed too; Sunday 18 Oct writes 76,012 → budget_risk sev3.
const s1 = await sweepCall();
check('[sweep 1] 200, no CORS, rows_read reported and ≤ 1,000', s1.status === 200 && s1.acao === null && s1.body.rows_read > 0 && s1.body.rows_read <= 1000, s1.body);
check('[sweep 1] stops at 20 raises per call, the 20th being one sweep_overflow (sev2)',
  s1.body.raised === 20 && s1.body.new.filter(n => n.type === 'sweep_overflow').length === 1 && count(`SELECT COUNT(*) n FROM ops_exception`) === 20, { raised: s1.body.raised, findings: s1.body.findings, overflow: s1.body.overflow });
check('[sweep 1] severity-first: the budget_risk (Sunday ≥ 75k) is raised', s1.body.new.some(n => n.type === 'budget_risk' && n.severity === 'sev3'), s1.body.new.map(n => n.type));
check('[sweep 1] case_ref = EXC-S- + first 12 hex of SHA-256(dedupe_key)',
  db.prepare(`SELECT case_ref, dedupe_key FROM ops_exception`).all().every(r => r.case_ref === 'EXC-S-' + sha(r.dedupe_key).slice(0, 12).toUpperCase()), null);
check('[sweep 1] one audit row per raise (raised:<dedupe_key>, actor service:health-check-local, ingest_key)',
  count(`SELECT COUNT(*) n FROM ops_case_event WHERE event_type = 'raised' AND actor = 'service:health-check-local' AND actor_source = 'ingest_key' AND idempotency_key LIKE 'raised:%'`) === 20, null);
check('[sweep 1] job_missed dedupe keys are job_missed:<job_id>:<slot>; boost sev3; owner_role filled',
  db.prepare(`SELECT dedupe_key, severity, owner_role FROM ops_exception WHERE exception_type = 'job_missed' LIMIT 3`).all().every(r => /^job_missed:local\.(entities-enrich-boost|health-check):2026-10-\d\dT\d\d:\d\dZ$/.test(r.dedupe_key) && r.severity === 'sev3' && r.owner_role), null);
check('[sweep 1] ETF (c) pass-cycle figures reported', s1.body.etf.offset === 71 && s1.body.etf.total === 237 && s1.body.etf.weeks_to_complete === 9 && s1.body.etf.sunday_writes === 76012, s1.body.etf);
check('[sweep 1] headroom from analytics; open_counts returned', s1.body.headroom.headroom === 100000 - 1234 && s1.body.open_counts.sev2 >= 1, s1.body);

// --- second sweep: dedupe → only not-yet-raised findings; repeated ones are silent ---------
const before2 = count(`SELECT COUNT(*) n FROM ops_exception`);
const s2 = await sweepCall();
check('[sweep 2] already-raised findings are not raised again (already_open counted)', s2.body.already_open >= 19 && s2.body.new.every(n => !s1.body.new.some(m => m.case_ref === n.case_ref)), s2.body);
check('[sweep 2] remaining backlog continues to raise within the cap', s2.body.raised <= 20 && count(`SELECT COUNT(*) n FROM ops_exception`) === before2 + s2.body.raised, s2.body);
// Drain the backlog, then a further sweep raises 0 new.
let s; for (let i = 0; i < 5; i++) { s = await sweepCall(); if (s.body.raised === 0) break; }
const sN = await sweepCall();
check('[dedupe] once everything is raised, a further sweep raises 0 new (AC-a3 "second sweep raises 0 new")', sN.body.raised === 0 && sN.body.new.length === 0, sN.body);
check('[dedupe] audit rows = exceptions (one per finding, not per sweep)', count(`SELECT COUNT(*) n FROM ops_case_event WHERE event_type='raised'`) === count(`SELECT COUNT(*) n FROM ops_exception`), null);

// --- hold + headroom findings (fresh DB) -----------------------------------------
db = freshDb();
db.exec(`UPDATE holdings_pipeline_state SET value = 'true' WHERE key = 'hold_all_jobs'; DELETE FROM holdings_pipeline_state WHERE key LIKE 'writes_today_%'`);
db.exec(`UPDATE ops_job_registry SET emitter_id = NULL WHERE job_id = 'local.entities-enrich-boost'`);   // isolate platform findings
analyticsWritten = 96500;
const sh = await sweepCall();
const types = sh.body.new.map(n => `${n.type}/${n.severity}`).sort();
check('[platform] hold_all_jobs=true → hold_active sev2; headroom 3,500 < 5,000 → budget_risk sev1 (raised first)',
  types.includes('hold_active/sev2') && types.includes('budget_risk/sev1') && sh.body.new[0].severity === 'sev1' && sh.body.hold_all_jobs === true, sh.body.new);

// --- daily cap (B-1): today's health-check end events carry detail.metrics.raised ----
db = freshDb();
db.prepare(`INSERT INTO ops_job_run (run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, detail, end_only, contract_version)
            VALUES ('hc-today', 'end', 'success', 'local.health-check', 'health-check-local', 'launchd', '2026-10-19T07:00:05Z', '2026-10-19T07:00:09Z', ?, 1, 1)`)
  .run(JSON.stringify({ metrics: { raised: 95 } }));
const sd = await sweepCall();
check('[daily cap] 95 already raised today → this call raises at most 5 (cap 100), counted from L2 with 0 extra reads',
  sd.body.raised_today_before === 95 && sd.body.raised <= 5 && sd.body.raised >= 1, { before: sd.body.raised_today_before, raised: sd.body.raised });

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
