// MA-OCT-008 runner and gate tests (spec rev 1.2 §9.3; AC6–AC9, AC14, AC15).
// Local only: a fake SEC client serves the fixtures, a fake D1 records batches.
// 0 SEC requests, 0 D1 calls, 0 heartbeats.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { calendarGate, headroomDecision, liveConfigProblems, loadConfig, readJsonl, statePaths, utcDate } from '../bonds-lib.mjs';
import { indexUrl, insertSql, packBatches, parseFilingIndex, run, sameDealFwps } from '../bonds-ingest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, '..', 'fixtures');
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const FREEZES = path.join(REPO, 'claude', 'relays', 'FREEZES.json');
const manifest = JSON.parse(readFileSync(path.join(FX, 'manifest.json'), 'utf8')).fixtures;
const at = s => new Date(s);

// ── Calendar and FREEZES.json (AC9, AC14) ────────────────────────────────

test('AC9: live batches only Tue–Fri and outside every FREEZES.json window, incl. the 011 window', () => {
  const ok = s => assert.equal(calendarGate(at(s), FREEZES).ok, true, s);
  const no = s => assert.equal(calendarGate(at(s), FREEZES).ok, false, s);
  ok('2026-10-15T08:30:00Z');            // Thu 15, after the bootstrap buffer
  no('2026-10-15T06:00:00Z');            // enrich 05:50–07:10
  no('2026-10-15T08:00:00Z');            // bootstrap 07:55–08:05
  no('2026-10-15T10:50:00Z');            // boost AM band
  no('2026-10-16T16:50:00Z');            // boost PM band
  no('2026-10-16T23:55:00Z');            // UTC midnight F-3
  no('2026-10-14T09:00:00Z');            // ENT-CR1 fallback window (dated)
  no('2026-10-18T09:00:00Z');            // Sunday
  no('2026-10-19T09:00:00Z');            // Monday
  no('2026-10-20T09:00:00Z');            // Tue 20: inside the 011 window (other Entities writers frozen)
  ok('2026-10-27T09:00:00Z');            // Tue 27 fallback slot
});

test('AC14: a missing or unparseable FREEZES.json fails closed (reason out_of_window, freezes_unavailable)', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'bonds-'));
  const r1 = calendarGate(at('2026-10-15T08:30:00Z'), path.join(d, 'absent.json'));
  assert.deepEqual([r1.ok, r1.reason, r1.detail], [false, 'out_of_window', 'freezes_unavailable']);
  writeFileSync(path.join(d, 'bad.json'), '{not json');
  assert.equal(calendarGate(at('2026-10-15T08:30:00Z'), path.join(d, 'bad.json')).detail, 'freezes_unavailable');
});

// ── Headroom (AC8; ML-1012-1 values) ─────────────────────────────────────

const LIM = { accountCeiling: 60000, unpolledWindowMs: 45 * 60000, runCap: 8000 };
const own = (today = 0, recent = 0) => ({ todayWrites: today, rowsSince: () => recent });
const reading = (n, now, ageMs = 1000) => ({ rowsWritten: n, date: utcDate(now), fetchedAt: new Date(now - ageMs).toISOString() });

test('AC8: d1-today unavailable, stale (> 120 s), another UTC day, or lower than before (F-2) → headroom_unavailable', () => {
  const now = at('2026-10-15T09:00:00Z');
  const base = { now, batchWrites: 100, own: own(), limits: LIM };
  assert.equal(headroomDecision({ ...base, reading: null, fetchError: 'down' }).reason, 'headroom_unavailable');
  assert.equal(headroomDecision({ ...base, reading: reading(1000, now, 121000) }).reason, 'headroom_unavailable');
  assert.equal(headroomDecision({ ...base, reading: { ...reading(1000, now), date: '2026-10-14' } }).reason, 'headroom_unavailable');
  const st = { date: '2026-10-15', lastRowsWritten: 5000, lastFetchAt: '2026-10-15T08:58:00Z' };
  assert.equal(headroomDecision({ ...base, state: st, reading: reading(4000, now) }).reason, 'headroom_unavailable');
  assert.equal(headroomDecision({ ...base, state: st, reading: reading(5000, now) }).ok, true);
});

