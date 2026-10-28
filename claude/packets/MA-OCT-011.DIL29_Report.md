# MA-OCT-011.DIL29 — Report (LANE-11, Data-Identity Lead): A legal-form-mismatch and FUND lists for the A2 re-plan

**This is report-only.** It makes no ruling on the A2 schedule.

**Control v1:** `claude/packets/MA-OCT-011.DIL29_Control_v1.md` `f4e6e6ae1b6ffeeb3c632e218b4d1259aad11adcf7d8ed48790e69b95cd7cb05`. It matches the STATUS_BOARD row. **Task v1** `540234cd2d97fcd1cd181af92d8ce7e338952bc5042f34cc7c0b96e176abb1db` matches.
**Date:** Fri 23 Oct 2026. **Git:** HEAD `c3c6e4a`. No `.git/*.lock`. No git writes.
**0 D1. 0 GLEIF API calls.** The 28 Sep Golden Copy (lei2, rr) is the only evidence. No key file was opened, and there was no macOS prompt (the existing grants were used).

## Inputs

| File | SHA-256 |
|---|---|
| APILOT report | `2f667081…4206` ✓ |
| Close-out report | `89dab615…b7c9a` ✓ |
| `closeout/a-deferral-list.json` (the 6 named + 11 derived legal-form IDs; 42 FUND IDs) | `86ec9d99…6d56` |
| `plans/release-2026-10-16/plan.json` (plan `e3854698…e6a8`; 3,676 A statements) | read |
| GC `lei2.csv.zip` / `rr.csv.zip` (2026-09-28 16:00) | streamed read-only |

## Outputs (new files in `~/MeridianAtlas-work/gleif-011/a2/`)

| File | Content | SHA-256 |
|---|---|---|
| `A2_legal_form_29.csv` | **The authoritative 29-row list:** entity_id, D1 name and form, LEI, GC name and form + ELF code, jurisdiction, category, verdict, reason | `0e3e8754fd40c74ce7f167370f22e181bc7a846594690bc260b719ced752c589` |
| `A2_legal_form_extended.csv` | 16 more rows from a wider form-class compare (Corp↔Limited, Trust↔Inc, PLC↔Limited), each with a verdict | `574266af80cf9e613a5f90288d2b5a50556d8a9379c7e677ce0284f374829345` |
| `A2_fund_42.csv` | The 42 FUND-matched A rows, each classified | `ba10847d706f5373b44e93edd56f44bd209a42ef378e1cdd0c25ba1b12e6c68c` |
| `A2_exclusions_DIL.json` | Counts, the wrong and review IDs, the three proposed A2 rules with the IDs each one excludes, and the union | `ac1c157202913643b21ea3adc8fbca3f3fdcc9d4de15593395f55913ba7ab4f7` |

## Summary

| List | Rows | Wrong | Review | Probably fine / correct |
|---|---|---|---|---|
| Legal form, the 29 (LLC/LP class, the APILOT rule) | 29 | **17** | 0 | 12 |
| Legal form, extended (other form classes) | 16 | **6** | 0 | 10 |
| FUND-matched | 42 | **4** | 1 | 37 |
| **Distinct** (106444 is in both extended and FUND) | — | **26** | **1** | — |

- **Method:** for every row I read the GC lei2 record for the written LEI: legal name, legal form ELF code, jurisdiction, category, and every OTHER / PREVIOUS_LEGAL_NAME / trading name.
- I also searched the whole lei2 file for **competing records** with the same base name. That search found, for example, CITADEL SECURITIES LLC, VNOM SUB, INC. and AMERICAN INTERNATIONAL COMPANY LIMITED.
- I read `rr` for parent and fund relationships.
- **The deciding test:** is the written LEI's legal person the D1 entity?
  - A GC previous legal name equal to the D1 name means a rename or conversion of the same person, so the row is fine. One exception is the SPAC trap at 87745.
  - A listed Inc./Corp. against an LLC that is its operating subsidiary (the Up-C pattern), a CLO LLC co-issuer against the Ltd issuer, or a securitisation trust against its depositor or originator means a different person.

