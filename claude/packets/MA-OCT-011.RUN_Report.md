# MA-OCT-011.RUN — Report

**Control:** v2 `claude/packets/MA-OCT-011.RUN_Control_v2.md`, SHA-256 `3dd48922e64a9342c44cf4fba073bc0ce5199577e31be60b313d457d858b1bb1` (matches the board row).
**Task:** v2, SHA-256 `95a1e744b5c4603c8da7ea7a3d4b0ea1f76cc96cc5f2da01ae2b3ae34667364e` (matches the Control).
**Lane:** LANE-11-ENG, Engineering Lead. **Plan:** `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8` only.

---

## Sat 17 Oct 2026

**STATE: STOPPED BEFORE THE FIRST PILOT BATCH — P-3 NOT MET. 0 D1 writes. The cursor has not started.**

### Start checks (08:20 UTC)
- No `.git/*.lock`. HEAD `0dd7ef0`. No git writes.
- Control v2 and Task v2 match the board and each other.
- Board: **MA-OCT-011.RELOPS CLOSED, "RELEASE READINESS SIGNED"** (report `991c4629…c81b`); RELARC PASS WITH NOTES (report `ea75c9ec…88f1`); **Founder release approval Fri 16 21:25Z** on the MA-OCT-011.RUN row.
- Plan: `shasum -a 256 -c plan.sha256` gives `plan.json: OK` (`e3854698…e6a8`).

### P-1 (RELARC N-1): PASS
- `explain --plan ~/MeridianAtlas-work/gleif-011/plans/release-2026-10-16 --transport remote` at 08:20:50 UTC. `explain` always opens the read-only transport. The CLI's name for it is `remote`; the Task's `remote-ro` is the transport's internal name and is not a CLI value.
- **22/22 plans as expected, `all_ok: true`, no SCAN.**
- Ledger: `statements 22, rows_read 0, rows_written 0, sql_sha256 = f5ae0dbab77aef362f1b1edf01d04dfbbda5b8334edaab61649e914babecdd32`, which equals the required `f5ae0dba…dd32`.
- Evidence: `explain-remote-ro-2026-10-17T082052704Z.json`, SHA-256 `e456a3aa2430e069357f3ab0603573b393a301a91fe53d07cf741b3477e08bb2`.

### P-2 (RELARC N-5): PASS
`node --test "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"` (08:21–08:24 UTC, `gleif_006.db` present):

