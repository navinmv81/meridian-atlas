#!/bin/bash
# MA-OCT-013 — the one entry point for every 013 command (spec rev 1 §9; Ops M-2). It sources ONE
# env file, 013.env (no secrets), so that every command acts on the 013 work folder and the 013 job,
# never on 011's or A2's. The first output line names WORK_DIR and JOB_ID.
#
#   merge-013.sh init                       create ~/MeridianAtlas-work/merge-013 (700) and 013.env (600); never overwrites
#   merge-013.sh status                     flags, runner pid, cursor, last run-log lines, remainder
#   merge-013.sh pause | resume [--clear-stop]
#   merge-013.sh stop                       kill switch: stop flag + SIGTERM to the 013 runner's own pid only
#   merge-013.sh export|plan|build-replica|migrate|run|readback|restore|lei|verify|recon [args]   (merge-013.mjs)
#
# MERGE013_ENV overrides the env file path (tests). The emitter key lives in $MERGE013_WORK_DIR/ops-ingest.env
# (mode 600, K-2) and is never read here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOME_DEFAULT="$HOME/MeridianAtlas-work/merge-013"
ENV_FILE="${MERGE013_ENV:-$HOME_DEFAULT/013.env}"
PAUSE_PATH="$CORP_DIR/.merge-013-paused"
STOP_PATH="$CORP_DIR/.merge-013-stop"
JOB="manual.entity-merge-013"
CMD="${1:-}"

if [ "$CMD" = "init" ]; then
  WORK="${2:-$HOME_DEFAULT}"
  case "$WORK" in *gleif-011*|*gleif-a2*) echo "refused: work dir $WORK belongs to 011 / A2" >&2; exit 2;; esac
  BODY="MERGE013_WORK_DIR=$WORK
MERGE013_JOB_ID=$JOB"
  if [ -f "$ENV_FILE" ]; then
    if [ "$(cat "$ENV_FILE")" = "$BODY" ]; then echo "013.env already present and identical: $ENV_FILE"; exit 0; fi
    echo "refused: $ENV_FILE exists with different content (never overwritten)" >&2; exit 2
  fi
  mkdir -p "$WORK" && chmod 700 "$WORK"
  mkdir -p "$(dirname "$ENV_FILE")"
  ( umask 077; printf '%s\n' "$BODY" > "$ENV_FILE" )
  chmod 600 "$ENV_FILE"
  echo "created $ENV_FILE (600) and $WORK (700)"
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then echo "refused: $ENV_FILE not found — run '$0 init' first (Ops M-2: every 013 command sources it)" >&2; exit 2; fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
if [ "${MERGE013_JOB_ID:-}" != "$JOB" ] || [ -z "${MERGE013_WORK_DIR:-}" ]; then
  echo "refused: $ENV_FILE must set MERGE013_WORK_DIR and MERGE013_JOB_ID=$JOB" >&2; exit 2
fi
case "$MERGE013_WORK_DIR" in *gleif-011*|*gleif-a2*) echo "refused: MERGE013_WORK_DIR points at 011 / A2 ($MERGE013_WORK_DIR)" >&2; exit 2;; esac
export MERGE013_WORK_DIR MERGE013_JOB_ID
PID_PATH="$MERGE013_WORK_DIR/runner.pid"

echo "WORK_DIR=$MERGE013_WORK_DIR JOB_ID=$MERGE013_JOB_ID (from $ENV_FILE)"
shift || true

case "$CMD" in
  pause)
    echo "paused at $(date -u +%Y-%m-%dT%H:%M:%SZ) by merge-013.sh (${USER:-unknown})" > "$PAUSE_PATH"
    echo "Pause flag written: $PAUSE_PATH (the runner stops before its next batch)" ;;
  resume)
    rm -f "$PAUSE_PATH"; echo "Pause flag cleared."
    if [ "${1:-}" = "--clear-stop" ]; then rm -f "$STOP_PATH"; echo "Stop flag cleared."; elif [ -f "$STOP_PATH" ]; then echo "Stop flag still present: $STOP_PATH (use resume --clear-stop)"; fi ;;
  stop)
    echo "stopped at $(date -u +%Y-%m-%dT%H:%M:%SZ) by merge-013.sh (${USER:-unknown})" > "$STOP_PATH"
    echo "Kill-switch flag written: $STOP_PATH"
    if [ -f "$PID_PATH" ]; then
      PID="$(cat "$PID_PATH")"
      if [ -n "$PID" ] && ps -p "$PID" -o command= 2>/dev/null | grep -q "merge-013.mjs"; then
        kill -TERM "$PID"; echo "SIGTERM sent to the 013 runner pid $PID: it finishes the in-flight call, checkpoints and exits 'killed'."
      else echo "Pid file present but no live 013 runner with pid $PID (stale pid file); nothing signalled."; fi
    else echo "No 013 runner pid file: no runner is running. The flag blocks the next start."; fi ;;
  status)
    echo "flags: pause=$([ -f "$PAUSE_PATH" ] && echo SET || echo clear) stop=$([ -f "$STOP_PATH" ] && echo SET || echo clear)"
    if [ -f "$PID_PATH" ] && ps -p "$(cat "$PID_PATH")" -o command= 2>/dev/null | grep -q "merge-013.mjs"; then echo "runner: running (pid $(cat "$PID_PATH"))"; else echo "runner: not running"; fi
    for c in "$MERGE013_WORK_DIR"/cursor-*.json; do [ -f "$c" ] && echo "cursor $(basename "$c"): $(tr -d '\n' < "$c" | cut -c1-300)"; done
    [ -f "$MERGE013_WORK_DIR/runlog.jsonl" ] && { echo "last run-log lines:"; tail -n 5 "$MERGE013_WORK_DIR/runlog.jsonl"; } || echo "run log: none"
    [ -f "$MERGE013_WORK_DIR/remainder.json" ] && echo "remainder: $(cat "$MERGE013_WORK_DIR/remainder.json.sha256" 2>/dev/null)" || true ;;
  export|plan|build-replica|migrate|run|readback|restore|lei|verify|recon)
    exec node --no-warnings "$SCRIPT_DIR/merge-013.mjs" "$CMD" "$@" ;;
  *)
    echo "usage: $0 init | status | pause | resume [--clear-stop] | stop | export|plan|build-replica|migrate|run|readback|restore|lei|verify|recon" >&2; exit 2 ;;
esac
