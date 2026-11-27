# MA-NOV-UIT.REVIEW — Report (independent review, read-only)

```text
PACKET:     MA-NOV-UIT.REVIEW · Control v1 (7baf9687…5b10605 ✔) · Task v1 (072af23d…ddedfb ✔)
RUN:        r-20261127T115440Z-c9db · interactive · 2026-11-27 11:54Z–
EXECUTED:   Reviewer (ETF domain, independent of UIT.BUILD) + Tech Ops
BASE:       November-2026 @ e4f2f02 (HEAD = origin/November-2026)
PINS:       BUILD report 4a1ff129…def1 ✔ · uit-apply-run1.sql 720503fc…c15c0 ✔ · uit-rollback-run1.sql 12695c51…739e ✔
            uit-summary.json 8f94b0e6…8f43 ✔ · cache: 4 × .xml.gz sha256 = manifest ✔ (gz and inflated XML)
READS:      D1 11 statements of 20 · ≈ 2,670 rows read of 40,000 · 0 rows written. No SEC calls (cache only).
WRITES:     this report only. Tests, the dry run and the check scripts ran in a scratch copy outside the repo.
VERDICT:    PASS_WITH_NOTES. No B or M findings. UIT.APPLY may run, using the procedure in §8.
```

## 1 · Findings

| # | Rank | Finding | Action |
|---|---|---|---|
| F1 | N (correction to BUILD §5) | The 4 rows do **not** sort last in the Sunday universe. `net_assets` is NULL for 151 of the 237 rows, and live D1 returns NULL ties in **rowid order** (plan: `SEARCH etf_master USING INDEX idx_etf_master_nport` + temp b-tree; NULL rowids monotonic). After the apply, DIA, MDY and QQQ (rowids 38, 140, 156) land at positions **99, 138 and 143**, which are before `etf_offset = 149`. SPY (rowid 200) lands at 177. | Consequences, all harmless: (a) the next run starts 3 rows earlier and revisits SCHF, SCHG and SCHI, which were already done (complete months are skipped; each costs 1 EFTS fetch plus 1–2 reads per month). (b) **QQQ is not ingested next Sunday.** It waits until the cycle wraps, and the job has never completed a cycle. So QQQ's rollback stays exact much longer than BUILD §5 says. (c) SPY's EFTS search on `"C0000884394"` happens when the cursor reaches 177: 0 writes. Record only. |
| F2 | N | Rollback batch 1 holds all 4 funds. A D1 batch commits even when one guarded `UPDATE` matches 0 rows. If one fund's `etf_master` row has moved (for example QQQ after a later pipeline visit changes `coverage_depth`), its restore returns 0 but its snapshot and holdings are still deleted. | No file change. §8.5 adds a read-only guard precheck before rollback, so this cannot happen silently. |
| F3 | N | The FUNDS constant and BUILD §1 cite the SEC submissions JSON and `company_tickers.json`, but neither was cached. The only offline evidence is the filed NPORT-P header. | The header is sufficient: `regCik` (DIA `0001041130`, MDY `0000936958`), `regFileNumber` (811-09170, 811-08972) and the EDGAR archive path (`data/1041130/`, `data/936958/`) all agree. D2 is accepted. |
| F4 | N | The ETF screen (`ma-etf.js:1205`) hard-codes `NO_NPORT`, which includes **SPY, QQQ and DIA**. After the apply their Holdings tab still says "no N-PORT". **MDY is not in the set**, so its Holdings tab starts showing the stored 2026-09 holdings as soon as the apply commits, with no deploy. | A front-end follow-up to remove SPY, QQQ and DIA from the set belongs to the release packet. It is out of scope here. |
| F5 | N | `fund_entity_link` has rows for all 4 funds with `series_id NULL` (D1 read). `entities-seed` upserts `ON CONFLICT(etf_symbol) DO UPDATE SET entity_id` only, so `series_id` is never back-filled. The 06:00 exposure back-fill (`exp-backfill.js`) joins on `fund_entity_link.series_id`, so it **will not pick up these 4 funds**. That means 0 extra back-fill writes, and also no `entity_exposure_monthly` facts for them ("who holds company X" will not count SPY and the others). | The per-ETF exposure route (R-EXP1) is not affected: it resolves through `etf_master`. Linking needs an Entities-domain write, so it is a separate packet if wanted. |
| F6 | N | Other behaviour that changes with no deploy. `/api/etf-list` reports `hasNport 1` / `deep` for the 4, which shows the DEEP badge and moves the exposure picker's "N of M listed ETFs have stored holdings" up by 4. The stock and country reverse lookups now include them, with `net_assets` NULL, so they add nothing to `total_assets`. The overlap route can now compare SPY with IVV. `/api/etf-prospectus` uses `cik`, so DIA and MDY now resolve the correct trust (it may serve the old edge-cached answer until its TTL). `/api/etf-holdings` (live EFTS) for a surrogate would now return 502 "No N-PORT filings found" instead of 400 `NO_NPORT`, but the client never reaches it: the stored route answers first, and SPY and DIA are short-circuited by F4. | Expected. Record only. No 13F reader of `etf_master`, `has_nport` or `coverage_*` exists (grep). |
| F7 | N | QQQ is loaded at 2026-06. Its 2026-09 NPORT-P is due by 29 Nov. If it is filed before the apply, the apply still loads June (correct, just older), and the pipeline adds September when its cursor reaches QQQ (F1). | Record only. Not a reason to rebuild. |
| F8 | N | 15 of the 1,039 holdings have keys that are not mapped yet. Most are post-corporate-action identifiers, for example Honeywell `US4385162056` (DIA 2.75%), ExxonMobil Holdings `US30233Q1085` (SPY 1.02%) and Honeywell Aerospace `US43849R1059`. | Enrichment backlog, outside this packet. |

