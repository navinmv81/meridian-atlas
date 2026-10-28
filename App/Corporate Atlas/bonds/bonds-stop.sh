#!/bin/bash
# MA-OCT-008 — kill switch (spec rev 1.2 §9.3 gate 4). Writes state/STOP and sends
# SIGTERM to the runner. The in-flight batch finishes, the cursor is written, no
# further batch runs, and the run ends `killed` (detail.reason = operator_stop).
# The flag also refuses the next start until cleared: bonds-resume.sh --clear-stop

set -euo pipefail

BONDS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${BONDS_STATE_DIR:-$BONDS_DIR/state}"
mkdir -p "$STATE_DIR"

echo "stopped at $(date -u +"%Y-%m-%dT%H:%M:%SZ") by bonds-stop.sh (${USER:-unknown})" > "$STATE_DIR/STOP"
echo "Kill-switch flag written: $STATE_DIR/STOP"

if [ -f "$STATE_DIR/runner.pid" ]; then
  PID="$(cat "$STATE_DIR/runner.pid")"
  if [ -n "$PID" ] && ps -p "$PID" -o command= 2>/dev/null | grep -q "bonds-ingest.mjs"; then
    kill -TERM "$PID"
    echo "SIGTERM sent to runner pid $PID: it finishes the in-flight batch and exits 'killed'."
  else
    echo "Pid file present but no live runner with pid $PID (stale pid file)."
  fi
else
  echo "No runner pid file: no runner is running. The flag blocks the next start."
fi
