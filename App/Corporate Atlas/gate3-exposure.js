#!/usr/bin/env node
// Gate 3: entity_exposure_monthly + fund_exposure_coverage
// One report_month at a time. Pass 1 (ISIN), Pass 2 (CUSIP), then coverage.
// Writes only to entity_exposure_monthly and fund_exposure_coverage.
// INSERT OR IGNORE. Batches of 50. Node.js REST API.

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN = process.env.CF_API_TOKEN;
if (!TOKEN) {
  console.error('Error: CF_API_TOKEN environment variable not set.');
  console.error('Run: export CF_API_TOKEN=$(wrangler whoami --json | ...)');
  console.error('Or obtain a fresh token via: wrangler login');
  process.exit(1);
}
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;
const NOW        = new Date().toISOString();

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 /raw error: ${JSON.stringify(json.errors)}\nSQL: ${sql.slice(0, 300)}`);
  // /raw returns rows as arrays; first result set
  return json.result[0].results.rows;
}

async function d1Query(sql) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 /query error: ${JSON.stringify(json.errors)}`);
  return json.result[0].results;
}

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`    [${label}] 0 rows`); return 0; }
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    // Use /raw for multi-statement execution
    const res = await fetch(`${API_BASE}/raw`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: chunk.join(';\n') }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(`Batch error at offset ${i}: ${JSON.stringify(json.errors)}`);
    done += chunk.length;
  }
  console.log(`    [${label}] ${done.toLocaleString()} stmts executed`);
  return done;
}

async function processMonth(month) {
  console.log(`\n── Month: ${month} ──`);

  // ── Pass 1: ISIN join via entity_isin_map ──────────────────────────────
  const pass1sql = `SELECT fhm.report_month, eim.entity_id, fel.entity_id as holder_entity_id, SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum FROM fund_holdings_monthly fhm JOIN entity_isin_map eim ON fhm.isin IS NOT NULL AND fhm.isin != '' AND fhm.isin = eim.isin JOIN fund_entity_link fel ON fhm.series_id = fel.series_id WHERE fhm.report_month = ${esc(month)} AND fhm.snapshot_status = 'complete' GROUP BY fhm.report_month, eim.entity_id, fel.entity_id`;

  const pass1rows = await d1Raw(pass1sql);
  console.log(`  Pass 1 (isin): ${pass1rows.length.toLocaleString()} aggregated rows`);

  const p1stmts = pass1rows.map(([report_month, entity_id, holder_entity_id, weight_sum]) =>
    `INSERT OR IGNORE INTO entity_exposure_monthly (report_month, entity_id, holder_entity_id, weight_sum, aum_weighted, computed_at) VALUES (${esc(report_month)}, ${entity_id}, ${holder_entity_id}, ${weight_sum}, NULL, ${esc(NOW)})`
  );
  await runBatches(p1stmts, 'entity_exposure Pass1');

  // ── Pass 2: CUSIP join via instrument_master → instrument_entity_map ───
  const pass2sql = `SELECT fhm.report_month, iem.entity_id, fel.entity_id as holder_entity_id, SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum FROM fund_holdings_monthly fhm JOIN instrument_master im ON fhm.cusip IS NOT NULL AND fhm.cusip != '' AND 'CUSIP:' || TRIM(fhm.cusip) = im.instrument_key JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key JOIN fund_entity_link fel ON fhm.series_id = fel.series_id WHERE fhm.report_month = ${esc(month)} AND fhm.snapshot_status = 'complete' AND (fhm.isin IS NULL OR fhm.isin = '') GROUP BY fhm.report_month, iem.entity_id, fel.entity_id`;

  const pass2rows = await d1Raw(pass2sql);
  console.log(`  Pass 2 (cusip): ${pass2rows.length.toLocaleString()} aggregated rows`);

  const p2stmts = pass2rows.map(([report_month, entity_id, holder_entity_id, weight_sum]) =>
    `INSERT OR IGNORE INTO entity_exposure_monthly (report_month, entity_id, holder_entity_id, weight_sum, aum_weighted, computed_at) VALUES (${esc(report_month)}, ${entity_id}, ${holder_entity_id}, ${weight_sum}, NULL, ${esc(NOW)})`
  );
  await runBatches(p2stmts, 'entity_exposure Pass2');

  // ── Coverage denominator ──────────────────────────────────────────────
  // Use LEFT JOINs (not correlated subqueries) per hard rules.
  // eim hit → ISIN-mapped; iem hit → CUSIP-mapped.
  const covSql = `SELECT fel.entity_id as holder_entity_id,
    SUM(CAST(fhm.weight_pct AS REAL)) as total_weight,
    SUM(CASE WHEN eim.isin IS NOT NULL OR iem.instrument_key IS NOT NULL THEN CAST(fhm.weight_pct AS REAL) ELSE 0 END) as mapped_weight
  FROM fund_holdings_monthly fhm
  JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
  LEFT JOIN entity_isin_map eim ON fhm.isin IS NOT NULL AND fhm.isin != '' AND fhm.isin = eim.isin
  LEFT JOIN instrument_entity_map iem ON (fhm.isin IS NULL OR fhm.isin = '') AND fhm.cusip IS NOT NULL AND fhm.cusip != '' AND 'CUSIP:' || TRIM(fhm.cusip) = iem.instrument_key
  WHERE fhm.report_month = ${esc(month)} AND fhm.snapshot_status = 'complete'
  GROUP BY fel.entity_id`;

  const covrows = await d1Raw(covSql);
  console.log(`  Coverage: ${covrows.length.toLocaleString()} fund rows`);

  const covstmts = covrows.map(([holder_entity_id, total_weight, mapped_weight]) =>
    `INSERT OR IGNORE INTO fund_exposure_coverage (report_month, holder_entity_id, total_weight, mapped_weight, computed_at) VALUES (${esc(month)}, ${holder_entity_id}, ${total_weight ?? 0}, ${mapped_weight ?? 0}, ${esc(NOW)})`
  );
  await runBatches(covstmts, 'fund_exposure_coverage');

  // Row count snapshot after this month
  const cnt = await d1Raw(
    `SELECT COUNT(*) FROM entity_exposure_monthly WHERE report_month = ${esc(month)}`
  );
  const covCnt = await d1Raw(
    `SELECT COUNT(*) FROM fund_exposure_coverage WHERE report_month = ${esc(month)}`
  );
  console.log(`  ✓ entity_exposure_monthly[${month}]: ${cnt[0][0].toLocaleString()} rows`);
  console.log(`  ✓ fund_exposure_coverage[${month}]: ${covCnt[0][0].toLocaleString()} rows`);
}

