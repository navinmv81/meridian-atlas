# MA-OCT-013 — KI 22.41 Duplicate-Entity Merge: Spec

```text
ISSUED BY:    Main Lane (Program Orchestrator). rev 0: Control MA-OCT-013.SPEC v1 (7952429e…a083), Thu 29 Oct 2026
              rev 1: Control MA-OCT-013.SPEC1 v1 744c0790da1f3a486548c4942b92cc26b1db14bd14c72609d70e0de230e87105, Wed 4 Nov 2026
EXECUTED BY:  Engineering Lead (for the Data-Identity Lead, brief owner), LANE-11-ENG
REVIEWED BY:  rev 0 — Architect 83d9c894…25fa, Operations Lead 4a879de2…8262, ETF Product Lead 381ccb99…e6e84 (all PASS WITH NOTES)
              rev 1 — Architect delta check (MA-OCT-013.CHECK, Thu 5 by 17:00Z)
APPROVED BY:  Founder — Q1–Q3 (ML-1029-4); 013 + 002b first after the October release (ML-1030-6); run Thu 5 ≥ 18:15Z,
              cap 33k / account ≤ 70k, remainder → first November item (ML-1104-2; run approval on the RUN board row)
PACKET:       MA-OCT-013 — KI 22.41 duplicate-entity merge
GATE:         Spec approval → BUILD → CHECK → RUN
```

**Status:** **rev 1**, Wed 4 Nov 2026. It folds all 15 review MUST-FIX items (§18) and measures the 4 unmeasured `entity_id` tables (Arch M-3 / ETF MF-1, §4.2).
- Re-measured the live state on 4 Nov; nothing changed in the core counts.
- **Three findings change the Thu 5 scope:**
  - **I-1, wrong-company pairs:** 3 are excluded, 6 more need a Data-Identity signature (§5.2).
  - **Seed re-creation of three-way and OTP:** all 101 rows are held to November (§5.3).
  - **Filings/13F references:** 7 two-way merges are held to November (§5.4).

**Previous version:** rev 0 `9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3`.

**Governing inputs** (all read-only, hashed at read time):

| Input | SHA-256 | Note |
|---|---|---|
| SPEC1 Task `MA-OCT-013.SPEC1_Task_v1.md` | `b4393fa1d6de5be77d33577b083e8c79f3c5c94dfa3d667879146e187700008f` | matches the Control |
| rev 0 (this file before rev 1) | `9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3` | |
| Architect review | `83d9c89416346dc3e7521692b03dfd6b6df9f0de492d76174c286becd15425fa` | M-1..M-7, N-1..N-6 |
| Operations review | `4a879de2ba828cdd5d8310cd1cae6d1e9bbb9c30f067a23ae64d36272ff28262` | M-1..M-6, N-1..N-10 |
| ETF Product Lead review | `381ccb991149f6c76fb265f17eefbbe26a014eb3f7d89e8236696b7bf6da6e84` | MF-1..MF-2, N-1..N-6 |
| Brief `claude/MA-OCT-013_Spec_Brief.md` | `a79bb98b…13de` | rev 1.7 (L13-6) |
| 011 hand-off `…/gleif-011/plans/release-2026-10-16/handoff-013.json` | `0597e15dedcf50a4bcc4f8e35b3a9f826a1b0278c093699aa3808d70b3a56009` | (iii) payloads |
| `gleif_006.db` (pinned GC, 28 Sep 16:00) | as 011 | three-way and (iii) identity checks |
| `FREEZES.json` (read live at plan time, §9) | `5b3400c03eba2fcf7026f72a4dc37aa5d2ded17a0cdc45599dc895c381f36791` on 4 Nov | A2 window removed 30 Oct; no 013 window yet (§9) |
| `App/Corporate Atlas/src/entities-seed.js` at `a3e3f1f` | `normalizeName` used for §5.3 / N-2 | |

**Lane record, rev 1:**
- **D1:** read-only. **21,848 reads, 0 writes, 103 executions; largest execution 500 reads**, against the Task cap of 30,000. Indexed paths only, each EXPLAINed first; no table scanned.
- **Tools:** `/usr/local/bin/wrangler` 4.96.0; `whoami` pre-flight passed.
- **Files:** scripts and raw outputs in `~/MeridianAtlas-work/ma-oct-013/spec1/`; guarded helper `d1r.sh` (SELECT/EXPLAIN/WITH only).
- **Hygiene:** no secret read; HEAD `a3e3f1f`, branch `October-2026`, no lock files.

---

## 1. Problem

MA-SEP-001 (16 Aug) changed `normalizeName` without migrating stored keys. Because the dedup key is `UNIQUE(normalized_name, type)`, later seeds created a second `operating` row on the corrected key for 1,928 entities they already held (KI 22.41). 006 also found **743** no-LEI rows whose Golden Copy LEI already sits on another row (D5-1).

Duplicates split exposure, instrument links and identity across two rows, and the stale key lets the seed keep the split alive. 013 is the highest-data-risk packet in the 006 matrix (Ops N-7), because it deletes rows that other tables reference.

**New in rev 1: the corrected `normalizeName` also collapses some *different* companies onto one key.** It strips legal-form words, so "Nice Corporation" (JP) and "Nice Ltd" (IL) both become `NICE`. 3 such pairs were in the rev 0 "two-way" set (§5.2). Merging them would fuse two issuers. The seed-side defect is a November item (§16).

## 2. Goals

**Rev 1, Thu 5 run (default, no signatures):**
1. Merge **1,862** two-way duplicates into their survivors:
   - the 1,878 measured pairs;
   - minus 9 I-1 review pairs (§5.2);
   - minus 7 Filings/13F-referenced pairs (§5.4).

   It is **1,868** if the Data-Identity Lead signs the 6 sign-eligible I-1 pairs at the plan review.
2. Write one `entity_merge_redirect` row per deleted row, so 007 and 004 resolve stale ids. **0 dangling references in every table** (Entities, ETF bridge, and the 4 Filings/13F tables; §4.2).
3. Give each survivor the duplicate's key, so the seed cannot re-create the twin. Proven for all 1,868 pairs with the live `normalizeName` (§5.3).
4. Carry over the duplicate's `cik` where the survivor has none (fill-only; 2 rows on Thu 5).
5. Write the 3 deferred (iii) LEIs onto their survivors from the 011 hand-off payload (W1-A guarded).
6. Stay within **33k writes** for 013 and **≤ 70k** for the account, with every merge reversible from a pre-image in the B13-4 order (§11).

**Moved to November (Founder fallback, ML-1104-2), with lists and SHA-256s (§16):**
- the 50 three-way cases (100 rows) and the OTP pair;
- the 3 I-1 rejects;
- the 6 I-1 sign-eligible pairs (if not signed);
- the 7 Filings/13F-referenced pairs;
- the optional D5-1 remainder (643, incl. protected 103540);
- the (v) cross-pair LEIs.

## 3. Non-goals

- **The optional D5-1 remainder** (643 rows, incl. 103540) and **the 6 cross-pair LEIs** (011 (v), 19 rows) → November (Founder Q2, Q3).
- **Protected pairs:** never merged (003 §10.6). The 3 `do_not_merge` pairs are read from Ops at plan time.
- **No writes to any ETF table, 13F table or Filings table** (`managerissuerpositionquarterly`, `issuereventstream`, `issuerperiodsummary`, `financialfact_reported`). They are other domains. This is enforced by an allow-list (§6.4) and made safe by §5.4.
- **Recomputing `entity_exposure_monthly`:** not needed, because 0 exposure rows reference a candidate. See §12 for when gate3 picks up the moved links.
- **No change** to `type` or to an existing LEI. 004 seeds and members are never rewritten (004 §7.6); they are read through the redirect.
- **No seed or `normalizeName` change** in 013 (§16 November).

## 4. Measurement

### 4.1 Rev 0 pre-spec measurement (Thu 29 Oct; unchanged, summarised)

