# MA-NOV-EXP.W1 — Report

```text
PACKET:   MA-NOV-EXP.W1 · Control v1 (970a10cb…c6c1) · Task v1 (4ef14d8c…2f64) · Spec 785df4d5…fc3e (all verified)
RUN:      r-20261111T211015Z-6802 (interactive, LANE_OPENER_v2)
ROLE:     Engineering Lead (Entities domain)
COMMIT:   none — stopped at a Control stop gate before the commit step. HEAD unchanged at f215681; nothing pushed.
OUTCOME:  STOPPED AT GATE — "single-execution reads for VXUS > 50,000". Measured cost is 9.3 rows read per holding,
          not the spec's 2.7. Projected VXUS ≈ 83k rows (not executed: it would also break the 100k session read cap).
          Code and tests are written and green locally, and left UNCOMMITTED in the working tree for the next decision.
          Nothing deployed.
```

## 1 Summary
R-EXP1 (`GET /api/exposure/etf/{symbol}`) and the `/etf-exposure` per-holder-latest-month fix are implemented to spec §4.2 / §5.3, with A1. The code lives in `entities-api.js`, and 19 route tests pass on local SQLite fixtures. On live D1 the look-through returns exactly the spec's measured EEM numbers. But it reads **11,477 rows for EEM's 1,231 holdings (9.3/holding)**, against the spec's budget basis of 2.7/holding (3,320 rows). The spec's own read estimates (§4.4), the A1 cap (50,000 rows ≈ 15,000 holdings) and the daily budget (§4.5) all rest on 2.7, so they are about 3.5× too low. At 9.3/holding:
- VXUS (8,878 holdings) projects to ≈ 83k rows.
- A 15,000-holdings cap would allow look-throughs of ≈ 140k rows.

This needs a Main Lane / Founder decision (§5). Nothing was committed.

## 2 What changed (uncommitted working tree; sha256 at stop)
`App/Corporate Atlas/src/entities-api.js` (7bf3630f…f172, +216 / −13):
- **Header (lines 1–20):** the "pre-computed tables only" rule now names the R-EXP1 exception (D1), and a read-budget block is added (spec §10 point 3, A1). The *numbers* in that block still state 2.7/holding and must be corrected once §5 is decided.
- **`handleEtfExposure`:** one D1 call. Each holder's latest month comes from `GROUP BY holder_entity_id` over `idx_exposure_entity`, then a PK join. `exposures` keeps its row shape. Additive fields: `funds`, `months_min`, `months_max`, `computed_at`.
- **R-EXP1:** constants (`EXP_CONTRACT='exp-1'`, `EXP_MAX_EST_ROWS=50000`, `EXP_ROWS_PER_HOLDING=2.7`, `EXP_MAX_HOLDINGS=15000`, TTLs), `EXP_LOOKTHROUGH_SQL`, `EXP_MONTH_SQL`, `expBuild`, `handleExpLookthrough`, cache helpers. A GET-only router entry sits before the FI block.
  - ≤ 3 D1 calls.
  - The body is built in SQL and spliced in without `JSON.parse`.
  - Two redirect hops; a third hop is bucketed `redirect_unresolved`.
  - The month uses `ORDER BY report_month DESC LIMIT 1`, never a correlated `MAX`.
  - A1 refuses with 422 `too_large` before aggregating.
  - Cache API: 200 for 24 h at the edge, browser `max-age=3600`; 404 `no_holdings` for 1 h; other errors `no-store`.
  - Logs `exp_lookthrough <sym> <month> <rows_read>`, and `exp_lookthrough_refused …` for refusals.
  - The CTE `r` is `MATERIALIZED`. That was the one bounded fix tried here: it took EEM from 14,416 to 11,477 rows, with a byte-identical body.

`App/Corporate Atlas/tests/exp-route.test.mjs` (3e57e75f…3c64) and `tests/fixtures/exp/schema.sql` (32d79e22…c2a), `seed.sql` (ee514c55…94fe): new, untracked.

