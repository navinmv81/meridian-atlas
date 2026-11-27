# MA-NOV-BOND.OFFER2 — Offering facts part 2 (fields 14–28), full offline dry run, offering apply + rollback SQL — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; BOND.REVIEW (independent) before any write
APPROVED BY:  Founder — bond spec v2 (NML-1122-2); single go-live (NML-1122-10); Start Approval required. No D1 writes, no SEC requests
PACKET:       MA-NOV-BOND.OFFER2 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Scope
Spec v2 (pinned) §3 **fields 14–28** (structure: seniority, security, guarantees, early repayment incl. make-whole/par call/tax redemption, change-of-control buy-back, mandatory early repayment, survivor's option; purpose/economics: use of proceeds as closed-list categories + section link, discounts/commissions, net proceeds; distribution extras; conditions: "where the notes may not be sold", conflicts of interest, listing — **section links with a one-line heading, never copied prose**, §8), each with source reference and state, offering vs tranche level; §6.1 automatic checks for these fields. Then a **full offline dry run** of fields 1–28 + parties on the corpus **as it will stand after the reliability apply** (parser 1.3.x results), and the **offering apply + rollback SQL** for the CR2 tables (`claude/specs/MA-NOV-BOND_CR.md`, pinned), split into runs ≤ 8,000 writes, **not run**. Also select the **20-filing manual-check sample** (spec v2 §6.2) and write the check sheet.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `App/Corporate Atlas/bonds/bonds-offering.mjs`, `App/Corporate Atlas/bonds/bonds-lib.mjs` (shared helpers only), `App/Corporate Atlas/bonds/tests/`, `App/Corporate Atlas/bonds/fixtures/`, `App/Corporate Atlas/bonds/apply/` (offer SQL, rollback, diff, check sheet), `claude/packets/MA-NOV-BOND.OFFER2_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; read the cache and stored state; scratchpad harness (offline, no writes); tests; up to 3 read-only D1 SELECTs (≤ 10,000 rows); a local SQLite rehearsal of the CR2 migration + offering apply + rollback (as BOND.CR did); read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Running any SQL against D1 or any D1 write; reliability parser behaviour changes; SEC/EDGAR or other network requests; Workers, front end, `docs/`; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; copying prospectus prose into values.

## Stop gates
Pinned hash mismatch; any role/tranche/trustee-as-bank error from the automatic checks that cannot be fixed (report counts); the local rehearsal shows unexpected row counts or an imperfect rollback; tests failing; push rejected.

## Success conditions
Fields 14–28 extracted with sources and states; automatic checks; fixtures + tests; full dry run with an availability table for all 28 fields vs spec v2 §3; offering apply + rollback SQL committed (not run) and rehearsed locally; 20-filing sample + check sheet; one commit pushed; report; `end`.
