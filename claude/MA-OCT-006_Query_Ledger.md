# MA-OCT-006 — D1 Query Ledger (live)

Kept live per Build Brief rev 2, condition 3: each query's plan, reads and writes are recorded on the day it runs. Every query is EXPLAINed first. The raw record is `~/MeridianAtlas-work/gleif-006/ledger.jsonl` (one line per execution, `meta.rows_read` / `meta.rows_written` from `wrangler d1 execute meridian-etf --remote --json`), and the JSON output of each run is in `~/MeridianAtlas-work/gleif-006/d1out/`. All queries go through `d1q.sh`, which refuses anything that is not `SELECT` / `EXPLAIN` / `WITH`, or that contains a write keyword.

**Budget:** stop and report at 200,000 reads. Hard stop at 250,000. 0 writes.

## Running totals

| Date (UTC) | Reads that day | Cumulative reads | Writes | Remaining to 200k |
|---|---|---|---|---|
| Mon 28 Sep | 160 | 160 | 0 | 199,840 |
| Tue 29 Sep | 79,918 | 80,078 | 0 | 119,922 |
| Wed 30 Sep | 6,855 | 86,933 | 0 | 113,067 |
| Thu 1 Oct | 5,367 | 92,300 | 0 | 107,700 |
| Fri 2 Oct (days 5–6) | 0 | 92,300 | 0 | 107,700 |
| **Mon 5 Oct (day 7, final)** | **34,938** | **127,238** | **0** | **72,762** |

## Mon 28 Sep 2026 (day 1). Session started 19:23 UTC, after enrich's 06:50 run

| # | Time (UTC) | Query (abridged) | Expected plan (spec §6.2) | Actual plan | Reads | Writes | Rows out |
|---|---|---|---|---|---|---|---|
| D0-explain | 19:26:23 | `EXPLAIN QUERY PLAN` of D0 | catalog | `SCAN sqlite_master` | 0 | 0 | 1 |
| **D0** | 19:26:37 | `SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN (7 tables)` | catalog, ~150 | `SCAN sqlite_master` | **155** | 0 | 36 |
| D1-explain | 19:26:49 | `EXPLAIN QUERY PLAN` of D1 | `SEARCH` ×5 | `SEARCH` on each of the 5 tables (max-rowid seek) | 0 | 0 | 11 |
| **D1** | 19:26:56 | `SELECT MAX(rowid)` for `entity_master`, `entity_enrichment_queue`, `entity_relationships`, `entity_exceptions`, `instrument_entity_map` | `SEARCH`, 5 | as expected | **5** | 0 | 1 |
| **D9** (EXPLAIN only) | 19:27:14 | Phase 1 lookup: `SELECT isin FROM fund_holdings_monthly WHERE UPPER(TRIM(security_name)) = UPPER(TRIM(?)) AND isin IS NOT NULL AND isin != '' LIMIT 1` | `SCAN fund_holdings_monthly` unless an expression index exists | `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)` | **0** | 0 | — |
| D2-explain | 19:27:26 | D2 keyset form: `… FROM entity_master WHERE entity_id > ? ORDER BY entity_id LIMIT 5000` | `SEARCH … INTEGER PRIMARY KEY` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid>?)` | 0 | 0 | — |
| D3-explain | 19:27:28 | `SELECT * FROM entity_enrichment_queue WHERE entity_id > ? ORDER BY entity_id LIMIT 5000` | `SEARCH … INTEGER PRIMARY KEY` | `SEARCH entity_enrichment_queue USING INTEGER PRIMARY KEY (rowid>?)` | 0 | 0 | — |
| D4-explain | 19:27:29 | `SELECT rowid,* FROM entity_relationships WHERE rowid > ? AND rowid <= ?` | `SEARCH … INTEGER PRIMARY KEY` | `SEARCH entity_relationships USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` | 0 | 0 | — |
| D5-explain | 19:27:30 | `SELECT * FROM entity_exceptions` | small-table SCAN | `SCAN entity_exceptions` | 0 | 0 | — |
| D6-explain | 19:27:31 | exact Phase 3 SELECT, `LIMIT 45` | `SEARCH USING INDEX idx_entity_master_phase3 (lei>?)` | as expected | 0 | 0 | — |
| D7-explain | 19:27:32 | exact Phase 1 SELECT, `LIMIT 100` | `SEARCH USING INDEX idx_enrich_queue_status` | `SEARCH … USING INDEX idx_enrich_queue_status (status=?)` | 0 | 0 | — |
| D8-explain | 19:27:33 | `SELECT key,value FROM holdings_pipeline_state WHERE key IN (…)` (placeholder keys; the final key list is fixed on day 2) | `SEARCH … sqlite_autoindex (key=?)` | `SEARCH … USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | 0 | 0 | — |
| D10-explain | 19:27:34 | `SELECT status, COUNT(*) FROM entity_enrichment_queue GROUP BY status` | `SCAN USING COVERING INDEX idx_enrich_queue_status` | as expected | 0 | 0 | — |

