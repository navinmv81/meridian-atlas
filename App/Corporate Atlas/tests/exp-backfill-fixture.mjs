// MA-NOV-EXP.BFS.BUILD — shared fixture for tests/exp-backfill*.test.mjs: in-memory node:sqlite with the live DDL
// subset (fixtures/exp-backfill/schema.sql + App/Ops/migrations 002/003), a synthetic 12-fund × 4-month holdings set,
// and a D1-shaped adapter (batch() = one transaction; meta.rows_written emulates D1's index writes).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const rd = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const SCHEMA = rd('./fixtures/exp-backfill/schema.sql');
const OPS_002 = rd('../../Ops/migrations/002-ops-control-plane.sql');
const OPS_003 = rd('../../Ops/migrations/003-ops-job-pause.sql');
export const EXPBF_JOB_ID = 'cf.meridian-entities-enrich.expbf';

// ── fixture ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

// Funds: [symbol, series, holder, snapshot holdings_count]. Holder 40 has two series (summed, as DISTINCT fel does).
export const FUNDS = [
  ['AAA', 'S01', 36, 3000], ['BBB', 'S02', 37, 4000], ['CCC', 'S03', 38, 5000], ['DDD', 'S04', 39, 2500],
  ['EEA', 'S05', 40, 1500], ['EEB', 'S06', 40, 1200], ['FFF', 'S07', 41, 13000 /* solo */], ['GGG', 'S08', 42, 6000],
  ['HHH', 'S09', 43, 7000], ['III', 'S10', 44, 900], ['JJJ', 'S11', 45, 11000], ['KKK', 'S12', 46, 800],
];
export const MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06'];

function instrumentPool(r) {
  const pool = [];
  for (let i = 0; i < 140; i++) {
    const t = i % 7;
    const id = String(i).padStart(4, '0');
    if (t === 0 || t === 1 || t === 2) pool.push({ isin: `US00000${id}1`, cusip: null, ticker: null, key: `US00000${id}1` });          // ISIN 12
    else if (t === 3) pool.push({ isin: ` US0000${id}X `.slice(0, 11), cusip: `  00${id}A1 `, ticker: 'zz', key: `CUSIP:00${id}A1` }); // short ISIN → CUSIP
    else if (t === 4) pool.push({ isin: null, cusip: '000000000', ticker: ` t${id} `, key: `TICKER:T${id}` });                       // zero CUSIP → ticker
    else if (t === 5) pool.push({ isin: '', cusip: '12345', ticker: '', key: null });                                                 // no key
    else pool.push({ isin: null, cusip: `9${id}ZZZ`, ticker: null, key: `CUSIP:9${id}ZZZ` });
  }
  return pool;
}

export function makeDb({ seed = 7, funds = FUNDS, months = MONTHS, incomplete = [['S03', '2026-05']], rowsPerFund = 35 } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA); db.exec(OPS_002); db.exec(OPS_003);
  db.exec(`INSERT INTO holdings_pipeline_state (key, value) VALUES ('hold_all_jobs', 'false')`);
  const r = rng(seed);
  const pool = instrumentPool(r);
  const map = db.prepare(`INSERT INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES (?, ?, 'isin_tier1', 90)`);
  pool.forEach((p, i) => { if (p.key && i % 10 !== 9) map.run(p.key, 1000 + (i % 25)); });
  // redirects: 1001→1002 (1 hop); 1003→1004→1005 (2 hops); 1006→1007→1008→1009 (3 hops → not mapped)
  const red = db.prepare(`INSERT INTO entity_merge_redirect (duplicate_id, survivor_id, merged_at, packet) VALUES (?, ?, '2026-10-01', 'T')`);
  for (const [d, s] of [[1001, 1002], [1003, 1004], [1004, 1005], [1006, 1007], [1007, 1008], [1008, 1009]]) red.run(d, s);
  const link = db.prepare(`INSERT INTO fund_entity_link (etf_symbol, series_id, entity_id) VALUES (?, ?, ?)`);
  link.run('NOSERIES', null, 99);
  const snap = db.prepare(`INSERT INTO fund_snapshot_monthly (series_id, report_month, holdings_count) VALUES (?, ?, ?)`);
  const hold = db.prepare(`INSERT INTO fund_holdings_monthly (series_id, report_month, security_name, cusip, isin, security_ticker, weight_pct, snapshot_status)
                           VALUES (?, ?, 'x', ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  for (const [sym, series, holder, n] of funds) {
    link.run(sym, series, holder);
    for (const m of months) {
      snap.run(series, m, n);
      const status = incomplete.some(([s, mm]) => s === series && mm === m) ? null : 'complete';
      for (let i = 0; i < rowsPerFund; i++) {
        const p = pool[Math.floor(r() * pool.length)];
        hold.run(series, m, p.cusip, p.isin, p.ticker, Math.round(r() * 5000) / 1000, status);
      }
    }
  }
  db.exec('COMMIT');
  return db;
}

// Ops rows as BFS.OPS will create them. paused: open pause row; enabled false: none at all.
export function enable(db, { cap = null, paused = false, registry = true, pauseRow = true } = {}) {
  if (registry) db.prepare(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, worker_name, emitter_id, write_budget_profile)
                            VALUES (?, 'expbf', 'Entities', 'Data-Identity Lead', 'cron', 'meridian-entities-enrich', 'entities-enrich-cf', ?)`)
                  .run(EXPBF_JOB_ID, cap === null ? null : JSON.stringify({ daily_rows_written_cap: cap }));
  if (pauseRow) db.prepare(`INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by) VALUES (?, ?, ?, 'ship off', 'ops_lead:wrangler')`)
                  .run(EXPBF_JOB_ID, '2026-11-20T00:00:00Z', paused ? '2099-01-01T00:00:00Z' : '2026-11-21T00:00:00Z');
}

// D1-shaped adapter. rows_written emulates D1 (table + indexes): exposure × 4, coverage × 2, other writes × 1.
// Hooks: meta(sql, meta) may change meta; failOn(sql) → throw (inside batch(): the transaction rolls back).
export function d1(db, { meta = null, failOn = null } = {}) {
  const log = [];
  const mult = sql => /INTO entity_exposure_monthly/.test(sql) ? 4 : /INTO fund_exposure_coverage/.test(sql) ? 2 : 1;
  const exec = (sql, args) => {
    log.push({ sql, args });
    if (failOn && failOn(sql)) throw new Error('D1_ERROR: forced failure');
    let out;
    if (/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)) {
      const r = db.prepare(sql).run(...args);
      out = { results: [], meta: { changes: Number(r.changes), rows_written: Number(r.changes) * mult(sql), rows_read: 100 } };
    } else {
      const results = db.prepare(sql).all(...args);
      out = { results, meta: { rows_read: Math.max(1, results.length), rows_written: 0 } };
    }
    if (meta) meta(sql, out.meta);
    return out;
  };
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async all() { return exec(sql, args); },
    async first() { return exec(sql, args).results[0] ?? null; },
    async run() { return exec(sql, args); },
    execSync: () => exec(sql, args),
  });
  return {
    log,
    prepare: sql => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try { const o = list.map(s => s.execSync()); db.exec('COMMIT'); return o; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

