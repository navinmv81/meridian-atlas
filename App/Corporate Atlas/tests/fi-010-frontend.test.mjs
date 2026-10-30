#!/usr/bin/env node
// MA-OCT-010 — front-end fixture tests (spec 009/010 rev 1 §7, T-F9 minus the live 375 px layout pass).
// Loads the real App/ma-entities.js in a vm context with a minimal DOM stub (as nav-007-frontend.test.mjs).
// data_entitiesGet is answered by the REAL src/entities-api.js Worker over an in-memory node:sqlite D1
// (migrations 008 + 009), so the UI is tested against the real 009 response contract. No network, no D1.
//   node "App/Corporate Atlas/tests/fi-010-frontend.test.mjs"      (NAV_SRC=<file> runs another ma-entities.js)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const APP = path.resolve(CA, '..');
const SRC = readFileSync(process.env.NAV_SRC || path.join(APP, 'ma-entities.js'), 'utf8');
const INDEX = readFileSync(path.join(APP, 'index.html'), 'utf8');
const worker = (await import(pathToFileURL(path.join(CA, 'src', 'entities-api.js')).href)).default;

let pass = 0, fail = 0;
const check = (name, ok, extra) => { ok ? pass++ : fail++; if (!ok) console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : ''}`); };
const tick = () => new Promise(r => setTimeout(r, 0));

// --- fixture D1 + Worker ------------------------------------------------------------------------
function buildDb(gate) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, name TEXT, legal_name TEXT, lei TEXT, type TEXT, entity_status TEXT);
    CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);
    INSERT INTO entity_master VALUES (1,'ISSUER A','Issuer A Inc.','LEIAAAAAAAAAAAAAAA01','operating','ACTIVE'), (2,'ISSUER B',NULL,'LEIBBBBBBBBBBBBBBB02','operating','ACTIVE'),
      (3,'WIDE CO',NULL,NULL,'operating','ACTIVE'), (7,'NO BONDS',NULL,NULL,'operating','ACTIVE');`);
  db.exec(readFileSync(path.join(CA, 'migrations', '008-bonds.sql'), 'utf8'));
  db.exec(readFileSync(path.join(CA, 'migrations', '009-fi-serving-gate.sql'), 'utf8'));
  if (gate === 'open') db.exec(`UPDATE fi_serving_gate SET state='open', changed_at='2026-10-29T08:00:00Z' WHERE id=1`);
  const L = db.prepare(`INSERT INTO bond_issuer_link (cik, entity_id, link_method, confidence, issuer_name, status, linked_at, last_polled_at) VALUES (?,?,?,?,?,?,'2026-10-15T00:00:00Z',?)`);
  L.run('0000000001', 1, 'cik', 95, 'ISSUER A INC', 'active', '2026-10-20T06:00:00Z');
  L.run('0000000002', 2, 'cik', 95, 'ISSUER B PLC', 'active', '2026-10-21T06:00:00Z');
  L.run('0000000003', 2, 'lei', 85, 'ISSUER B FUNDING', 'active', '2026-10-22T06:00:00Z');
  for (let i = 0; i < 11; i++) L.run(`00000001${String(i).padStart(2, '0')}`, 3, 'cik', 95, `WIDE ${i}`, 'active', null);
  L.run('0002007029', null, 'unmatched', 1, 'PEPSICO SINGAPORE FINANCING I PTE LTD', 'paused', '2026-10-28T06:00:00Z');
  const B = db.prepare(`INSERT INTO bond_issuance (accession_number, tranche_seq, cik, instrument_key, isin, cusip, form_type, filing_date, filing_status, tranche_label,
      security_class, rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date, seniority, source_url, parse_confidence, parser_version, ingested_at)
    VALUES (?,?,?,?,NULL,?,'424B2',?,'final',?,'Senior Notes',?,?,?,?,?,?,?,?,'https://www.sec.gov/Archives/edgar/data/1/x.htm',?,'bonds-p1','2026-10-16T00:00:00Z')`);
  let n = 0; const acc = () => `0000000001-26-${String(++n).padStart(6, '0')}`;
  B.run(acc(), 1, '0000000001', 'CUSIP:111111AA1', '111111AA1', '2025-03-01', '5.850% Notes due 2030', 'fixed', 5.85, null, null, 1e9, 'USD', '2030-03-01', 'senior unsecured', 95);
  B.run(acc(), 1, '0000000001', 'CUSIP:111111AA1', '111111AA1', '2026-02-01', 'PROSPECTUS SUPPLEMENT Dated February 1, 2026', 'fixed', 5.85, null, null, 5e8, 'USD', '2030-03-01', null, 95);
  B.run(acc(), 1, '0000000001', null, null, '2025-06-01', 'Floating Rate Notes due 2034', 'floating', null, null, 'SOFR', 7.5e8, 'USD', '2034-06-15', null, 75);
  B.run(acc(), 1, '0000000001', null, null, '2018-01-01', 'Old notes', 'fixed', 3.1, null, null, 2e8, 'USD', '2019-01-01', 'senior', 95);
  B.run(acc(), 1, '0000000001', null, null, '2025-07-01', 'Euro notes', 'fixed', 3.25, null, null, 7.5e8, 'EUR', '2045-05-05', 'senior', 90);
  for (let i = 0; i < 30; i++) B.run(acc(), 1, i % 2 ? '0000000002' : '0000000003', null, null, '2025-01-01', `B note ${i}`, 'fixed', 4 + i / 10, null, null, 1e8, 'USD', `${2027 + i}-01-01`, 'senior', 95);
  B.run('0001104659-24-022370', 1, '0002007029', null, null, '2024-03-01', 'SGD notes', 'fixed', 3.5, null, null, 4.5e8, 'SGD', '2029-02-20', null, 85);
  return db;
}
function workerEnv(db) {
  const run = (sql, p, mode) => { const st = db.prepare(sql); return mode === 'first' ? (st.get(...p) ?? null) : { results: st.all(...p) }; };
  const prep = sql => { const st = { sql, params: [], bind(...p) { st.params = p; return st; }, async first() { return run(sql, st.params, 'first'); }, async all() { return run(sql, st.params, 'all'); } }; return st; };
  return { DB: { prepare: prep, batch: async s => s.map(x => run(x.sql, x.params, 'all')) } };
}
globalThis.caches = undefined;

