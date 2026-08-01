-- Sprint 3: supporting indexes for seed-managerpositions.js's current+prior-quarter
-- pre-filter on winning_filing/base (see the comment above buildPopulateSql in
-- seed-managerpositions.js).
--
-- Without these, `WHERE report_period IN (?, ?)` still forces a full table scan to
-- evaluate the predicate — D1 counts rows visited during a scan toward "rows read"
-- regardless of how many rows the predicate discards. The pre-filter only reduces
-- read cost if SQLite can seek directly to the matching rows via an index.
--
-- Idempotent (IF NOT EXISTS) — safe to apply even if one or both already exist.
-- Apply once, out of band, before relying on the reduced read-cost estimate.

CREATE INDEX IF NOT EXISTS idx_holding13f_normalized_report_period
  ON holding13f_normalized(report_period);

CREATE INDEX IF NOT EXISTS idx_filing13f_report_period
  ON filing13f(report_period);