```
ℹ tests 34
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### P-3 (RELARC note, transient Cloudflare errors such as 7403): NOT MET, so stop
**Required:** no retry inside a batch after any write; the batch either completes and checkpoints or stops with the cursor kept; a retry only before the batch's first statement.

**What the runner does** (`App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` `ce1e6623…51fe`, `execWithRetry` lines 388–396; called at line 446):
- A batch is **one** `wrangler d1 execute --command` call carrying all of its statements (≤ 250).
- Any failure of that call is a `D1Error` with `ambiguous = true` by default (core `D1Error`, line 345). That includes 7403, 10000 and timeouts. The only exception is the explicit "write detected on a read-only call" case.
- On such a failure the runner **re-sends the whole batch** up to 3 more times (30 s, 120 s, 300 s; `LIMITS.retryDelaysMs`). It does this **without reading back first**, so it does not know whether any statement of the failed attempt had already been applied.
- After the last attempt (success or not) it reads back, diffs each row (`applied` / `raced` / `mismatch`), checkpoints, and moves the cursor only on `success` / `partial`. After 3 failures the outcome is `failed` with the cursor kept.

**Why that is data-safe but still not P-3.** Every statement is idempotent (CAS `UPDATE` / `INSERT OR IGNORE`). Rows applied by a failed attempt miss their CAS on the retry and show as `applied` in the read-back. So no row can be double-applied or clobbered. But P-3 forbids the behaviour itself: the runner **can retry after writes**, and it does not restrict retries to "before the batch's first statement". It also does not do §8's "read back before retrying after an ambiguous failure". The Task says: "If the code does not do this, stop and report." So I stopped.

**Proposed fix (not applied; needs your go-ahead and, under "never review your own work", a reviewer).** In `executeBatch`, replace the blind retry:
1. On a failed write call, **read back at once** (the same V1 / V2 image queries, about 2 reads per row).
2. If the read-back equals the pre-image on every row, no statement of the batch was applied. That is "before the first statement", so a **retry is allowed** (≤ 3, same delays). Each retry repeats this check.
3. If **any** row differs from its pre-image, there is **no retry**. The batch stops: outcome `failed` (stop condition `ambiguous failure after writes`), checkpoint written with the read-back diff (`applied` / `raced` / unchanged per row), **cursor kept**, run log + `failed` heartbeat. The operator then either restores the batch (`restore --batch`) or re-runs it after review. Re-running is safe because the CAS statements skip the rows already applied.
4. **Tests:**
   - a 7403 failure with no row changed → retried → `success`;
   - a failure after some rows were applied → **no retry**, `failed`, cursor kept, checkpoint diff lists those rows `applied`;
   - the existing "4 failures → failed, cursor unchanged" test is kept.

Cost: one extra read-back (≤ 500 reads) per failed attempt, inside R9-1.

### Budget used today
- **D1 reads: 0** (P-1's EXPLAIN set meters 0). R9-1 cumulative: **73,489 / 350,000** (unchanged since Fri 16).
- **D1 writes: 0.** Heartbeats: none (no batch started).
- GLEIF: 0.

### Not done (by the stop)
The pilot (P-001, P-002, B-001), S-1 and the rest of Sat 17's schedule. No `recon/2026-10-17/` exists because there was no run activity; S-2 therefore has nothing to sign for Sat 17 unless the pilot runs later today.

**Waiting for:** a decision on P-3, either the fix above (implemented with tests, then reviewed) or a ruling from the Architect / Main Lane. Saturday's run windows remain open until 21:00 UTC (07:15–10:40, 11:20–16:40, 17:20–21:00; not 10:45–11:15 or 16:45–17:15).

### Update 08:30 UTC — P-3 fix implemented (Founder: "Fix now, review, then pilot"); awaiting independent review
**Founder's decision (chat, Sat 17 ~08:25 UTC):** implement the fix, have it reviewed (Architect / REVIEW-A), then run the pilot. **Still 0 D1 writes. The pilot has not started.**

**Change (runner `096cedb0bc72bdce2d6a6fcfe8fa760e49e2c111098b69ebd77eab0a9b5e6b6c`, 922 lines; it replaces `ce1e6623…51fe`).** `execWithRetry` (blind whole-batch retry) is removed and replaced by `execNoRetryAfterWrites`:
1. A failed write call is followed **at once** by a read-back of the batch's rows. These are the same V1 / V2 image queries already in the EXPLAIN set, so there is no new SQL pattern and `sql_sha256` is unchanged.
2. **Retry only if the read-back equals the pre-image on every row** (`imagesEqual`). That means no statement had been applied, i.e. the failure came before the first statement (e.g. a 7403 auth refresh). At most 3 retries (30 / 120 / 300 s). Each retry is preceded by its own read-back check.
3. **If any row differs, or the read-back itself fails: no retry.** The batch ends `failed` (reason "ambiguous failure … after writes: no retry (P-3)"), **cursor kept**. The checkpoint holds the final read-back diff (which rows were `applied`) and a `retry_log` (attempt, redacted error, code, `rows_unchanged`). It is restorable with `restore --batch`. A row changed by a concurrent writer also counts as changed, so the runner stops and never retries.
4. Non-ambiguous `D1Error`s (the read-only "write detected" case) are never retried.

**Tests** (`App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` `b564b4a0425f1c0af687258879f5108db278e4a5062ffabc19ee9119d405648b`, 665 lines):
- **Failures before any write, e.g. 7403** (renamed from the old retry test): 2 failures then `success`; 4 failures give `failed` ("4 failure(s) … before any write") with the cursor not advanced. In both, `retry_log` shows every retry was preceded by `rows_unchanged: true`.
- **New, a failure after writes, all statements applied:** exactly **1 write call** (no retry), `failed`, reason matches "after writes: no retry (P-3)", cursor kept at P-001, checkpoint diff = 250 `applied`, `retry_log` = 1 with `rows_unchanged: false`. `restoreBatch` from that checkpoint returns the replica to its exact pre-batch content.
- **New, the same with half the statements applied:** 125 `applied`, everything else identical, restore exact.

**P-2 re-run on the fixed code:** `tests 36 · pass 36 · fail 0 · cancelled 0 · skipped 0 · todo 0`. The count rose from 34 because of the 2 new P-3 tests.
**P-1 re-run on the fixed code** (08:29:16 UTC): 22/22 `all_ok`, `sql_sha256 = f5ae0dba…dd32` (unchanged), 0 reads, 0 writes. Evidence `explain-remote-ro-2026-10-17T082917415Z.json` `55ffeec0acfe9a21e1a5af65ea58db1f9d4ef68a1fe34e0fcbbf07232014e44e`.
**Review pack** (code excerpt with line numbers, call site, test names): `~/MeridianAtlas-work/gleif-011/review/p3-fix-excerpt.txt` `7293a53c44a25bba5212c285b9d8622257c1d3e6f7861f96422c9d3df26e5e48`.

**Requested of the reviewer (Architect / REVIEW-A):** confirm that the runner `096cedb0…6b6c` meets P-3 as worded:
- no retry inside a batch after any write;
- the batch either completes and checkpoints, or stops with the cursor kept;
- a retry only before the batch's first statement.

**On the reviewer's PASS** I will:
1. re-check the plan hash;
2. re-check `d1-today` and the gates;
3. run the pilot `run --plan …/release-2026-10-16 --transport remote --until B-002 --operator EngLead-LANE-11`;
4. record S-1 before continuing.

Today's run windows remain open until 21:00 UTC.

### Run (Control v3) — pilot and Saturday schedule: COMPLETE
**Control v3** `8dc3ce96727c5089cb9be19610d3f88cc751101faa1ab006f52b4f6fd49a564e` and **Task v3** `16c8bce169440c48219ebb7a00d2fddc4ddc969e248e474a556e05a7c1bddddb` both match the board.
- Board: RELOPS **RELEASE READINESS SIGNED**.
- **Founder release approval** Fri 16 21:25Z (Decisions Log 16 Oct "011 release approved"; `RUN_Status.json` `release_approval`).
- P3R PASS WITH NOTES (`84a1c78c…b1ea`): **C-1 and C-2 bind from now**; B-1 to B-4 are due before Mon 19.
- **Code run** = the P3R-reviewed versions: runner `096cedb0…6b6c`, core `830b49a8…`, tests `b564b4a0…`.
- Plan `shasum -c` OK before each run.
- No locks; HEAD `0dd7ef0`; no git writes.
- **Founder's instruction (chat):** "Run the pilot now, then continue Saturday's schedule if the pilot's read-backs pass. Do not start any batch between 16:45 and 17:15 UTC." All batches ran 14:35–14:37 UTC.

**14:34:53 — startup refusal, 0 writes.**
- The runner's first D1 call (`hold_all_jobs`) returned Cloudflare **7403**, in the same second as a wrangler OAuth token refresh: the config was rewritten at 14:34Z, the same race as Fri 16's export.
- The startup gate **failed closed before any batch**: run-log `failed` / `hold_check_failed`. Its heartbeat timed out at Ops and was **spooled**.
- This is not C-2: no batch had started, and there was no checkpoint to lose.
- A direct read at 14:35 returned `hold_all_jobs = "false"`. That read cost 1 row and went **outside** the runner ledger; it is added to the R9-1 figures below.

**14:35:22–14:35:29 — pilot `run --until B-002`: PASS.**

| Batch | Outcome | Rows applied / raced | Declared | **Measured (D1)** | Ratio | Mismatches | Retries |
|---|---|---|---|---|---|---|---|
| P-001 | success | 250 / 0 | 2,750 | 3,000 | 1.09 | 0 | 0 |
| P-002 | partial | 53 / **1** | 594 | 637 | 1.07 | 0 | 0 |
| B-001 | success | 250 / 0 | 1,006 | 1,006 | 1.00 | 0 | 0 |

- **P inserts measure 12 writes each** (11 per the §4.2 model, plus `sqlite_sequence`). That is +9%, inside 1.3×, and the spec named it as a measurement risk (§4.2, "+1 per AUTOINCREMENT insert"). P has no further batches, so this is the whole P overrun: **+293 writes**.
- **The raced P row** `984500F099E8C6A0EE90` (Goldman Sachs Asset Management International Holdings L.L.C.) was created by **live Phase 3 at 06:50:44 today** (entity 502685), after Fri 16's export.
  - Our `INSERT OR IGNORE` was ignored (`changes 0`; D1 meters it as 1 write).
  - A point read (2 reads, in the ledger) confirms **exactly one row** holds the LEI, version 1, untouched. It is listed, not clobbered.
  - Its child's E-C edge resolves to it by LEI (held by one row).
- **Note for B-4 (diff gap):** the diff classes an insert `raced` whenever the LEI was already held. It should also flag a mismatch if more than one row holds the LEI afterwards. That did not occur here.
- **S-1 met before B-002:** read-back diffs 0 mismatches; checkpoints written; writes ≤ 1.3×; **heartbeats HTTP 201**. These were the **first live events of `gleif-011`**: start/terminal for every batch, and the spooled 14:34 `failed` event was **replayed and accepted (201)**. The outbox is empty.

**14:36:25–14:37:08 — Saturday schedule `run --until B-022` (B-002 … B-021, the dry run's Saturday).**
- **20 / 20 `success`**, **250 / 250 applied in every batch**.
- **Measured writes = declared in every batch** (1,000–1,013 each).
- 0 mismatches, 0 retries.
- No batch was started 16:45–17:15 or in any other freeze; everything ran inside 11:20–16:40.

**Day totals (Sat 17):**

| Measure | Value |
|---|---|
| Batches | **23** (P-001, P-002, B-001 … B-021); run log 24 lines (22 `success`, 1 `partial`, 1 startup `failed` with 0 writes) |
| Rows applied | **5,553** (P 303, B 5,250); raced 1; **mismatches 0** |
| **D1 writes (measured)** | **24,752** (declared 24,459; +293 = P's AUTOINCREMENT) |
| Ops heartbeat events delivered | **47** (≈ 235 row-writes, ML-1010-3) |
| **011 total for the day** | **24,987 / 25,000** |
| Account gate | `d1-today` 226 at the gate (+ the F-1 own rows); far below 60k |
| D1 reads today | 29,086 (≤ 200k/day) + 1 outside the ledger |
| **R9-1 cumulative** | **102,575 / 350,000** (ledger; +1 outside it = 102,576) |
| Cursor | next = **B-022** (index 23 of 106); 23 done |
| Remaining | B-022…B-024 (≈ 573 B rows), C, C-reasons, RC-15, E-C, A, ECA, E-A, Q |

- **C-1 / C-2:** not triggered (no failed batch, no RUNNER ERROR).
- **OTP Bank** (entity 2019 / 467290): untouched (not in plan `e3854698…`).
- **Boost:** not resumed (T12 flag + pause row).

**R-4 / S-2: `recon/2026-10-17/` (exported 14:37:32 UTC, 94 reads):**

| File | Rows / lines | SHA-256 |
|---|---|---|
| `ops_job_run.json` | **47** rows | `0865c2b762d1d59c0b42ffb8e282eddb96d697db5300b91d1961ad4fd2ed9a8f` |
| `runlog.jsonl` | **24** lines | `f5df907237cec40373c717997a88d50486c1a242bd2b51c6c48f3c5f717edf17` |
| `manifest.json` | — | `264c7986acb7b9f1e65dba07344f82929f263a25a00050fbab901deb803c05c4` |

- First cut: **24 / 24 run-log lines have an Ops end event, 0 unmatched**.
- `reads_011 {cumulative 102,575, ceiling 350,000, today 29,086}`.
- **For the Operations Lead to sign by 09:00 UTC Sun 18** at `recon/2026-10-17/ops-signoff.json`.

**Next:**
- **Sun 18:** no writes. Build B-1 to B-4 (plus the duplicate-LEI insert check above), re-run P-1 and the full suite, write the Sun 18 section with `runner-prev.mjs` for the reviewer, then **stop for the Architect review**.
- **Mon 19:** the first batch waits for (a) that review and (b) the Ops S-2 signature. Not before 08:00 UTC; the 60k account gate may refuse batches (S-3).

**Stop point:** end of run day Sat 17.

---

## Sun 18 Oct 2026 — B-1 to B-4 + duplicate-LEI-holder check (no D1 writes); STOP for Architect review

**Instruction:** Founder (chat), per RUN Control v3 / Task v3 "P3R conditions". **No run day: 0 D1 writes, no batch.** Control v3 `8dc3ce96…564e` and Task v3 `16c8bce1…dddb` match. No locks; HEAD `0dd7ef0`; no git writes.

### Prior versions kept for the reviewer (`~/MeridianAtlas-work/gleif-011/review/`, mode 600)

| File | SHA-256 | Note |
|---|---|---|
| `runner-prev.mjs` | `096cedb0bc72bdce2d6a6fcfe8fa760e49e2c111098b69ebd77eab0a9b5e6b6c` | = the P3R-reviewed runner that ran Sat 17 |
| `core-prev.mjs` | `830b49a8…` | = core; **unchanged today** |
| `tests-prev.mjs` | `b564b4a0…` | |
| **`runner-sun18.diff`** (284 lines; +127 / −25) | `a7d9092fe6873f5bfd4cadda79a18c3512f9357b0b7ccba8dc446f515784294b` | `diff -u runner-prev.mjs` → new runner |
| **`tests-sun18.diff`** (175 lines; +142 / −3) | `4feab965dc299ef15e279eba823fd5a2902dac360ef48c8eae4ecd4f46c3b237` | |

### New code under review
- **Runner** `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs`, 1,027 lines, **SHA-256 `33abb71de1c68bf2897dcd9672b6df69adabe63a984e9ce1598728987933e7cc`**.
- **Tests** `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs`, 810 lines, **SHA-256 `3c62b0753677835e609ef0f656713051e654beb7a34311a8ab2c26242ab667dd`**.
- Core `830b49a8…` unchanged.

**B-1. Probe again just before each retry** (closes P3R N-1). `execNoRetryAfterWrites` keeps the immediate post-failure probe and adds a second probe **after the 30 / 120 / 300 s sleep, immediately before re-sending**. If that probe shows any row changed (writes of an in-flight call landed during the delay), or the probe fails, there is **no retry**: `failed`, cursor kept. `retry_log` now records each probe with `phase: after-failure | before-retry`.

**B-2. Guarded read-back, with a checkpoint and a hold on persistent failure** (closes P3R N-2).
- The post-write read-back is read-only and is retried (`readImagesRetry`: 10 / 60 / 180 s; outside P-3).
- If it still fails, the runner always writes a checkpoint: outcome `failed`, `readback_pending: true`, every statement's diff `unknown`, the pre-image file path and SHA, the `retry_log`.
- It also writes the hold `holds/readback-pending-<batch>.json`, sends a run-log line and a `failed` / `readback_failed` heartbeat, and stops.
- **New read-only command** `readback --plan … --batch <id>` completes that checkpoint against the **original** pre-image (the outcome stays `failed`), records its read-back file, and lifts the hold. C-1 then applies.
- While the hold exists, `run` refuses the batch and `restore` refuses it too.
- A failed probe never permits a retry.
- Probe reads are now counted in the checkpoint's `reads` and `probe_reads`.

**B-3. C-1 made mechanical.**
- Before each batch, `run` refuses a batch whose forward checkpoint is `failed` with any `applied` or `unknown` rows, until a successful restore checkpoint exists for **that failed run**. Every restore checkpoint now records `restore_of_run_id`.
- **A failed forward checkpoint is never overwritten.** Before a re-run it is moved to `<batch>.failed-<run8>.json`.
- **`restore --all` includes failed forward batches** that have applied rows and no restore yet. They are not in `cursor.done`.
- The same gate also refuses while a B-2 read-back hold exists.

**Duplicate-LEI-holder check** (Sat 17 pilot note). For each P insert, the diff counts the rows that hold the LEI after the insert. **Two or more is `mismatch`** ("LEI held by N rows after the insert"), whatever the pre-image said, and it counts toward the §9 stop rule (> 5 or > 0.5%). A-row LEI writes were already guarded atomically by `NOT EXISTS` (W1-A).

**C-2 is unchanged:** a `RUNNER ERROR` with no checkpoint still means stop, report, no re-run. B-2 now writes a checkpoint for read-back failures, so the one known path to "no checkpoint" is closed. A crash of the process itself would still be C-2.

### B-4 and the other new tests (all pass)
- **B-4(a) + B-3, B CAS batch failing after writes, half applied** (B-001; 125 of 250 applied, then error 10000):
  - exactly 1 write call (no retry); `failed`; checkpoint 125 `applied`;
  - **`run` refuses B-001** ("C-1/B-3: B-001 failed with 125 applied…");
  - on a copy, **`restore --all` includes B-001** (B-001, P-002, P-001) and returns the replica to the original;
  - on the main state, **`restore --batch B-001` is exact**; the re-run is then allowed and succeeds; the failed checkpoint is kept as `B-001.failed-<run8>.json`.
- **B-4(b), concurrent writer** between the pre-image and the probe (another writer changes one B-001 row; no 011 statement applied; error 7403): no retry, `failed`, 0 `applied`, that row `mismatch`; the restore leaves it untouched (`'CONCURRENT'` kept).
- **B-4(c) + B-2, the probe fails and the read-back keeps failing** (writes applied, then all reads fail):
  - no retry; checkpoint `failed` with `readback_pending`, 250 `unknown`, pre-image path present; hold written;
  - `run` refused ("pending read-back"); `restore` refused;
  - `readback` then completes the checkpoint against the original pre-image (250 `applied`), lifts the hold; `run` now refuses under C-1/B-3 until restored.
- **B-1, in-flight writes landing during the retry delay** (client-side failure, nothing applied; D1 applies during the sleep): `retry_log` = `[after-failure: unchanged, before-retry: changed]`, **not re-sent**, `failed`, 250 `applied` against the original pre-image.
- **Duplicate-LEI holder:** another writer inserts a second row with a P LEI under a different key → that statement is `mismatch` ("LEI held by 2 rows after the insert"), batch mismatches = 1.
- The earlier P-3 tests were updated for B-1's extra probe: before-retry probes 2 (success case) / 3 (4-failure case), all `rows_unchanged: true`; N-2 `probe_reads > 0`.

### P-2 (full suite on the new code)
`node --test "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"` (`gleif_006.db` present):
```
ℹ tests 41
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
That is 36 earlier + 5 new.

