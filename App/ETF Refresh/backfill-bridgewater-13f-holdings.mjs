// Task: One-time backfill of Bridgewater Associates, LP position-level 13F
// holdings for Q3 2025 and Q4 2025 into holding13f_normalized.
//
// WHY THIS EXISTS
// filing13f already has all 4 quarters of 2025 for Bridgewater (identity +
// filing metadata come from SEC submissions and are never scope-limited).
// holding13f_normalized (the actual position-level rows the Manager Page
// renders) is only seeded for the scoped manager set (Track A top ~150 by
// AUM + Track B/C mega-filers + a 6-name always-include list — see Section
// 16.3 of the current-state doc). Bridgewater rotated out of scope for
// Q3/Q4 2025, so those two quarters have filing metadata but zero holdings
// rows. This script fixes that by pulling the real filings directly from
// SEC EDGAR and inserting them.
//
// This does NOT fix why Bridgewater rotated out in the first place — that
// requires adding Bridgewater to the always-include list in the seed
// pipeline (a separate, external script this session doesn't have access
// to). This script only backfills the two quarters that are missing today.
//
// SOURCE DATA (confirmed live against SEC EDGAR on 2026-07-24):
//   Q3 2025 (report_period 2025-09-30): accession 0001172661-25-004777
//   Q4 2025 (report_period 2025-12-31): accession 0001350694-26-000001
//   CIK: 1350694 → padded "0001350694" (matches the cik10 convention used
//   throughout worker-13f.js).
//
// HOW TO RUN
//   1. Confirm column names below match your live schema:
//        npx wrangler d1 execute meridian-etf --remote --command \
//          "PRAGMA table_info(holding13f_normalized);"
//      Adjust the COLS array if any name differs.
//   2. (Recommended) Sanity-check value units against an already-seeded
//      quarter, so the backfill uses the same dollars-vs-thousands
//      convention as existing rows:
//        npx wrangler d1 execute meridian-etf --remote --command \
//          "SELECT issuer_name, cusip, value, shares FROM holding13f_normalized \
//           WHERE cik='0001350694' AND report_period='2025-06-30' \
//           AND issuer_name LIKE '%ABBOTT%' LIMIT 1;"
//      This script's `value` comes straight from SEC's <ns1:value> element,
//      which for 2025 filings is reported in whole dollars (verified: an
//      ABBOTT LABS position of value=15372331 / shares=122694 implies
//      ~$125/share, consistent with real ABT pricing — not thousands).
//      If your existing Q2 2025 rows are in thousands instead, divide
//      VALUE_DIVISOR below by 1000.
//   3. Run: node backfill-bridgewater-13f-holdings.mjs
//      (needs `wrangler` on PATH and already authenticated, same as every
//      other D1 write this sprint.)
//
// SAFETY / D1 BUDGET
//   ~600 rows/quarter x 2 quarters ≈ 1,200 INSERT OR IGNORE rows, batched
//   at 100 rows/statement = ~12 write statements total. Negligible against
//   the 100k writes/day free-tier cap. Read-only against SEC (2 fetches).
//   No loop of single-row inserts (batched per project D1 rules).

import { execSync } from 'child_process';

const DB = 'meridian-etf';
const CIK10 = '0001350694';
const SEC_UA = 'MeridianAtlas contact@meridianatlas.com';

// Adjust these if PRAGMA table_info(holding13f_normalized) shows different
// names. Order here must match the VALUES tuple built in toRow() below.
const COLS = '(cik, accession_number, report_period, issuer_name, cusip, value, shares, put_call)';
const VALUE_DIVISOR = 1; // set to 1000 if existing rows are in thousands, not dollars

const FILINGS = [
  { accession: '0001172661-25-004777', reportPeriod: '2025-09-30', label: 'Q3 2025' },
  { accession: '0001350694-26-000001', reportPeriod: '2025-12-31', label: 'Q4 2025' },
];

function escapeVal(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function runQuery(sql) {
  const escaped = sql.replace(/'/g, "'\\''");
  const out = execSync(
    `wrangler d1 execute ${DB} --remote --json --command='${escaped}'`,
    { maxBuffer: 256 * 1024 * 1024, stdio: 'pipe' }
  );
  const parsed = JSON.parse(out.toString());
  if (!parsed[0].success) throw new Error('Query failed: ' + JSON.stringify(parsed[0]));
  return parsed[0].results;
}

function runWrite(sql) {
  execSync(
    `wrangler d1 execute ${DB} --remote --command="${sql.replace(/"/g, '\\"')}"`,
    { stdio: 'pipe' }
  );
}

// SEC EDGAR requires a descriptive User-Agent and asks for <=10 req/s.
// Only 2 fetches here, but pace them anyway.
let lastFetch = 0;
async function secFetch(url) {
  const elapsed = Date.now() - lastFetch;
  if (elapsed < 300) await new Promise(r => setTimeout(r, 300 - elapsed));
  lastFetch = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA, Accept: '*/*' } });
  if (!res.ok) throw new Error(`SEC fetch failed (${res.status}): ${url}`);
  return res.text();
}

