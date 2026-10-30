#!/usr/bin/env node
// MA-OCT-009 T-F8 — EXPLAIN QUERY PLAN for every 009 query (spec rev 1 §6, P-B1, P-B2, P-F1..P-F4, §4.3, §4.4).
// Local: node:sqlite on the real migrations (008-bonds.sql, 009-fi-serving-gate.sql) + idx_holdings_cusip from
// App/ETF Refresh/schema-phase1-holdings.sql. Prints each plan and checks it against the required shape.
//   node "App/Corporate Atlas/tests/fi-009-explain.mjs"           local plans + checks
//   node "App/Corporate Atlas/tests/fi-009-explain.mjs" --json    the same statements as JSON (for an EXPLAIN-only remote run)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const ETF = path.resolve(CA, '..', 'ETF Refresh');

// Parameters are inlined as literals so the same text runs remotely with `--command`; 'final' is a literal in the
// Worker too (the partial index needs it). The literals match what the Worker binds.
const Q = [
  ['P-F4 gate', `SELECT state, changed_at FROM fi_serving_gate WHERE id = 1`, /SEARCH fi_serving_gate USING INTEGER PRIMARY KEY \(rowid=\?\)/],
  ['P-B2 F1 step 1', `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE entity_id = 1457`, /SEARCH bond_issuer_link USING INDEX idx_bil_entity \(entity_id=\?\)/],
  ['F1b step 1 / F2 link', `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE cik = '0000077476'`, /SEARCH bond_issuer_link USING INDEX sqlite_autoindex_bond_issuer_link_1 \(cik=\?\)/],
  ['P-B1 F1 step 2', `SELECT accession_number, tranche_seq, cik, instrument_key, isin, cusip, tranche_label, security_class, rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date, seniority, form_type, filing_date, source_url, parse_confidence FROM bond_issuance WHERE cik = '0000077476' AND filing_status = 'final' AND (maturity_date, accession_number, tranche_seq) > ('2026-10-29', '', -1) ORDER BY maturity_date, accession_number, tranche_seq LIMIT 26`,
    /^SEARCH bond_issuance USING INDEX idx_bi_cik_final_key \(cik=\? AND \(maturity_date,accession_number,tranche_seq\)>\(\?,\?,\?\)\)$/],
  ['P-F1 F2 PK', `SELECT accession_number, tranche_seq, cik, instrument_key, filing_status, parse_confidence, parser_version, ingested_at FROM bond_issuance WHERE accession_number = '0001104659-24-022370' AND tranche_seq = 1`, /SEARCH bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1 \(accession_number=\? AND tranche_seq=\?\)/],
  ['P-F1 F2 other_filings', `SELECT COUNT(*) AS n, COUNT(DISTINCT cik) AS ciks FROM bond_issuance WHERE instrument_key = 'CUSIP:713448FW3' AND filing_status = 'final' AND parse_confidence >= 60`, /SEARCH bond_issuance USING INDEX idx_bi_instrument \(instrument_key=\?\)/],
  ['P-F2 F3 links', `SELECT cik, issuer_name, entity_id, link_method, confidence, last_polled_at FROM bond_issuer_link`, /SCAN bond_issuer_link/],
  ['P-F2 F3 per-CIK counts', `SELECT cik, COUNT(*) AS finals, MAX(filing_date) AS latest_filing FROM bond_issuance WHERE filing_status = 'final' AND parse_confidence >= 60 GROUP BY cik`, /SCAN bond_issuance USING INDEX idx_bi_cik_final_key/],
  ['P-F2 F3 N8-3', `SELECT COUNT(*) AS n FROM (SELECT instrument_key FROM bond_issuance WHERE filing_status = 'final' AND parse_confidence >= 60 AND instrument_key IS NOT NULL GROUP BY instrument_key HAVING COUNT(DISTINCT cik) > 1)`, /bond_issuance USING INDEX idx_bi_instrument/],
  ['P-F3 F4 ladder', `SELECT substr(maturity_date, 1, 4) AS y, currency, instrument_key, accession_number, tranche_seq, principal_amount, parse_confidence FROM bond_issuance WHERE cik = '0000077476' AND filing_status = 'final' AND maturity_date >= '2026-10-29' ORDER BY maturity_date, accession_number, tranche_seq`,
    /^SEARCH bond_issuance USING INDEX idx_bi_cik_final_key \(cik=\? AND maturity_date>\?\)$/],
  ['R1f probe (§4.3)', `SELECT DISTINCT cik FROM bond_issuance WHERE instrument_key = 'CUSIP:713448FW3' AND filing_status = 'final' AND parse_confidence >= 60 LIMIT 2`, /SEARCH bond_issuance USING INDEX idx_bi_instrument \(instrument_key=\?\)/],
  ['PepsiCo S1 (§4.4)', `SELECT accession_number, tranche_seq, cik, instrument_key, cusip, filing_status, parse_confidence FROM bond_issuance WHERE accession_number = '0001104659-24-022370' AND tranche_seq IN (1,2,3,4)`, /SEARCH bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1 \(accession_number=\? AND tranche_seq=\?\)/],
  ['PepsiCo S2 (§4.4)', `SELECT instrument_key FROM instrument_master WHERE instrument_key IN ('CUSIP:000000001')`, /SEARCH instrument_master USING (COVERING )?INDEX sqlite_autoindex_instrument_master_1 \(instrument_key=\?\)/],
  ['PepsiCo S3 (§4.4)', `SELECT 1 FROM fund_holdings_monthly WHERE cusip = '000000001' LIMIT 1`, /^SEARCH fund_holdings_monthly USING (COVERING )?INDEX idx_holdings_cusip \(cusip=\?\)$/],
];

if (process.argv.includes('--json')) { console.log(JSON.stringify(Q.map(([id, sql, re]) => ({ id, sql, expect: re.source })), null, 1)); process.exit(0); }

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(path.join(CA, 'migrations', '008-bonds.sql'), 'utf8'));
db.exec(readFileSync(path.join(CA, 'migrations', '009-fi-serving-gate.sql'), 'utf8'));
db.exec(`CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY, security_name TEXT, security_ticker TEXT, isin TEXT, cusip TEXT, asset_cat TEXT, country TEXT);`);
const etf = readFileSync(path.join(ETF, 'schema-phase1-holdings.sql'), 'utf8');
const fhm = etf.match(/CREATE TABLE IF NOT EXISTS fund_holdings_monthly \([\s\S]*?\n\);/);
db.exec(fhm[0]);
db.exec(`CREATE INDEX IF NOT EXISTS idx_holdings_cusip ON fund_holdings_monthly(cusip, report_month);`);

let pass = 0, fail = 0;
for (const [id, sql, re] of Q) {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(r => r.detail);
  const first = plan.find(l => /bond_issuance|bond_issuer_link|fi_serving_gate|instrument_master|fund_holdings_monthly/.test(l)) || '';
  const ok = re.test(first) && !plan.some(l => /USE TEMP B-TREE FOR ORDER BY/.test(l));
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${plan.join(' / ')}`);
}
console.log(`\nfi-009-explain (local): ${pass}/${pass + fail} plans as required`);
process.exit(fail ? 1 : 0);