- **Cost:** 48,046 reads, 85 executions, 0 writes. Ledger `~/MeridianAtlas-work/ma-oct-013/ledger.jsonl` `6b9ed205…6654`.
- **Indexes:**
  - present and EXPLAINed: `idx_iem_entity_key`, `idx_bil_entity`, `idx_entity_isin_map_entity`, `idx_exposure_entity`, `idx_exposure_holder`, `idx_entity_rel_child`, `idx_entity_rel_parent`;
  - `entity_master` and queue by integer PK;
  - no temp B-tree;
  - `fund_entity_link` is a declared 264-row SCAN (no `entity_id` index; §6.3);
  - `entity_merge_redirect` is absent.
- **References to candidates:**

  | Table | Rows on candidates |
  |---|---|
  | `instrument_entity_map` | 205 (74 core) |
  | `entity_isin_map` | 0 |
  | exposure (`entity_id`, holder) | 0 |
  | `bond_issuer_link` | 0 |
  | relationships | child 0; parent 1 (OTP holder 467290, a survivor) |
  | `fund_entity_link` | 0 |
  | queue | every candidate (deleted, never repointed) |

### 4.2 Rev 1 measurement (Wed 4 Nov, 20:37–20:50Z; Arch M-3, ETF MF-1)

**Totals:** **21,848 reads, 103 executions, 0 writes**, against the Task cap of 30,000. Ledger `~/MeridianAtlas-work/ma-oct-013/spec1/ledger.jsonl` (SHA in §Appendix A).

**Catalog** (`sqlite_master`), which **settles the review disagreement**:
- Three of the four tables **do** have an `entity_id` index: `idx_mqp_entity_id`, `idx_ies_entity_id`, `idx_ips_entity_id`. The ETF review was right; the Architect's "no `entity_id` index" applies only to the fourth.
- `financialfact_reported` has **no** `entity_id` index. Its only secondary index is `idx_financialfact_cik_tag (cik, xbrl_tag)`, so it is probed **by the duplicate's `cik`**, never scanned.

**EXPLAIN** (every probe, before running it):

| Probe | Plan |
|---|---|
| 13F positions by `entity_id` | `SEARCH managerissuerpositionquarterly USING COVERING INDEX idx_mqp_entity_id (entity_id=?)` |
| events by `entity_id` | `SEARCH issuereventstream USING COVERING INDEX idx_ies_entity_id (entity_id=?)` |
| period summary by `entity_id` | `SEARCH issuerperiodsummary USING COVERING INDEX idx_ips_entity_id (entity_id=?)` |
| facts by `cik` (bounded, `LIMIT 400` per cik) | `SEARCH financialfact_reported USING INDEX idx_financialfact_cik_tag (cik=?)` (+ temp B-tree for the GROUP BY over ≤ 400 rows) |
| `entity_master` | `SEARCH … USING INTEGER PRIMARY KEY` |
| LEI holder (W1-A) | `SEARCH entity_master USING COVERING INDEX idx_entity_master_lei (lei=?)` |
| holdings name (§5.3) | `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)` |

**Rows referencing any of the 1,979 core duplicate ids** (measured for **all** 1,979, not a sample):

| Table | Rows | Duplicates (id: rows) | Repoint cost (if done) | Index serving the lookup |
|---|---|---|---|---|
| `managerissuerpositionquarterly` | **107** | 363 Futu: 87; 555 Valaris: 20 | 214 (row + `idx_mqp_entity_id`) | `idx_mqp_entity_id` |
| `issuereventstream` | **83** | 555: 14; 599 Helen of Troy: 15; 637 Orion: 25; 641 Expro: 14; 1182 Civeo: 15 | 166 | `idx_ies_entity_id` |
| `issuerperiodsummary` | **72** | 555, 599, 637, 641: 18 each | 144 | `idx_ips_entity_id` |
| `financialfact_reported` | **585** | 641: 93; 555: 73; 599: 106; 637: 97; 1182: 73; 3474 Hanover: 77; 3464 Old Republic: 66 | 585 (no `entity_id` index; table row only) | `idx_financialfact_cik_tag` via the duplicate's `cik` (17 candidate ciks; complete, every cik < 400 rows) |
| **Total** | **847** | **8 distinct duplicates** | **≈ 1,109** | |

**Reading:**
- **All 8 are newer twins that hold the CIK their older survivor lacks.** The Filings and Equities seeds map `cik → entity_id` from `entity_master WHERE cik IS NOT NULL`, so they picked the twin. 13F took `entity_id` from `instrument_entity_map`.
- **The other 1,971 duplicates have 0 rows in all four tables.**
- **Rebuild cost:** the owning seeds re-derive from `cik` once the survivor carries it (§6.2 step F). Re-running the 4 seeds costs far more than the 1,109-write repoint.
- **Shape:** 7 of the 8 are two-way pairs; 1 (3464 Old Republic) is a three-way twin.

**Live state re-checked (4 Nov):**
- **`entity_master`:** the PK reads of all 3,907 core ids (1,979 duplicates + 1,929 survivors; 111491 is both, §5.1) show:
  - all exist;
  - **0 duplicates hold an LEI**;
  - 0 duplicates were touched by 011 (`gleif_enrichment_version` ≠ 11).
- **`instrument_entity_map`:** **74** rows on 71 duplicates (two-way 71, three-way 2, OTP 1), unchanged from 29 Oct.
- **`entity_enrichment_queue`:** **1,979** rows (1,970 pending, 9 failed).
- **(iii) LEIs:** none of the three is held by any row (W1-A probe: 0 rows).

**Column carry-over (Arch M-4), measured over all 52 `entity_master` columns, per merge:**
- **Fill-only candidates** (the duplicate is non-NULL and the survivor is NULL): **only `cik`**, on **16** duplicates (two-way 9, three-way 7).
- **No other column:** no `primary_ticker`, `other_names`, address or LEI column, and no `has_*` / count flag is greater on the duplicate.
- **Not carried, justified:**
  - `country` differs on 241 two-way pairs, but both sides are non-NULL. It is incorporation versus listing country (KY vs HK, NL vs IT); the survivor's value is kept and nothing is lost.
  - `gleif_enrichment_version` differs on 854 pairs; it is provenance, and the survivor's is kept.
- **Of the 16 `cik` fills, 2 fall in the Thu 5 run set:**
  - 357 Spotify → 98848, `0001639920`;
  - 3481 Travelers → 1712, `0000086312`.

  The other 14 are on held merges (§5.3, §5.4).

**Pre-existing data issues found (not 013's; for November, §16):**
- `financialfact_reported` rows for CIK `0000086312` (Travelers) carry `entity_id` **2298**, which no longer exists in `entity_master`. That is an existing dangling reference.
- Survivors 25821 "XEROX HOLDINGS CORPORATION" and 27677 "XEROX CORPORATION" share CIK `0001770450`.

## 5. Scope and survivor rule

### 5.1 Shapes (unchanged from rev 0) and plan-time disjointness (Arch M-6)

| Class | Measured | Survivor | Thu 5 (rev 1) |
|---|---|---|---|
| **Two-way pair** | 1,878 | the **older** row | **1,862** (default) / 1,868 (6 signed) |
| **Three-way** (both twins no LEI; LEI on a third row) | 50 cases / 100 rows | the LEI holder (Q2) | **held → November** (§5.3) |
| **OTP pair** (004 ticket) | 1 | `467290` (LEI holder; Q2) | **held → November** (§5.3) |
| **Optional D5-1 remainder** | 643 (incl. protected 103540, 2 `government` rows) | LEI holder | November (Q2) |
| **Protected** | 103540 | — | never |

**Disjointness (Arch M-6), now a plan-time assertion that refuses the plan when false:**
- survivors ∩ duplicates = ∅;
- no survivor is an existing `entity_merge_redirect.duplicate_id`;
- no duplicate already has a redirect row;
- no three-way holder is itself a candidate.

**On the measured set it failed once:** **111491** "FUJI CORPORATION" was the duplicate of 110851 and also the survivor of 242300 (a chain). I-1 (§5.2) removes the 110851 ← 111491 pair, so 111491 survives with its twin 242300, and **the Thu 5 set is disjoint (0)**. Every redirect is therefore single-hop, inside 007 R3's `NAV_MAX_HOPS = 3` (Arch N-1, ETF N-4; rev 0's "≤ 5 hops" was wrong).

### 5.2 Identity guard I-1 (new in rev 1; plan time, two-way pairs)

