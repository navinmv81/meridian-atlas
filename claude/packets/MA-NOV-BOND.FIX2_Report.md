# MA-NOV-BOND.FIX2 — Term-sheet identifiers (F6), FWP conflicts (F5), dropped-tranche drafts (F2b), offline dry run + apply SQL — Report

```text
PACKET:   MA-NOV-BOND.FIX2 · Control v1 (785ebf6c…2055) · Task v1 (c20d80fe…0f9d) — both verified
RUN:      r-20261122T103749Z-be59 · interactive · 2026-11-22 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Engineering Lead
OUTCOME:  DONE — parser bonds-1.3.1; 86/86 bond tests (70 existing + 16 new); offline whole-corpus dry run;
          apply + rollback SQL built, NOT RUN (1 run, 945 statements, est. 1,229 rows written)
PINS:     spec v2 c4281815…aef ✓ · spec v1 b30a75ce…2e53 ✓ · FIX1 report b8027ac4…28c0 ✓ · bonds-parse.mjs blob at HEAD 89db5207…501eb ✓
D1 / SEC: 3 of the 6 allowed read-only SELECTs (970 rows read, 0 written) · 0 SEC or other network requests · 0 installs · 0 subagents
HEAD:     the Control names 6aa5c39; HEAD was b2895b6 (MA-NOV-EXP.BFS.ON, one Ops migration file only; no bond file touched — checked)
```

## 1 Changes

`PARSER_VERSION` is now `bonds-1.3.1`. Code changes are in `bonds-parse.mjs` (F6, F5, F2b cover lines) and `bonds-ingest.mjs` (F2b link, the runner passes `draft_tranches`). `bonds-lib.mjs` is unchanged. Nothing new goes into `COLS`, so the INSERT SQL is unchanged.

| Fix | Change | Where |
|---|---|---|
| **F6** Identifiers from term sheets | New `fwpTermSheet(html)` reads identifier groups ("CUSIP / ISIN", with a "Common Code" never taken as a CUSIP) and keys each to a tranche in one of 4 layouts. **Labelled**: "2028 Notes: …", "Notes due 2033: …", "2028 Floating Rate Notes: …". **Columns**: an unlabelled run of k groups mapped to the k titles of the title row, in order. **Sections**: the nearest tranche title before the group, printed after the title row. **Single**: a one-tranche sheet with one identifier. `assignTermSheetIds` gives an identifier only to a tranche with none, and only when it fits exactly one tranche on year, rate type and coupon where printed. A tranche offered two different identifiers gets neither. An identifier that would land on two tranches, or one already on another tranche, is dropped. Check digits are re-checked. Two guards were added after the dry run (§4.4): the sheet's currency, and for a one-tranche sheet its labelled maturity date. The 1.2 FWP reader still runs first and keeps its cross-check. The run log records `id_source` = `fwp <accession> (<layout>)`. | `fwpTermSheet`, `assignTermSheetIds`, `parseFiling` |
| **F6 / spec v2 §3 #12, §4** | Pricing date ("Trade Date" / "Pricing Date") and bank roles with their names, as the term sheet prints them, go into `result.offering` with their source FWP. They are captured only: no column, no SQL. Coverage on the corpus: of 123 filings that paired a term sheet, 119 have a pricing date and 115 have banks. Bank names are split on legal-form suffixes, which is rough for European name lists (§7). | `fwpBanks`, `parseFiling` |
| **F5** The 3 `fwp_conflict` rows | **None of the 3 is a reopening. All 3 were misreads by the 1.2 FWP reader** (§6 D1). **Verizon 2035:** the sheet prints the $2.25bn as $1.6875bn "(to the public)" plus $562.5m "(to Verizon for redelivery to the … trust)", and the reader took the first part. Now the parts are summed when the first is "to the public", and the row is final with the note "term-sheet amount printed in 2 allocations …; their total agrees with the 424B". **Dominion 2025 and 2026 Series B:** the reader deduplicated the titles "Series A … Notes due 2056" and "Series B … Notes due 2056" into one. It then compared Series B with Series A's amount. Titles are now kept apart by series. The two-column sheet is read as columns, so no false conflict arises, and Series B is final (partial: coupon, which is a reset rate). | `parseFwp` |
| **F2b** Dropped tranche | New `draftTranches(header)` gives each draft cover line's rate type and maturity year, where printed. A line that repeats an identified line (same date and series) is counted once. `linkDrafts` keeps the FIX1 count rule. It also links a draft when the final's tranches are a **subset** of the draft's lines (one-to-one on rate type and year). It then records `rule: 'subset'`. When the draft had more lines than the final has tranches, the draft row gets `status_note: 'tranche dropped at pricing'` (run log only). `trancheSubset` is exported. | `bonds-parse.mjs`, `bonds-ingest.mjs` |

