# MA-NOV-UI.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Architect + UX reviewer + Tech Ops — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UI.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-UI.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `claude/packets/MA-NOV-UI.HOME.BUILD_Task_v1.md` (card wording) | `55f87ca38e3f2424198e3b40e819e26c55ed21d18267f7e9eca23eb1857e8616` |
| `claude/packets/MA-NOV-UI.OPS.BUILD_Report.md` | `0235c2fb2ccab0a2c0693b4620f10cd219b38517428b1640cbd4d938006e60fb` |
| `claude/packets/MA-NOV-UI.HOME.BUILD_Report.md` | `969c2962f7c91ff1ae97a8f6f6b034ae191ae3a0cb6c7082711f35a4abc42caa` |
| `claude/packets/MA-NOV-UI.POLISH_Report.md` | `34d07f6b90161a9fa6220b43b22b07379702f3cb1a5cdefad4e74ec5aeb3497d` |

## Checks
1. **Scope per commit:** files touched match each Control; no route, Worker, table or `docs/` change; OPS-05 (no record/route deletion).
2. **Ops:** O-1–O-10 rerun; harness at 1280/800/375 vs the main product (same surfaces, accent, tables, chips); Cases/DQ drawer, keyboard, escape; states; judge the 7 deviations — especially D2 (docs-mirror test downgraded to INFO: what REL.GO must restore).
3. **Homepage:** card wording verbatim (Task); layout A (top of right column on desktop; after the banner on phones; no duplicate ids; `#right{display:contents}` accessibility side effect); company search (escaping, debounce, ≤ 8, states, no storage); example link; H-1–H-10; market/news cards unchanged; DELAYED; judge the 7 deviations.
4. **Polish:** §3.1–3.3 strings verbatim; `.exp-dim` contrast ≥ 4.5:1; header search widths at 1280/1024/901/800; no header overflow at any width; judge the 5 deviations.
5. **Whole page at 1280 / 1024 / 800 / 375:** no sideways scroll; focus ring visible; tab order sensible.
6. **Banned wording** ("current ownership", "all holders", "complete", "real-time", "LIVE") absent from new/changed UI text.
7. **Release readiness:** list what REL.CR must include: Pages source switch `October-2026` → `November-2026` `/docs`; `generate-docs.mjs` + `.nojekyll`; **script version stamps** (CARRY 21 Nov: browsers mixed a new `index.html` with an old `ma-search.js`); restoring the docs-mirror test; post-release checks of the live Ops console (it loads `ma-ops.js` from Pages); rollback.

## Report — `claude/packets/MA-NOV-UI.REVIEW_Report.md`
Four-line header; verdict; findings table (id · B/M/N · item · evidence · fix); deviation judgements per build; **recommendation: may these go to Founder UAT and the release (yes / yes with conditions / no)**; **REL.CR must-carry list**; look-throughs/searches used; your session id; under ~1,000 words. Then `end` and stop.
