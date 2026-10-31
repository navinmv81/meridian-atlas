#!/usr/bin/env node
// MA-OCT-005 test 1 (spec rev 0 §10.1–§10.2; Ops review M-2…M-5): the operator console front end.
// Loads the REAL App/ma-data.js and App/ma-ops.js in a vm context with a small DOM stub. Every fetch the
// console makes is answered by the REAL meridian-ops Worker (App/Ops/src/ops-api.js + cases.js) on an
// in-memory node:sqlite D1 built from migrations 002–005, the legacy 015b/015c rows, 003 M1/M2 and the 004
// seed batches (M3a, M3, M3c, M4) — the "local D1" of Task item 3. Access is real: RS256 JWTs signed here.
// Covers request building (headers, a fresh request_id, the same one on retry, expected_status, actor_role),
// legal actions, the Fixed gate, protected reopen, member edits (expected_member_status), every response-map
// row, escaping, unknown codes, keyset Load more, the terminal fallback (OPS.A), the Health poll rules (M-2, M-3), the
// enrichment wording, Board/Ledger read-only, and the AC-12 static checks.
// No network, no remote D1.   Usage: node App/Ops/tests/ops-console.test.mjs   (FE_DIR=<dir> to test another copy)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { webcrypto, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { render as renderM1, TEMPLATE as M1_TEMPLATE } from '../tools/m1-render.mjs';
import { renderSeeds, TEMPLATE as SEED_TEMPLATE } from '../tools/seed-sql.mjs';

const OPS = new URL('../', import.meta.url);
const APP = process.env.FE_DIR ? new URL(`file://${process.env.FE_DIR.replace(/\/?$/, '/')}`) : new URL('../../', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const read = (base, rel) => readFileSync(new URL(rel, base), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };

// --- local D1 with real seeds ------------------------------------------------------------------
const db = new DatabaseSync(':memory:');
for (const m of ['002-ops-control-plane.sql', '003-ops-job-pause.sql', '004-ops-cases.sql', '005-ops-dq.sql']) db.exec(read(OPS, `migrations/${m}`));
db.exec(read(OPS, '../Corporate Atlas/migrations/ma-sep-015b-entity-exceptions.sql'));
db.exec(read(OPS, '../Corporate Atlas/migrations/ma-sep-015c-seed-known-issues.sql'));
const statements = text => text.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
const runFile = text => { db.exec('BEGIN'); for (const s of statements(text)) db.prepare(s).run(); db.exec('COMMIT'); };
runFile(renderM1(readFileSync(M1_TEMPLATE, 'utf8'), 'abc1234').text);
runFile(read(OPS, 'migrations/m2-seed-gleif-cases.sql'));
runFile(read(OPS, 'migrations/m3a-ki2217.sql'));
const tpl = readFileSync(SEED_TEMPLATE, 'utf8');
for (const f of ['m3-seeds.json', 'm4-minimum.json']) { const b = readFileSync(new URL(`seeds/${f}`, OPS)); runFile(renderSeeds(tpl, b, JSON.parse(b)).text); }
runFile(read(OPS, 'migrations/m3c-links.sql'));
// 60 open sweep cases (for Load more), one with a hostile title, one of an unknown future type.
const ins = db.prepare(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, owner_role, raised_by, raised_via, dedupe_key, opened_at, updated_at)
                        VALUES (?, ?, ?, 'open', ?, ?, ?, 'Operations Lead', 'service:health-check-local', 'ingest_auto', ?, ?, ?)`);
for (let i = 0; i < 60; i++) {
  const ref = `EXC-S-${String(i).padStart(12, '0')}`;
  const t = `2026-10-2${i % 9}T0${i % 10}:00:00.000Z`;
  ins.run(ref, i === 1 ? 'brand_new_type' : 'job_missed', `sev${(i % 4) + 1}`, i === 0 ? '<img src=x onerror=alert(1)> run missed' : `Run ${i} missed`,
          i === 0 ? '<script>alert(2)</script>' : 's', 'local.entities-enrich-boost', `seed:${ref}`, t, t);
}
db.exec(`INSERT INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
         SELECT 'exception', CAST(exception_id AS TEXT), 'raised', 'service:health-check-local', 'ingest_key', opened_at, 'raised:' || case_ref FROM ops_exception`);
// A 250-member aggregate for the member Load more (N4-2).
db.exec(`INSERT INTO ops_data_quality_ticket (case_ref, ticket_type, severity, status, title, evidence, object_domain, object_key, raised_by, raised_via)
         VALUES ('DQ-000900', 'isin_duplicate', 'sev3', 'open', 'Big aggregate', '<img src=x onerror=alert(3)>', 'source_record', 'known-issue:test', 'x@example.test', 'ops_console')`);
const bigId = db.prepare(`SELECT ticket_id AS id FROM ops_data_quality_ticket WHERE case_ref = 'DQ-000900'`).get().id;
const mi = db.prepare(`INSERT INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, proposed_action) VALUES (?, 'entity', ?, 'dedupe')`);
for (let i = 0; i < 250; i++) mi.run(bigId, String(10000 + i));
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const evCount = ref => n(`SELECT COUNT(*) n FROM ops_case_event e JOIN ops_exception x ON e.subject_type = 'exception' AND e.subject_id = CAST(x.exception_id AS TEXT) WHERE x.case_ref = ?`, ref);
const dqEv = (ref, type) => db.prepare(`SELECT e.* FROM ops_case_event e JOIN ops_data_quality_ticket t ON e.subject_type = 'dq_ticket' AND e.subject_id = CAST(t.ticket_id AS TEXT)
                                        WHERE t.case_ref = ? AND e.event_type = ? ORDER BY e.event_id`).all(ref, type);
const ref22_44 = db.prepare(`SELECT case_ref FROM ops_data_quality_ticket WHERE dedupe_key = 'ki:22.44'`).get().case_ref;

// --- D1 binding + Access ------------------------------------------------------------------------
const isWrite = sql => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
function stmt(sql, args = []) {
  return {
    bind: (...a) => stmt(sql, a),
    async all() { const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes) } }; },
    execSync() { if (isWrite(sql)) { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes) } }; }
                 const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; }
  };
}
const DB = { prepare: sql => stmt(sql), async batch(ss) { db.exec('BEGIN'); try { const o = ss.map(s => s.execSync()); db.exec('COMMIT'); return o; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
const TEAM = 'test-team.cloudflareaccess.com', AUD = 'aud-test-0000';
const kp = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await webcrypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k', alg: 'RS256' };
const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function jwt(claims) {
  const h = b64({ alg: 'RS256', kid: 'k' }), p = b64({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const sig = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${Buffer.from(sig).toString('base64url')}`;
}
const FOUNDER = await jwt({ email: 'founder@example.test' });
const realFetch = globalThis.fetch;
globalThis.fetch = async u => (String(u) === `https://${TEAM}/cdn-cgi/access/certs` ? new Response(JSON.stringify({ keys: [jwk] })) : realFetch(u));
const { default: worker } = await import('../src/ops-api.js');
const ENV = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OPS_CASES_ENABLED: 'true', OPS_DQ_ENABLED: 'true', OPS_DQ_CONSUMER_ENABLED: 'true', OPS_SERVICE_ACTORS: '{}' };

