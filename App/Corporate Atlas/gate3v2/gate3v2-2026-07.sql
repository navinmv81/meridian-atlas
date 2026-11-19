-- gate3 v2 — one report month — MA-NOV-EXP spec §5.4 (identity rule §3.2). GENERATED from gate3v2-month.sql.tmpl
-- by gen.mjs; substitutions: 2026-07 (YYYY-MM) and g3v2-20261119 (run token). Do not edit generated files by hand.
-- Identity: holding key (ISIN 12 → CUSIP:≥6 not 000000000 → TICKER:) → instrument_entity_map (PK, one entity per
-- instrument; entity_isin_map NOT used) → entity_merge_redirect (two hops, as R-EXP1 in src/entities-api.js; a row
-- still on a duplicate after two hops counts as not mapped). Holder = fund_entity_link.entity_id by series_id.
-- INSERT OR IGNORE: rows already present for the month are never touched. Every row: computed_at = 'g3v2-20261119'.
-- Writes only entity_exposure_monthly and fund_exposure_coverage. Reads fund_holdings_monthly (complete) read-only.

WITH fel AS (SELECT DISTINCT series_id, entity_id FROM fund_entity_link WHERE series_id IS NOT NULL),
h AS (
  SELECT fel.entity_id holder, f.weight_pct w,
    CASE WHEN length(trim(f.isin)) = 12 THEN trim(f.isin)
         WHEN length(trim(f.cusip)) >= 6 AND trim(f.cusip) <> '000000000' THEN 'CUSIP:' || trim(f.cusip)
         WHEN trim(coalesce(f.security_ticker, '')) <> '' THEN 'TICKER:' || upper(trim(f.security_ticker)) END k
  FROM fel JOIN fund_holdings_monthly f
    ON f.snapshot_status = 'complete' AND f.series_id = fel.series_id AND f.report_month = '2026-07'),
j AS (
  SELECT h.holder, h.w,
    CASE WHEN m.entity_id IS NULL OR rd3.survivor_id IS NOT NULL THEN NULL
         ELSE COALESCE(rd2.survivor_id, rd1.survivor_id, m.entity_id) END eid
  FROM h LEFT JOIN instrument_entity_map m ON m.instrument_key = h.k
         LEFT JOIN entity_merge_redirect rd1 ON rd1.duplicate_id = m.entity_id
         LEFT JOIN entity_merge_redirect rd2 ON rd2.duplicate_id = rd1.survivor_id
         LEFT JOIN entity_merge_redirect rd3 ON rd3.duplicate_id = rd2.survivor_id)
INSERT OR IGNORE INTO entity_exposure_monthly (report_month, entity_id, holder_entity_id, weight_sum, aum_weighted, computed_at)
SELECT '2026-07', eid, holder, COALESCE(SUM(w), 0), NULL, 'g3v2-20261119'
FROM j WHERE eid IS NOT NULL GROUP BY eid, holder;

WITH fel AS (SELECT DISTINCT series_id, entity_id FROM fund_entity_link WHERE series_id IS NOT NULL),
h AS (
  SELECT fel.entity_id holder, f.weight_pct w,
    CASE WHEN length(trim(f.isin)) = 12 THEN trim(f.isin)
         WHEN length(trim(f.cusip)) >= 6 AND trim(f.cusip) <> '000000000' THEN 'CUSIP:' || trim(f.cusip)
         WHEN trim(coalesce(f.security_ticker, '')) <> '' THEN 'TICKER:' || upper(trim(f.security_ticker)) END k
  FROM fel JOIN fund_holdings_monthly f
    ON f.snapshot_status = 'complete' AND f.series_id = fel.series_id AND f.report_month = '2026-07'),
j AS (
  SELECT h.holder, h.w,
    CASE WHEN m.entity_id IS NULL OR rd3.survivor_id IS NOT NULL THEN NULL
         ELSE COALESCE(rd2.survivor_id, rd1.survivor_id, m.entity_id) END eid
  FROM h LEFT JOIN instrument_entity_map m ON m.instrument_key = h.k
         LEFT JOIN entity_merge_redirect rd1 ON rd1.duplicate_id = m.entity_id
         LEFT JOIN entity_merge_redirect rd2 ON rd2.duplicate_id = rd1.survivor_id
         LEFT JOIN entity_merge_redirect rd3 ON rd3.duplicate_id = rd2.survivor_id)
INSERT OR IGNORE INTO fund_exposure_coverage (report_month, holder_entity_id, total_weight, mapped_weight, computed_at)
SELECT '2026-07', holder, COALESCE(SUM(w), 0), COALESCE(SUM(CASE WHEN eid IS NOT NULL THEN w END), 0), 'g3v2-20261119'
FROM j GROUP BY holder;
