#!/usr/bin/env node
// MA-OCT-002a A2 — end-to-end test of GET /api/ops/admin/jobs lateness (AC-a2 shape),
// running the REAL App/Ops/src/ops-api.js handler in Node:
//  - D1 is an in-memory SQLite (node:sqlite) built from the real migrations
//    (002-ops-control-plane.sql, 003-ops-job-pause.sql), the 001 pilot row, the
//    generated A1 load (migrations/registry-load-2026-10-12.sql) and the recorded
//    boost runs (fixtures/boost-runs-p4-2026-10-07.json);
//  - Cloudflare Access is exercised for real: the Worker's own verifyAccessJwt()
//    checks an RS256 JWT signed here, against a JWKS served by a stubbed fetch;
//  - the clock is fixed at 2026-10-07T20:00Z so states match the recorded history.
// No network, no remote D1. Usage: node App/Ops/tests/admin-jobs-lateness.test.mjs

import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };

// --- fixed clock -------------------------------------------------------------
const NOW = Date.parse('2026-10-07T20:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } };

// --- D1 on SQLite --------------------------------------------------------------
const db = new DatabaseSync(':memory:');
db.exec(read('migrations/002-ops-control-plane.sql'));
db.exec(read('migrations/003-ops-job-pause.sql'));
db.exec(`INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, emitter_id, notes)
         VALUES ('ops.ingest','Ops ingest global switch','Ops','Operations Lead','control',NULL,'control');
         INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, source_path, emitter_id, kill_switch_ref, expected_max_duration_s)
         VALUES ('local.entities-enrich-boost','entities-enrich-boost (local LaunchAgent)','Entities','Data-Identity Lead','local_schedule',
                 'App/Corporate Atlas/entities-enrich-boost-run.mjs','boost-local','pause flag',120);`);
db.exec(read('migrations/registry-load-2026-10-12.sql'));
const ins = db.prepare(`INSERT INTO ops_job_run (run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, detail, end_only, contract_version)
                        VALUES (?, ?, ?, 'local.entities-enrich-boost', 'boost-local', ?, ?, ?, ?, ?, 1)`);
for (const r of JSON.parse(read('tests/fixtures/boost-runs-p4-2026-10-07.json'))) ins.run(r.run_id, r.phase, r.event_type, r.trigger, r.started_at, r.ended_at, r.detail, r.end_only);

function stmt(sql, args = []) {
  return {
    bind: (...a) => stmt(sql, a),
    async all() { const results = db.prepare(sql).all(...args); return { results, meta: { rows_read: results.length } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; }
  };
}
const DB = { prepare: sql => stmt(sql), batch: async ss => Promise.all(ss.map(s => s.all())) };

// --- Access (test key; the Worker's own verification runs) ----------------------
const TEAM = 'test-team.cloudflareaccess.com', AUD = 'aud-test-0000';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'test-kid', alg: 'RS256' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u) === `https://${TEAM}/cdn-cgi/access/certs`
  ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }) : realFetch(u, o);
const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function jwt(claims) {
  const h = b64({ alg: 'RS256', kid: 'test-kid' }), p = b64(claims);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${Buffer.from(sig).toString('base64url')}`;
}
const token = await jwt({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(NOW / 1000) + 600, email: 'founder@example.test' });

const { default: worker } = await import('../src/ops-api.js');
const env = { DB, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OPS_INGEST_ENABLED: 'true' };
async function get(path, auth = true) {
  const resp = await worker.fetch(new Request(`https://meridian-ops.test${path}`, { headers: auth ? { 'Cf-Access-Jwt-Assertion': token } : {} }), env, { waitUntil() {} });
  return { status: resp.status, body: await resp.json() };
}

// --- tests ------------------------------------------------------------------------
check('[auth] no Access JWT → 401', (await get('/api/ops/admin/jobs', false)).status === 401, null);

const one = await get('/api/ops/admin/jobs?job_id=local.entities-enrich-boost&lookback_days=6');
check('[job] 200, registered, lookback_days 6, legacy `runs` key still present', one.status === 200 && one.body.registered === true && one.body.lookback_days === 6 && Array.isArray(one.body.runs), one.body);
const st = Object.fromEntries((one.body.slots || []).map(s => [s.slot, s]));
const expect = { '2026-10-02T10:50Z': 'missed', '2026-10-02T16:50Z': 'on_time', '2026-10-03T10:50Z': 'on_time', '2026-10-04T10:50Z': 'late',
                 '2026-10-04T16:50Z': 'missed', '2026-10-05T10:50Z': 'late', '2026-10-05T16:50Z': 'missed', '2026-10-07T10:50Z': 'missed', '2026-10-07T16:50Z': 'on_time' };
