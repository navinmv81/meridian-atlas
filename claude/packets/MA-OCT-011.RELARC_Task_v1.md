# MA-OCT-011.RELARC — Task v1 (immutable): Architect release review of the Fri 16 plan

**ISSUED BY:** Main Lane, Thu 15 Oct · **EXECUTED BY:** REVIEW-A, Architect · **APPROVED BY:** Founder

**Start only after** the Main Lane marks MA-OCT-011.FRI verified on `STATUS_BOARD.md`. Doc and local-file review only: 0 D1, 0 GLEIF, no git writes.

Inputs: `claude/packets/MA-OCT-011.FRI_Report.md` (hash as on the board), the plan file and exports it lists, `claude/MA-OCT-011_Spec.md` rev 1.10 (`6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`), `claude/MA-OCT-011_Architect_Review.md` (`35eb3f274dbd8727ecd9eb110e855a2702b91bd59683a8236148a8e0cc8a7633`), `claude/packets/MA-OCT-011.R110R_Report.md`, OPSR report (`87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f`).

1. **Plan integrity:** the plan file SHA-256 on disk equals the FRI report; it was built from the fresh export (export hashes match), not the 29 Sep D2.
2. **N-2 tier tags:** every write statement carries a high-tier tag; 0 statements from T1_LAPSED, T1+/T1c, N+, D5-3, D7-2 or the 9 D7-1 government rows; the 24 wrong-LEI rows and KI 22.9 edges absent; B limited to the 29 Sep pool.
3. **E-A / ECA:** E-1 exclusions listed, not written; every E-A and ECA edge depends on its A write; RA-15 gating as built; no ultimate edges (E-5).
4. **Drift:** bucket changes vs the 29 Sep basis traced (ML-1015-3); §9 whole-table expectation stated (ML-1015-1).
5. **Three-point check:** EXPLAIN set on file and unchanged; every execution ≤ 50k reads (export pages included); the read projection and R9-1 ceiling set from the R9-3 outcome.
6. **Control surface:** kill, pause, status, resume, restore and `--ea-release` (OPS-R10 format) present and as tested.

Verdict: PASS / PASS WITH NOTES / FAIL, with numbered items. Write `claude/packets/MA-OCT-011.RELARC_Report.md`. Reply **"MA-OCT-011.RELARC reported"**.
