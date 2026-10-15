# MA-OCT-007.R14 — Report

**Control:** v1 `claude/packets/MA-OCT-007.R14_Control_v1.md` SHA-256 `cf4547bfd49d3aa01cb50bc4511165757c76c1b1090b54bab7ff932dd0b2832b` (matches STATUS_BOARD row)
**Task:** v1 `claude/packets/MA-OCT-007.R14_Task_v1.md` SHA-256 `187ee7dc0c4820e9cf35b2b93fe024fce0b6f4121301d9affe42faf63683dae8` (matches Control)
**Executed by:** Engineering Lead (LANE-7), Cowork, 10 Oct 2026, on the Founder's instruction to execute. Author only; no review performed.

## Preflight
- Folder `Meridian Atlas Clean (v11)`, branch `October-2026`, HEAD `16918e0`. No `.git/*.lock`. Git read only with `--no-optional-locks`.
- Inputs re-hashed, all match the Task:

| Input | SHA-256 |
|---|---|
| `claude/MA-OCT-007_Spec.md` rev 1.3 (772 lines) | `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` |
| `claude/MA-OCT-007_Spec_Review.md` | `79a852cad56864bfee39e1d3d3e404995200c978a586205390243100b70b035b` |
| `claude/MA-OCT-007_ETF_Consult.md` | `ae3c1c8db1fb6e35ca32e1118feeef3eacd410304a25d4b1dcd79855cae276cc` |
| `claude/packets/MA-OCT-007.REV_Report.md` | `6b8bd6be016622a9ee21fb601b75b70ba8decac50e5d3b8104c0831ed680481f` |
| `claude/packets/MA-OCT-007.ETF_Report.md` | `4dad703f062e57a04fac502b760ede77ecb6e13f0a5cbf006a6736599015e3cf` |
| `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` (read for AR-3, RB-1, E1/E2/E4) | `fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20` |

## Outputs

| File | SHA-256 | Lines |
|---|---|---|
| `claude/packets/MA-OCT-007_Spec_rev1.3.md` (copy, before editing) | `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` (= rev 1.3) | 772 |
| `claude/MA-OCT-007_Spec.md` **rev 1.4** | `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c` | 818 |

Diff against the rev 1.3 copy: **28 hunks**, all listed below.

**E7-1 option chosen: R5 out of v1.** Reason: click-time R1 already gives every state; Phase 2 has a 3-day window on a screen whose default slice is "All"; and with R7-7's corrected worst case (≈ 5.5k reads per 50-key batch), E7-2's 4-batch view could reach ≈ 6.6M reads/day at 300 views, over the 5M cap, until *k* is measured. E7-2's bounds are recorded as mandatory for any later R5 (§11.2), and E7-3's line shows 0 in v1 (§11.3).

## Items (line numbers are rev 1.4)

