# MA-OCT-003.BUILD — Control v1 (immutable)

**ISSUED BY:** Main Lane, Wed 21 Oct 2026 · **EXECUTED BY:** LANE-8-ENG (Engineering Lead)

| | |
|---|---|
| Packet | **MA-OCT-003.BUILD** — 003 local build + Sat 24 run sheet |
| Control version | v1 (SHA-256 on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-003.BUILD_Task_v1.md` SHA-256 `963214b6730931360f9997d4bcd5be218f4cf4146a6b047b6b4f38dc03fa800a` |
| State on issue | READY |
| Lane / tool | LANE-8-ENG / Claude Code |
| Usage class | heavy |

## Session opener
- **Role:** Engineering Lead — now the 003 build (008 work resumes after 24 Oct). Rules: `Claude.md` v1.1, repo `CLAUDE.md`. Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`; check `.git/*.lock`; **no git writes**.
- **First:** re-hash this file against the board and the Task against the hash above; stop on mismatch.
- Wrangler only `/usr/local/bin/wrangler` 4.96.0; never `npx`; never print secrets; respect `claude/relays/FREEZES.json`; stop before any macOS prompt (ML-1013-3). Never review your own work.

## Write owner
**Engineering Lead (LANE-8-ENG)** — 003 code/test/migration files named in spec §16 and `claude/packets/MA-OCT-003.BUILD_Report.md`.
