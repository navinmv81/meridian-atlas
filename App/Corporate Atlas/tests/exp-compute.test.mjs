// MA-NOV-EXP.W2 — tests for the EXP pure functions in App/ma-entities.js (exp_validate, exp_combine, exp_compute).
// Spec claude/specs/MA-NOV-EXP_Spec.md §3.1–3.4, §5.1, §7 (T1, T3, T4, T7–T10) + 422 rows/size, sort, >10, 2 dp.
// Loads the real ma-entities.js in a vm context with a minimal DOM stub (spec §7). No network, no D1.
// Fixtures in tests/fixtures/exp-compute/ are shaped exactly like the live R-EXP1 body (contract exp-1).
// Run: node tests/exp-compute.test.mjs   (EXP_SRC=<path> runs against another copy)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(process.env.EXP_SRC || path.join(HERE, '../../ma-entities.js'), 'utf8');
const FX = name => JSON.parse(readFileSync(path.join(HERE, 'fixtures/exp-compute', name), 'utf8'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : ''}`); }
}
const near = (a, b, tol = 1e-9) => typeof a === 'number' && Math.abs(a - b) <= tol;
const r2 = x => Math.round(x * 100) / 100;

// --- load ma-entities.js -------------------------------------------------------------------------
function makeEl(tag = 'div') {
  return { tagName: tag, innerHTML: '', style: {}, dataset: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
}
const ctx = {
  console: { ...console, error() {}, warn() {} },
  setTimeout, clearTimeout,
  location: { pathname: '/', search: '', hash: '' },
  history: { state: null, pushState() {}, replaceState() {} },
  document: { body: makeEl('body'), createElement: makeEl, addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
  fetch: async () => { throw new Error('no network in tests'); },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(SRC, ctx, { filename: 'ma-entities.js' });
const { exp_validate, exp_combine, exp_compute, exp_monthLabel } = ctx;
// Results cross the vm boundary; JSON round-trip gives plain objects for deep comparison.
const plain = x => JSON.parse(JSON.stringify(x));

const ok200 = data => ({ ok: true, status: 200, data });
const err = (status, data) => ({ ok: false, status, data });
const byName = (res, n) => res.companies.find(c => c.name === n);

// --- boundary: the EXP block is pure (no DOM, no fetch) -------------------------------------------
{
  const start = SRC.indexOf('// ===== EXP (MA-NOV-EXP.W2) =====');
  const end = SRC.indexOf('// ===== end EXP (MA-NOV-EXP.W2) =====');
  check('EXP block present and delimited', start > 0 && end > start);
  const block = SRC.slice(start, end);
  for (const tok of ['document', 'window', 'fetch(', 'innerHTML', 'data_entitiesGet', 'localStorage', 'sessionStorage', 'addEventListener', 'import ', 'require(']) {
    check(`EXP block has no "${tok}"`, !block.includes(tok));
  }
  check('functions exported as globals', typeof exp_validate === 'function' && typeof exp_compute === 'function' && typeof exp_combine === 'function');
}

// ===== T1 — worked example F1 (§3.4) ===============================================================
const A = FX('f1-etf-a.json'), B = FX('f1-etf-b.json');
const F1_INPUTS = [
  { type: 'etf', symbol: 'AAA', allocation: 50 },
  { type: 'etf', symbol: 'BBB', allocation: 30 },
  { type: 'eq', entity_id: 101, name: 'X Corp', allocation: 15 },
];
const F1_LT = { AAA: ok200(A), BBB: ok200(B) };
{
  const res = plain(exp_compute(F1_INPUTS, F1_LT));
  check('T1 state ok', res.state === 'ok', res.state);
  check('T1 validation total 95, unallocated 5', res.validation.total === 95 && res.validation.unallocated === 5 && res.validation.total_status === 'under');
  // §3.4 table, in table order (= sort order).
  const expected = [
    ['W Corp', 0, 37.00, 37.00, 1, 'high'],
    ['X Corp', 15.00, 6.80, 21.80, 3, 'high'],
    ['V Corp', 0, 21.00, 21.00, 1, 'high'],
    ['Z Corp', 0, 6.10, 6.10, 2, 'low'],
    ['Y Corp', 0, 4.00, 4.00, 1, 'high'],
    ['Y Corp (separate record)', 0, 1.20, 1.20, 1, 'high'],
  ];
  check('T1 six companies', res.companies.length === 6, res.companies.map(c => c.name));
  expected.forEach(([n, d, i, e, k, band], idx) => {
    const c = res.companies[idx];
    check(`T1 row ${idx + 1} is ${n}`, c && c.name === n, c && c.name);
    if (!c) return;
    check(`T1 ${n} direct ${d}`, near(c.direct, d, 1e-9), c.direct);
    check(`T1 ${n} via ETFs ${i}`, near(c.indirect, i, 1e-9), c.indirect);
    check(`T1 ${n} combined ${e}`, near(c.combined, e, 1e-9), c.combined);
    check(`T1 ${n} inputs ${k}`, c.k === k, c.k);
    check(`T1 ${n} confidence ${band}`, c.band === band, c.band);
  });
  // Contributions line by line (§3.4 "Contributions").
  const x = byName(res, 'X Corp');
  const xs = Object.fromEntries(x.contributions.map(t => [t.label, t.contribution]));
  check('T1 X contributions 5.0 / 1.8 / 15', near(xs.AAA, 5.0) && near(xs.BBB, 1.8, 1e-12) && near(xs['X Corp'], 15), xs);
  const xa = x.contributions.find(t => t.symbol === 'AAA');
  check('T1 drill-down: allocation × fund weight', xa.allocation === 50 && xa.fund_weight === 10 && near(xa.contribution, 50 * 10 / 100) && xa.tiers[0] === 'isin_tier1');
  const z = byName(res, 'Z Corp');
  check('T1 Z contributions 2.5 + 3.6, both heuristic/low', z.contributions.length === 2 && near(z.contributions[0].contribution, 2.5) && near(z.contributions[1].contribution, 3.6, 1e-12) && z.contributions.every(t => t.band === 'low'));
  // Reconciliation.
  const rc = res.reconciliation;
  check('T1 companies 91.10', near(rc.companies, 91.10, 1e-9), rc.companies);
  check('T1 unmapped 1.50', near(rc.unmapped, 1.5, 1e-12), rc.unmapped);
  check('T1 residual 2.40', near(rc.residual, 2.4, 1e-12), rc.residual);
  check('T1 unallocated 5.00', near(rc.unallocated, 5, 1e-12), rc.unallocated);
  check('T1 no-id / unsupported / not loaded 0', rc.no_identifier === 0 && rc.unsupported === 0 && rc.not_loaded === 0 && rc.redirect_unresolved === 0);
  check('T1 reconciliation 100.00 ok', near(rc.total, 100, 1e-9) && rc.ok === true && r2(rc.total) === 100, rc.total);
  // Shared, Y/Y′, Low share, overlap, months.
  check('T1 shared = {X, Z}', JSON.stringify(res.shared.map(c => c.name).sort()) === JSON.stringify(['X Corp', 'Z Corp']), res.shared.map(c => c.name));
  check('T1 Y and Y′ stay separate', byName(res, 'Y Corp').entity_id === 102 && byName(res, 'Y Corp (separate record)').entity_id === 112);
  check('T1 Low share 8.02%', r2(res.low_confidence.share_pct) === 8.02 && near(res.low_confidence.low_indirect, 6.1, 1e-9) && near(res.low_confidence.total_indirect, 76.1, 1e-9), res.low_confidence);
  check('T1 O_A,B 11.00 by company', res.overlap.length === 1 && near(res.overlap[0].overlap, 11, 1e-12) && res.overlap[0].companies === 2 && res.overlap[0].basis === 'by company', res.overlap);
  check('T1 mixed months (Apr 2026, Feb 2026)', res.months.mixed === true && res.months.etfs.map(m => m.label).join('|') === 'Apr 2026|Feb 2026');
  check('T1 not stale (newest of portfolio)', res.months.stale.length === 0 && res.months.newest_stored_month === '2026-04');
  check('T1 per-ETF lines (A unmapped 1.5, B residual 2.4)', near(res.inputs[0].lines.unmapped, 1.5) && near(res.inputs[1].lines.residual, 2.4, 1e-12) && res.inputs[1].fund.reported_total === 92);
  check('T1 gaps: unmapped holding 1.50', res.gaps.unmapped_top.length === 1 && near(res.gaps.unmapped_top[0].contribution, 1.5) && res.gaps.unmapped_top[0].key === 'CUSIP:999999999');
  check('T1 direct X has no band of its own (band from ETF rows only)', x.contributions.find(t => t.kind === 'direct').band === undefined);
  check('T1 inputs are not mutated or rescaled', F1_INPUTS[0].allocation === 50 && F1_INPUTS[1].allocation === 30 && F1_INPUTS[2].allocation === 15);
  check('T1 no delta without Compare', res.delta === null);
  // Stale against the newest stored month of the whole set (spec T6 rule, local): Aug 2026 → A 4 behind, B 6 behind.
  const st = plain(exp_compute(F1_INPUTS, F1_LT, { newest_stored_month: '2026-08' }));
  check('T1 stale vs newest stored 2026-08: A (4) and B (6)', JSON.stringify(st.months.stale) === '["AAA","BBB"]' && st.months.etfs[0].months_behind === 4);
  const st2 = plain(exp_compute(F1_INPUTS, F1_LT, { newest_stored_month: '2026-07' }));
  check('T1 exactly 3 months behind is not stale', JSON.stringify(st2.months.stale) === '["BBB"]', st2.months.stale);
}

// ===== T3 — over-allocation ========================================================================
{
  const inputs = [{ type: 'etf', symbol: 'AAA', allocation: 60 }, { type: 'etf', symbol: 'BBB', allocation: 50 }];
  const v = plain(exp_validate(inputs));
  check('T3 blocked', v.ok === false && v.total_status === 'over');
  check('T3 exact message', v.errors.some(e => e.message === 'Allocations total 110% — reduce by 10%'), v.errors);
  const res = plain(exp_compute(inputs, F1_LT));
  check('T3 no results', res.state === 'invalid' && res.companies === null && res.reconciliation === null);
  check('T3 no rescaling', inputs[0].allocation === 60 && inputs[1].allocation === 50);
  const v2 = plain(exp_validate([{ type: 'etf', symbol: 'AAA', allocation: 60 }, { type: 'etf', symbol: 'BBB', allocation: 40.01 }]));
  check('T3 100.01 blocked with 2-dp wording', v2.errors.some(e => e.message === 'Allocations total 100.01% — reduce by 0.01%'), v2.errors);
}

// ===== T4 — duplicate input + Combine =============================================================
{
  const EEM = FX('eem-small.json');
  const inputs = [{ type: 'etf', symbol: 'EEM', allocation: 30 }, { type: 'etf', symbol: 'eem ', allocation: 20 }];
  const v = plain(exp_validate(inputs));
  check('T4 blocked as duplicate', v.ok === false && v.duplicates.length === 1 && v.rows.every(r => r.errors.some(e => e.code === 'duplicate')));
  check('T4 Combine offered (30+20%) → 50', v.duplicates[0].combine_label === 'Combine into one row (30+20%)' && v.duplicates[0].combined_allocation === 50, v.duplicates);
  check('T4 compute refuses while duplicated', plain(exp_compute(inputs, { EEM: ok200(EEM) })).state === 'invalid');
  const merged = plain(exp_combine(inputs, v.duplicates[0].indices));
  check('T4 combine → one row EEM 50', merged.length === 1 && merged[0].allocation === 50 && inputs.length === 2);
  const resC = plain(exp_compute(merged, { EEM: ok200(EEM) }));
  const resA = plain(exp_compute([{ type: 'etf', symbol: 'EEM', allocation: 50 }], { EEM: ok200(EEM) }));
  check('T4 results equal EEM 50 alone', JSON.stringify(resC.companies) === JSON.stringify(resA.companies) && JSON.stringify(resC.reconciliation) === JSON.stringify(resA.reconciliation));
  check('T4 unallocated 50', resC.reconciliation.unallocated === 50 && resC.validation.total_status === 'under');
  check('T4 EEM part = 0.5 × EEM (TSMC 6.5707)', near(byName(resC, 'Taiwan Semiconductor Manufacturing Co Ltd').combined, 0.5 * 13.141305, 1e-12));
  check('T4 total 100.00', resC.reconciliation.ok && near(resC.reconciliation.total, 100, 1e-9), resC.reconciliation);
  check('T4 negative no-identifier kept (−0.075)', near(resC.reconciliation.no_identifier, -0.075, 1e-12));
}

// ===== T7 — all unmapped + negative weights ======================================================
{
  const res = plain(exp_compute([{ type: 'etf', symbol: 'CCC', allocation: 100 }], { CCC: ok200(FX('t7-etf-c.json')) }));
  const rc = res.reconciliation;
  check('T7 one company only (X 30.00)', res.companies.length === 1 && res.companies[0].name === 'X Corp' && near(res.companies[0].combined, 30));
  check('T7 unmapped 70.00', near(rc.unmapped, 70));
  check('T7 no-id −2.00', near(rc.no_identifier, -2));
  check('T7 residual 2.00', near(rc.residual, 2));
  check('T7 total 100.00', near(rc.total, 100) && rc.ok, rc);
  check('T7 unmapped rows listed in gaps, not as companies', res.gaps.unmapped_top.length === 2 && res.gaps.unmapped_top[0].name === 'BIG UNMAPPED');
  check('T7 unallocated line hidden at 100%', res.validation.show_unallocated === false && res.validation.total_status === 'ok');
}

// ===== T8 — merge redirect =======================================================================
{
  const R = FX('t8-redirect.json');
  const res = plain(exp_compute([{ type: 'etf', symbol: 'RRR', allocation: 40 }], { RRR: ok200(R) }));
  const s = res.companies.find(c => c.entity_id === 100);
  check('T8 one row for survivor 100 with "merged record"', s && s.merged === true && s.notes.includes('merged record') && near(s.combined, 5));
  check('T8 no row for 900', !res.companies.some(c => c.entity_id === 900));
  check('T8 non-redirected row has no note', res.companies.find(c => c.entity_id === 150).notes.length === 0);
  // Direct input picked as the duplicate record lands on the survivor (resolved_id) and joins its row.
  const res2 = plain(exp_compute([{ type: 'etf', symbol: 'RRR', allocation: 40 }, { type: 'eq', entity_id: 900, resolved_id: 100, name: 'Dup Co', allocation: 10 }], { RRR: ok200(R) }));
  const s2 = res2.companies.filter(c => c.entity_id === 100);
  check('T8 direct duplicate → survivor row (5 + 10)', s2.length === 1 && near(s2[0].combined, 15) && s2[0].k === 2 && !res2.companies.some(c => c.entity_id === 900));
  const v = plain(exp_validate([{ type: 'eq', entity_id: 900, resolved_id: 100, allocation: 10 }, { type: 'eq', entity_id: 100, allocation: 5 }]));
  check('T8 equity duplicate after redirect is blocked', v.ok === false && v.duplicates.length === 1 && v.duplicates[0].key === 'EQ:100');
}

// ===== T9 — previous-month Δ =====================================================================
{
  const cur = FX('t9-d-current.json'), prev = FX('t9-d-previous.json');
  const res = plain(exp_compute([{ type: 'etf', symbol: 'DDD', allocation: 50 }], { DDD: ok200(cur) }, { previous: { DDD: ok200(prev) } }));
  const d = Object.fromEntries(res.delta.companies.map(c => [c.name, c]));
  check('T9 ΔX +1.00 changed', near(d['X Corp'].delta, 1) && d['X Corp'].status === 'changed', d['X Corp']);
  check('T9 Y new +2.50', near(d['Y Corp'].delta, 2.5) && d['Y Corp'].status === 'new', d['Y Corp']);
  check('T9 Z exited −2.00', near(d['Z Corp'].delta, -2) && d['Z Corp'].status === 'exited', d['Z Corp']);
  const e = res.delta.etfs[0];
  check('T9 both months named (May 2026 vs Mar 2026)', e.status === 'compared' && e.current === '2026-05' && e.previous === '2026-03' && e.label === 'May 2026 vs Mar 2026', e);
  check('T9 sorted by |Δ|', res.delta.companies.map(c => c.name).join('|') === 'Y Corp|Z Corp|X Corp');
  // Direct inputs carry no Δ.
  const res2 = plain(exp_compute([{ type: 'etf', symbol: 'DDD', allocation: 50 }, { type: 'eq', entity_id: 101, name: 'X Corp', allocation: 10 }], { DDD: ok200(cur) }, { previous: { DDD: ok200(prev) } }));
  check('T9 direct input adds no Δ', near(res2.delta.companies.find(c => c.entity_id === 101).delta, 1));
  // No previous month stored.
  const solo = { ...cur, previous_month: null };
  const res3 = plain(exp_compute([{ type: 'etf', symbol: 'DDD', allocation: 50 }], { DDD: ok200(solo) }, { previous: {} }));
  check('T9 no earlier stored month', res3.delta.etfs[0].status === 'no_previous' && res3.delta.etfs[0].message === 'no earlier stored month' && res3.delta.companies.length === 0);
  check('exp_monthLabel', exp_monthLabel('2026-04') === 'Apr 2026' && exp_monthLabel('2025-12') === 'Dec 2025');
}

// ===== T10 — partial failure =====================================================================
{
  const inputs = [{ type: 'etf', symbol: 'AAA', allocation: 50 }, { type: 'etf', symbol: 'BBB', allocation: 30 }];
  const res = plain(exp_compute(inputs, { AAA: ok200(A), BBB: err(500, FX('err-500.json')) }));
  const b = res.inputs[1];
  check('T10 second input not loaded', b.status === 'not_loaded' && b.message === 'not loaded – retry' && b.reason === 'http_500', b);
  check('T10 its allocation on the not-loaded line', near(res.reconciliation.not_loaded, 30));
  check('T10 the other input computes (W 37.00)', near(byName(res, 'W Corp').combined, 37) && res.companies.every(c => c.contributions.every(t => t.symbol !== 'BBB')));
  check('T10 state partial_failure', res.state === 'partial_failure');
  check('T10 total 100.00', near(res.reconciliation.total, 100, 1e-9) && res.reconciliation.ok, res.reconciliation);
  check('T10 listed under load errors', res.gaps.not_loaded.length === 1 && res.gaps.not_loaded[0].symbol === 'BBB');
  const net = plain(exp_compute(inputs, { AAA: { ok: false, status: 0, data: null }, BBB: err(503, null) }));
  check('T10 every call fails → total_failure', net.state === 'total_failure' && net.inputs.every(r => r.status === 'not_loaded') && near(net.reconciliation.not_loaded, 80) && net.reconciliation.ok);
  const pend = plain(exp_compute(inputs, { AAA: ok200(A) }));
  check('T10 unsettled input → loading', pend.state === 'loading' && pend.inputs[1].status === 'pending');
}

// ===== 422 too_large (live limit "size" and "rows") and 404 no_holdings → unsupported lines =======
{
  const inputs = [
    { type: 'etf', symbol: 'VXUS', allocation: 25 },
    { type: 'etf', symbol: 'BND', allocation: 15 },
    { type: 'etf', symbol: 'SPY', allocation: 10 },
    { type: 'etf', symbol: 'AAA', allocation: 50 },
  ];
  const res = plain(exp_compute(inputs, { VXUS: err(422, FX('err-422-size.json')), BND: err(422, FX('err-422-rows.json')), SPY: err(404, FX('err-404-no-holdings.json')), AAA: ok200(A) }));
  const [v, b, s] = res.inputs;
  check('422 size → unsupported, limit "size" kept', v.status === 'unsupported' && v.reason === 'too_large' && v.limit === 'size' && v.message === 'not supported: too large for live look-through' && v.body_bytes === 369480 && v.max_body_bytes === 131072, v);
  check('422 rows → unsupported, limit "rows" kept', b.status === 'unsupported' && b.reason === 'too_large' && b.limit === 'rows' && b.holdings_count === 17368 && b.max_holdings === 10000, b);
  check('404 no_holdings → unsupported', s.status === 'unsupported' && s.message === 'not supported: no stored holdings');
  check('unsupported line 50.00 (25+15+10), not spread', near(res.reconciliation.unsupported, 50) && near(res.reconciliation.not_loaded, 0));
  check('only AAA computes (W 37.00)', near(byName(res, 'W Corp').combined, 37));
  check('total 100.00 with unsupported', near(res.reconciliation.total, 100, 1e-9) && res.reconciliation.ok);
  check('state ok (unsupported is not a failure)', res.state === 'ok');
  check('gaps list the three unsupported inputs', res.gaps.unsupported.map(r => r.symbol).join('|') === 'VXUS|BND|SPY');
  const bad = plain(exp_compute([{ type: 'etf', symbol: 'ZZZ', allocation: 10 }, { type: 'etf', symbol: 'Q', allocation: 10 }],
    { ZZZ: err(404, { error: 'etf_not_found', symbol: 'ZZZ', contract: 'exp-1' }), Q: err(400, { error: 'invalid_symbol', contract: 'exp-1' }) }));
  check('404 etf_not_found → unsupported; 400 → invalid (unsupported line)', bad.inputs[0].status === 'unsupported' && bad.inputs[1].status === 'invalid' && near(bad.reconciliation.unsupported, 20) && bad.reconciliation.ok);
}

// ===== sort order (combined desc; tie → name, then entity id) ======================================
{
  const body = { ...A, entities: [
    [7, 'Beta', 10, 1, 'isin_tier1', 100, 0], [3, 'Alpha', 10, 1, 'isin_tier1', 100, 0],
    [9, 'Alpha', 10, 1, 'isin_tier1', 100, 0], [5, 'Big', 40, 1, 'isin_tier1', 100, 0], [6, 'Short', -2, 1, 'isin_tier1', 100, 0]],
    tiers: { isin_tier1: [5, 68] }, unmapped_top: [] };
  const res = plain(exp_compute([{ type: 'etf', symbol: 'AAA', allocation: 100 }], { AAA: ok200(body) }));
  check('sort: combined desc, then name, then id', res.companies.map(c => `${c.name}#${c.entity_id}`).join('|') === 'Big#5|Alpha#3|Alpha#9|Beta#7|Short#6', res.companies.map(c => c.name + '#' + c.entity_id));
  check('negative company kept with net short note', res.companies[4].combined === -2 && res.companies[4].notes.includes('net short / derivative'));
  check('negative company does not count as overlap/k... k counts nonzero', res.companies[4].k === 1);
  check('route order not trusted (input was unsorted)', body.entities[0][1] === 'Beta');
}

