# MA-OCT-OPS.T12 — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Wed 14 Oct 2026 · **EXECUTED BY:** LANE-1-ENG · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-OPS.T12** — Ops setup for 011 + 008, housekeeping, 003 read pack, governance commit |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-OPS.T12_Task_v1.md` SHA-256 `a2f29d027e2168cd497f57fa29b15aff2f5fe392a20f13243b69e3a8e1f5cdc3` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-1-ENG / Claude Code |
| Usage class | light |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead (LANE-1-ENG), executing under the Operations Lead's authorisation. Operating rules: `Claude.md` v1.1 and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `3960aee`). Check `.git/*.lock` first. Git writes only as the Task allows (LANE-1-ENG is this week's only committer).
- **First:** re-hash this file against the board row and the Task file against the hash above. **If either differs, stop.**
- Wrangler only 4.96.0 by path; never `npx`. Never print secrets. Respect `claude/relays/FREEZES.json`. **ML-1013-3:** stop and tell the Founder before any command that could raise a macOS password, permission or TCC prompt.
- **Never review your own work.**

## Objective, scope, limits, outputs, stop point
As written in the Task file (part of this Control by hash).

## Budget
≤ 150 D1 writes; ≤ 5k reads.

## Write owner
Engineering Lead (LANE-1-ENG) — registry rows, `OPS_INGEST_KEYS`, pause row, `.gitignore`, the moved secret file, the read-pack results, the governance commit and `claude/packets/MA-OCT-OPS.T12_Report.md`.
