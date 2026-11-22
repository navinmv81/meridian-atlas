// MA-NOV-BOND.OFFER1 tests — bonds-offering.mjs (spec MA-NOV-BOND v2 §3 fields 1–13, §4 parties, §5 sources, §6.1 checks).
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
import { FACT_COLS, PARTY_COLS, FIELDS, ROLES, STATES, SOURCE_PARTS, INTERMEDIARY, OFFERING_VERSION, VALUE_TEXT_MAX,
  extractOffering, splitBankList, bankKey, trusteeKey, pageMarkers, decode, decodedText, namedTranches, checkAgainstIssuance } from '../bonds-offering.mjs';

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
const names = (r, role) => r.parties.filter(p => p.role === role).map(p => p.party_name);
const synthetic = (body, rows, { rule = '7.3-4 / terms' } = {}) => ({
  filing: { accessionNumber: '0000000000-26-000001', form: '424B2', filingDate: '2026-01-02', cik: '0000000001', url: 'https://www.sec.gov/Archives/edgar/data/1/000000000026000001/x.htm' },
  html: `<html><body>${body}</body></html>`,
  parsed: { status: 'debt', rule, rows: rows.map((r, i) => ({ tranche_seq: i + 1, filing_status: 'final', rate_type: 'fixed', currency: 'USD', cusip: null, isin: null, ...r })) }
});

// ── Row shape (BOND-CR2) ─────────────────────────────────────────────────

test('OFFER1: row columns are exactly the BOND-CR2 table columns', () => {
  const sql = readFileSync(path.join(HERE, '..', '..', 'migrations', 'ma-nov-bond-cr2.sql'), 'utf8');
  const cols = table => sql.split(`CREATE TABLE IF NOT EXISTS ${table} (`)[1].split(') WITHOUT ROWID')[0].split('\n')
    .map(l => l.trim()).filter(l => /^[a-z_]+\s+(?:TEXT|INTEGER|REAL)/.test(l)).map(l => l.split(/\s+/)[0]);
  assert.deepEqual(FACT_COLS, cols('bond_offering_fact'));
  assert.deepEqual(PARTY_COLS, cols('bond_offering_party'));
  assert.equal(VALUE_TEXT_MAX, 300);
  assert.match(OFFERING_VERSION, /^bonds-offering-\d+\.\d+\.\d+$/);
});

test('OFFER1: every fixture row fits the CR2 checks (state, source_doc, role, PK unique, ≤ 300 chars, a source for every shown value)', () => {
  for (const [n, f] of [['unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']], ['ice-424b5-final-2026-08-13', []], ['cat-424b3-mtn-2026-08-13', []],
    ['deere-424b2-mtn-floating-2026-09-09', []], ['gm-424b2-final-pricing-supplement-2025-04-07', []], ['toyota-424b2-mtn-callable-2026-04-15', []],
    ['att-424b2-multi-eur-banks-2025-03-26', []], ['pfizer-424b2-nl-guaranteed-eur-2025-05-15', []], ['nextera-424b5-final-series-q-2024-02-28', []],
    ['pepsico-424b2-multi-2025-02-07', ['pepsico-fwp-columns-2025-02-05']], ['toyota-424b2-four-tranche-2024-01-05', []]]) {
    const r = run(n, f);
    const pk = new Set();
    for (const x of r.facts) {
      assert.deepEqual(Object.keys(x), FACT_COLS, `${n}: fact columns`);
      assert.ok(STATES.includes(x.state), `${n}: state ${x.state}`);
      assert.ok(['424b', 'fwp'].includes(x.source_doc));
      assert.ok(SOURCE_PARTS.includes(x.source_part), `${n}: part ${x.source_part}`);
      assert.ok(FIELDS[x.field] || /^parties\.(?:bookrunner|co_manager|underwriter|agent|trustee|guarantor|other)$/.test(x.field), `${n}: field ${x.field}`);
      assert.ok(x.value_text == null || x.value_text.length <= VALUE_TEXT_MAX);
      assert.ok(x.state !== 'disclosed' || x.char_offset != null, `${n}: ${x.field} shown without a source position`);
      assert.ok(x.source_url && x.parser_version === OFFERING_VERSION && x.ingested_at === AT);
      const k = `${x.accession_number}|${x.tranche_seq}|${x.field}`;
      assert.ok(!pk.has(k), `${n}: duplicate PK ${k}`); pk.add(k);
      if (FIELDS[x.field] === 'O' || x.field.startsWith('parties.')) assert.equal(x.tranche_seq, 0, `${n}: ${x.field} is offering-level`);
      else assert.ok(r.parsed.rows.some(t => t.tranche_seq === x.tranche_seq && t.filing_status === 'final'), `${n}: ${x.field} on a real tranche`);
    }
    r.parties.forEach((p, i) => {
      assert.deepEqual(Object.keys(p), PARTY_COLS);
      assert.equal(p.party_seq, i + 1, `${n}: party_seq runs 1..n`);
      assert.ok(ROLES.includes(p.role));
      assert.ok(p.tranche_seq === 0 || r.parsed.rows.some(t => t.tranche_seq === p.tranche_seq));
    });
    assert.deepEqual(r.checks.filter(c => c.check === 'source' || c.check === 'clash'), [], `${n}: no unsourced fact, no party clash`);
  }
});

