# MA-NOV-UI.OPS.BUILD — Ops console cleanup (OPS-01–06) — Report

```text
PACKET:    MA-NOV-UI.OPS.BUILD · run r-20261121T092812Z-cfe1 (interactive, LANE_OPENER_v2 67913343…71d6)
ROLE:      Engineering Lead + UX Lead
CONTROL:   MA-NOV-UI.OPS.BUILD_Control_v1.md 0cf79ec2…3ebc28 (verified)
TASK:      MA-NOV-UI.OPS.BUILD_Task_v1.md 2f556c8e…82356c (verified)
PINS:      claude/specs/MA-NOV-UI_Spec.md 4b9896de…164abd (verified) · App/ma-ops.js at bc1d079 blob 7ac34b4b…c76c6 (verified)
COMMIT:    4ad4ca3 "MA-NOV-UI.OPS.BUILD: Ops console — four tabs, main-product styling, states, preview harness"
           pushed November-2026 bc1d079..4ad4ca3; git ls-remote origin refs/heads/November-2026 = 4ad4ca31cb7641365ba7ff774112254f3db81b5c
OUTCOME:   DONE. O-1–O-10 green; all Ops suites green. Nothing released (docs/ untouched; the live console changes only at REL.GO).
```

## 1 What changed

**`App/ma-ops.js`** (1,542 → 1,465 lines; blob at 4ad4ca3)

| Area | Change |
|---|---|
| Header comment | Names the four views; records "Events, Sprint Board and Release Ledger removed from the console by MA-NOV-UI (OPS-01); routes and tables unchanged (OPS-05)." |
| Tabs (§1.2) | `OPS_TABS` = `health`, `cases`, `dq`, `drift`. Deleted `ops_loadSprintBoard`, `ops_renderSprintBoard`, `ops_loadReleaseLedger`, `ops_renderReleaseLedger`, `ops_loadEventTimeline`, `ops_renderEventTimeline`, `OPS_STAGE_COLORS`, `OPS_READ_ONLY_NOTE` and their `ops_switchTab` branches. Default stays Cases. |
| Chrome | `ops_renderTabBar` now builds a sticky `.ops-head`: title bar (logo, "Meridian Atlas" / "Operator console", "Acting as {role}" when the stored role is valid) above the tab bar. New `ops_tabButtonsHtml`, `ops_onTabKey` (one delegated keydown listener; Left/Right wrap, Home/End), one delegated click listener, `ops_titlebarRoleHtml`/`ops_refreshTitlebarRole`. Panels use the `hidden` attribute. |
| Drift & Budget (§1.3, UD-2) | `ops_renderDriftPanel` and the `/api/ops/drift` request removed (5 reads + Refresh → 6 GETs counting the three invocations). Order: write budget → "Cloudflare usage today" (reworded line "… rows written today (…%), as metered by Cloudflare for the whole account") → Instrument → Entity Resolution. Per-panel error lines per §1.6. `ops_driftToolbar` new. |
| System Health (§1.4, UD-4) | `OPS_WORKERS` and the Worker Status table removed → "Job schedules and missed runs are checked by the Ops sweep; problems appear in Cases." `CHECK_DASHBOARD` gauge removed → "Reads today: see Drift & Budget → Cloudflare usage today." "MERIDIAN ATLAS — OPS" heading moved out to the title bar. Error card "Couldn't load system health ({HTTP n / network error})." + "Try again"; first load shows the loading state. New `_opsWireHealth` (delegated), `_opsCard`, `_opsBar`. |
| Style (§1.5, UD-5) | `OPS_THEME_CSS` injected once as `<style id="ops-theme">` (`_opsInjectTheme`; `document.head`, else the panel). It holds the `:root` block copied verbatim from `App/index.html:10-22` (comment "Copied from App/index.html :root — keep in step") and the `.ops-*` classes (titlebar, tabs, card/chdr/ctitle, tbl, btn/primary/chip, sev s1–s4, field, drawer, num, note, states, bars, gauge, ≤640px media rules). Font `'Inter', system-ui, -apple-system, sans-serif`. `OPS_COLORS` removed; gauges colour by class (`.ops-stroke-*`), not attributes. Drawer is `.ops-drawer` (no `cssText`). |
| States (§1.6) | `ops_stateHtml(kind, text)` shared by all four tabs; `aria-busy` on loading containers (`_opsBusy`); Cases/DQ errors render as a `role="alert"` row in the table (and no longer also show the "No open cases" empty line under an error); new empty text "No cases with these statuses." for non-open filters; selected row `aria-current="true"` (`opsc_markSelected`, plus render-time marking); focus returns to the same row after a list re-render (`opsc_closeDrawer`). |
| Cases/DQ rendering | `opsc_sevBadge`, `opsc_statusChips`, `opsc_renderList`, `opsc_kv`, `opsc_section`, `opsc_renderHistory`, `opsc_select`/`opsc_input`/`opsc_check`, `opsc_renderForm`, `opsc_renderMembers`, `opsc_renderDrawer` restyled onto classes; new `opsc_emptyText`. `OPSC_SEV_COLOR`, `opscBtn`, `OPSC_TD` removed. Logic, texts, data attributes and request building unchanged (lines `OPSC_CONSOLE_URL` … `opsc_mapResponse` copied byte-for-byte). |

