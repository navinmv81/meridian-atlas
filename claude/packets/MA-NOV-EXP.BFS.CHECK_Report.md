# MA-NOV-EXP.BFS.CHECK — Report

```text
PACKET:     MA-NOV-EXP.BFS.CHECK · Control v1 (22a439ca…9b69) · Task v1 (24f27f98…e425) — both verified
PIN:        MA-NOV-EXP.BFS.GO_Report.md 6d494906…e293 — verified
RUN:        r-20261122T093819Z-16ac (interactive, LANE_OPENER_v2) · branch November-2026
ROLE:       Operations Lead (read-only)
CHECKED:    Sun 22 Nov 2026 06:00Z and 06:50Z firings of meridian-entities-enrich
STOP GATES: none hit (no back-fill rows written, Phase 1 did not fail, no 5xx or error)
```

## Verdict

**READY TO SWITCH ON.** The back-fill job `cf.meridian-entities-enrich.expbf` reported `skipped`, reason `pause`. It wrote 0 rows, read 0 rows and made 1 D1 call. The pause row is still open, and neither exposure table holds a `g3v2s-` row. The 06:50 firing ran as normal.

**One thing that differs from the weekday pattern:** Phase 1 ended `skipped`, reason `budget`, not `success`. This is the job's normal **Sunday** result, not something the new deploy caused:
- Phase 1 also skipped on budget on Sun 8 Nov and Sun 15 Nov. Both of those days ran the old version `5c64e54e`, which has no back-fill code.
- Phase 1 succeeded on every other day in November.

The cause is the account-wide write-headroom guard: it needs 5,000 rows of room under the 60,000 ceiling. The `meridian-holdings` run at 04:00 every Sunday uses up that room. So the Phase 1 heartbeat is the same as on previous Sundays.

## Evidence

Four read-only SELECTs (the Control allows up to 6), 5,238 rows read in total (the cap is 20,000), 0 rows written. All were run from the repo root with no `-c`, against `meridian-etf --remote`.

| # | Check | SQL (shape) | Rows read | Result |
|---|---|---|---|---|
| 0 | Active version | `npx wrangler deployments list -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` | — | **`aa39edf6-6509-4931-9aef-b306c694fbec` at 100%**, deployed 2026-11-21T08:25:07Z, message "MA-NOV-EXP.BFS.GO (bc1d079)" |
| 1 | Run ledger | `SELECT … FROM ops_job_run WHERE received_at >= '2026-11-20T05:55:00Z' AND job_id IN (phase1, phase23, expbf) ORDER BY event_id` (uses `idx_ops_job_run_received`) | 69 | See the table below |
| 2 | Pause row | `SELECT … FROM ops_job_pause WHERE job_id = 'cf.meridian-entities-enrich.expbf'` (uses `idx_ops_job_pause_job_end`) | 2 | `pause_id` 3, `starts_at` 2026-11-21T08:24:16Z, `ends_at` **2099-01-01T00:00:00Z**, created by `ops_lead:wrangler`, **open_now = 1**. It is the only row for the job |
| 3 | Phase 1 in November, to compare | `SELECT started_at, event_type, … FROM ops_job_run WHERE job_id = '…phase1' AND started_at >= '2026-11-01' AND phase = 'end'` (uses `idx_ops_job_run_job_at`) | 34 | 17 runs. Each **Sunday** (8, 15 and 22 Nov) is `skipped/budget`. All 14 other days are `success`, with `items_attempted` 100 |
| 4 | Token check | Newest 5,000 rowids of each table: `SELECT COUNT(*), SUM(computed_at LIKE 'g3v2s-%'), MIN/MAX(rowid), MAX(computed_at) FROM (SELECT rowid, computed_at FROM <tbl> ORDER BY rowid DESC LIMIT 5000)`, run for both tables with UNION ALL | 5,133 | `entity_exposure_monthly`: 5,000 rows checked (rowid 23508–28508), **0** `g3v2s-` rows. `fund_exposure_coverage`: all 133 rows checked, **0**. Newest `computed_at` in both tables is 2026-06-14T18:18:23Z, so nothing has been written since June |

