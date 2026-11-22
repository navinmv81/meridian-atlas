-- MA-NOV-BOND · BOND-CR2 rollback — drops the two tables created by ma-nov-bond-cr2.sql.
-- Change Request: claude/specs/MA-NOV-BOND_CR.md. WRITTEN, NOT RUN.
-- Nothing references these tables (no foreign key, view or trigger); the API and UI treat a missing table as
-- "Not read yet" (code check in U9), so dropping them never breaks the bond page.
-- For a partial rollback of one offering run, use that run's generated rollback file instead
-- (DELETE … WHERE parser_version = ? AND accession_number IN (…)) and keep the tables.
--   wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-cr2-rollback.sql"

DROP TABLE IF EXISTS bond_offering_party;
DROP TABLE IF EXISTS bond_offering_fact;
