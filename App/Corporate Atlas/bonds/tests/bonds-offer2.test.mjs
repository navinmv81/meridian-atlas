// MA-NOV-BOND.OFFER2 tests — bonds-offering.mjs fields 14–22 and 25–28 (spec MA-NOV-BOND v2 §3.4–3.6, §6.1 checks, §8 no narrative).
// Local only: fixtures in ../fixtures (copied from state/cache by OFFER1/FIX1), 0 SEC requests, 0 D1 calls.
//   node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { sha256 } from '../bonds-lib.mjs';
import { parseFiling } from '../bonds-parse.mjs';
import { FIELDS, PROCEEDS_CATEGORIES, SOURCE_PARTS, VALUE_TEXT_MAX, OFFERING_VERSION, extractOffering } from '../bonds-offering.mjs';

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
const AT = '2026-11-22T00:00:00Z';
const run = (name, fwpNames = []) => {
  const { filing, html } = fx(name);
  const fwps = fwpNames.map(n => { const { m, html } = fx(n); return { accessionNumber: m.accession, url: m.url, html }; });
  const parsed = parseFiling(filing, html, { fwps, ingestedAt: AT });
  return { parsed, ...extractOffering({ filing, html, parsed, fwps, ingestedAt: AT }) };
};
const fact = (r, field, t = 0) => r.facts.find(f => f.field === field && f.tranche_seq === t);
const val = (r, field, t = 0) => JSON.parse(fact(r, field, t).value_text);
const synthetic = (body, rows, { rule = '7.3-4 / terms' } = {}) => ({
  filing: { accessionNumber: '0000000000-26-000003', form: '424B2', filingDate: '2026-01-02', cik: '0000000001', url: 'https://www.sec.gov/Archives/edgar/data/1/000000000026000003/x.htm' },
  html: `<html><body>${body}</body></html>`,
  parsed: { status: 'debt', rule, rows: rows.map((r, i) => ({ tranche_seq: i + 1, filing_status: 'final', rate_type: 'fixed', currency: 'USD', cusip: null, isin: null, ...r })) }
});
const OFFER2 = ['ranking', 'secured', 'early_repayment', 'change_of_control', 'special_mandatory_redemption', 'survivors_option', 'use_of_proceeds',
  'bank_fee_pct', 'proceeds_pct', 'proceeds_amount', 'proceeds_total', 'risk_factors', 'selling_restrictions', 'conflicts_of_interest', 'listing'];

test('OFFER2: the field list, version and source parts', () => {
  for (const f of OFFER2) assert.ok(FIELDS[f], `field ${f}`);
  assert.equal(FIELDS.change_of_control, 'O');
  assert.equal(FIELDS.special_mandatory_redemption, 'T');                // tranche-correct: it may apply to some tranches only
  assert.equal(FIELDS.proceeds_amount, 'T');
  assert.equal(FIELDS.proceeds_total, 'O');
  assert.ok(SOURCE_PARTS.includes('risk factors'));
  assert.equal(OFFERING_VERSION, 'bonds-offering-1.1.0');
});

// ── A: make-whole + par call, change of control, money and fees (UNH, 4 tranches) ──

test('UNH: per-tranche par-call dates, make-whole before them; change-of-control buy-back at 101%', () => {
  const r = run('unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']);
  const want = { 1: '2028-05-15', 2: '2030-12-15', 3: '2035-03-15', 4: '2054-12-15' };
  for (const [t, d] of Object.entries(want)) {
    assert.deepEqual(val(r, 'early_repayment', +t), { can: 'yes', from: d, price: 'make-whole, then par' }, `t${t}`);
    const f = fact(r, 'early_repayment', +t);
    assert.equal(f.value_date, d);
    assert.equal(f.source_part, 'optional redemption');
    assert.match(f.source_page, /^S-\d+$/);
    assert.ok(f.source_anchor, 'section anchor from the table of contents');
    assert.ok(d < r.parsed.rows.find(x => x.tranche_seq === +t).maturity_date, 'par call before maturity');
  }
  const c = fact(r, 'change_of_control');
  assert.equal(c.value_num, 101);
  assert.equal(c.tranche_seq, 0);
  for (const t of [1, 2, 3, 4]) { assert.equal(fact(r, 'ranking', t).value_text, 'Senior'); assert.equal(fact(r, 'secured', t).value_text, 'unsecured'); }
  assert.equal(fact(r, 'special_mandatory_redemption', 1), undefined, 'none printed → no row');
});

