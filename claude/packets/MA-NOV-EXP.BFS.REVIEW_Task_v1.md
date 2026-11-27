# MA-NOV-EXP.BFS.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Architect + Tech Ops — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md` | `20fbc06022f3b38d6ddf4c251ca5308066544ddd9f0ac8bef612c117da322049` |
| `claude/specs/MA-NOV-EXP_BF_Change_Request.md` | `adfc87b16a9115f9d1e931518c407a09d18be2f676649411aa6d26c99920c911` |
| `claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md` | `d48b45b391beeee2658136bb60b8cbbba91cb9c84c687ed2234f75a4c08631f0` |

## Checks
1. **Scope:** `git show --stat 9316644` — only `exp-backfill.js` (new), the `entities-enrich.js` wiring (+ D1's `out` parameter) and tests; no toml/cron change.
2. **Safety first:** with no registry/pause/profile rows the job **never writes** (`not_enabled`); an open pause row, `hold_all_jobs`, Sun/Mon, analytics null → no write; prove each with a test or a temp-copy experiment.
3. **Isolation:** a back-fill exception never changes Phase 1's outcome or heartbeat; `/run` never calls it; Phase 2/3 untouched. Run the existing enrich suites.
4. **Correctness:** identity rule identical to BF1/R-EXP1 (map + redirect, no `entity_isin_map`); `INSERT OR IGNORE` only; batches never mix months; ≤ 12k holdings (single fund ≤ 18k alone); pre-count then one `batch()` transaction; coverage-exclusion so done holder-months are never re-computed; months ≤ 2026-03 never selected; run token format.
5. **Budget:** B = min(cap, 60,000 − U); a batch never starts if its projection exceeds the remaining B; overrun detection; cap default 40,000 when the profile row is absent; arithmetic per weekday against the 100k shared cap.
6. **Workers Free limits:** D1 calls and subrequests per invocation (≤ 5 fetches as designed), CPU (no per-row JS), wall time with Phase 1.
7. **D2 live:** `EXPLAIN QUERY PLAN` of the committed candidates statement — expect `SEARCH … USING COVERING INDEX idx_holdings_status_series_month`, no SCAN of a large table. One candidates `SELECT` for 2026-08 to confirm the incomplete MBB month costs a few rows.
8. **D1, D3:** judge each.
9. **BFS.OPS rows:** pause row before or with the registry row; profile row; exact SQL safe and reversible.
10. **ETF Product Lead acknowledgement:** read-only dependency on `fund_holdings_monthly`, `fund_snapshot_monthly`, `fund_entity_link`, and now a **hard** dependency (`INDEXED BY`) on `idx_holdings_status_series_month` — consequence if renamed (job fails closed).
11. **Data-Identity Lead sign-off:** heartbeat job id and metric keys; tokens; rollback by token.

## Report — `claude/packets/MA-NOV-EXP.BFS.REVIEW_Report.md`
Four-line header; verdict; findings table (id · B/M/N · item · evidence · fix); sign-off sections (ETF PL, Data-Identity, Tech Ops three-point check confirmation); **recommendation: may BFS.OPS + BFS.DEPLOY proceed (yes / yes with conditions / no)**; queries run (rows_read); your session id; under ~900 words. Then `end` and stop.
