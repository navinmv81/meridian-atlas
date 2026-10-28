// MA-OCT-008 parser tests (spec rev 1.2 §15.3 step 1; AC1–AC5, AC16, AC18).
// Local only: fixtures in ../fixtures, 0 SEC requests, 0 D1 calls.
//   node --test "App/Corporate Atlas/bonds/tests/"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { sha256 } from '../bonds-lib.mjs';
import { auditTitle, couponRe, coverIssuers, currencyOf, cusipValid, htmlToText, isinValid, parseFiling, parseFwp, preliminaryRule, classifyTitle, toIsoDate } from '../bonds-parse.mjs';

const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const manifest = JSON.parse(readFileSync(path.join(FX, 'manifest.json'), 'utf8')).fixtures;
const fx = name => {
  const m = manifest.find(x => x.name === name);
  const html = gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8');
  assert.equal(sha256(html), m.html_sha256, `${name}: fixture SHA-256`);
  return { filing: { accessionNumber: m.accession, form: m.form, filingDate: m.filing_date, cik: m.cik, url: m.url, fileNumber: m.file_number }, html };
};
const parse = (name, opts) => { const { filing, html } = fx(name); return parseFiling(filing, html, { ingestedAt: '2026-10-14T00:00:00Z', ...opts }); };
const finals = r => r.rows.filter(x => x.filing_status === 'final');

test('fixtures: every manifest SHA-256 matches', () => { for (const m of manifest) fx(m.name); });

test('AC1: ICE, Duke and UnitedHealth preliminary 424B5s → preliminary, one audit row, 0 tranches', () => {
  for (const n of ['ice-424b5-prelim-2026-08-11', 'duke-424b5-prelim-2026-08-10', 'unh-424b5-prelim-2025-06-17']) {
    const r = parse(n);
    assert.equal(r.status, 'preliminary', n);
    assert.equal(r.rows.length, 1, n);
    assert.equal(r.rows[0].tranche_seq, 0);
    assert.equal(r.rows[0].filing_status, 'preliminary');
    assert.equal(r.rows[0].principal_amount, null);
  }
});

test('AC2: the Duke FWP cites the preliminary but is never classified preliminary (R2) and yields no tranche row', () => {
  const { filing, html } = fx('duke-fwp-2026-08-11');
  assert.match(htmlToText(html).slice(0, 2000), /Preliminary Prospectus/i);
  assert.equal(preliminaryRule('FWP', htmlToText(html)), null);
  const r = parseFiling(filing, html);
  assert.equal(r.status, 'informational');
  assert.equal(r.rows.length, 0);
});

test('AC3: Duke 12 Aug 2026 final 424B5 (Equity Units) → skipped_non_debt, 0 tranches (R3)', () => {
  const r = parse('duke-424b5-equity-units-2026-08-12');
  assert.equal(r.status, 'skipped_non_debt');
  assert.deepEqual(r.rows.map(x => [x.tranche_seq, x.filing_status]), [[0, 'skipped_non_debt']]);
});

test('AC4: UnitedHealth 18 Jun 2025 final → 4 tranches with full maturities and confidence ≥ 80', () => {
  const r = parse('unh-424b5-final-2025-06-18');
  const f = finals(r);
  assert.equal(f.length, 4);
  assert.deepEqual(f.map(x => [x.principal_amount, x.coupon_rate, x.maturity_date]), [
    [500000000, 4.4, '2028-06-15'], [750000000, 4.65, '2031-01-15'], [1000000000, 5.3, '2035-06-15'], [750000000, 5.95, '2055-06-15']]);
  for (const x of f) { assert.ok(x.parse_confidence >= 80); assert.equal(x.rate_type, 'fixed'); assert.equal(x.currency, 'USD'); }
});

