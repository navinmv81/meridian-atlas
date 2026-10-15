# MA-OCT-007.ETF — Task v1 (immutable)

**ISSUED BY:** Main Lane (Program Orchestrator) · **EXECUTED BY:** REVIEW-A, holding the **ETF Product Lead** hat · **REVIEWED BY:** n/a (consult) · **APPROVED BY:** Founder (12 Oct gate)

ETF Product Lead consult on 007's ETF-facing parts only:
1. **§9 Screens touched** — every change to `ma-etf.js` and the ETF parts of `index.html`: ETF API contracts unchanged (metafc additive only), no ETF-domain table written, ETF screens call entities-api only via `ma-data.js` / DOM events (ruling D, §0.2 / §3.4).
2. **O6** — consent (yes / yes with conditions / no) to the Phase 2 changes in `ma-etf.js`.
3. Any ETF read-budget effect of R5 batch badging on holdings pages (§7.2 R5, §11.1: ≈ 300–400 typical, ≤ 1,600 worst per page).

No other sections; no whole-document review.

**Inputs (re-hash first, stop on mismatch):**
- `claude/MA-OCT-007_Spec.md` **rev 1.3** `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e`
- `ma-etf.js` and `index.html` at HEAD `16918e0` (read as found)

**Output:** `claude/MA-OCT-007_ETF_Consult.md` — verdict per item 1–3 (PASS / PASS WITH NOTES / FAIL), O6 answer, any required items (E7-1…).
