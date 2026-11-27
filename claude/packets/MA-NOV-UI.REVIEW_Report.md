# MA-NOV-UI.REVIEW — Combined review: Ops cleanup, Homepage, Exposure polish — Report

```text
PACKET:   MA-NOV-UI.REVIEW · run r-20261121T163026Z-822c · session 19c9a63d-00f1-4f45-a94d-5fd84a44a04e (interactive, LANE_OPENER_v2 67913343…71d6)
ROLE:     Architect + UX reviewer + Tech Ops (did not author OPS.BUILD, HOME.BUILD or POLISH)
PINS:     Control 65b5ad29…b6e5 ✓ · Task d537e90a…933d ✓ · spec 4b9896de…4abd ✓ · HOME Task 55f87ca3…8616 ✓ · OPS/HOME/POLISH reports 0235c2fb… / 969c2962… / 34d07f6b… ✓
SCOPE:    4ad4ca3 (OPS.BUILD), 210c957 (HOME.BUILD), 63fcf54 (POLISH); HEAD 63fcf54 = origin November-2026 (ls-remote)
```

## Verdict: **PASS_WITH_NOTES** — 0 B · 2 M (both release conditions) · 6 N

## What was checked

- **Scope per commit (check 1).** Each commit touches only its Control's writable paths. No change to `docs/`, `App/Ops/src/`, Worker sources or `generate-docs.mjs` between `bc1d079` and `63fcf54`. OPS-05 holds: only front-end loaders were removed, and no route, table or record changed.
- **Suites.** All suites pass at `63fcf54`:
  - Ops: 18 suites. ops-a 40/40, ops-console 58/58, cases 66, dq 68, control-split 100/100, and the rest.
  - Corporate Atlas: 15 suites. exp-ui 270, exp-compute 160, exp-route, home-entry 177, nav-007 ×3, fi-009/010, merge-013, and the rest.
  - `ETF Refresh` ops-health: 26/26.
  - `ingest-contract` was not run, because it needs the live environment.
- **Ops (check 2).**
  - O-1–O-10 are green.
  - In the harness, the four tabs show in order with Cases selected.
  - Drawer: it opens, the row gets `aria-current`, Escape closes it, and focus returns to the row.
  - At 375 px, all four tabs have `scrollWidth` 375, and the tab bar (418 px wide) scrolls inside itself.
  - The harness makes no external requests. CSP fit holds: there is no `@import`, `url(` or font fetch, and the one `<style>` is allowed by `'unsafe-inline'`.
  - O-V: the console matches the main product's surfaces, accent, tables and buttons.
- **Homepage (check 3).**
  - Every Task string matches verbatim (diff and test).
  - Layout A: at 1280 px the card is the top of the right column (y 238). At 800 and 375 px it sits after the ticker and before World Indices (375 px: y 361–665, fully on the first screen). There are no duplicate ids.
  - `display:contents`: Chrome still exposes the aside as the "News and secondary panels" landmark.
  - Company search:
    - Debounce: four keystrokes sent 1 request.
    - "Taiwan Semiconductor" lists #2191 first, and its page "← Back to Home" keeps the scroll position (300 → 300).
    - Escaping: an `<img onerror>` name and a `">` country render as text, and a non-integer id is dropped.
    - Offline: the error text and "Try again" appear.
    - Nothing is stored.
  - The focus ring is a 2 px `rgb(90,155,200)` outline (checked on keyboard Shift+Tab).
  - No "LIVE" text; the pill reads DELAYED; the sectors note reads "Sector ETFs".
- **Polish (check 4).**
  - §3.1/§3.3 strings: seen live in the example ("Older data: IVV, EEM — … (Aug 2026)", "· from SEC N-PORT · older data", "Low (name match)", "What we couldn't analyse", "✓ Adds up to 100%"); the rest are covered by the tests. The panel labels "Not analysed" and "Couldn't load" exist in the composition panel, so the new cross-references are true.
  - `.exp-dim` contrast measured in the page: **5.04:1** on `--bg3` (light) and **4.81:1** (dark).
  - Header widths:

| Width | `#sw` | Header | Page `scrollWidth` |
|---|---|---|---|
| 1280 | 195 px | 1 row, 42 px; clock hidden; rightmost control at 1259 | 1275 (vw minus scrollbar) |
| 1024 | 283 px | 2 rows, 69 px | 1019 |
| 901 | 221 px | 2 rows | 896 |
| 800 | 211 px | 2 rows, 71 px; all 7 tiles fit (OPS right edge 581) | 795 |
| 375 | 180 px | 2 rows, 90 px; Exposure at x 90 | **375** |

  No element sticks out past the viewport except inside scroll containers, at any width.
- **Banned words (check 6).** None in new or changed homepage or EXP text. One Ops line is noted (N-5).

## Findings

