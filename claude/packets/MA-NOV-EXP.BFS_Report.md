# MA-NOV-EXP.BFS — Report

```text
PACKET:     MA-NOV-EXP.BFS · Control v1 (53adebd8…6890) · Task v1 (c67da26f…194f) — hashes verified
PINS:       MA-NOV-EXP_Spec.md 785df4d5…fc3e · MA-NOV-EXP.BF1_Report.md 1f209939…1263 · MA-OCT-000_Job_Manifest.md f56ba53e…dafc — all match
RUN:        r-20261120T082507Z-e116 (interactive, LANE_OPENER_v2) · HEAD 4cdd22e = origin/November-2026
OUTCOME:    DONE. Design only: addendum, change request and three-point check written. 0 rows written, no code, no deploy.
FILES:      claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md · claude/specs/MA-NOV-EXP_BF_Change_Request.md · this report
STOP GATES: none hit. No new cron slot, no new table, no cross-domain write, no non-Cloudflare scheduler needed.
```

## 1 Summary

- **Where it runs.** The back-fill runs in the **06:00 UTC** firing of `meridian-entities-enrich`, after Phase 1, with its own heartbeat (`cf.meridian-entities-enrich.expbf`). It runs Tue–Sat only.
- **What a run does:**
  1. Picks holder-months from 2026-04 onward that have complete holdings and no coverage row.
  2. Packs them into batches of ≤ 12,000 holdings. A single fund of up to 18,000 holdings goes alone.
  3. Counts each batch exactly.
  4. Writes the batch in one D1 transaction, inside a daily budget of min(40,000, 60,000 − U), where U is the account's analytics total at 06:00.
- **Afterwards** the same code is the recurring refresh. No new cron, no new table, and the only writes are to the two Entities tables.
- **Key measurement.** Driving the join from the holders (`CROSS JOIN`) uses `idx_holdings_status_series_month`, and reads **2.69 rows per holding** (equity mix) and **1.12** (bond fund). BF1's month-wide plan read 4.3. With this plan, every single fund fits under 50k reads per statement, including BND at 17,409 holdings.
- **Estimate.** The back-fill is ≈ 300k–430k row-writes over ≈ 25 batches.
  - With a deploy on Wed 25 Nov and the first run on Thu 26: **2026-04 is complete ≈ Tue 1 Dec**, and the **whole back-fill ≈ Tue 8 – Fri 11 Dec** [E].
  - It is ≈ 2.5 packet-days of work (build, review, Ops records, deploy and first-run check).

**Decisions for the Founder:**
1. **Approve the addendum and the change request together:** a scheduled job in `meridian-entities-enrich` at 06:00, which also replaces spec §5.4's manual runs and D5's "in `meridian-holdings`, December". **Recommend: approve.**
2. **On/off without a deploy.**
   - Options: (A) the existing Ops `ops_job_pause` row for the job; (B) a key in `holdings_pipeline_state`, an ETF-domain table, so it needs the ETF Product Lead's agreement; (C) a toml var, which needs a deploy to change.
   - **Recommend A.** It is Ops-owned and the Tower already shows it. `hold_all_jobs` still stops everything.
3. **Daily cap for this job.**
   - Options: 40,000, or the 50,000 D4 ceiling. 50,000 brings April to ≈ Sat 28 Nov, before the Mon 30 demo, and the whole back-fill to ≈ Fri 4 – Wed 9 Dec.
   - **Recommend 40,000 for the first two run days, then 50,000** if the measured multiplier and weekday totals confirm it. Both can be changed in `write_budget_profile` with no deploy.
4. **If the analytics total is unavailable at 06:00, skip the day (fail closed)** rather than trust the weekday-blind counter. **Recommend: yes.**
5. **Skip days Sun and Mon. Wednesday is a run day in November** (C1 moved to December), and C1's change request must add Wednesday. **Recommend: yes.**
6. **Ship OFF:** the pause row goes in before the deploy and is ended after the deploy checks, on the Founder's word. **Recommend: yes.**
7. **Leave re-computing already-written holder-months out**, including months ≤ 2026-03 and re-ingested months (December, by token). **Recommend: yes.**

## 2 Measurements

There were 8 read-only statements, run from the repo root with no `-c`, all with `rows_written` 0.

