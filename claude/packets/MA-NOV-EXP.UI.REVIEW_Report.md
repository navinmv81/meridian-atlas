# MA-NOV-EXP.UI.REVIEW — Report

```text
PACKET:  MA-NOV-EXP.UI.REVIEW · run r-20261118T194309Z-44c2 (interactive) · session 4eb0f6c7-90da-4ac9-947e-f09149291d7e
ROLE:    Architect + UX reviewer (did not author W2 or W3). Control a9d81315…f72c7e ✓ · Task 05eb04be…5702c ✓
PINS:    Spec 785df4d5…2fc3e ✓ · W2 Report ca65b4d9…3f0b ✓ · W3 Report 2cb5aca3…c8b4 ✓ · HEAD 797839b = origin ✓
OUTCOME: PASS_WITH_NOTES · 0 B · 2 M · 7 N · look-throughs used 5 of 10 · no repository file changed except this report
```

## Verdict: PASS_WITH_NOTES
The calculation is correct and independently reproduced. The screen is safe, matches the spec, and works live. The two M items are spec gaps already named by W3 (§5.1, §5.2). Neither is a defect in what was built, but each needs a Founder decision before release.

## Checks
1. **Scope.** `git diff 54b1446 797839b --stat`: 15 files, +2080 / −0. `ma-entities.js` has **zero `-` lines**: four one-line hooks (`_navHash`, `_navParseFrom`, `_navRender`, the cold `ma:route` origin) plus two appended blocks. `index.html` has one added line (the `Exposure` tile). The rest is tests and fixtures. No existing behaviour was removed.
2. **Calculation.** I recomputed T1 with a separate Python script that reads the F1 fixtures and does not use the W2 code. The output is W 37.00 · X 21.80 (direct 15 + 6.80, k 3) · V 21.00 · Z 6.10 Low · Y 4.00 · Y′ 1.20. That adds up to companies 91.10 + unmapped 1.50 + residual 2.40 + unallocated 5.00 = **100.00**. Shared = {X, Z}; Low share 8.0158% → **8.02**; O_A,B **11.00**. All of these match the spec §3.4 figures.
   - I read the route SQL (`entities-api.js` ~1031–1061). `redirect_unresolved` rows get `eid NULL` and their own tier, so the tier buckets never overlap and the reconciliation is exact.
   - Negative weights are kept, redirect is used, sort is combined → name → id, Δ new/exited is handled, and 422/404 go to *unsupported* while 5xx goes to *not loaded*. All of this is correct in code and covered by tests.
   - Suites: exp-compute 152/152 and exp-ui 123/123. The other suites are green as reported. gleif-reconcile-011 is 41/42, the same failure that was there before this work.
3. **Safety.**
   - Every string from the API goes through `_esc` (escapes `& < > "`), and every attribute is double-quoted. Ids and counts are converted with `Number()` first.
   - Hash fuzz: script tags, attribute breakout, a 20-digit id, `1e309`, negatives, `%00`/NUL, `../`, `?`, `%2F`, extra fields and 3-dp values are all rejected safely. The rejected tokens are shown escaped. 11 inputs are blocked and nothing is fetched.
   - Nothing is stored. The only `localStorage` key is the existing `ma_dark`.
   - Hosts contacted: localhost, the existing proxy, entities-api and Google Fonts. No new hosts.
4. **Spec conformance.** Screen A, Screen B §1–8, all the §2 states, the §5.1 labels and the §6 labels are present word for word. None of the banned words appears in the rendered text of any exposure layer. Overlap is labelled "by company".
5. **Preview** (local `npx serve App` against the live APIs):
   - **EEM 60 + TSMC 15** (deep link): TSMC **22.88** (15.00 + 7.88), unallocated **25.00**, Sum **100.00 ✓**.
   - **VXUS 50 + EEM 50**: VXUS "too large for live look-through (8,878 holdings; response size over the limit)", unsupported 50.00, Sum 100.00 ✓. EEM came from the session cache.
   - **Compare**: "EEM: Feb 2026 vs Nov 2025" with a Δ table.
   - **TSMC link → Back**: returns to the same layer at the same scroll (400 px), with no new request.
   - **375 px**: no horizontal overflow, the pickers stack, and the table shows 3 columns.
   - **Cold reload** of `#/exposure?i=ETF:SPAB:100`: the result renders with no "invalid link" toast.
   - Everything the W3 report claims for these scenarios was reproduced.
6. **Accessibility.**
   - The picker is a combobox with `aria-activedescendant`. ↓ and Enter add a row and focus moves to its allocation field.
   - Sorting sets `aria-sort="ascending"` on the active header and focus stays on it.
   - Remove moves focus to the next row; Expand keeps focus.
   - Contrast is covered in N-4.
