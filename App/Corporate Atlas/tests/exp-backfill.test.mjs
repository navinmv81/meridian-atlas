// MA-NOV-EXP.BFS.BUILD — tests for src/exp-backfill.js and its wiring in src/entities-enrich.js scheduled().
// Addendum claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md §8 B1–B8 (B9 is tests/exp-backfill-ingest.test.mjs; B10 is
// the live plan check, report §3) + extras: no Ops rows → skipped/not_enabled; a batch never exceeds the remaining
// budget; Sun/Mon skip; run-token format.
// In-memory node:sqlite behind a D1-shaped adapter (prepare/bind/all/first/run, batch() = one transaction).
// 0 network, 0 D1.   Run: node --test "App/Corporate Atlas/tests/exp-backfill.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeDb, enable, d1, FUNDS } from './exp-backfill-fixture.mjs';

const rd = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const TEMPLATE = rd('../gate3v2/gate3v2-month.sql.tmpl');
const BF = await import(new URL('../src/exp-backfill.js', import.meta.url).href);
const { SQL, EXPBF_JOB_ID, packBatches, runExpBackfill, runExpBackfillStep, runToken, capFromProfile, dayBudget, isSkipDay } = BF;

const TUE = new Date('2026-11-24T06:00:20Z');   // run day
const SUN = new Date('2026-11-22T06:00:20Z');
const MON = new Date('2026-11-23T06:00:20Z');
const WED = new Date('2026-11-25T06:00:20Z');
const quiet = () => {};

const rowsOf = (db, table) => db.prepare(table === 'exp'
  ? `SELECT report_month, entity_id, holder_entity_id, round(weight_sum, 9) weight_sum, aum_weighted FROM entity_exposure_monthly ORDER BY 1, 2, 3`
  : `SELECT report_month, holder_entity_id, round(total_weight, 9) total_weight, round(mapped_weight, 9) mapped_weight FROM fund_exposure_coverage ORDER BY 1, 2`).all();
