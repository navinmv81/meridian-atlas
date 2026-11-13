// MA-NOV-EXP.W1 — route tests for R-EXP1 GET /api/exposure/etf/{symbol} (spec §3.2, §4.2; amendment A1)
// and the /api/entities/:id/etf-exposure per-holder-latest-month fix (spec §5.3).
// MA-NOV-EXP.W1R2: single-pass look-through, measured A1 cap (10,000 holdings = 50,000 rows / 5.0 per holding).
// MA-NOV-EXP.W1R3: one D1 statement per request (ETF + month + A1 guard + look-through + whole body + size cap);
// body-size cap (422 too_large, limit "size"); A1 guard proven to read no holdings rows (counting view).
// Runs the real Worker handler against a D1-shaped adapter over node:sqlite (in memory).
// No network, no D1.   Usage: node --test "App/Corporate Atlas/tests/exp-route.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = readFileSync(new URL('./fixtures/exp/schema.sql', import.meta.url), 'utf8');
const SEED = readFileSync(new URL('./fixtures/exp/seed.sql', import.meta.url), 'utf8');
const worker = (await import(new URL('../src/entities-api.js', import.meta.url).href)).default;

const db = new DatabaseSync(':memory:');
db.exec(SCHEMA);
db.exec(SEED);
// NOSNAP: 10,001 complete holdings (cap + 1) and no snapshot row → A1 must use COUNT(*) on the index range.
{
  const ins = db.prepare(`INSERT INTO fund_holdings_monthly (series_id, report_month, security_name, isin, weight_pct, snapshot_status)
                          VALUES ('SNOSNAP', '2026-04', 'Row', ?, 0.001, 'complete')`);
  db.exec('BEGIN');
  for (let i = 0; i < 10001; i++) ins.run(`ZZ${String(i).padStart(10, '0')}`);
  db.exec('COMMIT');
}

// D1-shaped adapter: prepare().bind().all()/first()/run(), meta.rows_read (fake: rows returned).
let calls = [];
function d1(database) {
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    async all() { calls.push({ sql, params }); const rows = database.prepare(sql).all(...params); return { results: rows, meta: { rows_read: rows.length } }; },
    async first() { calls.push({ sql, params }); return database.prepare(sql).get(...params) ?? null; },
    async run() { calls.push({ sql, params }); const r = database.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.all())) };
}
const env = { DB: d1(db) };

const logs = [];
const origLog = console.log;
console.log = (...a) => { logs.push(a.join(' ')); };
process.on('exit', () => { console.log = origLog; });

async function get(path) {
  calls = [];
  const res = await worker.fetch(new Request(`https://api.test${path}`), env, { waitUntil() {} });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* left null: assertion below fails */ }
  return { res, body, text, calls: calls.slice() };
}
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const ent = (body, id) => body.entities.find(e => e[0] === id);
const sum = xs => xs.reduce((s, x) => s + x, 0);

// ---------- R-EXP1 ----------

