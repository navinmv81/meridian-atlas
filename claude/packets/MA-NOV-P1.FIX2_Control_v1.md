# MA-NOV-P1.FIX2 — Review must-fix: scope check, global lock, Tower, session ids, draft alignment — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md (did not write the review)
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW2 (fresh session, delta review of this packet only)
APPROVED BY:  Founder — Start Approval + decisions F3 and D1 (MA-NOV-P1.FIX2_Status.json)
PACKET:       MA-NOV-P1.FIX2 · Control v1 · usage class medium · write owner Engineering Lead
```

## Source
`claude/packets/MA-NOV-P1.REVIEW_Report.md` (sha256 `7677ad1d033fd3e2b59a29745c16e166c72c2b4dded5d98e417784ac1b26cb99`), verdict PASS_WITH_NOTES. This packet closes the nine must-fix items (F1–F6, D1–D3) and the cheap notes F7, F9, F10, D4–D6, using the Founder's choices: **F3 option (b)** — honest snapshot labels, no scheduler; **D1** — the tested code transition table is canonical and the draft is aligned to it.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `a74d1b7` = origin). Execute from `claude/packets/MA-NOV-P1.FIX2_Task_v1.md`. Writable paths (checked by `end`): `tools/factory/` (directory), `claude/governance/Claude_md_v1.2_amendments.md`, `claude/packets/MA-NOV-P1.FIX2_Report.md`. This run may commit (`run_profile.allow_commits: true`); the running `end` is the pre-fix code, so the reviewer checks the commit by `git show`.

## Allowed actions
Edit files in the writable paths; `node --test tools/factory/test`; `dispatch.mjs` and `project.mjs` only against **temp copies** (plus the opener's own `check`/`begin`/`end`); `git --no-optional-locks` reads; `git add -- <explicit path>` for the Task's commit list; one `git commit`; `git push origin November-2026`.

## Prohibited actions
Writing any `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl` in the real repo, LANE_OPENER files, logs, `CLAUDE.md`; launching a model or headless run; LaunchAgents, cron, listeners; network beyond git push; D1/Cloudflare; `.env*`, secrets; installs; subagents; forbidden git operations (as P1.BUILD's Control).

## Stop gates
Any test failing after bounded fixes; push rejected; anything needing a prohibited action → stop, write the report, run `end`.

## Success conditions
All Task items done with tests; full suite green; draft aligned; one commit with exactly the Task's list, pushed; report written; `end` run.
