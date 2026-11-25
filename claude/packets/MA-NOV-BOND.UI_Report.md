# MA-NOV-BOND.UI — Report

```text
PACKET:   MA-NOV-BOND.UI · Control v2 (78403176…cd08e ✓) · Task v2 (0c5f9d04…f28f ✓)
RUN:      r-20261125T213631Z-425a · interactive · LANE_OPENER_v2 (67913343…71d6 ✓)
ROLE:     Engineering Lead + UX Lead (Entities domain)
BASE:     f442c51 (HEAD = origin/November-2026 at start; ls-remote checked)
PINS:     spec v1 b30a75ce…2e53 ✓ · spec v2 c4281815…aef ✓ · CR 3885c999…b5b ✓ · FIX3 report 25ec8914…0ff1 ✓
          base blobs: entities-api.js 47f40c89…14f3 ✓ · ma-entities.js 0087575c…f9767e ✓
          BOND.APPLY: state CLOSED, report 54df631f…c634 = main_lane_verification.report_sha256 ✓
OUTCOME:  DONE — API + screen built and tested; local preview of all four scenarios at 1280 and 375 px; D-CR3 measured.
          Nothing deployed. No remote D1 write. Remote D1: the 3 allowed reads only (175 + 943 + 34 rows read, 0 written).
FILES:    App/Corporate Atlas/src/entities-api.js (blob 469d7687…cb00) · App/ma-entities.js (blob 7c267956…09d7)
          App/Corporate Atlas/tests/bond-ui.test.mjs (new, blob 0e5c40ee…b560) · this report
```

## 1 Changes

### API — `meridian-entities-api`, FI routes only (`src/entities-api.js`)

| Route | Change |
|---|---|
| **F1** `GET /api/fi/issuers/:id/bonds` · **F1b** `GET /api/fi/ciks/:cik/bonds` | New optional `documents` object when the request has `documents=1` and no cursor: `{ filings, shown, drafts_replaced, drafts_open, could_not_read, not_covered, unknown_reason }`. One statement: `GROUP BY accession_number, filing_status, status_reason` over the issuer's CIKs (bound parameters); `shown` counts served finals (confidence ≥ 60); the other classes count filings. Every bond row (F1, F1b, F2) gains `missing: ['cusip_isin' \| 'coupon' \| 'spread']` (v1 §1.3 "partial", derived, no column). Without `documents=1` the body and the statement count are exactly as 009 (deviation 1). |
| **F2** `GET /api/fi/bonds/:acc/:seq` | `bond` gains `status_reason`, `superseded_by`, `status_note` (CR1). New `offering: { available, document, facts, parties, states, withheld }` (spec v2 §10). One D1 batch with **one PK-range read per CR2 table**: facts `WHERE accession_number = ? AND tranche_seq IN (0, ?)`, parties `WHERE accession_number = ? AND tranche_seq IN (0, ?)`. A tranche value wins over the offering value of the same field. `parties.<role>` rows become `states[role]`. `char_offset` is not served. `document` ('prospectus supplement' / 'pricing supplement' / null) comes from the v2 §4.3 family states, then from page markers. |
| **F5** `GET /api/fi/ciks/:cik/documents?cursor=` (new) | Non-final documents of one CIK, newest first, 25 per page, keyset cursor `[filing_date, accession]` (validated; bad → 400). One row per filing: date, form, status, `status_reason`, `status_note`, SEC URL, and for a superseded draft `superseded_by: { accession_number, filing_date, source_url, first_seq }` (one PK-prefix read for the ≤ 25 finals named). Same gate and link rules as F1b: closed gate → `documents: []`, no names; unknown CIK → `has_bond_link: false`. Finals are never listed. |

- **Withheld fields:** `import { WITHHELD_FIELDS } from '../bonds/bonds-offering.mjs'` — the one list. A `'row'` field (`use_of_proceeds`, `proceeds_total`) is dropped even if a row exists; a `'value_text'` field (`selling_restrictions`) keeps its row (section link + heading + page) with `value_text = null`. F2 returns the list as `offering.withheld`, so the screen holds no copy. The bundle tree-shakes the rest of the extractor: dry-run bundle 81.19 KiB (gzip 21.53 KiB); the list is in it.
- **Missing tables / columns:** missing CR2 tables → `offering.available = false`, no facts (the screen shows "Not read yet"; v2 §7 rollback rule). Missing CR1 columns ("no reader depends on them", CR1 rollback) → each FI query that names them has an explicit 008-schema form with NULLs, used only on "no such column" (`fiAllCr1`). Both tested.
- New helpers: `fiMissing`, `fiDocCounts`, `fiDocuments`, `fiWantsDocuments`, `fiAllCr1`, `fiOffering`, `fiDocCursor`, `handleFiCikDocuments`. Router: `/api/fi/ciks/:cik/(bonds|documents)`.

