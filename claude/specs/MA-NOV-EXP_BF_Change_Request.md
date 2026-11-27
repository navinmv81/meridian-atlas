## Change Request: scheduled exposure back-fill and refresh in `meridian-entities-enrich` (MA-NOV-EXP.BF)

**Requester:** Entities Product Lead (with the Architect and Tech Ops) · packet MA-NOV-EXP.BFS, run r-20261120T082507Z-e116 | **Date:** Fri 20 Nov 2026 | **Priority:** Medium
**Status:** Draft. It needs Founder approval together with `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md` (design). The deploy itself needs a separate Founder approval.

Measured figures **[M]** come from the BFS report §2. **[BF1]** marks figures from the BF1 report. **[E]** marks estimates.

### Description
- **What changes:** the 06:00 UTC firing of `meridian-entities-enrich` gets a second task after Phase 1, the gate3 v2 exposure back-fill (addendum §2–§3).
- **What it does each run day (Tue–Sat):**
  1. Selects holder-months from 2026-04 on that have complete holdings and no coverage row.
  2. Packs them into batches of up to 12,000 holdings (a single fund of up to 18,000 holdings runs alone).
  3. Counts each batch exactly before writing it.
  4. Writes each batch in one D1 transaction into `entity_exposure_monthly` and `fund_exposure_coverage`, under a daily write budget.
- **After the back-fill:** when 2026-04 … 2026-08 are done, the same code keeps the two tables current after each holdings cycle (D5).
- **Supersedes:** spec §5.4's local Tue/Thu one-off runs, and D5's "append to `meridian-holdings` in December" (NML-1120-1).

### Business Justification
- **Why the panel is stale:** the company page's ETF-holder panel reads `entity_exposure_monthly`, which stops at 2026-03 (computed 2026-06-14). The exposure screen reads holdings directly, so the two disagree.
- **Why the manual route cannot work:**
  - BF1 showed 2026-04 alone needs ≈ 148k row-writes [BF1]. That is above the 50k/day back-fill rule and the 100k/day shared cap, so whole-month manual runs can never write it.
  - The whole back-fill is ≈ 300k–430k row-writes [E], which takes 9–12 days of runs at about 40k a day.
- **What this change gives:**
  - Batching by holder makes every unit fit the budget.
  - Scheduling it inside Cloudflare keeps the work within the standing rule: recurring jobs run in Cloudflare, with no new cron slot (5/5 in use) and no LaunchAgent.
  - The same code is the recurring refresh, so the tables do not go stale again.

### Components

| Component | Change |
|---|---|
| Worker `meridian-entities-enrich` | New module `src/exp-backfill.js`, called from `scheduled()` (minute < 50 branch) after `runPhase1()`. `/run` is unchanged and does not call it |
| `wrangler-entities-enrich.toml` | **No change.** Crons stay `0 6 * * *` and `50 6 * * *`. No new var or secret |
| Tables written (Entities domain) | `entity_exposure_monthly`, `fund_exposure_coverage`: inserts only (`INSERT OR IGNORE`), months ≥ 2026-04 only |
| Tables read | `fund_entity_link`, `instrument_entity_map`, `entity_merge_redirect`, `fund_exposure_coverage` (Entities); `fund_holdings_monthly`, `fund_snapshot_monthly`, `holdings_pipeline_state` (`hold_all_jobs`) (ETF, read-only); `ops_job_pause`, `ops_job_registry` (Ops, read-only) |
| Ops records (written by the Operations Lead, not the Worker) | One `ops_job_registry` row `cf.meridian-entities-enrich.expbf`, plus one `ops_job_pause` row so the job ships OFF. This uses the 003 reviewed-batch procedure, with an `ops_case_event` |
| Schema | **None.** No new table, column or index |
| Cron | **None.** It uses the existing 06:00 trigger. Account count unchanged at 5/5 (last confirmed 2026-09-23) |
| Front end / `docs/` | None |

### Impact Analysis