test('UNH: bank fee, proceeds % and amount per tranche; the combined total agrees with Σ principal × proceeds %', () => {
  const r = run('unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']);
  const want = { 1: [0.25, 99.704, 498520000], 2: [0.35, 99.457, 745927500], 3: [0.45, 99.421, 994210000], 4: [0.75, 98.244, 736830000] };
  for (const [t, [fee, pro, amt]] of Object.entries(want)) {
    assert.equal(fact(r, 'bank_fee_pct', +t).value_num, fee);
    assert.equal(fact(r, 'proceeds_pct', +t).value_num, pro);
    assert.equal(fact(r, 'proceeds_amount', +t).value_num, amt);
    const price = fact(r, 'issue_price_pct', +t).value_num;
    assert.ok(Math.abs(price - fee - pro) <= 0.01, 'price − fee = proceeds');
    assert.equal(fact(r, 'bank_fee_pct', +t).source_part, 'cover table');
  }
  const tot = fact(r, 'proceeds_total');
  assert.equal(tot.value_num, 2975487500);
  assert.equal(tot.value_text, 'USD · before expenses');
  assert.deepEqual(r.checks.filter(c => /proceeds|fee/.test(c.field)), []);
});

test('UNH: use of proceeds as categories; risks, selling restrictions and listing as links/short values', () => {
  const r = run('unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']);
  const u = val(r, 'use_of_proceeds');
  assert.deepEqual(u, { c: ['general corporate purposes', 'repay or refinance debt', 'working capital'] });
  assert.ok(u.c.every(x => PROCEEDS_CATEGORIES.includes(x)));
  assert.equal(fact(r, 'use_of_proceeds').source_part, 'use of proceeds');
  const rf = fact(r, 'risk_factors');
  assert.equal(rf.state, 'disclosed');
  assert.equal(rf.value_text, null, 'no text, a link and heading only');
  assert.equal(rf.source_heading, 'Risk Factors');
  assert.equal(rf.source_page, 'S-5');
  assert.ok(rf.source_anchor);
  assert.deepEqual(val(r, 'selling_restrictions'), ['EEA', 'UK', 'Switzerland', 'Hong Kong', 'Japan', 'Singapore', 'Taiwan']);
  assert.equal(fact(r, 'selling_restrictions').source_part, 'underwriting');
  assert.equal(fact(r, 'listing').value_text, 'Not listed');
});

// ── A: tax redemption, EUR, listing (AT&T) ─────────────────────────────────

test('AT&T EUR: tax redemption on every tranche, par-call table, EUR amounts, NYSE listing, risks pointed elsewhere → not stated', () => {
  const r = run('att-424b2-multi-eur-banks-2025-03-26');
  const want = { 1: '2030-05-01', 2: '2033-03-01', 3: '2037-03-01' };
  for (const [t, d] of Object.entries(want)) assert.deepEqual(val(r, 'early_repayment', +t), { can: 'yes', from: d, price: 'make-whole, then par', tax: true });
  for (const t of [1, 2, 3]) assert.match(fact(r, 'proceeds_amount', t).value_text, /^EUR · /);
  assert.equal(fact(r, 'proceeds_total').value_text, 'EUR · approximately, after expenses');
  assert.equal(fact(r, 'listing').value_text, 'New York Stock Exchange');
  assert.equal(fact(r, 'risk_factors').state, 'not_disclosed');       // "See Risk Factors … of our Annual Report on Form 10-K"
  assert.deepEqual(val(r, 'selling_restrictions'), ['EEA', 'UK']);
});

// ── A: special mandatory redemption on some tranches only; named acquisition (ICE) ──

