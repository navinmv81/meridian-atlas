# Spec Brief: MA-OCT-013, KI 22.41 Duplicate-Entity Merge (IDEA)

```text
ISSUED BY:    Data-Identity Lead (from the MA-OCT-011 spec lane, per the Founder decision of 1 Oct)
EXECUTED BY:  Engineering Lead (build); spec by Data-Identity Lead (owner)
REVIEWED BY:  Architect + Operations Lead + ETF Product Lead (the merge repoints links read by ETF exposure)
APPROVED BY:  Founder
PACKET:       MA-OCT-013 — KI 22.41 duplicate twin-pair merge
GATE:         IDEA → spec lane (not opened). This brief is input only.
```

**Status:** rev 1.7, Fri 9 Oct 2026.

- **Changes in rev 1.7:** wording only, no numbers changed, from the 011 Architect Review `d097e6f9…7679` §6: **B13-1** (the survivor key UPDATE runs after the duplicate DELETE, guarded on `UNIQUE(normalized_name, type)`), **B13-2** (colliding `entity_exposure_monthly` rows are summed or recomputed, never dropped; R_collide measured; Σ-weight invariant in verification), **B13-3** (the index check matches `idx_iem_entity_key` by name and accepts `USING COVERING INDEX`). Also the rollback-horizon line (AR11-1 / N13-4) and the `fund_entity_link` verification note (N13-3). Rev 1.6 = `00ec6303…3485`.

- **Changes in rev 1.6:** wording only, no numbers changed, from the 011 Ops Review `976f0837…28f9`, OPS-R7: **R-3** (the 9 deferred LEIs are written from the 011 hand-off file's full write payload, not from `gleif_006.db`, with a ≤ 10-call GLEIF freshness re-check), **N-5** (the pre-spec measurement records measured reads, including any temp B-tree grouping), **N-6** (013's run gates written out in full; the ETF Product Lead review stays required). Rev 1.5 = `8319cc09…2085`.

- **Changes in rev 1.5:** re-cited on the **006 FINAL** basis (commit `16918e0`); the pair counts are unchanged. Adds the read-only **pre-spec measurement** of repoint cost required by Ops N-7, with L11-13 amended to match. Notes that 013 carries the highest data risk (N-7) and that the index CR is now the composite `(entity_id, instrument_key)` (Decisions Log, 5 Oct). Rev 1.4 = `de2e2e2a…f9de`.
- **Changes in rev 1.4:** adds the conditional `bond_issuer_link.entity_id` repoint, per the Main Lane correction to the 5 Oct ruling (Decisions Log, 5 Oct, `bcc39b6d…15fb7`; 008 Spec rev 0.2 §8.1, `a4dba446…320a`). The headline totals are unchanged (rev 1.3 = `4c5366e4…b496`).
- **Changes in rev 1.3:** the redirect insert is now `INSERT OR IGNORE`, so re-running a part-finished batch on resume works. No numbers changed (rev 1.2 = `4d4a199d…681d`).
- **Changes in rev 1.2:** adds the redirect table and the index prerequisite (Main Lane rulings A and B, Decisions Log 2026-10-04, `c1f2b49a…470c`).
- **Changes in rev 1.1:** survivor rule S1 decided (Founder, 3 Oct).
- **Previous versions:** rev 1.1 `829ad1e6…34f8`, rev 1 `93d2dad3…6757`, rev 0 `62d52947…8fba`.

**Sources.** Counts are **FINAL** on the 006 basis (29 Sep export), from:

- 006 **FINAL** Evidence `0d1bbf9b…ddb1bc` (§11.4, §14.3, D5-1, D7-1);
- 006 **FINAL** Matrix `db594224…f33b5a` (rank 4, §2) and Close-out `f54ae3bf…637537` (§1, §2, §3);
- 006 classification `cb3b3a84…13df64` (2,671 KI 22.41 W rows);
- 006 Ops Review `8ac07234…2c763e` (N-7);
- `cost_model.json` `a4d8169f…a975`;
- 006 D1 bounds (`d1out/D1.json`: `instrument_entity_map` `MAX(rowid)` = 32,769);
- 011 lane queries Q25–Q26, Q37–Q40, Q43–Q44 and Q71–Q75 (`MA-OCT-011_Spec.md` Appendix A).

