# MA-OCT-013.CHECK2: Report (REVIEW-A, Architect; independent, read-only delta check of MA-OCT-013.FIX2)

**Verdict: PASS WITH NOTES. 013 Day 1 may resume today on `190ea2f`** (runner `merge-013.mjs` sha256 `9ee97999a30790b8ae833ef9d5491382aba6a4bb993012fc1c344abab5c98499`) and live plan `7345e95f7e3e9a1ba4ca9131058ad7ec7ba67f4d265fac5d343940413c3a59ba`. None of the notes blocks the resume.

- **Timing:** reported Fri 6 Nov ≈ 13:30Z. The FIX2 report appeared at 13:20:46Z.
- **Scope kept:**
  - 0 D1 calls, 0 deploys, 0 commits.
  - No secrets or `.env*` read.
  - No edits to the shared checkout other than this file.
- **Worktree:** all work was done in my own detached worktree `~/MeridianAtlas-work/ma-oct-013/check2-worktree`.
  - My temporary probe file there was deleted afterwards, and the worktree is clean at `190ea2f`.
  - Logs: `~/MeridianAtlas-work/ma-oct-013/check2-*.log`, probes `check2-probes.part.mjs`.
- **Independence:** I did not write the runner or the fix.

## 1. Diff (`git fetch`; `5e41e7b..190ea2f` on `origin/October-2026`)
- **`190ea2f` itself (parent `e93d71e`):** touches only 2 files.
  - `scripts/merge-013.mjs`: +2 / −2, inside `budgetGate` only.
  - `tests/merge-013.test.mjs`: +13, the T-18 block only.
- **Patch identity:** `git diff e93d71e 190ea2f` has sha256 `0908af6f3e00a259e4e2955006bc5db7ee653f75570c02328b7b35c3065468e6`. This is byte-identical to `run1/fix/budgetgate-now-order.patch` and matches the FIX2 report.
- **The other 4 changed files in `5e41e7b..190ea2f`:** these are one line each in `wrangler-entities-enrich.toml`, `wrangler-entities-seed.toml`, `wrangler-bootstrap.toml` and `wrangler-holdings.toml`.
  - They come from the intervening `e93d71e` (MA-OCT-002b.DEPLOY), not from FIX2, and are not used by the 013 runner.
  - **Not a finding.**
- **Unchanged between `5e41e7b` and `190ea2f`** (`git diff --quiet`): `lib/merge-013-core.mjs` (plan builder, statement rendering, table allow-list, guards, restore rendering, `calendar013`, `writeAllowed`, `capsFor`, `budgetDecision`), `lib/gleif-reconcile-011-core.mjs` (`fetchD1Today`, `headroomDecision`), `scripts/merge-013.sh`, and the migrations.
- **The change is correct.**
  - `now` is now taken after `fetchD1Today` returns. The fetch stamps `fetchedAt = ctx.now()` on receipt, so `fetchedAt ≤ now` and `age ≥ 0`.
  - The `--assume-account` branch stamps its own `t` first, so `fetchedAt ≤ now` holds there too.
  - This is the same order as the accepted 011 runner (`gleif-reconcile-011.mjs:279-282`).
  - `ownWrites013` and `budgetDecision` now see the post-fetch time, which is the time the batch would actually start. That is the correct reference for the F-1 window and the caps.

## 2. Tests (own worktree)
| Run | Result |
|---|---|
| `node tests/merge-013.test.mjs` at `5e41e7b` (baseline) | 105/105 |
| same at `190ea2f` | **106/106** |
| `190ea2f` tests with the `5e41e7b` runner swapped in | **105/106**. `FAIL [T-18] … → {"r":{"stopped":"headroom_unavailable"},"merged":0}`. This is exactly the 12:29:34Z live symptom. |
| `node tests/gleif-reconcile-011.test.mjs` at `190ea2f` | 1 failure only: the known pre-existing N-9 "heartbeats through the real 002 outbox…". No 011 file is changed. |

T-18 is a real regression test for the defect: it uses the live d1-today path, a stub fetch, and a clock that moves on every `now()`.

## 3. Trying to break it: 27 extra probes, **27/27 pass**
The probes were run against the real `190ea2f` lib and runner. The 120 s bound and every other headroom rule still bite.

- **P1, freshness:**

  | Probe | Age or case | Result |
  |---|---|---|
  | P1a | 0 ms | ok |
  | P1b | 120,000 ms | ok |
  | P1c | 120,001 ms | `headroom_unavailable` |
  | P1d | −1 ms | `headroom_unavailable` |
  | P1e | reading dated 2026-11-05 on 6 Nov | `headroom_unavailable` |
  | P1f | no reading | `headroom_unavailable` |

- **P2, caps on a non-run date:**
  - `capsFor(2026-11-06)` and `capsFor(2026-11-09)` both return 25k/60k. `capsFor(2026-11-05)` returns 33k/70k.
  - Account ceiling:

    | Account reading | + batch | Total | Result |
    |---|---|---|---|
    | 59,201 | 800 | 60,001 | `budget_limit` |
    | 59,200 | 800 | 60,000 | ok (boundary) |

  - Own cap: 24,201 + 800 → `budget_limit "013 daily cap 25000"`.
  - F-1: 501 unpolled own rows tip the ceiling → `budget_limit`.
