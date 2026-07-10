-- Sprint 2: issuereventstream (Filings domain, owned by Equities Lead)
-- Priority 8-K item-code events (1.01, 2.02, 5.02, 8.01), derived from
-- SEC EDGAR submissions API `items` field, joined against 8-K rows already
-- backfilled in issuerfilingmaster. Populated by seed-issuereventstream.js
-- (local script, see 13F Seed/).
--
-- Index creation is deliberately deferred until after the bulk backfill
-- completes, to avoid the write multiplier during initial ingestion. Run
-- this separately once the backfill is confirmed under the daily D1 write
-- budget:
--
--   CREATE INDEX IF NOT EXISTS idx_issuereventstream_cik
--     ON issuereventstream(cik, filed_date DESC);

CREATE TABLE IF NOT EXISTS issuereventstream (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cik              TEXT NOT NULL,
  entity_id        INTEGER,
  accession_number TEXT NOT NULL,
  item_code        TEXT NOT NULL,
  item_label       TEXT,
  filed_date       TEXT,
  period_of_report TEXT,
  UNIQUE(accession_number, item_code)
);