// --- DOM stub -----------------------------------------------------------------------------------------
function makeWorld({ consoleMode = true, hidden = false } = {}) {
  const byId = new Map(), docListeners = {}, winListeners = {};
  const sent = [];      // every request the front end made: { url, method, headers, body }
  const intervals = new Map(); let nextTimer = 1;
  const storage = new Map();
  let netFault = null;  // 'drop-after' | 'throw' | 'timeout' | 'html502' | 'redirect' | 'stub:<json>'
  const reg = e => { if (e.attrs.id) byId.set(e.attrs.id, e); e.children.forEach(reg); };
  const unreg = e => { if (e.attrs.id && byId.get(e.attrs.id) === e) byId.delete(e.attrs.id); e.children.forEach(unreg); };
  function stubFound(html, sel) {
    const m = /^#([\w-]+)$/.exec(sel) || /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) return null;
    const hit = sel.startsWith('#') ? html.includes(`id="${m[1]}"`) : html.includes(m[2] !== undefined ? `${m[1]}="${m[2]}"` : `${m[1]}=`);
    return hit ? { remove() {}, focus() {}, addEventListener() {}, disabled: false } : null;
  }
  function el(tag) {
    const e = {
      tagName: String(tag).toUpperCase(), attrs: {}, dataset: {}, style: {}, children: [], parent: null, _html: '', listeners: {}, isConnected: false,
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
      get id() { return this.attrs.id; }, set id(v) { this.attrs.id = v; if (this.isConnected) byId.set(v, this); },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id' && this.isConnected) byId.set(v, this); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { this.children.push(c); c.parent = this; if (this.isConnected) { const mark = x => { x.isConnected = true; x.children.forEach(mark); }; mark(c); reg(c); } return c; },
      insertBefore(c) { return this.appendChild(c); },
      get firstChild() { return this.children[0] || null; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); unreg(this); this.isConnected = false; },
      addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
      querySelector(sel) { return stubFound(this._html, sel); }, querySelectorAll() { return []; },
      focus() { doc.activeElement = this; }
    };
    return e;
  }
  const body = el('body'); body.isConnected = true;
  const doc = {
    hidden, body, activeElement: null, createElement: el,
    getElementById: id => byId.get(id) || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(t, f) { (docListeners[t] ||= []).push(f); }
  };
  const opened = [];   // window.open calls (MA-OCT-OPS.A: the terminal fallback)
  const ctx = {
    console: { ...console, error() {}, warn() {} }, setTimeout, clearTimeout, URLSearchParams, JSON, Promise, Error, TypeError,
    crypto: { randomUUID, getRandomValues: a => webcrypto.getRandomValues(a) },
    AbortSignal: { timeout: () => undefined },
    MA_OPS_CONSOLE: consoleMode, document: doc,
    location: { origin: 'https://meridian-ops.test', hash: '', reload() {} },
    history: { pushState(_, __, h) { ctx.location.hash = h; }, replaceState() {} },
    localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)) },
    setInterval: (f, ms) => { const id = nextTimer++; intervals.set(id, ms); return id; },
    clearInterval: id => intervals.delete(id),
    addEventListener(t, f) { (winListeners[t] ||= []).push(f); },
    open: (u, t, f) => { opened.push([String(u), t, f]); return null; },
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      const rec = { url: u.pathname + u.search, host: u.host, method: init.method || 'GET', headers: { ...(init.headers || {}) }, body: init.body ? JSON.parse(init.body) : undefined, redirect: init.redirect, credentials: init.credentials };
      sent.push(rec);
      if (u.host === 'meridian-proxy.navinmv1981.workers.dev') {
        return new Response(JSON.stringify({ pipeline: { offset: 71, total: 237 }, coverage: {}, bootstrap: {},
          enrichment: { version_1_pending: null, version_2_complete: null, total: null, enrichment_source: 'removed-ML-1025-3' }, snapshot_at: '2026-10-29T20:00:00Z' }), { status: 200 });
      }
      const fault = netFault; if (fault && fault !== 'drop-after') netFault = null;
      if (fault === 'throw') throw new TypeError('Failed to fetch');
      if (fault === 'timeout') { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; }
      if (fault === 'html502') return new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } });
      if (fault === 'redirect') return { type: 'opaqueredirect', status: 0, ok: false, text: async () => '' };
      if (fault && fault.startsWith('stub:')) { const [st, j] = JSON.parse(fault.slice(5)); return new Response(JSON.stringify(j), { status: st }); }
      const resp = await worker.fetch(new Request(`https://meridian-ops.test${u.pathname}${u.search}`, { method: rec.method,
        headers: { ...rec.headers, 'Cf-Access-Jwt-Assertion': FOUNDER }, body: init.body }), ENV, { waitUntil() {} });
      if (fault === 'drop-after') { netFault = null; throw new TypeError('Failed to fetch'); }   // the server applied it; the response was lost
      return resp;
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['ma-data.js', 'ma-ops.js']) vm.runInContext(read(APP, f), ctx, { filename: f });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run, sent, intervals, storage, doc, opened, setFault: f => { netFault = f; }, fireDoc: t => (docListeners[t] || []).forEach(f => f()) };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };

