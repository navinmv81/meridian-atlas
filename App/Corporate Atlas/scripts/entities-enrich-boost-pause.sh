#!/bin/bash
# MA-SEP-010 — soft stop. Creates the pause flag file that
# entities-enrich-boost-run.mjs checks as the very first thing it does,
# before any network call or D1 read/write. The LaunchAgent stays loaded and
# scheduled; each fire while paused is a true no-op (logged as such). Does
# not touch launchctl at all — see entities-enrich-boost-uninstall.sh for the
# hard stop. Mirrors firds-seed-pause.sh exactly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.entities-enrich-boost-paused"

echo "paused at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by entities-enrich-boost-pause.sh" > "$FLAG_PATH"
echo "Paused. Flag file written: $FLAG_PATH"
echo "The LaunchAgent (if installed) stays scheduled — each fire while paused will be a no-op."
echo "This does not affect the existing Cloudflare Cron Trigger (06:00/06:50 UTC) — only the local boost invocations."
echo "Resume with: $SCRIPT_DIR/entities-enrich-boost-resume.sh"
