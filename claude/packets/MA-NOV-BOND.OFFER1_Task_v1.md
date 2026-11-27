# MA-NOV-BOND.OFFER1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.OFFER1_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.OFFER1_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_CR.md` | `3885c9999da6f9736fa7e5db6273b7e2ec2aa92c62da1a2a3f7d9a1a80b12b5b` |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql` | `3a2050cd06a0c14108f3c67b078eb3cd98ba0e0bbe6aea6d2540f743ae194e6b` |
| `claude/packets/MA-NOV-BOND.FIX2_Report.md` | `1373dc9fa85109e85df9d4ea9fbb1d33418b4ea40d6a48d5f9089b0149f16e19` |

## Work
1. Read spec v2 §2–8, the CR (§ CR2), the CR2 migration, FIX2 §1 and §7, and the parser's `result.offering`.
2. Build `bonds-offering.mjs`: fields 1–13 + parties (§4 role vocabulary; cover-block reader; split European/all-capitals lists correctly; trustee never as a bank), each fact with its source (filing URL, section heading/anchor, page where printed) and state (shown / not stated in the filing / not applicable / not read yet); offering-level vs tranche-level per §3; output rows exactly in the CR2 table shapes (incl. the 300-char limit).
3. §6.1 automatic checks (e.g. amount/currency/coupon/maturity agree with `bond_issuance`; parties have a printed role; issuer/guarantor/trustee never in the bank list).
4. Fixtures + tests: multi-tranche with per-tranche price; pricing supplement with no trustee ("Not stated in the filing"); European bank list; all-capitals list; a guarantor deal; a co-registrant issuer.
5. Offline run over all cached final filings (no writes): availability per field vs spec v2 §3's measured rates (flag any field > 10 points below); parties per filing; automatic-check failures with counts; sample of 10 facts per field for the 20-filing manual check later.
6. Commit "MA-NOV-BOND.OFFER1: offering facts part 1 — parties, identity, terms, dates, source references (offline)" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.OFFER1_Report.md`
Header; 1 What was built; 2 Availability table (field · spec v2 · measured · state split); 3 Parties results; 4 Automatic checks; 5 Tests; 6 Deviations; 7 Notes for OFFER2 and the apply; 8 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.OFFER1`.