// ── Multi-tranche, per-tranche price (A, rows per tranche) ───────────────

test('UNH 4 tranches: price per tranche from the cover table, interest dates per tranche, dates, term-sheet pricing date', () => {
  const r = run('unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']);
  assert.equal(r.family, 'A');
  assert.deepEqual([1, 2, 3, 4].map(t => fact(r, 'issue_price_pct', t).value_num), [99.954, 99.807, 99.871, 98.994]);
  for (const t of [1, 2, 3, 4]) assert.equal(fact(r, 'issue_price_pct', t).source_part, 'cover table');
  assert.equal(fact(r, 'issue_price_pct', 1).source_page, 'cover');
  assert.deepEqual(JSON.parse(fact(r, 'interest_paid', 2).value_text), { f: 'semi-annual', on: ['01-15', '07-15'], first: '2026-01-15' });
  for (const t of [1, 3, 4]) assert.deepEqual(JSON.parse(fact(r, 'interest_paid', t).value_text), { f: 'semi-annual', on: ['06-15', '12-15'], first: '2025-12-15' });
  assert.equal(fact(r, 'document_date').value_date, '2025-06-17');
  assert.equal(fact(r, 'issue_date').value_date, '2025-06-20');
  assert.equal(fact(r, 'issue_date').value_text, 'on or about');
  const p = fact(r, 'priced_on');
  assert.equal(p.value_date, '2025-06-17');
  assert.equal(p.source_doc, 'fwp');
  assert.equal(p.source_url, manifest.find(x => x.name === 'unh-fwp-2025-06-17').url);
  // Two tranches print $750,000,000: each amount points at its own cover line.
  assert.notEqual(fact(r, 'amount', 2).char_offset, fact(r, 'amount', 4).char_offset);
  // Day count: a section heading, the filing's own anchor and the printed page.
  const dc = fact(r, 'day_count', 1);
  assert.equal(dc.value_text, '30/360');
  assert.equal(dc.source_part, 'description of the notes');
  assert.ok(dc.source_anchor, 'anchor from the table of contents');
  assert.match(dc.source_page, /^S-\d+$/);
  // Parties: 4 lead banks, no co-managers printed, trustee from the closed list.
  assert.deepEqual(names(r, 'bookrunner'), ['BofA Securities', 'Barclays', 'Citigroup', 'J.P. Morgan']);
  assert.equal(fact(r, 'parties.co_manager').state, 'not_disclosed');
  assert.equal(fact(r, 'parties.agent').state, 'not_applicable');
  assert.deepEqual(names(r, 'trustee'), ['U.S. Bank Trust Company, National Association']);
  assert.equal(r.parties.find(x => x.role === 'trustee').source_page, 'S-7');
});

