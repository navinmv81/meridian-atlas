#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const Database = require('better-sqlite3');

const WORK_DIR = __dirname;
const DB_PATH = path.join(WORK_DIR, 'gleif_local.db');
const GOLDEN_COPY_PATH = path.join(WORK_DIR, '20260614-0800-gleif-goldencopy-lei2-golden-copy.csv');
const ISIN_LEI_PATH = path.join(WORK_DIR, 'lei-isin-20260614T071509.csv');

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

// Parse a CSV line respecting quoted fields
function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

async function streamFile(filePath, onLine) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    rl.on('line', onLine);
    rl.on('close', resolve);
    rl.on('error', reject);
  });
}

async function main() {
  console.log(`[${new Date().toISOString()}] Opening gleif_local.db`);

  // Remove existing db for clean build
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing gleif_local.db');
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -65536'); // 64MB

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS lei_records (
      lei TEXT PRIMARY KEY,
      legal_name TEXT,
      other_names TEXT,
      legal_address_line1 TEXT,
      legal_address_city TEXT,
      legal_address_region TEXT,
      legal_address_country TEXT,
      legal_address_postcode TEXT,
      hq_city TEXT,
      hq_country TEXT,
      legal_jurisdiction TEXT,
      legal_form_code TEXT,
      legal_form_text TEXT,
      entity_category TEXT,
      entity_status TEXT,
      expiration_date TEXT,
      expiration_reason TEXT,
      registration_authority TEXT,
      business_register_id TEXT,
      lei_registration_status TEXT,
      lei_initial_registration TEXT,
      lei_last_updated TEXT,
      lei_next_renewal TEXT,
      lei_validation_source TEXT,
      normalized_name TEXT
    );

    CREATE TABLE IF NOT EXISTS isin_lei_map (
      isin TEXT NOT NULL,
      lei TEXT NOT NULL,
      PRIMARY KEY (isin, lei)
    );
  `);

  // ── Phase 1: Golden Copy ─────────────────────────────────────────────────
  console.log(`[${new Date().toISOString()}] Phase 1: Loading Golden Copy CSV`);

  const GOLDEN_COL_MAP = {
    'LEI': 'lei',
    'Entity.LegalName': 'legal_name',
    'Entity.OtherEntityNames.OtherEntityName.1': 'other_names',
    'Entity.LegalAddress.FirstAddressLine': 'legal_address_line1',
    'Entity.LegalAddress.City': 'legal_address_city',
    'Entity.LegalAddress.Region': 'legal_address_region',
    'Entity.LegalAddress.Country': 'legal_address_country',
    'Entity.LegalAddress.PostalCode': 'legal_address_postcode',
    'Entity.HeadquartersAddress.City': 'hq_city',
    'Entity.HeadquartersAddress.Country': 'hq_country',
    'Entity.LegalJurisdiction': 'legal_jurisdiction',
    'Entity.LegalForm.EntityLegalFormCode': 'legal_form_code',
    'Entity.LegalForm.OtherLegalForm': 'legal_form_text',
    'Entity.EntityCategory': 'entity_category',
    'Entity.EntityStatus': 'entity_status',
    'Entity.EntityExpirationDate': 'expiration_date',
    'Entity.EntityExpirationReason': 'expiration_reason',
    'Entity.RegistrationAuthority.RegistrationAuthorityID': 'registration_authority',
    'Entity.RegistrationAuthority.RegistrationAuthorityEntityID': 'business_register_id',
    'Registration.InitialRegistrationDate': 'lei_initial_registration',
    'Registration.LastUpdateDate': 'lei_last_updated',
    'Registration.RegistrationStatus': 'lei_registration_status',
    'Registration.NextRenewalDate': 'lei_next_renewal',
    'Registration.ValidationSources': 'lei_validation_source',
  };

  const insertLei = db.prepare(`
    INSERT OR IGNORE INTO lei_records (
      lei, legal_name, other_names,
      legal_address_line1, legal_address_city, legal_address_region,
      legal_address_country, legal_address_postcode,
      hq_city, hq_country,
      legal_jurisdiction, legal_form_code, legal_form_text,
      entity_category, entity_status,
      expiration_date, expiration_reason,
      registration_authority, business_register_id,
      lei_registration_status, lei_initial_registration,
      lei_last_updated, lei_next_renewal, lei_validation_source,
      normalized_name
    ) VALUES (
      @lei, @legal_name, @other_names,
      @legal_address_line1, @legal_address_city, @legal_address_region,
      @legal_address_country, @legal_address_postcode,
      @hq_city, @hq_country,
      @legal_jurisdiction, @legal_form_code, @legal_form_text,
      @entity_category, @entity_status,
      @expiration_date, @expiration_reason,
      @registration_authority, @business_register_id,
      @lei_registration_status, @lei_initial_registration,
      @lei_last_updated, @lei_next_renewal, @lei_validation_source,
      @normalized_name
    )
  `);

  let goldenHeader = null;
  let colIdx = {};
  let goldenRowCount = 0;
  let batch = [];

  const insertGoldenBatch = db.transaction((rows) => {
    for (const row of rows) insertLei.run(row);
  });

  await streamFile(GOLDEN_COPY_PATH, (line) => {
    if (!goldenHeader) {
      goldenHeader = parseCsvLine(line);
      for (const [csvCol, dbCol] of Object.entries(GOLDEN_COL_MAP)) {
        const idx = goldenHeader.indexOf(csvCol);
        if (idx === -1) {
          console.warn(`WARNING: column "${csvCol}" not found in header`);
        }
        colIdx[dbCol] = idx;
      }
      return;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 2) return;

    const row = {};
    for (const [dbCol, idx] of Object.entries(colIdx)) {
      row[dbCol] = (idx >= 0 && idx < fields.length) ? (fields[idx] || null) : null;
    }
    row.normalized_name = normalizeName(row.legal_name);

    batch.push(row);
    goldenRowCount++;

    if (batch.length >= 10000) {
      insertGoldenBatch(batch);
      batch = [];
    }

    if (goldenRowCount % 200000 === 0) {
      console.log(`[${new Date().toISOString()}] Golden Copy: ${goldenRowCount.toLocaleString()} rows processed`);
    }
  });

  // Flush remainder
  if (batch.length > 0) {
    insertGoldenBatch(batch);
    batch = [];
  }
  console.log(`[${new Date().toISOString()}] Golden Copy complete: ${goldenRowCount.toLocaleString()} rows`);

  // ── Phase 2: ISIN-LEI map ────────────────────────────────────────────────
  console.log(`[${new Date().toISOString()}] Phase 2: Loading ISIN-LEI map`);

  const insertIsin = db.prepare(`
    INSERT OR IGNORE INTO isin_lei_map (isin, lei) VALUES (@isin, @lei)
  `);
  const insertIsinBatch = db.transaction((rows) => {
    for (const row of rows) insertIsin.run(row);
  });

  let isinHeader = null;
  let isinColIdx = {};
  let isinRowCount = 0;
  let isinBatch = [];

  await streamFile(ISIN_LEI_PATH, (line) => {
    if (!isinHeader) {
      isinHeader = parseCsvLine(line);
      // columns: ISIN, LEI (case-insensitive search)
      for (let i = 0; i < isinHeader.length; i++) {
        const h = isinHeader[i].toUpperCase().trim();
        if (h === 'ISIN') isinColIdx.isin = i;
        if (h === 'LEI') isinColIdx.lei = i;
      }
      console.log('ISIN file header:', isinHeader.slice(0, 5));
      return;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 2) return;

    const isin = fields[isinColIdx.isin] || null;
    const lei = fields[isinColIdx.lei] || null;
    if (!isin || !lei) return;

    isinBatch.push({ isin, lei });
    isinRowCount++;

    if (isinBatch.length >= 10000) {
      insertIsinBatch(isinBatch);
      isinBatch = [];
    }

    if (isinRowCount % 500000 === 0) {
      console.log(`[${new Date().toISOString()}] ISIN map: ${isinRowCount.toLocaleString()} rows processed`);
    }
  });

  if (isinBatch.length > 0) {
    insertIsinBatch(isinBatch);
    isinBatch = [];
  }
  console.log(`[${new Date().toISOString()}] ISIN map complete: ${isinRowCount.toLocaleString()} rows`);

  // ── Indexes ──────────────────────────────────────────────────────────────
  console.log(`[${new Date().toISOString()}] Creating indexes...`);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lei_records_normalized ON lei_records(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_lei_records_status ON lei_records(entity_status);
    CREATE INDEX IF NOT EXISTS idx_lei_records_country ON lei_records(legal_address_country);
    CREATE INDEX IF NOT EXISTS idx_isin_lei_map_isin ON isin_lei_map(isin);
    CREATE INDEX IF NOT EXISTS idx_isin_lei_map_lei ON isin_lei_map(lei);
  `);
  console.log(`[${new Date().toISOString()}] Indexes created`);

  // ── Verification ─────────────────────────────────────────────────────────
  const leiCount = db.prepare('SELECT COUNT(*) as cnt FROM lei_records').get();
  const isinCount = db.prepare('SELECT COUNT(*) as cnt FROM isin_lei_map').get();
  console.log(`\n=== VERIFICATION ===`);
  console.log(`lei_records count: ${leiCount.cnt.toLocaleString()} (expect 3,340,401)`);
  console.log(`isin_lei_map count: ${isinCount.cnt.toLocaleString()} (expect 8,866,230)`);

  const smoke = db.prepare(`
    SELECT lei, legal_name, entity_status, hq_city, legal_jurisdiction
    FROM lei_records WHERE lei = 'HWUPKR0MPOU8FGXBT394'
  `).get();
  console.log(`\nSmoke test (Apple Inc. LEI HWUPKR0MPOU8FGXBT394):`);
  console.log(JSON.stringify(smoke, null, 2));

  db.close();
  console.log(`\n[${new Date().toISOString()}] gleif_local.db build complete.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
