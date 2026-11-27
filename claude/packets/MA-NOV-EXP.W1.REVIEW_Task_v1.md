# MA-NOV-EXP.W1.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-12
EXECUTED BY:  Architect — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W1.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W1.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1_Report.md` | `e3e2103c10ea809a85169b46634b446c18749d95e0d6040b5ad204e3565feab9` |
| `claude/packets/MA-NOV-EXP.W1R2_Report.md` | `1a25afbf2779f2c5826fdfa2f4fc22f4399e97f93482d7d6de61e93f3f625267` |

## Checks
1. **Commit:** `git show --stat 90331a1` — only `App/Corporate Atlas/src/entities-api.js` and `App/Corporate Atlas/tests/`; origin = `90331a1`; nothing in `docs/`, other Workers, tomls.
2. **Contract:** R-EXP1 against spec §4.2 — path, params, validation of `symbol` and `month` (bound parameters only, no SQL built from input), response fields incl. `contract`, tiers, buckets, `computed_at`, errors table, cache headers and TTLs, GET only. List every deviation (D-2, D-4, unsorted entities, anything else) and judge each acceptable / not.
3. **Identity and calculation:** the SQL implements §3.2 — one map row per holding, no `entity_isin_map` fan-out, redirect hops, tier kept, unmapped/no-id buckets, weights reconcile. Run the suites; try 2–3 adversarial fixtures of your own in a temp copy (e.g. a redirect cycle, a holding with both CUSIP and ISIN mapped to different entities, a zero-weight row).
4. **Cap (A1 / D-1 c):** constants derived (no disagreeing numbers); refusal happens **before** the aggregation reads; boundary 10,000 → 200, 10,001 → 422; refusal logged.
5. **`/etf-exposure` change:** per-holder latest month, response shape additive only.
6. **Three-point check, reproduced:** `EXPLAIN QUERY PLAN` of the committed SQL (no SCAN of a real table); one execution for EEM — rows_read within ±10% of W1R2's 5,763. Do not run VXUS.
7. **ETF Product Lead sign-off:** tables read (ETF domain, read-only), dependency on `idx_holdings_status_series_month`, no ETF contract or Worker change, overlap naming ("by security" vs "by company").
8. **Tech Ops sign-off:** per-call and daily read budget (§4.4–4.5 with measured numbers), cache, ≤4 D1 calls, Worker Free 10 ms CPU risk for a 357 KB VXUS body (must be measured with `wrangler tail` straight after deploy — say what threshold blocks), log line, rollback.
9. **Deploy readiness (C-1):** the exact command, previous-version capture, rollback, post-deploy checks — complete? Any must-fix first?

## Report — `claude/packets/MA-NOV-EXP.W1.REVIEW_Report.md`
Four-line header; verdict; findings table (id · B/M/N · item · evidence · fix); sign-off sections (ETF PL, Tech Ops); **recommendation: may C-1 deploy proceed (yes / yes with conditions / no)** with the conditions listed; queries run (rows_read); your session id; under ~900 words. Then `end` and stop.
