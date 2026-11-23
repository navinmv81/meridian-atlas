// MA-NOV-BOND.FIX3 tests — offering review fixes (BOND.REVIEW F1, F2, F7, F8, F9) and the withheld fields (spec v2 §6.3 gate).
// Local only: fixtures in ../fixtures (copied from state/cache), 0 SEC requests, 0 D1 calls.
//   node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { sha256 } from '../bonds-lib.mjs';
import { parseFiling } from '../bonds-parse.mjs';
import { extractOffering, applyWithheld, WITHHELD_FIELDS, INTERMEDIARY, FACT_COLS } from '../bonds-offering.mjs';
import { canonicalHash, resultsOf } from '../apply/before-hash.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, '..', 'fixtures');
const manifest = JSON.parse(readFileSync(path.join(FX, 'manifest.json'), 'utf8')).fixtures;
const fx = name => {
  const m = manifest.find(x => x.name === name);
  assert.ok(m, `fixture ${name} in manifest`);
  const html = gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8');
  assert.equal(sha256(html), m.html_sha256, `${name}: fixture SHA-256`);
  return { m, html, filing: { accessionNumber: m.accession, form: m.form, filingDate: m.filing_date, cik: m.cik, url: m.url, fileNumber: m.file_number } };
};
const AT = '2026-11-23T00:00:00Z';
const run = name => {
  const { filing, html } = fx(name);
  const parsed = parseFiling(filing, html, { fwps: [], ingestedAt: AT });
  return { parsed, ...extractOffering({ filing, html, parsed, fwps: [], ingestedAt: AT }) };
};
const fact = (r, field, t = 0) => r.facts.find(f => f.field === field && f.tranche_seq === t);
const val = (r, field, t = 0) => JSON.parse(fact(r, field, t).value_text);
const rate = (r, t) => r.parsed.rows.find(x => x.tranche_seq === t && x.filing_status === 'final').rate_type;
const banksOn = (r, name, role) => r.parties.filter(p => p.party_name.startsWith(name) && p.role === role).map(p => p.tranche_seq).sort((a, b) => a - b);
// No bank holds two selling roles on one tranche (tranche 0 covers every tranche).
const noDoubleRole = r => {
  const sel = r.parties.filter(p => INTERMEDIARY.has(p.role));
  for (const a of sel) for (const b of sel)
    if (a !== b && a.party_name === b.party_name && a.role !== b.role && (a.tranche_seq === b.tranche_seq || !a.tranche_seq || !b.tranche_seq))
      assert.fail(`${a.party_name}: ${a.role} t${a.tranche_seq} and ${b.role} t${b.tranche_seq}`);
};

// ── F1 (a) day count scoped to the tranches its sentence names ──

test('F1a AbbVie 26-020619: 30/360 is said of the Fixed Rate Notes only; the floating notes are Actual/360', () => {
  const r = run('abbvie-424b5-tranche-banks-2026-02-26');
  assert.equal(rate(r, 1), 'floating');
  assert.equal(fact(r, 'day_count', 1).value_text, 'Actual/360');
  for (const t of [2, 3, 4, 5, 6, 7]) assert.equal(fact(r, 'day_count', t).value_text, '30/360', `t${t}`);
});

test('F1a AbbVie 26-092114, Oracle 26-035603: floating tranche Actual/360, fixed tranches 30/360', () => {
  for (const name of ['abbvie-424b5-multi-2026-08-18', 'oracle-424b2-multi-2026-02-03']) {
    const r = run(name);
    for (const f of r.facts.filter(x => x.field === 'day_count'))
      assert.equal(f.value_text, rate(r, f.tranche_seq) === 'floating' ? 'Actual/360' : '30/360', `${name} t${f.tranche_seq}`);
    assert.ok(fact(r, 'day_count', 1), `${name}: floating day count read`);
  }
});

test('F1a/F9 fixed-to-floating notes: no day count row (two conventions); a convention said only of a fixed-to-floating period is not used for a floating tranche', () => {
  const e = run('amex-424b2-eur-ftf-2026-06-11');
  assert.equal(rate(e, 1), 'fixed_to_floating');
  assert.equal(fact(e, 'day_count', 1), undefined);
  const a = run('amex-424b2-ftf-2026-02-04');
  assert.equal(fact(a, 'day_count', 1), undefined);
  assert.equal(fact(a, 'day_count', 2), undefined);
  assert.equal(fact(a, 'day_count', 3), undefined);          // the only Actual/360 is said of the fixed-to-floating floating period
  for (const r of [e, a]) for (const f of r.facts.filter(x => x.field === 'interest_paid' && rate(r, x.tranche_seq) === 'fixed_to_floating'))
    assert.equal(JSON.parse(f.value_text).p, 'fixed rate period');
});

