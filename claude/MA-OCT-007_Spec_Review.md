# MA-OCT-007 rev 1.3 — Independent Spec Review (UX Lead + Data-Identity Lead)

```text
ISSUED BY:    Main Lane (Program Orchestrator) — packet MA-OCT-007.REV, Control v1
              0de0912f2b14c0ef45bdf6b4cc53a513119b49bc6fa3dddfbb78b87cb9e0f3a7,
              Task v1 ef7c5c292f050ea8e836a36ee9291d1de4d1c8e79216e745109a0bd1ccb1242d
EXECUTED BY:  REVIEW-007 — fresh Cowork session holding UX Lead + Data-Identity Lead (review lane)
REVIEWED BY:  n/a (this is the review)
APPROVED BY:  Founder (Mon 12 Oct gate)
INPUTS:       claude/MA-OCT-007_Spec.md rev 1.3                 332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e (772 lines)
              claude/packets/MA-OCT-007.R13_Report.md           47436fcc26bd934b986ab326bb8a06ece5430551de5092ad5fff74a1617ba203
              claude/MA-OCT-007_AppendixA_Results.md            a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa
              claude/MA-OCT-007_Spec_Brief.md (read as found)   d57ed1dcf77109b9283a16c596af415d69ad8562719b27c58baa9c001bebe2b8
              claude/MA-OCT-008_Spec.md rev 1.2 (§8 only)       bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3
              claude/MA-OCT-ENT-CR1_Index_Change_Request.md r1  fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20
              (all re-hashed on disk before reading; all match the Task)
VERDICT:      PASS WITH NOTES. The design is sound and fit for Founder approval on Mon 12 Oct.
              10 required items (R7-1 … R7-10), all doc-only, must be in rev 1.4 and hash-checked
              by the Main Lane before Phase 1 build starts (Wed 14 Oct). 12 non-blocking notes (N7-1 … N7-12).
```

**Independence.** This session authored none of the inputs: not the 007 spec or any of its revisions, not the R13 report, not the Appendix A results, not 008 and not ENT-CR1. ENT-CR1's requester is the Data-Identity Lead *role*; this session did not draft it, so reviewing O2 against it is not self-review. Not LANE-7, Main Lane, LANE-8 or LANE-11.

## 0. Method

- Whole-document read of rev 1.3 (§0–§15, Appendices A–B), from two hats as the Task assigns. Cross-read Appendix A results, the R13 report's four questions, 008 rev 1.2 §8.1–§8.3 and ENT-CR1 rev 1.
- Code spot-checks, read-only at `October-2026` / `16918e0` (no `.git/*.lock`; git read with `--no-optional-locks`):
  `App/Corporate Atlas/gate1-instrument-seed.js:51-95` (`deriveInstrumentKey`, seed loop); `App/Corporate Atlas/src/entities-api.js:162-261` (`/api/entities/:id` body); `App/ETF Refresh/src/index.js:282-345, 433-434` (stored-holdings response; `'000000000'` placeholder handling); `App/ETF Refresh/src/holdings-pipeline.js:825-900`; `App/ma-etf.js:1238-1239, 1935-1981, 2989-3025`; `grep` of `App/*.js` and `index.html` for `localStorage`, `location.hash`, `pushState`, `popstate`; `claude/MA-OCT-013_Spec_Brief.md:74-115` (redirect DDL); `claude/ReadPacks_2026-10_Query_Ledger.md` P5 row.
- 0 D1 reads, 0 D1 writes, no deploys, no git writes. The spec is not edited.

## 1. Assessment

**What is strong.** One NavLink contract for every source (§3.2) with a fixed state set and an explicit extensibility rule; canonical keys only (§3.1, AC3); honest states with source and confidence always visible and outages never shown as "unmatched" (§5.3); no auto-pick on ambiguity (§4.1); redirect handling that ships before 013 and degrades to an honest `gone` (§6); the ETF boundary routed through DOM events (ruling D); keyset paging with an honest capped count replacing a 75-row truncation shown as a total (E6); a zero-write front end (D4). The bond join with 008 (§3.6) matches 008 rev 1.2 §8.1–§8.3 line for line (no `status` filter, `idx_bil_entity`, per-CIK keyset in one `db.batch()`, global tuple cursor).

**Data facts now measured (Appendix A) that the spec should carry:** *M* = 32,769; bands live = high 22,314 (`isin_tier1` 100, `cusip_tier1` 90), medium 8,806 (`openfigi_tier1` 70), low 1,649 (`heuristic` **75**); worst issuer *n* = 871 (entity 28088), then 413 (225); 37 ambiguous ISINs, each exactly 2 entities; `lei_only` = 0; 0 dangling ids in `instrument_entity_map` and `entity_isin_map`.

