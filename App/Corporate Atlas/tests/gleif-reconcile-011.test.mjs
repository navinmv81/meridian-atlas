// MA-OCT-011 runner, plan and gate tests. Local only: 0 D1 calls, 0 GLEIF calls.
//   node --test --no-warnings "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"
// Needs ~/MeridianAtlas-work/gleif-006 (read-only) for the plan / replica tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { LIMITS, calendarCheck, fetchD1Today, headroomDecision, loadFreezes, renderStatement, readJsonl, sha256File, workPaths, RUN_TS } from '../lib/gleif-reconcile-011-core.mjs';
import { makeContext, cmdRun, cmdRestore, cmdExplain, buildReplica, loadPlan, diffBatch } from '../scripts/gleif-reconcile-011.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORP = path.resolve(HERE, '..');
const REPO = path.resolve(CORP, '..', '..');
const FREEZES = loadFreezes(path.join(REPO, 'claude', 'relays', 'FREEZES.json'));
const at = s => new Date(s);
const tmp = () => mkdtempSync(path.join(tmpdir(), 'g011-'));

// ── Calendar and freezes (§4.4, F-3) ─────────────────────────────────────

test('calendar: Sunday, Monday < 08:00, enrich, bootstrap, boost, midnight, ENT-CR1 are refused', () => {
  const no = s => assert.equal(calendarCheck(at(s), FREEZES).ok, false, s);
  const yes = s => assert.equal(calendarCheck(at(s), FREEZES).ok, true, s);
  no('2026-10-18T09:00:00Z');            // Sunday
  no('2026-10-19T07:30:00Z');            // Monday before 08:00
  no('2026-10-19T08:02:00Z');            // bootstrap buffer 07:55–08:05
  yes('2026-10-19T08:06:00Z');           // Monday after the buffer
  no('2026-10-20T06:00:00Z');            // enrich 05:50–07:10 (and outside run windows)
  no('2026-10-20T10:50:00Z');            // boost AM band
  no('2026-10-20T16:50:00Z');            // boost PM band
  no('2026-10-20T21:30:00Z');            // after the last run window
  no('2026-10-20T23:55:00Z');            // F-3 midnight
  no('2026-10-13T09:00:00Z');            // ENT-CR1 dated freeze
  no('2026-10-14T09:00:00Z');            // ENT-CR1 fallback window
  yes('2026-10-17T08:30:00Z');           // Sat 17: the "011 run window" freeze applies to the other writers, not to 011
  yes('2026-10-21T11:20:00Z');
});

test('calendar: missing FREEZES.json fails closed', () => {
  assert.equal(calendarCheck(at('2026-10-20T09:00:00Z'), null).ok, false);
});

// ── Headroom gate (§4.3, F-1, F-2, ML-1012-1) ────────────────────────────

const own0 = { todayWrites: 0, rowsSince: () => 0 };
const rd = (rows, now, date = now.toISOString().slice(0, 10)) => ({ rowsWritten: rows, date, fetchedAt: now.toISOString() });

test('headroom: unavailable / wrong date / stale fetch / falling reading fail closed', () => {
  const now = at('2026-10-20T09:00:00Z');
  let d = headroomDecision({ reading: null, fetchError: 'x', now, batchWrites: 1000, own: own0 });
  assert.equal(d.outcome, 'headroom_unavailable');
  d = headroomDecision({ reading: rd(100, now, '2026-10-19'), now, batchWrites: 1000, own: own0 });
  assert.equal(d.outcome, 'headroom_unavailable');
  d = headroomDecision({ reading: { ...rd(100, now), fetchedAt: '2026-10-20T08:57:59Z' }, now, batchWrites: 1000, own: own0 });
  assert.equal(d.outcome, 'headroom_unavailable', '> 120 s old');
  d = headroomDecision({ reading: rd(5000, now), now, state: { date: '2026-10-20', lastRowsWritten: 6000, lastFetchAt: '2026-10-20T08:50:00Z' }, batchWrites: 1000, own: own0 });
  assert.equal(d.outcome, 'headroom_unavailable', 'F-2');
  assert.match(d.detail, /F-2/);
});

test('headroom: 60k account ceiling (ML-1012-1), 25k own cap, F-1 window', () => {
  const now = at('2026-10-20T09:00:00Z');
  assert.equal(LIMITS.accountCeiling, 60000);
  assert.equal(headroomDecision({ reading: rd(58000, now), now, batchWrites: 1500, own: own0 }).ok, true);
  assert.equal(headroomDecision({ reading: rd(58000, now), now, batchWrites: 2001, own: own0 }).outcome, 'budget_limit');
  // F-1: own unpolled rows count against the account ceiling
  let asked = null;
  const own = { todayWrites: 0, rowsSince: ms => { asked = ms; return 1500; } };
  assert.equal(headroomDecision({ reading: rd(58000, now), now, batchWrites: 600, own }).outcome, 'budget_limit');
  assert.equal(asked, 45 * 60000, 'window = 45 min when no previous fetch');
  headroomDecision({ reading: rd(100, now), now, state: { date: '2026-10-20', lastRowsWritten: 50, lastFetchAt: '2026-10-20T07:30:00Z' }, batchWrites: 1, own });
  assert.equal(asked, 90 * 60000, 'window = time since the previous fetch when longer');
  assert.equal(headroomDecision({ reading: rd(100, now), now, batchWrites: 1001, own: { todayWrites: 24000, rowsSince: () => 0 } }).outcome, 'budget_limit');
});

test('headroom: Monday first check above 45k blocks the day', () => {
  const now = at('2026-10-19T08:10:00Z');
  const d = headroomDecision({ reading: rd(46000, now), now, batchWrites: 10, own: own0 });
  assert.equal(d.outcome, 'budget_limit');
  const later = at('2026-10-19T12:00:00Z');
  assert.equal(headroomDecision({ reading: rd(46000, later), now: later, state: d.nextState, batchWrites: 10, own: own0 }).outcome, 'budget_limit');
});

test('fetchD1Today: one retry, then fails; ok:false and bad JSON fail', async () => {
  let calls = 0;
  const now = () => at('2026-10-20T09:00:00Z');
  const okBody = { ok: true, date: '2026-10-20', rowsWritten: 123 };
  const flaky = async () => { calls++; if (calls === 1) throw new TypeError('fetch failed'); return { ok: true, status: 200, json: async () => okBody }; };
  assert.equal((await fetchD1Today({ fetchImpl: flaky, now, sleep: async () => {} })).rowsWritten, 123);
  assert.equal(calls, 2);
  await assert.rejects(fetchD1Today({ fetchImpl: async () => { throw new TypeError('x'); }, now, sleep: async () => {} }), /unavailable/);
  await assert.rejects(fetchD1Today({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }), now, sleep: async () => {} }), /not ok/);
  await assert.rejects(fetchD1Today({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }), now, sleep: async () => {} }), /unparseable/);
});

// ── Rendering ────────────────────────────────────────────────────────────

test('table check ignores string literals but catches a real foreign table', async () => {
  const { assertTables } = await import('../lib/gleif-reconcile-011-core.mjs');
  assert.doesNotThrow(() => assertTables("UPDATE entity_master SET name = 'Away From Home Inc' WHERE entity_id = 1", { write: true }));
  assert.throws(() => assertTables('UPDATE fund_holdings_monthly SET x = 1', { write: true }), /unexpected table/);
  assert.throws(() => assertTables("INSERT INTO ops_job_run VALUES (1)", { write: true }), /unexpected table/);
});

test('render: CAS update, never normalized_name/type, A lei-free guard, quotes escaped', () => {
  const sql = renderStatement({ kind: 'em_update', entity_id: 7, set: { name: "O'Neil", gleif_last_updated: RUN_TS }, pre: { name: 'X1', lei: null }, lei_free: 'L1' }, 'T');
  assert.equal(sql, "UPDATE entity_master SET name = 'O''Neil', gleif_last_updated = 'T' WHERE entity_id = 7 AND name IS 'X1' AND lei IS NULL AND NOT EXISTS (SELECT 1 FROM entity_master o WHERE o.lei = 'L1')");
  assert.throws(() => renderStatement({ kind: 'em_update', entity_id: 7, set: { normalized_name: 'X' }, pre: {} }, 'T'), /may never be written/);
  assert.throws(() => renderStatement({ kind: 'em_update', entity_id: 7, set: { type: 'holding' }, pre: {} }, 'T'), /may never be written/);
});