// ── F1 (b) interest dates: the cover title list is not part of the floating notes' sentence ──

test('F1b AbbVie: the last fixed tranche (2066) does not get the floating notes’ quarterly dates', () => {
  const r = run('abbvie-424b5-tranche-banks-2026-02-26');
  assert.deepEqual(val(r, 'interest_paid', 1).on, ['03-03', '06-03', '09-03', '12-03']);
  assert.deepEqual(val(r, 'interest_paid', 2).on, ['03-03', '09-03']);
  const t7 = fact(r, 'interest_paid', 7);
  assert.ok(!t7 || JSON.parse(t7.value_text).on.length === 2, 't7 is semi-annual or not read');
  const r2 = run('abbvie-424b5-multi-2026-08-18');
  const t9 = fact(r2, 'interest_paid', 9);
  assert.ok(!t9 || JSON.parse(t9.value_text).on.length === 2, '2066 notes: semi-annual or not read');
});

// ── F1 (c) early repayment ──

test('F1c AbbVie: "The Floating Rate Notes may not be redeemed prior to maturity" → No (both filings; an SMR-only aside does not count)', () => {
  assert.deepEqual(val(run('abbvie-424b5-tranche-banks-2026-02-26'), 'early_repayment', 1), { can: 'no' });
  const r2 = run('abbvie-424b5-multi-2026-08-18');
  assert.deepEqual(val(r2, 'early_repayment', 1), { can: 'no' });
  assert.equal(val(r2, 'early_repayment', 3).price, 'make-whole, then par');
});

test('F1c Amazon EUR 26-027669: the make-whole is the fixed notes’ only; the floating notes can be redeemed for tax reasons only', () => {
  const r = run('amazon-424b5-eur-frn-2026-03-13');
  assert.equal(rate(r, 1), 'floating');
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'yes', tax: true });
  for (const t of [3, 4, 5, 6, 7, 8]) assert.equal(val(r, 'early_repayment', t).price, 'make-whole, then par', `t${t}`);
  assert.equal(fact(r, 'day_count', 1).value_text, 'Actual/360');
});

// ── F2 qualified party groups ──

test('F2 AbbVie 26-020619: qualified groups become tranche rows; Citigroup and Goldman are bookrunners on the floating and 2028 notes', () => {
  const r = run('abbvie-424b5-tranche-banks-2026-02-26');
  noDoubleRole(r);
  for (const p of r.parties.filter(x => x.tranche_seq === 0 && INTERMEDIARY.has(x.role))) assert.match(p.role_printed, /\(All Notes\)/, p.party_name);
  assert.deepEqual(banksOn(r, 'Citigroup', 'bookrunner'), [1, 2]);
  assert.deepEqual(banksOn(r, 'Goldman', 'bookrunner'), [1, 2]);
  assert.deepEqual(banksOn(r, 'Citigroup', 'co_manager'), [3, 4, 5, 6, 7]);
  assert.deepEqual(banksOn(r, 'Barclays', 'bookrunner'), [5, 7]);
  assert.deepEqual(banksOn(r, 'Barclays', 'co_manager'), [1, 2, 3, 4, 6]);
  assert.deepEqual(banksOn(r, 'J.P. Morgan', 'bookrunner'), [0]);
});

test('F2 AbbVie 26-092114: every bank’s bookrunner and co-manager tranches are disjoint', () => {
  const r = run('abbvie-424b5-multi-2026-08-18');
  noDoubleRole(r);
  assert.deepEqual(banksOn(r, 'Citigroup', 'bookrunner'), [7, 9]);
  assert.deepEqual(banksOn(r, 'Citigroup', 'co_manager'), [1, 2, 3, 4, 5, 6, 8]);
});