// ── Columns per tranche + tranche-specific roles (A) ─────────────────────

test('ICE: column-layout cover table and "(for the 2036 notes)" bank roles mapped to one tranche each', () => {
  const r = run('ice-424b5-final-2026-08-13');
  assert.deepEqual([1, 2, 3, 4].map(t => fact(r, 'issue_price_pct', t).value_num), [99.735, 99.488, 99.37, 99.128]);
  const at = n => r.parties.find(p => p.party_name === n);
  assert.equal(at('MUFG').tranche_seq, 4);
  assert.equal(at('Citigroup').tranche_seq, 1);
  assert.equal(at('Fifth Third Securities').tranche_seq, 3);
  assert.equal(at('PNC Capital Markets LLC').tranche_seq, 2);
  assert.equal(at('MUFG').role_printed, 'Joint Book-Running Managers (for the 2036 notes)');
  assert.equal(at('BofA Securities').tranche_seq, 0);
  assert.deepEqual(names(r, 'co_manager'), ['BBVA', 'BMO Capital Markets', 'Huntington Capital Markets', 'M&T Securities', 'KeyBanc Capital Markets', 'SOCIETE GENERALE']);
  assert.equal(at('BBVA').role_printed, 'Senior Co-Managers');
  assert.equal(at('Computershare Trust Company, National Association').role, 'trustee');
  assert.equal(fact(r, 'priced_on').state, 'not_disclosed', 'no labelled pricing date without the term sheet; never the document date');
});

test('Toyota syndicated pricing supplement: tranche titles above the table name the columns (floating and fixed both due 2026)', () => {
  const r = run('toyota-424b2-four-tranche-2024-01-05');
  assert.equal(r.family, 'A');
  assert.deepEqual([1, 2, 3, 4].map(t => fact(r, 'issue_price_pct', t)?.value_num), [100, 99.923, 99.863, 99.89]);
});

// ── Pricing supplements (B) and retail tables (C) ────────────────────────

test('Caterpillar pricing supplement: no trustee printed → "Not stated in the filing"; labelled trade date; bank labels', () => {
  const r = run('cat-424b3-mtn-2026-08-13');
  assert.equal(r.family, 'B');
  assert.equal(fact(r, 'parties.trustee').state, 'not_disclosed');
  assert.equal(names(r, 'trustee').length, 0);
  const p = fact(r, 'priced_on');
  assert.deepEqual([p.value_date, p.source_heading, p.source_part], ['2026-08-12', 'Trade Date/Pricing Effective Time', 'pricing terms']);
  assert.equal(fact(r, 'issue_date').value_date, '2026-08-14');
  assert.equal(fact(r, 'issue_price_pct', 1).value_num, 100.089);
  assert.equal(fact(r, 'issue_price_pct', 1).source_page, null, 'pricing supplements print no page numbers');
  assert.deepEqual(names(r, 'bookrunner'), ['Barclays Capital Inc.', 'J.P. Morgan Securities LLC', 'SG Americas Securities, LLC']);
  assert.equal(names(r, 'co_manager').length, 18);
  assert.ok(!r.parties.some(x => x.role === 'other' && x.party_name === 'SG Americas Securities, LLC'), 'billing agent already a bookrunner is not repeated');
});

test('Deere: two-column header date, "Plan of Distribution" list → underwriters, no trustee', () => {
  const r = run('deere-424b2-mtn-floating-2026-09-09');
  assert.equal(fact(r, 'document_date').value_date, '2026-09-08');
  assert.equal(names(r, 'underwriter').length, 12);
  assert.equal(r.parties.find(x => x.role === 'underwriter').role_printed, 'Plan of Distribution');
  assert.equal(fact(r, 'parties.trustee').state, 'not_disclosed');
  assert.equal(fact(r, 'day_count', 1).value_text, 'Actual/360');
  assert.deepEqual(JSON.parse(fact(r, 'interest_paid', 1).value_text), { f: 'quarterly', on: ['03-11', '06-11', '09-11', '12-11'], first: '2026-12-11' });
  assert.equal(fact(r, 'issue_price_pct', 1).value_num, 100);
});

