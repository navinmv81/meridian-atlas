# MA-NOV-EXP — Spec Addendum BF: scheduled exposure back-fill and recurring refresh

```text
PACKET:     MA-NOV-EXP.BFS (run r-20261120T082507Z-e116, interactive) · Control v1 53adebd8…6890 · Task v1 c67da26f…194f
AUTHORS:    Entities Product Lead + Architect, with Tech Ops (three-point check)
AMENDS:     claude/specs/MA-NOV-EXP_Spec.md (785df4d5…fc3e) §5.4 (local one-off run, Tue/Thu) and D5 (recurring refresh in
            meridian-holdings, December). Both are superseded by NML-1120-1 ("scheduled now"): one scheduled job inside
            meridian-entities-enrich does the back-fill and then stays on as the recurring refresh.
INPUTS:     MA-NOV-EXP.BF1_Report.md (1f209939…1263) · MA-OCT-000_Job_Manifest.md (f56ba53e…dafc) · HEAD 4cdd22e
STATUS:     DRAFT, for Founder approval together with claude/specs/MA-NOV-EXP_BF_Change_Request.md. Nothing is built,
            deployed or written by this document.
```

Figures marked **[M]** were measured in this packet (8 read-only statements, report §2). Figures marked **[BF1]** come from the BF1 report, and figures marked **[E]** are estimates.

---

## 1 Goal and scope

- **Back-fill:** build `entity_exposure_monthly` and `fund_exposure_coverage` for **2026-04 … 2026-08**, for every holder (`fund_entity_link.entity_id`) whose fund has *complete* stored holdings in that month. Use the gate3 v2 identity rule (spec §3.2, SQL `4cdd22e`).
- **Recurring refresh (D5):** after the back-fill, the same job keeps both tables current. Any holder-month from 2026-04 onward that has complete holdings but no coverage row gets computed at the next run day.
- **Out of scope:**
  - Months ≤ 2026-03 are never selected. The month floor `'2026-04'` is a constant in the SQL, so re-computing those months with the new identity rule stays a separate December decision.
  - Re-computing a holder-month that already has a coverage row (for example after the holdings pipeline re-ingests a month). Rows already present are never touched (`INSERT OR IGNORE`).
- **Size [M]:** there are **212 holder-months** with a snapshot in 2026-04…08: 70 / 56 / 51 / 25 / 10, with 67,387 / 74,823 / 39,427 / 16,059 / 25,260 snapshot holdings. **None is done yet** (0 coverage rows). Some snapshot months have no complete holdings yet. For example, MBB 2026-08 (11,211 holdings in its snapshot) has **0** complete holding rows [M], so it is not selected until the holdings pipeline marks it complete.

## 2 Where it runs

- **Firing:** the **06:00 UTC** firing of `meridian-entities-enrich` (`0 6 * * *`), the Phase 1 slot. No new cron is added; the account stays at 5/5. The 06:50 firing (Phase 2+3) is **not** used, because its GLEIF subrequest margin is deliberately tight (`SUBREQUEST_CHECKPOINT` 43 of 50).
- **Routing:** `scheduled()` already routes by `getMinutes()`: under 50 means Phase 1. In that branch the new code runs **after** `runPhase1()` returns, in its own `try/catch` and with its own heartbeat. A back-fill error therefore never changes Phase 1's outcome or its heartbeat. The `/run` path (boost LaunchAgent, manual runs) does **not** run the back-fill: it stays a cron-only job, so it runs at most once a day.
- **Code placement:** a new module `App/Corporate Atlas/src/exp-backfill.js`, imported by `entities-enrich.js`. It is in the same Worker folder, as `ops-heartbeat.js` already is. The SQL text lives in that module with bound parameters (no string concatenation), and is generated from the gate3 v2 template so the identity rule cannot drift.
- **Platform budget per 06:00 invocation (Workers Free):**

