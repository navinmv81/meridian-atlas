#!/bin/bash
# MA-OCT-011 — kill switch (spec rev 1.9 §7). Writes the stop flag and sends
# SIGTERM to the runner's own Node process (pid file in the work folder).
# The runner finishes the in-flight wrangler call (it runs in its own process
# group, so it is not interrupted), writes the checkpoint, and exits `killed`
# (run log `killed`, heartbeat `killed`). The flag also refuses any new start
# until cleared with: gleif-reconcile-011-resume.sh --clear-stop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STOP_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-stop"
WORK_DIR="${GLEIF011_WORK_DIR:-$HOME/MeridianAtlas-work/gleif-011}"
PID_PATH="$WORK_DIR/runner.pid"

echo "stopped at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by gleif-reconcile-011-stop.sh (${USER:-unknown})" > "$STOP_PATH"
echo "Kill-switch flag written: $STOP_PATH"

if [ -f "$PID_PATH" ]; then
  PID="$(cat "$PID_PATH")"
  if [ -n "$PID" ] && ps -p "$PID" -o command= 2>/dev/null | grep -q "gleif-reconcile-011.mjs"; then
    kill -TERM "$PID"
    echo "SIGTERM sent to runner pid $PID: it finishes the in-flight call, checkpoints and exits 'killed'."
  else
    echo "Pid file present but no live runner with pid $PID (stale pid file)."
  fi
else
  echo "No runner pid file: no runner is running. The flag blocks the next start."
fi
