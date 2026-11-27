# MA-NOV-BOND.SPEC2 — Bonds BOND-01–12 for November: spec v2 — Report

```text
PACKET:   MA-NOV-BOND.SPEC2 · Control v1 (dff8ba1f…3ff) · Task v1 (e2df6ede…167) — both verified
RUN:      r-20261121T205632Z-d760 · interactive · 2026-11-21 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Architect (specification only)
OUTCOME:  DONE — spec v2 written; offline scan of 325 final filings + 154 term sheets; 1 D1 SELECT, 632 rows read (caps 6 / 60,000)
SPEC:     claude/specs/MA-NOV-BOND_Spec_v2.md  sha256 c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef
PINS:     content scope c16c8e19…5a03 · spec v1 b30a75ce…2e53 · BOND.SPEC report 5068d502…ba0d — all match
AUTH:     wrangler OAuth login; CLOUDFLARE_API_TOKEN unset; repo root, --remote, no -c
```

## 1 Summary and decisions

- **All of BOND-01–12 fits November on paper, but with no buffer:** ≈ 7.6 packet-days over Sun 22 – Sun 29. Demo Mon 30. A cut order inside BOND-06–12 (spec §15) protects the parts that must not slip.
- **Reliability (BOND-01–05) is v1 §1–7, unchanged.** The new D1 figures match v1 except seniority: 245 of 632 finals have it set (v1 said 374 blank; today 387 blank). That is restated at U3.
- **Offering facts (BOND-07): 24 facts plus the 4 existing term columns.** 20 are Required (≥ 50% available; the 4 existing terms included) and 8 are "show where found". Most deal facts are in nearly every filing:
  - price to investors 98%
  - interest paid 95%
  - issue date 95%
  - document date 95%
  - early-repayment wording 100%
  - bank fee 86%
  - proceeds 84%
  - some selling bank 100%
  - trustee 73%
- **Three document families drive the rules:** prospectus supplements (154), MTN pricing supplements (148: Toyota, Caterpillar, Deere) and retail note tables (23: Verizon, GM).
  - Pricing date is labelled in only 45% of the 424Bs, but in 148 of 154 term sheets, so it is "show where found" and never derived.
  - Page numbers exist only in prospectus supplements: 154 of 325 filings (47%). Pricing supplements have none, so BOND-10 shows the section there.
- **Two findings that shape rules:**
  1. Toyota filings name two trustees in their indenture history, so a naive rule picks the wrong one (decision 9).
  2. Caterpillar and Deere pricing supplements name no trustee and Toyota's give no use of proceeds: these sit in base prospectuses, which are a document type outside scope, so they show "Not stated in the filing" (spec §11).
- **Schema CR2:** two WITHOUT ROWID tables with primary keys only (`bond_offering_fact`, `bond_offering_party`). About 12k row-writes, as two runs of ≤ 8k on Sat 28, as a separate write approval from the reliability apply on Thu 26.
- **Verification (BOND-12):**
  - automatic checks on every fact;
  - a stratified 20-filing manual check;
  - ≥ 95% correct per field, or the field is hidden;
  - 0 role, tranche or trustee-as-bank errors.

**Decisions for the Founder** (spec §17, each with a recommendation):
1. Field set.
2. Priced-on date only where labelled.
3. Use of proceeds as categories.
4. Early repayment as a structured value.
5. Pages only where printed.
6. BOND-CR2.
7. Two write approvals.
8. 95% verification gate.
9. Toyota trustee.
10. U2 on Mon 23 after the release.
11. Underwriting amounts stay out.
12. No base prospectuses.
13. v1 D1–D6, D8 and D9 carry over; D7 is replaced.

## 2 Measurements

**Filings sampled.** All 325 final filings in the 15 Oct snapshot, with status `debt`: 636 tranche rows, 28 issuers, 2024-01-03 → 2026-10-13. All 325 are in the local cache. The same 325 filings are final in D1. Plus 154 cached term sheets (FWPs). This is the whole corpus, not a sample.

