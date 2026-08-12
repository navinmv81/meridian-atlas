#!/usr/bin/env node
// seed-financialfact.js
// Populates financialfact_reported from SEC EDGAR companyfacts API —
// 9 priority XBRL tags, 10-K/10-Q only, filtered to a 1-year lookback.
//
// Domain: Filings (owned by Equities Lead). Must not be written to by any
// ETF or Entities pipeline.
//
// BUDGET: financialfact_reported has 2 indexes (INTEGER PK + UNIQUE constraint).
// Every INSERT costs 3 Cloudflare write-ops (1 base row + 1 PK index + 1 UNIQUE index).
// Safe daily data rows = ~13,000 (40K writes ÷ 3, leaving headroom for ETF cron).
// Plan --limit to stay under 13,000 rows per day.
//
// Index creation (idx_financialfact_cik_tag) is deliberately deferred until
// after the bulk backfill completes — see
// ETF Refresh/migrations/sprint2-financialfact.sql.
//
// Usage:
//   node seed-financialfact.js --dry-run
//   node seed-financialfact.js --dry-run --limit=50
//   node seed-financialfact.js --limit=2000
//   node seed-financialfact.js --offset=2000 --limit=2000
//   node seed-financialfact.js --offset=2000 --limit=2000 --write-cap=40000
//   node seed-financialfact.js --phase1 --dry-run
//   node seed-financialfact.js --phase1
//
// --phase1: Sprint 2 scope. Caps the run at the first 500 issuers in
// priority order (9 hardcoded PRIORITY_CIKS, then entity_id ASC for the
// remaining 491). Overrides any manually-passed --limit.
//
// --write-cap=<n>: (added 6 Aug 2026) Mid-run safety checkpoint. Tracks REAL
// Cloudflare rows_written (from each batch's own response, not the logical
// row count) across the run and stops issuing further batches once the
// cumulative real total reaches <n>. Size this from the live d1-today
// analytics reading (real remaining headroom), the same manual check already
// done before every batch this week — this just makes the script enforce it
// instead of trusting the dry-run's 3x projection, which has run as high as
// 4.30x in practice as the table has grown.
//
// If a run stops early: do NOT advance --offset for the next invocation.
// Re-run the exact same --offset/--limit — already-written rows are skipped
// safely via INSERT OR IGNORE (idempotent on the cik/xbrl_tag/period_end/
// accession UNIQUE constraint), and the remaining rows for that same issuer
// range get written. Advancing --offset after an early stop would silently
// skip the unwritten rows.
//
// --auto: (added 6 Aug 2026) fully unattended mode for the scheduled daily
// backfill task. Ignores any manually-passed --offset/--limit/--write-cap.
// On each run:
//   1. Checks financialfact_backfill_complete in holdings_pipeline_state —
//      if 'true', exits immediately, no work, no writes.
//   2. Reads financialfact_backfill_offset from the same table (defaults to 0
//      on first run) and uses AUTO_BATCH_SIZE (default 135) as the limit.
//   3. Calls the live meridian-ops /api/ops/cf/d1-today route (needs
//      OPS_D1_TODAY_URL set in .env) for real remaining headroom today. If
//      headroom < --min-headroom (default 50000), skips the day entirely —
//      no SEC fetch, no writes, retries next scheduled day.
//   4. Sizes --write-cap dynamically = min(AUTO_WRITE_CAP_CEILING [default
//      60000], headroom - 5000 safety buffer) — never a fixed guess.
//   5. On success, persists the new offset. If the new offset reaches the
//      end of the issuer pool, sets financialfact_backfill_complete='true'
//      and prints a BACKFILL COMPLETE summary — this is the actual kill
//      switch: every future auto run checks this flag first and no-ops at
//      near-zero cost even if the schedule itself is never removed.
//
// Usage: node seed-financialfact.js --auto
// Optional overrides: --min-headroom=50000 --auto-limit=135 --auto-write-cap-ceiling=60000

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── D1 config (meridian-etf database — same as seed-managermaster.js) ────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

const SEC_UA = 'MeridianAtlas contact@meridianatlas.com';
const SEC_RATE_LIMIT_MS = 150;

