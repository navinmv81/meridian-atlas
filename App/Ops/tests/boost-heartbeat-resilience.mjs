#!/usr/bin/env node
// Boost-runner resilience test.
//  - MA-OCT-001 AC8: a heartbeat timeout or failure leaves the run-log line, the
//    exit code and the /run timing unchanged; run-log line written before the
//    terminal heartbeat; heartbeat output only in the heartbeat log; pause = no
//    network.
//  - MA-OCT-002a AC-a4 (spec §8, CR-5): local outbox (spool, same-run_id replay,
//    4xx/202 not spooled, 6-day expiry to expired.jsonl, replay max 10 and stop at
//    first failure, replay never before /run); out-of-window fires make no /run call
//    and report skipped/out_of_window; headroom from d1-today (below 5,000 →
//    skipped/budget; unreachable → failed/headroom_unavailable, no /run); no
//    wrangler/npx in the runner; FIRDS runner pinned by path; trigger label.
//
// Zero production side effects: the runner (and lib/ops-outbox.mjs) are copied
// into a temp dir and run there with a preload that fixes the clock and stubs
// /run and d1-today, and local HTTP servers (or an unroutable address) standing
// in for meridian-ops.
//
// Usage: node App/Ops/tests/boost-heartbeat-resilience.mjs
//        BOOST_RUNNER=<path> to test another runner file (default: the .next
//        runner if present, else the live runner).

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '../../Corporate Atlas');
const RUNNER = process.env.BOOST_RUNNER
  || (existsSync(path.join(CA, 'entities-enrich-boost-run.next.mjs')) ? path.join(CA, 'entities-enrich-boost-run.next.mjs')
                                                                      : path.join(CA, 'entities-enrich-boost-run.mjs'));
const OUTBOX_LIB = path.join(CA, 'lib/ops-outbox.mjs');
const RUN_URL = 'https://meridian-entities-enrich.navinmv1981.workers.dev/run';
const D1_URL = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/cf/d1-today';
const IN_WINDOW = '2026-10-12T10:51:00.000Z';
const OUT_OF_WINDOW = '2026-10-12T11:02:00.000Z';

// --- Fake Ops servers ------------------------------------------------------
const received = [];
let failFirst = 0;   // for 'flaky': answer 201 to the first N requests, then 500
function server(handler) {
  return new Promise(res => { const s = createServer(handler); s.listen(0, '127.0.0.1', () => res(s)); });
}
function recorder(statusFor) {
  return (req, resp) => {
    let b = ''; req.on('data', d => (b += d)); req.on('end', () => {
      let evt = null; try { evt = JSON.parse(b); } catch { /* ignore */ }
      const n = received.length;
      received.push({ at: Date.now(), evt });
      const status = statusFor(n, evt);
      resp.writeHead(status, { 'Content-Type': 'application/json' });
      resp.end(status === 201 ? '{"ok":true,"recorded":true}' : status === 200 ? '{"ok":true,"recorded":false,"reason":"duplicate"}'
             : status === 202 ? '{"ok":true,"recorded":false,"reason":"ingest_disabled"}' : `{"ok":false,"status":${status}}`);
    });
  };
}
const srv = {
  ok:      await server(recorder(() => 201)),
  dup:     await server(recorder(() => 200)),
  s202:    await server(recorder(() => 202)),
  s401:    await server(recorder(() => 401)),
  s422:    await server(recorder(() => 422)),
  s500:    await server(recorder(() => 500)),
  flaky:   await server(recorder(n => (n < failFirst ? 201 : 500))),
  hang:    await server(() => { /* never responds */ })
};
const url = s => `http://127.0.0.1:${s.address().port}/api/ops/ingest/run-event`;
const OPS = Object.fromEntries(Object.entries(srv).map(([k, s]) => [k, url(s)]));
OPS.control = null;                                                   // no .env.ops-ingest → heartbeats are a no-op
OPS.unroutable = 'https://10.255.255.1/api/ops/ingest/run-event';

