# MA-OCT-002 §9 EXPLAIN Pack: Results

```text
ISSUED BY:    Program Orchestrator (Main Lane)
EXECUTED BY:  Engineering Lead (local Claude Code), read-only D1
REVIEWED BY:  Operations Lead
APPROVED BY:  Founder
PACKET:       MA-OCT-002 §9 EXPLAIN pack (spec evidence; no build)
RUN:          2026-10-07 19:29–19:31 UTC (Wednesday; outside 04:00–07:05 UTC)
```

## Preflight

| Check | Result |
|---|---|
| `ls .git/*.lock` | none |
| Branch | `October-2026` @ `16918e0` (no git writes) |
| UTC time | 19:29:39Z |
| wrangler | **`/usr/local/bin/wrangler` 4.96.0**, called by absolute path for every statement, never through `npx`. `whoami`: OAuth, account `ea36070477560935a68ad9110a2fd40b`, `d1 (write)` scope |
| Method | `wrangler d1 execute meridian-etf --remote --json --command`, one statement at a time, through a runner that refuses anything but SELECT/EXPLAIN. Every plan (`EXPLAIN QUERY PLAN`, in the executed form) was taken **before** any statement ran. |

## Plans and reads

| # | Expected | Live plan (verbatim) | Plan check | EXPLAIN rows_read | Exec rows_read | rows_written |
|---|---|---|---|---|---|---|
| P1 | SCAN sqlite_master (allowed) | `SCAN sqlite_master` | ✅ | 0 | 147 | 0 |
| P2 | SCAN ops_job_registry (allowed) | `SCAN ops_job_registry` | ✅ | 0 | 2 | 0 |
| P3 | SEARCH idx_ops_job_run_job_type_at or idx_ops_job_run_job_at (job_id=?) | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_type_at (job_id=?)<br>USE TEMP B-TREE FOR GROUP BY` | ✅ (temp B-tree for GROUP BY; the stop rule covers P4/P6 only) | 0 | 38 | 0 |
| P4 | SEARCH idx_ops_job_run_job_at (job_id=? AND started_at>?), no temp B-tree | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=? AND started_at>?)` | ✅ | 0 | 19 | 0 |
| P5 | SEARCH sqlite_autoindex_ops_exception_* (dedupe_key=?) | `SEARCH ops_exception USING INDEX sqlite_autoindex_ops_exception_2 (dedupe_key=?)` | ✅ | 0 | 0 | 0 |
| P6 | SEARCH idx_ops_exception_job (job_id=?), no temp B-tree | `SEARCH ops_exception USING INDEX idx_ops_exception_job (job_id=?)` | ✅ | 0 | 0 | 0 |
| P7a | SCAN holdings_pipeline_state (allowed) | `SCAN holdings_pipeline_state USING COVERING INDEX sqlite_autoindex_holdings_pipeline_state_1` | ✅ | 0 | 62 | 0 |
| P7 | SCAN holdings_pipeline_state (allowed) | `SCAN holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1` | ✅ | 0 | 62 | 0 |
| P8 | SCAN of the three small tables (allowed) | `COMPOUND QUERY<br>LEFT-MOST SUBQUERY<br>SCAN sprintboarditems USING COVERING INDEX idx_sprintboarditems_lane<br>UNION ALL<br>SCAN releaseledger USING COVERING INDEX idx_releaseledger_status<br>UNION ALL<br>SCAN operationalevents USING COVERING INDEX idx_operationalevents_type` | ✅ | 0 | 44 | 0 |

**No STOP condition was hit.** Every SCAN is one the brief allows, and P4 and P6 have no temp B-tree.

## Results

### P1: Ops and `holdings_pipeline_state` schema objects (30 rows)

