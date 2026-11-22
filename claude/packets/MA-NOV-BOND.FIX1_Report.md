# MA-NOV-BOND.FIX1 — Bond parser 1.3.0: F1, F2, F3, F4, F7, F8 (local only) — Report

```text
PACKET:   MA-NOV-BOND.FIX1 · Control v1 (169615f2…7a61) · Task v1 (c55b1745…8b02) — both verified
RUN:      r-20261122T095847Z-6db3 · interactive · 2026-11-22 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Engineering Lead
OUTCOME:  DONE — parser bonds-1.3.0; 70/70 bond tests (52 existing + 18 new); offline corpus re-parse, 0 writes
PINS:     spec v2 c4281815…aef ✓ · spec v1 b30a75ce…2e53 ✓ · bonds-parse.mjs blob at HEAD 09a57db5…16d9 ✓
D1 / SEC: 0 D1 calls (0 of the 4 allowed SELECTs used) · 0 SEC or other network requests · 0 installs · 0 subagents
FILES:    bonds-parse.mjs        7226bec0…a06df (blob 89db5207…501eb)
          bonds-ingest.mjs       4f56caf4…d472d
          tests/bonds-fix1.test.mjs a836b9ff…bda1e (new) · tests/bonds-parse.test.mjs (2 assertions, §4)
          fixtures/manifest.json ac3bcc33…8b25 + 11 new .htm.gz fixtures copied from state/cache
```

## 1 Changes per fix

All changes are in `bonds-parse.mjs`, except F2, which is in the runner (`bonds-ingest.mjs`). `PARSER_VERSION` is now `bonds-1.3.0`. No change was made to `bonds-lib.mjs`.

| Fix | Change | Where |
|---|---|---|
| **F1** Title gate for drafts | A 424B draft (R2 / R2b / B-1b) now passes the existing other → structured → non-debt classifier before it is called `preliminary`. A structured draft becomes `skipped_structured` with reason `draft_structured`. A non-debt draft becomes `skipped_non_debt` with reason `draft_not_debt`. A rule-1 "other" draft gets that rule's own reason; the only case in the corpus is the NextEra remarketing draft, which gets `remarketing`. The rule is recorded as `F1 <R2…> / <7.3-x>`. A debt draft stays `preliminary` and reports `draftLines`, the number of tranche lines on its cover. | `parseFiling`, `draftTrancheLines` |
| **F2** Deal-level draft → final match | New exported `linkDrafts(filings, { parentOf })`. A draft is `superseded` by a final 424B (status `debt`, with at least one tranche row) when all of these hold: same issuer family (the polled issuer, plus co-registrant CIK → parent via `parentOf`), same shelf file number, filed 0–14 days after the draft, and the final's tranche count ≥ the draft's cover lines. The nearest such final wins. The draft row gets `status_reason` and `superseded_by`; otherwise it gets `draft_no_final` and `superseded_by: null`. The runner calls it after discovery, with `parentOf` built from the run's co-registrants, and logs `draft_links`. Every `filing` log entry now has `status_reasons`, and `filingsOut` carries `draft_lines`. | `bonds-ingest.mjs` |
| **F3** Programme supplements | Rule 5 (iv) `PROGRAM`, read from the first 3,000 characters, matches three wordings: "plan to offer and sell notes with various terms", "With Maturities of / Due / due from 9 (Nine) Months or More / to N Years from Date of Issue". It turns a filing into `skipped_other`, rule `7.3-5iv`, reason `program_supplement`, but only when the filing priced nothing: no tranche found, or no tranche with both a principal and a full maturity. It is also added to `classifyTitle`'s no-title branch. | `classifyTitle`, `parseFiling` |
| **F4** Maturity wording | `MATURES` now also matches "will mature as to principal on" (Duke). `findMaturity` keeps the 1.2.0 rule first, so any date 1.2.0 resolved is unchanged. Only where 1.2.0 found no single date: (a) a lead-in naming "the <year> Notes" also names the tranche; (b) if the named statements still disagree, a labelled "Maturity Date(s)" statement decides, and a note `maturity statements disagree (…); labelled "Maturity Date" statement taken (…)` goes into `notes`. | `MATURES`, `findMaturity` |
| **F7** Remarketing | `REMARKETED` ("This is a remarketing of" / "is/are being remarketed", first 3,000 characters) runs straight after rule 1 → `skipped_other`, rule `7.3-1 F7`, reason `remarketing`. It reproduces R-4 (`bonds-1.2.0-r4`) from the parser. Equity-unit covers, which describe a *future* remarketing, are not matched: Duke equity units stay `equity`. | `classifyTitle` |
| **F8** Reason codes | Every whole-filing row carries `status_reason` from the spec v1 §5 vocabulary: `draft_no_final`, `draft_not_debt`, `draft_structured`, `structured`, `equity`, `stock_plan`, `exchange_offer`, `merger_document`, `demand_note`, `remarketing`, `resale`, `program_supplement`, `no_tranche`. Rule 1's reason is taken from the matched words (exchange / remarket / resale). A `parse_failed` tranche gets one code: `fwp_conflict`, then `no_maturity`, then `no_principal`, then `low_confidence`. A final tranche gets `null` (complete) or `'partial'` plus `missing[]` ⊂ {`cusip`, `coupon`, `spread`}. These fields, like `path`/`fail_reason`, are **not in `COLS`**: the INSERT SQL is unchanged, and a test asserts it. | rows in `parseFiling` |

