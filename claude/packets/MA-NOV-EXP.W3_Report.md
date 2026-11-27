# MA-NOV-EXP.W3 — Report

```text
PACKET:    MA-NOV-EXP.W3 — Exposure-to-company screen (#/exposure)
RUN:       r-20261118T190949Z-7a92 (interactive, LANE_OPENER_v2)
ROLE:      Engineering Lead + UX Lead (Entities domain)
CONTROL:   MA-NOV-EXP.W3_Control_v1.md  sha256 0fe110bd…9897 (verified)
TASK:      MA-NOV-EXP.W3_Task_v1.md     sha256 239c1368…70bd (verified)
PINS:      Spec 785df4d5…2fc3e ✓ · W2 Report ca65b4d9…3f0b ✓ · ma-entities.js blob 41e9edc3…0560 ✓ · index.html blob 70b0ad39…8b36 ✓
COMMIT:    797839b0ac066150ad92433e100f916ebe39c8ea on November-2026 (= origin, via git ls-remote)
OUTCOME:   DONE. The screen works end to end on a local preview against the live route. Committed and pushed. Nothing released (no docs/, no deploy).
```

## 1 Summary
- `#/exposure` is a nav layer (kind `exposure`) in `App/ma-entities.js`. The inputs live only in the URL hash (`#/exposure?i=ETF:EEM:60,EQ:2191:15`); nothing is stored.
- Built: Screen A (pickers, rows, total, duplicate + Combine), Screen B §1–8, all §2 states, §6 evidence labels, and Back from a company page to the same result (warm, and on a cold deep link).
- All calculation comes from the W2 functions (`exp_validate`, `exp_combine`, `exp_compute`). The UI adds no arithmetic of its own, apart from display sorting and the hidden-row sum.
- One entry link in `App/index.html` (header tile "Exposure").
- New suite `exp-ui.test.mjs`: **123/123**. Existing suites are green, apart from the one failure that was already there (§4).
- One deviation needs review (§5.1): the `index.html` router does not know `#/exposure`, so `ma-entities.js` claims that hash before the router sees it.

## 2 What was built
`App/ma-entities.js`: +749 lines, no deletions.

**Hooks inside existing code**, one line each, all marked `MA-NOV-EXP.W3`:
- `_navHash`: kind `exposure` → `exp_hashFor(id)`.
- `_navParseFrom`: type `exposure` → `{ type, key: <inputs string> }`.
- `_navRender`: `case 'exposure'`.
- `ma:route` cold handler: an `exposure` origin is rebuilt underneath the deep-linked page (as entity/instrument origins already are), so Back returns to the result.

**Appended block** `// ===== EXP UI (MA-NOV-EXP.W3) =====` … `// ===== end EXP UI … =====` (lines 2751–3494):

| Group | Functions |
|---|---|
| Hash (pure) | `exp_hashSerialize`, `exp_hashParse` (returns `{inputs, rejected}`), `exp_hashFor`, `exp_hashOf` |
| State (pure) | `exp_viewState` (empty/invalid/loading/total_failure/partial_failure/results), `exp_rowStatus`, `exp_viewFlags` |
| Fetch + session caches | `_expLookthrough` (R-EXP1, once per ETF per session; 200/4xx never re-sent; 5xx/network kept apart for Retry), `_expPrevious` (`?month=` only when Compare is on), `_expLoadEtfList` (proxy `/api/etf-list?meta=fc`), entity names and merge redirects via `/api/entities/{id}`, evidence-label data on expand via `/etf-exposure` and `/issuer-panels` |
| Layer | `_navRenderExposure`, `_expRefresh` (keeps the hash in sync with `replaceState`, no new history entries), `_expWire` (delegated events, comboboxes with keyboard support), `_expRenderRows` (keeps focus and caret while typing) |
| Screen B | `_expHeaderHtml` (§1), `_expReconHtml` (§2), `_expTableHtml` + `_expDetailHtml` (§3, §5, §8), `_expSharedHtml` (§4), `_expGapsHtml` (§6), `_expCompareHtml` (§7) |
| Routing | cold load, `popstate`, `hashchange` claims for `#/exposure` only (§5.1) |
| Style | `_expStyleOnce`: one `<style id="exp-style">` using only the app's CSS variables (same pattern as `_fiStyleOnce`); `@media (max-width:600px)` |

`App/index.html`: one line, `<a class="btn action-tile" id="expBtn" href="#/exposure" …>Exposure</a>` after Fixed Income.

`App/Corporate Atlas/tests/exp-ui.test.mjs`: new, 219 lines.

