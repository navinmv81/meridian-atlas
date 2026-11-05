# MA-OCT-013 — Run sheet, Thu 5 Nov 2026 (spec rev 1 §15; e6dc8567…f098)

**Prerequisites:**
- MA-OCT-013.CHECK PASS by 17:00Z.
- The Founder's run approval on the RUN board row.
- MA-OCT-002b.DEPLOY reported closed (one production change at a time).
- The Main Lane's dated FREEZES window "013 run — other Entities writers frozen", Thu 5 18:00Z → Fri 6 00:10Z.

**Time limits:**
- Target start ≥ 18:15Z, after the 17:45–18:15 band.
- **No batch starts after 23:15Z; last write by 23:30Z** (both enforced by the runner).
- The runner refuses 21:58–22:02 and every FREEZES band.

**Conventions:**
- All commands run from the repo root on `October-2026` at the 013 commit.
- `S="App/Corporate Atlas/scripts/merge-013.sh"`.
- `W=~/MeridianAtlas-work/merge-013`; plan folder `P=$W/plan-thu5`.
- Every write command carries `--operator "<name>"` and is refused without it.
- Log every step with its UTC time in the RUN report, starting with **"starting MA-OCT-013 run"**.

## Kill switch, pause, status (any time)

| Need | Command | Effect |
|---|---|---|
| **Hard stop** | `$S stop` | Writes `App/Corporate Atlas/.merge-013-stop` and sends SIGTERM to the **013 runner's own pid** (`$W/runner.pid`; never another process). The runner finishes the in-flight D1 call, which is one transaction, then checkpoints and exits `killed`. The un-run batches go to `$W/remainder.json` (+ `.sha256`). |
| Pause before the next batch | `$S pause` / `$S resume` | The flag is checked before every batch. |
| Clear a stop | `$S resume --clear-stop` | Only after the Operations Lead agrees. |
| Status | `$S status` | Line 1 shows `WORK_DIR=… JOB_ID=manual.entity-merge-013`, then the flags, the runner pid, the cursor, the last run-log lines and the remainder SHA. |

## R0 Pre-flight (≥ 18:15Z, OPS-R12)
1. **Tooling:**
   1. `/usr/local/bin/wrangler --version` must print 4.96.0.
   2. `/usr/local/bin/wrangler whoami` must succeed. Then wait ≥ 30 s.
   3. Run `SELECT 1` read-only.
2. **`$S init`, first time only:** creates `$W` (700) and `013.env` (600). It never overwrites.
3. **`d1-today` ≤ 38,000:** `curl -s https://meridian-ops.navinmv1981.workers.dev/api/ops/cf/d1-today`. Record `rowsWritten`.
   - If it is over 38,000, **do not start**. Report it; the remainder rule applies.
4. **Boost evening run:** record the 17:50 boost `end` event (Ops console or `ops_job_run`). The runner re-checks this (T-16).
5. **A2:** record "A2 not started, 0 writes", with evidence: the FRI30.DIL report and the FREEZES note ML-1030-2.
6. **Other lanes:** check the other Thu lanes' reports for an open production change.

## R1 Ops identity (authorised by the Operations Lead; its own step; skip if not done by 18:45 → R-4 run-log reconciliation)
- **Registry row:**
  - `manual.entity-merge-013`;
  - domain Entities; owner Data-Identity Lead;
  - mode `manual`; emitter `merge-013`;
  - `expected_max_duration_s = 900`.
- **Emitter key, K-1..K-4** (Operations Lead):
  - a new 32-byte key, added to `OPS_INGEST_KEYS`;
  - the K-3 list: before = the current emitters, after = those + `merge-013`;
  - written to `$W/ops-ingest.env` with mode 600 and never printed: `OPS_INGEST_URL=…/api/ops/ingest/run-event`, `OPS_EMITTER=merge-013`, `OPS_INGEST_KEY=…`.
  - The runner uses this file only if the emitter is `merge-013` (T-15).

## R2 Boost pause (Ops M-3)
1. `touch "App/Corporate Atlas/.entities-enrich-boost-paused"`.
2. Add the pause row (Ops domain; Operations Lead, guarded, 1 row):
   ```sql
   INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by)
   SELECT 'local.entities-enrich-boost', strftime('%Y-%m-%dT%H:%M:%SZ','now'), '2026-11-06T00:10:00Z', 'MA-OCT-013 run window (ML-1104-2)', 'ops_lead:wrangler'
   WHERE NOT EXISTS (SELECT 1 FROM ops_job_pause WHERE job_id = 'local.entities-enrich-boost' AND ends_at = '2026-11-06T00:10:00Z');
   ```
3. Resume the boost on Fri 6 ≥ 07:15Z: remove the flag. The row expires at 00:10Z.

## R3 Plan (reads only: ≈ 52k export + plan offline)
1. **Export:** `$S export --out $P/export`.
   - It reads the `entity_master` keyset (5k pages), the candidate child rows, the Filings/13F probes, `fund_entity_link`, the redirects and `do_not_merge`.
   - Record `$P/export/manifest.json`.