**Why check 4 is bounded rather than a full count:** neither table has an index on `computed_at`, so a full count would scan the whole table. New rows get the highest rowids (both are rowid tables, and the back-fill only inserts). So any back-fill writes would have to sit in the newest-rowid window that was checked. `fund_exposure_coverage` was small enough to check in full.

### Run ledger for the check day (check 1, 22 Nov rows)

| event_id | job | phase / type | started → ended (Z) | ms | rows_read / rows_written | error | detail |
|---|---|---|---|---|---|---|---|
| 812 | phase1 | start | 06:00:50.921 | — | — | — | — |
| 813 | phase1 | end / **skipped** | 06:00:50.921 → 06:00:52.241 | 1,320 | — | NULL | `{"reason":"budget"}` |
| 815 | expbf | start | 06:00:52.285 | — | — | — | — |
| 814 | expbf | end / **skipped** | 06:00:52.285 → 06:00:52.285 | 0 | **0 / 0** | NULL | `reason "pause"`; metrics `batches 0, rows_written 0, rows_read_total 0, exposure_rows 0, budget_B 0, d1_calls 1` |
| 816 | phase23 | end / **success** | 06:50:18.066 → 06:50:18.649 | 583 | — | NULL | all phase2/3 metrics 0, the same as 20 and 21 Nov |

**How to read these rows:**
- **Event order:** expbf's end row (814) arrived in the same batch as its start row (815), at 06:00:52.409Z, so its `event_id` is lower. Both rows share `started_at`, and the `UNIQUE(run_id, phase)` pair is complete.
- **Why the back-fill reports `pause`:** on a Phase 1 budget skip, `entities-enrich.js` calls the back-fill step with `forced: 'budget'`. The guards run in the order hold → pause → out_of_window → budget, so the pause guard answers first. That matches the order in the GO report.
- **Comparison days:** 20 and 21 Nov (both before the deploy, Fri and Sat) were Phase 1 `success` with `items_attempted` 100, followed by phase23 `success` at 06:50.
- **No errors:** the ledger has no `failed` or `killed` row and no `error_class` on any of the five rows, so there was no 5xx.

## Switch-on SQL for FR13 (copied from the GO report; not run here)

```sql
-- MA-NOV-EXP FR13 switch-on: end the open pause row, plus a case event. Run once, from the repo root:
--   npx wrangler d1 execute meridian-etf --remote --file <this file>
UPDATE ops_job_pause SET ends_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')
   AND starts_at < strftime('%Y-%m-%dT%H:%M:%SZ','now');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'pause_ended', '2099-01-01T00:00:00Z', strftime('%Y-%m-%dT%H:%M:%SZ','now'),
          '{"packet":"<switch-on packet>","founder_words":"<quote>","pause_id":3}',
          'ops_lead:wrangler', 'system', 'Operations Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          'pause_end:cf.meridian-entities-enrich.expbf:3');
```

- **Verify:** `SELECT pause_id, ends_at FROM ops_job_pause WHERE job_id = 'cf.meridian-entities-enrich.expbf'` should show pause 3 ended, with no open row.
- **Still open from the GO report:** `pause_ended` is a new event type, because migration 003 names only `pause_added`. The Main Lane should confirm the name in FR13's Control.

**What the Main Lane should know when it plans FR13:**
- **Sunday runs:** Phase 1 skips on budget every Sunday, so the back-fill never runs on a Sunday, even after the switch-on. The forced `budget` path makes the back-fill skip once the pause is gone.
- **Monday runs:** `meridian-entities-seed` now fires Mondays at 04:00 (MA-OCT-012). That could take the write room on Mondays too. This check did not test it.
- **First back-fill run:** after a switch-on, the first run to actually do back-fill work will be the next Tue–Sat 06:00 firing that has write room.

## Boundaries kept

- **Files written:** this report only.
- **D1:** 4 read-only SELECTs (5,238 rows read, 0 written). No Ops rows were written, and the pause row was not touched. The switch-on SQL was **not** run.
- **Wrangler:** one `deployments list` (read). No deploy, no rollback, no `tail`.
- **Git:** read-only commands only, no commits.
- **Not touched:** secrets, `.env*`, `*_Status.json`, the board, the Tower, `transitions.jsonl`, logs, either LANE_OPENER file, Main Lane records, `13F Seed/gleif-seed.js`.
- **Tools:** no installs, no subagents.
