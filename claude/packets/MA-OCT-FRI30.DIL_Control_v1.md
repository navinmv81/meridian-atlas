# MA-OCT-FRI30.DIL — Control v1 (immutable)

**ISSUED BY:** Main Lane, Fri 30 Oct 2026 07:00Z · **EXECUTED BY:** Data-Identity Lead (LANE-11) · **APPROVED BY:** Founder (Option C, ML-1025-5; A2 option A, ML-1029-6; WIP 5 Fri 30)

| | |
|---|---|
| Packet | **MA-OCT-FRI30.DIL** — AC12 re-adjudication + A2 G-2 sample (150) + L-A2-1 |
| Control version | v1 (SHA-256 on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-FRI30.DIL_Task_v1.md` SHA-256 `0c8d62c4ae81f71a04f9d3ab83258335c96970410b491bd2aaa181612dad06af` |
| State on issue | READY |
| Lane / tool | LANE-11 / **Claude Code (new session; reads files outside the shared folder; D1 read-only)** |
| Usage class | medium |

## Session opener
- Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`. Check `.git/*.lock`. Re-hash this file against the board and the Task against the hash above; stop on mismatch.

## Write owner
**Data-Identity Lead (LANE-11)** — `claude/MA-OCT-008_AC12_Readjudication.md`, the G-2 adjudication file, and the report (D1 read-only; GLEIF ≤ 20 calls if needed; no writes, no gate opening); report `claude/packets/MA-OCT-FRI30.DIL_Report.md`.

## Stop point
After the Task's last step (production steps by 23:45Z), or at once on any failed check (roll back by recorded version id and report).
