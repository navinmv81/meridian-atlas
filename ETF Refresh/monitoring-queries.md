# Meridian Atlas — Pipeline & Storage Monitoring Queries

Run all commands from the project root with the Wrangler CLI.
Database: `meridian-etf`

---

## Section 1 — Storage Health Check

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT
  (SELECT COUNT(*) FROM fund_holdings_monthly)     AS holdings_rows,
  (SELECT COUNT(*) FROM fund_snapshot_monthly)     AS snapshot_rows,
  (SELECT COUNT(*) FROM etf_master)                AS etf_master_rows,
  (SELECT COUNT(*) FROM edgar_bootstrap_progress)  AS bootstrap_progress_rows,
  ROUND(
    (SELECT COUNT(*) FROM fund_holdings_monthly) * 200.0 / 1048576,
    1
  ) AS estimated_holdings_mb;"
```

> **Warning threshold:** Investigate if `fund_holdings_monthly` exceeds
> 10,000,000 rows (~2 GB estimated). Consider Option C fund type filtering
> at that point.

---

## Section 2 — Pipeline Progress Check

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT
  report_month,
  COUNT(DISTINCT series_id) AS etfs_complete_this_month
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
GROUP BY report_month
ORDER BY report_month DESC;

SELECT
  COUNT(DISTINCT series_id) AS etfs_with_2plus_months
FROM (
  SELECT series_id
  FROM fund_holdings_monthly
  WHERE snapshot_status = 'complete'
  GROUP BY series_id
  HAVING COUNT(DISTINCT report_month) >= 2
);

SELECT
  (SELECT COUNT(DISTINCT series_id)
   FROM etf_master
   WHERE has_nport = 1
     AND series_id IS NOT NULL
     AND LOWER(coverage_status) = 'deep')          AS eligible_etfs_in_master,
  (SELECT COUNT(DISTINCT series_id)
   FROM fund_holdings_monthly
   WHERE snapshot_status = 'complete')             AS etfs_with_complete_holdings,
  ROUND(
    100.0 *
    (SELECT COUNT(DISTINCT series_id)
     FROM fund_holdings_monthly
     WHERE snapshot_status = 'complete') /
    NULLIF(
      (SELECT COUNT(DISTINCT series_id)
       FROM etf_master
       WHERE has_nport = 1
         AND series_id IS NOT NULL
         AND LOWER(coverage_status) = 'deep'),
      0
    ),
    1
  ) AS pipeline_completion_pct;"
```

---

## Section 3 — Multi-Month Readiness Check

*(Phase B and C readiness signal — run weekly until 10+ ETFs qualify)*

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT
  series_id,
  COUNT(DISTINCT report_month)  AS months_loaded,
  MIN(report_month)             AS earliest_month,
  MAX(report_month)             AS latest_month,
  GROUP_CONCAT(report_month, ', ') AS month_list
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
GROUP BY series_id
HAVING COUNT(DISTINCT report_month) >= 2
ORDER BY months_loaded DESC, series_id ASC;

SELECT COUNT(DISTINCT series_id) AS etfs_qualifying_for_phase_bc
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
GROUP BY series_id
HAVING COUNT(DISTINCT report_month) >= 2;"
```

---

## Section 4 — Data Quality Check

*(Run before implementing any Phase B–E feature)*

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT
  COUNT(*) AS bad_security_name_rows
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
  AND (security_name = 'N/A' OR security_name IS NULL);

SELECT
  COUNT(DISTINCT security_name) AS blackrock_cash_name_variants
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
  AND LOWER(security_name) LIKE '%blackrock%'
  AND LOWER(security_name) LIKE '%cash%';

SELECT
  COUNT(DISTINCT s.series_id) AS snapshot_only_series
FROM fund_snapshot_monthly s
WHERE NOT EXISTS (
  SELECT 1
  FROM fund_holdings_monthly h
  WHERE h.series_id = s.series_id
    AND h.snapshot_status = 'complete'
);"
```

---

## Section 5 — Run Schedule

Run **Section 1** monthly.

Run **Sections 2 and 3** weekly until Phase C is buildable
(10+ ETFs with 2+ months of complete holdings data).

Run **Section 4** before implementing any Phase B–E feature.

---

## Section 6 — Daily health check
Run this after any pipeline change or deployment.

### 6a — universe_changes_monthly population status

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT current_month) as distinct_month_pairs,
  COUNT(DISTINCT change_type) as change_types_present,
  MAX(computed_at) as last_computed
FROM universe_changes_monthly;"
```

Expected when healthy:
- `total_rows > 0` after first pipeline cron post-deployment
- `change_types_present = 4` (new_position, exited, increased, decreased)
- `last_computed` within last 48 hours

### 6b — Read budget consumption estimate

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT
  COUNT(*) as total_holdings_rows,
  COUNT(DISTINCT series_id) as distinct_etfs,
  COUNT(DISTINCT report_month) as distinct_months
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete';"
```

Use this to manually estimate query costs:
- universe-changes endpoint: ~200 rows per call (fixed)
- etf-changes endpoint: ~2000 rows per call (monitor)
- Danger threshold: any endpoint exceeding 500k rows per call needs pre-computation treatment

### 6c — Pipeline write rate check

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT 
  report_month,
  COUNT(DISTINCT series_id) as etfs_complete,
  COUNT(*) as holdings_rows
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
GROUP BY report_month
ORDER BY report_month DESC;"
```

Warning: if total `holdings_rows` across all months exceeds 1,000,000 review write rate before increasing `REPORT_MONTH_LOOKBACK`.

### 6d — Write guard status check

```bash
wrangler d1 execute meridian-etf --remote --command="
SELECT key, value 
FROM holdings_pipeline_state
WHERE key LIKE 'writes_today_%'
ORDER BY key DESC
LIMIT 7;"
```

Expected when healthy:
- One row per day showing cumulative writes
- Values should stay below 80,000
- If `last_run_status` shows `write_limit` — the guard fired and protected the budget that day

### Section 6 run schedule
Run **6a** daily while `universe_changes_monthly` is newly deployed — confirm it populates within 24 hours of the next pipeline cron cycle.
Run **6b** and **6c** weekly alongside Section 2 checks.
Run **6d** daily while the pipeline is actively ingesting new ETFs.