## 2 Tests

`node --test "App/Corporate Atlas/bonds/tests/"` → **70 tests, 70 pass, 0 fail.** That is the 52 existing tests plus 18 in the new `tests/bonds-fix1.test.mjs`.

New fixtures were copied from `state/cache/` (gzip, `html_sha256` over the decompressed HTML, as before). Each manifest entry says "fetched: cache … 0 SEC requests".

| Fix | Fixtures | Tests |
|---|---|---|
| F1 | existing `duke-424b5-prelim-2026-08-10`; new `boeing-424b5-prelim-common-2024-10-28` and `wells-424b2-prelim-structured-2026-10-01` | 3 tests: equity drafts → `draft_not_debt`; WF draft → `draft_structured`; UNH, ICE and NextEra debt drafts stay preliminary with line counts 4, 5 and 1 |
| F2 | existing UNH and ICE pairs; new `nextera-424b5-prelim-series-q-2024-02-27` + `nextera-424b5-final-series-q-2024-02-28` | 5 tests: UNH superseded (gap 1, 4 ≤ 4); ICE not linked (5 > 4, §4); NextEra family, both through the polled parent and through `parentOf`; negatives (other shelf, > 14 days, earlier final, other issuer; nearest final wins); runner dry run puts `superseded` + `superseded_by` in the record but not in the SQL |
| F3 | new `cat-424b2-program-series-l-2026-03-27`, `toyota-424b2-program-series-b-2024-01-22`, `gm-424b5-program-term-notes-2025-12-05` | 2 tests: all three → `program_supplement`; four priced Cat, Toyota and Deere drawdowns still final |
| F4 | new `gm-424b2-year-only-maturity-2025-05-28`, `duke-424b5-reset-junior-sub-2024-08-20` | 2 tests: GM gives 3 finals, 2027-07-15 / 2030-07-15 / 2035-07-15, with the disagreement notes on tranches 1–2; Duke gives a final maturing 2054-09-01 |
| F7 | new `nextera-424b2-remarketing-2025-07-30`, `nextera-424b5-prelim-remarketing-2025-07-29` | 1 test: both → `remarketing`; Duke equity units stay `equity` |
| F8 | all 43 fixtures | 4 tests: every row on every fixture has a §5 code, or `null`/`partial` with `missing`; specific codes; synthetic `no_maturity` / `no_principal` / `fwp_conflict`; `no_tranche` |

## 3 Offline before/after (whole cached corpus, 0 writes)

**Method.** The run used a scratchpad harness, not the runner's `--dry-run --offline` (see §4.4). It parses every cached 424B with the parser at HEAD (1.2.0, from `git show`) and with 1.3.0. It pairs same-deal FWPs as the runner does (`sameDealFwps` logic, 3 days, using the discovery FWP list), takes the co-registrant row CIK from the snapshot, and then runs the runner's own `linkDrafts`.

The corpus is the 632 filings of the 15 Oct snapshot plus the 21 Wells Fargo filings from the 16 Oct live run: **653 filings, all cached**, 964 rows. It reads only `state/` and writes only to the scratchpad. Outputs: `before.json` f867135a…cf94, `after.json` 16de4748…cf2d4, `diff.txt` c877eb25…63dd, harness `run.mjs` 4b769899…c0cf, `corpus.mjs` e7252693…79a0, `diff.mjs` e9a445e4…b53cf855.