// --- Sandbox ---------------------------------------------------------------
function sandbox({ ops, paused = false, now = IN_WINDOW, d1 = 'ok:390', runStatus = 200, trigger = null, outbox = null }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'boost-hb-'));
  copyFileSync(RUNNER, path.join(dir, 'entities-enrich-boost-run.mjs'));
  mkdirSync(path.join(dir, 'lib'));
  copyFileSync(OUTBOX_LIB, path.join(dir, 'lib/ops-outbox.mjs'));
  mkdirSync(path.join(dir, 'secrets'));   // ML-1011-2: runner reads MERIDIAN_SECRETS_DIR (default ~/.meridian-secrets)
  writeFileSync(path.join(dir, 'secrets/entities-enrich-run.env'), 'ENTITIES_ENRICH_RUN_SECRET=test-only-not-a-secret\n');
  if (ops) writeFileSync(path.join(dir, 'secrets/ops-ingest.env'), `OPS_INGEST_URL=${ops}\nOPS_EMITTER=boost-local\nOPS_INGEST_KEY=test-only-not-a-key\n`);
  if (paused) writeFileSync(path.join(dir, '.entities-enrich-boost-paused'), '');
  if (outbox) { mkdirSync(path.join(dir, 'logs/ops-outbox'), { recursive: true }); writeFileSync(path.join(dir, 'logs/ops-outbox/entities-enrich-boost.jsonl'), outbox); }
  writeFileSync(path.join(dir, 'stub.mjs'), `
    import { appendFileSync } from 'node:fs';
    const T0 = Date.parse(${JSON.stringify(now)}), REAL = Date, start = REAL.now();
    class FakeDate extends REAL { constructor(...a) { a.length ? super(...a) : super(T0 + (REAL.now() - start)); }
      static now() { return T0 + (REAL.now() - start); } }
    globalThis.Date = FakeDate;
    const real = globalThis.fetch, log = (f, v) => appendFileSync(${JSON.stringify(dir)} + '/' + f, v + '\\n');
    log('clock.txt', start + ' ' + T0);   // real start + fake T0, so the test can map log timestamps to real time
    globalThis.fetch = async (u, o) => {
      if (String(u) === ${JSON.stringify(RUN_URL)}) {
        log('run-called.txt', REAL.now()); await new Promise(r => setTimeout(r, 300));
        return new Response(${runStatus} === 200 ? '{"ok":true,"message":"Enrichment triggered"}' : '{"error":"stub"}', { status: ${runStatus} });
      }
      if (String(u) === ${JSON.stringify(D1_URL)}) {
        log('d1-called.txt', REAL.now());
        const m = ${JSON.stringify(d1)};
        if (m === 'unreachable') throw new TypeError('fetch failed');
        if (m === 'notok') return new Response('{"ok":false}', { status: 500 });
        return new Response(JSON.stringify({ ok: true, date: '2026-10-12', rowsWritten: Number(m.split(':')[1]), daily_cap: 100000 }), { status: 200 });
      }
      return real(u, o);
    };`);
  return dir;
}

function run(opts) {
  const dir = sandbox(opts);
  received.length = 0;
  return new Promise(res => {
    const t0 = Date.now();
    const env = { ...process.env, PATH: process.env.PATH, XPC_SERVICE_NAME: '', MERIDIAN_SECRETS_DIR: path.join(dir, 'secrets') };
    delete env.OPS_TRIGGER; if (opts.trigger) env.OPS_TRIGGER = opts.trigger;
    const child = spawn(process.execPath, ['--import', path.join(dir, 'stub.mjs'), path.join(dir, 'entities-enrich-boost-run.mjs')], { cwd: dir, env });
    let out = ''; child.stdout.on('data', d => (out += d)); child.stderr.on('data', d => (out += d));
    child.on('exit', code => {
      const rd = f => (existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean) : []);
      res({ code, ms: Date.now() - t0, out, lines: rd('logs/entities-enrich-boost.log'), hb: rd('logs/entities-enrich-boost-heartbeat.log'),
            outbox: rd('logs/ops-outbox/entities-enrich-boost.jsonl'), expired: rd('logs/ops-outbox/expired.jsonl'),
            runCalled: rd('run-called.txt').map(Number), d1Called: rd('d1-called.txt').length, received: [...received], t0,
            clock: (rd('clock.txt')[0] || '0 0').split(' ').map(Number) });
      rmSync(dir, { recursive: true, force: true });
    });
  });
}