const FORM_TYPES = new Set(['10-K', '10-Q']);
const LOOKBACK_DAYS = 365;

// ── Priority CIKs — always processed first, in this order ───────────────────
const PRIORITY_CIKS = [
  '0000789019', // Microsoft
  '0000320193', // Apple
  '0001045810', // NVIDIA
  '0001326801', // Meta Platforms
  '0001652044', // Alphabet
  '0000059478', // Eli Lilly
  '0001065280', // Netflix
  '0001403161', // Visa
  '0001141391', // Mastercard
];

// ── Priority XBRL tags with fallbacks ────────────────────────────────────────
// `unit` is an optional override — when absent, the unit key is derived from
// `ns` (dei → shares, us-gaap → USD). EarningsPerShareDiluted is reported
// under USD/shares, not USD, so it needs the explicit override below.
const TAGS = [
  { tag: 'Revenues', ns: 'us-gaap', fallback: 'RevenueFromContractWithCustomerExcludingAssessedTax' },
  { tag: 'OperatingIncomeLoss', ns: 'us-gaap', fallback: null },
  { tag: 'NetIncomeLoss', ns: 'us-gaap', fallback: null },
  { tag: 'CashAndCashEquivalentsAtCarryingValue', ns: 'us-gaap', fallback: null },
  { tag: 'LongTermDebtNoncurrent', ns: 'us-gaap', fallback: 'LongTermDebt' },
  { tag: 'NetCashProvidedByUsedInOperatingActivities', ns: 'us-gaap', fallback: null },
  { tag: 'EarningsPerShareDiluted', ns: 'us-gaap', fallback: null, unit: 'USD/shares' },
  { tag: 'EntityCommonStockSharesOutstanding', ns: 'dei', fallback: null },
  { tag: 'StockholdersEquity', ns: 'us-gaap', fallback: null },
];

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const DRY_RUN = !!args['dry-run'];
const PHASE1  = !!args['phase1'];
const PHASE1_TOTAL = 500;
const PHASE1_NON_PRIORITY_LIMIT = PHASE1_TOTAL - PRIORITY_CIKS.length; // 491

if (PHASE1 && args.limit) {
  console.warn(`  NOTE: --phase1 overrides manually-passed --limit=${args.limit} (Phase 1 is fixed at ${PHASE1_TOTAL} issuers total)`);
}
let LIMIT  = PHASE1 ? PHASE1_NON_PRIORITY_LIMIT : (args.limit ? parseInt(args.limit, 10) : null);
let OFFSET = args.offset ? parseInt(args.offset, 10) : 0;
let WRITE_CAP = args['write-cap'] ? parseInt(args['write-cap'], 10) : null;

// ── Auto mode (added 6 Aug 2026) ─────────────────────────────────────────────
// --auto: fully unattended mode for the scheduled backfill task. Overrides
// --offset/--limit/--write-cap with values derived from persisted D1 state and
// a live headroom check — see fetchLiveHeadroom() and the top of main().
// Do NOT pass --offset/--limit/--write-cap manually alongside --auto; they'll
// be ignored (auto mode always computes its own).
const AUTO = !!args['auto'];
const MIN_HEADROOM = args['min-headroom'] ? parseInt(args['min-headroom'], 10) : 50000;
const AUTO_BATCH_SIZE = args['auto-limit'] ? parseInt(args['auto-limit'], 10) : 135;
const AUTO_WRITE_CAP_CEILING = args['auto-write-cap-ceiling'] ? parseInt(args['auto-write-cap-ceiling'], 10) : 60000;
const AUTO_SAFETY_BUFFER = 5000;
// Non-secret routing URL for the already-deployed meridian-ops Worker's live
// D1 analytics route — reused here instead of duplicating the Cloudflare
// GraphQL Analytics call (which needs a separate CF_ANALYTICS_TOKEN this
// script doesn't have). Set in 13F Seed/.env — not sensitive, just a URL.
const OPS_D1_TODAY_URL = process.env.OPS_D1_TODAY_URL;

