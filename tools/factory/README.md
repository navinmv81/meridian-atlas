# Delivery factory: pilot (MA-NOV-P1.BUILD, interactive mode MA-NOV-P1.FIX, review fixes MA-NOV-P1.FIX2, MA-NOV-P1.FIX3 and MA-NOV-P1.FIX4)

These are dependency-free Node scripts (built-ins only, ES modules, no network). They are the specification approved in `claude/packets/MA-NOV-000_Report.md`, with Founder choices 1b, 2b, 3a, 4, 5a and 5b.

| File | Purpose |
|---|---|
| `lib/state.mjs` | Status-JSON state library. `readStatus`, `listStatus` and `writeStatus` (compare-and-swap on `rev`, then temp file plus `rename(2)`, with field-ownership and transition checks). Every successful write appends a row to `claude/factory/transitions.jsonl` |
| `lib/eligibility.mjs` | `LANE_OPENER.md` step 3, plus lease, pause, hold and `run_profile` checks. Returns `{eligible, ineligible:[{id, reasons}]}` |
| `lib/lease.mjs` | O_EXCL lease files under `claude/factory/leases/`, plus the global run lock `leases/.global.lock` |
| `lib/tower-logic.mjs` | Pure client functions (page status LIVE / SNAPSHOT / RUNNING (snapshot) / STALE RUN, heartbeat and lease colour), embedded verbatim in the Tower HTML |
| `project.mjs` | Generator: `claude/packets/STATUS_BOARD.md` + `claude/factory/control-tower.html` |
| `dispatch.mjs` | `check` / `status` / `begin <ID>` / `end <ID>` (interactive) / `run <ID> [--dry-run]` (headless) |
| `test/` | `node --test tools/factory/test` (stub binary in `test/fixtures/fake-claude.mjs`; every test uses a temp repo). 40 tests: 1–13 (+4b, 4c), 16–22, 23–32, 33–40. Ids 14–15 are unused on purpose, so that report references to 16–22 stay valid |

## Day-to-day use

```
node tools/factory/project.mjs          # regenerate board + Tower after any Status write
node tools/factory/dispatch.mjs check   # who is eligible, and why not
node tools/factory/dispatch.mjs status
open claude/factory/control-tower.html  # file://, reloads every refresh_s seconds
```

- `project.mjs` will not overwrite a `STATUS_BOARD.md` whose first line is not the generated title. This guards the hand-written October board, which is archived as `STATUS_BOARD_October_2026.md`.
- Two generator runs differ only in `generated_at`.

## Two run modes. The Founder chose **interactive** (sign-in option B, 7 Nov 09:27)

P1.DEMO run `r-20261107T092212Z-c0da` showed that a headless worker launched from the app bundle is not signed in. It failed with `authentication_failed` and "Not logged in · Please run /login", used 0 tokens and made 0 writes. The Founder chose **not** to sign headless workers in. So:

- **Interactive (in use).** The Founder opens a Claude Code session and types the fixed line. The session brackets its own work:

  ```
  node tools/factory/dispatch.mjs begin <ID>   # → BEGIN <ID> run <run_id> — work now; finish with: node tools/factory/dispatch.mjs end <ID>
  … do the packet, write its report …
  node tools/factory/dispatch.mjs end <ID>     # → END <ID> run <run_id>: REVIEW_NEEDED · report <sha256>  |  BLOCKED — <reason>
  ```

  - **`begin`** checks eligibility as for `run`, except `run_profile` needs only `allowed_write_paths`, because the session uses its own tools.
    - It then takes the O_EXCL lease (`holder: "interactive"`, `mode: "interactive"`).
    - Its `pid` is the calling shell's parent, i.e. the Claude Code process. `expires` is now + `lease_ttl_s`.
    - It sets READY→EXECUTING with `run{run_id, mode:"interactive", started}`.
    - It saves `runs/<run_id>/before.json`: the `git status` entries with content hashes, every Status file's `rev`, and this packet's Status rev and hash.
  - **`end`** needs this packet's interactive lease. It runs the same step-7 code as `run`: scope check, then REVIEW_NEEDED (report present, `run.report_sha256`) or BLOCKED (`run.blocked_reason`). Then it writes `run.json` and renames the lease into the run folder.
    - With no report, the reason is "no report (expected …)".
    - With an **expired** lease, `end` still runs the scope check, then sets BLOCKED "lease expired before end — Main Lane to confirm". It is never rerun.
  - An interactive run has **no heartbeat**. `check`, `status`, the board and the Tower show it as running, with mode, holder, start and lease expiry.
  - If the holder process is gone **and** the lease has expired, `check` treats it like any other stale lease: BLOCKED "interrupted run — no automatic rerun".
  - `LANE_OPENER_v2.md` calls `check`, `begin` and `end` (v1 `LANE_OPENER.md` is kept as history).
