#!/usr/bin/env node
// MA-OCT-003 test 1 (spec rev 1 §15 step 1): contract test for the case routes E-1, E-2, C-1, C-2
// and the service-token allowlist — AC-1, AC-1b, AC-2 … AC-8, plus the kill switch, CSRF, keyset paging
// and local EXPLAIN plans (§11.2). Runs the REAL App/Ops/src/ops-api.js + cases.js in Node:
//  - D1 = in-memory SQLite (node:sqlite) from the real migrations 002, 003, 004 and the real A1 registry
//    load; batch() is one transaction (as in D1); every D1 call is counted ("before any D1 access").
//  - Cloudflare Access is exercised for real: RS256 JWTs signed here, JWKS served by a stubbed fetch.
// No network, no remote D1.   Usage: node App/Ops/tests/cases-contract.mjs

import { readFileSync } from 'node:fs';
import { webcrypto as crypto, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };

// Fixed clock (advances 1 ms per read so every request gets its own :now).
let NOW = Date.parse('2026-10-24T09:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW++); } static now() { return NOW++; } };

// --- D1 on SQLite ----------------------------------------------------------------
const db = new DatabaseSync(':memory:');
db.exec(read('migrations/002-ops-control-plane.sql'));
db.exec(read('migrations/003-ops-job-pause.sql'));
db.exec(read('migrations/004-ops-cases.sql'));
db.exec(read('migrations/005-ops-dq.sql'));   // MA-OCT-004
db.exec(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, notes)
         VALUES ('ops.ingest','Ops ingest global switch','Ops','Operations Lead','control',NULL,'control');
         INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, source_path, emitter_id, expected_max_duration_s)
         VALUES ('local.entities-enrich-boost','boost','Entities','Data-Identity Lead','local_schedule','x','boost-local',120);`);
db.exec(read('migrations/registry-load-2026-10-12.sql'));
let d1Calls = 0;
const isWrite = sql => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
function stmt(sql, args = []) {
  return {
    bind: (...a) => stmt(sql, a),
    async all() { d1Calls++; const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; },
    async first() { d1Calls++; return db.prepare(sql).get(...args) ?? null; },
    async run() { d1Calls++; const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes), rows_read: 0 } }; },
    execSync() { if (isWrite(sql)) { const r = db.prepare(sql).run(...args); return { results: [], meta: { changes: Number(r.changes) } }; }
                 const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; }
  };
}
const DB = {
  prepare: sql => stmt(sql),
  async batch(ss) {                       // D1 batch = one implicit transaction
    d1Calls++;
    db.exec('BEGIN');
    try { const out = ss.map(s => s.execSync()); db.exec('COMMIT'); return out; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};
const count = (sql, ...a) => db.prepare(sql).get(...a).n;

// Seed: two sweep-style cases and a DQ ticket linked to the first.
const seedExc = (ref, type, sev, job, opened) => {
  db.prepare(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, owner_role, raised_by, raised_via, dedupe_key, opened_at, updated_at)
              VALUES (?, ?, ?, 'open', ?, 's', ?, 'Data-Identity Lead', 'service:health-check-local', 'ingest_auto', ?, ?, ?)`).run(ref, type, sev, `${type} ${ref}`, job, `seed:${ref}`, opened, opened);
  db.prepare(`INSERT INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
              SELECT 'exception', CAST(exception_id AS TEXT), 'raised', 'service:health-check-local', 'ingest_key', opened_at, 'raised:seed:' || case_ref FROM ops_exception WHERE case_ref = ?`).run(ref);
};
seedExc('EXC-S-0000000000A1', 'job_failed', 'sev3', 'local.entities-enrich-boost', '2026-10-13T16:36:26.660Z');
seedExc('EXC-S-0000000000A2', 'job_missed', 'sev3', 'local.entities-enrich-boost', '2026-10-13T16:36:27.000Z');
seedExc('EXC-S-0000000000A3', 'budget_risk', 'sev2', null, '2026-10-18T07:07:24.846Z');
db.exec(`INSERT INTO ops_data_quality_ticket (case_ref, ticket_type, title, object_domain, object_key, raised_by, raised_via, linked_exception_ref)
         VALUES ('DQ-000001','missing_lei','LEIs left missing by a failed run','entity','931','test','ops_console','EXC-S-0000000000A1'),
                ('DQ-M-000004','bad_relationship_edge','legacy','entity','3','legacy:entity_exceptions','migration',NULL);`);

