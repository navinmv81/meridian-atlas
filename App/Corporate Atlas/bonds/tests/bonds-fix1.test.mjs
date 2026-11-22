// MA-NOV-BOND.FIX1 tests — parser 1.3.0 (spec MA-NOV-BOND v1 §4 F1–F4, F7, F8; §5 reason codes).
// Local only: fixtures in ../fixtures (copied from state/cache), 0 SEC requests, 0 D1 calls.
//   node --test "App/Corporate Atlas/bonds/tests/"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { loadConfig, sha256, statePaths } from '../bonds-lib.mjs';
import { linkDrafts, run } from '../bonds-ingest.mjs';
import { PARSER_VERSION, draftTrancheLines, extractTitle, htmlToText, parseFiling } from '../bonds-parse.mjs';

const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const manifest = JSON.parse(readFileSync(path.join(FX, 'manifest.json'), 'utf8')).fixtures;
const fx = name => {
  const m = manifest.find(x => x.name === name);
  assert.ok(m, `fixture ${name} in manifest`);
  const html = gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8');
  assert.equal(sha256(html), m.html_sha256, `${name}: fixture SHA-256`);
  return { m, filing: { accessionNumber: m.accession, form: m.form, filingDate: m.filing_date, cik: m.cik, url: m.url, fileNumber: m.file_number }, html };
};
const parse = (name, opts) => { const { filing, html } = fx(name); return parseFiling(filing, html, { ingestedAt: '2026-11-22T00:00:00Z', ...opts }); };
// The runner's per-filing record (bonds-ingest.mjs filingsOut), as linkDrafts reads it.
const rec = (name, over = {}) => {
  const { m } = fx(name);
  const r = parse(name);
  return { accession: m.accession, cik: m.cik, row_cik: null, file_number: m.file_number, filing_date: m.filing_date, status: r.status,
    draft_lines: r.draftLines ?? null, rows: r.rows, ...over };
};

// Spec v1 §5 reason codes (the parser's vocabulary; 'superseded' is set by the runner).
const CODES = new Set(['superseded', 'draft_no_final', 'draft_not_debt', 'draft_structured', 'structured', 'equity', 'stock_plan', 'exchange_offer',
  'merger_document', 'demand_note', 'remarketing', 'resale', 'program_supplement', 'no_maturity', 'no_principal', 'low_confidence', 'fwp_conflict', 'no_tranche']);

// FIX2 (1.3.1): the version moved on; asserted in bonds-fix2.test.mjs.
test('FIX1: parser version is bonds-1.3.x', () => { assert.match(PARSER_VERSION, /^bonds-1\.3\.\d$/); });

// ── F1 title gate for drafts ─────────────────────────────────────────────

test('F1: a draft for shares or equity units → skipped_non_debt, draft_not_debt (Duke equity units, Boeing common stock)', () => {
  for (const n of ['duke-424b5-prelim-2026-08-10', 'boeing-424b5-prelim-common-2024-10-28']) {
    const r = parse(n);
    assert.equal(r.status, 'skipped_non_debt', n);
    assert.match(r.rule, /^F1 R2 \/ 7\.3-3$/, n);
    assert.deepEqual(r.rows.map(x => [x.tranche_seq, x.filing_status, x.status_reason]), [[0, 'skipped_non_debt', 'draft_not_debt']], n);
  }
});

test('F1: a market-linked Wells Fargo preliminary pricing supplement → skipped_structured, draft_structured', () => {
  const r = parse('wells-424b2-prelim-structured-2026-10-01');
  assert.equal(r.status, 'skipped_structured');
  assert.equal(r.rule, 'F1 R2 / 7.3-2');
  assert.equal(r.rows[0].status_reason, 'draft_structured');
});

test('F1: a debt draft stays preliminary, reason draft_no_final, with its cover tranche-line count', () => {
  const cases = [['unh-424b5-prelim-2025-06-17', 4], ['ice-424b5-prelim-2026-08-11', 5], ['nextera-424b5-prelim-series-q-2024-02-27', 1]];
  for (const [n, lines] of cases) {
    const r = parse(n);
    assert.equal(r.status, 'preliminary', n);
    assert.equal(r.rows.length, 1, n);
    assert.equal(r.rows[0].status_reason, 'draft_no_final', n);
    assert.equal(r.draftLines, lines, n);
  }
  assert.equal(draftTrancheLines('$ $ Floating Rate Notes due , 20 $ % Notes due , 20 $ % Debentures, Series due , 2031'), 3);
});

