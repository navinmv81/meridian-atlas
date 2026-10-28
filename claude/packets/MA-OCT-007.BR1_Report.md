# MA-OCT-007.BR1 — Report: 007 Phase 1 build review + UAT sheet

**Control:** v1 `claude/packets/MA-OCT-007.BR1_Control_v1.md` SHA-256 `4d7de1c8343c7363aaf95c910af89e22a96be47327686d7d963f357fe0d614ec` (matches the STATUS_BOARD row)
**Task:** v1 `claude/packets/MA-OCT-007.BR1_Task_v1.md` SHA-256 `89bebecd4fe64604666521d2ae5ca45c48fadee3c384de00e82abaac12c9bf2d` (matches the Control)
**Executed by:** UX Lead with the Data-Identity checks (REVIEW-007 role), Cowork, Wed 21 Oct 2026, on the Founder's instruction.

```text
VERDICT:  READY WITH NOTES. Founder UAT can run Thu 22 Oct on the attached sheet.
          No blocking finding. 1 fix before release (BR-1), 1 cosmetic (BR-2),
          1 data issue routed to Data-Identity (BR-3), 1 untestable-until-013 item (BR-4).
```

**Independence (disclosed for the Main Lane).** This session did **not** build Phase 1 (LANE-1-ENG did; `0dd7ef0`, `3989ab1`), so the Task's condition holds. It is, however, the session that authored spec revisions 1.2–1.4 as LANE-7 (R13, R14), and on 10 Oct it declined R14C-UXDI for that reason. This review checks the build against the spec, not the spec itself. If the Main Lane wants a reviewer with no 007 history at all, re-run BR1 in REVIEW-007's own session; the UAT sheet can stand either way.

## 1. Preflight and inputs

