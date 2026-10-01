#!/usr/bin/env node
// MA-SEP-010 — payload for the "entities-enrich-boost" LaunchAgent.
//
// Invokes meridian-entities-enrich's existing /run endpoint additional
// times/day, entirely outside Cloudflare's Cron Trigger accounting (the
// account is at its Free-plan cap of 5/5 — see MA-SEP-010_Change_Request.md).
// Mirrors MA-SEP-003's firds-local-seed.mjs control pattern: a pause-flag
// check as the very first thing, before any network/D1 activity, and a
// one-line-per-run append to a log file read by *-status.sh. Unlike
// firds-local-seed.mjs, this script does not talk to D1 for the actual work
// (that's entities-enrich.js's job, server-side) — it only (a) does a
// pre-flight read of the shared write-budget counter, and (b) makes one
// authenticated HTTP call to /run.
//
// TWO REAL CONSTRAINTS THIS SCRIPT EXISTS TO RESPECT (both from the Change
// Request's Risk Assessment, both real, both verified live 2026-08-27, not
// assumed):
//
// 1. entities-enrich.js's /run dispatches on wall-clock getMinutes() at
//    call time — mins<50 runs only Phase 1 (cheap ISIN population, 0 GLEIF
//    subrequests), mins>=50 runs Phase 2+3 (the actual GLEIF enrichment this
//    packet exists to accelerate). A LaunchAgent fire that lands outside
//    :50-:59 (e.g. the Mac was asleep and launchd fired late on wake) is a
//    SILENT no-op for Phase 3 purposes — it still "succeeds" (HTTP 200,
//    Phase 1 runs), so this script explicitly checks and logs which case it
//    was rather than let that pass unnoticed. It fires /run regardless (a
//    Phase-1-only run is still real, harmless benefit), but the log line
//    makes an off-window fire immediately visible to *-status.sh.
//
// 2. The Worker's own checkWriteBudget() (needs 5,000 headroom against the
//    shared account-wide 100,000/day D1 write cap) returns HTTP 429 if
//    insufficient — but per the Change Request's mandatory requirement,
//    this script does NOT rely on that 429 alone. It does its own direct
//    `wrangler d1 execute` read of writes_today_<date> first and refuses to
//    call /run at all if real headroom is short, using the same threshold
//    the Worker itself uses (REQUIRED_HEADROOM) so the two checks agree.
//    Real risk this guards against: Known Issue 22.12 (meridian-holdings'
//    accelerating Sunday write volume) — mitigated further by
//    entities-enrich-boost-install.sh deliberately scheduling fire times
//    outside the Sunday 04:00-07:00 UTC window where practical.
//
// MA-OCT-001 (pilot emitter, Q1=A; Data-Identity Lead ACK 2026-10-01 18:41
// UTC with conditions): each run also reports to the Ops run ledger
// (meridian-ops POST /api/ops/ingest/run-event, contract v1) — `start` once
// the pre-flight passes (sent concurrently with /run, never delaying it),
// then one terminal event AFTER the run-log line above is written. Heartbeats
// are fire-and-forget with a 2 s ceiling, never change the exit code, the
// /run call or its timing, and log only to logs/entities-enrich-boost-heartbeat.log.
// The pause path sends nothing (it stays "no network/D1 activity").
// Kill switch on this side: delete .env.ops-ingest (heartbeats become a no-op).

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAUSE_FLAG_PATH = path.join(SCRIPT_DIR, '.entities-enrich-boost-paused');
const LOG_DIR = path.join(SCRIPT_DIR, 'logs');
const LOG_PATH = path.join(LOG_DIR, 'entities-enrich-boost.log');
const ENV_FILE_PATH = path.join(SCRIPT_DIR, '.env.entities-enrich-run');

const RUN_URL = 'https://meridian-entities-enrich.navinmv1981.workers.dev/run';
const DB_NAME = 'meridian-etf'; // matches wrangler-entities-enrich.toml's [[d1_databases]] database_name

// Mirrors entities-enrich.js's own DAILY_CAP / checkWriteBudget()
// REQUIRED_HEADROOM exactly — deliberately kept in sync so this pre-flight
// check and the Worker's own guard agree on what "safe" means. If that
// Worker-side constant is ever revised, update this one too.
const DAILY_CAP = 100000;
const REQUIRED_HEADROOM = 5000;

