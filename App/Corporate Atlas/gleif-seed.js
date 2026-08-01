#!/usr/bin/env node
// Phase 4: Write resolved GLEIF data to D1
// Uses Cloudflare D1 REST API /raw endpoint with 50-statement batches.

const fs = require('fs');
const path = require('path');

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

function escNum(v, def = 0) {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL: ${sql.slice(0, 200)}`);
  }
  return json;
}

async function runBatches(stmts, label) {
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    const sql = chunk.join(';\n');
    await d1Raw(sql);
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done}/${stmts.length}`);
    }
  }
}

async function main() {
  // Load resolution data
  const resolution = JSON.parse(fs.readFileSync('/tmp/gleif_resolution.json', 'utf8'));
  const { leiMap, leiToEntityId, normNameToEntityId, stats } = resolution;

  console.log(`Loaded resolution data:`);
  console.log(`  Distinct LEIs: ${Object.keys(leiMap).length}`);
  console.log(`  Existing entity_master with LEI: ${Object.keys(leiToEntityId).length}`);

  // ── Step 4a: INSERT new entities ──────────────────────────────────────────
  console.log('\nStep 4a: Inserting new entities...');
  const newEntityInserts = [];
  const newLeis = [];

  for (const [lei, entry] of Object.entries(leiMap)) {
    if (leiToEntityId[lei]) continue; // already exists
    const e = entry.entity;
    newLeis.push(lei);

    const stmt = `INSERT OR IGNORE INTO entity_master (
      name, type, lei, country, normalized_name, lei_status,
      legal_name, other_names, entity_category, entity_status,
      expiration_date, expiration_reason,
      legal_address_line1, legal_address_city, legal_address_region,
      legal_address_country, legal_address_postcode,
      hq_city, hq_country, legal_jurisdiction,
      legal_form_code, legal_form_text,
      business_register_id, registration_authority,
      lei_registration_status, lei_initial_registration, lei_last_updated,
      lei_next_renewal, lei_validation_source,
      gleif_last_updated, gleif_enrichment_version,
      isin_match_count, match_source,
      has_etf_holdings, etf_holding_count,
      created_at, updated_at
    ) VALUES (
      ${esc(e.legal_name)}, 'company', ${esc(lei)}, ${esc(e.legal_address_country)},
      ${esc(e.normalized_name)}, ${esc(e.lei_registration_status)},
      ${esc(e.legal_name)}, ${esc(e.other_names)}, ${esc(e.entity_category)},
      ${esc(e.entity_status)}, ${esc(e.expiration_date)}, ${esc(e.expiration_reason)},
      ${esc(e.legal_address_line1)}, ${esc(e.legal_address_city)}, ${esc(e.legal_address_region)},
      ${esc(e.legal_address_country)}, ${esc(e.legal_address_postcode)},
      ${esc(e.hq_city)}, ${esc(e.hq_country)}, ${esc(e.legal_jurisdiction)},
      ${esc(e.legal_form_code)}, ${esc(e.legal_form_text)},
      ${esc(e.business_register_id)}, ${esc(e.registration_authority)},
      ${esc(e.lei_registration_status)}, ${esc(e.lei_initial_registration)}, ${esc(e.lei_last_updated)},
      ${esc(e.lei_next_renewal)}, ${esc(e.lei_validation_source)},
      ${esc(NOW)}, 2,
      ${escNum(entry.isin_count)}, 'isin_direct',
      1, ${escNum(entry.isin_count)},
      ${esc(NOW)}, ${esc(NOW)}
    )`;
    newEntityInserts.push(stmt);
  }

  console.log(`  New entities to insert: ${newEntityInserts.length}`);
  await runBatches(newEntityInserts, 'INSERT entity_master');

  // ── Step 4b: UPDATE existing entities ────────────────────────────────────
  console.log('\nStep 4b: Updating existing entities...');
  const existingUpdates = [];

  for (const [lei, entry] of Object.entries(leiMap)) {
    if (!leiToEntityId[lei]) continue;
    const e = entry.entity;
    const entityId = leiToEntityId[lei];

    const stmt = `UPDATE entity_master SET
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
      isin_match_count = ${escNum(entry.isin_count)},
      match_source = 'isin_direct',
      has_etf_holdings = 1,
      etf_holding_count = ${escNum(entry.isin_count)},
      updated_at = ${esc(NOW)}
    WHERE entity_id = ${entityId}`;
    existingUpdates.push(stmt);
  }

  console.log(`  Existing entities to update: ${existingUpdates.length}`);
  await runBatches(existingUpdates, 'UPDATE entity_master');

  // ── Step 4c: Write entity_isin_map (without entity_id first) ─────────────
  console.log('\nStep 4c: Writing entity_isin_map...');
  const isinMapInserts = [];

  for (const [lei, entry] of Object.entries(leiMap)) {
    for (const isin of entry.matched_isins) {
      // entity_id will be set after step 4d
      const stmt = `INSERT OR IGNORE INTO entity_isin_map (isin, lei, match_source, confidence, mapped_at)
        VALUES (${esc(isin)}, ${esc(lei)}, 'isin_direct', 100, ${esc(NOW)})`;
      isinMapInserts.push(stmt);
    }
  }

  console.log(`  entity_isin_map rows to insert: ${isinMapInserts.length}`);
  await runBatches(isinMapInserts, 'INSERT entity_isin_map');

  // ── Step 4d: Retrieve assigned entity_ids ─────────────────────────────────
  console.log('\nStep 4d: Retrieving entity_ids for newly inserted entities...');
  const r = await d1Raw('SELECT entity_id, lei FROM entity_master WHERE gleif_enrichment_version = 2');
  const newEntityRows = r.result[0].results.rows;
  console.log(`  Retrieved ${newEntityRows.length} entities with gleif_enrichment_version = 2`);

  // Build lei → entity_id map from new results
  const allLeiToEntityId = { ...leiToEntityId };
  for (const [entityId, lei] of newEntityRows) {
    allLeiToEntityId[lei] = entityId;
  }

  // Backfill entity_id in entity_isin_map
  console.log('  Backfilling entity_id in entity_isin_map...');
  const backfillUpdates = [];
  for (const [lei, entry] of Object.entries(leiMap)) {
    const entityId = allLeiToEntityId[lei];
    if (!entityId) continue;
    const stmt = `UPDATE entity_isin_map SET entity_id = ${entityId} WHERE lei = ${esc(lei)}`;
    backfillUpdates.push(stmt);
  }

  console.log(`  Backfill updates: ${backfillUpdates.length}`);
  await runBatches(backfillUpdates, 'BACKFILL entity_isin_map.entity_id');

  console.log('\nPhase 4 complete.');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