test('AC8 / F-3: no batch starts 23:50–00:10 UTC', () => {
  const now = at('2026-10-15T23:55:00Z');
  assert.equal(headroomDecision({ now, batchWrites: 1, own: own(), limits: LIM, reading: reading(0, now) }).reason, 'out_of_window');
});

test('F-1 (ML-1012-1): reading + own unpolled rows + batch ≤ 60,000; run cap 8,000', () => {
  const now = at('2026-10-15T09:00:00Z');
  assert.equal(headroomDecision({ now, batchWrites: 400, own: own(0, 1000), limits: LIM, reading: reading(58700, now) }).reason, 'headroom');
  assert.equal(headroomDecision({ now, batchWrites: 400, own: own(0, 900), limits: LIM, reading: reading(58700, now) }).ok, true);
  assert.equal(headroomDecision({ now, batchWrites: 400, own: own(7700, 0), limits: LIM, reading: reading(1000, now) }).reason, 'headroom');
});

test('AC15: no account_ceiling / unpolled_window_min in config → a live run refuses; a dry run is unaffected', async () => {
  const cfg = loadConfig();
  assert.deepEqual(liveConfigProblems(cfg), []);
  const bad = { ...cfg, account_ceiling: undefined };
  assert.ok(liveConfigProblems(bad).includes('account_ceiling missing'));
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const r = await run({ mode: 'initial' }, { paths: P, config: bad, log: () => {} });
  assert.equal(r.event, 'refused');
  const dry = await run({ mode: 'initial', 'dry-run': true, cik: '0000731766' }, { paths: P, config: { ...bad, issuers: [issuer] }, sec: fakeSec(), log: () => {} });
  assert.equal(dry.event, 'success');
});

// ── Batching ─────────────────────────────────────────────────────────────

test('§7.5: batches ≤ 100 statements and a filing is never split', () => {
  const f = (a, n) => ({ accession: a, rows: Array.from({ length: n }, (_, i) => ({ i })) });
  const b = packBatches([f('a', 60), f('b', 30), f('c', 20), f('d', 100)], 100);
  assert.deepEqual(b.map(x => [x.filings.join(''), x.rows.length]), [['ab', 90], ['c', 20], ['d', 100]]);
  assert.throws(() => packBatches([f('e', 101)], 100));
});

test('EP-1: literal SQL with single quotes doubled; NULLs and numbers unquoted', () => {
  const s = insertSql({ accession_number: '0001-26-1', tranche_seq: 1, cik: '0000000001', tranche_label: "Lowe's 4.5% Notes", coupon_rate: 4.5, isin: null });
  assert.match(s, /'Lowe''s 4\.5% Notes'/);
  assert.match(s, /^INSERT OR IGNORE INTO bond_issuance /);
  assert.match(s, /, 4\.5,/);
  assert.match(s, /NULL/);
});

test('§7.4: same-deal FWPs = same registration number, filed 0–3 days before', () => {
  const f = { fileNumber: '333-1', filingDate: '2025-06-18' };
  const xs = [{ fileNumber: '333-1', filingDate: '2025-06-17' }, { fileNumber: '333-1', filingDate: '2025-06-14' }, { fileNumber: '333-2', filingDate: '2025-06-17' }, { fileNumber: '333-1', filingDate: '2025-06-19' }];
  assert.deepEqual(sameDealFwps(f, xs, 3), [xs[0]]);
});

// ── Live run with fakes (AC6, AC7, AC14) ─────────────────────────────────

const issuer = { seq: 18, cik: '0000731766', name: 'UnitedHealth Group' };
const docs = ['unh-424b5-prelim-2025-06-17', 'unh-424b5-final-2025-06-18', 'unh-fwp-2025-06-17'].map(n => manifest.find(m => m.name === n));

