# MA-NOV-UI.SPEC — Ops cleanup + Homepage spec, with the November release plan — Report

```text
PACKET:   MA-NOV-UI.SPEC · Control v1 f41faa34…8088 · Task v1 b5d62794…ce05 (both verified)
RUN:      r-20261121T083832Z-a215 (interactive; LANE_OPENER_v2 67913343…71d6 verified)
ROLE:     UX Lead + Operations Lead + Architect (specification only)
PINS:     scope c16c8e19…5a03 · SA1 419e4337…3aea · EXP spec 785df4d5…e3e (all verified)
OUTPUT:   claude/specs/MA-NOV-UI_Spec.md · sha256 4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd · 450 lines
OUTCOME:  SPEC COMPLETE. Stops for Founder spec approval. Work units fit Sat 21 – Fri 27 (6.0 worker-days), with a cut order.
```

## 1 Summary and decisions

- **OPS.** The console keeps System Health, Cases, DQ Tickets and Drift & Budget. Events, Sprint Board and Release Ledger go from the front end only; every route, table and row stays (OPS-05). Styling moves to the main product's tokens through one injected `ops-theme` style block. This works under the console's existing CSP, so no Worker deploy is needed. States, focus and 375px behaviour are specified per tab.
- **Key fact:** the console loads `ma-ops.js` from the live Pages site, so Ops changes go live only at the Pages release. The build therefore adds a fixture-driven preview harness. The real console is checked straight after the release.
- **HOME.** A new entrance block sits above the market banner. It holds the proposition, an Exposure card (with an example link) and a Company research card with inline search to `#/entity/{id}`. Every market and news card stays. The spec gives the exact copy.
- **Phone width (carry-over 12):** this is a real defect. At 375px the page is 1,249px wide and the Exposure tile is off-screen. The fix is CSS only.
- **No false live-data claims (HOME-06):** the "LIVE" pill becomes "DELAYED".
- **Polish.** The spec gives exact new wording for the Gaps panel ("What we couldn't analyse"), the stale/partial chips, "Low (name match)" and the overlap note. `.exp-dim` changes to `--muted`: 5.24:1 against 3.80–3.95:1 today.
- **Release.** Pages moves from `October-2026` to `November-2026` `/docs` on Fri 27, with Sat 28 as a buffer. Rollback is one Settings switch back to `October-2026`, which also reverts the console.

**Decisions for the Founder** (spec §7; each has a recommendation):
1. UD-1: approve the exact copy as written. This counts as the wording approval for the builds.
2. UD-2: drop the "Deployment Drift" panel. It reads the frozen `releaseledger`. Recommendation: yes.
3. UD-3: the public Ops GET routes stay public in November; a December Access packet guards them. Recommendation: yes.
4. UD-4: remove the wrong static "Worker Status" table and the `CHECK_DASHBOARD` placeholder from Health. Recommendation: yes.
5. UD-5: the console uses the system font where Inter is not installed. The alternative is a `meridian-ops` CSP deploy. Recommendation: accept the fallback.
6. UD-6: "LIVE" becomes "DELAYED" and "Live ETF view" becomes "Sector ETFs". Recommendation: yes.
7. UD-7: example portfolio IVV 60 / EEM 25 / TSMC 15. It shows the "older data" chip. Recommendation: use it.
8. UD-8: the entrance block goes above the banner. Recommendation: yes.
9. UD-9: release window Fri 27 after 06:00Z, with Sat 28 as a buffer. Recommendation: yes.

## 2 Evidence

**Files read** (at `bc1d079`, November-2026 = origin):
- **Ops front end:**
  - `App/ma-ops.js`: tabs `:464-472`, switch `:529-552`, removed views `:564-702`, Drift `:712-820`, Health `:189-403`, `OPS_COLORS` `:29-39`, stale `OPS_WORKERS` `:42-47`, console section `:839-1542`.
  - `App/ma-data.js:165-260`.
- **Ops Workers:**
  - `App/Ops/src/console-page.js`: assets come from Pages (`:17,41-42`); CSP (`:26-28`).
  - `App/Ops/src/ops-api.js`: 302s and public GETs (`:1008-1053`), 15/15 route ceiling (`:10-12`).
  - `App/Ops/src/control-api.js`: public GETs (`:473-476`), drift reads `releaseledger` (`:305-313`).
- **Ops tests:** `App/Ops/tests/ops-a.test.mjs` (asserts seven tabs, `:82-108`) and `ops-console.test.mjs:418-443`. Both need updating in the build.
- **Homepage:** `App/index.html`:
  - tokens `:10-37`;
  - header `:1176-1210` ("LIVE" `:1197`, Exposure `:1205`);
  - only two `@media` blocks, both DCF (`:863,875`);
  - router `:1102-1170`;
  - market/news `:1215-1410`.
- **Search and EXP code:**
  - `App/ma-search.js`: ticker search only, no Corporate Atlas route.
  - `App/ma-entities.js` EXP section: Gaps `:3486-3502`, header chips `:3304-3330`, panel `:3334-3400`, `.exp-dim` `:2916`, `_navParseFrom` `:1691-1703`.
  - `App/Corporate Atlas/tests/exp-ui.test.mjs:360-444`: verbatim label checks the polish must update.
