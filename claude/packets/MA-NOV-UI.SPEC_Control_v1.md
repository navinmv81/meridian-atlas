# MA-NOV-UI.SPEC — Ops cleanup + Homepage as research entrance: specification — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-21
EXECUTED BY:  UX Lead + Operations Lead + Architect (specification) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; Founder spec approval
APPROVED BY:  Founder — scope (NML-1110-6), re-plan (NML-1113-9); Start Approval required. Specification only
PACKET:       MA-NOV-UI.SPEC · Control v1 · usage class medium · write owner UX Lead
```

## Purpose
Scope-document checkpoint 2 for outcomes **OPS** (OPS-01–06) and **HOME** (HOME-01–07): one buildable specification with screens, states, exact copy for new text (plain language — the Founder rejected jargon in the EXP panel), acceptance tests, change/rollback plan and small work units sized to fit **Mon 23 – Thu 26 Nov**, before the November release (Fri 27 – Sat 28) and the demo (Mon 30). Also: the **November release plan** (Pages source → `November-2026` `/docs`, `generate-docs.mjs`, polish carry-overs) as a section, since release depends on these builds.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `claude/specs/MA-NOV-UI_Spec.md`, `claude/packets/MA-NOV-UI.SPEC_Report.md`. `allow_commits: false`.

## Allowed actions
Read files (`App/` front end incl. `ma-ops.js`, `index.html`, `ma-search.js`, `ma-entities.js` EXP block; `App/Ops/src/` routes; `generate-docs.mjs`; CLAUDE.md DEPLOY_BRANCH; scope doc; SA1; EXP spec; CARRY observations); read-only git; a **local static preview** of `App/` against live read-only APIs to look at today's Ops tabs and homepage (no R-EXP1 look-throughs needed; ≤ 5 if used); screenshots to the scratchpad; use `/write-spec` if available; write the two files.

## Prohibited actions
Code edits; deploys; D1 statements; Ops writes; Pages settings; `docs/` regeneration; git writes; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a requirement that cannot be met without deleting records, APIs or history (OPS-05) or without a new data programme (HOME conditional items) — record as a Founder decision, do not design around it.

## Success conditions
Spec written to the Task's structure, with work units that fit the dates or a stated trade-off; report with decisions for the Founder; nothing else changed; `end`.