check('[job] AC-a2 slot states: 4 Oct 16:50 missed; 4 and 5 Oct 11:02 late; failed fire shows failed; 4 missed in all',
  Object.entries(expect).every(([k, v]) => st[k]?.state === v) && st['2026-10-03T10:50Z'].outcome === 'failed'
  && one.body.slots.filter(s => s.state === 'missed').length === 4 && one.body.slots.length === 12, one.body.slots);
check('[job] job_state ok; drift empty (BST, installed +01:00); run_states listed', one.body.job_state === 'ok' && one.body.drift.length === 0 && one.body.run_states.length === 8, { job_state: one.body.job_state, drift: one.body.drift, run_states: one.body.run_states });

db.prepare(`INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by) VALUES ('local.entities-enrich-boost', '2026-10-04T12:00:00Z', '2026-10-05T00:00:00Z', 'test pause', 'test')`).run();
const paused = await get('/api/ops/admin/jobs?job_id=local.entities-enrich-boost&lookback_days=6');
check('[pause] a test ops_job_pause row turns 4 Oct 16:50 into paused', paused.body.slots.find(s => s.slot === '2026-10-04T16:50Z').state === 'paused', paused.body.slots);
db.exec(`DELETE FROM ops_job_pause`);

const fleet = await get('/api/ops/admin/jobs?lookback_days=6');
const jobs = Object.fromEntries((fleet.body.jobs || []).map(j => [j.job_id, j]));
check('[fleet] 200, 49 jobs, legacy last_* fields kept', fleet.status === 200 && fleet.body.jobs.length === 49 && 'last_start_at' in jobs['local.entities-enrich-boost'], fleet.body.jobs?.length);
check('[fleet] jobs without an emitter are unobserved, never missed', fleet.body.jobs.filter(j => !j.emitter_id).every(j => j.slots.every(s => s.state === 'unobserved')), null);
check('[fleet] only the boost has slot states beyond unobserved; its 4 missed match', jobs['local.entities-enrich-boost'].slots.filter(s => s.state === 'missed').length === 4, jobs['local.entities-enrich-boost'].slots);
check('[fleet] holdings: 1 Sunday slot (4 Oct 04:00Z); bootstrap: every 4 h (1 Oct 20:00 → 7 Oct 20:00 = 37 slots)', jobs['cf.meridian-holdings'].slots.map(s => s.slot).join() === '2026-10-04T04:00Z' && jobs['cf.meridian-bootstrap'].slots.length === 37, [jobs['cf.meridian-holdings'].slots.length, jobs['cf.meridian-bootstrap'].slots.length]);
check('[fleet] seed is "0 4 * * mon" → Monday 5 Oct; no numeric_dow drift on any cron job', jobs['cf.meridian-entities-seed'].slots.map(s => s.slot).join() === '2026-10-05T04:00Z' && fleet.body.jobs.every(j => !j.drift.some(d => d.type === 'numeric_dow')), jobs['cf.meridian-entities-seed'].slots);
check('[fleet] no lateness_error on any job', fleet.body.jobs.every(j => !j.lateness_error), fleet.body.jobs.filter(j => j.lateness_error).map(j => [j.job_id, j.lateness_error]));
check('[fleet] enrich phases daily (06:00Z / 06:50Z), 6 slots each', jobs['cf.meridian-entities-enrich.phase1'].slots.length === 6 && jobs['cf.meridian-entities-enrich.phase23'].slots[0].slot.endsWith('T06:50Z'), null);

const LATER = RealDate.parse('2026-10-26T12:00:00Z');
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(LATER); } static now() { return LATER; } };
const token2 = await jwt({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(LATER / 1000) + 600, email: 'founder@example.test' });
const after = await worker.fetch(new Request('https://meridian-ops.test/api/ops/admin/jobs?job_id=local.entities-enrich-boost&lookback_days=1',
  { headers: { 'Cf-Access-Jwt-Assertion': token2 } }), env, { waitUntil() {} }).then(async r => ({ status: r.status, body: await r.json() }));
check('[dst] after 25 Oct the boost shows dst_shift (installed +01:00, now +00:00)', (after.body.drift || []).some(d => d.type === 'dst_shift'), after.body);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
