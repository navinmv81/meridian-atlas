# MA-NOV-EXP.W3R2 — Report

```text
PACKET:  MA-NOV-EXP.W3R2 · run r-20261118T201929Z-ca32 (interactive) · session 83437f4a-b032-45ff-9468-3ddf163e9854
ROLE:    Engineering Lead. Control 4611ce49…2e4c ✓ · Task a7c390fa…f760 ✓
PINS:    UI.REVIEW Report be8ddf80…e8f5 ✓ · W3 Report 2cb5aca3…c8b4 ✓ · index.html blob 1a53aec8 ✓ · ma-entities.js blob 8003d038 ✓ · HEAD 797839b = origin ✓
COMMIT:  8adcff1 "MA-NOV-EXP.W3R2: exposure route in the router; focus, contrast and label fixes" — pushed `797839b..8adcff1` to `November-2026`; `ls-remote` = 8adcff16e818…
OUTCOME: DONE · M-1, N-3, N-4, N-6 fixed with tests · look-throughs used 2 of 5 · nothing released (no docs/)
```

## 1 Changes
- **`App/index.html`** (+10 / −1, router only):
  - `parse()` has a new `#/exposure[?i=…]` branch. It returns `{ type: 'exposure', id, from: null }`, where `id` is the decoded `i=` string. `id` is `''` when `i=` is absent or the escape is malformed, the same rule as `exp_hashOf`.
  - Each token is still validated by the screen, which lists rejected tokens escaped (unchanged from W3).
  - The header comment's type list now includes `'exposure'`.
  - Nothing else in the router changed: dispatch, toast, popstate and hashchange are as before.
- **`App/ma-entities.js`** (+35 / −46, EXP UI block only):
  - **M-1:** the pre-router claim is deleted. That was the load-time `replaceState(null)`, the `popstate`/`hashchange` listeners with `stopImmediatePropagation`, the `DOMContentLoaded` two-timer cold wait, and `_expOpenTyped`, `_expColdHash` and `_expSkipHashchange`. The shared `ma:route` handler now opens the layer for every mode: cold, typed and pop.
  - The four W3 one-line hooks (`_navHash`, `_navParseFrom`, `_navRender`, cold origin) are unchanged and are now the whole route path. The block header comment is updated.
  - **N-3:** a company-link click calls `_expRememberLink(layer, a)` before `_navOpen('entity', …)`. A new `ma:route` listener restores focus on `mode: 'pop'` when the top layer is `exposure`. It is registered after the shared handler, so the layers above have already closed.
  - Focus goes to the same element (`preventScroll`). If results re-rendered meanwhile, it goes to the same company's link in the same card, then in any card. Otherwise the results heading `h3` gets focus (`tabindex=-1`), or `h2` if there are no results yet.
  - **N-4:** `.exp-row-type`, `.exp-tr.head` and `.exp-tbl2 th` change from `--dim` to `--text2`. The "Holdings dates:" label changes from `.exp-dim` to inline `color:var(--text2)`. No new colours.
  - **N-6:** the reconciliation label "Mapped companies" becomes "Companies (direct + via ETFs)".
- **`App/Corporate Atlas/tests/exp-ui.test.mjs`** (+170 / −16): the W3 "cold-link claim" checks are replaced by the router, route, focus, contrast and label checks in §2.
- **`App/Corporate Atlas/tests/fi-010-frontend.test.mjs`** (1 line): the stub `document.addEventListener` used to keep only the *last* listener per type. The new EXP `ma:route` listener therefore replaced the shared handler, and 2 route checks failed (69/71). A real DOM keeps every listener, and the preview confirmed this. The stub now chains listeners in registration order. Result: 71/71 against both the new source and HEAD's.

## 2 Tests
- **exp-ui 168/168** (was 123). New checks:
  - **Router accepts:** `#/exposure`, `?i=…`, a URI-encoded `i=`, `i=` among other params, a malformed `%` (gives `''`), and junk tokens passed to the screen. It agrees with `exp_hashOf`.
  - **Router rejects:** `#/exposures`, `#/exposure/1`, `#/exposurex?i=`, `#exposure`, `#/Exposure`, `#/exposure#x` and `' #/exposure'`.
  - **Other routes unchanged:** `#/entity/…` (with and without `from=exposure:`), `#/instrument/…` and `#/fi`, `#/fi/cik/…`, `#/bond/…`. Junk is still rejected.
  - **Router events:** a cold `#/exposure?i=…` gives one `ma:route` cold event, no toast and the hash kept. The entry link (hashchange) gives `typed`. A popstate gives `pop` with depth 1.
  - **`ma-entities.js` claims nothing:** no URL change at load, no window popstate/hashchange listeners, and no `stopImmediatePropagation`, claim variables or two-timer wait in the source.
  - **Shared handler:** cold exposure makes Home depth 0 and pushes the layer with the inputs. Typed replaces. Cold entity with `from=exposure:` rebuilds the exposure layer underneath.
  - **N-3:** the same link is focused (preventScroll) and used once. After a re-render, the same company in the same card is chosen over an earlier card's. With the link gone, the results heading is focused with `tabindex=-1`. With no results, `h2` is focused. Wired through `ma:route` pop: the entity layer closes and the link is focused; a pop to a non-exposure layer does not move focus. The click handler remembers the link.
  - **N-4/N-6:** the rules use `--text2` with no hex values, and the label text is present.
