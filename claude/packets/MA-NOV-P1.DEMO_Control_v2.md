# MA-NOV-P1.DEMO — First bracketed interactive run: Claude.md v1.2 amendments draft — Control v2

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead (documentation) — interactive Claude Code, fixed line via LANE_OPENER_v2.md
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (separate session)
APPROVED BY:  Founder — Start Approval required (MA-NOV-P1.DEMO_Status.json); the draft's rules become active only after separate Founder approval
PACKET:       MA-NOV-P1.DEMO · Control v2 (supersedes v1 dd34368e…c41a: headless run blocked, not signed in; Founder chose interactive runs) · usage class light (doc-only) · write owner Engineering Lead (documentation)
```

## Purpose
Prove the pilot loop with interactive runs: Founder approval here → fixed line → `dispatch.mjs begin` (lease, EXECUTING, live on the Tower) → bounded doc work → report → `dispatch.mjs end` (scope check, REVIEW_NEEDED) → independent review → Founder acceptance. The document produced is a **draft for the Founder**, not an active rule.

## Session facts
- Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026`.
- Writable paths (checked by `end`): `claude/governance/Claude_md_v1.2_amendments.md` and `claude/packets/MA-NOV-P1.DEMO_Report.md`. A write anywhere else makes the run BLOCKED.
- Execute from `claude/packets/MA-NOV-P1.DEMO_Task_v2.md`.

## Allowed actions
Read repository files named in the Task; write the two files above; the shell commands `LANE_OPENER_v2.md` names (`ls .git/*.lock`, `dispatch.mjs check`, `begin`, `end`) and read-only `shasum`/`grep`/`sed`/`cat`.

## Prohibited actions
Any other file write or edit (including `CLAUDE.md`, any `_Status.json`, the board, the Tower, LANE_OPENER files, logs); git writes; network; D1/Cloudflare/GitHub; `.env*` or secrets; installs; subagents; changing settings or the model.

## Stop gate
After writing the report and running `end`, stop. Review is MA-NOV-P1.REVIEW.

## Success conditions
1. Both files exist; the draft follows the Task's structure and cites a source for every proposed rule.
2. `end` prints REVIEW_NEEDED; the Status shows the interactive run with its report hash.
