# MA-NOV-EXP.W1R4 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead + Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1R4_Status.json (= code change + production deploy)
CONTROL:      claude/packets/MA-NOV-EXP.W1R4_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-EXP.C1R2_Report.md` | `15e600479d4bd17992b18c0ce4daa7df946866823b2fa487666cf9074f4ba302` |
| `claude/packets/MA-NOV-EXP.W1R3.REVIEW_Report.md` | `a6f0d6fb6c591f02febf32d9017f22ceec87cacecca26842c61a30662f3cbccb` |

## Part 1 — code (C = `-c "App/Corporate Atlas/wrangler-entities-api.toml"`)
1. Replace `expCacheKey(url)` with a **canonical, versioned** key: a fixed internal origin + `EXP_CONTRACT` + a new constant `EXP_CACHE_GEN` (e.g. `'g2'`) + the normalised **upper-case symbol** + the **validated** month parameter or `latest` — nothing else from the URL. Comment: "bump `EXP_CACHE_GEN` with every change to R-EXP1's SQL or body, so no build serves another build's cache".
2. Tests: `eem` and `EEM` map to one key; extra query params (`?x=1`, `?month=2026-02&y=2`) do not change the key; `month` vs no month differ; the key contains `EXP_CACHE_GEN`; invalid input never reaches the cache. All Corporate Atlas suites; dry-run build.
3. Commit "MA-NOV-EXP.W1R4: canonical, versioned cache key for R-EXP1" (explicit paths), push `November-2026`, confirm with `git ls-remote`.

## Part 2 — deploy and measure
4. **Pre-checks:** HEAD = origin = the new commit; `git --no-optional-locks diff --quiet HEAD -- "App/Corporate Atlas"`; `whoami` OAuth; `deployments list C` → production `866c6cb2…` (record).
5. **Deploy:** `npx wrangler deploy C`; record the new version id.
6. **Tail** to a scratch file; confirm connected.
7. **Checks** (record status, `x-exp-cache`, body bytes, sha256 of body, tail outcome, cpuTime, `exp_lookthrough` rows_read):
   a. `/api/exposure/etf/EEM` — **first request after deploy**; **miss**; 200; rows ≈ 5,775 (±10%); 1,003 entities; TSMC 13.141305.
   b. `/api/exposure/etf/eem?x=1` — **hit** (canonical key); body sha256 = (a).
   c. `/api/exposure/etf/SPAB`, `/api/exposure/etf/BNDX` — miss; 200; rows ≤ 50,000; then each once more → hit, same sha256.
   d. `/api/exposure/etf/VXUS` — miss; **422 `too_large` `limit:"size"`**; record cpuTime and rows_read (the new fixed cost with a full look-through in D1); repeat → hit, 422.
   e. `/api/exposure/etf/MBB`, `BND`, `AGG` — 422 `limit:"rows"`, ≈ 14 rows.
   f. `/api/exposure/etf/SPY` — 404; `/api/exposure/etf/%27%20OR%201=1` — 400.
   g. `/api/entities/10/etf-exposure` — 200 with `funds`, `months_min`, `months_max`; `/api/entities/search?q=pepsico` — 200, non-empty.
8. Stop the tail. **Rollback** on any trigger: `npx wrangler rollback 866c6cb2-5a24-4219-829a-f65d7420be23 C -m "MA-NOV-EXP.W1R4 rollback: <reason>"`; confirm (g) 200.

## Report — `claude/packets/MA-NOV-EXP.W1R4_Report.md`
Header (packet, run, commit, outcome DEPLOYED / ROLLED BACK, previous and new version ids); 1 Code change + tests; 2 Checks table (step · request · status · cache · rows_read · cpuTime · bytes · sha256 prefix · pass); 3 CPU summary: cold EEM, SPAB, BNDX, VXUS refusal (= fixed cost incl. a 369 KB body built in D1), and whether a size cap of ~400 KiB looks safe under 8 ms (estimate with reasoning, no change made); 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W1R4`.