function appendRunLog(outcome, detail) {
  mkdirSync(LOG_DIR, { recursive: true });
  const line = `${new Date().toISOString()} | ${outcome} | ${detail}\n`;
  appendFileSync(LOG_PATH, line, 'utf8');
}

// --- ops-heartbeat (MA-OCT-001, contract v1). Vendored, no cross-folder imports.
const OPS_ENV_PATH = path.join(SCRIPT_DIR, '.env.ops-ingest');
const HEARTBEAT_LOG_PATH = path.join(LOG_DIR, 'entities-enrich-boost-heartbeat.log');
const OPS_JOB_ID = 'local.entities-enrich-boost';
const HEARTBEAT_CEILING_MS = 2000;
// Mirrors FIRE_HOURS_UTC in scripts/entities-enrich-boost-install.sh (all at :50).
const SCHEDULED_SLOT_HOURS_UTC = [10, 16];

function appendHeartbeatLog(text) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(HEARTBEAT_LOG_PATH, `${new Date().toISOString()} | ${text}\n`, 'utf8');
  } catch { /* heartbeat logging must never affect the job */ }
}

function loadOpsConfig() {
  try {
    if (!existsSync(OPS_ENV_PATH)) return null;
    const env = Object.fromEntries(readFileSync(OPS_ENV_PATH, 'utf8').split('\n')
      .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
    if (!env.OPS_INGEST_URL || !env.OPS_EMITTER || !env.OPS_INGEST_KEY) return null;
    return { url: env.OPS_INGEST_URL, emitter: env.OPS_EMITTER, key: env.OPS_INGEST_KEY };
  } catch { return null; }
}

function redact(s) {
  return s.replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
          .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}

// The scheduled slot this fire belongs to: the latest SCHEDULED_SLOT_HOURS_UTC:50
// at or before `now` (a late fire after a sleeping Mac still maps to its slot).
function scheduledSlot(now) {
  for (let back = 0; back < 2; back++) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
    for (const h of [...SCHEDULED_SLOT_HOURS_UTC].sort((a, b) => b - a)) {
      const slot = new Date(day.getTime() + (h * 60 + 50) * 60000);
      if (slot <= now) return slot.toISOString().slice(0, 16) + 'Z';
    }
  }
  return null;
}

// Never throws, never writes to stdout/stderr; outcome goes to the heartbeat log only.
// Uses node:http(s) rather than fetch: at the ceiling the request is destroyed,
// which also kills a still-connecting socket. (fetch's AbortSignal leaves the TCP
// connect running, which kept the process alive ~10 s on an unroutable host.)
function sendOpsEvent(cfg, evt) {
  if (!cfg) { appendHeartbeatLog(`${evt.event} | not sent: .env.ops-ingest not configured`); return Promise.resolve(); }
  return new Promise(resolve => {
    let done = false;
    const finish = text => { if (!done) { done = true; appendHeartbeatLog(`${evt.event} | run_id=${evt.run_id} | ${text}`); resolve(); } };
    try {
      const body = JSON.stringify({ v: 1, ...evt,
        error: evt.error ? { class: String(evt.error.class || 'ERROR').slice(0, 64),
                             summary: redact(String(evt.error.summary || '')).slice(0, 500) } : null });
      const u = new URL(cfg.url);
      const req = (u.protocol === 'http:' ? http : https).request(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
                   'X-Ops-Emitter': cfg.emitter, 'X-Ops-Ingest-Key': cfg.key }
      }, resp => {
        let text = '';
        resp.setEncoding('utf8');
        resp.on('data', d => { text += d; });
        resp.on('end', () => finish(`HTTP ${resp.statusCode} ${text.replace(/\n/g, ' ').slice(0, 200)}`));
        resp.on('error', e => finish(`not delivered: ${(e && e.name) || 'Error'}`));
      });
      const timer = setTimeout(() => { finish('not delivered: TimeoutError'); req.destroy(); }, HEARTBEAT_CEILING_MS);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      req.on('error', e => finish(`not delivered: ${(e && (e.code || e.name)) || 'Error'}`));
      req.end(body);
    } catch (e) {
      finish(`not delivered: ${(e && e.name) || 'Error'}`);
    }
  });
}

// Resolves after the given heartbeat promises settle, or after the ceiling — whichever is first.
function settleHeartbeats(promises) {
  return Promise.race([
    Promise.allSettled(promises),
    new Promise(r => setTimeout(r, HEARTBEAT_CEILING_MS).unref())
  ]);
}

