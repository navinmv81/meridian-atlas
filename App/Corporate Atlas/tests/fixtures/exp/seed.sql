-- MA-NOV-EXP.W1 route-test data. ETF A / ETF B are the spec §3.4 worked example (fixture F1);
-- ETF C is T7 (unmapped, negative no-id weight); ETF R exercises merge redirects (T8 + hops).
-- MA-NOV-EXP.W1R2: A1 boundary moved to the measured cap (10,000 holdings); ETF UNM exercises the 25-row
-- unmapped_top cut (30 unmapped rows, one weight tie) and a mapped entity with no entity_master row.

INSERT INTO entity_master (entity_id, name) VALUES
  (1, 'X Corp'), (2, 'Y Corp'), (3, 'Z Corp'), (4, 'W Corp'), (5, 'V Corp'),
  (6, 'Y Corp (second record)'),           -- Y′: a separate, unmerged record — must stay separate
  (100, 'Survivor S'), (101, 'Survivor T'),
  (500, 'Fund A Trust'), (501, 'Fund B Trust');
-- 900, 910, 911, 920–922 are merged-away duplicates: no entity_master row.

INSERT INTO entity_merge_redirect (duplicate_id, survivor_id, merged_at, packet) VALUES
  (900, 100, '2026-10-30T10:00:00Z', 'MA-OCT-013'),                                   -- one hop
  (910, 911, '2026-10-30T10:00:00Z', 'MA-OCT-013'), (911, 101, '2026-10-30T10:00:00Z', 'MA-OCT-013'),  -- two hops
  (920, 921, '2026-10-30T10:00:00Z', 'MA-OCT-013'), (921, 922, '2026-10-30T10:00:00Z', 'MA-OCT-013'),
  (922, 923, '2026-10-30T10:00:00Z', 'MA-OCT-013');                                   -- three hops → unresolved

INSERT INTO instrument_entity_map (instrument_key, entity_id, source, confidence) VALUES
  ('US0000000X01', 1, 'isin_tier1', 95),
  ('TICKER:XB',    1, 'openfigi_tier1', 92),
  ('US0000000Y01', 2, 'isin_tier1', 95),
  ('US0000000Y02', 6, 'isin_tier1', 95),
  ('CUSIP:ZZZ111111', 3, 'heuristic', 60),
  ('CUSIP:WWW111111', 4, 'cusip_tier1', 90),
  ('US0000000V01', 5, 'isin_tier1', 97),
  ('US00000R0001', 900, 'isin_tier1', 95),
  ('US00000R0002', 100, 'cusip_tier1', 80),
  ('US00000R0003', 910, 'isin_tier1', 95),
  ('US00000R0004', 920, 'isin_tier1', 95),
  ('US0000000N01', 7, 'isin_tier1', 95);       -- entity 7 has no entity_master row → name null

-- Fan-out trap: entity_isin_map would send X's ISIN to three entities. The route must not use it.
INSERT INTO entity_isin_map (isin, lei, entity_id) VALUES
  ('US0000000X01', 'LEI-X', 1), ('US0000000X01', 'LEI-Y', 2), ('US0000000X01', 'LEI-Z', 3);

INSERT INTO etf_master (ticker, name, series_id) VALUES
  ('AAA', 'ETF A', 'SA'), ('BBB', 'ETF B', 'SB'), ('CCC', 'ETF C', 'SC'), ('RRR', 'ETF R', 'SR'),
  ('NOSER', 'No-series ETF', NULL), ('PART', 'Partial-only ETF', 'SP'),
  ('BIG', 'Big ETF', 'SBIG'), ('EDGE', 'Edge ETF', 'SEDGE'), ('NOSNAP', 'No-snapshot ETF', 'SNOSNAP'),
  ('BRK.B', 'Dotted ETF', 'SDOT'), ('UNM', 'Mostly-unmapped ETF', 'SU');

INSERT INTO fund_snapshot_monthly (series_id, report_month, net_assets, holdings_count, filing_date, period_end) VALUES
  ('SA', '2026-03', 9.0e8, 2, '2026-05-22', '2026-03-31'),
  ('SA', '2026-04', 1.0e9, 5, '2026-06-20', '2026-04-30'),
  ('SB', '2026-02', 5.0e8, 4, '2026-04-24', '2026-02-28'),
  ('SC', '2026-04', 1.0e8, 4, '2026-06-21', '2026-04-30'),
  ('SR', '2026-04', 1.0e8, 5, '2026-06-21', '2026-04-30'),
  ('SBIG', '2026-04', 3.0e10, 10001, '2026-06-21', '2026-04-30'),
  ('SEDGE', '2026-04', 3.0e10, 10000, '2026-06-21', '2026-04-30'),
  ('SU', '2026-04', 1.0e8, 31, '2026-06-21', '2026-04-30');
