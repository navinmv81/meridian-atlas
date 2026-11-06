# MA-OCT-013 spec rev 0 — Architect Review (REVIEW-A)

```text
ISSUED BY:    Main Lane — MA-OCT-013.REVA Control v1 fbc36aed91ac535f8b9b049b3754b718d03b2665924e03a4b1ef54d2a48d236d
              Task v1 89b3652dab62b16d468e29e0c68c7e300bc23911eda4ae3d2ca63c18f40c09f7 (both verified)
EXECUTED BY:  REVIEW-A (Architect), Fri 30 Oct 2026, doc-only. 0 D1, no deploys, no git writes, no secret files.
INPUTS:       claude/MA-OCT-013_Spec.md rev 0 9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3 ✔
              claude/packets/MA-OCT-013.SPEC_Report.md d06c5e5bb8bb6f97950e7b5863224d56a6a2584f5201b9d49d680d313990c19d ✔
              Code from git at origin/October-2026 = 71fab4b: entities-api.js (007 R3), entities-seed.js, all *.sql schemas.
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 7 MUST-FIX before run, 6 NOTES.
              The merge model (redirect table, CAS deletes, survivor-key fix, measured repoints) is sound and well
              measured. Rev 1 must fix: the rollback order (B13-4), per-merge all-or-nothing, two reference
              classes the measurement missed, column carry-over, and seed re-creation for three-way/OTP.
              I do a delta check of rev 1 before the Mon 2 run Control.
```

**Independence.** LANE-11-ENG wrote the spec for the Data-Identity Lead. I wrote B13-1..B13-5 / RC-2 (the brief conditions it implements) but not the spec or the measurement.

## 1. Focus areas

| Area | Result |
|---|---|
| **Merge order** (§6) | Redirect → repoints → queue delete → duplicate delete → survivor key → (iii) LEI is the right sequence. B13-1 is met: the key update runs after the delete, under `NOT EXISTS (normalized_name, type)`. **But a step-4 CAS miss leaves steps 1–3 applied (M-2).** |
| **Survivor rule** (§5) | Consistent with Founder Q2: two-way keeps the older row; three-way and OTP keep the LEI holder; the protected 103540 is excluded; `do_not_merge` is read from Ops at plan time (H-2). It works on post-011 or partial-A2 state, because S1 "older survives" does not depend on A2's LEIs (CLOSEREV-ARC 3.5(a)). |
| **Repoint completeness** | **Incomplete (M-3).** The 7 Entities child tables and `bond_issuer_link` are covered and measured. **Four Filings/13F tables that store `entity_master` ids are not**, and neither are the duplicate's own column values (M-4). |
| **`entity_merge_redirect` + 007's resolver** | Columns match 007 R3 exactly (`navRedirectRow`: `SELECT survivor_id, merged_at, packet … WHERE duplicate_id = ?`), and a missing table is tolerated. **007's hop limit is `NAV_MAX_HOPS = 3`, not 5** (`entities-api.js:367`). 013 writes no chains, provided no survivor is also a duplicate (M-6). A rowid PK with no `survivor_id` index is right (L13-5). |
| **Idempotency** | `INSERT OR IGNORE` redirect; CAS on every delete and update; resumable by batch checkpoint. Sound **once M-2 makes each merge all-or-nothing.** |
| **Rollback manifest** (§11) | Per-batch pre-images, checkpoints and redirect ids are listed. **The restore order is wrong (M-1, B13-4).** Cost ≈ 31.5k, which needs its own day (N-4). |
| **Index use** | Every statement is a PK or index probe:<br>- `entity_master` and queue by INTEGER PK;<br>- the `NOT EXISTS` key probe on the `(normalized_name, type)` autoindex;<br>- the redirect by rowid;<br>- `instrument_entity_map` by PK `instrument_key` and `idx_iem_entity_key`;<br>- `entity_isin_map` by PK;<br>- `bond_issuer_link` by PK `cik`;<br>- relationships by PK and the child/parent indexes;<br>- `fund_entity_link` as a declared 264-row scan.<br>The measurement EXPLAINs show no temp B-tree. Budgets: core ≈ 32.0k writes under the Q1 Mon 2 cap of 33k (account ≤ 70k); ≈ 110k reads; executions ≤ 45k. |

## 2. Findings

### MUST-FIX before run (spec rev 1 + the runner build)

- **M-1 (§11) The rollback order breaks B13-4 (binding, ML-1010-2).**
  - **The problem:** §11 re-inserts the duplicate **first** and restores the survivor's old key **later**. After a two-way merge, the survivor holds the duplicate's former key, so re-inserting the duplicate collides on `UNIQUE(normalized_name, type)` and the restore fails.
  - **Required order per merge:**
    1. restore the survivor's old key (CAS on its post-merge key);
    2. re-insert the duplicate with its explicit `entity_id` from the pre-image;
    3. restore its queue row, the repointed rows and any carried-over columns (M-4);
    4. clear the (iii) LEI by CAS;
    5. delete the redirect row.
  - **Prove it** in the Sun 1 replica dry run: merge, then restore, must give a byte-identical round trip for each shape (two-way, three-way, OTP).
