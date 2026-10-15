# MA-OCT-007 Appendix A: Results (A.1, Thu 8 Oct 2026). STOPPED

Spec rev 1.2 `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703`.
wrangler `/usr/local/bin/wrangler` 4.96.0 by absolute path. Run 19:47 UTC. Read-only. **0 writes.**

| Time (UTC) | # | Plan (verbatim) | rows_read | rows_written | Result |
|---|---|---|---|---|---|
| 19:47:22 | Q1+Q2 plan | SCAN instrument_entity_map / USE TEMP B-TREE FOR GROUP BY / USE TEMP B-TREE FOR count(DISTINCT) | 0 | 0 | as expected |
| 19:47:25 | Q3 plan | SCAN instrument_entity_map / USE TEMP B-TREE FOR GROUP BY / USE TEMP B-TREE FOR ORDER BY | 0 | 0 | as expected |
| 19:47:26 | Q4 plan | SCAN entity_isin_map USING COVERING INDEX idx_entity_isin_map_entity | 0 | 0 | as expected |
| 19:47:26 | Q6 plan | SEARCH entity_isin_map USING COVERING INDEX idx_entity_isin_map_entity (entity_id=?) | 0 | 0 | as expected |
| 19:47:27 | Q5 plan | SCAN entity_isin_map USING INDEX idx_entity_isin_map_isin / USE TEMP B-TREE FOR count(DISTINCT) / USE TEMP B-TREE FOR ORDER BY | 0 | 0 | **not covering, so it must run split** |
| 19:47:37 | Q1+Q2 | — | **65,538** | 0 | ⚠️ **over the 50k ceiling** (est. ≈ 32.8k) |
| 19:47:38 | Q3 | — | **79,613** | 0 | ⚠️ **over the 50k ceiling** (est. ≈ 32.8k) |
| 19:47:38 | Q4 | — | 37,151 | 0 | ok |
| 19:47:39 | Q6 | — | 0 | 0 | ok |
| — | Q5 | — | — | — | **NOT RUN (stopped)** |

**Totals:** 9 executions, **182,302 rows read**, 0 written.

**STOP cause.** D1 `rows_read` also counts rows passing through the temp B-trees (GROUP BY, DISTINCT and ORDER BY). As a result, grouped scans read about 2–2.4 × the table size, not 1 ×. Q1+Q2 and Q3 each exceeded 50k in a single execution. The pack's estimates, and the Engineering Lead's check, assumed 1 × N.

## Results

- **Q1+Q2** (instrument_entity_map by source / confidence):

  | source | confidence | n | distinct entities |
  |---|---|---|---|
  | isin_tier1 | 100 | 18,563 | 6,056 |
  | cusip_tier1 | 90 | 3,751 | 1,508 |
  | openfigi_tier1 | 70 | 8,806 | 6,453 |
  | heuristic | 75 | 1,649 | 1,061 |

  **M = 32,769**, which equals S1 (no deletions since August).
