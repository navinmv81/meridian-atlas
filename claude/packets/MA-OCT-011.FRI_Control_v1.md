# MA-OCT-011.FRI — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Thu 15 Oct 2026 · **EXECUTED BY:** LANE-11-ENG, Engineering Lead · **REVIEWED BY:** Architect + Operations Lead (RELARC, RELOPS) · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-011.FRI** — Fri 16 fresh export (160k cap), R9-3 re-projection, R9-1 runner ceiling, plan generation, freshness gate |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-011.FRI_Task_v1.md` SHA-256 `533473453bacebfc323961fabaf47196530796bbf7e8302f34e12bc06f3b9566` |
| State on issue | READY (EXECUTING on the Founder's Start Approval, Fri 16 after 07:10 UTC) |
| Lane / tool | LANE-11-ENG / Claude Code (the session that ran MA-OCT-011.BUILD) |
| Usage class | heavy |

## Session opener
- **Role:** Engineering Lead — 011 build lane. Rules: `Claude.md` v1.1 and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. Branch `October-2026` (HEAD at issue `d0e6847`). Check `.git/*.lock` first. **No git writes.**
- **First:** re-hash this file against the board row and the Task against the hash above. If either differs, stop.
- Wrangler only as `/usr/local/bin/wrangler` (4.96.0); never `npx`. Never print secrets or key values. Respect `claude/relays/FREEZES.json`. Stop and tell the Founder before any command that can raise a macOS permission prompt (ML-1013-3).
- **Never review your own work.**

## Objective
A releasable 011 plan, a measured read projection and a passed freshness gate by Fri 16 15:00 UTC, so the release reviews and the Founder's release approval can happen Fri 16 and the pilot Sat 17.

## Prerequisites
MA-OCT-011.BUILD complete (rehearsal passed); OPS-R9 / OPS-R10 ruled (MA-OCT-011.OPSR, `87d2036e…6b1f`).

## Allowed / Prohibited / Budget
As in the Task. In short: read-only export ≤ 160k, ≤ 50 GLEIF calls, local plan and code on 011 paths; **no production write batch, no pilot, no git writes.**

## Write owner
**Engineering Lead (LANE-11-ENG)** — 011 runner paths, `~/MeridianAtlas-work/gleif-011/`, and `claude/packets/MA-OCT-011.FRI_Report.md`.

## Success conditions
Task items 1–7 done with evidence; R9-3 outcome PROCEED or CEILING 450k; freshness gate ≥ 98% with ≥ 15 A and 0 A mismatches.

## Stop point
After the report. Also stop at once on: export cap hit, page > 50k reads, R9-3 STOP, E-4 trigger, or any hash mismatch.
