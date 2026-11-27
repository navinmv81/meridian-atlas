# MA-NOV-REL.GO — November release: exposure screen, Ops cleanup, homepage (Pages → `November-2026` `/docs`) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Operations Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md, **with the Founder present** (one manual step)
REVIEWED BY:  Main Lane verification of the post-release checks
APPROVED BY:  Founder — UAT pass (NML-1121-10); "not worry about go-live dates, maximise today" (NML-1122-2); this packet's Start Approval is the **release approval**
PACKET:       MA-NOV-REL.GO · Control v1 · usage class medium · write owner Operations Lead
```

## What
UI spec §4 release plan and UI.REVIEW's REL.CR must-carry list (both pinned):
- **Part A (prep):** (M-1) add the same release token as a `?v=` stamp to every `<script src>` (and local stylesheet, if any) in `App/index.html`; (M-2) restore the docs-mirror check in `App/Ops/tests/ops-a.test.mjs` as a hard check (11 files byte-identical + `docs/.nojekyll`); `node generate-docs.mjs --dry-run` + diff; `node generate-docs.mjs`; confirm `docs/.nojekyll`; write the release CR `claude/specs/MA-NOV-REL_CR.md` (change, impact, rollback, checks); all front-end + Ops suites green; one commit; push `November-2026`.
- **Part B (Founder, manual):** in the session, ask the Founder to switch GitHub Pages to **`November-2026` / `/docs`** and wait for "switched". Do not proceed without it.
- **Part C (checks, ≥ 10 min after the push):** served files byte-identical to `docs/` (11 files) and `/.nojekyll` 200; homepage at 1280/800/375 (Research card, DELAYED, no sideways scroll); the example link shows "✓ Adds up to 100%"; "Taiwan Semiconductor" → #2191 → Back; `#/exposure` loads with stamped scripts; O-11: one GET each of the Ops `release-ledger` and `sprint-board` routes → 200 with rows; give the Founder the live Ops console checklist (signed in): four tabs, Cases drawer, DQ, Drift & Budget, Health, phone.
- **Rollback:** if a check fails and cannot be fixed in one line within the session, ask the Founder to switch Pages back to **`October-2026` / `/docs`** and record it.
- **CLAUDE.md:** after Part C passes, update the DEPLOY_BRANCH entry (source `November-2026` `/docs`, the commit, the rollback source `October-2026` `/docs` at `98e830e`, the stamp rule) — nothing else in CLAUDE.md.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Live site: `https://navinmv81.github.io/meridian-atlas/` (currently `October-2026` `/docs`). Writable (checked by `end`): `App/index.html` (stamps only), `App/Ops/tests/ops-a.test.mjs` (mirror check only), `docs/`, `CLAUDE.md` (DEPLOY_BRANCH entry only), `claude/specs/MA-NOV-REL_CR.md`, `claude/packets/MA-NOV-REL.GO_Report.md`. `allow_commits: true` (Part A commit; a second commit for CLAUDE.md after Part C); may push `November-2026`.

## Allowed actions
Edits within scope; `node generate-docs.mjs` (dry run and real); tests; one or two commits and pushes; HTTP GETs to the live site and the two Ops GET routes; read-only git, `git ls-remote`; ask the Founder in the session; write the report.

## Prohibited actions
Changing GitHub settings yourself; any other code change; Worker deploys; D1; `October-2026` or `September-2026` branches; force-push; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; suites failing; `generate-docs` changes files other than the expected 4 (+ stamps); the Founder does not confirm the Pages switch (stop after Part A, report "prepared, not released"); a post-release check fails and cannot be fixed in one line (rollback as above).

## Success conditions
Released and verified, CLAUDE.md DEPLOY_BRANCH updated, report with every check; or "prepared, not released" / "rolled back" with evidence; `end`.
