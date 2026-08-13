#!/usr/bin/env node
// seed-holdings.js
// Populates holding13f_normalized from a 13F SEC quarterly data dump.
//
// Usage:
//   node seed-holdings.js --quarter=2025_Q1
//   node seed-holdings.js --quarter=2025_Q1 --dry-run

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// ── D1 config (meridian-etf — same database as seed-managermaster.js) ─────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

// ── Track B/C CIKs (the 20 large/complex filers) ─────────────────────────────
const TRACK_BC_CIKS = new Set([
  '0002012383', // BlackRock
  '0000102909', // Vanguard
  '0001167557', // AQR
  '0001214717', // Geode
  '0000073124', // Northern Trust
  '0001450144', // Two Sigma Securities
  '0000810265', // NY State Common
  '0001283718', // CPPIB
  '0001218710', // Balyasny
  '0001603466', // Point72 Asset Mgmt
  '0001037389', // Renaissance
  '0001318757', // Marshall Wace
  '0001009207', // D.E. Shaw
  '0001081019', // CalSTRS
  '0002017863', // Point72 DIFC
  '0001423053', // Citadel
  '0001595888', // Jane Street
  '0001273087', // Millennium
  '0001859606', // Optiver
  '0001446194', // Susquehanna
]);

// ── Always-include CIKs (full holdings, no value cutoff) ──────────────────────
const ALWAYS_INCLUDE_CIKS = new Set([
  '0001336528', // Pershing Square
  '0001061165', // Lone Pine
  '0001263508', // Baker Bros
  '0001040273', // Third Point
  '0001747057', // D1 Capital
  '0001595082', // Davidson Kempner
  '0001350694', // Bridgewater Associates, LP — added 2026-07-24. Rotated out
                 // of Track A for Q3/Q4 2025 (likely exceeds
                 // TRACK_A_MAX_POSITIONS=1000, so it never even reached the
                 // ranking step), leaving a top-tier macro fund with zero
                 // position-level holdings for two straight quarters.
                 // Guaranteed inclusion going forward.
]);

// ── Permanently excluded CIKs (prime-brokers / custodians — skip entirely) ────
// Fill in CIKs as confirmed; these generate no rows in holding13f_normalized.
const EXCLUDED_CIKS = new Set([
  '0000895421', // Morgan Stanley (parent holding company)
  '0000019617', // JPMorgan Chase & Co
  '0000886982', // Goldman Sachs Group Inc
  '0000070858', // Bank of America Corp /DE/
  '0001000275', // Royal Bank of Canada
  '0000072971', // Wells Fargo & Company/MN
  '0001390777', // Bank of New York Mellon Corp (parent — 31,891 entries, $504B)
]);

// ── Track A limits ─────────────────────────────────────────────────────────────
const TRACK_A_MAX_POSITIONS = 1000; // TABLEENTRYTOTAL threshold to qualify
const TRACK_A_TOP_N_FILERS  = 150;  // keep top N filers ranked by TABLEVALUETOTAL

// ── Track B/C limits ──────────────────────────────────────────────────────────
const TRACK_BC_COVERAGE     = 0.80; // cumulative value coverage target
const TRACK_BC_MAX_POSITIONS = 600; // hard cap

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const QUARTER  = args.quarter;
const DRY_RUN  = !!args['dry-run'];
const RERUN    = !!args['rerun'];   // delete existing rows for this quarter before inserting