test('GM retail table (C): price by CUSIP row, agents and trustee from labels, no day count printed', () => {
  const r = run('gm-424b2-final-pricing-supplement-2025-04-07');
  assert.equal(r.family, 'C');
  assert.deepEqual([fact(r, 'issue_price_pct', 1).value_num, fact(r, 'issue_price_pct', 2).value_num], [100, 100]);
  assert.deepEqual(names(r, 'agent'), ['InspereX', 'BofA Securities', 'Morgan Stanley', 'RBC Capital Markets', 'Wells Fargo Advisors']);
  assert.equal(r.parties.find(x => x.party_name === 'InspereX').role_printed, 'Purchasing Agent');
  assert.deepEqual(names(r, 'trustee'), ['U.S. Bank Trust Company, National Association']);
  for (const t of [1, 2]) assert.equal(fact(r, 'day_count', t).state, 'not_disclosed');
  assert.equal(fact(r, 'parties.bookrunner').state, 'not_applicable');
  assert.equal(fact(r, 'priced_on').value_date, '2025-04-07');
  assert.deepEqual(JSON.parse(fact(r, 'interest_paid', 1).value_text), { f: 'semi-annual', first: '2025-10-20' });
});

test('Toyota MTN: two trustee institutions in the indenture history, neither stated as current → no trustee row (D9, "Not read yet")', () => {
  const r = run('toyota-424b2-mtn-callable-2026-04-15');
  assert.equal(fact(r, 'parties.trustee'), undefined);
  assert.equal(names(r, 'trustee').length, 0);
  assert.ok(r.notes.some(n => /D9/.test(n)));
  assert.equal(fact(r, 'priced_on').value_date, '2026-04-09', 'the initial trade date, not the amended document date');
  assert.equal(fact(r, 'document_date').value_date, '2026-04-15');
});

// ── Bank lists: European names, all capitals ─────────────────────────────

test('AT&T EUR: European bank names split correctly, accents kept as printed', () => {
  const r = run('att-424b2-multi-eur-banks-2025-03-26');
  assert.deepEqual(names(r, 'bookrunner'), ['Barclays', 'BBVA', 'Commerzbank', 'IMI – Intesa Sanpaolo', 'Société Générale Corporate & Investment Banking']);
  for (const t of [1, 2, 3]) assert.equal(fact(r, 'day_count', t).value_text, 'Actual/Actual');
  assert.deepEqual(JSON.parse(fact(r, 'interest_paid', 1).value_text), { f: 'annual', on: ['06-01'], first: '2025-06-01' });
  assert.deepEqual([1, 2, 3].map(t => fact(r, 'currency', t).value_text), ['EUR', 'EUR', 'EUR']);
});

test('splitBankList: run-together cover names, European names, legal entities and prose', () => {
  const n = s => splitBankList(s).map(x => x.name);
  assert.deepEqual(n('BofA Securities Barclays Citigroup J.P. Morgan'), ['BofA Securities', 'Barclays', 'Citigroup', 'J.P. Morgan']);
  assert.deepEqual(n('BNP PARIBAS Crédit Agricole CIB IMI — Intesa Sanpaolo Santander UniCredit Capital Markets'),
    ['BNP PARIBAS', 'Crédit Agricole CIB', 'IMI — Intesa Sanpaolo', 'Santander', 'UniCredit Capital Markets']);
  assert.deepEqual(n('Mizuho International plc Morgan Stanley & Co. International plc RBC Dominion Securities Inc.'),
    ['Mizuho International plc', 'Morgan Stanley & Co. International plc', 'RBC Dominion Securities Inc.']);
  assert.deepEqual(n('Blaylock Van, LLC R. Seelaus & Co., LLC Ramirez & Co., Inc. Siebert Williams Shank'),
    ['Blaylock Van, LLC', 'R. Seelaus & Co., LLC', 'Ramirez & Co., Inc.', 'Siebert Williams Shank']);
  const stats = { dropped: [] };
  assert.deepEqual(splitBankList('Barclays Capital Inc. It is expected that delivery of the Notes will be made on or about June 6, 2024', stats).map(x => x.name), ['Barclays Capital Inc.']);
  assert.equal(stats.dropped.length, 1, 'a sentence is never stored as a bank name');
  assert.equal(bankKey('SG Americas Securities, LLC'), bankKey('SOCIETE GENERALE'));
  assert.equal(bankKey('Mizuho Securities USA LLC'), 'mizuho');
});

