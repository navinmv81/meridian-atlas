# MA-NOV-BQ2 — November baseline queries (read-only) — Report

```text
PACKET:   MA-NOV-BQ2 · Control v1 (246e0b1d…1630) · Task v1 (c0cdd3f5…4c02)
RUN:      r-20261111T063341Z-a857 · interactive · 2026-11-11
ROLE:     Data-Identity Lead (read-only)
OUTCOME:  DONE — 9 statements + 6 plan checks; 126,925 rows read (cap 200,000); 1 query skipped (no index)
AUTH:     `npx wrangler whoami` → "You are logged in with an OAuth Token" · CLOUDFLARE_API_TOKEN: unset
DB:       meridian-etf (--remote, repo root, no -c)
```

## 1 Summary
- **Bonds (BOND baseline): SA1's October figures are confirmed exactly.** 943 rows: final 632 · preliminary 184 · skipped_other 52 · skipped_non_debt 45 · skipped_structured 21 · parse_failed 9. Final = 67.0% of rows; final + preliminary = 86.5%. bonds-1.2.0 has added 165 final rows across only 4 CIKs.
- **Preliminary → final cannot be matched by tranche.** All 184 preliminary rows have null CUSIP, coupon, maturity, principal and tranche label. Only issuer-level matching works: 161/184 (87.5%) have a final row for the same CIK, and 153/184 (83.2%) have one filed within 14 days. **23 preliminary rows have no final row for their CIK.** BOND spec must pick a tranche identity rule; the data has none today.
- **Exposure is badly stale (EXP-08):** `entity_exposure_monthly` latest month is **2026-03**, last computed **2026-06-14** (gate3, one run). `fund_holdings_monthly` latest month is **2026-08**. That is a 5-month gap. `fund_exposure_coverage` 2026-03 covers just 42 funds (mean mapped weight 76.2%, 5 below 50%), out of 237 ETFs.
- **Holdings cycle:** still at offset 133/237 (`running:133/237:partial:7`, last run 2026-11-08 04:00Z, 13 ETFs processed). No progress beyond SA1's figure.
- **Mapping tiers: SA1's figures are confirmed** (isin 18,563 · openfigi 8,806 · cusip 3,751 · heuristic 1,649 = 32,769). SA1's "figi" label is `openfigi_tier1` in D1.
- **Enrichment queue:** pending 25,281 · failed 1,218 · complete 1,170 · in_progress 1.
- Meaning: EXP-08 freshness needs a gate3 re-run before any EXP result is current. The BOND baseline % stands as recorded.