if (!QUARTER) {
  console.error('ERROR: --quarter=<quarter> is required (e.g. --quarter=2025_Q1)');
  process.exit(1);
}
if (!TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const SEED_DIR    = __dirname;
const QUARTER_DIR = path.join(SEED_DIR, QUARTER);
const EXTRACTED   = path.join(QUARTER_DIR, '_extracted');

// ── Helpers: shared with seed-managermaster.js ────────────────────────────────
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function padCik(cik) {
  if (!cik) return null;
  return String(cik).trim().replace(/^0+/, '').padStart(10, '0');
}

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

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};
function parseDate(s) {
  if (!s) return '';
  const m = s.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
  if (m) return `${m[3]}-${MONTH_MAP[m[2]] ?? '00'}-${m[1]}`;
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

// Sums meta.rows_written / meta.rows_read across every result entry in a D1
// /raw response. When multiple statements are batched into one semicolon-
// joined string, D1 may return one result entry per statement or a single
// aggregated entry depending on the statement mix — sum defensively over
// whatever shape comes back rather than assuming one or the other.
function sumMeta(json, field) {
  const results = Array.isArray(json.result) ? json.result : [json.result].filter(Boolean);
  return results.reduce((sum, r) => sum + (r?.meta?.[field] || 0), 0);
}

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`  [${label}] nothing to send`); return { rowsWritten: 0, rowsRead: 0 }; }
  let done = 0;
  let totalRowsWritten = 0;
  let totalRowsRead = 0;
  const t0 = Date.now();
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    const json = await d1Raw(chunk.join(';\n'));
    const rowsWritten = sumMeta(json, 'rows_written');
    const rowsRead = sumMeta(json, 'rows_read');
    totalRowsWritten += rowsWritten;
    totalRowsRead += rowsRead;
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [${label}] ${done}/${stmts.length} statements sent  |  cumulative rows_written=${totalRowsWritten}  rows_read=${totalRowsRead}  (${elapsed}s elapsed)`);
    }
  }
  // rows_written/rows_read below are Cloudflare's own billed metrics (per
  // https://developers.cloudflare.com/d1/platform/pricing/), summed live from
  // each batch's D1 response meta — this is the real number that counts
  // against the free-tier 100k writes/day cap, not just statements attempted.
  // INSERT OR IGNORE that skips an already-present row should not add to
  // rows_written under D1's own definition ("how many rows were written to
  // D1 database"), so if this run resubmits already-seeded managers, this
  // total should land near "new rows only" rather than the full statement
  // count. Watch this number live to confirm that assumption before running
  // a second quarter the same day.
  console.log(`  [${label}] done — ${stmts.length} statements sent in ${((Date.now() - t0) / 1000).toFixed(1)}s  |  TOTAL rows_written=${totalRowsWritten}  rows_read=${totalRowsRead}`);
  return { rowsWritten: totalRowsWritten, rowsRead: totalRowsRead };
}

// ── Unzip ─────────────────────────────────────────────────────────────────────
function ensureExtracted() {
  if (fs.existsSync(EXTRACTED)) {
    console.log('  _extracted/ already exists — skipping unzip');
    return;
  }
  if (!fs.existsSync(QUARTER_DIR)) {
    console.error(`ERROR: Quarter directory not found: ${QUARTER_DIR}`);
    process.exit(1);
  }
  const entries = fs.readdirSync(QUARTER_DIR);
  const zips = entries.filter(f => f.toLowerCase().endsWith('.zip'));
  if (zips.length === 0) {
    console.error(`ERROR: No .zip file found in ${QUARTER_DIR}`);
    process.exit(1);
  }
  if (zips.length > 1) console.warn(`WARN: Multiple zips found; using first: ${zips[0]}`);
  const zipPath = path.join(QUARTER_DIR, zips[0]);
  console.log(`  Unzipping ${zips[0]} → _extracted/ ...`);
  fs.mkdirSync(EXTRACTED, { recursive: true });
  execSync(`unzip -o "${zipPath}" -d "${EXTRACTED}"`, { stdio: 'inherit' });
  console.log(`  Unzip complete. Original zip preserved at: ${zipPath}`);
}

// ── Stream-parse INFOTABLE.tsv ─────────────────────────────────────────────────
// Reads the 338MB file line-by-line via readline. Only accumulates rows whose
// ACCESSION_NUMBER appears in neededAccessions. Never loads the full file into RAM.
//
// ALL tracks (A, B/C, always_include) are grouped by CUSIP+PUTCALL composite key,
// summing VALUE and SSHPRNAMT across OTHERMANAGER-split rows. This eliminates the
// SEC 13F OTHERMANAGER duplicate pattern universally.
//
// Returns:
//   groupedRows: accession → Map<"cusip|putcall", {cusip, putcall, value, shares,
//                                                   nameofissuer, figi}>
function streamInfotable(filePath, neededAccessions) {
  return new Promise((resolve, reject) => {
    const groupedRows = new Map(); // accession → Map<cusip|putcall, aggregated>

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let headers  = null;
    let lineNo   = 0;
    let kept     = 0;
    let skipped  = 0;
    const t0     = Date.now();

    rl.on('line', (line) => {
      lineNo++;
      if (lineNo === 1) {
        headers = line.split('\t').map(h => h.trim());
        return;
      }
      if (!line.trim()) return;

      // Fast pre-filter: check the first field (ACCESSION_NUMBER) before
      // paying the cost of splitting all columns.
      const tabIdx = line.indexOf('\t');
      const accession = tabIdx === -1 ? line : line.slice(0, tabIdx);

      if (!neededAccessions.has(accession)) {
        skipped++;
        return;
      }

      // Full parse only for rows we actually need.
      const vals = line.split('\t');
      const row  = {};
      headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
      kept++;

      // Group by CUSIP + PUTCALL composite key for ALL tracks.
      // This collapses OTHERMANAGER-split rows (same CUSIP reported across multiple
      // sub-advisors) while preserving legitimate PUT vs CALL as separate positions.
      if (!groupedRows.has(accession)) groupedRows.set(accession, new Map());
      const byAccession = groupedRows.get(accession);
      const putcall = row.PUTCALL || '';
      const key     = `${row.CUSIP}|${putcall}`;
      if (!byAccession.has(key)) {
        byAccession.set(key, {
          cusip:        row.CUSIP,
          putcall:      putcall || null,
          nameofissuer: row.NAMEOFISSUER,
          figi:         row.FIGI || null,
          value:        0,
          shares:       0,
        });
      }
      const g = byAccession.get(key);
      g.value  += parseInt(row.VALUE,     10) || 0;
      g.shares += parseInt(row.SSHPRNAMT, 10) || 0;

      if (lineNo % 1_000_000 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [stream] ${lineNo.toLocaleString()} lines  kept=${kept.toLocaleString()}  skip=${skipped.toLocaleString()}  (${elapsed}s)`);
      }
    });

    rl.on('close', () => {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [stream] done — ${lineNo.toLocaleString()} lines  kept=${kept.toLocaleString()}  skip=${skipped.toLocaleString()}  (${elapsed}s)`);
      resolve({ groupedRows });
    });

    rl.on('error', reject);
  });
}

// ── Apply Track B/C 80% cumulative cutoff ─────────────────────────────────────
// Returns sorted, truncated array of position objects.
function applyBcCutoff(byAccession) {
  // Sort descending by summed value.
  const positions = Array.from(byAccession.entries())
    .map(([cusip, g]) => ({ cusip, ...g }))
    .sort((a, b) => b.value - a.value);

  const total = positions.reduce((s, p) => s + p.value, 0);
  const target = total * TRACK_BC_COVERAGE;
  let running = 0;
  const result = [];
  for (const p of positions) {
    if (result.length >= TRACK_BC_MAX_POSITIONS) break;
    result.push(p);
    running += p.value;
    if (running >= target) break;
  }
  return result;
}

// ── Build INSERT statement ────────────────────────────────────────────────────
function makeInsert(accession, cik, cusip, figi, issuerName, value, shares, putCall, reportPeriod, track) {
  return (
    `INSERT OR IGNORE INTO holding13f_normalized ` +
    `(accession_number, cik, cusip, figi, issuer_name, value, shares, put_call, report_period, track) ` +
    `VALUES (` +
    `${esc(accession)}, ${esc(cik)}, ${esc(cusip)}, ${esc(figi || null)}, ` +
    `${esc(issuerName)}, ${value || 0}, ${shares || 0}, ` +
    `${esc(putCall || null)}, ${esc(reportPeriod)}, ${esc(track)}` +
    `)`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== seed-holdings  quarter=${QUARTER}  dry-run=${DRY_RUN} ===\n`);

  // Step 1: Ensure extracted data exists.
  console.log('Step 1: Ensure extracted data...');
  ensureExtracted();

  // Step 2: CREATE TABLE (idempotent).
  if (!DRY_RUN) {
    console.log('\nStep 2: Ensuring table exists...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS holding13f_normalized (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        accession_number TEXT,
        cik              TEXT,
        cusip            TEXT,
        figi             TEXT,
        issuer_name      TEXT,
        value            INTEGER,
        shares           INTEGER,
        put_call         TEXT,
        report_period    TEXT,
        track            TEXT,
        UNIQUE(accession_number, cik, cusip, put_call)
      )
    `);
    console.log('  Table ready.');
  }

  // Step 3: Parse small TSVs fully into memory.
  console.log('\nStep 3: Parsing SUBMISSION.tsv and SUMMARYPAGE.tsv...');
  const submissions = parseTsv(findTsv(EXTRACTED, 'SUBMISSION.tsv'));
  const summaryRows = parseTsv(findTsv(EXTRACTED, 'SUMMARYPAGE.tsv'));
  console.log(`  SUBMISSION rows:  ${submissions.length}`);
  console.log(`  SUMMARYPAGE rows: ${summaryRows.length}`);

  // Step 4: Build lookup maps from SUBMISSION.
  // Per CIK, keep the most recent non-amendment row as canonical.
  const PRIMARY_TYPES = new Set(['13F-HR', '13F-NT']);
  // cik → { accession, period, filingDate }
  const cikCanonical = new Map();
  // accession → cik (all submission types, for SUMMARYPAGE join)
  const accessionToCik = new Map();

  for (const row of submissions) {
    const cik = padCik(row.CIK);
    if (!cik) continue;
    accessionToCik.set(row.ACCESSION_NUMBER, cik);
    if (!PRIMARY_TYPES.has(row.SUBMISSIONTYPE)) continue;
    const filingDate = parseDate(row.FILING_DATE);
    const existing = cikCanonical.get(cik);
    if (!existing || filingDate > existing.filingDate) {
      cikCanonical.set(cik, {
        accession:   row.ACCESSION_NUMBER,
        period:      parseDate(row.PERIODOFREPORT),
        filingDate,
      });
    }
  }

  // Step 5: Classify filers using SUMMARYPAGE + cikCanonical.
  console.log('\nStep 4: Classifying filers into tracks...');

  // accession → { tableEntryTotal, tableValueTotal } from SUMMARYPAGE
  const summaryByAccession = new Map();
  for (const row of summaryRows) {
    summaryByAccession.set(row.ACCESSION_NUMBER, {
      tableEntryTotal: parseInt(row.TABLEENTRYTOTAL, 10) || 0,
      tableValueTotal: parseInt(row.TABLEVALUETOTAL, 10) || 0,
    });
  }

  // Classify every known CIK.
  // Track A candidates: non-excluded, non-BC, non-always-include, ≤1000 positions.
  const trackACandidates = []; // { cik, accession, period, tableValueTotal }

  // Final track assignments: cik → { track, accession, period }
  const cikTrack = new Map();

  for (const [cik, canonical] of cikCanonical) {
    if (EXCLUDED_CIKS.has(cik)) continue;

    const summary = summaryByAccession.get(canonical.accession);
    if (!summary) continue; // no SUMMARYPAGE row — can't classify, skip

    if (ALWAYS_INCLUDE_CIKS.has(cik)) {
      cikTrack.set(cik, { track: 'always_include', accession: canonical.accession, period: canonical.period });
      continue;
    }
    if (TRACK_BC_CIKS.has(cik)) {
      cikTrack.set(cik, { track: 'B', accession: canonical.accession, period: canonical.period });
      continue;
    }
    if (summary.tableEntryTotal <= TRACK_A_MAX_POSITIONS) {
      trackACandidates.push({
        cik,
        accession:       canonical.accession,
        period:          canonical.period,
        tableValueTotal: summary.tableValueTotal,
      });
    }
  }

  // Rank Track A candidates descending by tableValueTotal, take top 150.
  trackACandidates.sort((a, b) => b.tableValueTotal - a.tableValueTotal);
  const trackASelected = trackACandidates.slice(0, TRACK_A_TOP_N_FILERS);
  for (const f of trackASelected) {
    cikTrack.set(f.cik, { track: 'A', accession: f.accession, period: f.period });
  }

  // Report classification.
  const trackACiks  = [...cikTrack.entries()].filter(([, v]) => v.track === 'A').map(([k]) => k);
  const trackBCiks  = [...cikTrack.entries()].filter(([, v]) => v.track === 'B').map(([k]) => k);
  const alwaysCiks  = [...cikTrack.entries()].filter(([, v]) => v.track === 'always_include').map(([k]) => k);

  console.log(`  Track A filers:       ${trackACiks.length}  (from ${trackACandidates.length} qualifying)`);
  console.log(`  Track B/C filers:     ${trackBCiks.length}`);
  console.log(`  Always-include filers:${alwaysCiks.length}`);

  if (DRY_RUN) {
    // For dry-run we still need to know how many positions we'd ingest,
    // but streaming INFOTABLE just to count would be slow. Report what we can.
    console.log('\n--- DRY RUN: no writes to D1 ---');
    console.log(`  Total filers selected: ${cikTrack.size}`);
    console.log(`  Track A CIKs (sample): ${trackACiks.slice(0, 5).join(', ')}${trackACiks.length > 5 ? ' …' : ''}`);
    console.log(`  Track B/C CIKs present: ${trackBCiks.join(', ')}`);
    console.log(`  Always-include CIKs present: ${alwaysCiks.join(', ')}`);
    console.log('\nRun without --dry-run to stream INFOTABLE and write positions.');
    return;
  }

  // Step 6: Build the set of accession numbers to filter during INFOTABLE streaming.
  const neededAccessions = new Set();
  for (const [, v] of cikTrack) neededAccessions.add(v.accession);

  // Reverse map: accession → cik (for insert building after streaming)
  const accessionToClassified = new Map();
  for (const [cik, v] of cikTrack) {
    accessionToClassified.set(v.accession, { cik, track: v.track, period: v.period });
  }

  // Step 7: Stream INFOTABLE.tsv — the 338MB file.
  const infotablePath = findTsv(EXTRACTED, 'INFOTABLE.tsv');
  if (!infotablePath) {
    console.error('ERROR: INFOTABLE.tsv not found under _extracted/');
    process.exit(1);
  }
  console.log(`\nStep 5: Streaming INFOTABLE.tsv (${(fs.statSync(infotablePath).size / 1e6).toFixed(0)}MB)...`);
  const { groupedRows } = await streamInfotable(infotablePath, neededAccessions);

  // Step 8: Build INSERT statements.
  // All tracks come from groupedRows (aggregated by cusip|putcall).
  // Track B/C gets the 80%/600 cutoff. Track A and always_include get all positions.
  console.log('\nStep 6: Building INSERT statements...');
  const stmts = [];
  let countA = 0, countAlways = 0, countBC = 0;

  for (const [accession, byAccession] of groupedRows) {
    const meta = accessionToClassified.get(accession);
    if (!meta) continue;

    let positions;
    if (meta.track === 'B') {
      positions = applyBcCutoff(byAccession);
      countBC += positions.length;
    } else {
      // Track A and always_include: all aggregated positions.
      positions = Array.from(byAccession.values());
      if (meta.track === 'A') countA += positions.length;
      else countAlways += positions.length;
    }

    for (const p of positions) {
      stmts.push(makeInsert(
        accession, meta.cik, p.cusip, p.figi,
        p.nameofissuer, p.value, p.shares, p.putcall,
        meta.period,
        meta.track,
      ));
    }
  }

  console.log(`  Track A positions:            ${countA}`);
  console.log(`  Track always_include:         ${countAlways}`);
  console.log(`  Track B/C (after cutoff):     ${countBC}`);
  console.log(`  Total statements to send:     ${stmts.length}`);

  // Step 9 (optional): Delete existing rows for this quarter before re-inserting.
  // Use --rerun when correcting previously written data (e.g. after the aggregation fix).
  // Deletes by accession_number — more precise than period, avoids touching other quarters.
  let deleteUsage = { rowsWritten: 0, rowsRead: 0 };
  if (RERUN) {
    const accessions = [...new Set(stmts.map(s => {
      // Extract the accession value from the INSERT string rather than re-computing.
      const m = s.match(/VALUES \('([^']+)'/);
      return m ? m[1] : null;
    }).filter(Boolean))];
    console.log(`\nStep 7a: --rerun: deleting existing rows for ${accessions.length} accessions...`);
    const deleteStmts = accessions.map(
      acc => `DELETE FROM holding13f_normalized WHERE accession_number = '${acc}'`
    );
    deleteUsage = await runBatches(deleteStmts, 'DELETE holding13f_normalized');
  }

  // Step 9: Write to D1.
  console.log('\nStep 7: Writing to D1...');
  const insertUsage = await runBatches(stmts, 'INSERT holding13f_normalized');

  const totalRowsWritten = deleteUsage.rowsWritten + insertUsage.rowsWritten;
  const totalRowsRead = deleteUsage.rowsRead + insertUsage.rowsRead;
  console.log('\n=== seed-holdings complete ===');
  console.log(`D1 usage this run: rows_written=${totalRowsWritten}  rows_read=${totalRowsRead}  (free-tier caps: 100,000 writes/day, 5,000,000 reads/day)`);
  if (totalRowsWritten > 100000) {
    console.warn('WARNING: this run alone reported more rows_written than the free-tier daily cap. Check your Cloudflare dashboard usage before running another quarter today.');
  } else {
    console.log(`Headroom remaining today (assuming nothing else has written yet): ${100000 - totalRowsWritten} writes.`);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