test('all-capitals term-sheet list (CVS): each name whole, with its legal-form suffix', () => {
  const { html } = fx('cvs-fwp-allcaps-banks-2024-12-04');
  const t = decodedText(html);
  const i = t.indexOf('Joint Book-Running Managers:');
  assert.ok(i > 0);
  const seg = t.slice(i + 'Joint Book-Running Managers:'.length, t.indexOf('Co-Managers:', i));
  const got = splitBankList(seg).map(x => x.name);
  assert.deepEqual(got, ['BARCLAYS CAPITAL INC.', 'CITIGROUP GLOBAL MARKETS INC.', 'GOLDMAN SACHS & CO. LLC', 'BOFA SECURITIES, INC.', 'J.P. MORGAN SECURITIES LLC', 'WELLS FARGO SECURITIES, LLC']);
  assert.deepEqual(splitBankList(seg).map(x => x.key), ['barclays', 'citi', 'gs', 'bofa', 'jpm', 'wells']);
});

test('term-sheet banks are used only when the 424B has no bank block (source_doc fwp)', () => {
  const { m, html: fwpHtml } = fx('cvs-fwp-allcaps-banks-2024-12-04');
  const s = synthetic('<p>Prospectus Supplement dated December 2, 2024</p><p>$1,000,000,000 6.000% Notes due 2030</p><p>We will pay interest on the notes on June 1 and December 1 of each year.</p>',
    [{ coupon_rate: 6, maturity_date: '2030-12-01', principal_amount: 1e9, tranche_label: '6.000% Notes due 2030' }], { rule: '7.3-4 / cover' });
  const r = extractOffering({ ...s, fwps: [{ accessionNumber: m.accession, url: m.url, html: fwpHtml }], ingestedAt: AT });
  const banks = r.parties.filter(p => INTERMEDIARY.has(p.role));
  assert.ok(banks.length >= 6);
  assert.ok(banks.every(p => p.source_doc === 'fwp' && p.source_url === m.url && p.source_part === 'term sheet'));
  assert.ok(names(r, 'bookrunner').includes('GOLDMAN SACHS & CO. LLC'));
});

// ── Guarantor and co-registrant issuers ──────────────────────────────────

test('Pfizer Netherlands (guaranteed deal): guarantor stored as a party, never as a bank', () => {
  const r = run('pfizer-424b2-nl-guaranteed-eur-2025-05-15');
  assert.deepEqual(names(r, 'guarantor'), ['Pfizer Inc.']);
  assert.equal(fact(r, 'parties.guarantor').state, 'disclosed');
  assert.ok(!r.parties.some(p => INTERMEDIARY.has(p.role) && /Pfizer/.test(p.party_name)));
  assert.deepEqual([1, 2, 3, 4].map(t => fact(r, 'issue_price_pct', t).value_num), [99.903, 99.263, 99.858, 99.47]);
  assert.equal(names(r, 'bookrunner').length, 8);
});

test('NextEra Series Q (co-registrant issuer NEE Capital, guaranteed by NextEra Energy): issuer not stored again, guarantor kept apart', () => {
  const r = run('nextera-424b5-final-series-q-2024-02-28');
  assert.ok(r.parsed.coIssuers.some(n => /Capital Holdings/.test(n)), 'the parser names the co-registrant');
  assert.deepEqual(names(r, 'guarantor'), ['NextEra Energy, Inc.']);
  assert.ok(!r.parties.some(p => /Capital Holdings/.test(p.party_name)), 'the issuer comes from bond_issuer_link, not a party row');
  assert.equal(names(r, 'bookrunner').length, 13);
  // The trustee is named only in the base prospectus (NEE's indentures, not NEE Capital's): not read.
  assert.equal(fact(r, 'parties.trustee'), undefined);
  assert.ok(r.notes.some(n => /base prospectus/.test(n)));
});

