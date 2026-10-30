# MA-OCT-013 — KI 22.41 Duplicate-Entity Merge: Spec

```text
ISSUED BY:    Main Lane (Program Orchestrator), Control MA-OCT-013.SPEC v1 (7952429e…a083), Thu 29 Oct 2026
EXECUTED BY:  Engineering Lead (for the Data-Identity Lead, brief owner), LANE-11-ENG
REVIEWED BY:  Architect + Operations Lead + ETF Product Lead (Fri 30 Oct)
APPROVED BY:  Founder (Option C, ML-1025-5; run Mon 2 Nov after 08:00 UTC)
PACKET:       MA-OCT-013 — KI 22.41 duplicate-entity merge
GATE:         Spec approval
```

**Status:** rev 0, Thu 29 Oct 2026. Built from the brief and the **measured** pre-spec read pack (§4). Nothing here is approved.

**Governing inputs** (all read-only, hashed at read time):

| Input | SHA-256 | Note |
|---|---|---|
| Task `MA-OCT-013.SPEC_Task_v1.md` | `7eb108b8…6029` | |
| Brief `claude/MA-OCT-013_Spec_Brief.md` | `a79bb98b…13de` | **The Task calls it "rev 1.6", but the file's own status line says rev 1.7** (B13-1/2/3 folded in). The hash governs; L13-6. |
| A2 Spec `claude/MA-OCT-A2_Spec.md` | `226d07db…842d` | §10, 013 interaction |
| 003 Spec §10.6 | — | the 3 `do_not_merge` pairs |
| 004 Spec | — | the OTP pair; the redirect reader |
| 007 Spec | — | the redirect reader R3 |
| 011 hand-off `…/gleif-011/plans/release-2026-10-16/handoff-013.json` | `0597e15d…6009` | 392 twins, 9 LEIs / 22 rows |
| 006 FINAL | `norm_hidden_duplicates.csv` `9cafca93…5a95`, `h12_tiers.csv` `a280c3c2…27c9`, `d2_entity_master.csv` `ad4d40a0…bd62` | |
| `FREEZES.json` | `9c368fa6…e829` | |

**Lane record:**

- 0 D1 writes; 0 GLEIF calls; no git writes.
- `/usr/local/bin/wrangler` 4.96.0, never `npx`. `wrangler whoami` pre-flight passed.
- Scripts and raw outputs live in `~/MeridianAtlas-work/ma-oct-013/`, outside the shared checkout.
- No secret file read.
- HEAD `acfd069`; no lock files.

---

## 1. Problem

MA-SEP-001 (16 Aug) changed `normalizeName` without migrating stored keys. Because the dedup key is `UNIQUE(normalized_name, type)`, later seeds created a second `operating` row on the corrected key for 1,928 entities they already held (KI 22.41). 006 also found **743** no-LEI rows whose Golden Copy LEI already sits on another row (D5-1).

Duplicates split exposure, instrument links and identity across two rows, and the stale key lets the seed keep the split alive. 013 is the highest-data-risk packet in the 006 matrix (Ops N-7), because it deletes rows that other tables reference.

## 2. Goals

1. Merge **1,979** duplicate rows into their survivors on Mon 2 Nov (core scope, §5):
   - 1,878 two-way pairs;
   - 50 three-way cases (100 rows);
   - the OTP pair.
2. Write one `entity_merge_redirect` row per deleted row, so 007 and 004 resolve stale ids. 0 dangling references.
3. Fix each two-way survivor's key, so the Monday seed cannot re-create the twin.
4. Write the 3 deferred LEIs from 011 (iii) onto their survivors from the 011 hand-off payload.
5. Stay inside the measured budget (§8), with every merge reversible from a pre-image (§11).

## 3. Non-goals

- **The optional D5-1 remainder** (642 rows) and **the 6 cross-pair LEIs** (011 (v), 19 rows) are deferred to November. They need Data-Identity adjudication (Q2, Q3).
- **Protected pairs:** never merged (003 §10.6).
- **Recomputing `entity_exposure_monthly`:** not needed, because 0 exposure rows reference a candidate (§4). gate3 recomputes on its own schedule.
- **No change** to `type`, to an existing LEI, or to any ETF, 13F or Ops table. 004 seeds and members are never rewritten (004 §7.6); they are read through the redirect.

