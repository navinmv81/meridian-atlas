#!/bin/bash
# MA-OCT-011 — one-glance status (spec rev 1.9 §7): runner process, pause and
# kill-switch flags, holds (A pilot, E-4, E-A drop), cursor per plan, today's
# 011 writes from the run log, and the last run-log lines. Read-only: no D1,
# no network, never prints the ingest key.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_ATLAS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="${GLEIF011_WORK_DIR:-$HOME/MeridianAtlas-work/gleif-011}"
PAUSE_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-paused"
STOP_PATH="$CORP_ATLAS_DIR/.gleif-reconcile-011-stop"

echo "=== MA-OCT-011 gleif-reconcile-011 — status ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) ==="
echo ""
echo "-- Runner --"
if [ -f "$WORK_DIR/runner.pid" ] && ps -p "$(cat "$WORK_DIR/runner.pid")" -o command= 2>/dev/null | grep -q "gleif-reconcile-011.mjs"; then
  echo "Running:      YES (pid $(cat "$WORK_DIR/runner.pid"))"
else
  echo "Running:      NO"
fi
echo ""
echo "-- Flags --"
if [ -f "$PAUSE_PATH" ]; then echo "Paused:       YES  ($(cat "$PAUSE_PATH"))"; else echo "Paused:       NO"; fi
if [ -f "$STOP_PATH" ]; then echo "Kill switch:  SET  ($(cat "$STOP_PATH"))"; else echo "Kill switch:  not set"; fi
echo ""
echo "-- Holds --"
for h in a-pilot e4-trigger ea-dropped; do
  if [ -f "$WORK_DIR/holds/$h.json" ]; then echo "$h: $(tr -d '\n' < "$WORK_DIR/holds/$h.json" | cut -c1-200)"; fi
done
[ -d "$WORK_DIR/holds" ] || echo "none"
echo ""
echo "-- Ops ingest key file (K-2) --"
if [ -f "$WORK_DIR/ops-ingest.env" ]; then
  echo "present, mode $(stat -f '%Lp' "$WORK_DIR/ops-ingest.env") (must be 600); contents never shown"
else
  echo "absent: heartbeats not sent; runlog.jsonl is the record of truth (daily reconciliation, R-4)"
fi
echo ""
echo "-- Cursors --"
ls "$WORK_DIR"/cursor-*.json >/dev/null 2>&1 && for c in "$WORK_DIR"/cursor-*.json; do
  /usr/bin/python3 -I -c 'import json,sys; c=json.load(open(sys.argv[1])); print(sys.argv[1].rsplit("/",1)[-1], "next batch index", c["next"], "| done", len(c["done"]), "| restored", len(c.get("restored",{})))' "$c"
done || echo "none"
echo ""
echo "-- 011 writes today (run log, UTC) --"
if [ -f "$WORK_DIR/runlog.jsonl" ]; then
  /usr/bin/python3 -I -c '
import json,sys,datetime
t=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
w=sum(r.get("writes") or 0 for r in rows if r["utc"][:10]==t)
n=sum(1 for r in rows if r["utc"][:10]==t)
print(f"{t}: {w} row-writes in {n} run-log lines (cap 25,000; plus ~5 per delivered Ops event)")' "$WORK_DIR/runlog.jsonl"
  echo ""
  echo "-- Last run-log lines --"
  tail -n 8 "$WORK_DIR/runlog.jsonl" | cut -c1-240
else
  echo "no run log yet"
fi
