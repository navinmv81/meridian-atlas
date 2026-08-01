#!/usr/bin/env node
// Phase 4a retry: INSERT new entities with correct type mapping

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

function escNum(v, def = 0) {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

// Map GLEIF entity_category to entity_master type CHECK constraint
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
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL snippet: ${sql.slice(0, 300)}`);
  }
  return json;
}

async function runBatches(stmts, label) {
  let done = 0;
  let errors = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    const sql = chunk.join(';\n');
    try {
      await d1Raw(sql);
    } catch (e) {
      errors++;
      console.error(`  ERROR in batch at offset ${i}: ${e.message.slice(0, 200)}`);
      if (errors > 3) { console.error('Too many errors, aborting'); process.exit(1); }
    }
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done}/${stmts.length}`);
    }
  }
}

async function main() {
  const resolution = JSON.parse(fs.readFileSync('/tmp/gleif_resolution.json', 'utf8'));
  const { leiMap, leiToEntityId } = resolution;

  // Build list of new entities (not yet in entity_master)
  const newEntityInserts = [];

  for (const [lei, entry] of Object.entries(leiMap)) {
    if (leiToEntityId[lei]) continue;
    const e = entry.entity;
    const entityType = categoryToType(e.entity_category);

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
      ${esc(e.legal_name)}, ${esc(entityType)}, ${esc(lei)}, ${esc(e.legal_address_country)},
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

  console.log(`New entities to insert (with corrected type): ${newEntityInserts.length}`);
  await runBatches(newEntityInserts, 'INSERT entity_master');

  // Verify count after insert
  const r = await d1Raw('SELECT COUNT(*) as cnt FROM entity_master');
  const cnt = r.result[0].results.rows[0][0];
  console.log(`\nentity_master total after insert: ${cnt}`);

  // Step 4d: Get entity_ids for all version=2 entities and backfill entity_isin_map
  console.log('\nStep 4d: Retrieving entity_ids for version=2 entities...');
  const r2 = await d1Raw('SELECT entity_id, lei FROM entity_master WHERE gleif_enrichment_version = 2');
  const v2rows = r2.result[0].results.rows;
  console.log(`  Entities with gleif_enrichment_version=2: ${v2rows.length}`);

  // Build lei → entity_id from fresh query
  const freshLeiToId = {};
  for (const [entityId, lei] of v2rows) {
    if (lei) freshLeiToId[lei] = entityId;
  }

  // Backfill entity_isin_map entity_id for newly inserted entities
  const backfillStmts = [];
  for (const [lei, entityId] of Object.entries(freshLeiToId)) {
    if (leiToEntityId[lei]) continue; // already backfilled in step 4d original run
    backfillStmts.push(`UPDATE entity_isin_map SET entity_id = ${entityId} WHERE lei = ${esc(lei)}`);
  }

  console.log(`  New backfill updates: ${backfillStmts.length}`);
  if (backfillStmts.length > 0) {
    await runBatches(backfillStmts, 'BACKFILL entity_isin_map.entity_id (new)');
  }

  // Also need to backfill existing entities (leiToEntityId) that weren't in entity_isin_map yet
  console.log('\nStep 4d: Checking entity_isin_map fully_linked count...');
  const r3 = await d1Raw('SELECT COUNT(CASE WHEN entity_id IS NOT NULL THEN 1 END) as linked, COUNT(*) as total FROM entity_isin_map');
  const [linked, total] = r3.result[0].results.rows[0];
  console.log(`  entity_isin_map: ${linked} linked / ${total} total`);

  console.log('\nPhase 4 complete (retry).');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
