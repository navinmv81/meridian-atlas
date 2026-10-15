# GATE-1012 — Founder Decision Request, Mon 12 Oct 2026

**ISSUED BY:** Main Lane (Program Orchestrator), Sat 10 Oct · **DECIDED BY:** Founder · **Deadline:** Mon 12 Oct (ENT-CR1 runs Tue 13 08:05 UTC; 011 build 13–16 Oct)

Reply format: `D1 A, D2 A, D3 A, D4 A, D5 A` (or name the option you prefer per line).

## D1 — MA-OCT-011 offline GLEIF reconciliation (spec rev 1.9 `e09c01b9…2d22`)
Reviews: Architect PASS WITH NOTES (7/7 met); Operations Lead CONFIRMED and supports GO on Option 1.
- **A (recommended): GO, Option 1**, with **E-A kept** (Ops OPS-R2, conditions E-1..E-5), and the three spec answers as recommended: Q1 accept the amended §9.2 on the **gap reading** (criterion 1 = 1,529 gaps PASS; 812 entities would FAIL — Ops N-3 supports gaps); Q2 write from the pinned 28 Sep GLEIF file with a new ≤ 50-call freshness allowance; Q3 run 011 before 013. → build 13–16 Oct, run Sat 17 – Thu 22 (≈ 86.5k writes, ≤ 25k/day, ceiling 110k), verify Fri 23; T-1/T-2 rows by Fri 16.
- B: GO Option 1 but **drop E-A** (−1,196 writes, fewer parent edges).
- C: **Option 2 only** (parents, ≈ 10k writes) or DEFER — 006 queue stays orphaned (KI 22.29) into November; `gleif_006.db` deleted 31 Oct if not opened.

## D2 — MA-OCT-007 instrument ↔ issuer navigation (spec rev 1.4 `4d4fffef…397c`)
Reviews: UX + Data-Identity PASS WITH NOTES (R7-1..R7-10 met in rev 1.4); ETF Product Lead PASS, O6 consent with conditions. Pre-click badging (R5) is out of v1 (would exceed the 5M reads/day cap).
- **A (recommended): approve rev 1.4** with Q1 = (a) Access-gated link-out for "Report mapping problem"; Q2 = yes, OpenFIGI 70 shows as "medium" — **note:** heuristic matches (1,649 rows, confidence 75) show as "Low" by source although the number is higher, and the screen explains this; Q3 = no, an ambiguous ISIN is never auto-picked. → Phase 1 build from Wed 14 (after ENT-CR1 verified); UAT from 22 Oct.
- B: approve with different Q answers (name them).
- C: hold 007 — Phase 1 slips past Wed 14; UAT 22 Oct at risk.

## D3 — MA-OCT-008 SEC corporate-bond ingestion (spec rev 1.2 `bcdad9a2…5cd3`)
Reviews: Ops PASS WITH NOTES; Architect A8-1..A8-6 met.
- **A (recommended): approve rev 1.2**, Q1 yes (replace the 5 structured-note G-SIBs with PepsiCo, Union Pacific, Lowe's, Dominion, Welltower), Q2 yes (ingest unlinked issuers with a DQ ticket), Q3 yes (code in `App/Corporate Atlas/bonds/`). → Wave 2 build; ≈ 3.8k initial writes, 8k/day runner cap.
- B: approve with a different seed list or Q answers.
- C: hold — 009/010 (Wave 3) lose their data source.

## D4 — MA-OCT-ENT-CR1 Entities index change (rev 1 `fb13ff3e…6c20`)
Architect PASS WITH CONDITIONS (applied); ETF PL consult PASS; Ops one-time 50k-ceiling exception OPS-R4 (≤ 90k reads, write gates ≤ 30k / ≤ 35k).
- **A (recommended): approve** the composite index `instrument_entity_map(entity_id, instrument_key)` plus dropping the two duplicate `instrument_master` indexes; run **Tue 13 Oct 08:05–10:30 UTC** (fallback Wed 14) by LANE-1-ENG. The after-set also measures 007's per-row read multiplier and the placeholder check (≈ 60–410 + 2 reads). Prerequisite for 007 Phase 1 and 013.
- B: approve the composite index only; keep the duplicate indexes for now.
- C: hold — 007 Phase 1 and 013 blocked; issuer pages keep ≈ 33k reads each.

## D5 — MA-OCT-006 close-out and follow-ons
Close-out FINAL (committed `16918e0`); Ops PASS WITH NOTES, nothing required.
- **A (recommended):** close 006; **R4:** keep `gleif_006.db` for 011 (deleted 31 Oct if 011 not opened); **D5-7** adjudication standard as ruled; **criterion-1 unit** = gaps (same as D1-A); **KI 22.44** (24 wrong LEIs) → one aggregate DQ ticket in MA-OCT-004; GLEIF-reason UI follow-up stays parked (no new packet in October).
- B: close 006 but make the GLEIF-reason UI follow-up packet MA-OCT-014 now.
- C: keep 006 open.

## Optional
- **B13-2 exposure read check** (ETF PL): one read-only check of exposure rows possibly understated by the MA-SEP-001 merge. Recommendation: **yes**, folded into the 013 pre-spec reads, not a separate lane.

---
## Founder decision — recorded 2026-10-10T11:11Z
**D1 A, D2 A, D3 A, D4 A, D5 A** (Founder, in chat, Sat 10 Oct — taken ahead of the Mon 12 deadline). Recommended options adopted as written above; optional B13-2 check = yes (folded into the 013 pre-spec reads).