const plain = x => JSON.parse(JSON.stringify(x));
const count = (db, t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;

async function runUntilDone(db, { U = 0, cap = 50000, days = 10, opts = {} } = {}) {
  const env = { DB: d1(db, opts) };
  const runs = [];
  for (let d = 0; d < days; d++) {
    const r = await runExpBackfill(env, { U, now: new Date(TUE.getTime() + d * 7 * 86400000), log: quiet });
    runs.push(r);
    if (r.event === 'skipped' || r.event === 'success' || r.event === 'failed') break;
  }
  return { env, runs };
}

// ── B1 packing ───────────────────────────────────────────────────────────────────────────────────────────────────
test('B1 packing: months never mixed; Σn ≤ 12,000 except solo ≤ 18,000; oversize skipped and counted; order kept', () => {
  const c = [
    { m: '2026-04', holder: 1, n: 5000 }, { m: '2026-04', holder: 2, n: 6000 }, { m: '2026-04', holder: 3, n: 2000 },
    { m: '2026-04', holder: 4, n: 12500 }, { m: '2026-04', holder: 5, n: 19000 }, { m: '2026-04', holder: 6, n: 100 },
    { m: '2026-04', holder: 7, n: 12000 },
    { m: '2026-05', holder: 1, n: 300 }, { m: '2026-05', holder: 8, n: 700 }, { m: '2026-05', holder: 8, n: 400 },
    { m: '2026-05', holder: 9, n: 18000 }, { m: '2026-05', holder: 10, n: 18001 },
  ];
  const { batches, oversize, holderMonths } = packBatches(c);
  assert.equal(holderMonths, 11, 'holder 8 in 2026-05 appears twice (two series) and is summed once');
  assert.deepEqual(batches.map(b => [b.m, b.lo, b.hi, b.n, b.solo]), [
    ['2026-04', 1, 2, 11000, false], ['2026-04', 3, 3, 2000, false], ['2026-04', 4, 4, 12500, true],
    ['2026-04', 6, 6, 100, false], ['2026-04', 7, 7, 12000, false],
    ['2026-05', 1, 8, 1400, false], ['2026-05', 9, 9, 18000, true],
  ]);
  assert.deepEqual(oversize.map(o => [o.m, o.holder, o.n]), [['2026-04', 5, 19000], ['2026-05', 10, 18001]]);
  for (const b of batches) assert.ok(b.solo ? (b.holders.length === 1 && b.n <= 18000) : b.n <= 12000);
  const order = batches.map(b => `${b.m}:${String(b.lo).padStart(4, '0')}`);
  assert.deepEqual(order, [...order].sort(), 'oldest month first, then ascending holder');
  assert.ok(!batches.some(b => b.lo <= 5 && b.hi >= 5 && b.m === '2026-04'), 'no batch range spans an oversize holder');
});

// ── B2 identity equals BF1 ───────────────────────────────────────────────────────────────────────────────────────
test('B2 identity: all batches of 2026-04..06 give exactly the whole-month gate3v2 template rows (except computed_at)', async () => {
  const a = makeDb(); enable(a);
  const { runs } = await runUntilDone(a);
  assert.equal(runs.at(-1).event, 'success', JSON.stringify(runs.map(r => [r.event, r.reason])));
  assert.ok(runs.reduce((s, r) => s + r.metrics.batches, 0) >= 6, 'more than one batch per month');

  const b = makeDb();
  for (const m of ['2026-04', '2026-05', '2026-06']) b.exec(TEMPLATE.replace(/^--.*$/gm, '').replaceAll('__MONTH__', m).replaceAll('__TOKEN__', 'g3v2-test'));
  // The template has no "complete holdings only" holder filter beyond the join, so S03 2026-05 (incomplete) gives no rows in either.
  assert.deepEqual(plain(rowsOf(a, 'exp')), plain(rowsOf(b, 'exp')));
  assert.deepEqual(plain(rowsOf(a, 'cov')), plain(rowsOf(b, 'cov')));
  assert.ok(count(a, 'entity_exposure_monthly') > 50 && count(a, 'fund_exposure_coverage') === 11 * 3 - 1);
  // 2-hop redirect resolves to the survivor; 3-hop is not mapped.
  const ents = new Set(a.prepare(`SELECT DISTINCT entity_id e FROM entity_exposure_monthly`).all().map(x => x.e));
  for (const dup of [1001, 1003, 1004, 1006, 1007, 1008]) assert.ok(!ents.has(dup), `no row on ${dup}`);   // 1009 is 1008's survivor
  assert.ok(a.prepare(`SELECT COUNT(*) n FROM entity_exposure_monthly WHERE computed_at NOT LIKE 'g3v2s-20261124-__'`).get().n === 0);
});

test('B2 drift: the module key CASE and redirect CTE are character-identical to gate3v2-month.sql.tmpl', () => {
  assert.ok(TEMPLATE.includes(BF._TEMPLATE_PARTS.KEY_CASE), 'key CASE');
  assert.ok(TEMPLATE.includes(BF._TEMPLATE_PARTS.J_CTE), 'j CTE');
  for (const s of [SQL.count, SQL.exposureInsert, SQL.coverageInsert]) {
    assert.ok(s.includes(BF._TEMPLATE_PARTS.KEY_CASE) && s.includes(BF._TEMPLATE_PARTS.J_CTE));
    assert.match(s, /FROM fel CROSS JOIN fund_holdings_monthly f/);
    assert.match(s, /entity_id NOT IN \(SELECT holder_entity_id FROM fund_exposure_coverage WHERE report_month = \?1\)/);
    assert.doesNotMatch(s, /\$\{|__MONTH__|__TOKEN__/);
  }
  assert.match(SQL.exposureInsert, /INSERT OR IGNORE INTO entity_exposure_monthly/);
  assert.match(SQL.coverageInsert, /INSERT OR IGNORE INTO fund_exposure_coverage/);
  const writes = Object.values(SQL).join('\n').match(/\b(INSERT|UPDATE|DELETE|REPLACE|DROP|CREATE|ALTER)\b[^\n]*/g) || [];
  assert.deepEqual(writes.map(w => w.slice(0, 50)), ['INSERT OR IGNORE INTO entity_exposure_monthly (rep', 'INSERT OR IGNORE INTO fund_exposure_coverage (repo']);
});

// ── B3 idempotency ───────────────────────────────────────────────────────────────────────────────────────────────
test('B3 idempotency: second run has 0 candidates and writes 0; a failure inside batch() leaves 0 rows; next run completes', async () => {
  const db = makeDb(); enable(db);
  await runUntilDone(db);
  const before = [count(db, 'entity_exposure_monthly'), count(db, 'fund_exposure_coverage')];
  const again = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet });
  assert.equal(again.event, 'skipped'); assert.equal(again.reason, 'empty_input');
  assert.equal(again.metrics.rows_written, 0);
  assert.deepEqual([count(db, 'entity_exposure_monthly'), count(db, 'fund_exposure_coverage')], before);

  const f = makeDb(); enable(f);
  const failing = await runExpBackfill({ DB: d1(f, { failOn: sql => /INTO fund_exposure_coverage/.test(sql) }) }, { U: 0, now: TUE, log: quiet });
  assert.equal(failing.event, 'failed'); assert.equal(failing.error.class, 'EXPBF_D1_ERROR');
  assert.equal(count(f, 'entity_exposure_monthly'), 0, 'exposure INSERT rolled back with the coverage failure');
  assert.equal(count(f, 'fund_exposure_coverage'), 0);
  const { runs } = await runUntilDone(f);
  assert.equal(runs.at(-1).event, 'success');
  const ref = makeDb(); enable(ref); await runUntilDone(ref);
  assert.deepEqual(plain(rowsOf(f, 'exp')), plain(rowsOf(ref, 'exp')));
});

