#!/usr/bin/env node
// seed-managerpositions.js
// Populates managerissuerpositionquarterly for ONE report_period at a time,
// from data already in D1 (holding13f_normalized, filing13f, instrument_master,
// instrument_entity_map). No external HTTP calls, no local files read/written
// besides the migration DDL. Node.js + D1 REST API (/raw endpoint).
//
// BUDGET: managerissuerpositionquarterly has 3 indexes (PK rowid + UNIQUE + 2 explicit).
// Each INSERT OR REPLACE costs 4 Cloudflare write-ops.
// Per quarter: ~60,000 rows × 4 = ~240,000 writes — too much for one day alongside
// the ETF holdings cron's own share of the daily write budget. Use --offset/--limit
// to split one period's writes across multiple days, e.g. --limit=25000 (~100,000
// writes/day). Run one --period (and one offset chunk) at a time. Check dashboard
// before each run.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const periodArg = args.find(a => a.startsWith('--period='));
if (!periodArg) {
  console.error('Error: --period=YYYY-MM-DD is required.');
  console.error('Usage: node seed-managerpositions.js --period=2025-12-31 [--dry-run]');
  process.exit(1);
}
const PERIOD = periodArg.split('=')[1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(PERIOD)) {
  console.error(`Error: --period must be YYYY-MM-DD, got "${PERIOD}"`);
  process.exit(1);
}

// --offset/--limit split one period's writes across multiple days. Optional —
// omit both to write the whole period in one statement (original behavior).
const offsetArg = args.find(a => a.startsWith('--offset='));
const limitArg  = args.find(a => a.startsWith('--limit='));
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;
const LIMIT  = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
if (offsetArg && !Number.isInteger(OFFSET)) {
  console.error(`Error: --offset must be an integer, got "${offsetArg}"`);
  process.exit(1);
}
if (limitArg && (!Number.isInteger(LIMIT) || LIMIT <= 0)) {
  console.error(`Error: --limit must be a positive integer, got "${limitArg}"`);
  process.exit(1);
}
const PAGINATED = LIMIT !== null;

// ── .env loader (no dotenv dependency — this project runs scripts with plain node) ──

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

// ── wrangler.toml → ACCOUNT_ID / DATABASE_ID ─────────────────────────────────

function readWranglerToml() {
  const tomlPath = path.join(__dirname, 'wrangler.toml');
  const text = fs.readFileSync(tomlPath, 'utf8');
  const accountMatch = text.match(/^account_id\s*=\s*"([^"]+)"/m);
  const dbIdMatch = text.match(/database_id\s*=\s*"([^"]+)"/m);
  if (!accountMatch || !dbIdMatch) {
    throw new Error(`Could not find account_id / database_id in ${tomlPath}`);
  }
  return { accountId: accountMatch[1], databaseId: dbIdMatch[1] };
}

const { accountId: ACCOUNT_ID, databaseId: DATABASE_ID } = readWranglerToml();

const CF_API_TOKEN = process.env.CF_API_TOKEN;
if (!CF_API_TOKEN) {
  console.error('Error: CF_API_TOKEN not set (checked process.env and ETF Refresh/.env).');
  console.error('Run: export CF_API_TOKEN=$(wrangler whoami --json | ...)');
  console.error('Or obtain a fresh token via: wrangler login');
  process.exit(1);
}

