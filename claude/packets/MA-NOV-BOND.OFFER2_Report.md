# MA-NOV-BOND.OFFER2 — Offering facts part 2, full dry run, offering apply + rollback SQL (not run), check sheet — Report

```text
PACKET:   MA-NOV-BOND.OFFER2 · Control v1 (5a4e6b2a…5d87) · Task v1 (0c0d3fab…9203) — both verified
RUN:      r-20261122T153116Z-c7d9 · interactive · 2026-11-22 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Engineering Lead
OUTCOME:  DONE — bonds-offering.mjs → bonds-offering-1.1.0 (fields 14–22, 25–28); 125/125 bond tests (109 existing + 16 new);
          whole-corpus offline run (322 debt filings at parser 1.3.1, 633 tranches): 12,090 fact + 3,926 party rows;
          offering apply = 3 guarded runs (7,907 · 7,976 · 133 rows), rehearsed locally with a clean rollback; NOT run on D1
PINS:     spec v2 c4281815…aef ✓ · CR 3885c999…2b5b ✓ · OFFER1 report f3fa4343…ad2b ✓ · bonds-offering.mjs blob d24b2d43…b408 at HEAD ✓
D1 / SEC: 1 of the 3 allowed read-only SELECTs (943 rows read, 0 written) · 0 SEC or other network requests · 0 installs · 0 subagents
HEAD:     5ae101f = origin/November-2026 at start (as the Control says)
```

## 1 What was built

**`App/Corporate Atlas/bonds/bonds-offering.mjs`** → `bonds-offering-1.1.0`. Still pure (no I/O). OFFER1's fields 1–13 and parties are unchanged: the 7,461 OFFER1 fact rows and 3,926 party rows are reproduced exactly. `extractOffering()` now also returns, per filing:

| # | Field (`field`) | Lvl | Value stored | Read from |
|---|---|---|---|---|
| 14 | `ranking` | T | `Senior` · `Subordinated` · `Junior subordinated` | the cover title ("… Senior Notes due …"), else the words between "will be / are" and "obligations" ("our senior, unsecured obligations"); C: the "Product Ranking" column |
| 15 | `secured` | T | `unsecured` · `secured` | the same phrase; C: "Product Ranking" |
| 16 | `early_repayment` | T | JSON `{can: yes/no, from: par-call or first call date, price: par · make-whole · make-whole, then par, tax: true}` + `value_date` = from | A: the supplement's Optional Redemption section, par-call dates, "not redeemable" sentences; B: the `Redemption:` label (+ "Redemption Dates: commencing on …"); C: "Redemption Information: Callable at 100% on …" per CUSIP |
| 17 | `change_of_control` | O | `value_num` = buy-back price (101) | a "change of control" mention in the supplement with "101% of … principal" within 1,500 characters |
| 18 | `special_mandatory_redemption` | T | `value_num` = price, `value_date` = the date the deal must close by | "Special Mandatory Redemption", on the tranches it applies to (§7 D2) |
| 19 | `survivors_option` | T | `yes` / `no` | C: the "Survivor's Option" column |
| 20 | `use_of_proceeds` | O | JSON `{c: [categories], acq: name}` from the closed list `PROCEEDS_CATEGORIES` | the Use of Proceeds section (the heading printed after its anchor) |
| 21 | `bank_fee_pct` | T | % | A: cover table; B: `Agent's Discount or Commission:`, `Dealer's/Dealers' Commission:`; C: "Gross Concession" |
| 22 | `proceeds_pct` · `proceeds_amount` · `proceeds_total` | T · T · O | % · amount per tranche · amount for the deal, with its basis | A: cover table (the % column, the amount printed right after it, the Total row); B: `Net Proceeds to Issuer:` (% or $), `All-in-price:`, Deere's "agreed to purchase … at a price of x%"; C: "Net Proceeds" per CUSIP; else "net proceeds … approximately $X" in Use of Proceeds |
| 25 | `risk_factors` | O | none (link + heading only) | the supplement's Risk Factors section; a pointer to another document → "Not stated in the filing" |
| 26 | `selling_restrictions` | O | JSON list of places (`EEA`, `UK`, `Canada` …) | "Notice to Prospective Investors in …", "Prohibition of Sales to EEA/UK Retail Investors", "Selling Restrictions", and places printed as bare headings in the Underwriting section |
| 27 | `conflicts_of_interest` | O | the heading | the "Conflicts of Interest" heading in the supplement |
| 28 | `listing` | O | exchange name or `Not listed` | "We intend to apply to list … on the New York Stock Exchange" / "will not be listed" |

