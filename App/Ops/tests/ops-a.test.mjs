#!/usr/bin/env node
// MA-OCT-OPS.A (Founder "Ops option A", ML-1031-4): all Ops views live behind the signed-in console.
//  1. The public terminal (App/index.html) has no anonymous Ops panel: it does not load ma-ops.js and never calls
//     openOps(); its OPS element is a link to GET /api/ops/admin/console on meridian-ops, in a new tab (noopener).
//  2. The console (the REAL App/ma-data.js + App/ma-ops.js in console mode, as the shell loads them) renders all seven
//     tabs — System Health, Cases, DQ Tickets, Drift & Budget, Events, Sprint Board, Release Ledger — and each tab
//     reads only its own route(s); Cases/DQ never poll; Health polls only while visible (M-2, M-3).
//  3. No new meridian-ops route: the console shell is unchanged and still loads exactly ma-data.js + ma-ops.js.
//  4. docs/ is the generated mirror: index.html, ma-ops.js, ma-data.js are byte-identical to App/.
// No network, no D1.   Usage: node App/Ops/tests/ops-a.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const APP = new URL('../../', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const read = (base, rel) => readFileSync(new URL(rel, base), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 600)}`); };
const CONSOLE = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/console';

// --- 1. the terminal ------------------------------------------------------------------------------------------------
const html = read(APP, 'index.html');
const ops = (/<([a-z]+)[^>]*\bid="opsBtn"[^>]*>/.exec(html) || [])[0] || '';
check('[OPS.A] terminal: the OPS element is a link to the console, new tab, rel=noopener', /^<a\b/.test(ops) && ops.includes(`href="${CONSOLE}"`)
  && /target="_blank"/.test(ops) && /rel="noopener"/.test(ops), ops);