- Run against HEAD's `ma-entities.js` and `index.html` (`EXP_SRC` / `EXP_INDEX`), the new router checks fail as expected, so they are not vacuous.
- **Regression:**
  - exp-compute 152/152, exp-route 31/31, entities-api-retirement 77/77, entity-pipeline-state 4/4.
  - fi-009-explain 14/14, fi-009-worker 133/133, fi-010-frontend 71/71, firds-wrangler-cause 4/4.
  - merge-013 106/106, nav-007-frontend 39/39, nav-007-key 34/34, nav-007-worker 58/58.
- **gleif-reconcile-011: 41/42.** The one failure ("heartbeats through the real 002 outbox…") is the same failure W1R4, W2, W3 and UI.REVIEW reported. None of its files reference the files changed here.

## 3 Preview checks
Local `npx serve -l 8791 App` against the live read-only APIs. Look-throughs used: **2 of 5**, both EEM. TSMC came from the entities API.

| # | Check | Result |
|---|---|---|
| 1 | Entry link (`#expBtn` → `#/exposure`) | One `exposure` layer, state `maNav 1`, empty state "No inputs yet…", no toast, no look-through |
| 2 | Cold deep link `?cold=1#/exposure?i=ETF:EEM:60,EQ:2191:15` | Hash kept, layer at depth 1 over Home, **no "invalid link" toast**. TSMC **22.88%** (k 2). Legend "Companies (direct + via ETFs) 72.16%" … Unallocated 25.00%, **Sum 100.00% ✓**. One R-EXP1 request (EEM) |
| 3 | TSMC link → entity page → in-app "← Back" | Mid: hash `#/entity/2191?from=exposure%3A…`, layers [exposure, entity]. After Back: hash restored, layers [exposure], **`document.activeElement` is the clicked TSMC link**, scroll 300 → 300, no new request, no toast |
| 4a | Cold `#/entity/2191` | Entity layer "Taiwan Semiconductor Manufacturing Co Ltd", `maNav 1`, no toast (as before) |
| 4b | Typed `#/fi` on top; then typed junk `#/nope` | Fixed Income directory layer over the entity ("34 issuers"); junk shows "That link isn't valid" and the hash is stripped (as before) |
| 4c | Cold `#/fi/cik/0002007029`, then entry link, then browser Back | CIK layer (PepsiCo Singapore Financing I), no toast. Exposure opens over it as [fi_cik, exposure]. Browser Back returns to [fi_cik] with its hash |
| 5 | 375 px, cold deep link (look-through 2) | Pickers stacked, no horizontal overflow, column headers computed `rgb(147,164,189)` = `--text2` #93A4BD (was `--dim` #68788D), new label visible, no toast |

## 4 Deviations
1. **Test harness fix in `fi-010-frontend.test.mjs`** (see §1). This was a stub defect exposed by a second, legitimate `ma:route` listener. Product behaviour is unchanged, and the file is inside the writable tests folder. `nav-007-frontend.test.mjs` has the same last-wins stub but still passes 39/39, so I left it alone.
2. **N-4 scope.** I changed the items the review named: column headers, row type and "Holdings dates". `.exp-dim` is still used for 11–12 px secondary text: picker notes, row names, ETF names in the picker, and the "allocation × fund weight" hint. It remains `--dim` (3.80:1 on `--bg3`). If the Founder wants those raised too, it is a one-rule change to `.exp-dim`. Main Lane KI.
3. **N-3 covers company (entity) links only**, as the Task says. The "Not mapped to a company" instrument links in Gaps are not remembered. On Back from those, focus falls back to the results heading rather than `<body>`, because the pop listener always restores.
4. During suite runs, a `for f in *.mjs` loop briefly started `gleif-reconcile-011-dryrun.mjs`, which is not in the suite list. I stopped it. Its header states it makes 0 D1 calls and 0 GLEIF calls and works on a local replica only. It was invoked without arguments and wrote nothing to the repository (`git status` shows no new files from it).

## 5 Boundaries kept
- **Changed:** only `App/index.html` (router `parse()` and its comment), `App/ma-entities.js` (EXP UI block and its one click branch), two test files, and this report.
- **Not touched:** `docs/`, `generate-docs.mjs`, other `ma-*.js`, Worker code, wrangler, D1 and storage.
- **Factory and records not touched:** `*_Status.json`, the board, the Tower, `transitions.jsonl` and logs. The pre-existing uncommitted Main Lane edits to those files were left as they were and not staged.
- No installs, no subagents, and `13F Seed/gleif-seed.js` was not touched.
- **Commit and push:** one commit, staged with explicit paths, pushed to `November-2026` only.
