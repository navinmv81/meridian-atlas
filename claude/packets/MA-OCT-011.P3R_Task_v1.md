# MA-OCT-011.P3R — Task v1 (immutable): Architect review of the 011 runner P-3 retry fix

**ISSUED BY:** Main Lane, Sat 17 Oct · **EXECUTED BY:** REVIEW-A, Architect · **APPROVED BY:** Founder (ML-1017-2)

Context: RUN Task v2 P-3 requires: no retry inside a batch after any write; a batch either completes and checkpoints or stops with the cursor kept; retry only before the batch's first statement. LANE-11-ENG found the runner's `execWithRetry` blind-retried whole batches (P-3 not met), stopped before the pilot with **0 D1 writes**, and changed `executeBatch`: after a failed call it reads the batch rows back and retries only if every row still equals its pre-image; otherwise the batch fails, the cursor stays, and the checkpoint records applied rows for restore.

Inputs: `claude/packets/MA-OCT-011.RUN_Report.md` (`e3961beae758f306696f79c5f7030d063cb3e8d57a6ae8a7a523a7db2c136d96`) Sat 17 section; `~/MeridianAtlas-work/gleif-011/review/p3-fix-excerpt.txt` (`7293a53c…5e48` per the report); the live code `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` and `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs`; `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs`. Read-only; do not run code; 0 D1; no git writes.

Check:
1. The fix meets P-3 exactly, including a failure **after** a partial apply and a **concurrent writer** changing a row (must not retry).
2. The read-back costs stay within R9-1 (counted in the ledger) and per-execution ≤ 50k.
3. No change to the plan, the SQL set (P-1 hash `f5ae0dba…dd32` unchanged) or any other gate (headroom, freeze, kill/pause, ceiling, CAS).
4. Restore from a `failed` checkpoint returns exact pre-images (tests cover all-applied and half-applied).
5. P-2 at 36/0/0 (34 + 2 new P-3 tests) is acceptable in place of RELOPS's 34.

Verdict: PASS / PASS WITH NOTES / FAIL. Write `claude/packets/MA-OCT-011.P3R_Report.md`. Reply **"MA-OCT-011.P3R reported"**.