- **Headless (`run`, kept for later).** Unchanged, plus the two P1.DEMO fixes:
  - argv now passes `--tools <list>` as well as `--allowedTools <list>`. `--allowedTools` only pre-approves tools, while `--tools` limits which tools exist.
  - A sign-in failure (`"error":"authentication_failed"` or result "Not logged in…") is classified as BLOCKED "worker not signed in", with no hold and no retry.

  It needs a signed-in worker before it can be used.

## Review fixes (MA-NOV-P1.FIX2, from MA-NOV-P1.REVIEW)

- **Commits (F1).** `begin` (and headless `run`) records `head` (`git rev-parse HEAD`). At the end, paths in `git diff --name-only <head>..HEAD` join the scope check under the same rules.
  - HEAD moved and `run_profile.allow_commits !== true` → BLOCKED "commits not allowed for this packet".
  - The new HEAD is not a descendant of the start commit → BLOCKED "HEAD is not a descendant of the start commit".
  - With `allow_commits`, a path that was already dirty at the start and was committed byte-for-byte unchanged (e.g. pinned Main Lane files a Task tells the run to commit) is not a violation. It is listed in `run.json` → `committed_preexisting_unchanged`. A pre-dirty file that was changed and committed is a violation.
  - A `before.json` without `head` (written by pre-FIX2 code) records `commit_check: "unavailable …"` in `run.json`.
- **One run at a time (F2).** `begin` and `run` take `claude/factory/leases/.global.lock` with O_EXCL **before** the per-packet lease. The lease-directory read remains a second check. The lock is renamed into the run folder (`global.lock.json`, or `global.lock.unused.json` if the start failed) at `end`, at run completion and by stale handling. An orphan lock (expired, holder gone, no lease of its run) is retired by `check`.
- **Tower (F3, Founder option b — no scheduler).** Nothing regenerates the page on a timer. The status pill reads **LIVE** (snapshot younger than 2 × `refresh_s`), **SNAPSHOT** ("Idle — snapshot from <time> (<n> min ago); regenerated on every begin/end and Main Lane update"), **RUNNING (snapshot)** (older snapshot with an unexpired lease) or **STALE RUN** (a lease past its expiry, red). There is no OFFLINE state.
- **Fixed line (F4).** `config.json` may name `opener`; absent or null → `claude/packets/LANE_OPENER_v2.md`. The Tower shows that file's fixed line with its computed SHA-256.
- **Session ids (F5, F9).** `begin` records `session_id` from `CLAUDE_CODE_SESSION_ID` (null if absent) in the lease, `run` and `before.json`. `end` records `ended_by_session`. If both ids are known and differ, `end` refuses (exit 2, nothing written): "this run was begun by another session".
- **Own Status (F6).** In interactive mode the dispatcher writes nothing between `begin` and `end`, so any `rev` change on the running packet's own Status → BLOCKED "own Status changed during run (rev x→y)". Rev bumps on other packets are allowed and listed in `run.json` → `other_status_changes` for Main Lane confirmation. Writer identity in `writeStatus` remains self-declared (honour system); the scope check is the guard.
- **Temp files (F7).** Only `.<file>.<pid>[.<hex>].tmp` whose `<file>` is an existing `*_Status.json` or `STATUS_BOARD.md` (in `claude/packets/`) or `control-tower.html` (in `claude/factory/`) is ignored. Ignored paths are listed in `run.json` → `ignored_temp_files`.
- **History (F10).** `claude/factory/transitions.jsonl` gets `{at, id, writer, from, to, rev}` for every successful `writeStatus`. It is append-only, created if missing, and ignored by the scope check like `PAUSE.json`. Refused writes throw and are not logged.
- **Limits (F8, unchanged).** Gitignored paths, writes outside the repo, and reads are invisible to the scope check.

