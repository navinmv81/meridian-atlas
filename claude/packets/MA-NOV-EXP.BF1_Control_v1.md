# MA-NOV-EXP.BF1 — gate3 v2 back-fill: SQL, dry-run counts, and the first write day (W5 + W6, day 1) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Data-Identity Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification (counts vs dry run, coverage rows, write totals)
APPROVED BY:  Founder — D4 (NML-1111-5: back-fill 2026-04..08 in November, ≤ 50k row-writes/day, Tue/Thu only); this packet's Start Approval is the **production write approval for one day (Thu 19 Nov, UTC)** within that budget
PACKET:       MA-NOV-EXP.BF1 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## What it does
Spec §5.4 (`claude/specs/MA-NOV-EXP_Spec.md`, pinned): gate3 v2 as SQL files (one per month parameter), using the **§3.2 identity rule** (`instrument_entity_map` + `entity_merge_redirect`, **no** `entity_isin_map`), `INSERT OR IGNORE` into `entity_exposure_monthly` and `fund_exposure_coverage` (Entities-domain tables), every row stamped `computed_at = '<run token>'`. Reads `fund_holdings_monthly` / `fund_snapshot_monthly` (ETF domain) read-only. Dry-run counts for all five months 2026-04 … 2026-08, then writes as many whole months **today** as fit in ≤ 50,000 row-writes (D1 `meta.rows_written`, incl. index writes). The rest go to a later Tue/Thu packet reusing the same committed SQL.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `79822d5` = origin). Writable (checked by `end`): `App/Corporate Atlas/gate3v2/`, `claude/packets/MA-NOV-EXP.BF1_Report.md`. `allow_commits: true`; may push `November-2026`. D1 commands run from the repo root with `--remote`, no `-c` (OAuth).

## Allowed actions
Write the SQL files and a README in `App/Corporate Atlas/gate3v2/`; read migrations/schema; read-only D1 statements (plan checks; `SELECT COUNT(*) FROM (<the INSERT's SELECT>)` per month; verification counts; ≤ 300,000 rows read in total); **write statements:** the gate3 v2 `INSERT OR IGNORE … SELECT` files for whole months, in order 2026-04, 05, 06, 07, 08, only while the running total of `rows_written` today stays ≤ 50,000 (estimate the next month from its dry-run count × the multiplier measured on the first month; do not start a month that would pass the limit); the prepared rollback (`DELETE … WHERE computed_at = '<run token>'`) **only** if a month's verification fails; `git add -- <explicit paths>`; one commit (SQL + README) before the first write; push; write the report.

## Prohibited actions
Any write to ETF-domain tables; any table other than `entity_exposure_monthly` / `fund_exposure_coverage`; DDL, `PRAGMA` writes; `UPDATE`; touching months ≤ 2026-03 (re-compute is December, D5); running `gate3-exposure.js` (v1); writes on any day other than today (UTC Thursday); Worker code or deploys; LaunchAgents, cron; `.env*`, printing tokens; `docs/`, `App/` files outside `gate3v2/`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; today is not Thursday in UTC, or it is after 23:00 UTC when the first write would start; a plan showing a SCAN of `fund_holdings_monthly` / `entity_master`; a dry-run count for a month > 60,000 rows (report, do not write it); the first month's multiplier makes even one month exceed 50,000 row-writes (report, no further writes); verification mismatch after a month (run the rollback for that run token, stop); code 10000 twice on one statement; any permission prompt.

## Success conditions
SQL committed and pushed; dry-run counts for all five months; zero or more whole months written within ≤ 50,000 row-writes, each verified (rows = dry-run count; coverage rows = holders; no duplicate keys; months ≤ 2026-03 untouched); the run token recorded; report with what remains for the next Tue/Thu; `end`.