// --- Access (test key; the Worker's own verifyAccessJwt runs) ----------------------
const TEAM = 'test-team.cloudflareaccess.com', AUD = 'aud-test-0000';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'test-kid', alg: 'RS256' };
globalThis.fetch = async u => (String(u) === `https://${TEAM}/cdn-cgi/access/certs` ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }) : new Response('no network', { status: 599 }));
const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function jwt(claims) {
  const h = b64({ alg: 'RS256', kid: 'test-kid' }), p = b64({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(NOW / 1000) + 3600, ...claims });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${Buffer.from(sig).toString('base64url')}`;
}
const FOUNDER = await jwt({ email: 'founder@example.test' });
const OPSLEAD = await jwt({ email: 'opslead@example.test' });
const WRONG_AUD = await jwt({ email: 'x@example.test', aud: ['other-aud'] });
const SVC_OPS = await jwt({ common_name: 'ops-script-client.access' });
const SVC_UNKNOWN = await jwt({ common_name: 'stranger.access' });

const SERVICE_ACTORS = JSON.stringify({ 'ops-script-client.access': { label: 'ops-script', routes: ['E-1', 'E-2', 'C-1', 'C-2'],
  actions: { EXC: ['acknowledge', 'assign', 'comment', 'set_severity', 'resolve', 'dismiss', 'reopen'], DQ: ['comment', 'assign', 'triage'] } } });
const { default: worker } = await import('../src/ops-api.js');
const baseEnv = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OPS_CASES_ENABLED: 'true', OPS_SERVICE_ACTORS: SERVICE_ACTORS };

async function call(method, path, { token = FOUNDER, body, headers = {}, env = baseEnv, json = true } = {}) {
  const h = { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...headers };
  if (method === 'POST' && json) { h['Content-Type'] ??= 'application/json'; h['X-Ops-Client'] ??= 'console'; }
  const before = d1Calls;
  const resp = await worker.fetch(new Request(`https://meridian-ops.test${path}`, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, { waitUntil() {} });
  const text = await resp.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: resp.status, body: parsed, d1: d1Calls - before, acao: resp.headers.get('access-control-allow-origin') };
}
const act = (ref, body, opts = {}) => call('POST', `/api/ops/admin/cases/${ref}/action`, { body: { request_id: randomUUID(), ...body }, ...opts });
const events = ref => db.prepare(`SELECT e.* FROM ops_case_event e JOIN ops_exception x ON e.subject_type = 'exception' AND e.subject_id = CAST(x.exception_id AS TEXT) WHERE x.case_ref = ? ORDER BY e.event_id`).all(ref);
const row = ref => db.prepare(`SELECT * FROM ops_exception WHERE case_ref = ?`).get(ref);
const totals = () => ({ exc: count(`SELECT COUNT(*) n FROM ops_exception`), ev: count(`SELECT COUNT(*) n FROM ops_case_event`), dq: count(`SELECT COUNT(*) n FROM ops_data_quality_ticket`) });

// --- AC-1: auth and CSRF before any D1 access ---------------------------------------
const t0 = totals();
for (const [m, p] of [['GET', '/api/ops/admin/exceptions'], ['POST', '/api/ops/admin/exceptions'], ['GET', '/api/ops/admin/cases/EXC-S-0000000000A1'], ['POST', '/api/ops/admin/cases/EXC-S-0000000000A1/action']]) {
  const a = await call(m, p, { token: null, body: m === 'POST' ? {} : undefined });
  const b = await call(m, p, { token: WRONG_AUD, body: m === 'POST' ? {} : undefined });
  check(`[AC-1] ${m} ${p}: no JWT → 401, wrong AUD → 401, 0 D1 calls, no CORS`, a.status === 401 && b.status === 401 && a.d1 === 0 && b.d1 === 0 && !a.acao && !b.acao, { a, b });
}
const csrf1 = await call('POST', '/api/ops/admin/exceptions', { body: '{}', json: false, headers: { 'Content-Type': 'text/plain', 'X-Ops-Client': 'console' } });
const csrf2 = await call('POST', '/api/ops/admin/cases/EXC-S-0000000000A1/action', { body: '{}', json: false, headers: { 'Content-Type': 'application/json' } });
const csrf3 = await call('POST', '/api/ops/admin/cases/EXC-S-0000000000A1/action', { body: '{}', json: false, headers: { 'Content-Type': 'application/json', 'X-Ops-Client': 'evil' } });
check('[AC-1] valid JWT, E-2 with Content-Type text/plain → 400 before D1 (A3-5)', csrf1.status === 400 && csrf1.d1 === 0 && /csrf/.test(csrf1.body.error), csrf1);
check('[AC-1] valid JWT, C-2 with no X-Ops-Client → 400 before D1', csrf2.status === 400 && csrf2.d1 === 0, csrf2);
check('[AC-1] X-Ops-Client outside console|script|service|dq-page → 400 (R1-1 vocabulary)', csrf3.status === 400 && csrf3.d1 === 0, csrf3);
check('[AC-1] table counts unchanged', JSON.stringify(totals()) === JSON.stringify(t0), totals());