## Problem and counts
MA-SEP-001 (16 Aug) changed `normalizeName` without migrating the stored keys. Since the dedup key is `UNIQUE(normalized_name, type)`, later seeds created a **second `operating` row on the corrected key** for entities they already held.

| Fact | Count | Source |
|---|---|---|
| Twin pairs (older drift row + newer duplicate) | **1,928** | 006 §11.4 |
| Duplicates (newer side): all `operating`; created Jun / Jul / Aug | 11 / 115 / 1,802 | Lane Q75 |
| Survivor (older side) has an LEI / does not | 756 / 1,172 | 006 §11.4; Q72 |
| Duplicate has an LEI | **0** | Q26 |
| Duplicates with a queue row / no-LEI survivors that already have one | 1,928 / 1,172 of 1,172 | Q72–Q73 |
| `entity_relationships` rows referencing a duplicate | **0** (the 1 pair edge is on the survivor side) | Q37, Q74 |
| Duplicates from 011's hand-off file (newer twins whose LEI 011 wrote on the survivor, L11-7) | 392, counted within the 1,928 | 011 §3.4 |
| LEIs 011 leaves for 013 to write | 9 LEIs / 22 rows | 011 §3.4 |
| *Optional scope:* no-LEI row whose GC LEI is already on another row (D5-1) | 743 (plus 852 medium via N+, not in scope). Includes the 2 mistyped `government` rows 250160 and 267868, which D7-1 left as merge findings for 013 | 006 §14.3, §7 D7-1; Matrix rank 4 |
| **006 FINAL check (8 Oct)** | Unchanged: 1,928 pairs; 392 twins; 743; 2,671 W rows; base ≈ 37,836 (Matrix rank 4) | Close-out §1–§3; Matrix rank 4 |

## Survivor rule: S1 (decided by the Founder, 3 Oct)
**The older, LEI-bearing row survives.**

Why S1:

- The survivor already holds the LEI in all 756 LEI cases, plus all 392 LEIs that 011 writes (011 writes only this side, L11-7).
- It carries the June-era instrument, exposure and ISIN links.
- Precedent: MA-SEP-007.

*Also considered and set aside:* the newer row surviving, and "the LEI-bearing row, else the older" (identical to S1 here).

## Hard precondition: the `instrument_entity_map(entity_id)` index (ruling A)
- **The change:** the additive `CREATE INDEX` on `instrument_entity_map(entity_id)` is a separate Entities-domain CR. The Decisions Log of 5 Oct records it as the composite `(entity_id, instrument_key)`; its leading `entity_id` column serves 013's lookups unchanged. The Founder approves it on 12 Oct, and the Engineering Lead applies it on **Tue 13 Oct** (about 33k writes for the build, with the three-point check).
- **The 013 runner's first check:** it confirms the index exists, through `PRAGMA index_list('instrument_entity_map')` or, if D1 refuses the PRAGMA, `EXPLAIN QUERY PLAN SELECT instrument_key FROM instrument_entity_map WHERE entity_id = ?`, which must name the composite index **`idx_iem_entity_key`** and show `SEARCH instrument_entity_map USING INDEX idx_iem_entity_key (entity_id=?)` **or** `… USING COVERING INDEX idx_iem_entity_key (entity_id=?)` (B13-3). The check matches **on the index name**, not on a literal plan string: a literal match could stop a correct run, and a loose one could pass the wrong index. **If the index is missing, the runner stops and writes nothing.**
- **Why it is a hard stop:** without the index, the per-duplicate lookup is a SCAN. 1,928 duplicates × 32,769 rows ≈ **63.2M reads**, beyond the daily read cap.
- **Ordering:** index on 13 Oct → 011 runs 17–23 Oct → 013. **Unchanged.**

