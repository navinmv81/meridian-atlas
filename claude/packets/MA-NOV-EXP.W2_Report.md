# MA-NOV-EXP.W2 — Report

```text
PACKET:    MA-NOV-EXP.W2 — Exposure calculation (exp_validate, exp_compute) + tests
RUN:       r-20261113T174852Z-02ad (interactive, LANE_OPENER_v2)
ROLE:      Engineering Lead (Entities domain)
CONTROL:   MA-NOV-EXP.W2_Control_v1.md  sha256 4a4df0f0…ded81 (verified)
TASK:      MA-NOV-EXP.W2_Task_v1.md     sha256 bf1bd489…29d5a (verified)
PINS:      Spec 785df4d5…2fc3e ✓ · W1R4 Report a26673d4…2aac0 ✓ · ma-entities.js blob at HEAD 63a7113c…e937 ✓
COMMIT:    c7886b7a742b53c6a4c15cbe0b4290e8a4a7509a on November-2026 (= origin, via git ls-remote)
OUTCOME:   DONE. Pure functions + tests committed and pushed. Nothing released (no docs/, no deploy).
```

## 1 Summary
- One delimited block `// ===== EXP (MA-NOV-EXP.W2) =====` … `// ===== end EXP (MA-NOV-EXP.W2) =====` was appended to the end of `App/ma-entities.js`. It adds 346 lines and deletes none, and no existing function changed.
- The block is pure. It has no DOM, `fetch`, storage or listeners, and a test checks this.
- It implements §3.1 (validation), §3.3 (formulas, reconciliation, shared exposure, overlap, bands, Low share, negative weights) and §5.1 (per-ETF months, mixed and stale flags, Δ against the previous stored month).
- It also covers the live R-EXP1 outcomes from W1R4, including 422 `too_large` with `limit` `rows` or `size`. Companies are sorted on the client (review N-6).
- New suite `tests/exp-compute.test.mjs`: **152/152 pass**. Existing suites are green, except for one failure that was already there (§3).

## 2 Functions and signatures (for W3)
All are classic-script globals. All names start with `exp_`, `_exp` or `_EXP_`, and none clashes with another `ma-*.js` file.

**Input row**
- An input is `{type:'etf', symbol, allocation}` or `{type:'eq', entity_id, resolved_id?, name, allocation}`.
- `allocation` can be a number or a numeric string.
- `resolved_id` is the survivor after a merge redirect. When it is present, it is used as the identity.

**`exp_validate(inputs)`**
- Returns `{ok, empty, count, total, unallocated, show_unallocated, total_status:'empty'|'ok'|'under'|'over', rows:[{errors:[{code,message}]}], errors:[…], duplicates:[{key, indices, label, combined_allocation, combine_label}]}`.
- Row error messages:
  - "Allocation must be between 0.01 and 100"
  - "Choose an ETF"
  - "Choose a company"
- Overall error messages:
  - over-allocated: "Allocations total 110% — reduce by 10%"
  - too many inputs: "At most 10 inputs (this list has N)"
  - duplicate: "<label> is entered more than once — remove one or combine"
- `combine_label` reads, for example, "Combine into one row (30+20%)".

**`exp_combine(inputs, indices)`**
- Returns a new array. The rows at `indices` are merged into the first of them, with their allocations summed to 2 dp. The input array is not mutated.

**`exp_compute(inputs, lookthroughs, opts?)`**

`lookthroughs` and `opts.previous` map an ETF symbol (upper case) to `{status, data}`. `body` is accepted in place of `data`. `opts.newest_stored_month` is `'YYYY-MM'`; if it is not passed, the newest month in the portfolio is used.

It returns:
- `state`: one of `'empty'|'invalid'|'loading'|'ok'|'partial_failure'|'total_failure'`.
  - When the state is `empty` or `invalid`, every result field is `null` (no results).
- `validation`: the `exp_validate` result.
- `inputs[]`:
  - every row has `{index, type, label, allocation, status}`. `status` is one of `direct|computed|unsupported|invalid|not_loaded|pending`.
  - computed ETFs add `report_month, previous_month, filing_date, period_end, holdings_count, computed_at, fund{reported_total,mapped,unmapped,no_identifier,redirect_unresolved,residual}, lines{…}`.
  - other ETFs add `reason, message`. A `too_large` row also gets `limit, holdings_count, report_month, max_holdings, body_bytes, max_body_bytes`.