Fields 23–24 (banks, trustee) are OFFER1's parties. Field 1 (issuer) is `bond_issuer_link`.

**How the readers work:**
- **Supplement only.** On a prospectus supplement (A), only the supplement's own pages are read, up to its last printed S-page. The accompanying base prospectus talks about debt securities in general ("No Protection in the Event of a Change of Control"), not these notes.
- **Headings.**
  - A table-of-contents anchor is used only when its heading is printed within 1,500 characters after it. Two sections can share a page top: PepsiCo's "Use of Proceeds" anchor pointed at "Risk Factors".
  - A cross-reference ("See “Use of Proceeds”") or a contents line is never taken as the heading.
- **Tranche scope.** A sentence's tranche scope comes from its subject, or its object after "may not redeem". Asides in parentheses, including nested ones, are removed first. A class ("the fixed rate notes") and named tranches ("the 2028 Notes") are combined.
- **Par-call dates.** A par-call date goes to the one tranche whose maturity falls 0–12.5 months after it, narrowed by the tranche named next to the date when two qualify. A fixed-to-floating tranche prints two par dates (the reset date and 30 days before maturity), and the earlier one is "from".
- **§6.1 checks** (§3) run on every new fact. A failing fact is not returned, and the failure is listed in `checks`.

**New files:**
- `tests/bonds-offer2.test.mjs`: 16 tests.
- `apply/offer-dryrun.mjs`: the offline whole-corpus run, committed so U8 can repeat it.
- `apply/offer-build.mjs`: builds the SQL and the diff.
- `apply/offer-checksheet.mjs`: writes the check sheet.
- The generated files of §4 and §5.

`bonds-lib.mjs`, `bonds-parse.mjs` and `bonds-ingest.mjs` are **unchanged**, and no fixture was added (§6).

## 2 Availability — all 28 fields, offline run vs spec v2 §3

**Corpus.**
- The 325 final filings of the 15 Oct snapshot, read from `state/cache`; 0 were missing.
- They were parsed with **parser 1.3.1**, the corpus as it will stand after the reliability apply, with the runner's same-deal term-sheet pairing.
- **322 are debt** (A 151 · B 148 · C 23) with **633 tranches**. The 3 that parser 1.3.1 skips get no facts, as in OFFER1.

**Measured** = % of the 322 filings with the field shown, as the spec counts it. "Δ" is measured minus the spec figure, and ⚑ marks one more than 10 points below.

