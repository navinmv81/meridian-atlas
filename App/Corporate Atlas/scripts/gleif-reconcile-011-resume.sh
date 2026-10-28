#!/bin/bash
# MA-OCT-011 — resume (spec rev 1.9 §7). Removes the pause flag. With
# --clear-stop it also removes the kill-switch flag left by -stop.sh (a
# deliberate second step: a kill is never cleared by an ordinary resume).
# The runner is not restarted here — it is interactive only; start it again
# by hand and it continues from its cursor.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PAUSE_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-paused"
STOP_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-stop"

if [ -f "$PAUSE_PATH" ]; then rm -f "$PAUSE_PATH"; echo "Pause flag removed."; else echo "No pause flag was set."; fi

if [ -f "$STOP_PATH" ]; then
  if [ "${1:-}" = "--clear-stop" ]; then
    rm -f "$STOP_PATH"; echo "Kill-switch flag removed."
  else
    echo "Kill-switch flag still present: $STOP_PATH"
    echo "  (cleared only with: $0 --clear-stop)"
  fi
fi
echo "Start the runner again by hand (interactive only); it resumes from its cursor."
