# MA-NOV-EXP.W1R2 — Leaner R-EXP1 query, measured cap, commit — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-12
EXECUTED BY:  Engineering Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Independent review packet (EXP.W1.REVIEW (reviews W1 + W1R2 together)) incl. ETF Product Lead and Tech Ops sign-off (spec §10); Main Lane verification
APPROVED BY:  Founder — EXP spec approved (NML-1111-5); "go" (NML-1111-8); D-1 c (NML-1112-2); Start Approval required; deploy (C-1) is a separate Founder approval after review
PACKET:       MA-NOV-EXP.W1R2 · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
`claude/specs/MA-NOV-EXP_Spec.md` (approved, sha256 pinned in the Task) — §3.2 identity rule, §4 data contract (R-EXP1), §4.4–4.5 budgets, §7 tests, §8 C-1, §9 EXP.W1, §10 three-point check. **Amendment A1 (binding), as refined by D-1 c (NML-1112-2):** no single look-through may read more than 50,000 rows. The holdings cap is set from the **measured** rows-per-holding of the leaner query (with margin), not from the spec's 2.7. ETFs above the cap get the documented `too_large` error. Continues from MA-NOV-EXP.W1's uncommitted working tree (pinned in the Task); W1 report `claude/packets/MA-NOV-EXP.W1_Report.md` §4–5 is the starting point.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f215681` = origin). Execute from `claude/packets/MA-NOV-EXP.W1R2_Task_v1.md`. Writable (checked by `end`): `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/`, `claude/packets/MA-NOV-EXP.W1R2_Report.md`. `allow_commits: true`; may push `November-2026` (not a deploy branch — Pages serves `October-2026`).

## Allowed actions
Edit the writable paths; run tests with Node's built-in runner and `node:sqlite` (or another SQLite already installed — no npm installs); `npx wrangler deploy --dry-run -c "App/Corporate Atlas/wrangler-entities-api.toml"` (build check only, no upload) if that config exists; **up to 10 read-only D1 statements** from the repo root without `-c` (`SELECT` / `EXPLAIN QUERY PLAN`, plan-check first, no SCAN of large tables, ≤120,000 rows read in total, code 10000 → retry once after 30 s) for the three-point check: plan of the final SQL, single execution for EEM and VXUS, holdings count of the largest ETFs; read-only `git` and `git ls-remote`; `git add -- <explicit path>`; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
`wrangler deploy` (real), `wrangler tail`, secrets, `.env*`, routes/bindings/config changes (`wrangler-*.toml`); D1 writes/DDL; editing any other file (incl. `ma-*.js`, `index.html`, `docs/`, other Workers); `*_Status.json`, `config.json`, board, Tower, `transitions.jsonl`, logs; LaunchAgents, cron; npm installs; subagents; `13F Seed/gleif-seed.js`; force-push, branch create/delete, rebase, reset, stash, clean.

## Stop gates
Pinned hash mismatch; a spec requirement that needs a schema change, a new binding or a config change (stop and report); the plan shows a SCAN of a large table; any single statement that would read > 50,000 rows by projection (do not run it); tests failing after bounded fixes; push rejected → stop, report, `end`.

## Success conditions
R-EXP1 and the `/etf-exposure` fix implemented to the spec with A1; read-budget header comment; route tests green on local fixtures; three-point check recorded with measured numbers; one commit with exactly the Task's files, pushed; report; `end`. Nothing deployed.