test('F2 a qualifier that names no tranche (Oracle "*in alphabetical order") does not narrow the role; an unreadable one gives no row', () => {
  const r = run('oracle-424b2-multi-2026-02-03');
  assert.ok(r.parties.some(p => p.party_name.startsWith('Wells Fargo') && p.tranche_seq === 0));
  // Synthetic: "(2040 Notes)" names no tranche of this deal → no row and a note, never a tranche-0 row.
  const html = `<html><body><p>$1,000,000,000 Example Corp 5.000% Notes due 2030 $500,000,000 6.000% Notes due 2035</p>
    <p>We expect to deliver the notes on or about January 10, 2026.</p><p>Joint Book-Running Managers Citigroup (2040 Notes) J.P. Morgan</p>
    <p>Prospectus Supplement dated January 5, 2026</p></body></html>`;
  const parsed = { status: 'debt', rule: '7.3-4 / cover', rows: [
    { tranche_seq: 1, filing_status: 'final', rate_type: 'fixed', coupon_rate: 5, maturity_date: '2030-01-15', currency: 'USD', principal_amount: 1e9, tranche_label: '5.000% Notes due 2030' },
    { tranche_seq: 2, filing_status: 'final', rate_type: 'fixed', coupon_rate: 6, maturity_date: '2035-01-15', currency: 'USD', principal_amount: 5e8, tranche_label: '6.000% Notes due 2035' }] };
  const x = extractOffering({ filing: { accessionNumber: '0000000000-26-000009', url: 'https://www.sec.gov/x.htm' }, html, parsed, ingestedAt: AT });
  assert.ok(!x.parties.some(p => p.party_name === 'Citigroup'));
  assert.ok(x.parties.some(p => p.party_name === 'J.P. Morgan' && p.tranche_seq === 0));
  assert.ok(x.notes.some(n => /bank qualifier not read: Citigroup/.test(n)));
});

// ── F8 per-agent commissions ──

test('F8 Toyota floating MTN with one commission per agent → no bank-fee row (not "Not stated in the filing")', () => {
  const r = run('toyota-424b2-mtn-frn-two-agents-2024-02-21');
  assert.equal(fact(r, 'bank_fee_pct', 1), undefined);
  assert.ok(r.parties.some(p => /^RBC/.test(p.party_name)));
});

// ── F9 decode artifact ──

test('F9 Oracle 25-217490: "PNC Capital Markets LLC", not the decode artifact "P NC"', () => {
  const r = run('oracle-424b2-final-2025-09-25');
  assert.ok(r.parties.some(p => p.party_name === 'PNC Capital Markets LLC'));
  assert.ok(!r.parties.some(p => /^P NC\b/.test(p.party_name)));
});

// ── Withheld fields (spec v2 §6.3 gate) ──

test('withheld: use_of_proceeds and proceeds_total are not written; selling_restrictions keeps link + heading without places', () => {
  assert.deepEqual(Object.keys(WITHHELD_FIELDS).sort(), ['proceeds_total', 'selling_restrictions', 'use_of_proceeds']);
  const r = run('abbvie-424b5-tranche-banks-2026-02-26');
  assert.ok(fact(r, 'use_of_proceeds') && fact(r, 'selling_restrictions').value_text, 'the extractor still reads them');
  const w = applyWithheld(r.facts);
  assert.equal(w.filter(f => f.field === 'use_of_proceeds' || f.field === 'proceeds_total').length, 0);
  const sr = w.find(f => f.field === 'selling_restrictions');
  assert.equal(sr.value_text, null);
  assert.ok(sr.source_url && sr.source_part === 'underwriting' && sr.source_heading && sr.char_offset != null);
  assert.equal(w.length, r.facts.filter(f => WITHHELD_FIELDS[f.field] !== 'row').length);
  for (const f of w) assert.deepEqual(Object.keys(f), FACT_COLS);
});

// ── F7 canonical before-hash ──

test('F7 before-hash: results only, sorted by accession_number then tranche_seq, keys in returned order', () => {
  const rows = [{ accession_number: 'b', tranche_seq: 1, x: null }, { accession_number: 'a', tranche_seq: 2, x: 1 }, { accession_number: 'a', tranche_seq: 1, x: 'y' }];
  const wrangler = [{ results: rows, success: true, meta: { duration: 1.23, rows_read: 3 } }];
  const want = sha256(JSON.stringify([rows[2], rows[1], rows[0]]));
  assert.equal(canonicalHash(resultsOf(wrangler)), want);
  assert.equal(canonicalHash(resultsOf(JSON.stringify([{ results: [...rows].reverse(), success: true, meta: { duration: 9 } }]))), want, 'order and meta do not matter');
  assert.equal(canonicalHash(rows), want, 'a bare array of rows is accepted');
});
