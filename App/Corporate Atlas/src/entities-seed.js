// meridian-entities-seed
// Populates entity_master, fund_entity_link, entity_relationships, entity_enrichment_queue
// from existing etf_master and fund_holdings_monthly data.
// Cron: 0 4 * * 1 (weekly, Monday 04:00 UTC — MA-AUG-002 cadence decision,
//   1 August 2026. Deliberately one day after meridian-holdings' Sunday
//   04:00 UTC run so this Worker's issuer-entity step reads freshly updated
//   holdings data, and so the two large operations don't stack on the same
//   day against the shared account-wide write cap.)
//
// READ/WRITE BUDGET (declared per three-point check, MA-AUG-002, July 28 2026):
// Reads/invocation: ~264 etf_master rows (Step 1) + two bulk entity_master
//   scans by type (fund, manager — Steps 1/2, fixed July 29 2026, see below)
//   + one fund_holdings_monthly scan filtered on snapshot_status, index-covered
//   via idx_holdings_status_series_month (Step 3) + one entity_master scan
//   filtered on lei IS NULL (Step 4, queue populate — entity_id join hits the PK).
// Writes/invocation: bounded by BATCH_SIZE=100 upserts via env.DB.batch() across
//   entity_master, fund_entity_link, entity_relationships, entity_enrichment_queue.
//   A single verified invocation wrote ~61,400 rows (31,934 issuer upserts +
//   29,470 queue inserts) — this is one automatic run's whole footprint, not
//   a per-batch figure. Guarded by checkWriteBudget() below, tightened
//   1 August 2026 (MA-AUG-002 cadence decision): skips entirely unless the
//   shared daily writes_today_ counter in holdings_pipeline_state still has
//   at least 65,000 of headroom against the 100,000 daily cap — covers this
//   Worker's own observed worst case (~61,400) plus a safety margin, since
//   this runs unattended (no one watching the Cloudflare dashboard in real
//   time the way manual financialfact_reported batches have been sized).
//   FIXED 2 August 2026 (incident follow-up, see below): this used to be a
//   pre-flight check only. A real invocation on 2 August wrote ~97,594 rows
//   in one run — well past the 65,000-headroom pre-flight check's
//   assumption, because nothing tracked or re-checked writes DURING the
//   run. runInBatches() now increments the real shared counter after every
//   batch and stops issuing further statements (and further steps) if the
//   daily cap is hit mid-run. Also added: checkHold(), a hold_all_jobs kill
//   switch this Worker never had (entities-delta.js and entities-enrich.js
//   had one; this file didn't — a real gap, not a regression).
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
const DAILY_CAP = 100000; // account-wide D1 daily write cap (soft), shared across all Workers

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
//
// FIXED (MA-SEP-001, 16 August 2026): punctuation stripping used to run
// AFTER the suffix-strip regex. The suffix regex only matches a contiguous
// token ("NV", "SA", "BV", ...) with at most one trailing dot — it never
// matched a dotted abbreviation like "N.V." or "S.A." (the dot sits INSIDE
// the token, not just after it). Net effect: "CureVac NV" stripped its
// suffix and normalized to "CUREVAC", while "CureVac N.V." never matched the
// suffix regex at all, only had its dots removed afterward, and normalized
// to "CUREVAC NV" — two different normalized_name values for the same
// company, defeating the UNIQUE(normalized_name, type) constraint. Full-scope
// audit (MA-SEP-001) found this live-reproducible pattern behind ~718 of the
// duplicate entity_master rows cleaned up in that packet (Adyen, Spotify,
// Qiagen, Repsol, Iberdrola, and others besides the originally-known CureVac
// pair). Reordering so punctuation is stripped FIRST means "N.V." and "NV"
// both reduce to "NV" before the suffix regex ever runs, so both variants
// now collapse to the same normalized_name.
export function normalizeName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|LLC|PLC|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO|COMPANY|TRUST|ETF|FUND|FUNDS)\s*$/i, '')
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

