# MA-NOV-DIAG.HEALTH — Report (read-only)

```text
PACKET:     MA-NOV-DIAG.HEALTH · Control v1 (2f932607…7283) · Task v1 (c0b600cf…c6a3)
RUN:        r-20261126T213643Z-a026 · interactive · 2026-11-26 21:36–21:50Z
EXECUTED:   Operations Lead + Data-Identity Lead
BASE:       November-2026 @ bb3815b (HEAD = origin)
READS:      D1 13 statements of 25 (~6,500 rows read of 150,000; no fund_holdings_monthly scan, no PRAGMA)
            SEC EDGAR 3 GETs of 3 · wrangler whoami 1 · wrangler deployments list 4 · launchctl list/print · local logs
WRITES:     0 D1 rows · 0 deploys · 0 job runs · files: this report only
```

## 1 · SPY — why `/api/exposure/etf/SPY` is 404 `no_series_id`

**Cause: structural (series-less UIT) plus a wrong data note. Not a code bug in the exposure route.**

Evidence:
- `etf_master` row SPY: `cik 0000884394`, `series_id NULL`, `has_nport 0`, `coverage_status directory`, note *"Grantor trust (UIT), not a 1940 Act fund. No N-PORT. Files annual report on Form 10-K."* The route does `etf_master.ticker → series_id` and returns 404 `no_series_id` when it is NULL (`App/Corporate Atlas/src/entities-api.js:1134`).
- Controls: IVV `S000004310` and VOO `S000002839` have series ids, `has_nport 1`, `deep`, and snapshots in `fund_snapshot_monthly` (latest 2026-03, 507 and 519 holdings).
- **SEC contradicts the note.** SPY's submissions (CIK 0000884394) show **29 NPORT-P filings plus 1 NPORT-EX (2019 to now)** and **no 10-K**. Most recent: NPORT-P filed 2026-11-25 for period 2026-09-30. Its filings are 1940-Act UIT forms (N-30D, NSAR-U, N-CEN, 485BPOS, S-6), file no. 811-06125.
- The NPORT-P for 2026-03-31 (`0001410368-26-055357`) has **503 holdings** and net assets of $651.6bn. Its header has `seriesName N/A`, a `seriesLei`, and **no `seriesId`**. A UIT has no series, so there is no S-number to store.
- The holdings pipeline only reaches funds by series id. It selects `has_nport = 1 AND series_id IS NOT NULL AND coverage = 'deep'` (`App/ETF Refresh/src/holdings-pipeline.js:103-105`). It finds filings by EFTS full-text search on the series id (`:213`) and discards any XML that does not contain the series id (`:280`). A series-less UIT cannot get through that path, even with `has_nport` set to 1.

The gap in the universe: 264 `etf_master` rows. 16 have no series id and 19 have `has_nport = 0`. Three rows have a series id but `has_nport = 0`; they are not examined here.

| Group | Tickers | N-PORT? | Fixable? |
|---|---|---|---|
| 1940-Act UITs (series-less) | **SPY**, **QQQ**, DIA, MDY | SPY confirmed (SEC). QQQ confirmed NPORT-P (latest filed 2026-08-28), and it now also files N-CSRS, which suggests it may have converted to an open-end fund with a series id (not checked, because the GET budget was used up). DIA and MDY are not checked; they are likely the same as SPY. | **Yes** |
| 1933-Act commodity / crypto trusts and LPs | GLD, IAU, SLV, IBIT, FBTC, BITB, EZBC, ETHA, FETH, DBO, UNG, USO | No (per the D1 notes; not checked against SEC) | No: there is no holdings filing to read. That is structural and correct. |

All 16 have `net_assets NULL`, so "largest by size" cannot be ranked from D1. By public size, SPY and QQQ are the two largest ETFs that have no exposure data.

**Recommended fix (not done):** one packet, owner **ETF Product Lead**, with Data-Identity Lead review. Size **medium**:
1. Add a CIK-keyed discovery path for series-less UITs in `holdings-pipeline.js`: list NPORT-P filings from the submissions JSON by CIK, and accept a filing where `regCik` matches and `seriesId` is absent.
2. Store these funds under a surrogate key in the `series_id` column, for example `C0000884394`. That leaves every `series_id`-keyed table and the exposure route unchanged.
3. Correct `etf_master` for SPY, DIA and MDY (set `has_nport = 1`, the surrogate key, `coverage_status = 'deep'`, and fix the note), and re-check QQQ's series id.
4. Write budget: about 500 holdings rows per fund per quarter (SPY 503), so under 10k rows for a 4-fund, 4-quarter back-fill. This needs the three-point check, because it changes Worker code and `etf_master`.

