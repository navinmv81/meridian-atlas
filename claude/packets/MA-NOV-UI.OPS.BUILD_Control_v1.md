# MA-NOV-UI.OPS.BUILD — Ops console cleanup (OPS-01–06) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  UI.OPS.REVIEW (independent), then Founder UAT via the preview harness; live at the November release
APPROVED BY:  Founder — UI spec approved with UD-1–UD-7, UD-9 as recommended and UD-8 replaced by home layout A (NML-1121-4); "start the Ops build today" (NML-1121-2); Start Approval required
PACKET:       MA-NOV-UI.OPS.BUILD · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
`claude/specs/MA-NOV-UI_Spec.md` (approved; pinned) §1.1–1.9, §5.1 (O-1–O-10, O-V), §6 UI.OPS.BUILD; decisions UD-2 (drop "Deployment Drift" panel), UD-3 (public Ops GET routes unchanged in November), UD-4 (remove static "Worker Status" table and `CHECK_DASHBOARD` placeholder), UD-5 (system-font fallback; no CSP deploy).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `bc1d079` = origin). Writable (checked by `end`): `App/ma-ops.js`, `App/Ops/tests/ops-a.test.mjs`, `App/Ops/tests/ops-console.test.mjs`, `App/Ops/tests/preview/`, `claude/packets/MA-NOV-UI.OPS.BUILD_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests (all `App/Ops/tests/` and `App/ETF Refresh/tests/ops-health.test.mjs`); a local static preview of the harness (fixtures only — **no requests to the live Ops API**); screenshots at 1280 / 800 / 375 to the scratchpad; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Deleting or changing any Ops route, Worker, table, row or history (OPS-05); `App/Ops/src/` and Worker deploys; `index.html` and other `ma-*.js`; `docs/`, `generate-docs.mjs`; requests to live Ops endpoints; D1; secrets, `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs, CDNs, new fonts; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a change that would need an Ops Worker/CSP deploy or a route change (stop, report); an existing Cases/DQ/Health check failing after bounded fixes; push rejected.

## Success conditions
O-1–O-10 green; existing Ops suites green (or each changed expectation listed as a deviation with reason); harness renders all four tabs and the §1.6 states at 1280/800/375; one commit pushed; report with screenshots' observations and a short Founder UAT checklist for the harness; `end`. Nothing released.
