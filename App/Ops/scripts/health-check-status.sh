#!/bin/bash
# health-check-status.sh — MA-OCT-002a A3: read-only status of the revived watchdog.
set -uo pipefail
LABEL="com.meridianatlas.health-check"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FLAG_PATH="$ROOT/13F Seed/.health-check-paused"
LOG_PATH="$ROOT/App/Corporate Atlas/logs/health-check.log"
HB_PATH="$ROOT/App/Corporate Atlas/logs/health-check-heartbeat.log"
OPS_ENV="${MERIDIAN_SECRETS_DIR:-$HOME/.meridian-secrets}/health-check-ops-ingest.env"
echo "=== MA-OCT-002a health-check (alerting sweep) — status ==="
echo ""
echo "-- LaunchAgent --"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Loaded:       YES ($LABEL)"
  launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | grep -E "^\s+(state|runs|last exit code) =" | sed 's/^\s*/  /'
else
  echo "Loaded:       NO"; [ -f "$PLIST_PATH" ] && echo "  (a plist exists at $PLIST_PATH but is not loaded)"
fi
if [ -f "$PLIST_PATH" ]; then
  echo ""; echo "-- Scheduled fire times (local, from installed plist) --"
  /usr/libexec/PlistBuddy -c "Print :StartCalendarInterval" "$PLIST_PATH" 2>/dev/null | awk '/Hour = /{h=$3} /Minute = /{printf "  %02d:%02d local\n", h, $3}'
fi
echo ""; echo "-- Pause flag --"
if [ -f "$FLAG_PATH" ]; then echo "Paused:       YES"; echo "  $(cat "$FLAG_PATH")"; else echo "Paused:       NO"; fi
echo ""; echo "-- Config --"
[ -f "$OPS_ENV" ] && echo "Ops ingest config: present ($OPS_ENV)" || echo "Ops ingest config: MISSING ($OPS_ENV)"
grep -oE "CHECKPOINT_DATE = new Date\('[0-9-]+" "$ROOT/13F Seed/check-pipeline-health.js" | sed "s/.*'/Checkpoint:        /"
echo ""; echo "-- Last runs ($LOG_PATH) --"
if [ -s "$LOG_PATH" ]; then tail -n 10 "$LOG_PATH"; else echo "No run log yet."; fi
echo ""; echo "-- Last heartbeats ($HB_PATH) --"
if [ -s "$HB_PATH" ]; then tail -n 4 "$HB_PATH"; else echo "No heartbeat log yet."; fi
