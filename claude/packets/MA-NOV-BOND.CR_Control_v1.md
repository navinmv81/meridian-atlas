# MA-NOV-BOND.CR — Change request BOND-CR1 (2–3 columns) + BOND-CR2 (offering + parties tables), migrations written not run, local rehearsal — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Architect, with Tech Ops (three-point check) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; Founder approves the CR; BOND.REVIEW checks the migrations with the parser diff
APPROVED BY:  Founder — bond spec v2 decisions 4 and 6 (NML-1122-2); Start Approval required. No D1 writes
PACKET:       MA-NOV-BOND.CR · Control v1 · usage class small · write owner Data-Identity Lead
```

## What
Per `/change-request`, one document covering:
- **BOND-CR1** on `bond_issuance` (Entities domain): `status_reason TEXT NULL`, `superseded_by TEXT NULL`, and — per FIX2 §7 — **`status_note TEXT NULL`** so the UI can show "tranche dropped at pricing" / allocation notes (Main Lane recommendation; the Founder's CR approval decides).
- **BOND-CR2** (spec v2 §7): the offering-facts table and the parties table (`WITHOUT ROWID`, PK only), keys, columns, expected rows and writes for the corpus.
Impact, three-point check (index audit with plans of the UI/API read queries; single-execution read test < 50k; read/write budget), risks, rollback (`ALTER TABLE … DROP COLUMN` / `DROP TABLE`, with the D1 limits on DROP COLUMN checked), monitoring, approvals. Also: the migration SQL files (**written, not run**), and a **local SQLite rehearsal** of FIX2's apply + rollback (FIX2 §7): load today's `bond_issuance` rows into a local copy, apply CR1, run `fix2-apply-run1.sql` (every statement changes exactly the expected rows), run the rollback, compare byte-for-byte.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f64652c` = origin). Writable (checked by `end`): `claude/specs/MA-NOV-BOND_CR.md`, `App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql`, `App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql`, `App/Corporate Atlas/migrations/ma-nov-bond-cr1-rollback.sql`, `App/Corporate Atlas/migrations/ma-nov-bond-cr2-rollback.sql`, `claude/packets/MA-NOV-BOND.CR_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Read files; `/change-request` skill if available; **up to 6 read-only D1 statements** (repo root, no `-c`; `SELECT` / `EXPLAIN QUERY PLAN`; one `SELECT *` of `bond_issuance` ≈ 943 rows for the rehearsal; ≤ 30,000 rows total); a local SQLite (`node:sqlite`) rehearsal in the scratchpad; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Running any migration or apply/rollback SQL against D1; any D1 write; deploys; code edits outside the listed files; `docs/`; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; the rehearsal shows a statement changing an unexpected number of rows, or the rollback not restoring byte-for-byte (report, do not fix FIX2 here); a DROP COLUMN limitation that makes CR1 irreversible (propose the alternative).

## Success conditions
CR document with impact, three-point check, rollback and approvals; four migration files committed (not run); rehearsal results; report; `end`.
