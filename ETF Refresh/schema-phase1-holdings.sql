-- Monthly fund-level snapshot (one row per ETF per month)
CREATE TABLE IF NOT EXISTS fund_snapshot_monthly (
  series_id        TEXT NOT NULL,
  report_month     TEXT NOT NULL,  -- 'YYYY-MM' e.g. '2026-01'
  ticker           TEXT,
  net_assets       REAL,
  total_assets     REAL,
  total_liabilities REAL,
  holdings_count   INTEGER,
  monthly_return_1 REAL,           -- most recent month return %
  monthly_return_2 REAL,
  monthly_return_3 REAL,
  derivatives_flag INTEGER DEFAULT 0,
  securities_lending_flag INTEGER DEFAULT 0,
  filing_date      TEXT,
  period_end       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (series_id, report_month)
);

-- Monthly holdings (one row per ETF per holding per month)
CREATE TABLE IF NOT EXISTS fund_holdings_monthly (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id        TEXT NOT NULL,
  report_month     TEXT NOT NULL,  -- 'YYYY-MM'
  ticker           TEXT,
  security_name    TEXT,
  cusip            TEXT,
  isin             TEXT,
  security_ticker  TEXT,           -- ticker of the held security (if equity)
  position_value   REAL,
  weight_pct       REAL,
  shares           REAL,
  asset_cat        TEXT,           -- EC, DBT, ABS, MBS, STIV, OPT, FUT, FWD, OTHER
  issuer_country   TEXT,
  is_restricted    INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pipeline run tracking
CREATE TABLE IF NOT EXISTS holdings_pipeline_state (
  key              TEXT PRIMARY KEY,
  value            TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO holdings_pipeline_state (key, value) VALUES
  ('last_full_run',     ''),
  ('etfs_processed',    '0'),
  ('last_run_status',   'never_run'),
  ('etf_offset',        '0');

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_holdings_series_month
  ON fund_holdings_monthly(series_id, report_month);
CREATE INDEX IF NOT EXISTS idx_holdings_security
  ON fund_holdings_monthly(security_ticker, report_month);
CREATE INDEX IF NOT EXISTS idx_holdings_cusip
  ON fund_holdings_monthly(cusip, report_month);
CREATE INDEX IF NOT EXISTS idx_snapshot_series
  ON fund_snapshot_monthly(series_id, report_month);
