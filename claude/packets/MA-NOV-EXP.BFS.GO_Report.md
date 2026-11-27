# MA-NOV-EXP.BFS.GO — Report

```text
PACKET:     MA-NOV-EXP.BFS.GO · Control v1 (353ae3f7…5de) · Task v1 (c65793c6…1ec) — both verified
RUN:        r-20261121T082142Z-89fa (interactive, LANE_OPENER_v2) · base 76d8283 = origin/November-2026
ROLE:       Operations Lead + Engineering Lead
COMMIT:     bc1d079 "MA-NOV-EXP.BFS.GO: read limit 300k; expbf Ops rows (paused)" — pushed, ls-remote = bc1d079
OUTCOME:    DONE — A, B and C complete; job deployed and still OFF (pause row open until 2099-01-01)
VERSIONS:   meridian-entities-enrich 5c64e54e-8467-40e9-9591-a547529b1d15 (6 Nov, rollback target)
            → aa39edf6-6509-4931-9aef-b306c694fbec (21 Nov 08:25:06Z, message "MA-NOV-EXP.BFS.GO (bc1d079)")
STOP GATES: none hit. Rollback triggers: none fired.
```

Pins were checked before starting: CR `adfc87b1…c911`, BUILD `d48b45b3…31f0`, REVIEW `f8272b83…7a27`, FIX `30e820ed…8ccb`. All four match.

## A. Read limit

**Code:** in `App/Corporate Atlas/src/exp-backfill.js`, `EXPBF_MAX_ROWS_READ_PER_RUN` went from `150000` to `300000`. Nothing else in the code changed.

**Tests:** `tests/exp-backfill.test.mjs` changed in two places.
- **Constants test:** now expects 300,000.
- **Rows-read test, rescaled:** each statement is capped at 50,000 rows read (`ROWS_READ_STOP`), so a run now reaches 300,000 only across several batches. Simply doubling the old numbers would have tripped that per-statement cap. The test now covers the same two stop paths:
  - **After the count:** count reads are 40,000, then 29,000, then 50,000, and each INSERT reads what its count read. Before the 3rd count the projection is 207k + ~87k ≤ 300k. After the 3rd count it is 257k + ~50k > 300k. The run stops `partial/run_limit` with 2 batches written. The 3rd count ran, and no INSERT was issued for the 3rd batch.
  - **Before the count:** each count reads 40,000 and each INSERT reads 50,000, so a batch reads 140k. Before the 3rd count the projection is 280k + ~140k > 300k. The run stops with 2 batches written and makes no 3rd count, so `d1_calls` = 8.

| Check | Result |
|---|---|
| `tests/exp-backfill.test.mjs` | 20/20 pass |
| `tests/exp-backfill-wiring.test.mjs` | 7/7 pass |
| All Corporate Atlas `tests/*.test.mjs` | 117 tests: 91 pass, 26 skipped (the same skips as before), 0 fail |
| `wrangler deploy --dry-run --config wrangler-entities-enrich.toml` | OK. 34.44 KiB (gzip 9.46 KiB). Bindings unchanged: DB `meridian-etf`, `OPS_INGEST_URL`, `OPS_EMITTER`, `OPS_D1_TODAY_URL` |

## B. Ops rows (paused)

**File:** `App/Ops/migrations/registry-load-2026-11-20-expbf.sql`, committed in `bc1d079`. It writes, in this order:
1. the pause row;
2. the registry row, exactly as BUILD report §5, with `write_budget_profile` `{"daily_rows_written_cap":40000}`;
3. the `pause_added` case event;
4. the `registry_updated` case event.

**Idempotency:**
- `ops_job_pause` has no unique key, so the pause row is inserted with `INSERT … SELECT … WHERE NOT EXISTS (an open pause for the job)`.
- The registry row and both case events use `INSERT OR IGNORE`, on the PK and on `idempotency_key`.
- The file has no UPDATE and no DELETE.

**Pre-check:** the file was run twice against an in-memory SQLite built from migrations 002 and 003. Both runs together produced 1 pause row, 1 registry row and 2 events.

