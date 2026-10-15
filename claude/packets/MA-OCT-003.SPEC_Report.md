# MA-OCT-003.SPEC — Report (LANE-3, Operations Lead)

**Control:** v1 `c38b4b7a1d6ec562c5a018d979bea8eb87e545eca6bddbd6e510f36024fb5cd2`. It matched `STATUS_BOARD.md` and `MA-OCT-003.SPEC_Status.json` at start.
**Task:** v1 `8b23b06f03253abe7421d108c001ec456f0fc1972bd5c60399973af6cddfe675` (matched).
**Start:** Wed 14 Oct 2026, ≈ 05:50Z, on the Founder's "execute it" (taken as the Start Approval).

## Preflight
- **Branch:** `October-2026` @ `3960aee` (read with `git --no-optional-locks`).
- **Git locks:** none at start or at end.
- **FREEZES:** no window restricts doc-only work.
- **No git writes**, 0 D1 reads or writes, no deploys.
- **No command that could raise a macOS prompt was run (ML-1013-3).**
- **Secrets:** none printed. `.env.admin-exceptions` was not opened.

## Section 1 — MA-OCT-003 spec (delivered)

| | |
|---|---|
| Path | `claude/MA-OCT-003_Spec.md` |
| SHA-256 | `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` |
| Lines | 740 |
| Status | REV 0. To Data-Identity Lead + Architect review (separate packets). |
| Input hashes | Appendix C of the spec (24 files) |

**Headline design:**
- **Schema:** no new table. One new index, `idx_ops_dq_linked_exc` (migration `004-ops-cases.sql`).
- **Routes:** 4 new endpoints on `meridian-ops`: E-1/E-2 for exceptions, plus the shared C-1/C-2 case routes that 004 reuses. The Worker reaches 11, and 14 after 004.
- **Workflow:** open → acknowledged → resolved/dismissed, plus reopen. Each change is one atomic, idempotent batch with an audit row.
- **Sweep extensions:** one open case per (job, condition); a 30-day accepted-risk snooze; GLEIF E1, E2, E4, E5 and E6 automated, E3 seeded once (automating it costs ≈ 66k reads); auto-resolve of replayed `job_missed` behind a switch.
- **Migration:** `entity_exceptions` → 9 `DQ-M-*` tickets via an in-D1 `INSERT … SELECT`, after a Founder Access-Block freeze.
- **Retirement:** `/exceptions*` retired and `/admin/exceptions` residue removed (KI 22.23, 22.27) in one entities-api deploy **≥ Sat 24 Oct 08:05 UTC** (N-3). CR-003-1 is in Appendix B.
- **D1:** ≤ 150 writes a day steady; ≈ 175 one-time.

**Findings during spec work (for the Main Lane):**
1. **A6 (`meridian-control`) is not built.** `meridian-ops` is at 15/15 endpoints at `3960aee`, so A6 is a hard prerequisite for the 003 build (spec §16, D-1). If it isn't live by Mon 19, the 003 build day 1 does A6 under CR-1.
2. **Convention drift between 001 and 002.** The live sweep writes `ops_case_event.subject_id` as the numeric `exception_id`, not `case_ref` as 001 §5.2 documents. The 6 existing rows can't be changed (append-only trigger). The spec adopts the numeric id (DV-1, RQ-3). 004 follows the same convention.
3. **The sweep's dedupe pre-check matches resolved cases too.** Without 003 §9.1, a resolved condition-type case could never re-raise. §9.1 fixes this.
4. **Author's local dry-run of M1** on the real 015b/015c rows: V2 = 0 mismatches, and a re-run makes 0 changes. Local query plans match §11.2. This is not a review.

**Open Founder questions (3):**
- **Q1:** sweep auto-resolves replayed `job_missed` cases? (recommended: yes)
- **Q2:** keep `entity_exceptions` frozen until a November drop? (recommended: keep)
- **Q3:** create an Access service token for scripted case actions? (recommended: yes)

**Read pack (Appendix A, for LANE-1-ENG; 5 statements, EXPLAIN first, ≤ 5k reads):**
- R1: `entity_exceptions` by type and decision.
- R2: rows after id 9, non-DQ types, or invalid JSON (the fail-closed guard).
- R3: `entity_enrichment_queue` in-progress count (E2 plan).
- R4: EXPLAIN only, for E3.
- R5: `ops_exception` mix.

It must run before the 003 build (by Fri 16 if possible).

**Next for this packet:** the MA-OCT-004 spec, target Fri 16 (Task item 2). It is not started in this session (stop point: after each deliverable).