## 3 Tests
`node --test "App/Corporate Atlas/tests/exp-route.test.mjs"` → **19/19 pass**. Covered:
- the latest complete month (a partial month is ignored), `previous_month`, `?month=`;
- F1 ETF A/B weights; the heuristic tier kept (minconf 0); a single entity per ISIN (the `entity_isin_map` fan-out is ignored);
- key derivation (ticker fallback, trimmed CUSIP); Y′ kept separate; residual;
- the unmapped and no-id buckets with negative weights (T7); Σ checks over 4 ETFs;
- redirects: 1 hop, 2 hops, and 3 hops (unresolved) (T8);
- `etf_not_found`, `invalid_symbol`, `invalid_month`, `no_holdings` (`no_series_id` / `none_complete`), `month_not_stored`;
- A1: 15,001 → 422; 15,000 → 200; the COUNT fallback with no snapshot;
- D1 calls ≤ 4 (3), the log line, no correlated MAX, local plans free of SCAN, the Cache API, POST not routed;
- `/etf-exposure` per-holder month and the empty case.

Regression suites, unchanged and passing: entities-api-retirement 77/77, nav-007-worker 58/58, fi-009-worker 133/133, fi-009-explain 14/14, merge-013 106/106. Build: `npx wrangler deploy --dry-run -c wrangler-entities-api.toml` OK (56.57 KiB, binding DB only).

## 4 Three-point check (live D1, read-only, from the repo root, OAuth)
D1 requests: 7 of 8. The first attempt failed with auth code 10000 and the one allowed retry after 30 s succeeded. Two empty-command attempts were refused locally by wrangler and never reached D1. Rows read in total: **28,731** (cap 100,000).

| # | Statement | rows_read | ms |
|---|---|---|---|
| 1 | (auth error 10000; retried) | — | — |
| 2 | EXPLAIN sizing query | 0 | 0.6 |
| 3 | Sizing: top ETFs by holdings + EEM/VXUS/SPY/BND, at the route's latest complete month | 2,838 | 18.9 |
| 4 | EXPLAIN `EXP_MONTH_SQL` (EEM) | 0 | 0.9 |
| 5 | EXPLAIN `EXP_LOOKTHROUGH_SQL` (EEM) | 0 | 1.3 |
| 6 | Look-through EEM 2026-02 (CTE not materialized) | **14,416** | 54.2 |
| 7 | Look-through EEM 2026-02 (`MATERIALIZED`, as left in code) | **11,477** | 53.6 |
| — | VXUS look-through | **not run** (projected ≈ 83k > the 50k gate; would also pass the 100k session cap) | — |

1. **Index audit (plans 4–5):** every real table is a SEARCH.
   - `fund_holdings_monthly`: `idx_holdings_status_series_month`, covering for the month probes.
   - `fund_snapshot_monthly`: PK. `instrument_entity_map`: `sqlite_autoindex_instrument_entity_map_1`. `entity_merge_redirect` ×3 and `entity_master`: rowid.
   - Temp B-trees for GROUP BY, ORDER BY and `group_concat(DISTINCT)`. No SCAN of any table; the SCAN lines are CTE or subquery co-routines only.
   - The SPY path stops after `etf_master` (SPY has no `series_id`, so 404 `no_holdings`).
   - Statement 3's own plan scanned `fund_snapshot_monthly` (small, via `idx_snapshot_series`) and `etf_master` (264 rows) only.
2. **Single-execution reads:** EEM 11,477 rows / 1,231 holdings = **9.3 rows/holding** (14,416 = 11.7 before materializing).
   - The body is correct: tiers `isin_tier1` 135/18.953, `openfigi_tier1` 160/7.777, `cusip_tier1` 87/2.651, `heuristic` 660/65.881, `unmapped` 169/6.403, `no_identifier` 20/−0.153.
   - 1,003 entities; TSMC 13.141 (heuristic, minconf 0); Samsung 6.767. These are identical to spec [M] Q6.
   - Body 67 KB; D1 duration 54 ms.
   - VXUS projects to ≈ 8,878 × 9.3 ≈ **83k** → **stop gate**.
