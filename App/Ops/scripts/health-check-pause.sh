#!/bin/bash
# health-check-pause.sh — MA-OCT-002a A3: pause the watchdog without unloading it.
# While the flag exists, each fire logs "paused" and does no network work.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLAG_PATH="$(cd "$SCRIPT_DIR/../../.." && pwd)/13F Seed/.health-check-paused"
echo "paused at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by health-check-pause.sh" > "$FLAG_PATH"
echo "Paused. Flag file written: $FLAG_PATH"
echo "The LaunchAgent stays scheduled; each fire while paused is a no-op. Its slots show as missed in Ops while paused."
echo "Resume with: $SCRIPT_DIR/health-check-resume.sh"