## Section 2 — MA-OCT-004 spec (delivered Thu 15 Oct)

**Preflight (Thu 15, ≈ 05:59Z):**
- Control and Task hashes unchanged and matching the board (state EXECUTING).
- No git locks; HEAD `3960aee`.
- No git writes, 0 D1, no deploys.

| | |
|---|---|
| Path | `claude/MA-OCT-004_Spec.md` |
| SHA-256 | `c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889` |
| Lines | 638 |
| Status | REV 0. To Data-Identity Lead review (Architect consulted on the new table and the page route). |
| Input hashes | Appendix B of the spec (22 files) |

**Headline design:**
- **Schema:** one new Ops table, `ops_dq_ticket_member`, for aggregate tickets with per-object status, plus `idx_ops_dq_member_object` (migration `005-ops-dq.sql`). No column changes.
- **Routes:** 3 endpoints on `meridian-ops`: D-1 list, D-2 create, and D-3 the Access-gated link-out page at `/api/ops/admin/dq/new`. The Worker reaches **14/15**. Detail and actions reuse 003's shared C-1/C-2.
- **Lifecycle:** open → triaged → fix_pending → resolved/dismissed, plus reopen. Dispositions use 006's four-way classification plus `fixed`.
- **007 contract:**
  - §8.3 is accepted with two stated mappings: `domain=entities` → `instrument`/`entity`, and `via=nav-007` → `raised_via='consumer_screen'`.
  - The O4 `ticket_type` vocabulary is confirmed.
  - Dedupe is scoped to the open ticket for the same object, replacing 007's permanent `dedupe_key` (RQ-2).
- **Seeds (reviewed `--file` batches):**
  - KI 22.17: one aggregate with 37 ISINs; legacy `DQ-M-000008/9` dismissed as duplicates.
  - KI 22.44: one aggregate with 24 wrong LEIs (Founder D5 A). The members come from a Data-Identity Lead export, because the 006 evidence CSV is outside the repo.
  - KI 22.9: an aggregate proposing edge deletion, only if Founder Q1 = yes.
  - 008 `missing_entity`: one ticket per unmatched CIK, from 008's hand-over list (M4).
- **Fixes stay out of 004:** they are Data-Identity Lead packets after 24 Oct. 004 tracks them.
- **D1:** ≤ ≈ 600 writes a day steady; ≤ ≈ 900 one-time; ≤ 500 reads per call.
- **Build plan:** Mon 26 – Wed 28 (Fri 23 local prep if 003 is on track). 007 Phase 4 can ship from Wed 28.

**Author's local dry-run (not a review):** 003 M1 then M3a on the real 015b/015c rows. Result: `DQ-000010` with 37 members, and `DQ-M-000008/9` dismissed with `legacy_disposition='pending'` kept. Re-run: 0 changes. All 7 query plans are index `SEARCH`es (one member-list sort was removed by ordering in index order).

**Open Founder questions (3):**
- **Q1:** reopen KI 22.9 (your 22 Aug `accepted_no_fix`) as an aggregate ticket proposing the deletion of the 4 edges? (recommended: yes)
- **Q2:** may 008's runner raise `missing_entity` tickets with an Access service token (depends on 003 Q3)? (recommended: yes)
- **Q3:** add new DQ tickets to the health-check macOS notification? (recommended: yes)

**Read pack:** none needed for the spec. Build-time checks B1–B3 (≤ 200 reads) are in Appendix A.

**Cross-impacts for the Main Lane:**
1. **T12 (today) moves `.env.admin-exceptions`.** 003 spec §10.5 R-7 assumes the file is still in `App/Corporate Atlas/`. The 003 build should delete it **wherever T12 put it**. I'll write this into 003 rev 1 with the review findings; I have not edited rev 0.
2. **007 Phase 4** must use the exact URL `/api/ops/admin/dq/new` (§9.1). 007 asked for no other change.
3. **005** must add no Worker routes: it uses D-1, C-1 and C-2 (one endpoint of headroom is left).
4. **008 build:** please write the unmatched list to `bonds/state/unmatched-issuers.json` (RQ-6).
5. **Data-Identity Lead:** export `App/Ops/seeds/ki-22-44-members.json` from 006's `WORK/day6/wrong_lei_detail.csv` before Tue 27.

**Packet state:** both deliverables are delivered. Next: the review packets (003: Data-Identity Lead + Architect; 004: Data-Identity Lead), then Founder approval with Q1–Q3 for each spec.
