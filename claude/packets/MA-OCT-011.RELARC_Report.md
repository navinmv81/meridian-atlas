# MA-OCT-011.RELARC: Architect release review of the Fri 16 plan (Report)

```text
ISSUED BY:    REVIEW-A (Architect), Fri 16 Oct 2026, ≈ 21:25 UTC
EXECUTED BY:  Architect (REVIEW-A). Read-only local-file review: 0 D1, 0 GLEIF, no deploys, no git writes, no code run
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (release approval, Sat 17)
CONTROL:      v1 ba23017db39942eae9736d974f81fa634c65e04d5dc5e6d74c03755fd6b76ac7 (matches STATUS_BOARD row 39)
TASK:         v1 a2a0bdaab4b3cdfa03fe82ed5128967989616387cb35025e64d2387573272951 (matches the Control)
PREREQUISITE: MA-OCT-011.FRI shown CLOSED / verified on the board (row 37, 21:00Z) ✔
VERDICT:      PASS WITH NOTES. All six checks hold. One pre-pilot action (N-1, a re-run of the 0-read EXPLAIN set on the release plan) and seven notes.
```

## 0. Evidence and method

| Input | SHA-256 on disk | Matches |
|---|---|---|
| `packets/MA-OCT-011.FRI_Report.md` | `8a3385c60dcf72741c0deabfb0dddb919300ae3a375122ac15cc5bef078534ec` | board ✔ |
| `MA-OCT-011_Spec.md` rev 1.10 | `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa` | Task ✔ |
| `MA-OCT-011_Architect_Review.md` | `35eb3f274dbd8727ecd9eb110e855a2702b91bd59683a8236148a8e0cc8a7633` | Task ✔ |
| `packets/MA-OCT-011.OPSR_Report.md` | `87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f` | Task ✔ |
| `packets/MA-OCT-011.R110R_Report.md` | `29ad19df209b7b71783ca65bd7cafbf5cb601a3326c953a919144dc77563df92` | (no hash in the Task) |
| `MA-OCT-006_classification.csv` (006 FINAL) | `cb3b3a841147235d0d2189fec0fba481758676602015d62cc49ae9babc13df64` | plan `basis` ✔ |
| Runner / core / plan / verify / tests (FRI versions) | `ce1e6623…` / `830b49a8…` / `02ac8c67…` / `c4c287d6…` / `efd206a0…` | FRI report ✔ |
| Plan file, exports, `read-ceiling.json`, freshness, dry-run and ledger files in `~/MeridianAtlas-work/gleif-011/` | all 15 hashes in FRI §Artefacts re-computed | **15/15 ✔** |

**Access and scope**
- The Founder granted read access to `~/MeridianAtlas-work/gleif-011` for this review.
- I did not open `ops-ingest.env` or any secret.
- Repo HEAD `0dd7ef0`, branch `October-2026`, no `.git/*.lock`.

**Method.** Independent Python reads of `plan.json` (25,123 statements in 106 batches). I joined them to the 006 FINAL classification and to the plan's own `exceptions.json`, `review-lists.json` and `handoff-013.json`. I also read the runner's gate and restore code and the test list.

**Independence.** I did not write the plan, the runner or any input to them. In this chat I also signed 008 AC17 as the 008 spec owner, which has no bearing on 011.

## 1. Plan integrity: PASS
- `plan.json` = **`e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8`**. It matches `plan.sha256` and the FRI report. `releasable: true`; 106 batches; it cites rev 1.9 and rev 1.10 (governing).
- `plan.export` = `{kind: "fresh"}`. Its three SHAs equal the fresh files on disk:
  - `entity_master.jsonl` `b7aa0122…`;
  - `queue.jsonl` `1190b55f…`;
  - `relationships.jsonl` `5cd873c4…`;
  - manifest `6ce3fcf6…`.
- **Built from the 16 Oct export, not the 29 Sep D2.** D2 appears only under `basis`, as the 006 traceability basis, with `verified: true`.

## 2. N-2 tier tags: PASS
- **25,123 statements, 0 untagged.** Every tag is a high tier:
  - `A:T1-high` 3,676; `A-L2:T1×RR/RX-high` (L11-16);
  - `B:hydration-high` 5,823; `B:reason-(b)-high`;
  - `C:RR-parent-high` 806; `CR:reason-(b)-high` 9,952;
  - `RC15:name-high` 859; `EC:RR-direct-high`; `EA:T1×RR-direct(E-1..E-5)` 298;
  - `ECA:parent-created-by-A(F-2)` 44; `P:RR-parent-high` 304; `Q:follows-A-high` 3,676.
