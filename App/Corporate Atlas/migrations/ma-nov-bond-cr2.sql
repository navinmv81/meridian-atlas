-- MA-NOV-BOND · BOND-CR2 — offering facts + parties tables (Entities domain). Spec v2 §7 (decision 6, NML-1122-2).
-- Change Request: claude/specs/MA-NOV-BOND_CR.md (packet MA-NOV-BOND.CR). Owner: Data-Identity Lead.
-- Sole writer: App/Corporate Atlas/bonds/bonds-ingest.mjs. WRITTEN, NOT RUN.
-- Applied by U8 BOND.VERIFY (write approval 2, Sat 28 after 08:00Z), separately from CR1:
--   wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql"
-- WITHOUT ROWID, primary key only, no secondary index: every read is a PK-prefix range on accession_number.
-- No row = "Not read yet". (accession_number, tranche_seq) matches bond_issuance; no foreign key (D1 practice, 008).
-- `field` and `party` role vocabularies: spec v2 §3 / §4.1. `field` is enforced by the extractor, not a CHECK, so a
-- new field never needs a table rebuild. value_text ≤ 300 characters is enforced here (spec v2 §8).
-- Rollback: ma-nov-bond-cr2-rollback.sql (nothing references these tables).

CREATE TABLE IF NOT EXISTS bond_offering_fact (
  accession_number TEXT NOT NULL,
  tranche_seq      INTEGER NOT NULL,          -- 0 = whole offering; 1..n = the bond_issuance tranche
  field            TEXT NOT NULL,             -- closed list, spec v2 §3; role-group states use 'parties.<role>'
  state            TEXT NOT NULL CHECK (state IN ('disclosed','not_disclosed','not_applicable')),
  value_text       TEXT NULL CHECK (value_text IS NULL OR length(value_text) <= 300),
  value_num        REAL NULL,
  value_date       TEXT NULL,
  source_doc       TEXT NOT NULL CHECK (source_doc IN ('424b','fwp')),
  source_url       TEXT NOT NULL,
  source_part      TEXT NOT NULL,
  source_heading   TEXT NULL,
  source_anchor    TEXT NULL,
  source_page      TEXT NULL,
  char_offset      INTEGER NULL,
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, tranche_seq, field)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS bond_offering_party (
  accession_number TEXT NOT NULL,
  party_seq        INTEGER NOT NULL,
  tranche_seq      INTEGER NOT NULL DEFAULT 0, -- 0 = all tranches
  party_name       TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('bookrunner','co_manager','underwriter','agent','trustee','guarantor','other')),
  role_printed     TEXT NULL,
  source_doc       TEXT NOT NULL CHECK (source_doc IN ('424b','fwp')),
  source_url       TEXT NOT NULL,
  source_part      TEXT NOT NULL,
  source_page      TEXT NULL,
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, party_seq)
) WITHOUT ROWID;