test('ICE: special mandatory redemption only on the 2033 and 2036 notes (the "non-SMR notes" are excluded), 101% by the outside date', () => {
  const r = run('ice-424b5-final-2026-08-13');
  assert.equal(fact(r, 'special_mandatory_redemption', 1), undefined);
  assert.equal(fact(r, 'special_mandatory_redemption', 2), undefined);
  for (const t of [3, 4]) {
    const f = fact(r, 'special_mandatory_redemption', t);
    assert.equal(f.value_num, 101);
    assert.equal(f.value_date, '2027-07-29');
  }
  assert.deepEqual(val(r, 'use_of_proceeds'), { c: ['general corporate purposes', 'repay or refinance debt', 'fund an acquisition'], acq: 'MarketAxess' });
  for (const t of [1, 2, 3, 4]) assert.equal(val(r, 'early_repayment', t).price, 'make-whole, then par');
});

// ── A: an aside that names one tranche does not narrow the make-whole (Amazon CAD) ──

test('Amazon CAD: "Canada Yield Price" make-whole; the 2029 notes have no par call ("at any time prior to maturity")', () => {
  const r = run('amazon-424b5-cad-2026-06-10');
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'yes', price: 'make-whole', tax: true });
  for (const t of [2, 3, 4, 5]) assert.equal(val(r, 'early_repayment', t).price, 'make-whole, then par');
  assert.equal(fact(r, 'proceeds_total').value_text, 'CAD · approximately, after expenses');
});

// ── A: tranche-correct "not redeemable" (Toyota syndicated, 4 tranches) ──

test('Toyota syndicated: the floating and 2026 fixed notes cannot be repaid early; the 2029 and 2034 notes can', () => {
  const r = run('toyota-424b2-four-tranche-2024-01-05');
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'no' });
  assert.deepEqual(val(r, 'early_repayment', 2), { can: 'no' });
  assert.equal(val(r, 'early_repayment', 3).can, 'yes');
  assert.equal(val(r, 'early_repayment', 4).can, 'yes');
  assert.equal(fact(r, 'use_of_proceeds').state, 'not_disclosed');   // described in the accompanying prospectus supplement
});

// ── B: fee and proceeds labels (Caterpillar), "Redemption Provisions: None" and mostly not stated (Deere) ──

test('Caterpillar pricing supplement: dealers’ commission, all-in price as proceeds %, net proceeds total; ranking etc. not stated', () => {
  const r = run('cat-424b3-mtn-2026-08-13');
  assert.equal(fact(r, 'bank_fee_pct', 1).value_num, 0.225);
  assert.match(fact(r, 'bank_fee_pct', 1).source_heading, /Dealers['’] Commission/);
  assert.equal(fact(r, 'proceeds_pct', 1).value_num, 99.864);
  assert.equal(fact(r, 'proceeds_pct', 1).source_heading, 'All-in-price');
  const tot = fact(r, 'proceeds_total');
  assert.equal(tot.value_num, 49932000);
  const principal = r.parsed.rows.find(x => x.tranche_seq === 1).principal_amount;
  assert.ok(Math.abs(tot.value_num - principal * 0.99864) <= tot.value_num * 0.005);
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'yes', price: 'make-whole' });
  for (const f of ['ranking', 'secured']) assert.equal(fact(r, f, 1).state, 'not_disclosed');
  for (const f of ['use_of_proceeds', 'risk_factors', 'selling_restrictions']) assert.equal(fact(r, f).state, 'not_disclosed');
});

