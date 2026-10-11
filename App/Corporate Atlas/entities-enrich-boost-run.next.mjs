#!/usr/bin/env node
// MA-SEP-010 — payload for the "entities-enrich-boost" LaunchAgent.
//
// Invokes meridian-entities-enrich's existing /run endpoint additional
// times/day, entirely outside Cloudflare's Cron Trigger accounting (the
// account is at its Free-plan cap of 5/5 — see MA-SEP-010_Change_Request.md).
// Mirrors MA-SEP-003's firds-local-seed.mjs control pattern: a pause-flag
// check as the very first thing, before any network activity, and a
// one-line-per-run append to a log file read by *-status.sh.
//
// MA-OCT-002a A4 (CR-5; spec MA-OCT-002 rev 1.3 §8; Data-Identity Lead
// conditions §8.6) — this version replaces the MA-OCT-001 pilot runner:
//
// 1. Out-of-window fires (KI 22.47, ML-1): entities-enrich.js's /run
//    dispatches on wall-clock getMinutes() — mins<50 runs only Phase 1
//    (already done daily by the 06:00 cron), mins>=50 runs Phase 2+3, the
//    GLEIF work this job exists for. A fire outside :50-:59 UTC therefore
//    does NOT call /run: it logs `skipped_out_of_window` and reports
//    `skipped` / reason `out_of_window`, exit 0.
//
// 2. F7 / F6 fix (§8.5): the pre-flight headroom check reads the real account
//    total from meridian-ops GET /api/ops/cf/d1-today (Cloudflare analytics;
//    no OAuth, no wrangler). The old `npx wrangler d1 execute` read of the
//    ETF-domain writes_today_<date> key (blind on weekdays, and the step that
//    failed with error 10000) is deleted — this runner calls neither wrangler
//    nor npx. Same threshold (REQUIRED_HEADROOM, mirroring entities-enrich.js's
//    checkWriteBudget()) and same place in the flow. If d1-today is unreachable
//    or not ok: run-log `error`, `failed` / `headroom_unavailable`, no /run.
//    The run-log line also carries headroom_80k (against holdings' 80k
//    guard; informational, never blocks).
//
// 3. Ops heartbeats (MA-OCT-001 contract v1) with a local outbox (§8.1):
//    `start` once the pre-flight passes (sent concurrently with /run, never
//    delaying it), then one terminal event AFTER the run-log line is
//    written. Undelivered events (timeout, network, 5xx) are spooled to
//    logs/ops-outbox/ and replayed — after this run's own run-log line and
//    terminal heartbeat — with the same run_id (idempotent server-side).
//    Heartbeat and outbox output go only to logs/entities-enrich-boost-heartbeat.log
//    and the outbox files, and never change the exit code or /run's timing.
//
// 4. trigger label: OPS_TRIGGER=launchd (set by the install script) → 'launchd'.
//
// The pause check stays FIRST; a paused run does no network work at all
// (no d1-today, no heartbeat, no replay). Kill switch for the Ops side:
// delete .env.ops-ingest (heartbeats and replay become a no-op).

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpsOutbox } from './lib/ops-outbox.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAUSE_FLAG_PATH = path.join(SCRIPT_DIR, '.entities-enrich-boost-paused');
const LOG_DIR = path.join(SCRIPT_DIR, 'logs');
const LOG_PATH = path.join(LOG_DIR, 'entities-enrich-boost.log');
const ENV_FILE_PATH = path.join(SCRIPT_DIR, '.env.entities-enrich-run');

const RUN_URL = 'https://meridian-entities-enrich.navinmv1981.workers.dev/run';
const D1_TODAY_URL = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/cf/d1-today';

// REQUIRED_HEADROOM mirrors entities-enrich.js's checkWriteBudget() — kept in
// sync so this pre-flight and the Worker's own guard agree on "safe".
const REQUIRED_HEADROOM = 5000;
const HOLDINGS_GUARD = 80000;        // holdings' DAILY_WRITE_LIMIT; headroom_80k is informational only
const D1_TODAY_CEILING_MS = 2000;
const D1_TODAY_RETRY_DELAY_MS = 2000;

