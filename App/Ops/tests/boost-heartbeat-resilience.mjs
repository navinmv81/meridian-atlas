#!/usr/bin/env node
// MA-OCT-001 — AC8 + Data-Identity Lead condition test for the pilot emitter
// (App/Corporate Atlas/entities-enrich-boost-run.mjs).
//
// Proves that a heartbeat timeout or failure leaves the boost run-log line, the
// exit code and the /run call timing unchanged, that the run-log line is written
// before the terminal heartbeat is sent, that heartbeat output goes only to
// logs/entities-enrich-boost-heartbeat.log, and that the pause path sends nothing.
//
// Zero production side effects: the REAL script is copied into a temp dir and run
// there with (a) a PATH shim standing in for `npx wrangler d1 execute`, (b) a
// preloaded fetch stub standing in for meridian-entities-enrich /run, and (c) local
// HTTP servers (or an unroutable address) standing in for meridian-ops.
//
// Usage: node App/Ops/tests/boost-heartbeat-resilience.mjs

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '../../Corporate Atlas/entities-enrich-boost-run.mjs');
const RUN_URL = 'https://meridian-entities-enrich.navinmv1981.workers.dev/run';

// --- Fake Ops servers: 'ok' records arrival times, '500' fails, 'hang' never answers.
const received = [];
function server(handler) {
  return new Promise(res => { const s = createServer(handler); s.listen(0, '127.0.0.1', () => res(s)); });
}
const okSrv = await server((req, resp) => {
  let b = ''; req.on('data', d => (b += d)); req.on('end', () => {
    try { received.push({ at: Date.now(), evt: JSON.parse(b) }); } catch { /* ignore */ }
    resp.writeHead(201, { 'Content-Type': 'application/json' }); resp.end('{"ok":true,"recorded":true}');
  });
});
const errSrv = await server((req, resp) => { resp.writeHead(500); resp.end('{"ok":false}'); });
const hangSrv = await server(() => { /* never responds */ });
const url = s => `http://127.0.0.1:${s.address().port}/api/ops/ingest/run-event`;
const OPS_TARGETS = {
  control: null,                                        // no .env.ops-ingest → heartbeats are a no-op
  ok: url(okSrv),
  http500: url(errSrv),
  hang: url(hangSrv),                                   // times out at the 2 s ceiling
  unroutable: 'https://10.255.255.1/api/ops/ingest/run-event'
};

// --- Job paths, driven through the shims.
const PATHS = {
  fired:            { writes: 0,     wranglerFail: false, runStatus: 200, expectExit: 0, outcome: 'fired' },
  skipped_headroom: { writes: 99000, wranglerFail: false, runStatus: 200, expectExit: 0, outcome: 'skipped_headroom' },
  headroom_error:   { writes: 0,     wranglerFail: true,  runStatus: 200, expectExit: 1, outcome: 'error' },
  run_http_500:     { writes: 0,     wranglerFail: false, runStatus: 500, expectExit: 0, outcome: 'http_500' }
};

function sandbox(p, opsUrl, paused) {
  const dir = mkdtempSync(path.join(tmpdir(), 'boost-hb-'));
  copyFileSync(SCRIPT, path.join(dir, 'entities-enrich-boost-run.mjs'));
  writeFileSync(path.join(dir, '.env.entities-enrich-run'), 'ENTITIES_ENRICH_RUN_SECRET=test-only-not-a-secret\n');
  if (opsUrl) writeFileSync(path.join(dir, '.env.ops-ingest'),
    `OPS_INGEST_URL=${opsUrl}\nOPS_EMITTER=boost-local\nOPS_INGEST_KEY=test-only-not-a-key\n`);
  if (paused) writeFileSync(path.join(dir, '.entities-enrich-boost-paused'), '');
  const bin = path.join(dir, 'bin'); mkdirSync(bin);
  writeFileSync(path.join(bin, 'npx'), p.wranglerFail
    ? '#!/bin/sh\necho "✘ [ERROR] A request to the Cloudflare API failed. [code: 10000]" >&2\nexit 1\n'
    : `#!/bin/sh\necho '[{"results":[{"value":"${p.writes}"}],"success":true}]'\n`);
  chmodSync(path.join(bin, 'npx'), 0o755);
  writeFileSync(path.join(dir, 'stub-run.mjs'), `
    import { appendFileSync } from 'node:fs';
    const real = globalThis.fetch;
    globalThis.fetch = async (u, o) => {
      if (String(u) === ${JSON.stringify(RUN_URL)}) {
        appendFileSync(${JSON.stringify(path.join(dir, 'run-called.txt'))}, String(Date.now()));
        await new Promise(r => setTimeout(r, 300));
        return new Response(${p.runStatus} === 200 ? '{"ok":true,"message":"Enrichment triggered"}' : '{"error":"stub"}', { status: ${p.runStatus} });
      }
      return real(u, o);
    };`);
  return { dir, bin };
}

