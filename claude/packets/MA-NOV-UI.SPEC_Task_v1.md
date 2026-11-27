# MA-NOV-UI.SPEC — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  UX Lead + Operations Lead + Architect — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UI.SPEC_Status.json
CONTROL:      claude/packets/MA-NOV-UI.SPEC_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| `claude/packets/MA-NOV-SA1_Report.md` | `419e433726fa37275dff4ef8cea49d362cae3746eacd56d7a5024bf612ab3aea` |
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |

## Decisions already taken
Keep the **Drift & Budget** tab (NML-1110-6). Remove Events, Sprint Board, Release Ledger tabs **front end only**; routes, tables and history stay (OPS-05); the Control Tower is the delivery view (OPS-06). Homepage: proposition + two routes (exposure analysis `#/exposure`, company research), existing market/news cards kept; continuation / recently viewed / what-changed are **out** for November. Exposure UAT passed; the EXP entry link exists in the header.

## The spec — `claude/specs/MA-NOV-UI_Spec.md`
1. **OPS:** current tabs and routes (evidence); removal plan for the three tabs (no record loss; any public GET routes left unguarded? — SA1 carry-over "public Ops GET routes (Access)"); style alignment to the main product (CSS variables instead of `OPS_COLORS` and inline styles; tables, forms, status chips); loading/empty/error/selected/focus states; desktop/mobile; regression checks per retained tab (System Health, Cases, DQ, Drift & Budget).
2. **HOME:** layout (proposition block, exposure entry with an example portfolio link, company search entry, then existing market/news); **exact copy** for every new line (plain language, concrete, no "real-time"/"complete"/"current ownership"); dates/coverage labels (HOME-06); navigation coherence with `#/exposure` and company pages (HOME-04); states and mobile (HOME-07); HOME-07 phone-width button row (carry 12).
3. **Polish carried into the release:** EXP Gaps panel wording, `.exp-dim` contrast, any jargon left on the EXP screen.
4. **November release plan:** release CR outline (Pages source `October-2026` → `November-2026` `/docs`; `node generate-docs.mjs`; `.nojekyll`; byte-identical check of the 11 files; rollback = switch Pages back to `October-2026`; cache max-age note); what is in the release (EXP screen, OPS, HOME, polish); the Worker side is already live.
5. **Acceptance tests** for OPS and HOME (functional regression + visual match + states), and the final demo script for Mon 30 (Ops tabs → exposure journey → homepage; BOND-01 only if done).
6. **Work units** dependency-ordered and sized (S/M) to fit Mon 23 – Thu 26 with one worker and ~1 Founder checkpoint/day; release Fri 27 – Sat 28. If it does not fit, say what to cut.
7. **Open decisions for the Founder**, numbered, each with a recommendation.

## Report — `claude/packets/MA-NOV-UI.SPEC_Report.md`
Header; 1 Summary + decisions; 2 Evidence (files, lines, screenshots taken); 3 Deviations/gaps; 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-UI.SPEC`.