// ── F2 deal-level draft → final match (runner) ───────────────────────────

test('F2: UnitedHealth draft (4 lines) → superseded by the final filed the next day (4 tranches)', () => {
  const d = rec('unh-424b5-prelim-2025-06-17'), f = rec('unh-424b5-final-2025-06-18');
  const links = linkDrafts([d, f]);
  assert.deepEqual(links, [{ draft: d.accession, final: f.accession, gap_days: 1, draft_lines: 4, rule: 'count' }]);   // FIX2: links name their rule
  assert.equal(d.rows[0].status_reason, 'superseded');
  assert.equal(d.rows[0].superseded_by, f.accession);
  assert.ok(f.rows.every(r => r.superseded_by === undefined), 'the final is not touched');
});

test('F2: ICE draft offered 5 tranches, the final 4 (the floater was dropped) → draft_no_final under the ≤ rule', () => {
  const d = rec('ice-424b5-prelim-2026-08-11'), f = rec('ice-424b5-final-2026-08-13');
  assert.equal(f.rows.filter(r => r.tranche_seq > 0).length, 4);
  linkDrafts([d, f]);
  assert.equal(d.rows[0].status_reason, 'draft_no_final');
  assert.equal(d.rows[0].superseded_by, null);
});

test('F2: NextEra parent draft → NextEra Capital final (issuer family: polled under the parent, rows under the co-registrant)', () => {
  const d = rec('nextera-424b5-prelim-series-q-2024-02-27');
  const f = rec('nextera-424b5-final-series-q-2024-02-28', { row_cik: '0000794447' });
  for (const r of f.rows) r.cik = '0000794447';
  linkDrafts([d, f]);
  assert.equal(d.rows[0].status_reason, 'superseded');
  assert.equal(d.rows[0].superseded_by, f.accession);
  // The same final discovered under the subsidiary's own CIK matches only through the family map.
  const d2 = rec('nextera-424b5-prelim-series-q-2024-02-27'), f2 = rec('nextera-424b5-final-series-q-2024-02-28', { cik: '0000794447' });
  linkDrafts([d2, f2]);
  assert.equal(d2.rows[0].status_reason, 'draft_no_final');
  linkDrafts([d2, f2], { parentOf: new Map([['0000794447', '0000753308']]) });
  assert.equal(d2.rows[0].superseded_by, f2.accession);
});

test('F2: no link across shelves, outside 0–14 days, to an earlier final, or to another issuer; nearest final wins', () => {
  const base = () => rec('unh-424b5-prelim-2025-06-17');
  const fin = over => rec('unh-424b5-final-2025-06-18', over);
  for (const over of [{ file_number: '333-999999' }, { filing_date: '2025-07-02' }, { filing_date: '2025-06-16' }, { cik: '0000078003' }]) {
    const d = base();
    linkDrafts([d, fin(over)]);
    assert.equal(d.rows[0].status_reason, 'draft_no_final', JSON.stringify(over));
  }
  const d = base();
  linkDrafts([d, fin({ accession: 'far', filing_date: '2025-06-30' }), fin({ accession: 'near', filing_date: '2025-06-20' })]);
  assert.equal(d.rows[0].superseded_by, 'near');
});

