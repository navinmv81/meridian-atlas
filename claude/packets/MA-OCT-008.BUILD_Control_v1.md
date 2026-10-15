# MA-OCT-008.BUILD — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Wed 14 Oct 2026 · **EXECUTED BY:** LANE-8-ENG · **REVIEWED BY:** per the Task · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-008.BUILD** — SEC corporate-bond ingestion build (008 rev 1.2) |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-008.BUILD_Task_v1.md` SHA-256 `1bdc15366aa61ff0f1dbbc9c7d5f21855963d9b65da2bc7e94e7e9738e2ec3e8` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-8-ENG / Claude Code (new session) |
| Usage class | heavy |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead — 008 build lane (a new Claude Code session; not LANE-1-ENG or LANE-11-ENG). Operating rules: `Claude.md` v1.1 (Project doc) and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` (connect it if not connected). All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `3960aee`). Check `.git/*.lock` first; read git only with `git --no-optional-locks`; **no git writes** (ML-1012-2).
- **First:** re-hash this file against the board row and the Task file against the hash above. **If either differs, stop.**
- Never print secrets. Respect `claude/relays/FREEZES.json`. **ML-1013-3:** stop and tell the Founder before any command that could raise a macOS password, permission or TCC prompt.
- **Never review your own work.**

## Objective, scope, limits and outputs
As written in the Task file (it is part of this Control by hash).

## Budget and write limits
Today 0 D1 writes; Thu ≤ ≈ 500; Fri ≤ 8,000 (run cap); SEC ≤ 1,500 requests per run.

## Write owner
**Engineering Lead (LANE-8-ENG)** — sole writer of `App/Corporate Atlas/bonds/**`, the 008 migration file, the bond tables' rows and `claude/packets/MA-OCT-008.BUILD_Report.md`.

## Stop point
As the Task says (end of each day, or after each deliverable).
