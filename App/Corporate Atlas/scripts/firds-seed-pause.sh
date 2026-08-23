#!/bin/bash
# MA-SEP-003 — soft stop. Creates the pause flag file that
# firds-local-seed.mjs checks as the very first thing it does, before any
# network call or D1 write. The LaunchAgent stays loaded and scheduled;
# each fire while paused is a true no-op (logged as such). Does not touch
# launchctl at all — see firds-seed-uninstall.sh for the hard stop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.firds-seed-paused"

echo "paused at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by firds-seed-pause.sh" > "$FLAG_PATH"
echo "Paused. Flag file written: $FLAG_PATH"
echo "The LaunchAgent (if installed) stays scheduled — each fire while paused will be a no-op."
echo "Resume with: $SCRIPT_DIR/firds-seed-resume.sh"