test('two-month ETF: latest complete month served, previous month named, partial month ignored', async () => {
  const { res, body } = await get('/api/exposure/etf/AAA');
  assert.equal(res.status, 200);
  assert.equal(body.report_month, '2026-04');          // 2026-05 is partial
  assert.equal(body.previous_month, '2026-03');
  assert.equal(body.symbol, 'AAA');
  assert.equal(body.series_id, 'SA');
  assert.equal(body.filing_date, '2026-06-20');
  assert.equal(body.period_end, '2026-04-30');
  assert.equal(body.holdings_count, 5);
  assert.equal(body.contract, 'exp-1');
  assert.match(body.computed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  assert.deepEqual(body.source, { dataset: 'SEC Form N-PORT holdings (meridian-holdings)', weights: 'percent of fund net assets as reported' });
});

test('?month= serves that stored month; its previous month is the next older one', async () => {
  const { res, body } = await get('/api/exposure/etf/AAA?month=2026-03');
  assert.equal(res.status, 200);
  assert.equal(body.report_month, '2026-03');
  assert.equal(body.previous_month, null);
  assert.ok(close(ent(body, 1)[2], 50) && close(ent(body, 4)[2], 50));
});

test('F1 ETF A look-through: X 10, Y 8, Z 5, W 74, unmapped 3 (spec §3.4)', async () => {
  const { body } = await get('/api/exposure/etf/AAA');
  const w = Object.fromEntries(body.entities.map(e => [e[0], e[2]]));
  assert.deepEqual(w, { 1: 10, 2: 8, 3: 5, 4: 74 });
  // W1R2: entity order is unspecified (spec §4.2 SQL has none; the client sorts) — compare as a set.
  assert.deepEqual(body.entities.map(e => e[0]).sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.equal(ent(body, 1)[1], 'X Corp');
  assert.deepEqual(body.tiers.unmapped, [1, 3]);
  assert.deepEqual(body.unmapped_top, [['Unmapped Co', 'XX0000000U01', 3]]);
});

test('heuristic tier kept, never dropped: minconf 0 and tier listed', async () => {
  const { body } = await get('/api/exposure/etf/AAA');
  const z = ent(body, 3);
  assert.equal(z[4], 'heuristic');
  assert.equal(z[5], 0, 'heuristic → minconf 0 → Low band');
  assert.deepEqual(body.tiers.heuristic, [1, 5]);
  assert.equal(ent(body, 4)[5], 90);                  // cusip_tier1 confidence kept
});

test('ISIN maps to exactly one entity (instrument_entity_map PK) — entity_isin_map fan-out ignored', async () => {
  const { body, calls } = await get('/api/exposure/etf/AAA');
  assert.equal(ent(body, 1)[2], 10);
  assert.equal(ent(body, 1)[3], 1, 'one holding row');
  assert.equal(ent(body, 2)[2], 8, 'Y not inflated by X’s ISIN fan-out');
  assert.equal(ent(body, 3)[2], 5, 'Z not inflated by X’s ISIN fan-out');
  assert.ok(!calls.some(c => /entity_isin_map/.test(c.sql)), 'route never reads entity_isin_map');
});

test('F1 ETF B: key derivation (ticker fallback, trimmed CUSIP), split identity Y′ kept separate, residual 8', async () => {
  const { body } = await get('/api/exposure/etf/BBB');
  assert.equal(body.report_month, '2026-02');
  assert.equal(body.previous_month, null);
  const w = Object.fromEntries(body.entities.map(e => [e[0], e[2]]));
  assert.deepEqual(w, { 1: 6, 6: 4, 3: 12, 5: 70 });
  assert.equal(ent(body, 1)[4], 'openfigi_tier1');
  assert.equal(ent(body, 2), undefined, 'Y′ is not merged into Y');
  const total = sum(Object.values(body.tiers).map(t => t[1]));
  assert.ok(close(100 - total, 8), `residual R_B = 8, got ${100 - total}`);
});

test('unmapped and no-identifier buckets; negative weights kept as reported (T7)', async () => {
  const { body } = await get('/api/exposure/etf/CCC');
  assert.deepEqual(body.entities.map(e => [e[0], e[2]]), [[1, 30]]);
  assert.deepEqual(body.tiers.unmapped, [1, 70]);
  assert.deepEqual(body.tiers.no_identifier, [2, -2]);
  assert.deepEqual(body.tiers.isin_tier1, [1, 30]);
  assert.equal(body.unmapped_top.length, 3, 'unmapped + both no-id rows listed');
  assert.deepEqual(body.unmapped_top[0], ['Unknown Ltd', 'XX0000000U02', 70]);
  assert.ok(body.unmapped_top.slice(1).every(r => r[1] === null), 'no-identifier rows carry a null key');
});

test('weights reconcile: Σ tiers = Σ holdings; Σ entities = Σ mapped tiers', async () => {
  for (const sym of ['AAA', 'BBB', 'CCC', 'RRR']) {
    const { body } = await get(`/api/exposure/etf/${sym}`);
    const series = body.series_id;
    const holdings = db.prepare(`SELECT SUM(weight_pct) s, COUNT(*) n FROM fund_holdings_monthly WHERE snapshot_status='complete' AND series_id=? AND report_month=?`).get(series, body.report_month);
    const tierW = sum(Object.values(body.tiers).map(t => t[1]));
    const tierN = sum(Object.values(body.tiers).map(t => t[0]));
    assert.ok(close(tierW, holdings.s), `${sym}: Σ tiers ${tierW} vs Σ holdings ${holdings.s}`);
    assert.equal(tierN, holdings.n, `${sym}: tier row counts cover every holding`);
    const mapped = sum(Object.entries(body.tiers).filter(([t]) => !['unmapped', 'no_identifier', 'redirect_unresolved'].includes(t)).map(([, v]) => v[1]));
    assert.ok(close(sum(body.entities.map(e => e[2])), mapped), `${sym}: Σ entities = Σ mapped tiers`);
    assert.ok(close(sum(body.unmapped_top.map(u => u[2])) + mapped, holdings.s), `${sym}: unmapped_top (≤25) + mapped = total`);
  }
});

test('merge redirect applied: one row for the survivor, none for the duplicate; two hops resolved; three hops unresolved (T8)', async () => {
  const { body } = await get('/api/exposure/etf/RRR');
  const ids = body.entities.map(e => e[0]);
  assert.ok(!ids.includes(900) && !ids.includes(910) && !ids.includes(911), 'no duplicate ids');
  const s = ent(body, 100);
  assert.equal(s[2], 30, '20 via 900→100 plus 10 direct');
  assert.equal(s[3], 2);
  assert.equal(s[6], 1, '"merged record" flag');
  assert.equal(s[1], 'Survivor S');
  const t = ent(body, 101);
  assert.equal(t[2], 15, 'two hops 910→911→101');
  assert.equal(t[6], 1);
  assert.ok(!ids.includes(920) && !ids.includes(923), 'a still-duplicate id after two hops is not served as a company');
  assert.deepEqual(body.tiers.redirect_unresolved, [1, 5]);
  assert.deepEqual(body.unmapped_top.find(u => u[1] === 'US00000R0004'), ['Deep chain', 'US00000R0004', 5]);
  // AAA has no redirected rows
  const a = await get('/api/exposure/etf/AAA');
  assert.ok(a.body.entities.every(e => e[6] === 0));
});

test('unknown symbol → 404 etf_not_found; malformed → 400', async () => {
  let r = await get('/api/exposure/etf/ZZZZ');
  assert.equal(r.res.status, 404);
  assert.equal(r.body.error, 'etf_not_found');
  r = await get('/api/exposure/etf/' + encodeURIComponent('A B'));
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error, 'invalid_symbol');
  assert.equal(r.calls.length, 0, 'no D1 call on bad input');
  r = await get('/api/exposure/etf/AAA?month=2026-13');
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error, 'invalid_month');
  r = await get('/api/exposure/etf/aaa');
  assert.equal(r.res.status, 200, 'symbol is case-insensitive');
  r = await get('/api/exposure/etf/BRK.B');
  assert.equal(r.res.status, 200, 'dotted tickers allowed');
});