| Item | What changed | Section | Line(s) |
|---|---|---|---|
| R7-1 | O2 closed (composite `idx_iem_entity_key`, ENT-CR1 rev 1 C1); §7.3 cell → "No → ENT-CR1 C1"; recommendation paragraph → one-line decision; index named exactly in Q3, P6/P7; single-column column and P6′ labelled "fallback only if ENT-CR1 RB-1 runs"; R2/R4 gate = "ENT-CR1 verified" (C1 + E1, E2, E4; AR-3) | §7.3; §11.1; §11.2; §12; §15.2; App. A Q3, P6′, P7; App. B | 501, 503; 609; 622; 640, 641; 718; 755, 778, 779; 811 |
| R7-2 | E8 notes the missing placeholder check; placeholder list and R1 behaviour (`unmatched` / `no_mapping` / no candidates / `placeholder_key: true`, before any lookup); card copy; step 0 in R1; T1/T2 fixtures; 2-read pre-build check in P0 (Tue 13 Oct, ENT-CR1 after-set, LANE-1-ENG) | E8; §3.1; §5.1; §5.4; §12; §14.1 | 103; 124; 299; 338+ (table); 640; 683, 684 |
| R7-3 | Primary-row rule for `source`, `source_table`, `confidence`, `as_of` (ties: non-heuristic, then `instrument_entity_map`); band from that row; additive `also_sources`; T2 corroboration case; T9 covers `also_sources` | §3.2; §5.1 step 5; §5.2; §14.1 | 162, 165; 305; 328; 684, 691 |
| R7-4 | Correct key-order description (binary order interleaves `CUSIP:`/`NAME:`/`TICKER:` with country codes); single-page sort vs multi-page flat list with badges and "Sorted by identifier"; `asset_cat` filter cost note; O5 closed (yes, with conditions) | §7.2; §4.2; §15.2 | 491; 274; 721 |
| R7-5 | New §5.4 copy table: every state × reason (incl. `source_conflict`, placeholder, `lei_only`, `not_in_universe`, `redirect_unresolved`, `gone`, redirect loop/depth, merged, network) with badge, one-line text and action; source labels; machine codes never shown; AC7 checks against it | §5.4; §4.1; AC7 | 338–358; 258; 592 |
| R7-6 | History contract: one entry per overlay layer; `popstate` with no route closes overlays and never re-renders the base panel; `popstate` to a stacked route closes layers above; only cold load or hand-typed hash dispatches; listens to `popstate` and `hashchange`; "← Back" = `history.back()`; unknown-route toast limited to cold load / typed hash; T7 case | §3.3; §4.4; §14.1 | 181–188, 189; 291; 689 |
| R7-7 | AC2 bound → `≤ k × 2 × (limit + 1)`; R2 page ≈ 52–104 (limit 25), ≈ 202–404 (limit 100); first view ≈ *n* + 52*k* + 1 (≈ 976 at *k* = 2 for entity 28088, inside AC8); R1 worst ≈ 110; R5 worst ≈ 5.5k; figures provisional; R2 measurement on entity 28088 at limit 25 and 100 on 13 Oct (LANE-1-ENG, after E1) sets *k* | AC2; §7.2; §11.1; §12; App. A P6 | 567; 441, 442, 445; 611–618; 640; 777 |
| R7-8 | `lei_only` kept in the contract, proven by T2, removed from AC7's live list ("no live rows on 9 Oct"); AC7 source corrected (Q5 for ambiguous; others picked in the preview and confirmed with R1 on UAT day; no production fixtures); UAT step 7 example → `no_mapping`; §4.1 unmatched row | AC7; §13; §4.1; §14.1 | 592, 593; 664; 258; 684 |
| R7-9 | §4.1 example → heuristic score 75 with the "not verified by an identifier" reason; live confidences and counts in §5.2; band-override explanation; Q2 restated to cover OpenFIGI 70 → medium and heuristic 75 → low by source; UAT step 5 | §4.1; §5.2; §15.1; §13 | 256; 326–330; 710; 662 |
| R7-10 | `bond:{instrument_key}` added to the `from` grammar; parse rule (one encoded string, split once on the first `:`; `etf`/`entity` split on the last `:`); unknown type → `direct`; §3.5 link uses the encoded form | §3.3; §3.5 | 177, 178; 204 |
| E7-1 | R5 out of v1 (see above); `ma-etf.js` stays the only future caller via `data_entitiesGet()`; Phase 2 has no batch badging | §3.4; §7.2; §11.1; §12 | 199; 445; 618; 642 |
| E7-2 | Bounds recorded as mandatory for any later R5: viewport / first 50 rows, ≤ 1 batch per render, per-session key cache, ≥ 300 ms debounce, abort on ETF switch via `entityIconAbortController`, ≤ 4 batches per view, 50-key cap | §11.2 | 626 |
| E7-3 | ETF holdings line in the daily estimate: 0 in v1; for a later packet ≈ 0.36–0.48M typical, worst ≈ 6.6M (over the cap; must re-bound after measuring *k*) | §11.3 | 632 |
| O3 | Recorded closed: no redirect backfill in October (REV §4) | §6.5; §15.2 | 420; 719 |
| Rev history | New rev 1.4 Status line; rev 1.3 Status kept "for trace" (same convention as rev 1.3) | Header | 15, 17 |

## All diff hunks (rev 1.3 copy → rev 1.4)

