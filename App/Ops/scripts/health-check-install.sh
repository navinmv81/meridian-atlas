#!/bin/bash
# health-check-install.sh — MA-OCT-002a A3 (CR-4; spec MA-OCT-002 rev 1.3 §7.1).
# Installs (or idempotently reinstalls) the revived pipeline watchdog LaunchAgent
# com.meridianatlas.health-check: 4 local slots a day — 08:00, 12:00, 18:00, 22:00
# (local wall-clock, as launchd fires; after a sleep, one catch-up fire on wake).
# Each fire runs 13F Seed/check-pipeline-health.js, which calls the meridian-ops
# sweep route and notifies only on new findings.
#
# Control surface (CLAUDE.md local-job rule): this script (install), health-check-
# pause.sh / -resume.sh (flag 13F Seed/.health-check-paused), health-check-status.sh,
# health-check-uninstall.sh (hard stop: launchctl bootout + delete plist).
#
# macOS gotchas (claude/Escalation_LaunchAgent_TCC_Permission.md): launchd gives a
# bare PATH (set explicitly below), and a launchd-spawned node needs TCC access to
# ~/Desktop. The Founder also switches the item on under System Settings → General →
# Login Items → Allow in the Background. This script changes neither.
set -euo pipefail

LABEL="com.meridianatlas.health-check"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SEED_DIR="$ROOT/13F Seed"
RUN_SCRIPT="$SEED_DIR/check-pipeline-health.js"
LOG_DIR="$ROOT/App/Corporate Atlas/logs"
OUTBOX_LIB="$ROOT/App/Corporate Atlas/lib/ops-outbox.mjs"
SECRETS_DIR="${MERIDIAN_SECRETS_DIR:-$HOME/.meridian-secrets}"
OPS_ENV="$SECRETS_DIR/health-check-ops-ingest.env"
LOCAL_HOURS=(8 12 18 22)

for f in "$RUN_SCRIPT" "$OUTBOX_LIB"; do
  [ -f "$f" ] || { echo "ERROR: not found: $f" >&2; exit 1; }
done
if [ ! -f "$OPS_ENV" ]; then
  echo "ERROR: Ops ingest config not found at $OPS_ENV (OPS_INGEST_URL, OPS_EMITTER=health-check-local, OPS_INGEST_KEY)." >&2
  exit 1
fi
grep -q '^OPS_EMITTER=health-check-local$' "$OPS_ENV" || { echo "ERROR: $OPS_ENV must set OPS_EMITTER=health-check-local" >&2; exit 1; }
grep -q 'CHECKPOINT_DATE = new Date(.2026-12-31' "$RUN_SCRIPT" || { echo "ERROR: $RUN_SCRIPT does not carry the 2026-12-31 checkpoint (would self-unload)." >&2; exit 1; }

NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "ERROR: 'node' not found on PATH." >&2; exit 1; }
NODE_DIR="$(dirname "$NODE_BIN")"
LAUNCHD_PATH="${NODE_DIR}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$LOG_DIR"

echo "Label:        $LABEL"
echo "Plist path:   $PLIST_PATH"
echo "Node binary:  $NODE_BIN"
echo "Run script:   $RUN_SCRIPT"
echo "Fire times:   ${LOCAL_HOURS[*]} :00 local ($(date +%Z), UTC offset $(date +%z))"
echo ""

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Existing LaunchAgent found — unloading before reinstall..."
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
fi

INTERVAL_ENTRIES=""
for h in "${LOCAL_HOURS[@]}"; do
  INTERVAL_ENTRIES+="        <dict>
            <key>Hour</key>
            <integer>${h}</integer>
            <key>Minute</key>
            <integer>0</integer>
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
        <string>cd "${SEED_DIR}" &amp;&amp; "${NODE_BIN}" check-pipeline-health.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${LAUNCHD_PATH}</string>
        <key>OPS_TRIGGER</key>
        <string>launchd</string>
    </dict>
    <key>StartCalendarInterval</key>
    <array>
${INTERVAL_ENTRIES}    </array>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/health-check-launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/health-check-launchd-stderr.log</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST_PATH"

if launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/tmp/health-check-install-err.$$; then
  echo "Loaded via 'launchctl bootstrap'."
else
  echo "'launchctl bootstrap' failed ($(cat /tmp/health-check-install-err.$$))." >&2
  rm -f /tmp/health-check-install-err.$$
  exit 1
fi
rm -f /tmp/health-check-install-err.$$
echo ""
echo "Installed. If it does not run, check System Settings → General → Login Items → Allow in the Background (Founder step)."
echo "Verify with: $SCRIPT_DIR/health-check-status.sh"
