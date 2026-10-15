# MA-OCT-002a — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Sun 11 Oct 2026 · **EXECUTED BY:** LANE-1-ENG, Engineering Lead · **REVIEWED BY:** Architect + ETF PL (close-out); Operations Lead; Data-Identity Lead (CR-5/CR-7) · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-002a** — 002a build: A5 gating, A4 boost bundle, A1/A2 registry + lateness, A3 sweep, A6 split |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-002a_Task_v1.md` SHA-256 `10ff165a07f37441c1d4bb9db9acb782208d1fa68cd62124cb65a9941364aa5d` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-1-ENG / Claude Code |
| Usage class | heavy (multi-day build) |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead — build lane for MA-OCT-002a. Operating rules: `Claude.md` v1.1 (Project doc) and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `16918e0`). Check `.git/*.lock` first. Git writes are allowed **only** as the Task's Git section says.
- **First:** re-hash this file against the board row and the Task file against the hash above, and the spec against `9ec6773a…3893`. **If any differs, stop.**
- **Never review your own work.** Reviews are separate packets.

## Objective
Get A5 (no anonymous writers) and A4 (outbox + pre-flight) live before 011 runs on Sat 17 Oct, then complete A1–A3 (and A6 if time), within the 002a acceptance criteria.

## Prerequisites
002 spec rev 1.3 approved (Founder, 9 Oct); 011 GO (10 Oct); Data-Identity Lead ACKs with conditions (CR-5, CR-7, C1–C6).

## Allowed
Code, local tests and Worker deploys for the 002a items; remote D1 writes within the Task's limits; git commits per the Task's Git section.

## Prohibited
Any work outside 002a; D1 writes to ETF- or Entities-domain tables; deploys in freeze windows; modifying the live boost runner before Wed 14; any 002 work on Tue 13 before ENT-CR1 is verified; printing or committing secrets.

## Budget and write limits
≤ 500 D1 writes and ≤ 50k reads for the build; **0 remote D1 writes on Sun 11**; `d1-today` checked before every remote write step, stop above 70k account writes or if unreachable.

## Write owner
**Engineering Lead (LANE-1-ENG)** — sole writer of the 002a code paths, the Worker deploys, `claude/packets/MA-OCT-002a_Report.md` and the 002a commits.

## Success conditions
AC-a1…AC-a7 met (AC-a4's production count continues after close-out); A4 and A5 live by Wed 14; evidence in the report.

## Outputs and report-back
Code + tests; Worker version IDs; `claude/packets/MA-OCT-002a_Report.md` (one section per day). Quote this Control version (v1) and its SHA-256 at the top of the report. At the end of each day reply one line: **"MA-OCT-002a day <date> reported"**.

## Stop point
End of each day's row in the Task calendar; final stop after Thu 15 close-out evidence.
