# MA-OCT-009.SPEC1 — Report

**Control:** v1 `claude/packets/MA-OCT-009.SPEC1_Control_v1.md` SHA-256 `ae093714dcc5853acdb84a0866c9661d1236c9ff75beddb4602aef8796c7b62c` (matches STATUS_BOARD row 78)
**Task:** v1 `claude/packets/MA-OCT-009.SPEC1_Task_v1.md` SHA-256 `bf66d5554a2c677d2e2e633cd1de153d0353d654f49cb5dfe1ccef7b0bd298a9` (matches the Control)
**Executed by:** Engineering Lead (LANE-7), Cowork, Wed 28 Oct 2026 from 19:40Z. Doc-only.

## Preflight
- Branch `October-2026`, HEAD `c3c6e4a`; no `.git/*.lock`; git read with `--no-optional-locks` only; no secret file opened.
- Inputs re-hashed, all match the Task: spec rev 0 `8216123e…8f3b4`; Architect review `15d0ef4c…0d58`; DIL review `5bb8b8c7…2777`.
- `claude/packets/MA-OCT-WED28.ENG1_Report.md` does not exist yet, so the committed retirement `entities-api.js` hash is a **placeholder** in spec §0.

## Output

| | SHA-256 | Lines |
|---|---|---|
| Spec rev 0 (before) | `8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4` | 360 |
| **Spec rev 1** `claude/MA-OCT-009_010_Spec.md` (in place) | `2f83d58e0042ebfe920f5823598ee3827c21c57b6bbc103f552cef419b2841f4` | 502 |

## Mapping summary (full table: spec §17)

**All 16 MUST-FIX items are folded:**

| Item | Section(s) |
|---|---|
| Architect M-1 Option C re-plan, committed retirement base | §0, §4.1, §8, §10 |
| Architect M-2 Mon 2 release only with gated R1f live | §8, §10, AC-F12 |
| Architect M-3 + DIL M-3 PepsiCo check — **one definition** | §4.4: S1 `bond_issuance` PKs; S2 `instrument_master` PK only for non-null keys; S3 `fund_holdings_monthly` **by CUSIP via `idx_holdings_cusip` only, never ISIN**; exact PASS/FAIL; expected PASS on 4 reads, bound ≤ 12; premise corrected (the 4 rows have `instrument_key = NULL`, §2 C4) |
| Architect M-4 rollback rule | §12 |
| Architect M-5 cache key = URL + gate state + `changed_at` | §5.7 |
| Architect M-6 cache proof (`x-fi-cache` in T-F10) or uncached budget 0.6–0.75M/day | §5.7, §6, §9, §11 |
| Architect M-7 cursor = last row consumed in merged order | §5.2, T-F2 |
| DIL M-1 baseline + rollback target | §0, §8, §12 |
| DIL M-2 calendar; opening by Mon 2 with Founder acknowledgement, after Mon 2 with Founder approval; closing any time | §4.1, §8, §10 |
| DIL M-4 closed gate returns only `has_bond_link` | §4.2, §5.2, §7.2, tests |
| DIL M-5 R1f `DISTINCT cik … LIMIT 2`; 2 CIKs → `source_conflict` | §4.3, T-F6 |
| DIL M-6 filer-own-entity rule; "Filed by" | §5.2, §7.2 |
| DIL M-7 guarded UPDATE, read-back, full hashes, executor vs authority | §4.1 |
| DIL M-8 CIK/LEI provenance | §5.4, §7.3, §7.6, AC-F8 |
| DIL M-9 ladder counts distinct securities | §5.6, §7.2 |

**Notes:**
- All 9 Architect notes and all 7 DIL notes are **accepted**, each mapped in §17.
- DIL D-2 and D-3 are **deferred** to 004 and 008 as data fixes; 009 handles both on display.
- UX questions 1–3 are **deferred** to the Sat 31 build review (no UX review ran on rev 0).

**Also included, as the Task asked:**
- **DIL Q6:** counts are withheld while the gate is closed (§4.2).
- **DIL Q7:** opening needs the Data-Identity Lead plus the Founder's acknowledgement, and an engineering lane executes it (§4.1).
- **§14 Founder Q1–Q3:** kept as decided, yes.
- **Calendar (Option C):** build and deploy Thu 29 with the gate migrated closed first, and the PepsiCo check before the deploy. 010 front end Fri 30, review Sat 31, site release Mon 2 Nov only if gated R1f is live.

## For the Main Lane
1. **Fill spec §0** with the committed retirement `entities-api.js` SHA-256 and commit once WED28.ENG1 reports, and pass both to the Thu 29 build Control. This doc-only placeholder doesn't need a new spec revision.
2. **Commit list (Architect N-7):** 008's `migrations/008-bonds.sql` and `App/Corporate Atlas/bonds/` must be committed before the 009 build tests against their schema.

## Budget
0 D1 reads or writes, no deploys, no git writes. Status.json and STATUS_BOARD not edited. Stop point reached.
