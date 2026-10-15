# LANE-1-ENG: REPORT (Fri 9 Oct 2026, 15:40 UTC)

**Did:** MA-OCT-007 Appendix A, finishing A.1 (Q5, split) and running all of A.2 (Q7, Q8, Q9), under the 9 Oct rulings. Read-only. `/usr/local/bin/wrangler` 4.96.0 by absolute path. Run 15:35–15:37 UTC. **Appendix A is now complete**, except the A.3 plan checks that need objects not yet built.

**File:** `claude/MA-OCT-007_AppendixA_Results.md`, SHA-256 `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa`. Today's section was appended below the 8 Oct section, which is unchanged.

**Results:**
- **Q5 (KI 22.17):** **37 ambiguous ISINs**, each mapped to exactly 2 entities. The list is complete (no range capped) and is in the file.
  - Ranges were sized with indexed `COUNT(*)` probes, and the `US` range (17,194) was split in two.
  - Five ranges ≤ 15k rows each; the largest read 11,276.
- **Q7:** **0** dangling `instrument_entity_map` → `entity_master` references. 4 ranges of about 16.4k reads; the first ran alone as instructed.
- **Q8:** **0** dangling `entity_isin_map` references. 2 ranges of about 37.15k reads; the first ran alone.
- **Q9:** all 5 sample MA-SEP-007 losers are absent from `entity_master`, as expected.

**Budget:** 31 executions, **223,449 rows read, 0 written**. The largest single execution was 37,155 (≤ 45k). Appendix A in all comes to about 406k reads across 7–9 Oct.

**Rulings made in this lane:**
- I split the `US` ISIN range at `US5`. At 17,194 rows it was over the "≈ 15k" ruling, although its 2.5 × N estimate (43k) would have fitted the 45k rule.
- I kept the planned Q7 and Q8 range widths, because the first-range actuals matched the estimate: about 2.0 reads per rowid.

**Deviations and observations:**
- **(a)** A batch of 6 statements went out with malformed range bounds (a zsh word-splitting bug in my wrapper). D1 rejected them as syntax errors with 0 reads. They were dropped from the ledger and re-run correctly. No data effect.
- **(b)** On today's grouped Q5 ranges, D1 read about 1.0 × N, not the 2–2.4 × N seen on 8 Oct. The 2.5 × N rule held with margin.

**Questions:** none. The A.3 plan checks still waiting on new objects are P6, P6′ and P7 (after the 13 Oct index), P8 (after 013) and P10 (after 008). The boost `ops_job_pause` insert waits for its own NEXT, as instructed.
