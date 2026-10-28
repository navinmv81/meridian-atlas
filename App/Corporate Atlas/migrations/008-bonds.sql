-- MA-OCT-008 — SEC corporate-bond ingestion: tables and indexes (spec rev 1.2 §8,
-- bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3; folder CR MA-OCT-008-CR1).
-- Domain: Entities/instrument. Sole inserter: App/Corporate Atlas/bonds/bonds-ingest.mjs.
-- 013 repoints bond_issuer_link.entity_id under rule S1. 009 reads only.
--
-- Apply (§15.3 step 3) in a non-freeze window, then plan checks P-B1..P-B3 (AC10):
--   wrangler d1 execute meridian-etf --remote -c wrangler-entities-enrich.toml --file migrations/008-bonds.sql
-- Rollback (§15.4): DROP TABLE bond_issuance; DROP TABLE bond_issuer_link;  (nothing else references them)

CREATE TABLE IF NOT EXISTS bond_issuer_link (
  cik            TEXT PRIMARY KEY,
  entity_id      INTEGER NULL,
  link_method    TEXT NOT NULL CHECK (link_method IN ('cik','lei','manual','unmatched')),
  confidence     INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 100),
  issuer_name    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  linked_at      TEXT NOT NULL,
  verified_at    TEXT NULL,
  last_polled_at TEXT NULL,
  note           TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_bil_entity ON bond_issuer_link(entity_id) WHERE entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bond_issuance (
  accession_number TEXT NOT NULL,
  tranche_seq      INTEGER NOT NULL,
  cik              TEXT NOT NULL,
  instrument_key   TEXT NULL,
  isin TEXT NULL, cusip TEXT NULL,
  form_type        TEXT NOT NULL,
  filing_date      TEXT NOT NULL,
  filing_status    TEXT NOT NULL CHECK (filing_status IN ('final','preliminary','skipped_non_debt','skipped_structured','skipped_other','parse_failed')),
  tranche_label    TEXT NULL,
  security_class   TEXT NULL,
  rate_type        TEXT NULL CHECK (rate_type IN ('fixed','floating','fixed_to_floating') OR rate_type IS NULL),
  coupon_rate      REAL NULL, spread_bps INTEGER NULL, benchmark TEXT NULL,
  principal_amount REAL NULL, currency TEXT NOT NULL DEFAULT 'USD',
  maturity_date    TEXT NULL, seniority TEXT NULL,
  source_url       TEXT NOT NULL,
  parse_confidence INTEGER NOT NULL CHECK (parse_confidence BETWEEN 0 AND 100),
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, tranche_seq),
  CHECK (filing_status <> 'final' OR maturity_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_bi_cik_final_key ON bond_issuance(cik, maturity_date, accession_number, tranche_seq)
  WHERE filing_status = 'final';
CREATE INDEX IF NOT EXISTS idx_bi_instrument   ON bond_issuance(instrument_key) WHERE instrument_key IS NOT NULL;
