# MA-OCT-ENT-CR1.EXEC — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Mon 12 Oct 2026 · **EXECUTED BY:** LANE-1-ENG, Engineering Lead · **REVIEWED BY:** Architect (close-out note) · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-ENT-CR1.EXEC** — Run ENT-CR1 (composite index; drop 2 duplicate indexes) |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-ENT-CR1.EXEC_Task_v1.md` SHA-256 `04a849086aecccc1b4cd102f25fbf975c5c6e8ba2d2c75e7a14387dc0d990101` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-1-ENG / Claude Code |
| Usage class | heavy |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead — execution lane for ENT-CR1 (same Claude Code session as 002a). Operating rules: `Claude.md` v1.1 (Project doc) and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `45cdb9d`). Check `.git/*.lock` first. Git writes only as the Task allows.
- **First:** re-hash this file against the board row and the Task file against the hash above. **If either differs, stop.**
- Wrangler only as `/usr/local/bin/wrangler` (4.96.0); never `npx`. Never print secrets. Respect `claude/relays/FREEZES.json`.
- **Never review your own work.**

## Objective
Apply C1 (and C2/C3 if the gates allow) inside Tue 13 08:05–10:30 UTC, verify plans, and record "ENT-CR1 verified" so 007 Phase 1 and 013 are unblocked.

## Prerequisites
Founder GATE-1012 D4; Architect conditions applied; Ops OPS-R4 exception; 002a A5 deploys finished Mon 12 (no Entities deploys inside the window).

## Allowed
The CR's §6 statements and checks; the after-set reads added by the Task; the migration file and note; one commit of those files.

## Prohibited
Anything outside the CR; starting before 08:05 UTC or after 10:30 UTC; figi `/run`, gate2-refresh, gate3-exposure or any Entities deploy inside the window; any 002 work before this packet reports.

## Budget and write limits
Reads ≤ 90k (OPS-R4); write gates per the Task (≤ 25,000 before C1; reading + own writes ≤ 35,000 before each DROP).

## Write owner
**Engineering Lead (LANE-1-ENG)** — sole writer of D1 schema changes in this packet, the migration file(s), `claude/packets/MA-OCT-ENT-CR1.EXEC_Report.md` and its commit.

## Success conditions
C1 applied and E1/E2/E4 pass ("ENT-CR1 verified"); C2/C3 applied or deferred by the gates; all evidence in the report.

## Outputs and report-back
As listed in the Task. Quote this Control version (v1) and its SHA-256 at the top of the report.

## Stop point
Stop after CR step 8.
