# MA-NOV-BOND — Bonds BOND-01–12 for November — Specification v2

```text
PACKET:     MA-NOV-BOND.SPEC2 · Control v1 (dff8ba1f…3ff) · Task v1 (e2df6ede…167)
RUN:        r-20261121T205632Z-d760 · interactive · 2026-11-21
ROLE:       Data-Identity Lead + Architect (specification only)
STATUS:     DRAFT — for Founder spec approval (field set, schedule, cut order, decisions §17)
SUPERSEDES: MA-NOV-BOND_Spec.md v1 (b30a75ce…2e53) for scope and schedule. v1 §1–7 stay normative (see §1).
INPUTS:     content scope c16c8e19…5a03 (§4, §6) · spec v1 b30a75ce…2e53 · BOND.SPEC report 5068d502…ba0d (pins verified)
            Founder NML-1121-12: BOND-01–12 in November; BOND-07 facts only; BOND-10 link + section (page where it exists);
            BOND-12 every field checked against its source; §6 exclusions stay out.
EVIDENCE:   offline scan of all 325 cached final 424B filings + 154 cached term sheets (FWPs), 2024-01-03 → 2026-10-13,
            28 issuers · 1 read-only D1 SELECT (632 rows read) · 52/52 bond tests pass
```

Labels: **[scan]** = measured on 21 Nov by the offline scan (§2). **[D1]** = measured in D1 on 21 Nov. **[v1]** = from spec v1. **[est]** = an estimate, confirmed in the work unit named.

## 0 What changes from v1

| | v1 | v2 |
|---|---|---|
| Scope | BOND-01–05 MUST; parties (06/08/09/11) stretch; 07/10/12 December | **BOND-01–12 all MUST in November** (NML-1121-12) |
| BOND-07 | not in November | **Offering facts: 25 fields, extracted values only, no narrative** (§3) |
| BOND-10 | SEC link + "source part" | **Link + section per fact; page number where the filing prints one** (§5) |
| BOND-12 | "nothing to verify" | **Every shown field is checked against its source; a field that fails is hidden** (§6) |
| Schema | CR1 (2 columns); CR2 for parties | CR1 unchanged; **CR2 = one facts table + one parties table** (§7) |
| Writes | one apply | **two separate write approvals:** reliability (Thu 26), offering (Sat 28) (§9) |
| Non-goals | as scope §6, plus 07/10/12 | scope §6 only: no new issuers or document types; no prices, yields, valuation or credit analytics; no structured or market-linked notes; no generated narrative; no wholesale reproduction |

