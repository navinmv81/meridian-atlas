#!/bin/bash
# MA-SEP-003 — one-glance status: is the LaunchAgent loaded, is the job
# paused, and when did it last run with what outcome.

set -uo pipefail

LABEL="com.meridianatlas.firds-weekly-seed"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.firds-seed-paused"
LOG_PATH="$CORP_ATLAS_DIR/logs/firds-seed.log"

echo "=== MA-SEP-003 FIRDS weekly seed — status ==="
echo ""

echo "-- LaunchAgent --"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Loaded:       YES ($LABEL)"
  if [ -f "$PLIST_PATH" ]; then
    echo "Plist:        $PLIST_PATH"
  fi
else
  echo "Loaded:       NO"
  if [ -f "$PLIST_PATH" ]; then
    echo "  (note: a plist file exists at $PLIST_PATH but is not currently loaded)"
  fi
fi

echo ""
echo "-- Pause flag --"
if [ -f "$FLAG_PATH" ]; then
  echo "Paused:       YES"
  echo "  $(cat "$FLAG_PATH")"
else
  echo "Paused:       NO"
fi

echo ""
echo "-- Last run (from $LOG_PATH) --"
if [ -f "$LOG_PATH" ] && [ -s "$LOG_PATH" ]; then
  tail -n 1 "$LOG_PATH"
  echo ""
  echo "(last 5 lines)"
  tail -n 5 "$LOG_PATH"
else
  echo "No run log yet — the job has never fired (or the log file was cleared)."
fi
