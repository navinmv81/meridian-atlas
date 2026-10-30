#!/usr/bin/env node
// MA-OCT-005 test 4 (spec rev 0 §10.4, AC-14; Ops review M-1, M-6, N-6, N-7): GET /api/ops/admin/console on the REAL
// ops-api.js. 401 without a JWT and with a wrong AUD, 0 D1 calls; with the Founder's JWT a no-store HTML shell whose CSP
// is exactly the M-1 policy (script-src = the Pages path + nonce; style-src 'unsafe-inline' with NO nonce); every inline
// script nonce'd; ma-data.js then ma-ops.js from the Pages path; service tokens 403 before D1 (human-only); the boot
// script shows the "2 Nov release" message when the loaded ma-ops.js predates 005 (M-6). Also counts meridian-ops
// endpoints: exactly 15 answer, an unknown admin path is 404.   No network, no D1 file.   Usage: node App/Ops/tests/console-shell.mjs

import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };

const db = new DatabaseSync(':memory:');
for (const m of ['002-ops-control-plane.sql', '003-ops-job-pause.sql', '004-ops-cases.sql', '005-ops-dq.sql']) db.exec(read(`migrations/${m}`));
let d1Calls = 0;
function stmt(sql, args = []) {
  return { bind: (...a) => stmt(sql, a),
    async all() { d1Calls++; const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; },
    async first() { d1Calls++; return db.prepare(sql).get(...args) ?? null; },
    async run() { d1Calls++; const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; } };
}
const DB = { prepare: sql => stmt(sql), async batch(ss) { d1Calls++; return Promise.all(ss.map(s => s.all())); } };

const TEAM = 'test-team.cloudflareaccess.com', AUD = 'aud-test-0000';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k', alg: 'RS256' };
globalThis.fetch = async u => (String(u) === `https://${TEAM}/cdn-cgi/access/certs` ? new Response(JSON.stringify({ keys: [jwk] })) : new Response('{}', { status: 599 }));
const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function jwt(claims) {
  const h = b64({ alg: 'RS256', kid: 'k' }), p = b64({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${Buffer.from(sig).toString('base64url')}`;
}
const FOUNDER = await jwt({ email: 'founder@example.test' }), WRONG = await jwt({ email: 'x@example.test', aud: ['nope'] });
const SVC_OPS = await jwt({ common_name: 'ops-client.access' }), SVC_BOND = await jwt({ common_name: 'bond-client.access' });
const ACTORS = JSON.stringify({ 'ops-client.access': { label: 'ops-script', routes: ['E-1', 'E-2', 'C-1', 'C-2'], actions: { EXC: ['comment'], DQ: ['comment'] } },
                                'bond-client.access': { label: 'bond-runner', routes: ['D-2'], types: ['missing_entity'] } });
const { default: worker } = await import('../src/ops-api.js');
const ENV = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OPS_CASES_ENABLED: 'true', OPS_SERVICE_ACTORS: ACTORS, OPS_SWEEP_ENABLED: 'false', OPS_INGEST_ENABLED: 'false' };
async function call(method, path, token, body) {
  const before = d1Calls;
  const r = await worker.fetch(new Request(`https://meridian-ops.test${path}`, { method, headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), 'Content-Type': 'application/json', 'X-Ops-Client': 'console' },
                                                                               body }), ENV, { waitUntil() {} });
  return { status: r.status, h: r.headers, text: await r.text(), d1: d1Calls - before };
}
const C = '/api/ops/admin/console';

// --- AC-14: auth before anything ---------------------------------------------------------------
const a = await call('GET', C, null), b = await call('GET', C, WRONG);
check('[AC-14] no JWT → 401, wrong AUD → 401; 0 D1 calls; no CORS', a.status === 401 && b.status === 401 && a.d1 === 0 && b.d1 === 0 && !a.h.get('access-control-allow-origin'), [a.status, b.status]);
const s1 = await call('GET', C, SVC_OPS), s2 = await call('GET', C, SVC_BOND);
check('[N-6] service tokens (ops-script, bond-runner) → 403 before D1: the console is human-only', s1.status === 403 && s2.status === 403 && s1.d1 === 0 && s2.d1 === 0, [s1.text, s2.text]);
const p = await call('POST', C, FOUNDER, '{}');
check('[§4.2] POST to the console path → 404 (one GET page route only)', p.status === 404, p.status);

// --- the shell ------------------------------------------------------------------------------------
const ok = await call('GET', C, FOUNDER);
const csp = ok.h.get('content-security-policy') || '';
const nonce = (/'nonce-([A-Za-z0-9_-]+)'/.exec(csp) || [])[1];
check('[AC-14] 200 text/html, Cache-Control no-store, nosniff, no-referrer, 0 D1 calls', ok.status === 200 && /^text\/html/.test(ok.h.get('content-type')) && ok.h.get('cache-control') === 'no-store'
  && ok.h.get('x-content-type-options') === 'nosniff' && ok.h.get('referrer-policy') === 'no-referrer' && ok.d1 === 0, { s: ok.status, d1: ok.d1 });