## 4. Pre-spec measurement (Ops N-7, N-5; brief L11-13). **Done Thu 29 Oct, 19:34–19:38 UTC**

**Totals:** **48,046 reads, 85 executions, 0 writes, largest execution 2,400**. Task cap 50,000. The brief-scope tables (`instrument_entity_map`, `entity_isin_map`, exposure, `bond_issuer_link`) took **10,828 reads**, against the brief's declared 35k cap. Ledger: `~/MeridianAtlas-work/ma-oct-013/ledger.jsonl` `6b9ed205…6654`.

**Runner checks (brief, matched by index name; B13-3):**

| Check | Result |
|---|---|
| `idx_iem_entity_key` on `instrument_entity_map(entity_id, instrument_key)` | **present** (M0). EXPLAIN: `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` |
| `bond_issuer_link` | **present**. `idx_bil_entity … WHERE entity_id IS NOT NULL` present; EXPLAIN: `SEARCH … USING COVERING INDEX idx_bil_entity (entity_id=?)` |
| `entity_isin_map`, exposure (entity and holder), relationships (child and parent), queue, `entity_master` | `SEARCH … COVERING INDEX` on `idx_entity_isin_map_entity`, `idx_exposure_entity`, `idx_exposure_holder`, `idx_entity_rel_child`, `idx_entity_rel_parent`; queue and `entity_master` by integer PK |
| Temp B-tree for `GROUP BY` (N13-2, N-5) | **none.** Every grouped query streams on the leading index column. The measured reads show it: an empty seek costs 1 read, each matched row about 1–2 more. The 2.5 × N rule is not triggered. |
| `fund_entity_link` | declared small-table `SCAN` (264 rows, 264 reads) |
| `entity_merge_redirect` | **absent** (013 creates it) |

**Sample, then full set:**

- **Sample:** the first 500 pair duplicates over 9 query patterns cost 5,510 reads, about 11 per id. Extrapolated to all 2,622 candidates, that is about 28.8k.
- **Measured instead:** because that fit the cap, the full set was measured directly (2,122 more ids, plus a state check of 2,564 survivors and LEI holders). So the figures below are **measured, not extrapolated**.

**Measured references to merge candidates (R):**

| Table | Rows referencing a candidate | Repoint writes |
|---|---|---|
| `instrument_entity_map` | **205** on 135 entities: two-way 71, three-way 2, OTP 1, optional remainder 132 (incl. 1 on protected 103540) | 2 per row (row + `idx_iem_entity_key`) |
| `entity_isin_map` | **0** | — |
| `entity_exposure_monthly` (`entity_id`) | **0**, so R_collide = **0** (B13-2 has no rows to fold today) | — |
| `entity_exposure_monthly` (holder) | **0** | — |
| `bond_issuer_link` | **0** (33 rows in table) | — |
| `entity_relationships` | child **0**; parent **1**, `467290` (the OTP LEI holder, which **survives**, so 0 repoints) | — |
| `fund_entity_link` | **0** | — |
| `entity_enrichment_queue` | 2,621 of 2,622 candidates have a row (2,601 pending, 20 failed). Every no-LEI survivor already has its own, so **all are deleted, 0 repointed**. | 2 per row (delete + status index) |

**State on Thu 29 (post-011, pre-A2):**

- All 2,622 candidates and all 2,564 survivors and LEI holders exist.
- No candidate has an LEI, except OTP 467290, which is the LEI holder.
- **0 candidates were touched by 011** (`gleif_enrichment_version` ≠ 11).
- 756 of the 1,928 pair survivors hold an LEI. A2 adds the 392 hand-off LEIs on the survivor side on Fri 30 / Sat 31.
- All 744 D5-1 LEI holders still hold the matched LEI.
- Survivors and holders carry 4,102 instrument links on 1,519 entities. These are unchanged by 013.

**Result:** the brief's "≤ 10,000 repoints until measured" placeholder is replaced by **148 repoint writes in core** (74 × 2), or 412 with the optional remainder. The runtime cap stays as a second guard (§9).

## 5. Scope and survivor rule

**S1 (Founder, 3 Oct): the older, LEI-bearing row survives.** The measurement shows three shapes. In two of them, "older" and "LEI-bearing" point at different rows.

