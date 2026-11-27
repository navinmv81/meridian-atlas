# MA-NOV-UI.POLISH — Report

```text
PACKET:       MA-NOV-UI.POLISH · Control v1 (sha256 86422168…319c) · Task v1 (sha256 10092cd0…4d24)
EXECUTED BY:  Engineering Lead + UX Lead — interactive Claude Code, LANE_OPENER_v2.md, run r-20261121T154626Z-09c1
DATE:         2026-11-21
BRANCH:       November-2026 · base 210c957 → commit 63fcf54 (pushed; ls-remote origin = 63fcf54c6c83318d39f60a6e65555f5e49ae61bc)
PINS:         spec 4b9896de… ✓ · HOME.BUILD report 969c2962… ✓ · ma-entities.js blob c975279e… ✓ · index.html blob 982f6789… ✓ (all matched before any edit)
OUTCOME:      DONE — every §3.1 / §3.3 string applied and tested; .exp-dim → --muted; N-7 done; header search ≥ 180 px > 900 px; suites green.
NEW BLOBS:    App/ma-entities.js 0087575c… · App/index.html f3135160… · App/Corporate Atlas/tests/exp-ui.test.mjs 2ace0d41…
```

## 1 Before / after text

### "What we couldn't analyse" panel (§3.1) — `_expGapsHtml`

| Before | After |
|---|---|
| Panel title "Gaps" | "What we couldn't analyse" |
| "Largest holdings not mapped to a company (by contribution to your portfolio; up to 25 per fund are reported)." | "The largest holdings we couldn't match to a company, by their share of your portfolio (up to 25 per fund)." |
| Columns "Fund weight" · "Of portfolio" · "Identifier" | "Share of fund" · "Share of your portfolio" · "Identifier" |
| Link "Not mapped to a company" | kept |
| "No unmapped holdings reported." | "Every holding in these funds was matched to a company." |
| "**Unsupported inputs** (their allocation is on the unsupported line)" | "**Not analysed** (shown as "Not analysed" in What your portfolio is made of)" |
| "VXUS 50.00% — not supported: too large for live look-through (8,878 holdings; row limit)" | "VXUS 50.00% — This fund is too large to look through here (8,878 holdings)." · no holdings: "We don't have this fund's holdings." · otherwise: "We don't recognise this fund." (all from `exp_unsupportedSentence`) |
| "**Load errors** (their allocation is on the not-loaded line)" | "**Couldn't load** (shown as "Couldn't load" in What your portfolio is made of)" |
| "IYLD 30.00% — not loaded – retry [Retry]" | "IYLD 30.00% — the request failed. [Try again]" |

Live check (local static preview, live read-only API, 1280 px), `#/exposure?i=ETF:VXUS:50,ETF:EEM:50`: the panel reads "WHAT WE COULDN'T ANALYSE", then the new sentence, the 25 EEM rows under "Share of fund / Share of your portfolio", then "Not analysed (shown as "Not analysed" in What your portfolio is made of)" and "VXUS 50.00% — This fund is too large to look through here (8,878 holdings)."

### Chips, badges, notes (§3.3)

| Where | Before | After (seen live) |
|---|---|---|
| Header date chip | "EEM · Feb 2026 · filed 23 Apr 2026 · source SEC N-PORT · stale" | "EEM · Feb 2026 · filed 23 Apr 2026 · from SEC N-PORT · older data" |
| Stale chip (+ separate "newest stored: Aug 2026" chip) | "Stale: EEM — more than 3 months older than the newest stored month" · "newest stored: Aug 2026" | one chip: "Older data: EEM — more than 3 months older than the newest holdings we store (Aug 2026)" |
| Mixed chip | "Mixed months: …. Each ETF uses its own latest stored month." | kept |
| Partial chip | "Partial result: IYLD not loaded — see Gaps" | "Partial result: IYLD couldn't load — see What we couldn't analyse" (unit test) |
| Total failure | "…or every look-through failed. No numbers are shown." | "Corporate Atlas could not be reached, or no fund's holdings could be loaded. No numbers are shown." |
| Confidence badge | "Low (heuristic)" | "Low (name match)" (seen live in the example portfolio) |
| Row status (5xx / network) | "not loaded – retry" | "couldn't load – try again" |
| Row status (422) | "not supported: too large for live look-through (8,878 holdings)" | "not supported: too large to look through here (8,878 holdings)" |
| Overlap note | "— Σ min(fund weight) over companies both funds hold. This differs from the ETF page's overlap, which is by security." | "— for each company both funds hold, the smaller of its two fund weights, added up. The ETF page's overlap is by security, so the numbers differ." |
| `.exp-dim` | `var(--dim)`: 3.95 / 3.80 (light-block bg2/bg3), 3.71 / 3.58 (dark) | `var(--muted)`: **5.24 / 5.04** and **4.98 / 4.81** — all ≥ 4.5:1. The picker note uses `.exp-dim`, so it follows. The "Holdings dates:" prefix already uses `--text2`, so nothing changed there. |

**N-7: done.** The N-PORT evidence label now counts from the ETF list the picker already loads (`/api/etf-list?meta=fc`, which the screen fetches on mount): "Funds in Meridian's N-PORT set (**245 of 264** listed ETFs have stored holdings); …; not all ETFs". It was checked live, and the old hard-coded "241 of 264" was stale. If the list hasn't loaded, the label reads "Funds in Meridian's N-PORT set; {months}; not all ETFs". No new fetch was added.