test('no holdings → 404 no_holdings (no_series_id / none_complete); unknown month → 404 month_not_stored', async () => {
  let r = await get('/api/exposure/etf/NOSER');
  assert.equal(r.res.status, 404);
  assert.deepEqual([r.body.error, r.body.reason], ['no_holdings', 'no_series_id']);
  assert.equal(r.calls.length, 1);
  r = await get('/api/exposure/etf/PART');
  assert.equal(r.res.status, 404);
  assert.deepEqual([r.body.error, r.body.reason], ['no_holdings', 'none_complete']);
  assert.equal(r.res.headers.get('Cache-Control'), 'public, max-age=3600');
  r = await get('/api/exposure/etf/AAA?month=2026-05');   // partial month is not stored-complete
  assert.equal(r.res.status, 404);
  assert.equal(r.body.error, 'month_not_stored');
  assert.equal(r.body.latest_month, '2026-04');
  assert.equal(r.res.headers.get('Cache-Control'), 'no-store');
});

test('A1 (measured cap): 10,001 holdings → 422 too_large before aggregating; exactly 10,000 served; COUNT fallback without snapshot', async () => {
  logs.length = 0;
  let r = await get('/api/exposure/etf/BIG');
  assert.equal(r.res.status, 422);
  assert.equal(r.body.error, 'too_large');
  assert.equal(r.body.holdings_count, 10001);
  assert.equal(r.body.max_holdings, 10000, 'floor(50,000 / 5.0) to the 100 below');
  assert.equal(r.body.max_rows_read, 50000);
  assert.equal(r.body.estimated_rows_read, 10001 * 5, '5.0 rows/holding (highest measured 4.68, rounded up to 0.5)');
  assert.ok(r.body.max_holdings * 5 <= r.body.max_rows_read, 'the two A1 numbers agree');
  assert.equal(r.body.limit, 'rows', 'W1R3: which cap refused it');
  assert.equal(r.calls.length, 1, 'W1R3: one statement; the guard inside it skips the look-through');
  assert.equal(r.res.headers.get('Cache-Control'), 'no-store');
  assert.ok(logs.some(l => /^exp_lookthrough_refused BIG 2026-04 holdings=10001/.test(l)), 'refusal logged');
  r = await get('/api/exposure/etf/EDGE');
  assert.equal(r.res.status, 200, 'cap exactly → served');
  assert.equal(r.calls.length, 1);
  r = await get('/api/exposure/etf/NOSNAP');
  assert.equal(r.res.status, 422);
  assert.equal(r.body.holdings_count, 10001, 'counted from the holdings index');
});