**User stories added (priority order, after v1's):**
- As a researcher on a bond, I want the deal's key facts (price to investors, issue date, how interest is paid, early repayment, what the money is for, bank fee) in one panel, each with a link to the place in the filing it came from, so that I can trust and check them.
- As a researcher, I want to see which banks sold the bond and in what role, kept separate from the trustee and guarantor.
- As a researcher, I want to see plainly when a fact is not in the filing, not applicable, or not read yet, so that a blank is never mistaken for "none".

## 1 Reliability (BOND-01–05) — carried from v1

v1 §1–7 are **unchanged and normative**: definitions and classes (§1.3), root causes C1–C9 (§2), targets T1–T5 (§3), fixes F1–F8 (§4), BOND-CR1 `status_reason` + `superseded_by` and the plain-language reason codes (§5), offline guarded reprocessing (§6), tests (§7). Changes:

1. **D1 re-measured [D1]:** 632 final rows, 325 filings; principal and maturity 632/632; coupon or spread 627/632; currency 632; CUSIP/ISIN 276/632 (43.7%, as v1); **seniority 245/632 set** (v1 said 374 blank; today 387 blank — the 13-row difference is not explained by this packet; U3 restates it); latest filing 2026-10-15.
2. **F6 (identifiers from term sheets) gains a second purpose.** The same FWP pairing feeds offering facts that the 424B leaves out: pricing date (148/154 FWPs print it), CUSIP/ISIN (153/154) and the bookrunner list (146/154) [scan].
3. **F4/F8 gain no new work.** The parser's new offering extractor is a separate module (§8) so that the reliability diff stays reviewable on its own.
4. **v1 §8 (parties option) and §9 (schedule) are replaced** by §4 and §10 of this spec.

## 2 How availability was measured

- **Corpus.** Every final filing in the 15 Oct snapshot (`state/dryrun-2026-10-15.json`, status `debt`): **325 filings, 636 tranche rows, 28 issuers, all 325 in the local cache** (`state/cache/`). The same 325 filings are final in D1 today. Plus **154 cached term sheets** (FWPs; 153 say "Rule 433"). This is the whole corpus, not a sample, so the "≥ 40" in the Task is met 8 times over.
- **Method.** A scratchpad script decoded each document with the parser's own `htmlToText()` and `findIdentifiers()` (pure functions) and ran a candidate rule per field. No network, no repo or D1 writes. Script sha256 `2f2e1a25…145a`, results `6f6a0e19…aa9cb` (scratchpad, not in the repo).
- **What the number means.** "Available" = the rule found the field's label **and** a well-formed value in the document. It is **not** a correctness rate. A 21-filing plausibility look at the values found 2 bad discount values (a bare digit, a fallback that caught a price) and 1 trustee problem (Toyota, below). Correctness is BOND-12's job (§6).
- **Three document families** decide the rules. They are told apart by the first 3,000 characters:

| Family | What it is | Filings | Issuers |
|---|---|---|---|
| **A Prospectus supplement** | Syndicated deal: cover with a price/discount/proceeds table, summary, "Description of the Notes", "Underwriting", printed page numbers S-1… | 154 (424B2 116, 424B5 38) | 27 |
| **B Pricing supplement (key: value)** | MTN programme drawdown: "Issue Price: …", "Trade Date: …", "Agent: …" lines | 148 (424B2 111, 424B3 37) | Toyota 76, Caterpillar 37, Deere 35 |
| **C Retail note table** | Table with one row per CUSIP: selling price, concession, coupon, maturity, survivor's option | 23 | Verizon 17, GM 6 |

## 3 BOND-07 Offering facts — field set

**Status rule:** a field that measured **≥ 50%** available on the 325 filings is **Required** (the extractor must try it on every filing, and a miss is a defect to explain). A field **< 50%** is **Show where found** (shown when present; its absence is normal).
**Level (BOND-08):** **T** = per tranche (stored per `tranche_seq`), **O** = whole offering (stored once per filing, applies to all its tranches).
**Not-shown states (BOND-09):** `not_disclosed` → "Not stated in the filing" · `not_applicable` → "Not applicable" · no row → "Not read yet". The rule column says when each applies. Nothing is inferred.

### 3.1 Identity

| # | Field (plain label) | Where it appears | Available [scan] (A · B · C · FWP) | Lvl | Extraction rule | Type | Status | Not-shown rule |
|---|---|---|---|---|---|---|---|---|
| 1 | **Issuer** | cover; `bond_issuer_link` | 325/325 **100%** | O | existing link (no new extraction) | entity link | Required | — |
| 2 | **Guaranteed by** | cover "fully and unconditionally guaranteed by …"; "Guarantor:" | 42/325 **13%** (42 · 0 · 0 · 4) | O | name after the guarantee phrase on the cover; stored as a party (§4) | party | Show where found | none found → "Not stated in the filing" |
| 3 | **Date of this document** | A: "Prospectus Supplement [dated] <date>" or the date under the bank names on the cover; B/C: "Pricing Supplement No. x dated <date>" | 309/325 **95%** (138/154 · 148/148 · 23/23 · 61/154) | O | first date bound to the *supplement itself*; a date preceded by "to", "and", "(" or "supplemented by" is the base document's and is skipped | date | Required | — |
| 4 | **CUSIP / ISIN** | A: rarely (27/154); B/C: always; FWP: 153/154 | in 424B text 198/325 (27 · 148 · 23); on D1 rows 276/632 **44%** | T | v1 F6: check digit + one tranche only | id | Show where found (T3 target ≥ 60%) | not in 424B **or** paired FWP → "Not stated in the filing"; present but not assigned → "Not read yet" |

### 3.2 Terms

| # | Field | Where | Available | Lvl | Rule | Type | Status | Not-shown |
|---|---|---|---|---|---|---|---|---|
| 5–8 | **Amount · Currency · Interest rate (or margin over benchmark) · Matures** | cover lines; terms block | [D1] 632 · 632 · 627 · 632 of 632 | T | existing `bond_issuance` columns; no change | number/code/date | Required | as v1 (partial row names what is missing) |
| 9 | **Price to investors** (% of principal) | A: cover table "Public Offering Price / Price to Public" per tranche; B: "Issue Price:"/"Price to Public:"; C: "Selling Price" column | 317/325 **98%** (152 · 148 · 17 · 152) | T | A: read the cover table by column header, one value per tranche label ("2028 Notes 99.954 %"); B: label value; C: row by CUSIP | % | Required | — |
| 10 | **Interest paid** (how often, on which dates, first payment) | "Interest Payment Dates:"; "We will pay interest … semi-annually … on each 15 June and 15 December … first … 15 Dec 2025" | 309/325 **95%** (144 · 148 · 17 · 148) | T | frequency word + day/month list + first date, from the sentence that names the tranche | short text | Required | floating notes: same rule, frequency only if printed |
| 11 | **How interest is counted** (e.g. "30/360") | "Day Count Convention:"; "on the basis of a 360-day year of twelve 30-day months" | 278/325 **86%** (154 · 124 · 0 · 122) | T | closed list: 30/360 · Actual/360 · Actual/365 · Actual/Actual | code | Required | C (retail tables print none) → "Not stated in the filing" |

### 3.3 Dates

| # | Field | Where | Available | Lvl | Rule | Type | Status | Not-shown |
|---|---|---|---|---|---|---|---|---|
| 12 | **Priced on** | B: "Trade Date[/Pricing Effective Time]:"; C: trade date; FWP: "Trade Date:"/"Pricing Date:" | labelled in the 424B 147/325 **45%** (12 · 112 · 23); FWP 148/154 | O | only a labelled pricing or trade date, from the 424B or the same-deal FWP. **Never derived** from the document date | date | Show where found (≈ 80% with FWPs [est, U7]) | not labelled → "Not stated in the filing" |
| 13 | **Issue date** (settlement) | "Settlement Date:", "Original Issue Date:", "Date of Issue:", cover "delivery … on or about <date>" | 308/325 **95%** (146 · 147 · 15 · 127) | O (T if a tranche prints its own) | labelled date first, then the cover "on or about" date (shown as "on or about") | date | Required | — |

### 3.4 Structure

| # | Field | Where | Available | Lvl | Rule | Type | Status | Not-shown |
|---|---|---|---|---|---|---|---|---|
| 14 | **Ranking** (Senior · Subordinated · Junior subordinated) | cover title; "will be our senior unsecured obligations"; "Ranking" | text 211/325 **65%** (153 · 35 · 23); D1 column 245/632 | T | title word first; else the "will be our … obligations" sentence in the description | code | Required | B (most print none) → "Not stated in the filing" |
| 15 | **Secured or unsecured** | "unsecured", "will not be secured" | 177/325 **54%** (154 · 0 · 23) | T | the obligations sentence; closed list secured / unsecured | code | Required | B → "Not stated in the filing" |
| 16 | **Early repayment by the issuer** | A: "Optional Redemption" section (make-whole, par call date per tranche); B: "Redemption:", "Redemption Dates:", "Redemption Provisions: None"; C: "Callable at 100% on …" | 325/325 have redemption wording: 311 by the rule + 14 Caterpillar with a variant wording [scan, rule extended in U7]; explicit "no early repayment" 70 + Deere 35 | T | short structured value only: **Can repay early:** yes / no · **from:** first call or par-call date · **price:** "at par" / "greater of par and a make-whole amount" · **tax redemption:** yes/no. Plus the section link | struct | Required | "Redemption Provisions: None" / "not redeemable prior to maturity" → **"No — the filing says the notes can't be repaid early"** (a disclosed value, not a blank) |
| 17 | **Buy-back if control changes** | "Change of Control" offer | 75/325 23% (75 · 0 · 0) | O | yes + price ("101% of principal") | struct | Show where found | absent → row not shown |
| 18 | **Mandatory early repayment if a deal fails** | "Special Mandatory Redemption" | 5/325 2% | O | yes + trigger date if printed | struct | Show where found | absent → not shown |
| 19 | **Repayment on the holder's death** (survivor's option) | C tables | 17/325 5% (C 17/23) | T | yes/no column | bool | Show where found | absent → not shown |

