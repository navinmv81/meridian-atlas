# MA-NOV-P1.DEMO — First dispatcher-launched run: Claude.md v1.2 amendments draft — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead (documentation) — headless Claude Code run started by tools/factory/dispatch.mjs
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (separate dispatcher-launched session)
APPROVED BY:  Founder — Start Approval required (recorded in MA-NOV-P1.DEMO_Status.json); the draft's rules become active only after separate Founder approval
PACKET:       MA-NOV-P1.DEMO · Control v1 · usage class light (doc-only) · write owner Engineering Lead (headless run)
```

## Purpose
Prove the pilot loop end to end with a harmless task: the dispatcher validates the approval, takes a lease, launches **one** headless run with a read/write-limited tool set, records heartbeat and evidence, runs the scope check, and sets the result for review. The document produced is a **draft for the Founder**, not an active rule.

## Session facts
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026`.
- Tools available to this run (dispatcher `run_profile`): `Read`, `Glob`, `Grep`, `Write`, `Edit`. **No Bash, no web, no git.** Permission prompts are off; anything else is denied.
- Writable paths (scope-checked after the run): `claude/governance/Claude_md_v1.2_amendments.md` and `claude/packets/MA-NOV-P1.DEMO_Report.md`. A write anywhere else makes the run BLOCKED.

## Allowed actions
Read repository files named in the Task; write the two files above.

## Prohibited actions
Any other file write or edit (including `CLAUDE.md`, any `_Status.json`, the board, `LANE_OPENER.md`, logs); any attempt to run commands, fetch URLs, call D1/Cloudflare/GitHub, read `.env*` or secrets; changing settings or the model.

## Stop gate
After writing the report, stop. Review is MA-NOV-P1.REVIEW.

## Success conditions
1. Both files exist; the draft follows the Task's structure and cites a source for every proposed rule.
2. The dispatcher's scope check passes; the Status shows REVIEW_NEEDED with a run log and report hash.
