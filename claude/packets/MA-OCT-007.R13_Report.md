# MA-OCT-007.R13 — Report

**Control:** v1 `claude/packets/MA-OCT-007.R13_Control_v1.md` SHA-256 `5a3df34a5a7817aa05c7e75817404323d3dad7133ed055de46f5e90bcc6d9547` (matches STATUS_BOARD row)
**Task:** v1 `claude/packets/MA-OCT-007.R13_Task_v1.md` SHA-256 `956d612722db4180c84e0aab3d556f2ef099da13353434be02150acc3aed17a0` (matches Control)
**Executed by:** Engineering Lead (LANE-7), Cowork, 10 Oct 2026, on the Founder's instruction to execute.

## Preflight
- Folder `Meridian Atlas Clean (v11)`, branch `October-2026`, HEAD `16918e0` (matches Control). No `.git/*.lock`. Git read only with `--no-optional-locks`.
- Inputs re-hashed, all match the Task:
  - 007 spec rev 1.2 `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703` (765 lines)
  - 008 spec rev 1.2 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`
  - `claude/MA-OCT-008_Architect_Review.md` `3fcb303d655038897f194827d85f979274e02ca62a2ed7ec5df6bfd457ac06ed` (A8-5 text)
  - `claude/MA-OCT-007_AppendixA_Results.md` `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa`
- P5 observed plan taken from `claude/ReadPacks_2026-10_Query_Ledger.md` (7 Oct, row P5 and the "P5 deviation" note).
- This session did not author any input it was asked to review; R13 is an authoring packet, no review performed.

## Result

| | SHA-256 | Lines |
|---|---|---|
| Before (rev 1.2) | `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703` | 765 |
| After (rev 1.3) | `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` | 772 |

Diff: 9 hunks, every one listed below.

| Item | Change | Section | Line(s) in rev 1.3 |
|---|---|---|---|
| 1 | R5 batch reads → typical ≈ 300–400 (50 × 6–8), worst ≤ 1,600 (50 × 32) | §7.2 route table; §11.1 | 405; 576 |
| 2 | T6 adds R1f (bond → issuer, optional) as plan check P10 once 008's tables exist, cross-ref 008 P-B1 | §14.1 | 644 |
| 3 | P5 expected-plan cell replaced by the 7 Oct observed plan: PK-autoindex range walk (`instrument_key>?`), no temp B-tree, ≈ *M* reads per page; states E7's conclusion is unchanged | Appendix A.3 | 730 |
| 4 | Issuer → bonds CIK read drops `AND status = 'active'` (matches 008 rev 1.2 §8.3 step 1 and R1f); adds the `status` ∈ (`active`, `paused`) line, `paused` = stop polling only, bonds stay visible. "active" also dropped from "every active CIK" and "per active linked CIK" in the same section so the text is consistent. **Confirmed unchanged:** index `idx_bil_entity` and read formula ≤ 26 × nCIK + nCIK per page | §3.6 | 195, 219, 220, 221 |
| 5 | 008 re-cited at rev 1.2 `bcdad9a2…5cd3` (heading, source line, Appendix B row); one line notes L8-2 and L8-3 are additive and affect neither R1f nor the NavLink contract | §3.6; Appendix B | 193, 195, 197; 772 |
| Rev history | New rev 1.3 Status line; the rev 1.2 Status is kept "for trace" (the spec's existing revision-history convention; it has no history table) | Header | 15, 17 |
| App. A ref | One reference line to the results file (hash, 37 ambiguous ISINs, 0 dangling refs); reference only | Appendix A intro | 684 |

**Anything else changed:** none.

**Deliberately not re-cited:** the rev 1.2 trace line (line 17) still cites 008 rev 0.2 `a4dba446…`, because it records what rev 1.2 said on 5 Oct. All live citations now point to 008 rev 1.2. Appendix B keeps rev 0.2 as the 5 Oct agreement source and adds the rev 1.2 re-cite.

**Budget:** 0 D1 reads, 0 D1 writes, 0 deploys, 0 git writes. `claude/October_Decisions_Log.md` shows modified in git; it was not touched by this packet. `MA-OCT-007.R13_Status.json` not edited (Main Lane owns state).

## Questions (raised, not acted on; for MA-OCT-007.REV or the Main Lane)
1. **O2 looks settled outside the spec.** `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` uses the composite `idx_iem_entity_key (entity_id, instrument_key)`. O2 (§15.2) is still open in rev 1.3. Close it in the post-review revision?
2. **`lei_only` cannot be shown with live data.** Appendix A Q6: 0 rows with `entity_id IS NULL`, so `lei_only` = 0. AC7's `unmatched (lei_only)` case and UAT step 7's example ("LEI known… not in Atlas") need a test fixture or a wording change.
3. **Heuristic confidence is 75 in live data**, not below 70 (Q1+Q2: 1,649 rows at 75). §5.2 still bands it `low` (by source), so states are unaffected, but the §4.1 illustration "matched by heuristic, confidence 55" should read 75.
4. **Read multiplier on grouped scans.** Appendix A found D1 counts temp-B-tree rows (2–2.4 × N on 8 Oct; ≈ 1.0 × N on 9 Oct). The live routes R1–R4 use no temp B-tree after the index (P6, P7), so §11 holds; the A.1 estimates and any future grouped query should carry the 2.5 × N rule. Worst live issuer *n* = 871 (entity 28088), giving ≈ 924 reads on first view with the composite index, inside the ≤ 1,054 bound.

Stop point reached. No reviews started or requested.
