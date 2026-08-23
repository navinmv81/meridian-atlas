#!/bin/bash
# MA-SEP-003 — install the weekly FIRDS seed LaunchAgent.
#
# Writes ~/Library/LaunchAgents/com.meridianatlas.firds-weekly-seed.plist
# and loads it. Fires firds-local-seed.mjs weekly, comfortably after ESMA's
# ~09:00 CET/CEST Sunday FULINS_C publish window.
#
# Schedule reasoning (checked live, not assumed — Spec Requirement 6 /
# Change Request explicitly require this): this machine's local timezone is
# BST/GMT (UK), confirmed via `date`. The UK is consistently 1 hour behind
# the CET/CEST zone year-round (both the UK and the EU shift their own DST
# on the same calendar dates), so a local fire time of 11:00 UK time is
# always ~12:00 CET/CEST — a solid ~3 hour buffer past the ~09:00 CET/CEST
# publish window regardless of season. Sunday = Weekday 0 in launchd's
# StartCalendarInterval.
#
# Idempotent: safe to re-run. If the LaunchAgent is already loaded, this
# unloads it first (ignoring "not found" errors) before writing a fresh
# plist and reloading — matches the "uninstall and reinstall cleanly"
# acceptance criterion in the Spec/Build Brief.
#
# PATH fix (2026-08-22, claude/Escalation_LaunchAgent_TCC_Permission.md
# "Update 2026-08-22"): launchd runs jobs with a bare
# /usr/bin:/bin:/usr/sbin:/sbin PATH that does not include the directory
# node/npx/wrangler actually live in on this machine — the seed script's
# `npx wrangler ...` subprocess calls fail with `spawnSync npx ENOENT`
# without this. Baked into the plist template below (EnvironmentVariables)
# so a future reinstall via this script doesn't silently regress and drop
# the fix again.

set -euo pipefail

LABEL="com.meridianatlas.firds-weekly-seed"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_SCRIPT="$CORP_ATLAS_DIR/firds-local-seed.mjs"
LOG_DIR="$CORP_ATLAS_DIR/logs"

if [ ! -f "$SEED_SCRIPT" ]; then
  echo "ERROR: seed script not found at $SEED_SCRIPT" >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: 'node' not found on PATH. Install Node or adjust this script." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

# Directory node actually resolved from, first in PATH so it wins regardless
# of machine (Intel Homebrew /usr/local/bin, Apple Silicon /opt/homebrew/bin,
# nvm, etc.) — then both common Homebrew locations as a defensive fallback,
# then the standard system dirs launchd already provides.
NODE_DIR="$(dirname "$NODE_BIN")"
LAUNCHD_PATH="${NODE_DIR}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

echo "Label:        $LABEL"
echo "Plist path:   $PLIST_PATH"
echo "Node binary:  $NODE_BIN"
echo "Seed script:  $SEED_SCRIPT"
echo "Schedule:     Sundays, 11:00 local time ($(date +%Z), UTC offset $(date +%z))"
echo "LaunchAgent PATH: $LAUNCHD_PATH"
echo ""

# Idempotent reinstall: unload first if already present (errors ignored —
# fine if it wasn't loaded).
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "Existing LaunchAgent found — unloading before reinstall..."
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
fi

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
        <string>cd "${CORP_ATLAS_DIR}" &amp;&amp; "${NODE_BIN}" firds-local-seed.mjs</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${LAUNCHD_PATH}</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>11</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/firds-seed-launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/firds-seed-launchd-stderr.log</string>
</dict>
</plist>
PLIST

# launchctl bootstrap is the modern (macOS 10.11+) mechanism; fall back to
# the older `launchctl load` if bootstrap isn't available for some reason
# (per the Change Request's documented fallback).
if launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/tmp/firds-install-bootstrap-err.$$; then
  echo "Loaded via 'launchctl bootstrap'."
else
  echo "'launchctl bootstrap' failed ($(cat /tmp/firds-install-bootstrap-err.$$)), trying 'launchctl load' fallback..."
  rm -f /tmp/firds-install-bootstrap-err.$$
  launchctl load "$PLIST_PATH"
  echo "Loaded via 'launchctl load' (compatibility fallback)."
fi
rm -f /tmp/firds-install-bootstrap-err.$$

echo ""
echo "Installed and loaded. Verify with: $SCRIPT_DIR/firds-seed-status.sh"
