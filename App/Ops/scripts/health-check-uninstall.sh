#!/bin/bash
# health-check-uninstall.sh — MA-OCT-002a A3: hard stop ("kill switch").
# Unloads the LaunchAgent and deletes its plist. Nothing fires again until
# health-check-install.sh is re-run. Server side, the sweep can also be switched
# off with OPS_SWEEP_ENABLED="false" (deploy) or ingest_enabled=0 on local.health-check.
set -uo pipefail
LABEL="com.meridianatlas.health-check"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Unloading LaunchAgent ($LABEL)..."; launchctl bootout "gui/$(id -u)/$LABEL"; echo "Unloaded."
else
  echo "LaunchAgent ($LABEL) was not loaded."
fi
if [ -f "$PLIST_PATH" ]; then rm -f "$PLIST_PATH"; echo "Deleted $PLIST_PATH"; else echo "No plist at $PLIST_PATH (already removed)."; fi
echo ""
echo "Kill switch complete — the watchdog will not fire again until health-check-install.sh is re-run."
