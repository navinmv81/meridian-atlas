# MA-OCT-008.DIL14: Report (Data-Identity Lead, LANE-8)

```text
ISSUED BY:    Data-Identity Lead (LANE-8, 008 spec owner), Sat 17 Oct 2026, ≈ 08:55 UTC
EXECUTED BY:  Data-Identity Lead. Doc and read-only checks only: 0 D1 reads or writes, no deploys, no git writes
              (5 read-only web lookups: 4 GLEIF lei-records, 1 SEC filing index)
REVIEWED BY:  Main Lane; a fresh Architect session sees RB3-1 at the 008 close-out (see "Independence")
APPROVED BY:  Founder
CONTROL:      v1 f61b18cbedf2048f82b77d074068bd8f3897078a8cedb2314cb5dc57d98d4033 (matches STATUS_BOARD row 34)
TASK:         v1 289430796d7768c2aad65f8dcf655efcdaf1de0406cfd3e3626c767f2e1d4c92 (matches the Control)
RESULT:       AC12 FAIL: 1 wrong-issuer link in the sample (row 9, PepsiCo Singapore Financing I). Field accuracy 237/240 = 98.75%,
              which itself passes. 009 must not read bond rows until the §5 re-test passes. Links: 3 of 3 SIGNED. DQ list: confirmed and corrected (§4).
```

## 0. Evidence and method

| Input | SHA-256 | Check |
|---|---|---|
| `packets/MA-OCT-008.BUILD_Report.md` | `c58271be9d82bf1a6f02e96c7c1886237e118925a182d5d53e7a16d83ef73271` | = Task ✔ |
| `MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` | ✔ |
| `bonds/state/sample60-2026-10-16.json` | `fc9ce6294ed71bba4436be18d9a20237b696dd5b0667a5d362163a38cd3dcbfd` | = build report ✔ |
| `bonds/state/finals-2026-10-16.json` (633 finals, population) | `28d32b35dc799f6c8b7c133a5d412895e451b0b0fd905863c953eb6a5464e263` | ✔ |
| `bonds/state/link-seed-2026-10-15.sql` (as executed) | `36c6ed3ae4a9021fcbb411f272d5d0a1ba639f36d21ea3407783820db0825317` | ✔ |
| `~/MeridianAtlas-work/gleif-011/exports/2026-10-16-fresh/entity_master.jsonl` (entity names and LEIs, 16 Oct; no `cik` column) | `b7aa0122baea3ddbc26b68f6b1d6fb0be955969969cd049f3bf81df89f7c389a` | ✔ |

**Method**
- **Source filings.** I read all 60 sampled 424B documents, as visible text, from the build lane's read-only document cache (`bonds/state/cache/`; key = SHA-256 of the URL). Every sampled URL was cached, so no SEC request was needed for them. For each row I located the tranche on the cover or term sheet and checked four fields: principal; coupon, or spread plus benchmark for floating rows; maturity; rate type. I also checked the issuer link, as the cover's legal issuer against the CIK's `bond_issuer_link` entity.
- **Population checks**, not required by the Task but needed to size the fixes, over all 633 finals (326 filings):
  - a cover scan for a non-filer "issuer" or guarantor structure;
  - a count of floating and fixed-to-floating rows with no spread.
- **Web lookups.** One SEC filing index (PepsiCo `0001104659-24-022370`) and GLEIF records for the 3 proposed LEIs.
- Repo: HEAD `0dd7ef0`, branch `October-2026`, no `.git/*.lock`.

**Independence.**
- I did not build the runner or draw the sample.
- B-3 and its sample condition are my own AC17 rulings (15 Oct). **RB3-1 below interprets my own condition, so a fresh Architect session must see it at close-out.** As already noted in AC17, this chat session also served as REVIEW-A.

## 1. §14.2 sample: 60 rows, 240 field checks