test('B3 done holders are excluded inside the batch (anti-join): a holder done by BF1 is never re-read or re-written', async () => {
  const db = makeDb(); enable(db);
  db.exec(`INSERT INTO fund_exposure_coverage VALUES ('2026-04', 37, 1, 1, 'g3v2-20261119')`);
  await runUntilDone(db);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM entity_exposure_monthly WHERE report_month = '2026-04' AND holder_entity_id = 37`).get().n, 0);
  assert.equal(db.prepare(`SELECT computed_at c FROM fund_exposure_coverage WHERE report_month = '2026-04' AND holder_entity_id = 37`).get().c, 'g3v2-20261119');
});

// ── B4 guards + not_enabled ──────────────────────────────────────────────────────────────────────────────────────
test('B4 guards: hold, pause, Sun/Mon, analytics null, U = 58,000 → skipped with 0 writes; B = min(cap, 60,000 − U); cap clamp', async () => {
  const cases = [
    ['hold', db => db.exec(`UPDATE holdings_pipeline_state SET value = 'true' WHERE key = 'hold_all_jobs'`), { U: 0, now: TUE }],
    ['pause', db => { db.exec(`DELETE FROM ops_job_pause`); enable(db, { registry: false, paused: true }); }, { U: 0, now: TUE }],
    ['out_of_window', () => {}, { U: 0, now: SUN }],
    ['out_of_window', () => {}, { U: 0, now: MON }],
    ['budget', () => {}, { U: null, now: TUE }],
    ['budget', () => {}, { U: 58000, now: TUE }],
    ['budget', () => {}, { U: 55001, now: TUE }],
  ];
  for (const [reason, prep, opts] of cases) {
    const db = makeDb(); enable(db); prep(db);
    const env = { DB: d1(db) };
    const r = await runExpBackfill(env, { ...opts, log: quiet });
    assert.equal(r.event, 'skipped', reason); assert.equal(r.reason, reason, JSON.stringify(opts));
    assert.equal(count(db, 'entity_exposure_monthly') + count(db, 'fund_exposure_coverage'), 0);
    assert.ok(!env.DB.log.some(x => /INSERT/.test(x.sql)), 'no write statement issued');
    assert.ok(!env.DB.log.some(x => /fund_holdings_monthly/.test(x.sql)), 'guards cost no holdings read');
  }
  const wed = makeDb(); enable(wed);
  assert.notEqual((await runExpBackfill({ DB: d1(wed) }, { U: 0, now: WED, log: quiet })).reason, 'out_of_window', 'Wednesday is a run day in November');
  assert.equal(dayBudget(40000, 30000), 30000);
  assert.equal(dayBudget(40000, 0), 40000);
  assert.equal(dayBudget(40000, 55000), 5000);
  assert.equal(dayBudget(40000, 55001), null);
  assert.equal(dayBudget(40000, null), null);
  assert.equal(capFromProfile(JSON.stringify({ daily_rows_written_cap: 70000 })), 50000);
  assert.equal(capFromProfile(JSON.stringify({ daily_rows_written_cap: 25000 })), 25000);
  for (const p of [null, '', 'not json', '{}', '{"daily_rows_written_cap":"40000"}', '{"daily_rows_written_cap":-1}', '{"write_guard":"HEADROOM=5,000"}'])
    assert.equal(capFromProfile(p), 40000, String(p));
  // through the DB: U = 30,000 with cap 40,000 → B = 30,000; profile 70,000 → B clamps at 50,000
  let db = makeDb(); enable(db, { cap: 40000 });
  assert.equal((await runExpBackfill({ DB: d1(db) }, { U: 30000, now: TUE, log: quiet })).metrics.budget_B, 30000);
  db = makeDb(); enable(db, { cap: 70000 });
  assert.equal((await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet })).metrics.budget_B, 50000);
  db = makeDb(); enable(db);
  assert.equal((await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet })).metrics.budget_B, 40000, 'no profile → 40,000');
});

test('extra: ships off — no registry row, or no pause row ever written → skipped/not_enabled, 0 writes, 0 heartbeats', async () => {
  for (const opt of [null, { registry: false }, { pauseRow: false }]) {
    const db = makeDb(); if (opt) enable(db, opt);
    const env = { DB: d1(db) };
    const r = await runExpBackfill(env, { U: 0, now: TUE, log: quiet });
    assert.equal(r.reason, 'not_enabled', JSON.stringify(opt));
    assert.equal(env.DB.log.length, 1, 'only the control read');
    let sent = 0;
    const s = await runExpBackfillStep({ DB: env.DB, OPS_INGEST_URL: 'https://ops.test/i', OPS_EMITTER: 'entities-enrich-cf', OPS_INGEST_KEY: 'k' },
      { waitUntil() {} }, { cron: '0 6 * * *' }, { U: 0, now: () => TUE, log: quiet, fetchImpl: async () => { sent++; return new Response('{}'); } });
    assert.equal(s.reason, 'not_enabled'); assert.equal(sent, 0);
    assert.equal(count(db, 'entity_exposure_monthly') + count(db, 'fund_exposure_coverage'), 0);
  }
});

// ── B5 budget loop ───────────────────────────────────────────────────────────────────────────────────────────────
async function projections(db) {
  const env = { DB: d1(db) };
  const cand = await env.DB.prepare(SQL.candidates).all();
  const { batches } = packBatches(cand.results);
  const out = [];
  for (const b of batches) {
    const c = (await env.DB.prepare(SQL.count).bind(b.m, b.lo, b.hi).all()).results[0];
    out.push({ ...b, proj: c.exposure_rows * 4 + c.coverage_rows * 2 });
  }
  return out;
}

test('B5 budget loop: stops before the batch that does not fit; never exceeds the remaining budget; spends real rows_written', async () => {
  const P = await projections((() => { const d = makeDb(); enable(d); return d; })());
  assert.ok(P.length >= 3);
  // exactly batches 1+2 fit
  let db = makeDb(); enable(db, { cap: P[0].proj + P[1].proj + P[2].proj - 1 });
  let r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.event, 'partial'); assert.equal(r.metrics.batches, 2);
  assert.equal(r.metrics.rows_written, P[0].proj + P[1].proj, 'projection = rows_written when the multiplier holds');
  assert.ok(r.metrics.rows_written <= r.metrics.budget_B);
  assert.ok(r.metrics.remaining_holder_months > 0 && r.metrics.oldest_open_month >= 202604, JSON.stringify(r.metrics));
  // real spend, not projection: D1 reports × 3 for exposure, so batch 3 fits after all
  db = makeDb(); enable(db, { cap: P[0].proj + P[1].proj + P[2].proj - 1 });
  r = await runExpBackfill({ DB: d1(db, { meta: (sql, m) => { if (/INTO entity_exposure_monthly/.test(sql)) m.rows_written = m.changes * 3; } }) }, { U: 0, now: TUE, log: quiet });
  assert.ok(r.metrics.batches >= 3, `spent uses meta.rows_written (batches ${r.metrics.batches})`);
  assert.ok(r.metrics.rows_written <= r.metrics.budget_B);
  // first batch does not fit → 0 batches, partial, nothing written
  db = makeDb(); enable(db, { cap: P[0].proj - 1 });
  r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.event, 'partial'); assert.equal(r.metrics.batches, 0); assert.equal(count(db, 'entity_exposure_monthly'), 0);
  // property: for many caps, Σ rows_written ≤ B and every written batch fitted what was left before it
  for (let cap = 50; cap <= 3000; cap += 97) {
    db = makeDb(); enable(db, { cap });
    const seen = [];
    r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: l => seen.push(l) });
    assert.ok(r.metrics.rows_written <= cap, `cap ${cap}: wrote ${r.metrics.rows_written}`);
  }
});

test('B5 overrun: rows_written > 1.25 × projection, or a statement reading > 50,000 rows → failed/EXPBF_BUDGET_OVERRUN, stop', async () => {
  let db = makeDb(); enable(db);
  let r = await runExpBackfill({ DB: d1(db, { meta: (sql, m) => { if (/INTO entity_exposure_monthly/.test(sql)) m.rows_written = m.changes * 6; } }) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.event, 'failed'); assert.equal(r.error.class, 'EXPBF_BUDGET_OVERRUN'); assert.equal(r.metrics.batches, 1);
  db = makeDb(); enable(db);
  r = await runExpBackfill({ DB: d1(db, { meta: (sql, m) => { if (/SELECT COUNT\(DISTINCT/.test(sql)) m.rows_read = 50001; } }) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.event, 'failed'); assert.equal(r.error.class, 'EXPBF_BUDGET_OVERRUN'); assert.equal(r.metrics.batches, 0);
  assert.equal(count(db, 'entity_exposure_monthly'), 0, 'count over 50k → nothing written');
  db = makeDb(); enable(db);
  r = await runExpBackfill({ DB: d1(db, { meta: (sql, m) => { if (/INTO fund_exposure_coverage/.test(sql)) m.rows_read = 60000; } }) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.event, 'failed'); assert.equal(r.error.class, 'EXPBF_BUDGET_OVERRUN'); assert.equal(r.metrics.batches, 1);
});

// ── B6 month floor, B7 incomplete ────────────────────────────────────────────────────────────────────────────────
test('B6 month floor: a complete 2026-03 is never selected or written', async () => {
  const db = makeDb(); enable(db);
  await runUntilDone(db);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_exposure_coverage WHERE report_month < '2026-04'`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM entity_exposure_monthly WHERE report_month < '2026-04'`).get().n, 0);
  const c = db.prepare(SQL.candidates).all();
  assert.equal(c.length, 0);
  // even a direct batch call for 2026-03 writes nothing (floor inside the batch SQL too)
  const env = { DB: d1(db) };
  await env.DB.batch([env.DB.prepare(SQL.exposureInsert).bind('2026-03', 0, 1e9, 't'), env.DB.prepare(SQL.coverageInsert).bind('2026-03', 0, 1e9, 't')]);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_exposure_coverage WHERE report_month < '2026-04'`).get().n, 0);
});

