# MA-OCT-007.R14C-UXDI — Report

**Control:** v1 `claude/packets/MA-OCT-007.R14C-UXDI_Control_v1.md` SHA-256 `0a52bc401bbb51a246297292fa79838382e07bbca138d3f63c150e7b93530c47` (matches STATUS_BOARD row)
**Task:** v1 `claude/packets/MA-OCT-007.R14C-UXDI_Task_v1.md` SHA-256 `62788dc8f77bad41ec15912573dcebccd930709bda01df59ba446e5d76c5dc3c` (matches Control)
**Executed by:** REVIEW-007, UX Lead + Data-Identity Lead (review lane), in a fresh Cowork session, 10 Oct 2026, on the Founder's instruction to execute. This session authored none of 007 rev 1.0–1.4 or the R14 edit. Independence holds.

## Preflight
- Folder `Meridian Atlas Clean (v11)`, branch `October-2026`, HEAD `16918e0`. No `.git/*.lock`. Git read only with `--no-optional-locks`.
- Inputs re-hashed as found; all match the Task:

| Input | SHA-256 |
|---|---|
| `claude/MA-OCT-007_Spec.md` rev 1.4 (818 lines) | `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c` |
| `claude/packets/MA-OCT-007_Spec_rev1.3.md` (772 lines) | `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` |
| `claude/packets/MA-OCT-007.R14_Report.md` | `e764891dffe3f49adf4545e3a86092fd47f8eee43fb746b09e730f300718a14a` |
| `claude/MA-OCT-007_Spec_Review.md` (before append) | `79a852cad56864bfee39e1d3d3e404995200c978a586205390243100b70b035b` |

- `diff -u` rev 1.3 copy → rev 1.4: **28 hunks**, identical to the R14 report's hunk table.

## Outputs

| File | SHA-256 | Note |
|---|---|---|
| `claude/MA-OCT-007_Spec_Review.md` | `9b6a56999e9afedf4d7154f2fb9e186851c8be016c7db4bd34d0cb965a110eb7` | 170 lines. Appended section "Rev 1.4 delta check (10 Oct)". Lines 1–114 unchanged (prefix re-hash = `79a852ca…035b`). |
| `claude/packets/MA-OCT-007.R14C-UXDI_Report.md` | this file | |

## Verdict table (rev 1.4 line numbers)

| Item | Result | Lines |
|---|---|---|
| R7-1 O2 closed, composite `idx_iem_entity_key`, gate "ENT-CR1 verified" | MET | 501, 503, 609, 622, 640–641, 718, 755, 777–779, 811 |
| R7-2 placeholder keys guarded in R1 | MET | 103, 124, 299, 350, 640, 683, 684 |
| R7-3 primary-row rule, `also_sources` | MET | 161–165, 305, 328, 684, 691 |
| R7-4 key-order description, single- vs multi-page display | MET | 274, 491, 721 |
| R7-5 copy table for every state × reason | MET | 338–358, 258, 592 |
| R7-6 history / `popstate` contract, T7 case | MET | 181–189, 291, 689 |
| R7-7 AC2 formula, R1 ≈ 110, R5 ≈ 5.5k, *k* measured 13 Oct | MET | 441–445, 567, 611–618, 640, 777 |
| R7-8 `lei_only` unit-tested, AC7 / UAT step 7 wording | MET | 258, 592–593, 664, 684 |
| R7-9 heuristic 75, band override explained, Q2 restated | MET | 256, 324–328, 662, 710 |
| R7-10 `bond:` origin, parse rule, unknown → `direct` | MET | 177–178, 204 |

**Unlisted changes:** none found.
**Overall verdict: PASS WITH NOTES.** 10/10 MET. New non-blocking notes N7-13 … N7-16.

## Answers to the author's questions
1. **`placeholder_key`:** keep the additive flag, not a new reason code. Add it to the §3.2 field table, always present and `false` by default (N7-14).
2. **§11.3 at *k* = 1:** accept. At *k* = 2 it is ≈ 0.34M/day (≈ 7%), so the conclusion is unchanged. Refresh it with the measured *k*. AC8 holds for *k* ≤ 4; re-state it if *k* > 4 (N7-15).
3. **§0.2 ruling-A row:** accept as history. Add a "gate superseded by 'ENT-CR1 verified'" pointer at the next touch (N7-16).
4. **`NAME:N/A` / `NA` / `NONE`:** accept. Confirmed against `gate1-instrument-seed.js:51-62`: these are exactly the keys the seed emits. Optionally widen the 13 Oct check to the full list (≈ 14 PK reads).

## New non-blocking notes
- **N7-13 (UX):** cold-load deep link plus "← Back" = `history.back()` leaves the site, which contradicts §4.4's "Back → home / `from`". Fix: on a cold load, `replaceState` a no-route base entry and then `pushState` the route. Add to T7. For the build brief or the next touch.
- **N7-14:** `placeholder_key` row in §3.2.
- **N7-15:** refresh §11.3 with the measured *k*; check AC8 if *k* > 4.
- **N7-16:** superseded-gate pointer on §0.2 ruling A.

## Questions for the Main Lane
1. N7-13 to N7-16 are doc-level and non-blocking. Should they be carried in the Phase 1 build brief, or batched into a rev 1.5 after the 13 Oct *k* measurement? N7-15 needs that number anyway.

**Budget:** 0 D1 reads, 0 D1 writes, 0 deploys, 0 git writes. The 007 spec, `MA-OCT-007.R14C-UXDI_Status.json` and `STATUS_BOARD.md` were not edited (Main Lane owns state). Stop point reached.