// ── Replica-backed integration tests ─────────────────────────────────────

const HAVE_006 = existsSync(path.join(process.env.HOME, 'MeridianAtlas-work', 'gleif-006', 'gleif_006.db'));
let SHARED = null;
async function shared() {
  if (SHARED) return SHARED;
  const dir = tmp();
  const planDir = path.join(dir, 'plan');
  execFileSync(process.execPath, ['--no-warnings', path.join(CORP, 'scripts', 'gleif-reconcile-011-plan.mjs'), 'generate', '--export', 'd2', '--out', planDir, '--skip-db-hash'], { stdio: 'pipe' });
  const replica = path.join(dir, 'replica.db');
  await buildReplica(replica, 'd2');
  SHARED = { dir, planDir, replica };
  return SHARED;
}

function clock(start) {
  let t = Date.parse(start);
  const now = () => new Date(t);
  now.set = s => { t = Date.parse(s); };
  now.add = ms => { t += ms; };
  return now;
}
const d1TodayStub = (now, rows = 10000) => async () => ({ ok: true, status: 200, json: async () => ({ ok: true, date: now().toISOString().slice(0, 10), rowsWritten: rows }) });

async function freshCtx(extra = {}) {
  const s = await shared();
  const dir = tmp();
  const db = path.join(dir, 'replica.db');
  copyFileSync(s.replica, db);
  const now = extra.now || clock('2026-10-17T08:10:00Z');
  const ctx = await makeContext({ plan: s.planDir, transport: `local:${db}`, work: path.join(dir, 'work'), operator: 'test', ...(extra.args || {}) },
    { write: true, now, sleep: async () => {}, fetchImpl: extra.fetchImpl || d1TodayStub(now), ingestCfg: null,
      pauseFlag: path.join(dir, 'paused'), stopFlag: path.join(dir, 'stop'), log: () => {}, ...(extra.overrides || {}) });
  return { ctx, db, dir, now, plan: s.planDir };
}

test('item 5 — d1-today outage: 0 writes, headroom_unavailable, failed heartbeat, cursor unchanged', { skip: !HAVE_006 }, async () => {
  const { ctx, db } = await freshCtx({ args: { 'd1-today-url': 'http://127.0.0.1:9/d1-today' }, fetchImpl: fetch });
  const before = sha256File(db);
  const r = await cmdRun(ctx);
  ctx.d1.close();
  assert.equal(r.stopped, 'headroom_unavailable');
  assert.equal(sha256File(db), before, 'replica unchanged: 0 writes');
  const rl = readJsonl(ctx.paths.runlog);
  assert.equal(rl.length, 1);
  assert.equal(rl[0].outcome, 'headroom_unavailable');
  assert.equal(rl[0].writes, 0);
  assert.deepEqual(rl[0].cursor, { before: 'P-001', after: 'P-001' });
  const hb = readJsonl(ctx.paths.heartbeatLog).map(x => x.text).filter(t => t.startsWith('failed {'));
  assert.equal(hb.length, 1);
  assert.match(hb[0], /"class":"headroom_unavailable"/);
  const P = loadPlan(ctx.args.plan);
  assert.equal(readJsonl(ctx.paths.runlog).filter(x => x.outcome === 'success').length, 0);
  assert.equal(existsSync(path.join(ctx.paths.work, `cursor-${P.sha.slice(0, 16)}.json`)), false, 'no cursor written');
});

test('pause flag, kill switch and hold_all_jobs refuse with 0 writes', { skip: !HAVE_006 }, async () => {
  for (const kind of ['paused', 'killed', 'held']) {
    const { ctx, db, dir } = await freshCtx();
    if (kind === 'paused') writeFileSync(path.join(dir, 'paused'), 'x');
    if (kind === 'killed') writeFileSync(path.join(dir, 'stop'), 'x');
    if (kind === 'held') ctx.d1.db.prepare("UPDATE holdings_pipeline_state SET value='true' WHERE key='hold_all_jobs'").run();
    const before = sha256File(db);
    await cmdRun(ctx);
    ctx.d1.close();
    assert.equal(sha256File(db), before, kind);
    assert.equal(readJsonl(ctx.paths.runlog).at(-1).outcome, kind);
  }
});

test('refuses a tampered plan and a non-releasable plan on a remote transport', { skip: !HAVE_006 }, async () => {
  const s = await shared();
  const d = tmp();
  execFileSync('cp', ['-R', s.planDir, path.join(d, 'p')]);
  writeFileSync(path.join(d, 'p', 'plan.json'), readFileSync(path.join(d, 'p', 'plan.json'), 'utf8').replace('"P-001"', '"P-00X"'));
  assert.throws(() => loadPlan(path.join(d, 'p')), /does not match plan.sha256/);
  const fake = { name: 'remote-rw', exec: async () => { throw new Error('must not be called'); } };
  const ctx = await makeContext({ plan: s.planDir, work: path.join(d, 'w'), operator: 't' }, { write: true, transport: fake, ingestCfg: null, log: () => {} });
  await assert.rejects(cmdRun(ctx), /not releasable/);
});

test('race: a B row drained by Phase 3 before its batch is raced, then upgraded by the fallback CAS', { skip: !HAVE_006 }, async () => {
  const { ctx } = await freshCtx({ args: { 'max-batches': 2 } });
  const P = loadPlan(ctx.args.plan);
  const b1 = P.plan.batches.find(b => b.id === 'B-001');
  const s = b1.statements.find(x => x.fallback && 'direct_parent_exception' in x.set);
  // Simulate Phase 3: hydrate + generic marker
  ctx.d1.db.prepare("UPDATE entity_master SET lei_status='ACTIVE', direct_parent_exception='NO_LINK_DECLARED' WHERE entity_id=?").run(s.entity_id);
  await cmdRun(ctx);   // P-001, P-002
  ctx.args['max-batches'] = 1;
  await cmdRun(ctx);   // B-001 (+ fallback)
  const row = ctx.d1.db.prepare('SELECT * FROM entity_master WHERE entity_id=?').get(s.entity_id);
  ctx.d1.close();
  assert.equal(row.direct_parent_exception, s.fallback.set.direct_parent_exception);
  assert.equal(row.gleif_enrichment_version, 11);
  assert.equal(row.legal_name, null, 'Level 1 not refreshed on a drained row (RC-8)');
  const rl = readJsonl(ctx.paths.runlog);
  assert.equal(rl.find(x => x.batch === 'B-001').outcome, 'partial');
  assert.equal(rl.find(x => x.batch === 'B-001-fb').outcome, 'success');
});

test('P-3: failures BEFORE any write (e.g. 7403) are retried: two failures then success; four failures → failed, cursor unchanged', { skip: !HAVE_006 }, async () => {
  for (const [fails, want] of [[2, 'success'], [4, 'failed']]) {
    const { ctx } = await freshCtx({ args: { 'max-batches': 1 } });
    const inner = ctx.d1; let n = 0;
    ctx.d1 = { name: inner.name, db: inner.db, exec: async (sqls, o) => (sqls[0].startsWith('INSERT') && n++ < fails) ? (() => { throw new Error('code: 10000'); })() : inner.exec(sqls, o) };
    const r = await cmdRun(ctx);
    inner.close();
    const last = readJsonl(ctx.paths.runlog).at(-1);
    assert.equal(last.outcome, want);
    if (want === 'failed') { assert.equal(r.stopped, 'failed'); assert.match(last.reason, /4 failure\(s\) .* before any write/); }
    const P = loadPlan(ctx.args.plan);
    const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'P-001.json'), 'utf8'));
    assert.equal(ck.retry_log.filter(x => x.phase === 'after-failure').length, want === 'success' ? 2 : 4);
    assert.equal(ck.retry_log.filter(x => x.phase === 'before-retry').length, want === 'success' ? 2 : 3, 'B-1: a probe right before every retry');
    assert.ok(ck.retry_log.every(x => x.rows_unchanged === true), 'each retry was preceded by read-backs equal to the pre-image');
    if (want === 'failed') assert.equal(existsSync(path.join(ctx.paths.work, `cursor-${P.sha.slice(0, 16)}.json`)), false, 'cursor not advanced');
  }
});