`holdings_pipeline_state`, `sqlite_autoindex_holdings_pipeline_state_1`, `ops_job_registry`, `sqlite_autoindex_ops_job_registry_1`, `idx_ops_job_registry_emitter`, `ops_job_run`, `sqlite_autoindex_ops_job_run_1`, `idx_ops_job_run_job_type_at`, `idx_ops_job_run_job_at`, `idx_ops_job_run_received`, `trg_ops_job_run_no_update`, `ops_exception`, `sqlite_autoindex_ops_exception_1`, `sqlite_autoindex_ops_exception_2`, `sqlite_autoindex_ops_exception_3`, `idx_ops_exception_queue`, `idx_ops_exception_job`, `idx_ops_exception_object`, `ops_data_quality_ticket`, `sqlite_autoindex_ops_data_quality_ticket_1`, `sqlite_autoindex_ops_data_quality_ticket_2`, `sqlite_autoindex_ops_data_quality_ticket_3`, `idx_ops_dq_queue`, `idx_ops_dq_object`, `idx_ops_dq_type`, `ops_case_event`, `sqlite_autoindex_ops_case_event_1`, `idx_ops_case_event_subject`, `trg_ops_case_event_no_update`, `trg_ops_case_event_no_delete`

### P2: `ops_job_registry` (2 rows; expected 2)

| job_id | emitter_id | ingest_enabled | status | expected_max_duration_s |
|---|---|---|---|---|
| `ops.ingest` | None | 1 | active | None |
| `local.entities-enrich-boost` | boost-local | 1 | active | 120 |

### P3: `ops_job_run` for `local.entities-enrich-boost`, by event_type and end_only

| event_type | end_only | count |
|---|---|---|
| failed | 1 | 1 |
| partial | 1 | 1 |
| skipped | 1 | 1 |
| start | 0 | 8 |
| success | 0 | 8 |
| **total rows** | | **19** |

### P4: rows with `started_at >= 2026-09-28` (19 rows), ordered by started_at

| started_at | phase | event_type | run_id | ended_at | detail.slot | detail.out_of_window | detail.http_status |
|---|---|---|---|---|---|---|---|
| 2026-10-01T05:52:50.492Z | start | start | `28d0dc53…` |  |  |  |  |
| 2026-10-01T05:52:50.492Z | end | success | `28d0dc53…` | 2026-10-01T05:52:50.757Z |  |  |  |
| 2026-10-01T05:52:50.981Z | end | skipped | `add5bf4a…` | 2026-10-01T05:52:50.981Z |  |  |  |
| 2026-10-01T05:52:51.089Z | end | partial | `4e0e7a70…` | 2026-10-01T05:52:51.089Z |  |  |  |
| 2026-10-02T16:50:01.789Z | start | start | `101a6ae5…` |  | 2026-10-02T16:50Z | False |  |
| 2026-10-02T16:50:01.789Z | end | success | `101a6ae5…` | 2026-10-02T16:50:05.135Z | 2026-10-02T16:50Z | False | 200 |
| 2026-10-03T10:55:51.021Z | end | failed | `defd7823…` | 2026-10-03T10:55:53.424Z | 2026-10-03T10:50Z | False |  |
| 2026-10-03T16:52:56.204Z | start | start | `207c93ae…` |  | 2026-10-03T16:50Z | False |  |
| 2026-10-03T16:52:56.204Z | end | success | `207c93ae…` | 2026-10-03T16:53:00.108Z | 2026-10-03T16:50Z | False | 200 |
| 2026-10-04T11:02:31.511Z | start | start | `9c6bc62b…` |  | 2026-10-04T10:50Z | True |  |
| 2026-10-04T11:02:31.511Z | end | success | `9c6bc62b…` | 2026-10-04T11:02:34.987Z | 2026-10-04T10:50Z | True | 200 |
| 2026-10-05T11:02:48.956Z | start | start | `0c460ddb…` |  | 2026-10-05T10:50Z | True |  |
| 2026-10-05T11:02:48.956Z | end | success | `0c460ddb…` | 2026-10-05T11:02:56.891Z | 2026-10-05T10:50Z | True | 200 |
| 2026-10-06T10:55:15.459Z | start | start | `8ee2580b…` |  | 2026-10-06T10:50Z | False |  |
| 2026-10-06T10:55:15.459Z | end | success | `8ee2580b…` | 2026-10-06T10:55:19.444Z | 2026-10-06T10:50Z | False | 200 |
| 2026-10-06T16:50:04.762Z | start | start | `8ff9e8cb…` |  | 2026-10-06T16:50Z | False |  |
| 2026-10-06T16:50:04.762Z | end | success | `8ff9e8cb…` | 2026-10-06T16:50:08.143Z | 2026-10-06T16:50Z | False | 200 |
| 2026-10-07T16:53:31.832Z | start | start | `157cf734…` |  | 2026-10-07T16:50Z | False |  |
| 2026-10-07T16:53:31.832Z | end | success | `157cf734…` | 2026-10-07T16:53:35.369Z | 2026-10-07T16:50Z | False | 200 |

