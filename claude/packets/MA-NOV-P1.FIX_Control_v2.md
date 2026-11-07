# MA-NOV-P1.FIX — Interactive run mode (begin/end) + dispatcher fixes — Control v2

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (interactive Claude Code, fixed line)
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (covers BUILD + FIX + DEMO)
APPROVED BY:  Founder — "sign-in: B" (07 Nov 09:27): no headless sign-in; runs start from the fixed line. Start Approval required (MA-NOV-P1.FIX_Status.json)
PACKET:       MA-NOV-P1.FIX · Control v2 (supersedes v1 16e09a9c…0869, never approved or run) · usage class medium · write owner Engineering Lead (LANE-NOV-ENG)
```

## Why
P1.DEMO run `r-20261107T092212Z-c0da` showed headless workers are not signed in; the Founder chose **not** to sign them in (option B). Runs therefore stay interactive (fixed line in Claude Code). The dispatcher keeps its record-keeping role by **bracketing** each interactive run, so the Tower shows live state, duplicate runs are refused and the scope check still applies. The headless path stays in the code for later, with the two fixes found in that run.

## Session opener
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` = origin (check `ls-remote`), no `.git/*.lock`. Execute from `claude/packets/MA-NOV-P1.FIX_Task_v2.md`. This run itself uses the current `LANE_OPENER.md` (no begin/end yet).

## Allowed actions
Edit `tools/factory/dispatch.mjs`, `tools/factory/lib/*.mjs`, `tools/factory/project.mjs`, `tools/factory/README.md`, files under `tools/factory/test/`; run `node --test tools/factory/test`; run `node tools/factory/dispatch.mjs check` and `node tools/factory/project.mjs` read-only against the real repo **only into a temp copy** (no writes to real Status files); stage the Task's commit list by explicit path; one commit; `git push origin November-2026`; write `claude/packets/MA-NOV-P1.FIX_Report.md`.

## Prohibited actions
Launching any model or agent; running `begin`/`end`/`run` against the real repo; writing any real `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, logs, `LANE_OPENER.md`, `CLAUDE.md`; signing in or touching credentials/keychain/`~/.claude`; npm installs; listeners; `launchctl`; D1/wrangler/production; `docs/`, `App/`, `13F Seed/`; forbidden git operations as in P1.BUILD's Control.

## Stop gates
Any test failing after bounded fixes; push rejected; anything needing a prohibited action → stop and report. After the report → stop.

## Success conditions
1. `begin <ID>` and `end <ID>` behave as the Task specifies, with tests.
2. Headless argv includes `--tools`; sign-in failure classified.
3. Tower/board show interactive runs (mode, holder, started, lease expiry) distinctly from headless runs.
4. All tests pass; one commit with exactly the Task's list, pushed.
