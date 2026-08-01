// meridian-entities-seed
// Populates entity_master, fund_entity_link, entity_relationships, entity_enrichment_queue
// from existing etf_master and fund_holdings_monthly data.
// Cron: 0 3 * * * (daily at 03:00 UTC)
//
// READ/WRITE BUDGET (declared per three-point check, MA-AUG-002, July 28 2026):
// Reads/invocation: ~264 etf_master rows (Step 1) + two bulk entity_master
//   scans by type (fund, manager — Steps 1/2, fixed July 29 2026, see below)
//   + one fund_holdings_monthly scan filtered on snapshot_status, index-covered
//   via idx_holdings_status_series_month (Step 3) + one entity_master scan
//   filtered on lei IS NULL (Step 4, queue populate — entity_id join hits the PK).
// Writes/invocation: bounded by BATCH_SIZE=100 upserts via env.DB.batch() across
//   entity_master, fund_entity_link, entity_relationships, entity_enrichment_queue.
//   Guarded by checkWriteBudget() below — skips entirely if the shared daily
//   writes_today_ counter in holdings_pipeline_state is already >= 60,000.
//
// FIXED MA-AUG-002, July 29 2026 (fix set 2, root cause of the multi-day
// verification saga): confirmed via live wrangler tail that Step 3
// (seedIssuerEntities) was throwing "Too many API requests by single Worker
// invocation" — Cloudflare Workers Free plan caps env.DB.batch() calls (each
// one a distinct subrequest) at 50 per invocation. Steps 1+2's N+1
// per-ETF/per-issuer SELECT loops plus BATCH_SIZE=20 batching alone produced
// ~40+ batch() calls before Step 3 ever ran, leaving almost no headroom.
// Two changes made together: (a) Steps 1 and 2's individual per-row SELECT
// lookups replaced with bulk SELECT + in-memory Map, removing up to ~528
// round-trips; (b) BATCH_SIZE raised 20 -> 100 to cut the number of batch()
// calls needed for the same statement volume across all four steps. Not yet
// verified end-to-end against Step 3's actual distinct-issuer count — retest
// via wrangler tail before considering MA-AUG-002 closed.

const BATCH_SIZE = 100;

// Sovereign name variants found in live holdings data (Prompt 1j)
const SOVEREIGN_CANONICAL = new Map([
  ['UNITED STATES TREASURY', 'United States Treasury'],
  ['US TREASURY', 'United States Treasury'],
  ['U.S. TREASURY', 'United States Treasury'],
]);

const SOVEREIGN_PATTERNS = [
  /^UNITED STATES/,  /^US TREASURY/,   /^U\.S\. TREASURY/,
  /^TREASURY/,       /^BUNDESREPUBLIK/, /^JAPAN GOVERNMENT/,
  /^UNITED KINGDOM/, /^HM TREASURY/,   /^REPUBLIC OF/,
  /^KINGDOM OF/,     /^GOVERNMENT OF/,  /^FEDERAL REPUBLIC/,
  /^FRENCH REPUBLIC/,/^ITALIAN REPUBLIC/
];

// Cash/money-market funds that contain "Treasury" but are NOT sovereign issuers
const CASH_FUND_PATTERNS = [
  /BLACKROCK.*TREASURY/i,
  /DREYFUS.*GOVERNMENT/i,
  /GOLDMAN SACHS.*TREASURY/i,
  /STATE STREET.*TREASURY/i,
  /FIRST AMERICAN.*GOVERNMENT/i,
  /TREASURY.*FUND/i,
  /TREASURY.*TRUST/i,
  /TREASURY.*MONEY/i,
  /TREASURY.*OBLIGATIONS/i,
];

function isCashFund(name) {
  const upper = name.toUpperCase();
  return CASH_FUND_PATTERNS.some(p => p.test(upper));
}