## Review fixes (MA-NOV-P1.FIX3, from MA-NOV-P1.REVIEW2 G1–G5, NML-1108-1/2)

- **Every commit (G1).** Committed paths are the union of `git diff --name-only <head>..HEAD` and `git log --format= --name-only <head>..HEAD`, so a file added in one commit and removed in a later one is still checked. If HEAD is not a descendant of the start commit, only the net diff is used (the run is BLOCKED anyway).
- **All refs (G2).** `begin` and headless `run` save `git for-each-ref` as `before.json` → `refs`. At the end, any ref other than the current branch that changed, appeared or disappeared → BLOCKED "ref changed: <ref>". `refs/remotes/origin/<current branch>` may move only with `allow_commits` (a push). `run.json` → `ref_check`: `checked` / `refs changed` / `unavailable` (a `before.json` without `refs`, written by older code — not BLOCKED).
- **Unparsable global lock (G3).** Retired by `check` only once its mtime is more than 60 s old (it may be mid-write).
- **Session (G4).** If the lease has a `session_id` and `end` is called without one → refused (exit 2, nothing written): "end needs the session that began the run".
- **Transitions log (G5).** `before.json` → `transitions{size, sha256}`. At the end the first `size` bytes must hash the same, else BLOCKED "transitions log rewritten". `run.json` → `transitions_check`: `append-only` / `rewritten` / `unavailable`.
- **Closure path (NML-1108-1).** `CHANGES_REQUESTED → APPROVED` is allowed for writer `main-lane` only, and only when that same write sets `closure_by` to the id of a packet whose Status is `CLOSED` (the follow-up whose review covered the requested changes). Otherwise `TransitionError`, nothing written. `CHANGES_REQUESTED → READY` is unchanged.
- **Outcomes view (NML-1108-2).** Status records with `kind: "outcome"` or `kind: "carry-over register"` are sprint scope, not work: they are left out of the board table and every Tower work section, and shown in a separate **November scope** section (board: `## November scope — outcomes`) with `requirements`, `dependencies` and `observations`.

## MA-NOV-P1.FIX4 (REVIEW3 H1/H2, NML-1110-1)

- **Start branch (H1).** `begin` and headless `run` record `start_branch` (`git symbolic-ref --short HEAD`, or `DETACHED`) in `before.json`. At the end, a different branch → BLOCKED "branch changed: <start> → <end>", and the ref check skips only `refs/heads/<start_branch>` (plus `refs/remotes/origin/<start_branch>` with `allow_commits`) — never the branch HEAD happens to be on at the end. `run.json` → `branch_check`: `checked` / `branch changed` / `unavailable` (no `start_branch` in `before.json`: older code, not BLOCKED; the old current-branch skip then applies).
- **`closure_by` id (H2).** Must match `/^MA-[A-Z0-9][A-Z0-9.-]*$/` and name a CLOSED packet; a path such as `../packets/MA-NOV-X` is refused.
- **Record kinds.** `kind` `outcome`, `carry-over register`, `founder-request`, `plan` (`RECORD_KINDS` in `lib/eligibility.mjs`) are never eligible and never in work columns. `founder-request` (`request_type`, `question`, `options[]`, `reply`, `due`, `status` open|answered|withdrawn, `answer`, `answered_at`): open → Tower *Waiting for you* and board *Waiting for the Founder*; answered/withdrawn → *Recent decisions*. `plan` (`milestones[{when,title,detail,status}]`, `handoffs[{step,today,how,target}]`) drives *Path* and *Handoffs*.
- **Tower layout** follows `claude/factory/design/interim-tower-reference.html` (system fonts, no network). *Recent decisions* also lists state changes from `transitions.jsonl`.

## Ownership (MA-NOV-000 §Q6.1, Founder choice 4)