**Day-1 total: 160 reads, 0 writes.** No `SCAN entity_master`. No execution over 50k reads.

### Plan-relevant facts from D0 and D1 (these change later estimates, not the plans)

- **`entity_id` is sparse:** `MAX(entity_id)` is 463,722 for about 43.8k rows. The same holds for the queue, whose PK is `entity_id`. D2 and D3 will therefore use the keyset form `WHERE entity_id > :last ORDER BY entity_id LIMIT 5000` (plan verified above), not fixed 5k-id windows. Fixed windows would take about 93 executions, most of them near-empty. Reads are unchanged, about 1 per returned row.
- **`entity_relationships` has `MAX(rowid)` = 333.** The spec's D4 estimate of ≤40,000 falls to **≤333 reads**, a single execution.
- **`instrument_entity_map` has no `entity_id` index.** Its only index is the `instrument_key` PK autoindex. By the spec's own D11 rule ("otherwise skip"), **D11 is skipped**, and T2 falls back to "not reliable" unless the Main Lane approves an alternative. See Report 1.
- `entity_exceptions` `MAX(rowid)` = 9, which matches the spec.

## Tue 29 Sep 2026 (day 2). Preflight at 06:56 UTC; D1 queries from 07:05 UTC, after the 06:50 enrich run and before the 10:50 boost

**Tail 1 missed:** the session started at 06:56 UTC, after the 06:48 cut-off, so `wrangler tail` was not started. Tail 2 is on Wed 30 Sep.

**D8 key list (fixed today):** `hold_all_jobs`, `enrich_phase3_last_run_entities`, `enrich_phase3_last_run_subrequests`, `enrich_phase3_last_run_deferred`, `enrich_combined_last_invocation_subrequests`, `delta_last_run`, `delta_entities_updated`, `delta_inactive_flagged`, `writes_today_2026-09-29`, `writes_today_2026-09-28`.

