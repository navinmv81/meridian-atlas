# MA-OCT-013 — R-4 run-log reconciliation sign-off (Operations Lead, LANE-1-OPS)

**Packet:** MA-OCT-013.OPSSIGN · **Date:** Fri 6 Nov 2026, checked 18:52–19:00Z · **Basis:** spec rev 1 `e6dc8567…f098` §9 (R-4 fallback when there is no emitter); RUN report `0152c923…4ccb`; Ops review M-1..M-6.

## VERDICT: **SIGNED WITH NOTE**

The run log, the D1 ledger and the account `d1-today` reading reconcile for 6 Nov:
- 38 of 38 batches show `success`;
- no batch was re-run after a RUNNER ERROR;
- no write fell inside a freeze band.

The notes below are evidence gaps and wording corrections. None of them blocks the sign-off.

## Inputs (hash-checked, read-only)
| File | Path (actual) | SHA-256 | Match |
|---|---|---|---|
| recon | `~/MeridianAtlas-work/merge-013/recon/recon-2026-11-06.json` | `221af4b1a0c77696a758cc849e5da3ed062671acfcb087aea76f85ee8aca3d9a` | ✅ `221af4b1…3d9a` |
| run log | `~/MeridianAtlas-work/merge-013/runlog.jsonl` | `d5cdb72b40988e2f4c627e7152d1c5f4226a44a202e6fd44f80ebb6d9d1a58e2` | ✅ `d5cdb72b…d1a58e2` |
| D1 ledger | `~/MeridianAtlas-work/merge-013/d1-ledger.jsonl` | `6498ac12ca89fc43b8a4830fef8bcb013b95028def07fec3a34e63deedadc4f4` | ✅ `6498ac12…c4f4` |
| runner | run worktree `190ea2f`, `merge-013.mjs` | `9ee97999…8499` | ✅ = CHECK2 |

## 1. Run log ↔ D1 ledger ↔ recon
- **Run log:** 39 lines, all `step: merge`.
  - 1 line is `headroom_unavailable`: B01 at 12:29:37Z, with 0 rows and 0 writes.
  - 38 lines are `success`, one each for B01..B38, with no duplicates.
  - Totals: **1,862 merged (attempted = merged in every batch), 0 raced, 11,298 writes.**
- **Recon:** `runlog_lines 39`, `runlog_writes 11298`, `ops_events 0`. Its embedded run-log array is **identical** to `runlog.jsonl`.
- **D1 ledger:** 416 entries in time order, from 12:27:28Z to 16:34:10Z. **Rows written: 11,324**, made up of:
  - `merge-B01..B38`: **11,298**. Each batch's ledger `rows_written` equals its run-log `writes`, with **0 mismatches** (the spec §9 stop is > 5).
  - `lei-113390`, `lei-110563`, `lei-2778`: **24** (8 rows each; see note N-2).
  - `migrate`: **2**.
  - Every other label (pre-images, read-backs, probes, verify, recon): 0.
- **Lane write total (6 Nov):** 11,298 + 24 + 2 = 11,324 in the ledger. Adding the 3-row pause insert (N-3) gives **11,327**.

## 2. Against `d1-today` (6 Nov)
- `GET /api/ops/cf/d1-today` at 18:52Z returned `rowsWritten` **11,539** for `date: 2026-11-06`.
- **Expected:** 165 (the pre-run reading at 12:03:33Z) + 11,327 (this lane) = **11,492**. The **residual is +47**: positive and small.
- **The residual comes from other jobs after 12:03Z,** all of which appear in `ops_job_run` for today:
  - `cf.meridian-bootstrap` at 16:00Z;
  - the boost at 17:50Z (start + success, plus its own processing);
  - `local.health-check` at 18:00Z.
  
  At about 5 rows per Ops event (ML-1010-3), 5 events come to about 25 rows. The rest is the boost's own work. `d1-today` also lags 25–30 minutes (F-5).
- **Today has no `manual.entity-merge-013` events,** which matches `ops_events 0` (there is no emitter).
- **Caps:** the lane's 11,327 is under 25,000 (own cap), and the account's 11,539 is under 60,000 (ceiling) and 11.5% of the 100k daily cap.

## 3. Every batch `success`, and no re-run after a RUNNER ERROR
- **12:29:37Z, headroom stop:** a gate refusal before B01's pre-image. The 12:29Z ledger has no `merge-*` or `pre-*` entry.
- **13:29:15Z, RUNNER ERROR (Cloudflare 7403) on the first read:** **no trace in the run log, heartbeat log or ledger.** The ledger has **no entry at all between 12:29:36Z and 16:06:40Z**, so nothing was read successfully or written in that window (see N-1).
- **16:06:40Z:** the start sequence (index precondition → redirect table → hold → boost pause) ran, then **B01 ran once** (`merge-B01`, 300 writes).
  - 38 pre-images are present. B01 has the only read-back file. 1 `merge-B01` ledger entry.
  - This was the Founder-approved resume ("Yes, resume") of a batch that had never started, not a re-run.
