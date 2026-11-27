# MA-NOV-EXP.C1 — Report

```text
PACKET:            MA-NOV-EXP.C1 — Deploy exposure route to meridian-entities-api (C-1)
RUN:               r-20261112T211229Z-c3d3 (interactive, LANE_OPENER_v2)
EXECUTED BY:       Operations Lead
OUTCOME:           ROLLED BACK — rollback trigger "cpuTime > 10 ms" fired (VXUS 12 ms, EEM 11 ms)
PREVIOUS VERSION:  4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b (created 2026-10-30T16:03:44Z) — live again, 100%
DEPLOYED VERSION:  e6ddf979-9b35-4fa0-a53a-51cdc7991c6b (commit 90331a1) — rolled back
WORKER URL:        https://meridian-entities-api.navinmv1981.workers.dev
DATE:              2026-11-12
```

## Pre-checks (all passed)
| Check | Result |
|---|---|
| HEAD = `90331a1` = `git ls-remote origin November-2026` | `90331a17f0174f020e350f3174d1adf1196dba07` both |
| Working-tree `entities-api.js` = committed blob | `git diff --quiet 90331a1` exit 0 |
| `wrangler whoami` | OAuth Token login; no `CLOUDFLARE_API_TOKEN` in env |
| Previous version captured | `4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b` |
| Control / Task / pinned W1.REVIEW report sha256 | all match |

The first `wrangler deploy` attempt was blocked by the session's permission check. The Founder allowed it in chat ("Allow the deploy"). Only one deploy ran.

## Checks (new version e6ddf979; tail `--format json`)
| Step | Request | Status | x-exp-cache | rows_read (exp_lookthrough) | cpuTime | Pass |
|---|---|---|---|---|---|---|
| a | `/api/exposure/etf/EEM` | 200 | miss | 5,767 (target 5,763 ±10%) | **11 ms** | rows ✔ / **cpu ✘** |
| b | `/api/exposure/etf/VXUS` | 200 | miss | 38,258 (target 38,254 ±10%) | **12 ms** | rows ✔ / **cpu ✘** |
| c | `/api/exposure/etf/VXUS` (repeat) | 200 | **hit** | — (cached) | 1 ms | ✔ |
| d | `/api/exposure/etf/SPAB` | 200 | miss | 32,758 | 8 ms | ✔ |
| d | `/api/exposure/etf/BNDX` | 200 | miss | 25,160 | 5 ms | ✔ |
| e | `/api/exposure/etf/BND` | 422 `too_large` (17,368 holdings) | miss | 4 (refused) | 3 ms | ✔ |
| e | `/api/exposure/etf/AGG` | 422 `too_large` (13,269) | miss | 4 (refused) | 5 ms | ✔ |
| e | `/api/exposure/etf/MBB` | 422 `too_large` (11,146) | miss | 4 (refused) | 3 ms | ✔ |
| f | `/api/exposure/etf/SPY` | 404 `no_holdings` | miss | — | 2 ms | ✔ |
| f | `/api/exposure/etf/%27%20OR%201=1` | 400 `invalid_symbol` | — | — | 1 ms | ✔ |
| g | `/api/entities/10/etf-exposure` | 200 (`funds` 9, `months_min` 2026-01, `months_max` 2026-03) | — | — | 2 ms | ✔ |
| g | `/api/entities/search?q=pepsico` | 200 (3 results) | — | — | 1 ms | ✔ |

All tail outcomes were `ok`. There were no `exceededCpu`/1102 errors, no 5xx, and no `exp_lookthrough` over 50,000.

**Trigger:** the Control lists `cpuTime > 10 ms (review threshold)` as an immediate rollback trigger. EEM (11 ms) and VXUS (12 ms) exceeded it on uncached look-throughs. Neither request failed (both `ok`), but the threshold is the review's line, so the rollback is required.

## Rollback
`npx wrangler rollback 4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b -c "App/Corporate Atlas/wrangler-entities-api.toml" -m "MA-NOV-EXP.C1 rollback: cpuTime >10ms (VXUS 12ms, EEM 11ms)"` → SUCCESS, current version `4e7ee20b…`.

Re-checks after the rollback:
| Request | Status | cpuTime | Pass |
|---|---|---|---|
| `/api/exposure/etf/EEM` | 404 `Not found` (route gone) | 0 ms | ✔ |
| `/api/entities/10/etf-exposure` | 200 (old shape) | 5 ms | ✔ |
| `/api/entities/search?q=pepsico` | 200 | 1 ms | ✔ |

## Cache verdict (review N-1)
VXUS repeat returned `x-exp-cache: hit` (1 ms CPU). N-1 did not reproduce; the edge cache works on workers.dev.

## D1 rows read by the checks
- Route look-throughs (logged): 5,767 + 38,258 + 32,758 + 25,160 + 3 × 4 = **101,955**
- Direct read-only SELECTs (2 of the 2 allowed): `EXPLAIN QUERY PLAN …` (0 rows, covering index on `report_month`) and `SELECT entity_id FROM entity_exposure_monthly WHERE report_month='2026-03' LIMIT 1` (1 row → entity_id 10)
- `etf-exposure` / `search` requests: not logged by the route (small)
- Total ≈ **101,956 + the small unlogged reads**. That is about 2% of the 5M/day read cap. No writes.

## For the fix packet (Main Lane to decide)
CPU, not rows_read, is the binding constraint for R-EXP1 on uncached look-throughs. Rows per ms of CPU: about 3,200 for VXUS and about 4,100 for SPAB. The 50,000-row cap therefore does not keep requests under 10 ms CPU, and VXUS at 38k rows already exceeds it. Options include a lower row cap or `EXP_ROWS_PER_HOLDING`, cheaper aggregation in the Worker, or a precomputed table. The decision belongs to a spec/fix packet, not this one.

## Boundaries kept
One deploy and one rollback, both of `meridian-entities-api` only, with `-c` on every wrangler command. No toml, secret, route or cron change. Two read-only D1 SELECTs. curl GETs went only to the Worker's workers.dev URL, on Task paths only. No git writes, no `.env` reads, no tokens printed, no subagents. Not touched: `13F Seed/gleif-seed.js`, Status, board, Tower, `transitions.jsonl`. The tail ran in the background to a scratchpad file outside the repo and was stopped after the re-checks. The only file written in the repo is this report.
