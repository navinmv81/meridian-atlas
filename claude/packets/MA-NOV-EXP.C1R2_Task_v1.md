# MA-NOV-EXP.C1R2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.C1R2_Status.json (= production deploy approval)
CONTROL:      claude/packets/MA-NOV-EXP.C1R2_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-EXP.W1R3.REVIEW_Report.md` | `a6f0d6fb6c591f02febf32d9017f22ceec87cacecca26842c61a30662f3cbccb` |

## Steps (C = `-c "App/Corporate Atlas/wrangler-entities-api.toml"`)
1. **Pre-checks:** `git rev-parse HEAD` = `c5d0cad…` = `git ls-remote origin November-2026`; `git --no-optional-locks diff --quiet HEAD -- "App/Corporate Atlas"`; `npx wrangler whoami` shows OAuth.
2. **Capture:** `npx wrangler deployments list C` — current version must be `4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b`; record it.
3. **Deploy:** `npx wrangler deploy C` — record the new version id and the workers.dev URL.
4. **Tail:** `npx wrangler tail C --format json` in the background to a scratch file; wait until it is connected before step 5.
5. **Checks** (`curl -sS -D -`; record status, `x-exp-cache`, body bytes, and from the tail: outcome, cpuTime, `exp_lookthrough` rows_read):
   a. `/api/exposure/etf/EEM` — **first request after deploy**; 200; rows_read ≈ 5,775 (±10%); body: 1,003 entities, TSMC 13.141305.
   b. `/api/exposure/etf/EEM` again — `x-exp-cache: hit`; body bytes identical to (a) (compare sha256).
   c. `/api/exposure/etf/SPAB`, `/api/exposure/etf/BNDX` — 200; rows_read ≤ 50,000.
   d. `/api/exposure/etf/VXUS` — 422 `too_large`, `limit:"size"` (pass); record its cpuTime (this is the new fixed cost with a full look-through in D1); repeat → hit, 422.
   e. `/api/exposure/etf/MBB`, `BND`, `AGG` — 422 `too_large`, `limit:"rows"`; rows_read ≈ 14.
   f. `/api/exposure/etf/SPY` — 404 `no_holdings`; `/api/exposure/etf/%27%20OR%201=1` — 400.
   g. Regression: `/api/entities/10/etf-exposure` — 200 with `funds`, `months_min`, `months_max`; `/api/entities/search?q=pepsico` — 200, non-empty.
6. Stop the tail. **Rollback** on any Control trigger: `npx wrangler rollback 4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b C -m "MA-NOV-EXP.C1R2 rollback: <reason>"`, then confirm (a) returns 404 and (g) 200.

## Report — `claude/packets/MA-NOV-EXP.C1R2_Report.md`
Header (packet, run, outcome DEPLOYED / ROLLED BACK, previous and new version ids, commit); checks table (step · request · status · cache · rows_read · cpuTime · body bytes · pass); CPU summary (new fixed cost from VXUS refusal; EEM cold; SPAB/BNDX) with a one-line view on whether a size-cap raise to ~400 KiB looks feasible; boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.C1R2`.
