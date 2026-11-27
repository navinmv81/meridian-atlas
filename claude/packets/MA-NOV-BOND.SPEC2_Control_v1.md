# MA-NOV-BOND.SPEC2 — Bonds BOND-01–12 for November: specification v2 — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  Data-Identity Lead + Architect (specification) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; Founder spec approval
APPROVED BY:  Founder — "bring in the deferred items; keep the excluded ones per the scope we defined" (NML-1121-12); Start Approval required. Specification only
PACKET:       MA-NOV-BOND.SPEC2 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Purpose
Revise the bond spec v1 (`claude/specs/MA-NOV-BOND_Spec.md`, pinned) into **v2 covering BOND-01–12 in November**: reliability (01–05, as v1) **plus** offering information — BOND-06 parties with roles, BOND-07 structured offering summary (**extracted facts only, no generated narrative** — decision 10 Nov), BOND-08 tranche association, BOND-09 not disclosed / not applicable / not extracted, BOND-10 source references (filing link + section; page only where the document has pages), BOND-11 intermediaries vs issuer/guarantor/trustee, BOND-12 every summary field verified against its source. **Still excluded (scope §6):** new issuers or document types, bond prices/yields/valuation/credit analytics, structured or market-linked notes. Plan: Sun 22 – Sun 29 Nov, demo Mon 30.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `claude/specs/MA-NOV-BOND_Spec_v2.md`, `claude/packets/MA-NOV-BOND.SPEC2_Report.md`. `allow_commits: false`.

## Allowed actions
Read files (as BOND.SPEC, incl. the **cached filings** under `App/Corporate Atlas/bonds/` cache/state); read-only git; run the existing bond tests; **call pure parser/helper functions and small read-only scripts in the scratchpad on cached documents** to measure field availability (no network, no writes to the repo or D1); **up to 6 read-only D1 statements** (as BOND.SPEC limits; ≤ 60,000 rows); use `/write-spec` if available; write the two files.

## Prohibited actions
Code edits in the repo; running discover/ingest/re-parse against D1; D1 writes; SEC/EDGAR or other network requests; deploys; `docs/`; secrets, `.env*`; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; any item that would need an excluded scope (§6) to work — record it, do not design around it.

## Success conditions
Spec v2 with measured field availability, schema change requests outlined, work units by day with a cut order inside BOND-06–12, and decisions; report; nothing else changed; `end`.