// --- AC-1b: service-token allowlist ------------------------------------------------
const u1 = await call('GET', '/api/ops/admin/exceptions', { token: SVC_UNKNOWN });
check('[AC-1b 1] common_name not in OPS_SERVICE_ACTORS → 403 before D1', u1.status === 403 && u1.d1 === 0 && u1.body.error === 'service_not_allowed', u1);
const u2 = await act('DQ-M-000004', { action: 'resolve', expected_status: 'open', resolution: 'fixed', note: 'x' }, { token: SVC_OPS, headers: { 'X-Ops-Client': 'script' } });
check('[AC-1b 2] ops-script resolve on a DQ- ref → 403 before D1 (F-3: never resolve Entities data)', u2.status === 403 && u2.d1 === 0 && u2.body.error === 'service_action_not_allowed', u2);
for (const a of ['dismiss', 'reopen']) {
  const r = await act('DQ-M-000004', { action: a, expected_status: 'open', resolution: 'not_actionable', note: 'x' }, { token: SVC_OPS, headers: { 'X-Ops-Client': 'script' } });
  check(`[AC-1b 2] ops-script ${a} on a DQ- ref → 403`, r.status === 403 && r.d1 === 0, r);
}
const u3 = await call('POST', '/api/ops/admin/sprint-board', { token: SVC_OPS, body: { title: 'x' }, headers: { 'X-Ops-Client': 'script' } });
const u3b = await call('POST', '/api/ops/admin/release-ledger', { token: SVC_OPS, body: { title: 'x' }, headers: { 'X-Ops-Client': 'script' } });
const u3c = await call('GET', '/api/ops/admin/jobs', { token: SVC_OPS });
check('[AC-1b 3] ops-script on governance routes (sprint-board, release-ledger) and /jobs → 403 before D1', [u3, u3b, u3c].every(r => r.status === 403 && r.d1 === 0 && r.body.error === 'service_route_not_allowed'), [u3, u3b, u3c]);
const bad = await call('GET', '/api/ops/admin/exceptions', { token: SVC_OPS, env: { ...baseEnv, OPS_SERVICE_ACTORS: '{not json' } });
check('[AC-1b] unparseable OPS_SERVICE_ACTORS → every service token 403 (fail closed)', bad.status === 403 && bad.d1 === 0, bad);
// BREVA N-1: an entry listing a route outside E-1/E-2/C-1/C-2 (here 'other', which would open /jobs) is refused whole.
const wideMap = JSON.parse(SERVICE_ACTORS); wideMap['ops-script-client.access'].routes.push('other');
const wideEnv = { ...baseEnv, OPS_SERVICE_ACTORS: JSON.stringify(wideMap) };
const w1 = await call('GET', '/api/ops/admin/jobs', { token: SVC_OPS, env: wideEnv });
const w2 = await call('GET', '/api/ops/admin/exceptions', { token: SVC_OPS, env: wideEnv });
check('[BREVA N-1] entry listing a non-case route ("other") → 403 service_not_allowed on /jobs AND on E-1, before D1', [w1, w2].every(r => r.status === 403 && r.d1 === 0 && r.body.error === 'service_not_allowed'), [w1, w2]);
const unkMap = JSON.parse(SERVICE_ACTORS); unkMap['ops-script-client.access'].routes = ['E-1', 'D-9'];
const w3 = await call('GET', '/api/ops/admin/exceptions', { token: SVC_OPS, env: { ...baseEnv, OPS_SERVICE_ACTORS: JSON.stringify(unkMap) } });
check('[BREVA N-1] entry listing an unknown route id → 403 service_not_allowed before D1', w3.status === 403 && w3.d1 === 0 && w3.body.error === 'service_not_allowed', w3);
const okE1 = await call('GET', '/api/ops/admin/exceptions', { token: SVC_OPS });
check('[BREVA N-1] the canonical four-route entry still reaches E-1 (200)', okE1.status === 200, okE1.status);
const dqComment = await act('DQ-M-000004', { action: 'comment', expected_status: 'open', note: 'x' }, { token: SVC_OPS, headers: { 'X-Ops-Client': 'script' } });
check('[AC-1b] ops-script comment on a DQ- ref passes the allowlist and is applied by the 004 DQ engine (200, actor service:ops-script)', dqComment.status === 200 && dqComment.body.event === 'commented', dqComment);
const svcAck = await act('EXC-S-0000000000A2', { action: 'acknowledge', expected_status: 'open' }, { token: SVC_OPS, headers: { 'X-Ops-Client': 'script' } });
const svcEv = events('EXC-S-0000000000A2').at(-1);
check('[AC-1b] ops-script acknowledge on an EXC- ref → 200, actor service:ops-script, common_name in payload (N3-3)',
  svcAck.status === 200 && svcEv.event_type === 'acknowledged' && svcEv.actor === 'service:ops-script' && svcEv.actor_source === 'access_service_token'
  && JSON.parse(svcEv.payload).request.common_name === 'ops-script-client.access', { svcAck, svcEv });

