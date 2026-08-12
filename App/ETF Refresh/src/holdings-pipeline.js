const SEC_UA = "MeridianAtlas contact@meridianatlas.com";
const SLEEP_MS = 200;             // delay between EDGAR HTTP fetches only
const REPORT_MONTH_LOOKBACK = 2;  // store last N months of holdings
const PIPELINE_BATCH_SIZE = 20;    // ETFs per cron invocation

// D1 db.batch() sends up to D1_BATCH_SIZE statements per HTTP round-trip (one subrequest).
// 100 is the documented D1 batch ceiling per call.
const D1_BATCH_SIZE = 100;

// Free tier Workers: 50 subrequests per invocation (covers fetch + D1 calls combined).
// Per-ETF overhead: ~2 fetch (EFTS + XML) + ~4 D1 checks + ~2 D1 writes = ~8 subrequests.
// Fixed invocation overhead: ~4 (SELECTs, state writes) — reduced from ~5 8
// August 2026 after removing the redundant per-invocation ALTER TABLE
// (MA-AUG-004 root-cause fix, see runHoldingsPipeline() above).
// That leaves ~37 batch slots per ETF per invocation = 3,700 rows max.
// Using 35 as a safe margin — covers AGG (13,186 rows) in 4 cron cycles (~8 h).
const MAX_BATCHES_PER_RUN = 35;

const DAILY_WRITE_LIMIT = 80_000;
const WRITE_COUNTER_PREFIX = 'writes_today_';

function decodeXmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

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

  // Emergency stop — checked first, before any other work. See checkHold() above.
  if (await checkHold(db)) {
    console.log('holdings-pipeline: hold_all_jobs is set — skipping run.');
    return;
  }

  const startTime = new Date().toISOString();

  // REMOVED 8 August 2026 (MA-AUG-004 root-cause fix): this Worker ran an
  // unconditional `ALTER TABLE ... ADD COLUMN snapshot_status` on every single
  // invocation (scheduled and /run), relying on the try/catch to silently
  // swallow the "duplicate column" error after the column's first successful
  // add. The column has been live since then and is now tracked properly in
  // migrations/a1-a4-upgrade.sql (line 8) — this runtime ALTER TABLE was pure
  // redundant defensive code, not the real mechanism, and had been a no-op
  // costing one wasted subrequest/write-attempt on every invocation since.
  // Verified via a read-only SELECT against the live column before removal.

  await setPipelineState(db, 'last_full_run', startTime);

  // Get all deep-coverage ETFs with series_id from etf_master
  const { results: etfs } = await db.prepare(`
    SELECT ticker, series_id, cik, name
    FROM etf_master
    WHERE has_nport = 1
      AND series_id IS NOT NULL
      AND LOWER(coverage_status) = 'deep'
    ORDER BY net_assets DESC NULLS LAST
  `).all();

  const total = etfs.length;

  // Read current offset — advances each invocation by PIPELINE_BATCH_SIZE
  const offsetRow = await db.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'etf_offset'`
  ).first();
  const offset = parseInt(offsetRow?.value || '0', 10);

  const batch = etfs.slice(offset, offset + PIPELINE_BATCH_SIZE);
  console.log(`Holdings pipeline: processing ETFs ${offset}–${offset + batch.length} of ${total}`);

  // Invocation-level write guard — skip if daily budget already approached
  // FIXED 2 August 2026 (Fix 2 / MA-AUG-004, Architect review completed):
  // this check alone only ran once per ETF, before it starts, which was the
  // gap flagged here since 28 July — a single large ETF's full insert loop
  // in storeHoldings() (up to 35 batches x ~9x multiplier, ~31,500 real
  // rows_written) had no checkpoint inside it, so one big ETF could carry
  // the day's total well past DAILY_WRITE_LIMIT before the next ETF's
  // pre-check ever fired. storeHoldings()'s own insert loop now checks the
  // real running total after every batch (via incrementWriteCount()'s
  // returned value) and breaks early if the limit is hit — see that
  // function for the actual mid-loop checkpoint. This outer check remains
  // as the cheap first line of defense before even starting a new ETF.
  const todayWrites = await getTodayWriteCount(db);
  if (todayWrites >= DAILY_WRITE_LIMIT) {
    console.log(
      `Daily write limit approached (${todayWrites} rows). ` +
      `Skipping new ETF processing until UTC reset.`
    );
    await setPipelineState(
      db,
      'last_run_status',
      `write_limit:${todayWrites}:skipped`
    );
    return;
  }

  let completedCount = 0; // ETFs fully finished this invocation (offset should advance past them)
  let errors = 0;

  for (const etf of batch) {
    // Per-ETF write guard — stop starting new ETFs if limit reached mid-batch
    const writesBeforeEtf = await getTodayWriteCount(db);
    if (writesBeforeEtf >= DAILY_WRITE_LIMIT) {
      console.log(
        `Write limit reached mid-batch at ${writesBeforeEtf} rows. ` +
        `Completing current ETF only — no new ETFs this invocation.`
      );
      break;
    }

    try {
      const done = await processEtfHoldings(db, etf);
      if (done) completedCount++;
      // If done === false the ETF has a saved resume offset — etf_offset stays pointing at it
    } catch (e) {
      console.error(`Pipeline error for ${etf.ticker}:`, e.message);
      errors++;
      completedCount++; // advance past a hard-errored ETF to avoid an infinite retry loop
    }
    // Rate limit between EDGAR fetches
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }

  // Only advance etf_offset by the number of ETFs that fully completed.
  // Partially-inserted ETFs leave etf_offset unchanged so the next cron cycle
  // re-encounters them and resumes from their saved holdings offset key.
  const newOffset = offset + completedCount;
  await setPipelineState(db, 'etfs_processed', completedCount.toString());

  if (completedCount > 0 && newOffset >= total) {
    await setPipelineState(db, 'etf_offset', '0');
    await setPipelineState(db, 'last_run_status', `complete:${completedCount}ok:${errors}err`);
    console.log(`Pipeline pass complete. Total ETFs: ${total}. Offset reset to 0.`);
  } else {
    await setPipelineState(db, 'etf_offset', newOffset.toString());
    await setPipelineState(db, 'last_run_status', `running:${newOffset}/${total}:partial:${batch.length - completedCount}`);
    console.log(`Batch done. Offset: ${newOffset}/${total}. Completed: ${completedCount}, Partial: ${batch.length - completedCount - errors}, Errors: ${errors}`);
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

    // Per-ETF-month resume offset key: 'offset_{ticker}_{reportMonth}'
    // Exists and > 0 while an insert is in progress across cron cycles.
    const offsetKey = `offset_${ticker}_${reportMonth}`;
    const offsetRow = await db.prepare(
      `SELECT value FROM holdings_pipeline_state WHERE key = ?`
    ).bind(offsetKey).first();
    const insertOffset = parseInt(offsetRow?.value || '0', 10);

    if (insertOffset === 0 && !offsetRow) {
      // No resume in progress — check if this ETF/month is already fully complete
      const existing = await db.prepare(`
        SELECT series_id, holdings_count FROM fund_snapshot_monthly
        WHERE series_id = ? AND report_month = ?
      `).bind(series_id, reportMonth).first();

      if (existing) {
        const storedRow = await db.prepare(`
          SELECT COUNT(*) as n FROM fund_holdings_monthly
          WHERE series_id = ? AND report_month = ?
        `).bind(series_id, reportMonth).first();
        const storedCount   = storedRow?.n              || 0;
        const expectedCount = existing.holdings_count   || 0;
        if (expectedCount > 0 && storedCount >= expectedCount) continue; // fully complete
        console.log(`Incomplete snapshot for ${ticker} ${reportMonth}: ${storedCount}/${expectedCount} — re-fetching`);
      }
    } else {
      console.log(`Resuming ${ticker} ${reportMonth} from row ${insertOffset}`);
    }

    // Fetch the holdings XML
    const filerCik = parseInt(hit._source.ciks[0], 10).toString();
    const accNoDashes = adsh.replace(/-/g, '');
    const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${accNoDashes}/primary_doc.xml`;

    await new Promise(r => setTimeout(r, SLEEP_MS));
    const xmlRes = await fetch(xmlUrl, { headers: { "User-Agent": SEC_UA } });
    if (!xmlRes.ok) continue;

    const xml = await xmlRes.text();
    if (!xml.includes(series_id)) continue;

    const { done, nextOffset } = await storeHoldings(
      db, series_id, ticker, reportMonth, fileDate, xml, insertOffset
    );

    if (done) {
      // Clear the resume offset key — this ETF/month is complete
      await db.prepare(
        `DELETE FROM holdings_pipeline_state WHERE key = ?`
      ).bind(offsetKey).run();
      return true;
    } else {
      // Save progress so the next cron cycle resumes from here
      await setPipelineState(db, offsetKey, nextOffset.toString());
      console.log(`${ticker} ${reportMonth}: inserted up to row ${nextOffset}, will resume next cycle`);
      return false;
    }
  }

  return true; // no hits or all months skipped — counts as complete for offset purposes
}

