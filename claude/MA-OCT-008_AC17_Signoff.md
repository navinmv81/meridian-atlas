# MA-OCT-008 AC17: Data-Identity Lead sign-off (skipped rows and parser rulings)

```text
ISSUED BY:    Data-Identity Lead (LANE-8, 008 spec owner), Thu 15 Oct 2026, ≈ 05:55 UTC
EXECUTED BY:  Data-Identity Lead (doc-only: 0 D1, 0 SEC requests, no git writes, no code edits)
REVIEWED BY:  Architect sees B-3, B-4 and L8-12 at the 008 close-out (see §0, "Independence")
APPROVED BY:  Founder
PACKET:       MA-OCT-008.AC17. Control v1 e8655b0e8fa0fddd8c36a52dfb9977d18774f8ae486272d433deb88ffd282be6;
              Task v1 6a3a955b16b0efddff0eafc3dd25e2804ed859debe7595bf8701c48c01814d16
VERDICT:      AC17 SIGNED: 51 of 51 skips correct, 0 rejected. B-1, B-1b, B-2 ACCEPTED. B-3 and B-4 ACCEPTED WITH CONDITIONS.
              Demand notes ACCEPTED, extended to merger and plan documents. Co-registrants: own CIK and own link row (L8-12).
              Recurring instruments: both rows load, and 009 collapses them by instrument_key (L8-13).
              The pilot (ICE, UnitedHealth, Toyota) may start once the build lane has applied the rulings in §2 and re-run the dry run (§5).
```

## 0. Evidence and method

| Input | SHA-256 (re-hashed on disk) |
|---|---|
| Control v1 | `e8655b0e8fa0fddd8c36a52dfb9977d18774f8ae486272d433deb88ffd282be6`. Matches `packets/STATUS_BOARD.md` row 31. |
| Task v1 | `6a3a955b16b0efddff0eafc3dd25e2804ed859debe7595bf8701c48c01814d16`. Matches the Control. |
| `packets/MA-OCT-008.BUILD_Report.md` (Wed 14 section) | `142383c67c6687d7029dd7f12f532c605b0534b2a691eb32d9bddb0f9ef6220b`. Matches the Task. |
| `MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` |
| `App/Corporate Atlas/bonds/state/dryrun-2026-10-14.json` | `f60487104b5d1316d0387f79ef50aa5cda78642a7f3e3b4b812b3576e6876602`. Matches the build report. |

