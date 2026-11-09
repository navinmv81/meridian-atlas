# MA-NOV-P1.FIX2 — Review must-fix — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 a261f67e…5d5c, Task v1 f16f2fbd…a992
EXECUTED BY:  Engineering Lead — interactive Claude Code (LANE_OPENER_v2), run r-20261107T202556Z-a368, 2026-11-07
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW2 (fresh session, not yet run)
APPROVED BY:  Founder — Start Approval 2026-11-07T20:23Z ("F3 b; D1 code; approve MA-NOV-P1.FIX2")
```

## Outcome

All Task items (1–15) are done. The suite passes: **tests 32, pass 32, fail 0**. The v1.2 draft is aligned (revision 2, still DRAFT). One commit with exactly the Task's 20 paths was pushed.

- **Commit:** `eb64d22c50865024219c8170f9587531fdbc38af` on `November-2026`, parent `a74d1b7`.
- **`git ls-remote origin refs/heads/November-2026`:** `eb64d22c50865024219c8170f9587531fdbc38af`.
- **Executing session id:** `61fceddb-61bc-440a-b883-f848b302dd24`. This run was begun by the pre-FIX2 `begin`, so its lease and `before.json` hold no `session_id` and no `head` (see "This run's own `end`").

## Per finding

Line numbers are as committed in `eb64d22`.

| ID | Change | Where | Test |
|---|---|---|---|
| F1 | `begin` records `head` in `before.json`; headless `run` records it before launch. At the end, `commitCheck` adds `git diff --name-only <head>..HEAD` to the scope check. It BLOCKs "commits not allowed for this packet" when HEAD moved without `run_profile.allow_commits === true`, and "HEAD is not a descendant of the start commit" when `merge-base --is-ancestor` fails. With `allow_commits`, a path that was dirty at the start and was committed byte-for-byte unchanged (HEAD blob hash = start hash) is accepted and listed in `run.json` → `committed_preexisting_unchanged`. A changed pre-dirty file stays a violation. This is how the Task's pinned Main Lane files can be committed. | `dispatch.mjs:149` (`commitCheck`), `:163` (`headBlobHash`), `:97` (`scopeViolations`), `:466` (begin `head`), `:397` (run `startHead`) | 23, 24, 25 |
| F2 | `begin` and `run` take `leases/.global.lock` with O_EXCL before the per-packet lease. The lease-directory read stays as a second check. The lock is renamed into the run folder at `end`/run completion (`global.lock.json`), on a failed start (`global.lock.unused.json`), and by stale handling. An orphan lock (expired, holder gone, no lease of its run) is retired by `check`. | `lib/lease.mjs:67`, `:85`; `dispatch.mjs:275` (`takeGlobalLock`), `:279`, `:201`, `:209`, `:350` | 26 (15/15 trials: exactly one winner; release + next begin) |
| F3 (b) | `towerState`/OFFLINE replaced by `towerStatus` with four states: **LIVE**, **SNAPSHOT** ("Idle — snapshot from <time> (<n> min ago); regenerated on every begin/end and Main Lane update"), **RUNNING (snapshot)** and **STALE RUN** (red, checked first). There is no scheduler, and "OFFLINE" no longer appears. Test 9 keeps its id; its assertions now expect SNAPSHOT instead of OFFLINE. | `lib/tower-logic.mjs:11`, `:52`; `project.mjs:202` | 9, 32 |
| F4 | `config.opener` (default `claude/packets/LANE_OPENER_v2.md` when absent or null). The Tower shows that file's fixed line, its path and its computed SHA-256. The real `config.json` is untouched; the default yields the v2 line. | `lib/util.mjs:44`; `project.mjs:29` | 27 (uses a copy of the real v2 opener) |
| F5 + F9 | `begin` records `session_id` (`CLAUDE_CODE_SESSION_ID`, null if absent) in the lease, `run` and `before.json`; headless leases record the worker session. `end` records `ended_by_session`. If both ids are known and differ, it refuses (exit 2, nothing written): "this run was begun by another session". | `dispatch.mjs:286`, `:488` | 28 |
| F6 | Interactive `end`: any rev change on the running packet's own Status → BLOCKED "own Status changed during run (rev x→y)". The existing same-rev raw-edit check is kept. Other packets' rev changes go to `run.json` → `other_status_changes`. README and draft §3.8 document that writer identity is self-declared. | `dispatch.mjs:323`, `:345` | 29 |
| F7 | A temp file is ignored only if its base is an existing `*_Status.json` or `STATUS_BOARD.md` (in `claude/packets/`) or `control-tower.html` (in `claude/factory/`). Ignored paths go to `run.json` → `ignored_temp_files`. | `dispatch.mjs:136` | 30 |
| F10 | Each successful `writeStatus` appends `{at, id, writer, from, to, rev}` to `claude/factory/transitions.jsonl`. It is append-only and created if missing. A refused write throws before the append; a failed append warns and does not throw. The file is ignored by the scope check like `PAUSE.json`. | `lib/state.mjs:105`, `:111`; `dispatch.mjs:130` | 31 |
| Tests | The 22 existing tests are kept, and 23–32 are added. The 14–15 gap is documented (header of `test/pilot.test.mjs` and README): renumbering would break the 16–22 references in the FIX and REVIEW reports. `helpers.mjs` pins `CLAUDE_CODE_SESSION_ID=test-session-1` so host sessions do not leak in, and adds a v2 opener fixture and `gitIn`. | `test/pilot.test.mjs`, `test/helpers.mjs` | — |
| D1 | §4 now reproduces `state.mjs` exactly, including the four "not allowed" cases from the review and the held-state exit (`resume_state` else READY). It states: "`dispatcher-hold` writes only `hold`; the dispatcher sets BLOCKED first". Open question 1 is marked resolved. | `claude/governance/Claude_md_v1.2_amendments.md` §4 | — |
| D2 | §3.4: the Main Lane copies the verdict into `review{}`; the dispatcher does not. | draft §3.4 | — |
| D3 | Patch, line 28: "`October-2026` `/docs` is the live Pages source (since 2026-10-31)". | draft patch table | — |
| D4 | Patch, line 27: "VERIFIED <date> (<packet that applies the patch>)", with a note that no check has been made yet. | draft patch table | — |
| D5 | §7.1: a review is a `begin`/`end` run and holds the execution slot (current behaviour). | draft §7.1 | — |
| D6 | §3.1 no longer claims all transitions for the Main Lane. §3.6 says refused writes throw, write nothing and are not logged, while successful writes are logged to `transitions.jsonl`. | draft §3.1, §3.6 | — |
| Rev 2 | A "Revision 2" note listing D1–D6 is at the top; `STATUS: DRAFT` is kept. | draft header | — |

`tools/factory/README.md` gained a "Review fixes (MA-NOV-P1.FIX2)" section, and its stale "Interim: LANE_OPENER.md does not call begin/end" line was corrected.

## Suite

`node --test tools/factory/test` → **tests 32, pass 32, fail 0** (~13 s). Every test ran in a temp repo. Afterwards `git status` showed no test artefacts in the real repo, and there was no `transitions.jsonl` or extra lease.

## This run's own `end`

`end` executes the code on disk, which is now the FIX2 code, but this run was begun by pre-FIX2 code:
- `before.json` has no `head`, so `run.json` will record `commit_check: "unavailable — no start HEAD recorded …"`. **The reviewer should check the commit with `git show --stat eb64d22`** (as the Control anticipates). It contains exactly the Task's 20 paths: 9 under `tools/factory/`, the draft, and the 10 pinned files, whose hashes matched the Task table before staging.
- The lease has no `session_id`, so the session-mismatch check cannot apply.
- There is no global lock to release.
- The 10 pinned files were untracked at `begin` and are now committed unchanged. They are accepted through the F1 "committed unchanged" rule (`allow_commits: true`).
- `end`'s own Status writes will create `claude/factory/transitions.jsonl` in the real repo. That is the dispatcher's F10 behaviour; this session did not write the file.

## Non-actions

- Not written or staged: any `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl`, `claude/factory/runs/`, `claude/factory/backup/`, `claude/November_Decisions_Log.md`, `.claude/`, LANE_OPENER files (committed unchanged only), `CLAUDE.md`, root-level November duplicates, `13F Seed/gleif-seed.js`.
- Not done: `dispatch.mjs run` or `project.mjs` against the real repo; any model or headless launch; any subagent; any LaunchAgent, cron or listener; any D1 or Cloudflare access; reading `.env*`; any install.
- Git: only `--no-optional-locks` reads, `git add -- <explicit paths>`, one `git commit` and one `git push origin November-2026`.
- Not addressed (outside this Task): F8, which stays a documented limit, and the F11 tidy-ups, which belong to the Main Lane.
