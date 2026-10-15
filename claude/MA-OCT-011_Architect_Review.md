# MA-OCT-011 (rev 1.7) and MA-OCT-013 brief (rev 1.5): Architect Review (with ETF Product Lead read)

```text
ISSUED BY:    Main Lane (REVIEW-A NEXT, Fri 9 Oct, 3rd pass; sha256 ec8d5af7…fe53, re-issued 16:18 UTC as 06764e96…3feb, same instructions)
EXECUTED BY:  Architect + ETF Product Lead (independent review session, doc-only)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Mon 12 Oct gate: spec approval; GO / NO-GO / DEFER is a separate decision)
INPUTS:       claude/MA-OCT-011_Spec.md rev 1.7  304628940eec41b2df605fc94ddeb8d5c49036752c5fd49a14ffaad4142cadf0
              claude/MA-OCT-013_Spec_Brief.md rev 1.5  8319cc092aef020f7239c0fc5643f578f028ef971ff71453395b62088d7b2085
              claude/relays/LANE-11_REPORT.md (delta list)  43cd32821244746e0282f3fe186255fc42ae6b415eca95a8a3a0be30f4d77e95
              (all re-hashed on disk before reading; all match)
VERDICT:      011 rev 1.7: PASS WITH NOTES. Nothing blocks spec approval on 12 Oct. Two doc-only edits (AR11-1, AR11-2)
              must be on disk and hash-checked before the Fri 16 Oct release check.
              013 brief rev 1.5: PASS WITH NOTES as input to the 013 spec. Three items (B13-1 to B13-3) must be in that spec.
```

**Independence.** I wrote neither document nor any of their inputs. Rev 1.7 was saved at 05:23:28 UTC by a session that did not report, and adopted by LANE-11; I reviewed the bytes by hash, so authorship does not change this verdict. This verdict was formed before reading `MA-OCT-011_Ops_Review.md` (`976f0837…28f9`); see §6.

## 0. Method

- Delta-first, per the NEXT: LANE-11's delta list (rev 1.2 → 1.7, items 1–15) checked against the text, then a full read of 011 §1–§16 for the Architect scope (write plan, gates, runner, rollback, interactions) and the whole 013 brief.
- Cross-read: ENT-CR1 rev 1 `fb13ff3e…6c20`; 008 rev 1 `f3a350c1…1adb` (freezes); 002 rev 1.3 citations; Decisions Log 9 Oct (OPS-R2, OPS-R3, OPS-R4, OPS-R6).
- Repo, read-only at `16918e0`: `App/Ops/src/ops-api.js:637-653` (ingest-key check); `App/Corporate Atlas/migrations/corporate-atlas-v1.sql:30-77, 97-113` (`fund_entity_link`, `entity_exposure_monthly` PK, `entity_master` indexes); `App/Corporate Atlas/gleif-schema-migrate.js:116-133` (`entity_isin_map` PK `(isin, lei)`); `App/Corporate Atlas/ma-sep-001-merge-migration.sql:52-64` (exposure merge precedent); `App/Corporate Atlas/gate3-exposure.js` (0 references to `entity_relationships`).
- 0 D1 reads, 0 writes, 0 GLEIF calls, no git writes.

## 1. 011: delta list verified (rev 1.2 → 1.7)

