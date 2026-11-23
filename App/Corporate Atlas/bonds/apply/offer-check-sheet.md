# MA-NOV-BOND — offering facts: 20-filing manual check sheet (spec v2 §6.2)

```text
GENERATED:  2026-11-23T08:00:00Z by apply/offer-checksheet.mjs from offer-run.json (c7641efb2a4a6701…)
OFFERING:   bonds-offering-1.2.0 · parser bonds-1.3.1
FOR:        U8 BOND.VERIFY — the Data-Identity Lead fills "Source value", "OK" and "Note"
SAMPLE:     20 filings · 14 issuers · 14 multi-tranche · 978 fact rows + 254 party rows to check
```

**How to check.** Open the filing link (it jumps to the section where the filing has an anchor). Find the value at the section and page given. Write what the filing prints in *Source value*, then *OK* = Y or N. "Not stated in the filing" is a claim too: mark N if the filing does state it. "@n" is the character position in the decoded text, for the verifier’s tool only.

**Gate (spec v2 §6.3).** ≥ 95% of checked rows correct overall and per field; a field below 95% is hidden for November. Any wrong party role, trustee or guarantor listed as a selling bank, fact on the wrong tranche, or shown value with no source location blocks the offering release.

| # | Stratum | Filing | Issuer | Family | Tranches | Why chosen |
|---|---|---|---|---|---|---|
| 1 | A 424B5 syndicated, USD | [0001193125-25-142782](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) | UnitedHealth Group | A | 4 | UNH, 4 tranches, change of control |
| 2 | A 424B5 syndicated, USD | [0001193125-26-349174](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) | Intercontinental Exchange, Inc. | A | 4 | ICE, tranche-specific bank roles, special mandatory redemption on 2 of 4 tranches |
| 3 | A 424B5 syndicated, USD | [0001104659-26-020619](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) | AbbVie | A | 7 | AbbVie, 7 tranches, tranche-specific bank rows |
| 4 | A 424B5 syndicated, USD | [0001104659-24-000673](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) | Duke Energy Corp | A | 2 | Duke, 2 tranches |
| 5 | A multi-tranche | [0001193125-25-064173](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) | AT&T | A | 3 | AT&T, EUR, European bank names, tax redemption |
| 6 | A multi-tranche | [0001193125-25-120844](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) | Pfizer | A | 4 | Pfizer Netherlands, EUR, guaranteed by Pfizer Inc. (filed as 424B5) |
| 7 | A multi-tranche | [0000950103-24-000197](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) | Toyota Motor Credit Corp | A | 4 | Toyota syndicated pricing supplement (family A), floating + fixed, two not redeemable |
| 8 | A multi-tranche | [0001193125-25-217490](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) | Oracle | A | 6 | Oracle, 6 tranches |
| 9 | A change of control / special mandatory redemption | [0001193125-25-216381](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) | Lowe's Companies | A | 5 | Lowe’s, change of control + special mandatory redemption |
| 10 | A change of control / special mandatory redemption | [0001193125-24-134264](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) | CVS Health | A | 5 | CVS, change of control |
| 11 | B Toyota | [0000950103-24-000537](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) | Toyota Motor Credit Corp | B | 1 | Toyota MTN, fixed rate callable |
| 12 | B Toyota | [0000950103-24-002543](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) | Toyota Motor Credit Corp | B | 1 | Toyota MTN, floating, two agents with separate commissions |
| 13 | B Caterpillar | [0001104659-24-105055](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) | Caterpillar Financial Services | B | 1 | Caterpillar, bank list not split in OFFER1 |
| 14 | B Caterpillar | [0001104659-24-000426](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) | Caterpillar Financial Services | B | 1 | Caterpillar, fixed |
| 15 | B Deere | [0001104659-24-000827](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) | John Deere Capital Corp | B | 1 | Deere, fixed, "Redemption Provisions: None" |
| 16 | B Deere | [0001104659-24-005136](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) | John Deere Capital Corp | B | 1 | Deere, floating |
| 17 | C Verizon | [0001193125-24-057532](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) | Verizon Communications | C | 2 | Verizon retail table, 2 CUSIPs |
| 18 | C Verizon | [0001193125-24-207015](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) | Verizon Communications | C | 2 | Verizon retail table |
| 19 | C GM | [0000804269-25-000011](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) | General Motors Financial Co. | C | 2 | GM retail table, 2 CUSIPs |
| 20 | C GM | [0000804269-25-000028](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) | General Motors Financial Co. | C | 2 | GM retail table, 5 agents + trustee |

## 1. UnitedHealth Group — 0001193125-25-142782 (424B5, filed 2025-06-18, family A)

Filing: https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm · term sheets: 0001193125-25-142149

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.400% Notes due June 15, 2028 | 2028-06-15 | USD 500,000,000 |
| t2 | 4.650% Notes due January 15, 2031 | 2031-01-15 | USD 750,000,000 |
| t3 | 5.300% Notes due June 15, 2035 | 2035-06-15 | USD 1,000,000,000 |
| t4 | 5.950% Notes due June 15, 2055 | 2055-06-15 | USD 750,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-06-17 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @3325 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 91324PFN7; ISIN US91324PFN78 | [term sheet](https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm) · term sheet — CUSIP / ISIN · @3725 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 91324PFP2; ISIN US91324PFP27 | [term sheet](https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm) · term sheet — CUSIP / ISIN · @3764 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 91324PFQ0; ISIN US91324PFQ00 | [term sheet](https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm) · term sheet — CUSIP / ISIN · @3803 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 91324PFR8; ISIN US91324PFR82 | [term sheet](https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm) · term sheet — CUSIP / ISIN · @3842 |  |  |  |
| 6 | Amount | t1 | 500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @171 |  |  |  |
| 7 | Amount | t2 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @215 |  |  |  |
| 8 | Amount | t3 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @262 |  |  |  |
| 9 | Amount | t4 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @308 |  |  |  |
| 10 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @171 |  |  |  |
| 11 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @215 |  |  |  |
| 12 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @262 |  |  |  |
| 13 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @308 |  |  |  |
| 14 | Interest rate | t1 | 4.4% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @183 |  |  |  |
| 15 | Interest rate | t2 | 4.65% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @227 |  |  |  |
| 16 | Interest rate | t3 | 5.3% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @276 |  |  |  |
| 17 | Interest rate | t4 | 5.95% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @320 |  |  |  |
| 18 | Matures | t1 | 2028-06-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @200 |  |  |  |
| 19 | Matures | t2 | 2031-01-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @244 |  |  |  |
| 20 | Matures | t3 | 2035-06-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @293 |  |  |  |
| 21 | Matures | t4 | 2055-06-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @337 |  |  |  |
| 22 | Price to investors | t1 | 99.954% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2520 |  |  |  |
| 23 | Price to investors | t2 | 99.807% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2597 |  |  |  |
| 24 | Price to investors | t3 | 99.871% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2674 |  |  |  |
| 25 | Price to investors | t4 | 98.994% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2751 |  |  |  |
| 26 | Interest paid | t1 | semi-annual · 06-15, 12-15 · first 2025-12-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @886 |  |  |  |
| 27 | Interest paid | t2 | semi-annual · 01-15, 07-15 · first 2026-01-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @793 |  |  |  |
| 28 | Interest paid | t3 | semi-annual · 06-15, 12-15 · first 2025-12-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @886 |  |  |  |
| 29 | Interest paid | t4 | semi-annual · 06-15, 12-15 · first 2025-12-15 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @886 |  |  |  |
| 30 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-8 · @25110 |  |  |  |
| 31 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-8 · @25110 |  |  |  |
| 32 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-8 · @25110 |  |  |  |
| 33 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-8 · @25110 |  |  |  |
| 34 | Priced on | all | 2025-06-17 | [term sheet](https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm) · term sheet — Trade Date · @562 |  |  |  |
| 35 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @3030 |  |  |  |
| 36 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 37 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 38 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 39 | Ranking | t4 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 40 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 41 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 42 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 43 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1669 |  |  |  |
| 44 | Early repayment by the issuer | t1 | Yes · from 2028-05-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · optional redemption — Optional Redemption, page S-9 · @29731 |  |  |  |
| 45 | Early repayment by the issuer | t2 | Yes · from 2030-12-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · optional redemption — Optional Redemption, page S-9 · @29826 |  |  |  |
| 46 | Early repayment by the issuer | t3 | Yes · from 2035-03-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · optional redemption — Optional Redemption, page S-9 · @29926 |  |  |  |
| 47 | Early repayment by the issuer | t4 | Yes · from 2054-12-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · optional redemption — Optional Redemption, page S-9 · @30030 |  |  |  |
| 48 | Buy-back if control changes | all | Yes, at 101% of principal | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-11 · @36433 |  |  |  |
| 49 | Bank fee | t1 | 0.25% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2543 |  |  |  |
| 50 | Bank fee | t2 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2620 |  |  |  |
| 51 | Bank fee | t3 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2697 |  |  |  |
| 52 | Bank fee | t4 | 0.75% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2774 |  |  |  |
| 53 | Proceeds to the issuer before expenses (%) | t1 | 99.704% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2563 |  |  |  |
| 54 | Proceeds to the issuer before expenses (%) | t2 | 99.457% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2640 |  |  |  |
| 55 | Proceeds to the issuer before expenses (%) | t3 | 99.421% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2717 |  |  |  |
| 56 | Proceeds to the issuer before expenses (%) | t4 | 98.244% | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2794 |  |  |  |
| 57 | Proceeds to the issuer (amount, this tranche) | t1 | USD 498,520,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2574 |  |  |  |
| 58 | Proceeds to the issuer (amount, this tranche) | t2 | USD 745,927,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2651 |  |  |  |
| 59 | Proceeds to the issuer (amount, this tranche) | t3 | USD 994,210,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2728 |  |  |  |
| 60 | Proceeds to the issuer (amount, this tranche) | t4 | USD 736,830,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover table — Cover page, page cover · @2805 |  |  |  |
| 61 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_5) · risk factors — Risk Factors, page S-5 · @17275 |  |  |  |
| 62 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_9) · underwriting — European Economic Area, page S-23 · @77565 |  |  |  |
| 63 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @1843 |  |  |  |
| 64 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm#stoc883518_7) · description of the notes — Description of The Notes, page S-7 · @19321 |  |  |  |
| 65 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover |  |  |  |
| 66 | Banks / roles: bookrunner | all | 4 named | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover — Cover page, page cover · @3250 |  |  |  |
| 67 | Banks / roles: co_manager | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover |  |  |  |
| 68 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover |  |  |  |
| 69 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover, page cover |  |  |  |
| P2 | Barclays | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover, page cover |  |  |  |
| P3 | Citigroup | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover, page cover |  |  |  |
| P4 | J.P. Morgan | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · cover, page cover |  |  |  |
| P5 | U.S. Bank Trust Company, National Association | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm) · description of the notes, page S-7 |  |  |  |

## 2. Intercontinental Exchange, Inc. — 0001193125-26-349174 (424B5, filed 2026-08-13, family A)

