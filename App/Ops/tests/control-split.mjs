#!/usr/bin/env node
// MA-OCT-002a A6 — local acceptance test for the meridian-control split (spec 002 rev 1.3 §13,
// CR-1, AC-a6). Runs the REAL src/ops-api.js and src/control-api.js handlers in Node on an
// in-memory SQLite D1 built from the real migration (001-ops-schema.sql), with Access JWTs
// signed here (RS256) against a stubbed team JWKS. No network, no remote D1.
//
// Checks:
//  [routes]   meridian-ops serves exactly 7 endpoints + 2 rules; meridian-control serves 8;
//             every pre-split route is served by exactly one Worker.
//  [redirect] the 4 moved GETs on meridian-ops → 302 (never 301) to the same path + query on
//             meridian-control, with ACAO '*' and no-store; HEAD too; CONTROL_BASE_URL override.
//  [parity]   following the redirect gives the same status, body and CORS as the pre-split
//             capture (tests/fixtures/a6-pre-split-capture.json); the 4 admin POSTs on
//             meridian-control leave the governance tables exactly as the pre-split handler did.
//  [auth]     001 AC4 matrix on meridian-control: no JWT / forged signature / wrong aud
//             (meridian-ops's) / expired / wrong iss / Access unconfigured → 401 and 0 rows;
//             valid user session and service token → 2xx with the verified actor; the 4 legacy
//             anonymous POSTs → 401 and 0 rows on both Workers; moved admin POSTs on
//             meridian-ops → 404 and 0 rows.
//  [cors]     public GETs ACAO '*'; admin responses and admin OPTIONS carry none.
//  [writers]  grep: ops_* tables written only inside the meridian-ops bundle (ops-api.js + its
//             imports); governance tables only in control-api.js (src/ only; tests/tools excluded).
//
// Usage: node App/Ops/tests/control-split.mjs
//   Regenerate the capture from the pre-split handler (one-off, at the A6 build):
//   A6_PRE_SPLIT_SRC=<path to pre-split ops-api.js> node App/Ops/tests/control-split.mjs --write-capture