### Screen — `ma-entities.js`, FI block only

| Where | What |
|---|---|
| Issuer Bonds section (and the unlinked-filer layer `#/fi/cik/…`) | First page asks for `documents=1`. Footer, v1 §5 wording: **"From 30 SEC filings: 13 bonds shown · 8 draft documents · 14 not covered — show list"** (zero classes left out; singular forms). "show list" is a `<button>` with `aria-expanded`; it loads F5 for each CIK (grouped "Filed by …" when several), each row "date · form · plain reason · View filing on SEC.gov ↗", "Show 25 more ↓" per CIK. Reasons: the v1 §5 table verbatim; a superseded draft links "the final terms filed {date}". Drafts are only ever in this list, never in the bond table. |
| Bond rows | Each row gains an **"Offering details"** link (`#/bond/{acc}/{seq}`; keyboard-safe). A partial bond gains **"Some details not found in the filing"**. |
| Bond page | Partial: **"Not found in the filing: CUSIP/ISIN, coupon"**. Then **Offering details** (groups The deal · This bond · Money and fees · To read in the filing) and **Who's involved** (Who issued and protects the bonds · Banks that sold the bonds), labels exactly as spec v2 §10 / §3 / §4.1, footer v2 §8 verbatim. Every value has "Source: Prospectus supplement — Optional Redemption, page S-21 ↗" (opens `source_url#anchor`; only `https://www.sec.gov/` URLs become links). Three not-shown states, same words everywhere: "Not stated in the filing" · "Not applicable" · "Not read yet". Show-where-found fields are left out when absent. Withheld: "What the money is for" → "Not read yet"; "Where the notes may not be sold" → section link + heading + page only; no whole-deal proceeds. Banks: name, printed role in small text, "· for the 2054 notes" on tranche-specific parties. |
| Styles | Existing variables only; new classes `fi-docs`, `fi-doc`, `fi-part`, `fi-od`, `fi-panel`, `fi-h`, `fi-grp`, `fi-kv`, `fi-k`, `fi-v`, `fi-src`. Under 640 px the label/value grid stacks to one column; long values wrap. |

New UI functions: `_fiSecUrl`, `_fiSrcHref`, `_fiHeadingText`, `_fiSrcText`, `_fiSrcHtml`, `_fiReasonHtml`, `_fiDocsCountsHtml`, `_fiDocsInner`, `_fiDocsOwner`, `_fiDocsRedraw`, `_fiDocsFetch`, `_fiDocsToggle`, `_fiDocsMore`, `_fiDocsBlockHtml`, `_fiShortMoney`, `_fiJson`, `_fiMonthDay`, `_fiAnd`, `_FI_FMT`, `_fiKvHtml`, `_fiFactRow`, `_fiSectionRow`, `_fiOfferingModel`, `_fiOfferingHtml`, `_fiPartyRoleText`, `_fiPartyGroupRow`, `_fiWhoHtml`. Changed: `_fiStyleOnce`, `_fiTableHtml`, `_fiBondsLoadPage`, `_fiBondsRender`, `_navRenderBond`, `_fiCikLoadPage`.

## 2 Tests

New: `tests/bond-ui.test.mjs` — **120/120**. Real Worker over node:sqlite fixtures (008 + 009 gate + CR1 + CR2; plus no-CR2 and pre-CR1 fixtures) and the real `ma-entities.js` in a vm. Covers: F1 without `documents` unchanged (≤ 4 statements), `documents=1` counts, cursor page has none, F1b; `missing`; F2 status fields, withheld rows dropped, place list nulled, `withheld` = `WITHHELD_FIELDS`, tranche-over-offering, per-tranche price, parties of tranche 0 + this tranche, one PK-range read per CR2 table, drafts 404; F5 order, superseded link, 25 + 5 paging, bad cursor/CIK, unknown CIK, closed gate; CR2 missing; CR1 missing (F1, F2, F5). Screen: footer and every reason verbatim, superseded link, non-SEC URL never a link, issuer footer/button/aria, row link + partial line, show list via F5, all v2 §10 headings and labels, values, the three states, show-where-found omitted, withheld handling, source wording and anchors, escaping (`<img onerror>` party name), tranche-specific banks, v2 §8 footer, partial bond line, column fallback, CR2 missing, 640 px rule, banned words ("real-time", "realtime", "live data", "complete", "all holders", "current ownership") absent from the new block.

