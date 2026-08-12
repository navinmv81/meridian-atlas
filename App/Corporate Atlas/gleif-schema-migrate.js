#!/usr/bin/env node
// Phase 3: Schema migration on D1
// Run each ALTER TABLE individually, catch duplicate column errors silently.
//
// NOTE (5 August 2026): this is a one-time migration script, already run
// against production — kept as-is as a historical record, not a live
// reference. The entity_master indexes it creates below (idx_entity_master_
// status/_jurisdiction/_direct_parent/_ultimate_parent/_match_source) are
// now also listed in migrations/corporate-atlas-v1.sql, which is the
// canonical source of truth for entity_master's current index set going
// forward. Don't edit the index list here expecting it to reflect anywhere
// else — update corporate-atlas-v1.sql instead.

const { execSync } = require('child_process');
const path = require('path');

const WORK_DIR = __dirname;

function d1exec(sql) {
  const cmd = `wrangler d1 execute meridian-etf --remote --json --command=${JSON.stringify(sql)}`;
  try {
    const out = execSync(cmd, { cwd: WORK_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output: out.toString() };
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    const combined = stderr + stdout;
    if (combined.includes('duplicate column') || combined.includes('already exists')) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: combined };
  }
}

const alterStatements = [
  // Identity
  'ALTER TABLE entity_master ADD COLUMN legal_name TEXT',
  'ALTER TABLE entity_master ADD COLUMN other_names TEXT',
  // Classification
  'ALTER TABLE entity_master ADD COLUMN entity_category TEXT',
  'ALTER TABLE entity_master ADD COLUMN entity_status TEXT',
  'ALTER TABLE entity_master ADD COLUMN expiration_date TEXT',
  'ALTER TABLE entity_master ADD COLUMN expiration_reason TEXT',
  // Legal address
  'ALTER TABLE entity_master ADD COLUMN legal_address_line1 TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_address_city TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_address_region TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_address_country TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_address_postcode TEXT',
  // Headquarters
  'ALTER TABLE entity_master ADD COLUMN hq_city TEXT',
  'ALTER TABLE entity_master ADD COLUMN hq_country TEXT',
  // Incorporation
  'ALTER TABLE entity_master ADD COLUMN legal_jurisdiction TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_form_code TEXT',
  'ALTER TABLE entity_master ADD COLUMN legal_form_text TEXT',
  // Registration
  'ALTER TABLE entity_master ADD COLUMN business_register_id TEXT',
  'ALTER TABLE entity_master ADD COLUMN registration_authority TEXT',
  // LEI metadata
  'ALTER TABLE entity_master ADD COLUMN lei_registration_status TEXT',
  'ALTER TABLE entity_master ADD COLUMN lei_initial_registration TEXT',
  'ALTER TABLE entity_master ADD COLUMN lei_last_updated TEXT',
  'ALTER TABLE entity_master ADD COLUMN lei_next_renewal TEXT',
  'ALTER TABLE entity_master ADD COLUMN lei_validation_source TEXT',
  // Identifiers
  'ALTER TABLE entity_master ADD COLUMN bic_codes TEXT',
  'ALTER TABLE entity_master ADD COLUMN primary_ticker TEXT',
  // Ownership — direct parent
  'ALTER TABLE entity_master ADD COLUMN direct_parent_lei TEXT',
  'ALTER TABLE entity_master ADD COLUMN direct_parent_name TEXT',
  'ALTER TABLE entity_master ADD COLUMN direct_parent_relationship_status TEXT',
  'ALTER TABLE entity_master ADD COLUMN direct_parent_period_start TEXT',
  'ALTER TABLE entity_master ADD COLUMN direct_parent_exception TEXT',
  // Ownership — ultimate parent
  'ALTER TABLE entity_master ADD COLUMN ultimate_parent_lei TEXT',
  'ALTER TABLE entity_master ADD COLUMN ultimate_parent_name TEXT',
  'ALTER TABLE entity_master ADD COLUMN ultimate_parent_relationship_status TEXT',
  'ALTER TABLE entity_master ADD COLUMN ultimate_parent_exception TEXT',
  // Cross-module flags
  'ALTER TABLE entity_master ADD COLUMN has_etf_holdings INTEGER DEFAULT 0',
  'ALTER TABLE entity_master ADD COLUMN etf_holding_count INTEGER DEFAULT 0',
  'ALTER TABLE entity_master ADD COLUMN has_13f_filings INTEGER DEFAULT 0',
  'ALTER TABLE entity_master ADD COLUMN has_market_data INTEGER DEFAULT 0',
  // NOTE: primary_ticker duplicate in spec (line 291) — caught silently as duplicate
  // Data quality
  'ALTER TABLE entity_master ADD COLUMN gleif_last_updated TEXT',
  'ALTER TABLE entity_master ADD COLUMN gleif_enrichment_version INTEGER DEFAULT 1',
  'ALTER TABLE entity_master ADD COLUMN isin_match_count INTEGER DEFAULT 0',
  'ALTER TABLE entity_master ADD COLUMN match_source TEXT',
];