## 2 · Q1 — Facts per fund (own parse, not `storeHoldings`)

Method: a separate indexOf-based XML element walker (`check/q1.mjs`, outside the repo). It re-verified both cache hashes per file, read `genInfo`, walked every `invstOrSec`, and compared **every row** (not only a sample) with the 1,039 `INSERT` rows parsed out of the apply SQL by position. It compared name, CUSIP, ISIN, `valUSD`, `pctVal` and `balance`.

| Fund | `regCik` | `seriesId` | `repPdDate` | Holdings: XML = SQL = summary | Σ pctVal | Σ valUSD / netAssets | netAssets = summary | ids | Rows differing |
|---|---|---|---|---|---|---|---|---|---|
| SPY | 0000884394 | none | 2026-09-30 | 504 = 504 = 504 | 99.9702 | 0.9997 | 809,216,143,062.12 ✔ | 2,000,001–2,000,504 | **0** |
| QQQ | 0001067839 | **S000101292** | 2026-06-30 | 105 = 105 = 105 | 100.2821 | 1.0028 | 490,103,179,941.66 ✔ | 2,010,001–2,010,105 | **0** |
| DIA | 0001041130 | none | 2026-07-31 | 30 = 30 = 30 | 99.9464 | 0.9995 | 45,207,847,202.28 ✔ | 2,020,001–2,020,030 | **0** |
| MDY | 0000936958 | none | 2026-09-30 | 400 = 400 = 400 | 99.3446 | 0.9934 | 25,218,638,191.93 ✔ | 2,030,001–2,030,400 | **0** |

All of these match BUILD §1 and §4 and `uit-summary.json`. Each fund's SQL uses one key and one month. Spot-checks, 10 random holdings per fund (deterministic seed), all equal:

- SPY: Honeywell 438516205, P&G 742718109, Uber 90353T100, IBM 459200101, and 6 more.
- QQQ: NVIDIA 67066G104 at 7.5968%, Costco, Linde (G54950103), an `N/A`/`N/A` row (0.0017%), and 6 more.
- DIA: Goldman Sachs 38141G104 at 11.5263%, Visa, Apple, and 7 more.
- MDY: Chemed, Crane, AAON, Stifel, and 6 more.

`period_end` follows the pipeline's `repPdEnd` rule (DIA's July row reads 2026-10-31), as BUILD §4 says.

Tests and dry run (scratch copy):

- `uit-build.test.mjs` passes **11/11**.
- `uit-dryrun.mjs`: 14/14 batches match their vectors, 2,086 changes; re-apply gives 0; rollback matches and leaves state **identical to the seed**; a second rollback gives 0.
- The result file differs from the committed one only in the two `afterApply` hashes, because `created_at` is `datetime('now')`. Expected.