test('B7 incomplete holdings: a holder-month with only snapshot_status NULL rows is not a candidate and gets no row', async () => {
  const db = makeDb(); enable(db);
  const cand = db.prepare(SQL.candidates).all();
  assert.ok(!cand.some(c => c.m === '2026-05' && c.holder === 38));
  assert.ok(cand.some(c => c.m === '2026-04' && c.holder === 38));
  await runUntilDone(db);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_exposure_coverage WHERE report_month = '2026-05' AND holder_entity_id = 38`).get().n, 0);
  // once the holdings pipeline marks it complete, the next run day picks it up (recurring mode)
  db.exec(`UPDATE fund_holdings_monthly SET snapshot_status = 'complete' WHERE series_id = 'S03' AND report_month = '2026-05'`);
  const r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: WED, log: quiet });
  assert.equal(r.event, 'success'); assert.equal(r.metrics.holders_done, 1);
  assert.equal(db.prepare(`SELECT computed_at c FROM fund_exposure_coverage WHERE report_month = '2026-05' AND holder_entity_id = 38`).get().c, 'g3v2s-20261125-01');
});

test('oversize holder (> 18,000) is skipped and counted; months stay in order', async () => {
  const db = makeDb({ funds: [...FUNDS, ['ZZZ', 'S99', 47, 19000]] }); enable(db);
  const r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet });
  assert.equal(r.metrics.oversize_skipped, 3);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_exposure_coverage WHERE holder_entity_id = 47`).get().n, 0);
});

