# MA-NOV-EXP.W1R4 — Report

```text
PACKET:    MA-NOV-EXP.W1R4 — Canonical, versioned cache key for R-EXP1, then deploy and measure (C1R3)
RUN:       r-20261113T165132Z-3c65 (interactive, LANE_OPENER_v2)
ROLE:      Engineering Lead + Operations Lead
CONTROL:   MA-NOV-EXP.W1R4_Control_v1.md  sha256 513ca8ad…ec71a (verified)
TASK:      MA-NOV-EXP.W1R4_Task_v1.md     sha256 9dc57d11…73ea  (verified); pins C1R2 Report 15e60047…f302, W1R3.REVIEW Report a6f0d6fb…cbccb (verified)
COMMIT:    54b14462470d24a395b77f1c1e139e99b7823834 on November-2026 (= origin, via git ls-remote)
OUTCOME:   DEPLOYED. No rollback trigger fired.
VERSIONS:  previous 866c6cb2-5a24-4219-829a-f65d7420be23 → new bb8ad0aa-3077-4dc1-8eb6-52abe546a826
URL:       https://meridian-entities-api.navinmv1981.workers.dev
```

## 1. Code change and tests
`App/Corporate Atlas/src/entities-api.js` changes only the cache key.
- `expCacheKey(url)` is replaced by `expCacheKey(symbol, month)`. The key is `https://exp-cache.meridian.internal/{EXP_CONTRACT}/{EXP_CACHE_GEN}/{SYMBOL}/{month|latest}`, for example `…/exp-1/g2/EEM/latest`.
- It is built only from the **validated** upper-case symbol and the validated month. Nothing else in the URL (case, extra query parameters, host) can reach the key.
- New constants: `EXP_CACHE_ORIGIN` and `EXP_CACHE_GEN = 'g2'`. The comment reads: "Bump `EXP_CACHE_GEN` with every change to R-EXP1's SQL or body, so no build serves another build's cache."
- The call site now passes `(symbol, month)`. It is still reached only after both validations have passed.
- The key format is new, so no entry written by C1 or by `866c6cb2` can match it. This closes W1.REVIEW N-2 and W1R3.REVIEW N-2.

Changes to `App/Corporate Atlas/tests/exp-route.test.mjs`:
- The existing Cache API test now asserts the exact new key, and its "not cached" regex matches the new key shape.
- Four new tests:
  - `aaa` and `AAA` produce one key, and the second request is a hit with 0 D1 calls.
  - `?x=1` and `?month=2026-03&y=2` do not change the key, and no key contains `?`.
  - A request with a month and one without get different keys (`…/AAA/latest` vs `…/AAA/2026-03`). The key contains the `EXP_CACHE_GEN` value read from the source.
  - Invalid input never reaches the cache. Five invalid symbols or months give 400 with 0 `cache.match`, 0 `cache.put` and 0 D1 calls.

Results:
- `exp-route.test.mjs`: **31/31** pass.
- Regression suites, run the same way as W1–W1R3: retirement 77/77, nav-007-worker 58/58, fi-009-worker 133/133, fi-009-explain 14/14, merge-013 106/106, nav-007-key 34/34, nav-007-frontend 39/39. Also passing: entity-pipeline-state 4/4 and firds-wrangler-cause 4/4.
- Dry-run build OK: 58.69 KiB, gzip 14.40 KiB, binding `DB` only.
- **Note:** `gleif-reconcile-011.test.mjs` is 41/42. The failing case is "heartbeats through the real 002 outbox" (assertion `start for <uuid>`, line 339). That suite imports only `lib/gleif-reconcile-011-core.mjs` and `scripts/gleif-reconcile-011.mjs`. Neither references `entities-api`, and none of the three files changed in this packet (last change `58cd922`). So the failure is outside this change, and W1–W1R3 did not run that suite either. I did not treat it as a stop gate for this change. It is flagged for the Main Lane.

## 2. Checks (step 7)
The tail was connected before the first request, and every request in this table produced one tail event. Every event's outcome was `ok`, with 0 exceptions.

