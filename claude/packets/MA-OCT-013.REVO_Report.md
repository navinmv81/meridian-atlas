# MA-OCT-013.REVO — Report

```text
CONTROL:      MA-OCT-013.REVO Control v1, SHA-256 ac35abcd48a3c0ff46ada3ed2e9ba4122ef3dd6b62c052feeec43475d3d515e7 (matches STATUS_BOARD row 94)
TASK:         v1, SHA-256 d5b337ab7ed19638b9e9927d748e174704ca1c2042524d776249996d11fc244e (matches the Control)
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1, no deploys, no git writes, no secrets.
DATE:         Fri 30 Oct 2026, about 06:57 UTC (due Sat 31 18:00Z)
VERDICT:      PASS WITH NOTES
FINDINGS:     0 BLOCKER · 6 MUST-FIX before the run · 10 NOTE
```

## Preflight

- No `.git/*.lock` files. HEAD = `origin/October-2026` = `71fab4b`.
- Spec rev 0 `9a746677…69a3` ✔ and the spec report `d06c5e5b…c19d` ✔ (Task).
- FREEZES.json `4d8202bb…7fc` (A2 window re-pinned to Sat; no 013 window).
- **Independence:** this session wrote neither the 013 brief, nor the spec, nor the measurement.
- The Control header says "issued 07:00Z"; this session started 06:54Z. Recorded only.

## Output

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-013_Operations_Review.md` | `4a879de2ba828cdd5d8310cd1cae6d1e9bbb9c30f067a23ae64d36272ff28262` |
| `claude/packets/MA-OCT-013.REVO_Report.md` | this file |

## MUST-FIX (summary)

1. **M-1, Ops identity.**
   - Registry `manual.entity-merge-013`, emitter `merge-013`, `expected_max_duration_s = 900`.
   - New key K-1..K-4, put as its own step: Sat after A2 and the 005 deploy, or Mon ≥ 08:05 before the migration. Never during the run freeze. K-5 at close.
   - **Authorised for LANE-1-ENG.**
2. **M-2, kill switch:** own work dir and own pause/stop flags, plus one entry script with an env file (the A2 `gleif-a2.sh` pattern); a test that stop reaches the 013 runner.
3. **M-3, other writers.**
   - **Boost fires at 11:50 and 17:50 UTC during the run:** pause flag + `ops_job_pause` row Mon 2 08:00Z → Tue 3 00:10Z (authorised).
   - Confirm the seed run ended before the export.
   - Add the dated FREEZES window "013 run", Mon 2 08:00Z → Tue 3 00:10Z.
   - Enrich crons need no action if the run ends by 23:45Z.
4. **M-4, dangling-reference guard:** the step-4 delete requires `NOT EXISTS` in every child table, and a step-2/3 CAS miss stops the batch. **This is the one SQL change;** the Architect confirms it.
5. **M-5, Mon 2 margin and remainder rule.**
   - Account ≈ 66.5k / 70k; 013 ≈ 32.0k / 33k.
   - Any unrun tail goes to **November**, since Tue 3 has no production change.
   - Record the seed total and the projection before the export.
   - 013 and the site release run in sequence, never interleaved (013 first recommended).
6. **M-6, restore calendar:** per-batch same day (≈ 900 writes, ≤ ≈ 3 batches); a full rollback ≈ 31.5k is a Founder + Ops decision, **earliest Wed 4**, over 2 days. Inputs retained ≥ 30 days after close.

**Key NOTE:** the November A2 remainder must be re-planned from a post-013 export, because step 5 changes survivors' `normalized_name`, which A2's CAS pins (N-6).

## For the Main Lane

- Fold M-1 to M-6 into the 013 build brief or rev 0.1; a hash check is enough.
- Add the 013 FREEZES window.
- Issue a standing Ops R-4 grant for `merge-013/recon/2026-11-02/` (sign-off by Tue 3 09:00Z).

**Stop point:** both outputs written.
