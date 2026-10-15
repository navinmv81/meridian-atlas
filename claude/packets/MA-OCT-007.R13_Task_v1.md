# MA-OCT-007.R13 — Task v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator) · **EXECUTED BY:** LANE-7, Engineering Lead (007 spec owner) · **REVIEWED BY:** MA-OCT-007.REV (UX Lead + Data-Identity Lead; ETF PL on §9), fresh sessions · **APPROVED BY:** Founder (12 Oct gate)

Revise `claude/MA-OCT-007_Spec.md` from **rev 1.2** (`8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703`, 765 lines) to **rev 1.3**. Exactly these five items; nothing else.

1. **R5 figures** (§7.2 and §11.1): batch reads ≈ 300–400 typical, ≤ 1,600 worst (50 × R1 at 6–8 reads typical / 32 worst). Decisions Log 5 Oct.
2. **T6** (tests): add **R1f** (bond → issuer, optional) and **P10** (plan check once 008's tables exist; cross-ref 008 P-B1).
3. **P5 expected-plan cell** (Appendix A.3): replace with what was observed 7 Oct — range walk on the PK autoindex, no temp B-tree, ≈ *M* reads per page. E7's conclusion is unchanged; say so.
4. **A8-5 follow-on** (§3.6, issuer → bonds, line ≈ 215): drop `AND status = 'active'` from the `bond_issuer_link` read, matching 008 rev 1.2 §8.3 step 1 and R1f. Add one line: `status` ∈ (`active`, `paused`); `paused` = stop polling only, bonds stay visible. Index (`idx_bil_entity`) and the read formula (≤ 26 × nCIK + nCIK per page) are unchanged — confirm.
5. **Re-cite 008** at **rev 1.2** `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` wherever rev 0.2 (`a4dba446…320a`) is cited. Note in one line that L8-2 (`filing_status` values `skipped_structured`, `skipped_other`) and L8-3 (`bond_issuer_link.last_polled_at`) are additive and do not affect R1f (`filing_status = 'final'`) or the NavLink contract.

Also: add a revision-history row for rev 1.3, and one reference line to `claude/MA-OCT-007_AppendixA_Results.md` (`a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa`; 37 ambiguous ISINs, 0 dangling refs) where Appendix A is introduced — **reference only, no design change from it** (raise anything it implies as a question).

**Inputs to re-hash before reading (stop on mismatch):** the 007 spec (rev 1.2 hash above), the 008 spec rev 1.2 (above), `claude/MA-OCT-008_Architect_Review.md` `3fcb303d655038897f194827d85f979274e02ca62a2ed7ec5df6bfd457ac06ed` (A8-5 text), the Appendix A results (above).
