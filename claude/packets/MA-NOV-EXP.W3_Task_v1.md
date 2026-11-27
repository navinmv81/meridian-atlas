# MA-NOV-EXP.W3 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W3_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W3_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W2_Report.md` | `ca65b4d9506e4439b91fbed17fbb1d825a11aa299365ae3dadf5d01d82d53f0b` |
| `App/ma-entities.js` at HEAD (git blob) | `41e9edc3064e98468524d9b6bd64901c80c01560` |
| `App/index.html` at HEAD (git blob) | `70b0ad39392a8d74c02676cb043f73c7e0908b36` |

## Work
1. **Read** spec §2, §5.1, §6, §7 (UI state list) and the existing nav-layer code in `ma-entities.js` (`_navOpen`, `_navParseFrom`, entity page) and the app's CSS variables; match the main product's look (no new palette).
2. **Route `#/exposure`** as a nav layer; inputs only in the hash (`#/exposure?i=ETF:EEM:50,EQ:2191:15`); parse and serialise round-trip; ≤ 10 inputs.
3. **Screen A:** ETF picker (`/api/etf-list`, support badge), company picker (`/api/entities/search`), rows with allocation/edit/remove, running total with status, duplicate block + Combine. Validation via `exp_validate`.
4. **Screen B §1–8:** header strip with one date chip per ETF and mixed/stale warnings; reconciliation bar (all lines, sum 100.00); companies table (sorted by combined %, sortable, confidence badge, "hide low-confidence" display filter with a visible moved-rows line); shared exposure + pairwise overlap labelled **"by company"**; contribution drill-down; gaps (unmapped top, unsupported with reasons incl. *too large for live look-through* for 422 `rows`/`size`, load errors with retry); compare with previous stored month (fetch `?month=` only on toggle); evidence links per §6 with the exact labels; company link `#/entity/{id}?from=exposure:{hash}` and Back returning to the result.
5. **States:** empty, invalid, loading (per-input), unsupported, partial failure, total failure, stale/mixed, no previous month, mobile ≤ 600 px; keyboard focus order.
6. **Fetching:** one look-through per ETF per session (in-memory map); never send unsupported inputs again; no storage.
7. **Entry link:** one link in `index.html` (e.g. in the Corporate Atlas area or nav) to `#/exposure` — nothing else in `index.html`.
8. **Tests** `App/Corporate Atlas/tests/exp-ui.test.mjs`: hash parse/serialise round-trip and rejects; state selection from route outcomes; label text contains none of the banned words.
9. **Preview check** (≤ 25 look-throughs): EEM 60 + direct company 15 (direct + indirect, unallocated 25); VXUS 50 + EEM 50 (VXUS unsupported: too large); SPY 40 + EEM 60 (unsupported: no holdings); EEM 30 + EEM 20 (duplicate → Combine); 60 + 50 (over-allocated); compare toggle on EEM; Back from a company page; 375 px. Screenshots if a tool exists; otherwise a precise observed-results list.
10. **Commit** "MA-NOV-EXP.W3: exposure-to-company screen (#/exposure)" (explicit paths), push, `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W3_Report.md`
Header (packet, run, commit, outcome); 1 Summary; 2 What was built (functions, hooks, lines); 3 Preview results per scenario (with screenshot paths or observations); 4 Tests; 5 Deviations / spec gaps; 6 UAT checklist for the Founder (W7); 7 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W3`.