## 2 Header search (desktop, > 900 px) — `index.html` CSS only

| Width | Before | After |
|---|---|---|
| 1280 | search **40 px**; one full row; clock shown | search **195 px**; one 42 px row; all 7 tiles + Compact/Dark/Auto/Refresh on-screen; clock hidden; gaps 8 px |
| 1024 | search 40 px; **header overflowed**: right edge at 1263 px in a 1019 px header (Dark, Auto, Refresh and the last tiles off-screen; the page scrolled sideways) | search **283 px**; the tiles move to a second header row (69 px), in desktop order; nothing off-screen; no page overflow |
| 901 / 1279 | — | 221 / 410 px; second tile row; nothing off-screen |
| 1499 / 1500 | — | 305 px (no clock) / 218 px (with clock); one row |
| 800 (≤ 900 rules) | 211 px | 211 px (unchanged) |

Rules added (a new block before the ≤ 900 block, with no overlap with it): `>900: #sw{flex:1 1 180px;min-width:180px}`; `901–1279: header wraps, .htiles takes its own row`; `1280–1499: #clock hidden, header and tile gaps 8 px`. Screenshots are in the scratchpad: `polish-header-1280-after.png` (header at 1280) and `polish-exp-example-1280.jpg` (the example portfolio). With a 17 px classic scrollbar, the search at 1280 works out to about 183 px.

## 3 Tests

| Suite | Result |
|---|---|
| `exp-ui.test.mjs` | **270 passed, 0 failed** (was 215 + 6 failing on the old labels). The T6 and row-badge expectations were updated to the new wording. A new UI.POLISH block covers P-1: the panel is rendered from a partial result (unmapped rows, 422, 404, 503) and every new string is checked, plus the chips, the header chips, the total failure, the overlap note, and 19 old strings checked absent from the UI block. It also covers P-2 (`.exp-dim` → `--muted`, contrast ≥ 4.5 computed from both theme blocks of `index.html`) and N-7 (count from the list; fallback). The banned-word check still passes. |
| `exp-compute.test.mjs` | 160 / 0, file unchanged (P-3) |
| `exp-route.test.mjs` | 32 / 0, file unchanged (P-3) |
| `home-entry.test.mjs` | 177 / 0, unchanged (no string check needed updating) |
| Other `App/Corporate Atlas/tests/*` (regression) | entity-pipeline-state, exp-backfill(-wiring), fi-009-worker 133/133, fi-010-frontend 71/71, firds-wrangler-cause, gleif-reconcile-011, merge-013 106/106, nav-007-frontend 39/39, nav-007-key 34/34, nav-007-worker 58/58: all 0 failed |
| Preview | 4 look-throughs against the live read-only API (VXUS, EEM; then IVV, EEM for the example link `#/exposure?i=ETF:IVV:60,ETF:EEM:25,EQ:2191:15`). |

## 4 Deviations

1. **The data-layer messages are kept and mapped for display.** `_expOutcome` (W2 block) still returns `message: 'not loaded – retry'` and `'not supported: too large for live look-through'`, because `exp-compute.test.mjs` asserts them and P-3 requires that file unchanged and green. A display helper `_expMsgUI` (UI block) shows the §3.3 wording wherever the screen displays these outcomes: the row badge, the header date chip (live, this showed "VXUS · not supported: too large for live look-through" until fixed), and the compare line, which used the same "not loaded – retry" text. The compare-toggle label and its other lines are unchanged.
2. **The stale chip fallback when the route field is missing** (`newest_source === 'portfolio'`, the W2 path) reads "Older data: … — more than 3 months older than the newest holdings we store **here** (Feb 2026)". The spec gives one string, written for the route path. The word "here" is kept from the old W2 wording because that reference month is the portfolio's newest, not the store's.
3. **The too-large Gaps line drops the limit detail** ("; row limit" / "; response size over the limit"), as the §3.1 "New" string has none.
4. **The N-7 fallback keeps the `{months}` part** between "N-PORT set;" and "not all ETFs", as in the rest of the EXP-10 evidence label, which is kept.
5. **The header fix also fixes 1024 px and hides the clock at 1280–1499 px.** At 1024 the header already overflowed off-screen before this packet. Every tile could not stay visible at 1024 within one row, so 901–1279 px uses the same two-row tile layout as ≤ 900. At 1280 the row was full to the pixel, so the 140 px for the search comes from hiding the clock (it is already hidden ≤ 640 px) and 8 px gaps. The clock shows again at ≥ 1500 and at 901–1279.

## 5 Boundaries kept

Only `App/ma-entities.js` (EXP blocks only), `App/index.html` (header-search CSS block only), `App/Corporate Atlas/tests/exp-ui.test.mjs` and this report were written. There were no calculation or data changes: `exp_compute` and `_expOutcome` are unchanged. Nothing was changed in `docs/`, Workers, D1, storage, Status files, the board, the Tower, `transitions.jsonl` or the logs. No installs, no subagents, and `13F Seed/gleif-seed.js` was not touched. There is one commit (`git add` with explicit paths), pushed to `November-2026`. Scratch scripts and screenshots are in the session scratchpad only. The pre-existing uncommitted Main Lane changes in the working tree were left as they were.
