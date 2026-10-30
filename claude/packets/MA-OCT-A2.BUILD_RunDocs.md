# MA-OCT-A2.BUILD — docs for the A2 run Control (Task step 5)

Prepared by LANE-11-ENG (Engineering Lead), Fri 30 Oct 2026, for the Main Lane to issue as the A2 run Control. **Nothing here has been executed.** Every production step below is written to be run on its own, by the lane the Control names, with its rollback.

Code: the A2.BUILD patches 00–05 (see `MA-OCT-A2.BUILD_Report.md`), committed by LANE-1-ENG after the Architect's C-3/C-4 review. Every A2 command goes through `App/Corporate Atlas/scripts/gleif-a2.sh` (it sources `~/MeridianAtlas-work/gleif-a2/a2.env`; Ops M-5).

---

## D-1. Ops M-1: the enrich-cron freeze (narrowest mechanism)

**Problem (Ops M-1):** `meridian-entities-enrich` fires at 06:00Z and 06:50Z daily. FREEZES.json is read only by local runners, so the A2 dated window does not stop it. 011's identical window did not stop it either: Phase 3 ran at 06:50Z on Sat 17. **`hold_all_jobs` is never used for this**, because it is global, sits in an ETF table and would also stop A2.

**Mechanism: Ops option (a), a triggers-only change on one Worker.** No code upload, no other Worker, no D1 write.