## 2 F6 diagnosis — the 359 finals without an identifier, by term-sheet layout

These are the 1.3.0 corpus finals with no CUSIP or ISIN: 354 lack only the identifier, and 5 lack the coupon as well. The layout was read from the same-deal FWP (3 days, same shelf), offline.

| Term sheet seen for the deal | Filings | Rows | Resolved by 1.3.1 | Resolved by layout | Left |
|---|---|---|---|---|---|
| "CUSIP / ISIN:" lines | 67 | 195 | **178** | sections 59 · labelled 58 · columns 32 · single 29 | 17 |
| "CUSIP:" label | 23 | 52 | **39** | sections 26 · labelled 9 · single 4 | 13 |
| "CUSIP Number(s):" block | 6 | 19 | **16** | labelled 16 | 3 |
| other (e.g. "CUSIPs:", "CUSIP / ISIN Numbers") | 13 | 45 | **40** | sections 30 · labelled 6 · columns 4 | 5 |
| no FWP in the cached 3-day window | 17 | 47 | 0 | — not reachable offline | 47 |
| FWP not cached | 1 | 1 | 0 | — | 1 |
| **Total** | **127** | **359** | **273 (76%)** | sections 115 · labelled 89 · columns 36 · single 33 | **86** |

**What is left, and why:**
- **48 rows cannot be reached offline.**
  - 29 NextEra: its FWPs carry no file number in discovery and are not cached.
  - 10 AT&T, 6 Meta and 2 PepsiCo: the term sheet was filed 4 days before the 424B, outside the 3-day window, and is not cached.
  - 1 more FWP is not cached.
- **38 rows have a sheet that F6 does not resolve.**
  - Capital One (fixed-to-floating): 11.
  - Pfizer fixed block, where the CUSIP row is not split per tranche: 6.
  - Dominion Series A/B, whose identifiers are not keyed by series: 6.
  - Verizon single-tranche sheets with no identifier, and EUR sheets: 8.
  - Others: 7.

  All 38 are left blank, never guessed.

**Correctness check.** I checked all 273 new identifiers apart from the parser, against the FWP text:
- **Labelled (89):** the label right before the identifier names the tranche's year. 89 of 89 pass.
- **Sections:** the coupon is printed inside the identifier's own block. 97 pass. The other 18 are each the first block, where the block starts at the title row. I read those directly in the source: AmEx ×6, GM ×4, Comcast ×6, AbbVie ×2, all correct.
- **Columns (36):** each sheet's title-row order was matched to its CUSIP row. 5 sheets read directly (PepsiCo ×3, Home Depot, AbbVie).
- **Single (33):** the coupon or rate type and the year match.
- **CUSIP order:** 66 of 88 deals have issue numbers monotonic in tranche order. The 22 exceptions were read: the term sheets print them in that order (PepsiCo, Toyota, GM, AmEx floaters assigned after the fixed tranches).

## 3 Tests

`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs` → **86 tests, 86 pass, 0 fail.** That is the 70 existing tests plus 16 in the new `tests/bonds-fix2.test.mjs`. Note: node 24 rejects the directory form used in the FIX1 report; the glob form works.

**New fixtures.** 18 new fixtures were copied from `state/cache/` (gzip; `html_sha256` over the decompressed HTML; "fetched: cache … MA-NOV-BOND.FIX2 … 0 SEC requests"). Nine of them are term sheets:
- Verizon labelled sheet, PepsiCo columns, AbbVie sections, 2 Toyota single sheets.
- Verizon trust-allocation sheet, Dominion Series A/B sheet, Oracle sections.
- Plus the 424Bs they pair with, the Oracle draft and final, and the Southern draft and final.