| # | Field | Status | Spec v2 | Measured | Δ | Rows shown | Not stated | By family (filings shown) |
|---|---|---|---|---|---|---|---|---|
| 1 | Issuer | Req | 100% | 100% (bond_issuer_link) | 0 | — | — | — |
| 2 | Guaranteed by | Show | 13% | 5.9% | −7 | 19 parties | 300 | OFFER1 §3 |
| 3 | Date of this document | Req | 95% | 100% | +5 | 322 | 0 | A 151 · B 148 · C 23 |
| 4 | CUSIP / ISIN | Show | 44% (rows) | 88.8% | +45 | 545 | 43 | A 115 · B 148 · C 23 |
| 5–8 | Amount · Currency · Rate · Matures | Req | 100 · 100 · 99 · 100% | 100 · 100 · 99.7 · 99.7% | 0 | 633 · 633 · 626 · 626 | 0 | all |
| 9 | Price to investors | Req | 98% | 96.9% | −1 | 600 | 0 | A 141 · B 148 · C 23 |
| 10 | Interest paid | Req | 95% | 92.9% | −2 | 567 | 0 | A 128 · B 148 · C 23 |
| 11 | How interest is counted | Req | 86% | 77.3% | −9 | 477 | 69 | A 125 · B 124 · C 0 |
| 12 | Priced on | Show | 45% (≈80% with FWPs) | 77.3% | −3 vs est | 249 | 73 | A 113 · B 113 · C 23 |
| 13 | Issue date | Req | 95% | 95.7% | +1 | 308 | 0 | A 145 · B 148 · C 15 |
| **14** | **Ranking** | Req | 65% | **60.6%** | −4 | 467 | 113 | A 137 · B 35 · C 23 |
| **15** | **Secured or unsecured** | Req | 54% | **51.9%** | −2 | 474 | 148 | A 144 · B 0 · C 23 |
| **16** | **Early repayment** | Req | 100% | **95.7%** | −4 | 619 | 0 | A 151 · B 134 · C 23 |
| **17** | **Buy-back if control changes** | Show | 23% | **2.8%** | −20 ⚑ | 9 | — | A 9 |
| **18** | **Mandatory early repayment** | Show | 2% | **0.9%** | −1 | 14 (3 filings) | — | A 3 |
| **19** | **Survivor's option** | Show | 5% | **7.1%** | +2 | 45 | — | C 23 |
| **20** | **What the money is for** | Req | 62% | **43.2%** | −19 ⚑ | 139 | 183 | A 139 · B 0 · C 0 |
| **21** | **Bank fee** | Req | 86% | **80.7%** | −5 | 548 | 50 | A 141 · B 96 · C 23 |
| **22** | **Proceeds before expenses** | Req | 84% | **85.4%** (%) · 53.1% (deal total) | +1 | 541 % · 263 per-tranche amounts · 171 totals | 14 | % A 141 · B 134 · C 0 |
| 23 | Banks that sold the bonds | Req | 100% | 99.7% | 0 | OFFER1 | — | OFFER1 §3 |
| 24 | Trustee | Req | 73% | 36.0% | −37 ⚑ | 116 | 89 | OFFER1 §3 (D2, D9) |
| **25** | **Risks** | Req | 66% | **56.8%** | −9 | 183 | 139 | A 121 · B 62 · C 0 |
| **26** | **Where the notes may not be sold** | Req | 59% | **46.9%** | −12 ⚑ | 151 | 171 | A 151 · B 0 · C 0 |
| **27** | **Conflicts of interest** | Show | 38% | **18.0%** | −20 ⚑ | 58 | — | A 58 |
| **28** | **Listing** | Show | 41% | **40.1%** | −1 | 129 | — | A 129 |

**Why the ⚑ fields are low** (each was checked against the filings, not assumed):
- **17 Change of control (show where found).**
  - Only **8 supplements** mention change of control at all. The ninth row is AbbVie, whose risk-factor text gives the 101% price.
  - The spec's 75 counted the base prospectus's generic "No Protection in the Event of a Change of Control" wording.
  - All 9 supplements that name a buy-back price are read: UNH ×3, CVS ×2, Home Depot, Union Pacific, Lowe's and AbbVie.
- **20 Use of proceeds (Required).**
  - The spec's 62 counted Toyota's 62 "Use of Proceeds and Hedging" sections. Those sections point to the base prospectus, and the spec's own rule says to show "Not stated in the filing — described in the base prospectus". They are stored as `not_disclosed`.
  - A family: 139/151 (spec 141). The 12 not shown are Toyota syndicated pricing supplements, which have no such section.
- **24 Trustee (Required):** OFFER1's result, unchanged (D2/D9 in the OFFER1 report).
- **26 Selling restrictions (Required).**
  - A family: **151/151**.
  - The spec's B 37: no B filing in the corpus prints a "Notice to investors", "Selling Restrictions" or "Prohibition of Sales" heading anywhere in its text (checked across all 148). The 37 is not reproduced. **For BOND.REVIEW.**
- **27 Conflicts of interest (show where found).**
  - The spec's 125 included table-of-contents lines and base-prospectus mentions.
  - 71 supplements contain the words; 58 have the heading in the supplement itself.
  - The other 13 are 12 Toyota pricing supplements, whose only mention is the accompanying prospectus supplement's contents list, and 1 NextEra filing.

**Other notes:**
- **Ranking:** 0 values contradict the parser's tranche labels (428 Senior, 3 Subordinated, 36 Junior subordinated).
- **Secured:** no `secured` value occurs in the corpus.
- **Risk factors:** the 30 A filings without the section point to another document (American Express 11, Toyota syndicated 12, AT&T 7). They are "Not stated in the filing".
- **Bank fee, B family, 96 vs 113:**
  - 14 Toyota floating notes print one commission per agent ("RBC's Discount or Commission: 0.030% … TFSS USA's …: 0.150%"). There is no single fee, so none is read.
  - 2 print 0.00%, which the spec range rejects (§3).
  - 1 prints "Up to 0.120%".
  - Deere prints no fee (35, "Not stated").