7. **Performance (SPAB, 1,131 companies).**
   - Load to results: 345 ms. Full re-render: 3 ms. Layer DOM: 877 nodes.
   - "Show more" to the end takes 22 clicks, the slowest 11 ms. After that the layer has 12.8k nodes, and sorting all 1,131 rows takes 48 ms.
   - Acceptable.

## Findings

| id | sev | item | evidence | fix |
|---|---|---|---|---|
| M-1 | M | W3 §5.1: `#/exposure` is claimed outside the router | It works today, but only because of script order plus `stopImmediatePropagation` plus a **two-timer** wait that assumes the router's cold check takes exactly one `setTimeout 0` | Add `exposure` to `index.html` `parse()` (the router emits `ma:route` like it does for `fi`) and delete the three claims. Ship it in the same C-2 release, as its own small packet with a test |
| M-2 | M | W3 §5.2: a portfolio with one stale ETF gets no stale warning | `newest` = newest month in this portfolio (`exp_compute`, ~line 2685). IYLD 100 can never be stale, so **spec T6 fails** as written | For November, accept "newest stored month here" and re-baseline T6 at W7. Add `newest_stored_month` to R-EXP1 later (an additive, exp-1-compatible field that needs a C-1 redeploy). I don't recommend a today's-date rule, because N-PORT lag would mark most ETFs stale |
| N-1 | N | W3 §5.3: the picker badge shows the month only after load | The ETF list has no month | Accept. The row badge comes from the route and is always right |
| N-2 | N | W3 §5.4: the ETF holdings link closes the layer | `onEtfSelectChange` → `closeEntityOverlay()` | Accept with the existing tooltip. ETF-lane follow-up (`ma-etf.js`) |
| N-3 | N | Focus after Back from a company page goes to `<body>` | Observed live | Restore focus to the company link that was clicked. Check whether the shared nav already does this for entity → entity |
| N-4 | N | Low contrast on small text | `--dim` on `--bg3` is 3.80:1; red badge 3.94:1; green 4.40:1. Used at 9–10 px (column headers, row type, "Holdings dates") | These are app palette values, not new ones. Use `--text2` (6.75:1) for the EXP headers |
| N-5 | N | Spec T2 can no longer hold | VXUS is now 422 (W1R3 cap) | Re-baseline T2 at W7 (VXUS unsupported) |
| N-6 | N | "Mapped companies" includes direct holdings | 72.16 = 15 direct + 57.16 | Wording only, e.g. "Companies (direct + via ETFs)" |
| N-7 | N | "241 of 264" is literal text | Will drift as coverage changes | Fill it from data later. Main Lane KI |

Data note (not EXP): some `entity_master` names are not in Latin script (Tencent shows as 騰訊控股有限公司). Corporate Atlas data quality.

## Judgements: W2 §4
1. **`redirect_unresolved` as its own line: agree.** W3 shows it as its own line, so nothing is folded away.
2. **400, `etf_not_found` and `month_not_stored` → unsupported line: agree.** The spec's state table counts an unknown symbol as unsupported. A 400 cannot come from parsed input, because the symbol regex blocks it first.
3. **T from tiers, M from entities (rounding shown, not forced): agree.**
4. **null confidence → Low: agree.** This matches `navBand`.
5. **`newest_stored_month` as a caller option: correct as a hook.** Nothing passes it yet; see M-2.
6. **Numbers computed in loading and failure states: agree.** The UI hides them, and I verified that in the code paths.
7. **Contract check: agree.**

## Judgements: W3 §5
- **5.1 router claim:** M-1. Move it into the router at C-2.
- **5.2 stale reference month:** M-2. Founder picks (a) re-baseline T6 for November, which I recommend, or (b) the route field before release.
- **5.3 picker badge month:** accept (N-1).
- **5.4 ETF holdings link closes the layer:** accept for November; ETF-lane follow-up (N-2).
- **5.5–5.8:** all accepted.
- **5.9:** "no earlier stored month" and a real 5xx were not seen live in this review either. They are covered by T9 and T10 and stay on the W7 list.

## Recommendation
**Founder UAT: yes, now.**

**Release (C-2): yes, with conditions:**
1. M-1 is fixed in the same release (router `parse()` knows `exposure`; claims removed; suites re-run).
2. The Founder decides M-2. My recommendation is to re-baseline T6 and T2 in W7, and log the route field as a follow-up.
3. N-3 and N-4 are fixed if cheap; otherwise they go on the KI list.

## Look-throughs used
5 of 10: EEM, VXUS, EEM `?month=2025-11`, SPAB, SPAB again on cold reload. Screenshots were taken in session only; no files were written to the repository.
