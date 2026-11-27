# MA-NOV-UIT.REVIEW — Independent review of the one-off UIT holdings load before it is written — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  Reviewer (ETF domain, independent of UIT.BUILD) + Tech Ops — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane
APPROVED BY:  Founder — Start Approval (read-only review; verdict decides whether MA-NOV-UIT.APPLY may run)
PACKET:       MA-NOV-UIT.REVIEW · Control v1 · usage class small · write owner Reviewer
```

## Review questions
1. **Facts per fund:** from the cached NPORT-P XMLs (hash-checked against `uit/cache/manifest.json`), independently of the build's code: holdings count, Σ weight, period, `regCik`, `seriesId` presence — do they match the report §1/§4 and `uit-summary.json`? Spot-check 10 random holdings per fund (name, CUSIP/ISIN, value, pct) from the XML against the apply SQL rows.
2. **Correctness of keys and `etf_master` changes:** surrogate format; QQQ's real series id; D2 (CIK correction for DIA/MDY) — confirm the SEC CIKs from the cached submissions/ticker-map evidence; guards on prior values; the note text.
3. **SQL safety:** every statement is `INSERT OR IGNORE`/guarded `UPDATE` as described; vectors equal the dry-run changes; no `DELETE`/`holdings_pipeline_state`/Entities tables in the apply; rollback restores exactly; explicit id ranges (2,000,001+) — acceptable, or should ids be left to AUTOINCREMENT? (the rollback keys on series + month either way); the optional `sqlite_sequence` batch.
4. **Side effects:** the Sunday `meridian-holdings` universe grows 237 → 241 (surrogates: 1 EFTS fetch, 0 writes; QQQ ingested normally) — any risk to the current offset, the 80k guard, `universe_changes_monthly`/`computeUniverseChanges`, or `refreshPhaseReadinessCache`? Any other reader of `etf_master.has_nport`/`coverage_status` (ETF screens, `ma-etf.js`, overlap, 13F) that changes behaviour?
5. **Exposure:** MDY mapping coverage — read `instrument_entity_map` for MDY's identifiers (indexed lookups only) and report holdings/weight mapped for all 4; expected exposure-route reads and body size vs caps.
6. **Budget and timing:** the three-point check numbers; when to apply (not Sunday; headroom ≤ 58k live including the 06:00 back-fill); the verify queries the apply must use (equality per fund, never `series_id IN (…)`).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `e4f2f02` + nothing else committed by others = origin). D1 reads from the repo root with `--remote`, no `-c`. Writable (checked by `end`): `claude/packets/MA-NOV-UIT.REVIEW_Report.md` only. `allow_commits: true` (report only); may push.

## Allowed actions
Read any repo file; run the UIT tests and the build's dry run in a scratch directory outside the repo; write independent check scripts **outside the repo**; read-only D1 SELECTs / `EXPLAIN QUERY PLAN` (≤ 20 statements, ≤ 40,000 rows; equality lookups; no `series_id IN (…)` month reads, no full scans, no PRAGMA checks); no SEC calls (use the cache); write the report; one commit; push.

## Prohibited actions
Any D1 write; editing any file but the report; deploys; `.env*`; Status/board/Tower/logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Success conditions
Verdict **PASS / PASS_WITH_NOTES / CHANGES_REQUIRED** with findings ranked (B blocking / M must-fix-before-apply / N note); answers to Q1–Q6; the exact apply procedure and verify queries for UIT.APPLY; `end`.
