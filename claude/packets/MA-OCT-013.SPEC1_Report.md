# MA-OCT-013.SPEC1 — Report (Engineering Lead for the Data-Identity Lead, LANE-11-ENG)

**Executed:** Wed 4 Nov 2026, 20:36–21:05Z. **Outcome: done.** Spec rev 1 is written in place. The 4 tables are measured on read-only D1 (0 writes), and the build list is in spec §17.

## Pre-flight
- Control `MA-OCT-013.SPEC1_Control_v1.md` sha256 `744c0790da1f3a486548c4942b92cc26b1db14bd14c72609d70e0de230e87105`: matches `STATUS_BOARD.md` line 105 and the invocation.
- Task `MA-OCT-013.SPEC1_Task_v1.md` sha256 `b4393fa1d6de5be77d33577b083e8c79f3c5c94dfa3d667879146e187700008f`: matches the Control.
- **Governing inputs, all match the Task:**
  - rev 0 `9a746677…69a3`;
  - Architect review `83d9c894…25fa`;
  - Ops review `4a879de2…8262`;
  - ETF review `381ccb99…e6e84`.
- FREEZES as found: `5b3400c0…6791`, the 30 Oct issue with the A2 window removed. No 013 window yet.
- Branch `October-2026`, HEAD `a3e3f1f`, no `.git/*.lock`.
- `/usr/local/bin/wrangler` 4.96.0, `whoami` OK.

## Deliverable
**`claude/MA-OCT-013_Spec.md` rev 1, sha256 `e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098`** (703 lines). BUILD and CHECK verify this hash.

## Step 1: measurement (read-only D1)
**Ledger:** `~/MeridianAtlas-work/ma-oct-013/spec1/ledger.jsonl` `7553276d…84d5bf`. **21,848 reads, 0 writes, 103 executions, largest 500 reads**, against a cap of 30,000. Indexed paths only, each EXPLAINed first; nothing was scanned.

**Index question settled:** the live catalog has `entity_id` indexes on 3 of the 4 tables (`idx_mqp_entity_id`, `idx_ies_entity_id`, `idx_ips_entity_id`; the ETF review was right). Only `financialfact_reported` has none, so it was probed through `idx_financialfact_cik_tag` by the duplicates' `cik`.

**Arch M-3 result (all 1,979 core duplicate ids):**

| Table | Rows | Duplicates | Repoint cost |
|---|---|---|---|
| `managerissuerpositionquarterly` | 107 | 2 | 214 |
| `issuereventstream` | 83 | 5 | 166 |
| `issuerperiodsummary` | 72 | 4 | 144 |
| `financialfact_reported` | 585 | 7 | 585 |
| **Total** | **847** | **8** | **≈ 1,109** |

- All 8 are newer twins that hold the CIK their survivor lacks.
- **Rule in rev 1:** those merges are held (7 two-way; the 8th is a three-way twin, held anyway). The owning lanes repoint in November ("R-F"), then 013 merges them. **The Thu 5 run therefore leaves 0 references in all four tables.**

**State re-checked live, 4 Nov:**
- all 3,907 core rows exist;
- 0 duplicates hold an LEI or were touched by 011;
- 74 instrument links and 1,979 queue rows, unchanged from 29 Oct;
- the 3 (iii) LEIs are held by no row (W1-A).

## Three findings that change the Thu 5 scope (Founder and Data-Identity attention)

