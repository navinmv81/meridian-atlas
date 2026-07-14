-- Sprint 3: managerissuerpositionquarterly (13F domain, Derived/Cache)
-- Precomputed QoQ manager-issuer position deltas, sourced from
-- holding13f_normalized only. Retention: 8 quarters rolling.
--
-- Grain is (cik, cusip, put_call, report_period) — NOT (cik, cusip,
-- report_period). put_call distinguishes a common-stock position from an
-- options position (call/put) reported against the same underlying CUSIP;
-- collapsing on cusip alone conflates the two. put_call defaults to ''
-- rather than NULL so the UNIQUE constraint actually enforces uniqueness
-- (SQLite treats NULL != NULL in UNIQUE checks) — population inserts must
-- coalesce NULL put_call to '' accordingly.
--
-- Population must also resolve amendments: some (cik, report_period) pairs
-- have both an original 13F-HR and a 13F-HR/A in filing13f, both parsed
-- into holding13f_normalized. Pick the row set from the filing with the
-- latest filing_date per (cik, report_period) — do not sum across
-- original + amendment.

CREATE TABLE IF NOT EXISTS managerissuerpositionquarterly (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  cik               TEXT NOT NULL,
  cusip             TEXT NOT NULL,
  put_call          TEXT NOT NULL DEFAULT '',
  entity_id         INTEGER,
  issuer_name       TEXT,
  report_period     TEXT NOT NULL,
  market_value      REAL,
  share_count       INTEGER,
  prev_market_value REAL,
  prev_share_count  INTEGER,
  value_change      REAL,
  share_change      INTEGER,
  track             TEXT,
  UNIQUE(cik, cusip, put_call, report_period)
);
CREATE INDEX IF NOT EXISTS idx_mqp_cik_period
  ON managerissuerpositionquarterly(cik, report_period);
CREATE INDEX IF NOT EXISTS idx_mqp_cusip_period
  ON managerissuerpositionquarterly(cusip, report_period);
