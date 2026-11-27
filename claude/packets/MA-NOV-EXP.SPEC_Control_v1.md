# MA-NOV-EXP.SPEC — Exposure-to-company specification — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-11
EXECUTED BY:  Entities Product Lead + Architect (specification) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; ETF Product Lead and Tech Ops perspectives written into the spec's review section (cross-lane rule)
APPROVED BY:  Founder — scope approved (NML-1110-6), "go, spec first" (NML-1111-3); Start Approval required; spec approval after the run
PACKET:       MA-NOV-EXP.SPEC · Control v1 · usage class medium · write owner Entities Product Lead
```

## Purpose
Scope-document checkpoint 2 (§7.2) for outcome EXP (EXP-01–12): a buildable specification — calculations, contracts, fields, interfaces, coverage labels, acceptance tests, change/rollback plan and small sequenced work units. Specification only; nothing is built, deployed or run.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f215681` = origin). Execute from `claude/packets/MA-NOV-EXP.SPEC_Task_v1.md`. Writable (checked by `end`): `claude/specs/MA-NOV-EXP_Spec.md`, `claude/packets/MA-NOV-EXP.SPEC_Report.md`. `allow_commits: false`.

## Allowed actions
Read files (`App/`, `13F Seed/` except `gleif-seed.js`, `claude/`, repo docs); read-only `git --no-optional-locks`; **up to 10 sizing statements** from the repo root without `-c`: `npx wrangler d1 execute meridian-etf --remote --command "<SELECT … | EXPLAIN QUERY PLAN SELECT …>"`, plan-check first on large tables (`fund_holdings_monthly`, `entity_master`, `entity_exposure_monthly`, `instrument_master`, `firds_instrument_reference`) and skip any `SCAN` of them; ≤150,000 rows read in total; code 10000 → wait 30 s, retry once. Use the `/write-spec` skill if this session has it; otherwise follow its structure.

## Prohibited actions
D1 writes/DDL; running `gate3-exposure.js` or any pipeline; deploys; secrets, `.env*`, `-c` configs; editing anything other than the two writable files; git writes; `*_Status.json`, `config.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents, cron; npm installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; second 10000 or any other auth error (continue without queries, mark the estimates as unmeasured); rows read would pass 150,000; any permission prompt; a requirement that cannot be met without breaking a CLAUDE.md non-negotiable (record it as an open decision, do not design around the rule).

## Success conditions
Spec and report written to the Task's structure; nothing else changed; `end`.
