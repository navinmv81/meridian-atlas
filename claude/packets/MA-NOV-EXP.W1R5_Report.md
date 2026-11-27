# MA-NOV-EXP.W1R5 — Report

```text
PACKET:     MA-NOV-EXP.W1R5 · Control v1 (32714f6a…a38f) · Task v1 (58a1c19e…cd1f)
RUN:        r-20261119T063152Z-48e9 (interactive, LANE_OPENER_v2)
COMMIT:     79822d50104cc0401dc965a8f26b0af53ed38495 on November-2026 (pushed; ls-remote = HEAD)
OUTCOME:    DEPLOYED
VERSIONS:   previous bb8ad0aa-3077-4dc1-8eb6-52abe546a826 (commit 54b1446) → new a9ffeaae-ea82-42cb-8bd8-32ac512f1c31
EXECUTED BY: Engineering Lead + Operations Lead (Claude Code, interactive)
```

## 1. Code and tests

**Route (`App/Corporate Atlas/src/entities-api.js`, R-EXP1 only)**
- New additive field **`newest_stored_month`** (`'YYYY-MM'`) on every 200 body. It sits after `previous_month`. It is also on both 422 `too_large` bodies (`limit:"rows"` and `limit:"size"`). 404 and 400 bodies are unchanged. Contract stays `exp-1`, and the header comment documents the field.
- **What "complete" means here.** The value is the newest `report_month` that any ETF has stored with `snapshot_status = 'complete'` in `fund_holdings_monthly`. This is the rule the route already uses for `report_month`, so a partial load never moves the value. `fund_snapshot_monthly` was rejected for two reasons: it has no completeness flag, and it has no index that leads with `report_month`.
- **Lookup.** No live index leads with `report_month`, and adding one is DDL, which is prohibited. The lookup is therefore a recursive descending skip-scan of `idx_holdings_status_series_month (snapshot_status, series_id, report_month)`.
  - Each step is one reverse covering-index seek, `snapshot_status='complete' AND series_id < previous … ORDER BY series_id DESC, report_month DESC LIMIT 1`. It lands on the previous series' newest complete month.
  - The cost is one seek per ETF that has complete holdings. It is not one read per holding row.
  - It runs inside the existing single statement (still one D1 call), is read once inside the materialized `i`, and is skipped when no month resolved, so 404s pay nothing.
  - A value that is not `YYYY-MM` becomes NULL.
- `EXP_CACHE_GEN` `g2` → **`g3`**.

**Client (`App/ma-entities.js`, EXP blocks only)**
- `exp_compute` now picks the reference month in this order:
  1. `opts.newest_stored_month`, if it is valid.
  2. The max of `newest_stored_month` over the loaded look-through bodies.
  3. Otherwise the W2 rule: the newest month in this portfolio.
- `months.newest_source` records which rule applied (`option` / `route` / `portfolio`).
- Stale is unchanged: more than 3 months behind (spec §5.1).
- The header strip shows the stale chip, followed by `newest stored: <Mon YYYY>`, when the month came from the route. When it fell back to the portfolio rule, the W2 wording ("…newest stored month here (Mon YYYY)") is kept.

**Tests (`App/Corporate Atlas/tests/`)**
- **exp-route (32/32).**
  - New W1R5 test using a counting view: the value is the newest complete month across all ETFs; a newer partial month does not move it; the series that sorts first is still reached; exactly 1 extra seek per added series; still 1 D1 call; `?month=` carries the field; 404s read no extra holdings.
  - Updated for the change:
    - cache key `g3`
    - the allowed plan SCANs now include the recursive CTE `ns`
    - the covering-index regex accepts the two new seek shapes
    - the field order includes `newest_stored_month`
    - the A1-guard tick bound is `8 + series + 1` and now also asserts the field on the 422 rows body
- **exp-compute (160/160), new checks:**
  - **T6: IYLD 100 at 2026-01 with the route month 2026-08 → stale** (7 months behind).
  - A portfolio of fresh ETFs only → no warning.
  - The reference is the max over loaded bodies.
  - The field missing (an older cached body) → the W2 fallback, so IYLD-only is not stale.
  - One body carrying the field is enough.
  - A malformed value is ignored.
  - The opts override still works.
- **exp-ui (173/173):**
  - The T6 header shows `Stale: IYLD …`, then the `newest stored: Aug 2026` chip.
  - A fresh portfolio shows no chips.
  - With the field missing, the W2 wording is kept.
- **Other suites:** all pass except `gleif-reconcile-011`, at 41/42. That failure was already there before this packet. Dry-run build: 59.51 KiB / gzip 14.59 KiB.

## 2. Sub-query plan and cost (live D1, 2 of the 3 allowed read-only statements)

1. **`EXPLAIN QUERY PLAN`** of the sub-query:
   - Seed: `SEARCH fund_holdings_monthly USING COVERING INDEX idx_holdings_status_series_month (snapshot_status=?)`.
   - Recursive step: `SEARCH … USING COVERING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id<?)`.
   - The only SCANs are of the CTE `ns`. There is no SCAN of a stored table and no temp B-tree.
   - rows_read 0.
2. **One execution** of the sub-query on its own:
   - `newest_stored_month = "2026-08"`
   - `series_seen = 241` (this matches the "241 ETFs with stored holdings" count)
   - **rows_read 485**, sql 32.4 ms.

Both results were within the stop gate (SEARCH only, ≤ 1,000 rows), so the deploy went ahead.

**Cost inside the full statement, measured after the deploy: +728 rows_read on every uncached request, exactly.** This is the same delta against W1R4 for EEM (5,775 → 6,503), SPAB (32,766 → 33,494), VXUS (38,266 → 38,994) and MBB (14 → 742). It is more than the 485 rows measured on its own, presumably because D1 also counts the ~242-row materialization of `ns` and the MAX over it.