// FIXED 2 August 2026 (MA-AUG-002 incident follow-up): this Worker never had
// a hold_all_jobs kill switch, unlike entities-delta.js and entities-enrich.js
// (see that file's own header comment, which explicitly notes entities-seed.js
// only had checkWriteBudget() — this was a real, pre-existing gap, not a
// regression). Added after the 2 August incident where entities-seed fired a
// day early and hold_all_jobs was set as a precaution but had nothing to
// actually gate — it would have been silently ineffective the moment UTC
// reset gave checkWriteBudget() fresh headroom again.
async function checkHold(env) {
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`
  ).first();
  return row?.value === 'true';
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
  // Tightened 1 August 2026 (MA-AUG-002 cadence decision): require at least
  // 65,000 of headroom, not just "under 60,000 used so far" — this Worker's
  // own single-invocation worst case is ~61,400 rows, and the old 60,000
  // threshold only guaranteed 40,000 of headroom, not enough to safely
  // absorb its own run. This runs unattended via cron, so the guard has to
  // hold without a human checking the dashboard mid-run.
  const REQUIRED_HEADROOM = 65000;
  const headroom = DAILY_CAP - writesToday;
  if (headroom < REQUIRED_HEADROOM) {
    console.log(`[entities-seed] Insufficient write headroom (${headroom} remaining, need ${REQUIRED_HEADROOM}; ${writesToday} used today). Skipping.`);
    return false;
  }
  return true;
}

// FIXED 2 August 2026 (mid-loop write checkpoint, incident follow-up): reads
// and updates the same shared writes_today_ counter holdings-pipeline.js
// uses, following that file's proven pattern — real D1-metered
// meta.rows_written per batch, not an estimated/logical row count. Returns
// the post-increment running total so runInBatches() can check it
// immediately without a second read.
async function incrementWriteCount(env, count) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `writes_today_${today}`;
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`
  ).bind(key).first();
  const current = parseInt(row?.value ?? '0', 10);
  const newTotal = current + count;
  await env.DB.prepare(`
    INSERT INTO holdings_pipeline_state (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).bind(key, String(newTotal)).run();
  return newTotal;
}

// FIXED 2 August 2026 (mid-loop write checkpoint, incident follow-up): this
// Worker previously had a pre-flight check (checkWriteBudget, above) but
// nothing tracking or checking writes DURING a run — the exact gap that let
// a single invocation write ~97,594 rows on 2 August (well past the 65,000
// headroom the pre-flight check had confirmed was available at the start).
// Now increments the real shared counter after every batch and stops
// issuing further statements if the running total hits DAILY_CAP mid-run.
// Returns { completed, written } — completed:false means a step was cut
// short; callers should stop chaining further steps this invocation. This
// is safe to do here (unlike holdings-pipeline.js, which needs an explicit
// resume offset) because every step in this file re-derives its full
// candidate list from source tables on each run and upserts idempotently
// (ON CONFLICT ... DO UPDATE) — a cut-short run is naturally completed by
// the next scheduled invocation, nothing needs to be resumed by position.
async function runInBatches(env, statements, label) {
  let written = 0;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE);
    const results = await env.DB.batch(batch);
    const realWritten = results.reduce((sum, r) => sum + (r?.meta?.rows_written || 0), 0);
    written += realWritten;
    const runningTotal = await incrementWriteCount(env, realWritten);
    if (runningTotal >= DAILY_CAP) {
      console.log(
        `[entities-seed] Daily write limit reached mid-run (${runningTotal}/${DAILY_CAP}) ` +
        `during ${label ?? 'batch'} at statement ${Math.min(i + BATCH_SIZE, statements.length)} of ` +
        `${statements.length}. Stopping remaining statements in this step and skipping any later steps.`
      );
      return { completed: false, written };
    }
  }
  return { completed: true, written };
}

// Step 1: Seed fund entities from etf_master
// Returns { completed, etfs } — completed:false short-circuits the caller
// (scheduled()/fetch()) so it doesn't chain into Steps 2-4 this invocation.
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
  let result = await runInBatches(env, upserts, 'Step 1 (fund entities)');
  console.log(`[entities-seed] Seeded ${etfs.results.length} fund entities`);
  if (!result.completed) return { completed: false, etfs: etfs.results };

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
  result = await runInBatches(env, linkStmts, 'Step 1 (fund_entity_link)');
  console.log(`[entities-seed] Linked ${linkStmts.length} ETFs to fund entities`);

  return { completed: result.completed, etfs: etfs.results };
}

// Step 2: Seed manager entities and fund_manager relationships
// Returns completed (boolean) — false short-circuits the caller.
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
  let result = await runInBatches(env, mgrUpserts, 'Step 2 (manager entities)');
  console.log(`[entities-seed] Seeded ${issuers.results.length} manager entities`);
  if (!result.completed) return false;

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
  result = await runInBatches(env, relStmts, 'Step 2 (fund_manager relationships)');
  console.log(`[entities-seed] Created ${relStmts.length} fund_manager relationships`);
  return result.completed;
}

// Step 3: Seed issuer entities from holdings — this is the Worker's largest
// step by write volume (31,934 issuer upserts in the 29 July verified run;
// the whole 97,594-row 2 August incident). Returns completed (boolean).
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

  const result = await runInBatches(env, upserts, 'Step 3 (issuer entities)');
  console.log(`[entities-seed] Seeded ${upserts.length} issuer entities from holdings`);
  return result.completed;
}

// Step 4: Populate enrichment queue — single bulk INSERT to stay within CPU budget.
// This is one atomic statement, not a batch loop, so there's nothing to stop
// mid-way through — but it still records its real write count into the
// shared counter (previously it wrote nothing to the counter at all, the
// same gap runInBatches() had) so the NEXT invocation's pre-flight check
// sees an accurate total. Skips entirely if budget is already exhausted
// from an earlier step this same invocation.
async function populateEnrichmentQueue(env, budgetAlreadyExhausted) {
  if (budgetAlreadyExhausted) {
    console.log('[entities-seed] Step 4 skipped — budget exhausted earlier this invocation.');
    return;
  }
  const insertResult = await env.DB.prepare(`
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
  await incrementWriteCount(env, insertResult?.meta?.rows_written || 0);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM entity_enrichment_queue`
  ).first();
  console.log(`[entities-seed] Enrichment queue total: ${countRow?.cnt ?? 0}`);
}

// Runs all four steps in sequence, stopping early if any step reports the
// mid-loop write checkpoint was hit (see runInBatches()). Shared by both
// scheduled() and fetch() so their behavior can't drift apart again.
async function runAllSteps(env) {
  const step1 = await seedFundEntities(env);
  if (!step1.completed) {
    console.log('[entities-seed] Stopped after Step 1 — daily write cap hit.');
    return;
  }
  const step2Completed = await seedManagerEntities(env, step1.etfs);
  if (!step2Completed) {
    console.log('[entities-seed] Stopped after Step 2 — daily write cap hit.');
    return;
  }
  const step3Completed = await seedIssuerEntities(env);
  if (!step3Completed) {
    console.log('[entities-seed] Stopped after Step 3 — daily write cap hit. Step 4 skipped.');
    await populateEnrichmentQueue(env, /* budgetAlreadyExhausted */ true);
    return;
  }
  await populateEnrichmentQueue(env, /* budgetAlreadyExhausted */ false);
}

export default {
  async scheduled(event, env, ctx) {
    console.log('[entities-seed] Cron started');

    // FIXED 2 August 2026 (incident follow-up): this Worker never checked
    // hold_all_jobs — see checkHold()'s comment above for why that mattered.
    if (await checkHold(env)) {
      console.log('[entities-seed] hold_all_jobs = true — exiting immediately');
      return;
    }
    if (!(await checkWriteBudget(env))) return;

    await runAllSteps(env);

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
    if (await checkHold(env)) {
      return new Response(JSON.stringify({ ok: false, message: 'hold_all_jobs is active' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!(await checkWriteBudget(env))) {
      return new Response(JSON.stringify({ ok: false, message: 'Daily write budget reached' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    ctx.waitUntil(runAllSteps(env));
    return new Response(JSON.stringify({ ok: true, message: 'Seed triggered' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
