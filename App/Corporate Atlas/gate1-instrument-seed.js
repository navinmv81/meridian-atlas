#!/usr/bin/env node
// Gate 1: Complete instrument_master population via INSERT OR IGNORE, db.batch() groups of 50

const fs = require('fs');

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN = process.env.CF_API_TOKEN;
if (!TOKEN) {
  console.error('Error: CF_API_TOKEN environment variable not set.');
  console.error('Run: export CF_API_TOKEN=$(wrangler whoami --json | ...)');
  console.error('Or obtain a fresh token via: wrangler login');
  process.exit(1);
}
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
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
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL: ${sql.slice(0, 300)}`);
  }
  return json;
}

async function runBatches(stmts, label) {
  let done = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 2000 === 0 || done === stmts.length) {
      console.log(`  [${label}] ${done.toLocaleString()}/${stmts.length.toLocaleString()}`);
    }
  }
}

function deriveInstrumentKey(row) {
  if (row.isin && row.isin.trim().length === 12) {
    return row.isin.trim();
  } else if (row.cusip && row.cusip.trim().length >= 6) {
    return 'CUSIP:' + row.cusip.trim();
  } else if (row.security_ticker && row.security_ticker.trim() !== '') {
    return 'TICKER:' + row.security_ticker.toUpperCase().trim();
  } else {
    return 'NAME:' + row.security_name.toUpperCase().trim()
      .replace(/\s+/g, '_').slice(0, 80);
  }
}

async function main() {
  const securities = JSON.parse(fs.readFileSync('/tmp/gate1_securities.json', 'utf8'))[0].results;
  console.log(`Loaded ${securities.length.toLocaleString()} distinct securities from D1`);

  // Build INSERT statements — one per unique instrument_key
  // Deduplicate by instrument_key (GROUP BY in SQL may still yield duplicates across combos)
  const seen = new Set();
  const stmts = [];

  for (const row of securities) {
    const instrumentKey = deriveInstrumentKey(row);
    if (seen.has(instrumentKey)) continue;
    seen.add(instrumentKey);

    const cusipIssuer6 = (row.cusip && row.cusip.trim().length >= 6)
      ? row.cusip.trim().slice(0, 6) : null;

    const stmt = `INSERT OR IGNORE INTO instrument_master
      (instrument_key, security_name, security_ticker, isin, cusip,
       cusip_issuer_6, asset_cat, country, first_seen_date)
    VALUES (
      ${esc(instrumentKey)},
      ${esc(row.security_name)},
      ${esc(row.security_ticker)},
      ${esc(row.isin)},
      ${esc(row.cusip)},
      ${esc(cusipIssuer6)},
      ${esc(row.asset_cat)},
      ${esc(row.issuer_country)},
      ${esc(row.first_seen_date)}
    )`;
    stmts.push(stmt);
  }

  console.log(`Unique instrument_keys to insert: ${stmts.length.toLocaleString()} (${securities.length - stmts.length} dupes dropped)`);

  await runBatches(stmts, 'INSERT instrument_master');
  console.log('\nAll inserts complete.');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
