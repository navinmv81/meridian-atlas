#!/usr/bin/env node
// catchup-script.js
// One-time catch-up: ingests N-PORT holdings for 29 specific ETFs via the
// same parse/write logic as holdings-pipeline.js. Node.js + D1 REST API.
// No files written to disk. Fetch, parse in memory, write to D1, discard.

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────

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

const TARGET_TICKERS = [
  'IGV', 'BNDX', 'MBB'
];

const SEC_UA             = 'MeridianAtlas contact@meridianatlas.com';
const SLEEP_MS           = 500;
const REPORT_MONTH_LOOKBACK = 2;
const D1_BATCH_SIZE      = 7;     // rows per multi-row INSERT (7 rows × 13 cols = 91 params, under D1's 100-param REST limit)
const WRITE_ABORT_LIMIT  = 75_000;
const WRITE_GUARD_LIMIT  = 70_000;
const TODAY              = new Date().toISOString().slice(0, 10);
const WRITE_KEY          = `writes_today_${TODAY}`;

// ── D1 REST helpers ───────────────────────────────────────────────────────────

async function d1q(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OAUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.results ?? [];
}

// Known Issue 22.20 fix (2026-08-30 Known Issue 22.12 review): same D1 REST
// endpoint as d1q, but also returns real meta.rows_written — the D1 HTTP API
// returns the same meta shape as the Workers Binding API (confirmed live,
// 2026-08-30: a 7-row multi-row INSERT via this exact endpoint/shape reported
// meta.changes:7 but meta.rows_written:50 — a ~7x multiplier on this table,
// this project's own "meta.changes lesson" recurring here too). d1q/d1run
// above discard meta entirely and are kept for calls that don't need to be
// budget-counted (reads, and the snapshot-header INSERT/DELETE below, which
// the main pipeline's storeHoldings() doesn't count either — kept symmetric
// with that, not adding new rigor beyond what the Worker itself does).
async function d1qMeta(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OAUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.meta ?? {};
}

// Execute a chunk of INSERT statements as one multi-row INSERT (one HTTP call per chunk).
// Returns the real rows_written for this chunk (Known Issue 22.20 fix — was previously
// uncounted at this call site; caller used to add chunk.length, a logical row count,
// instead of this real metered value).
async function d1batch(statements) {
  if (statements.length === 0) return 0;
  // All rows in a chunk target the same table with the same columns.
  // Build: INSERT INTO table (cols) VALUES (?,?,...), (?,?,...), ...
  const first = statements[0].sql;
  const valuesIdx = first.toUpperCase().indexOf('VALUES');
  const insertPrefix = first.slice(0, valuesIdx).trim();           // "INSERT INTO ... (cols)"
  const rowPlaceholder = first.slice(valuesIdx + 6).trim();         // "(?,?,?,...,?)"
  const multiSql = `${insertPrefix} VALUES ${statements.map(() => rowPlaceholder).join(', ')}`;
  const allParams = statements.flatMap(s => s.params);
  const meta = await d1qMeta(multiSql, allParams);
  return meta?.rows_written || 0;
}

async function d1run(sql, params = []) {
  await d1q(sql, params);
}

// Known Issue 22.20 fix: same as d1run, but returns real rows_written for callers
// that need to count this write against the shared write-budget counter.
async function d1runMeta(sql, params = []) {
  const meta = await d1qMeta(sql, params);
  return meta?.rows_written || 0;
}

// ── Write count helpers ───────────────────────────────────────────────────────

