#!/bin/bash
# MA-OCT-008 — resume. Removes state/PAUSE. With --clear-stop it also removes the
# kill-switch flag (a deliberate second step: a kill is never cleared by an
# ordinary resume). The runner is manual only: start it again by hand; discovery
# skips stored accessions, so it continues where it stopped.

set -euo pipefail

BONDS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${BONDS_STATE_DIR:-$BONDS_DIR/state}"

if [ -f "$STATE_DIR/PAUSE" ]; then rm -f "$STATE_DIR/PAUSE"; echo "Pause flag removed."; else echo "No pause flag was set."; fi

if [ -f "$STATE_DIR/STOP" ]; then
  if [ "${1:-}" = "--clear-stop" ]; then
    rm -f "$STATE_DIR/STOP"; echo "Kill-switch flag removed."
  else
    echo "Kill-switch flag still present: $STATE_DIR/STOP"
    echo "  (cleared only with: $0 --clear-stop)"
  fi
fi
echo "Start the runner again by hand: node $BONDS_DIR/bonds-ingest.mjs --mode=incremental"