## 3 · Q2 — Keys and the `etf_master` change

- **Surrogate format.** It is `'C' + 10-digit CIK` (11 characters), used only when the header has no `S\d{9}` series id. A grep finds no code that assumes the `S#########` shape or a fixed length. The exposure route's `newest_stored_month` skip-scan uses `length(k) - 7`, so it works for any length. D1 has no series id in `['C','D')` in snapshots or holdings (re-read today: 0 and 0).
- **QQQ.** It keeps its real id `S000101292`: the header `seriesId`, `seriesName` "Invesco QQQ Trust, Series 1". D1 has no snapshot or holdings rows for it today. Its XML contains the id, so the pipeline's `xml.includes(series_id)` check will pass when the cursor reaches QQQ.
- **D2 (CIK correction for DIA and MDY).** Confirmed from the filed headers (F3). Accepted. Without it the surrogate would not match `etf_master.cik`, and `/api/etf-prospectus` would keep using the wrong CIKs.
- **Guards.** Each `etf_master` `UPDATE` is `WHERE ticker = … AND` an `IS` match on cik, series_id, has_nport, coverage_status, notes, coverage_depth and `updated_at = '2026-06-01 20:14:11'`. **Re-read live today, all 4 rows equal those prior values exactly.**
  - D1 has no trigger on `etf_master` or the holdings tables. The only triggers are 3 on `ops_*`. So `updated_at` is not changed by the apply, and the rollback's `updated_at` guard holds.
  - The only writers of `etf_master` in code are the pipeline's `coverage_depth` / AUM downgrade, the local `catchup-script.js`, and the bootstrap ticker rename. All 4 funds are above $200M, so no downgrade.
- **Notes.** "1940-Act UIT, files NPORT-P, no series id; surrogate key C…; loaded one-off by MA-NOV-UIT" (SPY, DIA, MDY), and the QQQ variant. They are accurate. `net_assets` is deliberately not written (see F1 for the ordering consequence).

## 4 · Q3 — SQL safety

Static scan (own parser) of the pinned files:

- **Apply:** 14 batches and 1,051 statements.
  - 1,043 `INSERT OR IGNORE`: 1,039 holdings rows plus 4 snapshots.
  - 4 `UPDATE fund_holdings_monthly … AND id BETWEEN lo AND hi AND snapshot_status IS NULL`.
  - 4 fully guarded `UPDATE etf_master`.
  - No `DELETE`, `holdings_pipeline_state`, `entity_*`, `instrument_entity_map`, DDL or PRAGMA.
  - Every batch holds exactly one series id. The vector sum is 2,086, equal to the dry-run changes.
- **Rollback:** 2 batches. Batch 1 has 12 statements: 4 `etf_master` restores guarded on the new values plus `updated_at`, 4 snapshot deletes guarded on key, month, filing date and count, and 4 holdings deletes by key, month and id range. The vector sum is 1,048. Batch 2 is the `sqlite_sequence` restore. After rollback the state is byte-identical to the seed (dry run).
- **Explicit ids (2,000,001+): acceptable, keep them.** They make each insert idempotent (the PK plus `OR IGNORE`, caught by its vector) and let the rollback delete exactly the inserted rows. A grep finds no code that pages or cursors `fund_holdings_monthly` by `id`, so the AUTOINCREMENT jump from 798,655 to 2,030,400 has no reader effect. With AUTOINCREMENT ids the rollback would still work (key + month), but re-apply idempotence would depend only on the snapshot guard.
- **Optional `sqlite_sequence` batch:** fine as written. It is guarded on `seq = 2030400`, so it is a no-op once the pipeline has inserted above that. Skip it if D1 refuses the write; the counter has no data effect.
- **Partial apply:** if a batch fails part-way, the rows already inserted stay at `snapshot_status NULL` and invisible, and `etf_master` is unchanged until that fund's last batch, so nothing is served. Recovery rules are in §8.4.

## 5 · Q4 — Side effects

