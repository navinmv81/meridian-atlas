# MA-NOV-BOND.FIX3 — Offering review fixes, withheld fields, SQL rebuild + rehearsal + re-check — Report

```text
PACKET:   MA-NOV-BOND.FIX3 · Control v1 69d17091…9f2d ✓ · Task v1 fad4425a…5703 ✓ · LANE_OPENER_v2 67913343…71d6 ✓
PINS:     BOND.REVIEW report d9a78f44…1f78 ✓ · spec v2 c4281815…aef ✓ · OFFER2 report b9693db0…2b5b ✓ · bonds-offering.mjs blob 807d2737 at HEAD ✓
RUN:      r-20261123T064904Z-68fe · interactive · 2026-11-23 · HEAD 01c5379 = origin/November-2026 at start
ROLE:     Data-Identity Lead + Engineering Lead
OUTCOME:  DONE — bonds-offering-1.2.0; F1, F2, F8, F9 fixed with tests; 3 fields withheld; F7 method recorded; offering SQL rebuilt
          as 2 runs (7,989 · 7,581 writes), rehearsed clean; re-check: 0 blocking rows, every shown field 100% on the 20-filing sample.
          NOT run on D1.
D1 / SEC: 2 of 2 allowed read-only SELECTs (943 + 164 rows read, 0 written) · 0 SEC or other network requests · 0 installs · 0 subagents
```

## 1 Fixes

All in `App/Corporate Atlas/bonds/bonds-offering.mjs`, now `bonds-offering-1.2.0`. It is still pure, with no I/O.

| # | BOND.REVIEW finding | Cause | Fix | Test |
|---|---|---|---|---|
| F1a | 30/360 shown on 8 floating tranches | The day-count reader applied one convention to every tranche. It also did not recognise "actual number of days in an interest period and a 360-day year" or "a 360-day year for the actual number of days elapsed". | Each convention now keeps the tranches its own sentence names (`scopeOf`). A "This payment convention is …" sentence takes its tranche from the sentence before it. When a filing has both fixed and floating tranches, a floating tranche never takes an unscoped 30/360. The two Actual/360 wordings above are now read. Three kinds of wording are not used for plain tranches: wording about fixed-to-floating periods, and make-whole yield definitions ("Comparable Government Bond", "yield to maturity"). | AbbVie ×2, Oracle |
| F1b | AbbVie 2066 notes given the floating notes' quarterly dates | On the cover, the title list "… 5.650% SENIOR NOTES DUE 2066" ran into "Interest on the Floating Rate Notes is payable …". | A cover sentence now starts at its own "Interest on/is/will" when a title or amount comes before it. | AbbVie ×2 |
| F1c | "yes" on AbbVie floating notes; make-whole on the Amazon 26-027669 floating notes | "may not be redeemed prior to maturity" was not a "no" wording. The SMR-only aside "(other than pursuant to a Special Mandatory Redemption …)" blocked it. The make-whole scope also ran past ".” " into the floating notes' sentence. | "may/will not be redeemed prior to maturity" now reads as "no". An aside that excepts only an SMR is set aside, because the SMR is field 18. Sentences now also end at ".” ". | AbbVie ×2, Amazon EUR |
| F2 | Qualified groups at tranche 0; double roles; Citigroup and Goldman missing from tranche 2 | The qualifier was read by year. "2028" has two AbbVie tranches, so the read failed and fell back to tranche 0. | Each qualifier item is read like `namedTranches`. "2028 Notes" next to "Floating Rate Notes due 2028" is the fixed tranche. If any item does not map, the bank gets no row and a note, never a tranche-0 row. A qualifier that names no tranche ("*in alphabetical order", Oracle) stays tranche 0. A new check treats one bank with two selling roles on one tranche (tranche 0 counts as every tranche) as a clash. | AbbVie ×2, Oracle, synthetic |
| F8 | "Not stated" bank fee on Toyota floating notes that print per-agent commissions | `absent()` ran whenever no single fee was read. | On a pricing supplement that prints a fee we do not read (a per-agent commission or "Up to x%"), the fee row is left out instead. 15 rows: 14 per-agent, 1 "Up to"; all 15 checked in the source. | Toyota two agents |
| F9 | "P NC Capital Markets LLC"; AmEx fixed-to-floating day count | The HTML splits the name into `<B>P</B><B><I></I></B><B>NC …`. Fixed-to-floating tranches took one convention with no period. | The stored name is "PNC" (`DECODE_FIX`). Fixed-to-floating tranches get no day-count row ("not shown", OFFER1 D6): 10 rows (AmEx 2, Toyota 8). A pricing supplement no longer claims "Not stated" for them either. | Oracle, AmEx EUR, AmEx FTF |

