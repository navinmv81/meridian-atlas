# MA-NOV-BOND.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Architect + independent checker + Tech Ops — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec.md` (v1) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_CR.md` | `3885c9999da6f9736fa7e5db6273b7e2ec2aa92c62da1a2a3f7d9a1a80b12b5b` |
| FIX1 / FIX2 / CR / OFFER1 / OFFER2 reports | `b8027ac47f78dd3bde961d5707690fccea542059804c281db653b049819528c0` · `1373dc9fa85109e85df9d4ea9fbb1d33418b4ea40d6a48d5f9089b0149f16e19` · `f2ee94343d72b8dc5d5de4dab82b019401058c93dfb0a70ea1118926c1f92a42` · `f3fa43434827b2c920602cb309f87d31ae90e26a4687d6b9079b86c97301ad2b` · `b9693db02063cb33cbba8d9f21130c343e93996644dd9ab42b82a420e0db2002` |

## Checks
1. **Scope per commit** vs each Control; no D1 writes ever made (report claims + `git log`); no network code paths in tests/harnesses.
2. **Parser (FIX1/FIX2):** each fix against spec v1 §4; sample 15 changed rows from `fix2-diff.tsv` against the cached source (identifiers, classes, reasons); the AT&T currency guard; F2b links; judge the FWP-conflict decision.
3. **Offering extractor (OFFER1/OFFER2):** no copied prose (values ≤ 300 chars, sections as links); role vocabulary; trustee/guarantor/issuer never a bank; tranche-specific rows map to one tranche.
4. **20-filing source check (BOND-12, spec v2 §6.2):** use `apply/offer-check-sheet.md`; tick every shown fact against the cached filing text; per-field correctness; apply the §6.3 gate; list hidden fields.
5. **⚑ fields:** judge Required → "show where found" for trustee, use of proceeds, selling restrictions (and the spec's counting differences).
6. **Full local rehearsal** on a fresh copy (Control): every statement's row count as expected; rollbacks restore byte-for-byte; record the canonical before-hash for the Tue run.
7. **Tech Ops:** Tue 24 write budget with the back-fill's first live run (≈40k) + 1,229 + 16,016; ≤ 8k per run; order; headroom gate; rollback order.
8. **Tests:** all bond suites.

## Report — `claude/packets/MA-NOV-BOND.REVIEW_Report.md`
Four-line header; verdict; findings table; 20-filing check table (field · checked · correct · % · gate); deviation judgements; rehearsal results; **recommendation: may the Tue 24 writes proceed (yes / yes with conditions / no)**, with the run order; your session id; under ~1,200 words. Then `end` and stop.