Filing: https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm · term sheets: 0001193125-26-345198

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.700% SENIOR NOTES DUE 2029 | 2029-08-20 | USD 1,250,000,000 |
| t2 | 4.900% SENIOR NOTES DUE 2031 | 2031-09-01 | USD 1,100,000,000 |
| t3 | 5.150% SENIOR NOTES DUE 2033 | 2033-09-01 | USD 650,000,000 |
| t4 | 5.400% SENIOR NOTES DUE 2036 | 2036-09-01 | USD 750,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2026-08-11 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @7199 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 45865VAD2; ISIN US45865VAD29 | [term sheet](https://www.sec.gov/Archives/edgar/data/1571949/000119312526345198/d177529dfwp.htm) · term sheet — CUSIP / ISIN · @5039 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 45865VAE0; ISIN US45865VAE02 | [term sheet](https://www.sec.gov/Archives/edgar/data/1571949/000119312526345198/d177529dfwp.htm) · term sheet — CUSIP / ISIN · @5077 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 45865VAF7; ISIN US45865VAF76 | [term sheet](https://www.sec.gov/Archives/edgar/data/1571949/000119312526345198/d177529dfwp.htm) · term sheet — CUSIP / ISIN · @5115 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 45865VAG5; ISIN US45865VAG59 | [term sheet](https://www.sec.gov/Archives/edgar/data/1571949/000119312526345198/d177529dfwp.htm) · term sheet — CUSIP / ISIN · @5153 |  |  |  |
| 6 | Amount | t1 | 1,250,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @208 |  |  |  |
| 7 | Amount | t2 | 1,100,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @252 |  |  |  |
| 8 | Amount | t3 | 650,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @296 |  |  |  |
| 9 | Amount | t4 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @338 |  |  |  |
| 10 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @208 |  |  |  |
| 11 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @252 |  |  |  |
| 12 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @296 |  |  |  |
| 13 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @338 |  |  |  |
| 14 | Interest rate | t1 | 4.7% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @222 |  |  |  |
| 15 | Interest rate | t2 | 4.9% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @266 |  |  |  |
| 16 | Interest rate | t3 | 5.15% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @308 |  |  |  |
| 17 | Interest rate | t4 | 5.4% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @350 |  |  |  |
| 18 | Matures | t1 | 2029-08-20 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @950 |  |  |  |
| 19 | Matures | t2 | 2031-09-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @997 |  |  |  |
| 20 | Matures | t3 | 2033-09-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1046 |  |  |  |
| 21 | Matures | t4 | 2036-09-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1098 |  |  |  |
| 22 | Price to investors | t1 | 99.735% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @5946 |  |  |  |
| 23 | Price to investors | t2 | 99.488% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @5971 |  |  |  |
| 24 | Price to investors | t3 | 99.37% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @5996 |  |  |  |
| 25 | Price to investors | t4 | 99.128% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6019 |  |  |  |
| 26 | Interest paid | t1 | semi-annual · 02-20, 08-20 · first 2027-02-20 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1186 |  |  |  |
| 27 | Interest paid | t2 | semi-annual · 03-01, 09-01 · first 2027-03-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1321 |  |  |  |
| 28 | Interest paid | t3 | semi-annual · 03-01, 09-01 · first 2027-03-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1321 |  |  |  |
| 29 | Interest paid | t4 | semi-annual · 03-01, 09-01 · first 2027-03-01 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @1321 |  |  |  |
| 30 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_4) · summary — SUMMARY, page S-5 · @38464 |  |  |  |
| 31 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_4) · summary — SUMMARY, page S-5 · @38464 |  |  |  |
| 32 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_4) · summary — SUMMARY, page S-5 · @38464 |  |  |  |
| 33 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_4) · summary — SUMMARY, page S-5 · @38464 |  |  |  |
| 34 | Priced on | all | 2026-08-11 | [term sheet](https://www.sec.gov/Archives/edgar/data/1571949/000119312526345198/d177529dfwp.htm) · term sheet — Trade Date · @1682 |  |  |  |
| 35 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @6665 |  |  |  |
| 36 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @491 |  |  |  |
| 37 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @491 |  |  |  |
| 38 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @491 |  |  |  |
| 39 | Ranking | t4 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @491 |  |  |  |
| 40 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @4886 |  |  |  |
| 41 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @4886 |  |  |  |
| 42 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @4886 |  |  |  |
| 43 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @4886 |  |  |  |
| 44 | Early repayment by the issuer | t1 | Yes · from 2029-07-20 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_8) · optional redemption — Optional Redemption, page S-17 · @81403 |  |  |  |
| 45 | Early repayment by the issuer | t2 | Yes · from 2031-08-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_8) · optional redemption — Optional Redemption, page S-17 · @81506 |  |  |  |
| 46 | Early repayment by the issuer | t3 | Yes · from 2033-07-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_8) · optional redemption — Optional Redemption, page S-17 · @81610 |  |  |  |
| 47 | Early repayment by the issuer | t4 | Yes · from 2036-06-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_8) · optional redemption — Optional Redemption, page S-17 · @81717 |  |  |  |
| 48 | Mandatory early repayment if a deal fails | t3 | Yes, at 101%, if the deal fails by 2027-07-29 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @3881 |  |  |  |
| 49 | Mandatory early repayment if a deal fails | t4 | Yes, at 101%, if the deal fails by 2027-07-29 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @3881 |  |  |  |
| 50 | Bank fee | t1 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6065 |  |  |  |
| 51 | Bank fee | t2 | 0.6% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6085 |  |  |  |
| 52 | Bank fee | t3 | 0.625% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6105 |  |  |  |
| 53 | Bank fee | t4 | 0.65% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6125 |  |  |  |
| 54 | Proceeds to the issuer before expenses (%) | t1 | 99.385% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6182 |  |  |  |
| 55 | Proceeds to the issuer before expenses (%) | t2 | 98.888% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6207 |  |  |  |
| 56 | Proceeds to the issuer before expenses (%) | t3 | 98.745% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6232 |  |  |  |
| 57 | Proceeds to the issuer before expenses (%) | t4 | 98.478% | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6255 |  |  |  |
| 58 | Proceeds to the issuer (amount, this tranche) | t1 | USD 1,242,312,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6193 |  |  |  |
| 59 | Proceeds to the issuer (amount, this tranche) | t2 | USD 1,087,768,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6218 |  |  |  |
| 60 | Proceeds to the issuer (amount, this tranche) | t3 | USD 641,842,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6243 |  |  |  |
| 61 | Proceeds to the issuer (amount, this tranche) | t4 | USD 738,585,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover table — Cover page, page cover · @6266 |  |  |  |
| 62 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_5) · risk factors — Risk Factors, page S-7 · @42883 |  |  |  |
| 63 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_10) · underwriting — Selling Restrictions, page S-37 · @161135 |  |  |  |
| 64 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @5133 |  |  |  |
| 65 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm#supptx949580_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @68395 |  |  |  |
| 66 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover |  |  |  |
| 67 | Banks / roles: bookrunner | all | 8 named | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @6816 |  |  |  |
| 68 | Banks / roles: co_manager | all | 6 named | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover — Cover page, page cover · @7051 |  |  |  |
| 69 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover |  |  |  |
| 70 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P2 | Wells Fargo Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P3 | MUFG | bookrunner | Joint Book-Running Managers (for the 2036 notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P4 | Citigroup | bookrunner | Joint Book-Running Managers (for the 2029 notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P5 | Fifth Third Securities | bookrunner | Joint Book-Running Managers (for the 2033 notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P6 | PNC Capital Markets LLC | bookrunner | Joint Book-Running Managers (for the 2031 notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P7 | Goldman Sachs & Co. LLC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P8 | Mizuho | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P9 | BBVA | co_manager | Senior Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P10 | BMO Capital Markets | co_manager | Senior Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P11 | Huntington Capital Markets | co_manager | Senior Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P12 | M&T Securities | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P13 | KeyBanc Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P14 | SOCIETE GENERALE | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · cover, page cover |  |  |  |
| P15 | Computershare Trust Company, National Association | trustee | Successor trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/1571949/000119312526349174/d949580d424b5.htm) · description of the notes, page S-14 |  |  |  |

## 3. AbbVie — 0001104659-26-020619 (424B5, filed 2026-02-26, family A)

Filing: https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm · term sheets: 0001104659-26-020557, 0001104659-26-019303

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | SENIOR FLOATING RATE NOTES DUE 2028 | 2028-03-03 | USD 750,000,000 |
| t2 | 3.775% SENIOR NOTES DUE 2028 | 2028-03-03 | USD 1,500,000,000 |
| t3 | 4.125% SENIOR NOTES DUE 2031 | 2031-03-15 | USD 1,250,000,000 |
| t4 | 4.400% SENIOR NOTES DUE 2033 | 2033-03-15 | USD 1,250,000,000 |
| t5 | 4.750% SENIOR NOTES DUE 2036 | 2036-03-15 | USD 1,500,000,000 |
| t6 | 5.550% SENIOR NOTES DUE 2056 | 2056-03-15 | USD 1,250,000,000 |
| t7 | 5.650% SENIOR NOTES DUE 2066 | 2066-03-15 | USD 500,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2026-02-24 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @6138 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 00287YEC9; ISIN US00287YEC93 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @3472 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 00287YED7; ISIN US00287YED76 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @4092 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 00287YEE5; ISIN US00287YEE59 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @4732 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 00287YEF2; ISIN US00287YEF25 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @5370 |  |  |  |
| 6 | CUSIP / ISIN | t5 | CUSIP 00287YEG0; ISIN US00287YEG08 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @6010 |  |  |  |
| 7 | CUSIP / ISIN | t6 | CUSIP 00287YEH8; ISIN US00287YEH80 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @6650 |  |  |  |
| 8 | CUSIP / ISIN | t7 | CUSIP 00287YEJ4; ISIN US00287YEJ47 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926019303/tm266774d3_fwp.htm) · term sheet — CUSIP / ISIN · @7290 |  |  |  |
| 9 | Amount | t1 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @242 |  |  |  |
| 10 | Amount | t2 | 1,500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @291 |  |  |  |
| 11 | Amount | t3 | 1,250,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @335 |  |  |  |
| 12 | Amount | t4 | 1,250,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @379 |  |  |  |
| 13 | Amount | t5 | 1,500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @423 |  |  |  |
| 14 | Amount | t6 | 1,250,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @467 |  |  |  |
| 15 | Amount | t7 | 500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @511 |  |  |  |
| 16 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @242 |  |  |  |
| 17 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @291 |  |  |  |
| 18 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @335 |  |  |  |
| 19 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @379 |  |  |  |
| 20 | Currency | t5 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @423 |  |  |  |
| 21 | Currency | t6 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @467 |  |  |  |
| 22 | Currency | t7 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @511 |  |  |  |
| 23 | Interest rate | t1 | SOFR + 48 bps | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14385 |  |  |  |
| 24 | Interest rate | t2 | 3.775% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @305 |  |  |  |
| 25 | Interest rate | t3 | 4.125% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @349 |  |  |  |
| 26 | Interest rate | t4 | 4.4% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @393 |  |  |  |
| 27 | Interest rate | t5 | 4.75% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @437 |  |  |  |
| 28 | Interest rate | t6 | 5.55% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @481 |  |  |  |
| 29 | Interest rate | t7 | 5.65% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @523 |  |  |  |
| 30 | Matures | t1 | 2028-03-03 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14846 |  |  |  |
| 31 | Matures | t2 | 2028-03-03 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14846 |  |  |  |
| 32 | Matures | t3 | 2031-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14923 |  |  |  |
| 33 | Matures | t4 | 2033-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14958 |  |  |  |
| 34 | Matures | t5 | 2036-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @14993 |  |  |  |
| 35 | Matures | t6 | 2056-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @15028 |  |  |  |
| 36 | Matures | t7 | 2066-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · summary — SUMMARY, page S-3 · @15063 |  |  |  |
| 37 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3574 |  |  |  |
| 38 | Price to investors | t2 | 99.966% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3615 |  |  |  |
| 39 | Price to investors | t3 | 99.972% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3655 |  |  |  |
| 40 | Price to investors | t4 | 99.861% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3695 |  |  |  |
| 41 | Price to investors | t5 | 99.911% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3735 |  |  |  |
| 42 | Price to investors | t6 | 99.736% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3775 |  |  |  |
| 43 | Price to investors | t7 | 99.714% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3815 |  |  |  |
| 44 | Interest paid | t1 | 03-03, 06-03, 09-03, 12-03 · first 2026-06-03 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @552 |  |  |  |
| 45 | Interest paid | t2 | 03-03, 09-03 · first 2026-09-03 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @684 |  |  |  |
| 46 | How interest is counted | t1 | Actual/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @56009 |  |  |  |
| 47 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 48 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 49 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 50 | How interest is counted | t5 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 51 | How interest is counted | t6 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 52 | How interest is counted | t7 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · description of the notes — DESCRIPTION OF NOTES, page S-16 · @55891 |  |  |  |
| 53 | Priced on | all | 2026-02-24 | [term sheet](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020557/tm266774d5_fwp.htm) · term sheet — Trade Date · @1322 |  |  |  |
| 54 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @4527 |  |  |  |
| 55 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 56 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 57 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 58 | Ranking | t4 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 59 | Ranking | t5 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 60 | Ranking | t6 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 61 | Ranking | t7 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 62 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 63 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 64 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 65 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 66 | Secured or unsecured | t5 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 67 | Secured or unsecured | t6 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 68 | Secured or unsecured | t7 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2112 |  |  |  |
| 69 | Early repayment by the issuer | t1 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · optional redemption — Optional Redemption, page S-3 · @15098 |  |  |  |
| 70 | Early repayment by the issuer | t2 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · optional redemption — Optional Redemption, page S-3 · @15098 |  |  |  |
| 71 | Early repayment by the issuer | t3 | Yes · from 2031-02-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · optional redemption — Optional Redemption, page S-21 · @78625 |  |  |  |
| 72 | Early repayment by the issuer | t4 | Yes · from 2033-01-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · optional redemption — Optional Redemption, page S-21 · @78752 |  |  |  |
| 73 | Early repayment by the issuer | t5 | Yes · from 2035-12-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · optional redemption — Optional Redemption, page S-21 · @78879 |  |  |  |
| 74 | Early repayment by the issuer | t6 | Yes · from 2055-09-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · optional redemption — Optional Redemption, page S-21 · @79009 |  |  |  |
| 75 | Early repayment by the issuer | t7 | Yes · from 2065-09-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sDON) · optional redemption — Optional Redemption, page S-22 · @79165 |  |  |  |
| 76 | Bank fee | t1 | 0.15% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3584 |  |  |  |
| 77 | Bank fee | t2 | 0.15% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3624 |  |  |  |
| 78 | Bank fee | t3 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3664 |  |  |  |
| 79 | Bank fee | t4 | 0.375% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3704 |  |  |  |
| 80 | Bank fee | t5 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3744 |  |  |  |
| 81 | Bank fee | t6 | 0.75% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3784 |  |  |  |
| 82 | Bank fee | t7 | 0.75% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3824 |  |  |  |
| 83 | Proceeds to the issuer before expenses (%) | t1 | 99.85% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3592 |  |  |  |
| 84 | Proceeds to the issuer before expenses (%) | t2 | 99.816% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3632 |  |  |  |
| 85 | Proceeds to the issuer before expenses (%) | t3 | 99.622% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3672 |  |  |  |
| 86 | Proceeds to the issuer before expenses (%) | t4 | 99.486% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3712 |  |  |  |
| 87 | Proceeds to the issuer before expenses (%) | t5 | 99.461% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3752 |  |  |  |
| 88 | Proceeds to the issuer before expenses (%) | t6 | 98.986% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3792 |  |  |  |
| 89 | Proceeds to the issuer before expenses (%) | t7 | 98.964% | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover table — Cover page, page cover · @3832 |  |  |  |
| 90 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sRIFA) · risk factors — Risk Factors, page S-6 · @20008 |  |  |  |
| 91 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sUCOI) · underwriting — Selling Restrictions, page S-43 · @171201 |  |  |  |
| 92 | Bank conflicts of interest | all | Conflicts of Interest | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sUCOI) · underwriting — CONFLICTS OF INTEREST, page S-41 · @158757 |  |  |  |
| 93 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @2453 |  |  |  |
| 94 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm#sSUM) · description of the notes — SUMMARY, page S-4 · @17906 |  |  |  |
| 95 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover |  |  |  |
| 96 | Banks / roles: bookrunner | all | 20 named | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @4570 |  |  |  |
| 97 | Banks / roles: co_manager | all | 51 named | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover — Cover page, page cover · @5071 |  |  |  |
| 98 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover |  |  |  |
| 99 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | J.P. Morgan | bookrunner | Joint Book-Running Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P2 | BofA Securities | bookrunner | Joint Book-Running Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P3 | Morgan Stanley | bookrunner | Joint Book-Running Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P4 | Wells Fargo Securities | bookrunner | Joint Book-Running Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P5 | Barclays | bookrunner | Joint Book-Running Managers (2036 Notes and 2066 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P6 | Barclays | bookrunner | Joint Book-Running Managers (2036 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P7 | BNP PARIBAS | bookrunner | Joint Book-Running Managers (2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P8 | BNP PARIBAS | bookrunner | Joint Book-Running Managers (2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P9 | Citigroup | bookrunner | Joint Book-Running Managers (Floating Rate Notes and 2028 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P10 | Citigroup | bookrunner | Joint Book-Running Managers (Floating Rate Notes and 2028 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P11 | Deutsche Bank Securities | bookrunner | Joint Book-Running Managers (2031 Notes and 2033 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P12 | Deutsche Bank Securities | bookrunner | Joint Book-Running Managers (2031 Notes and 2033 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P13 | Goldman Sachs & CO. LLC | bookrunner | Joint Book-Running Managers (Floating Rate Notes and 2028 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P14 | Goldman Sachs & CO. LLC | bookrunner | Joint Book-Running Managers (Floating Rate Notes and 2028 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P15 | HSBC | bookrunner | Joint Book-Running Managers (2031 Notes and 2033 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P16 | HSBC | bookrunner | Joint Book-Running Managers (2031 Notes and 2033 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P17 | Mizuho | bookrunner | Joint Book-Running Managers (2033 Notes and 2036 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P18 | Mizuho | bookrunner | Joint Book-Running Managers (2033 Notes and 2036 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P19 | SOCIETE GENERALE | bookrunner | Joint Book-Running Managers (2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P20 | SOCIETE GENERALE | bookrunner | Joint Book-Running Managers (2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P21 | Barclays | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2056 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P22 | Barclays | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2056 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P23 | Barclays | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2056 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P24 | Barclays | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2056 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P25 | Barclays | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2056 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P26 | BNP PARIBAS | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P27 | BNP PARIBAS | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P28 | BNP PARIBAS | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P29 | BNP PARIBAS | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P30 | BNP PARIBAS | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P31 | Citigroup | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P32 | Citigroup | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P33 | Citigroup | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P34 | Citigroup | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P35 | Citigroup | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P36 | Deutsche Bank Securities | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P37 | Deutsche Bank Securities | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P38 | Deutsche Bank Securities | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P39 | Deutsche Bank Securities | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P40 | Deutsche Bank Securities | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P41 | Goldman Sachs & CO. LLC | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P42 | Goldman Sachs & CO. LLC | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P43 | Goldman Sachs & CO. LLC | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P44 | Goldman Sachs & CO. LLC | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P45 | Goldman Sachs & CO. LLC | co_manager | Co-Managers (2031 Notes, 2033 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P46 | HSBC | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P47 | HSBC | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P48 | HSBC | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P49 | HSBC | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P50 | HSBC | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2036 Notes, 2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P51 | Mizuho | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2056 Notes and 2066 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P52 | Mizuho | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2056 Notes and 2066 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P53 | Mizuho | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2056 Notes and 2066 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P54 | Mizuho | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2056 Notes and 2066 Notes) | t6 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P55 | Mizuho | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2056 Notes and 2066 Notes) | t7 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P56 | SOCIETE GENERALE | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t1 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P57 | SOCIETE GENERALE | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t2 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P58 | SOCIETE GENERALE | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t3 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P59 | SOCIETE GENERALE | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t4 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P60 | SOCIETE GENERALE | co_manager | Co-Managers (Floating Rate Notes, 2028 Notes, 2031 Notes, 2033 Notes and 2036 Notes) | t5 | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P61 | Lloyds Securities | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P62 | MUFG | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P63 | Santander | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P64 | TD Securities | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P65 | US Bancorp | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P66 | Siebert Williams Shank | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P67 | Blaylock Van, LLC | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P68 | Drexel Hamilton | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P69 | Mischler Financial Group, Inc. | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P70 | Roberts & Ryan | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P71 | Ramirez & Co., Inc. | co_manager | Co-Managers (All Notes) | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · cover, page cover |  |  |  |
| P72 | U.S. Bank Trust Company, National Association | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/1551152/000110465926020619/tm266774-2_424b5.htm) · description of the notes, page S-4 |  |  |  |

Notes from the extractor: bank lists: 1 text run(s) not read as names

## 4. Duke Energy Corp — 0001104659-24-000673 (424B5, filed 2024-01-03, family A)

Filing: https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm · term sheets: 0001104659-24-000381

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.850% Senior Notes due 2027 | 2027-01-05 | USD 550,000,000 |
| t2 | 4.850% Senior Notes due 2029 | 2029-01-05 | USD 550,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @3576 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 26441CCB9; ISIN US26441CCB90 | [term sheet](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000381/tm2333823d2_fwp.htm) · term sheet — CUSIP / ISIN · @3649 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 26441CCC7; ISIN US26441CCC73 | [term sheet](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000381/tm2333823d2_fwp.htm) · term sheet — CUSIP / ISIN · @3687 |  |  |  |
| 4 | Amount | t1 | 550,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @232 |  |  |  |
| 5 | Amount | t2 | 550,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @232 |  |  |  |
| 6 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @232 |  |  |  |
| 7 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @232 |  |  |  |
| 8 | Interest rate | t1 | 4.85% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @244 |  |  |  |
| 9 | Interest rate | t2 | 4.85% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @244 |  |  |  |
| 10 | Matures | t1 | 2027-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @1008 |  |  |  |
| 11 | Matures | t2 | 2029-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @1074 |  |  |  |
| 12 | Price to investors | t1 | 99.989% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2274 |  |  |  |
| 13 | Price to investors | t2 | 99.881% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2371 |  |  |  |
| 14 | Interest paid | t1 | semi-annual · 01-05, 07-05 · first 2024-07-05 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @813 |  |  |  |
| 15 | Interest paid | t2 | semi-annual · 01-05, 07-05 · first 2024-07-05 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @813 |  |  |  |
| 16 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sDOTN) · description of the notes — Description of the Notes, page S-13 · @42155 |  |  |  |
| 17 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sDOTN) · description of the notes — Description of the Notes, page S-13 · @42155 |  |  |  |
| 18 | Priced on | all | 2024-01-02 | [term sheet](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000381/tm2333823d2_fwp.htm) · term sheet — Trade Date · @406 |  |  |  |
| 19 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @3286 |  |  |  |
| 20 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @251 |  |  |  |
| 21 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @251 |  |  |  |
| 22 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @1383 |  |  |  |
| 23 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @1383 |  |  |  |
| 24 | Early repayment by the issuer | t1 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sPSS) · optional redemption — Optional Redemption, page S-4 · @20979 |  |  |  |
| 25 | Early repayment by the issuer | t2 | Yes · from 2028-12-05 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sPSS) · optional redemption — Optional Redemption, page S-5 · @21806 |  |  |  |
| 26 | Bank fee | t1 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2283 |  |  |  |
| 27 | Bank fee | t2 | 0.6% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2380 |  |  |  |
| 28 | Proceeds to the issuer before expenses (%) | t1 | 99.639% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2291 |  |  |  |
| 29 | Proceeds to the issuer before expenses (%) | t2 | 99.281% | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover table — Cover page, page cover · @2388 |  |  |  |
| 30 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sRIFA) · risk factors — Risk Factors, page S-7 · @26038 |  |  |  |
| 31 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sATPS) · underwriting — Notice to Prospective Investors in the European Economic Area, page S-2 · @6704 |  |  |  |
| 32 | Bank conflicts of interest | all | Conflicts of Interest | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sUCOI) · underwriting — CONFLICTS OF INTEREST, page S-23 · @76015 |  |  |  |
| 33 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @1728 |  |  |  |
| 34 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm#sDOTN) · description of the notes — Description of the Notes, page S-12 · @37050 |  |  |  |
| 35 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover |  |  |  |
| 36 | Banks / roles: bookrunner | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @3331 |  |  |  |
| 37 | Banks / roles: co_manager | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover — Cover page, page cover · @3416 |  |  |  |
| 38 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover |  |  |  |
| 39 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Citigroup | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P2 | Morgan Stanley | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P3 | TD Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P4 | US Bancorp | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P5 | Wells Fargo Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P6 | KeyBanc Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P7 | Regions Securities LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P8 | Siebert Williams Shank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P9 | Cabrera Capital Markets LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P10 | Ramirez & Co., Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · cover, page cover |  |  |  |
| P11 | The Bank of New York Mellon Trust Company, N.A. | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/1326160/000110465924000673/tm2333823-3_424b5.htm) · description of the notes, page S-12 |  |  |  |

Notes from the extractor: bank lists: 1 text run(s) not read as names

## 5. AT&T — 0001193125-25-064173 (424B2, filed 2025-03-26, family A)

Filing: https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 3.150% Global Notes due 2030 | 2030-06-01 | EUR 1,000,000,000 |
| t2 | 3.600% Global Notes due 2033 | 2033-06-01 | EUR 1,000,000,000 |
| t3 | 4.050% Global Notes due 2037 | 2037-06-01 | EUR 750,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-03-24 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @121 |  |  |  |
| 2 | CUSIP / ISIN | t1 | ISIN XS3037678607 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · summary — SUMMARY OF THE NOTES OFFERING, page S-2 · @15678 |  |  |  |
| 3 | CUSIP / ISIN | t2 | ISIN XS3037678789 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · summary — SUMMARY OF THE NOTES OFFERING, page S-2 · @15703 |  |  |  |
| 4 | CUSIP / ISIN | t3 | ISIN XS3037678862 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · summary — SUMMARY OF THE NOTES OFFERING, page S-2 · @15728 |  |  |  |
| 5 | Amount | t1 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @202 |  |  |  |
| 6 | Amount | t2 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @246 |  |  |  |
| 7 | Amount | t3 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @290 |  |  |  |
| 8 | Currency | t1 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @202 |  |  |  |
| 9 | Currency | t2 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @246 |  |  |  |
| 10 | Currency | t3 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @290 |  |  |  |
| 11 | Interest rate | t1 | 3.15% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @216 |  |  |  |
| 12 | Interest rate | t2 | 3.6% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @260 |  |  |  |
| 13 | Interest rate | t3 | 4.05% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @302 |  |  |  |
| 14 | Matures | t1 | 2030-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @767 |  |  |  |
| 15 | Matures | t2 | 2033-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @811 |  |  |  |
| 16 | Matures | t3 | 2037-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @858 |  |  |  |
| 17 | Price to investors | t1 | 99.885% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2185 |  |  |  |
| 18 | Price to investors | t2 | 99.835% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2208 |  |  |  |
| 19 | Price to investors | t3 | 99.888% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2231 |  |  |  |
| 20 | Interest paid | t1 | annual · 06-01 · first 2025-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @25759 |  |  |  |
| 21 | Interest paid | t2 | annual · 06-01 · first 2025-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @25759 |  |  |  |
| 22 | Interest paid | t3 | annual · 06-01 · first 2025-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @25759 |  |  |  |
| 23 | How interest is counted | t1 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-7 · @26719 |  |  |  |
| 24 | How interest is counted | t2 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-7 · @26719 |  |  |  |
| 25 | How interest is counted | t3 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-7 · @26719 |  |  |  |
| 26 | Priced on | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover |  |  |  |
| 27 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @2894 |  |  |  |
| 28 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 29 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 30 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 31 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 32 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 33 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @22128 |  |  |  |
| 34 | Early repayment by the issuer | t1 | Yes · from 2030-05-01 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · optional redemption — Optional Redemption, page S-2 · @15351 |  |  |  |
| 35 | Early repayment by the issuer | t2 | Yes · from 2033-03-01 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · optional redemption — Optional Redemption, page S-2 · @15381 |  |  |  |
| 36 | Early repayment by the issuer | t3 | Yes · from 2037-03-01 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_1) · optional redemption — Optional Redemption, page S-2 · @15413 |  |  |  |
| 37 | Bank fee | t1 | 0.225% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2276 |  |  |  |
| 38 | Bank fee | t2 | 0.3% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2296 |  |  |  |
| 39 | Bank fee | t3 | 0.375% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2316 |  |  |  |
| 40 | Proceeds to the issuer before expenses (%) | t1 | 99.66% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2374 |  |  |  |
| 41 | Proceeds to the issuer before expenses (%) | t2 | 99.535% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2397 |  |  |  |
| 42 | Proceeds to the issuer before expenses (%) | t3 | 99.513% | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2420 |  |  |  |
| 43 | Proceeds to the issuer (amount, this tranche) | t1 | EUR 996,600,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2385 |  |  |  |
| 44 | Proceeds to the issuer (amount, this tranche) | t2 | EUR 995,350,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2408 |  |  |  |
| 45 | Proceeds to the issuer (amount, this tranche) | t3 | EUR 746,347,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover table — Cover page, page cover · @2431 |  |  |  |
| 46 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · risk factors |  |  |  |
| 47 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · underwriting — Prohibition of sales to EEA, page S-ii · @6983 |  |  |  |
| 48 | Listing | all | New York Stock Exchange | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @1381 |  |  |  |
| 49 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm#supptx887859_5) · description of the notes — DESCRIPTION OF THE NOTES, page S-6 · @21945 |  |  |  |
| 50 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover |  |  |  |
| 51 | Banks / roles: bookrunner | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover — Cover page, page cover · @2938 |  |  |  |
| 52 | Banks / roles: co_manager | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover |  |  |  |
| 53 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover |  |  |  |
| 54 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Barclays | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover, page cover |  |  |  |
| P2 | BBVA | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover, page cover |  |  |  |
| P3 | Commerzbank | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover, page cover |  |  |  |
| P4 | IMI – Intesa Sanpaolo | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover, page cover |  |  |  |
| P5 | Société Générale Corporate & Investment Banking | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · cover, page cover |  |  |  |
| P6 | The Bank of New York Mellon Trust Company, N.A. | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/732717/000119312525064173/d887859d424b2.htm) · description of the notes, page S-6 |  |  |  |

## 6. Pfizer — 0001193125-25-120844 (424B5, filed 2025-05-15, family A)

Filing: https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm · term sheets: 0001193125-25-119917

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 2.875% NOTES DUE 2029 | 2029-05-19 | EUR 750,000,000 |
| t2 | 3.250% NOTES DUE 2032 | 2032-05-19 | EUR 1,000,000,000 |
| t3 | 3.875% NOTES DUE 2037 | 2037-05-19 | EUR 750,000,000 |
| t4 | 4.250% NOTES DUE 2045 | 2045-05-19 | EUR 800,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-05-14 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @4498 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 71708LAA7; ISIN XS3019313363 | [term sheet](https://www.sec.gov/Archives/edgar/data/78003/000119312525119917/d945917dfwp.htm) · term sheet — CUSIP / ISIN · @6926 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 71708LAB5; ISIN XS3019320657 | [term sheet](https://www.sec.gov/Archives/edgar/data/78003/000119312525119917/d945917dfwp.htm) · term sheet — CUSIP / ISIN · @6972 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 71708LAC3; ISIN XS3019321200 | [term sheet](https://www.sec.gov/Archives/edgar/data/78003/000119312525119917/d945917dfwp.htm) · term sheet — CUSIP / ISIN · @7018 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 71708LAD1; ISIN XS3019321549 | [term sheet](https://www.sec.gov/Archives/edgar/data/78003/000119312525119917/d945917dfwp.htm) · term sheet — CUSIP / ISIN · @7064 |  |  |  |
| 6 | Amount | t1 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @492 |  |  |  |
| 7 | Amount | t2 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @527 |  |  |  |
| 8 | Amount | t3 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @564 |  |  |  |
| 9 | Amount | t4 | 800,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @599 |  |  |  |
| 10 | Currency | t1 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @492 |  |  |  |
| 11 | Currency | t2 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @527 |  |  |  |
| 12 | Currency | t3 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @564 |  |  |  |
| 13 | Currency | t4 | EUR | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @599 |  |  |  |
| 14 | Interest rate | t1 | 2.875% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @504 |  |  |  |
| 15 | Interest rate | t2 | 3.25% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @541 |  |  |  |
| 16 | Interest rate | t3 | 3.875% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @576 |  |  |  |
| 17 | Interest rate | t4 | 4.25% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @611 |  |  |  |
| 18 | Matures | t1 | 2029-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @682 |  |  |  |
| 19 | Matures | t2 | 2032-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @745 |  |  |  |
| 20 | Matures | t3 | 2037-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @808 |  |  |  |
| 21 | Matures | t4 | 2045-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @874 |  |  |  |
| 22 | Price to investors | t1 | 99.903% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2694 |  |  |  |
| 23 | Price to investors | t2 | 99.263% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2791 |  |  |  |
| 24 | Price to investors | t3 | 99.858% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2888 |  |  |  |
| 25 | Price to investors | t4 | 99.47% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2985 |  |  |  |
| 26 | Interest paid | t1 | annual · 05-19 · first 2026-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @1526 |  |  |  |
| 27 | Interest paid | t2 | annual · 05-19 · first 2026-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @1526 |  |  |  |
| 28 | Interest paid | t3 | annual · 05-19 · first 2026-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @1526 |  |  |  |
| 29 | Interest paid | t4 | annual · 05-19 · first 2026-05-19 | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @1526 |  |  |  |
| 30 | How interest is counted | t1 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · description of the notes — DESCRIPTION OF NOTES, page S-13 · @69140 |  |  |  |
| 31 | How interest is counted | t2 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · description of the notes — DESCRIPTION OF NOTES, page S-13 · @69140 |  |  |  |
| 32 | How interest is counted | t3 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · description of the notes — DESCRIPTION OF NOTES, page S-13 · @69140 |  |  |  |
| 33 | How interest is counted | t4 | Actual/Actual | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · description of the notes — DESCRIPTION OF NOTES, page S-13 · @69140 |  |  |  |
| 34 | Priced on | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover |  |  |  |
| 35 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @4270 |  |  |  |
| 36 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_4) · summary — THE OFFERING, page S-4 · @40337 |  |  |  |
| 37 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_4) · summary — THE OFFERING, page S-4 · @40337 |  |  |  |
| 38 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_4) · summary — THE OFFERING, page S-4 · @40337 |  |  |  |
| 39 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_4) · summary — THE OFFERING, page S-4 · @40337 |  |  |  |
| 40 | Early repayment by the issuer | t1 | Yes · from 2029-04-19 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · optional redemption — DESCRIPTION OF NOTES, page S-17 · @83106 |  |  |  |
| 41 | Early repayment by the issuer | t2 | Yes · from 2032-02-19 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · optional redemption — DESCRIPTION OF NOTES, page S-17 · @83315 |  |  |  |
| 42 | Early repayment by the issuer | t3 | Yes · from 2037-02-19 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · optional redemption — DESCRIPTION OF NOTES, page S-17 · @83530 |  |  |  |
| 43 | Early repayment by the issuer | t4 | Yes · from 2044-11-19 · make-whole, then par · tax redemption | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · optional redemption — DESCRIPTION OF NOTES, page S-17 · @83749 |  |  |  |
| 44 | Bank fee | t1 | 0.3% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2703 |  |  |  |
| 45 | Bank fee | t2 | 0.4% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2800 |  |  |  |
| 46 | Bank fee | t3 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2897 |  |  |  |
| 47 | Bank fee | t4 | 0.625% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2994 |  |  |  |
| 48 | Proceeds to the issuer before expenses (%) | t1 | 99.603% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2711 |  |  |  |
| 49 | Proceeds to the issuer before expenses (%) | t2 | 98.863% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2808 |  |  |  |
| 50 | Proceeds to the issuer before expenses (%) | t3 | 99.408% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2905 |  |  |  |
| 51 | Proceeds to the issuer before expenses (%) | t4 | 98.845% | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @3002 |  |  |  |
| 52 | Proceeds to the issuer (amount, this tranche) | t1 | EUR 747,022,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2765 |  |  |  |
| 53 | Proceeds to the issuer (amount, this tranche) | t2 | EUR 988,630,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2862 |  |  |  |
| 54 | Proceeds to the issuer (amount, this tranche) | t3 | EUR 745,560,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @2959 |  |  |  |
| 55 | Proceeds to the issuer (amount, this tranche) | t4 | EUR 790,760,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover table — Cover page, page cover · @3056 |  |  |  |
| 56 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_5) · risk factors — Risk Factors, page S-7 · @44342 |  |  |  |
| 57 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · underwriting — Prohibition of Sales to EEA, page S-ii · @10562 |  |  |  |
| 58 | Listing | all | New York Stock Exchange | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @3246 |  |  |  |
| 59 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm#supptx910320_8) · description of the notes — DESCRIPTION OF NOTES, page S-13 · @65008 |  |  |  |
| 60 | Banks / roles: guarantor | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @479 |  |  |  |
| 61 | Banks / roles: bookrunner | all | 8 named | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @4312 |  |  |  |
| 62 | Banks / roles: co_manager | all | 4 named | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover — Cover page, page cover · @4430 |  |  |  |
| 63 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover |  |  |  |
| 64 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Goldman Sachs & Co. LLC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P2 | Barclays | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P3 | BNP PARIBAS | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P4 | Deutsche Bank | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P5 | HSBC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P6 | Mizuho | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P7 | Morgan Stanley | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P8 | RBC Capital Markets | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P9 | Academy Securities | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P10 | Ramirez & Co., Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P11 | Siebert Williams Shank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P12 | Stern | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |
| P13 | The Bank of New York Mellon | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · description of the notes, page S-13 |  |  |  |
| P14 | Pfizer Inc. | guarantor | Guaranteed by | all | [filing](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) · cover, page cover |  |  |  |