**F7, canonical before-hash.** It is recorded in `apply/before-hash.mjs` (`20fae3cf…4eda`):
- **Method:** take `results` of the first statement of `wrangler d1 execute … --json`, sort by `accession_number` then `tranche_seq`, and compute `sha256(JSON.stringify(rows))` in UTF-8 with keys in wrangler's column order. `meta` is ignored.
- **Today's value:** `SELECT * FROM bond_issuance` gives 943 rows and **`d70c311a8f5f06cad69b3d3558b10eff3d4ba2233044eaa93db0e6eb514ada51`**. That is identical to BOND.REVIEW's 22 Nov value, so D1 is unchanged: 23 columns, latest `ingested_at` 2026-10-30T21:18:10Z.
- **The CR's `cbe392e1…6251`:** it matches neither this method nor the unsorted variant (`02dd1ba8…8236`), so it stays unreproducible. U6/U8 should use `d70c311a…`.

**Reproducibility (F10).** `offer-dryrun.mjs` takes `--generated=`. Two runs with the same stamp give byte-identical output, and so do the SQL headers that carry its hash.

## 2 Withheld fields

`export const WITHHELD_FIELDS` and `applyWithheld()` in `bonds-offering.mjs` are the one list the UI reads.

| Field | Withheld how | Rows taken out of the apply |
|---|---|---|
| `use_of_proceeds` | no row | 322 |
| `proceeds_total` | no row | 171 |
| `selling_restrictions` | row kept (section link + heading, cut order step 4); `value_text` (the place list) is NULL | 151 values nulled; 322 rows kept |

- **Still computed:** the extractor reads all three, ready for December.
- **Enforced in two places:** `offer-build.mjs` applies the list and refuses to build if a withheld value gets through. `offer-checksheet.mjs` applies the same list.
- **Proven in the rehearsal:** after the apply there are 0 withheld rows and 0 `selling_restrictions` values.

## 3 Rehearsal

Run on a fresh `node:sqlite` copy with the script `rehearse3.mjs` (`6a1872f6…d603`), which follows BOND.REVIEW's method but was written anew. Inputs: today's D1 rows `d1-rows.json` (`43549418…5847`) and schema `d1-schema.json` (`e35af8d7…c9`). Result: `rehearsal3-result.json` (`a5303fa3…f0ea`). All are in the session scratchpad.

| Step | Result |
|---|---|
| Load | 943 rows; canonical hash `d70c311a…ada51` |
| CR1 → FIX2 apply | 945 statements, 945 changes, 0 mismatches |
| CR2 | 2 tables, integrity ok |
| Offering run 1 · 2 | **7,989 · 7,581 changes, 0 mismatches** against every batch vector |
| After apply | 11,576 facts + 3,994 parties = summary. All at `bonds-offering-1.2.0`. 0 withheld rows, 0 place lists, 0 orphan tranches, 0 shown facts without a source. Longest value 125 characters. **0 trustee-as-bank, 0 double roles, 0 qualified banks at tranche 0, 0 floating 30/360, 0 fixed-to-floating day counts.** `checkAgainstIssuance` gives 0 differences. `bond_issuance` is byte-identical. |
| Apply again | 0 changes |
| Rollback run 2 → 1 | 7,581 · 7,989 deletes, 0 mismatches; equal to the state after CR2 byte for byte |
| CR2 rollback → FIX2 rollback → CR1 rollback | Each equals its prior state byte for byte, covering schema, values and `typeof`. The final state equals the loaded D1 copy. |
| Guard test (CR1 + CR2 without the reliability apply) | 749 statements, **0 rows written** |