-- SNOSNAP has no snapshot row on purpose (A1 falls back to COUNT(*) on the index range).

INSERT INTO fund_holdings_monthly (series_id, report_month, security_name, cusip, isin, security_ticker, weight_pct, snapshot_status) VALUES
  -- ETF A, 2026-04 (F1): X 10, Y 8, Z 5 (heuristic), W 74, one unmapped 3 → total 100
  ('SA', '2026-04', 'X Corp ord',     NULL,        'US0000000X01', 'X',  10, 'complete'),
  ('SA', '2026-04', 'Y Corp ord',     NULL,        'US0000000Y01', 'Y',   8, 'complete'),
  ('SA', '2026-04', 'Z Corp ord',     'ZZZ111111', NULL,           NULL,  5, 'complete'),
  ('SA', '2026-04', 'W Corp ord',     'WWW111111', NULL,           NULL, 74, 'complete'),
  ('SA', '2026-04', 'Unmapped Co',    NULL,        'XX0000000U01', NULL,  3, 'complete'),
  -- ETF A, 2026-03 (previous stored month)
  ('SA', '2026-03', 'X Corp ord',     NULL,        'US0000000X01', 'X',  50, 'complete'),
  ('SA', '2026-03', 'W Corp ord',     'WWW111111', NULL,           NULL, 50, 'complete'),
  -- ETF A, 2026-05 is still partial: never served
  ('SA', '2026-05', 'X Corp ord',     NULL,        'US0000000X01', 'X', 100, 'partial'),
  -- ETF B, 2026-02 (F1): X 6 (openfigi via ticker), Y′ 4, Z 12 (heuristic), V 70 → total 92
  ('SB', '2026-02', 'X Corp ord',     '',          '',             ' xb ',  6, 'complete'),
  ('SB', '2026-02', 'Y Corp pref',    NULL,        'US0000000Y02', NULL,  4, 'complete'),
  ('SB', '2026-02', 'Z Corp ord',     ' ZZZ111111 ', NULL,         NULL, 12, 'complete'),
  ('SB', '2026-02', 'V Corp ord',     NULL,        'US0000000V01', NULL, 70, 'complete'),
  -- ETF C, 2026-04 (T7): X 30 mapped, unmapped 70, two no-identifier rows summing −2 → total 98
  ('SC', '2026-04', 'X Corp ord',     NULL,        'US0000000X01', NULL, 30, 'complete'),
  ('SC', '2026-04', 'Unknown Ltd',    NULL,        'XX0000000U02', NULL, 70, 'complete'),
  ('SC', '2026-04', 'Cash offset',    '000000000', NULL,           '',   -3, 'complete'),
  ('SC', '2026-04', 'Swap leg',       'ABC',       'SHORT',        NULL,  1, 'complete'),
  -- ETF R, 2026-04 (T8 + hops): 900→100 (20), 100 direct (10), 910→911→101 (15), 920→…→923 (5)
  ('SR', '2026-04', 'Dup of S',       NULL,        'US00000R0001', NULL, 20, 'complete'),
  ('SR', '2026-04', 'S direct',       NULL,        'US00000R0002', NULL, 10, 'complete'),
  ('SR', '2026-04', 'Dup of T',       NULL,        'US00000R0003', NULL, 15, 'complete'),
  ('SR', '2026-04', 'Deep chain',     NULL,        'US00000R0004', NULL,  5, 'complete'),
  -- PART: only partial rows
  ('SP', '2026-04', 'X Corp ord',     NULL,        'US0000000X01', NULL, 100, 'partial'),
  -- EDGE: exactly at the A1 ceiling by snapshot count (10,000) → served
  ('SEDGE', '2026-04', 'X Corp ord',  NULL,        'US0000000X01', NULL, 100, 'complete'),
  -- BIG: one row; snapshot says 10,001 → refused before aggregation
  ('SBIG', '2026-04', 'X Corp ord',   NULL,        'US0000000X01', NULL, 100, 'complete'),
  -- Dotted ticker
  ('SDOT', '2026-04', 'X Corp ord',   NULL,        'US0000000X01', NULL, 100, 'complete'),
  -- UNM: 30 unmapped rows (weights 0.1…3.0; row 02 is 1.5, tying row 15) + entity 7 at 5
  ('SU', '2026-04', 'Nameless entity ord', NULL, 'US0000000N01', NULL, 5, 'complete'),
  ('SU', '2026-04', 'Unmapped 01', NULL, 'XU0000000001', NULL, 0.1, 'complete'),
  ('SU', '2026-04', 'Unmapped 02', NULL, 'XU0000000002', NULL, 1.5, 'complete'),
  ('SU', '2026-04', 'Unmapped 03', NULL, 'XU0000000003', NULL, 0.3, 'complete'),
  ('SU', '2026-04', 'Unmapped 04', NULL, 'XU0000000004', NULL, 0.4, 'complete'),
  ('SU', '2026-04', 'Unmapped 05', NULL, 'XU0000000005', NULL, 0.5, 'complete'),
  ('SU', '2026-04', 'Unmapped 06', NULL, 'XU0000000006', NULL, 0.6, 'complete'),
  ('SU', '2026-04', 'Unmapped 07', NULL, 'XU0000000007', NULL, 0.7, 'complete'),
  ('SU', '2026-04', 'Unmapped 08', NULL, 'XU0000000008', NULL, 0.8, 'complete'),
  ('SU', '2026-04', 'Unmapped 09', NULL, 'XU0000000009', NULL, 0.9, 'complete'),
  ('SU', '2026-04', 'Unmapped 10', NULL, 'XU0000000010', NULL, 1.0, 'complete'),
  ('SU', '2026-04', 'Unmapped 11', NULL, 'XU0000000011', NULL, 1.1, 'complete'),
  ('SU', '2026-04', 'Unmapped 12', NULL, 'XU0000000012', NULL, 1.2, 'complete'),
  ('SU', '2026-04', 'Unmapped 13', NULL, 'XU0000000013', NULL, 1.3, 'complete'),
  ('SU', '2026-04', 'Unmapped 14', NULL, 'XU0000000014', NULL, 1.4, 'complete'),
  ('SU', '2026-04', 'Unmapped 15', NULL, 'XU0000000015', NULL, 1.5, 'complete'),
  ('SU', '2026-04', 'Unmapped 16', NULL, 'XU0000000016', NULL, 1.6, 'complete'),
  ('SU', '2026-04', 'Unmapped 17', NULL, 'XU0000000017', NULL, 1.7, 'complete'),
  ('SU', '2026-04', 'Unmapped 18', NULL, 'XU0000000018', NULL, 1.8, 'complete'),
  ('SU', '2026-04', 'Unmapped 19', NULL, 'XU0000000019', NULL, 1.9, 'complete'),
  ('SU', '2026-04', 'Unmapped 20', NULL, 'XU0000000020', NULL, 2.0, 'complete'),
  ('SU', '2026-04', 'Unmapped 21', NULL, 'XU0000000021', NULL, 2.1, 'complete'),
  ('SU', '2026-04', 'Unmapped 22', NULL, 'XU0000000022', NULL, 2.2, 'complete'),
  ('SU', '2026-04', 'Unmapped 23', NULL, 'XU0000000023', NULL, 2.3, 'complete'),
  ('SU', '2026-04', 'Unmapped 24', NULL, 'XU0000000024', NULL, 2.4, 'complete'),
  ('SU', '2026-04', 'Unmapped 25', NULL, 'XU0000000025', NULL, 2.5, 'complete'),
  ('SU', '2026-04', 'Unmapped 26', NULL, 'XU0000000026', NULL, 2.6, 'complete'),
  ('SU', '2026-04', 'Unmapped 27', NULL, 'XU0000000027', NULL, 2.7, 'complete'),
  ('SU', '2026-04', 'Unmapped 28', NULL, 'XU0000000028', NULL, 2.8, 'complete'),
  ('SU', '2026-04', 'Unmapped 29', NULL, 'XU0000000029', NULL, 2.9, 'complete'),
  ('SU', '2026-04', 'Unmapped 30', NULL, 'XU0000000030', NULL, 3.0, 'complete');

-- /etf-exposure per-holder month: X (entity 1) is held by Fund A at 2026-03 and 2026-05, by Fund B only at 2026-03.
INSERT INTO fund_entity_link (etf_symbol, series_id, entity_id) VALUES ('AAA', 'SA', 500), ('BBB', 'SB', 501);
INSERT INTO entity_exposure_monthly (report_month, entity_id, holder_entity_id, weight_sum, computed_at) VALUES
  ('2026-03', 1, 500, 40, '2026-06-14T01:00:00Z'),
  ('2026-05', 1, 500, 12, '2026-11-12T01:00:00Z'),
  ('2026-03', 1, 501,  7, '2026-06-14T01:00:00Z');