## 7. Toyota Motor Credit Corp — 0000950103-24-000197 (424B2, filed 2024-01-03, family A)

Filing: https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm · term sheets: 0000950103-24-000086, 0000950103-24-000084, 0000950103-24-000083, 0000950103-24-000082

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | Floating Rate Medium-Term Notes, Series B due January 5, 2026 | 2026-01-05 | USD 500,000,000 |
| t2 | 4.800% Medium-Term Notes, Series B due January 5, 2026 | 2026-01-05 | USD 900,000,000 |
| t3 | 4.650% Medium-Term Notes, Series B due January 5, 2029 | 2029-01-05 | USD 800,000,000 |
| t4 | 4.800% Medium-Term Notes, Series B due January 5, 2034 | 2034-01-05 | USD 800,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @4108 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 89236TLK9; ISIN US89236TLK96 | [term sheet](https://www.sec.gov/Archives/edgar/data/834071/000095010324000083/dp204702_fwp-mtn1288.htm) · term sheet — CUSIP / ISIN · @461 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 89236TLJ2; ISIN US89236TLJ24 | [term sheet](https://www.sec.gov/Archives/edgar/data/834071/000095010324000082/dp204700_fwp-mtn1287.htm) · term sheet — CUSIP / ISIN · @451 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 89236TLL7; ISIN US89236TLL79 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes, page PS-3 · @9773 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 89236TLM5; ISIN US89236TLM52 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes, page PS-3 · @10320 |  |  |  |
| 6 | Amount | t1 | 500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @297 |  |  |  |
| 7 | Amount | t2 | 900,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @372 |  |  |  |
| 8 | Amount | t3 | 800,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @440 |  |  |  |
| 9 | Amount | t4 | 800,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @508 |  |  |  |
| 10 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @297 |  |  |  |
| 11 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @372 |  |  |  |
| 12 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @440 |  |  |  |
| 13 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @508 |  |  |  |
| 14 | Interest rate | t1 | SOFR + 65 bps | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes, page PS-2 · @8365 |  |  |  |
| 15 | Interest rate | t2 | 4.8% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @384 |  |  |  |
| 16 | Interest rate | t3 | 4.65% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @452 |  |  |  |
| 17 | Interest rate | t4 | 4.8% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @384 |  |  |  |
| 18 | Matures | t1 | 2026-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @355 |  |  |  |
| 19 | Matures | t2 | 2026-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @355 |  |  |  |
| 20 | Matures | t3 | 2029-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @491 |  |  |  |
| 21 | Matures | t4 | 2034-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @559 |  |  |  |
| 22 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2835 |  |  |  |
| 23 | Price to investors | t2 | 99.923% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2857 |  |  |  |
| 24 | Price to investors | t3 | 99.863% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2878 |  |  |  |
| 25 | Price to investors | t4 | 99.89% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2899 |  |  |  |
| 26 | Interest paid | t1 | 01-05, 04-05, 07-05, 10-05 · first 2024-04-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1400 |  |  |  |
| 27 | Interest paid | t2 | 01-05, 07-05 · first 2024-07-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1531 |  |  |  |
| 28 | Interest paid | t3 | 01-05, 07-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1644 |  |  |  |
| 29 | Interest paid | t4 | 01-05, 07-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1757 |  |  |  |
| 30 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes — Day Count Convention, page PS-2 · @9128 |  |  |  |
| 31 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes — Day Count Convention, page PS-3 · @9681 |  |  |  |
| 32 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes — Day Count Convention, page PS-3 · @10228 |  |  |  |
| 33 | Priced on | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes — Trade Date, page PS-2 · @7370 |  |  |  |
| 34 | Issue date | all | 2024-01-05 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · description of the notes — Original Issue Date, page PS-2 · @7407 |  |  |  |
| 35 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1266 |  |  |  |
| 36 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1266 |  |  |  |
| 37 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1266 |  |  |  |
| 38 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @1266 |  |  |  |
| 39 | Early repayment by the issuer | t1 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · optional redemption — Optional Redemption, page PS-3 · @10345 |  |  |  |
| 40 | Early repayment by the issuer | t2 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · optional redemption — Optional Redemption, page PS-3 · @10345 |  |  |  |
| 41 | Early repayment by the issuer | t3 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · optional redemption — Optional Redemption, page PS-3 · @10345 |  |  |  |
| 42 | Early repayment by the issuer | t4 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · optional redemption — Optional Redemption, page PS-3 · @10345 |  |  |  |
| 43 | Bank fee | t1 | 0.15% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2950 |  |  |  |
| 44 | Bank fee | t2 | 0.15% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2966 |  |  |  |
| 45 | Bank fee | t3 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @2984 |  |  |  |
| 46 | Bank fee | t4 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3002 |  |  |  |
| 47 | Proceeds to the issuer before expenses (%) | t1 | 99.85% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3064 |  |  |  |
| 48 | Proceeds to the issuer before expenses (%) | t2 | 99.773% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3085 |  |  |  |
| 49 | Proceeds to the issuer before expenses (%) | t3 | 99.513% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3106 |  |  |  |
| 50 | Proceeds to the issuer before expenses (%) | t4 | 99.44% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3127 |  |  |  |
| 51 | Proceeds to the issuer (amount, this tranche) | t1 | USD 499,250,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3073 |  |  |  |
| 52 | Proceeds to the issuer (amount, this tranche) | t2 | USD 897,957,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3094 |  |  |  |
| 53 | Proceeds to the issuer (amount, this tranche) | t3 | USD 796,104,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3115 |  |  |  |
| 54 | Proceeds to the issuer (amount, this tranche) | t4 | USD 795,520,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover table — Cover page, page cover · @3136 |  |  |  |
| 55 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · risk factors |  |  |  |
| 56 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · underwriting — Selling Restrictions, page PS-7 · @27096 |  |  |  |
| 57 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover |  |  |  |
| 58 | Banks / roles: bookrunner | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @3821 |  |  |  |
| 59 | Banks / roles: co_manager | all | 10 named | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover — Cover page, page cover · @3886 |  |  |  |
| 60 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover |  |  |  |
| 61 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Barclays | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P2 | BofA Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P3 | Citigroup | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P4 | Mizuho | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P5 | SMBC Nikko | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P6 | BBVA | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P7 | BNY Mellon Capital Markets, LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P8 | CastleOak Securities, L.P. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P9 | CIBC Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P10 | Drexel Hamilton | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P11 | ICBC Standard Bank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P12 | Loop Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P13 | Nomura | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P14 | Scotiabank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |
| P15 | Standard Chartered Bank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) · cover, page cover |  |  |  |

