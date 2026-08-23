#!/bin/bash
# MA-SEP-003 — removes the pause flag so the weekly FIRDS seed job resumes
# running normally on its next scheduled (or forced) fire. Counterpart to
# firds-seed-pause.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_PATH="$CORP_ATLAS_DIR/.firds-seed-paused"

if [ -f "$FLAG_PATH" ]; then
  rm -f "$FLAG_PATH"
  echo "Resumed. Pause flag removed: $FLAG_PATH"
else
  echo "Not paused — no flag file was present at $FLAG_PATH."
fi