The three rows at 2026-10-01T05:52 (run_ids `28d0dc53…`, `add5bf4a…`, `4e0e7a70…`; **4 rows**) are the MA-OCT-001 AC6 remote contract-test events. They are tagged `trigger='contract-test'` in the table, but P4 does not select `trigger`, so this pack doesn't show the tag. The brief expected **6** contract-test rows; P4 and P3 show **4**: start, success, end-only skipped and end-only partial.

**Stated facts, for the Operations Lead to check (not interpreted):**

- Pilot terminal events (rows with a `detail.slot`), all after 1 Oct 19:08 UTC: **8**. Slots: 2026-10-02T16:50Z, 2026-10-03T10:50Z, 2026-10-03T16:50Z, 2026-10-04T10:50Z, 2026-10-05T10:50Z, 2026-10-06T10:50Z, 2026-10-06T16:50Z, 2026-10-07T16:50Z.
- Terminal events with `out_of_window = true`: **2**. All have event_type `success`: 2026-10-04T11:02:31.511Z (slot 2026-10-04T10:50Z), 2026-10-05T11:02:48.956Z (slot 2026-10-05T10:50Z).
- Slots since 2 Oct 10:50 with no terminal row in `ops_job_run`: 2026-10-02T10:50Z, 2026-10-04T16:50Z, 2026-10-05T16:50Z, 2026-10-07T10:50Z. This is derived from the 10:50/16:50 UTC schedule only. Whether each slot fired is for the boost run log, which this pack does not read.

### P5: `ops_exception` by dedupe_key: 0 rows

### P6: `ops_exception` for the boost job: 0 rows

### P7a / P7: `holdings_pipeline_state`

P7a count: **62** (≤ 500, so P7 ran). Values over 80 chars are not returned by the query. Any value matching `[A-Za-z0-9_-]{20,}` is shown as «masked». Key names are unmasked.