import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const OPS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(OPS, rel), 'utf8');
const CAPTURE = path.join(OPS, 'tests/fixtures/a6-pre-split-capture.json');
const WRITE_CAPTURE = process.argv.includes('--write-capture');

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 600)}`); };

// --- D1 over node:sqlite ---------------------------------------------------------
let db;
function freshDb() {
  db = new DatabaseSync(':memory:');
  db.exec(read('migrations/001-ops-schema.sql'));
  db.exec(read('migrations/002-ops-control-plane.sql'));
  db.exec(read('migrations/003-ops-job-pause.sql'));
  // Read-only tables of other domains that meridian-ops's remaining GETs touch (minimal shape).
  db.exec(`CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
           CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY);
           CREATE TABLE instrument_entity_map (instrument_key TEXT PRIMARY KEY, entity_id INTEGER);`);
  db.exec(`
    INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, created_at, updated_at) VALUES
      ('MA-T-001','Alpha','Ops','control','ENG_IMPLEMENT','Engineering Lead','ACTIVE','2026-10-01 10:00:00','2026-10-05 10:00:00'),
      ('MA-T-002','Beta','Entities','data_identity','ARCH_REVIEW','Data-Identity Lead','ACTIVE','2026-10-02 10:00:00','2026-10-06 10:00:00'),
      ('MA-T-003','Gamma','ETF','application','BLOCKED','ETF Product Lead','BLOCKED','2026-10-03 10:00:00','2026-10-04 10:00:00');
    INSERT INTO releaseledger (release_id, ticket_ids, change_summary, worker_deploy_status, frontend_push_status, status, created_at, updated_at) VALUES
      ('REL-T-001','["MA-T-001","MA-T-002"]','Ops release','deployed','in_progress','DEPLOYING','2026-10-07 10:00:00','2026-10-08 10:00:00'),
      ('REL-T-002','["MA-T-003"]','ETF release','not_started','not_started','NOT_READY','2026-10-07 11:00:00','2026-10-07 11:00:00');
    INSERT INTO operationalevents (event_type, ticket_id, release_id, actor_role, payload, created_at) VALUES
      ('packet_created','MA-T-001',NULL,'Program Orchestrator','{"packet_type":"ticket"}','2026-10-01 10:00:00'),
      ('ticket_state_changed','MA-T-001',NULL,'Engineering Lead','{"from_stage":"IDEA","to_stage":"ENG_IMPLEMENT"}','2026-10-05 10:00:00'),
      ('packet_created',NULL,'REL-T-001','Program Orchestrator','{"packet_type":"release"}','2026-10-07 10:00:00'),
      ('worker_deployed',NULL,'REL-T-001','Engineering Lead','{}','2026-10-08 10:00:00');
  `);
}
function stmt(sql, args = []) {
  const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
  return {
    bind: (...a) => stmt(sql, a),
    async all() { const results = db.prepare(sql).all(...args).map(r => ({ ...r })); return { results, meta: { rows_read: results.length } }; },
    async first() { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; },
    async run() { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes) } }; },
    exec() { return isWrite ? this.run() : this.all(); }
  };
}
const DB = { prepare: sql => stmt(sql), batch: async ss => { const out = []; for (const s of ss) out.push(await s.exec()); return out; } };
const govCounts = () => ['sprintboarditems', 'releaseledger', 'operationalevents'].map(t => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n).join('/');
// Table dump with wall-clock columns reduced to "set or not" (they come from CURRENT_TIMESTAMP / Date).
const TIME_COLS = new Set(['created_at', 'updated_at', 'closed_at']);
const dump = () => Object.fromEntries(['sprintboarditems', 'releaseledger', 'operationalevents'].map(t => [t,
  db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all().map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, TIME_COLS.has(k) ? (v !== null) : v])))]));

// --- Access: a real RS256 key pair, JWKS served by a stubbed fetch ----------------
const TEAM = 'team.test';
const AUD_CONTROL = 'aud-control-0001', AUD_OPS = 'aud-ops-0001';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function jwt(claims, { kid = 'k1', forge = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: `https://${TEAM}`, aud: [AUD_CONTROL], exp: now + 600, iat: now, ...claims }));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`)));
  if (forge) sig[10] ^= 0xff;
  return `${h}.${p}.${b64u(sig)}`;
}
// Cloudflare analytics (the cf/* routes) is stubbed too: this test never touches the network.
globalThis.fetch = async (u, o) => {
  u = String(u);
  if (u === `https://${TEAM}/cdn-cgi/access/certs`) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  if (u === 'https://api.cloudflare.com/client/v4/graphql') return new Response(JSON.stringify({ data: { viewer: { accounts: [{}] } } }), { status: 200 });
  throw new Error(`unexpected network call in test: ${u}`);
};

// --- Workers ----------------------------------------------------------------------
const { default: ops } = await import(pathToFileURL(path.join(OPS, 'src/ops-api.js')).href);
const { default: control } = await import(pathToFileURL(path.join(OPS, 'src/control-api.js')).href);
let pre = null;
if (process.env.A6_PRE_SPLIT_SRC) {
  const dir = mkdtempSync(path.join(tmpdir(), 'a6-pre-'));
  copyFileSync(process.env.A6_PRE_SPLIT_SRC, path.join(dir, 'ops-api.js'));
  copyFileSync(path.join(OPS, 'src/lateness.js'), path.join(dir, 'lateness.js'));
  pre = (await import(pathToFileURL(path.join(dir, 'ops-api.js')).href)).default;
}
const envOps = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD_OPS, OPS_INGEST_ENABLED: 'false', OPS_SWEEP_ENABLED: 'false', CF_ACCOUNT_TAG: 'acct', CF_ANALYTICS_TOKEN: 'x' };
const envControl = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD_CONTROL };
const envPre = { ...envOps, CF_ACCESS_AUD: AUD_CONTROL };   // pre-split admin = same handler code, audited against one AUD

