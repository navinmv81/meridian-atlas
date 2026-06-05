const SEC_UA = "MeridianAtlas contact@meridianatlas.com";
const SLEEP_MS = 200;             // delay between EDGAR HTTP fetches only
const REPORT_MONTH_LOOKBACK = 1;  // store last N months of holdings
const PIPELINE_BATCH_SIZE = 5;    // ETFs per cron invocation

// ── Exports ───────────────────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHoldingsPipeline(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      ctx.waitUntil(runHoldingsPipeline(env));
      return new Response(JSON.stringify({ ok: true, message: 'Pipeline triggered' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.pathname === '/status') {
      return pipelineStatus(env);
    }
    return new Response('Holdings Pipeline Worker', { status: 200 });
  }
};

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function runHoldingsPipeline(env) {
  const db = env.DB;
  const startTime = new Date().toISOString();

  await setPipelineState(db, 'last_full_run', startTime);

  // Get all deep-coverage ETFs with series_id from etf_master
  const { results: etfs } = await db.prepare(`
    SELECT ticker, series_id, cik, name
    FROM etf_master
    WHERE has_nport = 1
      AND series_id IS NOT NULL
      AND coverage_status = 'deep'
    ORDER BY net_assets DESC
  `).all();

  const total = etfs.length;

  // Read current offset — advances each invocation by PIPELINE_BATCH_SIZE
  const offsetRow = await db.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'etf_offset'`
  ).first();
  const offset = parseInt(offsetRow?.value || '0', 10);

  const batch = etfs.slice(offset, offset + PIPELINE_BATCH_SIZE);
  console.log(`Holdings pipeline: processing ETFs ${offset}–${offset + batch.length} of ${total}`);

  let processed = 0;
  let errors = 0;

  for (const etf of batch) {
    try {
      await processEtfHoldings(db, etf);
      processed++;
    } catch (e) {
      console.error(`Pipeline error for ${etf.ticker}:`, e.message);
      errors++;
    }
    // Rate limit between EDGAR fetches
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }

  const newOffset = offset + batch.length;
  await setPipelineState(db, 'etfs_processed', processed.toString());

  if (newOffset >= total) {
    // Full pass complete — reset offset for next monthly refresh
    await setPipelineState(db, 'etf_offset', '0');
    await setPipelineState(db, 'last_run_status', `complete:${processed}ok:${errors}err`);
    console.log(`Pipeline pass complete. Total ETFs: ${total}. Offset reset to 0.`);
  } else {
    await setPipelineState(db, 'etf_offset', newOffset.toString());
    await setPipelineState(db, 'last_run_status', `running:${newOffset}/${total}`);
    console.log(`Batch done. Offset: ${newOffset}/${total}. Processed: ${processed}, Errors: ${errors}`);
  }
}

// ── Per-ETF processing ────────────────────────────────────────────────────────

async function processEtfHoldings(db, etf) {
  const { ticker, series_id, cik } = etf;

  // Find latest NPORT-P filings via EFTS
  const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${series_id}%22&forms=NPORT-P&dateRange=custom&startdt=2024-01-01`;
  const searchRes = await fetch(eftsUrl, {
    headers: { "User-Agent": SEC_UA, "Accept": "application/json" }
  });

  if (!searchRes.ok) {
    throw new Error(`EFTS search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const hits = searchData?.hits?.hits;
  if (!hits || hits.length === 0) return;

  // Sort by date descending — process latest N months
  hits.sort((a, b) =>
    new Date(b._source.file_date) - new Date(a._source.file_date)
  );

  for (const hit of hits.slice(0, REPORT_MONTH_LOOKBACK)) {
    const adsh = hit._source.adsh;
    const fileDate = hit._source.file_date;
    const periodEnding = hit._source.period_ending || '';

    // Derive report_month from period_ending (YYYY-MM-DD → YYYY-MM)
    const reportMonth = periodEnding
      ? periodEnding.substring(0, 7)
      : fileDate.substring(0, 7);

    // Check if already stored — skip if so (idempotent)
    const existing = await db.prepare(`
      SELECT series_id FROM fund_snapshot_monthly
      WHERE series_id = ? AND report_month = ?
    `).bind(series_id, reportMonth).first();

    if (existing) continue;

    // Fetch the holdings XML
    const filerCik = parseInt(hit._source.ciks[0], 10).toString();
    const accNoDashes = adsh.replace(/-/g, '');
    const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${accNoDashes}/primary_doc.xml`;

    await new Promise(r => setTimeout(r, SLEEP_MS));
    const xmlRes = await fetch(xmlUrl, {
      headers: { "User-Agent": SEC_UA }
    });

    if (!xmlRes.ok) continue;

    const xml = await xmlRes.text();

    // Confirm this filing covers the target series
    if (!xml.includes(series_id)) continue;

    await storeHoldings(db, series_id, ticker, reportMonth, fileDate, xml);
  }
}

// ── Parse & store ─────────────────────────────────────────────────────────────

async function storeHoldings(db, series_id, ticker, reportMonth, fileDate, xml) {
  // Lightweight tag extractor — text content only
  const getTag = (src, tag) => {
    const m = src.match(
      new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`, 'i')
    );
    return m ? m[1].trim() : null;
  };

  // ── Fund-level data ──
  const netAssets = parseFloat(getTag(xml, 'netAssets') || '0') || 0;
  const totAssets = parseFloat(getTag(xml, 'totAssets') || '0') || 0;
  const totLiabs  = parseFloat(getTag(xml, 'totLiabs')  || '0') || 0;
  const repPdEnd  = getTag(xml, 'repPdEnd') || '';

  // Monthly returns — rtn1/rtn2/rtn3 attributes on monthlyTotReturn elements
  const returnMatches = [...xml.matchAll(/rtn1="([^"]+)"/g)];
  const rtn1 = returnMatches[0] ? parseFloat(returnMatches[0][1]) : null;
  const rtn2Match = xml.match(/rtn2="([^"]+)"/);
  const rtn3Match = xml.match(/rtn3="([^"]+)"/);
  const rtn2 = rtn2Match ? parseFloat(rtn2Match[1]) : null;
  const rtn3 = rtn3Match ? parseFloat(rtn3Match[1]) : null;

  const derivativesFlag = xml.includes('<derivativeInfo>') ? 1 : 0;
  const lendingFlag     = xml.includes('<securityLending>') ? 1 : 0;

  // ── Parse holdings ──
  const holdingsRegex = /<(?:[\w-]+:)?invstOrSec(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?invstOrSec>/gi;
  const holdings = [];
  let match;

  while ((match = holdingsRegex.exec(xml)) !== null) {
    const block = match[1];

    const secName   = getTag(block, 'name') || getTag(block, 'title') || 'Unknown';
    const cusip     = getTag(block, 'cusip');
    const isinMatch = block.match(/isin\s+value="([^"]+)"/i);
    const isin      = isinMatch ? isinMatch[1] : null;
    const secTicker = getTag(block, 'ticker');
    const balance   = parseFloat(getTag(block, 'balance') || '0') || null;
    const valUSD    = parseFloat(getTag(block, 'valUSD')   || '0') || null;
    const pctVal    = parseFloat(getTag(block, 'pctVal')   || '0') || null;

    // Asset category — attribute format takes priority over child tag
    const assetCondMatch = block.match(
      /<(?:[\w-]+:)?assetConditional[^>]*\sassetCat="([^"]+)"/i
    );
    const assetCat = assetCondMatch
      ? assetCondMatch[1]
      : getTag(block, 'assetCat');

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

  if (holdings.length === 0) return; // don't store empty filings

  // ── Write snapshot (upsert) ──
  await db.prepare(`
    INSERT OR REPLACE INTO fund_snapshot_monthly
      (series_id, report_month, ticker, net_assets, total_assets,
       total_liabilities, holdings_count, monthly_return_1,
       monthly_return_2, monthly_return_3, derivatives_flag,
       securities_lending_flag, filing_date, period_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    series_id, reportMonth, ticker, netAssets, totAssets,
    totLiabs, holdings.length, rtn1, rtn2, rtn3,
    derivativesFlag, lendingFlag, fileDate, repPdEnd
  ).run();

  // ── Write holdings — delete then insert (clean replacement) ──
  await db.prepare(`
    DELETE FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?
  `).bind(series_id, reportMonth).run();

  // Insert in chunks of 50 to stay within D1 statement limits
  const CHUNK = 50;
  for (let i = 0; i < holdings.length; i += CHUNK) {
    const chunk = holdings.slice(i, i + CHUNK);
    for (const h of chunk) {
      await db.prepare(`
        INSERT INTO fund_holdings_monthly
          (series_id, report_month, ticker, security_name, cusip, isin,
           security_ticker, position_value, weight_pct, shares,
           asset_cat, issuer_country, is_restricted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        series_id, reportMonth, ticker,
        h.security_name, h.cusip, h.isin, h.security_ticker,
        h.position_value, h.weight_pct, h.shares,
        h.asset_cat, h.issuer_country, h.is_restricted
      ).run();
    }
  }

  console.log(`Stored ${holdings.length} holdings for ${ticker} ${reportMonth}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setPipelineState(db, key, value) {
  await db.prepare(`
    INSERT OR REPLACE INTO holdings_pipeline_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).bind(key, String(value)).run();
}

async function pipelineStatus(env) {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM holdings_pipeline_state`
  ).all();
  const state = Object.fromEntries(results.map(r => [r.key, r.value]));

  const counts = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT series_id) FROM fund_snapshot_monthly) as snapshots,
      (SELECT COUNT(*) FROM fund_holdings_monthly) as total_holdings,
      (SELECT COUNT(DISTINCT series_id) FROM fund_holdings_monthly) as etfs_with_holdings
  `).first();

  return new Response(JSON.stringify({ ...state, ...counts }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