- Folder `Meridian Atlas Clean (v11)`; branch `October-2026`, HEAD `3989ab1`; no `.git/*.lock`; git read with `--no-optional-locks` only.
- Re-hashed, all as expected: spec rev 1.4 `4d4fffef…397c`; `MA-OCT-007.P1_Report.md` `e9c8c374…b232c`.
- Working-tree files equal their committed versions: `App/ma-data.js` `38eb07ae…9ded`, `App/index.html` `e0d2778b…4a59`, `App/ma-entities.js` `94aa252f…2e7a` (all = P1 report Sun 18), `App/Corporate Atlas/src/entities-api.js` `fac446bf…e245` (= P1 report Thu 15).
- N7-13 … N7-16 are in `claude/MA-OCT-007_Spec_Review.md` (R14C append), not in spec rev 1.4; read there.
- **Live Worker lookups: 9 of ≤ 20**, in the built-in browser, read-only (the shell's network is blocked by the proxy). 0 D1 writes, no deploys, no git writes. Files written: this report and `claude/MA-OCT-007_UAT_Sheet.md` only.

## 2. UX checks

| Check | Result | Evidence |
|---|---|---|
| Four card states and §5.4 copy | ✅ | `_navExplain` (`ma-entities.js` 1847–1863) holds the §5.4 text verbatim for matched, low (heuristic and other), ambiguous (`isin_duplicate`, `source_conflict`) and every unmatched reason incl. the placeholder line; `_NAV_STATE_STYLE` badges Matched / Low confidence / Ambiguous / "? No issuer"; `_NAV_SOURCE_LABELS` = §5.4 source labels; raw codes are never rendered. |
| Ambiguous never pre-selects | ✅ | 1923–1926: every candidate gets its own "Open issuer →" and the line "N candidate issuers — none is selected for you". Live: `US0321084339`, `CA46431R1029` → ambiguous / `isin_duplicate`, 2 candidates each. |
| Outage → "Couldn't reach Corporate Atlas" + Retry, never unmatched | ✅ with **BR-1** | `fetchWithTimeout` returns status 0 on network failure, timeout or a non-JSON (edge HTML) error; `_navRenderNetworkError` shows the text + ↻ Retry and emits `ma:instrument-state {state:null, error:'network'}`. Gap: a Worker **JSON 500** is not treated as an outage (see BR-1). |
| Back closes exactly one layer | ✅ | One history entry per layer (`pushState {maNav: depth}`, 1691); "← Back" = `navBack()` → `history.back()`; the `pop` route closes layers down to the entry's depth and never re-renders the base panel (1980–1985). P1 T7 round trip recorded. |
| Deep links return to Home on the site (N7-13) | ✅ | Cold load rewrites the landing entry to `{maNav:0}` with no hash, then pushes the route (1988–1997); `entity:`/`instrument:` origins are rebuilt underneath. |
| Router contract (R7-6, R7-10) | ✅ | `index.html` router: parses `entity`/`instrument` only, numeric entity ids, `from` via `URLSearchParams` (one encoded string); invalid-link toast only on cold/typed, never on pop; listens to `popstate` and `hashchange` with a `lastHash` guard against double dispatch; imports nothing. `_navParseFrom` splits on the first `:`, and on the last `:` for `etf`/`entity`. |
| 375 px | ✅ (code) | Layers are 100vw; card header and grids wrap (`flex-wrap`, `minmax(180px,1fr)`); linked rows use `min-width:0` + ellipsis. The build lane recorded 375 px screenshots in T7. A live 375 px check is UAT step 12(b). |

## 3. Data-Identity checks

| Check | Result | Evidence |
|---|---|---|
| Navigation keyed on `entity_id` / `instrument_key` only | ✅ | Every `_navOpen` call passes a numeric entity id or an `instrument_key`; candidate buttons carry `data-entity` (Number) and `data-key`; hashes are `#/entity/{id}` / `#/instrument/{encoded key}`. |
| Source and confidence honest; heuristic 75 → Low | ✅ | Live `XS2199266698`: `low_confidence`, `heuristic` 75, band `low`, primary row from `instrument_entity_map`. Live `US5949181045`: `isin_tier1` 100 high with `also_sources` `[isin_direct 100]` (R7-3). Rows and cards always show source label + band + raw score. |
| Merged ids redirect with notice | ⚠️ not testable live (**BR-4**) | Worker T4 covers 1-hop, 3-hop, too-deep, cycle, survivor-missing and missing-table; T7 rendered the notice from a fixture. `entity_merge_redirect` does not exist yet (013), so no live merged id exists. |
| Removed ids show the gone page | ✅ | Live `GET /api/entities/25782` → 404 `{state:'gone'}`; the card path and the Corporate Atlas panel path both render §6.5's text + search. |
| No name-based linking | ✅ | R1 resolves by key/ISIN only; no candidate is ever chosen by name. The only name use is the user-driven search on the gone page (§6.5 by design). |
| Placeholder guard (R7-2) | ✅ | Live `CUSIP:000000000` → `unmatched` / `no_mapping` / `placeholder_key: true` / 0 candidates. `CUSIP:999999999` → `not_in_universe`. |
| R2 paging | ✅ | Live 28088 `limit=25`: 25 rows, `total` 871, not capped, `next_cursor` set, rows NavLink-shaped with their own band. Entity 2730: 6 rows, `next_cursor` null (single-page sort path). |

## 4. Findings

- **BR-1 (fix before release; not a UAT blocker). A Worker JSON 5xx is shown as a link/data message, not an outage.** The Worker's catch-all returns `json({error:'Internal error'}, 500)` (`entities-api.js:1675`). `fetchWithTimeout` parses it as `{ok:false, status:500}`, and then:
  - the Instrument card shows **"That link isn't valid."** (`_navRenderInstrument`, after the `status === 0` check);
  - the issuer layer shows **"Entity data unavailable."** with no Retry (`_navRenderEntity`);
  - `ma:open-instrument` opens the card with that 500 and emits no `error:'network'` state.

  §5.3 says a network **or 5xx** failure is never a mapping state and always shows "Couldn't reach Corporate Atlas" + Retry. Fix: treat `r.status >= 500` like `r.status === 0` in the three places. Edge-generated HTML errors are already caught (JSON parse fails → status 0). Add a T7 case with a stubbed 500.
- **BR-2 (cosmetic, UX).** Placeholder identifier values are shown as real identifiers on cards and rows: `XS2199266698` and the other Bayer XS bonds show **"CUSIP N/A"**, and `DE000BAY0017` carries `cusip: "000000000"`. Hide an identifier whose value is a placeholder (`N/A`, all zeros) in the card's identifier grid and in `_instrumentRowHtml`'s fallback line. Not a key issue: keys are ISINs here.
- **BR-3 (data, route to Data-Identity Lead; not a 007 defect).** In 2 of 3 live ambiguous ISINs (`US0321084339`, `CA46431R1029`) one candidate is **TRADEWEB EU B.V. (#204921)**, a trading venue, via `firds_direct`. 007 shows it honestly (ambiguous, none selected), but the Founder will see a venue offered as an issuer. This looks like a FIRDS ingest recording a venue LEI as issuer for some ISINs; it sits under KI 22.17. The UAT sheet tells the Founder to pass step 7 on state and copy and to note the data issue.
- **BR-4 (deferred test).** The merged-id redirect and "Merged record" notice cannot be exercised live until 013 creates `entity_merge_redirect` and merges a pair. Keep spec UAT step 12 ("after the first 013 batch") open.

**Known limits accepted for UAT (Task item 3):** T8a (`ma-etf.js` still fetches `/api/entities/isin/` directly) until Phase 2; `etf:` (and `bond:`) origins go Home on a cold load; a cold `entity:{id}:{page}` origin rebuilds page 1 only. All three are written into the UAT sheet's "Not in this UAT" line.

**Non-blocking notes from the reviews still open for the build lane** (unchanged by this review): N7-1 overlay stack growth, N7-2 accessibility (button/focus/Esc), N7-3 stale restyles (Phase 2), N7-4 notice copy, N7-6 narrow missing-table catch (the Worker already matches `/no such table/` only), N7-7 AC8 scope, N7-14 `placeholder_key` row in spec §3.2 (the Worker always returns it, default `false`), N7-15 §11.3 refresh (*k* = 1 measured; AC8 holds), N7-16 §0.2 pointer.

## 5. UAT sheet

`claude/MA-OCT-007_UAT_Sheet.md` — SHA-256 `e5f4d1326bacafe681347abd1f602cb6c29dee73a17abc5c618f6e9431833449`, 31 lines. 12 steps with expected results and pass/fail boxes, using the report's cases: issuer 28088 (paging, round trip, Back to Home), `XS2199266698` (low confidence, heuristic 75), Bayer #2730 (single-page sort, Low beside High), ambiguous `US0321084339` (fallbacks `CA46431R1029`, `US9219378190`), Microsoft `US5949181045` (matched), removed id 25782 (gone + search), placeholder and not-in-universe keys, an invalid link, the outage + Retry, and 375 px. It names the local preview (`http://localhost:8791/`, served by LANE-1-ENG), the accepted limits, the UAT-day R1 re-checks, and a Founder sign-off row.

## 6. Budget

0 D1 writes, no deploys, no git writes, no secrets read or printed. 9 read-only Worker lookups (R1 × 6, R3 × 1, R2 × 2), estimated ≈ 1.5k D1 reads, most of it entity 28088's first page. `MA-OCT-007.BR1_Status.json` and `STATUS_BOARD.md` not edited (Main Lane owns state). Stop point reached.