Budget effect: bodies are cached 24 h, so this is +728 rows per symbol per day at most. For example, all 241 ETFs uncached would add ≈ 175k rows a day. That is still far below the 500k/day R-EXP1 review line, and real traffic is a small fraction of that. Worker CPU is unchanged: the body grew by 32 bytes.

## 3. Checks (workers.dev, after the deploy; tail connected and confirmed by the 400 probe first)

| Step | Request | Status | x-exp-cache | rows_read | cpuTime (wall) ms | Bytes | sha256 | newest_stored_month | Pass |
|---|---|---|---|---|---|---|---|---|---|
| probe | `/api/exposure/etf/%27%20OR%201=1` | 400 | — | — | 0 (0) | 45 | `bdb451d630d1…` | — | ✅ tail connected |
| a | `/api/exposure/etf/EEM` (first look-through after the deploy) | 200 | **miss** | 6,503 | **4** (171) | 68,146 | `11db740481029d229fa1d653b9136a87dc22685e40f75214eec52b1073108434` | 2026-08 | ✅ report_month 2026-02; 5,775 + 728 |
| b | `/api/exposure/etf/eem?x=1` | 200 | **hit** | — | 0 (13) | 68,146 | `11db7404…8434` (= a) | 2026-08 | ✅ |
| c | `/api/exposure/etf/IYLD` | 200 | miss | 786 | 3 (55) | 1,253 | `571e5496c04f525f0b0aceac97cc0162cf35d302dcb3e000d0a14b0c7f517fa5` | 2026-08 | ✅ month 2026-01, so the client flags it stale (T6) |
| d | `/api/exposure/etf/SPAB` | 200 | miss | 33,494 | 4 (191) | 74,606 | `af2833b36133a6a9fd090835d66c92f51963b74edf2facbc515f4f8a41d286a7` | 2026-08 | ✅ ≤ 50,000 rows; ≤ 10 ms |
| e | `/api/exposure/etf/VXUS` | 422 `too_large` `size` | miss | 38,994 | 2 (215) | 194 | `83eea1b8a1f9…` | 2026-08 | ✅ body_bytes 369,512 > 131,072 (not a rollback) |
| e | `/api/exposure/etf/MBB` | 422 `too_large` `rows` | miss | 742 | 1 (28) | 221 | `5cd0602e0519…` | 2026-08 | ✅ holdings 11,146 (not a rollback) |
| f | `/api/exposure/etf/SPY` | 404 `no_holdings` | miss | — | 1 (29) | 81 | `34c3f09bc968…` | — | ✅ |
| f | `/api/exposure/etf/%27%20OR%201=1` | 400 `invalid_symbol` | — | — | 0 (0) | 45 | `bdb451d630d1…` | — | ✅ |
| g | `/api/entities/10/etf-exposure` | 200 | — | — | 1 (17) | 1,360 | `22f95bdff3d3…` | — | ✅ |
| g | `/api/entities/search?q=pepsico` | 200 | — | — | 1 (145) | 914 | `e557e10e01a6…` | — | ✅ |

**Rollback triggers: none fired.**
- Max uncached cpuTime was 4 ms. There was no `exceededCpu` and no 1102.
- There were no 5xx and no exceptions.
- Max `exp_lookthrough` rows_read was 38,994.
- The cached body equals the miss body.
- The first look-through was a miss, so the generation bump took effect.
- `newest_stored_month` was present and in `YYYY-MM` form on every 200 and 422.

The tail was stopped after the checks.

## 4. Deviations
1. **The sub-query costs more than the Task expected.** The Task expected "a few rows" for the sub-query. It costs **485 rows on its own and +728 inside the statement**, because no index leads with `report_month`. The cost scales with the number of ETFs (241), not with the number of holdings, and it stays within the stop gate (SEARCH only, ≤ 1,000 rows). Making it a few rows would need a new index on `(snapshot_status, report_month)`. That is DDL, out of scope here, and would need its own Change Request.
2. **A1 headroom is reduced.** An ETF just under the A1 cap (10,000 holdings at the 5.0/holding estimate) could now read up to ≈ 50,728 rows. The measured ratios are 4.31–4.68 rows per holding, so no stored ETF comes close (max 38,994). This is noted for whoever next tunes `EXP_ROWS_PER_HOLDING`.
3. **The header chip only appears with the stale warning.** `newest stored: <Mon YYYY>` is shown as its own chip right after the stale chip, and only when a stale warning is shown and the month came from the route. The W2 wording stays as the fallback for older cached bodies.
4. **One D1 statement unused.** I used 2 of the 3 allowed D1 statements.

## 5. Boundaries kept
- **Files written:** only `App/Corporate Atlas/src/entities-api.js` (R-EXP1 only), `App/ma-entities.js` (EXP blocks only), three files under `App/Corporate Atlas/tests/`, and this report.
- **Not changed:**
  - toml, secrets, routes or crons
  - `docs/`, `generate-docs.mjs` or `index.html`
  - any other Worker, D1 data or schema (no writes, no DDL)
  - `.env*` (no token was printed)
  - Status, board, Tower or `transitions.jsonl` files
- **Git:** one commit, staged by explicit paths, and a fast-forward push to `November-2026`. No history was rewritten, and `13F Seed/gleif-seed.js` was left alone.
- **Deploy:** exactly one `wrangler deploy`, and no rollback was needed. No installs and no subagents.
- **Front end not released.** The `ma-entities.js` change is committed in `App/` but not mirrored to `docs/`, so the live site still runs the W2 stale rule. It will keep doing so until a front-end release (`generate-docs.mjs` → `docs/`) is approved separately.