Separately, and smaller (UI owner): for the 12 commodity / crypto trusts, show "not a 1940 Act fund: no holdings filing" instead of "no holdings".

## 2 · Job health

Times are UTC. The last 3 runs are taken from `ops_job_run` end rows. Where a job does not report to the ledger, they come from its own log. "rw" is rows written.

| Job | Schedule (effective) | Last 3 runs | Pause | Verdict |
|---|---|---|---|---|
| `cf.meridian-holdings` (`888af088`, 6 Nov) | `0 4 * * sun` | 11-22 partial, 12/20 ETFs, rw 81,809 · 11-15 partial, 4/20, rw 80,770 · 11-08 partial, 13/20, rw 80,361 | none; `hold_all_jobs=false` | **LATE**: the write guard stops every run. Offset 149/237. `cycle.last_complete_at = null` (it has never completed a cycle). Health-check predicts the next batch at 157,160 writes against an 80k guard. |
| `cf.meridian-entities-seed` (`135607d4`) | `0 4 * * mon` | 11-23 success (4 steps, 122 s) · 11-16 success · 11-09 success | none | **OK**: now fires on Mondays (MA-OCT-012 fix holds) |
| `cf.meridian-entities-enrich.phase1` (`aa39edf6`, 21 Nov) | `0 6 * * *` | 11-26, 11-25, 11-24 success: 100 attempted, `isins_populated 0` | none | **OK** (idle: no progress for at least 4 days) |
| `cf.meridian-entities-enrich.phase23` | `50 6 * * *` | 11-26, 11-25, 11-24 success: phase2 0, phase3 0 | none | **OK** (idle) |
| `cf.meridian-entities-enrich.expbf` | `0 6 * * *` (same Worker) | 11-26 partial: 23 holders, rw 17,290, rr 135k · 11-25 partial: 16, rw 32,420 · 11-24 partial: 15, rw 34,274 | pause #3 ended 2026-11-22T10:14Z | **OK**: partial by design. The backlog is draining (holder-months left 201 → 185 → 162; oldest open month 2026-04). |
| `cf.meridian-bootstrap` (`b2ab8f09`) | `0 */4 * * *` | 11-26 20:00, 16:00, 12:00 success: rw 0, 0 resolved | none | **OK**: runs, but has done no work since the bootstrap completed (2026-06-11). It still takes 1 of 5 cron slots. |
| `local.entities-enrich-boost` | 11:50 and 17:50 London | 11-26 17:50 HTTP 200 · 11-26 11:50 HTTP 200 · 11-25 17:50 HTTP 200 | flag absent; pause #2 ended 11-07 | **OK**. One failure: 11-19 17:50, `headroom check failed: d1-today unavailable: TimeoutError`. The `enrich_phase3_last_run_*` keys have not changed since 11-22 11:50, so the triggered runs find no work. |
| `local.health-check` | 08/12/18/22 London | 11-26 18:00, 12:00, 08:00 success (18 to 22 findings, raised 0 or 1; open sev2 6, sev3 89) | none | **OK**: alive since 2026-10-13, 358 ledger rows |
| `local.firds-weekly-seed` | Sun 11:00 London | 11-22 success (+38 instr, +20 entities) · 11-15 success (+40) · 11-08 success (+216) | flag absent | **OK** now. It failed **5 Sundays in a row (10-04 → 11-01)** at the first `wrangler d1 execute` SELECT. It does not report to the ledger (no `emitter_id`). |
| `local.financialfact-backfill` | daily 09:00 London | No run has produced output since 2026-08-23. `launchctl`: 53 runs, **last exit 78 (EX_CONFIG)**. The last log says it skipped for headroom (114k/100k). Offset 2605, unchanged since 2026-08-06. | registry `status = held` | **SILENT** (held in the registry, but the agent is still loaded and fails every day) |
| `cf.meridian-entities-delta` | none (cron commented out) | no ledger rows | registry `held` | **RETIRED / held**: has never run |
| `cf.meridian-firds` | none | — | registry `retired` | **RETIRED** |
| `manual.gleif-reconcile-011` | manual | 10-21 18:14 success (A-001 restore) · 10-21 13:07 success · 10-20 success | `ingest_enabled = 0` | **RETIRED** (one-off, complete) |
| `local.bonds-ingest` | manual | 10-16 18:39 success (521 attempted, rw 2,259) · 10-16 18:38 · 10-16 18:38 | — | OK (manual, not scheduled) |
| on-request Workers: `figi`, `api` (`e35d7c55`), `ops`, `proxy`, `13f`, `filings` | none | not in ledger (on request) | — | n/a |
| 28 `manual.*` scripts | none | none in ledger | — | n/a (not scheduled) |

