-- MA-NOV-BOND · BOND-CR1 rollback — drops the three columns added by ma-nov-bond-cr1.sql.
-- Change Request: claude/specs/MA-NOV-BOND_CR.md. WRITTEN, NOT RUN.
-- Order: if fix2-apply-run1.sql was applied, run bonds/apply/fix2-rollback-run1.sql FIRST (it restores the
-- prior values and nulls the CR1 columns), then this file. Running this file alone keeps the 1.3.1 values and
-- only loses the reasons, notes and draft links.
--   wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-cr1-rollback.sql"
-- DROP COLUMN is allowed: none of the three columns is in a PRIMARY KEY, UNIQUE, CHECK, index (incl. the partial
-- index WHERE clause), view, trigger or foreign key. SQLite rewrites the table on DROP COLUMN: ≈ 943 row-writes
-- per statement at today's size (≈ 2,830 for all three) — budget for it.
-- Rehearsed locally (MA-NOV-BOND.CR): after this file the table's CREATE statement and every row are identical to
-- the pre-CR1 state.

ALTER TABLE bond_issuance DROP COLUMN status_note;
ALTER TABLE bond_issuance DROP COLUMN superseded_by;
ALTER TABLE bond_issuance DROP COLUMN status_reason;
