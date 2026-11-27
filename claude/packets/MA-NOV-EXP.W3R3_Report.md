# MA-NOV-EXP.W3R3 — Report: plain-language "What your portfolio is made of" panel

```text
PACKET:     MA-NOV-EXP.W3R3 · Control v1 (sha256 e18675b9…364d) · Task v1 (sha256 0e8f0f77…ae46) — both verified
RUN:        r-20261119T202333Z-b0e0 · interactive · LANE_OPENER_v2
EXECUTED BY: Engineering Lead + UX Lead (Claude Code, local)
BRANCH:     November-2026 · base 79822d5 → commit d859f29 "MA-NOV-EXP.W3R3: plain-language portfolio panel" · pushed; ls-remote = d859f299ea11404bf03d4e1fcc69880f894d382c
PIN:        App/ma-entities.js at base = c87a2f42e9a802f90aaf627be191ee78177a010b (matched) → c975279effeeaa7aa6f0bb8301d447e6e44185f0
OUTCOME:    DONE — panel reads as the Task specifies; sum still checked; tests updated and passing.
```

## 1 Before / after panel text (local preview `npx serve App`, live read-only APIs; 5 look-throughs in total)

### Scenario 1 — `#/exposure?i=ETF:VXUS:50,ETF:EEM:50`
**Before (79822d5)**
```
WHERE 100% OF YOUR PORTFOLIO GOES
Companies (direct + via ETFs)              47.63%
Unmapped holdings                           3.20%
No-identifier holdings                     -0.08%
Merge redirect unresolved                   0.00%
Fund residual (not reported as holdings)   -0.76%
Unsupported inputs                         50.00%
Not loaded                                  0.00%
Unallocated                                 0.00%
Sum                                       100.00% ✓
Nothing is redistributed: unknown, unmapped, unsupported and unallocated parts keep their own lines. Negative values (derivatives, shorts, cash offsets) are kept as reported.
69.22% of ETF-derived company exposure rests on Low-confidence mappings.
```
**After (d859f29)** — details opened
```
WHAT YOUR PORTFOLIO IS MADE OF
Companies we could identify                               47.63%
Holdings we couldn't match to a company ▾ details          3.12%
    Not linked to a company in our data                    3.20%
    No identifier in the fund's filing                    -0.08%
Fund cash, derivatives and other items ⓘ                  -0.76%
Not analysed: VXUS (50.00%)
    This fund is too large to look through here.
✓ Adds up to 100%
We don't guess. Anything we can't match to a company is shown separately, never spread across other companies.
About 69% of the company exposure from your ETFs relies on lower-confidence matching. Treat those companies as indicative. [Hide them]
```
(Merge-unresolved, Couldn't load and Not allocated are 0.00% and hidden. `Hide them` → `Show them` and ticks the table's existing checkbox: same `hideLow` state.)

### Scenario 2 — `#/exposure?i=ETF:EEM:60,EQ:2191:15`
**Before**
```
Companies (direct + via ETFs) 72.16% · Unmapped holdings 3.84% · No-identifier holdings -0.09% · Merge redirect unresolved 0.00%
Fund residual (not reported as holdings) -0.91% · Unsupported inputs 0.00% · Not loaded 0.00% · Unallocated 25.00% · Sum 100.00% ✓
+ the same two-sentence explanation and "69.22% of ETF-derived company exposure rests on Low-confidence mappings."
```
**After** — details opened
```
WHAT YOUR PORTFOLIO IS MADE OF
Companies we could identify                               72.16%
Holdings we couldn't match to a company ▾ details          3.75%
    Not linked to a company in our data                    3.84%
    No identifier in the fund's filing                    -0.09%
Fund cash, derivatives and other items ⓘ                  -0.91%
Not allocated                                             25.00%
✓ Adds up to 100%
We don't guess. Anything we can't match to a company is shown separately, never spread across other companies.
About 69% of the company exposure from your ETFs relies on lower-confidence matching. Treat those companies as indicative. [Hide them]
```
Bar segments (scenario 2): Companies we could identify 72.16% · Holdings we couldn't match to a company 3.75% · Not allocated 25.00% (negative fund-items segment not drawn).

## 2 Tests
- `exp-ui.test.mjs`: **221 passed, 0 failed** (new W3R3 block): zero lines hidden (first kept at 0.00); couldn't-match = unmapped + no-id + unresolved (3.5 in fixture) and details order; per-input "Not analysed" sentences for 422 rows, 422 size, 404 no_holdings, 404 etf_not_found, 404 month_not_stored, 400; Couldn't load + Retry; Not allocated; sum line ✓ and ⚠ (99.50%); confidence rounding (69.22 → 69) and hidden when it rounds to 0; Hide/Show label; bar grouping, positive residual drawn, negative residual not drawn; old wording and §6 banned words absent. N-6 label check and the §6 label list updated to the new wording.
- Other suites, unchanged and passing: exp-compute 160/160, exp-route 32/32, nav-007-frontend 39/39, nav-007-key 34/34, nav-007-worker 58/58, fi-010-frontend 71/71, merge-013 106/106, entity-pipeline-state, fi-009-worker, firds-wrangler-cause ok.
- `gleif-reconcile-011.test.mjs` did not finish within 2 min and was stopped; it does not load `ma-entities.js` and is unrelated to this change (not investigated — outside scope).
- Browser console: only 422 (VXUS, expected) and 402 responses from other page modules at load; no script errors.

## 3 Deviations / interpretations
1. **Hide toggle.** The Task puts "the existing hide toggle" next to the confidence line. The table's checkbox is in another panel (prohibited to change), so the panel gets a `Hide them`/`Show them` button bound to the **same** `hideLow` state; the table checkbox stays as is and the two stay in sync.
2. **Line values for per-input lines.** "Not analysed" / "Couldn't load" carry their % inside the label as written (`{SYMBOL} ({a}%)`), so no separate right-hand number is shown for them.
3. **Layout.** The legend in this panel is one column (was a multi-column grid) so the details and sentences sit directly under their line. Inline style on this panel only; no CSS rule changed.
4. "0.00%" hiding uses the 2-dp display value (`_expF(v) === '0.00'`), so a tiny non-zero value that displays as 0.00% is hidden too.
5. The "Gaps" panel still says "Unsupported inputs" / "Load errors" — other panel, out of scope.

## 4 Boundaries kept
- `exp_validate` / `exp_compute` / `_expOutcome` untouched; the panel only groups `reconciliation` values (exp-compute 160/160 unchanged).
- Files written: `App/ma-entities.js` (EXP UI block only: panel renderer, two display-only click actions), `App/Corporate Atlas/tests/exp-ui.test.mjs`, this report. No `index.html`, `docs/`, Worker, wrangler, D1, storage, status/board/Tower files, installs or subagents. `13F Seed/gleif-seed.js` untouched.
- One commit with explicit paths; pushed `November-2026` only. `docs/` not regenerated (release is a separate step).
- Look-throughs: 5 (2 before, 3 after).
