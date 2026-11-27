# MA-NOV-EXP.C1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-12
EXECUTED BY:  Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.C1_Status.json (= deploy approval)
CONTROL:      claude/packets/MA-NOV-EXP.C1_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-EXP.W1.REVIEW_Report.md` | `a970aa16ef5bff961730b7f0e0f80117dd456ca1eb967a73dd62c5605cd62743` |

## Steps (C = `-c "App/Corporate Atlas/wrangler-entities-api.toml"`)
1. **Pre-checks:** HEAD = `90331a1` = `git ls-remote origin November-2026`; `git --no-optional-locks diff --quiet 90331a1 -- "App/Corporate Atlas/src/entities-api.js"`; `npx wrangler whoami` shows OAuth (no token printed).
2. **Capture:** `npx wrangler deployments list C` — record the current (previous) version id and its date.
3. **Deploy:** `npx wrangler deploy C` — record the new version id and the workers.dev URL it prints.
4. **Tail:** start `npx wrangler tail C --format json` in the background, writing to a scratch file outside the repo.
5. **Checks** (base = the printed workers.dev URL; each with `curl -sS -D -`; record status, `x-exp-cache`, body size, and from the tail: outcome, cpuTime, the `exp_lookthrough` rows_read):
   a. `/api/exposure/etf/EEM` — 200; rows_read within ±10% of 5,763.
   b. `/api/exposure/etf/VXUS` — 200; rows_read within ±10% of 38,254; cpuTime ≤ 10 ms.
   c. `/api/exposure/etf/VXUS` again — record `x-exp-cache` (hit expected; miss = KI, blocks C-2).
   d. `/api/exposure/etf/SPAB`, `/api/exposure/etf/BNDX` — 200; rows_read ≤ 50,000 each (if over: roll back; a lower `EXP_ROWS_PER_HOLDING` comes in a fix packet).
   e. `/api/exposure/etf/BND`, `AGG`, `MBB` — 422 `too_large`.
   f. `/api/exposure/etf/SPY` — 404 `no_holdings`; `/api/exposure/etf/%27%20OR%201=1` — 400.
   g. Regression: one D1 SELECT to find an entity with rows in `entity_exposure_monthly` (e.g. `SELECT entity_id FROM entity_exposure_monthly WHERE report_month='2026-03' LIMIT 1`, plan-checked); then `/api/entities/<id>/etf-exposure` — 200 with `funds`, `months_min`, `months_max`; and `/api/entities/search?q=pepsico` — 200, non-empty.
6. Stop the tail. **Rollback** if any trigger in the Control fired: `npx wrangler rollback <previous id> C -m "MA-NOV-EXP.C1 rollback: <reason>"`, then re-check (a) returns 404 and the regression path 200.

## Report — `claude/packets/MA-NOV-EXP.C1_Report.md`
Header (packet, run, outcome DEPLOYED / ROLLED BACK, previous and new version ids); checks table (step · request · status · cache · rows_read · cpuTime · pass); cache verdict (N-1); total D1 rows read by the checks; boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.C1`.
