# MA-OCT-011.B4R — Report (REVIEW-A, Architect)

**Control:** `claude/packets/MA-OCT-011.B4R_Control_v1.md` SHA-256 `399c67a2d55c35a9f8061433758672b51220d5c6abc3d9a21b378ddb303a856a` (verified; matches the STATUS_BOARD row). Task v1 `dc3b38f9c1f5bacd1cedfe889b2757cc96a47c87f48c12a2fa55cb2a62321e1e` (verified).
**Date:** Sun 18 Oct 2026, ≈ 08:40 UTC. **Git:** `October-2026`, HEAD `3989ab1`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1. No code run.** The work folder was read only; no key file was opened.
**Independence:** LANE-11-ENG wrote the change. I wrote the B-1..B-4 wording (P3R) but not the code.

## Inputs (all re-hashed; all match)

| Input | SHA-256 |
|---|---|
| `claude/packets/MA-OCT-011.RUN_Report.md` (Sun 18 section) | `a1a7766a…dfc4` |
| `claude/packets/MA-OCT-011.P3R_Report.md` | `84a1c78c…b1ea` |
| `review/runner-prev.mjs` (= the P3R-reviewed runner) | `096cedb0…6b6c` |
| `review/runner-sun18.diff` / `review/tests-sun18.diff` | `a7d9092f…294b` / `4feab965…b237` |
| live runner / tests | `33abb71d…e7cc` / `3c62b075…67dd` |
| core (live = `review/core-prev.mjs`, unchanged) | `830b49a8…63c7` |
| plan `release-2026-10-16/plan.json` (= `plan.sha256`) | `e3854698…e6a8` |
| dry run `dryrun/2026-10-18-release/summary.json` | `eb6fad6b…fcd6` |

**Diff check.** I re-diffed `runner-prev.mjs` and `tests-prev.mjs` against the live files myself. The hunks match the supplied diffs **in content**; the only differences are hunk alignment between macOS and GNU `diff`. Since both endpoints match by hash, the review below is of the real change.

**Live state (local files only).** 23 forward checkpoints from Sat 17: 22 success, 1 partial, 0 failed, 0 mismatches. No `holds/readback-pending-*`. `recon/2026-10-17/ops-signoff.json` is now present.

## Verdict: **PASS WITH NOTES**

**Mon 19's first batch (B-022) may run** under the gates already in place, plus the reduced **C-1′** and the unchanged **C-2** below. **B-5** should ship before Tue 20, the heaviest day; until then, C-1′ (c) covers it.

## 1. B-1..B-4 against P3R: MET

| Item | Code | Tests | Result |
|---|---|---|---|
| **B-1** probe again just before each retry | `execNoRetryAfterWrites`: probe `p1` after the failure, sleep, then probe `p2` immediately before re-sending. A change or a probe error at either probe means no retry, `failed`, cursor kept. `retry_log` carries `phase` | B-1 test (in-flight writes land during the sleep → `[after-failure: true, before-retry: false]`, not re-sent, 250 `applied` against the original pre-image). Earlier P-3 tests tightened (before-retry probes 2 / 3) | **MET.** Closes P3R N-1. What remains is the milliseconds between `p2` and the re-send, which is data-safe (CAS / `INSERT OR IGNORE`) |
| **B-2** guarded read-back, checkpoint, hold | `readImagesRetry` (10 / 60 / 180 s, read-only). On persistent failure it writes a checkpoint (`failed`, `readback_pending`, every row `unknown`, pre-image path + SHA, `retry_log`), the hold `holds/readback-pending-<id>.json`, a run-log line and a `failed` / `readback_failed` heartbeat, then stops. `run` refuses through `failedBatchGate`; `restore` refuses on `readback_pending`. The new `readback --batch` is **read-only**: not in `writeCmds`, so `makeContext` opens the `readOnly` transport and `assertReadOnly` refuses any write. It diffs against the checkpoint's **original** `pre`, keeps `failed`, records its read-back file and lifts the hold | B-4(c) + B-2 test (no retry; 250 `unknown`; hold; run and restore refused; `readback` → 250 `applied`; hold lifted; C-1/B-3 then demands a restore) | **MET** for forward batches. Two gaps: N-1, and C-1′ (b) for restore-mode read-backs |
| **B-3** C-1 made mechanical | `failedBatchGate` runs before every plan batch. It refuses a forward checkpoint that is `failed` with `applied` or `unknown` rows until a restore checkpoint with `restore_of_run_id` = that run and outcome success/partial exists. A failed forward checkpoint is renamed to `<id>.failed-<run8>.json` before a re-run, never overwritten. `restore --all` adds failed forward batches with `applied` rows and no restore | B-4(a) + B-3 test (B-001 half applied: 1 write call; run refused; `restore --all` on a copy includes B-001, then P-002, then P-001, and returns the original replica; `restore --batch` exact; re-run succeeds; `B-001.failed-<run8>.json` kept) | **MET** for plan batches. Edges: C-1′ (a) and (c) |
| **B-4** tests (a) B CAS half applied, (b) concurrent writer, (c) probe fails | All three present (above). (b): one row changed by another writer, 0 `applied`, that row `mismatch`, no retry, and restore leaves `'CONCURRENT'` | — | **MET** |

## 2. Duplicate-LEI check: MET (counts toward the stop rule; cannot write)