**Cron slots: 5 of 5.** holdings 1, bootstrap 1, entities-seed 1, entities-enrich 2. Evidence is the toml `crons` lines plus the trigger strings the ledger receives from each cron (`cron:0 4 * * sun`, `cron:0 */4 * * *`, `cron:0 4 * * mon`, `cron:0 6 * * *`, `cron:50 6 * * *`). The schedules API was not called, and wrangler has no read-only triggers listing. `expbf` shares the enrich Worker's 06:00 trigger and does not take a slot of its own.

**LaunchAgents loaded: 4.** `com.meridianatlas.{entities-enrich-boost (exit 0), firds-weekly-seed (0), health-check (0), financialfact-backfill (78)}`. No other `com.meridian*` agent exists. No GLEIF agent exists.

## 3 · Problems and suggested next steps (ranked)

1. **SPY / QQQ / DIA / MDY have no exposure data.** Structural: the pipeline keys on series id. Next step: the UIT CIK-path packet in §1 (ETF Product Lead, medium).
2. **The holdings cycle never completes (LATE).** About 8 to 13 ETFs per Sunday against an 80k guard, and the predicted next batch is 157k. Next step: an ETF Product Lead packet to size Sunday batches to the budget, or split the run across days. It was flagged in September and is unchanged.
3. **`local.financialfact-backfill` is SILENT**, exit 78 every day since about 23 Aug, while the registry says `held`. Next step: the Operations Lead decides between uninstalling the agent (it matches `held`) and diagnosing exit 78 (plist / TCC, see `claude/Escalation_LaunchAgent_TCC_Permission.md`). Its own log last says it skipped for headroom (114k/100k on 23 Aug).
4. **FIRDS failed 5 weeks in a row (10-04 → 11-01) with no alert**, because it has no ledger emitter, so health-check cannot see it. It has recovered since 11-08. Next step: add the FIRDS seed as a ledger emitter (Data-Identity Lead, small). The underlying error text is truncated in the log, so whether it was code 10000 cannot be confirmed.
5. **`meridian-bootstrap` uses a cron slot doing nothing** (6 runs a day, rw 0). Next step: a three-point-check packet to remove its cron, which frees 1 of 5 slots.
6. Enrich phase1, phase2/3 and the boost all run but make no progress. Low priority: confirm the queue really is empty before spending boost runs on it.

## 4 · Changes since MA-OCT-000 (2026-09-23)

- **entities-seed:** the Sunday drift is fixed. It now fires Monday 04:00 (11-09, 11-16, 11-23) and no longer co-fires with holdings.
- **health-check:** was FAILING/SILENT (exit 78, last log 08-22). It is now **OK**: reinstalled 10-13 at 4 runs a day, reporting to the ledger.
- **boost:** the evening run was FAILING every day (code 10000). It is now **OK** (one TimeoutError on 11-19).
- **FIRDS:** still intermittent. It went from 3 failures in 6 runs to 5 failures in a row, then 3 successes.
- **financialfact:** unchanged. Still SILENT with exit 78, and now marked `held` in the registry.
- **holdings:** offset 31 → 149 of 237. Still partial every Sunday, and still has never completed a cycle.
- **bootstrap:** unchanged. Idle, holding a slot.
- **New jobs:** `ops_job_registry` (MA-OCT-002) and the `ops_job_run` ledger (923 events since 10-01); `cf.meridian-entities-enrich.expbf` (MA-NOV-EXP.BFS, live 11-22); `local.bonds-ingest` and `manual.gleif-reconcile-011` (manual, October). `ops_job_pause` holds 3 rows, none active.
- **Redeployed:** holdings, bootstrap and entities-seed on 11-06; entities-enrich on 11-21; entities-api on 11-26.

## 5 · Boundaries kept

- **Reads:** 13 of 25 D1 statements, about 6,500 of 150,000 rows. No full scan of `fund_holdings_monthly` and no PRAGMA. One statement (a 12-way UNION) returned 0 rows because of a query-shape fault; it was re-run as a window query over the 923-row `ops_job_run` and is counted.
- **SEC:** 3 of 3 GETs, sent with a generic User-Agent that carries no personal e-mail, instead of the repo's string, which contains one.
- **No fixes:** no D1 writes, `/run` calls, `launchctl load`/`unload`/`kickstart`, pause or resume scripts, deploys, or toml / cron / secret changes.
- **Secrets:** plists were read for names, schedules and log paths only. No `.env` values or tokens were printed.
- **Not touched:** Status files, board, Tower, `transitions.jsonl` and logs. No installs and no subagents. `13F Seed/gleif-seed.js` was not opened; it was excluded from every grep.
- **Written:** this report only.