| Resource | Phase 1 today | Back-fill adds | Total | Limit |
|---|---|---|---|---|
| `fetch` subrequests | 3 (heartbeat start + end, analytics `d1-today`) | 2 (own heartbeat start + end); reuses Phase 1's analytics figure | **5** | 50 |
| D1 calls | ≤ 1 + 2 × 100 = 201 (hold, budget, 100 × SELECT + UPDATE) | registry + pause read 1, candidates 1, per batch 1 count + 1 `batch()` of 2 = ≤ 3 × 3, so ≤ **11** | ≤ 212 | Phase 1 ran with 100 attempted **13 times**, with **0** failed or killed runs [M]. So the per-invocation D1 call limit in force is not 50. The build re-checks Cloudflare's current published limit |
| CPU | low (D1 waits are not CPU) | packing ≤ 250 candidate rows in JS, plus log lines; the SQL runs inside D1 | well under 10 ms [E]; the build measures it with `wrangler tail` | 10 ms |
| Wall time | seconds | 3 statements per batch; measured 104 ms for a 3,579-holding slice and 24 ms for 6,654 bond holdings [M] | seconds | cron wall time is not the constraint |

## 3 Batch unit

- **Unit:** `(report_month, holder range lo..hi)`. Holders are taken in `entity_id` order within the oldest unfinished month first. A month is finished before the next one starts, which keeps BF1's "months in order" rule.
- **SQL:** the BF1 statements with two changes to the `fel` CTE (measured form in report §2.2):
  1. `fel` is restricted to the batch: `… WHERE series_id IS NOT NULL AND entity_id BETWEEN ?lo AND ?hi AND entity_id NOT IN (SELECT holder_entity_id FROM fund_exposure_coverage WHERE report_month = ?m)`. The anti-join is a PK-prefix SEARCH. It keeps holders that are already done out of the read, so they cost no reads.
  2. `FROM fel CROSS JOIN fund_holdings_monthly f WHERE f.snapshot_status = 'complete' AND f.series_id = fel.series_id AND f.report_month = ?m`. `CROSS JOIN` fixes the join order, so the plan is driven by the holders: `SEARCH f USING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)` [M].

  BF1's month-wide plan read the whole month through `idx_holdings_month`, at 4.3 reads per holding. The holder-driven plan reads **2.69 reads per holding** for an equity-heavy slice and **1.12** for a municipal-bond fund [M].
- **Candidates:** one statement per invocation (plan-checked at build):
  ```sql
  SELECT s.report_month m, fel.entity_id holder, s.holdings_count n
  FROM fund_snapshot_monthly s
  JOIN (SELECT DISTINCT series_id, entity_id FROM fund_entity_link WHERE series_id IS NOT NULL) fel ON fel.series_id = s.series_id
  LEFT JOIN fund_exposure_coverage c ON c.report_month = s.report_month AND c.holder_entity_id = fel.entity_id
  WHERE s.report_month >= '2026-04' AND c.holder_entity_id IS NULL
    AND EXISTS (SELECT 1 FROM fund_holdings_monthly f
                WHERE f.snapshot_status = 'complete' AND f.series_id = s.series_id AND f.report_month = s.report_month)
  ORDER BY s.report_month, fel.entity_id LIMIT 300;
  ```
  - The same join without the `EXISTS` read **935 rows** [M]. The `EXISTS` clause is a one-row SEARCH on the same index, so the statement costs ≈ 1.2k reads [E].
  - `snapshot_status='complete'` is set by one atomic UPDATE per (series, month), at the end of ingestion (`holdings-pipeline.js` ~l.499). So "has any complete row" means "the month is complete".
- **Packing:** take consecutive candidates of one month and add holders while Σ`n` ≤ **H_max = 12,000** snapshot holdings. At the equity ratio that is ≤ 32.3k reads per statement [M ratio].
  - A single holder above H_max forms a **solo batch** if `n` ≤ 18,000. The largest today is BND 2026-06 at 17,409: ≤ 46.8k reads at the equity ratio, and ≈ 19.5k at the bond ratio [M ratios]. AGG 2026-05 (13,269) is the only other solo case.
  - A holder above 18,000 is skipped and reported (`oversize`). There is none today.