| Area | Impact | Details |
|------|--------|---------|
| Users | Low | The company-page ETF-holder panel gains Apr–Aug 2026 holders, holder by holder as batches land (the W1 per-holder latest month handles partial months). The exposure screen is unaffected |
| Systems: D1 writes | Med | Tue–Sat: ≤ 40,000 row-writes/day from this job (hard ceiling 50,000), and never more than 60,000 − U, where U is the account total at 06:00. Sun and Mon: 0. Per-weekday totals are in the table below |
| Systems: D1 reads | Low | Per batch: 1 count + 2 INSERT statements. Each statement reads ≤ 2.69 × its holdings [M] ≤ 32.3k (≤ 46.8k for the BND solo batch). The candidate statement reads ≈ 1.2k [E]. Per run day ≤ ≈ 200k [E], about 4% of 5M/day |
| Systems: CPU, subrequests | Low | Adds 2 `fetch` calls (heartbeat), so the 06:00 invocation makes 5 of 50. Adds ≤ 11 D1 calls; Phase 1 has run 13 times with 100 entities (≥ 201 D1 calls) and 0 failures [M]. The SQL runs inside D1; the JS work is packing ≤ 300 rows. Expected well under 10 ms CPU [E], measured at deploy |
| Systems: other jobs | Low | Phase 1 runs first and its outcome and heartbeat are unchanged. Phase 2+3 (06:50) and boost are untouched. Their guards read the blind `writes_today` counter (KI 22.14), so they do not see this job's writes. They are small (low thousands) [E], and the day stays under ≈ 50k |
| Processes | Low | The Operations Lead registers the job and operates its on/off and cap through existing Ops records. The Tower gains one job row |
| Cost | None | Workers Free and D1 free tier; no paid feature |

**Writes per day by weekday (100k shared soft cap):**

| Day | Measured or estimated other writes | This job | Day total |
|---|---|---|---|
| Sun | holdings 80,225 / 80,361 / 80,770 (1 / 8 / 15 Nov) [M], plus FIRDS, enrich, boost | 0 (skip) | ≈ 81–85k, unchanged |
| Mon | entities-seed 32,759 / 34,116 / 36,974 / 34,067 (26 Oct, 2 / 9 / 16 Nov) [M] | 0 (skip) | ≈ 34–41k, unchanged |
| Tue–Sat | ≈ 3–8k [E]: enrich, boost, Ops ingest, bootstrap. The counter is blind on these days, so this is not measured | ≤ 40,000 | ≈ 43–48k [E] (≈ 53–58k at the 50k ceiling) |

### Three-point check (Tech Ops)

**1. Index audit with plans [M]:** `EXPLAIN QUERY PLAN` of the batched exposure INSERT (2026-04, holders 36..77):

```text
CO-ROUTINE fel · SCAN fund_entity_link · USE TEMP B-TREE FOR DISTINCT
SCAN fel
SEARCH f USING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)
SEARCH m USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN
SEARCH rd1 / rd2 / rd3 USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN
USE TEMP B-TREE FOR GROUP BY
```

- The only scans are of `fund_entity_link` (264 rows) and the CTE built from it. There is no scan of `fund_holdings_monthly`.
- Indexes relied on (all present [M]):
  - `idx_holdings_status_series_month` (ETF domain; already a registered EXP dependency);
  - `sqlite_autoindex_instrument_entity_map_1`;
  - the `entity_merge_redirect` rowid;
  - `sqlite_autoindex_fund_exposure_coverage_1` (PK `report_month, holder_entity_id`, used by the anti-join and the done check);
  - `idx_ops_job_pause_job_end`;
  - the PKs of `ops_job_registry` and `holdings_pipeline_state`.
- The candidate statement scans `fund_snapshot_monthly` (1,661 rows; no index leads with `report_month`). That is declared and bounded, to be reviewed at 10k rows.
- **Build obligation:** the build re-runs the plans on the final SQL, which adds the coverage anti-join: count, both INSERTs, the candidate statement and the control read (addendum test B10).

**2. Single-execution read test < 50k [M]:**

| Statement | Slice | Holdings | rows_read | Duration |
|---|---|---|---|---|
| Batch count (same CTE as the INSERTs) | 2026-04, holders 36..77 (10 equity and bond funds) | 3,579 | **9,639** (2.69 / holding) | 104 ms |
| Batch count | 2026-05, holder 146 (MUB, municipal bonds) | 6,654 | **7,437** (1.12 / holding) | 24 ms |
| Sizing join (candidate statement without the EXISTS clause) | 2026-04..08 | — | **935** | — |