**Execution:** run once, `npx wrangler d1 execute meridian-etf --remote --yes --file App/Ops/migrations/registry-load-2026-11-20-expbf.sql`.
- Result: `changes 4`, `rows_written 14`, `rows_read 51`, 1 attempt.
- One deviation: this was run from `App/Corporate Atlas/` with a relative path, not from the repo root. No `-c` was used, and the target database `meridian-etf` (the same remote D1) was resolved as expected.

**Verification:** 3 read-only SELECTs, run from the repo root, 6 rows read.

| Check | Result |
|---|---|
| Registry row | `cf.meridian-entities-enrich.expbf`, cron, worker `meridian-entities-enrich`, emitter `entities-enrich-cf`, `ingest_enabled` 1, cap 40,000, `active`, `intended_schedule` `{"kind":"cf_cron","exprs":["0 6 * * *"],…}` |
| Pause row | `pause_id` 3, `starts_at` 2026-11-21T08:24:16Z, `ends_at` 2099-01-01T00:00:00Z, reason as the Task states, `created_by` `ops_lead:wrangler`, **open now = 1** |
| Case events | `event_id` 206 `pause_added`, and 207 `registry_updated`. Both `ops_control`, actor `ops_lead:wrangler` |

## C. Deploy

**Pre-checks:**

| Check | Result |
|---|---|
| `whoami` | OAuth, with `workers_scripts (write)` and `d1 (write)` |
| `deployments list` | Active version was `5c64e54e-8467-40e9-9591-a547529b1d15` (2026-11-06T04:06Z). Captured as the rollback target |
| D2 live, `EXPLAIN QUERY PLAN` of `SQL.candidates` (0 rows read) | `SEARCH f EXISTS USING COVERING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)`. `s` is searched through `idx_snapshot_series` and `c` through its PK autoindex. The only scan is `SCAN fund_entity_link` (264 rows), plus the `fel` co-routine built from it. This is the same plan BFS.REVIEW accepted (check 7), with no SCAN of a large table, so the gate was not hit |

**Deploy:** one `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-enrich.toml" --message "MA-NOV-EXP.BFS.GO (bc1d079)"`, run from HEAD `bc1d079`. The src and toml had no local changes.

```text
Total Upload: 34.44 KiB / gzip: 9.46 KiB
env.DB (meridian-etf) · env.OPS_INGEST_URL · env.OPS_EMITTER ("entities-enrich-cf") · env.OPS_D1_TODAY_URL
Uploaded meridian-entities-enrich (6.13 sec)
Deployed meridian-entities-enrich triggers (3.99 sec)
  schedule: 0 6 * * *
  schedule: 50 6 * * *
Current Version ID: aa39edf6-6509-4931-9aef-b306c694fbec
```

**After the deploy:**
- `deployments list` shows `aa39edf6…` at 100%.
- `versions view aa39edf6…` shows:
  - handlers `scheduled, fetch`;
  - secrets `OPS_INGEST_KEY` and `RUN_AUTH_SECRET`, both still present;
  - the same D1 binding and the same 3 vars.

Crons are exactly `0 6 * * *` and `50 6 * * *`, and the bindings are the same as before. The deployed code is HEAD. No rollback trigger fired.

**Note:** the previous version, `5c64e54e`, predates all BFS code. This deploy is the first to carry the BFS.BUILD wiring and the BFS.FIX limits along with this packet's constant. The back-fill step stays off, because the pause guard returns before any back-fill D1 write.

## BFS.CHECK: the first paused 06:00 run (read-only)

**Which run:**
- The guards run in this order: not_enabled → hold → **pause** → out_of_window → budget. The pause guard comes before the day-of-week guard, so every 06:00 run shows `skipped/pause` while the pause is open.
- The **first** check is therefore possible after **Sun 22 Nov 06:00Z**.
- If the Main Lane wants a Tue–Sat slot, use **Tue 24 Nov 06:00Z**.

**What to read**, with no writes:

1. **Live log (optional):** `npx wrangler tail meridian-entities-enrich -c "App/Corporate Atlas/wrangler-entities-enrich.toml" --format pretty`, started before 06:00. Expect:
   - the Phase 1 log as before;
   - one line `[entities-enrich][expbf] skipped/pause batches=0 rows_written=0 B=0`;
   - outcome `ok`, no exception, no 5xx;
   - CPU < 10 ms, and a total of 5 fetches.
