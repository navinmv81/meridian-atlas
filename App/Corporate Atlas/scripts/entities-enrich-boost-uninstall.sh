#!/bin/bash
# MA-SEP-010 — kill switch. Fully and permanently stops the entities-enrich
# boost job: unloads the LaunchAgent and deletes its .plist. After this runs,
# nothing fires again, on any schedule, until entities-enrich-boost-install.sh
# is explicitly re-run. Safe to run even if the agent isn't currently loaded.
# Mirrors firds-seed-uninstall.sh exactly. Does NOT touch the existing
# Cloudflare Cron Trigger (06:00/06:50 UTC) — that keeps running unattended
# as it always has; this only removes the additional local invocations.

set -uo pipefail

LABEL="com.meridianatlas.entities-enrich-boost"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Unloading LaunchAgent ($LABEL)..."
  launchctl bootout "gui/$(id -u)/$LABEL"
  echo "Unloaded."
else
  echo "LaunchAgent ($LABEL) was not loaded."
fi

if [ -f "$PLIST_PATH" ]; then
  rm -f "$PLIST_PATH"
  echo "Deleted $PLIST_PATH"
else
  echo "No plist file found at $PLIST_PATH (already removed)."
fi

echo ""
echo "Kill switch complete — nothing will fire again until entities-enrich-boost-install.sh is re-run."
echo "The existing Cloudflare Cron Trigger (06:00/06:50 UTC) is unaffected — entities-enrich returns to its original once/day cadence."
