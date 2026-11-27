# MA-NOV-BQ1 — November baseline queries (read-only) — Report

```text
PACKET:   MA-NOV-BQ1 · Control v1 (sha256 58174b0c…3eb) · Task v1 (sha256 3cc1c03a…729) — both verified against MA-NOV-BQ1_Status.json
RUN:      r-20261110T205809Z-ae1b (interactive, LANE_OPENER_v2 sha256 67913343…71d6 verified)
ROLE:     Data-Identity Lead (read-only)
OUTCOME:  BLOCKED — stop gate "wrangler auth error" hit on the first D1 statement
DATE:     2026-11-10
```

## 1 Summary
- No D1 figures were measured. The first statement (Q1) failed with a Cloudflare **Authentication error [code: 10000]** on `/accounts/ea36…b40b/d1/database`. The Control's stop gate says report and `end`, so the run stopped there.
- SA1's [Oct] figures (§3, §4, §10) stand **unconfirmed**. Neither EXP-08 freshness nor the BOND baseline % has a measured November baseline yet.
- Likely cause (not verified): wrangler's OAuth login has expired, or a `CLOUDFLARE_API_TOKEN` in the shell environment is overriding it. CLAUDE.md records that the `13F Seed/.env` token has no D1/Workers scope, while the OAuth login does. The env-var presence check was not run (blocked by a local safety check), and `wrangler whoami` was not run because the Control allows no Cloudflare API calls beyond the listed statements.
- **Founder action before a re-run:** in Terminal, run `npx wrangler whoami`. If it is not logged in, or shows a token instead of OAuth, run `npx wrangler login` (and `unset CLOUDFLARE_API_TOKEN` if one is set). Then the Main Lane can re-issue Start Approval and re-run BQ1 unchanged.

## 2 Results

| # | Question | SQL | Result | rows_read |
|---|---|---|---|---|
| 1 | Bonds by status | `SELECT filing_status, parser_version, COUNT(*) AS rows_n, COUNT(DISTINCT accession_number) AS accessions, COUNT(DISTINCT cik) AS ciks FROM bond_issuance GROUP BY filing_status, parser_version ORDER BY filing_status, parser_version` | **Failed:** APIError 10000, Authentication error (before execution) | 0 |

## 3 Skipped
Queries 2–8 were not run, because the stop gate fired on Q1. No `EXPLAIN QUERY PLAN` was run, so no plan lines exist. Schema notes from the files read, for the re-run:
- Q2: `bond_issuance` has `cusip`, `isin`, `coupon_rate` and `maturity_date`. The proposed identity is CIK + maturity_date + coupon_rate, with CUSIP where present.
- Q3: `entity_exposure_monthly` PK is `(report_month, entity_id, holder_entity_id)`, so `report_month` leads. `fund_holdings_monthly` is indexed only on `(series_id, report_month)`, so `MAX(report_month)` may plan as a SCAN. The plan check decides.
- Q5: `instrument_entity_map.source` ∈ {cusip_tier1, isin_tier1, heuristic, openfigi_tier1}.
- Q7: `entity_master.created_at` has no index in the migration files, so Q7 is likely to be skipped at the plan check.

## 4 Total rows read
0 of the 200,000 budget. 1 of 15 statements attempted, and it failed before it executed.

## 5 Boundaries kept
No writes to D1, git, Status/board/Tower/factory files or LaunchAgents. No `-c` config, no `.env*` reads, no deploys, no secrets printed, no subagents. Only this report was written.