| ID | Sev | Item | Evidence | Fix |
|---|---|---|---|---|
| M-1 | M | Release cache mix | `index.html` script tags carry no version stamp. A browser that pairs the new `index.html` with a cached October `ma-entities.js` or `ma-search.js` gets an Exposure tile and card that route nowhere. With no `hsInit`, the search `<form>` does a plain submit and reloads the page. Of the 11 files, 4 differ from `October-2026/docs`: `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js`. | REL.CR adds `?v=` stamps (the same value on all 9 tags) in an owned `index.html` edit, with home-entry and exp-ui still green. |
| M-2 | M | Docs-mirror test is INFO-only (OPS deviation 2) | `ops-a.test.mjs:321-322` prints the mirror state and never fails. | REL.GO restores a hard check: all 11 `docs/` files byte-identical to `App/` after `generate-docs.mjs`, plus `docs/.nojekyll` present. Turn ops-a back into a FAIL check once `docs/` is regenerated. |
| N-1 | N | 901–~1100 px: market cards clip their right-hand columns | Seen at 901 px: World Indices CHG/%CHG are cut inside the card. This was already true before these builds; spec §2.6 applies only at ≤ 900 px. | CARRY: extend the ≤ 900 stacking, or `.card{overflow-x:auto}`, to ≤ 1100 px. |
| N-2 | N | Visual order ≠ focus order on phones | Exposure is shown 2nd but is 6th in the DOM (CSS `order`). The card is shown above World Indices, but its 3 segment buttons come first in focus order (HOME deviation 2). | Accept for November. Later, reorder the DOM. |
| N-3 | N | Near-duplicate company entities in search | "Taiwan Semiconductor" returns #2191, #95111, #97144, #114511 and #259478, and #97144 and #259478 have the same name. | Demo: click row 1 (#2191). CARRY: an entity de-duplication item. |
| N-4 | N | Dead CSS | `.hr-res.sel` is never set (`index.html`). | Remove at the next `index.html` touch. |
| N-5 | N | "complete" on a restyled Ops line | `ma-ops.js` Health: "ETF Second Pass — {offset} of {total} complete". It is operator-only pipeline progress, the text is unchanged from `bc1d079`, and it is not a data-coverage claim. | Founder's call. Recommend leaving it. |
| N-6 | N | POLISH deviation 2 wording | Fallback chip "…newest holdings we store **here** (…)" adds one word to the approved string, and only on the legacy W2 path. | Confirm at UAT. |

## Deviation judgements

- **OPS.BUILD — all 7 accepted.**
  - D1 (AC-13 rewritten to check the removal): correct.
  - **D2 (docs mirror → INFO):** acceptable between builds, because `docs/` is October by design. It must be restored at REL.GO (M-2).
  - D3 (the default open+acknowledged filter counts as "Open only"): the better reading.
  - D4 ("Acting as {role}"): fine. It is new console text, and the Founder can see it in the harness.
  - D5, D6, D7: improvements. They are test-only or a11y-neutral.
- **HOME.BUILD — all 7 accepted.**
  - D1 (`display:contents`): verified that the landmark is kept in Chrome.
  - D2: see N-2.
  - D3 (wordmark visually hidden at ≤ 480 px): fine; the link keeps its accessible name.
  - D4 (`#id` in result rows): useful given N-3.
  - D5 (13 px lead): the Task overrides the spec.
  - D6: fixed by POLISH.
  - D7: noted.
- **POLISH — all 5 accepted.**
  - D1 (`_expMsgUI` display mapping that leaves the data layer alone): correct, and keeps P-3 intact.
  - D2: see N-6.
  - D3: follows the approved string.
  - D4: consistent with the rest of the EXP-10 label.
  - D5 (two-row header at 901–1279 px, clock hidden at 1280–1499 px): verified. It fixes a 1024 px overflow that existed before this packet.

## Recommendation

**Yes, with conditions.** All three builds may go to Founder UAT now, and to the November release once UAT passes and REL.CR carries M-1 and M-2.

## REL.CR must-carry list

1. **Pages switch.** The Founder switches `October-2026` `/docs` → **`November-2026` `/docs`**. Rollback is switching back to `October-2026` `/docs` (`98e830e`, untouched). The live console reverts with it, because it loads `ma-ops.js` from Pages.
2. **Generate `docs/`.**
   - Run `node generate-docs.mjs --dry-run` and diff `.docs-dry-run/` against `App/`.
   - Run `node generate-docs.mjs`.
   - Confirm `docs/.nojekyll` exists; the script does not create it.
   - Commit `docs/` and push `November-2026`.
   - Expect exactly 4 changed files.
3. **Script version stamps (M-1).** Stamp the 9 `<script src>` tags in `index.html` before generating. Name the unit that owns that edit.
   - The console shell's tags cannot be stamped without a `meridian-ops` deploy. That risk is low: `ma-data.js` is unchanged since October, so the console can only mix two self-consistent `ma-ops.js` versions.
   - Run checks after a hard refresh, and more than 10 minutes after the push.
4. **Restore the docs-mirror test (M-2)** as a hard check of all 11 files plus `.nojekyll`.
5. **Post-release checks:**
   - The 11 served files are byte-identical to `docs/`, and `/.nojekyll` returns 200.
   - Homepage at 1280, 800 and 375 px.
   - The example shows "✓ Adds up to 100%".
   - "Taiwan Semiconductor" → #2191 → Back.
   - **Live console (Founder signed in):** four tabs, a Cases drawer, DQ, the Drift & Budget numbers, Health, and a phone check.
   - **O-11:** one read-only GET each to `/api/ops/release-ledger` and `/sprint-board`, expecting 200 with rows.
6. **Rollback trigger.** If any check is broken and a one-line fix cannot repair it by Sat 28 12:00Z, switch Pages back.
7. **Main Lane** updates the CLAUDE.md DEPLOY_BRANCH entry.
8. **Demo notes.**
   - Example numbers: TSMC 18.29% = 15.00 direct + 3.29 via ETFs (HOME report, 21 Nov).
   - The "Older data" chip is expected (UD-7).
   - In company search, pick row 1 (N-3).

## Usage

- R-EXP1 look-throughs: **2 of 6** (IVV, EEM, for the example).
- Entity searches: **1 of 15** ("Taiwan Semiconductor"; the offline test used a stub, not the network).
- One company page load (#2191).
- No live Ops endpoint was called; the harness ran on fixtures only.
- No repository file other than this report was written. No git writes, deploys, wrangler or D1. Screenshots were viewed in the browser pane only.
