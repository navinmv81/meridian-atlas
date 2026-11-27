# MA-NOV-UIT.BUILD — One-off N-PORT holdings for series-less UITs (SPY, QQQ, DIA, MDY): script + offline dry run + apply SQL (not run) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26
EXECUTED BY:  ETF Product Lead + Engineering Lead (ETF domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  MA-NOV-UIT.REVIEW (independent) before any write; Main Lane
APPROVED BY:  Founder — patch plan (NML-1126-6); Start Approval required. Offline only: no D1 writes, no deploys
PACKET:       MA-NOV-UIT.BUILD · Control v1 · usage class medium · write owner ETF Product Lead
```

## Why
MA-NOV-DIAG.HEALTH §1: SPY (and likely QQQ, DIA, MDY) are 1940-Act UITs that **do** file NPORT-P but have **no series id**. The holdings pipeline finds and stores funds only by series id, so `/api/exposure/etf/SPY` returns 404 `no_series_id`, and `etf_master` says SPY files no N-PORT, which is wrong. Patch for November: a **one-off** load of each UIT's latest NPORT-P, keyed by a surrogate `series_id = 'C' + 10-digit CIK`, so every series-keyed table and the exposure route work unchanged. The Sunday `meridian-holdings` job is **not** changed; the permanent CIK path is December work.

## Scope
1. **Confirm each fund** with SEC (submissions JSON by CIK): SPY `0000884394`; QQQ, DIA, MDY CIKs from `etf_master`. For each: files NPORT-P? has a real `seriesId` now (QQQ may have converted to an open-end fund)? latest NPORT-P accession and period. A fund with a real series id gets that id instead of a surrogate; a fund with no NPORT-P is dropped (reported).
2. **Script** `App/ETF Refresh/uit/uit-nport-load.mjs`: fetches the latest NPORT-P XML per fund (cached to `App/ETF Refresh/uit/cache/` as `.xml.gz` with sha256), and builds the rows **with the pipeline's own code path** — reuse `storeHoldings` (and its helpers) from `src/holdings-pipeline.js` via a **recording D1 shim** that turns its `prepare/bind/batch` calls into SQL text. The only allowed edit to `holdings-pipeline.js` is adding `export` to the functions the script reuses (no behaviour change; the deployed Worker is not redeployed). If `storeHoldings` checks the series id inside the XML, pass the surrogate through the shim's input without changing the function; if that is impossible without a behaviour change, stop and report.
3. **Apply SQL** `App/ETF Refresh/uit/apply/uit-apply-run1.sql` + `uit-rollback-run1.sql`: guarded (`INSERT OR IGNORE`, batches ≤ 100 statements with per-statement expected-changes vectors in headers, as the bond apply files), covering: the holdings + snapshot rows the pipeline would write for one period per fund; and the **`etf_master` correction** for each fund (`series_id` = surrogate or real id, `has_nport = 1`, `coverage_status = 'deep'`, note corrected: "1940-Act UIT, files NPORT-P, no series id; surrogate key C<cik>; loaded one-off by MA-NOV-UIT"), guarded on the current row values so it changes nothing if the row moved. Rollback restores the exact prior `etf_master` values and deletes exactly the inserted rows. No writes to `holdings_pipeline_state` cursors/offsets.
4. **Dry run** on a local `node:sqlite` copy seeded from read-only D1 reads (schema + the 4 `etf_master` rows + IVV/VOO controls): apply → verify counts and shapes match IVV/VOO's stored rows → re-apply = 0 changes → rollback = byte-identical to the seed.
5. **Exposure readiness (read-only):** how the R-EXP1 route picks the month for a series and whether it needs `fund_snapshot_monthly` or other rows; what share of SPY's holdings map to entities (by the route's own join, on the local copy with the needed mapping rows read, or estimated by CUSIP overlap with IVV); whether the route's edge cache holds SPY's 404 and for how long, and whether a cache-generation bump (an entities-api deploy) is needed — **record only**, the release packet does it.
6. **Three-point check** in the report: index audit of every write and verify query, single-execution read test (< 50k), read/write budget.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). D1 reads from the repo root with `--remote`, no `-c`. Code 10000: retry once after `whoami`. Writable (checked by `end`): `App/ETF Refresh/uit/` (new: script, cache, tests, apply), `App/ETF Refresh/src/holdings-pipeline.js` (`export` keywords only), `claude/packets/MA-NOV-UIT.BUILD_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edits within scope; tests (`node --test`, node:sqlite); **read-only** D1 SELECTs / `sqlite_master` / `EXPLAIN QUERY PLAN` (≤ 20 statements, ≤ 60,000 rows; no full scan of `fund_holdings_monthly`, no PRAGMA integrity checks); up to **20 SEC GETs** (EDGAR submissions JSON, filing indexes, NPORT XML), ≤ 10/s, with a contact User-Agent naming the project (no personal e-mail — use the form the DIAG report used); read-only GETs to the public exposure route; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Any D1 write; deploys; changes to `meridian-holdings` behaviour, toml, crons, secrets; other Workers; `holdings_pipeline_state`; Entities-domain tables; `docs/`; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
`storeHoldings` cannot be reused without a behaviour change; the surrogate key would collide with an existing `series_id`; dry-run mismatch; existing suites failing; push rejected.

## Success conditions
Per-fund confirmation table; script + tests; apply/rollback SQL with vectors and sizes; dry run clean (apply, re-apply 0, rollback identical); exposure readiness and cache note; three-point check; one commit pushed; report; `end`. Nothing written to D1.
