# MA-NOV-EXP.SPEC — Exposure-to-company specification — Report

```text
PACKET:   MA-NOV-EXP.SPEC · Control v1 (fb6847e0…4689) · Task v1 (51e29a54…7a75) — both verified
RUN:      r-20261111T195830Z-bc14 · interactive · 2026-11-11 · LANE_OPENER_v2 67913343…71d6 verified
ROLE:     Entities Product Lead + Architect (specification only)
PINS:     scope c16c8e19…5a03 · SA1 419e4337…3aea · BQ2 9b133cde…5102 — all verified
OUTCOME:  DONE — spec written to claude/specs/MA-NOV-EXP_Spec.md. 8 sizing statements, 113,661 rows read (cap 150,000).
          One code 10000 on statement 1 → waited 30 s, retry succeeded; no second 10000.
```

## 1 Summary
- **Design:**
  - A new read-only route `GET /api/exposure/etf/{symbol}` on `meridian-entities-api` returns one ETF's company weights for its latest (or the previous) stored month. The weights are aggregated in D1 through `instrument_entity_map` plus merge redirects, with the mapping tier kept.
  - Allocation, combination, shared exposure and a 100% reconciliation run in the browser.
  - Nothing is persisted and there are no writes.
- **Key finding:** today's `gate3` (and so `entity_exposure_monthly`) cannot meet EXP-06/07.
  - The table has no tier column.
  - Pass 1 joins `entity_isin_map`, whose PK is `(isin, lei)`, so an ISIN can fan out to several entities. It ignores merge redirects.
  - It is stale (2026-03) and covers 42 funds, against 241 ETFs with stored holdings now.
  - So EXP reads holdings directly. The pre-computed table stays for the company page only.
- **Measured:**
  - Request-time cost is ≈ 2.7 rows read per holding: EEM 1,231 holdings → 3,320 rows. All steps are index SEARCHes.
  - The worst ETF is BND (17,409 holdings) → ≈ 60k uncached reads (estimate). An edge cache (24 h) protects the 5M/day cap.
  - The correlated `MAX(report_month)` pattern read 104,559 rows for about 10k holdings. The spec forbids it.
- **Freshness:** each ETF has its own latest month (2026-01 to 2026-08), so results are normally mixed-month and dated per ETF.
- **gate3 back-fill 2026-04..08:** ≈ 50k rows, 20k–200k row-writes (estimate, index multiplier unmeasured). Run as gate3 v2 (`INSERT … SELECT` via wrangler OAuth). Tue/Thu only, ≤ 50k/day, rollback by run token.
- **Work units:** W1 route (M 2.5), W2 calculation (M 1.5), W3 UI (M 2), W5/W6 back-fill (S 0.5 + 0.5), W7 verification and UAT (S 1). That is **8.0 packet-days**, matching SA1's EXP ≈ 8.

**Open decisions (spec §11):**
- D1: let entities-api read `fund_holdings_monthly` at request time (rec. yes).
- D2: <100% allowed as "unallocated", >100% blocked (yes).
- D3: direct equities at issuer level (yes).
- D4: gate3 back-fill in November (yes).
- D5: recurring refresh and old-month recompute in December (defer).
- D6: UI in `ma-entities.js`, no 12th file (yes).
- D7: ≤ 10 inputs and a 25k-holdings ceiling (yes).
- D8: heuristic mappings included and labelled Low; they carry 65.9% of EEM's weight (yes).
- D9: no possible-duplicate marks in November (yes).

## 2 Sizing queries
All run from the repo root: `npx wrangler d1 execute meridian-etf --remote --json --command "…"`, no `-c`. Large-table queries were plan-checked (statement 4) before running.

