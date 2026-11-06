# MA-OCT-013.CHECK — Report (REVIEW-A, Architect)

**Verdict (updated 20:40Z Thu 5): PASS WITH NOTES, on the 013.FIX commit `5e41e7b`.**
- B-1 is closed. Must-pass items 1–7 are verified in the code, by the tests, and by REVIEW-A's own failure injection.
- **When RUN may start:** first in November (ML-1105-3), on `5e41e7b`, once the Main Lane has re-dated 013.RUN (N-14 below). It may not start on `3c8866b`.
- See "Re-check of 013.FIX" below and delta check §7.

---
*Original verdict, kept for the record:*

**Verdict: FAIL as of 07:43Z Thu 5. The run may not start on `3c8866b`.**
- 1 BLOCKER (B-1), 0 other MUST-FIX, 9 NOTES.
- All 15 rev-0 MUST-FIX items are closed in the spec **and** in the code.
- The single blocker is a small runner fix. On its commit I re-check only that delta (≈ 30 min) and expect **PASS WITH NOTES**, well before the ≥ 18:15Z start.

Delta check: `claude/MA-OCT-013_Delta_Check.md`, SHA-256 `1a2b2a6128e4330ab0de3bf9785ac05d18aa238a20b383333e2ff0388fb902a9`.

## Opener
- **Control and Task:**
  - Control `02b76656…44d7` matches the invocation and board row 109.
  - Task `d57da471…84d8` matches the Control.
  - No `.git/*.lock`.
- **ML-1105-2 (wait for the build):**
  - Watched from 06:40Z.
  - The INTERIM build report (21:10Z Wed, "Not ready for CHECK") was not taken as the trigger.
  - The final report landed at 07:27Z; execution started at 07:28Z.
- **Inputs verified:**
  - spec rev 1 `e6dc8567…f098`;
  - commit `3c8866b` on `origin/October-2026`;
  - all 6 build files match the report's SHA-256s;
  - the BUILD export manifest `6133c424…8b06`.

## What I did
All of it read-only, on local replicas, with 0 D1 calls.
- **Spec and code:** read spec rev 1, the three rev-0 reviews, the core library, the runner, the entry script, the migration and the run sheet. Mapped each MUST-FIX to its spec section, code, test and my own evidence (delta check §1).
- **Tests:** re-ran the suite on a clean archive of `3c8866b`: **87/87**. nav-007-worker 58/58. 011 shows the one known pre-existing failure, which is not 013's.
- **Plan:** re-planned from the build export. The result is **identical** to the build plan `ea8bace8…`:
  - 1,862 merges, 38 batches;
  - R = 62, 2 cik fills, 3 LEIs;
  - 30,395 declared writes;
  - the 6 sign-eligible pairs held.
- **Replica dry run:**
  - **1,862 merged, 0 raced, 0 breach;**
  - 3 / 3 LEIs applied; `verify ok`;
  - `restore --all`: 38 / 38 byte-identical;
  - a repeat restore is a 0-write no-op.
- **Attacks:** **every one of 17 race attempts and 4 forced-token dangling-reference attempts held** (0 changes; duplicate never deleted).
- **Run sheet:** confirmed the caps, the remainder rule, the kill switch and the restore (delta check §5).

## B-1 (blocker)
- **What happens:** a failure on a read after a batch call has committed leaves that batch with no checkpoint, so `restore --batch` refuses.
- **The re-run:** the natural recovery is to re-run the same command. It writes 0 rows, but it **overwrites the batch's pre-image** with post-merge state.
- **Effect:** the rollback input for up to 50 merges is destroyed.
- **Reproduced:** by injecting one wrangler code-10000-style error on the readback.

**Fix (a–f in delta check §4):**
- write-once pre-image and checkpoint;
- a provisional checkpoint before the execute call;
- `readback` and `restore` work from it;
- bounded retry of the idempotent post-execute reads;
- test T-17;
- one run-sheet line ("after any RUNNER ERROR: do not re-run").

**Should-fix in the same commit:** `NOT EXISTS` guards on the restore re-inserts.

## Notes (do not gate the run)
- **N-1** The allow-list parser misses backtick, bracket and comma-join table forms. The renderer never emits them.
- **N-2** `fund_entity_link` and facts are probed per batch only. No writer is in the window, and only 2 run-set duplicates carry a cik. **RUN R0 must record this.**
- **N-3** The spec's PK-abort text is unreachable (safe).
- **N-4** "One transaction" is unverified wording.
- **N-5** cik conflicts and held-elsewhere skips are not listed (0 on Thu 5).
- **N-6** The LEI step scans the redirect table (≈ 5.6k reads).
- **N-7** The FREEZES copy in the commit differs from the live file. The calendar is identical for Thu 5.
- **N-8** One `raced` merge stops the run.
- **N-9** The pre-existing 011 test failure.

## Hygiene and usage
- **D1:** 0 reads, 0 writes, 0 EXPLAINs (cap 20).
- **No** deploys, commits or `git add`. No secrets read; `13F Seed/gleif-seed.js`, `.env*` and `settings.local.json` untouched.
- **Scratch:** the replicas and scripts (`break.mjs`, `inject.mjs`) live in the session scratchpad, outside the repo.
- **Files written:**
  - `claude/MA-OCT-013_Delta_Check.md`;
  - this report.
- **Production:** none, so no production-change announcement is needed.

**Next:** the Main Lane routes B-1 to LANE-1-ENG, then REVIEW-A runs the delta re-check on the fix commit.