### 3.5 Purpose and economics

| # | Field | Where | Available | Lvl | Rule | Type | Status | Not-shown |
|---|---|---|---|---|---|---|---|---|
| 20 | **What the money is for** | "Use of Proceeds" section (A); Toyota B: "Use of Proceeds and Hedging" pointing to the base document | 203/325 **62%** (141 · 62 · 0) | O | **categories only**, from a closed list: general corporate purposes · repay or refinance debt · fund an acquisition (named only if the filing names it) · working capital · capital spending · share buybacks · eligible green or social projects · other. Plus the section link. No sentence is copied | list | Required | B/C pointing elsewhere → "Not stated in the filing — described in the base prospectus" (we do not fetch base prospectuses, §11) |
| 21 | **Bank fee** (discount or commission, % of principal) | A cover table "Underwriting Discount"; B "Agent's Discount or Commission:"; C "Concession" column | 280/325 **86%** (150 · 113 · 17 · 57) | T | the column or label value; must be > 0 and < 5% | % | Required | "Not stated in the filing" |
| 22 | **Proceeds to the issuer before expenses** | A cover table "Proceeds to [us] (before expenses)" per tranche; "net proceeds … approximately $X"; B "Net Proceeds to Issuer:" | label 272/325 **84%** (142 · 113 · 17 · 107) | T (%) + O (total $) | A: cover column per tranche + the "approximately $X" total; B/C: label value | % / amount | Required | "Not stated in the filing" |

### 3.6 Distribution and conditions

| # | Field | Where | Available | Lvl | Rule | Type | Status | Not-shown |
|---|---|---|---|---|---|---|---|---|
| 23 | **Banks that sold the bonds** (§4) | cover back page; "Underwriting"; B "Agent:" / Deere "Plan of Distribution: Name …"; FWP | **any intermediary 324/325 (100%)**: bookrunner label 200 · co-managers 146 · agents 213 · underwriter list 157 (A table 122 + Deere 35) | O (T where printed) | §4 | parties | Required | per role group, §4.3 |
| 24 | **Trustee** (§4) | "Trustee:" line; "… between us and <bank>, as trustee" | 236/325 **73%** (154 · 76 · 6) | O | closed list of trustee institutions within the sentence that says "as trustee"; see §4.4 for Toyota | party | Required | Caterpillar/Deere B (0/72) → "Not stated in the filing" |
| 25 | **Risks** | "Risk Factors" section or pointer | 214/325 **66%** (152 · 62 · 0) | O | **section link + one-line heading only** ("Risk factors — page S-3"). No text | link | Required | C (none) → "Not stated in the filing" |
| 26 | **Where the notes may not be sold** | "Selling Restrictions", "Notice to prospective investors in …", "European Economic Area" | 191/325 **59%** (154 · 37 · 0 · 70) | O | section link + the list of places named in the headings (e.g. "EEA, UK, Canada, Hong Kong, Japan") | link + list | Required | "Not stated in the filing" |
| 27 | **Bank conflicts of interest** | "Conflicts of Interest" heading | 125/325 38% | O | section link + heading only | link | Show where found | not shown |
| 28 | **Listing** | "We intend to apply to list …" / "We do not intend to list …" | 134/325 41% | O | exchange name or "Not listed" | short text | Show where found | not shown |