Existing suites, all passing after the change (24): fi-009-worker 133/133 · fi-010-frontend 71/71 · fi-009-explain 14/14 plans · nav-007-worker 58/58 · nav-007-frontend 39/39 · nav-007-key 34/34 · merge-013 106/106 · exp-ui 270 · exp-compute 160 · home-entry 177 · exp-route · exp-backfill · exp-backfill-wiring · entity-pipeline-state · firds-wrangler-cause · gleif-reconcile-011 · bonds-parse · bonds-ingest · bonds-filer-scan · bonds-fix1/2/3 · bonds-offer1/2 (node:test, all exit 0).

## 3 Local preview

**Local D1.** Remote reads (exactly 3, read-only): `sqlite_master` for the 4 bond tables (175 rows read) · `SELECT * FROM bond_issuance` (943) · `SELECT * FROM bond_issuer_link` (34); 0 rows written. The live schema already has CR1 + CR2 (APPLY), but the read budget does not cover the CR2 tables, so locally only: `migrations/ma-nov-bond-cr2.sql` (3a2050cd…6e6b) → `bonds/apply/offer-apply-run1.sql` (fad02a73…8f71, 432 statements) → `offer-apply-run2.sql` (8e189ea5…3294, 317). CR1 and FIX2 were **not** applied locally (already in the live rows read). Result **943 rows · 11,576 facts · 3,994 parties**, equal to the APPLY report. Local-only additions for the screen: `fi_serving_gate` (009) set open, a minimal `entity_master` with one stand-in row per linked `entity_id` (name from `bond_issuer_link.issuer_name`), and empty entity tables (scratchpad `local-init.sql` 2a8f8029…b695, `local-entity-patch.sql` d094918d…35fe, builder `build-local-init.mjs` 7cf1d8da…1e1a). Worker: `npx wrangler dev --local -c "App/Corporate Atlas/wrangler-entities-api.toml" --persist-to <scratchpad>/d1 --port 8787`. Front end: a scratchpad copy of the 11 `App/` files, identical except the Worker base URLs (entities → `127.0.0.1:8787`, every other Worker → a closed local port), served on `127.0.0.1:8792`.

Screenshots (scratchpad `shots/`): `0-bond-abbvie-2054-first-render.jpg` (dee30ec3…c30a) · `1-issuer-dominion-docs-list-1280.jpg` (789ee2d1…21ca) · `2-bond-abbvie-2054-offering-375.jpg` (18c065ad…bdd3) · `3-bond-abbvie-2054-whos-involved-1280.jpg` (461c73c0…37ae1).

