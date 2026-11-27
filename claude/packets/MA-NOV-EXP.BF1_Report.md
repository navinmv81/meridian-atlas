# MA-NOV-EXP.BF1 — Report

```text
PACKET:     MA-NOV-EXP.BF1 · Control v1 (128c4534…6a48) · Task v1 (8256b4c7…2343) — hashes verified
RUN:        r-20261119T214753Z-2a33 (interactive, LANE_OPENER_v2)
COMMIT:     4cdd22e "MA-NOV-EXP.BF1: gate3 v2 back-fill SQL (identity rule §3.2)" — pushed, ls-remote = 4cdd22e
RUN TOKEN:  g3v2-20261119 (no row carries it: nothing was written)
OUTCOME:    PARTIAL — SQL committed and pushed. 0 months written. Stop gate: 2026-04 alone needs ≈ 148k row-writes
            (cap 50k) and months must go in order. Boundary breach: read-only reads ≈ 363k against the 300k cap (§7).
DAY CHECK:  Thu 19 Nov 2026, 21:48Z at start (Thursday, before 23:00Z) — passed.
```

## 1 SQL design
- **Files** (`App/Corporate Atlas/gate3v2/`):
  - `gate3v2-month.sql.tmpl`: 2 statements, `INSERT OR IGNORE … SELECT` into `entity_exposure_monthly`, then into `fund_exposure_coverage`.
  - `gate3v2-dryrun.sql.tmpl`: read-only, one pass.
  - `gen.mjs`: substitutes `__MONTH__` and `__TOKEN__` only, and refuses months ≤ 2026-03.
  - The generated `gate3v2-2026-04…08.sql` and `.dryrun.sql` files.
  - `README.md`: how to run, the budget rule, rollback, Tue/Thu only.
- **Identity rule (§3.2):** key = ISIN(12) → `CUSIP:` (≥ 6, not `000000000`) → `TICKER:`, then the `instrument_entity_map` PK, then `entity_merge_redirect` for two hops. A row still on a duplicate after a third hop is not mapped. The CASE and joins are copied from R-EXP1 (`src/entities-api.js` `EXP_SQL`), so EXP and the company page agree. `entity_isin_map` is not used.
- **Holder:** `fund_entity_link.entity_id` by `series_id`. Checked live: 248 series, 248 distinct (series, entity) pairs, so there is no fan-out.
- **Columns:** these follow v1.
  - `weight_sum` = `COALESCE(SUM(weight_pct), 0)` per (entity, holder). The COALESCE stops an all-NULL group from being dropped silently by NOT NULL + OR IGNORE.
  - `aum_weighted` is NULL.
  - Coverage `total_weight` covers all of the fund's complete holdings; `mapped_weight` covers only the mapped ones.
  - `computed_at` = the run token.
- **Idempotency:** `INSERT OR IGNORE` on the PKs. A local fixture (in-memory SQLite, live schema) gave the expected values for a redirect hop, an unresolved third hop, `000000000`, a lower-case ticker and an unlinked fund. Re-running inserted 0 rows.

## 2 Plans (EXPLAIN QUERY PLAN, live, 2026-04 files)
- All 3 statements read `fund_holdings_monthly` with `SEARCH f USING INDEX idx_holdings_month (report_month=?)`.
- Lookups: `fel` uses an automatic covering index plus a bloom filter. `instrument_entity_map` is a PK SEARCH. rd1–rd3 are INTEGER PK SEARCHes. GROUP BY uses a temp B-tree.
- The only SCAN is `fund_entity_link` (264 rows). There is no SCAN of `fund_holdings_monthly`, and `entity_master` is not read at all. **The gate passed.**

## 3 Dry-run counts
| Month | Funds (snapshot) | Stored holdings | Holdings rows joined | Exposure rows | Coverage rows (= holders) | Existing exp / cov | Rows read |
|---|---|---|---|---|---|---|---|
| 2026-04 | 70 | 67,387 | 67,387 | **36,951** | 70 | 0 / 0 | 291,384 |
| 2026-05 | 56 | 74,823 | — | not run (read cap) | — | — | est. ≈ 320k |
| 2026-06 | 51 | 39,427 | — | not run (read cap) | — | — | est. ≈ 170k |
| 2026-07 | 25 | 16,059 | 8,679 | **4,581** | 24 | 0 / 0 | 40,744 |
| 2026-08 | 10 | 25,260 | — | not run (read cap) | — | — | est. ≈ 110k |

