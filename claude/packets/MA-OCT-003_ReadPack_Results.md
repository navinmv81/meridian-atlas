# MA-OCT-003 — Read pack results (Appendix A, R1–R5)

**Run by:** LANE-1-ENG, Engineering Lead, under MA-OCT-OPS.T12 step 5. **When:** Thu 15 Oct 2026, 07:11 UTC, which is outside every FREEZES.json window. **Source:** `claude/MA-OCT-003_Spec.md` SHA-256 `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` (re-hashed before running), Appendix A.
**Tool:** `/usr/local/bin/wrangler` 4.96.0, `d1 execute meridian-etf --remote --json`. EXPLAIN QUERY PLAN ran first for all 5. Then 4 statements ran; R4 is plan only.
**Budget:** **50 rows read, 0 written** (EXPLAINs read 0), against ≤ 5k. No `decided_by` values were selected; R1 counts them only.

## Plans (EXPLAIN QUERY PLAN, 0 reads each)

| # | Expected | Actual | Verdict |
|---|---|---|---|
| R1 | `SCAN entity_exceptions` (or a covering index) + temp B-tree; bounded ≈ 9 rows | `SCAN entity_exceptions USING INDEX idx_entity_exceptions_type` + `USE TEMP B-TREE FOR GROUP BY` | **Equivalent (in-lane ruling R-T12-1):** a full scan of the same ≈ 9-row table, ordered by the type index, which does not cover the query. The read bound is unchanged, and the actual count was 18 against ≤ 50. |
| R2 | `SCAN entity_exceptions`, bounded | `SCAN entity_exceptions` | Match |
| R3 | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` | same | Match |
| R4 | `SEARCH … idx_enrich_queue_status` + `USE TEMP B-TREE FOR GROUP BY` | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` + `USE TEMP B-TREE FOR GROUP BY` | Match. **Not executed.** |
| R5 | `SCAN ops_exception` (≤ 50 rows) or queue index + temp B-tree | `SCAN ops_exception` + `USE TEMP B-TREE FOR GROUP BY` | Match |

## R1: `entity_exceptions` by type and decision (rows_read 18)

| exception_type | decision | n | min_id | max_id | decided |
|---|---|---|---|---|---|
| bad_relationship_edge | accepted_no_fix | 4 | 4 | 7 | 4 |
| entity_merge | do_not_merge | 3 | 1 | 3 | 3 |
| isin_duplicate | pending | 2 | 8 | 9 | 0 |

**N = 9, not more than 9.** The M1 sizing holds, and the §11.1 abort rule is not triggered.

## R2: rows added after 015c, non-DQ types, malformed JSON (rows_read 18)

**0 rows.** No row has `id > 9`, a type outside the three DQ types, or invalid `source_ref` JSON. The fail-closed guard has nothing to catch, and M1 will not break on JSON.

## R3: stuck `in_progress` enrichment rows (rows_read 2)

| n | oldest last_attempt |
|---|---|
| 1 | 2026-06-11 22:04:02 |

**006's single stuck row is still there**, last attempted on 11 Jun. E2's plan is index-backed and costs 2 reads.

## R4: pending by lookup_method (plan only, 0 reads)

The plan is an index SEARCH on `status='pending'`, followed by a temp B-tree GROUP BY. It reads every pending row (about 26.5k at MA-OCT-000), which confirms that E3 is not cheap to automate (§9.3).

## R5: `ops_exception` case mix (rows_read 12)

| exception_type | status | severity | n | first opened |
|---|---|---|---|---|
| job_failed | open | sev3 | 3 | 2026-10-13T16:36:26.660Z |
| job_missed | open | sev3 | 3 | 2026-10-13T16:36:26.660Z |

**Today's mix is the 6 open sev3 cases from 13 Oct, and nothing has been raised since.** This is the baseline for AC-9 and AC-11.
