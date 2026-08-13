#!/usr/bin/env node
// seed-issuereventstream.js
// Populates issuereventstream from SEC EDGAR submissions API `items` field —
// priority 8-K item codes only (1.01, 2.02, 5.02, 8.01), scoped to 8-K
// accessions already present in issuerfilingmaster (1-year lookback already
// applied there). One row per (accession, item_code) pair.
//
// Domain: Filings (owned by Equities Lead). Must not be written to by any
// ETF or Entities pipeline.
//
// One SEC fetch per distinct issuer CIK (not per filing) — the submissions
// API returns item codes for all of an issuer's recent filings in a single
// payload, the same payload seed-issuerfilingmaster.js already fetches.
//
// BUDGET: issuereventstream has 2 indexes (INTEGER PK + UNIQUE constraint).
// Every INSERT costs 3 Cloudflare write-ops (1 base + 1 PK index + 1 UNIQUE index).
// Empirical sample (21 issuers, 2,945 8-K filings, Sprint 2 diagnostic):
// ~0.83 priority-item rows per 8-K filing → ~16 rows/issuer average.
// Full backfill projection: 2,884 issuers x ~16 rows/issuer =~ 46,000 rows =~ 138,000 writes.
// Daily D1 write budget: 80,000 (per seed-issuerfilingmaster.js convention — NOT
// reconciled with seed-financialfact.js's ~40,000 assumption; confirm before scaling).
// Reserving ~20,000 writes/day for ETF cron leaves ~60,000 writes/day here.
// Safe daily rows =~ 60,000 / 3 =~ 20,000 rows =~ 1,250 issuers/day at the empirical ratio.
// Plan --limit accordingly; full backfill needs ~3 phases via --offset/--limit.
//
// Index creation (idx_issuereventstream_cik) is deliberately deferred until
// after the bulk backfill completes — see
// ETF Refresh/migrations/sprint2-issuereventstream.sql.
//
// Usage:
//   node seed-issuereventstream.js --dry-run
//   node seed-issuereventstream.js --dry-run --limit=50
//   node seed-issuereventstream.js --limit=1250
//   node seed-issuereventstream.js --offset=1250 --limit=1250

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── D1 config (meridian-etf database — same as seed-managermaster.js) ────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

const SEC_UA = 'MeridianAtlas contact@meridianatlas.com';
const SEC_RATE_LIMIT_MS = 150;

// ── Priority item codes — silently drop anything else ────────────────────────
const PRIORITY_ITEMS = {
  '1.01': 'Entry into a Material Definitive Agreement',
  '2.02': 'Results of Operations and Financial Condition',
  '5.02': 'Departure/Appointment of Directors or Officers',
  '8.01': 'Other Events',
};

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

function escNum(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'NULL';
  return String(v);
}

