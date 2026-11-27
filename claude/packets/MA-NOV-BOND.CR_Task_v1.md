# MA-NOV-BOND.CR — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Architect + Tech Ops — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.CR_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.CR_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_Spec.md` (v1) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `claude/packets/MA-NOV-BOND.FIX2_Report.md` | `1373dc9fa85109e85df9d4ea9fbb1d33418b4ea40d6a48d5f9089b0149f16e19` |

## Steps
1. Read spec v1 §5 (visibility, CR1), v2 §7 (CR2), FIX2 report §5 and §7, `migrations/008-bonds.sql`, `bonds/apply/`.
2. Write the four migration files (CR1 adds 3 nullable columns; CR2 creates 2 tables; rollbacks).
3. Three-point check: plans of the read queries the UI/API will use on the new tables/columns (no SCAN of a large table), a single-execution read estimate < 50k, writes for the corpus (CR2 ≈ 12k per spec v2).
4. Rehearsal (local SQLite): `SELECT *` of `bond_issuance` (≤ 1 statement), load, CR1, `fix2-apply-run1.sql` → per-statement change counts vs expected, rollback → byte-for-byte compare; record the before-hash against `fix2-summary.json` `inputs.before.sha256`.
5. Write `claude/specs/MA-NOV-BOND_CR.md` (CR1 + CR2: change, reason, components, impact, three-point check, risks, rollback, approvals, monitoring, the U5/U8 run order).
6. Commit "MA-NOV-BOND.CR: change request CR1 + CR2, migrations (not run), apply rehearsal" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.CR_Report.md`
Header; 1 Summary + decisions (incl. `status_note` yes/no); 2 Three-point check; 3 Rehearsal results; 4 Deviations; 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.CR`.