| # | Check | Result |
|---|---|---|
| a | Field accuracy (principal, coupon/spread, maturity, rate type) | **237 / 240 = 98.75%** (3 errors; limit ≤ 4) ✔ |
| b | Wrong-issuer links | **1** ✘ (row 9) |
| c | Served rows from a preliminary, structured or non-debt filing | **0** ✔ (all 60 are final, plain debt; the 5 Verizon InterNotes rows are priced supplements with filled amounts) |
| d | B-3 rows (B-3a 8, B-3b 5 = 13 rows, 52 checks) | **50 / 52 = 96.2%**, below AC17 condition 3 (≥ 98%). See RB3-1 |

**AC12 = FAIL on (b).**

**Errors (row, field, expected, found):**

| Row | Accession / seq | Path | Field | Expected (source) | Found |
|---|---|---|---|---|---|
| 9 | PepsiCo `0001104659-24-022370` / 2 | 7.3-4 | **issuer link** | Issuer **PepsiCo Singapore Financing I Pte. Ltd.** (cover: "(the “issuer”)", PepsiCo, Inc. "Guarantor"). Own SEC CIK **0002007029**: the filing index lists it as a second filer. | Stored under PepsiCo CIK 0000077476, linked to entity **1457 PepsiCo Inc**: a guarantor link, contrary to L8-4 and L8-12 |
| 43 | Toyota `0000950103-26-003611` / 1 | B-3a | spread / benchmark | Compounded SOFR, "Spread: +65 basis points" | NULL / NULL |
| 44 | Toyota `0000950103-26-007114` / 1 | B-3a | spread / benchmark | Compounded SOFR, "Spread: +48 basis points" | NULL / NULL |
| 46 | Capital One `0001193125-24-019419` / 2 | 7.3-4 | spread / benchmark (floating leg) | base rate (SOFR) "plus 2.260% (the “2035 Notes Spread”)" | NULL / NULL (coupon 6.051% correct) |

**Verified correct and noted** (no error counted):
- Rows 7, 12, 17 and 33 are fixed-to-fixed **reset** junior subordinated notes (CVS 7.000%, Southern 6.375%, Dominion 6.875%, NextEra Capital 6.75%). They are stored as `fixed` with the initial coupon, which is correct under the §8.2 enum, since there is no reset type. Note for 009: do not label these "fixed for life".
- Row 8 (Wells Medium-Term Notes, Series AA, 5.85% due 2031-10-16, $9,268,000) matches its cover.
- All 13 B-3 rows were correctly **admitted as debt**, with correct principal, maturity, rate type and issuer.

**Population findings (beyond the sample; they size the fix):**
- **P-1, wrong issuer.**
  - The cover scan of 326 final filings found **one** filing whose cover issuer is not its CIK's own legal entity and was not moved under L8-12: the PepsiCo Singapore filing, with **4 rows** (the $300m FRN 2027, 4.650% 2027, 4.550% 2029 and 4.700% 2034).
  - All other guarantor structures are already under their own CIKs: NextEra Energy Capital Holdings 15 filings, Welltower OP 3, Pfizer Netherlands 1.
  - The rest are subsidiary-guarantee or FDIC-wording false hits (Comcast, AbbVie, Amex).
  - The build's `cover_issuer_hint` missed this case.
- **P-2, missing floating spreads.** **37 of 118** floating or fixed-to-floating finals have no spread:
  - American Express fixed-to-floating 14;
  - Toyota floating 11;
  - Capital One fixed-to-floating 11;
  - Home Depot floating 1.

  These are three wordings the parser misses: the term-sheet field "Spread: +NN basis points", "base rate … plus X%", and Amex's later-leg phrasing. It is systematic, not random.
- **P-3, remarketing scope.** NextEra Energy Capital Holdings `0001193125-25-169329` ("This is a remarketing of … Series M Debentures") is stored `final`. Spec §7.3 rule 1 skips remarketings, but the word is in the body, not the title. The bond is real and its terms are not wrong. This is a scope deviation, not an accuracy error.

## 2. Rulings

