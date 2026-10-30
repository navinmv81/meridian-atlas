# MA-OCT-A2.REVA — Report (REVIEW-A, Architect)

**Control** v1 `bf6ed3e47ed4fccde717c0957a56d8d54696bed3962c8e56fedf6cf3953f51aa` (matches the STATUS_BOARD row) · **Task** v1 `a530cec1706debc0bf4b7283682eccdebad98127862f3c3c8733c455464b4724` (verified).
**Inputs verified:**
- spec rev 0 `226d07db…842d`
- DIL29 `95842115…37e6`
- 011 code at `58cd922` (5 files = spec §0)
- 6 work-folder inputs
- FREEZES on disk `9c368fa6…` (spec pins `b6d035f6…`; M-6)

**Date:** Thu 29 Oct 2026. **Git:** HEAD = `origin/October-2026` = `acfd069`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1, no deploys, no secret files.**

## Verdict: **PASS WITH NOTES**

| Severity | Count |
|---|---|
| BLOCKER | **0** |
| MUST-FIX before run | **7** (M-1 to M-7) |
| NOTE | **7** (N-1 to N-7) |

**MUST-FIX items:**
- **M-1 (run-stopper as committed):** the runner exempts only `'011 run window'`, so the new "A2 run window" would block every A2 batch. Add C-7, a configurable own-window prefix, with tests.
- **M-2:** the two-stage G-2 sample passes a 98%-precision matcher 7.4% of the time. Use one fixed design (recommended: 150 rows, 0 errors).
- **M-3:** an Ops spot-check of ≥ 15 rows on G-2.
- **M-4:** a full restore needs ≥ 2 run days, so 013 is held until it completes.
- **M-5:** `JOB_ID` must also drive the R-4 recon query and its manifest.
- **M-6:** re-pin FREEZES.
- **M-7:** carry C-1′ (a)/(b)/(c) and C-2 into the A2 run Control.

The matcher rules are correct against DIL29: all 26 wrong rows are excluded, and every row it calls fine is kept. Domain, budgets (≈ 195k reads; Fri ≈ 11k / Sat ≈ 21.6k writes), the three-point check, the acceptance criteria, the manifest, retention and the 013 hand-off all hold.

## Outputs

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-A2_Architect_Review.md` | `c95b07a785a8d1ca4ca1b8b01fd11c025ae88128a1258c009f92489d8a7d6b36` |
| `claude/packets/MA-OCT-A2.REVA_Report.md` | this file (hash recorded by the Main Lane) |

Nothing else was written.
