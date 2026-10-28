# MA-OCT-011.FRI — Task v1 (immutable): Fri 16 export, re-projection, plan generation and freshness gate

**ISSUED BY:** Main Lane, Thu 15 Oct · **EXECUTED BY:** LANE-11-ENG, Engineering Lead · **REVIEWED BY:** Architect (MA-OCT-011.RELARC) + Operations Lead (MA-OCT-011.RELOPS) · **APPROVED BY:** Founder

Governing: `claude/MA-OCT-011_Spec.md` rev 1.10 (`6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`) §4.1, §4.2c, §6, §11 Fri 16 row; Ops rulings OPS-R9 / OPS-R10 in `claude/packets/MA-OCT-011.OPSR_Report.md` (`87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f`); your build report (`c8f664281707ae92769ad3b8f17fc231ff8f648810a78cc7fba4e1b2fcca653f`).

**Timing (UTC, check `claude/relays/FREEZES.json` before each step):** start the export **after 07:10** (after the 06:50 cron and the enrich freeze). Do not run D1 steps inside 10:45–11:15 or 16:45–17:15. **Target: report written by 15:00 UTC** so both release reviews can finish the same day.

1. **Preflight.** No `.git/*.lock`; record HEAD; re-hash this Task and the Control; re-hash the spec, OPSR report and runner files against your build report. Any mismatch: stop.
2. **Fresh X1/X2 keyset export** with `--max-reads 160000` (OPS-R9 R9-2). Every page ≤ 50k reads. Record per table: rows, metered reads, measured multiplier; SHA-256 of each export file. **If the export hits 160k or any page exceeds 50k: stop, write the report, no plan.**
3. **Re-projection line (R9-3).** Write exactly one line at the top of the report:
   `R9-3: export reads = <X> (X1 <a>, X2 <b>; multiplier <m>); projected total = <X> + 140k + <X> = <T>; outcome = PROCEED (≤350k) | CEILING 450k (350k–450k, pre-ruled) | STOP (>450k)`.
   On STOP: no plan release; report and stop (Ops re-rules before the Sat 17 pilot).
4. **Runner read ceiling (R9-1).** Confirm the runner keeps a cumulative 011 `rows_read` (from `meta.rows_read`, all steps including exports), stops **before** any step that would exceed the ceiling, and logs the total in each `recon/<date>/`. Set the ceiling from step 3's outcome (350k or 450k). If any part is missing, implement it on the 011 paths with a test; tests must pass.
5. **Plan generation** from the fresh export (§4.2c). The plan header cites rev 1.9 and rev 1.10 (rev 1.10 only if `STATUS_BOARD.md` shows it APPROVED when you generate; otherwise rev 1.9 and note it). Record: plan SHA-256; counts per bucket and per tier tag (N-2: 0 statements from excluded tiers); write projection (≤ 110k total, ≤ 25k/day schedule); drift vs the 29 Sep basis, traced row by row in bucket terms (ML-1015-3); the P parent now already present (skipped); E-1 exclusions; §9 expected whole-table figure (ML-1015-1).
6. **Freshness gate** (§11, R-1 (a)): seeded sample from the releasable plan, ≤ 50 rows, unique LEIs, **≥ 15 A**; ≤ 50 GLEIF API calls; ≥ 98% agreement; **0 A identity mismatches**. Any A mismatch = E-4 trigger: write `holds/e4-trigger.json`, stop, report.
7. **Release-check evidence** (for RELOPS): cite the fail-closed `d1-today` outage test (test name + pass); F-4 lag record (12–13 Oct measurements 25–30 min; F-5 in force); list the control-surface commands for Sat 17.

**Not allowed:** any 011 production write batch or the pilot; ops registry, keys or pause rows; Worker deploys; git writes (ML-1012-2); edits outside the 011 paths and `~/MeridianAtlas-work/gleif-011/`.

**Budget:** D1 reads ≤ 170k total (export ≤ 160k + ≤ 10k other); D1 writes 0, except ops ingest heartbeats via `gleif-011` (≤ 50 row-writes, counted per ML-1010-3); GLEIF ≤ 50 calls.

Write `claude/packets/MA-OCT-011.FRI_Report.md`, R9-3 line first, then an artefact table with SHA-256s. Reply **"MA-OCT-011.FRI reported"**.