Counts (O-7): `style=` occurrences **224 → 1** (the one left is the dynamic bar width `style="width:…%"` in `_opsBar`; SA1 counted 215 lines). Hex colour literals outside `ops-theme`: **45 → 0**; `rgba(` outside: **2 → 0**. Inside `ops-theme`: the 30 copied tokens, the one allowed `.dt` hover literal, and the six logo fills copied from `index.html`'s logo SVG.

**`App/Ops/tests/ops-a.test.mjs`** — rewritten §2 for O-1–O-10 (40 checks); stub DOM now records listeners and supports fixture faults (empty / 500 / signed-out / offline).
**`App/Ops/tests/ops-console.test.mjs`** — one changed expectation (see §4).
**`App/Ops/tests/preview/console-preview.html`, `fixtures.js`** — new test-only harness (§1.9).

## 2 Tests

| # | Result | How |
|---|---|---|
| O-1 | PASS | Bar = health, cases, dq, drift with labels; Cases `aria-selected="true"`/`tabindex="0"`, three `-1`. |
| O-2 | PASS | Four `#ops-tab-*` tabpanels; none for events/sprint/release; only Cases visible. |
| O-3 | PASS | Opening every tab never requests sprint-board, release-ledger, events or drift; Drift & Budget = budget-risk, openfigi-status, cf/d1-today, cf/invocations ×3 (holdings, entities-seed, entities-enrich); all GET to meridian-ops / meridian-proxy; removed code paths absent from source. |
| O-4 | PASS | Through the bar's own keydown listener: ArrowRight on Drift → Health, ArrowLeft on Health → Drift, ArrowRight Cases → DQ, Home → Health, End → Drift; selection, tabindex and visible panel follow; other keys ignored. |
| O-5 | PASS | One ops-health read and one 600,000 ms poll on Health only; poll stops on leaving; no CHECK_DASHBOARD, Worker Status, OPS_WORKERS; both pointer lines shown; enrichment wording kept. |
| O-6 | PASS | `ops-console.test.mjs` 58/58 (run inside ops-a as well). |
| O-7 | PASS | 0 hex, 0 rgba outside the block; `OPS_COLORS` absent; `style=` 1 ≤ 30 and dynamic only; no colour via `element.style`/`cssText`; ≤640px rules present; every table in a wrapper. |
| O-8 | PASS | Exact texts: Cases empty (open filter / other filter), DQ empty, Cases 500 / signed-out / offline alert rows, Health HTTP 500 and network error + "Try again", every Drift panel failing alone, a partial Drift failure, Loading + `aria-busy` true → false, selected row `aria-current` set and cleared. |
| O-9 | PASS | All 30 `--tokens` in `ops-theme` equal `App/index.html :root`. |
| O-10 | PASS | `<script>` title escaped in list and drawer; `<img onerror>` summary inert; drawer styled by class. |
| O-11 | not run | Post-release read-only check; belongs to REL.GO (no live requests in this packet). |

