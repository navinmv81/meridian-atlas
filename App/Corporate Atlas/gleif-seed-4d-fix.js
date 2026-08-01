#!/usr/bin/env node
// Fix: resolve entity_id for entity_isin_map rows where entity_id IS NULL
// These correspond to LEIs whose entities couldn't be inserted due to UNIQUE(normalized_name, type) conflicts.
// Strategy: look up entity_id in entity_master by normalized_name (ignoring type if needed).

const fs = require('fs');

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN = '***REMOVED-CF-TOKEN-MA-AUG-004***';
const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;
const NOW = new Date().toISOString();

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function categoryToType(cat) {
  if (!cat) return 'operating';
  const c = cat.toUpperCase();
  if (c.includes('FUND')) return 'fund';
  if (c.includes('GOVERNMENT') || c.includes('GOV')) return 'government';
  if (c.includes('HOLDING')) return 'holding';
  if (c.includes('BRANCH') || c.includes('SPV') || c.includes('SPECIAL')) return 'spv';
  return 'operating';
}

async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL: ${sql.slice(0, 300)}`);
  return json;
}

async function d1Query(sql) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json.result[0].results;
}

async function runBatches(stmts, label) {
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done}/${stmts.length}`);
    }
  }
}

async function main() {
  const resolution = JSON.parse(fs.readFileSync('/tmp/gleif_resolution.json', 'utf8'));
  const { leiMap } = resolution;

  // Step 1: Find all distinct LEIs with entity_id IS NULL in entity_isin_map
  console.log('Finding unlinked LEIs in entity_isin_map...');
  const r = await d1Raw('SELECT DISTINCT lei FROM entity_isin_map WHERE entity_id IS NULL');
  const unlinkedLeis = r.result[0].results.rows.map(row => row[0]);
  console.log(`  Unlinked distinct LEIs: ${unlinkedLeis.length}`);

  if (unlinkedLeis.length === 0) {
    console.log('All rows already linked. Nothing to do.');
    return;
  }

  // Step 2: For each unlinked LEI, look up normalized_name from leiMap,
  // then find entity_id in entity_master by normalized_name
  // Fetch entire entity_master name→id map for the unlinked normalized names
  const normNames = [...new Set(
    unlinkedLeis
      .map(lei => leiMap[lei]?.entity?.normalized_name)
      .filter(Boolean)
  )];

  console.log(`  Distinct normalized names to look up: ${normNames.length}`);

  // Chunk the lookup into batches of 100 names to avoid giant SQL
  const normToEntityId = {};
  const CHUNK = 100;
  for (let i = 0; i < normNames.length; i += CHUNK) {
    const chunk = normNames.slice(i, i + CHUNK);
    const inList = chunk.map(n => esc(n)).join(', ');
    const rr = await d1Query(
      `SELECT entity_id, normalized_name FROM entity_master WHERE normalized_name IN (${inList}) LIMIT ${chunk.length * 5}`
    );
    for (const row of rr) {
      if (row.normalized_name && !normToEntityId[row.normalized_name]) {
        normToEntityId[row.normalized_name] = row.entity_id;
      }
    }
  }
  console.log(`  Normalized names resolved to entity_id: ${Object.keys(normToEntityId).length}`);

  // Step 3: For each unlinked LEI, determine entity_id and build UPDATE + GLEIF enrich stmts
  const backfillStmts = [];
  const enrichStmts = [];
  let resolved = 0, unresolved = 0;

  for (const lei of unlinkedLeis) {
    const entry = leiMap[lei];
    if (!entry) { unresolved++; continue; }
    const normName = entry.entity?.normalized_name;
    const entityId = normToEntityId[normName];
    if (!entityId) { unresolved++; continue; }

    resolved++;
    backfillStmts.push(
      `UPDATE entity_isin_map SET entity_id = ${entityId} WHERE lei = ${esc(lei)}`
    );

    // Also enrich this entity with GLEIF data (it was skipped by step 4a due to UNIQUE conflict)
    const e = entry.entity;
    enrichStmts.push(`UPDATE entity_master SET
      lei = ${esc(lei)},
      legal_name = ${esc(e.legal_name)},
      other_names = ${esc(e.other_names)},
      entity_category = ${esc(e.entity_category)},
      entity_status = ${esc(e.entity_status)},
      expiration_date = ${esc(e.expiration_date)},
      expiration_reason = ${esc(e.expiration_reason)},
      legal_address_line1 = ${esc(e.legal_address_line1)},
      legal_address_city = ${esc(e.legal_address_city)},
      legal_address_region = ${esc(e.legal_address_region)},
      legal_address_country = ${esc(e.legal_address_country)},
      legal_address_postcode = ${esc(e.legal_address_postcode)},
      hq_city = ${esc(e.hq_city)},
      hq_country = ${esc(e.hq_country)},
      legal_jurisdiction = ${esc(e.legal_jurisdiction)},
      legal_form_code = ${esc(e.legal_form_code)},
      legal_form_text = ${esc(e.legal_form_text)},
      business_register_id = ${esc(e.business_register_id)},
      registration_authority = ${esc(e.registration_authority)},
      lei_registration_status = ${esc(e.lei_registration_status)},
      lei_initial_registration = ${esc(e.lei_initial_registration)},
      lei_last_updated = ${esc(e.lei_last_updated)},
      lei_next_renewal = ${esc(e.lei_next_renewal)},
      lei_validation_source = ${esc(e.lei_validation_source)},
      gleif_last_updated = ${esc(NOW)},
      gleif_enrichment_version = 2,
      isin_match_count = ${entry.isin_count},
      match_source = 'isin_direct',
      has_etf_holdings = 1,
      etf_holding_count = ${entry.isin_count},
      updated_at = ${esc(NOW)}
    WHERE entity_id = ${entityId}`);
  }

  console.log(`\nResolved: ${resolved}, Unresolved: ${unresolved}`);

  if (backfillStmts.length > 0) {
    console.log(`\nBackfilling entity_isin_map (${backfillStmts.length} stmts)...`);
    await runBatches(backfillStmts, 'BACKFILL entity_isin_map');
  }

  if (enrichStmts.length > 0) {
    console.log(`\nEnriching pre-existing entities with GLEIF data (${enrichStmts.length} stmts)...`);
    await runBatches(enrichStmts, 'ENRICH entity_master');
  }

  // Final check
  const r2 = await d1Raw(
    'SELECT COUNT(CASE WHEN entity_id IS NOT NULL THEN 1 END) as linked, COUNT(*) as total FROM entity_isin_map'
  );
  const [linked, total] = r2.result[0].results.rows[0];
  console.log(`\nFinal entity_isin_map: ${linked} linked / ${total} total`);

  console.log('\nFix complete.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
