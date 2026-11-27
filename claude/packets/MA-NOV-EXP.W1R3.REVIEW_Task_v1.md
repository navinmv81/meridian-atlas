# MA-NOV-EXP.W1R3.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Architect — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1R3.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W1R3.REVIEW_Control_v1.md
```

Light review: check claims with small experiments; keep the report short.

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1.REVIEW_Report.md` | `a970aa16ef5bff961730b7f0e0f80117dd456ca1eb967a73dd62c5605cd62743` |
| `claude/packets/MA-NOV-EXP.C1_Report.md` | `f082a860a31035120a0fd03483a84bad307fe2cae9705dae0b96aa4d1fc35392` |
| `claude/packets/MA-NOV-EXP.W1R3_Report.md` | `e2431668b5d1ca4b23899a841a1660f4e7cf65272a8b491e5f273f9526c3f098` |

## Checks
1. **Commit:** `git show --stat c5d0cad` — only `App/Corporate Atlas/src/entities-api.js` and `tests/exp-route.test.mjs`; origin = `c5d0cad`; no other route's code changed (diff outside the R-EXP1 section = none, or each hunk explained).
2. **Same output:** run the old (`90331a1`, extracted to the scratchpad) and new handlers against the **same** local fixtures, incl. 2–3 adversarial fixtures of your own (redirect cycle, ISIN/CUSIP conflict, zero/NULL weights, an ETF right at each cap). Bodies must be byte-identical for served ETFs; errors per the contract.
3. **The single statement:** bound parameters only; `MATERIALIZED` CTEs as claimed; the row guard really prevents the holdings read for refused ETFs (test + plan); the size check runs in D1 and the Worker never receives an oversized body; one D1 call per request.
4. **Caps:** constants derived and consistent (rows 10,000 holdings; size 128 KiB); boundaries tested (cap → 200, cap+1 → 422 with `limit`); judge D-2 (size refusals cached 1 h) acceptable or not.
5. **Live (≤3 statements):** EXPLAIN of the committed statement for EEM (no SCAN of a real table); one execution for EEM — body values equal W1.REVIEW's (tiers, 1,003 entities, TSMC 13.141305) and rows_read near 5,763; optionally MBB refusal rows (≈14).
6. **Earlier review notes:** status of W1.REVIEW N-2 (canonical cache key), N-4 (500 body), N-6 (client sort) — fixed, unchanged, or worse.
7. **C1R2 readiness:** recommend deploying **from commit `c5d0cad`** (`npx wrangler deploy -c …`) rather than the preview version id (provenance), the same rollback triggers, and the CPU samples to record (EEM first request, SPAB, BNDX, VXUS size refusal). Any must-fix first?

## Report — `claude/packets/MA-NOV-EXP.W1R3.REVIEW_Report.md`
Four-line header; verdict; findings table (id · B/M/N · item · evidence · fix); **recommendation: may C1R2 deploy (yes / yes with conditions / no)**; queries run (rows_read); your session id; under ~700 words. Then `end` and stop.
