# MA-OCT-007.R14 — Task v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator) · **EXECUTED BY:** LANE-7, Engineering Lead (007 spec owner) · **REVIEWED BY:** delta re-check by REVIEW-007 (R7 items) and REVIEW-A (E7 items), next packet · **APPROVED BY:** Founder (12 Oct gate)

Revise `claude/MA-OCT-007_Spec.md` from **rev 1.3** (`332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e`, 772 lines) to **rev 1.4** with exactly the **13 required items** from the two reviews — nothing else:

- **R7-1 … R7-10** from `claude/MA-OCT-007_Spec_Review.md` (`79a852cad56864bfee39e1d3d3e404995200c978a586205390243100b70b035b`), each at the sections and lines the review names. This closes O2 (composite `idx_iem_entity_key`), and records O3 = no redirect backfill in October and O5 = yes with R7-4's conditions.
- **E7-1 … E7-3** from `claude/MA-OCT-007_ETF_Consult.md` (`ae3c1c8db1fb6e35ca32e1118feeef3eacd410304a25d4b1dcd79855cae276cc`). For **E7-1** you choose one of the two options the consult allows (R5 in Phase 2 via `ma-etf.js`, or R5 out of v1) and state the choice and reason in one line; if R5 stays in, E7-2's bounds (viewport / first 50 rows, per-session key cache, debounce, abort on switch, ≤ 4 batches per view) are mandatory.

**Main Lane routing already decided (write as references, not new design):**
- R7-7's per-row multiplier measurement (one R2 execution on entity 28088 at `limit=25` and `limit=100`) and R7-2's pre-build check (2 PK reads for `CUSIP:000000000`) run **Tue 13 Oct in the ENT-CR1 after-set, LANE-1-ENG**. The spec says so and keeps its figures provisional until then.
- Non-blocking notes N7-1…N7-12 and N7E-1/N7E-2: apply only if a note is a one-line wording fix inside a section you are already editing for a required item; list each one applied or deferred in the report. N7-5 is for 008/009 — do not apply.

Add a rev 1.4 status line (same convention as rev 1.3). Re-hash every input first; stop on mismatch. Inputs: the 007 spec rev 1.3, the review and consult above, `claude/packets/MA-OCT-007.REV_Report.md` `6b8bd6be016622a9ee21fb601b75b70ba8decac50e5d3b8104c0831ed680481f`, `claude/packets/MA-OCT-007.ETF_Report.md` `4dad703f062e57a04fac502b760ede77ecb6e13f0a5cbf006a6736599015e3cf`.

**Keep a copy:** before editing, copy rev 1.3 to `claude/packets/MA-OCT-007_Spec_rev1.3.md` (verify the hash matches) so the Main Lane and reviewers can diff.
