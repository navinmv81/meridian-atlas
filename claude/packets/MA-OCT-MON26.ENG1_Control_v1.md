# MA-OCT-MON26.ENG1 — Control v1 (immutable)

**ISSUED BY:** Main Lane, Mon 26 Oct 2026 19:40Z · **EXECUTED BY:** Engineering Lead (LANE-1-ENG) · **APPROVED BY:** Founder (Option C plan, ML-1025-5; "run tonight", Mon 26)

| | |
|---|---|
| Packet | **MA-OCT-MON26.ENG1** — stop the `/api/ops-health` full scan (one `meridian-proxy` deploy) + local `ma-ops.js` poll pause |
| Control version | v1 (SHA-256 on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-MON26.ENG1_Task_v1.md` SHA-256 `fcea3c670e53d9768e541cf8fcafadc216f0531dbda4138f285b68428eba27a3` |
| State on issue | READY |
| Lane / tool | LANE-1-ENG / **Claude Code** |
| Usage class | light |

## Session opener
- Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`. Check `.git/*.lock`. Re-hash this file against the board and the Task against the hash above; stop on mismatch.
- Wrangler only `/usr/local/bin/wrangler` 4.96.0; never `npx` for wrangler. Never print secrets. Respect FREEZES.json (next: 23:50–00:10Z). One production change tonight. Pre-flight `wrangler whoami`.

## Write owner
**Engineering Lead (LANE-1-ENG)** — the files named in the Task, the worktree `~/MeridianAtlas-work/mon26-worktree`, and `claude/packets/MA-OCT-MON26.ENG1_Report.md`.

## Stop point
After Task step 7, by 23:45Z at the latest, or at once on any failed check: roll back by the recorded version id and report.