async function call(worker, env, method, p, { body, token, host = 'https://w.test' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Cf-Access-Jwt-Assertion'] = token;
  const resp = await worker.fetch(new Request(host + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' }), env, { waitUntil() {} });
  const text = method === 'HEAD' ? '' : await resp.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: resp.status, json, acao: resp.headers.get('access-control-allow-origin'), location: resp.headers.get('location'), cache: resp.headers.get('cache-control') };
}

const MOVED_GETS = ['/api/ops/sprint-board', '/api/ops/sprint-board?stage=BLOCKED', '/api/ops/release-ledger', '/api/ops/events', '/api/ops/events?ticket_id=MA-T-001&limit=1', '/api/ops/drift'];
// A fixed sequence over the 4 admin POSTs (covers: create, forward stage, BLOCKED, backward reject,
// release create, worker_deployed, verification_passed, release_closed cascade, rollback without reason).
const POST_SEQ = [
  ['/api/ops/admin/sprint-board', { ticket_id: 'MA-T-010', title: 'Delta', domain: 'Ops', lane: 'ops', owner_role: 'Operations Lead' }],
  ['/api/ops/admin/sprint-board', { ticket_id: 'MA-T-010', title: 'dup', domain: 'Ops', lane: 'ops', owner_role: 'x' }],
  ['/api/ops/admin/sprint-board', { ticket_id: 'MA-T-011' }],
  ['/api/ops/admin/sprint-board/MA-T-010/stage', { stage: 'ENG_IMPLEMENT', actor_role: 'Engineering Lead', gate_result: 'passed' }],
  ['/api/ops/admin/sprint-board/MA-T-010/stage', { stage: 'IDEA', actor_role: 'Engineering Lead' }],
  ['/api/ops/admin/sprint-board/MA-T-010/stage', { stage: 'BLOCKED', actor_role: 'Engineering Lead', blocker: 'waiting' }],
  ['/api/ops/admin/sprint-board/NOPE/stage', { stage: 'CLOSED', actor_role: 'x' }],
  ['/api/ops/admin/release-ledger', { release_id: 'REL-T-010', ticket_ids: ['MA-T-001', 'MA-T-010'], change_summary: 'A6 test release' }],
  ['/api/ops/admin/release-ledger/REL-T-010/event', { event_type: 'worker_deployed', actor_role: 'Engineering Lead' }],
  ['/api/ops/admin/release-ledger/REL-T-010/event', { event_type: 'verification_passed', actor_role: 'Operations Lead' }],
  ['/api/ops/admin/release-ledger/REL-T-010/event', { event_type: 'release_closed', actor_role: 'Program Orchestrator', payload: { note: 'ok' } }],
  ['/api/ops/admin/release-ledger/REL-T-002/event', { event_type: 'release_rolled_back', actor_role: 'x' }],
  ['/api/ops/admin/release-ledger/REL-T-002/event', { event_type: 'not_a_type', actor_role: 'x' }],
];
async function runPostSeq(worker, env) {
  freshDb();
  const token = await jwt({ email: 'founder@example.com' });
  const res = [];
  for (const [p, b] of POST_SEQ) { const r = await call(worker, env, 'POST', p, { body: b, token }); res.push({ p, status: r.status, json: r.json, acao: r.acao }); }
  return { responses: res, tables: dump() };
}

// --- capture (pre-split) ------------------------------------------------------------
if (WRITE_CAPTURE) {
  if (!pre) { console.error('--write-capture needs A6_PRE_SPLIT_SRC'); process.exit(2); }
  freshDb();
  const gets = {};
  for (const p of MOVED_GETS) { const r = await call(pre, envPre, 'GET', p); gets[p] = { status: r.status, json: r.json, acao: r.acao }; }
  const posts = await runPostSeq(pre, envPre);
  writeFileSync(CAPTURE, JSON.stringify({ captured_from: 'pre-split App/Ops/src/ops-api.js (origin/October-2026 c3c6e4a), MA-OCT-002a A6 build, Thu 22 Oct 2026', gets, posts }, null, 1) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), CAPTURE)}`);
}
const capture = JSON.parse(readFileSync(CAPTURE, 'utf8'));

// ================================ [routes] ================================
const ROUTES = [   // the 15 pre-split endpoints
  ['GET', '/api/ops/sprint-board', 'control'], ['GET', '/api/ops/release-ledger', 'control'], ['GET', '/api/ops/events', 'control'], ['GET', '/api/ops/drift', 'control'],
  ['POST', '/api/ops/admin/sprint-board', 'control'], ['POST', '/api/ops/admin/sprint-board/MA-T-001/stage', 'control'],
  ['POST', '/api/ops/admin/release-ledger', 'control'], ['POST', '/api/ops/admin/release-ledger/REL-T-001/event', 'control'],
  ['GET', '/api/ops/budget-risk', 'ops'], ['GET', '/api/ops/openfigi-status', 'ops'], ['GET', '/api/ops/cf/invocations?script=meridian-ops', 'ops'], ['GET', '/api/ops/cf/d1-today', 'ops'],
  ['GET', '/api/ops/admin/jobs', 'ops'], ['POST', '/api/ops/ingest/run-event', 'ops'], ['POST', '/api/ops/ingest/sweep', 'ops'],
];
// "Served" = the Worker's own handler answered (not 404 not-found, not the A6 redirect rule).
// Admin probes carry a valid JWT for that Worker's AUD with an empty body (a 400 still proves the route exists).
// Ingest probes run with OPS_INGEST_ENABLED/OPS_SWEEP_ENABLED = 'false' (202 before any D1 access).
freshDb();
const servedBy = { ops: [], control: [] };
for (const [m, p, owner] of ROUTES) {
  for (const [name, w, env, aud] of [['ops', ops, envOps, AUD_OPS], ['control', control, envControl, AUD_CONTROL]]) {
    const token = p.startsWith('/api/ops/admin/') ? await jwt({ email: 'founder@example.com', aud: [aud] }) : undefined;
    let r;
    try { r = await call(w, env, m, p, { body: m === 'POST' ? {} : undefined, token }); }
    catch (e) { r = { status: 'threw', json: String(e) }; }
    const notFound = r.status === 404 && r.json && /not found/.test(r.json.error || '');
    const redirected = r.status === 302;
    if (!notFound && !redirected) servedBy[name].push(`${m} ${p.split('?')[0]}`);
  }
}
const opsSet = new Set(servedBy.ops), ctlSet = new Set(servedBy.control);
check('[routes] of the 15 pre-split endpoints, meridian-ops serves exactly 7', opsSet.size === 7, servedBy.ops);
check('[routes] of the 15 pre-split endpoints, meridian-control serves exactly 8', ctlSet.size === 8, servedBy.control);
check('[routes] each pre-split route is served by exactly one Worker, as §13 assigns',
  ROUTES.every(([m, p, owner]) => { const k = `${m} ${p.split('?')[0]}`; return (owner === 'ops') ? (opsSet.has(k) && !ctlSet.has(k)) : (ctlSet.has(k) && !opsSet.has(k)); }),
  { ops: servedBy.ops, control: servedBy.control });
check('[routes] headroom at A6: 15 − 7 = 8 endpoints left on meridian-ops for 003/004 (003 adds 4 → 11)', 15 - opsSet.size === 8, opsSet.size);

// ================================ [redirect] ================================
for (const p of MOVED_GETS) {
  const r = await call(ops, envOps, 'GET', p);
  check(`[redirect] GET ${p} on meridian-ops → 302 to meridian-control, same path+query`,
    r.status === 302 && r.location === `https://meridian-control.navinmv1981.workers.dev${p}`, r);
  check(`[redirect] ${p}: ACAO '*' and no-store on the 302`, r.acao === '*' && r.cache === 'no-store', r);
}
const head = await call(ops, envOps, 'HEAD', '/api/ops/drift');
check('[redirect] HEAD is redirected too', head.status === 302 && head.location.endsWith('/api/ops/drift'), head);
const ovr = await call(ops, { ...envOps, CONTROL_BASE_URL: 'https://control.example/' }, 'GET', '/api/ops/events?limit=5');
check('[redirect] CONTROL_BASE_URL overrides the target (trailing slash trimmed)', ovr.location === 'https://control.example/api/ops/events?limit=5', ovr);
const opt = await call(ops, envOps, 'OPTIONS', '/api/ops/sprint-board');
check('[redirect] OPTIONS on a moved public path still answers 204 with CORS (preflight-safe)', opt.status === 204 && opt.acao === '*', opt);
const post301 = (await Promise.all(MOVED_GETS.map(p => call(ops, envOps, 'GET', p)))).every(r => r.status !== 301);
check('[redirect] never 301', post301, null);

