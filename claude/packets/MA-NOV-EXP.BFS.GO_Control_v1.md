# MA-NOV-EXP.BFS.GO — Back-fill job: read limit, Ops rows (paused), deploy — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Operations Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; BFS.CHECK (paused 06:00 run) before the switch-on (FR13)
APPROVED BY:  Founder — this packet's Start Approval covers (A) one constant change, (B) the Ops control-plane rows, (C) the production deploy of `meridian-entities-enrich`. It does **not** switch the job on
PACKET:       MA-NOV-EXP.BFS.GO · Control v1 · usage class small · write owner Operations Lead
```

## What and why
- **A — read limit:** BFS.FIX set `EXPBF_MAX_ROWS_READ_PER_RUN = 150000`, below the change request's declared ≈ 200k per invocation; on live data that allows only 1–2 large batches per run and pushes the finish towards late December. Set it to **300,000** (≤ 3 batches as designed; 6% of the 5M/day read cap). Nothing else changes in code.
- **B — Ops rows**, from `claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md` §5 (pinned): the **pause row first**, then the registry row (cap 40,000 in `write_budget_profile`), then the `pause_added` and `registry_updated` case events, in **one** reviewed SQL file per the 003 procedure. The job stays OFF.
- **C — deploy** `meridian-entities-enrich` from the pushed commit, with version capture and rollback ready.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `76d8283` = origin). Every wrangler command for the Worker carries `-c "App/Corporate Atlas/wrangler-entities-enrich.toml"`; D1 commands run from the repo root with `--remote`, no `-c`. Writable (checked by `end`): `App/Corporate Atlas/src/exp-backfill.js` (the one constant), `App/Corporate Atlas/tests/` (its boundary test), `App/Ops/migrations/registry-load-2026-11-20-expbf.sql` (new), `claude/packets/MA-NOV-EXP.BFS.GO_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Part A: edit the constant + test; run suites; dry-run build. Part B: write the SQL file (columns from `App/Ops/migrations/002-ops-control-plane.sql` and `003-ops-job-pause.sql`); commit A + B in one commit and push **before** executing B; execute it once with `npx wrangler d1 execute meridian-etf --remote --file …`; verify with ≤ 4 read-only SELECTs. Part C: `whoami`; `deployments list -c …` (capture); one read-only `EXPLAIN QUERY PLAN` of the pinned candidates SQL (D2); **one** `npx wrangler deploy -c …`; `deployments list` again; `wrangler triggers`/deploy output to confirm crons unchanged; `npx wrangler rollback <captured> -c … -m "<reason>"` only on a trigger; write the report.

## Prohibited actions
Ending or editing the pause row (that is the switch-on, FR13); any other Ops row or table; D1 writes beyond the one SQL file; any other code change; toml/cron/secret changes; other Workers; `docs/`; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; git rewriting.

## Stop gates and rollback triggers
**Stop before B:** tests failing; push rejected. **Stop before C:** the pause row or registry row not present after B; the pause row's `ends_at` not in the future; previous version not captured; D2 plan shows a SCAN of a large table. **After C — roll back immediately:** deploy reports errors; crons or bindings differ from before; the deployed version is not from HEAD.

## Success conditions
Constant changed with test; SQL file committed and executed; both rows and both case events present, pause open; deployed with previous and new version ids recorded; crons unchanged; job still OFF; report with the BFS.CHECK instructions for the next 06:00 run (Tue–Sat) and the exact switch-on SQL for FR13; `end`.
