# MA-NOV-EXP.W1.REVIEW — Independent review of the exposure route (W1 + W1R2) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-12
EXECUTED BY:  Architect, writing the ETF Product Lead and Tech Ops sign-offs (spec §10) — fresh interactive Claude Code session via LANE_OPENER_v2.md (did not author W1/W1R2)
REVIEWED BY:  — (this is the review)
APPROVED BY:  Founder — Start Approval required (MA-NOV-EXP.W1.REVIEW_Status.json); deploy C-1 is a separate Founder approval after this review
PACKET:       MA-NOV-EXP.W1.REVIEW · Control v1 · usage class medium · write owner Architect (review report only)
```

## Scope
Commit `90331a1` (MA-NOV-EXP.W1, built by W1 + W1R2) against the approved spec `claude/specs/MA-NOV-EXP_Spec.md` (§3.2, §4, §5.3, §7, §8 C-1, §10), amendment A1 as refined by D-1 c (no look-through > 50,000 rows; cap from measured cost), and the W1 and W1R2 reports (deviations D-2, D-3, D-4 and the unsorted-entities deviation).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `90331a1` = origin). Writable (checked by `end`): `claude/packets/MA-NOV-EXP.W1.REVIEW_Report.md`. Execute from `claude/packets/MA-NOV-EXP.W1.REVIEW_Task_v1.md`.

## Allowed actions
Read any repository file; `git --no-optional-locks` reads and `git ls-remote`; run the Corporate Atlas test suites (`node --test`, `node:sqlite`); experiments in temp copies only; `npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-api.toml"`; **up to 4 read-only D1 statements** from the repo root without `-c` (`EXPLAIN QUERY PLAN` / `SELECT` of the committed SQL; plan-check first; projection ≤ 50,000 per statement; ≤ 60,000 rows in total; code 10000 → retry once after 30 s); write the report.

## Prohibited actions
Editing any other file; real `wrangler deploy`, `wrangler tail`, secrets, `.env*`, toml changes; D1 writes/DDL; git writes; `*_Status.json`, `config.json`, board, Tower, `transitions.jsonl`, logs; `dispatch.mjs run` or `begin` for another packet; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gate
After writing the report and running `end`, stop.

## Success conditions
Verdict (PASS / PASS_WITH_NOTES / FAIL) with findings (B blocking / M must-fix before deploy / N note); ETF Product Lead and Tech Ops sign-off sections; a plain recommendation on whether C-1 (deploy) may proceed.
