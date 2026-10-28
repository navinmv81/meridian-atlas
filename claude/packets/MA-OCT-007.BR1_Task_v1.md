# MA-OCT-007.BR1 — Task v1 (immutable): UX Lead + Data-Identity build review of 007 Phase 1, before UAT (Thu 22)

**ISSUED BY:** Main Lane, Wed 21 Oct · **EXECUTED BY:** REVIEW-007 (UX Lead, with the Data-Identity checks below)

Inputs: `claude/MA-OCT-007_Spec.md` rev 1.4 (`4d4fffef…397c`) §5, AC1–AC8, N7-13..N7-16; `claude/packets/MA-OCT-007.P1_Report.md` (`e9c8c374ce73c38cefb2f8ba19bff95075eb89f8e1bbebf68d64e0318ccb232c`) Thu 15 + Sun 18 sections; commits `0dd7ef0` (Worker, live `73851c02`) and `3989ab1` (front end, not released); files `App/ma-data.js`, `App/index.html`, `App/ma-entities.js`, `App/Corporate Atlas/src/entities-api.js`. Read-only code review; you may open the live read-only Worker routes in a browser for ≤ 20 lookups; 0 D1 writes; no deploys; no git writes. You did not build this.

1. **UX:** the four Instrument-card states and their copy match §5.4; ambiguous never pre-selects; outage shows "Couldn't reach Corporate Atlas" + Retry, never "unmatched"; Back closes exactly one layer; deep links return to Home on the site (N7-13); 375 px layout.
2. **Data-Identity:** navigation is keyed on `entity_id` / `instrument_key` only; source and confidence shown honestly (heuristic 75 → Low); merged ids redirect with notice; removed ids show the gone page; no name-based linking.
3. **Known limits accepted for UAT:** T8a (ETF file calls the Worker directly) until Phase 2; `etf:` origin on cold load; page-1-only rebuild.
4. **UAT sheet:** produce `claude/MA-OCT-007_UAT_Sheet.md` — 8–12 steps the Founder can run in a browser on Thu 22 (local preview URL or the steps the build lane will serve), using the cases in the report (XS2199266698 low confidence, issuer 28088, ambiguous ISINs, removed id 25782), each with expected result and a pass/fail box.

Verdict: READY FOR UAT / READY WITH NOTES / NOT READY. Write `claude/packets/MA-OCT-007.BR1_Report.md` and the UAT sheet. Reply **"MA-OCT-007.BR1 reported"**.
