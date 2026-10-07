# Spec Brief: MA-OCT-011, Offline GLEIF Reconciliation (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (packet owner; writes the spec) — separate lane from MA-OCT-006
REVIEWED BY:  Architect + Operations Lead (Thu 8 – Fri 9 Oct)
APPROVED BY:  Founder — spec lane opened 2026-10-01; build only on GO at the Mon 12 Oct gate
PACKET:       MA-OCT-011 — offline GLEIF reconciliation (conditional)
GATE:         Spec by Wed 7 Oct → reviews 8–9 Oct → Founder 12 Oct: 006 close + 011 GO / NO-GO / DEFER + spec approval

ROLE:           Data-Identity Lead
LANE:           Data-Identity (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-011_Spec.md (new), claude/MA-OCT-013_Spec_Brief.md (new, one page)
```

## Why now
MA-OCT-006 Report 2 (1 Oct, `claude/MA-OCT-006_Evidence.md` §12–§13) shows the live GLEIF path cannot close the gap: H1–H3 confirmed, Phase 3 needs ~65 days for the 7,436 placeholder pool, and offline evidence is strong (T1: 4,115 rows / 3,723 LEIs, 50/50 hand-check; Golden Copy vs live API 50/50). The Founder approved writing the 011 spec in parallel so the 12 Oct gate can approve a ready-to-build spec. **Approving this lane is not a GO.** The GO/NO-GO/DEFER decision stays with the Founder on 12 Oct.

## Lane rules (hard)
1. **Doc-only.** No code, no deploys, no D1 queries or writes, no GLEIF API calls, no Golden Copy downloads. Use 006's evidence files and `gleif_006.db` **read-only** (local SQLite queries on it are allowed; it is not D1).
2. **No git writes.** Read git only with `git --no-optional-locks`. Check `ls .git/*.lock` first (Addendum rule 6). The approved spec is committed later by the next executing lane (rule 7).
3. **Write only** the two files in scope. Never edit 006's evidence, query ledger or close-out files; cite them by section and SHA-256.
4. **Numbers come from 006.** Where a 006 number is still interim (Report 3 on 2 Oct, close-out on 9 Oct), mark it *interim* and name the 006 section that will settle it. Re-sync the numbers to 006's close-out on 9 Oct before the reviews.
5. Report any in-lane ruling to the Main Lane the same day.
6. Use `/write-spec`.

## Scope to specify (from 006's R9 flag, Founder-approved for spec)
Offline reconciliation of Entities-domain records against one Golden Copy publication, **duplicate-aware**:
- **A. Level 1 LEI matching** for no-LEI entities: T1 only (unique exact match, country agrees, GC status ISSUED; DUPLICATE excluded per ruling D4-1). T2/T3 and LAPSED/RETIRED/ANNULLED are **out** (report-only or manual review queue).
- **B. Placeholder hydration** of the 7,436 pool: legal name, status and Level 2 parents **with GLEIF's real exception reason** (fixes KI 22.43's generic `NO_LINK_DECLARED` markers, incl. the 661 wrong ones).
- **C. Level 2 parents** (direct and ultimate) from RR, with RX reasons where no parent is reported.
- **D. Duplicate-awareness:** never write an LEI or parent onto one side of a KI 22.41 pair without a rule for its twin. The merge itself is **MA-OCT-013**, not 011.
- **Out of scope:** the live enrich fixes (H1/H2/H6 code changes, KI 22.40 sticky diff, KI 22.42 escaped names). List each as a dependency or follow-up with its owner packet.

## The spec must define
1. **Rule per bucket** (A–D): the selection rule, the evidence tier, which fields are written, and what is never overwritten (e.g. an existing LEI; H7-style overwrites).
2. **Write plan:** exact tables and columns, row counts per bucket, statement patterns (`db.batch()`, `INSERT OR IGNORE`, content-diff-guarded `UPDATE`), batches per day, and a calendar that avoids Sunday and Monday before 08:00 UTC and the 04:00 seed. Stay inside the `DAILY_WRITE_LIMIT = 80,000` guard **after** the day's other writers.
3. **Gate mapping (required).** 006 spec §9.2 was written for a Level 2-only backfill (≤ 60k writes total, ≤ 20k/day; writer touches only `entity_relationships` and `entity_master` parent fields). The wider scope breaks criteria 4 and 5 as worded. Map the spec against all seven §9.2 criteria, and **propose explicit amended wording** for any criterion it changes, for the Founder to accept or reject on 12 Oct. Do not quietly widen the gate.
4. **Three-point check** (Team v3): index audit with `EXPLAIN QUERY PLAN` for every write and verify query, single-execution test ≤ 50k reads, and a budget declaration per invocation.
5. **Run-time gates:** hold/kill switch, budget check before each batch, checkpoint/cursor and safe resume.
6. **Who writes, and how:** an Entities-domain local runner (precedent: June `gleif-build-local`) using the wrangler session or a scoped secret, never token literals (F1). Name the change request it needs (new runner path, any new table or column).
7. **Interaction with live jobs:** pause or exclude live enrich Phase 1/3 on the touched rows during the run; the seed's sticky diff (KI 22.40) re-stamping `updated_at`; the 001 heartbeat (emit `ops_job_run` events per batch).
8. **Verification:** pre-images exported before every batch; post-run checks (counts, sampled diff vs Golden Copy); the stop condition.
9. **Rollback:** restore from pre-images per batch, with the write cost of a full rollback.
10. **Acceptance criteria and timeline** for a build in Wave 2 (from 13 Oct), plus at most 3 open Founder questions, each with a recommended answer.

## MA-OCT-013 (KI 22.41 duplicate merge): one-page spec brief only
Founder decision (1 Oct): the merge is its own packet, **MA-OCT-013** (IDEA). Write `claude/MA-OCT-013_Spec_Brief.md` with: the problem and counts (1,928 pairs; 1,920 no-LEI twins in the queue), the merge rule options (which twin survives; repointing `entity_relationships`, `fund_entity_link`, `instrument_entity_map`, `entity_isin_map` and queue rows), the ordering relative to 011 (before, after or interleaved, with a recommendation), owner (Data-Identity Lead), executor (Engineering Lead), reviewers (Architect + Operations Lead + ETF Product Lead, because the merge repoints links read by ETF exposure), and a write-cost estimate. No full spec.

## Report-backs to the Main Lane
1. **Day 1 (Fri 2 Oct):** preflight (branch, no locks, files readable), outline of the spec, and the gate-mapping table in draft.
2. **Wed 7 Oct:** `claude/MA-OCT-011_Spec.md` and `claude/MA-OCT-013_Spec_Brief.md` with SHA-256s. The Main Lane routes them to the Architect and Operations Lead.
3. **Fri 9 Oct:** numbers re-synced to 006's close-out, with the final SHA-256s for the 12 Oct gate.