test('AC4 + §7.4: the same-deal FWP term sheet supplies CUSIPs and agrees (+5), never a tranche of its own', () => {
  const fwp = fx('unh-fwp-2025-06-17');
  const secs = parseFwp(fwp.html);
  assert.ok(secs.length >= 4, `FWP sections ${secs.length}`);
  const r = parse('unh-424b5-final-2025-06-18', { fwps: [{ accessionNumber: fwp.filing.accessionNumber, html: fwp.html }] });
  const f = finals(r);
  assert.equal(f.length, 4);
  for (const x of f) {
    assert.ok(x.cusip || x.isin, `tranche ${x.tranche_seq} has an identifier`);
    if (x.cusip) assert.ok(cusipValid(x.cusip));
    assert.ok(x.instrument_key);
    assert.ok(x.parse_confidence >= 95, `confidence ${x.parse_confidence}`);
  }
  assert.equal(new Set(f.map(x => x.cusip)).size, 4);
});

test('AC5: a Wells Fargo market-linked 424B2 → skipped_structured', () => {
  const r = parse('wells-424b2-structured');
  assert.equal(r.status, 'skipped_structured');
  assert.equal(r.rows[0].tranche_seq, 0);
});

test('AC16: plain Compounded-SOFR floaters (American Express) stay final: floating, SOFR, spread parsed', () => {
  const r = parse('amex-424b2-sofr-frn-2025-07-22');
  const fl = finals(r).filter(x => x.rate_type === 'floating');
  assert.equal(fl.length, 1);
  assert.equal(fl[0].benchmark, 'SOFR');
  assert.ok(fl[0].spread_bps > 0 && fl[0].spread_bps < 500);
  assert.equal(fl[0].maturity_date, '2029-07-20');
  assert.equal(finals(r).length, 3);
  assert.equal(finals(r).filter(x => x.rate_type === 'fixed_to_floating').length, 2);
});

test('AC16 (title rule): "linked to Compounded SOFR" is a plain FRN; "linked to an index/stock" is structured', () => {
  const t1 = '$500,000,000 Floating Rate Senior Notes due 2028 interest linked to Compounded SOFR plus 0.45%';
  assert.equal(classifyTitle(t1, t1).status, 'debt');
  const t2 = 'Medium-Term Notes, Series B Notes due 2030 Linked to the S&P 500® Index';
  assert.equal(classifyTitle(t2, t2).status, 'skipped_structured');
  const t3 = 'Securities Linked to the Common Stock of Amazon.com, Inc. due October 26, 2028';
  assert.equal(classifyTitle(t3, t3).status, 'skipped_structured', 'structured precedes non-debt (L8-11)');
});

test('AC18: a tranche without a full maturity is parse_failed with its own tranche_seq and NULL instrument_key; the others stay final', () => {
  const html = `<html><body><p>Filed Pursuant to Rule 424(b)(2)</p><p>PROSPECTUS SUPPLEMENT (To Prospectus dated March 1, 2024)</p>
    <p>EXAMPLE CORP.</p><p>$500,000,000 4.400% Notes due June 15, 2028</p><p>$750,000,000 5.100% Notes due 2031</p>
    <p>We are offering the notes. CUSIP: 037833100 for the 2028 notes. CUSIP: 594918104 for the 2031 notes.</p></body></html>`;
  const r = parseFiling({ accessionNumber: '0000000000-26-000001', form: '424B2', filingDate: '2026-10-01', cik: '0000000001', url: 'https://example.invalid/x.htm' }, html);
  assert.equal(r.rows.length, 2);
  const [a, b] = r.rows;
  assert.equal(a.filing_status, 'final');
  assert.equal(a.maturity_date, '2028-06-15');
  assert.equal(b.tranche_seq, 2);
  assert.equal(b.filing_status, 'parse_failed');
  assert.equal(b.maturity_date, null);
  assert.equal(b.instrument_key, null);
  assert.equal(b.coupon_rate, 5.1, 'fields kept for adjudication');
});

