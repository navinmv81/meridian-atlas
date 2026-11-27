# MA-NOV-EXP.BFS.ON — Switch on the scheduled exposure back-fill (FR13) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; first live run checked on its morning
APPROVED BY:  Founder — "switch on back-fill" (FR13) after BFS.CHECK verdict READY TO SWITCH ON; this packet's Start Approval is that word
PACKET:       MA-NOV-EXP.BFS.ON · Control v1 · usage class small · write owner Operations Lead
```

## What
Run the switch-on SQL from `claude/packets/MA-NOV-EXP.BFS.GO_Report.md` (pinned) exactly once: end the open `ops_job_pause` row for `cf.meridian-entities-enrich.expbf` and insert its `ops_case_event`, with this packet id and the Founder's words in the payload. Verify. The first real run is the next 06:00Z on Tue–Sat with enough headroom.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026`. Writable (checked by `end`): `App/Ops/migrations/switch-on-2026-11-22-expbf.sql` (new), `claude/packets/MA-NOV-EXP.BFS.ON_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Write the SQL file (copied from the GO report, placeholders filled); commit + push it before running; run it once with `npx wrangler d1 execute meridian-etf --remote --file …` from the repo root; ≤ 3 read-only SELECTs to verify (pause row ended; no other open pause row for the job; case event present); write the report.

## Prohibited actions
Any other D1 write; editing the registry or budget profile; deploys; code edits; secrets, `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; the pause row is not open before the run (report, do nothing); the UPDATE changes ≠ 1 row (report; the switch-off SQL in the GO report re-pauses if needed).

## Success conditions
Pause row ended (exactly 1 row), case event written, no open pause for the job; report with the switch-off SQL and the date of the first expected run; `end`.