Existing suites (all run at bc1d079 first, then at 4ad4ca3):

| Suite | Before | After |
|---|---|---|
| ops-a.test.mjs | 12/13 (docs mirror check failed: docs/index.html ≠ App) | 40/40 |
| ops-console.test.mjs | 58/58 | 58/58 |
| console-shell 12, cases-contract 66, dq-contract 68, dq-page 19, dq-seeds 32, health-check 18, heartbeats-contract 34, lateness 42, admin-jobs-lateness 13, migration-m1 29, schedules-contract 24, sweep-contract 27, sweep-ext-contract 34, invocations-subrequests 4, boost-heartbeat-resilience 207, control-split 100/100 | all pass | all pass, unchanged |
| ingest-contract.mjs | needs OPS_INGEST_* env (live) — not run | not run (same) |
| ETF Refresh/tests/ops-health.test.mjs | 26/26 | 26/26 |

## 3 Harness observations (headless Chrome on the file:// harness; screenshots in the session scratchpad `shots/`)

375px shots were taken in a 375px iframe, because headless Chrome on macOS will not make a window narrower than about 500px. No sideways page scroll at any width: measured `documentElement.scrollWidth` = viewport and panel `scrollWidth` = `clientWidth` for all four tabs at 1280, 800 and 375. At 375 the tab bar is 418px wide inside 360–375px and scrolls on its own; the active tab is scrolled into view.

| Tab | 1280 | 800 | 375 |
|---|---|---|---|
| System Health | Pipeline card; Writes gauge + reads pointer beside Coverage trio; Enrichment "removed" text; Bootstrap; sweep pointer; footer with Refresh Now | Same, two-column grid | Cards stack; gauge above the reads pointer; coverage trio stacks one per row |
| Cases | Chips (Open ✓, Acknowledged ✓ in accent), sev badges red/amber/blue, Overdue in red, `<script>` title shown as text | Table fits (760px min) with word-boundary wrapping | Table scrolls inside its wrapper; refs on one line; chips wrap; Refresh beside the title |
| DQ Tickets | Two tickets; "Protected decision" in amber; drawer shows members table, Problem kv, History; open row `--bg4` + blue left edge | Drawer 720px over the list | Drawer full width, actions wrap onto two rows, members table scrolls in its wrapper |
| Drift & Budget | Budget gauge, "Cloudflare usage today" with reworded line, invocations (mismatch in red, cron-only ✓ in green), resolution stats; `?fail=drift` shows every exact error line, each in its own panel | Same | Cards stack; gauge above number; long lines wrap |

States seen: loading (`?delay=4000`), empty (`?empty=cases`, "No open cases. The last sweep raised nothing new."), signed-out (alert row "Your sign-in has expired…"), Health HTTP 500 card with "Try again" at 375. Focus: keyboard-style focus on a chip and a tab shows the 2px `--blue` ring (`focus-800.png`).

O-V: compared with `App/index.html` rendered offline at 1280 (network blocked, `main-product-1280.png`): same `--bg`/`--bg2` surfaces, 42px title bar with the same logo and name colouring, uppercase 11px card headers with bottom rule, `.dt`-style table headers on `--bg3`, `.btn`/`.btn.on` buttons and chips, 2px radius. Text renders in the system UI font where Inter is not installed (UD-5), as the main product does offline.

## 4 Deviations

