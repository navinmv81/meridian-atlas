# MA-NOV-UI.POLISH — Exposure screen release polish (+ desktop header search width) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Combined independent review of OPS + HOME + POLISH, then Founder UAT
APPROVED BY:  Founder — UI spec approved incl. UD-1 (the §3 wording) (NML-1121-4); Start Approval required
PACKET:       MA-NOV-UI.POLISH · Control v1 · usage class small · write owner Engineering Lead
```

## Scope
`claude/specs/MA-NOV-UI_Spec.md` (pinned) **§3.1–3.3 exactly** (Gaps panel → "What we couldn't analyse", chips, badges, row statuses, overlap note, `.exp-dim` → `--muted`), and **N-7 only if** the picker's already-loaded ETF list gives the counts. Plus one item from the HOME build report (deviation 6, pinned): on desktop (> 900 px) the header ticker search is only **40 px** wide — give it a usable width (≥ 180 px) **without** pushing the header tiles off-screen at 1280 px; CSS only.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `210c957` = origin). Writable (checked by `end`): `App/ma-entities.js` (EXP section only), `App/index.html` (**header search CSS only**), `App/Corporate Atlas/tests/exp-ui.test.mjs`, `App/Corporate Atlas/tests/home-entry.test.mjs`, `claude/packets/MA-NOV-UI.POLISH_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests; local static preview against the live read-only APIs (≤ 4 look-throughs); screenshots to the scratchpad; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Calculation or data changes; any EXP text not listed in §3; other `index.html` changes; other files; `docs/`; Workers, D1; storage; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a §3 string that cannot be applied as written (report the conflict); tests failing; push rejected.

## Success conditions
Every §3 string applied verbatim and tested; `.exp-dim` contrast ≥ 4.5:1; header search ≥ 180 px at 1280 px with every header tile still visible; N-7 done or left with reason; suites green; one commit pushed; report with before/after for the Gaps panel and the header at 1280; `end`.
