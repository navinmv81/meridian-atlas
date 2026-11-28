# Release Ledger — November 2026

Closed 2026-11-28 (NML-1128-1). Branch `November-2026`; live GitHub Pages source `November-2026` `/docs`. Evidence for each row is the packet's Report and its Status file (`main_lane_verification`) in `claude/packets/`. Narrative: `Meridian_Atlas_Current_State_v15.docx` §25.

## Production changes

| # | Packet | What changed in production | Live version / commit | When (UTC) | Rollback |
|---|---|---|---|---|---|
| 1 | MA-NOV-EXP.W1R4 → W1R5 | Exposure route R-EXP1 on `meridian-entities-api` (one D1 call, 10,000-holding / 128 KiB caps, versioned cache key, `newest_stored_month`) | `bb8ad0aa` (13 Nov) → `a9ffeaae` (`79822d5`, 19 Nov) | 13–19 Nov | superseded by row 5; `wrangler rollback 4e7ee20b` only with the route unused |
| 2 | MA-NOV-EXP.BFS.GO | Back-fill code in `meridian-entities-enrich`; Ops registry row (cap 40k) + pause row | enrich `aa39edf6` (`bc1d079`) | 21 Nov 08:2xZ | `wrangler rollback 5c64e54e -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` |
| 3 | MA-NOV-EXP.BFS.ON | Back-fill switched on (pause row ended, case event) | Ops rows | 22 Nov 10:14Z | switch-off SQL in `MA-NOV-EXP.BFS.ON_Report.md` (new pause row) |
| 4 | MA-NOV-BOND.APPLY | D1: DROP COLUMN probe; CR1 (3 columns on `bond_issuance`); FIX2 apply (945 statements); CR2 (`bond_offering_fact`, `bond_offering_party`); offering runs 1–2 (11,576 facts + 3,994 parties). 16,931 writes | report `f442c51` | 25 Nov 21:20–21:31Z | order in report §9: offering 2 → 1, CR2, FIX2, CR1 (≈19.6k writes) |
| 5 | MA-NOV-REL.GO | `idx_bi_cik_status`; `meridian-entities-api` deploy (bond routes); `docs/` regenerated with `?v=rel-20261126`; Pages switched to `November-2026` `/docs` by the Founder | api `e35d7c55`; `74a9a03`, `bb3815b` | 26 Nov 21:16–21:30Z (Pages 21:22:26Z) | Pages → `October-2026` `/docs` `98e830e`; `wrangler rollback a9ffeaae`; `ma-nov-bond-idx1-rollback.sql` |
| 6 | MA-NOV-UIT.APPLY | `fund_holdings_monthly` +1,039, `fund_snapshot_monthly` +4, `etf_master` 4 rows (SPY, QQQ, DIA, MDY). 11,450 writes | report `f538f6e` | 27 Nov 15:5xZ | `uit-rollback-run1.sql` per `MA-NOV-UIT.REVIEW_Report.md` §8.5 |
| 7 | MA-NOV-PATCH.REL | Front end: NO_NPORT fix, no-holdings wording, stamps `rel-20261127`; `meridian-bootstrap` deployed without its cron; `financialfact-backfill` LaunchAgent booted out (plist moved) | `7cdb345`, `80a16e9`; bootstrap `4e417f40` | 27 Nov 17:14–17:30Z | `git revert 7cdb345`; `wrangler rollback b2ab8f09`; move plist back + `launchctl bootstrap` |

## Built and closed without a production change

Factory and governance (MA-NOV-BOOT, MA-NOV-000, P1.BUILD … FIX4, REVIEW–REVIEW4; `a01ffe2` … `f215681`); scope (SA1, BQ1/BQ2); EXP spec, W1–W3R3, UI.REVIEW, BF1 (SQL not run), BFS design/build/review/fix/check; UI spec, OPS.BUILD, HOME.BUILD, POLISH, UI.REVIEW (shipped in row 5); bond SPEC, SPEC2, FIX1, FIX2, CR, OFFER1, OFFER2, REVIEW, FIX3, UI (shipped in rows 4–5); DIAG.HEALTH (read-only); UIT.BUILD, UIT.REVIEW.

## Superseded

- MA-NOV-EXP.C1 — deployed `e6ddf979` 12 Nov, rolled back automatically (CPU 11–12 ms > 10 ms); superseded by W1R3 → C1R2 → W1R4.
- MA-NOV-REL.GO Control/Task v1 — superseded by v2 (single go-live including bonds).

## Carried to December

See `claude/packets/MA-NOV-CARRY_Status.json` and Current State v15 §25.12: Sunday holdings cycle sizing; permanent CIK path for series-less trusts; `fund_entity_link` for the 4 UIT funds; FIRDS ledger emitter; 3 withheld bond fields, coverage totals and `#/fi` counts; precomputed exposure for funds over the cap; `ma-ops.js` stamp in the Ops shell; UI.REVIEW notes; October carry-overs (A2, 013 held merges, CR-11, 007 Phase 2, security items).
