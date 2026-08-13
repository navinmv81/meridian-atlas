#!/usr/bin/env node
// seed-filing13f.js
// Populates filing13f + filing13f_other_managers from a 13F SEC quarterly data dump.
// This is a filing registry (every SUBMISSIONTYPE), not a holdings filter.
//
// Usage:
//   node seed-filing13f.js --quarter=2025_Q1
//   node seed-filing13f.js --quarter=2025_Q1 --dry-run

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── D1 config (meridian-etf database — same as seed-managermaster.js) ────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const QUARTER = args.quarter;
const DRY_RUN = !!args['dry-run'];

if (!QUARTER) {
  console.error('ERROR: --quarter=<quarter> is required (e.g. --quarter=2025_Q1)');
  process.exit(1);
}
if (!DRY_RUN && !TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const SEED_DIR    = __dirname;
const QUARTER_DIR = path.join(SEED_DIR, QUARTER);
const EXTRACTED   = path.join(QUARTER_DIR, '_extracted');

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

// Locate a TSV by filename anywhere under a root directory (handles nested zip layouts).
function findTsv(root, filename) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      const found = findTsv(full, filename);
      if (found) return found;
    } else if (e.name === filename) {
      return full;
    }
  }
  return null;
}

function parseTsv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`  WARN: ${filePath ?? '(not found)'} — skipping`);
    return [];
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split('\t');
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

