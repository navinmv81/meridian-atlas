# MA-OCT-011.RECON17 — Report

```text
CONTROL:      MA-OCT-011.RECON17 Control v1, SHA-256 82207c37659cc0b642626c06e6bb5bd60251b2b905e5785e5bd937d9f02651a5
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc and file review only: 0 D1 reads, 0 D1 writes, no deploys, no git writes, no key file opened.
DATE:         Sun 18 Oct 2026, about 08:15 UTC (due 09:00 UTC)
RESULT:       SAT 17 R-4 SIGNED — MATCH
```

## Preflight

- No `.git/*.lock` files. HEAD `0dd7ef0` (`git --no-optional-locks`).
- Control `82207c37…51a5` matches STATUS_BOARD row 45. Task `baee4804…bffda` matches the Control.
- **Read grant:** the Founder approved read access to `~/MeridianAtlas-work/gleif-011/recon/2026-10-17/` only, this session. I opened only the three files listed below. No key file is in that folder.
- **Independence:** I did not run, code or review the run. The recon reconciliation below is my own: I re-read every row with a local script, not the runner's `first_cut`.

## Inputs, as found on disk (all match; no stop)

| File | SHA-256 | Expected |
|---|---|---|
| `claude/packets/MA-OCT-011.RUN_Report.md` | `b26206a820e4fb7a03ae2147ef7b810d85c4a7d615d1bbc86ad3c1801264ef68` | ✔ Task |
| `recon/2026-10-17/manifest.json` | `264c7986acb7b9f1e65dba07344f82929f263a25a00050fbab901deb803c05c4` | ✔ RUN report |
| `recon/2026-10-17/ops_job_run.json` | `0865c2b762d1d59c0b42ffb8e282eddb96d697db5300b91d1961ad4fd2ed9a8f` | ✔ RUN report and manifest |
| `recon/2026-10-17/runlog.jsonl` | `f5df907237cec40373c717997a88d50486c1a242bd2b51c6c48f3c5f717edf17` | ✔ RUN report and manifest |
| `claude/packets/MA-OCT-011.P3R_Report.md` (C-1/C-2) | `84a1c78c6471372e303b01ad35fc48a6742affdc22e5fdbd2958e6a650e5b1ea` | ✔ RUN report |

## Checks

| # | Check | Independent result | Status |
|---|---|---|---|
| **1** | Every run-log line has an Ops end event | **24 run-log lines; 47 `ops_job_run` rows = 24 `end` + 23 `start`.** Every run-log `run_key` has exactly one end row, and **the outcome and `rows_written` agree on all 24** (0 field mismatches). 0 end rows without a run-log line; 0 starts without an end. All 47 rows are `job_id manual.gleif-reconcile-011`, `emitter_id gleif-011`, `trigger manual`. **14:34Z startup refusal:** run `bdaea2dc…`, end `failed` / `hold_check_failed`, Cloudflare `[code: 7403]` on the `hold_all_jobs` read, `rows_written 0`, `end_only 1` (no start was sent: it failed before any batch). It was received 14:35:24.829Z, i.e. spooled and then replayed by the next run. | ✅ **MATCH** |
| **2** | Writes | Run log sums to **24,752** batch writes, plus 47 delivered events × ≈ 5 (ML-1010-3) ≈ 235 = **24,987 ≤ 25,000**. **Batches in order with no duplicates:** P-001, P-002, B-001…B-021 (23). Per batch: P-001 3,000 (12 per insert, 1.09× — AUTOINCREMENT, as flagged in §4.2); P-002 637 (1.07×); B-batches 1,000–1,013, each = declared per the RUN report. All ≤ 1.3×. **Times:** 14:34:56–14:37:08Z on Saturday, inside the 11:20–16:40 run window; clear of 10:45–11:15, 16:45–17:15 and every other FREEZES.json window. | ✅ |
| **3** | Reads | Manifest `reads_011`: **cumulative 102,575 / 350,000**, today **29,086 / 200,000**, since 20:38:47.891Z. Cross-check: Friday 73,489 + Saturday 29,086 = 102,575 exactly. Batch-level `rows_read` in the Ops rows sums to 28,988; the remaining 98 are non-batch reads: the recon export (94), the P-002 raced-row point read (2), and the startup gate reads. Plus 1 diagnostic read outside the ledger (14:35, `hold_all_jobs`) → **102,576**. Largest execution ≤ 2,250 reads (P-001). | ✅ |
| **4** | S-1, raced row, OTP Bank, C-1/C-2 | **S-1:** P-001 and B-001 applied 250/250; P-002 53 applied + 1 raced; 0 mismatches; a checkpoint with SHA-256 on every forward line; heartbeats 201 — all before B-002 started. **Raced row:** `984500F099E8C6A0EE90` was created by live Phase 3 (entity **502685**, 06:50:44Z Sat) after Friday's export. Our `INSERT OR IGNORE` was ignored, and the RUN report's point read shows a single holder, version 1, untouched. **This is the designed outcome, not a defect.** **OTP Bank** (2019 / 467290): not in plan `e3854698…`; untouched. **C-1/C-2:** not triggered. The only `failed` line has 0 applied rows and no batch had started, and there was no `RUNNER ERROR`. | ✅ |
| **5** | Outbox and heartbeats | **47/47 events delivered** for 24 runs, so no event remains undelivered. The single spooled event (14:34Z `failed`) appears with `received_at` 14:35:24Z, so the replay worked live. These were the first live events from `gleif-011`; the emitter, key and registry work end-to-end. The outbox directory itself is outside my grant, so "empty" rests on the RUN report plus the 47/47 count. | ✅ |