| # | SQL (abridged) | Result | rows_read |
|---|---|---|---|
| 1 | `SELECT (SELECT MAX(id) FROM fund_holdings_monthly), (SELECT MAX(rowid) FROM entity_isin_map), (SELECT COUNT(*) FROM fund_entity_link), (SELECT COUNT(*) FROM entity_merge_redirect), (SELECT COUNT(*) FROM etf_master)` | 1st try: code 10000 (0 rows). Retry after 30 s: fhm max id 783,117 · eim max rowid 37,405 · fel 264 · redirects 1,862 · etf_master 264 | 2,392 |
| 2 | `SELECT report_month, COUNT(*), SUM/AVG/MAX(holdings_count), MIN/MAX(filing_date) FROM fund_snapshot_monthly GROUP BY report_month` | 16 months, 2025-05..2026-08. 2026-04: 70 funds / 67,387 holdings · 05: 56 / 74,823 · 06: 51 / 39,427 · 07: 24 / 16,011 · 08: 6 / 9,271 (2026-03: 101 / 87,240) | 1,408 |
| 3 | Latest month per series (`fund_snapshot_monthly` + `etf_master`), grouped by latest month: ETFs, sum, max holdings, max ticker | 241 ETFs. Latest 2026-01: 1 (IYLD) · 02: 10 · 03: 50 · 04: 46 · 05: 53 (AGG 13,269) · 06: 51 (BND 17,409 = max) · 07: 24 · 08: 6 | 1,931 |
| 4 | `EXPLAIN QUERY PLAN` of the proposed look-through (SPY) | SEARCH etf_master PK · SEARCH fhm `idx_holdings_status_series_month` · iem PK autoindex · redirect rowid · temp B-tree GROUP BY. No SCAN | 0 |
| 5 | Look-through summary for SPY + QQQ | Neither has stored complete holdings (month NULL) → used as the unsupported-input case T5 | 21 |
| 6 | Look-through summary for VXUS + EEM (correlated-MAX month form): tiers, shared entities, top shared | VXUS 2026-04 / EEM 2026-02. Tier weights: EEM heuristic 65.881 · isin 18.953 · openfigi 7.777 · cusip 2.651 · unmapped 6.403 · no-id −0.153. VXUS isin 53.447 · heuristic 22.722 · openfigi 10.661 · cusip 6.785 · unmapped 5.224 · no-id 2.524. Shared entities 975, Σmin 25.634. Top: TSMC 3.928/13.141, Samsung 1.854/6.767 (both heuristic). **Rows: 104,559, because the correlated MAX read every month** | 104,559 |
| 7 | Same look-through for EEM with the month resolved by `ORDER BY report_month DESC LIMIT 1` | 1,231 holdings · 1,042 mapped · 1,003 entities · 2026-02 · 6 ms | 3,320 |
| 8 | `SELECT key, value FROM holdings_pipeline_state WHERE key LIKE 'writes_today%' ORDER BY key DESC LIMIT 30` | Sundays ≈ 70–84k (one 98.7k on 23 Aug), Mondays ≈ 32–37k; other days are not recorded in these counters | 30 |

**Total: 8 statements (+1 retry of #1), 113,661 rows read** (cap 150,000). No second 10000, no other auth error.

## 3 Deviations and gaps
- **Task path:** the Task names `App/Corporate Atlas/entities-api.js`; the file is at `App/Corporate Atlas/src/entities-api.js`. I read it there.
- **Statement 5 was spent on two ETFs with no stored holdings (SPY, QQQ).** It is useful as the unsupported case, but it cost one statement.
- **Statement 6 read 104,559 rows**, more than planned, because of the correlated MAX. It is within budget, but it is why the `entity_isin_map` duplicate-ISIN count (≈ 37k rows) and a BND measurement were **not run**. Both are estimated, not measured:
  - BND ≈ 60k uncached reads;
  - ISIN fan-out size unknown. The defect itself is shown from the schema (PK `isin, lei`).
- **Unmeasured:**
  - the D1 row-write multiplier for `entity_exposure_monthly` (index writes), so the back-fill range is 20k–200k;
  - Tue–Thu write load from enrich and boost (not in these counters);
  - Worker CPU time for VXUS and BND bodies (W1 measures it).
- **SA1 said holdings keep "2 months".** Measured: 16 months are stored. The decided "two stored months" comparison limit is kept as a product rule (spec §5.1).
- **Release branch:** CLAUDE.md says the Pages source is `October-2026`, while LOCAL_MASTER is on `November-2026`. The spec's C-2 says "the Pages source branch named in CLAUDE.md at release time" and does not choose one.
- `/write-spec`: I did not invoke the skill; I followed the Task's own 11-section structure, which is more specific than the skill's template.

## 4 Boundaries kept
- **Statements:** only SELECT / EXPLAIN QUERY PLAN, from the repo root with `--remote`, no `-c`. No D1 writes or DDL; `gate3-exposure.js` and other pipelines not run.
- **Not done:** no deploys, no secrets or `.env*` read, no git writes (read-only listing only), no LaunchAgents or cron, no npm installs, no subagents.
- **Files written:** only `claude/specs/MA-NOV-EXP_Spec.md` (the `claude/specs/` folder was created for it) and this report. Scratch SQL helper files sit in the session scratchpad, outside the repo.
- **Not touched:** Status, board, Tower, `config.json`, `transitions.jsonl`, logs and LANE_OPENER files. `13F Seed/gleif-seed.js` not opened. No token printed.
