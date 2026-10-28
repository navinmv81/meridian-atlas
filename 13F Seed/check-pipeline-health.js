#!/usr/bin/env node
// check-pipeline-health.js
// Pipeline watchdog — revived by MA-OCT-002a A3 (CR-4; spec MA-OCT-002 rev 1.3 §7).
// Originally MA-AUG-004 (8 Aug 2026): a low-noise daily check of hold_all_jobs and
// D1 headroom that self-disabled at a 29 Aug checkpoint and has not run since.
//
// What it does now, 4× a day (08:00, 12:00, 18:00, 22:00 local, via its
// LaunchAgent; installed by App/Ops/scripts/health-check-install.sh):
//   1. Pause flag first (13F Seed/.health-check-paused): if present, log and exit —
//      no network at all.
//   2. Checkpoint (Founder Q1, 7 Oct): on/after 2026-12-31 it notifies and unloads
//      its own LaunchAgent — no indefinitely-running automation without a review
//      point. Re-enabling needs an explicit ask.
//   3. Calls ONE route on meridian-ops, POST /api/ops/ingest/sweep (key-authenticated
//      as emitter health-check-local). The sweep computes fleet lateness, hold,
//      headroom and the ETF checks, and raises deduplicated ops_exception rows
//      server-side. This script no longer reads D1 itself and needs no account token.
//   4. Reports its own run to the Ops run ledger as job local.health-check (start +
//      terminal; terminal carries detail.metrics.raised for the daily raise cap),
//      2 s ceiling per event, with the shared local outbox
//      (App/Corporate Atlas/lib/ops-outbox.mjs) for undelivered events.
//   5. Notifies (macOS notification only, Founder Q2) only when the sweep returned
//      NEW sev1–sev3 exceptions; the 18:00 run adds one line when open sev1/sev2
//      cases exist. Clean sweeps are silent. If Ops cannot be reached it notifies.
//
// Run manually: node check-pipeline-health.js   (trigger 'manual'; launchd sets OPS_TRIGGER=launchd)
// Secrets (ML-1011-2): ~/.meridian-secrets/health-check-ops-ingest.env (outside the repo and iCloud):
//   OPS_INGEST_URL=…/api/ops/ingest/run-event  OPS_EMITTER=health-check-local  OPS_INGEST_KEY=…
// Logs (gitignored): App/Corporate Atlas/logs/health-check.log, health-check-heartbeat.log, ops-outbox/.

const { execSync } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
// Test-only overrides (tests/health-check.test.mjs): HEALTH_CHECK_LOG_DIR, HEALTH_CHECK_PAUSE_FLAG,
// HEALTH_CHECK_DRY_LAUNCHCTL=1, HEALTH_CHECK_NO_NOTIFY=1. Unset in production.
const LOG_DIR = process.env.HEALTH_CHECK_LOG_DIR || path.join(ROOT, 'App', 'Corporate Atlas', 'logs');
const RUN_LOG = path.join(LOG_DIR, 'health-check.log');
const HEARTBEAT_LOG = path.join(LOG_DIR, 'health-check-heartbeat.log');
const OUTBOX_DIR = path.join(LOG_DIR, 'ops-outbox');
const OUTBOX_LIB = path.join(ROOT, 'App', 'Corporate Atlas', 'lib', 'ops-outbox.mjs');
const PAUSE_FLAG = process.env.HEALTH_CHECK_PAUSE_FLAG || path.join(__dirname, '.health-check-paused');
const SECRETS_DIR = process.env.MERIDIAN_SECRETS_DIR || path.join(os.homedir(), '.meridian-secrets');
const OPS_ENV = path.join(SECRETS_DIR, 'health-check-ops-ingest.env');

const JOB_ID = 'local.health-check';
const CHECKPOINT_DATE = new Date('2026-12-31T00:00:00Z');   // Founder Q1 (7 Oct 2026): review point
const LAUNCH_AGENT_LABEL = 'com.meridianatlas.health-check';
const HEARTBEAT_CEILING_MS = 2000;
const SWEEP_TIMEOUT_MS = 25000;
const LOOKBACK_DAYS = 7;

