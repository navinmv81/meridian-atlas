#!/bin/bash
# MA-OCT-008 — pause (spec rev 1.2 §9.3 gate 3). Writes state/PAUSE. At start the
# runner ends `skipped` (reason=pause); mid-run it stops before the next batch and
# ends `partial` with its cursor. Resume with bonds-resume.sh.

set -euo pipefail

BONDS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${BONDS_STATE_DIR:-$BONDS_DIR/state}"
mkdir -p "$STATE_DIR"

echo "paused at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by bonds-pause.sh (${USER:-unknown})" > "$STATE_DIR/PAUSE"
echo "Paused. Flag file written: $STATE_DIR/PAUSE"
echo "The runner stops before its next batch; the cursor stays where it is."
echo "Resume with: $BONDS_DIR/bonds-resume.sh"
