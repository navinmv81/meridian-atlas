-- MA-NOV-BOND · BOND-CR1 — three nullable columns on bond_issuance (Entities domain).
-- Change Request: claude/specs/MA-NOV-BOND_CR.md (packet MA-NOV-BOND.CR). Spec v1 §5; FIX2 report §7.
-- Owner: Data-Identity Lead. Sole writer: App/Corporate Atlas/bonds/bonds-ingest.mjs (as 008).
-- WRITTEN, NOT RUN. Applied by U6 BOND.APPLY1 after the Founder's write approval 1, BEFORE fix2-apply-run1.sql:
--   wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql"
-- Additive: ADD COLUMN with a NULL default changes the schema only and rewrites no row (≈ 0 row-writes).
-- No index, no CHECK, no default: the columns can be dropped again (rollback: ma-nov-bond-cr1-rollback.sql).
--
--   status_reason  reason code on every non-final row (spec v1 §5 list); NULL on finals ("partial" stays derived).
--   superseded_by  accession_number of the final that replaces a draft; set on drafts only.
--   status_note    short plain note the UI may show, e.g. "tranche dropped at pricing" (F2b) or the
--                  term-sheet allocation note (F5). Not written by fix2-apply-run1.sql; filled by a later run.

ALTER TABLE bond_issuance ADD COLUMN status_reason TEXT NULL;
ALTER TABLE bond_issuance ADD COLUMN superseded_by TEXT NULL;
ALTER TABLE bond_issuance ADD COLUMN status_note TEXT NULL;