1. **`ops-console.test.mjs` AC-13 changed.** The old check rendered Sprint Board and Release Ledger and looked for the read-only footnote. Those views are removed by OPS-01, so the check now asserts the six loaders/renderers are undefined, no events/sprint/release panels exist, and the footnote is gone. All other checks in that file are unchanged and pass.
2. **`ops-a.test.mjs` docs-mirror check turned into an INFO line.** At bc1d079 it already failed (docs/index.html ≠ App/index.html: docs/ is the October release, App/ holds November work). After this build ma-ops.js also differs by design until REL.GO regenerates docs/. It now prints `INFO docs/ mirror (refreshed at REL.GO)` and adds checks that the harness never reaches docs/ instead.
3. **Cases empty text — reading of "Open only".** "No open cases. The last sweep raised nothing new." shows while every selected status is an open status (`open` and/or `acknowledged`, i.e. the default filter); any filter with resolved/dismissed shows "No cases with these statuses." The literal reading (`open` alone) would show the neutral line on the default view. One-line change in `opsc_emptyText` if the reviewer prefers the literal reading.
4. **Title-bar acting-role text** is "Acting as {role}" (the spec gives the element, not the words). Shown only when a valid role is stored; it updates when the drawer's "Acting as" select changes.
5. **Cases/DQ error rendering.** An error with no rows shows the alert inside the table instead of the empty line (previously both showed). With rows already listed (Load more failing), the alert sits above the table.
6. **Focus ring offset** is `-2px` (inset) on tabs and focusable table rows, so it is not clipped by their scrolling containers; elsewhere it is the EXP rule (`2px solid var(--blue)`, offset 1px).
7. **Harness `?tab=` switch** added beyond §1.9's `?fail=` so each tab can be screenshotted without clicks; also `?empty=`, `?delay=`, and a small fixture switcher bar in the corner (harness only).

## 5 Founder UAT checklist (harness)

Open it with one Terminal line (no server needed):

```bash
open "/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App/Ops/tests/preview/console-preview.html"
```

1. It opens on **Cases**. Exactly four tabs: System Health · Cases · DQ Tickets · Drift & Budget. No Events, Sprint Board or Release Ledger.
2. It looks like the main product: dark navy, blue accent, small uppercase headers, square buttons.
3. Click a case → a drawer opens; that row is highlighted. Press **Escape** → it closes and focus returns to the row. Try **Acknowledge** with a note: "Saved." appears and the status changes.
4. **DQ Tickets**: the BlackRock ticket shows "Protected decision". Open DQ-000101 → three members are listed.
5. **System Health**: no Worker Status table, no CHECK_DASHBOARD. The two pointer lines are there.
6. **Drift & Budget**: no Deployment Drift panel. The second card is "Cloudflare usage today".
7. Press **Tab** to a tab, then the arrow keys: the selection moves and wraps; a blue focus ring is visible.
8. Corner links: **empty**, **errors**, **signed out**, **offline** — each shows a clear message, never a blank page.
9. Narrow the window to phone width (or use the browser's device toolbar at 375px): the tab row scrolls sideways, the page itself does not, and the tables scroll inside their own boxes.

The real console keeps showing the old view until the November release (REL.GO); this harness is the only place to see the new one before then.

## 6 Boundaries kept

- Wrote only `App/ma-ops.js`, `App/Ops/tests/ops-a.test.mjs`, `App/Ops/tests/ops-console.test.mjs`, `App/Ops/tests/preview/` (2 new files) and this report. One commit with explicit paths; the Main Lane's uncommitted files in the tree were left out.
- No change to any Ops route, Worker, table, row or history (OPS-05); `App/Ops/src/` untouched; no Worker deploy, no CSP change, no D1, no secrets, no `.env*`.
- `index.html`, other `ma-*.js`, `docs/`, `generate-docs.mjs` untouched; nothing released.
- No request to any live Ops endpoint: node tests use stubs or the in-memory Worker; the harness replaces `fetch` with fixtures. The one main-product screenshot ran with all network blocked.
- No installs, CDNs or new fonts; no subagents; `13F Seed/gleif-seed.js` untouched; no Status/board/Tower/transitions/log writes.
- **Carry-over 13 (D1 sprintboard/releaseledger sync check): not needed: frozen legacy, no competing writer; the Tower is the only delivery view.** Nothing was synced.
- UD-3 unchanged: the public Ops GET routes stay public in November; removing the tabs neither opens nor closes any of them.
