// One-off diagnostic: print the RAW shape of the D1 /raw API response for
// three controlled cases, so we can tell whether seed-holdings.js's
// sumMeta() is parsing meta.rows_written correctly, or overcounting.
//
// Cases:
//   1. A single read-only SELECT (sanity check on the response shape).
//   2. A single INSERT OR IGNORE that WILL conflict (targets a row that
//      should already exist) — tells us what rows_written looks like for a
//      genuine no-op.
//   3. A single INSERT OR IGNORE with a brand-new fake key that cannot
//      collide with real data — tells us what rows_written looks like for
//      one real, uncontested new row. Cleans itself up with a DELETE after.
//
// Run from: 13F Seed/  (same directory/.env as seed-holdings.js)
//   node debug-d1-raw-shape.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;

async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  return res.json(); // return raw, unparsed — we want to SEE the shape, not trust any assumption about it
}

function show(label, json) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  if (!TOKEN) {
    console.error('ERROR: CF_API_TOKEN not set (check .env in this folder)');
    process.exit(1);
  }

  // Case 1: plain read
  const readJson = await d1Raw(
    "SELECT COUNT(*) as cnt FROM holding13f_normalized WHERE cik = '0001350694';"
  );
  show('Case 1: SELECT (read-only)', readJson);

  // Case 2: INSERT OR IGNORE against a row that should already exist
  // (Bridgewater's own Q3 2025 data we just inserted — guaranteed conflict).
  const conflictJson = await d1Raw(
    "SELECT cusip, put_call, accession_number FROM holding13f_normalized WHERE cik = '0001350694' AND report_period = '2025-09-30' LIMIT 1;"
  );
  const sample = conflictJson?.result?.[0]?.results?.[0] || conflictJson?.result?.results?.[0];
  if (!sample) {
    console.warn('Could not find a sample Bridgewater Q3 row to test a guaranteed conflict — skipping Case 2.');
  } else {
    const conflictInsert = await d1Raw(
      `INSERT OR IGNORE INTO holding13f_normalized (accession_number, cik, cusip, put_call, report_period, issuer_name, value, shares, track) VALUES ('${sample.accession_number}', '0001350694', '${sample.cusip}', ${sample.put_call ? `'${sample.put_call}'` : 'NULL'}, '2025-09-30', 'DEBUG-DUPLICATE-TEST', 1, 1, 'always_include');`
    );
    show('Case 2: INSERT OR IGNORE — guaranteed conflict (no-op expected)', conflictInsert);
  }

  // Case 3: INSERT OR IGNORE with a brand-new, fake, uncontested key.
  const FAKE_ACCESSION = 'DEBUG-TEST-0000000001';
  const newInsert = await d1Raw(
    `INSERT OR IGNORE INTO holding13f_normalized (accession_number, cik, cusip, put_call, report_period, issuer_name, value, shares, track) VALUES ('${FAKE_ACCESSION}', '9999999999', 'DEBUGCUSIP', NULL, '1900-01-01', 'DEBUG TEST ROW - SAFE TO DELETE', 1, 1, 'debug_test');`
  );
  show('Case 3: INSERT OR IGNORE — brand-new uncontested row (real write expected)', newInsert);

  // Cleanup
  const cleanup = await d1Raw(
    `DELETE FROM holding13f_normalized WHERE accession_number = '${FAKE_ACCESSION}' AND cik = '9999999999';`
  );
  show('Cleanup: DELETE the debug test row', cleanup);

  console.log('\n=== Done. Compare the meta.rows_written / meta.rows_read values above by hand — no interpretation applied. ===');
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