function log(line) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); fs.appendFileSync(RUN_LOG, `${new Date().toISOString()} | ${line}\n`); } catch { /* never fatal */ }
  console.log(line);
}
function heartbeatLog(text) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); fs.appendFileSync(HEARTBEAT_LOG, `${new Date().toISOString()} | ${text}\n`); } catch { /* never fatal */ }
}

// Native macOS notification banner — no credentials, no external service.
function notify(title, message, withSound) {
  if (process.env.HEALTH_CHECK_NO_NOTIFY === '1') { log(`(notification suppressed) ${title}: ${message}`); return; }
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}` + (withSound ? ' sound name "Basso"' : '');
  try { execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`); } catch (err) { log(`WARN: failed to send macOS notification: ${err.message}`); }
}

// Unloads this LaunchAgent — used only at the checkpoint, never on a routine finding.
function selfDisable() {
  if (process.env.HEALTH_CHECK_DRY_LAUNCHCTL === '1') { log(`(dry run) would unload LaunchAgent ${LAUNCH_AGENT_LABEL}`); return; }
  try { execSync(`/bin/launchctl bootout gui/$(id -u) ${LAUNCH_AGENT_LABEL}`); log(`Unloaded LaunchAgent ${LAUNCH_AGENT_LABEL}.`); }
  catch (err) { log(`WARN: failed to unload LaunchAgent (${err.message}) — unload manually if needed.`); }
}

