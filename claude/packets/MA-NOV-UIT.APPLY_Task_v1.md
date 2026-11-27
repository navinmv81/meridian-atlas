# MA-NOV-UIT.APPLY — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  ETF Product Lead + Tech Ops — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UIT.APPLY_Status.json (= the production D1 writes)
CONTROL:      claude/packets/MA-NOV-UIT.APPLY_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-UIT.REVIEW_Report.md` (§8 procedure) | `bc9a38b82cfb2cc8e55f1e88e116ba3a3bf1c0d5b610becd4f4cc815daa7aa58` |
| `claude/packets/MA-NOV-UIT.BUILD_Report.md` | `4a1ff12982d793c383699601b8d79f98f1b39e732d2c6bdb9df16373fc80def1` |
| `App/ETF Refresh/uit/apply/uit-apply-run1.sql` | `720503fcea976b0ea4cc5e3561ed252a8f9ae8fb9046e85467ef274406de15c0` |
| `App/ETF Refresh/uit/apply/uit-rollback-run1.sql` | `12695c51a48548b92c39de0e77ab9df89744f44d460e6420202a6417b9de739e` |
| `App/ETF Refresh/uit/apply/uit-summary.json` | `8f94b0e6450f3551c0433f93ac1c44c2e870ce2bd24690359986ee87a73d8f43` |

## Steps
1. Preflight: pins, HEAD = origin, `whoami`, UIT tests 11/11, time rule (Control), expbf ended today, REVIEW §8.1 step 4 (two statements), d1-today ≤ 45,000.
2. Batches 1–14 per REVIEW §8.2; stop on the first mismatch.
3. Verify per REVIEW §8.3 after batches 6, 8, 9, 14, then the final checks; d1-today after.
4. Any trigger → REVIEW §8.4/§8.5; record.
5. Report `claude/packets/MA-NOV-UIT.APPLY_Report.md` (outcome DONE / PARTIAL / ROLLED_BACK); commit "MA-NOV-UIT.APPLY: UIT holdings written to D1 — report"; push; `ls-remote`; `node tools/factory/dispatch.mjs end MA-NOV-UIT.APPLY`.
