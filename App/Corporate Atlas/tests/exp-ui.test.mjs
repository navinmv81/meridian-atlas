// MA-NOV-EXP.W3 — tests for the exposure screen's pure parts in App/ma-entities.js (block "EXP UI (MA-NOV-EXP.W3)").
// Spec claude/specs/MA-NOV-EXP_Spec.md §2 (route, hash, states), §6 (labels, banned wording), §7 UI state list.
// Covers: hash parse/serialise round-trip and rejects; state selection from route outcomes (200 / 404 / 422 / 400 /
// 5xx / network / pending); row badges; nav hooks (_navHash / _navParseFrom type exposure); banned words.
// Loads the real ma-entities.js in a vm context with a minimal DOM stub. No network, no D1.
// Run: node "App/Corporate Atlas/tests/exp-ui.test.mjs"   (EXP_SRC=<path> runs against another copy)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(process.env.EXP_SRC || path.join(HERE, '../../ma-entities.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : ''}`); }
}
const plain = x => JSON.parse(JSON.stringify(x));

function makeEl(tag = 'div') {
  return { tagName: tag, innerHTML: '', style: {}, dataset: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
}
function load(hash) {
  const winListeners = {}, docListeners = {};
  const replaced = [];
  const ctx = {
    console: { ...console, error() {}, warn() {} },
    setTimeout, clearTimeout,
    location: { pathname: '/', search: '', hash: hash || '' },
    history: { state: null, pushState() {}, replaceState(s, t, u) { replaced.push({ s, u }); } },
    document: { body: makeEl('body'), createElement: makeEl, addEventListener(t, f) { (docListeners[t] ||= []).push(f); }, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
    fetch: async () => { throw new Error('no network in tests'); },
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, f) => { (winListeners[t] ||= []).push(f); };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ma-entities.js' });
  return { ctx, winListeners, docListeners, replaced };
}
const { ctx, winListeners } = load('');
const { exp_hashSerialize, exp_hashParse, exp_hashFor, exp_hashOf, exp_viewState, exp_rowStatus, exp_viewFlags, exp_compute, _navHash, _navParseFrom } = ctx;

// --- block present -----------------------------------------------------------------------------
const UI_START = SRC.indexOf('// ===== EXP UI (MA-NOV-EXP.W3) =====');
const UI_END = SRC.indexOf('// ===== end EXP UI (MA-NOV-EXP.W3) =====');
check('UI block present and delimited, after the W2 block', UI_START > SRC.indexOf('// ===== end EXP (MA-NOV-EXP.W2) =====') && UI_END > UI_START);
const UI = SRC.slice(UI_START, UI_END);
for (const f of ['exp_hashSerialize', 'exp_hashParse', 'exp_hashFor', 'exp_hashOf', 'exp_viewState', 'exp_rowStatus', 'exp_viewFlags', '_navRenderExposure']) {
  check(`global ${f}`, typeof ctx[f] === 'function');
}

// --- hash: serialise / parse round-trip ----------------------------------------------------------
{
  const inputs = [
    { type: 'etf', symbol: 'eem', allocation: 50 },
    { type: 'eq', entity_id: 2191, name: 'TSMC', allocation: '15' },
    { type: 'etf', symbol: 'BRK.B', allocation: '12.5' },
    { type: 'etf', symbol: 'VXUS', allocation: 33.33 },
  ];
  const s = exp_hashSerialize(inputs);
  check('serialise spec example shape', s === 'ETF:EEM:50,EQ:2191:15,ETF:BRK.B:12.5,ETF:VXUS:33.33', s);
  const p = plain(exp_hashParse(s));
  check('parse: 4 inputs, 0 rejected', p.inputs.length === 4 && p.rejected.length === 0, p);
  check('parse: ETF row', JSON.stringify(p.inputs[0]) === JSON.stringify({ type: 'etf', symbol: 'EEM', allocation: '50' }), p.inputs[0]);
  check('parse: EQ row (name filled later)', JSON.stringify(p.inputs[1]) === JSON.stringify({ type: 'eq', entity_id: 2191, name: null, allocation: '15' }), p.inputs[1]);
  check('round-trip parse(serialise(x)) is stable', exp_hashSerialize(p.inputs) === s);
  check('spec §2 example parses', plain(exp_hashParse('ETF:VXUS:50,EQ:2191:15')).inputs.map(i => i.symbol || i.entity_id).join() === 'VXUS,2191');
  check('lower-case kind and symbol accepted', plain(exp_hashParse('etf:eem:10')).inputs[0].symbol === 'EEM');
  check('empty allocation kept as empty text (shown as a field error)', plain(exp_hashParse('ETF:EEM:')).inputs[0].allocation === '');
  check('empty string → no inputs', plain(exp_hashParse('')).inputs.length === 0);
  check('blank tokens skipped', plain(exp_hashParse('ETF:EEM:50,,')).inputs.length === 1);
  // Invalid allocation text is not written to the hash.
  check('serialise drops invalid allocation text', exp_hashSerialize([{ type: 'etf', symbol: 'EEM', allocation: 'abc' }]) === 'ETF:EEM:');
  check('serialise drops > 2 dp text', exp_hashSerialize([{ type: 'etf', symbol: 'EEM', allocation: '1.234' }]) === 'ETF:EEM:');
  check('serialise rounds a float allocation to 2 dp', exp_hashSerialize([{ type: 'etf', symbol: 'EEM', allocation: 33.333333 }]) === 'ETF:EEM:33.33');
  check('serialise leaves out rows with no identity', exp_hashSerialize([{ type: 'etf', symbol: '', allocation: 5 }, { type: 'eq', entity_id: null, allocation: 5 }, { type: 'x' }]) === '');
  // 11 inputs survive the hash; validation (not the parser) blocks them.
  const eleven = Array.from({ length: 11 }, (_, i) => `ETF:E${i}:5`).join(',');
  const p11 = plain(exp_hashParse(eleven));
  check('parse keeps > 10 inputs for validation to report', p11.inputs.length === 11);
  const r11 = exp_compute(p11.inputs, new Map());
  check('> 10 inputs → invalid state, "At most 10 inputs"', exp_viewState(r11) === 'invalid' && r11.validation.errors.some(e => /At most 10 inputs/.test(e.message)));
}

// --- hash: rejects -------------------------------------------------------------------------------
{
  const bad = ['ETF:EEM', 'ETF:EEM:50:1', 'XYZ:EEM:50', 'EQ:abc:5', 'EQ:0:5', 'EQ:01:5', 'EQ:12345678901:5', 'ETF:EE M:5', 'ETF:-EEM:5',
    'ETF:EEM:1000', 'ETF:EEM:5.123', 'ETF:EEM:-5', 'ETF:EEM:abc', 'ETF:ABCDEFGHIJKLMNOP:5', 'ETF:<script>:5'];
  for (const t of bad) {
    const p = plain(exp_hashParse(t));
    check(`reject "${t}"`, p.inputs.length === 0 && p.rejected.length === 1 && p.rejected[0] === t, p);
  }
  const mixed = plain(exp_hashParse('ETF:EEM:50,BAD,EQ:2191:15'));
  check('good tokens kept around a bad one', mixed.inputs.length === 2 && mixed.rejected.join() === 'BAD', mixed);
}

// --- hash ⇄ location ----------------------------------------------------------------------------
check('exp_hashFor with inputs', exp_hashFor('ETF:EEM:50') === '#/exposure?i=ETF:EEM:50');
check('exp_hashFor empty', exp_hashFor('') === '#/exposure' && exp_hashFor(null) === '#/exposure');
check('exp_hashOf plain', exp_hashOf('#/exposure?i=ETF:EEM:50,EQ:2191:15') === 'ETF:EEM:50,EQ:2191:15');
check('exp_hashOf no query', exp_hashOf('#/exposure') === '');
check('exp_hashOf percent-encoded', exp_hashOf('#/exposure?i=ETF%3AEEM%3A50%2CEQ%3A2191%3A15') === 'ETF:EEM:50,EQ:2191:15');
check('exp_hashOf other hashes → null', exp_hashOf('#/entity/5') === null && exp_hashOf('#/exposures') === null && exp_hashOf('') === null && exp_hashOf('#/exposure/x') === null);
check('exp_hashOf ignores other params', exp_hashOf('#/exposure?x=1&i=ETF:EEM:5') === 'ETF:EEM:5');
check('exp_hashOf bad escape → empty', exp_hashOf('#/exposure?i=%E0%A4%A') === '');

// --- nav hooks (spec §2, §6) --------------------------------------------------------------------
check('_navHash exposure', _navHash('exposure', 'ETF:EEM:60,EQ:2191:15', null) === '#/exposure?i=ETF:EEM:60,EQ:2191:15');
check('_navHash exposure empty', _navHash('exposure', '', null) === '#/exposure');
{
  const h = _navHash('entity', 2191, 'exposure:ETF:EEM:60,EQ:2191:15');
  check('company link #/entity/{id}?from=exposure:{inputs}', h === '#/entity/2191?from=exposure%3AETF%3AEEM%3A60%2CEQ%3A2191%3A15', h);
  const from = new URLSearchParams(h.split('?')[1]).get('from');
  check('_navParseFrom type exposure keeps the whole inputs string', JSON.stringify(plain(_navParseFrom(from))) === JSON.stringify({ type: 'exposure', key: 'ETF:EEM:60,EQ:2191:15' }));
}
check('_navParseFrom existing types unchanged', JSON.stringify(plain(_navParseFrom('etf:EEM:holdings'))) === JSON.stringify({ type: 'etf', key: 'EEM', sub: 'holdings' })
  && plain(_navParseFrom('bond:x')).type === 'bond' && plain(_navParseFrom('nope:1')).type === 'direct' && plain(_navParseFrom(null)).type === 'direct');
check('_navHash existing kinds unchanged', _navHash('entity', 5, null) === '#/entity/5' && _navHash('instrument', 'CUSIP:1', null) === '#/instrument/CUSIP%3A1' && _navHash('fi', null, null) === '#/fi');

// --- state selection from route outcomes (§2 state table) --------------------------------------
const body = (sym, month, ents, tiers, extra = {}) => ({ symbol: sym, report_month: month, previous_month: null, filing_date: '2026-04-23',
  holdings_count: 10, tiers, entities: ents, unmapped_top: [], contract: 'exp-1', computed_at: '2026-11-18T00:00:00Z', ...extra });
const EEM = body('EEM', '2026-02', [[1, 'A Co', 60, 2, 'isin_tier1', 95, 0], [2, 'B Co', 30, 1, 'heuristic', 0, 0]], { isin_tier1: [2, 60], heuristic: [1, 30], unmapped: [1, 8] });
const IYLD = body('IYLD', '2025-09', [[1, 'A Co', 50, 1, 'isin_tier1', 95, 0]], { isin_tier1: [1, 50], unmapped: [1, 50] });
const ok = d => ({ ok: true, status: 200, data: d });
const er = (status, data) => ({ ok: false, status, data });
const E = s => ({ type: 'etf', symbol: s, allocation: '50' });
const M = obj => new Map(Object.entries(obj));

check('state empty', exp_viewState(exp_compute([], M({}))) === 'empty');
check('state invalid (over 100)', exp_viewState(exp_compute([{ ...E('EEM'), allocation: '60' }, { ...E('IYLD'), allocation: '50' }], M({}))) === 'invalid');
check('state invalid (duplicate)', exp_viewState(exp_compute([E('EEM'), E('eem')], M({ EEM: ok(EEM) }))) === 'invalid');
check('state invalid (allocation ≤ 0 / text)', exp_viewState(exp_compute([{ ...E('EEM'), allocation: '0' }], M({}))) === 'invalid'
  && exp_viewState(exp_compute([{ ...E('EEM'), allocation: 'abc' }], M({}))) === 'invalid');
check('state loading (missing entry)', exp_viewState(exp_compute([E('EEM'), E('IYLD')], M({ EEM: ok(EEM) }))) === 'loading');
check('state results (all 200)', exp_viewState(exp_compute([E('EEM'), E('IYLD')], M({ EEM: ok(EEM), IYLD: ok(IYLD) }))) === 'results');
check('state results with unsupported 404 no_holdings', exp_viewState(exp_compute([E('EEM'), E('SPY')], M({ EEM: ok(EEM), SPY: er(404, { error: 'no_holdings', reason: 'no_series_id', contract: 'exp-1' }) }))) === 'results');
check('state results with unsupported 422 too_large size', exp_viewState(exp_compute([E('EEM'), E('VXUS')], M({ EEM: ok(EEM), VXUS: er(422, { error: 'too_large', limit: 'size', holdings_count: 8878 }) }))) === 'results');
check('state partial_failure (one 503)', exp_viewState(exp_compute([E('EEM'), E('IYLD')], M({ EEM: ok(EEM), IYLD: er(503, null) }))) === 'partial_failure');
check('state total_failure (network + 500)', exp_viewState(exp_compute([E('EEM'), E('IYLD')], M({ EEM: { ok: false, status: 0, data: null }, IYLD: er(500, { error: 'internal' }) }))) === 'total_failure');
check('state results: direct holdings only', exp_viewState(exp_compute([{ type: 'eq', entity_id: 7, name: 'X', allocation: '40' }], M({}))) === 'results');
check('exp_viewState(null) → empty', exp_viewState(null) === 'empty');

// Flags: mixed / stale / unsupported / not loaded.
{
  const r = exp_compute([E('EEM'), E('IYLD')], M({ EEM: ok(EEM), IYLD: ok(IYLD) }));
  const f = plain(exp_viewFlags(r));
  check('flags: mixed months', f.mixed === true, f);
  check('flags: stale = IYLD (5 months behind Feb 2026)', f.stale.join() === 'IYLD', f);
  const r2 = exp_compute([E('EEM'), E('SPY')], M({ EEM: ok(EEM), SPY: er(404, { error: 'no_holdings' }) }));
  check('flags: unsupported SPY', plain(exp_viewFlags(r2)).unsupported.join() === 'SPY');
  const r3 = exp_compute([E('EEM'), E('IYLD')], M({ EEM: ok(EEM), IYLD: er(502, null) }));
  check('flags: not loaded IYLD', plain(exp_viewFlags(r3)).not_loaded.join() === 'IYLD');
  check('reconciliation still 100 in partial failure', Math.abs(r3.reconciliation.total - 100) < 1e-9 && Math.abs(r3.reconciliation.not_loaded - 50) < 1e-9);
}

// Row badges (shown even while the list is invalid).
{
  const rs = (inp, res) => plain(exp_rowStatus(inp, res));
  check('row: pending', rs(E('EEM'), undefined).status === 'pending' && /loading/.test(rs(E('EEM'), undefined).text));
  check('row: computed shows month', rs(E('EEM'), ok(EEM)).text === 'holdings available (Feb 2026)');
  check('row: 404 no_holdings', rs(E('SPY'), er(404, { error: 'no_holdings' })).text === 'not supported: no stored holdings');
  check('row: 404 etf_not_found', rs(E('ZZZ'), er(404, { error: 'etf_not_found' })).text === 'not supported: unknown ETF symbol');
  check('row: 422 too_large', rs(E('VXUS'), er(422, { error: 'too_large', limit: 'rows' })).text === 'not supported: too large for live look-through'
    && rs(E('VXUS'), er(422, { error: 'too_large', limit: 'rows' })).reason === 'too_large');
  check('row: 503 → not loaded with retry', rs(E('EEM'), er(503, null)).text === 'not loaded – retry' && rs(E('EEM'), er(503, null)).retry === true);
  check('row: network → not loaded with retry', rs(E('EEM'), { ok: false, status: 0, data: null }).retry === true);
  check('row: wrong contract → not loaded', rs(E('EEM'), ok({ ...EEM, contract: 'exp-2' })).status === 'not_loaded');
  check('row: direct holding', rs({ type: 'eq', entity_id: 1, allocation: 5 }, undefined).text === 'direct holding · your stated allocation');
}

// --- cold deep link: the hash is claimed before the router's cold dispatch ---------------------
{
  const L = load('#/exposure?i=ETF:EEM:50');
  check('cold #/exposure: hash hidden from the router at load', L.replaced.length === 1 && L.replaced[0].u === '/' && L.replaced[0].s === null, L.replaced);
  check('cold #/exposure: popstate + hashchange claimed', (L.winListeners.popstate || []).length === 1 && (L.winListeners.hashchange || []).length === 1);
  const L2 = load('#/entity/5');
  check('other hashes untouched at load', L2.replaced.length === 0);
  // An event for another hash passes through to the router (no stopImmediatePropagation).
  let stopped = false;
  L2.ctx.location.hash = '#/entity/7';
  for (const f of L2.winListeners.popstate) f({ state: null, stopImmediatePropagation() { stopped = true; } });
  for (const f of L2.winListeners.hashchange) f({ stopImmediatePropagation() { stopped = true; } });
  check('router still receives non-exposure popstate/hashchange', stopped === false);
}

// --- §6 banned wording: no displayed text in the UI block uses it -------------------------------
{
  const banned = ['current ownership', 'all holders', 'complete', 'real-time', 'realtime', 'real time'];
  // Exclusions are code, not displayed text: the HTML attribute names autocomplete / aria-autocomplete and the list itself.
  const scan = UI.replace(/aria-autocomplete="[^"]*"/g, '').replace(/autocomplete="[^"]*"/g, '').replace(/const _EXP_BANNED = \[[^\]]*\];[^\n]*/, '');
  for (const w of banned) check(`UI block has no "${w}"`, !scan.toLowerCase().includes(w), w);
  // Labels the spec fixes (§6) are present verbatim.
  for (const l of ['Instruments mapped to this issuer; mapping tier shown',
    "Funds in Meridian's N-PORT set (241 of 264 listed ETFs have stored holdings)", '; not all ETFs',
    "13F-HR filers in Meridian's set, ", '; US-listed long positions only; not total ownership',
    'SEC-registered offerings parsed for 30 configured issuers since 2024-01-01; final records only',
    'Not mapped to a company', '>Holdings ${', ', filed ${',
    'Computed in your browser on ', ' from stored holdings; not live positions.', 'Compare with previous stored month', 'no earlier stored month',
    'by company', 'Hide low-confidence', 'Low-confidence (hidden)', 'not supported: too large for live look-through',
    'Fund residual (not reported as holdings)', 'Unallocated', 'Unsupported inputs', 'Not loaded', 'Unmapped holdings', 'No-identifier holdings']) {
    check(`label present: ${l}`, UI.includes(l) || SRC.includes(l));
  }
  // The W2 messages the UI displays carry no banned word either.
  const w2 = SRC.slice(SRC.indexOf('// ===== EXP (MA-NOV-EXP.W2) ====='), SRC.indexOf('// ===== end EXP (MA-NOV-EXP.W2) ====='));
  const msgs = (w2.match(/message: [`'][^`']*[`']/g) || []).join(' ').toLowerCase();
  for (const w of banned) check(`W2 messages have no "${w}"`, !msgs.includes(w));
}

// --- boundaries ---------------------------------------------------------------------------------
check('UI block uses no storage', !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(UI));
check('UI block has no import/require', !/\bimport\s|\brequire\(/.test(UI));
check('UI fetches only R-EXP1, entity search/detail/evidence and the ETF list', (UI.match(/_expuiGet\(`[^`]*`/g) || []).every(c =>
  /\/api\/exposure\/etf\/|\/api\/entities\/search|\/api\/entities\/\$\{/.test(c)));

console.log(`exp-ui: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
