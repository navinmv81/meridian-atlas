# MA-OCT-011.OPSR — Task v1 (immutable): Operations Lead rulings and verification before the 011 release check

**ISSUED BY:** Main Lane, Wed 14 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead · **APPROVED BY:** Founder

1. **Read ceiling (F-3):** rule on 011 rev 1.10's proposed **350k** reads (plan ≈ 290k; D1 bills 2 per `IN` row; every execution ≤ 1k; export multiplier unmeasured, ≈ 436k if 2× — Friday's export measures it). Give the ceiling and what happens if Friday's measurement exceeds it.
2. **Confirm ML-1012-1 in 011 rev 1.10 §4.3:** ceiling 60,000; F-1 window max(45 min, since last fetch); ML-1010-3 delivered-write counting; and the interim OQ-7/8/9 rulings (held → skipped/hold; gate refusals to `gate.jsonl` only; freeze prefix match).
3. **Verify MA-OCT-OPS.T12** from its report (`claude/packets/MA-OCT-OPS.T12_Report.md`): emitter list before = `boost-local`, `health-check-local`; after = old + `gleif-011` + `local-bonds`, no other change (K-3); K-4 accept/refuse evidence for both; registry rows; the `ops_job_pause` row 17 → 24 Oct. Sign or list what is missing.
4. **Accept or query 002a A4 production evidence** (`claude/packets/MA-OCT-002a_Report.md` Wed 14 section): 2/14 slots recorded, outbox spool-and-replay seen live, real headroom figures.

Inputs: `claude/MA-OCT-011_Spec.md` rev 1.10 (`63280691…0aaa`), `claude/MA-OCT-011_Ops_Review.md`, the reports named above. Start item 3 only after T12 reports. Doc-only. Write `claude/packets/MA-OCT-011.OPSR_Report.md`. Reply **"MA-OCT-011.OPSR reported"**.
