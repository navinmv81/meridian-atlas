# MA-NOV-EXP.W1R3 — Report

```text
PACKET:              MA-NOV-EXP.W1R3 — Exposure route: cut CPU, body-size cap, preview measurement
RUN:                 r-20261113T064506Z-cb12 (interactive, LANE_OPENER_v2)
EXECUTED BY:         Engineering Lead (Entities domain)
OUTCOME:             CODE DONE, PREVIEW CPU NOT MEASURABLE — stop gate "preview URLs unavailable without a config
                     change" (variant: the preview URL serves, but its invocations never reach `wrangler tail`)
COMMIT:              c5d0cadf315658c89322139068f03c9fb8375e89 (pushed; = git ls-remote origin November-2026)
                     entities-api.js blob b6cfda6b33a773c64d11366153526ac572deab1e
UPLOADED VERSIONS:   a176192b-1264-4a73-93d6-8e85fb92c0da  v1 — uncommitted tree, provisional cap 512 KiB (superseded)
                     51fdbdf5-d16e-4137-9f7e-7d13d6b50aea  v2 — built from commit c5d0cad, cap 128 KiB  ← for C1R2
                     Both non-deployed (`wrangler versions upload`); no traffic routed.
PRODUCTION VERSION:  start 4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b (100%) · end 4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b (100%)
DATE:                2026-11-13
```

## 1 Summary
**Cause.** CPU on the uncached path was mostly a **fixed cost per request**, not the size of the body. The C1 samples for the old code (`90331a1`) show this. BNDX 51 KB took 5 ms and SPAB 75 KB took 8 ms, while VXUS at 369 KB took only 12 ms. That fits about **5.3 ms + 1.85 ms per 100 KB**. Refusals with two small D1 calls already cost 3–5 ms, and `invalid_symbol` (no D1) cost 1 ms. So most of the base was the **three D1 subrequests**: each one costs request encode, response decode and the binding wrapper. The rest was the cache work. The part that grows with size came from four copies of the body: decoding D1's response, splicing `head + body + tail`, then UTF-8 encoding twice (once for the response and once for the `cache.put` copy). The VXUS body has 6,941 characters above U+00FF, so V8 holds it as a two-byte string. The module does no work at start-up: its top-level scope holds constants only.

**Fix (commit `c5d0cad`).**
1. **1 D1 call instead of 3.** One statement covers the `etf_master` probe, the month/snapshot lookup, the A1 guard, the single-pass look-through **and the whole 200 body** (header fields, `source`, `computed_at` via `strftime`, `contract`). The Worker no longer splices any strings.
2. **Encode once.** `TextEncoder` turns the D1 string into bytes once. The same bytes feed the client Response and the `cache.put` Response, and a Response copies a BufferSource body, so this is safe.
3. **Size cap inside D1.** The statement returns `length(CAST(body AS BLOB))`, and returns the body only if it is ≤ the cap. A refused body **never crosses into the Worker**.
4. **A1 guard in the index key.** `report_month = (SELECT CASE WHEN count_for_cap <= ?3 THEN report_month END FROM i)`. The first attempt (`AND (SELECT …) <= ?3`) was wrong: SQLite treats a scalar subquery as non-deterministic and tests it per row *after* reading the row. The new counting-view test caught this (10,003 rows read for a refused ETF). Live D1 now: refused MBB (11,146 holdings) read **14 rows**.
5. **Two one-row CTEs (`m`, `i`) are `MATERIALIZED`.** Without the hint SQLite inlines `i` into its five readers and re-runs the month probes, and the COUNT fallback, at each one (seen in `EXPLAIN QUERY PLAN`).

**Result.** On real D1 (preview v1), the VXUS body equals the old SQL's output exactly: `tiers`, all 5,708 `entities` and `unmapped_top` match. Field order follows spec §4.2. Locally, the Worker's own work per VXUS request (Node 24, real 369 KB body, simulated D1 wire) fell from **1.91 ms to 0.89–1.00 ms** warm. That is −50% before counting the two D1 subrequests saved. **Platform `cpuTime` for the new code could not be read** (see §2). So the cap is set conservatively, assuming the fix saves nothing. VXUS is refused by size until C1R2 measures the real numbers.

## 2 CPU table
`wrangler tail` (with or without `--version-id`, JSON and pretty) connected ("Connected to meridian-entities-api") but received **no events** for preview-URL requests. The Control rules out the other ways to read CPU: Workers Observability needs a toml change, and analytics needs API scope the token lacks. So the preview rows below give status, size and cache state, but no `cpuTime`.