- **Joined to 006 FINAL, independently of the generator's own assertions:**
  - Every A row's `lei` classification is category `d`, **high**, and the written LEI appears in that row's evidence. That excludes T1_LAPSED 1,342 and T1+/T1c (medium; 2,591 medium rows including N+).
  - No B, C or CR statement writes a parent or exception field whose 006 row is medium. That excludes D5-3 and D7-2.
  - Every RC-15 entity carries a `RC-15` high row.
- **The 9 D7-1 government rows** (`review-lists.government_d71`, e.g. 96163, 103384, 103395): **0 statements.**
- **The 24 wrong-LEI rows** (RC-12): 0 statements on them. I resolved their 24 LEIs from the fresh export: **0 edges to them as parent**.
- **KI 22.9 edges** (entities 3, 49, 143, 194): 0 edge statements.
- **No write to `normalized_name` or `type`** on any update, and **no LEI overwrite** (every A pre-image has `lei` NULL).
- **KI 22.41 twins:** 0 statements touch any of the 392 twin rows. The LEI goes on the survivor (S1), and the twin goes to 013.
- **B is within the 29 Sep pool.** All 5,823 B entities are in the 006 basis (RC-B1 / RC-4 / RC-B4). `pool29` = 7,436, and 5,823 + 1,613 drained = 7,436. The 2 rows not in the 006 basis (502683, 502684) and the 6 fields not in a 006 tier (467290, 467291, 497274) are listed in `exceptions.json` and **not written** (checked).

## 3. E-A and ECA: PASS
- **E-1 exclusion** (child 99231 → parent `549300CZ8QS1GE53O776`, a wrong-LEI row): listed in `review-lists.ea_excluded`; **not in the plan.** The 3 E-C edges deferred for F-2 identity are listed under `edge_skipped`.
- **Dependency on A**, for every one of the 298 E-A and 44 ECA statements:
  - each has a `depends_on` A key that exists in the plan, in a batch with a lower sequence number (A ends at seq 87; ECA-001 is 88, EA-001/002 are 89–90);
  - each ECA `parent_lei` equals its A row's LEI;
  - each E-A `child_entity_id` is its A row.

  At run time, E-2 filters out any statement whose A write was not `applied` (runner `executeBatch`).
- **RA-15 as built** (`abGate`, `aStopReason`, `restoreDependentEca`):
  - ECA is held exactly like E-A: E-4 trigger, drop, A-stop, A adjudication (≥ 50/50, Data-Identity Lead plus Ops spot-check), every A checkpoint with a passed read-back diff, and `--ea-release`;
  - "A stops" deletes the written ECA and E-A edges (E-A first) before anything else;
  - restoring an A batch first deletes only the ECA edges whose parent is in that batch;
  - the `--all` order is Q → E-A → ECA → A → E-C → CR/RC15/C → B → P.

  **R110R-B1 is closed in code.** Tests 412–494 cover it.
- **E-5:** every edge statement is a direct `legal_parent` insert. No statement mentions an ultimate edge.

## 4. Drift and the §9 basis: PASS
- **ML-1015-3:** every bucket change against 29 Sep is traced row by row in FRI §5, and the arithmetic closes:
  - B −1,613 = 1,607 to C-reasons + 6 RR rows Phase 3 wrote;
  - C −6;
  - P −4 (the 4 Phase 3 holding rows, listed);
  - A −1 / Q −1 / ECA −1 (OTP Bank 2019, withheld);
  - E-C −5.

  I checked that 2019, 467290, 467291, 497274, 502683 and 502684 are written by no statement, and that no edge points at the OTP holding LEI.
- **ML-1015-1:** the whole-table §9 expectation is stated as **20,612 LEI-bearing rows**, with the 29 Sep basis 20,303 kept for traceability. It is backed by the dry-run `postrun` PASS (`c5cbfa71…`), with 0 unexplained drift.

## 5. Three-point check: PASS (see N-1)
- **(i) EXPLAIN set on file:**
  - 22 plans, `all_ok: true`, no `SCAN entity_master / entity_enrichment_queue / fund_holdings_monthly`;
  - the 13 Oct 10:00Z and 14 Oct 05:22Z runs are **identical plan for plan**, with the same SQL hash `f5ae0dba…dd32`;
  - the only temp B-tree is RECON's `ORDER BY` on `ops_job_run`, which is bounded by `idx_ops_job_run_job_at` (job and time range). Accepted.
