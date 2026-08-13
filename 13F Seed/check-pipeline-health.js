#!/usr/bin/env node
// check-pipeline-health.js
// Lightweight daily watchdog (MA-AUG-004, scoped 8 Aug 2026 for the August
// closeout). Read-only — makes zero D1 writes. Checks two things:
//   1. hold_all_jobs — the shared kill switch. If true, everything is
//      halted and the Founder should know sooner than "eventually noticed".
//   2. Live D1 headroom (via meridian-ops /api/ops/cf/d1-today) — flags if
//      remaining headroom for the day is critically low.
// Surfaces a native macOS notification ONLY if something needs attention —
// deliberately silent (just a log line) on a clean day, to avoid alert
// fatigue on what's meant to be a lightweight, low-noise check.
//
// Run manually: node check-pipeline-health.js
// Scheduled via a LaunchAgent, same pattern as the financialfact backfill.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { execSync } = require('child_process');

// ── D1 config (same account/database as seed-financialfact.js) ──────────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const OPS_D1_TODAY_URL = process.env.OPS_D1_TODAY_URL;

const LOW_HEADROOM_THRESHOLD = 5000;

// ── Checkpoint (added 8 Aug 2026, per Founder's explicit request: no
// indefinitely-running automation without a built-in review point) ──────────
// This watchdog exists primarily to cover the financialfact backfill's
// active window. It self-disables — not just goes quiet — at whichever of
// these comes first, defaulting to OFF rather than silently running forever:
//   1. The backfill itself reports complete (financialfact_backfill_complete
//      = 'true') — the main reason this exists has resolved.
//   2. A hard calendar fallback, in case the backfill runs longer than
//      expected or the situation changes in some other way.
// On checkpoint, it unloads its own LaunchAgent (same launchctl bootout
// pattern as the backfill's self-termination) and sends a distinct
// notification explaining why — re-enabling requires an explicit ask, not
// automatic continuation.
const CHECKPOINT_DATE = new Date('2026-08-29T00:00:00Z'); // 3 weeks from setup
const LAUNCH_AGENT_LABEL = 'com.meridianatlas.health-check';

if (!TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

function esc(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function d1Select(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  }
  const { columns, rows } = json.result[0].results;
  return rows.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// Native macOS notification banner — no new credentials, no external
// service, built into every Mac. Escapes single quotes for safe shell use.
function notify(title, message, withSound) {
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}` +
    (withSound ? ' sound name "Basso"' : '');
  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
  } catch (err) {
    console.error('  WARN: failed to send macOS notification:', err.message);
  }
}

// Unloads this LaunchAgent so it stops running — used only at the checkpoint,
// never on a routine "needs attention" finding.
function selfDisable() {
  try {
    execSync(`/bin/launchctl bootout gui/$(id -u) ${LAUNCH_AGENT_LABEL}`);
    console.log(`  Unloaded LaunchAgent ${LAUNCH_AGENT_LABEL} — will not run again until re-enabled.`);
  } catch (err) {
    console.error(`  WARN: failed to unload LaunchAgent (${err.message}) — it may still fire again; unload manually if needed.`);
  }
}

async function main() {
  const timestamp = new Date().toISOString();
  const issues = [];

  console.log(`\n=== Meridian Atlas pipeline health check — ${timestamp} ===`);

  // ── Checkpoint check — runs before anything else ───────────────────────────
  let backfillComplete = false;
  try {
    const rows = await d1Select(`SELECT value FROM holdings_pipeline_state WHERE key = ${esc('financialfact_backfill_complete')}`);
    backfillComplete = rows.length > 0 && rows[0].value === 'true';
  } catch (err) {
    console.error(`  WARN: could not check backfill completion flag for checkpoint purposes: ${err.message}`);
  }

  const pastCalendarCheckpoint = new Date() >= CHECKPOINT_DATE;

  if (backfillComplete || pastCalendarCheckpoint) {
    const reason = backfillComplete
      ? 'the financialfact backfill this watchdog primarily covers has completed'
      : `the 3-week calendar checkpoint (${CHECKPOINT_DATE.toISOString().slice(0, 10)}) has passed`;
    console.log(`\n=== CHECKPOINT REACHED — ${reason} ===`);
    console.log('  Disabling this watchdog rather than continuing indefinitely. Re-enable explicitly if still needed.');
    notify('Meridian Atlas — Health Check Checkpoint', `Watchdog stopping: ${reason}. Ask to re-enable if you still want it.`, true);
    selfDisable();
    return;
  }

  // 1. hold_all_jobs check
  try {
    const rows = await d1Select(`SELECT value FROM holdings_pipeline_state WHERE key = ${esc('hold_all_jobs')}`);
    const holdValue = rows.length > 0 ? rows[0].value : 'false';
    console.log(`  hold_all_jobs = ${holdValue}`);
    if (holdValue === 'true') {
      issues.push('hold_all_jobs is TRUE — all D1-writing pipelines are currently halted.');
    }
  } catch (err) {
    issues.push(`Could not check hold_all_jobs: ${err.message}`);
  }

  // 2. Live headroom check
  if (!OPS_D1_TODAY_URL) {
    issues.push('OPS_D1_TODAY_URL is not set in .env — cannot check live headroom.');
  } else {
    try {
      const res = await fetch(OPS_D1_TODAY_URL);
      const json = await res.json();
      if (!json.ok) {
        issues.push(`d1-today check returned an error: ${JSON.stringify(json)}`);
      } else {
        const headroom = json.daily_cap - json.rowsWritten;
        console.log(`  D1 headroom: ${headroom}/${json.daily_cap} remaining (${json.pct_of_cap}% used today)`);
        if (headroom < LOW_HEADROOM_THRESHOLD) {
          issues.push(`D1 headroom is low: only ${headroom} of ${json.daily_cap} remaining today (${json.pct_of_cap}% used).`);
        }
      }
    } catch (err) {
      issues.push(`Could not reach live headroom check: ${err.message}`);
    }
  }

  if (issues.length > 0) {
    console.log('\nNEEDS ATTENTION:');
    issues.forEach(i => console.log(`  - ${i}`));
    notify('Meridian Atlas — Needs Attention', issues.join(' | '), true);
  } else {
    console.log('\nAll clear — no notification sent (by design, to keep this low-noise).');
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  // A crashed watchdog is itself worth knowing about — notify rather than fail silently.
  notify('Meridian Atlas Health Check — Error', `Watchdog script crashed: ${err.message}`, true);
  process.exit(1);
});
