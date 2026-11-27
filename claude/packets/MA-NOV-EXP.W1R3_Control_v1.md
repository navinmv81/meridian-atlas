# MA-NOV-EXP.W1R3 — Cut the exposure route's CPU, add a body-size cap, measure on a preview version — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; a light review before the redeploy (C1R2) if code paths beyond R-EXP1 change
APPROVED BY:  Founder — "CPU A" (NML-1113-1); Start Approval required. The approval covers uploading **non-deployed** preview versions (`wrangler versions upload`); it does **not** cover a production deploy (that is C1R2)
PACKET:       MA-NOV-EXP.W1R3 · Control v1 · usage class medium · write owner Engineering Lead
```

## Background
C1 (`claude/packets/MA-NOV-EXP.C1_Report.md`) deployed `90331a1`, then rolled back: uncached EEM (first request after deploy) 11 ms CPU, VXUS 12 ms (357 KB body); SPAB 8 ms, BNDX 5 ms; cached 1 ms. Workers Free: 10 ms CPU. Rows read are not the driver; likely start-up cost and handling of large bodies (incl. copying into the Cache API).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `90331a1` = origin). Production `meridian-entities-api` is on `4e7ee20b` (previous) — it must stay there. Writable (checked by `end`): `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/`, `claude/packets/MA-NOV-EXP.W1R3_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit the writable paths; Node tests (`node:sqlite`); `npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-api.toml"`; **`npx wrangler versions upload -c "App/Corporate Atlas/wrangler-entities-api.toml"`** (uploads a version **without** routing traffic to it) and requests to **that version's preview URL** only; `npx wrangler versions list -c …`, `npx wrangler deployments list -c …` (read); `npx wrangler tail -c … --format json` to read CPU for preview requests; up to 4 read-only D1 SELECTs (repo root, no `-c`; plan-check; ≤ 50k each); preview-URL requests reading ≤ 400,000 D1 rows in total; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
`npx wrangler deploy` (real), `wrangler versions deploy`, `wrangler rollback`, gradual-deployment percentages — anything that sends production traffic to a new version; toml/secret/route/cron changes (if preview URLs need a toml change, stop and report); requests to the production URL beyond one read-only check that it still serves `4e7ee20b`; D1 writes/DDL; editing other files; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Production version is not `4e7ee20b` at start or end (stop, report — do not fix); preview URLs unavailable without a config change (finish code + tests + local measurements, report, recommend C1R2 with the same triggers); D1 total would pass 400,000; tests failing after bounded fixes; push rejected.

## Success conditions
CPU causes identified with evidence; code changed to cut CPU; a body-size cap (entity count or bytes) set from measurements with margin; on a preview version every uncached look-through that is served measures ≤ 8 ms CPU (at least 2 samples each for EEM, VXUS, SPAB, BNDX, plus one first-request-after-upload sample ≤ 10 ms), or the cap refuses it; tests green; one commit pushed; production untouched; report; `end`.
