# MA-NOV-UIT.BUILD — Report (offline build; SQL not run)

```text
PACKET:     MA-NOV-UIT.BUILD · Control v1 (265243f9…ff81) · Task v1 (b4322dbd…f3d6)
RUN:        r-20261127T073448Z-d203 · interactive · 2026-11-27 07:34–07:50Z
EXECUTED:   ETF Product Lead + Engineering Lead (ETF domain)
BASE:       November-2026 @ c5581cf (HEAD = origin). Pins: DIAG.HEALTH report ee66f230…a935 ✔;
            holdings-pipeline.js at HEAD = blob fb856a8d (file sha256 5558bec0…2943)
READS:      D1 12 statements of 20 · 88,152 rows read of 60,000 (OVER BUDGET: one control read, see §8 D1)
            SEC 11 GETs of 20 (7 submissions/ticker-map JSON, 4 NPORT-P XML) · public exposure route 2 GETs
WRITES:     0 D1 rows · 0 deploys · files under App/ETF Refresh/uit/, one `export` keyword, this report
```

## 1 · Per-fund confirmation (SEC submissions JSON + NPORT-P header, 2026-11-27)

| Ticker | CIK in `etf_master` | CIK at SEC | NPORT-P? | `seriesId` in header | Key used | Latest NPORT-P (accession · period · filed) | Holdings |
|---|---|---|---|---|---|---|---|
| SPY | 0000884394 | 0000884394 ✔ | yes, 29 | none (`seriesName N/A`) | **surrogate `C0000884394`** | 0001410368-26-123764 · 2026-09-30 · 2026-11-25 | 504 |
| QQQ | 0001067839 | 0001067839 ✔ | yes, 28 | **`S000101292`** | **real `S000101292`** | 0001067839-26-000030 · 2026-06-30 · 2026-08-28 | 105 |
| DIA | **0001041014 ✘** (an individual filer) | **0001041130** | yes, 28 | none (`seriesName N/A`) | **surrogate `C0001041130`** | 0001410368-26-095867 · 2026-07-31 · 2026-09-18 | 30 |
| MDY | **0000916132 ✘** (SEC 404) | **0000936958** | yes, 29 | none (seriesName set, no id) | **surrogate `C0000936958`** | 0000940400-26-047939 · 2026-09-30 · 2026-11-25 | 400 |

