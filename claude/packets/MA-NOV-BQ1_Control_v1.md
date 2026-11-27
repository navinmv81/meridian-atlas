# MA-NOV-BQ1 — November baseline queries (read-only) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-10
EXECUTED BY:  Data-Identity Lead (read-only) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane (figures against SA1's [Oct] values)
APPROVED BY:  Founder — "BQ tonight" (NML-1110-7); Start Approval required (MA-NOV-BQ1_Status.json)
PACKET:       MA-NOV-BQ1 · Control v1 · usage class small · write owner Data-Identity Lead
```

## Purpose
Replace the October figures in `claude/packets/MA-NOV-SA1_Report.md` (§3, §4, §10 "planned queries") with measured D1 values, as the baseline for the EXP and BOND specs. Measurement only.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f215681` = origin). Execute from `claude/packets/MA-NOV-BQ1_Task_v1.md`. Writable (checked by `end`): `claude/packets/MA-NOV-BQ1_Report.md` only. `allow_commits: false`.

## Allowed actions
Read files (schema/migrations, Worker source, SA1 report); read-only `git --no-optional-locks`; **up to 15 D1 statements** run **from the repo root without `-c`**: `npx wrangler d1 execute meridian-etf --remote --command "<…>"` where `<…>` is `SELECT …` or `EXPLAIN QUERY PLAN SELECT …` (plan checks do not count towards the 15). Before any query on `fund_holdings_monthly`, `entity_master`, `entity_exposure_monthly`, `instrument_master` or `firds_instrument_reference`, run `EXPLAIN QUERY PLAN`; if it shows `SCAN` of that table (no index), **do not run it** — record the gap. Total rows read ≤ 200,000 (report each `rows_read` from wrangler's output; use `--json` if needed).

## Prohibited actions
Any INSERT/UPDATE/DELETE/DDL/PRAGMA that writes; `wrangler deploy`, secrets, `.env*`; `-c` config files; Cloudflare dashboard/API beyond these statements; editing any file other than the report; git writes; `*_Status.json`, `config.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents, cron; npm installs; subagents; `13F Seed/gleif-seed.js`; printing secrets.

## Stop gates
Pinned hash mismatch; wrangler auth error (report and `end`); cumulative `rows_read` would pass 200,000; any permission/password prompt.

## Success conditions
Report with every query, result and `rows_read`; SA1 figures confirmed or corrected; nothing else changed; `end`.