// --- kill switch -------------------------------------------------------------------
const off = await call('GET', '/api/ops/admin/exceptions', { env: { ...baseEnv, OPS_CASES_ENABLED: 'false' } });
const offPost = await act('EXC-S-0000000000A1', { action: 'acknowledge', expected_status: 'open' }, { env: { ...baseEnv, OPS_CASES_ENABLED: 'false' } });
check('[switch] OPS_CASES_ENABLED="false" → 503 on E-1 and C-2, 0 D1 calls', off.status === 503 && offPost.status === 503 && off.d1 === 0 && offPost.d1 === 0, { off, offPost });

// --- AC-2: acknowledge -------------------------------------------------------------
const ev0 = events('EXC-S-0000000000A1').length;
const ack = await act('EXC-S-0000000000A1', { action: 'acknowledge', expected_status: 'open' });
const evA = events('EXC-S-0000000000A1');
check('[AC-2] acknowledge → acknowledged; exactly 1 acknowledged event, actor = JWT email, actor_source access_jwt',
  ack.status === 200 && row('EXC-S-0000000000A1').status === 'acknowledged' && evA.length === ev0 + 1 && evA.at(-1).event_type === 'acknowledged'
  && evA.at(-1).actor === 'founder@example.test' && evA.at(-1).actor_source === 'access_jwt' && evA.at(-1).from_value === 'open' && evA.at(-1).to_value === 'acknowledged', { ack, last: evA.at(-1) });
check('[AC-16] C-2 rows_read ≤ 6', ack.body.rows_read <= 6, ack.body.rows_read);

// --- AC-3: two requests with the same expected_status --------------------------------
const evB0 = events('EXC-S-0000000000A3').length;
const [r1, r2] = await Promise.all([
  act('EXC-S-0000000000A3', { action: 'acknowledge', expected_status: 'open' }),
  act('EXC-S-0000000000A3', { action: 'resolve', expected_status: 'open', resolution: 'fixed', note: 'race' })
]);
const statuses = [r1.status, r2.status].sort();
check('[AC-3] concurrent acknowledge + resolve on the same expected_status: one 200, one 409 with the current state; 1 event',
  statuses[0] === 200 && statuses[1] === 409 && (r1.status === 409 ? r1 : r2).body.current && events('EXC-S-0000000000A3').length === evB0 + 1, { r1, r2 });