// ======================= transport (data_opsAdmin, §4.4, M-5) =======================
{
  const w = makeWorld();
  const r = await w.run(`data_opsAdmin('/api/ops/admin/exceptions?status=open&limit=50')`);
  const req = w.sent.at(-1);
  check('[§4.4] console GET: same-origin base, credentials same-origin, redirect manual, X-Ops-Client console, 200 kind ok',
    r.ok && r.kind === 'ok' && req.host === 'meridian-ops.test' && req.credentials === 'same-origin' && req.redirect === 'manual' && req.headers['X-Ops-Client'] === 'console' && !req.headers['Content-Type'], { r: r.kind, req });
  for (const [fault, kind] of [['redirect', 'signed_out'], ['throw', 'network'], ['timeout', 'timeout'], ['html502', 'non_json']]) {
    w.setFault(fault);
    const x = await w.run(`data_opsAdmin('/api/ops/admin/exceptions')`);
    check(`[M-5] transport: ${fault} → kind ${kind}`, x.kind === kind && x.ok === false, x);
  }
  w.setFault(`stub:${JSON.stringify([401, { ok: false, error: 'unauthorized' }])}`);
  check('[M-5] transport: 401 → signed_out (never confused with offline)', (await w.run(`data_opsAdmin('/api/ops/admin/exceptions')`)).kind === 'signed_out', null);
  const t = makeWorld({ consoleMode: false });
  await t.run(`data_opsAdmin('/api/ops/admin/exceptions')`);
  check('[§4.4] terminal mode targets meridian-ops with credentials include (only used if the Option A constant were ever flipped)', t.sent.at(-1).host === 'meridian-ops.navinmv1981.workers.dev' && t.sent.at(-1).credentials === 'include', t.sent.at(-1));
}

