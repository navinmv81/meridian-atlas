# MA-NOV-EXP.BFS.ON — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.BFS.ON_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.BFS.ON_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-EXP.BFS.GO_Report.md` | `6d49490683d1ab7d4c1ff1ce0bf7cdab27e3a668cd0bab13795a59a91e64e293` |
| `claude/packets/MA-NOV-EXP.BFS.CHECK_Report.md` | `c084d7776182a16e146974dc1bcba5efa5ce747efa68841f583987fca6aa587f` |

## Steps
1. SELECT: the expbf pause row is open (`ends_at` 2099).
2. Write `App/Ops/migrations/switch-on-2026-11-22-expbf.sql` from the GO report's switch-on SQL; payload `{"packet":"MA-NOV-EXP.BFS.ON","founder_words":"<as recorded in the Status>","pause_id":3}`.
3. Commit ("MA-NOV-EXP.BFS.ON: switch on the exposure back-fill (end pause row)") + push; then run the file once.
4. Verify (≤ 3 SELECTs): pause row `ends_at` ≤ now; no open pause for the job; case event present.
5. Report: rows changed, verification, **switch-off SQL** (from the GO report), first expected run (Tue 24 Nov 06:00Z unless the budget guard skips it).

## Report — `claude/packets/MA-NOV-EXP.BFS.ON_Report.md`
Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.BFS.ON`.
