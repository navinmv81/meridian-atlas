# MA-OCT-007.P1 — Report

**Lane:** LANE-1-ENG, Engineering Lead (Claude Code). **Packet:** 007 Phase 1 build of spec rev 1.4 `4d4fffef…397c`.
**Opening checks:**
- Control `73ad4f22…c712` matches the STATUS_BOARD row.
- Task `abfdba59…8708` matches the hash in the Control.
- Spec hash re-checked.
- No `.git/*.lock`.
- Branch `October-2026`, HEAD `d0e6847` (T12's commit).
- Wrangler `/usr/local/bin/wrangler` 4.96.0.

**Start approval:** the Founder's paste line, Thu 15 Oct ~16:58 UTC. Status.json still read READY; the Main Lane owns that file.

---

## Day Thu 15 Oct 2026

### Hard deadline met: `meridian-entities-api` Worker live and verified (Fri 16 22:00 UTC deadline)

| | |
|---|---|
| **New version** | **`73851c02-f891-478d-abe1-1e2e5290f11f`**, deployed 17:16:51 UTC, at 100%. This is before the 011 N-3 Entities Worker freeze (17–23 Oct) and outside every FREEZES.json window. |
| **Pre-deploy version (rollback target)** | `0f475f4c-e344-42f3-8081-96938e9c9d0c` (9 Sep). Rollback: `wrangler rollback` to it (§14.2). |
| **Live = repo before the change** | The deployed script content of `0f475f4c` was downloaded through the script-content API, using wrangler's OAuth session (token never printed). It was compared with a `--dry-run` bundle of the repo source at `d0e6847`: **byte-identical**. So the deploy drops no live-only change. |
| **Source** | `App/Corporate Atlas/src/entities-api.js` SHA-256 `fac446bf000d17f1aef740588d91b0947dbe74ceaae517f53d57d427209fe245` (+363/−5 lines). Bundle 57.97 KiB, 14.56 KiB gzip. |

### What shipped (Worker only; backward-compatible, §7.1)

- **R3: redirect handling in `GET /api/entities/:id`** (§6.2–§6.3).
  - A direct hit returns today's body plus `redirect: null`, at 0 extra reads.
  - A PK miss follows `entity_merge_redirect` for up to 3 hops, with a cycle guard. Outcomes:
    - resolved: 200 with `redirect {requested_id, resolved_id, chain, merged_at, packet}`;
    - `gone`: 404 `{error:'not_found', state:'gone', requested_id}`, plus `chain` when a survivor is missing;
    - `redirect_too_deep` / `redirect_cycle`: 409.
  - **"no such table" counts as no redirect row**, so R3 ships before 013. The front end checks only status codes (`ma-entities.js:988`, `:1289`), so the new 404 body is compatible.
- **R2 + R4: paged `/api/entities/:id/instruments?limit=&cursor=`.**
  - Keyset on `instrument_key`, fetching limit + 1 rows.
  - Limit defaults to 25 and is clamped to [1, 100]; a non-integer is a 400. Cursor = last key, with no OFFSET.
  - The first page carries `total` (counted to 1,001; `total_capped: true` means "1,000+").
  - Rows are NavLink-shaped. A row's state comes from its own band, and R1 stays the authoritative resolver.
  - The R3 order is applied: `redirect` comes back with survivor data, and gone → 404.
  - **Without `limit` or `cursor`, the legacy 75-row body is unchanged (T5).**
- **R1: `GET /api/instruments/:key[?isin=]`** (§5.1), all steps 0–6:
  - the placeholder guard runs with 0 reads (R7-2);
  - R1a–R1d;
  - **R1f is coded with missing-table tolerance** (008's tables don't exist live yet);
  - redirects are followed per candidate;
  - candidates are deduped by resolved id, with a primary row plus `also_sources` (R7-3);
  - the state table applies N7-11 precedence;
  - the candidate cap is 10, with `candidates_truncated`;
  - `isin_source: 'holding'` covers N7-10, and `lei` is returned for `lei_only`.
- **Not built:** R5 (out of v1, E7-1), ETF files (Phase 2) and the ticket button (Phase 4).

### Tests (local, 0 D1): `App/Corporate Atlas/tests/nav-007-worker.test.mjs` **58/58**

- **Harness:** the real fetch handler, on an in-memory `node:sqlite` D1 shim. The test file's SHA-256 is `eaccae75a1c928a95d239ece28e58b1eb0298d44c2329bdb36da8583e9c429a5`.
- **T2 (R1 states):** matched; low_confidence (heuristic 75); the corroboration case (R7-3); isin_duplicate; N7-11 precedence; source_conflict and candidate order; lei_only (R7-8); not_in_universe; no_mapping; redirect_unresolved; merged twins collapsing to the survivor; ISIN from the holding (N7-10); bad `?isin=` → 400.
  - **The 5 placeholder forms each make 0 D1 calls.** `CUSIP:000000001` is not a placeholder.
  - A matched instrument uses ≤ 6 statements.
  - With no 008 or 013 tables, it still resolves.
- **T3 (R2):** 3 pages with no gaps or duplicates, in key order; `next_cursor` null at the end; clamp to 100; `abc` and `-3` → 400; 0 → 1; cursor-only → 25; R4 capped at 1,000+; a heuristic row → low_confidence; a redirected id → survivor + redirect; a gone id → 404.
- **T4 (R3):** hit; 1-hop; 3-hop; 4-hop → 409 too_deep; cycle → 409; survivor missing → 404 with chain; never-existed → 404; table missing → hit OK and unknown → 404 (no 500).
- **T5:** the legacy body is byte-equal to the original query, and still caps at 75.
- **T9:** NavLink conformance on R1, R2 rows and the placeholder output, plus a `sec_bond` fixture through R1f.

### T6: plan checks on live D1 (the deploy gate, AC8), 17:16:27–17:16:36 UTC, 0 rows read

| # | Live plan | vs Appendix A.3 |
|---|---|---|
| P1 R1a | `SEARCH instrument_master USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | ✅ |
| P2 R1b | `SEARCH instrument_entity_map USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` | ✅ |
| P3 R1c | `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin=?)` | ✅ |
| P4 R1d (IN-list) and the R3 entity probe | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | ✅ |
| P6 R2 | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)`, **no temp B-tree** | ✅ |
| P7 R4 | `CO-ROUTINE` / `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` / `SCAN (subquery-1)` (the ≤ 1,001-row co-routine) | ✅ (same as ENT-CR1 E2) |
| P8 R3 redirect | `no such table: entity_merge_redirect` | N/A until 013. This is the tolerated case. |
| P10 R1f | `no such table: bond_issuance` / `bond_issuer_link` | N/A until 008 applies its migration. **Follow-up:** run P10 when 008's tables exist, because R1f activates automatically then. |