test('Deere pricing supplement: most of fields 14–28 are "Not stated in the filing"; no early repayment is a stated value', () => {
  const r = run('deere-424b2-mtn-floating-2026-09-09');
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'no' });
  assert.equal(fact(r, 'early_repayment', 1).state, 'disclosed');
  assert.equal(fact(r, 'early_repayment', 1).source_heading, 'Redemption Provisions');
  assert.equal(fact(r, 'ranking', 1).value_text, 'Senior');            // the title: "… Floating Rate Senior Notes Due …"
  for (const f of ['secured', 'bank_fee_pct']) assert.equal(fact(r, f, 1).state, 'not_disclosed');
  for (const f of ['use_of_proceeds', 'risk_factors', 'selling_restrictions']) assert.equal(fact(r, f).state, 'not_disclosed');
  assert.equal(fact(r, 'proceeds_pct', 1).value_num, 99.9);           // "The above Agents have severally agreed to purchase … at a price of 99.900%"
  for (const f of ['change_of_control', 'conflicts_of_interest', 'listing']) assert.equal(fact(r, f), undefined, `${f}: show where found → no row`);
});

test('Toyota callable pricing supplement: redeemable at par from the first redemption date; its own Risk Factors section', () => {
  const r = run('toyota-424b2-mtn-callable-2026-04-15');
  assert.deepEqual(val(r, 'early_repayment', 1), { can: 'yes', from: '2029-04-17', price: 'par' });
  assert.equal(fact(r, 'bank_fee_pct', 1).value_num, 0.25);
  assert.equal(fact(r, 'proceeds_pct', 1).value_num, 99.75);
  const rf = fact(r, 'risk_factors');
  assert.equal(rf.state, 'disclosed');
  assert.equal(rf.source_part, 'risk factors');
  assert.equal(rf.source_page, null, 'pricing supplements print no page numbers');
});

// ── C: retail table (GM) ─────────────────────────────────────────────────

test('GM retail table: survivor’s option, callable at 100% from a date, gross concession and net proceeds per CUSIP row', () => {
  const r = run('gm-424b2-final-pricing-supplement-2025-04-07');
  for (const t of [1, 2]) {
    assert.equal(fact(r, 'survivors_option', t).value_text, 'yes');
    assert.deepEqual(val(r, 'early_repayment', t), { can: 'yes', from: '2026-04-20', price: 'par' });
    assert.equal(fact(r, 'ranking', t).value_text, 'Senior');
    assert.equal(fact(r, 'secured', t).value_text, 'unsecured');
    const row = r.parsed.rows.find(x => x.tranche_seq === t);
    const fee = fact(r, 'bank_fee_pct', t).value_num, amt = fact(r, 'proceeds_amount', t).value_num, price = fact(r, 'issue_price_pct', t).value_num;
    assert.ok(Math.abs(amt - row.principal_amount * (price - fee) / 100) <= amt * 0.005, 'net proceeds = principal × (price − concession)');
    assert.equal(fact(r, 'bank_fee_pct', t).source_heading, 'Gross Concession');
  }
  assert.deepEqual([fact(r, 'bank_fee_pct', 1).value_num, fact(r, 'bank_fee_pct', 2).value_num], [0.825, 1.35]);
  assert.equal(fact(r, 'use_of_proceeds').state, 'not_disclosed');
});

// ── §6.1 checks (synthetic) ──────────────────────────────────────────────

test('§6.1: a par-call date on or after the tranche maturity is not stored (par_call)', () => {
  const s = synthetic('<p>Pricing Supplement dated January 2, 2026</p><p>Issue Price: 100.000%</p><p>Redemption: The Notes may be redeemed by the Issuer at 100% of the principal amount.</p>'
    + '<p>Redemption Dates: commencing on (and including) March 15, 2031.</p><p>Agent: Barclays Capital Inc.</p>', [{ principal_amount: 1e7, coupon_rate: 5, maturity_date: '2030-01-15' }]);
  const r = extractOffering({ ...s, ingestedAt: AT });
  assert.equal(fact(r, 'early_repayment', 1), undefined);
  assert.ok(r.checks.some(c => c.field === 'early_repayment' && c.check === 'par_call'));
});

