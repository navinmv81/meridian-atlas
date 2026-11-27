# MA-NOV-EXP.C1R2 — Report

```text
PACKET:     MA-NOV-EXP.C1R2 · Control v1 (sha256 00e80a7d…1430) · Task v1 (sha256 dc419a90…6fb2)
RUN:        r-20261113T082305Z-8985 (interactive, LANE_OPENER_v2)
EXECUTED BY: Operations Lead — Claude Code
OUTCOME:    DEPLOYED — checks INCOMPLETE (no rollback trigger fired; the look-through path was not exercised, see §2)
COMMIT:     c5d0cadf315658c89322139068f03c9fb8375e89 (HEAD = origin/November-2026)
PREVIOUS:   4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b (production before deploy; rollback target)
NEW:        866c6cb2-5a24-4219-829a-f65d7420be23 (live, 100%)
URL:        https://meridian-entities-api.navinmv1981.workers.dev
DEPLOYED:   2026-11-13 ~08:24Z · checks 08:25:24–08:25:51Z
```

## 1. Pre-checks (all passed)
| Gate | Result |
|---|---|
| HEAD = `c5d0cad` = `git ls-remote origin November-2026` | ✅ both `c5d0cadf3156…` |
| `git --no-optional-locks diff --quiet HEAD -- "App/Corporate Atlas"` | ✅ clean |
| `wrangler whoami` | ✅ OAuth token (wrangler 4.96.0) |
| Production before deploy | ✅ `4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b` (last entry: "MA-NOV-EXP.C1 rollback: cpuTime >10ms") |
| Review pin `MA-NOV-EXP.W1R3.REVIEW_Report.md` | ✅ `a6f0d6fb…cbccb` |

Deploy: one `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`, 58.56 KiB / gzip 14.33 KiB, binding `env.DB (meridian-etf)` only. Tail connected (TCP established to Cloudflare) before the first request.

## 2. Finding — the checks hit C1's stale edge cache (why the outcome is "incomplete")
Every `/api/exposure/etf/*` 200 response was `x-exp-cache: hit`, `cf-cache-status: HIT`, `age` ≈ 39,970 s, `last-modified` Thu 12 Nov 21:19:15–21:19:20Z. Those bodies were written by the **rolled-back C1 version `e6ddf979`** (commit `90331a1`) during yesterday's attempt.

Cause (code read, no change made): `expCacheKey()` keys on the URL plus `__exp_contract=exp-1`. Both `90331a1` and `c5d0cad` use `EXP_CONTRACT = 'exp-1'`, and 200 bodies are stored with a 24 h edge TTL. So C1's entries are still valid for c5d0cad until about **2026-11-13 21:19Z**. Rolling back to `4e7ee20b` only stopped the route; it left the cache in place. W1R3 added the size cap but did not bump the contract.