**Method.** Scratchpad script `measure.mjs` (sha256 `2f2e1a25bf446e702848ba4d16ddf298d1682c8dcf08cea64579687b6cf9145a`). It imports the pure functions `htmlToText()` and `findIdentifiers()` from `bonds-parse.mjs` and runs one candidate rule per field. Results are in `results.json` (`6f6a0e195141e9eb0cc887449fb4dc5935cfc875a6e339362446ac37490aa9cb`). Both files are in the session scratchpad, not the repo.

The rules were refined once after a look at misses (Deere "Date of Issue", Caterpillar "Trade Date/Pricing Effective Time", AT&T undated cover, Verizon trustee table). Two Deere-specific patterns were confirmed by a separate count of 35 of 35 filings: "Plan of Distribution: Name" and "Redemption Provisions:". Fourteen Caterpillar filings contain redemption wording that the rule missed.

**"Available" means label and value found by the rule, not checked correct.** A 21-filing plausibility look at the values found:
- 2 bad discount values;
- 1 trustee problem, the Toyota two-trustee case;
- no bad dates or prices.

### Field availability (filings, of 325; A = 154 prospectus supplements, B = 148 pricing supplements, C = 23 retail tables)

| Field | All | A | B | C | FWP (154) |
|---|---|---|---|---|---|
| Document date | 309 (95%) | 138 | 148 | 23 | 61 |
| Guarantor | 42 (13%) | 42 | 0 | 0 | 4 |
| CUSIP/ISIN in the 424B text | 198 (61%) | 27 | 148 | 23 | 153 |
| CUSIP/ISIN on D1 rows | 276/632 (44%) | | | | |
| Price to investors | 317 (98%) | 152 | 148 | 17 | 152 |
| Interest paid | 309 (95%) | 144 | 148 | 17 | 148 |
| How interest is counted | 278 (86%) | 154 | 124 | 0 | 122 |
| Priced on (labelled) | 147 (45%) | 12 | 112 | 23 | 148 |
| Issue / settlement date | 308 (95%) | 146 | 147 | 15 | 127 |
| Ranking wording | 211 (65%) | 153 | 35 | 23 | 78 |
| Secured or unsecured | 177 (54%) | 154 | 0 | 23 | 41 |
| Early repayment wording | 311 (96%) by rule, + 14 variant = 325 | 154 | 134 + 14 | 23 | 129 |
| "No early repayment" stated | 105 (32%) | 48 | 57 | 0 | 8 |
| Change of control | 75 (23%) | 75 | 0 | 0 | 6 |
| Special mandatory redemption | 5 (2%) | 5 | 0 | 0 | 3 |
| Survivor's option | 17 (5%) | 0 | 0 | 17 | 0 |
| Use of proceeds | 203 (62%) | 141 | 62 | 0 | 31 |
| Bank fee | 280 (86%) | 150 | 113 | 17 | 57 |
| Proceeds before expenses | 272 (84%) | 142 | 113 | 17 | 107 |
| Bookrunner label | 200 (62%) | 147 | 36 | 17 | 146 |
| Co-managers | 146 (45%) | 111 | 35 | 0 | 134 |
| Agents | 213 (66%) | 77 | 113 | 23 | 48 |
| Underwriter list | 157 (48%) | 122 | 35 (Deere) | 0 | 0 |
| Any selling bank | 324 (100%) | 153 | 148 | 23 | |
| Trustee named | 236 (73%) | 154 | 76 (Toyota; ambiguous) | 6 | 16 |
| Risk factors (section or pointer) | 214 (66%) | 152 | 62 | 0 | 11 |
| Selling restrictions | 191 (59%) | 154 | 37 | 0 | 70 |
| Conflicts of interest | 125 (38%) | 125 | 0 | 0 | 8 |
| Listing statement | 134 (41%) | 134 | 0 | 0 | 30 |
| Printed page markers (BOND-10) | 154 (47%) | 154 | 0 | 0 | 0 |
| Internal section anchors (BOND-10) | 135 (42%) | 135 | 0 | 0 | 0 |

