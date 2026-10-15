# MA-OCT-007.REV — Task v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator) · **EXECUTED BY:** fresh Cowork session holding UX Lead + Data-Identity Lead · **REVIEWED BY:** n/a (this is the review) · **APPROVED BY:** Founder (12 Oct gate)

First independent review of the 007 spec (instrument ↔ issuer navigation). It has not been reviewed before, so this is a **whole-document** review, from two hats:

- **UX Lead:** journeys J1–J3 (§4), mapping states and display rules (§5), the "merged into" notice (§6.4), screens (§9), acceptance criteria (§10), Founder UAT script (§13); answer **O5** (linked-instrument ordering).
- **Data-Identity Lead:** navigation contract and canonical ids (§3, incl. §3.6 bond join), mapping-state resolution (§5.1), identity changes and redirects (§6), API reads and index audit (§7, §11), Appendix A results; answer **O2** (composite index — note ENT-CR1 rev 1 already uses `idx_iem_entity_key (entity_id, instrument_key)`) and **O3** (redirect backfill for ≈ 2,600 losers).

Also rule on the author's four questions in `claude/packets/MA-OCT-007.R13_Report.md` §Questions: (1) close O2; (2) `lei_only` has 0 live rows — fixture or wording for AC7 / UAT step 7; (3) heuristic confidence is 75 in live data, not 55 (§4.1 example); (4) 2.5 × N multiplier for grouped queries.

Out of scope: §9's ETF-screen consent (O6) — that is MA-OCT-007.ETF. Founder questions Q1–Q3 (§15.1): give a reviewer view only; the Founder decides.

**Inputs (re-hash first, stop on mismatch):**
- `claude/MA-OCT-007_Spec.md` **rev 1.3** `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` (772 lines)
- `claude/packets/MA-OCT-007.R13_Report.md` `47436fcc26bd934b986ab326bb8a06ece5430551de5092ad5fff74a1617ba203`
- `claude/MA-OCT-007_AppendixA_Results.md` `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa`
- `claude/MA-OCT-007_Spec_Brief.md` (the scope the spec answers; read as found)
- `claude/MA-OCT-008_Spec.md` rev 1.2 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` (§8 only, for §3.6)
- `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` rev 1 `fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20` (for O2)

**Output:** `claude/MA-OCT-007_Spec_Review.md` — verdict (PASS / PASS WITH NOTES / FAIL); numbered **required** items (R7-1…) and **non-blocking** notes (N7-1…), each with section/line; answers to O2, O3, O5 and the four author questions; reviewer view on Q1–Q3.