| Scenario | Observed |
|---|---|
| **Issuer with each class** — Dominion Energy (entity 1858, CIK 0000715957), 1280 px | Footer "From 30 SEC filings: 13 bonds shown · 8 draft documents · 14 not covered — show list". Live data has **0 `parse_failed`** rows, so no issuer has the "couldn't read" class; it is covered by the fixture tests. Enter on the focused "show list" opened 22 rows (8 "Draft offering document — replaced by the final terms filed {date}" with links, 9 "Demand notes (not bonds) — not covered", 4 "Shares, units or preferred stock — not covered", 1 "Share purchase plan — not covered"), `aria-expanded` true, focus kept on the toggle, label "hide list". 13 rows, each with "Offering details"; 7 show "Some details not found in the filing". |
| **Multi-tranche deal, per-tranche price and early repayment** — AbbVie `0001104659-24-027205` (7 tranches) | Tranche 6 (5.400% 2054): Price to investors 99.657%, Early repayment "Yes, from 15 Sept 2053 at par; before that at the greater of par and a make-whole amount", Bank fee 0.875%, Proceeds 98.782%. Tranche 1 (4.800% 2027): 99.859%, "Yes, from 15 Feb 2027 at par; …", fee 0.250%, proceeds 99.609%. Sources e.g. "Prospectus supplement — Optional Redemption, page S-21 ↗", "Term sheet — 'Trade Date' ↗". Risks "Risk Factors, page S-13 ↗"; Where the notes may not be sold "Selling Restrictions, page S-43 ↗" (no places); What the money is for "Not read yet". |
| **Pricing supplement, trustee "Not stated in the filing"** — Verizon `0001193125-24-131776/1` (retail) | Trustee "Not stated in the filing"; Lead banks / Other managing banks / Underwriters "Not applicable"; How interest is counted "Not stated in the filing"; Risks and Where the notes may not be sold "Not stated in the filing"; Repayment on the holder's death "Yes" (show-where-found, present); sources "Pricing supplement — 'Selling Price' ↗" etc. |
| **Who's involved with roles** — AbbVie tranche 6 | Trustee U.S. Bank Trust Company, National Association (Description of the notes, page S-11). Lead banks: Morgan Stanley, J.P. Morgan, BofA Securities, Citigroup "Joint Book-Running Managers"; Barclays, BNP PARIBAS "Joint Book-Running Managers · for the 2054 notes". Other managing banks: 15 names, 5 "· for the 2054 notes". Underwriters / Selling agents "Not applicable". Footer present. |
| **375 px** | Bond page: one column (`.fi-kv` 296 px), document width 375 = viewport, no element of the panels past the right edge. Issuer section: no page-level sideways scroll (only the existing maturity ladder scrolls inside its own strip). |
| Console | No script errors; only the expected refusals of the closed port used for the other Workers. |

## 4 D-CR3 — issuer counts query (local copy of the live rows, SQLite `.scanstats`)

Local D1 does not report `rows_read`, so the plan and rows visited per step come from SQLite's scan status on a copy of the same database (`dcr3.txt`, 4e380988…a95).

| Query | Without index | With `idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason)` |
|---|---|---|
| F1 counts, Toyota MC (125 rows) | `SCAN bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1` — **943** rows + temp B-tree GROUP BY | `SEARCH … USING INDEX idx_bi_cik_status (cik=?)` — **125** |
| F1 counts, Dominion (35 rows) | SCAN — **943** | SEARCH — **35** |
| F1 counts, Wells Fargo (60 rows) | SCAN — **943** | SEARCH — **60** |
| F5 list, Dominion | SCAN — **943** (+ GROUP BY / ORDER BY temp B-trees, 22) | SEARCH — **35** |
| F2 offering facts (AbbVie t6) | `SEARCH bond_offering_fact USING PRIMARY KEY (accession_number=? AND tranche_seq=?)` — 25 | — |
| F2 offering parties (AbbVie t6) | `SEARCH bond_offering_party USING PRIMARY KEY (accession_number=?)` — 64 visited, 22 returned | — |

**Recommendation (no DDL here):** add `idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason)` in its own Change Request before or with go-live. Without it every issuer page view with `documents=1` and every F5 page reads the whole table (943 rows today, growing with every ingest run); with it, the issuer's own rows (35–125 today). Cost: one index build (≈ 943 row-writes) and one extra index write per future `bond_issuance` insert/update of those columns. The 009 partial index `idx_bi_cik_final_key` cannot serve these queries because they need non-final rows. F2's extra reads (≈ 25 facts + ≤ 64 parties per bond view) need no index.

## 5 Deviations and decisions