| Version | ETF | Sample | Cache | Status | rows_read (est.¹) | cpuTime | Body |
|---|---|---|---|---|---|---|---|
| 90331a1 (prod, C1) | EEM | first after deploy | miss | 200 | 5,767 | 11 ms | 68.1 KB |
| 90331a1 (prod, C1) | VXUS | warm | miss | 200 | 38,258 | 12 ms | 369.5 KB |
| 90331a1 (prod, C1) | SPAB | warm | miss | 200 | 32,758 | 8 ms | 74.6 KB² |
| 90331a1 (prod, C1) | BNDX | warm | miss | 200 | 25,160 | 5 ms | 51.3 KB² |
| a176192b (preview v1) | EEM | first after upload | miss | 200 | ≈ 5,767 | not visible | 68.1 KB |
| a176192b | EEM | repeat | hit | 200 | 0 | not visible | 68.1 KB |
| a176192b | VXUS | 1 | miss | 200 | ≈ 38,258 | not visible | 369.5 KB |
| a176192b | SPAB | 1 | miss | 200 | ≈ 32,758 | not visible | 74.6 KB |
| a176192b | BNDX | 1 | miss | 200 | ≈ 25,160 | not visible | 51.3 KB |
| 51fdbdf5 (preview v2) | EEM | first after upload | miss | 200 | ≈ 5,767 | not visible | 68.1 KB |
| 51fdbdf5 | VXUS | 1 | miss | 422 size | ≈ 38,258 | not visible | 162 B |
| 51fdbdf5 | VXUS | repeat | hit | 422 size | 0 | not visible | 162 B |
| 51fdbdf5 | BND | 1 | miss | 422 rows | ≈ 14 | not visible | 189 B |
| local, old vs new | VXUS | warm ×200 | miss | 200 | — | **1.91 → 0.89–1.00 ms**³ | 369.5 KB |

¹ The preview requests' log lines were not visible, so these are C1's measured `exp_lookthrough` values for the same ETF and month. The look-through SQL is unchanged and its output is identical. BND ≈ 14 is by analogy with the live MBB SELECT (14). ² Sizes measured on preview v1; the bodies are identical in content to the old code's. ³ Worker JS only (D1 wire parse, assembly, encode, both Responses, cache copy), on Apple Silicon Node 24. Platform hardware is slower and the subrequest cost is not modelled, so this is a ratio, not a forecast.

**D1 rows used by this packet:** about **184,200** of the 400,000 allowed. The direct SELECTs read 38,254: the VXUS body (old SQL), 0 for each of two `EXPLAIN QUERY PLAN`s (VXUS, MBB), and 14 for the MBB guard check. That is all 4 allowed. The preview requests read about 145,950. No writes.

## 3 Caps, and what is served or refused today
| Cap | Value | Basis | Refusal |
|---|---|---|---|
| Rows (A1, unchanged) | 10,000 holdings = 50,000 rows / 5.0 | W1R2 | 422 `too_large`, **`limit: "rows"`**, not cached; 1 D1 call, ≈ 14 rows |
| **Size (new)** | **131,072 bytes (128 KiB)** of UTF-8 body | C1 fit, old code: 5.3 ms + 1.85 ms/100 KB → **7.7 ms at 128 KiB with no W1R3 savings** (≤ 8 ms target, 10 ms limit). Largest served body today: SPAB 74.6 KB, 1.76× headroom | 422 `too_large`, **`limit: "size"`**, `body_bytes`, `max_body_bytes`; **cached 1 h** (D-2) |

- **Served:** EEM (68.1 KB), SPAB (74.6 KB), BNDX (51.3 KB), and anything else ≤ 128 KiB and ≤ 10,000 holdings.
- **Refused by size:** VXUS (369.5 KB, 8,878 holdings).
- **Refused by rows:** BND, AGG, MBB.
- **Raising the cap** needs C1R2's measured new-code slope. If VXUS-sized bodies measure ≤ 8 ms there, a follow-up can raise the cap to about 400 KiB. That is a one-constant change plus the pinned test value.