**Early repayment, by value (619 tranches):**

| Value | Tranches |
|---|---|
| make-whole, then par from a date | 284 |
| make-whole at any time | 86 (A 63 · B Caterpillar 23) |
| par from a date | 100 (B Toyota 54 · C 45 · A 1) |
| yes, price not read | 54 |
| no (not redeemable) | 95 (A 38 · B 57) |

The 54 "price not read" rows are mainly fixed-to-floating notes, Toyota and American Express floating notes, and NextEra and Dominion. They show "Yes" without a price.

**Other value counts:**
- **Use-of-proceeds categories:** general corporate purposes 135 · repay or refinance debt 110 · working capital 28 · share buybacks 20 · capital spending 19 · fund an acquisition 16 · eligible green or social projects 1.
- **Listing:** Not listed 99 · New York Stock Exchange 24 · Nasdaq Bond Exchange 5 · Nasdaq Global Market 1.
- **Proceeds total, by basis:** before expenses 81 · approximately, after expenses 90.

**Source references (BOND-10) for fields 14–28:**
- 3,030 shown facts carry a printed page.
- 1,105 carry a section anchor.
- 0 shown facts are without a source part and character offset.
- The longest stored value is 125 characters.

**Rows that the apply writes:**
- 12,090 facts: 7,461 from OFFER1 + 4,629 from OFFER2.
- 3,926 parties.
- **16,016 in total.** The CR estimated ≈ 12,000 (§4).

## 3 Automatic checks (§6.1) — whole corpus