Notes from the extractor: trustee: 2 trustee institutions named, none stated as the current trustee (D9) → not read · bank lists: 1 text run(s) not read as names

## 8. Oracle — 0001193125-25-217490 (424B2, filed 2025-09-25, family A)

Filing: https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm · term sheets: 0001193125-25-215807

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.450% Notes due 2030 | 2030-09-26 | USD 3,000,000,000 |
| t2 | 4.800% Notes due 2032 | 2032-09-26 | USD 3,000,000,000 |
| t3 | 5.200% Notes due 2035 | 2035-09-26 | USD 4,000,000,000 |
| t4 | 5.875% Notes due 2045 | 2045-09-26 | USD 2,500,000,000 |
| t5 | 5.950% Notes due 2055 | 2055-09-26 | USD 3,500,000,000 |
| t6 | 6.100% Notes due 2065 | 2065-09-26 | USD 2,000,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-09-24 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @4627 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 68389XDH5; ISIN US68389XDH52 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @2125 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 68389XDK8; ISIN US68389XDK81 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @4590 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 68389XDM4; ISIN US68389XDM48 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @7058 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 68389XDP7; ISIN US68389XDP78 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @9525 |  |  |  |
| 6 | CUSIP / ISIN | t5 | CUSIP 68389XDR3; ISIN US68389XDR35 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @11989 |  |  |  |
| 7 | CUSIP / ISIN | t6 | CUSIP 68389XDT9; ISIN US68389XDT90 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — CUSIP / ISIN · @14453 |  |  |  |
| 8 | Amount | t1 | 3,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 9 | Amount | t2 | 3,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @248 |  |  |  |
| 10 | Amount | t3 | 4,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @285 |  |  |  |
| 11 | Amount | t4 | 2,500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @322 |  |  |  |
| 12 | Amount | t5 | 3,500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @359 |  |  |  |
| 13 | Amount | t6 | 2,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @396 |  |  |  |
| 14 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 15 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @248 |  |  |  |
| 16 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @285 |  |  |  |
| 17 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @322 |  |  |  |
| 18 | Currency | t5 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @359 |  |  |  |
| 19 | Currency | t6 | USD | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @396 |  |  |  |
| 20 | Interest rate | t1 | 4.45% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @225 |  |  |  |
| 21 | Interest rate | t2 | 4.8% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @262 |  |  |  |
| 22 | Interest rate | t3 | 5.2% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @299 |  |  |  |
| 23 | Interest rate | t4 | 5.875% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @336 |  |  |  |
| 24 | Interest rate | t5 | 5.95% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @373 |  |  |  |
| 25 | Interest rate | t6 | 6.1% | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @410 |  |  |  |
| 26 | Matures | t1 | 2030-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1640 |  |  |  |
| 27 | Matures | t2 | 2032-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1690 |  |  |  |
| 28 | Matures | t3 | 2035-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1740 |  |  |  |
| 29 | Matures | t4 | 2045-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1790 |  |  |  |
| 30 | Matures | t5 | 2055-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1840 |  |  |  |
| 31 | Matures | t6 | 2065-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1893 |  |  |  |
| 32 | Interest paid | t1 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 33 | Interest paid | t2 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 34 | Interest paid | t3 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 35 | Interest paid | t4 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 36 | Interest paid | t5 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 37 | Interest paid | t6 | semi-annual · 03-26, 09-26 · first 2026-03-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @1500 |  |  |  |
| 38 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 39 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 40 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 41 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 42 | How interest is counted | t5 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 43 | How interest is counted | t6 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @36666 |  |  |  |
| 44 | Priced on | all | 2025-09-24 | [term sheet](https://www.sec.gov/Archives/edgar/data/1341439/000119312525215807/d49252dfwp.htm) · term sheet — Trade Date · @2042 |  |  |  |
| 45 | Issue date | all | 2025-09-26 | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Original Issue Date, page S-2 · @19330 |  |  |  |
| 46 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 47 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 48 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 49 | Ranking | t4 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 50 | Ranking | t5 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 51 | Ranking | t6 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 52 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 53 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 54 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 55 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 56 | Secured or unsecured | t5 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 57 | Secured or unsecured | t6 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_3) · summary — Summary, page S-2 · @19740 |  |  |  |
| 58 | Early repayment by the issuer | t1 | Yes · from 2030-08-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43255 |  |  |  |
| 59 | Early repayment by the issuer | t2 | Yes · from 2032-07-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43361 |  |  |  |
| 60 | Early repayment by the issuer | t3 | Yes · from 2035-06-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43466 |  |  |  |
| 61 | Early repayment by the issuer | t4 | Yes · from 2045-03-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43573 |  |  |  |
| 62 | Early repayment by the issuer | t5 | Yes · from 2055-03-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43679 |  |  |  |
| 63 | Early repayment by the issuer | t6 | Yes · from 2065-03-26 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · optional redemption — Optional Redemption, page S-11 · @43788 |  |  |  |
| 64 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_4) · risk factors — Risk Factors, page S-5 · @23213 |  |  |  |
| 65 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_9) · underwriting — Notice to Prospective Investors in the European Economic Area, page S-23 · @83966 |  |  |  |
| 66 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @3888 |  |  |  |
| 67 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm#suprom37885_7) · description of the notes — Description of the Notes, page S-10 · @37783 |  |  |  |
| 68 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover |  |  |  |
| 69 | Banks / roles: bookrunner | all | 9 named | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @4375 |  |  |  |
| 70 | Banks / roles: co_manager | all | 7 named | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover — Cover page, page cover · @4527 |  |  |  |
| 71 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover |  |  |  |
| 72 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P2 | Citigroup | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P3 | Deutsche Bank Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P4 | Goldman Sachs & Co. LLC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P5 | HSBC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P6 | J.P. Morgan | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P7 | BNP PARIBAS | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P8 | PNC Capital Markets LLC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P9 | SMBC Nikko | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P10 | NatWest | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P11 | Santander | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P12 | TD Securities | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P13 | BNY Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P14 | Credit Agricole CIB | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P15 | ING | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P16 | Standard Chartered Bank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · cover, page cover |  |  |  |
| P17 | Citibank, N.A. | trustee | Successor trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) · description of the notes, page S-10 |  |  |  |

