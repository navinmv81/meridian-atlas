# MA-OCT-008.DIL14 — Task v1 (immutable): 008 §14.2 sample adjudication and name-match sign-off

**ISSUED BY:** Main Lane, Sat 17 Oct · **EXECUTED BY:** LANE-8, Data-Identity Lead (008 spec owner) · **APPROVED BY:** Founder

Inputs: `claude/packets/MA-OCT-008.BUILD_Report.md` (`c58271be9d82bf1a6f02e96c7c1886237e118925a182d5d53e7a16d83ef73271`) — Fri 16 section (60-row sample) and Thu 15 evening section (link seed, C3 proposals); `claude/MA-OCT-008_Spec.md` rev 1.2 §8, §14.2. Read-only: SEC EDGAR filings may be opened in a browser or fetched read-only to check fields; **0 D1 writes, no git writes**. You did not build the runner or draw the sample.

1. **§14.2 sample:** check all 60 rows (240 field checks) against their source filings. Pass rule: ≥ 98% correct (≤ 4 errors), 0 wrong-issuer links, 0 served rows from preliminary/structured/non-debt filings, and the B-3a/B-3b rows correct. Record each error with row, field, expected, found.
2. **Name-match links:** sign or reject Lowe's → 1753, NextEra Energy Capital Holdings → 27953, Welltower OP LLC → 2289, with evidence (name, LEI, CIK). Signed links are applied later by LANE-8-ENG (not in this packet; after 23 Oct).
3. **DQ items for 004:** confirm the list (Welltower Inc CIK stored on entity 2289; no entity for GM Financial, Welltower Inc, Pfizer Netherlands International Finance B.V.) with a proposed resolution each.

Result: **AC12 PASS / FAIL**. A fail blocks 009 reads of bond rows. Write `claude/packets/MA-OCT-008.DIL14_Report.md`. Reply **"MA-OCT-008.DIL14 reported"**.
