# MA-NOV-BOND — Bond reliability (BOND-01–05) + offering information option — Specification

```text
PACKET:     MA-NOV-BOND.SPEC · Control v1 (912bb492…7930) · Task v1 (0e1c261e…d48d)
RUN:        r-20261121T194350Z-f724 · interactive · 2026-11-21
ROLE:       Data-Identity Lead + Architect (specification only)
STATUS:     DRAFT — for Founder spec approval (target, cut line, decisions §11)
INPUTS:     content scope c16c8e19…5a03 (§4) · SA1 report 419e4337…ab3aea · BQ2 report 9b133cde…15102 (pins verified)
EVIDENCE:   7 read-only D1 SELECTs on 21 Nov (17,294 rows read) · stored state under App/Corporate Atlas/bonds/state/
            (dryrun-2026-10-15.json = per-tranche reasons; runlog.jsonl; r2/r4 SQL) · 32 fixtures · 52/52 bond tests pass
```

Numbers marked **[D1]** were measured on 21 Nov. Numbers marked **[snap]** come from the 15 Oct dry-run snapshot (parser 1.1.0), joined to D1 by accession. Numbers marked **[est]** are estimates; they are confirmed in work unit U3.

## 0 Problem, goals, non-goals

**Problem.** Meridian Atlas shows 632 bond tranches from SEC filings for 30 issuers. It says nothing about the other 311 filings it read. It does not say that 356 of the bonds it shows have no CUSIP/ISIN, so they cannot be linked to fund holdings. The data stops at 16 Oct. A user cannot tell "no bonds" from "we could not read them". That is a silent-failure problem, and the content scope forbids it (BOND-03).

**Goals (outcomes):**
1. **No silent rows.** Every filing we hold is either a complete bond, or carries a plain-language reason that the user and Ops can see.
2. **More of the supported debt parsed.** Raise the final share of in-scope debt tranches to the target in §3.
3. **More bonds linkable.** Raise the share of shown bonds that carry a CUSIP/ISIN (the key that links a bond to ETF holdings and instruments).
4. **A safe, repeatable re-parse.** Reprocess with source references, duplicate prevention and rollback, under the existing write cap.
5. *(Option)* **Who sold the bond.** Show the underwriters, bookrunners and agents with their printed roles, kept apart from the issuer, guarantor and trustee.

**Non-goals (November):** new issuers or document types (no broad ingestion programme, scope §6); bond prices, yields, valuation or credit analytics; structured or market-linked notes; generated narrative or summaries (BOND-12, decided: facts only); a wholesale prospectus summary (BOND-07) or section/page references (BOND-10). Those last two go to December, §8.4.

**User stories (priority order):**
- As a researcher on an issuer page, I want to see how many of the company's SEC offering filings were read, and why the rest are not shown. Then I can trust that "no bonds" means none, not "couldn't read".
- As a researcher opening a bond, I want to see which details the filing did not give us (for example "CUSIP not found"), so that I don't assume the record is complete.
- As a researcher, I want draft offering documents labelled as drafts, and linked to the final terms when those exist, so that drafts are never mistaken for bonds.
- As the Founder or Ops, I want one count of bond exceptions by reason, so that a new failure shows up the day it happens.
- *(Option)* As a researcher, I want to see the banks that sold a bond and their roles, kept separate from the trustee and guarantor, so that I know who placed the deal.

## 1 BOND-01 Inventory

### 1.1 Current counts [D1, 21 Nov]

943 rows. The latest filing date is 2026-10-16. The last write was 2026-10-30T21:18Z (R-4). `fi_serving_gate` has been `open` since 2026-10-30T21:21:43Z. The baseline matches BQ2 exactly.

| Status (D1) | Rows | By form | Parser |
|---|---|---|---|
| final | 632 (325 filings) | 424B2 456 · 424B5 139 · 424B3 37 | 1.1.0 467 · 1.2.0 165 |
| preliminary | 184 | 424B2 88 · 424B5 91 · 424B3 5 | 1.1.0 173 · 1.2.0 11 |
| skipped_other | 52 | 424B3 40 · 424B2 9 · 424B5 2 · 424B7 1 | |
| skipped_non_debt | 45 | 424B5 27 · 424B7 9 · 424B2 7 · 424B3 2 | |
| skipped_structured | 21 | 424B2 21 (all Wells Fargo) | |
| parse_failed | 9 (8 filings) | 424B2 7 · 424B5 2 | |

