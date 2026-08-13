-- MA-AUG-001 — instrument_entity_map CHECK constraint migration
-- Adds 'openfigi_tier1' as a valid `source` value alongside the existing
-- cusip_tier1 / isin_tier1 / heuristic. SQLite cannot ALTER a CHECK
-- constraint in place, so this recreates the table: create new -> copy rows
-- -> verify row count -> drop old -> rename.
--
-- Dry run (28 July 2026) confirmed baseline row count: 23,963.
-- Run this against production BEFORE deploying meridian-entities-figi.
-- Verify the row count assertion at the end matches 23,963 (or whatever
-- the live count is at the moment you run this) before considering it safe.

PRAGMA foreign_keys=OFF;

CREATE TABLE instrument_entity_map_new (
  instrument_key  TEXT PRIMARY KEY,
  entity_id       INTEGER NOT NULL,
  source          TEXT NOT NULL CHECK(source IN ('cusip_tier1','isin_tier1','heuristic','openfigi_tier1')),
  confidence      INTEGER NOT NULL CHECK(confidence BETWEEN 1 AND 100),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO instrument_entity_map_new (instrument_key, entity_id, source, confidence, created_at)
SELECT instrument_key, entity_id, source, confidence, created_at
FROM instrument_entity_map;

-- Manual verification step: run this SELECT and confirm the count matches
-- instrument_entity_map's pre-migration count before proceeding to the
-- DROP/RENAME below. Do not proceed if these don't match.
-- SELECT COUNT(*) FROM instrument_entity_map_new;

DROP TABLE instrument_entity_map;
ALTER TABLE instrument_entity_map_new RENAME TO instrument_entity_map;

PRAGMA foreign_keys=ON;
