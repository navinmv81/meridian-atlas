// MA-NOV-BOND.FIX2 tests — parser 1.3.1 (spec MA-NOV-BOND v1 §4 F5, F6; v2 §1.2, §3 #12, §4; Main Lane F2b).
// Local only: fixtures in ../fixtures (copied from state/cache), 0 SEC requests, 0 D1 calls.
//   node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { sha256 } from '../bonds-lib.mjs';
import { COLS, insertSql, linkDrafts, trancheSubset } from '../bonds-ingest.mjs';
import { PARSER_VERSION, draftTranches, extractTitle, fwpTermSheet, htmlToText, parseFiling } from '../bonds-parse.mjs';

const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const manifest = JSON.parse(readFileSync(path.join(FX, 'manifest.json'), 'utf8')).fixtures;
const fx = name => {
  const m = manifest.find(x => x.name === name);
  assert.ok(m, `fixture ${name} in manifest`);
  const html = gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8');
  assert.equal(sha256(html), m.html_sha256, `${name}: fixture SHA-256`);
  return { m, html, filing: { accessionNumber: m.accession, form: m.form, filingDate: m.filing_date, cik: m.cik, url: m.url, fileNumber: m.file_number } };
};
const fwp = name => { const { m, html } = fx(name); return { accessionNumber: m.accession, html }; };
const parse = (name, fwps = []) => { const { filing, html } = fx(name); return parseFiling(filing, html, { fwps: fwps.map(fwp), ingestedAt: '2026-11-22T00:00:00Z' }); };
const ids = r => r.rows.map(x => [x.tranche_seq, x.cusip, x.isin]);
const rec = (name, over = {}) => {
  const { m } = fx(name);
  const r = parse(name);
  return { accession: m.accession, cik: m.cik, row_cik: null, file_number: m.file_number, filing_date: m.filing_date, status: r.status,
    draft_lines: r.draftLines ?? null, draft_tranches: r.draftTranches ?? null, rows: r.rows, ...over };
};

test('FIX2: parser version is bonds-1.3.1', () => { assert.equal(PARSER_VERSION, 'bonds-1.3.1'); });

// ── F6 identifiers from same-deal term sheets ────────────────────────────

test('F6 labelled: Verizon "CUSIP: Notes due 2033: 92343V HF4 …" — all 5 tranches get their CUSIP and ISIN (none without the FWP)', () => {
  const before = parse('verizon-424b2-multi-2025-11-12');
  assert.ok(before.fwpNeeded);
  assert.ok(before.rows.every(r => r.filing_status === 'final' && !r.cusip && r.status_reason === 'partial'));
  const r = parse('verizon-424b2-multi-2025-11-12', ['verizon-fwp-labelled-2025-11-10']);
  assert.deepEqual(ids(r), [[1, '92343VHF4', 'US92343VHF40'], [2, '92343VHG2', 'US92343VHG23'], [3, '92343VHH0', 'US92343VHH06'],
    [4, '92343VHJ6', 'US92343VHJ61'], [5, '92343VHK3', 'US92343VHK35']]);
  assert.ok(r.rows.every(x => x.filing_status === 'final' && x.status_reason === null && x.id_source === 'fwp 0001193125-25-274844 (labelled)'));
  assert.ok(r.rows.every(x => x.instrument_key === x.isin), 'instrument_key = ISIN (007 E8)');
});

test('F6 columns: PepsiCo — one CUSIP / ISIN per column in title-row order, even where CUSIP order differs from maturity order', () => {
  const r = parse('pepsico-424b2-multi-2025-02-07', ['pepsico-fwp-columns-2025-02-05']);
  assert.deepEqual(r.rows.map(x => [x.coupon_rate, x.maturity_date, x.cusip]),
    [[4.4, '2027-02-07', '713448GD4'], [4.45, '2028-02-07', '713448GA0'], [4.6, '2030-02-07', '713448GB8'], [5, '2035-02-07', '713448GC6']]);
  assert.ok(r.rows.every(x => /\(columns\)$/.test(x.id_source)));
});