- **16:30:05Z:** the start sequence ran again, then B02..B38 (`--pilot-ok "DI-Spot-Reviewer-B01"`, after the B01 spot check passed 20/20).
- **16:33:41–16:33:46Z:** the 3 LEI fills, each pre-check → write → read-back. **The last write is at 16:33:45.847Z.**
- **Bands:** every write timestamp falls outside the live FREEZES bands:
  - 12:27:17Z (pause row) and 12:29:19Z (migrate) are after the 11:45–12:15 band;
  - 16:06–16:33:46Z is before the 16:45–17:15 band.

## 4. Spec rev 1 §9 / Ops M-1..M-6
| Item | Status |
|---|---|
| M-1 observability | Not done: there is no `merge-013` emitter or key, so this R-4 sign-off is the fallback (§9). Do not use `--outbox-live-confirmed` (OPS-R11); it was not used. |
| M-2 kill switch | `merge-013.sh`, its own work dir `merge-013/` (700) and its own flags were used. |
| M-3 other writers | Boost: flag + `pause_id 2`, run window clear. Enrich crons (06:00/06:50) and bootstrap ran before the run window or outside it. Seed, FIRDS and delta not in the window. |
| M-4 dangling references | Per-batch §10 probes and R8 verify: every reference probe is 0, `ok: true` (RUN report; `ref-probes` entries in the ledger). |
| M-5 budget | Lane 11.3k against the 25k cap; account 11.5k against the 60k ceiling. |
| M-6 restore | 38 pre-images on disk. Per-batch restore is still available. |

## 5. Boost pause row `pause_id 2`: end it early?
- **Read-back:** `pause_id 2`, `local.entities-enrich-boost`, `2026-11-06T12:05:00Z → 2026-11-07T14:00:00Z`. That is 1 D1 read.
- **Facts:**
  - The flag was removed at 16:43:56Z.
  - The boost has **already fired normally**: `start` + `success` at 17:50:03–17:50:04Z.
  - No boost code reads the row. It only stops Ops monitoring from expecting boost events.
  - The only fire still inside the window is **Sat 7 at 11:50Z**.
- **Ops decision: do NOT end it early. Let it expire at Sat 7 14:00Z.**
  - Ending it early is a production D1 write (a guarded `UPDATE … ends_at`). That needs its own change with a three-point check, and this packet is read-only.
  - What it gains is small: missed-run alerting for that one Saturday 11:50Z fire.
  - Any miss would still be visible from the absence of `ops_job_run` events.
  - **Operations Lead action, Sat 7 after 14:00Z:** confirm the 11:50Z boost has `start` + `success` events, and that the row has lapsed (`ends_at` in the past).

## Notes (the reasons for "WITH NOTE")
- **N-1 (evidence gap):** the 13:29:15Z RUNNER ERROR (7403) is **not recorded in the run log or heartbeat log**. The runner failed on its first read, before it could append anything.
  - The only evidence is the RUN report and the absence of activity: no ledger entry from 12:29:36Z to 16:06:40Z, and B01 has only one success line and one pre-image.
  - This shows that the run-log fallback cannot see errors that happen before the gates. That is acceptable here, because the error made 0 writes.
  - **Recommendation for November item #1:** the runner should append a run-log line for D1 errors during startup.
- **N-2 (wording):** "+3 LEI" in the RUN report counts **entity changes**. The D1 rows written for them are **24** (8 per LEI, including index maintenance). The totals above use 24.
- **N-3 (outside the ledger):** the 3-row `pause_id 2` insert (12:27:17Z, `boost-pause-row.sql` `9387ae41…24d0`) was run outside the runner, so it is not in `d1-ledger.jsonl`. It is evidenced by the RUN report and confirmed by today's read-back.
- **N-4 (path):** the Task gives the input path as `~/MeridianAtlas-work/ma-oct-013/…/recon`. The files are actually in `~/MeridianAtlas-work/merge-013/` (the runner's own work dir, spec §9). Their hashes match the Task's.
- **N-5 (process, already logged by the lane):** OPS-R12 was not repeated before the 13:29Z resume. It was repeated before the 16:06Z and 16:30Z starts.

## Hygiene (this sign-off)
- **Reads:** `/usr/local/bin/wrangler` 4.96.0, `whoami` OK (account `ea360704…`). **17 D1 reads, 0 writes:** pause row 1, plus 16 `ops_job_run` rows today via `idx_ops_job_run_received`. One `d1-today` GET.
- **No changes:** no deploys, no git writes, no secret file read (`013.env` was not opened; ML-1024-1), and no command that could raise a macOS prompt (ML-1013-3).

— Operations Lead (LANE-1-OPS), Fri 6 Nov 2026
