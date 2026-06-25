#!/usr/bin/env node
// Step 4 retry — inserts remaining entity_isin_map rows using bulk UNION ALL SELECT.
// Re-derives (isin, lei) pairs from gleif_local.db for ISINs still unmatched in D1.
// All prior work (Steps 1-3) is already persisted; this only writes to entity_isin_map.

const Database = require('better-sqlite3');
const path = require('path');

const ACCOUNT_ID  = 'ea36070477560935a68ad9110a2fd40b';
const DATABASE_ID = '43e80149-5333-4917-b678-6a8218ca4f93';
const OAUTH_TOKEN = 'cfoat_PIier3yr3MMx8FUGAAeV8Ddd0bkM0eBVGu_vakm0DW4.FnBToiNc9nl4xUXpZlPeHAifKg_ODtBDH0nzjgK5Ul8';
const GLEIF_DB    = path.join(__dirname, 'gleif_local.db');
const D1_URL      = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const ROWS_PER_CALL = 10;  // UNION ALL SELECT rows per D1 API call (D1 compound SELECT limit is low)
const PAGE_SIZE     = 5000;
const REPORT_EVERY  = 1000;

async function d1q(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OAUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.results ?? [];
}

// Retry wrapper for transient D1 errors
async function d1qWithRetry(sql, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await d1q(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * 500;
      process.stderr.write(`  D1 error (attempt ${attempt}), retrying in ${wait}ms: ${err.message}\n`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function main() {
  console.log(`=== ISIN Backfill — Step 4 Retry ===`);
  console.log(`Started: ${new Date().toISOString()}`);

  const [before] = await d1q('SELECT COUNT(*) as cnt FROM entity_isin_map');
  console.log(`entity_isin_map before: ${before.cnt}\n`);

  // 1. Re-fetch unmatched ISINs from D1 (what's still unmatched after partial Step 4)
  console.log('Fetching still-unmatched ISINs from D1...');
  const unmatchedIsins = [];
  let offset = 0;
  while (true) {
    const rows = await d1q(
      `SELECT DISTINCT f.isin
       FROM fund_holdings_monthly f
       LEFT JOIN entity_isin_map e ON f.isin = e.isin
       WHERE f.isin IS NOT NULL AND e.isin IS NULL
       ORDER BY f.isin
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    );
    for (const r of rows) unmatchedIsins.push(r.isin);
    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
    console.log(`  ...${unmatchedIsins.length} fetched`);
  }
  console.log(`Still-unmatched ISINs: ${unmatchedIsins.length}`);

  if (unmatchedIsins.length === 0) {
    console.log('Nothing to do — all ISINs already mapped.');
    return;
  }

  // 2. Local GLEIF lookup
  console.log('\nLooking up ISINs in gleif_local.db...');
  const gleif = new Database(GLEIF_DB, { readonly: true });
  const isinStmt = gleif.prepare('SELECT lei FROM isin_lei_map WHERE isin = ? LIMIT 1');

  const matched = [];
  let noMatch = 0;
  for (let i = 0; i < unmatchedIsins.length; i++) {
    const row = isinStmt.get(unmatchedIsins[i]);
    if (row) matched.push({ isin: unmatchedIsins[i], lei: row.lei });
    else noMatch++;
    if ((i + 1) % 5000 === 0) {
      console.log(`  ${i + 1} / ${unmatchedIsins.length} — ${matched.length} matched, ${noMatch} no-match`);
    }
  }
  gleif.close();
  console.log(`GLEIF lookup complete: ${matched.length} matched, ${noMatch} no-match`);

  if (matched.length === 0) {
    console.log('No new matches — done.');
    return;
  }

  // 3. Resolve entity_id for each unique LEI (batch of 50 per D1 call)
  console.log(`\nResolving entity_id for ${[...new Set(matched.map(m => m.lei))].length} unique LEIs...`);
  const uniqueLeis = [...new Set(matched.map(m => m.lei))];
  const leiToId = new Map();
  for (let i = 0; i < uniqueLeis.length; i += 50) {
    const chunk = uniqueLeis.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    const rows = await d1qWithRetry(
      `SELECT lei, entity_id FROM entity_master WHERE lei IN (${ph})`, chunk
    );
    for (const r of rows) leiToId.set(r.lei, r.entity_id);
  }
  console.log(`Resolved ${leiToId.size} / ${uniqueLeis.length} LEIs`);

  // 4. Bulk insert using UNION ALL SELECT (ROWS_PER_CALL rows per D1 call)
  console.log(`\nStep 4 — Bulk inserting entity_isin_map (${ROWS_PER_CALL} rows/call)...`);

  const toInsert = matched.filter(m => leiToId.has(m.lei));
  console.log(`Rows to insert: ${toInsert.length} (${matched.length - toInsert.length} skipped — entity not in master)`);

  let inserted = 0;
  let callCount = 0;

  for (let i = 0; i < toInsert.length; i += ROWS_PER_CALL) {
    const chunk = toInsert.slice(i, i + ROWS_PER_CALL);
    const placeholders = chunk.map(() => '(?,?,?)').join(',');
    const params = chunk.flatMap(({ isin, lei }) => [isin, lei, leiToId.get(lei)]);

    await d1qWithRetry(
      `INSERT OR IGNORE INTO entity_isin_map (isin, lei, entity_id) VALUES ${placeholders}`,
      params
    );
    inserted += chunk.length;
    callCount++;

    if (inserted % REPORT_EVERY < ROWS_PER_CALL || i + ROWS_PER_CALL >= toInsert.length) {
      process.stdout.write(`  ${inserted} / ${toInsert.length} inserted (${callCount} API calls)\n`);
    }
  }

  // 5. Final verification
  console.log('\n--- Verification ---');
  const [after]   = await d1q('SELECT COUNT(*) as cnt FROM entity_isin_map');
  const [unm]     = await d1q(`
    SELECT COUNT(*) as cnt
    FROM (SELECT DISTINCT isin FROM fund_holdings_monthly WHERE isin IS NOT NULL) f
    LEFT JOIN entity_isin_map e ON f.isin = e.isin
    WHERE e.isin IS NULL`);
  const [emCount] = await d1q('SELECT COUNT(*) as cnt FROM entity_master');

  console.log(`entity_isin_map: ${before.cnt} → ${after.cnt} (+${after.cnt - before.cnt})`);
  console.log(`Remaining unmatched ISINs: ${unm.cnt}`);
  console.log(`entity_master: ${emCount.cnt}`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