// P-3: an ambiguous failure AFTER some or all statements were applied (the call committed,
// then the client saw an error) must NOT be retried: the batch fails, the cursor is kept,
// the checkpoint diff shows the applied rows, and restore --batch returns them.
for (const part of ['all', 'half']) {
  test(`P-3: a failure after writes (${part} of the statements applied) is not retried; failed, cursor kept, restorable`, { skip: !HAVE_006 }, async () => {
    const { ctx } = await freshCtx({ args: { 'max-batches': 1 } });
    const inner = ctx.d1; let writeCalls = 0;
    ctx.d1 = { name: inner.name, db: inner.db, exec: async (sqls, o) => {
      if (!/^\s*(UPDATE|INSERT|DELETE)/i.test(sqls[0])) return inner.exec(sqls, o);
      writeCalls++;
      await inner.exec(part === 'all' ? sqls : sqls.slice(0, Math.ceil(sqls.length / 2)), o);
      throw new Error('A request to the Cloudflare API failed [code: 7403]');
    } };
    const dump = () => inner.db.prepare('SELECT * FROM entity_master ORDER BY entity_id').all().map(r => JSON.stringify(r)).join('\n');
    const before = dump();
    const r = await cmdRun(ctx);
    assert.equal(r.stopped, 'failed');
    assert.equal(writeCalls, 1, 'no retry after writes');
    const last = readJsonl(ctx.paths.runlog).at(-1);
    assert.equal(last.outcome, 'failed'); assert.match(last.reason, /after writes: no retry \(P-3\)/);
    const P = loadPlan(ctx.args.plan);
    assert.equal(existsSync(path.join(ctx.paths.work, `cursor-${P.sha.slice(0, 16)}.json`)), false, 'cursor kept at P-001');
    const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'P-001.json'), 'utf8'));
    const applied = ck.diff.filter(d => d.status === 'applied').length;
    assert.equal(applied, part === 'all' ? 250 : 125);
    assert.equal(ck.retry_log.length, 1); assert.equal(ck.retry_log[0].rows_unchanged, false); assert.ok(ck.probe_reads > 0, 'N-2: probe reads counted');
    // the applied rows are restorable from that checkpoint
    const { restoreBatch } = await import('../scripts/gleif-reconcile-011.mjs');
    ctx.d1 = inner;
    const rr = await restoreBatch(ctx, P, { id: 'P-001', step: 'P', statements: ck.statements }, ck);
    assert.equal(rr.outcome, 'success');
    assert.equal(dump(), before, 'replica back to its pre-batch content');
    inner.close();
  });
}

test('stop condition: writes > 1.3 × declared on a measured (non-local) transport', { skip: !HAVE_006 }, async () => {
  const { ctx } = await freshCtx({ args: { 'max-batches': 1 } });
  const inner = ctx.d1;
  ctx.d1 = { name: 'local-measured', exec: async (sqls, o) => (await inner.exec(sqls, o)).map(r => ({ ...r, meta: { ...r.meta, local: undefined, rows_written: sqls[0].startsWith('INSERT') ? 100 : 0 } })) };
  const r = await cmdRun(ctx);
  inner.close();
  assert.equal(r.stopped, 'failed');
  assert.match(readJsonl(ctx.paths.runlog).at(-1).reason, /1.3 × declared/);
});

test('--until scopes the day: Sat 17 pilot = P + B-001, then stop before B-002', { skip: !HAVE_006 }, async () => {
  const { ctx } = await freshCtx({ args: { until: 'B-002' } });
  const r = await cmdRun(ctx);
  ctx.d1.close();
  assert.deepEqual(r, { stopped: 'until', at: 'B-002' });
  assert.deepEqual(readJsonl(ctx.paths.runlog).map(x => x.batch), ['P-001', 'P-002', 'B-001']);
});