test('≤ 4 D1 calls per request (W1R3: exactly 1 on every path) and the exp_lookthrough log line', async () => {
  for (const p of ['ZZZZ', 'NOSER', 'PART', 'AAA?month=2026-05', 'BIG', 'NOSNAP']) {
    assert.equal((await get(`/api/exposure/etf/${p}`)).calls.length, 1, p);
  }
  logs.length = 0;
  const r = await get('/api/exposure/etf/AAA');
  assert.equal(r.calls.length, 1);
  assert.ok(r.calls.length <= 4);
  assert.ok(r.calls.every(c => /^\s*(SELECT|WITH)\b/i.test(c.sql)), 'reads only');
  const line = logs.find(l => l.startsWith('exp_lookthrough '));
  assert.match(line, /^exp_lookthrough AAA 2026-04 \d+$/);
});

test('month lookup uses ORDER BY report_month DESC LIMIT 1 — never a correlated MAX', async () => {
  const r = await get('/api/exposure/etf/AAA');
  const monthSql = r.calls[0].sql;
  assert.match(monthSql, /ORDER BY report_month DESC LIMIT 1/);
  assert.doesNotMatch(r.calls.map(c => c.sql).join('\n'), /MAX\s*\(\s*report_month/i);
});

test('query plans (local SQLite): no SCAN of fund_holdings_monthly, instrument_entity_map, entity_merge_redirect, entity_master', async () => {
  const BIG_TABLES = /\bSCAN (fund_holdings_monthly|instrument_entity_map|entity_merge_redirect|entity_master|fund_snapshot_monthly|etf_master)\b/;
  for (const sym of ['AAA', 'RRR']) {
    const r = await get(`/api/exposure/etf/${sym}`);
    for (const c of r.calls) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${c.sql}`).all(...c.params).map(p => p.detail);
      assert.ok(!plan.some(d => BIG_TABLES.test(d)), `${sym}: ${plan.join(' | ')}`);
      assert.ok(!plan.some(d => /SCAN fund_holdings_monthly/.test(d)));
      // W1R3: tables appear under aliases too (m, rd1…, s, em); every SCAN must be of a one-row CTE / constant
      // row / the groups / json_each — never of a stored table under any name.
      const scans = plan.filter(d => /^SCAN /.test(d));
      assert.ok(scans.every(d => /^SCAN (p|m|i|a|b|g|CONSTANT ROW|json_each VIRTUAL TABLE.*|\(subquery-\d+\))( LEFT-JOIN)?$/.test(d)), scans.join(' | '));
    }
  }
});

test('Cache API: 200 stored 24 h at the edge (browser 1 h); 404 no_holdings stored 1 h; other errors never stored', async () => {
  const store = new Map();
  globalThis.caches = { default: {
    async match(req) { const e = store.get(req.url); return e ? new Response(e.text, { status: e.status, headers: e.headers }) : undefined; },
    async put(req, res) { store.set(req.url, { status: res.status, headers: Object.fromEntries(res.headers), text: await res.text() }); },
  } };
  try {
    const first = await get('/api/exposure/etf/AAA');
    assert.equal(first.res.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(first.res.headers.get('x-exp-cache'), 'miss');
    const key = [...store.keys()].find(k => k.includes('/AAA/'));
    assert.equal(key, 'https://exp-cache.meridian.internal/exp-1/g2/AAA/latest', 'W1R4 key = origin + contract + gen + symbol + month');
    assert.equal(store.get(key).headers['cache-control'], 'public, max-age=86400');
    const second = await get('/api/exposure/etf/AAA');
    assert.equal(second.calls.length, 0, 'cached: 0 D1 calls');
    assert.equal(second.res.headers.get('x-exp-cache'), 'hit');
    assert.equal(second.res.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(second.text, first.text);

    await get('/api/exposure/etf/PART');
    const pk = [...store.keys()].find(k => k.includes('/PART'));
    assert.equal(store.get(pk).status, 404);
    assert.equal(store.get(pk).headers['cache-control'], 'public, max-age=3600');

    await get('/api/exposure/etf/ZZZZ');
    await get('/api/exposure/etf/BIG');
    await get('/api/exposure/etf/AAA?month=2026-05');
    assert.ok(![...store.keys()].some(k => /\/(ZZZZ|BIG)\/|\/2026-05$/.test(k)), 'etf_not_found / too_large / month_not_stored not cached');
  } finally {
    delete globalThis.caches;
  }
});

// ---------- MA-NOV-EXP.W1R4: canonical, versioned cache key ----------

function keyCache() {
  const store = new Map();
  const seen = [];
  globalThis.caches = { default: {
    async match(req) { seen.push(req.url); const e = store.get(req.url); return e ? new Response(e.text, { status: e.status, headers: e.headers }) : undefined; },
    async put(req, res) { store.set(req.url, { status: res.status, headers: Object.fromEntries(res.headers), text: await res.text() }); },
  } };
  return { store, seen };
}

test('W1R4 key: eem and EEM-style case variants map to one key; second request is a hit', async () => {
  const { store, seen } = keyCache();
  try {
    const a = await get('/api/exposure/etf/aaa');
    const b = await get('/api/exposure/etf/AAA');
    assert.equal(seen[0], seen[1]);
    assert.equal(store.size, 1);
    assert.equal(a.res.headers.get('x-exp-cache'), 'miss');
    assert.equal(b.res.headers.get('x-exp-cache'), 'hit');
    assert.equal(b.calls.length, 0);
    assert.equal(b.text, a.text);
  } finally { delete globalThis.caches; }
});

test('W1R4 key: extra query parameters do not change the key', async () => {
  const { store, seen } = keyCache();
  try {
    await get('/api/exposure/etf/AAA');
    const x = await get('/api/exposure/etf/AAA?x=1');
    assert.equal(seen[1], seen[0]);
    assert.equal(x.res.headers.get('x-exp-cache'), 'hit');
    await get('/api/exposure/etf/AAA?month=2026-03');
    const y = await get('/api/exposure/etf/aaa?month=2026-03&y=2');
    assert.equal(seen[3], seen[2]);
    assert.equal(y.res.headers.get('x-exp-cache'), 'hit');
    assert.equal(store.size, 2);
    for (const k of store.keys()) assert.ok(!/[?#]/.test(k), `no query in key: ${k}`);
  } finally { delete globalThis.caches; }
});

test('W1R4 key: month vs no month differ; key carries contract and EXP_CACHE_GEN', async () => {
  const { seen } = keyCache();
  try {
    await get('/api/exposure/etf/AAA');
    await get('/api/exposure/etf/AAA?month=2026-03');
    assert.notEqual(seen[0], seen[1]);
    assert.equal(seen[0], 'https://exp-cache.meridian.internal/exp-1/g2/AAA/latest');
    assert.equal(seen[1], 'https://exp-cache.meridian.internal/exp-1/g2/AAA/2026-03');
    const src = readFileSync(new URL('../src/entities-api.js', import.meta.url), 'utf8');
    const gen = src.match(/const EXP_CACHE_GEN = '([^']+)'/)[1];
    for (const k of seen) assert.ok(k.includes(`/${gen}/`), `key contains EXP_CACHE_GEN (${gen})`);
  } finally { delete globalThis.caches; }
});

test('W1R4 key: invalid symbol or month never reaches the cache', async () => {
  const { store, seen } = keyCache();
  try {
    for (const p of ['/api/exposure/etf/%27%20OR%201=1', '/api/exposure/etf/AAA?month=2026-13', '/api/exposure/etf/AAA?month=x',
                     '/api/exposure/etf/' + 'A'.repeat(20), '/api/exposure/etf/%E0%A4%A']) {
      const r = await get(p);
      assert.equal(r.res.status, 400, p);
      assert.equal(r.calls.length, 0, p);
    }
    assert.equal(seen.length, 0, 'no cache.match for invalid input');
    assert.equal(store.size, 0, 'no cache.put for invalid input');
  } finally { delete globalThis.caches; }
});

test('POST is not routed; CORS headers present', async () => {
  const res = await worker.fetch(new Request('https://api.test/api/exposure/etf/AAA', { method: 'POST' }), env, {});
  assert.equal(res.status, 404);
  const ok = await get('/api/exposure/etf/AAA');
  assert.equal(ok.res.headers.get('Access-Control-Allow-Origin'), '*');
});

// ---------- W1R2 single-pass look-through ----------

test('W1R2: names come from entity_master in the same statement (null when the entity has no row)', async () => {
  for (const sym of ['AAA', 'BBB', 'RRR', 'UNM']) {
    const { body } = await get(`/api/exposure/etf/${sym}`);
    for (const e of body.entities) {
      const row = db.prepare('SELECT name FROM entity_master WHERE entity_id = ?').get(e[0]);
      assert.equal(e[1], row ? row.name : null, `${sym} entity ${e[0]}`);
    }
  }
  const { body } = await get('/api/exposure/etf/UNM');
  assert.deepEqual(ent(body, 7), [7, null, 5, 1, 'isin_tier1', 95, 0]);
});

test('W1R2: per-entity tier list is alphabetical and distinct; tiers object omits tiers with no rows', async () => {
  const r = await get('/api/exposure/etf/RRR');
  assert.equal(ent(r.body, 100)[4], 'cusip_tier1,isin_tier1', 'survivor 100: 900→100 isin + 100 direct cusip');
  assert.equal(ent(r.body, 100)[5], 80, 'minconf over both rows');
  const a = await get('/api/exposure/etf/AAA');
  assert.deepEqual(Object.keys(a.body.tiers), ['cusip_tier1', 'heuristic', 'isin_tier1', 'unmapped']);
  assert.ok(!('openfigi_tier1' in a.body.tiers) && !('no_identifier' in a.body.tiers) && !('redirect_unresolved' in a.body.tiers));
});

test('W1R2: unmapped_top = the 25 heaviest unmapped rows, weight desc then key; unmapped rows never merged', async () => {
  const { body } = await get('/api/exposure/etf/UNM');
  // weights 0.1 … 3.0 (= 46.5) with row 02 at 1.5 instead of 0.2 → 47.8
  assert.equal(body.tiers.unmapped[0], 30);
  assert.ok(close(body.tiers.unmapped[1], 47.8));
  assert.equal(body.unmapped_top.length, 25);
  assert.deepEqual(body.unmapped_top[0], ['Unmapped 30', 'XU0000000030', 3]);
  assert.deepEqual(body.unmapped_top.at(-1), ['Unmapped 07', 'XU0000000007', 0.7]);
  const keys = body.unmapped_top.map(u => u[1]);
  assert.ok(keys.indexOf('XU0000000002') === keys.indexOf('XU0000000015') - 1, 'tie at 1.5: key order (02 before 15)');
  for (const cut of ['01', '03', '04', '05', '06']) assert.ok(!keys.includes(`XU00000000${cut}`), `row ${cut} cut`);
  for (let i = 1; i < 25; i++) assert.ok(body.unmapped_top[i - 1][2] >= body.unmapped_top[i][2], 'weight desc');
  assert.equal(new Set(keys).size, 25, 'one row per unmapped holding');
});

test('W1R2: single pass — one holdings range read, one GROUP BY sorter; no DISTINCT / entity sort; only the one-row i, m materialized', async () => {
  const r = await get('/api/exposure/etf/AAA');
  const sql = r.calls[0].sql;
  assert.deepEqual([...sql.matchAll(/(\w+) AS MATERIALIZED/g)].map(x => x[1]), ['m', 'i'], 'W1R3: only the one-row month/info CTEs');
  assert.doesNotMatch(sql, /GROUP_CONCAT\s*\(\s*DISTINCT/i);
  assert.doesNotMatch(sql, /entity_isin_map/);
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...r.calls[0].params).map(p => p.detail);
  // The holdings range (non-covering: it reads weight/name/keys) is opened once; the rest are month probes.
  assert.equal(plan.filter(d => /fund_holdings_monthly USING INDEX/.test(d)).length, 1, plan.join(' | '));
  assert.ok(plan.filter(d => /fund_holdings_monthly USING COVERING INDEX/.test(d)).every(d => /LIMIT|\(snapshot_status=\? AND series_id=\?( AND report_month[=<]\?)?\)/.test(d)));
  assert.equal(plan.filter(d => /TEMP B-TREE FOR GROUP BY/.test(d)).length, 1, plan.join(' | '));
  assert.equal(plan.filter(d => /\bentity_master\b|\bem\b/.test(d)).length, 1, 'names: one rowid probe per group');
});

// ---------- W1R3 body-size cap and A1 guard ----------

// PAD: one holding mapped to entity 9001, whose name is resized to move the body across the size cap.
db.exec(`INSERT INTO etf_master (ticker, name, series_id) VALUES ('PAD', 'Pad ETF', 'SPAD');
  INSERT INTO fund_snapshot_monthly VALUES ('SPAD', '2026-04', 1.0e9, 1, '2026-06-21', '2026-04-30');
  INSERT INTO fund_holdings_monthly (series_id, report_month, security_name, isin, weight_pct, snapshot_status)
    VALUES ('SPAD', '2026-04', 'Pad ord', 'XP0000000P01', 100, 'complete');
  INSERT INTO instrument_entity_map VALUES ('XP0000000P01', 9001, 'isin_tier1', 100);
  INSERT INTO entity_master (entity_id, name) VALUES (9001, 'P');`);
const padName = n => db.prepare('UPDATE entity_master SET name = ? WHERE entity_id = 9001').run('P'.repeat(n));

test('W1R3 size cap: body > cap → 422 too_large limit "size" (bytes, cap); exactly cap → 200; cap + 1 → 422', async () => {
  padName(1);
  const small = await get('/api/exposure/etf/PAD');
  assert.equal(small.res.status, 200);
  const base = Buffer.byteLength(small.text) - 1;            // body bytes minus the 1-char name
  padName(2_000_000);
  let r = await get('/api/exposure/etf/PAD');
  assert.equal(r.res.status, 422);
  assert.equal(r.body.error, 'too_large');
  assert.equal(r.body.limit, 'size');
  assert.equal(r.body.body_bytes, base + 2_000_000, 'UTF-8 byte count measured in D1');
  const cap = r.body.max_body_bytes;
  assert.equal(cap, 131072, 'W1R3: 128 KiB (report §3) — serves EEM 68 KB, SPAB 75 KB, BNDX 51 KB; refuses VXUS 369 KB');
  assert.equal(r.body.report_month, '2026-04');
  assert.equal(r.body.holdings_count, 1);
  assert.equal(r.calls.length, 1);
  assert.ok(!r.text.includes('PPPPPPPPPP'), 'the refused body never reaches the Worker');
  assert.equal(r.res.headers.get('Cache-Control'), 'public, max-age=3600', 'size refusal cached 1 h (re-reading it costs the full look-through)');

  padName(cap - base);
  r = await get('/api/exposure/etf/PAD');
  assert.equal(r.res.status, 200, 'exactly at the cap → served');
  assert.equal(Buffer.byteLength(r.text), cap);
  assert.equal(r.body.entities[0][1].length, cap - base);

  padName(cap - base + 1);
  r = await get('/api/exposure/etf/PAD');
  assert.equal(r.res.status, 422, 'cap + 1 byte → refused');
  assert.equal(r.body.body_bytes, cap + 1);

  // Multi-byte names: the cap counts UTF-8 bytes, not characters.
  db.prepare('UPDATE entity_master SET name = ? WHERE entity_id = 9001').run('Ş'.repeat(Math.ceil((cap - base) / 2) + 1));
  r = await get('/api/exposure/etf/PAD');
  assert.equal(r.res.status, 422, '2-byte characters counted as 2');
  padName(1);
});

test('W1R3 size refusal is cached at the edge 1 h; rows refusal is not', async () => {
  const store = new Map();
  globalThis.caches = { default: {
    async match(req) { const e = store.get(req.url); return e ? new Response(e.text, { status: e.status, headers: e.headers }) : undefined; },
    async put(req, res) { store.set(req.url, { status: res.status, headers: Object.fromEntries(res.headers), text: await res.text() }); },
  } };
  try {
    padName(2_000_000);
    const first = await get('/api/exposure/etf/PAD');
    assert.equal(first.res.status, 422);
    const k = [...store.keys()].find(x => x.includes('/PAD'));
    assert.equal(store.get(k).headers['cache-control'], 'public, max-age=3600');
    const second = await get('/api/exposure/etf/PAD');
    assert.equal(second.calls.length, 0);
    assert.equal(second.res.status, 422);
    assert.equal(second.res.headers.get('x-exp-cache'), 'hit');
    await get('/api/exposure/etf/BIG');
    assert.ok(![...store.keys()].some(x => x.includes('/BIG')), 'rows refusal not cached (it costs ≈ 4 rows)');
  } finally {
    padName(1);
    delete globalThis.caches;
  }
});

test('W1R3 served body: byte-identical between client and cache copy; header fields from the same statement', async () => {
  const store = new Map();
  globalThis.caches = { default: {
    async match() { return undefined; },
    async put(req, res) { store.set(req.url, new Uint8Array(await res.arrayBuffer())); },
  } };
  try {
    const r = await get('/api/exposure/etf/AAA');
    const cached = [...store.values()][0];
    assert.equal(Buffer.from(cached).toString('utf8'), r.text);
    assert.deepEqual(Object.keys(r.body), ['symbol', 'name', 'series_id', 'report_month', 'previous_month', 'filing_date',
      'period_end', 'net_assets', 'holdings_count', 'tiers', 'entities', 'unmapped_top', 'source', 'computed_at', 'contract'], 'spec §4.2 field order');
    assert.equal(r.body.name, db.prepare(`SELECT name FROM etf_master WHERE ticker = 'AAA'`).get().name);
  } finally {
    delete globalThis.caches;
  }
});

test('W1R3 A1 guard: a refused ETF reads no holdings rows (counting view over fund_holdings_monthly)', async () => {
  const db2 = new DatabaseSync(':memory:');
  db2.exec(SCHEMA);
  db2.exec(SEED);
  let ticks = 0;
  db2.function('tick', { deterministic: false }, () => { ticks++; return 1; });
  db2.exec(`ALTER TABLE fund_holdings_monthly RENAME TO fhm_base;
    CREATE VIEW fund_holdings_monthly AS SELECT * FROM fhm_base WHERE tick();
    INSERT INTO etf_master VALUES ('HUGE', 'Huge ETF', 'SHUGE');
    INSERT INTO fund_snapshot_monthly VALUES ('SHUGE', '2026-04', 1.0e9, 10001, '2026-06-21', '2026-04-30');`);
  const ins = db2.prepare(`INSERT INTO fhm_base (series_id, report_month, security_name, isin, weight_pct, snapshot_status)
                           VALUES ('SHUGE', '2026-04', 'Row', ?, 0.01, 'complete')`);
  db2.exec('BEGIN');
  for (let i = 0; i < 10001; i++) ins.run(`ZH${String(i).padStart(10, '0')}`);
  db2.exec('COMMIT');
  const env2 = { DB: d1(db2) };
  const call = async p => { ticks = 0; const res = await worker.fetch(new Request(`https://api.test${p}`), env2, { waitUntil() {} }); return { res, body: await res.json(), ticks }; };

  let r = await call('/api/exposure/etf/HUGE');
  assert.equal(r.res.status, 422);
  assert.equal(r.body.limit, 'rows');
  assert.ok(r.ticks <= 8, `refused: only the month probes touch holdings (${r.ticks} rows)`);
  db2.exec(`UPDATE fund_snapshot_monthly SET holdings_count = 10000 WHERE series_id = 'SHUGE'`);
  r = await call('/api/exposure/etf/HUGE');
  assert.equal(r.res.status, 200);
  assert.ok(r.ticks >= 10001, `served: the range is read (${r.ticks} rows)`);
  assert.equal(r.body.tiers.unmapped[0], 10001);
});

// ---------- /api/entities/:id/etf-exposure per-holder month ----------

test('/etf-exposure: each holder at its own latest month (Fund B at 2026-03 no longer dropped)', async () => {
  const { res, body, calls } = await get('/api/entities/1/etf-exposure');
  assert.equal(res.status, 200);
  assert.deepEqual(body.exposures, [
    { etf_symbol: 'AAA', etf_name: 'Fund A Trust', weight_sum: 12, report_month: '2026-05', holder_entity_id: 500 },
    { etf_symbol: 'BBB', etf_name: 'Fund B Trust', weight_sum: 7, report_month: '2026-03', holder_entity_id: 501 },
  ]);
  assert.equal(body.funds, 2);
  assert.equal(body.months_min, '2026-03');
  assert.equal(body.months_max, '2026-05');
  assert.equal(body.computed_at, '2026-11-12T01:00:00Z');
  assert.equal(calls.length, 1);
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${calls[0].sql}`).all(...calls[0].params).map(p => p.detail);
  assert.ok(!plan.some(d => /SCAN (entity_exposure_monthly|eem)\b/.test(d)), plan.join(' | '));
});

test('/etf-exposure: entity with no exposure → empty list, additive fields null/0', async () => {
  const { res, body } = await get('/api/entities/2/etf-exposure');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { exposures: [], funds: 0, months_min: null, months_max: null, computed_at: null });
  const bad = await get('/api/entities/0/etf-exposure');
  assert.equal(bad.res.status, 400, 'id 0 → Invalid entity_id (unchanged behaviour)');
});
