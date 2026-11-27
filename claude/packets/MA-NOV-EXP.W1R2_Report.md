# MA-NOV-EXP.W1R2 — Report

```text
PACKET:   MA-NOV-EXP.W1R2 · Control v1 (21b67eb7…c880) · Task v1 (44b112d5…035b) · Spec 785df4d5…fc3e
          W1 pins verified before starting (W1 report e3e2103c…eab9, entities-api.js 7bf3630f…f172, test 3e57e75f…3c64,
          schema 32d79e22…c2a, seed ee514c55…94fe)
RUN:      r-20261112T065238Z-a2f4 (interactive, LANE_OPENER_v2)
ROLE:     Engineering Lead (Entities domain)
COMMIT:   90331a17f0174f020e350f3174d1adf1196dba07 on November-2026, pushed; git ls-remote confirms the tip
OUTCOME:  DONE. Single-pass look-through: 9.3 → 4.68 rows/holding on live EEM. Measured cap 10,000 holdings
          (50,000 / 5.0). VXUS is served (38,254 rows, measured). Tests green. Nothing deployed.
```

## 1 Summary
- **Read cost, live D1:**

  | ETF | Holdings | W1 rows (per holding) | W1R2 rows (per holding) | ms |
  |---|---|---|---|---|
  | EEM 2026-02 | 1,231 | 11,477 (9.3) | **5,763 (4.68)** | 69 |
  | VXUS 2026-04 | 8,878 | not run (≈ 83k projected) | **38,254 (4.31)** | 322 |

  The two lookup calls add about 4 rows per request (etf_master 1, month 3).
