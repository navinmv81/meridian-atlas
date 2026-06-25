// meridian-entities-seed
// Populates entity_master, fund_entity_link, entity_relationships, entity_enrichment_queue
// from existing etf_master and fund_holdings_monthly data.
// Cron: 0 3 * * * (daily at 03:00 UTC)

const BATCH_SIZE = 20;

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

function normalizeName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
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
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

  // Populate fund_entity_link
  const linkStmts = [];
  for (const etf of etfs.results) {
    const row = await env.DB.prepare(
      `SELECT entity_id FROM entity_master WHERE normalized_name = ? AND type = 'fund'`
    ).bind(normalizeName(etf.name)).first();
    if (row) {
      linkStmts.push(
        env.DB.prepare(`
          INSERT INTO fund_entity_link (etf_symbol, series_id, entity_id, source)
          VALUES (?, ?, ?, 'auto')
          ON CONFLICT(etf_symbol) DO UPDATE SET entity_id = excluded.entity_id
        `).bind(etf.ticker, etf.series_id ?? null, row.entity_id)
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

  // Create fund_manager relationships
  const relStmts = [];
  for (const etf of etfs) {
    if (!etf.issuer) continue;
    const manager = await env.DB.prepare(
      `SELECT entity_id FROM entity_master WHERE normalized_name = ? AND type = 'manager'`
    ).bind(normalizeName(etf.issuer)).first();
    const fund = await env.DB.prepare(
      `SELECT entity_id FROM entity_master WHERE normalized_name = ? AND type = 'fund'`
    ).bind(normalizeName(etf.name)).first();
    if (manager && fund) {
      relStmts.push(
        env.DB.prepare(`
          INSERT INTO entity_relationships (parent_entity_id, child_entity_id, relationship_type, source)
          VALUES (?, ?, 'fund_manager', 'etf_universe')
          ON CONFLICT DO NOTHING
        `).bind(manager.entity_id, fund.entity_id)
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

  // Allow manual trigger via HTTP for testing
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    ctx.waitUntil((async () => {
      if (!(await checkWriteBudget(env))) return;
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
