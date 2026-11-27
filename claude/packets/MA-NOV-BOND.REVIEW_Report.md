# MA-NOV-BOND.REVIEW — Independent review of all bond work + the 20-filing source check — Report

```text
PACKET:   MA-NOV-BOND.REVIEW · Control v1 6d316719…62b4 ✓ · Task v1 cc475432…26d9 ✓ · all 8 Task pins ✓ · LANE_OPENER_v2 67913343…71d6 ✓
RUN:      r-20261122T213157Z-1367 · interactive · session cd2d5244-80ca-46a8-a89f-5f2c59935afb · HEAD 01c5379 = origin
ROLE:     Architect + independent Data-Identity checker + Tech Ops (authored none of FIX1, FIX2, CR, OFFER1, OFFER2)
OUTCOME:  PASS_WITH_NOTES for the reliability write · offering write BLOCKED by the §6.3 gate (tranche errors) until a small fix + re-check
```

## Verdict

**PASS_WITH_NOTES.** The reliability chain (FIX1, FIX2, CR1) is correct and safe to write. The offering extractor is accurate overall: 98.5% of the 1,240 sample rows are correct. It does fail the §6.3 gate, though. The sample has **3 facts and 6 party rows on the wrong tranche**, all in AbbVie 0001104659-26-020619, and **3 fields are under 95%**.

## Findings

