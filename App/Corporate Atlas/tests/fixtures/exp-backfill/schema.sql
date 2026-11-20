-- MA-NOV-EXP.BFS.BUILD test schema: the tables exp-backfill.js and Phase 1 read or write, as in the live DDL.
-- Sources: App/ETF Refresh/schema-phase1-holdings.sql (fund_snapshot_monthly, fund_holdings_monthly + snapshot_status,
-- holdings_pipeline_state), migrations/corporate-atlas-v1.sql (fund_entity_link, entity_exposure_monthly,
-- fund_exposure_coverage, entity_enrichment_queue), migrations/002-instrument-entity-map-openfigi-source.sql
-- (instrument_entity_map), migrations/ma-oct-013-entity-merge-redirect.sql (entity_merge_redirect).
-- The Ops tables (ops_job_registry, ops_job_pause) are loaded from App/Ops/migrations/002 and 003 by the test.

CREATE TABLE holdings_pipeline_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fund_snapshot_monthly (
  series_id      TEXT NOT NULL,
  report_month   TEXT NOT NULL,
  net_assets     REAL,
  holdings_count INTEGER,
  filing_date    TEXT,
  period_end     TEXT,
  PRIMARY KEY (series_id, report_month)
);

CREATE TABLE fund_holdings_monthly (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id       TEXT NOT NULL,
  report_month    TEXT NOT NULL,
  security_name   TEXT,
  cusip           TEXT,
  isin            TEXT,
  security_ticker TEXT,
  weight_pct      REAL,
  snapshot_status TEXT
);
CREATE INDEX idx_holdings_month ON fund_holdings_monthly(report_month);
CREATE INDEX idx_holdings_series_month ON fund_holdings_monthly(series_id, report_month);
CREATE INDEX idx_holdings_status_series_month ON fund_holdings_monthly(snapshot_status, series_id, report_month);

CREATE TABLE fund_entity_link (
  etf_symbol TEXT PRIMARY KEY,
  series_id  TEXT NULL,
  entity_id  INTEGER NOT NULL,
  source     TEXT NOT NULL DEFAULT 'auto',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE instrument_entity_map (
  instrument_key TEXT PRIMARY KEY,
  entity_id      INTEGER NOT NULL,
  source         TEXT NOT NULL,
  confidence     INTEGER NOT NULL
);

CREATE TABLE entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT NOT NULL,
  packet       TEXT NOT NULL
);

CREATE TABLE entity_exposure_monthly (
  report_month      TEXT NOT NULL,
  entity_id         INTEGER NOT NULL,
  holder_entity_id  INTEGER NOT NULL,
  weight_sum        REAL NOT NULL,
  aum_weighted      REAL NULL,
  computed_at       DATETIME NOT NULL,
  PRIMARY KEY (report_month, entity_id, holder_entity_id)
);
CREATE INDEX idx_exposure_entity ON entity_exposure_monthly(entity_id, report_month);
CREATE INDEX idx_exposure_holder ON entity_exposure_monthly(holder_entity_id, report_month);

CREATE TABLE fund_exposure_coverage (
  report_month      TEXT NOT NULL,
  holder_entity_id  INTEGER NOT NULL,
  total_weight      REAL NOT NULL,
  mapped_weight     REAL NOT NULL,
  computed_at       DATETIME NOT NULL,
  PRIMARY KEY (report_month, holder_entity_id)
);

CREATE TABLE entity_enrichment_queue (
  entity_id     INTEGER PRIMARY KEY,
  name          TEXT,
  type_hint     TEXT,
  isin_hint     TEXT,
  country_hint  TEXT,
  lookup_method TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  retry_after   TEXT,
  last_attempt  TEXT
);
