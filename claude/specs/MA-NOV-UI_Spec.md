# MA-NOV-UI — Ops cleanup, Homepage as research entrance, release polish and the November release — Specification v1

```text
PACKET:     MA-NOV-UI.SPEC (run r-20261121T083832Z-a215, interactive)
AUTHORS:    UX Lead + Operations Lead + Architect
SCOPE:      meridian_atlas_november_content_scope_and_requirements.md §2 (OPS-01–06), §5 (HOME-01–07), §6 — c16c8e19…5a03
INPUTS:     MA-NOV-SA1_Report.md 419e4337…3aea · MA-NOV-EXP_Spec.md 785df4d5…e3e · code at bc1d079 (November-2026 = origin)
DECISIONS:  NML-1110-6 (scope; keep Drift & Budget) · NML-1113-9 (re-plan: November = EXP + OPS + HOME + release + demo)
            · NML-1121-2 (Ops build starts today, Sat 21)
STATUS:     DRAFT, for Founder spec approval. Nothing is built, deployed or released by this document.
```

Evidence tags: **[C]** read in code at `bc1d079` (file:line), **[P]** seen in the local preview of `App/` on 21 Nov against the live read-only APIs, **[R]** from an earlier report or record.

New user-facing text is given **exactly**, in quotation marks or code blocks. A build packet copies it verbatim; any change is a wording change for the Founder. Banned on every new or changed line (EXP spec §6 rule, extended to the homepage): "real-time", "live data", "complete", "all holders", "current ownership". Words used instead: "stored", "reported", "as of", "delayed".

---

## 0 Summary of what this spec asks for

| Area | Change | Files touched by the build | Release path |
|---|---|---|---|
| OPS | Remove 3 tabs (front end only); restyle the 4 kept tabs on the main product's tokens; align states, focus, mobile | `App/ma-ops.js`, `App/Ops/tests/ops-a.test.mjs`, `App/Ops/tests/ops-console.test.mjs`, new `App/Ops/tests/preview/*` | Pages (the console loads `ma-ops.js` from Pages) |
| HOME | Proposition block + two research routes above the market banner; header and page usable at phone width; no "LIVE" claim | `App/index.html`, `App/ma-search.js` | Pages |
| POLISH | EXP Gaps panel wording, `.exp-dim` contrast, remaining jargon on the EXP screen | `App/ma-entities.js` (EXP section only), `App/Corporate Atlas/tests/exp-ui.test.mjs` | Pages |
| RELEASE | Pages source `October-2026` `/docs` → `November-2026` `/docs` | `docs/` via `generate-docs.mjs`, CLAUDE.md DEPLOY_BRANCH | Founder switches Pages |

No Worker deploy, no D1 statement, no schema change, no new cron, no new secret, no new front-end file. The Worker side of the release (R-EXP1 on `meridian-entities-api`, the back-fill code on `meridian-entities-enrich`) is already live [R: NML-1119-2, NML-1121-1].

---

## 1 OPS (OPS-01 – OPS-06)

### 1.1 Today: tabs, routes, where they live (evidence)

The Ops interface is **only** the signed-in operator console. `GET /api/ops/admin/console` on `meridian-ops` serves a shell that loads `ma-data.js` and `ma-ops.js` **from the live Pages site** (`CONSOLE_ASSET_BASE = 'https://navinmv81.github.io/meridian-atlas/'`) [C: `App/Ops/src/console-page.js:17,41-42`]. The public homepage does not load `ma-ops.js`; its OPS tile is a link to the console [C: `App/index.html:1093-1101,1206`].