function fakeSec() {
  const html = m => gunzipSync(readFileSync(path.join(FX, m.file))).toString('utf8');
  const recent = { accessionNumber: [], filingDate: [], form: [], fileNumber: [], primaryDocument: [], primaryDocDescription: [] };
  for (const m of [...docs].reverse()) {
    recent.accessionNumber.push(m.accession); recent.filingDate.push(m.filing_date); recent.form.push(m.form);
    recent.fileNumber.push('333-270279'); recent.primaryDocument.push(m.url.split('/').pop()); recent.primaryDocDescription.push(m.form);
  }
  // the fixture set's oldest filing is 2025-06-17; an older dummy row ends `recent` before the lookback (no files[] paging)
  for (const k of Object.keys(recent)) recent[k].push(k === 'filingDate' ? '2020-01-01' : k === 'form' ? '10-K' : 'x');
  let count = 0;
  return {
    get count() { return count; }, get errors() { return 0; },
    async get(url) {
      count++;
      if (url.includes('/submissions/')) return { status: 200, text: JSON.stringify({ name: 'UNITEDHEALTH GROUP INC', filings: { recent, files: [] } }) };
      const m = docs.find(d => d.url === url);   // the prelim and the final share a file name
      return m ? { status: 200, text: html(m) } : { status: 404, text: null, error: 'HTTP 404' };
    }
  };
}

function fakeD1({ hold = 'false', onExec = null } = {}) {
  const stored = new Set();
  const execs = [];
  return {
    stored, execs,
    async query(sql) {
      if (/hold_all_jobs/.test(sql)) { if (hold === 'throw') throw new Error('wrangler down'); return [{ results: hold === null ? [] : [{ value: hold }], meta: { rows_read: 1 } }]; }
      if (/FROM bond_issuer_link/.test(sql)) return [{ results: [{ cik: issuer.cik, entity_id: null, link_method: 'unmatched', status: 'active' }], meta: { rows_read: 1 } }];
      if (/FROM bond_issuance WHERE accession_number IN/.test(sql)) {
        const want = [...sql.matchAll(/'([0-9-]{20})'/g)].map(m => m[1]);
        return [{ results: want.filter(a => stored.has(a)).map(a => ({ accession_number: a })), meta: { rows_read: want.length } }];
      }
      throw new Error(`unexpected query ${sql.slice(0, 60)}`);
    },
    async execFile(file) {
      const text = readFileSync(file, 'utf8');
      const ins = [...text.matchAll(/VALUES \('([0-9-]{20})', (\d+)/g)];
      let w = 0;
      for (const m of ins) { const k = `${m[1]}#${m[2]}`; if (!stored.has(k)) { stored.add(k); w += 2; } stored.add(m[1]); }
      execs.push({ file, statements: ins.length, writes: w });
      if (onExec) onExec(execs.length);
      return [{ results: [], meta: { rows_written: w, rows_read: ins.length } }];
    }
  };
}

const liveDeps = (P, d1, over = {}) => ({ paths: P, config: { ...loadConfig(), issuers: [issuer], batch_max_statements: 4 }, sec: fakeSec(), d1, heartbeats: null,
  calendarGate: () => ({ ok: true }), fetchD1Today: async ({ now }) => ({ rowsWritten: 1000, date: utcDate(now()), fetchedAt: now().toISOString() }),
  now: () => new Date(), sleep: async () => {}, log: () => {}, ...over });

test('AC6: a completed run re-run with no new filings writes 0 rows', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const d1 = fakeD1();
  const r1 = await run({ mode: 'initial' }, liveDeps(P, d1));
  assert.equal(r1.event, 'success');
  assert.ok(r1.rows_written > 0);
  assert.equal(r1.metrics.final_tranches, 4);
  assert.equal(r1.metrics.preliminary, 1);
  const r2 = await run({ mode: 'incremental' }, liveDeps(P, d1));
  assert.equal(r2.event, 'success');
  assert.equal(r2.metrics.batches, 0);
  assert.equal(d1.execs.filter(e => !e.file.endsWith('polled.sql')).slice(r1.metrics.batches).length, 0, 'no bond batch on the re-run');
});

test('AC7: stop flag mid-run → in-flight batch completes, no further batch, terminal killed with a cursor', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const d1 = fakeD1({ onExec: n => { if (n === 1) writeFileSync(P.stop, 'test\n'); } });
  const r = await run({ mode: 'initial' }, liveDeps(P, d1));
  assert.equal(r.event, 'killed');
  assert.equal(d1.execs.length, 1);
  assert.ok(r.cursor.after);
  assert.equal(r.detail.reason, 'operator_stop');
  assert.ok(existsSync(P.cursor));
});