- **Q3** (top 20 entity_ids by mapped instruments): 28088 871, 225 413, 28090 130, 2550 112, 100029 105, 14520 103, 28895 97, 1725 97, 1505 85, 28091 84, 1636 78, 14289 76, 2651 70, 1666 70, 1642 69, 3334 68, 3330 68, 14523 67, 28852 65, 28007 64. Worst case *n* = **871**.
- **Q4:** `entity_isin_map` has **37,151** rows exactly (S2's upper bound was 37,154).
- **Q6:** **0** rows with `entity_id IS NULL`, so `lei_only` = 0.

## Re-sizing needed before Q5 (A.1) and A.2

At about 2–2.4 × rows per grouped or sorted statement:
- **Q5** ranges must hold **≤ ~15k rows** (not 22.5k).
- **Q7 / Q8** (no temp B-tree) are expected near the pack's estimates, but their 22.5k range widths should be re-checked against a first range's actual `rows_read` before the rest run.

The Main Lane needs to rule before anything more runs.

---

# Fri 9 Oct 2026: A.1 completion (Q5) and A.2. COMPLETE

Main Lane rulings applied (relay `LANE-1-ENG_NEXT.md`, 9 Oct):
- the 8 Oct over-ceiling reads are accepted as a recorded deviation;
- standing rule: GROUP BY / DISTINCT / ORDER BY with no covering index is estimated at 2.5 × N and split to ≤ 45k;
- Q5 runs in ranges of ≈ 15k, each sized first with an indexed `COUNT(*)`;
- Q7 and Q8 run their first range alone, then the rest are sized from its actual `rows_read`.

Run 15:35–15:37 UTC (outside 04:00–07:05). `/usr/local/bin/wrangler` 4.96.0 by absolute path. **0 writes.** Every statement was EXPLAINed first. No plan deviated from the pack.

## Q5 sizing probes (covering index; ≈ 1 × rows in range)

Plan: `SEARCH entity_isin_map USING COVERING INDEX idx_entity_isin_map_isin (isin>? AND isin<?)`.

| ISIN range | rows | rows_read |
|---|---|---|
| ['', 'D') | 1,279 | 1,280 |
| ['D', 'J') | 9,984 | 9,985 |
| ['J', 'US') | 8,593 | 8,594 |
| ['US', 'UT') | 17,194 → split | 17,195 |
| ['US', 'US5') | 9,246 | 9,247 |
| ['UT', '~') | 101 | 101 |

The five base ranges total **37,151**, which equals Q4 exactly. Final Q5 ranges, each ≤ 15k rows: ['', 'J') 11,263 · ['J', 'US') 8,593 · ['US', 'US5') 9,246 · ['US5', 'UT') 7,948 · ['UT', '~') 101.

## Q5: ambiguous ISINs (split form)

Plan, every range: `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin>? AND isin<?)` / `USE TEMP B-TREE FOR count(DISTINCT)` / `USE TEMP B-TREE FOR ORDER BY`. As expected for the split form: not covering, with temp B-trees.

| Range | rows_read | ISINs with > 1 entity |
|---|---|---|
| ['', 'J') | 11,276 | 12 |
| ['J', 'US') | 8,607 | 13 |
| ['US', 'US5') | 9,254 | 7 |
| ['US5', 'UT') | 7,954 | 5 |
| ['UT', '~') | 102 | 0 |
| **Total** | **37,193** | **37** |

No range hit `LIMIT 50`, so the list is complete. Every ambiguous ISIN maps to exactly **2** entities (rows_ = 2, ents = 2). This is KI 22.17, and it picks UAT step 6.

The 37 ISINs: AU000000CMW8, CA46431R1029, DE000A2H7N08, DE000A2JF7A2, DE000A42ERT3, IE0004ZFNTZ6, IE0009D15VO0, IE000I50V6C7, IE000SKTEI24, IE000TG7T8V7, IE000TGK2UK9, IE00BF92LR56, LU0757359368, LU0757360457, LU0757360531, LU0757360614, LU0757360960, LU0864709349, LU0864710354, LU0864714000, LU0864714422, LU1011997381, LU1856130205, LU2183939003, LU2381585913, US0321084339, US0321084826, US29287L1061, US46138K1034, US46436E3201, US46438G3728, US49446R1095, US69374H1547, US9219378190, US9219464065, US92206C1027, US92206C6232.

**Observation:** on these grouped queries D1 read ≈ 1.0 × N, not the 2–2.4 × N seen in Q1+Q2 and Q3 on 8 Oct. The 2.5 × N rule held with margin.

## A.2

Plans, all as expected:
- **Q7:** `SEARCH iem USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` / `CORRELATED SCALAR SUBQUERY 1` / `SEARCH em USING INTEGER PRIMARY KEY (rowid=?)`.
- **Q8:** the same shape on `eim`.
- **Q9:** `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)`.

| # | Range | rows_read | Result |
|---|---|---|---|
| Q7 | (0, 8193] (first, run alone) | 16,387 | 0 |
| Q7 | (8193, 16385] | 16,385 | 0 |
| Q7 | (16385, 24577] | 16,385 | 0 |
| Q7 | (24577, 32769] | 16,384 | 0 |
| Q8 | (0, 18577] (first, run alone) | 37,155 | 0 |
| Q8 | (18577, 37154] | 37,148 | 0 |
| Q9 | ids 25782, 1818, 26410, 25623, 25751 | 10 | 0 rows |

- **Q7:** 0 dangling `instrument_entity_map` → `entity_master` references (all 32,769 rowids).
- **Q8:** 0 dangling `entity_isin_map` → `entity_master` references (all 37,154 rowids; `entity_id IS NOT NULL`).
- **Q9:** all 5 sample MA-SEP-007 losers are absent from `entity_master`, as expected (UAT step 11, AC6).
- The first-range actuals were ≈ 2.0 reads per rowid, so the remaining ranges kept their planned widths.

**Process note.** One batch of the three remaining Q7 ranges was first sent with malformed bounds: a zsh word-splitting bug in my wrapper produced `rowid <=  AND …`. D1 rejected all 6 statements as syntax errors with **0 rows read**. They were dropped from the ledger and re-run correctly. No data effect.

## Totals, Fri 9 Oct

| | Value |
|---|---|
| Executions | 31 (excluding the 6 rejected malformed statements, which read 0) |
| Rows read | **223,449** (≤ 1M/day) |
| Rows written | **0** |
| Largest single execution | Q8 (0, 18577]: **37,155** (≤ 45k) |
| Account `d1-today` after the run | rowsRead 178,580 *(analytics lag; the ledger figure is from per-statement meta)*, rowsWritten 388 (0.4% of cap) |

## Appendix A: complete

| Part | Status |
|---|---|
| A.0 | ✅ 7 Oct (*R*ᵢ = 32,769; *R*ₑ = 37,154) |
| A.1 | ✅ 8 Oct (Q1–Q4, Q6) and 9 Oct (Q5) |
| A.2 | ✅ 9 Oct |
| A.3 | ✅ 7 Oct for P1–P5 and P9. P6, P6′ and P7 wait for the 13 Oct index; P8 for 013; P10 for 008 |

**Appendix A reads in all:** 7 Oct about 150 + 8 Oct 182,302 + 9 Oct 223,449 ≈ **406k**, with **0 writes**.
