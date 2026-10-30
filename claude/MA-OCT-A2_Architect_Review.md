# MA-OCT-A2 spec rev 0 — Architect Review (REVIEW-A)

```text
ISSUED BY:    Main Lane — MA-OCT-A2.REVA Control v1 bf6ed3e47ed4fccde717c0957a56d8d54696bed3962c8e56fedf6cf3953f51aa
              Task v1 a530cec1706debc0bf4b7283682eccdebad98127862f3c3c8733c455464b4724 (both verified)
EXECUTED BY:  REVIEW-A (Architect), Thu 29 Oct 2026, doc-only. 0 D1, no deploys, no git writes, no secret files.
INPUTS:       claude/MA-OCT-A2_Spec.md rev 0 226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d ✔
              claude/packets/MA-OCT-011.DIL29_Report.md 958421159b2836b743400ba520552f71d20cb0033f7c0c22069d832d875737e6 ✔
              011 code @ 58cd922: core 830b49a8 · runner 29300a0e · plan 02ac8c67 · verify b887e2f9 · tests 962cef28 ✔ (= spec §0)
              gleif-011: A2_exclusions_DIL.json ac1c1572 · a-deferral-list 86ec9d99 · handoff-013 0597e15d · e4-trigger 7e3c9153 ·
              ea-dropped b9e18517 · exceptions-closeout 7fe7eb2f ✔.  FREEZES.json on disk 9c368fa6… (spec pins b6d035f6…; see M-6)
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 7 MUST-FIX before run, 7 NOTES.
              The matcher fix is correct against DIL29. Budgets, domain, three-point check, rollback and the 013 hand-off hold.
              M-1 is a run-stopper as committed: the runner would refuse every A2 batch because of the A2 freeze window's name.
```

**Independence.** LANE-11 wrote the spec and the DIL29 lists, and LANE-11-ENG wrote the 011 code. I wrote none of them. My earlier 011 rulings (RA-12, RA-15, C-1′, C-2, CLOSEREV-ARC §3) are referenced, not re-reviewed.

## 1. Task checks

| Check | Result |
|---|---|
| **Domain and ownership** | **MET.** A2 writes `entity_master` (Level 1 + mirrors on no-LEI rows), `entity_relationships` (ECA/E-A, insert-only) and `entity_enrichment_queue` (Q), all Entities. Ops is reached only through the ingest API, and the job registry row is written by Ops itself (C-2). No ETF or cross-domain table. |
| **Reuse of committed 011 code (`58cd922`)** | **MET.** All 5 hashes equal spec §0. C-1..C-6 are minimal and fit the code: `WORK_DIR` already reads `GLEIF011_WORK_DIR`; the read ceiling, holds and ledger are per work dir. **Missing: C-7 (M-1) and the full C-2 coverage (M-5).** |
| **Read budget** | **MET.** ≈ 74k export + 15 × 1,510 (A) + 0.3k + 1.8k + 15 × 1,510 (Q) + 75k post ≈ 195k ≤ the A2 ceiling of 250k, with a fresh `since`. Fri ≈ 90k and Sat ≈ 110k, each ≤ 200k/day. Every execution is ≤ 5k (keyset pages) or ≤ about 1.5k (batches), far under 50k and under the core's 45k. 011's 247,468/350k is closed and correctly not carried over. |
| **Write budget and batching** | **MET.** A 3,648 × ≈ 6.29 ≈ 22.95k; ECA 176; E-A 1,184; Q 7,296; ≈ 32.6k with events. Batches of ≤ 250 statements, as one execution each, under the B-1..B-5 rules. **Fri ≈ 11k, Sat ≈ 21.6k, both ≤ 25k own per day.** Account ≤ 60k at every check (F-5). The 100k account cap is respected with the other Entities writers frozen. |
| **Freeze windows** | **Not met as committed. See M-1 and M-6.** The windows are right and the dated A2 window is on disk. But the runner exempts only `'011 run window'`. |
| **Three-point check** | **MET** (unchanged from 011; P-1 SQL set reused):<br>- A is a CAS `UPDATE … WHERE entity_id = ?` (INTEGER PK) with `NOT EXISTS (… lei = ?)` on `idx_entity_master_lei`;<br>- Q is a PK `UPDATE`; ECA and E-A are `INSERT OR IGNORE` on the PK;<br>- pre-image and read-back are PK / `idx_entity_master_lei` `IN` lists;<br>- exports are rowid keysets.<br>No new SQL pattern: the exclusion rules run in the plan generator, not in D1. Re-run P-1 (EXPLAIN set, `sql_sha256` unchanged) on the A2 plan at G-4. |
| **Acceptance criteria and spot checks** | **MET.** AC-A1..AC-A9 cover execution (read-back 0 mismatches, 200/200 sampled diff), invariants (0 overwrites, 0 writes to excluded rows, 0 `updated_at`), identity (pilot 50/50, G-2), freshness (≥ 10 real API spot checks, CLOSEREV-ARC D-1) and budgets. See N-1 on drawing the API sample. |
| **Rollback manifest** | **MET, with M-4.** The retained-file manifest is re-issued when files grow (the CA-1 lesson ✔). Restore order Q → E-A → ECA → A matches the runner (RA-15 (d) ✔). 011's `gleif-011/` stays untouched ✔. **The horizon versus restore duration is not stated (M-4).** |
| **`gleif_006.db` retention** | **MET.** Kept until A2 closes (ML-1025-5). See N-6 for the deferral case. |
| **A2 → 013 hand-off** | **MET.** A2 writes only the older (S1-surviving) side; the 392 newer twins are never targets. 013 is planned from a **post-A2** export and starts only after the A2 close-out. E-X2 withholds go to 013 as duplicate-identity inputs. E-A parents are LEI-bearing, so no edge lands on a twin. CLOSEREV-ARC 3.5(a)/(b)/(c) are all honoured. |

