# MA-NOV-EXP.BFS.BUILD — Report

```text
PACKET:     MA-NOV-EXP.BFS.BUILD · Control v1 (7498b301…e11) · Task v1 (09a1b87f…c27) — hashes verified
PINS:       Addendum BF 20fbc060…2049 · BF CR adfc87b1…c911 · BFS_Report 2d7aef3c…b294 · entities-enrich.js blob 3221d198 — all match
RUN:        r-20261120T173350Z-e306 (interactive, LANE_OPENER_v2) · base 4cdd22e = origin/November-2026
OUTCOME:    DONE. Built, tested, plan-checked live (read-only), committed and pushed. NOTHING DEPLOYED. The job ships OFF.
COMMIT:     93166447c3e6f1aa9fb72c5c1e858ad3b5ee3318 on November-2026 (ls-remote confirms origin = 9316644)
STOP GATES: none hit. No new table, cron, secret or cross-domain write. The B10 plan shows no SCAN of a large table. The existing
            suites are green. The push was accepted.
```

## 1 What was built

**New module: `App/Corporate Atlas/src/exp-backfill.js`.** It implements addendum §2–§6.

| Export | What it does |
|---|---|
| `SQL.controls` | One statement reads `hold_all_jobs`, the registry row and its `write_budget_profile`, whether any pause row was ever written, and whether a pause row is open now. It uses only PK and `idx_ops_job_pause_job_end` searches |
| `SQL.candidates` | The addendum's statement (month floor `'2026-04'` constant, `LIMIT 300`). Its `EXISTS` probe is pinned `INDEXED BY idx_holdings_status_series_month` (deviation D2) |
| `SQL.count` / `SQL.exposureInsert` / `SQL.coverageInsert` | The gate3 v2 template with the two BFS changes: `fel` limited to `BETWEEN ?2 AND ?3` minus done holders (`NOT IN` coverage for `?1`), and `FROM fel CROSS JOIN fund_holdings_monthly f`. Both writes are `INSERT OR IGNORE`. The parameters are bound (`?1` month, `?2`/`?3` holder range, `?4` token), and the month floor is repeated inside `fel` |
| `packBatches()` | Never mixes months and keeps Σn ≤ 12,000. A holder with 12,000 < n ≤ 18,000 goes alone; a holder above 18,000 goes to `oversize` and is skipped. It sums a holder that appears with two series in one month, and closes a batch before an oversize or solo holder, so no batch range spans one |
| `capFromProfile()`, `dayBudget()` | Cap = `daily_rows_written_cap`. If the cap is absent or unreadable it is 40,000, and it is clamped to 50,000. B = min(cap, 60,000 − U). The result is null (skip) if U is unknown or 60,000 − U < 5,000 |
| `isSkipDay()`, `runToken()` | Sunday and Monday UTC are skip days. The token is `g3v2s-YYYYMMDD-NN` |
| `runExpBackfill()` | **Guards, in order:** not_enabled → hold → pause → out_of_window → budget.<br>**Per batch:** exact count first. The batch is written only if its projection (exp × 4 + cov × 2) is ≤ what is left of B; otherwise the run stops as `partial`. The write is one `env.DB.batch([exposure, coverage])`, which is one transaction.<br>**Spend:** `left` is reduced by the real `meta.rows_written`, not the projection.<br>**Overrun:** any statement with `rows_read` > 50,000, or a batch writing more than 1.25 × its projection, gives `failed` / `EXPBF_BUDGET_OVERRUN`. A D1 error gives `failed` / `EXPBF_D1_ERROR`.<br>**Log:** one line per batch, in the addendum §5 format |
| `expbfEventFields()` | Heartbeat end fields: top-level `rows_written`, `rows_read`, `items_attempted` / `items_progressed` (holder-months), and 11 flat integer `detail.metrics` (the addendum §5 keys) |
| `runExpBackfillStep()` | The isolated step that `scheduled()` calls; it never throws.<br>Not enabled → log only, **0 fetches**.<br>Otherwise it sends its own heartbeat `start` and `end` for `cf.meridian-entities-enrich.expbf` (2 fetches) and reuses Phase 1's U.<br>`forced: 'hold' | 'budget'` reports the day when Phase 1 stopped early |

**Wiring in `entities-enrich.js` (+14 / −2 lines):**
- l.66 and l.86: `checkWriteBudget` takes an optional `out` and records the analytics figure (deviation D1).
- l.542: `import { runExpBackfillStep } from './exp-backfill.js'`.
- l.557–l.568: the hold and budget early returns call `runExpBackfillStep(..., { forced })` under `isPhase1`.
- l.586: after Phase 1's `try/catch`, `if (isPhase1) await runExpBackfillStep(env, ctx, event, { U: budget.analyticsUsed ?? null })`.