// ======================= response map: every §6.3 + M-5 row =======================
{
  const w = makeWorld();
  const map = r => w.run(`opsc_mapResponse(${JSON.stringify(r)})`);
  const rows = [
    [{ ok: true, status: 200, kind: 'ok', data: { ok: true } }, 'ok', /^Saved\.$/, { reread: true }],
    [{ ok: true, status: 201, kind: 'ok', data: { ok: true } }, 'ok', /^Saved\.$/],
    [{ ok: true, status: 200, kind: 'ok', data: { replay: true } }, 'ok', /^Already saved\.$/],
    [{ ok: true, status: 200, kind: 'ok', data: { deduplicated: true, case_ref: 'DQ-000045' } }, 'ok', /Already reported as DQ-000045/],
    [{ ok: false, status: 400, kind: 'http', data: { error: 'note is required' } }, 'error', /^Add a note\.$/],
    [{ ok: false, status: 400, kind: 'http', data: { error: 'something new' } }, 'error', /The server rejected this request: something new\./],
    [{ ok: false, status: 400, kind: 'http', data: { error: 'csrf: Content-Type …' } }, 'error', /Console error — reload the page/],
    [{ ok: false, status: 0, kind: 'signed_out', data: null }, 'error', /sign-in has expired/, { signedOut: true }],
    [{ ok: false, status: 403, kind: 'http', data: { error: 'service_route_not_allowed' } }, 'error', /isn't allowed for your sign-in/],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'illegal_transition' } }, 'warn', /changed since you opened it/, { reread: true }],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'stale_expected_status' } }, 'warn', /changed since you opened it/, { reread: true }],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'not_applied' } }, 'warn', /changed since you opened it/, { reread: true }],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'request_id_reused' } }, 'warn', /already sent/, { reread: true }],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'members_open' } }, 'warn', /Tick Force and say why/],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'fix_not_scheduled' } }, 'warn', /Schedule the fix first/],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'protected_decision' } }, 'warn', /protected Founder decision/],
    [{ ok: false, status: 409, kind: 'http', data: { error: 'dq_actions_arrive_with_ma_oct_004' } }, 'warn', /DQ actions are not live yet/],
    [{ ok: false, status: 429, kind: 'http', data: { error: 'daily_create_cap' } }, 'error', /Daily ticket limit reached/],
    [{ ok: false, status: 503, kind: 'http', data: { error: 'cases_disabled' } }, 'error', /switched off right now/],
    [{ ok: false, status: 503, kind: 'http', data: { error: 'dq_disabled' } }, 'error', /switched off right now/],
    [{ ok: false, status: 500, kind: 'http', data: { error: 'internal error' } }, 'error', /Ops is unavailable \(HTTP 500\)\. Nothing was changed unless the list shows it; Refresh\./],
    [{ ok: false, status: 522, kind: 'non_json', data: null }, 'error', /Ops is unavailable \(HTTP 522\)/],
    [{ ok: false, status: 0, kind: 'network', data: null }, 'error', /Couldn't reach Ops/, { retrySame: true }],
    [{ ok: false, status: 0, kind: 'timeout', data: null }, 'error', /Couldn't reach Ops/, { retrySame: true }]
  ];
  const bad = rows.filter(([r, tone, re, extra]) => { const m = map(r); return m.tone !== tone || !re.test(m.text) || Object.entries(extra || {}).some(([k, v]) => m[k] !== v); })
    .map(([r]) => [r.status, r.kind, r.data && r.data.error, map(r)]);
  check(`[§6.3 + M-5] response map: all ${rows.length} rows (incl. replay, stale_expected_status, not_applied, csrf, 500, HTML 5xx, signed-out vs offline)`, bad.length === 0, bad);
}

// ======================= Cases: list, drawer, actions against the real Worker =======================
{
  const w = makeWorld();
  await w.run(`openOps({ console: true })`); await settle();
  const healthReads = w.sent.filter(s => s.host === 'meridian-proxy.navinmv1981.workers.dev').length;
  check('[M-3] console opens on Cases: no /api/ops-health read, no poll interval', healthReads === 0 && w.intervals.size === 0, { healthReads, intervals: [...w.intervals] });
  const listReq = w.sent.find(s => s.url.startsWith('/api/ops/admin/exceptions'));
  check('[AC-2/N-3] Cases list: one E-1 call, status=open,acknowledged, limit=50', listReq && listReq.url === '/api/ops/admin/exceptions?status=open%2Cacknowledged&limit=50', listReq);
  const html = w.run(`document.getElementById('ops-tab-cases').innerHTML`);
  check('[AC-2] list shows severity as text ("Sev 1"), refs, Overdue flags, counts "on this page", and Load more (next_cursor)',
    /Sev 1/.test(html) && html.includes('EXC-S-000000000002') && /Overdue/.test(html) && /\(on this page\)/.test(html) && /data-opsc-more="1"/.test(html) && /Load more/.test(html), html.slice(0, 300));
  check('[§6.2] hostile title escaped in the list; unknown type "brand_new_type" rendered raw', html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img src=x') && html.includes('brand_new_type'), null);
  const before = w.run(`opscState.EXC.items.length`);
  await w.run(`opsc_loadList('EXC', true)`);
  const more = w.sent.filter(s => s.url.startsWith('/api/ops/admin/exceptions')).at(-1);
  check('[§5.1] Load more sends the server next_cursor and appends the next page', /&cursor=/.test(more.url) && w.run(`opscState.EXC.items.length`) > before
    && new Set(w.run(`opscState.EXC.items.map(i => i.case_ref)`)).size === w.run(`opscState.EXC.items.length`), { before, after: w.run(`opscState.EXC.items.length`) });

  // AC-3: acknowledge from the drawer
  const REF = 'EXC-S-000000000003';
  await w.run(`opsc_openDrawer('${REF}', null)`);
  let drawer = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[§5.2] drawer: dialog with heading, only the legal actions for an open case (no Reopen), history with the raised event',
    w.run(`document.getElementById('opsc-drawer').getAttribute('role')`) === 'dialog' && drawer.includes('id="opsc-drawer-title"') && /data-opsc-action="acknowledge"/.test(drawer)
    && !/data-opsc-action="reopen"/.test(drawer) && /Raised/.test(drawer), null);
  w.run(`opscState.drawer.ui.form = 'acknowledge'`);
  const nBefore = evCount(REF);
  const built = w.run(`opsc_buildActionBody('EXC', 'acknowledge', {}, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID(), actingRole: 'Founder' })`);
  await w.run(`opsc_send(${JSON.stringify(built.body)}, {}, undefined)`); await settle();
  const post = w.sent.filter(s => s.method === 'POST').at(-1);
  const ack = db.prepare(`SELECT e.* FROM ops_case_event e JOIN ops_exception x ON e.subject_id = CAST(x.exception_id AS TEXT) AND e.subject_type = 'exception' WHERE x.case_ref = ? ORDER BY event_id DESC LIMIT 1`).get(REF);
  check('[AC-3] one POST with Content-Type JSON, X-Ops-Client console, a UUID request_id, expected_status open, actor_role Founder',
    post.headers['Content-Type'] === 'application/json' && post.headers['X-Ops-Client'] === 'console' && /^[0-9a-f-]{36}$/.test(post.body.request_id)
    && post.body.expected_status === 'open' && post.body.actor_role === 'Founder' && post.body.action === 'acknowledge', post);
  drawer = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-3] "Saved." shown; the drawer re-read shows Acknowledged; exactly one new event, actor = the Founder email',
    drawer.includes('Saved.') && drawer.includes('>Acknowledged<') && evCount(REF) === nBefore + 1 && ack.event_type === 'acknowledged' && ack.actor === 'founder@example.test', { ack });

  // AC-4 and M-4: the form blocks invalid submits; nothing is sent
  const sentN = w.sent.length;
  const blocked = [
    ['resolve', { note: 'x' }, /Choose a resolution/], ['resolve', { resolution: 'fixed' }, /Add a note/], ['comment', {}, /Add a note/],
    ['set_severity', { severity: 'sev2' }, /Add a note/], ['dismiss', { resolution: 'not_actionable' }, /Add a note/], ['assign', {}, /owner role or enter an assignee/],
    ['assign', { assignee: 'not an email' }, /email address or service/], ['dismiss', { resolution: 'duplicate', note: 'x', duplicate_of: 'DQ-000010' }, /EXC- ref/]
  ].map(([a, f, re]) => [a, re.test(w.run(`opsc_buildActionBody('EXC', '${a}', ${JSON.stringify(f)}, { row: opscState.drawer.detail.case, requestId: 'x' }).error || ''`))]);
  check('[AC-4 / M-4] required fields: resolution, notes for comment/set severity/resolve/dismiss, assign role-or-assignee, duplicate ref of the same kind — blocked, no request',
    blocked.every(([, ok]) => ok) && w.sent.length === sentN, blocked);
  const roles = w.run(`OPSC_ROLES.join('|')`);
  const casesRoles = /export const ROLES = \[([^\]]+)\]/.exec(read(OPS, 'src/cases.js'))[1].replace(/'/g, '').split(',').map(s => s.trim()).join('|');
  check('[M-4b] the role select is exactly cases.js ROLES (8)', roles === casesRoles && roles.split('|').length === 8, { roles, casesRoles });

  // resolve → reopen (AC-5)
  const res1 = w.run(`opsc_buildActionBody('EXC', 'resolve', { resolution: 'transient', note: 'Cleared on rerun' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID(), actingRole: 'Founder' })`);
  await w.run(`opsc_send(${JSON.stringify(res1.body)}, {}, undefined)`); await settle();
  const reo = w.run(`opsc_buildActionBody('EXC', 'reopen', { note: 'Recurred' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() })`);
  await w.run(`opsc_send(${JSON.stringify(reo.body)}, {}, undefined)`); await settle();
  drawer = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-5] resolve then reopen with a note → status Open, with the reopen event in history', drawer.includes('>Open<') && /Reopened/.test(drawer)
    && db.prepare(`SELECT status FROM ops_exception WHERE case_ref = ?`).get(REF).status === 'open', null);

  // AC-6: two tabs on the same case
  const A = makeWorld(), B = makeWorld();
  for (const x of [A, B]) { await x.run(`openOps({ console: true })`); await settle(); await x.run(`opsc_openDrawer('EXC-S-000000000004', null)`); }
  const e0 = evCount('EXC-S-000000000004');
  const bodyA = A.run(`opsc_buildActionBody('EXC', 'acknowledge', {}, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() }).body`);
  const bodyB = B.run(`opsc_buildActionBody('EXC', 'acknowledge', {}, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() }).body`);
  await A.run(`opsc_send(${JSON.stringify(bodyA)}, {}, undefined)`); await settle();
  await B.run(`opsc_send(${JSON.stringify(bodyB)}, {}, undefined)`); await settle();
  const bHtml = B.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-6] tab 2 shows the "changed since you opened it" copy and refreshes (now Acknowledged); the server holds one event from tab 1 only',
    /changed since you opened it/.test(bHtml) && bHtml.includes('>Acknowledged<') && evCount('EXC-S-000000000004') === e0 + 1, { e0, now: evCount('EXC-S-000000000004') });

  // AC-7: the response is lost after the server applied it; Retry re-sends the same request_id → 200 replay, one event
  const C = makeWorld(); await C.run(`openOps({ console: true })`); await settle();
  await C.run(`opsc_openDrawer('EXC-S-000000000005', null)`);
  const e5 = evCount('EXC-S-000000000005');
  const bodyC = C.run(`opsc_buildActionBody('EXC', 'comment', { note: 'Looking at it' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() }).body`);
  C.setFault('drop-after');
  await C.run(`opsc_send(${JSON.stringify(bodyC)}, { note: 'Looking at it' }, undefined)`); await settle();
  const cHtml1 = C.run(`document.getElementById('opsc-drawer').innerHTML`);
  const pending = C.run(`opscState.drawer.pending && opscState.drawer.pending.body.request_id`);
  check('[AC-7] network failure → "Couldn\'t reach Ops" with Retry; the form contents are kept; the request_id is held for Retry',
    /Couldn&#39;t reach Ops|Couldn't reach Ops/.test(cHtml1) && /data-opsc-retry="1"/.test(cHtml1) && pending === bodyC.request_id && C.run(`opscState.drawer.ui.draft.note`) === 'Looking at it', cHtml1.slice(0, 200));
  await C.run(`opsc_send(opscState.drawer.pending.body, opscState.drawer.pending.draft, undefined)`); await settle();
  const retry = C.sent.filter(s => s.method === 'POST').at(-1);
  const cHtml2 = C.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-7] Retry re-sends the SAME request_id → server 200 replay → "Already saved."; exactly one event', retry.body.request_id === bodyC.request_id
    && /Already saved\./.test(cHtml2) && evCount('EXC-S-000000000005') === e5 + 1, { e5, now: evCount('EXC-S-000000000005') });
  const fresh = C.run(`opsc_buildActionBody('EXC', 'comment', { note: 'again' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() }).body.request_id`);
  check('[§6.1] a new submit gets a fresh request_id', fresh !== bodyC.request_id, null);

  // escaping in the drawer
  await w.run(`opsc_openDrawer('EXC-S-000000000000', null)`);
  drawer = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[§6.2] drawer escapes title and summary (<img onerror>, <script>) — inert', drawer.includes('&lt;img src=x onerror=alert(1)&gt;') && drawer.includes('&lt;script&gt;alert(2)&lt;/script&gt;')
    && !drawer.includes('<script>') && !drawer.includes('<img src=x'), null);
}