// Contract v1 checks mirrored from App/Ops/src/ops-api.js validateRunEvent (read-only copy of the rules).
const RUN_EVENT_TYPES = new Set(['start', 'success', 'partial', 'skipped', 'failed', 'killed']);
const SKIPPED_REASONS = new Set(['hold', 'pause', 'budget', 'auth', 'out_of_window', 'empty_input']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function contractErrors(e) {
  const errs = [];
  if (e.v !== 1) errs.push('v');
  if (!ID_RE.test(e.run_id || '')) errs.push('run_id');
  if (e.job_id !== 'manual.gleif-reconcile-011') errs.push('job_id');
  if (!RUN_EVENT_TYPES.has(e.event)) errs.push('event');
  if ('items_processed' in e) errs.push('items_processed');
  if (Number.isNaN(Date.parse(e.started_at))) errs.push('started_at');
  if (e.event === 'success' && !Number.isInteger(e.duration_ms)) errs.push('success needs duration_ms');
  if (e.event === 'failed' && !(e.error && e.error.class && e.error.summary)) errs.push('failed needs error');
  if (e.event === 'skipped' && !SKIPPED_REASONS.has(e.detail?.reason)) errs.push('skipped reason');
  if (e.event === 'killed' && !(e.error?.class || e.detail?.reason)) errs.push('killed needs class/reason');
  for (const f of ['rows_read', 'rows_written', 'items_attempted', 'items_progressed']) if (e[f] !== undefined && e[f] !== null && !(Number.isInteger(e[f]) && e[f] >= 0)) errs.push(f);
  const m = e.detail?.metrics; if (m && (Object.keys(m).length > 16 || Object.keys(m).some(k => k.length > 32))) errs.push('metrics');
  if (e.detail && Buffer.byteLength(JSON.stringify(e.detail)) > 2048) errs.push('detail > 2KB');
  return errs;
}

test('heartbeats through the real 002 outbox: contract v1 accepted; 5xx spooled then replayed; delivered events count 5 writes', { skip: !HAVE_006 }, async () => {
  const http = await import('node:http');
  const got = []; let failNext = 0; const bad = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      if (req.headers['x-ops-emitter'] !== 'local.gleif-reconcile-011' || req.headers['x-ops-ingest-key'] !== 'k'.repeat(64)) { res.writeHead(401); return res.end('{}'); }
      if (failNext > 0) { failNext--; res.writeHead(503); return res.end('{}'); }
      const e = JSON.parse(b); const errs = contractErrors(e); if (errs.length) { bad.push({ e, errs }); res.writeHead(400); return res.end('{}'); }
      const dup = got.some(x => x.run_id === e.run_id && (x.event === 'start') === (e.event === 'start'));
      if (!dup) got.push(e);
      res.writeHead(dup ? 200 : 201); res.end('{"ok":true}');
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const cfg = { url: `http://127.0.0.1:${srv.address().port}/api/ops/ingest/run-event`, emitter: 'local.gleif-reconcile-011', key: 'k'.repeat(64) };
  const { ctx } = await freshCtx({ args: { 'max-batches': 2 }, overrides: { ingestCfg: cfg } });
  assert.equal(ctx.outboxLive, true);
  await cmdRun(ctx);                                   // P-001, P-002: delivered
  failNext = 100;                                      // Ops outage
  ctx.args['max-batches'] = 1; await cmdRun(ctx);      // B-001: start + success spooled
  failNext = 0;
  await cmdRun(ctx);                                   // B-002: delivered, then the spool is replayed
  await new Promise(r => setTimeout(r, 300));
  srv.close(); ctx.d1.close();
  assert.deepEqual(bad, [], 'every event passes contract v1');
  const runs = readJsonl(ctx.paths.runlog).filter(x => x.tally).map(x => x.run_key);
  for (const id of runs) {
    assert.ok(got.some(e => e.run_id === id && e.event === 'start'), `start for ${id}`);
    assert.ok(got.some(e => e.run_id === id && e.event === 'success'), `terminal for ${id}`);
  }
  const delivered = readJsonl(ctx.paths.events).reduce((a, e) => a + e.delivered, 0);
  assert.ok(delivered >= 6, `terminal + replayed events recorded (${delivered})`);
  const { ownWrites } = await import('../lib/gleif-reconcile-011-core.mjs');
  const rl = readJsonl(ctx.paths.runlog).reduce((a, x) => a + (x.writes || 0), 0);
  assert.equal(ownWrites(ctx.paths, ctx.now()).todayWrites, rl + 5 * delivered, 'ML-1010-3: delivered events count ≈ 5 writes each');
});

test('freshness sample: ≤ 50 rows, ≥ 15 A, unique LEIs, reproducible; spot-check 25 with ≥ 10 A', { skip: !HAVE_006 }, async () => {
  const { selectSample } = await import('../scripts/gleif-reconcile-011-verify.mjs');
  const { plan } = loadPlan((await shared()).planDir);
  const s = selectSample(plan, { n: 50, minA: 15, seed: 'x' });
  assert.ok(s.n <= 50 && s.a_rows >= 15);
  assert.equal(new Set(s.rows.map(r => r.lei)).size, s.n);
  assert.deepEqual(selectSample(plan, { n: 50, minA: 15, seed: 'x' }).rows.map(r => r.key), s.rows.map(r => r.key));
  const t = selectSample(plan, { n: 25, minA: 10, seed: 'y' });
  assert.ok(t.n <= 25 && t.a_rows >= 10);
  assert.throws(() => selectSample(plan, { n: 51 }), /> 50/);
});

test('freshness compare: agreement, and an A identity mismatch is an E-4 trigger', async () => {
  const { compareRow } = await import('../scripts/gleif-reconcile-011-verify.mjs');
  const row = { lei: 'L1', step: 'A', expect: { lei: 'L1', legal_name: 'ACME AG', legal_address_country: 'DE', entity_status: 'ACTIVE' } };
  const api = (name, ctry) => ({ data: { id: 'L1', attributes: { entity: { legalName: { name }, legalAddress: { country: ctry }, status: 'ACTIVE' }, registration: { status: 'ISSUED' } } } });
  assert.equal(compareRow(row, api('ACME AG', 'DE')).ok, true);
  const r = compareRow(row, api('OTHER CO', 'DE'));
  assert.equal(r.ok, false); assert.equal(r.a_identity_mismatch, true);
  assert.equal(compareRow({ ...row, step: 'B' }, api('OTHER CO', 'DE')).a_identity_mismatch, false);
  assert.equal(compareRow(row, null).ok, false);
  // With a GC snapshot, a C-reasons row (no Level 1 in its SET) is still compared on the four GC fields.
  const cr = { lei: 'L1', step: 'CR', expect: { direct_parent_exception: 'X' }, gc: { legal_name: 'ACME AG', legal_country: 'DE', entity_status: 'ACTIVE', registration_status: 'ISSUED' } };
  assert.equal(compareRow(cr, api('ACME AG', 'DE')).ok, true);
  assert.equal(compareRow(cr, api('ACME SE', 'DE')).ok, false);
});

test('GLEIF fetch refuses without an exact --confirm-gleif-calls (0 calls)', async () => {
  const d = tmp(); const f = path.join(d, 's.json');
  writeFileSync(f, JSON.stringify({ rows: [{ lei: 'X', step: 'A' }] }));
  assert.throws(() => execFileSync(process.execPath, ['--no-warnings', path.join(CORP, 'scripts', 'gleif-reconcile-011-verify.mjs'), 'fetch', '--sample', f, '--out', path.join(d, 'o')], { stdio: 'pipe' }), /confirm-gleif-calls/);
  assert.equal(existsSync(path.join(d, 'o')), false);
});

test('rehearsal (Thu 15 path): ≤ 20 C-reasons rows applied then restored, within 100 writes, rows back to their pre-image', { skip: !HAVE_006 }, async () => {
  const { cmdRehearse } = await import('../scripts/gleif-reconcile-011.mjs');
  const { ctx, db } = await freshCtx({ args: { step: 'CR', rows: 20, 'max-writes': 100 } });
  const dump = () => ctx.d1.db.prepare('SELECT * FROM entity_master ORDER BY entity_id').all().map(r => JSON.stringify(r)).join('\n');
  const before = dump();
  // One planned row has drifted since the export: the rehearsal must skip it, not write it.
  const P = loadPlan(ctx.args.plan);
  const first = P.plan.batches.find(b => b.step === 'CR').statements[0];
  ctx.d1.db.prepare("UPDATE entity_master SET direct_parent_exception = 'DRIFTED' WHERE entity_id = ?").run(first.entity_id);
  const drifted = dump();
  const r = await cmdRehearse(ctx);
  const after = dump();
  ctx.d1.close();
  assert.equal(r.rows, 20);
  const ck = JSON.parse(readFileSync(r.forward_checkpoint, 'utf8'));
  assert.ok(!ck.statements.some(x => x.entity_id === first.entity_id), 'the drifted row was not selected');
  assert.ok(r.total_writes <= 100);
  assert.equal(r.forward.outcome, 'success'); assert.equal(r.restore.outcome, 'success');
  assert.equal(r.all_rows_back_to_preimage, true);
  assert.equal(after, drifted, 'every rehearsed row is back to its pre-image; the drifted row untouched');
  assert.notEqual(before, drifted);
  const fwd = readJsonl(ctx.paths.runlog).filter(x => x.batch === 'RH-CR-001');
  assert.deepEqual(fwd.map(x => x.mode), ['forward', 'restore']);
  void db;
});

test('rehearsal refuses a selection whose estimated writes exceed the budget', { skip: !HAVE_006 }, async () => {
  const { cmdRehearse } = await import('../scripts/gleif-reconcile-011.mjs');
  const { ctx } = await freshCtx({ args: { step: 'B', rows: 20, 'max-writes': 100 } });
  await assert.rejects(cmdRehearse(ctx), /> budget 100/);
  ctx.d1.close();
});

// ── RA-15 / R110R-B1: ECA is gated, dropped and restored exactly like E-A ─────────
// One shared state: the replica run through A and ECA (adjudication + an Ops release
// naming ECA), stopped before E-A. Each test works on its own copy.
let ADV = null;
async function advanced() {
  if (ADV) return ADV;
  const now = clock('2026-10-17T07:20:00Z');
  const { ctx, db, dir } = await freshCtx({ now, args: { until: 'EA' } });
  const adj = path.join(dir, 'adj.json'), rel = path.join(dir, 'rel.json');
  writeFileSync(adj, JSON.stringify({ batch: 'A-001', adjudicated: 50, correct: 50, data_identity_lead: 'DIL', ops_spot_check: true }));
  writeFileSync(rel, JSON.stringify({ release: 'EA', steps: ['ECA', 'EA'], no_open_trigger: true }));
  for (let i = 0; i < 600; i++) {
    const r = await cmdRun(ctx);
    if (r.stopped === 'until') break;
    if (r.stopped === 'a-pilot hold') { ctx.args['a-adjudication'] = adj; continue; }
    if (r.stopped === 'hold' && /ECA needs|E-A needs/.test(r.reason)) { ctx.args['ea-release'] = rel; continue; }
    if (r.stopped === 'hold') throw new Error(r.reason);
    now.add(20 * 60000);
  }
  ctx.d1.close();
  ADV = { db, work: ctx.paths.work, plan: ctx.args.plan, adj, rel, now: now().toISOString() };
  return ADV;
}
async function advCtx(args = {}) {
  const a = await advanced();
  const d = tmp();
  copyFileSync(a.db, path.join(d, 'r.db'));
  execFileSync('cp', ['-R', a.work, path.join(d, 'work')]);
  const now = clock(a.now);
  const ctx = await makeContext({ plan: a.plan, transport: `local:${path.join(d, 'r.db')}`, work: path.join(d, 'work'), operator: 'test', ...args },
    { write: true, now, sleep: async () => {}, fetchImpl: d1TodayStub(now), ingestCfg: null, pauseFlag: path.join(d, 'paused'), stopFlag: path.join(d, 'stop'), log: () => {} });
  return { ctx, a, d, P: loadPlan(a.plan) };
}
const ecaEdges = (ctx, P) => {
  const kids = P.plan.batches.filter(b => b.step === 'ECA').flatMap(b => b.statements).map(s => s.child_entity_id);
  return ctx.d1.db.prepare(`SELECT parent_entity_id, child_entity_id FROM entity_relationships WHERE relationship_type = 'legal_parent' AND source = 'gleif' AND child_entity_id IN (${kids.join(',')})`).all();
};

test('RA-15: ECA blocked without adjudication, below 50/50, with an unpassed A batch, with no release, or a release without ECA; allowed with all three', { skip: !HAVE_006, timeout: 600000 }, async () => {
  const { abGate, releaseCovers } = await import('../scripts/gleif-reconcile-011.mjs');
  const { ctx, a, d, P } = await advCtx();
  assert.equal(ecaEdges(ctx, P).length, 45, 'shared state has the 45 ECA edges');
  const eca = P.plan.batches.find(b => b.step === 'ECA');
  const gate = args => { ctx.args = { ...ctx.args, 'a-adjudication': undefined, 'ea-release': undefined, ...args }; return abGate(ctx, P.plan, P.sha, eca, {}); };
  const full = { 'a-adjudication': a.adj, 'ea-release': a.rel };
  assert.equal(gate(full), null, 'allowed with adjudication + passed A + release naming ECA');
  assert.match(gate({ 'ea-release': a.rel }), /--a-adjudication/);
  const low = path.join(d, 'low.json'); writeFileSync(low, JSON.stringify({ batch: 'A-001', adjudicated: 50, correct: 49, data_identity_lead: 'x', ops_spot_check: true }));
  assert.match(gate({ ...full, 'a-adjudication': low }), /does not record ≥ 50\/50/);
  assert.match(gate({ 'a-adjudication': a.adj }), /ECA needs --ea-release/);
  const noEca = path.join(d, 'r1.json'); writeFileSync(noEca, JSON.stringify({ release: 'EA', steps: ['EA'], no_open_trigger: true }));
  assert.match(gate({ ...full, 'ea-release': noEca }), /does not list ECA blocks ECA/);
  const legacy = path.join(d, 'r2.json'); writeFileSync(legacy, JSON.stringify({ release: 'EA', no_open_trigger: true }));
  assert.match(gate({ ...full, 'ea-release': legacy }), /does not list ECA/, 'a release with no steps list does not release ECA');
  assert.equal(releaseCovers(readJsonOrNull(legacy), 'EA'), true, 'but it still releases E-A');
  // an A batch without a passed read-back diff
  const ckf = path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'A-004.json');
  const ck = JSON.parse(readFileSync(ckf, 'utf8'));
  writeFileSync(ckf, JSON.stringify({ ...ck, mismatches: 1 }));
  assert.match(gate(full), /ECA sequencing: A batch A-004 has no passed read-back diff/);
  writeFileSync(ckf, JSON.stringify(ck));
  // drops
  assert.match(gate({ ...full, 'drop-ea': true }), /dropped/);
  writeFileSync(path.join(ctx.paths.holds, 'ea-dropped.json'), '{}');
  assert.match(gate(full), /dropped .*drops ECA and E-A/);
  ctx.d1.close();
});
const readJsonOrNull = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