if (!DRY_RUN && !AUTO && WRITE_CAP === null) {
  console.warn(
    '  NOTE: no --write-cap set — this run has no mid-run stop and will write ' +
    'every collected row regardless of actual Cloudflare cost. Recommended: ' +
    'pass --write-cap sized from the live d1-today analytics reading.'
  );
}

if (AUTO && (args.offset || args.limit || args['write-cap'])) {
  console.warn(
    '  NOTE: --auto is set — manually-passed --offset/--limit/--write-cap are ' +
    'ignored. Auto mode always computes these from persisted state + a live ' +
    'headroom check.'
  );
}

if (!DRY_RUN && !TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function escNum(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'NULL';
  return String(v);
}

function padCik(cik) {
  if (!cik) return null;
  return String(cik).trim().replace(/^0+/, '').padStart(10, '0');
}

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);
const CUTOFF_STR = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD

let _lastSecFetchMs = 0;
async function secFetch(url) {
  const now = Date.now();
  const elapsed = now - _lastSecFetchMs;
  if (elapsed < SEC_RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, SEC_RATE_LIMIT_MS - elapsed));
  }
  _lastSecFetchMs = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': SEC_UA,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

// Wraps a network-level fetch() with retry + backoff for transient failures
// (DNS blips, connection resets — the "fetch failed" class of error, not HTTP
// error responses, which are handled separately by each caller). Added 7 Aug
// 2026 after a scheduled --auto run lost its entire day's slot to a single
// transient network failure on the very first D1 read, before any real work.
async function fetchWithRetry(url, options, { retries = 3, delayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`  WARN: fetch failed (attempt ${attempt}/${retries}) — ${err.message}, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2;
      }
    }
  }
  throw lastErr;
}

// ── D1 ────────────────────────────────────────────────────────────────────────
async function d1Raw(sql) {
  const res = await fetchWithRetry(`${API_BASE}/raw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL preview: ${sql.slice(0, 300)}`);
  }
  return json;
}

// ── Auto-mode persisted state ────────────────────────────────────────────────
// Reuses the existing shared holdings_pipeline_state table (same table
// hold_all_jobs and the Workers' writes_today_* counters live in) — new keys
// only, no schema change, no risk of colliding with anything else that reads
// this table.
//
// KNOWN LIMITATION (documented 8 Aug 2026, MA-AUG-004 fast-follow): this
// script's real D1 writes are NOT reflected in any Worker's writes_today_*
// counter — those are only incremented by Workers that call their own
// incrementWriteCount() (entities-seed.js, entities-enrich.js,
// entities-figi.js, holdings-pipeline.js). This script writes via the raw D1
// REST API directly and never touches that counter, so a Worker's own
// checkWriteBudget() will under-report real account-wide usage on any day
// this script has also run. This is why --auto mode sizes itself off the
// live d1-today analytics reading (fetchLiveHeadroom(), below) rather than
// any Worker-side counter — that endpoint is account-wide and doesn't have
// this blind spot. Accepted as-is rather than building a unified cross-path
// counter; not worth the added complexity/risk for a soft daily cap.
async function getState(key) {
  const rows = await d1Select(`SELECT value FROM holdings_pipeline_state WHERE key = ${esc(key)}`);
  return rows.length > 0 ? rows[0].value : null;
}

async function setState(key, value) {
  await d1Raw(
    `INSERT INTO holdings_pipeline_state (key, value) VALUES (${esc(key)}, ${esc(String(value))}) ` +
    `ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
}

// ── Live headroom check (auto mode only) ─────────────────────────────────────
// Calls the already-deployed meridian-ops Worker's /api/ops/cf/d1-today route
// (the same one checked manually all week) instead of re-implementing the
// Cloudflare GraphQL Analytics call here, which would need a separate
// CF_ANALYTICS_TOKEN this script doesn't have.
async function fetchLiveHeadroom() {
  if (!OPS_D1_TODAY_URL) {
    throw new Error('OPS_D1_TODAY_URL is not set in .env — required for --auto mode.');
  }
  const res = await fetchWithRetry(OPS_D1_TODAY_URL, {});
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`d1-today check failed: ${JSON.stringify(json)}`);
  }
  return {
    rowsWritten: json.rowsWritten,
    dailyCap: json.daily_cap,
    headroom: json.daily_cap - json.rowsWritten,
    pctOfCap: json.pct_of_cap,
  };
}

