-- ent-cr1b-drop-duplicate-indexes.sql — MA-OCT-ENT-CR1 (rev 1, fb13ff3e…6c20) C2 + C3, applied Wed 28 Oct 2026
-- by LANE-1-ENG (MA-OCT-WED28.ENG1, Control v1 030b7feb…5b04), wrangler 4.96.0, D1 meridian-etf.
-- Repo DDL of record: ONLY the statements actually applied (AR-3). C1 is in ent-cr1-index-change.sql.
--
-- Gates (both met before each DROP): AR-2(b) d1-today rowsWritten <= 35,000 (read 99), and ML-1013-2
-- reading + own writes + 1.05 x N_im <= 100,000 (N_im = 73,006; 99 + 1 + 1,000 margin + 76,657 = 77,757).
-- C2 applied 19:50:18Z: measured rows_read 319, rows_written 1 (schema row only; not billed per entry).
-- C3 applied 19:50:46Z: measured rows_read 317, rows_written 1.
-- Verified: E6, E8, E8b now use idx_instrument_cusip6 and E7 uses idx_instrument_isin, with the same plan shapes;
-- E1-E5, E9, E10 unchanged.
-- Rollback (RB-2, not pre-approved, about 2 x N_im reads per recreate): CREATE INDEX IF NOT EXISTS with the
-- original definitions, one index at a time.

DROP INDEX IF EXISTS idx_instrument_master_isin;
DROP INDEX IF EXISTS idx_instrument_master_cusip_issuer;
