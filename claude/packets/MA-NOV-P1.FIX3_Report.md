# MA-NOV-P1.FIX3 — Report

```text
EXECUTED BY:  Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md (sha256 67913343…71d6 verified)
RUN:          r-20261109T064454Z-91b0 · session 4dae9d0d-531f-40d8-a048-c9621b2d1332 · begun 2026-11-09T06:44:54Z
CONTROL:      MA-NOV-P1.FIX3_Control_v1.md  5ea7be9bb3901e2f03afea3c9dae123a82989d22f44e64413d195248ff1bbfa2 (matches Status)
TASK:         MA-NOV-P1.FIX3_Task_v1.md     fa9f15559cbdd32437a52d5004194aa00d463788e05917dcb07bbe7fe79c48a7 (matches Status)
REVIEWER:     Architect — MA-NOV-P1.REVIEW3 (light)
```

## Items

| # | Change | File:line | Test |
|---|---|---|---|
| 1 G1 | Committed paths = union of `git diff --no-renames --name-only` and `git log --no-renames --format= --name-only` over `<start>..HEAD`. If HEAD is not a descendant, only the net diff is used (already BLOCKED; the log range would list unrelated history and pollute test 25's reason). | `tools/factory/dispatch.mjs:157-166` | 33 |
| 2 G2 | `refSnapshot` (`git for-each-ref`) is saved in `before.json` → `refs` by `begin` (`:516`) and headless `run` (`:443`, which now writes a `before.json` too). `refChanges` (`:179`) skips the current branch, plus `refs/remotes/origin/<branch>` with `allow_commits` only. Anything else changed, new or removed → BLOCKED "ref changed: <ref>". Missing `refs` → `run.json` `ref_check: "unavailable"` (`:386`), not BLOCKED. | `dispatch.mjs:169-187, 386, 443, 516, 556` | 34, 35 |
| 3 G3 | An unparsable `.global.lock` is retired by stale handling only if its mtime is more than 60 s old. | `dispatch.mjs:252-254` | 36 |
| 4 G4 | Lease has `session_id` and the caller has none → `RefusedError` "end needs the session that began the run" (exit 2, nothing written). | `dispatch.mjs:535` | 37 |
| 5 G5 | `transitionsMark` saves `{size, sha256}` in `before.json` → `transitions`. At the end, if the first `size` bytes changed or the file shrank → BLOCKED "transitions log rewritten". `run.json` `transitions_check`: `append-only` / `rewritten` / `unavailable`. | `dispatch.mjs:189-200, 386` | 38 |
| 6 Closure | `CHANGES_REQUESTED → APPROVED` added to the table. `checkClosure` requires writer `main-lane` and the same write setting `closure_by` (new value) to the id of a packet whose Status is `CLOSED`; otherwise `TransitionError`, nothing written. Documented in README (FIX3 section + ownership table). | `tools/factory/lib/state.mjs:21, 88-99, 111`; `README.md:72` | 39 |
| 7 Outcomes | `kind: "outcome"` / `"carry-over register"` are excluded from the board table and every Tower work section, and rendered in **November scope** (board `## November scope — outcomes` table + observations list; Tower section with requirements, dependencies, observations). | `tools/factory/project.mjs:15-18, 114, 119-129, 148-154, 211` | 40 |
| 8 Tests | 33–40 added; all 32 earlier tests kept. | `tools/factory/test/pilot.test.mjs:627-760` | — |

**Pre-existing failure fixed in test 12 (needs reviewer attention).** At the start of this run, before any edit, the suite was 31/32: test 12 threw `TypeError: Cannot read properties of null (reading 'sha256')`. The Main Lane's real outcome Status files (`MA-NOV-BOND/CARRY/EXP/HOME/OPS`) have `control: null`, and test 12 copies the real files. Item 7 takes those records out of the work table, so test 12 now compares the work table against non-scope records only (`pilot.test.mjs:271`). That one-line filter is the only change to an existing test.

## Suite

`node --test tools/factory/test` → **tests 40, pass 40, fail 0** (before commit; the code is unchanged since).

## Commit

- `37ad1c2e11711841bf50d6bbf7f3e4cbe0d46234` on `November-2026` (parent `eb64d22`). Message as the Task specifies, with the Co-Authored-By line.
- 41 paths: 5 under `tools/factory/` (README.md, dispatch.mjs, lib/state.mjs, project.mjs, test/pilot.test.mjs), the 35 pinned files, and `MA-NOV-P1.FIX3_Task_v1.md`.
  - All 35 pins were verified twice, at start and again just before `git add`, with every hash OK.
  - The staged list was diffed against the intended list and they were identical.
- `git push origin November-2026`: `eb64d22..37ad1c2`. `git ls-remote origin refs/heads/November-2026` → `37ad1c2e11711841bf50d6bbf7f3e4cbe0d46234` = local HEAD.

## Expected scope-check notes for this run's `end`

- This run was begun by FIX2 code, so `before.json` has `head` but no `refs` and no `transitions`. `run.json` will therefore record `ref_check: "unavailable"` and `transitions_check: "unavailable"`, as the Control anticipates. The reviewer checks the commit with `git show 37ad1c2`.
- The pinned files were dirty or untracked at start and were committed byte-for-byte unchanged, so they should appear under `committed_preexisting_unchanged`.

## Non-actions

- **Not written in the real repo:** any `*_Status.json`, `config.json` (committed unchanged only), `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl` or log.
- **Not run:** `project.mjs` on the real repo, `dispatch.mjs run`, or `begin` for any other packet.
- **Not used:** no model or headless launch, no subagents, no installs. No LaunchAgents, cron or listeners. No network beyond `git push`. No D1/Cloudflare, `.env*` or secrets.
- **Not touched:** `docs/`, `App/`, `13F Seed/` (`gleif-seed.js` stays untracked).
- **Not staged:** `MA-NOV-P1.FIX3_Status.json`, this report, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl`, `claude/factory/backup/`, `.claude/`, root-level November duplicates, other untracked files.
- **No forbidden git operations:** no amend, reset, rebase, force-push, branch or tag operations.
- All experiments ran in temp repos created by the test helpers.
