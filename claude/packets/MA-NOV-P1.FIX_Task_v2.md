# MA-NOV-P1.FIX — Task v2 (supersedes Task v1 fa8e5aaf…, never run)

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.FIX_Status.json
CONTROL:      claude/packets/MA-NOV-P1.FIX_Control_v2.md
```

1. **Preflight** as in the Control; verify Control/Task hashes against `MA-NOV-P1.FIX_Status.json` and the pinned hashes in step 7.
2. **`dispatch.mjs begin <ID>`** (writer `dispatcher`):
   - eligibility as for `run`, except `run_profile` needs only `allowed_write_paths` (interactive sessions use their own tools); refuse if ineligible;
   - O_EXCL lease (`holder: "interactive"`, `pid` of the calling shell's parent if available, `expires` = now + `lease_ttl_s`);
   - Status: state READY→EXECUTING; `lease`; `run{run_id, mode:"interactive", started}`;
   - save `git status --porcelain` and the hashes of tracked/untracked files it lists to `claude/factory/runs/<run_id>/before.json`;
   - print one line: `BEGIN <ID> run <run_id> — work now; finish with: node tools/factory/dispatch.mjs end <ID>`.
3. **`dispatch.mjs end <ID>`** (writer `dispatcher`): requires a live lease for `<ID>` with `mode:"interactive"`; compares `git status --porcelain` + hashes with `before.json` using the same scope rules as `run` (`allowed_write_paths`, Main Lane Status writes with a higher `rev` ignored, `PAUSE.json` ignored); then exactly as `run` step 7: scope violation → BLOCKED (`run.blocked_reason`); report present → REVIEW_NEEDED + `run.report_sha256`; else BLOCKED "no report"; `run.ended`; lease moved to `runs/<run_id>/lease.json`. Prints one result line.
   - `end` with an **expired** lease still runs the scope check, then BLOCKED "lease expired before end — Main Lane to confirm"; never auto-rerun.
   - `check`/`status` treat a live interactive lease as **running** (no heartbeat expected; show lease expiry instead).
4. **Headless fixes (kept for later use):** add `'--tools', rp.allowed_tools.join(',')` to the `run` argv (keep `--allowedTools`); classify `"error":"authentication_failed"` / result `Not logged in…` as `run.blocked_reason = "worker not signed in"` (BLOCKED, no hold, no retry). Fake binary gains a switch emitting those two lines and exit 1.
5. **Tower/board:** running card shows mode (interactive/headless), holder, started, lease expiry; interactive runs never show a heartbeat warning; the "how to start" panel shows the fixed line plus a note that sessions call `begin`/`end`.
6. **Tests (all must pass):** existing 15, plus `16 begin→EXECUTING + lease; second begin refused`, `17 end with report → REVIEW_NEEDED + report hash`, `18 end with an out-of-scope write → BLOCKED`, `19 end without report → BLOCKED "no report"`, `20 end after lease expiry → BLOCKED, no rerun`, `21 headless argv contains --tools`, `22 sign-in failure → BLOCKED "worker not signed in"`. README documents both modes and that the Founder chose interactive (B).
7. **Commit (explicit paths):** changed files under `tools/factory/` plus these pinned Main Lane files:

| Path | SHA-256 |
|---|---|
| `claude/packets/MA-NOV-P1.BUILD_Report.md` | `d58288042af43d1dc285dac40047ec5c964cc5c7df40f81cd507e9b9f9219f15` |
| `claude/packets/MA-NOV-P1.DEMO_Control_v1.md` | `dd34368e8687f289aacf737792da1b51d4d53e4408ea57ed0cbf3a268506c41a` |
| `claude/packets/MA-NOV-P1.DEMO_Task_v1.md` | `a0838d6565fdad25d92d5b8f6dc1f781ad9b0c0b25a6a28b47acf6d8e951b453` |
| `claude/packets/MA-NOV-P1.FIX_Control_v1.md` | `16e09a9c22fe21b3dcb18da0507cb98f696ce83d88a7f9ca6752c9e4120e0869` |
| `claude/packets/MA-NOV-P1.FIX_Task_v1.md` | `fa8e5aaf233c2f1d8960bc09263141e45ad45a8ee2e1513ef513cfe5da1e3f48` |
| `claude/packets/MA-NOV-P1.FIX_Control_v2.md` | `1f2cfe2638388def54a6481608b5e56b61bfeebe80d9f58fe1f0d65885d0b6f9` |
| `claude/packets/MA-NOV-P1.FIX_Task_v2.md` | this file — verified against `MA-NOV-P1.FIX_Status.json` |

Message: `MA-NOV-P1.FIX: interactive run mode (begin/end), --tools, sign-in failure; tests 16-22` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage: any `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `claude/November_Decisions_Log.md`, `claude/factory/runs/`, `claude/factory/backup/`, `.claude/`, root-level November duplicates, other untracked files. Push `November-2026`.
8. **Report** `claude/packets/MA-NOV-P1.FIX_Report.md`: diff summary, all test names/results, a temp-copy demonstration of `begin` → (write the report) → `end` with the printed lines, commit SHA + `ls-remote`, non-actions. Stop.
