# MA-NOV-EXP.W3R2 — Exposure screen review fixes (router, focus, contrast, wording) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; the Founder's UAT (W7) is the next check
APPROVED BY:  Founder — Start Approval required. Nothing is released by this packet
PACKET:       MA-NOV-EXP.W3R2 · Control v1 · usage class small · write owner Engineering Lead
```

## Scope
`claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md` (PASS_WITH_NOTES; pinned): **M-1** move `#/exposure` into the `index.html` router (`parse()` emits `ma:route` as for `fi`) and delete the three claims/timers in `ma-entities.js`; **N-3** after Back from a company page, focus returns to the company link that was used; **N-4** EXP headers and small labels use `--text2` instead of `--dim` (no new colours); **N-6** reconciliation label "Companies (direct + via ETFs)". Nothing else.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `797839b` = origin). Writable (checked by `end`): `App/index.html` (**router `parse()` and its route handling for `exposure` only**), `App/ma-entities.js` (EXP blocks and the three W3 hooks only), `App/Corporate Atlas/tests/`, `claude/packets/MA-NOV-EXP.W3R2_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within the writable scope; Node tests; a local static preview of `App/` against the live read-only APIs with **≤ 5 R-EXP1 look-throughs** (verify: cold deep link, entry link, in-app Back with focus, no "invalid link" toast, other routes `#/entity/…`, `#/fi/…` unchanged); read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
`docs/`, `generate-docs.mjs`; any other `index.html` change; other `ma-*.js`; Worker code, wrangler, D1; storage; new files outside tests; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; the router change breaks an existing route in tests or preview; suites failing; push rejected.

## Success conditions
M-1, N-3, N-4, N-6 done with tests; `ma-entities.js` no longer claims hashes before the router; existing routes unchanged; suites green (gleif-reconcile-011 41/42 pre-existing); one commit pushed; report with the preview checks; `end`.