### P-1 (EXPLAIN set on the new code, 08:14:26 UTC)
**22/22 `all_ok`, `sql_sha256 = f5ae0dbab77aef362f1b1edf01d04dfbbda5b8334edaab61649e914babecdd32` (unchanged), no SCAN, 0 reads, 0 writes.** The new probes and read-back retries reuse the existing V1 / V2 image queries, so there is no new SQL pattern. Evidence: `explain-remote-ro-2026-10-18T081428647Z.json` `6aa8ed83ee178f8a1ea58e079fa9c7ef882e1b2fc574baabf23b1e10f29841be`.

### Dry run on the new code (release plan, replica of the 16 Oct export; local)
`dryrun/2026-10-18-release/summary.json` `eb6fad6b1f4c9382785d566208991e7f5bb7e2ce33a6fa633f27e4b8c382fcd6`:
- the same schedule (24,459 / 24,917 / 24,742 / 9,804);
- 0 calendar violations; holds in order (A pilot, then ECA/E-A release);
- A 3,676; 0 new duplicate LEIs; **full rollback identical**.

### D1 today
| Call | rows_read | rows_written |
|---|---|---|
| EXPLAIN set (08:14:26) | 0 | 0 |
| **Sun 18 total** | **0** | **0** |

R9-1 cumulative is unchanged at **102,575 / 350,000** (+1 outside the ledger on Sat).

