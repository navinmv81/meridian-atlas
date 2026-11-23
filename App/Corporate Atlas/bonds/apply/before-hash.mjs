// MA-NOV-BOND.FIX3 (F7) — the canonical "before" hash of bond_issuance, so U6/U8 can check D1 has not changed since the SQL was built.
// Reads only the file it is given; never runs SQL. 0 D1, 0 network.
//
//   wrangler d1 execute meridian-etf --remote --json --command "SELECT * FROM bond_issuance" > rows.json
//   node before-hash.mjs rows.json            → prints { rows, canonical_sha256, unsorted_sha256 }
//
// Method (results only):
//   1. Take `results` of the first statement in wrangler's --json output (an array of { results, success, meta }); a bare array of
//      rows is accepted too. `meta` (timings, served_by, rows_read …) changes on every call, so the raw file's hash is never stable.
//   2. Sort the rows by accession_number (string order), then tranche_seq (number).
//   3. sha256 (hex) of JSON.stringify(rows) in UTF-8 — each row's keys in the order wrangler returns them, which for SELECT * is the
//      table's column order; values exactly as returned (no rounding, nulls kept).
// BOND.REVIEW's d70c311a…ada51 (22 Nov) is this method. The CR's cbe392e1…6251 is not reproducible from its record (BOND.REVIEW F7);
// `unsorted_sha256` (step 2 skipped, D1's own row order) is printed only to help compare with such older values.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
export function resultsOf(json) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  if (Array.isArray(j) && j.length && j[0] && Array.isArray(j[0].results)) return j[0].results;
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.results)) return j.results;
  throw new Error('not a wrangler --json result or an array of rows');
}
export const canonicalOrder = rows => [...rows].sort((a, b) => (a.accession_number < b.accession_number ? -1 : a.accession_number > b.accession_number ? 1 : a.tranche_seq - b.tranche_seq));
export const canonicalHash = rows => sha(JSON.stringify(canonicalOrder(rows)));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node before-hash.mjs <wrangler --json output>');
  const rows = resultsOf(readFileSync(file, 'utf8'));
  console.log(JSON.stringify({ rows: rows.length, canonical_sha256: canonicalHash(rows), unsorted_sha256: sha(JSON.stringify(rows)) }));
}
