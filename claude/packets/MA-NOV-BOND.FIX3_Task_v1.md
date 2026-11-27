# MA-NOV-BOND.FIX3 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.FIX3_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.FIX3_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/packets/MA-NOV-BOND.REVIEW_Report.md` | `d9a78f44139721cfdd5fff944b5af116ed6a8ae35125e463f8607feb97931f78` |
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/packets/MA-NOV-BOND.OFFER2_Report.md` | `b9693db02063cb33cbba8d9f21130c343e93996644dd9ab42b82a420e0db2002` |
| `App/Corporate Atlas/bonds/bonds-offering.mjs` at HEAD (blob) | `807d2737b8b4736b0a4398b90a3fe8a33e67f67f` |

## Work
1. Fix F1 (rate-type scoping), F2 (qualified party groups → tranche rows), F8, F9 with a fixture + test each (AbbVie 0001104659-26-020619 and the second AbbVie filing, Amazon 26-027669, a Toyota floating note, Oracle, AmEx).
2. Withhold `use_of_proceeds`, `proceeds_total`, the selling-restrictions place list (section link stays) from the rebuilt SQL; one exported constant listing withheld fields (for the UI).
3. Record the canonical results-only before-hash method in `apply/` and compute today's value.
4. Rebuild the offering SQL (runs ≤ 8,000); local rehearsal: CR2 → runs → counts → rollback → byte-for-byte.
5. Re-check: every row that changed vs `01c5379`'s SQL, plus both AbbVie filings and Amazon in full, against the cached source; restate the 20-filing gate table (shown fields ≥ 95%; 0 blocking rows).
6. Tests (all bond suites); commit "MA-NOV-BOND.FIX3: offering tranche scoping, party qualifiers, withheld fields; SQL rebuilt (not run), rehearsed, re-checked" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.FIX3_Report.md`
Header; 1 Fixes; 2 Withheld fields; 3 Rehearsal; 4 Re-check + restated gate table; 5 New row counts per run; 6 Tests; 7 Deviations; 8 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.FIX3`.
