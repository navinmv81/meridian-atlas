# Delivery factory: pilot (MA-NOV-P1.BUILD)

These are dependency-free Node scripts (built-ins only, ES modules, no network). They are the specification approved in `claude/packets/MA-NOV-000_Report.md`, with Founder choices 1b, 2b, 3a, 4, 5a and 5b.

| File | Purpose |
|---|---|
| `lib/state.mjs` | Status-JSON state library. `readStatus`, `listStatus` and `writeStatus` (compare-and-swap on `rev`, then temp file plus `rename(2)`, with field-ownership and transition checks) |
| `lib/eligibility.mjs` | `LANE_OPENER.md` step 3, plus lease, pause, hold and `run_profile` checks. Returns `{eligible, ineligible:[{id, reasons}]}` |
| `lib/lease.mjs` | O_EXCL lease files under `claude/factory/leases/` |
| `lib/tower-logic.mjs` | Pure client functions (OFFLINE, heartbeat colour), embedded verbatim in the Tower HTML |
| `project.mjs` | Generator: `claude/packets/STATUS_BOARD.md` + `claude/factory/control-tower.html` |
| `dispatch.mjs` | `check` / `status` / `run <ID> [--dry-run]` |
| `test/` | `node --test tools/factory/test` (stub binary in `test/fixtures/fake-claude.mjs`; every test uses a temp repo) |

## Day-to-day use

```
node tools/factory/project.mjs          # regenerate board + Tower after any Status write
node tools/factory/dispatch.mjs check   # who is eligible, and why not
node tools/factory/dispatch.mjs status
open claude/factory/control-tower.html  # file://, reloads every refresh_s seconds
```

- `project.mjs` will not overwrite a `STATUS_BOARD.md` whose first line is not the generated title. This guards the hand-written October board, which is archived as `STATUS_BOARD_October_2026.md`.
- Two generator runs differ only in `generated_at`.

## Ownership (MA-NOV-000 §Q6.1, Founder choice 4)

| Writer | May change |
|---|---|
| `main-lane` | any field |
| `dispatcher` | `lease`, `heartbeat`, `run`, `updated`, `updated_by`, and `state` only for READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED |
| `dispatcher-hold` | **`hold` only**. This is the documented exception (Task §5.7). When a worker log shows a usage/quota-limit error, the dispatcher records `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", reason, at}` through this separate main-lane-class write path. Nothing else can be written through it |

Any other writer, or any other field, throws `OwnershipError` and nothing is written. A `rev` mismatch throws `RevConflictError`.

The dispatcher may not write `blocker`, because that is Main Lane-owned. So when it marks a run BLOCKED, it records the reason in `run.blocked_reason`. The generator shows that reason in the board's Blocker column whenever `blocker` is empty.

## Dispatcher run (one bounded attempt, no retries)

1. Re-check eligibility, including `run_profile` (`allowed_tools`, `permission_mode`, `allowed_write_paths`). The pilot runs one worker at a time: it refuses if any other lease exists.
2. Resolve the binary: env `CLAUDE_BIN`, then `config.claude_bin`, then the newest app-bundled `claude`. The binary must be executable and `--version` must succeed.
3. Read `config.model`. **If it is null, refuse.** The dispatcher never invents or changes the model.
4. Take the lease with `openSync(…, 'wx')`. `EEXIST` means a duplicate launch, and the run is refused.
5. Write the Status: EXECUTING, plus `lease` and `run`.
6. Launch: `-p --session-id … --model … --output-format stream-json --verbose --permission-mode … --permission-prompts none --allowedTools <comma-joined> --setting-sources project`.
   - cwd = repo; the prompt goes on stdin.
   - stdout/stderr go to `claude/factory/runs/<run_id>/worker.jsonl` / `worker.err`.
   - `heartbeat` is written every 30 s from the log's mtime (`FACTORY_HEARTBEAT_MS` overrides this in tests).
7. Scope check: compare `git status --porcelain -uall` before and after, with content hashes of dirty paths. Any new or changed path outside `allowed_write_paths` sets BLOCKED.
   - Paths the dispatcher owns are excluded: its run folder, `leases/`, the packet's own Status file, and the two generated projections.
   - The packet's Status file is checked separately: if its bytes changed while `rev` did not, someone edited it outside the state library.
   - Two kinds of change made during the run are **not** treated as violations: `claude/factory/PAUSE.json` (a Founder action), and another packet's Status file whose `rev` went up (a Main Lane write through the state library).
   - A raw edit to any Status file that leaves `rev` unchanged, or a new Status file, is a violation. So in the pilot, the Main Lane should not admit new packets while a run is active.
   - If the scope check passes: exit 0 with the report present sets REVIEW_NEEDED (`run.report_sha256`). Anything else sets BLOCKED with the reason.
8. Write `runs/<run_id>/run.json`, then rename the lease to `runs/<run_id>/lease.json`. It is never deleted.

Two further rules:

- **Stale lease:** a lease that has expired and whose holder pid is gone, found by `check` or `run`, sets BLOCKED with "interrupted run — no automatic rerun". It is never relaunched.
- **`--dry-run`:** performs steps 1–3, prints the exact argv and prompt, and writes nothing (no lease, no Status change).

## Not proven by this packet (needs MA-NOV-P1.DEMO, which has its own Start Approval)

The following have only been shown against the stub:

- the real binary's behaviour with this flag set;
- how `--allowedTools` parses comma-joined patterns that contain spaces;
- whether `--setting-sources project` still finds auth;
- the exact shape of a real quota error in `stream-json`.
