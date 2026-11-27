# MA-NOV-BOND.SPEC — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Data-Identity Lead + Architect — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.SPEC_Status.json
CONTROL:      claude/packets/MA-NOV-BOND.SPEC_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| `claude/packets/MA-NOV-SA1_Report.md` | `419e433726fa37275dff4ef8cea49d362cae3746eacd56d7a5024bf612ab3aea` |
| `claude/packets/MA-NOV-BQ2_Report.md` | `9b133cdea2715d19520d2988ddcc65241c80309c19aae21820a3ef91bdc15102` |

## Known baseline (verify, do not trust)
BQ2 (11 Nov): 943 rows = final 632, preliminary 184, skipped_other 52, skipped_non_debt 45, skipped_structured 21, parse_failed 9; parser bonds-1.2.0; 30 configured issuers; final = 76.6% of final + preliminary + parse_failed. All 184 preliminary rows lack CUSIP/coupon/maturity/amount/label; 161 have a final for the same CIK (153 within 14 days), 23 none. Tranche-level fail reasons live in local run logs, not D1. Decisions already taken: facts only, no generated narrative (BOND-12); a nullable fail-reason column needs its own CR.

## The spec — `claude/specs/MA-NOV-BOND_Spec.md`
1. **BOND-01 inventory:** current counts by status, issuer and document type; definitions of success / partial / failure / skipped / unsupported (with "partial" defined); the supported scope (which issuers/document types are in, which out and why).
2. **Root causes (BOND-02):** grouped failure reasons from stored logs and fixtures with counts (preliminary rows with no tranche fields; the 23 with no final; remarketing; demand notes; parse_failed; others); which are parser defects vs expected skips.
3. **Target (for approval):** a measurable November target, e.g. "≥ X% of supported debt documents final, every non-final row with a visible stated reason, 0 silent failures", with the arithmetic.
4. **Fixes (BOND-02):** per cause — change, expected effect on counts, test fixture.
5. **Visibility (BOND-03):** where reasons live (D1 column via CR vs derived), what the FI/bond UI shows (plain language — the Founder rejects jargon), Ops DQ hook if any.
6. **Reprocessing (BOND-04):** guarded re-parse plan — scope, write budget per run (existing run cap), duplicate prevention, source references, rollback SQL, approval gate.
7. **Tests (BOND-05):** before/after counts, fixtures incl. multi-tranche and previously failed, remaining exceptions report.
8. **Offering information option:** BOND-06, 11, 08, 09 — fields, where they come from in the filing (424B/FWP sections), schema needs (CR), UI, accuracy checks, size; and why BOND-07/10/12 stay December (or not).
9. **Work units** with sizes and days (Sun 22 – Sun 29), one worker, ~3–5 Founder checkpoints/day possible on weekends; mark the **November cut line** (must / stretch / December).
10. **Cross-lane review** (Entities ownership of bond tables; Tech Ops write budget; no conflict with the back-fill job's 06:00 window).
11. **Open decisions** for the Founder, numbered, each with a recommendation.

## Report — `claude/packets/MA-NOV-BOND.SPEC_Report.md`
Header; 1 Summary + decisions; 2 Measurements (SQL, rows_read; log files read); 3 Deviations; 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.SPEC`.