- `companies[]`:
  - each company is `{entity_id, name, direct, indirect, combined, k, band:'high'|'medium'|'low'|null, merged, notes[], contributions[]}`.
  - each contribution is `{input, kind:'etf'|'direct', symbol?, allocation, fund_weight?, contribution, holdings?, tiers?, band?, merged?, report_month?}`.
  - sorted by combined, descending; ties go by name, then entity id.
- `shared[]`: companies with k ≥ 2.
- `overlap[]`: `{a, b, inputs, overlap, companies, basis:'by company'}`.
- `low_confidence`: `{low_indirect, total_indirect, share_pct}`.
- `reconciliation`: `{companies, unmapped, no_identifier, redirect_unresolved, residual, unsupported, not_loaded, unallocated, total, difference, ok}`.
- `months`: `{etfs:[{symbol, input, report_month, label, filing_date, previous_month, months_behind, stale}], mixed, newest_stored_month, stale:[symbols]}`.
- `gaps`: `{unmapped_top:[{input, symbol, name, key, fund_weight, contribution}], unsupported:[rows], not_loaded:[rows]}`.
- `delta`: `null` unless `opts.previous` is passed. Then it is `{etfs:[{symbol, current, previous, status:'compared'|'no_previous'|…, label?, message?}], companies:[{entity_id, name, current, previous, delta, status:'new'|'exited'|'changed'}]}`, sorted by |Δ|.

**`exp_monthLabel('2026-04')`** returns `'Apr 2026'`.

**How each response is classified**

| Response | Status | Message | Line |
|---|---|---|---|
| 200 `contract` exp-1 | computed | — | — |
| 404 `no_holdings` | unsupported | "not supported: no stored holdings" | unsupported |
| 404 `etf_not_found` | unsupported | "not supported: unknown ETF symbol" | unsupported |
| 404 `month_not_stored` | unsupported | "not supported: month not stored" | unsupported |
| 422 `too_large` | unsupported | "not supported: too large for live look-through" (`limit` kept) | unsupported |
| 400 | invalid | "invalid input (<error>)" | unsupported |
| 5xx, status 0/network, bad body, contract ≠ exp-1 | not_loaded | "not loaded – retry" | not loaded |
| missing entry | pending | — | not loaded (state `loading`) |

## 3 Tests
Run with `node "App/Corporate Atlas/tests/exp-compute.test.mjs"`. The suite loads the real `ma-entities.js` through `vm` with a minimal DOM stub. Its fixtures in `tests/fixtures/exp-compute/` (11 files) use the live R-EXP1 body shape, and the error bodies copy the W1R4 §2 shapes.