// ======================= DQ tickets: list, members, Fixed gate, protected reopen =======================
{
  const w = makeWorld();
  await w.run(`openOps({ console: true })`); await settle();
  await w.run(`ops_switchTab('dq')`); await settle();
  const listReq = w.sent.find(s => s.url.startsWith('/api/ops/admin/dq-tickets'));
  const html = w.run(`document.getElementById('ops-tab-dq').innerHTML`);
  check('[§5.3] DQ list: one D-1 call (open, triaged, fix_pending; limit 50); seeded tickets listed with labels and objects',
    listReq.url === '/api/ops/admin/dq-tickets?status=open%2Ctriaged%2Cfix_pending&limit=50' && html.includes(ref22_44) && html.includes('Wrong LEI') && html.includes('known-issue:22.44'), listReq);
  w.run(`opscState.DQ.statuses = ['resolved']`); await w.run(`opsc_loadList('DQ', false)`);
  check('[§5.3] the do_not_merge legacy tickets carry a "Protected decision" badge', /DQ-M-000001[\s\S]*Protected decision/.test(w.run(`document.getElementById('ops-tab-dq').innerHTML`)), null);

  // AC-8: KI 22.44 (24 members); set one member to Won't fix with expected_member_status from the last read
  await w.run(`opsc_openDrawer('${ref22_44}', null)`);
  let d = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-8] detail shows Problem, the 24 members (object, proposed action, status) and History', /Members \(24\)/.test(d) && d.includes('entity:528') && /Replace lei t1/.test(d) && /History/.test(d), null);
  const mb = w.run(`opsc_buildMemberBody(opscState.drawer.ui.members.find(m => m.object_key === '1868'), { member_status: 'wont_fix', note: 'Candidate is a different company' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID(), actingRole: 'Data-Identity Lead' })`);
  check('[M-4c] member_update body carries expected_member_status from the last read, the member key and the new status',
    mb.body && mb.body.expected_member_status === 'open' && mb.body.member.object_key === '1868' && mb.body.member_status === 'wont_fix' && mb.body.expected_status === 'triaged', mb);
  await w.run(`opsc_send(${JSON.stringify(mb.body)}, {}, 0)`); await settle();
  d = w.run(`document.getElementById('opsc-drawer').innerHTML`);
  check('[AC-8] 1 member_updated event; the ticket refreshes with the member Won\'t fix', dqEv(ref22_44, 'member_updated').length === 1 && d.includes('Saved.')
    && w.run(`opscState.drawer.ui.members.find(m => m.object_key === '1868').member_status`) === 'wont_fix', null);
  const fixNoConfirm = w.run(`opsc_buildMemberBody(opscState.drawer.ui.members[0], { member_status: 'fixed', note: 'MA-OCT-019' }, { row: opscState.drawer.detail.case, requestId: 'x' }).error`);
  check('[N-5] member → Fixed needs the confirmation tick (and a note naming the fix packet)', /Tick the confirmation/.test(fixNoConfirm)
    && /Name the applied fix packet/.test(w.run(`opsc_buildMemberBody(opscState.drawer.ui.members[0], { member_status: 'fixed', confirm: true }, { row: opscState.drawer.detail.case, requestId: 'x' }).error`)), fixNoConfirm);

  // N4-2: members Load more on a 250-member aggregate
  await w.run(`opsc_openDrawer('DQ-000900', null)`);
  check('[N4-2] first members page = 200 with "Load more members"', w.run(`opscState.drawer.ui.members.length`) === 200 && /data-opsc-members-more/.test(w.run(`document.getElementById('opsc-drawer').innerHTML`)), w.run(`opscState.drawer.ui.members.length`));
  await w.run(`opsc_moreMembers()`);
  check('[N4-2] Load more members fetches ?members_after=<cursor> and appends the remaining 50', w.run(`opscState.drawer.ui.members.length`) === 250
    && /members_after=entity%7C/.test(w.sent.at(-1).url) && w.run(`opscState.drawer.ui.membersCursor`) === null, w.sent.at(-1).url);
  check('[§6.2] DQ evidence escaped in the drawer', w.run(`document.getElementById('opsc-drawer').innerHTML`).includes('&lt;img src=x onerror=alert(3)&gt;'), null);

  // AC-9: the Fixed gate, then Schedule fix, then Resolve Fixed (with Force + confirm because members are open)
  const formHtml = w.run(`opsc_renderForm('DQ', 'resolve', { row: opscState.drawer.detail.case, events: opscState.drawer.detail.events, membersOpen: true })`);
  check('[AC-9] no fix_scheduled event → "Fixed" disabled with its reason; Force and its confirmation offered (members open); the authority line shown',
    /<option value="fixed" disabled>Fixed — schedule the fix first<\/option>/.test(formHtml) && /name="force"/.test(formHtml) && /name="confirm"/.test(formHtml)
    && /for the Data-Identity Lead or the Founder/.test(formHtml), formHtml.slice(0, 400));
  const gate = w.run(`opsc_buildActionBody('DQ', 'resolve', { disposition: 'fixed', note: 'x' }, { row: opscState.drawer.detail.case, requestId: 'x', fixScheduled: false })`);
  check('[AC-9] building Resolve → Fixed without a fix_scheduled event is refused client-side', /Schedule the fix first/.test(gate.error || ''), gate);
  const sf = w.run(`opsc_buildActionBody('DQ', 'schedule_fix', { fix_ref: 'MA-OCT-019', note: 'DIL packet' }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() })`);
  await w.run(`opsc_send(${JSON.stringify(sf.body)}, {}, undefined)`); await settle();
  const form2 = w.run(`opsc_renderForm('DQ', 'resolve', { row: opscState.drawer.detail.case, events: opscState.drawer.detail.events, membersOpen: true })`);
  check('[AC-9] after Schedule fix (one fix_scheduled event, payload.fix_ref) "Fixed" is enabled', dqEv('DQ-000900', 'fix_scheduled').length === 1
    && JSON.parse(dqEv('DQ-000900', 'fix_scheduled')[0].payload).fix_ref === 'MA-OCT-019' && /<option value="fixed">Fixed<\/option>/.test(form2), null);
  const noForceConfirm = w.run(`opsc_buildActionBody('DQ', 'resolve', { disposition: 'fixed', note: 'Applied by MA-OCT-019', force: true }, { row: opscState.drawer.detail.case, requestId: 'x', fixScheduled: true, membersOpen: true }).error`);
  check('[N-5] force-resolve needs the confirmation tick', /Tick the confirmation/.test(noForceConfirm || ''), noForceConfirm);
  const rs = w.run(`opsc_buildActionBody('DQ', 'resolve', { disposition: 'fixed', note: 'Applied by MA-OCT-019; rest re-checked after 013', force: true, confirm: true }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID(), fixScheduled: true, membersOpen: true })`);
  await w.run(`opsc_send(${JSON.stringify(rs.body)}, {}, undefined)`); await settle();
  check('[AC-9] Resolve → Fixed with force succeeds; the ticket is resolved', db.prepare(`SELECT status, disposition FROM ops_data_quality_ticket WHERE case_ref = 'DQ-000900'`).get().disposition === 'fixed'
    && w.run(`document.getElementById('opsc-drawer').innerHTML`).includes('Saved.'), null);

  // AC-9 protected reopen
  await w.run(`opsc_openDrawer('DQ-M-000001', null)`);
  const pf = w.run(`opsc_renderForm('DQ', 'reopen', { row: opscState.drawer.detail.case, events: opscState.drawer.detail.events })`);
  const pErr = w.run(`opsc_buildActionBody('DQ', 'reopen', { note: 'try' }, { row: opscState.drawer.detail.case, requestId: 'x' }).error`);
  check('[AC-9 / M-4d] protected ticket: the reopen form asks for the supersession reference and date; submit without them is blocked',
    /supersession_reference/.test(pf) && /supersession_decided_at/.test(pf) && /supersession reference/.test(pErr || ''), pErr);
  const forced = w.run(`({ action: 'reopen', request_id: crypto.randomUUID(), expected_status: 'resolved', note: 'via dev tools' })`);
  await w.run(`opsc_send(${JSON.stringify(forced)}, {}, undefined)`); await settle();
  check('[AC-9] forced past the form (dev tools): the server 409 protected_decision copy is shown; the row is unchanged',
    /protected Founder decision/.test(w.run(`document.getElementById('opsc-drawer').innerHTML`)) && db.prepare(`SELECT status FROM ops_data_quality_ticket WHERE case_ref = 'DQ-M-000001'`).get().status === 'resolved', null);
  const okReopen = w.run(`opsc_buildActionBody('DQ', 'reopen', { note: 'Founder superseded', supersession_reference: 'ML-1031-1', supersession_decided_at: '2026-10-31', confirm: true }, { row: opscState.drawer.detail.case, requestId: crypto.randomUUID() })`);
  check('[M-4d] protected reopen sends founder_supersession {reference, decided_at}', okReopen.body && okReopen.body.founder_supersession.reference === 'ML-1031-1' && okReopen.body.founder_supersession.decided_at === '2026-10-31', okReopen);
}