## Result

**SAT 17 R-4 SIGNED — MATCH** (Operations Lead, LANE-1-OPS, Sun 18 Oct 2026 ≈ 08:15 UTC).

24/24 run-log lines matched, 0 unmatched. 011 writes 24,987 / 25,000, reads 102,575 / 350,000, 0 mismatches, cursor B-022.

## The runner's mechanical gate: action needed before Mon 19

The runner (`reconGate`, runner lines 291–301) refuses the next day's first batch unless `recon/2026-10-17/ops-signoff.json` exists with `date`, `signed_by` and a `result` starting MATCH or RECONCILED. **This Control lets me write only this report,** so I have **not** written that file.

- **Main Lane:** authorise one of these:
  - (a) the Engineering Lead writes the file from this report before Mon 19's first batch, or
  - (b) a one-line Control lets the Operations Lead write it.

  The content to use:

  ```json
  {"date":"2026-10-17","signed_by":"Operations Lead (LANE-1-OPS)","result":"MATCH — 24/24 run-log lines matched, 0 unmatched; writes 24,987/25,000; reads 102,575/350,000; 0 mismatches","source":"claude/packets/MA-OCT-011.RECON17_Report.md","signed_at":"2026-10-18T08:15Z"}
  ```

  If (a), add the report's SHA-256 as `source_sha256`.
- **Ops ruling OPS-R11:** **do not use `--outbox-live-confirmed`** to pass this gate during the 011 window. R-4 applies alongside the outbox (OPS-R8, RELOPS item 3), and an unsigned day blocks the next day's first batch.

## Mon 19 expectation (S-3)

- **Calendar:** no batch before 08:00 UTC. The seed freeze runs 03:30–08:00, and the bootstrap buffer 07:55–08:05 means effectively ≥ 08:05.
- **Start rule:** the first batch runs only if the account is ≤ 45,000 at the first check.
- **60k account gate:** the seed writes ≈ 33–34k. Mon's plan of 24,917 brings the account to ≈ 58–59k, so expect the gate to refuse the last batches of the day.
  - **Lag effect:** with a 25–30 min `d1-today` lag and the 45-min own-row window, the margin shrinks further.
  - Refusals are the gate working. The work rolls to Tue/Wed under 25k/day, and A can slip within the week.
  - Record each refusal in the Mon 19 section. If headroom stays unavailable for > 2 h, the RUN Task's stop applies.
- **Before Mon's first batch, as the board already says:**
  - B-1 to B-4 plus the duplicate-LEI-holder check are built and the Architect has reviewed them (P3R);
  - P-1 and P-2 are re-run on the new runner hash;
  - plan `shasum -c` OK;
  - this sign-off file is in place.
- **Remaining budget after Sat:** ≈ 60k of the ≈ 85k planned writes (≤ 110k), and ≈ 247k reads of headroom under 350k.

## Notes

- **The 7403 token-refresh race hit twice in two days** (Fri 16 export, Sat 17 startup), both at a wrangler OAuth refresh. Both times it failed closed before any write. The startup gate is behaving as wanted. If it recurs on a **write** batch, P-3 / B-1 govern: probe, then retry only if no row changed; otherwise `failed`, restore (C-1), re-run. Record each occurrence.
- **Daily cap margin:** Saturday ended 13 writes under 25k, because ML-1010-3's heartbeat writes are counted. That is as designed. Expect the same on full days.
- **P overrun closed:** +293 writes, all from AUTOINCREMENT on P inserts. P has no further batches.

## Stop point

Report written. No other files touched.