test('F6 sections: AbbVie — 9 blocks, a floating and a fixed tranche both due 2028 kept apart', () => {
  const r = parse('abbvie-424b5-multi-2026-08-18', ['abbvie-fwp-sections-2026-08-14']);
  assert.equal(r.rows.length, 9);
  assert.deepEqual(r.rows.slice(0, 2).map(x => [x.rate_type, x.maturity_date, x.cusip]), [['floating', '2028-08-18', '00287YEL9'], ['fixed', '2028-08-18', '00287YEK1']]);
  assert.deepEqual(r.rows.map(x => x.cusip), ['00287YEL9', '00287YEK1', '00287YEM7', '00287YEN5', '00287YEP0', '00287YEQ8', '00287YER6', '00287YES4', '00287YET2']);
  assert.ok(r.rows.every(x => x.status_reason === null));
});

test('F6 single: Toyota — one term sheet per tranche; a sheet naming the concurrent tranches still keys to its own', () => {
  const r = parse('toyota-424b2-four-tranche-2024-01-05', ['toyota-fwp-single-floating-2024-01-02', 'toyota-fwp-single-fixed-2026-2024-01-02']);
  assert.deepEqual(ids(r).slice(0, 2), [[1, '89236TLK9', 'US89236TLK96'], [2, '89236TLJ2', 'US89236TLJ24']]);
  assert.deepEqual(r.rows.slice(2).map(x => [x.cusip, x.status_reason]), [[null, 'partial'], [null, 'partial']], 'no sheet given for the 2029 / 2034 tranches');
  const floating = fwpTermSheet(fwp('toyota-fwp-single-floating-2024-01-02').html);
  assert.deepEqual(floating.ids, [{ cusip: '89236TLK9', isin: 'US89236TLK96', year: 2026, coupon: null, rate: 'floating', layout: 'single', currency: null, maturity: '2026-01-05' }]);
});

test('F6 safety: an identifier that fits two tranches, or two identifiers for one tranche, is dropped (synthetic sheets)', () => {
  const html = s => `<html><body><p>${s}</p></body></html>`;
  const r = parseFiling({ accessionNumber: 'x', form: '424B2', filingDate: '2026-01-02', cik: '1', url: 'u' },
    html('PROSPECTUS SUPPLEMENT $500,000,000 4.000% Notes due 2030 $500,000,000 5.000% Notes due 2030 We are offering the notes.'),
    { fwps: [{ accessionNumber: 'f1', html: html('Pricing Term Sheet CUSIP: 2030 Notes: 45865V AA8') },
             { accessionNumber: 'f2', html: html('Pricing Term Sheet 4.000% Notes due 2035 CUSIP: 45865V AC4 Other: 45865V AA8') }] });
  assert.ok(r.rows.every(x => !x.cusip), 'year-only label fits both 2030 tranches → not assigned');
  const ts = fwpTermSheet(html('Title: 3.000% Notes due 2031 CUSIP/ISIN/Common Code: 71708L AA7 / XS3019313363 / 301931336'));
  assert.deepEqual(ts.ids, [{ cusip: '71708LAA7', isin: 'XS3019313363', year: 2031, coupon: 3, rate: 'fixed', layout: 'single', currency: null, maturity: null }], 'a Common Code is not a CUSIP');
});