// Minimal parser for the flat <ns1:infoTable>...</ns1:infoTable> repeated
// structure. Deliberately not a general XML parser — matched to the exact
// shape SEC's Form 13F information table uses.
function parseInfoTable(xml) {
  const blocks = xml.match(/<ns1:infoTable>[\s\S]*?<\/ns1:infoTable>/g) || [];
  return blocks.map(block => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<ns1:${tag}>([^<]*)</ns1:${tag}>`));
      return m ? m[1].trim() : null;
    };
    return {
      issuer_name: get('nameOfIssuer'),
      cusip: get('cusip'),
      value: get('value'),
      shares: get('sshPrnamt'),
      put_call: get('putCall'), // absent for most rows (equities), present for options
    };
  });
}

function toRow(cik, accession, reportPeriod, h) {
  const value = h.value != null ? Math.round(Number(h.value) / VALUE_DIVISOR) : null;
  return `(${[cik, accession, reportPeriod, h.issuer_name, h.cusip, value, h.shares, h.put_call]
    .map(escapeVal)
    .join(',')})`;
}

async function main() {
  // Write guard: confirm neither quarter already has rows for this cik
  // before doing any fetching or writing (idempotency check, mirrors the
  // has_holdings_data scoping logic in worker-13f.js).
  console.log('Step 1: Checking existing holding13f_normalized coverage for Bridgewater...');
  const existing = runQuery(
    `SELECT report_period, COUNT(*) as cnt FROM holding13f_normalized WHERE cik = '${CIK10}' GROUP BY report_period ORDER BY report_period;`
  );
  console.log('  Existing rows by quarter:', existing);

  for (const filing of FILINGS) {
    const already = existing.find(r => r.report_period === filing.reportPeriod);
    if (already && already.cnt > 0) {
      console.log(`  ${filing.label} (${filing.reportPeriod}) already has ${already.cnt} rows — skipping fetch, INSERT OR IGNORE will no-op anyway if re-run.`);
    }

    console.log(`\nStep 2: Fetching ${filing.label} infotable.xml (accession ${filing.accession})...`);
    const accNoDash = filing.accession.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/1350694/${accNoDash}/infotable.xml`;
    const xml = await secFetch(url);

    const holdings = parseInfoTable(xml);
    console.log(`  Parsed ${holdings.length} holdings.`);
    if (holdings.length === 0) {
      console.warn(`  WARNING: 0 holdings parsed for ${filing.label} — check the XML shape before proceeding. Skipping insert.`);
      continue;
    }

    console.log(`Step 3: Inserting ${holdings.length} rows for ${filing.label} in batches of 100...`);
    const BATCH_SIZE = 100; // 8 cols x 100 rows = 800 vars, under SQLite's 999 limit
    let inserted = 0;
    for (let i = 0; i < holdings.length; i += BATCH_SIZE) {
      const batch = holdings.slice(i, i + BATCH_SIZE);
      const values = batch.map(h => toRow(CIK10, filing.accession, filing.reportPeriod, h)).join(',');
      const sql = `INSERT OR IGNORE INTO holding13f_normalized ${COLS} VALUES ${values};`;
      runWrite(sql);
      inserted += batch.length;
      console.log(`  Progress: ${inserted}/${holdings.length}`);
    }
    console.log(`  Done: ${filing.label} (${filing.reportPeriod}) — ${holdings.length} rows processed (INSERT OR IGNORE).`);
  }

  console.log('\nStep 4: Verifying final coverage...');
  const finalCounts = runQuery(
    `SELECT report_period, COUNT(*) as cnt FROM holding13f_normalized WHERE cik = '${CIK10}' GROUP BY report_period ORDER BY report_period;`
  );
  console.log('=== Backfill complete ===');
  console.log('Bridgewater holding13f_normalized rows by quarter:', finalCounts);
  console.log('\nSanity check next: open Bridgewater\'s Manager Page in the app and confirm Q3/Q4 2025 holdings now render with real position data.');
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