- **Multi-tranche filings:** 130 of the 325 final filings have 2 or more tranches; the largest has 11. By tranche count: 1×195, 2×61, 3×26, 4×17, 5×9, 6×7, 7×3, 8×4, 9×2, 11×1.
- **Filers:** 34 CIKs: the 30 configured issuers plus 4 subsidiary issuers (NextEra Energy Capital Holdings, Welltower OP, PepsiCo Singapore Financing I, Pfizer Netherlands International Finance). 27 are linked to an entity (24 by CIK, 3 by LEI); 7 are unmatched (3 active, 4 paused).
- **Quality of final rows:** 356 of 632 (56.3%) have **no CUSIP or ISIN**, so they have no `instrument_key`. 5 fixed-rate USD finals also have no coupon (all 5 are among the 356). All floating and fixed-to-floating finals have a spread and a benchmark. Seniority is blank on 374, which is normal: many covers do not say "senior". All 632 finals score parse confidence ≥ 70.

### 1.2 Per issuer [D1]

| Filer | final | prelim | failed | skipped |
|---|---|---|---|---|
| Toyota Motor Credit | 115 | 0 | 1 | 9 |
| Verizon | 52 | 28 | 1 | 2 |
| Amazon | 42 | 6 | 0 | 1 |
| Caterpillar Financial | 37 | 0 | 1 | 5 |
| John Deere Capital | 35 | 0 | 0 | 0 |
| GM Financial | 33 | 17 | 3 | 9 |
| NextEra Energy Capital Holdings | 31 | 0 | 0 | 1 |
| AT&T | 30 | 1 | 0 | 0 |
| American Express · AbbVie | 27 · 27 | 3 · 4 | 0 · 0 | 1 · 0 |
| Oracle | 24 | 5 | 0 | 4 |
| PepsiCo (+ Singapore sub 4) | 19 (+4) | 7 | 0 | 0 |
| UnitedHealth | 18 | 3 | 0 | 0 |
| Meta | 17 | 3 | 0 | 0 |
| Home Depot · Realty Income | 12 · 12 | 2 · 8 | 0 · 0 | 0 · 6 |
| Capital One · CVS · Dominion | 11 · 11 · 11 | 6 · 3 · 8 | 0 · 0 · 2 | 4 · 0 · 14 |
| Comcast · Duke | 9 · 9 | 1 · 7 | 0 · 1 | 1 · 9 |
| ICE · Pfizer (+ NL sub 4) | 7 · 7 (+4) | 3 · 2 | 0 · 0 | 1 · 0 |
| Southern · Welltower OP | 6 · 6 | 7 · 0 | 0 · 0 | 3 · 0 |
| Wells Fargo | 5 | **34** | 0 | 21 |
| Lowe's · Apple · Union Pacific | 5 · 4 · 2 | 1 · 1 · 1 | 0 | 0 · 0 · 1 |
| **NextEra Energy (parent)** | **0** | **18** | 0 | 5 |
| **Welltower (parent)** · **Boeing** | **0** · **0** | **3** · **2** | 0 | 17 · 4 |

### 1.3 Definitions (proposed for approval)

The **supported scope** is the 30 configured issuers and their co-registrant subsidiaries, forms 424B2 / 424B3 / 424B5 / 424B7, filed on or after 2024-01-01 (Wells Fargo capped at its 60 most recent 424B2s, ruling L8-1). FWPs are supporting documents (term sheets). They are never counted as rows.

A document is **in-scope debt** when it offers plain notes, debentures or bonds: fixed, floating or fixed-to-floating, including MTN pricing supplements and retail-note pricing supplements.

| User-facing class | Meaning | D1 basis |
|---|---|---|
| **Complete** | Final terms read: principal, maturity, coupon or spread + benchmark, **and** a CUSIP or ISIN | `final` with `cusip`/`isin` |
| **Partial** | Final terms read, but at least one of CUSIP/ISIN or coupon (fixed) / spread (floating) is missing. Shown, with what is missing named | `final`, derived from NULL fields; no new column |
| **Draft** | Preliminary offering document; terms are blank by design. It is not a bond. Sub-states: *replaced by final* (linked) / *no final found* | `preliminary` + reason (§5) |
| **Failure** | In-scope debt whose terms we could not read | `parse_failed` + reason |
| **Not covered (skipped)** | Read, and deliberately excluded by scope: structured / market-linked notes, shares / equity units / preferred / depositary shares, exchange offers, merger and consent documents, demand notes, remarketings, resale prospectuses, stock-purchase plans, MTN programme supplements that offer no specific notes | `skipped_*` + reason |
| **Unsupported** | Outside the supported scope entirely (other issuers, other forms, filings before 2024). It is not in the database, and the UI says the coverage is limited to the listed issuers | — |

## 2 BOND-02 Root causes

