#!/usr/bin/env node
// Gate 4: Cross-module flags on entity_master.
// UPDATE only — no INSERT, no DELETE.
// Batches of 50. REST API.

const fs = require('fs');

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = '***REMOVED-CF-TOKEN-MA-AUG-004***';
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

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
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL: ${sql.slice(0, 300)}`);
  return json;
}

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`  [${label}] 0 stmts — skipping`); return 0; }
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done.toLocaleString()}/${stmts.length.toLocaleString()}`);
    }
  }
  return done;
}

async function main() {
  // ── Step 4a: has_etf_holdings + etf_holding_count ────────────────────────
  console.log('Step 4a: Updating has_etf_holdings and etf_holding_count...');
  const etfCounts = JSON.parse(fs.readFileSync('/tmp/gate4_etf_counts.json', 'utf8'))[0].results;
  console.log(`  Entities with exposure: ${etfCounts.length.toLocaleString()}`);

  const step4aStmts = etfCounts.map(({ entity_id, etf_count }) =>
    `UPDATE entity_master SET has_etf_holdings = 1, etf_holding_count = ${etf_count}, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ${entity_id}`
  );
  const step4aCount = await runBatches(step4aStmts, 'UPDATE has_etf_holdings');
  console.log(`  Step 4a entities updated: ${step4aCount.toLocaleString()}`);

  // ── Step 4b: primary_ticker ───────────────────────────────────────────────
  console.log('\nStep 4b: Updating primary_ticker...');
  const tickerRows = JSON.parse(fs.readFileSync('/tmp/gate4_tickers.json', 'utf8'))[0].results;
  console.log(`  Ticker rows available: ${tickerRows.length}`);

  if (tickerRows.length === 0) {
    console.log('  No security_ticker values in instrument_master — 0 updates.');
  } else {
    // Take highest-count ticker per entity_id (results already ordered by entity_id, cnt DESC)
    const entityTopTicker = new Map();
    for (const { entity_id, security_ticker } of tickerRows) {
      if (!entityTopTicker.has(entity_id)) entityTopTicker.set(entity_id, security_ticker);
    }

    const step4bStmts = [...entityTopTicker.entries()].map(([entity_id, ticker]) =>
      `UPDATE entity_master SET primary_ticker = ${esc(ticker)}, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ${entity_id} AND (primary_ticker IS NULL OR primary_ticker = '')`
    );
    const step4bCount = await runBatches(step4bStmts, 'UPDATE primary_ticker');
    console.log(`  Step 4b entities updated: ${step4bCount.toLocaleString()}`);
  }

  console.log('\nGate 4 writes complete.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