Notes from the extractor: bank lists: 1 text run(s) not read as names

## 9. Lowe's Companies — 0001193125-25-216381 (424B2, filed 2025-09-25, family A)

Filing: https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm · term sheets: 0001193125-25-213573

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 3.950% Notes due October 15, 2027 | 2027-10-15 | USD 650,000,000 |
| t2 | 4.000% Notes due October 15, 2028 | 2028-10-15 | USD 750,000,000 |
| t3 | 4.250% Notes due March 15, 2031 | 2031-03-15 | USD 1,100,000,000 |
| t4 | 4.500% Notes due October 15, 2032 | 2032-10-15 | USD 1,300,000,000 |
| t5 | 4.850% Notes due October 15, 2035 | 2035-10-15 | USD 1,200,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-09-23 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @5036 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 548661ET0; ISIN US548661ET01 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — CUSIP / ISIN · @1482 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 548661EU7; ISIN US548661EU73 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — CUSIP / ISIN · @2259 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 548661EV5; ISIN US548661EV56 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — CUSIP / ISIN · @3030 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 548661EW3; ISIN US548661EW30 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — CUSIP / ISIN · @3810 |  |  |  |
| 6 | CUSIP / ISIN | t5 | CUSIP 548661EX1; ISIN US548661EX13 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — CUSIP / ISIN · @4586 |  |  |  |
| 7 | Amount | t1 | 650,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @190 |  |  |  |
| 8 | Amount | t2 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @237 |  |  |  |
| 9 | Amount | t3 | 1,100,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @284 |  |  |  |
| 10 | Amount | t4 | 1,300,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @331 |  |  |  |
| 11 | Amount | t5 | 1,200,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @380 |  |  |  |
| 12 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @190 |  |  |  |
| 13 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @237 |  |  |  |
| 14 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @284 |  |  |  |
| 15 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @331 |  |  |  |
| 16 | Currency | t5 | USD | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @380 |  |  |  |
| 17 | Interest rate | t1 | 3.95% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @202 |  |  |  |
| 18 | Interest rate | t2 | 4% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @249 |  |  |  |
| 19 | Interest rate | t3 | 4.25% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @298 |  |  |  |
| 20 | Interest rate | t4 | 4.5% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @345 |  |  |  |
| 21 | Interest rate | t5 | 4.85% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @394 |  |  |  |
| 22 | Matures | t1 | 2027-10-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @219 |  |  |  |
| 23 | Matures | t2 | 2028-10-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @266 |  |  |  |
| 24 | Matures | t3 | 2031-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @315 |  |  |  |
| 25 | Matures | t4 | 2032-10-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @362 |  |  |  |
| 26 | Matures | t5 | 2035-10-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @411 |  |  |  |
| 27 | Price to investors | t1 | 99.975% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3500 |  |  |  |
| 28 | Price to investors | t2 | 99.893% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3586 |  |  |  |
| 29 | Price to investors | t3 | 99.828% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3672 |  |  |  |
| 30 | Price to investors | t4 | 99.783% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3762 |  |  |  |
| 31 | Price to investors | t5 | 99.761% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3852 |  |  |  |
| 32 | Interest paid | t1 | semi-annual · 04-15, 10-15 · first 2026-04-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @872 |  |  |  |
| 33 | Interest paid | t2 | semi-annual · 04-15, 10-15 · first 2026-04-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @872 |  |  |  |
| 34 | Interest paid | t3 | semi-annual · 03-15, 09-15 · first 2026-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @1035 |  |  |  |
| 35 | Interest paid | t4 | semi-annual · 04-15, 10-15 · first 2026-04-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @872 |  |  |  |
| 36 | Interest paid | t5 | semi-annual · 04-15, 10-15 · first 2026-04-15 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @872 |  |  |  |
| 37 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @55908 |  |  |  |
| 38 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @55908 |  |  |  |
| 39 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @55908 |  |  |  |
| 40 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @55908 |  |  |  |
| 41 | How interest is counted | t5 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_8) · description of the notes — DESCRIPTION OF NOTES, page S-14 · @55908 |  |  |  |
| 42 | Priced on | all | 2025-09-23 | [term sheet](https://www.sec.gov/Archives/edgar/data/60667/000119312525213573/d44266dfwp.htm) · term sheet — Trade Date · @342 |  |  |  |
| 43 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @4642 |  |  |  |
| 44 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2496 |  |  |  |
| 45 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2496 |  |  |  |
| 46 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2496 |  |  |  |
| 47 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2496 |  |  |  |
| 48 | Secured or unsecured | t5 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2496 |  |  |  |
| 49 | Early repayment by the issuer | t1 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · optional redemption — Optional Redemption, page S-4 · @23771 |  |  |  |
| 50 | Early repayment by the issuer | t2 | Yes · from 2028-09-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · optional redemption — Optional Redemption, page S-4 · @23808 |  |  |  |
| 51 | Early repayment by the issuer | t3 | Yes · from 2031-02-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · optional redemption — Optional Redemption, page S-4 · @23917 |  |  |  |
| 52 | Early repayment by the issuer | t4 | Yes · from 2032-08-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · optional redemption — Optional Redemption, page S-4 · @24030 |  |  |  |
| 53 | Early repayment by the issuer | t5 | Yes · from 2035-07-15 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · optional redemption — Optional Redemption, page S-4 · @24144 |  |  |  |
| 54 | Buy-back if control changes | all | Yes, at 101% of principal | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-5 · @26175 |  |  |  |
| 55 | Mandatory early repayment if a deal fails | t1 | Yes, at 101%, if the deal fails by 2027-08-19 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-4 · @23404 |  |  |  |
| 56 | Mandatory early repayment if a deal fails | t2 | Yes, at 101%, if the deal fails by 2027-08-19 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-4 · @23404 |  |  |  |
| 57 | Mandatory early repayment if a deal fails | t3 | Yes, at 101%, if the deal fails by 2027-08-19 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-4 · @23404 |  |  |  |
| 58 | Mandatory early repayment if a deal fails | t4 | Yes, at 101%, if the deal fails by 2027-08-19 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-4 · @23404 |  |  |  |
| 59 | Mandatory early repayment if a deal fails | t5 | Yes, at 101%, if the deal fails by 2027-08-19 | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · summary — THE OFFERING, page S-4 · @23404 |  |  |  |
| 60 | Bank fee | t1 | 0.225% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3509 |  |  |  |
| 61 | Bank fee | t2 | 0.25% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3595 |  |  |  |
| 62 | Bank fee | t3 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3681 |  |  |  |
| 63 | Bank fee | t4 | 0.4% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3771 |  |  |  |
| 64 | Bank fee | t5 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3861 |  |  |  |
| 65 | Proceeds to the issuer before expenses (%) | t1 | 99.75% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3517 |  |  |  |
| 66 | Proceeds to the issuer before expenses (%) | t2 | 99.643% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3603 |  |  |  |
| 67 | Proceeds to the issuer before expenses (%) | t3 | 99.478% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3689 |  |  |  |
| 68 | Proceeds to the issuer before expenses (%) | t4 | 99.383% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3779 |  |  |  |
| 69 | Proceeds to the issuer before expenses (%) | t5 | 99.311% | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3869 |  |  |  |
| 70 | Proceeds to the issuer (amount, this tranche) | t1 | USD 648,375,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3560 |  |  |  |
| 71 | Proceeds to the issuer (amount, this tranche) | t2 | USD 747,322,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3646 |  |  |  |
| 72 | Proceeds to the issuer (amount, this tranche) | t3 | USD 1,094,258,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3734 |  |  |  |
| 73 | Proceeds to the issuer (amount, this tranche) | t4 | USD 1,291,979,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3824 |  |  |  |
| 74 | Proceeds to the issuer (amount, this tranche) | t5 | USD 1,191,732,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover table — Cover page, page cover · @3914 |  |  |  |
| 75 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_5) · risk factors — Risk Factors, page S-7 · @28956 |  |  |  |
| 76 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_10) · underwriting — Selling Restrictions, page S-30 · @114633 |  |  |  |
| 77 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @2872 |  |  |  |
| 78 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm#supptx54563_4) · description of the notes — THE OFFERING, page S-7 · @28871 |  |  |  |
| 79 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover |  |  |  |
| 80 | Banks / roles: bookrunner | all | 7 named | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @4792 |  |  |  |
| 81 | Banks / roles: co_manager | all | 4 named | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover — Cover page, page cover · @4916 |  |  |  |
| 82 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover |  |  |  |
| 83 | Banks / roles: agent | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P2 | Goldman Sachs & Co. LLC | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P3 | Wells Fargo Securities | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P4 | Barclays | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P5 | Citigroup | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P6 | J.P. Morgan | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P7 | US Bancorp | bookrunner | Joint Book-Running Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P8 | Mizuho | co_manager | Senior Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P9 | Truist Securities | co_manager | Senior Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P10 | Loop Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P11 | BMO Capital Markets | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · cover, page cover |  |  |  |
| P12 | U.S. Bank Trust Company, National Association | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) · description of the notes, page S-7 |  |  |  |

