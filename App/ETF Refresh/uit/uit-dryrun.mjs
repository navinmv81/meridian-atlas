#!/usr/bin/env node
// MA-NOV-UIT.BUILD — Control §4 dry run on a local node:sqlite copy seeded from read-only D1 reads.
// apply → verify counts + shapes against IVV/VOO's stored rows → re-apply = 0 changes → rollback = identical to seed.
//   node --no-warnings "App/ETF Refresh/uit/uit-dryrun.mjs"      (writes uit/apply/uit-dryrun-result.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seedDb, parseSqlFile, runBatches, dump } from './lib/dryrun-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function shape(db, series_id, report_month) {
  const q = (sql, ...p) => db.prepare(sql).get(...p);
  const n = q(`SELECT COUNT(*) n FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?`, series_id, report_month).n;
  const nullRate = (c) => +(q(`SELECT AVG(${c} IS NULL) r FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?`, series_id, report_month).r).toFixed(3);
  const snap = q(`SELECT * FROM fund_snapshot_monthly WHERE series_id = ? AND report_month = ?`, series_id, report_month);
  const statuses = db.prepare(`SELECT snapshot_status s, COUNT(*) n FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ? GROUP BY 1`).all(series_id, report_month);
  const cats = db.prepare(`SELECT asset_cat c, COUNT(*) n FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ? GROUP BY 1 ORDER BY 2 DESC`).all(series_id, report_month);
  const w = q(`SELECT ROUND(SUM(weight_pct), 2) w, SUM(LENGTH(cusip) = 9) c9 FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?`, series_id, report_month);
  return {
    series_id, report_month, rows: n, snapshot_holdings_count: snap?.holdings_count ?? null,
    snapshot_null_fields: snap ? Object.entries(snap).filter(([, v]) => v === null).map(([k]) => k) : null,
    status: Object.fromEntries(statuses.map((s) => [s.s, s.n])), asset_cat: Object.fromEntries(cats.map((c) => [c.c, c.n])),
    weight_sum_pct: w.w, cusip9_share: n ? +(w.c9 / n).toFixed(3) : null,
    null_rate: Object.fromEntries(['security_name', 'cusip', 'isin', 'security_ticker', 'position_value', 'weight_pct', 'shares', 'issuer_country'].map((c) => [c, nullRate(c)])),
  };
}

export function dryRun({ seed, applyText, rollbackText, file = ':memory:' }) {
  const db = seedDb(seed, file);
  const before = dump(db);
  const apply = parseSqlFile(applyText), rollback = parseSqlFile(rollbackText);
  const r1 = runBatches(db, apply);
  const afterApply = dump(db);
  const reapply = runBatches(db, apply.map((b) => ({ ...b, expect: b.expect.map(() => 0) })));
  const afterReapply = dump(db);
  const funds = db.prepare(`SELECT ticker, series_id, cik, has_nport, coverage_status, coverage_depth, notes FROM etf_master WHERE ticker IN ('SPY','QQQ','DIA','MDY') ORDER BY ticker`).all();
  const shapes = [
    ...funds.map((f) => shape(db, f.series_id, db.prepare(`SELECT MAX(report_month) m FROM fund_snapshot_monthly WHERE series_id = ?`).get(f.series_id).m)),
    shape(db, 'S000004310', '2026-03'), shape(db, 'S000002839', '2026-03'),
  ];
  const rb = runBatches(db, rollback);
  const afterRollback = dump(db);
  const rb2 = runBatches(db, rollback.map((b) => ({ ...b, expect: b.expect.map(() => 0) })));
  const identical = Object.keys(before).every((t) => before[t].sha256 === afterRollback[t].sha256);
  return {
    before, afterApply, apply: r1.map(({ n, label, total, ok }) => ({ n, label, total, ok })),
    reapply_total: reapply.reduce((a, b) => a + b.total, 0), reapply_identical: JSON.stringify(afterApply) === JSON.stringify(afterReapply),
    etf_master_after: funds, shapes,
    rollback: rb.map(({ n, label, got, ok }) => ({ n, label, got, ok })), rollback_again_total: rb2.reduce((a, b) => a + b.total, 0),
    afterRollback, rollback_identical_to_seed: identical,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'seed', 'd1-before.json'), 'utf8'));
  const res = dryRun({
    seed,
    applyText: fs.readFileSync(path.join(HERE, 'apply', 'uit-apply-run1.sql'), 'utf8'),
    rollbackText: fs.readFileSync(path.join(HERE, 'apply', 'uit-rollback-run1.sql'), 'utf8'),
  });
  fs.writeFileSync(path.join(HERE, 'apply', 'uit-dryrun-result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ apply_batches_ok: res.apply.every((b) => b.ok), apply_changes: res.apply.reduce((a, b) => a + b.total, 0), reapply_total: res.reapply_total, rollback_ok: res.rollback.every((b) => b.ok), rollback_again_total: res.rollback_again_total, rollback_identical_to_seed: res.rollback_identical_to_seed }, null, 1));
  for (const s of res.shapes) console.log(JSON.stringify(s));
  if (!(res.apply.every((b) => b.ok) && res.reapply_total === 0 && res.rollback.every((b) => b.ok) && res.rollback_identical_to_seed)) process.exit(1);
}
