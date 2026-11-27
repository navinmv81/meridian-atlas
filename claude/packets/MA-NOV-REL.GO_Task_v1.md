# MA-NOV-REL.GO — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead + Engineering Lead — interactive, LANE_OPENER_v2.md, Founder present
APPROVED BY:  Founder — Start Approval in MA-NOV-REL.GO_Status.json (= release approval)
CONTROL:      claude/packets/MA-NOV-REL.GO_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` (§4) | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `claude/packets/MA-NOV-UI.REVIEW_Report.md` (must-carry list) | `bec0ce5d313f01417144a4d556f4d93a8c6413f7b7ce09aafd725cd57cfabc6f` |

## Steps
1. **A:** stamps (token `rel-20261122`) on all local script/style references in `App/index.html`; restore the mirror hard check in `ops-a.test.mjs`; dry-run generate + diff (expect `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js` changed vs `docs/` today); generate; `docs/.nojekyll` present; suites (incl. the restored check) green; write `claude/specs/MA-NOV-REL_CR.md`; commit "MA-NOV-REL.GO: November release — exposure screen, Ops cleanup, homepage (docs/ regenerated, script stamps)"; push; `ls-remote`.
2. **B:** ask the Founder: "Please switch GitHub Pages (Settings → Pages) to branch November-2026, folder /docs, and reply 'switched'." Wait.
3. **C:** after ≥ 10 minutes from the push, the checks in the Control; hard-refresh semantics (fetch with `cache-control: no-cache`).
4. Pass → update the CLAUDE.md DEPLOY_BRANCH entry; second commit "MA-NOV-REL.GO: CLAUDE.md DEPLOY_BRANCH → November-2026 /docs"; push. Fail → rollback via the Founder; record.

## Report — `claude/packets/MA-NOV-REL.GO_Report.md`
Header (outcome RELEASED / PREPARED / ROLLED BACK; commits); A results (diff, tests); B (Founder's confirmation time); C checks table; the live Ops console checklist for the Founder; CLAUDE.md change; boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-REL.GO`.
