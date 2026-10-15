# MA-OCT-011.BUILD — Control v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator), Mon 12 Oct 2026 · **EXECUTED BY:** LANE-11-ENG, Engineering Lead · **REVIEWED BY:** Architect + Operations Lead (Fri 16 release review) · **APPROVED BY:** Founder

| | |
|---|---|
| Packet | **MA-OCT-011.BUILD** — Build the 011 runner, plan generator, restore path and tests (no production writes) |
| Control version | v1 (this file; its SHA-256 is on `claude/packets/STATUS_BOARD.md`) |
| Task | `claude/packets/MA-OCT-011.BUILD_Task_v1.md` SHA-256 `e32bfeb6d3b522e5c4ed9fefbda7ed5ad158e6484459df79bc3a6f949978bcc7` |
| State on issue | READY (moves to EXECUTING on the Founder's Start Approval) |
| Lane / tool | LANE-11-ENG / Claude Code |
| Usage class | heavy |

## Session opener (fresh or existing session)
- **Role:** Engineering Lead — 011 build lane (a new Claude Code session; not the LANE-1-ENG session). Operating rules: `Claude.md` v1.1 (Project doc) and the repo `CLAUDE.md`.
- **Folder:** `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. All paths are relative to it.
- **Branch:** `October-2026` (HEAD at issue `45cdb9d`). Check `.git/*.lock` first. Git writes only as the Task allows.
- **First:** re-hash this file against the board row and the Task file against the hash above. **If either differs, stop.**
- Wrangler only as `/usr/local/bin/wrangler` (4.96.0); never `npx`. Never print secrets. Respect `claude/relays/FREEZES.json`.
- **Never review your own work.**

## Objective
Have the 011 runner and its controls built, dry-run and rehearsed by Thu 15, so plan generation and the release review can run Fri 16 and the pilot Sat 17.

## Prerequisites
011 GO (GATE-1012 D1); 002a outbox module committed (`8f06ed0`).

## Allowed
Code and tests on the 011 paths; read-only D1 point/EXPLAIN reads; the ≤ 20-row rollback rehearsal on Thu 15 (≤ 100 writes).

## Prohibited
Production batches; plan generation for the run; GLEIF calls; the ingest key, `OPS_INGEST_KEYS`, registry row or pause row (MA-OCT-011.T12); git writes; edits to files owned by LANE-1-ENG.

## Budget and write limits
≤ 20k D1 reads; ≤ 100 D1 writes (rehearsal only, Thu 15).

## Write owner
**Engineering Lead (LANE-11-ENG)** — sole writer of the 011 runner paths, `~/MeridianAtlas-work/gleif-011/` and `claude/packets/MA-OCT-011.BUILD_Report.md`.

## Success conditions
Items 1–6 of the Task done with evidence; ready for Fri 16 plan generation and release review.

## Outputs and report-back
As listed in the Task. Quote this Control version (v1) and its SHA-256 at the top of the report.

## Stop point
End of each day; final stop Thu 15 after the rehearsal.