| Fix | Tests |
|---|---|
| version | `bonds-1.3.1` |
| F6 | labelled: Verizon, 5 of 5 identifiers, none without the FWP; columns: PepsiCo, where CUSIP order differs from maturity order; sections: AbbVie, 9 blocks, floating and fixed tranches due 2028 kept apart; single: Toyota, a sheet that names the concurrent tranches; safety: a year-only label that fits two tranches is dropped, and a Common Code is not a CUSIP; guards: EUR vs USD sheet, maturity date; pricing date and banks captured but not written; the 1.2 reader still runs first (UNH) |
| F5 | Verizon split allocation → final with the note; Dominion A/B → no false conflict; a real disagreement still gives `fwp_conflict` (synthetic) |
| F2b | cover-line descriptors, and a repeated title sentence counted once (Southern); ICE pair → `subset` with the note, and the note is not in the SQL; Oracle (7 → 6) with the note; Southern (one tranche) with no note; negatives: a year not on the draft, two fixed tranches for one line, another rate type, no cover lines, another shelf |

**Three existing assertions changed (§6 D3).**
- The FIX1 version test now accepts any `bonds-1.3.x`.
- `bonds-parse.test.mjs` now expects the version `bonds-1.3.1`.
- The UNH link object now carries `rule: 'count'`.

No other existing test changed. The FIX1 ICE test still passes as written: a record without `draft_tranches` keeps the count rule only.

## 4 Dry run — D1 today vs 1.3.1, and T1–T5

### 4.1 Method

- **Before** is D1, read today with 3 read-only SELECTs:
  - the column list (23 rows read);
  - `SELECT * FROM bond_issuance` (943 rows);
  - the table and index definitions (4 rows).

  That is 970 rows read and 0 written. The CR1 columns do not exist yet, as expected.
- **After** is the 1.3.1 parse of the whole cached corpus. It covers 653 filings, including all 632 filings held in D1, and was made with the FIX1 harness method (FIX1 §4.4) in the session scratchpad:
  - the same-deal FWP pairing of the runner;
  - co-registrant row CIKs from the snapshot;
  - the runner's `linkDrafts` run over **all** filings, as FIX1 §5 asked.
- **Scope.**
  - Only D1's 632 filings are touched.
  - The 21 corpus-only Wells Fargo filings (16 structured, 5 drafts, never stored) are not inserted.
  - 0 D1 filings are missing from the corpus.
- **Not written.** `cik`, `filing_date`, `form_type`, `source_url` and `ingested_at` are never written. The raw comparison found only two differences outside the fix rules, and both are harness artifacts that this rule keeps out of D1:
  - PepsiCo Singapore `cik`: the R-1 correction in D1 vs the snapshot's parent CIK (4 rows).
  - 21 Wells Fargo filing dates, which the harness approximates.
- **Files.** Harness: `run.mjs` 8f474a37…b7, `corpus.mjs` e7252693…79a0 (as FIX1). After: `after-1.3.1.json` cb845503…806. Before: D1 rows `d1-q2-rows.json` 1a94593c…3426. All are in the scratchpad.

### 4.2 Before → after (D1 basis, 943 rows → 943 rows)

| Class | D1 today | After apply | After, by reason |
|---|---|---|---|
| final | 632 | **638** | with CUSIP/ISIN 550 · without 88 |
| preliminary | 184 | **146** | superseded 146 · draft_no_final **0** |
| skipped_structured | 21 | 49 | structured 21 · draft_structured 28 |
| skipped_non_debt | 45 | 54 | equity 44 · draft_not_debt 9 · stock_plan 1 |
| skipped_other | 52 | 56 | demand_note 39 · exchange_offer 6 · merger_document 5 · program_supplement 3 · remarketing 2 · resale 1 |
| parse_failed | 9 | **0** | — |