## 4 Re-check and restated gate table

**Method.** I located each value at its `char_offset` in the cached text, decoded as the extractor decodes it. I read the cover bank blocks, the term blocks and the convention sentences by hand. Any "Not stated" claim was checked against the whole filing. This is BOND.REVIEW's method, done independently of the extractor's own output.

**Changed rows vs `01c5379`'s SQL.** 832 rows changed (content only; `parser_version` and `ingested_at` excluded). All are checked.
- **Withholding (644 rows):**
  - 322 `use_of_proceeds` and 171 `proceeds_total` rows are removed.
  - 151 `selling_restrictions` rows lose their place list. A script confirmed that nothing else in those rows changed.
- **Day count (57 rows):**
  - **45 changed:**
    - 8 F1a floating rows are now Actual/360, each from its own sentence.
    - 15 Toyota rows moved to their own tranche's term block. A script confirmed the next CUSIP is that tranche's in 15 of 15.
    - 7 Amazon EUR and 3 Amazon GBP rows now cite their own "ACTUAL/ACTUAL (ICMA)" sentence instead of the make-whole definition.
    - 4 Amazon CAD and 2 Realty Income rows cite their own tranche sentence.
    - 6 AmEx floating rows cite the base prospectus's "Floating Rate Debt Securities … Actual/360" instead of its fixed-to-floating period wording.
    - Every value is unchanged except the 8 F1a rows.
  - **11 removed:** fixed-to-floating tranches, plus 1 AmEx floating row whose only source was fixed-to-floating period wording.
  - **1 added:** AmEx 26-010379 (fixed-to-fixed), 30/360. It matches the base prospectus's 30/360 for fixed and fixed-to-fixed securities.
- **Interest paid (15 rows):**
  - 2 removed: AbbVie 2066 notes in both filings.
  - 2 changed: the AbbVie floating rows now start at "Interest on".
  - 11 rows in AbbVie 24-027205 and 25-015715 now come from the cover sentence "Interest on each series of Notes is payable on March 15 and September 15 …". This is correct for every series.
- **Early repayment (3 rows):** AbbVie floating ×2 are now "No". The Amazon EUR floating note is now "Yes, tax redemption", with no make-whole.
- **Bank fee (15 rows removed):** each filing prints its fee per agent, or as "Up to".
- **Parties (98 rows):**
  - AbbVie 26-020619: 72 rows. AbbVie 26-092114: 79 rows. Every bank, role and tranche matches the cover block.
  - Each bank's bookrunner and co-manager tranches do not overlap.
  - Citigroup and Goldman are bookrunners on t1 and t2.
  - Oracle 25-217490: "PNC Capital Markets LLC".
  - 4 `parties.*` count facts follow from the party rows.

**Checked in full.** Every shown row of AbbVie 26-020619 (99 facts + 72 parties), AbbVie 26-092114 (130 facts + 79 parties) and Amazon 26-027669 (115 facts + 29 parties) was checked against the cached source. All are correct.

Observation, not blocking: in both AbbVie filings the 2028 fixed tranche's maturity cites "March 3, 2028 for the Floating Rate Notes", which is the same date in the phrase just before its own. The value is correct; the row is unchanged from OFFER1.

**Restated 20-filing gate table.** Unchanged rows keep BOND.REVIEW's verdicts. Changed rows carry this re-check's verdict.

| Field | Checked | Correct | % | Gate |
|---|---|---|---|---|
| Document date · Issue date · Priced on | 20 · 19 · 20 | all | 100 | show |
| CUSIP/ISIN · Amount · Currency · Rate · Matures | 58 each | all | 100 | show |
| Price to investors | 52 | 52 | 100 | show |
| Interest paid | 53 | 53 | 100 | show (the wrong AbbVie 2066 row is gone) |
| How interest is counted | 57 | 57 | 100 | show (AbbVie floating fixed; 2 Toyota rows moved to their own block) |
| Ranking · Secured | 45 · 58 | all | 100 | show |
| Early repayment | 58 | 58 | 100 | show |
| Change of control · SMR · Survivor's option | 3 · 7 · 8 | all | 100 | show |
| Bank fee | 51 | 51 | 100 | show (the Toyota "Not stated" row is gone) |
| Proceeds % · per-tranche amount | 44 · 37 | all | 100 | show |
| Risks · Conflicts · Listing | 20 · 2 · 9 | all | 100 | show |
| Where the notes may not be sold | 20 | 20 | 100 | **link + heading only** (place list withheld) |
| What the money is for · Proceeds, whole deal | 0 · 0 | — | — | **withheld** |
| Party-group states | 105 | 105 | 100 | show |
| Parties | 254 | 254 | 100 | show (6 wrong-tranche rows replaced by 32 tranche rows; PNC fixed) |
| **Overall** | **1,232** | **1,232** | **100** | |

