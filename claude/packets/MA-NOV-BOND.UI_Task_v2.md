# MA-NOV-BOND.UI — Task v2

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-25
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.UI_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.UI_Control_v2.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec.md` (v1 §5) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `claude/specs/MA-NOV-BOND_Spec_v2.md` (§10) | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_CR.md` | `3885c9999da6f9736fa7e5db6273b7e2ec2aa92c62da1a2a3f7d9a1a80b12b5b` |
| `App/Corporate Atlas/src/entities-api.js` at HEAD (blob) | `47f40c890919621a1b60e3aa7441999dbde514f3` |
| `App/ma-entities.js` at HEAD (blob) | `0087575c1da98e89c20034baea3c19541b9f767e` |
| `claude/packets/MA-NOV-BOND.FIX3_Report.md` (§2 withheld fields) | `25ec89145722dec32bb86e7867c0cbe942dafa6ea7479ec857b2417f6a810ff1` |
| `claude/packets/MA-NOV-BOND.APPLY_Report.md` | as recorded in `MA-NOV-BOND.APPLY_Status.json` (`main_lane_verification.report_sha256`) |

## Work
1. API per Control (F1 counts, F2 detail incl. the CR1 fields and `offering`, F5 list); bound parameters; read budget per call; tests on a local SQLite fixture.
2. Screen per spec v2 §10 and v1 §5; `WITHHELD_FIELDS` from `bonds-offering.mjs`; tests (labels verbatim, states, no banned words, escaping).
3. Local preview (Control v2): read the live bond tables, apply locally only the SQL the live state lacks, `wrangler dev --local`, serve `App/` pointed at it; the four demo scenarios; 1280 / 375 px.
4. D-CR3: plan + rows read for the issuer counts with and without the index (local), recommendation.
5. Suites; commit "MA-NOV-BOND.UI: bond visibility, Offering details, Who's involved (API + screen; not deployed)" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.UI_Report.md`
Header; 1 Changes (routes, response fields, UI functions); 2 Tests; 3 Preview observations per scenario and width; 4 D-CR3; 5 Deviations; 6 Release notes for the go-live packet (deploy command, version capture, live checks); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.UI`.