function padCik(cik) {
  if (!cik) return null;
  return String(cik).trim().replace(/^0+/, '').padStart(10, '0');
}

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
// Pulls priority-item-code rows for one issuer's 8-Ks from a submissions.json
// payload, scoped to accessions already present in issuerfilingmaster (the
// dbAccessions set) so the 1-year lookback stays consistent with that table.
function extractPriorityEvents(cik, entityId, submissionsJson, dbAccessions) {
  const recent = submissionsJson?.filings?.recent;
  if (!recent || !Array.isArray(recent.accessionNumber)) return [];

  const rows = [];
  for (let i = 0; i < recent.accessionNumber.length; i++) {
    if (recent.form[i] !== '8-K') continue;
    const accession = recent.accessionNumber[i];
    if (!dbAccessions.has(accession)) continue;

    const items = String(recent.items?.[i] || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const itemCode of items) {
      const itemLabel = PRIORITY_ITEMS[itemCode];
      if (!itemLabel) continue; // drop non-priority codes silently

      rows.push({
        cik,
        entityId,
        accession,
        itemCode,
        itemLabel,
        filedDate: recent.filingDate[i],
        periodOfReport: recent.reportDate?.[i] || null,
      });
    }
  }
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n=== seed-issuereventstream  dry-run=${DRY_RUN}  limit=${LIMIT ?? 'none'}  ` +
    `offset=${OFFSET} ===\n`
  );

  // 1. Ensure table exists (idempotent — safe to re-run on existing DB)
  if (!DRY_RUN) {
    console.log('Step 1: Ensuring table exists...');
    await d1Raw(`
      CREATE TABLE IF NOT EXISTS issuereventstream (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        cik              TEXT NOT NULL,
        entity_id        INTEGER,
        accession_number TEXT NOT NULL,
        item_code        TEXT NOT NULL,
        item_label       TEXT,
        filed_date       TEXT,
        period_of_report TEXT,
        UNIQUE(accession_number, item_code)
      )
    `);
    console.log('  Table ready. (Index creation deferred — run separately after backfill.)');
  }

  // 2. Fetch 8-K rows from issuerfilingmaster, grouped by cik.
  //    Gives us both the distinct issuer CIK list (2,884) and, per issuer, the
  //    accession set that scopes which submissions.json rows are in-window.
  console.log('\nStep 2: Fetching 8-K accessions from issuerfilingmaster...');
  const filingRows = await d1Select(
    `SELECT cik, accession_number FROM issuerfilingmaster WHERE form_type = '8-K'`
  );
  const accessionsByCik = new Map();
  for (const { cik, accession_number } of filingRows) {
    if (!accessionsByCik.has(cik)) accessionsByCik.set(cik, new Set());
    accessionsByCik.get(cik).add(accession_number);
  }
  const allCiks = [...accessionsByCik.keys()].sort();
  console.log(`  8-K rows: ${filingRows.length}  Distinct issuer CIKs: ${allCiks.length}`);

  // 3. Fetch entity_master, build cik → entity_id map
  console.log('\nStep 3: Fetching entity_master for cik → entity_id map...');
  const entityRows = await d1Select(
    `SELECT entity_id, cik FROM entity_master WHERE cik IS NOT NULL`
  );
  const entityIdByCik = new Map();
  for (const t of entityRows) {
    entityIdByCik.set(padCik(t.cik), t.entity_id);
  }
  console.log(`  Issuers with cik: ${entityRows.length}`);

  const sliced = allCiks.slice(OFFSET, LIMIT ? OFFSET + LIMIT : undefined);
  console.log(`  Processing: offset=${OFFSET}  count=${sliced.length}`);

  // 4. Walk issuers sequentially — one 404/timeout must not kill the run
  console.log('\nStep 4: Fetching SEC submissions...');
  const collected = []; // { cik, entityId, accession, itemCode, itemLabel, filedDate, periodOfReport }
  const itemCounts = Object.fromEntries(Object.keys(PRIORITY_ITEMS).map(code => [code, 0]));
  let failedIssuers = 0;
  const t0 = Date.now();

  for (let i = 0; i < sliced.length; i++) {
    const cik = sliced[i];
    const dbAccessions = accessionsByCik.get(cik);
    const entityId = entityIdByCik.get(cik) ?? null;

    try {
      const res = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
      if (!res.ok) {
        console.warn(`  WARN: cik=${cik} → HTTP ${res.status}, skipping`);
        failedIssuers++;
        continue;
      }
      const submissionsJson = await res.json();
      const rows = extractPriorityEvents(cik, entityId, submissionsJson, dbAccessions);
      for (const row of rows) {
        collected.push(row);
        itemCounts[row.itemCode]++;
      }
    } catch (err) {
      console.warn(`  WARN: cik=${cik} → ${err.message}, skipping`);
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
  console.log(`  Total event rows:  ${collected.length}`);
  console.log('  By item code:');
  for (const code of Object.keys(PRIORITY_ITEMS)) {
    console.log(`    ${code} (${PRIORITY_ITEMS[code]}): ${itemCounts[code]}`);
  }

  // 5. Dry-run exit — report counts and projected write cost, zero D1 writes
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    const projectedWrites = collected.length * 3; // base row + PK index + UNIQUE index
    console.log(`  Projected Cloudflare writes (×3 index multiplier): ${projectedWrites}`);
    console.log(`  Safe daily budget (rows): ~20,000 (see BUDGET comment at top of file)`);
    if (collected.length > 20000) {
      console.log(`  >>> Over safe daily row budget by ${collected.length - 20000} rows. Split across days with --offset/--limit.`);
    } else {
      console.log(`  Within safe daily row budget.`);
    }
    return;
  }

  // 6. Write — INSERT OR IGNORE, idempotent
  console.log('\nStep 5: Writing issuereventstream...');
  const stmts = collected.map(r =>
    `INSERT OR IGNORE INTO issuereventstream ` +
    `(cik, entity_id, accession_number, item_code, item_label, filed_date, period_of_report) ` +
    `VALUES (${esc(r.cik)}, ${escNum(r.entityId)}, ${esc(r.accession)}, ${esc(r.itemCode)}, ${esc(r.itemLabel)}, ` +
    `${esc(r.filedDate)}, ${esc(r.periodOfReport)})`
  );
  await runBatches(stmts, 'INSERT issuereventstream');

  console.log('\n=== seed-issuereventstream complete ===');
  console.log('Reminder: index creation is deferred. Once all offset batches are');
  console.log('done and writes_today is confirmed healthy, run separately:');
  console.log('  CREATE INDEX IF NOT EXISTS idx_issuereventstream_cik');
  console.log('    ON issuereventstream(cik, filed_date DESC);');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