### Monday 19: what must hold before the first batch (B-022)
1. **Architect review** of runner `33abb71d…e7cc` + tests `3c62b075…67dd` (diffs above). P3R said this is reviewed "by a hash check of the new runner and tests, plus the P-2 re-run".
2. **Ops S-2 signature for Sat 17:** `recon/2026-10-17/ops-signoff.json` is **not present as of 08:16 UTC** (due by 09:00 UTC today). The runner's R-4 gate refuses Monday's first batch without it.
3. Not before 08:00 UTC Mon (and outside 07:55–08:05). S-3: the 60k account gate may refuse batches; that is not a stop.

**Stop point:** Sun 18. Stopped for the Architect review. No run on Mon 19 until items 1 and 2 hold.

---

## Mon 19 Oct 2026 (Control v4)

**Control v4** `7691b267d55bea74c205f2487632dd0890b7e53f3daa633fdecc99d72e8e4085` and **Task v4** `e07537e227f122f2b57bbffddc6fcf7bfe7e0b2f6e7cc671f032c4a3b731371a` both match the board.
- Board: B4R PASS WITH NOTES (`25076660…53bc`); RELOPS SIGNED; Founder release approval 16 Oct 21:25Z.
- **Ops S-2 sign-off for Sat 17 present:** `recon/2026-10-17/ops-signoff.json`, "MATCH — 24/24 … 0 mismatches", signed 18 Oct 08:15Z by the Operations Lead. The runner's R-4 gate accepted it.
- No locks. HEAD `3989ab1` (LANE-1-ENG 007 front end; no 011 file touched). No git writes.
- **Founder's instruction (chat):** "execute Monday 19 from B-022 (not before 08:05 UTC). C-1′ and C-2 bind; build B-5 after today's batches, before Tuesday. Do not start any batch between 10:45–11:15 or 16:45–17:15 UTC."