## Routing: B-1 → LANE-1-ENG (Founder: "Yes, route B-1", Thu 5)
Under `Claude.md` v1.1, LANE-1-ENG works only from a Control on the board, and only the Main Lane writes Controls. REVIEW-A therefore cannot route B-1 directly. This section is written so the Main Lane can lift it into a Control and Task (suggested id **MA-OCT-013.FIX**) unchanged.

**Scope:** B-1 fix (a)–(f) exactly as in delta check §4. Same lane and worktree as 013.BUILD. Base `3c8866b`.
- **Files:**
  - `App/Corporate Atlas/scripts/merge-013.mjs`;
  - its tests;
  - the run sheet;
  - optionally `lib/merge-013-core.mjs`, for the should-fix and N-1.
- **Rules:**
  - no D1 calls of any kind (replica only);
  - no deploys;
  - one explicit-path commit on `October-2026`, then push.
- **Must-pass (REVIEW-A re-checks each one):**
  1. **Write-once rollback inputs:** pre-image and checkpoint created with `wx`. A re-run on a batch that has a pre-image but no final checkpoint is refused with 0 writes and the "do not re-run" message.
  2. **Provisional checkpoint:** it is on disk before the execute call and carries the token, the pre-image path and the pre-image SHA.
  3. **Recovery from the provisional checkpoint:** `readback` and `restore --batch` both work from it.
  4. **Bounded retry:** post-execute reads retry ≥ 3 times with backoff. On final failure the runner exits "executed, unclassified — run `readback`" and the cursor stays put.
  5. **Test T-17** passes, plus the full suite (87 + T-17). The one known 011 failure is unchanged.
  6. **Run-sheet line (f)** is present.
  7. **Should-fix:** `NOT EXISTS` guards on R2-reinsert and R3-queue. Strongly preferred in this commit.
  8. **N-1:** optional.
- **Report:** the commit SHA, the SHA-256s of the changed files, and the test counts.

**REVIEW-A re-check on that commit (≈ 30 min, read-only, replica only):**
- review the diff;
- run the full suite and T-17;
- re-run REVIEW-A's own injection (`inject.mjs`) against the new runner;
- run a one-batch run → restore round trip, byte-identical;
- check the plan SHA is unchanged (`ea8bace8…`).

Verdict PASS WITH NOTES if all hold. **Latest useful hand-off:** the fix commit by ≈ 17:15Z. That leaves the re-check plus RUN R0 inside the ≥ 18:15Z start.

## Re-check of 013.FIX (`5e41e7b`, 20:25–20:40Z Thu 5)
**Result: PASS WITH NOTES.** 0 D1 calls; no commits or deploys; local replicas only.

**Inputs:**
- FIX Control `b04db2a8…fa7c` and Task `4fffb849…7cab` match board row 113.
- The FIX report is `5e7fc9e4…cece4`.
- All 4 changed files match its SHA-256s.
- The intervening `7c0ad2e` (002b) touches none of the 013 files.

**Results:**
- **Diff:** reviewed (+237/−38). Items 1–7 are in the code as specified. The extra change (the clock check moved before the pre-image) is sound.
- **Tests:**
  - **105/105** on `5e41e7b`.
  - The same tests on `3c8866b` give **89/105**, so T-17 catches B-1.
  - nav-007-worker 58/58.
  - 011: 41/42, the same known failure (N-9).
- **REVIEW-A injection** (persistent `rb-em`, persistent `rb-redirect`, one transient `rb-em`, execute-call failure):
  - after a read failure the runner exits "executed, unclassified";
  - a provisional checkpoint is present;
  - **the re-run is refused with 0 writes**;
  - the pre-image and the cursor are unchanged;
  - readback and restore work from the provisional checkpoint: 50 restored, **byte-identical**;
  - a repeat restore is a no-op;
  - the transient failure recovers on retry.
- **Full replica round trip:**
  - 38/38 batches, 1,862 merged, `verify ok`;
  - `restore --all` identical, back to the pre-run state.
- **Plan:**
  - `ea8bace8…` is unchanged on disk and still loads.
  - A re-plan on the tip differs only in `created_utc` and `inputs.seed_src`, which is a provenance hash of `entities-seed.js` that 002b changed.

**New notes (none blocks; detail in delta check §7.4):**
- **N-10** A crash between the pre-image write and the provisional checkpoint locks an unexecuted batch with no checkpoint. Recovery is manual. Accept.
- **N-11** If the execute call fails before it commits, readback labels the batch `raced`. Read the stop reason first. November: add a `not_committed` class.
- **N-12** After a failed or unclassified batch, the day's run ends; the rest continues through the remainder. This is intended.
- **N-13** RUN records which plan SHA it uses.
- **N-14 (action for the Main Lane before RUN):**
  - `RUN_DATE` is hard-coded to 2026-11-05. On any other day the caps are **25k / 60k**, so the set splits into **31 batches / 1,550 merges** on day 1 and **7 batches / 312 merges** on day 2 (shown on the replica).
  - The RUN Control and the Founder's approval still say Thu 5, and the FREEZES 013 window has been removed.
  - Re-date RUN, add a new FREEZES window, and get the Founder's approval of the date and of the two-day split. Raising the cap instead is a code change and needs another re-check.
  - At R0, re-check N-2 for the new window: backfill at 09:00Z daily, seed on Mondays at 04:00Z.
- Still open: N-1 (November), N-2, N-7, N-9.

**Hygiene:**
- D1: 0 reads, 0 writes, 0 EXPLAINs.
- No commits and no `git add`.
- No secrets read; `13F Seed/gleif-seed.js`, `.env*` and `settings.local.json` untouched.
- Scratch files (`inject2.mjs`, `full2.mjs`, `rev2/`) are in the session scratchpad, outside the repo.

MA-OCT-013.CHECK reported
