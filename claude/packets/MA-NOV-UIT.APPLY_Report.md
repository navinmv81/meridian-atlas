# MA-NOV-UIT.APPLY — Report (UIT holdings written to D1)

```text
PACKET:     MA-NOV-UIT.APPLY · Control v1 (ebae5b0a…9e6b ✔) · Task v1 (7b641343…eefd ✔) · usage class small
RUN:        r-20261127T155551Z-6a38 · interactive · Fri 2026-11-27 15:55Z–15:59Z
EXECUTED:   ETF Product Lead + Tech Ops (LANE_OPENER_v2, sha256 67913343…71d6 ✔)
BASE:       November-2026 @ e8868b3 (HEAD = origin/November-2026)
OUTCOME:    DONE. 14/14 batches matched their vectors (Σ 2,086). All 4 verify rows equal REVIEW §8.3. No rollback.
WRITES:     D1 meridian-etf: 11,450 rows_written (batch meta) · repo: this report only.
READS:      D1 9 read-only statements of 15 · 4,195 rows read of 15,000 (plus 5,203 read by the batches themselves).
```

## 1 · Preflight (REVIEW §8.1, with the Control's time amendment)

| Check | Result |
|---|---|
| Folder · branch · remote · `.git/*.lock` | `…/Meridian Atlas Clean (v11)` · `November-2026` · `navinmv81/meridian-atlas` · no lock ✔ |
| HEAD = origin | `e8868b3be6d1…cabea7` both (after `git fetch`) ✔ |
| Control / Task pins | `ebae5b0af663eb2a4abda9e5d9e963fcb5d1da3100836f3e957a4448d99a3e6b` · `7b641343cbec412f31a7b3eae27e067cfec18b32ecb26ff76ad386e35246eefd` = Status file ✔ |
| Task pins (5 files) | REVIEW `bc9a38b8…aa58` · BUILD `4a1ff129…def1` · apply SQL `720503fc…c15c0` · rollback SQL `12695c51…739e` · summary `8f94b0e6…8f43` — all full sha256 match ✔ |
| `wrangler whoami` | OAuth, `d1 (write)` ✔ |
| UIT tests | `uit-build.test.mjs` **11 pass, 0 fail** ✔ |
| Day / time | Friday; batch 1 started 15:57:59Z, last batch ended 15:58:45Z. Clear of 11:40–12:10Z and 17:40–18:10Z ✔ |
| expbf ended today | `ops_job_run` end row `cf.meridian-entities-enrich.expbf`: `partial`, started 06:00:50.920Z, ended 06:00:51.382Z, rw 32,096 ✔ |
| Headroom | d1-today at **15:57:59Z**: `rowsWritten` **32,198** ≤ 45,000 (read ≈ 1 s before batch 1) ✔ |
| §8.1 4(a) `etf_master` | rowids 38 DIA / 140 MDY / 156 QQQ / 200 SPY; cik, series_id NULL, has_nport 0, `directory`, depth 0, net_assets NULL, notes, `updated_at 2026-06-01 20:14:11` — equal to `etf_master_before` for all 4 ✔ |
| §8.1 4(b) | `snap_c 0, hold_c 0, snap_qqq 0, hold_qqq 0, ids_hi 0`, `max_id 798655 = seq 798655` ✔ |

## 2 · Batches (REVIEW §8.2)

Method: statements taken verbatim from the pinned file (comment and blank lines dropped; the runner re-checked the file's sha256, 14 headers, 1,051 statements and each batch's statement count = vector length before running). Each batch ran as one `npx wrangler d1 execute meridian-etf --remote --json --command <batch>`, SQL passed as an argv element (no shell string), no `-c`. Each statement's `meta.changes` was compared with the header vector. No errors, no code 10000, no retries.

| Batch | Fund | Statements | Expected Σ | Σ changes | Vector match | rows_read | rows_written |
|---|---|---|---|---|---|---|---|
| 1 | SPY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 2 | SPY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 3 | SPY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 4 | SPY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 5 | SPY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 6 | SPY | 7 | 510 | 510 | ✔ `[1,1,1,1,504,1,1]` | 1,522 | 1,050 |
| 7 | QQQ | 100 | 100 | 100 | ✔ | 200 | 897 |
| 8 | QQQ | 8 | 112 | 112 | ✔ `[1,1,1,1,1,105,1,1]` | 327 | 261 |
| 9 | DIA | 33 | 62 | 62 | ✔ `[30×1, 30, 1, 1]` | 152 | 336 |
| 10 | MDY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 11 | MDY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 12 | MDY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 13 | MDY | 100 | 100 | 100 | ✔ | 200 | 900 |
| 14 | MDY | 3 | 402 | 402 | ✔ `[400,1,1]` | 1,202 | 806 |
| **Total** | | **1,051** | **2,086** | **2,086** | **14/14** | **5,203** | **11,450** |

Row-writes came in under REVIEW §7's ≈ 12.5k estimate.

## 3 · Verify (REVIEW §8.3)

Run after batches 6, 8, 9 and 14; one equality statement per fund (no `series_id IN (…)`).

