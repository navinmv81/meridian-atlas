#!/bin/bash
# MA-OCT-008 — one-glance status: runner process, pause and kill-switch flags,
# cursor, today's bond writes and SEC requests from the local logs, the last
# run-log lines and the heartbeat key file's presence. Read-only: no D1, no
# network, never prints the ingest key.

set -uo pipefail

BONDS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${BONDS_STATE_DIR:-$BONDS_DIR/state}"
INGEST_ENV="${BONDS_INGEST_ENV:-$HOME/.meridian-secrets/bonds-ops-ingest.env}"

echo "=== MA-OCT-008 bonds-ingest — status ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) ==="
echo ""
echo "-- Runner --"
if [ -f "$STATE_DIR/runner.pid" ] && ps -p "$(cat "$STATE_DIR/runner.pid")" -o command= 2>/dev/null | grep -q "bonds-ingest.mjs"; then
  echo "Running:      YES (pid $(cat "$STATE_DIR/runner.pid"))"
else
  echo "Running:      NO"
fi
echo ""
echo "-- Flags --"
if [ -f "$STATE_DIR/PAUSE" ]; then echo "Paused:       YES  ($(cat "$STATE_DIR/PAUSE"))"; else echo "Paused:       NO"; fi
if [ -f "$STATE_DIR/STOP" ]; then echo "Kill switch:  SET  ($(cat "$STATE_DIR/STOP"))"; else echo "Kill switch:  not set"; fi
echo ""
echo "-- Ops ingest key file --"
if [ -f "$INGEST_ENV" ]; then
  echo "present, mode $(stat -f '%Lp' "$INGEST_ENV") (must be 600); contents never shown"
else
  echo "absent: heartbeats not sent; the run log is the record (Ops reconciles, spec §9.4)"
fi
echo ""
echo "-- Cursor --"
if [ -f "$STATE_DIR/cursor.json" ]; then tr -d '\n' < "$STATE_DIR/cursor.json" | cut -c1-200; echo ""; else echo "none (no live batch yet)"; fi
echo ""
echo "-- Today (UTC) --"
/usr/bin/python3 -I - "$STATE_DIR" <<'PY'
import json, sys, os, datetime
d = sys.argv[1]
t = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
def lines(f):
    p = os.path.join(d, f)
    if not os.path.exists(p): return []
    out = []
    for l in open(p):
        try: out.append(json.loads(l))
        except Exception: pass
    return out
rl = [r for r in lines("runlog.jsonl") if str(r.get("utc", ""))[:10] == t]
w = sum(r.get("writes") or 0 for r in rl if r.get("kind") == "batch")
sec = sum(1 for r in lines("sec-requests.jsonl") if str(r.get("utc", ""))[:10] == t)
print(f"{t}: {w} bond row-writes in live batches (run cap 8,000); {sec} SEC requests (cap 1,500 per run)")
ends = [r for r in rl if r.get("kind") == "run_end"]
for r in ends[-5:]:
    print(f"  run {r['run_id'][:8]} {'dry ' if r.get('dry_run') else ''}{r.get('event')} {json.dumps(r.get('metrics', {}))[:160]}")
PY
echo ""
echo "-- Last run-log lines --"
if [ -f "$STATE_DIR/runlog.jsonl" ]; then tail -n 6 "$STATE_DIR/runlog.jsonl" | cut -c1-220; else echo "no run log yet"; fi