const RUN = { cfg: null, id: null, startedAt: null, slot: null, outOfWindow: null, pending: [] };

function runEvent(event, extra = {}) {
  const now = new Date();
  const evt = {
    run_id: RUN.id, job_id: OPS_JOB_ID, event,
    trigger: process.env.XPC_SERVICE_NAME === 'com.meridianatlas.entities-enrich-boost' ? 'launchd' : 'manual',
    started_at: RUN.startedAt.toISOString(),
    detail: { slot: RUN.slot, fired_at: RUN.startedAt.toISOString(), out_of_window: RUN.outOfWindow, ...(extra.detail || {}) }
  };
  if (event !== 'start') { evt.ended_at = now.toISOString(); evt.duration_ms = now - RUN.startedAt; }
  if (extra.error) evt.error = extra.error;
  return evt;
}

// Terminal heartbeat: called only AFTER the run-log line is written; awaited with the 2 s ceiling.
async function heartbeatEnd(event, extra) {
  if (!RUN.id) return;
  RUN.pending.push(sendOpsEvent(RUN.cfg, runEvent(event, extra)));
  await settleHeartbeats(RUN.pending);
}

function loadSecret() {
  if (!existsSync(ENV_FILE_PATH)) {
    throw new Error(`Secret file not found at ${ENV_FILE_PATH} — expected ENTITIES_ENRICH_RUN_SECRET=<value>`);
  }
  const text = readFileSync(ENV_FILE_PATH, 'utf8');
  const line = text.split('\n').find(l => l.startsWith('ENTITIES_ENRICH_RUN_SECRET='));
  if (!line) throw new Error(`ENTITIES_ENRICH_RUN_SECRET not found in ${ENV_FILE_PATH}`);
  const value = line.slice('ENTITIES_ENRICH_RUN_SECRET='.length).trim();
  if (!value) throw new Error(`ENTITIES_ENRICH_RUN_SECRET is empty in ${ENV_FILE_PATH}`);
  return value;
}

// Same `wrangler d1 execute --command --json` transport firds-local-seed.mjs
// uses for real local D1 access (via wrangler's own authenticated session —
// no separate CF_API_TOKEN needed here).
function queryWritesToday() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `writes_today_${today}`;
  const sql = `SELECT value FROM holdings_pipeline_state WHERE key = '${key}'`;
  let out;
  try {
    // stdio explicit (not just relying on execFileSync's default pipe) so
    // this behaves identically whether stdin is a real TTY, /dev/null, or
    // closed — matters because this script runs unattended under launchd,
    // which gives it none of the above in the way an interactive shell does.
    out = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql],
      { maxBuffer: 1024 * 1024 * 8, timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    // MA-SEP-010, 2026-08-27: a real live failure here (first end-to-end
    // test, fired via a detached/background process rather than an
    // interactive shell) surfaced that execFileSync's err.message alone
    // ("Command failed: ...") hides the actual cause — no stdout/stderr was
    // logged, so the real reason was invisible. Surfacing everything
    // execFileSync actually captured, not just .message, so a repeat is
    // diagnosable instead of a black box.
    const detail = [
      `message=${err.message}`,
      err.status !== undefined ? `status=${err.status}` : null,
      err.signal ? `signal=${err.signal}` : null,
      err.stdout ? `stdout=${String(err.stdout).slice(0, 500)}` : null,
      err.stderr ? `stderr=${String(err.stderr).slice(0, 500)}` : null
    ].filter(Boolean).join(' | ');
    throw new Error(`wrangler d1 execute failed: ${detail}`);
  }
  const jsonStart = out.search(/[[{]/);
  const parsed = JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : out);
  const row = parsed?.[0]?.results?.[0];
  const writesToday = parseInt(row?.value ?? '0', 10);
  return { key, writesToday };
}