- Worst case at H_max 12,000 and the equity ratio is ≈ 32.3k per statement. The BND solo batch (17,409) is ≤ 46.8k at the equity ratio and ≈ 19.5k at the bond ratio.
- The runtime stop at > 50,000 rows read on any statement backs this up (addendum §4).

**3. Read and write budget per invocation (to be declared in the module header):**

| Item | Value |
|---|---|
| D1 calls | ≤ 2 (control reads) + 1 (candidates) + 3 per batch, ≤ 3 batches/day → ≤ 12 |
| Rows read | per statement < 50k (hard stop); per invocation ≈ 1.2k + ≈ 3 × holdings per batch × 2.69 → ≤ ≈ 200k |
| Rows written | ≤ min(cap, 60,000 − U); cap default 40,000 from `write_budget_profile`, clamped to ≤ 50,000; actual `meta.rows_written` subtracted per batch |
| Subrequests | +2 (heartbeat); invocation total 5 |
| Measured batch | 2,426 exposure rows + 10 coverage rows → projected **9,724** row-writes (multiplier 4 from BF1, re-measured on the first live batch) |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Write multiplier is above 4, so the day exceeds its budget | L | M | The budget subtracts the real `meta.rows_written`. A batch over 1.25 × its projection stops the day (`EXPBF_BUDGET_OVERRUN`). Day 1 records the multiplier (L2) |
| Weekday baseline is higher than estimated (counter blind) | M | L | The analytics `U` at 06:00 caps the job at 60,000 − U, leaving ≥ 40k for later writers. If analytics is unavailable, the job skips the day |
| Some statement reads more than 50k (e.g. a large equity fund over 12k holdings) | L | L | Packing rules, the solo limit of 18,000 and the oversize skip; the runtime stops above 50k. Today's largest equity fund is VXUS at 8,878 |
| Back-fill error breaks Phase 1 | L | M | It runs after Phase 1 in its own try/catch with its own heartbeat; test B8 |
| Partial or incomplete fund-month computed | L | M | Only holder-months with `snapshot_status='complete'` are taken. That flag is set atomically at the end of ingestion. Rows already present are never overwritten |
| Holdings re-ingested after the coverage row is written → stale exposure | L | L | Out of scope by design (addendum §6). A December re-compute deletes by token and the job rebuilds |
| D1 per-invocation call limit is lower than assumed | L | M | ≤ 12 extra calls; Phase 1 has already succeeded with ≥ 201 [M]. The build checks the current published limit |
| Wednesday holdings run (C1, December) collides | M (Dec) | M | C1's CR must add Wednesday to the skip constant. Until then the 06:00 analytics guard sees any earlier Wednesday writes |
| Cross-domain coupling | L | L | Writes are Entities-only. ETF and Ops tables are only read, and the Ops records are written by the Operations Lead. The ETF Product Lead acknowledges the read of `fund_snapshot_monthly` and the use of `idx_holdings_status_series_month` |

### Implementation Plan

