# MA-NOV-UI.POLISH — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UI.POLISH_Status.json
CONTROL:      claude/packets/MA-NOV-UI.POLISH_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `claude/packets/MA-NOV-UI.HOME.BUILD_Report.md` | `969c2962f7c91ff1ae97a8f6f6b034ae191ae3a0cb6c7082711f35a4abc42caa` |
| `App/ma-entities.js` at HEAD (blob) | `c975279effeeaa7aa6f0bb8301d447e6e44185f0` |
| `App/index.html` at HEAD (blob) | `982f67892724b63f69a7aa33caf19ed9be1d5fb4` |

## Work
1. Apply spec §3.1, §3.2, §3.3 exactly; update `exp-ui.test.mjs` label expectations; banned-word check still passes.
2. N-7 if the picker's loaded `/api/etf-list` gives the counts; otherwise the fallback wording in §3.3 or leave as is with a reason.
3. Header search width > 900 px (CSS only); check 1280 and 1024 px that every tile is visible; update `home-entry.test.mjs` only if a string check needs it.
4. Preview: `#/exposure?i=ETF:VXUS:50,ETF:EEM:50` (What we couldn't analyse; Older data chip) and the example link; header at 1280 / 1024.
5. Suites; commit "MA-NOV-UI.POLISH: exposure screen wording and contrast; header search width" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-UI.POLISH_Report.md`
Header; 1 Before/after text (Gaps panel, chips); 2 Header search before/after; 3 Tests; 4 Deviations; 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-UI.POLISH`.
