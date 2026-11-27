# MA-NOV-EXP.BFS.FIX — Back-fill review fixes M1 (per-run limits) and M2 (overrun) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Engineering Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification against BFS.REVIEW M1/M2 (small, targeted change; the reviewer's own experiments become tests)
APPROVED BY:  Founder — Start Approval required. No deploy (BFS.GO follows)
PACKET:       MA-NOV-EXP.BFS.FIX · Control v1 · usage class small · write owner Engineering Lead
```

## Scope
`claude/packets/MA-NOV-EXP.BFS.REVIEW_Report.md` (PASS_WITH_NOTES; pinned):
- **M1:** enforce the CR's per-invocation budget in code — at most **3 batches**, **12 D1 calls** and **150,000 rows read** per run (constants, named, documented), stop cleanly (`partial`, reason `run_limit`) when the next batch would pass any of them.
- **M2:** treat `written > left` (before subtracting) as `EXPBF_BUDGET_OVERRUN` → stop with `failed`, so the hard ceiling holds whatever the projection.
Nothing else.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `9316644` = origin). Writable (checked by `end`): `App/Corporate Atlas/src/exp-backfill.js`, `App/Corporate Atlas/tests/` (exp-backfill files), `claude/packets/MA-NOV-EXP.BFS.FIX_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests; all Corporate Atlas suites; dry-run build of `wrangler-entities-enrich.toml`; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
`entities-enrich.js` or any other file; deploys; D1 statements; Ops rows; toml/cron/secret changes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; tests failing after bounded fixes; push rejected.

## Success conditions
M1 and M2 fixed with tests (incl. the reviewer's 60-fund synthetic case: ≤ 3 batches and ≤ 12 D1 calls; and the 1.24× multiplier case: `failed` with `EXPBF_BUDGET_OVERRUN`); all suites green; one commit pushed; report; `end`.