const norm = l => (l || '').replace(/^\S+ \| /, '');
// Run-log timestamps are on the stubbed clock; map them back to real time.
const logReal = (r, line) => Date.parse(line.split(' | ')[0]) - r.clock[1] + r.clock[0];
let failures = 0, passes = 0;
const check = (name, ok, got) => { ok ? passes++ : failures++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 600)}`); };
const outcomeOf = r => (r.lines[0] || '').split(' | ')[1];

console.log(`Runner under test: ${path.relative(path.resolve(HERE, '../..'), RUNNER)}`);

// 1. Failure matrix (AC8 + AC-a4): each path vs control, against every Ops failure mode.
const PATHS = {
  fired:             { now: IN_WINDOW,     d1: 'ok:390',   runStatus: 200, exit: 0, outcome: 'fired',                 terminal: 'success', run: true },
  skipped_headroom:  { now: IN_WINDOW,     d1: 'ok:96000', runStatus: 200, exit: 0, outcome: 'skipped_headroom',      terminal: 'skipped', run: false, reason: 'budget' },
  headroom_unavail:  { now: IN_WINDOW,     d1: 'unreachable', runStatus: 200, exit: 1, outcome: 'error',              terminal: 'failed',  run: false, errClass: 'headroom_unavailable' },
  d1_not_ok:         { now: IN_WINDOW,     d1: 'notok',    runStatus: 200, exit: 1, outcome: 'error',                 terminal: 'failed',  run: false, errClass: 'headroom_unavailable' },
  run_http_500:      { now: IN_WINDOW,     d1: 'ok:390',   runStatus: 500, exit: 0, outcome: 'http_500',              terminal: 'failed',  run: true },
  out_of_window:     { now: OUT_OF_WINDOW, d1: 'ok:390',   runStatus: 200, exit: 0, outcome: 'skipped_out_of_window', terminal: 'skipped', run: false, reason: 'out_of_window' }
};
for (const [pname, p] of Object.entries(PATHS)) {
  await run({ ops: null, ...p });                              // warm-up (first node start is cold)
  const control = await run({ ops: null, ...p });
  check(`[${pname}] control: exit ${p.exit}, outcome '${p.outcome}', /run ${p.run ? 'called' : 'NOT called'}`,
    control.code === p.exit && control.lines.length === 1 && outcomeOf(control) === p.outcome && (control.runCalled.length === 1) === p.run, control);
  if (pname === 'out_of_window') {
    check('[out_of_window] run-log line keeps the 3-field layout with utc_minute and in_window=false',
      /^\S+ \| skipped_out_of_window \| utc_minute=2 in_window=false$/.test(control.lines[0]), control.lines);
    check('[out_of_window] no d1-today call', control.d1Called === 0, control.d1Called);
  }
  if (pname === 'fired') check('[fired] run-log line carries the d1-today total and headroom_80k',
    /writes_today=390 headroom=99610 headroom_80k=79610 /.test(control.lines[0]), control.lines);
  for (const target of ['ok', 's500', 'hang', 'unroutable']) {
    const r = await run({ ops: OPS[target], ...p });
    const tag = `[${pname} × ops=${target}]`;
    check(`${tag} exit code unchanged`, r.code === control.code, { code: r.code, control: control.code });
    check(`${tag} run-log line identical`, r.lines.length === 1 && norm(r.lines[0]) === norm(control.lines[0]), { got: r.lines, control: control.lines });
    check(`${tag} added wall time <= 2500 ms (${r.ms - control.ms} ms)`, r.ms - control.ms <= 2500, { ms: r.ms, control: control.ms });
    if (p.run) check(`${tag} /run timing unchanged`, r.runCalled.length === 1 && Math.abs((r.runCalled[0] - r.t0) - (control.runCalled[0] - control.t0)) < 250,
      { got: r.runCalled[0] - r.t0, control: control.runCalled[0] - control.t0 });
    else check(`${tag} /run NOT called`, r.runCalled.length === 0, r.runCalled);
    check(`${tag} nothing heartbeat-related on stdout/stderr`, !/heartbeat|ops-ingest|X-Ops|outbox/i.test(r.out), r.out.slice(-300));
    if (target === 'ok') {
      const term = r.received.find(x => x.evt.event !== 'start');
      const logAt = logReal(r, r.lines[0]);
      check(`${tag} terminal event = ${p.terminal}`, term && term.evt.event === p.terminal, term && term.evt);
      check(`${tag} run-log line written BEFORE the terminal heartbeat`, term && logAt <= term.at + 5, { logAt, at: term && term.at });
      if (p.reason) check(`${tag} detail.reason = ${p.reason}`, term?.evt.detail.reason === p.reason, term?.evt.detail);
      if (p.errClass) check(`${tag} error.class = ${p.errClass}`, term?.evt.error?.class === p.errClass, term?.evt.error);
      check(`${tag} start sent only when the pre-flight passed`, r.received.filter(x => x.evt.event === 'start').length === (p.run ? 1 : 0), r.received.map(x => x.evt.event));
      check(`${tag} slot + fired_at + out_of_window present`, /^\d{4}-\d{2}-\d{2}T(10|16):50Z$/.test(term?.evt.detail.slot) && typeof term?.evt.detail.out_of_window === 'boolean', term?.evt.detail);
      check(`${tag} trigger = manual (no OPS_TRIGGER)`, term?.evt.trigger === 'manual', term?.evt.trigger);
      check(`${tag} outbox empty after a delivered run`, r.outbox.length === 0, r.outbox);
    }
    if (target === 's500' || target === 'hang' || target === 'unroutable') {
      const expected = p.run ? 2 : 1;   // start + terminal, or terminal only
      check(`${tag} undelivered events spooled (${expected})`, r.outbox.length === expected, r.outbox);
    }
  }
}

// 2. Not spooled: 202 and permanent 4xx.
for (const t of ['s202', 's401', 's422']) {
  const r = await run({ ops: OPS[t], ...PATHS.fired });
  check(`[not spooled: ${t}] outbox stays empty`, r.outbox.length === 0 && r.code === 0, r.outbox);
}

// 3. Spool then replay on the NEXT run, same run_id; replay after /run and after own terminal.
{
  const r1 = await run({ ops: OPS.s500, ...PATHS.fired });
  const spooled = r1.outbox.map(l => JSON.parse(l).event);
  check('[replay] run 1 (Ops 500): start + success spooled', spooled.length === 2 && spooled.map(e => e.event).join() === 'start,success', spooled);
  const r2 = await run({ ops: OPS.ok, ...PATHS.fired, outbox: r1.outbox.join('\n') + '\n' });
  const ids = r2.received.map(x => x.evt.run_id);
  const ownId = r2.received[0]?.evt.run_id;
  const replayed = r2.received.filter(x => x.evt.run_id !== ownId);
  check('[replay] run 2 delivers its own 2 events, then replays both spooled events with their original run_id',
    replayed.length === 2 && replayed.every(x => x.evt.run_id === spooled[0].run_id), ids);
  const ownTerminal = r2.received.find(x => x.evt.run_id === ownId && x.evt.event !== 'start');
  check('[replay] replay never before /run, nor before the run-log line or own terminal heartbeat',
    replayed.every(x => x.at > r2.runCalled[0] && x.at >= logReal(r2, r2.lines[0]) && x.at >= ownTerminal.at), { replayed: replayed.map(x => x.at), run: r2.runCalled[0] });
  check('[replay] outbox empty afterwards (rewritten atomically)', r2.outbox.length === 0, r2.outbox);
  check('[replay] heartbeat log records the replay summary', r2.hb.some(l => /outbox replay \| delivered=2 expired=0 remaining=0/.test(l)), r2.hb);
  const rd = await run({ ops: OPS.dup, ...PATHS.fired, outbox: r1.outbox.join('\n') + '\n' });
  check('[replay] 200 duplicate counts as delivered and is removed', rd.outbox.length === 0, rd.outbox);
}

// 4. Replay cap (10) and stop at the first failure.
{
  const mk = (i, ageDays = 0) => JSON.stringify({ spooled_at: 'x', event: { v: 1, run_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, job_id: 'local.entities-enrich-boost',
    event: 'failed', started_at: new Date(Date.parse(IN_WINDOW) - ageDays * 86400000).toISOString(), error: { class: 'x', summary: 'y' } } });
  const twelve = Array.from({ length: 12 }, (_, i) => mk(i)).join('\n') + '\n';
  const r = await run({ ops: OPS.ok, ...PATHS.fired, outbox: twelve });
  check('[cap] at most 10 replayed per run; 2 remain', r.received.length === 2 + 10 && r.outbox.length === 2, { sent: r.received.length, left: r.outbox.length });
  failFirst = 4;                                          // own start + own terminal + 2 replays succeed, then 500
  const five = Array.from({ length: 5 }, (_, i) => mk(i)).join('\n') + '\n';
  const rf = await run({ ops: OPS.flaky, ...PATHS.fired, outbox: five });
  check('[stop] replay stops at the first failure; 3 remain', rf.received.length === 5 && rf.outbox.length === 3, { sent: rf.received.length, left: rf.outbox.length });
  failFirst = 0;
  // 5. Expiry: > 6 days moves to expired.jsonl, counted and logged, never sent.
  const mixed = [mk(1, 7), mk(2, 0)].join('\n') + '\n';
  const re = await run({ ops: OPS.ok, ...PATHS.fired, outbox: mixed });
  check('[expiry] 7-day-old event moved to expired.jsonl (not sent); fresh one replayed',
    re.expired.length === 1 && re.outbox.length === 0 && re.received.length === 3 && re.hb.some(l => /EXPIRED \(permanent loss, counted\)/.test(l)), { expired: re.expired.length, sent: re.received.length, hb: re.hb });
  // 6. A paused run does no network work at all — not even replay.
  const rp = await run({ ops: OPS.ok, ...PATHS.fired, paused: true, outbox: twelve });
  check('[paused] outcome paused, exit 0, no /run, no d1-today, no heartbeat, no replay, outbox untouched',
    rp.code === 0 && outcomeOf(rp) === 'paused' && rp.runCalled.length === 0 && rp.d1Called === 0 && rp.received.length === 0 && rp.hb.length === 0 && rp.outbox.length === 12, rp);
  // 7. Own failed heartbeat → no replay attempt this run (outage), own events spooled for the next run.
  const ro = await run({ ops: OPS.s500, ...PATHS.fired, outbox: five });
  check('[outage] own terminal undelivered → no replay this run; outbox = 5 old + 2 own', ro.received.length === 2 && ro.outbox.length === 7, { sent: ro.received.length, left: ro.outbox.length });
}

// 8. trigger label.
{
  const r = await run({ ops: OPS.ok, ...PATHS.fired, trigger: 'launchd' });
  check('[trigger] OPS_TRIGGER=launchd → trigger launchd on every event', r.received.length === 2 && r.received.every(x => x.evt.trigger === 'launchd'), r.received.map(x => x.evt.trigger));
}

// 9. Static checks: no wrangler/npx in the boost runner; FIRDS pinned by path; status prints versions.
{
  const src = readFileSync(RUNNER, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  check('[static] boost runner has no wrangler / npx / child_process call', !/\bnpx\b|execFileSync|child_process|'wrangler'/.test(src), null);
  check('[static] boost runner reads run secrets from MERIDIAN_SECRETS_DIR / ~/.meridian-secrets, not the repo (ML-1011-2)',
    /\.meridian-secrets/.test(readFileSync(RUNNER, 'utf8')) && !/SCRIPT_DIR, '\.env\./.test(src), null);
  const firds = path.join(CA, existsSync(path.join(CA, 'firds-local-seed.next.mjs')) ? 'firds-local-seed.next.mjs' : 'firds-local-seed.mjs');
  const fs = readFileSync(firds, 'utf8');
  check(`[static] ${path.basename(firds)} calls node_modules/.bin/wrangler by path, never npx`,
    /path\.join\(SCRIPT_DIR, 'node_modules', '\.bin', 'wrangler'\)/.test(fs) && !/'npx'/.test(fs), null);
  const st = path.join(CA, 'scripts', existsSync(path.join(CA, 'scripts/firds-seed-status.next.sh')) ? 'firds-seed-status.next.sh' : 'firds-seed-status.sh');
  check(`[static] ${path.basename(st)} prints pinned + installed wrangler and refuses on mismatch`,
    /wrangler pinned:/.test(readFileSync(st, 'utf8')) && /wrangler installed:/.test(readFileSync(st, 'utf8')) && /mismatch/.test(readFileSync(st, 'utf8')), null);
  const pkg = path.join(CA, existsSync(path.join(CA, 'package.json.next')) ? 'package.json.next' : 'package.json');
  check(`[static] ${path.basename(pkg)} pins wrangler exactly to 4.96.0`, JSON.parse(readFileSync(pkg, 'utf8')).devDependencies?.wrangler === '4.96.0', null);
}

for (const s of Object.values(srv)) { s.closeAllConnections?.(); s.close(); }
console.log(`\n${passes} passed, ${failures} failed`);
console.log(failures ? 'FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