- None was dropped: all four file NPORT-P. QQQ has converted and files under a real series id, so it gets that id (Control §1). It has no 2026-09-30 NPORT-P yet; it is due by 29 Nov.
- Two `etf_master` CIKs are wrong. The correct ones come from SEC `company_tickers.json` and each trust's submissions, and each NPORT-P header `regCik` matches. The `etf_master` correction also fixes `cik` for DIA and MDY (§8 D2).
- **No collision.** D1 has no `series_id` in `[C, D)` in `etf_master`, `fund_snapshot_monthly` or `fund_holdings_monthly`, and none of the 4 keys exists (QQQ's `S000101292` included). No holdings `id` is ≥ 2,000,000. D1 `max(id)` and `sqlite_sequence` are both 798,655.

## 2 · Script and the one edit to `holdings-pipeline.js`

- **Edit:** `async function storeHoldings(` → `export async function storeHoldings(`. That is the only change: `git diff` shows 1 line, and the test re-derives the HEAD sha256 with the keyword removed. The deployed Worker is not touched. `storeHoldings` does **not** check the series id inside the XML (`processEtfHoldings` does, at `:280`), so the key passes straight through with no behaviour change. The stop gate did not trigger.
- `uit/lib/recording-d1.mjs` is a D1 shim (`prepare/bind/run/first/all/batch`). It records every statement (SQL + params) and executes it on an in-memory node:sqlite copy (schema + the 6 seed `etf_master` rows), so `storeHoldings`' own reads get real answers.
- `uit/uit-nport-load.mjs`:
  - `fetch` downloads the 4 XMLs into `uit/cache/*.xml.gz`, with a sha256 per file in `cache/manifest.json`.
  - `build` checks the cache hashes, parses each header (`regCik` and `repPdDate` must match §1), chooses the key, runs `storeHoldings(shim, key, ticker, period[0..7], fileDate, xml, 0)`, and converts the recording with fixed rules.
  - The conversion rules (R1–R9) are strict: any unrecognised statement, and any `coverage_status = 'directory'` downgrade, aborts the build.
- **Conversion** (the final rows are identical, proven by the shim-fidelity test in §7):
  - The `holdings_pipeline_state` counter reads and writes (R1/R2) and the coverage-depth `SELECT` (R8) are dropped.
  - The `DELETE … WHERE series_id/report_month` (R4) is dropped: it is a no-op on a new key, and the insert guard replaces it.
  - Holdings inserts (R5) become `INSERT OR IGNORE … SELECT <explicit id>, … WHERE NOT EXISTS (snapshot for that fund-month)`. They keep `snapshot_status NULL`, so partial data is never served, exactly as in the pipeline.
  - Mark-complete (R6) gains `AND id BETWEEN lo AND hi AND snapshot_status IS NULL`.
  - The snapshot `INSERT OR REPLACE` (R3) becomes `INSERT OR IGNORE`, moved after mark-complete.
  - The pipeline's `coverage_depth` update (R9, value 1) is folded into the guarded `etf_master` correction. On D1 it would match 0 rows, because `series_id` is not set yet.

## 3 · Apply and rollback SQL (`App/ETF Refresh/uit/apply/`)

| File | Bytes | sha256 | Batches | Statements |
|---|---|---|---|---|
| `uit-apply-run1.sql` | 531,407 | `720503fcea976b0ea4cc5e3561ed252a8f9ae8fb9046e85467ef274406de15c0` | 14 (≤ 100 each) | 1,051 |
| `uit-rollback-run1.sql` | 3,944 | `12695c51a48548b92c39de0e77ab9df89744f44d460e6420202a6417b9de739e` | 2 | 13 |
| `uit-summary.json` | 7,668 | `8f94b0e6450f3551c0433f93ac1c44c2e870ce2bd24690359986ee87a73d8f43` | per fund: key, header, ids, before/after `etf_master` | |
| `uit-dryrun-result.json` | 7,937 | `286ccfe279e5fc5e5ca52ec0d4fae41bf1406206f30a5edf1b1bddae6ea9883c` | §4 evidence | |

- **Apply, per fund (batches never mix funds):** holdings inserts, expected `1` each → mark-complete, expected N → snapshot insert, `1` → `etf_master` update, `1`.
  - Vectors: SPY batches 1–6 (the last is `[1,1,1,1,504,1,1]`); QQQ 7–8 (`…,105,1,1`); DIA 9 (`…,30,1,1`); MDY 10–14 (`[400,1,1]`).
  - Explicit ids: SPY 2,000,001–2,000,504 · QQQ 2,010,001–2,010,105 · DIA 2,020,001–2,020,030 · MDY 2,030,001–2,030,400.
  - Writes: 1,039 holdings rows, 4 snapshots and 4 `etf_master` updates. Nothing goes to `holdings_pipeline_state`, and the apply contains no `DELETE`.
- **`etf_master` correction:** `cik` (the SEC value), `series_id` (the key), `has_nport = 1`, `coverage_status = 'deep'`, `coverage_depth = 1`, and the note.
  - Note for the surrogates: "1940-Act UIT, files NPORT-P, no series id; surrogate key C<cik>; loaded one-off by MA-NOV-UIT".
  - Note for QQQ: "1940-Act fund, files NPORT-P under series id S000101292; …".
  - The update is guarded with `IS` on every prior value (cik, series_id, has_nport, coverage_status, notes, coverage_depth, updated_at), so it changes nothing if the row has moved. `updated_at` and `net_assets` are not written.
- **Rollback:**
  - Batch 1 (12 statements): restore the exact prior `etf_master` values, guarded on the new values (`[1,1,1,1]`) → delete the 4 snapshots, guarded on key, month, filing_date and holdings_count (`[1,1,1,1]`) → delete holdings by key, month and id range (`[504,105,30,400]`).
  - Batch 2 is optional: it puts the AUTOINCREMENT counter back with `seq = MAX(MAX(id), 798655)`, guarded on `seq = 2030400`. Skip it if D1 refuses writes to `sqlite_sequence`; it has no data effect.

## 4 · Dry run (node:sqlite, seeded from the D1 reads: `uit/seed/d1-before.json`, sha256 `361f7719…d1ec`)

The seed holds the schema (4 tables, 11 indexes), the 6 `etf_master` rows, 5 IVV/VOO snapshots, IVV/VOO 2026-03 holdings (1,026 rows) and `sqlite_sequence = 798655`.

| Step | Result |
|---|---|
| Apply | 14/14 batches match their vectors; 2,086 changes (1,039 inserts + 1,039 marked complete + 4 + 4) |
| Re-apply | **0 changes**, and the state is identical |
| Rollback | 2/2 batches match; rollback again = 0 |
| After rollback vs seed | **identical**: the sha256 of the ordered row dump matches for `etf_master`, `fund_snapshot_monthly`, `fund_holdings_monthly`, `holdings_pipeline_state` and `sqlite_sequence` |

Shapes after apply, compared with the stored controls:

| series_id | Month | Rows = `holdings_count` | Status | `asset_cat` | Σweight % | CUSIP-9 share | ISIN null | Snapshot null fields |
|---|---|---|---|---|---|---|---|---|
| C0000884394 SPY | 2026-09 | 504 = 504 | all complete | EC 503, DE 1 | 99.97 | 1.000 | 0 | none |
| S000101292 QQQ | 2026-06 | 105 = 105 | all complete | EC 102, STIV 2, DE 1 | 100.28 | 0.962 | 0.029 | none |
| C0001041130 DIA | 2026-07 | 30 = 30 | all complete | EC 30 | 99.95 | 1.000 | 0 | none |
| C0000936958 MDY | 2026-09 | 400 = 400 | all complete | EC 400 | 99.34 | 1.000 | 0 | none |
| S000004310 IVV (control) | 2026-03 | 507 = 507 | all complete | EC 503, STIV 3, DE 1 | 100.07 | 0.945 | 0.002 | none |
| S000002839 VOO (control) | 2026-03 | 519 = 519 | all complete | EC 504, DE 13, STIV 2 | 100.14 | 0.969 | 0.031 | none |

`security_ticker` is NULL for 100% of rows in both the new and the control data, so it matches. `period_end` follows the pipeline's existing rule (`repPdEnd`, the fiscal year end). For example, QQQ's row reads 2026-09-30 for the June report, the same as the controls' stored rows. This is pre-existing behaviour, replicated deliberately.

## 5 · Exposure readiness (read-only)

- **Month.** R-EXP1 resolves `etf_master.ticker → series_id`, then takes the latest `report_month` with `snapshot_status = 'complete'` in `fund_holdings_monthly` (an `ORDER BY … DESC LIMIT 1` seek on `idx_holdings_status_series_month`). `fund_snapshot_monthly` is a LEFT JOIN: it supplies filing_date, net_assets and holdings_count, and if it is missing the route falls back to `COUNT(*)`. The apply writes it anyway. No other rows are needed: `instrument_entity_map`, `entity_merge_redirect` and `entity_master` are only read. The resulting months are SPY 2026-09, QQQ 2026-06, DIA 2026-07 and MDY 2026-09.
- **`newest_stored_month`** (the client's "Older data" warning, more than 3 months behind it) is **already 2026-09** live (IVV body, 07:47Z), so this load does not move it. None of the 4 is stale: QQQ is exactly 3 months behind, which does not count as "more than 3".
- **Mapping coverage** is estimated with the route's own key rule (ISIN-12, else CUSIP, else TICKER), as overlap with IVV/VOO's stored keys. Live IVV: 506 of 507 holdings map (isin 458, cusip 28, heuristic 15, openfigi 5; 1 has no identifier).
  - SPY: **96.6% of holdings / 97.8% of weight** share a key with IVV or VOO.
  - DIA: 96.7% / 97.2%.
  - QQQ: 81.0% / 93.4% (3 holdings have no key).
  - MDY: 0% overlap (midcaps), so it cannot be estimated this way. Reading `instrument_entity_map` would answer it; it was not read because the read budget was already exceeded (§8 D1).
- **Cost and caps:** holdings are far under the A1 cap of 10,000. At about 4.7 rows per holding, an uncached request reads roughly SPY 2.4k, MDY 1.9k, QQQ 0.5k and DIA 0.15k rows. SPY's body should be about the size of IVV's, which is served under the 128 KiB cap.
- **Cache.** The 404 `no_series_id` is cached **1 h** at the edge (per colo) plus browser `max-age=3600`.
  - Live check at 07:47Z: SPY returned 404 with `x-exp-cache: miss`, so nothing was cached before. This check itself cached a 1-h 404 at one colo, which expires by about 08:47Z.
  - **No `EXP_CACHE_GEN` bump or entities-api deploy is needed.** The release should wait at least 1 h after the apply before checking SPY, or accept up to 1 h of stale 404s.
  - Other ETFs' 200 bodies are unaffected, because `newest_stored_month` does not change. (Record only; the release packet acts.)
- **Sunday `meridian-holdings` side effect (code unchanged):**
  - The 4 rows join its universe (`has_nport = 1 AND series_id IS NOT NULL AND deep`), so it grows from 237 to 241. They sort last (`net_assets NULL`, `NULLS LAST`), so the current offset of 149 is not disturbed.
  - For the surrogates, the EFTS search on `"C…"` finds nothing, so each returns "complete" with 0 writes (1 EFTS fetch each).
  - **QQQ will be ingested normally** under `S000101292`: up to 2 months, about 105 rows each, and 2026-06 is skipped because it is already complete. That is good, but it means rollback is exact only until the next Sunday run that touches QQQ, after which its `coverage_depth` guard will (correctly) refuse.

## 6 · Three-point check

1. **Index audit.** Plans come from `EXPLAIN QUERY PLAN` on live D1 for the holdings statements and on the local copy for the rest:
   - Holdings insert: snapshot `NOT EXISTS` uses `sqlite_autoindex_fund_snapshot_monthly_1`, a COVERING SEARCH, plus the `id` PK.
   - Mark-complete: `idx_holdings_status_series_month (status, series, month, rowid range)`.
   - Rollback holdings delete: `idx_holdings_series_month (series, month, rowid range)`.
   - Snapshot insert and delete: the PK.
   - `etf_master` update, restore and verify: `sqlite_autoindex_etf_master_1 (ticker)`.
   - `sqlite_sequence` restore: a scan of a table of about 10 rows, plus `MAX(id)` on the rowid.
   - **Verify queries for the apply packet:** run one per fund with equality, `WHERE series_id = ? AND report_month = ?` (`idx_holdings_series_month`), plus a snapshot PK lookup and an `etf_master` lookup by ticker. **Never** use `series_id IN (…) AND report_month = …`: D1 plans that on `idx_holdings_month` and reads the whole month (87,241 rows, §8 D1).
2. **Single-execution read test (< 50k).** The largest statement is SPY's mark-complete, which reads about 504 index rows. Each insert reads 1 snapshot index row. The whole apply reads about 3k rows, a verify pass about 1.1k, and each exposure request about 2.4k at most (SPY). All are far under 50k.
3. **Read and write budget.**
   - Writes: 1,039 inserts at about 9 rows_written each (table plus 8 indexes, the pipeline's measured ~9×), plus 1,039 mark-completes at about 3 each, plus about 20 for the snapshots and `etf_master`. That is **≈ 12.5k rows_written** in one run, about 12.5% of the 100k/day cap.
   - Do not apply on a Sunday (the holdings job's guard is 80k) or alongside a heavy enrich day (expbf has written 17–34k a day recently).
   - Storage: about 1,039 rows, under 1 MB. Reads are trivial (see point 2).

## 7 · Tests

- `node --no-warnings --test "App/ETF Refresh/uit/tests/uit-build.test.mjs"`: **11/11 pass**. The tests cover:
  - The pipeline edit is `export` only.
  - Keys: surrogate and real, the bad-CIK refusal, header `regCik` and period.
  - Cache hashes.
  - **Shim fidelity:** an independent direct node:sqlite D1 run of `storeHoldings` and the apply SQL give identical holdings (1,039, in order, every column except id/created_at) and identical snapshots.
  - The apply file has batches ≤ 100, no `holdings_pipeline_state`, no `DELETE`, and a deterministic rebuild.
  - The dry run (apply, re-apply 0, rollback identical, rollback again 0).
  - Guards: a moved `etf_master` row is untouched and caught by its vector; an existing snapshot stops all inserts; a partial apply re-run inserts no duplicates.
  - `classify` refuses unknown SQL and a coverage downgrade.
  - The summary hashes match the files.
- Existing suites still pass:
  - ETF `tests/ops-health.test.mjs` 26/26.
  - Corporate Atlas exposure suites: `exp-route` 32, `exp-backfill` 20, `exp-backfill-wiring` 7, `exp-compute` 160, `exp-ui` 270, `home-entry` 177, `merge-013` 106. All pass, 0 fail.

## 8 · Deviations

- **D1 — read budget exceeded.** Total rows read were 88,152 against 60,000. One control read (the IVV/VOO 2026-03 holdings, `series_id IN (…) AND report_month = '2026-03'`) read 87,241 rows. D1 chose `idx_holdings_month`, confirmed by `EXPLAIN QUERY PLAN`. It was read-only and not a full table scan, but it was over budget. After that, D1 reads were kept to 6 small statements (269 rows). The verify-query guidance in §6 prevents a repeat.
- **D2 — `cik` added to the `etf_master` correction for DIA and MDY.** Their stored CIKs are wrong: DIA's is an individual filer and MDY's does not exist. The surrogate must use the real trust CIK. The update is guarded and restored by the rollback. Reviewer: strike it if the correction should stay to the four Control fields, but then the surrogate would not match `etf_master.cik`.
- **D3 — QQQ keeps its real series id.** As allowed by Control §1, it uses `S000101292`, not a surrogate. Consequence: the existing Sunday job will start ingesting QQQ (§5).
- **D4 — apply statements differ in form from the pipeline's.** They use explicit ids, OR IGNORE and NOT EXISTS guards, drop the no-op DELETE and the counter writes, move the snapshot after mark-complete, and fold `coverage_depth` into the `etf_master` update. The rows are proven identical (§7). Effect of the explicit ids: D1's AUTOINCREMENT then continues above 2,030,400.
- **D5 — SEC User-Agent:** the pipeline's own project string (`MeridianAtlas contact@…`, a project contact, not a personal e-mail).
- **D6 — one 1-h edge 404 for SPY,** created by the read-only route check (§5). Harmless.

## 9 · Boundaries kept

- **D1:** SELECT, `sqlite_master` and `EXPLAIN QUERY PLAN` only (12 statements). No writes, no PRAGMA, and no full scan of `fund_holdings_monthly` (see D1 for the over-budget index read).
- **No changes:** no deploys and no `/run`. No change to `meridian-holdings` behaviour, toml, crons or secrets; `storeHoldings` has an `export` keyword only. No other Worker touched.
- **Tables not written:** `holdings_pipeline_state` and the Entities-domain tables, which were only read via the public route.
- **Files not touched:** `docs/`, `.env*` (none read or printed), Status, board, Tower, `transitions.jsonl`, logs, and `13F Seed/gleif-seed.js`. No installs and no subagents.
- **Written:** `App/ETF Refresh/uit/` (script, lib, tests, seed, cache, apply), the 1-line edit to `App/ETF Refresh/src/holdings-pipeline.js`, and this report. One commit, pushed to `November-2026`.
