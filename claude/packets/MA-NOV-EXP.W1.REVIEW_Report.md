# MA-NOV-EXP.W1.REVIEW — Report

```text
PACKET:   MA-NOV-EXP.W1.REVIEW · Control v1 45b43f50…7f82 · Task v1 621580c4…2804 · pins Spec 785df4d5…fc3e, W1 e3e2103c…eab9, W1R2 1a25afbf…7267 (all verified)
RUN:      r-20261112T071540Z-fc15 (interactive, LANE_OPENER_v2) · session 2546c065-15de-4c79-925a-3c61ee74f46e (did not author W1/W1R2)
ROLE:     Architect, with ETF Product Lead and Tech Ops sign-offs (spec §10)
VERDICT:  PASS_WITH_NOTES — 0 B, 1 M (deploy brief only, no code), 8 N. C-1 may proceed WITH CONDITIONS (§5).
```

## 1 What was checked
- **Commit:** `90331a1` = local HEAD = `origin/November-2026` (ls-remote). 4 files, all in `App/Corporate Atlas/` (`src/entities-api.js`, `tests/exp-route.test.mjs`, `tests/fixtures/exp/{schema,seed}.sql`). Nothing in `docs/`, other Workers or tomls. The working-tree `entities-api.js` equals the committed blob (23de727f…f140).
- **Tests (re-run):** exp-route 23/23. Regressions: retirement 77/77, nav-007-worker 58/58, fi-009-worker 133/133, fi-009-explain 14/14, merge-013 106/106, nav-007-key 34/34, nav-007-frontend 39/39. The dry-run build is OK (58.10 KiB / gzip 14.20 KiB, binding `DB` only).
- **Adversarial fixtures** (my own, run on a temp copy in the scratchpad):
  - a 20↔21 redirect cycle and a 30→30 self-loop both land in `redirect_unresolved`, with no infinite resolve;
  - a holding whose ISIN maps to entity 10 and whose CUSIP maps to entity 11 counts once, for 10;
  - zero-weight and NULL-weight rows are counted, weight 0;
  - an ISIN padded with spaces is trimmed;
  - CUSIP `000000000` goes to `no_identifier`;
  - tier n = 6 rows, and Σw is exact;
  - `'%20OR%201=1` returns 400 `invalid_symbol`, `2026-4` returns 400 `invalid_month`, and a lowercase symbol is normalised.
- **Code reading:** all SQL uses bound `?1/?2` only. The route is GET only. The A1 refusal comes after the month call and before the look-through (2 calls). Its boundary is tested: 10,000 → 200, 10,001 → 422, with the snapshot count and with the COUNT fallback. The refusal is logged as `exp_lookthrough_refused`. The cap is derived in code: 50,000 / 5.0 = 10,000, so the numbers cannot disagree.

## 2 Findings