async function getTodayWriteCount() {
  const rows = await d1q(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`,
    [WRITE_KEY]
  );
  return rows.length ? parseInt(rows[0].value || '0', 10) : 0;
}

async function incrementWriteCount(count) {
  const current = await getTodayWriteCount();
  const next = current + count;
  await d1run(
    `INSERT INTO holdings_pipeline_state (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [WRITE_KEY, String(next)]
  );
  return next;
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Copied verbatim from holdings-pipeline.js ─────────────────────────────────

function decodeXmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseHoldings(xml) {
  const getTag = (src, tag) => {
    const m = src.match(
      new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`, 'i')
    );
    return m ? m[1].trim() : null;
  };

  const netAssets = parseFloat(getTag(xml, 'netAssets') || '0') || 0;
  const totAssets = parseFloat(getTag(xml, 'totAssets') || '0') || 0;
  const totLiabs  = parseFloat(getTag(xml, 'totLiabs')  || '0') || 0;
  const repPdEnd  = getTag(xml, 'repPdEnd') || '';

  const returnMatches = [...xml.matchAll(/rtn1="([^"]+)"/g)];
  const rtn1 = returnMatches[0] ? parseFloat(returnMatches[0][1]) : null;
  const rtn2Match = xml.match(/rtn2="([^"]+)"/);
  const rtn3Match = xml.match(/rtn3="([^"]+)"/);
  const rtn2 = rtn2Match ? parseFloat(rtn2Match[1]) : null;
  const rtn3 = rtn3Match ? parseFloat(rtn3Match[1]) : null;

  const derivativesFlag = xml.includes('<derivativeInfo>') ? 1 : 0;
  const lendingFlag     = xml.includes('<securityLending>') ? 1 : 0;

  const holdingsRegex = /<(?:[\w-]+:)?invstOrSec(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?invstOrSec>/gi;
  const holdings = [];
  let match;

  while ((match = holdingsRegex.exec(xml)) !== null) {
    const block = match[1];

    const secName   = decodeXmlEntities(getTag(block, 'name') || getTag(block, 'title') || 'Unknown');
    const cusip     = getTag(block, 'cusip');
    const isinMatch = block.match(/isin\s+value="([^"]+)"/i);
    const isin      = isinMatch ? isinMatch[1] : null;
    const secTicker = getTag(block, 'ticker');
    const balance   = parseFloat(getTag(block, 'balance') || '0') || null;
    const valUSD    = parseFloat(getTag(block, 'valUSD')   || '0') || null;
    const pctVal    = parseFloat(getTag(block, 'pctVal')   || '0') || null;

    const assetCondMatch = block.match(
      /<(?:[\w-]+:)?assetConditional[^>]*\sassetCat="([^"]+)"/i
    );
    const assetCat = assetCondMatch ? assetCondMatch[1] : getTag(block, 'assetCat');

    const country    = getTag(block, 'invCountry');
    const restricted = getTag(block, 'isRestrictedSec') === 'Y' ? 1 : 0;

    holdings.push({
      security_name:   secName,
      cusip,
      isin,
      security_ticker: secTicker ? secTicker.toUpperCase() : null,
      position_value:  valUSD,
      weight_pct:      pctVal,
      shares:          balance,
      asset_cat:       assetCat || 'OTHER',
      issuer_country:  country,
      is_restricted:   restricted
    });
  }

  return { netAssets, totAssets, totLiabs, repPdEnd, rtn1, rtn2, rtn3,
           derivativesFlag, lendingFlag, holdings };
}

// ── Per-ETF ingestion ─────────────────────────────────────────────────────────

async function ingestEtf(etf) {
  const { ticker, series_id, cik } = etf;

  const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${series_id}%22&forms=NPORT-P&dateRange=custom&startdt=2024-01-01`;
  let searchRes;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await sleep(SLEEP_MS * attempt);
    searchRes = await fetch(eftsUrl, {
      headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' }
    });
    if (searchRes.ok) break;
    if (attempt < 3) console.log(`  ${ticker}: EFTS attempt ${attempt} failed (${searchRes.status}), retrying...`);
  }

  if (!searchRes.ok) throw new Error(`EFTS search failed: ${searchRes.status}`);

  const searchData = await searchRes.json();
  const hits = searchData?.hits?.hits;
  if (!hits || hits.length === 0) {
    console.log(`  ${ticker}: no NPORT-P filings found`);
    return 0;
  }

  hits.sort((a, b) =>
    new Date(b._source.file_date) - new Date(a._source.file_date)
  );

  let totalWritten = 0;

  for (const hit of hits.slice(0, REPORT_MONTH_LOOKBACK)) {
    const adsh        = hit._source.adsh;
    const fileDate    = hit._source.file_date;
    const periodEnding = hit._source.period_ending || '';
    const reportMonth = periodEnding
      ? periodEnding.substring(0, 7)
      : fileDate.substring(0, 7);

    // Skip if already complete
    const existing = await d1q(
      `SELECT holdings_count FROM fund_snapshot_monthly WHERE series_id = ? AND report_month = ?`,
      [series_id, reportMonth]
    );
    if (existing.length > 0) {
      const storedRows = await d1q(
        `SELECT COUNT(*) as n FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?`,
        [series_id, reportMonth]
      );
      const storedCount   = storedRows[0]?.n || 0;
      const expectedCount = existing[0]?.holdings_count || 0;
      if (expectedCount > 0 && storedCount >= expectedCount) {
        // Known Issue 22.20 fix: this script has no persisted resume-offset key
        // (unlike holdings-pipeline.js's offset_{ticker}_{month} state), so a
        // deferred mark-complete (see below, and the guard note there) must be
        // detected here on the next run, not silently skipped forever — all
        // rows can be present with snapshot_status still NULL if a prior run's
        // budget guard deferred the mark-complete UPDATE after finishing inserts.
        const nullStatusRows = await d1q(
          `SELECT COUNT(*) as n FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ? AND snapshot_status IS NULL`,
          [series_id, reportMonth]
        );
        const nullCount = nullStatusRows[0]?.n || 0;
        if (nullCount === 0) {
          console.log(`  ${ticker} ${reportMonth}: already complete (${storedCount} rows) — skipping`);
          continue;
        }
        console.log(`  ${ticker} ${reportMonth}: ${storedCount} rows already present, mark-complete was deferred — finishing that step now`);
        const writesBeforeMarkComplete = await getTodayWriteCount();
        if (writesBeforeMarkComplete >= WRITE_ABORT_LIMIT) {
          console.log(`  DEFERRED (still): ${writesBeforeMarkComplete}/${WRITE_ABORT_LIMIT} writes today — re-run again after budget resets`);
          continue;
        }
        const deferredMarkCompleteWritten = await d1runMeta(
          `UPDATE fund_holdings_monthly SET snapshot_status = 'complete' WHERE series_id = ? AND report_month = ?`,
          [series_id, reportMonth]
        );
        await incrementWriteCount(deferredMarkCompleteWritten);
        console.log(`  ${ticker} ${reportMonth}: marked complete (deferred step finished)`);
        continue;
      }
    }

    // Fetch XML
    const filerCik = parseInt(hit._source.ciks[0], 10).toString();
    const accNoDashes = adsh.replace(/-/g, '');
    const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${accNoDashes}/primary_doc.xml`;

    await sleep(SLEEP_MS);
    const xmlRes = await fetch(xmlUrl, { headers: { 'User-Agent': SEC_UA } });
    if (!xmlRes.ok) {
      console.log(`  ${ticker} ${reportMonth}: XML fetch failed (HTTP ${xmlRes.status})`);
      continue;
    }

    const xml = await xmlRes.text();
    if (!xml.includes(series_id)) {
      console.log(`  ${ticker} ${reportMonth}: series_id not found in XML — skipping`);
      continue;
    }

    const { netAssets, totAssets, totLiabs, repPdEnd, rtn1, rtn2, rtn3,
            derivativesFlag, lendingFlag, holdings } = parseHoldings(xml);

    if (holdings.length === 0) {
      console.log(`  ${ticker} ${reportMonth}: 0 holdings parsed — skipping`);
      continue;
    }

    // Write snapshot header + clear stale rows
    await d1run(
      `INSERT OR REPLACE INTO fund_snapshot_monthly
         (series_id, report_month, ticker, net_assets, total_assets,
          total_liabilities, holdings_count, monthly_return_1,
          monthly_return_2, monthly_return_3, derivatives_flag,
          securities_lending_flag, filing_date, period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [series_id, reportMonth, ticker, netAssets, totAssets,
       totLiabs, holdings.length, rtn1, rtn2, rtn3,
       derivativesFlag, lendingFlag, fileDate, repPdEnd]
    );
    await d1run(
      `DELETE FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?`,
      [series_id, reportMonth]
    );

    // Insert holdings in batches of D1_BATCH_SIZE, snapshot_status NULL until done
    let rowCursor = 0;
    while (rowCursor < holdings.length) {
      // Per-batch abort check
      const writesNow = await getTodayWriteCount();
      if (writesNow >= WRITE_ABORT_LIMIT) {
        console.log(`  WRITE ABORT: ${writesNow} writes today — stopping mid-batch`);
        return totalWritten;
      }

      const chunk = holdings.slice(rowCursor, rowCursor + D1_BATCH_SIZE);
      const statements = chunk.map(h => ({
        sql: `INSERT INTO fund_holdings_monthly
                (series_id, report_month, ticker, security_name, cusip, isin,
                 security_ticker, position_value, weight_pct, shares,
                 asset_cat, issuer_country, is_restricted, snapshot_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        params: [
          series_id, reportMonth, ticker,
          h.security_name, h.cusip, h.isin, h.security_ticker,
          h.position_value, h.weight_pct, h.shares,
          h.asset_cat, h.issuer_country, h.is_restricted
        ]
      }));

      // Known Issue 22.20 fix: count the real D1-metered rows_written for this
      // batch, not chunk.length (a logical row count) — chunk.length under-
      // counted by ~7x against this table's real multiplier (confirmed live,
      // 2026-08-30: see d1batch's comment), silently letting this script's
      // true write cost go unrepresented in the shared writes_today_* counter
      // the main pipeline's guard also reads.
      const realWritten = await d1batch(statements);
      const newTotal = await incrementWriteCount(realWritten);
      rowCursor += chunk.length;
      totalWritten += chunk.length;

      if (newTotal >= WRITE_ABORT_LIMIT) {
        console.log(`  WRITE ABORT: crossed ${WRITE_ABORT_LIMIT} writes — stopping`);
        return totalWritten;
      }
    }

    // Known Issue 22.20 fix: same pre-check as holdings-pipeline.js's Known
    // Issue 22.19 fix — this UPDATE touches every row for this ETF/month (not
    // negligible) and was previously not budget-checked or counted at all here
    // (unlike the main pipeline, which at least counted it after the fact).
    // Check real current budget before issuing it; defer if already at/over
    // the abort limit so a re-run of this script picks the mark-complete step
    // back up (existing check further up skips straight to it once holdings
    // are already fully inserted).
    const writesBeforeMarkComplete = await getTodayWriteCount();
    if (writesBeforeMarkComplete >= WRITE_ABORT_LIMIT) {
      console.log(
        `  DEFERRED: ${ticker} ${reportMonth} — all ${holdings.length} rows inserted but ` +
        `mark-complete deferred (${writesBeforeMarkComplete}/${WRITE_ABORT_LIMIT} writes today). ` +
        `Re-run this script after budget resets to mark it complete.`
      );
      return totalWritten;
    }

    // Mark complete — same pattern as pipeline: only now does the API serve rows
    const markCompleteWritten = await d1runMeta(
      `UPDATE fund_holdings_monthly SET snapshot_status = 'complete' WHERE series_id = ? AND report_month = ?`,
      [series_id, reportMonth]
    );
    await incrementWriteCount(markCompleteWritten);

    // AUM downgrade check (same logic as pipeline)
    if (netAssets > 0 && netAssets < 200_000_000) {
      await d1run(
        `UPDATE etf_master SET coverage_status = 'directory' WHERE series_id = ? AND LOWER(coverage_status) = 'deep'`,
        [series_id]
      );
      console.log(`  ${ticker}: downgraded to directory — net_assets ${netAssets} below $200M`);
    }

    console.log(`  ${ticker} ${reportMonth}: ${holdings.length} holdings written`);
  }

  // Update coverage_depth (same logic as pipeline)
  const monthRows = await d1q(
    `SELECT COUNT(DISTINCT report_month) as month_count FROM fund_holdings_monthly WHERE series_id = ?`,
    [series_id]
  );
  const monthCount = monthRows[0]?.month_count ?? 0;
  const coverageDepth = monthCount === 0 ? null
    : monthCount === 1 ? 1
    : monthCount < 6  ? 2
    : 3;
  if (coverageDepth !== null) {
    await d1run(
      `UPDATE etf_master SET coverage_depth = ? WHERE series_id = ?`,
      [coverageDepth, series_id]
    );
  }

  return totalWritten;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('CATCHUP SCRIPT — Step 0 Confirmation');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`DATABASE:     meridian-etf`);
  console.log(`DATABASE_ID:  ${DATABASE_ID}`);
  console.log(`TABLE:        fund_holdings_monthly`);
  console.log(`NO LOCAL FILES: XML fetched and parsed in memory only.`);
  console.log(`                No .xml, .json, or intermediate files`);
  console.log(`                written to disk at any point.`);
  console.log(`TICKERS (${TARGET_TICKERS.length}):`);
  console.log(`  ${TARGET_TICKERS.join(', ')}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Write guard — abort if already near limit
  const initialWrites = await getTodayWriteCount();
  console.log(`Current writes_today (${TODAY}): ${initialWrites}`);
  if (initialWrites >= WRITE_GUARD_LIMIT) {
    console.error(`ABORT: writes_today = ${initialWrites} >= ${WRITE_GUARD_LIMIT}. Exiting.`);
    process.exit(1);
  }
  console.log(`Write guard OK — proceeding (abort limit: ${WRITE_ABORT_LIMIT})\n`);

  // Fetch etf_master rows for the 29 tickers
  const placeholders = TARGET_TICKERS.map(() => '?').join(', ');
  const etfRows = await d1q(
    `SELECT ticker, series_id, cik, name FROM etf_master
     WHERE ticker IN (${placeholders}) AND has_nport = 1 AND series_id IS NOT NULL`,
    TARGET_TICKERS
  );

  const etfMap = new Map(etfRows.map(r => [r.ticker, r]));

  const failures = [];
  let runningTotal = initialWrites;

  for (const ticker of TARGET_TICKERS) {
    const etf = etfMap.get(ticker);
    if (!etf) {
      console.log(`✗ ${ticker} — not found in etf_master or has_nport=0 or no series_id`);
      failures.push({ ticker, reason: 'not in etf_master / no series_id' });
      continue;
    }

    // Per-ETF write guard
    const writesBeforeEtf = await getTodayWriteCount();
    if (writesBeforeEtf >= WRITE_ABORT_LIMIT) {
      console.log(`WRITE ABORT: ${writesBeforeEtf} writes — stopping before ${ticker}`);
      failures.push({ ticker, reason: 'write limit reached before starting' });
      break;
    }

    try {
      const written = await ingestEtf(etf);
      runningTotal = await getTodayWriteCount();

      // Fetch coverage_depth for the report line
      const depthRow = await d1q(
        `SELECT coverage_depth FROM etf_master WHERE series_id = ?`,
        [etf.series_id]
      );
      const depth = depthRow[0]?.coverage_depth ?? 'null';
      console.log(`✓ ${ticker} — ${written} holdings written, coverage_depth now ${depth} (writes_today: ${runningTotal})`);
    } catch (err) {
      console.error(`✗ ${ticker} — ERROR: ${err.message}`);
      failures.push({ ticker, reason: err.message });
    }

    await sleep(SLEEP_MS);
  }

  // Final summary
  const finalWrites = await getTodayWriteCount();
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('CATCHUP COMPLETE');
  console.log(`Final writes_today (${TODAY}): ${finalWrites}`);
  if (failures.length > 0) {
    console.log(`\nFailed tickers (${failures.length}):`);
    for (const f of failures) {
      console.log(`  ✗ ${f.ticker}: ${f.reason}`);
    }
  } else {
    console.log('All tickers processed without errors.');
  }
  console.log('\nConfirmed: no XML or intermediate files written to disk.');
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
