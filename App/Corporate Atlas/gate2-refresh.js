#!/usr/bin/env node
// Gate 2 refresh — instrument_entity_map Passes 1-3
// Pass 1: ISIN via entity_isin_map (now populated from ISIN backfill)
// Pass 2: CUSIP issuer grouping
// Pass 3: Name heuristic matching
// All in-memory matching; bulk VALUES inserts (10 rows/call).

const ACCOUNT_ID  = 'ea36070477560935a68ad9110a2fd40b';
const DATABASE_ID = '43e80149-5333-4917-b678-6a8218ca4f93';
const OAUTH_TOKEN = '***REMOVED-CF-TOKEN-MA-AUG-004***';
const BATCH_SIZE  = 10;  // rows per INSERT VALUES call
const PAGE_SIZE   = 5000;
const D1_URL      = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

async function d1q(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OAUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.results ?? [];
}

async function d1qRetry(sql, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await d1q(sql, params); }
    catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, attempt * 500));
    }
  }
}

async function bulkInsert(rows, source, confidence) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const ph = chunk.map(() => '(?,?,?,?)').join(',');
    const params = chunk.flatMap(({ instrument_key, entity_id }) =>
      [instrument_key, entity_id, source, confidence]);
    await d1qRetry(
      `INSERT OR IGNORE INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES ${ph}`,
      params
    );
    inserted += chunk.length;
    if (inserted % 5000 < BATCH_SIZE || i + BATCH_SIZE >= rows.length) {
      process.stdout.write(`  ...${inserted} / ${rows.length} inserted\n`);
    }
  }
  return inserted;
}