## 1. The 29-row legal-form list, reconciled with the close-out's 16

**Reconciliation:**
- The close-out's flags hold **17 distinct IDs**: 6 APILOT-named + 11 derived. Its text says "16 (11 beyond the named 6)", so one of the 6 was presumably counted under `apilot_wrong` (2303).
- **15 of the 17 are in the 29:** 483, 517, 1156, 1275, 1337, 2303, 3262, 14771, 14864, 15441, 15538, 15589, 86996, 87094, 87745.
- **2 are not:** 109643 Wajax Corp → WAJAX LIMITED and 111083 Magellan Aerospace Corporation → MAGELLAN AEROSPACE LIMITED. These are the Corp↔Limited class, which the APILOT rule (LLC/LP only) did not test. **Both are wrong** (listed parent vs its Limited subsidiary). They are in the extended list.
- **14 rows are in the 29 but not in the close-out:** 30897, 99017, 100714, 100757, 100802, 101834, 103347, 104374, 105894, 106156, 106235, 106512, 107708, 458583. Of these:
  - **5 are wrong:** 99017 J.M. Smucker; the CLO co-issuers 104374, 107708 and 458583; and 106235 A&D Mortgage Trust;
  - **9 are probably fine:** 30897 matches on a previous name, and 8 are truncated bond-issuer names with no legal form.
- **Of the close-out's 17:** 13 are wrong, 4 are probably fine (1156, 1275 and 1337 on previous names; 30897 is not in the 17).

