# MA-NOV-BOND.OFFER1 — Offering facts part 1: parties, identity, terms, dates, source references (offline) — Report

```text
PACKET:   MA-NOV-BOND.OFFER1 · Control v1 (abac4243…9d3a2d) · Task v1 (16dc2f27…ce43ce4) — both verified
RUN:      r-20261122T144519Z-9022 · interactive · 2026-11-22 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Engineering Lead
OUTCOME:  DONE — new bonds-offering.mjs (bonds-offering-1.0.0); 109/109 bond tests (86 existing + 23 new);
          offline run over all 325 cached final filings (322 debt at parser 1.3.1, 633 final tranches): 0 writes
PINS:     spec v2 c4281815…aef ✓ · CR 3885c999…2b5b ✓ · CR2 migration 3a2050cd…e6b ✓ · FIX2 report 1373dc9f…6e19 ✓
D1 / SEC: 1 of the 3 allowed read-only SELECTs (632 rows read, 0 written) · 0 SEC or other network requests · 0 installs · 0 subagents
HEAD:     8e576f5 = origin/November-2026 at start (as the Control says)
```

## 1 What was built

**`App/Corporate Atlas/bonds/bonds-offering.mjs`** (new, pure: no I/O, no network). One call per final 424B:

```js
extractOffering({ filing, html, parsed /* parseFiling() result */, fwps /* same-deal term sheets */, fwpsUnavailable, ingestedAt })
  → { family, facts /* bond_offering_fact rows */, parties /* bond_offering_party rows */, checks, notes, stats }
```