### Before the first batch (Task v4)
- **Hashes:** plan `shasum -c` OK; runner `33abb71d…e7cc` = B4R-reviewed; core `830b49a8…`; tests `3c62b075…`.
- **P-1** (09:01:38 UTC): 22/22 `all_ok`, `sql_sha256 = f5ae0dba…dd32`, 0 reads, 0 writes (`explain-remote-ro-2026-10-19T090140588Z.json` `5acc115d…7134`).
- **P-2:** `tests 41 · pass 41 · fail 0 · cancelled 0 · skipped 0 · todo 0`.
- **`d1-today` at 09:04 UTC: 34,055** account rows written (the Monday 04:00 entities-seed). That is under Monday's ≤ 45k first-check limit.
- **Scope:** the dry run's Monday, B-022 → RC15-001 (47 batches, 24,917 writes), run as `--until EC-001`.

### Run, 09:04:55–09:06:37 UTC
Everything ran inside the 07:15–10:40 window; no batch started in 10:45–11:15 or 16:45–17:15.

| | Value |
|---|---|
| Batches run | **47**: B-022, B-023, B-024 (+ fallback **B-023-fb**, **B-024-fb**), C-001…C-003, CR-001…CR-039 |
| Outcomes | 44 `success`, 3 `partial` (B-023, B-024, B-023-fb), **0 failed**, 0 retries |
| Rows applied | **11,059**; raced **130**; **mismatches 0** |
| **D1 writes (measured)** | **24,403** (declared 24,924); ratios 0.0–1.00, never above 1.0 |
| Ops events delivered | **95** (all HTTP 201; outbox empty) |
| **011 total for the day** | **24,878 / 25,000** |
| **Stopped before CR-040** | run-log `budget_limit`, reason **"011 daily cap"**: 24,873 + 230 > 25,000. **Not a stop condition**; the cursor stays at CR-040. The account gate was not the binding limit (34,055 + 24,873 unpolled + 230 = 59,158 ≤ 60,000), as S-3 anticipated. |
| Rolled to Tue 20 | CR-040 (110 statements) and RC15-001 (29), ahead of Tue's E-C / A |
| R9-1 reads | today 56,136; **cumulative 158,711 / 350,000** (+1 outside the ledger on Sat) |

**Raced rows: §4.2c exactly as designed.**
- The **129** raced B rows are all in the last B batches: B-023 (56 of 250) and B-024 (**73 of 73**). B runs in descending LEI order and live Phase 3 walks the pool ascending, so the two met at B's tail. These rows were drained by Phase 3 between the 16 Oct export and today, and their CAS missed. **None was clobbered.**
- **B-024 metered 0 writes** (0 applied, 73 raced). That is correct, not a fault.
- **Fallback (reviewed, plan-carried) C-reasons CAS on `='NO_LINK_DECLARED'`:** 128 of the 129 had one. **127 applied** (B-023-fb 55, B-024-fb 72), so they now hold GLEIF's real reason instead of Phase 3's generic marker.
- **1 raced again:** entity 204823. Phase 3 wrote an ultimate parent (`2549007MRJE5JW7TCH77`), so the fallback's guard `ultimate_parent_lei IS NULL` correctly missed. Its direct field keeps `NO_LINK_DECLARED`. Listed for close-out.
- **1 had no fallback:** entity 207528 (no RX reason in GC). Listed.
- C-1′(c) is not triggered: no failed batch, no RUNNER ERROR (C-2).

**R-4: `recon/2026-10-19/`** (exported 09:07:20 UTC, 190 reads):

| File | Rows / lines | SHA-256 |
|---|---|---|
| `ops_job_run.json` | **95** rows | `16eddea0a7e34fefe6ff6b68bfbcef119cdec8634bbc166b1a873dec0c602aa9` |
| `runlog.jsonl` | **48** lines | `2b2c95328c1685bbbc0fe634fbe05eb002b3d631d1f733d93b1fda78f43586ac` |
| `manifest.json` | — | `094e32804a66576d43e60f4fb3a898ea63a855e099ec5661397b3be9197b6937` |

- First cut: **48 / 48 run-log lines matched, 0 unmatched**.
- `reads_011 {cumulative 158,711, ceiling 350,000, today 56,136}`.
- **For the Operations Lead to sign by 09:00 UTC Tue 20** (`recon/2026-10-19/ops-signoff.json`). Tue 20's first batch waits for it.

### B-5 (built after today's batches, before Tue 20)
**Gap (B4R):** a write call that fails returns no `meta`, so its measured writes were 0. That 0 went into the run log, and from there into 011's own daily count (`ownWrites` → the 25k cap).

**Fix:**
- **Failed write call, read-back succeeded:** `executeBatch` counts the rows the read-back diff shows `applied` at their cost-model writes (`est_writes`; for a restore, its per-statement average). That figure goes into the run-log `writes`, the checkpoint `writes`, and the returned count. The checkpoint keeps `writes_measured` (0) and `writes_basis: "B-5: estimated from applied rows (write call failed; no meta)"`.
- **Read-back failed (B-2; every row `unknown`):** the **declared** writes are counted (conservative), with `writes_basis` saying so.
- The 1.3× stop still uses measured `meta` only.

**Code (011 paths; untracked):**
- runner `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs`, 1,038 lines, **SHA-256 `29300a0ed4fd123ee8c455022abf3184edf9a2104d1382cd61abb53c29fe59fa`**;
- tests 844 lines, **SHA-256 `962cef28c035deb57a5829ce63e0c3b654c8c9b5610dc1be06b0a1726bb9df9e`**;
- core `830b49a8…` unchanged.

**For the Architect's close-out check (ML-1018-2),** in `~/MeridianAtlas-work/gleif-011/review/`:

| File | SHA-256 |
|---|---|
| `runner-b4r-reviewed.mjs` (= `33abb71d…e7cc`) | — |
| **`runner-b5.diff`** (+18 / −7) | `2a88ae9d41c3d91532d7b21f28deba1573a0010e6ccf22858d7de22945191daf` |
| `tests-b5.diff` | `94e729c7fb367d09759f8942ab278a8665db9f6020442bd5b02b303c97cd3701` |

**Test (new):** "B-5: a failed write call counts its applied writes (not 0) …":
- (1) B-001 fails after 125 of 250 rows applied: the failed run-log line and the checkpoint carry exactly Σ `est_writes` of the 125 applied statements (> 0); `writes_measured` 0; and `ownWrites` rises by exactly that amount;
- (2) the read-back keeps failing: the declared writes are counted.