| Ticker | n = c | ids | w | snap | em | Match | rows_read |
|---|---|---|---|---|---|---|---|
| SPY | 504 = 504 | 2000001-2000504 | 99.9702 | 504\|2026-11-25\|2026-09-30 | 0000884394\|C0000884394\|1\|deep\|1 | ✔ | 2,022 |
| QQQ | 105 = 105 | 2010001-2010105 | 100.2821 | 105\|2026-08-28\|2026-09-30 | 0001067839\|S000101292\|1\|deep\|1 | ✔ | 422 |
| DIA | 30 = 30 | 2020001-2020030 | 99.9464 | 30\|2026-09-18\|2026-10-31 | 0001041130\|C0001041130\|1\|deep\|1 | ✔ | 126 |
| MDY | 400 = 400 | 2030001-2030400 | 99.3446 | 400\|2026-11-25\|2026-09-30 | 0000936958\|C0000936958\|1\|deep\|1 | ✔ | 1,606 |

Final checks:

- `sqlite_sequence` (`fund_holdings_monthly`) = **2,030,400** ✔; `COUNT(*) WHERE id > 2030400` = **0** ✔.
- **IVV control:** the full live `etf_master` row (15 columns) is byte-equal to the IVV row in `uit/seed/d1-before.json` (read earlier today) ✔.
- **d1-today after** (15:58:59Z): `rowsWritten` 32,198 — unchanged from before. Cloudflare analytics lags 25–30 min (ML-1012-1), so the apply is not yet visible there. Expected once it lands: ≈ 32,198 + 11,450 ≈ **43.6k**, inside the 58k live headroom. The Control allows only one GET after, so no later reading was taken; Main Lane can confirm it from the Ops tab.

## 4 · Writes and reads

| | Statements | Rows read | Rows written |
|---|---|---|---|
| Preflight reads (ledger, §8.1 4a, 4b) | 3 | 16 | 0 |
| Batches 1–14 | 14 calls / 1,051 statements | 5,203 | 11,450 |
| Verify (4 funds) | 4 | 4,176 | 0 |
| Final (seq + ids, IVV) | 2 | 3 | 0 |
| **Read-only total** | **9 of 15** | **4,195 of 15,000** | **0** |

HTTP: 2 unauthenticated GETs to meridian-ops `/api/ops/cf/d1-today` (before, after). No token was read or printed. No SEC calls.

## 5 · Rollback — ready, not used

No trigger fired (no error, no mismatch, verify exact, IVV unchanged, no Founder request). If a later trigger arises, follow REVIEW §8.5 in this order:

1. **Guard precheck (read-only, F2):** re-read the 4 rows; each must equal `etf_master_after` with `updated_at = '2026-06-01 20:14:11'`. If any differs (for example QQQ after a pipeline visit), stop — a new rollback needs its own packet.
   ```sql
   SELECT ticker, cik, series_id, has_nport, coverage_status, coverage_depth, notes, updated_at FROM etf_master WHERE ticker IN ('SPY','QQQ','DIA','MDY');
   ```
2. **Rollback batch 1** of the pinned `App/ETF Refresh/uit/apply/uit-rollback-run1.sql` (sha256 `12695c51a48548b92c39de0e77ab9df89744f44d460e6420202a6417b9de739e`), same argv method:
   `npx wrangler d1 execute meridian-etf --remote --json --command <batch-1 statements>` — expected `[1,1,1,1, 1,1,1,1, 504,105,30,400]` (Σ 1,048).
3. **Rollback batch 2 (optional):** `sqlite_sequence` restore guarded on `seq = 2030400`, expected `[1]`; skip if D1 refuses.
4. **Re-verify:** §8.3 query per fund gives `n = 0`, no `snap`, `em` = before (cik `0000884394`, `0001067839`, `0001041014`, `0000916132`; series NULL; `0|directory|0`); `COUNT(*) WHERE id >= 2000000` = 0.

QQQ's rollback stays exact until the pipeline cursor reaches rowid 156 (REVIEW F1); SPY/DIA/MDY surrogates take 0 pipeline writes.

## 6 · What changes now (from REVIEW, for the release packet)

- MDY's Holdings tab shows stored 2026-09 holdings immediately (not in `NO_NPORT`); SPY, QQQ, DIA still show "no N-PORT" until `ma-etf.js:1205` drops them (F4 — release-packet follow-up).
- `/api/etf-list` reports the 4 as `deep`; reverse lookups and overlap include them (F6).
- No `entity_exposure_monthly` facts for the 4 — `fund_entity_link.series_id` is NULL (F5, Entities-domain packet if wanted).
- SPY exposure-route live check (≥ 1 h after 15:58:45Z, i.e. after 16:59Z) belongs to MA-NOV-PATCH.REL.

## 7 · Boundaries kept

- **D1:** only the 14 pinned batches (each once) and 9 read-only SELECTs. No other SQL write; no `holdings_pipeline_state`, Entities-domain tables or `fund_entity_link`; no PRAGMA; no `series_id IN (…)`; rollback not run; optional rollback batch 2 not run.
- **Not done:** no deploys, toml, cron, secret or Worker changes; no `docs/`; no installs; no subagents.
- **Files:** pinned files not edited or rebuilt (sha256 re-checked by the runner). The runner and raw results live in the session scratchpad, outside the repo. Not touched: `.env*`, Status, board, Tower, `transitions.jsonl`, logs, `factory/`, LANE_OPENER files, Main Lane records, `13F Seed/gleif-seed.js`.
- **Repo write:** this report only; one commit, pushed to `November-2026`.