function normalizeName(name) {
  if (!name) return null;
  return name.toUpperCase().trim()
    .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBondDetail(name) {
  return name
    .replace(/\b\d+\.?\d*\s*%/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
    .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi, '')
    .replace(/\s+(NOTES?|BONDS?|MTN|DEBENTURES?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAllPages(sql) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await d1q(`${sql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
    rows.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
    process.stdout.write(`  ...fetched ${rows.length}\n`);
  }
  return rows;
}

async function main() {
  console.log('=== Gate 2 Refresh — Passes 1-3 ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ── Current state ─────────────────────────────────────────────────────────
  console.log('Current state:');
  const bySource = await d1q('SELECT source, COUNT(*) as cnt FROM instrument_entity_map GROUP BY source ORDER BY cnt DESC');
  for (const r of bySource) console.log(`  ${r.source}: ${r.cnt}`);
  const [totInstr] = await d1q('SELECT COUNT(*) as cnt FROM instrument_master');
  const [totMapped] = await d1q('SELECT COUNT(*) as cnt FROM instrument_entity_map');
  console.log(`  instrument_master: ${totInstr.cnt} total`);
  console.log(`  instrument_entity_map: ${totMapped.cnt} mapped (${(totMapped.cnt/totInstr.cnt*100).toFixed(1)}% coverage)\n`);

  // ── Load entity_master into memory ────────────────────────────────────────
  console.log('Loading entity_master index...');
  const entityMap = new Map(); // normalized_name → entity_id
  const entityRows = await fetchAllPages(
    'SELECT entity_id, normalized_name FROM entity_master WHERE normalized_name IS NOT NULL ORDER BY entity_id'
  );
  for (const r of entityRows) {
    if (!entityMap.has(r.normalized_name)) entityMap.set(r.normalized_name, r.entity_id);
  }
  console.log(`  ${entityMap.size} unique normalized names\n`);

  // ── Load entity_isin_map into memory ──────────────────────────────────────
  console.log('Loading entity_isin_map...');
  const isinMap = new Map(); // isin → entity_id
  const isinRows = await fetchAllPages(
    'SELECT isin, entity_id FROM entity_isin_map ORDER BY isin'
  );
  for (const r of isinRows) isinMap.set(r.isin, r.entity_id);
  console.log(`  ${isinMap.size} ISIN→entity entries\n`);

  // ── Load all unmapped instruments ─────────────────────────────────────────
  console.log('Loading unmapped instruments...');
  const unmapped = await fetchAllPages(
    `SELECT im.instrument_key, im.isin, im.cusip_issuer_6, im.security_name
     FROM instrument_master im
     LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
     WHERE iem.instrument_key IS NULL
       AND im.security_name IS NOT NULL AND im.security_name != ''
     ORDER BY im.instrument_key`
  );
  console.log(`  ${unmapped.length} unmapped instruments\n`);

  // ── Pass 1: ISIN via entity_isin_map ─────────────────────────────────────
  console.log('Pass 1: ISIN via entity_isin_map');
  const pass1Rows = [];
  for (const row of unmapped) {
    if (!row.isin || row.isin === '') continue;
    const entity_id = isinMap.get(row.isin);
    if (entity_id != null) pass1Rows.push({ instrument_key: row.instrument_key, entity_id });
  }
  console.log(`  Matched: ${pass1Rows.length} instruments`);
  const pass1Inserted = await bulkInsert(pass1Rows, 'isin_tier1', 100);
  console.log(`  Pass 1 inserted: ${pass1Inserted}\n`);

  // ── Reload unmapped after Pass 1 ─────────────────────────────────────────
  console.log('Reloading unmapped after Pass 1...');
  const afterPass1 = await fetchAllPages(
    `SELECT im.instrument_key, im.cusip_issuer_6, im.security_name
     FROM instrument_master im
     LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
     WHERE iem.instrument_key IS NULL
       AND im.security_name IS NOT NULL AND im.security_name != ''
     ORDER BY im.instrument_key`
  );
  console.log(`  ${afterPass1.length} still unmapped\n`);

  // ── Pass 2: CUSIP issuer grouping ─────────────────────────────────────────
  console.log('Pass 2: CUSIP issuer grouping');
  const cusipGrouped = new Map();
  for (const row of afterPass1) {
    if (!row.cusip_issuer_6 || row.cusip_issuer_6 === '000000') continue;
    if (!cusipGrouped.has(row.cusip_issuer_6)) {
      cusipGrouped.set(row.cusip_issuer_6, { instruments: [], sample: row });
    }
    cusipGrouped.get(row.cusip_issuer_6).instruments.push(row);
  }
  console.log(`  Unique CUSIP prefixes: ${cusipGrouped.size}`);

  const pass2Rows = [];
  for (const [, group] of cusipGrouped) {
    const normalized = normalizeName(stripBondDetail(group.sample.security_name));
    if (!normalized) continue;
    const entity_id = entityMap.get(normalized);
    if (entity_id != null) {
      for (const instr of group.instruments) {
        pass2Rows.push({ instrument_key: instr.instrument_key, entity_id });
      }
    }
  }
  console.log(`  Matched: ${pass2Rows.length} instruments`);
  const pass2Inserted = await bulkInsert(pass2Rows, 'cusip_tier1', 90);
  console.log(`  Pass 2 inserted: ${pass2Inserted}\n`);

  // ── Pass 3: Name matching for remaining unmapped ──────────────────────────
  console.log('Pass 3: Name matching for remaining unmapped');
  const afterPass2 = await fetchAllPages(
    `SELECT im.instrument_key, im.security_name
     FROM instrument_master im
     LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
     WHERE iem.instrument_key IS NULL
       AND im.security_name IS NOT NULL AND im.security_name != ''
     ORDER BY im.instrument_key`
  );
  console.log(`  Still unmapped after Pass 2: ${afterPass2.length}`);

  const pass3Rows = [];
  for (const row of afterPass2) {
    const normalized = normalizeName(stripBondDetail(row.security_name));
    if (!normalized) continue;
    const entity_id = entityMap.get(normalized);
    if (entity_id != null) pass3Rows.push({ instrument_key: row.instrument_key, entity_id });
  }
  console.log(`  Matched: ${pass3Rows.length} instruments`);
  const pass3Inserted = await bulkInsert(pass3Rows, 'heuristic', 75);
  console.log(`  Pass 3 inserted: ${pass3Inserted}\n`);

  // ── Verification ──────────────────────────────────────────────────────────
  console.log('--- Verification ---');
  const bySourceAfter = await d1q('SELECT source, COUNT(*) as cnt FROM instrument_entity_map GROUP BY source ORDER BY cnt DESC');
  const [mappedAfter] = await d1q('SELECT COUNT(*) as cnt FROM instrument_entity_map');
  for (const r of bySourceAfter) console.log(`  ${r.source}: ${r.cnt}`);
  const pct = (mappedAfter.cnt / totInstr.cnt * 100).toFixed(1);
  console.log(`\n  instrument_entity_map: ${totMapped.cnt} → ${mappedAfter.cnt} (+${mappedAfter.cnt - totMapped.cnt})`);
  console.log(`  Coverage: ${pct}% (was ${(totMapped.cnt/totInstr.cnt*100).toFixed(1)}%)`);

  console.log('\n=== Summary ===');
  console.log(`Pass 1 (ISIN via entity_isin_map): +${pass1Inserted}`);
  console.log(`Pass 2 (CUSIP grouping):           +${pass2Inserted}`);
  console.log(`Pass 3 (name heuristic):           +${pass3Inserted}`);
  console.log(`Total new:                         +${pass1Inserted + pass2Inserted + pass3Inserted}`);
  console.log(`New coverage: ${pct}% of ${totInstr.cnt} instruments`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
