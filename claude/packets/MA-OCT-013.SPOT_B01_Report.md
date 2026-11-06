# MA-OCT-013.SPOT_B01 — Data-Identity 20-row spot check, pilot batch B01

- **Reviewer:** independent Data-Identity reviewer, acting for the Data-Identity Lead (LANE-11). Did not author the plan, runner or run (Arch M-3).
- **Written:** Fri 6 Nov 2026, about 16:30Z. Read-only: no D1 writes, no deploys, no git staging.
- **Sample:** `~/MeridianAtlas-work/ma-oct-013/run1/b01-spot20-sample.json`. **sha256 verified = `d5280d6c86a5a07a712d517395f8f98fcf6447a1a7305a7a9646b1954a4229ea`** (matches the expected value).
  - n = 20 of population 50. Draw: sha256(seed:dup_id) ascending.
  - Plan sha256 `7345e95f…3c59ba` (as stated in the sample).
- **Pre-image:** `preimage-B01-7345e95f7e3e.json`. sha256 = `afd85dd7…faea1c4`, which matches the sample's `preimage_sha256`.
- **Post-merge D1 check:** two read-only SELECTs, primary-key `IN` lists only.
  - All 20 survivor ids are present in `entity_master` (20/20).
  - None of the 20 duplicate ids remain in `entity_master` (0/20).
  - `entity_merge_redirect` holds 20/20 rows, and every duplicate_id maps to the expected survivor_id.

## Per-row adjudication

| n | Survivor (id / name) | Duplicate (id / name) | Verdict | Basis |
|---|---|---|---|---|
| 1 | 2368 Ferrari N.V. (NL, LEI 549300RIVY5EX8RCON76) | 223236 Ferrari NV (IT) | Correct | Same company. Ferrari N.V. is incorporated in the Netherlands with its HQ in Maranello, Italy; the survivor's own pre-image shows hq_country IT. The duplicate's IT is the HQ/listing country. |
| 2 | 1274 Nouryon Finance B.V. (NL) | 266475 Nouryon Finance B.V. (NL) | Correct | Same name and legal form, same country. |
| 3 | 2311 Loews Corporation (US, CIK 60086) | 216327 Loews Corp (US) | Correct | "Corp" is short for Corporation, and the country is the same. |
| 4 | 2273 The Progressive Corporation (US, CIK 80661) | 230355 The Progressive Corporation (US) | Correct | Same name and country. |
| 5 | 2375 MERIDIAN ENERGY LIMITED (NZ) | 251958 Meridian Energy Ltd (NZ) | Correct | Ltd is short for Limited, and the country is the same. |
| 6 | 2419 ISRAEL DISCOUNT BANK LIMITED (IL) | 255331 Israel Discount Bank Ltd (IL) | Correct | Ltd is short for Limited, and the country is the same. |
| 7 | 2364 INFRATIL LIMITED (NZ) | 258718 Infratil Ltd (NZ) | Correct | Ltd is short for Limited, and the country is the same. |
| 8 | 1344 Belron Group S.A. (US) | 236773 Belron Group S.A. (US) | Correct | Same name, legal form and country. Both rows carry country US, though Belron is Luxembourg-domiciled. That is a pre-existing country-quality issue on both rows, not a merge error. |
| 9 | 2409 JARDINE MATHESON HOLDINGS LIMITED (BM, LEI 2138009KENVUNWOLPK41) | 228481 Jardine Matheson Holdings Ltd (SG) | Correct | Same company. It is incorporated in Bermuda (legal address Hamilton BM), and its primary listing is on SGX, which gives the duplicate's SG. |
| 10 | 1852 Flowserve Corporation (US, CIK 30625) | 216313 Flowserve Corp (US) | Correct | Corp is short for Corporation, and the country is the same. |
| 11 | 1827 Newmont Corporation (US, CIK 1164727) | 216070 Newmont Corp (US) | Correct | Corp is short for Corporation, and the country is the same. |
| 12 | 2363 HKT Trust and HKT Limited (HK) | 229631 HKT Trust and HKT Limited (HK) | Correct | Same name and country. It is a stapled unit, the same issuer. |
| 13 | 2246 Fortive Corporation (US, CIK 1659166) | 216621 Fortive Corp (US) | Correct | Corp is short for Corporation, and the country is the same. |
| 14 | 2382 BRITISH AMERICAN TOBACCO P.L.C. (GB, CIK 1303523) | 226415 British American Tobacco PLC (GB) | Correct | P.L.C. and PLC are the same legal form, and the country is the same. |
| 15 | 2434 WOOLWORTHS GROUP LIMITED (AU) | 257632 Woolworths Group Ltd (AU) | Correct | Ltd is short for Limited, and the country is the same (the Australian Woolworths Group). |
| 16 | 2472 SINGAPORE TELECOMMUNICATIONS LIMITED (SG) | 256242 Singapore Telecommunications Ltd (SG) | Correct | Ltd is short for Limited, and the country is the same. |
| 17 | 2422 COLES GROUP LIMITED (AU) | 258850 Coles Group Ltd (AU) | Correct | Ltd is short for Limited, and the country is the same. |
| 18 | 2483 OVERSEA-CHINESE BANKING CORPORATION LIMITED (SG) | 230898 OVERSEA-CHINESE BANKING CORPORATION LIMITED (SG) | Correct | Same name and country. |
| 19 | 2477 SINGAPORE AIRLINES LIMITED (SG) | 253480 Singapore Airlines Ltd (SG) | Correct | Ltd is short for Limited, and the country is the same. |
| 20 | 2441 THE LOTTERY CORPORATION LIMITED (AU) | 229613 THE LOTTERY CORPORATION LIMITED (AU) | Correct | Same name and country. |

## Notes
- **Spec I-1 legal-form collision risk:** none of the 20 pairs has two different legal forms that would point to two separate entities (unlike FUJI CORPORATION vs FUJI CORPORATION LIMITED). Every difference is either an abbreviation of the same form (Ltd/Limited, Corp/Corporation, PLC/P.L.C., NV/N.V.) or no difference at all.
- **No identifier conflicts:** none of the 20 duplicates carries an LEI or CIK of its own. All are thin rows: created 2026-08-23 by name_search, no ETF holdings, and enrichment still pending.
- **Country differences:** two pairs differ by country, rows 1 (NL/IT) and 9 (BM/SG). Both are explained by incorporation country versus HQ or listing country, and neither is a different entity.
- **Data-quality follow-up (not a merge error):** row 8, Belron Group S.A., is tagged US on both rows but is Luxembourg-domiciled. This belongs to the enrichment lane.

**Errors = 0**

VERDICT: PASS

Signed: DI-Spot-Reviewer-B01 (independent, acting for Data-Identity Lead LANE-11)