- **Per batch (3 D1 statements):**
  1. **Count:** the BF1 dry-run `SELECT` restricted to the batch. It gives the exact `exposure_rows` and `coverage_rows`, so the projected row-writes = exposure_rows × 4 + coverage_rows × 2 (the BF1 multiplier, re-measured on the first live batch).
  2. If the projection is ≤ the day's remaining job budget: `env.DB.batch([exposure INSERT, coverage INSERT])`. A D1 `batch()` is one transaction, so a batch is written whole or not at all.
  3. If it is not: **stop for the day**. Batches are not shrunk, which keeps the order strict and the loop simple.
- **Measured batch [M]:** 2026-04, holders 36..77 (10 holders: DGRO, DVY, EFA, EFAV, EMB, FAS, FENY, FHLC, FIDU, FLOT).
  - 3,579 complete holdings, 2,893 of them mapped, gave **2,426 exposure rows** and 10 coverage rows.
  - The count statement read **9,639 rows** in 104 ms.
  - Projected writes: 2,426 × 4 + 10 × 2 = **9,724 row-writes**.
- **Idempotency:**
  - `INSERT OR IGNORE` on both PKs.
  - A holder-month counts as **done** when its `fund_exposure_coverage` row exists. No new table and no cursor key are needed: progress is the data itself.
  - A batch that fails mid-way writes nothing, because `batch()` is one transaction, and it is simply selected again on the next run day.
  - A re-run of a done batch is excluded by the anti-join, so it reads and writes nothing.
- **Run token per batch:** `computed_at = 'g3v2s-YYYYMMDD-NN'`, where NN is the batch number that day. BF1's manual tokens were `g3v2-YYYYMMDD`, so the two can never collide.

## 4 Daily write guard

- **Source of today's total:**
  - The account-wide D1 `rowsWritten` from `meridian-ops` `GET /api/ops/cf/d1-today`. This is `analyticsWritesToday()`, already used by Phase 1 (1 fetch, 0 D1 reads, lags 25–30 min). The back-fill reuses Phase 1's figure `U` from the same invocation, so it makes no extra fetch.
  - The `writes_today_<date>` counter in `holdings_pipeline_state` (ETF domain) is **not** used. Only the holdings Worker writes it, so on Tue–Sat it reads 0 whatever the real usage is (KI 22.14; boost guard note in the job manifest).
  - **If analytics is unavailable, the back-fill skips the day** (fail closed; `skipped`, reason `budget`). Phase 1's own fallback is unchanged.
- **Job budget for the day:** `B = min(cap, 60,000 − U)`.
  - `cap` defaults to **40,000** row-writes. It can be lowered without a deploy, in the job's `ops_job_registry.write_budget_profile` (§5).
  - The code has a hard ceiling of 50,000 (Founder D4), whatever the profile says.
  - 60,000 is the F-5 analytics ceiling already used by Phase 1 (ML-1012-1). The difference, 40,000 or more, is kept for everything that writes after 06:00 and for the analytics lag.
  - The loop subtracts each batch's real `meta.rows_written`, not its projection.
- **Skip days:** **Sunday** (holdings, 04:00 UTC) and **Monday** (entities-seed, 04:00 UTC); reason `out_of_window`. Wednesday is a run day in November, because holdings C1 (the Wednesday holdings run) moved to December (NML-1113-9). C1's change request must add Wednesday to the skip list (a code constant; changing it is part of C1's deploy).
- **When the day is already high:** if `60,000 − U < 5,000`, skip (`budget`). Otherwise run batches until the next projection does not fit `B`.
- **Overrun stop:** if any statement's `meta.rows_read` exceeds 50,000, or a batch's `rows_written` exceeds 1.25 × its projection, the job stops for the day. It ends the run `failed` with `error_class: EXPBF_BUDGET_OVERRUN`, which the Ops sweep turns into an exception. The Operations Lead then adds a pause row (§5) until the cause is reviewed.

