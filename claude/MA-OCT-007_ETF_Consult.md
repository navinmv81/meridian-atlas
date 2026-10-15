# MA-OCT-007 rev 1.3 — ETF Product Lead consult (§9, O6, R5)

```text
ISSUED BY:    Main Lane — MA-OCT-007.ETF Control v1 aa504925cd9a3bc309071406f92573434bbb3e99f3f32b6b711260c7fa57bf92
              Task v1 be985245480d2c4737269fb5d452dee3240cfec839113ad8d5baefefe1286323
EXECUTED BY:  REVIEW-A, ETF Product Lead hat, Sat 10 Oct 2026, doc-only
APPROVED BY:  Founder (12 Oct gate)
INPUTS:       claude/MA-OCT-007_Spec.md rev 1.3  332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e
              App/ma-etf.js   at 16918e0         4f47f9c2a16881ec5154b53a6ec8904584561be2e5e11af951fa01a54bea860a (= docs/ copy; = spec §0.1 line 37)
              App/index.html  at 16918e0         f92acfd91ed04d6abd6dd43e6b0a15bf78a51add028660c489e91822dc590a6b (= docs/ copy)
              (re-hashed on disk before reading; all match. No .git locks)
VERDICT:      Item 1 PASS WITH NOTES · Item 2 (O6) YES WITH CONDITIONS · Item 3 PASS WITH NOTES
              Required before the Phase 2 build: E7-1 to E7-3 (doc-only, rev 1.4). Nothing blocks the 12 Oct gate.
```

**Independence.** I did not write 007 or any of its revisions. **Scope:** §9, O6 (§15.2), and R5 (§7.2, §11.1), plus the parts of §0.2, §3.4, §11.3 and §12 those items cite. This is not a whole-document review. 0 D1 reads, 0 D1 writes, no git writes.

## Item 1 — §9 Screens touched: **PASS WITH NOTES**

| Check | Result | Evidence |
|---|---|---|
| ETF API contracts unchanged (metafc additive only) | ✔ | §9 (lines 501–510) lists no change to `meridian-proxy`, `meridian-holdings` or any ETF route. The only Worker touched is `meridian-entities-api` (Entities domain). The ETF list call `api/etf-list?meta=fc` (`ma-etf.js:838`) and the holdings and overlap fetches are untouched. |
| No ETF-domain table written | ✔ | "No writes from the front end in any phase" (line 510). §11.3 writes = 0. R1–R5 read only Entities tables plus `entity_merge_redirect`. The spec names no ETF table (`fund_holdings_monthly`, `etf_master`, snapshots) at all. |
| ETF screens reach `entities-api` only via `ma-data.js` / DOM events (ruling D) | ✔, and an improvement | Today `ma-etf.js:2997–3000` calls `meridian-entities-api` **directly**, which breaks ruling D. §9 line 506 replaces that with `ma:open-instrument`, and §3.4 (line 184) routes any future data need through `data_entitiesGet()`, the same pattern as `data_opsGet` at `ma-data.js:175`. |
| `index.html` ETF parts | ✔ | `index.html` has no hash routing today and loads `ma-etf.js` at line 1095. The inline router (§3.3) adds no `<script src>`. Nothing in the ETF shell changes. |

Notes (non-blocking):
- **N7E-1.** Phase 2 removes the direct `showEntityOverlay()` call (`ma-etf.js:3016`). The `closeEntityOverlay()` call on ETF switch (`ma-etf.js:1192`), a direct global into `ma-entities.js`, is not on §9's list. Either convert it in Phase 2 (for example, `ma-entities.js` closes its overlay on `ma:route` or a new close event), or record it as accepted legacy. It does not break a module import; it is a coupling to note.
- **N7E-2.** The ETF holdings view keeps no hash state. The router must not reset `#etfHoldingsContent` on `hashchange` while an instrument overlay opens over it. This is covered by §4.4 under the UX Lead's review, and is noted here only because the ETF screen is the one at risk.

## Item 2 — O6 consent to Phase 2 changes in `ma-etf.js`: **YES WITH CONDITIONS**

I consent to the four §9 changes (line 506): event instead of fetch; the icon on bond-branch rows (`CUSIP:` key); the `ma:instrument-state` restyle; and removal of the permanent grey-out. The conditions are:

1. **E7-1 to E7-3 below are in rev 1.4** before the Phase 2 build starts.
2. **The holdings table is otherwise unchanged:** same columns, row order, weights, filter, slice (Top 10/25/50/All) and the existing abort-on-ETF-switch behaviour (`entityIconAbortController`, `ma-etf.js:1190`).
3. **The icon degrades to clickable, never to disabled.** If R5 fails, times out or is aborted, the row keeps a neutral icon, and a click still fires `ma:open-instrument` so the card resolves the instrument on demand (R1). Only a resolved `unmatched` state may restyle the icon, and it stays clickable to show the "?" card (§5.3). This replaces today's `opacity 0.2; pointer-events none` failure path (`ma-etf.js:3019–3025`).
4. No ETF Worker, ETF route or ETF table change enters 007 by revision without a fresh ETF PL consult.

