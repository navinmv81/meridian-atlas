# MA-NOV-EXP.BFS.BUILD — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.BUILD_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS.BUILD_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md` | `20fbc06022f3b38d6ddf4c251ca5308066544ddd9f0ac8bef612c117da322049` |
| `claude/specs/MA-NOV-EXP_BF_Change_Request.md` | `adfc87b16a9115f9d1e931518c407a09d18be2f676649411aa6d26c99920c911` |
| `claude/packets/MA-NOV-EXP.BFS_Report.md` | `2d7aef3cdeb20d77fac459d2c9b8e25c31f681e5c465cf53c7c1cb286f57b294` |
| `App/Corporate Atlas/src/entities-enrich.js` at HEAD (blob) | `3221d1980c8e645819d1cd0975083a8ea82b45d1` |

## Approved decisions to build in
(1) runs in the 06:00 firing after Phase 1; (2) on/off = the existing Ops pause row for the job id (read it; creating rows is BFS.OPS); (3) cap read from `write_budget_profile` with a default of 40,000 if the row is absent; (4) analytics unavailable → `skipped/budget`; (5) skip Sun and Mon (UTC), run Tue–Sat; (6) the job ships OFF — the code must treat "no registry/pause/profile row yet" as **not run** (`skipped/not_enabled`), so a deploy before BFS.OPS can never write; (7) never re-compute a holder-month that has a coverage row.

## Work
1. Build `exp-backfill.js` exactly as the addendum (§2–§6), reusing the BFS-measured batch SQL with bound parameters and the coverage-exclusion clause; ≤ 12k holdings per batch (single larger fund alone, ≤ 18k); pre-count then one D1 transaction (`batch()`) per batch; `INSERT OR IGNORE` only; run token `g3v2s-YYYYMMDD-NN`.
2. Wire it into `scheduled()` for the 06:00 firing after Phase 1, isolated: an error in the back-fill never fails Phase 1 (catch, heartbeat failure, continue).
3. Tests B1–B9 from the addendum, plus: no rows → `skipped/not_enabled`; a batch never exceeds the remaining budget; Sun/Mon skip; token format.
4. B10: live `EXPLAIN QUERY PLAN` + one batch `COUNT` for 2026-04 holders 36..77 (expect ≈ 9.6k rows read, 2,426 exposure rows).
5. Suites; dry-run build; commit "MA-NOV-EXP.BFS.BUILD: scheduled exposure back-fill (exp-backfill.js) wired after Phase 1, ships off" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md`
Header; 1 What was built (functions, wiring lines); 2 Tests B1–B9 + extras; 3 B10 plan and counts; 4 Deviations; 5 Notes for BFS.OPS (exact rows to create) and BFS.DEPLOY (command, version capture, checks); 6 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS.BUILD`.