**Why:** the pair set was keyed on `normalizeName` alone. Measured on 4 Nov:
- 933 pairs have identical names;
- 197 differ only in punctuation;
- 748 differ in spelling, nearly all legal-form spelling ("Corporation"/"Corp", "LIMITED"/"Ltd").

A stem-only test is **not** enough. FUJI and Nice have identical stems (`FUJI`, `NICE`), because stripping every form word is exactly what makes them collide.

**Rule** (pure function, `identity_guard.py` → the runner's core library). A two-way pair is mergeable only if **both** hold:
- `stem(survivor.name) == stem(dup.name)` (names equal once legal-form words and punctuation are removed);
- **and** either `form_class(survivor) == form_class(dup)` (Limited ≡ Ltd, Corporation ≡ Corp, Incorporated ≡ Inc, Company ≡ Co, P.L.C. ≡ plc …), **or** one side carries no legal form at all (a truncated issuer name) and the countries are equal or one is NULL.

Every other pair goes to the **I-1 review list**. The runner never merges it without a Data-Identity signature file.

**Result on the 1,878:** 9 pairs on the review list (`i1-review.json` `77568000…f13`).

**3 rejects** (different companies; never merged by 013; DQ tickets in November):

| Survivor | Duplicate | Why |
|---|---|---|
| 110851 FUJI CORPORATION LIMITED (JP) | 111491 FUJI CORPORATION (JP) | two different Tokyo-listed companies; also the M-6 chain |
| 110460 Nice Corporation (JP) | 95732 Nice Ltd (IL) | different companies and countries; 95732 carries 1 instrument link |
| 111751 ALPHA Corporation (JP) | 96097 Alpha Group (CN) | different companies and countries |

**6 sign-eligible** (same entity on the evidence; merged on Thu 5 **only if** the Data-Identity Lead signs them at the plan review; else November):
- 26150 Rezolve AI Limited ← 230822 Rezolve AI plc (re-registration);
- 27008 JDE Peet's B.V. ← 226582 JDE Peet's NV (conversion);
- 27067 Ferrovial N.V. ← 227046 Ferrovial SE (conversion);
- 27580 Charter Hall Limited ← 223774 Charter Hall Group (stapled group);
- 29350 AXIA ENERGIA S.A. (BR) ← 229248 Axia Energia (US, the ADR listing);
- 107305 Taiwan Speciality Chemicals Corporation ← 92126 … Co (1 instrument link).

**Three-way identity** (for November): all 100 twins match a legal, other or transliterated GC name of their holder's LEI in the pinned GC. 0 mismatches.

### 5.3 Seed re-creation (Arch M-5, N-2): measured, not left to the dry run

**Two-way (1,868 incl. the 6):** with the live seed's `normalizeName` (`entities-seed.js` at `a3e3f1f`), for **every** pair, `normalizeName(dup.name)`, `normalizeName(survivor.name)` and the key step 5 writes (the duplicate's stored key) are **equal: 1,868 / 1,868, 0 mismatches** (`n2check.mjs`).
- After the merge, the seed's `INSERT … ON CONFLICT(normalized_name, type)` lands on the survivor for either source name.
- **No two-way twin is re-created.** The runner repeats this as a plan-time assertion (N-2).

**Three-way and OTP (101 rows):** **all 101 twin names are present in complete holdings snapshots** (`idx_holdings_security_name` probe, 101 / 101).
- The survivor keeps the LEI holder's own key (often a native-script name), so the **Mon 9 seed would re-insert one twin per case: 51 new no-LEI rows**, which re-opens KI 22.41 for exactly these issuers.
- **Rule (Arch M-5 default): held → November** with a seed-side alias fix. Option for that packet: re-key the holder to the twins' corrected key under the same `NOT EXISTS (new_key, type)` guard, or make the seed redirect-aware. **Founder may instead accept a weekly re-creation: not recommended.**
- OTP (`2019` → `467290`) is the same mechanism; its 004 ticket stays open to November.

### 5.4 Filings/13F references (Arch M-3, ETF MF-1)

- **The issue:** 013 never writes these tables (§3). The 7 two-way duplicates in §4.2 (363, 555, 599, 637, 641, 1182, 3474) are the only ones referenced. Merging them now would leave 847 rows pointing at deleted ids, and the survivors' issuer panels would lose ownership, events and financials (they read `WHERE entity_id = ?` without R3).
- **Rule: a merge is held if its duplicate has any row in the four tables at plan time.** The plan re-runs the four indexed probes on its duplicate set: ≈ 6k reads, inside the §8 read plan.
- **Thu 5:** 7 held, so **0 Filings/13F references on any merged id**.
- **November (R-F, §16):** the owning lanes repoint the 847 rows by `entity_id` (indexed) and the facts by `cik`, ≈ 1,109 writes, CAS on `entity_id = :dup`. Then 013 merges these 7, plus Old Republic with the three-way set.

### 5.5 Plan-time inputs (re-dated to Thu 5)

1. **Re-derive the pair set** with the current `normalizeName` from a keyset export of `entity_master` taken Thu 5 ≥ 18:15Z.
   - The export **adds the `cik` column**: 0 extra reads, same pages. It is needed for the fill-only rule (§6.2) and the "cik held elsewhere" check, because `entity_master.cik` has no index.
   - Only rows in the measured set **whose state still matches** are merged. New pairs are listed for November.
2. Read `do_not_merge` from Ops (`ops_data_quality_ticket`, `ticket_type='entity_merge'`, `disposition='do_not_merge'`, status not `open`), ≤ 10 reads; drop any merge touching them (H-2).
3. **A2 wrote nothing** (G-2 FAIL, deferred in full, 30 Oct; ML-1030-2). There are no A2 LEIs and no E-X2 withholds. See §13 for the A2 gate.

## 6. Merge statements and order

### 6.1 Migration (CR1)
`App/Corporate Atlas/migrations/ma-oct-013-entity-merge-redirect.sql` (unchanged):
```sql
CREATE TABLE IF NOT EXISTS entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,  -- rowid alias, no separate index (L11-14)
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT    NOT NULL,     -- ISO-8601 UTC: the run token (§6.2)
  packet       TEXT    NOT NULL      -- 'MA-OCT-013'
);
```
No `survivor_id` index (L13-5).

### 6.2 Per merge: one D1 batch, all-or-nothing (Arch M-2, Ops M-4)

**Why it is all-or-nothing:**
- A D1 batch is one transaction, so nothing interleaves inside it. A CAS miss is not an error, though, so rev 1 makes **step 1 the only place a merge can miss**, and makes every later statement depend on step 1's row.
- **Step 1, the merge token.** It inserts the redirect row only if the merge predicate **P** holds in full:
  ```sql
  INSERT INTO entity_merge_redirect (duplicate_id, survivor_id, merged_at, packet)
  SELECT :dup, :surv, :tok, 'MA-OCT-013'
  WHERE  -- duplicate exactly as pre-imaged
        EXISTS (SELECT 1 FROM entity_master WHERE entity_id = :dup AND lei IS NULL AND type = :type
                  AND name = :dup_name AND normalized_name = :dup_key AND cik IS :dup_cik AND updated_at IS :dup_upd)
         -- survivor exactly as pre-imaged
    AND EXISTS (SELECT 1 FROM entity_master WHERE entity_id = :surv AND type = :type
                  AND normalized_name = :surv_key AND lei IS :surv_lei AND cik IS :surv_cik AND updated_at IS :surv_upd)
         -- the duplicate's child set is exactly the planned one (no unplanned reference)
    AND (SELECT COUNT(*) FROM instrument_entity_map WHERE entity_id = :dup) = :n_iem          -- idx_iem_entity_key
    AND EXISTS (SELECT 1 FROM entity_enrichment_queue WHERE entity_id = :dup AND status = :q_status)   -- PK
    AND NOT EXISTS (SELECT 1 FROM entity_relationships WHERE child_entity_id = :dup)          -- idx_entity_rel_child
    AND NOT EXISTS (SELECT 1 FROM entity_relationships WHERE parent_entity_id = :dup)         -- idx_entity_rel_parent
    AND NOT EXISTS (SELECT 1 FROM entity_isin_map WHERE entity_id = :dup)                     -- idx_entity_isin_map_entity
    AND NOT EXISTS (SELECT 1 FROM entity_exposure_monthly WHERE entity_id = :dup)             -- idx_exposure_entity
    AND NOT EXISTS (SELECT 1 FROM entity_exposure_monthly WHERE holder_entity_id = :dup)      -- idx_exposure_holder
    AND NOT EXISTS (SELECT 1 FROM bond_issuer_link WHERE entity_id = :dup)                    -- idx_bil_entity
    AND NOT EXISTS (SELECT 1 FROM managerissuerpositionquarterly WHERE entity_id = :dup)      -- idx_mqp_entity_id
    AND NOT EXISTS (SELECT 1 FROM issuereventstream WHERE entity_id = :dup)                   -- idx_ies_entity_id
    AND NOT EXISTS (SELECT 1 FROM issuerperiodsummary WHERE entity_id = :dup)                 -- idx_ips_entity_id
         -- disjointness and W1-A for this merge
    AND NOT EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id IN (:dup, :surv))
    AND NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = :dup_key AND type = :type AND entity_id NOT IN (:dup)) ;
  ```
  - `fund_entity_link` (no `entity_id` index) and `financialfact_reported` (by `cik`) are checked **once per batch** instead of per statement: §6.3.
  - **`INSERT`, not `INSERT OR IGNORE`.** The plan asserts no pre-existing redirect, so a PK conflict raises and aborts the whole batch transaction: fail closed.