| Class | Count | Survivor | Deleted rows | Scope |
|---|---|---|---|---|
| **Two-way pair:** older drift row + newer twin, no third row | 1,878 | the **older** row (it holds the LEI in 756 cases, plus the 392 A2 writes) | 1,878 newer twins (incl. all 392 hand-off twins) | **Core, Mon 2** |
| **Three-way:** both pair rows have no LEI; the matched LEI sits on a third row | 50 (all 50 point at one holder each) | the **LEI-holding third row** (Q2) | 100 (both twins) | **Core, Mon 2** (Q2) |
| **OTP pair** (004 ticket, `fix_ref` MA-OCT-013) | 1 | `467290` (holds LEI `529900W3MOO00A18X956`; parent of 1 edge) | `2019` (older, no LEI) | **Core, Mon 2** (Q2) |
| **Optional D5-1 remainder:** no-LEI row whose LEI is on another row | 642 (incl. the 2 mistyped `government` rows 250160 and 267868) | the LEI holder | 642 | **November** (Q2) |
| **Protected:** `103540`, whose LEI is held by both 2589 and 25577 (`do_not_merge`, DQ-M-000002) | 1 | — | 0 | **Never** (003 §10.6) |

**The deferred LEIs from 011** (hand-off `deferred_leis`, 9 LEIs / 22 rows):

- **(iii) 3 LEIs:** the match lands only on the newer twin. After the merge, 013 writes the LEI **onto the survivor** from the hand-off's full write payload (R-3), after a **≤ 10-call GLEIF freshness re-check**. **Core.**
- **(v) 6 LEIs / 19 rows:** one LEI matched across two pairs, or across a pair plus an outside row (8 pair survivors, 7 pair duplicates, 4 outside rows). Merging these means merging two pairs into one, which is a cross-pair identity decision. **Recommended: route to Data-Identity adjudication (004 ticket); November** (Q3).

**Plan-time inputs (generated Mon 2 from a post-A2 export, A2 §10):**

1. **Re-derive the pair set** with the current `normalizeName` from a keyset export of `entity_master`. The plan merges only rows **in the measured set whose state still matches it**. New pairs are listed for November, never merged.
2. **Read the `do_not_merge` decisions from Ops** (`ops_data_quality_ticket`, `ticket_type='entity_merge'`, `disposition='do_not_merge'`, status not `open`), and drop any merge that touches their ids. That's H-2: 003 §10.6, ≤ 10 reads.
3. **A2 E-X2 withholds** (`withheld-013.json`) are listed. One is merged only if it is exactly the three-way or OTP shape **and** the Data-Identity Lead signs it at the plan review. Otherwise it waits for November.
4. **A2-written LEIs on survivors** are accepted, not required (CLOSEREV-ARC 3.5(a)).

## 6. Merge statements and order

**Migration (CR, new table):** `App/Corporate Atlas/migrations/ma-oct-013-entity-merge-redirect.sql`

```sql
CREATE TABLE IF NOT EXISTS entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,  -- rowid alias, no separate index (L11-14)
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT    NOT NULL,     -- ISO-8601 UTC
  packet       TEXT    NOT NULL      -- 'MA-OCT-013'
);
```

**No `survivor_id` index (L13-5).** 007 R3 and 004 C-1/D-1 read only by `duplicate_id` PK, with ≤ 5 hops. 013 never deletes a survivor, so its rows never chain.

**Per merge, in one batch, in this order.** The invariants hold without atomicity (L11-14); every statement is a compare-and-set (CAS) on its pre-image.

1. `INSERT OR IGNORE INTO entity_merge_redirect SELECT :dup, :surv, :ts, 'MA-OCT-013' WHERE EXISTS (SELECT 1 FROM entity_master WHERE entity_id = :surv)`.
2. **Repoints** for the duplicate's rows (§7), each `… WHERE <child-table key> = ? AND entity_id = :dup`.
3. `DELETE FROM entity_enrichment_queue WHERE entity_id = :dup AND status = :pre_status`.
4. `DELETE FROM entity_master WHERE entity_id = :dup AND lei IS NULL AND normalized_name = :pre_key AND EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id = :dup)`.
5. **Survivor key update (two-way pairs only; B13-1):** `UPDATE entity_master SET normalized_name = :new_key WHERE entity_id = :surv AND normalized_name = :pre_key AND NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = :new_key AND type = :type)`. `:new_key` is the duplicate's former key. If step 4's CAS missed, this cannot pass.
6. **(iii) LEI write** onto the survivor, only for its 3 survivors, from the hand-off payload, with a CAS on `lei IS NULL`.