## 10. CVS Health — 0001193125-24-134264 (424B2, filed 2024-05-08, family A)

Filing: https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm · term sheets: 0001193125-24-133245

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 5.400% Senior Notes due 2029 | 2029-06-01 | USD 1,000,000,000 |
| t2 | 5.550% Senior Notes due 2031 | 2031-06-01 | USD 1,000,000,000 |
| t3 | 5.700% Senior Notes due 2034 | 2034-06-01 | USD 1,250,000,000 |
| t4 | 6.000% Senior Notes due 2044 | 2044-06-01 | USD 750,000,000 |
| t5 | 6.050% Senior Notes due 2054 | 2054-06-01 | USD 1,000,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-05-07 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @4337 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 126650EB2 | [term sheet](https://www.sec.gov/Archives/edgar/data/64803/000119312524133245/d826150dfwp.htm) · term sheet — CUSIP / ISIN · @5422 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 126650EC0 | [term sheet](https://www.sec.gov/Archives/edgar/data/64803/000119312524133245/d826150dfwp.htm) · term sheet — CUSIP / ISIN · @5444 |  |  |  |
| 4 | CUSIP / ISIN | t3 | CUSIP 126650ED8 | [term sheet](https://www.sec.gov/Archives/edgar/data/64803/000119312524133245/d826150dfwp.htm) · term sheet — CUSIP / ISIN · @5466 |  |  |  |
| 5 | CUSIP / ISIN | t4 | CUSIP 126650EE6 | [term sheet](https://www.sec.gov/Archives/edgar/data/64803/000119312524133245/d826150dfwp.htm) · term sheet — CUSIP / ISIN · @5488 |  |  |  |
| 6 | CUSIP / ISIN | t5 | CUSIP 126650EF3 | [term sheet](https://www.sec.gov/Archives/edgar/data/64803/000119312524133245/d826150dfwp.htm) · term sheet — CUSIP / ISIN · @5510 |  |  |  |
| 7 | Amount | t1 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @190 |  |  |  |
| 8 | Amount | t2 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @234 |  |  |  |
| 9 | Amount | t3 | 1,250,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @278 |  |  |  |
| 10 | Amount | t4 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @322 |  |  |  |
| 11 | Amount | t5 | 1,000,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @364 |  |  |  |
| 12 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @190 |  |  |  |
| 13 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @234 |  |  |  |
| 14 | Currency | t3 | USD | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @278 |  |  |  |
| 15 | Currency | t4 | USD | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @322 |  |  |  |
| 16 | Currency | t5 | USD | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @364 |  |  |  |
| 17 | Interest rate | t1 | 5.4% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @204 |  |  |  |
| 18 | Interest rate | t2 | 5.55% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @248 |  |  |  |
| 19 | Interest rate | t3 | 5.7% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @292 |  |  |  |
| 20 | Interest rate | t4 | 6% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @334 |  |  |  |
| 21 | Interest rate | t5 | 6.05% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @378 |  |  |  |
| 22 | Matures | t1 | 2029-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1267 |  |  |  |
| 23 | Matures | t2 | 2031-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1363 |  |  |  |
| 24 | Matures | t3 | 2034-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1459 |  |  |  |
| 25 | Matures | t4 | 2044-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1555 |  |  |  |
| 26 | Matures | t5 | 2054-06-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1651 |  |  |  |
| 27 | Price to investors | t1 | 99.903% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3129 |  |  |  |
| 28 | Price to investors | t2 | 99.926% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3205 |  |  |  |
| 29 | Price to investors | t3 | 99.926% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3281 |  |  |  |
| 30 | Price to investors | t4 | 99.395% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3361 |  |  |  |
| 31 | Price to investors | t5 | 99.35% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3437 |  |  |  |
| 32 | Interest paid | t1 | 06-01, 12-01 · first 2024-12-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1079 |  |  |  |
| 33 | Interest paid | t2 | 06-01, 12-01 · first 2024-12-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1079 |  |  |  |
| 34 | Interest paid | t3 | 06-01, 12-01 · first 2024-12-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1079 |  |  |  |
| 35 | Interest paid | t4 | 06-01, 12-01 · first 2024-12-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1079 |  |  |  |
| 36 | Interest paid | t5 | 06-01, 12-01 · first 2024-12-01 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1079 |  |  |  |
| 37 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-9 · @44254 |  |  |  |
| 38 | How interest is counted | t2 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-9 · @44254 |  |  |  |
| 39 | How interest is counted | t3 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-9 · @44254 |  |  |  |
| 40 | How interest is counted | t4 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-9 · @44254 |  |  |  |
| 41 | How interest is counted | t5 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-9 · @44254 |  |  |  |
| 42 | Priced on | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover |  |  |  |
| 43 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @3605 |  |  |  |
| 44 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 45 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 46 | Ranking | t3 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 47 | Ranking | t4 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 48 | Ranking | t5 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @211 |  |  |  |
| 49 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @2273 |  |  |  |
| 50 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @2273 |  |  |  |
| 51 | Secured or unsecured | t3 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @2273 |  |  |  |
| 52 | Secured or unsecured | t4 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @2273 |  |  |  |
| 53 | Secured or unsecured | t5 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @2273 |  |  |  |
| 54 | Early repayment by the issuer | t1 | Yes · from 2029-05-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_4) · optional redemption — Optional Redemption, page S-2 · @28043 |  |  |  |
| 55 | Early repayment by the issuer | t2 | Yes · from 2031-04-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_4) · optional redemption — Optional Redemption, page S-2 · @28146 |  |  |  |
| 56 | Early repayment by the issuer | t3 | Yes · from 2034-03-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_4) · optional redemption — Optional Redemption, page S-3 · @28275 |  |  |  |
| 57 | Early repayment by the issuer | t4 | Yes · from 2043-12-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_4) · optional redemption — Optional Redemption, page S-3 · @28383 |  |  |  |
| 58 | Early repayment by the issuer | t5 | Yes · from 2053-12-01 · make-whole, then par | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_4) · optional redemption — Optional Redemption, page S-3 · @28495 |  |  |  |
| 59 | Buy-back if control changes | all | Yes, at 101% of principal | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover — Cover page, page cover · @1833 |  |  |  |
| 60 | Bank fee | t1 | 0.35% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3152 |  |  |  |
| 61 | Bank fee | t2 | 0.4% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3228 |  |  |  |
| 62 | Bank fee | t3 | 0.45% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3306 |  |  |  |
| 63 | Bank fee | t4 | 0.75% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3384 |  |  |  |
| 64 | Bank fee | t5 | 0.875% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3460 |  |  |  |
| 65 | Proceeds to the issuer before expenses (%) | t1 | 99.553% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3172 |  |  |  |
| 66 | Proceeds to the issuer before expenses (%) | t2 | 99.526% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3248 |  |  |  |
| 67 | Proceeds to the issuer before expenses (%) | t3 | 99.476% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3326 |  |  |  |
| 68 | Proceeds to the issuer before expenses (%) | t4 | 98.645% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3404 |  |  |  |
| 69 | Proceeds to the issuer before expenses (%) | t5 | 98.475% | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3480 |  |  |  |
| 70 | Proceeds to the issuer (amount, this tranche) | t1 | USD 995,530,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3182 |  |  |  |
| 71 | Proceeds to the issuer (amount, this tranche) | t2 | USD 995,260,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3258 |  |  |  |
| 72 | Proceeds to the issuer (amount, this tranche) | t3 | USD 1,243,450,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3336 |  |  |  |
| 73 | Proceeds to the issuer (amount, this tranche) | t4 | USD 739,837,500 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3414 |  |  |  |
| 74 | Proceeds to the issuer (amount, this tranche) | t5 | USD 984,750,000 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover table — Cover page, page cover · @3490 |  |  |  |
| 75 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_5) · risk factors — Risk Factors, page S-4 · @30960 |  |  |  |
| 76 | Where the notes may not be sold | all | (section link and heading only — place list withheld, FIX3) | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_1) · underwriting — Notice to Prospective Investors in the European Economic Area, page S-ii · @6868 |  |  |  |
| 77 | Listing | all | Not listed | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_5) · description of the notes — Risk Factors, page S-4 · @33488 |  |  |  |
| 78 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_8) · description of the notes — DESCRIPTION OF THE NOTES, page S-8 · @38833 |  |  |  |
| 79 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · cover |  |  |  |
| 80 | Banks / roles: underwriter | all | 22 named | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm#supprom826150_9) · underwriting — Underwriting, page S-16 · @71355 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P2 | Barclays Capital Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P3 | Goldman Sachs & Co. LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P4 | J.P. Morgan Securities LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P5 | Wells Fargo Securities, LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P6 | Citigroup Global Markets Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P7 | Mizuho Securities USA LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P8 | RBC Capital Markets, LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P9 | Truist Securities, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P10 | UBS Securities LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P11 | U.S. Bancorp Investments, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P12 | BNY Mellon Capital Markets, LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P13 | Fifth Third Securities, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P14 | Morgan Stanley & Co. LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P15 | PNC Capital Markets LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P16 | SMBC Nikko Securities America, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P17 | ICBC Standard Bank Plc | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P18 | KeyBanc Capital Markets Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P19 | Loop Capital Markets LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P20 | TD Securities (USA) LLC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P21 | American Veterans Group, PBC | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P22 | MFR Securities, Inc. | underwriter | Underwriter | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · underwriting, page S-16 |  |  |  |
| P23 | The Bank of New York Mellon Trust Company, N.A. | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) · description of the notes, page S-8 |  |  |  |