3. **A1 refusals today** (route's latest complete month, snapshot count):

| ETF | Month | Holdings | At 15,000 cap | Projected rows at 9.3/holding |
|---|---|---|---|---|
| BND | 2026-03 | 17,368 | **refused** | ≈ 162k |
| AGG | 2026-05 | 13,269 | served | ≈ 123k |
| MBB | 2026-05 | 11,146 | served | ≈ 104k |
| VXUS | 2026-04 | 8,878 | served | ≈ 83k |
| SPAB | 2026-03 | 8,343 | served | ≈ 78k |
| BNDX | 2026-04 | 7,258 | served | ≈ 68k |
| EEM | 2026-02 | 1,231 | served | 11.5k (measured) |

A true 50,000-row cap at 9.3/holding would be ≈ 5,375 holdings. That would refuse all six large ETFs above, including VXUS, which the spec's T2 test uses.

**Read-budget declaration (as it would need to read after the decision):** ≤ 3 D1 calls; ≈ 9.3 rows/holding measured on EEM; 24 h edge cache; `exp_lookthrough` log line; A1 cap = the decided value.

## 5 Spec deviations and the decision needed
- **D-1 (blocking): read cost.** The spec's 2.7/holding basis (§4.4, A1, §4.5, §10) does not hold for the §4.2 query. D1 counts index rows, table rows, every LEFT JOIN probe and temp-table reads. Options for the Main Lane:
  - (a) Cap at ≈ 5,000 holdings to keep each look-through ≤ 50k rows. VXUS, SPAB, BNDX, MBB, AGG and BND are refused, and T2 needs a different pair.
  - (b) Keep 15,000 holdings and accept look-throughs up to ≈ 140k rows (once per ETF-month per 24 h, thanks to the cache). The §4.5 review gate then matters more.
  - (c) A W1 rev 2 that tries a leaner query: drop the in-SQL `entity_master` name join and `unmapped_top`, or split them into a second cheap call. The floor is probably about 4–5 rows/holding (the holdings index row, the table row, the map probe, the redirect probe), so VXUS would be about 40k. This would need its own measurement budget.
  - Recommendation: (c), then (a) using the newly measured ratio.
- **D-2 (made, minor):** the spec's month query `… ORDER BY report_month DESC LIMIT 2` over holdings rows would return the same month twice. Instead I use two `LIMIT 1` index probes in one statement, which give the latest and the previous month. Both are reads of about one row.
- **D-3 (made, minor):** A1's two numbers disagree. 15,000 × 2.7 = 40.5k, not 50k, and 50k / 2.7 = 18,518, which would *not* refuse BND. I used the explicit 15,000, which matches "BND today". This is superseded by D-1 anyway.
- **D-4 (made, additive):** the 200 body also carries `net_assets`, and the tiers can include `redirect_unresolved` (spec §4.2 note). Error bodies carry `contract`.
- **Noted:** the `/etf-exposure` plan uses a SQLite automatic index on `fund_entity_link` (about 264 rows). This is the same join as before.

## 6 Deploy notes for C-1 (not applicable until D-1 is decided and the work is re-reviewed)
- Command: `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`. Record the previous and new version ids first (`npx wrangler deployments list -c …`).
- Rollback: `npx wrangler rollback <previous version id>`. The route is additive; the front end is unaware of it until C-2.
- Verify after deploy:
  - `wrangler tail` on VXUS and BND (or the largest served ETF): Worker CPU under the Free 10 ms limit. The Worker only concatenates strings, but VXUS's body is about 0.5 MB, so measure it.
  - The `exp_lookthrough` rows_read numbers against §4.
  - A second request returns `x-exp-cache: hit` (workers.dev may make the Cache API a no-op, as noted in M-6).

## 7 Boundaries kept
- Writes only to `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/` (`exp-route.test.mjs`, `fixtures/exp/*`) and this report. Scratch files are in the session scratchpad.
- No deploy, tail, secret, `.env`, toml, or D1 write/DDL.
- 7 of 8 D1 requests, 28,731 of 100,000 rows. No npm install, no subagents.
- `13F Seed/gleif-seed.js` untouched. No Status/board/Tower/factory/Main Lane edits.
- No commit or push, because I stopped at a gate. Read-only git only (one `git stash list`, which is read-only; no stash was made).
