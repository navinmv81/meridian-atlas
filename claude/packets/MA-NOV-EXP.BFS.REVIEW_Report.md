# MA-NOV-EXP.BFS.REVIEW — Report

```text
PACKET:   MA-NOV-EXP.BFS.REVIEW · Control v1 02548820…7f1b · Task v1 92902886…0985 — hashes verified; pins (addendum 20fbc060…, CR adfc87b1…, BUILD report d48b45b3…) match
RUN:      r-20261120T180309Z-8eea (interactive, LANE_OPENER_v2) · session 78d4b839-e969-41b1-a25b-8f4426f90cf9 · HEAD 9316644 = origin/November-2026
ROLE:     Architect + Tech Ops (did not author BFS or BFS.BUILD); ETF Product Lead acknowledgement; Data-Identity Lead sign-off
OUTCOME:  PASS_WITH_NOTES — 0 B, 2 M, 6 N. Nothing deployed or written except this report. 3 read-only D1 statements, 1,135 rows read
```

## Verdict: PASS_WITH_NOTES

The build matches the approved addendum and decisions 1–7. It ships off and fails closed. It cannot change Phase 1. The identity rule is the BF1 template. The live plan for D2 is the one the build expected. Two medium findings: the code does not enforce the per-invocation budget that the CR declared (M1), and the write budget can be overshot without tripping the overrun stop (M2). Both are small code fixes.

## Checks

| # | Check | Result |
|---|---|---|
| 1 | Scope | `git show --stat 9316644`: `exp-backfill.js` (new), `entities-enrich.js` +16/−2, tests and fixture. No toml, cron or secret change. |
| 2 | Safety | I re-tested this myself on temporary fixture copies. With no Ops rows, a registry row only, or a pause row only, the result is `not_enabled`: 1 D1 read, 0 writes, 0 fetches. An open pause, `hold_all_jobs`, Sunday, Monday, analytics null and U = 55,001 each give `skipped` with its reason, 0 writes and no holdings read. |
| 3 | Isolation | The step never throws, and it runs after Phase 1's `hb.end`. `/run` and the 06:50 firing never call it. Wiring tests 7/7 pass. The existing suites are green: exp-compute 160, exp-ui 221, fi-009 133, fi-010 71, merge-013 106, entities-api-retirement 77, nav-007 39/34/58, fi-009-explain 14/14, plus entity-pipeline-state, exp-route, firds and gleif-reconcile. `exp-backfill` passes 16/16. |
| 4 | Correctness | Every requirement is met: <br>• `KEY_CASE` and the `j` CTE match the template exactly (drift test). The key is the map plus up to two redirects. `entity_isin_map` is not used. <br>• Writes use `INSERT OR IGNORE` only. <br>• A batch never mixes months. Σn ≤ 12k, and a single fund of up to 18k goes alone. <br>• Each batch is counted first, then written in one `batch()`. <br>• The coverage anti-join is both in the candidates and inside `fel`. <br>• The floor `'2026-04'` is in both places. <br>• Tokens have the form `g3v2s-YYYYMMDD-NN`. |
| 5 | Budget | B = min(cap, 60,000 − U). The job skips if U is unknown or the room left is under 5k. The cap defaults to 40k and is clamped to 50k. A batch is checked against the remaining budget before it starts, and the real `rows_written` is subtracted. **M2 below.** |
| 6 | Workers Free | 5 fetches when enabled, 3 when not. CPU: only packing ≤ 300 rows. Dry-run: 32.95 KiB, bindings unchanged. **M1 below** covers D1 calls per invocation. |
| 7 | D2 live | `SEARCH f EXISTS USING COVERING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)`. `fund_snapshot_monthly` is searched through `idx_snapshot_series`, and only `fund_entity_link` (264 rows) is scanned. The candidates statement read **1,135** rows in 34 ms. Without the probe it reads 935 (BFS), so each probe costs about 1 row. MBB 2026-08 (holder 138) is **not** a candidate, so the D2 pin works. |

## Findings