async function main() {
  console.log('=== MA-SEP-010: entities-enrich-boost invocation ===\n');

  // Pause check MUST be the very first thing — before any network call or
  // D1 read/write — mirrors firds-local-seed.mjs's Requirement 6 pattern.
  if (existsSync(PAUSE_FLAG_PATH)) {
    console.log(`Pause flag present at ${PAUSE_FLAG_PATH} — paused, skipping this run.`);
    appendRunLog('paused', 'skipped run — pause flag set, no network/D1 activity');
    return;
  }

  const nowUtc = new Date();
  const utcMinute = nowUtc.getUTCMinutes();
  const inWindow = utcMinute >= 50;
  console.log(`Fire time (UTC): ${nowUtc.toISOString()} — minute=${utcMinute}, in :50-:59 window: ${inWindow}`);
  if (!inWindow) {
    console.log('WARNING: this fire landed outside :50-:59 — /run will only execute Phase 1 (cheap ISIN pass), NOT Phase 3. This invocation will not count toward backlog throughput. Check the LaunchAgent schedule / whether the Mac was asleep at the intended fire time.');
  }
  Object.assign(RUN, { cfg: loadOpsConfig(), id: randomUUID(), startedAt: nowUtc,
                       slot: scheduledSlot(nowUtc), outOfWindow: !inWindow });

  console.log('\nPre-flight headroom check (direct D1 read, not relying on the Worker\'s own 429 alone)...');
  let writesToday, headroom;
  try {
    ({ writesToday } = queryWritesToday());
    headroom = DAILY_CAP - writesToday;
  } catch (err) {
    console.error('Headroom check failed:', err.message);
    appendRunLog('error', `headroom check failed: ${err.message.replace(/\n/g, ' ').slice(0, 300)}`);
    await heartbeatEnd('failed', { error: {
      class: /\b10000\b/.test(err.message) ? 'wrangler_auth_10000' : 'headroom_check_failed',
      summary: `headroom check failed: ${err.message.replace(/\n/g, ' ')}` } });
    process.exit(1);
  }
  console.log(`  writes_today: ${writesToday.toLocaleString()} / ${DAILY_CAP.toLocaleString()} (headroom: ${headroom.toLocaleString()}, required: ${REQUIRED_HEADROOM.toLocaleString()})`);

  if (headroom < REQUIRED_HEADROOM) {
    console.log('Insufficient real headroom — refusing to call /run this fire.');
    appendRunLog('skipped_headroom', `writes_today=${writesToday} headroom=${headroom} required=${REQUIRED_HEADROOM} utc_minute=${utcMinute}`);
    await heartbeatEnd('skipped', { detail: { reason: 'budget', writes_today: writesToday, headroom, required: REQUIRED_HEADROOM } });
    return;
  }

  // Pre-flight passed: `start` goes out concurrently — never awaited before /run.
  RUN.pending.push(sendOpsEvent(RUN.cfg, runEvent('start')));

  const secret = loadSecret();

  console.log(`\nCalling ${RUN_URL} ...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(RUN_URL, {
      headers: { 'X-Enrich-Run-Secret': secret },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const bodyText = await resp.text();
    console.log(`  HTTP ${resp.status}: ${bodyText}`);
    const outcome = resp.ok ? 'fired' : `http_${resp.status}`;
    appendRunLog(outcome, `utc_minute=${utcMinute} in_window=${inWindow} writes_today=${writesToday} headroom=${headroom} response=${bodyText.replace(/\n/g, ' ').slice(0, 200)}`);
    // /run only triggers enrichment (async server-side) and returns no counters,
    // so items_attempted / items_progressed stay null (A1: never guessed).
    await heartbeatEnd(resp.ok ? 'success' : 'failed', resp.ok
      ? { detail: { http_status: resp.status } }
      : { error: { class: `http_${resp.status}`, summary: bodyText.replace(/\n/g, ' ') }, detail: { http_status: resp.status } });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Request to /run failed:', err.message);
    appendRunLog('error', `request failed: ${err.message.replace(/\n/g, ' ').slice(0, 300)} utc_minute=${utcMinute}`);
    await heartbeatEnd('failed', { error: { class: 'run_request_failed', summary: `request failed: ${err.message.replace(/\n/g, ' ')}` } });
    process.exit(1);
  }

  console.log('\nDone. Actual Phase 2/3 GLEIF work (if in-window) runs async server-side — check `wrangler tail --config wrangler-entities-enrich.toml` or holdings_pipeline_state\'s enrich_phase3_last_run_* keys for real results, not this script\'s own output.');
}

main().catch(async err => {
  console.error('\nFATAL:', err.message);
  try {
    appendRunLog('error', `fatal: ${err.message.replace(/\n/g, ' ').slice(0, 300)}`);
  } catch (logErr) {
    console.error('(also failed to write run log:', logErr.message, ')');
  }
  try { await heartbeatEnd('failed', { error: { class: 'fatal', summary: `fatal: ${err.message}` } }); } catch { /* never affects exit */ }
  process.exit(1);
});