async function main() {
  const months = [
    '2025-05','2025-06','2025-07','2025-08',
    '2025-10','2025-11','2025-12',
    '2026-01','2026-02','2026-03',
  ];

  console.log(`Processing ${months.length} months...`);

  for (const month of months) {
    await processMonth(month);
  }

  // ── Post-completion verification ────────────────────────────────────────
  console.log('\n══ POST-COMPLETION VERIFICATION ══');

  const totalExp = await d1Raw('SELECT COUNT(*) FROM entity_exposure_monthly');
  console.log(`entity_exposure_monthly total rows: ${totalExp[0][0].toLocaleString()}`);

  const totalCov = await d1Raw('SELECT COUNT(*) FROM fund_exposure_coverage');
  console.log(`fund_exposure_coverage total rows: ${totalCov[0][0].toLocaleString()}`);

  const byMonth = await d1Raw(
    `SELECT report_month, COUNT(*) as exp_rows FROM entity_exposure_monthly GROUP BY report_month ORDER BY report_month`
  );
  console.log('\nentity_exposure_monthly by month:');
  for (const [month, cnt] of byMonth) console.log(`  ${month}: ${cnt.toLocaleString()}`);

  const covByMonth = await d1Raw(
    `SELECT report_month, COUNT(*) as funds, ROUND(AVG(mapped_weight/NULLIF(total_weight,0))*100,1) as avg_coverage_pct FROM fund_exposure_coverage GROUP BY report_month ORDER BY report_month`
  );
  console.log('\nfund_exposure_coverage by month (avg coverage %):');
  for (const [month, funds, avgCov] of covByMonth) console.log(`  ${month}: ${funds} funds, ${avgCov}% avg mapped`);

  console.log('\nGate 3 complete. Stopped — not proceeding to Gate 4.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