- `diffBatch` counts the rows holding each P LEI in the post-image `em_lei`. That query is `INDEXED BY idx_entity_master_lei` with `lei IN (…)`, so it returns every holder. **Two or more holders is `mismatch`**, whatever the pre-image said, and it adds to `mismatches`, which feeds the existing rule (> 5 or > 0.5%).
- `diffBatch` is pure, with no D1 call, so the check **cannot write**.
- **Note N-2:** one duplicate in a 250-row P batch is 0.4%, so it is recorded but does **not** stop the batch.

## 3. No change to the plan, SQL, gates or ceilings: MET; probe reads counted

- Plan `e3854698…e6a8` is unchanged. P-1 on the new code: 22/22, `sql_sha256` `f5ae0dba…dd32`. Probes, read-back retries and `readback` all use `imageQueries`, so there is no new SQL pattern.
- The diff only **adds** code (read-back guard, `failedBatchGate`, `readback`, the duplicate check, the rename, `restore_of_run_id`). The flag, calendar, recon, R9-1, headroom, 120 s fetch-age, `assertTables`, `abGate`, 1.3× writes, 50k per execution and P-collision code is unchanged. CAS statements are still rendered from the plan.
- Probe reads (and `readback`'s) go through the transport ledger (`d1-ledger.jsonl`), which feeds **R9-1**, and the checkpoint now carries `probe_reads` (closes P3R N-2).
- `readback` skips the R9-1 pre-check, but it is ≤ about 500 reads and is ledgered. That is acceptable.

## 4. 41/0/0 and the dry run: ACCEPTED

36 earlier tests plus 5 new. Of the earlier tests, only 3 lines changed, and all three **tighten** assertions: the phase-split retry counts and `probe_reads > 0`. None is weakened. The dry run on the new code is unchanged: the same schedule, 0 calendar violations, holds in order, A 3,676, 0 new duplicate LEIs, full rollback identical.

## 5. C-1 / C-2: C-1 is **narrowed, not retired**; C-2 **stays**

**C-1 (as at P3R) is retired** for the case it was written for: a plan batch that failed after writes and would be re-run directly. B-3 now enforces that in code. **C-1′ replaces it**, for three edges the code does not yet cover:

- **(a) Before any `restore --all`, there must be no `holds/readback-pending-*.json`.** Run `readback --batch` first. `--all` picks up failed batches only when their diff shows `applied`. A pending checkpoint's diff is all `unknown`, so it is silently left out. (Fix: N-1.)
- **(b) If a `restore`'s own read-back fails,** the runner writes `<id>.restore-<run>.json` (pending) and the hold `readback-pending-<id>.json`. But `readback --batch` reads only the **forward** checkpoint, so it cannot lift that hold. `run` stays blocked, which is fail-closed and correct.
  - Response: when D1 is back, run `restore --batch <id>` again. It is idempotent: CAS on the 011-written values, and the verify compares with the original pre-image.
  - Then confirm it is `success`; the Operations Lead removes the hold by hand and logs it. (Fix: N-1.)
- **(c) Any batch that ends `failed` with `applied` or `unknown` rows, including a `-fb` fallback batch, ends that UTC day's forward run** after its restore (per C-1 / B-3). The Operations Lead decides whether to continue.
  - This covers two code gaps: `failedBatchGate` only checks the next plan batch, so a failed `-fb` batch does not block the next `run`; and **B-5** below.

**C-2 stays:** a `RUNNER ERROR` with no checkpoint means stop, report and no re-run. B-2 closed the read-back path, but a process crash, a Mac sleep or power loss mid-call can still leave no checkpoint.

## Code item (before Tue 20; LANE-11-ENG; reviewed by a hash check plus P-2)

**B-5. Count the writes of failed batches.**

- **The problem.** When the write call throws, `res` is empty, so the runner reports `writes: 0` (B-2 checkpoints record `null`). This has been true since the P-3 fix on Sat. `ownWrites` (`core:447`) sums run-log `writes`, so **011's 25k/day cap and the F-1 own-row window undercount by up to one batch** on a day with a failed-after-writes batch.
- **How big.** The dry-run day totals reach 24,917, so a failure day could pass 25k by ≤ about 1k. That is still far under N-4's 40k, and `d1-today` catches up after its 25–30 min lag.
- **The fix.** On any failed forward batch, report `writes` = Σ `est_writes` of the `applied` statements, plus `declared` for `unknown` rows. When `readback` completes, append a run-log adjustment line. Add a test.
- Until B-5 ships, C-1′ (c) makes this moot.

## Notes (non-blocking)

- **N-1.** Make C-1′ (a)/(b) mechanical:
  - `restore --all` refuses while any `readback-pending-*` hold exists;
  - `readback --batch <id> [--restore-run <run8>]` can complete a restore-mode pending checkpoint.
  - Optionally, `failedBatchGate` checks **all** failed forward checkpoints with no restore, not only the next plan batch's.
- **N-2.** Any second LEI holder is a §9 invariant breach ("New duplicate LEIs = 0"). Consider making it a stop on its own, not only through the 0.5% rule. P is complete since Sat 17, so this matters only for a P re-run or restore. A rows are already guarded by `NOT EXISTS` (W1-A).
- **N-3.** `readback` has no `--operator`, calendar or flag gate. It is read-only, so that is acceptable, but it should be run attended like the rest.

## Files written

- `claude/packets/MA-OCT-011.B4R_Report.md` (this file). Nothing else. The status JSON, the board and the Decisions Log are for the Main Lane.