1. **Wrong-company pairs (new identity guard I-1, spec §5.2).**
   - **The defect:** the corrected `normalizeName` strips legal-form words, so different companies collide on one key.
   - **3 rejects** (never merged; DQ tickets):
     - FUJI CORPORATION LIMITED ← FUJI CORPORATION (two JP companies; also the only survivor/duplicate chain);
     - Nice Corporation (JP) ← Nice Ltd (IL);
     - ALPHA Corporation (JP) ← Alpha Group (CN).
   - **6 sign-eligible** (Rezolve, JDE Peet's, Ferrovial, Charter Hall, Axia Energia, Taiwan Speciality Chemicals). These merge on Thu 5 only if the Data-Identity Lead signs at the R3 plan review.
2. **Seed re-creation (Arch M-5).**
   - **Two-way is proven safe:** with the live seed's `normalizeName`, the survivor name, the duplicate name and the new key are equal for **1,868 / 1,868** pairs.
   - **Three-way and OTP:** **all 101 twin names are still in complete holdings**, so the Mon 9 seed would re-insert 51 rows. They are **held to November** for a seed-side alias fix.
3. **Filings/13F references:** the 7 two-way merges above are held (see Step 1).

**Thu 5 default:**
- **1,862 two-way merges + 3 (iii) LEIs + 2 `cik` fill-only, ≈ 30,396 writes** (30,494 with the 6 signed).
- Margin ≈ 2.5k under the 33k cap.
- Account precondition: `d1-today` ≤ 38.0k at 18:15Z.
- Plan file `plan-rev1.json` `0c444d0d…db58`.

## Step 2: rev 1
**All 15 MUST-FIX** (Arch M-1..M-7, Ops M-1..M-6, ETF MF-1..MF-2) are mapped to sections in **spec §18**, and every NOTE is accepted or deferred.

**Key changes:**
- **Rollback order:** B13-4 order (survivor key restore → re-insert → children and `cik` → LEI → redirect), with a byte-identical round-trip test.
- **All-or-nothing merges:** a step-1 **merge token** (the redirect insert, guarded by the full pre-image and child-set predicate). Every later statement is gated on the token, so a CAS miss changes nothing.
- **Guards:** W1-A on the (iii) LEI; a dangling-reference `NOT EXISTS` guard on the delete; fill-only `cik` carry-over.
- **Plan-time assertions:** disjointness and the 3-hop limit.
- **Control surface:** own work dir, flags, and a `013.env` + `merge-013.sh` entry script with stop by own pid.
- **Ops and ETF items:**
  - Ops registry row and emitter key, with an R-4 fallback;
  - boost pause for the run window, plus a FREEZES window for the Main Lane;
  - ETF table allow-list, and `fund_entity_link` stop-and-refer;
  - gate3 timing wording.
- **Restore calendar:** per batch same day; full rollback ≈ 29.9k, earliest Fri 6, over 2 days.

## Step 3: run day
**Planned Thu 5 ≥ 18:15Z, stop 23:30Z** (spec §9, §15).
- **Why not Fri 6:** the Founder's later ML-1104-2 and the issued RUN packet set Thu 5, which supersedes the Task's "Fri 6 after 08:05Z" (ruling L13-7).
- **Caps:** 33k writes for 013, account ≤ 70k.
- **Remainder rule:** stop at a batch boundary when the cap would be breached, the clock is ≥ 23:15Z, or a guard misses.
  - The un-run batches go to `remainder.json` with a SHA-256.
  - The rest is November item #1: **Fri 6 ≥ 08:05Z** under a new Control, from a fresh plan re-check, with 25k / 60k caps unless re-approved. Never Sunday.

## Step 4: build list
**Spec §17** lists 7 files and 16 tests (T-1..T-16), each tied to a MUST-FIX and each required to fail on `a3e3f1f`. It also defines the replica dry run: counts within 2% of 1,862 merges / ≈ 30.4k writes, and a byte-identical restore. MA-OCT-013.BUILD can start now.

## Decisions needed
- **Founder decision recorded (Wed 4 Nov, ≈ 21:10Z, in the SPEC1 session):** "Yes, hold them".
  - The 101 three-way/OTP rows and the 7 Filings/13F-referenced merges move to November, as spec rev 1 §5.3 / §5.4 already plan.
  - No spec change, so the rev 1 hash above stands. The Main Lane logs this in the Decisions Log.
- **Original question, kept for the record — Founder (before the Thu 5 run approval):** do you accept the held scope? It means the 101 three-way/OTP rows and the 7 Filings-referenced merges go to November.
  - **Recommendation: yes.**
  - Alternatives: accept a one-off seed re-creation of 51 rows on Mon 9, or accept stale issuer panels for 7 issuers until the owning lanes re-map. Neither is recommended.
- **Data-Identity Lead (at R3, Thu 5 ≈ 18:15Z):** sign or hold the 6 sign-eligible I-1 pairs. The lane recommends signing all 6. Confirm the 3 rejects.
- **Main Lane:**
  - add the FREEZES window "013 run — other Entities writers frozen", Thu 5 18:00Z → Fri 6 00:10Z;
  - sequence 013 after MA-OCT-002b.DEPLOY closes.

## Pre-existing issues found (not 013's; November list, spec §16)
- `financialfact_reported` rows for Travelers (CIK `0000086312`) point at **deleted** entity 2298.
- Xerox Holdings and Xerox Corp share CIK `0001770450`.
- The `normalizeName` over-stripping that causes cross-company key collisions.

## Hygiene
- **D1:** read-only, 0 writes. No deploys, no GLEIF calls. No secret files read.
- **Files written:**
  - `claude/MA-OCT-013_Spec.md` (rev 1);
  - this report;
  - scripts and outputs in `~/MeridianAtlas-work/ma-oct-013/spec1/` only.
- **Git:** nothing staged or committed. The Task asks for none, and the spec stays in the shared checkout for BUILD and CHECK at the hash above.