check('[M-1] CSP exactly: script-src = https://navinmv81.github.io/meridian-atlas/ + nonce; style-src \'unsafe-inline\' with no nonce; connect-src self + control + proxy',
  csp === `default-src 'none'; script-src https://navinmv81.github.io/meridian-atlas/ 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self' https://meridian-control.navinmv1981.workers.dev https://meridian-proxy.navinmv1981.workers.dev; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
  && nonce && nonce.length >= 20, csp);
const scripts = [...ok.text.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({ attrs: m[1], body: m[2] }));
const inline = scripts.filter(s => !/src=/.test(s.attrs)), ext = scripts.filter(s => /src=/.test(s.attrs));
check('[M-1] every inline script carries the nonce; the flag script runs before the two Pages scripts, ma-data.js before ma-ops.js',
  inline.length === 2 && inline.every(s => s.attrs.includes(`nonce="${nonce}"`)) && ext.map(s => /src="([^"]+)"/.exec(s.attrs)[1]).join() === 'https://navinmv81.github.io/meridian-atlas/ma-data.js,https://navinmv81.github.io/meridian-atlas/ma-ops.js'
  && scripts[0].body.includes('window.MA_OPS_CONSOLE = true'), scripts.map(s => s.attrs));
check('[M-1] no inline event handler attributes and no style nonce in the shell', !/\son[a-z]+=/i.test(ok.text) && !/<style[^>]*nonce/.test(ok.text), null);
const again = await call('GET', C, FOUNDER);
check('[§4.2] a fresh nonce per response', !(again.h.get('content-security-policy') || '').includes(nonce), null);

// --- M-6: the boot script ------------------------------------------------------------------------
const boot = inline[1].body;
function runBoot(supported) {
  let opened = null;
  const msg = { textContent: 'Loading the operator console…', removed: false, remove() { this.removed = true; } };
  const ctx = { document: { getElementById: () => msg }, window: {} };
  ctx.window = ctx;
  if (supported) { ctx.OPS_CONSOLE_SUPPORTED = true; ctx.openOps = o => { opened = o; }; }
  vm.createContext(ctx); vm.runInContext(boot, ctx);
  return { opened, msg };
}
const old = runBoot(false), now = runBoot(true);
check('[M-6] with a pre-005 ma-ops.js (no OPS_CONSOLE_SUPPORTED): "arrives with the 2 Nov release", nothing opened', /arrives with the 2 Nov release/.test(old.msg.textContent) && old.opened === null, old.msg.textContent);
check('[M-6] with the 005 ma-ops.js: openOps({ console: true }) and the loading line removed', now.opened && now.opened.console === true && now.msg.removed, now.opened);
const fe = readFileSync(new URL('../../ma-ops.js', import.meta.url), 'utf8');
check('[M-6] the 005 ma-ops.js sets window.OPS_CONSOLE_SUPPORTED = true and reads window.MA_OPS_CONSOLE', /window\.OPS_CONSOLE_SUPPORTED = true;/.test(fe) && /window\.MA_OPS_CONSOLE === true/.test(fe), null);

// --- endpoint count (Task item 2: report it) ----------------------------------------------------------
// One case exists so C-1 answers 200; a 404 then always means "no route". The two public ETF reads may 500
// here (this D1 has no ETF tables) — routed all the same.
db.exec(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, raised_by, raised_via, dedupe_key)
         VALUES ('EXC-S-000000000001', 'manual', 'sev3', 'open', 't', 'x@example.test', 'ops_console', 'seed:1')`);
const ENDPOINTS = [
  ['GET', '/api/ops/budget-risk', null], ['GET', '/api/ops/openfigi-status', null], ['GET', '/api/ops/cf/invocations?script=meridian-holdings', null], ['GET', '/api/ops/cf/d1-today', null],
  ['POST', '/api/ops/ingest/run-event', null], ['POST', '/api/ops/ingest/sweep', null], ['GET', '/api/ops/admin/jobs', FOUNDER],
  ['GET', '/api/ops/admin/exceptions', FOUNDER], ['POST', '/api/ops/admin/exceptions', FOUNDER], ['GET', '/api/ops/admin/cases/EXC-S-000000000001', FOUNDER],
  ['POST', '/api/ops/admin/cases/EXC-S-000000000001/action', FOUNDER], ['GET', '/api/ops/admin/dq-tickets', FOUNDER], ['POST', '/api/ops/admin/dq-tickets', FOUNDER],
  ['GET', '/api/ops/admin/dq/new?type=missing_mapping&domain=entities&key=US0378331005&via=nav-007', FOUNDER], ['GET', C, FOUNDER]
];
const answered = [];
for (const [m, path, tok] of ENDPOINTS) {
  let r;
  try { r = await call(m, path, tok, m === 'POST' ? '{}' : undefined); } catch (e) { r = { status: 'throw ' + e.message, text: '' }; }
  answered.push([m, path.split('?')[0], r.status]);
}
const unknown = await call('GET', '/api/ops/admin/nothing-here', FOUNDER);
const unknownPublic = await call('GET', '/api/ops/nothing-here', null);
check('[Task 2] meridian-ops endpoints: all 15 answer with a non-404; unknown admin and public paths → 404 → 15 of 15, 0 headroom',
  answered.length === 15 && answered.every(x => x[2] !== 404) && unknown.status === 404 && unknownPublic.status === 404, answered);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
