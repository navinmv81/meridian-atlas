#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const WORK_DIR = __dirname;
const DB_PATH = path.join(WORK_DIR, 'gleif_local.db');

function normalizeName(name) {
  if (!name) return null;
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const db = new Database(DB_PATH, { readonly: true });

// ── Load D1 data from local JSON files ──────────────────────────────────────
const isinRows = JSON.parse(fs.readFileSync('/tmp/d1_isins.json', 'utf8'))[0].results;
const unmatchedRows = JSON.parse(fs.readFileSync('/tmp/d1_unmatched_instruments.json', 'utf8'))[0].results;
const entityMasterRows = JSON.parse(fs.readFileSync('/tmp/d1_entity_master.json', 'utf8'))[0].results;

console.log(`D1 ISINs loaded: ${isinRows.length.toLocaleString()}`);
console.log(`D1 no-ISIN instruments loaded: ${unmatchedRows.length.toLocaleString()}`);
console.log(`D1 entity_master rows loaded: ${entityMasterRows.length.toLocaleString()}`);

// ── Step 2b: Resolve ISINs via isin_lei_map ──────────────────────────────────
const isinLeiQuery = db.prepare(`
  SELECT isl.lei, lr.lei as lei2, lr.legal_name, lr.other_names,
    lr.legal_address_line1, lr.legal_address_city, lr.legal_address_region,
    lr.legal_address_country, lr.legal_address_postcode,
    lr.hq_city, lr.hq_country, lr.legal_jurisdiction,
    lr.legal_form_code, lr.legal_form_text, lr.entity_category,
    lr.entity_status, lr.expiration_date, lr.expiration_reason,
    lr.registration_authority, lr.business_register_id,
    lr.lei_registration_status, lr.lei_initial_registration,
    lr.lei_last_updated, lr.lei_next_renewal, lr.lei_validation_source,
    lr.normalized_name
  FROM isin_lei_map isl
  JOIN lei_records lr ON isl.lei = lr.lei
  WHERE isl.isin = ?
`);

// lei → { lei, entity, matched_isins, isin_count }
const leiMap = new Map();
const matchedIsins = new Set();
const unmatchedIsinSet = new Set();

for (const { isin } of isinRows) {
  const hits = isinLeiQuery.all(isin);
  if (hits.length === 0) {
    unmatchedIsinSet.add(isin);
    continue;
  }
  matchedIsins.add(isin);
  for (const row of hits) {
    const lei = row.lei;
    if (!leiMap.has(lei)) {
      leiMap.set(lei, {
        lei,
        entity: row,
        matched_isins: [isin],
        isin_count: 1,
      });
    } else {
      const entry = leiMap.get(lei);
      if (!entry.matched_isins.includes(isin)) {
        entry.matched_isins.push(isin);
        entry.isin_count = entry.matched_isins.length;
      }
    }
  }
}

console.log(`\nISIN resolution summary:`);
console.log(`  Total distinct ISINs from D1: ${isinRows.length.toLocaleString()}`);
console.log(`  Matched via ISIN file: ${matchedIsins.size.toLocaleString()}`);
console.log(`  Unmatched (going to name fallback): ${unmatchedIsinSet.size.toLocaleString()}`);
console.log(`  Distinct LEIs resolved: ${leiMap.size.toLocaleString()}`);

// ── Step 2c: Name fallback for unmatched ISINs ───────────────────────────────
const nameQuery = db.prepare(`
  SELECT lei, legal_name, entity_status, legal_jurisdiction, normalized_name
  FROM lei_records
  WHERE normalized_name = ?
  LIMIT 5
`);

const reviewMatches = [];

// Also process instruments with no ISIN at all
const allUnmatched = [
  ...[...unmatchedIsinSet].map(isin => ({ isin, cusip: null, security_name: null })),
  ...unmatchedRows,
];

for (const row of allUnmatched) {
  const name = row.security_name;
  if (!name) continue;
  const norm = normalizeName(name);
  if (!norm) continue;
  const hits = nameQuery.all(norm);
  for (const hit of hits) {
    // Simple confidence: exact normalized match = 80
    const confidence = 80;
    if (confidence >= 80) {
      reviewMatches.push({
        isin: row.isin || null,
        cusip: row.cusip || null,
        security_name: name,
        normalized_name: norm,
        confidence,
        lei: hit.lei,
        legal_name: hit.legal_name,
        entity_status: hit.entity_status,
        legal_jurisdiction: hit.legal_jurisdiction,
        match_source: 'name_fallback',
      });
    }
  }
}

fs.writeFileSync(path.join(WORK_DIR, 'seed-review.json'), JSON.stringify(reviewMatches, null, 2));
console.log(`  Name fallback matches written to seed-review.json: ${reviewMatches.length}`);

// ── Step 2d: Build deduplication maps from entity_master ─────────────────────
const leiToEntityId = new Map();
const normNameToEntityId = new Map();

for (const row of entityMasterRows) {
  if (row.lei) leiToEntityId.set(row.lei, row.entity_id);
  if (row.normalized_name) normNameToEntityId.set(row.normalized_name, row.entity_id);
}

console.log(`\nDeduplication maps:`);
console.log(`  lei → entity_id entries: ${leiToEntityId.size.toLocaleString()}`);
console.log(`  normalized_name → entity_id entries: ${normNameToEntityId.size.toLocaleString()}`);
console.log(`  Existing entity_master rows: ${entityMasterRows.length.toLocaleString()}`);

// Save resolution results for Phase 4
const resolutionOutput = {
  leiMap: Object.fromEntries(leiMap),
  leiToEntityId: Object.fromEntries(leiToEntityId),
  normNameToEntityId: Object.fromEntries(normNameToEntityId),
  unmatchedIsins: [...unmatchedIsinSet],
  stats: {
    totalIsins: isinRows.length,
    matchedIsins: matchedIsins.size,
    unmatchedIsins: unmatchedIsinSet.size,
    distinctLeis: leiMap.size,
    existingEntityMasterRows: entityMasterRows.length,
  }
};

fs.writeFileSync('/tmp/gleif_resolution.json', JSON.stringify(resolutionOutput));
console.log(`\nResolution data saved to /tmp/gleif_resolution.json`);

db.close();