| Class | 1.2.0 | 1.3.0 | 1.3.0 by reason |
|---|---|---|---|
| final | 633 | **635** | complete 276 · partial 359 (cusip 354, cusip+coupon 5) |
| preliminary | 198 | **151** | superseded 143 · draft_no_final 8 |
| skipped_structured | 28 | 65 | structured 28 · draft_structured 37 |
| skipped_non_debt | 45 | 54 | equity 44 · stock_plan 1 · draft_not_debt 9 |
| skipped_other | 51 | 56 | demand_note 39 · exchange_offer 6 · merger_document 5 · program_supplement 3 · remarketing 2 · resale 1 |
| parse_failed | 9 | **3** | fwp_conflict 3 (Verizon 2035; Dominion 2025 and 2026 Series B — these are F5, FIX2) |
| **rows without a reason (T1)** | all 331 non-final | **0** | |

**Rows whose class changed: 57, all listed:**
- **F1 → `skipped_structured`/`draft_structured` (37, all Wells Fargo 424B2 preliminary pricing supplements):**
  - 1 Oct: 0001839882-26-048961, -048973
  - 2 Oct: -049462
  - 5 Oct: -049624, -049627, -049643, -049644
  - 6 Oct: -049777, -049778, -049840, -049847, -049849
  - 7 Oct: -049982, -049998, -050010, -050014
  - 9 Oct: -050373, -050395, -050407, -050409, -050410, -050411
  - 13 Oct: -050506, -050613, -050614, -050651, -050652, -050657, -050658, -050664
  - 14 Oct: -050796, -050826, -050847, -050848
  - 16 Oct: -050981, -051026, -051144

  The other 11 WF drafts are fixed-rate callable notes and stay drafts.
- **F1 → `skipped_non_debt`/`draft_not_debt` (9):**
  - AmEx 0001104659-26-090782 (depositary shares)
  - Oracle 0001193125-26-032654 (depositary shares)
  - Boeing 0001193125-24-244582 (common) and -244584 (depositary)
  - Duke 0001104659-26-093014 (equity units)
  - Southern 0000092122-25-000088 (equity units)
  - NextEra 0001193125-24-162712, -24-245703, -26-073385 (equity units)