function appendRunLog(outcome, detail) {
  mkdirSync(LOG_DIR, { recursive: true });
  const line = `${new Date().toISOString()} | ${outcome} | ${detail}\n`;
  appendFileSync(LOG_PATH, line, 'utf8');
}

// --- ops-heartbeat + outbox (MA-OCT-001 contract v1; MA-OCT-002a A4) --------
const OPS_ENV_PATH = path.join(SCRIPT_DIR, '.env.ops-ingest');
const HEARTBEAT_LOG_PATH = path.join(LOG_DIR, 'entities-enrich-boost-heartbeat.log');
const OUTBOX_DIR = path.join(LOG_DIR, 'ops-outbox');
const OPS_JOB_ID = 'local.entities-enrich-boost';
const HEARTBEAT_CEILING_MS = 2000;
const REPLAY_MAX = 10;
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

const RUN = { ob: null, id: null, startedAt: null, slot: null, outOfWindow: null, pending: [], ended: false };

function runEvent(event, extra = {}) {
  const now = new Date();
  const evt = {
    run_id: RUN.id, job_id: OPS_JOB_ID, event,
    trigger: process.env.OPS_TRIGGER === 'launchd' ? 'launchd' : 'manual',
    started_at: RUN.startedAt.toISOString(),
    detail: { slot: RUN.slot, fired_at: RUN.startedAt.toISOString(), out_of_window: RUN.outOfWindow, ...(extra.detail || {}) }
  };
  if (event !== 'start') { evt.ended_at = now.toISOString(); evt.duration_ms = now - RUN.startedAt; }
  if (extra.error) evt.error = extra.error;
  return evt;
}

// Terminal heartbeat, called only AFTER the run-log line is written. Each send
// is bounded by its own 2 s ceiling. Then:
//  - replay older spooled events, but only if this run's own terminal event was
//    delivered (Ops reachable; a run whose own heartbeat just failed does not
//    spend up to 10 × 2 s replaying into the same outage);
//  - spool this run's own undelivered events last, so they are replayed by the
//    NEXT run (spec §8.1), never by this one.
// Never throws, never prints.
async function heartbeatEnd(event, extra) {
  if (!RUN.id || RUN.ended) return;
  RUN.ended = true;
  try {
    const terminal = RUN.ob.send(runEvent(event, extra), { ceilingMs: HEARTBEAT_CEILING_MS });
    RUN.pending.push(terminal);
    const results = await Promise.allSettled(RUN.pending);
    const own = await terminal;
    if (own.delivered) await RUN.ob.replay({ max: REPLAY_MAX, ceilingMs: HEARTBEAT_CEILING_MS });
    for (const r of results) if (r.status === 'fulfilled' && r.value.spoolable) RUN.ob.spool(r.value.body);
  } catch { /* never affects the job */ }
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

// F7 fix (§8.5): the account's real D1 writes today, from Cloudflare analytics
// via meridian-ops. 2 s ceiling, one retry after 2 s. Throws on failure.
async function readD1Today() {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, D1_TODAY_RETRY_DELAY_MS));
    try {
      const resp = await fetch(D1_TODAY_URL, { signal: AbortSignal.timeout(D1_TODAY_CEILING_MS) });
      const body = await resp.json();
      if (!resp.ok || body?.ok !== true || !Number.isFinite(body.rowsWritten) || !Number.isFinite(body.daily_cap)) {
        throw new Error(`d1-today not ok (HTTP ${resp.status})`);
      }
      return { writesToday: body.rowsWritten, dailyCap: body.daily_cap, date: body.date };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`d1-today unavailable: ${lastErr && (lastErr.name === 'TimeoutError' ? 'TimeoutError' : lastErr.message)}`);
}