async function d1Select(sql) {
  const json = await d1Raw(sql);
  const { columns, rows } = json.result[0].results;
  return rows.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// Sums real Cloudflare rows_written across every statement result in a
// batch's response — this is the actual metered cost, not the logical
// row count (which historically undercounts by up to ~4.3x on this table
// due to index-maintenance overhead that scales with table growth).
function sumRowsWritten(json) {
  if (!Array.isArray(json.result)) return 0;
  return json.result.reduce((sum, r) => sum + (r?.meta?.rows_written || 0), 0);
}

async function runBatches(stmts, label) {
  if (stmts.length === 0) {
    console.log(`  [${label}] nothing to write`);
    return { completed: true, realRowsWritten: 0, logicalRowsDone: 0, logicalRowsTotal: 0 };
  }
  let done = 0;
  let realRowsWritten = 0;
  const t0 = Date.now();

  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    if (WRITE_CAP !== null && realRowsWritten >= WRITE_CAP) {
      const remaining = stmts.length - done;
      console.warn(
        `\n  [${label}] STOPPING — write cap of ${WRITE_CAP} real rows reached ` +
        `(actual rows_written so far this run: ${realRowsWritten}).\n` +
        `  ${done}/${stmts.length} logical rows written, ${remaining} not yet written.\n` +
        `  Do NOT advance --offset for the next run — re-run this exact ` +
        `--offset/--limit; already-written rows are skipped via INSERT OR IGNORE.`
      );
      return {
        completed: false,
        realRowsWritten,
        logicalRowsDone: done,
        logicalRowsTotal: stmts.length,
      };
    }

    const chunk = stmts.slice(i, i + BATCH_SIZE);
    const json = await d1Raw(chunk.join(';\n'));
    realRowsWritten += sumRowsWritten(json);
    done += chunk.length;

    if (done % 500 === 0 || done === stmts.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  [${label}] ${done}/${stmts.length} logical rows  ` +
        `(real rows_written so far: ${realRowsWritten})  (${elapsed}s elapsed)`
      );
    }
  }

  console.log(
    `  [${label}] done — ${stmts.length} logical rows, ${realRowsWritten} real ` +
    `rows_written, in ${((Date.now() - t0) / 1000).toFixed(1)}s`
  );
  return {
    completed: true,
    realRowsWritten,
    logicalRowsDone: stmts.length,
    logicalRowsTotal: stmts.length,
  };
}

// ── EDGAR ─────────────────────────────────────────────────────────────────────
// Pulls qualifying facts for one tag from a companyfacts.json payload.
// us-gaap tags read the USD unit array; dei/EntityCommonStockSharesOutstanding
// reads the shares unit array. unitOverride wins when a tag reports under a
// different unit (e.g. EarningsPerShareDiluted → USD/shares).
function factsForTag(companyFactsJson, ns, tagName, unitOverride) {
  const unitKey = unitOverride || (ns === 'dei' ? 'shares' : 'USD');
  const units = companyFactsJson?.facts?.[ns]?.[tagName]?.units?.[unitKey];
  if (!Array.isArray(units)) return [];

  return units.filter(f =>
    FORM_TYPES.has(f.form) &&
    f.filed && f.filed >= CUTOFF_STR &&
    f.val !== null && f.val !== undefined
  ).map(f => ({
    value: f.val,
    unit: unitKey,
    periodEnd: f.end || null,
    filedDate: f.filed,
    formType: f.form,
    accession: f.accn,
  }));
}

// Resolves one tag definition (with fallback) against a companyfacts payload.
// The output rows always carry the primary tag's name, even when the data
// came from the fallback tag.
function extractTagRows(companyFactsJson, tagDef) {
  let facts = factsForTag(companyFactsJson, tagDef.ns, tagDef.tag, tagDef.unit);
  if (facts.length === 0 && tagDef.fallback) {
    facts = factsForTag(companyFactsJson, tagDef.ns, tagDef.fallback, tagDef.unit);
  }
  return facts.map(f => ({ ...f, xbrlTag: tagDef.tag }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Auto mode: check persisted completion/offset state and live headroom
  // BEFORE doing any other work (table check, entity fetch, SEC calls) — no
  // point spending time on any of that if we're going to skip or stop anyway.
  if (AUTO && !DRY_RUN) {
    console.log('\n=== AUTO MODE: checking persisted state before doing any work ===');

    const completeFlag = await getState('financialfact_backfill_complete');
    if (completeFlag === 'true') {
      console.log(
        'BACKFILL COMPLETE (already marked complete in a prior run) — ' +
        'nothing to do. Exiting without any writes.'
      );
      return;
    }

    const storedOffset = await getState('financialfact_backfill_offset');
    OFFSET = storedOffset !== null ? parseInt(storedOffset, 10) : OFFSET;
    LIMIT = AUTO_BATCH_SIZE;
    console.log(`  Resuming from persisted offset=${OFFSET}, limit=${LIMIT}`);

    let headroom;
    try {
      headroom = await fetchLiveHeadroom();
    } catch (err) {
      console.error(`  ERROR checking live headroom: ${err.message}`);
      console.error('  SKIPPING today — cannot safely size a batch without a live reading. Will retry next scheduled day.');
      return;
    }

    console.log(
      `  Live headroom check: ${headroom.rowsWritten}/${headroom.dailyCap} used ` +
      `(${headroom.pctOfCap}%), ${headroom.headroom} headroom remaining`
    );

    if (headroom.headroom < MIN_HEADROOM) {
      console.log(
        `  SKIPPING today — headroom (${headroom.headroom}) is below the minimum ` +
        `safe threshold (${MIN_HEADROOM}). No writes attempted. Will retry next scheduled day.`
      );
      return;
    }

    // Only recorded once we're actually proceeding — a run that skips
    // (thin headroom, etc.) should be a true no-op, not even a 1-row write.
    const startedAt = await getState('financialfact_backfill_started_at');
    if (startedAt === null) {
      await setState('financialfact_backfill_started_at', new Date().toISOString());
      console.log('  First real auto run — recorded backfill start timestamp.');
    }

    WRITE_CAP = Math.min(AUTO_WRITE_CAP_CEILING, headroom.headroom - AUTO_SAFETY_BUFFER);
    console.log(`  Headroom sufficient — proceeding with write-cap=${WRITE_CAP}`);
  }

  console.log(
    `\n=== seed-financialfact  dry-run=${DRY_RUN}  auto=${AUTO}  limit=${LIMIT ?? 'none'}  ` +
    `offset=${OFFSET}  write-cap=${WRITE_CAP ?? 'none'}  cutoff=${CUTOFF_STR} ===\n`
  );

  if (PHASE1) {
    console.log(
      `*** PHASE 1 OF MULTI-PHASE BACKFILL *** target=${PHASE1_TOTAL} issuers ` +
      `(${PRIORITY_CIKS.length} priority + ${PHASE1_NON_PRIORITY_LIMIT} by entity_id ASC). ` +
      `Remaining ~2,682 issuers are out of scope for Sprint 2 — later phases will ` +
      `pick up via --offset.\n`
    );
  }

  // 1. Ensure table exists (idempotent — safe to re-run on existing DB)
  if (!DRY_RUN) {
    console.log('Step 1: Ensuring table exists...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS financialfact_reported (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id        INTEGER,
        cik              TEXT NOT NULL,
        xbrl_tag         TEXT NOT NULL,
        value            REAL,
        unit             TEXT,
        period_end       TEXT,
        filed_date       TEXT,
        form_type        TEXT,
        accession_number TEXT,
        UNIQUE(cik, xbrl_tag, period_end, accession_number)
      )
    `);
    console.log('  Table ready. (Index creation deferred — run separately after backfill.)');
  }

  // 2. Fetch entity list, build cik → entity_id map
  console.log('\nStep 2: Fetching in-scope issuers from entity_master...');
  const allTargets = await d1Select(
    `SELECT entity_id, cik FROM entity_master WHERE cik IS NOT NULL ORDER BY entity_id`
  );
  console.log(`  Issuers with cik: ${allTargets.length}`);

  const entityIdByCik = new Map();
  for (const t of allTargets) {
    entityIdByCik.set(padCik(t.cik), t.entity_id);
  }

  // 3. Build ordered target list: priority CIKs first, then remaining by
  //    entity_id ASC, skipping any cik already covered by the priority list.
  const prioritySet = new Set(PRIORITY_CIKS);
  const priorityTargets = PRIORITY_CIKS.map(cik => ({ cik, entityId: entityIdByCik.get(cik) ?? null }));

  const remainingAll = allTargets
    .filter(t => !prioritySet.has(padCik(t.cik)))
    .map(t => ({ cik: padCik(t.cik), entityId: t.entity_id }));

  const remainingSliced = remainingAll.slice(OFFSET, LIMIT ? OFFSET + LIMIT : undefined);

  const targets = [...priorityTargets, ...remainingSliced];
  console.log(`  Priority issuers: ${priorityTargets.length}`);
  console.log(`  Remaining pool:   ${remainingAll.length}  (offset=${OFFSET}, this run=${remainingSliced.length})`);
  console.log(`  Total this run:   ${targets.length}`);

  // 4. Walk issuers sequentially — one failure must not kill the run
  console.log('\nStep 3: Fetching SEC companyfacts...');
  const collected = []; // { cik, entityId, xbrlTag, value, unit, periodEnd, filedDate, formType, accession }
  const tagCounts = Object.fromEntries(TAGS.map(t => [t.tag, 0]));
  let failedIssuers = 0;
  const t0 = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const { cik, entityId } = targets[i];

    try {
      const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
      if (!res.ok) {
        console.warn(`  WARN: cik=${cik} → HTTP ${res.status}, skipping`);
        failedIssuers++;
        continue;
      }
      const companyFactsJson = await res.json();

      for (const tagDef of TAGS) {
        const rows = extractTagRows(companyFactsJson, tagDef);
        for (const r of rows) {
          collected.push({
            cik,
            entityId: entityId ?? entityIdByCik.get(cik) ?? null,
            xbrlTag: r.xbrlTag,
            value: r.value,
            unit: r.unit,
            periodEnd: r.periodEnd,
            filedDate: r.filedDate,
            formType: r.formType,
            accession: r.accession,
          });
          tagCounts[r.xbrlTag]++;
        }
      }
    } catch (err) {
      console.warn(`  WARN: cik=${cik} → ${err.message}, skipping`);
      failedIssuers++;
    }

    const processed = i + 1;
    if (processed % 50 === 0 || processed === targets.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  [${new Date().toISOString()}] processed=${processed}/${targets.length}  ` +
        `rows_collected=${collected.length}  errors=${failedIssuers}  (${elapsed}s elapsed)`
      );
    }
  }

  const elapsedTotal = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  Fetch complete in ${elapsedTotal}s`);
  console.log(`  Issuers processed: ${targets.length}`);
  console.log(`  Issuers failed:    ${failedIssuers}`);
  console.log(`  Total fact rows:   ${collected.length}`);
  console.log('  By tag:');
  for (const t of TAGS) {
    console.log(`    ${t.tag}: ${tagCounts[t.tag]}`);
  }

  // 5. Dry-run exit — report counts and projected write cost, zero D1 writes
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    const projectedWrites = collected.length * 3; // base row + PK index + UNIQUE index
    console.log(`  Projected Cloudflare writes (×3 index multiplier): ${projectedWrites}`);
    console.log(`  Safe daily budget (rows): ~13,000`);
    if (collected.length > 13000) {
      console.log(`  >>> Over safe daily row budget by ${collected.length - 13000} rows. Split across days with --offset/--limit.`);
    } else {
      console.log(`  Within safe daily row budget.`);
    }
    return;
  }

  // 6. Write — INSERT OR IGNORE, idempotent
  console.log('\nStep 4: Writing financialfact_reported...');
  const stmts = collected.map(f =>
    `INSERT OR IGNORE INTO financialfact_reported ` +
    `(entity_id, cik, xbrl_tag, value, unit, period_end, filed_date, form_type, accession_number) ` +
    `VALUES (${escNum(f.entityId)}, ${esc(f.cik)}, ${esc(f.xbrlTag)}, ${escNum(f.value)}, ${esc(f.unit)}, ` +
    `${esc(f.periodEnd)}, ${esc(f.filedDate)}, ${esc(f.formType)}, ${esc(f.accession)})`
  );
  const result = await runBatches(stmts, 'INSERT financialfact_reported');

  if (!result.completed) {
    console.log('\n=== seed-financialfact STOPPED EARLY (write cap reached) ===');
    console.log(`  Logical rows written this run: ${result.logicalRowsDone}/${result.logicalRowsTotal}`);
    console.log(`  Real Cloudflare rows_written this run: ${result.realRowsWritten}`);
    console.log(`  Resume: re-run with the SAME --offset=${OFFSET} --limit=${LIMIT ?? 'none'} `);
    console.log('  (do not advance --offset — already-written rows are skipped via INSERT OR IGNORE)');

    if (AUTO) {
      await bumpAutoCumulativeCounters(result);
      console.log('  [AUTO] Offset NOT advanced — next scheduled run retries this same offset.');
    }
    return;
  }

  console.log('\n=== seed-financialfact complete ===');
  console.log(`  Logical rows written this run: ${result.logicalRowsDone}`);
  console.log(`  Real Cloudflare rows_written this run: ${result.realRowsWritten}`);
  if (result.logicalRowsDone > 0) {
    console.log(`  Real multiplier this run: ${(result.realRowsWritten / result.logicalRowsDone).toFixed(2)}x`);
  }
  console.log('Reminder: index creation is deferred. Once all offset batches are');
  console.log('done and writes_today is confirmed healthy, run separately:');
  console.log('  CREATE INDEX IF NOT EXISTS idx_financialfact_cik_tag');
  console.log('    ON financialfact_reported(cik, xbrl_tag);');

  if (AUTO) {
    await bumpAutoCumulativeCounters(result);
    const newOffset = OFFSET + remainingSliced.length;

    if (newOffset >= remainingAll.length) {
      await setState('financialfact_backfill_complete', 'true');
      const startedAtStr = await getState('financialfact_backfill_started_at');
      const cumLogical = await getState('financialfact_backfill_cumulative_logical_rows');
      const cumReal = await getState('financialfact_backfill_cumulative_real_writes');
      const days = startedAtStr
        ? Math.max(1, Math.ceil((Date.now() - new Date(startedAtStr).getTime()) / 86400000))
        : null;
      console.log('\n=== BACKFILL COMPLETE ===');
      console.log(`  Total non-priority issuers processed: ${newOffset} of ${remainingAll.length}`);
      console.log(`  Cumulative logical fact rows written (auto mode only): ${cumLogical ?? 'unknown'}`);
      console.log(`  Cumulative real Cloudflare writes (auto mode only): ${cumReal ?? 'unknown'}`);
      if (days !== null) console.log(`  Elapsed since first auto run: ~${days} day(s)`);
      console.log('  financialfact_backfill_complete flag set — all future auto runs will exit immediately at no cost.');
      console.log('  The scheduled task can now be safely deleted.');
    } else {
      await setState('financialfact_backfill_offset', newOffset);
      console.log(`  [AUTO] Offset advanced to ${newOffset} (${remainingAll.length - newOffset} issuers remaining) for next scheduled run.`);
    }
  }
}

// Tracks cumulative totals across every auto run (success or early-stop) —
// used only for the final BACKFILL COMPLETE report, not for any safety logic.
async function bumpAutoCumulativeCounters(result) {
  const prevLogical = parseInt((await getState('financialfact_backfill_cumulative_logical_rows')) || '0', 10);
  const prevReal = parseInt((await getState('financialfact_backfill_cumulative_real_writes')) || '0', 10);
  await setState('financialfact_backfill_cumulative_logical_rows', prevLogical + result.logicalRowsDone);
  await setState('financialfact_backfill_cumulative_real_writes', prevReal + result.realRowsWritten);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
