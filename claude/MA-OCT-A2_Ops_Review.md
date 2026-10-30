# MA-OCT-A2 — Operations Lead Review (A2 spec rev 0)

```text
REVIEWER:     Operations Lead (LANE-1-OPS; did not write the A2 spec or the 011 code)
PACKET:       MA-OCT-A2 — deferred GLEIF A rows (A, ECA, E-A, Q), spec rev 0
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 6 MUST-FIX before the run, 10 NOTES
DATE:         Thu 29 Oct 2026
BASIS:        Founder ML-1029-2 (Q1 freshness gate, Q2 freeze Fri 30 08:05Z → Sun 1 00:10Z, Q3 defer on failure); Option C (ML-1025-5);
              OPS-R6, R8, R9, R10, R11, R12; 011 RECOND and CLOSEREV-OPS
```

## Evidence

| Input | SHA-256 |
|---|---|
| `claude/MA-OCT-A2_Spec.md` rev 0 | `226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d` ✔ (matches Task) |
| `claude/relays/FREEZES.json` (as found) | `9c368fa6b85eb1c013647744664474be8c394f099a7f582c7e48ba7f5893e829` (holds the A2 window; see N-1) |

**Code** read from `origin/October-2026` = `acfd069` with `git --no-optional-locks show`, **011 code as committed at `58cd922`**:
- core `JOB_ID`, `WORK_DIR`, outcome map, recon query;
- the four control scripts;
- `ops-api.js` sweep rules (`job_lost`, `budget_risk`);
- `entities-enrich.js` and its wrangler toml (cron `0 6 * * *`, `50 6 * * *`; `hold_all_jobs` check).

0 D1, no deploys, no git writes, no secrets. Work-folder files (`~/MeridianAtlas-work/gleif-011/…`) were not opened. Their hashes are taken from the spec.

## Checks

| # | Area | Result |
|---|---|---|
| 1 | **Domain and ownership** | Writes: `entity_master`, `entity_relationships`, `entity_enrichment_queue` (Entities). Ops tables are written only through `meridian-ops` ingest and LANE-1-ENG's registry/pause rows. Read-only: `holdings_pipeline_state.hold_all_jobs` (ETF state). **No ETF-domain write.** ✅ |
| 2 | **011 code reuse (`58cd922`)** | C-1 … C-6 are minimal. `GLEIF011_WORK_DIR` is supported. `JOB_ID` is hard-coded today (`core:22`) and is also used by the R-4 recon query (`core:494`), so C-2 is needed. ⚠ The control scripts default to the 011 work dir → **M-5**. |
| 3 | **Read budget** | Plan ≈ 195k ≤ **250k** (new A2 ceiling, fresh `since`). Fri ≈ 90k, Sat ≈ 110k (≤ 200k/day). Max execution = export page 5k (≤ 45k). ✅ (N-4) |
| 4 | **Write budget / batching** | ≈ 32.6k total. ≤ 250 statements per `db.batch()`. ≤ 25k own per day including Ops events (ML-1010-3). Account gate 60k (F-5). Fri ≈ 11k, Sat ≈ 21.6k: **margin 3.4k on Sat** → **M-2**. Far below the 100k cap. ✅ |
| 5 | **Freeze windows** | FREEZES has the dated A2 window and both BST/GMT boost bands. The runner keeps ±2 min of the sweep slots and stops at 23:45Z. ✅ **But the window is enforced only on runners that read FREEZES.json, not on Cloudflare crons** → **M-1**. |
| 6 | **Three-point check** | Same renderers as 011, so the 22-plan EXPLAIN set (`sql_sha256 f5ae0dba…dd32`) is expected unchanged. ENT-CR1 C2/C3 dropped only `instrument_master` indexes, which A2 doesn't touch. Re-run P-1 on the A2 plan (N-9). ✅ |
| 7 | **Acceptance criteria / spot checks** | AC-A1 … A9 are adequate; the 50-row pilot keeps E-4. GLEIF call arithmetic needs one line (N-2). ✅ |
| 8 | **Rollback manifest** | Inputs listed, mode 600, outside repo and iCloud, re-issued if files grow (CA-1). ✅ **Restore calendar missing** → **M-6**; retention period → N-8. |
| 9 | **`gleif_006.db` retention** | Kept until A2 closes (ML-1025-5); deletion date ≤ 30 Nov set at close. ✅ |
| 10 | **A2 → 013 hand-off** | Survivor side only; `withheld-013.json`; 013 starts from a post-A2 export and not before A2 close-out; protected pairs not targeted. ✅ |
| 11 | **Runner operability, pause and stop** | `pause.sh`, `resume.sh` and `stop.sh` act on shared flags in `App/Corporate Atlas/` (011 is closed, so no clash). `stop.sh` SIGTERMs `$WORK_DIR/runner.pid` and `status.sh` reads `$WORK_DIR/holds`, **both defaulting to `gleif-011`** → **M-5**. |
| 12 | **Monitoring** | Outbox + heartbeats to the new job. **R-4 daily reconciliation is not mentioned in the spec** → **M-3**. |
| 13 | **Sweep interaction (deploy 4 today)** | A2's job is not in `GLEIF_JOBS`, so E1–E4 don't apply and E5 (`local_auth_failure`) does. **`job_lost` (sev2) fires on a start with no end beyond `expected_max_duration_s` + 300 s** → **M-4**. Sweep slots 08/12/18/22 are kept clear. ✅ |
| 14 | **Sunday holdings budget** | A2 writes 0 on Sun 1 ✅. Holdings ≈ 70k; the sweep raises `budget_risk` at ≥ 75k (sev3) and ≥ 80k (sev2). **The spec still allows a "restore with the Founder's say-so" on Sunday** (≈ 32k) → **M-6**. |

