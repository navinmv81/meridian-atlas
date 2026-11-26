#!/usr/bin/env node
// MA-OCT-OPS.A (Founder "Ops option A", ML-1031-4) + MA-NOV-UI.OPS.BUILD (spec MA-NOV-UI §1, tests §5.1 O-1–O-10).
//  1. The public terminal (App/index.html) has no anonymous Ops panel: it does not load ma-ops.js and never calls
//     openOps(); its OPS element is a link to GET /api/ops/admin/console on meridian-ops, in a new tab (noopener).
//  2. The console (the REAL App/ma-data.js + App/ma-ops.js in console mode, as the shell loads them) renders exactly
//     four tabs — System Health, Cases, DQ Tickets, Drift & Budget — opens on Cases, and each tab reads only its own
//     route(s). Events, Sprint Board and Release Ledger are gone from the front end (OPS-01); their routes are never
//     requested. Keyboard, Health poll, states (§1.6), tokens (§1.5), token sync with index.html, escaping.
//  3. No new meridian-ops route: the console shell is unchanged and still loads exactly ma-data.js + ma-ops.js.
//  4. The preview harness (App/Ops/tests/preview/) exists, uses fixtures only, and never reaches docs/.
// No network, no D1.   Usage: node App/Ops/tests/ops-a.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const APP = new URL('../../', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const read = (base, rel) => readFileSync(new URL(rel, base), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 600)}`); };
const info = (name, v) => console.log(`INFO  ${name}: ${JSON.stringify(v)}`);
const CONSOLE = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/console';
const OPS_SRC = read(APP, 'ma-ops.js');

// --- 1. the terminal ------------------------------------------------------------------------------------------------
const html = read(APP, 'index.html');
const ops = (/<([a-z]+)[^>]*\bid="opsBtn"[^>]*>/.exec(html) || [])[0] || '';
check('[OPS.A] terminal: the OPS element is a link to the console, new tab, rel=noopener', /^<a\b/.test(ops) && ops.includes(`href="${CONSOLE}"`)
  && /target="_blank"/.test(ops) && /rel="noopener"/.test(ops), ops);
