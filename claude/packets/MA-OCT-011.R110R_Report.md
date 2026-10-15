# MA-OCT-011.R110R — Report (REVIEW-A, independent Architect)

**Control:** `claude/packets/MA-OCT-011.R110R_Control_v1.md`, SHA-256 `aca097ac537e37ee1afa63b84dfe65fcf5e7df0dd72d6b57dacdbe8ea09248d0` (verified; matches the STATUS_BOARD row). Task v1 `f396fe0939ebdab979ae0e634dad3b871335b4f7310fd055dc5fda777f8977c3` (verified).
**Inputs verified:**

- 011 Spec rev 1.10 `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`
- rev 1.9 copy `e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22` (`diff -U0` = 43 hunks)
- R110 report `455cf4e00788403301adea11b91521180679ecf2d51f6132e3d03979b54e2f71`
- Architect Review before this packet `251ae4fca56a0600e8e865255a648a21261ccf2fa04498faa0f7924ca46d0904`

**Date:** Thu 15 Oct 2026, ≈ 05:45 UTC. **Git:** branch `October-2026`, HEAD `3960aee`; no `.git/*.lock`; read only with `--no-optional-locks`; no git writes. 0 D1 reads, 0 D1 writes, 0 GLEIF calls, no wrangler.

## Verdict: **PASS WITH NOTES**

Nothing blocks the Sat 17 pilot, which holds no A or ECA rows.

| ID | What | Owner | Due |
|---|---|---|---|
| **RA-15** (ruling) | ECA is treated exactly as E-A under E-4 and §4.4: (a) the same sequencing gate; (b) dropped with E-A when A stops, and any written ECA edges deleted; (c) restoring an A batch deletes the E-A edges whose child, and the ECA edges whose parent, is in that batch before the A pre-images are restored | Main Lane records; build applies | Fri 16 release check |
| **R110R-B1** (runner) | `abGate` applies the E-4 trigger and E-2 to ECA, but applies the E-A sequencing gate (all A diffs passed, adjudication, `--ea-release`) and `--drop-ea` to `EA` only. Extend them to `ECA`, or record an operating rule plus an A-restore procedure for ECA | Engineering Lead + Operations Lead | Fri 16 release check (before the first A batch) |
| **R110R-1** (doc) | §9 "LEI-bearing rows 20,304" is right only on the D2 basis. Table-wide after the run it is 16,627 + 3,677 + **308** = **20,612** (± drift). State the basis | Main Lane ruling or next revision | Before the Fri 23 verification |

## Answers to the Task

1. **F-2: sound.** It avoids 51 duplicate entities and keeps one-row-per-LEI. Arithmetic re-run ✔ (308; 680 + 45 + 3 = 728; plan 88,510; reconciliation −11,863 with 0 residual).
   - E-2 is kept (the applied-parent check).
   - E-4 is kept in substance, but its response wording names only E-A; that gap is closed by RA-15.
   - The §10 order Q → E-A → ECA → A → … → P is correct, and the build's `RESTORE_ORDER` matches.
2. **F-1: correct.** 298 + 1 + 215 = 514. 1,023 direct edges; 1,089 `legal_parent` edges after the run.
3. **F-3: no design objection.**
   - ≈ 290k reads is ≈ 5.8% of one day's cap, spread over 8 days; every execution is ≤ 1k reads.
   - The 2× export case (≈ 436k) is still fine.
   - Suggestions: pre-state the 2×-case ceiling now; extend §6 (ii)'s 20% recompute rule to reads.
   - The ceiling is the Operations Lead's ruling (OPSR).
4. **OQ-3/4/5/6/12: no objection.** One note on OQ-5 (N110-2): `updated_at DEFAULT CURRENT_TIMESTAMP` means the 308 P inserts carry insert-time `updated_at`. Tell Ops for 002's drift input. Consumers should find 011's changes by `gleif_enrichment_version = 11`.
5. **Loose ends.**
   - **Q3:** see R110R-1.
   - **Q5: consistent. The governing text is §5 row 4's "Proposed wording" column plus row "4 (N-4)"**, as the Founder accepted it at GATE-1012 D1 A. §5 is byte-identical in rev 1.9 and rev 1.10.
   - "≤ 60k total, ≤ 20k/day" (line 410) is the **original 006 wording column**, kept as history and not governing. Calling it "approved wording" in the R110 report and the 13 Oct log line is a mislabel.
   - ML-1012-1's 60k account ceiling tightens the amended "≤ 70k", so it is consistent.
   - The declared figures inside §5 (rollback ≈ 88k, partial GO ≈ 57.1k, Option 2 ≈ 10.0k) are rev 1.9 values. Rev 1.10's are all lower, so no gate is loosened. §4.2b, §4.2c, §10 and §15 govern the numbers.
6. **Earlier findings:** AR11-1, AR11-2/RA-12, RA-13, RA-14 and B13-1..B13-5 are **none weakened**. RA-12 is extended by RA-15.

**Notes:**

- N110-1: stale "299" in §3.1 E-3 (line 147); "E-A is held" in §4.4 (line 388).
- N110-2: the `updated_at` default (above).
- N110-6: the 45 ECA children's parent mirrors are transient, Tue 20 to Thu 22, and are parked if A stops.
- For 013: the hand-off should carry the 51/45 and 6/3 lists.

## Files written (write owner REVIEW-A only)

| File | Result |
|---|---|
| `claude/MA-OCT-011_Architect_Review.md` | **Appended** "Rev 1.10 delta check (15 Oct)". Was 164 lines `251ae4fc…0904`; now 266 lines `35eb3f274dbd8727ecd9eb110e855a2702b91bd59683a8236148a8e0cc8a7633`. The first 164 lines still hash to `251ae4fc…0904` (append-only proven). |
| `claude/packets/MA-OCT-011.R110R_Report.md` | This file (new). |

Not touched: the spec, the 013 brief, the runner code (read only), STATUS_BOARD, the Status JSON, and the Decisions Log. Those belong to the Main Lane.

## Independence

I did not author 011 rev 1.10, the R110 report or the 011 build. Item 6 checks my own earlier findings against someone else's revision; it is not a review of my own work.