- **RB3-1 (B-3, interpreting my AC17 condition 3; Architect to see).** **B-3 is kept, not withdrawn.**
  - Both B-3 errors are floating-spread extraction in Toyota MTN term sheets ("Spread: +NN basis points"). That defect is independent of B-3, which only admits the filing as debt.
  - The same defect hits non-B-3 rows: row 46 here, and at least 26 of the 37 population rows (American Express, Capital One, Home Depot) are on the 7.3-4 path.
  - B-3's own decision, debt admission plus title and maturity, is 13/13 correct.
  - Withdrawing B-3 would turn about 140 correct rows into `parse_failed` while leaving the spread bug in place.
  - Condition 3 is therefore applied to the **B-3 classification** (13/13). The spread fix (R-2) and its re-test cover the field errors.
  - If the Architect or the Founder prefers the literal reading, the alternative is to withdraw B-3a and B-3b and re-parse those CIKs.
- **RB-2 (co-registrant detection).** L8-12 stands. Its detection must use the **filing's own EDGAR filer list** (any accession with more than one filer whose cover names a non-parent issuer), not cover-name heuristics alone.
- **RB-3 (remarketings).** §7.3 rule 1 also matches `\bThis is a remarketing\b` (or "remarketing of") in the first 3,000 visible characters. It runs only on filings with no prior skip, and the moved rows (here, 1 filing) need my sign-off. If the Founder prefers to keep remarketed debt as bonds, rule 1 instead drops "remarketing" in v2. Until then, rule 1 governs.

## 3. Name-match links (C3 proposals): all three SIGNED

Each becomes `link_method = 'manual'`, confidence 100, with the evidence below in `note`. LANE-8-ENG applies them **after 24 Oct**, because the 011 window freezes other Entities writers 17 → 24 Oct (FREEZES `cdc9606a…c346`).

| Issuer (filer CIK) | Entity | Evidence | Decision |
|---|---|---|---|
| Lowe's Companies, Inc. (**0000060667**; e.g. 424B2 `0001193125-25-216381` under `edgar/data/60667`) | **1753** "Lowe's Companies, Inc.", LEI `WAFCR4OKGSC504WU3E95` (ACTIVE) | GLEIF: legal name "Lowe's Companies, Inc.", US, ISSUED, ACTIVE (updated 2026-06-12). Exact name and LEI match; the cover issuer is the filer itself. | **SIGNED** |
| NextEra Energy Capital Holdings, Inc. (**0000794447**; registration 333-278184-02, co-registrant on NextEra filings) | **27953** "NEXTERA ENERGY CAPITAL HOLDINGS, INC.", LEI `UMI46YPGBLUE4VGNNT48` | GLEIF: "NEXTERA ENERGY CAPITAL HOLDINGS, INC.", US, ISSUED, ACTIVE (2026-07-30). The cover names it as issuer, guaranteed by NextEra Energy, Inc. Its own entity, not the parent 1421 (L8-4). | **SIGNED** |
| Welltower OP LLC (**0001917598**; e.g. `0001193125-25-148908`, cover "Welltower OP LLC (the “issuer”) … guaranteed by Welltower Inc.") | **2289** "WELLTOWER OP LLC", LEI `T6IZ0MBEG5ACZDTR7D06` | GLEIF: "WELLTOWER OP LLC", US, ISSUED, ACTIVE (2026-04-01). The name and LEI match. Entity 2289's stored `cik` is wrong (DQ-1); the link is keyed on the bond CIK 0001917598, so it is correct regardless. | **SIGNED** (DQ-1 is fixed separately) |

