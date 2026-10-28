# MA-OCT-011.P3R — Report (REVIEW-A, Architect)

**Control:** `claude/packets/MA-OCT-011.P3R_Control_v1.md` SHA-256 `a6f208bb8893320a00f2a0c8f7e2d7e4d8aba361c8d168b0fb62aea2b7bb3e49` (verified; matches the STATUS_BOARD row). Task v1 `c51a829e20c67dc46677c16bd2cf5729bfa977ce5378ed40b64a6c4df845cfa8` (verified).
**Date:** Sat 17 Oct 2026, ≈ 08:38 UTC. **Git:** `October-2026`, HEAD `0dd7ef0`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1. No code run.** The work folder was read only; the key file (`ops-ingest.env`) was not opened.
**Independence:** LANE-11-ENG wrote the fix, not me.

## Inputs (all re-hashed on disk)

| Input | SHA-256 | Match |
|---|---|---|
| `claude/packets/MA-OCT-011.RUN_Report.md` (Sat 17 section) | `e3961bea…6d96` | ✔ |
| `~/MeridianAtlas-work/gleif-011/review/p3-fix-excerpt.txt` | `7293a53c…5e48` | ✔ (lines 394–422 agree with the live file) |
| runner `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` (922 lines) | `096cedb0…6b6c` | ✔ as reported |
| core `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` | `830b49a8…63c7` | read |
| tests `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` | `b564b4a0…648b` | ✔ as reported |
| plan `plans/release-2026-10-16/plan.json` | `e3854698…e6a8` = `plan.sha256` | ✔ |
| `d1-ledger.jsonl`, 17 Oct entries | 2 calls (EXPLAIN set), 0 reads, 0 writes; `sql_sha256` `f5ae0dba…dd32` | ✔ |

**Limitation.** The prior runner (`ce1e6623…51fe`) is not in git (the file is untracked) and is not kept in the work folder. So item 3's "no other change" is checked by reading the current gates, plus P-1 (SQL hash) and P-2 (36/36). It is not a byte diff.

## Verdict: **PASS WITH NOTES**

**The Sat 17 pilot may run.** It is bound by operating conditions **C-1 and C-2** from now; the Main Lane records them. Code items **B-1 to B-4** must be done before the Mon 19 bulk B batches. They are reviewed by a hash check of the new runner and tests, plus the P-2 re-run.

## Checks

**1. P-3 is met as worded: PASS.** `execNoRetryAfterWrites` (lines 401–422) makes three decisions:

- **Retry.** A failed call is retried only when a read-back taken at once equals the pre-image on **every** row (`imagesEqual`). It compares full rows over all four image keys: `em`, `em_lei`, `edge` (by child) and `queue`, using `EM_COLS` including `updated_at`. Every statement kind's target is covered: a CAS update changes its row, and an insert adds a row to `em_lei` or `edge`. So "nothing changed" means no statement was applied, i.e. the failure came before the first statement. At most 3 retries.
- **Partial apply.** Any changed row means **no retry**: the batch ends `failed` ("after writes: no retry (P-3)"), the cursor is kept (`cmdRun` advances only on `success`/`partial`), and the checkpoint is written with the diff and `retry_log`.
- **Concurrent writer.** A row changed by another writer, even only its `updated_at`, also counts as changed, so there is **no retry**. That is conservative and correct. A failed read-back means no retry. A non-ambiguous `D1Error` is never retried.

Note **N-1** describes one residual window, which is data-safe.

**2. Read costs: PASS.** Each probe is the same image query set, ≈ 2 reads per row, ≤ about 500 per execution, far under 50k. Probes go through `ctx.d1.exec`, which appends to `d1-ledger.jsonl`, so they are **counted in R9-1**. The worst case per batch (pre-image + 4 probes + read-back) is ≈ 12n reads against `estBatchReads` = 6n + 10, so about +1.5k on one batch of 250. That is immaterial against 350k with 73,489 used. Notes N-2 and N-3 cover the details.

**3. No change to the plan, SQL or gates: PASS** (limitation above).

- The plan hash is unchanged.
- P-1 re-run: 22/22, `sql_sha256` `f5ae0dba…dd32`. The probe reuses the V1/V2/edge/queue image SQL, so there is no new pattern.
- `executeBatch` still applies, in order: E-2 filter → R9-1 pre-check → headroom gate → pre-image → 120 s fetch age → `assertTables` → execute → read-back → stop conditions (mismatch, 1.3× writes, 50k per execution, P collisions) → checkpoint → report.
- `cmdRun` still applies the flag, calendar, recon and `abGate` gates before every batch.
- CAS statements are unchanged (they are rendered from the plan).