console.log(`Running ${alterStatements.length} ALTER TABLE statements...`);
let added = 0, skipped = 0, failed = 0;
for (const stmt of alterStatements) {
  const col = stmt.match(/ADD COLUMN (\S+)/)?.[1] || stmt;
  const result = d1exec(stmt);
  if (!result.ok) {
    console.error(`FATAL: Failed on: ${col}`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`  SKIP (already exists): ${col}`);
    skipped++;
  } else {
    console.log(`  OK: ${col}`);
    added++;
  }
}
console.log(`\nALTER TABLE complete: ${added} added, ${skipped} skipped, ${failed} failed`);

// Create entity_isin_map table
console.log('\nCreating entity_isin_map table...');
const createTable = d1exec(`
  CREATE TABLE IF NOT EXISTS entity_isin_map (
    isin TEXT NOT NULL,
    lei TEXT NOT NULL,
    entity_id INTEGER,
    match_source TEXT DEFAULT 'isin_direct',
    confidence INTEGER DEFAULT 100,
    mapped_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (isin, lei)
  )
`);
if (!createTable.ok) { console.error('FATAL: entity_isin_map create failed:', createTable.error); process.exit(1); }
console.log('entity_isin_map: OK');

// Indexes on entity_isin_map
const isinMapIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_entity_isin_map_isin ON entity_isin_map(isin)',
  'CREATE INDEX IF NOT EXISTS idx_entity_isin_map_lei ON entity_isin_map(lei)',
  'CREATE INDEX IF NOT EXISTS idx_entity_isin_map_entity ON entity_isin_map(entity_id)',
];
for (const idx of isinMapIndexes) {
  const r = d1exec(idx);
  if (!r.ok) { console.error('FATAL index:', r.error); process.exit(1); }
  console.log(`  Index OK: ${idx.match(/idx_\S+/)?.[0]}`);
}

// New indexes on entity_master
const entityMasterIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_entity_master_lei ON entity_master(lei)',
  'CREATE INDEX IF NOT EXISTS idx_entity_master_status ON entity_master(entity_status)',
  'CREATE INDEX IF NOT EXISTS idx_entity_master_jurisdiction ON entity_master(legal_jurisdiction)',
  'CREATE INDEX IF NOT EXISTS idx_entity_master_direct_parent ON entity_master(direct_parent_lei)',
  'CREATE INDEX IF NOT EXISTS idx_entity_master_ultimate_parent ON entity_master(ultimate_parent_lei)',
  'CREATE INDEX IF NOT EXISTS idx_entity_master_match_source ON entity_master(match_source)',
];
for (const idx of entityMasterIndexes) {
  const r = d1exec(idx);
  if (!r.ok) { console.error('FATAL index:', r.error); process.exit(1); }
  console.log(`  Index OK: ${idx.match(/idx_\S+/)?.[0]}`);
}

// ── Mandatory verification ───────────────────────────────────────────────────
console.log('\nRunning mandatory column verification...');
const colResult = d1exec("SELECT name FROM pragma_table_info('entity_master') ORDER BY name");
if (!colResult.ok) { console.error('FATAL: verification query failed:', colResult.error); process.exit(1); }

const colData = JSON.parse(colResult.output);
const presentCols = colData[0].results.map(r => r.name);
console.log(`entity_master columns (${presentCols.length} total):`);
console.log(presentCols.join(', '));

const requiredCols = [
  'legal_name','other_names','entity_category','entity_status',
  'expiration_date','expiration_reason',
  'legal_address_line1','legal_address_city','legal_address_region',
  'legal_address_country','legal_address_postcode',
  'hq_city','hq_country','legal_jurisdiction','legal_form_code','legal_form_text',
  'business_register_id','registration_authority',
  'lei_registration_status','lei_initial_registration','lei_last_updated',
  'lei_next_renewal','lei_validation_source',
  'bic_codes','primary_ticker',
  'direct_parent_lei','direct_parent_name','direct_parent_relationship_status',
  'direct_parent_period_start','direct_parent_exception',
  'ultimate_parent_lei','ultimate_parent_name','ultimate_parent_relationship_status',
  'ultimate_parent_exception',
  'has_etf_holdings','etf_holding_count','has_13f_filings','has_market_data',
  'gleif_last_updated','gleif_enrichment_version','isin_match_count','match_source',
];

const missing = requiredCols.filter(c => !presentCols.includes(c));
if (missing.length > 0) {
  console.error(`FATAL: Missing columns: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('All required columns confirmed present.');

// Verify entity_isin_map
const tableResult = d1exec("SELECT name FROM sqlite_master WHERE type='table' AND name='entity_isin_map'");
if (!tableResult.ok) { console.error('FATAL:', tableResult.error); process.exit(1); }
const tableData = JSON.parse(tableResult.output);
if (!tableData[0].results.length) {
  console.error('FATAL: entity_isin_map table not found');
  process.exit(1);
}
console.log('entity_isin_map table confirmed created.');
console.log('\nSchema migration verified. All columns present. entity_isin_map created.');
