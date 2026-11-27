# MA-NOV-BOND.FIX2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.FIX2_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.FIX2_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_Spec.md` (v1) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `claude/packets/MA-NOV-BOND.FIX1_Report.md` | `b8027ac47f78dd3bde961d5707690fccea542059804c281db653b049819528c0` |
| `App/Corporate Atlas/bonds/bonds-parse.mjs` at HEAD (blob) | `89db5207a09faefd33d6c323cb7248aea06501eb` |

## Work
1. **F6 diagnosis:** group the 354 no-CUSIP finals by their same-deal FWP layout (offline); table of layouts × counts; implement the layouts that cover most; also capture pricing date and banks where the FWP labels them (spec v2 §3–4) into the parsed record (not yet written).
2. **F5:** decide each of the 3 rows per spec; fixture + test.
3. **F2b:** subset-tranche draft → final link with the note; fixture (ICE pair) + test.
4. **Offline whole-corpus dry run** (full linking set): before = D1 today (≤ 6 SELECTs), after = 1.3.x; counts per class/reason; every changed row listed in a committed diff file; T5 check (0 unexplained changes to finals); T1–T4 restated with arithmetic (T3 = share of in-scope finals with CUSIP or ISIN).
5. **Apply SQL + rollback SQL** in `App/Corporate Atlas/bonds/apply/`: CR1 columns assumed (`status_reason`, `superseded_by`); guarded INSERT/DELETE pairs where a filing changes between final tranches and a seq-0 row (R-4 pattern); `INSERT OR IGNORE`/guarded `UPDATE` only; expected row counts per statement; split into runs of ≤ 8,000 writes. **Not run.**
6. Commit "MA-NOV-BOND.FIX2: term-sheet identifiers, FWP conflicts, dropped-tranche drafts; offline dry run; apply + rollback SQL (not run)" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.FIX2_Report.md`
Header; 1 Changes; 2 F6 layout table; 3 Tests; 4 Dry-run before/after + T1–T5; 5 Apply/rollback SQL summary (files, statements, expected writes, runs); 6 Deviations; 7 Notes for CR1/CR2 and OFFER1; 8 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.FIX2`.