test('MTN pricing supplements (§7.4): Caterpillar, Deere (floating), Toyota (callable)', () => {
  const cat = finals(parse('cat-424b3-mtn-2026-08-13'));
  assert.deepEqual(cat.map(x => [x.principal_amount, x.coupon_rate, x.maturity_date, x.cusip]), [[50000000, 4.65, '2029-08-14', '14913V2E7']]);
  const dee = finals(parse('deere-424b2-mtn-floating-2026-09-09'));
  assert.equal(dee.length, 1);
  assert.deepEqual([dee[0].rate_type, dee[0].benchmark, dee[0].spread_bps, dee[0].principal_amount, dee[0].maturity_date, dee[0].instrument_key],
    ['floating', 'SOFR', 40, 400000000, '2028-09-11', 'US24422EYQ69']);
  const toy = finals(parse('toyota-424b2-mtn-callable-2026-04-15'));
  assert.deepEqual(toy.map(x => [x.principal_amount, x.coupon_rate, x.maturity_date, x.cusip]), [[60000000, 4.3, '2030-04-17', '89236TPW9']]);
});

test('B-2: a Verizon 424B3 "Offer to Exchange" → skipped_other', () => {
  assert.equal(parse('verizon-424b3-exchange-offer-2025-11-24').status, 'skipped_other');
});

test('Southern junior subordinated deal: coupon, principal, seniority and full maturity', () => {
  const f = finals(parse('southern-424b2-junior-sub-2026-03-17'));
  assert.deepEqual(f.map(x => [x.principal_amount, x.coupon_rate, x.maturity_date, x.seniority]), [[1300000000, 6, '2058-04-01', 'junior_subordinated']]);
});

test('B-1 / B-1b: GM preliminary pricing supplements (heading, and "[ ]" amount cells) → preliminary; the priced one parses', () => {
  const p1 = parse('gm-424b2-prelim-pricing-supplement-2025-03-31');
  assert.deepEqual([p1.status, p1.rule], ['preliminary', 'R2b']);
  const p2 = parse('gm-424b2-placeholder-2025-03-03');
  assert.deepEqual([p2.status, p2.rule], ['preliminary', 'B-1b']);
  const f = finals(parse('gm-424b2-final-pricing-supplement-2025-04-07'));
  assert.ok(f.length >= 1);
  assert.deepEqual([f[0].cusip, f[0].coupon_rate, f[0].maturity_date, f[0].principal_amount], ['37046AFT7', 4.9, '2028-04-20', 7567000]);
});

test('B-4 and cp1252: AT&T writes € as &#128; → the tranche currency is EUR', () => {
  assert.equal(htmlToText('&#128;1,200,000,000'), '€1,200,000,000');
  const f = finals(parse('att-424b2-euro-frn-2026-08-11'));
  assert.equal(f.length, 1);
  assert.equal(f[0].currency, 'EUR');
  assert.equal(f[0].principal_amount, 1200000000);
});

test('Oracle multi-tranche: every tranche gets its own full maturity (run-on "will mature on" sentence)', () => {
  const r = parse('oracle-424b2-multi-2026-02-03');
  const f = finals(r);
  assert.equal(f.length, r.rows.length, 'no tranche left parse_failed');
  assert.equal(f.length, 8);
  assert.ok(f.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.maturity_date) && Number(x.maturity_date.slice(0, 4)) === Number(x.tranche_label.match(/(\d{4})$/)[1])));
});

test('helpers: check digits, dates, coupon matching, R1 visible text', () => {
  assert.ok(cusipValid('037833100'));
  assert.ok(!cusipValid('037833101'));
  assert.ok(isinValid('US0378331005'));
  assert.ok(!isinValid('US0378331006'));
  assert.equal(toIsoDate('February 30, 2028'), null);
  assert.equal(toIsoDate('4/20/2028'), '2028-04-20');
  assert.ok(new RegExp(couponRe(3.75)).test('3.750%'));
  assert.ok(new RegExp(couponRe(6)).test('6.00%'));
  assert.equal(htmlToText('<style>x{}</style><p>SUBJECT&nbsp;TO</p><script>1</script><b>COMPLETION</b>'), 'SUBJECT TO COMPLETION');
  assert.equal(preliminaryRule('424B5', 'SUBJECT TO COMPLETION'), 'R2');
  assert.equal(preliminaryRule('FWP', 'SUBJECT TO COMPLETION'), null);
});

