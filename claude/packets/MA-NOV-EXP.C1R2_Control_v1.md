# MA-NOV-EXP.C1R2 — Redeploy the exposure route (c5d0cad) to `meridian-entities-api` (C-1, second attempt) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Operations Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  MA-NOV-EXP.W1.REVIEW (PASS_WITH_NOTES) and MA-NOV-EXP.W1R3.REVIEW (PASS_WITH_NOTES, "C1R2 may deploy c5d0cad with conditions"; report pinned in the Task); Main Lane verification after
APPROVED BY:  Founder — this packet's Start Approval IS the production deploy approval for C-1 (spec §8)
PACKET:       MA-NOV-EXP.C1R2 · Control v1 · usage class small · write owner Operations Lead (report only)
```

## What is deployed
Commit `c5d0cad` (`App/Corporate Atlas/src/entities-api.js`; W1 + W1R2 + W1R3) to Worker `meridian-entities-api`, **built from the commit** (not a preview version id): route `GET /api/exposure/etf/{symbol}` (R-EXP1, one D1 call, rows cap 10,000 holdings, size cap 128 KiB) and the per-holder-month change to `/api/entities/{id}/etf-exposure`. The first attempt (C1, `90331a1`) was rolled back on CPU. No toml, binding, route, cron or secret change. Nothing in the front end calls R-EXP1 until C-2.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `c5d0cad` = origin); production on `4e7ee20b`. Config: `App/Corporate Atlas/wrangler-entities-api.toml` (**every** wrangler command carries `-c "App/Corporate Atlas/wrangler-entities-api.toml"` — review M-1). Writable (checked by `end`): `claude/packets/MA-NOV-EXP.C1R2_Report.md` only. `allow_commits: false`.

## Allowed actions
`git --no-optional-locks` reads, `git ls-remote`; `npx wrangler whoami`; `npx wrangler deployments list -c …`; **one** `npx wrangler deploy -c …`; `npx wrangler tail -c … --format json` (background, stopped when checks end); `curl -sS -D -` GET requests to the Worker's own workers.dev URL for the paths in the Task only; **up to 2 read-only D1 SELECTs** (repo root, no `-c`) to pick a regression entity; `npx wrangler rollback <previous version id> -c … -m "<reason>"` **only** on a rollback trigger; write the report.

## Prohibited actions
Editing any file other than the report; a second deploy; deploying any other Worker; toml/secret/route/cron changes; D1 writes/DDL; `.env*`, printing tokens; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents; installs; subagents; `13F Seed/gleif-seed.js`; requests to any other host.

## Stop gates and rollback triggers
**Before deploy — stop without deploying:** HEAD ≠ `c5d0cad` or ≠ origin; `git diff --quiet HEAD -- "App/Corporate Atlas"` fails; production is not `4e7ee20b`; previous version id not captured; `whoami` not OAuth.
**After deploy — roll back immediately, then report:** any request with outcome `exceededCpu` / error 1102 or `cpuTime` > 10 ms (review threshold); any `exp_lookthrough` rows_read > 50,000; any 5xx on the checked paths; regression failure on `/etf-exposure` or `/api/entities/search`; BND/AGG/MBB not returning 422 `too_large` with `limit:"rows"`; a cached EEM body differing from its miss body.
**Not a rollback:** VXUS returning 422 `too_large` with `limit:"size"` (expected); a cache miss on a repeat (record it).

## Success conditions
Deployed, all post-deploy checks recorded and passing, previous + new version ids recorded, report, `end`. Or: rolled back on a trigger, with evidence, report, `end`.
