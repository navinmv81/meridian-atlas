# LANE-1-OPS: REPORT

```text
FROM:         Operations Lead (LANE-1-OPS, Cowork; doc-only; 0 D1 reads/writes; no git writes)
TO:           Program Orchestrator (Main Lane)
RE:           claude/relays/LANE-1-OPS_NEXT.md (Fri 9 Oct, 3rd pass): 011 Ops review
DATE:         2026-10-09, about 16:30 UTC
SUPERSEDES:   this file's 9 Oct 2nd-pass version (7d50ed07…c70f). OPS-R4, R5 and R6 stand unchanged.
```

## What I did

- **Re-hashed before reading:**
  - `claude/MA-OCT-011_Spec.md` rev 1.7: `304628940eec41b2df605fc94ddeb8d5c49036752c5fd49a14ffaad4142cadf0` ✔ (matches NEXT);
  - `claude/MA-OCT-013_Spec_Brief.md` rev 1.5: `8319cc092aef020f7239c0fc5643f578f028ef971ff71453395b62088d7b2085` ✔.
- **Reviewed** 011 §1–§13 and the 013 brief in full, against N-2, N-4, N-6, N-7, E-1 to E-5, F-1 to F-5, OPS-R6 and the three-point check. The calendar was also checked against the account gate.
- **Wrote:** `claude/MA-OCT-011_Ops_Review.md`, **SHA-256 `976f08379f3f8324bb8ea8eb37e74d1c61f6a86af4c4cb07c6596190d34428f9`** (verified on disk after writing).
- **No locks** were found and no git writes were made.

## Verdict: **PASS WITH NOTES** (OPS-R7)

Every binding condition is present in rev 1.7. The three-point check passes:
- all SEARCH, apart from the declared covering-index scan;
- the largest single execution is ≤ 5k reads;
- reads ≈ 195k of 250k, and writes ≈ 86.5k at ≤ 25k a day;
- Monday 19 Oct is about 58k on the account, within the 70k gate.

**Four doc-only items are required before the build brief** (Main Lane hash check, no new review):

- **R-1. E-4 timing gap.**
  - The Sat 17 pilot has no A rows, and the sampled diff checks execution against the plan's own source. So a wrong T1 identity would only surface after E-A on Thu 22.
  - **Fix:**
    - ≥ 15 of the Fri 16 freshness-gate calls are A rows, and any A identity mismatch triggers E-4 before any A or E-A write;
    - E-A runs only after every A batch's read-back diff has passed;
    - ≥ 10 of the 25 post-run API spot checks are A rows.
- **R-2. Rollback inputs retained independently of `gleif_006.db`.** Pre-images, the plan, checkpoints and the run log are kept ≥ 30 days after 011 closes, and until 013 closes, with SHA-256s in the close-out.
- **R-3. 013 independent of the DB.**
  - The 011 close-out exports the full write payload (Level 1 and Level 2 plus provenance) for the 9 deferred LEIs / 22 rows into the 013 hand-off file.
  - Otherwise, R4/N-6 deletes the DB before 013 can write them.
  - 013 adds a ≤ 10-call freshness re-check.
- **R-4. Daily reconciliation mechanics.**
  - The Engineering Lead exports each run day's `ops_job_run` rows (≤ 300 reads, indexed) plus `runlog.jsonl`, with SHA-256s, to `gleif-011/recon/<date>/`.
  - The Operations Lead signs a one-line result in a relay report by 09:00 UTC the next day.
  - An unsigned day blocks the next day's first batch.

**Notes:**
- **N-1:** align the wording to OPS-R6 (Ops authorises; LANE-1-ENG executes).
- **N-2:** `expected_max_duration_s` is per batch (about 900 s), not per day.
- **N-3:** no `meridian-ops`, `OPS_INGEST_KEYS` or Entities Worker deploys on 17–23 Oct, except an emergency rollback.
- **N-4:** a full rollback is about 4 days (Founder decision; 26–29 Oct).
- **N-5:** 013 pack — record measured reads, including any temp-B-tree grouping.
- **N-6:** 013's spec must write out the 011 gates in full (F-1 to F-5, 25k a day, observability, freezes). The ETF Product Lead's review stays required.

**Recommendation for 12 Oct:**
- **Ops supports 011 spec approval and GO on Option 1** under the amended §9.2 wording, conditional on R-1 to R-4 and the Fri 16 release check:
  - outbox, or R-4 reconciliation;
  - A4 lag recorded (F-4/F-5);
  - T-1 registry row and key;
  - T-2 pause row;
  - the fail-closed test.
- **E-A kept** (OPS-R2 + R-1).
- **Fallbacks:** partial GO (B + C) or Option 2.
- **013:** the brief is accepted as the basis for its spec lane. Its spec approval stays blocked until the N-7 measurement (after ENT-CR1) and R-3.

## Rulings

| ID | Ruling |
|---|---|
| **OPS-R7** | 011 rev 1.7 + 013 brief rev 1.5: **PASS WITH NOTES**. R-1 to R-4 are required doc-only edits before the build brief. Ops supports GO on Option 1 at the 12 Oct gate on those conditions. |
| **OPS-R8** | The daily reconciliation protocol (R-4) is the Operations Lead's standing method for any local runner without the outbox: 011 now, and 008 and 013 later. |

## Questions

1. **Main Lane:** route R-1 to R-4 and N-1/N-2 to LANE-11 for a rev 1.8 (doc-only), and R-3 for 013 brief rev 1.6. Please give me the hashes once they're on disk, and I'll confirm them in one line.
2. **Main Lane:** put R-4's daily export step into LANE-1-ENG's 011 build brief, for each run day from Sat 17 Oct.
