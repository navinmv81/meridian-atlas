# MA-NOV-DIAG.HEALTH — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26
EXECUTED BY:  Operations Lead + Data-Identity Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-DIAG.HEALTH_Status.json (read-only)
CONTROL:      claude/packets/MA-NOV-DIAG.HEALTH_Control_v1.md
```

## Pins
| File | Use |
|---|---|
| `claude/MA-OCT-000_Job_Manifest.md` | baseline job list (compare; note new/removed jobs) |
| `claude/packets/MA-NOV-REL.GO_Report.md` | finding 1 (SPY 404) |

## Steps
1. **SPY (≤ 6 SELECTs):** `etf_master` (and `etf_aliases`) row for SPY: series id, CIK, status; `fund_snapshot_monthly` by series id (indexed) if any; the same columns for IVV and VOO as controls; count of `etf_master` rows with no series id, and the 10 largest by any size column available. SEC: confirm SPY's registrant type and whether it files N-PORT. Conclude: data gap vs structural (UIT) vs pipeline bug; recommended fix.
2. **Registry + ledger (≤ 10 SELECTs):** all `ops_job_registry` rows; per job the last 3 `ops_job_run` rows (by indexed `job_id`, `ORDER BY event_id DESC LIMIT 3`); open `ops_job_pause` rows; `holdings_pipeline_state` keys for last-run markers (`*_last_run*`, `hold_all_jobs`).
3. **Cloudflare:** cron triggers per Worker and last-deployed version (read-only listings); 5/5 slot use.
4. **Local agents:** `launchctl list` (exit codes), plist schedules, last lines of each agent's log (no secrets).
5. **Verdicts** per job; compare with MA-OCT-000; list what changed since September (e.g. health-check / financialfact still SILENT? FIRDS code 10000? entities-seed now Monday?).
6. Report; commit "MA-NOV-DIAG.HEALTH: SPY cause + job health (read-only)"; push; `end`.

## Report — `claude/packets/MA-NOV-DIAG.HEALTH_Report.md`
Header (run, reads, writes 0); 1 SPY; 2 Job health table; 3 Problems and suggested next steps (ranked); 4 Changes since MA-OCT-000; 5 Boundaries kept.
