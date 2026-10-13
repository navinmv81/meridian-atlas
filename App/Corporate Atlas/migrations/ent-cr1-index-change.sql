-- ent-cr1-index-change.sql — MA-OCT-ENT-CR1 (rev 1, fb13ff3e…6c20), applied Tue 13 Oct 2026 09:33:45 UTC
-- by LANE-1-ENG (MA-OCT-ENT-CR1.EXEC, Control v1 47e0afe8…db13), wrangler 4.96.0, D1 meridian-etf.
-- Repo DDL of record: ONLY the statements actually applied (AR-3).
--
-- C1 applied: measured rows_read 65,911 (2.01 × R_i; Ops exception OPS-R4 cap ≤ 90k), rows_written 32,770
-- (R_i 32,769 index entries + 1 schema row). Verified: E1 (007 P6), E2 (007 P7), E4 (013 lookup) use
-- idx_iem_entity_key ("ENT-CR1 verified").
--
-- C2 / C3 (DROP the duplicate idx_instrument_master_isin / idx_instrument_master_cusip_issuer) were NOT
-- applied: deferred pending a Main Lane re-gate (measured N_im = 73,006 > the CR's 55k premise). When they
-- run they go in ent-cr1b-drop-duplicate-indexes.sql.

CREATE INDEX IF NOT EXISTS idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);
