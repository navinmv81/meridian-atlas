# MA-NOV-P1.FIX3 — Commit-check gaps G1–G5, follow-up closure path, Outcomes view, pilot records commit — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-09
EXECUTED BY:  Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW3 (light delta review, fresh session)
APPROVED BY:  Founder — pilot accepted with notes (NML-1108-2): no commit-allowed packet until G1/G2 are fixed; Start Approval required (MA-NOV-P1.FIX3_Status.json)
PACKET:       MA-NOV-P1.FIX3 · Control v1 · usage class medium (gate-critical; usage at 75%) · write owner Engineering Lead
```

## Source
`claude/packets/MA-NOV-P1.REVIEW2_Report.md` (sha256 `dcb1e3db2c20f772024591a69945877232034a4d3dcaefd150be80d2564266e5`) findings G1–G5; Main Lane finding NML-1108-1 (no path to close a packet fixed by a follow-up packet); Founder request NML-1108-2 (sprint scope visible on the Tower).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `eb64d22` = origin). Execute from `claude/packets/MA-NOV-P1.FIX3_Task_v1.md`. Writable (checked by `end`): `tools/factory/` and `claude/packets/MA-NOV-P1.FIX3_Report.md`. `allow_commits: true`. This run is begun by FIX2 code, so its own `before.json` has a start HEAD but no ref snapshot — the new G2 check must treat a missing snapshot as "unavailable", and the reviewer checks this commit with `git show`.

## Allowed actions
Edit files under `tools/factory/`; `node --test tools/factory/test`; experiments in temp repos only; the LANE_OPENER_v2 commands; `git --no-optional-locks` reads; `git add -- <explicit path>` for the Task's commit list; one `git commit`; `git push origin November-2026`; write the report.

## Prohibited actions
Writing any `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl` or log in the real repo; `project.mjs` on the real repo; launching a model or headless run; LaunchAgents, cron, listeners; network beyond git push; D1/Cloudflare; `.env*`, secrets; installs; subagents; forbidden git operations (as P1.BUILD's Control); touching `docs/`, `App/`, `13F Seed/`.

## Stop gates
Any test failing after bounded fixes; a pinned hash mismatch; push rejected; anything needing a prohibited action → stop, report, `end`.

## Success conditions
G1–G5 fixed with tests; closure path in the state table with a test; Outcomes view rendered from DRAFT outcome records; suite green; one commit with exactly the Task's list (including the pilot records), pushed; report; `end`.