// Exported (MA-AUG-001, 29 July 2026) so entities-figi.js can import the
// exact same normalization logic rather than re-implementing it — avoids a
// repeat of a fix landing in one file and not its sibling.
export function normalizeName(name) {
  return name
    .toUpperCase()
    .trim()
    // FAST-FOLLOW fix (1 August 2026): CORPORATION was missing from this list —
    // only the CORP abbreviation matched, so "Danaher Corporation" and
    // "Danaher Corp" normalized to different keys and split into duplicate
    // entity_master rows. Same risk exists for INCORPORATED/LIMITED (only
    // INC/LTD were covered); added defensively since they're the same class
    // of bug, not yet confirmed to have caused a duplicate in production.
    .replace(/\s+(INC\.?|INCORPORATED|CORP\.?|CORPORATION|LTD\.?|LIMITED|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBondDetail(name) {
  return name
    .replace(/\b\d+\.?\d*\s*%/g, '')          // coupon: 4.5%
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '') // date: 02/15/2036
    .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi, '') // 15 Mar 2027
    .replace(/\s+(NOTES?|BONDS?|MTN|DEBENTURES?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyType(name) {
  if (isCashFund(name)) return 'fund';
  const upper = name.toUpperCase();
  if (SOVEREIGN_PATTERNS.some(p => p.test(upper))) return 'government';
  return 'operating';
}

function canonicalizeSovereign(name) {
  const upper = name.toUpperCase();
  for (const [prefix, canonical] of SOVEREIGN_CANONICAL) {
    if (upper.startsWith(prefix)) return canonical;
  }
  return name;
}

async function checkWriteBudget(env) {
  // FIXED MA-AUG-002, July 28 2026: this key previously stripped dashes
  // (writes_today_20260728) while holdings-pipeline.js's counter keeps them
  // (writes_today_2026-07-28) — two different keys, so the "shared" daily
  // write budget was never actually shared. Now matches holdings exactly.
  const today = new Date().toISOString().slice(0, 10);
  const key = `writes_today_${today}`;
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`
  ).bind(key).first();
  const writesToday = parseInt(row?.value ?? '0', 10);
  if (writesToday >= 60000) {
    console.log(`[entities-seed] Write budget reached (${writesToday} today). Skipping.`);
    return false;
  }
  return true;
}

async function runInBatches(env, statements) {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE);
    await env.DB.batch(batch);
  }
}

// Step 1: Seed fund entities from etf_master
async function seedFundEntities(env) {
  const etfs = await env.DB.prepare(
    `SELECT ticker, name, series_id, issuer FROM etf_master`
  ).all();

  const upserts = etfs.results.map(etf =>
    env.DB.prepare(`
      INSERT INTO entity_master (name, normalized_name, type)
      VALUES (?, ?, 'fund')
      ON CONFLICT(normalized_name, type) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `).bind(etf.name, normalizeName(etf.name))
  );
  await runInBatches(env, upserts);
  console.log(`[entities-seed] Seeded ${etfs.results.length} fund entities`);

  // FIXED MA-AUG-002, July 29 2026 (fix set 2): replaced a per-ETF individual
  // SELECT (up to 264 round-trips) with one bulk SELECT + in-memory Map.
  // See file-header comment for why this mattered.
  const fundRows = await env.DB.prepare(
    `SELECT entity_id, normalized_name FROM entity_master WHERE type = 'fund'`
  ).all();
  const fundIdByName = new Map(fundRows.results.map(r => [r.normalized_name, r.entity_id]));

  // Populate fund_entity_link
  const linkStmts = [];
  for (const etf of etfs.results) {
    const entityId = fundIdByName.get(normalizeName(etf.name));
    if (entityId) {
      linkStmts.push(
        env.DB.prepare(`
          INSERT INTO fund_entity_link (etf_symbol, series_id, entity_id, source)
          VALUES (?, ?, ?, 'auto')
          ON CONFLICT(etf_symbol) DO UPDATE SET entity_id = excluded.entity_id
        `).bind(etf.ticker, etf.series_id ?? null, entityId)
      );
    }
  }
  await runInBatches(env, linkStmts);
  console.log(`[entities-seed] Linked ${linkStmts.length} ETFs to fund entities`);

  return etfs.results;
}

// Step 2: Seed manager entities and fund_manager relationships
async function seedManagerEntities(env, etfs) {
  const issuers = await env.DB.prepare(
    `SELECT DISTINCT issuer FROM etf_master WHERE issuer IS NOT NULL AND issuer != ''`
  ).all();

  const mgrUpserts = issuers.results.map(r =>
    env.DB.prepare(`
      INSERT INTO entity_master (name, normalized_name, type)
      VALUES (?, ?, 'manager')
      ON CONFLICT(normalized_name, type) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `).bind(r.issuer, normalizeName(r.issuer))
  );
  await runInBatches(env, mgrUpserts);
  console.log(`[entities-seed] Seeded ${issuers.results.length} manager entities`);

  // FIXED MA-AUG-002, July 29 2026 (fix set 2): same N+1 pattern as
  // seedFundEntities above, but worse — two individual SELECTs per ETF
  // (manager + fund lookups), up to ~528 round-trips. Replaced with two bulk
  // SELECTs (managers, funds) + in-memory maps.
  const managerRows = await env.DB.prepare(
    `SELECT entity_id, normalized_name FROM entity_master WHERE type = 'manager'`
  ).all();
  const managerIdByName = new Map(managerRows.results.map(r => [r.normalized_name, r.entity_id]));

  const fundRows = await env.DB.prepare(
    `SELECT entity_id, normalized_name FROM entity_master WHERE type = 'fund'`
  ).all();
  const fundIdByName = new Map(fundRows.results.map(r => [r.normalized_name, r.entity_id]));

  // Create fund_manager relationships
  const relStmts = [];
  for (const etf of etfs) {
    if (!etf.issuer) continue;
    const managerId = managerIdByName.get(normalizeName(etf.issuer));
    const fundId = fundIdByName.get(normalizeName(etf.name));
    if (managerId && fundId) {
      relStmts.push(
        env.DB.prepare(`
          INSERT INTO entity_relationships (parent_entity_id, child_entity_id, relationship_type, source)
          VALUES (?, ?, 'fund_manager', 'etf_universe')
          ON CONFLICT DO NOTHING
        `).bind(managerId, fundId)
      );
    }
  }
  await runInBatches(env, relStmts);
  console.log(`[entities-seed] Created ${relStmts.length} fund_manager relationships`);
}

// Step 3: Seed issuer entities from holdings
async function seedIssuerEntities(env) {
  const holdings = await env.DB.prepare(`
    SELECT DISTINCT security_name, asset_cat, issuer_country
    FROM fund_holdings_monthly
    WHERE snapshot_status = 'complete'
      AND security_name IS NOT NULL
      AND security_name != ''
      AND UPPER(TRIM(security_name)) != 'N/A'
      AND UPPER(TRIM(security_name)) != 'NA'
  `).all();

  const seen = new Set();
  const upserts = [];

  for (const row of holdings.results) {
    const stripped = stripBondDetail(row.security_name);
    if (!stripped) continue;

    const entityType = classifyType(stripped);
    let entityName = stripped;
    if (entityType === 'government') {
      entityName = canonicalizeSovereign(stripped);
    }

    const key = normalizeName(entityName) + '|' + entityType;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip if it's a fund type — those are already handled in Step 1
    if (entityType === 'fund') continue;

    upserts.push(
      env.DB.prepare(`
        INSERT INTO entity_master (name, normalized_name, type, country)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(normalized_name, type) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      `).bind(entityName, normalizeName(entityName), entityType, row.issuer_country ?? null)
    );
  }

  await runInBatches(env, upserts);
  console.log(`[entities-seed] Seeded ${upserts.length} issuer entities from holdings`);
}

// Step 4: Populate enrichment queue — single bulk INSERT to stay within CPU budget
async function populateEnrichmentQueue(env) {
  await env.DB.prepare(`
    INSERT INTO entity_enrichment_queue (entity_id, name, type_hint, lookup_method, isin_hint)
    SELECT
      em.entity_id,
      em.name,
      em.type,
      CASE WHEN em.type = 'fund' THEN NULL ELSE 'name_search' END,
      NULL
    FROM entity_master em
    WHERE em.lei IS NULL
      AND em.type != 'fund'
      AND NOT EXISTS (
        SELECT 1 FROM entity_enrichment_queue eq WHERE eq.entity_id = em.entity_id
      )
  `).run();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM entity_enrichment_queue`
  ).first();
  console.log(`[entities-seed] Enrichment queue total: ${countRow?.cnt ?? 0}`);
}

export default {
  async scheduled(event, env, ctx) {
    console.log('[entities-seed] Cron started');

    if (!(await checkWriteBudget(env))) return;

    const etfs = await seedFundEntities(env);
    await seedManagerEntities(env, etfs);
    await seedIssuerEntities(env);
    await populateEnrichmentQueue(env);

    console.log('[entities-seed] Cron complete');
  },

  // FIXED MA-AUG-002, July 29 2026: this used to check the write-budget
  // guard inside ctx.waitUntil and always respond ok:true regardless of
  // outcome, making it impossible to tell from the HTTP response whether a
  // run actually executed or silently skipped — caused three separate
  // ambiguous verification attempts. Now checks synchronously first,
  // matching the pattern already used in entities-enrich.js's fetch handler.
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    if (!(await checkWriteBudget(env))) {
      return new Response(JSON.stringify({ ok: false, message: 'Daily write budget reached' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    ctx.waitUntil((async () => {
      const etfs = await seedFundEntities(env);
      await seedManagerEntities(env, etfs);
      await seedIssuerEntities(env);
      await populateEnrichmentQueue(env);
    })());
    return new Response(JSON.stringify({ ok: true, message: 'Seed triggered' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
