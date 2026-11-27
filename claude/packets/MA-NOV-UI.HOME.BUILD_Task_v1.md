# MA-NOV-UI.HOME.BUILD — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-UI.HOME.BUILD_Status.json (= approval of the card wording below)
CONTROL:      claude/packets/MA-NOV-UI.HOME.BUILD_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `App/index.html` at HEAD (blob) | `d7a7e5457a8f8a33c68339f5c08a98afad32de00` |
| `App/ma-search.js` at HEAD (blob) | `a0a17f787b1b060438846bf914d261a9e5f7018f` |

## The Research card — exact wording (layout A)
- Card header (`.chdr` style): `Research`
- Lead (13px, `--text`, 600): `See which companies your investments really hold`
- Line (11.5px, `--text2`): `Connects ETF holdings, companies, 13F positions and SEC-registered bonds, so you can follow one company across all of them.`
- Primary button → `#/exposure`: `Analyse my portfolio`
- Link → `#/exposure?i=ETF:IVV:60,ETF:EEM:25,EQ:2191:15`: `See an example: IVV 60%, EEM 25%, Taiwan Semiconductor 15%`
- Sub-heading (11px uppercase, `--text2`): `Company research`
- Input (visually hidden label `Company name`; placeholder `Company name, e.g. Apple`) + button `Search`; results and states exactly as spec §2.5.
- Note (10px, `--muted`): `Built from stored public filings (SEC N-PORT, 13F, EDGAR); fund holdings are usually several months old. Nothing you enter is saved.`

Elsewhere (spec UD-6): header pill `LIVE` → `DELAYED` (neutral colours, no pulse, tooltip `Market prices are delayed and refresh automatically.`); Equity Sectors note `Live ETF view` → `Sector ETFs`.

## Work
1. **Card:** top of `#right` at > 900 px; at ≤ 900 px directly after the market banner and ticker, before the market cards (CSS `order` or an equivalent single-element technique — no duplicate ids). Existing tokens/classes only.
2. **Company search** in `ma-search.js` per §2.5 (shared `data_entitiesGet`, debounce, ≤ 8 results, keyboard, states, escaping, no storage, no import from `ma-entities.js`).
3. **Phone width** per §2.6 (header two rows with a scrollable tile row; `#main` stacks; tables scroll inside cards; focus-visible rules).
4. **UD-6** live-claim changes.
5. **Tests** `App/Corporate Atlas/tests/home-entry.test.mjs`: H-1 (every string above verbatim; banned words absent), H-7 (all market/news card ids still present), H-9; search state logic as node checks where possible.
6. **Preview** H-2–H-10 at 1280 / 800 / 375; run the example (record its live numbers for the demo); company search for "Taiwan Semiconductor" (record the query that finds 2191).
7. Suites; commit "MA-NOV-UI.HOME.BUILD: homepage Research card (layout A), company search, phone width, delayed-data labels" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-UI.HOME.BUILD_Report.md`
Header; 1 What changed; 2 Tests; 3 Preview observations per width (incl. where the card sits on phones); 4 Example numbers; 5 Deviations; 6 Founder UAT checklist (one Terminal line); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-UI.HOME.BUILD`.