test('BOND-11: a guarantor also read as a selling agent fails the whole filing\'s parties (no rows, "Not read yet")', () => {
  const s = synthetic('<p>Pricing Supplement No. 1 dated January 2, 2026</p><p>Guarantor: Example Holdings Inc.</p><p>Issue Price: 100.00%</p><p>Original Issue Date: January 6, 2026</p><p>Stated Maturity Date: January 15, 2030</p><p>Agent: Example Holdings Inc.</p><p>Day Count Convention: 30/360</p>',
    [{ coupon_rate: 5, maturity_date: '2030-01-15', principal_amount: 1e8, tranche_label: 'Medium-Term Notes due 2030' }]);
  const r = extractOffering({ ...s, ingestedAt: AT });
  assert.equal(r.parties.length, 0);
  assert.ok(!r.facts.some(f => f.field.startsWith('parties.')));
  assert.ok(r.checks.some(c => c.check === 'clash'));
  assert.equal(fact(r, 'issue_price_pct', 1).value_num, 100, 'other facts are unaffected');
});

// ── §6.1 checks ──────────────────────────────────────────────────────────

test('§6.1 dates: an issue date before the document date is not stored', () => {
  const s = synthetic('<p>Pricing Supplement No. 4 dated March 10, 2026</p><p>Original Issue Date: March 2, 2026</p><p>Trade Date: March 10, 2026</p><p>Stated Maturity Date: March 15, 2029</p>',
    [{ coupon_rate: 4.5, maturity_date: '2029-03-15', principal_amount: 5e7, tranche_label: 'Medium-Term Notes due 2029' }]);
  const r = extractOffering({ ...s, ingestedAt: AT });
  assert.equal(fact(r, 'issue_date'), undefined);
  assert.ok(r.checks.some(c => c.field === 'issue_date' && c.check === 'dates'));
  assert.equal(fact(r, 'priced_on').value_date, '2026-03-10');
});

test('§6.1 price: price − fee must equal proceeds in the cover table; a value out of 90–101 is not stored', () => {
  const body = p => `<p>Prospectus Supplement dated May 1, 2026</p><p>$500,000,000 5.000% Notes due 2031</p><p>Public Offering Price Underwriting Discount Proceeds to Us (before expenses)</p><p>Per Note ${p} % 0.600 % 99.000 %</p><p>Total $ 1 $ 2 $ 3</p><p>The underwriters expect to deliver the notes on or about May 6, 2026.</p>`;
  const rows = [{ coupon_rate: 5, maturity_date: '2031-05-06', principal_amount: 5e8, tranche_label: '5.000% Notes due 2031' }];
  const ok = extractOffering({ ...synthetic(body('99.600'), rows, { rule: '7.3-4 / cover' }), ingestedAt: AT });
  assert.equal(fact(ok, 'issue_price_pct', 1).value_num, 99.6);
  const bad = extractOffering({ ...synthetic(body('99.900'), rows, { rule: '7.3-4 / cover' }), ingestedAt: AT });
  assert.equal(fact(bad, 'issue_price_pct', 1), undefined);
  assert.ok(bad.checks.some(c => c.check === 'price_fee_proceeds'));
  const high = extractOffering({ ...synthetic('<p>Pricing Supplement No. 2 dated May 1, 2026</p><p>Issue Price: 101.458%</p>', rows), ingestedAt: AT });
  assert.equal(fact(high, 'issue_price_pct', 1), undefined);
  assert.ok(high.checks.some(c => c.check === 'range'));
});