| entity_id | D1 name (form) | LEI | GC legal name (form, ELF) | Verdict |
|---|---|---|---|---|
| 483 | Vitesse Energy Inc (INC) | `5493007WQU87J137VH14` | VITESSE ENERGY, LLC (LLC, HZEH) | **wrong**: Up-C/subsidiary: listed Vitesse Energy, Inc. vs its operating LLC; no rename evidence in GC |
| 517 | FONAR Corp (CORP) | `2549000VELB9OBE59L78` | FONAR, LLC (LLC, HZEH) | **wrong**: FONAR Corporation (NY corp) vs FONAR, LLC (US-DE LLC); no rename/conversion evidence (no PREVIOUS_LEGAL_NAME) |
| 1156 | Ategrity Specialty Holdings LLC (LLC) | `549300KMIVG4HUBDUF07` | Ategrity Specialty Insurance Company Holdings (COMPANY, 8WM4) | **probably fine**: Same entity renamed: GC PREVIOUS_LEGAL_NAME = "ATEGRITY SPECIALTY HOLDINGS LLC" (= D1) |
| 1275 | Citadel Securities L.P. (LP) | `549300NV5RXBUS3X7L47` | Citadel Securities Global Holdings LLC (LLC, HZEH) | **probably fine**: Same entity converted/renamed: GC PREVIOUS_LEGAL_NAME = "CITADEL SECURITIES LP" (= D1); the broker-dealer CITADEL SECURITIES LLC (12UUJYTN7D3SW8KCSG25) is a different record |
| 1337 | Broadstreet Partners, Inc. (INC) | `549300BS9N54G8DD0R75` | BroadStreet Partners Group, LLC (LLC, HZEH) | **probably fine**: Same entity converted: GC PREVIOUS_LEGAL_NAME = "BROADSTREET PARTNERS, INC." (= D1) |
| 2303 | Tradeweb Markets Inc (INC) | `5493000G5QHJUY9ZWQ91` | TRADEWEB MARKETS LLC (LLC, HZEH) | **wrong**: APILOT E-4: listed Tradeweb Markets Inc. vs operating TRADEWEB MARKETS LLC; LLC direct parent exception NO_LEI |
| 3262 | V2X Inc (INC) | `549300YOTFEWSPUJ2D47` | V2X LLC (LLC, HZEH) | **wrong**: Listed V2X, Inc. (ex-Vectrus) vs V2X LLC (ex-Vertex Aerospace Services, its subsidiary) |
| 14771 | Allegro MicroSystems Inc (INC) | `54930004TGPV6DR3LE12` | ALLEGRO MICROSYSTEMS, LLC (LLC, HZEH) | **wrong**: Listed Allegro MicroSystems, Inc. vs its operating LLC |
| 14864 | Terreno Realty Corp (CORP) | `54930030PMX75E3KJO08` | TERRENO REALTY LLC (LLC, HZEH) | **wrong**: Listed Terreno Realty Corporation (REIT) vs its operating LLC |
| 15441 | Walker & Dunlop Inc (INC) | `254900YA1AQXNM8QVZ06` | WALKER & DUNLOP, LLC (LLC, HZEH) | **wrong**: Listed Walker & Dunlop, Inc. vs its operating LLC |
| 15538 | Dutch Bros Inc (INC) | `549300ISYAXTFZ4LCT04` | DUTCH BROS., LLC (LLC, QK2J) | **wrong**: Up-C: listed Dutch Bros Inc. vs DUTCH BROS., LLC (prev name is the LLC's own, not the Inc) |
| 15589 | Shift4 Payments Inc (INC) | `254900GTEMR7L40VPI74` | SHIFT4 PAYMENTS, LLC (LLC, HZEH) | **wrong**: Up-C: listed Shift4 Payments, Inc. vs SHIFT4 PAYMENTS, LLC |
| 30897 | Viper Energy Partners LLC (LLC) | `54930010ZZ02MRGRI973` | VIPER ENERGY PARTNERS LP (LP, T91T) | **probably fine**: GC PREVIOUS_LEGAL_NAME = "VIPER ENERGY PARTNERS LLC" (= D1): same record |
| 86996 | Silvercrest Asset Management Group Inc (INC) | `54930025FW84N3HROX04` | SILVERCREST ASSET MANAGEMENT GROUP LLC (LLC, HZEH) | **wrong**: Up-C: listed Silvercrest Asset Management Group Inc. vs its LLC |
| 87094 | Solo Brands Inc (INC) | `549300TX9CEZTZPWNQ74` | Solo Brands, LLC (LLC, WYG5) | **wrong**: Up-C: listed Solo Brands, Inc. vs Solo Brands, LLC |
| 87745 | Playstudios Inc (INC) | `549300ODCDGK65O4JQ93` | PLAYSTUDIOS US, LLC (LLC, HZEH) | **wrong**: SPAC trap: GC PREVIOUS_LEGAL_NAME "PLAYSTUDIOS, INC." is the pre-merger company, now PLAYSTUDIOS US, LLC; the listed Playstudios, Inc. (ex-Acies) is a different entity |
| 99017 | JM SMUCKER CO (CO) | `549300RH3204BC21UZ79` | J.M. SMUCKER LLC (LLC, EZNQ) | **wrong**: The J.M. Smucker Company (OH corp, listed) vs J.M. SMUCKER LLC (US-OH subsidiary) |
| 100714 | GABX LEASING ((none)) | `25490085PXP0WGRIRI44` | GABX Leasing LLC (LLC, HZEH) | **probably fine**: D1 name is a truncated bond-issuer name with no legal form; GABX Leasing LLC is the only candidate |
| 100757 | FLEX INTERMEDIATE HOLDCO ((none)) | `549300290TQIGM30A243` | FLEX INTERMEDIATE HOLDCO, LLC (LLC, HZEH) | **probably fine**: Truncated issuer name, no legal form; only candidate |
| 100802 | SOUTHERN NATURAL GAS ((none)) | `254900KDLS1X42SY7037` | Southern Natural Gas Company, L.L.C. (LLC, HZEH) | **probably fine**: Truncated issuer name; GC trading name "Southern Natural Gas Company" |
| 101834 | RYAN SPECIALTY ((none)) | `549300K52N7QBO3PYY45` | RYAN SPECIALTY, LLC (LLC, HZEH) | **probably fine**: Truncated issuer name; Ryan Specialty, LLC is the notes issuer (listed parent is Ryan Specialty Holdings, Inc.) |
| 103347 | STONEPEAK NILE PARENT ((none)) | `254900TJV3VAFZD0GU41` | STONEPEAK NILE PARENT LLC (LLC, HZEH) | **probably fine**: Truncated issuer name; only candidate |
| 104374 | MOUNTAIN VIEW CLO 2016-1 LLC (LLC) | `549300T646RU5R8OGR18` | MOUNTAIN VIEW CLO 2016-1 LTD. (LTD, OSBR) | **wrong**: CLO co-issuer pair: D1 is the Delaware co-issuer LLC; the LEI is the Cayman issuer LTD |
| 105894 | ROBERT BOSCH FINANCE ((none)) | `549300VQST07EL5DYC58` | Robert Bosch Finance LLC (LLC, HZEH) | **probably fine**: Truncated issuer name; Robert Bosch Finance LLC is the issuer |
| 106156 | CABLEVISION LIGHTPATH ((none)) | `5493002ZVBLRLGES1R71` | CABLEVISION LIGHTPATH LLC (LLC, HZEH) | **probably fine**: Truncated issuer name; only candidate |
| 106235 | A&D Mortgage Trust (TRUST) | `2549005SIVTHG14U2905` | A&D Mortgage LLC (LLC, 8N21) | **wrong**: Securitisation trust vs the originator A&D Mortgage LLC |
| 106512 | SG Capital Partners ((none)) | `549300VHRN8Y3LH00X29` | SG CAPITAL PARTNERS LLC (LLC, HZEH) | **probably fine**: Truncated issuer name; only candidate |
| 107708 | Southwick Park CLO LLC (LLC) | `254900UYZEO4TOTJ9798` | Southwick Park CLO, Ltd. (LTD, OSBR) | **wrong**: CLO co-issuer pair: D1 LLC co-issuer vs the Cayman issuer Ltd |
| 458583 | Boyce Park CLO, LLC (LLC) | `54930028S3PFXX4SMQ72` | BOYCE PARK CLO, LTD. (LTD, SQXV) | **wrong**: CLO co-issuer pair: D1 LLC co-issuer vs the Jersey issuer LTD |

### Extended form-class rows (not in the 29)

| entity_id | D1 name (form) | LEI | GC legal name (form, ELF) | Verdict |
|---|---|---|---|---|
| 371 | Brera Holdings PLC (PLC) | `984500EE55766B5O3803` | BRERA HOLDINGS PUBLIC LIMITED COMPANY (COMPANY, VYAX) | **probably fine**: Form artefact: PUBLIC LIMITED COMPANY = PLC |
| 49221 | Morgan Stanley Capital I Trust (TRUST) | `3IFG42XD94UUZ7FL2766` | MORGAN STANLEY CAPITAL I INC. (INC, XTIQ) | **wrong**: CMBS trust vs its depositor MORGAN STANLEY CAPITAL I INC. |
| 93550 | John Wood Group PLC (PLC) | `549300PLYY6I10B6S323` | JOHN WOOD GROUP LIMITED (LIMITED, H0PO) | **probably fine**: Re-registered PLC→Limited: GC PREVIOUS_LEGAL_NAME "JOHN WOOD GROUP PLC" |
| 93601 | Bakkavor Group PLC (PLC) | `213800COL7AD54YU9949` | BAKKAVOR GROUP LIMITED (LIMITED, H0PO) | **probably fine**: Re-registered: PREVIOUS_LEGAL_NAME "BAKKAVOR GROUP PLC" |
| 94506 | Alpha Group International PLC (PLC) | `213800RESM1FPUXY6K31` | ALPHA GROUP INTERNATIONAL LIMITED (LIMITED, H0PO) | **probably fine**: Re-registered: PREVIOUS_LEGAL_NAME "ALPHA GROUP INTERNATIONAL PLC" |
| 99194 | GS Mortgage Securities Trust (TRUST) | `CU46ESEFJB81SUVBJO28` | GS MORTGAGE SECURITIES CORP. (CORP, XTIQ) | **wrong**: CMBS trust vs its depositor GS MORTGAGE SECURITIES CORP. |
| 99402 | 1559985 BC Ltd (LTD) | `254900OO72Y1687QOV65` | Brookfield Business Corporation (CORPORATION, YG5M) | **probably fine**: GC PREVIOUS_LEGAL_NAME "1559985 B.C. LTD." (= D1): renamed to Brookfield Business Corporation |
| 100823 | SKY GROUP FINANCE PLC (PLC) | `213800BZ2GKRAWTQFZ49` | SKY GROUP FINANCE LIMITED (LIMITED, H0PO) | **probably fine**: Re-registered: PREVIOUS_LEGAL_NAME "SKY GROUP FINANCE PLC" |
| 103765 | Versigent PLC (PLC) | `254900V7AVDC2J9DHM24` | VERSIGENT LIMITED (LIMITED, SQXV) | **probably fine**: Jersey company: only record; no PLC previous name, so the A2 rule excludes it conservatively |
| 103782 | Octave Intelligence PLC (PLC) | `254900BNJKBGSU9LON27` | OCTAVE INTELLIGENCE PUBLIC LIMITED COMPANY (COMPANY, VYAX) | **probably fine**: Form artefact: PUBLIC LIMITED COMPANY = PLC |
| 106027 | DS Smith PLC (PLC) | `39RSBE4RCI4M15BLWH36` | DS SMITH LIMITED (LIMITED, H0PO) | **probably fine**: Re-registered: PREVIOUS_LEGAL_NAME "DS SMITH PLC" |
| 106283 | Extended Stay America Trust (TRUST) | `549300IESZBC3BJUJW64` | EXTENDED STAY AMERICA, INC. (INC, XTIQ) | **wrong**: Securitisation trust vs EXTENDED STAY AMERICA, INC. |
| 106444 | Winchester PLC (PLC) | `213800LUYX6VIAXBC647` | WINCHESTER FUND (FUND, 8888) | **wrong**: D1 "Winchester PLC" vs GC FUND "WINCHESTER FUND" (also in the FUND list) |
| 109643 | Wajax Corp (CORP) | `54930047NLDDZSRDPL09` | WAJAX LIMITED (LIMITED, O90R) | **wrong**: Listed Wajax Corporation vs WAJAX LIMITED (subsidiary); close-out candidate |
| 109728 | Hurricane Energy PLC (PLC) | `2138007Z66OO4XWKM819` | PRAX UPSTREAM LIMITED (LIMITED, H0PO) | **probably fine**: Renamed after acquisition: PREVIOUS_LEGAL_NAME "HURRICANE ENERGY PLC" |
| 111083 | Magellan Aerospace Corporation (CORPORATION) | `549300OOKI1J60ZS8Z73` | MAGELLAN AEROSPACE LIMITED (LIMITED, O90R) | **wrong**: Listed Magellan Aerospace Corporation vs MAGELLAN AEROSPACE LIMITED (subsidiary); close-out candidate |

## 2. The 42 FUND-matched A rows

**37 are the correct fund entity.** In each, the GC FUND record's legal name equals the D1 name after normalisation: a fund, trust, BDC, REIT or funding vehicle, which is legitimately the entity. Two of the 37 are noted because GLEIF's FUND category looks anomalous on an operating entity, but the identity is right (in the table below).

**4 are wrong and 1 needs review:**

| entity_id | D1 name | GC legal name | Verdict |
|---|---|---|---|
| 2488 | HONG KONG DOLLAR | HONG KONG DOLLAR | **wrong**: Currency pseudo-entity; LEI is the HSBC Global Money Funds "Hong Kong Dollar" sub-fund (APILOT E-4) |
| 30563 | CI Financial Corp | CI FINANCIAL CORP. | **correct fund entity**: Name exact (CI Financial Corp.); GC category FUND looks like a GLEIF categorisation anomaly, the identity is right |
| 94734 | Ingenia Communities Group | INGENIA COMMUNITIES FUND | **wrong**: Stapled group row vs one stapled component (INGENIA COMMUNITIES FUND) |
| 98894 | AMERICAN INTERNATIONAL | American International Trust | **wrong**: Truncated "AMERICAN INTERNATIONAL" matched a John Hancock fund series; issuer identity not established (AIG / American International Co Ltd also exist) |
| 100695 | MIDCAP FINANCIAL | MIDCAP FINANCIAL TRUST | **review**: Truncated "MIDCAP FINANCIAL"; GC MIDCAP FINANCIAL TRUST may not be the notes issuer (MidCap Financial Issuer Trust); not written until checked |
| 106031 | University of Ottawa | University of Ottawa | **correct fund entity**: Name exact; GC category FUND on a university (GLEIF data), identity right |
| 106444 | Winchester PLC | WINCHESTER FUND | **wrong**: D1 PLC vs GC FUND "WINCHESTER FUND" |

**The other 35 are correct:** 836, 1220, 2032, 3105, 15998, 30389, 30850, 31268, 31354, 31689, 88651, 92582, 92847, 95089, 96402, 96839, 96841, 96842, 99632, 99835, 99837, 100375, 100626, 102641, 103852, 105371, 105443, 106117, 106228, 107674, 107677, 107724, 107940, 109849, 458586.

## 3. Exclusion rules wanted in A2, with expected counts

All three send rows to the **review list**, never into writes. The IDs are in `A2_exclusions_DIL.json`.

| Rule | Definition | Expected count (on the released plan's 3,676 A rows) |
|---|---|---|
| **R-LF legal-form compare** | The D1 name ends in an explicit legal-form class (LLC · LP · PLC · LTD/LIMITED · INC/CORP/CO/COMPANY · TRUST · FUND) that **differs** from the GC legal name's class, **and** no GC other or previous legal name equals the D1 name (normalised, form-sensitive; PUBLIC LIMITED COMPANY = PLC). The rule also needs:<br>- an explicit **deny list** for SPAC previous-name traps (87745);<br>- D1 names with no legal form (truncated bond-issuer names) left untouched;<br>- non-Latin GC names not compared. | **24**: 483, 517, 2303, 3262, 14771, 14864, 15441, 15538, 15589, 86996, 87094, 87745, 99017, 49221, 99194, 106283, 104374, 106235, 107708, 458583, 109643, 111083, 106444, 103765. That is 23 wrong and 1 conservative (103765 Versigent, probably fine but no PLC previous name). |
| **R-CUR currency names** | The D1 name equals a currency name (EURO, JAPANESE YEN, SWISS FRANC, … DOLLAR(S), RUPEE, WON, …). It is never matched. | **1**: 2488. D1 holds about 12 such rows (2369, 2373, 2436, 2449, 2480, 2488, 2578, 2942, 17344, 17413, 97161, …); only 2488 is in A. |
| **R-FUND** | GC category FUND, **and** the D1 name is not equal to the GC legal name (normalised). Exact-name FUND matches stay. A blanket FUND exclusion would drop 37 correct rows. | **5**: 2488, 94734, 98894, 100695, 106444 |
| **Union** | | **28 rows** = 26 wrong + 1 review (100695) + 1 conservative (103765). **A after exclusion: 3,648.** |

**Notes for the A2 builder:**
- The expected counts come from the released plan's A statements and the GC records named above. **R-LF's form classes and its previous-name test must be implemented exactly as stated**, or the counts will drift. A dry run of A2 should reproduce these 24 / 1 / 5 IDs before any write.
- **The extended scan used the last legal-form token of each name.** A2 should also re-check the 7 PLC→Limited rows. They are kept here through their previous legal names: John Wood Group, Bakkavor, Alpha Group, Sky Group Finance, DS Smith, Hurricane Energy→Prax Upstream, and 1559985 BC Ltd→Brookfield Business Corp.
- **The re-plan still needs a fresh export** (A pre-images have drifted; close-out §6). `gleif_006.db` retention ends **31 Oct** (N-6), so an A2 after that date needs a rebuilt or newer GC and re-run tiers (N-2).
- **KI 22.44 link:** the Up-C rows (listed Inc. carrying its operating LLC's LEI) are exactly the RC-12 "subsidiary LEI on the listed parent" class. The same matcher would have reproduced them, which is a reason to keep R-LF permanent in the GLEIF matcher, not only for A2.

## Stop

Written only: the four `a2/` files (new) and this report. No other file was changed. No git writes. 0 D1.