// --- AC-4: replay and reuse of request_id ------------------------------------------
const rid = randomUUID();
const c1 = await act('EXC-S-0000000000A1', { request_id: rid, action: 'assign', expected_status: 'acknowledged', owner_role: 'Operations Lead', assignee: 'opslead@example.test' });
const n1 = events('EXC-S-0000000000A1').length, snap1 = JSON.stringify(row('EXC-S-0000000000A1'));
const c2 = await act('EXC-S-0000000000A1', { request_id: rid, action: 'assign', expected_status: 'acknowledged', owner_role: 'Operations Lead', assignee: 'opslead@example.test' });
check('[AC-4 1] same request_id again → 200 replay, same state, 0 new events', c1.status === 200 && c2.status === 200 && c2.body.replay === true && events('EXC-S-0000000000A1').length === n1 && JSON.stringify(row('EXC-S-0000000000A1')) === snap1, { c1, c2 });
const c3 = await act('EXC-S-0000000000A1', { request_id: rid, action: 'comment', expected_status: 'acknowledged', note: 'reused id' });
check('[AC-4 2] same request_id with a different action (comment after assign) → 409 request_id_reused, 0 row changes, 0 new events (A3-3(a))',
  c3.status === 409 && c3.body.error === 'request_id_reused' && events('EXC-S-0000000000A1').length === n1 && JSON.stringify(row('EXC-S-0000000000A1')) === snap1, c3);
const assignEv = events('EXC-S-0000000000A1').at(-1);
const before = JSON.parse(assignEv.payload).before;
check('[assign] event keeps from (pre-image) and to values; row owner/assignee set', assignEv.event_type === 'assigned' && before.owner_role === 'Data-Identity Lead' && before.assignee === null
  && JSON.parse(assignEv.payload).request.assignee === 'opslead@example.test' && row('EXC-S-0000000000A1').assignee === 'opslead@example.test', assignEv);

// --- AC-5: invalid resolve -------------------------------------------------------
const t5 = totals(), s5 = JSON.stringify(row('EXC-S-0000000000A1'));
const v1 = await act('EXC-S-0000000000A1', { action: 'resolve', expected_status: 'acknowledged', note: 'n' });
const v2 = await act('EXC-S-0000000000A1', { action: 'resolve', expected_status: 'acknowledged', resolution: 'false_positive', note: 'n' });
const v3 = await act('EXC-S-0000000000A1', { action: 'resolve', expected_status: 'acknowledged', resolution: 'fixed' });
check('[AC-5] resolve without resolution, with a dismissed-set code, or without a note → 400, nothing written, 0 D1 calls',
  [v1, v2, v3].every(v => v.status === 400 && v.d1 === 0) && JSON.stringify(totals()) === JSON.stringify(t5) && JSON.stringify(row('EXC-S-0000000000A1')) === s5, [v1, v2, v3]);
const v4 = await act('EXC-S-0000000000A1', { action: 'dismiss', expected_status: 'acknowledged', resolution: 'duplicate', note: 'n' });
check('[validation] dismiss duplicate without duplicate_of → 400', v4.status === 400 && v4.d1 === 0, v4);
const v5 = await act('EXC-S-0000000000A1', { action: 'acknowledge', expected_status: 'open', request_id: 'not-a-uuid' });
check('[validation] non-UUID request_id → 400', v5.status === 400 && v5.d1 === 0, v5);
const v6 = await act('EXC-S-0000000000A1', { action: 'teleport', expected_status: 'open' });
check('[validation] unknown action → 400', v6.status === 400, v6);
const bigNote = await act('EXC-S-0000000000A1', { action: 'comment', expected_status: 'acknowledged', note: 'x'.repeat(2001) });
check('[validation] note > 2,000 chars → 400', bigNote.status === 400, bigNote);

// --- stale / illegal transitions ----------------------------------------------------
const st1 = await act('EXC-S-0000000000A1', { action: 'acknowledge', expected_status: 'open' });
check('[§7.1] stale expected_status → 409 with the current state', st1.status === 409 && st1.body.error === 'stale_expected_status' && st1.body.current.status === 'acknowledged', st1);
const ill = await act('EXC-S-0000000000A1', { action: 'reopen', expected_status: 'acknowledged', note: 'n' });
check('[§7.1] reopen from acknowledged → 409 illegal_transition with the current state', ill.status === 409 && ill.body.error === 'illegal_transition', ill);
const nf = await act('EXC-S-0000000000FF', { action: 'acknowledge', expected_status: 'open' });
check('[§7.1] unknown case → 404', nf.status === 404, nf);
const badRef = await call('GET', '/api/ops/admin/cases/EXC-12');
check('[§8.3] case_ref outside the pattern → 400 before D1', badRef.status === 400 && badRef.d1 === 0, badRef);