const D1_RAW_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/raw`;

// ── D1 REST /raw helper ───────────────────────────────────────────────────────

// /raw returns {columns, rows} (rows as arrays) instead of /query's array-of-objects —
// cheaper for D1 to serialize on the big statements this script runs.
async function d1raw(sql, params = []) {
  const res = await fetch(D1_RAW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  }
  const result = json.result?.[0];
  const columns = result?.results?.columns || [];
  const rows = result?.results?.rows || [];
  const meta = result?.meta || {};
  return {
    meta,
    rows: rows.map(r => Object.fromEntries(columns.map((c, i) => [c, r[i]])))
  };
}

// ── DDL (read from the migration file — single source of truth) ────────────

function readMigrationStatements() {
  const ddlPath = path.join(__dirname, 'migrations', 'sprint3-managerissuerpositionquarterly.sql');
  const raw = fs.readFileSync(ddlPath, 'utf8');
  return raw
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function ensureTableExists() {
  const statements = readMigrationStatements();
  console.log(`Applying DDL from migrations/sprint3-managerissuerpositionquarterly.sql (${statements.length} statements)...`);
  for (const stmt of statements) {
    await d1raw(stmt);
  }
  console.log('Table + indexes confirmed (CREATE TABLE/INDEX IF NOT EXISTS — no-op if already present).\n');
}

// ── Main population SQL ───────────────────────────────────────────────────────
// Amendment resolution (winning_filing) and entity_id resolution (instrument_master +
// instrument_entity_map) are pre-filtered to report_period IN (current, prior) before
// the LAG window function runs. LAG only ever needs one prior row per
// (cik, cusip, put_call) partition, so scanning history further back than the prior
// quarter is wasted work. This cuts the holding13f_normalized scan from ~249,511 rows
// (full history) to ~120,000 rows (2 quarters).
//
// REQUIRES an index on holding13f_normalized(report_period) and filing13f(report_period)
// — see migrations/sprint3-holding13f-report-period-index.sql. Without it, D1 still
// visits every row to evaluate `WHERE report_period IN (?, ?)` and this restructuring
// buys nothing; the index is what lets SQLite seek straight to the matching rows.
//
// prior_period (resolved below, before this SQL runs) is MAX(report_period) < current
// across the WHOLE table, not per (cik, cusip, put_call) partition — this assumes 13F
// report_period values are the shared SEC quarter-end dates (true for this dataset),
// so "prior quarter" is the same calendar date for every filer. Behavior change versus
// the old full-history LAG: if a manager sold a position, skipped a quarter, then
// reacquired it, the old query would LAG across the gap to the last quarter it was
// actually held; this version sees no row in the gap quarter and reports
// prev_market_value = NULL for the reacquisition quarter instead of the pre-gap value.
// This matches the table's documented "QoQ" (quarter-over-quarter) semantics
// (migrations/sprint3-managerissuerpositionquarterly.sql header) rather than "value
// last ever held" — flagging in case that's not the intended behavior.
//
// Pagination applies to the OUTPUT of the window function, not the input — LIMIT/
// OFFSET sit on the final SELECT, after `windowed` is fully computed, never inside
// `base`. Ordering by (cik, cusip, put_call) is safe for paging: within one
// report_period (fixed by the WHERE clause) that triple is exactly the UNIQUE
// constraint minus report_period, so it's a total, gap-free order — chunk N and
// chunk N+1 never miss or duplicate a row as long as the source data is unchanged
// between the two runs.

function buildPopulateSql(paginated) {
  return `
WITH winning_filing AS (
  SELECT cik, report_period, accession_number FROM (
    SELECT cik, report_period, accession_number,
           ROW_NUMBER() OVER (PARTITION BY cik, report_period ORDER BY filing_date DESC) rn
    FROM filing13f
    WHERE report_period IN (?, ?)
  ) WHERE rn = 1
),
base AS (
  SELECT h.cik, h.cusip, COALESCE(h.put_call, '') AS put_call,
         h.issuer_name, h.report_period, h.value AS market_value,
         h.shares AS share_count, h.track AS track,
         iem.entity_id AS entity_id
  FROM holding13f_normalized h
  JOIN winning_filing wf
    ON wf.cik = h.cik AND wf.report_period = h.report_period AND wf.accession_number = h.accession_number
  LEFT JOIN instrument_master im
    ON im.cusip_issuer_6 = substr(h.cusip, 1, 6) AND im.cusip = h.cusip
  LEFT JOIN instrument_entity_map iem
    ON iem.instrument_key = im.instrument_key
  WHERE h.report_period IN (?, ?)
),
windowed AS (
  SELECT cik, cusip, put_call, entity_id, issuer_name, report_period,
         market_value, share_count,
         LAG(market_value) OVER (PARTITION BY cik, cusip, put_call ORDER BY report_period) AS prev_market_value,
         LAG(share_count)  OVER (PARTITION BY cik, cusip, put_call ORDER BY report_period) AS prev_share_count,
         market_value - LAG(market_value) OVER (PARTITION BY cik, cusip, put_call ORDER BY report_period) AS value_change,
         share_count  - LAG(share_count)  OVER (PARTITION BY cik, cusip, put_call ORDER BY report_period) AS share_change,
         track
  FROM base
)
INSERT OR REPLACE INTO managerissuerpositionquarterly
  (cik, cusip, put_call, entity_id, issuer_name, report_period,
   market_value, share_count, prev_market_value, prev_share_count,
   value_change, share_change, track)
SELECT cik, cusip, put_call, entity_id, issuer_name, report_period,
       market_value, share_count, prev_market_value, prev_share_count,
       value_change, share_change, track