// ================================ [parity] ================================
freshDb();
for (const p of MOVED_GETS) {
  const r1 = await call(ops, envOps, 'GET', p);
  const target = new URL(r1.location);
  const r2 = await call(control, envControl, 'GET', target.pathname + target.search);
  const c = capture.gets[p];
  check(`[parity] ${p}: after the redirect, status/body/CORS = pre-split capture`,
    r2.status === c.status && JSON.stringify(r2.json) === JSON.stringify(c.json) && r2.acao === c.acao, { now: r2, capture: c });
}
const seq = await runPostSeq(control, envControl);
check('[parity] 4 admin POSTs: responses (status, body) = pre-split, over 13 calls',
  JSON.stringify(seq.responses.map(r => [r.status, r.json])) === JSON.stringify(capture.posts.responses.map(r => [r.status, r.json])),
  seq.responses.map((r, i) => [r.p, r.status, capture.posts.responses[i].status]));
check('[parity] 4 admin POSTs: governance tables end identical to pre-split (incl. release_closed cascade)',
  JSON.stringify(seq.tables) === JSON.stringify(capture.posts.tables), null);
check('[parity] admin POST responses carry no CORS (as pre-split)', seq.responses.every(r => r.acao === null), seq.responses.map(r => r.acao));
if (pre) {   // live equivalence when the pre-split source is supplied
  const live = await runPostSeq(pre, envPre);
  check('[parity] live: pre-split handler run now matches the capture', JSON.stringify(live.tables) === JSON.stringify(capture.posts.tables), null);
}

