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
//   node seed-financialfact.js --phase1 --dry-run
//   node seed-financialfact.js --phase1
//
// --phase1: Sprint 2 scope. Caps the run at the first 500 issuers in
// priority order (9 hardcoded PRIORITY_CIKS, then entity_id ASC for the
// remaining 491). Overrides any manually-passed --limit.

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
const LIMIT  = PHASE1 ? PHASE1_NON_PRIORITY_LIMIT : (args.limit ? parseInt(args.limit, 10) : null);
const OFFSET = args.offset ? parseInt(args.offset, 10) : 0;

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
  console.log(
    `\n=== seed-financialfact  dry-run=${DRY_RUN}  limit=${LIMIT ?? 'none'}  ` +
    `offset=${OFFSET}  cutoff=${CUTOFF_STR} ===\n`
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
  await runBatches(stmts, 'INSERT financialfact_reported');

  console.log('\n=== seed-financialfact complete ===');
  console.log('Reminder: index creation is deferred. Once all offset batches are');
  console.log('done and writes_today is confirmed healthy, run separately:');
  console.log('  CREATE INDEX IF NOT EXISTS idx_financialfact_cik_tag');
  console.log('    ON financialfact_reported(cik, xbrl_tag);');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
