# MA-OCT-007.P1 — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Wed 14 Oct 2026 · **EXECUTED BY:** LANE-1-ENG · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-007.P1** — 007 Phase 1 build (R1–R4 routes, router, card); Worker live by Fri 16 22:00 UTC |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-007.P1_Task_v1.md` SHA-256 `abfdba5988b1810c89803a7406fc9f7620a288cb5cc4ca04dc08b4f164988708` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-1-ENG / Claude Code |
| Usage class | heavy |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead (LANE-1-ENG), build lane. Operating rules: `Claude.md` v1.1 and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `3960aee`). Check `.git/*.lock` first. Git writes only as the Task allows (LANE-1-ENG is this week's only committer).
- **First:** re-hash this file against the board row and the Task file against the hash above. **If either differs, stop.**
- Wrangler only 4.96.0 by path; never `npx`. Never print secrets. Respect `claude/relays/FREEZES.json`. **ML-1013-3:** stop and tell the Founder before any command that could raise a macOS password, permission or TCC prompt.
- **Never review your own work.**

## Objective, scope, limits, outputs, stop point
As written in the Task file (part of this Control by hash).

## Budget
0 D1 writes; ≤ 20k reads.

## Write owner
Engineering Lead (LANE-1-ENG) — 007 Phase 1 code, the `meridian-entities-api` deploy, commits, `claude/packets/MA-OCT-007.P1_Report.md`.
