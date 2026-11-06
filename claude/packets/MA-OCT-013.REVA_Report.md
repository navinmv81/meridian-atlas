# MA-OCT-013.REVA — Report (REVIEW-A, Architect)

**Control** v1 `fbc36aed91ac535f8b9b049b3754b718d03b2665924e03a4b1ef54d2a48d236d` (matches the STATUS_BOARD row) · **Task** v1 `89b3652dab62b16d468e29e0c68c7e300bc23911eda4ae3d2ca63c18f40c09f7` (verified).
**Inputs verified:**
- spec rev 0 `9a746677…69a3`
- SPEC report `d06c5e5b…c19d`
- code from git at `origin/October-2026` = `71fab4b`

**Date:** Fri 30 Oct 2026. **Git:** HEAD `71fab4b`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1, no deploys, no secret files.**

## Verdict: **PASS WITH NOTES** (rev 1 with M-1..M-7, then an Architect delta check before the Mon 2 run Control)

| Severity | Count |
|---|---|
| BLOCKER | **0** |
| MUST-FIX before run | **7** |
| NOTE | **6** |

**MUST-FIX items:**
- **M-1:** the rollback order breaks B13-4. Restore the survivor's old key before re-inserting the duplicate.
- **M-2:** guard every statement of a merge on the duplicate's pre-image, so a CAS miss changes nothing. Add the W1-A guard on the (iii) LEI.
- **M-3:** `managerissuerpositionquarterly`, `issuereventstream`, `issuerperiodsummary` and `financialfact_reported` hold entity ids and are not measured. Measure them through indexed paths and agree rebuilds with the owning lanes.
- **M-4:** duplicate column values (cik first) are lost on delete. Add a fill-only carry-over.
- **M-5:** the seed keys on `(normalized_name, type)`, so three-way and OTP twins can be re-created on 9 Nov. Run the seed dry run on all shapes.
- **M-6:** assert disjointness at plan time. 007 R3 follows 3 hops, not 5.
- **M-7:** an explicit partial-A2 gate before 013's first write.

## Outputs

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-013_Architect_Review.md` | `83d9c89416346dc3e7521692b03dfd6b6df9f0de492d76174c286becd15425fa` |
| `claude/packets/MA-OCT-013.REVA_Report.md` | this file (hash recorded by the Main Lane) |

Nothing else was written.
