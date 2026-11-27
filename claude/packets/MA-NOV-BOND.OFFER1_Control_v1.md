# MA-NOV-BOND.OFFER1 — Offering facts part 1: parties, identity, terms, dates, source references (offline) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; BOND.REVIEW (independent) with the parser diff before any write
APPROVED BY:  Founder — bond spec v2 (NML-1122-2); Start Approval required. No D1 writes, no SEC requests
PACKET:       MA-NOV-BOND.OFFER1 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Scope
Spec v2 (pinned) **§3 fields 1–13** (identity, terms, dates), **§4 parties** (BOND-06/11: role vocabulary, cover-block reader, issuer/guarantor/trustee kept apart from intermediaries, tranche-specific roles where printed), **§5 source references** (BOND-10: filing URL + section heading/anchor; page where printed), **§6.1 automatic checks** (BOND-12), the BOND-09 states (not stated in the filing / not applicable / not read yet), tranche vs offering level (BOND-08). New module `bonds-offering.mjs` producing rows shaped for the CR2 tables (`claude/specs/MA-NOV-BOND_CR.md` + `migrations/ma-nov-bond-cr2.sql`, pinned). FIX2's `result.offering` (FIX2 report §7) is a starting point, not verified data. Fields 14–28 are OFFER2.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `8e576f5` = origin). Writable (checked by `end`): `App/Corporate Atlas/bonds/bonds-offering.mjs` (new), `App/Corporate Atlas/bonds/bonds-lib.mjs` (shared helpers only), `App/Corporate Atlas/bonds/tests/`, `App/Corporate Atlas/bonds/fixtures/`, `claude/packets/MA-NOV-BOND.OFFER1_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; read the cache and stored state; scratchpad harness for an **offline run over all cached final filings** (no writes); tests; **up to 3 read-only D1 SELECTs** (≤ 10,000 rows) to key facts to `bond_issuance` rows; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Changes to `bonds-parse.mjs`/`bonds-ingest.mjs` reliability behaviour; running migrations or any D1 write; SEC/EDGAR or other network requests; Workers, front end, `docs/`; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; copying prospectus sentences into values (short extracted values only, spec v2 §8).

## Stop gates
Pinned hash mismatch; a field whose extraction cannot avoid copying prose (keep it as a section link and report); a role or trustee-as-bank error found by the automatic checks that cannot be fixed (report the count); tests failing; push rejected.

## Success conditions
`bonds-offering.mjs` extracts fields 1–13 and parties with source references and states; automatic checks; fixtures + tests (incl. multi-tranche, pricing supplement with no trustee, European bank list, all-capitals list); offline availability per field vs spec v2 §3; one commit pushed; report; `end`.