FROM windowed
WHERE report_period = ?${paginated ? `
ORDER BY cik, cusip, put_call
LIMIT ? OFFSET ?` : ''};
`.trim();
}

// Note: SQLite requires the WITH clause to precede the statement it modifies —
// "WITH ... INSERT INTO ... SELECT ..." (not "INSERT INTO ... WITH ... SELECT").

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('SEED MANAGER POSITIONS — managerissuerpositionquarterly');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`DATABASE:     meridian-etf (${DATABASE_ID})`);
  console.log(`PERIOD:       ${PERIOD}`);
  console.log(`CHUNK:        ${PAGINATED ? `offset=${OFFSET} limit=${LIMIT}` : 'none (whole period in one statement)'}`);
  console.log(`MODE:         ${DRY_RUN ? 'DRY RUN — zero writes' : 'LIVE — will write to D1'}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Step 4: smoke test — expected row volume for this period (whole-period count,
  // regardless of chunking, so you can see how many chunks the period will need)
  const smoke = await d1raw(
    `SELECT COUNT(*) AS n FROM holding13f_normalized WHERE report_period = ?`,
    [PERIOD]
  );
  const sourceRowCount = smoke.rows[0]?.n ?? 0;
  console.log(`Smoke test: holding13f_normalized has ${sourceRowCount} rows for report_period = ${PERIOD}`);
  if (PAGINATED) {
    const chunkRows = Math.max(0, Math.min(LIMIT, sourceRowCount - OFFSET));
    const totalChunks = Math.ceil(sourceRowCount / LIMIT);
    console.log(`This chunk (offset=${OFFSET}, limit=${LIMIT}): up to ${chunkRows} rows × 4 = up to ${chunkRows * 4} writes`);
    console.log(`Full period needs ~${totalChunks} chunks of this size to cover all ${sourceRowCount} rows.\n`);
  } else {
    console.log(`Expected write volume: ~${sourceRowCount} rows × 4 (PK + UNIQUE + 2 indexes) = ~${sourceRowCount * 4} writes\n`);
  }

  // Step 4b: resolve prior_period — the most recent report_period strictly before
  // PERIOD that exists in holding13f_normalized. This is what winning_filing/base get
  // pre-filtered to (current, prior) instead of scanning all history. Cheap only if
  // holding13f_normalized(report_period) is indexed — see comment above buildPopulateSql.
  const priorPeriodResult = await d1raw(
    `SELECT MAX(report_period) AS prior FROM holding13f_normalized WHERE report_period < ?`,
    [PERIOD]
  );
  const PRIOR_PERIOD = priorPeriodResult.rows[0]?.prior ?? null;
  console.log(`Prior period resolved: ${PRIOR_PERIOD ?? '(none — this is the earliest period in holding13f_normalized)'}\n`);

  const sql = buildPopulateSql(PAGINATED);
  const params = [
    PERIOD, PRIOR_PERIOD, // winning_filing filter
    PERIOD, PRIOR_PERIOD, // base filter
    PERIOD,               // final SELECT WHERE
    ...(PAGINATED ? [LIMIT, OFFSET] : [])
  ];

  if (DRY_RUN) {
    console.log('DRY RUN — SQL that would execute:\n');
    console.log(sql);
    console.log(`\nBound params: [${params.join(', ')}]`);
    console.log('\nDRY RUN complete — no DDL applied, no writes sent to D1.');
    return;
  }

  // Step 2: create table/indexes if missing
  await ensureTableExists();

  // Step 3: run the population statement for this period (and chunk, if paginated)
  console.log(`Running population INSERT OR REPLACE for report_period = ${PERIOD}${PAGINATED ? ` (offset=${OFFSET}, limit=${LIMIT})` : ''}...`);
  const result = await d1raw(sql, params);
  console.log(`Statement complete. rows_written (per D1 meta): ${result.meta.rows_written ?? 'n/a'}\n`);

  // Step 5: verify
  const verify = await d1raw(
    `SELECT COUNT(*) AS n FROM managerissuerpositionquarterly WHERE report_period = ?`,
    [PERIOD]
  );
  const landedRowCount = verify.rows[0]?.n ?? 0;
  console.log(`Verification: managerissuerpositionquarterly now has ${landedRowCount} rows for report_period = ${PERIOD}`);

  if (landedRowCount === 0) {
    console.error('WARNING: 0 rows landed — check source data and SQL above.');
  } else if (PAGINATED) {
    console.log(`Note: this is a cumulative count across all chunks run so far for this period, not just this chunk — re-run with the next --offset to continue.`);
  } else if (landedRowCount !== sourceRowCount) {
    console.log(`Note: landed count (${landedRowCount}) differs from raw source count (${sourceRowCount}) — expected if this period has amended filings resolved out.`);
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('DONE');
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
