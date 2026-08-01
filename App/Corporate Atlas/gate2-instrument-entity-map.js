#!/usr/bin/env node
// Gate 2: Instrument → Entity mapping via three paths.
// Writes only to instrument_entity_map. INSERT OR IGNORE. Batches of 50.
// source values must match CHECK(source IN ('cusip_tier1','isin_tier1','heuristic'))

const fs = require('fs');

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = '***REMOVED-CF-TOKEN-MA-AUG-004***';
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

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

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`  [${label}] 0 rows — skipping`); return 0; }
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 1000 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done.toLocaleString()}/${stmts.length.toLocaleString()}`);
    }
  }
  return done;
}

async function main() {
  // ── Load all local data ──────────────────────────────────────────────────
  const isinMatches  = JSON.parse(fs.readFileSync('/tmp/gate2_isin_matches.json',     'utf8'))[0].results;
  const cusipGroups  = JSON.parse(fs.readFileSync('/tmp/gate2_cusip_groups.json',     'utf8'))[0].results;
  const entityMaster = JSON.parse(fs.readFileSync('/tmp/gate2_entity_master.json',    'utf8'))[0].results;
  const instruments  = JSON.parse(fs.readFileSync('/tmp/gate2_instrument_master.json','utf8'))[0].results;

  console.log(`ISIN matches:      ${isinMatches.length.toLocaleString()}`);
  console.log(`CUSIP groups:      ${cusipGroups.length.toLocaleString()}`);
  console.log(`entity_master:     ${entityMaster.length.toLocaleString()}`);
  console.log(`instrument_master: ${instruments.length.toLocaleString()}`);

  // Build normalized_name → entity_id map
  const normNameToEntityId = new Map();
  for (const row of entityMaster) {
    if (row.normalized_name && !normNameToEntityId.has(row.normalized_name)) {
      normNameToEntityId.set(row.normalized_name, row.entity_id);
    }
  }

  // instrument_key → row
  const instrumentMap = new Map();
  for (const row of instruments) instrumentMap.set(row.instrument_key, row);

  // cusip_issuer_6 → Set of instrument_keys
  const cusip6ToKeys = new Map();
  for (const row of instruments) {
    if (row.cusip_issuer_6) {
      if (!cusip6ToKeys.has(row.cusip_issuer_6)) cusip6ToKeys.set(row.cusip_issuer_6, new Set());
      cusip6ToKeys.get(row.cusip_issuer_6).add(row.instrument_key);
    }
  }

  // Track which instrument_keys are already mapped
  // instrument_entity_map has PRIMARY KEY on instrument_key — one entity per instrument
  const mappedKeys = new Set();

  // ── Step 2a: ISIN direct — source='isin_tier1', confidence=100 ───────────
  console.log('\nStep 2a: ISIN direct (isin_tier1)...');
  const step2aStmts = [];
  for (const { instrument_key, entity_id } of isinMatches) {
    if (!instrument_key || !entity_id) continue;
    step2aStmts.push(
      `INSERT OR IGNORE INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES (${esc(instrument_key)}, ${entity_id}, 'isin_tier1', 100)`
    );
    mappedKeys.add(instrument_key);
  }
  const step2aCount = await runBatches(step2aStmts, 'isin_tier1');
  console.log(`  Step 2a inserts attempted: ${step2aCount.toLocaleString()}`);

  // ── Step 2b: CUSIP issuer grouping — source='cusip_tier1', confidence=90 ─
  // Already populated (1,444 rows). Re-run to add any missed by step 2a.
  console.log('\nStep 2b: CUSIP issuer grouping (cusip_tier1) — already seeded, checking residuals...');
  const cusip6ToTopName = new Map();
  const cusip6Seen = new Set();
  for (const { cusip_issuer_6, security_name } of cusipGroups) {
    if (!cusip6Seen.has(cusip_issuer_6)) {
      cusip6ToTopName.set(cusip_issuer_6, security_name);
      cusip6Seen.add(cusip_issuer_6);
    }
  }

  const step2bStmts = [];
  for (const [cusip6, topName] of cusip6ToTopName) {
    const norm = normalizeName(topName);
    if (!norm) continue;
    const entityId = normNameToEntityId.get(norm);
    if (!entityId) continue;
    for (const instrKey of (cusip6ToKeys.get(cusip6) || new Set())) {
      if (mappedKeys.has(instrKey)) continue;
      step2bStmts.push(
        `INSERT OR IGNORE INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES (${esc(instrKey)}, ${entityId}, 'cusip_tier1', 90)`
      );
      mappedKeys.add(instrKey);
    }
  }
  const step2bCount = await runBatches(step2bStmts, 'cusip_tier1 (residual)');
  console.log(`  Step 2b residual inserts: ${step2bCount}`);

  // ── Step 2c: Name matching — source='heuristic', confidence=75 ───────────
  console.log('\nStep 2c: Name matching (heuristic)...');
  const step2cStmts = [];
  for (const [instrKey, row] of instrumentMap) {
    if (mappedKeys.has(instrKey)) continue;
    if (!row.isin || row.isin === '') continue;
    const norm = normalizeName(row.security_name);
    if (!norm) continue;
    const entityId = normNameToEntityId.get(norm);
    if (!entityId) continue;
    step2cStmts.push(
      `INSERT OR IGNORE INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES (${esc(instrKey)}, ${entityId}, 'heuristic', 75)`
    );
    mappedKeys.add(instrKey);
  }
  const step2cCount = await runBatches(step2cStmts, 'heuristic');
  console.log(`  Step 2c inserts attempted: ${step2cCount.toLocaleString()}`);

  console.log('\nGate 2 writes complete.');
  console.log(`Total mapped in memory: ${mappedKeys.size.toLocaleString()}`);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
