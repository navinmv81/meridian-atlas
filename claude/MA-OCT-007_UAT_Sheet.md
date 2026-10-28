# MA-OCT-007 Phase 1 — Founder UAT sheet (Thu 22 Oct 2026)

**Build under test:** Worker `meridian-entities-api` version `73851c02` (live, commit `0dd7ef0`) + front end commit `3989ab1` (local, **not released**).
**Spec:** rev 1.4 `4d4fffef…397c`. **Prepared by:** REVIEW-007 (UX Lead + Data-Identity checks), MA-OCT-007.BR1, Wed 21 Oct.

**Before you start (build lane, LANE-1-ENG):** serve `App/` locally on `http://localhost:8791/` (the same `corporate-atlas-static` preview used for T7) and open it in Chrome on the Mac. Each step below starts by pasting a URL into the address bar. "Back" means the browser's own Back button unless a step says "← Back" (the in-app link at the top left of the overlay). About 25 minutes. Estimated D1 reads for the whole sheet ≈ 3–4k (entity 28088's two pages are the largest at ≈ 0.9k each), 0 writes.

**Not in this UAT (accepted limits):** ETF holding rows still call the Worker directly and don't use the new card (T8a, Phase 2). A link with `from=etf:…` goes Home on a cold load (Phase 2). A cold link from page *k* rebuilds page 1 only. The merge-redirect notice can't be tested live until MA-OCT-013 creates its table.

| # | Do this | Expected result | Pass / Fail |
|---|---|---|---|
| 1 | Open `http://localhost:8791/#/entity/28088`. Then click **Show 25 more ↓** at the bottom of "Linked instruments". | An issuer overlay with "← Back to Home". Header reads **"Linked instruments · 871"** with a small **"Sorted by identifier"** label; 25 rows, each with an asset-type badge, a source label and a band + score (e.g. "High · 100"). After the click: 50 rows, no row repeated. | ☐ Pass ☐ Fail |
| 2 | Scroll down to a row from the second 25 and click it. On the Instrument card, click **Open issuer →**. | Card shows the instrument name, a state badge, ISIN/CUSIP, "Source: … · confidence … (…)". The issuer opens on top. | ☐ Pass ☐ Fail |
| 3 | Press the browser **Back** once, then click **← Back** once. | First Back closes only the issuer and shows the card. Second Back closes only the card: you are on issuer 28088 with **all 50 rows still loaded** and at the **same scroll position**. | ☐ Pass ☐ Fail |
| 4 | Press the browser **Back** once more. | All overlays close and you are on the Meridian Atlas home screen. **You stay on the site** (address is `localhost:8791/` with no `#`). | ☐ Pass ☐ Fail |
| 5 | Open `http://localhost:8791/#/instrument/XS2199266698`. | Amber **"Low confidence"** badge and the line **"Name-based match (heuristic), score 75 — not verified by an identifier."** Below: "Source: Name match (heuristic) · confidence 75 (low)". **Open issuer →** goes to Bayer Aktiengesellschaft (#2730). | ☐ Pass ☐ Fail |
| 6 | Open `http://localhost:8791/#/entity/2730`. | "Linked instruments · 6", rows **grouped by asset type** with a header per group (e.g. DBT, EC), **no** "Sorted by identifier" label. The Bayer AG equity shows "ISIN · High · 100"; the XS… bonds show "Name match (heuristic) · Low · 75" (Low although 75 > 70 — expected, by source). | ☐ Pass ☐ Fail |
| 7 | Open `http://localhost:8791/#/instrument/US0321084339`. Pick either candidate's **Open issuer →**, then press **Back**. | Orange **"Ambiguous"** badge, **"Several issuers share this ISIN. Choose one."**, "2 candidate issuers — none is selected for you", both listed with LEI, "ESMA FIRDS" and "High · 100". Nothing is pre-selected. Back returns to the card. *Note: one candidate is TRADEWEB EU B.V., a trading venue. That is a known data issue (KI 22.17, routed to Data-Identity), not a navigation failure; pass the step if the state and copy are right.* | ☐ Pass ☐ Fail |
| 8 | Open `http://localhost:8791/#/instrument/US5949181045`. | Teal **"Matched"** badge, **"Issuer linked by ISIN, score 100."**, candidate **Microsoft Corp. (#1371)**, "ISIN · High · 100". | ☐ Pass ☐ Fail |
| 9 | Open `http://localhost:8791/#/entity/25782`. Type **bayer** in the search box. | **"This entity is no longer in Meridian Atlas. It may have been merged into another record."** with a search box; typing "bayer" lists live results (e.g. Bayer Aktiengesellschaft). No error. | ☐ Pass ☐ Fail |
| 10 | Open `http://localhost:8791/#/instrument/CUSIP%3A000000000`, then `http://localhost:8791/#/instrument/CUSIP%3A999999999`. | First: grey **"? No issuer"**, **"No unique identifier for this holding (for example cash or a derivative)."**, no candidates. Second: **"This instrument isn't in Meridian Atlas's instrument list yet."** No technical codes (like `no_mapping`) appear anywhere. | ☐ Pass ☐ Fail |
| 11 | Open `http://localhost:8791/#/entity/abc`. | A short toast **"That link isn't valid"**; no overlay opens; the `#…` part is cleared from the address. | ☐ Pass ☐ Fail |
| 12 | **Outage, then phone width.** (a) Turn Wi-Fi off, open `http://localhost:8791/#/instrument/US5949181045`; turn Wi-Fi on and click **↻ Retry**. (b) In Chrome DevTools, turn on the device toolbar at **375 px** wide and repeat steps 1 and 5. | (a) **"Couldn't reach Corporate Atlas."** with **↻ Retry** — never "No issuer". After Retry: the Matched card from step 8. (b) Issuer and card fit the screen: no sideways scrolling, long names cut with "…", badges wrap under the name. | ☐ Pass ☐ Fail |

**Pass = all 12 steps pass.** Note anything odd in the margin, even on a pass.

**UAT-day checks (build lane, before the session; ≤ 10 Worker calls):** re-run R1 for `XS2199266698`, `US0321084339`, `US5949181045`, `CUSIP:000000000`, `CUSIP:999999999` and `GET /api/entities/25782`, and confirm the results match the "Expected" column (013 merges can change ambiguous pairs). If `US0321084339` is no longer ambiguous, use `CA46431R1029` or `US9219378190` in step 7.

| Founder sign-off | Date | Result |
|---|---|---|
| | Thu 22 Oct 2026 | ☐ Accept for release ☐ Accept with fixes ☐ Reject |
