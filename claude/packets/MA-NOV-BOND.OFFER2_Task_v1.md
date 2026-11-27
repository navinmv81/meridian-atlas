# MA-NOV-BOND.OFFER2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.OFFER2_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.OFFER2_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-BOND_Spec_v2.md` | `c42818156bb9589dac938a4e5ea42f0ff787ad2a574c8217b7736a25a6208aef` |
| `claude/specs/MA-NOV-BOND_CR.md` | `3885c9999da6f9736fa7e5db6273b7e2ec2aa92c62da1a2a3f7d9a1a80b12b5b` |
| `claude/packets/MA-NOV-BOND.OFFER1_Report.md` | `f3fa43434827b2c920602cb309f87d31ae90e26a4687d6b9079b86c97301ad2b` |
| `App/Corporate Atlas/bonds/bonds-offering.mjs` at HEAD (blob) | `d24b2d434209df640a5e940dc263a298b131d408` |

## Work
1. Fields 14–28 per spec v2 §3 and §8; sources and states; levels; automatic checks.
2. Fixtures + tests: a make-whole + par call deal; a tax-redemption deal; a change-of-control buy-back; use-of-proceeds categories; a deal with discounts/net proceeds; a pricing supplement where most of these are "not stated".
3. Full offline dry run (fields 1–28 + parties) on the post-reliability corpus; availability table for all 28 fields vs spec v2 §3 (flag > 10 points below); automatic-check failure counts.
4. Offering apply + rollback SQL for the CR2 tables (`INSERT OR IGNORE`; runs ≤ 8,000 writes; expected counts); **local rehearsal**: CR2 migration on a copy, apply, counts match, rollback restores.
5. 20-filing sample across issuers/families (spec v2 §6.2) + a check sheet (`apply/offer-check-sheet.md`: each shown fact with its source link/section for a person to tick).
6. Commit "MA-NOV-BOND.OFFER2: offering facts part 2, full dry run, offering apply + rollback SQL (not run), check sheet" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-BOND.OFFER2_Report.md`
Header; 1 Built; 2 Availability (all 28 fields); 3 Automatic checks; 4 Apply SQL + rehearsal; 5 Check sample; 6 Tests; 7 Deviations; 8 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.OFFER2`.