check('[OPS.A] terminal: no openOps() call and no ma-ops.js script anywhere in index.html', !/openOps\s*\(/.test(html) && !/src="ma-ops\.js"/.test(html), null);
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const others = scripts.filter(s => /^ma-.*\.js$/.test(s) && existsSync(new URL(s, APP))).map(s => [s, read(APP, s)]);
check(`[OPS.A] terminal: none of its ${others.length} loaded scripts builds an Ops panel or calls openOps`, others.length >= 9
  && others.every(([, src]) => !/ops-panel|openOps\s*\(/.test(src)), others.filter(([, src]) => /ops-panel|openOps\s*\(/.test(src)).map(([f]) => f));
check('[OPS.A] the link looks like the other header tiles (a.btn rule)', /a\.btn\{display:inline-block;text-decoration:none\}/.test(html), null);

// --- 2. the console -----------------------------------------------------------------------------------------------------
function world() {
  const byId = new Map(), docL = {}, sent = [], intervals = new Map();
  let nextId = 1;
  const reg = e => { if (e.attrs.id) byId.set(e.attrs.id, e); e.children.forEach(reg); };
  function el(tag) {
    const e = { tagName: tag.toUpperCase(), attrs: {}, dataset: {}, style: {}, children: [], parent: null, _html: '', isConnected: false,
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
      get id() { return this.attrs.id; }, set id(v) { this.attrs.id = v; if (this.isConnected) byId.set(v, this); },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { this.children.push(c); c.parent = this; if (this.isConnected) { const m = x => { x.isConnected = true; x.children.forEach(m); }; m(c); reg(c); } return c; },
      insertBefore(c) { return this.appendChild(c); }, get firstChild() { return this.children[0] || null; },
      remove() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {} };
    return e;
  }
  const body = el('body'); body.isConnected = true;
  const doc = { hidden: false, body, createElement: el, getElementById: id => byId.get(id) || null, querySelector: () => null, querySelectorAll: () => [],
                addEventListener(t, f) { (docL[t] ||= []).push(f); } };
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  const ctx = {
    console: { ...console, error() {}, warn() {} }, setTimeout, clearTimeout, URLSearchParams, JSON, Promise, Error, TypeError, document: doc, MA_OPS_CONSOLE: true,
    crypto: { randomUUID, getRandomValues: a => webcrypto.getRandomValues(a) }, AbortSignal: { timeout: () => undefined },
    location: { origin: 'https://meridian-ops.navinmv1981.workers.dev', hash: '', reload() {} }, history: { pushState() {}, replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, open() { throw new Error('the console must not window.open'); },
    setInterval: (f, ms) => { const id = nextId++; intervals.set(id, ms); return id; }, clearInterval: id => intervals.delete(id), addEventListener() {},
    fetch: async (u, init = {}) => {
      const url = new URL(String(u)); sent.push({ host: url.host, path: url.pathname, method: init.method || 'GET' });
      const p = url.pathname;
      if (p === '/api/ops-health') return json({ pipeline: {}, coverage: {}, bootstrap: {}, enrichment: { enrichment_source: 'removed-ML-1025-3' } });
      if (p === '/api/ops/admin/exceptions' || p === '/api/ops/admin/dq-tickets') return json({ ok: true, items: [], next_cursor: null });
      if (p === '/api/ops/sprint-board' || p === '/api/ops/release-ledger') return json({ items: [] });
      if (p === '/api/ops/events') return json({ events: [] });
      if (p === '/api/ops/drift') return json({ drift: [], has_drift: false });
      if (p === '/api/ops/budget-risk') return json({ writes_today: 1, daily_limit: 100000, pct: 0 });
      if (p === '/api/ops/openfigi-status') return json({ coverage_pct: 1, instrument_entity_map_total: 1, instrument_master_total: 1, openfigicache_total: 1, openfigi_matched_no_entity: 0 });
      if (p === '/api/ops/cf/d1-today') return json({ rowsWritten: 1, daily_cap: 100000, pct_of_cap: 0, rowsRead: 1, writeQueries: 1, readQueries: 1 });
      if (p === '/api/ops/cf/invocations') return json({ cron_invocations: [], matches_cron_only: true, cron_invocation_count: 0, all_trigger_invocation_count: 0 });
      return json({ ok: false, error: 'not found' }, 404);
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['ma-data.js', 'ma-ops.js']) vm.runInContext(read(APP, f), ctx, { filename: f });
  return { run: c => vm.runInContext(c, ctx), sent, intervals };
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0)); };

const TABS = [['health', 'System Health'], ['cases', 'Cases'], ['dq', 'DQ Tickets'], ['drift', 'Drift & Budget'], ['events', 'Events'], ['sprint', 'Sprint Board'], ['release', 'Release Ledger']];
const w = world();
await w.run(`openOps({ console: true })`); await settle();
const bar = w.run(`document.getElementById('ops-tab-bar').innerHTML`);
const order = [...bar.matchAll(/data-ops-tab="([a-z]+)"/g)].map(m => m[1]);
check('[OPS.A] the console tab bar holds all seven views, in order', JSON.stringify(order) === JSON.stringify(TABS.map(t => t[0]))
  && TABS.every(([, label]) => bar.includes(`>${label.replace('&', '&amp;')}</button>`)), order);
check('[OPS.A] every view has its tab panel', TABS.every(([id]) => w.run(`!!document.getElementById('ops-tab-${id}')`)), null);
check('[OPS.A] the console opens on Cases: one E-1 read, no Health read, no poll', w.sent.length === 1 && w.sent[0].path === '/api/ops/admin/exceptions' && w.intervals.size === 0, w.sent);

const EXPECT = {
  health: ['/api/ops-health'], dq: ['/api/ops/admin/dq-tickets'], events: ['/api/ops/events'], sprint: ['/api/ops/sprint-board'], release: ['/api/ops/release-ledger'],
  drift: ['/api/ops/drift', '/api/ops/budget-risk', '/api/ops/openfigi-status', '/api/ops/cf/d1-today', '/api/ops/cf/invocations'], cases: ['/api/ops/admin/exceptions']
};
const per = {};
for (const [id] of TABS.slice(1).concat([TABS[0]])) {
  const before = w.sent.length;
  await w.run(`ops_switchTab('${id}')`); await settle();
  per[id] = [...new Set(w.sent.slice(before).map(s => s.path))].sort();
}
const bad = Object.entries(EXPECT).filter(([id, paths]) => JSON.stringify(per[id]) !== JSON.stringify([...paths].sort()));
check('[OPS.A] each of the seven views reads only its own route(s), all GET, all to meridian-ops / meridian-proxy (CSP connect-src)', bad.length === 0
  && w.sent.every(s => s.method === 'GET' && ['meridian-ops.navinmv1981.workers.dev', 'meridian-proxy.navinmv1981.workers.dev'].includes(s.host)), { bad, per });
const views = Object.fromEntries(TABS.map(([id]) => [id, w.run(`document.getElementById('ops-tab-${id}').innerHTML`)]));
check('[OPS.A] every view rendered content (no empty panel)', TABS.every(([id]) => views[id].length > 80), Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.length])));
check('[OPS.A] Sprint Board and Release Ledger stay read-only in the console', /Read-only\. Changes are made by the Main Lane\./.test(views.sprint) && /Read-only\. Changes are made by the Main Lane\./.test(views.release)
  && !/Change stage|Record event/.test(views.sprint + views.release), null);
check('[M-3] only Health polls (ends on Health: one 10-min interval)', w.intervals.size === 1 && [...w.intervals.values()][0] === 600000, [...w.intervals.values()]);

// --- 3. no new route; the shell is unchanged --------------------------------------------------------------------------
const shell = read(APP, 'Ops/src/console-page.js');
check('[OPS.A] the console shell is unchanged in role: it loads exactly ma-data.js then ma-ops.js from the Pages path and opens the console',
  /\$\{assetBase\}ma-data\.js[\s\S]*\$\{assetBase\}ma-ops\.js/.test(shell) && /openOps\(\{ console: true \}\)/.test(shell)
  && /CONSOLE_ASSET_BASE = 'https:\/\/navinmv81\.github\.io\/meridian-atlas\/'/.test(shell), null);

// --- 4. docs/ mirrors App/ ------------------------------------------------------------------------------------------------
const mirror = ['index.html', 'ma-ops.js', 'ma-data.js'].map(f => [f, existsSync(new URL(`docs/${f}`, ROOT)) && read(ROOT, `docs/${f}`) === read(APP, f)]);
check('[OPS.A] docs/ (the Pages source) is byte-identical to App/ for index.html, ma-ops.js, ma-data.js', mirror.every(([, ok]) => ok), mirror);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