// ================================ [auth] (001 AC4 on meridian-control) ================================
const AUTH_CASES = [
  ['no JWT', undefined, envControl],
  ['forged signature', await jwt({ email: 'founder@example.com' }, { forge: true }), envControl],
  ['wrong aud (meridian-ops AUD)', await jwt({ email: 'founder@example.com', aud: [AUD_OPS] }), envControl],
  ['expired', await jwt({ email: 'founder@example.com', exp: Math.floor(Date.now() / 1000) - 60 }), envControl],
  ['wrong iss', await jwt({ email: 'founder@example.com', iss: 'https://evil.test' }), envControl],
  ['unknown kid', await jwt({ email: 'founder@example.com' }, { kid: 'k9' }), envControl],
  ['malformed', 'abc.def', envControl],
  ['Access unconfigured (CF_ACCESS_AUD empty, as committed until Sat 24)', await jwt({ email: 'founder@example.com' }), { ...envControl, CF_ACCESS_AUD: '' }],
];
for (const [label, token, env] of AUTH_CASES) {
  for (const [p, b] of [POST_SEQ[0], POST_SEQ[3], POST_SEQ[7], POST_SEQ[8]]) {
    freshDb(); const before = govCounts();
    const r = await call(control, env, 'POST', p, { body: b, token });
    check(`[auth] ${label}: POST ${p} → 401, 0 rows`, r.status === 401 && govCounts() === before && r.acao === null, { r, before, after: govCounts() });
  }
}
freshDb();
let r = await call(control, envControl, 'POST', POST_SEQ[0][0], { body: POST_SEQ[0][1], token: await jwt({ email: 'founder@example.com' }) });
const ev = db.prepare(`SELECT payload FROM operationalevents WHERE ticket_id = 'MA-T-010'`).get();
check('[auth] valid user session → 200; actor = verified email (access_jwt) in the event payload',
  r.status === 200 && ev && JSON.parse(ev.payload).actor === 'founder@example.com' && JSON.parse(ev.payload).actor_source === 'access_jwt', { r, ev });
r = await call(control, envControl, 'POST', '/api/ops/admin/sprint-board/MA-T-001/stage', { body: { stage: 'RELEASE_READY', actor_role: 'Claude Code' }, token: await jwt({ common_name: 'abc123.access' }) });
const ev2 = db.prepare(`SELECT payload FROM operationalevents WHERE ticket_id = 'MA-T-001' ORDER BY event_id DESC LIMIT 1`).get();
check('[auth] valid service token → 200; actor = service:<common_name> (access_service_token)',
  r.status === 200 && JSON.parse(ev2.payload).actor === 'service:abc123.access' && JSON.parse(ev2.payload).actor_source === 'access_service_token', { r, ev2 });
r = await call(control, envControl, 'POST', '/api/ops/admin/nope', { body: {}, token: await jwt({ email: 'founder@example.com' }) });
check('[auth] unknown admin path with a valid JWT → 404', r.status === 404, r);
r = await call(control, envControl, 'GET', '/api/ops/admin/sprint-board', { token: await jwt({ email: 'founder@example.com' }) });
check('[auth] GET on an admin POST route → 404 (no reads through admin GET)', r.status === 404, r);

