# MA-NOV-EXP.W1R2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-12
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — D-1 c (NML-1112-2); Start Approval in MA-NOV-EXP.W1R2_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W1R2_Control_v1.md
```

## Pins (verify before starting — W1's uncommitted state)
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1_Report.md` | `e3e2103c10ea809a85169b46634b446c18749d95e0d6040b5ad204e3565feab9` |
| `App/Corporate Atlas/src/entities-api.js` (working tree) | `7bf3630fdf8b90a0deb1d947d13cf20b2c79612bd7a7497cb69b7ded3906f172` |
| `App/Corporate Atlas/tests/exp-route.test.mjs` | `3e57e75fb9b6e0ba31ab87108d62729c7937c7804a22064b381f2c5f8f053c64` |
| `App/Corporate Atlas/tests/fixtures/exp/schema.sql` | `32d79e22bd241ec348466cac421329a6aa910642df883041c3d4dd740fdb8c2a` |
| `App/Corporate Atlas/tests/fixtures/exp/seed.sql` | `ee514c5538df104b9891bc8b9d3b536fd36a123bca5ae135c822ae5ac86894fe` |
| `claude/packets/MA-NOV-EXP.W1R2_Control_v1.md` | verified against `MA-NOV-EXP.W1R2_Status.json` |

## Work
1. **Leaner look-through** (W1 report §5 option c): reduce rows read per holding — e.g. remove the in-SQL `entity_master` name join and `unmapped_top` from the main aggregation and fetch names (and unmapped top items) in a second cheap call keyed by the result's entity ids; avoid temp B-tree reads you can avoid; keep **≤4 D1 calls** and the spec §4.2 response contract. Any contract change (e.g. names only for the top N) is a recorded deviation with reason, for the reviewer.
2. **Measure** on live D1 (Control limits; projection before each run): EEM rows_read and ms for the new SQL (both calls). Compute `r = rows_read / holdings`. If `r × 8,878 ≤ 45,000`, also run VXUS and record it; otherwise do not.
3. **Set the cap from the measurement:** `EXP_ROWS_PER_HOLDING` = the highest measured r rounded up to 0.5; `EXP_MAX_HOLDINGS` = floor(50,000 / that) rounded down to the nearest 100. Remove any constant that disagrees (W1 D-3). Update the header read-budget comment to the measured numbers.
4. **Tests:** update/extend `exp-route.test.mjs` for the split calls, names, the new cap boundary (cap → 200, cap+1 → 422) and keep all 19 behaviours; run all Corporate Atlas suites W1 ran; `wrangler deploy --dry-run`.
5. **Refusal list:** the ETFs the new cap refuses today (W1's sizing table; re-query only if needed).
6. **Commit:** `git add -- "App/Corporate Atlas/src/entities-api.js" "App/Corporate Atlas/tests/exp-route.test.mjs" "App/Corporate Atlas/tests/fixtures/exp/schema.sql" "App/Corporate Atlas/tests/fixtures/exp/seed.sql"` (plus any new test file, explicitly), one commit "MA-NOV-EXP.W1: R-EXP1 exposure route (measured ≤50k cap), /etf-exposure per-holder month, route tests", push `November-2026`, confirm with `git ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W1R2_Report.md`
Header (packet, run, commit, outcome); 1 Summary (r before → after, cap, served/refused list); 2 What changed vs W1; 3 Tests; 4 Three-point check (SQL, plans, rows_read, ms per call; declaration); 5 Deviations; 6 Deploy notes for C-1 (as W1 §6, updated); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W1R2`.