## 4 Tests
- `exp-route.test.mjs` **27/27** (was 23). Changed: call counts are now 1 on every path; the month-SQL and single-pass tests read `calls[0]`; the plan test now also rejects a SCAN of any table under an alias; `MATERIALIZED` is allowed only on the one-row `m` and `i`. New:
  - size cap: exactly the cap → 200, cap + 1 byte → 422 `size`; byte count matches; 2-byte characters count as 2; the refused body never reaches the Worker; the value is pinned at 131,072;
  - size refusal cached 1 h, rows refusal not cached;
  - the client body and the cache copy are byte-identical, in spec field order;
  - **A1 guard counting view:** refused → ≤ 8 holdings rows touched; served → ≥ 10,001.
- Regression suites: retirement 77/77, nav-007-worker 58/58, fi-009-worker 133/133, fi-009-explain 14/14, merge-013 106/106, nav-007-key 34/34, nav-007-frontend 39/39.
- `wrangler deploy --dry-run`: OK, 58.56 KiB / gzip 14.33 KiB, binding `DB` only.
- Live D1 plan for the new statement (MBB): `MATERIALIZE m`, `MATERIALIZE i`; the holdings range is one `SEARCH … USING INDEX idx_holdings_status_series_month`; no SCAN of a stored table.

## 5 Deviations
- **D-1: no preview `cpuTime`.** Tail does not receive preview-URL invocations. The success condition "≤ 8 ms on a preview version, 2 samples each + one cold sample" is **not met**; C1R2 must take those numbers in production. Because of this, only one sample per ETF was taken (D1 budget kept for C1R2), and v1's cold sample went unrecorded.
- **D-2: size refusals are cached 1 h.** The spec caches no errors except `no_holdings`. A size refusal still costs the whole look-through (VXUS ≈ 38k rows), and a stored month does not change, so it is cached like `no_holdings`.
- **D-3: one D1 statement instead of spec §4.2's separate queries.** This is within the spec's ≤ 4-call ceiling. The rows refusal moved from "after 2 calls" to "inside 1 call".
- **D-4: new fields on 422 `too_large`:** `limit` (`rows` | `size`); size refusals also carry `body_bytes` and `max_body_bytes`. These are additive.
- **D-5: formatting comes from SQLite now.** `computed_at` is D1's clock (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`, millisecond precision). `net_assets` is SQLite's JSON rendering of the stored REAL (the same number). The contract stays `exp-1`; the body shape is unchanged.
- **D-6: preview v1 was uploaded from the uncommitted tree** (provisional cap 512 KiB). v2 was uploaded from commit `c5d0cad` after `git diff --quiet HEAD`, so C1R2 must use v2.

## 6 Redeploy notes for C1R2
- **Deploy version `51fdbdf5-d16e-4137-9f7e-7d13d6b50aea`** (commit `c5d0cad`, cap 128 KiB): `wrangler versions deploy 51fdbdf5-…@100%`, or `wrangler deploy` from `c5d0cad`, which builds the same thing. **Previous version for rollback: `4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b`.**
- **Triggers unchanged** from C1: `cpuTime > 10 ms` on any uncached look-through, any 5xx or `exceededCpu`, or `exp_lookthrough` > 50,000 → roll back.
- **Expected:** EEM, SPAB and BNDX 200; VXUS **422 `limit:"size"`** (that is a pass, not a fault); BND, AGG and MBB 422 `limit:"rows"` at about 14 rows each.
- **Please record** the uncached `cpuTime` for EEM (first after deploy), SPAB, BNDX and the VXUS refusal. The VXUS refusal's cpuTime shows the new fixed cost directly: D1 builds the 369 KB body but does not send it, so the Worker cost has no body in it. Those numbers set the case for raising the cap.
- Every production tail, unlike preview, does receive events, as C1 showed.

## 7 Boundaries kept
- Production stayed on `4e7ee20b` from start to end; it got no requests.
- No `wrangler deploy` (real), no `versions deploy`, rollback or percentages. Two `versions upload`s (≤ 3 allowed).
- No toml, secret, route or cron change. No D1 writes or DDL. 4 read-only SELECTs (2 plan checks, each ≤ 50k rows).
- curl GETs went only to the two preview URLs.
- Files written: `src/entities-api.js` and `tests/exp-route.test.mjs` (both in commit `c5d0cad`), and this report. Scratch files were outside the repo.
- No installs, no subagents. Not touched: `13F Seed/gleif-seed.js`, Status, board, Tower, `transitions.jsonl`, the LANE_OPENER files. Tail sessions were stopped.