*k* = **1**, from ENT-CR1's R7-7 measurement: R2 read 52 at limit 25 and 202 at limit 100. So AC2's bound is ≤ 2 × (`limit` + 1).

### Live verification (17:17–17:18 UTC)

| Call | Result |
|---|---|
| `GET /api/entities/28088` | 200; body keys `entity, redirect`; `redirect: null` |
| `GET /api/entities/28088/instruments` (legacy) | 200; keys `instruments` only; **75 rows** (unchanged) |
| `…/instruments?limit=25` | 25 rows; `total` 871; `total_capped` false; `next_cursor` set; key order starts `US21H0226488` |
| `…?limit=500` | clamped to 100 |
| `…?limit=abc` and `?limit=xyz&cursor=` | **400** `limit must be an integer` |
| `GET /api/entities/25782` (MA-SEP-007 loser) | **404** `{"error":"not_found","state":"gone","requested_id":25782}` |
| `GET /api/instruments/US5949181045` | matched; entity 1371 "Microsoft Corp."; `isin_tier1` 100 high; 1 `also_sources` row |
| `US9219378190`, `CA46431R1029`, `US0321084339` (KI 22.17 list) | **ambiguous / isin_duplicate**, 2 `firds_direct` candidates each, none pre-selected |
| `CUSIP:999999999` | unmatched / not_in_universe |
| `CUSIP:000000000`, `NAME:N/A` | unmatched / no_mapping / `placeholder_key: true` / no candidates |
| Legacy `/api/entities/search`, `/api/entities/isin/:isin` | 200, unchanged |
| `/exceptions` (no Access) | 302 to the Access login, unchanged |