**Duplicates seen while checking** (no-LEI twins of the signed entities; for 013's twin list, not for this packet):
- Lowe's 100552, 104040, 260119;
- NextEra Energy Capital 3359;
- Welltower OP 245698.

## 4. DQ items for MA-OCT-004 (confirmed, with corrections and one addition)

| # | Item | Confirmed? | Proposed resolution |
|---|---|---|---|
| DQ-1 | Entity **2289** (Welltower OP LLC, LEI `T6IZ0MBEG5ACZDTR7D06`) stores `cik = 0000766704`, which is **Welltower Inc's** CIK (Pack C `packc-b3.json` / `packc-c2.json`) | **Confirmed** | 004 `identity_mismatch`: set 2289's `cik` to **0001917598**. A single Entities-domain `UPDATE`, ~2 writes, after 24 Oct, owner Data-Identity Lead. No bond row changes. |
| DQ-2 | **Welltower Inc** (CIK 0000766704, LEI `254900F33BIAR82QTA19`) has no entity | **Confirmed.** A name search of the 16 Oct export finds only the OP LLC rows 2289 and 245698. | 004 `missing_entity`: manual creation from GLEIF Level 1 (never automatic, §11.1), then a `manual` link. **Low priority:** under its own CIK, Welltower Inc has 0 final bond rows (all its filings are equity skips). |
| DQ-3 | **GM Financial** (CIK 0000804269, LEI `5493008B6JBRUJ90QL97`) has "no entity" | **Corrected.** There is no entity *with that LEI*, but there are **3 no-LEI candidates**, themselves duplicates: 3324 "GENERAL MOTORS FINL CO", 30187 "General Motors Financial Co Inc", 103981 "GENERAL MOTORS FINANCIAL COMPANY INC". | 004 ticket plus 013 input: resolve the cluster to one survivor (S1), give the survivor the LEI with a manual Level-1 write, then a `manual` link. Do not create a fourth row. |
| DQ-4 | **Pfizer Netherlands International Finance B.V.** (CIK 0002058265, LEI `254900YI79T8NMNA4349`) has "no entity" | **Corrected.** Candidate **106006** "Pfizer Netherlands International Finance BV" (NL, no LEI) | 004 ticket: confirm 106006 against GLEIF and assign the LEI manually, then a `manual` link. |
| DQ-5 (new) | **PepsiCo Singapore Financing I Pte. Ltd.** (CIK **0002007029**): its 4 rows are under PepsiCo (P-1) | New | Rows move under R-1. Candidate entities 3367 "PEPSICO SINGAPORE FIN" and 31416 "Pepsico Singapore Financing I Pte Ltd" (SG, no LEI, duplicates). Same treatment as DQ-3: the link stays `unmatched` until resolved. |

## 5. What makes AC12 pass (after 24 Oct; LANE-8-ENG builds, I re-adjudicate)

- **R-1 (P-1).** Delete the 4 PepsiCo Singapore rows (`… WHERE accession_number = '0001104659-24-022370'`, under the headroom gate), then:
  - add a `bond_issuer_link` row for 0002007029 (`unmatched`, `paused`, L8-12);
  - re-ingest them under that CIK.

  About 16 deletes plus 18 inserts.
- **R-2 (P-2).** The parser reads the three spread wordings and the benchmark. Unit tests on rows 43, 44, 46 and one American Express fixed-to-floating. Re-parse by `DELETE … WHERE parser_version = 'bonds-1.1.0' AND cik IN (American Express, Toyota, Capital One, Home Depot)` and an incremental run (§7.1). About 1.3k writes, inside the 8k day cap.
- **R-3 (RB-2).** Re-scan every final filing's EDGAR filer list (≤ 326 index requests, inside the 1,500 cap) and report any other co-registrant under a parent CIK. **0 is expected** from my cover scan.
- **R-4 (RB-3).** Apply the remarketing rule and list any moved rows for my sign-off.
- **Re-test (AC12 re-run):**
  - I re-adjudicate the 4 error rows;
  - all 37 formerly spread-less rows, on the spread field;
  - a fresh 10-row random check of the re-parsed CIKs;
  - the R-3 result.

  **AC12 passes** if:
  - the 60-row figure (with corrections) is ≥ 98%;
  - there are 0 wrong-issuer links, both in the sample and in the R-3 population check;
  - the 37 spreads are ≥ 98% correct.

  **Until then, 009 must not read bond rows.**

**Stop point:** this report. Reply: "MA-OCT-008.DIL14 reported".