- **Steps 2–6.** Every statement carries `AND EXISTS (SELECT 1 FROM entity_merge_redirect WHERE duplicate_id = :dup AND merged_at = :tok)` (written **T** below), plus its own pre-image CAS:
  2. **Repoints** (`instrument_entity_map`, the planned keys only): `UPDATE instrument_entity_map SET entity_id = :surv WHERE instrument_key = ? AND entity_id = :dup AND T`.
  3. **Queue delete:** `DELETE FROM entity_enrichment_queue WHERE entity_id = :dup AND status = :q_status AND T`.
  4. **Duplicate delete,** with the dangling-reference guard (Ops M-4), defense in depth after step 1:
     ```sql
     DELETE FROM entity_master WHERE entity_id = :dup AND lei IS NULL AND normalized_name = :dup_key AND T
       AND NOT EXISTS (SELECT 1 FROM instrument_entity_map WHERE entity_id = :dup)
       AND NOT EXISTS (SELECT 1 FROM entity_enrichment_queue WHERE entity_id = :dup)
       AND <the same nine NOT EXISTS probes as step 1>;
     ```
  5. **Survivor key (B13-1):** `UPDATE entity_master SET normalized_name = :dup_key WHERE entity_id = :surv AND normalized_name = :surv_key AND T AND NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = :dup_key AND type = :type)`. This can pass only after step 4.
  6. **F, fill-only carry-over (Arch M-4):** `UPDATE entity_master SET cik = :dup_cik WHERE entity_id = :surv AND cik IS NULL AND T`, **only** when `:dup_cik` is non-NULL **and** the plan-time export shows no other row holding that CIK. It never overwrites, and it is restored from the pre-image.