Consequence: **every Ops front-end change goes live at the Pages release, and only then.** The real console cannot show unreleased code (the shell's `assetBase` is fixed in production).

| Tab (order today) | Loader | Route(s) read | Worker | Auth | Table(s) | Fate |
|---|---|---|---|---|---|---|
| System Health | `openOps` → `_renderOpsPanel` [C: `ma-ops.js:405-445,189-403`] | `GET /api/ops-health` | meridian-proxy | public | ops/pipeline state | **keep** |
| Cases (default) | `ops_loadCases` [C: `:1313`] | `GET /api/ops/admin/cases…` (+ drawer, actions) | meridian-ops | Access | `ops_exceptions` | **keep** |
| DQ Tickets | `ops_loadDq` [C: `:1314`] | `GET /api/ops/admin/dq-tickets…` | meridian-ops | Access | `ops_dq_*` | **keep** |
| Drift & Budget | `ops_loadDriftTab` [C: `:712-745`] | `/api/ops/drift` (302 → control), `/budget-risk`, `/openfigi-status`, `/cf/d1-today`, `/cf/invocations?script=` ×3 | meridian-ops / meridian-control | **public** | `releaseledger` (drift), budget counters, CF GraphQL | **keep** (NML-1110-6) |
| Events | `ops_loadEventTimeline` [C: `:666-702`] | `GET /api/ops/events?limit=100` (302 → control) | meridian-control | **public** | `operationalevents` | **remove (front end)** |
| Sprint Board | `ops_loadSprintBoard` [C: `:564-608`] | `GET /api/ops/sprint-board` (302 → control) | meridian-control | **public** | `sprintboarditems` | **remove (front end)** |
| Release Ledger | `ops_loadReleaseLedger` [C: `:613-661`] | `GET /api/ops/release-ledger` (302 → control) | meridian-control | **public** | `releaseledger` | **remove (front end)** |

Route sources: `App/Ops/src/ops-api.js:1008,1047-1053` (302s and the meridian-ops public GETs), `App/Ops/src/control-api.js:8-14,473-476` (the four public GETs and the Access-guarded admin POSTs).

### 1.2 Removal plan (OPS-01, OPS-05, OPS-06)

**Front-end change (`App/ma-ops.js`):**
1. `OPS_TABS` keeps exactly four entries, in this order: `health` "System Health", `cases` "Cases", `dq` "DQ Tickets", `drift` "Drift & Budget". Default stays Cases.
2. Delete `ops_loadSprintBoard`, `ops_renderSprintBoard`, `ops_loadReleaseLedger`, `ops_renderReleaseLedger`, `ops_loadEventTimeline`, `ops_renderEventTimeline`, `OPS_STAGE_COLORS`, `OPS_READ_ONLY_NOTE`, and their three branches in `ops_switchTab` [C: `:548-550`]. Git history keeps the code.
3. Update the file header comment [C: `:7-8`] to name the four views and record "Events, Sprint Board and Release Ledger removed from the console by MA-NOV-UI (OPS-01); routes and tables unchanged (OPS-05)."
4. No hash migration is needed. The console's hash handles only `#cases?…` and `#dq?…` [C: `:1350-1352`]; no tab was ever addressable by hash.

**What does not change (OPS-05):** no route, Worker, table, row or event is deleted or altered. `meridian-control` keeps serving `GET /api/ops/sprint-board`, `/release-ledger`, `/events`, `/drift` and the Access-guarded admin POSTs. `meridian-ops` keeps its 302s. The D1 tables `sprintboarditems`, `releaseledger`, `operationalevents` keep every row. Backend retirement is a separate assessment (not in November).

**Access to the history during transition (OPS-06):** the delivery view is the Control Tower (`claude/factory/control-tower.html`, generated from `claude/packets/*_Status.json`); the D1 tables are frozen legacy (CLAUDE.md). Anyone who still needs the old records reads them by the same public GET URLs (e.g. `https://meridian-control.navinmv1981.workers.dev/api/ops/release-ledger`) or by `wrangler d1 execute` read. Carry-over 13 (D1 sprintboard/releaseledger sync check) closes as **"not needed: frozen legacy, no competing writer; the Tower is the only delivery view"** — the build report states it, nothing is synced.

**Public Ops GET routes (SA1 carry-over "public Ops GET routes (Access)").** Today, without sign-in, anyone can read: the four `meridian-control` GETs (ticket titles, release summaries, actor roles), `meridian-ops` `/api/ops/budget-risk`, `/openfigi-status`, `/cf/d1-today`, `/cf/invocations` (D1 usage and cron counts), and `meridian-proxy` `/api/ops-health`. **Removing the tabs neither opens nor closes any of these.** Guarding them needs Worker changes (and `meridian-ops` is at its 15/15 route ceiling [C: `ops-api.js:10-12`]), so it is **not** in the November build. Decision **UD-3** below.

### 1.3 Drift & Budget tab content

Kept, with two content corrections that follow from the removal and from the frozen ledger:

- **"Deployment Drift" panel** reads `releaseledger` [C: `control-api.js:305-313`], which nothing has written since the Tower took over. It would show "in sync across every tracked release" about a frozen table. **Remove this panel from the tab** (front end only; `/api/ops/drift` stays). Decision **UD-2**.
- Panel title "Live Cloudflare Metrics (MA-AUG-006)" → **"Cloudflare usage today"**. The sub-line keeps its numbers and is reworded: "`{rowsWritten}` of `{daily_cap}` rows written today (`{pct}`%), as metered by Cloudflare for the whole account".
- Order on the tab: Shared D1 write budget → Cloudflare usage today → Instrument → entity resolution.

### 1.4 System Health tab content

Functionality kept (one `/api/ops-health` read; 10-minute poll only while visible) [C: `:57-77`]. Two placeholders are not data and are wrong today, so they change:

- **"Worker Status" static table** [C: `:42-47,227-235,370-385`] says `meridian-holdings` "Every 2h", `meridian-entities-enrich` "Frozen", `meridian-entities-seed` "Daily 03:00 Frozen". All three are wrong (holdings Sunday 04:00; seed Monday 04:00 since MA-OCT-012; enrich runs). **Remove the table and `OPS_WORKERS`.** Replace with one line: "Job schedules and missed runs are checked by the Ops sweep; problems appear in Cases." Decision **UD-4**.
- **"Reads Today" gauge** shows the literal `CHECK_DASHBOARD` [C: `:298-303`]. Replace the gauge with text: "Reads today: see Drift & Budget → Cloudflare usage today."
- Heading "MERIDIAN ATLAS — OPS" [C: `:248-250`] moves out of the Health tab into a console title bar above the tabs (see §1.5), so every tab has it.

### 1.5 Style alignment (OPS-03)

**Mechanism.** The console shell has no stylesheet beyond `html,body{background:#0a0c10;color:#e8eaed;font:14px/1.45 system-ui…}` [C: `console-page.js:36`], and its CSP is `style-src 'unsafe-inline'` with no font or stylesheet host [C: `:27`]. So:

1. `ma-ops.js` injects one `<style id="ops-theme">` element on panel creation (allowed by `'unsafe-inline'`). It holds (a) the main product's token block copied **verbatim** from `App/index.html:10-22` (`:root` values only — the console has no dark/compact toggle), and (b) the `.ops-*` component classes in the table below.
2. The token block carries a comment "Copied from App/index.html :root — keep in step". A test (§5.1 O-9) fails if any token value differs from `index.html`.
3. Font: `font-family: 'Inter', system-ui, -apple-system, sans-serif`. Inter cannot be fetched under the console CSP, so the console shows Inter only where it is installed locally and falls back to the system UI font. **Accepted for November** (no `meridian-ops` deploy). Decision **UD-5**.
4. `OPS_COLORS` is removed. Every colour in `ma-ops.js` comes from a token through a class, or through `var(--token)` in the few inline styles that must stay dynamic (bar widths, gauge fractions). SVG gauges use `style="stroke:var(--blue)"`, not `stroke="var(…)"` (presentation attributes do not take `var()`).
5. Target: no hex colour literal and no `rgba(` in `ma-ops.js` outside the `ops-theme` block; `style=` attributes down from **215** [R: SA1; `grep -c` at `bc1d079`] to **≤ 30**, each one dynamic (width %, `display` toggles, gauge geometry).

**Token mapping (old → new):**

| Ops today | Used for | New token | Contrast on `--bg2` (computed) |
|---|---|---|---|
| `#0a0c10` panel bg | page | `--bg` | — |
| `bg2` | cards, tables | `--bg2`; table header row `--bg3` | — |
| `#e8eaed` text | body text | `--text` | ≥ 12:1 |
| `#9aa0a8` textDim | labels, secondary | `--text2` | 7.02:1 |
| `#5a6068` grey | sev4, idle | `--muted` (text), `--border2` (lines) | 5.24:1 |
| `#4DC8C8` teal | selected tab, primary button, links, sev3 | `--blue` (the main product's accent: `.btn.on`, search focus, EXP primary) | — |
| `#D4A843` amber · `#C85050` red · `#4CC880` green | warnings, errors, OK | `--amber` · `--red` · `--green`, with their `-bg`/`-bd` pairs | — |
| `#1c2028`, `#2a3038` | dividers, button borders | `--border`, `--border2` | — |
| radius 10px / 6px / 12px | cards, buttons, chips | `--r` (2px) | — |

**Components (classes in `ops-theme`, modelled on existing main-product classes):**

| Class | Matches main product | Spec |
|---|---|---|
| `.ops-titlebar` | `#header` | 42px bar, `--bg2`, bottom border `--border`; left: logo mark + "Meridian Atlas" / sub-line "Operator console" (13px/600 and 8px `--dim` → use `--muted` for contrast); right: acting-role note if present |
| `.ops-tabs`, `.ops-tab` | `.seg-btn` / header tiles | 11px, 600, uppercase, letter-spacing .06em, `--text2`; selected: `--text`, 2px bottom border `--blue`; hover `--text` |
| `.ops-card` | `.card` + `.chdr` | `--bg2`, 1px `--border`, `--r`; header row like `.chdr` (6px 12px, bottom border) with title in `.ctitle` style (11px, 600, uppercase, .06em) |
| `.ops-tbl` | `.dt` | `th` 8–9px 600 uppercase `--dim`→`--text2`, `--bg3` background, left-aligned text columns, right-aligned numbers; `td` 11–12px, row height ≥ 28px, bottom border `--border`; hover row `rgba(160,184,214,.05)` (the `.dt` value, kept as the one allowed literal inside `ops-theme`) |
| `.ops-btn` | `.btn` | `--bg3`, 1px `--border`, `--text2`, 10.5px/500, 3px 8px; hover `--bg4`/`--border2`/`--text` |
| `.ops-btn.primary` | `.btn.on`, `.exp-btn.primary` | `--blue-bg`, `--blue`, `--blue-bd` |
| `.ops-chip` (status filter) | `.btn.on` | off: `.ops-btn`; on: `.btn.on` look + `aria-pressed="true"`; the "✓" suffix stays |
| `.ops-sev.s1…s4` | `.exp-badge` | s1 red, s2 amber, s3 blue, s4 muted; label "Sev 1"… unchanged |
| `.ops-field` (drawer inputs, selects, textareas) | `#search` | `--bg3`, 1px `--border`, `--r`, 11–12px; focus border `--blue`, background `--bg4` |
| `.ops-drawer` | modal panels | `--bg2`, left border `--border2`, no box-shadow (`--sh` is none) |
| `.ops-num` | `.ms-p`, mono numbers | `font-family: var(--mono)`, tabular |
| `.ops-note` | `.txt-dim-9` / `.exp-note` | 11px `--text2` |

Sizes: the console currently uses 13–20px text; the main product is 10–13px (`html{font-size:13px}`). The console adopts the main product's scale; the two largest numbers (write budget, coverage) stay at 18px.

### 1.6 States (OPS-04)

One shared set of state renderers in `ma-ops.js` (`ops_stateHtml(kind, text)`), used by all four tabs:

| State | Shown | Exact text (new or kept) |
|---|---|---|
| Loading | `.ops-note` row with a spinner (`.spin` look), container `aria-busy="true"` | Kept: "Loading…" |
| Empty — Cases | table body row | Kept: "No open cases. The last sweep raised nothing new." when the filter is Open only; **new** "No cases with these statuses." for any other filter |
| Empty — DQ | table body row | Kept: "No tickets with these statuses." |
| Error — Cases/DQ | `role="alert"` row in `--red` on `--red-bg` | Kept: the `opsc_mapResponse` texts (signed out, changed since opened, 400s) |
| Error — Health | card with Retry | **New:** "Couldn't load system health (`{HTTP 503 / network error}`)." + button "Try again" |
| Error — Drift & Budget panels | per-panel line in `--red`, others still render | **New:** "Couldn't load the write budget." · "Couldn't load Cloudflare usage. If this keeps happening, check the CF_ANALYTICS_TOKEN secret on meridian-ops." · "Couldn't load `{script}`." · "Couldn't load instrument → entity resolution." |
| Selected | tab: as §1.5; table row whose drawer is open: `aria-current="true"`, background `--bg4`, 2px left border `--blue` | — |
| Focus | every tab, button, chip, focusable row, field: `:focus-visible{outline:2px solid var(--blue);outline-offset:1px}` (same rule as EXP) | — |

Behaviour kept: no inline `on*=` handlers; delegated listeners; drawer Escape closes and returns focus; tablist arrow/Home/End keys.

### 1.7 Desktop and mobile (OPS-04)

- **≥ 641px:** panel padding 16px 24px (was 32px 40px). Cards full width, 10px gap.
- **≤ 640px:** title bar sub-line hidden; tab bar one row, `overflow-x:auto`, no wrap, no scrollbar jump (`scroll-snap-type:x proximity`); every table sits in an `overflow-x:auto` wrapper so the page never scrolls sideways; Health gauges and the coverage trio stack in one column; drawer stays `min(720px,100vw)` [C: `:1397`] with padding 16px; buttons min height 32px.
- Checked at **1280, 800 and 375px** in the preview harness (§1.9).

### 1.8 Regression checks per kept tab (OPS-02)

| Tab | Must still do | Check |
|---|---|---|
| System Health | One `/api/ops-health` read on open; poll every 10 min only while Health is visible; none on other tabs; enrichment-removed message when counts are null | existing `ops-console.test.mjs` M-3 checks + `ETF Refresh/tests/ops-health.test.mjs` pass unchanged |
| Cases | List (limit 50, Load more), status chips → hash `#cases?status=…`, drawer open/close/restore from hash, legal actions only, acting role pref, 409 "changed since you opened it" | `ops-console.test.mjs` AC checks pass unchanged |
| DQ Tickets | As Cases + members, "Protected decision" badge, `do_not_merge` rules | `ops-console.test.mjs` §5.3 checks pass unchanged |
| Drift & Budget | 6 reads in parallel (5 after the drift panel goes), each failing alone, Refresh | updated `ops-a.test.mjs` route map |
| Console | Opens on Cases; four tabs; Events/Sprint/Release routes never requested | updated `ops-a.test.mjs` (§5.1 O-1–O-3) |

### 1.9 Preview without the live console

Because the live console only loads released code (§1.1), the build adds a **test-only preview harness**: `App/Ops/tests/preview/console-preview.html` + `fixtures.js`. It sets `window.MA_OPS_CONSOLE = true`, loads `../../../ma-data.js` and `../../../ma-ops.js`, and replaces `fetch` with fixture responses (Health body, 3 cases, 2 DQ tickets with a protected one, budget/CF/OpenFIGI bodies), with a `?fail=health,drift` switch for error states. It is never copied to `docs/` (`generate-docs.mjs` copies the 11 named files only). The real console is checked right after release (§4.4 step 7).

---

## 2 HOME (HOME-01 – HOME-07)

### 2.1 Today (evidence)

- The page opens straight into a market dashboard: header → status bar → market intelligence banner → ticker → World Indices / Yields / Equities / Movers / Commodities / FX / Futures, with News, Geopolitics, Calendar, Watchlist, Sectors on the right [C: `index.html:1176-1410`; P: screenshot 01].
- Research entry points exist only as header tiles: Research, DCF, ETF Holdings, Corporate Atlas, Fixed Income, **Exposure** (`#/exposure`), OPS [C: `:1199-1206`].
- The header search finds **tickers** (Yahoo/FMP) and opens a symbol modal with Chart / Research / Watchlist / DCF; it has **no route to Corporate Atlas** [C: `ma-search.js`; `index.html:1425-1470`].
- **No responsive rules** for the page: the only two `@media` blocks are for the DCF panel [C: `:863,875`]. At 800px the header tiles run past the edge (Exposure cut, OPS hidden) [P: screenshot 01]. At 375px the document is **1,249px wide**, the search box is 40px, `#expBtn` sits at x = 1048 and `#opsBtn` at 1098 (off-screen), and the left market column collapses to slivers [P: screenshot 02, measured by script]. This is carry-over 12.
- Live claims: a green pulsing **"LIVE"** pill in the header [C: `:1197`] and "Live ETF view" on Equity Sectors [C: `:1404`], while the footer says "Prices may be delayed" [C: `:1415`].
- `#/exposure` and `#/entity/{id}` open as full-screen layers with "← Back to Home" and ×; Back returns to the homepage [P: screenshot 03; C: `_navParseFrom` → `direct`, `ma-entities.js:1691-1703`].

### 2.2 Layout

A new section `#home-entry` goes **between `#sbar` and `#intel-banner`** [C: `:1212-1215`]. Everything below it is unchanged (HOME-05). Height budget: ≤ 190px at 1280px wide, so the banner and the first market row stay above the fold at 1280×800.

```
┌ header (unchanged tiles; responsive, §2.6) ───────────────────────────────────────┐
├ status bar ────────────────────────────────────────────────────────────────────────┤
│ #home-entry                                                                        │
│  [Proposition: heading + one line + data note]                                     │
│  ┌ Exposure analysis ───────────────────┐  ┌ Company research ────────────────────┐ │
│  │ text                                  │  │ text                                  │ │
│  │ [Analyse my portfolio]  See an example│  │ [ Company name, e.g. Apple ] [Search] │ │
│  │ note                                  │  │ results list (≤ 8) / states           │ │
│  └───────────────────────────────────────┘  └───────────────────────────────────────┘ │
│  "Markets and news" divider label                                                  │
├ intel banner, ticker, market cards, news (unchanged) ──────────────────────────────┤
```

Styling uses existing tokens and classes only: `.card` + `.chdr` look for the two route cards (`--bg2`, `--border`, `--r`), heading 15px/600 `--text`, body 11.5px `--text2` (same as `#market-narrative`), notes 10px `--muted` (not `--dim`: contrast, §3.2). Primary button: `.btn.on` look, 12px, padding 6px 12px. Route cards side by side ≥ 901px; stacked ≤ 900px.

### 2.3 Exact copy

**Proposition (HOME-01)**

- Heading (h1): "See which companies your investments really hold"
- Line: "Meridian Atlas connects ETF holdings, companies and their legal entities, institutional 13F positions and SEC-registered bonds, so you can follow one company across all of them."
- Data note (HOME-06): "Built from stored public filings (SEC N-PORT, 13F and EDGAR) and delayed market prices. Every result shows the month or quarter it comes from."

**Exposure analysis card (HOME-02)**

- Title: "Exposure analysis"
- Text: "Enter your ETFs and shares with their % of your portfolio. See the companies you reach, directly and through ETFs, and what we couldn't match."
- Primary button (link to `#/exposure`): "Analyse my portfolio"
- Secondary link (to the example hash, §2.4): "See an example: IVV 60%, EEM 25%, Taiwan Semiconductor 15%"
- Note: "Nothing is saved; your inputs stay in the page link. Fund holdings come from SEC filings and are usually several months old."

**Company research card (HOME-03)**

- Title: "Company research"
- Text: "Find a company to see its legal entities, the ETFs that hold it, 13F filers' positions and its registered bonds."
- Input label (visually hidden, for screen readers): "Company name"; placeholder: "Company name, e.g. Apple"
- Button: "Search"
- Note: "Not every company has data in every set. The company page says what each panel covers."

**Divider label above the banner:** "Markets and news" (styled as `.ctitle`, `--text2`), with the right-aligned note "Prices delayed".

**Header and sectors (HOME-06):**

- Header pill "LIVE" → "DELAYED"; the pill keeps its shape but uses the neutral `.risk-neu` colours (`--bg3`, `--text2`, `--border`) and the pulsing dot is removed. Tooltip: "Market prices are delayed and refresh automatically." Decision **UD-6**.
- Equity Sectors note "Live ETF view" → "Sector ETFs".

### 2.4 Example portfolio (HOME-02)

Link: `#/exposure?i=ETF:IVV:60,ETF:EEM:25,EQ:2191:15`

- Each part was checked on 21 Nov in the local preview against the live R-EXP1 route [P]: **IVV** (Mar 2026, filed 28 May 2026), **EEM** (Feb 2026, filed 23 Apr 2026), entity **2191 = Taiwan Semiconductor Manufacturing Co Ltd**. EEM 85 + TSMC 15 gave TSMC 26.17% combined (15.00 direct + 11.17 via EEM), "✓ Adds up to 100%". IVV 50 + EFA 50 gave 99.40% companies identified, 5% lower-confidence.
- It shows the proposition in one screen: a company held directly **and** through an ETF, three inputs, 100% allocated.
- **It will show the stale warning.** No equity ETF checked has holdings within 3 months of the newest stored month (Aug 2026, set by MBB). The warning is correct and stays; the build re-checks the example on its own preview (≤ 2 look-throughs) and records the numbers for the demo.
- If the Founder prefers no stale chip on the first click, the alternative is to wait for a fresher ETF; there is none today. Decision **UD-7**.

### 2.5 Company search behaviour (HOME-03, HOME-04)

Code in `App/ma-search.js` (search domain; no import from `ma-entities.js`). It calls the existing shared helper `data_entitiesGet('/api/entities/search?q=…')` (`ma-data.js`, the same route the EXP picker and the nav layer use [C: `ma-entities.js:1847,3189`]) and navigates by setting `location.hash = '#/entity/{entity_id}'`. The router in `index.html` opens the company layer; its "← Back to Home" returns here.

| Rule | Value |
|---|---|
| Trigger | Search button or Enter; also debounced typing (350 ms) once the query has ≥ 2 characters |
| Request | 1 GET per settled query; the previous request is ignored if a newer one starts; no storage |
| Results | ≤ 8 rows: legal name · country · type (as the EXP picker shows them) [C: `ma-entities.js:3195`]; each row is a link `#/entity/{id}`; ↑/↓ moves, Enter opens, Escape clears |
| Too short | nothing shown |
| Loading | "Searching…" |
| No results | "No companies found. Try the legal name, for example "Apple Inc"." |
| Error / offline | "Couldn't reach company search. Try again." + button "Try again" |
| Escaping | every server string through the existing escape helper; no `innerHTML` of raw values |

HOME-04 coherence: the header Exposure tile, the homepage button, the example link and the EXP screen all use `#/exposure…`; company results, EXP company rows and the Corporate Atlas panel all land on `#/entity/{id}`; both layers return Home by "← Back to Home", × or browser Back. No new route type and no change to the router.

### 2.6 Header and page at phone width (HOME-07, carry-over 12)

CSS only, in `index.html`:

- **≤ 900px:** header becomes two rows (`flex-wrap:wrap; height:auto`). Row 1: logo, search (`flex:1`, min 140px), Dark, Auto, Refresh. Row 2: the action tiles in **one horizontally scrollable row** (`overflow-x:auto; flex-wrap:nowrap; scroll-snap-type:x proximity`), full width, Exposure first after Research so it is visible without scrolling. Compact button, clock and the DELAYED pill hidden ≤ 640px.
- **≤ 900px:** `#main` stacks (`flex-direction:column`); `#right` width 100%; `.grid2` one column; each `.dt` table sits in `overflow-x:auto` (wrapper or `.card{overflow-x:auto}`) so the document width equals the viewport.
- **≤ 640px:** `#home-entry` padding 10px; heading 14px; route cards stacked; the search input and button on one row; buttons ≥ 32px tall.
- Focus: add `:focus-visible{outline:2px solid var(--blue);outline-offset:1px}` for `.btn`, `.action-tile`, `.seg-btn`, home-entry links and inputs (the page has none today except input border colours [C: `:78,577`]).
- Acceptance: at 375px `document.documentElement.scrollWidth === 375`, `#expBtn` and the homepage buttons are reachable without sideways page scroll (§5.2 H-8).

### 2.7 States (HOME-07)

| Part | Loading | Empty | Error |
|---|---|---|---|
| Proposition + route cards | static HTML, render before any script | — | — |
| Company search | "Searching…" | "No companies found…" (§2.5) | "Couldn't reach company search…" + Try again |
| Market cards, news | unchanged ("Loading…", "No geopolitics stories") | unchanged | unchanged (status bar) |

The two routes work even when every market feed fails (no dependency on market scripts).

---

## 3 Release polish (EXP screen)

All in `App/ma-entities.js`, EXP section only; calculations unchanged. The EXP spec's verbatim labels that change here are updated in `exp-ui.test.mjs` (the Founder's approval of this spec is the wording approval).

### 3.1 Gaps panel wording (CARRY 19 Nov) [C: `ma-entities.js:3486-3502`]

| Today | New |
|---|---|
| "Largest holdings not mapped to a company (by contribution to your portfolio; up to 25 per fund are reported)." | "The largest holdings we couldn't match to a company, by their share of your portfolio (up to 25 per fund)." |
| Column "Fund weight" · "Of portfolio" · "Identifier" | "Share of fund" · "Share of your portfolio" · "Identifier" (kept) |
| Link text "Not mapped to a company" | kept (EXP-10 label) |
| "No unmapped holdings reported." | "Every holding in these funds was matched to a company." |
| "**Unsupported inputs** (their allocation is on the unsupported line)" | "**Not analysed** (shown as "Not analysed" in What your portfolio is made of)" |
| item: "`{label}` `{x}%` — not supported: too large for live look-through (`{n}` holdings…)" | "`{label}` `{x}%` — This fund is too large to look through here (`{n}` holdings)." · no holdings: "We don't have this fund's holdings." · unknown: "We don't recognise this fund." (reuse `exp_unsupportedSentence`) |
| "**Load errors** (their allocation is on the not-loaded line)" | "**Couldn't load** (shown as "Couldn't load" in What your portfolio is made of)" |
| item: "— not loaded – retry [Retry]" | "— the request failed. [Try again]" |
| Panel title "Gaps" | "What we couldn't analyse" |

### 3.2 `.exp-dim` contrast (UI.REVIEW N-4 remainder)

`.exp-dim{color:var(--dim)}` [C: `:2916`] measures 3.95:1 on `--bg2` and 3.80:1 on `--bg3` (light), 3.58:1 on `--bg3` (dark). Change to `var(--muted)`: **5.24 / 5.04 / 4.81:1** (all ≥ 4.5:1 for 11–12px text). Same change for the EXP picker note and the header-chip prefix "Holdings dates:" if they use `--dim`.

### 3.3 Remaining jargon on the EXP screen

| Where [C] | Today | New |
|---|---|---|
| Header chip `:3311` | "… · source SEC N-PORT · stale" | "… · from SEC N-PORT · older data" |
| Stale chip `:3321` | "Stale: `{list}` — more than 3 months older than the newest stored month" | "Older data: `{list}` — more than 3 months older than the newest holdings we store (`{month}`)" (merges the separate "newest stored" chip) |
| Mixed chip `:3315` | "Mixed months: …. Each ETF uses its own latest stored month." | kept |
| Partial chip `:3324` | "Partial result: `{list}` not loaded — see Gaps" | "Partial result: `{list}` couldn't load — see What we couldn't analyse" |
| Total failure `:3296` | "…or every look-through failed. No numbers are shown." | "Corporate Atlas could not be reached, or no fund's holdings could be loaded. No numbers are shown." |
| Confidence badge `:3423` | "Low (heuristic)" | "Low (name match)" |
| Row status `:2835` | "not loaded – retry" | "couldn't load – try again" |
| Row status (422) | "not supported: too large for live look-through" | "not supported: too large to look through here" |
| Overlap note `:3482` | "ETF overlap by company — Σ min(fund weight) over companies both funds hold. This differs from the ETF page's overlap, which is by security." | "ETF overlap by company — for each company both funds hold, the smaller of its two fund weights, added up. The ETF page's overlap is by security, so the numbers differ." |
| Compare toggle, panel lines, EXP-10 evidence labels | kept | — |

Also closes **N-7** if cheap: the "241 of 264" literal in the ETF-holders label [R: CARRY 18 Nov] becomes `{n} of {m}` from `/api/etf-list` counts (`hasNport`) already loaded by the picker; if the list is not loaded, the label reads "Funds in Meridian's N-PORT set; not all ETFs". If this needs more than the picker's existing data, it stays in CARRY.

---

## 4 November release plan

### 4.1 Release change request — outline (the full CR is unit REL.CR)

| Item | Content |
|---|---|
| Change | GitHub Pages source `October-2026` `/docs` → **`November-2026` `/docs`** |
| Why | Publish EXP screen (`#/exposure`, W3/W3R2/W3R3), OPS cleanup, HOME entrance and polish. Worker side already live: `meridian-entities-api` R-EXP1 (`a9ffeaae`), `meridian-entities-enrich` (`aa39edf6`, back-fill job OFF) [R] |
| Contents | Front-end files that change vs `October-2026/docs` today: `index.html`, `ma-entities.js` [C: sha compare 21 Nov]; after the builds also `ma-ops.js`, `ma-search.js` |
| Pre-checks | All test suites green (`App/Ops/tests/*`, `App/Corporate Atlas/tests/exp-*`, `App/ETF Refresh/tests/ops-health.test.mjs`); reviews PASS; Founder UAT on local preview |
| Steps | (1) `node generate-docs.mjs --dry-run` and diff `.docs-dry-run/` against `App/` (11 files) · (2) `node generate-docs.mjs` · (3) confirm `docs/.nojekyll` exists (the script does not create it [R: CLAUDE.md]) · (4) commit `docs/` on `November-2026`, push · (5) **Founder** switches Pages to `November-2026` `/docs` in GitHub Settings · (6) wait for the Pages build; verify all 11 served files are byte-identical to `docs/` at the pushed commit, and `/.nojekyll` → 200 · (7) hard-refresh checks (§4.4) · (8) update CLAUDE.md DEPLOY_BRANCH (Main Lane) |
| Rollback | Switch Pages back to `October-2026` `/docs` (untouched; last served `98e830e` content). One Settings change, ~1 min build. The console reverts with it (it loads `ma-ops.js` from Pages). Nothing in Workers or D1 needs rolling back: the Worker changes are additive and the October front end does not call R-EXP1 |
| Cache | Pages serves `max-age=600` and script tags carry no version stamp, so for ~10 min a browser can mix the new `index.html` with old scripts. Checks run after a hard refresh; the demo runs > 10 min after the final push |
| Window | Fri 27 Nov, after the 06:00Z jobs; Sat 28 kept for verification and any rollback |

### 4.2 What is in the release

| Item | Source | State on 21 Nov |
|---|---|---|
| EXP screen + header Exposure tile | `ma-entities.js`, `index.html` (W3, W3R2, W3R3) | built, UAT PASS (NML-1120-3), not released |
| OPS cleanup | `ma-ops.js` | this spec |
| HOME entrance + phone-width header | `index.html`, `ma-search.js` | this spec |
| Polish | `ma-entities.js` | this spec |
| Back-fill switch-on (FR13) | Worker config (Ops rows), not the front end | separate checklist item; not a release dependency |

### 4.3 Not in the release

BOND-01 (stretch, only if done by Thu 26 and then only as its own item), the CARRY items not named above, any Worker change, the public Ops GET guard (UD-3), Inter in the console (UD-5).

### 4.4 Post-release checks (Fri 27)

1. Homepage at 1280, 800 and 375px: proposition, two routes, DELAYED pill, no sideways scroll.
2. Example link → results with "✓ Adds up to 100%".
3. Company search "Taiwan" → result → company page → Back to Home.
4. Header Exposure tile → `#/exposure` → Back.
5. Market cards and news load (HOME-05).
6. Byte-identical check of the 11 files + `/.nojekyll`.
7. **Console** (Founder signed in): four tabs, Cases list, open a case drawer, DQ list, Drift & Budget numbers, Health; 375px check on a phone.
8. Rollback trigger: any of 1–7 broken in a way a one-line fix cannot repair by Sat 28 12:00Z → switch Pages back.

---

## 5 Acceptance tests

### 5.1 OPS (node tests in `App/Ops/tests/`, plus the preview harness)

| # | Test | Expected |
|---|---|---|
| O-1 | Tab bar in console mode | exactly `health, cases, dq, drift`, in order; Cases selected on open |
| O-2 | Panels | four `#ops-tab-*` panels; none for events/sprint/release |
| O-3 | Routes requested when every tab is opened | none of `/api/ops/sprint-board`, `/release-ledger`, `/events`, `/drift` (UD-2 yes); Drift & Budget reads exactly budget-risk, openfigi-status, cf/d1-today, cf/invocations ×3 |
| O-4 | Keyboard | ArrowRight from Drift & Budget wraps to System Health; Home/End go to Health/Drift; `aria-selected`/`tabindex` follow |
| O-5 | Health | one ops-health read, 10-min poll only on Health; no "CHECK_DASHBOARD"; no Worker Status table |
| O-6 | Cases / DQ | all existing `ops-console.test.mjs` AC/§5.x checks pass unchanged |
| O-7 | Tokens | no `#[0-9a-f]{3,8}` and no `rgba(` in `ma-ops.js` outside the `ops-theme` block; `OPS_COLORS` absent; `style=` count ≤ 30 |
| O-8 | States | each state in §1.6 renders its exact text (fixtures: empty list, 500, signed-out, offline) |
| O-9 | Token sync | every `--token: value` in `ops-theme` equals the `:root` value in `App/index.html` |
| O-10 | Escaping | the existing escape checks pass; fixture titles with `<script>` render as text |
| O-11 | Records (OPS-05) | read-only: `GET …/api/ops/release-ledger` and `/sprint-board` still return 200 with rows after release (one call each, post-release) |
| O-V | Visual (harness, 1280/800/375) | console looks like the main product: same background, accent, table, button and chip styles; tab bar scrolls at 375; no sideways page scroll; focus ring visible on Tab |

### 5.2 HOME (preview, plus a node check of `index.html` / `ma-search.js` strings)

| # | Test | Expected |
|---|---|---|
| H-1 | Copy | every §2.3 string present verbatim; none of the banned words in new/changed lines |
| H-2 | Exposure route | "Analyse my portfolio" → `#/exposure` empty state; Back → Home |
| H-3 | Example | example link → 3 inputs, total 100.00%, TSMC row shows direct 15.00 and a via-ETF share; "✓ Adds up to 100%" |
| H-4 | Company search | "Taiwan Semiconductor" → ≤ 8 results incl. entity 2191 (not yet checked against `/api/entities/search`; the build records the query that finds it) → `#/entity/2191` → "← Back to Home" returns to the homepage at the same scroll |
| H-5 | Search states | 1 char: nothing; offline: error + Try again works; nonsense query: no-results text |
| H-6 | Keyboard | Tab order: header → proposition links → Analyse → example → search input → Search → results; ↑/↓/Enter/Escape in results; focus ring visible |
| H-7 | Market/news kept | every card id from `index.html:1215-1406` still present and loading (HOME-05) |
| H-8 | Phone width | at 375px: `scrollWidth === 375`; Exposure tile visible in row 2 without scrolling; route cards stacked; at 800px no tile past the edge |
| H-9 | No live claim | no "LIVE" text; "DELAYED" pill; "Sector ETFs" |
| H-10 | Failure isolation | with market feeds blocked, the proposition and both routes still work |

### 5.3 Polish

| # | Test | Expected |
|---|---|---|
| P-1 | Gaps / chips / badges | every §3.1 and §3.3 "New" string present; the old strings absent from the EXP section |
| P-2 | Contrast | `.exp-dim` resolves to `--muted`; ≥ 4.5:1 on `--bg2` and `--bg3` in both themes |
| P-3 | Calculations | `exp-compute.test.mjs` and `exp-route.test.mjs` unchanged and green |

### 5.4 Final demo script — Mon 30 Nov (≈ 15 min)

1. **Ops console** (signed in): "Ops now has four views." System Health → Cases (open a case, show the drawer, close) → DQ Tickets (Protected decision badge) → Drift & Budget (write budget, Cloudflare usage). Say: "Events, Sprint Board and Release Ledger are no longer tabs; their records and routes are kept; delivery status is the Control Tower." Show the Tower once.
2. **Homepage**: read the heading and the data note. Point at the two routes and the DELAYED pill.
3. **Exposure journey**: "See an example" → inputs and dates (point at the older-data chip and say why) → "What your portfolio is made of" adds up to 100% → Companies table, TSMC direct + via EEM → expand contributions → "What we couldn't analyse" → TSMC company page (ETF holders, 13F, bonds labels with their periods) → Back to the result → Back to Home.
4. **Company route**: search "Taiwan" → company page → Back to Home.
5. **Phone**: the same homepage on a phone; header row scrolls; open the example.
6. **BOND-01** only if delivered: status definitions and exception counts.

---

## 6 Work units

One worker; ~1 Founder checkpoint a day; S ≤ 1 day, M 2–3 days (fractions are worker-days). The Ops build starts **today, Sat 21** (NML-1121-2).

| Unit | Content | Writable paths | Gate after | Size | Day |
|---|---|---|---|---|---|
| **UI.OPS.BUILD** | §1.2–1.9: remove 3 tabs; `ops-theme` tokens + classes; restyle Health, Cases, DQ, Drift & Budget; states, focus, mobile; Drift/Health content changes per UD-2/UD-4; tests O-1–O-10; preview harness; screenshots 1280/800/375 | `App/ma-ops.js`, `App/Ops/tests/ops-a.test.mjs`, `App/Ops/tests/ops-console.test.mjs`, `App/Ops/tests/preview/*`; commit | Review | M 1.5 | Sat 21 – Sun 22 |
| **UI.OPS.REVIEW** | Independent: tests, harness visual check vs main product, escaping, no route/record change, CSP fit (no external style/font request) | report only | Founder: approve HOME build | S 0.5 | Sun 22 |
| **UI.HOME.BUILD** | §2: `#home-entry`, copy, example link (re-check ≤ 2 look-throughs), company search in `ma-search.js`, header/page responsive CSS, focus, DELAYED/Sector ETFs; tests H-1, H-9 as node string checks; preview H-2–H-10 | `App/index.html`, `App/ma-search.js`, a new node test `App/Corporate Atlas/tests/home-entry.test.mjs`; commit | Review | M 1.5 | Mon 23 – Tue 24 |
| **UI.POLISH** | §3: Gaps wording, chips, badges, `.exp-dim`, overlap note; N-7 if cheap; update `exp-ui.test.mjs` | `App/ma-entities.js` (EXP section), `App/Corporate Atlas/tests/exp-ui.test.mjs`; commit | Review (folded into UI.HOME.REVIEW) | S 0.5 | Tue 24 |
| **UI.HOME.REVIEW** | Independent review of HOME + POLISH: copy verbatim, banned words, a11y, 375px, search escaping, request counts | report only | Founder UAT | S 0.5 | Tue 24 – Wed 25 |
| **UAT (Founder)** | Local preview: homepage, example, search, EXP polish, phone width; Ops via the harness | — | Founder "UAT pass" | — | Wed 25 |
| **UI.FIX** (if needed) | UAT findings only | as the unit that owns the file | Main Lane check | S 0.5 | Wed 25 – Thu 26 |
| **REL.CR** | Full release CR from §4.1; dry run + diff; three suites green; demo script final | CR file, report | Founder release approval | S 0.5 | Thu 26 |
| **REL.GO** | §4.1 steps 1–8; post-release checks §4.4 | `docs/`, CLAUDE.md DEPLOY_BRANCH (Main Lane writes it); commit + push | Founder switches Pages | S 0.5 | Fri 27 (Sat 28 buffer) |
| **DEMO** | §5.4 | — | Founder acceptance | — | Mon 30 |

Worker total **6.0 days** over Sat 21 – Fri 27; critical path OPS.BUILD → HOME.BUILD → HOME.REVIEW → UAT → REL.CR → REL.GO. Checkpoints: one a day except Tue 24 (HOME build hand-off and POLISH share the HOME.REVIEW gate, so the Founder still sees one item).

**If it slips, cut in this order** (each keeps the requirement met at a lower polish level):
1. BOND-01 stretch (already optional).
2. N-7 dynamic count (stays in CARRY).
3. Ops `style=` target relaxed from ≤ 30 to "no hex colours, tokens only" (visual match kept; refactor depth reduced).
4. Homepage company search falls back to a button "Open Corporate Atlas search" that calls the existing `openCorporateAtlas()` panel (HOME-03 still met; no inline results).
5. Mobile layout of the market cards below the fold (keep the header row and `#home-entry` responsive; HOME-07's phone-width row still fixed).

Never cut: tab removal, token alignment, HOME-01/02/03/06 copy, the release itself.

---

## 7 Open decisions for the Founder

1. **UD-1 — Approve the exact copy** in §2.3, §3.1 and §3.3 (homepage proposition and routes, Gaps panel, EXP chips). **Recommend: approve as written.** This approval is the wording approval for the builds.
2. **UD-2 — Drop the "Deployment Drift" panel** from the Drift & Budget tab: it reads the frozen `releaseledger`, so its "in sync" message is no longer meaningful. Route and table stay. **Recommend: yes.**
3. **UD-3 — Public Ops GET routes stay public in November.** Removing the tabs changes nothing about them; guarding them needs Worker changes (meridian-ops is at 15/15 routes) and its own CR. Exposure: legacy ticket/release titles, actor roles, D1 usage counts; no secrets, no personal data. **Recommend: leave them for November and open a December Access packet** (block the three legacy GETs on meridian-control; move budget/CF reads behind Access).
4. **UD-4 — Remove the static "Worker Status" table and the `CHECK_DASHBOARD` gauge** from System Health; both show wrong or placeholder content. **Recommend: yes** (the one-line pointer to Cases replaces them).
5. **UD-5 — Console font.** The console CSP blocks Google Fonts, so the console uses Inter only where installed, else the system font. Fixing it needs a `meridian-ops` deploy (CSP `style-src`/`font-src`). **Recommend: accept the fallback for November.**
6. **UD-6 — Header pill "LIVE" → "DELAYED"** (neutral colours, no pulse) and "Live ETF view" → "Sector ETFs". **Recommend: yes** (HOME-06; the footer already says prices may be delayed).
7. **UD-7 — Example portfolio** `IVV 60 / EEM 25 / Taiwan Semiconductor 15`. It shows the "older data" chip because no equity ETF has holdings within 3 months of Aug 2026. **Recommend: use it and say why in the demo**; the honest chip is part of the proposition.
8. **UD-8 — Placement:** the entrance block sits above the market banner and keeps every market/news card. **Recommend: yes.** The alternative (a slimmer one-line bar) hides the company search behind a click.
9. **UD-9 — Release window Fri 27 after 06:00Z, Sat 28 as buffer, rollback by switching Pages back to `October-2026` `/docs`.** **Recommend: yes.**
