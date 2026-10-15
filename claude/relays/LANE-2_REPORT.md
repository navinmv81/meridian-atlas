# LANE-2 (Operations Lead — 002 spec): REPORT — reply to LANE-2_NEXT.md

```text
ISSUED BY:    Operations Lead (LANE-2), 9 Oct 2026
EXECUTED BY:  Operations Lead — doc-only: no D1, no git writes, no code edits
REVIEWED BY:  REVIEW-A (independent) / Main Lane hash check
APPROVED BY:  Founder (Fri 9 Oct)
RE:           claude/relays/LANE-2_NEXT.md  sha256 fb1fcbdbd2b6a6de223399d71f5121064a4387154dc3f49a32ab0d8912104e4c
```

## Result
**`claude/MA-OCT-002_Spec.md` rev 1.3 — SHA-256 `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893`** (840 lines). Repo copy; Project copy re-uploaded from the same file.
Supersedes rev 1.2 `98c0ef370e398d2a5ac0d8f39731d0e49b1eec6cf02d1d8a06446cc298c4dbf2`.

**Provenance note:** on opening, the repo file already held a rev 1.3 draft (`abff1f4c8d8dee358ba2e682c9cf2812ebdb1d4044324acb8ed095317652a9e1`, saved 8 Oct 19:48 UTC by an earlier LANE-2 run that wrote no report). It covered items 1, 2, 4–8 and left R-C "pending the Data-Identity Lead". I diffed it line by line against rev 1.2, checked each item against the NEXT file, and completed R-C from `LANE-6_REPORT.md` (saved 19:47). The `abff1f4c` draft was never reported or logged; the hash above is the one to verify.

## What was done (NEXT items)
| # | Item | Where |
|---|---|---|
| 1 | **R-A:** seed `/run`, figi `/run` + `/rematch` gated in A5 (KI 22.49); **CR-7b** row; A5 re-estimated 0.25 → **0.5 d**; G6, §1, §0 item 9, AC-a5, §19.4 A5 (roll-forward) updated | §5.1, §10, §17, §19 |
| 2 | **R-B:** §8.5 argument restated with a table of every blind guard during 17–23 Oct (enrich cron, seed, figi, delta, holdings); seed/figi/delta closed by A5; re-cited to **011 rev 1.6 `6f9681ab…4513c`** §4.3, §4.4, §7, §8, §11 (rev 1.2 line numbers retired) | §8.5, §21 |
| 3 | **R-C:** CR-7 path **(ii)** per the Data-Identity Lead (L6-1): ship repo + gate; `b238e36` (already deployed in substance) and `1b6a7a3` (inert, cron held) ACKed; stop rule = **C1** (deployed vs `--dry-run` bundle; delta: only the `1b6a7a3` hunk allowed; seed/figi: none). **CR-6** gets the same diff check, no allowed difference, stop and report to the ETF PL | §10.1, §10.2, §17 |
| 4 | **R-D:** the five missing Data-Identity conditions written in (3-field line layout; unreachable `d1-today` → `error`/`headroom_unavailable`, no `/run`; spool under `Corporate Atlas/logs/`; live by Wed 14 Oct; Bug 2 untouched; 401 ×2 and `delta_last_run` absent). "Constant-time compare copying enrich" removed — now "fail closed + constant-time; enrich's `!==` is not the model". Plus **C1–C6** from L6-2 for all three Workers | §8.6, §10, §10.1 |
| 5 | **R-E:** deterministic `case_ref = 'EXC-S-' + first 12 hex of SHA-256(dedupe_key)` with a collision guard; audit row `INSERT OR IGNORE … SELECT … WHERE dedupe_key = ?` with `idempotency_key = 'raised:' || dedupe_key` | §7.2 |
| 6 | Build-brief notes: zero-read raise cap (B-1 replaced); rollback order A3 → A2 → A1 → A6 (R-1); A4 and A5 before A6 if time is short (R-2); plus the review's CR-5/CR-8/011/CORS notes (R-3 to R-6) | §5.1, §19.5 |
| 7 | 011 rev 1.6: **(a)** `ops_job_pause` row 17 → 24 Oct inserted by the Operations Lead **by Fri 16 Oct** — dated release task (needs the A2 migration, Sat 10); **(b)** 120 s freshness: record the measured `d1-today` lag at A4 and state whether 120 s is adequate; > 10 min goes to the 011 lane before its Fri 16 release check | §6.3, §8.5, §18 |
| 8 | §16.1: Q1–Q3 **confirmed 8 Oct**; Q4 (R-A) recorded | §16.1 |

## Rulings
- **L2-1:** CR-6 (bootstrap) uses the C1 diff method with **no** allowed difference; on any difference the build stops and reports to the ETF PL (no "edit the deployed source" fallback, which would create the drift L6-1 rejects).
- **L2-2:** the raise cap uses the zero-read method (sum of `detail.metrics.raised` over today's `local.health-check` end events); the `ops_case_event` index option is dropped.
- **L2-3:** `case_ref` for sweep raises uses the `EXC-S-` prefix so it never collides with 003's human `EXC-000001` sequence.

## Questions (none blocking approval)
1. **R-5 (2) in §19.5:** 011's job `manual.gleif-reconcile-011` and its emitter key must be registered before its first write — I named the Operations Lead, by Fri 16 Oct. Main Lane to confirm that owner, or move it to the 011 lane.
2. **C1 needs a deployed-script download.** The spec says the wrangler 4.96.0 OAuth session can do it (CLAUDE.md: it has `workers_scripts` scope). If it cannot, the Founder's Workers-Read token is needed by Sat 10.

## Files
- Written: `claude/MA-OCT-002_Spec.md` (rev 1.3, hash above); `claude/relays/LANE-2_REPORT.md` (this file).
- Read: `claude/relays/LANE-2_NEXT.md` (`fb1fcbdb…4e4c`); `claude/MA-OCT-002_Independent_Review.md` (`8004afb7…3ce5`); `claude/relays/LANE-6_REPORT.md` (`54ac356e09e030f57fe6d24ef1b47a36635686ed21a6372d390c17140431f972`); `claude/MA-OCT-011_Spec.md` (`6f9681ab…4513c`); `claude/October_Decisions_Log.md` (8 Oct entries).
- HEAD `16918e0`, no `.git/*.lock`, read with `--no-optional-locks`. 0 D1 reads.