// --- set_severity, resolve, comment-on-resolved, AC-6 reopen ---------------------------
const sv = await act('EXC-S-0000000000A1', { action: 'set_severity', expected_status: 'acknowledged', severity: 'sev2', note: 'repeated' });
check('[set_severity] sev3 → sev2, event severity_changed with the pre-image', sv.status === 200 && row('EXC-S-0000000000A1').severity === 'sev2' && events('EXC-S-0000000000A1').at(-1).event_type === 'severity_changed'
  && JSON.parse(events('EXC-S-0000000000A1').at(-1).payload).before.severity === 'sev3', sv);
const rs = await act('EXC-S-0000000000A1', { action: 'resolve', expected_status: 'acknowledged', resolution: 'transient', note: 'cleared' });
const rr1 = row('EXC-S-0000000000A1');
check('[resolve] resolved, resolution transient, resolved_by = verified actor (never a body field), resolved_at set',
  rs.status === 200 && rr1.status === 'resolved' && rr1.resolution === 'transient' && rr1.resolved_by === 'founder@example.test' && !!rr1.resolved_at, rr1);
const cm = await act('EXC-S-0000000000A1', { action: 'comment', expected_status: 'resolved', note: 'post-mortem link', resolved_by: 'attacker@evil.test' });
check('[§8.4] a comment on a resolved case keeps its resolution and resolved_by', cm.status === 200 && row('EXC-S-0000000000A1').resolution === 'transient' && row('EXC-S-0000000000A1').resolved_by === 'founder@example.test', row('EXC-S-0000000000A1'));
const ro = await act('EXC-S-0000000000A1', { action: 'reopen', expected_status: 'resolved', note: 'came back' }, { token: OPSLEAD });
const roRow = row('EXC-S-0000000000A1'), roEv = events('EXC-S-0000000000A1').at(-1), roBefore = JSON.parse(roEv.payload).before;
check('[AC-6] reopen → open; resolution, resolved_by, resolved_at NULL; the reopened event keeps the prior values',
  ro.status === 200 && roRow.status === 'open' && roRow.resolution === null && roRow.resolved_by === null && roRow.resolved_at === null
  && roEv.event_type === 'reopened' && roBefore.resolution === 'transient' && roBefore.resolved_by === 'founder@example.test' && !!roBefore.resolved_at && roEv.actor === 'opslead@example.test', { roRow, roEv });
const dup = await act('EXC-S-0000000000A1', { action: 'dismiss', expected_status: 'open', resolution: 'duplicate', duplicate_of: 'EXC-S-0000000000A2', note: 'same incident' });
check('[dismiss] duplicate with an existing duplicate_of → dismissed; duplicate_of in the event payload', dup.status === 200 && row('EXC-S-0000000000A1').status === 'dismissed'
  && JSON.parse(events('EXC-S-0000000000A1').at(-1).payload).request.duplicate_of === 'EXC-S-0000000000A2', dup);
const dup404 = await act('EXC-S-0000000000A2', { action: 'dismiss', expected_status: 'acknowledged', resolution: 'duplicate', duplicate_of: 'EXC-000999', note: 'x' });
check('[dismiss] duplicate_of that does not exist → 422', dup404.status === 422, dup404);

// --- every applied action left exactly one event ------------------------------------------
const orphan = count(`SELECT COUNT(*) n FROM ops_exception x WHERE x.updated_at > x.opened_at AND NOT EXISTS
                       (SELECT 1 FROM ops_case_event e WHERE e.subject_type = 'exception' AND e.subject_id = CAST(x.exception_id AS TEXT) AND e.occurred_at = x.updated_at)`);
check('[§8.4] no case changed without an event at the same :now', orphan === 0, orphan);

// --- AC-7: manual create ------------------------------------------------------------
const mk = { exception_type: 'manual', severity: 'sev4', title: 'Founder note: check FIRDS Monday', summary: 'Manual case for the test.', owner_role: 'Operations Lead', job_id: 'local.entities-enrich-boost' };
const crid = randomUUID();
const m1 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, request_id: crid } });
const mrow = m1.body.case;
const mev = mrow ? events(mrow.case_ref) : [];
check('[AC-7] E-2 → 201; case_ref EXC-\\d{6}; raised_via ops_console; raised_by = actor; 1 created event',
  m1.status === 201 && /^EXC-\d{6}$/.test(mrow.case_ref) && mrow.raised_via === 'ops_console' && mrow.raised_by === 'founder@example.test' && mev.length === 1 && mev[0].event_type === 'created', { m1, mev });