**Conditional precondition: `bond_issuer_link` (MA-OCT-008).**

- The runner runs `SELECT 1 FROM sqlite_master WHERE type='table' AND name='bond_issuer_link';`.
- **If the table is absent:** skip repoint 7 and log the reason (`bond_issuer_link not present`).
- **If the table is present:** `idx_bil_entity` must exist (`PRAGMA index_list('bond_issuer_link')`, or `EXPLAIN QUERY PLAN` showing `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)`). **If the index is missing, the runner stops and writes nothing.** This is the same rule as the `instrument_entity_map` index precondition.

## Redirect table: `entity_merge_redirect` (ruling B)
**Schema:**

```sql
CREATE TABLE IF NOT EXISTS entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,  -- rowid alias: no separate PK index
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT    NOT NULL,     -- ISO-8601 UTC
  packet       TEXT    NOT NULL      -- 'MA-OCT-013'
);
```

- **Domain:** **Entities.** **013 is the only writer**, and 007 reads it (through `meridian-entities-api`).
- **CR:** named in 013's CR as a **NEW TABLE**, migration `App/Corporate Atlas/migrations/ma-oct-013-entity-merge-redirect.sql`.

**Rows:** **one per deleted duplicate**.

- 1,928 for the pairs. 011's 392 hand-off twins are among them and add no rows.
- +743 if the optional D5-1 rows are merged (each is redirected to the row holding its LEI), for 2,671 in all.
- Survivors are never deleted by 013, so its rows never chain.

**Index (L11-14):**

- **No `survivor_id` index in v1.** 007 resolves a stale link by `duplicate_id`, which is a rowid lookup costing about 1 read.
- If 007's spec needs the reverse lookup (survivor → its merged-away ids), add `idx_merge_redirect_survivor` before the first insert. That costs +1 write per row (+1,928, or +2,671) and nothing to build on an empty table.

**Same batch as the delete, with invariants that hold without relying on atomicity (L11-14; the 011 precedent).** Within one batch, statements run in this order:

1. `INSERT OR IGNORE INTO entity_merge_redirect … SELECT ?, ?, ?, 'MA-OCT-013' WHERE EXISTS (SELECT 1 FROM entity_master WHERE entity_id = :survivor)`.
2. The repoints, each a compare-and-set (CAS) against the pre-image. The bond link, when its table exists, is `UPDATE bond_issuer_link SET entity_id = :survivor WHERE entity_id = :dup AND <pre-image predicate>`.
3. `DELETE FROM entity_master WHERE entity_id = :dup AND EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id = :dup)`.
4. **The survivor key UPDATE, after the delete (B13-1).** The survivor's corrected key is the key the duplicate holds today, and `entity_master` has `UNIQUE(normalized_name, type)`, so this step runs only after step 3, as a CAS that also requires `NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = :new AND type = :type)`. **If step 3's CAS missed, step 4 does not run.**

So a redirect never points at a missing survivor, and a deleted duplicate always has a redirect. A batch that stops part-way leaves a redirect with the duplicate still present, which is harmless; the resume finishes the delete. On resume, step 1 is a no-op for redirects already written (INSERT OR IGNORE), and step 4 re-runs safely under its CAS.

**Colliding exposure rows are merged, never dropped (B13-2, ETF Product Lead).** `entity_exposure_monthly` has `PRIMARY KEY (report_month, entity_id, holder_entity_id)`. Where both twins carry exposure from the same fund in the same month, a straight repoint collides. The MA-SEP-001 precedent deleted the duplicate's colliding row, which understated the issuer's exposure until the next recompute. The 013 spec must choose one of: **(a)** fold the duplicate into the survivor (`weight_sum = s.weight_sum + d.weight_sum`, `aum_weighted` likewise, NULL-safe), then delete the duplicate row; or **(b)** after the `instrument_entity_map` repoint, recompute the affected `(report_month, holder_entity_id)` pairs through the gate3 path, under its own read budget. `fund_exposure_coverage` needs no change. `entity_isin_map` (PK `(isin, lei)`) and `instrument_entity_map` (PK `instrument_key`) cannot collide on a repoint.

