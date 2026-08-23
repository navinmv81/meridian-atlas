-- MA-SEP-003: firds_instrument_reference
-- Table class: Core — Entities (per Storage Strategy v1: fetched from an external
-- authoritative source (ESMA), not rebuilt from another internal table — same
-- classification logic as entity_master, which is Core because it's GLEIF-sourced.)
-- Exact DDL per claude/MA-SEP-003_Spec.md "Proposed Schema Change" — do not
-- deviate from this column set without flagging back to the Founder first.

CREATE TABLE IF NOT EXISTS firds_instrument_reference (
  isin              TEXT PRIMARY KEY,
  lei               TEXT,                 -- issuer LEI, as published by FIRDS
  cfi_code          TEXT NOT NULL,        -- full 6-char CFI, first letter = 'C'
  full_name         TEXT,
  short_name        TEXT,
  notional_currency TEXT,
  trading_venue_mic TEXT,                 -- nullable; instrument may trade on multiple venues, first/primary only in v1
  first_trade_date  TEXT,
  publication_date  TEXT NOT NULL,        -- FIRDS record's own reference date
  source_file       TEXT,                 -- FULINS filename this row was last confirmed in, for traceability
  first_seen_at     TEXT DEFAULT (datetime('now')),
  last_updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_firds_lei ON firds_instrument_reference(lei);
