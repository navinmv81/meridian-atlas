# MA-NOV-EXP.BF1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Data-Identity Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BF1_Status.json (= one day's production write approval, ≤ 50,000 row-writes)
CONTROL:      claude/packets/MA-NOV-EXP.BF1_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1R5_Report.md` | `ba0cd9c4765a779065b10a39a1b9733902ec333749d3520baf2218c8a6b5cecd` |
| `claude/packets/MA-NOV-BQ2_Report.md` | `9b133cdea2715d19520d2988ddcc65241c80309c19aae21820a3ef91bdc15102` |

## Steps
1. **Check the day:** `date -u` must be Thursday and before 23:00 for the first write.
2. **Read** spec §3.2, §5.2–5.4; the existing `gate3-exposure.js` (to match column semantics, not to run it); the migrations defining `entity_exposure_monthly` and `fund_exposure_coverage` (columns, PK, indexes); the R-EXP1 SQL in `entities-api.js` (reuse its identity CTE so EXP and the company page agree).
3. **Write** `App/Corporate Atlas/gate3v2/gate3v2-month.sql.tmpl` (month and run token as the only substitutions), a tiny generator or documented sed command, and `README.md` (how to run, rollback by token, budget rule, Tue/Thu only). Generate `gate3v2-2026-04.sql` … `-08.sql` with token `g3v2-20261119`.
4. **Plan check** each statement shape once (EXPLAIN QUERY PLAN; no SCAN of large tables).
5. **Dry run:** for each month, `SELECT COUNT(*)` of each INSERT's SELECT (exposure rows, coverage rows, holders); also confirm no existing rows for those months (`SELECT COUNT(*) … WHERE report_month = ?` via index). Table of counts.
6. **Commit + push** the gate3v2 folder ("MA-NOV-EXP.BF1: gate3 v2 back-fill SQL (identity rule §3.2)"), `ls-remote`.
7. **Write** month 2026-04: `npx wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/gate3v2/gate3v2-2026-04.sql"`; record `rows_written`, `rows_read`, duration; multiplier = rows_written / inserted rows.
8. **Verify** 2026-04: inserted rows = dry run; coverage rows = holders; PK duplicates none; `computed_at` = token; months ≤ 2026-03 counts unchanged (compare with a pre-write count). Failure → rollback for the token, stop.
9. **Next months** in order while (running rows_written + next month's estimate) ≤ 50,000. Verify each.
10. **Report** what was written and what remains (months, estimates) for Tue 24 Nov.

## Report — `claude/packets/MA-NOV-EXP.BF1_Report.md`
Header (packet, run, commit, run token, outcome); 1 SQL design (identity rule, columns, idempotency); 2 Plans; 3 Dry-run counts (5 months); 4 Writes (month · inserted · rows_written · multiplier · ms · verified); 5 Remaining for the next Tue/Thu; 6 Rollback command; 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BF1`.
