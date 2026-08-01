-- Corporate Atlas v1 Schema Migration
-- Additive only. No changes to existing ETF tables.
-- All statements use IF NOT EXISTS — safe to re-run.

-- 1. Entity master
CREATE TABLE IF NOT EXISTS entity_master (
  entity_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN ('operating','holding','fund','manager','government','spv')),
  lei              TEXT NULL,
  lei_status       TEXT NULL,
  country          TEXT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_name, type)
);

-- 2. Entity relationships
CREATE TABLE IF NOT EXISTS entity_relationships (
  parent_entity_id  INTEGER NOT NULL,
  child_entity_id   INTEGER NOT NULL,
  relationship_type TEXT NOT NULL CHECK(relationship_type IN ('legal_parent','fund_manager','umbrella_fund','peer')),
  source            TEXT NOT NULL CHECK(source IN ('gleif','etf_universe','manual')),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_entity_id, child_entity_id, relationship_type)
);

-- 3. ETF to entity link
CREATE TABLE IF NOT EXISTS fund_entity_link (
  etf_symbol   TEXT PRIMARY KEY,
  series_id    TEXT NULL,
  entity_id    INTEGER NOT NULL,
  source       TEXT NOT NULL DEFAULT 'auto',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Instrument master
CREATE TABLE IF NOT EXISTS instrument_master (
  instrument_key   TEXT PRIMARY KEY,
  security_name    TEXT NOT NULL,
  security_ticker  TEXT NULL,
  isin             TEXT NULL,
  cusip            TEXT NULL,
  cusip_issuer_6   TEXT NULL,
  asset_cat        TEXT NULL,
  country          TEXT NULL,
  first_seen_date  DATE NOT NULL
);

-- 5. Instrument to issuer entity map
CREATE TABLE IF NOT EXISTS instrument_entity_map (
  instrument_key  TEXT PRIMARY KEY,
  entity_id       INTEGER NOT NULL,
  source          TEXT NOT NULL CHECK(source IN ('cusip_tier1','isin_tier1','heuristic')),
  confidence      INTEGER NOT NULL CHECK(confidence BETWEEN 1 AND 100),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Pre-computed entity exposure facts
CREATE TABLE IF NOT EXISTS entity_exposure_monthly (
  report_month      TEXT NOT NULL,
  entity_id         INTEGER NOT NULL,
  holder_entity_id  INTEGER NOT NULL,
  weight_sum        REAL NOT NULL,
  aum_weighted      REAL NULL,
  computed_at       DATETIME NOT NULL,
  PRIMARY KEY (report_month, entity_id, holder_entity_id)
);

-- 7. Exposure coverage denominator
CREATE TABLE IF NOT EXISTS fund_exposure_coverage (
  report_month      TEXT NOT NULL,
  holder_entity_id  INTEGER NOT NULL,
  total_weight      REAL NOT NULL,
  mapped_weight     REAL NOT NULL,
  computed_at       DATETIME NOT NULL,
  PRIMARY KEY (report_month, holder_entity_id)
);

-- 8. GLEIF enrichment queue
CREATE TABLE IF NOT EXISTS entity_enrichment_queue (
  entity_id      INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  country_hint   TEXT NULL,
  type_hint      TEXT NULL,
  isin_hint      TEXT NULL,
  lookup_method  TEXT NULL CHECK(lookup_method IN ('isin','name_search',NULL)),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','in_progress','complete','failed')),
  retry_after    DATETIME NULL,
  last_attempt   DATETIME NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entity_master_type       ON entity_master(type);
CREATE INDEX IF NOT EXISTS idx_entity_master_lei        ON entity_master(lei);
CREATE INDEX IF NOT EXISTS idx_entity_master_normalized ON entity_master(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entity_rel_child         ON entity_relationships(child_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rel_parent        ON entity_relationships(parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_instrument_isin          ON instrument_master(isin);
CREATE INDEX IF NOT EXISTS idx_instrument_cusip6        ON instrument_master(cusip_issuer_6);
CREATE INDEX IF NOT EXISTS idx_exposure_entity          ON entity_exposure_monthly(entity_id, report_month);
CREATE INDEX IF NOT EXISTS idx_exposure_holder          ON entity_exposure_monthly(holder_entity_id, report_month);
CREATE INDEX IF NOT EXISTS idx_enrich_queue_status      ON entity_enrichment_queue(status, retry_after);
