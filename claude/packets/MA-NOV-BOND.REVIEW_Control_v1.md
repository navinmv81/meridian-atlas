# MA-NOV-BOND.REVIEW — Independent review of all bond work + the 20-filing source check (BOND-12) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Architect + independent Data-Identity checker + Tech Ops — fresh interactive Claude Code session via LANE_OPENER_v2.md (did not author FIX1, FIX2, CR, OFFER1 or OFFER2)
REVIEWED BY:  — (this is the review)
APPROVED BY:  Founder — Start Approval required; the bond write approval (Tue 24) follows this review
PACKET:       MA-NOV-BOND.REVIEW · Control v1 · usage class medium · write owner Architect (review report only)
```

## Scope
Commits `6aa5c39` (FIX1), `f64652c` (FIX2), `8e576f5` (CR + migrations), `5ae101f` (OFFER1), `01c5379` (OFFER2) against bond spec v1 (reliability) and v2 (offering), the CR, and each report's deviations — including: FIX2's three FWP conflicts made final (against the literal Control rule); OFFER1's day-count reading; OFFER2's ⚑ fields (trustee 36% vs 73%, use of proceeds 43% vs 62%, selling restrictions 47% vs 59%, conflicts 18% vs 38%, change of control 2.8% vs 23%) and whether the Required ones should become "show where found".

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `01c5379` = origin). Writable (checked by `end`): `claude/packets/MA-NOV-BOND.REVIEW_Report.md`. Execute from `claude/packets/MA-NOV-BOND.REVIEW_Task_v1.md`.

## Allowed actions
Read any repository file and the cache; read-only git, `git ls-remote`; run all bond tests; scratchpad experiments (offline); **a full local rehearsal on a fresh copy**: one `SELECT *` of `bond_issuance` (≤ 1,000 rows) → CR1 → FIX2 apply → CR2 → offering applies (3 runs) → verify counts → all rollbacks → byte-for-byte compare; up to 4 read-only D1 SELECTs in total (≤ 10,000 rows); write the report.

## Prohibited actions
Editing any repository file other than the report; any D1 write or running SQL against D1; SEC/EDGAR or other network requests; deploys; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; `dispatch.mjs run`/`begin` for another packet; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gate
After writing the report and running `end`, stop.

## Success conditions
Verdict (PASS / PASS_WITH_NOTES / FAIL) with findings (B / M / N); the 20-filing check done against the cached source text with per-field correctness and the §6.3 gate applied (fields < 95% → hidden for November; any role / tranche / trustee-as-bank error → blocks the offering write); judgements on the listed deviations; a plain recommendation on whether the Tue 24 writes (CR1 + reliability apply; CR2 + offering applies) may proceed, with conditions.
