# MA-OCT-013.FIX — Report (LANE-1-ENG, Engineering Lead)

**Fix commit: `5e41e7be3eff77f837538ef77ddca8e9349cbaa9` (`5e41e7b`) on `October-2026`, pushed 20:20:55Z Thu 5.**
- Parent: `7c0ad2e` (002b). The fix was rebased over it with no overlap; its base is `3c8866b`.
- All 7 must-pass items from the CHECK Routing section are done, including item 7 (should-fix). N-1 (optional) was not done and goes to November.
- **0 D1 calls, 0 deploys.** Replica only. Ready for the REVIEW-A delta re-check.

## Opener (20:08Z)
- **Hashes:**
  - Control `b04db2a8…fa7c` matches the invocation and board row 113.
  - Task `4fffb849…7cab` matches the Control.
  - The governing CHECK report `d8b6cdf4…1412` and delta check `1a2b2a61…02a9` both match.
- **Environment:** no `.git/*.lock`; own worktree `~/MeridianAtlas-work/ma-oct-013/build-worktree` at `3c8866b`.

## 1. Files (one commit, explicit paths)
| Path | SHA-256 at `5e41e7b` |
|---|---|
| `App/Corporate Atlas/scripts/merge-013.mjs` | `80ee9cd5913aa64a9d4e6bb78bf8dd1a3b6315d54974e6c372bc82cf6c532048` |
| `App/Corporate Atlas/lib/merge-013-core.mjs` | `6a5fbf126bb4f58478d87b7904f5cc96342fbfa6cc61b7124e692d4bd602c2f2` |
| `App/Corporate Atlas/tests/merge-013.test.mjs` | `de522afc30c1aa119c23b0ad4605fc998fa2edb514a29d0e78b769339822f5d4` |
| `claude/packets/MA-OCT-013.BUILD_RunSheet.md` | `35dd89653e448ecc37663f040fb9f5e536de82a81992c3aa7425fb3e5f58aca3` |

The diff is +237 / −38. The migration, `merge-013.sh` and `.gitignore` are unchanged. The secret scan found 0 key-like strings.

## 2. Must-pass items → code → test
| # | Item | Implementation | T-17 evidence |
|---|---|---|---|
| 1 | **Write-once rollback inputs** | `writeOnce()`: writes a temporary file with `wx`, then `linkSync`, so the file appears whole and never replaces an existing one (EEXIST). It is used for the pre-image, the provisional checkpoint and the final checkpoint. `executeBatch` refuses any batch of this plan that already has a pre-image, provisional or final checkpoint: it runs **0 reads and 0 writes** and returns "refused … do not re-run …". `cmdRun` then leaves the cursor, `done` and the earlier remainder untouched. | Re-run after the injected failure: refused, 0 write statements, database unchanged; pre-image byte-identical; provisional, cursor and remainder unchanged. Re-run over a *final* checkpoint (stale cursor): refused. `writeOnce` EEXIST. |
| 2 | **Provisional checkpoint** | Written before the execute call: `{batch, plan_sha256, token, preimage, preimage_sha256, state:'executing', live, transport, utc}`, named `checkpoints/<id>-<plan12>.provisional.json`. The final checkpoint keeps its old name and adds `state:'final'`. | The injector reads the file at the moment of the `merge-B01` call: present, `executing`, its token equals the pre-image's token, and the SHA matches the pre-image bytes. |
| 3 | **Recovery from provisional** | `loadBatchArtifacts` uses the final checkpoint if there is one, otherwise the provisional. It checks the plan / batch, the pre-image SHA and token equality. From a provisional, `readback` and `restore` classify the batch at that moment with its token. Restore covers `merged` only and lists the rest in `not_restored`. `restore --all` includes provisional-only batches. Each readback is appended to `readbacks/`. | `readback` → `checkpoint: provisional`, 4 merged. `restore --batch B01` → `from: provisional`, 4 restored, byte-identical; database equals the before-run copy. A repeat restore is a 0-write no-op. |
| 4 | **Bounded retry** | `retryRead()` wraps `rb-em`, `rb-redirect`, the reference probes and the restore verify reads. It makes 1 try plus 3 retries, with backoff of 2 s, 5 s and 10 s. Allow-list refusals are never retried. On final failure the outcome is `failed` / "executed, unclassified — run `readback` …; do not re-run …". The cursor does not advance, and the remainder starts after the batch. | Persistent `rb-em` failure: 4 tries, increasing backoff, `unclassified: true`, cursor `next = 0`. A single code-10000 failure recovers on the second try and the run completes. |
| 5 | **T-17 + full suite** | T-17 has 18 checks (A, A′, re-run over final, write-once, clock stop, should-fix, run-sheet line). | **105/105** (87 + 18). See §3. |
| 6 | **Run-sheet line (f)** | Kill-switch table row: "**After any RUNNER ERROR: do not re-run. `$S status` → `$S readback --plan $P --batch <last>` → Operations Lead.**" R6 limits "re-run the same command" to clean batch-boundary stops and describes the retry behaviour. The restore section covers the provisional case. The N-4 wording is fixed: the in-flight call is no longer described as "one transaction". | T-17 (f) matches the line verbatim. |
| 7 | **Should-fix** | `renderRestore`: R2-reinsert and R3-queue now carry `AND NOT EXISTS (SELECT 1 FROM <table> WHERE entity_id = :dup)`. | Restore over a partially applied restore (R1, R2 and R3-queue already applied unguarded): it completes byte-identical with no PK conflict. The rendered SQL carries both guards. |
| 8 | N-1 (optional) | **Not done.** It is outside the Task's scope (items 1–6, plus 7 if feasible). Carried to November. | — |