Consequences:
- **(a) could not be a cold request.** The EEM body is correct (1,003 entities, TSMC 13.141305), but it is C1's body. No `exp_lookthrough` line was logged, so rows_read and cold cpuTime were not measured.
- **(c) SPAB and BNDX were hits.** rows_read was not measured.
- **(d) VXUS returned 200 with 369,477 bytes (C1's body) instead of 422 `too_large` `limit:"size"`.** Until the C1 entries expire, the live route serves a body above the 128 KiB cap. Serving the hit cost 0–1 ms CPU, so there is no CPU risk, and the front end does not call R-EXP1 yet (C-2).
- **(b)** passes as hit = hit (identical sha256). The "cached body = miss body" comparison was not possible.

This is not a Control rollback trigger. No `exceededCpu`, no cpuTime > 10 ms, no 5xx, no rows_read > 50k, the regressions pass, and BND/AGG/MBB return 422 `limit:"rows"`. The Control allows a rollback only on a trigger, and allows only GETs to the Task's paths (no cache purge, no extra query strings, no second deploy). So I did not roll back and did not force a miss.

## 3. Checks (tail: outcome / cpuTime ms / wallTime ms)
| Step | Request | Status | Cache | rows_read | cpuTime | Body bytes | Pass |
|---|---|---|---|---|---|---|---|
| a | `/api/exposure/etf/EEM` (first after deploy) | 200 | **hit** (C1, 21:19:15Z) | — (not logged) | 1 (wall 24) | 68,114 · sha256 `8add6f96…92ef` · 1,003 entities · TSMC 13.141305 | ⚠️ body correct; not cold, so rows/CPU unmeasured |
| b | `/api/exposure/etf/EEM` repeat | 200 | hit | — | 3 (wall 26) | 68,114 · same sha256 | ✅ (hit = hit) |
| c | `/api/exposure/etf/SPAB` | 200 | **hit** (C1) | — | 1 (wall 18) | 74,574 (1,131 entities, 2026-03) | ⚠️ unmeasured |
| c | `/api/exposure/etf/BNDX` | 200 | **hit** (C1) | — | 1 (wall 20) | 51,254 (776 entities, 2026-04) | ⚠️ unmeasured |
| d | `/api/exposure/etf/VXUS` | **200** | **hit** (C1, 21:19:16Z) | — | 0 (wall 6) | **369,477** · sha256 `0a9df011…5251` | ❌ expected 422 `size`; stale C1 body |
| d | `/api/exposure/etf/VXUS` repeat | 200 | hit | — | 1 (wall 18) | 369,477 · same sha256 | ❌ same |
| e | `/api/exposure/etf/MBB` | 422 `too_large` `limit:"rows"` | miss | 14 (`exp_lookthrough_refused MBB 2026-05 holdings=11146`) | 4 (wall 112) | 189 | ✅ |
| e | `/api/exposure/etf/BND` | 422 `too_large` `limit:"rows"` | miss | 14 (holdings=17368) | 3 (wall 41) | 189 | ✅ |
| e | `/api/exposure/etf/AGG` | 422 `too_large` `limit:"rows"` | miss | 14 (holdings=13269) | 3 (wall 39) | 189 | ✅ |
| f | `/api/exposure/etf/SPY` | 404 `no_holdings` (`no_series_id`) | miss | — | 1 (wall 41) | 81 | ✅ |
| f | `/api/exposure/etf/%27%20OR%201=1` | 400 `invalid_symbol` | — | — | 1 (wall 1) | 45 | ✅ |
| g | `/api/entities/10/etf-exposure` | 200; has `funds`, `months_min` 2026-01, `months_max` 2026-03 | — | — | 1 (wall 25) | 1,360 | ✅ |
| g | `/api/entities/search?q=pepsico` | 200; non-empty (PepsiCo Inc, id 1457) | — | — | 1 (wall 317) | 914 | ✅ |

All 13 tail events: outcome `ok`, no exceptions. Max cpuTime 4 ms.

## 4. CPU summary
- **New fixed cost (VXUS size refusal in D1): not measured.** VXUS was a cache hit, so no D1 look-through ran.
- **EEM cold: not measured** (hit). **SPAB/BNDX: not measured** (hits).
- **Measured:** row-cap refusals (MBB/BND/AGG) cost 3–4 ms CPU and 14 rows. Cache hits cost 0–3 ms. Regressions cost 1 ms.
- **Size-cap raise to ~400 KiB:** no view possible from this run, because the cost of a full look-through on c5d0cad has not been observed. C1's 11–12 ms (VXUS/EEM, built in the Worker) is the only data point, and W1R3 changed that path.

## 5. What the Main Lane needs to decide
1. **Re-measure after the C1 entries expire** (after ~21:19Z 13 Nov): run steps a, c and d again as GETs only. This needs a new approved packet; this Control allowed one check pass.
2. **Or bump `EXP_CONTRACT`** (e.g. `exp-2`) in a code packet, so a size-cap or shape change can never reuse an older build's cache. Recommended either way: the same trap will catch any future contract-shape change.
3. **Until ~21:19Z today**, `/api/exposure/etf/VXUS` serves C1's 369 KB 200 body, and EEM/SPAB/BNDX serve C1's bodies. Nothing in the front end calls R-EXP1.

## 6. Boundaries kept
Files written: this report only. One deploy, Worker `meridian-entities-api` only. No toml, secret, route, cron or binding change. No D1 query (neither of the 2 allowed SELECTs was needed). No git writes. No `.env*` read; no token printed. No rollback (no trigger fired). No cache purge. Requests went only to the Worker's workers.dev URL, for the Task's paths. Tail run in the background and stopped after checks. No subagents. `13F Seed/gleif-seed.js` untouched. Status, board, Tower and `transitions.jsonl` untouched.
