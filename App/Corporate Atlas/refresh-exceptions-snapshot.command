#!/bin/bash
# MA-SEP-012d — one-click refresh for the entity_merge_exceptions snapshot (MA-SEP-012c).
# Double-click this file in Finder: regenerates entity-exceptions-snapshot.html from live
# D1 via export-exceptions-snapshot.mjs, then opens the fresh page in the default browser.
# Does NOT touch export-exceptions-snapshot.mjs's own logic, D1 query, or output format —
# this is a thin wrapper only.

set -uo pipefail

# macOS runs a double-clicked .command file with cwd = the user's home directory, not this
# file's own directory — resolve our real location explicitly so this works regardless of
# how it's invoked (double-click, or run directly from a terminal in any cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || {
  echo "ERROR: could not cd to $SCRIPT_DIR"
  read -p "Press Enter to close this window..."
  exit 1
}

SNAPSHOT_HTML="$SCRIPT_DIR/entity-exceptions-snapshot.html"

echo "=== MA-SEP-012d: refreshing entity_merge_exceptions snapshot ==="
echo "Running export-exceptions-snapshot.mjs from $SCRIPT_DIR ..."
echo ""

if node export-exceptions-snapshot.mjs; then
  echo ""
  if [ -f "$SNAPSHOT_HTML" ]; then
    echo "Snapshot refreshed successfully. Opening in your default browser..."
    open "$SNAPSHOT_HTML"
    echo "Done. This window will close in a moment."
    sleep 2
    exit 0
  else
    echo "ERROR: export-exceptions-snapshot.mjs exited successfully but"
    echo "  $SNAPSHOT_HTML"
    echo "was not found afterward — not opening anything, since there is nothing"
    echo "fresh to open. This should not normally happen; check the output above."
    read -p "Press Enter to close this window..."
    exit 1
  fi
else
  status=$?
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "REFRESH FAILED (exit code $status) — the snapshot was NOT updated."
  echo "The browser will NOT be opened, so you don't see stale or missing data."
  echo ""
  echo "Common causes: wrangler not authenticated (try: wrangler whoami),"
  echo "no network connection, or a live D1 error — see the output above"
  echo "for the actual error from export-exceptions-snapshot.mjs."
  echo "════════════════════════════════════════════════════════════════"
  read -p "Press Enter to close this window..."
  exit "$status"
fi