**Rollout note:** one call a few seconds after the deploy (`?limit=abc`) returned the legacy 200 body. Re-run directly, it gave 400. The likely cause is an edge still on the old version mid-rollout. Every later call matched the new version.

### Budget (Control: 0 writes, ≤ 20k reads)

- **D1 writes: 0.**
- **D1 reads:** EXPLAINs 0. The live verification ran through the Worker, which this lane does not meter; the estimate is ≈ 4.5k. The largest single call was the legacy `/instruments` on entity 28088, at ≈ 2 × 871 plus a sort.

### Deviations and notes

1. **17:03 UTC (inside the boost PM band, 16:45–17:15):** I started the T6 script before checking the clock. **It never reached D1.** The command hung on a stray `cat >` that was waiting on stdin, before the script file was even written. I stopped it at 17:06, and it produced no output and made no wrangler call. T6 then ran properly at 17:16, after the band. From now on I'll check the clock before every remote step.
2. **Placeholder rule (§3.1) implemented as written:** `CUSIP:` followed by 6–9 zeros, and `NAME:N/A|NA|NONE`.
3. **R2 `total` when capped:** returned as 1000 with `total_capped: true`, so the UI shows "1,000+".
4. **`merged_at` / `packet` on a chain** come from the requested id's own (first) merge hop.

### Rulings made in this lane

- **R-P1-1:** each R2 row's `state` is derived from that mapping row's band only (`matched` / `low_confidence`). The authoritative state comes from R1 on click. §4.2 asks R2 rows for a source badge and band, not a resolved state.
- **R-P1-2:** R1's `unmatched` reason precedence is `redirect_unresolved` > `lei_only` > `not_in_universe` > `no_mapping`. §5.1 lists the four reasons but gives no order.

### Next (Fri 16 → Wed 21; front end, local only, not released)

- **`ma-data.js`:** `data_instrumentKey` (a byte port of `deriveInstrumentKey`, with T1 on ≥ 30 fixtures) and `data_entitiesGet`.
- **`index.html`:** the hash router and history contract (R7-6, R7-10, N7-13).
- **`ma-entities.js`:** card, badges, paging (R7-4), redirect notice and fallback, provenance strip.
- **Verification:** T7/T8 in the browser preview, desktop and 375 px.
- **No more Worker deploys are planned.** The freeze runs 17–23 Oct; the next slot is Sat 24 08:05 UTC, if the front end needs a Worker fix.

**Commit (Thu 15):** Worker source + tests + this report, by explicit path; its SHA is in the Founder line.

---

## Day Sun 18 Oct 2026

**Scope:** front end only, built and tested locally. **No Worker deploy** (011 N-3 freeze; next slot Sat 24 08:05 UTC). **Not released:** `docs/` was not regenerated and Pages is unchanged (go-live at the end of October).
**Opening checks (08:09 UTC):**
- Control `73ad4f22…c712` and Task `abfdba59…8708` re-hashed; both match.
- No locks.
- HEAD `0dd7ef0` = origin.

### Files changed

