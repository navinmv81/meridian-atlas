# MA-NOV-BOND.SPEC — Bond reliability (BOND-01–05) + offering information: specification — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Data-Identity Lead + Architect (specification) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; Founder spec approval (incl. the supported-scope target and the November cut line)
APPROVED BY:  Founder — "we need to get the bonds done" in November (NML-1121-10); Start Approval required. Specification only
PACKET:       MA-NOV-BOND.SPEC · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Purpose
Scope-document checkpoint 1+2 for outcome BOND: measure the real universe and failure causes (BOND-01 inventory), propose a **measurable supported-scope target**, and specify fixes, visibility, guarded reprocessing and tests (BOND-02–05) — plus a sized option for offering information (**BOND-06 underwriters/bookrunners with roles, BOND-11 intermediaries vs issuer/guarantor/trustee, BOND-08 tranche association, BOND-09 not disclosed / not applicable / not extracted**) — as small work units that fit **Sun 22 – Sun 29 Nov**, with the release of the main November work on Mon 23 and the demo on Mon 30. BOND-07/10/12 (summary, section references, narrative) are expected to stay December unless the sizing shows otherwise.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `claude/specs/MA-NOV-BOND_Spec.md`, `claude/packets/MA-NOV-BOND.SPEC_Report.md`. `allow_commits: false`.

## Allowed actions
Read files (`App/Corporate Atlas/bonds/` code, config, fixtures, tests, `state/` run logs and snapshots; `migrations/008-bonds.sql`; `entities-api.js` FI routes; `ma-entities.js` FI/bond UI; October bond records in `claude/` and the repo); read-only git; run the existing bond tests; **up to 10 read-only D1 statements** (repo root, no `-c`; plan-check first; projection ≤ 50,000 per statement; ≤ 120,000 rows in total); **no SEC/EDGAR network requests** (use fixtures and stored state); use `/write-spec` if available; write the two files.

## Prohibited actions
Code edits; running the parser, discover, ingest or any re-parse; D1 writes; network fetches to SEC/EDGAR; deploys; `docs/`; secrets, `.env*`; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a fix that needs a broad new ingestion programme or bond analytics (out of scope §4 — record as a Founder decision); read budget reached (finish from stored state, mark estimates).

## Success conditions
Spec and report written to the Task's structure with measured numbers, a target for approval, a November cut line, and decisions; nothing else changed; `end`.