| Step | Owner | Timeline | Dependencies |
|------|-------|----------|--------------|
| 1 BFS.BUILD: `src/exp-backfill.js`, wiring in `scheduled()`, SQL generated from the gate3 v2 template, tests B1–B9, live plan check B10 (read-only). Commit and push | Entities Product Lead + Architect | Sat 21 or Tue 24 Nov · M 1.0 | This CR and the addendum approved |
| 2 BFS.REVIEW: code, SQL identity against BF1 (B2), guards, heartbeat payload | Architect (reviewer) + Tech Ops | next day · S 0.5 | Step 1 |
| 3 Ops records: register `cf.meridian-entities-enrich.expbf`, `write_budget_profile` `{"daily_rows_written_cap":40000}`, and an open `ops_job_pause` row (job OFF) | Operations Lead | before step 4 · S 0.25 (can share step 2's day) | Review PASS |
| 4 BFS.DEPLOY: record the previous version id; `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-enrich.toml"`; record the new id; `wrangler tail` sample of the next Phase 1 run (`/run` is unaffected) | Tech Ops | target **Wed 25 Nov** · S 0.5 | Founder deploy approval; step 3 |
| 5 Switch on: end the pause row (Ops procedure) | Operations Lead on Founder's word | after step 4's checks, before 06:00Z on the first run day | Step 4 |
| 6 First-run check: L1–L3 the next morning; L4–L5 when April is done; L7 at the end | Entities Product Lead | Thu 26 Nov · S 0.25; then report-only checks | Step 5 |

Total ≈ **2.5 packet-days**, or 3 Founder checkpoints: CR approval, deploy approval, switch-on.

### Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Founder | Decisions 1–7 (BFS report §1); then the deploy and switch-on asks | Control Tower and the decisions log (Main Lane) | Now; at step 4 |
| ETF Product Lead | Read-only use of `fund_holdings_monthly` / `fund_snapshot_monthly` from 06:00 Tue–Sat; do not drop `idx_holdings_status_series_month`; C1 must add Wednesday to the skip list | Review sign-off (step 2) | Step 2 |
| Operations Lead | Register the job, operate the pause and cap, handle the `EXPBF_BUDGET_OVERRUN` exception | Ops case | Step 3 |
| Data-Identity Lead | Phase 1 shares its invocation; heartbeat key set for `expbf` | Review | Step 2 |

### Rollback Plan
- **Triggers:**
  - any 5xx or CPU above 10 ms in the 06:00 invocation;
  - a Phase 1 heartbeat change;
  - any statement with rows_read above 50k;
  - an account day above 60k caused by the job;
  - exposure rows that differ from the batch count;
  - any row written for a month ≤ 2026-03.
- **Steps, least drastic first:**
  1. **Off now, no deploy:** the Operations Lead opens an `ops_job_pause` row for `cf.meridian-entities-enrich.expbf`. Or, for everything, set `hold_all_jobs = 'true'`.
  2. **Code:** `npx wrangler rollback <previous version id> -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` (id recorded at step 4). Phase 1 and Phase 2+3 return to today's behaviour.
  3. **Data, if wanted:** run, per token, `DELETE FROM entity_exposure_monthly WHERE report_month = ? AND computed_at = ?;` and `DELETE FROM fund_exposure_coverage WHERE report_month = ? AND computed_at = ?;`. For all of the job's rows, use `report_month >= '2026-04' AND computed_at LIKE 'g3v2s-%'`.
     - Deletes cost about the same row-writes as the inserts (≈ 4 per row). Delete one token per day within the 50k rule.
     - Pause the job first, or the deleted holder-months will be rebuilt.
     - Rows from v1 (2026-06-14) and months ≤ 2026-03 never match.
- **Verification:**
  - after step 1: the next 06:00 heartbeat is `skipped/pause` and Phase 1 is unchanged;
  - after step 2: `wrangler deployments list -c …` shows the previous id;
  - after step 3: `SELECT COUNT(*) … WHERE computed_at = ?` returns 0.

### Monitoring
- **Daily:** the Tower row `cf.meridian-entities-enrich.expbf`. Its end outcome and `detail.metrics` show batches, rows_written, the largest rows_read per statement, remaining holder-months and the oldest open month.
- **Daily:** analytics `d1-today` and the per-batch `[entities-enrich][expbf]` log lines (via `wrangler tail` on check days).
- **Exception:** `EXPBF_BUDGET_OVERRUN` (failed run) → Ops exception → pause row until reviewed.
- **Milestones:** April complete (L4) ≈ Tue 1 Dec; back-fill complete ≈ Tue 8 – Fri 11 Dec [E]; afterwards `skipped/empty_input` on quiet days and a few batches on Tuesdays after holdings Sundays.

### Approvals Required

| Approver | Role | Status |
|----------|------|--------|
| Founder | This CR and the addendum (design, decisions 1–7) | Pending |
| Founder | Deploy (step 4) and switch-on (step 5) | Pending, separate |
| Architect | Review PASS (step 2) | Pending |
| Tech Ops | Three-point check re-run on the final SQL (B10) | Pending, at build |
| ETF Product Lead | Read dependency acknowledged | Pending, at review |
| Operations Lead | Registry and pause records (step 3) | Pending |
