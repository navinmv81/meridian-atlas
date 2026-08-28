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

import { execFileSync } from 'node:child_process';
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

  console.log('\nPre-flight headroom check (direct D1 read, not relying on the Worker\'s own 429 alone)...');
  let writesToday, headroom;
  try {
    ({ writesToday } = queryWritesToday());
    headroom = DAILY_CAP - writesToday;
  } catch (err) {
    console.error('Headroom check failed:', err.message);
    appendRunLog('error', `headroom check failed: ${err.message.replace(/\n/g, ' ').slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`  writes_today: ${writesToday.toLocaleString()} / ${DAILY_CAP.toLocaleString()} (headroom: ${headroom.toLocaleString()}, required: ${REQUIRED_HEADROOM.toLocaleString()})`);

  if (headroom < REQUIRED_HEADROOM) {
    console.log('Insufficient real headroom — refusing to call /run this fire.');
    appendRunLog('skipped_headroom', `writes_today=${writesToday} headroom=${headroom} required=${REQUIRED_HEADROOM} utc_minute=${utcMinute}`);
    return;
  }

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
  } catch (err) {
    clearTimeout(timeout);
    console.error('Request to /run failed:', err.message);
    appendRunLog('error', `request failed: ${err.message.replace(/\n/g, ' ').slice(0, 300)} utc_minute=${utcMinute}`);
    process.exit(1);
  }

  console.log('\nDone. Actual Phase 2/3 GLEIF work (if in-window) runs async server-side — check `wrangler tail --config wrangler-entities-enrich.toml` or holdings_pipeline_state\'s enrich_phase3_last_run_* keys for real results, not this script\'s own output.');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  try {
    appendRunLog('error', `fatal: ${err.message.replace(/\n/g, ' ').slice(0, 300)}`);
  } catch (logErr) {
    console.error('(also failed to write run log:', logErr.message, ')');
  }
  process.exit(1);
});
