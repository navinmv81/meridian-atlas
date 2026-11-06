# MA-OCT-013.FIX2: Report (LANE-1-ENG, Engineering Lead)

**Outcome:** fixed, tested, dry-run and pushed. Reported Fri 6 Nov ≈ 13:21Z, ahead of the 13:30Z deadline.
- **Commit:** `190ea2f` on `origin/October-2026` (parent `e93d71e`; `e93d71e..190ea2f` was a fast-forward, no rebase conflicts).
- **0 D1 calls, 0 deploys.** Only the local replica was used. No secrets read, no macOS prompts.
- **Untouched:** the shared checkout's code, `run-worktree`, `~/MeridianAtlas-work/merge-013/`.
- **Worktree:** `~/MeridianAtlas-work/ma-oct-013/fix2-worktree`, created from `origin/October-2026` at `e93d71e`. Its `App/Corporate Atlas` 013 files (runner, lib, tests) were confirmed equal to `5e41e7b` before the patch. The only differences from `5e41e7b` were two `wrangler-entities-*.toml` lines from 002b.DEPLOY.

## 1. Patch review
- **Patch:** `run1/fix/budgetgate-now-order.patch`, sha256 `0908af6f…68e6`, verified.
  - It applied cleanly to `5e41e7b`.
  - The committed diff is **byte-identical** to it (same sha256).
  - I reviewed it before applying it.
- **Defect:** `budgetGate` took `const now = ctx.now()` before `fetchD1Today`, and `fetchD1Today` stamps `fetchedAt = now()` after the response.
  - So `age = now − fetchedAt` was always below 0 on a real network.
  - `headroomDecision` (`0 ≤ age ≤ 120000`) therefore failed closed on every batch.
- **Fix:** `now` is taken after the fetch, matching the 011 runner's `headroomGate` (`scripts/gleif-reconcile-011.mjs:279-282`).
  - The `--assume-account` branch now stamps its own `t`, so its `fetchedAt` is still ≤ `now`.
  - `ownWrites013(…, now)` and `budgetDecision` now see the post-fetch time. That is correct: it is the time the batch would start.
- **Other captures checked:** every `ctx.now()` in `merge-013.mjs` was checked for a timestamp taken before a fetch or D1 read and then used for freshness.
  - Only `budgetGate` had the bug.
  - `startGates` (line 430) takes `now` before the boost-pause query, but uses it only as a point inside a window (`starts_at ≤ iso < ends_at`, and `iso ≥ 17:45`). It is not an age check, so it is unaffected.
  - `eventFor`, `report`, the checkpoint and readback stamps, and `writeAllowed`/`calendar013` do not compare against a fetched timestamp.

```diff
 async function budgetGate(ctx, batchWrites) {
-  const now = ctx.now();
   let reading = null, fetchError = null;
-  if (ctx.args['assume-account'] !== undefined) reading = { rowsWritten: Number(ctx.args['assume-account']), date: utcDate(now), fetchedAt: now.toISOString() };
+  if (ctx.args['assume-account'] !== undefined) { const t = ctx.now(); reading = { rowsWritten: Number(ctx.args['assume-account']), date: utcDate(t), fetchedAt: t.toISOString() }; }
   else { try { reading = await fetchD1Today({ url: D1_TODAY_URL, fetchImpl: ctx.fetchImpl, now: ctx.now }); } catch (e) { fetchError = e.message; } }
+  const now = ctx.now();   // after the fetch, as the 011 runner's headroomGate (fetchedAt <= now, so age >= 0)
   const own = ownWrites013(ctx.paths, now);
```

`tests/merge-013.test.mjs`: **T-18** adds 13 lines.
- It runs `cmdRun` with no `--assume-account` and a stub `fetchImpl` returning `{ok:true, date:'2026-11-05', rowsWritten:1000}`.
- The test clock advances 1 s on every `now()` call.
- It asserts that the run is not stopped `headroom_unavailable` and that merges happen.

| File | sha256 after the fix |
|---|---|
| `scripts/merge-013.mjs` | `9ee97999…8499` (was `80ee9cd5…2048` at `5e41e7b`) |
| `tests/merge-013.test.mjs` | `4c0159d4…4ca5` |

## 2. Tests
| Suite | Result |
|---|---|
| `node tests/merge-013.test.mjs` (fixed runner) | **106/106 passed** |
| same tests, with the runner at `5e41e7b` | **105/106**: `FAIL [T-18] … → {"r":{"stopped":"headroom_unavailable"},"merged":0}`. This is exactly the live symptom. |
| `node tests/gleif-reconcile-011.test.mjs` | **41/42**. The one failure is the known pre-existing N-9, "heartbeats through the real 002 outbox…", the same as 013.FIX. No 011 file is changed. |

## 3. Replica dry run (local SQLite, 0 D1 calls; `~/MeridianAtlas-work/ma-oct-013/fix2/dryrun-fix2.sh`)
- **Setup:** this mirrors 013.FIX step 2, on a fresh copy of the BUILD replica (`build/replica-thu5.sqlite`).
  - Plan: `build/plan-dry` (`ea8bace8…c02d`), the same dry plan as BUILD and FIX. The live plan is `7345e95f…59ba`.
  - Flags: `--clock 2026-11-05T18:20Z --assume-account 5000 --no-ops-gates`.
  - Work dir: `fix2/work` (own `work.env`).
- **Output:** `fix2/dryrun-fix2.out`.

| Step | Result |
|---|---|
| before | `52ac0591…d45b` (`entity_master` 44,517 / queue 1,868 / iem 63 / redirect 0) |
| `migrate` | applied |
| `run` | `{"done":true,"ran":38}`: **38 final + 38 provisional checkpoints, 1,862 merged, 0 raced, 0 breach, 0 stops**, 29,918 modeled writes. Afterwards: `entity_master` 42,655, queue 6, redirects 1,862. |
| `lei` | 3/3 applied (113390, 110563, 2778) |
| `verify` | `ok: true`. 0 duplicates still live, 0 survivors missing, every reference probe 0, 0 held ids merged. |
| `restore --all` | 38 batches, 1,862 restored, **`all_identical: true`**. The hash is back to `52ac0591…d45b`. |

- **Note:** the dry run uses `--assume-account`, like BUILD and FIX, so it shows the fix changes nothing on that path.
- **Live-path coverage:** the live d1-today path is covered by T-18. A real d1-today fetch was not made, because local transport only was allowed.

## 4. Hand-over
- **For LANE-11-ENG:** the run worktree needs `190ea2f`, so the Day-1 runner is `merge-013.mjs` `9ee97999…8499`. Updating it is the run lane's job.
- **For the Architect:** the delta check covers only the 2-file diff above (sha256 `0908af6f…68e6`).
- **Open items carried from 013.FIX, unchanged:** N-2, N-7, N-9.