## Item 3 — R5 batch badging read budget: **PASS WITH NOTES**

**Per call: accepted.** R5 is capped at 50 keys (§11.2, line 584): typical ≈ 300–400 reads, worst ≤ 1,600 per execution (§7.2 line 405, §11.1 line 576), far under the 50k single-execution ceiling. It reads Entities tables only, so no ETF table's read pattern changes.

**Per holdings view: not bounded in the spec.** R5 badges "a visible page of holdings", but the ETF holdings screen has no pages. Its default slice is **All**: `currentSliceSize = "All"` at `ma-etf.js:15`, reset to All at :950 and :1292, and `updateHoldingsDisplay()` renders every filtered row (:1914–1918). The table is also rebuilt in full on every filter keystroke (`onEtfHoldingFilter` :1474 → :2007 → `updateHoldingsDisplay`). If R5 badged every rendered row, the cost per view would be ⌈rows / 50⌉ batches:

| Holdings rendered (illustrative) | Batches | Typical reads | Worst reads |
|---|---|---|---|
| 50 (Top 50) | 1 | ≈ 300–400 | ≤ 1,600 |
| 500 | 10 | ≈ 3–4k | ≤ 16k |
| 3,500 (broad equity ETF, All) | 70 | ≈ 21–28k | ≤ 112k |

…and that repeats on each keystroke unless results are cached. At 100 large-fund views a day that is ≈ 2–3M reads typical, half the 5M/day cap from one badge feature. Hence E7-2.

## Required items (doc-only; rev 1.4, before the Phase 2 build)

- **E7-1. Name R5's caller and phase.** R5 is labelled "(P1)" (§7.2 line 405; §11.1 line 576), but §12 Phase 1 (line 597) builds only R1–R4, and neither §9's `ma-etf.js` row (line 506) nor Phase 2 (line 598) mentions batch badging. State that **`ma-etf.js` is R5's only caller, through `data_entitiesGet()`, built in Phase 2**, and that the `entities-api` R5 route deploys with Phase 1. Alternatively, move R5 out of v1 (click-time R1 only). Either is acceptable to the ETF PL.
- **E7-2. Bound R5 per holdings view.** In §7.2 (R5 row) and §11.2, define "visible" for the ETF holdings screen:
  - **(a)** badge only the rows rendered in the viewport (or the first 50 rendered rows), at **≤ 1 batch per render**, with further batches only on scroll;
  - **(b)** a **per-session cache keyed by `instrument_key`**, so filter keystrokes, slice changes and re-renders never re-request a key already resolved;
  - **(c)** debounce of at least 300 ms after the last filter keystroke;
  - **(d)** abort in-flight batches on ETF switch through the existing `entityIconAbortController`;
  - **(e)** a declared **per-view cap**, recommended ≤ 4 batches (≤ 200 keys; ≤ 1,600 typical, ≤ 6,400 worst) before the user scrolls further.
- **E7-3. Add R5 to the daily estimate.** §11.3 (line 588) counts issuer views and instrument resolutions but not R5. Add an ETF-holdings line, for example 300 holdings views × ≤ 4 batches ≈ 0.36–0.48M typical, ≤ 1.9M worst. State that it sits within the 5M/day cap alongside the existing line.

## ETF PL position
007 rev 1.3 does not threaten ETF data integrity or ETF contracts, and it removes an existing ruling-D breach. The one ETF risk is unbounded R5 badging on a screen whose default is "All holdings". With E7-1 to E7-3 in rev 1.4, the ETF PL has no objection to Phase 2.

---

## Rev 1.4 delta check (10 Oct)

```text
PACKET:       MA-OCT-007.R14C-ETF, Control v1 92e2aa721394f595acbb59031df56ea60906f9d7b88aa7ab4a23f8bfe3cfc4c6
              Task v1 cd07fc433d784ba00bf73f92e44503fefd5243f9dd2f79dd17efa803b853161b (both match STATUS_BOARD / Control)
EXECUTED BY:  REVIEW-A, ETF Product Lead hat, Sat 10 Oct 2026, doc-only (0 D1 reads/writes, no git writes)
INPUTS:       claude/MA-OCT-007_Spec.md rev 1.4               4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c (818 lines)
              claude/packets/MA-OCT-007_Spec_rev1.3.md         332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e
              claude/packets/MA-OCT-007.R14_Report.md          e764891dffe3f49adf4545e3a86092fd47f8eee43fb746b09e730f300718a14a
              (all re-hashed before reading; all match. HEAD 16918e0, no .git locks)
METHOD:       diff -u rev 1.3 copy → rev 1.4: 28 hunks, the same 28 the R14 report lists. Checked only E7-1..E7-3 and O6,
              plus a sweep of every added line for ETF tables, Workers and routes (0 hits).
VERDICT:      E7-1, E7-2, E7-3 all MET. O6 consent stands (YES WITH CONDITIONS, unchanged). ETF PL: no objection to rev 1.4.
```

