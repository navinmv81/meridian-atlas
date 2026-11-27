# MA-NOV-EXP.W1R3.REVIEW — Report

```text
PACKET:   MA-NOV-EXP.W1R3.REVIEW — light review of c5d0cad against 90331a1 · run r-20261113T071302Z-0b84
BY:       Architect (fresh interactive session 4719b6a8-11fb-4eda-a4df-9ead291cd974; did not author W1/W1R2/W1R3)
VERDICT:  PASS_WITH_NOTES — no B, no M; 4 N
DATE:     2026-11-13
```

## What was checked
- **Commit:** `c5d0cad` = HEAD = `origin/November-2026` (ls-remote). There are 2 files, `src/entities-api.js` and `tests/exp-route.test.mjs`. The diff touches only the header read-budget comment and the R-EXP1 block (constants, `EXP_SQL`, `expBuild`, the cache-put comment). No other route changed. All 4 pins matched.
- **Tests:** exp-route 27/27. retirement, nav-007-worker, fi-009-worker and merge-013 have 0 failures. The dry run is OK: 58.56 KiB / gzip 14.33 KiB, binding `DB` only.
- **Old vs new, same DB (scratchpad):** I ran the `90331a1` and `c5d0cad` handlers on the shipped fixtures plus my own: a 40↔41 redirect cycle, a 42→42 self-loop, an ISIN/CUSIP conflict, zero and NULL weights, a non-ASCII/quote/emoji name, a `000000000` CUSIP, and ETFs at exactly 10,000 and 10,001 holdings. Results:
  - Every error body is byte-identical. The only exception is `too_large`, which gains `limit:"rows"` (D-4, additive).
  - Every 200 body is identical from `tiers` onward.
  - The 200 header differs only in `net_assets` rendering (N-1).
  - New code: 1 D1 call on every path. Old code: 1–3.
- **Statement:** all six values are bound (`?1…?6`), and the SQL is a constant. `i` and `m` are materialized, and `b` is materialized too, so the body is built once. The guard sits in `h`'s index key. Both the counting-view test and live MBB (14 rows) show that a refused ETF opens no holdings range. The `CASE … <= ?4` keeps an oversized body inside D1.
- **Caps:** `EXP_MAX_HOLDINGS` is still derived (10,000). `EXP_MAX_BODY_BYTES` = 131,072 is pinned by a test. Boundaries are tested: cap → 200, cap+1 → 422 for rows and for bytes, and 2-byte characters count as 2.
- **D-2 (size refusal cached 1 h): acceptable.** A stored month does not change, and the refusal still costs the full look-through (VXUS ≈ 38k rows). One hour rather than 24 h means a later cap raise takes effect within the hour. See N-2 for the cost side.

## Findings
| id | lvl | item | evidence | fix |
|---|---|---|---|---|
| N-1 | N | D-5 "`net_assets` is the same number" holds only to 15 significant digits | Fixture `123456789.123456789`: old `123456789.12345679`, new `123456789.123457`. Whole values gain `.0` (`1000000000.0`), which is the same number. Live EEM renders `30140446286.17`, correct. N-PORT values (cents, < $10T) fit in 15 digits | Accept. If exactness matters later, emit `net_assets` from the Worker or `printf('%!.17g')` |
| N-2 | N | W1.REVIEW N-2 (non-canonical cache key) is **unchanged, and slightly worse** | `expCacheKey` is unchanged (raw URL). VXUS was a 200 cached 24 h per URL variant; it is now a refusal cached 1 h per variant, so a miss re-reads ≈ 38k rows up to 24× as often | Still gates C-2: key on `SYMBOL` + `month\|latest` |
| N-3 | N | The comment "each [month probe] runs once" is not quite right | Plan (local and live): subqueries 3/4 appear twice inside `MATERIALIZE m` (`mm` is flattened, so `latest` is evaluated for the column and again in the CASE). Cost: about +8 index rows (EEM 5,775 vs 5,767) | Cosmetic. Fix the comment, or materialize `mm`, when next touched |
| N-4 | N | Earlier notes: W1.REVIEW N-4 (500 body `{"error":"Internal error"}`, no `contract`) and N-6 (`entities` in entity_id order; client must sort) | Both unchanged (router line 1627; live EEM order is by id). Neither is worse | N-6 stays a W2 condition |

## Recommendation: may C1R2 deploy `c5d0cad`? **Yes, with conditions**
1. **Deploy from the commit, not the preview id:**
   - Check `git rev-parse HEAD` = `c5d0cad…` and `git diff --quiet HEAD -- "App/Corporate Atlas"`.
   - Record the previous version with `npx wrangler deployments list -c "App/Corporate Atlas/wrangler-entities-api.toml"`. Expect `4e7ee20b`.
   - Run `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`.
   - The rollback is `npx wrangler rollback 4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b -c … -m "…"`.
2. **Rollback triggers are the same as C1:**
   - `cpuTime` > 10 ms on any uncached look-through;
   - any 5xx or `exceededCpu`;
   - `exp_lookthrough` > 50,000.
3. **Record these uncached `cpuTime` samples in tail:**
   - EEM (first request after deploy);
   - SPAB;
   - BNDX;
   - VXUS: expect a 422 with `limit:"size"`, and treat it as a pass.

   Also check that MBB returns a 422 with `limit:"rows"` at about 14 rows.
4. **Repeat EEM and check the cached copy:** the repeat should come back `x-exp-cache: hit`, and its body bytes should equal the miss body. That confirms in production that the shared `Uint8Array` body is copied correctly. Repeat VXUS too: it should be a hit with a 422.

No must-fix before C1R2.

## Queries run (live D1 `meridian-etf`, read-only, repo root, no `-c`): 3 of 3, 5,789 rows
| # | Statement (committed `EXP_SQL`, literals substituted) | rows_read | result |
|---|---|---|---|
| 1 | EXPLAIN QUERY PLAN, EEM | 0 | `MATERIALIZE i/m/b/a`. Every stored table is a SEARCH (holdings range on `idx_holdings_status_series_month`). SCANs only of `p`, `m`, `i`, `g`, `a`, `b`, `json_each` |
| 2 | EEM, latest | 5,775 | 2026-02; body 68,114 B in spec field order. Tiers n 87/660/135/20/160/169 (Σ 1,231). **1,003 entities, TSMC 13.141305**, unmapped_top 25 |
| 3 | MBB, latest | 14 | count_for_cap 11,146; body and body_bytes NULL (guard) |

Boundaries kept: this report is the only file written. No git writes, deploys, uploads, tails, Worker requests, D1 writes, installs or subagents. Scratch work stayed in the session scratchpad. `13F Seed/gleif-seed.js` was not touched.
