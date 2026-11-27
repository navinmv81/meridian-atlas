# MA-NOV-EXP.BFS.BUILD — Scheduled exposure back-fill: build + tests (no deploy) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Engineering Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  BFS.REVIEW (Architect + Tech Ops; ETF PL acknowledgement; Data-Identity sign-off), then BFS.OPS and BFS.DEPLOY
APPROVED BY:  Founder — addendum + change request approved with decisions 1–7 as recommended (NML-1120-3); Start Approval required
PACKET:       MA-NOV-EXP.BFS.BUILD · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources (pinned in the Task)
`claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md` (approved), `claude/specs/MA-NOV-EXP_BF_Change_Request.md` (approved), `claude/packets/MA-NOV-EXP.BFS_Report.md` (measured plan and batch SQL), gate3 v2 SQL in `App/Corporate Atlas/gate3v2/` (`4cdd22e`).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `App/Corporate Atlas/src/exp-backfill.js` (new), `App/Corporate Atlas/src/entities-enrich.js` (the `scheduled()` wiring for the 06:00 firing only), `App/Corporate Atlas/tests/` (new `exp-backfill*` files and fixtures), `claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; Node tests (`node:sqlite`) for B1–B9 per the addendum; run all existing Corporate Atlas suites; `npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-enrich.toml"`; **B10 live plan check:** up to 4 read-only D1 statements (repo root, no `-c`; `EXPLAIN QUERY PLAN` and one batch `COUNT`; projection ≤ 50,000 per statement; ≤ 60,000 total); read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Any deploy; toml/cron/secret changes; D1 writes, DDL, Ops rows (`ops_job_registry`, `write_budget_profile`, `ops_job_pause` are BFS.OPS); changes to Phase 1 / Phase 2–3 behaviour beyond calling the new step after Phase 1 at 06:00; other Workers; front-end files, `docs/`; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; any part of the addendum that cannot be built without a new table, cron, secret or cross-domain write (stop, report); B10 plan shows a SCAN of a large table; existing enrich tests failing; push rejected.

## Success conditions
`exp-backfill.js` implements the addendum (selection, packing ≤ 12k holdings, exact pre-count, one transaction per batch, budget min(cap, 60,000 − U) with fail-closed, Sun/Mon skip, hold/pause guards, run tokens, heartbeat and log line, status metrics); wired after Phase 1 in the 06:00 firing; B1–B9 green; B10 recorded; existing suites green; dry-run build OK; one commit pushed; report; `end`. Nothing deployed.
