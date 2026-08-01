# Monthly Operations Checklist

## managerissuerpositionquarterly — prune monthly
Run on the 1st of each month after new quarter data is loaded:
DELETE FROM managerissuerpositionquarterly
WHERE report_period < date('now', '-24 months');
Retention: 8 quarters rolling (~2 years).

## issuerperiodsummary — no prune needed
INSERT OR REPLACE enforces latest-only per (cik, xbrl_tag, period_type).
Self-maintaining — no manual prune required.

## entity crons — re-enable after Sprint 2 (currently frozen)
- meridian-entities-seed: restore crons = ["0 3 1 * *"]
- meridian-entities-enrich: restore crons = ["0 */4 * * *"]

## holding13f_normalized — 24-month rolling retention
DELETE FROM holding13f_normalized
WHERE report_period < date('now', '-24 months');
Run quarterly.