test('F6 guards: a sheet in another currency, or a one-tranche sheet with another maturity date, is another deal (AT&T EUR vs USD floaters)', () => {
  const html = s => `<html><body><p>${s}</p></body></html>`;
  const eur = { accessionNumber: 'x', form: '424B2', filingDate: '2026-08-11', cik: '1', url: 'u' };
  const cover = html('PROSPECTUS SUPPLEMENT €1,200,000,000 Floating Rate Global Notes due August 17, 2028 We will pay interest on the notes.');
  const usdSheet = { accessionNumber: 'f', html: html('Term Sheet $1,100,000,000 Floating Rate Global Notes due 2028 Maturity Date: August 10, 2028 CUSIP / ISIN: 00206R NX6 / US00206RNX60') };
  assert.equal(parseFiling(eur, cover, { fwps: [usdSheet] }).rows[0].cusip, null, 'USD sheet not used for the EUR notes');
  const sameCcyOtherDate = { accessionNumber: 'f', html: html('Term Sheet €1,100,000,000 Floating Rate Global Notes due 2028 Maturity Date: August 10, 2028 CUSIP / ISIN: 00206R NX6 / US00206RNX60') };
  assert.equal(fwpTermSheet(sameCcyOtherDate.html).ids[0].maturity, '2028-08-10', 'the one-tranche sheet carries its maturity for the F6 guard');
  const r = parseFiling(eur, cover, { fwps: [sameCcyOtherDate] }).rows[0];   // here the 1.2 reader matches first and its cross-check fails the row
  assert.deepEqual([r.filing_status, r.status_reason, r.id_source], ['parse_failed', 'fwp_conflict', undefined]);
  const match = { accessionNumber: 'f', html: html('Term Sheet €1,200,000,000 Floating Rate Global Notes due 2028 Maturity Date: August 17, 2028 CUSIP / ISIN: 00206R NX6 / US00206RNX60') };
  assert.equal(parseFiling(eur, cover, { fwps: [match] }).rows[0].cusip, '00206RNX6');
});

test('F6 / spec v2: pricing date and banks are captured from the term sheet (record only, not a column)', () => {
  const r = parse('verizon-424b2-multi-2025-11-12', ['verizon-fwp-labelled-2025-11-10']);
  assert.equal(r.offering.priced_on, '2025-11-10');
  assert.equal(r.offering.priced_on_source, 'fwp 0001193125-25-274844');
  assert.equal(r.offering.banks[0].role_printed, 'Joint Book-Running Managers');
  assert.ok(r.offering.banks[0].names.includes('Morgan Stanley & Co. LLC'));
  assert.ok(!COLS.includes('priced_on') && !insertSql(r.rows[0]).includes('2025-11-10'), 'not written before CR2');
  assert.equal(parse('verizon-424b2-multi-2025-11-12').offering, undefined, 'no term sheet → no offering record');
});

test('F6: the 1.2 term-sheet reader still runs first — ICE and UNH finals keep their FIX1 identifiers', () => {
  const r = parse('unh-424b5-final-2025-06-18', ['unh-fwp-2025-06-17']);
  assert.ok(r.rows.every(x => x.cusip && !x.id_source), 'UNH filled by the 1.2 reader, not by F6');
});

// ── F5 the three fwp_conflict rows ───────────────────────────────────────

test('F5 Verizon 2035: not a reopening — the term sheet splits $2.25bn into $1.6875bn to the public + $0.5625bn to the trust; total agrees → final, note', () => {
  const r = parse('verizon-424b2-trust-allocation-2025-03-26', ['verizon-fwp-trust-allocation-2025-03-24']);
  assert.deepEqual(r.rows.map(x => [x.filing_status, x.principal_amount, x.cusip, x.status_reason]), [['final', 2250000000, '92343VGZ1', null]]);
  assert.match(r.notes.join(' '), /2 allocations .*total agrees/);
});

test('F5 Dominion Series A / B 2056: not a reopening — two columns of one sheet were read as one tranche; now no false conflict', () => {
  const r = parse('dominion-424b2-series-a-b-2025-08-05', ['dominion-fwp-series-a-b-2025-08-04']);
  assert.deepEqual(r.rows.map(x => [x.tranche_seq, x.filing_status, x.principal_amount, x.status_reason]),
    [[1, 'final', 825000000, 'partial'], [2, 'final', 700000000, 'partial']]);
  assert.ok(!r.notes.some(n => /FWP disagreement/.test(n)));
});

test('F5: a real term-sheet disagreement still fails with fwp_conflict (synthetic)', () => {
  const html = s => `<html><body><p>${s}</p></body></html>`;
  const r = parseFiling({ accessionNumber: 'x', form: '424B2', filingDate: '2026-01-02', cik: '1', url: 'u' },
    html('PROSPECTUS SUPPLEMENT $500,000,000 4.000% Notes due June 1, 2030 We are offering the notes.'),
    { fwps: [{ accessionNumber: 'f', html: html('Term Sheet 4.000% Notes due 2030 Principal Amount: $750,000,000 Maturity Date: June 1, 2030') }] });
  assert.deepEqual(r.rows.map(x => [x.filing_status, x.status_reason]), [['parse_failed', 'fwp_conflict']]);
});