test('RA-15: an E-4 trigger blocks ECA and deletes every ECA edge already written before anything else runs', { skip: !HAVE_006, timeout: 600000 }, async () => {
  const { ctx, a, P } = await advCtx();
  ctx.args['a-adjudication'] = a.adj; ctx.args['ea-release'] = a.rel; delete ctx.args.until;
  const aRows = () => ctx.d1.db.prepare(`SELECT COUNT(*) n FROM entity_master WHERE match_source = 'gc_name_t1'`).get().n;
  const before = aRows();
  writeFileSync(path.join(ctx.paths.holds, 'e4-trigger.json'), JSON.stringify({ why: 'test' }));
  const r = await cmdRun(ctx);
  assert.equal(r.stopped, 'hold'); assert.match(r.reason, /E-4 trigger open/);
  assert.equal(ecaEdges(ctx, P).length, 0, 'all 45 ECA edges deleted');
  assert.equal(aRows(), before, 'A rows are restored separately (RA-12), not by this step');
  assert.ok(existsSync(path.join(ctx.paths.holds, 'eca-ea-dropped.json')));
  const cur = JSON.parse(readFileSync(path.join(ctx.paths.work, `cursor-${P.sha.slice(0, 16)}.json`), 'utf8'));
  assert.ok(!('ECA-001' in cur.done) && 'ECA-001' in cur.restored);
  // the trigger closed later: ECA stays dropped for the rest of the run
  rmSync(path.join(ctx.paths.holds, 'e4-trigger.json'));
  const { abGate } = await import('../scripts/gleif-reconcile-011.mjs');
  assert.match(abGate(ctx, P.plan, P.sha, P.plan.batches.find(b => b.step === 'ECA'), {}), /A stopped earlier/);
  ctx.d1.close();
});

test('RA-15: a failed A batch drops ECA and deletes its edges', { skip: !HAVE_006, timeout: 600000 }, async () => {
  const { ctx, a, P } = await advCtx();
  ctx.args['a-adjudication'] = a.adj; ctx.args['ea-release'] = a.rel;
  const ckf = path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'A-007.json');
  writeFileSync(ckf, JSON.stringify({ ...JSON.parse(readFileSync(ckf, 'utf8')), outcome: 'failed' }));
  await cmdRun(ctx);
  assert.equal(ecaEdges(ctx, P).length, 0);
  ctx.d1.close();
});

test('RA-15: restore --batch A-003 first deletes only its 7 dependent ECA edges, then restores A-003; other ECA edges stay', { skip: !HAVE_006, timeout: 600000 }, async () => {
  const { ctx, P } = await advCtx({ batch: 'A-003' });
  const a3 = P.plan.batches.find(b => b.id === 'A-003').statements.map(s => s.entity_id);
  const dependent = P.plan.batches.find(b => b.step === 'ECA').statements.filter(s => s.depends_on.some(k => a3.includes(Number(k.slice(2)))));
  assert.equal(dependent.length, 7);
  const r = await cmdRestore(ctx);
  assert.deepEqual(r.results.map(x => [x.id, x.outcome]), [['ECA-001', 'success'], ['A-003', 'success']]);
  const left = ecaEdges(ctx, P);
  assert.equal(left.length, 45 - 7);
  assert.ok(!left.some(e => dependent.some(s => s.child_entity_id === e.child_entity_id)), 'the 7 dependent edges are gone');
  const leis = ctx.d1.db.prepare(`SELECT COUNT(*) n FROM entity_master WHERE entity_id IN (${a3.join(',')}) AND lei IS NOT NULL`).get().n;
  assert.equal(leis, 0, 'A-003 rows restored (LEI removed)');
  ctx.d1.close();
});

test('RA-15: --all restore order is unchanged (Q → EA → ECA → A → EC → CR/RC15/C → B → P)', async () => {
  const { restoreOrder } = await import('../scripts/gleif-reconcile-011.mjs');
  assert.deepEqual(restoreOrder(['P-001', 'B-001', 'A-001', 'ECA-001', 'EA-001', 'Q-001', 'EC-001', 'CR-001', 'B-002', 'A-002', 'C-001', 'RC15-001', 'B-001-fb']),
    ['Q-001', 'EA-001', 'ECA-001', 'A-002', 'A-001', 'EC-001', 'CR-001', 'RC15-001', 'C-001', 'B-002', 'B-001-fb', 'B-001', 'P-001']);
});

test('RA-15: the Sat 17 pilot batches are unchanged (P-001, P-002, B-001; no A/ECA statements)', { skip: !HAVE_006 }, async () => {
  const { createHash } = await import('node:crypto');
  const { plan } = loadPlan((await shared()).planDir);
  const b = plan.batches.filter(x => ['P-001', 'P-002', 'B-001'].includes(x.id));
  assert.ok(b.every(x => x.statements.every(s => !['A', 'ECA', 'EA'].includes(s.step))));
  assert.equal(createHash('sha256').update(JSON.stringify(b.map(x => x.statements))).digest('hex'), 'df77f7392f10b0b2192d77711d48167c73c7c8e00c54ed34425d8be7ac7429f4');
});

