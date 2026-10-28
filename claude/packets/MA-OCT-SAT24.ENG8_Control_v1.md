# MA-OCT-SAT24.ENG8 — Control v1 (immutable)

**ISSUED BY:** Main Lane, Fri 23 Oct 2026 · **EXECUTED BY:** Engineering Lead (LANE-8-ENG) · **APPROVED BY:** Founder (Sat 24 go-live approval required on the board first)

| | |
|---|---|
| Packet | **MA-OCT-SAT24.ENG8** — Sat 24 part 2: 003 rebase onto A6, deploy 3, M1/M2 |
| Control version | v1 (SHA-256 on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-SAT24.ENG8_Task_v1.md` SHA-256 `4f7598f48cd450560c87c349c98b162887ea61954d23a2e351b984b3b845ea82` |
| State on issue | READY — gated on the Founder's Sat 24 go-live approval recorded on this row |
| Lane / tool | LANE-8-ENG / Claude Code |
| Usage class | heavy |

## Session opener
- Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`. Check `.git/*.lock`. Re-hash this file against the board and the Task against the hash above; **stop if the board does not show the Founder's Sat 24 approval**.
- Wrangler only `/usr/local/bin/wrangler` 4.96.0; never `npx` for wrangler. Never print secrets or key values; secrets only via `wrangler secret put` from stdin. Respect FREEZES.json. Stop before any macOS permission prompt (ML-1013-3). One production change at a time; never two in the same minute.
- **Pre-flight token refresh** before the first remote call (`wrangler whoami`), per CLOSEREV-OPS (7403 race).

## Write owner
**Engineering Lead (LANE-8-ENG)** — the steps and files named in the Task, and `claude/packets/MA-OCT-SAT24.ENG8_Report.md`.

## Stop point
After the Task's last step, or at once on any failed check: roll back that step by its recorded version id and report.
