# MA-NOV-EXP.BFS.CHECK — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.CHECK_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS.CHECK_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-EXP.BFS.GO_Report.md` | `6d49490683d1ab7d4c1ff1ce0bf7cdab27e3a668cd0bab13795a59a91e64e293` |

## Steps
1. `deployments list` → active version `aa39edf6…`.
2. Read the Ops events for job ids `cf.meridian-entities-enrich.phase1` and `cf.meridian-entities-enrich.expbf` since 2026-11-21T08:25Z (deploy time): start/end, event type, reason, metrics.
3. `ops_job_pause` row for expbf: still open (`ends_at` 2099).
4. Token check: count of rows with `computed_at LIKE 'g3v2s-%'` in both exposure tables (index-friendly form or a bounded check) = 0.
5. 06:50 firing: phase 2/3 heartbeat as usual.
6. Verdict line + evidence table + the switch-on SQL (copied from the GO report).

## Report — `claude/packets/MA-NOV-EXP.BFS.CHECK_Report.md`
Header; verdict; evidence (SQL · rows · result); switch-on SQL; boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS.CHECK`.