// ── ML-1015-1: LEI-bearing rows on both bases ─────────────────────────────
test('ML-1015-1: whole-table basis governs (20,612 ± drift); 29 Sep basis 20,304 for traceability', async () => {
  const { leiBases } = await import('../scripts/gleif-reconcile-011-verify.mjs');
  // Fixture 1 — 29 Sep export basis, no drift (the dry run): whole table = 20,612.
  const a = leiBases({ preLeiRows: 16627, postLeiRows: 20612, aApplied: 3677, pNew: 308 });
  assert.equal(a.whole_table.expected, 20612); assert.equal(a.whole_table.drift, 0); assert.equal(a.whole_table.pass, true);
  assert.equal(a.export_29sep.observed, 20304); assert.equal(a.export_29sep.expected, 20304);
  // Fixture 2 — whole table with drift: 140 LEI rows added by other writers before the run, 25 during it (e.g. FIRDS).
  const b = leiBases({ preLeiRows: 16767, postLeiRows: 20612 + 165, aApplied: 3677, pNew: 308 });
  assert.equal(b.whole_table.drift, 165);
  assert.deepEqual(b.whole_table.drift_explained, { before_run_other_writers: 140, during_run_other_writers: 25 });
  assert.equal(b.whole_table.expected, 20777); assert.equal(b.whole_table.pass, true);
  assert.equal(b.export_29sep.observed, 20304);
  // Fixture 3 — 011 short by 3 A rows: the whole-table basis fails (PASS/FAIL uses it).
  const c = leiBases({ preLeiRows: 16767, postLeiRows: 20612 + 165 - 3, aApplied: 3674, pNew: 308 });
  assert.equal(c.whole_table.pass, false); assert.equal(c.whole_table.unexplained, -3);
  assert.equal(c.export_29sep.observed, 20301);
});

// ── R9-1 (OPS-R9): cumulative 011 read ceiling ─────────────────────────────
test('R9-1: read-ceiling decision — missing record fails closed; ceiling and 200k/day enforced before the step', async () => {
  const { readCeilingDecision } = await import('../lib/gleif-reconcile-011-core.mjs');
  const cfg = { ceiling: 350000, per_day_max: 200000 };
  assert.equal(readCeilingDecision({ cfg: null, cumulative: 0, today: 0, ceiling: null, day_max: 200000 }, 10).ok, false);
  assert.equal(readCeilingDecision({ cfg, cumulative: 349000, today: 0, ceiling: 350000, day_max: 200000 }, 1000).ok, true);
  assert.match(readCeilingDecision({ cfg, cumulative: 349000, today: 0, ceiling: 350000, day_max: 200000 }, 1001).reason, /> ceiling 350000/);
  assert.match(readCeilingDecision({ cfg, cumulative: 10, today: 199500, ceiling: 350000, day_max: 200000 }, 501).reason, /200000\/day/);
});

test('R9-1: readTotals sums ledger reads since the Friday export only', async () => {
  const { readTotals, workPaths } = await import('../lib/gleif-reconcile-011-core.mjs');
  const d = tmp(); const P = workPaths(d);
  writeFileSync(P.ledger, [{ ts: '2026-10-13T10:00:00Z', rows_read: 998 }, { ts: '2026-10-16T20:38:47.891Z', rows_read: 73000 }, { ts: '2026-10-17T08:00:00Z', rows_read: 500 }].map(x => JSON.stringify(x)).join('\n') + '\n');
  writeFileSync(path.join(d, 'read-ceiling.json'), JSON.stringify({ ceiling: 350000, since: '2026-10-16T20:38:47.891Z', per_day_max: 200000 }));
  const t = readTotals(P, new Date('2026-10-17T09:00:00Z'));
  assert.equal(t.cumulative, 73500); assert.equal(t.today, 500); assert.equal(t.ceiling, 350000);
});

test('R9-1: the runner stops BEFORE a batch that would cross the ceiling (0 reads, 0 writes); missing record = refused', { skip: !HAVE_006 }, async () => {
  const { executeBatch } = await import('../scripts/gleif-reconcile-011.mjs');
  const { ctx, db } = await freshCtx();
  const inner = ctx.d1; let calls = 0;
  ctx.d1 = { name: 'remote-sim', db: inner.db, exec: async (q, o) => { calls++; return inner.exec(q, o); } };
  const P = loadPlan(ctx.args.plan); const b = P.plan.batches[0];
  const before = sha256File(db);
  // no read-ceiling.json → fail closed
  let r = await executeBatch(ctx, P, b);
  assert.equal(r.outcome, 'budget_limit'); assert.match(readJsonl(ctx.paths.runlog).at(-1).reason, /missing/);
  // ceiling nearly used: 349,000 of 350,000; this batch is estimated at 6 × 250 + 10 = 1,510 reads
  writeFileSync(path.join(ctx.paths.work, 'read-ceiling.json'), JSON.stringify({ ceiling: 350000, since: '2026-10-16T00:00:00Z', per_day_max: 200000 }));
  writeFileSync(ctx.paths.ledger, JSON.stringify({ ts: '2026-10-16T21:00:00Z', rows_read: 349000 }) + '\n');
  r = await executeBatch(ctx, P, b);
  assert.equal(r.outcome, 'budget_limit'); assert.match(readJsonl(ctx.paths.runlog).at(-1).reason, /> ceiling 350000/);
  assert.equal(calls, 0, 'no D1 call was made'); assert.equal(sha256File(db), before, '0 writes');
  inner.close();
});

test('R9-1: recon logs the cumulative 011 reads and the ceiling', async () => {
  const { cmdRecon } = await import('../scripts/gleif-reconcile-011.mjs');
  const d = tmp();
  const ctx = await makeContext({ work: path.join(d, 'w'), date: '2026-10-17' }, { transport: { name: 'remote-sim', exec: async () => [{ results: [], meta: { rows_read: 2 } }] }, ingestCfg: null, log: () => {} });
  writeFileSync(path.join(ctx.paths.work, 'read-ceiling.json'), JSON.stringify({ ceiling: 350000, since: '2026-10-16T20:38:47.891Z', per_day_max: 200000 }));
  writeFileSync(ctx.paths.ledger, JSON.stringify({ ts: '2026-10-16T20:39:00Z', rows_read: 73489 }) + '\n');
  const m = await cmdRecon(ctx);
  assert.equal(m.reads_011.cumulative, 73489); assert.equal(m.reads_011.ceiling, 350000);
});

// ── Sun 18: B-1..B-4 + duplicate-LEI-holder check (P3R; RUN Task v3) ────────
const dumpEm = db => db.prepare('SELECT * FROM entity_master ORDER BY entity_id').all().map(r => JSON.stringify(r)).join('\n');
const isWrite = q => /^\s*(UPDATE|INSERT|DELETE)/i.test(q);
async function ctxAtB001() {                       // replica with P-001, P-002 applied; cursor at B-001
  const x = await freshCtx({ args: { until: 'B-001' } });
  await cmdRun(x.ctx);
  delete x.ctx.args.until; x.ctx.args['max-batches'] = 1;
  return x;
}