**Every changed row is listed in `apply/fix2-diff.tsv`** (584 rows; 0faf005a…fe8e). Each line gives the column before → after, the reason, `superseded_by`, the note, `id_source`, the rule, the old parser version and the SEC URL. There are 359 more rows whose only change is `parser_version`; they are counted, not listed.

| Change | Rows | Rule |
|---|---|---|
| identifier filled (cusip + isin + key, or cusip + key) | 271 | F6 |
| reason added, status unchanged (drafts superseded, skipped rows) | 264 | F8 / F2 / F2b |
| preliminary → skipped_structured / skipped_non_debt / skipped_other | 28 / 9 / 1 | F1 (FIX1) |
| parse_failed → final | 6 | F4 ×3 (FIX1: GM ×2, Duke) · F5 ×3 (Verizon, Dominion ×2) |
| parse_failed → skipped_other (seq 0, in place) | 1 | F3 (GM term notes) |
| tranche set change, seq 1 parse_failed → seq 0 skipped_other | 2 | F3 (Caterpillar Series L, Toyota Series B) |
| confidence only, 75 → 70 | 2 | F5 (Dominion 0001193125-25-224607: the old "agreement" was a two-column sheet read as one) |
| version only | 359 | — |

The FIX1 changes (F1, F3, F4) are in this apply because FIX1 wrote nothing. The 1.3.0 corpus counts (FIX1 §3) and these D1 counts differ only by the 21 corpus-only filings.

### 4.3 Targets (spec v1 §3), D1 basis, with arithmetic

| Target | Before (D1 today) | After apply | Target / stretch | Met |
|---|---|---|---|---|
| **T1** non-final rows without a stated reason | 311 of 311 (no reasons stored) | **0 of 305** | 0 | ✓ |
| **T2** M1 = final ÷ (final + failed + drafts without a final) | 632 ÷ (632 + 9 + 184) = 76.6% (old basis) | **638 ÷ (638 + 0 + 0) = 100.0%** | ≥ 95% / 97% | ✓ |
| **T3** linkable = finals with a CUSIP or ISIN ÷ finals | 276 ÷ 632 = 43.7% | **550 ÷ 638 = 86.2%** | ≥ 60% / 75% | ✓ (stretch) |
| **T4** parse_failed rows | 9 | **0** | ≤ 3 / 0 | ✓ (stretch) |
| **T5** previous finals lost or changed without a listed reason | — | **0 lost · 0 unexplained** | 0 | ✓ |

**T2 note.** The fall from 184 drafts to 0 drafts without a final breaks down as:
- 38 drafts become not covered (F1: 28 structured, 9 not debt, 1 remarketing);
- 138 link by the count rule;
- 8 link by F2b.

Without F2b, T2 = 638 ÷ 646 = 98.8%.

**T3 note.** The 550 count is 276 + 271 (F6 fills) + 3 (GM ×2 and Verizon, which become final with identifiers).

**T5 detail.** All 632 previous finals stay final:
- 359 are unchanged;
- 271 gain an identifier (cusip, isin and instrument_key go from NULL to a value, and confidence rises by 10);
- 2 have confidence 75 → 70 (F5, listed above).

The check covered principal, coupon, spread, benchmark, maturity, currency, rate type, seniority, label and security class: 0 changes. No existing identifier is changed or overwritten. Every identifier UPDATE is also guarded with `cusip IS NULL`.

### 4.4 Found by the dry run and fixed before the final build

- **Bad CUSIP on the AT&T EUR floater.** A USD floater's term sheet on the same shelf (AT&T, 26-342422) gave its CUSIP to the EUR floater due the same year (26-344905). The **currency and single-sheet maturity guards** were added, and the row is now left blank. The test is "F6 guards".
- **Key collisions.** The duplicate-key check (spec v1 §6) finds 4 new `instrument_key` values already used by an earlier filing of the **same issuer**. All are documented **reopenings**:
  - Duke 0001104659-24-002930 vs -000673: "will have the same CUSIP number … trade interchangeably";
  - Welltower 0001193125-25-171785 vs -148908: "a further issuance of, will be fungible with …".

  D1 already holds 19 same-issuer duplicate keys of this kind (Toyota, Caterpillar). No key lands on another CIK, so none are held back.