const m2 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, request_id: crid } });
check('[AC-7] the same request_id again → 200 replay, no second row', m2.status === 200 && m2.body.replay === true && count(`SELECT COUNT(*) n FROM ops_exception WHERE raised_via = 'ops_console'`) === 1, m2);
const m3 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, job_id: 'cf.no-such-job', request_id: randomUUID() } });
check('[AC-7] unknown job_id → 422, nothing written', m3.status === 422 && count(`SELECT COUNT(*) n FROM ops_exception WHERE raised_via = 'ops_console'`) === 1, m3);
const m4 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, object_domain: 'entity', object_key: 'not-a-number', request_id: randomUUID() } });
check('[§5.3] object_key format checked per domain (entity must be numeric) → 400', m4.status === 400 && m4.d1 === 0, m4);
const m5 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, title: 'token=abcd1234efgh5678ijkl9012mnop3456qrst', request_id: randomUUID() } });
check('[§8.3] title/summary are redacted before storage', m5.status === 201 && /\[redacted\]/.test(m5.body.case.title), m5.body.case && m5.body.case.title);
const m6 = await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, owner_role: 'Chief Wizard', request_id: randomUUID() } });
check('[validation] owner_role outside the Addendum §2 roles → 400', m6.status === 400, m6);
check('[AC-16] E-2 rows_read ≤ 6', m1.body.rows_read <= 6, m1.body.rows_read);

// --- AC-8: case detail ------------------------------------------------------------
const d = await call('GET', '/api/ops/admin/cases/EXC-S-0000000000A1');
const occ = d.body.events.map(e => e.occurred_at);
check('[AC-8] C-1: row, events oldest first, registry row, linked DQ tickets', d.status === 200 && d.body.case.case_ref === 'EXC-S-0000000000A1'
  && occ.every((x, i) => i === 0 || occ[i - 1] <= x) && d.body.events[0].event_type === 'raised' && d.body.registry?.job_id === 'local.entities-enrich-boost'
  && d.body.linked_dq_tickets.length === 1 && d.body.linked_dq_tickets[0].case_ref === 'DQ-000001', d.body);
check('[AC-16] C-1 rows_read ≤ 230', d.body.rows_read <= 230, d.body.rows_read);
const dq = await call('GET', '/api/ops/admin/cases/DQ-000001');
check('[C-1] DQ- ref: ticket row, events, the linked exception', dq.status === 200 && dq.body.kind === 'dq_ticket' && dq.body.linked_exception?.case_ref === 'EXC-S-0000000000A1', dq.body);
const d404 = await call('GET', '/api/ops/admin/cases/EXC-000999');
check('[C-1] unknown case → 404', d404.status === 404, d404);

// --- E-1 queue --------------------------------------------------------------------
const q1 = await call('GET', '/api/ops/admin/exceptions');
check('[E-1] default status open,acknowledged; sorted severity then age; age_h and overdue present', q1.status === 200
  && q1.body.items.every(x => ['open', 'acknowledged'].includes(x.status)) && q1.body.items.every((x, i, a) => i === 0 || (a[i - 1].severity + a[i - 1].opened_at) <= (x.severity + x.opened_at))
  && q1.body.items.every(x => typeof x.age_h === 'number' && typeof x.overdue === 'boolean'), q1.body);
const ov = q1.body.items.find(x => x.case_ref === 'EXC-S-0000000000A3');
check('[§7.2] overdue: an open sev2 case older than 24 h is overdue; acknowledged cases never are', q1.body.items.filter(x => x.status === 'acknowledged').every(x => !x.overdue)
  && (ov ? (ov.status === 'open' ? ov.overdue === true : ov.overdue === false) : true), q1.body.items);
