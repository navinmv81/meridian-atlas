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

// --- routing (MA-NOV-EXP.W3R2, M-1): the index.html router owns #/exposure ----------------------
{
  const INDEX = readFileSync(process.env.EXP_INDEX || path.join(HERE, '../../index.html'), 'utf8');
  const script = INDEX.match(/<script>\n\/\/ MA-OCT-007 hash router[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
  function router(hash) {
    const events = [], replaced = [], docL = {}, winL = {}, timers = [];
    const rctx = { location: { hash, pathname: '/', search: '' }, history: { state: null, replaceState(s, t, u) { replaced.push(u); } },
      document: { addEventListener(t, f) { (docL[t] ||= []).push(f); }, dispatchEvent(ev) { events.push(ev.detail); },
        createElement() { throw new Error('toast shown'); }, body: { appendChild() {} } },
      URLSearchParams, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o.detail; } }, setTimeout: f => timers.push(f) };
    rctx.window = rctx; rctx.addEventListener = (t, f) => { (winL[t] ||= []).push(f); };
    vm.createContext(rctx); vm.runInContext(script, rctx);
    return { rctx, events, replaced, docL, winL, timers };
  }
  const R = router('');
  const P = h => JSON.stringify(R.rctx.maNavParse(h));
  const X = (id) => JSON.stringify({ type: 'exposure', id, from: null });
  check('router: #/exposure (entry link) → exposure, empty inputs', P('#/exposure') === X(''), P('#/exposure'));
  check('router: #/exposure?i=… → the i= string', P('#/exposure?i=ETF:EEM:60,EQ:2191:15') === X('ETF:EEM:60,EQ:2191:15'), P('#/exposure?i=ETF:EEM:60,EQ:2191:15'));
  check('router: i= is URI-decoded', P('#/exposure?i=ETF%3AEEM%3A60%2CEQ%3A2191%3A15') === X('ETF:EEM:60,EQ:2191:15'));
  check('router: i= among other params', P('#/exposure?x=1&i=ETF:EEM:5') === X('ETF:EEM:5'));
  check('router: malformed %-escape → empty inputs, not a throw', P('#/exposure?i=%E0%A4%A') === X(''));
  check('router: junk tokens pass through to the screen (it rejects and lists them)', P('#/exposure?i=<script>') === X('<script>'));
  check('router: agrees with exp_hashOf on the i= string', ['#/exposure', '#/exposure?i=ETF:EEM:60,EQ:2191:15', '#/exposure?i=%E0', '#/exposure?i=ETF%3AX%3A1']
    .every(h => (R.rctx.maNavParse(h) || {}).id === exp_hashOf(h)));
  for (const bad of ['#/exposures', '#/exposure/1', '#/exposurex?i=ETF:EEM:5', '#exposure', '#/Exposure', '#/exposure#x', ' #/exposure'])
    check(`router rejects ${JSON.stringify(bad)}`, R.rctx.maNavParse(bad) === null, P(bad));
  check('router: #/entity/… unchanged', P('#/entity/2191') === JSON.stringify({ type: 'entity', id: 2191, from: null })
    && P('#/entity/2191?from=exposure%3AETF%3AEEM%3A60') === JSON.stringify({ type: 'entity', id: 2191, from: 'exposure:ETF:EEM:60' }));
  check('router: #/instrument/… unchanged', P('#/instrument/US5949181045') === JSON.stringify({ type: 'instrument', id: 'US5949181045', from: null }));
  check('router: #/fi routes unchanged', P('#/fi') === JSON.stringify({ type: 'fi', id: null, from: null })
    && P('#/fi/cik/0002007029') === JSON.stringify({ type: 'fi_cik', id: '0002007029', from: null })
    && P('#/bond/0001104659-24-022370/1') === JSON.stringify({ type: 'bond', id: '0001104659-24-022370/1', from: null }));
  for (const bad of ['#/entity/0', '#/entity/abc', '#/fi/x', '#/nope']) check(`router still rejects ${bad}`, R.rctx.maNavParse(bad) === null);
  // Cold deep link: one ma:route 'cold' event for exposure, no toast, the hash is not stripped.
  const C = router('#/exposure?i=ETF:EEM:60,EQ:2191:15');
  C.docL.DOMContentLoaded.forEach(f => f()); C.timers.forEach(f => f());
  check('router cold #/exposure: one ma:route cold event with the inputs', C.events.length === 1 && C.events[0].type === 'exposure'
    && C.events[0].mode === 'cold' && C.events[0].id === 'ETF:EEM:60,EQ:2191:15', C.events);
  check('router cold #/exposure: no "invalid link" toast, hash kept', C.replaced.length === 0);
  // Entry link: a hashchange to #/exposure dispatches 'typed'.
  const T = router('');
  T.rctx.location.hash = '#/exposure'; T.winL.hashchange.forEach(f => f());
  check('router: entry link (hashchange) → ma:route typed exposure', T.events.length === 1 && T.events[0].mode === 'typed' && T.events[0].type === 'exposure' && T.events[0].id === '');
  // Back to the exposure entry: popstate carries its depth.
  const B = router('');
  B.rctx.location.hash = '#/exposure?i=ETF:EEM:60'; B.winL.popstate.forEach(f => f({ state: { maNav: 1 } }));
  check('router: popstate to the exposure entry → ma:route pop depth 1', B.events.length === 1 && B.events[0].mode === 'pop' && B.events[0].depth === 1 && B.events[0].type === 'exposure');
}

