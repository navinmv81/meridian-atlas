# MA-NOV-DIAG.HEALTH — Read-only: why SPY has no exposure data + health of every scheduled job — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26
EXECUTED BY:  Operations Lead + Data-Identity Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane
APPROVED BY:  Founder — Start Approval (read-only diagnosis; no fixes)
PACKET:       MA-NOV-DIAG.HEALTH · Control v1 · usage class small · write owner Operations Lead
```

## What
1. **SPY:** `/api/exposure/etf/SPY` returns 404 `no_holdings / no_series_id` (REL.GO finding 1). Find why: is SPY in the ETF universe, does it have an N-PORT series id, is it a UIT (SPDR S&P 500 ETF Trust files N-CSR/no N-PORT?), and which other large ETFs share the gap. Recommend the fix and its owner; do not fix.
2. **Job health:** every scheduled job — every `ops_job_registry` row, the 5 Cloudflare crons, and every local LaunchAgent (FIRDS weekly seed, enrich boost, health check, financialfact back-fill, any GLEIF/gleif-reconcile job, any other `com.meridian*` agent). For each: schedule, last 3 runs (time, outcome, rows read/written, error), pause state, and a verdict **OK / LATE / FAILING / SILENT / RETIRED**. Compare with the MA-OCT-000 job manifest.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). D1 from the repo root with `--remote`, no `-c`. Code 10000: retry once after `whoami`. Writable (checked by `end`): `claude/packets/MA-NOV-DIAG.HEALTH_Report.md` only. `allow_commits: true` (report only); may push `November-2026`.

## Allowed actions
`whoami`; read-only git; reading repo files and local logs (`App/**/logs/`, `13F Seed/*log*`, `~/Library/LaunchAgents/com.meridian*` plists — names and schedules only, never env values); `launchctl list | grep -i meridian` and `launchctl print gui/$(id -u)/<label>` (read-only); `wrangler deployments list -c …` / `wrangler triggers` read-only listings; read-only D1 SELECTs (≤ 25 statements, ≤ 150,000 rows read in total; indexed or small tables only — **no full scan of `fund_holdings_monthly`, no PRAGMA integrity checks**); GETs to the public `meridian-entities-api` routes; up to 3 read-only GETs to SEC EDGAR (with the repo's existing User-Agent) to confirm SPY's filing type; write the report; one commit; push.

## Prohibited actions
Any fix: D1 writes, job runs or `/run` calls, `launchctl load/unload/kickstart`, pause/resume scripts, deploys, cron/toml/secret changes; editing any file but the report; printing tokens or `.env` values; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js` (do not open it).

## Stop gates
A read would exceed the budget; any step would need a write.

## Success conditions
Report with: SPY cause + evidence + recommended fix (owner, packet size); a job health table (one row per job) with verdicts; anything FAILING/SILENT with its last error and a one-line suggested next step; reads used; `end`.
