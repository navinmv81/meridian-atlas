#!/bin/bash
# MA-OCT-011 — soft stop (spec rev 1.9 §7). Writes the pause flag that
# gleif-reconcile-011.mjs checks before EVERY batch. The in-flight batch
# finishes; the next batch is not started (run log `paused`, heartbeat
# `skipped` / reason `pause`). Resume with gleif-reconcile-011-resume.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-paused"

echo "paused at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by gleif-reconcile-011-pause.sh (${USER:-unknown})" > "$FLAG_PATH"
echo "Paused. Flag file written: $FLAG_PATH"
echo "The runner stops before its next batch; the cursor stays where it is."
echo "Resume with: $SCRIPT_DIR/gleif-reconcile-011-resume.sh"