- **`superseded_by` check.** Two drafts (Duke 24-090699, Verizon 25-060923) name finals that become final only in this same apply. The generator's check allows that. It refuses any `superseded_by` that is not a final D1 filing after apply.

## 5 Apply and rollback SQL (NOT RUN)

Files are in `App/Corporate Atlas/bonds/apply/`, built by `fix2-build.mjs` (e472b208…b3f5):

| File | SHA-256 | Statements | Batches | Est. rows written |
|---|---|---|---|---|
| `fix2-apply-run1.sql` | 47749151…a7a54 | 945 (UPDATE 941 · INSERT OR IGNORE 2 · DELETE 2) | 10 (≤ 100 statements; a filing never splits) | **1,229** |
| `fix2-rollback-run1.sql` | df0ad70f…f12b | 945 | 10 (reverse order) | 1,229 |
| `fix2-diff.tsv` | 0faf005a…fe8e | 584 changed rows | — | — |
| `fix2-summary.json` | 8b4e8031…9dd6 | counts, classes, inputs and their SHA-256 | — | — |

**Runs.** One run, because 1,229 is well under the 8,000-write cap, so no split was needed. The estimate counts the table plus the indexes a row enters or leaves (PK autoindex, `idx_bi_cik_final_key`, `idx_bi_instrument`), in the same way as the runner's `writeCost`. CR1's migration is extra.

**Statements:**
- **In place:** `UPDATE … SET <changed columns>, parser_version='bonds-1.3.1', status_reason, superseded_by WHERE pk AND filing_status=<old> AND parser_version=<old> AND status_reason IS NULL AND superseded_by IS NULL`. When an identifier is filled, `AND cusip IS NULL` is added.
- **Set changes:** the R-4 pattern. Guarded `INSERT OR IGNORE … SELECT … WHERE EXISTS(old row, old status and version)`, then `DELETE old … AND EXISTS(new row)`.
- **Expected changes:** each statement expects exactly 1; each batch header carries its expected vector.
- **Rollback:** restores the exact prior values and nulls the two CR1 columns. It is guarded on `parser_version='bonds-1.3.1'`. For set changes it re-inserts the old rows, with their original `ingested_at`, before it deletes the new ones.
- **Assumes CR1:** `status_reason TEXT NULL`, `superseded_by TEXT NULL`. Finals get `status_reason` NULL; partial stays derived (spec v1 §5).

## 6 Deviations

1. **D1 — F5 outcome.** The Control says: "reopening → keep 424B values + note; otherwise stays failed with the reason". None of the 3 rows is a reopening, but none is a real disagreement either. Both documents state the same deal, and the 1.2 reader misread the term sheet (§1). I fixed the reader instead of leaving the 3 rows failed. The effect is +3 finals and T4 = 0, and it costs 2 confidence points on one Dominion filing (§4.2).

   A real disagreement still fails with `fwp_conflict`, and a test asserts it. **For BOND.REVIEW:** if the literal reading is preferred, revert the two `parseFwp` edits (series key, allocation sum). The 3 rows then go back to `fwp_conflict`, and T4 = 3, which still meets the ≤ 3 target.
2. **D2 — F2b also links one-tranche drafts whose title sentence repeats the cover line.** This covers Southern ×3 and Dominion 24-258045. They link by the subset rule with **no** note, because no tranche was dropped. Of the 8 drafts, 4 get the note "tranche dropped at pricing" (ICE, GM ×2 and Oracle; each dropped a floater).
3. **D3 — Three existing assertions changed** (version ×2 and the UNH link `rule`), as listed in §3.
4. **D4 — Parser version `bonds-1.3.1`.** The Task says "1.3.x". The apply's optimistic guard depends on the version.
5. **D5 — The harness again, not the runner's offline dry run.** The reason is the same as FIX1 §4.4: `state/` is not writable and the submissions JSON is not cached. D1 is the before side, as the Task asks.
6. **D6 — The 21 corpus-only Wells Fargo filings are not inserted.** The Task's diff is against D1 today, and spec v1 §6 limits the scope to "the 943 rows held today". A later live or incremental run would add them.
7. **D7 — Session HEAD was `b2895b6`, not `6aa5c39`.** That is the BFS.ON commit, one Ops migration file; it touches no bond file.

