# MA-NOV-BOND.FIX2 — Term-sheet identifiers (F6), FWP conflicts (F5), dropped-tranche drafts (F2b), offline whole-corpus dry run + apply SQL — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; BOND.REVIEW (independent) before the reliability write (U6)
APPROVED BY:  Founder — bond spec v2 (NML-1122-2); Start Approval required. No D1 writes, no SEC requests
PACKET:       MA-NOV-BOND.FIX2 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Scope
Spec v1 §4 F5 and F6 (carried by v2; pinned), FIX1 report §4–5 (pinned):
- **F6:** identifiers (CUSIP/ISIN) — and, per spec v2, pricing date and banks where the same term sheet carries them — from same-deal FWP layouts: per-tranche "CUSIP / ISIN:" lines, one-column-per-tranche tables, "CUSIP No." blocks; diagnose the 354 tranches without CUSIP offline first, then add the common layouts.
- **F5:** the 3 `fwp_conflict` rows (Verizon 2035, Dominion 2025/2026 Series B): reopening → keep 424B values + note; otherwise stays failed with the reason.
- **F2b (Main Lane recommendation, approved with this packet):** a draft also links to its final when the final's tranches are a **subset** of the draft's (a tranche dropped at pricing — the ICE pair and 7 similar), reason `superseded` with note `tranche dropped at pricing`.
- **Whole-corpus offline dry run** with the full linking set (FIX1 note: link against all finals, not only one run's filings) → before (D1 today) vs after diff, **apply SQL + rollback SQL** for U6 (assuming CR1's two columns), and T2/T3/T4/T5 restated with arithmetic.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `6aa5c39` = origin). Writable (checked by `end`): `App/Corporate Atlas/bonds/bonds-parse.mjs`, `bonds-ingest.mjs`, `bonds-lib.mjs`, `App/Corporate Atlas/bonds/tests/`, `App/Corporate Atlas/bonds/fixtures/`, `App/Corporate Atlas/bonds/apply/` (new: apply + rollback SQL, diff), `claude/packets/MA-NOV-BOND.FIX2_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; read the cache and stored state; scratchpad harness for the offline dry run (as FIX1 §4.4); **up to 6 read-only D1 SELECTs** (≤ 30,000 rows) to read today's `bond_issuance` for the before side and the apply diff; tests; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Running the apply or rollback SQL; any D1 write or migration; SEC/EDGAR or other network requests; Workers, front end, `docs/`; `bonds-config.json` caps; `.env*`; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; an unlisted change to a previously-final row (T5) that cannot be explained; the apply SQL would exceed the 8,000-write run cap (split into runs and say so); tests failing; push rejected.

## Success conditions
F5, F6, F2b done with fixtures + tests; all bond tests green; offline whole-corpus dry run with T1–T5 restated; apply + rollback SQL committed (not run) with expected write counts; one commit pushed; report; `end`.