Above this section, the file is unchanged (pre-append SHA-256 `ae3c1c8db1fb6e35ca32e1118feeef3eacd410304a25d4b1dcd79855cae276cc`).

### Items

| Item | Required | Rev 1.4 (line) | Result |
|---|---|---|---|
| **E7-1** | Name R5's caller and phase, **or** move R5 out of v1 | R5 out of v1 everywhere it appears: §3.4 (199: "icon stays neutral until clicked … R1"; any later R5's only caller is `ma-etf.js` via `data_entitiesGet()`); §7.2 R5 row (445: "Not in v1 (E7-1)"); §11.1 (618); §12 Phase 2 (642: "no R5 batch badging") | **MET.** The out-of-v1 option was one of the two I offered. The author's reason holds: with R7-7's corrected worst case of ≈ 5.5k reads per batch, even the bounded R5 could reach ≈ 6.6M/day at 300 views, over the 5M cap, until *k* is measured. |
| **E7-2** | Bounds (a)–(e) recorded as mandatory for any later R5 | §11.2 (626): viewport or first 50 rendered rows, ≤ 1 batch per render, more only on scroll (a); per-session cache keyed by `instrument_key` (b); ≥ 300 ms debounce (c); abort on ETF switch through `entityIconAbortController` (d); ≤ 4 batches / ≤ 200 keys per view (e); 50-key batch cap | **MET.** All five bounds, word for word, marked "must". |
| **E7-3** | R5 line in the daily estimate | §11.3 (632): **0 in v1**; for a later packet 0.36–0.48M typical, worst ≈ 6.6M, "over the 5M/day cap on its own, so that packet must measure *k* and re-bound R5 before enabling it" | **MET.** It also states honestly that E7-2's bounds alone are not enough at the new worst case. |

### O6 position (Phase 2 changes to `ma-etf.js` that remain)

§9's `ma-etf.js` row (547) is **unchanged** from rev 1.3 (no hunk touches §9). Phase 2 is now the event, the bond-branch icon, the `ma:instrument-state` restyle and removal of the grey-out, with no batch badging (642).

| Condition | Status in rev 1.4 |
|---|---|
| 1. E7-1..E7-3 in rev 1.4 before the Phase 2 build | **Met** (above). |
| 2. Holdings table otherwise unchanged (columns, order, weights, filter, slice, abort on ETF switch) | **Holds.** No hunk touches §9 or the holdings table. The R7-6 history contract adds a guard **in the ETF's favour**: `popstate` never re-renders the base panel, and `#etfHoldingsContent` is untouched (183, N7E-2 applied); T7 tests it (689). |
| 3. Icon degrades to clickable, never disabled | **Holds and is now explicit.** §5.3 (334): grey "e–" for unmatched is "**still clickable**" and the `pointer-events:none` grey-out is removed. With no R5, the icon is neutral until clicked (199), so there is no pre-click failure path at all. Placeholder keys (`CUSIP:000000000` etc.) still emit `ma:open-instrument` and show "No unique identifier for this holding" (124, 350). |
| 4. No ETF Worker, route or table change without a fresh consult | **Holds.** 0 added lines name an ETF table, Worker or route (`fund_holdings_monthly`, `etf_master`, `meridian-proxy`, `meridian-holdings`, `api/etf…`). |

**O6: consent stands, YES WITH CONDITIONS (1–4 as above). Conditions 2–4 remain binding on the Phase 2 build and its UAT.**

### Unlisted changes

None that touch ETF scope. The 28 hunks match the R14 report's list one for one. Changes outside my items (R7-1..R7-10, O3, N7-8..N7-12, N7E-2) are not reviewed here; they belong to R14C-UXDI.

### Notes (non-blocking)

- **N7E-3 (answer to R14 Q1, ETF view).** `placeholder_key: true` as an **additive flag** is the better choice for the ETF screen. It keeps the reason vocabulary unchanged (`no_mapping`), so `ma-etf.js` keeps one restyle path for `unmatched`. A dedicated reason code would be acceptable too, but would add a case to §5.4 and T9 for no ETF benefit. It fits 007's extensibility rule (no new state, no new key type).
- **N7E-4 (R14 Q4, ETF context).** On ETF holdings the dominant placeholder is the pipeline's `000000000` CUSIP on ISIN-less rows (cash, derivatives, some FX lines). The extra `NAME:N/A|NA|NONE` patterns are harmless; the 13 Oct check covers only `CUSIP:000000000`. If a later read pack finds other ETF placeholder patterns, add them then.
- **N7E-1 (`closeEntityOverlay()` coupling)** stays deferred, as the R14 report says. Still non-blocking.

**ETF PL position:** rev 1.4 closes E7-1 to E7-3. With R5 out of v1, the only ETF read risk I raised is gone for October. **No objection to the Founder approving 007 rev 1.4 on Mon 12 Oct.**
