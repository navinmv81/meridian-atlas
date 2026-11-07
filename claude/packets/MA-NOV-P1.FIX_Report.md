# MA-NOV-P1.FIX — Interactive run mode (begin/end) + dispatcher fixes — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v2 1f2cfe26…b6f9, Task v2 fc2b7106…4f88
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (interactive Claude Code, fixed line), 2026-11-07
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (covers BUILD + FIX + DEMO) — not yet run
APPROVED BY:  Founder — Start Approval 2026-11-07T09:30Z ("approve MA-NOV-P1.FIX")
OUTCOME:      All four success conditions met. Commit a74d1b7 pushed; origin/November-2026 = HEAD.
```

## Start and preflight

- **Start:** via `LANE_OPENER.md`; its sha256 `3a5684b4…cae2` matched the fixed line.
- **Eligibility:** MA-NOV-P1.FIX was the only READY packet. Its `start_approval` (Founder, 09:30Z) matched the Status `control`/`task` hashes and the on-disk Control v2/Task v2. No report existed.
- **Session check (step 5):** this session had already run MA-NOV-P1.BUILD. Control v2 does not require a fresh or separate session; it is a build packet, not a review. So the run went ahead here, as the opener's rule allows.
- **Preflight:**
  - no `.git/*.lock`;
  - branch `November-2026`, with `HEAD` = `git ls-remote origin refs/heads/November-2026` = `2d41378`;
  - all 7 pinned hashes in Task §7 were OK at start and again immediately before staging.
- **Run mode:** this run itself used the current `LANE_OPENER.md`, with no `begin`/`end`, as the Control states.

## Diff summary (`2d41378..a74d1b7`, tools/factory)

| File | Change | SHA-256 after |
|---|---|---|
| `dispatch.mjs` | +216 / −89 | `904ea64552e1a9e6c51462ea425e10d65f12d9b9c95b07b0e27c1d52924b6670` |
| `test/pilot.test.mjs` | +138 | `c2ac78a43b24d824cdd034ba1d39d0f043db0a1b7fb21cc6e0cd2daa5fbdc79e` |
| `README.md` | +37 / −6 | `5bd1c36555a8e54919d899da11b35eba6d248e497f69c832d4f7d2c77f1b6d14` |
| `project.mjs` | +31 / −6 | `9c9c739d48a8b97ece2dd6e0949a050dc2b4a1c59fdf92e69c567b18a530468e` |
| `lib/eligibility.mjs` | +14 / −5 | `9163f782de93f52717973a4df290a0f4285a48d26d198d48a31aa6397aeec2b0` |
| `lib/tower-logic.mjs` | +7 / −1 | `4bf95a09933a7152659446a2794f4913adc6c9223341ff21260483591944a468` |
| `test/fixtures/fake-claude.mjs` | +6 | `bee2df8cf5401d41cfa3688459f6021bc614450989646e663c905b5f4fc8c243` |

**`dispatch.mjs`:**
- **New `begin <ID>` / `end <ID>`** (writer `dispatcher`):
  - `begin` uses interactive eligibility, where `run_profile` needs only `allowed_write_paths`. It takes the O_EXCL lease with `holder:"interactive"`, `mode:"interactive"`, `pid` = the calling shell's parent, and `expires` = now + `lease_ttl_s`.
  - `begin` then moves READY→EXECUTING with `run{run_id, mode, started}` and `heartbeat:null`. It saves `runs/<run_id>/before.json` (git entries with hashes, all Status revs, and this packet's own rev and hash) and prints one `BEGIN` line.
  - `end` needs the packet's interactive lease. Step 7 (scope check, outcome, Status, `run.json`, lease retirement, regenerate) is now one shared `finishRun()` used by both `run` and `end`, so both modes apply identical scope rules.
  - An expired lease gives BLOCKED "lease expired before end — Main Lane to confirm"; there is no rerun.
- **Status and check:**
  - `check` gains `running:[{id, mode, holder, run_id, started, expires, lease_state}]`.
  - `status` shows `running:interactive <run_id> holder:… expires:…` (with `(EXPIRED)` once past expiry) and no heartbeat.
- **Headless fixes:**
  - argv adds `--tools <list>` before `--allowedTools <list>`.
  - `detectSignin()` classifies `"error":"authentication_failed"` or a result "Not logged in…" as BLOCKED "worker not signed in". This sets no hold and causes no retry, and takes precedence over the quota check.
  - Checked read-only against the **real** P1.DEMO log `r-20261107T092212Z-c0da`: classified `true`.
- **`project.mjs` and `tower-logic.mjs`:**
  - The running card shows a mode pill (interactive/headless), holder, run id, start time and lease expiry.
  - An interactive run gets "no heartbeat expected" instead of a heartbeat indicator. Its lease expiry turns red with "EXPIRED" through the new `leaseClass()`.
  - "Recent runs" shows the mode.
  - "Fixed line" is renamed **"How to start a run"**, with a note that sessions call `begin`/`end` (Founder choice B).
  - The board gains a `**Running:**` line (mode, holder, run, start time, lease expiry). It sits above the section heading, so the 8-column table that `LANE_OPENER.md` parses is unchanged.

## Tests — `node --test tools/factory/test` → 22 tests, 22 pass, 0 fail

The final run before the commit was green. The full suite was also green on 6 consecutive runs after the two concurrency fixes under Deviations.

| # | Test | Result |
|---|---|---|
| 1–13, 4b, 4c | All 15 P1.BUILD tests, unchanged | ✔ |
| 16 | `begin` → EXECUTING + interactive lease + `before.json`; exact BEGIN line; second `begin` refused ("running: live interactive lease"); `begin` of another packet refused (one at a time); headless `run` refused; `check.running` lists it; `status`, board `**Running:**` line and Tower (mode pill, "no heartbeat expected", no `hb` element) show it | ✔ |
| 17 | `end` with report → REVIEW_NEEDED, `run.report_sha256` = report hash, exact END line; a Main Lane write to another packet and a `PAUSE.json` during the run are ignored; lease retired; Tower "Recent runs" shows `interactive · REVIEW_NEEDED`; second `end` refused | ✔ |
| 18 | `end` after an out-of-scope new file **and** an edited tracked file → BLOCKED "scope violation: App/evil.js, App/keep.txt" | ✔ |
| 19 | `end` without report → BLOCKED "no report (expected claude/packets/…_Report.md)" | ✔ |
| 20 | `end` after lease expiry (TTL 1 s, holder alive, so `check` does not call it interrupted) → BLOCKED "lease expired before end — Main Lane to confirm", even with a report present; `begin`/`end` refused afterwards (no rerun) | ✔ |
| 21 | Headless argv contains `--tools Read,Write` and still `--allowedTools Read,Write`; `run.mode` = headless | ✔ |
| 22 | Stub emits the two P1.DEMO lines and exits 1 → BLOCKED "worker not signed in", `exit_code` 1, **no hold**, one launch, no retry; the other packet stays eligible | ✔ |

## Temp-copy demonstration (real records, never the real repo)

**Setup:**
- Temp copy: `claude/packets` and `claude/factory` (without `backup/`) were copied to `$TMPDIR/p1fix-demo-nKwJ`, then `git init` and a commit.
- **In the temp copy only**, `MA-NOV-P1.FIX_Status.json` got `run_profile.allowed_write_paths = ["claude/packets/MA-NOV-P1.FIX_Report.md"]`. The real Status file has no `run_profile`.
- Commands used the repo's `tools/factory` with `FACTORY_ROOT` set to the temp copy.

```
$ dispatch.mjs begin MA-NOV-P1.FIX
BEGIN MA-NOV-P1.FIX run r-20261107T094117Z-2813 — work now; finish with: node tools/factory/dispatch.mjs end MA-NOV-P1.FIX
$ dispatch.mjs status
MA-NOV-P1.FIX          EXECUTING        running:interactive r-20261107T094117Z-2813 holder:interactive expires:2026-11-07T11:41:17Z hold:-
board: **Running:** MA-NOV-P1.FIX — interactive, holder interactive, run `r-20261107T094117Z-2813`, started 2026-11-07T09:41:17Z, lease expires 2026-11-07T11:41:17Z
(report written: claude/packets/MA-NOV-P1.FIX_Report.md in the temp copy)
$ dispatch.mjs end MA-NOV-P1.FIX
END MA-NOV-P1.FIX run r-20261107T094117Z-2813: REVIEW_NEEDED · report 1c565404221ae06187a96473e43b83912cc1ad063d14daa9dbd2c2d1fed08505
Status: REVIEW_NEEDED, run{mode:"interactive", report_sha256:1c565404…8505}, lease null
$ dispatch.mjs check → eligible [] running [] stale []
$ project.mjs → packets: 5 · **Running:** none (dispatcher idle)
runs/r-20261107T094117Z-2813/: before.json, lease.json, run.json
```

## Commit and push

- **Commit:** `a74d1b770c740920af504f05db6bf338bd7f6656`, "MA-NOV-P1.FIX: interactive run mode (begin/end), --tools, sign-in failure; tests 16-22", with the Co-Authored-By line. Fast-forward from `2d41378`.
- **14 paths:** 7 under `tools/factory/` (M) and 7 pinned Main Lane files (A): `MA-NOV-P1.BUILD_Report.md`, `MA-NOV-P1.DEMO_{Control,Task}_v1.md`, `MA-NOV-P1.FIX_{Control,Task}_{v1,v2}.md`.
- **Push:** `git push origin November-2026` gave `2d41378..a74d1b7`. `git ls-remote origin refs/heads/November-2026` = `a74d1b770c740920af504f05db6bf338bd7f6656` = local `HEAD`.
- **Never staged** (checked with `git diff --cached`): any `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `November_Decisions_Log.md`, `claude/factory/runs/`, `claude/factory/backup/`, `.claude/`, the root-level duplicates, and other untracked files.

## Non-actions

- **No model launched.** Every headless test used the stub, and `run`, `begin` and `end` were never run against the real repo.
- **No real runtime file written.** That covers `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, runs/logs, `LANE_OPENER.md` and `CLAUDE.md`. Their pre-existing Main Lane modifications are untouched.
- No sign-in, credentials, keychain or `~/.claude`.
- No npm, listeners, `launchctl`, D1, `wrangler` or production. Network use was git only (`ls-remote`, `push`).
- No `docs/`, `App/` or `13F Seed/`.
- No forbidden git operations.

## Deviations and notes for the reviewer

1. **Two concurrency gaps in the P1.BUILD scope check, fixed as bounded in-scope fixes.** Test 5 failed intermittently (2 of ~10 full-suite runs) once this run's longer suite was in place.
   - **(a) Temp files.** A concurrent Main Lane `writeStatus` can leave its in-flight temp file (`.MA-NOV-TB_Status.json.<pid>.<hex>.tmp`) visible to one git snapshot and not the other. The fix ignores only `^claude/(packets|factory)/\.<name>.<pid>[.<hex>].tmp$`. The regex was checked against non-matching paths such as `App/.x.1.tmp`, `claude/packets/evil.tmp` and nested folders.
   - **(b) Read order.** Status revs were read *after* the "before" git snapshot, so a Main Lane write landing between the two looked like a raw edit. Revs are now read before the "before" snapshot (and after the "after" one) in both `run` and `begin`.
   - After both fixes the suite passed 6 runs in a row. Both are documented in the README.
2. **Interpretations:**
   - `end` refuses (exit 2, nothing written) when there is no lease, when the lease is headless, or when Status/run_id do not match the lease.
   - If `before.json` is missing, `end` records BLOCKED "before.json missing — scope check impossible" rather than leaving the run EXECUTING.
   - With an expired lease, a scope violation and the expiry are both listed in `blocked_reason`, joined by "; ".
   - `begin` of a second packet is refused while any lease exists (one run at a time, as for `run`).
3. **Holder `pid` = the calling shell's parent**, read via `ps -o ppid=`, which is the interactive Claude Code process. If that process is gone **and** the lease has expired, `check` treats the run as an interrupted run (BLOCKED, no rerun). This matches the existing stale-lease rule.
4. **For the Main Lane:**
   - Interactive runs need `run_profile.allowed_write_paths` in the packet's Status; `begin` refuses without it.
   - `LANE_OPENER.md` does not call `begin`/`end` yet, so adding them is a Main Lane change.
   - The real `control-tower.html` and `STATUS_BOARD.md` were not regenerated (prohibited). The new Tower and board layout appears on the next `project.mjs` run.
5. **Still unproven:**
   - `begin`/`end` used by a real fixed-line session (the P1.DEMO re-issue);
   - `--tools` with the real binary (headless, which needs sign-in).

Stop.
