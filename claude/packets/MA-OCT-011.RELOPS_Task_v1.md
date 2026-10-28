# MA-OCT-011.RELOPS — Task v1 (immutable): Operations Lead release check and release-readiness signature (Fri 16)

**ISSUED BY:** Main Lane, Thu 15 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead · **APPROVED BY:** Founder

**Start only after** (a) MA-OCT-011.RELARC has reported and (b) LANE-1-ENG has appended the boost-pause-flag evidence to `claude/packets/MA-OCT-OPS.T12_Report.md` (after the 16:50 UTC fire; not before 17:15 UTC). Doc-only: 0 D1, no git writes.

Inputs: FRI report, RELARC report, T12 report (with Fri addendum), OPSR report (`87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f`), 011 spec rev 1.10 (`6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`) §11 and the Fri 16 timeline row, `claude/relays/FREEZES.json`.

Check and record each with evidence:
1. **R9-3 outcome** and the run's read ceiling (350k or 450k; ≤ 200k/day, ≤ 50k per execution); R9-1 implemented in the runner. If R9-3 = STOP: re-rule here.
2. **Boost pause flag set** after the 16:50 UTC fire (T12 addendum); `ops_job_pause` id 1 (17 → 24 Oct) present (T12, signed in OPSR).
3. **Observability path:** outbox live (accepted in OPSR) and R-4 daily reconciliation in force (OPS-R8).
4. **F-4 / F-5:** lag recorded; F-5 in force (60k account ceiling; F-1 window max(45 min, since last fetch)).
5. **Fail-closed test** passed (`d1-today` outage → 0 writes, `headroom_unavailable`).
6. **Freshness gate:** ≥ 98% on ≤ 50 calls, ≥ 15 A rows, 0 A identity mismatches, no open E-4 trigger.
7. **Registry and key:** `manual.gleif-reconcile-011` and `gleif-011` live (signed in OPSR).
8. **Architect RELARC verdict** is PASS or PASS WITH NOTES with nothing blocking.
9. **Freezes and N-3:** 011 window Sat 17 00:00 → Sat 24 00:00 UTC in FREEZES.json; N-3 change freeze acknowledged; first batch schedule avoids Sunday, Monday before 08:00 UTC and the enrich windows.
10. **Write budget for the run:** ≤ 25k/day by 011, ≤ 110k total, 60k account gate, 1.3× stop (unchanged).

Result: **RELEASE READINESS SIGNED** or **NOT SIGNED** (with what is missing). If signed, give the one-line release statement for the Founder (plan SHA, ceiling, pilot date). Write `claude/packets/MA-OCT-011.RELOPS_Report.md`. Reply **"MA-OCT-011.RELOPS reported"**.
