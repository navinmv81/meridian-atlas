# MA-OCT-003.REVDIL — Task v1 (immutable): Data-Identity Lead review of the 003 and 004 specs (rev 0)

**ISSUED BY:** Main Lane, Sat 17 Oct · **EXECUTED BY:** LANE-11, Data-Identity Lead · **APPROVED BY:** Founder

Inputs: `claude/MA-OCT-003_Spec.md` rev 0 (`8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91`), `claude/MA-OCT-004_Spec.md` rev 0 (`c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889`), `claude/packets/MA-OCT-003.SPEC_Report.md`, `claude/packets/MA-OCT-003_ReadPack_Results.md`, `claude/MA-OCT-002_Spec.md` rev 1.3, the October Decisions Log. Doc-only: 0 D1, no deploys, no git writes. You did not author these specs.

Review both specs as Data-Identity Lead:
1. **Exception and ticket model:** GLEIF exception codes E1–E6 (from 006), `entity_exceptions` keep-until-drop, how 011 exception reasons and the 013 hand-off appear; no data-identity rule weakened.
2. **DQ tickets (004):** the known items are covered with owners — KI 22.9 edges, KI 22.44 (24 wrong LEIs), KI 22.43 markers, 008's items (Welltower Inc CIK on entity 2289; no entity for GM Financial, Welltower Inc, Pfizer Netherlands International Finance), the OTP Bank pair (entities 2019 / 467290) from 011; who may raise and who may resolve.
3. **Interaction with the 011 run (17–23 Oct):** nothing in 003/004 writes Entities tables during the window; any build step that would is moved to Sat 24 or later.
4. **Acceptance criteria:** testable, with counts where known.
5. **Founder questions** (003 §19 Q1–Q3, 004 §19 Q1–Q3): recommended answer and one-line reason for each.

Note: you remain on call for the 011 A-pilot adjudication (Wed 21); this review must not delay it.

Verdict per spec: PASS / PASS WITH NOTES / FAIL, numbered required changes. Write `claude/packets/MA-OCT-003.REVDIL_Report.md`. Reply **"MA-OCT-003.REVDIL reported"**.