| # | Time (UTC) | Query (abridged) | Actual plan | Executions | Reads | Writes | Rows out |
|---|---|---|---|---|---|---|---|
| D8-0929 | 07:05:21 | `SELECT key,value FROM holdings_pipeline_state WHERE key IN (10 keys above)` | `SEARCH … sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | 1 | 16 | 0 | 6 |
| D6-0929 | 07:05:34 | exact Phase 3 SELECT (`entities-enrich.js:275-289`), `LIMIT 45` | `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei>?)` | 1 | **5,003** (spec estimated ≤2,000; the index walk skips already-processed entries) | 0 | 45 |
| D7-0929 | 07:05:59 | exact Phase 1 SELECT (`:94-102`), `LIMIT 100` | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` | 1 | 1,487 (**under the 10k guard, so it may be repeated**) | 0 | 100 |
| D2-0929 | 07:06–07:08 | 21 spec columns (all exist per D0; none dropped) `FROM entity_master WHERE entity_id > :last ORDER BY entity_id LIMIT 5000` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid>?)` | 9 pages | 43,998 | 0 | 43,998 |
| D3-0929 | 07:08 | `SELECT * FROM entity_enrichment_queue WHERE entity_id > :last ORDER BY entity_id LIMIT 5000` | `SEARCH … INTEGER PRIMARY KEY (rowid>?)` | 6 pages | 29,071 | 0 | 29,071 |
| D4-0929 | 07:08 | `SELECT rowid,* FROM entity_relationships WHERE rowid > 0 ORDER BY rowid LIMIT 5000` (see note) | `SEARCH entity_relationships USING INTEGER PRIMARY KEY (rowid>?)` | 1 | 334 | 0 | 334 |
| D5-0929 | 07:08 | `SELECT * FROM entity_exceptions WHERE id > 0 ORDER BY id LIMIT 5000` (see note) | `SEARCH entity_exceptions USING INTEGER PRIMARY KEY (rowid>?)` | 1 | 9 | 0 | 9 |
| EXPLAINs | 07:05–07:09 | 10 × `EXPLAIN QUERY PLAN` (D8, D6, D7, D2–D5 as briefed, D4/D5 as run) | — | 10 | 0 | 0 | — |

**Day-2 total: 79,918 reads, 0 writes. Cumulative: 80,078 of 200k.** No `SCAN entity_master`. The largest single execution read 5,003 rows.

**Note on D4 and D5:** both were EXPLAINed in the briefed forms (`rowid > 0 AND rowid <= 333`; full-table `SCAN`), then run through the keyset helper in the forms above. The as-run forms were EXPLAINed straight afterwards at 0 reads; both are PK `SEARCH`. This mattered for D4: `entity_relationships` now holds **334** rows (one added since day 1), so the `<= 333` bound would have missed a row.

## Wed 30 Sep 2026 (day 3). Session started 05:53 UTC; tail 2 ran 05:53–07:05; D1 queries from 07:05 UTC, after the 06:50 enrich run and before the 10:50 boost

**Tail 2 captured** both the 06:00 (Phase 1) and 06:50 (Phase 2+3) invocations. See Evidence §11.1. No D1 reads.

**D8 key list (day 3):** as on day 2, but with `writes_today_2026-09-30` and `writes_today_2026-09-29`.

Runner: `WORK/run_day3.py`, through `d1q.sh`. It refuses before 07:05 UTC, EXPLAINs in exactly the as-run form, aborts on `SCAN entity_master` / `SCAN fund_holdings_monthly` or on a plan that lacks the expected index, stops at 200k cumulative, and aborts any execution over 50k.

| # | Time (UTC) | Query (abridged) | Actual plan | Executions | Reads | Writes | Rows out |
|---|---|---|---|---|---|---|---|
| D8-0930 | 07:05:09–15 | `SELECT key,value FROM holdings_pipeline_state WHERE key IN (10 keys)` | `SEARCH … sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | 1 (+1 EXPLAIN) | 15 | 0 | 5 |
| D6-0930 | 07:05:16 | exact Phase 3 SELECT (`entities-enrich.js:275-289`), `LIMIT 45` | `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei>?)` | 1 (+1 EXPLAIN) | **5,194** (index walk skips the ~5,129 processed entries below the head; grows about 44 per Phase 3 run) | 0 | 45 |
| D7-0930 | 07:05:17–18 | exact Phase 1 SELECT (`:94-102`), `LIMIT 100` | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` | 1 (+1 EXPLAIN) | 1,487 | 0 | 100 |
| **D7b-0930** (new, approved) | 07:05:54–07:07:28 | Phase 1's own lookup (`:111-116`): `SELECT isin FROM fund_holdings_monthly WHERE UPPER(TRIM(security_name)) = UPPER(TRIM(?)) AND isin IS NOT NULL AND isin != '' LIMIT 1`. 100 escaped names plus 10 unescaped retries. **ETF-domain table, read only.** | `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)` (EXPLAINed once) | **110** (+1 EXPLAIN) | **159** (cap 2,000; max single 42) | 0 | 10 (all from the unescaped retries) |

**Day-3 total: 6,855 reads, 0 writes, 117 executions (4 EXPLAIN + 113 queries). Cumulative: 86,933 of 200k (113,067 remaining).** No `SCAN entity_master`. The largest single execution read 5,194 rows.

## GLEIF API calls (budget ≤ 60 for the packet, ≤ 1 per second)

| Date (UTC) | Calls | Endpoint | Purpose | Running total |
|---|---|---|---|---|
| Mon 28 Sep, 19:23–19:24 | 2 | `goldencopy.gleif.org/api/v2/golden-copies/publishes/latest`; `mapping.gleif.org/api/v2/isin-lei/latest` | find the latest Golden Copy and LEI–ISIN files (E1); counted to be safe | 2 |
| Thu 1 Oct, 05:47–05:48 | 50 | `api.gleif.org/api/v1/lei-records/{lei}`, one per LEI, ≥ 1.1 s apart, no retries, 50/50 HTTP 200 | Step 4 freshness check (25 KI 22.43 + 25 T1, seed 20261001); log `WORK/day4/freshness_calls.jsonl` | **52** |

**8 calls remain.** File downloads (4 on day 1) are not API calls.

## Thu 1 Oct 2026 (day 4). Session opened 05:45 UTC; D1 queries only from 07:05 UTC, after the 06:50 enrich run and before the 10:50 boost

- Runner: `WORK/run_day4.py`, which is `run_day3.py` with D7 removed (ruling R8) and today's dates. It goes through `d1q.sh`, EXPLAINs in exactly the as-run form, refuses before 07:05, and has the same plan, 200k and 50k guards.
- **D8 key list (day 4):** as on day 2, with `writes_today_2026-10-01` and `writes_today_2026-09-30`.

| # | Time (UTC) | Query (abridged) | Actual plan | Executions | Reads | Writes | Rows out |
|---|---|---|---|---|---|---|---|
| D8-1001 | 07:05 | `SELECT key,value FROM holdings_pipeline_state WHERE key IN (10 keys)` | `SEARCH … sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | 1 (+1 EXPLAIN) | 15 | 0 | 5 |
| D6-1001 | 07:05 | exact Phase 3 SELECT (`entities-enrich.js:275-289`), `LIMIT 45` | `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei>?)` | 1 (+1 EXPLAIN) | 5,352 (expected about 5.3k; grows about 44 per Phase 3 run) | 0 | 45 |

