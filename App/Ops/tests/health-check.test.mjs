#!/usr/bin/env node
// MA-OCT-002a A3 — test of the revived watchdog 13F Seed/check-pipeline-health.js (spec 002 §7.1, §7.4, §8.1).
// Runs the REAL script against a local fake meridian-ops (sweep + run-event routes) with a temp secrets dir,
// temp log dir and temp pause flag; notifications and launchctl are suppressed (test-only env overrides).
// No network beyond 127.0.0.1, no D1, no LaunchAgent change.   Usage: node App/Ops/tests/health-check.test.mjs

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '../../../13F Seed/check-pipeline-health.js');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };

// Fake Ops: mode controls the sweep answer; run-event answers 201 unless runEventStatus overrides.
let mode = 'clean', runEventStatus = 201;
const got = [];
const srv = await new Promise(res => { const s = createServer((req, resp) => {
  let b = ''; req.on('data', d => (b += d)); req.on('end', () => {
    const body = b ? JSON.parse(b) : null;
    got.push({ path: req.url, emitter: req.headers['x-ops-emitter'], body, at: Date.now() });
    if (req.url.endsWith('/run-event')) { resp.writeHead(runEventStatus, { 'Content-Type': 'application/json' }); return resp.end('{"ok":true,"recorded":true}'); }
    if (mode === '500') { resp.writeHead(500); return resp.end('{"ok":false}'); }
    if (mode === '202') { resp.writeHead(202, { 'Content-Type': 'application/json' }); return resp.end('{"ok":true,"swept":false,"reason":"sweep_disabled"}'); }
    const fresh = mode === 'findings' ? [{ case_ref: 'EXC-S-AAA', type: 'job_missed', severity: 'sev3', title: 'local.entities-enrich-boost missed its 2026-10-13T10:50Z slot' },
                                         { case_ref: 'EXC-S-BBB', type: 'hold_active', severity: 'sev2', title: 'hold_all_jobs is TRUE' }] : [];
    resp.writeHead(200, { 'Content-Type': 'application/json' });
    resp.end(JSON.stringify({ ok: true, run_id: body.run_id, hold_all_jobs: false, headroom: { headroom: 99000 }, findings: fresh.length, already_open: 3,
                              new: fresh, raised: fresh.length, overflow: 0, open_counts: { sev2: fresh.length ? 1 : 0, sev3: 3 }, rows_read: 240 }));
  }); }); s.listen(0, '127.0.0.1', () => res(s)); });
const BASE = `http://127.0.0.1:${srv.address().port}/api/ops/ingest`;

const dir = mkdtempSync(path.join(tmpdir(), 'hc-test-'));
const secrets = path.join(dir, 'secrets'), logs = path.join(dir, 'logs'), flag = path.join(dir, '.health-check-paused');
mkdirSync(secrets);
const writeCfg = url => writeFileSync(path.join(secrets, 'health-check-ops-ingest.env'), `OPS_INGEST_URL=${url}/run-event\nOPS_EMITTER=health-check-local\nOPS_INGEST_KEY=test-only-not-a-key\n`);
writeCfg(BASE);
const rd = f => (existsSync(path.join(logs, f)) ? readFileSync(path.join(logs, f), 'utf8') : '');
function run(extraEnv = {}) {
  got.length = 0;
  return new Promise(res => {
    const env = { ...process.env, MERIDIAN_SECRETS_DIR: secrets, HEALTH_CHECK_LOG_DIR: logs, HEALTH_CHECK_PAUSE_FLAG: flag,
                  HEALTH_CHECK_NO_NOTIFY: '1', HEALTH_CHECK_DRY_LAUNCHCTL: '1', ...extraEnv };
    delete env.OPS_TRIGGER; if (extraEnv.OPS_TRIGGER) env.OPS_TRIGGER = extraEnv.OPS_TRIGGER;
    const t0 = Date.now();
    const c = spawn(process.execPath, [SCRIPT], { env });
    let out = ''; c.stdout.on('data', d => (out += d)); c.stderr.on('data', d => (out += d));
    c.on('exit', code => res({ code, out, ms: Date.now() - t0, got: [...got] }));
  });
}
const events = r => r.got.filter(x => x.path.endsWith('/run-event')).map(x => x.body);

// 1. Clean sweep: silent, success with metrics.raised = 0.
mode = 'clean';
let r = await run();
let ev = events(r);
check('[clean] exit 0; sweep called once as health-check-local', r.code === 0 && r.got.filter(x => x.path.endsWith('/sweep')).length === 1 && r.got[0].emitter === 'health-check-local', r);
check('[clean] start + success events for job local.health-check, same run_id as the sweep body', ev.length === 2 && ev.map(e => e.event).join() === 'start,success'
  && ev.every(e => e.job_id === 'local.health-check' && e.run_id === r.got.find(x => x.path.endsWith('/sweep')).body.run_id), ev);
