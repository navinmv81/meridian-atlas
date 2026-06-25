#!/usr/bin/env node
// ISIN backfill — populates entity_isin_map for the ~39,989 ISINs in
// fund_holdings_monthly that have no match yet.
// Step 2 (ISIN→LEI lookup) runs entirely against local gleif_local.db.
// Steps 1, 3, 4 use the Cloudflare D1 REST API.

const Database = require('better-sqlite3');
const path = require('path');

const ACCOUNT_ID   = 'ea36070477560935a68ad9110a2fd40b';
const DATABASE_ID  = '43e80149-5333-4917-b678-6a8218ca4f93';
const OAUTH_TOKEN  = 'cfoat_PIier3yr3MMx8FUGAAeV8Ddd0bkM0eBVGu_vakm0DW4.FnBToiNc9nl4xUXpZlPeHAifKg_ODtBDH0nzjgK5Ul8';
const GLEIF_DB     = path.join(__dirname, 'gleif_local.db');
const D1_URL       = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const BATCH_SIZE   = 50;
const PAGE_SIZE    = 5000;

// ── D1 REST helper ────────────────────────────────────────────────────────────
async function d1q(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OAUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.results ?? [];
}

// ── Category→type mapping (matches gleif-seed-4a.js exactly) ─────────────────
function categoryToType(cat) {
  if (!cat) return 'operating';
  const c = cat.toUpperCase();
  if (c.includes('FUND'))       return 'fund';
  if (c.includes('GOVERNMENT') || c.includes('GOV')) return 'government';
  if (c.includes('HOLDING'))    return 'holding';
  if (c.includes('BRANCH') || c.includes('SPV') || c.includes('SPECIAL')) return 'spv';
  return 'operating';
}

// ── Name normalization (matches entities-seed.js exactly) ─────────────────────
function normalizeName(name) {
  if (!name) return null;
  return name.toUpperCase().trim()
    .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Paginated fetch of all unmatched ISINs from D1 ───────────────────────────
async function fetchUnmatchedIsins() {
  console.log('Step 1 — Fetching unmatched ISINs from D1...');
  const allIsins = [];
  let offset = 0;
  while (true) {
    const rows = await d1q(
      `SELECT DISTINCT f.isin
       FROM fund_holdings_monthly f
       LEFT JOIN entity_isin_map e ON f.isin = e.isin
       WHERE f.isin IS NOT NULL AND e.isin IS NULL
       ORDER BY f.isin
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    );
    for (const r of rows) allIsins.push(r.isin);
    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
    console.log(`  ...${allIsins.length} ISINs fetched so far`);
  }
  console.log(`Step 1 complete — ${allIsins.length} unmatched ISINs\n`);
  return allIsins;
}

// ── ISIN→LEI lookup against local gleif_local.db ─────────────────────────────
function lookupIsins(isins) {
  console.log('Step 2 — Looking up ISINs in gleif_local.db...');
  const gleif = new Database(GLEIF_DB, { readonly: true });
  const stmt  = gleif.prepare('SELECT lei FROM isin_lei_map WHERE isin = ? LIMIT 1');

  const matched   = []; // [{isin, lei}]
  let noMatch     = 0;
  const REPORT_EVERY = 5000;

  for (let i = 0; i < isins.length; i++) {
    const row = stmt.get(isins[i]);
    if (row) {
      matched.push({ isin: isins[i], lei: row.lei });
    } else {
      noMatch++;
    }
    if ((i + 1) % REPORT_EVERY === 0) {
      console.log(`  ${i + 1} / ${isins.length} processed — ${matched.length} matched, ${noMatch} no-match`);
    }
  }

  gleif.close();
  console.log(`Step 2 complete — ${matched.length} matched, ${noMatch} no-match in GLEIF\n`);
  return matched;
}

// ── Ensure entity_master has stubs for all matched LEIs ──────────────────────
async function ensureEntities(matched) {
  console.log('Step 3 — Ensuring entity_master has entries for matched LEIs...');
  const gleif = new Database(GLEIF_DB, { readonly: true });
  const leiStmt = gleif.prepare('SELECT legal_name, entity_category, entity_status, legal_address_country FROM lei_records WHERE lei = ? LIMIT 1');

  // Get unique LEIs
  const uniqueLeis = [...new Set(matched.map(m => m.lei))];
  console.log(`  Unique distinct LEIs: ${uniqueLeis.length}`);

  // Batch-check which LEIs already exist in entity_master (50 at a time)
  const existingLeis = new Set();
  for (let i = 0; i < uniqueLeis.length; i += BATCH_SIZE) {
    const chunk = uniqueLeis.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await d1q(`SELECT lei FROM entity_master WHERE lei IN (${placeholders})`, chunk);
    for (const r of rows) existingLeis.add(r.lei);
  }
  console.log(`  Already in entity_master: ${existingLeis.size} / ${uniqueLeis.length}`);

  // For LEIs not yet in entity_master — look up gleif_local.db and insert stubs
  const toCreate = uniqueLeis.filter(lei => !existingLeis.has(lei));
  console.log(`  Stubs to create: ${toCreate.length}`);

  let created = 0;
  const REPORT_EVERY = 5000;

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const chunk = toCreate.slice(i, i + BATCH_SIZE);
    for (const lei of chunk) {
      const rec = leiStmt.get(lei);
      if (!rec || !rec.legal_name) continue; // skip if not in lei_records
      const name     = rec.legal_name;
      const normName = normalizeName(name);
      const type     = categoryToType(rec.entity_category);
      const status   = rec.entity_status ?? 'ACTIVE';
      const country  = rec.legal_address_country ?? null;
      await d1q(
        `INSERT OR IGNORE INTO entity_master (name, normalized_name, type, lei, lei_status, country, gleif_enrichment_version)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [name, normName, type, lei, status, country]
      );
      created++;
    }
    if (Math.floor((i + BATCH_SIZE) / REPORT_EVERY) > Math.floor(i / REPORT_EVERY)) {
      console.log(`  ...${Math.min(i + BATCH_SIZE, toCreate.length)} / ${toCreate.length} LEIs processed, ${created} stubs created`);
    }
  }

  gleif.close();
  console.log(`Step 3 complete — ${created} new entity stubs created\n`);
  return created;
}