| key | len | short_value (masked) |
|---|---|---|
| `enrich_combined_last_invocation_subrequests` | 2 | 44 |
| `enrich_phase3_last_run_deferred` | 1 | 1 |
| `enrich_phase3_last_run_entities` | 2 | 44 |
| `enrich_phase3_last_run_subrequests` | 2 | 44 |
| `etf_offset` | 2 | 71 |
| `etfs_processed` | 2 | 20 |
| `financialfact_backfill_cumulative_logical_rows` | 5 | 37103 |
| `financialfact_backfill_cumulative_real_writes` | 6 | 105026 |
| `financialfact_backfill_offset` | 4 | 2605 |
| `financialfact_backfill_started_at` | 24 | 2026-08-07T21:47:42.039Z |
| `hold_all_jobs` | 5 | false |
| `last_full_run` | 24 | 2026-10-04T04:00:44.799Z |
| `last_run_status` | 24 | running:71/237:partial:0 |
| `offset_AVEM_2026-05` | 4 | 3500 |
| `writes_today_2026-06-07` | 4 | 6720 |
| `writes_today_2026-06-08` | 4 | 5334 |
| `writes_today_2026-06-09` | 4 | 4805 |
| `writes_today_2026-06-10` | 4 | 7920 |
| `writes_today_2026-06-11` | 4 | 6397 |
| `writes_today_2026-06-12` | 4 | 7757 |
| `writes_today_2026-06-13` | 4 | 4918 |
| `writes_today_2026-06-15` | 5 | 21108 |
| `writes_today_2026-06-16` | 5 | 80577 |
| `writes_today_2026-06-17` | 5 | 62024 |
| `writes_today_2026-06-18` | 5 | 44818 |
| `writes_today_2026-06-19` | 5 | 80584 |
| `writes_today_2026-06-20` | 5 | 80366 |
| `writes_today_2026-06-21` | 5 | 36789 |
| `writes_today_2026-06-22` | 5 | 23398 |
| `writes_today_2026-06-23` | 5 | 13314 |
| `writes_today_2026-06-24` | 5 | 10073 |
| `writes_today_2026-06-25` | 5 | 15042 |
| `writes_today_2026-06-26` | 5 | 14621 |
| `writes_today_2026-06-27` | 5 | 16357 |
| `writes_today_2026-06-28` | 5 | 22721 |
| `writes_today_2026-06-29` | 5 | 10805 |
| `writes_today_2026-06-30` | 5 | 12371 |
| `writes_today_2026-07-01` | 4 | 9698 |
| `writes_today_2026-07-02` | 4 | 4728 |
| `writes_today_2026-07-03` | 4 | 2193 |
| `writes_today_2026-07-13` | 4 | 3406 |
| `writes_today_2026-07-14` | 4 | 4908 |
| `writes_today_2026-07-15` | 4 | 2821 |
| `writes_today_2026-07-24` | 4 | 7022 |
| `writes_today_2026-07-25` | 5 | 93412 |
| `writes_today_2026-07-26` | 6 | 104694 |
| `writes_today_2026-07-27` | 5 | 77206 |
| `writes_today_2026-07-28` | 6 | 107693 |
| `writes_today_2026-08-02` | 5 | 28106 |
| `writes_today_2026-08-05` | 2 | 24 |
| `writes_today_2026-08-09` | 5 | 60304 |
| `writes_today_2026-08-16` | 5 | 74778 |
| `writes_today_2026-08-23` | 5 | 98651 |
| `writes_today_2026-08-30` | 5 | 81454 |
| `writes_today_2026-09-06` | 5 | 61715 |
| `writes_today_2026-09-09` | 5 | 57353 |
| `writes_today_2026-09-13` | 5 | 54657 |
| `writes_today_2026-09-20` | 5 | 83638 |
| `writes_today_2026-09-27` | 5 | 70672 |
| `writes_today_2026-09-28` | 5 | 34331 |
| `writes_today_2026-10-04` | 5 | 36434 |
| `writes_today_2026-10-05` | 5 | 33097 |

### P8: Control-table row counts

| table | rows |
|---|---|
| sprintboarditems | 19 |
| releaseledger | 12 |
| operationalevents | 13 |

### HTTP: `GET /api/ops/cf/d1-today` (no D1 read; fetched 19:30:56Z, after the pack)

```json
{"ok": true, "date": "2026-10-07", "readQueries": 341, "writeQueries": 189, "rowsRead": 94322, "rowsWritten": 390, "daily_cap": 100000, "pct_of_cap": 0.4}
```

## Totals

| | Value |
|---|---|
| Executions | 18 (9 EXPLAIN + 9 statements) |
| Rows read | **374** (budget 5,000; expected about 600) |
| Rows written | **0** |
| Largest single execution | P1: 147 rows |
| wrangler | `/usr/local/bin/wrangler` 4.96.0 |
| STOPs | none |
| Deviations | None from the expected plans. Observed: 4 contract-test rows against the 6 the brief expected (P3/P4). P3 uses a temp B-tree for GROUP BY, which the stop rule allows. |
