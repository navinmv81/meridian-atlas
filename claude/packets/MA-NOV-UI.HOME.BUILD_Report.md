# MA-NOV-UI.HOME.BUILD — Report

```text
PACKET:     MA-NOV-UI.HOME.BUILD (run r-20261121T123106Z-7a84, interactive, LANE_OPENER_v2)
ROLE:       Engineering Lead + UX Lead
CONTROL:    MA-NOV-UI.HOME.BUILD_Control_v1.md  9e3ea2c1…80ff (verified)
TASK:       MA-NOV-UI.HOME.BUILD_Task_v1.md     55f87ca3…8616 (verified)
PINS:       spec 4b9896de…4abd ✓ · App/index.html blob d7a7e545 ✓ · App/ma-search.js blob a0a17f78 ✓ (HEAD 4ad4ca3 = origin)
COMMIT:     210c957 on November-2026, pushed; git ls-remote origin November-2026 = 210c9571a3c4f20ce44516319ed22a8b55e9ded8
OUTCOME:    Built and pushed. Nothing released: docs/ untouched, Pages still serves October-2026 /docs.
```

## 1 What changed

| File | Change |
|---|---|
| `App/index.html` | **Research card** `#home-research` (`.card.card-blue` + `.chdr`) as the first child of `#right`, with the Task v1 wording verbatim. Static HTML: it renders before any script runs. **Phone placement:** at ≤ 900 px `#right` is `display:contents` and the card has `order:0`, `#left` `order:1`, and the other right-hand cards `order:2`. So the card sits directly after the banner and ticker and before World Indices. It is one element with no duplicate ids, and no market card was touched. **Header:** the seven action tiles are wrapped in `<nav class="htiles">`, which looks the same on desktop. At ≤ 900 px the header wraps to two rows: row 1 holds the logo, search, Dark, Auto and Refresh; row 2 is one horizontally scrollable tile row with Exposure second. At ≤ 640 px Compact, the clock and the pill are hidden and controls are 32 px tall. At ≤ 480 px the wordmark is hidden visually but still names the home link. **Layout ≤ 900 px:** `#main` stacks, `.grid2` is one column, tables scroll inside their cards. **Focus:** a `:focus-visible` ring (2 px `--blue`) on `.btn`, `.action-tile`, `.seg-btn`, the card's links, `#hr-q`, `#search` and `#wl-input`. **UD-6:** the pill reads `DELAYED` with neutral `--bg3`/`--text2`/`--border` colours, no dot or pulse, and the tooltip "Market prices are delayed and refresh automatically."; the `pdot` keyframes are removed. The Equity Sectors note reads `Sector ETFs`. |
| `App/ma-search.js` | Company search (spec §2.5): `hsView` (pure state), `hsRowsHtml` (escaped through `escapeRdHtml`), `hsInit` (controller). It uses the shared `data_entitiesGet('/api/entities/search?q=…')`. Typing searches after a 350 ms pause once the query has ≥ 2 characters; Search or Enter searches at once. It shows ≤ 8 rows (legal name · country · type · #id) linking to `#/entity/{id}`, and ignores an answer to an older query. A query already on screen is not requested again; after an error, Search, Enter or Try again ask again. States: "Searching…", the no-results text and the error text + "Try again". Keys: ↓ moves from the input into the results, ↑/↓ move between them (↑ from the first returns to the input), Enter opens (native link), Escape clears. It stores nothing and imports nothing from `ma-entities.js`. The existing header ticker search is unchanged. |
| `App/Corporate Atlas/tests/home-entry.test.mjs` | New, 177 checks (§2). |

## 2 Tests

- `home-entry.test.mjs`: **177 passed, 0 failed**. It covers:
  - H-1: every Task string verbatim, plus the type sizes and colours; the four §2.5 search texts; no banned word in the card, pill, sectors note or search texts.
  - H-7: all 71 ids between the intel banner and `</main>` at HEAD 4ad4ca3 are present exactly once; no duplicate static ids anywhere; the 13 market/news card titles are in their original order; the header ids and the `#expBtn` href are kept.
  - H-9: no `>LIVE<`, a DELAYED pill with its tooltip, no dot or pulse, neutral colours, `Sector ETFs`.
  - Layout A: the CSS rules at ≤ 900 and ≤ 640 px.
  - Search boundaries: no storage, no `ma-entities.js` internals.
  - `hsView` and `hsRowsHtml`: short, loading, error (network and 5xx), empty, malformed body, cap at 8, bad ids skipped, escaping, fallback escaper.
  - The controller with a DOM fake: no request at 1 character; debounce (none at 200 ms, one at 450 ms); stale answer ignored; no repeat request for the query on screen; immediate submit; no-results text; error + Try again re-requests; Escape clears.
- Existing suites, all exit 0: entity-pipeline-state, exp-backfill-wiring, exp-backfill, exp-compute (160), exp-ui (221), fi-009-worker (133), fi-010-frontend (71), firds-wrangler-cause, gleif-reconcile-011, merge-013 (106), nav-007-frontend (39), nav-007-key (34), nav-007-worker (58), and Ops: admin-jobs-lateness, health-check, lateness, ops-a, ops-console. **20/20 suites pass.**

## 3 Preview observations (local static serve of `App/`, live read-only APIs, 21 Nov ≈ 12:34–12:38Z)

Screenshots are in `/private/tmp/claude-501/-Users-navinkumar--claude-spares-spare-mW7iOH/1d051429-7d2e-4c40-812c-6c49f6b618fd/scratchpad/home-shots/` (`1280-home.jpg`, `1280-example.jpg`, `800-home.jpg`, `375-home.jpg`). The 375 shot was taken before the final tile-alignment fix; the fix was re-checked visually afterwards.

**1280 × 800**
- The card is the top of the right column (x 951, y 238, 312 × 380 with results showing). The banner and the first market row are unchanged and above the fold.
- `scrollWidth` 1275 (viewport minus the 5 px scrollbar). The header is one 42 px row.
- No "LIVE" text anywhere; the pill reads DELAYED with the tooltip.
- **H-2:** Analyse my portfolio → `#/exposure` shows the empty Add ETF / Add company screen; ← Back to Home → `''`.
- **H-3:** the example works (§4).
- **H-4:** "Taiwan Semiconductor" returns 5 rows with **#2191 first** → `#/entity/2191` opens Taiwan Semiconductor Manufacturing Co Ltd → ← Back to Home returns with the scroll unchanged (300 → 300).
- **H-5:**
  - 1 character shows nothing.
  - A nonsense query shows the no-results text.
  - With the entities host blocked, the error text and Try again appear (1 blocked call); after unblocking, Try again returns 8 rows.
- **Keyboard:** ↓ goes to the first result, ↓ to the next, ↑ ↑ back to the input, Escape clears the input and results.

**800 × 900**
- The header is two rows (71 px): row 1 holds the logo, search (211 px), DELAYED, the clock, Compact, Dark, Auto and Refresh; row 2 shows all seven tiles with no overflow (OPS right edge at 581).
- The card sits **directly after the ticker** (10 px gap) and before World Indices; the other right-hand cards follow the market cards.
- No element sticks out past the viewport except inside scroll containers (tile row, intel tiles, ticker, cards).

**375 × 812 (phone)**
- `document.documentElement.scrollWidth === 375` ✓ (it was 1,249 before).
- The header is two rows (90 px): the logo mark, search (180 px), Dark, Auto and Refresh; then the scrollable tile row with **Exposure visible at x 90–164 without scrolling**.
- **Where the card sits on phones:** after the header, the status bar, the banner (risk label and narrative, scrollable tiles, drivers) and the ticker. It starts at y 312 and is fully on the first screen. World Indices follows it.
- Buttons and inputs are 32 px tall; the search input and button share one row.
- **Focus:** Shift+Tab onto the example link gives `:focus-visible` with a 2 px solid `rgb(90,155,200)` ring.
- **H-10:** every non-entities fetch was blocked and Refresh run (80 calls blocked; status bar "0/81 symbols loaded"). The card stayed intact, "Apple Inc" returned #1662, and Analyse → `#/exposure` → Back worked.
- **Tab order:** header (12 stops) → World Indices All/Developed/Emerging → Analyse → example → company input → Search → results. See §5 for the three segment buttons.

**Request use:** 4 entity-search requests (≤ 20) and one exposure run for the example (≤ 4 look-throughs). The console showed five HTTP 402 resource errors from market-feed requests that the tab had already dropped from its buffer. They are not from the company search: every search answer rendered.

## 4 Example numbers (for the Mon 30 demo) — `#/exposure?i=ETF:IVV:60,ETF:EEM:25,EQ:2191:15`, 21 Nov 2026 12:35Z

- Inputs: IVV 60.00% (holdings Mar 2026, filed 28 May 2026, SEC N-PORT), EEM 25.00% (Feb 2026, filed 23 Apr 2026), Taiwan Semiconductor Manufacturing Co Ltd 15.00% (direct, your stated allocation). **Total 100.00% · OK (100%) · 3 of 10 inputs.**
- Chips: "Mixed months: Mar 2026, Feb 2026"; "Stale: IVV, EEM — more than 3 months older than the newest stored month"; newest stored: Aug 2026 (UD-7, as expected).
- What your portfolio is made of: **companies we could identify 98.86%**, holdings we couldn't match 1.56%, fund cash/derivatives/other −0.42%, **"✓ Adds up to 100%"**. "About 21% of the company exposure from your ETFs relies on lower-confidence matching."
- Companies (1,503):
  - **TSMC 18.29% combined = 15.00 direct + 3.29 via ETFs** (2 inputs, mapping confidence *Low (heuristic)*)
  - NVIDIA 4.54%
  - Apple 3.99%
  - Alphabet 3.23%
  - Microsoft 2.94%
  - Amazon 2.18%
  - Samsung 1.69%
  - Broadcom 1.57%
- Company search query that finds 2191: **"Taiwan Semiconductor"**. It is row 1 of 5. The other rows (#95111, #97144, #114511, #259478) have similar names; pick the first.

## 5 Deviations and notes

1. **`#right{display:contents}` at ≤ 900 px.** This is the single-element way to put the card before `#left` without duplicating it. Side effect: at those widths some older browsers drop the `aside` landmark from the accessibility tree; current Chrome and Safari keep it. Desktop is unaffected.
2. **Tab order versus visual order on phones.** Focus follows the DOM, so the three World Indices segment buttons come before the card even though the card is shown above them. It is a small gap (3 stops). A skip link would need new wording, so it was not added.
3. **Logo wordmark hidden visually at ≤ 480 px.** This keeps the header to two rows (it was three, 128 px tall, at 375). The text stays as the link's accessible name, so no wording changed.
4. **Result rows show `#id`** after country · type, as the EXP picker does (spec §2.5 "as the EXP picker shows them").
5. **Lead size.** The phone heading size from spec §2.6 (14 px) is not applied: the Task sets the lead to 13 px, and layout A has no h1 heading.
6. **Pre-existing, not changed:** at 1280 px the header ticker search is 40 px wide, the same before and after this build, because the header tiles take the row. The ≤ 900 px rules widen it (211 px at 800, 180 px at 375). Desktop widening is left for the Polish/review lane.
7. **No new font, CDN, storage or route.** The router is unchanged. The header Exposure tile is kept.

## 6 Founder UAT checklist

Run in Terminal:
```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)" && node "App/Corporate Atlas/tests/home-entry.test.mjs" && npx serve -l 8791 App
```
Then open http://localhost:8791 and check:
- [ ] Desktop: the Research card is at the top right, wording as approved, and the pill says DELAYED.
- [ ] "Analyse my portfolio" opens the empty Exposure screen; Back returns home.
- [ ] The example link shows 3 inputs, 100.00% and TSMC 15.00 direct + about 3.29 via ETFs.
- [ ] Typing "Taiwan Semiconductor" lists #2191 first; it opens the company page; Back returns.
- [ ] Narrow the window (or use phone view): two header rows, Exposure visible, the card straight after the ticker, no sideways page scroll.

## 7 Boundaries kept

- Written only: `App/index.html`, `App/ma-search.js`, `App/Corporate Atlas/tests/home-entry.test.mjs`, and this report. One commit, explicit paths, pushed to `November-2026`.
- Not touched: `ma-entities.js`, `ma-ops.js`, any other `ma-*.js`, `docs/`, `generate-docs.mjs`, Workers, wrangler, D1, storage, Status files, the board, the Tower, `transitions.jsonl`, logs, either LANE_OPENER, `13F Seed/gleif-seed.js`.
- No installs and no subagents. No market or news card content or id changed (HOME-05). Nothing released.
