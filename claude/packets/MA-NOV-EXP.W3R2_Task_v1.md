# MA-NOV-EXP.W3R2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W3R2_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W3R2_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md` | `be8ddf80e0cfc32cca42885fa74952a0cdea34d5fe2a92576a0bd4bb8644e8f5` |
| `claude/packets/MA-NOV-EXP.W3_Report.md` | `2cb5aca3271e2b19f41f50df4834bea37cd6bedbddc9d76bb84b0e0ead04c8b4` |
| `App/index.html` at HEAD (blob) | `1a53aec81b42a49fd0bb9a4954123778dfc2e6ea` |
| `App/ma-entities.js` at HEAD (blob) | `8003d0384fbb1f5a607b11465e67c5ce34e0cf01` |

## Work
1. **M-1:** in `index.html`'s hash router, accept `#/exposure` (with its `?i=` query) the way `fi` is accepted and emit `ma:route`; in `ma-entities.js` handle that event to open the exposure layer; remove the pre-router claim, `stopImmediatePropagation` and the two-timer cold-load workaround. Tests: router accepts `#/exposure` and `#/exposure?i=…`; still rejects junk; `#/entity/…` and `#/fi/…` unchanged.
2. **N-3:** remember the clicked company link; on Back to the exposure layer, focus it (fallback: the results heading).
3. **N-4:** EXP headers/small labels → `var(--text2)`.
4. **N-6:** reconciliation label "Companies (direct + via ETFs)".
5. **Preview** (≤ 5 look-throughs): entry link → empty state; cold deep link `#/exposure?i=ETF:EEM:60,EQ:2191:15` (TSMC 22.88, no toast, hash kept); company link → Back → focus on that link; `#/entity/2191` and one `#/fi/…` route still open as before; 375 px glance.
6. Suites; commit "MA-NOV-EXP.W3R2: exposure route in the router; focus, contrast and label fixes" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W3R2_Report.md`
Header (packet, run, commit, outcome); 1 Changes (files, lines); 2 Tests; 3 Preview checks; 4 Deviations; 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W3R2`.
