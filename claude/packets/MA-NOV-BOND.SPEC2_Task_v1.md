# MA-NOV-BOND.SPEC2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Data-Identity Lead + Architect — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.SPEC2_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.SPEC2_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| `claude/specs/MA-NOV-BOND_Spec.md` (v1) | `b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53` |
| `claude/packets/MA-NOV-BOND.SPEC_Report.md` | `5068d502eb93abcc844eb77b6a65fbbce2d8f13eddb30297592b5b0c545eba0d` |

## Spec v2 — `claude/specs/MA-NOV-BOND_Spec_v2.md`
Keep v1 §1–7 (reliability: classes, causes, targets T1–T5, fixes F1–F8, visibility, reprocessing, tests) unless something changes, and add:
1. **Offering facts field set (BOND-07):** from scope §4.2 candidate fields — identity (issuer, guarantor, document date, identifiers), terms (amount, currency, issue price, coupon, maturity, payment terms), dates (pricing, issue, settlement), structure (seniority, security, guarantees, redemption), purpose/economics (use of proceeds, discounts/commissions, net proceeds), distribution (underwriters, bookrunners, roles), conditions (material offering-specific restrictions/conditions; risk disclosures **as section references, not reproduced text**). For each field: where it appears (424B2/424B5/FWP sections), **measured availability** on the cached final filings (e.g. a sample of ≥ 40 across issuers, with counts), extraction rule, value type, tranche-level vs offering-level (BOND-08), and the not disclosed / not applicable / not extracted rule (BOND-09). Mark fields that measure < 50% available as "show where found" vs "required".
2. **Parties (BOND-06, 11):** role vocabulary (bookrunner, co-manager, underwriter, issuer, guarantor, trustee, other), extraction rule, distinguishing intermediaries.
3. **Source references (BOND-10):** filing URL + section heading/anchor per fact; page where the document has pages; how stored.
4. **Verification (BOND-12):** per field, how it is checked against the source; a 20-filing manual check protocol; acceptance thresholds (e.g. ≥ 95% of checked facts correct, 0 wrong party roles).
5. **Schema (CR2):** an offering-level table and a parties table (Entities domain), keys, indexes, write volume for the corpus, three-point check, rollback — outline for the CR.
6. **No narrative, no wholesale reproduction:** short extracted values only; risk/conditions as section links with a one-line heading.
7. **UI:** the bond/issuer page "Offering details" panel and "Who's involved", with plain-language labels (the Founder rejects jargon), source links, and the three not-shown states.
8. **Work units by day** Sun 22 – Sun 29 with one worker; reliability apply and offering apply as separate write approvals; **cut order within BOND-06–12** if it slips (which fields go first); Founder checkpoints per day (~2 on weekdays).
9. **Open decisions** for the Founder, numbered, each with a recommendation.

## Report — `claude/packets/MA-NOV-BOND.SPEC2_Report.md`
Header; 1 Summary + decisions; 2 Measurements (field availability table, filings sampled, D1 statements, rows read); 3 Deviations; 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.SPEC2`.