**Rollback:**

1. Re-insert each duplicate from its pre-image with its explicit `entity_id`.
2. Restore its links (including `bond_issuer_link.entity_id`, from the pre-image), its queue row and the survivor's old key.
3. **Then** `DELETE FROM entity_merge_redirect WHERE duplicate_id = ? AND packet = 'MA-OCT-013'`, at 1 write each.

**Verification:**

- `COUNT(*) WHERE packet='MA-OCT-013'` = duplicates deleted;
- every `survivor_id` exists in `entity_master`;
- no `duplicate_id` exists in `entity_master`;
- no `survivor_id` is also a `duplicate_id`;
- 0 rows in `instrument_entity_map`, `entity_isin_map`, `entity_exposure_monthly`, `entity_relationships`, `fund_entity_link`, the queue or (if present) `bond_issuer_link` still reference a `duplicate_id`. Each check is an indexed lookup, **except `fund_entity_link`**, which has no `entity_id` index and is checked by the ≈ 300-row pre-pass (N13-3);
- **Σ-weight invariant (B13-2):** for every affected `(report_month, holder_entity_id)`, Σ `weight_sum` before (duplicate + survivor, from the pre-images) equals the survivor's value after.

*Optional note, out of scope:* the redirect could later be back-filled from earlier merge SQL (MA-SEP-007's 123 losers, MA-SEP-001's map). If that happens, chains must be flattened on write.

## What must be repointed, and how it is read (with the index)
| # | Table | Read per duplicate (after ruling A) | Local evidence | Write per repointed row |
|---|---|---|---|---|
| 1 | `entity_relationships` | `idx_entity_rel_child` + `idx_entity_rel_parent` seeks | **0 rows** reference a duplicate (Q74) | — |
| 2 | `fund_entity_link` | one pre-pass over the small table (fund ETFs, about 300 rows), not per duplicate | duplicates are `operating`, not funds, so 0 expected | 1 (no `entity_id` index) |
| 3 | `instrument_entity_map` | **`idx(entity_id)` seek** (ruling A) | not exported; ≤ 32,769 rows in the table | 2 (row + new index) |
| 4 | `entity_isin_map` | `idx_entity_isin_map_entity` seek | not exported | 2 |
| 5 | `entity_exposure_monthly` / `fund_exposure_coverage` | `idx_exposure_entity` seek / 0 (holders are funds) | not exported | ≈ 3 (PK autoindex + `idx_exposure_entity`). **ETF-visible; the ETF Product Lead reviews this.** |
| 6 | `entity_enrichment_queue` | PK | all 1,928 duplicates have a row, and every no-LEI survivor already has one, so **delete all 1,928 with 0 repoints** (Q72–Q73) | 2 (in the pair line below) |
| 7 | `bond_issuer_link.entity_id` (MA-OCT-008, Entities domain): **only if the table exists at run time** | `idx_bil_entity` seek (partial, `WHERE entity_id IS NOT NULL`) | not built yet; ≤ about 30 rows in the whole table (one per seed-list issuer, 008 §8.1) | ≈ 3 (row + partial-index entry change) |
| 8 | `entity_master` | PK | — | the pair line below, plus the 9 deferred LEIs |

`bond_issuance` itself is **not** repointed. It has no `entity_id` and links through `cik` → `bond_issuer_link.cik`, so it needs 0 repoints.

**Cross-lane note:** under the same ruling, 008 links bonds to the S1 survivor at write time, checking `entity_merge_redirect` once it exists. So 013's bond repoints should be close to 0; they are a safety net, as is 007's read-time redirect.

**Repoint read estimate (L11-13):**

