# MA-NOV-SA1 — November scope assessment (read-only) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-10
EXECUTED BY:  Architect + Product Lead (assessment) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane (consistency with the scope document, the DRAFT records and the decisions log)
APPROVED BY:  Founder — "SA1 tonight" (NML-1110-4); Start Approval required (MA-NOV-SA1_Status.json); scope approval after the report
PACKET:       MA-NOV-SA1 · Control v1 · usage class medium · write owner Architect
```

## Purpose
Checkpoint 1 of the November content scope document (§7.1): assess the actual post-patch baseline and recommend the **minimum complete November scope** for Founder approval. Assessment only — no design, no build.

## Sources (read)
- `meridian_atlas_november_content_scope_and_requirements.md` (repo root, untracked; pinned in the Task) — the scope of record.
- DRAFT records: `claude/packets/MA-NOV-{OPS,EXP,BOND,HOME,CARRY}_Status.json` (requirements, dependencies, observations).
- `claude/November_Decisions_Log.md`; `CLAUDE.md`; `claude/governance/Claude_md_v1.2.md`.
- Product code read-only: `App/` (front end and Workers incl. `wrangler-*.toml`), `13F Seed/` **except** `13F Seed/gleif-seed.js` (never open), `docs/` only to confirm what is live.
- Repo docs on bonds/October (e.g. `MA-OCT-004-Bond-Spec.md`, `claude/` October briefs/reports) as needed.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f215681` = origin). Execute from `claude/packets/MA-NOV-SA1_Task_v1.md`. Writable (checked by `end`): `claude/packets/MA-NOV-SA1_Report.md` only. `allow_commits: false`.

## Allowed actions
Read files; read-only `git` with `--no-optional-locks`; **up to 15 read-only D1 queries** via `npx wrangler d1 execute meridian-etf --remote --command "<SELECT …>"` — SELECT only, each with `LIMIT` or an aggregate over an indexed/small table, **no full scan of `fundholdingsmonthly` or `entity_master`**, total rows read ≤ 200,000 (report the `rows_read` of each); write the report.

## Prohibited actions
Any D1 write/DDL/PRAGMA that changes state; `wrangler deploy`, secrets, `.env*` reads, Cloudflare dashboard/API beyond the queries above; editing any file other than the report; git writes (add, commit, push, branch, stash, reset, clean); `*_Status.json`, `config.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents, cron; npm installs; subagents; opening `13F Seed/gleif-seed.js`; printing any secret.

## Stop gates
Pinned hash mismatch; a query that would need a full scan of a large table (skip it and note the gap); any permission/password prompt; a wrangler auth failure (continue from code and docs only, and say so).

## Success conditions
Report written to the Task's structure, with a recommended minimum complete scope, capacity view and decisions for the Founder; nothing else changed; `end`.
