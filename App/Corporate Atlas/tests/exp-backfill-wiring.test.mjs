// MA-NOV-EXP.BFS.BUILD — B8 (Phase 1 unchanged; isolation; /run never back-fills; ≤ 5 fetches per 06:00 invocation)
// and B9 (every expbf heartbeat shape accepted by the REAL meridian-ops ingest route, i.e. its validateRunEvent).
// Runs the real entities-enrich.js scheduled()/fetch() over the shared node:sqlite fixture; fetch is stubbed:
// d1-today → a fixed U, run-event → App/Ops/src/ops-api.js (its own node:sqlite Ops DB). 0 network, 0 D1.
// Run: node --test "App/Corporate Atlas/tests/exp-backfill-wiring.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { makeDb, enable, d1, EXPBF_JOB_ID } from './exp-backfill-fixture.mjs';

const rd = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');

let NOW = Date.parse('2026-11-24T06:00:20Z');   // Tuesday
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } };

const worker = (await import(new URL('../src/entities-enrich.js', import.meta.url).href)).default;
const BF = await import(new URL('../src/exp-backfill.js', import.meta.url).href);
const { default: ops } = await import(new URL('../../Ops/src/ops-api.js', import.meta.url).href);

// ── Ops side: real ingest over its own DB (registry as loaded live + the expbf row BFS.OPS will add) ─────────────
const KEY = 'k-enrich-test-0001';
const opsDb = new DatabaseSync(':memory:');
opsDb.exec(rd('../../Ops/migrations/002-ops-control-plane.sql'));
opsDb.exec(rd('../../Ops/migrations/003-ops-job-pause.sql'));
opsDb.exec(rd('../../Ops/migrations/004-ops-cases.sql'));
opsDb.exec(`CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE entity_enrichment_queue (entity_id INTEGER PRIMARY KEY, name TEXT, status TEXT NOT NULL DEFAULT 'pending', retry_after TEXT, last_attempt TEXT, lookup_method TEXT);
            INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, notes)
            VALUES ('ops.ingest','Ops ingest global switch','Ops','Operations Lead','control',NULL,'control');
            INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, source_path, emitter_id, expected_max_duration_s)
            VALUES ('local.entities-enrich-boost','boost','Entities','Data-Identity Lead','local_schedule','x','boost-local',120);`);
