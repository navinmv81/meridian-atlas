#!/usr/bin/env node
// seed-issuerfilingmaster.js
// Populates issuerfilingmaster from SEC EDGAR submissions API — 10-K, 10-Q,
// 8-K only, filtered to a 2-year lookback. One row per filing.
//
// Domain: Filings (owned by Equities Lead). Must not be written to by any
// ETF or Entities pipeline.
//
// Index creation (idx_issuerfilingmaster_cik_form) is deliberately deferred
// until after the bulk backfill completes — see
// ETF Refresh/migrations/sprint2-issuerfilingmaster.sql.
//
// Usage:
//   node seed-issuerfilingmaster.js --dry-run
//   node seed-issuerfilingmaster.js --dry-run --limit=50
//   node seed-issuerfilingmaster.js
//   node seed-issuerfilingmaster.js --offset=1600 --limit=1582

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── D1 config (meridian-etf database — same as seed-managermaster.js) ────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

const SEC_UA = 'MeridianAtlas contact@meridianatlas.com';
const SEC_RATE_LIMIT_MS = 150;

const FORM_TYPES = new Set(['10-K', '10-Q', '8-K']);
const LOOKBACK_DAYS = 365;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const DRY_RUN = !!args['dry-run'];
const LIMIT   = args.limit ? parseInt(args.limit, 10) : null;
const OFFSET  = args.offset ? parseInt(args.offset, 10) : 0;

if (!DRY_RUN && !TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
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

async function d1Select(sql) {
  const json = await d1Raw(sql);
  const { columns, rows } = json.result[0].results;
  return rows.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
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

// ── EDGAR ─────────────────────────────────────────────────────────────────────
// Extracts matching filings from one issuer's submissions.json filings.recent
// block. filings.recent is a set of parallel arrays, index-aligned per filing.
function extractFilings(cik, submissionsJson) {
  const recent = submissionsJson?.filings?.recent;
  if (!recent || !Array.isArray(recent.accessionNumber)) return [];

  const rows = [];
  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const form = recent.form[i];
    const filedDate = recent.filingDate[i];
    if (!FORM_TYPES.has(form)) continue;
    if (!filedDate || filedDate < CUTOFF_STR) continue;

    rows.push({
      accession: recent.accessionNumber[i],
      cik,
      formType: form,
      filedDate,
      periodOfReport: recent.reportDate?.[i] || null,
      primaryDocument: recent.primaryDocument?.[i] || null,
    });
  }
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n=== seed-issuerfilingmaster  dry-run=${DRY_RUN}  limit=${LIMIT ?? 'none'}  ` +
    `offset=${OFFSET}  cutoff=${CUTOFF_STR} ===\n`
  );

  // 1. Ensure table exists (idempotent — safe to re-run on existing DB)
  if (!DRY_RUN) {
    console.log('Step 1: Ensuring table exists...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS issuerfilingmaster (
        accession_number  TEXT PRIMARY KEY,
        cik               TEXT NOT NULL,
        form_type         TEXT NOT NULL,
        filed_date        TEXT,
        period_of_report  TEXT,
        primary_document  TEXT
      )
    `);
    console.log('  Table ready. (Index creation deferred — run separately after backfill.)');
  }

  // 2. Fetch in-scope issuers
  console.log('\nStep 2: Fetching in-scope issuers from entity_master...');
  const allTargets = await d1Select(
    `SELECT entity_id, cik FROM entity_master WHERE cik IS NOT NULL ORDER BY entity_id`
  );
  console.log(`  Issuers with cik: ${allTargets.length}`);

  const sliced = allTargets.slice(OFFSET, LIMIT ? OFFSET + LIMIT : undefined);
  console.log(`  Processing: offset=${OFFSET}  count=${sliced.length}`);

  // 3. Walk issuers sequentially — one 404/timeout must not kill the run
  console.log('\nStep 3: Fetching SEC submissions...');
  const collected = []; // { accession, cik, formType, filedDate, periodOfReport, primaryDocument }
  const formCounts = { '10-K': 0, '10-Q': 0, '8-K': 0 };
  let failedIssuers = 0;
  const t0 = Date.now();

  for (let i = 0; i < sliced.length; i++) {
    const { cik } = sliced[i];
    const paddedCik = padCik(cik);

    try {
      const res = await secFetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`);
      if (!res.ok) {
        console.warn(`  WARN: cik=${paddedCik} → HTTP ${res.status}, skipping`);
        failedIssuers++;
        continue;
      }
      const submissionsJson = await res.json();
      const rows = extractFilings(paddedCik, submissionsJson);
      for (const row of rows) {
        collected.push(row);
        formCounts[row.formType]++;
      }
    } catch (err) {
      console.warn(`  WARN: cik=${paddedCik} → ${err.message}, skipping`);
      failedIssuers++;
    }

    const processed = i + 1;
    if (processed % 100 === 0 || processed === sliced.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  [${new Date().toISOString()}] processed=${processed}/${sliced.length}  ` +
        `rows_collected=${collected.length}  failed=${failedIssuers}  (${elapsed}s elapsed)`
      );
    }
  }

  const elapsedTotal = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  Fetch complete in ${elapsedTotal}s`);
  console.log(`  Issuers processed: ${sliced.length}`);
  console.log(`  Issuers failed:    ${failedIssuers}`);
  console.log(`  Total filing rows: ${collected.length}`);
  console.log(`  10-K: ${formCounts['10-K']}   10-Q: ${formCounts['10-Q']}   8-K: ${formCounts['8-K']}`);

  // 4. Dry-run exit — report counts and projected write cost, zero D1 writes
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    console.log(`  Projected D1 writes (index deferred, ×1): ${collected.length}`);
    console.log(`  Daily D1 write budget: 80,000`);
    if (collected.length > 80000) {
      console.log(`  >>> Over budget by ${collected.length - 80000} rows. Split across days with --offset/--limit.`);
    } else {
      console.log(`  Within single-day budget.`);
    }
    return;
  }

  // 5. Write — INSERT OR IGNORE, idempotent
  console.log('\nStep 4: Writing issuerfilingmaster...');
  const stmts = collected.map(f =>
    `INSERT OR IGNORE INTO issuerfilingmaster ` +
    `(accession_number, cik, form_type, filed_date, period_of_report, primary_document) ` +
    `VALUES (${esc(f.accession)}, ${esc(f.cik)}, ${esc(f.formType)}, ${esc(f.filedDate)}, ${esc(f.periodOfReport)}, ${esc(f.primaryDocument)})`
  );
  await runBatches(stmts, 'INSERT issuerfilingmaster');

  console.log('\n=== seed-issuerfilingmaster complete ===');
  console.log('Reminder: index creation is deferred. Once all offset batches are');
  console.log('done and writes_today is confirmed healthy, run separately:');
  console.log('  CREATE INDEX IF NOT EXISTS idx_issuerfilingmaster_cik_form');
  console.log('    ON issuerfilingmaster(cik, form_type);');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
