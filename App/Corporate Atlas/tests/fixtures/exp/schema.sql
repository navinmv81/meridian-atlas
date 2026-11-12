-- MA-NOV-EXP.W1 route-test schema: only the columns R-EXP1 and /etf-exposure read.
-- Sources: App/ETF Refresh/schema.sql (etf_master), App/ETF Refresh/schema-phase1-holdings.sql
-- (fund_snapshot_monthly, fund_holdings_monthly + snapshot_status), migrations/corporate-atlas-v1.sql
-- (entity_master, fund_entity_link, entity_exposure_monthly, idx_exposure_entity),
-- migrations/002-instrument-entity-map-openfigi-source.sql (instrument_entity_map),
-- migrations/ma-oct-013-entity-merge-redirect.sql (entity_merge_redirect).
-- entity_isin_map (PK isin, lei) is present ONLY to prove the route ignores its fan-out (spec §3.2).

CREATE TABLE etf_master (
  ticker    TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  series_id TEXT
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
CREATE INDEX idx_holdings_status_series_month ON fund_holdings_monthly(snapshot_status, series_id, report_month);

CREATE TABLE entity_master (
  entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL
);

CREATE TABLE instrument_entity_map (
  instrument_key TEXT PRIMARY KEY,
  entity_id      INTEGER NOT NULL,
  source         TEXT NOT NULL CHECK(source IN ('cusip_tier1','isin_tier1','heuristic','openfigi_tier1')),
  confidence     INTEGER NOT NULL CHECK(confidence BETWEEN 1 AND 100)
);

CREATE TABLE entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT    NOT NULL,
  packet       TEXT    NOT NULL
);

CREATE TABLE entity_isin_map (
  isin      TEXT NOT NULL,
  lei       TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  PRIMARY KEY (isin, lei)
);

CREATE TABLE fund_entity_link (
  etf_symbol TEXT PRIMARY KEY,
  series_id  TEXT NULL,
  entity_id  INTEGER NOT NULL
);

CREATE TABLE entity_exposure_monthly (
  report_month     TEXT NOT NULL,
  entity_id        INTEGER NOT NULL,
  holder_entity_id INTEGER NOT NULL,
  weight_sum       REAL NOT NULL,
  computed_at      DATETIME NOT NULL,
  PRIMARY KEY (report_month, entity_id, holder_entity_id)
);
CREATE INDEX idx_exposure_entity ON entity_exposure_monthly(entity_id, report_month);
CREATE INDEX idx_exposure_holder ON entity_exposure_monthly(holder_entity_id, report_month);