## 2. Matching rules vs DIL29 (Architect focus)

**Correct.** I checked each list against its verdicts:

- **Every row DIL29 calls wrong is excluded.**
  - 17 from the 29-row list: 483, 517, 2303, 3262, 14771, 14864, 15441, 15538, 15589, 86996, 87094, 87745, 99017, 104374, 106235, 107708, 458583.
  - 6 from the extended list: 49221, 99194, 106283, 106444, 109643, 111083.
  - 3 FUND-only: 2488, 94734, 98894.
  - That is **26**, plus review 100695 and conservative 103765, giving the **28** union. Union arithmetic: 24 + 1 + 5 − 2 overlaps (2488 R-CUR∩R-FUND; 106444 R-LF∩R-FUND) = 28.
- **Every row DIL29 calls fine is kept by the rule as defined.**
  - The previous-name test keeps the renames and conversions: 1156, 1275, 1337, 30897, and the 7 PLC→Limited re-registrations.
  - `PUBLIC LIMITED COMPANY = PLC` keeps 371 and 103782.
  - Form-less truncated names are not compared (the 8 bond-issuer names).
  - Exact-name FUND matches stay: 37, including the two category anomalies 30563 and 106031.
- **87745 (SPAC trap)** passes the previous-name test, so only the explicit deny catches it. That is correct, and it is the one ID-level element of the "coded rules".
- **The STOP rule** makes the generator prove equality with `A2_exclusions_DIL.json` (24/1/5). Because A2 never re-matches names (the A base is the fixed 006 T1 set), the fresh export can only remove rows. Equality is therefore the right test: a rule that drifts stops the plan.
- **Idempotency:** unchanged and sound. Every statement is CAS or `INSERT OR IGNORE`, the plan is SHA-pinned, the cursor resumes, a re-run writes 0, and C-4's runtime assertion makes excluded IDs unrenderable even if a plan were edited.
- **Failure modes:**
  - 7403/7009 are handled by P-3 / B-1..B-5 (no blind re-send; guarded read-back; failed checkpoints kept; restore before re-run).
  - A live writer racing a CAS is listed as `raced`, never clobbered.
  - A live `holding` row taking an A LEI is withheld by W1-A at write time.
  - The frozen window removes the OTP-Bank race at the source.

## 3. Findings

### MUST-FIX before run

- **M-1 (§4, §6) Run-stopper: the own-freeze exemption is hard-coded to 011.**
  - **The problem:** core `58cd922` sets `OWN_FREEZE_PREFIX = '011 run window'` (core:123–125: "The dated '011 run window' freeze applies to the OTHER Entities writers, not to 011 itself; every other window … blocks a batch start"). The new dated window is named **"A2 run window — other Entities writers frozen (Founder A2 Q2, ML-1029-2)"**, Fri 30 08:05Z → Sun 1 00:10Z, which is the whole A2 run. **The runner will refuse every A2 batch.** It fails closed, so no harm is done, but A2 cannot run. `--ignore-calendar` is local-only, correctly.
  - **Add C-7:** make the own-window prefix configurable (`GLEIF011_OWN_FREEZE_PREFIX`, default unchanged). Set it to `A2 run window` in the A2 environment.
  - **Tests:** the A2 window does not block A2; any other dated window still blocks; recurring windows still block.
