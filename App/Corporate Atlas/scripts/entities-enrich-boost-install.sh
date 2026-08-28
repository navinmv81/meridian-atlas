#!/bin/bash
# MA-SEP-010 — install the entities-enrich-boost LaunchAgent.
#
# Writes ~/Library/LaunchAgents/com.meridianatlas.entities-enrich-boost.plist
# and loads it. Fires entities-enrich-boost-run.mjs at each hour listed in
# FIRE_HOURS_UTC below, always at minute :50 (Phase 2/3's dispatch window —
# see that script's header for why the minute matters and cannot drift).
#
# LOW-CADENCE TEST DEFAULT (MA-SEP-010 Change Request step 5 — "test at low
# cadence first"): FIRE_HOURS_UTC defaults to 2 additional invocations/day
# (10:50 and 16:50 UTC). To scale to the full 4-6/day target after the test
# checkpoint clears, edit FIRE_HOURS_UTC below and re-run this script — it is
# idempotent (unloads and reinstalls cleanly, same as firds-seed-install.sh).
#
# Hour choices, reasoned not arbitrary:
#   - Both hours avoid 06:xx UTC entirely (the existing Cloudflare Cron
#     Trigger's own 06:00/06:50 UTC fires) to keep this LaunchAgent's
#     invocations clearly time-separated from the cron-triggered one, given
#     Phase 3's SELECT has no claiming/locking step (Change Request Risk
#     Assessment, last row).
#   - Both hours are well clear of the Sunday 04:00-07:00 UTC window where
#     meridian-holdings' weekly run competes for the same shared D1 write
#     budget (Known Issue 22.12) — "weighted away... where practical" per
#     the Change Request. This is a structural choice (these hours are clear
#     on every day of the week, not just Sunday) — the mandatory pre-flight
#     headroom check inside entities-enrich-boost-run.mjs is the actual,
#     always-on guard; this scheduling choice just reduces how often that
#     guard needs to say no.
#   - Spread across the day (10:50, 16:50) rather than back-to-back, so a
#     transient GLEIF issue at one fire time doesn't also hit the other.
#
# TIMEZONE: launchd's StartCalendarInterval fires in LOCAL time. This script
# converts each UTC target hour to local time using the CURRENT real UTC
# offset (checked live via `date`, not assumed) — same approach and same
# caveat as firds-seed-install.sh: a whole-hour DST transition (twice/year on
# this UK machine) will shift the local fire time relative to these UTC
# targets by up to 1 hour until this script is re-run. Unlike FIRDS (which
# has a real external publish-time dependency), entities-enrich's backlog has
# no such dependency, and the schedule already carries multiple hours of
# margin on both sides (cron at 06:xx, holdings window ending 07:00) — a
# 1-hour drift does not meaningfully erode either margin. Minute (:50) is
# unaffected by DST and is what Phase 3's dispatch actually depends on.
#
# PATH fix: same real launchd gotcha documented in
# claude/Escalation_LaunchAgent_TCC_Permission.md and already baked into
# firds-seed-install.sh — launchd's bare /usr/bin:/bin:/usr/sbin:/sbin PATH
# doesn't include wherever Homebrew put node/npx/wrangler on this machine.

set -euo pipefail

LABEL="com.meridianatlas.entities-enrich-boost"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

# Edit this array to change cadence (each entry fires once at :50 past that
# UTC hour, every day). Low-cadence test default: 2 entries.
FIRE_HOURS_UTC=(10 16)
# Full target (uncomment/replace the line above once the low-cadence test is
# verified end-to-end, per Change Request step 5):
# FIRE_HOURS_UTC=(9 12 15 18 21)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_SCRIPT="$CORP_ATLAS_DIR/entities-enrich-boost-run.mjs"
LOG_DIR="$CORP_ATLAS_DIR/logs"
ENV_FILE="$CORP_ATLAS_DIR/.env.entities-enrich-run"

if [ ! -f "$RUN_SCRIPT" ]; then
  echo "ERROR: run script not found at $RUN_SCRIPT" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: secret file not found at $ENV_FILE — expected ENTITIES_ENRICH_RUN_SECRET=<value>. Run 'wrangler secret put RUN_AUTH_SECRET' against the Worker first, then create this file with the same value." >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: 'node' not found on PATH. Install Node or adjust this script." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

NODE_DIR="$(dirname "$NODE_BIN")"
LAUNCHD_PATH="${NODE_DIR}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Convert each UTC target hour to local hour using the CURRENT real UTC
# offset (whole hours only — this machine's timezone, UK, is always a whole
# number of hours from UTC; a half-hour-offset timezone would need this
# adjusted).
OFFSET_RAW="$(date +%z)"   # e.g. +0100 or -0500
SIGN="${OFFSET_RAW:0:1}"
OFFSET_HH="$((10#${OFFSET_RAW:1:2}))"
if [ "$SIGN" = "-" ]; then OFFSET_HH=$((-OFFSET_HH)); fi

echo "Label:            $LABEL"
echo "Plist path:       $PLIST_PATH"
echo "Node binary:      $NODE_BIN"
echo "Run script:       $RUN_SCRIPT"
echo "Current UTC offset: $OFFSET_RAW ($(date +%Z))"
echo "Fire hours (UTC):  ${FIRE_HOURS_UTC[*]} (all at :50)"

LOCAL_HOURS=()
for h in "${FIRE_HOURS_UTC[@]}"; do
  local_h=$(( ( (h + OFFSET_HH) % 24 + 24) % 24 ))
  LOCAL_HOURS+=("$local_h")
  echo "  ${h}:50 UTC -> ${local_h}:50 local"
done
echo ""

# Idempotent reinstall.
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Existing LaunchAgent found — unloading before reinstall..."
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
fi

# Build the StartCalendarInterval array entries (one dict per fire hour).
INTERVAL_ENTRIES=""
for lh in "${LOCAL_HOURS[@]}"; do
  INTERVAL_ENTRIES+="        <dict>
            <key>Hour</key>
            <integer>${lh}</integer>
            <key>Minute</key>
            <integer>50</integer>
        </dict>
"
done

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd "${CORP_ATLAS_DIR}" &amp;&amp; "${NODE_BIN}" entities-enrich-boost-run.mjs</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${LAUNCHD_PATH}</string>
    </dict>
    <key>StartCalendarInterval</key>
    <array>
${INTERVAL_ENTRIES}    </array>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/entities-enrich-boost-launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/entities-enrich-boost-launchd-stderr.log</string>
</dict>
</plist>
PLIST

if launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/tmp/entities-enrich-boost-install-err.$$; then
  echo "Loaded via 'launchctl bootstrap'."
else
  echo "'launchctl bootstrap' failed ($(cat /tmp/entities-enrich-boost-install-err.$$)), trying 'launchctl load' fallback..."
  rm -f /tmp/entities-enrich-boost-install-err.$$
  launchctl load "$PLIST_PATH"
  echo "Loaded via 'launchctl load' (compatibility fallback)."
fi
rm -f /tmp/entities-enrich-boost-install-err.$$

echo ""
echo "Installed and loaded. Verify with: $SCRIPT_DIR/entities-enrich-boost-status.sh"