- **Step 7, (iii) LEI** (3 survivors; after their merge's batch). This applies the 011 hand-off Level 1 + Level 2 payload, 011 provenance (`gleif_enrichment_version = 11`, `match_source = 'gc_name_t1'`):
  ```sql
  UPDATE entity_master SET lei = :lei, <payload columns> WHERE entity_id = :surv AND lei IS NULL
     AND normalized_name = :post_key AND EXISTS (SELECT 1 FROM entity_merge_redirect WHERE survivor_id = :surv AND packet = 'MA-OCT-013')
     AND NOT EXISTS (SELECT 1 FROM entity_master WHERE lei = :lei);       -- W1-A (Arch M-2), idx_entity_master_lei
  ```
  - **Freshness check first:** ≤ 3 GLEIF `lei-records` calls (rev 0's ≤ 10).
  - **Verified 4 Nov:** all 3 LEIs are ACTIVE/ISSUED in the pinned GC and held by no row.
  - **Identity:** checked against A2's new "former-name" class (G-2 row 73). Cementir and Campari match the GC **legal** name; Time Interconnect matches its GC English other name (an HK-listed company, parent Luxshare), not a former name. All 3 are sound.

**Read-back classes:**
- `merged`: redirect row + duplicate gone + survivor re-keyed.
- **`raced`**: no redirect row, nothing changed.
- **Anything else is a breach and stops the run (§9):** a redirect with a live duplicate, or a duplicate gone without a redirect.

### 6.3 Per-batch probes (once per batch, before execute)

- **`fund_entity_link`:** `SELECT entity_id FROM fund_entity_link WHERE entity_id IN (<batch dups>)`. This is the declared 264-row scan, ≈ 38 × 264 ≈ 10k reads in all.
  - **Any row → that merge is dropped from the batch and referred to ETF-PL** (ETF MF-2: stop-and-refer, never an auto-repoint). Rev 0's §7 row 2 auto-repoint is **removed**.
- **`financialfact_reported`:** by each batch duplicate's non-NULL `cik` on `idx_financialfact_cik_tag`, `LIMIT 1` with `entity_id = :dup`. Any row → merge held (§5.4).
- **After each batch:** the full Entities reference probes on its ids (Ops N-3; ≈ 1–2 reads per probe).

### 6.4 Table allow-list (ETF MF-2; refused at plan **and** at execute)

The runner renders and sends statements only against these tables:
- `entity_merge_redirect`, `entity_master`, `entity_enrichment_queue`, `instrument_entity_map`;
- read-only in guards: `entity_relationships`, `entity_isin_map`, `entity_exposure_monthly`, `bond_issuer_link`, `fund_entity_link`, `managerissuerpositionquarterly`, `issuereventstream`, `issuerperiodsummary`, `financialfact_reported`;
- plus Ops heartbeats via `meridian-ops` ingest, never SQL.

**Write targets are only the first four.** Any statement whose write target is outside them, any ETF table in any role, or a 13F/Filings table as a write target → plan refused, or `exec_refused` and stop.

### 6.5 Order on Thu 5
1. Migration.
2. **Pilot:** batch 1 = 50 two-way merges → read-back → §10 reference probes on the 50 (Ops N-3) → Data-Identity 20-row spot check (E-4 style).
3. Remaining two-way batches.
4. The (iii) LEIs.
5. Verification (§10) and recon.

## 7. Child tables

| # | Table | Rule (rev 1) | Thu 5 rows | Writes |
|---|---|---|---|---|
| 1 | `entity_relationships` | guard only: any edge on a duplicate → step-1 miss (`raced`, listed). No repoint in Thu 5 (measured 0). | 0 | 0 |
| 2 | `fund_entity_link` | **stop-and-refer** (§6.3, ETF MF-2) | 0 | 0 |
| 3 | `instrument_entity_map` | `UPDATE … WHERE instrument_key = ? AND entity_id = :dup AND T` (PK `instrument_key`) | **62** | **124** |
| 4 | `entity_isin_map` | guard only | 0 | 0 |
| 5 | `entity_exposure_monthly` (both columns) | guard only. The B13-2 fold rule is kept for November; any row → step-1 miss today | 0 | 0 |
| 6 | `entity_enrichment_queue` | delete (step 3) | 1,862 | in §8 |
| 7 | `bond_issuer_link` | guard only | 0 | 0 |
| 8 | `managerissuerpositionquarterly`, `issuereventstream`, `issuerperiodsummary` | **guard only; never written** (§5.4) | 0 on merged ids | 0 |
| 9 | `financialfact_reported` | **guard only (by `cik`); never written** | 0 on merged ids | 0 |
| — | `bond_issuance`, 004 tickets and members, 003 M1 keys | never rewritten; read through the redirect | — | — |

## 8. Write and read budget (measured; 006 counting basis)

| Step | Rows | Writes/row | Writes (default) | With the 6 signed |
|---|---|---|---|---|
| Migration (1 table, no index) | — | — | 3 | 3 |
| Two-way: duplicate delete (1 + 9 idx) + queue delete (2) + survivor key (1 + `idx_entity_master_normalized` + autoindex) | 1,862 | 15 | 27,930 | 28,020 |
| Redirect inserts (rowid table) | 1,862 | 1 | 1,862 | 1,868 |
| `instrument_entity_map` repoints | 62 | 2 | 124 | 126 |
| `cik` fill-only (`cik` unindexed) | 2 | 1 | 2 | 2 |
| (iii) LEIs (as 011 A, incl. Level 2) | 3 | ≈ 6.3 | 19 | 19 |
| Heartbeats (38 batches × 2 events × ≈ 6) | 76 | ≈ 6 | 456 | 456 |
| **013 total (Thu 5)** | | | **≈ 30,396** | **≈ 30,494** |
| Ops registry row (Ops M-1; Ops domain, counts to the account) | 1 | ≈ 3 | 3 | 3 |

**Against the caps:**
- **013 cap 33k:** margin ≈ 2.5k (8%). The 1.3× stop applies per batch.
- **Account ≤ 70k:** RUN precondition `d1-today + 1.05 × 30.4k ≤ 70k`, i.e. **`d1-today` ≤ 38.0k at 18:15Z**.
  - Thursday has no seed. The other writers are enrich (06:00/06:50), boost (11:50, 17:50) and the 002b deploy (08:05–17:30), so the Thursday baseline is far below that.
  - The gate fails closed anyway.

**November (for scheduling, not Thu 5):**
- three-way + OTP: ≈ 1,212 + 101 redirects + 6 repoints;
- the 7 Filings-held two-way: ≈ 112 + R-F 1,109;
- the 6 unsigned I-1: ≈ 98;
- optional remainder: ≈ 8.8k;
- (v) cross-pair: ≈ 150.

**Read budget (Thu 5):**

| Item | Reads |
|---|---|
| Plan-time keyset export of `entity_master` (≤ 5k per page) | ≈ 45k |
| Plan-time Filings/13F probes (§5.4) + `do_not_merge` | ≈ 6k |
| Per-merge step-1 predicate (≈ 14 indexed probes) + pre-images | ≈ 40k |
| Per-batch `fund_entity_link` (38 × 264) + facts by cik | ≈ 10k |
| Post-batch reference probes + post-run re-export and verification | ≈ 55k |
| **Total** | **≈ 156k** (3.1% of 5M; every execution ≤ 45k) |

## 9. Batching, control surface and run gates

**Runner and entry script (A2 pattern; Ops M-2).** Built by MA-OCT-013.BUILD.
- **Runner:** `App/Corporate Atlas/scripts/merge-013.mjs`. It reuses the 011 libraries (headroom gate, outbox, run log, `FREEZES.json` check, CAS, pre-image and restore).
- **Pure core:** `lib/merge-013-core.mjs` (plan assertions, I-1, statement renderer, allow-list, restore renderer).
- **Single entry point:** `scripts/merge-013.sh`. Every command **sources `~/MeridianAtlas-work/merge-013/013.env`** and prints `WORK_DIR=… JOB_ID=…` as its first line.
  - **Commands:** `init`, `plan`, `run`, `pause`, `resume`, `stop`, `status`, `readback`, `restore --batch <id>`, `recon`.
  - `init` writes `013.env` with mode 600 (work dir 700). It holds no secret and never overwrites a differing file.
  - **It refuses:** a missing or invalid env; a work dir pointing at `gleif-011` or `gleif-a2`; `JOB_ID` other than `manual.entity-merge-013`.
- **Own work dir:** `~/MeridianAtlas-work/merge-013/` (700), holding `plan/`, `checkpoints/`, `preimages/`, `readbacks/`, `recon/`, `runner.pid`, `remainder.json`, the manifest.
- **Own flags:** `App/Corporate Atlas/.merge-013-paused` and `.merge-013-stop` (gitignored). Never the 011/A2 flags.
- **Kill switch:** `stop` SIGTERMs the pid in `runner.pid` (own pid only). It finishes the in-flight batch statement set, checkpoints, and exits `killed`. A test proves this reaches the 013 runner.

**Batches:** ≤ 50 merges (≤ ≈ 50 × 7 statements + guards), ≤ ≈ 820 writes declared, with a checkpoint per batch. 1,862 merges → **38 batches**.

**Gates before every batch** (fail closed):
- **Index preconditions (hard stop, before any write):** `idx_iem_entity_key`, `idx_bil_entity`, `idx_entity_isin_map_entity`, `idx_exposure_entity`, `idx_exposure_holder`, `idx_entity_rel_child`, `idx_entity_rel_parent`, `idx_mqp_entity_id`, `idx_ies_entity_id`, `idx_ips_entity_id`, `idx_financialfact_cik_tag`, `idx_entity_master_lei`, `idx_entity_master_normalized`. Matched by name and column list in `sqlite_master`.
- **Kill switch:** pause and stop flags; `hold_all_jobs` at start.
- **Headroom:** `d1-today` with a 2 s ceiling and 1 retry; fresh ≤ 120 s and today's UTC date; F-1..F-5. Otherwise `headroom_unavailable`, no batch, cursor unchanged.
- **Budget:** 013 day total + batch ≤ **33,000**, **and** account + batch ≤ **70,000** (Thu 5 only, Founder ML-1104-2 / ML-1029-4 basis). Any other day: ≤ 25k and ≤ 60k unless the Founder re-approves.
- **Calendar:**
  - Bands, from the **live** `FREEZES.json`, read and hashed at plan time: 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10.
  - Plus the runner's own **21:58–22:02** sweep slot (Ops N-1, Arch N-5).
  - No Sunday. Nothing before 08:00 on Monday.
  - **No batch starts after 23:15Z,** and production stops by **23:30Z** (ML-1104-2).
- **Observability:** heartbeats via the `merge-013` emitter (Ops M-1, §15 step R1). Without them, the R-4 run-log reconciliation is signed by the Operations Lead (011 R-4; OPS-R11: never `--outbox-live-confirmed`).
- **Change freezes for the run window:** `meridian-ops`, `OPS_INGEST_KEYS` and the Entities Workers. **One production change at a time across lanes:** 013 starts only after MA-OCT-002b.DEPLOY has reported closed.
- **Other Entities writers during the run (Ops M-3):**
  - **Boost:** pause flag + `ops_job_pause` row for `local.entities-enrich-boost`, **Thu 5 ≥ the 17:50 run's `end` event → Fri 6 00:10Z** (resume Fri ≥ 07:15Z).
  - **Enrich crons:** next fire Fri 06:00, after the run; no action.
  - **Seed:** Mon only; no action. FIRDS (Sun) and delta (no cron): nothing.
  - **Main Lane:** adds the dated FREEZES window "013 run — other Entities writers frozen", **Thu 5 18:00Z → Fri 6 00:10Z**.

**Runtime second guard (L11-13):** stop and re-plan if, at plan time:
- R > 5,000;
- R differs from the measured 62 (Thu 5 set) by > 20%;
- repoint writes would exceed 10,000.

**Stop conditions:**
- any read-back class other than `merged` or `raced` (§6.2);
- `raced` above 0.5% of a batch;
- writes > 1.3× declared;
- a redirect invariant breach (§10);
- any `do_not_merge` or I-1-rejected id in a batch;
- an allow-list refusal;
- an index precondition missing;
- the E-4-style Data-Identity spot-check failure on the pilot.

**Remainder rule (Task step 3; ML-1104-2):**
- **Stop at a batch boundary,** never mid-batch, when the next batch would breach 33k or 70k, when the clock is ≥ 23:15Z for a new start, or on any stop condition.
- **The un-run whole batches** (plan order), their ids and the plan SHA go to `~/MeridianAtlas-work/merge-013/remainder.json` with a SHA-256.
- **The remainder is November item #1:**
  - it resumes on the **next eligible weekday, Fri 6 ≥ 08:05Z** (never Sunday; Mon only after 08:00), under a **new Control**;
  - it uses a **fresh plan-time re-check** (re-export; the pre-image CAS re-validates every row);
  - caps are 25k / 60k unless the Founder re-approves.
- **No write after 23:30Z Thu 5.**

## 10. Read-back and verification

**Per batch:**
1. Pre-image all touched rows (duplicate and survivor `entity_master`, queue rows, instrument rows) to `preimages/preimage-<batch>.jsonl`, with its SHA in the checkpoint.
2. Execute.
3. Read back and classify (§6.2).
4. Run the post-batch reference probes (§6.3).

**After the run** (local, from the re-export, plus indexed probes):

| Check | Expected (Thu 5) |
|---|---|
| `COUNT(*) FROM entity_merge_redirect WHERE packet='MA-OCT-013'` | = duplicates deleted (1,862 or 1,868, less `raced`) |
| every `survivor_id` exists; no `duplicate_id` exists in `entity_master`; no `survivor_id` is a `duplicate_id` | 0 violations (single hop) |
| rows referencing a `duplicate_id` in tables 1–9 of §7 (indexed probes; `fund_entity_link` by its 264-row pass; facts by `cik`) | **0** |
| `entity_master` rows | before − merged (± same-day drift traced to non-013 writers) |
| LEI-bearing rows | before + 3 |
| survivors whose key = `normalizeName(name)` and = the duplicate's former key | all merged survivors (seed dry-run proof: 0 inserts) |
| `do_not_merge` pairs, 103540, the 3 I-1 rejects, all held ids | untouched |
| sample of 200 merges (or all, if fewer) | the redirect resolves through 007 R3 to the survivor |
| ETF post-run spot check (ETF N-6, by ETF-PL) | `/api/etf-overlap`, `/api/etf-exposure` on 3 ETFs; entity icon on 3 ISINs. Equal to the pre-run baseline except timestamps |

## 11. Rollback (Arch M-1, B13-4) and restore calendar (Ops M-6)

**Per merge, in this order** (the reverse of §6.2, so `UNIQUE(normalized_name, type)` never collides):
1. **Restore the survivor's old key:** `UPDATE entity_master SET normalized_name = :surv_key WHERE entity_id = :surv AND normalized_name = :dup_key`.
2. **Re-insert the duplicate** with its explicit `entity_id` and every column from the pre-image.
3. **Restore** its queue row, the repointed `instrument_entity_map` rows (`SET entity_id = :dup WHERE instrument_key = ? AND entity_id = :surv`), and the carried-over `cik` (`SET cik = NULL WHERE entity_id = :surv AND cik = :dup_cik`).
4. **Clear the (iii) LEI** by CAS (every payload column back to its pre-image; `AND lei = :lei`).
5. **Delete the redirect row** (`WHERE duplicate_id = :dup AND packet = 'MA-OCT-013' AND merged_at = :tok`).

**Proof:** the BUILD replica dry run must show merge → restore as a **byte-identical** round trip for every shape the renderer supports: two-way on Thu 5, and three-way/OTP for November.

**Cost:**
- **Per batch:** ≈ 820 writes; restores run same-day inside the 70k gate (at most ≈ 3 batches after a full run).
- **Full Thu 5 rollback:** 1,862 × 16 + 124 + 2 + 19 ≈ **29.9k**.

**Calendar:**
- **Per-batch restore:** same day.
- **Full rollback:** a Founder + Operations Lead decision. **Earliest Fri 6 ≥ 08:05Z**, ≤ 25k a day, so **2 run days** (Fri 6 + Mon 9 ≥ 08:05Z; never Sun).
- **CAS misses** on restore (rows changed by enrich from Fri 06:00, or the seed on Mon 9) are listed, not forced.

**Manifest and retention:**
- The manifest lists per batch: plan SHA, pre-image SHA, checkpoint, redirect ids, token.
- **Retention:** `merge-013/` rollback inputs ≥ 30 days after 013 closes, independent of `gleif_006.db`.

**Migration rollback (Ops N-7):** drop `entity_merge_redirect` only when 0 rows have `packet='MA-OCT-013'`. 007 and 004 tolerate its absence.

**Horizon:**
- 011's rollback ends at **013's first write** (AR11-1).
- A2 has no rollback to protect (it wrote nothing, §13).

## 12. ETF-exposure impact (for the ETF Product Lead)

- **No exposure number changes on Thu 5.** 0 `entity_exposure_monthly` and 0 `fund_entity_link` rows reference any candidate, and `fund_exposure_coverage` is untouched.
- **62 instrument links move** from a duplicate to its survivor (74 measured, minus 12 on held merges).
- **When gate3 picks them up (ETF N-1):** gate3 writes `INSERT OR IGNORE` on `(report_month, entity_id, holder_entity_id)` and never clears a month. Re-running an **existing** month will not raise a survivor's `weight_sum` for a holder it already has; **only new `(survivor, holder)` pairs and future months** pick up the 62 links. Nothing is lost, because the duplicates carry 0 exposure rows.
- **13F route (ETF N-3):** `worker-13f.js` returns `iem.entity_id` live, so it returns the survivor id for the 62 from Thu 5. Old ids resolve through R3. This is not a regression.
- **No ETF table is read or written** in statements. `fund_entity_link` is read only for the stop-and-refer probe.

## 13. Interaction with A2 and 011 (Arch M-7)

**A2:**
- **A2 wrote 0 rows.** G-2 FAIL (30 Oct) deferred A2 in full to November (Founder Q3; FREEZES note ML-1030-2). There is no A2 work dir, checkpoint or hold.
- **The partial-A2 gate becomes:** the run sheet records "A2 not started, 0 writes" (evidence: FRI30.DIL report, FREEZES note) before 013's first write.
- **Ops N-6:** the November A2 re-plan **must** start from a post-013 export, because step 5 changes survivors' `normalized_name` and A2's CAS pins it. The same holds for A2's new former-name rule (G-2 row 73).

**011:** the rollback horizon ends at 013's first write (§11).

## 14. Acceptance criteria

- [ ] CR1 approved (new table `entity_merge_redirect`, migration path). Runner built (MA-OCT-013.BUILD). Architect delta check PASS (MA-OCT-013.CHECK) by 17:00Z Thu 5.
- [ ] **Tests for every MUST-FIX pass and fail on today's tree** (build list §17). **Replica dry run:** counts within 2% of §8 (1,862 merges; ≈ 30.4k writes); byte-identical restore round trip; allow-list fails closed on an ETF-table statement; `do_not_merge` and I-1-rejected ids refused; `headroom_unavailable` fails closed.
- [ ] Plan from the Thu 5 export:
  - candidate set ⊆ the measured set;
  - M-6 disjointness 0;
  - I-1 applied, with signatures recorded or the 6 held;
  - N-2 key equality 1,862 / 1,862;
  - Filings/13F probe 0 on merged ids;
  - R within 20% of 62.
- [ ] Pilot: read-back all `merged`/`raced`; reference probes 0; Data-Identity 20-row spot check pass.
- [ ] §10 checks pass. 0 dangling references in every table. Redirect count = deletes.
- [ ] Writes ≤ 33k (013) and account ≤ 70k. No write in a band, on Sunday, after 23:30Z, or during another lane's production change.
- [ ] Every batch has a pre-image, checkpoint and heartbeat (or a reconciled run log, signed by the Operations Lead by Fri 6 09:00Z).
- [ ] November lists delivered with SHA-256s (§16). The remainder file is delivered if one exists.

## 15. Timeline and run sheet outline (Thu 5; exact commands in the BUILD run sheet)

| UTC | Step |
|---|---|
| Wed 4 eve | This rev 1 and the measurement |
| Thu 5 by 15:00 | BUILD report (runner, tests, replica dry run, run sheet) |
| Thu 5 by 17:00 | Architect delta check PASS. Founder run approval on the RUN board row |
| Thu 5 ≥ 002b close | MA-OCT-002b.DEPLOY closed (one change at a time) |
| **≥ 18:15** | **R0** pre-flight (OPS-R12: `wrangler whoami` 4.96.0 by path, wait ≥ 30 s, `SELECT 1`). Record `d1-today` (≤ 38.0k) and the boost 17:50 `end` event. Record "A2 not started" |
| | **R1** (Ops M-1, authorised by Ops): registry row `manual.entity-merge-013` (domain Entities, owner Data-Identity Lead, mode `manual`, emitter `merge-013`, `expected_max_duration_s = 900` per batch). Key K-1..K-4: new 32-byte key, mode 600 in `merge-013/`, never printed; K-3 list before = the current emitters, after = that + `merge-013`. Its own step, no other `meridian-ops` change open. **If R1 cannot complete by 18:45, skip it and run with R-4 reconciliation** |
| | **R2** boost pause (flag + `ops_job_pause` row, to Fri 6 00:10Z) |
| | **R3** `merge-013.sh plan`: export, assertions, I-1 list → Data-Identity plan review (sign the 6 or hold them) |
| | **R4** migration (≈ 3 writes; `IF NOT EXISTS`) |
| | **R5** pilot batch 1 → read-back → probes → Data-Identity 20-row spot check |
| | **R6** batches 2..38 (skip 21:58–22:02; no start after 23:15) |
| | **R7** (iii) LEIs (≤ 3 GLEIF calls first) |
| by 23:30 | **R8** last write. Verification reads and the R-4 recon export follow (reads only) |
| Fri 6 ≥ 07:15 | Boost resume. Ops signs R-4 by 09:00Z. ETF-PL post-run spot check. Remainder (if any) = November item #1 from 08:05Z under a new Control |

**Data-Identity availability (Ops N-9):** book the Data-Identity Lead for R3 (plan review) and R5 (spot check), Thu 5 ≈ 18:15–19:30Z.

## 16. November lists (delivered by RUN; SHAs in its report)

| List | Rows | Next step |
|---|---|---|
| Three-way cases | 50 / 100 rows | seed-alias fix first (§5.3), then merge |
| OTP pair | 1 | with three-way; 004 ticket open |
| I-1 rejects | 3 pairs | DQ tickets (different companies); **`normalizeName` over-stripping** fix (cross-company key collisions, e.g. `NICE`, `FUJI`, `ALPHA`) |
| I-1 sign-eligible, unsigned | ≤ 6 | Data-Identity signature, then merge |
| Filings/13F-referenced | 7 two-way (+ Old Republic three-way) | **R-F**: owning lanes repoint 847 rows (≈ 1,109 writes), then merge |
| Optional D5-1 remainder | 643 (incl. 103540, 2 `government` rows) | Data-Identity adjudication (Q2) |
| (v) cross-pair LEIs | 6 LEIs / 19 rows | Data-Identity adjudication (Q3) |
| New pairs found at plan time | — | November |
| Pre-existing: facts on deleted entity 2298 (Travelers cik `0000086312`); Xerox survivors sharing cik `0001770450` | — | Filings owner / DQ |
| Remainder of the Thu 5 run (if any) | — | November item #1, Fri 6 ≥ 08:05Z |

## 17. Build list (for MA-OCT-013.BUILD, Thu 5)

**Files** (explicit-path commit; nothing else):

| Path | New/mod | Content |
|---|---|---|
| `App/Corporate Atlas/migrations/ma-oct-013-entity-merge-redirect.sql` | new | §6.1 |
| `App/Corporate Atlas/lib/merge-013-core.mjs` | new | pure functions: plan assertions (M-6, N-2, R guard, Filings hold, fel refer), I-1 (§5.2), statement renderer (§6.2 with token **T** and predicate **P**), allow-list (§6.4), restore renderer (§11 order), budget/remainder calculator |
| `App/Corporate Atlas/scripts/merge-013.mjs` | new | runner: plan, run, readback, restore, recon; 011 core reuse (headroom, outbox, calendar incl. 21:58–22:02 and 23:15/23:30, FREEZES live hash, checkpoints) |
| `App/Corporate Atlas/scripts/merge-013.sh` | new, +x | entry script: sources `~/MeridianAtlas-work/merge-013/013.env`; init/pause/resume/stop/status/restore; prints WORK_DIR/JOB_ID first; refuses 011/A2 dirs |
| `App/Corporate Atlas/tests/merge-013.test.mjs` | new | the tests below |
| `App/Corporate Atlas/.gitignore` | mod | `.merge-013-paused`, `.merge-013-stop` |
| `claude/packets/MA-OCT-013.BUILD_RunSheet.md` | new | §15 with exact commands, kill switch, per-batch restore |

**Tests. Each must fail on today's tree:** `a3e3f1f`, plus only the new pure lib dropped in where the test targets runner wiring, as in A2.BUILD §3.

| # | MUST-FIX | Test |
|---|---|---|
| T-1 | Arch M-1 | merge → restore round trip, byte-identical, on a node:sqlite replica: two-way (+ three-way and OTP renderer shapes); the reverse order is asserted (key restore before re-insert) |
| T-2 | Arch M-2 | duplicate or survivor changed after pre-image → step 1 inserts no token → **0 changes** across all statements; class `raced` |
| T-3 | Ops M-4 | an unplanned child row (iem, edge, isin, exposure, bil, or a 13F/Filings row) → step-1 miss, 0 changes; delete guard refuses with token present (defense test) |
| T-4 | Arch M-2 | (iii) LEI already held elsewhere (W1-A) → no write; `lei IS NULL` CAS |
| T-5 | Arch M-4 | `cik` fill-only never overwrites; skipped when another row holds the cik; restore sets it back to NULL |
| T-6 | (rev 1 I-1) | FUJI / Nice / ALPHA refused; the 6 need a signature file (refused without, merged with); a plain pair passes |
| T-7 | Arch M-6 | survivor ∩ duplicate, an existing redirect, or a holder that is a candidate → plan refused |
| T-8 | ETF MF-2 | a statement aimed at an ETF table or a 13F/Filings write → refused at plan and at execute; `fund_entity_link` row on a duplicate → merge dropped and listed for ETF-PL |
| T-9 | Arch M-3 / ETF MF-1 | a Filings/13F row on a duplicate → merge held |
| T-10 | Ops M-5, Task step 3 | budget gate 33k / 70k; batch-boundary stop; no start ≥ 23:15Z; 21:58–22:02 refused; FREEZES bands; Sunday refused; Monday < 08:00 refused; `remainder.json` written with SHA |
| T-11 | Ops M-2 | own flags only; `stop` SIGTERMs own pid (dummy process); `status` prints WORK_DIR/JOB_ID first; refuses a 011/A2 work dir and a wrong JOB_ID; `init` 600/700, never overwrites |
| T-12 | (Task BUILD) | missing `idx_iem_entity_key` or `idx_bil_entity` (or any §9 index) → exit before any write |
| T-13 | Arch M-5, N-2 | seed dry run on the replica with the live `normalizeName`: 0 inserts for two-way survivors; three-way/OTP re-insert shown (documents the hold) |
| T-14 | Arch N-1 | redirects single-hop; 007 R3 (`NAV_MAX_HOPS = 3`) resolves a merged id |
| T-15 | Ops M-1 | heartbeat job id `manual.entity-merge-013`, emitter `merge-013`, 900 s per batch; refused without the key → falls back to R-4 run log |
| T-16 | Ops M-3 | runner refuses to start while the boost pause row is absent or the boost 17:50 run has no `end` event |

**Replica dry run** (no D1 writes): a local SQLite replica built from a fresh read-only keyset export (≈ 45k reads, Thu 5, outside bands) plus the measured child rows. Plan and execute all 38 batches. Counts within 2% of §8. Restore all and prove byte-identical.

## 18. Changes in rev 1

### MUST-FIX (all 15 folded)

| Item | Finding | Where fixed |
|---|---|---|
| **Arch M-1** | rollback order breaks B13-4 | §11: key restore → re-insert → children/cik → LEI → redirect; T-1 byte-identical round trip |
| **Arch M-2** | per-merge all-or-nothing; W1-A on the (iii) LEI | §6.2: step-1 token with full predicate P; every later statement gated on T; `INSERT` (not OR IGNORE); (iii) W1-A `NOT EXISTS (lei)`; T-2, T-4 |
| **Arch M-3** | four Filings/13F tables unmeasured | §4.2 measured (847 rows on 8 duplicates; index per table; 1,109-write repoint); §5.4 hold rule; §7 rows 8–9; §12; T-9 |
| **Arch M-4** | column values lost on delete | §4.2 measured (only `cik`, 16; 2 on Thu 5); §6.2 step F fill-only with "held elsewhere" check; §11 restore; T-5 |
| **Arch M-5** | seed re-creation for three-way/OTP | §5.3 measured: two-way 1,868/1,868 safe; three-way/OTP 101/101 would re-create → held to November; T-13 |
| **Arch M-6** | plan-time disjointness; 3-hop text | §5.1: asserted at plan time; found 1 chain (111491), resolved by I-1; "≤ 5 hops" → 3; T-7, T-14 |
| **Arch M-7** | partial-A2 gate | §13: A2 wrote 0 rows; run sheet records it; post-013 re-plan rule |
| **Ops M-1** | no Ops identity | §9 / §15 R1: registry row, emitter key K-1..K-4, 900 s per batch, own step; R-4 fallback; T-15 |
| **Ops M-2** | kill switch unnamed | §9: own work dir, flags, `013.env` + `merge-013.sh`; stop by own pid; T-11 |
| **Ops M-3** | boost runs during the run; no FREEZES window | §9: boost pause row + flag for the run window, resume Fri ≥ 07:15; Main Lane FREEZES window Thu 5 18:00 → Fri 6 00:10; T-16 |
| **Ops M-4** | dangling reference on a CAS miss | §6.2: step-1 child-set predicate + step-4 `NOT EXISTS` guard; any non-`merged`/`raced` class stops; T-3 |
| **Ops M-5** | thin margin, no remainder rule, ordering | §8 (30.4k / 33k; d1-today ≤ 38.0k); §9 remainder rule (batch boundary, `remainder.json`, Fri 6 ≥ 08:05 as November #1, never Sun); after 002b closes; T-10 |
| **Ops M-6** | restore calendar | §11: per-batch same day; full ≈ 29.9k earliest Fri 6, 2 days ≤ 25k; misses listed; ≥ 30-day retention |
| **ETF MF-1** | Filings/13F copies unmeasured | = Arch M-3 (§4.2, §5.4); §14 wording "0 dangling references in every table" now true by the hold rule |
| **ETF MF-2** | ETF-table claims not enforced | §6.4 allow-list (plan and execute); §6.3 `fund_entity_link` stop-and-refer (rev 0 §7 row 2 auto-repoint removed); T-8 |

### NOTES

| Note | Disposition |
|---|---|
| Arch N-1 (3 hops) | Accepted: §5.1 |
| Arch N-2 (plan-time key assertion) | Accepted and measured: §5.3; T-13 |
| Arch N-3 (re-measure R_collide) | Accepted: exposure probes in step 1 (0 today) |
| Arch N-4 (full rollback day) | Accepted: §11 (earliest Fri 6) |
| Arch N-5 (22:00 slot wording) | Accepted: §9 21:58–22:02 |
| Arch N-6 (Control boilerplate) | Noted, no change |
| Ops N-1 | Accepted: §9 |
| Ops N-2 (R-4 recon) | Accepted: §14, §15 (signed by Fri 6 09:00Z) |
| Ops N-3 (pilot probes) | Accepted: §6.5, §10 |
| Ops N-4 (reads) | Accepted: §8 (≈ 156k) |
| Ops N-5 (OPS-R12 pre-flight) | Accepted: §15 R0 |
| Ops N-6 (A2 re-plan post-013) | Accepted: §13 |
| Ops N-7 (migration step / rollback) | Accepted: §11 |
| Ops N-8 (change freeze) | Accepted: §9 |
| Ops N-9 (Data-Identity slot) | Accepted: §15 |
| Ops N-10 (heartbeats in cap) | Accepted: §8 |
| ETF N-1 (gate3 timing) | Accepted: §12 |
| ETF N-2 (fold → list keys) | Accepted for November (fold not reachable on Thu 5) |
| ETF N-3 (13F route) | Accepted: §12 |
| ETF N-4 (hop text) | Accepted: §5.1 |
| ETF N-5 (current FREEZES; A2 dates) | Accepted: §9 (live read + hash), §13 |
| ETF N-6 (ETF spot check) | Accepted: §10 |

### Other changes
- **New I-1 identity guard** (§5.2) and the 3 + 6 lists.
- **Thu 5 scope reduced from 1,979 to 1,862 (1,868):** three-way/OTP held (§5.3); Filings-referenced held (§5.4).
- **Run day moved** from Mon 2 (rev 0) to **Thu 5 ≥ 18:15Z**: ML-1104-2, the Founder's later decision. It supersedes the SPEC1 Task's "Fri 6 after 08:05Z" (L13-7). Fri 6 ≥ 08:05Z is the remainder day.
- The rev 0 §16 Founder questions are decided (ML-1029-4) and removed. Two new Founder questions are in the SPEC1 report.

## Appendix A — Measurement evidence

**Rev 0** (`~/MeridianAtlas-work/ma-oct-013/`): as rev 0 Appendix A (`ledger.jsonl` `6b9ed205174a8a3ac625bc99d38cacbe3e2bb0b5480aa77052737066efee6654`, `ids.json` `d21a12d2a16a262a67eb4594a502f4195ae7e9f171c5fb83055d4116d29a9078`).

**Rev 1** (`~/MeridianAtlas-work/ma-oct-013/spec1/`):

| File | SHA-256 | Content |
|---|---|---|
| `core.json` | `c7ff6ac2c29d408e7cf417b9487142ea14dcbc503bd128a3eac85f8efdbe23f3` | the 1,979 core merges (from `ids.json`) |
| `em-live.json` | `72bdb01e04eb26e20ad949e79079fcddc71206a62e498a1bd3b7fef5579bfd00` | live `entity_master` rows, 3,907 ids |
| `m2.json` | `c08e185bcfb6bc1627766940e9c00e7bfc012d47772a276183b16a3eb05dbad1` | 13F / events / summary by `entity_id` |
| `m3.json` | `ff585380c09382e0bba277ce5113463c7bcaf98395d736dfc91dae5e7d823bca` | facts by `cik` (17 ciks) |
| `m-arch-m3.json` | `3bae0bae33dbf830238360b13ec9a403b0ecee2b221afd6313ba6f009f664a51` | Arch M-3 per-table per-duplicate counts |
| `m4.json` | `12e7d0658cb2447e11309a406568ac16c99b6c483a66e801227b235bf9e6bf6c` | iem + queue re-measure |
| `m5-seed-names.json` | `0670e0a6189533ceb30f06590759f57e4a1c76b65bced5955829b7b2fd6508c8` | three-way/OTP names in holdings |
| `i1-review.json` | `77568000e470b69f9f9d5ee2cafb67fde0ed693a76ff7418e3cf5f1673268f13` | the 9 I-1 review pairs |
| `plan-rev1.json` | `0c444d0ddd68e20724f800cfce8c4139c2bb58dafd1002b80e82d4bf59a1db58` | Thu 5 default set, sign-eligible, held lists |
| `identity_guard.py` | `9ce6b4a039bfae27f64ef81c4e833307ad5f6421836ae71fe1a977904f0fc644` | I-1 rule |
| `n2check.mjs` | `0d76e166bb36f3aefd3a160f7e17ebe18f2ed68e1259959cfeccded8640016fe` | §5.3 key-equality proof |
| `plan_rev1.py` | `f5e9fcf8aac0681e3ca90f3080b420335422845cd0ce52b01e855341607658c0` | §8 budget |
| `d1r.sh` | `b9197edefdbd74c215650604c3d91587397f00920b13b76fbe2f7d87e0536389` | guarded read-only helper |
| `ledger.jsonl` | `7553276da99e57780de0df851207b03e90f7336f2d7eba3d7c3d99b69b84d5bf` | every execution (103), reads and writes |

## Appendix B — Lane rulings

| # | Ruling |
|---|---|
| L13-1..L13-6 | as rev 0 |
| L13-7 | Run day: the Task says Fri 6 ≥ 08:05Z; the Founder's later ML-1104-2 sets Thu 5 ≥ 18:15Z (stop 23:30Z, remainder → first November item), and the issued RUN packet follows it. Rev 1 plans Thu 5 and makes Fri 6 ≥ 08:05Z the remainder day. Caps are as the Task (33k / 70k). |
| L13-8 | Arch M-3 vs ETF MF-1 on indexes: the live catalog shows `entity_id` indexes on 3 of the 4 tables; only `financialfact_reported` lacks one (probed by `cik`). |
| L13-9 | Three-way/OTP and the Filings-referenced merges are **held**, not merged with accepted staleness. Both defaults come from the reviews (Arch M-5, M-3b) in the absence of an agreed fix by Thu 5. The Founder may override either (SPEC1 report questions). |
| L13-10 | I-1 rejects are excluded on identity evidence (different companies or countries). The 6 sign-eligible pairs need the Data-Identity Lead, because this lane wrote the guard. |