- **M-2 (§7 G-2) The two-stage sample does not deliver the stated 95% confidence.**
  - Each fixed-n bound is right on its own: 0/150 → 98.02%, 1/237 → 98.01% (re-computed).
  - **The problem:** used together (stop at 150 with 0 errors, else extend to 237), a matcher whose true precision is exactly 98% passes **7.4%** of the time (0.0483 + 0.0255), not ≤ 5%.
  - **Fix:** choose **one fixed design before drawing**. Recommended: **n = 150, 0 errors, and any error → STOP** (Founder Q3 then defers A2). Alternative: n = 237 with ≤ 1 error, drawn whole up front.
  - Either way, an error that reveals a new matcher class is an automatic STOP.
- **M-3 (§7 G-2) Independent check on G-2.** The Data-Identity Lead both wrote R-LF/R-CUR/R-FUND and adjudicates G-2. Since criterion 3 is the Founder's GO evidence, add an **Operations Lead (or second-reader) spot-check of ≥ 15 of the 150**, the same pattern as the pilot's Ops spot-check. Record both names in the G-2 file.
- **M-4 (§9, §5) Restore duration versus the horizon.**
  - **The problem:** a full A2 restore is ≈ 32k writes, more than 25k/day, so it needs **≥ 2 run days**. Sun 1 is no-write, and the horizon ends at 013's first write (Mon 2 ≥ 08:00Z).
  - **Fix:** state that if a full restore is ordered, **013 is held until the restore completes and is verified** (Founder decision). Otherwise the restore must fit inside Sat's remaining headroom.
  - A pilot (per-batch) restore is small and unaffected.
- **M-5 (§4 C-2) `JOB_ID` has three uses, not one.**
  - It feeds the run-event payload (runner:99), the **R-4 recon query** (core:494, `FROM ops_job_run WHERE job_id = '${JOB_ID}'`) and the recon manifest (runner:882).
  - C-2 must make all three take the configured id. Otherwise the Operations Lead's daily R-4 sign-off reconciles 011's job, not A2's.
  - The new emitter key goes in `~/MeridianAtlas-work/gleif-a2/ops-ingest.env`, mode 600 (K-1..K-4).
  - **Test:** a local-transport run emits `manual.gleif-reconcile-a2`, and `recon` selects that job.
- **M-6 (§0, §6) Re-pin FREEZES.** The spec pins `b6d035f6…`; on disk it is now **`9c368fa6…`**, with the A2 dated window added (expected under G-5). Record the new SHA at G-5. The runner stamps `freezes_sha256` into each checkpoint, so a later change is visible.
- **M-7 (§4 "reused as-is") Carry the runner operating rules into the A2 run Control.** These still apply to this code (P3R, B4R):
  - **C-1′ (a):** no `restore --all` while a `readback-pending` hold exists.
  - **C-1′ (b):** a restore-mode pending read-back is cleared by re-running the restore, then a logged manual hold removal.
  - **C-1′ (c):** any `failed` batch with applied or unknown rows ends that UTC day's forward run after its restore.
  - **C-2:** a `RUNNER ERROR` with no checkpoint means stop, no re-run.

### NOTES

- **N-1 (§3, AC-A5).** Draw the FG sample so that ≥ 10 rows will actually be **applied**: exclude E-X1 up front, and top up if withholds or races take a row out. AC-A5 needs post-write rows.
- **N-2 (§2).** Keep R-LF/R-CUR/R-FUND permanently in the GLEIF matcher (DIL29's KI 22.44 note). The SPAC deny is an ID list today; a heuristic is a November item.
- **N-3 (§2).** R-LF excludes 103765 (Versigent) conservatively. That is correct to list, and it can be released by a later Data-Identity Lead packet.
- **N-4 (§3).** Wording: the last sentence of the FG paragraph ("The GC values are written as they are …") reads as if it follows STOP. It describes the PASS path. Note that `gleif_last_updated` = run time is 011's provenance meaning (write time), while `lei_last_updated` keeps the GC record date, as the plan code shows. That is consistent.
- **N-5 (§7 G-4).** Report the E-X2 withhold count at G-4. If it is large (for example > 2% of A), the Data-Identity Lead should look before GO, since it measures how much live Phase 3 has already pre-empted.
- **N-6 (§13).** If A2 defers to November (Q3), retention of `gleif_006.db` needs a new end date set by the Founder (CLOSEREV-ARC §4 suggested ≤ 30 Nov).
- **N-7 (Control).** The A2.REVA Control's "Stop point" text ("production steps by 23:45Z … roll back by recorded version id") is run-packet boilerplate and does not fit this doc-only review. I followed the Task. Main Lane: fix the template.
