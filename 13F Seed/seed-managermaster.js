#!/usr/bin/env node
// seed-managermaster.js
// Populates managermaster + manageraliases from a 13F SEC quarterly data dump.
//
// Usage:
//   node seed-managermaster.js --quarter=2025_Q1
//   node seed-managermaster.js --quarter=2025_Q2 --dry-run

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── D1 config (meridian-etf database — same as gleif-seed.js) ────────────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const QUARTER  = args.quarter;
const DRY_RUN  = !!args['dry-run'];

if (!QUARTER) {
  console.error('ERROR: --quarter=<quarter> is required (e.g. --quarter=2025_Q1)');
  process.exit(1);
}
if (!TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const SEED_DIR    = __dirname;                            // …/13F Seed/
const QUARTER_DIR = path.join(SEED_DIR, QUARTER);
const EXTRACTED   = path.join(QUARTER_DIR, '_extracted');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
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
  console.log(`\n=== seed-managermaster  quarter=${QUARTER}  dry-run=${DRY_RUN} ===\n`);

  // 1. Unzip if needed
  console.log('Step 1: Ensure extracted data...');
  ensureExtracted();

  // 2. Ensure tables exist (idempotent — safe to re-run on existing DB)
  if (!DRY_RUN) {
    console.log('\nStep 2: Ensuring tables exist...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS managermaster (
        cik              TEXT PRIMARY KEY,
        form_type        TEXT,
        manager_name     TEXT,
        normalized_name  TEXT,
        entity_id        INTEGER
      )
    `);
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS manageraliases (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        cik              TEXT,
        alias            TEXT,
        alias_normalized TEXT,
        source           TEXT,
        UNIQUE(cik, alias_normalized)
      )
    `);
    console.log('  Tables ready.');
  }

  // 3. Parse TSVs
  console.log('\nStep 3: Parsing TSVs...');
  const submissions  = parseTsv(findTsv(EXTRACTED, 'SUBMISSION.tsv'));
  const coverpages   = parseTsv(findTsv(EXTRACTED, 'COVERPAGE.tsv'));
  const otherMgr     = parseTsv(findTsv(EXTRACTED, 'OTHERMANAGER.tsv'));
  const otherMgr2    = parseTsv(findTsv(EXTRACTED, 'OTHERMANAGER2.tsv'));

  console.log(`  SUBMISSION rows:   ${submissions.length}`);
  console.log(`  COVERPAGE rows:    ${coverpages.length}`);
  console.log(`  OTHERMANAGER rows: ${otherMgr.length}`);
  console.log(`  OTHERMANAGER2 rows:${otherMgr2.length}`);

  // 3. Build COVERPAGE lookup: accession → { name, filing_date }
  const coverMap = new Map(); // accession → { name, filing_date }
  for (const cp of coverpages) {
    coverMap.set(cp.ACCESSION_NUMBER, {
      name:        cp.FILINGMANAGER_NAME ?? '',
      filing_date: parseDate(cp.DATEREPORTED || ''),
    });
  }

  // 4. Separate primary submissions (managermaster candidates) from amendments (aliases only)
  const PRIMARY_TYPES    = new Set(['13F-HR', '13F-NT']);
  const AMENDMENT_TYPES  = new Set(['13F-HR/A', '13F-NT/A']);

  // cik → { form_type, best_date, manager_name, accession }
  const managerMap = new Map();

  // accession → cik (for OTHERMANAGER join, which may lack CIK on the other-manager row)
  const accessionToCik = new Map();

  for (const row of submissions) {
    const cik = padCik(row.CIK);
    if (!cik) continue;
    const type = row.SUBMISSIONTYPE;
    const accession = row.ACCESSION_NUMBER;
    const filingDate = parseDate(row.FILING_DATE);

    accessionToCik.set(accession, cik);

    if (PRIMARY_TYPES.has(type)) {
      const cover = coverMap.get(accession);
      const name = cover?.name ?? '';
      const existing = managerMap.get(cik);
      // Keep the row with the most recent FILING_DATE as canonical
      if (!existing || filingDate > existing.best_date) {
        managerMap.set(cik, {
          form_type:    type,
          best_date:    filingDate,
          manager_name: name,
          accession,
        });
      }
    }
  }

  console.log(`\n  Distinct primary CIKs (managermaster): ${managerMap.size}`);

  // 5. Harvest aliases
  // alias source tag includes the quarter
  const sourceTag = QUARTER;

  // Map: cik → Set of normalized alias strings (to deduplicate before writing)
  // We also store { alias, alias_normalized, source } per cik
  // Use a map: cik → Map<alias_normalized, { alias, source }>
  const aliasMap = new Map(); // cik → Map<normalized, { alias, source }>

  function addAlias(cik, rawName, source) {
    if (!cik || !rawName) return;
    const norm = normalizeName(rawName);
    if (!norm) return;
    if (!aliasMap.has(cik)) aliasMap.set(cik, new Map());
    // First source wins (deterministic ordering)
    if (!aliasMap.get(cik).has(norm)) {
      aliasMap.get(cik).set(norm, { alias: rawName.trim(), source });
    }
  }

  // 5a. Canonical names from primary submissions → alias
  for (const [cik, entry] of managerMap) {
    addAlias(cik, entry.manager_name, `${sourceTag}:coverpage`);
  }

  // 5b. Alias variants from amendment rows (13F-HR/A, 13F-NT/A)
  for (const row of submissions) {
    const cik = padCik(row.CIK);
    if (!cik) continue;
    if (!AMENDMENT_TYPES.has(row.SUBMISSIONTYPE)) continue;
    const cover = coverMap.get(row.ACCESSION_NUMBER);
    if (cover?.name) {
      addAlias(cik, cover.name, `${sourceTag}:amendment`);
    }
  }

  // 5c. OTHERMANAGER.tsv — join on ACCESSION_NUMBER to resolve the filing CIK,
  //     then use NAME as an alias for that filer AND (if CIK present) the other manager.
  for (const row of otherMgr) {
    const filerCik = accessionToCik.get(row.ACCESSION_NUMBER);
    if (filerCik) {
      addAlias(filerCik, row.NAME, `${sourceTag}:othermanager`);
    }
    // If OTHERMANAGER row itself carries a CIK, also alias there
    const otherCik = padCik(row.CIK);
    if (otherCik && otherCik !== filerCik) {
      addAlias(otherCik, row.NAME, `${sourceTag}:othermanager`);
    }
  }

  // 5d. OTHERMANAGER2.tsv — same logic
  for (const row of otherMgr2) {
    const filerCik = accessionToCik.get(row.ACCESSION_NUMBER);
    if (filerCik) {
      addAlias(filerCik, row.NAME, `${sourceTag}:othermanager2`);
    }
    const otherCik = padCik(row.CIK);
    if (otherCik && otherCik !== filerCik) {
      addAlias(otherCik, row.NAME, `${sourceTag}:othermanager2`);
    }
  }

  // Count total alias entries
  let totalAliases = 0;
  for (const m of aliasMap.values()) totalAliases += m.size;
  console.log(`  Distinct aliases (across all CIKs): ${totalAliases}`);

  // 6. Dry-run exit
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    console.log(`  managermaster rows: ${managerMap.size}`);
    console.log(`  manageraliases rows: ${totalAliases}`);
    return;
  }

  // 7. Build INSERT statements for managermaster
  console.log('\nStep 4: Writing managermaster...');
  const masterStmts = [];
  for (const [cik, entry] of managerMap) {
    const norm = normalizeName(entry.manager_name);
    masterStmts.push(
      `INSERT OR IGNORE INTO managermaster (cik, form_type, manager_name, normalized_name, entity_id) ` +
      `VALUES (${esc(cik)}, ${esc(entry.form_type)}, ${esc(entry.manager_name)}, ${esc(norm)}, NULL)`
    );
  }
  await runBatches(masterStmts, 'INSERT managermaster');

  // 8. Build INSERT statements for manageraliases
  console.log('\nStep 5: Writing manageraliases...');
  const aliasStmts = [];
  for (const [cik, normMap] of aliasMap) {
    for (const [norm, { alias, source }] of normMap) {
      aliasStmts.push(
        `INSERT OR IGNORE INTO manageraliases (cik, alias, alias_normalized, source) ` +
        `VALUES (${esc(cik)}, ${esc(alias)}, ${esc(norm)}, ${esc(source)})`
      );
    }
  }
  await runBatches(aliasStmts, 'INSERT manageraliases');

  console.log('\n=== seed-managermaster complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
