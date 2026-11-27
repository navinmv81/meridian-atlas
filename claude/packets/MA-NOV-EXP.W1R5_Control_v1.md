# MA-NOV-EXP.W1R5 — `newest_stored_month` on R-EXP1 for the stale warning, then deploy and measure — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Engineering Lead + Operations Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; deploy checks + rollback triggers (as W1R4)
APPROVED BY:  Founder — "M-2 b" (NML-1118-4); this packet's Start Approval covers **both** the code change and the production deploy of its commit
PACKET:       MA-NOV-EXP.W1R5 · Control v1 · usage class small · write owner Engineering Lead
```

## Why
UI.REVIEW M-2 (`claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md`, pinned): the stale warning compares months within the portfolio only, so spec T6 (IYLD 100, Jan 2026 vs newest stored Aug 2026) shows no warning. Founder chose (b): add the field to the route before release.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `8adcff1` = origin). Production `meridian-entities-api` = `bb8ad0aa-3077-4dc1-8eb6-52abe546a826` (commit `54b1446`). Every wrangler command carries `-c "App/Corporate Atlas/wrangler-entities-api.toml"`. Writable (checked by `end`): `App/Corporate Atlas/src/entities-api.js` (R-EXP1 only), `App/ma-entities.js` (EXP blocks only), `App/Corporate Atlas/tests/`, `claude/packets/MA-NOV-EXP.W1R5_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Part 1 (code): edit within scope; Node tests; dry-run build; up to 3 read-only D1 statements (repo root, no `-c`; `EXPLAIN QUERY PLAN` / `SELECT` of the new sub-query; plan-check first; ≤ 1,000 rows each) to prove the newest-month lookup is an index SEARCH costing a few rows; `git add -- <explicit paths>`; one commit; push; `ls-remote`.
Part 2 (deploy, only after Part 1 is pushed and green): `whoami`; `deployments list`; **one** `npx wrangler deploy -c …`; `wrangler tail -c … --format json`; `curl -sS -D -` GETs to the Worker's workers.dev URL for the Task's paths; `npx wrangler rollback bb8ad0aa-3077-4dc1-8eb6-52abe546a826 -c … -m "<reason>"` only on a trigger; write the report.

## Prohibited actions
Contract changes other than the one additive field; any other route; toml/secret/route/cron changes; D1 writes/DDL; `docs/`, `generate-docs.mjs`, `index.html`; a second deploy; other Workers; storage; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; git rewriting.

## Stop gates and rollback triggers
**Before deploy — stop:** the newest-month sub-query plan shows a SCAN of a real table or reads > 1,000 rows; tests failing; push rejected; HEAD ≠ origin; working tree dirty under `App/`; production ≠ `bb8ad0aa`.
**After deploy — roll back to `bb8ad0aa` immediately, then report:** any uncached request with `cpuTime` > 10 ms or `exceededCpu`/1102; any 5xx; any `exp_lookthrough` rows_read > 50,000; regression failure; a cached body differing from its miss body; any first look-through returning `x-exp-cache: hit` (the cache generation was not bumped); `newest_stored_month` missing or not a `YYYY-MM` string.
**Not a rollback:** VXUS 422 `limit:"size"`; BND/AGG/MBB 422 `limit:"rows"`.

## Success conditions
Field added (additive, documented), cache generation bumped, client stale rule uses it (T6 test: IYLD-only portfolio shows the stale warning), tests green, commit pushed, deployed, checks recorded, report, `end` — or rolled back on a trigger with evidence.