## 7 Notes for CR1 / CR2 and OFFER1

- **CR1.** The apply needs exactly `status_reason TEXT NULL` and `superseded_by TEXT NULL` on `bond_issuance`. No index is needed for U5.
  - The F2b note ("tranche dropped at pricing") and the F5 allocation note are in the run log only. If the UI should show them, CR1 needs a third nullable column (`status_note`); otherwise they stay Ops-only.
  - Before U5 runs, rehearse it on a local SQLite copy. Load the 943 rows from `SELECT *`, add the two columns, run apply and check every statement changes 1 row, run rollback and compare byte for byte. FIX2 did not do this, because running the SQL anywhere is outside this Control.
- **U5 order.**
  1. The CR1 migration.
  2. Re-SELECT and compare with `fix2-summary.json` `inputs.before.sha256` (1a94593c…3426). If D1 changed, rebuild with `fix2-build.mjs`.
  3. Apply run 1, batch by batch, stopping on the first mismatch.
  4. Ops reconcile.
- **Incremental runs after CR1.** These are unchanged from FIX1 §5.
  - `linkDrafts` must see finals already stored. Use one SELECT by CIK and file number, because file numbers are not stored yet.
  - The runner now also needs `draft_tranches` for stored drafts. Today it only has them for drafts parsed in the same run.
- **Live-run window.** Widening the FWP window from 3 to 4 days would let a live run reach 18 more rows: AT&T 10, Meta 6, PepsiCo 2. That is a `bonds-config.json` change, outside this packet.

  The 29 NextEra rows need the FWP file number, which is blank in discovery. Those FWPs are filed under NextEra Energy Capital Holdings (the co-registrant) and are not cached.
- **OFFER1 / CR2.**
  - `result.offering` already carries `priced_on` (with its source FWP) and banks as printed (`role_printed` + names) for 123 corpus filings. The numbers are in §1. Use it as a starting point, not as verified data: European and all-capitals bank lists split poorly.
  - Spec v2 §4's cover-block reader, its role vocabulary and the BOND-12 checks are still to build.
  - Pricing date is only labelled in the 424B for B/C families. The FWP fills it for A-family deals that paired a sheet.
- **DIL 20-row source check (U4).** Include these:
  - GM 0001193125-25-129568 (FIX1 §4.3; its sheet now confirms the July maturities and gives both CUSIPs);
  - Verizon 0001193125-25-064062 (F5);
  - Dominion 0001193125-25-173213 (F5);
  - PepsiCo 0001104659-25-010139 (columns out of CUSIP order);
  - AbbVie 0001104659-26-092114 (floating and fixed due the same year);
  - Toyota 0000950103-24-000197 (single sheets);
  - the Duke and Welltower reopenings (shared keys).

## 8 Boundaries kept

- **Files written:** only the paths the Control allows. Code: `bonds-parse.mjs` and `bonds-ingest.mjs`. Tests: `tests/bonds-fix2.test.mjs` (new), plus small edits to `tests/bonds-fix1.test.mjs` and `tests/bonds-parse.test.mjs`. Fixtures: 18 new `fixtures/*.htm.gz` and `fixtures/manifest.json`. Apply: `apply/` (generator, run-1 apply and rollback SQL, diff, summary). And this report. `bonds-lib.mjs` is unchanged.
- **Not touched:** `bonds-config.json`, `state/` (read only), Workers, the front end, `docs/`, `.env*`, the Status, board, Tower and transitions files, logs, `13F Seed/gleif-seed.js`.
- **External calls:** 3 read-only D1 SELECTs (of 6 allowed; 970 of ≤ 30,000 rows). No D1 write and no migration. The apply and rollback SQL were **not run**, anywhere. No SEC or other network request, no install, no subagent. Scratch work stayed in the session scratchpad.
- **Git:** one commit with explicit paths, pushed to `November-2026` (see the run's `END` line and `git ls-remote`).