for (const [name, w, env] of [['meridian-control', control, envControl], ['meridian-ops', ops, envOps]]) {
  for (const p of ['/api/ops/sprint-board', '/api/ops/sprint-board/MA-T-001/stage', '/api/ops/release-ledger', '/api/ops/release-ledger/REL-T-001/event']) {
    freshDb(); const before = govCounts();
    const rr = await call(w, env, 'POST', p, { body: { ticket_id: 'X', stage: 'CLOSED', actor_role: 'x', event_type: 'release_closed', release_id: 'X', ticket_ids: [], change_summary: 'x', title: 'x', domain: 'x', lane: 'ops', owner_role: 'x' } });
    check(`[auth] ${name}: legacy anonymous POST ${p} → 401, 0 rows`, rr.status === 401 && govCounts() === before, { rr, before, after: govCounts() });
  }
}
for (const [p, b] of [POST_SEQ[0], POST_SEQ[3], POST_SEQ[7], POST_SEQ[8]]) {
  freshDb(); const before = govCounts();
  let rr = await call(ops, envOps, 'POST', p, { body: b });
  check(`[auth] meridian-ops: moved admin POST ${p} without JWT → 401, 0 rows`, rr.status === 401 && govCounts() === before, rr);
  rr = await call(ops, envOps, 'POST', p, { body: b, token: await jwt({ email: 'founder@example.com', aud: [AUD_OPS] }) });
  check(`[auth] meridian-ops: moved admin POST ${p} with a valid ops JWT → 404, 0 rows (no longer written here)`, rr.status === 404 && govCounts() === before, rr);
}

// ================================ [cors] ================================
freshDb();
for (const p of ['/api/ops/sprint-board', '/api/ops/release-ledger', '/api/ops/events', '/api/ops/drift']) {
  const rr = await call(control, envControl, 'GET', p);
  check(`[cors] meridian-control GET ${p} → 200, ACAO '*'`, rr.status === 200 && rr.acao === '*', rr);
}
let o = await call(control, envControl, 'OPTIONS', '/api/ops/admin/sprint-board');
check('[cors] meridian-control admin OPTIONS → 204 with no CORS allowances', o.status === 204 && o.acao === null, o);
o = await call(control, envControl, 'OPTIONS', '/api/ops/events');
check('[cors] meridian-control public OPTIONS → 204 with ACAO *', o.status === 204 && o.acao === '*', o);
const nf = await call(control, envControl, 'GET', '/api/ops/budget-risk');
check('[cors] a meridian-ops route asked of meridian-control → 404 (no accidental overlap)', nf.status === 404, nf);

// ================================ [writers] ================================
// One writer per table, per Worker bundle: meridian-ops = ops-api.js plus every module it imports
// (transitively, e.g. lateness.js today; 003's cases.js / sweep-ext.js after the Sat 24 rebase);
// meridian-control = control-api.js, which imports nothing.
const WRITE_RE = t => new RegExp(`(INSERT( OR IGNORE)? INTO|UPDATE|DELETE FROM)\\s+${t}\\b`, 'i');
function bundle(entry) {
  const seen = new Set(), todo = [entry];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of read(`src/${f}`).matchAll(/^\s*import\s[^'"]*['"]\.\/([^'"]+)['"]/gm)) todo.push(m[1]);
  }
  return seen;
}
const opsBundle = bundle('ops-api.js'), ctlBundle = bundle('control-api.js');
const srcFiles = readdirSync(path.join(OPS, 'src')).filter(f => f.endsWith('.js'));
const writers = t => srcFiles.filter(f => WRITE_RE(t).test(read(`src/${f}`)));
const OPS_TABLES = ['ops_job_registry', 'ops_job_run', 'ops_exception', 'ops_data_quality_ticket', 'ops_case_event', 'ops_job_pause'];
const GOV_TABLES = ['sprintboarditems', 'releaseledger', 'operationalevents'];
check('[writers] meridian-control bundle is control-api.js alone (imports nothing)', ctlBundle.size === 1 && ctlBundle.has('control-api.js'), [...ctlBundle]);
check('[writers] the two bundles share no file', [...opsBundle].every(f => !ctlBundle.has(f)), { ops: [...opsBundle], control: [...ctlBundle] });
for (const t of OPS_TABLES) { const w = writers(t); check(`[writers] ${t}: written only inside the meridian-ops bundle`, w.every(f => opsBundle.has(f)), { writers: w, opsBundle: [...opsBundle] }); }
for (const t of GOV_TABLES) { const w = writers(t); check(`[writers] ${t}: written only by control-api.js`, w.length === 1 && w[0] === 'control-api.js', w); }
check('[writers] control-api.js never mentions an ops_* table', !/\bops_[a-z_]+\b/.test(read('src/control-api.js').replace(/\/\/.*$/gm, '')), null);

console.log(`\ncontrol-split (A6): ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