| # | Delta (LANE-11) | Where checked | Result |
|---|---|---|---|
| 1–5, 9, 10 | 006 FINAL inputs; KI 22.43 = 657; 9 government rows; criterion 2 ≈ 67/day, 6,912, ≈ 103 days; B ceiling 7,436 / expected ≈ 6,112; plan 89,153 / ≈ 86,505; retention; criterion 1 gap reading | Status block; §1; §2; §3.0; §4.2–§4.2c; §5; §12; §15 | ✔ Consistent everywhere |
| 6 | L11-15 B in descending LEI order; racing rows listed | §3.2, §4.2c, §8 | ✔ |
| 7 | §3.0 tier basis (N-2) | §3.0 | ✔ (see N11-2 on one stale cell) |
| 8 | N-4 mapping; outbox or daily run-log reconciliation | §4.3 table; §7; §11 | ✔ |
| 11 | Paused boost sends nothing; `ops_job_pause` row 17 → 24 Oct | §8 row 2; §11 | ✔ |
| 12 | Headroom gate fails closed (2 s + 1 retry; ≤ 120 s; today's UTC date) | §4.3; §7 outcome table; §9 fail-closed test | ✔ |
| 13 | E-A kept under E-1..E-5; drop path −1,196 kept | §3.0; §3.1; §9; §11 | ✔ wording matches OPS-R2 (but see AR11-2 on E-4's trigger) |
| 14 | F-1..F-5 | §4.3; §11 | ✔ verbatim with OPS-R3 |
| 15 | 002 rev 1.3 `9ec6773a…3893` cited; registry row + emitter key by Fri 16 Oct; pause row by Fri 16 Oct | §4.3, §8, §11 | ✔ |

**Arithmetic re-run:** §4.2 total = 4,015 + 29,744 + 3,005 + 16,506 + 29 + 2,912 + 23,132 + 1,196 + 7,354 + 1,260 = **89,153** ✔. §4.2b reconciliation −11,220 with 0 residual ✔. §4.2c expected 89,153 − 2 × 1,324 = **86,505** ✔. §4.4 day totals: Sat ≈ 5,175; Mon 5,862 × 4 = 23,448; Tue 3,005 + 2,912 + 29 + 17,000 = 22,946; Wed 2,154 + 2,900 × 6.29 ≈ 20,395; Thu 777 × 6.29 + 7,354 + 1,196 ≈ 13,437 ✔ (each ≤ 25k). §10 rollback 79,770 + 4,108 + 4,015 = 87,893 ✔.

## 2. 011: Architect assessment

| Area | Assessment |
|---|---|
| Write safety | Every statement is CAS `UPDATE` or `INSERT OR IGNORE`; no reliance on batch atomicity; pre-image per batch; read-back diff; listed-never-clobbered on races. Correct pattern for D1 without transactions across executions. |
| Domain | Writes only `entity_master`, `entity_relationships`, `entity_enrichment_queue` (Entities). Ops only through the ingest API. No new table or column. ✔ |
| Index audit (§6 i) | X1/X2 keyset on rowid, V1/W1/W3 on rowid, V2 on `idx_entity_master_lei` (in the migration of record). Abort on any `SCAN entity_master` / queue / `fund_holdings_monthly`. ✔ |
| Per-execution reads | Largest X1 page ≤ 5,000; CAS batch ≤ 1,000. No GROUP BY/ORDER BY on D1 (V3 is computed locally), so the 9 Oct temp-B-tree rule does not bite. ✔ |
| Budget gates | ≤ 25k/day by 011; account + batch ≤ 70k (60k under F-5); Monday only ≥ 08:00 and ≤ 45k at first check; fail closed. Consistent with OPS-R3/R4. ✔ |
| Ordering | P → B → C → A → Q/E-A is correct: parents exist before edges; the pool leaves Phase 3 early; E-A needs C's parents. ✔ |
| Interactions | Phase 3, boost (paused), seed (key never changed), FIRDS (Sunday), wrangler 10000 all handled. **ENT-CR1** (13 Oct) and **008** (frozen 17–23 Oct) do not overlap 011's tables or days. ENT-CR1's C2/C3 may slip to "after 23 Oct", never into 011's week. ✔ |
| A4 dependency (F-4) | The A4 lag must be recorded before Sat 17. OPS-R4 X-7 lets ENT-CR1's +1/+5/+15 min sample on Tue 13 count toward it. That is the earliest measurement; if both slip, 011's pilot waits. Correctly gated. |

## 3. 011: required before the Fri 16 Oct release check (doc-only; Main Lane hash check, no new review)

**AR11-1. State the rollback horizon.** §10's per-batch rollback restores from pre-images guarded by `gleif_enrichment_version = 11`. That is valid until **013's first write**. 013 deletes the 392 hand-off twins, rewrites survivor keys and repoints links onto rows 011 wrote, so after it starts a 011 rollback can restore a pre-image onto a merged survivor or recreate an edge to a row whose twin no longer exists. Add to §10: "**011 rollback is valid until 013 starts. After 013's first write, any 011 reversal needs a joint 011/013 plan reviewed by the Architect and the Operations Lead.**" Add the same line to the 013 brief's ordering section at 013's next revision.

**AR11-2. Make E-4's trigger real, and pre-state the ruling on A.**
- E-4 (§3.1) and §9 refer to "the A pilot (17 Oct)". **§4.4 has no A rows on 17 Oct**: the pilot is P + 250 B rows; A starts on Wed 21.
- E-4 also refers to "the A sampled diff". §9's sampled diff compares written rows with `gleif_006.db`, so it proves the plan was applied as written. **It cannot detect a wrong T1 match**, because a wrong match is written exactly as planned.
- **Edit:** define the **A pilot as the first A batch on Wed 21 (≤ 250 rows)**, followed by a hold. Before the next A batch, **≥ 50 rows from that batch are adjudicated** as correct identity matches (the GC record against the entity's own evidence: name, country, any CIK or instrument links) by the Data-Identity Lead, with an Operations Lead spot-check (the executor does not adjudicate its own run). Required: 50/50.
- **Pre-stated Architect ruling (RA-12)** for "A continues only under the Architect's ruling on A": on **any** wrong T1 match in that adjudication or later, **A stops**, not only E-A. The batch holding the wrong match is restored from its pre-image (with its E-A edges and queue rows). A may resume only if the cause is a bounded pattern that can be excluded from the remaining A plan (re-hashed plan, re-reviewed SHA) **and** a fresh 50-row adjudication of the remaining plan is 50/50. Otherwise A defers to after 013 (the Founder's partial-GO path), and B + C stand.

### 3a. Architect ruling on 011-CR1's secret change (RA-13)

§7 says the new `OPS_INGEST_KEYS` emitter "is a secret change, so it needs Architect review". Checked `App/Ops/src/ops-api.js:637-653`: the secret is a JSON map `{emitter_id: sha256_hex(key)}` (hashes only), the presented key is hashed and compared with `constantTimeEqual`, and an all-zero hash is treated as disabled. **Approved, under K-1 to K-5:**
- **K-1.** The key is ≥ 32 random bytes, generated on the Mac by the executing lane (LANE-1-ENG) under the Operations Lead's authorisation (OPS-R6; Ops review N-1). Only its SHA-256 hex goes into the secret.
- **K-2.** The plaintext lives in one file outside the repo and outside iCloud (`~/MeridianAtlas-work/gleif-011/`, mode 600), is read by path, and is never printed or logged.
- **K-3.** `wrangler secret put OPS_INGEST_KEYS` replaces the whole map. The executing lane keeps the canonical map (hashes only, not secret) in the work folder, and the Operations Lead confirms the emitter list after the put is the old list **plus one**, with no other change. The new `meridian-ops` version is recorded.
- **K-4.** One test event from the new emitter before the pilot; it must be accepted, and one with a wrong key must be refused.
- **K-5.** At 011 close-out, set the entry to the all-zero hash (the code's disable value) or remove it, and record which.

The same conditions apply to 008's `local-bonds` emitter (008 Architect review N8-5).

## 4. 011: notes (non-blocking)

- **N11-1. Do heartbeat writes count toward 011's 25k/day?** §4.4 says Mon's B rows "above 6,250 roll to Tue", which is exactly 25,000 before about 300 heartbeat writes that day. Say whether heartbeats count. If they do, cap Monday's B at about 6,170 rows.
- **N11-2. Stale text.** §3.0's "A Level 2" row still ends "Ops to confirm under N-2", while §11 records OPS-R2 as confirming L11-16. The status block's "Still to come: … final SHA-256s", §15's "Changed since 7 Oct: *(filled in on 9 Oct)*", and §5's column header "011 rev 1.5 against it" are also stale. Tidy at the next revision; no effect on the plan.
- **N11-3. Retry policy** (3 retries at 30/120/300 s) differs from ENT-CR1 and 008. Safe because every statement is idempotent. Harmonise in a later runner packet.
- **N11-4.** The freshness gate's ≤ 50 GLEIF calls need Founder Q2 = yes; this is already in §14.

## 5. ETF Product Lead read (011)

- **No ETF, 13F or Ops table is written** (§3, §5 criterion 5). ✔
- **`entity_id`s never change** in 011 (only 365 new `holding` rows are added), so `entity_exposure_monthly`, `fund_entity_link` and `instrument_entity_map` keys are untouched and exposure numbers do not move. ✔
- **New `legal_parent` edges do not feed exposure.** `gate3-exposure.js` has no reference to `entity_relationships`, so the 1,027 edges change the Corporate Atlas hierarchy only. ✔
- **Visible effect on ETF/13F screens:** about 6–7k placeholder names (name = LEI) become real legal names where issuer names are shown. That is an improvement; tell the ETF UI owner in the close-out.
- **ETF PL: no objection to 011 rev 1.7.**

## 6. MA-OCT-013 brief rev 1.5: review (input to the 013 spec)

**What holds:** S1 (older, LEI-bearing row survives); the hard index precondition and the conditional `bond_issuer_link` precondition; the redirect table (Entities, 013 the only writer, rowid PK, no survivor index in v1); the batch invariants (redirect only if the survivor exists; delete only if the redirect exists; `INSERT OR IGNORE` on resume); rollback order; the pre-spec measurement (Ops N-7) with EXPLAIN-first and declared caps; ordering index → 011 → 013. The ENT-CR1 composite serves every `entity_id = ?` lookup unchanged, and its repoint cost of 2 writes per `instrument_entity_map` row matches ENT-CR1 §5.

**Required in the 013 spec (B13-1 to B13-3):**

**B13-1. Order the survivor-key update after the duplicate delete.** The pair line costs "update the survivor key (1 + normalized + autoindex)". The survivor's corrected key is exactly the key the duplicate holds today, and `entity_master` has `UNIQUE(normalized_name, type)`. So the survivor `UPDATE` **must run after the duplicate `DELETE`** in the same batch, as a CAS that also requires `NOT EXISTS (SELECT 1 FROM entity_master WHERE normalized_name = :new AND type = :type)`. The brief's batch order (redirect → repoints → delete) does not place this step. If the delete's CAS misses, the key update must not run.

**B13-2 (ETF PL). Merge, don't drop, colliding exposure rows.** `entity_exposure_monthly` has `PRIMARY KEY (report_month, entity_id, holder_entity_id)`. Where both twins carry exposure from the same fund in the same month, a straight repoint collides on the PK. The MA-SEP-001 precedent (`ma-sep-001-merge-migration.sql:52-64`) **deleted the duplicate's colliding row**, which drops its `weight_sum` and understates the issuer's exposure until the next full recompute. The 013 spec must either:
- **(a)** fold the duplicate into the survivor, `weight_sum = s.weight_sum + d.weight_sum` and `aum_weighted` likewise (NULL-safe), then delete the duplicate row; or
- **(b)** after the `instrument_entity_map` repoint, recompute the affected `(report_month, holder_entity_id)` pairs through the gate3 path, under its own read budget.

Either way, the pre-spec measurement must count **colliding rows separately** (R_collide), because their write cost differs (survivor `UPDATE` 1 + duplicate `DELETE` ≈ 3). Verification must show, for every affected `(report_month, holder_entity_id)`, that Σ `weight_sum` before (duplicate + survivor, from the pre-images) equals the survivor's value after. `fund_exposure_coverage` needs no change (its mapped weight already counts both twins). `entity_isin_map` (PK `(isin, lei)`) and `instrument_entity_map` (PK `instrument_key`) cannot collide on a repoint.

**B13-3. Match the index check to the composite.** With `idx_iem_entity_key (entity_id, instrument_key)`, `EXPLAIN QUERY PLAN SELECT instrument_key FROM instrument_entity_map WHERE entity_id = ?` reports `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)`. The brief's expected text, "`USING INDEX … (entity_id=?)`", is not a literal substring of a `COVERING INDEX` plan. The runner's precondition and the pre-spec measurement's EXPLAIN-first rule should **match on the index name** (`idx_iem_entity_key`) and accept `USING INDEX` or `USING COVERING INDEX`. A literal match could stop a correct run, or a loose one could pass the wrong index.

**Notes for the 013 spec (non-blocking):**
- **N13-1.** "Under the same gates as 011" should name them: rev 1.7 §4.3 including F-1..F-5 and fail-closed.
- **N13-2.** The pre-spec `SELECT entity_id, COUNT(*) … GROUP BY entity_id` chunks should EXPLAIN with no `USE TEMP B-TREE FOR GROUP BY` (the leading index column lets the GROUP BY stream). If one appears, the 9 Oct 2.5 × N rule applies to the declared cap.
- **N13-3.** The verification line "each check is an indexed lookup" is not true for `fund_entity_link` (no `entity_id` index); it is the ≈ 300-row pre-pass. Say so.
- **N13-4.** AR11-1's rollback-horizon line belongs in 013's ordering section too.

## 7. Cross-check with the Ops review (read after the verdict above)

Read after §0–§6 were written: `claude/MA-OCT-011_Ops_Review.md` `976f08379f3f8324bb8ea8eb37e74d1c61f6a86af4c4cb07c6596190d34428f9` (Ops PASS WITH NOTES: R-1..R-4, N-1..N-6). **My verdicts are unchanged.**

| Mine | Ops | Concordance |
|---|---|---|
| AR11-2 (E-4 has no real trigger; first A batch adjudication; RA-12) | R-1 (a) ≥ 15 A rows in the Fri 16 freshness gate as an identity check before any A write; (b) E-A only after every A read-back passes; (c) ≥ 10 A rows in the post-run API checks | **Found independently; compatible.** Ops' (a) catches problems earlier; my 50-row adjudication of the first A batch is the stronger identity test. **Recommend the build brief takes both**, with RA-12 as the response to any trigger (E-4 itself says A continues only under the Architect's ruling). |
| AR11-1 (rollback valid only until 013 starts) | R-2 (keep pre-images, plan, checkpoints, run log ≥ 30 days and until 013 closes) | **Complementary.** R-2 keeps the inputs; AR11-1 says when they can be used alone. |
| — | R-3 (013 writes the 9 deferred LEIs from an exported payload, not from a deleted `gleif_006.db`) | **I concur.** Add it to B13-1..B13-3 as a fourth 013 spec item. |
| — | R-4 (daily reconciliation mechanics; an unsigned day blocks the next day's first batch) | **I concur.** |
| RA-13 (K-1..K-5, the secret change) | N-1 (Ops authorises, LANE-1-ENG executes; the secret change needs Architect review) | **RA-13 is that Architect review.** K-1 and K-3 are worded to match N-1. |
| — | N-2 (`expected_max_duration_s` per batch, e.g. 900 s), N-3 (change freeze 17–23 Oct on `meridian-ops` and Entities Workers), N-4 (full rollback is a Founder decision) | **I concur with all three.** N-3 also protects RA-13's K-4 test result. |
| N13-1, N13-2 | N-6, N-5 | **Same points.** |
| B13-1, B13-2, B13-3; N11-1 | — | Not in the Ops review. **Still required / still noted.** B13-2 is the ETF PL's main finding on 013. |

## Rev check — 011 rev 1.9 / 013 rev 1.7 (10 Oct)

```text
ISSUED BY:    Main Lane — MA-OCT-011.ARC Control v1 b7c8eaefc9cb1050135ed692d89fff3585386d68240a271a3247af1070d2b6b8
              Task v1 ad8a51b39f8d90196fae8fb4f96d4eb5f04218e25014299869d836d59984bb47
EXECUTED BY:  REVIEW-A (independent Architect + ETF PL), Sat 10 Oct 2026, doc-only
APPROVED BY:  Founder (12 Oct gate)
INPUTS:       claude/MA-OCT-011_Spec.md rev 1.9        e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22
              claude/MA-OCT-013_Spec_Brief.md rev 1.7  a79bb98b7c0966bb6de2d16594208c041f033673992e9663f8806214700613de
              this review (before this section)        d097e6f90b7b158e4233f52ae8eb8952bb162fd8d7822ebe5836061610037679
              claude/relays/LANE-11_REPORT.md          755d252379777b5fb82bf25564a2a3e54f426d19ce648280c62181ef06939bf0
              (all re-hashed on disk before reading; all match. HEAD 16918e0, no .git locks)
VERDICT:      PASS WITH NOTES. All seven listed findings MET. Nothing blocks the 12 Oct GO decision.
```

**Independence.** I did not write 011 rev 1.9, 013 rev 1.7 or the LANE-11 report. The findings checked here are my own (§3, §3a, §6 above) plus RA-14 as logged by the Main Lane (Decisions Log, 9 Oct).

**Scope.** Only the listed IDs, checked against the text. No whole-document re-review. 0 D1 reads, 0 D1 writes, no git writes.

| ID | Requirement (short) | Result | Where it is met |
|---|---|---|---|
| **AR11-1** | Rollback horizon line in 011 §10, and the same line in 013's ordering section | **MET** | 011 §10 "Rollback horizon (Architect AR11-1)" (line 556), verbatim. 013 "Ordering relative to 011", "Rollback horizon (AR11-1 / N13-4)" (line 168), verbatim. |
| **AR11-2 / RA-12** | A pilot = first A batch Wed 21 (≤ 250), hold, ≥ 50 rows adjudicated 50/50 by the Data-Identity Lead with an Ops spot-check, executor not adjudicating; §9 diff not an identity test; on any wrong T1 match A stops, batch restored, resume only on a bounded excludable cause + re-hashed plan + fresh 50/50, else A defers after 013 and B + C stand | **MET** | 011 §3.1 E-A row, E-4 "one rule" (line 146): triggers (a)–(c), response RA-12 and sequencing all match. §4.4 "A pilot and E-A sequencing" (line 361): Wed 21 pilot plus hold. §9 (lines 501, 521): Sat 17 holds no A rows, and the sampled diff is "execution, not identity". §11 E-4 criterion (line 583). Ops R-1 (a)/(c) are merged in, as §7 above recommended. |
| **RA-13** | New `OPS_INGEST_KEYS` emitter under K-1..K-5 | **MET** | 011 §7 CR1 (lines 474–479): K-1..K-5 match §3a, including "old list plus one" and "new `meridian-ops` version recorded". §11 ingest-key criterion (line 584): K-1..K-4 met before the pilot, K-5 recorded at close-out. |
| **RA-14** | (as logged 9 Oct) AR11-1 / AR11-2 on disk before the Fri 16 release check; nothing blocks 12 Oct | **MET** | Both are on disk in rev 1.9 `e09c01b9…2d22` as of 10 Oct, ahead of 16 Oct. See note RC-1 on the label. |
| **B13-1** | Survivor key `UPDATE` after the duplicate `DELETE`, as a CAS with `NOT EXISTS` on `(normalized_name, type)`; does not run if the delete missed | **MET** | 013 batch order, step 4 (line 105). It is self-enforcing: if step 3 missed, the duplicate still holds the key and the `NOT EXISTS` guard fails. It is resume-safe under the same CAS. |
| **B13-2** (ETF PL) | Colliding exposure rows merged, not dropped, by (a) fold or (b) gate3 recompute; R_collide counted separately; Σ `weight_sum` invariant in verification | **MET** | 013 "Colliding exposure rows are merged, never dropped" (line 109): (a)/(b) as written, NULL-safe. Pre-spec measurement "Output" row: R_collide at 1 + ≈ 3 writes. Verification "Σ-weight invariant" (line 124). See note RC-3. |
| **B13-3** | Index check matched by name `idx_iem_entity_key`, accepting `USING INDEX` or `USING COVERING INDEX` | **MET** | 013 hard precondition (line 64), with the reason. The pre-spec "EXPLAIN first" row matches by name for all four tables, and N13-2's temp-B-tree note is added. |

**Notes (non-blocking; none reopens a finding):**

- **RC-1. RA-14 label.** The 9 Oct Decisions Log defines RA-14 as the deadline ruling (AR11-1 / AR11-2 due before Fri 16; nothing blocks 12 Oct). 011 rev 1.9 uses "RA-14" for the 50/50 adjudication requirement (§3.1 E-4, §4.4, §11). The content is right, because 50/50 is part of AR11-2, but the cross-reference points at the wrong ruling. Relabel to "AR11-2" at the next revision, or have the Main Lane note the alias. No effect on the plan.
- **RC-2. 013 rollback order is the mirror of B13-1 (for the 013 spec).** The rollback re-inserts the duplicate (step 1) **before** restoring the survivor's old key (step 2). After a merge, the survivor holds the duplicate's key, so step 1 would hit `UNIQUE(normalized_name, type)`. The 013 spec should restore the survivor's old key first, as a CAS on its post-merge key, then re-insert the duplicate, then restore links, then delete the redirect. This is outside the listed IDs, so it is noted, not required here. It belongs with B13-1 when the 013 spec is written.
- **RC-3. Σ invariant covers `weight_sum` only.** Under option (a), `aum_weighted` is folded too. The 013 spec's verification should state the same invariant for `aum_weighted` (NULL-safe).
- LANE-11 Q1 (N11-1 heartbeats) is answered by Main Lane ruling ML-0910-1 and is with MA-OCT-011.OPC. LANE-11 Q2 (the 07:55–08:05 bootstrap freeze) is for the Fri 16 release check. Neither is in this packet's scope.

**ETF PL.** B13-2 is met as written. With RC-3, my main 013 concern is fully covered. No objection to 011 rev 1.9 or 013 brief rev 1.7.

## Rev 1.10 delta check (15 Oct)

```text
ISSUED BY:    Main Lane — MA-OCT-011.R110R Control v1 aca097ac537e37ee1afa63b84dfe65fcf5e7df0dd72d6b57dacdbe8ea09248d0
              Task v1 f396fe0939ebdab979ae0e634dad3b871335b4f7310fd055dc5fda777f8977c3 (both re-hashed; match STATUS_BOARD)
EXECUTED BY:  REVIEW-A (independent Architect), Thu 15 Oct 2026, ≈ 05:45 UTC, doc-only
APPROVED BY:  Founder
INPUTS:       claude/MA-OCT-011_Spec.md rev 1.10           6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa
              claude/packets/MA-OCT-011_Spec_rev1.9.md     e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22
              claude/packets/MA-OCT-011.R110_Report.md     455cf4e00788403301adea11b91521180679ecf2d51f6132e3d03979b54e2f71
              this review (before this section)            251ae4fca56a0600e8e865255a648a21261ccf2fa04498faa0f7924ca46d0904
              (all re-hashed on disk; all match. diff -U0 = 43 hunks, as reported. Branch October-2026, HEAD 3960aee, no .git locks.)
              Read for context: Decisions Log 10/12/13/14 Oct; GATE-1012_Decision.md a9ddd037…e9a; 011 BUILD report;
              runner App/Corporate Atlas/scripts/gleif-reconcile-011.mjs and lib/…-core.mjs (read only).
VERDICT:      PASS WITH NOTES. Nothing blocks the Sat 17 pilot (it holds no A or ECA rows).
              RA-15 (ruling below) and R110R-B1 (runner) must be settled at the Fri 16 release check, before the first A batch.
              R110R-1 (§9 basis) must be settled before the Fri 23 verification.
```

**Independence.** I did not write rev 1.10, the R110 report or the build. The findings checked in item 6 are my own. 0 D1 reads, 0 writes, 0 GLEIF calls, no git writes.

### 1. F-2: P/A overlap (P 308; ECA 45 after A; 6 deferred)

**Sound, and the right ruling.** The rejected alternative (P 365, withhold 51 A rows) would break one-row-per-LEI and hand 013 51 avoidable merges. Under F-2 the parent of those 45 edges is the existing operating row, and its `type` is untouched (§5 criterion 5). That is better identity than a new `holding` stub. "New duplicate LEIs = 0" in §9 is now the check that proves it.

- **Arithmetic** (re-run): 365 − 51 − 6 = 308. 680 + 45 + 3 = 728. 680 + 45 + 298 = 1,023, and 66 + 1,023 = 1,089. §4.2 lines sum to 88,510. f′ −12 and f″ −627 give a reconciliation of −11,863 with 0 residual (100,373 − 88,510). Expected 85,862, range 86,406 to 83,238, partial GO 56,268 / 53,620, Option 2 ≈ 9.2k, rollback 87,250 / ≈ 84.6k. Sat ≈ 4,573, Tue ≈ 22,758, Thu ≈ 13,606, each ≤ 25k. ✔
- **45 edges for 51 parents.** This is consistent with Q48's parent set including ultimate-only parents, which get no direct edge under L11-9. I did not re-derive it; the build reproduces it from the plan.
- **E-2:** kept. An ECA edge is written only if its parent's A write was `applied` (runner E-2 filter, `depends_on`). ✔
- **E-4:** kept in substance, but only half-stated. §3.3 says ECA is "blocked by E-4 exactly like E-A", and §4.4 puts ECA under the E-A sequencing gate. §3.1 E-4's *response*, however, names only E-A: "batch restored with its E-A edges", and "E-A edges already written are deleted".

  An ECA edge depends on the A row's identity as the **parent**. If an A batch is restored after ECA ran, which trigger (c) at the post-run spot checks allows, the edge would still assert `legal_parent` onto an operating row that no longer carries that LEI. → **RA-15** below.
- **§10 rollback order** Q → E-A → ECA → A → E-C → … → B → P is correct. Both edge sets are deleted before A's pre-images are restored, and E-C before P. The build's `RESTORE_ORDER` matches.
- **Transient (note N110-6):** the 45 children's `direct_parent_lei` mirror is written on Tue 20 (C) but names an LEI that no row holds until A writes it (Wed 21–Thu 22). If A stops, the mirror stays that way, which is the same state as the 215 deferred A edges and the 6 deferred parents. That is acceptable, because mirrors are strings. List them in the hand-off.

**RA-15 (Architect ruling; binding through the Main Lane; no spec revision needed).** For E-4 and §4.4, **ECA is treated exactly as E-A**:

- **(a) Sequencing.** ECA runs only after every A batch's read-back diff has passed, the A-pilot adjudication is 50/50, the Operations Lead's release is given, and no trigger is open.
- **(b) Response.** Whenever A stops, ECA is dropped for the rest of the run with E-A, and any ECA edges already written are deleted.
- **(c) Per-batch restore.** Restoring an A batch first deletes every E-A edge whose **child** is in that batch and every ECA edge whose **parent** is in that batch, then restores the A pre-images. This mirrors §10.

Fold the wording into §3.1 E-4 only if a later revision happens anyway.

**R110R-B1 (runner; for the Fri 16 release check; Engineering Lead with the Operations Lead).** I read this only; I did not change it. In `gleif-reconcile-011.mjs` `abGate` (≈ lines 298–327), ECA is stopped by `holds/e4-trigger.json`, and E-2 applies to it. But the E-A sequencing gate (every A checkpoint passed, `--a-adjudication`, `--ea-release`) and the drop (`--drop-ea` / `ea-dropped.json`) apply to `EA` only. Either:

- extend both to `ECA`; or
- record at the release check an operating rule that ECA batches are invoked only under the E-A release and are dropped with it, and give `restore --batch` of an A batch a procedure for the ECA batches holding that batch's parents.

### 2. F-1: E-A 298 and the edge arithmetic

**Correct.** 298 + 1 + 215 = 514 (Q51). The one edge (child 99231 → wrong-LEI parent `549300CZ8QS1GE53O776`, RC-12) is the E-1 exclusion working as written: listed, not written. −4 writes. Direct edges 1,023; `legal_parent` after the run 1,089. ✔ The "5 parents held by more than one row" were artefacts of F-2's double claim, so E-1's multi-row exclusion now has nothing to exclude.

### 3. F-3: read restatement (≈ 290k), design view only

**No architectural objection.** 74k + ≈ 140k + 74k ≈ 288k. ≈ 25.5k statements × 5–6 reads is ≈ 140k. Every execution stays ≤ 1k reads, far under the 50k single-execution rule. The run is ≈ 5.8% of one day's 5M cap, spread over 8 days. Even the 2×-export case (≈ 436k) is ≈ 8.7% of one day.

The index audit is unaffected: the 2× is D1's billing for `IN (…)` point lookups, not a plan change. The ceiling is the Operations Lead's ruling (MA-OCT-011.OPSR). Two design suggestions only:

- pre-state the ceiling for the 2× case now, so the Sat 17 pilot does not wait on a re-ruling;
- extend §6 (ii)'s "> 20% above plan → recompute" rule from writes to reads.

### 4. OQ-3 / 4 / 5 / 6 / 12: no architectural objection

| OQ | Comment |
|---|---|
| **OQ-3** | Accepted. Live Phase 3 writes a single token (`entities-enrich.js` ≈ line 461), so the column will hold both forms. Splitting on `\|` reads a single token as a list of one, so readers are safe. The `\|` in §3.5 is Markdown escaping: the stored value has **no backslash** (the build should confirm in its tests). |
| **OQ-4** | Accepted. It keeps §9's diff exact. The mirror name may differ from the parent row's `name` until B hydrates it; that is expected. |
| **OQ-5** | Accepted, with **note N110-2**: `entity_master.updated_at` has `DEFAULT CURRENT_TIMESTAMP` (`migrations/corporate-atlas-v1.sql:15`). The 308 P inserts will therefore carry insert-time `updated_at` unless the INSERT supplies a value. Read "never writes" as "never sets; P inserts take the column default". Tell the Operations Lead, so 002's drift input expects 308 new rows dated the pilot day (attributable by `gleif_enrichment_version = 11`). Also say in the close-out that consumers find 011's changes by `gleif_enrichment_version = 11`, not by `updated_at`. |
| **OQ-6** | Accepted. An A row whose `lei_status` is already non-NULL keeps its old status beside the new LEI. Report the count at close-out. |
| **OQ-12** | Accepted. Report-only, and never a write input. |

### 5. Loose ends

**Q3: §9 "LEI-bearing rows 16,627 + 3,677 = 20,304" → R110R-1 (doc-only, before Fri 23).** The figure is right **only on the D2 basis**: the 43,998 `entity_id`s of the 29 Sep export, the same basis as Goal 1's "37.8% → about 46.1% of D2" (20,304 / 43,998 = 46.15%).

§9 says the checks are "computed locally from a fresh export". Every P row carries its LEI, so a table-wide count would be **16,627 + 3,677 + 308 = 20,612** (± drift), and a correct run would miss 20,304. State the basis in the row: "LEI-bearing rows among the D2 `entity_id`s: **20,304**; plus the **308** P rows (`gleif_enrichment_version = 11`, `type = 'holding'`) = **20,612** table-wide, ± drift." The Main Lane may record this as a ruling instead of a revision.

**Q5: §5 criterion 4. No inconsistency. The governing text is:**

- **(i) The gate.** §5 row 4's **"Proposed wording" column** (amended criterion 4) plus row "4 (N-4)"'s added clause, which the Founder accepted at GATE-1012 **D1 A** ("accept the amended §9.2"; GO on rev 1.9). §5 is **byte-identical** in rev 1.9 and rev 1.10 (checked).

  "≤ 60k in total, ≤ 20k per day" (line 410) is the **"Original wording (006 §9.2)" column**. It is history, kept to show what 011 breaks, and it does not govern. The R110 report and the 13 Oct log line call it the "approved wording"; that is a mislabel.
- **(ii) The limits.** Rev 1.10 satisfies all of them: 88.5k / 85.9k ≤ 95k total, ≤ 110k ceiling, ≤ 25k per day. ML-1012-1's **60k** account ceiling tightens the amended text's "≤ 70k", so it is consistent. The figure applied is the one in §4.3.
- **(iii) The declared figures** inside the amended text (rollback ≈ 88k / ≈ 85k; partial GO ≈ 57.1k / ≈ 54.4k; Option 2 ≈ 10.0k) are rev 1.9 declarations. Rev 1.10's figures are all **lower** (87.3k / 84.6k; 56.3k / 53.6k; 9.2k), so no gate is loosened. §4.2b, §4.2c, §10 and §15 govern the numbers. No re-approval is needed.

**013 (LANE-11 Q4; for the 013 spec, not ruled here).** The 51 parents are A rows written on the survivor side (L11-7 i–ii), so S1 keeps them and 013's twin deletions leave the ECA edges intact. The 6 T1_LAPSED identities get no 011 write. The 013 hand-off should carry both lists (51 / 45 and 6 / 3).

### 6. Earlier findings: none weakened

| ID | Rev 1.10 | Result |
|---|---|---|
| AR11-1 | §10 rollback horizon unchanged, verbatim | **Not weakened** |
| AR11-2 / RA-12 | E-4 row unchanged. A pilot, 50/50 hold, "A stops" response and B + C standing all intact. ECA added under E-4 (§3.3, §4.4); the response wording is extended by RA-15 | **Not weakened**, and extended |
| RA-13 | §7 K-1..K-5 unchanged (T12's single put for 011 + 008, "old + 2", is within K-3 and §3a's last line) | **Not weakened** |
| RA-14 (alias ML-1010-1) | Unchanged | **Not weakened** |
| B13-1..B13-5 | 013 brief unchanged (`a79bb98b…13de`). F-2 creates no new twins. Fewer P rows means fewer potential merges | **Not weakened** |

### Notes (non-blocking)

- **N110-1.** Stale text: §3.1 E-3 still reads "25 of the **299** E-A edges" (line 147; §9 and §11 say 298). §4.4 (line 388) ends "otherwise **E-A** is held", where it should say ECA and E-A. Tidy at the next revision.
- **N110-2.** `updated_at` default on P inserts (§4, OQ-5 above).
- **N110-6.** Transient and parked parent mirrors (§1 above).
