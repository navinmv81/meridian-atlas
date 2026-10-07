# MA-OCT-006 — Close-out Summary

**Status: Final — submitted for Operations Lead review.**

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Operations Lead (close-out review, Sat 10 Oct)
APPROVED BY:  Founder (gate Mon 12 Oct: 006 close and MA-OCT-011 GO / NO-GO / DEFER)
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Close-out
```

- **Executed:** Mon 28 Sep – Mon 5 Oct 2026, 7 execution days.
- **Drafted:** Fri 2 Oct (D6-2). **Finalised:** Mon 5 Oct, after the D10 snapshot and the final re-sync.
- **Data basis:**
  - the D2–D5 exports of Tue 29 Sep;
  - Golden Copy 2026-09-28 16:00 UTC (`gleif_006.db`);
  - the D10/D8/D6 trend snapshot of Mon 5 Oct 19:45 UTC;
  - the classification of record, the **day-7 re-sync** (run 2 plus D6-1, D6-4 and D6-5).
- **Companion files** (manifest in §10): Evidence (§1–§16), Query Ledger, Remediation Matrix, classification CSV and sample-adjudication CSV.

## 1. Headline findings

1. **F4 is explained.** The enrichment Worker reports success while the queue makes no progress, for three reasons:
   - The `name_search` queue rows (26,083 on 29 Sep) have **no consumer anywhere in the code** (H1).
   - Phase 1 re-reads the same 100 rows every day: it has no `ORDER BY`, no miss marker, and 80 of the 100 names are HTML-escaped (H2).
   - Phase 2 has been dead since 31 Aug, because `failed` rows are never re-selected (H3).

   **On 5 Oct, no queue row had changed status since MA-OCT-000.** The queue only grows: 29,108 rows, 26,717 pending (D10).
2. **Phase 3 progresses, but slowly and mostly with a generic marker.**
   - It advances 44 entities per successful run. That is not a stall (H4 refuted as stated).
   - It mostly writes the generic `NO_LINK_DECLARED` marker (H6).
   - From 1 to 5 Oct it averaged **about 67 entities a day**. **About 6,912 placeholders remain, which is about 103 days** at that rate (about 39 days even if all 4 daily runs succeed).
3. **The live path cannot close the recoverable gap.** The recoverable high-confidence gaps are:
   - **3,717 reliable LEIs** (T1, 4,109 rows, precision 150/150, lower bound 98.02%);
   - **14,852** placeholder names and countries, plus **859** more names;
   - **1,529** parent links.

   Every one of them is reachable offline from one Golden Copy publication, and almost none is reachable by the jobs as written.
4. **Integrity (W) findings are real, bounded and routed:**

   | KI | Finding | Size |
   |---|---|---|
   | 22.41 | duplicate entities | 1,928 pairs + 743 rows whose LEI is on another row |
   | 22.43 | wrong `NO_LINK_DECLARED` markers | **657** |
   | 22.42 | HTML-escaped names | 105 |
   | 22.40 | sticky diff | about 2.4k rows re-stamped each week |
   | 22.9 | bad edges | 4 |
   | — | wrong LEIs, mostly a subsidiary's LEI on the listed parent (June `isin_direct` mapping) | **24** |
   | — | literal `'NULL'` strings | 2 |

### H1–H13 verdicts (Evidence §13; trend through 5 Oct in §16)

| H | Verdict |
|---|---|
| H1 `name_search` has no consumer | **CONFIRMED** |
| H2 Phase 1 head-of-line | **CONFIRMED** (cause: `&amp;` 80%, non-issuer strings 20%) |
| H3 Phase 2 dead | **CONFIRMED** (still 0 status changes on 5 Oct) |
| H4 Phase 3 same 44 daily | **REFUTED as stated; the spec's alternative is CONFIRMED** (drains 44 per successful run) |
| H5 failed parent follow-up loops | **NOT OBSERVED; LATENT** (code) |
| H6 only the generic exception | **CONFIRMED** (657 wrong markers = KI 22.43, after D6-5) |
| H7 parent upsert overwrites another holding's LEI | **REFUTED at the snapshot; LATENT** code risk. The extended check found 24 wrong LEIs from another cause. |
| H8 queue never reconciled | **CONFIRMED** (554 stale + 2 orphans + 1 stuck since 11 Jun) |
| H9 Step 4 skip / `type_hint` | **PARTLY CONFIRMED** (95 rows; 0 unqueued at the snapshot) |
| H10 delta not safe to unfreeze | **CONFIRMED** (code); never ran (no `delta_*` key on 5 Oct) |
| H11 boost fails / adds nothing | **CONFIRMED that it fails:** 17 of 39 attempts since 16 Sep failed at the pre-flight, 1 fire was missed, and 2 fired out of window. **"Adds nothing" is REFUTED:** each in-window fire advances Phase 3 by 44. |
| H12 June resolver's old normalizer | **PARTLY CONFIRMED** (small direct effect; the large effect is no offline matching at all since June) |
| H13 Phase 1 full scans | **REFUTED** (an expression index serves it) |

## 2. Classification totals and completeness (Evidence §16.3–§16.4)

Every gap is classified: **76,624 gaps by the §5.1 definitions, 76,624 classified, 0 unclassified**, over 43,998 D2 rows. The baseline reconciles: D2 has 43,998 rows against 43,785 (+0.49%), and LEI fill is 37.8%.

| Field | (a) | (b) | (c) | (d) | F (fund) | Total |
|---|---|---|---|---|---|---|
| `lei` | 17,637 | 53 | 2,201 | 7,190 | 290 | 27,371 |
| `direct_parent_lei` | 0 | 15,850 | 657 | 71 | — | 16,578 |
| `ultimate_parent_lei` | 0 | 15,777 | 727 | 74 | — | 16,578 |
| `name` | 0 | 0 | 859 | 7,426 | 0 | 8,285 |
| `country` | 91 | 0 | 5 | 7,426 | 290 | 7,812 |
| **Total** | **17,728** | **31,680** | **4,449** | **22,187** | **580** | **76,624** |

Separate W rows (3,463): 2,671 KI 22.41, 657 KI 22.43, 105 KI 22.42, 24 wrong LEI (RC-12), 4 KI 22.9, and 2 `'NULL'`.

| Field | Raw fill | Achievable fill |
|---|---|---|
| `lei` (non-fund) | 38.0% | 63.9% |
| `direct_parent_lei` | 0.29% | 6.3% |
| `ultimate_parent_lei` | 0.29% | 5.8% |
| `name` | 81.2% | 81.2% (every placeholder is recoverable) |
| `country` | 82.2% | 83.0% |

- The cuts by type, country, source and LEI state are in Evidence §14.7 and §16.4, and in `WORK/day7/run3/completeness.json`.
- The sample-weighted estimate of the true headline for operating/no-LEI is ≈ 14.4k (a), ≈ 3.4k (c) and ≈ 9.2k (d).

## 3. Size of the prize

| What | High confidence | Medium / review |
|---|---|---|
| Reliable LEIs (T1, ISSUED/PENDING, government excluded by D6-1) | **4,109 rows → 3,717 LEIs** | T1_LAPSED 1,342; T1+/T1c 1,739; 9 government rows go to manual review |
| Duplicate-entity merges (KI 22.41) | 1,349 `lei` gaps; 2,671 W rows | 852 via the N+ key |
| Placeholder hydration (name, country, status, real exception reason) | 7,436 pool (6,912 still undrained on 5 Oct) + 859 RC-15 names | — |
| Parents from RR (24 wrong-LEI rows excluded) | **1,529 gaps** (728 direct + 801 ultimate; 812 entities) | — |
| Real GLEIF exception reason in place of blank or `NO_LINK_DECLARED` | 15,858 entities | — |
| Truly no LEI (sample-weighted) | ≈ 14.4k | — |

## 4. MA-SEP-017 residual (R5) and KI 22.9

- **R5:** the Mon 28 Sep (first Monday cron) seed touched **2,406** rows that were not new, against 27,308 before the fix on Sat 6 Sep, which is about 91% fewer. The 13 and 20 Sep zeros are floors only. The residual is the **KI 22.40 sticky diff** (matrix rank 8). Per R5, this answers the handed-over residual; it is not a reopen or close action on MA-SEP-017.
- **KI 22.9:** all four edges are confirmed **W**. RR has no relationship for any child, and all four children are funds. Root cause: the MA-SEP-001 merge. They go to MA-OCT-003/004 as one aggregate DQ ticket and are **excluded from MA-OCT-011** (Evidence §14.5).

## 5. Remediation matrix and the MA-OCT-011 recommendation (`MA-OCT-006_Remediation_Matrix.md`)

The top five rows by high-confidence recoverable gaps are below. Every cost is a 006 estimate; final costing is in the 011/013 specs.

| Rank | RC | Gaps (high) | Fix and packet | 006 est. writes |
|---|---|---|---|---|
| 1 | RC-4: Phase 3 placeholder pool | 14,997 | 011 Option 1, bucket B | 44,616 |
| 2 | RC-1/RC-9: no `name_search` consumer, no offline matching | 3,855 | 011 Option 1, bucket A | ≤ 26,985 (A as a whole 26,019) |
| 3 | RC-5: generic exception (KI 22.43) | 1,384 | 011 bucket C, plus the live-path fix | C as a whole 10,175 |
| 4 | RC-10: duplicates (KI 22.41) | 1,349 | MA-OCT-013 | ≈ 37,836 + repoints (not measured) |
| 5 | RC-15: pre-MA-SEP-014 placeholders | 859 | 011 bucket B | 2,577 |

**MA-OCT-011 (§9.2, as worded):**

| # | Option 1 (offline reconciliation; ≈ 100,373 writes; closes 20,957 gaps) | Option 2 (Level 2 only; ≈ 10,175 writes, or 4,740 without parent inserts; closes 1,529) |
|---|---|---|
| 1 Enough to recover | PASS: **1,529 (entity, field) gaps ≥ 1,000. It would not pass in entities (812). The Founder should confirm the unit (D6-6).** | PASS (same caveat) |
| 2 Live path can't clear | PASS (1,384 processed rows are never re-selected; the pool takes 39–103 days) | PASS |
| 3 Identity reliable | PASS (sample W 2/164 = 1.2%; H7 = 0; 24 wrong LEIs excluded) | PASS |
| 4 Write budget | **FAIL as worded**; amended wording comes from the 011 spec lane | PASS |
| 5 Separation | **NOT APPLICABLE as worded**; amended wording comes from the 011 spec lane | PASS for parent fields and edges; the 365 parent-entity inserts fall outside the wording |
| 6 Observability | PASS (conditional: 2 of 7 pilot events were not delivered) | PASS (conditional) |
| 7 Credentials | PASS (design condition) | PASS (design condition) |

**006 recommendation (unchanged by the day-7 re-sync):**

- **Option 1: DEFER under the current wording. GO if the Founder accepts the 011 lane's amended criteria 4 and 5.**
- **Option 2: GO**, as the fallback.
- **MA-OCT-013: a separate packet**, sequenced before or interleaved with bucket A.

## 6. Ops feed (spec §8) status

- **Registry inputs (§8.1)** and the **contract requirements (§8.2)**: `progress_count`, ≤ 1 KB metrics, a per-phase `run_key`, and `skipped` reason codes. They were handed to MA-OCT-001 via N-3, and the GLEIF-E1 to E6 exception catalogue was accepted by Ops.
- **Pilot heartbeat** (MA-OCT-001 emitter, live 2026-10-01 19:08:13 UTC), tally to 5 Oct (Evidence §16.2):

  | Measure | Count |
  |---|---|
  | Slots | 8 |
  | Fires | 7 |
  | Missed fires | **1** (4 Oct 16:50; no trace) |
  | Pre-flight failures (wrangler code 10000) | 3 |
  | Fires that called `/run` | 4, of which **2 were out of window and reported `success`** although Phase 3 could not run |
  | Terminal events not delivered | **2 of 7** (both `failed`, TimeoutError) |
  | Late fires | 4 (+3 to +13 min) |

  The boost-log format and the ACK conditions held throughout.
- **Open for 001/002:**
  - Add the `out_of_window` → `skipped` mapping.
  - Detect missed fires against the registry schedule.
  - Retry or reconcile undelivered terminal events.
  - Add Worker-side `progress_count`. `/run` returns no counts, so the pilot cannot show F4's zero-progress pattern.
  - Fix enrich's `writes_today` increment (KI 22.14 / F7).
- **F6 in GLEIF terms:** 17 of 39 boost attempts since 16 Sep failed at the pre-flight, and 1 more never fired. That is about 18 × 44 ≈ 790 lost Phase 3 entity-advances, plus 2 out-of-window fires that advanced nothing.
- **F10 in GLEIF terms:** `entities-delta` has never run (no `delta_*` keys on 5 Oct). Level 1 fields (status, registration, renewal) for the 16,627 LEI-bearing rows are frozen at their load date, the June bulk load for June-loaded rows.

## 7. Acceptance criteria (spec §10)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All rows' in-scope gaps classified; zero unclassified; W listed separately | **met** | §8.2 (reconciled ±0.5%), §14.3, §16.3 (76,624 / 76,624 after the re-sync) |
| 2 | H1–H13 verdicts with evidence; H4 settled by tail plus D6 | **met with deviation**: H4 settled by the 30 Sep tail plus D6 on 29 Sep, 30 Sep, 1 Oct and 5 Oct, not by tails on 2 and 3 Oct (R7, E2 dates) | §13, §16.1 |
| 3 | F4 numbers attributed (pending, in_progress, failed) | **met**, on the 29 Sep queue (26,680 pending; MA-OCT-000 had 26,537). The 5 Oct trend shows no status change (D10). | §13 F4 attribution; §16.1 |
| 4 | F6 and F10 impacts stated in GLEIF terms | **met** | §6 above; §13 (H10, H11); §16.1–§16.2 |
| 5 | Completeness raw and achievable for 5 fields × 4 cuts | **met** | §14.7, §16.4; `day7/run3/completeness.json` |
| 6 | Relationship check for every LEI-bearing entity; KI 22.9 as its own W row | **met** | §14.3, §14.5, §16.3 |
| 7 | MA-SEP-017 residual number for 13, 20 and 28 Sep, with a recommendation | **met with deviation**: under R5, the number answers the handed-over residual and is not a close action | §8.4(b), §7 R5 |
| 8 | Sample adjudication meets §6.4, or the failure is reported with revised rules | **met with deviation**: failed (run 1 85.3%, run 2 89.75%, **357/400 = 89.25%** after the D6-1 re-sync), reported with the one permitted revision (D5-6). The rules under-count recoverable LEIs and do not mislabel the ones they recover. T1 precision is 150/150, lower bound 98.02%. | §14.6, §15.2, §16.3 |
| 9 | Freshness ≥ 98% with ≤ 60 API calls | **met**: 50/50, 52 calls in total | §12.2 |
| 10 | Ledger: EXPLAIN for every query, no `SCAN entity_master`, ≤ 50k per execution, ≤ 200k total, 0 writes | **met**: 127,238 reads, max single 29,108, 0 writes | Query Ledger "Final totals" |
| 11 | Matrix ranked by §9.1, all columns filled, 011 decision against every §9.2 criterion | **met** | Remediation Matrix §1–§3; Evidence §16.5 |
| 12 | No files outside `claude/MA-OCT-006_*` and the work folder; no git writes | **met** | Ledger (every day); Evidence §16 |

## 8. Totals and rulings

- **D1 reads:** **127,238** of 200k (34,938 on 5 Oct). **D1 writes:** **0**. **Largest single execution:** 29,108. **No `SCAN entity_master`.**
- **GLEIF API calls:** **52 of 60** (8 unused). Plus 4 Golden Copy file downloads under Q1, which are not API calls.
- **Rulings** (all recorded in Evidence §7):

| Group | Rulings |
|---|---|
| Main Lane / Founder | **R1** LEI–ISIN same-day file accepted. **R2** `entity_isin_map` refused as a T2 source. **R3** early CSV cleanup. **R4** close-out cleanup. **R5** MA-SEP-017 residual. **R6** Report 2a corrections. **R7** H4 settled. **R8** D7 not repeated. **R9** 011 scope flag. **R10** schedule pull-forward. **P-ACK**, **ML-1**, **ML-2** (pilot). |
| Day 4 | **D4-1** DUPLICATE-status LEIs excluded from T1. |
| Day 5 | **D5-1** LEI on another row → (c) duplicate. **D5-2** script-gap capacity guard. **D5-3** no RR and no RX → (b) medium. **D5-4** LAPSED T1 → (d) medium. **D5-5** country follows lei for no-LEI rows. **D5-6** the one rule revision (run 2). **D5-7** adjudication standard. **D5-8** H7 extended (wrong LEIs). |
| Day 6 | **D6-1** government excluded from automated matching. **D6-2** close-out pulled forward. **D6-3** T1 precision on the strict tier (150/150). **D6-4** OPAP cleared (24 wrong LEIs). **D6-5** wrong-LEI entities excluded from parent backfill (1,529). **D6-6** criterion 1 counted in (entity, field) gaps. |
| Day 7 | **D7-1** D6-1 applied to all 9 automated government LEI rows. **D7-2** D6-5 parent rows → (b) against the correct LEI; KI 22.43 = 657. **D7-3** sample re-synced (357/400). **D7-4** `etf_offset` key source and `last_run_status` added to D8. **D7-5** transient wrangler 7403 on the first EXPLAIN, retried at 0 reads. |

## 9. Remaining items

1. **Operations Lead review** (Sat 10 Oct, Addendum §3 reviewer block), then the **Founder gate** (Mon 12 Oct): 006 close and 011 GO / NO-GO / DEFER.
2. **Hand the re-synced figures to the MA-OCT-011 spec lane** (its brief rule 4, Fri 9 Oct). The figures that changed since that lane's interim numbers are: T1 4,109 / 3,717; parent gaps 1,529; KI 22.43 657; wrong LEIs 24; Option 1 ≈ 100,373; Option 2 ≈ 10,175.
3. **The close-out commit**, once, after the Operations Lead's verdict. It is staged by explicit path, using the file list and hashes the Main Lane provides, after `git fetch` and `git pull --ff-only`. **No git write has been made by this lane.**
4. **R4 cleanup after 12 Oct**, owned by the close-out lane (see §10.2).

## 10. Deliverables manifest

### 10.1 `claude/MA-OCT-006_*` files (final, Mon 5 Oct 2026)

| File | Role | Size (bytes) | SHA-256 |
|---|---|---|---|
| `MA-OCT-006_Spec_Brief.md` | brief (input) | 4,952 | `ffd3522a01be79795b3438914966f43f9efd0698349d1a98c1802ebc398d3332` |
| `MA-OCT-006_Spec.md` | governing spec | 38,307 | `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273` |
| `MA-OCT-006_Spec_Review.md` | Ops review | 5,279 | `6ae65d7904b597b1bfff902f9e810777f655c206237fa170013e9bb7c3d44206` |
| `MA-OCT-006_Build_Brief.md` | execution brief, rev 2 | 7,620 | `9522a006462c563408de1dcf87e051d896e8634ed759137d98b845ec478b11e9` |
| `MA-OCT-006_Day5_Run_Instructions.md` | run instructions | 10,528 | `b5cb73b3ac97ce221aab9fa15e9f8fa221c05c8591e5021b292ad05aa8ae6bf4` |
| `MA-OCT-006_Day6_Run_Instructions.md` | run instructions | 9,365 | `c62e718edcab1a6791db524798c7ad00379f48a5de0b2a6b0b44ffbd099d8582` |
| `MA-OCT-006_Day7_Run_Instructions.md` | run instructions | 7,153 | `9c3761453e01ed6a555e2a51a6a86eb6d2f8824c61b6b210446111854a63d8be` |
| `MA-OCT-006_Evidence.md` | **deliverable** (evidence record, §1–§16) | 110,564 | `0d1bbf9b69f1e6a28e3bffe4f07175e500f9293c3ee5adb3f20fbdb526ddb1bc` |
| `MA-OCT-006_Query_Ledger.md` | **deliverable** (query ledger, final totals) | 16,930 | `c0fce75b36dae2d1ca53af6def4dce20bf084c1b874327528df3a3c405e507dd` |
| `MA-OCT-006_Remediation_Matrix.md` | **deliverable** (§9 item 2) | 28,419 | `db5942247275b450536e5e2370f7e36bd12b389bb4935e9202bfaa6049f33b5a` |
| `MA-OCT-006_classification.csv` | **deliverable** (§9 item 3; day-7 re-sync; 80,087 rows) | 6,845,432 | `cb3b3a841147235d0d2189fec0fba481758676602015d62cc49ae9babc13df64` |
| `MA-OCT-006_sample_adjudication.csv` | **deliverable** (§9 item 4; 400 rows; day-7 re-sync) | 51,115 | `929ae3e74a6128ac40b29997fe45b84aa37b9631b862d3a5088474ca04212c91` |
| `MA-OCT-006_Closeout_Summary.md` | **deliverable** (§9 item 1; this file) | — | reported in Report 4 (a file cannot contain its own hash) |

- **N-2 check:** the largest file is `MA-OCT-006_classification.csv` at 6.85 MB. **No `claude/MA-OCT-006_*` file exceeds 10 MB**, so none is gzipped.
- Git state: the Spec Brief, Spec, Spec Review and Build Brief are already tracked. Every other file is untracked and waits for the close-out commit.

### 10.2 Work files kept outside the repo (`~/MeridianAtlas-work/gleif-006/`, 4.1G on 5 Oct)

| Item | Content |
|---|---|
| `gleif_006.db` (3.69 GB) | GC L1 / RR / RX / LEI–ISIN, 2026-09-28 16:00 UTC publication |
| `gc/` | the 4 source zips (rebuild source). The unzipped CSVs were deleted on 29 Sep under R3. |
| `day2/` … `day7/` | D1 exports and snapshots, the tail capture, tiers, classification runs 1–3, the sample, the T1 top-up, wrong-LEI detail and the cost model |
| `d1out/`, `ledger.jsonl` | raw D1 JSON per execution, and the per-execution ledger (127,238 reads, 0 writes) |
| `*.py`, `*.mjs`, `d1q.sh` | loaders, analysis scripts and the guarded read helper |

**What R4 does with them after the 12 Oct gate.** R4 runs once the close-out commit is pushed and every SHA-256 is recorded. It is owned by the close-out lane, which reports `du -sh` before and after.

- **NO-GO:** delete the whole `WORK` folder, and `~/MeridianAtlas-work` if it is then empty.
- **GO:** delete everything in `WORK` except `gleif_006.db`, and delete `gleif_006.db` when MA-OCT-011 closes.
- **DEFER:** treated as GO for retention until the Founder decides otherwise. *This is a proposed reading, because R4 names only GO and NO-GO. The Main Lane should confirm it.*
