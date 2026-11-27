# MA-NOV-EXP.UI.REVIEW — Independent review of the exposure calculation and screen (W2 + W3) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Architect + UX reviewer — fresh interactive Claude Code session via LANE_OPENER_v2.md (did not author W2 or W3)
REVIEWED BY:  — (this is the review)
APPROVED BY:  Founder — Start Approval required; Founder UAT (W7) and release approval (C-2) follow
PACKET:       MA-NOV-EXP.UI.REVIEW · Control v1 · usage class medium · write owner Architect (review report only)
```

## Scope
Commits `c7886b7` (W2: `exp_validate`, `exp_combine`, `exp_compute` + tests) and `797839b` (W3: `#/exposure` screen in `App/ma-entities.js`, one entry link in `App/index.html`, UI tests) against the approved spec, decisions D2/D3/D6/D7/D8, and the W2/W3 reports (W2 §4 choices; W3 §5 gaps: router workaround, single-ETF stale warning, picker badge month, ETF holdings link closing the layer).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `797839b` = origin). Writable (checked by `end`): `claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md`. Execute from `claude/packets/MA-NOV-EXP.UI.REVIEW_Task_v1.md`.

## Allowed actions
Read any repository file; read-only git and `git ls-remote`; run the Corporate Atlas suites; experiments in temp copies / scratchpad; a **local static preview** of `App/` against the live read-only APIs with **≤ 10 R-EXP1 look-through requests**; inspect with any browser/preview/screenshot tool available (desktop and 375 px), screenshots to the scratchpad only; write the report.

## Prohibited actions
Editing any repository file other than the report; `docs/`, `generate-docs.mjs`; deploys, wrangler, D1 statements; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; `dispatch.mjs run`/`begin` for another packet; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gate
After writing the report and running `end`, stop.

## Success conditions
Verdict (PASS / PASS_WITH_NOTES / FAIL) with findings (B / M / N); a judgement on each W2 §4 and W3 §5 item; a plain recommendation on whether the screen may go to Founder UAT and then release, with any conditions.
