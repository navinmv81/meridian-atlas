// MA-NOV-UIT.BUILD tests — node --test --no-warnings "App/ETF Refresh/uit/tests/"
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as L from '../uit-nport-load.mjs';
import { seedDb, parseSqlFile, runBatches, dump } from '../lib/dryrun-lib.mjs';
import { dryRun } from '../uit-dryrun.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UIT = path.join(HERE, '..');
const seed = JSON.parse(fs.readFileSync(path.join(UIT, 'seed', 'd1-before.json'), 'utf8'));
const applyText = fs.readFileSync(path.join(UIT, 'apply', 'uit-apply-run1.sql'), 'utf8');
const rollbackText = fs.readFileSync(path.join(UIT, 'apply', 'uit-rollback-run1.sql'), 'utf8');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const PIPELINE_HEAD_SHA = '5558bec047c33677f7e9ebf6f12d6eb8e831012139082f574ebc935e25872943'; // git HEAD c5581cf blob, before the edit

// Independent, non-recording D1 adapter over node:sqlite (the "direct run").
function directD1(db) {
  const mk = (sql, p = []) => ({
    bind: (...q) => mk(sql, q),
    run: async () => { const r = db.prepare(sql).run(...p.map((v) => v ?? null)); return { meta: { changes: Number(r.changes), rows_written: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p.map((v) => v ?? null)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p.map((v) => v ?? null)) }),
    _sql: sql, _p: p,
  });
  return { prepare: (s) => mk(s), batch: async (st) => Promise.all(st.map((s) => s.run())) };
}

test('holdings-pipeline.js: the only change is `export` on storeHoldings', () => {
  const src = fs.readFileSync(L.PATHS.pipeline, 'utf8');
  assert.equal((src.match(/^export async function storeHoldings\(/gm) || []).length, 1);
  assert.equal(sha(src.replace(/^export async function storeHoldings\(/m, 'async function storeHoldings(')), PIPELINE_HEAD_SHA);
});

test('keys: SPY/DIA/MDY surrogate C+CIK, QQQ real series id from its header', () => {
  const keys = Object.fromEntries(L.FUNDS.map((f) => [f.ticker, L.keyFor(f, L.parseHeader(L.readXml(f)))]));
  assert.deepEqual(keys.SPY, { key: 'C0000884394', keyType: 'surrogate' });
  assert.deepEqual(keys.DIA, { key: 'C0001041130', keyType: 'surrogate' });
  assert.deepEqual(keys.MDY, { key: 'C0000936958', keyType: 'surrogate' });
  assert.deepEqual(keys.QQQ, { key: 'S000101292', keyType: 'series' });
  assert.throws(() => L.keyFor({ cik: '884394' }, {}), /bad cik/);
  assert.deepEqual(L.keyFor({ cik: '0000000001' }, { seriesId: 'N/A' }), { key: 'C0000000001', keyType: 'surrogate' });
  for (const f of L.FUNDS) {
    const h = L.parseHeader(L.readXml(f));
    assert.equal(parseInt(h.regCik, 10), parseInt(f.cik, 10), `${f.ticker} regCik`);
    assert.equal(h.repPdDate, f.period, `${f.ticker} period`);
  }
});

test('cache files match manifest sha256', () => {
  const m = JSON.parse(fs.readFileSync(path.join(UIT, 'cache', 'manifest.json'), 'utf8'));
  for (const f of L.FUNDS) assert.equal(sha(fs.readFileSync(path.join(UIT, 'cache', m[f.ticker].file))), m[f.ticker].sha256_gz);
});

test('shim fidelity: apply SQL produces exactly the rows a direct storeHoldings run writes', async () => {
  const { storeHoldings } = await import(pathToFileURL(L.PATHS.pipeline).href);
  const direct = seedDb(seed);
  const d1 = directD1(direct);
  for (const f of L.FUNDS) {
    const xml = L.readXml(f);
    const { key } = L.keyFor(f, L.parseHeader(xml));
    await storeHoldings(d1, key, f.ticker, f.period.slice(0, 7), f.fileDate, xml, 0);
  }
  const applied = seedDb(seed);
  runBatches(applied, parseSqlFile(applyText));
  const keys = "('C0000884394','S000101292','C0001041130','C0000936958')";
  const cols = 'series_id, report_month, ticker, security_name, cusip, isin, security_ticker, position_value, weight_pct, shares, asset_cat, issuer_country, is_restricted, snapshot_status';
  const h = (db) => db.prepare(`SELECT ${cols} FROM fund_holdings_monthly WHERE series_id IN ${keys} ORDER BY id`).all();
  const s = (db) => db.prepare(`SELECT * FROM fund_snapshot_monthly WHERE series_id IN ${keys} ORDER BY series_id`).all().map(({ created_at, ...r }) => r);
  assert.equal(h(direct).length, 1039);
  assert.deepEqual(h(applied), h(direct));
  assert.deepEqual(s(applied), s(direct));
  // Untouched controls identical.
  assert.equal(dump(applied).fund_holdings_monthly.rows, 1026 + 1039);
});

test('apply file: batches ≤ 100, no holdings_pipeline_state, no DELETE, deterministic rebuild', async () => {
  const batches = parseSqlFile(applyText);
  assert.ok(batches.every((b) => b.stmts.length <= 100));
  assert.ok(!/holdings_pipeline_state/.test(applyText.split('\n').filter((l) => !l.startsWith('--')).join('\n')));
  assert.ok(!/^DELETE/m.test(applyText));
  const b = await L.buildAll();
  const again = L.renderFile(applyText.split('\n').slice(0, 4).map((l) => l.slice(3)), b.applyLines, b.applyBatches);
  assert.equal(again, applyText);
  assert.ok(!/holdings_pipeline_state/.test(rollbackText));
});

test('dry run: apply ok, re-apply 0, rollback identical to seed, rollback twice 0', () => {
  const r = dryRun({ seed, applyText, rollbackText });
  assert.ok(r.apply.every((b) => b.ok));
  assert.equal(r.reapply_total, 0);
  assert.ok(r.reapply_identical);
  assert.ok(r.rollback.every((b) => b.ok));
  assert.equal(r.rollback_again_total, 0);
  assert.ok(r.rollback_identical_to_seed);
  const spy = r.etf_master_after.find((x) => x.ticker === 'SPY');
  assert.deepEqual([spy.series_id, spy.has_nport, spy.coverage_status, spy.coverage_depth], ['C0000884394', 1, 'deep', 1]);
});

test('guard: etf_master row that moved is not touched (and the vector catches it)', () => {
  const db = seedDb(seed);
  db.prepare(`UPDATE etf_master SET notes = 'changed by someone' WHERE ticker = 'DIA'`).run();
  const before = db.prepare(`SELECT * FROM etf_master WHERE ticker = 'DIA'`).get();
  assert.throws(() => runBatches(db, parseSqlFile(applyText)), /batch 9 changes/);
  assert.deepEqual(db.prepare(`SELECT * FROM etf_master WHERE ticker = 'DIA'`).get(), before);
});

test('guard: inserts are skipped if the fund-month snapshot already exists', () => {
  const db = seedDb(seed);
  db.prepare(`INSERT INTO fund_snapshot_monthly (series_id, report_month, ticker) VALUES ('C0000884394', '2026-09', 'SPY')`).run();
  const res = runBatches(db, parseSqlFile(applyText).slice(0, 6), { strict: false });
  // Every insert, the mark-complete and the snapshot insert change nothing; only the (still-guarded) etf_master update applies.
  assert.deepEqual(res.flatMap((b) => b.got), [...Array(504 + 2).fill(0), 1]);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_holdings_monthly WHERE series_id = 'C0000884394'`).get().n, 0);
});

test('guard: partial apply then full re-run inserts no duplicates', () => {
  const db = seedDb(seed);
  const batches = parseSqlFile(applyText);
  runBatches(db, batches.slice(0, 3));
  const res = runBatches(db, batches, { strict: false });
  assert.deepEqual(res.slice(0, 3).map((b) => b.total), [0, 0, 0]);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM fund_holdings_monthly WHERE series_id = 'C0000884394'`).get().n, 504);
});