| Check | Failures | Filings | Note |
|---|---|---|---|
| Early repayment: par-call date ≥ maturity, or ≤ document date | 0 | | |
| Bank fee outside 0 < x < 5 | 2 | Toyota 0000950103-24-002313, 0000950103-25-003576 (printed 0.00%) | genuine zero commissions; spec range rejects them (§7 D4) |
| Price − fee ≠ proceeds (± 0.01) | 0 | | A cover tables already checked in OFFER1's reader; B labels now checked too |
| Proceeds total vs Σ principal × proceeds % (± 0.5%) | 3 | Caterpillar 0001104659-24-088590 (4,992,500,000 vs 499,250,000: the filing's value is 10× the computed one); Verizon 0001193125-25-064062, 0001193125-25-277994 | not stored |
| Tranche proceeds amount vs principal × % (± 0.5%) | 4 | AT&T 0001193125-26-182243 t1, t3; Verizon 0001193125-25-277994 t4, t5 | not stored |
| Currency of an amount ≠ tranche currency | 0 | | (a Comcast GBP/EUR case was caught while building; the reader now reads it correctly) |
| value_text > 300 · shown fact without a source | 0 · 0 | | |
| Parties: trustee/guarantor also a bank · missing tranche · clash | **0 · 0 · 0** | | unchanged from OFFER1 |
| From OFFER1, unchanged | 9 + 7 + 5 | interest-paid first date (Capital One fixed-to-floating) · maturity source (AbbVie 0001104659-24-027205) · price range (Southern premium ×2, Duke ×2 and Dominion misreads) | OFFER1 §4 |

**Stop gate (role / tranche / trustee-as-bank): 0 failures, so it is not hit.** Notes recorded without a failure (OFFER1 kinds, unchanged): 93 D9 trustees, 24 base-prospectus-only trustees, 3 unnamed guarantors, 2 term-sheet pricing-date disagreements, 66 filings with bank-list text runs dropped.

## 4 Offering apply + rollback SQL (not run) and the local rehearsal

**Files** (in `App/Corporate Atlas/bonds/apply/`, built by `offer-build.mjs` from the offline run at `ingested_at` 2026-11-22T16:30:00Z):

| File | sha256 | Content |
|---|---|---|
| `offer-apply-run1.sql` | `9b0273c7…098a` | 189 filings, 5 batches, 423 statements, **7,907 rows** (5,959 facts + 1,948 parties) |
| `offer-apply-run2.sql` | `d2fbbf1e…b463` | 131 filings, 4 batches, 333 statements, **7,976 rows** |
| `offer-apply-run3.sql` | `59f799f4…e92f` | 2 filings, 1 batch, 5 statements, **133 rows** |
| `offer-rollback-run1/2/3.sql` | `96f14f7c…079e` · `3258a02f…59cb` · `d8cbf413…1be6` | per batch: `DELETE … WHERE parser_version = 'bonds-offering-1.1.0' AND accession_number IN (…)`, expected `[facts, parties]` |
| `offer-diff.tsv` | `e95c4c3f…a3b4` | one line per new row (16,016) |
| `offer-summary.json` | `a7c2b4c2…85be` | counts, per-run hashes, input hash |

**Statement shape:**
- `INSERT OR IGNORE INTO bond_offering_fact|party (cols) SELECT * FROM (VALUES …) WHERE <guard>;`
- At most 40 rows per statement, and every statement expects as many changes as it has rows.
- **Guard:** the filing's final rows in `bond_issuance` must be exactly the offering's tranche set, all at `bonds-1.3.1`. This is spec v2 §9's "only filings whose reliability apply is final".
- A filing's statements are never split across batches. There are at most 100 statements per batch and at most 8,000 row-writes per run (WITHOUT ROWID, PK only, so one write per row).

**Three runs, not two.** 16,016 rows is more than 2 × 8,000, as OFFER1 §7 predicted, and run 3 is small. The **Sat 28 budget in CR §4.3 needs restating** before write approval 2: back-fill ≈ 40k + offering 16.0k (+ D6 ≈ 1k) ≈ **57k**. That is under the 60k headroom ceiling and the 100k/day cap, but with less margin than the CR's ≈ 53k. A full rollback costs up to 16k deletes.

**Rehearsal.**
- **Base data.** The one read-only D1 SELECT (`SELECT * FROM bond_issuance`, 943 rows read, 0 written) gives a results-only hash of `cbe392e1…6251`. That is **identical to the CR's read**, so D1 has not changed since this morning. CR1 is not applied: 23 columns.
- **Tooling.** Local `node:sqlite`. Script `rehearse2.mjs` `3460a050…ec45`, result `rehearsal2-result.json` `f1061054…3368`, D1 rows `d1-now.json` `8540e2f2…a817`, offline run `offer-run.json` `52b5f292…909b`. All are in the session scratchpad.

| Step | Result |
|---|---|
| Load 943 rows → CR1 → `fix2-apply-run1.sql` | 945 statements, 0 mismatches; 638 finals; all 943 rows at `bonds-1.3.1` (as the CR rehearsal) |
| Alignment | **all 322 offering filings** have exactly their tranche set as final rows. 5 D1 finals have no offering rows: Wells Fargo 0001839882-26-0509{80,85,86,96} and -051003, from the 16 Oct live run, outside the spec's corpus (§7 D10) |
| CR2 migration | 2 tables, integrity ok |
| Apply run 1 · 2 · 3 | 7,907 · 7,976 · 133 changes; **0 mismatches** against every batch vector |
| After apply | 12,090 facts + 3,926 parties = the summary; `bond_issuance` byte-identical to before; **`checkAgainstIssuance` vs the post-apply `bond_issuance`: 0 differences** (this is OFFER1 §7's re-run, done on the post-apply state); 0 shown facts without an offset; integrity ok |
| Apply again | 761 statements, **0 changes** (INSERT OR IGNORE) |
| Rollback run 3 · 2 · 1 | 133 · 7,976 · 7,907 deletes, 0 mismatches; **both tables empty**, schema identical to just after CR2, `bond_issuance` unchanged |
| CR2 rollback | schema identical to before CR2 (`3d2da43d…99aa`) |
| **Guard test:** the 3 runs on CR1 + CR2 *without* the reliability apply | 761 statements, **0 rows written** (every statement mismatches, so a run would stop at its first statement) |

No stop gate was hit.

**For U8 (run order):**
1. `ma-nov-bond-cr2.sql`.
2. Re-SELECT `bond_issuance` and compare the results-only hash with the post-APPLY1 state. If D1 changed, re-run `offer-dryrun.mjs` and `offer-build.mjs`.
3. Runs 1 → 2 → 3, batch by batch, stopping on the first mismatch.
4. Reconcile.

Only after write approval 2 and the 20-filing check.

## 5 The 20-filing check sample

`apply/offer-check-sheet.md` (`968625ad…f512`, written by `offer-checksheet.mjs`). The sample is stratified as spec v2 §6.2. It covers **14 issuers**, and **14 of the 20 filings are multi-tranche** (the spec asks for at least 5).

| Stratum (spec v2 §6.2) | Filings |
|---|---|
| A 424B5 syndicated, USD (4) | UNH 0001193125-25-142782 (4 tranches, change of control) · ICE 0001193125-26-349174 (tranche-specific bank roles; special mandatory redemption on 2 of 4) · AbbVie 0001104659-26-020619 (7 tranches, tranche-specific banks) · Duke 0001104659-24-000673 |
| A multi-tranche (4) | AT&T 0001193125-25-064173 (EUR, European banks, tax redemption) · Pfizer 0001193125-25-120844 (EUR, guaranteed subsidiary; filed as 424B5) · Toyota syndicated 0000950103-24-000197 (two not redeemable) · Oracle 0001193125-25-217490 (6 tranches) |
| A with change of control / special mandatory redemption (2) | Lowe's 0001193125-25-216381 (both) · CVS 0001193125-24-134264 |
| B Toyota · Caterpillar · Deere (2 · 2 · 2) | Toyota 0000950103-24-000537 (callable), 0000950103-24-002543 (two agents) · Caterpillar 0001104659-24-105055 (OFFER1's unsplit bank list), 0001104659-24-000426 · Deere 0001104659-24-000827, 0001104659-24-005136 |
| C Verizon · GM (2 · 2) | Verizon 0001193125-24-057532, 0001193125-24-207015 · GM 0000804269-25-000011, 0000804269-25-000028 |

**What the sheet lists.**
- Every row that the bond page would show for these 20 filings: **1,012 fact rows and 228 party rows**.
- That includes the "Not stated in the filing" and "Not applicable" rows, which are claims too.
- Each row has its shown value, a link (to `source_url#anchor` where there is one), its part, heading and page, and its character offset.
- The checker fills in *Source value*, *OK* and *Note*.
- The §6.3 gate is printed at the top.

## 6 Tests

`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs` → **125 tests, 125 pass, 0 fail** (109 existing + 16 new). No existing test changed. OFFER1's row-shape test now also covers fields 14–28 on its 11 fixtures: CR2 columns, states, parts, PK, ≤ 300 characters, and O/T levels.

| Task case | Fixture (existing) | Asserted |
|---|---|---|
| make-whole + par call | UNH 4 tranches | the per-tranche par-call dates (2028-05-15, 2030-12-15, 2035-03-15, 2054-12-15) are before maturity; "make-whole, then par"; anchor and page |
| tax redemption | AT&T EUR | `tax: true` on all 3 tranches; par-call table dates; EUR amounts; NYSE listing; risks pointed elsewhere → not stated |
| change-of-control buy-back | UNH | 101%, offering-level |
| use-of-proceeds categories | UNH, ICE, Amazon CAD | closed list; ICE names the acquisition (MarketAxess) |
| discounts / net proceeds | UNH, Caterpillar, GM | fee, proceeds % and amount per tranche; total = 2,975,487,500 = Σ; Caterpillar "Dealers’ Commission" + "All-in-price" + total check; GM concession and net proceeds per CUSIP |
| pricing supplement, mostly "not stated" | Deere floating | early repayment "No" is a stated value; secured, fee, use of proceeds, risks and selling restrictions not stated; show-where-found fields have no row |
| also | ICE (SMR on t3, t4 only, by 2027-07-29) · Toyota syndicated (floating + 2026 fixed not redeemable, tranche-correct) · Amazon CAD ("Canada Yield Price"; a parenthetical aside doesn't narrow the make-whole) · Toyota callable (par from first redemption date; its own Risk Factors section, no page) | |
| §6.1 (synthetic) | | par call ≥ maturity rejected; price − fee ≠ proceeds stores neither; fee 0 rejected and not shown as "not stated"; total vs Σ rejected |
| §8 | 9 fixtures | every OFFER2 value is a closed-list category, a place, a code, a number or date, or a short value (≤ 6 words, no sentence); risks and conflicts are link + heading |

## 7 Deviations

1. **D1 — Source part `risk factors` added** to the §5 closed list (`SOURCE_PARTS`). Risks are their own section and none of the 10 parts fits. No CHECK in CR2 constrains `source_part`.
2. **D2 — Special mandatory redemption is tranche-level (T), not O.**
   - It applies to some tranches only. At ICE, the "non-SMR notes" (2029, 2031) are excluded, and at AbbVie, the 2056 and 2066 notes. An offering-level row would put the fact on the wrong tranches (spec §6.3).
   - Change of control stays O and is not stored when the supplement says some tranches are excluded. None did.
3. **D3 — Field 22 is three rows:**
   - `proceeds_pct` (T);
   - `proceeds_amount` (T, the amount printed for that tranche);
   - `proceeds_total` (O).

   The total carries its basis in `value_text`: `USD · before expenses` (cover Total row or label) or `USD · approximately, after expenses` (the "net proceeds … approximately $X" sentence, which is after expenses). The latter is checked at 95–100.5% of Σ principal × proceeds %, not ± 0.5%. Proceeds % outside 85–101 is rejected (my range; the spec gives none).
4. **D4 — Bank fee 0.00% is rejected,** as spec §3/§6.1 require (> 0). Two Toyota notes print a genuine 0.00%. **For BOND.REVIEW:** allow 0 when printed. "Up to x%" and per-agent commissions are not read.
5. **D5 — Value formats:**
   - `use_of_proceeds` is `{"c":[…],"acq":"…"}`. `acq` is set only when the filing names the target.
   - `early_repayment` keys are `can`, `from`, `price` and `tax`. `tax` appears only when a tax redemption is printed; it is never set to false. `price` is absent when it was not read (54 tranches).
6. **D6 — Wording rules beyond the spec's:**
   - `Senior` is read from "unsubordinated".
   - Present tense ("are direct, unsecured … obligations") and a possessive issuer name are accepted.
   - A make-whole applies to a floating-rate tranche only when the sentence names it.
7. **D7 — Supplement-only reading for A** (up to the last printed S-page). This is the main reason fields 17 and 27 are below the spec's counts (§2).
8. **D8 — Check sheet location.** It is saved as `bonds/apply/offer-check-sheet.md`, as the Task and the Control's write list say, not under `bonds/state/` as spec v2 §6.2 says.
9. **D9 — No new fixtures.** All six Task cases are covered by fixtures already in `fixtures/`.
10. **D10 — 5 Wells Fargo finals in D1 get no offering rows.** These are the callable notes of the 16 Oct live run, outside the spec's 15 Oct corpus.
    - Their layout (price per $1,000 note, no bank label that the readers find) was never measured.
    - A first try produced "Not stated" for their trustee and fees, which could not be verified, so they were left out. The page shows "Not read yet" for them.
    - **For BOND.REVIEW / a later packet:** read the Wells Fargo layout.
11. **D11 — OFFER1's fields 5–8 rows are still in the apply** (2,518 rows + 545 identifiers). OFFER1 D1 is still open for BOND.REVIEW. Dropping them would bring the offering to ≈ 13.0k rows, which is still 2 runs.

## 8 Boundaries kept

- **Files written.** All of these are on the Control's list:
  - `bonds-offering.mjs` (`9b518dde…3c34`);
  - `tests/bonds-offer2.test.mjs` (`fb2ffcda…0f79`);
  - `apply/offer-dryrun.mjs` (`33208f1f…013a`), `apply/offer-build.mjs` (`8cabda87…ab7e`), `apply/offer-checksheet.mjs` (`ba763c26…4706`);
  - the generated `apply/offer-*.sql`, `offer-diff.tsv`, `offer-summary.json` and `offer-check-sheet.md` (hashes in §4–5);
  - this report.

  `bonds-lib.mjs`, `bonds-parse.mjs`, `bonds-ingest.mjs` and `fixtures/` are unchanged.
- **Not touched:** migrations (none run), Workers, the front end, `docs/`, `.env*`, `state/` (read only), the Status, board, Tower and transitions files, logs, and `13F Seed/gleif-seed.js`. The Main Lane's uncommitted edits in the working tree were left as they were and are not in this commit.
- **External calls:** 1 read-only D1 SELECT (943 rows read, 0 written). No D1 write, no migration, 0 SEC or other network requests, 0 installs, 0 subagents.
- **Copying:**
  - No sentence of a filing is stored. Values are codes, numbers, dates, closed-list categories, places, an exchange name or a heading (longest 125 characters).
  - Risks, selling restrictions and conflicts of interest are a section link with a one-line heading only.
  - An earlier session's scratchpad (the CR rehearsal script) was read only, to reuse its method.
- **Git:** one commit with explicit paths, pushed to `November-2026` (see the run's `END` line and `git ls-remote`).
