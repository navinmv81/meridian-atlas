-- Sprint 2: financialfact_reported (Filings domain, owned by Equities Lead)
-- Point-in-time XBRL facts extracted from 10-K/10-Q via SEC EDGAR
-- companyfacts API. Populated by seed-financialfact.js (local script, see
-- 13F Seed/).
--
-- Index creation is deliberately deferred until after the bulk backfill
-- completes, to avoid the write multiplier during initial ingestion. Run
-- this separately once the backfill is confirmed under the daily D1 write
-- budget:
--
--   CREATE INDEX IF NOT EXISTS idx_financialfact_cik_tag
--     ON financialfact_reported(cik, xbrl_tag);

CREATE TABLE IF NOT EXISTS financialfact_reported (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id        INTEGER,
  cik              TEXT NOT NULL,
  xbrl_tag         TEXT NOT NULL,
  value            REAL,
  unit             TEXT,
  period_end       TEXT,
  filed_date       TEXT,
  form_type        TEXT,
  accession_number TEXT,
  UNIQUE(cik, xbrl_tag, period_end, accession_number)
);