test('AC14: hold true / hold unreadable / pause flag → skipped with the right reason and 0 writes', async () => {
  for (const [hold, want] of [['true', { reason: 'hold' }], ['throw', { reason: 'hold', hold: 'unavailable' }], [null, { reason: 'hold', hold: 'unavailable' }]]) {
    const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
    const d1 = fakeD1({ hold });
    const r = await run({ mode: 'initial' }, liveDeps(P, d1));
    assert.equal(r.event, 'skipped');
    for (const [k, v] of Object.entries(want)) assert.equal(r.detail[k], v);
    assert.equal(d1.execs.length, 0);
  }
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  writeFileSync(path.join(P.state, 'PAUSE'), 'x');
  const r = await run({ mode: 'initial' }, liveDeps(P, fakeD1()));
  assert.deepEqual([r.event, r.detail.reason], ['skipped', 'pause']);
});

test('AC9 (runner): a freeze at start → skipped out_of_window, no SEC request', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const sec = fakeSec();
  const r = await run({ mode: 'initial' }, liveDeps(P, fakeD1(), { sec, calendarGate: () => ({ ok: false, reason: 'out_of_window', detail: 'boost AM' }) }));
  assert.deepEqual([r.event, r.detail.reason], ['skipped', 'out_of_window']);
  assert.equal(sec.count, 0);
});

test('AC8 (runner): d1-today unavailable before a batch → partial, headroom_unavailable, nothing written', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const d1 = fakeD1();
  const r = await run({ mode: 'initial' }, liveDeps(P, d1, { fetchD1Today: async () => { throw new Error('down'); } }));
  assert.deepEqual([r.event, r.detail.reason], ['partial', 'headroom_unavailable']);
  assert.equal(d1.execs.length, 0);
});

test('dry run: 0 D1 calls, writes the SQL and JSON record, logs the run', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const r = await run({ mode: 'initial', 'dry-run': true }, { paths: P, config: { ...loadConfig(), issuers: [issuer] }, sec: fakeSec(), log: () => {} });
  assert.equal(r.event, 'success');
  assert.equal(r.rows_written, 0);
  const sql = readFileSync(r.sqlFile, 'utf8');
  assert.equal((sql.match(/^INSERT OR IGNORE/gm) || []).length, 5);   // 1 preliminary audit row + 4 tranches
  assert.ok(readJsonl(P.runlog).some(x => x.kind === 'run_end' && x.dry_run));
});

// ── L8-12 co-registrants (own CIK; hold if unknown or mixed) ─────────────

const NEE = { seq: 27, cik: '0000753308', name: 'NextEra Energy' };
const coDoc = (issuerLine, guarantee = 'Unconditionally and Irrevocably Guaranteed by NextEra Energy, Inc.') => `<html><body>
  <p>Filed Pursuant to Rule 424(b)(2)</p><p>PROSPECTUS SUPPLEMENT (To prospectus dated March 22, 2024)</p><p>${issuerLine}</p>
  <p>$500,000,000 4.85% Debentures, Series due February 4, 2028</p><p>${guarantee}</p>
  <p>We are offering the debentures. CUSIP: 65339KDE7.</p></body></html>`;
// Real EDGAR index markup: the mailing address precedes each filer's name.
const INDEX = `<html><body><div class="mailer">Mailing Address <span class="mailerAddress">700 UNIVERSE BLVD</span> <span class="mailerAddress">JUNO BEACH FL</span></div>
  <div class="companyInfo"><span class="companyName">NEXTERA ENERGY INC (Filer)
  <acronym title="Central Index Key">CIK</acronym>: <a href="/cgi-bin/browse-edgar?CIK=0000753308&amp;action=getcompany">0000753308 (see all company filings)</a></span></div>
  <div class="mailer">Mailing Address <span class="mailerAddress">700 UNIVERSE BLVD</span></div>
  <div class="companyInfo"><span class="companyName">NEXTERA ENERGY CAPITAL HOLDINGS INC (Filer)
  <acronym title="Central Index Key">CIK</acronym>: <a href="/cgi-bin/browse-edgar?CIK=0000794447&amp;action=getcompany">0000794447 (see all company filings)</a></span></div></body></html>`;

