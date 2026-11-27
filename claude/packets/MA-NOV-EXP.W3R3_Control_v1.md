# MA-NOV-EXP.W3R3 — Plain-language "What your portfolio is made of" panel — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Engineering Lead + UX Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; Founder re-checks the panel on the local preview
APPROVED BY:  Founder — UAT "testing looks ok barring the panel write-up and split" (NML-1119-3); the Start Approval of this packet approves the exact wording in the Task
PACKET:       MA-NOV-EXP.W3R3 · Control v1 · usage class small · write owner Engineering Lead
```

## Scope
Only the reconciliation panel (Screen B §2) and its bar in the `#/exposure` screen: wording, grouping of lines, hiding zero lines, tooltip/details. The calculation (`exp_compute`), data, route and every other part of the screen are unchanged.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `79822d5` = origin). Writable (checked by `end`): `App/ma-entities.js` (EXP UI block only), `App/Corporate Atlas/tests/` (exp-ui label tests), `claude/packets/MA-NOV-EXP.W3R3_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests; local static preview against the live read-only APIs, ≤ 5 look-throughs; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Changing `exp_validate`/`exp_compute` results; any other panel; `index.html`, `docs/`, other files; Worker, wrangler, D1; storage; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Wording that cannot be applied as written (report the exact conflict); tests failing; push rejected.

## Success conditions
The panel reads exactly as the Task specifies for the scenarios listed; the sum is still checked; banned words absent; tests updated; one commit pushed; report with before/after text for two scenarios; `end`.