function runJob(p, target, paused = false) {
  const { dir, bin } = sandbox(p, OPS_TARGETS[target], paused);
  received.length = 0;
  return new Promise(res => {
    const t0 = Date.now();
    const child = spawn(process.execPath, ['--import', path.join(dir, 'stub-run.mjs'), path.join(dir, 'entities-enrich-boost-run.mjs')],
      { cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, XPC_SERVICE_NAME: '' } });
    let out = ''; child.stdout.on('data', d => (out += d)); child.stderr.on('data', d => (out += d));
    child.on('exit', code => {
      const log = path.join(dir, 'logs', 'entities-enrich-boost.log');
      const hb = path.join(dir, 'logs', 'entities-enrich-boost-heartbeat.log');
      const lines = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
      const runCalledAt = existsSync(path.join(dir, 'run-called.txt')) ? Number(readFileSync(path.join(dir, 'run-called.txt'), 'utf8')) - t0 : null;
      res({ code, ms: Date.now() - t0, lines, hb: existsSync(hb) ? readFileSync(hb, 'utf8').trim().split('\n') : [],
            out, runCalledAt, received: [...received] });
      rmSync(dir, { recursive: true, force: true });
    });
  });
}

// Run-log line minus its own timestamp and the fire-minute fields (which can tick between runs).
const norm = l => (l || '').replace(/^\S+ \| /, '').replace(/utc_minute=\d+ in_window=\w+ ?/, '');
let failures = 0;
const check = (name, ok, got) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); };

for (const [pname, p] of Object.entries(PATHS)) {
  await runJob(p, 'control'); // warm-up, discarded (first node start is cold)
  const control = await runJob(p, 'control');
  check(`[${pname}] control: exit ${p.expectExit}, outcome '${p.outcome}'`,
    control.code === p.expectExit && control.lines.length === 1 && control.lines[0].split(' | ')[1] === p.outcome, control);
  for (const target of ['ok', 'http500', 'hang', 'unroutable']) {
    const r = await runJob(p, target);
    const tag = `[${pname} × ops=${target}]`;
    check(`${tag} exit code unchanged (${r.code})`, r.code === control.code, { code: r.code, control: control.code });
    check(`${tag} run-log line identical`, r.lines.length === 1 && norm(r.lines[0]) === norm(control.lines[0]),
      { got: r.lines, control: control.lines });
    check(`${tag} added wall time <= 2500 ms (${r.ms - control.ms} ms)`, r.ms - control.ms <= 2500, { ms: r.ms, control: control.ms });
    if (control.runCalledAt !== null) {
      check(`${tag} /run timing unchanged (Δ ${r.runCalledAt - control.runCalledAt} ms)`,
        r.runCalledAt !== null && Math.abs(r.runCalledAt - control.runCalledAt) < 250, { got: r.runCalledAt, control: control.runCalledAt });
    }
    check(`${tag} no heartbeat text on stdout/stderr`, !/heartbeat|ops-ingest|X-Ops/i.test(r.out), r.out.slice(-300));
    check(`${tag} heartbeat log written`, r.hb.length >= 1, r.hb);
    if (target === 'ok') {
      const terminal = r.received.find(x => x.evt.event !== 'start');
      const logAt = Date.parse(r.lines[0].split(' | ')[0]);
      check(`${tag} run-log line written BEFORE terminal heartbeat`, terminal && logAt <= terminal.at, { logAt, terminal });
      check(`${tag} event carries slot, fired_at and out_of_window`,
        terminal && /^\d{4}-\d{2}-\d{2}T(10|16):50Z$/.test(terminal.evt.detail.slot) && terminal.evt.detail.fired_at &&
        typeof terminal.evt.detail.out_of_window === 'boolean', terminal && terminal.evt.detail);
      const expected = { fired: 'success', skipped_headroom: 'skipped', headroom_error: 'failed', run_http_500: 'failed' }[pname];
      check(`${tag} terminal event = ${expected}`, terminal && terminal.evt.event === expected, terminal && terminal.evt);
      if (pname === 'headroom_error') check(`${tag} error.class = wrangler_auth_10000 (F6)`, terminal?.evt.error?.class === 'wrangler_auth_10000', terminal?.evt.error);
      if (pname === 'skipped_headroom') check(`${tag} detail.reason = budget`, terminal?.evt.detail.reason === 'budget', terminal?.evt.detail);
      const starts = r.received.filter(x => x.evt.event === 'start').length;
      check(`${tag} start sent only when pre-flight passed (${starts})`, starts === (['fired', 'run_http_500'].includes(pname) ? 1 : 0), starts);
      check(`${tag} items_* never guessed (null/absent)`, terminal && terminal.evt.items_attempted == null && terminal.evt.items_progressed == null, terminal?.evt);
    }
  }
}

// Pause path: still the very first action, and sends nothing.
const paused = await runJob(PATHS.fired, 'ok', true);
check('[paused] exit 0, outcome paused, no /run, no heartbeat sent or logged',
  paused.code === 0 && paused.lines.length === 1 && paused.lines[0].split(' | ')[1] === 'paused' &&
  paused.runCalledAt === null && paused.received.length === 0 && paused.hb.length === 0, paused);

for (const s of [okSrv, errSrv, hangSrv]) { s.closeAllConnections?.(); s.close(); }
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