`fetch()` (`/run`) and the Phase 2+3 path are untouched. `runPhase1/2/3`, `checkHold` and `persistCombinedSubrequestCount` are byte-identical to blob 3221d198; a test checks this.

**Fetches per 06:00 invocation:** 5 when enabled (Phase 1 start and end, `d1-today`, expbf start and end); 3 when not enabled.

**D1 calls the step adds:** at most 1 + 1 + 3 per batch.

**Dry-run build** (`npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-enrich.toml"`): OK, 32.95 KiB (gzip 9.08 KiB). The bindings are unchanged: DB and 3 vars.

## 2 Tests

**New files:**
- `tests/exp-backfill.test.mjs`: 16 tests.
- `tests/exp-backfill-wiring.test.mjs`: 7 tests. It runs the real `scheduled()` and `fetch()`, and sends every heartbeat into the real `App/Ops/src/ops-api.js` ingest.
- `tests/exp-backfill-fixture.mjs`: node:sqlite with the live DDL subset and Ops migrations 002/003; 12 funds × 4 months; a D1 adapter whose `batch()` is a single transaction.
- `tests/fixtures/exp-backfill/schema.sql`.

**All pass: 16/16 and 7/7.**

| # | Result |
|---|---|
| B1 | Packing: months never mixed; Σn ≤ 12,000; solo batches ≤ 18,000; oversize holders skipped and counted; ordered by oldest month, then holder; two-series holder summed. **Pass** |
| B2 | Every batch of 2026-04…06 gives exactly the whole-month `gate3v2-month.sql.tmpl` rows (exposure and coverage, all columns except `computed_at`). There are ≥ 6 batches, and the 1-, 2- and 3-hop redirects behave as the template does. A drift test checks the key CASE and the redirect CTE are character-identical to the template. **Pass** |
| B3 | A second run gives `skipped/empty_input` with 0 rows written. A failure forced inside `batch()` leaves 0 rows in both tables, and the next run then matches the reference exactly. A holder already done by BF1 is never re-read or re-written. **Pass** |
| B4 | Hold, pause, Sun, Mon, analytics null, U = 58,000 and U = 55,001 → each `skipped` with its reason, no INSERT and no holdings read. Wednesday is a run day. U = 30,000 with cap 40,000 → B = 30,000. A profile of 70,000 → 50,000. No profile or a bad profile → 40,000. **Pass** |
| B5 | The run stops before the batch that does not fit, and spends the real `meta.rows_written`: with ×3 reported, a third batch fits. With a cap below the first projection, 0 batches run. Across 31 caps, Σ written ≤ cap every time. Overruns of > 1.25 × projection, a count reading > 50k (nothing is written) and an INSERT reading > 50k all give `failed/EXPBF_BUDGET_OVERRUN`. **Pass** |
| B6 | A complete 2026-03 is never a candidate and never written, even by a direct batch call (the floor is also inside the batch SQL). **Pass** |
| B7 | A month with only NULL-status rows is not a candidate. Once it is marked complete, the next run day writes it (recurring mode). **Pass** |
| B8 | On Tuesday the run sends **5 fetches**, and the back-fill starts after Phase 1's `end`.<br>Controls that cannot be read, or a D1 error inside the batch: `scheduled()` does not throw, and Phase 1's end event is identical to the reference.<br>The 06:50 firing and `/run` never touch the back-fill SQL.<br>Static checks: 3 calls, all under `isPhase1`, all in `scheduled()`; Phase functions match blob 3221d198. **Pass** |
| B9 | The real Ops ingest accepts (201) every end shape: success; partial; failed (`EXPBF_D1_ERROR`, `EXPBF_BUDGET_OVERRUN`); and skipped with each reason — hold, budget (Phase 1's own skip and analytics unavailable), out_of_window (Sun and Mon), pause and empty_input. The stored detail keeps 11 metrics. **Pass** |
| extra | **Ships off.** No registry row, or no pause row ever written → `skipped/not_enabled`: 1 control read, 0 writes, 0 heartbeats. **Pass** |
| extra | A batch never exceeds the remaining budget (B5 property). Sun/Mon skip is decided on the UTC day. The token is `g3v2s-20261124-01…NN`, one per batch, with no overlap with BF1's `g3v2-…`. **Pass** |
| B10 local | The batch plans are holder-driven, and the candidates probe uses `idx_holdings_status_series_month`. No SCAN of holdings, map or redirect tables. If the pinned index is missing, the statement errors (fail closed). **Pass** |

**Existing suites (run from `App/`):** all Corporate Atlas suites pass:
- entities-api-retirement 77
- entity-pipeline-state 4
- exp-compute 160
- exp-route 32
- exp-ui 221
- fi-009-explain
- fi-009-worker 133
- fi-010-frontend 71
- firds-wrangler-cause 4
- gleif-reconcile-011 16
- merge-013 106
- nav-007-frontend 39
- nav-007-key 34
- nav-007-worker 58

In Ops: `heartbeats-contract` 34/34 (including the `/run`-never-reports and checkpoint-43 static checks), `sweep-contract` and `lateness` pass.

Not counted as suites:
- `gleif-reconcile-011-dryrun.mjs` and `Ops/tests/ingest-contract.mjs` are manual tools that need arguments or environment variables.
- **`Ops/tests/ops-a.test.mjs` fails 1 check, and the failure is pre-existing.** `docs/index.html` ≠ `App/index.html`. It fails the same way with this change stashed. It concerns front-end files outside this packet.

## 3 B10 live plan check (4 read-only statements, repo root, no `-c`; 0 rows written)

| # | Statement | rows_read | Result |
|---|---|---|---|
| 1 | `EXPLAIN QUERY PLAN` exposure INSERT (2026-04, 36..77) | 0 | `SCAN fund_entity_link` (264 rows) · `SEARCH fund_exposure_coverage USING COVERING INDEX sqlite_autoindex_fund_exposure_coverage_1 (report_month=?)` + bloom filter · `SCAN fel` · **`SEARCH f USING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)`** · `SEARCH m USING INDEX sqlite_autoindex_instrument_entity_map_1` · `SEARCH rd1/rd2/rd3 USING INTEGER PRIMARY KEY` · temp B-tree for GROUP BY |
| 2 | `EXPLAIN QUERY PLAN` coverage INSERT | 0 | Identical to 1 |
| 3 | `EXPLAIN QUERY PLAN` candidates (as first written) | 0 | `SCAN fund_entity_link` · `SEARCH s USING INDEX idx_snapshot_series (series_id=? AND report_month>?)` (so `fund_snapshot_monthly` is not scanned at all) · coverage PK search · **`SEARCH f EXISTS USING INDEX idx_holdings_series_month (series_id=? AND report_month=?)`**, which leads to D2 |
| 4 | Batch `COUNT`, 2026-04, holders 36..77 | **9,676** | **2,426 exposure rows**, 10 coverage rows, 3,579 holdings, 2,893 mapped; 97 ms. This matches BFS (9,639 read). The +37 is the coverage anti-join. Projected writes: 2,426 × 4 + 10 × 2 = **9,724** |

**Total rows read: 9,676**, against caps of 50,000 per statement and 60,000 in all. The only tables scanned are `fund_entity_link` and the `fel` co-routine; there is no SCAN of a large table.

The count statement's own plan was not EXPLAINed separately, to stay within 4 statements. Its read path is the same CTE as statements 1 and 2, and statement 4 measured it directly. The controls statement was plan-checked locally only. It uses PK and `idx_ops_job_pause_job_end` searches; the only SCAN is SQLite's `SCAN CONSTANT ROW`.

## 4 Deviations

- **D1 — `checkWriteBudget` gets an optional `out` parameter** (2 lines, outside `scheduled()` proper).
  - Why: the addendum requires the back-fill to reuse Phase 1's analytics figure U with no fetch of its own, and `checkWriteBudget` returned only a boolean.
  - What it does: it records the value it already fetched. Phase 1's behaviour and its tests are unchanged.
  - The alternative was a 6th fetch, outside the addendum's ≤ 5.
- **D2 — `INDEXED BY idx_holdings_status_series_month` in the candidates `EXISTS`.**
  - Why: live statement 3 showed the planner picking `idx_holdings_series_month`. On an incomplete series-month (all `snapshot_status` NULL) that index reads every row before the probe fails: about 11,211 reads for MBB 2026-08 alone, every run day. Pinned, the probe reads 0–1 rows; the plan was checked on node:sqlite with the same indexes.
  - Not confirmed live: the pinned form was not re-EXPLAINed live, because the 4-statement budget was spent. **BFS.REVIEW or BFS.DEPLOY should EXPLAIN it once live.** Expect `SEARCH f EXISTS USING COVERING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)`.
  - If the index were ever dropped, the statement errors and the step ends `failed` with nothing written.
- **D3 — `not_enabled` sends no heartbeat.**
  - Why: `not_enabled` is not one of the Ops `SKIPPED_REASONS`, and the ingest rejects an unregistered job_id.
  - Result: until BFS.OPS writes both rows, the job is silent, with a log line only.
- **D4 — "enabled" means the registry row exists AND at least one `ops_job_pause` row has ever been written for the job.** This reconciles decision 3 (no profile → cap 40,000) with decision 6 (no rows yet → do not run): with BFS.OPS's rows in place, a missing cap uses 40,000.
- **D5 — When Phase 1 stops early** (hold, or its own budget skip), the back-fill still reports the day as `skipped/hold` or `skipped/budget`, if enabled. This avoids a false `job_missed` on the Tower. It writes nothing and adds at most 2 fetches (4 in all on those paths).

## 5 Notes for the next packets

**BFS.OPS** (Operations Lead; reviewed `wrangler d1 execute --remote --file` batch plus `ops_case_event` rows, per the 003 procedure). **Order matters: insert the pause row in the same file as, or before, the registry row.**

1. Pause row (keeps the job OFF):
   ```sql
   INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by)
   VALUES ('cf.meridian-entities-enrich.expbf', '<now ISO Z>', '2099-01-01T00:00:00Z',
           'MA-NOV-EXP.BFS ships off until BFS.DEPLOY checks pass', 'ops_lead:wrangler');
   ```
2. Registry row:
   ```sql
   INSERT INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, worker_name, source_path,
     intended_schedule, emitter_id, ingest_enabled, expected_max_duration_s, kill_switch_ref, write_budget_profile, status, notes)
   VALUES ('cf.meridian-entities-enrich.expbf', 'meridian-entities-enrich (exposure back-fill, 06:00 after Phase 1, Tue–Sat)',
     'Entities', 'Data-Identity Lead', 'cron', 'meridian-entities-enrich', 'App/Corporate Atlas/src/exp-backfill.js',
     '{"kind":"cf_cron","exprs":["0 6 * * *"],"tz":"UTC","on_time_tol_s":600,"grace_s":3600}', 'entities-enrich-cf', 1, 900,
     'ops_job_pause (job_id) + hold_all_jobs (holdings_pipeline_state)', '{"daily_rows_written_cap":40000}', 'active',
     'MA-NOV-EXP.BFS; skips Sun/Mon UTC in code (out_of_window)');
   ```
   - `intended_schedule` uses the same shape as `.phase1`.
   - Sun and Mon still produce a heartbeat (`skipped/out_of_window`), so no false `missed` slot is expected. If the Tower's schedule kind supports excluded days, the Operations Lead may prefer to state them there.
3. `ops_case_event` rows `pause_added` and `registry_updated`, as the 003 procedure requires.

**BFS.DEPLOY:**
1. **Before deploying:**
   - Confirm both BFS.OPS rows exist.
   - Capture the current version: `npx wrangler deployments list -c "App/Corporate Atlas/wrangler-entities-enrich.toml"`. That version is the rollback target.
   - Re-EXPLAIN the pinned candidates SQL once live (D2).
2. **Deploy:** `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` from `9316644`. Record the version id.
3. **The next 06:00 firing**, still paused, under `wrangler tail`. Expect:
   - Phase 1 heartbeat as before.
   - expbf `skipped/pause`.
   - Total 5 fetches, no 5xx, CPU < 10 ms.
4. **Switch on** (Founder's word): end the pause row (`UPDATE ops_job_pause SET ends_at = '<now>' WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > '<now>'`, plus a case event).
5. **First run:** checks L1–L3. The log line per batch carries the token for rollback by token (addendum §5).
6. **Rollback:** `wrangler rollback <captured version>` (or redeploy `4cdd22e`), or keep the code and re-open the pause row, which needs no deploy.

## 6 Boundaries kept

- **Deploys:** none. No toml, cron, secret, `.env*` or LaunchAgent changes, and no edits to other Workers, front-end files or `docs/`.
- **D1:** 4 read-only statements, 9,676 rows read, 0 written. No DDL and no Ops rows written.
- **Files written:** only the allowed paths:
  - `App/Corporate Atlas/src/exp-backfill.js` (new)
  - `App/Corporate Atlas/src/entities-enrich.js` (wiring, plus D1)
  - `App/Corporate Atlas/tests/exp-backfill*` (new files and the `fixtures/exp-backfill/` fixture)
  - this report
  - Wrangler's dry-run bundle went to the session scratchpad.
- **Not touched:** no Status, board, Tower, `transitions.jsonl` or log files; neither LANE_OPENER file; no Main Lane records; `13F Seed/gleif-seed.js`.
- **Tools and git:** no installs and no subagents. One commit with explicit paths, pushed to `November-2026`, and `ls-remote` checked.
