# gate3 v2 — exposure back-fill SQL (MA-NOV-EXP spec §5.4, identity rule §3.2)

Replaces `../gate3-exposure.js` (v1) for months after 2026-03. Plain SQL, run by `wrangler` (OAuth), no tokens,
no hardcoded account/DB ids. Months ≤ 2026-03 are refused by the generator (re-compute is December, D5).

## Files
- `gate3v2-month.sql.tmpl` — 2 statements: `INSERT OR IGNORE … SELECT` into `entity_exposure_monthly`, then into
  `fund_exposure_coverage`. Substitutions: `__MONTH__`, `__TOKEN__` only.
- `gate3v2-dryrun.sql.tmpl` — read-only, ONE pass: rows each INSERT would add, holders, rows already present.
- `gen.mjs` — `node gen.mjs <run-token> <YYYY-MM> [...]` writes `gate3v2-<m>.sql` and `gate3v2-<m>.dryrun.sql`.
- `gate3v2-2026-0{4..8}.sql` / `.dryrun.sql` — generated with token `g3v2-20261119` (MA-NOV-EXP.BF1). A later
  write day regenerates with its own token (`g3v2-YYYYMMDD`) so each day's rows can be rolled back on their own.

## Identity rule (same as R-EXP1 in `../src/entities-api.js`)
Holding key = `trim(isin)` if 12 chars → `'CUSIP:'||trim(cusip)` if ≥ 6 chars and not `000000000` →
`'TICKER:'||upper(trim(security_ticker))` → none. Key → `instrument_entity_map` (PK: one entity per instrument)
→ `entity_merge_redirect` two hops; a row still on a duplicate after two hops is NOT mapped. `entity_isin_map` is
not used. Holder = `fund_entity_link.entity_id` (by `series_id`; 1 entity per series, checked 2026-11-19).
`weight_sum` = SUM(weight_pct) per (entity, holder); `aum_weighted` NULL (as v1); coverage `total_weight` = all
complete holdings of the fund, `mapped_weight` = mapped ones. Every row: `computed_at = '<run token>'`.

## Run (repo root, Tue or Thu UTC only — never Sun/Mon/Wed)
```bash
npx wrangler d1 execute meridian-etf --remote --json --command "$(grep -v '^--' 'App/Corporate Atlas/gate3v2/gate3v2-2026-05.dryrun.sql')"
npx wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/gate3v2/gate3v2-2026-05.sql"
```
`--file` prints only totals (`Rows written`) — that is the number the budget counts.

## Budget rule (Founder D4: ≤ 50,000 row-writes/day)
- Whole months, in order. Before a month: estimate = exposure_rows × 4 + coverage_rows × 2
  (table + PK autoindex + `idx_exposure_entity` + `idx_exposure_holder`; coverage: table + PK). Replace 4 with
  the measured multiplier once one month has been written. Do not start a month whose estimate would take the
  day's total past 50,000.
- Reads (measured 2026-11-19): a dry run reads ≈ 2.5–4.3 rows per stored holding of the month
  (2026-07: 40,744; 2026-04: 291,384). Each write statement reads about as much again.

## Rollback (one run token)
```sql
DELETE FROM entity_exposure_monthly WHERE report_month = '<m>' AND computed_at = '<token>';
DELETE FROM fund_exposure_coverage  WHERE report_month = '<m>' AND computed_at = '<token>';
```
`report_month` first keeps both deletes on the PK prefix. Rows from v1 (computed 2026-06-14) never match a token.