| # | Hunk | Section | Items |
|---|---|---|---|
| 1 | `-12,7 +12,9` | Status | Rev history |
| 2 | `-98,7 +100,7` | §2 E8 | R7-2 |
| 3 | `-119,6 +121,10` | §3.1 | R7-2, N7-9 |
| 4 | `-152,10 +158,11` | §3.2 | R7-3 |
| 5 | `-167,11 +174,19` | §3.3 | R7-10, R7-6, N7E-2 |
| 6 | `-181,12 +196,12` | §3.4, §3.5 | E7-1, R7-10 |
| 7 | `-238,9 +253,9` | §4.1 table | R7-9, R7-8, R7-5 |
| 8 | `-256,6 +271,7` | §4.2 | R7-4 |
| 9 | `-272,7 +288,7` | §4.4 | R7-6 |
| 10 | `-280,12 +296,13` | §5.1 steps 0 and 5 | R7-2, R7-3 |
| 11 | `-296,17 +313,19` | §5.1 note, §5.2 | N7-11, R7-9, R7-3 |
| 12 | `-316,6 +335,27` | new §5.4 | R7-5 |
| 13 | `-377,7 +417,7` | §6.5 | O3 |
| 14 | `-398,11 +438,11` | §7.2 table | R7-7, E7-1 |
| 15 | `-420,6 +460,7` | §7.2 R1 SQL comment | N7-10 |
| 16 | `-447,7 +488,7` | §7.2 ordering | R7-4 |
| 17 | `-457,9 +498,9` | §7.3 | R7-1 |
| 18 | `-523,7 +564,7` | AC2 | R7-7 |
| 19 | `-548,7 +589,8` | AC7 | R7-8, R7-5 |
| 20 | `-564,38 +606,40` | §11.1–§11.3, §12 | R7-1, R7-7, E7-1, E7-2, E7-3, R7-2 |
| 21 | `-615,13 +659,13` | §13 UAT steps 5–11 | R7-9, R7-8, N7-8 |
| 22 | `-636,15 +680,15` | §14.1 T1, T2, T7, T9 | R7-2, R7-3, R7-8, R7-6, N7-11 |
| 23 | `-663,7 +707,7` | §15.1 Q2 | R7-9 |
| 24 | `-671,10 +715,10` | §15.2 O2, O3, O5 | R7-1, O3, R7-4 |
| 25 | `-683,6 +727,8` | App. A intro | N7-12 |
| 26 | `-706,7 +752,7` | App. A Q3 | R7-1 |
| 27 | `-728,9 +774,9` | App. A P6, P6′, P7 | R7-7, R7-1 |
| 28 | `-762,7 +808,7` | App. B | R7-1 |

**Anything else changed:** none.

## Non-blocking notes

| Note | Applied / deferred | Where / why |
|---|---|---|
| N7-1 overlay stack growth | Deferred | New behaviour (pop-to-existing, depth cap), not a wording fix |
| N7-2 accessibility (button, focus, Esc) | Deferred | Several behaviours; build-lane item |
| N7-3 stale restyles | Deferred | ETF behaviour, not wording |
| N7-4 merged-notice copy | Deferred | §6.4 not edited for a required item |
| N7-5 cross-key bond gap | Not applied | For 008/009, per Task |
| N7-6 narrow missing-table catch | Deferred | §6.2 not edited for a required item |
| N7-7 scope AC8 | Deferred | AC8 not edited for a required item |
| N7-8 UAT fixtures (steps 6, 8, 11) | Applied | §13 lines 663, 665, 668 (section edited for R7-8/R7-9) |
| N7-9 holding-row field mapping | Applied | §3.1 line 126 (section edited for R7-2) |
| N7-10 `?isin=` provenance | Applied | §7.2 line 463 (section edited for R7-4/R7-7) |
| N7-11 reason precedence | Applied | §5.1 line 316 and T2 (table edited for R7-3); one-line rule |
| N7-12 Appendix A supersession | Applied | App. A line 730 (section edited for R7-1/R7-7) |
| N7E-1 `closeEntityOverlay()` coupling | Deferred | §9 not edited for a required item |
| N7E-2 router must not reset `#etfHoldingsContent` | Applied | §3.3 history contract, line 183 (section edited for R7-6) |

## Questions (raised, not acted on)
1. **`placeholder_key: true`** is an additive NavLink flag I added so the card can show "No unique identifier for this holding" while the reason stays `no_mapping`, as R7-2 asks. Reviewers to confirm, or prefer a dedicated reason code.
2. **§11.3 daily estimate** still uses the *k* = 1 first-view figure (≤ 1,054). At *k* = 2 it is ≈ 1,106 and the line becomes ≈ 0.34M/day; the conclusion (≈ 7% of the cap) does not change. Not in R7-7's list, so left until *k* is measured.
3. **§0.2 ruling A row** still reads "applied Tue 13 Oct". It records the 4 Oct Main Lane ruling, so I left it; the live gate is "ENT-CR1 verified" everywhere else.
4. **R7-2 placeholder list** beyond `CUSIP:` + zeros is my choice (`NAME:N/A`, `NAME:NA`, `NAME:NONE`). The 13 Oct check covers only `CUSIP:000000000`.

**Budget:** 0 D1 reads, 0 D1 writes, 0 deploys, 0 git writes. `MA-OCT-007.R14_Status.json` and `STATUS_BOARD.md` not edited (Main Lane owns state). Stop point reached; no reviews requested.