Tranche-level reasons are **not** in `runlog.jsonl`, which holds only filing-level rule and reason. They are in the dry-run snapshot `state/dryrun-2026-10-15.json` (`rows[].fail_reason`). The 16 Wells Fargo rows filed 15–16 Oct came later and are not in that snapshot. Everything else joins.

| # | Cause | Rows | Defect or expected | Evidence |
|---|---|---|---|---|
| C1 | **Draft documents.** Preliminary prospectus has blank amounts, coupons **and maturity years** ("notes due 20__") | 184 | Expected. Not a parser failure, but today they are silent | fixtures `unh-…-prelim`, `ice-…-prelim`; rules R2 152 · R2b 22 · B-1b 1 · later WF 9 [snap/D1] |
| C1a | …of which a final from the same CIK followed within 14 days | 153 | Expected (superseded), but the link is not stored | [D1] gaps: 21 same day, 89 ≤1 d, 124 ≤2 d, 145 ≤7 d |
| C1b | …final under a **subsidiary** CIK (NextEra parent 18 → NextEra Capital; Welltower 3 → Welltower OP) | 21 | **Defect:** matching ignores the issuer family | [D1] parent CIKs hold 0 finals |
| C1c | …preliminary for **shares or equity units**, classed `preliminary` because the draft check runs before the title gate (Oracle depositary shares, Boeing common + depositary, Duke and Southern equity units, NextEra equity units) | 6 confirmed, up to 9 | **Defect:** order of rules | fixture `duke-424b5-prelim-2026-08-10` is an equity-units draft; titles [snap] |
| C1d | …Wells Fargo preliminary pricing supplements (34). WF mostly issues market-linked notes, so the same-CIK 14-day "match" is meaningless for WF | 34 | Likely **defect** (title gate not applied to drafts) [est] | 21 WF finals are `skipped_structured`; only 5 WF finals |
| C1e | …final from the same CIK only > 14 days later (5), or only earlier (3) | 8 | Open; some are equity (AmEx, Duke) | [D1] |
| C2 | **MTN programme supplements** (Caterpillar Series L, Toyota Series B): "we plan to offer…", no notes offered | 2 | **Defect:** should be *not covered*, not *failed* | fail_reason "confidence 40; no full maturity; L8-14 no principal" [snap] |
| C3 | **Year-only maturity not resolved** (GM 5.000% 2027 + 5.450% 2030; Duke 6.45% reset junior sub 2054) | 3 | **Defect:** maturity wording not matched | "no full maturity" [snap] |
| C4 | **FWP disagreement capped confidence at 59** (Verizon 5.250% 2035; Dominion 2025 and 2026 Series B junior sub) | 3 | Investigate: likely a reopening (FWP total ≠ new tranche) or a mis-paired term sheet | "confidence 59" [snap] |
| C5 | **No tranche found** (GM 424B5, 5 Dec 2025) | 1 | Likely a programme supplement, like C2 [est] | filing-level [snap] |
| C6 | **Final but no CUSIP/ISIN** | 356 | **Defect, largest lever.** 309 of 357 [snap] had a same-deal FWP attached and still got no identifier, so `parseFwp` reads only 2 term-sheet layouts | test AC4 passes on the UNH layout "CUSIP / ISIN: … (2028 Notes)"; production misses most others |
| C7 | **Remarketing** (NextEra 0001193125-25-169329), moved by SQL (R-4, `bonds-1.2.0-r4`), not by the parser | 1 | Defect in the parser (carry 6): a re-parse would bring it back as final | `r4-nextera-2026-10-31.sql` |
| C8 | **Not covered (expected)**: demand notes 39 · merger/consent 5 · exchange offers 6 · resale of common stock 1 · remarketing 1 (C7) · shares/units/preferred/depositary 44 · stock plan 1 · structured 21 | 118 | Expected skips; today their reason is not visible | rules 7.3-1/2/3/5 [snap/D1] |
| C9 | **Stale universe.** Nothing filed after 16 Oct is in D1. Bond ingestion has no schedule (manual runner, last full run 16 Oct) | — | Operational, not a parser defect | cursor.json 16 Oct; `bond_issuer_link.last_polled_at` 15–16 Oct |

## 3 Target (for approval)

**Metric M1, final share of in-scope debt tranches** = final ÷ (final + parse_failed + drafts *not* replaced by a final), using the deal-level match in §4 F2.