**Arithmetic against the 100k shared cap** (job cap 40,000):

| Day | Other writers that day | Back-fill | Day total | Under 100k? |
|---|---|---|---|---|
| Sun | holdings ≈ 80.2–80.8k [M: 1, 8, 15 Nov]; FIRDS seed; enrich and boost | **0** (skip) | ≈ 81–85k | yes; unchanged from today |
| Mon | entities-seed ≈ 32.8–37.0k [M: 26 Oct, 2, 9, 16 Nov]; enrich and boost | **0** (skip) | ≈ 34–41k | yes; unchanged |
| Tue | enrich P1 + P2/3, boost × 2, Ops ingest, bootstrap: ≈ 3–8k [E] (not countable: KI 22.14) | ≤ 40,000 (and ≤ 60,000 − U) | ≈ 43–48k [E] | yes; ≥ 52k margin |
| Wed | as Tue (no C1 in November) | ≤ 40,000 | ≈ 43–48k [E] | yes |
| Thu | as Tue | ≤ 40,000 | ≈ 43–48k [E] | yes |
| Fri | as Tue | ≤ 40,000 | ≈ 43–48k [E] | yes |
| Sat | as Tue | ≤ 40,000 | ≈ 43–48k [E] | yes |

At the 50,000 hard ceiling, Tue–Sat would be ≈ 53–58k [E], still under 100k.

The guard cannot see a writer that starts after 06:00 and has its own blind guard: the Phase 2+3 and boost guards read the blind counter. Those writers are small (low thousands) [E], so the day stays below about 50k.

## 5 Controls

- **Global stop:** `hold_all_jobs = 'true'` in `holdings_pipeline_state`. It is already checked at the top of `scheduled()`, so a hold stops Phase 1 and the back-fill together. Measured today: `false`, unchanged since 2026-08-02 [M].
- **Job on/off without a deploy: use the existing Ops pause table `ops_job_pause` (recommended, Founder decision 2).**
  - The job reads `SELECT 1 FROM ops_job_pause WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND starts_at <= ?now AND ends_at > ?now` (SEARCH on `idx_ops_job_pause_job_end`). An open row means `skipped`, reason `pause`.
  - **Off:** the Operations Lead inserts a pause row (reviewed `wrangler d1 execute` batch plus an `ops_case_event`, the 003 procedure). **On:** the same procedure ends the row (sets `ends_at` to now).
  - The Tower already shows pause windows as `paused`, not `missed` (`lateness.js`).
  - Measured today: 2 pause rows, none open [M].
  - The job ships **off**: a pause row is in place before the deploy, and it is ended only after the deploy checks pass (CR §7).
  - Options set out for the Founder:
    - **(A) `ops_job_pause`**: exists; Ops-owned; Tower-visible; audit trail. The Entities Worker only reads it. *Recommended.*
    - **(B)** A key `exp_bf_enabled` in `holdings_pipeline_state`: exists, but the Control treats that table as ETF-domain and read-only, so toggling it needs the ETF Product Lead's agreement.
    - **(C)** A `[vars]` flag in the toml: a deploy is needed to change it.