Notes on the table:
- The B early-repayment count is 99 by the first rule, plus 35 Deere filings with "Redemption Provisions: None", plus 14 Caterpillar filings with variant wording.
- The A early-repayment count already includes the "no early repayment" statements.

### D1 statements

| # | SQL (meridian-etf, --remote) | Result | rows_read |
|---|---|---|---|
| Q1 | `SELECT COUNT(*), COUNT(DISTINCT accession_number), SUM(principal_amount>0), SUM(maturity_date IS NOT NULL), SUM(coupon_rate IS NOT NULL OR spread_bps IS NOT NULL), SUM(currency IS NOT NULL), SUM(seniority IS NOT NULL), SUM(cusip IS NOT NULL OR isin IS NOT NULL), SUM(security_class IS NOT NULL), SUM(source_url IS NOT NULL), MAX(filing_date) FROM bond_issuance WHERE filing_status='final'` | 632 rows · 325 filings · principal 632 · maturity 632 · rate 627 · currency 632 · seniority 245 · identifier 276 · class 632 · source 632 · max 2026-10-15 | 632 |

1 statement of the 6 allowed; 632 rows read of the 60,000 allowed; 0 written; no errors or retries.

**Tests:** `node --test` on the three bond test files gives **52/52 pass**.

**Local files read:**
- the Control, Task and the three pins;
- `November_Decisions_Log.md` (grep);
- `bonds-parse.mjs` (header and exports), `bonds-lib.mjs` (cache keying, grep), `bonds-ingest.mjs` (FWP handling, grep);
- `migrations/008-bonds.sql`;
- `state/dryrun-2026-10-15.json`;
- the 325 cached finals and 154 cached FWPs, decoded in memory;
- fixtures: UNH final, Toyota callable, GM final pricing supplement.

## 3 Deviations

1. **The Status file's `run_profile` was incomplete** (warning from `dispatch.mjs check`). This matters only for headless runs. This run is interactive, so nothing was changed.
2. **The measurement is the whole corpus, not a sample of ≥ 40.** Counts are label-and-value presence, not correctness. Correctness is assigned to BOND-12 (spec §6), and the spec says so in §2.
3. **The rules were refined once** after looking at misses, and the table reports the refined figures. Two values are counts by targeted pattern, not by the main rule: the Deere 35 and the 14 Caterpillar variant redemption wordings. The table marks both.
4. **v1 §1–7 are carried by reference, not copied** (spec §1 lists what changes). This keeps one normative copy of the reliability design.
5. **The seniority count differs from v1:** 245 set (387 blank) against v1's "374 blank". It is recorded and passed to U3; this packet did not investigate it.
6. **`/write-spec` was not loaded.** Its structure is already the Task's fixed layout, and the v1 run had applied it; the problem, goals, non-goals and user stories are in spec §0.

## 4 Boundaries kept

- **D1:** one SELECT only, from the repo root with `--remote` and no `-c`; 632 rows read; no writes.
- **Network:** no SEC/EDGAR or other requests (all documents came from the local cache), and no deploys.
- **Parser:** no discover, ingest or re-parse was run. Only the pure functions `htmlToText` and `findIdentifiers` were called, in the scratchpad, as the Control allows.
- **Repo:** no code, `docs/`, `.env*` or secrets touched; no token printed; no git writes.
- **Files written:** only `claude/specs/MA-NOV-BOND_Spec_v2.md` and this report. Scratch files are in the session scratchpad, outside the repo.
- **Records:** no Status, board, Tower, `transitions.jsonl`, factory, log or LANE_OPENER files touched.
- **Other:** no LaunchAgents, installs or subagents; `13F Seed/gleif-seed.js` untouched.
- **Stop gate (excluded scope):** four items are recorded in spec §11, not designed around:
  - base prospectuses;
  - structured notes;
  - per-bank underwriting amounts;
  - yields on term sheets.
