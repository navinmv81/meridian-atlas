# MA-NOV-EXP.W3 — Exposure-to-company screen (#/exposure) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Engineering Lead + UX Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Independent review of W2 + W3 together (next packet), then Founder UAT (W7) and release approval (C-2)
APPROVED BY:  Founder — re-plan (NML-1113-9); Start Approval required. Nothing is released by this packet
PACKET:       MA-NOV-EXP.W3 · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
`claude/specs/MA-NOV-EXP_Spec.md` (approved; pinned) §2 (journey, screens, states), §5.1 (dates and labels), §6 (evidence links, labels, banned wording), §7 UI state tests; decisions D2, D3, D6 (UI in `ma-entities.js`), D7 (≤ 10 inputs), D8 (Low confidence shown + display-only filter). W2 functions (`exp_validate`, `exp_combine`, `exp_compute`) as documented in `claude/packets/MA-NOV-EXP.W2_Report.md` §2 (pinned). Live route R-EXP1 on `meridian-entities-api` (200 / 404 / 400 / 422 `too_large` with `limit:"rows"|"size"`).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `c7886b7` = origin). Execute from `claude/packets/MA-NOV-EXP.W3_Task_v1.md`. Writable (checked by `end`): `App/ma-entities.js`, `App/index.html` (**the entry link only**), `App/Corporate Atlas/tests/` (new `exp-ui*` files), `claude/packets/MA-NOV-EXP.W3_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit the writable paths; Node tests; a **local static preview** of `App/` (e.g. `python3 -m http.server` on localhost) that calls the **live** read-only APIs, ≤ 25 R-EXP1 look-through requests in total (each is a D1 read of up to ~38k rows on a miss); inspect it with any browser/preview/screenshot tool available in the session (desktop width and 375 px); run existing suites; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
`docs/` and `node generate-docs.mjs` (release is C-2); any Worker code, deploy or wrangler command; D1 statements; changes to existing behaviour in `ma-entities.js` other than the narrow hooks the spec names (`_navOpen('exposure', …)`, `_navParseFrom` type `exposure`); other `ma-*.js`; `index.html` beyond one entry link; new front-end files (D6); frameworks, CDNs, npm installs, imports between domain files; storage of inputs (URL hash only); banned wording (§6); `*_Status.json`, board, Tower, `transitions.jsonl`, logs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a spec screen/state that cannot be built without a contract change or a new file (stop, report, propose); existing suites failing; look-through budget reached; push rejected.

## Success conditions
`#/exposure` works end to end on the local preview against the live route: inputs in the URL hash, Screen A and Screen B §1–8, all §2 states, evidence links with §6 labels, Back from a company page returns to the result; mobile layout at 375 px; tests for hash parsing/serialisation and state selection; existing suites green; one commit pushed; report with screenshots or a precise UAT checklist; `end`. Nothing released.