// ── tokens, days ─────────────────────────────────────────────────────────────────────────────────────────────────
test('extra: run token g3v2s-YYYYMMDD-NN (NN = batch number that day); never collides with BF1 g3v2-YYYYMMDD', async () => {
  assert.equal(runToken(TUE, 1), 'g3v2s-20261124-01');
  assert.equal(runToken(TUE, 12), 'g3v2s-20261124-12');
  const db = makeDb(); enable(db);
  const r = await runExpBackfill({ DB: d1(db) }, { U: 0, now: TUE, log: quiet });
  const toks = db.prepare(`SELECT DISTINCT computed_at t FROM fund_exposure_coverage ORDER BY 1`).all().map(x => x.t);
  assert.equal(toks.length, r.metrics.batches);
  toks.forEach((t, i) => assert.equal(t, `g3v2s-20261124-${String(i + 1).padStart(2, '0')}`));
  for (const t of toks) assert.match(t, /^g3v2s-\d{8}-\d{2}$/);
  const exTok = new Set(db.prepare(`SELECT DISTINCT computed_at t FROM entity_exposure_monthly`).all().map(x => x.t));
  for (const t of exTok) assert.ok(toks.includes(t));
});

test('extra: skip days are Sunday and Monday UTC only', () => {
  const days = Array.from({ length: 7 }, (_, i) => isSkipDay(new Date(Date.UTC(2026, 10, 22 + i, 6, 0, 30))));
  assert.deepEqual(days, [true, true, false, false, false, false, false]);   // Sun 22 … Sat 28 Nov
  assert.equal(isSkipDay(new Date('2026-11-24T00:30:00+02:00')), true, 'UTC day decides: Mon 23 Nov 22:30Z (Tue in UTC+2)');
});