| # | Statement | Rows read | Result |
|---|---|---|---|
| 1 | `sqlite_master` tables and indexes for 7 tables | 164 | Indexes present: `idx_holdings_status_series_month`, `idx_holdings_series_month`, `idx_exposure_entity`, `idx_exposure_holder`, the coverage PK `(report_month, holder_entity_id)`, `idx_ops_job_pause_job_end`, the `holdings_pipeline_state` PK |
| 2 | Same statement again (**my error**: re-run only to reformat the output) | 164 | — |
| 3 | Sizing: `fund_snapshot_monthly` ⋈ `fund_entity_link` ⟕ `fund_exposure_coverage`, 2026-04..08 | 935 | 212 holder-months (70 / 56 / 51 / 25 / 10); 0 done. Largest: BND 06 17,409; AGG 05 13,269; MBB 08 11,211; MBB 05 11,146; VXUS 04 8,878 |
| 4 | `EXPLAIN QUERY PLAN` of the batched exposure INSERT (2026-04, holders 36..77) | 0 | See §2.1 |
| 5 | Batch count, 2026-04, holders 36..77 | **9,639** | 3,579 holdings, 2,893 mapped, **2,426 exposure rows**, 10 coverage rows; 104 ms; projected **9,724 row-writes** |
| 6 | Batch count, 2026-08, holder 138 (MBB) | 264 | **0 complete holdings**: the snapshot exists but the holdings are not complete, so they are not selected (addendum test B7) |
| 7 | Batch count, 2026-05, holder 146 (MUB) | **7,437** | 6,654 holdings, 259 mapped, 21 exposure rows; 24 ms |
| 8 | Controls and state (scalar subqueries) | 44 | `hold_all_jobs` = false (since 2026-08-02); `writes_today` Sun 80,225 / 80,361 / 80,770, Mon 32,759 / 34,116 / 36,974 / 34,067, Sun 25 Oct 1,728; `ops_job_pause` 2 rows, none open; Phase 1 success with 100 attempted (max), 13 runs ≥ 25 attempted, 0 failed or killed; registry has `.phase1` and `.phase23` only |

**Total rows read: 18,647**, against a cap of 120,000. Each statement was projected before it ran, and the largest projection was ≤ 29k (MUB at 4.3 reads per holding).

### 2.1 Plan (statement 4)
```text
CO-ROUTINE fel · SCAN fund_entity_link · USE TEMP B-TREE FOR DISTINCT
SCAN fel
SEARCH f USING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)
SEARCH m USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN
SEARCH rd1 / rd2 / rd3 USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN
USE TEMP B-TREE FOR GROUP BY
```

### 2.2 Measured batch SQL (the BF1 CTE with two changes)
```sql
WITH fel AS (SELECT DISTINCT series_id, entity_id FROM fund_entity_link
             WHERE series_id IS NOT NULL AND entity_id BETWEEN 36 AND 77),
h AS (SELECT fel.entity_id holder, f.weight_pct w, <BF1 key CASE> k
      FROM fel CROSS JOIN fund_holdings_monthly f
      WHERE f.snapshot_status = 'complete' AND f.series_id = fel.series_id AND f.report_month = '2026-04'),
j AS (<BF1 map + 3 redirect joins, unchanged>)
SELECT COUNT(DISTINCT CASE WHEN eid IS NOT NULL THEN eid || '|' || holder END) exposure_rows,
       COUNT(DISTINCT holder) coverage_rows, COUNT(*) holdings_rows, SUM(eid IS NOT NULL) mapped_rows FROM j;
```
The build adds `AND entity_id NOT IN (SELECT holder_entity_id FROM fund_exposure_coverage WHERE report_month = ?)` and binds parameters. It then plan-checks again (test B10).

### 2.3 Projected writes
- **Measured batch:** 2,426 × 4 + 10 × 2 = 9,724 row-writes. Multiplier 4 is the table, the PK and the 2 indexes, as in BF1; it is not measured yet.
- **Whole back-fill:**
  - 2026-04: 36,951 rows [BF1]
  - 2026-05: 22k–41k [E]
  - 2026-06: 7k–15k [E]
  - 2026-07: 4,581 [BF1]
  - 2026-08: 4k–9.5k [E]
  - Total ≈ 75k–107k rows, so **≈ 300k–430k row-writes**.

## 3 Build / review / deploy plan

| Packet | Content | Size | Founder checkpoint |
|---|---|---|---|
| BFS.BUILD | `App/Corporate Atlas/src/exp-backfill.js` + `scheduled()` wiring + tests B1–B9 + live plan check B10 (read-only) | M 1.0 | approve the Control |
| BFS.REVIEW | Architect + Tech Ops; ETF PL acknowledges the read dependency; Data-Identity Lead signs off the heartbeat keys | S 0.5 | — |
| BFS.OPS | Operations Lead: registry row, `write_budget_profile`, open pause row (OFF) | S 0.25 | — |
| BFS.DEPLOY | Version capture, deploy with `-c`, tail of the next 06:00 Phase 1 path, rollback ready; then end the pause row | S 0.5 | deploy approval; switch-on |
| BFS.CHECK | L1–L3 the morning after the first run; L4–L5 once April is done | S 0.25 | — |

Total **≈ 2.5 packet-days**. The target deploy is **Wed 25 Nov** if the build runs Sat 21 or Tue 24 and the review the next day. The first run is Thu 26 Nov 06:00Z.

## 4 Boundaries kept
- **D1:** 8 read-only statements, **18,647 rows read** (cap 120,000), 0 rows written. No DDL, PRAGMA, UPDATE or DELETE.
- **Disclosure:** statement 2 repeated statement 1 to reformat its output. That wasted 1 of the 8 statements and 164 rows. It is within the caps, and noted.
- **No changes outside the design:**
  - No deploys, and no edits to code, tomls, crons, `docs/`, secrets or `.env*`.
  - No git writes, no LaunchAgents, no installs, no subagents.
  - No HTTP calls to Workers. The analytics endpoint was read only in code, not called.
  - `13F Seed/gleif-seed.js` was not touched.
- **Writes:** only the three allowed files. No Status, board, Tower, `transitions.jsonl` or log files were edited.
- **Skills:** `/change-request` was used for the CR. `/write-spec` was not invoked; the addendum follows the Task's 8-section structure.
