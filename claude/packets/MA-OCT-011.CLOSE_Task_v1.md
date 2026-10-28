# MA-OCT-011.CLOSE — Task v1 (immutable): 011 verification and close-out package (completed steps only; A deferred)

**ISSUED BY:** Main Lane, Thu 22 Oct · **EXECUTED BY:** LANE-11-ENG, Engineering Lead · **REVIEWED BY:** Architect + Operations Lead (close-out review) · **APPROVED BY:** Founder

Governing: spec rev 1.10 (`6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`) §9, §10, §11; Founder "Defer A" (21 Oct, ML-1021-2); RUN report (`d032abfbb44517ae130ca10028d9417e26dc09618ae1edf22bce84dcf452b28b`); RECOND report (`07d02d69bcf03ba918730b2e290851b2761ac578aba6eb6484d5a9e5b277c412`); APILOT report (`2f66708114bc60f158ea0ff023ae72b31438247143bffe875faa27b9132e4206`).

**When:** Fri 23, outside freezes; no 011 write batch runs (none remain). Reads only.

1. **Runner state:** `status.sh` shows next = A-001 with A, ECA, E-A and Q refused (resolve the `A-001+` vs `A-001` wording Ops noted); E-4 trigger and `ea-dropped.json` present.
2. **Post-run re-export** (X1/X2, under R9-1: cumulative must stay ≤ 350k) and **§9 checks re-based without A**: whole-table LEI expectation = 20,612 − 3,677 A (+/− traced drift); 200-row sampled diff against `gleif_006.db` (E-A part not applicable); the pre-image invariants (no `normalized_name`/`type` writes, no LEI overwrite, no placeholder names, 24 wrong-LEI rows and KI 22.9 edges untouched, no new duplicate LEIs).
3. **Spot checks:** 25 rows across P/B/C/C-reasons against the 28 Sep Golden Copy (the GLEIF API is blocked by the egress proxy; say so).
4. **Close-out lists with SHA-256s:** the 013 hand-off file (§11, incl. deferred LEIs' full payload); manual-review lists; A deferral list (3,676 A, 298 E-A, 45 ECA) with **2303, 2488 and the 29 legal-form-mismatch rows** flagged; 204823 and 207528 (Mon 19); the OTP Bank pair; collision list; retained rollback inputs (§7/§10).
5. **Totals table:** per day rows/writes/reads, the restore, and final cumulative reads.
6. **Hand-offs for Sat 24+ (not done in this packet):** K-5 (remove the `gleif-011` key; LANE-1-ENG with Ops), boost resume after 23 Oct (LANE-1-ENG), A2 re-plan inputs.

**Not allowed:** any D1 write, any A/ECA/E-A/Q action, key or Worker changes, git writes.
**Budget:** reads ≤ 177k remaining under R9-1 (expected ≈ 75k).

Write `claude/packets/MA-OCT-011.CLOSE_Report.md`. Reply **"MA-OCT-011.CLOSE reported"**.
