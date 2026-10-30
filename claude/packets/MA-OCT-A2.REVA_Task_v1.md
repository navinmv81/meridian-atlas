# MA-OCT-A2.REVA — Task v1 (immutable): Architect review of the A2 spec

Review `claude/MA-OCT-A2_Spec.md` rev 0 (`226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d`) as **Architect**. Founder decisions (ML-1029-2, do not re-open): Q1 freshness gate (≤ 50 GLEIF calls) on the 28 Sep Level 1 basis; Q2 other Entities writers frozen Fri 30 08:05Z → Sun 1 00:10Z (now in FREEZES.json); Q3 A2 defers to November if G-2, FG or the pilot fails. Run Fri 30 – Sat 31; no heavy writes Sun 1; 013 runs Mon 2.

Check: domain/ownership (Entities tables only), reuse of committed 011 code (`58cd922`), read budget per day (011 used 247,468/350k), write budget and batching vs the 100k cap, freeze windows, three-point check, acceptance criteria and spot checks, rollback manifest, `gleif_006.db` retention, and the A2→013 hand-off. Architect focus: correctness of matching rules vs DIL29, idempotency, index use, failure modes.
Doc-only: no D1, no deploys, no git writes, no secrets. Verdict PASS / PASS WITH NOTES / FAIL with findings (BLOCKER / MUST-FIX before run / NOTE).

Write `claude/MA-OCT-A2_Architect_Review.md` and `claude/packets/MA-OCT-A2.REVA_Report.md`. Reply **"MA-OCT-A2.REVA reported"**.
