# MA-NOV-BOND.FIX3 — Offering review fixes (tranche scoping, party qualifiers, withheld fields), rebuild + rehearse + re-check — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification against BOND.REVIEW (the re-check of changed rows is part of this packet; BOND.REVIEW's reviewer rules are the acceptance)
APPROVED BY:  Founder — Start Approval required. No D1 writes, no SEC requests
PACKET:       MA-NOV-BOND.FIX3 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Scope
`claude/packets/MA-NOV-BOND.REVIEW_Report.md` (pinned), offering only:
- **F1 (B):** rate-type scoping — fixed-rate wording (day count, interest dates, early repayment) applies only to the tranches it names; floating tranches get their own or none; the AbbVie 2066 / floating boundary; Amazon 26-027669 early repayment.
- **F2 (B):** party qualifiers naming some tranches ("Co-Managers (Floating Rate Notes, 2028 Notes, …)") → tranche-specific rows; no bank shows two roles on one tranche; Citigroup/Goldman restored on tranche 2.
- **Withhold for November (§6.3 gate):** `use_of_proceeds`, `proceeds_total`, and the `selling_restrictions` **place list** (keep its section link — cut order step 4). Withheld = not in the apply SQL.
- **F8:** Toyota per-agent commissions → no `bank_fee` row (not "Not stated"). **F9:** "PNC Capital Markets LLC" decode; AmEx fixed-to-floating day count qualified or not shown.
- **F7:** record the canonical before-hash method (results-only) in `apply/` so it can be reproduced.
- Rebuild the offering SQL; **local rehearsal** (CR2 + runs + rollback); **re-check every changed row** against the cached source (BOND.REVIEW method), plus the AbbVie/Amazon filings in full; restate the 20-filing gate table.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `01c5379` = origin). Writable (checked by `end`): `App/Corporate Atlas/bonds/bonds-offering.mjs`, `bonds-lib.mjs` (helpers only), `App/Corporate Atlas/bonds/tests/`, `App/Corporate Atlas/bonds/fixtures/`, `App/Corporate Atlas/bonds/apply/`, `claude/packets/MA-NOV-BOND.FIX3_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; cache/state reads; scratchpad harness; tests; up to 2 read-only D1 SELECTs (≤ 2,000 rows) for the rehearsal; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Reliability parser behaviour (`bonds-parse.mjs`, `bonds-ingest.mjs`), FIX2 SQL; any SQL against D1 or D1 write; SEC/network; Workers, front end, `docs/`; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; any remaining wrong-tranche, double-role or trustee-as-bank row in the re-check; rehearsal mismatch or imperfect rollback; tests failing; push rejected.

## Success conditions
F1, F2, F8, F9 fixed with tests; withheld fields out of the SQL; F7 method recorded; SQL rebuilt (runs ≤ 8,000); rehearsal clean; re-check: 0 blocking errors and every shown field ≥ 95% on the 20-filing sample; one commit pushed; report; `end`.