## Findings

### MUST-FIX before the run (doc/run-sheet items; the Main Lane hash-checks them, no new Ops review)

| # | Section | Finding | Required change |
|---|---|---|---|
| **M-1** | §6, Q2 | **The freeze has no enforcing mechanism for the Cloudflare enrich cron.** `meridian-entities-enrich` runs at 06:00 and 06:50 UTC daily. Its only stop is `hold_all_jobs` in `holdings_pipeline_state`, which is global, sits in an ETF-domain table, and **also stops A2** (OQ-7 → `held`). FREEZES.json is read only by local runners. 011's identical window did **not** stop enrich: Phase 3 ran at 06:50 on Sat 17, creating 502685 and draining 129 B rows. | **Name the mechanism for each writer, and confirm it in writing at G-5:**<br>- **Enrich cron:** either (a) one triggers-only change on `meridian-entities-enrich` (crons `[]`) on Fri 30 after the last A2 batch and before Sat 06:00Z, restored on Sun 1 ≥ 08:05Z (after the 05:50–07:10 enrich band would have passed), with both version ids recorded, as a scheduled production change on its own; **or** (b) the Founder re-rules Q2 to accept the Sat 06:00/06:50 enrich runs. Those fall outside the A2 batch windows, and CAS + W1-A make any collision a withhold, not an overwrite.<br>- **Ops recommends (a).**<br>- **Never use `hold_all_jobs` for this.**<br>- **Boost:** pause flag plus `ops_job_pause` row 2 (`local.entities-enrich-boost`, Fri 30 08:05Z → Sun 1 00:10Z) by LANE-1-ENG, authorised here.<br>- **Delta:** no cron (held). **Seed:** Mondays only (outside the window). |
| **M-2** | §5, §7 | **Q is decoupled from A.** Q runs only on Sat, after ECA/E-A. If the pilot adjudication runs late on Fri, Sat needs more A batches and the 25k cap stops the day **before Q**. That leaves applied A rows with `pending` queue rows, which live enrich picks up once the freeze ends. | Either (a) **pair Q with A:** the Q batch for each A batch's applied rows runs the same day, right after that A batch; ECA/E-A wait as specified (E-2 depends only on A applied; `RESTORE_ORDER` unchanged). **Or** (b) the runner refuses an A batch unless the day's remaining own cap covers that A batch **and** its Q writes (≈ 2 per row), and the M-1 freeze stays in force until every applied A row has its Q. **Ops recommends (a);** the Architect confirms the order. |
| **M-3** | §4 ("everything else reused"), §7 | **R-4 daily reconciliation (OPS-R8) is not stated.** The runner's `reconGate` enforces it. | State: the outbox + R-4 apply. LANE-11-ENG exports `recon/2026-10-30/` from the A2 work dir by 23:30Z Fri. The Operations Lead signs `ops-signoff.json` **before Sat's first batch (by 08:00Z)**. OPS-R11 stands: `--outbox-live-confirmed` is never used. Recon queries the A2 `JOB_ID` (C-2). |
| **M-4** | §4 C-2 | **Job and key details are missing.** Without a per-batch `expected_max_duration_s`, the deploy-4 sweep can raise `job_lost` (sev2). | **Registry** (LANE-1-ENG executes; Ops authorises here, OPS-R6): `manual.gleif-reconcile-a2`, Entities, Data-Identity Lead, `manual`, emitter `gleif-a2`, **`expected_max_duration_s = 900` per batch** (N-2 of 011). **K-1..K-4:** new 32-byte key, `O_EXCL`, mode 600 at `~/MeridianAtlas-work/gleif-a2/ops-ingest.env`, never printed. **K-3 before:** `boost-local`, `health-check-local`, `local-bonds` (K-5 retired `gleif-011` on 24 Oct). **After:** the same plus `gleif-a2`, nothing else. **K-4:** accept 201 and wrong-key 401; the other three still authenticate. **Sequence:** the `OPS_INGEST_KEYS` put is its own step, **after deploy 4 and the 004 deploy are verified**, never adjacent to another `meridian-ops` change. Record the new version id. **K-5** (retire `gleif-a2`) at A2 close. |
| **M-5** | §4 C-1 | **Control surface:** `status.sh` and `stop.sh` default `WORK_DIR` to `gleif-011`. In an A2 session without the env, `stop.sh` writes the flag but **cannot SIGTERM the A2 runner**, and `status.sh` **shows 011's `e4-trigger` and `ea-dropped` holds** as if they were A2's. | One env file `~/MeridianAtlas-work/gleif-a2/a2.env` (`GLEIF011_WORK_DIR`, `GLEIF011_JOB_ID`; no secrets), sourced by **every** A2 command, including pause, stop, status and restore. `status.sh` prints `WORK_DIR` and `JOB_ID` on its first line. The run sheet shows the commands with the env. A test (C-6) or a run-sheet check proves that `stop.sh` finds the A2 pid. The pause and stop flags remain shared with 011 (011 is closed). |
| **M-6** | §7 slip rule, §9 | **Restore calendar.** **Sun 1:** holdings ≈ 70k + a full restore ≈ 32k would pass the 100k cap and trip the sweep's 75k/80k alerts. **Mon 2:** seed ≈ 34k against the 60k gate, plus 013. At ≤ 25k a day, a full restore needs ≥ 2 run days. | **No A2 writes or restores on Sun 1 at all**: remove "restore only with the Founder's say-so" for Sunday. Per-batch restores (RA-12; pilot E-4) run **Fri or Sat**, inside that day's caps. **A full rollback is a Founder decision that moves 013:** restore days ≥ Mon 2 after the seed, ≤ 25k a day, and 013 starts only after it. Write this into §7 and §9. |

