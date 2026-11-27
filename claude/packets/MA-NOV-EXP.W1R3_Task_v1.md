# MA-NOV-EXP.W1R3 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1R3_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W1R3_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/packets/MA-NOV-EXP.C1_Report.md` | `f082a860a31035120a0fd03483a84bad307fe2cae9705dae0b96aa4d1fc35392` |
| `claude/packets/MA-NOV-EXP.W1.REVIEW_Report.md` | `a970aa16ef5bff961730b7f0e0f80117dd456ca1eb967a73dd62c5605cd62743` |
| `App/Corporate Atlas/src/entities-api.js` at HEAD (git blob) | `0f558a0f454fefde60b10b5dcff4b012567515b4` |

## Work
1. **Check production** is on `4e7ee20b` (`deployments list`).
2. **Find the CPU:** read the R-EXP1 path and the module's global scope. Candidates: start-up work at module load (large constants, regex/JSON built at import), `response.clone()`/tee for `cache.put` on large bodies, string concatenation/splicing of the D1 body, any `JSON.parse/stringify` of large values, headers work. Measure locally where possible (e.g. `performance.now()` around steps in a Node harness with a 357 KB body) — record numbers.
3. **Cut it:** e.g. move cache writes to `ctx.waitUntil` with a body already in memory (no second copy), build the Response directly from the D1 string without extra concatenation, trim the body (fewer bytes per entity: compact field names only if the spec contract allows — otherwise rounding and dropping redundant fields, recorded as a deviation), defer any module-level work to first use. Keep the spec contract unless a change is recorded.
4. **Body-size cap:** add a cap on entities (or bytes) next to the holdings cap, derived from the preview measurements with margin; refusal = same `too_large` error with a `limit` field (`"rows"` or `"size"`). Tests for both boundaries.
5. **Preview measurement:** `versions upload` → preview URL. First request after upload: EEM (cold sample). Then for EEM, VXUS, SPAB, BNDX: 2 uncached samples each (add a harmless cache-busting query only if the route ignores it for the cache key — otherwise use a new version upload to empty the cache), read `cpuTime` from the tail. Iterate (bounded: ≤ 3 uploads) until served ETFs are ≤ 8 ms or refused by the cap.
6. **Tests + build:** all Corporate Atlas suites from W1.REVIEW; dry-run build.
7. **Commit:** explicit paths, one commit "MA-NOV-EXP.W1R3: exposure route CPU reduction + body-size cap", push `November-2026`, `ls-remote`.
8. **End check:** production still on `4e7ee20b`.

## Report — `claude/packets/MA-NOV-EXP.W1R3_Report.md`
Header (packet, run, commit, uploaded version ids, production version at start/end); 1 Summary (cause → fix → result); 2 CPU table (version · ETF · cold/warm · cache · rows_read · cpuTime · body KB); 3 Caps (rows and size) and what is served/refused today; 4 Tests; 5 Deviations; 6 Redeploy notes for C1R2 (version to deploy, triggers unchanged); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W1R3`.