**Where it falls short.** Ten doc-level gaps: one identity hazard the key derivation inherits (R7-2), an under-defined merge rule for the NavLink `source` (R7-3), a wrong description of the paging order that O5 rests on (R7-4), missing user-facing copy (R7-5), an unspecified Back/popstate contract that AC1 depends on (R7-6), read figures that contradict each other or are understated (R7-7), and four items from the author's own questions and contracts (R7-1, R7-8, R7-9, R7-10).

## 2. Required items (rev 1.4; before Phase 1 build, Wed 14 Oct)

**R7-1 — Close O2: composite index is decided** (Data-Identity; author Q1). *§7.3 lines 454–462; §11.1 line 567; §11.2 line 580; §12 line 596; §15.2 line 674; App. A Q3 line 709, P6/P6′/P7 lines 731–733; App. B line 765.*
ENT-CR1 rev 1 C1 is `CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key)`. Rev 1.4 must: mark O2 **Closed (ENT-CR1 rev 1 C1)**; change §7.3's "Exists today?" cell to "No → ENT-CR1 C1 `idx_iem_entity_key`"; turn the "Recommendation to the ruling-A CR owner" paragraph into a one-line decision record; name the index exactly in P6, P7 and the Q3 split plan (`idx_iem_entity_key`, not `idx_iem_entity…`); label §11.1's single-column column and P6′ "fallback only if ENT-CR1 RB-1 runs"; and replace "applied Tue 13 Oct" as the R2/R4 gate with ENT-CR1's own definition, **"ENT-CR1 verified" = C1 applied + E1, E2, E4 passed** (ENT-CR1 AR-3). E1 and E2 are 007's P6 and P7, so the gate check is already shared.

**R7-2 — Placeholder identifiers must not resolve to an issuer** (Data-Identity). *§2 E8 line 101; §3.1 line 120; §5.1 line 283; §4.1 bond rows; §14.1 T1/T2 lines 639–640.*
`deriveInstrumentKey` (`gate1-instrument-seed.js:51-62`) keys any trimmed CUSIP of ≥ 6 chars as `CUSIP:{cusip}`, with no placeholder check. The ETF pipeline itself treats `cusip = '000000000'` as "no CUSIP" (`ETF Refresh/src/index.js:433-434`, `holdings-pipeline.js:825-900`). So every ISIN-less holding with that placeholder (cash, derivatives, futures — concentrated in exactly the bond-ETF rows J1 newly covers, E4) derives the **same** key `CUSIP:000000000`; the seed's `seen` set keeps the first one's name. If that key has an `instrument_entity_map` row, R1 returns one issuer as `matched` for unrelated holdings — the silent wrong pick Goal 2 forbids. T1's byte-identical port (correctly) inherits the flaw, so the guard must live in R1, not in the port. Rev 1.4 must: (a) define a placeholder list (at least `CUSIP:000000000`; plus any all-zero CUSIP of length 6–9 and `NAME:N/A`-style keys) that R1 answers with `state: unmatched`, `reason: no_mapping` and **no candidates**, before any lookup; (b) have the ETF row emit the event but the card say "No unique identifier for this holding"; (c) add T1/T2 fixtures for it; (d) add a 2-read pre-build check to the P0 list: `SELECT instrument_key, security_name FROM instrument_master WHERE instrument_key = 'CUSIP:000000000'` and the same key on `instrument_entity_map` (PK reads, ≈ 2 rows). Weak `TICKER:` / `NAME:` keys are covered by N7-9.

**R7-3 — Define `source`, band and `as_of` for a de-duplicated candidate** (Data-Identity). *§5.1 step 5 line 288; §3.2 lines 154–158; §5.2 line 301; T9 line 647.*
Step 5 says "keep the highest confidence and list all sources", but the NavLink schema has one `source` string and one `source_table`, and §5.2's band rule depends on `source` (heuristic → low). A candidate seen as `heuristic` 75 in `instrument_entity_map` **and** `isin_direct` 100 in `entity_isin_map` is therefore undefined: high or low? T9 cannot test an undefined field. Rev 1.4 must state: `source`, `source_table`, `confidence` and `as_of` come from the single highest-confidence row (ties: non-heuristic first, then `instrument_entity_map` first); the band is computed from that row; the other rows go in an additive `also_sources: [{source, source_table, confidence}]` array (an additive field, allowed by §3.2's extensibility rule). Add the corroboration case to T2.