- **M-2 (§6) Make each merge all-or-nothing.**
  - **The problem:** a D1 batch is a transaction, but a CAS miss is not an error. If step 4's CAS misses (the duplicate changed since its pre-image), steps 1–3 have still applied: a redirect row exists for a live entity, its instrument links have moved, and its queue row is gone.
  - **Fix:** guard **every** statement of the merge with the same predicate: the duplicate exists with its pre-image values (`lei IS NULL AND normalized_name = :pre_key AND …`) and the survivor exists. Then a miss changes nothing and the read-back shows a clean `raced`.
  - **Also:** the (iii) LEI write must carry 011's W1-A guard (`AND NOT EXISTS (SELECT 1 FROM entity_master WHERE lei = :lei)`), not only `lei IS NULL`.
- **M-3 (§4, §7, §12) Two reference classes the measurement missed.** These tables hold `entity_master` ids and are read **by `entity_id`** in 007's issuer panels (`entities-api.js` ≈ 748–850: `resolveIssuerCik`, ownership, filings):
  - `managerissuerpositionquarterly.entity_id`: 13F domain, derived. Its seed takes `entity_id` from `instrument_entity_map`, so rows for the **74 instruments 013 repoints** probably carry duplicate ids.
  - `issuereventstream`, `issuerperiodsummary`, `financialfact_reported` (`entity_id`): Filings/Equities domain. Their seeds map `cik → entity_id` from `entity_master WHERE cik IS NOT NULL`, so they reference a candidate **only if a duplicate carries a `cik`** (M-4's measurement answers this).

  **013 must not write these** (other domains, and there is no `entity_id` index). Rev 1 must:
  - **(a) measure them through indexed paths:** `managerissuerpositionquarterly` by `cusip` on `idx_mqp_cusip_period` for the 74 instruments' CUSIPs; the cik-mapped tables via the candidates' `cik`;
  - **(b)** if any count > 0, agree a post-013 rebuild with the owning lanes (`seed-managerpositions`, `seed-issuerperiodsummary`; `financialfact_reported` re-map) before Mon 2, or record accepted staleness;
  - **(c)** list them in §7 and the §12 impact.
- **M-4 (§6 step 4) Column values on the duplicate are lost on delete.**
  - **The problem:** step 4 deletes the duplicate and nothing is carried over. A newer twin may hold values the older survivor lacks. The important one is **`cik`**: 007's `resolveIssuerCik` and 008's issuer link both read `entity_master.cik`. Also `primary_ticker`, `country`, `other_names` and the `has_*` / count flags.
  - **Fix:** from the plan-time export, measure for each column how many duplicates are non-NULL where the survivor is NULL. Add a **fill-only** CAS step before the delete: `UPDATE survivor SET col = COALESCE(col, :dup_val) WHERE entity_id = :surv AND col IS NULL`. It never overwrites, and it is restored from the pre-image.
  - Or justify each loss explicitly. **An identity-bearing field (cik) is never silently dropped.**
- **M-5 (§10) Seed re-creation for three-way and OTP.**
  - **The problem:** `entities-seed.js` keys only on `(normalized_name, type)` (`INSERT … ON CONFLICT(normalized_name, type)`). Two-way survivors take the corrected key (step 5), so the seed finds them. **Three-way and OTP survivors keep the LEI holder's own key.** If a deleted twin's source name is still in the seed's input, the **next Monday seed (9 Nov)** inserts it again, which re-creates KI 22.41 for those rows.
  - **Fix:** extend the §10 seed dry run to **all three shapes** on the Sun 1 replica. Any merge the seed would re-insert either moves to November with a seed-side alias fix, or goes to the Founder as an accepted weekly re-creation (not recommended).
- **M-6 (§6, §10) Plan-time disjointness and the 3-hop limit.**
  - Assert **at plan time**, not only after the run:
    - survivors ∩ duplicates = ∅;
    - no survivor is an existing `entity_merge_redirect.duplicate_id`;
    - each three-way holder is not itself a candidate.
  - Correct the "≤ 5 hops" text: 007 R3 follows ≤ **3** (004 per its own spec). 013's redirects are single-hop by construction, and this assertion keeps it so.
- **M-7 (§13, §15) Partial-A2 gate.** The Task allows A2 to end partial. The run Control for Mon 2 needs an explicit gate before 013's first write:
  - A2's final checkpoint, cursor and holds are recorded;
  - A2 is frozen;
  - the Founder's slip-rule decision is logged (resume A2 later as a **fresh** plan on post-013 state, or defer).

  Reason: A2's rollback horizon ends at 013's first write (A2 §9), and its unrun batches would hold pre-013 pre-images.

### NOTES

- **N-1.** The Task says "007's 5-hop resolver". The code is 3 hops (see M-6). No impact for single-hop redirects.
- **N-2 (§10).** At plan time, also assert that `normalizeName(survivor.name)` equals the key step 5 writes. §10 proves it only afterwards.
- **N-3 (§6 B13-2).** Re-measure R_collide on the plan-time export (0 on Thu 29). The fold rule and the Σ `weight_sum` / `aum_weighted` invariant (B13-5) stand.
- **N-4 (§11).** A full rollback is ≈ 31.5k writes: not on Mon 2 after a run, and not on Tue 3 (go-live; no production change). The earliest is Wed 4, with an Operations Lead decision. A per-batch restore (≈ 900) is same-day.
- **N-5 (§9).** The ≈ 22:00 sweep band should be the exact FREEZES slot (GMT from 26 Oct: 22:00 ±2 min). The runner reads FREEZES, so this is wording only.
- **N-6 (Control).** As in A2.REVA, this Control's "Stop point" is run-packet boilerplate. I followed the doc-only Task.