| # | Sev | Finding | Corpus scale |
|---|---|---|---|
| F1 | **B** | Fixed-rate wording is applied to floating or fixed tranches it does not cover. (a) `day_count` shows 30/360 on floating tranches; the source says the 30/360 is for the Fixed Rate Notes only. (b) `interest_paid`: AbbVie's last fixed tranche (2066) gets the floating notes' quarterly dates. The cover line "…NOTES DUE 2066" runs straight into "Interest on the Floating Rate Notes…". (c) `early_repayment` shows "yes" on AbbVie floating notes, though the filing says "may not be redeemed prior to maturity". | (a) 8 rows: Amazon ×3, Oracle ×2, AbbVie ×2, UNH ×1 · (b) 2 rows (AbbVie ×2) · (c) 3 rows (AbbVie ×2, Amazon 26-027669 make-whole) |
| F2 | **B** | Party qualifiers that name only some tranches, e.g. "Co-Managers (Floating Rate Notes, 2028 Notes, … 2056 Notes)", are stored at tranche 0. On the excluded tranches, the same bank then shows as both bookrunner and co-manager. Citigroup and Goldman "(Floating Rate Notes and 2028 Notes)" are also missing from tranche 2. | 12 rows in 2 AbbVie filings |
| F3 | M | `use_of_proceeds` takes categories from neighbouring sentences: "working capital" (UNH, Duke), "repay debt" (AT&T, from the capitalization table; Lowe's). It also leaves out "acquisitions" (Pfizer, Oracle). | sample 16/20 = 80% |
| F4 | M | The `proceeds_total` basis says "after expenses" where the sentence says "before offering expenses" (ICE, Pfizer, Realty Income). | 8 of 90 "after expenses" totals; sample 10/12 |
| F5 | M | The `selling_restrictions` place lists are incomplete: AbbVie leaves out Switzerland and Lowe's leaves out Canada. The section links are all correct. | sample 18/20 |
| F6 | M | The Tue 24 budget does not fit under the 60k headroom ceiling when the back-fill writes its full 40k (see Tech Ops). `wrangler --file` also bypasses the runner's headroom gate. | — |
| F7 | M | The CR's results-only before-hash `cbe392e1…` has no canonicalisation recorded in the repo, so I could not reproduce it. I give my own hash, with its method, below. | — |
| F8 | N | `bank_fee` says "Not stated in the filing" on Toyota floating notes that print per-agent commissions (RBC 0.030%, TFSS 0.150%). This is a false claim; it should be no row. | ≈14 rows; sample 51/52 |
| F9 | N | The Oracle bank name is stored as "P NC Capital Markets LLC", an HTML decode artifact. AmEx fixed-to-floating notes show Actual/Actual with no "fixed period" qualifier, which contradicts OFFER1 D6. | 1 · 2 |
| F10 | N | The offering SQL rebuilds byte-identically from the committed code. Only the header line differs, because it carries the `offer-run.json` hash, which includes a `generated` timestamp. All 125/125 bond tests pass, and the tests and harnesses make no network calls (the D1 transport is mocked). | — |

## 20-filing source check (BOND-12, spec v2 §6.2)

Sheet `apply/offer-check-sheet.md` (968625ad…f512), 20 filings, 1,012 facts + 228 parties. The method was independent of the extractor:
- my own field rules located each value at its `char_offset` in the cached text;
- I read every cover table, identifier block, bank block and trustee sentence by hand;
- I searched the whole filing (and its term sheets) for every "Not stated" claim;
- I ran consistency scans: interest dates against maturity, par-call date against maturity, and one source sentence shared across rate types.

| Field | Checked | Correct | % | Gate |
|---|---|---|---|---|
| Document date · Issue date · Priced on | 20 · 19 · 20 | all | 100 | show |
| CUSIP/ISIN | 58 | 58 | 100 | show |
| Amount · Currency · Rate · Matures | 58 each | all | 100 | show |
| Price to investors | 52 | 52 | 100 | show |
| Interest paid | 54 | 53 | 98.1 | show · **tranche error** |
| How interest is counted | 57 | 56 | 98.2 | show · **tranche error** |
| Ranking · Secured | 45 · 58 | all | 100 | show |
| Early repayment | 58 | 57 | 98.3 | show · **tranche error** |
| Change of control · Special mandatory redemption · Survivor's option | 3 · 7 · 8 | all | 100 | show |
| **What the money is for** | 20 | 16 | **80.0** | **hide** |
| Bank fee | 52 | 51 | 98.1 | show |
| Proceeds % · per-tranche amount | 44 · 37 | all | 100 | show |
| **Proceeds, whole deal** | 12 | 10 | **83.3** | **hide** |
| Risks · Conflicts · Listing | 20 · 2 · 9 | all | 100 | show |
| **Where the notes may not be sold** | 20 | 18 | **90.0** | **hide** (or link-only, cut order step 4) |
| Party-group states | 105 | 105 | 100 | show |
| Parties | 228 | 221 | 96.9 | show · **tranche errors (6)** |
| **Overall** | **1,240** | **1,221** | **98.5** | |

- **Fields hidden for November:** `use_of_proceeds`, `proceeds_total`, and the `selling_restrictions` place list.
- **Blocking classes:** 0 trustee or guarantor shown as a bank · 0 shown values without a source · **9 wrong-tranche rows**, so the offering write is blocked.
- All trustees match their "as trustee" sentences. ICE tranche roles and the special mandatory redemption on t3/t4 are correct. All 58 identifiers sit next to their tranche's label.

## FIX2 source sample (15 rows) and parser checks

All 15 rows are correct against the cache:
- GM 25-129568 #1/#3;
- Verizon 25-064062;
- Dominion 25-173213 #2;
- PepsiCo 25-010139 #1/#2 (column order confirmed from the title row);
- the Duke and Welltower reopenings;
- the WF draft (market-linked), the Boeing common draft and Caterpillar Series L;
- ICE subset link and Southern count link;
- a Toyota single term sheet and a CVS labelled sheet.

The AT&T EUR floater (26-344905) is correctly left without an identifier by the currency guard. No commit touches files outside bonds, migrations or the bond reports, and none touches `gleif-seed.js`. No commit made a D1 write.

## Deviation judgements

- **FIX2 D1, the FWP conflicts made final: accept.** The two documents agree. The 1.2 reader misread the trust allocation and the Series A/B titles. The Control rule exists to keep disagreeing sources out, and that intent holds. The Founder should ratify it.
- **FIX1 D2 → F2b subset links: accept.**
- **CR `status_note`, the DROP COLUMN probe and the results-only hash: accept** (with F7).
- **OFFER1 D1, fields 5–8 as fact rows: accept.** It costs 3,063 rows but gives every value a source.
- **OFFER1 day count:**
  - excluding the make-whole assumption is right;
  - the floating-tranche leak is F1(a) and must be fixed;
  - AmEx is F9.
- **OFFER1 D2/D9 trustee (36% vs 73%): accept.** It is stricter and has no errors. Do not use base-prospectus statements in November.
- **⚑ fields:**
  - **trustee stays Required.** Its "Not stated in the filing" is a true, demo-needed state (spec §16);
  - **use of proceeds and selling restrictions:** the question is moot for November, because both are hidden by the gate. Re-decide in December after the fixes;
  - **conflicts (18%) and change of control (2.8%)** are already "show where found". The spec's counts included base-prospectus and contents-page mentions, so the extractor's supplement-only basis is the correct one.
- **OFFER2 D2 (special mandatory redemption per tranche) and D10 (5 WF finals): accept.**
- **D4 (fee 0.00%) and the Southern premium prices: keep them rejected for November.**

## Rehearsal (fresh `node:sqlite` 3.51.2; my own script)

- **Base:** 1 `SELECT *` (943 rows). The schema came from a 2nd SELECT on D1's `sqlite_master` (171 rows). D1 statements used: 2 of 4, 1,114 rows read, 0 written.
- **Load:** latest `ingested_at` is 2026-10-30T21:18:10Z, and the classes are identical to `fix2-summary.json`, so D1 is unchanged.
- **Canonical before-hash for Tue:**
  - value: **`d70c311a8f5f06cad69b3d3558b10eff3d4ba2233044eaa93db0e6eb514ada51`**;
  - method: `sha256(JSON.stringify(results sorted by accession_number, tranche_seq))`, keys in wrangler's column order.

| Step | Result |
|---|---|
| CR1 | 23 → 26 columns |
| FIX2 apply | 945 statements; 945 changes; 0 mismatches. 638 finals, 550 with an identifier, 0 failed, 0 non-finals without a reason, 0 bad `superseded_by`, 0 cross-CIK keys. A re-run changes 0 rows. |
| CR2 + offering runs 1–3 | 7,907 · 7,976 · 133 changes; 0 mismatches. 12,090 facts + 3,926 parties. 0 orphan tranches, 0 facts without a source, longest value 125 characters, 0 trustee-as-bank. `bond_issuance` is unchanged. A re-run changes 0 rows. |
| Rollbacks: offering 3→2→1, CR2, FIX2, CR1 | Each restores the prior state byte for byte (schema + values + `typeof`). The final state equals the loaded D1 copy. |

Evidence (scratchpad): `rehearse.mjs` 9192347e…7463 · `rehearsal-result.json` 4fd8ab71…906c · `check20.mjs` a95ea337…f4e9 · `auto.json` 68eced21…6e4e · `d1-rows.json` 02383ea3…8042.

## Tech Ops — Tue 24

| Item | Row-writes |
|---|---|
| Back-fill 06:00 | ≤ 40,000 (min(40k, 60k − U)) |
| Other Tuesday writers | 3–8k (spec addendum, estimate) |
| CR1 + FIX2 | ≈ 1,229 |
| CR2 + offering | 16,016 |
| **Total** | **≈ 60–65k: over the 60k ceiling** (under 100k) |

- The reliability apply fits easily.
- Offering runs go one at a time. Each starts only if the live d1-today `rows_written` + the run ≤ 58k. Whatever does not fit moves to Wed 25, after 08:05Z.
- Rollback cost: up to 16k deletes, then 1,229, then CR1 (2,830, or the 0-write fallback). Never run a rollback on a day without that headroom.

## Recommendation — may the Tue 24 writes proceed?

**Reliability (CR1 + FIX2): YES, with conditions.** Order:
1. after 08:05Z, outside 05:50–07:10Z and 23:50–00:10Z;
2. the DROP COLUMN probe;
3. `ma-nov-bond-cr1.sql`;
4. re-SELECT and compare with `d70c311a…ada51` by the method above; rebuild if it differs;
5. `fix2-apply-run1.sql` batch by batch, stopping on the first mismatch;
6. reconcile to 638 / 550 / 0.

Rollback order: FIX2 rollback, then CR1.

**Offering (CR2 + 3 runs): NO as built. YES once a small fix packet:**
- (a) repairs or excludes the 25 F1/F2 rows (or, simplest, excludes the two AbbVie filings + the 8 floating day-count rows + Amazon 26-027669 early repayment);
- (b) withholds or hides `use_of_proceeds`, `proceeds_total` and the place list;
- (c) optionally fixes F8 and F9;
- then rebuilds the SQL, repeats this rehearsal, and re-checks the changed rows.

After that, run `ma-nov-bond-cr2.sql`, then runs 1 → 2 → 3, each under the headroom rule above. Rollback order: 3 → 2 → 1, then CR2.
