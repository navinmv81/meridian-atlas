# MA-NOV-EXP.BFS.GO — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Operations Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.GO_Status.json (= constant change + Ops rows + deploy; NOT the switch-on)
CONTROL:      claude/packets/MA-NOV-EXP.BFS.GO_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_BF_Change_Request.md` | `adfc87b16a9115f9d1e931518c407a09d18be2f676649411aa6d26c99920c911` |
| `claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md` | `d48b45b391beeee2658136bb60b8cbbba91cb9c84c687ed2234f75a4c08631f0` |
| `claude/packets/MA-NOV-EXP.BFS.REVIEW_Report.md` | `f8272b832e08a765a689245a7b21c1871f523fefc6f84976114c7fa8406a2a27` |
| `claude/packets/MA-NOV-EXP.BFS.FIX_Report.md` | `30e820ed66bf819718e71152c27641f3aeb9df714c12fa61d786801562538ccb` |

## Steps (C = `-c "App/Corporate Atlas/wrangler-entities-enrich.toml"`)
1. **A:** `EXPBF_MAX_ROWS_READ_PER_RUN = 300000`; update the boundary test; run the back-fill and enrich suites; dry-run build.
2. **B (file):** `App/Ops/migrations/registry-load-2026-11-20-expbf.sql` — in this order: pause row (`ends_at` 2099-01-01, reason "MA-NOV-EXP.BFS ships off until checks pass and the Founder switches on"), registry row (as BUILD report §5; `write_budget_profile` `{"daily_rows_written_cap":40000}`), case events `pause_added` and `registry_updated` (columns per migration 003 / the 003 procedure). Use `INSERT OR IGNORE` where the schema allows; no UPDATE/DELETE.
3. **Commit A + B** ("MA-NOV-EXP.BFS.GO: read limit 300k; expbf Ops rows (paused)", explicit paths), push, `ls-remote`.
4. **B (execute)** once; **verify** (≤ 4 SELECTs): registry row; pause row open (`ends_at` > now); 2 case events.
5. **C pre-checks:** `whoami` OAuth; `deployments list C` → capture the current version (rollback target); live `EXPLAIN QUERY PLAN` of the candidates SQL → `SEARCH … USING COVERING INDEX idx_holdings_status_series_month`.
6. **Deploy:** `npx wrangler deploy C`; record the new version id; confirm the deploy output lists crons `0 6 * * *` and `50 6 * * *` only and the same bindings.
7. **Rollback** on any trigger: `npx wrangler rollback <captured> C -m "MA-NOV-EXP.BFS.GO rollback: <reason>"`.

## Report — `claude/packets/MA-NOV-EXP.BFS.GO_Report.md`
Header (packet, run, commit, outcome, previous → new version ids); A change + tests; B SQL text + verification; C deploy output (crons, bindings); **BFS.CHECK instructions** (what to read after the next 06:00 run: expbf `skipped/pause`, Phase 1 heartbeat normal, no 5xx — and how, read-only); **switch-on SQL for FR13** (end the pause row + case event) and **switch-off SQL** (new pause row); boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS.GO`.
