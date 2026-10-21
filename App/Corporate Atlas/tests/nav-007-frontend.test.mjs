// MA-OCT-007 Phase 1 — front-end tests for build-review findings BR-1 and BR-2
// (claude/packets/MA-OCT-007.BR1_Report.md). Loads the real App/ma-entities.js in a
// vm context with a minimal DOM stub and a stubbed data_entitiesGet / fetch.
// No network, no D1. Run: node tests/nav-007-frontend.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(process.env.NAV_SRC || path.join(HERE, '../../ma-entities.js'), 'utf8');   // NAV_SRC: run against another copy (mutation check)

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(extra).slice(0, 300) : ''}`); }
}
const OUTAGE = "Couldn't reach Corporate Atlas";

// --- minimal DOM ---------------------------------------------------------------
function makeEl(tag = 'div') {
  return {
    tagName: tag, innerHTML: '', className: '', dataset: {}, style: { cssText: '' }, isConnected: false,
    remove() { this.isConnected = false; },
    // The gone page wires its search box and results list; give it stubs to hold.
    querySelector(sel) {
      if (sel !== '.nav-gone-search' && sel !== '.nav-gone-results') return null;
      this._kids = this._kids || {};
      return (this._kids[sel] = this._kids[sel] || { ...makeEl('input'), value: '', isConnected: true });
    },
    querySelectorAll() { return []; },
    insertAdjacentHTML(_, html) { this.innerHTML += html; },
    addEventListener() {},
  };
}

function makeCtx() {
  const listeners = {};
  const events = [];
  const body = { ...makeEl('body'), isConnected: true, appendChild(e) { e.isConnected = true; } };
  const ctx = {
    console: { ...console, error() {}, warn() {} },
    CSS: { escape: s => s },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    setTimeout, clearTimeout,
    location: { pathname: '/', search: '', hash: '' },
    history: { state: null, pushState(s) { this.state = s; }, replaceState(s) { this.state = s; }, back() {}, go() {} },
    document: {
      body,
      createElement: makeEl,
      addEventListener(t, f) { listeners[t] = f; },
      dispatchEvent(ev) { events.push(ev); },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    _nextAtlasOverlayZ: () => 1600,
    // Response queue for data_entitiesGet, keyed by path prefix; default 200 {}.
    __responses: [],
    data_entitiesGet: async p => {
      const i = ctx.__responses.findIndex(r => p.startsWith(r.prefix));
      if (i < 0) return { ok: true, status: 200, data: {} };
      return ctx.__responses.splice(i, 1)[0].res;
    },
    fetch: async () => ({ ok: false, status: 500, json: async () => ({ error: 'Internal error' }) }),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ma-entities.js' });
  return { ctx, listeners, events, run: code => vm.runInContext(code, ctx) };
}
const tick = () => new Promise(r => setTimeout(r, 0));

const MATCHED = {
  instrument_key: 'US5949181045', identifiers: { isin: 'US5949181045', cusip: '594918104', ticker: 'MSFT' }, asset_type: 'EC',
  name: 'MICROSOFT CORP', state: 'matched', reason: null, placeholder_key: false, as_of: '2026-08-31',
  candidates: [{ entity_id: 1371, name: 'Microsoft Corp.', lei: 'INR2EJN1ERAN0W5ZP974', source: 'isin_tier1', source_table: 'instrument_entity_map',
    confidence: 100, confidence_band: 'high', redirect: null, as_of: '2026-08-31', also_sources: [] }],
};
const ERR500 = { ok: false, status: 500, data: { error: 'Internal error' } };

// ============================ BR-1: 5xx = outage ============================
if (makeCtx().run('typeof _navIsOutage') !== 'function') check('BR-1 _navIsOutage exists', false);
else {
  const { run } = makeCtx();
  const t = run(`[[0,true],[500,true],[502,true],[503,true],[200,false],[400,false],[404,false],[409,false]].map(([s,e]) => _navIsOutage({ status: s }) === e)`);
  check('BR-1 _navIsOutage table', t.every(Boolean), JSON.stringify(t));
  check('BR-1 _navIsOutage(null) is an outage', run('_navIsOutage(null)') === true);
}

for (const [label, res] of [['500', ERR500], ['503', { ok: false, status: 503, data: null }], ['network (0)', { ok: false, status: 0, type: 'network_error', data: null }]]) {
  const { ctx, events, run } = makeCtx();
  ctx.__responses.push({ prefix: '/api/instruments/', res });
  await run(`_navOpen('instrument', 'US5949181045', { history: 'push' })`);
  const html = run('_navStack[_navStack.length - 1].el.innerHTML');
  check(`BR-1 card ${label}: outage text`, html.includes(OUTAGE), html);
  check(`BR-1 card ${label}: Retry`, html.includes('_navRetry(1)'), html);
  check(`BR-1 card ${label}: not a link/mapping message`, !html.includes("That link isn't valid") && !html.includes('No issuer'), html);
  const st = events.filter(e => e.type === 'ma:instrument-state').map(e => e.detail);
  check(`BR-1 card ${label}: state event error=network, state null`, st.length === 1 && st[0].error === 'network' && st[0].state === null, JSON.stringify(st));
}

{ // Retry after the outage clears renders the real card
  const { ctx, run } = makeCtx();
  ctx.__responses.push({ prefix: '/api/instruments/', res: ERR500 });
  await run(`_navOpen('instrument', 'US5949181045', { history: 'push' })`);
  ctx.__responses.push({ prefix: '/api/instruments/', res: { ok: true, status: 200, data: MATCHED } });
  run('_navRetry(1)'); await tick(); await tick();
  const html = run('_navStack[0].el.innerHTML');
  check('BR-1 card Retry recovers to Matched', html.includes('Matched') && !html.includes(OUTAGE), html);
}

{ // a 400 is still a bad link, not an outage
  const { ctx, run } = makeCtx();
  ctx.__responses.push({ prefix: '/api/instruments/', res: { ok: false, status: 400, data: { error: 'Invalid instrument_key' } } });
  await run(`_navOpen('instrument', 'x', { history: 'push' })`);
  const html = run('_navStack[0].el.innerHTML');
  check('BR-1 card 400 stays "That link isn\'t valid"', html.includes("That link isn't valid") && !html.includes(OUTAGE), html);
}

{ // issuer layer: 500 → outage + Retry; 404 → gone page
  const { ctx, run } = makeCtx();
  ctx.__responses.push({ prefix: '/api/entities/', res: ERR500 });
  await run(`_navOpen('entity', 1371, { history: 'push' })`);
  let html = run('_navStack[0].el.innerHTML');
  check('BR-1 issuer layer 500: outage + Retry', html.includes(OUTAGE) && html.includes('_navRetry(1)') && !html.includes('Entity data unavailable'), html);
  ctx.__responses.push({ prefix: '/api/entities/', res: { ok: false, status: 404, data: { error: 'not_found', state: 'gone', requested_id: 25782 } } });
  await run(`_navOpen('entity', 25782, { history: 'push' })`);
  html = run('_navStack[1].el.innerHTML');
  check('BR-1 issuer layer 404 stays the gone page', html.includes('no longer in Meridian Atlas') && !html.includes(OUTAGE), html);
}

{ // ma:open-instrument with a 500 opens the card in the outage state and emits error=network
  const { ctx, listeners, events, run } = makeCtx();
  ctx.__responses.push({ prefix: '/api/instruments/', res: ERR500 });
  await listeners['ma:open-instrument']({ detail: { instrument_key: 'US5949181045', from: 'etf:VTI:holdings' } });
  await tick();
  const top = run('({ kind: _navStack[0] && _navStack[0].kind, html: _navStack[0] && _navStack[0].el.innerHTML })');
  check('BR-1 ma:open-instrument 500 → card, outage + Retry', top.kind === 'instrument' && top.html.includes(OUTAGE) && top.html.includes('_navRetry'), JSON.stringify(top).slice(0, 300));
  const st = events.filter(e => e.type === 'ma:instrument-state').map(e => e.detail);
  check('BR-1 ma:open-instrument 500 → error=network event, never unmatched', st.length >= 1 && st.every(d => d.error === 'network' && d.state !== 'unmatched'), JSON.stringify(st));
}

{ // linked instruments: 500 → outage + Retry; 404 → "unavailable" + Retry
  const { ctx, run } = makeCtx();
  for (const [res, expectOutage] of [[ERR500, true], [{ ok: false, status: 404, data: { error: 'not_found' } }, false]]) {
    ctx.__responses.push({ prefix: '/api/entities/5/instruments', res });
    ctx.__sec = { ...makeEl(), isConnected: true };
    run(`__sec._nav = { entityId: 5, rows: [], cursor: '', total: null, capped: false, pages: 0, multi: false, error: false }`);
    await run('_linkedLoadPage(__sec)');
    const html = ctx.__sec.innerHTML;
    if (expectOutage) check('BR-1 linked list 500: outage + Retry', html.includes(OUTAGE) && html.includes('Retry'), html);
    else check('BR-1 linked list 404: "unavailable" + Retry, not outage', html.includes('Linked instruments unavailable') && html.includes('Retry') && !html.includes(OUTAGE), html);
  }
}

{ // Corporate Atlas panel path (showEntityDetail uses fetch directly): 500 → outage + Retry
  const { ctx, run } = makeCtx();
  await run(`showEntityDetail(1371, 'Galaxy')`);
  const html = ctx.document.body.innerHTML;
  check('BR-1 panel path 500: outage text', html.includes(OUTAGE) && !html.includes('Unable to load entity'), html);
  check('BR-1 panel path 500: Retry re-runs showEntityDetail(1371)', html.includes('↻ Retry') && html.includes('showEntityDetail(1371'), html);
  check('BR-1 panel path 500: Back still offered', html.includes('← Back to Galaxy'), html);
}

// ===================== BR-2: placeholder identifiers hidden =====================
if (makeCtx().run('typeof _navRealId') !== 'function') check('BR-2 _navRealId exists', false);
else {
  const { run } = makeCtx();
  const hidden = run(`['N/A','n/a','NA','na','NONE','none','NULL','-','—','000000000','0','',  '   '].map(v => _navRealId(v))`);
  check('BR-2 _navRealId hides placeholders', hidden.every(v => v === null), JSON.stringify(hidden));
  const kept = run(`['594918104','US5949181045','MSFT','XS2199266698','00A123456'].map(v => _navRealId(v))`);
  check('BR-2 _navRealId keeps real identifiers', JSON.stringify(kept) === JSON.stringify(['594918104', 'US5949181045', 'MSFT', 'XS2199266698', '00A123456']), JSON.stringify(kept));
  check('BR-2 _navRealId(null/undefined)', run('_navRealId(null) === null && _navRealId(undefined) === null'));
}

{ // linked-instrument row line
  const { run } = makeCtx();
  const row = (ids) => run(`_instrumentRowHtml({ instrument_key: 'K', identifiers: ${JSON.stringify(ids)}, name: 'Bayer AG', asset_type: 'DBT',
     candidates: [{ source: 'heuristic', confidence: 75, confidence_band: 'low' }] }, 2730, 1, false)`);
  let h = row({ isin: 'XS2199266698', cusip: 'N/A', ticker: 'N/A' });
  check('BR-2 row: ISIN shown, no "N/A"', h.includes('ISIN XS2199266698') && !h.includes('N/A'), h);
  h = row({ isin: null, cusip: 'N/A', ticker: null });
  check('BR-2 row: placeholder CUSIP → "No identifier on file"', h.includes('No identifier on file') && !h.includes('CUSIP N/A'), h);
  h = row({ isin: null, cusip: '000000000', ticker: null });
  check('BR-2 row: all-zero CUSIP hidden', h.includes('No identifier on file') && !h.includes('000000000'), h);
  h = row({ isin: null, cusip: '594918AB0', ticker: null });
  check('BR-2 row: real CUSIP still shown', h.includes('CUSIP 594918AB0'), h);
}

{ // Instrument card identifier grid
  const { ctx, run } = makeCtx();
  const card = async (ids, key) => {
    const nl = { ...MATCHED, instrument_key: key, identifiers: ids, name: 'Bayer AG' };
    await run(`_navOpen('instrument', ${JSON.stringify(key)}, { history: 'push', prefetched: { ok: true, status: 200, data: ${JSON.stringify(nl)} } })`);
    return run('_navStack[_navStack.length - 1].el.innerHTML');
  };
  let h = await card({ isin: 'XS2199266698', cusip: 'N/A', ticker: null }, 'XS2199266698');
  check('BR-2 card: ISIN row shown', h.includes('>ISIN<') && h.includes('XS2199266698'), h);
  check('BR-2 card: "CUSIP N/A" row hidden', !h.includes('>CUSIP<') && !h.includes('N/A'), h);
  h = await card({ isin: 'DE000BAY0017', cusip: '000000000', ticker: 'NONE' }, 'DE000BAY0017');
  check('BR-2 card: all-zero CUSIP and "NONE" ticker hidden', !h.includes('>CUSIP<') && !h.includes('000000000') && !h.includes('>Ticker<'), h);
  h = await card({ isin: 'US5949181045', cusip: '594918104', ticker: 'MSFT' }, 'US5949181045');
  check('BR-2 card: real identifiers all shown', h.includes('>ISIN<') && h.includes('>CUSIP<') && h.includes('594918104') && h.includes('>Ticker<'), h);
  check('BR-2 card: instrument key line unchanged', h.includes('>Key<') && h.includes('US5949181045'), h);
}

{ // provenance strip
  const { run } = makeCtx();
  const strip = (ids) => run(`_navProvenanceHtml(${JSON.stringify({ ...MATCHED, identifiers: ids })})`);
  let h = strip({ isin: null, cusip: '000000000', ticker: 'BAY' });
  check('BR-2 strip: placeholder CUSIP skipped, ticker used', h.includes('Ticker BAY') && !h.includes('000000000'), h);
  h = strip({ isin: null, cusip: 'N/A', ticker: null });
  check('BR-2 strip: no identifiers → falls back to the key', h.includes('US5949181045') && !h.includes('N/A'), h);
}

console.log(`nav-007-frontend (BR-1, BR-2): ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