// ── Parse & store ─────────────────────────────────────────────────────────────

async function storeHoldings(db, series_id, ticker, reportMonth, fileDate, xml, insertOffset = 0) {
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

    const secName   = decodeXmlEntities(getTag(block, 'name') || getTag(block, 'title') || 'Unknown');
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

  if (holdings.length === 0) return { done: true, nextOffset: 0 };

  // First run only (insertOffset === 0): write the snapshot header and clear any
  // stale rows. On resume runs these are already in place — skip to save subrequests.
  if (insertOffset === 0) {
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

    await db.prepare(`
      DELETE FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ?
    `).bind(series_id, reportMonth).run();
  }

  // Insert holdings[insertOffset..] in batches of D1_BATCH_SIZE (one subrequest per batch).
  // snapshot_status is NULL during insert — the API's WHERE snapshot_status = 'complete'
  // filter returns nothing until the final UPDATE, so partial data is never served.
  // Stop after MAX_BATCHES_PER_RUN batch calls to stay within free-tier subrequest limit.
  let batchesUsed = 0;
  let rowCursor = insertOffset;

  while (rowCursor < holdings.length && batchesUsed < MAX_BATCHES_PER_RUN) {
    const chunk = holdings.slice(rowCursor, rowCursor + D1_BATCH_SIZE);
    const batchResults = await db.batch(
      chunk.map(h =>
        db.prepare(`
          INSERT INTO fund_holdings_monthly
            (series_id, report_month, ticker, security_name, cusip, isin,
             security_ticker, position_value, weight_pct, shares,
             asset_cat, issuer_country, is_restricted, snapshot_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `).bind(
          series_id, reportMonth, ticker,
          h.security_name, h.cusip, h.isin, h.security_ticker,
          h.position_value, h.weight_pct, h.shares,
          h.asset_cat, h.issuer_country, h.is_restricted
        )
      )
    );
    // FIXED 2026-07-25: was incrementing by chunk.length (logical rows),
    // not Cloudflare's actual billed rows_written. Confirmed empirically
    // that D1 meters ~9 rows_written per logical row on this table (index
    // maintenance + the snapshot_status update below), so the guard was
    // comparing the wrong unit against DAILY_WRITE_LIMIT and never tripped
    // until real usage was ~7x the free-tier daily cap. Sum the batch's own
    // reported meta.rows_written instead — same unit the cap is defined in.
    const realWritten = batchResults.reduce((sum, r) => sum + (r?.meta?.rows_written || 0), 0);
    const runningTotal = await incrementWriteCount(db, realWritten);
    rowCursor += chunk.length;
    batchesUsed++;

    // FIXED 2 August 2026 (Fix 2 / MA-AUG-004): mid-loop write checkpoint —
    // the two existing guards (once per batch-of-ETFs, once per ETF) only
    // check headroom BEFORE a large ETF's insert loop starts. A single large
    // ETF (e.g. AGG, 13,186 rows) can still carry the day's total well past
    // DAILY_WRITE_LIMIT inside this while loop before either outer guard
    // ever runs again. Using the real ground-truth runningTotal returned by
    // incrementWriteCount() (same D1-metered meta.rows_written this file
    // already fixed once before, not an estimate) — stop immediately if the
    // limit is hit, leaving rowCursor short of holdings.length so the
    // existing done/nextOffset/offsetKey resume path (below) picks this
    // exact position back up next invocation. No data loss, no duplicate
    // inserts — this is the same resumable mechanism already used when
    // MAX_BATCHES_PER_RUN is hit, just triggered by a real budget check
    // instead of a fixed batch count.
    if (runningTotal >= DAILY_WRITE_LIMIT) {
      console.log(
        `[holdings-pipeline] Daily write limit reached mid-run (${runningTotal}/${DAILY_WRITE_LIMIT}) ` +
        `after batch ${batchesUsed} for ${ticker} ${reportMonth} — stopping at row ${rowCursor} of ` +
        `${holdings.length}. Will resume from this offset next invocation.`
      );
      break;
    }
  }

  const done = rowCursor >= holdings.length;

  if (done) {
    // All rows inserted — atomically mark complete. Only now does the API serve them.
    // FIXED 2026-07-25: this single UPDATE touches every holdings row for
    // this ETF/month, so its rows_written is not negligible — confirmed via
    // Cloudflare dashboard that this one statement accounted for ~102,480 of
    // a day's rows_written across just 30 executions (~3,416/call), yet it
    // was never counted toward the write guard at all. Now counted.
    const markCompleteResult = await db.prepare(`
      UPDATE fund_holdings_monthly
      SET snapshot_status = 'complete'
      WHERE series_id = ? AND report_month = ?
    `).bind(series_id, reportMonth).run();
    await incrementWriteCount(db, markCompleteResult?.meta?.rows_written || 0);
    console.log(`Stored all ${holdings.length} holdings for ${ticker} ${reportMonth}`);

    // AUM boundary check — downgrade sub-$200M ETFs after first successful ingestion
    if (netAssets > 0 && netAssets < 200_000_000) {
      await db.prepare(`
        UPDATE etf_master
        SET coverage_status = 'directory'
        WHERE series_id = ?
        AND LOWER(coverage_status) = 'deep'
      `).bind(series_id).run();
      console.log(
        `Downgraded ${series_id} to directory — ` +
        `net_assets ${netAssets} below $200M threshold`
      );
    }

    // v2: Update coverage_depth after successful ingestion
    // Runs once per ETF per ingestion cycle — never inside the holding-row insert loop
    try {
      const monthResult = await db.prepare(
        `SELECT COUNT(DISTINCT report_month) as month_count
         FROM fund_holdings_monthly
         WHERE series_id = ?`
      ).bind(series_id).first();

      const monthCount = monthResult?.month_count ?? 0;
      const coverageDepth = monthCount === 0 ? null
        : monthCount === 1 ? 1
        : monthCount < 6  ? 2
        : 3;

      if (coverageDepth !== null) {
        await db.prepare(
          `UPDATE etf_master SET coverage_depth = ? WHERE series_id = ?`
        ).bind(coverageDepth, series_id).run();
      }
    } catch (err) {
      // Non-fatal: log and continue. coverage_depth will be corrected on next run.
      console.error(`coverage_depth update failed for ${series_id}:`, err.message);
    }
  } else {
    console.log(`${ticker} ${reportMonth}: inserted rows ${insertOffset}–${rowCursor - 1} of ${holdings.length} (budget exhausted)`);
  }

  return { done, nextOffset: rowCursor };
}