// ======================= terminal fallback, Health poll, enrichment, Board/Ledger (MA-OCT-OPS.A) =======================
{
  // The terminal no longer loads ma-ops.js (OPS is a link). Loaded outside the console anyway, openOps() opens the console.
  const t = makeWorld({ consoleMode: false });
  await t.run(`openOps()`); await settle();
  check('[OPS.A] outside the console, openOps() opens the console in a new tab (noopener) — no panel, no request, no poll',
    t.opened.length === 1 && t.opened[0][0] === 'https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/console' && t.opened[0][1] === '_blank' && t.opened[0][2] === 'noopener'
    && t.run(`document.getElementById('ops-panel')`) === null && t.sent.length === 0 && t.intervals.size === 0, { opened: t.opened, sent: t.sent.length });

  const c = makeWorld();
  await c.run(`openOps({ console: true })`); await settle();
  await c.run(`ops_switchTab('health')`); await settle();
  check('[M-3] console: Health tab → one ops-health read and the 10-min poll starts', c.sent.filter(s => s.host === 'meridian-proxy.navinmv1981.workers.dev').length === 1
    && [...c.intervals.values()].includes(600000), [...c.intervals.values()]);
  const ht = c.run(`document.getElementById('ops-tab-health').innerHTML`);
  check('[ML-1026-1] null enrichment counts → "Enrichment counts removed (ML-1025-3)", never "0 enriched · 0 pending"', /Enrichment counts removed \(ML-1025-3\)/.test(ht) && !/0 enriched/.test(ht), null);
  check('[OPS.A] the console Health view has no close button (nothing to close back to)', !/ops-close-btn/.test(ht), null);
  c.doc.hidden = true; c.fireDoc('visibilitychange');
  check('[M-2] a hidden document stops the poll', c.intervals.size === 0, [...c.intervals.values()]);
  c.doc.hidden = false; c.fireDoc('visibilitychange');
  check('[M-2] visible again on Health → one refresh and the poll restarts', c.intervals.size === 1 && c.sent.filter(s => s.host === 'meridian-proxy.navinmv1981.workers.dev').length === 2, null);
  await c.run(`ops_switchTab('dq')`); await settle();
  check('[M-3] console: leaving Health stops the poll', c.intervals.size === 0, null);
  c.doc.hidden = false; c.fireDoc('visibilitychange');
  check('[M-3] console: becoming visible on an admin tab does not read ops-health', c.sent.filter(s => s.host === 'meridian-proxy.navinmv1981.workers.dev').length === 2 && c.intervals.size === 0, null);
  c.run(`ops_renderSprintBoard([{ ticket_id: 'MA-OCT-005', domain: 'Ops', owner_role: 'Engineering Lead', title: 'Console', stage: 'ENG_IMPLEMENT' }])`);
  c.run(`ops_renderReleaseLedger([{ release_id: 'R-1', change_summary: 's', d1_migration_status: 'n/a', worker_deploy_status: 'n/a', frontend_push_status: 'n/a', status: 'READY' }])`);
  const sb = c.run(`document.getElementById('ops-tab-sprint').innerHTML`), rl = c.run(`document.getElementById('ops-tab-release').innerHTML`);
  check('[AC-13] Sprint Board and Release Ledger: data shown, no action buttons, read-only footnote', sb.includes('MA-OCT-005') && rl.includes('R-1') && !/Change stage|Record event/.test(sb + rl)
    && sb.includes('Read-only. Changes are made by the Main Lane.') && rl.includes('Read-only. Changes are made by the Main Lane.'), null);
  check('[§6.2] localStorage holds only ops_acting_role', [...c.storage.keys(), ...t.storage.keys()].every(k => k === 'ops_acting_role'), [...c.storage.keys()]);
}