- SA1's old definition counted every draft as a miss: 632 ÷ (632 + 9 + 184) = **76.6%**.
- With the interim same-CIK ≤ 14-day rule: 632 ÷ (632 + 9 + 31) = **94.0%** today.
- Projection after the fixes [est]: finals 632 + 3 (C3) = 635 · failed ≤ 3 · unmatched drafts ≈ 31 − 6 (C1c) − ~15 (C1b) ≈ 10 → 635 ÷ 648 ≈ **98.0%**.
- Worst case: the 33 WF "matches" fail the stricter deal-level rule and are not reclassified → ≈ 635 ÷ (635 + 3 + 43) ≈ **93.2%**.

**Proposed November target:**

| | Success | Stretch | Today |
|---|---|---|---|
| **T1 No silent rows.** Every row is Complete, or carries a visible stated reason (D1 column + UI + Ops count); 0 rows with an unknown reason | **100%** | — | 0% (no reasons stored) |
| **T2 M1 final share** of in-scope debt tranches | **≥ 95%** | ≥ 97% | 94.0% (76.6% old basis) |
| **T3 Linkable.** Share of final tranches with a CUSIP/ISIN | **≥ 60%** | ≥ 75% | 43.7% (276/632) |
| **T4 Failures.** `parse_failed` rows, each with a reason | **≤ 3** | 0 | 9 |
| **T5 No regressions.** Finals lost or changed without a listed reason | **0** | — | — |

T2 and T3 are re-confirmed, raised or lowered with stated arithmetic at the U3 checkpoint, once the offline re-parse gives real before/after numbers. T1, T4 and T5 are firm.

## 4 Fixes (BOND-02)

All parser changes ship as `bonds-1.3.0`. Each fix gets a fixture copied from the local cache, never fetched from the network (`state/cache/`: 845 documents, 32 MB, already on disk).

| Fix | Change | Expected effect | Fixture / test |
|---|---|---|---|
| **F1** Title gate for drafts (C1c, C1d) | Run the other → structured → non-debt classifier on a 424B draft **before** marking it `preliminary`; a non-debt or structured draft gets `skipped_*` with reason `draft_not_debt` / `draft_structured` | −6 to −9 equity drafts; WF −0 to −34 [est] | existing `duke-424b5-prelim-2026-08-10` → `skipped_non_debt`; new: one WF preliminary, one Boeing draft |
| **F2** Deal-level draft → final match (C1a, C1b, C1e) | In the runner (it holds discovery metadata): a draft is *replaced by final* when a final 424B from the **same issuer family** (parent + co-registrants from `bond_issuer_link` / co-registrant list) is filed 0–14 days later on the **same shelf file number**, **and** the number of tranche lines in the draft ("Notes due 20__") is ≤ the final's tranche count. Store the reason `superseded` and the final's accession (§5). No tranche-level link: drafts carry no tranche identity | ≈153 + up to 21 family matches marked; the rest show "no final found" | new pairs: `unh` and `ice` prelim/final (existing); NextEra parent draft + NextEra Capital final (cache) |
| **F3** Programme supplements (C2, C5) | Rule 5 (iv): "plan to offer and sell notes with various terms" / "With Maturities of 9 Months or More" with no priced terms → `skipped_other`, reason `program_supplement` | −2 to −3 failed | new: Cat Series L, Toyota Series B, GM 424B5 Dec 2025 |
| **F4** Maturity wording (C3) | Extend `MATURES` to the wordings in the 2 GM and 1 Duke filings (identified from cache in U2) | −3 failed, +3 final | new: GM 2025-05-28 (2 tranches), Duke 2024-08-20 |
| **F5** FWP disagreement (C4) | Investigate 3 rows. If it is a reopening, keep the 424B values and add the note "FWP total includes earlier issue". Otherwise leave failed, with reason `fwp_conflict` | −0 to −3 failed | new: Verizon 2025-03-26, Dominion ×2 |
| **F6** Identifiers from FWPs (C6) | Diagnose the 309 tranches offline: list the FWP layouts that fail, then add the common ones (per-tranche "CUSIP/ISIN:" lines, tables with one column per tranche, "CUSIP No." blocks). Fall back to labelled CUSIPs in the 424B body (`assignIdentifiers` already does this). Every assignment must still pass the check digit and match a single tranche (unchanged rule) | 356 → ≤ 250 partial (T3 60%) [est]; measured in U3 | 3 new multi-tranche FWP fixtures of the failing layouts |
| **F7** Remarketing in the parser (C7) | Rule: "Remarketing" / "remarketed" on the cover header → `skipped_other`, reason `remarketing` (makes R-4 reproducible) | 0 net (keeps the R-4 row skipped after re-parse) | new: NextEra 0001193125-25-169329 |
| **F8** Reason codes | The parser emits a `status_reason` for every non-final row and for each partial row (in the run log); the runner writes it for non-final rows (§5) | T1 | asserted on every fixture |

C9 (staleness) is not a parser fix. See decision D6.