**Method**
- Repo: HEAD `3960aee`, branch `October-2026`, no `.git/*.lock`.
- For every one of the 51 rows, I read the dry-run record: rule, extracted title and notes.
- I opened the cached filing text (the build lane's `state/cache/`, read-only) for:
  - the four rows whose extracted title was weak or garbled (rows 2, 4, 27 and 29);
  - all 45 whole-filing `parse_failed` documents (§2.6);
  - the B-1 and B-1b examples.
- I scanned all 51 skipped documents for a debt title ("Notes/Debentures due") in the first 6,000 characters, to catch a debt offering hidden inside an equity skip.
- No other source was used: 0 D1 statements, 0 SEC requests, 0 code edits.

**Independence (please note).**
- I did not write the build code. This sign-off is not a review of my own work.
- However, **this same chat session acted as REVIEW-A (Architect)** on 8–9 Oct, including the 008 Architect review and its rev 1.2 check. The Task routes B-3, B-4 (and here also L8-12) to "the Architect at the 008 close-out".
- **That check must therefore be done by a fresh Architect session**, not this one, or the rulings below would be reviewed by their author.

## 1. AC17: the 51 `skipped_*` rows for the 29 non-Wells issuers

**Result: 51 signed, 0 rejected.** No skipped row is a new-money bond that v1 should load.

| Category | Rows | Rule |
|---|---|---|
| `skipped_other` | 7 | 6 exchange offers and 1 selling-holder share resale |
| `skipped_non_debt` | 44 | common stock (ATM programmes, block sales, resales, DRIPs), depositary shares and Equity Units |

The 22 `skipped_structured` rows are all Wells Fargo, which is outside AC17.

| # | Issuer | Accession | Form | Filed | Status | Verified as | DIL |
|---|---|---|---|---|---|---|---|
| 1 | Intercontinental Exchange, Inc. | 0001193125-24-197925 | 424B3 | 2024-08-09 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 2 | Capital One Financial | 0001193125-24-064921 | 424B5 | 2024-03-11 | `skipped_non_debt` | DRIP / stock purchase plan (common stock). | **SIGNED** |
| 3 | Capital One Financial | 0001193125-26-171719 | 424B7 | 2026-04-23 | `skipped_other` | Resale of common stock by selling holders (Brex acquisition shares); no debt offered. | **SIGNED** |
| 4 | Capital One Financial | 0001193125-26-263726 | 424B7 | 2026-06-09 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 5 | American Express | 0001104659-26-092092 | 424B2 | 2026-08-06 | `skipped_non_debt` | Depositary shares (preferred / mandatory convertible preferred). | **SIGNED** |
| 6 | Oracle | 0001193125-26-032756 | 424B5 | 2026-02-02 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 7 | Oracle | 0001193125-26-035662 | 424B5 | 2026-02-03 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 8 | Oracle | 0001193125-26-037818 | 424B5 | 2026-02-04 | `skipped_non_debt` | Depositary shares (preferred / mandatory convertible preferred). | **SIGNED** |
| 9 | Oracle | 0001193125-26-278585 | 424B5 | 2026-06-23 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 10 | Verizon Communications | 0001193125-25-075323 | 424B3 | 2025-04-08 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 11 | Verizon Communications | 0001193125-25-292398 | 424B3 | 2025-11-24 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 12 | Comcast | 0001193125-26-340289 | 424B3 | 2026-08-07 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 13 | Boeing | 0001193125-24-246629 | 424B5 | 2024-10-29 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 14 | Boeing | 0001193125-24-246634 | 424B5 | 2024-10-29 | `skipped_non_debt` | Depositary shares (preferred / mandatory convertible preferred). | **SIGNED** |
| 15 | Boeing | 0001193125-24-260962 | 424B3 | 2024-11-18 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 16 | Duke Energy Corp | 0001104659-26-024721 | 424B5 | 2026-03-06 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 17 | Duke Energy Corp | 0001104659-26-094253 | 424B5 | 2026-08-12 | `skipped_non_debt` | Equity Units (R3). | **SIGNED** |
| 18 | Southern Co | 0000092122-24-000053 | 424B2 | 2024-05-03 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 19 | Southern Co | 0000092122-25-000092 | 424B2 | 2025-11-04 | `skipped_non_debt` | Equity Units (R3). | **SIGNED** |
| 20 | Southern Co | 0000092122-26-000048 | 424B2 | 2026-06-08 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 21 | NextEra Energy | 0001193125-24-163714 | 424B2 | 2024-06-20 | `skipped_non_debt` | Equity Units (R3). | **SIGNED** |
| 22 | NextEra Energy | 0001193125-24-246576 | 424B2 | 2024-10-29 | `skipped_non_debt` | Equity Units (R3). | **SIGNED** |
| 23 | NextEra Energy | 0001193125-25-338333 | 424B5 | 2025-12-31 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 24 | NextEra Energy | 0001193125-26-083556 | 424B2 | 2026-03-02 | `skipped_non_debt` | Equity Units (R3). | **SIGNED** |
| 25 | Dominion Energy | 0001193125-24-130830 | 424B5 | 2024-05-03 | `skipped_non_debt` | Common stock. | **SIGNED** |
| 26 | Dominion Energy | 0001193125-25-039297 | 424B5 | 2025-02-27 | `skipped_non_debt` | Common stock. | **SIGNED** |
| 27 | Dominion Energy | 0001193125-25-186445 | 424B3 | 2025-08-22 | `skipped_non_debt` | DRIP administrator change (Dominion Energy Direct, common stock). | **SIGNED** |
| 28 | Dominion Energy | 0001193125-25-260905 | 424B5 | 2025-10-31 | `skipped_non_debt` | Common stock. | **SIGNED** |
| 29 | Realty Income | 0001104659-24-000822 | 424B3 | 2024-01-03 | `skipped_other` | Exchange offer (old notes for new registered notes); rule 1 "other", v1 out of scope. Not a new-money bond. | **SIGNED** |
| 30 | Realty Income | 0001104659-24-025001 | 424B7 | 2024-02-16 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 31 | Realty Income | 0001104659-24-025009 | 424B5 | 2024-02-16 | `skipped_non_debt` | DRIP / stock purchase plan (common stock). | **SIGNED** |
| 32 | Realty Income | 0001104659-24-026707 | 424B5 | 2024-02-23 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 33 | Realty Income | 0001104659-25-108170 | 424B5 | 2025-11-07 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 34 | Realty Income | 0001104659-26-057437 | 424B5 | 2026-05-08 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 35 | Welltower | 0001193125-24-037135 | 424B5 | 2024-02-15 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 36 | Welltower | 0001193125-24-123725 | 424B5 | 2024-04-30 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 37 | Welltower | 0001193125-24-234383 | 424B7 | 2024-10-08 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 38 | Welltower | 0001193125-24-246204 | 424B5 | 2024-10-29 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 39 | Welltower | 0001193125-25-066515 | 424B5 | 2025-03-28 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 40 | Welltower | 0001193125-25-067208 | 424B7 | 2025-03-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 41 | Welltower | 0001193125-25-067214 | 424B5 | 2025-03-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 42 | Welltower | 0001193125-25-067217 | 424B5 | 2025-03-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 43 | Welltower | 0001193125-25-067221 | 424B7 | 2025-03-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 44 | Welltower | 0001193125-25-167387 | 424B7 | 2025-07-29 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 45 | Welltower | 0001193125-25-252583 | 424B5 | 2025-10-28 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 46 | Welltower | 0001193125-25-252597 | 424B7 | 2025-10-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 47 | Welltower | 0001193125-25-252621 | 424B5 | 2025-10-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 48 | Welltower | 0001193125-26-188994 | 424B5 | 2026-04-29 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 49 | Welltower | 0001193125-26-189032 | 424B7 | 2026-04-29 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |
| 50 | Welltower | 0001628280-26-050175 | 424B5 | 2026-07-28 | `skipped_non_debt` | At-the-market common stock programme. | **SIGNED** |
| 51 | Welltower | 0001628280-26-050180 | 424B7 | 2026-07-28 | `skipped_non_debt` | Common stock offering / resale. | **SIGNED** |

**Notes on the signed rows (no change to any sign):**

- **N-1: debt inside equity filings.** The debt-title scan found notes or debentures in 7 skipped documents. None is a standalone bond offering:
  - rows 17, 19, 21, 22 and 24 are the Remarketable Senior Notes or Series N/O/P/Q Debentures that form part of Equity Units (R3);
  - rows 37 and 40 are Welltower shares issuable on exchange of privately placed Exchangeable Senior Notes.

  These are correct skips. *Coverage note for v2:* when Equity-Unit debt is later remarketed, it becomes standalone debt, but the remarketing filing is skipped by rule 1 ("remarketing").
- **N-2: exchange offers (rows 1, 10, 11, 12, 15, 29) are correct v1 skips, but they leave a coverage gap.**
  - The new registered notes are real bonds, and some reach the shelf only this way: Boeing's 2027–2034 notes, which is why Boeing shows 0 finals; Realty Income's new notes exchanged for Spirit Realty's 4.450% 2026 to 2.700% 2032 series; Verizon's 4.780% 2035 and 5.401% 2037; Comcast's 5.168% 2037; ICE's 3.625% 2028.
  - Logged as a **v2 backlog item** ("ingest the new-notes leg of exchange offers"). It is not a rejected skip, because spec §7.3 rule 1 deliberately puts exchange offers out of v1 scope.
- **N-3: title capture (build fix, not a sign issue).** The classification is right, but the stored title is unusable as an audit title:
  - row 2 (Capital One DRIP) captured the legend sentence ("…is accurate or complete…");
  - row 29 (Realty Income) captured the EDGAR file header.

  The build lane should prefer the cover's offering line (here "7,500,000 Shares Common Stock" and "Offers to Exchange All Outstanding Notes … Issued By Spirit Realty, L.P.") and skip EDGAR header tokens.

## 2. Rulings on B-1, B-1b, B-2, B-3, B-4 and the demand-note proposal

**B-1: ACCEPT (priority; protects D12).**
- I checked GM `0000804269-25-000030` and Verizon `0001193125-24-223675`. Each opens "Preliminary Pricing Supplement No. …" with principal `[ ]`, and has neither R2 marker. Under R2 alone, both would be served.
- Rule as built: on 424B forms only, the heading `Preliminary\s+Pricing\s+Supplement` (case-insensitive) in the first 2,000 visible characters makes the filing `preliminary`. This runs in §7.2, before the §7.3 gate.
- Recorded as **R2b**. An FWP is still never classified.

**B-1b: ACCEPT, generalised (L8-14).**
- GM `0000804269-25-000017` is headed "Pricing Supplement No. 5", but its principal and net-proceeds cells are `[]`. That makes it preliminary in substance, and the priced No. 5 follows on 10 Mar.
- Build rule: a retail-table filing whose amount cells are placeholders → `preliminary`. Accepted.
- **Generalised for every layout:** a row may be `final` only if `principal_amount` > 0. A tranche without a parsed principal becomes a per-tranche `parse_failed` (A8-4), or `preliminary` when the filing shows placeholders.
- The dry run has 0 finals with a NULL principal, so this changes no current row. It is a guard, and needs one unit test.

**B-2: ACCEPT.**
- Rule 1 "other" also matches `offers?\s+to\s+exchange` and `exchange\s+offers?`. It applies only within the title scope (§7.3), as today.
- It moves the five "Offer(s) to Exchange" filings (ICE, Verizon ×2, Comcast, Realty Income) to `skipped_other`. All five are signed in §1.
- See N-2 for the v2 coverage note.

**B-3: ACCEPT WITH CONDITIONS (Architect to see at close-out).** The debt rule (§7.3 order 4) also accepts:
- (a) a series designator between the class word and "due": `\b(Notes?|Debentures?|Bonds?),?\s+Series\s+[A-Z0-9-]+\s+due\b`. This covers NextEra "Debentures, Series due 2031" and Toyota "Medium-Term Notes, Series B due …".
- (b) a retail CUSIP table, only under a pricing-supplement header.

Conditions:
1. Order is unchanged. B-3 sits at order 4, after other, structured and non-debt. B-1 and B-1b run first, in §7.2.
2. Every row from path (b) needs a principal > 0 (L8-14), a coupon (or a floating benchmark), and a full maturity date. Otherwise it is a per-tranche `parse_failed`.
3. The §14.2 60-tranche precision sample must include **at least 8 rows parsed through the B-3 paths**: at least 4 from (a) and at least 4 from (b). The dry run shows 23 rows via the retail table and 117 debt titles containing "Series". If B-3 rows score below 98% precision, B-3 is withdrawn before the load.
4. The run log records which path (`7.3-4`, `B-3a`, `B-3b`) each final row came from.

**B-4: ACCEPT WITH CONDITIONS (Architect to see at close-out).**
- Currency set: USD, EUR, GBP, CHF, JPY, plus **CAD** (`C$`, `CAD`, "Canadian dollar(s)") and **AUD** (`A$`, `AUD`, "Australian dollar(s)").
- Conditions:
  1. Match the prefixed symbols (`C$`, `A$`, `US$`) before a bare `$`. A bare `$` stays USD.
  2. The currency comes from the tranche title or cover line, as §7.4 says, never from elsewhere in the document.
  3. cp1252 mapping of numeric character references `&#128;`–`&#159;` follows the HTML5 decoding rule, e.g. `&#128;` → €. It applies only to numeric references, never to raw bytes in a document declared UTF-8.
  4. Unit tests: AT&T € (`&#128;`) and one C$ tranche each from Amazon and NextEra.
- Effect: 12 CAD rows stop being mislabelled USD, and AT&T's euro rows read EUR.

**Demand notes: ACCEPT, with an extension.** Variable Denomination Floating Rate Demand Notes have no maturity and are repayable on demand, so they are not bonds. Recording them as `skipped_other` makes coverage read correctly.

The rule (spec §7.3, new rule **5**):
- It replaces only the fall-through "none of the above → `parse_failed` (filing level)". It runs **only when no debt title was found**, so it can never skip a filing that rules 1–4 would parse.
- Within the first 6,000 visible characters:
  - (i) `Variable\s+Denomination\s+Floating\s+Rate\s+Demand\s+Notes?`, or one of the named programmes (`PowerInvestment`, `IncomeDriver`, `Right Notes`, `PremierNotes`, `Reliability Investment`) → `skipped_other`, `detail.reason = "demand_note"`.
  - (ii) **Extension:** merger and consent documents (`MERGER PROPOSED`, `NOTICE OF ACTION BY WRITTEN CONSENT`, `information statement/prospectus`) → `skipped_other`, `"merger_document"`.
  - (iii) **Extension:** stock-plan supplements (`direct stock purchase`, `dividend reinvestment`) → `skipped_non_debt`.

Leaving merger and plan documents as `parse_failed` would distort the parse-failure rate that the acceptance threshold relies on.

**Pre-signed for AC17.** I opened all 45 whole-filing "no title" `parse_failed` documents. These rows may move to a `skipped_*` status without another sign-off:

| Outcome | Accessions |
|---|---|
| (i) demand notes: 39 | Cat 0001104659-24-101325, -24-115700, -24-130643, -25-069365 and -25-076716 (the last two are PowerInvestment programme-closing notices). Toyota 0000950103-24-000926, -24-000929, -24-013821, -24-016160, -24-018045, -25-011849, -25-014173, -25-016152 and -26-014230. GM 0000804269-24-000017, -24-000024, -24-000030, -25-000002, -25-000046, -25-000052, -26-000002, -26-000015 and -26-000022. Duke 0001326160-24-000191, -25-000182, -25-000184, -25-000194, -25-000196, -26-000017 and -26-000042. Dominion 0001193125-24-126305 (DERI), -24-223122, -24-260371, -24-283649, -25-210047, -25-261680, -25-317540, -26-209312 and -26-393829. |
| (ii) merger documents: 5 | Capital One–Discover 0001193125-25-002170; Boeing–Spirit 0001193125-24-283231; Union Pacific–Norfolk Southern 0001193125-25-226560; NextEra–Dominion 0001104659-26-087576; Amazon–Globalstar 0001104659-26-098339 |
| (iii) stock plan: 1 | Dominion Energy Direct fee change 0001193125-25-261730 |

Any other row the rule moves into a `skipped_*` status must be listed in the re-run dry run and signed before a live batch for that issuer.

**Not changed:**
- GM `0001193125-25-308634` (424B5, "no tranche found") stays `parse_failed`.
- The 4 FWP-disagreement rows stay `parse_failed`, as §14.1 intends. The build lane suspects a misread on AT&T `0001193125-26-344905` and false conflicts on Dominion. It may fix the parser and re-run under §7.1's re-parse path, but must not override the cross-check.

## 3. L8-4 co-registrant issuers (ruling L8-12)

**Ruling.** A tranche belongs to the legal issuer named on the cover, never to the guarantor parent (L8-4 and D12: 0 wrong-issuer links).

Affected rows:
- NextEra Energy Capital Holdings, Inc.: 32 finals filed under NextEra Energy, CIK 0000753308.
- Welltower OP LLC: 6 finals under Welltower, CIK 0000766704.
- Pfizer Netherlands International Finance B.V.: 4 finals under Pfizer, CIK 0000078003.

The rule:
1. **Own CIK, own link row.** Rows whose cover issuer is a co-registrant with its own SEC CIK are stored with `bond_issuance.cik` = the co-registrant's CIK.
   - The build lane takes that CIK from the filing's own EDGAR index or header, which lists every filer on the accession: one request per co-registrant, ≤ 3 in total, inside the 1,500 cap.
   - Each co-registrant gets its own `bond_issuer_link` row, linked by the normal §11 rules (CIK → LEI → reviewed name → manual), with `status = 'paused'`. "Paused" means it is not polled separately, because its filings arrive through the parent's discovery, and its bonds stay visible (L8-9).
   - If no entity matches: `entity_id` NULL plus a 004 `missing_entity` DQ ticket, exactly as Founder Q2 says for any unmatched issuer. Never fall back to the parent.
2. **If the co-registrant's CIK cannot be established before the load,** those rows are **held back** (not written) and listed in the report. Do not write them under the parent's CIK.
3. **Mixed covers.** If a filing's tranches name different legal issuers, hold the whole filing and report it, rather than guess per tranche.
4. **Guarantees are not modelled in v1.** The parent guarantee is not stored. Logged as v2 backlog: an "issuer–guarantor edge".

**Effects.**
- `bond_issuer_link` grows from 30 to ≤ 33 rows. These are not new polled issuers, so the Founder-approved seed list of 30 polled CIKs is unchanged. **The Main Lane should still record this for the Founder.**
- No pilot issuer is affected (ICE, UnitedHealth, Toyota). The rule binds from the Fri load.
- Architect to see L8-12 at close-out, since it changes what `bond_issuance.cik` means for these rows.

## 4. Same instrument on several accessions (ruling L8-13)

**Accept: both or all rows load.**
- The primary key is per accession, each row is an immutable record of one filing, and no 008 schema change is needed.
- I checked all 19 keys (42 rows). There are two patterns:
  - **Toyota amended or restated pricing supplements**, where principal rises cumulatively. For example, `CUSIP:89236TLN3` goes $75m → $100m → $150m → $175m over 10–19 Jan 2024.
  - **Caterpillar reopenings or duplicates.** `CUSIP:14913V2E7` is $1bn on 10 Aug plus $50m on 13 Aug 2026, and `CUSIP:14913UAP5` appears twice on the same day with the same principal.

  So principal cannot simply be summed or simply replaced.

**How 009 should show them (contract for 009; no 008 change):**
1. **Issuer → bonds** shows **one bond per non-NULL `instrument_key`**. Its terms come from the row with the latest `filing_date`, then the highest `accession_number`. A badge reads "N filings", with each filing's `source_url` listed in bond detail.
2. **Never sum** `principal_amount` across rows. Show the selected row's principal labelled "per latest filing". *Future:* an outstanding-amount field from a better source.
3. Rows with a NULL `instrument_key` are never collapsed.
4. The keyset stays on 008's global tuple. Collapsing happens per page in the Worker, so a page may show fewer than 25 bonds (at most 4 rows per key in the data). That is acceptable for v1. The cursor still advances on raw rows, so nothing is skipped or repeated.
5. 009 coverage counts distinct `instrument_key` values plus unkeyed rows.
6. Bond → issuer (`LIMIT 1` on `instrument_key`) is unaffected: every recurring key has the same CIK. This fits with N8-3's distinct-CIK check.

## 5. What the build lane does before the pilot (no spec revision needed; rulings L8-12 to L8-14 and R2b to be logged)

1. **Code the rulings:**
   - B-1 / R2b;
   - L8-14 (principal > 0 for any `final`);
   - B-2;
   - B-3 with path logging;
   - B-4 with the matching order and the HTML5 cp1252 rule;
   - rule 5 (i)–(iii);
   - the N-3 title capture;
   - L8-12 (co-registrant CIK; hold if unknown).

   Add unit tests for each.
2. **Re-run the dry run** (0 D1 writes; SEC served from cache except ≤ 3 index requests). Report:
   - the new counts by status;
   - every `skipped_*` row **not** in §1 or the §2 pre-signed list (each must be signed before its issuer's first live batch);
   - the per-path counts for B-3.
3. **Pilot on ICE, UnitedHealth and Toyota** after T12 (registry row plus emitter) and the §15.3 steps 3–4.
   - Toyota's 9 demand-note rows are pre-signed, so the pilot does not wait on another sign-off unless step 2 lists new Toyota skips.