| Step | Request | Status | Cache | rows_read | cpuTime (wall) ms | Bytes | sha256 prefix | Pass |
|---|---|---|---|---|---|---|---|---|
| a | `/api/exposure/etf/EEM` (first after deploy) | 200 | **miss** | 5,775 | **7** (260) | 68,114 | `17507c1dc037` | ✅ 1,003 entities, TSMC 13.141305, rows 5,775 (W1R3 measured 5,775) |
| b | `/api/exposure/etf/eem?x=1` | 200 | **hit** | — | 1 (44) | 68,114 | `17507c1dc037` | ✅ canonical key; sha = (a) |
| c | `/api/exposure/etf/SPAB` | 200 | **miss** | 32,766 | **6** (342) | 74,574 | `c27dc370c4d8` | ✅ ≤ 50k; 1,131 entities, 2026-03 |
| c | `/api/exposure/etf/SPAB` repeat | 200 | hit | — | 0 (7) | 74,574 | `c27dc370c4d8` | ✅ same sha |
| c | `/api/exposure/etf/BNDX` | 200 | **miss** | 25,168 | **1** (251) | 51,254 | `8c3f18adb218` | ✅ ≤ 50k; 776 entities, 2026-04 |
| c | `/api/exposure/etf/BNDX` repeat | 200 | hit | — | 1 (18) | 51,254 | `8c3f18adb218` | ✅ same sha |
| d | `/api/exposure/etf/VXUS` | **422** `too_large` `limit:"size"` | **miss** | 38,266 | **4** (377) | 162 | `9b2d7e8c1133` | ✅ body_bytes 369,480 > max 131,072; holdings 8,878 |
| d | `/api/exposure/etf/VXUS` repeat | 422 | hit | — | 0 (12) | 162 | `9b2d7e8c1133` | ✅ |
| e | `/api/exposure/etf/MBB` | 422 `limit:"rows"` | miss | 14 | 3 (50) | 189 | `208a911ece8f` | ✅ holdings 11,146 |
| e | `/api/exposure/etf/BND` | 422 `limit:"rows"` | miss | 14 | 6 (91) | 189 | `fb0da8df95f9` | ✅ holdings 17,368 |
| e | `/api/exposure/etf/AGG` | 422 `limit:"rows"` | miss | 14 | 1 (65) | 189 | `3467e6aeabeb` | ✅ holdings 13,269 |
| f | `/api/exposure/etf/SPY` | 404 `no_holdings` `no_series_id` | miss | — | 9 (95) | 81 | `34c3f09bc968` | ✅ (cpu ≤ 10) |
| f | `/api/exposure/etf/%27%20OR%201=1` | 400 `invalid_symbol` | — | — | 0 (0) | 45 | `bdb451d630d1` | ✅ |
| g | `/api/entities/10/etf-exposure` | 200 | — | — | 3 (46) | 1,360 | `22f95bdff3d3` | ✅ funds 9, months_min 2026-01, months_max 2026-03 |
| g | `/api/entities/search?q=pepsico` | 200 | — | — | 1 (291) | 914 | `e557e10e01a6` | ✅ 3 results |

Rollback triggers checked:
- Uncached cpuTime > 10 ms: none (max 9).
- `exceededCpu` or 1102: none.
- 5xx: none.
- rows_read > 50,000: none (max 38,266).
- Regression failures: none.
- A cached body that differs from its miss body: none. EEM, SPAB, BNDX and VXUS each have the same sha256 on miss and hit.
- A first look-through returning `hit`: none. Every first request was `miss`, so the key really is new.

## 3. CPU summary
These are single samples of cold look-throughs on the new code.

| Case | Body served | rows_read | cpuTime |
|---|---|---|---|
| EEM | 68.1 KB | 5,775 | 7 ms |
| SPAB | 74.6 KB | 32,766 | 6 ms |
| BNDX | 51.3 KB | 25,168 | 1 ms |
| VXUS refusal (fixed cost) | 162 B (369,480 B body built and measured in D1, not transferred) | 38,266 | **4 ms** |

- **The fixed cost holds.** Building VXUS's 369 KB body inside D1 cost the Worker 4 ms of CPU, because the body never crosses into the Worker. The D1 time shows as wall time (377 ms), not CPU. Its refusal is now cached 1 h under **one** canonical key. Before, there was one key per URL variant (W1R3.REVIEW N-2).
- **The samples are noisy.** A 404 that reads almost nothing cost 9 ms, and BNDX's 51 KB body cost 1 ms. Isolate start-up and GC dominate single samples at this scale. So the per-KB slope cannot be read reliably from these numbers.
- **Would a ~400 KiB size cap stay under 8 ms? Probably not safely.** No change was made. Reasons:
  - W1R3's fit for the old code was 5.3 ms + 1.85 ms/100 KB. That gives ≈ 12.9 ms at 400 KiB.
  - W1R3 removed the Worker-side assembly, so the marginal cost now is mainly encoding the bytes and handing them to the cache and the client. A conservative 1.0–1.5 ms/100 KB on a ~3 ms base gives roughly 7–9 ms at 400 KiB.
  - Today's measured 6–9 ms spikes on bodies of 75 KB or less show the noise headroom is already thin against 10 ms.
- **View:** keep 128 KiB for C-2. If VXUS-sized ETFs are needed, either:
  - raise the cap in measured steps, 192 KiB and then 256 KiB, each with a cold-miss tail check and a rollback trigger at 10 ms; or
  - serve large bodies from a precomputed store (for example, write once to the cache or KV from a scheduled job) so the request path never builds them.
  A direct jump to 400 KiB is not recommended on Workers Free.

## 4. Boundaries kept
- Files written:
  - `App/Corporate Atlas/src/entities-api.js`: cache-key code only. No change to SQL, body, contract or routes.
  - `App/Corporate Atlas/tests/exp-route.test.mjs`
  - this report
- Git: one commit (explicit paths) and one push of `November-2026`. No force-push or rewriting.
- Pre-checks before deploy: HEAD = origin = `54b1446`; tree under `App/Corporate Atlas` clean; `whoami` showed OAuth; production was `866c6cb2` (recorded).
- **One** `wrangler deploy`, to Worker `meridian-entities-api` only. No toml, secret, route, cron or binding change. No D1 statements beyond the ones the Worker runs. No rollback (no trigger fired). No cache purge.
- Requests went only to the workers.dev URL, for the Task's paths. The tail ran in the background and was stopped after the checks.
- No `.env*` read and no token printed. No installs and no subagents.
- Not touched: `13F Seed/gleif-seed.js`, Status files, the board, the Tower, `transitions.jsonl`, the LANE_OPENER files and Main Lane records.
- Process note: the first tail attempt failed before any request because the scratch folder did not exist yet. It was restarted and confirmed running before request (a).