| File | SHA-256 | Change |
|---|---|---|
| `App/ma-data.js` | `38eb07ae369270a46b8fb7e5cc1e64fc10abcfeae89b6816ae728116076c9ded` | `data_entitiesGet(path)` (same shape as `data_opsGet`; status 0 = outage) and `data_instrumentKey({isin, cusip, ticker, name})`, a byte port of `deriveInstrumentKey`. ISIN and CUSIP are trimmed, never uppercased (N7-9). Returns `null` where the seed would throw. |
| `App/index.html` | `e0d2778b3a47091e4987c731efc077780597d1d7f8583646d7777279bae64a59` | Inline hash router, ≈ 45 lines, no new `<script src>`. Parses `#/entity/{id}` and `#/instrument/{key}` with an optional `?from=` (one `encodeURIComponent` string, R7-10), then dispatches `ma:route` with mode `cold`, `typed` or `pop`. On a cold or typed bad link it shows the "That link isn't valid" toast and clears the hash. A `popstate` never shows it. Listens to both `popstate` and `hashchange`. Imports nothing. |
| `App/ma-entities.js` | `94aa252f99e68df26164bc09fc59f71f6f822d5c7cb824556f3b105228e62e7a` | History-backed overlay **stack**, Instrument card, state badges and §5.4 copy, provenance strip, paged linked instruments (R2/R4, R7-4), redirect notice, `gone` fallback with search (§6.5), outage + retry, `ma:route` / `ma:open-instrument` listeners, `ma:instrument-state` emitter. |
| `App/Corporate Atlas/tests/nav-007-key.test.mjs` | `2c124d0283bfff2a803c5cdab49e62d7f674ee99324c7c2b3bdb17b9b4018445` | T1 |

### Design notes

**History contract (R7-6, N7-13):**
- Each overlay layer is one history entry with state `{maNav: depth}`; the base panel is depth 0.
- In-app "← Back" calls `history.back()`.
- A `popstate` closes layers down to its depth and **never re-renders the base panel**. Forward re-opens a closed layer on its existing entry.
- **Cold deep link:** the entry is rewritten to Home (`{maNav: 0}`, no hash) and the route is pushed above it, so Back lands on Home and never leaves the site.
  - An `entity:` or `instrument:` origin is rebuilt underneath.
  - `etf:` and `bond:` origins go Home in Phase 1, because rebuilding an ETF tab needs `ma-etf.js` (Phase 2).
- **Typed hash:** the new entry is stamped (`replaceState`).
- **Merged id:** `replaceState` to the survivor's hash, and `_breadcrumb` ids are rewritten.

**Existing callers kept:** `showEntityOverlay(id, backLabel)` (`ma-etf.js:3016`, `ma-13f.js:535`, ownership click-throughs) now opens one layer and pushes one entry. `closeEntityOverlay()` (called by `ma-etf.js:1192` on an ETF switch) closes every layer and unwinds their entries with `history.go(-depth)`. The × closes all layers.

**Same entity twice in one stack:** the section loaders (`_loadEntityExposureStrip`, `_loadLinkedInstruments`, `ent_injectIssuerPanels`) take the layer as `root`, and "Show all ETFs" finds its section from the button. So two layers for the same entity never share sections. Verified with 28088 at depths 1 and 3.

**The Corporate Atlas panel path (`showEntityDetail`)** also follows R3 now: the survivor plus a notice; 404 shows the "no longer in Meridian Atlas" text; 409 shows "merge history couldn't be resolved".

**Linked instruments:**
- Replaces the 75-row list and its "Show all N" (E6).
- The header reads "Linked instruments · N", or "1,000+" when capped.
- Single-page issuers are sorted by asset type then name, with group headers.
- Multi-page issuers keep key order, with an asset-type badge on every row and a "Sorted by identifier" label.
- "Show 25 more ↓" appends the next page. A failed page offers Retry.
- Each row shows source label + band + score, and opens its card with `from=entity:{id}:{page}`.

### Tests

| Test | Result |
|---|---|
| **T1** `data_instrumentKey` ≡ `deriveInstrumentKey` (both loaded from their real source files) | **34/34**: 33 fixtures (12-char, padded, lower-case, 11- and 13-char ISINs; 5/6/8/9/10-char CUSIPs, padded and lower-case; placeholder `000000000` / `000000`; tickers; long, spaced, tab, non-ASCII, Turkish-locale and empty names; `N/A` / `na` / `None`) + the null case |
| T2–T5, T9 (Worker, re-run) | **58/58**, unchanged |
| **T8a** no entities-api URL in `ma-etf.js` | **Expected FAIL until Phase 2:** `ma-etf.js:2997–2999` still fetches `/api/entities/isin/` directly. Phase 2 replaces it with `ma:open-instrument` (ETF files are out of Phase 1). |
| **T8b** no `POST` in 007 front-end code | **Pass** (grep of the added lines) |
| **AC3** grep | **Pass.** Every `_navOpen` call is keyed by `entity_id` or `instrument_key`. Same-name Microsoft bonds render as separate rows, each with its own ISIN. |