test('heartbeat metrics: ≤ 16 flat integer keys, all present on every outcome', async () => {
  const db = makeDb(); enable(db);
  const r = await runExpBackfill({ DB: d1(db) }, { U: 1234, now: TUE, log: quiet });
  const f = BF.expbfEventFields(r);
  const keys = Object.keys(f.detail.metrics);
  assert.ok(keys.length <= 16 && keys.every(k => k.length <= 32 && Number.isInteger(f.detail.metrics[k])), JSON.stringify(f));
  assert.deepEqual(keys.sort(), ['analytics_U', 'batches', 'budget_B', 'exposure_rows', 'holders_done', 'oldest_open_month', 'oversize_skipped',
    'remaining_holder_months', 'rows_read_max_stmt', 'rows_read_total', 'rows_written'].sort());
  assert.equal(f.detail.metrics.analytics_U, 1234);
});

// ── B10 (local half): the plans the live check recorded, enforced on the fixture's copy of the live indexes ─────────
test('B10 local: holder-driven batch plans; candidates probe pinned to idx_holdings_status_series_month; no holdings SCAN', () => {
  const db = makeDb();
  db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshot_series ON fund_snapshot_monthly(series_id, report_month)`);
  const plan = (sql, ...p) => db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...p).map(r => r.detail);
  for (const [s, args] of [[SQL.count, ['2026-04', 36, 77]], [SQL.exposureInsert, ['2026-04', 36, 77, 't']], [SQL.coverageInsert, ['2026-04', 36, 77, 't']]]) {
    const d = plan(s, ...args);
    assert.ok(d.some(x => /SEARCH f USING INDEX idx_holdings_status_series_month \(snapshot_status=\? AND series_id=\? AND report_month=\?\)/.test(x)), d.join(' | '));
    assert.ok(d.some(x => /SEARCH fund_exposure_coverage USING COVERING INDEX sqlite_autoindex_fund_exposure_coverage_1 \(report_month=\?\)/.test(x)), d.join(' | '));
    assert.ok(!d.some(x => /SCAN (f|fund_holdings_monthly|instrument_entity_map|entity_merge_redirect)\b/.test(x)), d.join(' | '));
  }
  const c = plan(SQL.candidates);
  assert.ok(c.some(x => /SEARCH f EXISTS USING INDEX idx_holdings_status_series_month/.test(x)) || c.some(x => /idx_holdings_status_series_month/.test(x)), c.join(' | '));
  assert.ok(!c.some(x => /idx_holdings_series_month\b/.test(x)), c.join(' | '));
  assert.ok(!c.some(x => /SCAN (f|fund_holdings_monthly)\b/.test(x)), c.join(' | '));
  const ctl = plan(SQL.controls, EXPBF_JOB_ID, '2026-11-24T06:00:00Z');
  assert.ok(!ctl.some(x => /SCAN (?!CONSTANT ROW)/.test(x)), ctl.join(' | '));   // SCAN CONSTANT ROW = the FROM-less SELECT
  // pinned index missing → the statement errors (fail closed), never a silent scan
  const nx = makeDb(); nx.exec('DROP INDEX idx_holdings_status_series_month');
  assert.throws(() => nx.prepare(SQL.candidates).all(), /no such index/);
});