- **Sunday `meridian-holdings`:**
  - The universe grows from 237 to 241, but the 4 rows are not appended at the end (F1).
  - The 80k guard is the job's own per-day counter (`writes_today_<date>`). A weekday apply does not touch it. The job's write load does not change: surrogates mean 0 writes, and QQQ is not reached this cycle.
  - `computeUniverseChanges` keys its cache on the count of ETFs with at least 2 complete months. The 4 have 1 month each, so the count and the cache do not change.
  - `refreshPhaseReadinessCache`: the deep count goes up by 4 and so does the count at depth ≥ 1, so `holdingsCompletePct` moves slightly. `etfsWith2PlusMonths` does not change.
  - No AUM downgrade (all above $200M).
- **Other readers:** see F4–F6. The ETF screens, `ma-etf.js`, the overlap route and the reverse lookups change as described. No 13F reader exists. `entities-seed` only reads `etf_master` (F5). `bootstrap` is complete and only `INSERT OR IGNORE`s.

## 6 · Q5 — Exposure and mapping coverage (live `instrument_entity_map`, PK lookups)

All 919 distinct route keys were looked up, using the route's key rule (ISIN-12, else CUSIP, else TICKER). 910 are mapped; the lookup read 1,829 rows.

| Fund | Holdings mapped | Weight mapped | Tiers (isin / cusip / openfigi / heuristic) | No identifier |
|---|---|---|---|---|
| SPY | 496 / 504 = **98.4%** | 98.60 / 99.97 = **98.6%** | 449 / 26 / 5 / 16 | 0 |
| QQQ | 99 / 105 = **94.3%** | 99.18 / 100.28 = **98.9%** | 88 / 5 / 3 / 3 | 3 (Invesco Private Govt / Prime funds, the `N/A` row) |
| DIA | 29 / 30 = **96.7%** | 97.20 / 99.95 = **97.2%** | 28 / 1 / 0 / 0 | 0 |
| MDY | 400 / 400 = **100%** | 99.34 / 99.34 = **100%** | 323 / 57 / 13 / 7 | 0 |

- MDY's mapping is complete. This closes the gap BUILD §5 could not estimate.
- **Route cost and size:**
  - About 4.7 rows read per holding, uncached: SPY about 2.4k, MDY 1.9k, QQQ 0.5k and DIA 0.15k per request. That is far under the 50k statement stop. Holdings are far under the A1 cap of 10,000.
  - The body has one entry per mapped company. That is at most 496 for SPY, below IVV's, which is served under 128 KiB.
  - `newest_stored_month` stays at 2026-09, so the 200 bodies of other ETFs do not change and no `EXP_CACHE_GEN` bump is needed.
  - SPY's earlier 1-hour 404 edge entry (BUILD D6) has expired.

## 7 · Q6 — Budget and timing

- **Three-point check.** I agree with BUILD §6.
  1. **Index audit, re-checked live today.** The verify statements plan as `SEARCH fund_holdings_monthly USING INDEX idx_holdings_series_month (series_id=? AND report_month=?)`, and the snapshot as `sqlite_autoindex_fund_snapshot_monthly_1`.
  2. **Largest single statement:** SPY's mark-complete, about 504 index rows.
  3. **Writes ≈ 12.5k rows_written:**
     - 1,039 inserts × about 9 (table + 8 indexes).
     - 1,039 mark-completes × about 3 (table + the status index delete and insert).
     - About 30 for the snapshots and `etf_master`.
     - Reads ≈ 3k for the apply and about 1.1k for a verify pass. Storage under 1 MB.
- **When to apply:**
  - Tue–Sat UTC, **07:30Z–11:30Z**. That is after the 06:00 expbf and 06:50 phase23 runs and before the 11:50 (London) enrich-boost run. Not Sunday (holdings 04:00Z). Not Monday (entities-seed 04:00Z; expbf also skips Mondays).
  - The account `rowsWritten` today, from meridian-ops `/api/ops/cf/d1-today` (read no more than 120 s before starting), must be **≤ 45,000**, so that 45,000 + 12.5k ≤ **58k**, the Control's live headroom including the 06:00 back-fill. If it is higher, do not start; try another day.
- **Verify queries:** one equality query per fund (§8.3). **Never** `series_id IN (…)` on holdings: D1 plans that on `idx_holdings_month` and reads the whole month (87,241 rows, BUILD D1).

## 8 · Apply procedure for MA-NOV-UIT.APPLY