opsDb.exec(rd('../../Ops/migrations/registry-load-2026-10-12.sql'));
opsDb.exec(`UPDATE ops_job_registry SET emitter_id = 'entities-enrich-cf' WHERE job_id LIKE 'cf.meridian-entities-enrich.%'`);
opsDb.prepare(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, worker_name, source_path, intended_schedule, emitter_id,
                 expected_max_duration_s, kill_switch_ref, write_budget_profile)
               VALUES (?, 'meridian-entities-enrich (exposure back-fill, 06:00 after Phase 1, Tue–Sat)', 'Entities', 'Data-Identity Lead', 'cron',
                 'meridian-entities-enrich', 'App/Corporate Atlas/src/exp-backfill.js', ?, 'entities-enrich-cf', 900,
                 'ops_job_pause (job) + hold_all_jobs', '{"daily_rows_written_cap":40000}')`)
     .run(EXPBF_JOB_ID, JSON.stringify({ kind: 'cf_cron', exprs: ['0 6 * * *'], tz: 'UTC', on_time_tol_s: 600, grace_s: 3600 }));
function opsStmt(sql, args = []) {
  const exec = () => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql)
    ? (r => ({ results: [], meta: { changes: Number(r.changes), rows_read: 0 } }))(opsDb.prepare(sql).run(...args))
    : (rs => ({ results: rs, meta: { rows_read: rs.length } }))(opsDb.prepare(sql).all(...args));
  return { bind: (...a) => opsStmt(sql, a), async all() { return exec(); }, async first() { return exec().results[0] ?? null; }, async run() { return exec(); }, execSync: exec };
}
const OPS_DB = { prepare: s => opsStmt(s), async batch(ss) { opsDb.exec('BEGIN'); try { const o = ss.map(s => s.execSync()); opsDb.exec('COMMIT'); return o; } catch (e) { opsDb.exec('ROLLBACK'); throw e; } } };
const opsEnv = { DB: OPS_DB, OPS_INGEST_ENABLED: 'true', OPS_INGEST_KEYS: JSON.stringify({ 'entities-enrich-cf': sha(KEY) }) };

// ── Worker side ──────────────────────────────────────────────────────────────────────────────────────────────────
let fetches = [], U = 0, analyticsStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith('/api/ops/cf/d1-today')) { fetches.push({ kind: 'd1-today' }); return new Response(JSON.stringify({ ok: true, rowsWritten: U }), { status: analyticsStatus }); }
  if (u.endsWith('/api/ops/ingest/run-event')) {
    const body = JSON.parse(init.body);
    const r = await ops.fetch(new Request('https://meridian-ops.test/api/ops/ingest/run-event', { method: 'POST', headers: init.headers, body: init.body }), opsEnv, { waitUntil() {} });
    fetches.push({ kind: 'event', body, status: r.status, resp: await r.json() });
    return new Response('{}', { status: r.status });
  }
  fetches.push({ kind: 'other', url: u });
  return new Response('no network', { status: 599 });
};
const ctxOf = () => { const p = []; return { waitUntil: x => p.push(x), drain: () => Promise.allSettled(p) }; };
const wenv = DB => ({ DB, OPS_INGEST_URL: 'https://meridian-ops.test/api/ops/ingest/run-event', OPS_EMITTER: 'entities-enrich-cf',
                      OPS_INGEST_KEY: KEY, OPS_D1_TODAY_URL: 'https://meridian-ops.test/api/ops/cf/d1-today', RUN_AUTH_SECRET: 's3cret' });
const quietLogs = [];
const origLog = console.log, origErr = console.error;

function workerDb(opts = {}) {
  const db = makeDb(opts.fixture);
  db.exec(`INSERT INTO entity_enrichment_queue (entity_id, name, type_hint, status) VALUES (5001, 'x', 'operating', 'pending'), (5002, 'Nope', 'operating', 'pending')`);
  db.exec(`CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, name TEXT, normalized_name TEXT, type TEXT, lei TEXT, lei_status TEXT, country TEXT,
             direct_parent_lei TEXT, direct_parent_name TEXT, ultimate_parent_lei TEXT, ultimate_parent_name TEXT, direct_parent_exception TEXT, updated_at TEXT)`);
  return db;
}

async function fire(db, { at = '2026-11-24T06:00:20Z', cron = '0 6 * * *', dbOpts = {} } = {}) {
  NOW = Date.parse(at); fetches = [];
  const DB = d1(db, dbOpts);
  const ctx = ctxOf();
  console.log = (...a) => quietLogs.push(a.join(' ')); console.error = (...a) => quietLogs.push(a.join(' '));
  let threw = null;
  try { await worker.scheduled({ cron }, wenv(DB), ctx); } catch (e) { threw = e; }
  await ctx.drain();
  console.log = origLog; console.error = origErr;
  const ev = job => fetches.filter(f => f.kind === 'event' && f.body.job_id === job);
  return { threw, DB, fetches: fetches.slice(), p1: ev('cf.meridian-entities-enrich.phase1'), bf: ev(EXPBF_JOB_ID), p23: ev('cf.meridian-entities-enrich.phase23') };
}
const endOf = evs => evs.find(e => e.body.event !== 'start');
const accepted = evs => evs.length > 0 && evs.every(e => e.status === 201 && e.resp.ok);
const strip = b => { const { run_id, started_at, ended_at, duration_ms, ...rest } = b; return rest; };
const count = (db, t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;

// ── B8 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('B8 + B9: Tuesday 06:00, enabled → Phase 1 as before, then the back-fill; 5 fetches; every event accepted by real ingest', async () => {
  const db = workerDb(); enable(db, { cap: 40000 }); U = 1200;
  const r = await fire(db);
  assert.equal(r.threw, null);
  assert.equal(r.fetches.length, 5, JSON.stringify(r.fetches.map(f => f.kind + (f.body ? ':' + f.body.job_id + ':' + f.body.event : ''))));
  assert.equal(r.fetches.filter(f => f.kind === 'd1-today').length, 1, 'analytics fetched once (Phase 1), reused by the back-fill');
  assert.deepEqual(r.p1.map(e => e.body.event), ['start', 'success']);
  assert.deepEqual(r.bf.map(e => e.body.event), ['start', 'success']);
  assert.ok(accepted(r.p1) && accepted(r.bf), JSON.stringify([...r.p1, ...r.bf].map(e => [e.status, e.resp])));
  const order = r.fetches.filter(f => f.kind === 'event').map(f => `${f.body.job_id.split('.').pop()}:${f.body.event}`);
  assert.ok(order.indexOf('phase1:success') < order.indexOf('expbf:start'), `back-fill starts after Phase 1 ends: ${order}`);
  const m = endOf(r.bf).body.detail.metrics;
  assert.equal(m.analytics_U, 1200); assert.equal(m.budget_B, 40000); assert.ok(m.batches >= 6 && m.rows_written > 0);
  assert.equal(endOf(r.bf).body.rows_written, m.rows_written);
  assert.ok(count(db, 'fund_exposure_coverage') > 0);
  const stored = opsDb.prepare(`SELECT event_type, detail FROM ops_job_run WHERE job_id = ? AND phase = 'end' ORDER BY event_id DESC LIMIT 1`).get(EXPBF_JOB_ID);
  assert.equal(stored.event_type, 'success'); assert.equal(Object.keys(JSON.parse(stored.detail).metrics).length, 11);
});

test('B8: a back-fill exception never changes Phase 1 — controls unreadable, or a D1 error inside the batch', async () => {
  const base = workerDb(); U = 1200;              // reference: back-fill not enabled
  const ref = await fire(base);
  assert.equal(ref.fetches.length, 3, 'not enabled → 0 back-fill fetches');
  assert.equal(ref.bf.length, 0);

  const a = workerDb(); a.exec('DROP TABLE ops_job_pause');
  const ra = await fire(a);
  assert.equal(ra.threw, null, 'scheduled() does not throw');
  assert.deepEqual(strip(endOf(ra.p1).body), strip(endOf(ref.p1).body), 'Phase 1 end event identical');
  assert.equal(ra.bf.length, 0);

  const b = workerDb(); enable(b);
  const rb = await fire(b, { dbOpts: { failOn: sql => /INTO fund_exposure_coverage/.test(sql) } });
  assert.equal(rb.threw, null);
  assert.deepEqual(strip(endOf(rb.p1).body), strip(endOf(ref.p1).body));
  assert.equal(endOf(rb.bf).body.event, 'failed'); assert.equal(endOf(rb.bf).body.error.class, 'EXPBF_D1_ERROR');
  assert.ok(accepted(rb.bf), 'failed event accepted (B9)');
  assert.equal(count(b, 'entity_exposure_monthly') + count(b, 'fund_exposure_coverage'), 0);
  assert.ok(rb.fetches.length <= 5);
});

test('B8 + B9: hold, Phase 1 budget skip, analytics unavailable, Sunday, Monday, pause → skipped(reason) accepted; 0 writes; ≤ 5 fetches', async () => {
  const cases = [
    ['hold', db => db.exec(`UPDATE holdings_pipeline_state SET value = 'true' WHERE key = 'hold_all_jobs'`), {}, 'hold'],
    ['budget', () => { U = 58000; }, {}, 'budget'],
    ['budget', () => { analyticsStatus = 500; }, {}, 'success'],
    ['out_of_window', () => {}, { at: '2026-11-22T06:00:20Z' }, 'success'],
    ['out_of_window', () => {}, { at: '2026-11-23T06:00:20Z' }, 'success'],
    ['pause', db => enable(db, { registry: false, paused: true }), {}, 'success'],
  ];
  for (const [reason, prep, opts, p1Event] of cases) {
    const db = workerDb(); enable(db); U = 1200; analyticsStatus = 200; prep(db);
    const r = await fire(db, opts);
    analyticsStatus = 200;
    assert.equal(r.threw, null, reason);
    assert.ok(r.fetches.length <= 5, `${reason}: ${r.fetches.length} fetches`);
    assert.equal(endOf(r.p1).body.event, p1Event === 'success' ? 'success' : 'skipped', reason);
    if (p1Event !== 'success') assert.equal(endOf(r.p1).body.detail.reason, p1Event);
    assert.equal(endOf(r.bf).body.event, 'skipped', reason); assert.equal(endOf(r.bf).body.detail.reason, reason, `${reason} ${JSON.stringify(opts)}`);
    assert.ok(accepted(r.bf), `${reason}: ${JSON.stringify(r.bf.map(e => e.resp))}`);
    assert.equal(count(db, 'entity_exposure_monthly') + count(db, 'fund_exposure_coverage'), 0, reason);
    assert.ok(!r.DB.log.some(x => /INTO (entity_exposure_monthly|fund_exposure_coverage)/.test(x.sql)), reason);
  }
});

test('B9: partial, empty_input and overrun-failed end events are accepted by the real ingest route', async () => {
  let db = workerDb(); enable(db, { cap: 300 }); U = 0;
  let r = await fire(db);
  assert.equal(endOf(r.bf).body.event, 'partial'); assert.ok(accepted(r.bf));
  db = workerDb(); enable(db);
  await fire(db);
  r = await fire(db, { at: '2026-11-25T06:00:20Z' });
  assert.equal(endOf(r.bf).body.event, 'skipped'); assert.equal(endOf(r.bf).body.detail.reason, 'empty_input'); assert.ok(accepted(r.bf));
  db = workerDb(); enable(db);
  r = await fire(db, { dbOpts: { meta: (sql, m) => { if (/INTO entity_exposure_monthly/.test(sql)) m.rows_written = m.changes * 9; } } });
  assert.equal(endOf(r.bf).body.event, 'failed'); assert.equal(endOf(r.bf).body.error.class, 'EXPBF_BUDGET_OVERRUN'); assert.ok(accepted(r.bf));
});

test('B8: the 06:50 firing (Phase 2+3) never runs the back-fill', async () => {
  const db = workerDb(); enable(db);
  const r = await fire(db, { at: '2026-11-24T06:50:20Z', cron: '50 6 * * *' });
  assert.equal(r.threw, null);
  assert.equal(r.bf.length, 0);
  assert.ok(!r.DB.log.some(x => /ops_job_pause|fund_exposure_coverage/.test(x.sql)));
  assert.equal(endOf(r.p23).body.job_id, 'cf.meridian-entities-enrich.phase23');
});

test('B8: /run (boost, manual) never runs the back-fill', async () => {
  const db = workerDb(); enable(db); NOW = Date.parse('2026-11-24T10:20:00Z'); fetches = [];
  const DB = d1(db); const ctx = ctxOf();
  console.log = () => {}; console.error = () => {};
  const res = await worker.fetch(new Request('https://enrich.test/run', { method: 'POST', headers: { 'X-Enrich-Run-Secret': 's3cret' } }), wenv(DB), ctx);
  await ctx.drain();
  console.log = origLog; console.error = origErr;
  assert.equal(res.status, 200);
  assert.ok(DB.log.some(x => /entity_enrichment_queue/.test(x.sql)), 'Phase 1 ran');
  assert.ok(!DB.log.some(x => /ops_job_pause|fund_exposure_coverage|entity_exposure_monthly/.test(x.sql)));
  assert.equal(fetches.filter(f => f.kind === 'event').length, 0);
});

test('B8 static: back-fill called only in scheduled() under isPhase1; fetch() has no back-fill; Phase 1/2/3 bodies unchanged', () => {
  const src = rd('../src/entities-enrich.js');
  const sched = src.slice(src.indexOf('async scheduled('), src.indexOf('async fetch(request'));
  const fetchBody = src.slice(src.indexOf('async fetch(request, env, ctx)'), src.indexOf('// MA-OCT-002b B2: Phase 2+3 end event'));
  assert.equal((sched.match(/runExpBackfillStep\(/g) || []).length, 3);
  assert.equal((sched.match(/if \(isPhase1\) await runExpBackfillStep\(/g) || []).length, 3);
  assert.doesNotMatch(fetchBody, /ExpBackfill|exp-backfill/);
  assert.equal((src.match(/runExpBackfillStep\(/g) || []).length, 3, 'the 3 calls in scheduled() are the only calls');
  assert.match(src, /^import \{ runExpBackfillStep \} from '\.\/exp-backfill\.js';/m);
  // Phase functions byte-identical to the pinned blob 3221d198 (MA-NOV-EXP.BFS.BUILD Task pin) when git is available.
  let pinned = null;
  try { pinned = execFileSync('git', ['cat-file', 'blob', '3221d1980c8e645819d1cd0975083a8ea82b45d1'], { cwd: new URL('.', import.meta.url), encoding: 'utf8' }); } catch { /* no git: skip */ }
  const fn = (s, name) => { const i = s.indexOf(`async function ${name}(`); return s.slice(i, s.indexOf('\n}\n', i)); };
  if (pinned) for (const name of ['runPhase1', 'runPhase2', 'runPhase3', 'persistCombinedSubrequestCount', 'checkHold'])
    assert.equal(fn(src, name), fn(pinned, name), `${name} unchanged`);
  assert.ok(fn(src, 'runPhase3').includes('const SUBREQUEST_CHECKPOINT = 43;'));
});