async function main() {
  console.log('=== MA-SEP-010: entities-enrich-boost invocation ===\n');

  // Pause check MUST be the very first thing — before any network call.
  // A paused run does no network work at all (no d1-today, heartbeat or replay).
  if (existsSync(PAUSE_FLAG_PATH)) {
    console.log(`Pause flag present at ${PAUSE_FLAG_PATH} — paused, skipping this run.`);
    appendRunLog('paused', 'skipped run — pause flag set, no network/D1 activity');
    return;
  }

  const nowUtc = new Date();
  const utcMinute = nowUtc.getUTCMinutes();
  const inWindow = utcMinute >= 50;   // Phase 3 window :50-:59 UTC, inclusive
  console.log(`Fire time (UTC): ${nowUtc.toISOString()} — minute=${utcMinute}, in :50-:59 window: ${inWindow}`);
  Object.assign(RUN, {
    ob: createOpsOutbox({ outboxDir: OUTBOX_DIR, name: 'entities-enrich-boost', cfg: loadOpsConfig(), log: appendHeartbeatLog }),
    id: randomUUID(), startedAt: nowUtc, slot: scheduledSlot(nowUtc), outOfWindow: !inWindow
  });

  // KI 22.47 / ML-1: outside :50-:59 /run would only run Phase 1 — do not call it.
  if (!inWindow) {
    console.log('Fire landed outside :50-:59 UTC — /run would run Phase 1 only (no GLEIF work). Not calling /run. Check the LaunchAgent schedule / whether the Mac was asleep at the intended fire time.');
    appendRunLog('skipped_out_of_window', `utc_minute=${utcMinute} in_window=false`);
    await heartbeatEnd('skipped', { detail: { reason: 'out_of_window', utc_minute: utcMinute } });
    return;
  }

  console.log('\nPre-flight headroom check (account total from Cloudflare analytics via meridian-ops d1-today)...');
  let writesToday, headroom, headroom80k;
  try {
    const d = await readD1Today();
    writesToday = d.writesToday;
    headroom = d.dailyCap - writesToday;
    headroom80k = HOLDINGS_GUARD - writesToday;
  } catch (err) {
    console.error('Headroom check failed:', err.message);
    appendRunLog('error', `headroom check failed: ${err.message.replace(/\n/g, ' ').slice(0, 300)}`);
    await heartbeatEnd('failed', { error: { class: 'headroom_unavailable', summary: `headroom check failed: ${err.message.replace(/\n/g, ' ')}` } });
    process.exit(1);
  }
  console.log(`  writes_today (account, analytics): ${writesToday.toLocaleString()} (headroom: ${headroom.toLocaleString()}, required: ${REQUIRED_HEADROOM.toLocaleString()}; headroom vs 80k guard: ${headroom80k.toLocaleString()})`);

  if (headroom < REQUIRED_HEADROOM) {
    console.log('Insufficient real headroom — refusing to call /run this fire.');
    appendRunLog('skipped_headroom', `writes_today=${writesToday} headroom=${headroom} headroom_80k=${headroom80k} required=${REQUIRED_HEADROOM} utc_minute=${utcMinute}`);
    await heartbeatEnd('skipped', { detail: { reason: 'budget', writes_today: writesToday, headroom, headroom_80k: headroom80k, required: REQUIRED_HEADROOM } });
    return;
  }

  // Pre-flight passed: `start` goes out concurrently — never awaited before /run.
  RUN.pending.push(RUN.ob.send(runEvent('start'), { ceilingMs: HEARTBEAT_CEILING_MS }));

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
    appendRunLog(outcome, `utc_minute=${utcMinute} in_window=${inWindow} writes_today=${writesToday} headroom=${headroom} headroom_80k=${headroom80k} response=${bodyText.replace(/\n/g, ' ').slice(0, 200)}`);
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

  console.log('\nDone. Actual Phase 2/3 GLEIF work runs async server-side — check `wrangler tail --config wrangler-entities-enrich.toml` or holdings_pipeline_state\'s enrich_phase3_last_run_* keys for real results, not this script\'s own output.');
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