test('F2/F8 (runner dry run): the record carries superseded + superseded_by; the SQL does not (no D1 column before BOND-CR1)', async () => {
  const issuer = { seq: 18, cik: '0000731766', name: 'UnitedHealth Group' };
  const docs = ['unh-424b5-prelim-2025-06-17', 'unh-424b5-final-2025-06-18', 'unh-fwp-2025-06-17'].map(n => fx(n).m);
  const recent = { accessionNumber: [], filingDate: [], form: [], fileNumber: [], primaryDocument: [], primaryDocDescription: [] };
  for (const m of [...docs].reverse()) {
    recent.accessionNumber.push(m.accession); recent.filingDate.push(m.filing_date); recent.form.push(m.form);
    recent.fileNumber.push('333-270279'); recent.primaryDocument.push(m.url.split('/').pop()); recent.primaryDocDescription.push(m.form);
  }
  for (const k of Object.keys(recent)) recent[k].push(k === 'filingDate' ? '2020-01-01' : k === 'form' ? '10-K' : 'x');
  const sec = { count: 0, errors: 0, async get(url) {
    this.count++;
    if (url.includes('/submissions/')) return { status: 200, text: JSON.stringify({ name: 'UNITEDHEALTH GROUP INC', filings: { recent, files: [] } }) };
    const m = docs.find(d => d.url === url);
    return m ? { status: 200, text: gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8') } : { status: 404, text: null };
  } };
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-fix1-')));
  const r = await run({ mode: 'initial', 'dry-run': true }, { paths: P, config: { ...loadConfig(), issuers: [issuer] }, sec, log: () => {} });
  assert.equal(r.event, 'success');
  const draft = r.filings.find(f => f.status === 'preliminary');
  assert.equal(draft.rows[0].status_reason, 'superseded');
  assert.equal(draft.rows[0].superseded_by, r.filings.find(f => f.status === 'debt').accession);
  const sql = readFileSync(r.sqlFile, 'utf8');
  assert.doesNotMatch(sql, /status_reason|superseded/);
  const json = JSON.parse(readFileSync(r.jsonFile, 'utf8'));
  assert.equal(json.filings.find(f => f.status === 'preliminary').rows[0].superseded_by, draft.rows[0].superseded_by);
});

// ── F3 programme supplements ─────────────────────────────────────────────

test('F3: MTN / term-note programme supplements (Caterpillar Series L, Toyota Series B, GM Term Notes) → skipped_other, program_supplement', () => {
  for (const n of ['cat-424b2-program-series-l-2026-03-27', 'toyota-424b2-program-series-b-2024-01-22', 'gm-424b5-program-term-notes-2025-12-05']) {
    const r = parse(n);
    assert.equal(r.status, 'skipped_other', n);
    assert.equal(r.rule, '7.3-5iv', n);
    assert.deepEqual(r.rows.map(x => [x.tranche_seq, x.filing_status, x.status_reason]), [[0, 'skipped_other', 'program_supplement']], n);
  }
});

test('F3: priced drawdowns under the same programmes still parse (Caterpillar, Toyota, Deere pricing supplements)', () => {
  for (const n of ['cat-424b3-mtn-2026-08-13', 'toyota-424b2-mtn-callable-2026-04-15', 'deere-424b2-mtn-floating-2026-09-09', 'toyota-424b2-mtn-frn-2026-03-11']) {
    const r = parse(n);
    assert.equal(r.status, 'debt', n);
    assert.ok(r.rows.length >= 1 && r.rows.every(x => x.filing_status === 'final'), n);
  }
});

// ── F4 maturity wording ──────────────────────────────────────────────────

test('F4: GM May 2025 year-only tranches → full maturities; the disagreeing description date is noted, the labelled one taken', () => {
  const r = parse('gm-424b2-year-only-maturity-2025-05-28');
  assert.deepEqual(r.rows.map(x => [x.filing_status, x.coupon_rate, x.principal_amount, x.maturity_date]), [
    ['final', 5, 500000000, '2027-07-15'], ['final', 5.45, 1000000000, '2030-07-15'], ['final', 6.15, 750000000, '2035-07-15']]);
  for (const t of [1, 2]) assert.ok(r.notes.some(n => n.startsWith(`tranche ${t}: maturity statements disagree`) && n.includes('Maturity Date')), `note for tranche ${t}`);
  assert.ok(!r.notes.some(n => n.startsWith('tranche 3: maturity')), 'tranche 3 resolved by the 1.2.0 coupon rule, no note');
});

test('F4: Duke "will mature as to principal on September 1, 2054" → final', () => {
  const r = parse('duke-424b5-reset-junior-sub-2024-08-20');
  assert.equal(r.status, 'debt');
  assert.deepEqual(r.rows.map(x => [x.filing_status, x.coupon_rate, x.principal_amount, x.maturity_date, x.seniority]),
    [['final', 6.45, 1000000000, '2054-09-01', 'junior_subordinated']]);
});

// ── F7 remarketing ───────────────────────────────────────────────────────

test('F7: NextEra Series M remarketing (R-4) → skipped_other, remarketing; its draft too (F1 order)', () => {
  const r = parse('nextera-424b2-remarketing-2025-07-30');
  assert.equal(r.status, 'skipped_other');
  assert.equal(r.rule, '7.3-1 F7');
  assert.deepEqual(r.rows.map(x => [x.tranche_seq, x.filing_status, x.status_reason]), [[0, 'skipped_other', 'remarketing']]);
  const d = parse('nextera-424b5-prelim-remarketing-2025-07-29');
  assert.equal(d.status, 'skipped_other');
  assert.equal(d.rows[0].status_reason, 'remarketing');
  // Equity units describe a future remarketing; they stay non-debt.
  assert.equal(parse('duke-424b5-equity-units-2026-08-12').rows[0].status_reason, 'equity');
});

// ── F8 reason codes on every fixture ─────────────────────────────────────

test('F8: every non-final row has a §5 reason code; a final is complete (null) or partial with what is missing', () => {
  let n = 0;
  for (const m of manifest) {
    const r = parse(m.name);
    for (const x of r.rows) {
      n++;
      if (x.filing_status === 'final') {
        if (x.status_reason === null) assert.equal(x.missing, undefined, `${m.name} #${x.tranche_seq}`);
        else { assert.equal(x.status_reason, 'partial', m.name); assert.ok(x.missing.length > 0, m.name); }
        if (x.missing?.includes('cusip')) assert.ok(!x.cusip && !x.isin);
      } else assert.ok(CODES.has(x.status_reason), `${m.name} #${x.tranche_seq}: ${x.filing_status} reason ${x.status_reason}`);
    }
  }
  assert.ok(n > 60, `rows checked ${n}`);
});

test('F8: specific codes — partial without CUSIP, complete with the FWP, exchange offer, demand note, merger, stock plan, structured', () => {
  const unh = parse('unh-424b5-final-2025-06-18');
  assert.ok(unh.rows.every(x => x.status_reason === 'partial' && x.missing.join() === 'cusip'));
  const fwp = fx('unh-fwp-2025-06-17');
  const full = parse('unh-424b5-final-2025-06-18', { fwps: [{ accessionNumber: fwp.m.accession, html: fwp.html }] });
  assert.ok(full.rows.every(x => x.status_reason === null && x.missing === undefined));
  const want = { 'verizon-424b3-exchange-offer-2025-11-24': 'exchange_offer', 'realty-424b3-exchange-offer-2024-01-03': 'exchange_offer',
    'toyota-424b2-demand-note-incomedriver': 'demand_note', 'unp-424b3-merger-proxy-2025-10-01': 'merger_document',
    'dominion-424b3-stock-plan-2025-11-03': 'stock_plan', 'wells-424b2-structured': 'structured', 'duke-424b5-equity-units-2026-08-12': 'equity' };
  for (const [n, code] of Object.entries(want)) assert.equal(parse(n).rows[0].status_reason, code, n);
  const draft = parse('gm-424b2-placeholder-2025-03-03');   // B-1b draft: the parser alone cannot see a final
  assert.equal(draft.rows[0].status_reason, 'draft_no_final');
});

test('F8: per-tranche parse_failed reasons — no_maturity, no_principal, fwp_conflict', () => {
  const doc = body => `<html><body><p>PROSPECTUS SUPPLEMENT</p>${body}</body></html>`;
  const f = { accessionNumber: '0000000000-26-000001', form: '424B2', filingDate: '2026-01-01', cik: '0000000001', url: 'x' };
  const noMat = parseFiling(f, doc('<p>$500,000,000 4.500% Notes due 2031</p><p>We are offering the notes.</p>'));
  assert.equal(noMat.rows[0].filing_status, 'parse_failed');
  assert.equal(noMat.rows[0].status_reason, 'no_maturity');
  const noPrin = parseFiling(f, doc('<p>4.500% Notes due March 1, 2031</p><p>We are offering the notes.</p>'));
  assert.equal(noPrin.rows[0].status_reason, 'no_principal');
  const fwpHtml = '<html><body><p>Free Writing Prospectus 4.500% Notes due 2031</p><p>Principal Amount: $400,000,000</p><p>Maturity Date: March 1, 2031</p></body></html>';
  const conflict = parseFiling(f, doc('<p>$500,000,000 4.500% Notes due March 1, 2031</p><p>We are offering the notes.</p>'), { fwps: [{ accessionNumber: 'fwp', html: fwpHtml }] });
  assert.equal(conflict.rows[0].filing_status, 'parse_failed');
  assert.equal(conflict.rows[0].status_reason, 'fwp_conflict');
});

test('F8: a title-less 424B is parse_failed with no_tranche', () => {
  const r = parseFiling({ accessionNumber: 'a', form: '424B2', filingDate: '2026-01-01', cik: '1', url: 'x' }, '<html><body><p>PROSPECTUS SUPPLEMENT</p><p>Something else entirely.</p></body></html>');
  assert.equal(r.status, 'parse_failed');
  assert.equal(r.rows[0].status_reason, 'no_tranche');
  assert.ok(extractTitle(htmlToText('<p>x</p>')));
});
