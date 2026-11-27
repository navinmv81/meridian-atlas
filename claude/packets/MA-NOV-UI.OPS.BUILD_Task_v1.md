# MA-NOV-UI.OPS.BUILD — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UI.OPS.BUILD_Status.json
CONTROL:      claude/packets/MA-NOV-UI.OPS.BUILD_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `App/ma-ops.js` at HEAD (blob) | `7ac34b4bf90a8bceded7fb9bf75152a3632c76c6` |

## Work (spec §1)
1. **Tabs (§1.2):** console tabs exactly System Health · Cases · DQ Tickets · Drift & Budget; Cases selected on open; Events, Sprint Board, Release Ledger removed from the front end (their loaders never called); routes/tables untouched.
2. **Content (UD-2, UD-4):** drop the "Deployment Drift" panel from Drift & Budget; remove the static "Worker Status" table and the `CHECK_DASHBOARD` placeholder from System Health.
3. **Style (§1.5):** one injected `ops-theme` style block with the main product's tokens (values equal `App/index.html` `:root`), classes for tables, forms, buttons, chips, tabs; remove `OPS_COLORS` and hex/rgba colours outside the block; `style=` ≤ 30; system-font fallback (UD-5).
4. **States (§1.6), desktop/mobile (§1.7), focus:** exact texts from the spec; tab bar scrolls at 375; no sideways page scroll; visible focus ring.
5. **Tests O-1–O-10:** update `ops-a.test.mjs`, keep `ops-console.test.mjs` checks passing (list any changed expectation + reason).
6. **Harness (§1.9):** `App/Ops/tests/preview/console-preview.html` + `fixtures.js` (fixture responses only, incl. empty, 500, signed-out, offline). Screens at 1280/800/375; compare by eye with the main product (O-V).
7. Suites; commit "MA-NOV-UI.OPS.BUILD: Ops console — four tabs, main-product styling, states, preview harness" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-UI.OPS.BUILD_Report.md`
Header; 1 What changed (functions/lines; `style=` count; hex count); 2 Tests (O-1–O-10, existing suites); 3 Harness observations per tab and width; 4 Deviations; 5 Founder UAT checklist for the harness (how to open it: one Terminal line); 6 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-UI.OPS.BUILD`.
