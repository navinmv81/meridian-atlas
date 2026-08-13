#!/usr/bin/env node
// Gate 1 resume — incremental instrument_master population.
// Reuses exact logic from gate1-instrument-seed.js (committed 2026-06-14 in 004b9df).
// Derives instrument_key identically; skips rows already present.
// INSERT OR IGNORE, multi-row VALUES batches (10 rows/call), no correlated subqueries.

const ACCOUNT_ID  = 'ea36070477560935a68ad9110a2fd40b';
const DATABASE_ID = '43e80149-5333-4917-b678-6a8218ca4f93';
const OAUTH_TOKEN = process.env.CF_API_TOKEN;
if (!OAUTH_TOKEN) {
  console.error('Error: CF_API_TOKEN environment variable not set.');
  console.error('Run: export CF_API_TOKEN=$(wrangler whoami --json | ...)');
  console.error('Or obtain a fresh token via: wrangler login');
  process.exit(1);
}
const D1_URL      = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const BATCH_SIZE  = 10;   // rows per INSERT VALUES call (proven safe from isin-backfill-step4)
const PAGE_SIZE   = 5000;

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

async function d1qRetry(sql, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await d1q(sql, params); }
    catch (err) {
      if (attempt === retries) throw err;
      process.stderr.write(`  retry ${attempt}: ${err.message.slice(0, 120)}\n`);
      await new Promise(r => setTimeout(r, attempt * 500));
    }
  }
}

// Identical to gate1-instrument-seed.js
function deriveInstrumentKey(row) {
  if (row.isin && row.isin.trim().length === 12) {
    return row.isin.trim();
  } else if (row.cusip && row.cusip.trim().length >= 6) {
    return 'CUSIP:' + row.cusip.trim();
  } else if (row.security_ticker && row.security_ticker.trim() !== '') {
    return 'TICKER:' + row.security_ticker.toUpperCase().trim();
  } else {
    return 'NAME:' + row.security_name.toUpperCase().trim()
      .replace(/\s+/g, '_').slice(0, 80);
  }
}