function loadOpsConfig() {
  try {
    if (!fs.existsSync(OPS_ENV)) return null;
    const env = Object.fromEntries(fs.readFileSync(OPS_ENV, 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
    if (!env.OPS_INGEST_URL || !env.OPS_EMITTER || !env.OPS_INGEST_KEY) return null;
    return { url: env.OPS_INGEST_URL, emitter: env.OPS_EMITTER, key: env.OPS_INGEST_KEY,
             sweepUrl: env.OPS_SWEEP_URL || env.OPS_INGEST_URL.replace(/\/run-event$/, '/sweep') };
  } catch { return null; }
}

async function callSweep(cfg, runId) {
  const resp = await fetch(cfg.sweepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ops-Emitter': cfg.emitter, 'X-Ops-Ingest-Key': cfg.key },
    body: JSON.stringify({ v: 1, run_id: runId, lookback_days: LOOKBACK_DAYS }),
    signal: AbortSignal.timeout(SWEEP_TIMEOUT_MS)
  });
  let body = null;
  try { body = await resp.json(); } catch { /* non-JSON */ }
  return { status: resp.status, body };
}

async function main() {
  const startedAt = new Date();
  log(`=== Meridian Atlas health-check sweep — ${startedAt.toISOString()} ===`);

  // 1. Pause flag first — no network, no heartbeat, no replay.
  if (fs.existsSync(PAUSE_FLAG)) { log(`paused | pause flag present at ${PAUSE_FLAG}; no network activity`); return 0; }

  // 2. Checkpoint.
  if (startedAt >= CHECKPOINT_DATE) {
    const reason = `the review checkpoint (${CHECKPOINT_DATE.toISOString().slice(0, 10)}) has passed`;
    log(`checkpoint | ${reason}; disabling the watchdog`);
    notify('Meridian Atlas — Health Check Checkpoint', `Watchdog stopping: ${reason}. Ask to re-enable if you still want it.`, true);
    selfDisable();
    return 0;
  }

  const cfg = loadOpsConfig();
  if (!cfg) {
    log(`error | Ops ingest config missing or incomplete at ${OPS_ENV}`);
    notify('Meridian Atlas — Health Check', `Sweep not configured: ${OPS_ENV} is missing or incomplete.`, true);
    return 1;
  }
  const { createOpsOutbox } = await import(pathToFileURL(OUTBOX_LIB).href);
  const ob = createOpsOutbox({ outboxDir: OUTBOX_DIR, name: 'health-check', cfg, log: heartbeatLog });
  const runId = randomUUID();
  const trigger = process.env.OPS_TRIGGER === 'launchd' ? 'launchd' : 'manual';
  const evt = (event, extra = {}) => {
    const e = { run_id: runId, job_id: JOB_ID, event, trigger, started_at: startedAt.toISOString(), ...extra };
    if (event !== 'start') { const now = new Date(); e.ended_at = now.toISOString(); e.duration_ms = now - startedAt; }
    return e;
  };

  // 3. Start event (concurrent), then the sweep — the job's work.
  const pending = [ob.send(evt('start'), { ceilingMs: HEARTBEAT_CEILING_MS })];
  let result, outcome, exitCode = 0;
  try {
    result = await callSweep(cfg, runId);
  } catch (err) {
    result = { status: null, error: (err && err.name === 'TimeoutError') ? 'TimeoutError' : (err && err.message) || 'Error' };
  }
  const b = result.body || {};
  // MA-OCT-WED28.ENG8 (BREVA S-3): the full sweep response body, so every field the Worker returns is on record.
  // The body carries no secret; request headers are never logged.
  if (result.body != null) log(`response | HTTP ${result.status} ${JSON.stringify(result.body)}`);
  if (result.status === 200 && b.ok) {
    outcome = 'success';
    log(`swept | raised=${b.raised} findings=${b.findings} already_open=${b.already_open} overflow=${b.overflow} hold=${b.hold_all_jobs} ` +
        `headroom=${b.headroom ? b.headroom.headroom : 'n/a'} open=${JSON.stringify(b.open_counts || {})} rows_read=${b.rows_read}`);
  } else if (result.status === 202) {
    outcome = 'skipped';
    log(`skipped | sweep switched off (${b.reason || 'HTTP 202'})`);
  } else {
    outcome = 'failed'; exitCode = 1;
    log(`error | sweep could not complete: ${result.status !== null ? `HTTP ${result.status} ${JSON.stringify(b).slice(0, 200)}` : result.error}`);
  }

  // 4. Terminal event after the run-log line; carries metrics.raised (daily raise cap, B-1).
  const metrics = { raised: Number(b.raised) || 0, findings: Number(b.findings) || 0, already_open: Number(b.already_open) || 0,
                    open_sev1: Number(b.open_counts?.sev1) || 0, open_sev2: Number(b.open_counts?.sev2) || 0, open_sev3: Number(b.open_counts?.sev3) || 0,
                    rows_read: Number(b.rows_read) || 0 };
  const terminal = outcome === 'success' ? evt('success', { detail: { metrics } })
    : outcome === 'skipped' ? evt('skipped', { detail: { reason: 'pause' } })
    : evt('failed', { error: { class: result.status !== null ? `http_${result.status}` : 'sweep_unreachable', summary: `sweep failed: ${result.status ?? result.error}` } });
  const own = ob.send(terminal, { ceilingMs: HEARTBEAT_CEILING_MS });
  pending.push(own);
  const settled = await Promise.allSettled(pending);
  if ((await own).delivered) await ob.replay({ max: 10, ceilingMs: HEARTBEAT_CEILING_MS });
  for (const r of settled) if (r.status === 'fulfilled' && r.value.spoolable) ob.spool(r.value.body);

  // 5. Notify (§7.4).
  if (outcome === 'failed') {
    notify('Meridian Atlas — Health Check', 'Sweep could not reach Ops (meridian-ops). See App/Corporate Atlas/logs/health-check.log.', true);
  } else if (outcome === 'success') {
    const fresh = (b.new || []).filter(n => ['sev1', 'sev2', 'sev3'].includes(n.severity));
    const lines = [];
    if (fresh.length) {
      const bySev = ['sev1', 'sev2', 'sev3'].map(s => [s, fresh.filter(n => n.severity === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(', ');
      lines.push(`${fresh.length} new (${bySev}): ` + fresh.slice(0, 3).map(n => n.title).join(' · '));
    }
    const openHigh = metrics.open_sev1 + metrics.open_sev2;
    if (new Date().getHours() === 18 && openHigh > 0) lines.push(`Open sev1/sev2 cases: ${openHigh}.`);
    if (lines.length) notify('Meridian Atlas — Needs Attention', lines.join(' | '), fresh.some(n => n.severity !== 'sev3'));
    else log('All clear — no notification sent (by design, low-noise).');
  }
  return exitCode;
}

main().then(code => process.exit(code || 0)).catch(err => {
  log(`fatal | ${err && err.message}`);
  notify('Meridian Atlas Health Check — Error', `Watchdog script crashed: ${err && err.message}`, true);
  process.exit(1);
});
