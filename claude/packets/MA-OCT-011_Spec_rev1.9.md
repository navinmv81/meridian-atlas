# MA-OCT-011 — Offline GLEIF Reconciliation: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (packet owner; wrote this spec) — build executor: Engineering Lead
REVIEWED BY:  Architect + Operations Lead (Thu 8 – Fri 9 Oct)
APPROVED BY:  Founder — GO / NO-GO / DEFER and spec approval at the Mon 12 Oct gate
PACKET:       MA-OCT-011 — offline GLEIF reconciliation (conditional)
GATE:         Spec approval (12 Oct). Approving this spec lane is NOT a GO.
```

**Status:** **rev 1.9** (Fri 9 Oct 2026). Re-synced to **006 FINAL** (commit `16918e0`) and to the Operations Lead's binding close-out conditions N-2, N-3, N-4 and N-6 (006 Ops Review `8ac07234…763e`).

- **Change in rev 1.9:** wording only, no numbers changed. Writes in the Architect Review `d097e6f9…7679` (PASS WITH NOTES): **AR11-1** rollback valid only until 013 starts (§10); **AR11-2 + RA-12 + RA-14** merged with Ops R-1 into one E-4 rule: A pilot = first A batch Wed 21 with a 50-row adjudication; on any wrong T1 match A stops, the batch is restored, and A resumes only on a bounded excludable cause plus a fresh 50/50 adjudication, else A defers to after 013 (§3.1, §4.4, §9, §11); **RA-13** K-1 to K-5 for the new `OPS_INGEST_KEYS` emitter (§7, §11); the runner honours `claude/relays/FREEZES.json` (boost band 10:45–11:15 / 16:45–17:15 UTC) (§4.4). Stale text tidied (Architect N11-2). Rev 1.8 = `096f857d…b270`.
- **Change in rev 1.8:** wording only, no numbers changed. Writes in the Operations Lead's 011 spec review (Ops Review `976f0837…28f9`, OPS-R7, PASS WITH NOTES): **R-1** E-4 timing (§3.1, §4.4, §9, §11); **R-2** retention of rollback inputs independent of `gleif_006.db` (§7, §10, §11); **R-3** full write payload for the 9 deferred LEIs / 22 rows in the 013 hand-off file (§11); **R-4** daily reconciliation mechanics (§7, §11); notes **N-1** (Ops authorises, LANE-1-ENG executes), **N-2** (`expected_max_duration_s` per batch, 900 s), **N-3** (change freeze 17–23 Oct, §8), **N-4** (full rollback ≈ 4 run days, 26–29 Oct, §10). Rev 1.7 = `30462894…cadf0`.
- **Change in rev 1.7:** wording only, no numbers changed. Writes in the Operations Lead's 8 Oct rulings: **OPS-R2** (E-A kept, with conditions E-1 to E-5; §3.0, §3.1, §9, §11) and **OPS-R3** (the 120 s fetch-age bound accepted, with conditions F-1 to F-5 and the A4 lag gate before the 17 Oct pilot; §4.3, §11). Re-cites 002 **rev 1.3** (`9ec6773a…3893`) in place of rev 1.2, and adds the Ops registry row for `manual.gleif-reconcile-011` (002 rev 1.3 §19.5 R-5; §11). Source: `claude/relays/LANE-1-OPS_REPORT.md` (`e3917e76…5fea`). Rev 1.6 = `6f9681ab…4513c`.
- **Change in rev 1.6:** two corrections from 002 rev 1.2 (`98c0ef37…dbf2`) §6.3, §8.5 and §8.6. (1) A paused boost sends nothing; the paused week is marked by an `ops_job_pause` row, so the slots show `paused`, never `missed` (§8, §11). (2) The runner **fails closed** when `d1-today` headroom is unavailable, with the new outcome `headroom_unavailable` (§4.3, §7, §9, §11). No numbers changed. Rev 1.5 = `ae441749…0e4a91`.
- **Change in rev 1.5:** 006 FINAL deltas (D7-1 government rows, KI 22.43 = 657, criterion 2 drain figures). Live drain of Bucket B (§4.2c): the expected plan falls to ≈ 86.5k, with 89,153 kept as the no-drain ceiling case. New §3.0 tier basis (N-2). N-4 budget and observability mapping, plus the outbox gate (§4.3, §7, §8, §11). N-6 retention (§12). Numbers register marked FINAL (§15). New rulings L11-15 and L11-16; L11-13 amended (N-7). Rev 1.2 = `4549209c…afeee`.
- **Change in rev 1.2 (Sun 4 Oct):** §12 lists 013's prerequisites (Main Lane rulings A and B, Decisions Log 2026-10-04). Appendix A adds Q71–Q75 (013 sizing) and Appendix B adds L11-13 and L11-14. **No 011 numbers changed** (rev 1.1 = `0cb22279…b761`).
- **Change in rev 1.1:** records two Decisions Log rulings of 3 Oct. The Main Lane accepted L11-8 as a recorded deviation from the brief, and the Founder fixed the 013 survivor rule (S1). Q3 is narrowed to ordering. No numbers changed (rev 1 = `b183caca…10ec`).

- **Final hashes:** reported for the 12 Oct gate in `claude/relays/LANE-11_REPORT.md`. Every 006-sourced number is **FINAL** (§15).
- **Baseline:** rev 0 = `76ee07ec…9b72`. The "changed since rev 0" list is in §16.

**Brief:** `claude/MA-OCT-011_Spec_Brief.md`, SHA-256 `cc161312…ad4a` (verified). Where the brief and this spec conflict, the brief wins.

**Governing:** Addendum `d816aa2b…bc46` (wins over the Kit), Kit v2 `46629dc5…0795`, Scope v2 `967bebd7…3445`, Decisions Log (2026-09-30 R9; 2026-10-01 011/013 rows).

**006 inputs: FINAL, committed `16918e0`, read-only, re-hashed on Thu 8 Oct before reading:**

| File | SHA-256 |
|---|---|
| Spec | `1dab3539…b7273` |
| Remediation Matrix | `db594224…f33b5a` |
| Close-out Summary | `f54ae3bf…637537` (Final) |
| Evidence | `0d1bbf9b…ddb1bc` (rulings through D7-5; §16 final re-sync) |
| Classification | `cb3b3a84…13df64` (day-7 re-sync) |
| Ops Review | `8ac07234…2c763e` (PASS WITH NOTES; N-1…N-7) |
| Query Ledger | `c0fce75b…07dd` |

The superseded draft inputs cited by rev 1–1.2 (Matrix `ce93f54f…`, Evidence `208044a6…`, classification `f364449c…`) are kept in §16 for traceability.

**Lane record:**

- no code, no D1 queries, no GLEIF calls;
- no git writes (`git --no-optional-locks` only; no `.git/*.lock`; HEAD `16918e0` on `October-2026` at rev 1.5);
- local read-only SQLite only, logged in Appendix A.

---

## 1. Problem statement

006 has shown that the live GLEIF path cannot close the identity gap (Close-out §1):

- The 26,083 `name_search` queue rows have no consumer (H1).
- Phase 1 is blocked by a fixed head of 100 rows (H2).
- Phase 2 is dead (H3).
- Phase 3 drains the 7,436-entity placeholder pool at 44 per successful run. That was **about 67 a day on 1–5 Oct**, which leaves **6,912 undrained on 5 Oct, about 103 days at that rate** (Close-out §1). It mostly writes a generic `NO_LINK_DECLARED` marker that discards GLEIF's real reason (H6). **657** of those markers are wrong (KI 22.43, after D7-2).

The Golden Copy publication already on disk answers most of these gaps offline:

- **3,717 reliable T1 LEIs**, with precision 150/150 and a one-sided 95% lower bound of 98.02% (Evidence §15.2);
- the whole placeholder pool;
- **1,529 parent gaps** that RR can fill;
- GLEIF's real exception reason for about 15.8k entities.

The freshness check against the live API was 50/50.

## 2. Goals (006 FINAL; 29 Sep export basis)

1. **Bucket A (Level 1 LEIs).** Attach a T1 LEI to **3,677 entities**, one row per LEI and duplicate-aware (L11-7). LEI fill goes from 16,627 to about 20,304 (37.8% → about 46.1% of D2). 40 more LEIs go to 013 or manual review.
2. **Bucket B (placeholders).** Hydrate every pool row still undrained when the plan is generated: a ceiling of **7,436**, expected **≈ 6,112** (§4.2c). Also hydrate the **859** RC-15 names, with GLEIF's real exception reason or real parent. Rows that live Phase 3 drains first get their real reason through C-reasons. Target: the Phase 3 pool is ≤ 10 rows.
3. **Bucket C (markers and parents).**
   - Fill **1,529** parent gaps (728 direct + 801 ultimate, 812 entities).
   - Write the real RX reason on **8,345** outside-pool entities.
   - `NO_LINK_DECLARED` count: 9,142 → **152** (128 with no GLEIF reason, plus 24 wrong-LEI rows that are excluded).
4. **Parent graph.** Add **1,027 direct `legal_parent` edges** (728 C + 299 A) and **365** parent rows. Zero H7-style overwrites.
5. **Bucket D (duplicates).** Create no new duplicate state, and use only the S1-survivor side of any KI 22.41 pair (§3.4).
6. **Write budget.** About **86.5k** writes expected (89.2k in the no-drain case; hard ceiling 110k), ≤ 25k per day (Ops N-4 limit: 40k). Every batch is resumable and reversible from pre-images.

## 3. Rules per bucket (brief item 1)

**Evidence source:** `gleif_006.db`, built from the Golden Copy (GC) publication of **2026-09-28 16:00 UTC** (006 Evidence §3–4), subject to Q2 (§14).

**Never written by 011, in any bucket:**

- `normalized_name` and `type` (L11-4; key migration belongs to 013);
- an existing non-NULL `lei`;
- a non-placeholder `name` (one not equal to its own LEI);
- a non-NULL `country`;
- KI 22.9's 4 edges;
- **the 24 wrong-LEI rows** (D6-4, RC-12), in any field (L11-12);
- any ETF, 13F or Ops table. Ops is reached only through the ingest API.

**Provenance, on every touched row:**

- `gleif_enrichment_version = 11` (not indexed);
- `gleif_last_updated = <run ts>`;
- `lei_validation_source = 'GC-20260928-1600'`;
- `match_source = 'gc_name_t1'`, on Bucket A only.

**`lei_status` (L11-5):** written as GC `EntityStatus` (ACTIVE/INACTIVE), the same as live Phase 3. The 2,946 rows that hold a registration-status value in `lei_status`, and the 2 literal `'NULL'` strings (RC-19), are **not** touched.

### 3.0 Tier basis (Ops N-2, binding)

Ops N-2 lets 011 size and write **only from 006's high-confidence tiers**: T1 4,109 rows / 3,717 LEIs, RR parents 1,529, and hydration (Ops Review N-2; Close-out §3, "High confidence" column). Each write line is mapped to its tier below. The classification checks (Q76–Q92) run against `MA-OCT-006_classification.csv` `cb3b3a84…13df64`.

| Line | 011 writes | 006 tier (confidence) | Source |
|---|---|---|---|
| **A** (LEI + Level 1) | 3,677 rows | T1, ISSUED/PENDING, government excluded (D6-1/D7-1): **high**. Precision 150/150, lower bound 98.02%. | Close-out §3 row 1 (4,109 / 3,717). Matrix rank 2 (RC-1) and rank 6 (RC-3). Classification `lei` (d) high = 4,109, identical to 011's T1 base (Q76–Q77). All 3,677 A rows are `lei` (d) high (Q79). |
| **Q** (queue `complete`) | 3,677 | Follows A, same rows: **high** | Matrix rank 2 cost note (queue `status='complete'`); rank 16 RC-6 ("bucket A marks its own rows `complete`") |
| **A Level 2** (mirrors or reasons, inside the A UPDATE) | parents: direct 514, ultimate 556; reasons: direct 3,163, ultimate 3,121 | **Composite of two high sources:** T1 (high) × RR/RX (high; RR 100% fresh). It is not its own 006 row, because A entities had no LEI in D2, so 006 classified no parent gap for them (Q91 = 0). | **L11-16.** Required: without it, live Phase 3 re-selects every A row (§3.1). Confirmed by the Operations Lead (OPS-R1 / OPS-R2, 8 Oct). |
| **E-A** (direct edges for A children) | 299 | The same composite | **L11-16.** **Kept, per Ops OPS-R2 (8 Oct), under conditions E-1 to E-5 (§3.1).** The drop path stays open for the Founder at the 12 Oct gate: dropping saves 1,196 writes, and the edges then wait for the live-path fix packet. |
| **B** (pool hydration) | ceiling 7,436; expected ≈ 6,112 (§4.2c) | Placeholder hydration: **high** | Close-out §3 row 3; Matrix rank 1 (RC-4). Classification `name` (d) high = 7,426, all pool rows (Q80). Every B reason write is on a (b) **high** gap: 14,713 / 14,713 (Q88). |
| **RC-15** | 859 | **High** | Close-out §3 row 3 ("+ 859 RC-15 names"); Matrix rank 5; Q81 (859 high) |
| **C fields** | 812 entities / 1,529 gaps | RR parents: **high** | Close-out §3 row 4; Matrix rank 3 and Option 2. Q82: direct 657 (c) + 71 (d), ultimate 727 (c) + 74 (d), all high. |
| **P** (parent rows) | 365 | The RR parent LEI plus that parent's GC Level 1: **high** (part of C) | Matrix rank 3 cost note (365 parent entities); `cost_model.json` |
| **E-C** (direct edges) | 728 | RR direct: **high** | Matrix rank 3 and Option 2 (728 edges) |
| **C-reasons** | 8,345 entities / 16,596 field writes | RX reasons on (b) gaps: **high** | Close-out §3 row 5 (15,858 entities); Matrix (b) row. Q87: **all 16,596 field writes sit on (b) high gaps.** |

**Never written by 011. These go to the manual-review lists (§11), or to a later packet with its own sample adjudication (N-2):**

| Tier | Size |
|---|---|
| T1_LAPSED (D5-4) | 1,342 |
| T1+ / T1c (N+ key) | 1,739 |
| Duplicate via the N+ key | 852 |
| D5-3: no RR and no RX → (b) medium | 33 entities outside the pool (Q90) |
| D7-2: parent rows of the 4 wrong-LEI entities → (b) medium | 8 rows |
| **D7-1: all 9 automated government LEI rows** (6 T1, plus 96163 T1_LAPSED, 103384 T1+, 103395 T1+), now `RC-A2` manual review | 9 (Q78: none is in A or B) |
| Review tiers (T2/T3, ambiguous) | 2,336 |
| Script gap, (a) medium | 3,011 |

**L11-8 against N-2:** 006's own high tier is "T1, **ISSUED/PENDING**" (Close-out §3 row 1; Matrix rank 2). So PENDING_TRANSFER (1 row) is inside the high tier, and L11-8 is consistent with N-2.

### 3.1 Bucket A: Level 1 LEI matching (no-LEI entities)

| | Rule |
|---|---|
| **Base** | 006 T1, **after D6-1** (government excluded and routed to manual review): **4,109 rows / 3,717 LEIs**. That is GC status ISSUED or PENDING_TRANSFER (L11-8: a **recorded deviation from the brief's "ISSUED"**, accepted by the Main Lane, Decisions Log 3 Oct; 1 row; matches 006. DUPLICATE excluded per D4-1), unique exact name match, and country agrees. |
| **One row per LEI (L11-7, replaces L11-3)** | Write the LEI onto exactly one row: **(i)** the only matching row, if it is in no KI 22.41 pair → 3,285; **(ii)** the pair's **older (drift) row, the survivor under S1 as fixed by the Founder on 3 Oct** (Decisions Log), when the match lands on it → 44 single + 348 shared = 392. Withheld: **(iii)** a match only on a pair's newer side → 3 LEIs, sent to 013; **(iv)** an LEI shared by rows in no pair → 31 LEIs / 62 rows, manual review; **(v)** an LEI spread over more than one pair, or over a pair plus an outside row → 6 LEIs / 19 rows, sent to 013. |
| **Count** | **3,677 rows = 3,677 LEIs**, FINAL: re-checked on 006 FINAL, unchanged (Q45 re-run, Q77, Q79). Deferred: 40 LEIs. 3,677 + 40 = 3,717 ✓. **D7-1:** the 3 extra government rows (96163, 103384, 103395) are medium-tier and were never in A, and the 6 T1 government rows were already out under D6-1 (Q78). |
| **Fields written** | Level 1: `lei`, `lei_status`, `entity_status`, `lei_registration_status`, `legal_name`, `legal_jurisdiction`, `legal_address_country`, `hq_country`, `legal_form_code`, `entity_category`, `lei_last_updated`, `lei_next_renewal`, plus provenance. **Level 2, in the same UPDATE** (see the next row): the RR parent mirror (direct 514, ultimate 556) or the RX reason (direct 3,163, ultimate 3,121). |
| **Why Level 2 goes in the same UPDATE** | 0 A rows have neither RR nor RX for the direct parent (Q53), so every A row leaves the Phase 3 predicate when written. Without this, live Phase 3 would re-select all 3,677 rows and stamp the generic marker on them. 006's A cost omits this step. |
| **Edges** | A direct `legal_parent` edges **only where the parent row exists after step P** (D2, A or C-created): **299** (Q52). The other 215 are listed and deferred (L11-10). No new parent rows are created for A. |
| **E-A conditions (Ops OPS-R2, binding while E-A is kept)** | **E-1.** Resolve each parent by LEI only (exact match on `entity_master.lei`). Exclude parents on the newer side of a KI 22.41 pair, the 24 wrong-LEI entities (RC-12, D6-4/D6-5), the 9 D7-1 government rows, and any parent LEI held by more than one row. Exclusions are listed, not written; the 215 deferred edges stay deferred (L11-10). **E-2.** No E-A edge without its A write: if an A row's CAS misses or the row is withheld (L11-7 cases iii–v), its edge is not written. **E-3.** At least 25 of the 299 E-A edges are in the post-run sampled diff (§9), each matching the child's RR `IS_DIRECTLY_CONSOLIDATED_BY` parent in `gleif_006.db`, at 100%. **E-4 (one rule: Ops R-1 + Architect Review `d097e6f9…7679`, AR11-2, RA-12, RA-14).** *Triggers:* (a) at the Fri 16 Oct freshness gate, **≥ 15 of the ≤ 50 GLEIF calls are A rows**; any A identity mismatch (LEI not matching the entity's legal name or country) is a trigger evaluated **before any A or E-A write**; (b) **the A pilot is the first A batch on Wed 21 Oct (≤ 250 rows), followed by a hold**: before the next A batch, **≥ 50 rows of that batch are adjudicated** as correct identity matches (the GC record against the entity's own evidence: name, country, any CIK or instrument links) by the Data-Identity Lead, with an Operations Lead spot-check (the executor does not adjudicate its own run); required **50/50** (RA-14); (c) **≥ 10 of the 25 post-run API spot checks are A rows**. The §9 sampled diff against `gleif_006.db` proves execution only; it is not an identity trigger. *Response to any wrong T1 match (RA-12):* **A stops**, not only E-A. The batch holding the wrong match is restored from its pre-image, with its E-A edges and queue rows. A resumes only if the cause is a bounded pattern that can be excluded from the remaining A plan (re-hashed plan, re-reviewed SHA) **and** a fresh 50-row adjudication of the remaining plan is 50/50. Otherwise A defers to after 013 (the Founder's partial-GO path), and B + C stand. Whenever A stops, E-A is dropped for the rest of the run and E-A edges already written are deleted. *Sequencing:* the E-A batch runs only after **every A batch's read-back diff has passed**, the A-pilot adjudication is 50/50, and no trigger is open (Ops R-1 (b)). **E-5.** No ultimate edges: E-A stays direct-only (L11-9). |
| **Queue** | All 3,677 rows have a queue row (Q70). It is set to `status='complete', last_attempt=<ts>` with a CAS on `status IN ('pending','failed')`. |
| **Twin** | The newer twin of a pair is left untouched and goes to the 013 hand-off file (348 + 44 rows), with its queue row as it is. |

### 3.2 Bucket B: placeholder hydration

| | Rule |
|---|---|
| **Selection** | The live Phase 3 predicate, exactly, evaluated **on the fresh export at plan time** (§4.2c). **Ceiling 7,436** (29 Sep export; Q05; 0 wrong-LEI rows, Q46; none of the 9 D7-1 government rows, Q78). **Expected at run time ≈ 6,112.** Rows drained by live Phase 3 before the export move to C-reasons. B runs in **descending LEI order** (L11-15), so it meets Phase 3's ascending head only at the end. **Plus RC-15:** 859 pre-MA-SEP-014 placeholders whose `name` still equals their LEI but whose `lei_status` is already set (Matrix rank 5; **in scope, L11-11**). |
| **Fields** | `name` = GC legal name, **only where `name = lei`**. `lei_status`, `entity_status`, `lei_registration_status`, `legal_name`, `legal_jurisdiction`, `legal_address_country`, `country = COALESCE(country, GC)` (7,426 are NULL). Level 2 per §3.3. Provenance. RC-15 rows get `name` and `legal_name` only. 830 of them are merged into their C-reasons UPDATE and 1 into its C parent UPDATE; 29 stand alone (Q64). |
| **Level 2 outcome (pool)** | Direct: RX 7,358 / RR 71 / neither 7. Ultimate: RX 7,355 / RR 74 / neither 7 (Q11–Q12). |
| **Never** | `normalized_name` (L11-4: −2 index writes per row against 006's costing; §4.2b). |

### 3.3 Bucket C: Level 2 parents and reasons (LEI-bearing rows; adopts 006's basis)

**Parent fields:** **812 entities, 1,529 gaps** (728 direct + 801 ultimate), after D6-5 removes 4 wrong-LEI entities (Q47 reproduces the Matrix §2 figures exactly).

- 74 of the 812 are pool rows (merged into the B UPDATE). 738 are outside the pool: 657 direct (KI 22.43), 727 ultimate.
- Writes: `direct_parent_lei/name` from ACTIVE `IS_DIRECTLY_CONSOLIDATED_BY` (and `direct_parent_exception = NULL`), and `ultimate_parent_lei/name` from ACTIVE `IS_ULTIMATELY_CONSOLIDATED_BY`.
- **0 contradicted parents** (006 §14.3). A contradicted parent would stop the run and never be overwritten.

**Parent rows (P):** **365** missing parent LEIs (of 705 distinct; Q48) get a `holding` row by `INSERT OR IGNORE`.

- The row carries the GC legal name, `normalized_name = gc_lei.legal_name_norm` (current-normalizer port; parity 10,250/10,250), Level 1, and its own RR/RX mirrors.
- Collisions with existing holding keys, and among the new parents themselves: 0 (Q31–Q32, rev 0 basis). An ignored insert is checked by LEI. If the LEI is absent, it is logged as `parent_collision` and **no edge** is written. 011 never copies Phase 3's `ON CONFLICT … SET lei` (H7).
- No cascade: grandparents are written as mirrors only.

**Edges (E):** **direct only (L11-9, adopting 006)**. 728 C edges plus 299 A edges, by `INSERT OR IGNORE (parent, child, 'legal_parent', 'gleif')`.

- The ultimate parent lives in the mirror fields.
- Live Phase 3 also writes ultimate edges (13 exist; Q50). 011 does not add or remove any. That inconsistency is noted for the enrich fix packet (§12).
- KI 22.9's 4 edges are excluded and untouched.

**C-reasons:** **8,345** outside-pool entities get the verbatim RX reason in `direct_parent_exception` (8,333) and/or `ultimate_parent_exception` (8,263; 12 are ultimate-only). There is one RX row per (LEI, category) (Q27).

- 92 of these are also C parent rows, so they get one combined UPDATE.
- **Not written:** 20 wrong-LEI rows (D6-4), and **128** entities that GLEIF gives no reason for (124 LAPSED and 4 ISSUED with no RX record; Q62). On 006 FINAL those 128 split into 95 high-tier LAPSED (b) rows and 33 medium D5-3 rows (Q89–Q90). Both groups keep `NO_LINK_DECLARED` and are reported.
- **Rows drained by live Phase 3 before the plan export** (§4.2c) are added to C-reasons: real RX reasons over Phase 3's generic marker, about 2 writes per row.

### 3.4 Bucket D: duplicate-awareness (the KI 22.41 twin rule)

| Case | Count | 011 rule | Twin / follow-up |
|---|---|---|---|
| Both pair rows match the same LEI (one pair) | 348 LEIs / 696 rows | LEI goes on the **older (drift) row** only | Newer twin → 013 hand-off; 013 deletes it (S1) |
| Match only on the older side of a pair | 44 | LEI on the older row | Newer twin → 013 hand-off |
| Match only on the newer side | 3 | **No write** | 013 writes the LEI onto its survivor |
| LEI spread over more than one pair, or a pair plus an outside row | 6 LEIs / 19 rows | **No write** | 013 |
| LEI shared by rows in no 22.41 pair | 31 LEIs / 62 rows | **No write** | Manual review (MA-OCT-004) |
| Row whose twin already holds the LEI | 606 (006 §12.1) | Out of scope | 013 merge |
| C or C-reasons on the LEI-bearing side of a pair | 756 rows (708 ii + 48 iii; 0 in the pool) | Write on the LEI-bearing (older) side only | Matches S1, so nothing is lost when the twin is merged away |
| KI 22.42 escaped names among A targets | 0 (Q28) | No special handling | 013 / enrich fix packet |

**Basis:** the Founder fixed survivor rule **S1** for 013 on 3 Oct (Decisions Log): the older, LEI-bearing row survives the merge. Under L11-7, 011 writes only that side, so 013 never has to move or undo a 011 write. That is what makes running 011 first safe (Q3).

## 4. Write plan (brief item 2)

### 4.1 Steps, tables and statement patterns

| Step | Table | Pattern | Rows |
|---|---|---|---|
| P: parents | `entity_master` | `INSERT OR IGNORE … (type='holding', <Level 1>, <own L2 mirrors>, <provenance>)`, then `SELECT entity_id, lei … WHERE lei IN (…)` | 365 |
| B: pool (+ pool parents) | `entity_master` | content-diff, compare-and-set (CAS) `UPDATE … SET <changed cols> WHERE entity_id=? AND <pre-image predicate>` | 7,436 |
| C: parent fields (outside the pool) | `entity_master` | CAS `UPDATE` (+ RX reason on the other field for 92) | 738 |
| C-reasons | `entity_master` | CAS `UPDATE … WHERE direct_parent_exception IS ?` (pre-image) | 8,253 standalone |
| RC-15 | `entity_master` | CAS `UPDATE name, legal_name WHERE name = lei` | 29 standalone (830 + 1 merged) |
| E-C: edges | `entity_relationships` | `INSERT OR IGNORE … 'legal_parent','gleif'` | 728 |
| A: LEIs (+ L2) | `entity_master` | CAS `UPDATE … WHERE lei IS NULL AND name=? AND normalized_name=?`, plus an "LEI on no other row" pre-check in the same batch | 3,677 |
| E-A: edges | `entity_relationships` | `INSERT OR IGNORE` | 299 |
| Q: queue | `entity_enrichment_queue` | `UPDATE … SET status='complete' WHERE entity_id=? AND status IN ('pending','failed')` | 3,677 |

**Execution:**

- **SET lists:** UPDATEs set only the columns that change, so unchanged indexed columns cost nothing.
- **Batches:** ≤ 250 statements per `db.batch()`-equivalent, run through the `wrangler d1 execute --remote --json --command` shim (precedent: `firds-local-seed.mjs:70-130`).
- **No reliance on atomicity:** every statement is idempotent (CAS or `INSERT OR IGNORE`).
- **Plan file:** the runner executes only a reviewed, SHA-pinned plan file, generated from a fresh keyset export plus `gleif_006.db`.

### 4.2 Write cost (no-drain ceiling case on the 29 Sep export; re-measured by the three-point check, §6)

**Counting basis:** the same as 006 (Matrix header). An UPDATE costs 1 row plus 1 per index whose key changes. An INSERT or DELETE costs 1 plus 1 per index that holds the row. `entity_master` has 9 full indexes plus the partial `phase3` index (live D0 catalog).

| Step | Rows | Writes/row | Writes | Basis |
|---|---|---|---|---|
| P parents (1 + 9 + phase3) | 365 | 11 | 4,015 | Q48 |
| B pool (1 + status + jurisdiction + phase3) | 7,436 | 4 | 29,744 | Q05, Q13 |
| C parent fields: 738 outside the pool (1 + phase3) + direct idx 657 + ultimate idx 727; plus the pool's direct idx 71 + ultimate idx 74 (merged into B) | 812 | ≈ 3.70 | 3,005 | Q47, Q58–Q59 |
| C-reasons standalone (1 + phase3) | 8,253 | 2 | 16,506 | Q56, Q64 |
| RC-15 standalone (`name` is not indexed) | 29 | 1 | 29 | Q57, Q64 |
| E-C direct edges (1 + PK + child + parent) | 728 | 4 | 2,912 | Q49 |
| A (1 + lei + status + match_source + phase3 + jurisdiction) + parent idx (direct 514, ultimate 556) | 3,677 | ≈ 6.29 | 23,132 | Q45, Q51 |
| E-A direct edges | 299 | 4 | 1,196 | Q52 |
| Q queue (1 + status index) | 3,677 | 2 | 7,354 | Q70 |
| Heartbeats (`ops_job_run` start + end × about 105 batches; row + 3 idx + unique + sequence) | 210 | ≈ 6 | 1,260 | 002 migration |
| **Total (no-drain case)** | | | **≈ 89,153** | |
| **Total (expected, after the live drain, §4.2c)** | | | **≈ 86,505** | |
| **Ceiling (plan + 20% measurement margin = 107k)** | | | **110,000** | §5, criterion 4 |

**Measurement risk:** `sqlite_sequence` may add +1 per AUTOINCREMENT insert. That would be +365 on P and is inside the margin.

### 4.2b Reconciliation with 006 Option 1 (Main Lane ask 1)

**006 Option 1:** **100,373** = A 26,019 + B 47,193 (44,616 pool + 2,577 RC-15) + C 10,175 (3,248 fields + 2,912 edges + 4,015 parents) + C-reasons 16,986. Source: **006 FINAL Matrix §2 `db594224…f33b5a`** (these figures are unchanged from the draft `ce93f54f…`) and `WORK/day6/cost_model.json` `a4d8169f…a975`. All on 006's high-confidence basis (D5-6; Ops N-2).

Each line is one difference (rows × writes/row), with the reason.

| # | Item (ask) | 006 | 011 rev 1 | Δ writes | Reason |
|---|---|---|---|---|---|
| a | A rows (a, c) | 3,717 × 7 | 3,677 rows | **−280** (−40 × 7) | Both start from 4,109 / 3,717 after D6-1 (c). 006 writes one row per LEI on an unspecified side. **Rev 1 adopts "one row per LEI", but only on the S1-survivor (older) side (L11-7).** That defers 40 LEIs: 3 matched only on a newer twin → 013; 31 shared by rows in no pair → manual review; 6 spread over pairs → 013. **L11-3 is withdrawn** because it withheld 392 more LEIs that L11-7 can write safely. LEIs deferred to 013: **9** (3 + 6). Twin rows handed to 013: **392**. |
| b | A status (b) | ISSUED + PENDING_TRANSFER | same | **0** | **L11-2 is withdrawn; 011 adopts 006 (L11-8).** PENDING_TRANSFER is an issued LEI moving between LOUs. 1 row (Q41). **Accepted by the Main Lane as a recorded deviation from the brief's "ISSUED"** (Decisions Log, 3 Oct). |
| h | Queue split (h) | inside A (2 of the 7) | Q line 3,677 × 2 | **0** | Presentation only: 006's 7 = 5 + 2 for the queue. |
| a′ | A writes `legal_jurisdiction` | not written | +1 per row | **+3,677** | Same Level 1 field set on A and B (006 writes jurisdiction on B only). |
| a″ | A Level 2 in the same UPDATE | not costed | parent idx 514 + 556 | **+1,070** | Required so A rows leave the Phase 3 predicate (§3.1). Reason fields: `direct_parent_exception` is inside `phase3`, which is already a new entry, and `ultimate_parent_exception` is unindexed, so both cost +0. |
| a‴ | A direct edges (parent exists) | none | 299 × 4 | **+1,196** | Children gained by A get their edge where the parent row exists (L11-10). |
| d | B `normalized_name` (d) | 6 per row | 4 per row | **−14,872** (−2 × 7,436) | **L11-4 stays.** 011 does not touch the key, which removes `idx_normalized` and the `UNIQUE(normalized_name,type)` autoindex from every row. Per-row index delta: 006 = 1 + normalized + autoindex + status + phase3 + jurisdiction = 6. 011 = 1 + status + phase3 + jurisdiction = 4. The LEI-keyed placeholder keys go to 013 / enrich fix (§12). |
| e | RC-15 (e) | 859 × 3 | 29 × 1 | **−2,548** | **In scope (L11-11).** −1,718 from not writing `normalized_name` (859 × 2). −830 because 830 rows share their C-reasons UPDATE, so no second base row (1 shares a C parent UPDATE). |
| f | C parent fields (f) | 812 × 4 | 3,005 | **−243** | −148: the 74 pool rows' base row and phase3 are already paid in B. −95: 006 charges both parent indexes on all 812 (1,624). Actual changes are 728 + 801 = 1,529. |
| f′ | C edges (f) | 728 × 4 | same | **0** | **L11-9: direct only, adopting 006.** Rev 0's 1,598 edges included ultimate edges and A children (§16). |
| f″ | C parent inserts (f) | 365 × 11 | same | **0** | **Adopts 006's basis** (parents of LEI-bearing D2 rows only). Rev 0's 552 included parents of A children and was not reduced by D6-5. |
| g | C-reasons (g, i) | 8,493 × 2 | 8,253 × 2 | **−480** | −40: 20 wrong-LEI rows excluded (D6-4, L11-12). −256: 128 (b) entities with **no RX record** (124 LAPSED, 4 ISSUED; Q62), so there is no reason string to write. −184: 92 overlap with C parent rows (006 charges a base row and phase3 on both lines; Q63). Rev 0's 8,353 was "direct-RX NLD rows", including 20 wrong rows and excluding 12 ultimate-only rows: 8,353 − 20 + 12 = 8,345. |
| i | D6-4 / D6-5 (i) | applied in C fields | applied in every bucket | (in g) | The 4 D6-5 entities are already outside 006's 812. The remaining 20 wrong rows are excluded from C-reasons (line g). 0 wrong rows are in B or A (Q46). |
| h′ | Heartbeats (h) | not costed | 1,260 | **+1,260** | 001 run events, 2 per batch (Ops-domain rows, counted against the shared D1 cap). |
| | **Reconciled total** | **100,373** | **89,153** | **−11,220** | Sum of the lines above: +5,663 (A side) −14,872 −2,548 −243 −480 +1,260 = −11,220. |
| | **Residual unexplained** | | | **0** | |

**Re-checked against 006 FINAL (8 Oct):** every 006 figure in this table is unchanged in Matrix `db594224…`. The reconciliation still closes at **−11,220 with 0 unexplained**. Both sides are on the same 29 Sep export basis. The live-drain adjustment (§4.2c) comes after the reconciliation and can only lower 011's figure.

**Effect on the proposed wording:**

- **Criterion 4** (≤ 95k total, 110k ceiling): **unchanged.** The 89.2k plan + 20% = 107k, inside the 110k ceiling. On 006's own basis, Option 1 (100.4k) would also fit under the ceiling, but not under the 95k planned total. That is one reason rev 1 keeps L11-4.
- **Partial GO** (B + C only, with A after 013): rev 0's "about 63k" → **about 57.1k** (P 4,015 + B 29,744 + C fields 3,005 + C-reasons 16,506 + RC-15 29 + E-C 2,912 + about 876 heartbeats).
  - It fits the **original** 60k total, but needs ≥ 3 days at ≤ 20k a day.
  - Criterion 5 still needs amending, because B writes names and Level 1 fields.
- **Option 2** (C only), for comparison: about 10.0k on 011's basis (P + C fields + E-C + heartbeats) against 006's 10,175.

### 4.2c Live drain of Bucket B (006 FINAL §16.1)

Live Phase 3 keeps draining the pool until 011 runs. Every row it drains gets Phase 3's generic `NO_LINK_DECLARED`, so at plan time that row is a **C-reasons** row (real RX reason, about 2 writes), not a **B** row (about 4 writes).

| Step | Rows | Source |
|---|---|---|
| B ceiling (29 Sep export) | 7,436 | Q05 |
| Drained by 5 Oct 19:45 (head at pool position 524) | −524 | Evidence §16.1 |
| Expected further drain to Sat 17 Oct: about 12 days × about 67 a day | −≈ 800 | Close-out §1 rate; Main Lane estimate |
| **Expected B at run time** | **≈ 6,112** | |
| Sensitivity: cron only (44 a day) / all 4 runs (176 a day) | ≈ 6,384 / ≈ 4,800 | Evidence §16.1 rate table |

**Effect.** D = 7,436 − B at run time (expected about 1,324). Each drained row moves from B (4 writes) to C-reasons (2 writes), so the plan falls by about 2 × D.

| Measure | No-drain case | Expected (D ≈ 1,324) | Range |
|---|---|---|---|
| Plan | 89,153 | **≈ 86,505** | 87,049 (cron only) to 83,881 (all runs) |
| Partial GO | 57,087 | ≈ 54,439 | — |
| Full rollback | ≈ 87.9k | ≈ 85.2k | — |

**The total can only fall.**

- Drained pool rows that had RR parents (≤ 71/74) get their parents from Phase 3 itself. 011's C CAS then lists and skips them, which saves a further ≤ 145 writes, not counted above.
- Drained rows keep the GLEIF name and country that Phase 3 wrote (MA-SEP-014). 011 adds only the real reasons, consistent with C-reasons, and does not refresh their Level 1 fields (out of scope, RC-8).

**Plan file and CAS.**

- The plan file is **regenerated from a fresh keyset export on Fri 16 Oct, after the 06:50 cron** (§4.1, §6 X1). It is never built from the 29 Sep D2. So the B / C-reasons split is set from the live state at that moment.
- Between the export and execution, the 06:50 cron can drain at most 4 × 44 = 176 more rows (17–20 Oct; the boost is paused, §8). Because B runs in descending LEI order (L11-15), those rows are the **last** B batch.
- Their CAS misses. They are **listed, never clobbered**, and upgraded by the follow-up C-reasons CAS on `='NO_LINK_DECLARED'`, at 2 writes each, which lowers the total again.

**Calendar effect:** B finishes on Mon 19 Oct, and C-reasons grows by about 1,324 rows on Tue 20 / Wed 21 (§4.4). There are no extra run days.

### 4.3 Budget against the shared guard

- **The guard:** `DAILY_WRITE_LIMIT = 80,000` (`App/ETF Refresh/src/holdings-pipeline.js:19`, `App/Ops/src/ops-api.js:54`).
- **Other writers:** holdings, Sunday 70,672 (27 Sep); entities-seed, Monday 34,331 (28 Sep); enrich, about 44 rows per Phase 3 run; FIRDS on Sunday; Ops, small. Sources: Job Manifest, Decisions Log, 006 §8.3.
- **No measured weekday total exists** (KI 22.14 / F7, matrix RC-14). So before each batch the runner reads the account `rowsWritten` from `meridian-ops` `GET /api/ops/cf/d1-today` (`ops-api.js:471`), adds its own unpolled rows (counted under F-1 below), and requires the account total + batch ≤ **70,000**.
- **Fail closed when headroom is unavailable** (the same pattern as the boost runner, 002 rev 1.3 (`9ec6773a…3893`) §8.5):
  - **The call:** `d1-today` with a 2 s ceiling and one retry after 2 s.
  - **Freshness limit:** the response must have been fetched **≤ 120 s** before the batch starts, and its `date` must equal the current UTC date. A cached or older figure is never reused.
  - **When it fails:** if the call is still unreachable, is not `ok` (non-200 or `ok:false`), cannot be parsed, or is outside the freshness limit, the runner **runs no batch** and keeps the **cursor unchanged**. It writes run-log outcome **`headroom_unavailable`** and sends a `failed` heartbeat with `error.class='headroom_unavailable'`.
  - **Then it stops** until the **next scheduled batch check** (the next run window, or the operator's next start). There is no retry loop, and it **never assumes headroom**.
- **Conditions on the 120 s bound (Ops OPS-R3, 8 Oct; binding).** The 120 s limit bounds the age of the *fetch*, not the analytics lag. Until 002 A4 measures that lag:
  - **F-1. Own rows counted conservatively.** "Unpolled 011 rows" are every row 011 wrote in the **last 15 minutes or since the previous fetch, whichever window is longer**.
  - **F-2. Monotonic check.** Within one UTC day, if `rowsWritten` is lower than the previous fetch, the reading is treated as stale and the runner **fails closed** (`headroom_unavailable`).
  - **F-3. Midnight guard.** No batch starts between **23:50 and 00:10 UTC** (already outside the §4.4 run windows, which end at 21:00; stated so that operator starts honour it too).
  - **F-4. A4 lag gate.** The `d1-today` analytics lag is measured by 002 A4 at **+1, +5 and +15 minutes** and recorded **before the 17 Oct pilot** (A4 due Wed 14 Oct; 002 rev 1.3 §8.5 and §19.5 R-5). No 011 batch runs until it is recorded.
  - **F-5. Re-rule trigger.** If the measured lag is **over 10 minutes**, the account ceiling drops from 70k to **60k**, and F-1's window becomes the measured lag plus 5 minutes. Ops re-rules; no spec revision is needed. At 10 minutes or less, the rule stands as written plus F-1 to F-3.
- **011's own cap:** ≤ **25,000** a day. On Monday it starts at ≥ 08:00 UTC, and only if the account is ≤ 45,000 at the first check. (5 Oct, Monday: `writes_today` was 33,097; Evidence §16.1.)

**Ops N-4 mapping (binding; Ops sign-off condition):**

| N-4 item | 011 rule | Where |
|---|---|---|
| Multi-day plan of ≤ 40k row-writes a day | **≤ 25k a day by 011** (kept below N-4's 40k), over 5 run days (17–22 Oct) | §4.3, §4.4 |
| No Sunday; Monday only ≥ 08:00 UTC | Never on Sunday or Monday before 08:00 UTC, nor in the enrich windows (05:50–07:10) | §4.4 |
| Mid-loop budget checkpoint | **Before every batch:** account `rowsWritten` (`d1-today`) + unpolled 011 rows + batch ≤ 70k, and 011's day total + batch ≤ 25k. Each invocation is declared; stop at > 1.3× the declared figure. **Fails closed:** if `d1-today` is unavailable, not ok, unparseable or stale (> 120 s, or the wrong UTC date), after 1 retry: no batch, cursor unchanged, `headroom_unavailable`, stop. Own rows counted per F-1; a falling `rowsWritten` fails closed (F-2); no batch 23:50–00:10 UTC (F-3); ceiling 60k if the A4 lag is > 10 min (F-5). | §4.3, §6 (iii), §7 |
| Kill switch checked between batches | Pause flag and stop flag checked **before every batch**; `hold_all_jobs` checked at start | §7 |
| Idempotent, resumable cursor | CAS `UPDATE` / `INSERT OR IGNORE`; checkpoint per batch; resume from the cursor; safe 3× retry | §4.1, §7, §8 |
| Observability: outbox live, **or** own run log reconciled daily | Bulk start (the Sat 17 Oct pilot counts as a start) needs 002's outbox live, otherwise the runner's append-only run log, reconciled by the Operations Lead after each day's batch | §7, §8, §11 |


### 4.4 Calendar (UTC)

**Never:** Sunday, Monday before 08:00, 05:50–07:10 (enrich), or 10:45–11:15 and 16:45–17:15 (boost, which is paused anyway; §8).

**Run windows:** 07:15–10:40, 11:20–16:40, 17:20–21:00.

**Freeze file:** the runner refuses to start a batch inside any window in `claude/relays/FREEZES.json` (Main Lane, 9 Oct, `cdc9606a…c346`). That includes the boost band **10:45–11:15 and 16:45–17:15 UTC** (the same band as above), the UTC-midnight band (F-3), and the daily bootstrap fire buffer **07:55–08:05**, which falls inside the morning run window.

| Day | Steps | 011 writes (+ about 250 heartbeats) |
|---|---|---|
| Sat 17 Oct | **Pilot** (requires the observability gate, §7): P (365) + B first 250 + rollback rehearsal (20 B rows restored, then re-applied) | ≈ 5,200 |
| Sun 18 Oct | — | 0 |
| Mon 19 Oct (≥ 08:00) | B remainder (expected ≈ 5,862 rows; finishes B) | ≈ 23,400 (≤ 25,000 even in the no-drain case: B rows above 6,250 roll to Tue) |
| Tue 20 Oct | C fields (812) + E-C (728) + RC-15 (29) + C-reasons (8,500 of ≈ 9,577) | ≈ 22,950 |
| Wed 21 Oct | C-reasons remainder (≈ 1,077) + A (2,900) | ≈ 20,400 |
| Thu 22 Oct | A remainder (777) + Q (3,677) + E-A (299) + post-run export | ≈ 13,430 |
| Fri 23 Oct | Verification (§9) | 0 |

**A pilot and E-A sequencing (RA-14; Ops R-1 (b)):** Wed 21's first A batch (≤ 250 rows) is the A pilot. A then holds until the 50-row adjudication of that batch is 50/50 (§3.1 E-4). On Thu 22 the E-A batch starts only after the read-back diff of every A batch has passed, the adjudication is 50/50, and no E-4 trigger is open; otherwise E-A is held, not run. A slow adjudication can move A's remainder later in the week; each day stays ≤ 25k.

**Why this order:**

- P first, so that parents exist before any edge.
- B before C, so the pool leaves Phase 3 early.
- A after C, because E-A needs C's created parents.
- Q and E-A last.

## 5. 006 §9.2 gate mapping (brief item 3)

**What the columns hold:**

- **Original wording:** 006 Spec §9.2, `1dab3539…b7273`.
- **006's assessment as written:** 006 FINAL Matrix §3 (`db594224…f33b5a`) and Close-out §5 (`f54ae3bf…637537`).
- **Where 011 stands, and the proposed wording**, for the Founder to accept or reject on 12 Oct. Wording only changes where the wider scope breaks a criterion, or where the evidence has superseded its premise.

| # | Original wording (006 §9.2) | 006 as written (Matrix §3, FINAL) | 011 against it (rev 1.5 onward; 006 FINAL) | Proposed wording | Change? |
|---|---|---|---|---|---|
| 1 | Enough to recover: ≥ 1,000 (c)+(d) parent gaps (direct or ultimate) that RR can fill, or ≥ 10% of LEI-bearing entities, whichever is smaller. | PASS on the (entity, field) gap reading (D6-6). | **Shown both ways (D6-6):** 1,529 gaps (728 + 801) → **PASS**; 812 entities → **FAIL** (< 1,000). **011 relies on the gap reading.** 006 Spec §5.1 defines the unit of classification as the (entity, field) gap, and §9.2 itself says "parent **gaps**". **The Operations Lead supports the gap reading** (Ops Review N-3), and the Founder confirms the unit at the gate. Even on the entity reading, the wider scope passes 1b. | **1a:** the original wording, with "(counted as (entity, field) gaps, the 006 Spec §5.1 unit)" added. **1b (new):** "and Bucket A has ≥ 1,000 T1 **entities** writable one row per LEI on the survivor side, and Bucket B can hydrate ≥ 90% of the placeholder pool from one GC publication." 011: 3,677 / 7,436 (100%). | Clarified (1a), added (1b) |
| 2 | Live path can't clear them: fixing H4/H5 alone would not clear them within 4 weeks at the current cadence (2 cron + 2 boost runs a day × ≤ 45). | PASS (1,384 KI 22.43 rows never re-selected; 6,912 pool rows undrained on 5 Oct). | **Pass (006 FINAL).** Observed drain on 1–5 Oct was **about 67 a day**, so the **6,912** rows undrained on 5 Oct take **about 103 days** (about 39 days even if all 4 daily runs succeed; Evidence §16.1, Close-out §1). Both are far beyond 4 weeks. No live consumer exists for A (H1). | "The live path at its **observed** throughput (006 §12.5), even with H4/H5-class fixes, would not clear the B and C gaps within 4 weeks; **and** no live consumer exists for Bucket A (H1)." | Reworded |
| 3 | Identity is reliable: the W rate among LEI-bearing entities in the sample is ≤ 2%, and H7 overwrites are counted and excluded from the backfill set. | PASS: W 2/164 = 1.2%; H7 0; 24 wrong LEIs excluded; T1 150/150, lower bound 98.02%. | **Pass.** W sample 1.2% (population 24 / 8,342 = 0.29%). H7 overwrites: 0. The 24 are excluded from every 011 write (L11-12). **T1 precision: 150/150 observed (100%). One-sided 95% lower bound 98.02%** (006 Evidence §15.2; D6-3 basis = strict spec T1 tier only, 150 distinct entities). | Unchanged, **plus:** "and, for Bucket A, the **one-sided 95% lower confidence bound** of T1 precision on 006's adjudicated sample (strict spec T1 tier, D6-3) is **≥ 98%**. The test is on the **lower bound, not the observed rate**. (2 Oct: 150/150 observed, lower bound 98.02%.) KI 22.41 / 22.42 rows and the 24 wrong-LEI rows are excluded from writes (§3.4, L11-12)." | Added clause |
| 4 | Write budget: projected writes ≤ 60k in total, with ≤ 20k per day, never on a Sunday or Monday before 08:00 UTC. `db.batch()` with `INSERT OR IGNORE` / content-diff guarded `UPDATE`, resumable by cursor. | **FAIL as worded** (Option 1 ≈ 100.4k). | **Breaks as worded:** ≈ 89.2k (§4.2), reconciled to 006's 100.4k with 0 residual (§4.2b). ≤ 25k per day. | "Projected writes **≤ 95k** in total, with a **hard ceiling of 110k** (re-baselined after the three-point check, never above). **≤ 25k per day by 011**, and each batch only if account `rowsWritten` today + batch ≤ 70k. Never on a Sunday, Monday before 08:00 UTC, or in the enrich windows. `db.batch()`-equivalent batches with `INSERT OR IGNORE` / content-diff **compare-and-set** `UPDATE`, resumable by cursor, every batch reversible from its pre-image. The full rollback cost (≈ 88k; ≈ 85k expected after the drain) is declared up front." | **Amended** |
| 4 (N-4) | Ops N-4 (binding): ≤ 40k row-writes a day; no Sunday or Monday before 08:00 UTC; mid-loop budget checkpoint; kill switch between batches; idempotent resumable cursor; outbox or a daily-reconciled run log. | Ops Review N-4: a condition on either GO. | **Met by design:** ≤ 25k a day (below 40k), with every item mapped in the §4.3 N-4 table. | Add to amended 4: "…and meets Ops N-4: ≤ 40k row-writes a day (011 holds itself to 25k), a per-batch budget checkpoint, a kill switch checked between batches, an idempotent resumable cursor, and observability through 002's outbox or a daily-reconciled run log (§4.3, §7)." | Added |
| 5 | Separation: KI 22.9's 4 edges excluded and routed to 003/004. The writer touches only Entities-domain tables (`entity_relationships`, `entity_master` parent fields). | **NOT APPLICABLE as worded** for Option 1. | **Breaks as worded** (Level 1 fields, names, parent rows, queue). | "KI 22.9's 4 edges and the 24 RC-12 wrong-LEI rows are excluded and untouched. The writer touches **only** Entities-domain tables: `entity_master` (the §3 column list; inserts of `holding` parent rows; never `normalized_name`, `type`, an existing LEI, a non-placeholder name or a non-NULL country), `entity_relationships` (insert-only, direct `legal_parent`/`gleif`), and `entity_enrichment_queue` (`status`/`last_attempt` of Bucket A rows only). ETF, 13F and Ops tables are never written; Ops only through the ingest API." | **Amended** |
| 6 | Observability: 001 heartbeats, or a manual run ledger agreed with the Operations Lead if 001 isn't live. | PASS (conditional): ingest live; one pilot `failed` event was not delivered (TimeoutError). | **Conditional (Ops N-4):** the pilot lost 2 of 7 terminal events. **Bulk start needs 002's outbox live (planned Wed 14 Oct), or the fallback run log reconciled daily** (§7). | Unchanged, **plus:** "and the runner is registered in `ops_job_registry` before its first write. **Bulk start (the pilot counts) requires MA-OCT-002's outbox to be live, or else the runner's append-only run log, reconciled by the Operations Lead against `ops_job_run` after each day's batch, weekends included.**" | Added clause |
| 7 | Credentials: no token literals (F1). Wrangler session or a scoped secret. | PASS (design condition); run interactively (F6). | **Pass by design** (§7: interactive only). | Unchanged | No |
| — | **NO-GO** if criterion 1 fails; the gaps are mainly (a)/(b); the W rate is > 2%; or the H4/H5 fix alone clears the backlog in ≤ 4 weeks. **DEFER** if 1–3 pass but 4 or 6 can't be met in October. | DEFER as worded for Option 1; GO if amended 4 and 5 are accepted. Option 2: GO. | — | "**NO-GO** if 1a (gap reading) or 1b fails, the gaps are mainly (a)/(b), the W rate is > 2%, **the T1 lower bound is < 98%**, or the live path clears them in ≤ 4 weeks. **DEFER** if 1–3 pass but **amended** 4, 5 or 6 can't be met in October. **Partial GO** (Founder option): B + C only, with A after 013, ≈ 57.1k (≈ 54.4k expected after the drain). **Option 2** (C only, ≈ 10.0k) remains 006's fallback." | Amended |

## 6. Three-point check (brief item 4; Team v3)

**(i) Index audit.** `EXPLAIN QUERY PLAN` is run in the as-run form before the pilot. The runner aborts on any other plan, or on any `SCAN entity_master`, `SCAN entity_enrichment_queue` or `SCAN fund_holdings_monthly`.

| Id | Statement | Expected plan |
|---|---|---|
| X1 | keyset export `entity_master WHERE entity_id > ? ORDER BY entity_id LIMIT 5000` | `SEARCH … USING INTEGER PRIMARY KEY (rowid>?)` (as 006 D2) |
| X2 | keyset export of the queue and of `entity_relationships` | `SEARCH … USING INTEGER PRIMARY KEY (rowid>?)` |
| V1 | pre-image `… WHERE entity_id IN (≤250)` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` |
| V2 | parent lookup `… WHERE lei IN (…)` | `SEARCH entity_master USING INDEX idx_entity_master_lei (lei=?)` |
| W1 | CAS `UPDATE entity_master … WHERE entity_id=? AND …` | `SEARCH … USING INTEGER PRIMARY KEY (rowid=?)` |
| W2 | `INSERT OR IGNORE INTO entity_master` | insert (autoindex conflict) |
| W3 | queue `UPDATE … WHERE entity_id=? AND status IN (…)` | `SEARCH … USING INTEGER PRIMARY KEY (rowid=?)` |
| W4 | `INSERT OR IGNORE INTO entity_relationships` | insert (PK) |
| V3 | post-run counts | computed **locally** from an X1/X2 re-export (no `COUNT(*) … WHERE direct_parent_exception=…` on D1) |
| V4 | queue trend | `SCAN … USING COVERING INDEX idx_enrich_queue_status` (as 006 D10) |

**(ii) Single execution ≤ 50k reads.**

- The largest single execution is an X1 page (≤ 5,000 reads). A 250-statement CAS batch reads ≤ 1,000.
- The pilot records `meta.rows_read` and `meta.rows_written` per statement pattern. **If any multiplier is > 20% above §4.2,** the plan is recomputed and must fit 110k, or the run stops for Architect re-review.
- Any execution over 50k reads aborts.

**(iii) Budget declaration per invocation.** Every `wrangler d1 execute` call is declared in the plan file with its step, batch, statement count, estimated writes and estimated reads. The runner stops at > 1.3× the declared writes.

**Read budget:**

| Item | Reads |
|---|---|
| Fresh export | ≈ 74k |
| Pre-images and CAS | ≈ 45k |
| Post-run re-export | ≈ 74k |
| **Plan** | **≈ 195k** |
| **Ceiling** | **250k** |

## 7. Who writes, and how (brief item 6)

**Runner:** a **local, manual, Entities-domain runner**. No cron (the account is at 5/5) and no LaunchAgent. Precedent: June's `gleif-build-local.js` plus `firds-local-seed.mjs`'s wrangler shim.

- **Source:** `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs`, run **interactively** by the Engineering Lead. That avoids F6 (15 of 34 launchd boost runs lost to wrangler auth; Close-out §6).
- **Imports:** `normalizeName` from `App/Corporate Atlas/src/entities-seed.js` (same domain).

**Control surface,** under `App/Corporate Atlas/scripts/` (start / pause / resume / stop / status):

- `gleif-reconcile-011-status.sh`;
- `-pause.sh` / `-resume.sh`: the pause flag `App/Corporate Atlas/.gleif-reconcile-011-paused`, checked before every batch;
- `-stop.sh` (kill switch): finishes the in-flight statement, writes the checkpoint, exits `killed`.
- The runner refuses to start if `hold_all_jobs` is true, and never writes it.
- **Headroom gate, before every batch:** it fails closed when `d1-today` is unavailable (§4.3). It never assumes headroom.

**Work folder:** `~/MeridianAtlas-work/gleif-011/` (not iCloud-synced). It holds the plan, pre-images, checkpoints, the local run ledger, logs, the 013 hand-off file and the review lists. `gleif_006.db` is read in place, read-only (R4 GO keeps it until 011 closes). **Retention (R-2):** the pre-images, plan file, checkpoints and run log stay in this folder for **≥ 30 days after 011 closes, and until 013 closes, whichever is later**, independently of `gleif_006.db`. Their SHA-256s go in the close-out. Deleting `gleif_006.db` under R4 / N-6 does not touch them.

**Credentials:**

- D1: wrangler OAuth, interactive only.
- `d1-today`: a public GET.
- Heartbeats: an `X-Ops-Ingest-Key` read by path and never printed.

**Observability gate (Ops N-4, binding).** The bulk start requires MA-OCT-002's guaranteed local delivery (the outbox) to be live. **The Sat 17 Oct pilot counts as a start.** The outbox is planned for Wed 14 Oct.

- **Fallback, if it slips:** the runner writes its own **append-only run log**, `~/MeridianAtlas-work/gleif-011/runlog.jsonl`. It has one line per batch: `run_key, step, batch, rows, writes, cursor, outcome, utc`, and is written **before** the heartbeat is sent.
- **`outcome` vocabulary, and the heartbeat each maps to:**

  | Outcome | Heartbeat |
  |---|---|
  | `success` | `success` |
  | `partial` (some rows raced) | `partial` |
  | `failed` | `failed` |
  | `killed` | `killed` |
  | `paused` (the runner's own pause flag) | `skipped`, reason `pause` |
  | `budget_limit` | `skipped`, reason `budget` |
  | **`headroom_unavailable`** | `failed`, `error.class='headroom_unavailable'` (§4.3) |

  The same outcome is used whether or not the outbox is live.
- **Daily reconciliation (R-4, OPS-R8):** on each run day, weekends included (the Sat 17 pilot counts), the **Engineering Lead** exports that day's `ops_job_run` rows for `manual.gleif-reconcile-011` (the indexed history query, 001 Q5 pattern, **≤ 300 reads**) and that day's `runlog.jsonl`, both with SHA-256s, to `~/MeridianAtlas-work/gleif-011/recon/<date>/`. The **Operations Lead** reconciles from those files (the Ops lane cannot read D1 or the Access-protected admin route) and signs a one-line result in a relay report **by 09:00 UTC the next day**. **An unsigned day blocks the next day's first batch.**
- **Which path applies** is confirmed at the Fri 16 Oct release check (§11).
- **No token literals** (F1).

**Change Request: `MA-OCT-011-CR1`, "Offline GLEIF reconciliation runner"** (Kit v2: "starting a broad GLEIF backfill"; a new local job).

- **New paths:** the runner plus 4 control scripts. Flag files are gitignored.
- **No new table or column.** It uses `gleif_enrichment_version`, the new `match_source` value `gc_name_t1` (no CHECK on that column), and `source='gleif'` (within its CHECK).
- **Ops items, authorised and verified by the Operations Lead, executed by LANE-1-ENG (OPS-R6; Ops review N-1):**
  - a registry row `manual.gleif-reconcile-011` (Entities, Data-Identity Lead, `manual`), with **`expected_max_duration_s` = 900**, set from one **batch** run, not the day (N-2), so 002's lost-run rule fires on a hung batch. Written by a reviewed `wrangler --file` batch with an `ops_case_event` row;
  - a new emitter in the `OPS_INGEST_KEYS` secret, by `wrangler secret put` with the new Worker version recorded. That is a secret change; **the Architect approved it under K-1 to K-5 (RA-13, Architect Review `d097e6f9…7679`)**:
    - **K-1.** The key is ≥ 32 random bytes, generated on the Mac by LANE-1-ENG under the Operations Lead's authorisation. Only its SHA-256 hex goes into the secret.
    - **K-2.** The plaintext lives in one file outside the repo and outside iCloud (`~/MeridianAtlas-work/gleif-011/`, mode 600), is read by path, and is never printed or logged.
    - **K-3.** The put replaces the whole map. The executing lane keeps the canonical map (hashes only) in the work folder; the Operations Lead confirms the emitter list after the put is the old list **plus one**, with no other change. The new `meridian-ops` version is recorded.
    - **K-4.** Before the pilot, one test event from the new emitter must be **accepted**, and one with a wrong key must be **refused**.
    - **K-5.** At 011 close-out, the entry is set to the all-zero hash (the code's disable value) or removed, and which is recorded.
- **Reviewers:** Architect + Operations Lead.

## 8. Interaction with live jobs (brief item 7)

| Live job | Interaction | Mitigation |
|---|---|---|
| enrich Phase 3 (06:50) | Same pool as B, draining about 67 a day until the run (§4.2c). **Would re-select A rows** if they were written without Level 2. | B uses the fresh-export pool and descending LEI order (L11-15). Rows drained before export go to C-reasons. 011 never writes 05:50–07:10. CAS guards: a row that Phase 3 reached first updates 0 rows and is logged `raced`, then upgraded by a follow-up CAS on `='NO_LINK_DECLARED'`. Every A, B and C row 011 writes leaves the Phase 3 predicate (§3.1). |
| enrich boost (10:50 / 16:50 UTC) | Re-runs Phase 2+3 | **Paused 17–23 Oct** with its existing pause flag (`scripts/entities-enrich-boost-pause.sh`). While paused, the boost runner sends no heartbeat: the pause check stays first, and a paused run does no network work (Data-Identity condition 3; 002 rev 1.3 (`9ec6773a…3893`) §8.6 (a)5). The week is marked paused by one `ops_job_pause` row for `local.entities-enrich-boost`, `2026-10-17T00:00Z` → `2026-10-24T00:00Z`, inserted by the Operations Lead **by Fri 16 Oct** (002 rev 1.3 (`9ec6773a…3893`) §6.3). So 002's lateness view shows the slots as `paused`, never `missed`. Resumed at close-out. |
| enrich Phase 1 (06:00) | Pending operating queue rows | Q closes A's rows. The H2 head holds 0 A rows. |
| entities-seed (Mon 04:00), KI 22.40 | Upserts on `(normalized_name, type)`; the sticky diff re-stamps `updated_at` | 011 never changes the key. A rows already agree on country (T1); B rows are keyed on their LEI. **About 0 new sticky rows.** 011 never uses `updated_at` as its change marker. |
| 001 heartbeat | — | One run (start + end) **per batch** to `POST /api/ops/ingest/run-event`, job `manual.gleif-reconcile-011`. Fire-and-forget, 2 s ceiling, `node:https`. Metrics `{selected, attempted, progressed, raced, failed}`, `rows_read/written`, cursors. Delivery goes **through 002's outbox if it is live**. **Otherwise the append-only run log (§7) is the record of truth, reconciled by the Operations Lead daily** (the pilot lost 2 of 7 terminal events; Ops N-4, N-5). About 105 batches in total, well under the 1,000-a-day cap. |
| wrangler code 10000 (MA-OCT-000, H11) | Any batch can fail | Retry the same batch 3 times (30 s / 120 s / 300 s), which is safe because statements are idempotent. Read back before retrying after an ambiguous failure. After 3 failures: `failed` heartbeat, checkpoint, stop. Resume from the cursor. |
| FIRDS (Sunday) | Writes LEIs | 011 never runs on Sunday. The Monday re-plan re-checks "LEI on no other row" for the planned A ids. |

**Change freeze 17–23 Oct (Ops review N-3):** no `meridian-ops` deploys, no `OPS_INGEST_KEYS` changes and no Entities Worker deploys (enrich, seed, figi, api) during the run window, except an emergency rollback. The heartbeat path, the registry and the live-job interactions above stay as reviewed.

## 9. Verification (brief item 8)

**Before the run:**

- the plan SHA reviewed by the Architect + Operations Lead;
- a freshness gate: ≤ 50 GLEIF calls on a random sample of plan rows, **stratified so that ≥ 15 are A rows**, ≥ 98% agreement, or stop (Q2). Any A identity mismatch (LEI not matching the entity's legal name or country) is an **E-4 trigger, evaluated before any A or E-A write** (R-1 (a));
- the EXPLAIN set (§6);
- a **fail-closed test** in the dry run: with `d1-today` made unreachable (a URL override to an unreachable host), the runner makes **0 writes**, leaves the cursor unchanged, and emits one `headroom_unavailable` run-log line and `failed` heartbeat.

**Per batch:**

1. Export the pre-image (all §3 columns plus `updated_at` and `gleif_enrichment_version`) to `preimage-<step>-<batch>.jsonl`, and record its SHA in the checkpoint.
2. Execute the batch.
3. Read the rows back and diff them against the plan.

**Stop conditions (any one):**

- more than 5 rows, or more than 0.5% of a batch, mismatch for any reason other than `raced`;
- writes > 1.3× the declared figure;
- an unexpected table appears in `meta`;
- a contradicted parent appears;
- a parent collision rate > 1%;
- 3 failures of the same batch;
- the account guard is breached.

**E-4 and A stop:** applied exactly as the single rule in §3.1 (triggers (a)–(c); response RA-12; sequencing). The Sat 17 pilot holds no A rows, and the sampled diff below checks execution, not identity, so neither is an A identity trigger.

**Headroom unavailable** (§4.3, including the F-2 monotonic case) is not a mismatch stop. The runner runs no batch, logs `headroom_unavailable`, and stops until the next scheduled batch check, with the cursor unchanged.

**After the run,** computed locally from a fresh export. Expected values are on 006 FINAL (29 Sep export basis), ± drift since the export. Rows drained by live Phase 3 are counted in C-reasons, not B (§4.2c). The checks below hold either way.

| Check | Expected |
|---|---|
| LEI-bearing rows | 16,627 + 3,677 = **20,304** |
| Phase 3 pool | ≤ **10** (7 with neither RR nor RX) |
| `NO_LINK_DECLARED` | **152** = 128 with no GLEIF reason + 24 excluded wrong-LEI rows (Q67–Q68) |
| `ultimate_parent_exception` non-NULL | **18,739** = B 7,355 + C 8,263 + A 3,121 (Q69) |
| `legal_parent` edges | 66 + 1,027 = **1,093** |
| KI 22.9's 4 edges, the 24 wrong-LEI rows, and `normalized_name`/`type` on every touched row | unchanged (pre-image diff) |
| New duplicate LEIs | **0** |

**Sampled diff:** 200 random touched rows against `gleif_006.db`, which must match 100%. The sample includes **at least 25 of the 299 E-A edges** (E-3): each edge parent must equal the child's RR `IS_DIRECTLY_CONSOLIDATED_BY` parent, at 100%. Plus 25 API spot checks from the freshness allowance, **≥ 10 of them A rows**; a mismatch there triggers E-4's delete path (R-1 (c)).

## 10. Rollback (brief item 9)

**Per batch:** restore from its pre-image.

- `UPDATE … SET <cols> = <pre-image> WHERE entity_id=? AND gleif_enrichment_version=11 AND <011-written values>`. A row that a live job changed after 011 is listed, not clobbered.
- Edges: `DELETE … WHERE (parent, child) IN (<E list>) AND source='gleif'`.
- Parents: `DELETE … WHERE entity_id IN (<P ids>) AND gleif_enrichment_version=11`, after their edges.
- Queue: restored from the pre-image.

**Order:** Q → E-A → A → E-C → C-reasons / RC-15 / C → B → P.

**Full rollback write cost:** the reverse UPDATEs (B 29,744 + C fields 3,005 + C-reasons 16,506 + RC-15 29 + A 23,132 + Q 7,354 = 79,770), edge deletes 1,027 × 4 = 4,108, parent deletes 365 × 11 = 4,015. That is **≈ 87.9k** plus heartbeats in the no-drain case, and **≈ 85.2k expected** after the live drain (§4.2c), about 4 run days at 25k a day. Rehearsed on 20 rows at the pilot.

**Full rollback is not same-day (Ops review N-4).** It would run under the same gates over **≈ 4 run days, 26–29 Oct**. Per-batch restore is the default response. A full rollback is a **Founder decision**, taken on Operations Lead and Architect advice.

**Rollback inputs (R-2):** per-batch rollback needs the pre-images, the plan file, the checkpoints and the run log, not the Golden Copy. They are kept per §7 (≥ 30 days after 011 closes and until 013 closes), independently of `gleif_006.db`.

**Rollback horizon (Architect AR11-1):** **011 rollback is valid until 013 starts. After 013's first write, any 011 reversal needs a joint 011/013 plan reviewed by the Architect and the Operations Lead.** (013 deletes the 392 hand-off twins, rewrites survivor keys and repoints links onto rows 011 wrote.)

## 11. Acceptance criteria and Wave 2 timeline (brief item 10)

**Acceptance criteria:**

- [ ] `MA-OCT-011-CR1` approved. Registry row and emitter key live: job `manual.gleif-reconcile-011` and its emitter key registered in the Ops registry **by Fri 16 Oct**, authorised and verified by the **Operations Lead** and executed by **LANE-1-ENG** (OPS-R6; `expected_max_duration_s` = 900 per batch, N-2) (002 rev 1.3 (`9ec6773a…3893`) §19.5 R-5; not among A1's 49 rows). The Operations Lead signs release readiness.
- [ ] **N-2:** every write line traces to a 006 high-confidence tier (§3.0). The plan file carries a tier tag per statement. 0 statements come from T1_LAPSED, T1+/T1c, N+, D5-3, D7-2 or the 9 D7-1 government rows. L11-16 (A Level 2 / E-A) confirmed by Ops (OPS-R2, 8 Oct): E-A kept under E-1 to E-5, unless the Founder chooses the drop path on 12 Oct.
- [ ] **E-A (OPS-R2):** E-1 exclusions listed, not written; 0 E-A edges without their A write (E-2); ≥ 25 E-A edges in the sampled diff at 100% (E-3); E-4 applied if any wrong T1 match is found; no ultimate edges (E-5).
- [ ] **N-4:** ≤ 25k row-writes a day by 011 (≤ 40k N-4 limit). No Sunday, Monday before 08:00 UTC, or enrich window. A per-batch budget checkpoint and a kill-switch check before every batch, both logged. The cursor resumes idempotently (§4.3 N-4 table).
- [ ] **Observability gate:** 002's outbox is live at the bulk start (the Sat 17 Oct pilot counts), **or** a daily run-log reconciliation is signed by the Operations Lead for every run day, weekends included.
- [ ] **`ops_job_pause` row present before the pilot:** `local.entities-enrich-boost`, `2026-10-17T00:00Z` → `2026-10-24T00:00Z`, authorised by the Operations Lead and inserted by LANE-1-ENG by Fri 16 Oct (OPS-R6) (002 rev 1.3 (`9ec6773a…3893`) §6.3).
- [ ] **A `d1-today` outage produces 0 writes and a `headroom_unavailable` event** (dry-run test in §9, plus any live occurrence). The cursor is unchanged and headroom is never assumed.
- [ ] **120 s bound (OPS-R3):** F-1 own-row window, F-2 monotonic check and F-3 midnight guard are implemented and logged. **F-4:** the A4 `d1-today` lag (+1/+5/+15 min) is recorded before the 17 Oct pilot. **F-5:** if the lag is > 10 min, the 60k ceiling and the widened F-1 window apply.
- [ ] EXPLAIN set on file, with all plans as expected. No `SCAN entity_master`; no execution over 50k reads.
- [ ] Measured multipliers within 20% of §4.2, or re-baselined and still ≤ 110k.
- [ ] Freshness gate ≥ 98% on ≤ 50 calls.
- [ ] Every batch has a pre-image, a read-back diff and a heartbeat. Any undelivered events are reconciled from the local ledger.
- [ ] ≤ 25k per day by 011. No write lands on a Sunday, on Monday before 08:00, or in the enrich windows.
- [ ] §9 post-run values met within tolerance.
- [ ] 0 H7-style overwrites, 0 new duplicate LEIs, 0 writes to `normalized_name`/`type`, a non-placeholder name, KI 22.9's edges or the 24 wrong-LEI rows.
- [ ] Delivered with SHA-256s:
  - the 013 hand-off file (392 newer-twin rows + 9 deferred LEIs / 22 rows), including the **full write payload** for the 9 deferred LEIs / 22 rows: Level 1 and Level 2 values plus Golden Copy provenance (publication, record ids), so that 013 never writes from `gleif_006.db` (R-3);
  - the SHA-256s of the pre-images, plan file, checkpoints and run log, retained per §7 (R-2);
  - the manual-review lists (31 LEIs / 62 rows; **9 government rows (D6-1 / D7-1)**; 2,336 review tiers; 1,342 T1_LAPSED and 1,739 T1+/T1c (report-only, N-2); 852 N+ duplicates; 128 no-reason rows; 215 deferred A edges);
  - the collision list.
- [ ] Rollback rehearsal passed. The full rollback cost is restated with the measured multipliers.
- [ ] **E-4 (R-1 + AR11-2 / RA-12 / RA-14):** ≥ 15 A rows in the Fri 16 freshness gate with 0 A identity mismatches; the A pilot (first A batch, Wed 21) adjudicated 50/50 on ≥ 50 rows (Data-Identity Lead, Operations Lead spot-check) before the next A batch; E-A run only after every A read-back diff passed; ≥ 10 A rows in the 25 post-run API spot checks. Any wrong T1 match handled per RA-12 (A stopped, batch restored, resume only on a bounded cause plus a fresh 50/50, else A deferred to after 013), with the outcome recorded.
- [ ] **Ingest key (RA-13):** K-1 to K-4 met before the pilot (accept/refuse test passed, emitter list = old list + 1); K-5 recorded at close-out.
- [ ] **Freeze file:** no batch started inside a `FREEZES.json` window.
- [ ] **Daily reconciliation (R-4)** if the outbox is not live: `recon/<date>/` exports with SHA-256s for every run day, and a signed Operations Lead result by 09:00 UTC the next day; no batch started on a day whose previous run day was unsigned.
- [ ] **Change freeze (N-3)** held 17–23 Oct: no `meridian-ops`, `OPS_INGEST_KEYS` or Entities Worker deploys, other than an emergency rollback.
- [ ] Boost resumed. Close-out sent to the Main Lane.

**Timeline:**

| Date | Work | Gate |
|---|---|---|
| Mon 12 Oct | Founder: 006 close, 011 GO / NO-GO / DEFER, spec approval, §5 wording, Q1–Q3 | Spec approval |
| Tue 13 Oct | CR1, registry row and emitter key (authorised by the Operations Lead, executed by LANE-1-ENG; OPS-R6). Build starts (Engineering Lead). | CR approval |
| Wed 14 – Thu 15 Oct | Runner, control scripts, plan generator. Dry run (0 writes). EXPLAIN set. **002 outbox planned live Wed 14 Oct.** | — |
| Fri 16 Oct | Fresh keyset export after the 06:50 cron, then plan generation (§4.2c). Architect + Operations Lead review of the plan SHA, tier tags (N-2), three-point check and control surface. Freshness gate. **Release check confirms the observability path: outbox live, or the daily run-log reconciliation (N-4). It also confirms the `ops_job_pause` row for the boost (17 → 24 Oct) is present, the fail-closed test has passed, the A4 lag is recorded (F-4; and F-5 applied if > 10 min), the freshness gate held ≥ 15 A rows with no open E-4 trigger (R-1 (a)), and `manual.gleif-reconcile-011` with its emitter key is in the Ops registry (002 rev 1.3 §19.5 R-5).** | Founder release approval (one checkpoint) |
| Sat 17 – Thu 22 Oct | Execution per §4.4 | Stop conditions only |
| Fri 23 Oct | Verification and close-out package | Close-out review; Founder about 26 Oct |

## 12. Out of scope and dependencies (each with an owner packet)

| Item | Owner packet |
|---|---|
| H1 / H2 / H3 / H6 live code fixes, H5 latent marker (RC-1/2/3/5/13) | **Entities live-path fix packet. Not numbered; the Main Lane assigns it** (Matrix ranks 2, 3, 6, 12, 17) |
| KI 22.40 sticky diff (RC-11); `type_hint` (RC-7) | Seed fix packet (Main Lane assigns; may merge with the live-path packet) |
| Live Phase 3 writes ultimate edges (13 exist) where 011 writes direct only (L11-9) | Live-path fix packet, plus a UX check of the Corporate Atlas hierarchy |
| KI 22.41 merge (RC-10), the 392 twins and 9 deferred LEIs; LEI-keyed placeholder `normalized_name` (L11-4) | **MA-OCT-013** (`claude/MA-OCT-013_Spec_Brief.md`). **Prerequisites:** (1) the `instrument_entity_map(entity_id)` index CR, applied Tue 13 Oct (ruling A; 013's runner stops if the index is missing); (2) 011 closed, with its hand-off file delivered; (3) 013's own CR, including the new table `entity_merge_redirect` (ruling B); (4) **the read-only pre-spec measurement of repoint cost, before 013 spec approval** (Ops N-7; L11-13 as amended). Order: index 13 Oct → 011 17–23 Oct → 013. |
| KI 22.42 escaped names (15 without a twin) | Live-path fix packet; the 90 twins in 013 |
| RC-12 wrong LEIs (24), RC-19 `'NULL'` strings, the `lei_status` vocabulary | MA-OCT-004 (aggregate DQ ticket) |
| KI 22.9's edges (RC-20) | MA-OCT-003 / 004 |
| Review tiers (T2/T3, N+ medium 2,593; Matrix rank 18) | Manual queue via MA-OCT-004; report-only in 011 |
| H8 stale queue (RC-6, beyond A's own rows) | Live-path fix packet |
| H10 delta and N-4 (RC-8); full Level 1 refresh (≈ 33k; not in 011) | MA-OCT-002, then a delta packet |
| F6 / F7 / KI 22.14 (RC-14) | MA-OCT-002 |
| **002 outbox (guaranteed local delivery)**: the bulk-start gate for 011 (Ops N-4) | **MA-OCT-002** (planned Wed 14 Oct). Fallback: the 011 run log with daily Operations Lead reconciliation (§7). |
| **`gleif_006.db` retention (Ops N-6)** | R4 / Main Lane. **The DB is deleted on 31 Oct if 011 is not opened by then**, so 011 must run from it before that date. If DEFER pushes 011 past October, the DB is rebuilt from the `gc/` zips (if they are kept) or a newer GC publication is used. Either way the freshness gate re-runs, and with a new publication the 006 tiers and sample must be re-run before any write (N-2). |
| Pinned wrangler version for local runners (Ops N-1) | F6 owner / MA-OCT-002. The 011 runner calls a pinned local wrangler, never a bare `npx` fetch. |
| (b) product note: show GLEIF's reason in Corporate Atlas | UI follow-up; the Main Lane assigns an owner (Matrix (b) row) |

## 13. User stories

- As the **Founder**, I want missing identity data to mean "GLEIF says why" instead of a generic marker, so that the Corporate Atlas shows real parents or real reasons.
- As the **Data-Identity Lead**, I want every 011 write to carry provenance and a pre-image, so that any batch can be audited or reversed.
- As the **Operations Lead**, I want each batch to report a heartbeat and respect a pause, stop and budget check, so that 011 cannot silently exhaust the shared write cap.
- As the **ETF Product Lead**, I want 011 to leave ETF tables and links untouched, so that exposure numbers move only through 013's reviewed merge.

## 14. Open questions for the Founder (3)

| # | Question | Recommended answer | Blocking? |
|---|---|---|---|
| Q1 | Do you accept the amended §9.2 wording in §5? That covers: **criterion 1 read in (entity, field) gaps** (1,529 = PASS; read in entities, 812 = FAIL vs 1,000), plus the new 1b (3,677 A entities, 100% of the pool); **4:** ≤ 95k total / 110k ceiling / ≤ 25k a day; **5:** Level 1, name, parent-row and queue writes; the clauses added to 2, 3 and 6; and the NO-GO/DEFER clause. | **Accept, on the gap reading.** It is 006 Spec §5.1's own unit, §9.2 says "parent gaps" (006 ruling D6-6), and **the Operations Lead supports it (Ops Review N-3)**. Read in entities, criterion 1 fails, but 1b shows the wider scope clears 1,000 entities several times over. The amended gates keep every original safety property, and the plan (89.2k, or ≈ 86.5k expected after the drain) reconciles to 006's 100.4k with 0 residual. Either GO is conditional on Ops N-2 and N-4 (§3.0, §4.3). **Fallbacks:** partial GO (B + C, ≈ 57.1k, within the original 60k total) or 006's Option 2 (≈ 10k). | Yes, 12 Oct |
| Q2 | Write from the pinned GC publication of **28 Sep** (the one 006 validated), with a ≤ 50-call freshness gate before the first write? | **Yes.** A new download would re-open 006's tiers and sample. The 1 Oct freshness was 50/50. This needs a **new 011 allowance of ≤ 50 GLEIF calls** (006 has 8 left). **Retention (Ops N-6):** `gleif_006.db` is deleted on 31 Oct if 011 is not opened by then (§12). | Yes, 12 Oct |
| Q3 | **Ordering only:** run 011 **before** 013? (The survivor rule is already decided: S1, Founder, 3 Oct.) | **Yes.** 006 accepts "before or interleaved". Under S1, 011 writes only the surviving side (L11-7) and hands 392 newer twins plus 9 deferred LEIs to 013. 013 is an IDEA with no spec, and waiting would push 011 past October. | No (sequences 013) |

## 15. Numbers register

**Sources (006 FINAL, commit `16918e0`):**

| Abbreviation | File | SHA-256 |
|---|---|---|
| E | Evidence | `0d1bbf9b…ddb1bc` |
| M | Matrix | `db594224…f33b5a` |
| CS | Close-out | `f54ae3bf…637537` |
| OR | Ops Review | `8ac07234…2c763e` |
| CL | Classification | `cb3b3a84…13df64` |
| CM | `cost_model.json` | `a4d8169f…a975` (unchanged; work folder) |

"Lane Qn" = Appendix A.

**Status:** every 006-sourced number is **FINAL** as of 8 Oct. 011-derived numbers are FINAL on the 29 Sep export basis. The live-drain figures are *estimates* until the 16 Oct plan export.

| Number | Value | Source § | SHA read | Status |
|---|---|---|---|---|
| T1 base after D6-1 / D7-1 (rows / LEIs) | 4,109 / 3,717 | CS §3; E §7 D6-1, D7-1; Lane Q41, Q76–Q77 | f54ae3bf…637537 | **FINAL** |
| T1 precision (strict T1, D6-3) | 150/150; lower bound 98.02% | CS §1, §7 #8; E §15.2 | f54ae3bf…637537 | **FINAL** |
| W rate: sample / population | 2/164 = 1.2% / 24 / 8,342 = 0.29% | M §3 #3; E §15.3 | db594224…f33b5a | **FINAL** |
| Wrong LEIs excluded (D6-4) | 24 | CS §1; E §15.3 | f54ae3bf…637537 | **FINAL** |
| D7-1 government rows to manual review | 9 (6 T1 + 1 T1_LAPSED + 2 T1+) | E §7 D7-1, §16.3; Lane Q78 | 0d1bbf9b…ddb1bc | **FINAL** |
| Medium tiers never written | T1_LAPSED 1,342; T1+/T1c 1,739; N+ duplicates 852 | CS §3; CL | f54ae3bf…637537 | **FINAL** |
| A written (L11-7) / deferred | 3,677 / 40 (9 → 013, 31 → review) | Lane Q42–Q45, Q79 | cb3b3a84…13df64 | **FINAL** (29 Sep basis) |
| Twin rows handed to 013 | 392 | M rank 2; Lane Q43 | db594224…f33b5a | **FINAL** |
| Placeholder pool (ceiling) / RC-15 | 7,436 / 859 | CS §3; M ranks 1, 5; Lane Q05, Q80–Q81 | f54ae3bf…637537 | **FINAL** |
| Pool undrained on 5 Oct / drained | 6,912 / 524 | CS §1, §3; E §16.1 | f54ae3bf…637537 | **FINAL** |
| Live Phase 3 rate, 1–5 Oct / days to drain 6,912 | about 67 a day / about 103 (about 39 with all 4 runs) | CS §1; E §16.1 | f54ae3bf…637537 | **FINAL** |
| Expected B at run time / D (drained) | ≈ 6,112 / ≈ 1,324 | §4.2c | — | estimate (set at the 16 Oct export) |
| C parent gaps (direct + ultimate) / entities | 1,529 (728 + 801) / 812 | CS §3; M §2–3; Lane Q82, Q84 | f54ae3bf…637537 | **FINAL** |
| KI 22.43 markers | **657** (661 before D7-2) | CS §1; M rank 3; E §7 D7-2; Lane Q83 | f54ae3bf…637537 | **FINAL** |
| C parent rows to insert / distinct parent LEIs | 365 / 705 | M rank 3; CM; Lane Q48 | db594224…f33b5a | **FINAL** |
| Direct edges C / A | 728 / 299 | M §2; Lane Q49, Q52 | db594224…f33b5a | **FINAL** |
| C-reasons: 006 basis / 011 writable / field writes | 8,493 / 8,345 / 16,596 (all (b) high) | M §2; CM; Lane Q54–Q56, Q87 | db594224…f33b5a | **FINAL** |
| (b) entities with no RX record | 128 = 95 high LAPSED + 33 medium D5-3 | Lane Q62, Q89–Q90 | cb3b3a84…13df64 | **FINAL** |
| KI 22.41 pairs | 1,928 (+ 743; 2,671 W rows) | CS §1–§2; M rank 4 | f54ae3bf…637537 | **FINAL** |
| 006 Option 1 / 2 writes | 100,373 / 10,175 | M §2; CS §5 | db594224…f33b5a | **FINAL** |
| 011 plan: no-drain / expected / ceiling | 89,153 / ≈ 86,505 / 110,000 | §4.2, §4.2c | — | FINAL / estimate / FINAL |
| 011 partial GO / Option 2 equivalent | ≈ 57.1k (≈ 54.4k expected) / ≈ 10.0k | §4.2b, §4.2c | — | FINAL / estimate |
| Full rollback | ≈ 87.9k (≈ 85.2k expected) | §10 | — | FINAL / estimate |
| GC vs API freshness / GLEIF calls left for 006 | 50/50 / 8 of 60 | CS §7 #9, §8 | f54ae3bf…637537 | **FINAL** |
| 006 D1 reads / writes | 127,238 / 0 | CS §8; OR budget | f54ae3bf…637537 | **FINAL** |
| D2 rows / LEI rows | 43,998 / 16,627 | CS §2; E §8.2 | f54ae3bf…637537 | **FINAL** (29 Sep snapshot) |
| Account writes Mon 5 Oct (seed day) | 33,097 | E §16.1 (D8) | 0d1bbf9b…ddb1bc | **FINAL** |

**Changed since 7 Oct:** see §16 (the rev 1.5 to rev 1.9 rows). No number in this register changed after 8 Oct.

## 16. Changed since rev 0 (`76ee07ec…9b72`)

| Item | rev 0 | rev 1 | Why |
|---|---|---|---|
| A rule | L11-3: 1:1 only, 3,290 | L11-7: one row per LEI on the S1 side, **3,677** | Main Lane ask 1a; 006 Matrix; D6-1 |
| A status | ISSUED only (L11-2) | ISSUED + PENDING_TRANSFER (L11-8) | 1b; adopts 006; accepted as a recorded deviation, 3 Oct (rev 1.1) |
| 013 survivor rule | recommended S1 | **S1 decided** (Founder, 3 Oct); Q3 narrowed to ordering | rev 1.1 |
| A edges / parents | all of A's parents, 552 parent rows | edges only where the parent exists (299); no A-only parent rows (L11-10) | Bounded scope; adopts 006's P basis |
| B | pool only | pool + RC-15 (859) | 1e (L11-11) |
| C | 1,296 + 1,418 gaps (incl. A), 1,598 edges (direct + ultimate), 552 parents | **1,529 gaps / 812 entities, 728 direct edges, 365 parents** | 1f; adopts 006's basis; L11-9; D6-5 |
| C-reasons | 8,353 | 8,345 (−20 wrong, +12 ultimate-only) | 1g, 1i |
| Wrong LEIs | not known | 24 excluded everywhere (L11-12) | D6-4 |
| Writes | ≈ 90.9k | ≈ 89.2k; reconciled to 006 with 0 residual (§4.2b) | Ask 1 |
| Partial GO | ≈ 63k | ≈ 57.1k | Ask 1 |
| Criterion 1 | single reading | both readings (D6-6); 1b in entities | Ask 2 |
| Criterion 3 | interim | 150/150, lower bound 98.02%; test is on the lower bound | Ask 3 |
| Post-run NLD / ultimate exceptions / edges | ≤ 128 / ≈ 18.4k / 1,664 | 152 / 18,739 / 1,093 | Recomputed |
| **rev 1.5:** 006 inputs | draft (Matrix `ce93f54f…`, Evidence `208044a6…`, CL `f364449c…`) | **FINAL** (`db594224…`, `0d1bbf9b…`, `cb3b3a84…`, CS `f54ae3bf…`, OR `8ac07234…`) | 006 close-out `16918e0` |
| **rev 1.5:** KI 22.43 | 661 | **657** | D7-2 |
| **rev 1.5:** government rows to manual review | 6 (D6-1) | **9** (D7-1); A and B unchanged (Q78) | D7-1 |
| **rev 1.5:** criterion 2 evidence | about 65 days (pool 7,436) | about 67 a day; 6,912 undrained, about 103 days (39 at best) | 006 FINAL §16.1 |
| **rev 1.5:** B / plan | 7,436 / 89,153 | ceiling 7,436, expected ≈ 6,112 / ≈ 86,505 expected (89,153 no-drain case) | Live drain (§4.2c) |
| **rev 1.5:** tier basis | implicit | §3.0 table; every write line traced to a high tier (N-2); L11-16 | Ops N-2 |
| **rev 1.5:** budget and observability | 25k a day; heartbeats with a local ledger | N-4 mapping (§4.3); outbox gate or daily run-log reconciliation (§7, §11) | Ops N-4 |
| **rev 1.5:** retention | — | `gleif_006.db` deleted 31 Oct if 011 is not opened (§12) | Ops N-6 |
| **rev 1.5:** criterion 1 | gap reading | gap reading, supported by Ops (N-3) | Ops N-3 |
| **rev 1.6:** paused boost (§8) | "The 001 pilot then reports `skipped/pause`" | sends nothing while paused; the week is marked by an `ops_job_pause` row (17 → 24 Oct), so slots show `paused`, not `missed`; row required before the pilot (§11) | 002 rev 1.2 (`98c0ef37…dbf2`) §6.3, §8.6 |
| **rev 1.6:** headroom gate (§4.3, §7, §9, §11) | per-batch `d1-today` check; failure handling unstated | **fails closed:** 2 s ceiling + 1 retry; fresh ≤ 120 s and today's UTC date; otherwise no batch, cursor unchanged, `headroom_unavailable` (run log + `failed` heartbeat), stop until the next scheduled check; outcome vocabulary added | 002 rev 1.2 (`98c0ef37…dbf2`) §8.5 |
| **rev 1.7:** E-A (§3.0, §3.1, §9, §11) | optional; "Ops to confirm" (L11-16) | **kept under E-1 to E-5** (LEI-only parents with listed exclusions; no edge without its A write; ≥ 25 in the sampled diff; automatic drop on any wrong T1; direct only). Drop path (−1,196) stays for the Founder | Ops OPS-R2 |
| **rev 1.7:** 120 s bound (§4.3, §11) | fetch age ≤ 120 s, today's UTC date | plus **F-1** (own rows over ≥ 15 min), **F-2** (falling `rowsWritten` fails closed), **F-3** (no batch 23:50–00:10 UTC), **F-4** (A4 lag +1/+5/+15 min recorded before the pilot), **F-5** (lag > 10 min → 60k ceiling) | Ops OPS-R3 |
| **rev 1.7:** 002 citation; registry (§4.3, §8, §11) | 002 rev 1.2 `98c0ef37…` | 002 **rev 1.3** `9ec6773a…3893`; pause row "by Fri 16 Oct"; `manual.gleif-reconcile-011` + emitter key registered by the Operations Lead by Fri 16 Oct (§19.5 R-5) | 002 rev 1.3 |
| **rev 1.8:** E-4 timing (§3.1, §4.4, §9, §11) | E-4 on the A pilot or A sampled diff | ≥ 15 A rows in the Fri 16 freshness gate, E-4 evaluated before any A/E-A write; E-A only after every A read-back diff passed; ≥ 10 A rows in the 25 spot checks | Ops review R-1 (`976f0837…`) |
| **rev 1.8:** retention and 013 hand-off (§7, §10, §11) | retention tied to `gleif_006.db` | pre-images, plan, checkpoints, run log kept ≥ 30 days after close and until 013 closes; full write payload for the 9 deferred LEIs / 22 rows in the hand-off file | Ops review R-2, R-3 |
| **rev 1.8:** daily reconciliation (§7, §11) | "Ops reconciles and signs" | Engineering Lead exports `ops_job_run` (≤ 300 reads) + `runlog.jsonl` to `recon/<date>/` with SHA-256s; Ops signs by 09:00 UTC next day; unsigned day blocks the next day's first batch | Ops review R-4, OPS-R8 |
| **rev 1.8:** wording notes (§7, §8, §10, §11) | Ops executes registry/key; day-level duration; no freeze; rollback timing unstated | Ops authorises, LANE-1-ENG executes; `expected_max_duration_s` 900 per batch; freeze 17–23 Oct; full rollback ≈ 4 run days, 26–29 Oct, Founder decision | Ops review N-1 to N-4 |
| **rev 1.9:** E-4 / A stop (§3.1, §4.4, §9, §11) | E-4 drops E-A only; "A continues under the Architect's ruling"; A pilot undefined | one rule: triggers (a) Fri 16 gate ≥ 15 A rows, (b) A pilot = first A batch Wed 21 + 50-row adjudication 50/50, (c) ≥ 10 A spot checks; on any wrong T1: **A stops**, batch restored, resume only on a bounded cause + fresh 50/50, else A after 013 | Architect Review `d097e6f9…7679` AR11-2, RA-12, RA-14 |
| **rev 1.9:** rollback horizon (§10) | unstated | 011 rollback valid until 013 starts; after that, a joint 011/013 plan | AR11-1 |
| **rev 1.9:** ingest key (§7, §11) | "needs Architect review" | approved under K-1 to K-5 | RA-13 |
| **rev 1.9:** freezes (§4.4, §11) | own window list | runner honours `FREEZES.json` (boost 10:45–11:15 / 16:45–17:15; bootstrap 07:55–08:05; midnight) | Main Lane `FREEZES.json` |
| **rev 1.9:** stale text | §3.0 "Ops to confirm"; status "Still to come"; §5 header; §15 "filled in on 9 Oct" | tidied | Architect N11-2 |

## Appendix A — Local read-only SQLite query log (011 lane)

**Set-up:**

- Runs: Fri 2 Oct 2026 (Q01–Q70), Sun 4 Oct (Q71–Q75) and Thu 8 Oct (Q76–Q92), interactive. Python `sqlite3`, in-memory. On 8 Oct the loader was rebuilt in a new session scratchpad from the definitions in this appendix, and Q45 was re-run to prove parity (3,677 / 3,677).
- `gleif_006.db` attached `?mode=ro`: SHA `bd704c14c3ce862cff572e8922004248fb1178a1cede816956b8bb6c5e05b047`, `gc_publish_date = 2026-09-28 16:00:00 UTC`.
- 006 CSVs loaded into TEMP tables (`\N` → NULL; ruling L11-1).
- Nothing written to the work folder or to `claude/`.

**Input files:**

| Table | File | SHA-256 | Loaded for |
|---|---|---|---|
| `d2` | `day2/d2_entity_master.csv` | `ad4d40a0…5abd62` | rev 0 |
| `d3` | `day2/d3_queue.csv` | `23a52f94…61299f2f` | rev 0 |
| `d4` | `day2/d4_relationships.csv` | `aa2f30a0…ba4feb` | rev 0 |
| `t` | `day4/h12_tiers.csv` | `a280c3c2…751427c9` | rev 0 (006 §12.1 cites `…27f9`; routed to the 006 lane) |
| `k` | `day4/ki2243_rows.csv` | `038a088f…4bae7` | rev 0 |
| `p` | `day3/norm_hidden_duplicates.csv` | `9cafca93…5a95` | rev 0 |
| `cl` | `claude/MA-OCT-006_classification.csv` | `f364449c…3638` (draft) → **`cb3b3a84…13df64` (FINAL)** | rev 1 (Q54–Q71) → rev 1.5 (Q76–Q92) |
| `wl` | `day6/wrong_lei_detail.csv` | `41502aa7…1c01` | rev 1 |

Also read, as JSON: `day6/cost_counts.json` `1c16505e…e5b3` and `day6/cost_model.json` `a4d8169f…a975`.

**Derived TEMP tables:**

| Table | Definition |
|---|---|
| `rrd` / `rru` | ACTIVE direct / ultimate RR |
| `pool` | the live Phase 3 predicate |
| `gov` | the 6 D6-1 ids |
| `wrong` | `wl` minus 2014 (D6-4) |
| `a6` | T1, not DUPLICATE, not `gov` |
| `a6x` | `a6` + pair side (old = `p.entity_id`, new = `p.collides_with`) |
| `aw` | the L11-7 writable set |
| `lb` | LEI-bearing non-fund rows not in `wrong` |
| `cpar` / `apar` | RR parent pairs for `lb` gaps / for `aw` |
| `bset` | 006 (b) parent gaps outside the pool |
| `rxset` | outside-pool `lb` rows with an RX string to write |
| `cfix` | outside-pool `lb` rows with an RR gap |
| `rc15` | `cl.rc_id='RC-15'` |
| `gov9` | `gov` + 96163, 103384, 103395 (D7-1) |
| `wr` | C-reasons field writes outside the pool: (`entity_id`, field) where an RX record exists and no RR parent / D1 value |
| `wb` | the same for pool (B) rows |

Q01–Q40 (rev 0) are unchanged from rev 0's Appendix A and summarised here. Q41–Q70 are new in rev 1.

| Q | Query (abridged) | Rows out | Purpose |
|---|---|---|---|
| — | `.tables`; `count(*) sqlite_master`; `.schema`; `SELECT k,v FROM meta` | 6 / 1 / 15 / 8 | preflight |
| Q01–Q08 | RR/RX vocabulary; tiers; `lei_status` vocabulary; pool; marker vocabulary; D4 edge types; RR multiplicity | 14 / 20 / 9 / 13 / 1 / 2 / 2 / 1 | rev 0 basis |
| Q09–Q16 | C direct/ultimate state × RR × RX; pool reasons; pool L1; A Level 2; rows per LEI; pair flag | 4 / 4 / 9 / 9 / 4 / 1 / 4 / 2 | rev 0 sizing |
| Q17–Q30 | A split; writable; LEI uniqueness; edges; parents; cascade; pairs; partner LEIs; RX uniqueness; `&amp;`; queue; distinct edges | 4 / 1 / 1 / 2 / 3 / 3 / 1 / 1 / 3 / 1 / 1 / 1 / 2 / 1 | rev 0 sizing |
| Q31–Q40 | key collisions (2); edges via new parents; NULL country; KI 22.43 parents; A status; 013 sizing (4) | 1 / 1 / 1 / 1 / 3 / 2 / 2 / 5 / 4 / 1 | rev 0 sizing and 013 |
| Q41 | `SELECT gc_reg_status, COUNT(*), COUNT(DISTINCT gc_lei) FROM a6 GROUP BY 1` | 2 | A base after D6-1 (4,108 + 1 / 3,717) |
| Q42 | rows per LEI in `a6` | 4 | shared structure (3,332 single; 385 shared / 777 rows) |
| Q43 | `a6x` by shared × old side × new side | 6 | pair-side split |
| Q44 | per shared LEI: one pair / no pair / mixed | 3 | 348 / 31 / 6 LEIs |
| Q45 | `COUNT(*), COUNT(DISTINCT lei) FROM aw` | 1 | A written: 3,677 |
| Q46 | wrong 24 × pool / NLD / A | 1 | exclusion overlap (0 / 24 / 0) |
| Q47 | `lb`: direct RR gap, ultimate RR gap, either | 1 | reproduces 728 / 801 / 812 |
| Q48 | `cpar` distinct parents; missing in D2 | 1 | reproduces 705 / 365 |
| Q49 | direct pairs; direct + ultimate distinct; in D4 | 1 | 728 / 971 / 0 |
| Q50 | existing edges: direct / ultimate-only / all | 1 | 49 / 13 / 66 (L11-9) |
| Q51 | `apar` direct, ultimate, distinct, missing everywhere | 1 | 514 / 556 / 547 / 228 |
| Q52 | `apar` direct with the parent present after P | 1 | 299 |
| Q53 | `aw` × RX direct / ultimate / neither | 1 | 3,163 / 3,121 / 0 |
| Q54 | `cl` (b) parent gaps outside the pool: entities; currently NLD | 1 | reproduces 8,493 / 8,492 |
| Q55 | the same, by field × `rule_step` | 2 | all rule 1′ |
| Q56 | `lb` outside the pool with an RX string: all / direct / ultimate-only | 1 | 8,345 / 8,333 / 12 |
| Q57 | RC-15 × NLD / pool / wrong | 1 | 859 / 830 / 0 / 0 |
| Q58 | pool minus wrong; pool RR direct / ultimate | 1 | 7,436 / 71 / 74 |
| Q59 | `cfix` count, direct, ultimate | 1 | 738 / 657 / 727 |
| Q60 | `cfix` ∩ rows with an RX string on the other field | 1 | 92 |
| Q61 | `bset` vs `rxset`: both / 006-only / 011-only / wrong | 1 | 8,345 / 148 / 0 / 20 |
| Q62 | 006-only, not wrong: NLD × GC status × RX rows | 2 | 124 LAPSED + 4 ISSUED, 0 RX |
| Q63 | `bset` ∩ `cfix` | 1 | 92 (006 double base row) |
| Q64 | `rxset` ∩ `cfix`; RC-15 ∩ `rxset`; RC-15 ∩ `cfix`; RC-15 standalone | 1 | 92 / 830 / 1 / 29 |
| Q65 | `COUNT(*) FROM cfix` | 1 | 738 |
| Q66 | `rxset` × currently NLD | 2 | 8,344 / 1 |
| Q67 | NLD rows with neither direct RR nor RX | 1 | 128 |
| Q68 | NLD wrong-LEI rows | 1 | 24 |
| Q69 | `ultimate_parent_exception` to write: B / C / A | 1 | 7,355 / 8,263 / 3,121 |
| Q70 | `aw` with a queue row | 1 | 3,677 |
| Q71 | `cl` W/lei/country rows for KI 22.41 by field × category × `rule_step` | 3 | 013: 2,671 W rows; 2,201 (c) `lei` |
| Q72 | 013 survivors (older side) × LEI × has a queue row | 3 | 013: 1,172 no-LEI, all queued; 756 with LEI |
| Q73 | 013 duplicates (newer side) with a queue row | 1 | 013: 1,928 / 1,928 (all deleted, 0 repointed) |
| Q74 | `d4` rows referencing a duplicate id | 1 | 013: 0 relationship repoints |
| Q75 | duplicates by type × created month | 3 | 013: all operating; 11 Jun / 115 Jul / 1,802 Aug |
| Q45 (re-run 8 Oct) | `COUNT(*), COUNT(DISTINCT lei) FROM aw` | 1 | loader parity: 3,677 / 3,677 |
| Q76 | `cl` (FINAL) `lei` gaps by category × confidence | 9 | (d) high 4,109; (d) medium 3,081; (c) high 1,349 / medium 852; (a) high 14,626 / medium 3,011 |
| Q77 | `cl` `lei` (d) high vs `a6`: both / `cl` only / `a6` only | 1 | 4,109 / 0 / 0: A base identical to 006 FINAL high tier |
| Q78 | the 9 D7-1 rows: category, confidence, `rc_id`; in `a6` / `aw` / `pool` | 9 | all (a) `RC-A2`; 0 in A, 0 in B |
| Q79 | `aw` × `cl` `lei` category/confidence | 1 | 3,677 (d) high |
| Q80 | `cl` `name` (d) by confidence; in `pool` | 1 | 7,426 high, all pool |
| Q81 | RC-15 `name` rows by confidence | 1 | 859 high |
| Q82 | parent (c)/(d) gaps by field × confidence | 4 | direct 657 c + 71 d; ultimate 727 c + 74 d; all high |
| Q83 | KI 22.43 W rows | 1 | 657 |
| Q84 | 011 C basis re-run on `lb` | 1 | 728 / 801 / 812 (unchanged) |
| Q85 | (b) parent gaps outside the pool: entities by confidence | 2 | high 8,460; medium 37 |
| Q86 | the same, high, excluding wrong-LEI rows | 1 | 8,440 |
| Q87 | `wr` × `cl` category/confidence of that field | 1 | (b) high: 16,596 field writes / 8,345 entities. **N-2 check** |
| Q88 | `wb` × `cl` category/confidence | 1 | (b) high: 14,713. **N-2 check** |
| Q89 | high (b) outside-pool, non-wrong, not in `wr`: by GC status | 1 | 95 LAPSED (no RX record) |
| Q90 | medium (b) outside the pool: entities / wrong / in `wr` | 1 | 37 / 4 / 0 (33 D5-3 + 4 D7-2; never written) |
| Q91 | `cl` parent rows for A entities | 1 | 0 (A Level 2 has no 006 tier row; L11-16) |
| Q92 | distinct entities in `wr` | 1 | 8,345 |

## Appendix B — In-lane rulings

| # | Ruling | Status |
|---|---|---|
| L11-1 | The lane reads 006's work-folder CSVs read-only (in memory), alongside `gleif_006.db` opened `?mode=ro`. Every query is logged. | **Accepted** by the Main Lane, 2 Oct |
| L11-2 | Bucket A requires ISSUED only. | **Withdrawn in rev 1 → L11-8** |
| L11-3 | Bucket A writes 1:1 only, outside pairs. | **Withdrawn in rev 1 → L11-7** |
| L11-4 | 011 never writes `normalized_name` or `type`. | Logged 2 Oct; **reaffirmed** with its cost delta (§4.2b d). For Architect + Operations Lead confirmation |
| L11-5 | `lei_status` = GC EntityStatus; legacy values become a DQ ticket. | Logged 2 Oct; for confirmation |
| L11-6 | "WORK" means the work-folder root. | Logged 2 Oct |
| **L11-7** | Bucket A writes **one row per LEI, only on the S1-survivor (older) side** of a KI 22.41 pair, or on the only matching row outside any pair. It withholds LEIs matched only on a newer twin (3) or spread over pairs (6) → 013, and LEIs shared outside pairs (31) → review. **3,677 written.** **Basis:** the survivor rule S1, fixed by the Founder on 3 Oct (Decisions Log). | New, 2 Oct; **stands** (Main Lane, 3 Oct) |
| **L11-8** | GC status **ISSUED or PENDING_TRANSFER** qualifies for Bucket A (adopts 006). 1 row. | **ACCEPTED** by the Main Lane, 3 Oct, as a **recorded deviation from the brief's "ISSUED"** (Decisions Log) |
| **L11-9** | `legal_parent` edges are written for **direct** parents only (adopts 006). The ultimate parent lives in the mirror fields. Existing ultimate edges are not touched. | New, 2 Oct |
| **L11-10** | Parent rows are created only on 006's C basis (365). A-children edges are written only where the parent exists (299). The other 215 are deferred and listed. | New, 2 Oct |
| **L11-11** | RC-15 (859 names) is **in** 011 Bucket B, without `normalized_name`. | New, 2 Oct |
| **L11-12** | The 24 RC-12 wrong-LEI rows are excluded from **every** 011 write (D6-4/D6-5 extended to C-reasons). The 128 (b) entities with no RX record get no write and keep `NO_LINK_DECLARED`. | New, 2 Oct |
| **L11-13** | **013 repoint cost is measured before 013's spec is approved, and capped at run time** (amended 8 Oct for Ops N-7). 006 exported neither `instrument_entity_map`, `entity_isin_map`, exposure nor `bond_issuer_link`. Measured locally: 0 relationship repoints and 0 queue repoints (all 1,928 duplicate queue rows are deleted). A **read-only pre-spec measurement** (013 brief rev 1.5) measures R per table with EXPLAIN first, ≤ 50k reads per execution and a declared cap of 25k reads (35k with the 743). It runs after the 13 Oct index and before 013 spec approval. The **runtime cap stays as a second guard:** stop if R > 5,000, R has grown > 20% over the measured figure, or the repoint writes would be > 10,000. | New 4 Oct; **amended 8 Oct (N-7)**; reported the same day |
| **L11-14** | `entity_merge_redirect.duplicate_id` is an `INTEGER PRIMARY KEY` (rowid alias), so an insert costs 1 write with no PK index. No `survivor_id` index in v1 (007 resolves by `duplicate_id`); it is costed as optional. The redirect invariants are enforced by statement order and `EXISTS` guards, not by batch atomicity. | New, 4 Oct; reported the same day |
| **L11-15** | **Bucket B is taken from the fresh plan-time export and processed in descending LEI order.** Live Phase 3 walks the pool in ascending LEI order. So rows it drains before the export go to C-reasons, and the rows it can still race (≤ 176, 17–20 Oct) fall into B's last batch. There they are CAS-listed, never clobbered, and upgraded by the C-reasons CAS (§4.2c). | New, 8 Oct; reported the same day |
| **L11-16** | **A's Level 2 fields (RR mirrors or RX reasons, in the A UPDATE) and E-A edges are a composite of two high-confidence 006 sources** (T1 × RR/RX). They are not a separate 006 tier row, because A entities had no LEI in D2 (Q91). The Level 2 fields are **required**, so that live Phase 3 does not re-select A rows. **E-A (299 edges, 1,196 writes) is optional:** if Ops reads N-2 strictly, it is dropped and the plan falls by 1,196. **Confirmed by Ops, 8 Oct (OPS-R2): E-A KEEP under E-1 to E-5 (§3.1); drop remains the Founder's option at the 12 Oct gate.** | New, 8 Oct; reported the same day |