**P-2 on the B-5 code:** `tests 42 · pass 42 · fail 0 · cancelled 0 · skipped 0 · todo 0`.
**P-1 on the B-5 code** (09:11:20 UTC): 22/22, `sql_sha256 = f5ae0dba…dd32` unchanged, 0 reads, 0 writes (`explain-remote-ro-2026-10-19T091121609Z.json` `ed1d7132291c7a10047042fd754b6532971b8b62a562de4b9d64e5f7eaf3260f`).

With B-5 in, C-1′(c) is no longer the only cover for the write-count gap. **C-1′ still binds**, and so does C-2.

### For Tue 20 (Control v4 / Task v4)
- **First batch:** CR-040, then RC15-001, then E-C (EC-001…), then A.
- **The A pilot is A-001.** The run stops after it for the Data-Identity Lead's 50/50 adjudication (E-4); spec §4.4 places the A pilot on Wed 21.
- **Waits for:** the Ops sign-off for Mon 19; ≥ 07:15 UTC, outside 07:55–08:05.
- **Runner** `29300a0e…59fa` (B-5).

**Stop point:** end of run day Mon 19.

---

## Tue 20 Oct 2026 (Control v4)

**Control v4** `7691b267…4085` and **Task v4** `e07537e2…371a` both match the board. No locks; HEAD `3989ab1`; no git writes.
- **Founder's instruction (chat):** "Tuesday 20 per RUN Control v4 — the Mon 19 Ops sign-off is required first. Run from CR-040 with --until A-001 (A pilot is Wed 21 per ML-1019-1). C-1′ and C-2 bind; B-5 is live. No batch in 10:45–11:15 or 16:45–17:15 UTC."

### Before the first batch
- **Ops sign-off for Mon 19 present:** `recon/2026-10-19/ops-signoff.json`, "MATCH — 48/48 run-log lines matched (CR-040 budget_limit ↔ skipped/budget), 0 unmatched; writes 24,878/25,000 …", signed 20 Oct 08:31Z by the Operations Lead. The runner's R-4 gate accepted it.
- **Hashes:** plan `shasum -c` OK; **runner `29300a0e…59fa` (B-5, live)**; core `830b49a8…`; tests `962cef28…`.
- `status.sh`: no runner, no flags, no holds (no pending read-backs).
- `d1-today` at 08:45 UTC: 70 account rows written.

### Run, 08:45:10–08:45:23 UTC (`--until A-001`)

| Batch | Outcome | Applied | Other | Declared | **Measured** |
|---|---|---|---|---|---|
| CR-040 | success | 110 | — | 220 | 220 |
| RC15-001 | success | 29 | — | 29 | 29 |
| EC-001 | success | 250 | — | 1,000 | 1,000 |
| EC-002 | success | 250 | — | 1,000 | 1,000 |
| EC-003 | success | 174 | **1 `already_present`** | 700 | 696 |
| **Total** | **5 / 5 success** | **813** | 1 | 2,949 | **2,945** |