function coSec(docs) {   // docs: [{ acc, date, html }]
  let count = 0;
  const recent = { accessionNumber: [], filingDate: [], form: [], fileNumber: [], primaryDocument: [], primaryDocDescription: [] };
  for (const d of docs) { recent.accessionNumber.push(d.acc); recent.filingDate.push(d.date); recent.form.push('424B2'); recent.fileNumber.push('333-9'); recent.primaryDocument.push(`${d.acc}.htm`); recent.primaryDocDescription.push('424B2'); }
  for (const k of Object.keys(recent)) recent[k].push(k === 'filingDate' ? '2020-01-01' : k === 'form' ? '10-K' : 'x');
  return {
    get count() { return count; }, get errors() { return 0; },
    async get(url) {
      count++;
      if (url.includes('/submissions/')) return { status: 200, text: JSON.stringify({ name: 'NEXTERA ENERGY INC', filings: { recent, files: [] } }) };
      if (url.endsWith('-index.htm')) return { status: 200, text: INDEX };
      const d = docs.find(x => url.endsWith(`/${x.acc}.htm`));
      return d ? { status: 200, text: d.html } : { status: 404, text: null };
    }
  };
}

test('parseFilingIndex: every filer on the accession with its CIK', () => {
  assert.deepEqual(parseFilingIndex(INDEX), [{ name: 'NEXTERA ENERGY INC', cik: '0000753308' }, { name: 'NEXTERA ENERGY CAPITAL HOLDINGS INC', cik: '0000794447' }]);
  assert.equal(indexUrl('0000753308', '0001193125-26-273933'), 'https://www.sec.gov/Archives/edgar/data/753308/000119312526273933/0001193125-26-273933-index.htm');
});

test('L8-12: co-registrant rows take the co-registrant CIK; unknown or mixed covers are held and not written', async () => {
  const P = statePaths(mkdtempSync(path.join(tmpdir(), 'bonds-')));
  const sec = coSec([
    { acc: '0000000001-26-000001', date: '2026-02-05', html: coDoc('NextEra Energy Capital Holdings, Inc.') },
    { acc: '0000000001-26-000002', date: '2026-02-06', html: coDoc('NextEra Energy Capital Holdings, Inc.') },
    { acc: '0000000001-26-000003', date: '2026-02-07', html: coDoc('NextEra Energy Capital Holdings, Inc. and Example Finance LLC') },
    { acc: '0000000001-26-000004', date: '2026-02-08', html: coDoc('NextEra Energy, Inc.', 'Fully and Unconditionally Guaranteed by NextEra Energy, Inc.') }
  ]);
  const r = await run({ mode: 'initial', 'dry-run': true }, { paths: P, config: { ...loadConfig(), issuers: [NEE] }, sec, log: () => {} });
  const byAcc = Object.fromEntries(r.filings.map(f => [f.accession, f]));
  assert.equal(byAcc['0000000001-26-000001'].row_cik, '0000794447');
  assert.ok(byAcc['0000000001-26-000001'].rows.every(x => x.cik === '0000794447'));
  assert.equal(byAcc['0000000001-26-000002'].row_cik, '0000794447');
  assert.match(byAcc['0000000001-26-000003'].held, /mixed cover/);
  assert.match(byAcc['0000000001-26-000004'].held, /no co-registrant issuer named/);
  const sql = readFileSync(r.sqlFile, 'utf8');
  assert.ok(!sql.includes('0000000001-26-000003') && !sql.includes('0000000001-26-000004'), 'held filings are not written');
  assert.ok(!sql.includes("'0000753308'"), 'never written under the parent CIK');
  const j = JSON.parse(readFileSync(r.jsonFile, 'utf8'));
  assert.deepEqual(j.co_registrants.map(x => [x.cik, x.status, x.parent_cik]), [['0000794447', 'paused', '0000753308']]);
  assert.equal(sec.count, 1 + 4 + 1, 'one index request for the co-registrant');
  assert.ok(readJsonl(P.runlog).some(x => x.kind === 'filing' && x.final_paths && x.final_paths['B-3a'] >= 1), 'B-3 path logged');
});
