# MA-NOV-BOND.FIX1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.FIX1_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.FIX1_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_Spec.md` (v1, §4 fixes, §7 tests) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `App/Corporate Atlas/bonds/bonds-parse.mjs` at HEAD (blob) | `09a57db5fc7df207f5b30404b69da33ca53116d9` |

## Work
1. Read spec v1 §1–7 (classes, causes C1–C7, fixes F1–F8, tests) and v2 §0–1; the parser, runner and existing tests.
2. Implement F1, F2, F3, F4, F7, F8 exactly as specified; bump to `bonds-1.3.0`; reason codes from the spec's vocabulary only.
3. One fixture + test per fix (the examples named in the spec's table, from the cache); keep all 52 existing tests passing.
4. Offline measurement on the whole cached corpus with **no writes**: counts per class/reason before (1.2.0) and after (1.3.0); list every row whose class changes; flag any previously-final row that changes (should be 0 — T5).
5. Commit "MA-NOV-BOND.FIX1: parser 1.3.0 — draft gate, deal-level draft match, programme supplements, maturity wording, remarketing, reason codes" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.FIX1_Report.md`
Header; 1 Changes per fix; 2 Tests; 3 Offline before/after table + changed rows + T5 check; 4 Deviations; 5 Notes for FIX2 (F5/F6) and CR1; 6 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.FIX1`.