Notes from the extractor: bank lists: 1 text run(s) not read as names

## 11. Toyota Motor Credit Corp — 0000950103-24-000537 (424B2, filed 2024-01-10, family B)

Filing: https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | Medium-Term Notes, Series B – Fixed Rate Callable Notes  | 2029-01-22 | USD 75,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-10 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · cover — Cover page · @71 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 89236TLN3 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — CUSIP · @507 |  |  |  |
| 3 | Amount | t1 | 75,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms · @560 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms · @560 |  |  |  |
| 5 | Interest rate | t1 | 5% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms · @824 |  |  |  |
| 6 | Matures | t1 | 2029-01-22 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms · @792 |  |  |  |
| 7 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Issue Price · @687 |  |  |  |
| 8 | Interest paid | t1 | semi-annual · 01-22, 07-22 · first 2024-07-22 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Interest Payment Dates · @1006 |  |  |  |
| 9 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Day Count Convention · @1624 |  |  |  |
| 10 | Priced on | all | 2024-01-10 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Initial Trade Date · @715 |  |  |  |
| 11 | Issue date | all | 2024-01-22 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Original Issue Date · @753 |  |  |  |
| 12 | Ranking | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | Yes · from 2026-01-22 · par | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Redemption · @1690 |  |  |  |
| 15 | Bank fee | t1 | 0.3% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Agent's Discount or Commission · @1260 |  |  |  |
| 16 | Proceeds to the issuer before expenses (%) | t1 | 99.7% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms — Net Proceeds to Issuer · @1201 |  |  |  |
| 17 | Risks | all | Section link | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · risk factors — Risk Factors · @2757 |  |  |  |
| 18 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 22 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |
| 23 | Banks / roles: agent | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms · @1552 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Barclays Capital Inc. | agent | Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324000537/dp205159_424b2-mtn1291.htm) · pricing terms |  |  |  |

Notes from the extractor: trustee: 2 trustee institutions named, none stated as the current trustee (D9) → not read

## 12. Toyota Motor Credit Corp — 0000950103-24-002543 (424B2, filed 2024-02-21, family B)

Filing: https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | Medium-Term Notes, Series B - Floating Rate  | 2025-02-24 | USD 1,750,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-02-20 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · cover — Cover page · @114 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 89236TLT0 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — CUSIP · @528 |  |  |  |
| 3 | Amount | t1 | 1,750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @581 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @581 |  |  |  |
| 5 | Interest rate | t1 | SOFR + 30 bps | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @2280 |  |  |  |
| 6 | Matures | t1 | 2025-02-24 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @847 |  |  |  |
| 7 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Issue Price · @747 |  |  |  |
| 8 | Interest paid | t1 | 01-24, 02-24, 03-24, 04-24, 05-24, 06-24, 07-24, 08-24, 09-24, 10-24, 11-24, 12-24 · first 2024-03-24 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Interest Payment Dates · @1012 |  |  |  |
| 9 | How interest is counted | t1 | Actual/360 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Day Count Convention · @3189 |  |  |  |
| 10 | Priced on | all | 2024-02-20 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Trade Date · @768 |  |  |  |
| 11 | Issue date | all | 2024-02-23 | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Original Issue Date · @807 |  |  |  |
| 12 | Ranking | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms — Redemption · @3385 |  |  |  |
| 15 | Proceeds to the issuer before expenses (%) | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 16 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 17 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 18 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| 22 | Banks / roles: agent | all | 2 named | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @1289 |  |  |  |
| 23 | Banks / roles: other | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms · @1571 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | RBC Capital Markets, LLC | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| P2 | Toyota Financial Services Securities USA Corporation | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |
| P3 | Deutsche Bank Trust Company Americas | other | Calculation Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/834071/000095010324002543/dp207139_424b2-mtn1296.htm) · pricing terms |  |  |  |

Notes from the extractor: trustee: 2 trustee institutions named, none stated as the current trustee (D9) → not read

## 13. Caterpillar Financial Services — 0001104659-24-105055 (424B3, filed 2024-10-02, family B)

Filing: https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | o PROSPECTUS SUPPLEMENT Dated March 29, 2023 and PROSPECTUS Dated March 29, 2023 CATERPILLAR FINANCIAL SERVICES CORPORATION MEDIUM-TERM NOTES, SERIES K, 4.350% NOTES DUE 2026 | 2026-05-15 | USD 200,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-10-01 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · cover — Cover page · @129 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 14913UAA8 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — CUSIP · @3969 |  |  |  |
| 3 | Amount | t1 | 200,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms · @1319 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms · @1319 |  |  |  |
| 5 | Interest rate | t1 | 4.35% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms · @299 |  |  |  |
| 6 | Matures | t1 | 2026-05-15 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms · @1287 |  |  |  |
| 7 | Price to investors | t1 | 100.65% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Price to Public (Issue Price) · @2008 |  |  |  |
| 8 | Interest paid | t1 | semi-annual · 05-15, 11-15 · first 2024-11-15 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Interest Payment Dates · @3025 |  |  |  |
| 9 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Day Count Convention · @3754 |  |  |  |
| 10 | Priced on | all | 2024-10-01 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Trade Date/Pricing Effective Time · @585 |  |  |  |
| 11 | Issue date | all | 2024-10-04 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Settlement Date (Original Issue Date) · @640 |  |  |  |
| 12 | Ranking | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Redemption · @3519 |  |  |  |
| 15 | Bank fee | t1 | 0.125% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — Dealers' Commission · @2061 |  |  |  |
| 16 | Proceeds to the issuer before expenses (%) | t1 | 100.525% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms — All-in-price · @2217 |  |  |  |
| 17 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 18 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: other | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms · @3934 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Wells Fargo Securities, LLC | other | Billing and Delivery Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924105055/tm2425358d1_424b3.htm) · pricing terms |  |  |  |

## 14. Caterpillar Financial Services — 0001104659-24-000426 (424B3, filed 2024-01-03, family B)

Filing: https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | o PROSPECTUS SUPPLEMENT Dated March 29, 2023 and PROSPECTUS Dated March 29, 2023 CATERPILLAR FINANCIAL SERVICES CORPORATION MEDIUM-TERM NOTES, SERIES K, 4.500% NOTES DUE 2027 | 2027-01-08 | USD 500,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · cover — Cover page · @128 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 14913UAE0 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — CUSIP · @3956 |  |  |  |
| 3 | Amount | t1 | 500,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @1313 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @1313 |  |  |  |
| 5 | Interest rate | t1 | 4.5% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @298 |  |  |  |
| 6 | Matures | t1 | 2027-01-08 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @1277 |  |  |  |
| 7 | Price to investors | t1 | 99.892% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Price to Public (Issue Price) · @1356 |  |  |  |
| 8 | Interest paid | t1 | semi-annual · 01-08, 07-08 · first 2024-07-08 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Interest Payment Dates · @2193 |  |  |  |
| 9 | How interest is counted | t1 | 30/360 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Day Count Convention · @2916 |  |  |  |
| 10 | Priced on | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Trade Date/Pricing Effective Time · @573 |  |  |  |
| 11 | Issue date | all | 2024-01-08 | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Settlement Date (Original Issue Date) · @628 |  |  |  |
| 12 | Ranking | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | Yes · make-whole | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Redemption · @2681 |  |  |  |
| 15 | Bank fee | t1 | 0.225% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — Dealers' Commission · @1385 |  |  |  |
| 16 | Proceeds to the issuer before expenses (%) | t1 | 99.667% | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms — All-in-price · @1426 |  |  |  |
| 17 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 18 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: bookrunner | all | 3 named | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @3042 |  |  |  |
| 22 | Banks / roles: co_manager | all | 21 named | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms · @3159 |  |  |  |
| 23 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Barclays Capital Inc. | bookrunner | Joint Lead Managers & Bookrunners | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P2 | J.P. Morgan Securities LLC | bookrunner | Joint Lead Managers & Bookrunners | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P3 | SG Americas Securities, LLC | bookrunner | Joint Lead Managers & Bookrunners | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P4 | BNP Paribas Securities Corp. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P5 | HSBC Securities (USA) Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P6 | ING Financial Markets LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P7 | Lloyds Securities Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P8 | TD Securities (USA) LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P9 | U.S. Bancorp Investments, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P10 | Commerz Markets LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P11 | Scotia Capital (USA) Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P12 | Academy Securities, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P13 | Standard Chartered Bank | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P14 | Wells Fargo Securities, LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P15 | SMBC Nikko Securities America, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P16 | ANZ Securities, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P17 | ICBC Standard Bank Plc | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P18 | KBC Securities USA LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P19 | Santander US Capital Markets LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P20 | BBVA Securities Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P21 | Mischler Financial Group, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P22 | BNY Mellon Capital Markets, LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P23 | Itau BBA USA Securities, Inc. | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |
| P24 | Westpac Capital Markets LLC | co_manager | Co-Managers | all | [filing](https://www.sec.gov/Archives/edgar/data/764764/000110465924000426/tm2333853d1_424b3.htm) · pricing terms |  |  |  |

## 15. John Deere Capital Corp — 0001104659-24-000827 (424B2, filed 2024-01-03, family B)

Filing: https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.500% Fixed Rate Senior Notes Due January 8, 2027 | 2027-01-08 | USD 750,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-02 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · cover — Cover page · @110 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 24422EXF1; ISIN US24422EXF14 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — CUSIP · @620 |  |  |  |
| 3 | Amount | t1 | 750,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms · @337 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms · @337 |  |  |  |
| 5 | Interest rate | t1 | 4.5% | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms · @349 |  |  |  |
| 6 | Matures | t1 | 2027-01-08 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms · @384 |  |  |  |
| 7 | Price to investors | t1 | 99.889% | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — Price to Public · @755 |  |  |  |
| 8 | Interest paid | t1 | semi-annual · 01-08, 07-08 · first 2024-07-08 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — Interest Payment Dates · @839 |  |  |  |
| 9 | How interest is counted | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 10 | Priced on | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 11 | Issue date | all | 2024-01-08 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — Date of Issue · @660 |  |  |  |
| 12 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · cover — Cover page · @367 |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — Redemption Provisions · @1116 |  |  |  |
| 15 | Bank fee | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 16 | Proceeds to the issuer before expenses (%) | t1 | 99.739% | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms — Plan of Distribution · @1716 |  |  |  |
| 17 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 18 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: underwriter | all | 10 named | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms · @1174 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | BofA Securities, Inc. | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P2 | Deutsche Bank Securities Inc. | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P3 | Goldman Sachs & Co. LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P4 | HSBC Securities (USA) Inc. | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P5 | Academy Securities, Inc. | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P6 | BNP Paribas Securities Corp. | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P7 | Commerz Markets LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P8 | PNC Capital Markets LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P9 | SG Americas Securities, LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |
| P10 | Wells Fargo Securities, LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924000827/tm241566d3_424b2.htm) · pricing terms |  |  |  |

## 16. John Deere Capital Corp — 0001104659-24-005136 (424B2, filed 2024-01-19, family B)

Filing: https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | Floating Rate Senior Notes Due October 22, 2025 | 2025-10-22 | USD 400,000,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-01-18 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · cover — Cover page · @110 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 24422EXJ3; ISIN US24422EXJ36 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — CUSIP · @621 |  |  |  |
| 3 | Amount | t1 | 400,000,000 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms · @338 |  |  |  |
| 4 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms · @338 |  |  |  |
| 5 | Interest rate | t1 | SOFR + 48 bps | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms · @808 |  |  |  |
| 6 | Matures | t1 | 2025-10-22 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms · @381 |  |  |  |
| 7 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Price to Public · @2207 |  |  |  |
| 8 | Interest paid | t1 | quarterly · 01-22, 04-22, 07-22, 10-22 · first 2024-04-22 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Interest Payment Dates · @1263 |  |  |  |
| 9 | How interest is counted | t1 | Actual/360 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Day Count · @1047 |  |  |  |
| 10 | Priced on | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 11 | Issue date | all | 2024-01-23 | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Date of Issue · @661 |  |  |  |
| 12 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · cover — Cover page · @364 |  |  |  |
| 13 | Secured or unsecured | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 14 | Early repayment by the issuer | t1 | No — cannot be repaid early | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Redemption Provisions · @2413 |  |  |  |
| 15 | Bank fee | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 16 | Proceeds to the issuer before expenses (%) | t1 | 99.925% | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms — Plan of Distribution · @2643 |  |  |  |
| 17 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 18 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 19 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 20 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |
| 21 | Banks / roles: underwriter | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms · @2471 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | Goldman Sachs & Co. LLC | underwriter | Plan of Distribution | all | [filing](https://www.sec.gov/Archives/edgar/data/27673/000110465924005136/tm243640d2_424b2.htm) · pricing terms |  |  |  |

## 17. Verizon Communications — 0001193125-24-057532 (424B2, filed 2024-03-04, family C)

Filing: https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.900% Senior Notes due 03/15/2031 | 2031-03-15 | USD 290,000 |
| t2 | 5.300% Senior Notes due 03/15/2054 | 2054-03-15 | USD 128,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-03-04 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · cover — Cover page · @129 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 92346MMR9 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @431 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 92346MMS7 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @668 |  |  |  |
| 4 | Amount | t1 | 290,000 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @442 |  |  |  |
| 5 | Amount | t2 | 128,000 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @679 |  |  |  |
| 6 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @442 |  |  |  |
| 7 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @679 |  |  |  |
| 8 | Interest rate | t1 | 4.9% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @486 |  |  |  |
| 9 | Interest rate | t2 | 5.3% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @723 |  |  |  |
| 10 | Matures | t1 | 2031-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @505 |  |  |  |
| 11 | Matures | t2 | 2054-03-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @742 |  |  |  |
| 12 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Selling Price · @453 |  |  |  |
| 13 | Price to investors | t2 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Selling Price · @690 |  |  |  |
| 14 | Interest paid | t1 | semi-annual · first 2024-09-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Coupon Frequency · @493 |  |  |  |
| 15 | Interest paid | t2 | semi-annual · first 2024-09-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Coupon Frequency · @730 |  |  |  |
| 16 | How interest is counted | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 17 | How interest is counted | t2 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 18 | Priced on | all | 2024-03-04 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Trade Date · @1068 |  |  |  |
| 19 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Product Ranking · @537 |  |  |  |
| 20 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Product Ranking · @774 |  |  |  |
| 21 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Product Ranking · @544 |  |  |  |
| 22 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Product Ranking · @781 |  |  |  |
| 23 | Early repayment by the issuer | t1 | Yes · from 2025-03-15 · par | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Redemption Information · @584 |  |  |  |
| 24 | Early repayment by the issuer | t2 | Yes · from 2025-03-15 · par | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Redemption Information · @821 |  |  |  |
| 25 | Repayment on the holder’s death | t1 | yes | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Survivor's Option · @533 |  |  |  |
| 26 | Repayment on the holder’s death | t2 | yes | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Survivor's Option · @770 |  |  |  |
| 27 | Bank fee | t1 | 1.45% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Gross Concession · @461 |  |  |  |
| 28 | Bank fee | t2 | 3.15% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Gross Concession · @698 |  |  |  |
| 29 | Proceeds to the issuer (amount, this tranche) | t1 | USD 285,795 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Net Proceeds · @469 |  |  |  |
| 30 | Proceeds to the issuer (amount, this tranche) | t2 | USD 123,968 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table — Net Proceeds · @706 |  |  |  |
| 31 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 32 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 33 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 34 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 35 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 36 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 37 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| 38 | Banks / roles: agent | all | 6 named | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table · @1469 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | InspereX | agent | Lead Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| P2 | BofA Securities | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| P3 | Citigroup | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| P4 | Morgan Stanley | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| P5 | RBC Capital Markets | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |
| P6 | Wells Fargo Advisors | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) · retail table |  |  |  |

