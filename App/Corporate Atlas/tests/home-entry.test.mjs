// MA-NOV-UI.HOME.BUILD — homepage Research card (layout A), company search, phone width, delayed-data labels.
// Spec claude/specs/MA-NOV-UI_Spec.md §2.5–2.7, §5.2 (H-1, H-7, H-9 here; H-2–H-6, H-8, H-10 in the preview);
// card wording from claude/packets/MA-NOV-UI.HOME.BUILD_Task_v1.md (layout A replaces spec §2.2/§2.3 copy).
// Static checks of App/index.html, plus the search logic in App/ma-search.js run in a vm with a small DOM fake.
// No network, no D1, no storage.
// Run: node "App/Corporate Atlas/tests/home-entry.test.mjs"   (HOME_HTML=<path> / HOME_SEARCH=<path> run another copy)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(process.env.HOME_HTML || path.join(HERE, '../../index.html'), 'utf8');
const SRC = readFileSync(process.env.HOME_SEARCH || path.join(HERE, '../../ma-search.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : ''}`); }
}
const count = (hay, needle) => hay.split(needle).length - 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BANNED = ['real-time', 'live data', 'complete', 'all holders', 'current ownership'];

// ── H-1: card wording verbatim (Task v1) ──────────────────────────────────────────────────────
const card = (/<section class="card card-blue" id="home-research"[\s\S]*?<\/section>/.exec(HTML) || [''])[0];
check('card section found', card.length > 0);
const CARD_STRINGS = [
  '>Research</h2>',
  'See which companies your investments really hold',
  'Connects ETF holdings, companies, 13F positions and SEC-registered bonds, so you can follow one company across all of them.',
  'href="#/exposure">Analyse my portfolio</a>',
  'href="#/exposure?i=ETF:IVV:60,ETF:EEM:25,EQ:2191:15">See an example: IVV 60%, EEM 25%, Taiwan Semiconductor 15%</a>',
  '>Company research</h3>',
  '<label class="hr-vh" for="hr-q">Company name</label>',
  'placeholder="Company name, e.g. Apple"',
  '>Search</button>',
  'Built from stored public filings (SEC N-PORT, 13F, EDGAR); fund holdings are usually several months old. Nothing you enter is saved.',
];
for (const s of CARD_STRINGS) check(`H-1 card has: ${s.slice(0, 60)}`, count(card, s) === 1);
check('H-1 lead is .hr-lead (13px, 600, --text)', /class="hr-lead">See which/.test(card) && /\.hr-lead\{font-size:13px;font-weight:600;color:var\(--text\)/.test(HTML));
check('H-1 line is .hr-line (11.5px, --text2)', /\.hr-line\{font-size:11\.5px;color:var\(--text2\)/.test(HTML));
check('H-1 sub-heading 11px uppercase --text2', /\.hr-sub\{font-size:11px;[^}]*text-transform:uppercase;color:var\(--text2\)/.test(HTML));
check('H-1 note 10px --muted', /\.hr-note\{font-size:10px;color:var\(--muted\)/.test(HTML));
check('H-1 header uses .chdr/.ctitle', /<div class="chdr"><h2 class="ctitle" id="hr-title">Research<\/h2><\/div>/.test(card));
check('H-1 primary button has the .btn.on look', /class="btn on hr-primary"/.test(card));

// search state texts (spec §2.5)
const SEARCH_STRINGS = [
  "loading: 'Searching…'",
  `empty: 'No companies found. Try the legal name, for example "Apple Inc".'`,
  `error: "Couldn't reach company search. Try again."`,
  "retry: 'Try again'",
];
for (const s of SEARCH_STRINGS) check(`H-1 search text: ${s.slice(0, 50)}`, count(SRC, s) === 1);

// banned words on the new and changed lines
const block = SRC.slice(SRC.indexOf('MA-NOV-UI.HOME.BUILD'));
check('search block found', block.length > 100 && block.length < SRC.length);
const pill = (/<div class="live-pill"[^]*?<\/div>/.exec(HTML) || [''])[0];
const sectors = (/<span class="sec-hdr-note">[^<]*<\/span>/.exec(HTML) || [''])[0];
const visibleNew = (card + pill + sectors).replace(/<[^>]+>/g, ' ').toLowerCase();
const searchTexts = SEARCH_STRINGS.join(' ').toLowerCase();
for (const w of BANNED) {
  check(`H-1 banned "${w}" absent from card, pill, sectors note`, !visibleNew.includes(w));
  check(`H-1 banned "${w}" absent from search texts`, !searchTexts.includes(w));
}

// ── H-9: no live claim (UD-6) ──────────────────────────────────────────────────────────────────
check('H-9 pill reads DELAYED', /<span class="live-txt">DELAYED<\/span>/.test(pill));
check('H-9 pill tooltip', pill.includes('title="Market prices are delayed and refresh automatically."'));
check('H-9 no pulsing dot element', !HTML.includes('class="live-dot"'));
check('H-9 no pulse animation rule left', !/live-dot\{|@keyframes pdot/.test(HTML));
check('H-9 pill neutral colours', /\.live-pill\{[^}]*background:var\(--bg3\);border:1px solid var\(--border\)/.test(HTML) && /\.live-txt\{[^}]*color:var\(--text2\)/.test(HTML));
check('H-9 no ">LIVE<" text', !/>\s*LIVE\s*</.test(HTML));
check('H-9 sectors note "Sector ETFs"', sectors === '<span class="sec-hdr-note">Sector ETFs</span>');
check('H-9 "Live ETF view" gone', !HTML.includes('Live ETF view'));

// ── H-7: every market/news id from HEAD 4ad4ca3 (intel banner … </main>) is still there, once ─────
const KEPT_IDS = ('intel-banner risk-label market-narrative ms-spx ms-ndx ms-stx ms-n225 ms-hsi ms-us2y ms-us10 ms-de10 ms-vix '
  + 'ms-gold ms-oil ms-eur ms-jpy regime-drivers tkwrap tkinner main left idx-seg tb-global curve-lbl yield-matrix tb-yields '
  + 'y-us2 y-us5 y-us10 y-us30 y-uk10 y-de10 y-jp10 y-lqd-chg y-lqd-price y-hyg-chg y-hyg-price y-ieac-chg y-ieac-price '
  + 'yc-shape-lbl yc-svg cr-lqd-price cr-lqd-chg cr-hyg-price cr-hyg-chg cr-spread cr-spread-lbl b-us tb-us b-eu tb-eu '
  + 'mv-updated mv-grid tb-commodities tb-fx b-fut tb-futures right nc nlist nc-geo glist cal-seg cal-list wl-count '
  + 'wl-input-row wl-input search-results wl-add wl-list sector-list').split(' ');
check('H-7 list has 71 ids', KEPT_IDS.length === 71);
for (const id of KEPT_IDS) check(`H-7 id ${id} present once`, count(HTML, ` id="${id}"`) === 1);
const allIds = [...HTML.matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]);
const dup = allIds.filter((x, i) => allIds.indexOf(x) !== i);
check('no duplicate static ids in index.html', dup.length === 0, dup);
const HEADER_IDS = ['resbtn', 'dcfTabBtn', 'etfHoldingsBtn', 'corpAtlasBtn', 'fiBtn', 'expBtn', 'opsBtn', 'darkbtn', 'abtn', 'rbtn', 'cmpbtn', 'search', 'clock'];
for (const id of HEADER_IDS) check(`header id ${id} present once`, count(HTML, ` id="${id}"`) === 1);
check('header Exposure tile still links #/exposure', /id="expBtn" href="#\/exposure"/.test(HTML));
// market and news cards keep their order: World Indices → … → Futures in #left; News → … → Sectors in #right
const order = ['World Indices', 'Sovereign Yields', 'US Equities', 'European Equities', 'Market Movers', 'Commodities',
  'G10 Currencies', 'Futures', 'Market News', 'Geopolitics', 'Economic Calendar', 'Watchlist', 'Equity Sectors'];
const pos = order.map(t => HTML.indexOf(`>${t}</`));
check('market/news card titles present and in order', pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), pos);

// ── Layout A placement ──────────────────────────────────────────────────────────────────────────
check('card is the first child of #right', /<aside id="right"[^>]*>\s*<!--[^]*?-->\s*<section class="card card-blue" id="home-research"/.test(HTML));
check('card precedes Market News', HTML.indexOf('id="home-research"') < HTML.indexOf('>Market News<'));
check('card is static HTML (no script builds it)', !/home-research/.test(SRC));
const m900 = (/@media \(max-width: 900px\)\{[^]*?\n\}/.exec(HTML) || [''])[0];
check('≤900: #right display:contents', m900.includes('#right{display:contents}'));
check('≤900: card order 0, #left order 1, other right cards order 2', m900.includes('#home-research{order:0}') && /#left\{order:1;/.test(m900) && m900.includes('#right > section:not(#home-research){order:2}'));
check('≤900: #main stacks', m900.includes('#main{flex-direction:column;'));
check('≤900: header wraps, tiles one scrollable row', /#header\{flex-wrap:wrap;height:auto;/.test(m900) && /\.htiles\{order:10;flex:1 0 100%;[^}]*overflow-x:auto;flex-wrap:nowrap;scroll-snap-type:x proximity/.test(m900));
check('≤900: Exposure second in the tile row', m900.includes('#resbtn{order:0} #expBtn{order:1}'));
check('≤900: tables scroll inside cards', m900.includes('#main .card{overflow-x:auto;'));
check('≤900: grid2 one column', m900.includes('.grid2{grid-template-columns:minmax(0,1fr)}'));
const m640 = (/@media \(max-width: 640px\)\{\n  #cmpbtn[^]*?\n\}/.exec(HTML) || [''])[0];
check('≤640: compact, clock and pill hidden', m640.includes('#cmpbtn,#clock,.live-pill{display:none}'));
check('≤640: buttons ≥ 32px', m640.includes('#hr-q,.hr-go{height:32px}') && m640.includes('min-height:32px'));
check('focus-visible ring rule', /:focus-visible\{outline:2px solid var\(--blue\);outline-offset:1px\}/.test(HTML));
check('header tiles grouped in nav.htiles', /<nav class="htiles" aria-label="Research tools">\n<button class="btn action-tile" id="resbtn"[^]*?id="opsBtn"[^]*?<\/a>\n<\/nav>/.test(HTML));

// ── Search domain boundaries (§2.5) ─────────────────────────────────────────────────────────────
check('no storage in search block', !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(block));
check('no import / no ma-entities.js internals', !/\bimport\b|require\(|_expuiGet|_esc\(|_navHash|ENTITIES_API_URL/.test(block));
check('uses the shared data_entitiesGet and the search route', block.includes('data_entitiesGet(`/api/entities/search?q=${encodeURIComponent(q)}`)'));
check('debounce 350 ms, min 2, max 8', /HS_DEBOUNCE_MS = 350\b/.test(block) && /HS_MIN = 2\b/.test(block) && /HS_MAX = 8\b/.test(block));
check('results link to #/entity/{id}', block.includes('href="#/entity/${Number(r.id)}"'));

// ── Pure logic: hsView / hsRowsHtml ─────────────────────────────────────────────────────────────
function loadSearch(extra = {}) {
  const ctx = {
    console: { ...console, warn() {}, error() {} }, setTimeout, clearTimeout,
    document: { readyState: 'complete', addEventListener() {}, getElementById() { return null; } },
    escapeRdHtml: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    ...extra,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ma-search.js' });
  return ctx;
}
const S = loadSearch();
const plain = x => JSON.parse(JSON.stringify(x));
check('short: empty', plain(S.hsView('')).state === 'short');
check('short: 1 char', plain(S.hsView(' T ')).state === 'short');
check('loading: pending answer', plain(S.hsView('Ta')).state === 'loading');
check('error: network (status 0)', plain(S.hsView('Apple', { ok: false, status: 0, data: null })).state === 'error');
check('error: 5xx', plain(S.hsView('Apple', { ok: false, status: 503, data: {} })).state === 'error');
check('empty: no results', plain(S.hsView('zzqx', { ok: true, status: 200, data: { results: [] } })).state === 'empty');
check('empty: malformed body', plain(S.hsView('zzqx', { ok: true, status: 200, data: null })).state === 'empty');
const many = Array.from({ length: 12 }, (_, i) => ({ entity_id: i + 1, legal_name: 'Co ' + i, country: 'US', type: 'operating' }));
const v8 = plain(S.hsView('Co', { ok: true, status: 200, data: { results: many } }));
check('results: capped at 8', v8.state === 'results' && v8.rows.length === 8);
check('results: row shape', JSON.stringify(v8.rows[0]) === JSON.stringify({ id: 1, name: 'Co 0', meta: 'US · operating · #1' }));
const odd = plain(S.hsView('xy', { ok: true, status: 200, data: { results: [{ entity_id: 'abc' }, { entity_id: -3 }, { entity_id: 2191, legal_name: null, name: 'TSMC' }, { entity_id: 7 }] } }));
check('results: bad ids skipped, name fallbacks', odd.state === 'results' && odd.rows.length === 2 && odd.rows[0].name === 'TSMC' && odd.rows[1].name === '#7' && odd.rows[1].meta === '#7');
const html = S.hsRowsHtml([{ id: 5, name: '<img src=x onerror=alert(1)>"&', meta: 'U<S' }]);
check('escaping: no raw tags or quotes', !html.includes('<img') && html.includes('&lt;img') && html.includes('&quot;&amp;') && html.includes('U&lt;S'));
check('row link', html.startsWith('<li><a class="hr-res" id="hr-r-0" href="#/entity/5">'));
const S2 = loadSearch({ escapeRdHtml: undefined });
check('escaping: fallback when escapeRdHtml is missing', !S2.hsRowsHtml([{ id: 1, name: '<b>', meta: '' }]).includes('<b>'));

// ── Controller with a DOM fake: debounce, stale answers, retry, keyboard ────────────────────────
function fakeEl(id) {
  const l = {};
  return {
    id, dataset: {}, value: '', hidden: false, textContent: '', children: [], innerHTML: '',
    addEventListener(t, f) { (l[t] ||= []).push(f); },
    fire(t, e = {}) { (l[t] || []).forEach(f => f({ preventDefault() {}, ...e })); },
    append(...k) { this.children.push(...k); },
    focus() { doc.activeElement = this; },
    querySelectorAll() { return []; },
  };
}
const els = { 'hr-form': fakeEl('hr-form'), 'hr-q': fakeEl('hr-q'), 'hr-status': fakeEl('hr-status'), 'hr-results': fakeEl('hr-results') };
// textContent setter on status clears appended children like the real DOM
let stKids = [];
Object.defineProperty(els['hr-status'], 'textContent', { get() { return this._t || ''; }, set(v) { this._t = v; stKids.length = 0; } });
els['hr-status'].children = stKids;
els['hr-status'].append = (...k) => stKids.push(...k);
const doc = {
  readyState: 'complete', activeElement: null, addEventListener() {},
  getElementById: id => els[id] || null,
  createElement: tag => { const e = fakeEl(); e.tagName = tag; return e; },
};
const calls = [];
const pending = [];
const C = loadSearch({
  document: doc,
  data_entitiesGet: path => { calls.push(path); return new Promise(r => pending.push(r)); },
});
check('controller bound once', els['hr-form'].dataset.hsReady === '1');
C.hsInit();
check('init is idempotent', true);
const q = els['hr-q'], st = els['hr-status'], list = els['hr-results'];
const type = v => { q.value = v; q.fire('input'); };
type('T');
check('1 char: no request, nothing shown', calls.length === 0 && st.textContent === '' && list.hidden === true);
type('Ta'); type('Tai'); type('Taiwan');
await sleep(200);
check('debounce: nothing before 350 ms', calls.length === 0);
await sleep(250);
check('debounce: one request after settling', calls.length === 1 && calls[0] === '/api/entities/search?q=Taiwan');
check('loading text', st.textContent === 'Searching…');
type('Taiwan Semi');
await sleep(400);
check('second settled query: second request', calls.length === 2);
pending[1]({ ok: true, status: 200, data: { results: [{ entity_id: 2191, legal_name: 'Taiwan Semiconductor Manufacturing Co Ltd', country: 'TW', type: 'operating' }] } });
await sleep(0);
check('newest answer painted', list.hidden === false && list.innerHTML.includes('#/entity/2191'));
pending[0]({ ok: true, status: 200, data: { results: [{ entity_id: 9, legal_name: 'Old', country: 'US', type: 'x' }] } });
await sleep(0);
check('older answer ignored', !list.innerHTML.includes('#/entity/9') && list.innerHTML.includes('#/entity/2191'));
els['hr-form'].fire('submit');
check('submit of the shown query: no new request', calls.length === 2);
type('zzqxv');
els['hr-form'].fire('submit');
check('Enter/Search: immediate request', calls.length === 3);
pending[2]({ ok: true, status: 200, data: { results: [] } });
await sleep(0);
check('no-results text', st.textContent === 'No companies found. Try the legal name, for example "Apple Inc".' && list.hidden === true);
type('Apple');
els['hr-form'].fire('submit');
pending[3]({ ok: false, status: 0, type: 'network_error', data: null });
await sleep(0);
const retry = stKids.find(k => k.id === 'hr-retry');
check('error text and Try again button', stKids[0] && stKids[0].textContent === "Couldn't reach company search. Try again." && retry && retry.textContent === 'Try again');
retry.fire('click');
check('Try again re-requests', calls.length === 5 && calls[4] === '/api/entities/search?q=Apple');
pending[4]({ ok: true, status: 200, data: { results: [{ entity_id: 1662, legal_name: 'Apple Inc.', country: 'US', type: 'operating' }] } });
await sleep(0);
check('after retry: results', list.hidden === false && list.innerHTML.includes('#/entity/1662') && stKids.length === 0);
q.fire('keydown', { key: 'Escape' });
check('Escape clears input and results', q.value === '' && list.hidden === true && list.innerHTML === '' && st.textContent === '');
check('no extra requests', calls.length === 5);

console.log(`home-entry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
