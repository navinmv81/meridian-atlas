# MA-NOV-EXP.BFS.CHECK — Read the first paused 06:00 run of the back-fill job — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead (read-only) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane
APPROVED BY:  Founder — Start Approval required. Read-only; the switch-on (FR13) is a separate Founder word
PACKET:       MA-NOV-EXP.BFS.CHECK · Control v1 · usage class small · write owner Operations Lead (report only)
```

## What
Follow `claude/packets/MA-NOV-EXP.BFS.GO_Report.md` §"BFS.CHECK" (pinned) for the **Sun 22 Nov 06:00Z** firing of `meridian-entities-enrich` (version `aa39edf6`): Phase 1 heartbeat as on previous days; the back-fill job `cf.meridian-entities-enrich.expbf` reported `skipped` (reason `pause` or `out_of_window`), wrote 0 rows, no 5xx; the pause row still open; no exposure rows carry a `g3v2s-` token. Also confirm the 06:50 firing ran normally.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026`. Writable (checked by `end`): `claude/packets/MA-NOV-EXP.BFS.CHECK_Report.md`. `allow_commits: false`.

## Allowed actions
Read files; read-only git; `npx wrangler deployments list -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` (read); **up to 6 read-only D1 SELECTs** (repo root, no `-c`; plan-check; ≤ 20,000 rows total) on the Ops event/heartbeat tables, `ops_job_pause`, and a token count on `entity_exposure_monthly` / `fund_exposure_coverage` via index; write the report.

## Prohibited actions
Any write (D1, Ops rows — the switch-on is not part of this packet); deploys; `wrangler tail` not needed; secrets, `.env*`; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; any evidence the job wrote rows, or Phase 1 failed, or a 5xx — report as **NOT READY** and stop.

## Success conditions
Report with a one-line verdict **READY TO SWITCH ON / NOT READY**, the evidence rows, and the exact switch-on SQL from the GO report; `end`.
