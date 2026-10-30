#!/usr/bin/env node
// MA-OCT-004 test 1 (spec rev 1 §15 step 1): contract test for D-1, D-2, D-3 and the DQ engine in C-1/C-2.
// AC-1 … AC-7, AC-9, AC-10, AC-14, AC-18, AC-18c, AC-19; the caller-class matrix (§8.3) and the OPS_SERVICE_ACTORS
// allowlist; the CSRF rule; the five-status daily cap (429); object-key validation incl. 007's placeholders; request
// id replay / reuse; actor attribution; local EXPLAIN for every 004 query (§11.2). Runs the REAL ops-api.js,
// cases.js and dq-page.js on node:sqlite built from the real migrations 002–005 (batch() = one transaction, as D1);
// every D1 call is counted ("before any D1 access"). Access is exercised for real: RS256 JWTs signed here.
// No network, no remote D1.   Usage: node App/Ops/tests/dq-contract.mjs

import { readFileSync } from 'node:fs';
import { webcrypto as crypto, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };

let NOW = Date.parse('2026-10-29T09:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW++); } static now() { return NOW++; } };

// --- D1 on SQLite --------------------------------------------------------------------
const db = new DatabaseSync(':memory:');
for (const m of ['002-ops-control-plane.sql', '003-ops-job-pause.sql', '004-ops-cases.sql', '005-ops-dq.sql']) db.exec(read(`migrations/${m}`));
let d1Calls = 0;
const isWrite = sql => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
const SQL_SEEN = new Set();
function stmt(sql, args = []) {
  SQL_SEEN.add(sql);
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
  async batch(ss) { d1Calls++; db.exec('BEGIN'); try { const out = ss.map(s => s.execSync()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } }
};
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const totals = () => ({ t: n(`SELECT COUNT(*) n FROM ops_data_quality_ticket`), m: n(`SELECT COUNT(*) n FROM ops_dq_ticket_member`), e: n(`SELECT COUNT(*) n FROM ops_case_event`) });

db.exec(`INSERT INTO ops_exception (case_ref, exception_type, severity, status, title, summary, raised_by, raised_via, dedupe_key)
         VALUES ('EXC-S-0000000000B1', 'job_failed', 'sev3', 'open', 'enrich run failed', 's', 'service:health-check-local', 'ingest_auto', 'seed:b1');
         INSERT INTO ops_data_quality_ticket (case_ref, ticket_type, severity, status, title, object_domain, object_key, disposition, resolution_note, resolved_by, resolved_at,
                                              owner_role, raised_by, raised_via, legacy_source, legacy_id, opened_at)
         VALUES ('DQ-M-000001', 'entity_merge', 'sev3', 'resolved', 'entity_merge (legacy #1)', 'entity', '931', 'do_not_merge', 'distinct legal entities', 'founder', '2026-08-22 10:00:00',
                 'Data-Identity Lead', 'legacy:entity_exceptions', 'migration', 'entity_exceptions', '1', '2026-08-20 09:00:00'),
                ('DQ-M-000004', 'bad_relationship_edge', 'sev3', 'resolved', 'bad_relationship_edge (legacy #4)', 'entity', '3', 'accepted_no_fix', NULL, 'founder', '2026-08-22 10:00:00',
                 'Data-Identity Lead', 'legacy:entity_exceptions', 'migration', 'entity_exceptions', '4', '2026-08-20 09:00:00');
         INSERT INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
         SELECT 'dq_ticket', CAST(ticket_id AS TEXT), e.t, 'legacy:entity_exceptions', 'legacy_migration', '2026-08-20 09:00:00', 'mig:' || ticket_id || ':' || e.t
           FROM ops_data_quality_ticket, (SELECT 'created' AS t UNION ALL SELECT 'decision_recorded' UNION ALL SELECT 'migrated') e;`);

// --- Access ---------------------------------------------------------------------------
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
const DIL = await jwt({ email: 'dil@example.test' });
const WRONG_AUD = await jwt({ email: 'x@example.test', aud: ['other-aud'] });
const SVC_OPS = await jwt({ common_name: 'ops-script-client.access' });
const SVC_BOND = await jwt({ common_name: 'bond-runner-client.access' });
const SVC_UNKNOWN = await jwt({ common_name: 'stranger.access' });

// The production toml's allowlist, with test Client IDs substituted (checks the shipped shape).
const toml = read('wrangler-ops.toml');
const shipped = JSON.parse(toml.match(/^OPS_SERVICE_ACTORS = '(.*)'$/m)[1]);
check('[toml] allowlist: ops-script unchanged; bond-runner → routes [D-2], types [missing_entity]; DQ switches and cap set',
  shipped['0b8216d5b404b87731353bd452829e99.access'].label === 'ops-script' && JSON.stringify(shipped['__BOND_RUNNER_CLIENT_ID__.access']) === '{"label":"bond-runner","routes":["D-2"],"types":["missing_entity"]}'
  && /^OPS_DQ_ENABLED = "true"$/m.test(toml) && /^OPS_DQ_CONSUMER_ENABLED = "true"$/m.test(toml) && /^OPS_DQ_DAILY_CREATE_CAP = "100"$/m.test(toml), shipped);
const SERVICE_ACTORS = JSON.stringify({ 'ops-script-client.access': shipped['0b8216d5b404b87731353bd452829e99.access'],
                                        'bond-runner-client.access': shipped['__BOND_RUNNER_CLIENT_ID__.access'] });
const { default: worker } = await import('../src/ops-api.js');
const baseEnv = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OPS_CASES_ENABLED: 'true', OPS_SERVICE_ACTORS: SERVICE_ACTORS,
                  OPS_DQ_ENABLED: 'true', OPS_DQ_CONSUMER_ENABLED: 'true', OPS_DQ_DAILY_CREATE_CAP: '100' };

async function call(method, path, { token = FOUNDER, body, headers = {}, env = baseEnv, client = 'console', json = true } = {}) {
  const h = { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...headers };
  if (method === 'POST' && json) { h['Content-Type'] ??= 'application/json'; h['X-Ops-Client'] ??= client; }
  const before = d1Calls;
  const resp = await worker.fetch(new Request(`https://meridian-ops.test${path}`, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, { waitUntil() {} });
  const text = await resp.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: resp.status, body: parsed, d1: d1Calls - before, acao: resp.headers.get('access-control-allow-origin'), headers: resp.headers };
}
const D2 = '/api/ops/admin/dq-tickets';
const create = (body, opts) => call('POST', D2, { body: { request_id: randomUUID(), ...body }, ...opts });
const act = (ref, body, opts = {}) => call('POST', `/api/ops/admin/cases/${ref}/action`, { body: { request_id: randomUUID(), ...body }, ...opts });
const ticket = ref => db.prepare(`SELECT * FROM ops_data_quality_ticket WHERE case_ref = ?`).get(ref);
const evs = ref => db.prepare(`SELECT e.* FROM ops_case_event e JOIN ops_data_quality_ticket t ON e.subject_type = 'dq_ticket' AND e.subject_id = CAST(t.ticket_id AS TEXT)
                               WHERE t.case_ref = ? ORDER BY e.event_id`).all(ref);

// --- AC-1: auth and CSRF before any D1 access; never CORS ------------------------------------
const t0 = totals();
for (const [m, p] of [['GET', D2], ['POST', D2], ['GET', '/api/ops/admin/dq/new?type=missing_mapping&domain=entities&key=US0378331005&via=nav-007'],
                      ['GET', '/api/ops/admin/cases/DQ-M-000004'], ['POST', '/api/ops/admin/cases/DQ-M-000004/action']]) {
  const a = await call(m, p, { token: null, body: m === 'POST' ? {} : undefined });
  const b = await call(m, p, { token: WRONG_AUD, body: m === 'POST' ? {} : undefined });
  check(`[AC-1] ${m} ${p.split('?')[0]}: no JWT → 401, wrong AUD → 401, 0 D1 calls, no CORS`, a.status === 401 && b.status === 401 && a.d1 === 0 && b.d1 === 0 && !a.acao && !b.acao, { a, b });
}
const cs1 = await call('POST', D2, { body: '{}', json: false, headers: { 'Content-Type': 'text/plain', 'X-Ops-Client': 'dq-page' } });
const cs2 = await call('POST', D2, { body: '{}', json: false, headers: { 'Content-Type': 'application/json' } });
const cs3 = await call('POST', D2, { body: { request_id: randomUUID() }, client: 'script' });
check('[AC-1/§8.4] D-2 text/plain → 400; no X-Ops-Client → 400; X-Ops-Client script (not console|dq-page|service on D-2) → 400; all before D1',
  [cs1, cs2, cs3].every(r => r.status === 400 && r.d1 === 0 && /csrf/.test(r.body.error)), [cs1, cs2, cs3]);
const pre = await call('OPTIONS', D2, { token: null, headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-ops-client,content-type' } });
check('[§8.4] preflight on D-2 → 204 with no Access-Control-Allow-* (browser blocks cross-site fetch)', pre.status === 204 && !pre.acao && !pre.headers.get('access-control-allow-headers'), pre);
check('[AC-1] counts unchanged', JSON.stringify(totals()) === JSON.stringify(t0), totals());

// --- caller classes (§8.3) and the allowlist (A4-2) --------------------------------------------
const navBody = (o = {}) => ({ ticket_type: 'missing_mapping', object_domain: 'instrument', object_key: 'US0378331005', via: 'nav-007', ...o });
const u1 = await call('GET', D2, { token: SVC_UNKNOWN });
check('[A4-2] unknown service token → 403 before D1', u1.status === 403 && u1.d1 === 0 && u1.body.error === 'service_not_allowed', u1);
const os1 = await create({ ticket_type: 'missing_entity', object_domain: 'source_record', object_key: 'sec_cik:0000000001' }, { token: SVC_OPS, client: 'service' });
check('[§8.3] ops-script on D-2 → 403 before D1 (none on D-2)', os1.status === 403 && os1.d1 === 0 && os1.body.error === 'service_route_not_allowed', os1);
const br1 = await create({ ticket_type: 'missing_entity', object_domain: 'source_record', object_key: 'sec_cik:0000999999',
                           object_ref: { cik: '0000999999', sec_name: 'Example Issuer' } }, { token: SVC_BOND, client: 'service' });
const br2 = await create({ ticket_type: 'missing_mapping', object_domain: 'instrument', object_key: 'US0000000002' }, { token: SVC_BOND, client: 'service' });
const br3 = await call('GET', D2, { token: SVC_BOND });
const br4 = await create(navBody({ ticket_type: 'missing_entity', object_domain: 'source_record', object_key: 'sec_cik:0000999998' }), { token: SVC_BOND, client: 'service' });
const brRow = br1.body.case;
check('[AC-18c] bond-runner D-2 missing_entity → 201, raised_by service:bond-runner, raised_via ingest_auto, common_name on the event',
  br1.status === 201 && brRow.raised_by === 'service:bond-runner' && brRow.raised_via === 'ingest_auto' && brRow.owner_role === 'Data-Identity Lead'
  && JSON.parse(evs(brRow.case_ref)[0].payload).common_name === 'bond-runner-client.access' && evs(brRow.case_ref)[0].actor_source === 'access_service_token', br1);
check('[AC-18c] bond-runner D-2 missing_mapping → 403, D-1 → 403, via=nav-007 → 403; all before D1',
  br2.status === 403 && br3.status === 403 && br4.status === 403 && [br2, br3, br4].every(r => r.d1 === 0), [br2.body, br3.body, br4.body]);
const pn = await create(navBody({ ticket_type: 'missing_entity', object_domain: 'source_record', object_key: 'sec_cik:0000999997' }), { client: 'dq-page' });
check('[§8.3] a person with via=nav-007 may raise only the 4 007 types (missing_entity → 403 before D1)', pn.status === 403 && pn.d1 === 0, pn);

// --- object-key validation (§6, E8) ------------------------------------------------------------
const bad = [['instrument', 'CUSIP:000000000'], ['instrument', 'CUSIP:000000'], ['instrument', 'NAME:N/A'], ['instrument', 'NAME:NONE'], ['entity', '0'], ['entity', '12a'],
             ['source_record', 'Known-Issue:22.44'], ['bond', 'a b'], ['nowhere', 'x']];
const badRes = await Promise.all(bad.map(([od, ok]) => create({ ticket_type: 'data_error', object_domain: od, object_key: ok, title: 'x' })));
check('[§6] invalid keys and 007 placeholders → 400 before D1 (CUSIP zeros, NAME:N/A|NONE, entity 0, bad source_record, unknown domain)',
  badRes.every(r => r.status === 400 && r.d1 === 0), badRes.map(r => r.status));
const goodKeys = [['instrument', 'US0378331005'], ['instrument', 'CUSIP:037833100'], ['instrument', 'TICKER:AAPL'], ['instrument', 'NAME:SOME_FUND_UNITS'],
                  ['bond', '0001104659-24-088590#1'], ['source_record', 'known-issue:22.44'], ['entity', '2289']];
const { dqKeyOk } = await import('../src/cases.js');
check('[§6/E8] accepted: bare ISIN, CUSIP:, TICKER:, NAME:, bond accession#seq, source_record, entity id', goodKeys.every(([a, b]) => dqKeyOk(a, b)), goodKeys.filter(([a, b]) => !dqKeyOk(a, b)));

// --- AC-6 / AC-7: the 007 link-out report and duplicate folding ----------------------------------
const navRef = { isin: 'US0378331005', cusip: '037833100', candidates: [12, 'x', -3, 14], state: 'none', evil: '<script>alert(1)</script>', reason: 'no issuer' };
const r6 = await create(navBody({ object_ref: navRef, note: 'Card says no issuer.' }), { token: DIL, client: 'dq-page' });
const c6 = r6.body.case;
check('[AC-6] 201; raised_via consumer_screen; source_system ma-ui; object_domain instrument; raised_by = JWT email; severity sev3; owner Data-Identity Lead',
  r6.status === 201 && c6.raised_via === 'consumer_screen' && c6.source_system === 'ma-ui' && c6.object_domain === 'instrument' && c6.raised_by === 'dil@example.test'
  && c6.severity === 'sev3' && c6.owner_role === 'Data-Identity Lead' && /^DQ-\d{6}$/.test(c6.case_ref) && c6.dedupe_key === null, r6.body);
check('[AC-6] object_ref holds only whitelisted keys (+ via); bad candidates dropped', c6.object_ref === JSON.stringify({ isin: 'US0378331005', cusip: '037833100', candidates: [12, 14], state: 'none', reason: 'no issuer', via: 'nav-007' }), c6.object_ref);
const ev6 = evs(c6.case_ref);
check('[AC-6] one created event: actor = email, access_jwt, body = the note, idempotency act:<request_id>', ev6.length === 1 && ev6[0].event_type === 'created' && ev6[0].actor === 'dil@example.test'
  && ev6[0].actor_source === 'access_jwt' && ev6[0].body === 'Card says no issuer.' && /^act:/.test(ev6[0].idempotency_key), ev6);
const r7a = await create(navBody({ note: 'again' }), { token: DIL, client: 'dq-page' });
const r7b = await create(navBody(), { token: DIL, client: 'dq-page' });
const again = evs(c6.case_ref).filter(e => e.event_type === 'reported_again');
check('[AC-7] two more reports the same day → 200 deduplicated, same case_ref, exactly 1 reported_again event, no new ticket',
  r7a.status === 200 && r7b.status === 200 && r7a.body.deduplicated && r7b.body.case_ref === c6.case_ref && again.length === 1 && again[0].body === 'again'
  && n(`SELECT COUNT(*) n FROM ops_data_quality_ticket WHERE object_key = 'US0378331005'`) === 1, { r7a: r7a.body, r7b: r7b.body, again });
const r7f = await create(navBody(), { token: FOUNDER, client: 'dq-page' });
check('[§9.3] another person on the same day → their own reported_again event (one per actor per day)', r7f.body.reported_again === true && evs(c6.case_ref).filter(e => e.event_type === 'reported_again').length === 2, r7f.body);
const rid = randomUUID();
const rp1 = await create({ ...navBody({ object_key: 'US5949181045' }), request_id: rid }, { client: 'dq-page' });
const rp2 = await create({ ...navBody({ object_key: 'US5949181045' }), request_id: rid }, { client: 'dq-page' });
const rp3 = await act(rp1.body.case.case_ref, { action: 'comment', expected_status: 'open', note: 'x', request_id: rid });
check('[replay] same request_id on D-2 → 200 replay with the same ticket; reused on C-2 → 409 request_id_reused, 0 writes',
  rp1.status === 201 && rp2.status === 200 && rp2.body.replay && rp2.body.case.case_ref === rp1.body.case.case_ref && rp3.status === 409 && rp3.body.error === 'request_id_reused', { rp2: rp2.body, rp3: rp3.body });
// After resolution a later report opens a new ticket.
await act(c6.case_ref, { action: 'resolve', expected_status: 'open', disposition: 'valid_exception', note: 'Fund unit with no issuer in the source.' }, { token: DIL });
const r7c = await create(navBody(), { token: DIL, client: 'dq-page' });
check('[AC-7] after the ticket is resolved, a new report → 201 with a new case_ref', r7c.status === 201 && r7c.body.case.case_ref !== c6.case_ref, r7c.body);
const nav403 = await create(navBody({ object_domain: 'source_record', object_key: 'known-issue:1.1' }), { client: 'dq-page' });
check('[§9.1] nav-007 reports name an entity or an instrument only (400)', nav403.status === 400 && nav403.d1 === 0, nav403.body);

// --- AC-14 and OPS_DQ_ENABLED kill switches ----------------------------------------------------
const offC = { ...baseEnv, OPS_DQ_CONSUMER_ENABLED: 'false' };
const p14 = await call('GET', '/api/ops/admin/dq/new?type=missing_mapping&domain=entities&key=US0378331005&via=nav-007', { env: offC });
const d14 = await create(navBody({ object_key: 'US88160R1014' }), { env: offC, client: 'dq-page' });
const k14 = await create({ ticket_type: 'data_error', object_domain: 'source_record', object_key: 'review:console-check', title: 'Console still works' }, { env: offC });
check('[AC-14] consumer switch off: D-3 page says paused (503, 0 D1); D-2 via=nav-007 503 before D1; console create still 201',
  p14.status === 503 && /Reporting is paused/.test(p14.body) && p14.d1 === 0 && d14.status === 503 && d14.d1 === 0 && k14.status === 201, [p14.status, d14.body, k14.status]);
check('[§7.4] data_error defaults: owner Operations Lead, sev3, raised_via ops_console', k14.body.case.owner_role === 'Operations Lead' && k14.body.case.severity === 'sev3' && k14.body.case.raised_via === 'ops_console', k14.body.case);
const offD = { ...baseEnv, OPS_DQ_ENABLED: 'false' };
const offs = [await call('GET', D2, { env: offD }), await create(navBody(), { env: offD }), await call('GET', '/api/ops/admin/dq/new', { env: offD }),
              await act('DQ-M-000004', { action: 'comment', expected_status: 'resolved', note: 'x' }, { env: offD })];
const excOn = await act('EXC-S-0000000000B1', { action: 'comment', expected_status: 'open', note: 'exceptions unaffected' }, { env: offD });
check('[§11.4] OPS_DQ_ENABLED=false: D-1, D-2, D-3 and DQ C-2 → 503 before D1; EXC C-2 unaffected (200)', offs.every(r => r.status === 503 && r.d1 === 0) && excOn.status === 200, offs.map(r => r.status).concat(excOn.status));

// --- daily create cap across all five statuses (N4-1) ----------------------------------------------
const capEnv = { ...baseEnv, OPS_DQ_DAILY_CREATE_CAP: String(n(`SELECT COUNT(*) n FROM ops_data_quality_ticket WHERE opened_at >= '2026-10-29'`)) };
const c429 = await create({ ticket_type: 'data_error', object_domain: 'source_record', object_key: 'review:cap-check', title: 'cap' }, { env: capEnv });
const cDedup = await create(navBody({ object_key: 'US0378331005' }), { env: capEnv, client: 'dq-page' });
check('[§11.1] cap reached (counted across open…dismissed, incl. the resolved one) → 429; a duplicate report is still folded (200)',
  c429.status === 429 && c429.body.error === 'daily_create_cap' && cDedup.status === 200 && cDedup.body.deduplicated, [c429.body, cDedup.body]);

// --- AC-2: triage → schedule_fix → resolve fixed ---------------------------------------------------
const a2 = (await create({ ticket_type: 'wrong_identifier', object_domain: 'entity', object_key: '2289', field_name: 'cik', observed_value: '0000766704', expected_value: '0001917598',
                          proposed_resolution: 'One Entities UPDATE of entity_master.cik', title: 'Entity 2289 stores the wrong CIK' })).body.case;
check('[§7.2] wrong_identifier defaults to sev3 unless given; wrong_lei would be sev2', a2.severity === 'sev3', a2);
const s1 = await act(a2.case_ref, { action: 'triage', expected_status: 'open', owner_role: 'Data-Identity Lead', severity: 'sev2', actor_role: 'Data-Identity Lead' }, { token: DIL });
const s2 = await act(a2.case_ref, { action: 'schedule_fix', expected_status: 'triaged', fix_ref: 'MA-OCT-019', note: 'DIL packet' }, { token: DIL });
const s3 = await act(a2.case_ref, { action: 'resolve', expected_status: 'fix_pending', disposition: 'fixed', note: 'Applied by MA-OCT-019 (cik updated).', actor_role: 'Data-Identity Lead' }, { token: DIL });
const e2 = evs(a2.case_ref).slice(1);
const t2 = ticket(a2.case_ref);
check('[AC-2] each step 200 with one event: triaged, fix_scheduled (payload.fix_ref), resolved', [s1, s2, s3].every(r => r.status === 200) && e2.map(e => e.event_type).join() === 'triaged,fix_scheduled,resolved'
  && JSON.parse(e2[1].payload).fix_ref === 'MA-OCT-019', e2.map(e => [e.event_type, e.payload]));
check('[AC-2] resolved_by = the JWT email; disposition fixed; resolution_note = note; proposed_resolution unchanged (N4-4); actor_role recorded',
  t2.status === 'resolved' && t2.resolved_by === 'dil@example.test' && t2.disposition === 'fixed' && t2.resolution_note === 'Applied by MA-OCT-019 (cik updated).'
  && t2.proposed_resolution === 'One Entities UPDATE of entity_master.cik' && t2.severity === 'sev2' && e2[2].actor_role === 'Data-Identity Lead', t2);
check('[§7.1] every DQ event payload carries the pre-image (before.status) and the request', JSON.parse(e2[2].payload).before.status === 'fix_pending' && JSON.parse(e2[2].payload).request.disposition === 'fixed', e2[2].payload);
const ill = await act(a2.case_ref, { action: 'triage', expected_status: 'resolved', owner_role: 'Founder' });
const stale = await act(a2.case_ref, { action: 'comment', expected_status: 'open', note: 'x' });
check('[§7.1] illegal transition → 409 illegal_transition; stale expected_status → 409; no events', ill.body.error === 'illegal_transition' && stale.body.error === 'stale_expected_status' && evs(a2.case_ref).length === 4, [ill.body.error, stale.body.error]);

// --- AC-4 ---------------------------------------------------------------------------------------
const four = [await act(a2.case_ref, { action: 'resolve', expected_status: 'resolved', disposition: 'duplicate', note: 'x' }),
              await act(a2.case_ref, { action: 'dismiss', expected_status: 'resolved', disposition: 'fixed', note: 'x' }),
              await act(a2.case_ref, { action: 'resolve', expected_status: 'resolved', disposition: 'do_not_merge', note: 'x' })];
check('[AC-4] resolve with duplicate, dismiss with fixed, resolve with a legacy disposition → 400 before D1', four.every(r => r.status === 400 && r.d1 === 0), four.map(r => r.body.error));

// --- AC-3, AC-9, add_members ---------------------------------------------------------------------
const agg = (await create({ ticket_type: 'wrong_lei', object_domain: 'source_record', object_key: 'known-issue:test.44', title: 'Test aggregate',
  members: [{ object_domain: 'entity', object_key: '528', proposed_action: 'replace_lei_t1', object_ref: { current_lei: '549300CPKDUJKREQRG38' } },
            { object_domain: 'entity', object_key: '575', proposed_action: 'review' }] })).body.case;
check('[§7.2] wrong_lei defaults to sev2; 2 members created with the ticket', agg.severity === 'sev2' && n(`SELECT COUNT(*) n FROM ops_dq_ticket_member WHERE ticket_id = ?`, agg.ticket_id) === 2, agg);
const am = await act(agg.case_ref, { action: 'add_members', expected_status: 'open', members: [{ object_domain: 'entity', object_key: '576', proposed_action: 'null_and_offline_match' },
                                                                                                 { object_domain: 'entity', object_key: '528', proposed_action: 'review' }] });
const amEv = evs(agg.case_ref).at(-1);
check('[A4-3] add_members: 1 new (528 already a member, ignored), one members_added event with count 1, ticket bumped',
  am.status === 200 && am.body.added === 1 && amEv.event_type === 'members_added' && JSON.parse(amEv.payload).count === 1 && ticket(agg.case_ref).updated_at === amEv.occurred_at, { am: am.body, amEv });
const amNo = await act(agg.case_ref, { action: 'add_members', expected_status: 'open', members: [{ object_domain: 'entity', object_key: '576' }] });
check('[A4-3] add_members of existing members only → 200 added 0, no event (no orphan)', amNo.status === 200 && amNo.body.added === 0 && evs(agg.case_ref).at(-1).event_id === amEv.event_id, amNo.body);
const fx0 = await act(agg.case_ref, { action: 'member_update', expected_status: 'open', member: { object_domain: 'entity', object_key: '528' }, expected_member_status: 'open', member_status: 'fixed', note: 'MA-OCT-019' }, { token: DIL });
check('[§7.1/§7.5] member → fixed on an Entities type without a fix_scheduled event → 409 fix_not_scheduled', fx0.status === 409 && fx0.body.error === 'fix_not_scheduled', fx0.body);
await act(agg.case_ref, { action: 'schedule_fix', expected_status: 'open', fix_ref: 'MA-OCT-019', note: 'LEI corrections' }, { token: DIL });
const before9 = { ev: evs(agg.case_ref).length, upd: ticket(agg.case_ref).updated_at };
const rid9 = randomUUID();
const m1 = await act(agg.case_ref, { request_id: rid9, action: 'member_update', expected_status: 'fix_pending', member: { object_domain: 'entity', object_key: '528' }, expected_member_status: 'open', member_status: 'fixed', note: 'Applied by MA-OCT-019.' }, { token: DIL });
const mev = evs(agg.case_ref).at(-1);
const mrow = db.prepare(`SELECT * FROM ops_dq_ticket_member WHERE ticket_id = ? AND object_key = '528'`).get(agg.ticket_id);
check('[AC-9 1] member → fixed: row changed, 1 member_updated event (key, from, to), ticket updated_at bumped to the same :now',
  m1.status === 200 && mrow.member_status === 'fixed' && mrow.note === 'Applied by MA-OCT-019.' && evs(agg.case_ref).length === before9.ev + 1 && mev.event_type === 'member_updated'
  && JSON.parse(mev.payload).object_key === '528' && JSON.parse(mev.payload).from === 'open' && JSON.parse(mev.payload).to === 'fixed' && ticket(agg.case_ref).updated_at === mrow.updated_at
  && ticket(agg.case_ref).updated_at !== before9.upd, { m1: m1.body, mrow, mev });
const snap = { ev: evs(agg.case_ref).length, upd: ticket(agg.case_ref).updated_at };
const m2 = await act(agg.case_ref, { action: 'member_update', expected_status: 'fix_pending', member: { object_domain: 'entity', object_key: '528' }, expected_member_status: 'open', member_status: 'wont_fix' }, { token: DIL });
check('[AC-9 2] stale expected_member_status → 409, no event, no ticket bump', m2.status === 409 && m2.body.error === 'stale_member_status' && evs(agg.case_ref).length === snap.ev && ticket(agg.case_ref).updated_at === snap.upd, m2.body);
const m3 = await act(agg.case_ref, { request_id: rid9, action: 'member_update', expected_status: 'fix_pending', member: { object_domain: 'entity', object_key: '575' }, expected_member_status: 'open', member_status: 'fixed', note: 'x' }, { token: DIL });
const m3b = await act(agg.case_ref, { request_id: rid9, action: 'member_update', expected_status: 'fix_pending', member: { object_domain: 'entity', object_key: '528' }, expected_member_status: 'open', member_status: 'fixed', note: 'Applied by MA-OCT-019.' }, { token: DIL });
check('[AC-9 3] same request_id, a different member → 409 request_id_reused, 0 changes; same member → 200 replay',
  m3.status === 409 && m3.body.error === 'request_id_reused' && db.prepare(`SELECT member_status s FROM ops_dq_ticket_member WHERE ticket_id = ? AND object_key = '575'`).get(agg.ticket_id).s === 'open'
  && m3b.status === 200 && m3b.body.replay === true && evs(agg.case_ref).length === snap.ev, [m3.body, m3b.body]);
const mnf = await act(agg.case_ref, { action: 'member_update', expected_status: 'fix_pending', member: { object_domain: 'entity', object_key: '999' }, expected_member_status: 'open', member_status: 'wont_fix' });
check('[§7.1] member_update on a non-member → 404 member_not_found', mnf.status === 404, mnf.body);
const snap3 = totals();
const r3 = await act(agg.case_ref, { action: 'resolve', expected_status: 'fix_pending', disposition: 'fixed', note: 'All applied' }, { token: DIL });
check('[AC-3] aggregate with open members → resolve without force → 409 members_open, nothing written', r3.status === 409 && r3.body.error === 'members_open' && JSON.stringify(totals()) === JSON.stringify(snap3), r3.body);
const r3f = await act(agg.case_ref, { action: 'resolve', expected_status: 'fix_pending', disposition: 'fixed', force: true, note: '575 and 576 move to KI 22.44 r2' }, { token: DIL });
check('[AC-3] with force: true and a note → 200; payload records force', r3f.status === 200 && ticket(agg.case_ref).status === 'resolved' && JSON.parse(evs(agg.case_ref).at(-1).payload).force === true, r3f.body);

// --- AC-18: authority ---------------------------------------------------------------------------
const e18 = (await create({ ticket_type: 'bad_relationship_edge', object_domain: 'source_record', object_key: 'known-issue:test.9', title: 'Edges' })).body.case;
const f1 = await act(e18.case_ref, { action: 'resolve', expected_status: 'open', disposition: 'fixed', note: 'deleted' });
check('[AC-18 1] resolve fixed with no fix_scheduled event → 409 fix_not_scheduled', f1.status === 409 && f1.body.error === 'fix_not_scheduled', f1.body);
const svcTries = [];
for (const [tok, a] of [[SVC_OPS, 'resolve'], [SVC_OPS, 'dismiss'], [SVC_OPS, 'reopen'], [SVC_BOND, 'resolve'], [SVC_BOND, 'dismiss'], [SVC_BOND, 'reopen']]) {
  svcTries.push(await act(e18.case_ref, { action: a, expected_status: 'open', disposition: 'not_a_problem', note: 'x' }, { token: tok, client: 'service' }));
}
check('[AC-18 2] bond-runner / ops-script on resolve, dismiss, reopen → 403 before D1', svcTries.every(r => r.status === 403 && r.d1 === 0), svcTries.map(r => r.body.error));
const osTriage = await act(e18.case_ref, { action: 'triage', expected_status: 'open', owner_role: 'Data-Identity Lead' }, { token: SVC_OPS, client: 'script' });
const osSched = await act(e18.case_ref, { action: 'schedule_fix', expected_status: 'triaged', fix_ref: 'MA-OCT-019', note: 'x' }, { token: SVC_OPS, client: 'script' });
check('[§8.3] ops-script may triage a DQ- ref (200, actor service:ops-script) but not schedule_fix (403 before D1)', osTriage.status === 200 && ticket(e18.case_ref).owner_role === 'Data-Identity Lead'
  && evs(e18.case_ref).at(-1).actor === 'service:ops-script' && osSched.status === 403 && osSched.d1 === 0, [osTriage.body, osSched.body]);
const snap18 = ticket('DQ-M-000001');
const p3 = await act('DQ-M-000001', { action: 'reopen', expected_status: 'resolved', note: 'try' }, { token: DIL });
check('[AC-18 3] reopen on a do_not_merge ticket without founder_supersession → 409 protected_decision, row unchanged',
  p3.status === 409 && p3.body.error === 'protected_decision' && JSON.stringify(ticket('DQ-M-000001')) === JSON.stringify(snap18), p3.body);
const p4 = await act('DQ-M-000001', { action: 'reopen', expected_status: 'resolved', note: 'Founder superseded', founder_supersession: { reference: 'ML-1029-9', decided_at: '2026-10-29' } });
const p4ev = evs('DQ-M-000001').at(-1);
check('[AC-18 4] with founder_supersession → 200 open; the supersession and the prior disposition are in the event payload',
  p4.status === 200 && ticket('DQ-M-000001').status === 'open' && ticket('DQ-M-000001').disposition === null && JSON.parse(p4ev.payload).founder_supersession.reference === 'ML-1029-9'
  && JSON.parse(p4ev.payload).before.disposition === 'do_not_merge' && p4ev.from_value === 'resolved', p4ev);

// --- AC-5 (legacy verbatim) and AC-10 (links both ways) --------------------------------------------
const c5 = await call('GET', '/api/ops/admin/cases/DQ-M-000004');
check('[AC-5] legacy DQ-M ticket: accepted_no_fix verbatim, with the 003 M1 events', c5.status === 200 && c5.body.case.disposition === 'accepted_no_fix'
  && c5.body.events.map(e => e.event_type).join() === 'created,decision_recorded,migrated', c5.body);
const l1 = await act(e18.case_ref, { action: 'link_exception', expected_status: 'triaged', exception_ref: 'EXC-S-0000000000B1' });
const l2 = await act(e18.case_ref, { action: 'link_exception', expected_status: 'triaged', exception_ref: 'EXC-S-0000000000B1' });
const l3 = await act(e18.case_ref, { action: 'link_exception', expected_status: 'triaged', exception_ref: 'EXC-S-000000000099' });
const vT = await call('GET', `/api/ops/admin/cases/${e18.case_ref}`), vE = await call('GET', '/api/ops/admin/cases/EXC-S-0000000000B1');
check('[AC-10] link_exception → 200, one linked event; C-1 on the ticket shows the exception; C-1 on the exception shows the ticket',
  l1.status === 200 && evs(e18.case_ref).at(-1).event_type === 'linked' && vT.body.linked_exception?.case_ref === 'EXC-S-0000000000B1'
  && vE.body.linked_dq_tickets.some(t => t.case_ref === e18.case_ref), { l1: l1.body, t: vT.body.linked_exception, e: vE.body.linked_dq_tickets });
check('[A4-3] linking the same exception again → 409 already_linked (no event); an unknown exception → 422', l2.body.error === 'already_linked' && l3.status === 422, [l2.body, l3.body]);
const dupBad = await act(e18.case_ref, { action: 'dismiss', expected_status: 'triaged', disposition: 'duplicate', duplicate_of: 'DQ-999999', note: 'x' });
const dupOk = await act(e18.case_ref, { action: 'dismiss', expected_status: 'triaged', disposition: 'duplicate', duplicate_of: 'DQ-M-000004', note: 'Same edges as the legacy row' }, { token: DIL });
check('[§7.1] dismiss duplicate: unknown duplicate_of → 422; known → 200 dismissed/duplicate', dupBad.status === 422 && dupOk.status === 200 && ticket(e18.case_ref).disposition === 'duplicate', [dupBad.body, dupOk.body]);

// --- AC-19: merged_into (013 redirect) and C-1 member paging (N4-2) ------------------------------
const big = (await create({ ticket_type: 'isin_duplicate', object_domain: 'source_record', object_key: 'known-issue:test.17', title: 'Many members' })).body.case;
for (let i = 0; i < 3; i++) {
  const r = await act(big.case_ref, { action: 'add_members', expected_status: 'open', members: Array.from({ length: 100 }, (_, k) => ({ object_domain: 'entity', object_key: String(1000 + i * 100 + k) })) });
  if (r.status !== 200) check('[setup] add_members', false, r.body);
}
const cap5 = await act(big.case_ref, { action: 'add_members', expected_status: 'open', members: Array.from({ length: 100 }, (_, k) => ({ object_domain: 'entity', object_key: String(5000 + k) })) });
const cap6 = await act(big.case_ref, { action: 'add_members', expected_status: 'open', members: Array.from({ length: 101 }, (_, k) => ({ object_domain: 'entity', object_key: String(6000 + k) })) });
await act(big.case_ref, { action: 'add_members', expected_status: 'open', members: Array.from({ length: 100 }, (_, k) => ({ object_domain: 'entity', object_key: String(7000 + k) })) });
const cap7 = await act(big.case_ref, { action: 'add_members', expected_status: 'open', members: [{ object_domain: 'entity', object_key: '8000' }] });
check('[§7.1] members: ≤ 100 per call (101 → 400), ≤ 500 per ticket (the 501st → 409 member_cap)', cap5.status === 200 && cap6.status === 400 && cap7.status === 409 && cap7.body.error === 'member_cap'
  && n(`SELECT COUNT(*) n FROM ops_dq_ticket_member WHERE ticket_id = ?`, big.ticket_id) === 500, [cap5.status, cap6.status, cap7.body]);
const pg1 = await call('GET', `/api/ops/admin/cases/${big.case_ref}`);
const pg2 = await call('GET', `/api/ops/admin/cases/${big.case_ref}?members_after=${encodeURIComponent(pg1.body.members_cursor)}`);
check('[N4-2] C-1 members: first page 200 in (object_domain, object_key) order with members_cursor; the next page continues after it',
  pg1.body.members.length === 200 && pg1.body.members_cursor === `entity|${pg1.body.members[199].object_key}` && pg2.body.members.length === 200
  && pg2.body.members[0].object_key > pg1.body.members[199].object_key, { c: pg1.body.members_cursor, first2: pg2.body.members[0]?.object_key });
check('[§8.2] C-1 with a malformed members_after → 400', (await call('GET', `/api/ops/admin/cases/${big.case_ref}?members_after=nonsense`)).status === 400, null);
const noTbl = await call('GET', `/api/ops/admin/cases/${agg.case_ref}`);
check('[AC-19] no entity_merge_redirect table (before 013) → C-1 still 200, no merged_into', noTbl.status === 200 && noTbl.body.members.every(m => !m.merged_into), noTbl.body);
db.exec(`CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);
         INSERT INTO entity_merge_redirect VALUES (575, 9575, '2026-11-02', 'MA-OCT-013'), (9575, 19575, '2026-11-02', 'MA-OCT-013'),
                                                  (576, 577, '2026-11-02', 'MA-OCT-013'), (577, 576, '2026-11-02', 'MA-OCT-013');`);
const withTbl = await call('GET', `/api/ops/admin/cases/${agg.case_ref}`);
const byKey = Object.fromEntries(withTbl.body.members.map(m => [m.object_key, m]));
check('[AC-19] redirect fixture: 575 → merged_into 19575 (2 hops); the stored object_key unchanged; 528 not merged; a 576↔577 cycle stops (survivor 577)',
  byKey['575'].merged_into === 19575 && byKey['575'].object_key === '575' && !byKey['528'].merged_into && byKey['576'].merged_into === 577
  && n(`SELECT COUNT(*) n FROM ops_dq_ticket_member WHERE object_key = '575'`) === 1, withTbl.body.members);
const d1Merged = await call('GET', `${D2}?status=open,triaged,fix_pending,resolved,dismissed&object_domain=entity&object_key=575`);
check('[§7.6] D-1 object filter finds the aggregate through its member (idx_ops_dq_member_object)', d1Merged.body.items.some(i => i.case_ref === agg.case_ref), d1Merged.body);

// --- D-1 list --------------------------------------------------------------------------------------
const L = await call('GET', D2);
check('[D-1] default = open, triaged, fix_pending; ordered (severity, opened_at, ticket_id); age_h and overdue present; rows_read ≤ 153',
  L.status === 200 && L.body.items.every(i => ['open', 'triaged', 'fix_pending'].includes(i.status)) && L.body.items.every(i => 'age_h' in i && 'overdue' in i)
  && L.body.items.every((x, k, a) => k === 0 || a[k - 1].severity < x.severity || (a[k - 1].severity === x.severity && a[k - 1].opened_at <= x.opened_at)) && L.body.rows_read <= 153, L.body);
const Lt = await call('GET', `${D2}?type=missing_mapping&status=open,resolved`);
check('[D-1] ?type= filter', Lt.body.items.length >= 2 && Lt.body.items.every(i => i.ticket_type === 'missing_mapping'), Lt.body.items.map(i => i.ticket_type));
const Lr = await call('GET', `${D2}?status=resolved`);
check('[§7.5] D-1 shows the resolver role on resolved rows', Lr.body.items.find(i => i.case_ref === a2.case_ref)?.resolver_role === 'Data-Identity Lead', Lr.body.items);
let seen = [], cursor = null, pages = 0;
do { const r = await call('GET', `${D2}?status=open,triaged,fix_pending,resolved,dismissed&limit=2${cursor ? `&cursor=${cursor}` : ''}`); seen.push(...r.body.items.map(i => i.case_ref)); cursor = r.body.next_cursor; pages++; } while (cursor && pages < 50);
check('[D-1] keyset paging with limit=2 visits every ticket exactly once', new Set(seen).size === seen.length && seen.length === n(`SELECT COUNT(*) n FROM ops_data_quality_ticket`), { seen: seen.length });
const Lbad = [await call('GET', `${D2}?status=bogus`), await call('GET', `${D2}?type=bogus`), await call('GET', `${D2}?object_domain=entity`), await call('GET', `${D2}?cursor=%%%`)];
check('[D-1] invalid status / type / half object filter / cursor → 400 before D1', Lbad.every(r => r.status === 400 && r.d1 === 0), Lbad.map(r => r.status));

// --- D-3 page --------------------------------------------------------------------------------------
const pg = await call('GET', `/api/ops/admin/dq/new?type=ambiguous_mapping&domain=entities&key=US0378331005&via=nav-007&ref=${encodeURIComponent(JSON.stringify({ isin: 'US0378331005', candidates: [12, 14] }))}`);
check('[D-3] 200 HTML, 0 D1 reads, no-store, CSP present, no CORS', pg.status === 200 && pg.d1 === 0 && pg.headers.get('cache-control') === 'no-store' && /frame-ancestors 'none'/.test(pg.headers.get('content-security-policy')) && !pg.acao, pg.status);
const svcPage = await call('GET', '/api/ops/admin/dq/new?type=missing_mapping&domain=entities&key=US0378331005&via=nav-007', { token: SVC_OPS });
check('[A4-2] a service token on D-3 → 403 (no service route lists it)', svcPage.status === 403, svcPage.body);

// --- local EXPLAIN for every 004 statement the Worker ran (§11.2) ------------------------------------
const dqSql = [...SQL_SEEN].filter(s => /ops_dq_ticket_member|ops_data_quality_ticket|entity_merge_redirect/.test(s) && !/^\s*(INSERT|UPDATE)/i.test(s));
const scans = [];
for (const sql of dqSql) {
  const qmarks = (sql.match(/\?/g) || []).length;
  let plan;
  try { plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array(qmarks).fill('x')).map(r => r.detail); } catch (e) { plan = [`ERR ${e.message}`]; }
  const bad = plan.filter(d => /^SCAN (ops_|entity_)/.test(d) && !/SCAN (m|json_each)/.test(d));
  if (bad.length) scans.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 160), bad });
}
check(`[§11.2] EXPLAIN: none of the ${dqSql.length} distinct 004 read statements scans an ops_/entity_ table`, scans.length === 0, scans);
const writeSql = [...SQL_SEEN].filter(s => /^\s*(INSERT|UPDATE)/i.test(s) && /ops_dq_ticket_member|ops_data_quality_ticket/.test(s));
const wScans = [];
for (const sql of writeSql) {
  const qmarks = (sql.match(/\?/g) || []).length;
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array(qmarks).fill('x')).map(r => r.detail);
  const bad = plan.filter(d => /^SCAN (ops_|entity_)/.test(d));
  if (bad.length) wScans.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 160), bad });
}
check(`[§11.2] EXPLAIN: none of the ${writeSql.length} distinct 004 write statements scans a table (guards use indexes)`, wScans.length === 0, wScans);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
