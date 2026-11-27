# MA-NOV-EXP.W1R4 — Versioned, canonical cache key for the exposure route, then deploy and measure (C1R3) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead + Operations Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification. Small change (cache key only), so code and deploy are one packet; the deploy checks and rollback triggers are the safeguard
APPROVED BY:  Founder — "cache A" (NML-1113-6); this packet's Start Approval covers **both** the code change and the production deploy of its commit
PACKET:       MA-NOV-EXP.W1R4 · Control v1 · usage class small · write owner Engineering Lead
```

## Why
C1R2 (`claude/packets/MA-NOV-EXP.C1R2_Report.md`) deployed `866c6cb2` (`c5d0cad`), but EEM, SPAB, BNDX and VXUS were answered from cache entries written by the rolled-back C1 build (same key, 24 h TTL), so the new code's CPU and the VXUS size refusal were never measured, and VXUS still returns the old 200. Reviews W1.REVIEW N-2 and W1R3.REVIEW N-2: the key is the raw URL (non-canonical).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `c5d0cad` = origin). Production `meridian-entities-api` = `866c6cb2-5a24-4219-829a-f65d7420be23`. Config: every wrangler command carries `-c "App/Corporate Atlas/wrangler-entities-api.toml"`. Writable (checked by `end`): `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/`, `claude/packets/MA-NOV-EXP.W1R4_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Part 1 (code): edit the writable paths; Node tests; dry-run build; `git add -- <explicit paths>`; one commit; `git push origin November-2026`; `git ls-remote`.
Part 2 (deploy, only after Part 1 is pushed and green): `npx wrangler whoami`; `deployments list`; **one** `npx wrangler deploy -c …` from the pushed commit; `npx wrangler tail -c … --format json`; `curl -sS -D -` GETs to the Worker's workers.dev URL for the Task's paths; `npx wrangler rollback 866c6cb2-5a24-4219-829a-f65d7420be23 -c … -m "<reason>"` only on a trigger; write the report.

## Prohibited actions
Any change outside the route's cache-key code and its tests; contract/body changes; toml/secret/route/cron changes; D1 statements other than those the Worker runs for the checks; a second deploy; other Workers; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; force-push or other git rewriting.

## Stop gates and rollback triggers
**Before deploy — stop without deploying:** tests failing; push rejected; HEAD ≠ origin after push; working tree dirty under `App/Corporate Atlas`; production ≠ `866c6cb2`.
**After deploy — roll back to `866c6cb2` immediately, then report:** any uncached request with `cpuTime` > 10 ms or outcome `exceededCpu`/1102; any 5xx; any `exp_lookthrough` rows_read > 50,000; regression failure; a cached body that differs from its miss body; any first look-through returning `x-exp-cache: hit` (would mean the key is not new).
**Not a rollback:** VXUS 422 `too_large` `limit:"size"` (expected).

## Success conditions
Commit pushed; deployed; every check recorded (true misses, then hits); new version id and the previous recorded; report with the CPU summary and a view on raising the size cap; `end`. Or rolled back on a trigger with evidence.