| id | Sev | Item | Evidence | Fix |
|---|---|---|---|---|
| M1 | M | Nothing in the code caps batches, D1 calls or rows read per invocation. CR three-point check 3 declares "≤ 3 batches, ≤ 12 D1 calls, ≈ 200k rows read". | Live: 206 candidates pack into **18 batches**. A day of batches that are cheap to write (bond funds, ~84 writes per 6.6k holdings) can run many of them. Worst case all 18: ≈ 56 extra D1 calls and ≈ 1.4M rows read (3 × 2.69 × 178k). In a synthetic test (60 funds) one run made 180 batches and 542 D1 calls. The build did not record re-checking Cloudflare's published per-invocation D1 limit (addendum §2); only Phase 1's 201 calls are evidence. A limit error fails closed (`EXPBF_D1_ERROR`, with the transaction rolled back). | Add `MAX_BATCHES_PER_RUN` (e.g. 6) and a `rows_read_total` stop (e.g. 400k). Both end the run `partial`. Add 2 tests. |
| M2 | M | Written rows can exceed B by up to 0.25 × the last batch's projection without the overrun stop firing. That breaks "hard ceiling 50,000, whatever the profile says". | In a sweep at a 1.24× multiplier, the job wrote 2,304 against B = 2,250 and ended `partial`, not `failed`. At a 50k cap the worst case is ≈ 62k. It is unlikely in practice, because the multiplier is fixed (4 and 2). | Also treat `written > left` (before subtracting) as `EXPBF_BUDGET_OVERRUN`. |
| N1 | N | If Phase 1 throws, the back-fill does not run and sends no heartbeat, so the Tower may show `job_missed` for expbf. | `catch (err) { hb.fail(err); throw err; }` comes before the step. | Accept. Phase 1's `failed` event is the signal. |
| N2 | N | `LIMIT 300` can split a holder that has two series at the tail, so `n` is undercounted for packing. | Experiment E5. | Accept. Writes use the exact count, and there are 206 candidates today. |
| N3 | N | "Enabled" needs at least one pause row ever written (D4). If an Ops clean-up ever deleted the job's last pause row, the job would go silent. That is the safe direction. | `readControls`. | Put "never delete the expbf pause history" in the Ops runbook. |
| N4 | N | Fewer candidates today than BFS sized: 206, not 212. BND 2026-06 (17,409) and five others are not complete yet. | Statement 3. | None. The only solo batch today is AGG 2026-05. The April date is unchanged. |
| N5 | N | The job ignores registry `status` and `ingest_enabled`. | `SQL.controls`. | Accept. The kill switches are the pause row and `hold_all_jobs`, as approved. |
| N6 | N | My statement 1 used `--file`, which returns no plan rows. It read 0 rows; I re-ran it with `--command`. | — | Process note only. |

## Deviations

- **D1 (`out` parameter): accept.** Two lines. Phase 1's behaviour is unchanged, and it avoids a 6th fetch.
- **D2 (`INDEXED BY`): accept.** Confirmed live. It creates a hard dependency on that index; see the ETF acknowledgement below.
- **D3 (`not_enabled` sends no heartbeat): accept.** Ingest would reject the event with 422, and `not_enabled` is not one of the skip reasons. This is why BFS.OPS must write the pause row before or with the registry row.
- **D4 and D5: accept**, with N3.

## BFS.OPS rows (build report §5)

The columns match migrations 002 and 003, and `CHECK (ends_at > starts_at)` holds. Required order: pause row first, then the registry row, in one file, with the `pause_added` and `registry_updated` case events. Switch-on is an `UPDATE` that sets `ends_at` to now, and inserting a new pause row reverses it. Rolling back BFS.OPS itself means deleting both rows, which leaves the job `not_enabled`. **Safe and reversible.**

## ETF Product Lead acknowledgement

- The job reads `fund_holdings_monthly`, `fund_snapshot_monthly`, `fund_entity_link` and `hold_all_jobs`, and never writes them. It runs at 06:00 UTC, Tue–Sat.
- **Hard dependency on `idx_holdings_status_series_month` (`INDEXED BY`).** If it is renamed or dropped, the candidates statement errors and the run ends `failed` with nothing written. So the job fails closed, and it stays stopped until the index exists again or the code changes. Any ETF migration that touches this index must name this job.
- C1 (December) must add Wednesday (3) to `SKIP_UTC_DAYS`.
- Acknowledged.

## Data-Identity Lead sign-off

- Job id: `cf.meridian-entities-enrich.expbf`, emitter `entities-enrich-cf`.
- 11 flat metric keys, under the limit of 16. Ingest accepted every end shape (B9).
- Tokens: `g3v2s-YYYYMMDD-NN`, which cannot collide with `g3v2-`.
- Rollback by token: `DELETE … WHERE report_month = ? AND computed_at = ?`, after pausing.
- **Signed off.**

## Tech Ops three-point check

1. **Index audit: confirmed.** The B10 batch plans (BUILD) and the D2 candidates plan (live, here) use indexes, with no scan of a large table.
2. **Single-statement reads under 50k: confirmed.** Batch count 9,676 (BUILD); candidates 1,135 (here).
3. **Per-invocation budget: writes confirmed, apart from M2. D1 calls and reads are declared but not enforced (M1).**

## Recommendation: may BFS.OPS and BFS.DEPLOY proceed? **Yes, with conditions.**

1. **BFS.OPS may proceed now.** One reviewed file, pause row first, so the job stays off.
2. **Fix M1 and M2 before the switch-on (FR13).** The best route is a small fix packet before BFS.DEPLOY, so the single deploy carries the fix. If the 25 Nov deploy date matters more, deploying `9316644` while it is paused is safe, but then the switch-on waits for the fix and a second deploy.
3. **BFS.DEPLOY follows build report §5:** capture the rollback version, deploy, then tail one paused 06:00 run and expect `skipped/pause`.
4. **Set the cap to 40,000 for the first two run days,** as in decision 3.

## Queries run (repo root, no `-c`, all read-only)

| # | Statement | rows_read |
|---|---|---|
| 1 | `EXPLAIN QUERY PLAN` candidates, via `--file` (no plan returned) | 0 |
| 2 | `EXPLAIN QUERY PLAN` candidates, via `--command` | 0 |
| 3 | Committed candidates `SELECT` | 1,135 |
| | **Total** (caps: 50,000 per statement, 60,000 in all) | **1,135**, 0 written |
