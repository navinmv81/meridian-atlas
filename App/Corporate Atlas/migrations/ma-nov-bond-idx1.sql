-- MA-NOV-REL.GO Part B — bond issuer-counts index (BOND.UI D-CR3). One DDL; additive; rollback: ma-nov-bond-idx1-rollback.sql
CREATE INDEX IF NOT EXISTS idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason);
