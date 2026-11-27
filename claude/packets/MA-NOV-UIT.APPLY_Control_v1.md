# MA-NOV-UIT.APPLY — Write the one-off UIT holdings (SPY, QQQ, DIA, MDY) to D1 — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  ETF Product Lead + Tech Ops — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; MA-NOV-PATCH.REL checks the exposure route live
APPROVED BY:  Founder — this packet's Start Approval covers the production D1 writes in `uit-apply-run1.sql` and nothing else
PACKET:       MA-NOV-UIT.APPLY · Control v1 · usage class small · write owner ETF Product Lead
```

## What
Run the pinned `App/ETF Refresh/uit/apply/uit-apply-run1.sql` (14 batches, 1,051 statements, ≈ 12.5k row-writes) exactly as **MA-NOV-UIT.REVIEW §8** specifies — preflight 8.1, batches 8.2, verify 8.3, rollback triggers 8.4 and order 8.5 — with one Main Lane amendment to the time rule (below). No code changes, no deploys.

## Time and headroom (amends REVIEW §7/§8.1 step 2)
- Any day **except Sunday and Monday** (UTC). Start a batch only outside **05:50–07:10Z, 11:40–12:10Z, 17:40–18:10Z and 23:50–00:10Z** (the 06:00/06:50 Worker runs, the 11:50/17:50 London enrich-boost runs, the day boundary), and only if the whole apply can finish before the next such window (it takes minutes).
- Today's expbf run has finished (ledger end row for `cf.meridian-entities-enrich.expbf` today).
- Headroom: meridian-ops `/api/ops/cf/d1-today` `rowsWritten` ≤ **45,000**, read ≤ 120 s before batch 1 (one authenticated GET is allowed for this; never print the token).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `e8868b3` = origin). D1 from the repo root with `--remote`, **no `-c`**. Code 10000: retry the same statement once after `whoami`; a batch retry follows REVIEW §8.4(a) only. Writable (checked by `end`): `claude/packets/MA-NOV-UIT.APPLY_Report.md` only. `allow_commits: true` (report only); may push `November-2026`.

## Allowed actions
`whoami`; read-only git, `git ls-remote`; pin hashes; the UIT tests (read-only); read-only D1 statements exactly as REVIEW §8.1 / §8.3 (≤ 15 statements, ≤ 15,000 rows read; equality per fund, **never `series_id IN (…)`**, no PRAGMA); one d1-today GET before batch 1 and one after; the 14 batches, each once (resume per §8.4(a) only); the pinned rollback per §8.5 only on a trigger; write the report; one commit; push.

## Prohibited actions
Any other SQL write; editing or rebuilding pinned files; the optional rollback batch 2 unless rolling back; `holdings_pipeline_state`; Entities-domain tables (incl. `fund_entity_link`); deploys, toml, crons, secrets; other Workers; `docs/`; `.env*`, printing tokens; Status/board/Tower/`transitions.jsonl`/logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pin mismatch; HEAD ≠ origin; time/headroom rule not met; §8.1 state recheck differs from `uit-summary.json`; a second code-10000 failure.

## Success conditions
All 14 batches match their vectors (Σ 2,086); the four §8.3 verify rows exactly as REVIEW's table; `sqlite_sequence` = 2,030,400 and no id above it; IVV control unchanged; d1-today before/after; report (header, preflight, batches table, verify table, writes/reads, rollback commands ready, boundaries); one commit pushed; `end`.