// --- ma-entities.js no longer claims hashes before the router ------------------------------------
{
  const L = load('#/exposure?i=ETF:EEM:50');
  check('cold #/exposure: ma-entities.js leaves the URL alone at load', L.replaced.length === 0, L.replaced);
  check('no window popstate/hashchange listeners in ma-entities.js', !(L.winListeners.popstate || []).length && !(L.winListeners.hashchange || []).length);
  check('no stopImmediatePropagation / pre-router claim / two-timer wait in ma-entities.js',
    !/stopImmediatePropagation|_expColdHash|_expSkipHashchange|_expOpenTyped|setTimeout\(\(\) => setTimeout/.test(SRC));
  check('the index.html router owns #/exposure (UI block says so)', UI.includes('the index.html router parses #/exposure'));
  // The shared ma:route handler opens the layer for cold / typed; pop closes layers down to its depth.
  const calls = [];
  L.ctx._navOpen = (k, id, o) => { calls.push([k, id, o && o.history, o && o.from]); };
  const route = d => L.docListeners['ma:route'].forEach(f => f({ detail: d }));
  route({ type: 'exposure', id: 'ETF:EEM:60,EQ:2191:15', from: null, mode: 'cold' });
  check('ma:route cold exposure: Home made depth 0, then the layer pushed with the inputs',
    L.replaced.length === 1 && L.replaced[0].s && L.replaced[0].s.maNav === 0 && L.replaced[0].u === '/'
    && calls.length === 1 && calls[0][0] === 'exposure' && calls[0][1] === 'ETF:EEM:60,EQ:2191:15' && calls[0][2] === 'push', { r: L.replaced, calls });
  calls.length = 0;
  route({ type: 'exposure', id: '', from: null, mode: 'typed' });
  check('ma:route typed exposure (entry link): layer opened replacing the typed entry', calls.length === 1 && calls[0][0] === 'exposure' && calls[0][1] === '' && calls[0][2] === 'replace', calls);
  calls.length = 0;
  route({ type: 'entity', id: 2191, from: 'exposure:ETF:EEM:60', mode: 'cold' });
  check('ma:route cold entity from=exposure: exposure rebuilt underneath, then the entity', calls.length === 2
    && calls[0][0] === 'exposure' && calls[0][1] === 'ETF:EEM:60' && calls[1][0] === 'entity' && calls[1][1] === 2191, calls);
}

// --- N-3: focus returns to the company link after Back --------------------------------------------
{
  const L = load('');
  const stack = vm.runInContext('_navStack', L.ctx);
  function fakeLayer() {
    const root = { kids: new Set(), cards: [], h2: null, h3: null,
      contains(x) { return this.kids.has(x); },
      querySelectorAll(sel) { return sel === '.exp-results .exp-card' ? this.cards : []; },
      querySelector(sel) {
        if (sel === '.exp-results h3') return this.h3;
        if (sel === 'h2') return this.h2;
        const m = /^\.exp-results \[data-exp-act="entity"\]\[data-id="(\d+)"\]$/.exec(sel);
        if (m) { for (const c of this.cards) { const a = c.find(m[1]); if (a) return a; } }
        return null;
      }, isConnected: true };
    const mk = (tag, extra) => { const e = { tag, attrs: {}, focused: 0, focusOpts: undefined, isConnected: true, dataset: {},
      focus(o) { this.focused++; this.focusOpts = o; }, setAttribute(k, v) { this.attrs[k] = v; }, closest() { return this.card || null; }, ...extra }; root.kids.add(e); return e; };
    const card = (links) => { const c = { links, find(id) { return this.links.find(a => a.isConnected && a.dataset.id === String(id)) || null; },
      querySelector(sel) { const m = /data-id="(\d+)"/.exec(sel); return m ? this.find(m[1]) : null; } }; links.forEach(a => { a.card = c; }); root.cards.push(c); return c; };
    root.h2 = mk('h2'); root.h3 = mk('h3');
    return { layer: { el: root, kind: 'exposure', exp: {} }, root, mk, card };
  }
  const { _expRememberLink, _expRestoreFocus } = L.ctx;
  check('focus helpers present', typeof _expRememberLink === 'function' && typeof _expRestoreFocus === 'function');
  // 1. Same element still in the layer → it gets focus, without scrolling.
  {
    const F = fakeLayer();
    const a1 = F.mk('a', { dataset: { id: '2191' } }), a2 = F.mk('a', { dataset: { id: '7' } });
    F.card([a1, a2]);
    _expRememberLink(F.layer, a2);
    const got = _expRestoreFocus(F.layer);
    check('Back: the clicked company link is focused again', got === a2 && a2.focused === 1 && a2.focusOpts && a2.focusOpts.preventScroll === true && a1.focused === 0);
    check('Back: the remembered link is used once', F.layer.exp.returnTo === null);
  }
  // 2. Results re-rendered meanwhile → the same company's link in the same card (not an earlier card's).
  {
    const F = fakeLayer();
    const recon = F.mk('a', { dataset: { id: '9' } });
    const oldA = F.mk('a', { dataset: { id: '2191' } });
    F.card([recon]); F.card([oldA]);
    _expRememberLink(F.layer, oldA);
    oldA.isConnected = false;
    const firstCardSame = F.mk('a', { dataset: { id: '2191' } }), newA = F.mk('a', { dataset: { id: '2191' } });
    F.root.cards[0].links.push(firstCardSame); F.root.cards[1].links = [newA];
    const got = _expRestoreFocus(F.layer);
    check('Back after re-render: same company link in the same card is focused', got === newA && newA.focused === 1 && firstCardSame.focused === 0);
  }
  // 3. Link gone (or nothing remembered) → results heading, made focusable.
  {
    const F = fakeLayer();
    const a = F.mk('a', { dataset: { id: '5' } }); F.card([a]);
    _expRememberLink(F.layer, a); a.isConnected = false; F.root.cards[0].links = [];
    const got = _expRestoreFocus(F.layer);
    check('Back, link gone: results heading focused (tabindex -1)', got === F.root.h3 && F.root.h3.focused === 1 && F.root.h3.attrs.tabindex === '-1');
    const G = fakeLayer(); G.root.h3 = null;
    check('Back, no results yet: page heading focused', _expRestoreFocus(G.layer) === G.root.h2 && G.root.h2.focused === 1);
  }
  // 4. Wired: a pop ma:route that uncovers the exposure layer restores focus; other modes and layers do not.
  {
    const F = fakeLayer();
    const a = F.mk('a', { dataset: { id: '2191' } }); F.card([a]);
    _expRememberLink(F.layer, a);
    let removed = 0;
    stack.push(F.layer, { kind: 'entity', el: { remove() { removed++; }, isConnected: true } });
    L.docListeners['ma:route'].forEach(f => f({ detail: { type: 'exposure', id: 'ETF:EEM:60', mode: 'pop', depth: 1 } }));
    check('pop ma:route back to the exposure layer: entity layer closed, link focused', removed === 1 && stack.length === 1 && a.focused === 1);
    stack.length = 0;
    const b = F.mk('a', { dataset: { id: '1' } }); F.card([b]); _expRememberLink(F.layer, b);
    stack.push({ kind: 'entity', el: { remove() {}, isConnected: true } });
    L.ctx._navOpen = () => {};
    L.docListeners['ma:route'].forEach(f => f({ detail: { type: 'entity', id: 1, mode: 'pop', depth: 1 } }));
    check('pop to a non-exposure layer: no focus change in the exposure layer', b.focused === 0);
    stack.length = 0;
  }
  check('entity link click remembers the link before opening the page', /a === 'entity'\) \{ e\.preventDefault\(\); _expRememberLink\(layer, b\); _navOpen\('entity'/.test(UI));
}

// --- N-4 contrast, N-6 wording ------------------------------------------------------------------
{
  const css = UI.slice(UI.indexOf("st.textContent = `"), UI.indexOf("document.head.appendChild(st);"));
  const rule = sel => { const m = new RegExp(`(?:^|[}\n])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`).exec(css); return m ? m[1] : ''; };
  for (const sel of ['.exp-row-type', '.exp-tr.head', '.exp-tbl2 th', '.exp-root h3', '.exp-picker label'])
    check(`N-4: ${sel} uses --text2`, rule(sel).includes('color:var(--text2)') && !rule(sel).includes('var(--dim)'), rule(sel));
  check('N-4: "Holdings dates" label uses --text2', UI.includes('<span style="font-size:10px;align-self:center;color:var(--text2)">Holdings dates:</span>'));
  check('N-4: no new colours (only palette variables in the changed rules)', !/#[0-9a-f]{3,6}/i.test(['.exp-row-type', '.exp-tr.head', '.exp-tbl2 th'].map(rule).join('')));
  check('N-6: reconciliation label "Companies (direct + via ETFs)"', UI.includes("['companies', 'Companies (direct + via ETFs)', 'var(--blue)']") && !UI.includes('Mapped companies'));
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