- **Daily cap without a deploy:** `ops_job_registry.write_budget_profile` (existing JSON column) for the job, e.g. `{"daily_rows_written_cap":40000}`. It is read in the same statement as the pause check (PK). If it is absent or unreadable, the job uses 40,000. Any value above 50,000 is clamped.
- **Registration (Ops-owned write, done by the Operations Lead):** a row `cf.meridian-entities-enrich.expbf` in `ops_job_registry`, with emitter `entities-enrich-cf`, intended schedule `0 6 * * *` except Sun and Mon, and `kill_switch_ref` = ops_job_pause + hold_all_jobs. Ingest rejects an unregistered `job_id` (`unknown_job`, 422; `ops-api.js` ~l.603). Today only `.phase1` and `.phase23` are registered [M].
- **Status for the Tower:**
  - Heartbeat `start` and `end` via `ops-heartbeat.js`. `end` is `success`, `partial` (budget stopped it with candidates left), `skipped` (`hold` / `pause` / `budget` / `out_of_window` / `empty_input`, all already in `SKIPPED_REASONS`) or `failed`.
  - `detail.metrics` (flat integers, ≤ 16 keys): `batches`, `holders_done`, `rows_written`, `rows_read_max_stmt`, `rows_read_total`, `exposure_rows`, `remaining_holder_months`, `oldest_open_month` (YYYYMM integer), `budget_B`, `analytics_U`, `oversize_skipped`.
  - Done per month: `SELECT report_month, COUNT(*) FROM fund_exposure_coverage WHERE report_month >= '2026-04' GROUP BY 1` (PK range). The Tower or the Main Lane reads it; the job reports only the totals above.
- **Log line per batch:** `[entities-enrich][expbf] m=2026-04 holders=36..77 n=10 exp_rows=2426 rows_read=9639 rows_written=… token=g3v2s-20261126-01`.
- **Rollback by token:** `DELETE FROM entity_exposure_monthly WHERE report_month = ? AND computed_at = ?` and the same for `fund_exposure_coverage`. Deleted holder-months become candidates again. So pause the job first, unless re-computing them is the intent.

## 6 Recurring mode

- **Trigger:** none is needed beyond the daily 06:00 run. After a holdings cycle (Sun 04:00 UTC) marks fund-months complete, the next run day (normally Tuesday) finds them as candidates: complete holdings, no coverage row, month ≥ 2026-04.
- **No re-work:** a done holder-month is never a candidate again. On a day with nothing to do, the cost is the candidate statement (≈ 1.2k reads [E]) plus 2 small control reads, and the heartbeat ends `skipped` (`empty_input`).
- **Not handled (by design):** a holder-month re-ingested after its coverage row was written keeps its first result. A later re-compute packet (December) would delete by token and let the job rebuild.
- **Growth:** `fund_snapshot_monthly` gains ≈ 250 rows a month. The candidate statement scans it, because no index leads with `report_month`. At 1,661 rows today that is bounded and small. Review it at 10k rows.

## 7 Completion estimate