**One extra change:** the 23:30 `writeAllowed` clock check now runs *before* the pre-image is taken. Without that, a clock stop would have left a pre-image behind, and guard 1 would have locked an unexecuted batch. T-17 covers it: at 23:31 the outcome is `budget_limit` and no pre-image exists.

## 3. Tests
- **`merge-013.test.mjs` on `5e41e7b`: 105/105**, run both before and after the rebase.
- **Tests fail on `3c8866b`:** the new test file was run against a clean `git archive 3c8866b`. Result: **89/105, with 16 T-17 checks failing**, covering every item:
  - (d) exit message, (d) retries (`tries: 1`) and (d) transient recovery;
  - (b) provisional;
  - (a) re-run refused, (a) pre-image unchanged, (a) final-checkpoint re-run and (a) `writeOnce`;
  - (c) readback, (c) restore, (e) byte-identical and the repeat restore;
  - the clock-stop pre-image;
  - the two should-fix checks;
  - (f).

  On the base, the re-run reproduces B-1 exactly: readback reports "breach: unexpected state", because the checkpoint was rewritten with the new token, and restore restores 0. The 2 checks that pass on the base only record state ("the batch committed"; "no final checkpoint / cursor 0").
- **Regression:**
  - nav-007-worker **58/58**.
  - `gleif-reconcile-011.test.mjs`: **41/42**. The one failure is the known pre-existing "heartbeats through the real 002 outbox" (N-9), unchanged.
  - No 011 file is changed.

## 4. Replica dry run (local SQLite, 0 D1 calls; `build/fix/dryrun-fix.sh`)
Fresh copy of the BUILD replica, hash `52ac0591…d45b` (`entity_master` 44,517 / queue 1,868 / iem 63). Plan `plan-dry`.

| Step | Result |
|---|---|
| Plan | `plan.sha256` = **`ea8bace81ff9b5d2ea072d82f510e2fb451235ff15034cd70acd06b2d722c02d`**, which `loadPlan` validates under the new runner. A re-plan from `export-thu5` with the new code is **identical to `ea8bace8…` except `created_utc`** (it gives 1,862 / 38 / R 62 / 2 cik / 3 LEI / 30,395 declared / the 6 held). |
| 1. One batch (work1) | B01 → pilot hold, 50 merged (`entity_master` 44,467, 50 redirects). `restore --batch B01` → `from: final`, 50 restored, **byte-identical**; table hash back to `52ac0591…d45b`. |
| 2. All 38 (work2) | **38/38 batches, 1,862 merged, 0 raced, 0 breach, 0 stops**; 29,918 modeled merge writes, as at BUILD. `lei`: 3/3 (113390, 110563, 2778). `verify ok: true`. `restore --all`: 38/38, 1,862, **all identical**; hash back to `52ac0591…d45b`. |
| 3. B-1 injection on real replica rows (work3) | Every `rb-em` read fails after B01 commits: 4 tries, then `failed` / `unclassified`. The re-run is **refused, 0 write statements sent**. `readback` from provisional: 50 merged. `restore` from provisional: 50 restored, **byte-identical**; hash back to `52ac0591…d45b`. |

**An operator error on my first attempt, recorded for completeness:**
- My script's step "1b" re-ran `run` in work1 after the B01 restore, expecting a refusal.
- The cursor was correctly already past B01, so it ran B02–B38. That is correct behaviour; the expectation was wrong.
- A second work dir then hit B02's existing redirects, and the runner correctly stopped on `breach`.
- I discarded that replica and ran the clean sequence above on a fresh copy.
- **Lesson for the run sheet (already its rule):** a single `$W` per run. LEI state and checkpoints live in the same work dir, so a restore from a different work dir cannot clear an LEI applied elsewhere (seen on B33 in the discarded copy).

## 5. For REVIEW-A (delta re-check)
- **Diff:** `git diff 3c8866b 5e41e7b -- "App/Corporate Atlas" claude/packets/MA-OCT-013.BUILD_RunSheet.md`. `7c0ad2e` (002b) sits between them and touches none of these files.
- **Injection:** the provisional checkpoint is in `checkpoints/`. A `restore` after an unclassified exit reports `from: provisional` and `not_restored`.
- **N-1** (allow-list parser tightening) is not in this commit. It goes to November.
- **Unchanged and still open:** N-2 (R0 records that the seed and backfill do not fire in the window), N-7 (RUN records the FREEZES SHA that the plan pinned) and N-9 (the 011 failure).

## Hygiene
- **D1:** 0 reads, 0 writes; no deploys; no production change, so no announcement is needed.
- **Secrets:** none read (ML-1024-1); `dryrun-fix.env`-style work files hold only `WORK_DIR` / `JOB_ID`. No macOS prompts.
- **Git:**
  - staging by explicit path (4 files), `pull --rebase` onto `origin/October-2026`, nothing on `September-2026`;
  - `13F Seed/gleif-seed.js`, `.env*` and `.claude/settings.local.json` untouched;
  - own worktree only.
- **Local artefacts:** `~/MeridianAtlas-work/ma-oct-013/build/fix/` holds `dryrun-fix.sh`, `inject.mjs`, `replica.sqlite`, work1–3 and `plan-re/`.