**4. Restore from a `failed` checkpoint: PASS, for the case tested.**

- `restoreBatch` restores only the rows the checkpoint diff marks `applied`, from the checkpoint's own pre-image.
- The two new tests (all 250 applied; 125 applied) end `failed` with 1 write call, the cursor kept and the diff counts right. `restoreBatch` returns the `entity_master` dump to exactly its pre-batch content.
- Restore mode uses the same no-retry-after-writes guard. Each restore attempt writes its own `…restore-<run>` checkpoint, so nothing is overwritten.
- Both tests use P-001 (inserts). There is no failure-after-writes test for a CAS-update batch, and none for a concurrent writer → **B-4**.

**5. P-2 at 36/0/0 in place of RELOPS's 34: ACCEPTED.** 35 `test(` sites, one of which is a loop over 2 cases, give 36. Of the 34 earlier tests, the old retry test was renamed and rewritten for P-3, and 2 new tests were added. Every gate test RELOPS relied on is still present and passing.

## Operating conditions for the pilot (binding until B-1..B-3 ship)

- **C-1.** If a batch ends `failed` with any `applied` rows, the response is `restore --batch <id>` **first**, verified, and only then a re-run.
  - **Never re-run a batch directly over a partial apply.** The re-run takes a fresh pre-image of the half-applied state. The rows applied earlier then show as `raced`, and the forward checkpoint file (`<id>.json`) is **overwritten**, so `restore` could no longer return them to their true pre-image (the per-run `preimage-…json` file survives, but only manually). For B rows the re-run would also send those rows down the §4.2c fallback path.
  - **`restore --all` skips failed batches** (it walks `cur.done`, which holds only success/partial), so a failed batch is always restored explicitly.
- **C-2.** If the runner exits with `RUNNER ERROR` and **no checkpoint** for the batch, stop and tell the Operations Lead and the Architect. **Do not re-run.**
  - This happens if the read-back after a failed call also fails (the unguarded `readImages` at line 475), for example during a correlated wrangler/10000 outage.
  - The cursor is kept, and the batch's `preimage-<step>-<id>-<run>.json` (written before execution) is the restore source. A later read-back is diffed against it, under a reviewed manual restore.

## Code items before Mon 19 bulk (LANE-11-ENG; reviewed by hash check plus P-2)

- **B-1. Probe again just before each retry**, after the 30/120/300 s sleep, not only straight after the failure. This closes N-1.
- **B-2. Guard the post read-back.**
  - Retry the read-back itself; read-only retries are outside P-3.
  - On persistent failure, still write a checkpoint: outcome `failed`, diff `unknown`, the pre-image path recorded.
  - Also write a `holds/` file that blocks a forward re-run of that batch until a read-back has completed the checkpoint against the **original** pre-image.
- **B-3. Make C-1 mechanical.** `run` refuses a batch whose forward checkpoint is `failed` with `applied` rows until that batch has a successful restore checkpoint, and it never overwrites a failed forward checkpoint (keep it under its run id). `restore --all` includes failed batches.
- **B-4. Tests:**
  - (a) failure after writes on a **B** CAS batch, half applied: no retry, then restore exact;
  - (b) a concurrent writer changes one row between the pre-image and the probe: no retry, `failed`, that row untouched by restore;
  - (c) the probe fails: no retry, and the B-2 checkpoint and hold are written.

## Notes (non-blocking)

- **N-1. In-flight window.** If a call fails on the client side (e.g. wrangler's 300 s timeout) while D1 is still applying it, the immediate probe can see "unchanged". The retry then runs about 30 s later over writes that landed during the sleep. **Data-safe:** every statement is a CAS `UPDATE` or `INSERT OR IGNORE`, so the retry's statements miss, and the read-back diff labels the rows `applied` against the original pre-image. It does relax P-3's letter at the edge; B-1 closes it.
- **N-2.** The checkpoint `reads` field omits probe reads (`execNoRetryAfterWrites` discards `.reads`). The ledger, which R9-1 uses, does count them. Fix it with B-2.
- **N-3.** A failed `wrangler` call writes no ledger entry, so whatever D1 bills for a failed call is not in R9-1. This predates the fix and is small: ≤ one batch's statements per failure. Ops may count failures × `estBatchReads` as an allowance.
- **N-4.** Keep each superseded runner version (or its diff) in `~/MeridianAtlas-work/gleif-011/review/`, so later reviews can diff bytes, not only read gates.

## Files written

- `claude/packets/MA-OCT-011.P3R_Report.md` (this file). Nothing else. Status JSON, board and Decisions Log are for the Main Lane.