check('[clean] terminal carries detail.metrics.raised = 0 (daily raise cap input, B-1)', ev[1]?.detail?.metrics?.raised === 0, ev[1]);
check('[clean] no notification (low-noise); "All clear" logged', !/notification suppressed/.test(r.out) && /All clear/.test(rd('health-check.log')), r.out);
check('[clean] trigger manual without OPS_TRIGGER', ev.every(e => e.trigger === 'manual'), ev.map(e => e.trigger));
// MA-OCT-WED28.ENG8 (BREVA S-3): the full response body is logged as one line; the ingest key never is.
const respLine = rd('health-check.log').split('\n').find(l => / \| response \| HTTP 200 /.test(l)) || '';
let logged = null; try { logged = JSON.parse(respLine.replace(/^.* \| response \| HTTP 200 /, '')); } catch { /* not JSON */ }
check('[S-3 log] full sweep body logged verbatim (every field, e.g. open_counts, new, headroom)', logged && logged.ok === true && logged.rows_read === 240
  && JSON.stringify(Object.keys(logged).sort()) === JSON.stringify(['already_open','findings','headroom','hold_all_jobs','new','ok','open_counts','overflow','raised','rows_read','run_id']), respLine);
check('[S-3 log] neither the ingest key nor a request header is in any log', !/test-only-not-a-key|x-ops-emitter|authorization/i.test(rd('health-check.log') + rd('health-check-heartbeat.log')), 'key or header found in log');

// 2. New findings → one notification with count by severity and first titles.
mode = 'findings';
r = await run({ OPS_TRIGGER: 'launchd' });
check('[findings] one notification: count by severity + titles', /notification suppressed\) Meridian Atlas — Needs Attention: 2 new \(1 sev2, 1 sev3\): /.test(r.out), r.out);
check('[findings] metrics.raised = 2; trigger launchd', events(r)[1]?.detail?.metrics?.raised === 2 && events(r).every(e => e.trigger === 'launchd'), events(r));

// 3. Sweep switched off (202) → skipped, exit 0, no notification.
mode = '202';
r = await run();
check('[202] exit 0; terminal skipped; no notification', r.code === 0 && events(r)[1]?.event === 'skipped' && !/notification suppressed/.test(r.out), events(r));

// 4. Sweep HTTP 500 → failed + "could not reach Ops" notification, exit 1.
mode = '500';
r = await run();
check('[500] exit 1; terminal failed http_500; notified', r.code === 1 && events(r)[1]?.event === 'failed' && events(r)[1]?.error?.class === 'http_500' && /could not reach Ops/.test(r.out), events(r));

// 5. Ops unreachable → failed sweep_unreachable, notified, both events spooled to the outbox.
writeCfg('http://127.0.0.1:9/api/ops/ingest');
r = await run();
const outbox = rd('ops-outbox/health-check.jsonl').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).event);
check('[unreachable] exit 1; notified "could not reach Ops"', r.code === 1 && /could not reach Ops/.test(r.out), r.out.slice(-300));
check('[unreachable] start + failed(sweep_unreachable) spooled to the outbox', outbox.length === 2 && outbox[1].event === 'failed' && outbox[1].error.class === 'sweep_unreachable', outbox);

// 6. Next run with Ops back: own events first, then the 2 spooled events replayed with their original run_id.
writeCfg(BASE); mode = 'clean';
r = await run();
ev = events(r);
check('[replay] own start+success, then the 2 spooled events replayed (same run_id); outbox emptied',
  ev.length === 4 && ev[2].run_id === outbox[0].run_id && ev[3].run_id === outbox[1].run_id && rd('ops-outbox/health-check.jsonl').trim() === '', ev.map(e => [e.event, e.run_id.slice(0, 8)]));

// 7. Pause flag → no network at all.
writeFileSync(flag, 'paused by test');
r = await run();
check('[pause] exit 0, logged paused, zero requests', r.code === 0 && r.got.length === 0 && /paused \| pause flag present/.test(rd('health-check.log')), r);
rmSync(flag);

// 8. Missing config → exit 1 and a notification (no silent failure).
rmSync(path.join(secrets, 'health-check-ops-ingest.env'));
r = await run();
check('[config] missing ingest config → exit 1, notified, no requests', r.code === 1 && /Sweep not configured/.test(r.out) && r.got.length === 0, r.out.slice(-300));

// 9. Static: checkpoint moved to 2026-12-31; no D1 token / REST read remains.
const src = readFileSync(SCRIPT, 'utf8');
check('[static] CHECKPOINT_DATE is 2026-12-31; financialfact condition and CF_API_TOKEN / D1 REST reads removed',
  /CHECKPOINT_DATE = new Date\('2026-12-31/.test(src) && !/financialfact_backfill_complete|CF_API_TOKEN|\/d1\/database\//.test(src.replace(/^\s*\/\/.*$/gm, '')), null);

srv.close(); rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
