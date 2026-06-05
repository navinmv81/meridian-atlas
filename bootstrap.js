const BATCH_SIZE = 15;               // series processed per cron invocation
const MIN_NET_ASSETS = 100_000_000;  // $100M threshold
const SEC_UA = "MeridianAtlas contact@meridianatlas.com";
const SLEEP_MS = 150;                // min delay between EDGAR requests

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function secFetch(url, retries = 1) {
  await sleep(SLEEP_MS);
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_UA, "Accept": "application/json" }
  });
  if (res.status === 429 && retries > 0) {
    await sleep(5000);
    return secFetch(url, retries - 1);
  }
  return res;
}

async function setState(db, key, value) {
  await db.prepare(
    `INSERT OR REPLACE INTO edgar_bootstrap_state (key, value, updated_at)
     VALUES (?, ?, datetime('now'))`
  ).bind(key, String(value)).run();
}

async function getState(db, key) {
  const row = await db.prepare(
    `SELECT value FROM edgar_bootstrap_state WHERE key = ?`
  ).bind(key).first();
  return row ? row.value : null;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBootstrap(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger') {
      ctx.waitUntil(runBootstrap(env));
      return new Response(JSON.stringify({ ok: true, message: 'Bootstrap triggered' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Bootstrap Worker', { status: 200 });
  }
};

// ── Core ──────────────────────────────────────────────────────────────────────

async function runBootstrap(env) {
  const db = env.DB;
  const status = await getState(db, 'status');

  if (status === 'complete') {
    await runWeeklySync(env);
    return;
  }

  await setState(db, 'status', 'running');
  await setState(db, 'last_run', new Date().toISOString());

  // STEP 1: Discover all series from company_tickers_mf.json
  let allSeries = [];
  try {
    allSeries = await discoverAllSeries(db);
  } catch (e) {
    console.error('Failed to discover series:', e.message);
    return;
  }

  const total = allSeries.length;
  await setState(db, 'total_ciks_discovered', total); // reuse key — now holds series count

  // STEP 2: Get current offset and slice next batch
  const offset = parseInt(await getState(db, 'cik_offset') || '0', 10);
  const batch = allSeries.slice(offset, offset + BATCH_SIZE);

  if (batch.length === 0) {
    await setState(db, 'status', 'complete');
    console.log('Bootstrap complete.');
    return;
  }

  console.log(`Processing series ${offset}–${offset + batch.length} of ${total}`);

  let etfsAdded = parseInt(await getState(db, 'etfs_added') || '0', 10);

  // Submissions cache: avoid re-fetching the same CIK's submissions within a batch
  const subCache = new Map();

  // STEP 3: Process each series entry in the batch
  for (const entry of batch) {
    try {
      const added = await processSeries(db, entry, subCache);
      etfsAdded += added;
    } catch (e) {
      console.error(`Error processing series ${entry.seriesId}:`, e.message);
      await db.prepare(
        `INSERT OR REPLACE INTO edgar_bootstrap_progress
         (series_id, cik, ticker, status, error_msg, processed_at)
         VALUES (?, ?, ?, 'error', ?, datetime('now'))`
      ).bind(entry.seriesId, entry.cik, entry.ticker || null, e.message.slice(0, 200)).run();
    }
  }

  // STEP 4: Advance offset
  const newOffset = offset + batch.length;
  await setState(db, 'cik_offset', newOffset);
  await setState(db, 'etfs_added', etfsAdded);

  if (newOffset >= total) {
    await setState(db, 'status', 'complete');
    console.log(`Bootstrap complete. Total ETFs added: ${etfsAdded}`);
  } else {
    console.log(`Batch done. Offset: ${newOffset}/${total}. ETFs added so far: ${etfsAdded}`);
  }
}

// ── Series Discovery ──────────────────────────────────────────────────────────

async function discoverAllSeries(db) {
  // Check D1 cache first — saves 1 subrequest on every invocation after the first
  const cached = await getState(db, 'series_list_cache');
  if (cached && cached.length > 10) {
    try {
      const parsed = JSON.parse(cached);
      console.log(`Using cached series list (${parsed.length} series)`);
      return parsed;
    } catch (e) { /* fall through to fresh fetch */ }
  }

  const url = 'https://www.sec.gov/files/company_tickers_mf.json';
  const res = await secFetch(url);
  if (!res.ok) throw new Error(`company_tickers_mf.json failed: ${res.status}`);

  const data = await res.json();
  const fields = data.fields; // ["cik","seriesId","classId","symbol"]
  const rows = data.data;     // [[2110,"S000009184","C000024954","LACAX"], ...]

  const cikIdx    = fields.indexOf('cik');
  const seriesIdx = fields.indexOf('seriesId');
  const symbolIdx = fields.indexOf('symbol');

  if (cikIdx === -1 || seriesIdx === -1) {
    throw new Error('Required fields missing in company_tickers_mf.json');
  }

  // Deduplicate by seriesId — one entry per series, first ticker wins
  const seriesMap = new Map();
  for (const row of rows) {
    const seriesId = row[seriesIdx];
    const cik      = String(row[cikIdx]).padStart(10, '0');
    const symbol   = symbolIdx >= 0 ? (row[symbolIdx] || null) : null;

    if (!seriesMap.has(seriesId)) {
      seriesMap.set(seriesId, { cik, seriesId, ticker: symbol });
    } else if (symbol && !seriesMap.get(seriesId).ticker) {
      seriesMap.get(seriesId).ticker = symbol;
    }
  }

  const result = [...seriesMap.values()];
  console.log(`Discovered ${result.length} unique series from company_tickers_mf.json`);

  // Cache in D1 for subsequent invocations
  await setState(db, 'series_list_cache', JSON.stringify(result));

  return result;
}

// ── Series Processing ─────────────────────────────────────────────────────────

async function processSeries(db, entry, subCache) {
  const { cik, seriesId, ticker: knownTicker } = entry;

  // Skip if already in etf_master
  const exists = await db.prepare(
    `SELECT ticker FROM etf_master WHERE series_id = ?`
  ).bind(seriesId).first();
  if (exists) return 0;

  // Skip if already processed in progress table
  const progress = await db.prepare(
    `SELECT status FROM edgar_bootstrap_progress WHERE series_id = ?`
  ).bind(seriesId).first();
  if (progress && progress.status === 'processed') return 0;

  // Fetch submissions for this CIK (use cache to avoid duplicate fetches within batch)
  let sub = subCache.get(cik);
  if (!sub) {
    const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
    if (!subRes.ok) throw new Error(`Submissions fetch failed: ${subRes.status}`);
    sub = await subRes.json();
    subCache.set(cik, sub);
  }

  // Find the most recent NPORT-P filing for this CIK
  const recent = sub?.filings?.recent;
  if (!recent) return 0;

  const forms        = recent.form || [];
  const accessions   = recent.accessionNumber || [];
  const filingDates  = recent.filingDate || [];

  let latestIdx  = -1;
  let latestDate = '';

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === 'NPORT-P' && filingDates[i] > latestDate) {
      latestDate = filingDates[i];
      latestIdx  = i;
    }
  }

  if (latestIdx === -1) return 0;

  const accession   = accessions[latestIdx];
  const accNoDashes = accession.replace(/-/g, '');
  const strippedCik = parseInt(cik, 10).toString();

  // Fetch primary_doc.xml
  await sleep(SLEEP_MS);
  const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${strippedCik}/${accNoDashes}/primary_doc.xml`;
  const xmlRes = await fetch(xmlUrl, { headers: { "User-Agent": SEC_UA } });

  if (!xmlRes.ok) return 0;

  const xml = await xmlRes.text();

  // Confirm this filing covers the target series
  if (!xml.includes(seriesId)) return 0;

  // Check isETF flag — only process actual ETFs
  const isEtfMatch = xml.match(/<isETF>(Y|N)<\/isETF>/i);
  const isEtf = isEtfMatch ? isEtfMatch[1].toUpperCase() === 'Y' : false;
  if (!isEtf) {
    await db.prepare(
      `INSERT OR REPLACE INTO edgar_bootstrap_progress
       (series_id, cik, ticker, status, processed_at)
       VALUES (?, ?, ?, 'skipped_not_etf', datetime('now'))`
    ).bind(seriesId, cik, knownTicker || null).run();
    return 0;
  }

  // Extract netAssets — apply $100M threshold
  const netAssetsMatch = xml.match(/<netAssets>([\d.]+)<\/netAssets>/);
  if (!netAssetsMatch) return 0;

  const netAssets = parseFloat(netAssetsMatch[1]);
  if (netAssets < MIN_NET_ASSETS) {
    await db.prepare(
      `INSERT OR REPLACE INTO edgar_bootstrap_progress
       (series_id, cik, ticker, status, net_assets, processed_at)
       VALUES (?, ?, ?, 'processed', ?, datetime('now'))`
    ).bind(seriesId, cik, knownTicker || null, netAssets).run();
    return 0;
  }

  // Resolve fund name from XML — look for <seriesName> near the seriesId
  let seriesName = '';
  const nameMatch = xml.match(/<seriesName>([^<]+)<\/seriesName>/);
  if (nameMatch) seriesName = nameMatch[1].trim();

  const issuerName    = sub?.name || 'Unknown';
  const resolvedTicker = knownTicker ? knownTicker.toUpperCase() : `NOTICKER_${seriesId}`;

  await db.prepare(`
    INSERT OR IGNORE INTO etf_master
      (ticker, name, issuer, cik, series_id, has_nport,
       net_assets, coverage_status, last_filing_date)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'deep', ?)
  `).bind(
    resolvedTicker,
    seriesName || 'Unknown ETF',
    issuerName,
    cik,
    seriesId,
    netAssets,
    latestDate
  ).run();

  await db.prepare(
    `INSERT OR REPLACE INTO edgar_bootstrap_progress
     (series_id, cik, ticker, status, net_assets, processed_at)
     VALUES (?, ?, ?, 'processed', ?, datetime('now'))`
  ).bind(seriesId, cik, resolvedTicker, netAssets).run();

  return 1;
}

// ── Weekly Sync ───────────────────────────────────────────────────────────────

async function runWeeklySync(env) {
  const db = env.DB;
  console.log('Running weekly sync...');
  await setState(db, 'last_run', new Date().toISOString());

  // 1. Resolve any NOTICKER_ placeholders using a fresh series discovery
  let allSeries = [];
  try {
    allSeries = await discoverAllSeries(db);
  } catch (e) {
    console.error('Weekly sync: series discovery failed:', e.message);
    return;
  }

  // Build seriesId → ticker map from the fresh data
  const freshTickerMap = new Map();
  for (const entry of allSeries) {
    if (entry.ticker) freshTickerMap.set(entry.seriesId, entry.ticker.toUpperCase());
  }

  const nullTickers = await db.prepare(
    `SELECT ticker, series_id FROM etf_master WHERE ticker LIKE 'NOTICKER_%' AND series_id IS NOT NULL`
  ).all();

  for (const row of (nullTickers.results || [])) {
    const resolved = freshTickerMap.get(row.series_id);
    if (resolved) {
      await db.prepare(`UPDATE etf_master SET ticker = ? WHERE ticker = ?`)
        .bind(resolved, row.ticker).run();
      console.log(`Resolved ticker: ${row.ticker} → ${resolved}`);
    }
  }

  // 2. Find series not yet in edgar_bootstrap_progress and process up to BATCH_SIZE
  const processed = await db.prepare(`SELECT series_id FROM edgar_bootstrap_progress`).all();
  const processedSet = new Set((processed.results || []).map(r => r.series_id));

  const newSeries = allSeries.filter(e => !processedSet.has(e.seriesId));
  console.log(`Weekly sync: ${newSeries.length} new series to process`);

  const subCache = new Map();
  let added = 0;

  for (const entry of newSeries.slice(0, BATCH_SIZE)) {
    try {
      added += await processSeries(db, entry, subCache);
    } catch (e) {
      console.error(`Weekly sync series error ${entry.seriesId}:`, e.message);
    }
  }

  console.log(`Weekly sync complete. New ETFs added: ${added}`);
}