- **F1 + F7 → `skipped_other`/`remarketing` (1):** NextEra draft 0001193125-25-167246.
- **F7 (2 row changes, 1 filing):** NextEra 0001193125-25-169329 `final` #1 → `skipped_other` #0, reason `remarketing`. This is the R-4 state already in D1.
- **F3 (5 row changes, 3 filings):** Caterpillar 0001104659-26-035983 and Toyota 0000950103-24-000970 (`parse_failed` #1 → `skipped_other` #0); GM 0001193125-25-308634 (`parse_failed` #0 → `skipped_other` #0).
- **F4 (3):** GM 0001193125-25-129568 #1, #2 and Duke 0001104659-24-091286 #1, from `parse_failed` to `final` (partial: no CUSIP).

**T5 check: 1 previously-final row changed, and it is listed.** It is the NextEra remarketing (F7), and it reproduces the R-4 row already in D1. **Unlisted changes to previous finals: 0.** The check covered status, principal, coupon, spread, maturity, CUSIP, ISIN, instrument_key, currency and confidence on all 633 previous finals.

**M1 and linkability on this corpus:**
- M1 = final ÷ (final + failed + drafts with no final) = 635 ÷ (635 + 3 + 8) = **98.3%**. On SA1's old basis (every draft a miss), 1.2.0 scores 633 ÷ 840 = 75.4%.
- Linkable (CUSIP/ISIN) = 276 ÷ 635 = **43.5%**. It is unchanged, because identifiers are F6 (FIX2).
- Draft links: 143 superseded. Gap in days: 0 → 19, 1 → 70, 2 → 32, 3–10 → 22. All 14 NextEra parent debt drafts link to NextEra Capital finals through the family rule.

These are corpus numbers, not D1 numbers. The corpus holds 198 drafts against D1's 184, and 964 rows against 943. That difference is not reconciled in this packet; the U3 / FIX2 diff is built against D1.

## 4 Deviations

1. **Two existing assertions changed, as the spec requires.**
   - AC1 no longer expects the Duke equity-units draft to be `preliminary`. Spec F1 names that fixture as becoming `skipped_non_debt`, and it is now asserted in the F1 test.
   - The parser-version assertion now expects `bonds-1.3.0`.

   No other existing test changed, and all 52 pass.
2. **The ICE pair named in spec F2 does not link.** The rule as written requires draft lines ≤ final tranches. The ICE draft (0001193125-26-343522) offered a floater plus 4 fixed tranches; the final (-349174) has only the 4 fixed ones. **8 drafts** in the corpus are like this: each final has one tranche fewer than its draft, filed 1–2 days later on the same shelf. They are ICE 26-343522, GM 24-082776 and 26-135888, Oracle 25-214032, Southern 25-000002, 25-000022 and 26-000012, and Dominion 24-258045. They are the whole `draft_no_final` count. I kept the pinned rule. **A ruling is needed** (for BOND.REVIEW / Founder): accept "final tranches ≥ draft lines − 1", or drop the count condition. Either would make these 8 `superseded`, and M1 = 635 ÷ 638 = 99.5% on this corpus.
3. **F4 on GM is a judgement on a self-contradictory filing.** GM 0001193125-25-129568 prints July 15 maturities on the cover and under "Maturity Dates", and January 15 in the Description of the Notes. The parser takes the labelled July 15 dates and writes a note. The same-deal FWP (0001193125-25-127722, "Final Maturity Date: July 15, 2027 / July 15, 2030") agrees, but that FWP layout ("Terms Applicable to …") is not read before F6. **Put this filing in the DIL 20-row source check.**
4. **The measurement used a harness, not the runner's offline dry run.** `--dry-run --offline` writes `state/runlog.jsonl`, `state/dryrun-<date>.*` and the pid file. `state/` is outside this packet's writable paths, and offline discovery would need cached submissions JSON, which is not cached. As the Control allows, I measured with the parser and the runner's exported `linkDrafts`. For the 21 WF filings of 16 Oct, which are not in the snapshot, two values are approximations: the filing date is the request-log date, and the file number is WF's usual shelf (333-292881). Their 6 `superseded` links are therefore approximate.
5. **F1 also applies rule 1 "other" to drafts.** The spec lists only `draft_not_debt` and `draft_structured`, but it does say "other → structured → non-debt". One draft is affected (the NextEra remarketing draft → `remarketing`).

## 5 Notes for FIX2 (F5/F6) and BOND-CR1

- **F5:** the only failures left are the 3 `fwp_conflict` rows. Per spec, that is Verizon 2035 and Dominion 2025/2026 Series B. `T4 ≤ 3` is met now, and F5 can reach 0.
- **F6:** 359 partial finals. 354 have no CUSIP; 5 have neither CUSIP nor coupon (the 5 fixed-rate finals the spec names). The GM May 2025 FWP is an example of a layout that fails today ("Terms Applicable to <tranche> … CUSIP / ISIN: 37045X FH4 / US37045XFH44"). It would fill the 3 GM partials and confirm their maturities.
- **The FIX2 diff must link against the full set.** In a live or incremental run, `linkDrafts` sees only the run's own filings. A final already stored in D1 from an earlier run is not seen, so the draft gets `draft_no_final`. The offline whole-corpus re-parse (U3) should call `linkDrafts` over all stored filings, as this measurement did. For incremental runs after CR1, use one read-only SELECT of finals by CIK and file number. A follow-on change is needed to hold file numbers for stored rows; today they come from discovery metadata only.
- **CR1 write mapping:**
  - `status_reason` → the column on non-final rows only. Finals stay NULL, and "partial" stays derived, as spec §5 says. The run-log `'partial'` / `missing[]` are for Ops counts and the F2 API.
  - `superseded_by` → the column on drafts.
  - A filing whose class changes between `final` tranches and a seq-0 audit row (F3, F4, F7) needs the guarded INSERT + DELETE pair (R-4 pattern).
- **Re-confirmation numbers for U3:** T2 98.3% (99.5% with the §4.2 ruling; 100% if F5 also clears the 3 conflicts); T3 43.5% before F6; T4 3 → F5.

## 6 Boundaries kept

- **Files:** writes only to `bonds-parse.mjs`, `bonds-ingest.mjs`, `tests/`, `fixtures/` and this report. `bonds-lib.mjs` is unchanged.
- **Nothing else touched:** `bonds-config.json`, LaunchAgent and control scripts, Workers, front end, `docs/`, `.env*`, `state/` (read only), the Status, board, Tower and transitions files, logs, `13F Seed/gleif-seed.js`.
- **No external calls:** no D1 call (no SELECTs used), no SEC or other network request, no discover or ingest against D1, no install, no subagent. Scratch work stayed in the session scratchpad.
- **Git:** one commit with explicit paths, pushed to `November-2026` (see the run's `END` line and `git ls-remote`).
