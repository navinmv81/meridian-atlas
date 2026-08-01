-- Meridian Atlas — Phase 0
-- etf_master D1 schema
-- Run: wrangler d1 execute meridian-etf --file=schema.sql

CREATE TABLE IF NOT EXISTS etf_master (
  ticker           TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  issuer           TEXT,
  asset_class      TEXT,
  index_name       TEXT,
  cik              TEXT,
  series_id        TEXT,
  has_nport        INTEGER NOT NULL DEFAULT 1,
  net_assets       REAL,
  coverage_status  TEXT NOT NULL DEFAULT 'directory',
  last_filing_date TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_etf_master_issuer   ON etf_master(issuer);
CREATE INDEX IF NOT EXISTS idx_etf_master_coverage ON etf_master(coverage_status);
CREATE INDEX IF NOT EXISTS idx_etf_master_nport    ON etf_master(has_nport);