test('classify refuses unknown statements and a coverage downgrade', async () => {
  assert.throws(() => L.classify([{ sql: 'DROP TABLE etf_master', params: [] }]), /unrecognised/);
  const tiny = `<edgarSubmission><genInfo><regCik>0000000001</regCik><seriesName>N/A</seriesName><repPdDate>2026-09-30</repPdDate></genInfo><fundInfo><netAssets>1000000</netAssets></fundInfo><invstOrSecs><invstOrSec><name>X</name><cusip>123456789</cusip><valUSD>5</valUSD><pctVal>100</pctVal><balance>1</balance><invCountry>US</invCountry></invstOrSec></invstOrSecs></edgarSubmission>`;
  const s2 = structuredClone(seed);
  s2.etf_master.push({ ...seed.etf_master[0], ticker: 'TNY', cik: '0000000001' });
  const f = { ticker: 'TNY', cik: '0000000001', etfMasterCik: '0000000001', accession: 'x', fileDate: '2026-11-01', period: '2026-09-30' };
  const r = await L.recordFund(f, tiny, s2);
  assert.throws(() => L.planFund(r, 0, s2), /coverage downgrade/);
});

test('summary matches files on disk', () => {
  const s = JSON.parse(fs.readFileSync(path.join(UIT, 'apply', 'uit-summary.json'), 'utf8'));
  assert.equal(s.files['uit-apply-run1.sql'].sha256, sha(applyText));
  assert.equal(s.files['uit-rollback-run1.sql'].sha256, sha(rollbackText));
  assert.equal(s.totals.fund_holdings_monthly, 1039);
  assert.equal(s.pipeline_sha256, sha(fs.readFileSync(L.PATHS.pipeline)));
});