**Three-way:** steps 1–4 run for **each** twin, with the third row as survivor, and step 5 is skipped (the holder keeps its key). **OTP:** steps 1–4 with `2019` as duplicate and `467290` as survivor; no key update, no type change.

**Exposure guard (B13-2).** Today R_collide = 0. If the plan-time export finds exposure rows on a duplicate, the fold rule applies: `weight_sum = s.weight_sum + d.weight_sum`, `aum_weighted` likewise and NULL-safe, then delete the duplicate's row. Never drop.

**Order on Mon 2:**

1. Migration.
2. **Pilot:** 50 two-way merges, read-back, then a 20-row Data-Identity spot check.
3. Remaining two-way merges.
4. Three-way.
5. OTP.
6. The (iii) LEIs.
7. Verification (§10).

## 7. Repoint of every child table

| # | Table | Rule | Core rows | Writes |
|---|---|---|---|---|
| 1 | `entity_relationships` | `INSERT OR IGNORE` (parent or child = survivor), then delete the duplicate's edge; drop self-loops (A2 §10) | 0 (the 1 OTP parent edge stays on the survivor) | 0 |
| 2 | `fund_entity_link` | `UPDATE … SET entity_id = :surv WHERE etf_symbol = ? AND entity_id = :dup` | 0 | 0 |
| 3 | `instrument_entity_map` | `UPDATE … SET entity_id = :surv WHERE instrument_key = ? AND entity_id = :dup` (PK `instrument_key`, cannot collide) | **74** | **148** |
| 4 | `entity_isin_map` | `UPDATE … WHERE isin = ? AND lei = ? AND entity_id = :dup` | 0 | 0 |
| 5 | `entity_exposure_monthly` / `fund_exposure_coverage` | repoint, or fold on collision (B13-2) / no change | 0 / — | 0 |
| 6 | `entity_enrichment_queue` | delete the duplicate's row (step 3) | 1,979 | in §8 |
| 7 | `bond_issuer_link` (present) | `UPDATE … SET entity_id = :surv WHERE cik = ? AND entity_id = :dup` | 0 (008 links survivors at write time) | 0 |
| — | `bond_issuance` | not repointed (links by `cik`) | — | — |
| — | 004 tickets and members, 003 M1 keys | **never rewritten**; read through the redirect (004 §7.6) | — | — |

## 8. Write budget (measured; 006 counting basis, as 011 §4.2)

| Step | Rows | Writes/row | Writes |
|---|---|---|---|
| Migration (1 table, no index) | — | — | ≈ 3 |
| Two-way: delete duplicate (1 + 9 idx; not in `phase3`) + queue delete (2) + survivor key (1 + `idx_normalized` + autoindex) | 1,878 | 15 | 28,170 |
| Three-way: delete twin + queue delete | 100 | 12 | 1,200 |
| OTP: delete `2019` + queue delete | 1 | 12 | 12 |
| Redirect inserts (rowid table, no index) | 1,979 | 1 | 1,979 |
| `instrument_entity_map` repoints (measured) | 74 | 2 | 148 |
| (iii) LEIs onto survivors (as 011 A, incl. Level 2) | 3 | ≈ 6.3 | ≈ 19 |
| Heartbeats / outbox (about 40 batches × 2 events) | 80 | ≈ 6 | ≈ 480 |
| **Core total (Mon 2)** | | | **≈ 32,011** |
| *November:* optional remainder (642 × 12 + 642 redirects + 132 × 2 + about 156 heartbeats) | | | ≈ 8,766 |
| *November, if automated:* (v) cross-pair LEIs | | | ≈ 150 |

**Brief comparison:** the brief estimated ≤ 40.9k for pairs only, with ≤ 10k of unmeasured repoints. Measured core is ≈ 32.0k, because the repoints are 148, not up to 10k. The 3-way and OTP rows are added, and the optional set is moved out.

**Mon 2 against the caps:**