## 5 Visibility (BOND-03)

**Where the reasons live.** The rule and the reason are not stored in D1, so they cannot be derived. **Proposed CR (BOND-CR1, own Change Request, owner Data-Identity Lead):** migration `ma-nov-bond-cr1-status-reason.sql` (name follows the `ma-…` pattern; no 009 clash) adds two nullable columns to `bond_issuance`:
- `status_reason TEXT NULL`: a code from a fixed list. Set on every non-final row; NULL on finals.
- `superseded_by TEXT NULL`: the final accession, set on drafts only.

The change is additive. Rollback: `ALTER TABLE bond_issuance DROP COLUMN …` (or leave the NULLs; no reader depends on them). It adds no index. "Partial" stays derived from NULL `cusip`/`isin`/`coupon_rate`/`spread_bps`, with no column.

**Reason codes → plain words (UI copy; no jargon):**

| Code | Shown as |
|---|---|
| `superseded` | "Draft offering document — replaced by the final terms filed {date}" (link) |
| `draft_no_final` | "Draft offering document — no final terms found" |
| `draft_not_debt` / `draft_structured` | "Draft for shares or units — not covered" / "Draft for notes linked to an index or stock — not covered" |
| `structured` | "Notes linked to an index, stock or basket — not covered" |
| `equity` / `stock_plan` | "Shares, units or preferred stock — not covered" / "Share purchase plan — not covered" |
| `exchange_offer` · `merger_document` · `demand_note` · `remarketing` · `resale` · `program_supplement` | "Exchange offer for existing bonds" · "Merger or consent document" · "Demand notes (not bonds)" · "Resale of existing notes" · "Resale by holders" · "Notes programme document — no specific notes offered" — each followed by "— not covered" |
| `no_maturity` · `no_principal` · `low_confidence` · `fwp_conflict` · `no_tranche` | "We couldn't read this filing's terms: {maturity date not stated in a form we read / amount not found / details didn't agree with the term sheet / no bond terms found}" |
| partial (derived) | On the bond: "Not found in the filing: CUSIP/ISIN" (or "coupon") |

**API (009 routes, `entities-api.js`):**
- F1/F1b (issuer and CIK bond lists) gain `documents: { shown, drafts_replaced, drafts_open, could_not_read, not_covered }`. This is one `GROUP BY filing_status, status_reason` over the issuer's CIKs (≤ ~150 rows read per issuer; measured in U6).
- F2 (bond detail) gains `missing: ['cusip', …]`.
- F3 (coverage) gains the same totals.
- One new route, **F5** `GET /api/fi/ciks/:cik/documents?cursor=`, lists non-final documents (date, form, plain reason, SEC link), 25 per page.
- The gate and served-row rules (`final`, confidence ≥ 60) do not change.

