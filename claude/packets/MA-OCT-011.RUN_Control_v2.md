# MA-OCT-011.RUN — Control v2 (immutable; supersedes v1, which never ran)

**ISSUED BY:** Main Lane, Fri 16 Oct 2026 (v2 21:20Z, after RELARC + RELOPS) · **EXECUTED BY:** LANE-11-ENG · **APPROVED BY:** Founder (release approval)

| | |
|---|---|
| Packet | **MA-OCT-011.RUN** — execute 011 plan `e3854698…e6a8`, Sat 17 → Thu 22 Oct |
| Control version | v2 (SHA-256 on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-011.RUN_Task_v2.md` SHA-256 `95a1e744b5c4603c8da7ea7a3d4b0ea1f76cc96cc5f2da01ae2b3ae34667364e` |
| State on issue | READY — gated on RELOPS SIGNED + Founder release approval on the board |
| Lane / tool | LANE-11-ENG / Claude Code (the session that ran MA-OCT-011.FRI) |
| Usage class | heavy |

## Session opener
- **Role:** Engineering Lead — 011 lane. Rules: `Claude.md` v1.1, repo `CLAUDE.md`. Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`; check `.git/*.lock`; **no git writes**.
- **First:** re-hash this file against the board and the Task against the hash above; check the board shows RELOPS SIGNED and the Founder's release approval. Otherwise stop.
- Wrangler only `/usr/local/bin/wrangler` 4.96.0; never `npx`; never print secrets or keys; respect `claude/relays/FREEZES.json`; stop before any macOS permission prompt (ML-1013-3).

## Write owner
**Engineering Lead (LANE-11-ENG)** — the 011 runner state, `~/MeridianAtlas-work/gleif-011/`, D1 writes in plan `e3854698…` only, and `claude/packets/MA-OCT-011.RUN_Report.md`.

## Stop points
End of each run day (day section written); immediately on any Task §6 condition; after the first A batch (adjudication).