- **Pairs only:** about 6 index seeks per duplicate (rows 1, 3, 4, 5 and the queue PK) × 1,928 ≈ 11.6k reads. If `bond_issuer_link` exists, add 1 `idx_bil_entity` lookup per duplicate (≈ 1,928), for ≈ **13.5k reads**. Plus R, the number of matched rows, plus about 300 for the `fund_entity_link` pre-pass.
- **With the 743:** about 16k + R, or about 18.7k + R with the bond lookup.
- **R includes the `bond_issuer_link` rows matched by `duplicate_id`.** Expected ≤ about 30 rows, so ≤ about 90 writes.
- **R is not derivable from the local exports** (006 never exported tables 3–5). **It is measured before 013's spec is approved** (the pre-spec measurement below, Ops N-7). The runtime cap stays as a second guard: **if R at run time is > 5,000, has grown more than 20% over the measured figure, or the repoint writes would be > 10,000, the runner stops and the plan is redone.**
- Every single execution stays ≤ 50k reads.

### Pre-spec measurement of repoint cost (Ops N-7, binding before 013 spec approval)
013 carries **the highest data risk in the 006 matrix** (Ops N-7): it is a merge across referencing tables, including ETF-visible exposure facts. So its write cost is **measured, not just capped**, before its spec is approved.

| | Rule |
|---|---|
| **When** | After the index CR is applied (Tue 13 Oct) and **before** 013 spec approval |
| **Who / how** | A read-only query pack in the Engineering Lead session, the same pattern as the 002/007/008 packs. Through a guarded helper that refuses anything except `SELECT` / `EXPLAIN` / `WITH`. Pinned wrangler version (Ops N-1). Never 04:00–07:00 UTC Sunday or Monday. |
| **Input ids** | The 1,928 duplicate ids (006 `day3/norm_hidden_duplicates.csv`, `collides_with`). Optionally the 743 D5-1 ids (classification KI 22.41 W rows not in a pair). |
| **Queries** | For each table, in chunks of ≤ 500 ids: `SELECT entity_id, COUNT(*) FROM <t> WHERE entity_id IN (…) GROUP BY entity_id`. Tables: `instrument_entity_map`, `entity_isin_map`, `entity_exposure_monthly`, and `bond_issuer_link` (only if the `sqlite_master` check finds it). Plus one read of `fund_entity_link` (about 300 rows). |
| **EXPLAIN first** | Each query must show `SEARCH … USING INDEX` or `USING COVERING INDEX`, matched **by index name**: `idx_iem_entity_key` (B13-3), `idx_entity_isin_map_entity`, `idx_exposure_entity` and `idx_bil_entity` respectively. **Abort on any SCAN** of these tables. The `GROUP BY` should stream on the leading index column; if `USE TEMP B-TREE FOR GROUP BY` appears, the 9 Oct 2.5 × N rule applies to the declared cap (N13-2). |
| **Read budget (declared)** | About 4 seeks × 1,928 ≈ 7.7k + matched rows R + about 300. **Declared cap: 25k reads (pairs only), 35k with the 743.** Every single execution stays ≤ 50k reads (a 500-id chunk reads about 500 + its matched rows). Stop and report at the cap. |
| **Output** | R per table, and so the **measured repoint writes** (Σ R_t × writes per row, from the repoint table above). These replace the "≤ 10,000" placeholder in the cost table before spec approval. For `entity_exposure_monthly`, also count **R_collide** separately: rows where survivor and duplicate both hold `(report_month, holder_entity_id)`, which collide on the PK and cost a survivor `UPDATE` (1) plus a duplicate `DELETE` (≈ 3) instead of a repoint (B13-2). **Also record the measured reads per query**, not only R: a `GROUP BY entity_id` over an `IN` list may add a temp B-tree for grouping, and those rows count (N-5). At ≤ 500 ids per chunk the effect is small; the declared 25k / 35k caps stand. 0 D1 writes. |

## Ordering relative to 011
**After 011** (011 spec Q3, ordering only; S1 decided). Under S1, 011 writes only the surviving side (L11-7). It never touches a duplicate, a duplicate's key or a duplicate's queue row. 013 then deletes the 392 hand-off twins (within the 1,928) and writes the 9 deferred LEIs.