- 0 mismatches, 0 retries, 0 failures. Every batch ran inside 07:15–10:40; none started in 10:45–11:15 or 16:45–17:15.
- **Stopped before A-001** (`--until A-001`, ML-1019-1). **The A pilot (A-001) is Wed 21**, after which the run stops for the 50/50 adjudication (E-4).
- **EC-003's `already_present` edge:** child 207528 → parent 502685 (Goldman Sachs Asset Management International Holdings L.L.C., LEI `984500F099E8C6A0EE90`). Its pre-image already held this `legal_parent` / `gleif` edge. It was written by **live Phase 3 in its 06:50 Sat 17 run**: the same run that created parent row 502685 (Sat's one raced P row) and drained 207528 (Mon's "no fallback" B row). Our `INSERT OR IGNORE` matched it and wrote nothing. The child's other Phase 3 edge (to 1636) is untouched.
- **E-C now complete:** 675 planned = 674 inserted + 1 already present.

### Day totals

| Measure | Value |
|---|---|
| D1 writes (measured) | **2,945** |
| Ops events delivered | **10** (all 201; outbox empty) |
| 011 total for the day | **2,995 / 25,000** |
| R9-1 reads | today 11,637; **cumulative 170,348 / 350,000** |
| Cursor | **A-001** (index 73 of 106); 75 done (incl. 2 fallback batches) |
| Remaining | A-001…A-015 (3,676; A pilot Wed 21), ECA, E-A (Thu 22, OPS-R10 release), Q |

- C-1′(c) not triggered. C-2 not triggered. B-5 live; no failure today, so it had nothing to count.

**R-4: `recon/2026-10-20/`** (exported 08:45:45 UTC, 20 reads):

| File | Rows / lines | SHA-256 |
|---|---|---|
| `ops_job_run.json` | **10** rows | `1215982e3f95cd84c569b01063e962b190a3fc30c26bce96f16ada6edbd8ea01` |
| `runlog.jsonl` | **5** lines | `30246f8972d11ed30db46afa2fcbcc4ecd0c375c6e7ae584ac11e2f665a249e5` |
| `manifest.json` | — | `e6571bae3e236c2b33230bc7dc4d35c2ae15360edbb7620f46e4a6416384fb10` |

- First cut: **5 / 5 matched, 0 unmatched**.
- **For the Operations Lead to sign by 09:00 UTC Wed 21**; Wed's first batch (A-001) waits for it.

### Control-script fix (display only)
- `scripts/gleif-reconcile-011-status.sh` crashed on its "011 writes today" line. The cause: a backslash inside a Python f-string, a `SyntaxError` on the system `/usr/bin/python3`.
- Fixed by computing the count before the f-string. No other change; the runner does not use this script.
- `bfa29179…cd1d` → **`b04f5d8c9bee8944f11cd7b017ea20fc72ab49923e6e243708cd6bc58b5aa1fe`**. Output verified: "2026-10-20: 2945 row-writes in 5 run-log lines …".

### For Wed 21
1. Ops sign-off for Tue 20.
2. ≥ 07:15 UTC, outside 07:55–08:05.
3. Run **A-001 only**. The runner holds after the A pilot (`holds/a-pilot.json`) for the Data-Identity Lead's ≥ 50-row adjudication with an Ops spot-check (RA-14, E-4). A-002 onward needs `--a-adjudication <file>` recording 50/50.
4. Any A identity mismatch → E-4 (RA-12 / RA-15): A stops, the batch is restored, ECA and E-A are dropped.

**Stop point:** end of run day Tue 20.

---

## Wed 21 Oct 2026 (Control v4)

**Instruction:** Founder (chat): "Wednesday 21 per RUN Control v4 — Tue 20 Ops sign-off required first. Run A-001 only (the A pilot), then stop and hold for the Data-Identity adjudication. C-1′ and C-2 bind."

### 10:54 UTC: WAITING. Tue 20 Ops sign-off missing; A-001 not started. 0 D1 writes.

**Checks passed:**
- Control v4 `7691b267…4085` and Task v4 `e07537e2…371a` match the board. No locks; HEAD `3989ab1`; no git writes.
- Plan `shasum -c` OK. Runner `29300a0e…59fa` (B-5), core `830b49a8…`, tests `962cef28…`, `status.sh` `b04f5d8c…`.
- `status.sh`: no runner, no flags, no holds (`holds/` empty; no pending read-backs). Cursor **A-001** (index 73).
- `d1-today` 20 rows written.

**Precondition not met. The R-4 sign-off for Tue 20 does not exist:**
- `~/MeridianAtlas-work/gleif-011/recon/2026-10-20/ops-signoff.json`: **absent**. The `recon/2026-10-20/` export is present: 10 / 5, 0 unmatched, written Tue 08:45 UTC.
- `claude/packets/MA-OCT-011.RECOND_Report.md` has a Mon 19 section (signed Tue 20 08:31Z) and **no Tue 20 section**. `RECOND_Status.json` was last updated 18 Oct.
- `claude/October_Decisions_Log.md` has no Tue 20 R-4 entry.

The runner's own R-4 gate (`reconGate`) also refuses a run day whose previous run day is unsigned. The sign-off was due 09:00 UTC today. **This lane does not write the Operations Lead's sign-off.**

Also note that 10:54 UTC is inside the 10:45–11:15 boost freeze, and no batch would start there in any case.

**Next:** when `recon/2026-10-20/ops-signoff.json` is present (MATCH, signed by the Operations Lead), I run **A-001 only** in the next window: 11:20–16:40, or 17:20–21:00, never 16:45–17:15. Then the runner writes `holds/a-pilot.json` and stops for the Data-Identity Lead's ≥ 50-row adjudication (RA-14, E-4). A-002 onward needs `--a-adjudication` recording 50/50.

### 13:07 UTC: Tue 20 signed; A pilot A-001 run; HOLDING for the adjudication
**Founder (chat):** "Ops has now signed Tue 20 (recon/2026-10-20/ops-signoff.json, 0ef5a638…ec81). Run A-001 only in the 11:20–16:40 UTC window, then stop and hold for the Data-Identity adjudication."

**Precondition met:**
- `recon/2026-10-20/ops-signoff.json` SHA-256 **`0ef5a638abcfce15f4e6975adc5d92e9f639a6610e5512ad3590ad0bea54ec81`**, matching the hash given.
- Content: "MATCH — 5/5 run-log lines matched, 0 unmatched; writes 2,995/25,000; reads 170,348/350,000 …; E-C complete". Signed by the Operations Lead, 2026-10-21T10:55Z (source: RECOND Tue 20 section `571f670b…b741`).

**Re-checks at 13:07 UTC:** no locks; HEAD `3989ab1`; plan `shasum -c` OK; runner `29300a0e…59fa`; no flags, no holds; cursor A-001. 13:07 is inside 11:20–16:40.

**Run:** `run --until A-002` (13:07:46–13:07:52 UTC). The runner's own A-pilot hold also applies.

| Batch | Outcome | Applied | Declared | **Measured** | Mismatches | Retries | Reads |
|---|---|---|---|---|---|---|---|
| **A-001 (A pilot)** | **success** | **250 / 250** | 1,543 | **1,543** (1.00×, D1 meta) | **0** | 0 | 1,250 (max per execution 1) |

- **The runner held after A-001:** gate log "A pilot A-001 done: holding for the 50-row adjudication (RA-14)", `{"stopped":"a-pilot hold"}`. It wrote `holds/a-pilot.json`.
- **A-002 onward stays blocked** until `--a-adjudication <file>` records ≥ 50 adjudicated rows, all correct, by the Data-Identity Lead with an Operations Lead spot-check (`abGate`).
- Every A-001 row now carries its LEI with `match_source = gc_name_t1` and `gleif_enrichment_version = 11`.
- Each statement's "LEI on no other row" guard (`NOT EXISTS`, W1-A) held for all 250: 250 `applied`, 0 `raced`.
- Q (queue close) and E-A for these rows wait for their later batches (E-2).
- **No identity trigger** so far: the read-back diff checks execution only. The identity check is the adjudication below (E-4 (b)).

**Day totals (Wed 21):**

| Measure | Value |
|---|---|
| D1 writes | **1,543** |
| Ops events | **2** delivered (201; outbox empty) |
| 011 total | **1,553 / 25,000** |
| R9-1 reads | today 1,255; **cumulative 171,603 / 350,000** |
| Cursor | **A-002** (index 74) |
| Triggers | C-1′ / C-2 not triggered |

**R-4: `recon/2026-10-21/`** (4 reads):

| File | Rows / lines | SHA-256 |
|---|---|---|
| `ops_job_run.json` | **2** rows | `2ee200b6c8b6ef1425824af051bc17999863f56f86b8ea2a85ae584cc6debff0` |
| `runlog.jsonl` | **1** line | `9877515b12d0bc76b5746878f94a3759f7a6a81a25c9f96c6cca7b35a28f456d` |
| `manifest.json` | — | `c2122947bfb705fcacc40c78167342b0ccbfc73a4a188faaaf4640c5c858c3ec` |

First cut: **1 / 1 matched**. For the Operations Lead to sign by 09:00 UTC Thu 22.

### For the Data-Identity Lead: A-pilot adjudication material (RA-14 / E-4 (b))
Prepared locally from the A-001 checkpoint and `gleif_006.db` (read-only; 0 D1 reads, 0 GLEIF calls). **This lane does not adjudicate its own run.** Files in `~/MeridianAtlas-work/gleif-011/adjudication/` (mode 600):

| File | SHA-256 | Contents |
|---|---|---|
| `A-001_all_250.csv` | `c1f1cd20c250453afcc4becdfb98e6620dc32ae18707c4b5a0ba4e1acaec7afc` | Every A-001 row. Columns: `entity_id`, D1 name, country and type (before), the written LEI, GC legal name, GC legal country, jurisdiction, registration and entity status, the written `match_source`, version |
| `A-001_sample50_seed-MA-OCT-011.APILOT-A-001.csv` | `cbaaddb35d2dd0a7ea9e44e834405a132325d0961ca6b0fa0f2fda1a2b522fb1` | A seeded sample of 50 (seed `MA-OCT-011.APILOT-A-001`, Python `random.Random`), with blank `correct_identity (Y/N)` and `note` columns |

- Mechanical fact (not an adjudication): the D1 country equals the GC legal country on **250 / 250** rows. That is T1's country rule, as expected.
- **Required result:** **50 / 50** (RA-14).
- **Release format:** the adjudication file passed to `--a-adjudication` must be JSON with `{batch: "A-001", adjudicated: ≥ 50, correct: <same number>, data_identity_lead: "<name>", ops_spot_check: true}`.
- **Any wrong identity match = E-4:** `holds/e4-trigger.json`. The runner then deletes any ECA / E-A edges, A stops, and A-001 is restored (`restore --batch A-001`; C-1′ order). A resumes only on a bounded excludable cause plus a fresh 50/50, otherwise A defers to after 013.

**Next:**
- **After a 50/50 adjudication** (and the Ops sign-off for Wed 21): A-002 … A-015 under the 25k/day cap.
- **E-A and ECA:** Thu 22 only, with the Operations Lead's OPS-R10 release `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}`.
- **Q** follows A.

**Stop point:** Wed 21, holding after the A pilot.

### 18:14 UTC: E-4 response. A-001 restored (exact); A stopped; E-A and ECA dropped
**Founder (chat):** "E-4 confirmed by MA-OCT-011.APILOT (48/50; 2303, 2488; holds/e4-trigger.json). Per RUN Task v4 §4 and RA-12/RA-15: restore A-001 now (restore --batch A-001), verify every row is back to its exact pre-image, keep A stopped, and drop E-A and ECA. Run nothing else."

**Trigger confirmed:**
- `holds/e4-trigger.json` `7e3c9153…3094`, written 18:07:08Z by MA-OCT-011.APILOT (board: CLOSED, report `2f667081…4206`).
- Adjudication 48/50 (`A-001_adjudication_DIL.json` `e2ee84ed…b5c`). Two wrong identity matches:
  - **2303** "Tradeweb Markets Inc" was given `5493000G5QHJUY9ZWQ91` (TRADEWEB MARKETS **LLC**, a different legal person);
  - **2488** "HONG KONG DOLLAR" (a currency pseudo-entity) was given `213800L2NP81ACBDZV94` (an HSBC money-fund sub-fund).
- **Before the restore:** no ECA, E-A or Q checkpoint exists, so **0 ECA / E-A edges and 0 queue updates had been written**. There was nothing to delete; dropping the steps is enough.

**Restore** (18:14:41–18:14:45 UTC; inside 17:20–21:00; nothing else run):
- Command: `restore --plan …/release-2026-10-16 --batch A-001 --transport remote --operator EngLead-LANE-11`.
- Plan `shasum -c` OK; runner `29300a0e…59fa`. Restore checkpoint `A-001.restore-7ad6ecc3.json` (`c6a508e070efbea61777fd983642d2e47e2b9aa21ce0b9865ed9d8115e724084`).
- **success, 250 / 250 restored, 0 mismatches, 0 retries.**
- Each statement was a CAS on `gleif_enrichment_version = 11` + the A-001 post-image. **None missed**, so no live job had touched these rows since 13:07.
- `restore_of_run_id` = A-001's forward run (`b787e198…2600` checkpoint), so B-3 records it as restored.
- No dependent ECA edges existed for `restoreDependentEca` to delete first.
- **D1 writes 1,293** (measured).

**Exactness verified:**
- The restore's read-back of all 250 rows was compared with A-001's **original forward pre-image** (taken 13:07:46, before the A-001 writes) on all **28** tracked columns, including `updated_at`, which 011 never writes: **0 differences**.
- The restore read-back file and the forward pre-image file are **byte-identical**: SHA-256 `d30f6f95bb81bc609447535758d7fb2107b5f73123ee60eab48c20ad9961735d` on both.
- Rows 2303 and 2488 are back to `lei` NULL, `lei_status` NULL, `match_source` NULL, version 1, their original `updated_at` (`2026-09-06 04:01:14` / `04:02:45`), and their original names.
- **Neither wrong LEI is now held by the row it was written to.**

**A stopped; E-A and ECA dropped:**
- **The E-4 trigger stays** (`holds/e4-trigger.json`). The runner's gates were checked with no D1 call: A-001, A-002, ECA-001, EA-001 and Q-001 are all refused ("E-4 trigger open … A, ECA, E-A and Q are stopped"), and `aStopReason` = "E-4 trigger open".
- **`holds/ea-dropped.json` written** (`b9e18517d3fba64ba991cd2d1d91ddf65095bde9a67caf56dafb6058b186daac`; `edges_written_before_drop` ECA 0 / EA 0). It keeps **ECA and E-A dropped for the rest of the run** even if the E-4 trigger is later lifted (`abGate`).
- **Not written by this lane:** an A drop (`a-dropped.json`, i.e. "A defers to after 013") and any A re-plan. Per RA-12 those are the Founder's re-rule: "A resumes only on a bounded excludable cause plus a fresh 50/50, else A defers to after 013". The trigger file itself says "Founder may re-rule".
- Cursor: next = **A-001** (index 73), recorded under `restored`; done 75; nothing else run.

**Day totals (Wed 21, final):**

| Measure | Value |
|---|---|
| D1 writes | **2,836** = A-001 forward 1,543 + restore 1,293 |
| Ops events | 4 (201; outbox empty) |
| **011 total** | **2,856 / 25,000** |
| R9-1 reads | today 2,514; **cumulative 172,862 / 350,000** |
| C-1′ / C-2 | C-1′(c) does not apply (no batch failed). C-2 not triggered. |

**R-4: `recon/2026-10-21/` re-exported after the restore** (18:15:19 UTC, 8 reads; supersedes the 13:07 export, which Ops had not yet signed):

| File | Rows / lines | SHA-256 |
|---|---|---|
| `ops_job_run.json` | **4** rows | `bf875067542d46420ab9211d290e9df03a9b2405d4462c55d688bbbc2118ef61` |
| `runlog.jsonl` | **2** lines (A-001 forward `success`; A-001 restore `success`) | `d2c1ce1322060a09b377b0b495b3eb623536fee48a4c3957aaba731b54e001c5` |
| `manifest.json` | — | `fc1caaf3a69742baba9be2ef8dc4ef7cff6c14dde89402874d4152fd7af82022` |

First cut: **2 / 2 matched**. For the Operations Lead to sign.

**State of the 011 run now:**

| Bucket | State |
|---|---|
| P, B, C, C-reasons, RC-15, E-C | **complete and standing** |
| A, ECA, E-A, Q | **not written** (A-001 written then fully restored) |

The 013 hand-off and the §9 close-out need a Founder decision on A: a bounded re-plan plus a fresh 50/50, or A deferred to after 013.

**Stop point:** Wed 21, end of run day. No further batches until a Founder ruling on A.
