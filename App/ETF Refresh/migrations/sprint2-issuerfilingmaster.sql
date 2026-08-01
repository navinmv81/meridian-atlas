-- Sprint 2: issuerfilingmaster (Filings domain, owned by Equities Lead)
-- Filing metadata for 10-K, 10-Q, 8-K, sourced from SEC EDGAR submissions API.
-- Populated by seed-issuerfilingmaster.js (local script, see 13F Seed/).
--
-- Index creation is deliberately deferred until after the bulk backfill
-- completes, to avoid the write multiplier during initial ingestion.
-- Run this separately once the backfill is confirmed under the daily
-- D1 write budget:
--
--   CREATE INDEX IF NOT EXISTS idx_issuerfilingmaster_cik_form
--     ON issuerfilingmaster(cik, form_type);

CREATE TABLE IF NOT EXISTS issuerfilingmaster (
  accession_number  TEXT PRIMARY KEY,
  cik               TEXT NOT NULL,
  form_type         TEXT NOT NULL,
  filed_date        TEXT,
  period_of_report  TEXT,
  primary_document  TEXT
);
