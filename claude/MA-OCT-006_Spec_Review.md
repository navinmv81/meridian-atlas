# MA-OCT-006 Spec — Operations Lead Review

```text
REVIEWER:     Operations Lead (hosted in October Main Lane; not the spec author)
PACKET:       MA-OCT-006 — GLEIF reliability investigation (spec)
VERDICT:      PASS WITH NOTES
DATE:         2026-09-26
SPEC:         claude/MA-OCT-006_Spec.md, SHA-256 1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273 (re-verified on the Mac)
```

## Evidence checked
1. The full spec (352 lines) against its brief (`ffd3522a…`): every "spec must define" item (1–8) is present.
2. **H1 re-verified independently in code** on `October-2026` @ `5405e3e`:
   - `name_search` appears only in `corporate-atlas-v1.sql:88` (schema CHECK) and `entities-seed.js:425` (the insert), so it has no consumer.
   - Phase 3's SELECT (`entities-enrich.js:275-289`) reads `entity_master` only.
   - Phase 1 writes nothing on a miss (`:118-128`).
3. Lane hygiene: 0 D1 queries, 0 GLEIF calls, no git writes, no lock files, and only the one file written.

## Assessment
This spec is ready to execute. It turns the F4 anomaly into 13 hypotheses that can be tested, and it already confirms the most important one (H1) from code. The (entity, field) classification unit and its decision rules are unambiguous. A 400-entity adjudicated sample with a pass threshold stops the rule engine from marking its own homework. The budget discipline is good: exports use keyset pagination, no single execution exceeds 50k reads, the plan is 200k with a hard stop at 250k, there are zero writes, and nothing runs in the Sunday or Monday windows.

## Operational rulings

| Item | Ruling |
|---|---|
| Read budget (plan ~175k, stop and report at 200k, hard stop at 250k, 0 writes) | **Approved.** Each day's reads are to be recorded in the query ledger as they happen, not reconstructed afterwards. |
| D7 worst case (Phase 1 head set, up to 30k × 3) | Approved **with the spec's own guard**: run once, and drop the repeats if it reads over 10k. |
| Golden Copy download, 6–8 GB (Q1) | Ops supports it. **Condition N-1 below.** |
| `wrangler tail` on 2 and 3 Oct at 06:50 UTC (07:50 BST) | Approved. It needs the Mac awake and an interactive session at that time. If either day is missed, D6 on the three dates plus the persisted counters is an acceptable fallback. Don't reschedule into Sunday. |
| Early hotfix for H4/H5 (Q3) | Ops supports it. It would be a separate packet, like MA-OCT-012, reviewed by the Architect and Operations Lead, not deployed on a Sunday, and with no backfill. |
| §8.3 exception codes GLEIF-E1 to E6 | Accepted as the Ops exception catalogue for GLEIF. They land in 002/003. |
| §8.4: one aggregate DQ ticket per root cause | **Agreed.** Per-entity tickets (~27k writes) would swamp the 004 queue. |

## Notes (N-1 is a condition carried into the execution brief; the rest are for the record)

- **N-1 (condition). Work folder location.** `~/Desktop/...` is often synced by iCloud ("Desktop & Documents"). An 8 GB Golden Copy there could start a large upload and fill the iCloud quota. Use a **non-synced** path instead, for example `~/MeridianAtlas-work/gleif-006/`, and confirm on day 1 that it isn't under iCloud Drive. Delete the unzipped Golden Copy files at close-out, and keep only `gleif_006.db` if MA-OCT-011 is GO.
- **N-2. Evidence file size.** The repo is public and `classification.csv` could run to ~100k rows. The GLEIF data is CC0 and the entity data is public, so there's no confidentiality issue. However, if a CSV is over **10 MB**, commit a gzipped copy or only a summary, and keep the full file in the work folder. Record the SHA-256 either way.
- **N-3 (to 001, relayed by the Main Lane).** The §8.2 contract requirements are accepted in principle: `progress_count` separate from `attempted`, ≤1 KB job metrics, a per-phase `run_key`, and `skipped` reason codes. They are being passed to the MA-OCT-001 spec lane now. Without `progress_count`, the Ops plane can't detect the F4 failure mode ("success with zero progress"), which is the one that hid for 4 weeks.
- **N-4 (new security finding, logged). `meridian-entities-delta` `/run` is unauthenticated (H10).** It is the same class as Known Issues 22.13, 22.18 and the bootstrap N1. The Worker is held, and there's no known exploitation, but it is deployed and reachable. It will be gated or removed in 002's hardening pass alongside N1. Not fixed in 006.
- **N-5 (for 002). Cross-domain run-state writes.** Entity jobs write `enrich_phase3_*` and `delta_*` into ETF-domain `holdings_pipeline_state`. H10 also adds unbounded `delta_inactive_<LEI>` keys. These belong in `ops_job_run` or Entities-domain state, and are recorded for the 002 registry design.
- **N-6. Timeline fit.** 006 closes Wed 14 Oct, in line with the Addendum's Wave 2 calendar (~14 Oct). The dependency on MA-OCT-012 Part 2 closing before 2 Oct is noted; Part 2 is due Mon 28 Sep.

## Required before Founder approval
None. N-1 is written into the execution brief the Main Lane issues for 1 Oct.

## Founder decisions requested at the gate
Q1 (Golden Copy download and ≤60 API calls), Q2 (answer the MA-SEP-017 residual from the export, then close it), Q3 (allow an early narrow H4/H5 hotfix packet). The Operations Lead recommends **yes** on all three, as the spec does.