| Writer | May change |
|---|---|
| `main-lane` | any field (CHANGES_REQUESTED→APPROVED only with `closure_by`, see FIX3) |
| `dispatcher` | `lease`, `heartbeat`, `run`, `updated`, `updated_by`, and `state` only for READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED |
| `dispatcher-hold` | **`hold` only**. This is the documented exception (Task §5.7). When a worker log shows a usage/quota-limit error, the dispatcher records `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", reason, at}` through this separate main-lane-class write path. Nothing else can be written through it |

Any other writer, or any other field, throws `OwnershipError` and nothing is written. A `rev` mismatch throws `RevConflictError`.

The dispatcher may not write `blocker`, because that is Main Lane-owned. So when it marks a run BLOCKED, it records the reason in `run.blocked_reason`. The generator shows that reason in the board's Blocker column whenever `blocker` is empty.

## Headless dispatcher run (one bounded attempt, no retries)

1. Re-check eligibility, including `run_profile` (`allowed_tools`, `permission_mode`, `allowed_write_paths`). The pilot runs one worker at a time: it refuses if any other lease exists.
2. Resolve the binary: env `CLAUDE_BIN`, then `config.claude_bin`, then the newest app-bundled `claude`. The binary must be executable and `--version` must succeed.
3. Read `config.model`. **If it is null, refuse.** The dispatcher never invents or changes the model.
4. Take the lease with `openSync(…, 'wx')`. `EEXIST` means a duplicate launch, and the run is refused.
5. Write the Status: EXECUTING, plus `lease` and `run`.
6. Launch: `-p --session-id … --model … --output-format stream-json --verbose --permission-mode … --permission-prompts none --tools <comma-joined> --allowedTools <comma-joined> --setting-sources project`.
   - cwd = repo; the prompt goes on stdin.
   - stdout/stderr go to `claude/factory/runs/<run_id>/worker.jsonl` / `worker.err`.
   - `heartbeat` is written every 30 s from the log's mtime (`FACTORY_HEARTBEAT_MS` overrides this in tests).
7. Scope check: compare `git status --porcelain -uall` before and after, with content hashes of dirty paths. Any new or changed path outside `allowed_write_paths` sets BLOCKED.
   - Paths the dispatcher owns are excluded: its run folder, `leases/`, the packet's own Status file, and the two generated projections.
   - The packet's Status file is checked separately: if its bytes changed while `rev` did not, someone edited it outside the state library.
   - Two kinds of change made during the run are **not** treated as violations: `claude/factory/PAUSE.json` (a Founder action), and another packet's Status file whose `rev` went up (a Main Lane write through the state library).
   - In-flight atomic-write temp files of the state library and the generator (`.<file>.<pid>[.<hex>].tmp` directly in `claude/packets/` or `claude/factory/`) are ignored. A concurrent Main Lane write can be caught mid-rename by one of the two snapshots. Revs are read *before* the "before" git snapshot and *after* the "after" one, so a write landing in between still counts as a rev bump.
   - A raw edit to any Status file that leaves `rev` unchanged, or a new Status file, is a violation. So in the pilot, the Main Lane should not admit new packets while a run is active.
   - If the scope check passes: exit 0 with the report present sets REVIEW_NEEDED (`run.report_sha256`). Anything else sets BLOCKED with the reason.
8. Write `runs/<run_id>/run.json`, then rename the lease to `runs/<run_id>/lease.json`. It is never deleted.

Two further rules:

- **Stale lease:** a lease that has expired and whose holder pid is gone, found by `check` or `run`, sets BLOCKED with "interrupted run — no automatic rerun". It is never relaunched.
- **`--dry-run`:** performs steps 1–3, prints the exact argv and prompt, and writes nothing (no lease, no Status change).

## Not proven yet

The following have only been shown against the stub:

- interactive `begin`/`end` run by a real fixed-line session (P1.DEMO re-issue, Control v2);
- the real binary with `--tools` (headless);
- how `--allowedTools` parses comma-joined patterns that contain spaces;
- whether `--setting-sources project` still finds auth;
- the exact shape of a real quota error in `stream-json`.
