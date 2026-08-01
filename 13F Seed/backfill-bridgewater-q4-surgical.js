#!/usr/bin/env node
// backfill-bridgewater-q4-surgical.js
//
// Surgical, single-manager backfill for Bridgewater's Q4 2025 13F holdings.
// Unlike seed-holdings.js (which reclassifies + resubmits ALL ~177 managers
// every run — confirmed 2026-07-24 to cost real D1 write quota even for
// already-present managers via INSERT OR IGNORE no-ops: a Q3 rerun reported
// 244,668 rows_written for 63,498 statements, most of which were resubmits
// of managers that didn't need to change at all), this script touches ONLY
// Bridgewater's Q4 2025 accession. Nothing else in holding13f_normalized is
// read or written.
//
// Facts confirmed today via local bulk data + the Cloudflare dashboard:
//   - Bridgewater CIK 0001350694, Q4 2025 accession 0001350694-26-000001
//     (confirmed against local SUBMISSION.tsv — matches SEC EDGAR exactly).
//   - TABLEENTRYTOTAL = 1040 (from SUMMARYPAGE.tsv) — exceeds
//     TRACK_A_MAX_POSITIONS=1000 in seed-holdings.js, which is *why*
//     Bridgewater never qualified as a Track A candidate in the first
//     place, independent of the always-include list gap.
//   - OTHERINCLUDEDMANAGERSCOUNT = 0 — no joint filers, so the CUSIP+PUTCALL
//     grouping (same logic as seed-holdings.js, to stay consistent with the
//     rest of the dataset) is expected to be close to a 1:1 passthrough of
//     the 1040 raw INFOTABLE rows.
//   - Empirically measured cost of one real (non-conflicting) INSERT OR
//     IGNORE against this table: rows_written=4 (table row + unique index
//     entry + AUTOINCREMENT tracking table, roughly) — see
//     debug-d1-raw-shape.js Case 3. Expected total cost of this backfill:
//     ~1,040 x 4 ≈ 4,160 rows_written. Trivial against the 100k/day
//     free-tier cap, and since Bridgewater has zero existing Q4 rows, every
//     one of these inserts is a genuine new row — no risk of paying the
//     "phantom conflict cost" that hit the full seed-holdings.js rerun.
//   - Q3 2025 Bridgewater backfill already landed successfully earlier
//     today (cik total = 2,263 = 664 Q1 + 585 Q2 + 1,014 Q3). This script
//     does NOT touch Q3 — Q4 only.
//
// Usage:
//   node backfill-bridgewater-q4-surgical.js --dry-run
//     Parses + groups the local INFOTABLE.tsv only. Zero D1 calls. Prints
//     exact row count, sample rows, and expected D1 cost. Safe to run any
//     time, including right now before the daily quota resets.
//
//   node backfill-bridgewater-q4-surgical.js --commit
//     Same parse, then writes to D1. Run this ONLY after the free-tier
//     daily write quota has reset (00:00 UTC).

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;

const CIK            = '0001350694';
const ACCESSION       = '0001350694-26-000001';
const REPORT_PERIOD   = '2025-12-31';
const TRACK           = 'always_include';
const INFOTABLE_PATH  = path.join(__dirname, '2025_Q4', '_extracted', 'INFOTABLE.tsv');