- **(ii) ≤ 50k per execution:** the ledger's largest execution is **5,000 reads** (the export pages). The largest planned batch estimate is 1,010.
- **(iii) Projection and ceiling:**
  - R9-3 = 73,489 (multiplier 1.0) + ≈ 140k + 73,489 = **286,978 → PROCEED**;
  - `read-ceiling.json`: 350,000 / 200,000 a day, since 20:38:47.891Z;
  - the ledger total since that time is exactly 73,489 (the 998 reads from the 13 Oct probes before it are correctly excluded);
  - even at the runner's conservative estimator (6 × statements + 10 ≈ 152k for the run), the total is ≈ 299k, which is ≤ 350k;
  - the gate runs **before** any D1 read and fails closed without the record (code and tests 522–559).

## 6. Control surface: PASS
- `stop.sh` writes the kill flag and SIGTERMs the runner PID. Only `resume.sh --clear-stop` clears it.
- `pause.sh` / `resume.sh` work as described, and `status.sh` is read-only.
- The `run --until B-002` pilot scope is P-001 + P-002 + B-001 = 4,350 writes; the test at line 240 covers it.
- `restore --batch` and `--all` are covered by RA-15 tests 473–488 and the full-rollback test at 581.
- `--ea-release`, in the **OPS-R10 format** `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}`:
  - `releaseCovers` admits ECA **only** when `steps` names ECA;
  - E-A is admitted when `steps` is absent or names EA.

  That matches OPS-R10 ("ECA only when named").

## 7. Notes (numbered; none blocks release)
- **N-1 (pre-pilot action, 0 reads):**
  - The EXPLAIN set on file was run against the 14 Oct plan `602ab58a…`, not `e3854698…`.
  - Tonight's code changes are reported as R9-1, verification and ledger logic only, so the SQL renderers should be unchanged.
  - **Before the first pilot batch,** run `explain --plan …/release-2026-10-16 --transport remote-ro` once. Confirm 22/22 plans unchanged, `sql_sha256 = f5ae0dba…dd32`, and no SCAN. It costs 0 reads (EXPLAIN).
  - If the hash differs, stop for an Architect look.
- **N-2:** 9 B rows have `name` NULL rather than the LEI placeholder (e.g. 244951, 210982). They are inside the 006 pool basis, and filling a NULL name is not an overwrite of a real name. I accept this. The §9 sampled diff should treat these rows like placeholder rows.
- **N-3 (route to 013 / MA-OCT-004):** live Phase 3 has created a duplicate-identity pair: OTP Bank 2019 (operating, no LEI) and 467290 (holding, with the LEI). 011 correctly withholds it. It belongs on 013's input list, or a 004 DQ ticket.
- **N-4:** C and C-reasons rows get `lei_validation_source = 'GC-20260928-1600'` while their Level 1 stays older (RC-8, as specified). Record it in the 007/009 data notes, so nobody reads that field as "Level 1 validated against GC" on those rows. A Known Issue is enough.
- **N-5 (RELOPS):** 15 of the 34 tests carry `skip: !HAVE_006`. The FRI run reports 34/34 passing. RELOPS should confirm from the test output that **0 were skipped**, which proves the 006 basis files were present for the RA-15 and full-rollback tests.
- **N-6 (RELOPS):** the Sat 17 pilot is the runner's first live heartbeat from the main work folder. I agree with FRI §7 that the fallback is the run log plus the R-4 daily reconciliation.
- **N-7 (Ops/Engineering, non-blocking):** the first export attempt hit Cloudflare **7403** during an OAuth token refresh. The runner's retry policy covers 10000. Check that it also treats 7403 as retryable (same idempotent retry), or that a 7403 on a write batch ends `failed` with the cursor unchanged. Either is safe, but say which in the pilot close-out.

## 8. Rulings
- **RELARC-1:** the Fri 16 plan `e3854698…e6a8` is **architecturally releasable**. The Founder's release approval may rely on this review together with RELOPS.
- **RELARC-2:** N-1 is a pre-pilot step for the Engineering Lead. It does not need a new review unless the SQL hash changes.

**Stop point:** this report. Reply: "MA-OCT-011.RELARC reported".