- "Funds" and "stored holdings" come from `fund_snapshot_monthly` (1,661 rows read). In 2026-07, 1 fund and about 7.4k holding rows are not `complete`, so they drop out.
- Months ≤ 2026-03, before any write: 2026-01 8,892, 2026-02 6,215 and 2026-03 9,680 exposure rows, 42 coverage rows in 2026-03. The full table is 28,506 rows, all computed 2026-06-14. Nothing was written, so these are unchanged.
- No dry-run count was above 60,000.

## 4 Writes
| Month | Inserted | rows_written | Multiplier | ms | Verified |
|---|---|---|---|---|---|
| — | 0 | 0 | — | — | n/a |

- **Why no write:**
  - The 2026-04 estimate is 36,951 × 4 + 70 × 2 ≈ **147,944 row-writes**.
  - The multiplier of 4 is the table row plus the PK autoindex, `idx_exposure_entity` and `idx_exposure_holder`. D1 counts index writes (spec §5.4).
  - Even a multiplier of 2 would be 74k, which is still over 50k.
  - The Control rules: "do not start a month that would pass the limit", and months go in order (04 first). Under those rules, 2026-07 (≈ 18.4k) could not be written ahead of 2026-04.
- **Why the spec estimate was low:** spec §5.4 assumed ≈ 242 rows per fund-month. 2026-04 measures 528 per fund-month, and 2026-07 measures 191.

## 5 What remains (for Main Lane / Founder before Tue 24 Nov)
- **All five months.** One decision is needed first, because with the current rule (whole months, ≤ 50k/day) 2026-04 can never be written:
  - (a) Approve a one-day budget of about 150k for 2026-04. That is **over** the shared free-tier write cap of 100k/day (a soft cap, but CLAUDE.md says to respect it), so (a) is not viable.
  - (b) Split a month into holder batches. That needs a third template parameter, a holder range, and a packet to add it. A batch of about 18 funds is about 9.5k rows, or about 38k row-writes.
  - (c) Allow months out of order. 2026-07 fits now (≈ 18.4k). 05, 06 and 08 are unknown until their dry runs.
  - **(b) is the only one that also covers 2026-04 and 2026-05.**
- **Dry runs still owed:** 2026-05, 06 and 08, at about 600k reads combined. Running them needs a read allowance per day of about 350k, or one month per day.
- **The committed SQL can be reused unchanged:** regenerate with the day's token (`node gen.mjs g3v2-YYYYMMDD <months>`).

## 6 Rollback (prepared; not needed — 0 rows carry the token)
```sql
DELETE FROM entity_exposure_monthly WHERE report_month = '<m>' AND computed_at = 'g3v2-20261119';
DELETE FROM fund_exposure_coverage  WHERE report_month = '<m>' AND computed_at = 'g3v2-20261119';
```

## 7 Boundaries kept, and one breach
- **Kept:**
  - 0 rows written in total.
  - No ETF-domain writes, no DDL, no PRAGMA, no UPDATE.
  - Months ≤ 2026-03 untouched. `gate3-exposure.js` was read but not run.
  - No Worker deploys, crons or LaunchAgents. No `.env` files read, no tokens printed.
  - Writes only under `gate3v2/` and to this report.
  - One commit, pushed. No subagents, no installs, no permission prompts.
- **BREACH: read cap.**
  - Read-only statements read about **362.7k rows** against the Control's ≤ 300,000:
    - existing-month counts: 28,506 + 133 + 264
    - schema: 164
    - snapshot sizing: 1,661
    - 2026-07 dry run: 40,744
    - 2026-04 dry run: 291,384
  - Cause: I estimated 2026-04 at about 171k from 2026-07's ratio of 2.5 reads per stored holding. The real ratio was 4.3, because every 2026-04 holding is complete and linked (2026-07 has many that are not).
  - After the overrun, I ran no further read statements, which is why there are no 05, 06 or 08 dry runs. The day's D1 total is still far below the 5M/day free-tier read cap.