const DRY_RUN = process.argv.includes('--dry-run');
const COMMIT  = process.argv.includes('--commit');
if (!DRY_RUN && !COMMIT) {
  console.error('Specify --dry-run (safe, no D1 calls) or --commit (writes to D1, run only after quota reset).');
  process.exit(1);
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Same aggregation semantics as seed-holdings.js: group by CUSIP+PUTCALL,
// summing VALUE and SSHPRNAMT, to collapse any OTHERMANAGER-split rows and
// stay consistent with how every other manager's data was seeded.
function streamAndGroup(filePath, accession) {
  return new Promise((resolve, reject) => {
    const grouped = new Map(); // "cusip|putcall" -> {cusip, putcall, nameofissuer, figi, value, shares}
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    let headers = null;
    let lineNo = 0;
    let matched = 0;

    rl.on('line', (line) => {
      lineNo++;
      if (lineNo === 1) { headers = line.split('\t').map(h => h.trim()); return; }
      if (!line.trim()) return;
      const tabIdx = line.indexOf('\t');
      const acc = tabIdx === -1 ? line : line.slice(0, tabIdx);
      if (acc !== accession) return;
      matched++;
      const vals = line.split('\t');
      const row = {};
      headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
      const putcall = row.PUTCALL || '';
      const key = `${row.CUSIP}|${putcall}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          cusip: row.CUSIP, putcall: putcall || null,
          nameofissuer: row.NAMEOFISSUER, figi: row.FIGI || null,
          value: 0, shares: 0,
        });
      }
      const g = grouped.get(key);
      g.value += parseInt(row.VALUE, 10) || 0;
      g.shares += parseInt(row.SSHPRNAMT, 10) || 0;
      if (lineNo % 1_000_000 === 0) console.log(`  [scan] ${lineNo.toLocaleString()} lines...`);
    });
    rl.on('close', () => resolve({ grouped, matched, lineNo }));
    rl.on('error', reject);
  });
}

async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json;
}

function sumMeta(json, field) {
  const results = Array.isArray(json.result) ? json.result : [json.result].filter(Boolean);
  return results.reduce((sum, r) => sum + (r?.meta?.[field] || 0), 0);
}

async function main() {
  console.log(`=== Surgical backfill: Bridgewater Q4 2025 (accession ${ACCESSION}) ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no D1 calls)' : 'COMMIT (will write to D1)'}\n`);

  if (!fs.existsSync(INFOTABLE_PATH)) {
    console.error(`ERROR: ${INFOTABLE_PATH} not found.`);
    process.exit(1);
  }

  console.log('Step 1: Parsing + grouping local INFOTABLE.tsv (no network, no D1)...');
  const { grouped, matched, lineNo } = await streamAndGroup(INFOTABLE_PATH, ACCESSION);
  console.log(`  Scanned ${lineNo.toLocaleString()} total lines, matched ${matched} raw rows for this accession.`);
  console.log(`  After CUSIP+PUTCALL grouping: ${grouped.size} distinct positions.`);

  const positions = Array.from(grouped.values());
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  console.log(`  Total reported value: $${totalValue.toLocaleString()}`);
  console.log(`  Sample (first 3):`);
  positions.slice(0, 3).forEach(p =>
    console.log(`    ${p.nameofissuer} | ${p.cusip} | $${p.value.toLocaleString()} | ${p.shares.toLocaleString()} sh${p.putcall ? ' | ' + p.putcall : ''}`)
  );

  const expectedRowsWritten = positions.length * 4; // empirically measured cost per new row — see debug-d1-raw-shape.js
  console.log(`\n  Expected D1 cost if committed: ~${positions.length} rows x ~4 rows_written each (measured empirically) = ~${expectedRowsWritten.toLocaleString()} rows_written.`);
  console.log(`  Against the 100,000/day free-tier cap, that's ~${(expectedRowsWritten / 100000 * 100).toFixed(1)}% of one day's budget.`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: nothing sent to D1. Re-run with --commit after the daily quota resets. ---');
    return;
  }

  if (!TOKEN) {
    console.error('ERROR: CF_API_TOKEN not set (check .env in this folder).');
    process.exit(1);
  }

  console.log('\nStep 2: Writing to D1 (holding13f_normalized) — Bridgewater Q4 2025 ONLY, nothing else touched...');
  const BATCH_SIZE = 100;
  let totalRowsWritten = 0;
  let totalRowsRead = 0;
  for (let i = 0; i < positions.length; i += BATCH_SIZE) {
    const batch = positions.slice(i, i + BATCH_SIZE);
    const values = batch.map(p =>
      `(${[ACCESSION, CIK, p.cusip, p.figi, p.nameofissuer, p.value, p.shares, p.putcall, REPORT_PERIOD, TRACK].map(esc).join(',')})`
    ).join(',');
    const sql = `INSERT OR IGNORE INTO holding13f_normalized (accession_number, cik, cusip, figi, issuer_name, value, shares, put_call, report_period, track) VALUES ${values};`;
    const json = await d1Raw(sql);
    const rw = sumMeta(json, 'rows_written');
    const rr = sumMeta(json, 'rows_read');
    totalRowsWritten += rw;
    totalRowsRead += rr;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, positions.length)}/${positions.length}  |  cumulative rows_written=${totalRowsWritten}  rows_read=${totalRowsRead}`);
  }

  console.log(`\n=== Done. TOTAL rows_written=${totalRowsWritten}  rows_read=${totalRowsRead} ===`);
  console.log("Verify with: SELECT report_period, COUNT(*) as cnt FROM holding13f_normalized WHERE cik='0001350694' GROUP BY report_period ORDER BY report_period;");
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