That is **24 offering facts plus the 4 existing term columns**. Every value is short (a date, a number, a code, a list of names or categories, a link). The longest shown value is a list of bank names.

## 4 BOND-06 and BOND-11 Parties

### 4.1 Role vocabulary

| Stored `role` | Plain label | Printed roles mapped to it (kept verbatim in `role_printed`) |
|---|---|---|
| `bookrunner` | **Lead banks (bookrunners)** | Joint Book-Running Managers · Book-Running Manager(s) · Joint Lead Managers and Bookrunners · Lead Managers |
| `co_manager` | **Other managing banks** | Co-Managers · Senior Co-Managers · Junior Co-Managers · Passive Bookrunners |
| `underwriter` | **Underwriters** | a bank in the underwriting table, or in Deere's "Plan of Distribution" list, with no other printed role |
| `agent` | **Selling agents** | Agent(s) · Purchasing Agent · Lead Agent (B and C families) |
| `trustee` | **Trustee** | Trustee · Trustee, Registrar and Paying Agent |
| `guarantor` | **Guaranteed by** | the guarantee phrase on the cover |
| `other` | **Other** | Paying Agent, Calculation Agent, Registrar, Exchange Agent, when printed as a separate entity |

The **issuer** is not stored again; it comes from `bond_issuer_link`.

### 4.2 Extraction rule

1. **Cover block.** Read the bank block on the cover (first 9,000 characters) by its printed headings, top to bottom. Each heading opens a role; each name until the next heading gets that role.
2. **Underwriting section** (A) or **"Plan of Distribution: Name"** list (Deere). These are used only to add banks that are not on the cover, with role `underwriter`. They never change a role read from the cover. Amounts per bank are **not** stored (v1 decision, unchanged).
3. **B/C labels:** "Agent:", "Agents:", "Purchasing Agent:".
4. **Same-deal FWP:** used only when the 424B has no bank block. It is marked `source_doc = fwp`.
5. **Names** are normalised by whitespace only (no merging of "BofA Securities" with "BofA Securities, Inc."); the printed form is kept.
6. **Tranche-specific roles (BOND-08):** "(for the 2036 notes)" after a name maps by maturity year to exactly one `tranche_seq`. If that is ambiguous, the party stays offering-level and the printed qualifier is kept in `role_printed`.

### 4.3 States per role group (BOND-09)

- `disclosed`: at least one name found.
- `not_disclosed`: the block or label exists and names none (e.g. no co-managers).
- `not_applicable`: only by document family: co-managers and bookrunners on a B or C pricing supplement that names an agent; agents on an A prospectus supplement with a bookrunner block.
- no row: the block was not found → "Not read yet".

### 4.4 BOND-11 Intermediaries vs issuer, guarantor and trustee