**Day-4 total: 5,367 reads, 0 writes. Cumulative: 92,300 of 200k (107,700 remaining).** No `SCAN entity_master`. The largest single execution read 5,352 rows. D7 was not run (R8). The Steps 3–5 work is local (0 D1 reads). The GLEIF API calls are in the "GLEIF API calls" section above.

## Fri 2 Oct 2026 (day 5). Session 05:17–12:40 UTC. Local work only

**0 D1 reads, 0 D1 writes, 0 GLEIF API calls.**

- No D1 query was run, EXPLAINed or prepared.
- No `/run` call, no deploy, no git write.
- Work used only the DAY2 exports (29 Sep), the DAY3/DAY4 outputs and `gleif_006.db` (read-only, `mode=ro`).
- The boost runner and its logs were read only.

| Measure | Today | Cumulative |
|---|---|---|
| D1 reads | 0 | **92,300 of 200k** (107,700 remaining) |
| D1 writes | 0 | 0 |
| GLEIF API calls | 0 | **52 of 60** (8 remain, kept for the close-out) |

## Fri 2 Oct 2026 (day 6). Session from 17:15 UTC. Local work only (Report 3b and the DRAFT close-out)

**0 D1 reads, 0 API calls.** Also 0 D1 writes.

- No D1 query was run, EXPLAINed or prepared.
- No GLEIF API call was made.
- No `/run` call, no deploy, no git write (`git --no-optional-locks` reads only).
- Work used only the DAY2 exports (29 Sep), the DAY3–DAY5 outputs and `gleif_006.db` (read-only, `mode=ro`).
- The boost runner and its logs were read only.
- **Index list for the matrix write costs:** taken from the day-1 **D0** catalog output (`WORK/d1out/D0.json`), with no new catalog query.

| Measure | Today | Cumulative |
|---|---|---|
| D1 reads | 0 | **92,300 of 200k** (107,700 remaining) |
| D1 writes | 0 | 0 |
| GLEIF API calls | 0 | **52 of 60** (8 remain) |

