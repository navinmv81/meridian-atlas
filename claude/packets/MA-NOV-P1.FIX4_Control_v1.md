# MA-NOV-P1.FIX4 — H1/H2, Claude.md v1.2 install + CLAUDE.md patch, Tower redesign — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-10
EXECUTED BY:  Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification (git show, tests) tonight; light Architect review MA-NOV-P1.REVIEW4 after the reset
APPROVED BY:  Founder — v1.2 approved with updates and install in FIX4 (NML-1110-1); "lift with notes" (NML-1109-4); Tower redesign (NML-1110-1); Start Approval required (MA-NOV-P1.FIX4_Status.json)
PACKET:       MA-NOV-P1.FIX4 · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
- `claude/packets/MA-NOV-P1.REVIEW3_Report.md` (sha256 `dd256043…042b`): H1, H2.
- `claude/governance/Claude_md_v1.2_amendments.md` (rev 2, sha256 `f27acbcd…`) + `claude/November_Decisions_Log.md` NML-1110-1 (approved with three updates; Q2–Q5 answers).
- Design reference: `claude/factory/design/interim-tower-reference.html` (the Founder-preferred interim Tower; Main Lane file).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `37ad1c2` = origin). Execute from `claude/packets/MA-NOV-P1.FIX4_Task_v1.md`. Writable (checked by `end`): `tools/factory/`, `claude/governance/`, `CLAUDE.md`, `claude/packets/MA-NOV-P1.FIX4_Report.md`. `allow_commits: true`. **This packet may push** `November-2026` (it is the H1 fix the push condition waits for; the Main Lane verifies the push with `ls-remote` and `git show`). Begun by FIX3 code, so the start-branch check (H1) is unavailable for this run's own `end`.

## Allowed actions
Edit files in the writable paths; `node --test tools/factory/test`; render the generated Tower from a **temp copy** of the real Status files (never into the real repo) and inspect it, including a screenshot if a browser/preview tool is available in this session; read-only `git`, `pwd`, `git remote -v` to verify the `CLAUDE.md` facts it writes; `git add -- <explicit path>` per the Task; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
Writing any `*_Status.json`, `config.json`, the real `STATUS_BOARD.md` / `control-tower.html` / `transitions.jsonl`, logs or `LANE_OPENER*`; `project.mjs` on the real repo; model or headless launches; LaunchAgents, cron, listeners; network beyond git push; D1/Cloudflare; `.env*`, secrets; npm installs or CDN/third-party code in the Tower (fonts may use system stacks only — no network); subagents; `docs/`, `App/`, `13F Seed/`; forbidden git operations (as P1.BUILD's Control).

## Stop gates
Any test failing after bounded fixes; a pinned hash mismatch; a `CLAUDE.md` fact that cannot be verified locally (leave the placeholder and report it); push rejected → stop, report, `end`.

## Success conditions
H1, H2 fixed with tests; `claude/governance/Claude_md_v1.2.md` installed (APPROVED, with the three updates); `CLAUDE.md` patched; the generated Tower matches the interim design and renders Founder-request and plan records; suite green; one commit with exactly the Task's list, pushed; report; `end`.