## 2 Results
| # | Question | SQL | Result | rows_read |
|---|---|---|---|---|
| 1 | Bonds by status/parser | `SELECT filing_status, parser_version, COUNT(*), COUNT(DISTINCT accession_number), COUNT(DISTINCT cik) FROM bond_issuance GROUP BY 1,2` | final 1.1.0 467/216 acc/27 CIK · final 1.2.0 165/109/4 · prelim 1.1.0 173/173/24 · prelim 1.2.0 11/11/3 · skipped_other 1.1.0 40/40/12 · 1.2.0 11/11/2 · 1.2.0-r4 1/1/1 · skipped_non_debt 1.1.0 42/42/8 · 1.2.0 3/3/2 · skipped_structured 1.1.0 21/21/1 · parse_failed 1.1.0 8/7/5 · 1.2.0 1/1/1. Totals = SA1. | 1,886 |
| 2a | Prelim vs final, tranche identity (CIK+CUSIP; CIK+coupon+maturity) | `SELECT COUNT(*), SUM(cusip IS NOT NULL), SUM(coupon_rate IS NOT NULL AND maturity_date IS NOT NULL), SUM(EXISTS final same cik+cusip), SUM(EXISTS final same cik+maturity+coupon), … FROM bond_issuance p WHERE filing_status='preliminary'` | 184 prelim; 0 with CUSIP; 0 with coupon+maturity; 0 matched either way | 4,587 |
| 2b | Prelim fields + issuer-level match (CIK; CIK + final filed ≤14 d after) | `SELECT COUNT(*), SUM(maturity_date IS NOT NULL), SUM(coupon_rate…), SUM(principal_amount…), SUM(tranche_label…), SUM(EXISTS final same cik), SUM(EXISTS final same cik AND f.filing_date BETWEEN p.filing_date AND date(p.filing_date,'+14 days')) … WHERE filing_status='preliminary'` | has maturity 0 · coupon 0 · amount 0 · label 0 · CIK has final 161 · final within 14 d 153 | 2,238 |
| 3a | Exposure + holdings freshness | `SELECT (SELECT MAX(report_month) FROM entity_exposure_monthly), (SELECT MAX(report_month) FROM fund_holdings_monthly)` | eem **2026-03** · fhm **2026-08** | 2 |
| 3b | eem rows per month (≥2026-01, indexed range) | `SELECT report_month, COUNT(*), COUNT(DISTINCT holder_entity_id), MAX(computed_at) FROM entity_exposure_monthly WHERE report_month >= '2026-01' GROUP BY report_month` | 2026-01 8,892 rows/32 holders · 2026-02 6,215/26 · 2026-03 9,680/40 · all computed 2026-06-14T18:18Z | 24,787 |
| 4 | Coverage summary | `SELECT report_month, COUNT(*), AVG/MIN/MAX(mapped_weight/total_weight), SUM(<0.5), MAX(computed_at) FROM fund_exposure_coverage GROUP BY report_month` | 10 months 2025-05…2026-03 (133 fund-months). Latest 2026-03: 42 funds, mean 0.7615, min 0, max 0.9978, 5 below 50%. 2026-02: 30 funds, mean 0.5559. 2026-01: 36 funds, mean 0.6784. All computed 2026-06-14. (Median not computed: it would need another statement; mean/min/max given.) | 133 |
| 5 | Mapping tiers | `SELECT source, COUNT(*) FROM instrument_entity_map GROUP BY source` | isin_tier1 18,563 · openfigi_tier1 8,806 · cusip_tier1 3,751 · heuristic 1,649 (= SA1) | 65,542 |
| 6 | Holdings pipeline state | `SELECT key, value, updated_at FROM holdings_pipeline_state` | etf_offset 133 · etfs_processed 13 · last_full_run 2026-11-08T04:00:03Z · last_run_status `running:133/237:partial:7` · offset_KRE_2026-06 165 · hold_all_jobs false · enrich_phase3_last_run_entities 21 (2026-11-09) · writes_today 2026-11-08 80,361, 2026-11-09 36,974 (76 keys total, mostly writes_today_*) | 76 |
| 7 | New entities since 2026-11-08 | — | **Skipped** (see §3) | 0 |
| 8 | Enrichment queue by status | `SELECT status, COUNT(*) FROM entity_enrichment_queue GROUP BY status` | pending 25,281 · failed 1,218 · complete 1,170 · in_progress 1 | 27,674 |

Plan checks (not counted, 0 rows each): eem MAX → `SEARCH … USING COVERING INDEX sqlite_autoindex_entity_exposure_monthly_1`; fhm MAX → `SEARCH … USING COVERING INDEX idx_holdings_month`; eem GROUP BY all months → `SCAN … USING COVERING INDEX` (whole table; replaced with the ≥2026-01 range, `SEARCH … (report_month>?)`); fund_exposure_coverage → `SEARCH … USING INDEX sqlite_autoindex_fund_exposure_coverage_1`; entity_master created_at → `SCAN entity_master`; enrichment queue → `SCAN … USING COVERING INDEX idx_enrich_queue_status`.

## 3 Skipped
- **Q7 New entities (entity_master, created_at ≥ 2026-11-08):** plan `SCAN entity_master` — no index on `created_at`. Not run, per Control. The +145 FIRDS figure from SA1 stays unverified. A `created_at` index or a FIRDS-run log is needed to measure it.
- **Q3 eem rows for months before 2026-01:** the all-month GROUP BY plan was a full covering-index scan. It was narrowed to keep the row budget. The coverage table (Q4) shows that older months hold ≤ 7 funds each.

## 4 Total rows read
1,886 + 4,587 + 2,238 + 2 + 24,787 + 133 + 65,542 + 76 + 27,674 = **126,925** (cap 200,000). 9 statements (cap 15) + 6 plan checks. There were no Cloudflare 10000 errors and no retries.

## 5 Boundaries kept
Only SELECT / EXPLAIN QUERY PLAN, run from the repo root with `--remote` and no `-c`. No writes, DDL, deploys, secrets or `.env` reads. No git writes, and no file edited other than this report (one scratch helper script sits in the session scratchpad, outside the repo). No Status, board, Tower or factory files touched. No subagents, no npm installs. `13F Seed/gleif-seed.js` untouched. No token printed.
