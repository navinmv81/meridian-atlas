# MA-OCT-009.REVD — Report (LANE-11, Data-Identity Lead)

**Verdict: PASS WITH NOTES. Findings: 0 BLOCKER · 9 MUST-FIX before build · 7 NOTE.**

**Control v1:** `claude/packets/MA-OCT-009.REVD_Control_v1.md` `85abe8e2c970b047c9743aa36b40f2bf40befee4817df866329c874e0dbeea75`. It matches the STATUS_BOARD row. **Task v1** `e898a1e3b32acad1a42d2930938fe64ac36a82b78ae5c4b23fb23ebd61570f10` matches.
**Date:** Tue 27 Oct 2026. **Git:** HEAD `c3c6e4a`, `origin/October-2026` = `721d093`. No `.git/*.lock`. **Doc-only:**
- 0 D1;
- no deploys;
- no git writes;
- no secret files read.

**Inputs:** all four Task hashes matched (009/010 spec rev 0 `8216123e…8f3b4`, 008 spec `bcdad9a2…15cd3`, DIL14 `c517dde7…9c399`, 007 rev 1.4 `4d4fffef…397c`). Live code was read from git at `721d093` (`entities-api.js` `fac446bf…e245`), not from the working copy. The 16 Oct load file `bonds/state/finals-2026-10-16.json` (`28d32b35…e263`, the same file DIL14 used) was read as data evidence.

## Output

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-009_010_DIL_Review.md` | `5bb8b8c77343469de890c059e9c1a9c0ed99d76c1863123abd3046e345882777` |

## Headline items for the Main Lane and the build lane

1. **The 4 PepsiCo Singapore rows have `instrument_key = NULL`** (`0001104659-24-022370` / 1–4). R1f cannot return them, so spec §14 Q3's "4 PepsiCo Singapore keys" premise is wrong. **M-3** redefines the pre-deploy check:
   - 4 PK reads on `bond_issuance`, plus ≤ 4 PK reads on `instrument_master`, for non-null keys only;
   - exact PASS and FAIL conditions are in the review;
   - expected PASS with 4 reads.
2. **The calendar is pre-Option C** (M-2):
   - opening the gate is a production-visible change, due by Mon 2 Nov; after that it needs the Founder's say-so;
   - closing is allowed at any time.
3. **The code baseline must be the committed 003 deploy-5 `entities-api.js`**, not `d18845dd` (M-1).
4. **The closed-gate F1 leak** (M-4): return a boolean `has_bond_link` only.
5. **R1f N8-3 ambiguity** (M-5).
6. **The multi-CIK "parent + finance sub" example conflicts with L8-4** (M-6).
7. **The gate statement:** guarded, read back, full-hash evidence, executed by an engineering lane (M-7).
8. **CIK and LEI provenance on the page** (M-8).
9. **The ladder double-counts reopenings** (M-9, only if F4 ships).

**§15 answers:**
- **Q4:** yes, with conditions.
- **Q5:** yes.
- **Q6:** withhold the counts.
- **Q7:** Data-Identity Lead + Founder acknowledgement.

**New 004 tickets proposed:**
- D-2: 37 Caterpillar boilerplate labels.
- D-3: duplicate CUSIP `14913UAP5` across two accessions.

The rest (D-1, D-4 to D-6) are already seeded or tracked.

## Stop

Both outputs are written. No other file was changed.