// ── AC17 sign-off rulings (claude/MA-OCT-008_AC17_Signoff.md, 15 Oct) ────

const syn = (body, form = '424B2') => parseFiling({ accessionNumber: '0000000000-26-000009', form, filingDate: '2026-10-01', cik: '0000000001', url: 'https://example.invalid/s.htm' },
  `<html><body>${body}</body></html>`);

test('R2b: "Preliminary Pricing Supplement" anywhere in the first 2,000 chars of a 424B → preliminary; never on an FWP', () => {
  assert.equal(preliminaryRule('424B2', 'PRELIMINARY PRICING SUPPLEMENT (To Prospectus dated May 1, 2026) $[ ] 4.5% Notes due 2030'), 'R2b');
  assert.equal(preliminaryRule('424B3', 'Filed under Rule 424(b)(3) Preliminary Pricing Supplement – Medium-Term Notes'), 'R2b');
  assert.equal(preliminaryRule('FWP', 'Preliminary Pricing Supplement No. 4'), null);
  assert.equal(preliminaryRule('424B2', 'x '.repeat(1100) + 'Preliminary Pricing Supplement'), null, 'beyond 2,000 visible chars');
});

test('L8-14: a tranche without a parsed principal is never final (per-tranche parse_failed with the reason)', () => {
  const r = syn(`<p>PROSPECTUS SUPPLEMENT (To Prospectus dated March 1, 2024)</p><p>EXAMPLE CORP.</p>
    <p>4.400% Notes due June 15, 2028</p><p>We are offering the notes. CUSIP: 037833100.</p>`);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].filing_status, 'parse_failed');
  assert.equal(r.rows[0].principal_amount, null);
  assert.equal(r.rows[0].instrument_key, null);
  assert.match(r.rows[0].fail_reason, /L8-14/);
});

test('B-2: "Exchange Offers" and "Offers to Exchange" are rule 1 "other" (title scope)', () => {
  assert.equal(classifyTitle('Exchange Offers for 5.1% Notes due 2030', '').status, 'skipped_other');
  assert.equal(classifyTitle('Offers to Exchange All Outstanding Notes', '').status, 'skipped_other');
  assert.equal(parse('realty-424b3-exchange-offer-2024-01-03').status, 'skipped_other');
});

test('B-3: paths are recorded per final row (7.3-4, B-3a series designator, B-3b retail table)', () => {
  assert.equal(classifyTitle('$700,000,000 4.40% Debentures, Series due March 1, 2031', '').status, 'debt');
  assert.equal(classifyTitle('$500,000,000 Medium-Term Notes, Series B due July 9, 2029', '').rule, 'B-3a');
  const nee = finals(parse('nextera-424b2-cad-2025-06-11'));
  assert.ok(nee.length >= 2 && nee.every(x => x.path === 'B-3a'), JSON.stringify(nee.map(x => x.path)));
  assert.ok(finals(parse('gm-424b2-final-pricing-supplement-2025-04-07')).every(x => x.path === 'B-3b'));
  assert.ok(finals(parse('unh-424b5-final-2025-06-18')).every(x => x.path === '7.3-4'));
  // order unchanged: a structured title stays structured even with ", Series B due"
  assert.equal(classifyTitle('Medium-Term Notes, Series B due 2030 Linked to the S&P 500 Index', '').status, 'skipped_structured');
});

