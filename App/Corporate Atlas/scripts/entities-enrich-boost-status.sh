#!/bin/bash
# MA-SEP-010 — one-glance status: is the LaunchAgent loaded, what hours is it
# scheduled for, is the job paused, and when did it last fire with what
# outcome. Mirrors firds-seed-status.sh exactly, plus a schedule summary
# (this job has multiple fire times/day, unlike FIRDS' single weekly one).

set -uo pipefail

LABEL="com.meridianatlas.entities-enrich-boost"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.entities-enrich-boost-paused"
LOG_PATH="$CORP_ATLAS_DIR/logs/entities-enrich-boost.log"

echo "=== MA-SEP-010 entities-enrich-boost — status ==="
echo ""

echo "-- LaunchAgent --"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Loaded:       YES ($LABEL)"
else
  echo "Loaded:       NO"
  if [ -f "$PLIST_PATH" ]; then
    echo "  (note: a plist file exists at $PLIST_PATH but is not currently loaded)"
  fi
fi

if [ -f "$PLIST_PATH" ]; then
  echo ""
  echo "-- Scheduled fire hours (local time, from installed plist) --"
  # PlistBuddy (ships with macOS, no parser dependency) — a hand-rolled
  # grep/sed pass at this was tried first and produced wrong pairings
  # (verified live, 2026-08-27: it printed "11:17" instead of "11:50"/
  # "17:50") because grep -A1 on a repeated key interleaves badly across
  # multiple array entries. PlistBuddy reads the real structure instead of
  # guessing at it from text.
  /usr/libexec/PlistBuddy -c "Print :StartCalendarInterval" "$PLIST_PATH" 2>/dev/null | \
    awk '/Hour = /{h=$3} /Minute = /{printf "  %02d:%02d local\n", h, $3}'
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
echo "-- Last runs (from $LOG_PATH) --"
if [ -f "$LOG_PATH" ] && [ -s "$LOG_PATH" ]; then
  echo "(last 10 lines)"
  tail -n 10 "$LOG_PATH"
else
  echo "No run log yet — the job has never fired (or the log file was cleared)."
fi

echo ""
echo "-- Reminder --"
echo "This controls ONLY the local boost invocations. The existing Cloudflare"
echo "Cron Trigger (meridian-entities-enrich: 06:00 + 06:50 UTC daily) is"
echo "unaffected by pause/resume/uninstall here — check that separately via"
echo "wrangler-entities-enrich.toml or the Cloudflare dashboard."