1. **`documents` only with `?documents=1`.** Spec v1 §5 says F1/F1b "gain" the counts. The existing 009 suite (`fi-009-worker`, a stop-gate suite) pins F1 at ≤ 4 statements, every one on the `'final'` partial index. Returning counts unconditionally breaks it, so the counts are opt-in and the screen asks for them on the first page. 009's contract is unchanged for every other caller.
2. **F3 (coverage totals) and the `#/fi` directory counts are not built.** Spec v1 §5 mentions them, but Control v2's scope names F1, F2 and F5 only. Left for a later packet.
3. **CR1-absent fallback** (explicit 008-schema SQL per query) added so the existing fixtures and a CR1 rollback both keep working.
4. **"Couldn't read" class has no live rows** (0 `parse_failed` after FIX2), so the "issuer with each class" preview shows 3 of the 4 non-final classes; the fourth is covered by fixtures.
5. **Issuer page preview:** the full entity layer needs Corporate Atlas tables outside the 3-read budget, so it did not render locally. The real issuer Bonds section was mounted on the page with the same `_loadIssuerBonds()` the issuer layer calls, against the local Worker. Entity rows and empty entity tables in the local D1 are local stand-ins only.
6. **Preview hygiene:** on the very first load of the scratchpad copy, `index.html` still held its own live market-data proxy URL (`meridian-proxy`), so that page load made read-only market-quote requests to the live proxy. No bond, D1-write or Worker-deploy action was involved. All live Worker URLs in the copy were then pointed at a closed local port, and every later load made no live calls. The dev servers ran as background shell jobs (the Control's `wrangler dev` command and a scratchpad static server) because `.claude/launch.json` is outside the writable paths.
7. **Wording decisions within the spec:** `low_confidence` has no phrase in the v1 §5 table → "We couldn't read this filing's terms" without detail. Fields 17–19 (not in the v2 §10 table) are shown in "This bond" with their v2 §3 labels, only where found. Role `other` (calculation/paying agents) is shown under its own "Other" group (v2 §4.1 label), not among the banks that sold the bonds. A printed role equal to its group label ("Trustee") is not repeated. "Interest paid" omits the frequency when none is stored (nothing inferred). All-caps section headings are shown in sentence case; quoted labels from pricing terms and term sheets stay as printed.
8. **Fields 5–8** (amount, currency, interest, matures) fall back to the existing `bond_issuance` columns, sourced to the filing, when a filing or tranche has no offering row (v2 §3.2: "existing columns; no change"). Example: AbbVie tranche 6 has no stored `maturity` fact; the page shows 15 Mar 2054 from the bond row. 5 live finals have no offering rows at all; their other Required fields show "Not read yet".
9. **Proceeds:** the per-tranche % is shown; the whole-deal total is withheld; when no % is stored, the per-tranche amount is shown.

## 6 Release notes for the go-live packet

- **Order:** Worker first, then front end. The API change is additive. The old screen ignores the new fields. The new screen on the old API shows no footer (no `documents`), "Couldn't reach Corporate Atlas." in the list (no F5), and "Not read yet" in the panels (no `offering`), so either order is safe, but Worker-first avoids that window.
- **Prerequisite decision:** `idx_bi_cik_status` (§4), its own CR. Without it the footer costs ≈ 943 rows per issuer view.
- **Deploy (Worker):** from the repo root, `npx --prefix "App/Corporate Atlas" wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`. Capture the version id from the output (and `wrangler deployments list -c …`). Dry run here: 81.19 KiB upload / 21.53 KiB gzip. Rollback: `wrangler rollback <previous version id>`.
- **Front end:** release path per CLAUDE.md (`node generate-docs.mjs` → commit `docs/` → push the Pages branch). Hard-refresh: Pages caches for 10 minutes.
- **Live checks (read-only):**
  - `GET /api/fi/issuers/1858/bonds?documents=1` → `documents` = `{ filings: 30, shown: 13, drafts_replaced: 8, drafts_open: 0, could_not_read: 0, not_covered: 14, unknown_reason: 0 }`.
  - `GET /api/fi/issuers/1858/bonds` → no `documents` key.
  - `GET /api/fi/ciks/0000715957/documents` → 22 documents, `next_cursor` null.
  - `GET /api/fi/bonds/0001104659-24-027205/6` → `offering.facts` 25 rows, `offering.parties` 22, no `use_of_proceeds` / `proceeds_total`, `selling_restrictions.value_text` null, `issue_price_pct` 99.657.
  - `GET /api/fi/bonds/0001193125-24-131776/1` → `offering.states.trustee` = `not_disclosed`.
  - Screen: Dominion footer text, "show list", AbbVie and Verizon panels as §3, at 1280 and 375 px.

## 7 Boundaries kept

- Wrote only `App/Corporate Atlas/src/entities-api.js` (FI routes and the FI section's import), `App/ma-entities.js` (FI block), `App/Corporate Atlas/tests/bond-ui.test.mjs` (new) and this report. No `docs/`, no Status / board / Tower / transitions / logs, no `13F Seed/gleif-seed.js`, no installs, no subagents.
- No `wrangler deploy` (a `--dry-run` bundle only), no remote D1 write, remote D1 statements: the 3 allowed reads. All SQL application was `--local`, to a scratchpad persist directory.
- One commit, explicit paths; push to `November-2026`; `ls-remote` checked.