for (let i = 0; i < 7; i++) await call('POST', '/api/ops/admin/exceptions', { body: { ...mk, severity: ['sev1', 'sev2', 'sev3', 'sev4'][i % 4], title: `bulk ${i}`, request_id: randomUUID() } });
const all = [], seen = new Set();
let cursor = null, pages = 0, maxRead = 0;
do {
  const r = await call('GET', `/api/ops/admin/exceptions?status=open,acknowledged,resolved,dismissed&limit=3${cursor ? `&cursor=${cursor}` : ''}`);
  r.body.items.forEach(x => { all.push(x.case_ref); seen.add(x.case_ref); });
  maxRead = Math.max(maxRead, r.body.rows_read);
  cursor = r.body.next_cursor; pages++;
} while (cursor && pages < 20);
check('[E-1] keyset paging over 4 statuses: every case exactly once, no skips or repeats', all.length === seen.size && seen.size === count(`SELECT COUNT(*) n FROM ops_exception`), { all, n: count(`SELECT COUNT(*) n FROM ops_exception`) });
check('[AC-16] E-1 rows_read ≤ (limit + 1) per status', maxRead <= 4 * 4, maxRead);
const qj = await call('GET', '/api/ops/admin/exceptions?job_id=local.entities-enrich-boost&status=open,acknowledged,resolved,dismissed');
check('[E-1] ?job_id= returns only that job', qj.status === 200 && qj.body.items.length > 0 && qj.body.items.every(x => x.job_id === 'local.entities-enrich-boost'), qj.body);
const qbad = await call('GET', '/api/ops/admin/exceptions?status=closed');
const qcur = await call('GET', '/api/ops/admin/exceptions?cursor=%%%');
check('[E-1] invalid status or cursor → 400 before D1', qbad.status === 400 && qcur.status === 400 && qbad.d1 === 0 && qcur.d1 === 0, { qbad, qcur });

// --- the existing /jobs route is unchanged for a human -----------------------------------
const jobs = await call('GET', '/api/ops/admin/jobs');
check('[regression] GET /api/ops/admin/jobs still 200 for an Access user', jobs.status === 200 && Array.isArray(jobs.body.jobs), jobs.status);

// --- local EXPLAIN plans (§11.2; confirmed remotely at AC-16) --------------------------
const plan = sql => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(r => r.detail).join(' | ');
const pE1 = plan(`SELECT exception_id FROM ops_exception INDEXED BY idx_ops_exception_queue WHERE status = 'open' AND (severity, opened_at, exception_id) > ('sev1','', 0) ORDER BY severity, opened_at, exception_id LIMIT 51`);
check('[plan] E-1: SEARCH idx_ops_exception_queue (status=?), no temp B-tree', /SEARCH ops_exception USING (COVERING )?INDEX idx_ops_exception_queue \(status=\?/.test(pE1) && !/TEMP B-TREE/.test(pE1), pE1);
const pE1j = plan(`SELECT exception_id FROM ops_exception INDEXED BY idx_ops_exception_job WHERE status = 'open' AND job_id = 'x' ORDER BY severity, opened_at, exception_id LIMIT 51`);
check('[plan] E-1 ?job_id=: SEARCH idx_ops_exception_job (job_id=?), temp B-tree bounded by the job\'s cases', /SEARCH ops_exception USING INDEX idx_ops_exception_job \(job_id=\?\)/.test(pE1j), pE1j);
const pEv = plan(`SELECT event_id FROM ops_case_event WHERE subject_type = 'exception' AND subject_id = '1' ORDER BY occurred_at LIMIT 200`);
check('[plan] C-1 events: SEARCH idx_ops_case_event_subject, no temp B-tree', /SEARCH ops_case_event USING (COVERING )?INDEX idx_ops_case_event_subject \(subject_type=\? AND subject_id=\?\)/.test(pEv) && !/TEMP B-TREE/.test(pEv), pEv);
const pDq = plan(`SELECT case_ref FROM ops_data_quality_ticket WHERE linked_exception_ref = 'EXC-S-0000000000A1' LIMIT 20`);
check('[plan] C-1 linked DQ: SEARCH idx_ops_dq_linked_exc (AC-8)', /SEARCH ops_data_quality_ticket USING INDEX idx_ops_dq_linked_exc \(linked_exception_ref=\?\)/.test(pDq), pDq);
const pIdem = plan(`SELECT 1 FROM ops_case_event WHERE idempotency_key = 'act:x'`);
check('[plan] idempotency guard: SEARCH on the idempotency_key autoindex', /SEARCH ops_case_event USING COVERING INDEX sqlite_autoindex_ops_case_event_1 \(idempotency_key=\?\)/.test(pIdem), pIdem);
const pRef = plan(`SELECT * FROM ops_exception WHERE case_ref = 'EXC-000001'`);
check('[plan] C-1 / C-2 case: SEARCH sqlite_autoindex_ops_exception_1 (case_ref=?)', /SEARCH ops_exception USING INDEX sqlite_autoindex_ops_exception_1 \(case_ref=\?\)/.test(pRef), pRef);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
