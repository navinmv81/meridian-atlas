# LANE_OPENER — standing start procedure for every Claude Code run (interim, November)

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-06
EXECUTED BY:  Any Claude Code session the Founder starts with the fixed line
REVIEWED BY:  MA-NOV-000 assessment + Architect (it is replaced by the approved dispatcher)
APPROVED BY:  Founder — interim step, 6 Nov 21:01 ("go interim")
STATUS:       Interim until the Control Tower pilot is accepted (target Wed 11 Nov). Admission, immutable hashes, board/Status ownership and review rules are unchanged.
```

The Founder no longer copies packet text. The Founder types one fixed line; this file tells the session what to run.

## Procedure

1. **Place.** Work in `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. Run `ls .git/*.lock`: any lock → stop and report. Read git only with `--no-optional-locks` unless your packet's Control allows writes.
2. **Verify this file.** Its SHA-256 must equal the one in the fixed line. Mismatch → stop.
3. **Find approved work.** In `claude/packets/STATUS_BOARD.md`, section *November 2026 — admitted packets*, list rows in state `READY`. For each, read `claude/packets/<ID>_Status.json`. A packet is **eligible** only if all hold:
   - `start_approval` exists, with `by: "Founder"`, `at`, `control_sha256`, `task_sha256`;
   - those two hashes equal `control.sha256` and `task.sha256` in the same Status file **and** the SHA-256 of the Control and Task files on disk;
   - `<ID>_Report.md` (or the report path the Control names) does **not** exist yet — if it exists, the run may already have happened: stop and report.
4. **Choose.** Exactly one eligible packet → run it. None → reply "No Founder-approved packet is waiting" and stop. More than one → list them and stop.
5. **Session check.** If the Control says a fresh or separate session is required (reviews always do) and this session has run a packet before, stop and say: "Open a new Claude Code session and type the fixed line again."
6. **Run.** Take the role named in the Control's `EXECUTED BY`. Execute the Task under the Control exactly; the Control's allowed/prohibited actions and stop gates govern. Write only the files the Control names. Never edit `STATUS_BOARD.md`, any `_Status.json`, this file, or Main Lane records — the Main Lane is their sole writer.
7. **Finish.** Write the report the Control asks for, then reply in ≤ 5 lines: packet, outcome, report path + SHA-256, stop reason. The Founder only needs to tell the Main Lane "done".

## Fixed line (the Founder keeps this)

```
Follow claude/packets/LANE_OPENER.md (sha256 <hash>) and run the Founder-approved packet.
```