| id | lvl | item | evidence | fix |
|---|---|---|---|---|
| M-1 | M | The C-1 rollback and version-capture commands in the W1/W1R2 notes have no config | There is no `wrangler.toml` at the repo root, and `wrangler rollback [version-id]` needs `-c` or `--name` | The C-1 Control must spell out `npx wrangler deployments list -c "App/Corporate Atlas/wrangler-entities-api.toml"` and `npx wrangler rollback <prev> -c "App/Corporate Atlas/wrangler-entities-api.toml" -m "…"` |
| N-1 | N | The edge cache (§4.5 control 1) is unproven | The Worker has no route and is served on `*.workers.dev` (the front end calls `meridian-entities-api.navinmv1981.workers.dev`). Cloudflare documents Cache API operations there as having no effect (the repo's own M-6 caveat). The Cache API is also per data centre | Prove it after C-1: a second identical call must return `x-exp-cache: hit`. If it returns `miss`, raise a KI and **block C-2** until a working cache exists (KV or a precomputed table) or the cap is lowered |
| N-2 | N | The cache key is not canonical | The key is the raw URL plus the contract, so `eem` vs `EEM` and any extra query parameter each make a new miss of up to 50k rows | Before C-2, key on the canonical `SYMBOL` + `month\|latest` only |
| N-3 | N | A1 trusts the snapshot `holdings_count` | Fixture: snapshot count 10, 10,050 complete rows → served. This follows the spec (§4.2 caps on `holdings_count`) | An Ops DQ check of snapshot count against complete rows, or cap on the larger of the two |
| N-4 | N | The 500 body is `{"error":"Internal error"}` (router catch), not spec `internal`, and has no `contract` | Router catch block | Align when it is next touched. The client treats any 5xx as *not loaded* anyway |
| N-5 | N | `/etf-exposure` `funds` counts joined rows | `fund_entity_link` has PK `etf_symbol`, so a holder entity with 2 symbols appears twice (the join was already there before W1) | Count `DISTINCT holder_entity_id` in a later packet |
| N-6 | N | D-5: `entities` is not sorted by weight (live order is entity_id ascending, verified) | Statement 2 | **Condition for W2:** the client sorts, with a test |
| N-7 | N | Three-hop chains go to `redirect_unresolved`, although `NAV_MAX_HOPS` allows 3 | SQL (rd3) | Two hops is what spec §4.2 says, and the bucket is visible. Accept |
| N-8 | N | ETF-lane observations | EEM 2026-02 `period_end` 2026-08-31 in the source data; the correlated `MAX` in `/api/etf-exposure` (spec §10) | ETF-lane KIs |

**Deviations judged.** All are **acceptable**: D-2 (two `LIMIT 1` month probes), D-4 (additive `net_assets`, `redirect_unresolved`, `contract` on errors), D-5 (unsorted entities, see N-6), D-6 (alphabetical tier list), D-7 (names in the same statement), D-8 (local Miniflare proxy), and 3 calls instead of 4 (the snapshot is merged into the month SQL).

**Identity (§3.2):** one map row per holding (map PK), and `entity_isin_map` is not referenced. Redirects take 2 hops, and anything left after that is bucketed `redirect_unresolved`. The tier is kept (heuristic → minconf 0). Unmapped and no-id rows are separate groups, keyed by row id, and never merged. Weights reconcile live (§4).

**`/etf-exposure`:** each holder reports at its own latest month. The `exposures` rows keep their shape. The new fields `funds`, `months_min`, `months_max` and `computed_at` are additive. The front end already labels the month per row (`ma-entities.js:1080`), so it is compatible.

## 3 Sign-offs
**ETF Product Lead: signed, with notes.**
- **Tables:** reads `etf_master`, `fund_holdings_monthly` and `fund_snapshot_monthly` only, with no writes.
- **No ETF changes:** the commit touches no ETF Worker, contract or toml.
- **Index dependency:** registered on `idx_holdings_status_series_month`. The live plan uses it (snapshot_status=? AND series_id=? AND report_month=?).
- **Overlap naming:** labelling the two overlaps "by security" and "by company" is a W3 obligation; nothing is shown in November before W3.
- **Notes:** see N-8.

**Tech Ops: signed, with conditions.**
- **D1 calls:** at most 3 per request.
- **Per-call reads, measured:** EEM 5,763, VXUS 38,254, a refusal ≈ 4, a cache hit 0. A typical ETF (≈ 900 holdings) costs ≈ 4.2k.
- **Daily budget:** with a working cache, one miss per ETF-month per colo per 24 h, so even every served ETF once ≈ 1M/day. **Without a cache (N-1) the cost is unbounded per call count:** about 130 VXUS calls use the shared 5M/day. That is why N-1 and N-2 gate C-2. The §4.5 review gate (7-day average > 500k/day) stands.
- **Logging:** the log line is present; it records the summed `rows_read`.
- **CPU, Free plan 10 ms:** the Worker does no per-row JS, but it does receive and splice a 357 KB VXUS body. **Blocking threshold:** any uncached VXUS request in `wrangler tail` with outcome `exceededCpu` (error 1102) or `cpuTime` > 10 ms. The response is rollback, or a lower cap set to the largest body that passes.
- **Rollback:** `wrangler rollback` to the captured version. It reverts the route and the `/etf-exposure` change together. The route is additive, and nothing calls it before C-2.

## 4 Queries run (live D1, read-only, repo root, OAuth, no `-c`): 4 of 4, 5,765 rows

| # | Statement | rows_read | ms |
|---|---|---|---|
| 1 | EXPLAIN QUERY PLAN look-through, EEM S000004266 2026-02 | 0 | 2.5 |
| 2 | Look-through EEM 2026-02 | **5,763** (W1R2 5,763, Δ 0%) | 68.6 |
| 3 | EXPLAIN QUERY PLAN `/etf-exposure`, entity 2191 | 0 | 0.3 |
| 4 | `/etf-exposure` SQL, entity 2191 | 2 | 0.9 |

- **Statement 1:** every real table is a SEARCH (`fund_holdings_monthly` via `idx_holdings_status_series_month`, the map autoindex, rd1–rd3 and `entity_master` by rowid). The only SCANs are of co-routines and `json_each`.
- **Statement 2:** the tiers match W1R2 and spec Q6 (n Σ 1,231; mapped 95.2606 = Σ entities; residual −1.51). 1,003 entities; TSMC 13.141305. Body 67,210 B.
- **Statement 3:** the query compiles on the live schema. It is a SEARCH on `idx_exposure_entity`, plus an automatic index on the ~264-row `fund_entity_link`.
- **Statement 4:** TSMC (2191) has **0 rows** in `entity_exposure_monthly`. So the live per-holder path was checked for compiling and cost, not for content. That content is covered by the local tests. The empty TSMC panel is the stale gate3 data that W5/W6 address.
- VXUS was not run, as the Task requires.

## 5 Recommendation: may C-1 deploy proceed? **Yes, with conditions**
1. **M-1** is fixed in the C-1 Control: `deployments list` and `rollback` both carry `-c "App/Corporate Atlas/wrangler-entities-api.toml"`. The previous version id is recorded **before** `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`.
2. Straight after the deploy, run `wrangler tail` against uncached EEM and VXUS:
   - CPU: the blocking threshold in §3.
   - `exp_lookthrough` rows_read within ±10% of 5,763 and 38,254.
   - SPAB and BNDX ≤ 50,000. If either is over, lower `EXP_ROWS_PER_HOLDING` in a fix packet.
   - BND, AGG and MBB return 422 `too_large`.
3. Make the same VXUS request twice and record `x-exp-cache`. If both are `miss`: KI, and C-2 stays blocked until N-1 and N-2 are fixed.
4. Regression: `/api/entities/{id}/etf-exposure` on an entity that has exposure rows returns 200 with `funds`, `months_min` and `months_max`. Spot-check one existing route, such as `/api/entities/search?q=pepsico`.
5. W2 sorts `entities` on the client (N-6).

Boundaries kept: this report is the only file written. No git writes, deploys, tails, secrets, D1 writes or subagents. Scratch files are in the session scratchpad. `13F Seed/gleif-seed.js` untouched.
