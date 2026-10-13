#!/bin/bash
# health-check-resume.sh — MA-OCT-002a A3: remove the pause flag.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLAG_PATH="$(cd "$SCRIPT_DIR/../../.." && pwd)/13F Seed/.health-check-paused"
if [ -f "$FLAG_PATH" ]; then rm -f "$FLAG_PATH"; echo "Resumed. Pause flag removed: $FLAG_PATH"
else echo "Not paused — no flag file was present at $FLAG_PATH."; fi