- **Release:** `generate-docs.mjs` (11-file list); `docs/` versus `App/` versus `origin/October-2026:docs/` (only `index.html` and `ma-entities.js` differ today); `docs/.nojekyll` present.
- **Records:** scope doc, SA1, EXP spec, `MA-NOV-CARRY/OPS/HOME_Status.json` (read only), `claude/November_Decisions_Log.md` (NML-1110-6, -1113-9, -1118-3, -1119-1…4, -1120-3, -1121-1/2).

**Preview:** a local static preview of `App/` (`corporate-atlas-static`; `serve` was already cached, nothing installed), run against the live read-only APIs. Screenshots are in the scratchpad (not in the repo):

| File | sha256 | Shows |
|---|---|---|
| `…/scratchpad/ui-spec-01-home-800px.jpg` | `d4b6101e…a998` | header tiles past the edge at 800px |
| `…/scratchpad/ui-spec-02-home-375px.jpg` | `1b6d4211…3bd5` | 375px: page 1,249px wide, search 40px, left column collapsed |
| `…/scratchpad/ui-spec-03-exposure-empty.jpg` | `6ae32f48…7f24` | `#/exposure` layer with "← Back to Home" |
| `…/scratchpad/ui-spec-04-exposure-EEM85-TSMC15.jpg` | `c22daaec…7f24`* | example result: 100%, TSMC 26.17%, stale chip |

\*Full hash `c22daaec1fc3baa05bbadcc6786c130bda2d8e40b43943428c51311224877f24`. Scratchpad folder: `/private/tmp/claude-501/-Users-navinkumar--claude-spares-spare-aOJMbq/88ddda87-6dd5-4b6d-8ee8-3148d670f987/scratchpad/`.

**Measured in the preview at 375px:** `scrollWidth` 1249; `#expBtn` right edge at 1048; `#opsBtn` at 1098; `#sw` 40px wide.

**Look-throughs (R-EXP1):** 3 distinct ETFs (EEM, IVV, EFA), within the limit of 5. Results:
- EEM 85 + TSMC 15: TSMC 26.17% (15.00 direct + 11.17 via EEM), Adds up to 100%, EEM Feb 2026 stale.
- IVV 50 + EFA 50: 99.40% companies identified, months Mar and Apr 2026, both stale against the newest stored month (Aug 2026).

Requests could not be counted from the network log because the buffer had rolled over. One `navigate` to a hash inside the open layer did not re-render the inputs until a reload, so it most likely did not fetch. The upper bound is still ≤ 5.

**Computed contrast** (WCAG formula, token values from `index.html`):
- `--dim`: 3.95:1 on `--bg2` and 3.80:1 on `--bg3` (light); 3.58:1 (dark).
- `--muted`: 5.24, 5.04 and 4.81:1 on the same backgrounds.
- `--text2`: 7.02:1 or better.

## 3 Deviations and gaps

1. **The live Ops console was not seen.** It needs the Founder's Access sign-in, and it loads code from Pages. Ops evidence comes from code and tests; the spec adds a preview harness (§1.9) and a post-release console check (§4.4).
2. **The browser pane first refused `localhost:8792`.** The `serve` process was listening on port 53115, not the port the preview reported, so the preview was run on 53115. No other effect.
3. **H-4's search query for TSMC is not verified.** No `/api/entities/search` call was made. The build records the query that finds entity 2191.
4. **The example portfolio is not fresh.** No equity ETF checked has holdings within 3 months of Aug 2026, so the example shows the stale ("older data") chip. This is recorded as UD-7. It is a data fact, not a design workaround.
5. **The `/write-spec` skill was not used.** The Task prescribed the spec structure, so the spec follows the Task's seven sections directly.
6. **The test location for the homepage is a compromise.** The new node test sits in `App/Corporate Atlas/tests/` because `App/` has no general tests folder, and creating one would be a folder change that needs a CR.
7. **Possible bug, outside this packet's scope:** a `#/exposure` → `#/exposure?i=…` hash change while the layer is open did not render the inputs until a reload. Seen once in the preview and not confirmed. Suggested for CARRY or for UI.HOME.REVIEW to check (HOME-04 navigation).
8. **No stop gate was hit.** OPS-05 is met without deleting anything. No HOME item needs a data programme; continuation, recently viewed and what-changed stay out.

## 4 Boundaries kept

- **Files written:** `claude/specs/MA-NOV-UI_Spec.md` and this report. Screenshots went to the session scratchpad only.
- **Not done:**
  - no code edits; no `docs/` regeneration;
  - no git writes (read-only `git --no-optional-locks` show, log and diff only);
  - no deploys, D1 statements or Ops writes; no Pages settings changed;
  - no installs; no subagents.
- **Not touched:**
  - Status, board, Tower, `transitions.jsonl`, factory and Main Lane files;
  - `13F Seed/gleif-seed.js`;
  - `.env*` files.
- **Network:** live calls were read-only GETs made by the preview page itself (market data, etf-list, entity names, 3 look-throughs). The preview server was stopped, and the viewport was reset to desktop.
