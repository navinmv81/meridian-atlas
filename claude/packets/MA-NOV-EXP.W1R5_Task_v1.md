# MA-NOV-EXP.W1R5 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Engineering Lead + Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1R5_Status.json (= code change + production deploy)
CONTROL:      claude/packets/MA-NOV-EXP.W1R5_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md` | `be8ddf80e0cfc32cca42885fa74952a0cdea34d5fe2a92576a0bd4bb8644e8f5` |
| `claude/packets/MA-NOV-EXP.W1R4_Report.md` | `a26673d4383dca8c44d78bf9153a3528d0e482081fc5ad327dc2f79e7412aac0` |

## Part 1 — code (C = `-c "App/Corporate Atlas/wrangler-entities-api.toml"`)
1. **Route:** add `newest_stored_month` (`YYYY-MM`) to every R-EXP1 200 body (and to 422 bodies if cheap): the newest **complete** stored holdings month across all ETFs, from an index (e.g. `MAX(report_month)` on `fund_snapshot_monthly` or `fund_holdings_monthly` via a covering index — pick the cheapest correct one and justify "complete"). Inside the existing single statement; still one D1 call. Bump `EXP_CACHE_GEN`. Document the field in the header comment (additive, contract unchanged otherwise).
2. **Prove the cost** (≤ 3 read-only statements): `EXPLAIN QUERY PLAN` of the sub-query (SEARCH, no SCAN) and one execution (rows_read, value).
3. **Client:** `exp_compute` takes the newest stored month from the look-through bodies (max over loaded inputs) and flags an ETF stale when its month is more than 3 months older (spec §5.1); the header strip shows "newest stored: <Mon YYYY>" next to the stale chip. Tests: T6 (IYLD-only → stale warning), a fresh-only portfolio → no warning, the field missing (older cached body) → falls back to the W2 behaviour.
4. Suites (gleif-reconcile-011 41/42 pre-existing); dry-run build; commit "MA-NOV-EXP.W1R5: newest_stored_month on R-EXP1 for the stale warning" (explicit paths); push; `ls-remote`.

## Part 2 — deploy and measure
5. **Pre-checks:** HEAD = origin; `git --no-optional-locks diff --quiet HEAD -- App`; `whoami` OAuth; `deployments list C` → `bb8ad0aa…` (record).
6. **Deploy** `npx wrangler deploy C`; record the new version id. **Tail** to a scratch file; confirm connected.
7. **Checks** (status, `x-exp-cache`, bytes, sha256, tail outcome, cpuTime, rows_read, `newest_stored_month`):
   a. `/api/exposure/etf/EEM` — first request after deploy; **miss**; 200; rows ≈ 5,775 (+ the sub-query's few rows); field present.
   b. `/api/exposure/etf/eem?x=1` — hit; sha256 = (a).
   c. `/api/exposure/etf/IYLD` — miss; 200; month 2026-01; field = the newest month (expect 2026-08 or later).
   d. `/api/exposure/etf/SPAB` — miss; 200; rows ≤ 50,000; cpu ≤ 10.
   e. `/api/exposure/etf/VXUS` — 422 `size`; `/api/exposure/etf/MBB` — 422 `rows`.
   f. `/api/exposure/etf/SPY` — 404; `/api/exposure/etf/%27%20OR%201=1` — 400.
   g. `/api/entities/10/etf-exposure` — 200; `/api/entities/search?q=pepsico` — 200.
8. Stop the tail. **Rollback** on any trigger: `npx wrangler rollback bb8ad0aa-3077-4dc1-8eb6-52abe546a826 C -m "MA-NOV-EXP.W1R5 rollback: <reason>"`; confirm (g).

## Report — `claude/packets/MA-NOV-EXP.W1R5_Report.md`
Header (packet, run, commit, outcome DEPLOYED / ROLLED BACK, previous and new version ids); 1 Code + tests; 2 Sub-query plan and cost; 3 Checks table; 4 Deviations; 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W1R5`.