**UI (`ma-entities.js`, FI block only).** The issuer Bonds section footer reads: "From 45 SEC filings: 31 bonds shown · 4 draft documents · 1 filing we couldn't read · 9 not covered — show list". The list opens the F5 documents. A partial bond shows a small "Some details not found in the filing" line. The directory (#/fi) totals show the same four counts. There are no new colours or components beyond the existing `fi-row` and notice styles.

**Ops hook (light).** The Ops Health/DQ tab shows one line from F3 totals: "Bonds: 635 shown · 3 couldn't read · 0 unknown reason". A DQ ticket is raised only if `unknown` > 0 or `could_not_read` rises after a run. The existing M4 issuer DQ tickets are not reopened unless F1–F7 touch those issuers.

## 6 Reprocessing (BOND-04)

- **Scope:** the 943 rows held today. It touches reason codes on all 311 non-final rows, status changes from F1/F3/F4/F5/F7 (≈ 15–45 rows [est]), identifier fills from F6 (≈ 100–250 rows [est]) and `superseded_by` on ≈ 155–175 drafts.
- **Offline:** `bonds-ingest.mjs --offline` re-parses from `state/cache/` (845 documents) with **0 SEC requests**. Missing cache entries are listed and skipped, never fetched, under this packet chain.
- **Output first, writes later:** the dry run writes a diff file (row before → after, change type, rule, source URL) and the generated SQL + rollback SQL, as R-2/R-4 did. There are no D1 writes until the Founder approves the diff summary.
- **Statements:**
  - in-place changes: `UPDATE … WHERE accession_number=? AND tranche_seq=? AND filing_status=<old> AND parser_version=<old>` (optimistic guard).
  - status changes that change the tranche set (seq 0 ↔ 1..n): guarded INSERT OR IGNORE + DELETE pairs with `EXISTS` guards, the R-4 pattern (ruling L8-10).
  - every batch has an expected-changes vector, and the run stops on the first mismatch.
- **Duplicate prevention:** PK `(accession_number, tranche_seq)` + `INSERT OR IGNORE`. New `instrument_key` values are checked against existing keys, and a key already on another CIK is reported, not written. A re-parse never creates a second row for the same tranche.
- **Source references:** `source_url` is kept on every row; `parser_version` becomes `bonds-1.3.0`. The run log records the diff, SQL and rollback file SHA-256s.
- **Write budget:** ≤ 8,000 row-writes per run (`run_cap_writes`), with the existing headroom gate (account ceiling 60,000, F-1 window). Estimate ≈ 1,000–2,500 row-writes, counting index writes on `idx_bi_instrument` and `idx_bi_cik_final_key`: one run. The migration (2 ALTERs) is ≈ 0 row-writes.
- **Rollback:** the generated `*.rollback.sql` restores the exact prior row values, statement for statement (R-2/R-4 pattern), then the columns can be dropped. It is kept ≥ 30 days.
- **When:** a weekday evening (Tue–Fri ≥ 08:00Z), after the back-fill's 06:00 firing. The runner already refuses the 05:50–07:10Z freeze. Never on a Monday (entities-seed ≈ 37.5k writes) or on Sunday morning (holdings ≈ 80k).
- **Approval gate:** the Founder approves the diff summary (counts by change type + DIL's 20-row source check) before apply. Ops reconciles run-log ↔ D1 after.

## 7 Tests (BOND-05)

- The **existing 52 tests** (parse, ingest, filer-scan) must still pass. Previously successful fixtures keep identical output unless the diff lists the change.
- **New fixtures from cache** (≈ 14): WF preliminary · Boeing equity draft · NextEra parent draft + NextEra Capital final pair · Cat Series L + Toyota Series B + GM Dec 2025 programme supplements · GM 2025-05-28 two-tranche · Duke 2024-08-20 reset junior sub · Verizon 2035 · Dominion Series B · NextEra remarketing · 3 multi-tranche finals with FWP identifier layouts that fail today. Multi-tranche cases already covered: Oracle (multi), UNH (4 tranches + FWP), ICE (5 tranches + tranche-specific roles).
- **Whole-corpus offline check:** before/after counts by status × reason × issuer; partial counts; "no final lost" check (every old final is still final with the same principal, coupon and maturity, or is on the listed-change list); no row without a reason (T1).
- **Remaining exceptions report:** every non-Complete row after apply, with its reason and SEC link, saved under `bonds/state/` and summarised in the packet report.
- **Source check:** DIL hand-checks 20 changed rows against the SEC text (status, identifier, maturity), with 0 errors allowed.
- **API/UI:** the counts match D1. The F5 list pages correctly. The plain-language copy shows on an issuer with each class (GM: drafts, failed, not covered). There is a 375 px check.

## 8 Offering information option (BOND-06, 11, 08, 09)

### 8.1 Fields and where they come from

| Field | Source in the filing | Found in fixtures |
|---|---|---|
| Bookrunners / joint lead managers (printed role kept, e.g. "Joint Book-Running Managers") | 424B2/424B5 cover back page; FWP "Joint Book-Running Managers:" line | UNH, ICE, Oracle, Toyota FRN, Amazon (5/5 syndicated), Duke FWP |
| Co-managers / senior co-managers | same block ("Senior Co-Managers", "Co-Managers") | ICE, Oracle, Toyota, Amazon |
| Agents (MTN / retail notes) | pricing-supplement field "Agent:" / "Agents:" | GM final pricing supplement (InspereX; BofA, Morgan Stanley, RBC, Wells Fargo Advisors) |
| Trustee (BOND-11) | "Trustee" / "Trustee, Registrar and Paying Agent" line in the description of notes, or the pricing-supplement field | UNH, ICE, Oracle, Amazon, GM |
| Guarantor (BOND-11) | cover "Fully and Unconditionally Guaranteed by" (`coverIssuers().guaranteed` already detects it) | Welltower OP, PepsiCo SG, Pfizer NL |
| Issuer | `bond_issuer_link` (existing) | all |
| Tranche-specific role (BOND-08) | "(for the 2036 notes)" after a bank's name | ICE |

The underwriting-table amounts per bank are **not** in November.

### 8.2 Rules

- **BOND-08.** A party applies to **all tranches of its filing** unless the filing ties it to a tranche ("for the 20XX notes"). Then it maps by maturity year to exactly one `tranche_seq`, or stays filing-level if that is ambiguous. Tranche terms stay on `bond_issuance`, unchanged.
- **BOND-09.** Each party group (bookrunners, co-managers, agents, trustee, guarantor) gets a state:
  - `disclosed`: names found;
  - `not_disclosed`: the section we read exists and names none, e.g. no co-managers;
  - `not_applicable`: only where the document type has no such party, e.g. no guarantor line on an unguaranteed cover;
  - `not_extracted`: the section is not found, or the layout is unsupported.

  Shown as "Not stated in the filing" / "Not applicable" / "Not read yet". Nothing is inferred.
- **BOND-11.** Intermediaries (bookrunner, co-manager, agent) are shown in a block separate from issuer, guarantor and trustee. A bank named as trustee is never listed as an underwriter for the same filing.

### 8.3 Schema (own CR, BOND-CR2), UI, checks, size

- **Tables (Entities domain, sole inserter `bonds-ingest.mjs`):**
  - `bond_offering_party(accession_number, party_seq, tranche_seq NULL, party_name, role_printed, role, source_part, parser_version, ingested_at, PRIMARY KEY(accession_number, party_seq))`, with `role ∈ {bookrunner, co_manager, agent, trustee, guarantor}` and `source_part ∈ {cover, pricing_supplement, fwp, description}`.
  - `bond_offering(accession_number PK, bookrunners_state, co_managers_state, agents_state, trustee_state, guarantor_state, parser_version)`.
  - Rollback: `DROP TABLE` both (nothing references them).
  - Writes ≈ 325 filings × ~8 parties + 325 ≈ 3,000 rows, ≈ 6k row-writes with PKs: one run under the 8k cap.
- **API:** F2 bond detail gains `parties` + states (one PK range read per filing).
- **UI:** a "Who's involved" block on the bond page: Issuer · Guarantor · Trustee · then "Banks that sold the bonds", with the printed role and "from the prospectus cover / pricing supplement" + SEC link. This is the light part of BOND-10: section-level source, no page numbers.
- **Accuracy:** DIL checks 20 filings across 424B5 syndicated, 424B2 MTN, retail pricing supplement and FWP. Names and roles must match the source exactly: 0 wrong role, 0 trustee-as-underwriter, 0 party on the wrong tranche. Tests run on 6 fixtures (UNH, ICE, Oracle, Toyota FRN, Amazon, GM).
- **Size:** ≈ **2.5 packet-days**: extractor + tests 1, CR + API + UI 1, run + check 0.5.

### 8.4 Why BOND-07 / 10 / 12 stay December

- **BOND-07** (structured summary: use of proceeds, redemption, net proceeds, discounts, conditions) needs ~8 more extractors, each with its own accuracy check (≈ 3–4 days).
- **BOND-10** needs section and page offsets, which EDGAR HTML does not give reliably (≈ 1–2 days). November gives the SEC link + "source part" only.
- **BOND-12** is already decided (facts only). With no generated text there is nothing to verify in November.

None fits after BOND-01–05 + the parties option inside 22–29 Nov.

## 9 Work units, days and the November cut line

The worker is one session at a time. On weekdays the Founder services about 1 checkpoint a day; on weekends, 3–5. Release of the main November work: Mon 23. Demo: Mon 30. Weekly usage resets Wed 25 (extra credit available to 10 Dec).

| Day | Unit | Content | Size | Founder checkpoint | Cut |
|---|---|---|---|---|---|
| Sun 22 | **U0** | This spec: approve target, cut line, decisions | — | spec approval | MUST |
| Sun 22 | **U1 BOND-CR1** | Change Request for `status_reason` + `superseded_by` (impact, three-point check, rollback) — doc only | S 0.3 | CR approval | MUST |
| Tue 24 | **U2 BOND.FIX1** | Parser 1.3.0: F1, F2, F3, F4, F7, F8 + fixtures from cache + tests; local only | M 1 | build review | MUST |
| Wed 25 | **U3 BOND.FIX2** | F5 + F6 diagnosis and layouts; **offline whole-corpus dry re-parse** → before/after, diff, SQL + rollback (0 writes); T2/T3 re-confirmed | M 1 | target confirm | MUST |
| Thu 26 | **U4 BOND.REVIEW** | Independent review of the parser diff + DIL 20-row source check | S 0.5 | — | MUST |
| Thu 26 eve | **U5 BOND.APPLY** | Migration + guarded apply (≤ 8k writes), Ops reconcile, rollback ready | S 0.5 | **write approval** | MUST |
| Fri 27 | **U6 BOND.UI** | API F1/F2/F3 counts + F5 list, UI copy, Ops line, tests; Worker deploy + Pages release (separate mechanisms, both tracked) | M 1 | release approval | MUST |
| Sat 28 | **U7 BOND.VERIFY** | BOND-05 report: before/after, remaining exceptions; D6 incremental run if approved | S 0.5 | accept | MUST |
| Sat 28–Sun 29 | **O1 BOND.OFFER** | §8: CR2, extractor, run, "Who's involved" UI, 20-filing check | L 2.5 | 3 checkpoints | **STRETCH** — only if U5 is applied by Thu 26 and U6 is live by Fri 27 |
| Sun 29 | — | demo prep, buffer | — | — | — |
| Dec | — | BOND-07, BOND-10 (page refs), BOND-12 review, underwriting amounts, scheduled bond refresh, M4 tickets | — | — | DECEMBER |

**Cut line: MUST = U0–U7 (BOND-01–05), ≈ 5.3 packet-days. STRETCH = O1 (BOND-06/08/09/11 for parties). DECEMBER = the rest.** If U3 or U5 slips by a day, O1 drops first, then F6's lesser layouts (T3 falls back to its success figure, or is restated).

## 10 Cross-lane review

- **Entities ownership.** `bond_issuance` and `bond_issuer_link` are Entities-domain tables (008 header: sole inserter `bonds-ingest.mjs`; 013 repoints `bond_issuer_link.entity_id` only; 009 reads). Both CRs are owned by the Data-Identity Lead. Neither touches `entity_id` or 013's tables. The UI change stays inside `ma-entities.js`'s FI block, with no cross-domain imports.
- **Tech Ops write budget.** Free-tier caps: 100k writes/day, 5M reads/day.
  - Bonds: ≤ 8k per run, one apply run (U5), + O1 ≈ 6k, + D6 ≈ 1k.
  - Back-fill: ≤ min(40k, 60k − U) in the Tue–Sat 06:00 firing.
  - Bond runs go on different days or after 08:00Z, behind the existing headroom gate.
  - Monday seed (≈ 37.5k) and Sunday holdings (≈ 80k) days are excluded.
  - Reads: the re-parse is offline (D1 reads only for headroom); the new API counts are ≈ 150 reads per issuer view, measured in U6.
- **Back-fill 06:00 window.** The bonds runner already parses `relays/FREEZES.json` and refuses the entities-enrich 05:50–07:10Z window. There is no shared table or cron: bonds stay a manual local runner, and add no cron trigger (cron capacity last seen 5/5).
- **Release Mon 23.** Bond code starts after the release, so no concurrent edits to `ma-entities.js`/`entities-api.js`. U6 is its own release: Worker deploy and Pages commit are separate and both recorded.
- **Gate.** `fi_serving_gate` stays open throughout. The guarded batches are atomic per statement group, and served-row rules do not change.

## 11 Open decisions for the Founder

1. **Supported scope and classes (§1.3).** Approve Complete / Partial / Draft / Failure / Not covered / Unsupported and the scope list. *Recommend: approve.*
2. **Target (§3).** T1 100% visible reasons · T2 ≥ 95% (stretch 97%) · T3 ≥ 60% linkable (stretch 75%) · T4 ≤ 3 failed · T5 0 regressions. T2/T3 are re-confirmed at U3 with real numbers. *Recommend: approve.*
3. **Drafts.** Drafts are never shown as bonds. They are counted and listed as "draft documents", linked to the final by the deal-level rule in F2, with no tranche-level link (the drafts have none). *Recommend: approve.*
4. **BOND-CR1.** Add nullable `status_reason` + `superseded_by` columns (derived reasons are impossible: the rule is not stored). *Recommend: approve, CR on Sun 22.*
5. **Remarketings.** Keep them "not covered" (as R-4) rather than showing remarketed debt as new bonds. *Recommend: keep not covered.*
6. **Freshness.** Allow one incremental run of the existing runner on Sat 28: ≤ 300 SEC requests, ≈ ≤ 1k writes, same 34 filers. The demo would then show filings to late November instead of 16 Oct. This is not a new ingestion programme, but it is production SEC processing, so it needs your yes. *Recommend: yes. If no, label the data "SEC filings to 16 Oct 2026".*
7. **Offering information.** Take BOND-06/08/09/11 (parties only) as a **stretch** on Sat 28–Sun 29 under the cut-line condition. BOND-07/10/12 stay December. *Recommend: approve as stretch.*
8. **Write window.** Apply (U5) on Thu 26 after 08:00Z, behind the headroom gate, with your write approval at that checkpoint. *Recommend: approve.*
9. **Wells Fargo drafts.** If F1 shows the 34 WF drafts are market-linked, they become "not covered" and leave the M1 denominator. If not, they stay "no final found" and T2 is restated at U3. *Recommend: accept either outcome, stated at U3.*
