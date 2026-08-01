#!/usr/bin/env node
// seed-issuerperiodsummary.js
// Populates issuerperiodsummary from data already in D1 (financialfact_reported,
// entity_master). No external HTTP calls, no local files read/written besides
// the migration DDL. Node.js + D1 REST API (/raw endpoint).
//
// BUDGET: issuerperiodsummary has 2 write targets (table + UNIQUE index).
// INSERT OR REPLACE on existing rows = delete+insert = ~4 write units/row on refresh.
// First run: ~7,041 rows × 2 = ~14,082 writes. Refresh runs: ~7,041 × 4 = ~28,164 writes.
// Single run, no chunking needed. Safe to run alongside ETF cron on any day.
//
// net_margin is written only on xbrl_tag='NetIncomeLoss' rows by design — margin
// is a per-issuer-per-period fact, but this table is grained per (cik, xbrl_tag,
// period_type), so it has no row that represents "the period" on its own. The
// NetIncomeLoss row is the designated home for it. It is NOT populated on the
// Revenues row or any other tag's row. Consumers must query
// WHERE xbrl_tag = 'NetIncomeLoss' to read margin.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

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
  const ddlPath = path.join(__dirname, 'migrations', 'sprint3-issuerperiodsummary.sql');
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
  console.log(`Applying DDL from migrations/sprint3-issuerperiodsummary.sql (${statements.length} statements)...`);
  for (const stmt of statements) {
    await d1raw(stmt);
  }
  console.log('Table confirmed (CREATE TABLE IF NOT EXISTS — no-op if already present).\n');
}

// ── Main population SQL ───────────────────────────────────────────────────────
// Note: SQLite requires the WITH clause to precede the statement it modifies —
// "WITH ... INSERT INTO ... SELECT ..." (not "INSERT INTO ... WITH ... SELECT").

const POPULATE_SQL = `
WITH mapped AS (
  SELECT f.cik, em.entity_id, f.xbrl_tag, f.value, f.unit, f.period_end, f.filed_date,
         CASE f.form_type
           WHEN '10-K' THEN 'annual' WHEN '10-K/A' THEN 'annual'
           WHEN '10-Q' THEN 'quarterly' WHEN '10-Q/A' THEN 'quarterly'
         END AS period_type
  FROM financialfact_reported f
  LEFT JOIN entity_master em ON em.cik = f.cik
  WHERE f.form_type IN ('10-K','10-Q','10-K/A','10-Q/A')
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY cik, xbrl_tag, period_type
    ORDER BY period_end DESC, filed_date DESC
  ) AS rn
  FROM mapped
)
INSERT OR REPLACE INTO issuerperiodsummary
  (cik, entity_id, xbrl_tag, period_type, period_end, value, unit, filed_date)
SELECT cik, entity_id, xbrl_tag, period_type, period_end, value, unit, filed_date
FROM ranked WHERE rn = 1;
`.trim();

// ── net_margin derivation ─────────────────────────────────────────────────────
// Written only onto the NetIncomeLoss row for a given (cik, period_type,
// period_end) — see header comment. rev.value <> 0 guards the divide-by-zero
// case; the period_end join condition ensures margin is never computed across
// two different fiscal periods when NetIncomeLoss and Revenues last reported
// at different times for the same issuer.

const NET_MARGIN_SQL = `
UPDATE issuerperiodsummary AS t
SET net_margin = (
  SELECT ni.value / rev.value
  FROM issuerperiodsummary ni
  JOIN issuerperiodsummary rev
    ON rev.cik = ni.cik
   AND rev.period_type = ni.period_type
   AND rev.period_end = ni.period_end
   AND rev.xbrl_tag = 'Revenues'
  WHERE ni.cik = t.cik
    AND ni.period_type = t.period_type
    AND ni.xbrl_tag = 'NetIncomeLoss'
    AND rev.value IS NOT NULL AND rev.value <> 0
)
WHERE t.xbrl_tag = 'NetIncomeLoss';
`.trim();

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('SEED ISSUER PERIOD SUMMARY — issuerperiodsummary');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`DATABASE:     meridian-etf (${DATABASE_ID})`);
  console.log(`MODE:         ${DRY_RUN ? 'DRY RUN — zero writes' : 'LIVE — will write to D1'}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Smoke test — expected source volume for the population query
  const smoke = await d1raw(
    `SELECT COUNT(*) AS n FROM financialfact_reported WHERE form_type IN ('10-K','10-Q','10-K/A','10-Q/A')`
  );
  const sourceRowCount = smoke.rows[0]?.n ?? 0;
  console.log(`Smoke test: financialfact_reported has ${sourceRowCount} rows with form_type IN ('10-K','10-Q','10-K/A','10-Q/A')`);
  console.log(`Expected write volume (first run): ~${sourceRowCount} rows collapse to <= ${sourceRowCount} grain-deduped rows × 2 (table + UNIQUE index)\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — SQL that would execute:\n');
    console.log('--- Step 1: population INSERT OR REPLACE ---');
    console.log(POPULATE_SQL);
    console.log('\n--- Step 2: net_margin UPDATE ---');
    console.log(NET_MARGIN_SQL);
    console.log('\nDRY RUN complete — no DDL applied, no writes sent to D1.');
    return;
  }

  // Step 1: create table if missing
  await ensureTableExists();

  // Step 2: run the population statement
  console.log('Running population INSERT OR REPLACE...');
  const popResult = await d1raw(POPULATE_SQL);
  console.log(`Statement complete. rows_written (per D1 meta): ${popResult.meta.rows_written ?? 'n/a'}\n`);

  // Step 3: run the net_margin UPDATE
  console.log('Running net_margin UPDATE...');
  const marginResult = await d1raw(NET_MARGIN_SQL);
  console.log(`Statement complete. rows_written (per D1 meta): ${marginResult.meta.rows_written ?? 'n/a'}\n`);

  // Step 4: verify
  const totalCount = await d1raw(`SELECT COUNT(*) AS n FROM issuerperiodsummary`);
  const marginCount = await d1raw(`SELECT COUNT(*) AS n FROM issuerperiodsummary WHERE net_margin IS NOT NULL`);
  const totalN = totalCount.rows[0]?.n ?? 0;
  const marginN = marginCount.rows[0]?.n ?? 0;
  console.log(`Verification: issuerperiodsummary has ${totalN} total rows`);
  console.log(`Verification: issuerperiodsummary has ${marginN} rows with net_margin IS NOT NULL`);

  if (totalN === 0) {
    console.error('WARNING: 0 rows landed — check source data and SQL above.');
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('DONE');
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