- **P3, F-2 and the F-1 window:**
  - F-2: `rowsWritten` falling from 5000 to 4000 within the day → `headroom_unavailable`. Yesterday's state is reset correctly.
  - F-1 window = max(45 min, time since the previous fetch). Measured 50 min with the post-fetch `now`.
- **P4, live d1-today path through `cmdRun`** (no `--assume-account`, hand-driven clock, clock set to Fri 6 Nov 13:30Z):

  | Probe | Case | Result |
  |---|---|---|
  | P4a | fresh reading | batches run |
  | P4b | clock jumps 121 s between the `fetchedAt` stamp and the gate's `now` | `headroom_unavailable`, 0 merged |
  | P4c | d1-today dated yesterday | `headroom_unavailable`, 0 merged |
  | P4d | second reading lower than the first (F-2) | stops after batch 1 |
  | P4e | account 59,999 | `budget_limit`, 0 merged |
  | P4f | 65,000 on Thu 5 (70k ceiling) | runs, as designed |
  | P4g | fetch throws | `headroom_unavailable`, 0 merged |

- **P5:** `--assume-account`, `--clock` and `--no-ops-gates` are each refused on a remote transport (`makeContext` throws before any transport is used).
- **P6:** the `--assume-account` local path still runs.
- **Other `ctx.now()` orderings, checked by reading the code:**
  - `startGates` takes `now` before the `ops_job_pause` and `ops_job_run` reads. It uses it only as an instant inside a window and for the ≥ 17:45Z test, not as an age, so the order is harmless.
  - `calendar013(ctx.now(), …)` and `writeAllowed(ctx.now())` (in `executeBatch`) each take a fresh `now` at the point of use, and neither compares against a fetched stamp.
  - The checkpoint, readback, event and runlog stamps are only labels.
  - No other freshness or age comparison exists in the runner.

## 4. Plan, statements, guards, restore: unchanged
- **Live plan:** `~/MeridianAtlas-work/merge-013/plan-fri6/plan.json` has file sha256 `7345e95f7e3e9a1ba4ca9131058ad7ec7ba67f4d265fac5d343940413c3a59ba` (as expected). FIX2 changes no plan, statement, guard or restore code (§1).
- **FIX2 replica dry run, independently read from `fix2/dryrun-fix2.out`:**
  - The script ran in `fix2-worktree` at `190ea2f`, with runner sha `9ee97999…8499`.
  - Plan: dry plan `ea8bace8…c02d`, the same as BUILD and FIX.

  | Step | Result |
  |---|---|
  | before | `52ac0591…d45b` (44,517 / 1,868 / 63 / 0) |
  | `run` | `{"done":true,"ran":38}`. 38 final and 38 provisional checkpoints, **1,862 merged**, 0 raced, 0 breach, 0 stops, 29,918 modeled writes. |
  | `verify` | `ok: true`. 0 duplicates still live, 0 survivors missing, all reference probes 0, 0 held ids merged. |
  | `restore --all` | 38 batches, 1,862 restored, `all_identical: true`. The hash is back to `52ac0591…d45b`, **byte-identical**. |

## 5. Notes (none blocks the resume)
- **N-A (design, pre-existing, same as 011):** the 120 s bound does not measure how stale the server's d1-today data is.
  - `fetchedAt` is stamped locally on receipt, so the bound only measures the local gap between the response and the decision. That gap is about 0 s in practice.
  - The real protection against stale data is the UTC-date check, F-2 (monotonic) and F-1 (unpolled own rows). All of these are intact (P1e, P3, P4c, P4d).
  - The fix restores the 011 behaviour; it does not weaken anything.
- **N-B (run planning): today, Fri 6 Nov, is not `RUN_DATE`, so the caps are 25k own / 60k account.**
  - The whole plan models 29,918 writes, which is over 25k. Day 1 therefore cannot finish all 38 batches today.
  - Expect a clean `budget_limit "013 daily cap 25000"` stop, with a remainder file, after about 31–32 batches. It can come earlier if the account's own reading nears 60k.
  - This is designed behaviour. It is not a defect.
- **N-C (pre-existing, minor):** `calendar013` is checked before `budgetGate`, and the d1-today fetch can take up to about 6 s (2 s ceiling + 2 s retry delay + 2 s).
  - So a batch can start a few seconds after a calendar pass, for example just after 16:45:00Z.
  - `executeBatch` re-checks only `writeAllowed` (23:30Z).
  - Same class as a batch already running into the band. **The run lane should not start a batch after about 16:44Z.**
- **N-D (coverage):** the live d1-today path is covered by T-18 and P4a–g with stubbed fetches only. No real d1-today call was made in FIX2 or CHECK2, by scope.
  - The first live batch is the real test.
  - If anything is still wrong there, the gate fails closed (`headroom_unavailable`, 0 writes), as it did at 12:29Z.
- **Carried, unchanged:** N-2, N-7, N-9 from 013.FIX/CHECK.

## 6. For the run lane
- Re-point `run-worktree` to `190ea2f` and confirm the runner sha256 is `9ee97999…8499` before the first batch.
- Keep the live plan `7345e95f…59ba`.
- Finish Day 1's batches before the 16:45Z FREEZES band (N-C).
- Expect the 25k own-cap stop (N-B).
