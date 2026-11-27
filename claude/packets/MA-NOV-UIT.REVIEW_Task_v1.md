# MA-NOV-UIT.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  Reviewer + Tech Ops — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UIT.REVIEW_Status.json (read-only review)
CONTROL:      claude/packets/MA-NOV-UIT.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-UIT.BUILD_Report.md` | `4a1ff12982d793c383699601b8d79f98f1b39e732d2c6bdb9df16373fc80def1` |
| `App/ETF Refresh/uit/apply/uit-apply-run1.sql` | `720503fcea976b0ea4cc5e3561ed252a8f9ae8fb9046e85467ef274406de15c0` |
| `App/ETF Refresh/uit/apply/uit-rollback-run1.sql` | `12695c51a48548b92c39de0e77ab9df89744f44d460e6420202a6417b9de739e` |
| `App/ETF Refresh/uit/apply/uit-summary.json` | `8f94b0e6450f3551c0433f93ac1c44c2e870ce2bd24690359986ee87a73d8f43` |

## Steps
1. Pins; tests (11) and the dry run in scratch.
2. Q1 with your own XML parse (not `storeHoldings`); Q2–Q3 by reading the SQL and summary; Q4 by reading `holdings-pipeline.js` and grepping readers of `has_nport`/`coverage_status`/`coverage_depth`; Q5–Q6 with ≤ 20 read-only D1 statements.
3. Report `claude/packets/MA-NOV-UIT.REVIEW_Report.md`: header (verdict, reads); findings table; Q1–Q6; **apply procedure for UIT.APPLY** (preflight, headroom, batch-by-batch with vectors, verify queries, rollback triggers and order); boundaries. Commit "MA-NOV-UIT.REVIEW: independent review (read-only)"; push; `end`.