**Rollback horizon (AR11-1 / N13-4):** 011 rollback is valid until 013 starts. **After 013's first write, any 011 reversal needs a joint 011/013 plan reviewed by the Architect and the Operations Lead.**

**Source of the 9 deferred LEIs (R-3).** `gleif_006.db` is deleted when 011 closes (R4 / N-6), before 013's build. So 013 writes the 9 deferred LEIs / 22 rows **from the 011 hand-off file's full write payload** (Level 1 and Level 2 values plus Golden Copy provenance; SHA-256 in the 011 close-out), plus a **≤ 10-call GLEIF freshness re-check** at its run. It **never writes from a rebuilt DB** without re-running 006's tiers (N-2). Running 013 before 011 would push 011 past October; running them interleaved risks races.

Target: 013 spec in Wave 3 (from about 19 Oct), build after 011 closes (about 26 Oct), or November.

## Write-cost estimate (006 FINAL basis, the same rules as 011 §4.2; repoints to be measured, N-7)
| Step | Rows | Writes/row | Writes |
|---|---|---|---|
| `CREATE TABLE entity_merge_redirect` | — | — | about 2 (schema) |
| Per pair (S1): delete the duplicate (1 + 9; not in `phase3`) + delete its queue row (2) + update the survivor key (1 + normalized + autoindex = 3) | 1,928 | 15 | 28,920 |
| **Redirect insert** (1 row; `duplicate_id` is the rowid, so no PK index; no secondary index in v1) | 1,928 | **1** | **1,928** |
| The 9 deferred LEIs onto survivors (as 011 A, including Level 2), from the 011 hand-off payload (R-3) | 9 | ≈ 6.3 | ≈ 60 |
| Link repoints (tables 2–5 and 7; 0 for tables 1 and 6) | R (**measured before spec approval**, N-7) | 2–3 | **≤ 10,000 until measured; then the measured figure, with the runtime cap as a second guard** |
| ↳ of which `bond_issuer_link.entity_id` (only if the table exists) | ≤ about 30 | ≈ 3 | ≤ about 90 (inside the 10k cap; reads ≈ 1,928 lookups) |
| **Total, pairs only** | | | **≈ 30.9k + repoints (≤ 10k) = ≤ 40.9k** |
| *Optional:* the 743 D5-1 rows (12 each) + their redirects (1 each) | 743 | 13 | +9,659 → **≤ 50.6k** |
| *Optional:* `survivor_id` index | 1,928 / 2,671 | 1 | +1,928 / +2,671 |

- **Run:** 2 days at ≤ 25k a day (pairs only), or 3 days with the 743, under the same gates as 011. **013's spec writes those gates out in full (N-6):** the `d1-today` headroom gate with F-1 to F-5 (fail closed on `headroom_unavailable`); ≤ 25k writes a day by 013, within the account check; no Sunday, no Monday before 08:00 UTC, no enrich windows; the observability gate (002 outbox live, **or** the daily reconciliation per 011 R-4: Engineering Lead exports, Operations Lead signs by 09:00 UTC, unsigned day blocks the next); and the change freezes on `meridian-ops`, `OPS_INGEST_KEYS` and Entities Workers for the run window. 013 is ETF-visible (exposure repoints), so **the ETF Product Lead review stays required**.
- **Full rollback:** about 16 per pair (re-insert 10 + queue 2 + key 3 + redirect delete 1) ≈ 30.9k, plus the reversed repoints.

**Owner:** Data-Identity Lead. **Executor:** Engineering Lead. **Reviewers:** Architect, Operations Lead, ETF Product Lead. **Approves:** Founder. **Change Request:** required. It covers a **new table** (`entity_merge_redirect`), row deletes, and ETF-visible exposure repoints, and has a **precondition** on the separate `instrument_entity_map(entity_id)` index CR. **Highest data risk in the 006 matrix (Ops N-7):** its spec is approved only once the pre-spec measurement has replaced the repoint placeholder.