// ── F2b dropped tranche at pricing ───────────────────────────────────────

test('F2b: draft cover lines carry rate type and year; a repeated title sentence is one tranche', () => {
  assert.deepEqual(draftTranches('$ Floating Rate Notes due 2030 $ % Notes due 2030 $ % Notes due 20'),
    [{ rate: 'floating', year: 2030, series: null }, { rate: 'fixed', year: 2030, series: null }, { rate: 'fixed', year: null, series: null }]);
  const { header } = extractTitle(htmlToText(fx('southern-424b5-prelim-series-2025a-2025-01-08').html));
  assert.deepEqual(draftTranches(header), [{ rate: 'fixed', year: 2085, series: '2025A' }]);
});

test('F2b: ICE draft (floater + 4 fixed) → superseded by the 4-tranche final, note "tranche dropped at pricing"', () => {
  const d = rec('ice-424b5-prelim-2026-08-11'), f = rec('ice-424b5-final-2026-08-13');
  const links = linkDrafts([d, f]);
  assert.deepEqual(links, [{ draft: d.accession, final: f.accession, gap_days: 2, draft_lines: 5, rule: 'subset', note: 'tranche dropped at pricing' }]);
  assert.deepEqual([d.rows[0].status_reason, d.rows[0].superseded_by, d.rows[0].status_note], ['superseded', f.accession, 'tranche dropped at pricing']);
  assert.ok(!insertSql(d.rows[0]).includes('dropped'), 'the note is run log only');
});

test('F2b: Oracle draft (7 lines, years printed) → 6-tranche final; Southern one-tranche draft → final, no note', () => {
  const d = rec('oracle-424b2-prelim-2025-09-24'), f = rec('oracle-424b2-final-2025-09-25');
  assert.deepEqual(linkDrafts([d, f]).map(l => [l.final, l.rule, l.note]), [[f.accession, 'subset', 'tranche dropped at pricing']]);
  const sd = rec('southern-424b5-prelim-series-2025a-2025-01-08'), sf = rec('southern-424b2-final-series-2025a-2025-01-10');
  const l = linkDrafts([sd, sf]);
  assert.deepEqual(l.map(x => [x.final, x.rule, x.note ?? null]), [[sf.accession, 'subset', null]]);
  assert.equal(sd.rows[0].status_note, undefined);
});

test('F2b negatives: a final tranche the draft does not list, or a different year, does not link', () => {
  const rows = specs => specs.map(([rate, mat], i) => ({ tranche_seq: i + 1, rate_type: rate, maturity_date: mat }));
  const draft = [{ rate: 'floating', year: 2030, series: null }, { rate: 'fixed', year: 2030, series: null }, { rate: 'fixed', year: 2035, series: null }];
  assert.equal(trancheSubset(rows([['fixed', '2030-01-01'], ['fixed', '2035-01-01']]), draft), true);
  assert.equal(trancheSubset(rows([['fixed', '2031-01-01']]), draft), false, 'year not on the draft');
  assert.equal(trancheSubset(rows([['fixed', '2030-01-01'], ['fixed', '2030-06-01'], ['fixed', '2035-01-01']]), draft), false, 'two fixed 2030 for one line');
  assert.equal(trancheSubset(rows([['fixed_to_floating', '2030-01-01']]), draft), false, 'rate type differs');
  assert.equal(trancheSubset(rows([['fixed', '2030-01-01']]), null), false, 'no cover lines → no subset link');
  // Still same issuer family, shelf and 0–14 days (F2 rules unchanged).
  const d = rec('ice-424b5-prelim-2026-08-11'), f = rec('ice-424b5-final-2026-08-13', { file_number: '333-000000' });
  assert.equal(linkDrafts([d, f])[0].final, null);
});