- The UI shows **two separate blocks**: "Who issued and protects the bonds" (Issuer · Guaranteed by · Trustee) and "Banks that sold the bonds" (bookrunners, other managing banks, underwriters, selling agents).
- A name stored as `trustee` or `guarantor` in a filing is **never** also stored as an intermediary for that filing (checked; a clash fails the filing's parties and leaves "Not read yet").
- **Trustee only from a closed list of trustee institutions** found within the "as trustee" sentence (BNY Mellon [Trust Company, N.A.], U.S. Bank [Trust Company,] National Association, Computershare Trust Company, Deutsche Bank Trust Company Americas, Wells Fargo Bank N.A., Citibank N.A., Regions, Truist, HSBC Bank USA). Seen [scan]: BNY Mellon Trust Co 133, U.S. Bank Trust Co 35, BNY Mellon 33, Computershare 26, Deutsche Bank TCA 8, U.S. Bank N.A. 1.
- **Toyota finding:** Toyota pricing supplements recite an indenture history that names **two** trustees (BNY Mellon originally, Deutsche Bank Trust Company Americas later). A "first name found" rule picks the wrong one. Rule: when a filing names more than one trustee institution, the trustee is stored only if one is stated as the current trustee; otherwise "Not read yet". Decision D9.

## 5 BOND-10 Source references

Every stored fact and party carries where it came from:

| Column | Meaning | Available [scan] |
|---|---|---|
| `source_url` | the SEC document URL (424B or FWP), as on `bond_issuance` | 100% |
| `source_doc` | `424b` or `fwp` | 100% |
| `source_part` | cover · cover table · summary · description of the notes · optional redemption · use of proceeds · underwriting · pricing terms · retail table · term sheet | 100% (the rule knows which part it read) |
| `source_heading` | the nearest printed heading above the fact, ≤ 80 characters | A: 154/154 have printed section headings; B/C: the label ("Issue Price") is the heading |
| `source_anchor` | the filing's own HTML anchor for that section, from its table-of-contents links (`href="#…"`) | A: **135/154** have ≥ 3 internal anchors; B/C: 0 |
| `source_page` | the printed page: the next "S-n" / "PS-n" marker after the fact; "cover" before the first marker | A: **154/154** print page markers; B/C: **0/171** (one- to three-page documents) |
| `char_offset` | the character position in the decoded text, for the verifier's tool only (not shown) | 100% |

**Rules:**
- A page is stored only when the markers run in order (S-1 < S-2 …). Otherwise it is NULL and only the section is shown.
- The link shown is `source_url#source_anchor` when an anchor exists, else `source_url`.
- Shown as, for example: "From the prospectus supplement — Underwriting, page S-21" or "From the pricing supplement — 'Redemption'". The text of the section is never copied.
- Overall, **page numbers can be shown for 154 of 325 filings (47%)**: all prospectus supplements, no pricing supplements. This is what "page where available" means here.

## 6 BOND-12 Verification

### 6.1 Automatic checks (every fact, every run; a failing fact is not stored and the run log records why)

| Field | Check |
|---|---|
| Price to investors | 90 ≤ value ≤ 101; one value per tranche when the table lists several |
| Bank fee | 0 < value < 5 (%); price − fee = proceeds % within 0.01 when all three are in the cover table |
| Proceeds total | within 0.5% of Σ(principal × proceeds %) when both exist |
| Dates | document date ≤ issue date ≤ maturity; priced on ≤ issue date; issue date within 1–15 business days of the document date |
| Interest paid | the printed months are consistent with the frequency (2 months for semi-annual) |
| Early repayment | par-call date < maturity of the same tranche |
| Identifiers | v1 rule (check digit, one tranche) |
| Term sheet vs filing | when both print price, CUSIP or issue date, they must agree; a disagreement stores neither and records `fwp_conflict` |
| Parties | trustee/guarantor not also an intermediary; every name inside its printed block; no tranche-specific party on a tranche that does not exist |
| Every fact | a stored `source_part` and `char_offset`; no value without a source |

### 6.2 The 20-filing manual check

The Data-Identity Lead opens each SEC document and compares **every shown fact and party** with it, using a check sheet (filing, field, shown value, source value, correct Y/N, note). Stratified so each layout is covered:

| Family | Filings |
|---|---|
| A 424B5 syndicated, USD | 4 (incl. UNH 4-tranche, ICE tranche-specific roles) |
| A 424B2 syndicated, multi-tranche | 4 (incl. one EUR: AT&T or Verizon; one guaranteed subsidiary: PepsiCo SG or Pfizer NL) |
| A with a change-of-control or special mandatory redemption | 2 |
| B Toyota · Caterpillar · Deere | 2 · 2 · 2 |
| C Verizon · GM | 2 · 2 |

At least **5 of the 20 are multi-tranche**, and the 20 cover at least 12 issuers. The sheet is saved under `bonds/state/` and summarised in the packet report.

### 6.3 Acceptance thresholds

- **≥ 95% of checked facts correct overall, and ≥ 95% per field.** A field below 95% is **hidden for November** (stored rows set to "Not read yet" in the API), not shown with errors.
- **0 wrong party roles · 0 trustee or guarantor listed as a selling bank · 0 facts on the wrong tranche · 0 shown values with no source location.** Any one of these blocks the offering release until fixed and re-checked.
- The automatic checks of §6.1 pass on the whole corpus with every failure listed.

## 7 Schema — BOND-CR2 (outline for its Change Request)

**Owner:** Data-Identity Lead. **Domain:** Entities (sole inserter `bonds-ingest.mjs`, as 008). **Migration:** `migrations/ma-nov-bond-cr2-offering.sql`. It is written up with CR1 on Sun 22; it is applied separately (§9).

```sql
CREATE TABLE IF NOT EXISTS bond_offering_fact (
  accession_number TEXT NOT NULL,
  tranche_seq      INTEGER NOT NULL,          -- 0 = whole offering; 1..n = the bond_issuance tranche
  field            TEXT NOT NULL,             -- closed list, §3 (e.g. 'issue_price_pct', 'interest_paid', 'use_of_proceeds')
  state            TEXT NOT NULL CHECK (state IN ('disclosed','not_disclosed','not_applicable')),
  value_text       TEXT NULL,                 -- short value or JSON for struct/list fields; ≤ 300 chars (checked)
  value_num        REAL NULL,
  value_date       TEXT NULL,
  source_doc       TEXT NOT NULL CHECK (source_doc IN ('424b','fwp')),
  source_url       TEXT NOT NULL,
  source_part      TEXT NOT NULL,
  source_heading   TEXT NULL,
  source_anchor    TEXT NULL,
  source_page      TEXT NULL,
  char_offset      INTEGER NULL,
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, tranche_seq, field)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS bond_offering_party (
  accession_number TEXT NOT NULL,
  party_seq        INTEGER NOT NULL,
  tranche_seq      INTEGER NOT NULL DEFAULT 0, -- 0 = all tranches
  party_name       TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('bookrunner','co_manager','underwriter','agent','trustee','guarantor','other')),
  role_printed     TEXT NULL,
  source_doc       TEXT NOT NULL CHECK (source_doc IN ('424b','fwp')),
  source_url       TEXT NOT NULL,
  source_part      TEXT NOT NULL,
  source_page      TEXT NULL,
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, party_seq)
) WITHOUT ROWID;
```

- **Keys and indexes.** Primary keys only; **no secondary index**. Every read is by `accession_number` (a PK prefix range). The role-group states are rows in `bond_offering_fact` with `field = 'parties.<role>'`. **No row means "Not read yet"**, so no rows are written for unread fields.
- **Links.** `(accession_number, tranche_seq)` matches `bond_issuance` for tranche facts. There is no foreign key (D1 practice in 008). A re-parse that changes a filing's tranche set deletes and rewrites that filing's facts in the same guarded group.
- **Write volume [est, confirmed by the U7 dry run].** Offering-level ≈ 14 fields × 325 × ~0.85 ≈ 3,900 rows; tranche-level ≈ 9 fields × 632 × ~0.9 ≈ 5,100; parties ≈ 325 × ~9 ≈ 2,900. **≈ 12,000 row-writes in total** (WITHOUT ROWID, PK only: one write per row). That is **two guarded runs of ≤ 8,000** (v1's `run_cap_writes`, unchanged). Storage ≈ 4 MB.
- **Reads.** The bond detail route reads ≤ 60 fact rows + ≤ 20 party rows per bond; the issuer page reads none (it links to the bond).
- **Three-point check.**
  1. **Writes:** ≈ 12k on Sat 28 after the 06:00 back-fill (≤ 40k): Sat total ≤ ~53k, under the 60k headroom ceiling and the 100k/day cap.
  2. **Reads:** under 1k per run (headroom checks only; parsing is offline); ≈ 80 per bond view.
  3. **Cron and windows:** no cron trigger (capacity last seen 5/5); a manual local run, refusing the 05:50–07:10Z freeze, never Monday (seed ≈ 37.5k) or Sunday morning (holdings ≈ 80k).
- **Rollback.** `DROP TABLE bond_offering_fact; DROP TABLE bond_offering_party;` (nothing references them), or, per run, the generated rollback file `DELETE … WHERE parser_version = ? AND accession_number IN (…)`. API and UI treat a missing table as "Not read yet" (a code check in U9), so a rollback never breaks the bond page.

## 8 No narrative, no wholesale reproduction

- Values are **short extracted facts**: dates, numbers, codes, names, categories, links. No sentence from the filing is stored or shown. The longest stored value is ≤ 300 characters (checked by the table and by §6.1).
- Risks, selling restrictions and conflicts of interest are shown **only as a section link with its one-line heading** and the page where printed.
- "What the money is for" is a list of categories from a closed vocabulary, not the filing's wording.
- No text is generated. The panel footer says: **"Facts copied from the SEC filing, with a link to where each one appears. We don't summarise or interpret the filing."**

## 9 Processing and write approvals

- **One parser release, two applies.** Parser `bonds-1.3.0` carries the reliability fixes (v1 F1–F8) and a separate `bonds-offering.mjs` extractor (pure, no I/O). The offline whole-corpus run produces two diffs: **reliability** (`bond_issuance` changes, v1 §6) and **offering** (new rows in the two CR2 tables).
- **Write approval 1 — reliability (Thu 26 evening):** CR1 migration + guarded apply (v1 §6, ≤ 8k).
- **Write approval 2 — offering (Sat 28, after 08:00Z):** CR2 migration + two guarded runs ≤ 8k, `INSERT OR IGNORE` on the PKs (no duplicates on re-run), expected-count vector per batch, stop on first mismatch, rollback SQL with SHA-256 in the run log. Only filings whose reliability apply is final are processed (the offering depends on verified parsing).
- **Source:** cache only, 0 SEC requests. A filing missing from the cache is listed and skipped. If D6 (v1: one incremental SEC run Sat 28) is approved, its new filings get offering facts in the same Sat 28 run after their own reliability check.

## 10 UI — "Offering details" and "Who's involved" (bond page, `ma-entities.js` FI block)

Plain labels; no jargon; existing `fi-row` and notice styles; no new colours or components. Phone width: one column, groups stack.

**Offering details** (examples from the UNH 2028 notes, filed 18 Jun 2025; the call date and page numbers are illustrative)

| Group | Rows (label → example) |
|---|---|
| The deal | Issuer → *UnitedHealth Group* · Guaranteed by → (only if found) · Date of this document → *17 Jun 2025* · Priced on → *17 Jun 2025* · Issue date → *on or about 20 Jun 2025* |
| This bond | Amount → *$500m* · Interest → *4.400% a year* · Interest paid → *Twice a year, 15 Jun and 15 Dec; first on 15 Dec 2025* · How interest is counted → *30/360* · Price to investors → *99.954%* · Matures → *15 Jun 2028* · Ranking → *Senior, unsecured* · CUSIP / ISIN → … · Early repayment → *Yes, from 15 May 2028 at par; before that at the greater of par and a make-whole amount* |
| Money and fees | What the money is for → *General corporate purposes; repay or refinance debt* · Bank fee → *0.250%* · Proceeds to the issuer before expenses → *99.704% · about $2.97bn for the whole deal* |
| To read in the filing | Risks → *Risk factors, page S-3* · Where the notes may not be sold → *EEA, UK, Switzerland, Canada… — Selling restrictions, page S-23* · Conflicts of interest → (if found) · Listing → (if found) |

**Who's involved**

- *Who issued and protects the bonds:* Issuer · Guaranteed by · Trustee.
- *Banks that sold the bonds:* Lead banks (bookrunners) · Other managing banks · Underwriters · Selling agents. Each name is followed by its printed role in small text (e.g. "Joint Book-Running Manager"), and "for the 2036 notes" where it applies.

**Every value** has a small "Source" link: "Prospectus supplement — Underwriting, page S-21" (opens the SEC document at the anchor when one exists).

**The three not-shown states**, same words everywhere:
- "Not stated in the filing" (`not_disclosed`)
- "Not applicable" (`not_applicable`)
- "Not read yet" (no row, or a field hidden by the §6.3 gate)

"Show where found" fields are left out when absent, rather than showing a state, so the panel stays short.

**Issuer page:** unchanged from v1 §5 (document counts); each bond row gains an "Offering details" link. **API:** v1 F2 (bond detail) gains `offering: { facts: [...], parties: [...], states: {...} }`, with one PK-range read per table.

## 11 Items that would need excluded scope — recorded, not designed around

Per the Control's stop gate. None blocks the packet; each is shown as a not-shown state:

1. **Base prospectuses / programme prospectus supplements** (Caterpillar and Deere trustee; Toyota and Caterpillar use of proceeds; Toyota redemption general terms). These would need a **new document type** fetched from SEC. Shown as "Not stated in the filing" with the filing's own pointer text as the source heading.
2. **Wells Fargo market-linked and other structured notes:** excluded (scope §6). They get no offering facts.
3. **Underwriting amounts per bank** (in 157 filings) are available, but they are allocation analytics, outside "who's involved". Not stored (v1 decision kept). D11.
4. **Yield to maturity, spread to Treasuries at pricing, re-offer yield** are printed on some FWPs. They are **pricing/yield analytics** (scope §6) and are not extracted.

## 12 Tests

- v1 §7 unchanged (52 existing + ≈14 reliability fixtures).
- **Offering fixtures (all from the existing 32 fixtures + cache, none fetched):** UNH (A, 4 tranches, cover table), ICE (A, tranche-specific roles), Oracle multi, Amazon CAD, AT&T EUR (anchors + pages), a PepsiCo SG guaranteed deal, Toyota callable (B, two-trustee history), Caterpillar 424B3 (B, Trade Date/Pricing Effective Time), Deere (B, Plan of Distribution list, "Redemption Provisions: None"), GM retail table (C, agents + trustee), Verizon retail (C), UNH FWP and Duke FWP (term-sheet facts + conflict case). **≈ 13 fixtures, every field asserted** (value, state, level, source part, page).
- **Whole-corpus offline run:** availability per field and family vs §3 (each Required field within 5 points of its measured figure, or explained), every §6.1 failure listed, 0 facts without a source.
- **UI:** each not-shown state renders; a "Show where found" field is absent when absent; phone width 375 px with no sideways scroll; source links open the SEC URL (+ anchor).

## 13 Cross-lane review (v1 §10 still applies)

- **Entities ownership:** CR2 adds two Entities-domain tables, owned by the Data-Identity Lead, written only by `bonds-ingest.mjs`; no change to `entity_id` or 013's tables. UI stays in `ma-entities.js`'s FI block; no cross-domain imports.
- **Write budget:** Thu 26 reliability ≤ 8k; Sat 28 offering ≈ 12k (2 runs) + D6 ≈ 1k; both after the 06:00 back-fill and behind the headroom gate.
- **Release Mon 23:** bond code starts after it (U2 on Mon 23 afternoon, local only). The bond UI is its own release (Sun 29): Worker deploy and Pages commit are separate and both recorded.

## 14 Work units, days and Founder checkpoints

One worker, one session at a time. Founder: ~2 checkpoints on weekdays, 3–5 at weekends. Sizes in packet-days.

| Day | Unit | Content | Size | Founder checkpoints |
|---|---|---|---|---|
| **Sun 22** | U0 | This spec v2 | — | **1** spec approval |
| | U1 BOND-CR | One Change Request document for CR1 (2 columns) + CR2 (2 tables): impact, three-point check, rollback | S 0.3 | **2** CR approval |
| **Mon 23** | U2 BOND.FIX1 | *after the release:* parser 1.3.0 reliability F1, F2, F3, F4, F7, F8 + fixtures + tests (local only) | M 1 | — (reviewed Tue) |
| **Tue 24** | U3 BOND.FIX2 | F5 + F6 (term-sheet pairing: identifiers + pricing date + banks); offline whole-corpus reliability dry run → diff, SQL + rollback; T2/T3 restated | M 1 | **1** U2 build review · **2** target confirm |
| **Wed 25** | U4 BOND.OFFER1 | `bonds-offering.mjs` part 1: parties (§4), identity, terms and dates (fields 1–13), source references (§5), automatic checks; fixtures; tests | M 1 | **1** build review |
| **Thu 26** | U5 BOND.REVIEW | Independent review of the reliability diff + U4 code; DIL 20-row reliability source check (v1 §7) | S 0.5 | — |
| | U6 BOND.APPLY1 | *evening:* CR1 migration + reliability apply (≤ 8k), Ops reconcile | S 0.5 | **2** **write approval 1** |
| **Fri 27** | U7 BOND.OFFER2 | Part 2: structure, economics and conditions (fields 14–22, 25–28); offline offering dry run on the post-apply corpus → availability vs §3, diff, SQL + rollback | M 1 | **1** offering dry-run summary |
| **Sat 28** | U8 BOND.VERIFY | 20-filing manual check (§6.2) → hide failing fields; **CR2 migration + offering apply** (2 runs ≤ 8k); D6 incremental run if approved | M 1 | **1** check result · **2** **write approval 2** · (3 D6) |
| **Sun 29** | U9 BOND.UI | API F1/F2/F3/F5 + offering; issuer counts, Offering details, Who's involved, Ops line; tests; Worker deploy + Pages release | M 1 | **1** release approval |
| | U10 BOND.CLOSE | BOND-05 report: before/after, remaining exceptions, availability as shipped, check sheet | S 0.3 | **2** accept |
| **Mon 30** | — | Demo | — | — |

**Total ≈ 7.6 packet-days in 7 days, with no buffer.** That is the main risk; the cut order below is how it is managed.

## 15 Cut order (within BOND-06–12) if a day slips

Drop from the top. Each step saves about half a packet-day.

1. **Show-where-found extras:** change-of-control buy-back (17), mandatory early repayment (18), survivor's option (19), conflicts of interest (27), listing (28).
2. **Page numbers** (BOND-10's page part): keep link + section heading only. Saves the page-marker logic and its checks.
3. **Tranche-specific bank roles** ("for the 2036 notes"): keep all parties offering-level.
4. **"Where the notes may not be sold"** list (26): keep the section link only, no list of places.
5. **Money and fees** (20, 21, 22) as one group.
6. **Early repayment** (16) reduced to "Can repay early: yes / no / not stated" + section link.

**Never cut:** banks with printed roles kept apart from issuer, guarantor and trustee (BOND-06/11); tranche-correct terms (BOND-08); the three not-shown states (BOND-09); link + section for every shown fact (BOND-10); the manual check and the 95% gate on whatever ships (BOND-12); and all of BOND-01–05 (v1 cut line). If U6 (write approval 1) slips past Fri 27, the offering apply moves to Sat 28 evening and steps 1–3 are cut automatically.

## 16 Acceptance (scope §4)

- Reliability: v1 T1–T5 met, or restated with arithmetic at U3 and accepted.
- Offering: every Required field shipped at ≥ 95% checked correctness, or hidden and listed; 0 role, tranche or trustee-as-bank errors; every shown fact has a working source link with its section; page shown on prospectus supplements.
- Demo Mon 30: an issuer with each class (v1), then a bond with Offering details and Who's involved, a multi-tranche deal showing per-tranche price and early repayment, and a pricing supplement showing "Not stated in the filing" for the trustee.

## 17 Open decisions for the Founder

1. **Field set (§3).** 24 offering facts + 4 existing terms; Required = measured ≥ 50% available; Show where found below that. *Recommend: approve.*
2. **Priced on.** Shown only where the filing or its same-deal term sheet labels it; never taken from the document date. *Recommend: approve.*
3. **What the money is for.** Categories from a closed list + section link; no sentence copied. *Recommend: approve.*
4. **Early repayment.** Short structured value (yes/no, from date, price basis, tax redemption) + section link. *Recommend: approve.*
5. **Page numbers.** Only where the filing prints them (all 154 prospectus supplements; none of the 171 pricing supplements, which show the label). *Recommend: approve.*
6. **BOND-CR2.** Two WITHOUT ROWID tables, PK only; no row = "Not read yet". One CR document with CR1 on Sun 22, applied separately. *Recommend: approve.*
7. **Two write approvals.** Reliability Thu 26 evening (≤ 8k); offering Sat 28 after 08:00Z (≈ 12k as two runs ≤ 8k). *Recommend: approve.*
8. **Verification gate.** A field under 95% in the 20-filing check is hidden for November; any role, tranche or trustee-as-bank error blocks the offering release. *Recommend: approve.*
9. **Toyota trustee.** Shown only when the filing states one current trustee; otherwise "Not read yet". *Recommend: approve.*
10. **Mon 23 bond work.** U2 runs on release day, after the release is done (local code only, no checkpoint). Without it, step 1–2 of the cut order are taken up front. *Recommend: approve.*
11. **Underwriting amounts per bank** stay out (allocation analytics; v1 decision). *Recommend: keep out.*
12. **Base prospectuses** are not fetched (new document type, scope §6). The affected fields say "Not stated in the filing — described in the base prospectus". *Recommend: approve.*
13. **v1 decisions:** D1–D6, D8 and D9 carry over unchanged. **D7 is replaced:** offering information is MUST, not stretch. *Recommend: confirm.*
