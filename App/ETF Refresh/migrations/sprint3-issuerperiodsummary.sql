-- Sprint 3: issuerperiodsummary (Filings/Equities domain, Derived/Cache)
-- Latest annual (10-K) and latest quarterly (10-Q) value per issuer per
-- XBRL tag, plus derived net margin, sourced from financialfact_reported
-- only. Retention is enforced by INSERT OR REPLACE on the UNIQUE
-- constraint (2 rows per issuer per tag), not a time-based prune.
--
-- financialfact_reported has overlapping and duplicate period_end values
-- across filings (restatements/amendments) — 2,732 (cik, xbrl_tag,
-- period_end) groups span both 10-K and 10-Q, and 2,896 (cik, xbrl_tag,
-- period_end, form_type) groups have outright duplicate rows. Population
-- must select, per (cik, xbrl_tag, period_type), the row with the latest
-- period_end and break ties with the latest filed_date — not just
-- MAX(period_end) alone.

CREATE TABLE IF NOT EXISTS issuerperiodsummary (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cik          TEXT NOT NULL,
  entity_id    INTEGER,
  xbrl_tag     TEXT NOT NULL,
  period_type  TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  value        REAL,
  unit         TEXT,
  filed_date   TEXT,
  net_margin   REAL,
  UNIQUE(cik, xbrl_tag, period_type)
);
-- Note: idx_ips_cik dropped — UNIQUE(cik, xbrl_tag, period_type) already
-- creates an index with cik as leading column, covering all lookup patterns.
