# MA-NOV-UIT.BUILD — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26
EXECUTED BY:  ETF Product Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UIT.BUILD_Status.json (offline build)
CONTROL:      claude/packets/MA-NOV-UIT.BUILD_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-DIAG.HEALTH_Report.md` (§1 SPY evidence and fix) | `ee66f2307c171910003e428927a25ce5bfab462f91c0713a21c0ebc4afcba935` |
| `App/ETF Refresh/src/holdings-pipeline.js` at HEAD | blob recorded in the report before editing |

## Steps
1. Read DIAG §1; record pins. D1 reads: the 4 `etf_master` rows + IVV/VOO; schema of `etf_master`, `fund_holdings_monthly`, `fund_snapshot_monthly` (and any other table `storeHoldings` writes); confirm no `series_id` starting with `C` exists.
2. SEC: submissions JSON for the 4 CIKs → per-fund table (NPORT-P yes/no, seriesId, latest accession + period). Fetch and cache the latest NPORT-P XML for each kept fund.
3. Add `export` to the reused functions; write the recording shim and `uit-nport-load.mjs`; build the rows for one period per fund under the surrogate (or real) id.
4. Write `uit-apply-run1.sql` / `uit-rollback-run1.sql` (batches ≤ 100, vectors, guarded `etf_master` update), summary JSON (rows per table per fund, sha256s).
5. Tests in `App/ETF Refresh/uit/tests/` (shim fidelity vs a direct node:sqlite run of `storeHoldings`, surrogate key, guards, rollback); existing ETF and exposure suites still pass.
6. Dry run (Control §4) on node:sqlite; exposure readiness and cache note (Control §5); three-point check.
7. Commit "MA-NOV-UIT.BUILD: one-off N-PORT load for series-less UITs (script, SQL not run)" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-UIT.BUILD_Report.md`
Header (run, reads, SEC GETs, writes 0); 1 Per-fund confirmation; 2 Script and the one edit to `holdings-pipeline.js`; 3 Apply/rollback SQL (sizes, sha256, batches); 4 Dry run; 5 Exposure readiness (month, mapping coverage, cache, deploy needed?); 6 Three-point check; 7 Tests; 8 Deviations; 9 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-UIT.BUILD`.