**T7, browser preview** (`corporate-atlas-static` on :8791, against the live Worker `73851c02`; desktop + 375 px):

| Check | Result |
|---|---|
| Cold `#/entity/28088` | Issuer layer, "← Back to Home", state `{maNav:1}`; "Linked instruments · 871", "Sorted by identifier" |
| Show 25 more | 50 rows, 50 unique, strict key order |
| **AC1 round trip:** page-2 row (`US36176XJ595`, `from=entity:28088:2`) → card (depth 2) → Open issuer (depth 3) → browser Back → in-app Back | Each Back closes exactly one layer. On return, pages 1–2 are still loaded (50 rows), **scroll restored (1661 px)**, and it is the same DOM element |
| One more Back from the cold layer (N7-13) | `http://localhost:8791/`, depth 0, no layers. **Still on the site.** |
| Cold `#/instrument/US36176XJ595?from=entity:28088:2` | Issuer 28088 rebuilt underneath; Back → issuer; Back → Home `{maNav:0}` |
| Typed and cold invalid links (`#/entity/abc`, `#/nonsense`, cold `#/entity/0`) | Toast "That link isn't valid"; hash cleared; no layer opened |
| Typed `#/instrument/US9219378190` (KI 22.17) | Card "Ambiguous · Several issuers share this ISIN. Choose one."; 2 candidates (`ESMA FIRDS`, High · 100), **none selected** |
| `#/entity/25782` (MA-SEP-007 loser) | `gone` fallback: "This entity is no longer in Meridian Atlas…"; the search box returns live results ("bayer" → Bayer Aktiengesellschaft …) |
| `#/instrument/CUSIP%3A000000000` | "? No issuer · No unique identifier for this holding (for example cash or a derivative)." |
| `ma:open-instrument` (MSFT ISIN, `from=etf:VTI:holdings`) | **One click straight to the issuer** (#1371), with the strip "Reached from MICROSOFT CORPORATION · ISIN US5949181045 · ISIN · confidence 100 (high) · View instrument", "← Back to ETF Holdings"; `ma:instrument-state` `{state: matched, confidence_band: high}` |
| **Outage** (fetch to entities-api blocked in the page) | Card shows "Couldn't reach Corporate Atlas. ↻ Retry"; `ma:instrument-state` `{state: null, error: 'network'}`, **never "unmatched"**. Retry after unblocking renders the matched card |
| `XS2199266698` (live heuristic row, Bayer) | "Low confidence · Name-based match (heuristic), score 75 — not verified by an identifier." → "Open issuer" |
| Fixture-rendered states (local responses, no production rows; D4) | `lei_only` shows the LEI line; `source_conflict` shows "Our sources disagree about the issuer. Choose one." with 2 candidates and the **Merged** chip; a name with an apostrophe ("LOWE'S COS") opens correctly; the redirect notice reads "Merged record. Entity #25782 was merged (via #25800) into Bayer Aktiengesellschaft (#2730) on 27 Oct 2026 (MA-OCT-013). You are viewing the surviving record." |
| Single-page issuer (#2730, 6 rows) | Sorted, with a "DBT" group header and no "Sorted by identifier"; zero-row issuer (#208217) shows "No linked instruments in Meridian Atlas" |
| `showEntityOverlay(1371)` (legacy signature) → `showEntityOverlay(28088,'Manager')` → `closeEntityOverlay()` | Depth 2 → 0, state `{maNav:0}`, hash cleared, 0 layers in the DOM |
| 375 px | Card and linked list render without horizontal overflow (screenshots taken) |
| Console | No errors from 007 code. Two kinds seen: 404s from the intentional `gone` probes, and **402 from `meridian-proxy …/?ipos=1`** (home-screen module, existing, not 007) |

**Fixes made during T7:**
1. A typed **invalid** hash showed no toast. The browser fires `popstate` (state null) for it, and the router classed it as a pop. Now any null-state entry with a hash counts as typed.
2. The candidate "Open issuer" button inlined the name in a single-quoted handler, so an apostrophe would break it. It now uses data attributes.
3. The Back label is computed at render time, so a rebuilt origin shows its real title, not "previous page".

### Budget

- **D1 writes: 0.**
- **D1 reads:** all through the live Worker during T7, which this lane does not meter. **Estimate ≈ 10–14k.** About 14 issuer-layer opens each load `/graph`, `/etf-exposure`, `/issuer-panels` and R2/R4 (entity 28088 is the heaviest at ≈ 0.9k for R2+R4), plus ≈ 20 R1 calls at about 8 reads each.
- **Packet total so far ≈ 15–19k against ≤ 20k.**
- **Ruling R-P1-3:** the rest of the build tests against fixtures (prefetched responses, as above) or the local stub, not the live Worker. The remaining headroom is kept for the Main Lane's UAT-day R1 re-checks.

### Not done / carry-overs

- **Phase 1 front end is functionally complete.** What remains:
  - the UX Lead + Data-Identity Lead build review (separate packet; never reviewed by this lane);
  - fill-in of the UAT sheet values (§13).
- **Known limits, documented:**
  - (a) A cold deep link with `from=entity:{id}:{page}` rebuilds the origin issuer with page 1 only, not pages 1…*k*. The in-session round trip keeps every loaded page.
  - (b) `etf:` and `bond:` origins go Home until Phase 2.
  - (c) Scroll restoration relies on the layer's DOM surviving underneath. That holds for in-session navigation, not for a cold reload.
- **UAT candidates found today:**
  - low-confidence: `XS2199266698` (Bayer, heuristic 75);
  - large issuer: 28088 (871);
  - ambiguous: `US9219378190`, `CA46431R1029`, `US0321084339`;
  - gone: 25782;
  - unmatched (not in universe): `CUSIP:999999999`.
  - Each needs its one R1 re-check on UAT day.
- **P10** (R1f) still runs once 008's tables exist.

**Commit (Sun 18):** front-end files + T1 + this report, by explicit path. Nothing is released.

---

## Day Wed 21 Oct 2026 (partial: stopped at the usage limit)

**Scope:** BR-1 and BR-2 from `claude/packets/MA-OCT-007.BR1_Report.md`. Local only, with no deploy (N-3; next slot Sat 24 08:05 UTC). Not released.

**Fixed in `App/ma-entities.js`** (SHA-256 `9b42b5ffdba22ad12fe39ec5abcf206b68f26606258e2df9ff43b1d8c576e303`):
- **BR-1:** the new `_navIsOutage(r)` treats status 0 (network or timeout) and any **≥ 500** as an outage. Every such case shows "Couldn't reach Corporate Atlas" with Retry:
  - the Instrument card, which also emits `ma:instrument-state {error:'network'}`, and through it the `ma:open-instrument` path;
  - the issuer layer;
  - the gone-page search;
  - the Corporate Atlas panel path (`showEntityDetail`), which now has a Retry button.
- **Linked instruments:** an outage shows "Couldn't reach Corporate Atlas"; a 4xx shows "Linked instruments unavailable". Both offer Retry.
- **BR-2:** the new `_navRealId` / `_navDisplayIds` hide placeholder identifier values (`N/A`, `NA`, `NONE`, `NULL`, dashes, all zeros) in the card's identifier grid, the linked-instrument row line and the provenance strip. Keys are unchanged.

**Tests run:** T1 34/34 and Worker 58/58, both unchanged.

**NOT done (carry-over):**
- the new tests for BR-1 (a stubbed 500 on card, layer, panel and list) and BR-2 (placeholder hiding);
- a browser re-check;
- 0 live reads were made today.

**Commit:** `App/ma-entities.js` + this report, by explicit path.
