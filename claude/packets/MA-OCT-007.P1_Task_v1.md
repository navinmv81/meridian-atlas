# MA-OCT-007.P1 — Task v1 (immutable): 007 Phase 1 build

**ISSUED BY:** Main Lane, Wed 14 Oct · **EXECUTED BY:** LANE-1-ENG, Engineering Lead · **REVIEWED BY:** UX Lead + Data-Identity Lead (build review, separate packet) · **APPROVED BY:** Founder (GATE-1012 D2 A; UAT from 22 Oct)

Build **Phase 1** of `claude/MA-OCT-007_Spec.md` **rev 1.4** (`4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c`) §12: routes **R1, R2, R3, R4** on `meridian-entities-api`; the `index.html` router; `ma-data.js` helpers; `ma-entities.js` card, badges, paging, merged-into notice and fallback. **R5 is out of v1.** Required: **N7-13** (deep-link first load + in-app Back goes home, never leaves the site; ML-1010-8). All R7-1..R7-10 behaviour as written. Use the ENT-CR1 after-set measurements (`claude/packets/MA-OCT-ENT-CR1.EXEC_Report.md`) for R7-7's *k*.

**Hard deadline — Entities Worker freeze 17–23 Oct (011 N-3):** the `meridian-entities-api` Worker deploy (backward-compatible, §7.1) must be **live and verified by Fri 16, 22:00 UTC**, outside every FREEZES.json window. If it cannot be, stop before deploying and report; the next deploy slot is Sat 24 Oct 08:05 UTC (UAT would move). The front-end parts are **not released** (Pages ships at the October go-live); build and test them locally through Wed 21.

Limits: read-only D1 for plan checks and tests (≤ 20k reads); 0 D1 writes; no ETF files (`ma-etf.js` is Phase 2); no R5; commits by explicit path (you are the committer). Report daily in `claude/packets/MA-OCT-007.P1_Report.md`; stop at the end of each day: **"MA-OCT-007.P1 day <date> reported"**.