## 18. Verizon Communications — 0001193125-24-207015 (424B2, filed 2024-08-26, family C)

Filing: https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.400% Senior Notes due 08/15/2029 | 2029-08-15 | USD 1,323,000 |
| t2 | 4.900% Senior Notes due 08/15/2036 | 2036-08-15 | USD 688,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2024-08-26 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · cover — Cover page · @129 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 92346MNT4 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @433 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 92346MNU1 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @674 |  |  |  |
| 4 | Amount | t1 | 1,323,000 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @444 |  |  |  |
| 5 | Amount | t2 | 688,000 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @685 |  |  |  |
| 6 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @444 |  |  |  |
| 7 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @685 |  |  |  |
| 8 | Interest rate | t1 | 4.4% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @492 |  |  |  |
| 9 | Interest rate | t2 | 4.9% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @729 |  |  |  |
| 10 | Matures | t1 | 2029-08-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @511 |  |  |  |
| 11 | Matures | t2 | 2036-08-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @748 |  |  |  |
| 12 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Selling Price · @457 |  |  |  |
| 13 | Price to investors | t2 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Selling Price · @696 |  |  |  |
| 14 | Interest paid | t1 | semi-annual · first 2025-02-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Coupon Frequency · @499 |  |  |  |
| 15 | Interest paid | t2 | semi-annual · first 2025-02-15 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Coupon Frequency · @736 |  |  |  |
| 16 | How interest is counted | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 17 | How interest is counted | t2 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 18 | Priced on | all | 2024-08-26 | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Trade Date · @1074 |  |  |  |
| 19 | Issue date | all | on or about | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @1649 |  |  |  |
| 20 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Product Ranking · @543 |  |  |  |
| 21 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Product Ranking · @780 |  |  |  |
| 22 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Product Ranking · @550 |  |  |  |
| 23 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Product Ranking · @787 |  |  |  |
| 24 | Early repayment by the issuer | t1 | Yes · from 2025-08-15 · par | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Redemption Information · @590 |  |  |  |
| 25 | Early repayment by the issuer | t2 | Yes · from 2026-08-15 · par | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Redemption Information · @827 |  |  |  |
| 26 | Repayment on the holder’s death | t1 | yes | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Survivor's Option · @539 |  |  |  |
| 27 | Repayment on the holder’s death | t2 | yes | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Survivor's Option · @776 |  |  |  |
| 28 | Bank fee | t1 | 1.25% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Gross Concession · @465 |  |  |  |
| 29 | Bank fee | t2 | 2% | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Gross Concession · @704 |  |  |  |
| 30 | Proceeds to the issuer (amount, this tranche) | t1 | USD 1,306,462.5 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Net Proceeds · @473 |  |  |  |
| 31 | Proceeds to the issuer (amount, this tranche) | t2 | USD 674,240 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table — Net Proceeds · @712 |  |  |  |
| 32 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 33 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 34 | Banks / roles: trustee | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 35 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 36 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 37 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 38 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| 39 | Banks / roles: agent | all | 6 named | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table · @1479 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | InspereX | agent | Lead Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| P2 | BofA Securities | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| P3 | Citigroup | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| P4 | Morgan Stanley | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| P5 | RBC Capital Markets | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |
| P6 | Wells Fargo Advisors | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/732712/000119312524207015/d834353d424b2.htm) · retail table |  |  |  |

## 19. General Motors Financial Co. — 0000804269-25-000011 (424B2, filed 2025-02-18, family C)

Filing: https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 5.200% Senior Notes due 2/20/2029 | 2029-02-20 | USD 6,403,000 |
| t2 | 5.700% Senior Notes due 2/20/2033 | 2033-02-20 | USD 4,816,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-02-18 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · cover — Cover page · @162 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 37046AFJ9 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @481 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 37046AFK6 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @1155 |  |  |  |
| 4 | Amount | t1 | 6,403,000 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @518 |  |  |  |
| 5 | Amount | t2 | 4,816,000 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @1192 |  |  |  |
| 6 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @518 |  |  |  |
| 7 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @1192 |  |  |  |
| 8 | Interest rate | t1 | 5.2% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @537 |  |  |  |
| 9 | Interest rate | t2 | 5.7% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @1211 |  |  |  |
| 10 | Matures | t1 | 2029-02-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @556 |  |  |  |
| 11 | Matures | t2 | 2033-02-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @1230 |  |  |  |
| 12 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Selling Price · @491 |  |  |  |
| 13 | Price to investors | t2 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Selling Price · @1165 |  |  |  |
| 14 | Interest paid | t1 | semi-annual · first 2025-08-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Coupon Frequency · @544 |  |  |  |
| 15 | Interest paid | t2 | semi-annual · first 2025-08-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Coupon Frequency · @1218 |  |  |  |
| 16 | How interest is counted | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 17 | How interest is counted | t2 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 18 | Priced on | all | 2025-02-18 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Trade Date · @1966 |  |  |  |
| 19 | Issue date | all | 2025-02-21 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Settlement Date · @2046 |  |  |  |
| 20 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Product Ranking · @587 |  |  |  |
| 21 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Product Ranking · @1261 |  |  |  |
| 22 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Product Ranking · @594 |  |  |  |
| 23 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Product Ranking · @1268 |  |  |  |
| 24 | Early repayment by the issuer | t1 | Yes · from 2026-02-20 · par | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Redemption Information · @634 |  |  |  |
| 25 | Early repayment by the issuer | t2 | Yes · from 2026-02-20 · par | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Redemption Information · @1308 |  |  |  |
| 26 | Repayment on the holder’s death | t1 | yes | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Survivor's Option · @583 |  |  |  |
| 27 | Repayment on the holder’s death | t2 | yes | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Survivor's Option · @1257 |  |  |  |
| 28 | Bank fee | t1 | 0.95% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Gross Concession · @496 |  |  |  |
| 29 | Bank fee | t2 | 1.55% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Gross Concession · @1170 |  |  |  |
| 30 | Proceeds to the issuer (amount, this tranche) | t1 | USD 6,342,171.5 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Net Proceeds · @504 |  |  |  |
| 31 | Proceeds to the issuer (amount, this tranche) | t2 | USD 4,741,352 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table — Net Proceeds · @1178 |  |  |  |
| 32 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 33 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 34 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @2473 |  |  |  |
| 35 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 36 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 37 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 38 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| 39 | Banks / roles: agent | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table · @2372 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | InspereX | agent | Purchasing Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| P2 | BofA Securities | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| P3 | Morgan Stanley | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| P4 | RBC Capital Markets | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| P5 | Wells Fargo Advisors | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |
| P6 | U.S. Bank Trust Company, National Association | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000011/finalpricingsupplement-021.htm) · retail table |  |  |  |

## 20. General Motors Financial Co. — 0000804269-25-000028 (424B2, filed 2025-03-24, family C)

Filing: https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm

| Tranche | Label | Matures | Amount |
|---|---|---|---|
| t1 | 4.850% Senior Notes due 3/20/2027 | 2027-03-20 | USD 9,490,000 |
| t2 | 5.450% Senior Notes due 3/20/2031 | 2031-03-20 | USD 3,562,000 |

| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|
| 1 | Date of this document | all | 2025-03-24 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · cover — Cover page · @161 |  |  |  |
| 2 | CUSIP / ISIN | t1 | CUSIP 37046AFR1 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @477 |  |  |  |
| 3 | CUSIP / ISIN | t2 | CUSIP 37046AFS9 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @1151 |  |  |  |
| 4 | Amount | t1 | 9,490,000 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @514 |  |  |  |
| 5 | Amount | t2 | 3,562,000 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @1188 |  |  |  |
| 6 | Currency | t1 | USD | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @514 |  |  |  |
| 7 | Currency | t2 | USD | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @1188 |  |  |  |
| 8 | Interest rate | t1 | 4.85% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @533 |  |  |  |
| 9 | Interest rate | t2 | 5.45% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @1207 |  |  |  |
| 10 | Matures | t1 | 2027-03-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @552 |  |  |  |
| 11 | Matures | t2 | 2031-03-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @1226 |  |  |  |
| 12 | Price to investors | t1 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Selling Price · @487 |  |  |  |
| 13 | Price to investors | t2 | 100% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Selling Price · @1161 |  |  |  |
| 14 | Interest paid | t1 | semi-annual · first 2025-09-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Coupon Frequency · @540 |  |  |  |
| 15 | Interest paid | t2 | semi-annual · first 2025-09-20 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Coupon Frequency · @1214 |  |  |  |
| 16 | How interest is counted | t1 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 17 | How interest is counted | t2 | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 18 | Priced on | all | 2025-03-24 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Trade Date · @1954 |  |  |  |
| 19 | Issue date | all | 2025-03-27 | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Settlement Date · @2033 |  |  |  |
| 20 | Ranking | t1 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Product Ranking · @583 |  |  |  |
| 21 | Ranking | t2 | Senior | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Product Ranking · @1257 |  |  |  |
| 22 | Secured or unsecured | t1 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Product Ranking · @590 |  |  |  |
| 23 | Secured or unsecured | t2 | unsecured | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Product Ranking · @1264 |  |  |  |
| 24 | Early repayment by the issuer | t1 | Yes · from 2026-03-20 · par | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Redemption Information · @630 |  |  |  |
| 25 | Early repayment by the issuer | t2 | Yes · from 2026-03-20 · par | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Redemption Information · @1304 |  |  |  |
| 26 | Repayment on the holder’s death | t1 | yes | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Survivor's Option · @579 |  |  |  |
| 27 | Repayment on the holder’s death | t2 | yes | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Survivor's Option · @1253 |  |  |  |
| 28 | Bank fee | t1 | 0.55% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Gross Concession · @492 |  |  |  |
| 29 | Bank fee | t2 | 1.35% | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Gross Concession · @1166 |  |  |  |
| 30 | Proceeds to the issuer (amount, this tranche) | t1 | USD 9,437,805 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Net Proceeds · @500 |  |  |  |
| 31 | Proceeds to the issuer (amount, this tranche) | t2 | USD 3,513,913 (before expenses) | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table — Net Proceeds · @1174 |  |  |  |
| 32 | Risks | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 33 | Where the notes may not be sold | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 34 | Banks / roles: trustee | all | 1 named | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @2457 |  |  |  |
| 35 | Banks / roles: guarantor | all | Not stated in the filing | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 36 | Banks / roles: bookrunner | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 37 | Banks / roles: co_manager | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 38 | Banks / roles: underwriter | all | Not applicable | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| 39 | Banks / roles: agent | all | 5 named | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table · @2356 |  |  |  |

| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |
|---|---|---|---|---|---|---|---|---|
| P1 | InspereX | agent | Purchasing Agent | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| P2 | BofA Securities | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| P3 | Morgan Stanley | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| P4 | RBC Capital Markets | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| P5 | Wells Fargo Advisors | agent | Agents | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |
| P6 | U.S. Bank Trust Company, National Association | trustee | Trustee | all | [filing](https://www.sec.gov/Archives/edgar/data/804269/000080426925000028/finalpricingsupplement-032.htm) · retail table |  |  |  |