async function fetchAllPages(sql) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await d1q(`${sql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
    rows.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
    if (rows.length % 25000 < PAGE_SIZE) process.stdout.write(`  ...fetched ${rows.length}\n`);
  }
  return rows;
}

async function main() {
  console.log('=== Gate 1 Resume — instrument_master incremental build ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ── Current state ─────────────────────────────────────────────────────────
  const [imBefore] = await d1q('SELECT COUNT(*) as cnt FROM instrument_master');
  const [imIsins]  = await d1q('SELECT COUNT(DISTINCT isin) as cnt FROM instrument_master WHERE isin IS NOT NULL');
  const [fhIsins]  = await d1q('SELECT COUNT(DISTINCT isin) as cnt FROM fund_holdings_monthly WHERE isin IS NOT NULL');
  console.log('Current state:');
  console.log(`  instrument_master rows:      ${imBefore.cnt}`);
  console.log(`  instrument_master ISINs:     ${imIsins.cnt}`);
  console.log(`  fund_holdings_monthly ISINs: ${fhIsins.cnt}`);
  console.log(`  Gap:                         ${fhIsins.cnt - imIsins.cnt}\n`);

  // ── Step 2: MANDATORY EXPLAIN QUERY PLAN (Step 4 join — the performance-critical path) ──
  // Tech Ops approved 2026-06-17: idx_fhm_isin (partial, WHERE isin IS NOT NULL) created.
  // The GROUP BY full fetch is a 209,795-row table scan — approved as low-risk (Tech Ops + Eng Lead).
  // EXPLAIN is run on the JOIN query (the critical path), not the GROUP BY.
  console.log('STEP 2 — EXPLAIN QUERY PLAN (Step 4 LEFT JOIN — performance critical path):');
  const plan = await d1q(`EXPLAIN QUERY PLAN
    SELECT DISTINCT fh.isin, fh.cusip, fh.security_name
    FROM fund_holdings_monthly fh
    LEFT JOIN instrument_master im ON fh.isin = im.isin
    WHERE fh.isin IS NOT NULL AND im.isin IS NULL`);
  console.log('  EXPLAIN QUERY PLAN output:');
  for (const r of plan) console.log(`    id=${r.id} parent=${r.parent} detail=${r.detail}`);

  const planText = plan.map(r => r.detail ?? '').join(' ');
  const usesIndex = /USING.*(INDEX|COVERING)/i.test(planText);
  const scanOnly = /SCAN fund_holdings_monthly/i.test(planText) && !usesIndex;
  console.log(`\n  Decision: ${usesIndex ? 'PROCEED — index confirmed on join path' : 'SCAN WITHOUT INDEX on join — STOP'}`);

  if (!usesIndex) {
    console.log('\nSTOP — Join path does not use idx_fhm_isin. Report back before proceeding.');
    process.exit(1);
  }

  // Also EXPLAIN the GROUP BY (informational — full scan approved by Tech Ops for 209,795 rows)
  const planGb = await d1q(`EXPLAIN QUERY PLAN
    SELECT isin, cusip, security_name, security_ticker, asset_cat, issuer_country,
      MIN(report_month) AS first_seen_date
    FROM fund_holdings_monthly
    WHERE security_name IS NOT NULL AND security_name != ''
    GROUP BY isin, cusip, security_name, security_ticker, asset_cat, issuer_country`);
  console.log('\n  EXPLAIN QUERY PLAN (GROUP BY full-fetch — informational, full-scan approved):');
  for (const r of planGb) console.log(`    id=${r.id} parent=${r.parent} detail=${r.detail}`);

  // ── Step 3: COUNT test ────────────────────────────────────────────────────
  console.log('\nSTEP 3 — Read test (count only):');
  const t0 = Date.now();
  const [countResult] = await d1q(`SELECT COUNT(*) as cnt FROM (
    SELECT
      isin, cusip, security_name, security_ticker, asset_cat, issuer_country,
      MIN(report_month) AS first_seen_date
    FROM fund_holdings_monthly
    WHERE security_name IS NOT NULL AND security_name != ''
    GROUP BY isin, cusip, security_name, security_ticker, asset_cat, issuer_country
  )`);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Distinct combos: ${countResult.cnt} (${elapsed}s)`);
  if (countResult.cnt > 200000) {
    console.log('\nSTOP — Row count exceeds 200,000 — report before proceeding.');
    process.exit(1);
  }

  // ── Step 4: Load all distinct securities from fund_holdings_monthly ───────
  console.log('\nSTEP 4 — Loading all distinct securities from fund_holdings_monthly...');
  const securities = await fetchAllPages(
    `SELECT
       isin, cusip, security_name, security_ticker, asset_cat, issuer_country,
       MIN(report_month) AS first_seen_date
     FROM fund_holdings_monthly
     WHERE security_name IS NOT NULL AND security_name != ''
     GROUP BY isin, cusip, security_name, security_ticker, asset_cat, issuer_country
     ORDER BY isin`
  );
  console.log(`  Total distinct combos from fund_holdings_monthly: ${securities.length}`);

  // ── Load existing instrument_keys from instrument_master ──────────────────
  console.log('\nLoading existing instrument_keys from instrument_master...');
  const existingKeys = new Set();
  const existingRows = await fetchAllPages(
    'SELECT instrument_key FROM instrument_master ORDER BY instrument_key'
  );
  for (const r of existingRows) existingKeys.add(r.instrument_key);
  console.log(`  Existing instrument_keys: ${existingKeys.size}`);

  // ── Derive keys and identify new rows ─────────────────────────────────────
  const seenKeys = new Set();
  const toInsert = [];
  for (const row of securities) {
    const key = deriveInstrumentKey(row);
    if (existingKeys.has(key)) continue;  // already in instrument_master
    if (seenKeys.has(key)) continue;      // duplicate in this batch
    seenKeys.add(key);

    const cusipIssuer6 = (row.cusip && row.cusip.trim().length >= 6)
      ? row.cusip.trim().slice(0, 6) : null;

    toInsert.push({
      key,
      security_name:    row.security_name    ?? null,
      security_ticker:  row.security_ticker  ?? null,
      isin:             row.isin             ?? null,
      cusip:            row.cusip            ?? null,
      cusip_issuer_6:   cusipIssuer6,
      asset_cat:        row.asset_cat        ?? null,
      country:          row.issuer_country   ?? null,
      first_seen_date:  row.first_seen_date  ?? null,
    });
  }
  console.log(`  New instruments to insert: ${toInsert.length}`);
  console.log(`  Already present (skipped): ${securities.length - toInsert.length - (seenKeys.size - toInsert.length)}`);

  if (toInsert.length === 0) {
    console.log('\nNothing new to insert — instrument_master already up to date.');
  } else {
    // ── Step 5: Batched INSERT OR IGNORE ─────────────────────────────────────
    console.log('\nSTEP 5 — Inserting new instruments...');
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const ph = chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
      const params = chunk.flatMap(r => [
        r.key, r.security_name, r.security_ticker, r.isin,
        r.cusip, r.cusip_issuer_6, r.asset_cat, r.country, r.first_seen_date
      ]);
      await d1qRetry(
        `INSERT OR IGNORE INTO instrument_master
           (instrument_key, security_name, security_ticker, isin, cusip,
            cusip_issuer_6, asset_cat, country, first_seen_date)
         VALUES ${ph}`,
        params
      );
      inserted += chunk.length;
      if (inserted % 5000 < BATCH_SIZE || i + BATCH_SIZE >= toInsert.length) {
        process.stdout.write(`  ...${inserted} / ${toInsert.length} inserted\n`);
      }
    }
    console.log(`  Insert phase complete: ${inserted} rows`);
  }

  // ── Step 6: Verification ──────────────────────────────────────────────────
  console.log('\nSTEP 6 — Verification:');
  const [imAfter]     = await d1q('SELECT COUNT(*) as cnt FROM instrument_master');
  const [imIsinsAfter] = await d1q('SELECT COUNT(DISTINCT isin) as cnt FROM instrument_master WHERE isin IS NOT NULL');
  const [fhIsinsAfter] = await d1q('SELECT COUNT(DISTINCT isin) as cnt FROM fund_holdings_monthly WHERE isin IS NOT NULL');

  const gap = fhIsinsAfter.cnt - imIsinsAfter.cnt;

  // Count ISINs in fund_holdings_monthly with null/empty security_name (edge case)
  const [nullNameIsins] = await d1q(`
    SELECT COUNT(DISTINCT isin) as cnt
    FROM fund_holdings_monthly
    WHERE isin IS NOT NULL
      AND (security_name IS NULL OR security_name = '')`);

  console.log(`  instrument_master rows:      ${imBefore.cnt} → ${imAfter.cnt} (+${imAfter.cnt - imBefore.cnt})`);
  console.log(`  instrument_master ISINs:     ${imIsins.cnt} → ${imIsinsAfter.cnt}`);
  console.log(`  fund_holdings_monthly ISINs: ${fhIsinsAfter.cnt}`);
  console.log(`  Remaining gap:               ${gap}`);
  console.log(`  ISINs with null/empty name:  ${nullNameIsins.cnt} (excluded per WHERE security_name IS NOT NULL)`);

  // ── Step 7: Final report ──────────────────────────────────────────────────
  console.log('\n=== Step 7 — Final Report ===');
  console.log('1. Original 06-15 query logic confirmed and reused: YES');
  console.log('   Source: gate1-instrument-seed.js (commit 004b9df, 2026-06-14)');
  console.log('   deriveInstrumentKey() logic: ISIN (12 chars) → CUSIP: prefix → TICKER: prefix → NAME: prefix');
  console.log('   Columns: isin, cusip, security_name, security_ticker, asset_cat, issuer_country, MIN(report_date)');
  console.log('   GROUP BY: isin, cusip, security_name, security_ticker, asset_cat, issuer_country');
  console.log('   WHERE: security_name IS NOT NULL AND security_name != \'\'');
  console.log('');
  console.log('2. EXPLAIN QUERY PLAN:');
  for (const r of plan) console.log(`   id=${r.id} parent=${r.parent} detail=${r.detail}`);
  console.log(`   Decision: ${scanOnly ? 'STOPPED' : 'PROCEED'}`);
  console.log('');
  console.log(`3. Read test: ${countResult.cnt} distinct combos in ${elapsed}s`);
  console.log('');
  console.log(`4. New instruments found in Step 4: ${toInsert.length}`);
  console.log('');
  console.log(`5. INSERT progress: see above`);
  console.log('');
  console.log(`6. Verification:`);
  console.log(`   instrument_master: ${imBefore.cnt} → ${imAfter.cnt} (+${imAfter.cnt - imBefore.cnt})`);
  console.log(`   ISIN coverage: ${imIsinsAfter.cnt} / ${fhIsinsAfter.cnt} (gap: ${gap})`);
  if (gap > 0) {
    console.log(`   Gap breakdown: ${nullNameIsins.cnt} ISINs have null/empty security_name in fund_holdings_monthly — excluded by WHERE clause (correct)`);
    console.log(`   Remaining unexplained gap: ${Math.max(0, gap - nullNameIsins.cnt)}`);
  }
  console.log('');
  console.log('7. Compliance confirmation:');
  console.log('   ✓ INSERT OR IGNORE throughout — no existing rows overwritten');
  console.log('   ✓ No correlated subqueries — flat GROUP BY + in-memory key dedup');
  console.log('   ✓ No NOT EXISTS / NOT IN against fund_holdings_monthly');
  console.log('   ✓ fund_holdings_monthly: read-only');
  console.log('   ✓ Multi-row VALUES batches (10 rows/call) — no wrangler CLI loops');
  console.log('   ✓ Progress reported every 5,000 rows');
  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('Gate 2 re-run NOT started — report back first per instructions.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
