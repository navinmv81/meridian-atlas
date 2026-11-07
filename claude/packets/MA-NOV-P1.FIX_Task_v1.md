# MA-NOV-P1.FIX — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.FIX_Status.json
CONTROL:      claude/packets/MA-NOV-P1.FIX_Control_v1.md
```

1. **Preflight** as in the Control; verify Control/Task hashes against `MA-NOV-P1.FIX_Status.json` and the pinned hashes in step 6.
2. **`--tools`:** in `dispatch.mjs`, add `'--tools', rp.allowed_tools.join(',')` to the launch argv, keeping `--allowedTools`. Update test 4b's expected argv.
3. **Sign-in failure:** after the worker exits, if its `stream-json` log has an event with `"error":"authentication_failed"` or a `result` whose text starts with `Not logged in`, set `run.blocked_reason` to `worker not signed in — sign in once (see tools/factory/README.md)` (still BLOCKED, no hold, no retry). The fake binary gains an env switch that emits exactly the two lines seen in the real log (assistant message with `"error":"authentication_failed"` and `result` with `"is_error":true`, `"result":"Not logged in · Please run /login"`) and exits 1.
4. **Tests:** add `14. sign-in failure → BLOCKED "worker not signed in"`, `15. launch argv contains --tools equal to run_profile.allowed_tools`. Run the full suite; all must pass.
5. **README:** add a "Signing in headless runs" section: the desktop app's sign-in is not shared with Terminal-launched runs; the Founder signs in once (exact command in the Main Lane's instructions); the launcher never handles credentials.
6. **Commit (explicit paths):** `tools/factory/dispatch.mjs`, `tools/factory/README.md`, every changed/added file under `tools/factory/test/`, plus these pinned Main Lane files:

| Path | SHA-256 |
|---|---|
| `claude/packets/MA-NOV-P1.BUILD_Report.md` | `d58288042af43d1dc285dac40047ec5c964cc5c7df40f81cd507e9b9f9219f15` |
| `claude/packets/MA-NOV-P1.DEMO_Control_v1.md` | `dd34368e8687f289aacf737792da1b51d4d53e4408ea57ed0cbf3a268506c41a` |
| `claude/packets/MA-NOV-P1.DEMO_Task_v1.md` | `a0838d6565fdad25d92d5b8f6dc1f781ad9b0c0b25a6a28b47acf6d8e951b453` |
| `claude/packets/MA-NOV-P1.FIX_Control_v1.md` | `16e09a9c22fe21b3dcb18da0507cb98f696ce83d88a7f9ca6752c9e4120e0869` |
| `claude/packets/MA-NOV-P1.FIX_Task_v1.md` | this file — verified against `MA-NOV-P1.FIX_Status.json` |

Message: `MA-NOV-P1.FIX: dispatcher passes --tools; sign-in failure classified; tests 14-15` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage: any `*_Status.json`, `claude/factory/config.json`, `STATUS_BOARD.md`, `control-tower.html`, `claude/November_Decisions_Log.md`, `claude/factory/runs/`, `claude/factory/backup/`, `.claude/`, the root-level November duplicates, other untracked files. Push `November-2026`.
7. **Report** `claude/packets/MA-NOV-P1.FIX_Report.md`: diff summary, test results (all names), `--dry-run` argv (redact nothing secret — it contains none), commit SHA + `ls-remote`, non-actions. Stop.