**R7-4 — O5: correct the paging-order description and the grouping rule** (UX; answers O5, §3). *§7.2 line 450; §4.2 lines 255–259; §15.2 line 677.*
The text says `instrument_key` order is "ISIN-first, then `CUSIP:…`, `TICKER:…`". It is not: SQLite's binary order interleaves the prefixed keys with ISIN country codes — `CA…` < **`CUSIP:…`** < `DE…` < … < **`NAME:…`** < `NL…` < … < **`TICKER:…`** < `US…`. For a typical US issuer, page 1 is CUSIP-only bonds, then name- and ticker-keyed rows, and its US-ISIN equities and bonds come last. And "grouped by asset type inside each page" makes "Show 25 more" append a second set of the same group headers below the first. Rev 1.4 must: correct the description; and replace the grouping rule with — **single-page issuers** (`next_cursor = null` on page 1; most issuers, *n* ≤ 25): the client sorts all rows by asset type, then name, with group headers (today's order, no cost); **multi-page issuers**: a flat list in key order, an asset-type badge on every row, no per-page group headers, and a small "Sorted by identifier" label. The server-side `asset_cat` filter stays P1 (note its cost: `asset_cat` is on `instrument_master`, so a filtered page reads up to the issuer's *n* map rows; ≤ 871 live, ≪ 50k).

**R7-5 — User-facing copy for every state and reason** (UX). *§4.1 lines 238–243; §5.3 lines 311–317; §6.4–§6.5 lines 373, 378; AC7 line 551.*
Only `isin_duplicate` (UAT step 6) and `gone` have user text. Rev 1.4 needs one table mapping every `state` × `reason` (incl. `source_conflict`, `not_in_universe`, `no_mapping`, `lei_only`, `redirect_unresolved`/`redirect_too_deep`/`redirect_cycle`, `gone`, network failure, and R7-2's placeholder case) to badge text, a one-line explanation and the action offered. `source_conflict` must not reuse "several issuers share this ISIN" (suggest "Our sources disagree about the issuer"). Machine codes never show raw. AC7 checks against this table.

**R7-6 — Back-button and history contract** (UX). *§3.3 lines 172–174; §4.4 lines 268–275; AC1 lines 518–521; UAT steps 2, 3, 9.*
The app has no routing today (E1; confirmed: no `location.hash`, `pushState` or `popstate` in `App/`). §3.3 pushes a history entry per in-app navigation but never says what `popstate` does, and §3.3's "unknown route → home screen" would, read literally, send a Back to the no-hash entry *home* — re-rendering the ETF panel and failing AC1's "holdings did not reload". Rev 1.4 must state: one history entry per overlay layer (1:1 with the overlay stack); `popstate` to an entry with **no route** closes overlays down to the base panel and never re-renders it; `popstate` to a route already in the stack closes the layers above it; only a cold load or a hand-typed hash dispatches a fresh route; the router listens to both `popstate` and `hashchange`; the in-app "← Back" calls `history.back()` so the two can never diverge (§4.4's last line). Add a T7 case: Back × N from a 3-deep stack, then once more leaves the overlays without reloading holdings.

**R7-7 — Read figures: fix the contradictions and measure the per-row multiplier** (Data-Identity; answers author Q4 in part). *AC2 line 526; §7.2 R1/R5 lines 401, 405; §11.1 lines 569–576; A.3 P6 line 731.*
(a) AC2 requires `rows_read` ≤ 100 for a page-2+ call, but §11.1 itself gives ≈ 202 at `limit=100`. (b) The ≈ 52/page figure counts 1 read per row per table. R2 selects `iem.source, confidence, created_at`, which the composite index does not cover, and joins `instrument_master` through its TEXT-PK autoindex; whether D1 counts the index entry *and* the table row is unmeasured (Appendix A measured 1× for covering-index scans and ≈ 2× for rowid scan + PK lookup, never a non-covering index search). A page could read ≈ 52–104 (limit 25) or ≈ 202–404 (limit 100). (c) R1's "≤ 32 worst" omits the per-candidate redirect cost: 10 candidates × ≤ 7 redirect reads alone is 70, so the worst case is ≈ 95–110 by the spec's own counting, and R5's worst is ≈ 4.8k–5.5k, not 1,600. All of these stay far below 50k, so the design is fine; the declared figures are not. Rev 1.4 must: state AC2's bound as a formula, `≤ k × 2 × (limit + 1)` with *k* measured; add one measured R2 execution on entity 28088 at `limit=25` and `limit=100` (≈ 60–410 reads) to the P6 step on 13 Oct, after ENT-CR1 E1, and set *k* from it; correct R1's worst to ≈ 110 and R5's to ≈ 5.5k in §7.2 and §11.1. AC8's ≤ 1,100 for a first view survives even at *k* = 2 (871 covering-count + ≈ 104 + 1 ≈ 976).

**R7-8 — `lei_only`: wording and fixtures, not live data** (author Q2). *AC7 line 551; UAT step 7 line 620; §4.1 line 243.*
Q6 measured 0 rows with `entity_id IS NULL`. Keep `lei_only` in the contract (011 adds LEIs, and a future GLEIF/FIRDS seed can create unlinked rows); prove it in T2 with the stub D1, which already lists every reason; remove `lei_only` from AC7's live-UAT list and mark it "unit-tested (T2); no live rows on 9 Oct". Change UAT step 7's example to `no_mapping` ("No issuer linked — no mapping exists for this instrument yet"). Also fix AC7's source: Q4–Q6 do not yield UAT instruments for `low_confidence`, `unmatched` or `not_in_universe` (only Q5 yields one); say instead that the build lane picks them in the preview (a holding whose card shows that state) and confirms each with one R1 call on UAT day. No production fixture rows (D4, no writes).

**R7-9 — Heuristic confidence is 75 live; make the band rule visible** (UX + Data-Identity; author Q3). *§4.1 line 241; §5.2 lines 301–309; §15.1 Q2 line 666; UAT step 5 line 618.*
Change the example to "matched by heuristic, confidence 75". Because 75 > OpenFIGI's 70, users will see "Low · heuristic · 75" beside "Medium · OpenFIGI · 70"; the source override is load-bearing and must be explained, not just applied. Rev 1.4 must: add the live confidences to §5.2's "Today's sources" column; make the low-band reason line say *why* ("Name-based match (heuristic), score 75 — not verified by an identifier"); and restate Q2 so it covers both facts (OpenFIGI 70 → medium; heuristic 75 → low by source). The Main Lane should put that second fact into the Founder's Q2 Decision Request on 12 Oct even if rev 1.4 is not yet on disk.

**R7-10 — Complete the `from` origin grammar** (UX + Data-Identity; cross-packet contract with 009/010). *§3.3 line 170; §3.5 line 189.*
§3.5 tells 010 to link with `?from=bond:{key}`, but the grammar lists only `etf | entity | instrument | direct`. Keys themselves contain `:` (`CUSIP:…`, `TICKER:…`), so `instrument:CUSIP:594918AB0` is ambiguous to a naive split. Rev 1.4 must add `bond:{instrument_key}`, define the parse (the whole `from` value is one `encodeURIComponent` string; split once on the first `:` to get the type; for `etf`, split the remainder on the **last** `:` for the tab), and say an unknown type falls back to `direct` (Back → home).

## 3. Non-blocking notes

- **N7-1 (UX) Overlay stack growth.** J2 → card → issuer → card … can stack unbounded overlays. When the target entity/instrument is already in the stack, pop back to it instead of pushing a duplicate; cap depth (e.g. 8) by collapsing the oldest. §4.4.
- **N7-2 (UX, accessibility).** The ETF icon is a `<span onclick>` with a `title` (`ma-etf.js:1973-1977`): not focusable and its state lives in a tooltip. Make it a `<button>` with an `aria-label` carrying the full state text ("Issuer: low confidence, heuristic, 75"). On overlay open, move focus to its heading; `Esc` = Back; on close, return focus to the originating icon. Add these to T7. Amber vs orange is a weak pair; the text and glyph (`e!` / `e?`) carry it, which §5.3 already requires.
- **N7-3 (UX/ETF boundary) Stale restyles.** Today `entityIconAbortController` cancels in-flight lookups on ETF switch (`ma-etf.js:1190-1191, 3000`). Keep parity: `ma-etf.js` restyles only rows of the currently rendered ETF, matched by a `data-instrument-key` attribute, and ignores `ma:instrument-state` for keys not on screen. Define the pre-click icon look (neutral "e"). (ETF-screen consent itself is MA-OCT-007.ETF.)
- **N7-4 (UX) "Merged into" notice copy.** Keep both ids; move "(MA-OCT-013)" into secondary text or a details line — the packet id is internal vocabulary. §6.4 line 369.
- **N7-5 (Data-Identity, for 008/009) Cross-key bond gap.** An ETF-held US bond with an ISIN is keyed by ISIN in `instrument_master`; if its SEC filing carries only a CUSIP, 008 keys it `CUSIP:{cusip}`. R1f then misses it and `source_conflict` can never fire. US/CA ISINs embed the CUSIP (chars 3–11): R1f could also probe the derived form, or 008 could store the derived ISIN. Also: `filing_status = 'final'` must stay a SQL **literal** in R1f and in 009's step 2 — bound as a parameter, the partial indexes `idx_bi_instrument` / `idx_bi_cik_final_key` cannot be used (P10 and P-B1 would catch it). §3.6, §5.1 step 3a.
- **N7-6 (Data-Identity) Narrow the missing-table catch.** §6.2 step 6 must match only `no such table: entity_merge_redirect`; any other D1 error stays a 5xx so the front end shows "retry", never `gone` (§5.3's outage rule). Today's 404 body is `{ "error": "Not found" }` (`entities-api.js:218`); the new body changes it — confirm no caller parses the old string (`ma-13f.js:535` uses the overlay).
- **N7-7 (Data-Identity) Scope AC8.** "An issuer page view" also calls unchanged routes (`/issuer-panels`, `/graph`, `/etf-exposure`) and `handleEntity`'s own fund-manager and FIRDS lookups (`entities-api.js:221-251`). Word AC8 as "007's new and extended calls (R3 + R2 + R4)".
- **N7-8 (UX) UAT fixture robustness.** Step 6: pick two of the 37 ambiguous ISINs and re-run R1 on UAT day — 013 merges between 17 and 29 Oct can collapse a twin pair into one candidate (§5.1 note). Step 8: use entity 28088 (*n* = 871) or 225 (413). Step 11: confirm the id is still absent from both `entity_master` and `entity_merge_redirect` on UAT day (2 PK reads), so the step is independent of any later backfill (see O3).
- **N7-9 (Data-Identity) Name the holding-row field mapping.** The stored-holdings response passes raw `isin, cusip, security_ticker, security_name` (`ETF Refresh/src/index.js:307`), aliased in `ma-etf.js:1238-1239` to `symbol` / `name`. §3.1 should say `data_instrumentKey` receives `{isin: h.isin, cusip: h.cusip, security_ticker: h.symbol, security_name: h.name}` — raw values, never the rendered `"—"` (`ma-etf.js:1941`) — and that the port must not "improve" the seed (no uppercasing of ISIN/CUSIP). `TICKER:` and `NAME:` keys are weak identities; the card should show the key form ("identified by name only") so users can judge them.
- **N7-10 (Data-Identity) `?isin=` provenance.** When R1c uses the caller's `?isin=` (R1a has no ISIN), the provenance strip/card should say "ISIN from the ETF holding", so a mapping found through a holding-row ISIN is not presented as an instrument-master fact. §7.2 line 416.
- **N7-11 (Data-Identity) Reason precedence.** If both conditions hold (two `entity_isin_map` rows *and* `instrument_entity_map` disagrees), §5.1's table gives two reasons. State one (suggest `isin_duplicate`) and add the case to T2.
- **N7-12 (Data-Identity; author Q4) Appendix A is historical.** Add one line: the 9 Oct standing rule (grouped/sorted statements without a covering index estimated at 2.5 × N and split to ≤ 45k) supersedes A.1/A.2's estimates for any re-run. R1–R4 have no temp B-tree after the index (P6, P7), so §11 is unaffected; only the P6′ fallback would be (≈ 2.5 × 871 ≈ 2.2k per page at worst, still ≪ 50k).

## 4. Answers

**O2 — composite or single-column?** **Composite, closed.** ENT-CR1 rev 1 C1 already specifies `idx_iem_entity_key (entity_id, instrument_key)`. Data-Identity confirms it serves every `entity_id = ?` reader the single column would: 013's repoint lookup (ENT-CR1 E4, covering), R4 (E2, covering) and today's `/instruments` route (E3); it gives R2 one page in key order with no temp B-tree (E1 = P6); the write cost is the same ≈ 32.8k. The gate for R2/R4 is "ENT-CR1 verified" (C1 + E1/E2/E4), not the calendar date. Recorded as R7-1.

**O3 — backfill `entity_merge_redirect` for the ≈ 2,600 MA-SEP-001/007 losers?** **No, not in October; 007 does not need it.** (1) There is no reader: before 007 the app had no deep links and no routing (E1, confirmed), and no module persists entity ids (`localStorage` holds only UI flags, the market watchlist of symbols and the Ops tab), so no URL, bookmark or saved state can carry a pre-013 loser id. (2) The pairs exist only in repo SQL "not verified against what executed" (E11); a wrong redirect silently lands a user on the wrong issuer, which is worse than an honest `gone`. (3) The mapping layer holds no loser ids (Q7/Q8 = 0). (4) It would cost ≈ 2.6k writes plus validation reads for no user benefit. If evidence of real stale references ever appears, the backfill belongs to the table owner (013 / Data-Identity Lead) and must validate each pair (duplicate absent from `entity_master`; survivor present, resolved to its final survivor so chains stay 1 hop), use `packet = 'MA-SEP-001' | 'MA-SEP-007'` and the historical `merged_at`, and `INSERT OR IGNORE` in `db.batch()`. Keep §6.5's fallback as designed.

**O5 — is `instrument_key` order acceptable for linked instruments?** **Yes, with conditions** (R7-4). Keyset paging needs a stable indexed order and live issuers are small (most *n* ≤ 25; worst 871), so the cost argument holds. But the spec misdescribes the order, and per-page grouping breaks under "Show 25 more". Accept on: corrected description; single-page issuers sorted client-side by asset type then name (most issuers see today's order); multi-page issuers shown flat in key order with per-row asset-type badges and a "Sorted by identifier" label; `asset_cat` filter as P1.

**Author's four questions (R13 report §Questions):**
1. **Close O2?** Yes — in rev 1.4, with the edits listed in R7-1.
2. **`lei_only` has 0 live rows — fixture or wording?** Both, split by layer: keep the reason in the contract; prove it with the T2 stub-D1 fixture; change AC7 and UAT step 7 wording to live-available reasons (`no_mapping`). No fixture rows in production D1. (R7-8.)
3. **Heuristic confidence is 75, not 55?** Correct the §4.1 example to 75, and go further: explain the source override on screen and in Q2, since 75-low beside 70-medium will otherwise look like a bug. (R7-9.)
4. **2.5 × N multiplier for grouped queries?** It applies to Appendix A-style grouped or sorted scans and to the P6′ fallback, not to R1–R4 after the index (no temp B-tree in P6/P7). Add the one-line supersession note (N7-12). The open multiplier that *does* matter for live routes is the per-row index-plus-table count, which is unmeasured — R7-7 measures it on 13 Oct.

## 5. Reviewer view on Founder questions Q1–Q3 (the Founder decides)

- **Q1 — ticket-button authentication.** Agree with **(a) Access-gated link-out**. (b) hides the button for everyone and fails AC5; (c) breaks D4. UX caveat: the tab change and sign-in wall are a context break, acceptable for an operator-only action; label the button so nobody is surprised ("Report mapping problem — opens Ops, sign-in required") and open it in a new tab so the card stays put.
- **Q2 — OpenFIGI 70 as "medium".** Agree **Yes**, provided the Founder also sees that heuristic rows (1,649, confidence 75) are shown as **Low** by source although their number is higher. Recommend keeping that override: a name-based match is unverified by any identifier. (R7-9.)
- **Q3 — auto-pick on ambiguous ISINs.** Agree **No**. Live data makes the chooser cheap: 37 ISINs, exactly 2 candidates each. Auto-picking would recreate today's silent `LIMIT 1`.

## 6. Counts

| | Count | IDs |
|---|---|---|
| Required (rev 1.4, before Phase 1 build) | **10** | R7-1 … R7-10 |
| Non-blocking | **12** | N7-1 … N7-12 |
| Questions answered | O2, O3, O5; author Q1–Q4; reviewer view Q1–Q3 | §4, §5 |

Out of scope and not reviewed: §9's ETF-screen consent (O6), which is MA-OCT-007.ETF.

---

## Rev 1.4 delta check (10 Oct)

```text
PACKET:       MA-OCT-007.R14C-UXDI, Control v1 0a52bc401bbb51a246297292fa79838382e07bbca138d3f63c150e7b93530c47,
              Task v1 62788dc8f77bad41ec15912573dcebccd930709bda01df59ba446e5d76c5dc3c (both match STATUS_BOARD / Control)
EXECUTED BY:  REVIEW-007 (UX Lead + Data-Identity Lead, review lane). Fresh Cowork session. It did not author 007 at any revision,
              the R14 edit or this file's sections 0–6. Independence holds.
INPUTS:       claude/MA-OCT-007_Spec.md rev 1.4               4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c (818 lines)
              claude/packets/MA-OCT-007_Spec_rev1.3.md        332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e (772 lines)
              claude/packets/MA-OCT-007.R14_Report.md         e764891dffe3f49adf4545e3a86092fd47f8eee43fb746b09e730f300718a14a
              claude/MA-OCT-007_Spec_Review.md (before append) 79a852cad56864bfee39e1d3d3e404995200c978a586205390243100b70b035b
              (all re-hashed on disk; all match the Task)
METHOD:       diff -u rev1.3-copy → rev 1.4: 28 hunks, matching the R14 report's hunk table one for one.
              Each R7 item was checked against rev 1.4 text, and line numbers were confirmed by reading.
              Spot-check: App/Corporate Atlas/gate1-instrument-seed.js:51-62 (deriveInstrumentKey) for the placeholder list.
              October-2026 @ 16918e0, no .git/*.lock, git read with --no-optional-locks. 0 D1 reads, 0 writes, no deploys, no git writes.
VERDICT:      PASS WITH NOTES. All 10 required items are MET and no unlisted change was found. 4 non-blocking notes (N7-13 … N7-16).
```

### Required items

| Item | Result | Evidence (rev 1.4 lines) |
|---|---|---|
| R7-1 O2 closed, composite index | **MET** | §7.3 row 501 ("No → ENT-CR1 C1 `idx_iem_entity_key`" + "ENT-CR1 verified" gate) and the decision line 503 (the recommendation paragraph is gone). §11.1 fallback label 609. §11.2 gate 622. §12 P0/Phase 1 640–641. §15.2 O2 closed 718. Index named exactly in Q3 755, P6 777, P7 779. P6′ fallback label 778. App. B 811. §0.2 line 50 keeps the 4 Oct "applied Tue 13 Oct" wording as a ruling record, not as the gate (Q3 below). |
| R7-2 Placeholder keys | **MET** | E8 note 103. List and R1 behaviour 124 (`CUSIP:` + 6–9 zeros, `NAME:N/A`/`NA`/`NONE`; `unmatched`/`no_mapping`/no candidates/before any lookup). The ETF row still emits the event and the card copy is at 124 and §5.4 350. §5.1 step 0, no D1 read, 299. T1 fixtures 683, T2 684. P0 2-read check 640. Confirmed in code: the seed only trims, uppercases names and turns whitespace into `_`, so `CUSIP:000000000` and `NAME:N/A` are keys it really produces. |
| R7-3 Primary-row rule | **MET** | §3.2 `source`/`source_table` 161, `also_sources` 162 (additive), `as_of` 165. §5.1 step 5 305: highest-confidence row, ties non-heuristic then `instrument_entity_map`, band from that row. §5.2 note 328. T2 corroboration case 684. T9 691. |
| R7-4 Order and grouping | **MET** | §7.2 291 (the "ISIN-first" text is replaced by the binary-order interleave; `asset_cat` filter cost ≤ 871). §4.2 274 (single-page sort with headers; multi-page flat list, per-row badge, "Sorted by identifier"; no per-page headers). §15.2 O5 closed 721. No "grouped inside each page" text remains. |
| R7-5 Copy table | **MET** | §5.4 338–358 covers every state × reason I listed, including the placeholder, `source_conflict` with its own wording, all three redirect failures, `gone`, the merged chip and network. It has source labels and states that machine codes are never shown. §4.1 258 and AC7 592 point to it. |
| R7-6 History contract | **MET** | §3.3 181–188: one entry per layer; `popstate` with no route closes overlays without re-rendering (incl. `#etfHoldingsContent`); `popstate` to a stacked route closes the layers above; only a cold load or typed hash dispatches; listens to `popstate` + `hashchange`; "← Back" = `history.back()`. The invalid-link toast is limited to a cold load or typed hash (189). §4.4 291. T7 case 689. See N7-13 for the cold-load edge. |
| R7-7 Read figures | **MET** | AC2 567 = `k × 2 × (limit + 1)`, provisional. §7.2 R1 worst ≈ 110 at 441, R2 ≈ 52–104 at 442, R5 worst ≈ 5.5k at 445. §11.1 611–618: first view ≈ *n* + 52*k* + 1 = 924 / 976 for entity 28088, inside AC8's 1,100. The *k* measurement (28088 at `limit` 25 and 100, after E1) is at P0 640 and P6 777. Arithmetic re-run: 871 + 52 + 1 = 924; 871 + 104 + 1 = 976. |
| R7-8 `lei_only` | **MET** | Kept in the contract (§3.2 reason list). Proven by T2 (684). Off AC7's live list with "no live rows on 9 Oct" (592–593). AC7's source is corrected: Q5 for ambiguous, the others picked in the preview and confirmed with R1 on UAT day, no production fixtures. UAT step 7 example → `no_mapping` (664). §4.1 258. |
| R7-9 Heuristic 75 | **MET** | §4.1 example 256. §5.2 live confidences and counts 324–326 (high 18,563 + 3,751 = 22,314 ✓; 8,806; 1,649 ✓; sum 32,769 = *M* ✓). Reason line explains *why* at 328 and §5.4. Q2 restated to cover both facts (710). UAT step 5 (662). |
| R7-10 `from` grammar | **MET** | §3.3 177 adds `bond:{instrument_key}`. The parse rule is at 178: one encoded string, split once on the first `:`, `etf` split on the last `:`, and `entity` likewise, which is a sensible extension. Unknown type → `direct`. §3.5 204 uses `encodeURIComponent('bond:' + key)`. |

**Unlisted changes:** none. Every hunk maps to an item or note in the R14 report's table. Two applied notes go slightly beyond my wording, and both are acceptable. N7-9 uses the port's own parameter names (`ticker`, `name`) rather than the raw response names, which is consistent with §3.1's `data_instrumentKey({isin, cusip, ticker, name})`. R7-10's parse rule also covers `entity`.

### Answers to the author's four questions (R14 report §Questions)

1. **`placeholder_key: true` or a dedicated reason code?** **Keep the additive flag.** A placeholder really does have no mapping. The reason list is a closed vocabulary that AC7, T2 and 008/009 conformance depend on. An additive field is allowed by §3.2's extensibility rule, and a new reason is not needed. Condition (N7-14, non-blocking): add the field to the §3.2 field table, because T9 already validates it but the contract table does not list it. Define it as always present and `false` by default, so the schema is fixed.
2. **§11.3 left at *k* = 1 until measured?** **Accept.** It is a planning line, and at *k* = 2 it is ≈ 300 × 1,106 + 6,000 ≈ 0.34M/day (≈ 7% of the cap), so the conclusion holds. Update it in the same pass that writes the measured *k* into AC2 (N7-15). AC8 holds for *k* ≤ 4 (871 + 208 + 1 = 1,080). If the 13 Oct measurement gives *k* > 4, AC8 needs re-stating before the build.
3. **§0.2 ruling-A row kept as history?** **Accept.** R7-1 asked to replace the date *as the R2/R4 gate*, and every gate statement (§7.3, §11.2, §12, App. B) now says "ENT-CR1 verified". The row records the 4 Oct ruling, but it sits under "binding on this spec", so at the next touch append "(gate superseded by 'ENT-CR1 verified', §11.2)" (N7-16). It does not block approval.
4. **Extra placeholder keys `NAME:N/A`, `NAME:NA`, `NAME:NONE`?** **Accept.** The seed code confirms these are exactly the forms it emits for those names: the slash survives and only whitespace becomes `_`. A `NAME:` key arises only when there is no ISIN, CUSIP or ticker, so no identifiable security can be suppressed by the list. Keep it a fixed literal list, and extend it only on evidence. The 13 Oct check could cheaply cover the whole list in one `IN (…)` per table (7 keys × 2 PK lookups ≈ 14 reads) rather than `CUSIP:000000000` alone. That is optional, at LANE-1-ENG's discretion.

### New non-blocking notes

- **N7-13 (UX) Cold-load Back.** §4.4's last row says Back from a cold-loaded deep link goes to home or `from`. But with "← Back" = `history.back()` and one entry per layer, a cold load has no in-app entry beneath it, so Back leaves the site, or does nothing in a fresh tab. This gap comes from my own R7-6 wording. Fix in the build brief or at the next touch: on a cold load, the router first `replaceState`s a no-route base entry (rebuilt from `from`, else home) and then `pushState`s the deep-link route, so the R7-6 rules apply unchanged. Add it to T7 alongside UAT step 10.
- **N7-14 (Data-Identity)** `placeholder_key` row in §3.2 (see Q1).
- **N7-15 (Data-Identity)** Refresh §11.3 with the measured *k*; re-state AC8 if *k* > 4 (see Q2).
- **N7-16 (Data-Identity)** Superseded-gate pointer on §0.2 ruling A (see Q3).

Deferred notes from the original review (N7-1 … N7-4, N7-6, N7-7) stay open as build-lane items. Their deferral is accepted. None of them blocks the 12 Oct approval.

**Overall: PASS WITH NOTES.** From the UX and Data-Identity side, rev 1.4 (`4d4fffef…397c`) is fit for the Founder's single 007 approval on Mon 12 Oct. The R7-7 constant *k* and the R7-2 pre-build check stay gated on Tue 13 Oct as the spec states.