**Blocking classes:** 0 wrong-tranche rows, 0 double roles, 0 trustee or guarantor shown as a bank, 0 shown values without a source. **The §6.3 gate is met for the offering write.**

## 5 New row counts per run

From `offer-summary.json` (`06824fa0…4b10`), built at `ingested_at` 2026-11-23T08:00:00Z from `offer-run.json` (`c7641efb…89ff`). Parser `bonds-1.3.1`, offering `bonds-offering-1.2.0`.

| Run | Filings | Batches | Statements | Facts | Parties | Row-writes | Apply sha256 | Rollback sha256 |
|---|---|---|---|---|---|---|---|---|
| 1 | 195 | 5 | 432 | 5,902 | 2,087 | **7,989** | `fad02a73…8f71` | `041ea233…4b10` |
| 2 | 127 | 4 | 317 | 5,674 | 1,907 | **7,581** | `8e189ea5…3294` | `c3979989…149a` |
| **Total** | 322 | 9 | 749 | **11,576** | **3,994** | **15,570** | | |

- **Two runs.** Withholding takes the total from 16,016 to 15,570 rows, so the offering now fits in **two** runs of ≤ 8,000 (was 3). **`offer-apply-run3.sql` and `offer-rollback-run3.sql` are deleted.** A leftover run 3 would insert 1.1.0 rows.
- **Rollback** deletes by `parser_version = 'bonds-offering-1.2.0'`.
- **Generated files:**
  - `offer-diff.tsv` `aca60222…a7a6`: 15,570 lines.
  - `offer-check-sheet.md` `a94030a1…6c93`: 20 filings, 978 facts + 254 parties, withheld fields taken out.
- **For the Tue 24 budget (BOND.REVIEW Tech Ops):**
  - CR2 + offering is now ≈ **15.6k** row-writes (was 16.0k). Each run still starts only if live `rows_written` + the run ≤ 58k.
  - A full offering rollback costs up to 15,570 deletes.

## 6 Tests

`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs` → **138 tests, 138 pass, 0 fail** (125 existing + 13 new in `tests/bonds-fix3.test.mjs`, `446c98bb…d5d0`). The tests make no network calls and no D1 calls.

| Test | Fixture |
|---|---|
| F1a AbbVie: floating Actual/360, fixed 30/360 | **new** `abbvie-424b5-tranche-banks-2026-02-26` (26-020619) |
| F1a AbbVie 26-092114 + Oracle 26-035603 | existing |
| F1a/F9 fixed-to-floating: no day count; fixed-to-floating period wording not used for a floating tranche | **new** `amex-424b2-eur-ftf-2026-06-11` (26-073020) · existing `amex-424b2-ftf-2026-02-04` |
| F1b no floating dates on the 2066 notes (both AbbVie filings) | as above |
| F1c AbbVie floating "No"; Amazon EUR floating "Yes, tax" with the make-whole only on the fixed notes | **new** `amazon-424b5-eur-frn-2026-03-13` (26-027669) |
| F2 AbbVie qualified tranche rows (no double role; Citigroup and Goldman on t1, t2); AbbVie 26-092114 disjoint roles; Oracle "*in alphabetical order" stays t0; synthetic unmapped qualifier gives no row + note | as above |
| F8 Toyota per-agent commissions → no fee row | **new** `toyota-424b2-mtn-frn-two-agents-2024-02-21` (24-002543) |
| F9 Oracle "PNC Capital Markets LLC" | existing `oracle-424b2-final-2025-09-25` |
| Withheld fields and row shape | AbbVie |
| F7 canonical hash (order, `meta`, bare array) | synthetic |

