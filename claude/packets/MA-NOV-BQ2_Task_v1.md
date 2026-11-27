# MA-NOV-BQ2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-11
EXECUTED BY:  Data-Identity Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BQ2_Status.json
CONTROL:      claude/packets/MA-NOV-BQ2_Control_v1.md
```

Usage is tight (~90% weekly; reset Wed 09:00). Be brief: read only the schema files you need (`App/Corporate Atlas/migrations/`, `App/ETF Refresh/` schema, `bonds` migration `008-bonds.sql`), write SQL, run, record.

Before the first query: `npx wrangler whoami` (read-only; report the auth method line only, never a token) and note whether `CLOUDFLARE_API_TOKEN` is set in the environment (`[ -n "$CLOUDFLARE_API_TOKEN" ] && echo set || echo unset` — never print its value).

## Queries (in priority order — stop at the budget)
1. **Bonds by status:** `bond_issuance` grouped by `filing_status`, `parser_version` — rows, distinct accessions, distinct CIKs. (SA1 [Oct]: final 632, preliminary 184, skipped_other 52, skipped_non_debt 45, skipped_structured 21, parse_failed 9.)
2. **Preliminary vs final:** preliminary rows with / without a final row for the same issuer and tranche identity (use the columns `008-bonds.sql` offers, e.g. CIK + CUSIP or CIK + coupon + maturity — state which). Counts only.
3. **Exposure freshness:** `MAX(report_month)` in `entity_exposure_monthly` and in `fund_holdings_monthly` (plan-check first); rows per `report_month` in `entity_exposure_monthly` if indexed.
4. **Coverage:** `fund_exposure_coverage` summary for the latest month (funds, mean/median covered weight if the columns exist).
5. **Mapping tiers:** `instrument_entity_map` rows by match tier/method. (SA1 [Oct]: isin 18,563 · figi 8,806 · cusip 3,751 · heuristic 1,649.)
6. **Holdings pipeline state:** `holdings_pipeline_state` (all rows; small) — offset, cycle, last run.
7. **New entities:** `entity_master` rows created on/after 2026-11-08 — only if a plan check shows an index on the created/first-seen column.
8. Optional, if budget remains: `entity_enrichment_queue` by status.

## Report — `claude/packets/MA-NOV-BQ2_Report.md`
Header (packet, run, outcome), then: 1 Summary (≤10 lines: what changed vs SA1's October figures and what it means for EXP-08 freshness and the BOND baseline %), 2 Results table (# · question · SQL · result · rows_read), 3 Skipped (with the plan line), 4 Total rows read, 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BQ2`.