// ── Insert entity_isin_map rows ───────────────────────────────────────────────
async function insertIsinMap(matched) {
  console.log('Step 4 — Inserting entity_isin_map rows...');

  // Resolve entity_id for each unique LEI in one pass (batched)
  const uniqueLeis = [...new Set(matched.map(m => m.lei))];
  const leiToEntityId = new Map();

  for (let i = 0; i < uniqueLeis.length; i += BATCH_SIZE) {
    const chunk = uniqueLeis.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await d1q(
      `SELECT lei, entity_id FROM entity_master WHERE lei IN (${placeholders})`,
      chunk
    );
    for (const r of rows) leiToEntityId.set(r.lei, r.entity_id);
  }
  console.log(`  entity_id resolved for ${leiToEntityId.size} LEIs`);

  let inserted = 0;
  const REPORT_EVERY = 5000;

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const chunk = matched.slice(i, i + BATCH_SIZE);
    for (const { isin, lei } of chunk) {
      const entity_id = leiToEntityId.get(lei);
      if (!entity_id) continue; // LEI not in entity_master (no lei_records entry)
      await d1q(
        `INSERT OR IGNORE INTO entity_isin_map (isin, lei, entity_id) VALUES (?, ?, ?)`,
        [isin, lei, entity_id]
      );
      inserted++;
    }
    if (Math.floor((i + BATCH_SIZE) / REPORT_EVERY) > Math.floor(i / REPORT_EVERY)) {
      console.log(`  ...${Math.min(i + BATCH_SIZE, matched.length)} / ${matched.length} pairs processed, ${inserted} inserted`);
    }
  }

  console.log(`Step 4 complete — ${inserted} entity_isin_map rows inserted\n`);
  return inserted;
}

// ── Verification via wrangler (shell out) ─────────────────────────────────────
async function verify() {
  console.log('Step 5 — Verification queries (via D1)...');
  const [mapCount] = await d1q('SELECT COUNT(*) as cnt FROM entity_isin_map');
  const [unmatch]  = await d1q(`
    SELECT COUNT(*) as cnt
    FROM (SELECT DISTINCT isin FROM fund_holdings_monthly WHERE isin IS NOT NULL) f
    LEFT JOIN entity_isin_map e ON f.isin = e.isin
    WHERE e.isin IS NULL`);
  const [emCount]  = await d1q('SELECT COUNT(*) as cnt FROM entity_master');
  console.log(`  entity_isin_map total:       ${mapCount.cnt}`);
  console.log(`  Remaining unmatched ISINs:   ${unmatch.cnt}`);
  console.log(`  entity_master total:         ${emCount.cnt}`);
  return { mapCount: mapCount.cnt, unmatch: unmatch.cnt, emCount: emCount.cnt };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ISIN Backfill — entity_isin_map ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Baselines
  console.log('--- Baselines ---');
  const [b1] = await d1q('SELECT COUNT(*) as cnt FROM entity_isin_map');
  const [b2] = await d1q('SELECT COUNT(*) as cnt FROM entity_master');
  console.log(`  entity_isin_map before: ${b1.cnt}`);
  console.log(`  entity_master before:   ${b2.cnt}\n`);

  const isins   = await fetchUnmatchedIsins();
  const matched = lookupIsins(isins);

  if (matched.length === 0) {
    console.log('No matches found in GLEIF — nothing to insert.');
    return;
  }

  await ensureEntities(matched);
  const inserted = await insertIsinMap(matched);

  console.log('--- Final Verification ---');
  const v = await verify();

  console.log('\n=== Summary ===');
  console.log(`Step 1 — Unmatched ISINs found:   ${isins.length}`);
  console.log(`Step 2 — GLEIF matches:            ${matched.length} / ${isins.length} (${(matched.length/isins.length*100).toFixed(1)}%)`);
  console.log(`Step 3 — New entity stubs:         (see above)`);
  console.log(`Step 4 — entity_isin_map inserted: ${inserted}`);
  console.log(`Step 5 — entity_isin_map after:    ${v.mapCount} (was ${b1.cnt})`);
  console.log(`         Remaining unmatched:       ${v.unmatch}`);
  console.log(`         entity_master after:       ${v.emCount} (was ${b2.cnt})`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