test('B-4(a) + B-3: a B CAS batch failing after writes (half applied) is not retried; run refuses it until restored; restore is exact; the failed checkpoint is kept', { skip: !HAVE_006 }, async () => {
  const { ctx } = await ctxAtB001();
  const inner = ctx.d1; const before = dumpEm(inner.db); let writeCalls = 0, fail = true;
  ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => {
    if (!isWrite(q[0]) || !fail) return inner.exec(q, o);
    writeCalls++; await inner.exec(q.slice(0, 125), o); throw new Error('code: 10000');
  } };
  let r = await cmdRun(ctx);
  assert.equal(r.stopped, 'failed'); assert.equal(writeCalls, 1, 'no retry after writes');
  const P = loadPlan(ctx.args.plan); const dir = path.join(ctx.paths.checkpoints, P.sha.slice(0, 16));
  const ck = JSON.parse(readFileSync(path.join(dir, 'B-001.json'), 'utf8'));
  assert.equal(ck.outcome, 'failed'); assert.equal(ck.tally.applied, 125);
  // B-3: run refuses the batch until it is restored
  fail = false;
  r = await cmdRun(ctx);
  assert.equal(r.stopped, 'hold'); assert.match(r.reason, /C-1\/B-3: B-001 failed with 125 applied/);
  // restore --all (full rollback) includes the failed batch, which is not in cursor.done: checked on a COPY,
  // which must come back to the original replica content (before P and B).
  {
    const d2 = tmp(); copyFileSync(path.join(path.dirname(ctx.paths.work), 'replica.db'), path.join(d2, 'r.db'));
    execFileSync('cp', ['-R', ctx.paths.work, path.join(d2, 'work')]);
    const ctx2 = await makeContext({ plan: ctx.args.plan, transport: `local:${path.join(d2, 'r.db')}`, work: path.join(d2, 'work'), operator: 'test', all: true },
      { write: true, now: ctx.now, sleep: async () => {}, fetchImpl: d1TodayStub(ctx.now), ingestCfg: null, pauseFlag: path.join(d2, 'p'), stopFlag: path.join(d2, 's'), log: () => {} });
    const ra = await cmdRestore(ctx2);
    assert.deepEqual(ra.results.map(x => [x.id, x.outcome]), [['B-001', 'success'], ['P-002', 'success'], ['P-001', 'success']]);
    const { DatabaseSync } = await import('node:sqlite');
    const orig = new DatabaseSync((await shared()).replica, { readOnly: true });
    assert.equal(dumpEm(ctx2.d1.db), dumpEm(orig), 'full rollback incl. the failed batch = original replica');
    orig.close(); ctx2.d1.close();
  }
  // restore --batch B-001 (C-1) on the main state: exact back to before B-001
  ctx.args.batch = 'B-001'; ctx.d1 = inner;
  const rr = await cmdRestore(ctx);
  assert.deepEqual(rr.results.map(x => [x.id, x.outcome]), [['B-001', 'success']]);
  assert.equal(dumpEm(inner.db), before, 'restore exact');
  delete ctx.args.batch;
  // re-run allowed now; the failed forward checkpoint is preserved under its run id
  r = await cmdRun(ctx);
  assert.equal(readJsonl(ctx.paths.runlog).filter(x => x.batch === 'B-001').at(-1).outcome, 'success');
  assert.ok(readdirSyncSafe(dir).some(f => f === `B-001.failed-${ck.run_id.slice(0, 8)}.json`), 'failed checkpoint kept, never overwritten');
  inner.close();
});
function readdirSyncSafe(d) { try { return execFileSync('ls', [d], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return []; } }

test('B-4(b): a concurrent writer changes one row between the pre-image and the probe: no retry, failed, and restore leaves that row untouched', { skip: !HAVE_006 }, async () => {
  const { ctx } = await ctxAtB001();
  const inner = ctx.d1; let writeCalls = 0;
  const P = loadPlan(ctx.args.plan); const victim = P.plan.batches.find(b => b.id === 'B-001').statements[7].entity_id;
  ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => {
    if (!isWrite(q[0])) return inner.exec(q, o);
    writeCalls++;
    inner.db.prepare("UPDATE entity_master SET direct_parent_exception = 'CONCURRENT' WHERE entity_id = ?").run(victim);   // another writer, no 011 statement applied
    throw new Error('A request to the Cloudflare API failed [code: 7403]');
  } };
  const r = await cmdRun(ctx);
  assert.equal(r.stopped, 'failed'); assert.equal(writeCalls, 1, 'no retry');
  const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'B-001.json'), 'utf8'));
  assert.equal(ck.retry_log[0].rows_unchanged, false);
  assert.equal(ck.tally.applied || 0, 0, 'no 011 row was applied');
  assert.equal(ck.diff.find(d => d.entity_id === victim).status, 'mismatch');
  // nothing applied → the gate does not demand a restore; a restore restores nothing and leaves the row alone
  ctx.d1 = inner;
  const { restoreBatch } = await import('../scripts/gleif-reconcile-011.mjs');
  await restoreBatch(ctx, P, { id: 'B-001', step: 'B', statements: ck.statements }, ck);
  assert.equal(inner.db.prepare('SELECT direct_parent_exception d FROM entity_master WHERE entity_id = ?').get(victim).d, 'CONCURRENT');
  inner.close();
});

test('B-4(c) + B-2: the probe fails and the read-back keeps failing: no retry; checkpoint (failed, diff unknown, pre-image path) + hold; run and restore refused; readback completes it', { skip: !HAVE_006 }, async () => {
  const { readbackHoldFile, cmdReadback } = await import('../scripts/gleif-reconcile-011.mjs');
  const { ctx } = await ctxAtB001();
  const inner = ctx.d1; let writeCalls = 0, readsDown = false;
  ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => {
    if (isWrite(q[0])) { writeCalls++; await inner.exec(q, o); readsDown = true; throw new Error('code: 10000'); }
    if (readsDown) throw new Error('code: 10000 (reads down)');
    return inner.exec(q, o);
  } };
  const r = await cmdRun(ctx);
  assert.equal(r.stopped, 'failed'); assert.equal(writeCalls, 1, 'no retry');
  const P = loadPlan(ctx.args.plan);
  const ckf = path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'B-001.json');
  let ck = JSON.parse(readFileSync(ckf, 'utf8'));
  assert.equal(ck.outcome, 'failed'); assert.equal(ck.readback_pending, true);
  assert.equal(ck.tally.unknown, 250); assert.ok(existsSync(ck.preimage_file), 'pre-image path recorded');
  assert.ok(existsSync(readbackHoldFile(ctx, 'B-001')), 'hold written');
  // run refuses while the hold exists; restore refuses a pending read-back
  readsDown = false;
  const r2 = await cmdRun(ctx); assert.equal(r2.stopped, 'hold'); assert.match(r2.reason, /pending read-back/);
  ctx.args.batch = 'B-001'; await assert.rejects(cmdRestore(ctx), /pending read-back/);
  // readback (read-only) completes the checkpoint against the ORIGINAL pre-image and lifts the hold
  const done = await cmdReadback(ctx);
  assert.equal(done.tally.applied, 250);
  assert.equal(existsSync(readbackHoldFile(ctx, 'B-001')), false);
  ck = JSON.parse(readFileSync(ckf, 'utf8')); assert.equal(ck.readback_pending, false); assert.equal(ck.outcome, 'failed');
  // then C-1/B-3: restore first, before any re-run
  delete ctx.args.batch;
  const r3 = await cmdRun(ctx); assert.match(r3.reason, /C-1\/B-3: B-001 failed with 250 applied/);
  inner.close();
});

test('B-1: writes of an in-flight call that land during the retry delay are seen by the pre-retry probe: no retry', { skip: !HAVE_006 }, async () => {
  const { ctx } = await ctxAtB001();
  const inner = ctx.d1; let writeCalls = 0, pending = null;
  ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => {
    if (!isWrite(q[0])) return inner.exec(q, o);
    writeCalls++; pending = q; throw new Error('wrangler timeout (client side)');   // nothing applied yet
  } };
  ctx.sleep = async () => { if (pending) { await inner.exec(pending, {}); pending = null; } };   // D1 finishes during the 30 s sleep
  const r = await cmdRun(ctx);
  assert.equal(r.stopped, 'failed'); assert.equal(writeCalls, 1, 'not re-sent');
  const P = loadPlan(ctx.args.plan);
  const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'B-001.json'), 'utf8'));
  assert.deepEqual(ck.retry_log.map(x => [x.phase, x.rows_unchanged]), [['after-failure', true], ['before-retry', false]]);
  assert.match(ck.stops[0], /landed during the retry delay; no retry \(P-3, B-1\)/);
  assert.equal(ck.tally.applied, 250, 'diff against the original pre-image');
  inner.close();
});

test('duplicate-LEI holder: if a second row holds a P LEI after the insert, the statement is a mismatch', { skip: !HAVE_006 }, async () => {
  const { ctx } = await freshCtx({ args: { 'max-batches': 1 } });
  const inner = ctx.d1;
  const P = loadPlan(ctx.args.plan); const s0 = P.plan.batches[0].statements[3];
  ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => {
    if (isWrite(q[0])) inner.db.prepare("INSERT INTO entity_master (name, normalized_name, type, lei) VALUES ('SOMEONE ELSE', 'SOMEONE ELSE DUP TEST', 'holding', ?)").run(s0.values.lei);   // another writer, a different key
    return inner.exec(q, o);
  } };
  await cmdRun(ctx);
  const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'P-001.json'), 'utf8'));
  const d = ck.diff.find(x => x.key === s0.key);
  assert.equal(d.status, 'mismatch'); assert.match(d.why, /LEI held by 2 rows after the insert/);
  assert.equal(ck.mismatches, 1);
  inner.close();
});