**Still to run:** **D10** (queue trend snapshot, `SELECT status, COUNT(*) FROM entity_enrichment_queue GROUP BY status`; plan `SCAN … USING COVERING INDEX idx_enrich_queue_status`, EXPLAINed on day 1; about 29k reads). It runs on a weekday after 07:05 UTC, never during the Monday 04:00 UTC seed. The earliest slot is Mon 5 Oct after 07:05 UTC. The projected cumulative total after D10 is about 121k of 200k.

## Mon 5 Oct 2026 (day 7, final snapshot). Session opened 19:42 UTC, after the 04:00 seed and the 06:50 enrich run

- Runner: `WORK/run_day7.py`, which imports `run_day4.py`'s guarded `q()` and goes through `d1q.sh`.
  - It EXPLAINs each query in exactly the as-run form.
  - It refuses before 07:05 UTC, stops at 200k cumulative, and aborts above 50k per execution or on `SCAN entity_master` / `SCAN fund_holdings_monthly`.
- **D8 key list (day 7):** the day-4 keys with dates `2026-10-05` and `2026-10-04`, **plus `etf_offset` and `last_run_status`** (Main Lane addition, ruling D7-4).
  - Key name source: `App/ETF Refresh/src/holdings-pipeline.js:107` (`SELECT value FROM holdings_pipeline_state WHERE key = 'etf_offset'`), written at `:174`/`:178`.
  - `last_run_status` is written at `:175`/`:179`.
  - MA-OCT-000 had recorded the key as `etf_offset=31`.

| # | Time (UTC) | Query (abridged) | Actual plan | Executions | Reads | Writes | Rows out |
|---|---|---|---|---|---|---|---|
| D10-1005-explain | 19:44:38 | `EXPLAIN QUERY PLAN` of D10 | **failed**: Cloudflare API code 7403 through `npx --prefix`-fetched wrangler 4.147.0 (D7-5) | 1 | 0 | 0 | — |
| D10-1005-explain-r2 | 19:44:59 | same, retried once | `SCAN entity_enrichment_queue USING COVERING INDEX idx_enrich_queue_status` | 1 | 0 | 0 | 1 |
| D10-1005-explain | 19:45:03 | same, in the runner | as above | 1 | 0 | 0 | 1 |
| **D10-1005** | 19:45:04 | `SELECT status, COUNT(*) AS n FROM entity_enrichment_queue GROUP BY status` | `SCAN … USING COVERING INDEX idx_enrich_queue_status` (spec-expected) | 1 | **29,108** | 0 | 4 |
| D8-1005-explain | 19:45:05 | `EXPLAIN QUERY PLAN` of D8 | `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | 1 | 0 | 0 | 1 |
| **D8-1005** | 19:45:06 | `SELECT key, value FROM holdings_pipeline_state WHERE key IN (12 keys)` | as above | 1 | **21** | 0 | 9 |
| D6-1005-explain | 19:45:07 | `EXPLAIN QUERY PLAN` of the exact Phase 3 SELECT | `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei>?)` | 1 | 0 | 0 | 1 |
| **D6-1005** | 19:45:08 | exact Phase 3 SELECT (`entities-enrich.js:275-289`), `LIMIT 45` | as above | 1 | **5,809** | 0 | 45 |

**Day-7 total: 34,938 reads, 0 writes** (4 EXPLAINs and 3 queries). The largest single execution read 29,108 rows. No `SCAN entity_master`. The D8 query returned 9 rows: the 3 `delta_*` keys are absent (H10).

## Final totals (MA-OCT-006, 28 Sep – 5 Oct 2026)

| Measure | Total | Limit | Status |
|---|---|---|---|
| D1 reads | **127,238** | stop at 200k; hard stop 250k | within budget (63.6% of 200k) |
| D1 writes | **0** | 0 | met |
| Largest single execution | 29,108 (D10-1005) | 50k | met |
| `SCAN entity_master` | **none** | none | met |
| EXPLAIN before every query | yes, in the as-run form. D4/D5 on day 2 were also EXPLAINed in the briefed form first. | — | met |
| GLEIF API calls | **52** | 60 | met (8 unused) |
| Golden Copy file downloads (Q1, not API calls) | 4 | — | — |

The per-execution record is `WORK/ledger.jsonl`, and its sum agrees with the totals above (127,238 reads, 0 writes).