// ======================= static checks (§10.2, AC-12, M-1) =======================
{
  const ops = read(APP, 'ma-ops.js'), data = read(APP, 'ma-data.js');
  const code = s => s.replace(/^\s*\/\/.*$/gm, '');
  check('[AC-12] no prompt( or alert( in ma-ops.js', !/\b(prompt|alert)\(/.test(code(ops)), null);
  check('[§10.2] no fetch( in ma-ops.js (network only through ma-data.js)', !/\bfetch\(/.test(code(ops)), null);
  check('[M-1] no inline event handler attribute (on…=) emitted by ma-ops.js', !/\son[a-z]+\s*=\s*["'`$]/i.test(code(ops)), (code(ops).match(/\son[a-z]+\s*=\s*["'`$].{0,40}/i) || [])[0]);
  const keys = [...code(ops).matchAll(/_opsPref\('([^']+)'/g)].map(m => m[1]);
  check('[AC-12] one localStorage key used: ops_acting_role; no direct localStorage outside _opsPref',
    new Set(keys).size === 1 && keys[0] === 'ops_acting_role' && (code(ops).match(/localStorage\./g) || []).length === 2, keys);
  const secret = /Cf-Access-Jwt|CF_Authorization|client_secret|\.meridian-secrets|OPS_INGEST/;
  const front = readdirSync(new URL('./', APP)).filter(f => /\.(js|html)$/.test(f)).map(f => [`App/${f}`, read(APP, f)]);
  const docsDir = new URL('docs/', ROOT);
  const docs = existsSync(docsDir) ? readdirSync(docsDir).filter(f => /\.(js|html)$/.test(f)).map(f => [`docs/${f}`, read(docsDir, f)]) : [];
  const hits = [...front, ...docs].filter(([, s]) => secret.test(s)).map(([f]) => f);
  check(`[AC-12] grep of App/*.js|html and docs/ for Cf-Access-Jwt, CF_Authorization, client_secret, .meridian-secrets, OPS_INGEST → 0 hits (${front.length + docs.length} files)`, hits.length === 0, hits);
  check('[§4.4] data_opsAdmin uses redirect:"manual" and detects opaqueredirect', /redirect: 'manual'/.test(data) && /opaqueredirect/.test(data), null);
  const consoleSection = ops.slice(ops.indexOf('MA-OCT-005 operator console: Cases (003) and DQ Tickets (004).'));
  check('[N-3] the console section never asks for limit=100 (the Events tab\'s meridian-control limit=100 is not an admin read)', consoleSection.length > 1000
    && !/limit=100/.test(consoleSection) && /OPSC_LIMIT = 50/.test(consoleSection), null);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