test('§6.1: price − fee ≠ proceeds stores neither; a fee of 0 or ≥ 5% is rejected', () => {
  const body = fee => `<p>Pricing Supplement dated January 2, 2026</p><p>Issue Price: 99.500%</p><p>Agent's Discount or Commission: ${fee}%</p><p>Net Proceeds to Issuer: 99.200%</p><p>Agent: Barclays Capital Inc.</p>`;
  const rows = [{ principal_amount: 1e7, coupon_rate: 5, maturity_date: '2030-01-15' }];
  const a = extractOffering({ ...synthetic(body('0.400'), rows), ingestedAt: AT });
  assert.equal(fact(a, 'bank_fee_pct', 1), undefined);
  assert.equal(fact(a, 'proceeds_pct', 1), undefined);
  assert.ok(a.checks.some(c => c.check === 'price_fee_proceeds'));
  const b = extractOffering({ ...synthetic(body('0.300'), rows), ingestedAt: AT });
  assert.equal(fact(b, 'bank_fee_pct', 1).value_num, 0.3);
  assert.equal(fact(b, 'proceeds_pct', 1).value_num, 99.2);
  const c = extractOffering({ ...synthetic(body('0.00'), rows), ingestedAt: AT });
  assert.ok(c.checks.some(x => x.field === 'bank_fee_pct' && x.check === 'range'));
  assert.equal(fact(c, 'bank_fee_pct', 1), undefined, 'a rejected value is never shown as "not stated"');
});

test('§6.1: a proceeds total that does not agree with Σ principal × proceeds % (within 0.5%) is not stored', () => {
  const html = '<p>Pricing Supplement dated January 2, 2026</p><p>Issue Price: 100.000%</p><p>Agent\'s Discount or Commission: 0.250%</p>'
    + '<p>All-in-price: 99.750%</p><p>Net Proceeds to Issuer: $9,000,000</p><p>Agent: Barclays Capital Inc.</p>';
  const r = extractOffering({ ...synthetic(html, [{ principal_amount: 1e7, coupon_rate: 5, maturity_date: '2030-01-15' }]), ingestedAt: AT });
  assert.equal(fact(r, 'proceeds_total'), undefined);
  assert.ok(r.checks.some(c => c.field === 'proceeds_total' && c.check === 'proceeds_total'));
});

// ── §8 No narrative: every OFFER2 value is a code, number, date, closed-list category, place, exchange or heading ──

test('§8: no sentence of a filing is stored in fields 14–28', () => {
  const PLACE = /^(?:EEA|UK|[A-Z][A-Za-z ()]{1,20})$/;
  for (const [n, f] of [['unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']], ['ice-424b5-final-2026-08-13', []], ['att-424b2-multi-eur-banks-2025-03-26', []],
    ['cat-424b3-mtn-2026-08-13', []], ['deere-424b2-mtn-floating-2026-09-09', []], ['gm-424b2-final-pricing-supplement-2025-04-07', []],
    ['toyota-424b2-mtn-callable-2026-04-15', []], ['amazon-424b5-cad-2026-06-10', []], ['toyota-424b2-four-tranche-2024-01-05', []]]) {
    const r = run(n, f);
    for (const x of r.facts.filter(x => OFFER2.includes(x.field))) {
      const v = x.value_text;
      assert.ok(v == null || v.length <= VALUE_TEXT_MAX, `${n} ${x.field}: ≤ 300`);
      if (v == null) continue;
      if (x.field === 'use_of_proceeds') { const u = JSON.parse(v); assert.ok(u.c.every(c => PROCEEDS_CATEGORIES.includes(c)), `${n}: closed list`); continue; }
      if (x.field === 'selling_restrictions') { assert.ok(JSON.parse(v).every(p => PLACE.test(p)), `${n}: places`); continue; }
      if (x.field === 'early_repayment') { assert.deepEqual(Object.keys(JSON.parse(v)).filter(k => !['can', 'from', 'price', 'tax'].includes(k)), [], `${n}: keys`); continue; }
      assert.ok(!/\.\s+[A-Z]/.test(v) && v.split(/\s+/).length <= 6, `${n} ${x.field}: short value, not a sentence ("${v}")`);
    }
    for (const x of r.facts.filter(x => ['risk_factors', 'conflicts_of_interest'].includes(x.field) && x.state === 'disclosed'))
      assert.ok(x.source_heading && x.source_heading.length <= 80, `${n} ${x.field}: link + heading`);
  }
});