// ── Phase readiness cache ─────────────────────────────────────────────────────

/**
 * Computes phase readiness metrics and writes them to holdings_pipeline_state.
 * Called once per cron run after ingestion completes. Non-fatal.
 */
async function refreshPhaseReadinessCache(env) {
  const db = env.DB;
  try {
    const existingCache = await db.prepare(
      'SELECT value FROM holdings_pipeline_state WHERE key = ?'
    ).bind('phase_readiness_cache').first();

    let cachedMaxMonth = null;
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache.value);
        const computedAt = new Date(parsed.computedAt);
        const ageHours = (Date.now() - computedAt.getTime()) / 3600000;
        if (ageHours < 6) {
          cachedMaxMonth = parsed.pipeline?.maxEtfsInSingleMonth ?? null;
        }
      } catch(e) {}
    }

    const [pctRow, twoMonthRow, maxMonthRow, deepRow] = await Promise.all([
      db.prepare(`
        SELECT
          ROUND(100.0 * COUNT(CASE WHEN coverage_depth >= 1 THEN 1 END) / COUNT(*), 1) as pct
        FROM etf_master WHERE coverage_status = 'deep'
      `).first(),

      db.prepare(`
        SELECT COUNT(*) as cnt FROM etf_master
        WHERE coverage_depth >= 2
      `).first(),

      cachedMaxMonth !== null
        ? Promise.resolve({ max_cnt: cachedMaxMonth })
        : db.prepare(`
            SELECT MAX(cnt) as max_cnt FROM (
              SELECT report_month, COUNT(DISTINCT series_id) as cnt
              FROM fund_holdings_monthly
              GROUP BY report_month
            )
          `).first(),

      db.prepare(`
        SELECT COUNT(*) as cnt FROM etf_master WHERE coverage_status = 'deep'
      `).first()
    ]);

    const summary = {
      status: 'ok',
      stale: false,
      pipeline: {
        holdingsCompletePct: pctRow?.pct ?? 0,
        etfsWith2PlusMonths: twoMonthRow?.cnt ?? 0,
        maxEtfsInSingleMonth: maxMonthRow?.max_cnt ?? 0
      },
      phases: {
        B: {
          name: 'ETF Briefing Narrative Intelligence',
          requiredEtfsWith2PlusMonths: 20,
          currentEtfsWith2PlusMonths: twoMonthRow?.cnt ?? 0,
          ready: (twoMonthRow?.cnt ?? 0) >= 20
        },
        C: {
          name: 'Flow Pressure Index',
          requiredEtfsWith2PlusMonths: 10,
          currentEtfsWith2PlusMonths: twoMonthRow?.cnt ?? 0,
          ready: (twoMonthRow?.cnt ?? 0) >= 10
        },
        D: {
          name: 'Implied Conviction View',
          requiredDeepEtfs: 100,
          currentDeepEtfs: deepRow?.cnt ?? 0,
          ready: (deepRow?.cnt ?? 0) >= 100
        },
        E: {
          name: 'ETF DNA Fingerprint',
          requiredEtfsInSingleMonth: 150,
          currentMaxEtfsInSingleMonth: maxMonthRow?.max_cnt ?? 0,
          ready: (maxMonthRow?.max_cnt ?? 0) >= 150
        }
      },
      computedAt: new Date().toISOString()
    };

    await db.prepare(
      `INSERT OR REPLACE INTO holdings_pipeline_state (key, value)
       VALUES ('phase_readiness_cache', ?)`
    ).bind(JSON.stringify(summary)).run();

  } catch (err) {
    console.error('Phase readiness cache refresh failed:', err.message);
    // Non-fatal: pipeline continues
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setPipelineState(db, key, value) {
  await db.prepare(`
    INSERT OR REPLACE INTO holdings_pipeline_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).bind(key, String(value)).run();
}

// ── Write budget tracking ─────────────────────────────────────────────────────

async function getTodayWriteCount(db) {
  const today = new Date().toISOString().slice(0, 10);
  const key = WRITE_COUNTER_PREFIX + today;
  const row = await db.prepare(
    'SELECT value FROM holdings_pipeline_state WHERE key = ?'
  ).bind(key).first();
  return row ? parseInt(row.value || '0', 10) : 0;
}

async function incrementWriteCount(db, count) {
  const today = new Date().toISOString().slice(0, 10);
  const key = WRITE_COUNTER_PREFIX + today;
  const current = await getTodayWriteCount(db);
  const newTotal = current + count;
  await db.prepare(
    `INSERT INTO holdings_pipeline_state (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, String(newTotal)).run();
  // FIXED 2 August 2026 (Fix 2 / MA-AUG-004, Architect review completed):
  // returns the post-increment running total so callers can check it
  // immediately without a second read — see storeHoldings()'s insert loop
  // below, the mid-loop checkpoint this was added for.
  return newTotal;
}

// FIXED 3 August 2026 (MA-AUG-002 follow-up, safety-net audit): this Worker
// never had a hold_all_jobs kill switch — a real, pre-existing gap found
// while double-checking every D1-writing pipeline before resuming work after
// the 2 August incident. holdings-pipeline.js has the largest observed write
// multiplier of any pipeline (~9x on fund_holdings_monthly) and runs
// autonomously on a weekly cron, so of everything audited, this was the
// worst place to be missing the same emergency stop entities-seed.js,
// entities-enrich.js, and entities-figi.js already had.
async function checkHold(db) {
  const row = await db.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`
  ).first();
  return row?.value === 'true';
}

// ── Universe changes pre-computation ─────────────────────────────────────────

async function computeUniverseChanges(db) {
  // FLOW STEP A — Count ETFs with 2+ months (cheap indexed query)
  const countRow = await db.prepare(`
    SELECT COUNT(DISTINCT series_id) as cnt
    FROM (
      SELECT series_id
      FROM fund_holdings_monthly
      WHERE snapshot_status = 'complete'
      GROUP BY series_id
      HAVING COUNT(DISTINCT report_month) >= 2
    )
  `).first();

  const currentCount = countRow?.cnt || 0;

  if (currentCount === 0) {
    const cached = await db.prepare(
      'SELECT value FROM holdings_pipeline_state WHERE key = ?'
    ).bind('universe_month_pair_cache').first();

    if (cached) {
      try {
        const cacheData = JSON.parse(cached.value);
        if (cacheData.etf_count === 0) {
          console.log('Universe changes: no ETF has 2 months yet (cached)');
          return;
        }
      } catch(e) {}
    }

    await db.prepare(
      'INSERT INTO holdings_pipeline_state (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(
      'universe_month_pair_cache',
      JSON.stringify({
        etf_count: 0,
        cached_at: new Date().toISOString()
      })
    ).run();

    console.log('Universe changes: no ETF has 2 months yet — cached');
    return;
  }

  // FLOW STEP B — Check cache in holdings_pipeline_state
  const cacheRow = await db.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'universe_month_pair_cache'`
  ).first();

  let currentMonth, previousMonth;

  if (cacheRow) {
    try {
      const cacheData = JSON.parse(cacheRow.value);
      if (cacheData.etf_count === currentCount) {
        // Cache is valid — ETF count unchanged, use cached pair
        currentMonth  = cacheData.current_month;
        previousMonth = cacheData.previous_month;
        console.log(`Universe changes: using cached month pair ${currentMonth} vs ${previousMonth} (${currentCount} ETFs)`);
      }
    } catch (_) { /* corrupt cache — fall through to rediscovery */ }
  }

  // FLOW STEP C — Discover best month pair (only on cache miss or count change)
  if (!currentMonth) {
    const pairResult = await db.prepare(`
      SELECT
        h1.report_month as current_month,
        h2.report_month as previous_month,
        COUNT(DISTINCT h1.series_id) as etf_count
      FROM fund_holdings_monthly h1
      JOIN fund_holdings_monthly h2
        ON h2.series_id = h1.series_id
        AND h2.snapshot_status = 'complete'
        AND h2.report_month = (
          SELECT MAX(f.report_month)
          FROM fund_holdings_monthly f
          WHERE f.series_id = h1.series_id
          AND f.snapshot_status = 'complete'
          AND f.report_month < h1.report_month
        )
      WHERE h1.snapshot_status = 'complete'
      AND h1.report_month = (
        SELECT MAX(f2.report_month)
        FROM fund_holdings_monthly f2
        WHERE f2.series_id = h1.series_id
        AND f2.snapshot_status = 'complete'
      )
      GROUP BY h1.report_month, h2.report_month
      ORDER BY etf_count DESC
      LIMIT 1
    `).first();

    if (!pairResult) {
      console.log('Universe changes: month pair discovery returned no result');
      return;
    }

    currentMonth  = pairResult.current_month;
    previousMonth = pairResult.previous_month;

    // Save discovered pair to cache
    await db.prepare(
      `INSERT INTO holdings_pipeline_state (key, value)
       VALUES ('universe_month_pair_cache', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(JSON.stringify({
      current_month:  currentMonth,
      previous_month: previousMonth,
      etf_count:      currentCount,
      cached_at:      new Date().toISOString()
    })).run();

    console.log(`Universe changes: discovered and cached month pair ${currentMonth} vs ${previousMonth} for ${currentCount} ETFs`);
  }

  // FLOW STEP D — Idempotency check
  const existing = await db.prepare(`
    SELECT id FROM universe_changes_monthly
    WHERE current_month = ? AND previous_month = ?
    LIMIT 1
  `).bind(currentMonth, previousMonth).first();

  if (existing) {
    console.log(`Universe changes: already computed for this pair — skipping`);
    return;
  }

  // FLOW STEP E — Run computation (unchanged from original implementation)

  // new_positions: securities in current month NOT in previous month (by CUSIP)
  const { results: newPositions } = await db.prepare(`
    SELECT security_name, cusip, security_ticker, asset_cat,
      COUNT(DISTINCT series_id) as fund_count,
      SUM(weight_pct)           as total_weight,
      AVG(weight_pct)           as avg_weight,
      NULL                      as total_change
    FROM fund_holdings_monthly
    WHERE report_month = ?
      AND weight_pct > 0
      AND snapshot_status = 'complete'
      AND cusip IS NOT NULL
      AND cusip != '000000000'
      AND cusip NOT IN (
        SELECT cusip FROM fund_holdings_monthly
        WHERE report_month = ?
          AND weight_pct > 0
          AND snapshot_status = 'complete'
          AND cusip IS NOT NULL
          AND cusip != '000000000'
      )
    GROUP BY security_name, cusip
    ORDER BY fund_count DESC, total_weight DESC
    LIMIT 50
  `).bind(currentMonth, previousMonth).all();

  // Step D — exited_positions: securities in previous month NOT in current month (by CUSIP)
  const { results: exitedPositions } = await db.prepare(`
    SELECT security_name, cusip, security_ticker, asset_cat,
      COUNT(DISTINCT series_id) as fund_count,
      SUM(weight_pct)           as total_weight,
      AVG(weight_pct)           as avg_weight,
      NULL                      as total_change
    FROM fund_holdings_monthly
    WHERE report_month = ?
      AND weight_pct > 0
      AND snapshot_status = 'complete'
      AND cusip IS NOT NULL
      AND cusip != '000000000'
      AND cusip NOT IN (
        SELECT cusip FROM fund_holdings_monthly
        WHERE report_month = ?
          AND weight_pct > 0
          AND snapshot_status = 'complete'
          AND cusip IS NOT NULL
          AND cusip != '000000000'
      )
    GROUP BY security_name, cusip
    ORDER BY fund_count DESC, total_weight DESC
    LIMIT 50
  `).bind(previousMonth, currentMonth).all();

  // Step E — top_increases: weight grew from previous to current month (CUSIP join only)
  const { results: topIncreases } = await db.prepare(`
    SELECT c.security_name, c.cusip, c.security_ticker, c.asset_cat,
      COUNT(DISTINCT c.series_id)       as fund_count,
      SUM(c.weight_pct)                 as total_weight,
      AVG(c.weight_pct)                 as avg_weight,
      SUM(c.weight_pct - p.weight_pct)  as total_change
    FROM fund_holdings_monthly c
    JOIN fund_holdings_monthly p
      ON p.series_id    = c.series_id
      AND p.report_month = ?
      AND p.cusip        = c.cusip
      AND p.cusip IS NOT NULL
      AND p.cusip != '000000000'
    WHERE c.report_month      = ?
      AND c.weight_pct        > p.weight_pct
      AND c.snapshot_status   = 'complete'
    GROUP BY c.security_name, c.cusip
    ORDER BY total_change DESC
    LIMIT 50
  `).bind(previousMonth, currentMonth).all();

  // Step F — top_decreases: weight fell from previous to current month (CUSIP join only)
  const { results: topDecreases } = await db.prepare(`
    SELECT c.security_name, c.cusip, c.security_ticker, c.asset_cat,
      COUNT(DISTINCT c.series_id)       as fund_count,
      SUM(c.weight_pct)                 as total_weight,
      AVG(c.weight_pct)                 as avg_weight,
      SUM(c.weight_pct - p.weight_pct)  as total_change
    FROM fund_holdings_monthly c
    JOIN fund_holdings_monthly p
      ON p.series_id    = c.series_id
      AND p.report_month = ?
      AND p.cusip        = c.cusip
      AND p.cusip IS NOT NULL
      AND p.cusip != '000000000'
    WHERE c.report_month      = ?
      AND c.weight_pct        < p.weight_pct
      AND c.snapshot_status   = 'complete'
    GROUP BY c.security_name, c.cusip
    ORDER BY total_change ASC
    LIMIT 50
  `).bind(previousMonth, currentMonth).all();

  // Step G — write all results to universe_changes_monthly in one batch
  const computedAt = new Date().toISOString();
  const allRows = [
    ...(newPositions  || []).map(r => ({ ...r, change_type: 'new_position' })),
    ...(exitedPositions || []).map(r => ({ ...r, change_type: 'exited' })),
    ...(topIncreases  || []).map(r => ({ ...r, change_type: 'increased' })),
    ...(topDecreases  || []).map(r => ({ ...r, change_type: 'decreased' })),
  ];

  if (allRows.length === 0) {
    console.log('computeUniverseChanges: no rows to insert (no matching securities between months)');
    return;
  }

  // Insert in chunks of D1_BATCH_SIZE to respect D1 batch ceiling
  for (let i = 0; i < allRows.length; i += D1_BATCH_SIZE) {
    const chunk = allRows.slice(i, i + D1_BATCH_SIZE);
    await db.batch(
      chunk.map(r =>
        db.prepare(`
          INSERT OR IGNORE INTO universe_changes_monthly
            (computed_at, current_month, previous_month, change_type,
             security_name, cusip, security_ticker, asset_cat,
             fund_count, total_weight, avg_weight, total_change)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          computedAt, currentMonth, previousMonth, r.change_type,
          r.security_name || null, r.cusip || null,
          r.security_ticker || null, r.asset_cat || null,
          r.fund_count || 0, r.total_weight || 0,
          r.avg_weight || 0, r.total_change || null
        )
      )
    );
  }

  console.log(`computeUniverseChanges: inserted ${allRows.length} rows for ${previousMonth} → ${currentMonth}`);
}

// ── Pipeline status ───────────────────────────────────────────────────────────

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