| Case | Checked (all pass) |
|---|---|
| T1 (F1, §3.4) | Rows in table order: W 0/37.00/37.00/1/High · X 15.00/6.80/21.80/3/High · V 0/21.00/21.00/1/High · Z 0/6.10/6.10/2/**Low** · Y 0/4.00/4.00/1/High · Y′ 0/1.20/1.20/1/High. Contributions 5.0/1.8/2.5/3.6. Companies 91.10 + unmapped 1.50 + residual 2.40 + unallocated 5.00 = **100.00** (ok). Shared = {X, Z}. Y (102) and Y′ (112) stay separate. Low share **8.02%** (6.10/76.10). O_A,B **11.00** (2 companies, "by company"). Mixed months Apr 2026 / Feb 2026. Stale flag with newest 2026-08 (A 4 months behind, B 6), and exactly 3 months behind is not stale. Inputs are not mutated. |
| T3 | "Allocations total 110% — reduce by 10%". State invalid, no results, no rescaling. 100.01 → "… reduce by 0.01%". |
| T4 | EEM 30 + "eem " 20 blocked as a duplicate. Combine label "(30+20%)" → EEM 50. Companies and reconciliation are identical to EEM 50 alone. Unallocated 50. TSMC = 0.5 × 13.141305. Total 100.00. Negative no-identifier kept (−0.075). |
| T7 | X 30.00 is the only company. Unmapped 70.00, no-id −2.00, residual 2.00, total 100.00. Unmapped rows show only under gaps. |
| T8 | One row for survivor 100 with "merged record". No row for 900. A direct input `entity_id 900 → resolved_id 100` joins the survivor row (5 + 10, k 2). An equity duplicate after redirect is blocked (`EQ:100`). |
| T9 | ΔX +1.00 (changed), Y **new** +2.50, Z **exited** −2.00. Label "May 2026 vs Mar 2026" (non-consecutive months). A direct input adds no Δ. `previous_month: null` → "no earlier stored month". |
| T10 | A 500 makes that input not_loaded, and 30 goes to the not-loaded line. The other input computes (W 37.00). State partial_failure, total 100.00. All calls failing (status 0 + 503) → total_failure, total 100.00. A missing entry → loading. |
| 422 / 404 | VXUS 422 `size` (369,480 / 131,072 kept) and BND 422 `rows` (17,368 / 10,000 kept) → unsupported. SPY 404 `no_holdings` → unsupported. Unsupported line 50.00, total 100.00, state ok. `etf_not_found` and 400 → unsupported line. |
| Sort | Input is in unsorted route order. Output is Big 40 · Alpha#3 · Alpha#9 · Beta · Short −2 ("net short / derivative" note). |
| Validation | 11 inputs blocked, 10 allowed. Rejected: 10.123, 0, −5, 100.01, "abc", "", null, 0.001, NaN, ∞. Accepted: 0.01, 100, 12.5, "12.50", 33.33. 33.33+33.33+33.34 = exactly 100. 99.99 leaves 0.01 unallocated. ETF + direct of the same company is not a duplicate. Empty list → state empty. Combine keeps the first position. |
| Boundary | The EXP block has no `document`, `window`, `fetch(`, `innerHTML`, storage, listener or `import`/`require`. |

**Regression suites:**
- Passing: entities-api-retirement 77/77, entity-pipeline-state 4/4, exp-route 31/31, fi-009-explain 14/14, fi-009-worker 133/133, fi-010-frontend 71/71, firds-wrangler-cause 4/4, merge-013 106/106, nav-007-frontend 39/39, nav-007-key 34/34, nav-007-worker 58/58.
- **gleif-reconcile-011: 41/42.** This is the same failure W1R4 reported: "heartbeats through the real 002 outbox". The three files involved were last changed in `58cd922`, and none of them references `ma-entities.js`. This failure is not caused by this change and is still open for the Main Lane.
- Not run: `gleif-reconcile-011-dryrun.mjs`. It is a dry-run script for MA-OCT-011, not a test suite.

## 4 Deviations / spec questions
None of these needed a stop. They are additions where the spec is silent, and each one keeps reconciliation exact. They are proposed for review with W3.
1. **`redirect_unresolved` weight.** The live body has this tier bucket (spec §4.2 note), but the §3.3 reconciliation formula does not name it. The code gives it its own line, `reconciliation.redirect_unresolved` (= Σ a·X/100), so it is never spread and never counted as a company. **Propose:** the reconciliation bar either shows it as its own part or folds it into "unmapped holdings".
2. **400, `etf_not_found` and `month_not_stored`** go to the *unsupported* line. 400 is marked `invalid` and has its own message. The spec's state table counts an unknown symbol as unsupported. The Task says only "400 → invalid" and does not name a line.
3. **Reported total.** T_i is taken from the sum of `tiers`, and M_i from the sum of `entities` weights. Both are rounded to 6 dp by the route, so the reconciliation shows the true rounding difference (≪ 0.01) rather than forcing it.
4. **Unknown confidence.** A mapped row with a `null` confidence is banded Low. This matches `navBand` in `entities-api.js`.
5. **Stale reference month.** "Newest stored month" is a caller option (`newest_stored_month`), because the pure function cannot see the whole set. W3 should pass the newest month from the ETF list. Without it, the newest month in the portfolio is used.
6. **Not-loaded results are still computed.** In the `total_failure` and `loading` states the numbers are still computed, and only the state flag changes. Hiding them ("no numbers") is the UI's job in W3.
7. **Contract check.** A 200 whose `contract` is not `exp-1` is treated as not loaded, so a future body shape is never misread.

## 5 Boundaries kept
- **Files written:**
  - `App/ma-entities.js`: the appended EXP block only.
  - `App/Corporate Atlas/tests/exp-compute.test.mjs`
  - `App/Corporate Atlas/tests/fixtures/exp-compute/*` (11 JSON files)
  - this report (not committed)
- **Git:** one commit with explicit paths, then one push of `November-2026` (54b1446 → c7886b7). `git ls-remote` confirms the push.
- **Not done:** no UI or DOM code, no `index.html`, other `ma-*.js`, `docs/` or `generate-docs.mjs`. No network, Worker, D1 or wrangler. No installs and no subagents.
- **Not touched:** `13F Seed/gleif-seed.js`, the Status files, the board, the Tower, `transitions.jsonl`, the LANE_OPENER files and Main Lane records.
