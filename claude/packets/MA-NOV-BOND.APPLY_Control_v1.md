# MA-NOV-BOND.APPLY — Bond writes to D1: reliability (CR1 + FIX2) and offering (CR2 + 2 runs) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-25
EXECUTED BY:  Data-Identity Lead + Tech Ops — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; the single go-live release packet re-checks live
APPROVED BY:  Founder — this packet's Start Approval covers the production D1 writes listed below and nothing else
PACKET:       MA-NOV-BOND.APPLY · Control v1 · usage class medium · write owner Data-Identity Lead
```

## What and why
The bond work is built, reviewed and rehearsed offline. BOND.REVIEW cleared the reliability write; BOND.FIX3 cleared the offering write (0 blocking rows, every shown field 100%). This packet runs those writes on `meridian-etf`, in the reviewed order, with a check after every step and a rollback ready for each. Expected total ≈ 16.8k row-writes. No code changes, no deploys.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `5025050` = origin). D1 commands run from the repo root with `--remote`, **no `-c`**. Code 10000: retry the same statement once, after `whoami`; if it fails again, stop. Writable (checked by `end`): `claude/packets/MA-NOV-BOND.APPLY_Report.md` only. `allow_commits: true` (report only); may push `November-2026`.

## Allowed actions
`whoami`; read-only git and `git ls-remote`; hash checks of the pinned files; `node "App/Corporate Atlas/bonds/apply/before-hash.mjs"`; the bond test suites (read-only); **read-only** D1 SELECTs and `PRAGMA`/`sqlite_master` reads (≤ 30 statements, ≤ 50,000 rows read in total); the live d1-today `rows_written` read the back-fill guard uses (Cloudflare analytics, read-only); and these writes, each **once**, in this order: the DROP COLUMN probe (3 statements on a scratch table), `ma-nov-bond-cr1.sql`, `fix2-apply-run1.sql`, `ma-nov-bond-cr2.sql`, `offer-apply-run1.sql`, `offer-apply-run2.sql`; a pinned rollback file only on a rollback trigger; write the report; one commit of the report; push.

## Prohibited actions
Any other SQL write (UPDATE/DELETE/INSERT outside the pinned files); editing any pinned file; rebuilding SQL; touching `bond_issuance` other than through the pinned files; Ops tables, the back-fill job or its pause row; deploys, toml, crons, secrets; other Workers; `docs/`; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`; git rewriting.

## Time and headroom rules
- Start a write only between 08:05Z and 23:45Z, never in 05:50–07:10Z or 23:50–00:10Z, and only if it can finish before 23:45Z.
- Each offering run starts only if live `rows_written` today + the run ≤ 58,000. A run that does not fit stops the packet cleanly (report `PARTIAL`); the Main Lane reissues the remainder for the next day after 08:05Z.

## Stop gates (stop, write nothing more, report)
Pin mismatch; HEAD ≠ origin; tests failing; before-hash ≠ `d70c311a…ada51` before CR1 (D1 changed: stop, do not rebuild here); a second code-10000 failure.

## Rollback triggers (run the pinned rollback for the step just run, then stop)
Any statement or batch mismatch against the file's expected changes; after CR1, the 23 original columns no longer hash to `d70c311a…ada51` or a new column is non-NULL; after FIX2, the reconcile is not 638 finals / 550 with an identifier / 0 non-final without a reason; after CR2, integrity not ok; after an offering run, counts ≠ the run's facts/parties or any withheld row present. Order if a later step forces a full unwind: offering 2 → 1, CR2 rollback, FIX2 rollback, CR1 rollback (or CR1's zero-write fallback if the probe showed DROP COLUMN is refused). Never start a rollback without the headroom for it.

## Success conditions
Back-fill check recorded; probe result recorded; CR1, FIX2, CR2, offering runs 1 and 2 applied and each verified; final state 943 issuance rows (638 / 550 / 0), 11,576 facts + 3,994 parties at `bonds-offering-1.2.0`, 0 withheld rows, 0 place lists; `bond_issuance` unchanged by the offering runs; row-writes and reads per step reported; report committed and pushed; `end`.