| | Step | Who / when |
|---|---|---|
| **P-1 apply** | 1. Pre-flight: `/usr/local/bin/wrangler --version` → 4.96.0; `wrangler whoami`.<br>2. Copy `App/Corporate Atlas/wrangler-entities-enrich.toml` to a scratch file **outside the repo**, with only `[triggers] crons = []` changed. Leave the `name` and everything else unchanged, and diff it against the original: exactly one line differs.<br>3. Run `/usr/local/bin/wrangler triggers deploy -c <scratch.toml>`.<br>4. Record the output and the deployment/version id. | LANE-1-ENG. **Fri 30 ≥ 08:05Z** (after Fri's 06:00/06:50 runs, inside the A2 window), and **before Sat 31 05:50Z**. Its own production change: not next to any other `meridian-*` change (one production change at a time). |
| **P-1 verify** | 1. The Cloudflare dashboard (Workers → meridian-entities-enrich → Settings → Triggers) shows no Cron Triggers.<br>2. Sat 31 after 07:10Z: no 06:00Z or 06:50Z invocation, and `entity_enrichment_queue` shows no Phase 3 movement in that band (read-only check).<br>The `13F Seed/.env` token cannot read schedules (CLAUDE.md), so the check is the dashboard or `wrangler`, never that token. | LANE-1-ENG, Ops confirms in writing at G-5 |
| **P-1 rollback / restore** | 1. Run `/usr/local/bin/wrangler triggers deploy -c "App/Corporate Atlas/wrangler-entities-enrich.toml"` (the committed file, `crons = ["0 6 * * *", "50 6 * * *"]`).<br>2. Verify the two schedules in the dashboard.<br>3. Record the version id. | **Sun 1 ≥ 08:05Z** (after the 05:50–07:10 enrich band and the 07:55–08:05 bootstrap buffer). Same command at any earlier time if A2 is stopped or deferred. |

**Cron-slot note:** this frees 2 of the 5/5 account Cron Trigger slots between P-1 and the restore. **No other lane may take those slots before the restore**, otherwise the restore fails (Free plan cap, CLAUDE.md). The Main Lane should state this in the Control and on the board.

**Other writers (Ops M-1, unchanged):**
- **Boost:** pause flag plus `ops_job_pause` row 2 (`local.entities-enrich-boost`, Fri 30 08:05Z → Sun 1 00:10Z), LANE-1-ENG, authorised by Ops. Use the same SQL shape as MA-OCT-OPS.T12 step 3; rollback is a `DELETE` of that one row by `(job_id, starts_at, ends_at)`.
- **Delta:** no cron (held). **Seed:** Mondays only, outside the window.

The alternative, Ops option (b), is that the Founder re-rules Q2 to accept the Sat 06:00/06:50 enrich runs; CAS + W1-A turn a collision into a withhold. That is a Founder line, not an engineering one. Ops recommends (a).

## D-2. The `gleif-a2` ingest key (prepare only; K-1..K-5)

Nothing is generated or set by this packet. On the day, LANE-1-ENG:

1. **K-1/K-2:** generate a new 32-byte key and write `~/MeridianAtlas-work/gleif-a2/ops-ingest.env` with `O_EXCL` and mode 600. It holds `OPS_INGEST_URL`, `OPS_EMITTER=gleif-a2` and `OPS_INGEST_KEY`. The runner reads exactly these three keys, and refuses a file that is not mode 600 (core `ingestConfig`). It does this in one Node process that never prints the key; it prints only `sha256(key)`.
2. **K-3:**
   - Before: read the current `OPS_INGEST_KEYS` emitter list (names only). It must be `boost-local`, `health-check-local` and `local-bonds` (`gleif-011` was retired by K-5 on 24 Oct).
   - Build the new JSON as that set plus `gleif-a2: sha256(key)`, and nothing else.
   - Put it with `/usr/local/bin/wrangler secret put OPS_INGEST_KEYS -c App/Ops/wrangler-ops.toml`, from stdin and never on the command line.
   - **Sequence:** its own step, **after deploy 4 and the 004 deploy are verified**, never next to another `meridian-ops` change.
   - Record the new version id.
3. **K-4:** a test heartbeat with the right key returns 201, and one with a wrong key returns 401. The other three emitters still authenticate.
4. **Rollback:** put the previous `OPS_INGEST_KEYS` value back (the three-emitter JSON). The runner then falls back to the run log (`ops-ingest.env` refused → R-4 shows the gap, OPS-R11: never `--outbox-live-confirmed`).
5. **K-5 at A2 close:** remove `gleif-a2` from `OPS_INGEST_KEYS` and delete the key file.

The ingest key file lives in the A2 work folder, so `gleif-a2.sh` never sources it, and nothing in this lane reads it (ML-1024-1).

## D-3. Ops M-4: job registration

LANE-1-ENG executes this; Ops authorised it in the A2 Ops review (OPS-R6). It runs before the first A2 heartbeat, in the same shape as MA-OCT-OPS.T12 step 1:

```sql
INSERT OR IGNORE INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, worker_name, source_path, intended_schedule, emitter_id, expected_max_duration_s, kill_switch_ref, write_budget_profile, status, notes)
  VALUES ('manual.gleif-reconcile-a2', 'gleif-a2.sh → gleif-reconcile-011.mjs (MA-OCT-A2 deferred-A re-run)', 'Entities', 'Data-Identity Lead', 'manual', NULL, 'App/Corporate Atlas/scripts/gleif-a2.sh', '{"kind":"none"}', 'gleif-a2', 900, 'scripts/gleif-a2.sh stop (kill: finishes in-flight statement, checkpoints, exits killed; SIGTERMs the pid in ~/MeridianAtlas-work/gleif-a2/runner.pid); gleif-a2.sh pause / resume (flag checked before every batch); holds/g2-stop.json stops every A2 batch; ingest_enabled=0 on this row stops heartbeats', '{"write_guard":"d1-today headroom gate before every batch incl. the paired Q (Ops M-2), fails closed; 60k account ceiling, <= 25k own a day; plan ~31.6k total"}', 'active', 'MA-OCT-A2. Manual, interactive; no cron, no LaunchAgent. expected_max_duration_s = 900 per BATCH (Ops N-7). Run window Fri 30 08:05Z - Sun 1 00:10Z; no writes Sun 1. Registered under OPS-R6 (A2 Ops review M-4).');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  SELECT 'ops_control', 'manual.gleif-reconcile-a2', 'registry_added', NULL, 'manual.gleif-reconcile-a2', '{"source":"MA-OCT-A2 run Control","authorised_by":"Operations Lead (OPS-R6, A2 Ops review M-4)","emitter_id":"gleif-a2","expected_max_duration_s":900,"execution_mode":"manual","domain":"Entities","owner_role":"Data-Identity Lead"}', 'engineering-lead:wrangler', 'system', 'Engineering Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'registry:manual.gleif-reconcile-a2:insert:a2'
  WHERE EXISTS (SELECT 1 FROM ops_job_registry WHERE job_id = 'manual.gleif-reconcile-a2' AND emitter_id = 'gleif-a2' AND expected_max_duration_s = 900);
```

- **Writes:** about 2 rows, plus indexes.
- **Verify:** `SELECT job_id, emitter_id, expected_max_duration_s, status FROM ops_job_registry WHERE job_id='manual.gleif-reconcile-a2'` returns one row.
- **Rollback:** `UPDATE ops_job_registry SET status='retired' … WHERE job_id='manual.gleif-reconcile-a2'`, following the registry's own retirement convention, plus a case event. This also happens at A2 close.
- **Note:** `App/Ops/tools/registry-sync.mjs` builds the intended registry from its sources. Add the A2 row there too, or the next sync shows it as drift. That is LANE-1-ENG's call.

## D-4. Sat 31 run sheet

**Ground rules:**
- **Shared checkout:** run from the shared checkout, after LANE-1-ENG has committed the A2 code **and FREEZES.json `9c368fa6…e829`**. The runner reads `claude/relays/FREEZES.json` relative to its own repo. The committed version at `71fab4b` is still `b6d035f6…`, which has no A2 window. Record `9c368fa6…` as the re-pin (Arch M-6). Every checkpoint stamps `freezes_sha256`.
- **Commands:** every command is `gleif-a2.sh <cmd>`. Its first line must read `A2 env: WORK_DIR=/Users/navinkumar/MeridianAtlas-work/gleif-a2 JOB_ID=manual.gleif-reconcile-a2`. Anything else means stop.
- **No writes on Sun 1:** no A2 write or restore at all on Sun 1 (Ops M-6).

**Recurring freeze bands Sat 31 (UTC):**
- 05:50–07:10 (enrich, kept even with the cron off);
- 07:55–08:05 (bootstrap);
- 11:45–12:15 (boost AM).

The runner refuses a batch start inside them.

### Fri 30 (preparation; no A2 writes)

| # | Step | Who |
|---|---|---|
| F-1 | Architect code review of C-3/C-4 → PASS by 23:00Z (ML-1029-6 hard stop) | REVIEW-A |
| F-2 | LANE-1-ENG commits the A2 code and FREEZES `9c368fa6…` (commit list in the report) | LANE-1-ENG |
| F-3 | `gleif-a2.sh init`, which creates `a2.env` (600) and the work dir (700). Then `gleif-a2.sh status`: line 1 shows the A2 values, and there are no holds | LANE-11-ENG |
| F-4 | **G-2 sample:** `gleif-a2.sh g2-draw --base ~/MeridianAtlas-work/gleif-011/plans/release-2026-10-16/plan.json --out ~/MeridianAtlas-work/gleif-a2/g2-sample.json`. The draw is deterministic (seed `MA-OCT-A2.G2`, released A minus the 28 DIL29 exclusions, population 3,648), so it can be done Fri. Expect sha256 **`8d3dc22b19d898fa35a4587c23b3d85afc324e7318d6356525c23500b679f03d`** (the same draw as the dry run). | LANE-11-ENG |
| F-5 | **G-2 adjudication:**<br>- the Data-Identity Lead adjudicates all 150;<br>- a **different** Ops reader spot-checks ≥ 15 (Arch M-3);<br>- the file is `packet "MA-OCT-A2.G2"`, `sample_sha256` = F-4, `n = adjudicated = 150`, `errors`, `data_identity_lead`, `ops_spot_check {by, rows, errors}`.<br>**Any error → STOP** (Arch M-2; the runner writes `holds/g2-stop.json`, and Founder Q3 defers A2). | Data-Identity Lead, Operations Lead |
| F-6 | D-1 P-1 (enrich `crons = []`), boost pause row 2, D-3 registry row, D-2 key. Each is its own production step, in that order, ≥ 08:05Z and not adjacent to the 002b/004/005 `meridian-ops` changes. | LANE-1-ENG |

### Sat 31

| # | UTC | Step | Gate / stop |
|---|---|---|---|
| S-0 | from 07:10 | OPS-R12 pre-flight: `wrangler whoami` (4.96.0 by path), wait ≥ 30 s, `SELECT 1`. Confirm no 06:00/06:50 enrich invocation (D-1 verify). Check `gleif-a2.sh status`. | A 7403 at startup is triaged as E5 `local_auth_failure`, not escalated (Ops N-6) |
| S-1 | 08:05 → | **FG freshness gate**, ≤ 50 GLEIF calls in total including AC-A5's ≥ 10 post-write calls: **FG ≤ 40 + 10 post-write** (Ops N-2), unless the Founder rules 50 + 10. Exclude E-X1 up front, so that ≥ 10 sample rows will be applied (Arch N-1). | FG fail → stop; A2 → November (Q3) |
| S-2 | | `gleif-a2.sh read-ceiling` (C-5, once), then `gleif-a2.sh export --out ~/MeridianAtlas-work/gleif-a2/exports/2026-10-31`. Reads count against 250k (≈ 195k planned, 55k for restores, Ops N-4). | Read ceiling hit → stop |
| S-3 | | `gleif-a2.sh generate --a2 --export …/2026-10-31 --base …/release-2026-10-16/plan.json --g2-sample ~/MeridianAtlas-work/gleif-a2/g2-sample.json --out ~/MeridianAtlas-work/gleif-a2/plans/2026-10-31`. Exit 3 = STOP rule (an extra or drifted exclusion id → the Data-Identity Lead rules before any plan exists). Exit 4 = G-4 limits exceeded (A ≤ 3,648, ECA ≤ 44, EA ≤ 296). Record the plan SHA. | P-1/P-2 on the plan and code (Ops N-9: `sql_sha256` expect `f5ae0dba…dd32`; tests 0 skipped) |
| S-4 | | **Founder GO** on the plan SHA, the F-5 G-2 file (150/0 + Ops ≥ 15), FG, and D-1/boost/registry/key confirmed (G-5) | No GO → stop |
| S-5 | | **Pilot:** `gleif-a2.sh run --plan … --g2 <F-5 file>` runs **A-001** only and then holds. 50-row pilot adjudication (Data-Identity Lead) plus Ops spot check (Ops N-3). Any wrong row → **E-4** → A2 stops; restore A-001 the same day (Sat, inside the caps) | E-4 → Q3 defer |
| S-6 | | **A+Q paired batches:** `gleif-a2.sh run --plan … --g2 … --a-adjudication <pilot file>` runs Q-001 → A-002 → Q-002 → … Each A batch's headroom check reserves its paired Q (Ops M-2). After every A batch the read-back must pass. | See the cap table below |
| S-7 | by 23:30 | `gleif-a2.sh recon` (A2 `JOB_ID`, C-2/M-5) → `recon/2026-10-31/` in the A2 work dir. The Operations Lead signs `ops-signoff.json` before any further A2 batch (November). OPS-R11: `--outbox-live-confirmed` is never used. | — |
| S-8 | stop | **Stop at the cap.** The remaining batches go to November (ML-1029-5): they are not run on Sun 1 and not re-planned inside October. `gleif-a2.sh status` is the end-of-day record. | — |

**Per-day write cap (dry-run plan `d1cb5abb…`; 10 event writes per batch = 2 × 5):**

| Through | Cumulative est. writes |
|---|---|
| A-001 + Q-001 | 2,062 |
| A-005 + Q-005 | 10,372 |
| A-010 + Q-010 | 20,996 |
| **A-011 + Q-011** | **23,117** |
| A-012 (gate) | 23,117 + 1,547 + 10 + paired Q 510 = 25,184 > 25,000 → **refused** |

- **What fits:** a full Sat 31 fits **A-001..A-011 and Q-001..Q-011**, which is 2,750 A rows and their queue rows.
- **What goes to November:** A-012..A-015 (898 rows) with their Q batches, then ECA-001 (44) and EA-001/002 (296), about 8,820 writes in all. ECA/EA wait for all A batches as specified.
- **The 60k account gate:** it is checked by the same gate, so other Sat writers (008 bonds; Ops N-5 ≈ 0 otherwise) reduce this.
- **If Sat starts late or the pilot holds long:** fewer pairs run. A is never left without its Q (M-2), so there are no `pending` queue rows for live enrich to pick up after the freeze.

**Runner operating rules carried into the Control (Arch M-7):**
- **C-1′ (a):** no `restore --all` while a `readback-pending` hold exists.
- **C-1′ (b):** a restore-mode pending read-back is cleared by re-running the restore, then a logged manual hold removal.
- **C-1′ (c):** any `failed` batch with applied or unknown rows ends that UTC day's forward run after its restore.
- **C-2:** a `RUNNER ERROR` with no checkpoint means stop, no re-run.
- **Restore order:** `restore --batch A-k` restores Q-k (and dependent EA/ECA) first (Ops M-2, tested).

**Restore calendar (Ops M-6 / Arch M-4):**
- **Per-batch restores** run Sat, inside Sat's caps.
- **A full rollback** is a Founder decision that **moves 013**. Restore days are ≥ Mon 2 after the seed, at ≤ 25k a day, and 013 starts only after the restore is complete and verified.
- **Sun 1:** nothing.

**After the run:**
- D-1 restore Sun 1 ≥ 08:05Z.
- Boost pause row 2 ends at Sun 1 00:10Z by itself.
- Keep `~/MeridianAtlas-work/gleif-a2/` ≥ 30 days after A2 close **and** until 013 closes, independent of `gleif_006.db` (Ops N-8).
- K-5 at A2 close.