2. **Run ledger:** one SELECT, run from the repo root:
   ```sql
   SELECT job_id, phase, event_type, started_at, ended_at, rows_read, rows_written, error_class, detail
     FROM ops_job_run
    WHERE job_id IN ('cf.meridian-entities-enrich.phase1','cf.meridian-entities-enrich.expbf')
      AND received_at >= '<the check day>T05:55:00Z'
    ORDER BY event_id;
   ```
   ```bash
   npx wrangler d1 execute meridian-etf --remote --command "<the SQL above>"
   ```
   Expect:
   - `phase1`: start + end, with `event_type` as on previous days (normally `success`).
   - `expbf`: `skipped`, with `detail` `"reason":"pause"`, `rows_written` 0 and `error_class` NULL.
3. **No back-fill writes:** `SELECT COUNT(*) FROM fund_exposure_coverage` should be unchanged from the day before. Compare it with the count taken just before the run, if one was taken.

**Fail:**
- expbf is anything other than `skipped/pause`;
- or Phase 1's heartbeat is missing or differs from normal;
- or there is any exception or 5xx.

On a fail, run `npx wrangler rollback 5c64e54e-8467-40e9-9591-a547529b1d15 -c "App/Corporate Atlas/wrangler-entities-enrich.toml" -m "MA-NOV-EXP.BFS rollback: <reason>"`. That needs its own approval; it is not covered by this packet.

## Switch-on SQL for FR13 (Founder's word only; not run here)

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
- **Timing:** the next eligible 06:00 run (Tue–Sat) starts the back-fill.
- **Event type:** `pause_ended` is new. Migration 003 names only `pause_added`. The Main Lane should confirm this name when it writes FR13's Control.

## Switch-off SQL (stops the job again; no deploy needed)

```sql
INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by)
  SELECT 'cf.meridian-entities-enrich.expbf', strftime('%Y-%m-%dT%H:%M:%SZ','now'), '2099-01-01T00:00:00Z',
         '<packet>: back-fill switched off — <reason>', 'ops_lead:wrangler'
  WHERE NOT EXISTS (SELECT 1 FROM ops_job_pause
                    WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > strftime('%Y-%m-%dT%H:%M:%SZ','now'));
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'pause_added', NULL, '2099-01-01T00:00:00Z',
          '{"packet":"<packet>","reason":"<reason>"}', 'ops_lead:wrangler', 'system', 'Operations Lead',
          strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pause:cf.meridian-entities-enrich.expbf:<packet>');
```

The pause takes effect from the next run. The guard is read once, at the start of each run, so a run that is already in progress is not interrupted. Such a run is at most 3 batches, and each batch is one transaction.

## Boundaries kept

- **Files written:** only the allowed paths:
  - `App/Corporate Atlas/src/exp-backfill.js` (the one constant);
  - `App/Corporate Atlas/tests/exp-backfill.test.mjs`;
  - `App/Ops/migrations/registry-load-2026-11-20-expbf.sql` (new);
  - this report.
  - Wrangler's dry-run bundle and the SQLite check script went to the session scratchpad.
- **D1:**
  - The one SQL file was executed once: 4 rows, 14 row-writes.
  - Read-only statements: 3 verification SELECTs and 1 `EXPLAIN QUERY PLAN`.
  - No other Ops rows or tables were written, the pause row was not ended or edited, and no DDL was run.
- **Deploys:**
  - one `wrangler deploy` of `meridian-entities-enrich`;
  - no rollback was needed;
  - no toml, cron, secret, `.env*` or LaunchAgent changes;
  - no other Workers and no `docs/`.
- **Not touched:** `*_Status.json`, the board, the Tower, `transitions.jsonl`, logs, either LANE_OPENER file, Main Lane records, `13F Seed/gleif-seed.js`.
- **Tools and git:** no installs, no subagents, no tokens printed. One commit with explicit paths, pushed to `November-2026`; `ls-remote` was checked and no history was rewritten.
