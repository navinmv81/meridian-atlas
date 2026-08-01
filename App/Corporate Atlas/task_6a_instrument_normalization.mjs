// Task 6a — Instrument Normalization
// Reads from: fund_holdings_monthly (read-only)
// Writes to: instrument_master only
// All DB access via wrangler CLI execSync — no REST API, no fetch, no OAuth

import { execSync } from 'child_process';

const DB = 'meridian-etf';

function runQuery(sql) {
  const escaped = sql.replace(/'/g, "'\\''");
  const out = execSync(
    `wrangler d1 execute ${DB} --remote --json --command='${escaped}'`,
    { maxBuffer: 256 * 1024 * 1024, stdio: 'pipe' }
  );
  const parsed = JSON.parse(out.toString());
  if (!parsed[0].success) throw new Error('Query failed: ' + JSON.stringify(parsed[0]));
  return parsed[0].results;
}

// ── Step 1: Write guard ────────────────────────────────────────────────────
console.log('Step 1: Write guard check...');
const guardRows = runQuery(
  "SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
);
const writesToday = guardRows.length > 0 ? parseInt(guardRows[0].value, 10) : 0;
console.log(`  writes_today_2026-06-13 = ${writesToday}`);
if (writesToday > 80000) {
  console.error('STOP: writes_today exceeds 80,000. Aborting.');
  process.exit(1);
}

// ── Step 2: Fetch distinct securities ─────────────────────────────────────
console.log('\nStep 2: Fetching distinct securities from fund_holdings_monthly...');
const securities = runQuery(`
SELECT
  isin, cusip, security_ticker, security_name,
  asset_cat, issuer_country,
  MIN(report_month) as first_seen_date
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
  AND security_name IS NOT NULL
  AND security_name != ''
  AND UPPER(TRIM(security_name)) != 'N/A'
  AND UPPER(TRIM(security_name)) != 'NA'
  AND UPPER(TRIM(security_name)) != 'UNKNOWN SECURITY'
GROUP BY isin, cusip, security_ticker, security_name, asset_cat, issuer_country
`);
console.log(`  Fetched ${securities.length} distinct security rows.`);

// ── Step 3: Derive keys ────────────────────────────────────────────────────
function escapeVal(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function deriveInstrumentKey(row) {
  if (row.isin && row.isin.trim().length === 12)
    return row.isin.trim();
  if (row.cusip && row.cusip.trim().length >= 6)
    return `CUSIP:${row.cusip.trim()}`;
  if (row.security_ticker && row.security_ticker.trim() !== '')
    return `TICKER:${row.security_ticker.toUpperCase().trim()}`;
  return `NAME:${row.security_name.toUpperCase().trim().replace(/\s+/g, '_').slice(0, 80)}`;
}

function deriveCusipIssuer6(row) {
  return (row.cusip && row.cusip.trim().length >= 6)
    ? row.cusip.trim().slice(0, 6)
    : null;
}

// ── Step 4: Insert in batches of 10 rows ──────────────────────────────────
// 9 columns × 10 rows = 90 SQL variables — safely under SQLite's 999 limit.
const BATCH_SIZE = 10;
const COLS = '(instrument_key, security_name, security_ticker, isin, cusip, cusip_issuer_6, asset_cat, country, first_seen_date)';
let totalProcessed = 0;
const totalBatches = Math.ceil(securities.length / BATCH_SIZE);

console.log(`\nStep 4: Inserting ${securities.length} rows in ${totalBatches} batches of ${BATCH_SIZE}...`);

for (let i = 0; i < securities.length; i += BATCH_SIZE) {
  const batch = securities.slice(i, i + BATCH_SIZE);

  const valuesClauses = batch.map(row => {
    const instrument_key = deriveInstrumentKey(row);
    const cusip_issuer_6 = deriveCusipIssuer6(row);
    return `(${[
      instrument_key,
      row.security_name,
      row.security_ticker || null,
      row.isin || null,
      row.cusip ? row.cusip.trim() : null,
      cusip_issuer_6,
      row.asset_cat || null,
      row.issuer_country || null,
      row.first_seen_date || null,
    ].map(escapeVal).join(',')})`;
  }).join(',');

  const sql = `INSERT OR IGNORE INTO instrument_master ${COLS} VALUES ${valuesClauses};`;

  execSync(
    `wrangler d1 execute ${DB} --remote --command="${sql.replace(/"/g, '\\"')}"`,
    { stdio: 'pipe' }
  );

  totalProcessed += batch.length;
  if (totalProcessed % 500 === 0 || totalProcessed === securities.length) {
    console.log(`  Progress: ${totalProcessed}/${securities.length} rows inserted...`);
  }
}

console.log(`\nAll ${securities.length} rows processed (INSERT OR IGNORE).`);

// ── Step 5: Report row count ───────────────────────────────────────────────
console.log('\nStep 5: Fetching instrument_master row count...');
const countRows = runQuery('SELECT COUNT(*) as cnt FROM instrument_master;');
console.log(`\n=== Task 6a Complete ===`);
console.log(`instrument_master rows: ${countRows[0].cnt}`);
console.log('\nStop here. Do not proceed to Task 6b until confirmed.');