- **Cap (A1 / D-1 c):** `EXP_ROWS_PER_HOLDING` = 5.0, the highest measured r (4.68) rounded up to 0.5. `EXP_MAX_HOLDINGS` = floor(50,000 / 5.0) to the 100 below = **10,000**. It is derived from the other two constants in code, so the three numbers cannot disagree (W1 D-3 closed).
- **Served and refused today** (from W1's sizing table; not re-queried):

  | ETF | Holdings | Result | Look-through rows |
  |---|---|---|---|
  | BND | 17,368 | **refused** (422) | — |
  | AGG | 13,269 | **refused** | — |
  | MBB | 11,146 | **refused** | — |
  | VXUS | 8,878 | served | 38,254 measured |
  | SPAB | 8,343 | served | ≈ 41.7k projected at 5.0 |
  | BNDX | 7,258 | served | ≈ 36.3k projected at 5.0 |
  | all others | ≤ 7,258 | served | — |

  Even at 6.0 rows/holding, SPAB (≈ 50.0k) and BNDX (≈ 43.5k) stay at or under 50k. The bond ETFs' ratio is unmeasured (see §6).
- **Body unchanged in substance.** EEM and VXUS give exactly the W1 and spec [M] Q6 / T2 values. EEM tiers: `isin_tier1` 135/18.953, `openfigi_tier1` 160/7.777, `cusip_tier1` 87/2.651, `heuristic` 660/65.881, `unmapped` 169/6.403, `no_identifier` 20/−0.153; 1,003 entities; TSMC 13.141, Samsung 6.767. VXUS: TSMC 3.928, Samsung 1.854, mapped 93.615, unmapped 5.224, no-id 2.524; 5,708 entities. EEM body 67.2 KB; VXUS body 357 KB.

## 2 What changed vs W1
`App/Corporate Atlas/src/entities-api.js` (final 23de727f…f140):
- **`EXP_LOOKTHROUGH_SQL` rewritten as a single pass.**
  - The holdings index range is read once. It streams through the map probe and three redirect hops (LEFT JOIN, rowid) into **one** `GROUP BY` sorter.
  - Groups: one per company, plus one per unmapped, no-identifier or `redirect_unresolved` holding. Those are keyed by the holding's row id, so unmapped rows are never merged.
  - Tier totals are conditional sums in that same pass. The four `source` values are fixed by the map's CHECK constraint, plus the three buckets. `json_patch('{}', …)` drops tiers with no rows.
  - The outer aggregate reads the groups once and gets names by `entity_master` rowid, 1 seek per company.
  - `unmapped_top` = aggregate `ORDER BY w DESC, k` over the unmapped groups, cut to 25 with `json_each … LIMIT 25`.
  - Removed: the `MATERIALIZED` CTE and its three re-reads, `GROUP_CONCAT(DISTINCT)`, the separate tiers GROUP BY, and the weight sort of `entities`.
- **Constants:** 2.7 / 15,000 → measured 5.0 / derived 10,000. The comments cite the measurement.
- **Header read-budget block:** now gives the measured numbers, the per-holding floor, the cap derivation and the refused list. It points to this report.
- Unchanged: the month/snapshot SQL, call count (3), Cache API, logs, error contract, `/etf-exposure` fix and router.

**Options measured and rejected.** I measured these on a local workerd D1 (Miniflare, from the installed wrangler; synthetic EEM-shaped data in the scratchpad). Its `rows_read` for the W1 SQL was 11,257, against 11,477 live, so it is a faithful proxy.
- **Names in a separate call** (the Task's example): 2 rows per company, against 1 in-statement (1,458 vs 729 locally). Kept in-statement; ≤ 3 calls.
- **Redirect via an `IN (SELECT duplicate_id …)` set:** 34,487 rows locally, 6× worse. Kept as rowid LEFT JOINs.
- **Sorting `entities` by weight:** costs about 1 row per company (≈ 0.8/holding on EEM). Live, that would have made r ≈ 5.5–5.7, giving a cap of about 8,300–9,000, which refuses VXUS. Dropped (D-5).
- Per-holding floor: about 4 (range 1 · map 1 · redirect 1 · sorter 1), plus 1 per company.

Tests and fixtures:
- `exp-route.test.mjs` (d75019cf…17d8).
- `fixtures/exp/seed.sql` (865a09f9…3b67): the A1 boundary rows moved to 10,001 / 10,000, plus ETF `UNM` (30 unmapped rows with a weight tie, and entity 7 with no `entity_master` row).
- `schema.sql` unchanged (32d79e22…c2a).

## 3 Tests
`node --test "App/Corporate Atlas/tests/exp-route.test.mjs"` → **23/23 pass**. All 19 W1 behaviours are kept, with these updates:
- The F1 ETF A entity check compares as a set (order unspecified, D-5).
- A1 now uses the measured cap: 10,001 → 422 with `estimated_rows_read` 50,005, `max_holdings` 10,000, `max_rows_read` 50,000, and 2 calls; 10,000 → 200 with 3 calls; the COUNT fallback (no snapshot) at 10,001 → 422.

New:
- Names match `entity_master` for every entity in 4 ETFs (null where there is no row).
- The per-entity tier list is alphabetical and distinct (`cusip_tier1,isin_tier1` for the redirected survivor; minconf 80). `tiers` omits empty tiers.
- `unmapped_top`: 25 of 30 rows, weight desc, a tie ordered by key, the 5 lightest cut, Σ 47.8.
- Single-pass shape: no `MATERIALIZED`, no `GROUP_CONCAT(DISTINCT)`, one `fund_holdings_monthly` access, one GROUP BY temp B-tree and one names probe in the local plan.

Regression suites, unchanged and passing:
- entities-api-retirement 77/77 (incl. nav-007-key 34/34)
- nav-007-worker 58/58
- fi-009-worker 133/133
- fi-009-explain 14/14
- merge-013 106/106

The node:test wrappers for nav-007-frontend and nav-007-key also pass.

Build: `npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-api.toml"` OK, 58.10 KiB / gzip 14.20 KiB, binding `DB` (meridian-etf) only. Output went to the scratchpad.

## 4 Three-point check (live D1, read-only, from the repo root, OAuth, `--remote --command`)
D1 requests: **8 of 10**. **Rows read in total: 44,024** (cap 120,000). No statement was projected above 50,000 rows before it ran.

| # | Statement | Projection | rows_read | ms |
|---|---|---|---|---|
| 1 | `etf_master` series ids for EEM, VXUS | 2 | — (auth error 10000) | — |
| 2 | same, retried after 30 s | 2 | 4 | 1.3 |
| 3 | EXPLAIN (EEM) sent via `--file`. The import path returns no rows, so it was wasted | 0 | 0 | 4.2 |
| 4 | EXPLAIN QUERY PLAN look-through, EEM S000004266 2026-02 | 0 | 0 | 1.6 |
| 5 | Look-through EEM 2026-02 | 1,231 × 5 ≈ 6.2k | **5,763** | **69.1** |
| 6 | EXPLAIN QUERY PLAN look-through, VXUS S000002932 2026-04 | 0 | 0 | 1.8 |
| 7 | Look-through VXUS 2026-04 (run because 4.68 × 8,878 = 41.6k ≤ 45k) | ≈ 41.6k | **38,254** | **322.1** |
| 8 | `EXP_MONTH_SQL`, EEM, latest | ≈ 3 | 3 | 1.2 |

**1. Index audit (plans 4 and 6, identical).** Every real table is a SEARCH:
- `fund_holdings_monthly` USING INDEX `idx_holdings_status_series_month` (snapshot_status=? AND series_id=? AND report_month=?)
- `instrument_entity_map` USING INDEX `sqlite_autoindex_instrument_entity_map_1`
- `entity_merge_redirect` rd1/rd2/rd3 USING INTEGER PRIMARY KEY
- `entity_master` USING INTEGER PRIMARY KEY

Temp B-trees: one for GROUP BY, and one for `json_group_array(ORDER BY)` (unmapped groups only). The SCAN lines are only the co-routines `g` and `a`, the `json_each` virtual table and its subquery. There is no SCAN of any table. The month SQL is unchanged from W1, whose plan was SEARCH only.

**2. Single-execution reads:** EEM 5,763 (4.68/holding); VXUS 38,254 (4.31/holding). Both are under 50,000. With the 10,000 cap at 5.0/holding, the bound is 50,000.

**3. Read-budget declaration** (header of `entities-api.js`):
- ≤ 3 D1 calls; 4.68 / 4.31 rows per holding measured; cap 10,000 holdings = 50,000 / 5.0.
- Refusal costs ≤ 2 calls, ≈ 4 rows.
- 24 h edge cache, browser 1 h. `exp_lookthrough <sym> <month> <rows_read>` and `exp_lookthrough_refused …` log lines.
- The spec §4.5 review gate (500k/day 7-day average) applies.

**Daily budget (spec §4.5) at the new ratio:** a typical ETF (≈ 900 holdings) costs ≈ 4.2k uncached. 200 uncached ETF-months/day would be ≈ 0.85M (17% of 5M), and the edge cache keeps it far lower.

## 5 Deviations (for the reviewer)
- **D-5 (contract, minor):** `entities` order is now unspecified. In practice it is group order, entity_id ascending. It is no longer weight-descending.
  - Why: the weight sort costs about 1 row per company. It would have pushed the measured r to about 5.5–5.7, a cap of about 8,300–9,000, and refused VXUS, the spec T2 pair.
  - Spec §4.2's own SQL has no ORDER BY on `entities`, and spec §3 has the client sort the table.
  - The client (EXP.W2/W3) must sort. It does not rely on order today.
- **D-6 (contract, cosmetic):** the per-entity tier list (`entities[i][4]`) is alphabetical. W1's `GROUP_CONCAT(DISTINCT)` gave an arbitrary order.
- **D-7 (method):** names stay in the main statement. The Task suggested a second call, but that was measured to cost twice as much. Call count is 3 (≤ 4).
- **D-8 (method):** query shapes were compared on a local Miniflare/workerd D1 with synthetic data. That is not an npm install: it is the `miniflare` already bundled with the installed `wrangler`. Its state lived in the scratchpad only. Live D1 was used only for the 8 requests above.
- Carried from W1, unchanged: D-2 (two `LIMIT 1` month probes) and D-4 (additive `net_assets`, `redirect_unresolved`, `contract` on errors). D-1 and D-3 are closed by this packet.
- **Observation (not EEM scope):** EEM's 2026-02 snapshot has `period_end` 2026-08-31 in `fund_snapshot_monthly`. That is the source data. The route passes it through, so the ETF lane may want to look at it.

## 6 Deploy notes for C-1 (after EXP.W1.REVIEW PASS and Founder deploy approval)
- Command: `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`. Record the previous and new version ids first (`npx wrangler deployments list -c …`).
- Rollback: `npx wrangler rollback <previous version id>`. The route is additive, and the front end is unaware of it until C-2.
- Verify after deploy:
  - `wrangler tail` on **VXUS** (the largest served: 357 KB body, 322 ms in D1) and on EEM. Worker CPU must be under the Free 10 ms limit. The Worker only concatenates strings, but D1 result transfer for 357 KB is the risk to watch. If CPU is over 10 ms, stop and raise it.
  - `exp_lookthrough` rows_read against §4.
  - BND / AGG / MBB return 422 `too_large`.
  - A second request returns `x-exp-cache: hit` (workers.dev may make the Cache API a no-op, M-6).
- **Unmeasured:** the rows-per-holding ratio for the served bond ETFs (SPAB, BNDX). Bonds may have more unmapped single-holding groups. Their first `exp_lookthrough` lines after deploy should be checked against 5.0. Even at 6.0/holding both stay ≤ 50k.

## 7 Boundaries kept
- Writes only to `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/` (`exp-route.test.mjs`, `fixtures/exp/*`) and this report. All scratch files and local D1 state are in the session scratchpad. No `.wrangler/` was created in the repo.
- No real deploy, tail, secret, `.env`, toml, route or binding change. No D1 write or DDL.
- 8 of 10 D1 requests; 44,024 of 120,000 rows. No npm install, no subagents.
- One commit with exactly the four Task files (`git add --` explicit paths), pushed to `November-2026` only (not a Pages source). No force-push, branch change, rebase, reset, stash or clean.
- `13F Seed/gleif-seed.js` untouched. No Status, board, Tower, factory, LANE_OPENER or Main Lane edits.
