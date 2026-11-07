# MA-NOV-P1.FIX — Dispatcher fixes from the first real launch — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (interactive Claude Code, fixed line)
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (covers BUILD + FIX + DEMO)
APPROVED BY:  Founder — Start Approval required (recorded in MA-NOV-P1.FIX_Status.json)
PACKET:       MA-NOV-P1.FIX · Control v1 · usage class medium · write owner Engineering Lead (LANE-NOV-ENG)
```

## Why
P1.DEMO run `r-20261107T092212Z-c0da` (log `claude/factory/runs/r-20261107T092212Z-c0da/`) showed: (1) the headless worker was not signed in (`authentication_failed`, "Not logged in · Please run /login"; 0 tokens, 0 writes) and the dispatcher reported only "worker exit 1"; (2) the worker's `init` event listed every tool (Bash, WebSearch, Task, …) — `--allowedTools` pre-approves but does not hide tools.

## Session opener
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` = origin (`2d41378` or later Main Lane commit — check `ls-remote`), no `.git/*.lock`. Execute from `claude/packets/MA-NOV-P1.FIX_Task_v1.md`.

## Allowed actions
Edit `tools/factory/dispatch.mjs`, `tools/factory/README.md`, files under `tools/factory/test/`; run `node --test tools/factory/test`; `node tools/factory/dispatch.mjs run MA-NOV-P1.DEMO --dry-run` (prints argv only — no lease, no launch); stage the Task's commit list by explicit path; one commit; `git push origin November-2026`; write `claude/packets/MA-NOV-P1.FIX_Report.md`.

## Prohibited actions
Launching any model or agent (no `dispatch run` without `--dry-run`, no `claude -p`); writing any `*_Status.json`, `config.json`, the board, the Tower, logs, `LANE_OPENER.md`, `CLAUDE.md`; signing in or touching credentials, keychain or `~/.claude`; npm installs; listeners; `launchctl`; D1/wrangler/production; `docs/`, `App/`, `13F Seed/`; forbidden git operations as in P1.BUILD's Control.

## Stop gates
Any test failing after bounded fixes; push rejected; anything needing a prohibited action → stop and report. After the report → stop.

## Success conditions
1. The launch argv includes `--tools <run_profile.allowed_tools>` (plus the existing `--allowedTools`).
2. An `authentication_failed` / "Not logged in" worker result → BLOCKED with `run.blocked_reason` = `worker not signed in — sign in once (see tools/factory/README.md)`; no hold, no retry.
3. All tests pass, including the two new ones; `--dry-run` on the real repo shows `--tools Read,Glob,Grep,Write,Edit`.
4. One commit with exactly the Task's list, pushed.