// ===== validation: >10 inputs, 2-dp rule, ETF + direct same company =================================
{
  const eleven = Array.from({ length: 11 }, (_, i) => ({ type: 'etf', symbol: 'E' + i, allocation: 5 }));
  const v = plain(exp_validate(eleven));
  check('>10 inputs blocked', v.ok === false && v.errors.some(e => e.code === 'too_many_inputs'));
  check('10 inputs allowed', plain(exp_validate(eleven.slice(0, 10))).ok === true);
  const MSG = 'Allocation must be between 0.01 and 100';
  for (const bad of [10.123, 0, -5, 100.01, 'abc', '', null, 0.001, NaN, Infinity]) {
    const r = plain(exp_validate([{ type: 'etf', symbol: 'AAA', allocation: bad }]));
    check(`allocation ${String(bad)} rejected`, r.ok === false && r.rows[0].errors.some(e => e.message === MSG), r.rows[0]);
  }
  for (const good of [0.01, 100, 12.5, '12.50', 33.33]) {
    const r = plain(exp_validate([{ type: 'etf', symbol: 'AAA', allocation: good }]));
    check(`allocation ${String(good)} accepted`, r.ok === true, r);
  }
  const thirds = plain(exp_validate([{ type: 'etf', symbol: 'A1', allocation: 33.33 }, { type: 'etf', symbol: 'A2', allocation: 33.33 }, { type: 'etf', symbol: 'A3', allocation: 33.34 }]));
  check('33.33+33.33+33.34 = exactly 100 (no float drift)', thirds.ok && thirds.total === 100 && thirds.total_status === 'ok' && thirds.show_unallocated === false);
  const under = plain(exp_validate([{ type: 'etf', symbol: 'A1', allocation: 99.99 }]));
  check('99.99 allowed with unallocated 0.01', under.ok && under.total_status === 'under' && under.unallocated === 0.01 && under.show_unallocated);
  const mix = plain(exp_validate([{ type: 'etf', symbol: 'AAA', allocation: 50 }, { type: 'eq', entity_id: 101, allocation: 15 }]));
  check('ETF + direct of the same company is not a duplicate', mix.ok && mix.duplicates.length === 0);
  const empty = plain(exp_compute([], {}));
  check('empty → state empty, no results', empty.state === 'empty' && empty.companies === null);
  const missing = plain(exp_validate([{ type: 'etf', symbol: '', allocation: 10 }, { type: 'eq', allocation: 10 }]));
  check('row without ETF / company is an error', missing.rows[0].errors.some(e => e.code === 'symbol') && missing.rows[1].errors.some(e => e.code === 'entity'));
  const c3 = plain(exp_combine([{ type: 'etf', symbol: 'X', allocation: 10.1 }, { type: 'eq', entity_id: 1, allocation: 5 }, { type: 'etf', symbol: 'X', allocation: 20.2 }], [0, 2]));
  check('combine keeps first position, sums to 2 dp', c3.length === 2 && c3[0].allocation === 30.3 && c3[1].type === 'eq');
}

// ===== bad body / contract mismatch → not loaded (never mis-read) ==================================
{
  const res = plain(exp_compute([{ type: 'etf', symbol: 'AAA', allocation: 100 }], { AAA: ok200({ ...A, contract: 'exp-2' }) }));
  check('contract mismatch → not loaded', res.inputs[0].status === 'not_loaded' && res.inputs[0].reason === 'bad_body');
}

console.log(`exp-compute: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