2. **Plan:** `$S plan --export $P/export --out $P [--signatures $W/i1-signatures.json]`.
   - It **refuses** on any of: an index precondition, M-6 disjointness, the R guard (R > 5k, ±20 % of 62, or > 10k repoint writes), an I-1 reject in the set, or a bad signature file.
   - **Expected:** about **1,862 merges** (1,868 if the 6 are signed), **38 batches**, R ≈ 62, about **30.4k writes** declared, and 3 (iii) LEIs.
   - **BUILD reference** (export Thu 5 07:11Z, 67,755 reads; plan `ea8bace8…c02d`): 1,862 merges, 38 batches, R = 62, 2 cik fills, 3 LEIs, 30,395 declared writes; the 6 sign-eligible pairs held; 0 do_not_merge, Filings/13F, ETF or guard holds; 154 new pairs → November.
   - **The replica dry run** of that plan merged 1,862 / 1,862 (0 raced, 0 breach), and `verify` passed. Restoring all 38 batches was byte-identical.
   - **A Thu 5 plan that differs materially from this reference** → stop and report before R4.
   - Record the plan SHA (`$P/plan.sha256`) and `totals`.
3. **Data-Identity plan review:**
   - `$P/plan.json` → `held.i1_unsigned` (the 6), `held.i1_review_new`, `held.n2_mismatch`, `held.state_changed`.
   - `$P/new-pairs.json` holds the new pairs for November.
   - **To sign the 6:** `$W/i1-signatures.json` = `{"signed_by":"Data-Identity Lead","signed_at":"<UTC>","pairs":[{"surv":26150,"dup":230822},…]}` (only the 6; a reject is refused). Then re-run `plan`.

## R4 Migration (≈ 3 writes)
- `$S migrate --operator "<name>"` runs `CREATE TABLE IF NOT EXISTS entity_merge_redirect`.
- **Three-point check:**
  - index: the rowid table, none needed;
  - one execution;
  - about 3 writes.

## R5 Pilot (batch B01, 50 merges)
1. `$S run --plan $P --operator "<name>"`.
   - It runs every gate:
     - index preconditions (hard stop);
     - `entity_merge_redirect` present;
     - `hold_all_jobs`;
     - the boost pause row and the 17:50 end event;
     - flags;
     - the calendar;
     - `d1-today` (2 s, 1 retry, fresh ≤ 120 s);
     - 013 total + batch ≤ 33,000 and account + batch ≤ 70,000.
   - Then it runs B01 only and **stops with "pilot hold"**.
2. **Checkpoint:** `$W/checkpoints/B01-*.json` — `merged`, `raced`, `probes` (all 0), `writes_measured` ≤ 1.3 × declared.
   - Pre-image: `$W/preimages/preimage-B01-*.json`, with its SHA in the checkpoint.
3. **Data-Identity 20-row spot check** of B01 (E-4 style). On a failure: `$S restore --plan $P --batch B01 --operator "<name>"` and stop.

## R6 Batches B02..B38
1. `$S run --plan $P --operator "<name>" --pilot-ok "<Data-Identity Lead>"`.
2. **What the runner does:**
   - It stops at a **batch boundary** when the next batch would breach 33k / 70k, at a calendar stop (≥ 23:15Z, a band, or 21:58–22:02), on the pause or stop flag, or on any stop condition:
     - a breach class;
     - raced > 0.5 %;
     - writes > 1.3×;
     - non-zero reference probes;
     - `exec_refused`;
     - a missing index.
   - It writes **`$W/remainder.json` + `.sha256`** on every stop with batches left.
3. **Resuming after a calendar stop** (e.g. 21:58–22:02): re-run the same command at ≥ 22:02. The cursor continues; `--until Bnn` stops before a given batch.

## R7 (iii) LEIs (3 rows)
- `$S lei --plan $P --operator "<name>"`.
- It makes ≤ 3 GLEIF `lei-records` calls first and requires ACTIVE / ISSUED.
- **W1-A guard:** `NOT EXISTS (lei)`, `lei IS NULL`, the post-merge key, and the 013 redirect present.
- State goes to `$W/lei.json`; a restore of that batch also clears the LEI (CAS).

## R8 Verify and recon (reads only; by 23:30 for any write)
1. `$S verify --plan $P` must report `ok: true`:
   - 0 duplicates live;
   - 0 survivors missing;
   - 0 survivors that are duplicates;
   - every reference probe 0;
   - 0 held ids merged.
2. `$S recon --date 2026-11-05` gives the R-4 run-log vs `ops_job_run` export. The Operations Lead signs it by Fri 6 09:00Z.
3. ETF-PL post-run spot check (ETF N-6) on Fri 6.

## Per-batch restore (same day; §11)
- `$S restore --plan $P --batch Bnn --operator "<name>"` restores in the Arch M-1 order:
  1. the survivor key;
  2. re-insert the duplicate;
  3. queue, iem and cik;
  4. clear the (iii) LEI;
  5. delete the redirect.
- Every statement needs the batch token, so a raced merge is never touched.
- It verifies byte-identity against the pre-image and appends to `$W/restores.jsonl`.
- **Cost:** about 16 writes per merge (≈ 820 a batch), inside the 70k gate.
- **A full rollback** (≈ 29.9k) is a Founder + Operations Lead decision: earliest Fri 6 ≥ 08:05Z, ≤ 25k a day.

## Remainder (November item #1)
- `$W/remainder.json` lists the un-run batches, their ids and the plan SHA.
- It resumes on the next eligible weekday ≥ 08:05Z (never Sunday; Monday only after 08:00), under a **new Control**.
- It needs a fresh export and plan; caps are 25k / 60k unless re-approved.

## Retention
- Keep `$W` (plan, pre-images, checkpoints, run log, remainder, `lei.json`) ≥ 30 days after 013 closes.
