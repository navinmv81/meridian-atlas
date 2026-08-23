#!/bin/bash
# MA-SEP-003 — kill switch. Fully and permanently stops the weekly FIRDS
# seed job: unloads the LaunchAgent and deletes its .plist. After this runs,
# nothing fires again, on any schedule, until firds-seed-install.sh is
# explicitly re-run. Safe to run even if the agent isn't currently loaded.

set -uo pipefail

LABEL="com.meridianatlas.firds-weekly-seed"
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
echo "Kill switch complete — nothing will fire again until firds-seed-install.sh is re-run."
