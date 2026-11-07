# LANE_OPENER v2 — standing start procedure for every Claude Code run (interactive, November)

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Any Claude Code session the Founder starts with the fixed line
REVIEWED BY:  MA-NOV-P1.REVIEW (Architect)
APPROVED BY:  Founder — "go interim" (6 Nov 21:01) and "sign-in: B" (7 Nov 09:27): runs stay interactive; the dispatcher brackets them
STATUS:       Supersedes LANE_OPENER.md (v1, sha256 3a5684b4…cae2), which stays on disk unchanged as history.
```

The Founder types one fixed line. This file tells the session what to run and how to record it.

## Procedure

1. **Place.** Work in `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. `ls .git/*.lock`: any lock → stop and report.
2. **Verify this file.** Its SHA-256 must equal the one in the fixed line. Mismatch → stop.
3. **Session check.** If this session has already run a packet, stop and say: "Open a new Claude Code session and type the fixed line again." (Every run gets a fresh session; reviews always need one.)
4. **Find approved work.** Run `node tools/factory/dispatch.mjs check`.
   - If `running` lists anything → stop: "Another run is in progress (<id>)."
   - `eligible` has exactly one packet → that is your packet. None → reply "No Founder-approved packet is waiting" and stop. More than one → list them and stop.
5. **Begin.** Run `node tools/factory/dispatch.mjs begin <ID>`. It must print `BEGIN <ID> run <run_id> …`. Any other output → stop and report it verbatim. Do nothing else before this line appears.
6. **Run.** Read the Control and Task named in `claude/packets/<ID>_Status.json`; confirm their SHA-256 values match that file. Take the role named in the Control's `EXECUTED BY`. Execute the Task under the Control exactly — its allowed/prohibited actions and stop gates govern. Write only the files the Control allows. Never edit `STATUS_BOARD.md`, any `_Status.json`, `claude/factory/` files, either LANE_OPENER file, or Main Lane records; never run `dispatch.mjs run`, `begin` for another packet, or `project.mjs`.
7. **End — always.** When the work is finished, or you stop at a gate or on an error: write the report the Control asks for (if you can), then run `node tools/factory/dispatch.mjs end <ID>`. Running `end` without a report is correct when you had to stop early — it records BLOCKED.
8. **Reply** in ≤ 5 lines: packet, outcome, report path + SHA-256, the `END …` line, stop reason. The Founder only needs to tell the Main Lane "done".

## Fixed line (the Founder keeps this)

```
Follow claude/packets/LANE_OPENER_v2.md (sha256 <hash>) and run the Founder-approved packet.
```