- **Row shapes are exactly the CR2 tables.** `FACT_COLS` / `PARTY_COLS` are the columns of `migrations/ma-nov-bond-cr2.sql`, in order (a test reads the migration and compares). `parser_version` is `bonds-offering-1.0.0`. `value_text` is never over 300 characters. The PK `(accession_number, tranche_seq, field)` is unique, and `party_seq` runs 1..n.
- **Fields (spec v2 §3 #1–13).**
  - **#1 Issuer:** no row. It comes from `bond_issuer_link`, and the issuer is never stored as a party.
  - **#2 Guaranteed by:** a `guarantor` party plus the `parties.guarantor` state row.
  - **#3 `document_date`** (O).
  - **#4 `identifier`** (T): CUSIP/ISIN from the parser row, with where it is printed (424B or term sheet).
  - **#5–8 `amount`, `currency`, `interest_rate`, `maturity`** (T): the parser's `bond_issuance` values, with their printed place (§6 D1).
  - **#9 `issue_price_pct`** (T).
  - **#10 `interest_paid`** (T): a short JSON, e.g. `{"f":"semi-annual","on":["06-15","12-15"],"first":"2025-12-15"}`. The first payment date is also in `value_date`.
  - **#11 `day_count`** (T): closed list `30/360 · Actual/360 · Actual/365 · Actual/Actual`.
  - **#12 `priced_on`** (O): a labelled date from the 424B or the same-deal term sheet only. It is never taken from the document date.
  - **#13 `issue_date`** (O): a labelled date, else the cover's delivery date with `value_text = 'on or about'`.
- **Document families (spec v2 §2).**
  - **A, prospectus supplement:** cover table read by column header, in both layouts:
    - rows per tranche (UNH);
    - columns per tranche (ICE, Toyota syndicated).
  - **B, key: value pricing supplement:** labels.
  - **C, retail table:** the row of the tranche's CUSIP.
- **Parties (spec v2 §4).** The role vocabulary of §4.1, kept apart (BOND-11):
  - **Who issued and protects the bonds:** guarantor and trustee.
  - **Banks that sold the bonds:** bookrunner, co_manager, underwriter, agent.
  - `other` covers calculation, exchange-rate and paying agents printed as separate entities.

  **Readers, in order:**
  1. The cover bank block, by its printed headings.
  2. B/C labels (`Agent:`, `Purchasing Agent:`, `Joint Lead Managers & Bookrunners:`, `Co-Managers:`, Deere's `Plan of Distribution: Name …` → `underwriter`).
  3. The A underwriting table. It only adds banks not already on the cover, matched by a bank key, so "SG Americas Securities, LLC" = "SOCIETE GENERALE".
  4. The same-deal term sheet, only when the 424B has no bank list (`source_doc = fwp`).

  **Splitting run-together names.** Cover names have no separators ("BofA Securities Barclays Citigroup J.P. Morgan"). They are split with a lexicon of the bank names printed in the corpus. Each match runs through to its legal-form suffix ("Mizuho International plc", "RBC Dominion Securities Inc."). The printed form is always kept. A text run that does not look like a name is dropped and counted; it is never stored as a bank.

  **Tranche roles.** "(for the 2036 notes)" → the one tranche of that year (BOND-08). "(2036 Notes and 2066 Notes)" → one row per named tranche. "(All Notes)" → tranche 0, with the qualifier kept in `role_printed`.
- **States (BOND-09).** `disclosed` · `not_disclosed` · `not_applicable` · no row ("Not read yet"). Role-group states are rows `parties.<role>` on tranche 0, per spec v2 §4.3. Nothing is inferred.
- **Source references (BOND-10).** Every shown fact has:
  - `source_doc` and `source_url`: the 424B or the term-sheet URL;
  - `source_part`: from the §5 list;
  - `source_heading`: the printed label (B/C), the table-of-contents section (A), or "Cover page";
  - `source_anchor`: the filing's own anchor, from its table-of-contents links, mapped into the decoded text and verified;
  - `source_page`: the printed `S-n` page (A only, when the page footers run in order), or `cover`;
  - `char_offset`.
- **§6.1 checks** run on every fact. A fact that fails one is not returned, and the failure is listed in `checks` (§4). `checkAgainstIssuance(facts, rows)` compares #5–8 with stored `bond_issuance` rows. It was run against D1 (§4).

**Tests.** `tests/bonds-offer1.test.mjs`: 23 tests (§5).

**Fixtures.** Three new fixtures, copied from `state/cache` with 0 SEC requests:
- an AT&T EUR deal with a European bank list;
- a Pfizer Netherlands EUR deal guaranteed by Pfizer Inc.;
- a CVS term sheet with an all-capitals bank list.

Each has a `manifest.json` entry, with `html_sha256` over the decompressed HTML.

`bonds-lib.mjs`, `bonds-parse.mjs` and `bonds-ingest.mjs` are **unchanged**.

## 2 Availability — offline run vs spec v2 §3

**Corpus.**
- All **325** final filings of the 15 Oct snapshot, read from `state/cache`. 0 were missing.
- They were parsed with parser 1.3.1, with the runner's same-deal FWP pairing (3 days, same file number).
- **322 are debt at 1.3.1.** The other 3 are now `skipped_other` and get no offering facts: Caterpillar 0001104659-26-035983 and Toyota 0000950103-24-000970 (programme supplements, F3), and NextEra 0001193125-25-169329 (remarketing, F7).
- That leaves **633 final tranches**. By family: **A 151 · B 148 · C 23** (§6 D5).

**Measured** = % of filings with the field shown (the spec's basis), then rows shown over the possible rows. No field is more than 10 points below its spec figure.

| # | Field | Lvl | Spec v2 | Measured (filings) | Rows shown | Not stated | Not applicable | Not read yet (no row) | By family (filings) |
|---|---|---|---|---|---|---|---|---|---|
| 3 | Date of this document | O | 95% | **100%** | 322/322 | 0 | 0 | 0 | A 151/151 · B 148/148 · C 23/23 |
| 4 | CUSIP / ISIN | T | 44% (D1 rows) | **88.8%** | 545/633 (86.1%) | 43 | 0 | 45 | A 115 · B 148 · C 23 |
| 5 | Amount | T | 100% (D1) | **100%** | 633/633 | 0 | 0 | 0 | all |
| 6 | Currency | T | 100% (D1) | **100%** | 633/633 | 0 | 0 | 0 | all |
| 7 | Interest rate / margin | T | 99% (D1 627/632) | **99.7%** | 626/633 | 0 | 0 | 7 | A 150 · B 148 · C 23 |
| 8 | Matures | T | 100% (D1) | **99.7%** | 626/633 | 0 | 0 | 7 | A 150 · B 148 · C 23 |
| 9 | Price to investors | T | 98% | **96.9%** | 600/633 (94.8%) | 0 | 0 | 33 | A 141 · B 148 · C 23 |
| 10 | Interest paid | T | 95% | **92.9%** | 567/633 (89.6%) | 0 | 0 | 66 | A 128 · B 148 · C 23 |
| 11 | How interest is counted | T | 86% | **77.3%** (−8.7) | 477/633 (75.4%) | 69 | 0 | 87 | A 125 · B 124 · C 0 (C prints none) |
| 12 | Priced on | O | 45% in 424B; ≈80% with FWPs [est] | **77.3%** | 249/322 | 73 | 0 | 0 | A 113 · B 113 · C 23 |
| 13 | Issue date | O | 95% | **95.7%** | 308/322 | 0 | 0 | 14 | A 145 · B 148 · C 15 |

**How the rows above break down:**
- **CUSIP / ISIN:** 302 of the 545 identifiers are sourced to the paired term sheet. "Not stated" is used only when neither the 424B nor any paired term sheet prints an identifier, and no term sheet is known to be missing. Otherwise there is no row.
- **Interest rate and maturity:** the 7 "not read" rows are the 1.3.1 partials (no coupon), plus 7 AbbVie maturities that could not be located in the text. Those 7 were held back by the source check (§4).
- **Price to investors:** 5 values were rejected by the range check (§4).
- **Day count:**
  - **B:** 124/148, exactly the spec figure. Deere fixed-rate supplements print no day-count term, so they are "not stated".
  - **A misses:** the AT&T and PepsiCo supplements state a day count only in the make-whole assumption ("assuming a 360-day year …"). That is not read as the notes' convention. Fixed-to-floating notes (Capital One, American Express) are not read either (§6 D6).
- **Priced on:** 101 of the 249 come from the term sheet.
- **Issue date:** 137 of the 308 are "on or about" cover dates. The 8 Verizon retail tables have no labelled date.

**Rows produced (would be written by the offering apply):** 7,461 fact rows + 3,926 party rows = **11,387** (§7).

## 3 Parties

| | Result |
|---|---|
| Party rows | **3,926**: bookrunner 1,313 · co_manager 1,644 · underwriter 570 · agent 227 · trustee 116 · guarantor 19 · other 37 |
| Filings with ≥ 1 selling bank | **321 / 322** (spec: 324/325). The one without is Caterpillar 0001104659-24-105055, whose label block did not split. |
| Banks per filing | median 10, max 63 (AbbVie 7-tranche, tranche-specific rows) |
| Tranche-specific rows (BOND-08) | 120 (ICE 4, AbbVie 116). Each maps to exactly one existing tranche (checked). |
| Unknown names | 17 names stored from outside the lexicon. They were split on legal-form suffixes and look like names. |
| Text runs dropped | 72, in 66 filings. Most are table headers ("Principal Amount …", "To Be Purchased …") and B-label prose ("It is expected that delivery …"). None is stored. |
| Trustee or guarantor read as a bank · issuer read as a bank · clashes | **0 · 0 · 0** |

**Role-group states.**

| Group | Shown | Not stated | Not applicable | Not read yet |
|---|---|---|---|---|
| Bookrunner | 182 | | 99 (B/C with an agent) | |
| Co-manager | 146 | 36 (bank block, no co-managers) | 99 | |
| Underwriter | 69 (Deere 35 + underwriting tables) | | 252 | |
| Agent | 99 | | 147 (A with a bookrunner block) | |
| Trustee | 116 | 89 (Caterpillar 37, Deere 35, Verizon retail 17) | | 117 |
| Guarantor | 19 | 300 | | 3 |

**Trustee is below the spec's 73%: 116/322 = 36%.**
- The spec's 73% counted any "as trustee" sentence, Toyota included.
- The 117 not read are:
  - **93 under D9** (Toyota 88, Dominion 5): two or more trustee institutions, none stated as the current one.
  - **24 named only in the accompanying base prospectus** (NextEra 14, American Express 6, Capital One 3, Dominion 1). NextEra's base prospectus names the trustees of *NEE*'s indentures, not those of the issuer NEE Capital, so the base text is not reliable for these notes (§6 D2).
- **For BOND.REVIEW / Founder:** whether a base-prospectus statement may be shown when the 424B's issuer is the base prospectus's own registrant. That would add about 9 (American Express, Capital One, Dominion), and NextEra would stay not read.

**Guarantor: 19** (PepsiCo, Pfizer, NextEra Energy, Welltower). The spec measured 13%; we have 5.9%.
- The spec's 42 counted the guarantee phrase.
- Three Comcast covers say "guaranteed by our wholly-owned subsidiaries named in this prospectus supplement", with no name. They are "Not read yet", not "Not stated".
- FDIC wording ("not … guaranteed by the FDIC") is excluded.

## 4 Automatic checks (§6.1) — whole corpus

**Failures (each fact not returned):**

| Check | Count | Filings |
|---|---|---|
| Price out of 90–101 | 5 | Southern 0000092122-24-000031 (101.458) and 0000092122-24-000032 (101.831): genuine premium reopenings, rejected by the spec range. Duke 0001104659-24-002930 ×2 (4.85) and Dominion 0001193125-25-224607 (2.262): cover-table misreads that the check caught. |
| Interest paid: first date not on the printed dates | 9 | Capital One, 5 fixed-to-floating filings. The first date printed belongs to the floating period. |
| Source: maturity not found in the text | 7 | AbbVie 0001104659-24-027205, 7 tranches |
| Interest-paid frequency vs months · dates order · term sheet vs filing (price, issue date) | 0 | |
| Parties clash · tranche-specific party on a missing tranche · fact without a source · value_text > 300 | 0 | |

**Not failures, but recorded in notes:**
- 2 filings whose term sheets disagree on the pricing date (no priced-on row);
- 93 D9 trustee cases;
- 24 base-prospectus-only trustees;
- 3 unnamed guarantors.

**Against `bond_issuance` (1 read-only SELECT of the 632 D1 final rows):**
- **0 value differences** in amount, currency, interest rate or maturity.
- 6 tranches have no D1 row yet (amount 6, currency 6, rate 4, maturity 6). These are the finals FIX2's apply adds, not yet run.

**Source references:**
- 3,651 shown facts carry a printed page.
- 573 shown facts carry an anchor. Cover facts link the document itself.
- 151/151 A filings have a page run.
- 133/151 A filings have table-of-contents anchors (spec: 135/154).

## 5 Tests

`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs` → **109 tests, 109 pass, 0 fail** (86 existing + 23 new). No existing test changed.

| Area | Fixture | Asserted |
|---|---|---|
| Row shape | the CR2 migration | columns = the migration's, in order. On 11 fixtures: state, part, doc and field lists; PK unique; `party_seq` 1..n; ≤ 300 characters; no shown value without a position; O fields on tranche 0; T fields on real tranches |
| Multi-tranche, rows per tranche | UNH 4 tranches + its FWP | 4 prices; per-tranche interest dates (the 2031 notes differ); document, issue and priced dates (priced from the FWP, with its URL); two $750m tranches point at their own cover lines; day count with anchor and page; 4 bookrunners; co-managers "not stated"; trustee U.S. Bank Trust Co. on S-7 |
| Columns per tranche + tranche roles | ICE | 4 prices; MUFG → t4, Citigroup → t1, Fifth Third → t3, PNC → t2; qualifier kept in `role_printed`; 6 co-managers incl. SOCIETE GENERALE; priced-on "not stated" (never the document date) |
| Column titles above the table | Toyota syndicated, floating and fixed both due 2026 | 4 prices |
| Pricing supplement, no trustee | Caterpillar 424B3 | `parties.trustee` = not_disclosed; Trade Date/Pricing Effective Time; issue date; price 100.089 with no page; 3 bookrunners + 18 co-managers; billing agent not repeated |
| Deere | Deere floating | two-column header date; 12 underwriters from "Plan of Distribution"; no trustee; Actual/360; quarterly dates |
| Retail table (C) | GM | price by CUSIP; 5 agents incl. InspereX (Purchasing Agent) and Wells Fargo Advisors; trustee; day count "not stated" |
| D9 | Toyota MTN (two trustees in the indenture history) | no trustee row; note; initial trade date |
| European bank list | AT&T EUR | Barclays · BBVA · Commerzbank · IMI – Intesa Sanpaolo · Société Générale Corporate & Investment Banking (accents kept); Actual/Actual; annual interest |
| All-capitals list | CVS term sheet | 6 names whole with suffixes ("GOLDMAN SACHS & CO. LLC" …) and their keys; term-sheet banks used only without a 424B bank block (`source_doc fwp`) |
| Guarantor deal | Pfizer Netherlands | guarantor Pfizer Inc., never a bank; 4 prices; 8 bookrunners |
| Co-registrant issuer | NextEra Series Q (NEE Capital) | issuer not stored as a party; guarantor NextEra Energy, Inc.; trustee from the base prospectus only → not read |
| BOND-11 clash | synthetic | a guarantor also read as an agent → no party rows, no `parties.*` rows, a `clash` check; other facts kept |
| §6.1 | synthetic | issue date before the document date; price − fee ≠ proceeds; 101.458 out of range; months vs frequency; FWP pricing-date conflict; `checkAgainstIssuance` |
| Pages / anchors / tranche names | UNH, Caterpillar, unit | S-1… run in order; anchors inside the text; Caterpillar has none; `namedTranches` for years, shared years, coupons |

## 6 Deviations

1. **D1 — Fields 5–8 (and 4) are fact rows.** Spec v2 §3 says amount, currency, rate and maturity are "existing `bond_issuance` columns; no change". They still need BOND-10 source links, and the Task's check compares them with `bond_issuance`. So each is emitted as a fact row carrying the same value and its printed place: 2,518 rows, plus 588 identifier rows. **For BOND.REVIEW:** the apply can drop these rows, and BOND-10 then falls back to the document link for them.
2. **D2 — Trustee: on a prospectus supplement, only the supplement's own statements count.**
   - The supplement's own pages are those up to its last printed S-page.
   - A trustee named only in the accompanying base prospectus → "Not read yet" (24 filings).
   - Several institutions in the supplement → D9. One stated as successor counts as current.
   - This is stricter than the spec's count, to keep the trustee correct (§3).
3. **D3 — Decoded text.** The parser's `htmlToText()` turns named accent entities ("&eacute;") into spaces ("Soci t G n rale"). This module rewrites them as numeric references before decoding (`decodedText()`). `char_offset` counts in that text, which is identical to `htmlToText()` wherever a filing has no such entity. `bonds-parse.mjs` is unchanged.
4. **D4 — Role mapping beyond the §4.1 table:**
   - "Co-Lead Managers" → `co_manager`;
   - green and sustainability "Structuring Agent" → `other`;
   - "Billing and Delivery Agent" → `other`, and not repeated when it is already a bookrunner;
   - "Exchange Rate Agent" and "Calculation Agent" → `other`.
5. **D5 — Families.** A filing whose first 1,500 characters say "Pricing Supplement" is family B. The exception is when it also prints a cover price table and a bank-heading block: Toyota's 12 syndicated pricing supplements are read as A. That gives A 151 / B 148 / C 23 on the 322 debt filings. The spec measured A 154 / B 148 / C 23 on 325 filings, before parser 1.3.1 skipped 3 of them.
6. **D6 — Fixed-to-floating notes.**
   - **Interest paid:** only the fixed-rate period's schedule is stored, with `"p":"fixed rate period"`.
   - **Day count:** not read, because two conventions apply.
7. **D7 — Deere's two-column header** prints "PRICING SUPPLEMENT … PROSPECTUS SUPPLEMENT, each Dated <d1> Dated <d2>" with the columns in either order. The document date is the later of the two: a pricing supplement is never dated before the prospectus supplement it supplements.
8. **D8 — Issue date is offering-level only.** A filing that labels two different issue dates is not read. None of the 322 did.
9. **D9 — Measurement basis.** The spec's percentages are per filing, so the table gives filings first and rows second.

## 7 Notes for OFFER2 and the apply

**Write volume.**
- OFFER1 alone gives **11,387 rows**: 7,461 facts + 3,926 parties. Spec v2 §7 / CR §4.3 estimated ≈ 12,000 for everything (OFFER1 + OFFER2).
- OFFER2 adds fields 14–22 and 25–28, which is roughly 4–6k rows more.
- So the offering apply needs **3 guarded runs of ≤ 8k**, or D1 (drop fields 5–8: −2,518) to fit in two.
- The Sat 28 budget in CR §4.3 needs restating before write approval 2.

**Order.**
- The 6 new 1.3.1 finals have no `bond_issuance` row until FIX2's apply (U6). The offering apply must run after it, as spec v2 §9 says.
- `checkAgainstIssuance` should be re-run against the post-apply D1.

**For OFFER2 (cover table).**
- The fee and proceeds % are already read and checked in `issuePrices()` (price − fee = proceeds within 0.01). OFFER2 #21/#22 can use the same reader.
- Fix the 2 misreads the range check caught (Duke 0001104659-24-002930, Dominion 0001193125-25-224607).
- Decide the Southern premium reopenings: the spec range 90–101 rejects 101.458 and 101.831. Widen it to ≤ 105, or keep them hidden.

**Open items.**
- **Trustee decision (§3):** base-prospectus statements when the issuer is the registrant; Dominion senior vs junior subordinated by the notes' ranking (needs #14 Ranking, which is OFFER2).
- **Caterpillar 0001104659-24-105055:** banks not split. Look at it in the 20-filing check.

**20-filing manual check (U8).** The appendix gives 10 facts per field, spread over issuers, as a starting sheet. Include:
- ICE 0001193125-26-349174 (tranche roles);
- AbbVie 0001104659-26-020619 (116 tranche-specific rows);
- AT&T 0001193125-25-064173 (European names);
- Pfizer 0001193125-25-120844 (guarantor);
- one Toyota B and one Toyota A (D9 / families);
- GM C;
- Caterpillar 0001104659-24-105055.

**Re-running the offline run.** The harness lives in the session scratchpad (not in the repo): `corpus.mjs` e3a96d60…be8, `run.mjs` 6d55d564…79a4, `report.mjs` 301e6ebf…c0. Its outputs are `out.json` a53a0239…a9 and `offer1-summary.json` b80e26ec…cd4a, and the D1 rows are `d1-finals.json` 47d625d2…139.

## 8 Boundaries kept

- **Files written:**
  - `bonds-offering.mjs` (new; sha256 29eae79a…870);
  - `tests/bonds-offer1.test.mjs` (new; c8608313…d6);
  - 3 new `fixtures/*.htm.gz` + `fixtures/manifest.json` (3 entries appended);
  - this report.

  `bonds-lib.mjs`, `bonds-parse.mjs` and `bonds-ingest.mjs` are unchanged.
- **Not touched:** migrations (none run), Workers, the front end, `docs/`, `.env*`, `state/` (read only), the Status, board, Tower and transitions files, logs, `13F Seed/gleif-seed.js`. The Main Lane's uncommitted edits in the working tree were left as they were and are not in this commit.
- **External calls:** 1 read-only D1 SELECT (632 rows read, 0 written). No D1 write, no migration. 0 SEC or other network requests, 0 installs, 0 subagents.
- **Copying:** no sentence of a filing is stored. Values are dates, numbers, codes, bank names as printed, and a ≤ 300-character JSON (§8). Earlier session scratchpads were read only, to reuse the corpus method.
- **Git:** one commit with explicit paths, pushed to `November-2026` (see the run's `END` line and `git ls-remote`).

## Appendix — 10 sample facts per field (for the 20-filing check)

Format: accession · issuer · tranche · value · source part — heading, page.

- **Date of this document:** ICE 0001193125-24-134302 2024-05-06 (cover) · Caterpillar 0001104659-24-088828 2024-08-12 · Deere 0001104659-24-030969 2024-03-04 · Toyota 0000950103-24-000680 2024-01-11 · Toyota 0000950103-24-015130 2024-10-18 · Toyota 0000950103-25-015885 2025-12-08 · GM 0000804269-25-000028 2025-03-24 · Verizon 0001193125-24-041437 2024-02-20 · AbbVie 0001104659-24-027205 2024-02-22 · Southern 0000092122-26-000016 2026-03-16.
- **CUSIP / ISIN:** ICE …-24-134302 t1 45866FBA1 / US45866FBA12 (term sheet) · Caterpillar 0001104659-25-076244 t1 14913UBB5 (CUSIP label) · Toyota 0000950103-24-000197 t4 89236TLM5 (PS-3) · Toyota 0000950103-25-005958 t1 89236TNH4 (term sheet) · Toyota 0000950103-26-010360 t2 89236TQD0 · Amazon 0001104659-26-027125 t6 023135DE3 · Oracle 0001193125-25-217490 t5 68389XDR3 · Verizon 0001193125-24-193837 t1 92346MNP2 (retail table) · AbbVie 0001104659-26-092114 t4 00287YEN5 · PepsiCo 0001104659-25-010139 t4 713448GC6.
- **Amount / currency:** ICE …-24-134302 t1 750,000,000 USD (cover) · Caterpillar 0001104659-25-017030 450,000,000 · Toyota 0000950103-24-001037 35,000,000 · Toyota 0000950103-25-013276 105,825,000 · GM 0000804269-25-000019 22,174,000 (retail) · Meta 0001193125-24-197096 t3 2,500,000,000 · AT&T 0001193125-26-323650 t2 1,250,000,000 EUR · Comcast 0001193125-24-225214 t2 900,000,000 EUR · CVS 0001193125-24-134264 t3 1,250,000,000 · Southern 0000092122-24-000083 750,000,000.
- **Interest rate:** ICE …-24-134302 t1 5.25 · Caterpillar 0001104659-25-001420 4.8 · Toyota 0000950103-24-000877 5 · Toyota 0000950103-25-011501 4 · GM 0000804269-25-000015 t2 5.6 · Amazon 0001104659-26-107122 t2 5.55 · AT&T 0001193125-26-182243 t1 4.75 · Verizon 0001193125-26-221003 t2 6.2 · UNH 0001193125-24-183865 t7 5.625 · Duke 0001104659-24-002930 t2 4.85.
- **Matures:** ICE …-24-134302 t1 2031-06-15 · Caterpillar …-25-001420 2030-01-08 · Toyota …-24-000877 2029-01-22 · Toyota …-25-011501 2030-09-18 · GM …-25-000015 t2 2033-02-20 · Amazon …-26-107122 t2 2032-09-14 · AT&T …-26-182243 t1 2033-04-30 · Verizon …-26-221003 t2 2056-05-14 · CVS …-24-134264 t2 2031-06-01 · Southern 0000092122-24-000031 2029-03-15.
- **Price to investors:** ICE …-24-134302 t1 99.905 (cover table) · Caterpillar 0001104659-25-001413 100 (Price to Public (Issue Price)) · Toyota 0000950103-24-000197 t4 99.89 · Toyota 0000950103-25-008998 100 (Issue Price) · GM 0001193125-24-213087 t1 99.954 · Amazon 0001104659-26-072332 t5 99.569 · Verizon 0001193125-24-037819 t1 99.234 · Comcast 0001193125-25-113873 t2 99.638 · CVS 0001193125-24-134264 t3 99.926 · Southern 0000092122-25-000026 100.
- **Interest paid:**
  - ICE …-24-134302 t1: semi-annual, 06-15/12-15, first 2024-12-15.
  - Deere 0001104659-24-069472: quarterly, 03/06/09/12-11, first 2024-09-11.
  - Toyota 0000950103-24-008004: monthly dates, no frequency word, first 2024-07-10.
  - Toyota 0000950103-26-000297 t2: 01-12/07-12, first 2026-07-12.
  - GM 0001193125-25-129568 t1: semi-annual, 01-15/07-15, first 2026-01-15.
  - Meta 0001193125-24-197096 t3: 02-15/08-15, first 2025-02-15.
  - AT&T 0001193125-26-098472 t2: semi-annual, first 2026-09-12 (S-2).
  - Verizon 0001193125-25-277994 t2: semi-annual, 01-15/07-15, first 2026-07-15.
  - UNH 0001193125-25-142782 t2: semi-annual, 01-15/07-15, first 2026-01-15.
  - Duke 0001104659-24-000673 t1: semi-annual, 01-05/07-05, first 2024-07-05.
- **How interest is counted:** ICE …-24-134302 t1 30/360 (Summary, S-2) · Caterpillar 0001104659-26-058799 30/360 (Day Count Convention) · Toyota 0000950103-24-011879 t2 30/360 (PS-2) · Toyota 0000950103-26-000297 t2 30/360 · GM 0001193125-26-004449 t2 30/360 (S-9) · Amazon 0001104659-26-107122 t3 Actual/Actual (S-13) · AT&T 0001193125-26-098472 t1 Actual/Actual (S-2) · AbbVie 0001104659-24-027205 t4 30/360 (S-21) · CVS 0001193125-24-271505 t1 30/360 (S-16) · Southern 0000092122-25-000026 t1 30/360 (S-10).
- **Priced on:** ICE …-24-134302 2024-05-06 (term sheet, Trade Date) · Caterpillar 0001104659-24-026627 2024-02-22 · Caterpillar 0001104659-26-000776 2026-01-05 · Toyota 0000950103-24-002543 2024-02-20 · Toyota 0000950103-24-017362 2024-12-04 · Toyota 0000950103-25-014901 2025-11-18 (Initial Trade Date) · Toyota 0000950103-26-010360 2026-07-06 (PS-2) · Meta 0001193125-26-201738 2026-04-30 (term sheet) · Verizon 0001193125-25-064062 2025-03-24 (term sheet) · PepsiCo 0001104659-25-010139 2025-02-05 (term sheet).
- **Issue date:** ICE …-24-134302 on or about 2024-05-13 (cover) · Caterpillar 0001104659-24-088589 2024-08-16 · Deere 0001104659-24-000833 2024-01-08 · Deere 0001104659-26-106394 2026-09-11 · Toyota 0000950103-24-011879 2024-08-09 (PS-2) · Toyota 0000950103-25-014646 2025-11-20 · Toyota 0000950103-26-012192 2026-08-13 · Oracle 0001193125-25-018491 2025-02-03 (Summary, S-2) · Pfizer 0001193125-25-120844 on or about 2025-05-19 · Southern 0000092122-24-000032 on or about 2024-02-28.
- **Parties (10 filings):**
  - ICE 0001193125-24-134302: 11 bookrunners + 6 co-managers + successor trustee Computershare.
  - Caterpillar 0001104659-24-088828: 3 bookrunners + 18 co-managers + exchange-rate agent.
  - Deere 0001104659-24-030969: 10 underwriters.
  - Toyota 0000950103-24-000680, 0000950103-24-015130 and 0000950103-25-015885: agent Barclays Capital Inc.
  - GM 0000804269-25-000028: 5 agents + trustee.
  - Verizon 0001193125-24-041437: 6 bookrunners.
  - AbbVie 0001104659-24-027205: 64 rows, by tranche.
  - Southern 0000092122-26-000016: 12.
