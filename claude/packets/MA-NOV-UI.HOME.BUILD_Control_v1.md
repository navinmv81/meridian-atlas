# MA-NOV-UI.HOME.BUILD — Homepage: Research card (layout A), company search, phone width, no live claims — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Combined independent review of OPS + HOME + POLISH, then Founder UAT
APPROVED BY:  Founder — UI spec with **home layout A** (NML-1121-4); Start Approval required; approving this packet also approves the **card wording in the Task** (shortened from spec §2.3 for layout A)
PACKET:       MA-NOV-UI.HOME.BUILD · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
`claude/specs/MA-NOV-UI_Spec.md` (approved; pinned) §2.1, §2.4–2.7, §5.2 (H-1–H-10), UD-6, UD-7 — **with layout A replacing §2.2/UD-8**: no `#home-entry` above the banner. Markets and news stay first. A compact **Research card** sits at the **top of the right-hand column** (`#right`, above News); at ≤ 900 px it appears **directly after the market banner and ticker, before the market cards** (no duplicated ids). The header Exposure tile stays.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `4ad4ca3` = origin). Writable (checked by `end`): `App/index.html`, `App/ma-search.js`, `App/Corporate Atlas/tests/home-entry.test.mjs`, `claude/packets/MA-NOV-UI.HOME.BUILD_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests; a local static preview of `App/` against the live read-only APIs (≤ 4 R-EXP1 look-throughs for the example; ≤ 20 entity-search requests); screenshots at 1280 / 800 / 375 to the scratchpad; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
`ma-entities.js`, `ma-ops.js`, other `ma-*.js` (except `ma-search.js`); `docs/`, `generate-docs.mjs`; Workers, wrangler, D1; storage; new fonts/CDNs; removing or changing any market/news card's content or id (HOME-05); `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; layout A cannot place the card after the banner on phones without duplicating ids or changing market cards (stop, report options); existing suites failing; push rejected.

## Success conditions
Card with the exact wording; company search per §2.5; phone width per §2.6 (`scrollWidth === 375`); DELAYED / Sector ETFs (UD-6); H-1–H-10 pass (H-1 against the Task wording); market and news unchanged; one commit pushed; report with screenshots' observations and the example's live numbers; `end`. Nothing released.
