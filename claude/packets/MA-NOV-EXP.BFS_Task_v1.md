# MA-NOV-EXP.BFS — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-20
EXECUTED BY:  Entities Product Lead + Architect + Tech Ops — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.BF1_Report.md` | `1f209939a4439fd730b86fe8731d27d6c3ee8b669cbadfbf231dbdaf17c31263` |
| `claude/MA-OCT-000_Job_Manifest.md` | `f56ba53eb53bb985e08c5e37468a0fbbb6155a1a265ff9ec6e8e8f42c010dafc` |

## Addendum — `claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md`
1. **Goal and scope:** back-fill 2026-04 … 2026-08 for every holder, then keep `entity_exposure_monthly` / `fund_exposure_coverage` current after each holdings cycle (D5). Months ≤ 2026-03 untouched (December re-compute stays separate).
2. **Where it runs:** which `meridian-entities-enrich` firing(s) (06:00 / 06:50), how the minute dispatcher routes to it, and how it coexists with the existing phases (CPU, subrequests — D1 calls per invocation on Workers Free, wall time).
3. **Batch unit:** `(report_month, holder batch)` using the BF1 SQL with a holder-range parameter; batch size from the measured slice so one invocation stays < 50k rows read and within a stated row-write figure; order (oldest month first); idempotency (`INSERT OR IGNORE`); progress tracked by existing rows (a holder-month is done when its coverage row exists) — no new table.
4. **Daily write guard:** source of today's write total (read-only use of existing counters, incl. ETF-domain `holdings_pipeline_state` read-only, or another source), the job's own daily cap, skip days (Sun, Mon), and behaviour when the day is already high. Show the arithmetic against the 100k shared cap for each weekday.
5. **Controls:** on/off without a deploy (use an existing flag mechanism if one exists — say which; if none exists without a new table, state the options for the Founder), respect `hold_all_jobs` or equivalent, status for the Tower (which months/holders done), heartbeat/log line, run token per batch, rollback by token.
6. **Recurring mode:** after the back-fill, what triggers a refresh (new complete holdings month for a fund), and how it avoids re-work.
7. **Completion estimate:** total row-writes (≈450k per BF1 or better), batches per day, finish date if deployed by Wed 25 Nov.
8. **Acceptance tests** for build and for the first live runs.

## Change request — `claude/specs/MA-NOV-EXP_BF_Change_Request.md`
Per `/change-request`: change, reason, components (Worker, tables, cron unchanged), impact analysis (writes per day by weekday, reads, CPU, other jobs), **three-point check** (index audit with plans; single-execution read test < 50k measured on the slice; documented read/write budget per invocation), risks, rollback (redeploy previous version id; on/off control; delete by token), approvals needed (Founder: CR + deploy), monitoring.

## Report — `claude/packets/MA-NOV-EXP.BFS_Report.md`
Header; 1 Summary with the decisions the Founder must make (numbered, each with a recommendation); 2 Measurements (SQL, plan lines, rows_read, projected writes); 3 Build/review/deploy plan with sizes; 4 Boundaries kept (incl. total rows read). Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS`.
