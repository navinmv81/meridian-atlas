# MA-NOV-EXP.BFS.FIX — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.FIX_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS.FIX_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/packets/MA-NOV-EXP.BFS.REVIEW_Report.md` | `f8272b832e08a765a689245a7b21c1871f523fefc6f84976114c7fa8406a2a27` |
| `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md` | `20fbc06022f3b38d6ddf4c251ca5308066544ddd9f0ac8bef612c117da322049` |
| `claude/specs/MA-NOV-EXP_BF_Change_Request.md` | `adfc87b16a9115f9d1e931518c407a09d18be2f676649411aa6d26c99920c911` |
| `App/Corporate Atlas/src/exp-backfill.js` at HEAD (blob) | `693f7e60ddff4da296b472524ba0971a6a33b156` |

## Work
1. **M1:** constants `EXPBF_MAX_BATCHES_PER_RUN = 3`, `EXPBF_MAX_D1_CALLS_PER_RUN = 12`, `EXPBF_MAX_ROWS_READ_PER_RUN = 150000`; count D1 calls and `meta.rows_read` as the run goes; before each batch, project its calls and reads (pre-count reads × ~1 for the INSERT pair) and stop with `partial`/`run_limit` if any limit would be passed; add the three counters to the heartbeat metrics (stay ≤ 16 keys).
2. **M2:** after each batch, if `rows_written > left` (the budget before subtracting) → `EXPBF_BUDGET_OVERRUN`, end `failed`, no further batches.
3. **Tests:** 60-fund synthetic run → ≤ 3 batches, ≤ 12 D1 calls, `partial/run_limit`; a rows-read limit case; 1.24× multiplier → `failed` with `EXPBF_BUDGET_OVERRUN`; existing 16 tests unchanged in outcome.
4. Suites; dry-run build; commit "MA-NOV-EXP.BFS.FIX: per-run limits (M1) and budget overrun stop (M2)" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.BFS.FIX_Report.md`
Header; 1 Changes; 2 Tests; 3 Deviations; 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS.FIX`.