- **Freeze:** the seed fires during the Mon 03:30–08:00 freeze. Account writes by 08:05 are about 33–34k (5 Oct: 33,097; 28 Sep: 34,331).
- **Under 011's gates:** 011 used ≤ 25k a day for itself and account + batch ≤ 60k (ML-1012-1). That leaves **about 26k on Mon 2, less than 32.0k.** **Founder Q1.**
- **With Q1 = yes:** 013 Mon 2 cap **33k**, and account + batch ≤ **70k** for Mon 2 only. That still leaves ≥ 10k under the 80k `DAILY_WRITE_LIMIT` guard and 30k under the 100k account cap.
- **No Sunday writes.** Sat 31 is A2's window (other Entities writers frozen until Sun 1 00:10Z).

**Read budget (Mon 2):**

| Item | Reads |
|---|---|
| Plan-time keyset export of `entity_master` (≤ 5k per page) | ≈ 45k |
| Per-batch pre-images and CAS | ≈ 12k |
| `do_not_merge` read | ≈ 10 |
| Post-run re-export and verification | ≈ 50k |
| **Total** | **≈ 110k** (2.2% of the daily read cap; every execution ≤ 45k) |

## 9. Batching and run gates (brief N-6; the 011 runner pattern)

**Runner:** `App/Corporate Atlas/scripts/merge-013.mjs`, local and interactive (built in its own build packet). It reuses the 011 libraries: headroom gate, outbox, run log, `FREEZES.json` check, CAS, pre-image and restore.

**Batches:** ≤ 50 merges (≤ 400 statements, ≤ about 900 writes declared), with a checkpoint per batch.

**Gates before every batch** (fail closed):

- **Kill switch:** pause and stop flags, plus `hold_all_jobs` at start.
- **Headroom:** `d1-today` with a 2 s ceiling and 1 retry; fresh ≤ 120 s and today's UTC date; F-1 to F-5. Otherwise `headroom_unavailable`, no batch, cursor unchanged.
- **Budget:** 013's day total + batch ≤ 25k (33k on Mon 2 under Q1), and account + batch ≤ 60k (70k on Mon 2 under Q1).
- **Calendar:** no Sunday; nothing before 08:00 on Monday; avoid every `FREEZES.json` band (07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, the ≈ 22:00 health-check sweep, 23:50–00:10).
- **Production end:** stops by **23:45Z**. An unfinished step waits for a new Control and is never skipped silently.
- **Observability:** the 002 outbox, or the daily run-log reconciliation signed by the Operations Lead (011 R-4).
- **Change freezes for the run window:** `meridian-ops`, `OPS_INGEST_KEYS` and the Entities Workers. **One production change at a time across lanes:** 013 does not overlap the Mon 2 site release; the Main Lane sequences them.
- **Pause the other Entities writers during the run:** enrich Phase 1–3 crons, the boost, delta and FIRDS, via `ops_job_pause` / holds, as A2 §7 does. The seed is not due on Mon 2 after 08:00.

**Runtime second guard (L11-13, amended):** stop and re-plan if, at plan time, R > 5,000, R has grown > 20% over the measured 74 (core), or repoint writes would exceed 10,000.

**Stop conditions:**

- any read-back mismatch other than `raced`;
- writes > 1.3× the declared figure;
- a CAS miss on step 4 or 5 above 0.5% of a batch;
- a redirect invariant breach (§10);
- any `do_not_merge` id in a batch;
- the E-4-style trigger: a Data-Identity spot-check failure on the pilot.

## 10. Read-back and verification

**Per batch:**

1. Pre-image all touched rows (`entity_master` duplicate and survivor, their queue rows, the instrument rows, any edge) to `preimage-<batch>.jsonl`, and record its SHA in the checkpoint.
2. Execute.
3. Read back and diff against the plan.

**After the run** (local, from the re-export):

