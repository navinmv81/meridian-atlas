# MA-OCT-009.SPEC1 — Task v1 (immutable): 009/010 spec rev 1 — fold the 16 review must-fix items

Governing: ML-1027-2. Doc-only (no D1, no deploys, no git writes, no secrets).

Inputs (verify SHA-256): spec rev 0 `8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4`; Architect review `claude/MA-OCT-009_010_Architect_Review.md` `15d0ef4c4dc878fc346f3cbc886ccdc1b02e16543ed128456e059011af370d58`; DIL review `claude/MA-OCT-009_010_DIL_Review.md` `5bb8b8c77343469de890c059e9c1a9c0ed99d76c1863123abd3046e345882777`.

Do: produce **rev 1** in place with a "Changes in rev 1" table mapping **every** MUST-FIX (Architect M-1..M-7, DIL M-1..M-9) to the section changed, and each NOTE to accepted/deferred. Resolve the two PepsiCo-check definitions into one (DIL M-3 premise: the 4 rows have `instrument_key = NULL`; Architect M-3: no ISIN scan of `fund_holdings_monthly`, use `idx_holdings_cusip` + `instrument_master` PK). Calendar per Option C: build Thu 29 from LANE-1-ENG's committed retirement `entities-api.js` (hash in tonight's WED28.ENG1 report — leave a placeholder if not yet reported), gate migration (closed) + pre-deploy check + one deploy Thu 29, gate opening = Data-Identity Lead + **Founder acknowledgement** (after Mon 2 Nov: Founder approval), front ends in the Mon 2 Nov site release **only if gated R1f is live**. Include the M-6 cache proof step or uncached budget, the M-4 rollback rule, M-5 cache key, M-7 cursor definition, DIL Q6 (withhold counts) and Q7. Keep §14 Founder answers as decided (Q1–Q3 yes).

Write `claude/packets/MA-OCT-009.SPEC1_Report.md` (old/new SHA-256, line count, mapping table summary). Reply **"MA-OCT-009.SPEC1 reported"**.