### NOTES

| # | Note |
|---|---|
| N-1 | §0 pins FREEZES `b6d035f6…`; the file is now **`9c368fa6…e829`** (the A2 window added, ML-1029-2). Re-pin at G-5. |
| N-2 | GLEIF calls: §3 says "≤ 50 calls" for the freshness gate, but AC-A5 makes ≥ 10 post-write calls with "≤ 50 in total including FG". State either FG ≤ 40 + 10 post-write = 50, or FG 50 + 10 = 60 (which needs a Founder line, since Q1 says ≤ 50). |
| N-3 | **Ops packets needed:**<br>- **Fri:** Ops spot-check of the A2-001 50-row adjudication. Read grant to `gleif-a2/adjudication/`. The check is a 10-row evidence trace plus seed and count checks; Ops cannot open the GC database.<br>- **Sat:** the **OPS-R10 release file**, written into `gleif-a2/holds/`: `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}`. It is issued only when four conditions hold:<br>  1. the pilot is 50/50;<br>  2. every A read-back has passed;<br>  3. there is no E-4 trigger and no drop;<br>  4. Fri's R-4 is signed.<br>- **R-4 for Fri and Sat:** a standing grant like RECOND. |
| N-4 | **Reads:** 195k of 250k leaves 55k for restores (≈ 6 reads per statement, enough for ≈ 9k statements). A post-restore re-export (≈ 75k) would cross 250k, so the Operations Lead re-rules the ceiling at that point. |
| N-5 | **Writes:** Sat's other changes (002b and 005 deploys) write ≈ 0 to D1. 008 bond-table writes are exempt from the freeze but count against the shared gate. The runner's own gate covers this; no extra action. |
| N-6 | **OPS-R12 pre-flight** before every A2 session: `wrangler whoami` (4.96.0 by path), wait ≥ 30 s, then `SELECT 1`. A 7403 at startup that is reported as an auth failure will show up as an E5 `local_auth_failure` case. Triage it; don't escalate. |
| N-7 | **Sweep:** with `expected_max_duration_s = 900`, a batch over 20 min raises `job_lost`, which is correct. The pilot's adjudication hold is between runs, not inside one, so it does not trigger. |
| N-8 | **Retention:** keep `~/MeridianAtlas-work/gleif-a2/` (manifest) ≥ 30 days after A2 closes **and** until 013 closes, independent of `gleif_006.db` (as 011 R-2). Set the deletion date at close. |
| N-9 | **P-1 / P-2** on the A2 plan and code before the pilot. Expect `sql_sha256 = f5ae0dba…dd32`; a different hash means stop for the Architect. Tests: 0 skipped (HAVE_006). |
| N-10 | **Usage and lanes:** Fri carries FG, export, plan, GO, pilot, adjudication and spot-check before A2-002. Plan the Founder GO and the adjudication slots in advance so that Fri's ≈ 11k actually runs; otherwise M-2 applies. |

## Verdict

**PASS WITH NOTES.**
- The spec is a disciplined re-run of 011's A/ECA/E-A/Q on a fixed matcher.
- The budgets fit: reads 195k / 250k, writes ≈ 32.6k at ≤ 25k a day.
- Domain ownership is respected and the 013 hand-off is sound.

**M-1 to M-6 must be in the run sheet / spec rev 0.1 before G-5.** M-1 (a real freeze mechanism for the enrich cron) and M-2 (Q paired with A) are the two that change how the run behaves; the others are operational detail. The Ops authorisations in M-1 (boost pause row 2) and M-4 (registry row and key) are given here, for LANE-1-ENG to execute.