| Check | Expected (core) |
|---|---|
| `COUNT(*) FROM entity_merge_redirect WHERE packet='MA-OCT-013'` | = duplicates deleted (1,979, less any CAS-listed) |
| every `survivor_id` exists; no `duplicate_id` exists in `entity_master`; no `survivor_id` is a `duplicate_id` | 0 violations |
| rows still referencing a `duplicate_id` in tables 1–7 (indexed probes; `fund_entity_link` by its 264-row pass) | **0** |
| `entity_master` rows | before − 1,979 (± same-day drift traced to non-013 writers) |
| LEI-bearing rows | before + 3 (the (iii) LEIs) |
| two-way survivors whose key = `normalizeName(name)` | 1,878, so the seed will not re-create twins (dry-run proof: the seed's key computation over the survivors finds them, 0 inserts) |
| Σ-weight invariant (B13-2) | trivially met (0 exposure rows on duplicates) |
| `do_not_merge` pairs and `103540` | untouched |
| sample of 200 merges | redirect resolves through 007 R3 to the survivor |

## 11. Rollback manifest and horizon

**Per batch:** re-insert each duplicate from its pre-image with its explicit `entity_id`. Then restore its queue row, the survivor's old key, the instrument rows and any (iii) LEI. Then delete its redirect rows (`packet='MA-OCT-013'`).

**Full rollback cost (core):**

| Item | Writes |
|---|---|
| Two-way: 1,878 × 16 | 30,048 |
| Three-way: 100 × 13 | 1,300 |
| OTP | 13 |
| Instrument links: 74 × 2 | 148 |
| (iii) LEIs | ≈ 19 |
| **Total** | **≈ 31.5k** |

So a full rollback cannot run on Mon 2 after a full run (seed + run + rollback > 80k). It needs its own day and an Operations Lead decision. A per-batch restore is about 900 writes and can run the same day.

The manifest lists, per batch: plan SHA, pre-image SHA, checkpoint, redirect ids.

**Horizon:** 011 and A2 rollbacks end at **013's first write** (AR11-1, A2 §9). After that, any reversal of 011 or A2 needs a joint plan reviewed by the Architect and the Operations Lead.

## 12. ETF-exposure impact (for the ETF Product Lead)

- **No exposure number changes on Mon 2.** 0 `entity_exposure_monthly` rows and 0 `fund_entity_link` rows reference any candidate, and `fund_exposure_coverage` is untouched.
- **74 instrument links move** from a duplicate to its survivor. When gate3 next recomputes, holdings of those 74 instruments are attributed to the survivor issuer instead of the twin. That consolidates exposure that was split or missing; nothing is lost.
- **007's navigation** (instrument → issuer) follows the same 74 links, and resolves old duplicate ids through the redirect.
- **No ETF table is written.**

## 13. Interaction with A2 and 011

- **A2 runs Fri 30 – Sat 31**, and other Entities writers, 013 included, are frozen until Sun 1 00:10Z (ML-1029-2). It writes Level 1 only on the older side of the 392 hand-off pairs, which is the S1 survivor. **So A2 and 013 never write the same row**, and A2's LEIs simply appear on survivors.
- **013's plan is generated from a post-A2 export on Mon 2.** 013 does not start before A2's close-out, or the Founder's decision under A2's slip rule (A2 §8).
- **E-X2 withholds** follow §5 item 3.
- **011 and A2 rollback horizons** end at 013's first write (§11).

## 14. Acceptance criteria

- [ ] CR approved, with the new table `entity_merge_redirect` and the migration path. Runner built in its own packet. Release review by the Architect, Operations Lead and ETF Product Lead.
- [ ] Runner gates (§9) pass on a dry run, including fail-closed on `headroom_unavailable` and refusal of a `do_not_merge` id.
- [ ] Plan generated from the post-A2 export. The candidate set is ⊆ the measured set. R ≤ 5,000 and within 20% of 74.
- [ ] Pilot of 50 passes read-back and the Data-Identity 20-row spot check.
- [ ] §10 checks pass. 0 dangling references. Redirect count = deletes.
- [ ] Writes ≤ the Mon 2 cap (Q1). No write in a freeze band, on Sunday or after 23:45Z.
- [ ] Every batch has a pre-image, checkpoint and heartbeat (or a reconciled run log).
- [ ] November lists delivered with SHA-256s: the optional remainder (642), the (v) cross-pair LEIs (6 / 19 rows), any new pairs, unsigned E-X2 withholds.

## 15. Timeline

| Date | Step |
|---|---|
| Thu 29 | Measurement and this spec |
| Fri 30 | Reviews: Architect, Operations Lead, ETF Product Lead. Founder Q1–Q3. 013 build packet issued (runner; no writes). |
| Sat 31 | A2 run and close (013 frozen) |
| Sun 1 | No writes. 013 dry run on a local replica. |
| **Mon 2 ≥ 08:05Z** | Plan from the post-A2 export, then release check, then the core run (§6 order), then verification. Finish by 23:45Z. |
| Tue 3 | Close-out evidence for sign-off. No production change. |

## 16. Founder questions (3)

| # | Question | Recommendation |
|---|---|---|
| **Q1** | Core needs about 32.0k writes, but Mon 2 leaves about 26k under 011's gates (seed about 34k + 60k ceiling). May 013 use a **Mon 2-only cap of 33k, with account + batch ≤ 70k**? | **Yes.** It is still ≥ 10k under the 80k guard and 30k under the 100k cap. The headroom gate still fails closed. **If no:** run two-way merges up to 25k (about 1,450 pairs), stop at a checkpoint, and finish in November. October would then ship with part of KI 22.41 open. |
| **Q2** | Where "older" and "LEI-bearing" point at different rows, may **the LEI-bearing row survive**? That covers the 50 three-way cases (both twins fold into the LEI holder) and the OTP pair (`2019` → `467290`). And may the 642-row optional remainder move to November? | **Yes to both.** The LEI holder carries the identity that GLEIF confirms, and it is S1's "LEI-bearing" half. The two twins hold only 2 instrument links between them. The remainder needs adjudication (type mismatches, incl. 2 `government` rows) and adds about 8.8k writes the day can't carry. |
| **Q3** | The 6 cross-pair LEIs (19 rows, 011 (v)): merge automatically on Mon 2 (oldest survivor keeps the LEI; the second pair and outside rows fold in), or **route them to Data-Identity adjudication in November**? | **Adjudication.** It's a cross-pair identity decision with no measured precedent. Mon 2 writes only the 3 (iii) LEIs. |

## 17. Change request and files

**CR `MA-OCT-013-CR1`:**

- **New table:** `entity_merge_redirect`, Entities domain, written only by 013 and read by 007/004.
- **Migration file and runner path:** as above.
- **Content:** row deletes; ETF-visible instrument repoints.
- **Preconditions:** ENT-CR1 complete (ML-1029-1); A2 closed.
- **Reviewers:** Architect, Operations Lead, ETF Product Lead.

## Appendix A — Measurement queries (`~/MeridianAtlas-work/ma-oct-013/`)

| Id | Query (abridged) | Executions | Reads |
|---|---|---|---|
| M0 | `sqlite_master` catalog for 10 tables | 1 | 157 |
| E1–E11 | EXPLAIN of each pattern (plans in §4) | 11 | 0 |
| S-* | sample: 500 pair duplicates × IEM, EIM, EXP, EXH, BIL, QUE, RLC, RLP, EMS | 9 | 5,510 |
| F-* | remaining 2,122 candidates × the same 9 | 45 | 23,674 |
| V-* | 2,564 survivors and holders × EMS, QUE, IEM | 18 | 18,441 |
| FEL | `fund_entity_link` | 1 | 264 |
| **Total** | | **85** | **48,046** |

**Evidence files (SHA-256):**

| File | SHA-256 |
|---|---|
| `ledger.jsonl` | `6b9ed205174a8a3ac625bc99d38cacbe3e2bb0b5480aa77052737066efee6654` |
| `ids.json` | `d21a12d2a16a262a67eb4594a502f4195ae7e9f171c5fb83055d4116d29a9078` |
| `out/S.summary.json` | `80b4064a…a4f3d` |
| `out/F.summary.json` | `f0fb8bab…440d` |
| `out/V.summary.json` | `9130244a…4027` |
| `out/FEL.json` | `c6eecaa0…b7d7` |
| `measure.py` | `0486f59e…8f83` |
| `d1r.sh` | `bd6b7759…c6d5` (guarded: SELECT/EXPLAIN/WITH/PRAGMA index_* only; refuses write keywords and the sweep/midnight bands) |

## Appendix B — Lane rulings

| # | Ruling |
|---|---|
| L13-1 | The measurement went beyond the brief's 4 tables, adding queue, relationships, exposure holder, the `entity_master` state, and survivor instrument links. It stayed inside the Task's 50k cap; the brief-scope tables took 10,828 reads. |
| L13-2 | Three merge shapes are defined (§5). The three-way and OTP survivor choice is pending Founder Q2. |
| L13-3 | `103540` is excluded: its LEI holders are the protected pair DQ-M-000002. |
| L13-4 | Every duplicate's queue row is deleted, not repointed, because every no-LEI survivor already holds one (measured). |
| L13-5 | No `survivor_id` index: 007 R3 and 004 C-1/D-1 read by `duplicate_id` PK only. |
| L13-6 | The Task labels the brief "rev 1.6"; the file is rev 1.7 at the hash the Task names. The hash governs. |