// --- minimal DOM (as nav-007-frontend) ------------------------------------------------------------
function makeEl(tag = 'div') {
  const el = {
    tagName: tag, innerHTML: '', className: '', id: '', dataset: {}, style: { cssText: '', display: '' }, isConnected: false, textContent: '',
    remove() { this.isConnected = false; },
    querySelector(sel) { return sel === '.fi-dir-rows' ? (this._dir = this._dir || { innerHTML: '' }) : null; },
    querySelectorAll() { return []; },
    insertAdjacentHTML(_, html) { this.innerHTML += html; },
    addEventListener() {},
    closest() { return null; },
  };
  return el;
}
function makeCtx({ gate = 'open', override = null } = {}) {
  const db = buildDb(gate);
  const env = workerEnv(db);
  const listeners = {}, calls = [];
  const head = { appendChild(e) { head.kids.push(e); }, kids: [] };
  const body = { ...makeEl('body'), isConnected: true, appendChild(e) { e.isConnected = true; } };
  const ctx = {
    console: { ...console, error() {}, warn() {}, log() {} },
    CSS: { escape: s => s }, URLSearchParams,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    setTimeout, clearTimeout,
    location: { pathname: '/', search: '', hash: '' },
    history: { state: null, entries: [], pushState(s, _, h) { this.state = s; this.entries.push(h); }, replaceState(s, _, h) { this.state = s; this.last = h; }, back() {}, go() {} },
    document: { body, head, createElement: makeEl, addEventListener(t, f) { listeners[t] = f; }, dispatchEvent() {},
      getElementById(id) { return head.kids.find(k => k.id === id) || null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
    _nextAtlasOverlayZ: () => 1600,
    data_entitiesGet: async p => {
      calls.push(p);
      if (override) { const o = override(p); if (o) return o; }
      const r = await worker.fetch(new Request(`https://w.test${p}`), env, { waitUntil() {} });
      let data = null; try { data = await r.json(); } catch {}
      return { ok: r.ok, status: r.status, data };
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ma-entities.js' });
  return { ctx, db, listeners, calls, run: code => vm.runInContext(code, ctx) };
}
function sectionRoot(ctx, id) {
  const section = { ...makeEl(), id: `issuer-bonds-section-${id}`, isConnected: true, style: { display: 'none' } };
  section.closest = () => section;
  const root = { querySelector: sel => (sel === `#issuer-bonds-section-${id}` ? section : null) };
  ctx.__root = root; ctx.__section = section;
  return section;
}
async function loadSection(c, id) {
  const s = sectionRoot(c.ctx, id);
  await c.run(`_loadIssuerBonds(${id}, __root)`);
  return s;
}
const DISCLOSURE = 'Issuance and reference data from SEC filings. Not live prices or yields.';
const CLOSED = "Bond data is being quality-checked and isn&#39;t shown yet.";
const has = (h, t) => h.includes(t) || h.includes(t.replace(/'/g, '&#39;'));

// ================= §7.2 Bonds section =================
{
  const c = makeCtx();
  const s = await loadSection(c, 7);
  check('[T-F9 7.2] no bond link → section stays hidden, nothing rendered', s.style.display === 'none' && s.innerHTML === '', s);
}
{
  const c = makeCtx({ gate: 'closed' });
  const s = await loadSection(c, 1);
  check('[T-F9 7.2] gate closed + has_bond_link → only the quality-check notice and the disclosure', s.style.display === '' && has(s.innerHTML, "Bond data is being quality-checked and isn't shown yet.")
    && s.innerHTML.includes(DISCLOSURE) && !s.innerHTML.includes('fi-row') && !/CIK|0000000001|ISSUER A INC/.test(s.innerHTML), s.innerHTML);
  check('[T-F9 7.2] closed: the ladder is not requested data-wise (closed body) and no table', !s.innerHTML.includes('Maturity ladder'));
}
{
  const c = makeCtx();
  const s = await loadSection(c, 1);
  const h = s.innerHTML;
  check('[T-F9 7.2] open: header, freshness line, disclosure', h.includes('Bonds · ') && h.includes('SEC issuance data') && h.includes('Last checked with SEC 20 Oct 2026') && h.includes(DISCLOSURE), h);
  check('[T-F9 7.2] open: outstanding rows only (no 2019), maturity order', !h.includes('1 Jan 2019') && h.indexOf('1 Mar 2030') < h.indexOf('15 Jun 2034') && h.indexOf('15 Jun 2034') < h.indexOf('5 May 2045'), h);
  check('[T-F9 7.4] chips: "High · 95" and amber "Check source · 75"', h.includes('High · 95') && h.includes('Check source · 75'));
  check('[T-F9 7.4] floating with NULL spread → "SOFR · spread not parsed — see filing"', h.includes('SOFR · spread not parsed — see filing'));
  check('[T-F9 7.4] fixed → "5.850%" and "Fixed coupon"; never "fixed for life"', h.includes('5.850%') && h.includes('Fixed coupon') && !/fixed for life/i.test(h));
  check('[T-F9 7.4] NULL seniority → "Not parsed — see filing"; principal "$1,000,000,000", EUR "€750,000,000"', h.includes('Not parsed — see filing') && h.includes('$1,000,000,000') && h.includes('€750,000,000'));
  check('[T-F9 7.2] ladder: bars with "securities", reopened count, other currency, single-filing USD note', h.includes('Maturity ladder') && h.includes('1 reopened') && h.includes('EUR 1') && h.includes('(single-filing securities)'), h.slice(h.indexOf('Maturity ladder'), h.indexOf('Maturity ladder') + 1500));
  check('[T-F9 7.2] one CIK → no "Filed by" line', !h.includes('Filed by'));
  check('[T-F9 7.2] each row opens #/bond with from=entity:{id}:{page}', /data-bond="0000000001-26-000001\/1" data-page="1"/.test(h));
  // row click
  c.run(`_fiOpenBondRow({ dataset: { bond: '0000000001-26-000001/1', page: '1' }, closest: () => __section })`); await tick(); await tick();
  check('[T-F9 7.1] row click → bond layer pushed with #/bond/{acc}/{seq}?from=entity:1:1', c.run('_navStack.length') === 1 && c.run('_navStack[0].kind') === 'bond'
    && c.ctx.history.entries.at(-1) === '#/bond/0000000001-26-000001/1?from=entity%3A1%3A1', c.ctx.history.entries);
  // show matured
  c.run('_fiToggleMatured(__section)'); await tick(); await tick(); await tick();
  check('[T-F9 7.2] "Show matured" → include_matured=1, the 2019 tranche appears, ladder hidden, toggle reads "Hide matured"',
    c.calls.some(p => p.includes('include_matured=1')) && s.innerHTML.includes('1 Jan 2019') && !s.innerHTML.includes('Maturity ladder') && s.innerHTML.includes('Hide matured'), c.calls);
}
{
  const c = makeCtx();
  const s = await loadSection(c, 2);
  const rows1 = (s.innerHTML.match(/class="fi-row" role="link"/g) || []).length;
  check('[T-F9 7.2] 2 CIKs: 25 rows on page 1, "Show 25 more ↓", "Filed by" on rows', rows1 === 25 && s.innerHTML.includes('Show 25 more ↓') && s.innerHTML.includes('Filed by ISSUER B'), rows1);
  await c.run('_fiBondsLoadPage(__section, false)');
  const rows2 = (s.innerHTML.match(/class="fi-row" role="link"/g) || []).length;
  check('[T-F9 7.2] page 2 appended: 30 rows, no button left', rows2 === 30 && !s.innerHTML.includes('Show 25 more'), rows2);
  check('[T-F9 7.2] page-2 rows carry data-page="2"', s.innerHTML.includes('data-page="2"'));
}
{
  // short page with a cursor keeps the button (DIL N-2) — served by an override answer
  const c = makeCtx({ override: p => p.includes('/bonds') && !p.includes('cursor=') ? { ok: true, status: 200, data: { data_type: 'issuance_reference', gate: 'open', has_bond_link: true, ciks: [{ cik: '0000000001', issuer_name: 'X' }], bonds: [], next_cursor: 'abc', freshness: {} } } : null });
  const s = await loadSection(c, 1);
  check('[T-F9 DIL N-2] page with 0 rows but a next_cursor keeps "Show 25 more ↓" (no "No outstanding bonds")', s.innerHTML.includes('Show 25 more ↓') && !s.innerHTML.includes('No outstanding bonds'), s.innerHTML);
}
for (const [label, res] of [['500', { ok: false, status: 500, data: { error: 'Internal error' } }], ['network', { ok: false, status: 0, type: 'network_error', data: null }]]) {
  const c = makeCtx({ override: p => (p.includes('/api/fi/') ? res : null) });
  const s = await loadSection(c, 1);
  check(`[T-F9 7.5] section ${label} → "Couldn't reach Corporate Atlas." + Retry`, has(s.innerHTML, "Couldn't reach Corporate Atlas.") && s.innerHTML.includes('↻ Retry'), s.innerHTML);
}
{
  const c = makeCtx();
  const s = await loadSection(c, 3);
  check('[T-F9 7.5] 11 CIKs (422) → "Bond data unavailable for this issuer."', s.innerHTML.includes('Bond data unavailable for this issuer.'), s.innerHTML);
}
{
  const c = makeCtx({ override: p => (p.includes('/bonds') ? { ok: true, status: 200, data: { data_type: 'issuance_reference', gate: 'open', has_bond_link: true, ciks: [{ cik: '1' }], bonds: [], next_cursor: null, freshness: {} } } : null) });
  const s = await loadSection(c, 1);
  check('[T-F9 7.5] no outstanding bonds → copy + "Show matured"', s.innerHTML.includes('No outstanding bonds in Meridian Atlas for this issuer.') && s.innerHTML.includes('Show matured'), s.innerHTML);
}
{
  const c = makeCtx({ override: p => (p.includes('/bonds') ? { ok: true, status: 200, data: { data_type: 'issuance_reference', gate: 'open', has_bond_link: true, ciks: [], bonds: [], coverage: { available: false } } } : null) });
  const s = await loadSection(c, 1);
  check('[T-F9 7.5] tables missing → "Fixed Income data isn\'t available yet."', has(s.innerHTML, "Fixed Income data isn't available yet."), s.innerHTML);
}

// ================= §7.3 Bond detail =================
async function openBond(c, id) { await c.run(`_navOpen('bond', ${JSON.stringify(id)}, { history: 'push' })`); return c.run('_navStack[_navStack.length - 1].el.innerHTML'); }
{
  const c = makeCtx();
  let h = await openBond(c, '0000000001-26-000002/1');
  check('[T-F9 7.3] boilerplate label ("PROSPECTUS SUPPLEMENT Dated …") → generated title "5.850% Notes due 1 Mar 2030"', h.includes('5.850% Notes due 1 Mar 2030') && !h.includes('PROSPECTUS SUPPLEMENT Dated'), h.slice(0, 1200));
  check('[T-F9 7.3] reopening line "Also filed in 1 other filing."', h.includes('Also filed in 1 other filing.'));
  check('[T-F9 7.3] SEC link: new tab, rel="noopener noreferrer"', /href="https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1\/x\.htm" target="_blank" rel="noopener noreferrer"/.test(h));
  check('[T-F9 7.3 M-8] filer CIK = the bond\'s own CIK; linked candidate with its entity_master LEI; "Open issuer →"', h.includes('Filer · CIK 0000000001') && h.includes('LEI LEIAAAAAAAAAAAAAAA01') && h.includes('Open issuer →'), h);
  check('[T-F9 7.3] "View instrument" when instrument_key is set; disclosure shown', h.includes('View instrument') && h.includes(DISCLOSURE));
  h = await openBond(c, '0000000001-26-000001/1');
  check('[T-F9 7.3] clean label kept as the title', h.includes('>5.850% Notes due 2030<'), h.slice(0, 900));
  h = await openBond(c, '0000000001-26-000003/1');
  check('[T-F9 7.3] 60–79 → "Check the filing: some terms were parsed with lower confidence."', h.includes('Check the filing: some terms were parsed with lower confidence.') && h.includes('Check source · 75'));
  h = await openBond(c, '0001104659-24-022370/1');
  check('[T-F9 7.3 M-8] unmatched filer: "Issuer not linked to Corporate Atlas yet · … (CIK 0002007029)", link to #/fi/cik, NO LEI',
    h.includes('Issuer not linked to Corporate Atlas yet · PEPSICO SINGAPORE FINANCING I PTE LTD (CIK 0002007029)') && h.includes('#/fi/cik/0002007029') && !/LEI/.test(h), h);
  check('[T-F9 7.3] SGD principal shown with its currency code', h.includes('SGD 450,000,000'));
  check('[T-F9 7.3] no guarantor anywhere', !/guarant/i.test(h));
  h = await openBond(c, '0000000009-26-000001/1');
  check('[T-F9 7.5] absent bond → "This bond isn\'t available."', has(h, "This bond isn't available."), h);
  const cc = makeCtx({ gate: 'closed' });
  h = await openBond(cc, '0000000001-26-000001/1');
  check('[T-F9 7.5] detail, gate closed → notice + disclosure only', has(h, "Bond data is being quality-checked and isn't shown yet.") && h.includes(DISCLOSURE) && !h.includes('0000000001-26-000001<'), h);
  const co = makeCtx({ override: () => ({ ok: false, status: 503, data: null }) });
  h = await openBond(co, '0000000001-26-000001/1');
  check('[T-F9 7.5] detail 5xx → outage + Retry', has(h, "Couldn't reach Corporate Atlas.") && h.includes('_navRetry(1)'), h);
}

// ================= §7.6 Directory, §7.1 CIK layer =================
{
  const c = makeCtx();
  c.run('openFixedIncome()'); await tick(); await tick(); await tick();
  const h = c.run('_navStack[0].el.innerHTML');
  check('[T-F9 7.6] nav "Fixed Income" → #/fi layer', c.run('_navStack[0].kind') === 'fi' && c.ctx.history.entries.at(-1) === '#/fi', c.ctx.history.entries);
  check('[T-F9 7.6] header totals "{issuers} issuers · {finals} bonds · {unmatched} not linked yet"', /15 issuers · 36 bonds · 1 not linked yet/.test(h), h.slice(0, 1500));
  check('[T-F9 7.6] linked rows "Linked", PepsiCo "Not linked yet" opening #/fi/cik; CIK shown = bond_issuer_link.cik', h.includes('Linked') && h.includes('Not linked yet') && h.includes(`_navOpen('fi_cik', &quot;0002007029&quot;`) && h.includes('CIK 0000000001'), h.slice(0, 3000));
  check('[T-F9 7.6] disclosure + "Updated within the last hour" tooltip', h.includes(DISCLOSURE) && h.includes('Updated within the last hour'));
  c.run(`_fiFilterDirectory(1, 'pepsi')`);
  const f = c.run('_navStack[0].el.querySelector(".fi-dir-rows").innerHTML');
  check('[T-F9 7.6] client-side filter by name', f.includes('PEPSICO') && !f.includes('ISSUER A INC'), f.slice(0, 300));
  c.run(`_fiFilterDirectory(1, '0000000002')`);
  check('[T-F9 7.6] filter by CIK', c.run('_navStack[0].el.querySelector(".fi-dir-rows").innerHTML').includes('ISSUER B PLC'));
  // CIK layer from the directory, then Back closes exactly one layer
  await c.run(`_navOpen('fi_cik', '0002007029', { history: 'push' })`);
  const k = c.run('_navStack[1].el.innerHTML');
  check('[T-F9 7.1] CIK layer: filer name + CIK, "Issuer not linked to Corporate Atlas yet.", its bond row', k.includes('PEPSICO SINGAPORE FINANCING I PTE LTD') && k.includes('CIK 0002007029')
    && k.includes('Issuer not linked to Corporate Atlas yet.') && k.includes('data-bond="0001104659-24-022370/1"') && k.includes(DISCLOSURE), k);
  check('[T-F9 7.1] CIK layer hash #/fi/cik/{cik}', c.ctx.history.entries.at(-1) === '#/fi/cik/0002007029');
  c.listeners['ma:route']({ detail: { mode: 'pop', depth: 1 } });
  check('[T-F9 AC-F10] Back (popstate to depth 1) closes exactly one layer: the directory remains', c.run('_navStack.length') === 1 && c.run('_navStack[0].kind') === 'fi');
  const cc = makeCtx({ gate: 'closed' });
  cc.run('openFixedIncome()'); await tick(); await tick(); await tick();
  const hc = cc.run('_navStack[0].el.innerHTML');
  check('[T-F9 7.6] directory, gate closed → notice + disclosure, no issuer, no count', has(hc, "Bond data is being quality-checked and isn't shown yet.") && hc.includes(DISCLOSURE) && !/issuers ·|CIK \d/.test(hc), hc);
  await cc.run(`_navOpen('fi_cik', '0002007029', { history: 'push' })`);
  check('[T-F9 7.1] CIK layer, gate closed → notice only', has(cc.run('_navStack[1].el.innerHTML'), "Bond data is being quality-checked and isn't shown yet.") && !cc.run('_navStack[1].el.innerHTML').includes('PEPSICO'));
  const co = makeCtx({ override: () => ({ ok: false, status: 500, data: null }) });
  co.run('openFixedIncome()'); await tick(); await tick();
  check('[T-F9 7.5] directory 5xx → outage + Retry', has(co.run('_navStack[0].el.innerHTML'), "Couldn't reach Corporate Atlas.") && co.run('_navStack[0].el.innerHTML').includes('_navRetry(1)'));
}

// ================= M9-4: latest-filing label =================
{
  const c = makeCtx();
  const s = await loadSection(c, 1);
  check('[M9-4] Bonds section: "latest filing among the bonds shown" = max filing_date of the rows on screen (1 Feb 2026)',
    s.innerHTML.includes('latest filing among the bonds shown 1 Feb 2026'), s.innerHTML.slice(0, 900));
  check('[M9-4] no bare "· latest filing {date}" that reads as the issuer\'s latest filing', !/· latest filing (?!among the bonds shown)/.test(s.innerHTML));
  await c.run(`_navOpen('fi_cik', '0002007029', { history: 'push' })`);
  const k = c.run('_navStack[_navStack.length - 1].el.innerHTML');
  check('[M9-4] CIK layer uses the same label', k.includes('latest filing among the bonds shown 1 Mar 2024') && !/· latest filing (?!among the bonds shown)/.test(k), k.slice(0, 900));
  const e = makeCtx({ override: p => (p.includes('/bonds') ? { ok: true, status: 200, data: { data_type: 'issuance_reference', gate: 'open', has_bond_link: true, ciks: [{ cik: '1' }], bonds: [], next_cursor: 'x', freshness: { last_polled_at: '2026-10-20T00:00:00Z', latest_filing_date: '2026-09-01' } } } : null) });
  const se = await loadSection(e, 1);
  check('[M9-4] no rows on screen → no latest-filing figure at all (the per-response field is never shown)', !se.innerHTML.includes('latest filing') && !se.innerHTML.includes('1 Sept 2026') && !se.innerHTML.includes('1 Sep 2026'), se.innerHTML);
}

// ================= M9-3: ambiguous with fewer than 2 candidates (007 card) =================
{
  const cand = id => ({ entity_id: id, name: `ISSUER ${id}`, lei: null, source: 'sec_bond', source_table: 'bond_issuer_link', confidence: 95, confidence_band: 'high', redirect: null, as_of: null, also_sources: [] });
  const card = n => ({ instrument_key: 'CUSIP:222222BB2', identifiers: { isin: null, cusip: '222222BB2', ticker: null }, asset_type: null, name: null,
    state: 'ambiguous', reason: 'source_conflict', candidates: Array.from({ length: n }, (_, i) => cand(i + 1)), as_of: null, placeholder_key: false });
  for (const n of [0, 1, 2]) {
    const c = makeCtx({ override: p => (p.startsWith('/api/instruments/') ? { ok: true, status: 200, data: card(n) } : null) });
    await c.run(`_navOpen('instrument', 'CUSIP:222222BB2', { history: 'push' })`);
    const h = c.run('_navStack[0].el.innerHTML');
    if (n < 2) check(`[M9-3] ambiguous/source_conflict with ${n} candidate(s): "Our sources disagree about the issuer." without "Choose one" or a candidate count`,
      h.includes('Our sources disagree about the issuer.') && !h.includes('Choose one') && !h.includes('candidate issuers') && (n === 0 || h.includes('ISSUER 1')), h);
    else check('[M9-3] ambiguous with 2 candidates keeps "Choose one." and "2 candidate issuers — none is selected for you"', h.includes('Choose one.') && h.includes('2 candidate issuers — none is selected for you'), h);
  }
}

// ================= Router (index.html) and nav link =================
{
  const script = INDEX.match(/<script>\n\/\/ MA-OCT-007 hash router[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
  const rctx = { window: {}, document: { addEventListener() {}, dispatchEvent() {} }, location: { hash: '' }, history: {}, URLSearchParams, CustomEvent: class {}, setTimeout };
  rctx.window = rctx; rctx.addEventListener = () => {};
  vm.createContext(rctx); vm.runInContext(script, rctx);
  const P = h => JSON.stringify(rctx.maNavParse(h));
  check('[T-F9 7.1] router: #/fi', P('#/fi') === JSON.stringify({ type: 'fi', id: null, from: null }), P('#/fi'));
  check('[T-F9 7.1] router: #/fi/cik/{10 digits}', P('#/fi/cik/0002007029') === JSON.stringify({ type: 'fi_cik', id: '0002007029', from: null }));
  check('[T-F9 7.1] router: #/bond/{accession}/{seq}?from=', P('#/bond/0001104659-24-022370/1?from=entity%3A1457%3A1') === JSON.stringify({ type: 'bond', id: '0001104659-24-022370/1', from: 'entity:1457:1' }), P('#/bond/0001104659-24-022370/1?from=entity%3A1457%3A1'));
  for (const bad of ['#/fi/cik/123', '#/fi/cik/00020070299', '#/bond/0001104659-24-022370/0', '#/bond/123/1', '#/bond/0001104659-24-022370', '#/fi/x', '#/fis'])
    check(`[T-F9 7.1] router rejects ${bad}`, rctx.maNavParse(bad) === null, P(bad));
  check('[T-F9 7.1] router: 007 routes unchanged', P('#/entity/1457') === JSON.stringify({ type: 'entity', id: 1457, from: null }) && P('#/instrument/US5949181045') === JSON.stringify({ type: 'instrument', id: 'US5949181045', from: null }));
  check('[T-F9 Q1] one "Fixed Income" nav button calling openFixedIncome()', (INDEX.match(/onclick="openFixedIncome\(\)"[^>]*>Fixed Income<\/button>/g) || []).length === 1);
  check('[T-F9 375px] stacked-row media query present (max-width:640px → 2 columns, optional cells hidden)', /@media \(max-width:640px\)\{\.fi-row\{grid-template-columns:1fr 1fr\}/.test(SRC));
  const c = makeCtx();
  c.listeners['ma:route']({ detail: { type: 'bond', id: '0000000001-26-000001/1', from: null, mode: 'cold' } }); await tick(); await tick(); await tick();
  check('[T-F9 AC-F10] cold deep link #/bond/… → Home underneath (depth 0 replaced) + the bond layer', c.ctx.history.last === '/' && c.run('_navStack.length') === 1 && c.run('_navStack[0].kind') === 'bond');
}

console.log(`\nfi-010-frontend: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