| Month | Exposure rows | Row-writes (× 4, + coverage × 2) |
|---|---|---|
| 2026-04 | 36,951 [BF1] | ≈ 148k |
| 2026-05 | 22k–41k [E] (74,823 holdings, many bond funds: AGG, MBB, MUB, IGSB, IGLB; MUB gives 21 rows for 6,654 holdings [M]) | ≈ 88k–164k |
| 2026-06 | 7k–15k [E] (BND 17,409 of the 39,427 holdings is a bond fund) | ≈ 28k–60k |
| 2026-07 | 4,581 [BF1] | ≈ 18k |
| 2026-08 | 4k–9.5k [E] (only complete funds; MBB not yet complete [M]) | ≈ 16k–38k |
| **Total** | **≈ 75k–107k** | **≈ 300k–430k** (BF1's 450k is an upper bound) |

- **Batches:** ≈ 25 [E] (by packing the 212 sized holder-months at H_max 12,000: 26 batches [M sizing]). That means 1–3 batches a run day.
- **Run days:** a run day writes ≈ 36k of the 40k cap, because a batch that does not fit stops the day. That gives **9–12 run days** [E].
- **Dates, if deployed Wed 25 Nov:** the first run is Wed 25 Nov 06:00Z only if the deploy and the pause-end both happen before 06:00Z. Planned first run: **Thu 26 Nov**.
  - Run days: Thu 26, Fri 27, Sat 28, Tue 1, Wed 2, Thu 3, Fri 4, Sat 5, Tue 8, Wed 9, Thu 10, Fri 11.
  - **2026-04 is complete ≈ Tue 1 Dec** (4 run days). **The whole back-fill completes Tue 8 – Fri 11 Dec** [E].
  - At the 50,000 ceiling (Founder decision 3): April ≈ Sat 28 Nov, all ≈ Fri 4 – Wed 9 Dec [E].
  - If C1 makes Wednesday a skip day in December, add ≈ 1 day per week.

## 8 Acceptance tests

**Build (local; the BF1 in-memory SQLite fixture with the live schema, plus a stubbed `fetch`):**

| # | Test | Expected |
|---|---|---|
| B1 | Packing: candidate list with small, large (> 12,000) and oversize (> 18,000) holders across 2 months | Batches never mix months; Σn ≤ 12,000 except solo batches ≤ 18,000; an oversize holder is skipped and counted; order is oldest month, then ascending holder |
| B2 | Identity equals BF1: run all batches of a fixture month and compare with BF1's whole-month `gate3v2-month.sql.tmpl` output | Identical rows (`report_month, entity_id, holder_entity_id, weight_sum, mapped_weight, total_weight`), except `computed_at` |
| B3 | Idempotency | Second run: 0 candidates for done holders, 0 rows written; a forced failure inside `batch()` leaves 0 rows; the next run completes the batch |
| B4 | Guards | `hold_all_jobs` true → `skipped/hold`; open pause row → `skipped/pause`; Sun or Mon → `skipped/out_of_window`; analytics null → `skipped/budget`; U = 58,000 → `skipped/budget`; U = 30,000, cap 40,000 → B = 30,000; profile cap 70,000 → clamped to 50,000 |
| B5 | Budget loop | Stops before a batch whose projection exceeds the remaining B; spent uses `meta.rows_written`; overrun (> 1.25 × projection or > 50k rows_read) → `failed/EXPBF_BUDGET_OVERRUN` |
| B6 | Month floor | A 2026-03 gap in the fixture is never selected |
| B7 | Incomplete holdings | A holder-month with only `snapshot_status` NULL rows is not a candidate |
| B8 | Phase 1 unchanged | Existing `entities-enrich` tests pass; a back-fill exception does not change Phase 1's heartbeat; `/run` never calls the back-fill; fetches per 06:00 invocation ≤ 5 |
| B9 | Heartbeat payload | `detail.metrics` ≤ 16 flat integer keys; accepted by the Ops `validateRunEvent` |
| B10 | Live plan check (three-point check 1, read-only) | `EXPLAIN QUERY PLAN` of the final count, exposure INSERT, coverage INSERT and candidate SQL: SEARCH on `idx_holdings_status_series_month`, `instrument_entity_map` PK, redirect rowid, coverage PK; only `fund_entity_link` (264) and `fund_snapshot_monthly` (1,661) scanned |

**First live runs (each checked the next morning; report only):**

| # | Check | Pass |
|---|---|---|
| L1 | Day 1 heartbeat and log | `end` success or partial; batches ≥ 1; Phase 1 heartbeat as before; CPU from `wrangler tail` < 10 ms; no 5xx |
| L2 | Day 1 numbers | Each statement's rows_read < 50,000; measured multiplier = rows_written / exposure_rows recorded (expected ≈ 4); exposure rows per batch = its count statement; coverage rows = holders |
| L3 | Day 1 account total | Analytics `rowsWritten` for the day < 60,000; the back-fill's own rows_written ≤ B |
| L4 | April complete (≈ day 4) | 2026-04 exposure rows = **36,951** and coverage rows = **70** (BF1 dry run), unless holdings or mappings changed since 19 Nov, in which case re-count with the dry run and explain the difference |
| L5 | Company page | For one sample entity, `/api/entities/:id/etf-exposure` shows Apr 2026 for its back-filled holders (the per-holder latest month, W1) |
| L6 | Tower | `cf.meridian-entities-enrich.expbf` shows runs on Tue–Sat and `paused` or `out_of_window` on Sun and Mon, with no false `job_missed` |
| L7 | End of back-fill | Every candidate month ≤ 2026-08 done except holder-months without complete holdings; heartbeat then `skipped/empty_input` on quiet days |
