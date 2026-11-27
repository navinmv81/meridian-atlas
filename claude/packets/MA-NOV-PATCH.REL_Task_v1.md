# MA-NOV-PATCH.REL — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  Operations Lead + Engineering Lead — interactive, LANE_OPENER_v2.md, Founder present
APPROVED BY:  Founder — Start Approval in MA-NOV-PATCH.REL_Status.json (= release approval)
CONTROL:      claude/packets/MA-NOV-PATCH.REL_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/packets/MA-NOV-UIT.REVIEW_Report.md` (F4, F5) | `bc9a38b82cfb2cc8e55f1e88e116ba3a3bf1c0d5b610becd4f4cc815daa7aa58` |
| `claude/packets/MA-NOV-UIT.APPLY_Report.md` | `f66dd7c4bd1ffa3f448af7c636d7c826656a72e21303eba6fe5dc8780b339fbf` |
| `claude/packets/MA-NOV-DIAG.HEALTH_Report.md` (§3.3, §3.5) | `ee66f2307c171910003e428927a25ce5bfab462f91c0713a21c0ebc4afcba935` |
| `claude/packets/MA-NOV-REL.GO_Report.md` (release method) | as committed at `bb3815b` |

## Steps
1. **A:** the four edits; tests; dry-run (now outside the repo) + diff; generate; commit "MA-NOV-PATCH.REL: UIT funds on screen, trust wording, dry-run outside repo, stamps rel-20261127" (explicit paths); push; `ls-remote`.
2. **B:** three-point check (no D1 reads/writes added; removing a trigger only reduces load); `deployments list -c "App/ETF Refresh/wrangler-bootstrap.toml"` → capture; edit toml; deploy; confirm no schedule; commit with step 5.
3. **C:** live checks per Control (≥ 10 min after the push).
4. **D:** ask the Founder "OK to remove the dead financial-facts LaunchAgent now?"; on yes, bootout + move plist + `launchctl list` check.
5. CLAUDE.md two lines; second commit "MA-NOV-PATCH.REL: bootstrap cron off, CLAUDE.md, report"; push.

## Report — `claude/packets/MA-NOV-PATCH.REL_Report.md`
Header (outcome; commits; bootstrap previous → new version); A diff + tests; B three-point check + deploy output; C checks table; D result; CLAUDE.md lines; rollback commands per part; boundaries. Then `node tools/factory/dispatch.mjs end MA-NOV-PATCH.REL`.