The four new fixtures are copies of `state/cache` files, recorded in `fixtures/manifest.json` with their html sha256.

**One existing assertion changed:** `bonds-offer2.test.mjs` line 50 now expects version `bonds-offering-1.2.0` (D1).

## 7 Deviations

1. **D1 — Version bump to `bonds-offering-1.2.0`.**
   - Offering rows changed. The rollback SQL deletes by version, so a new version keeps a 1.1.0 build and a 1.2.0 build apart.
   - OFFER2's version assertion was updated to match.
2. **D2 — Two runs, not three.** Withholding brought the total under 2 × 8,000. The stale run-3 files are deleted (§5).
3. **D3 — Two day-count rules beyond F1/F9, both found by this packet's re-check.**
   - **(a) Fixed-to-floating period wording is not used for plain tranches.** AmEx floating notes had cited the base prospectus's fixed-to-floating floating-period sentence. 6 now cite the "Floating Rate Debt Securities" sentence, and 1 has no other source and is removed.
   - **(b) Make-whole yield definitions are not read as the notes' convention.** These are wordings such as "Comparable Government Bond", "yield to maturity", "Reference Bond" and "Bund Rate". 10 Amazon rows now cite each tranche's own sentence; the values are unchanged.
4. **D4 — An unmapped qualifier gives no bank row (plus a note), never a tranche-0 row.** None occurs in the corpus; it is covered by a synthetic test. A qualifier that names no tranche stays tranche 0 (Oracle).
5. **D5 — The double-role check is a clash.** It drops the filing's parties, as BOND-11 clashes do. It fires on 0 filings in the corpus.
6. **D6 — Toolchain files edited in `apply/` (allowed path):**
   - `offer-build.mjs`: withheld list, header wording, summary `withheld`;
   - `offer-dryrun.mjs`: `--generated`;
   - `offer-checksheet.mjs`: withheld list, link-only place cell.
7. **D7 — A Fixed-to-fixed tranche can now get a row.** AmEx 26-010379 gains a day-count row (30/360). It had none before because the fixed-to-floating wording conflicted. Its value matches the base prospectus.

## 8 Boundaries kept

- **Files written (all on the Control's list):**
  - `bonds-offering.mjs` (`7c1ae3ac…5766`);
  - `tests/bonds-fix3.test.mjs` (new) and `tests/bonds-offer2.test.mjs` (one line);
  - `fixtures/manifest.json` + 4 new `.htm.gz`;
  - `apply/before-hash.mjs` (new), `apply/offer-build.mjs`, `apply/offer-dryrun.mjs`, `apply/offer-checksheet.mjs`;
  - the regenerated `apply/offer-apply-run1/2.sql`, `offer-rollback-run1/2.sql`, `offer-diff.tsv`, `offer-summary.json` and `offer-check-sheet.md`;
  - `apply/offer-*-run3.sql` deleted;
  - this report.
- **Unchanged:**
  - `bonds-lib.mjs` (no helper was needed);
  - `bonds-parse.mjs`, `bonds-ingest.mjs` and the FIX2 SQL;
  - migrations, Workers, the front end and `docs/`;
  - `.env*`;
  - `state/` (read only);
  - Status, board, Tower, `transitions.jsonl` and logs;
  - `13F Seed/gleif-seed.js`.

  The Main Lane's uncommitted edits in the working tree are left as they are and are not in this commit.
- **External calls:**
  - 2 read-only D1 SELECTs: `SELECT * FROM bond_issuance` (943 rows read) and `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name LIKE 'bond%'` (164 rows read). 0 written.
  - No other SQL against D1. 0 SEC or network requests, 0 installs, 0 subagents.
- **Copying:** no sentence of a filing is stored. The longest value is still 125 characters.
- **Read only:** BOND.REVIEW's scratchpad `rehearse.mjs` (`9192347e…7463`), to follow its method.
- **Git:** one commit with explicit paths, pushed to `November-2026` (see the run's `END` line and `git ls-remote`).