test('B-5: a failed write call counts its applied writes (not 0) in 011\'s daily total; a read-back failure counts the declared writes', { skip: !HAVE_006 }, async () => {
  const { ownWrites } = await import('../lib/gleif-reconcile-011-core.mjs');
  // (1) half applied, read-back fine
  {
    const { ctx } = await ctxAtB001();
    const inner = ctx.d1;
    ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => { if (!isWrite(q[0])) return inner.exec(q, o); await inner.exec(q.slice(0, 125), o); throw new Error('code: 10000'); } };
    const before = ownWrites(ctx.paths, ctx.now()).todayWrites;
    await cmdRun(ctx);
    const P = loadPlan(ctx.args.plan);
    const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'B-001.json'), 'utf8'));
    const appliedKeys = new Set(ck.diff.filter(d => d.status === 'applied').map(d => d.key));
    const expected = ck.statements.filter(x => appliedKeys.has(x.key)).reduce((a, x) => a + x.est_writes, 0);
    assert.ok(expected > 0);
    const line = readJsonl(ctx.paths.runlog).at(-1);
    assert.equal(line.outcome, 'failed'); assert.equal(line.writes, expected, 'run log carries the applied writes');
    assert.equal(ck.writes, expected); assert.equal(ck.writes_measured, 0); assert.match(ck.writes_basis, /^B-5/);
    assert.equal(ownWrites(ctx.paths, ctx.now()).todayWrites - before, expected, 'the 25k daily count includes them');
    inner.close();
  }
  // (2) read-back keeps failing: every row unknown → the declared writes are counted
  {
    const { ctx } = await ctxAtB001();
    const inner = ctx.d1; let down = false;
    ctx.d1 = { name: inner.name, db: inner.db, exec: async (q, o) => { if (isWrite(q[0])) { await inner.exec(q, o); down = true; throw new Error('code: 10000'); } if (down) throw new Error('reads down'); return inner.exec(q, o); } };
    await cmdRun(ctx);
    const P = loadPlan(ctx.args.plan);
    const ck = JSON.parse(readFileSync(path.join(ctx.paths.checkpoints, P.sha.slice(0, 16), 'B-001.json'), 'utf8'));
    assert.equal(readJsonl(ctx.paths.runlog).at(-1).writes, ck.declared_writes);
    assert.equal(ck.writes, ck.declared_writes); assert.match(ck.writes_basis, /^B-5: read-back failed/);
    inner.close();
  }
});

test('diff: unexpected value is a mismatch, not raced', () => {
  const batch = { statements: [{ kind: 'em_update', key: 'C:1', entity_id: 1, set: { direct_parent_lei: 'P' }, pre: { direct_parent_lei: null } }] };
  const pre = { em: [{ entity_id: 1, direct_parent_lei: null }] };
  assert.equal(diffBatch(batch, pre, { em: [{ entity_id: 1, direct_parent_lei: 'P' }] }, 'T')[0].status, 'applied');
  assert.equal(diffBatch(batch, pre, { em: [{ entity_id: 1, direct_parent_lei: null }] }, 'T')[0].status, 'raced');
  assert.equal(diffBatch(batch, pre, { em: [{ entity_id: 1, direct_parent_lei: 'Q' }] }, 'T')[0].status, 'mismatch');
});

// Full simulated run Sat 17 → Thu 22 on the replica, honouring the calendar,
// the A pilot hold and E-A sequencing; then §9 post-run checks; then a full
// rollback (§10) back to the original replica content. Same code as the
// dry-run evidence script (tests/gleif-reconcile-011-dryrun.mjs).
test('full simulated run + §9 checks + full rollback restores every row', { skip: !HAVE_006, timeout: 600000 }, async () => {
  const { simulate } = await import('./gleif-reconcile-011-dryrun.mjs');
  const sh = await shared();
  const s = await simulate({ planDir: sh.planDir, replica: sh.replica, out: path.join(tmp(), 'dry') });
  assert.equal(s.after.lei_rows_excl_new_parents, 16627 + 3677, 'LEI-bearing rows 20,304');
  assert.equal(s.after.new_parent_rows, 308, 'P rows (F-2)');
  assert.ok(s.after.phase3_pool <= 10, 'Phase 3 pool ≤ 10');
  assert.equal(s.after.no_link_declared, 152);
  assert.equal(s.after.ultimate_exception_on_existing_rows, 18739);
  assert.equal(s.after.legal_parent_edges, 66 + 680 + 45 + 298, 'edges: E-C 680 + ECA 45 + E-A 298');
  assert.equal(s.after.a_rows, 3677);
  assert.equal(s.after.queue_closed_by_011, 3677);
  assert.equal(s.after.new_duplicate_leis, 0, 'no new duplicate LEIs');
  assert.ok(s.max_day <= 25000, '≤ 25k writes per day by 011 (cost-model basis)');
  assert.ok(!Object.keys(s.writes_per_day_cost_model).some(d => new Date(d + 'T12:00:00Z').getUTCDay() === 0), 'no Sunday writes');
  assert.equal(s.calendar_violations, 0);
  assert.equal(s.rollback.identical, true, 'full rollback restores all three tables exactly');
  assert.deepEqual(s.holds.map(h => h.hold), ['A pilot', 'ECA/E-A release']);
  assert.match(s.holds[1].reason, /^ECA needs --ea-release/, 'ECA is the first step held for the release (RA-15)');
  // §9 from X1/X2-format exports of the pre- and post-run state (V3), plus the 200-row sampled diff (E-3).
  const { exportKeyset, loadExport, openGc, BASIS } = await import('../scripts/gleif-reconcile-011-plan.mjs');
  const { postrun } = await import('../scripts/gleif-reconcile-011-verify.mjs');
  const d = tmp();
  await exportKeyset({ out: path.join(d, 'pre'), transport: `local:${sh.replica}` });
  await exportKeyset({ out: path.join(d, 'post'), transport: `local:${s.post_run_db}` });
  const gc = await openGc(BASIS.gleif_006_db.path);
  const v = await postrun({ planDir: sh.planDir, pre: await loadExport(path.join(d, 'pre')), post: await loadExport(path.join(d, 'post')), gc });
  // The sampled diff compares only the columns 011 wrote: a stale legal_name on a C-reasons row
  // (011 never writes Level 1 there, RC-8) is not a mismatch; a wrong value on an A row is.
  const postE = await loadExport(path.join(d, 'post'));
  const { plan: pl } = loadPlan(sh.planDir);
  const crId = pl.batches.find(b => b.step === 'CR').statements[0].entity_id;
  const aId = pl.batches.find(b => b.step === 'A').statements[0].entity_id;
  for (const r of postE.em) { if (r.entity_id === crId) r.legal_name = 'STALE NAME FROM JUNE'; if (r.entity_id === aId) r.legal_name = 'WRONG'; }
  const all = await postrun({ planDir: sh.planDir, pre: await loadExport(path.join(d, 'pre')), post: postE, gc, sampleN: 100000 });
  gc.close();
  assert.deepEqual(all.sampled_diff.mismatches.map(m => [m.entity_id, m.bad]), [[aId, ['legal_name']]]);
  assert.equal(v.pass, true);
  assert.equal(v.lei_rows.whole_table.observed, 20612); assert.equal(v.lei_rows.whole_table.expected, 20612); assert.equal(v.lei_rows.whole_table.drift, 0);
  assert.equal(v.lei_rows.export_29sep.observed, 20304);
  assert.equal(v.sampled_diff.n, 200); assert.ok(v.sampled_diff.ea_edges >= 25);
  for (const k of ['new_duplicate_leis', 'wrong_lei_rows_touched', 'normalized_name_or_type_changed', 'lei_overwritten', 'country_overwritten', 'non_placeholder_name_changed']) assert.equal(v.counts[k], 0, k);
  assert.equal(v.counts.ki229_edges_unchanged, true);
});
