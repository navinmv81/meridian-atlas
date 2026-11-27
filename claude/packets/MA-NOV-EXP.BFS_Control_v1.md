# MA-NOV-EXP.BFS — Scheduled exposure back-fill/refresh: spec addendum + change request — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Entities Product Lead + Architect, with Tech Ops (three-point check) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; Founder approves the addendum and the change request together
APPROVED BY:  Founder — "scheduled now" (NML-1120-1); Start Approval required. Design and change request only: nothing is built, deployed or written
PACKET:       MA-NOV-EXP.BFS · Control v1 · usage class medium · write owner Entities Product Lead
```

## Purpose
Design the batched gate3 v2 back-fill (2026-04 … 2026-08) as a **scheduled job inside Cloudflare**, attached to the existing `meridian-entities-enrich` crons (`0 6 * * *`, `50 6 * * *`; no new cron slot — 5/5 in use), which afterwards continues as the recurring refresh (spec D5). Produce: a spec addendum, a `/change-request` (impact + rollback), and the three-point check with measured numbers.

## Inputs
Spec `claude/specs/MA-NOV-EXP_Spec.md` §3.2, §5.4, D4/D5; BF1 report (gate3 v2 SQL `4cdd22e`, dry-run 2026-04 = 36,951 rows / 70 holders, 2026-07 = 4,581 / 24, ≈148k row-writes for April, read ratio ≈ 4.2k reads per holder); CLAUDE.md rules (recurring jobs inside Cloudflare; Free plan permanent; three-point check; domain ownership; 100k writes/day shared; heavy days Sun holdings ≈80k, Mon entities-seed ≈37k); `claude/MA-OCT-000_Job_Manifest.md` (job inventory); `App/Corporate Atlas/src/entities-enrich.js` and `wrangler-entities-enrich.toml` (dispatcher by minute, existing phases, existing guards/heartbeats); any existing hold/pause mechanism (e.g. `hold_all_jobs`, Ops job registry).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `4cdd22e` = origin). Writable (checked by `end`): `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md`, `claude/specs/MA-NOV-EXP_BF_Change_Request.md`, `claude/packets/MA-NOV-EXP.BFS_Report.md`. `allow_commits: false`.

## Allowed actions
Read files; read-only git; use the `/write-spec` and `/change-request` skills if available (else follow their structure); **up to 8 read-only D1 statements** (repo root, no `-c`; plan-check first; ≤ 50,000 rows per statement **by projection before running**; ≤ 120,000 rows in total — stop reading at the cap) to measure one representative batch: a ~10-holder slice of 2026-04 (reads, rows the INSERT would produce), the write-counter source for the daily guard, and the existing hold flag(s); write the three files.

## Prohibited actions
Any write to D1; deploys; editing code, tomls, crons; `docs/`; secrets, `.env*`; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; the design would need a new cron slot, a new table, a cross-domain write, or a non-Cloudflare scheduler (stop and set it out as a Founder decision — do not design around a rule); read budget reached (finish from code and BF1's numbers, mark estimates).

## Success conditions
The three files written to the Task's structure, with measured batch numbers, a daily write budget that respects the shared 100k cap on every weekday, an on/off control and status, rollback, and a build/review/deploy plan sized in packet-days; `end`.