test('§6.1 interest paid: printed months must fit the frequency', () => {
  const s = synthetic('<p>Pricing Supplement No. 3 dated May 1, 2026</p><p>Interest Payment Dates: Semi-annually on March 1, June 1 and September 1, commencing on June 1, 2026</p>',
    [{ coupon_rate: 4, maturity_date: '2029-09-01', principal_amount: 1e8, tranche_label: 'Notes due 2029' }]);
  const r = extractOffering({ ...s, ingestedAt: AT });
  assert.equal(fact(r, 'interest_paid', 1), undefined);
  assert.ok(r.checks.some(c => c.field === 'interest_paid' && c.check === 'frequency'));
});

test('§6.1 term sheet vs filing: a different pricing date stores neither (fwp_conflict)', () => {
  const s = synthetic('<p>Pricing Supplement No. 5 dated May 1, 2026</p><p>Trade Date: May 1, 2026</p>', [{ coupon_rate: 4, maturity_date: '2029-05-05', principal_amount: 1e8, tranche_label: 'Notes due 2029' }]);
  const r = extractOffering({ ...s, fwps: [{ accessionNumber: '0000000000-26-000002', url: 'https://x/fwp.htm', html: '<p>Pricing Term Sheet</p><p>Trade Date: April 30, 2026</p>' }], ingestedAt: AT });
  assert.equal(fact(r, 'priced_on'), undefined);
  assert.ok(r.checks.some(c => c.field === 'priced_on' && c.check === 'fwp_conflict'));
});

test('checkAgainstIssuance: offering terms must agree with the stored bond_issuance row', () => {
  const r = run('unh-424b5-final-2025-06-18');
  const rows = r.parsed.rows.map(x => ({ ...x }));
  assert.deepEqual(checkAgainstIssuance(r.facts, rows), []);
  rows[1].coupon_rate = 4.75; rows[2].maturity_date = '2035-06-16';
  const bad = checkAgainstIssuance(r.facts, rows);
  assert.deepEqual(bad.map(b => [b.field, b.tranche_seq]), [['interest_rate', 2], ['maturity', 3]]);
  assert.equal(checkAgainstIssuance(r.facts, rows.slice(1)).filter(b => b.detail === 'no bond_issuance row').length, 4);
});

// ── Source references (BOND-10) ──────────────────────────────────────────

test('pages: printed "S-n" footers form a run; cross-references and the table of contents do not', () => {
  const { html } = fx('unh-424b5-final-2025-06-18');
  const { text, anchors } = decode(html);
  const p = pageMarkers(text);
  const arabic = p.filter(x => /^S-\d+$/.test(x.label)).map(x => x.label);
  assert.equal(arabic[0], 'S-1');
  assert.ok(arabic.length >= 20);
  assert.ok(arabic.every((l, i) => i === 0 || Number(l.slice(2)) > Number(arabic[i - 1].slice(2))));
  assert.ok(anchors.length >= 5 && anchors.every(a => a.at >= 0 && a.at <= text.length && a.heading));
  assert.equal(text, decodedText(html));
  assert.deepEqual(pageMarkers(decodedText(fx('cat-424b3-mtn-2026-08-13').html)), []);
});

test('namedTranches: years, shared years with rate words, coupons, series', () => {
  const tr = [{ seq: 1, year: 2026, rate: 'floating', coupon: null }, { seq: 2, year: 2026, rate: 'fixed', coupon: 4.8 }, { seq: 3, year: 2029, rate: 'fixed', coupon: 4.65 }];
  assert.deepEqual([...namedTranches('the Floating Rate Notes', tr)], [1]);
  assert.deepEqual([...namedTranches('the 2026 Fixed Rate Notes', tr)], [2]);
  assert.deepEqual([...namedTranches('the 2026 Notes', tr)], [2]);
  assert.deepEqual([...namedTranches('the 2029 notes', tr)], [3]);
  assert.deepEqual([...namedTranches('4.650% Notes', tr)], [3]);
  assert.deepEqual([...namedTranches('the notes', tr)], []);
  assert.equal(trusteeKey('U.S. Bank Trust Company, National Association'), 'usbtc');
  assert.equal(trusteeKey('Barclays Capital Inc.'), null);
});
