# MA-OCT-011.R110 — Report (LANE-11, Data-Identity Lead, 011 spec owner)

**Control:** `claude/packets/MA-OCT-011.R110_Control_v1.md` — SHA-256 `62551a3454d23dd273f278050abb2bf2c919698267f9286091dae702026e0f8d` (verified, matches STATUS_BOARD). Task v1 `3d2954ad…d3a6` verified.
**Inputs verified:** BUILD report `758fba1d…ad1b`; Architect Review `251ae4fc…0904`; Ops Review `976f0837…28f9`; 006 `classification.csv` `cb3b3a84…`.
**Date:** Tue 13 Oct 2026. **Git:** HEAD `1b9dbde`; no `.git/*.lock`; nothing staged (before and after). No D1, no GLEIF calls, no git writes.

## Result

| File | Before | After |
|---|---|---|
| `claude/MA-OCT-011_Spec.md` | rev 1.9 `e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22` (853 lines) | **rev 1.10 `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`** (889 lines) |
| `claude/packets/MA-OCT-011_Spec_rev1.9.md` | — | copy of rev 1.9, `e09c01b9…2d22` (verified identical) |

Files written: only the three the Control allows. 013 brief, reviews, build files and board untouched.
Diff: 43 hunks (`diff -U0` rev 1.9 copy → rev 1.10); every one is listed below. §5 approved wording not edited.

## Traceability (line numbers are rev 1.10)

| Item | Where | Lines |
|---|---|---|
| **F-1** E-A 299 → 298 (1 edge, child 99231 → parent `549300CZ8QS1GE53O776`, wrong-LEI, RC-12, listed under E-1) | §3.0 E-A row; §3.1 Edges row (298 + 1 + 215 = 514); §4.1 E-A row; §4.2 E-A cost; §4.2b a‴; §9 sample; §11 lists; §15; §16 | 114, 146, 237, 261, 283, 567, 610, 701, 757 |
| **F-2** P/A overlap: P 365 → 308; 51 A-row parents → ECA 45 after A (E-2 applied-parent check, E-4 block); 6 T1_LAPSED parents deferred, 3 edges wait; mirrors still written; rejected alternative recorded | Goals 4; §3.0 P / E-C rows; §3.3 P paragraph + ruling block + edges sentence; §4.1 P, E-C, new ECA rows; §4.2 P / E-C / new ECA rows; §4.2b f′/f″, total, partial GO, Option 2; §4.2c; §4.4 calendar + sequencing; §9 counts; §10 order + rollback; §11; §15; §16 | 78, 118–119, 168, 174–184, 229, 234, 236, 253, 258, 260, 268, 287–303, 321–323, 380, 383, 385, 388, 395, 562–563, 578, 580, 610, 699–700, 756 |
| **F-3** read budget: 2 reads per `IN` row; pre-image/read-back/CAS ≈ 140k; plan ≈ 290k; ceiling proposed 350k (Ops rules Thu 15); export multiplier unmeasured (≈ 436k if 2×) | §6 read table + notes; §15 Plan reads row; §16 | 447–452, 706, 759 |
| **OQ-3** `reasons_all` verbatim, pipe-joined, GLEIF order | §3.5 | 215 |
| **OQ-4** mirror names = GC legal name | §3.5 | 216 |
| **OQ-5** 011 never writes `updated_at` | §3.5 | 217 |
| **OQ-6** `lei_status` only where NULL | §3.5 | 218 |
| **OQ-12** report-only list definitions (1,342 / 1,739 / 852 / 2,336; sub-split non-binding) | §3.5; §11 lists reference | 219, 610 |
| **Rulings recorded:** ML-1012-1 (60k ceiling; window max(45 min, since last fetch)); ML-1010-3 (actual ingest writes count to 25k/day); OQ-7/8/9 accepted | §3.5 recorded rulings; §4.3 ceiling text, new F-5-in-force and ML-1010-3 bullets, checkpoint row; §16 | 221, 342, 354–355, 364, 760 |
| Status / change note | Header | 12, 14 |

## Changed numbers (old → new)

| Figure | rev 1.9 | rev 1.10 | Check |
|---|---|---|---|
| E-A edges | 299 | 298 | F-1 |
| P parent rows | 365 | 308 | 365 − 51 − 6 |
| E-C edges | 728 | 680 (+ ECA 45 + 3 waiting = 728) | F-2 |
| Direct edges total | 1,027 | 1,023 | 680 + 45 + 298 |
| `legal_parent` edges after run | 1,093 | 1,089 | 66 + 1,023 |
| P writes | 4,015 | 3,388 | 308 × 11 |
| E-C writes | 2,912 | 2,720 | 680 × 4 |
| ECA writes | — | 180 | 45 × 4 |
| E-A writes / a‴ | 1,196 | 1,192 | 298 × 4 |
| f′ / f″ | 0 / 0 | −12 / −627 | (725−728)×4; (308−365)×11 |
| Plan, no-drain | 89,153 | 88,510 | −627 −12 −4 = −643 |
| Plan, expected | ≈ 86,505 | ≈ 85,862 | −643 |
| §4.2c range | 87,049 to 83,881 | 86,406 to 83,238 | −643 |
| Reconciliation | −11,220 | −11,863 | 100,373 − 88,510; A side +5,663 → +5,659 |
| Ceiling margin text | 107k | 106k | 88,510 × 1.2 |
| Partial GO | 57,087 / ≈ 54,439 | 56,268 / ≈ 53,620 | −627 −192 |
| Option 2 equivalent | ≈ 10.0k | ≈ 9.2k | −819 |
| Full rollback | ≈ 87.9k / 85.2k | ≈ 87.3k / 84.6k | edges 4,092 + parents 3,388 |
| Sat 17 pilot | ≈ 5,200 | ≈ 4,570 | −627 |
| Tue 20 | ≈ 22,950 | ≈ 22,760 | −192 |
| Thu 22 | ≈ 13,430 | ≈ 13,610 | +180 −4 |
| `sqlite_sequence` risk | +365 | +308 | P |
| Account ceiling (§4.3 text, checkpoint row) | 70,000 / 70k | 60,000 / 60k | ML-1012-1 |
| Reads: pre-image/CAS | ≈ 45k | ≈ 140k | F-3 |
| Reads: plan / ceiling | ≈ 195k / 250k | ≈ 290k / proposed 350k | F-3; Ops rules |

## Open questions (for the Main Lane; no spec change made)

1. **Read ceiling** — the Operations Lead rules on the proposed 350k on Thu 15.
2. **Export multiplier** — unmeasured. If Friday's export bills 2 rows per row, plan ≈ 436k and the ceiling needs re-ruling before the Sat 17 pilot.
3. **§9 "LEI-bearing rows 16,627 + 3,677 = 20,304"** may omit the 308 P rows (which also carry LEIs). Left unchanged; the Main Lane or build should confirm the intended basis.
4. **013 impact** — whether any of the 51 A-row parents or the 6 deferred T1_LAPSED parents sit in a KI 22.41 pair. 013 brief not edited (prohibited); question only.
5. **§5 criterion 4 approved wording** (line 410: "≤ 60k in total, ≤ 20k per day") predates the plan figures and was not edited, per the Control; noted only for consistency.

## Independence

This lane authored the spec; it has not reviewed its own work. Rev 1.10 needs the usual independent review before the build uses it.