// Parse SEC date strings like "31-MAR-2025" or "2025-03-31" into comparable strings (YYYY-MM-DD).
const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};
function parseDate(s) {
  if (!s) return '';
  // "31-MAR-2025"
  const m = s.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
  if (m) return `${m[3]}-${MONTH_MAP[m[2]] ?? '00'}-${m[1]}`;
  // "2025-03-31" passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

// ── D1 ────────────────────────────────────────────────────────────────────────
async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
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

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`  [${label}] nothing to write`); return; }
  let done = 0;
  const t0 = Date.now();
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [${label}] ${done}/${stmts.length}  (${elapsed}s elapsed)`);
    }
  }
  console.log(`  [${label}] done — ${stmts.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ── Unzip step ────────────────────────────────────────────────────────────────
function ensureExtracted() {
  if (fs.existsSync(EXTRACTED)) {
    console.log(`  _extracted/ already exists — skipping unzip`);
    return;
  }

  if (!fs.existsSync(QUARTER_DIR)) {
    console.error(`ERROR: Quarter directory not found: ${QUARTER_DIR}`);
    process.exit(1);
  }

  // Find the zip file — filename varies per quarter, don't hardcode
  const entries = fs.readdirSync(QUARTER_DIR);
  const zips = entries.filter(f => f.toLowerCase().endsWith('.zip'));
  if (zips.length === 0) {
    console.error(`ERROR: No .zip file found in ${QUARTER_DIR}`);
    process.exit(1);
  }
  if (zips.length > 1) {
    console.warn(`WARN: Multiple zip files found; using first: ${zips[0]}`);
  }
  const zipPath = path.join(QUARTER_DIR, zips[0]);

  console.log(`  Unzipping ${zips[0]} → _extracted/ ...`);
  fs.mkdirSync(EXTRACTED, { recursive: true });
  // -o overwrites without prompting; the original zip is never moved or deleted
  execSync(`unzip -o "${zipPath}" -d "${EXTRACTED}"`, { stdio: 'inherit' });
  console.log(`  Unzip complete. Original zip preserved at: ${zipPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== seed-filing13f  quarter=${QUARTER}  dry-run=${DRY_RUN} ===\n`);

  // 1. Unzip if needed
  console.log('Step 1: Ensure extracted data...');
  ensureExtracted();

  // 2. Ensure tables exist (idempotent — safe to re-run on existing DB)
  if (!DRY_RUN) {
    console.log('\nStep 2: Ensuring tables exist...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS filing13f (
        accession_number     TEXT PRIMARY KEY,
        cik                  TEXT,
        filing_date          TEXT,
        report_period        TEXT,
        amendment_type       TEXT,
        entry_total          INTEGER,
        value_total          INTEGER,
        other_managers_count INTEGER,
        is_confidential_omitted TEXT
      )
    `);
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS filing13f_other_managers (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        accession_number  TEXT,
        sequence_or_sk    TEXT,
        cik               TEXT,
        name              TEXT,
        UNIQUE(accession_number, sequence_or_sk)
      )
    `);
    console.log('  Tables ready.');
  }

  // 3. Parse TSVs
  console.log('\nStep 3: Parsing TSVs...');
  const submissions = parseTsv(findTsv(EXTRACTED, 'SUBMISSION.tsv'));
  const summaryRows = parseTsv(findTsv(EXTRACTED, 'SUMMARYPAGE.tsv'));
  const otherMgr     = parseTsv(findTsv(EXTRACTED, 'OTHERMANAGER.tsv'));
  const otherMgr2    = parseTsv(findTsv(EXTRACTED, 'OTHERMANAGER2.tsv'));

  console.log(`  SUBMISSION rows:    ${submissions.length}`);
  console.log(`  SUMMARYPAGE rows:   ${summaryRows.length}`);
  console.log(`  OTHERMANAGER rows:  ${otherMgr.length}`);
  console.log(`  OTHERMANAGER2 rows: ${otherMgr2.length}`);

  // 4. Build SUMMARYPAGE lookup: accession → summary fields
  // Not every accession has a SUMMARYPAGE row (e.g. 13F-NT notice-only filings
  // hold no securities and never generate one) — that's fine, those columns
  // stay NULL on the filing13f row. SIGNATURE.tsv is explicitly not used here.
  const summaryMap = new Map();
  for (const row of summaryRows) {
    summaryMap.set(row.ACCESSION_NUMBER, {
      entryTotal:           parseInt(row.TABLEENTRYTOTAL, 10),
      valueTotal:           parseInt(row.TABLEVALUETOTAL, 10),
      otherManagersCount:   parseInt(row.OTHERINCLUDEDMANAGERSCOUNT, 10),
      isConfidentialOmitted: row.ISCONFIDENTIALOMITTED || null,
    });
  }

  // 5. Build filing13f rows — every SUBMISSION row, all submission types included
  //    (13F-HR, 13F-NT, 13F-HR/A, 13F-NT/A). This is a registry, not a filter.
  const filings = []; // { accession, cik, filingDate, reportPeriod, amendmentType, summary }
  let skippedNoCik = 0;
  for (const row of submissions) {
    const cik = padCik(row.CIK);
    if (!cik) { skippedNoCik++; continue; }
    filings.push({
      accession:     row.ACCESSION_NUMBER,
      cik,
      filingDate:    parseDate(row.FILING_DATE),
      reportPeriod:  parseDate(row.PERIODOFREPORT),
      amendmentType: row.SUBMISSIONTYPE,
      summary:       summaryMap.get(row.ACCESSION_NUMBER) || null,
    });
  }
  if (skippedNoCik > 0) {
    console.warn(`  WARN: skipped ${skippedNoCik} SUBMISSION rows with blank CIK`);
  }
  console.log(`  filing13f candidate rows: ${filings.length}`);

  // 6. Harvest other-manager rows from both OTHERMANAGER.tsv (OTHERMANAGER_SK)
  //    and OTHERMANAGER2.tsv (SEQUENCENUMBER).
  const otherManagerRows = []; // { accession, sequenceOrSk, cik, name }
  for (const row of otherMgr) {
    otherManagerRows.push({
      accession:    row.ACCESSION_NUMBER,
      sequenceOrSk: row.OTHERMANAGER_SK,
      cik:          padCik(row.CIK),
      name:         row.NAME,
    });
  }
  for (const row of otherMgr2) {
    otherManagerRows.push({
      accession:    row.ACCESSION_NUMBER,
      sequenceOrSk: row.SEQUENCENUMBER,
      cik:          padCik(row.CIK),
      name:         row.NAME,
    });
  }
  console.log(`  filing13f_other_managers candidate rows: ${otherManagerRows.length}`);

  // 7. Dry-run exit — report row counts, zero network calls
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    console.log(`  filing13f rows:               ${filings.length}`);
    console.log(`  filing13f_other_managers rows: ${otherManagerRows.length}`);
    return;
  }

  // 8. Build INSERT statements for filing13f
  console.log('\nStep 4: Writing filing13f...');
  const filingStmts = filings.map(f => {
    const s = f.summary;
    return (
      `INSERT OR IGNORE INTO filing13f ` +
      `(accession_number, cik, filing_date, report_period, amendment_type, entry_total, value_total, other_managers_count, is_confidential_omitted) ` +
      `VALUES (${esc(f.accession)}, ${esc(f.cik)}, ${esc(f.filingDate)}, ${esc(f.reportPeriod)}, ${esc(f.amendmentType)}, ` +
      `${escNum(s?.entryTotal)}, ${escNum(s?.valueTotal)}, ${escNum(s?.otherManagersCount)}, ${esc(s?.isConfidentialOmitted ?? null)})`
    );
  });
  await runBatches(filingStmts, 'INSERT filing13f');

  // 9. Build INSERT statements for filing13f_other_managers
  console.log('\nStep 5: Writing filing13f_other_managers...');
  const otherMgrStmts = otherManagerRows.map(r =>
    `INSERT OR IGNORE INTO filing13f_other_managers (accession_number, sequence_or_sk, cik, name) ` +
    `VALUES (${esc(r.accession)}, ${esc(r.sequenceOrSk)}, ${esc(r.cik)}, ${esc(r.name)})`
  );
  await runBatches(otherMgrStmts, 'INSERT filing13f_other_managers');

  console.log('\n=== seed-filing13f complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
