# MA-NOV-EXP.W1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-11
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W1_Control_v1.md
```

## Pins (verify before starting)
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1_Control_v1.md` | verified against `MA-NOV-EXP.W1_Status.json` |

## Work
1. **Read** spec §3.2, §4 (all), §5.1, §7, §8 C-1, §9 EXP.W1, §10, and the current `App/Corporate Atlas/src/entities-api.js` routing and `/etf-exposure` handler. Nothing else unless needed.
2. **R-EXP1** `GET /api/exposure/etf/{symbol}` exactly as spec §4.2 (params, response JSON incl. `contract`, tiers, unmapped/no-id buckets, `computed_at`, month resolution by `ORDER BY report_month DESC LIMIT 1` — **never** the correlated `MAX`), errors (incl. 404 `no_holdings`), Cache API (24 h edge, `max-age=3600`, errors uncached except 404 for 1 h), ≤4 D1 calls, aggregation and body built in SQL, `console.log` line `exp_lookthrough symbol month rows_read`.
3. **A1:** before aggregating, read the holdings count for the resolved month; if `count × 2.7 > 50,000` (i.e. > 15,000 holdings — make the constant explicit), return a documented error `too_large` (status per spec's error table, or 422 if the spec has none) with the count, and log it. Record which ETFs this refuses today.
4. **`/etf-exposure` per-holder fix** as spec §5.3 / §9 (per-holder latest month), same response shape (additive only).
5. **Read-budget header comment** in `entities-api.js` (spec §10 point 3, with A1's cap).
6. **Tests** in `App/Corporate Atlas/tests/`: `exp-route.test.mjs` + fixtures under `tests/fixtures/exp/` — a small SQLite DB built from SQL text in the test (schema from the repo migrations, only the columns used). Cover: two-month ETF picks the latest; heuristic tier kept; merge redirect applied; ISIN mapped to one entity only (no fan-out); unmapped and no-id buckets; weights sum check; unknown symbol; no holdings (404); A1 `too_large`; `/etf-exposure` per-holder month. Run against the handler with a D1-shaped adapter over SQLite.
7. **Three-point check** (≤8 statements, Control limits): (1) `EXPLAIN QUERY PLAN` of the final SQL (SPY-style and EEM) — no SCAN; (2) single execution of the final aggregation SQL for **EEM** and **VXUS** — record `rows_read` and duration; (3) holdings counts for the 5 largest ETFs' latest months (via `fund_snapshot_monthly`) to list what A1 refuses. Write the declaration (point 3) into the report too.
8. **Build check:** `npx wrangler deploy --dry-run` with the entities-api config, if present; otherwise `node --check`.
9. **Commit:** `git add -- "App/Corporate Atlas/src/entities-api.js" "App/Corporate Atlas/tests/<each file>"` (explicit paths only), one commit "MA-NOV-EXP.W1: R-EXP1 exposure route (A1 cap), /etf-exposure per-holder month, route tests", push `November-2026`, confirm with `git ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W1_Report.md`
Header (packet, run, commit, outcome); 1 Summary; 2 What changed (functions, lines); 3 Tests (count, pass); 4 Three-point check (SQL, plan lines, rows_read, duration; A1 refusals); 5 Spec deviations (none expected; each with reason); 6 Deploy notes for C-1 (exact command, rollback = redeploy previous version id, what to verify after: CPU via `wrangler tail` on VXUS — the Worker Free 10 ms limit); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W1`.