## 3 Preview results
- **Setup:** local static server on `localhost:8791`, using the existing `.claude/launch.json` config `corporate-atlas-static` (`npx serve App`, already cached; nothing installed). It calls the live APIs. Tested in the desktop app's built-in browser at 800 px wide and at the 375 px mobile preset.
- **R-EXP1 look-through requests: 11 of 25.** 1 by curl (body shape check); 10 from the browser: EEM ×3 (three page loads), EEM previous month, VXUS, SPY, IYLD, and Retry of 2 fake symbols (404 `etf_not_found`).
- **Screenshots** are session captures outside the repo, in `~/.claude/projects/…/b36cf0be-…/tool-results/` (not committed, because any repo file outside the allowed paths would be a scope violation). The observed values are below.

| # | Scenario | Observed |
|---|---|---|
| 1 | EEM 60 + TSMC (entity 2191) 15, cold deep link | Rows: EEM "holdings available (Feb 2026)", TSMC "direct holding · your stated allocation". Total 75.00% "under (25.00% unallocated)". TSMC 22.88 = direct 15.00 + via 7.88 (0.6 × 13.14), k 2, Low (heuristic). Bar: mapped 72.16 · unmapped 3.84 · no-id −0.09 · redirect 0.00 · residual −0.91 · unsupported 0 · not loaded 0 · unallocated 25.00 · **Sum 100.00 ✓**. "69.22% of ETF-derived company exposure rests on Low-confidence mappings". Date chip "EEM · Feb 2026 · filed 23 Apr 2026 · source SEC N-PORT"; "Company mappings as of 18 Nov 2026". Companies (1003). Gaps: top 25 unmapped (e.g. Ping An CNE1000003X6 0.50% / 0.30%) with "Not mapped to a company" links |
| 2 | VXUS 50 + EEM 50 | VXUS 422 `size` → "not supported: too large for live look-through (8,878 holdings; response size over the limit)". Unsupported 50.00 · mapped 47.63 · Sum 100.00 ✓. EEM came from the session cache (no second request) |
| 3 | SPY 40 + EEM 60 | SPY 404 `no_holdings` (`no_series_id`) → "not supported: no stored holdings". Unsupported 40.00. TSMC 7.88 = 0.6 × EEM. Sum 100.00 ✓ |
| 4 | EEM 30 + EEM 20 | Blocked: "EEM is entered more than once — remove one or combine", with the button "Combine into one row (30+20%)". Results hidden. Click → one row EEM 50, hash `ETF:EEM:50`, unallocated 50.00, TSMC 6.57 (0.5 × 13.14) |
| 5 | EEM 60 + TSMC 50 | "Allocations total 110% — reduce by 10%". Total line "over: fix before results". Results: "Results are hidden until the inputs are fixed." Values stay 60/50 (no rescaling). Typing 15 into the field: focus and caret kept, hash → `EQ:2191:15`, results return |
| 6 | Compare on EEM | Fetched `?month=2025-11` once. "EEM: Feb 2026 vs Nov 2025". Δ table: Samsung +1.86, TSMC +1.07, SK hynix +0.88, Tencent −0.87 … (top 25 by size) |
| 7 | Back from a company page | Click TSMC → `#/entity/2191?from=exposure%3AETF%3AEEM%3A60%2CEQ%3A2191%3A15`, button "← Back to Exposure". Back → the same layer at the same scroll (600 px), `maNav:1`. **Cold** deep link to that entity URL → the exposure layer is rebuilt underneath; Back → result (TSMC 22.88) |
| 8 | 375 px | Pickers stack; rows use 3 columns with the status on its own line; the table shows company + combined % + expand only; the expand shows direct / via ETFs / confidence, contributions and evidence. No horizontal overflow |
| 9 | Entry link | Header "Exposure" → `#/exposure`, empty state ("No inputs yet …"), no "That link isn't valid" toast, `maNav:1` |
| 10 | Pickers | Typed "IYL" + ↓ + Enter → IYLD added with the remaining 25 prefilled, focus on its allocation. Chip "IYLD · Jan 2026 · filed 25 Mar 2026"; "Mixed months: Feb 2026, Jan 2026". Company picker "samsung electronics" → Samsung Electronics Co Ltd (#1986) added as a direct holding |
| 11 | Loading / partial / total failure | Simulated in the page by seeding the in-memory maps (inspection only, no network). Loading: row spinner "loading stored holdings…" and "Results appear once every input has loaded." Partial (one 503): row "not loaded – retry" + Retry; chip "Partial result: … see Gaps"; not loaded 30.00; Sum 100.00 ✓. Total (503 + network): "Couldn't load holdings for any ETF input … No numbers are shown." + Retry. Retry sent real requests → both "not supported: unknown ETF symbol" |
| 12 | Table controls | Sort by name (aria-sort ascending, focus kept), back to combined. "Hide low-confidence" → line "Low-confidence (hidden): 629 companies · 54.56% combined — still counted in every total"; Sum still 100.00. "Show 50 more" → 100 rows |
| 13 | Focus order | Back → × → Add ETF → Add company → per row: allocation, Remove (Retry if shown) → Combine → results controls (checkboxes, sort headers, company links, expand) |

**Bugs found and fixed during the preview:**
- **Cold-load race.** My first-hop timer ran before the router's cold check, so the router stripped the hash as invalid. The fix is a second task hop.
- **Mobile pickers.** In the stacked layout, `flex-basis` 280px became the height. The fix is `flex:0 0 auto` at ≤ 600 px.
- **List bullets.** The global reset removed `ul` padding, so bullets sat outside the cards. The fix scopes `ul` styles under `.exp-root`.
- **Text clean-ups.** The too-large row text repeated itself, and the typed-ticker option appeared even when the list had matches.

**Seen but not changed:** the base page's `meridian-proxy/?ipos=1` returns 402. It is unrelated and was there before this change.

## 4 Tests
- `node "App/Corporate Atlas/tests/exp-ui.test.mjs"` → **123/123**. It covers:
  - **Hash round-trip:** the spec example, lower case, `BRK.B`, float → 2 dp, empty allocation, more than 10 kept for validation.
  - **Hash rejects:** 15 malformed tokens, plus good tokens kept around a bad one.
  - **`exp_hashOf`:** percent-encoded hashes, other hashes → null, bad escapes.
  - **Nav hooks:** `_navHash`, the company link, `_navParseFrom('exposure:…')`, and existing kinds unchanged.
  - **State selection** from route outcomes: empty, invalid (over / duplicate / ≤ 0 / text / > 10), loading, results with 404 `no_holdings` or 422 `too_large`, partial_failure (503), total_failure (network + 500), direct-only.
  - **Flags:** mixed, stale, unsupported, not loaded; reconciliation is 100 in partial failure.
  - **Row badges** for 200 / 404 ×2 / 422 / 503 / network / wrong contract / direct.
  - **Cold-link claim:** `#/exposure` is hidden from the router; other hashes and events pass through.
  - **§6 banned words:** none in the UI block or in the W2 messages. Code-only exclusions: the `autocomplete` attribute and the `_EXP_BANNED` list.
  - **Labels:** all fixed labels are present verbatim.
  - **Boundaries:** no storage, no imports, only the expected endpoints.
- **Regression:** entities-api-retirement 77/77, entity-pipeline-state 4/4, exp-compute 152/152, exp-route 31/31, fi-009-explain 14/14, fi-009-worker 133/133, fi-010-frontend 71/71, firds-wrangler-cause 4/4, merge-013 106/106, nav-007-frontend 39/39, nav-007-key 34/34, nav-007-worker 58/58.
- **gleif-reconcile-011: 41/42.** This failure was there before this run: the baseline taken at the start of this run gave the same result, and W1R4 and W2 reported it too. None of its files reference `ma-entities.js`. It is not a stop gate for this packet and is still open for the Main Lane.

## 5 Deviations / spec gaps (for the W2 + W3 review)
1. **Router (needs a decision).** The `index.html` router parses only entity, instrument, fi and bond hashes. Left alone, it would toast "That link isn't valid" for `#/exposure` and strip it. This packet may not touch the router (`index.html` gets one link only), so the UI block claims `#/exposure` itself:
   - at script load, for a cold link, it hides the hash and opens the layer two task hops after DOMContentLoaded;
   - it adds `popstate` and `hashchange` listeners that call `stopImmediatePropagation` **only** for `#/exposure` hashes (`ma-entities.js` loads before the router script).

   Pop to an exposure entry (Back from a company page) works through either path. **Proposal:** at C-2 (or in a small follow-up), add `exposure` to the router's `parse()` and remove the three claims. That is about 10 lines in each file.
2. **Stale warning reference.** No front-end source gives the store-wide newest month (`/api/etf-list` has no report month), so the stale check compares against the newest month **in this result**: "…older than the newest stored month here (…)". A lone stale ETF (spec T6, IYLD 100) therefore shows no stale chip. **Proposal:** R-EXP1 or `/api/etf-list` exposes `newest_stored_month`, and the UI passes it into `exp_compute` (the W2 option already exists).
3. **Picker support badge.** The ETF list has `hasNport` but no report month, so the picker shows *holdings available* (or *not supported: no stored holdings*). The month appears once the look-through has loaded, in the row ("holdings available (Feb 2026)") and in the picker for cached ETFs. `hasNport` (245) and the route can disagree. The row badge always comes from the route.
4. **ETF holdings link (§6 contribution line).** It opens the existing ETF view through the `ma-etf.js` global `openEtfDetailView` (typeof-guarded, no import). That view's own `onEtfSelectChange` calls `closeEntityOverlay()`, so the exposure layer closes. The browser's Forward button restores it from memory with no new request (verified), and the link's tooltip says so. Fixing this properly needs an ETF-domain change (not allowed here).
5. **Evidence labels.** The four company-page labels sit in the expanded company row and link to the company page; the existing company-page panels were not changed. Their `<min>–<max>` months and `<period>` are filled lazily from `/etf-exposure` and `/issuer-panels`. For TSMC both are empty today, so they read "no months recorded for this company" and "no 13F rows stored for this company". "241 of 264" is the spec's literal text and will need updating if coverage changes.
6. **Edit control.** Each row's allocation field is the edit control ("Edit allocation % for X"). To change the ETF or company itself, the user removes the row and adds another; there is no separate Edit button.
7. **`redirect_unresolved` (W2 deviation 1).** It is shown as its own bar line, "Merge redirect unresolved", which is always listed (0.00 today).
8. **Negative bar parts.** Segment widths use only the positive parts. Negative lines (residual, no-id) show their signed values in the legend.
9. **Not observed live.** These states were not seen against the live route: the "no earlier stored month" path (every ETF tried has a previous month; it is covered by W2 T9 and by the rendering code) and a real 5xx (simulated, see §3 row 11). Both are in the UAT list.

## 6 UAT checklist for the Founder (W7, on the local preview after C-1; hard-refresh)
1. Header → **Exposure**. You see the empty state and the two pickers, and no "invalid link" toast.
2. Add ETF "EEM" (keyboard: type, ↓, Enter) and company "Taiwan Semiconductor" (#2191). Set 60 and 15. Total "75.00% · under (25.00% unallocated)". TSMC 22.88; Sum 100.00 ✓.
3. Copy the URL, open it in a new tab: the same result appears (cold link).
4. Change TSMC to 50: "Allocations total 110% — reduce by 10%"; results hidden; no rescaling. Set it back to 15.
5. Add EEM again: duplicate message → **Combine into one row (60+…%)** → one row.
6. Try `#/exposure?i=ETF:VXUS:50,ETF:EEM:50` → VXUS "not supported: too large for live look-through (8,878 holdings …)"; unsupported 50.00.
7. Try `#/exposure?i=ETF:SPY:40,ETF:EEM:60` → SPY "not supported: no stored holdings"; unsupported 40.00.
8. Add IYLD → mixed-months chip. Check the date chips name the month and filing date for each ETF.
9. Tick **Compare with previous stored month** → "EEM: Feb 2026 vs Nov 2025" and a Δ table with new/exited marks.
10. Expand TSMC: contributions line (60.00% × 13.14% = 7.88%) and the four evidence labels.
11. Click TSMC → company page → **← Back to Exposure** returns to the same result and scroll.
12. **Hide low-confidence**: rows move into the "Low-confidence (hidden)" line; the bar still sums to 100.00.
13. Turn Wi-Fi off and add a new ETF → "not loaded – retry"; with every ETF failing → "Couldn't load holdings … No numbers are shown." Wi-Fi on → Retry works.
14. Phone width (≤ 600 px): pickers stack; the table shows company + combined; expand shows the rest.
15. Tab through: pickers → allocation/Remove per row → Combine → table controls; Enter/Space work on all of them.
16. Confirm that no wording on the screen says "current ownership", "all holders", "complete" or "real-time".

## 7 Boundaries kept
- **Files written:** `App/ma-entities.js` (four one-line hooks + the appended block), `App/index.html` (one entry link), `App/Corporate Atlas/tests/exp-ui.test.mjs`, and this report (not committed).
- **Git:** one commit with explicit paths, then one push of `November-2026` (`c7886b7` → `797839b`). `git ls-remote` confirms it.
- **Not done:**
  - no `docs/`, no `generate-docs.mjs`;
  - no Worker code, deploy, wrangler or D1;
  - no other `ma-*.js`; no new front-end file; no framework, CDN, npm install or import;
  - no storage (hash only);
  - no subagents.
- **Requests:** look-throughs used were 11 of 25.
- **Not touched:** `13F Seed/gleif-seed.js`, the Status files, the board, the Tower, `transitions.jsonl`, the LANE_OPENER files, Main Lane records, and `.claude/launch.json` (used, not edited).