test('B-4: CAD/AUD, prefixed symbols before a bare $, currency from the title only, cp1252 on numeric refs only', () => {
  assert.equal(currencyOf('C$1,250,000,000 3.400% NOTES DUE 2029'), 'CAD');
  assert.equal(currencyOf('A$500,000,000 5% Notes due 2030'), 'AUD');
  assert.equal(currencyOf('US$1,000,000,000 Notes'), 'USD');
  assert.equal(currencyOf('U.S.$1,100,000,000 Floating Rate Global Notes'), 'USD');
  assert.equal(currencyOf('$750,000,000 4.5% Notes due 2029'), 'USD');
  assert.equal(currencyOf('600,000,000 Canadian dollar 3.83% Debentures'), 'CAD');
  const amz = finals(parse('amazon-424b5-cad-2026-06-10'));
  assert.ok(amz.length >= 3 && amz.every(x => x.currency === 'CAD'), JSON.stringify(amz.map(x => x.currency)));
  const nee = finals(parse('nextera-424b2-cad-2025-06-11'));
  assert.ok(nee.every(x => x.currency === 'CAD'));
  assert.equal(htmlToText('&#128;1 &#x80;2'), '€1 €2');
  assert.equal(htmlToText('\u0080raw'), '\u0080raw', 'raw C1 bytes are not remapped');
});

test('Rule 5: demand notes / merger documents → skipped_other, stock-plan supplements → skipped_non_debt', () => {
  const d = parse('toyota-424b2-demand-note-incomedriver');
  assert.deepEqual([d.status, d.rule, d.reason], ['skipped_other', '7.3-5i', 'demand_note']);
  const m = parse('unp-424b3-merger-proxy-2025-10-01');
  assert.deepEqual([m.status, m.reason], ['skipped_other', 'merger_document']);
  const p = parse('dominion-424b3-stock-plan-2025-11-03');
  assert.deepEqual([p.status, p.reason], ['skipped_non_debt', 'stock_plan']);
  for (const r of [d, m, p]) assert.deepEqual(r.rows.map(x => x.tranche_seq), [0]);
});

test('Rule 5 runs only when no debt title was found: a debt title with demand-note words still parses', () => {
  const r = syn(`<p>PROSPECTUS SUPPLEMENT</p><p>EXAMPLE CORP.</p><p>$500,000,000 4.400% Notes due June 15, 2028</p>
    <p>We are offering the notes. Unlike our PremierNotes, these are term notes. CUSIP: 037833100.</p>`);
  assert.equal(r.status, 'debt');
  assert.equal(r.rows[0].filing_status, 'final');
});

test('N-3: audit titles use the cover offering line, not the legend or the EDGAR header', () => {
  assert.equal(parse('capone-424b5-drip-2024-03-11').title, '7,500,000 Shares Common Stock');
  assert.match(parse('realty-424b3-exchange-offer-2024-01-03').title, /^Offers to Exchange All Outstanding Notes .*Spirit Realty, L\.P\./);
  assert.doesNotMatch(auditTitle('424B3 1 tm2333021-6_424b5.htm 424B3 tm2333021-6_424b5 - none - 13.6563045s TABLE OF CONTENTS PROSPECTUS SUPPLEMENT 1,000 Shares Common Stock'), /\.htm|none/);
});

test('L8-12: co-registrant issuers on the cover are named; two names = mixed cover', () => {
  assert.deepEqual(coverIssuers('PROSPECTUS SUPPLEMENT NextEra Energy Capital Holdings, Inc. $1,000,000,000 Series AA Junior Subordinated Debentures due 2056 Unconditionally and Irrevocably Guaranteed by NextEra Energy, Inc.'),
    { names: ['NextEra Energy Capital Holdings, Inc.'], guaranteed: true });
  assert.equal(coverIssuers('Welltower OP LLC $400,000,000 4.500% Notes due 2030 Fully and Unconditionally Guaranteed by Welltower Inc. and Pfizer Netherlands International Finance B.V.').names.length, 2);
  assert.deepEqual(coverIssuers('Welltower OP LLC $400,000,000 4.500% Notes due 2030 Fully and Unconditionally Guaranteed by Welltower Inc. Welltower OP LLC').names, ['Welltower OP LLC'], 'guarantor name is not a second issuer');
  assert.deepEqual(coverIssuers('Apple Inc. $1,500,000,000 4.000% Notes due 2028'), { names: [], guaranteed: false });
});
