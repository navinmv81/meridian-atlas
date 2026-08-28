#!/bin/bash
# MA-SEP-010 — removes the pause flag so the boost job resumes running
# normally on its next scheduled fire. Counterpart to
# entities-enrich-boost-pause.sh. Mirrors firds-seed-resume.sh exactly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.entities-enrich-boost-paused"

if [ -f "$FLAG_PATH" ]; then
  rm -f "$FLAG_PATH"
  echo "Resumed. Pause flag removed: $FLAG_PATH"
else
  echo "Not paused — no flag file was present at $FLAG_PATH."
fi