### 8.1 Preflight (read-only, stop on any failure)
1. **Pins.** The sha256 of `uit-apply-run1.sql` is `720503fc…c15c0`, of `uit-rollback-run1.sql` `12695c51…739e`, and of `uit-summary.json` `8f94b0e6…8f43`. HEAD contains them.
2. **Day and time.** As in §7: Tue–Sat, 07:30–11:30Z, and today's expbf run has finished (heartbeat or ledger).
3. **Headroom.** The d1-today `rowsWritten` is ≤ 45,000, with the reading no older than 120 s.
4. **State recheck (2 statements).**
   - (a) `SELECT rowid, ticker, cik, series_id, has_nport, coverage_status, coverage_depth, net_assets, notes, updated_at FROM etf_master WHERE ticker IN ('SPY','QQQ','DIA','MDY');` must equal each fund's `etf_master_before` in `uit-summary.json`, with `updated_at = '2026-06-01 20:14:11'`. That is the state read today.
   - (b) This query must return `0, 0, 0, 0, 0`, and `max_id = seq`, both below 2,000,000. Today both were 798,655.
     ```sql
     SELECT (SELECT COUNT(*) FROM fund_snapshot_monthly WHERE series_id >= 'C' AND series_id < 'D') snap_c,
            (SELECT COUNT(*) FROM fund_holdings_monthly WHERE series_id >= 'C' AND series_id < 'D') hold_c,
            (SELECT COUNT(*) FROM fund_snapshot_monthly WHERE series_id = 'S000101292') snap_qqq,
            (SELECT COUNT(*) FROM fund_holdings_monthly WHERE series_id = 'S000101292') hold_qqq,
            (SELECT COUNT(*) FROM fund_holdings_monthly WHERE id >= 2000000) ids_hi,
            (SELECT MAX(id) FROM fund_holdings_monthly) max_id,
            (SELECT seq FROM sqlite_sequence WHERE name = 'fund_holdings_monthly') seq;
     ```

### 8.2 Batches (FIX2 / BOND.APPLY method)
- Run batches 1–14 in order. For each batch:
  - Take the statement lines verbatim from the pinned file: drop the comment lines, keep the statement bytes unchanged.
  - Run them with `npx wrangler d1 execute meridian-etf --remote --json --command <batch>`. Pass the SQL as an argv element, not through a shell string: the statements contain quotes and `&`.
  - Compare each statement's `meta.changes` with the header vector, and record rows_read and rows_written.
- **Stop on the first error or mismatch.**

| Batch | Fund | Expected vector | Σ |
|---|---|---|---|
| 1–5 | SPY | 100 × `1` each | 500 |
| 6 | SPY | `[1,1,1,1,504,1,1]` | 510 |
| 7 | QQQ | 100 × `1` | 100 |
| 8 | QQQ | `[1,1,1,1,1,105,1,1]` | 112 |
| 9 | DIA | 30 × `1`, then `30, 1, 1` | 62 |
| 10–13 | MDY | 100 × `1` each | 400 |
| 14 | MDY | `[400,1,1]` | 402 |
| **Total** | | | **2,086** |

### 8.3 Verify (after batches 6, 8, 9 and 14; one statement per fund, equality only)
```sql
SELECT (SELECT COUNT(*) FROM fund_holdings_monthly WHERE series_id = :key AND report_month = :month) n,
       (SELECT COUNT(*) FROM fund_holdings_monthly WHERE snapshot_status = 'complete' AND series_id = :key AND report_month = :month) c,
       (SELECT MIN(id) || '-' || MAX(id) FROM fund_holdings_monthly WHERE series_id = :key AND report_month = :month) ids,
       (SELECT ROUND(SUM(weight_pct), 4) FROM fund_holdings_monthly WHERE series_id = :key AND report_month = :month) w,
       (SELECT holdings_count || '|' || filing_date || '|' || period_end FROM fund_snapshot_monthly WHERE series_id = :key AND report_month = :month) snap,
       (SELECT cik || '|' || series_id || '|' || has_nport || '|' || coverage_status || '|' || coverage_depth FROM etf_master WHERE ticker = :ticker) em;
```
Write the literals in; D1 `--command` takes no binds. Expected:

| :ticker | :key | :month | n = c | ids | w | snap | em |
|---|---|---|---|---|---|---|---|
| SPY | C0000884394 | 2026-09 | 504 | 2000001-2000504 | 99.9702 | 504\|2026-11-25\|2026-09-30 | 0000884394\|C0000884394\|1\|deep\|1 |
| QQQ | S000101292 | 2026-06 | 105 | 2010001-2010105 | 100.2821 | 105\|2026-08-28\|2026-09-30 | 0001067839\|S000101292\|1\|deep\|1 |
| DIA | C0001041130 | 2026-07 | 30 | 2020001-2020030 | 99.9464 | 30\|2026-09-18\|2026-10-31 | 0001041130\|C0001041130\|1\|deep\|1 |
| MDY | C0000936958 | 2026-09 | 400 | 2030001-2030400 | 99.3446 | 400\|2026-11-25\|2026-09-30 | 0000936958\|C0000936958\|1\|deep\|1 |

After all four funds:

- `SELECT seq FROM sqlite_sequence WHERE name = 'fund_holdings_monthly'` = 2,030,400.
- `SELECT COUNT(*) FROM fund_holdings_monthly WHERE id > 2030400` = 0.
- IVV's `etf_master` row is unchanged (control).
- A d1-today reading after the apply.

Exposure-route checks (SPY at least 1 h after the apply) belong to the release packet.

### 8.4 Rollback triggers
- Any batch error or vector mismatch, or any verify mismatch.
- Any unexpected change to another ETF's stored rows or exposure body.
- A Founder request.

What to do for each:

- **A batch fails part-way.** Do not re-run from batch 1. Re-run batches 1..k would return 0 on the inserts already done, which is correct but is a vector mismatch. Either:
  - **(a) Resume:** re-run the failed batch alone. Statements already applied return 0 and the rest return their vector. Accept only that pattern. Or:
  - **(b) Roll back** per §8.5.
- **Default:** (b) if the failure is not a transient network error.

### 8.5 Rollback order
1. **Guard precheck (read-only, F2).**
   - Re-read the 4 `etf_master` rows. For each fund the apply completed, confirm the row equals `etf_master_after` with `updated_at = '2026-06-01 20:14:11'`.
   - If a completed fund's row no longer matches (for example, after a pipeline visit), **stop**. A new rollback must be derived in a separate packet. Do not run batch 1.
   - Funds whose `etf_master` batch never ran are expected to show `etf_master_before`. Their restore returns 0, which is correct.
2. **Rollback batch 1.**
   - After a full apply, the expected vector is `[1,1,1,1, 1,1,1,1, 504,105,30,400]`.
   - After a partial apply, each statement must return ≤ its expected value, matching what was applied.
3. **Rollback batch 2 (optional).** Expected `[1]`. Skip it if D1 refuses writes to `sqlite_sequence`.
4. **Re-verify.** The §8.3 query must give `n = 0`, no `snap`, and `em` equal to the before values (cik `0000884394`, `0001067839`, `0001041014`, `0000916132`; series NULL; `0|directory|0`). Also `SELECT COUNT(*) FROM fund_holdings_monthly WHERE id >= 2000000` must be 0.

## 9 · Boundaries kept
- **D1:** 11 read-only statements: SELECT and `EXPLAIN QUERY PLAN` on `sqlite_master` (triggers), `etf_master`, `fund_snapshot_monthly`, `fund_holdings_monthly` (PK, rowid and series-range probes only), `holdings_pipeline_state` (PK), `instrument_entity_map` (PK `IN` list), and `fund_entity_link` (`etf_symbol`). One was a `--file` call that returned no rows (2 rows read) and was repeated with `--command`.
  - About 2,670 rows read and 0 written.
  - No PRAGMA, no full scan of a large table, and no `series_id IN (…)` month read.
- **Not done:** no SEC or other external calls, no deploys, no `/run`, and no meridian-ops d1-today call.
- **Files not touched:** `.env*` (none read), Status, board, Tower, logs, `factory/`, and `13F Seed/gleif-seed.js`. No installs and no subagents.
- **Scratch only:** tests, the dry run and the check scripts (`q1.mjs`, `keys.mjs`) ran outside the repo, under the session scratchpad. The repo's `App/` is unchanged (`git status` clean for `App/`).
- **Written:** this report. One commit, pushed to `November-2026`.
