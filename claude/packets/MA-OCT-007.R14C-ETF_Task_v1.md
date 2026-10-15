# MA-OCT-007.R14C-ETF — Task v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator) · **EXECUTED BY:** REVIEW-A, ETF Product Lead · **REVIEWED BY:** n/a (this is the review) · **APPROVED BY:** Founder (12 Oct gate)

Delta re-check of 007 rev 1.4 against **your** required items **E7-1 … E7-3** (`claude/MA-OCT-007_ETF_Consult.md` `ae3c1c8db1fb6e35ca32e1118feeef3eacd410304a25d4b1dcd79855cae276cc`). The author chose **R5 out of v1** for E7-1 (worst case ≈ 6.6M reads/day at 300 views, over the 5M cap). Confirm: the choice satisfies E7-1; E7-2's bounds are recorded as mandatory for any later R5; E7-3's line shows 0 in v1; and your **O6 consent conditions** still hold for the Phase 2 `ma-etf.js` changes that remain.

**Inputs (re-hash first, stop on mismatch):**
- `claude/MA-OCT-007_Spec.md` **rev 1.4** `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c` (818 lines)
- `claude/packets/MA-OCT-007_Spec_rev1.3.md` (rev 1.3 copy) `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e`
- `claude/packets/MA-OCT-007.R14_Report.md` `e764891dffe3f49adf4545e3a86092fd47f8eee43fb746b09e730f300718a14a` (13 items, 28 hunks, 4 questions)

Method: `diff -u` the rev 1.3 copy against rev 1.4 (28 hunks expected). Check **only your own items** and that no hunk outside the report's list changed anything else. MET / NOT MET per item with line; no new scope (anything new is a non-blocking note at most).

**Output:** append "Rev 1.4 delta check (10 Oct)" to `claude/MA-OCT-007_ETF_Consult.md` (append only) with the table, O6 position and verdict.
