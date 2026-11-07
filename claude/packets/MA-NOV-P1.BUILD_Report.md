# MA-NOV-P1.BUILD — Delivery-factory pilot build — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 c049828b…f7aa, Task v1 30ebc6d2…2f40
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (local Claude Code, desktop app, started with the fixed line), 2026-11-07
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (separate session, after MA-NOV-P1.DEMO) — not yet run
APPROVED BY:  Founder — Start Approval 2026-11-07T08:56Z ("approve MA-NOV-P1.BUILD")
OUTCOME:      All five success conditions met. Commit 2d41378 pushed; origin/November-2026 = HEAD.
```

## Start and preflight (Task §1)

**Start:** via `LANE_OPENER.md`. Its sha256 `3a5684b4…cae2` matched the fixed line. This session had run no packet before.

**Eligibility:** MA-NOV-P1.BUILD was the only `READY` row in the November section. Its approval hashes, its Status `control`/`task` hashes and the on-disk Control/Task hashes all matched, and no report existed.

**Preflight:**

| Check | Result |
|---|---|
| `pwd` | LOCAL_MASTER |
| `ls .git/*.lock` | no matches |
| Branch | `November-2026` |
| `HEAD` vs `git ls-remote origin refs/heads/November-2026` | both `a01ffe2d…b672` |
| Spec `MA-NOV-000_Report.md` | `8b04f45b…4519` ✓ |
| §8 pinned hashes (25, plus the Task) | all OK at start, and again immediately before staging |

## Files created (path · lines · sha256)

| Path | Lines | SHA-256 |
|---|---|---|
| `tools/factory/lib/util.mjs` | 54 | `a28e34ef37f8f00f8cdfd6ae968941d374b2f95324804ddb90d8736200e65d0d` |
| `tools/factory/lib/state.mjs` | 113 | `7481a3daa2096f11fed8f6e5380747e2d05d16c819f0faac5ee8f5c619dcd9b9` |
| `tools/factory/lib/eligibility.mjs` | 96 | `b1faa45be24a451c2f545eb0da32322c903d8479b9be78e3afda458d73b2d17c` |
| `tools/factory/lib/lease.mjs` | 54 | `24e552d1891ff2fcea3ee7c82f7cf0fe4a5bef8f76ec9144f9fb7054e218b78e` |
| `tools/factory/lib/tower-logic.mjs` | 25 | `dee000ed183a45b169dc1def77ff463e208208baeb7ce3f9c648a964cf715bc3` |
| `tools/factory/project.mjs` (755) | 238 | `425d4a52914ddfc5220d064a687634874c3b8355fb80cb554f4d8c15c4a00ca7` |
| `tools/factory/dispatch.mjs` (755) | 321 | `c292cff6483a2172bb8d2dd03523f85a4f91db45b09aa6a6105109b8bc1e785c` |
| `tools/factory/README.md` | 70 | `3db97f58075d8751bd145cf595b8e1dfd0b7949403ccadc5081659633d944f90` |
| `tools/factory/test/pilot.test.mjs` | 289 | `c2656ef8569c3264f535bd8de7f4a253f913748095853542c1567e14ebf042cb` |
| `tools/factory/test/helpers.mjs` | 98 | `6acc79e272ae237c7f8f83c827bde94319f787bd2e04d77f87c37c532f1c58b0` |
| `tools/factory/test/package.json` | 4 | `c30dc52da53199966aa5384a12d213504974bb2fc5e6afde1de152729e370d34` |
| `tools/factory/test/fixtures/fake-claude.mjs` (755) | 35 | `6d70a79df9b6f93dd1905b3df6c501b39a1f60d1e74b473e66387123401af9a4` |
| `claude/factory/config.json` | 1 | `191d43a0d199666d81c5c76d0330b2e718e702eed7439df894c47acf9a873ce0` |
| `claude/factory/control-tower.html` (generated) | 78 | `ee7e9cea79720b78f9a160d6aeda7324369b9c77d28b5703ce4d8c2bfb958631` |
| `claude/factory/leases/.gitkeep`, `claude/factory/runs/.gitkeep` | 0 | `e3b0c442…b855` (empty) |
| `claude/packets/STATUS_BOARD.md` (generated) | 15 | `b7dea44a54b6537727e9fe8103a9e9dd4c4fd5d21692fff3053448838c6c5e0f` |
| `claude/packets/STATUS_BOARD_October_2026.md` (`git mv`, content unchanged) | — | `fefe33de23339eaadf7560bd5f3357dc8d66c9e94f381afd0b67eb4ca8983e78` (= §7 pin) |

These were not committed: `claude/factory/backup/settings.local.json.pre-P1` (`5269f1c3…0158`) and this report.

## Tests — `node --test tools/factory/test` → 15 tests, 15 pass, 0 fail (~6.1 s)

The last run was against the committed code. The suite was also run 4 times in a row before the commit, all green.

| # | Test | Result |
|---|---|---|
| 1 | Invalid transition READY→CLOSED refused (`TransitionError`, file unchanged); READY→EXECUTING accepted | ✔ |
| 2 | Duplicate launch: the second `wx` lease throws `LeaseError`; two racing `dispatch run` processes give exit codes {0, 2} and exactly one stub launch | ✔ |
| 3 | Stale approval (Task edited after approval): ineligible "Task on disk differs from approval", run refused, 0 launches | ✔ |
| 4 | Scope violation (stub writes `App/evil.js`) → BLOCKED, reason on the board, lease moved to `runs/<id>/lease.json` | ✔ |
| 4b | *(extra)* Clean run → REVIEW_NEEDED + `report_sha256`; exact argv (`-p`, `--model`, `--permission-prompts none`, `--setting-sources project`, …) and prompt text verified; no rerun once the report exists | ✔ |
| 4c | *(extra)* A worker raw-editing another packet's Status (rev unchanged) → scope violation | ✔ |
| 5 | Global pause written mid-run: the active run finishes REVIEW_NEEDED; the next launch is refused "global pause"; a Main Lane write mid-run is not flagged | ✔ |
| 6 | Interrupted worker (dispatcher + worker SIGKILLed, lease TTL 1 s): `check` → BLOCKED "interrupted run — no automatic rerun", lease retired, a rerun is refused, 1 launch total | ✔ |
| 7 | Quota error in the worker log → BLOCKED + `hold{CAPACITY_HOLD, set_by:"dispatcher"}`; the other packet's launch is refused; Tower shows CAPACITY_HOLD. A manual Founder hold shows "manual entry, not telemetry" | ✔ |
| 8 | Crash (SIGKILL) between temp write and rename: original byte-identical, temp file ignored, next write succeeds (rev 2), generator idempotent | ✔ |
| 9 | Tower HTML logic, extracted from `<script id="tower-logic">`: a 10-minute-old `generated_at` → OFFLINE; +30 s live, +61 s OFFLINE; heartbeat ok/amber/red; idle shown as idle | ✔ |
| 10 | Ownership: dispatcher writing `start_approval`, `blocker` or READY→BLOCKED throws `OwnershipError`; `dispatcher-hold` writing `state` throws; an unknown writer throws; a rev mismatch throws `RevConflictError` | ✔ |
| 11 | `model: null` → refused "Founder has not recorded the model (choice 2b)"; no lease, Status unchanged, 0 launches | ✔ |
| 12 | Board (with the **real** November Status files copied read-only into a temp repo) parses with an independent LANE_OPENER step-3 parser: same 8 columns, no packet lost, every Control hash preserved, READY set equal | ✔ |
| 13 | Idempotent: two runs differ in exactly one board line (`generated_at`); HTML equal after stripping `generated_at`; refuses to overwrite a hand-written board | ✔ |

## `project.mjs` on the real files

- `node tools/factory/project.mjs` → 3 packets (MA-NOV-000, MA-NOV-BOOT, MA-NOV-P1.BUILD). This is the same 3 rows the hand-written November section had, and none were lost.
- Control hashes preserved: `9afaea82…c1e0`, `b6fd8d27…c146`, `c049828b…f7aa`.
- A second run 1 s later gave a board diff of exactly one line (`generated_at`). The Tower diff was the two `generated_at` stamps plus the "Generated …" header line, and nothing else.
- No model call, no network.
- The Tower was checked visually in the app's browser pane (`file://`). It shows the live/age badge, the "dispatcher idle (no lease)" status, MA-NOV-P1.BUILD under Ready, and the fixed line with the real LANE_OPENER hash substituted.

## `dispatch.mjs check` on the real files

**Before this report existed:** `eligible: ["MA-NOV-P1.BUILD"]`, with the warning "no run_profile — dispatch run would refuse". MA-NOV-000 and MA-NOV-BOOT were ineligible (state CLOSED; report exists). Exit 0, no stale leases, nothing written.

**After this report was written** (success condition 3 met: no eligible packet):

```
eligible: []   (exit 0; stale_handled []; pause None; capacity_hold None)
MA-NOV-000: state CLOSED; report exists: claude/packets/MA-NOV-000_Report.md
MA-NOV-BOOT: state CLOSED; no Founder start approval; report exists: claude/packets/MA-NOV-BOOT_Report.md
MA-NOV-P1.BUILD: report exists: claude/packets/MA-NOV-P1.BUILD_Report.md
warnings: MA-NOV-P1.BUILD — no run_profile — dispatch run would refuse
```

## Settings (Founder choice 5b)

- Backup: `.claude/settings.local.json` → `claude/factory/backup/settings.local.json.pre-P1` (`cmp` identical; not staged).
- Removed exactly `Bash(npx wrangler d1 execute meridian-etf --remote:*)`, `Bash(npx wrangler deploy:*)` and `Bash(npx wrangler secret put:*)`. **Allow entries went from 3 to 0.** The file is now `{"permissions":{"allow":[]}}` (`ee6d1034…fcbb`), and no other keys existed.
- No other Claude Code setting and no model setting were changed.

## Proposed model for choice 2b (not written)

- `ps -o command= -p $PPID` shows this session's hosting process was started with **`--model=claude-opus-5-5`**. Only that value was extracted.
- **Proposed:** `config.model = "claude-opus-5-5"`.
- `claude/factory/config.json` keeps `"model": null` until the Founder confirms and the Main Lane records it. Until then, `dispatch run` refuses.

## Commit and push

**Commit:** `2d41378d2517bda5c725f630cde5016306f4e5f4`, "MA-NOV-P1.BUILD: factory state lib, Tower/board generator, dispatcher, tests; October board archived; pending governance records", with the Co-Authored-By line. It changes **43 paths**, a fast-forward from `a01ffe2`.

The 43 paths break down as:
- the 25 pinned files plus the Task (26), with the pinned `STATUS_BOARD.md` content now living at `STATUS_BOARD_October_2026.md`;
- 12 files under `tools/factory/`;
- 4 under `claude/factory/`;
- the generated `STATUS_BOARD.md`.

`git push origin November-2026` gave `a01ffe2..2d41378`. `git ls-remote origin refs/heads/November-2026` = `2d41378d2517bda5c725f630cde5016306f4e5f4` = local `HEAD`.

**Never staged** (checked with `git diff --cached`, none present):
- `.claude/settings.local.json`
- `claude/factory/backup/`
- `MA-NOV-P1.BUILD_Status.json`
- this report
- the root-level November duplicates
- `13F Seed/gleif-seed.js`, `Claude outputs/` and the other untracked files

## Non-actions

- **No model or agent launched.** Every dispatcher test used the stub, and `dispatch run` was never invoked on the real repo.
- No D1, `wrangler`, Cloudflare or GitHub API, and no production URL. Network use was git only (`fetch`, `ls-remote`, `push`).
- No npm or third-party packages, no listener, no `launchctl`, no crontab.
- No `*_Status.json`, `LANE_OPENER.md`, `November_Decisions_Log.md`, `CLAUDE.md`, October record, `docs/`, `App/` or `13F Seed/` was edited. The October/November governance files were only staged as pinned.
- No `.env*` or secrets read.
- No forbidden git operations: no `add -A`, `reset`, `stash`, `rebase`, `pull`, `--force`, `--amend`, or branch create/delete.

## Deviations and notes for the reviewer

1. **Rename shows as A + M, not R.**
   - `git diff --cached --name-status` shows `A STATUS_BOARD_October_2026.md` + `M STATUS_BOARD.md`, not `R`. This is because the old path is immediately re-used by the generated board. With `-B -M`, git reports `M099 STATUS_BOARD.md` and `C094 STATUS_BOARD.md → STATUS_BOARD_October_2026.md`.
   - The October content is byte-identical to the pin.
2. **Dispatcher BLOCKED reasons go in `run.blocked_reason`, not `blocker`.**
   - Task §5.7 says "BLOCKED (`blocker`: …)", but §2 / Founder choice 4 forbid the dispatcher from writing `blocker`. I kept the ownership rule.
   - The generator shows `run.blocked_reason` in the board's Blocker column whenever `blocker` is empty. This is documented in the README.
3. **Interpretations beyond the Task text** (all documented in the README):
   - (a) `--dry-run` performs steps 1–3 and prints the argv and prompt, with **no** lease and no Status write.
   - (b) The pilot dispatcher refuses if any other packet holds a lease (one worker at a time).
   - (c) `project.mjs` refuses to overwrite a `STATUS_BOARD.md` that is not generated.
   - (d) The scope check ignores `claude/factory/PAUSE.json` and other packets' Status files whose `rev` increased (Main Lane writes during a run), but flags raw edits with an unchanged `rev`.
4. **Bounded fix during testing.** Test 5 was flaky on its 2nd run: a `PAUSE.json` written mid-run was being flagged as a worker scope violation. That was a real design gap (item 3d), not a test bug. It was fixed in `dispatch.mjs`, covered by tests 4c and 5, and the suite was then green 4 runs in a row.
5. **`tools/factory/test/package.json`** (`"main": "pilot.test.mjs"`) was added. On Node v24.14.1, `node --test tools/factory/test` does not expand a directory argument; without this file the required command fails with "Cannot find module".
6. **`git fetch origin November-2026`** was run once at preflight, which updates `FETCH_HEAD`. `ls-remote` was also used, as the Task specifies.
7. **Encoding of rewritten Status files.** Status files rewritten by `writeStatus` are serialised by JavaScript, so `—` is written as a literal UTF-8 character rather than the `—` escape Python writes. The JSON is equivalent, but the bytes, and so the hash, change on first write.
8. **Committed board and Tower predate this report.** The committed `control-tower.html` and board were generated before this report existed, so the Tower shows MA-NOV-P1.BUILD as "eligible". The next `project.mjs` run (after the Main Lane's Status update) corrects it. I did not regenerate, so the working tree matches the commit.
9. **Test temp directories** (`$TMPDIR/factory-test-*`) are left for inspection. They are outside the repo.
10. **Still unproven until MA-NOV-P1.DEMO:**
    - the real binary with this flag set;
    - how `--allowedTools` handles comma-joined patterns with spaces;
    - whether `--setting-sources project` finds auth;
    - the real `stream-json` quota-error shape;
    - `run_profile` is absent from all real Status files today, so the Main Lane must add it for any packet the dispatcher should run.

Stop.