check('[OPS.A] terminal: no openOps() call and no ma-ops.js script anywhere in index.html', !/openOps\s*\(/.test(html) && !/src="ma-ops\.js(\?[^"]*)?"/.test(html), null);
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].split("?")[0]);
const others = scripts.filter(s => /^ma-.*\.js$/.test(s) && existsSync(new URL(s, APP))).map(s => [s, read(APP, s)]);
check(`[OPS.A] terminal: none of its ${others.length} loaded scripts builds an Ops panel or calls openOps`, others.length >= 9
  && others.every(([, src]) => !/ops-panel|openOps\s*\(/.test(src)), others.filter(([, src]) => /ops-panel|openOps\s*\(/.test(src)).map(([f]) => f));
check('[OPS.A] the link looks like the other header tiles (a.btn rule)', /a\.btn\{display:inline-block;text-decoration:none\}/.test(html), null);

// --- 2. the console -----------------------------------------------------------------------------------------------------
const NOW = Date.now();
const CASES = [
  { case_ref: 'EXC-S-0000000000A1', severity: 'sev1', exception_type: 'job_missed', title: '<script>alert(1)</script>', job_id: 'holdings', opened_at: new Date(NOW - 3600e3).toISOString(), owner_role: 'Operations Lead', status: 'open', overdue: true },
  { case_ref: 'EXC-S-0000000000A2', severity: 'sev3', exception_type: 'budget_risk', title: 'D1 writes at 82%', job_id: null, opened_at: new Date(NOW - 7200e3).toISOString(), owner_role: null, status: 'acknowledged' }
];
const DETAIL = ref => ({ case: { ...CASES.find(c => c.case_ref === ref), summary: '<img src=x onerror=alert(2)>', raised_by: 'service:sweep', raised_via: 'sweep' },
  events: [{ event_type: 'raised', actor: 'service:sweep', occurred_at: new Date(NOW - 3600e3).toISOString() }], registry: null, runs: [], linked_dq_tickets: [] });

// faults: { [pathPrefix]: 'empty' | 'offline' | 'signed_out' | <http status> }
function world(faults = {}) {
  const byId = new Map(), docL = {}, sent = [], intervals = new Map();
  let nextId = 1;
  const reg = e => { if (e.attrs.id) byId.set(e.attrs.id, e); e.children.forEach(reg); };
  function el(tag) {
    const e = { tagName: tag.toUpperCase(), attrs: {}, dataset: {}, style: {}, children: [], parent: null, _html: '', isConnected: false, listeners: {}, hidden: false,
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
      get id() { return this.attrs.id; }, set id(v) { this.attrs.id = v; if (this.isConnected) byId.set(v, this); },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { this.children.push(c); c.parent = this; if (this.isConnected) { const m = x => { x.isConnected = true; x.children.forEach(m); }; m(c); reg(c); } return c; },
      insertBefore(c) { return this.appendChild(c); }, get firstChild() { return this.children[0] || null; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); byId.delete(this.attrs.id); },
      addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, querySelector() { return null; }, querySelectorAll() { return []; }, focus() { doc.activeElement = this; } };
    return e;
  }
  const body = el('body'); body.isConnected = true;
  const doc = { hidden: false, body, activeElement: null, createElement: el, getElementById: id => byId.get(id) || null, querySelector: () => null, querySelectorAll: () => [],
                addEventListener(t, f) { (docL[t] ||= []).push(f); } };
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  const ctx = {
    console: { ...console, error() {}, warn() {} }, setTimeout, clearTimeout, URLSearchParams, JSON, Promise, Error, TypeError, document: doc, MA_OPS_CONSOLE: true,
    crypto: { randomUUID, getRandomValues: a => webcrypto.getRandomValues(a) }, AbortSignal: { timeout: () => undefined },
    location: { origin: 'https://meridian-ops.navinmv1981.workers.dev', hash: '', reload() {} }, history: { pushState() {}, replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, open() { throw new Error('the console must not window.open'); },
    setInterval: (f, ms) => { const id = nextId++; intervals.set(id, ms); return id; }, clearInterval: id => intervals.delete(id), addEventListener() {},
    fetch: async (u, init = {}) => {
      const url = new URL(String(u)); sent.push({ host: url.host, path: url.pathname, search: url.search, method: init.method || 'GET' });
      const p = url.pathname;
      const fault = Object.entries(faults).find(([k]) => p.startsWith(k));
      const isList = p === '/api/ops/admin/exceptions' || p === '/api/ops/admin/dq-tickets';
      if (fault) {
        const f = fault[1];
        if (f === 'offline') throw new TypeError('Failed to fetch');
        if (f === 'signed_out') return new Response('', { status: 401 });
        if (f === 'empty' && isList) return json({ ok: true, items: [], next_cursor: null });
        if (typeof f === 'number') return json({ ok: false, error: 'boom' }, f);
      }
      if (p === '/api/ops-health') return json({ pipeline: { offset: 71, total: 237, writes_today: 12000, writes_limit: 100000, writes_guard: 80000 }, coverage: { null_depth: 3, depth_1: 40, depth_2_plus: 190, total_deep: 233 }, bootstrap: { current_cik: 1000, discovery_threshold: 2000 }, enrichment: { enrichment_source: 'removed-ML-1025-3' } });
      if (p === '/api/ops/admin/exceptions') return json({ ok: true, items: CASES, next_cursor: null });
      if (p === '/api/ops/admin/dq-tickets') return json({ ok: true, items: [], next_cursor: null });
      if (p.startsWith('/api/ops/admin/cases/')) return json(DETAIL(decodeURIComponent(p.split('/')[5])));
      if (p === '/api/ops/sprint-board' || p === '/api/ops/release-ledger') return json({ items: [] });
      if (p === '/api/ops/events') return json({ events: [] });
      if (p === '/api/ops/drift') return json({ drift: [], has_drift: false });
      if (p === '/api/ops/budget-risk') return json({ writes_today: 1, daily_limit: 100000, pct: 0 });
      if (p === '/api/ops/openfigi-status') return json({ coverage_pct: 1, instrument_entity_map_total: 1, instrument_master_total: 1, openfigicache_total: 1, openfigi_matched_no_entity: 0 });
      if (p === '/api/ops/cf/d1-today') return json({ rowsWritten: 1234, daily_cap: 100000, pct_of_cap: 1.2, rowsRead: 1, writeQueries: 1, readQueries: 1 });
      if (p === '/api/ops/cf/invocations') return json({ cron_invocations: [], matches_cron_only: true, cron_invocation_count: 0, all_trigger_invocation_count: 0 });
      return json({ ok: false, error: 'not found' }, 404);
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['ma-data.js', 'ma-ops.js']) vm.runInContext(read(APP, f), ctx, { filename: f });
  const run = c => vm.runInContext(c, ctx);
  const inner = id => run(`(document.getElementById('${id}') || { innerHTML: '' }).innerHTML`);
  return { run, inner, sent, intervals, doc, byId };
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0)); };
const text = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const selected = barHtml => [...barHtml.matchAll(/data-ops-tab="([a-z]+)"/g)].map(m => m[1]).filter(id => new RegExp(`id="ops-tabbtn-${id}"[^>]*aria-selected="true"[^>]*tabindex="0"`).test(barHtml));

const TABS = [['health', 'System Health'], ['cases', 'Cases'], ['dq', 'DQ Tickets'], ['drift', 'Drift & Budget']];
const w = world();
await w.run(`openOps({ console: true })`); await settle();
const bar = w.inner('ops-tab-bar');
const order = [...bar.matchAll(/data-ops-tab="([a-z]+)"/g)].map(m => m[1]);
check('[O-1] the console tab bar holds exactly health, cases, dq, drift, in order, with their labels; Cases selected on open (aria-selected, tabindex 0)',
  JSON.stringify(order) === JSON.stringify(TABS.map(t => t[0])) && TABS.every(([, label]) => bar.includes(`>${label.replace('&', '&amp;')}</button>`))
  && JSON.stringify(selected(bar)) === '["cases"]' && (bar.match(/tabindex="-1"/g) || []).length === 3, { order, sel: selected(bar) });
check('[O-2] four #ops-tab-* panels (role tabpanel); none for events, sprint or release; only Cases visible',
  TABS.every(([id]) => w.run(`document.getElementById('ops-tab-${id}').getAttribute('role')`) === 'tabpanel')
  && ['events', 'sprint', 'release'].every(id => w.run(`document.getElementById('ops-tab-${id}')`) === null)
  && TABS.every(([id]) => w.run(`document.getElementById('ops-tab-${id}').hidden`) === (id !== 'cases')), null);
check('[OPS.A] the console opens on Cases: one E-1 read, no Health read, no poll', w.sent.length === 1 && w.sent[0].path === '/api/ops/admin/exceptions' && w.intervals.size === 0, w.sent);

const EXPECT = { health: ['/api/ops-health'], dq: ['/api/ops/admin/dq-tickets'], cases: ['/api/ops/admin/exceptions'],
  drift: ['/api/ops/budget-risk', '/api/ops/openfigi-status', '/api/ops/cf/d1-today', '/api/ops/cf/invocations', '/api/ops/cf/invocations', '/api/ops/cf/invocations'] };
const per = {};
for (const id of ['dq', 'drift', 'cases', 'health']) {
  const before = w.sent.length;
  await w.run(`ops_switchTab('${id}')`); await settle();
  per[id] = w.sent.slice(before).map(s => s.path).sort();
}
const bad = Object.entries(EXPECT).filter(([id, paths]) => JSON.stringify(per[id]) !== JSON.stringify([...paths].sort()));
const FORBIDDEN = ['/api/ops/sprint-board', '/api/ops/release-ledger', '/api/ops/events', '/api/ops/drift'];
const scripts3 = w.sent.filter(s => s.path === '/api/ops/cf/invocations').map(s => new URLSearchParams(s.search).get('script')).sort();
check('[O-3] opening every tab requests none of sprint-board, release-ledger, events, drift; Drift & Budget reads exactly budget-risk, openfigi-status, cf/d1-today and cf/invocations ×3',
  bad.length === 0 && !w.sent.some(s => FORBIDDEN.includes(s.path))
  && JSON.stringify(scripts3) === JSON.stringify(['meridian-entities-enrich', 'meridian-entities-seed', 'meridian-holdings']), { bad, per, scripts3 });
check('[O-3] every request is a GET to meridian-ops / meridian-proxy (CSP connect-src)', w.sent.every(s => s.method === 'GET'
  && ['meridian-ops.navinmv1981.workers.dev', 'meridian-proxy.navinmv1981.workers.dev'].includes(s.host)), w.sent);
check('[O-3] the removed loaders and renderers are gone from ma-ops.js (no Events/Sprint/Release code path left)',
  !/ops_load(SprintBoard|ReleaseLedger|EventTimeline)|ops_render(SprintBoard|ReleaseLedger|EventTimeline|DriftPanel)|OPS_STAGE_COLORS|OPS_READ_ONLY_NOTE|Deployment Drift|'\/api\/ops\/(sprint-board|release-ledger|events|drift)'/.test(OPS_SRC), null);

// O-4 keyboard: through the tab bar's own delegated keydown listener.
{
  const k = world();
  await k.run(`openOps({ console: true })`); await settle();
  const barEl = k.run(`document.getElementById('ops-tab-bar')`);
  const fire = (from, key) => { let prevented = false; barEl.listeners.keydown.forEach(f => f({ key, target: { closest: () => ({ dataset: { opsTab: from } }) }, preventDefault() { prevented = true; } })); return prevented; };
  const steps = [['drift', 'ArrowRight', 'health'], ['health', 'ArrowLeft', 'drift'], ['cases', 'ArrowRight', 'dq'], ['dq', 'Home', 'health'], ['health', 'End', 'drift']];
  const got = [];
  for (const [from, key, want] of steps) {
    const prevented = fire(from, key); await settle();
    got.push({ from, key, want, active: selected(k.inner('ops-tab-bar')), focused: k.doc.activeElement && k.doc.activeElement.attrs && k.doc.activeElement.attrs.id, prevented,
      shown: TABS.filter(([id]) => !k.run(`document.getElementById('ops-tab-${id}').hidden`)).map(t => t[0]) });
  }
  const ok = got.every(g => JSON.stringify(g.active) === JSON.stringify([g.want]) && JSON.stringify(g.shown) === JSON.stringify([g.want]) && g.prevented);
  check('[O-4] ArrowRight from Drift & Budget wraps to System Health; ArrowLeft back; Home/End go to Health/Drift; aria-selected, tabindex and the visible panel follow',
    ok && barEl.listeners.click && barEl.listeners.click.length === 1, got);
  const other = fire('cases', 'a');
  check('[O-4] other keys are left alone', other === false, null);
}

// O-5 Health
{
  const h = world();
  await h.run(`openOps({ console: true })`); await settle();
  await h.run(`ops_switchTab('health')`); await settle();
  const ht = h.inner('ops-tab-health');
  check('[O-5] Health: one ops-health read and one 10-min poll, only on Health', h.sent.filter(s => s.path === '/api/ops-health').length === 1
    && [...h.intervals.values()].join() === '600000', { sent: h.sent.map(s => s.path), iv: [...h.intervals.values()] });
  await h.run(`ops_switchTab('drift')`); await settle();
  check('[O-5] leaving Health stops the poll; no further ops-health read', h.intervals.size === 0 && h.sent.filter(s => s.path === '/api/ops-health').length === 1, null);
  check('[O-5] no "CHECK_DASHBOARD", no Worker Status table, no OPS_WORKERS; the sweep pointer and the reads pointer are shown',
    !/CHECK_DASHBOARD/.test(OPS_SRC) && !/Worker Status|OPS_WORKERS/.test(OPS_SRC) && !/<table/.test(ht)
    && text(ht).includes('Job schedules and missed runs are checked by the Ops sweep; problems appear in Cases.')
    && text(ht).includes('Reads today: see Drift & Budget → Cloudflare usage today.')
    && /Enrichment counts removed \(ML-1025-3\)/.test(ht) && !/MERIDIAN ATLAS — OPS/.test(OPS_SRC), text(ht).slice(0, 400));
  const tb = h.run(`document.getElementById('ops-panel').children[1].children[0].innerHTML`);
  check('[§1.4/§1.5] the console title bar sits above the tabs on every tab: "Meridian Atlas" / "Operator console"', /ops-logo-name"><span>Meridian<\/span> Atlas</.test(tb) && /ops-logo-sub">Operator console</.test(tb), text(tb));
}

// O-6 Cases / DQ: the existing suite, unchanged in its AC/§5.x checks
{
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./ops-console.test.mjs', import.meta.url))], { encoding: 'utf8' });
  const tail = (r.stdout || '').trim().split('\n').slice(-2).join(' ');
  check(`[O-6] ops-console.test.mjs passes (${tail})`, r.status === 0 && /ALL PASSED/.test(r.stdout), (r.stdout || '').split('\n').filter(l => l.startsWith('FAIL')));
}

// O-7 tokens (static)
const THEME_M = /const OPS_THEME_CSS = `([\s\S]*?)`;/.exec(OPS_SRC);
const THEME = THEME_M ? THEME_M[1] : '';
const OUTSIDE = THEME_M ? OPS_SRC.replace(THEME_M[0], '') : OPS_SRC;
{
  const hex = OUTSIDE.match(/#[0-9a-f]{3,8}\b/gi) || [];
  const rgba = OUTSIDE.match(/rgba\(/g) || [];
  const styles = (OPS_SRC.match(/style=/g) || []).length;
  check(`[O-7] no hex colour and no rgba( outside the ops-theme block; OPS_COLORS absent; style= count ${styles} ≤ 30`, THEME.length > 1000 && hex.length === 0 && rgba.length === 0
    && !/OPS_COLORS/.test(OPS_SRC) && styles <= 30, { hex, rgba: rgba.length, styles });
  const inline = [...OPS_SRC.matchAll(/style="([^"]*)"/g)].map(m => m[1]);
  check('[O-7] every remaining style= is dynamic geometry (width %), never a colour', inline.every(s => /^width:\$\{[^}]+\}%$/.test(s.replace(/\.toFixed\(1\)/, ''))), inline);
  check('[O-7] no colour set through element.style or cssText', !/\.style\.(color|background|border|cssText)|cssText/.test(OPS_SRC), null);
  check('[§1.5] one <style id="ops-theme"> is injected; the font stack falls back to the system UI font (UD-5); focus ring rule as EXP',
    /style\.id = 'ops-theme'/.test(OPS_SRC) && /font-family:'Inter',system-ui,-apple-system,sans-serif/.test(THEME)
    && /:focus-visible\{outline:2px solid var\(--blue\);outline-offset:1px\}/.test(THEME), null);
  const t = world();
  await t.run(`openOps({ console: true })`); await settle();
  check('[§1.5] in the console the theme element exists once with the CSS', t.run(`document.getElementById('ops-theme').textContent`) === THEME, null);
  check('[§1.7] ≤ 640px: sub-line hidden, tab bar one scrolling row (nowrap, overflow-x auto, scroll-snap), tables in overflow-x wrappers, gauges/trio stack, 32px buttons',
    /@media \(max-width:640px\)\{[\s\S]*\.ops-logo-sub\{display:none\}[\s\S]*\.ops-grid,\.ops-trio\{grid-template-columns:minmax\(0,1fr\)\}[\s\S]*\.ops-btn\{min-height:32px\}/.test(THEME)
    && /\.ops-tabs\{display:flex;flex-wrap:nowrap;[^}]*overflow-x:auto;[^}]*scroll-snap-type:x proximity/.test(THEME)
    && /\.ops-tbl-wrap\{overflow-x:auto/.test(THEME) && /overflow-x:hidden/.test(THEME)
    && (OPS_SRC.match(/<table class="ops-tbl/g) || []).length === (OPS_SRC.match(/<div class="ops-tbl-wrap"><table class="ops-tbl|<div class="ops-tbl-wrap">\s*<table class="ops-tbl/g) || []).length, null);
}

// O-8 states (§1.6), exact texts
{
  const s = {};
  const load = async (faults, tab, prep) => { const x = world(faults); await x.run(`openOps({ console: true })`); await settle(); if (prep) await x.run(prep); if (tab) { await x.run(`ops_switchTab('${tab}')`); await settle(); } return x; };
  let x = await load({ '/api/ops/admin/exceptions': 'empty' });
  s.casesEmptyDefault = text(x.inner('ops-tab-cases'));
  await x.run(`opscState.EXC.statuses = ['resolved']; opsc_loadList('EXC', false)`); await settle();
  s.casesEmptyOther = text(x.inner('ops-tab-cases'));
  x = await load({}, 'dq'); s.dqEmpty = text(x.inner('ops-tab-dq'));
  x = await load({ '/api/ops/admin/exceptions': 500 }); s.cases500 = x.inner('ops-tab-cases');
  x = await load({ '/api/ops/admin/exceptions': 'signed_out' }); s.casesSignedOut = x.inner('ops-tab-cases');
  x = await load({ '/api/ops/admin/exceptions': 'offline' }); s.casesOffline = x.inner('ops-tab-cases');
  x = await load({ '/api/ops-health': 500 }, 'health'); s.health500 = x.inner('ops-tab-health');
  x = await load({ '/api/ops-health': 'offline' }, 'health'); s.healthOffline = x.inner('ops-tab-health');
  x = await load({ '/api/ops/budget-risk': 500, '/api/ops/cf': 500, '/api/ops/openfigi-status': 'offline' }, 'drift'); s.driftFail = x.inner('ops-tab-drift');
  x = await load({ '/api/ops/cf/d1-today': 500 }, 'drift'); s.driftPartial = x.inner('ops-tab-drift');
  check('[O-8] Cases empty: "No open cases. The last sweep raised nothing new." on the open filter; "No cases with these statuses." on any other',
    s.casesEmptyDefault.includes('No open cases. The last sweep raised nothing new.') && s.casesEmptyOther.includes('No cases with these statuses.')
    && !s.casesEmptyOther.includes('No open cases'), s);
  check('[O-8] DQ empty: "No tickets with these statuses."', s.dqEmpty.includes('No tickets with these statuses.'), s.dqEmpty);
  const alertRow = (h, t) => /<div class="ops-state error" role="alert">/.test(h) && text(h).includes(t) && !/No open cases/.test(h);
  check('[O-8] Cases errors render as a role="alert" row (red on red-bg), the opsc_mapResponse texts: 500, signed out, offline',
    alertRow(s.cases500, 'Ops is unavailable (HTTP 500). Nothing was changed unless the list shows it; Refresh.')
    && alertRow(s.casesSignedOut, 'Your sign-in has expired. Sign in again — what you typed is kept.')
    && alertRow(s.casesOffline, "Couldn't reach Ops. Retry sends the same request."), { a: text(s.cases500), b: text(s.casesSignedOut), c: text(s.casesOffline) });
  check('[O-8] Health error: "Couldn\'t load system health (HTTP 500)." / "(network error)." with a "Try again" button',
    text(s.health500).includes("Couldn't load system health (HTTP 500).") && text(s.healthOffline).includes("Couldn't load system health (network error).")
    && /data-ops-retry="health"[^>]*>Try again<\/button>/.test(s.health500) && /role="alert"/.test(s.health500), { a: text(s.health500), b: text(s.healthOffline) });
  const df = text(s.driftFail);
  check('[O-8] Drift & Budget: each panel fails alone with its exact line',
    df.includes("Couldn't load the write budget.") && df.includes("Couldn't load Cloudflare usage. If this keeps happening, check the CF_ANALYTICS_TOKEN secret on meridian-ops.")
    && ['meridian-holdings', 'meridian-entities-seed', 'meridian-entities-enrich'].every(sc => df.includes(`Couldn't load ${sc}.`))
    && df.includes("Couldn't load instrument → entity resolution."), df);
  const dp = text(s.driftPartial);
  check('[O-8] a failing Cloudflare D1 read leaves the other panels rendered (budget, invocations, resolution)',
    dp.includes("Couldn't load Cloudflare usage.") && dp.includes('1 of 100,000 (0%)') && dp.includes('meridian-holdings — 0 invocation(s) today') && dp.includes('Coverage (1 / 1)')
    && !dp.includes("Couldn't load the write budget."), dp);
  const okd = await load({}, 'drift');
  const od = text(okd.inner('ops-tab-drift'));
  check('[§1.3] Drift & Budget order: write budget → Cloudflare usage today → instrument → entity resolution; reworded CF line',
    od.indexOf('Shared D1 Write Budget Today') < od.indexOf('Cloudflare usage today') && od.indexOf('Cloudflare usage today') < od.indexOf('Instrument → Entity Resolution')
    && od.includes('1,234 of 100,000 rows written today (1.2%), as metered by Cloudflare for the whole account') && !/Live Cloudflare Metrics|MA-AUG-006\)/.test(od), od);
  // Loading: synchronously after the switch, before any response.
  const l = world();
  await l.run(`openOps({ console: true })`); await settle();
  l.run(`ops_switchTab('drift')`);
  const lh = l.inner('ops-tab-drift'), busy = l.run(`document.getElementById('ops-tab-drift').getAttribute('aria-busy')`);
  await settle();
  check('[O-8] Loading: "Loading…" with the spinner, container aria-busy="true" → "false" when done', /class="ops-spin"/.test(lh) && text(lh).includes('Loading…') && busy === 'true'
    && l.run(`document.getElementById('ops-tab-drift').getAttribute('aria-busy')`) === 'false', { lh, busy });
  // Selected: the row whose drawer is open.
  await l.run(`ops_switchTab('cases')`); await settle();
  await l.run(`opsc_openDrawer('EXC-S-0000000000A2', null)`); await settle();
  await l.run(`opsc_loadList('EXC', false)`); await settle();
  const sel = l.inner('ops-tab-cases');
  check('[O-8] Selected: the row whose drawer is open carries aria-current="true" (styled --bg4 + 2px --blue left edge); only that row',
    /data-opsc-open="EXC-S-0000000000A2"[^>]*aria-current="true"/.test(sel) && (sel.match(/aria-current="true"/g) || []).length === 1
    && /tr\[aria-current="true"\] td\{background:var\(--bg4\)\}/.test(THEME) && /inset 2px 0 0 var\(--blue\)/.test(THEME), null);
  await l.run(`opsc_closeDrawer()`); await l.run(`opsc_loadList('EXC', false)`); await settle();
  check('[O-8] closing the drawer clears the selection', !/aria-current="true"/.test(l.inner('ops-tab-cases')), null);
}

// O-9 token sync with App/index.html :root
{
  const tokens = css => Object.fromEntries([...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map(m => [m[1], m[2].trim().replace(/\s+/g, ' ')]));
  const rootOf = css => (/:root\s*\{([^}]*)\}/.exec(css) || [])[1] || '';
  const want = tokens(rootOf(html)), got = tokens(rootOf(THEME));
  const diff = [...new Set([...Object.keys(want), ...Object.keys(got)])].filter(k => want[k] !== got[k]).map(k => ({ k, index: want[k], ops: got[k] }));
  check(`[O-9] every --token in ops-theme equals App/index.html :root (${Object.keys(got).length} tokens), and the block says "keep in step"`,
    Object.keys(want).length >= 30 && diff.length === 0 && /Copied from App\/index\.html :root — keep in step/.test(THEME), diff);
}

// O-10 escaping
{
  const e = world();
  await e.run(`openOps({ console: true })`); await settle();
  const list = e.inner('ops-tab-cases');
  await e.run(`opsc_openDrawer('EXC-S-0000000000A1', null)`); await settle();
  const dr = e.inner('opsc-drawer');
  check('[O-10] a <script> title renders as text in the list and the drawer; the drawer summary <img onerror> is inert',
    list.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !/<script>/i.test(list) && dr.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !/<script>/i.test(dr)
    && dr.includes('&lt;img src=x onerror=alert(2)&gt;') && !/<img /.test(dr), null);
  check('[O-10] the drawer is styled by class (ops-drawer), not inline', e.run(`document.getElementById('opsc-drawer').className`) === 'ops-drawer', null);
}

// --- 3. no new route; the shell is unchanged --------------------------------------------------------------------------
const shell = read(APP, 'Ops/src/console-page.js');
check('[OPS.A] the console shell is unchanged in role: it loads exactly ma-data.js then ma-ops.js from the Pages path and opens the console',
  /\$\{assetBase\}ma-data\.js[\s\S]*\$\{assetBase\}ma-ops\.js/.test(shell) && /openOps\(\{ console: true \}\)/.test(shell)
  && /CONSOLE_ASSET_BASE = 'https:\/\/navinmv81\.github\.io\/meridian-atlas\/'/.test(shell) && /style-src 'unsafe-inline'/.test(shell), null);

// --- 4. preview harness; docs/ ---------------------------------------------------------------------------------------------
{
  const P = new URL('Ops/tests/preview/', APP);
  const ok = existsSync(new URL('console-preview.html', P)) && existsSync(new URL('fixtures.js', P));
  const ph = ok ? read(P, 'console-preview.html') : '', fx = ok ? read(P, 'fixtures.js') : '';
  const srcs = [...ph.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  check('[§1.9] preview harness: sets MA_OPS_CONSOLE, loads fixtures.js then ../../../ma-data.js and ../../../ma-ops.js, opens the console',
    ok && /window\.MA_OPS_CONSOLE = true/.test(ph) && srcs.join() === 'fixtures.js,../../../ma-data.js,../../../ma-ops.js' && /openOps\(\{ console: true \}\)/.test(ph), srcs);
  check('[§1.9] fixtures.js replaces fetch and never calls the real one (no requests to live Ops endpoints)',
    /window\.fetch = /.test(fx) && !/\b(realFetch|origFetch|nativeFetch)\b/.test(fx) && !/https?:\/\//.test(fx.replace(/\/\/.*$/gm, '')), null);
  const gen = read(ROOT, 'generate-docs.mjs');
  check('[§1.9] generate-docs.mjs copies named files only; the harness never reaches docs/', !/preview|tests\//.test(gen) && !existsSync(new URL('docs/console-preview.html', ROOT)), null);
}
// docs/ is the Pages mirror (MA-NOV-REL.GO M-2): a hard check — all 11 front-end files byte-identical to App/, plus docs/.nojekyll.
{
  const MIRROR = ['index.html', 'ma-etf.js', 'ma-entities.js', 'ma-13f.js', 'ma-research.js', 'ma-ops.js', 'ma-modal.js', 'ma-dcf.js', 'ma-market.js', 'ma-data.js', 'ma-search.js'];
  const differs = MIRROR.filter(f => !existsSync(new URL(`docs/${f}`, ROOT)) || !readFileSync(new URL(`docs/${f}`, ROOT)).equals(readFileSync(new URL(f, APP))));
  check('[REL.GO M-2] docs/ mirror: the 11 front-end files are byte-identical to App/ and docs/.nojekyll exists',
    differs.length === 0 && existsSync(new URL('docs/.nojekyll', ROOT)), differs.length ? differs : null);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
