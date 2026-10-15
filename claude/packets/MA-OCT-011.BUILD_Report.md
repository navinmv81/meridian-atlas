# MA-OCT-011.BUILD — Report

**Control:** v1, `claude/packets/MA-OCT-011.BUILD_Control_v1.md`, SHA-256 `b4e3e1e119616b623729850601d99957bf460df5ba98ca25840141d2fe96fdc9` (re-hashed 13 Oct, matches the board row).
**Task:** v1, SHA-256 `e32bfeb6d3b522e5c4ed9fefbda7ed5ad158e6484459df79bc3a6f949978bcc7` (matches the Control).
**Spec:** `claude/MA-OCT-011_Spec.md` rev 1.9, SHA-256 `e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22` (matches the Task).
**Lane:** LANE-11-ENG, Engineering Lead (Claude Code; a new session, separate from LANE-1-ENG). **Write owner:** the 011 runner paths, `~/MeridianAtlas-work/gleif-011/` and this file.

---

## Tue 13 Oct 2026

### Session checks
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`. Branch: `October-2026`. HEAD at start: `45cdb9d`; HEAD at end: `4bf5530`, a LANE-1-ENG commit. **This lane made no git writes** (ML-1012-2), and there were no `.git/*.lock` files at start or end.
- Hashes: the Control, Task and Spec match (above). The 006 FINAL inputs were re-hashed and match their pins: `gleif_006.db` `bd704c14…b047`, classification `cb3b3a84…13df64`, `h12_tiers.csv` `a280c3c2…427c9`, `norm_hidden_duplicates.csv` `9cafca93…a95`, `wrong_lei_detail.csv` `41502aa7…1c01`, D2 `ad4d40a0…abd62` / `23a52f94…299f2f` / `aa2f30a0…4feb`.
- **D1 gate:** this lane ran no D1 query until the ENT-CR1 session had reported **"ENT-CR1 verified"**. Its report, line 1, records C1 applied at 09:33:45 UTC with E1, E2 and E4 passing. This lane's first D1 call was at 09:58:32 UTC.
- Wrangler: `/usr/local/bin/wrangler` 4.96.0 by absolute path, with `-c "App/Corporate Atlas/wrangler-entities-enrich.toml"`. Never `npx`. 0 GLEIF calls. No secret was read or printed.

### Work done (Task items)

| # | Item | State |
|---|---|---|
| 1 | Runner + 4 control scripts | **Built and tested locally.** See below. |
| 2 | Plan generator | **Built.** On the 29 Sep export it reproduces **all 54 checked spec figures**. Two spec findings, F-1 and F-2, are below. |
| 3 | Pre-image, read-back diff, per-batch restore | **Built.** A full rollback on the replica is byte-identical. |
| 4 | Dry run (0 writes) + EXPLAIN set | **Done.** EXPLAIN set 22/22 as expected (0 reads), local dry run passes §9, plus a read-only live probe. |
| 5 | Fail-closed test | **Done** (automated test plus CLI evidence run). |
| 6 | Rollback rehearsal (≤ 20 rows, ≤ 100 writes) | **Not started.** Thu 15 only. The `rehearse` command is built and tested locally. |

**Runner** `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs`, with shared code in `lib/gleif-reconcile-011-core.mjs`:
- **Commands:** `run`, `restore --batch|--all`, `explain`, `probe` (read-only), `recon` (R-4), `rehearse`, `build-replica`.
- **Plan integrity:** executes only a SHA-pinned plan (`plan.sha256` is `shasum -a 256 plan.json`). It refuses a tampered or non-canonical plan, and refuses a non-releasable (dry-run) plan on a remote transport.
- **Interactive only (§7):** write commands need `--operator <name>` and refuse when launched by launchd (parent pid 1). There is no cron and no LaunchAgent.
- **Order of checks before every batch:**
  1. kill switch (`.gleif-reconcile-011-stop` or SIGTERM);
  2. pause flag (`.gleif-reconcile-011-paused`);
  3. calendar + `FREEZES.json` (fails closed if unreadable);
  4. R-4 prior-day sign-off;
  5. A-pilot and E-A holds;
  6. **headroom gate**;
  7. pre-image;
  8. 120 s fetch-age re-check;
  9. execute.
  
  `hold_all_jobs` is read once at start; if it is `true`, nothing runs.
- **Headroom gate (§4.3, ML-1012-1):**
  - `d1-today`: 2 s ceiling, 1 retry; the reading must be today's UTC date and ≤ 120 s old;
  - F-2: a falling `rowsWritten` fails closed;
  - F-1: own unpolled rows over max(45 min, time since last fetch);
  - account + unpolled + batch ≤ **60,000**; 011 day + batch ≤ **25,000**;
  - events counted at 5 writes each (ML-0910-1);
  - Monday: first check must be ≤ 45k.
  
  Any failure means no batch, the cursor unchanged, and `headroom_unavailable`.
- **Per batch (§9):**
  1. Pre-image JSON, with its SHA in the checkpoint.
  2. Execute: one wrangler call of ≤ 250 idempotent statements; 3 retries at 30, 120 and 300 s.
  3. Read back and diff each row: `applied`, `raced` or `mismatch`.
  4. Checkpoint (pre-image, read-back, diff, per-statement `meta`).
  5. Run-log line, written **before** the heartbeat.
  6. Heartbeat through the 002 outbox module (`lib/ops-outbox.mjs`). If the key file is absent, it falls back to the run log.
  
  **Stop conditions:**
  - mismatches > 5 or > 0.5%;
  - writes > 1.3 × declared;
  - any execution > 45k reads;
  - P collision rate > 1%;
  - 3 failures of the same batch;
  - a static check that write SQL touches only `entity_master`, `entity_relationships` and `entity_enrichment_queue`. D1 `meta` lists no tables, so §9's "unexpected table in meta" is enforced on the SQL itself.
- **Run log outcomes:** `success`, `partial`, `failed`, `killed`, `paused`, `budget_limit`, `headroom_unavailable`, mapped to heartbeats as in §7's table. One more outcome, `held`, is used for `hold_all_jobs` (see OQ-8).
- **A pilot and E-A (E-4, RA-14, Ops R-1 (b)):** after A-001 the run stops (`holds/a-pilot.json`). The next A batch needs `--a-adjudication <file>` recording ≥ 50/50 by the Data-Identity Lead with an Ops spot-check. E-A runs only when every A checkpoint has a passed diff, the adjudication is present, `--ea-release` is given, and no `holds/e4-trigger.json` exists; `--drop-ea` is honoured. Under E-2, ECA, E-A and Q statements run only when the A writes they depend on were applied.
- **§4.2c race path:** a B row drained by live Phase 3 is `raced`, never clobbered. It is then upgraded by a **plan-carried, reviewed** fallback C-reasons CAS on `='NO_LINK_DECLARED'` (batch `<id>-fb`), which is itself restorable.
- **Day scoping:** `--until <batch|step>` sets the day's stop point (e.g. Sat 17: `--until B-002`; A from Wed 21). `--max-batches` is also available.
- **Restore (§10):**
  - Every restore statement is a CAS on `gleif_enrichment_version = 11` plus the read-back post-image. A row changed by a live job is listed, not clobbered.
  - Edges: only edges absent from the pre-image are deleted.
  - Parent rows: deleted only if no edge references them.
  - Queue rows: restored from the pre-image.
  - `--all` follows §10's order with ECA before A: Q → E-A → ECA → A → E-C → C-reasons/RC-15/C → B → P.

**Control scripts** (`-status.sh`, `-pause.sh`, `-resume.sh`, `-stop.sh`):
- `-stop.sh` writes the kill flag and sends SIGTERM to the runner's pid. Wrangler runs in its own process group, so the in-flight call finishes, and then the runner checkpoints and exits `killed`.
- `-resume.sh` clears the pause flag. It clears the kill flag only with `--clear-stop`.
- `-status.sh` is read-only. It shows the flags, holds, cursor, today's 011 writes and the last run-log lines, and never shows the key.
- **Tested end to end** on a scratch replica: the runner finished B-028, logged `killed` before B-029 with the cursor unchanged, refused the next start while the flag was set, and `--clear-stop` removed the flag.

**Plan generator** `App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs`:
- `generate` is local only. It verifies all 006 basis hashes and opens `gleif_006.db` read-only (it checks the 28 Sep publication).
- `export` is the X1/X2 keyset export for Fri 16 (read-only, ≤ 45k reads per page, budget guard). **It was not run.**
- **Tier tags (N-2):**
  - Every statement carries tier tags. A write is planned only if its 006 FINAL row is high tier: A = `lei` (d) high; C = (c)/(d) high; C-reasons = (b) high; RC-15 = `name` high.
  - B is limited to the 29 Sep pool (7,436). New pool rows are listed, not written.
  - The 24 wrong-LEI rows and the 9 D7-1 government rows are asserted absent. `normalized_name`, `type`, a non-NULL country, an existing LEI and a non-placeholder name are asserted never written.
- **Rules implemented:**
  - L11-7 cases i–v;
  - Level 2 in the same UPDATE as A (L11-16);
  - E-1 exclusions;
  - B in descending LEI order (L11-15);
  - KI 22.43 marker cleared;
  - contradicted parent = plan fails;
  - P with `INSERT OR IGNORE`, collision listed;
  - normalizer parity asserted (JS `normalizeName` from `src/entities-seed.js` == GC `legal_name_norm`).
- **Outputs:** the 013 hand-off file (R-3; see below), review lists and exceptions, each with its SHA in the plan header.

**Reproduction on the 29 Sep export** (`--expect-006-final`): every figure below matches the spec (spec figure in brackets).

| Group | Measured |
|---|---|
| A base | 4,109 rows / 3,717 LEIs |
| A cases | i 3,285; ii 44 + 348; iii 3; iv 31 LEIs / 62 rows; v 6 LEIs / 19 rows |
| A written | 3,677 |
| Twins to 013 | 392 |
| A Level 2 | RR direct 514, ultimate 556; RX direct 3,163, ultimate 3,121 |
| B | 7,436. Direct: RX 7,358 / RR 71 / neither 7. Ultimate: RX 7,355 / RR 74 |
| RC-15 | 859; 830 in C-reasons, 1 in C, 29 standalone |
| C | 812 entities; 728 direct, 801 ultimate; 738 outside the pool (657 direct, 727 ultimate) |
| C-reasons | 8,345 entities (direct 8,333, ultimate 8,263, ultimate-only 12); 16,596 field writes; 92 with C; 8,253 standalone |
| No-reason NLD | 128 |
| Q | 3,677 |
| Distinct parents | 705 |
| Planned edges / parents | E-C 728 + 299 parents present for E-A (split per F-1 / F-2 below) |

**Cost model:** ≈ 87,248 writes plus ≈ 1,060 heartbeat writes over 106 batches. The spec's no-drain figure is 89,153 including 1,260 heartbeat writes. The difference comes from the F-2 parent reduction (−627), the E-1 exclusion (−4) and rounding at the unit level.

**013 hand-off (R-3)** `handoff-013.json`:
- 392 newer twins, each with its row and its queue row as-is;
- 9 deferred LEIs / 22 rows (3 case iii + 19 case v), **each with the full payload**: Level 1, Level 2, and GC provenance (publication, record LEI, managing LOU, RR/RX records).

**Review lists:** 31 LEIs / 62 rows (case iv), the 9 government rows, 128 no-reason rows, 215 deferred E-A edges and 1 E-1 exclusion.

### Tests
`node --test "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"` gives **17/17 pass**. All tests are local: 0 D1, 0 GLEIF.
- **Unit tests:**
  - calendar and freezes (Sunday; Monday < 08:00; bootstrap 07:55–08:05; enrich; boost bands; F-3 midnight; ENT-CR1 window and fallback; the "011 run window" freeze applies to the other writers only; a missing `FREEZES.json` fails closed);
  - headroom (unavailable, wrong date, > 120 s, F-2 falling, F-1 window = 45 min or time since the previous fetch, 60k ceiling, 25k cap, Monday > 45k blocks the day);
  - the `d1-today` retry;
  - the SQL table check (string literals ignored; foreign tables refused);
  - CAS rendering (`normalized_name` and `type` refused);
  - the diff classes.
- **Integration tests on a local replica** (live DDL from the 006 D0 catalog plus D2 data):
  - **item 5**;
  - pause, kill and `hold_all_jobs` (each 0 writes);
  - tampered plan and non-releasable plan refused;
  - Phase 3 race → `partial`, then the fallback CAS applied;
  - 2 failures then success; 4 failures → `failed`, cursor unchanged;
  - writes > 1.3 × declared → stop;
  - `--until` day scoping;
  - **full simulated run + §9 checks + full rollback** (below).

**Item 4: dry run, 0 writes** (`tests/gleif-reconcile-011-dryrun.mjs`). Plan `dryrun-d2-v4` was run against the replica with a simulated clock from Sat 17 07:20 and a stubbed `d1-today`. Writes are counted on the cost-model basis on the replica.

| Measure | Result |
|---|---|
| Days | Sat 17: 24,503 · Mon 19: 24,633 · Tue 20: 23,650 · Wed 21: 14,462 (max ≤ 25k) |
| Sunday / calendar | no writes on Sunday; 0 calendar violations |
| Holds | A pilot on Tue 20; E-A release on Wed 21 |
| §9: LEI-bearing rows | **20,304** |
| §9: Phase 3 pool | **8** (≤ 10) |
| §9: `NO_LINK_DECLARED` | **152** |
| §9: `ultimate_parent_exception` set | **18,739** |
| §9: `legal_parent` edges | 1,089 = 66 + E-C 680 + ECA 45 + E-A 298 |
| A applied / queue closed | 3,677 / 3,677 |
| New duplicate LEIs | **0** (the 3 pre-existing duplicates are unchanged) |
| Full rollback | entity_master, entity_relationships and the queue are **byte-identical** to the original (`2e4a052b…9ba5e`) |

The Sat 17 pilot scoping (`--until B-002`) and A from Wed 21 (`--until A` on Tue) are operator choices, tested separately.

**Item 5: fail-closed** (CLI evidence, `selftest/failclosed-2026-10-13/`). `d1-today` was pointed at an unreachable host (192.0.2.1). Result:
- replica SHA before = after (`3ced87df…5286`), i.e. **0 writes**;
- one run-log line: `outcome: headroom_unavailable`, `writes: 0`, cursor `P-001 → P-001`;
- one `failed` heartbeat with `error.class = headroom_unavailable`;
- no cursor file, and no pre-image read (the gate runs first).

### D1 reads and writes, per statement (ledger `d1-ledger.jsonl`, `meta` per call)

| UTC | Call | Statements | rows_read | rows_written |
|---|---|---|---|---|
| 09:58:32 | EXPLAIN set (first: V2 used `idx_entity_master_phase3`) | 15 | 0 | 0 |
| 09:58:52 | EXPLAIN set (V2/V2p pinned with `INDEXED BY idx_entity_master_lei`) | 16 | 0 | 0 |
| 09:59:28 | EXPLAIN set (+ fallback + 4 restore patterns) | 21 | 0 | 0 |
| 09:59:37–42 | probe, 50 rows per step: P 52 · B 100 · C 100 · CR 100 · RC15 58 · EC 153 · A 100 · ECA 89 · EA 144 · Q 100 | 13 | 996 | 0 |
| 10:00:44 | EXPLAIN set, final (+ RECON) | 22 | 0 | 0 |
| 10:00:44 | recon 2026-10-13 (`ops_job_run`, 0 rows) | 1 | 2 | 0 |
| **Total** | | | **998** (budget 20k) | **0** (limit 100, Thu only) |

**EXPLAIN set (final; `explain-remote-ro-2026-10-13T100044777Z.json` `ad7b06d5…d35c`).** 22/22 match the expected plan. **No SCAN of any table.**

| Id | Plan |
|---|---|
| X1 / X2q / X2r | `SEARCH … USING INTEGER PRIMARY KEY (rowid>?)` |
| V1, W1-B/C/CR, W1-fb, W3, R1-em, R4-q | `… (rowid=?)` |
| V2 / V2p | `idx_entity_master_lei (lei=?)` |
| V2e | `idx_entity_rel_child` |
| W1-A | PK + `SEARCH o USING COVERING INDEX idx_entity_master_lei` |
| W4 | `c` / `x` / `p` on `idx_entity_master_lei` |
| R2-P | PK + `idx_entity_rel_parent` + `idx_entity_rel_child` |
| R3-edge | `sqlite_autoindex_entity_relationships_1 (parent, child, type)` |
| RECON | `idx_ops_job_run_job_at (job_id=? AND started_at>? AND started_at<?)`, plus a temp B-tree for the phase tie-break only (same as 001 Q5) |
| HOLD | `sqlite_autoindex_holdings_pipeline_state_1` |

**Probe (`probe-2026-10-13T095937123Z.json` `db587ccd…1639`).** The live pre-image still matches the plan for 492 of 493 sampled rows. One P parent LEI now already has a row: that parent will be skipped at plan time on Friday.

### Findings for the Fri 16 release review (Architect + Operations Lead)

**F-1 — E-A is 298, not 299.**
- Q52's 299 counts edges whose parent exists after P, and it predates the E-1 exclusions (OPS-R2).
- E-1 lists one edge instead of writing it: child 99231, whose parent `549300CZ8QS1GE53O776` is a wrong-LEI row (RC-12).
- 298 + 1 + 215 deferred = 514 (Q51).

**F-2 — P and A claim the same 51 LEIs (needs a ruling; changes the P count).**
- 51 of the 365 "missing" parent LEIs are also A targets: they are T1 matches of existing no-LEI rows (e.g. Robinhood Markets, HKEX).
- As sized, P would insert a new `holding` row for each. A's "LEI on no other row" guard would then refuse the operating row. The result is 51 A rows lost and 51 duplicate entities. The local simulation showed exactly this (A 3,626 applied, 51 raced) before the fix.
- Another 6 P parents are the GC match of an existing no-LEI row in the T1_LAPSED tier (report-only). They would also duplicate identities.
- **As built:**
  - P inserts **308**.
  - The 51 parent rows come from A itself (spec §3.1: "parent exists after step P (D2, **A** or C-created)").
  - Their 45 E-C edges move to a new step, **ECA**, after A. ECA depends on the parent's A write and is blocked by E-4.
  - The 6 are deferred and listed; their 3 edges wait. The children's parent mirrors (strings) are still written.
- **Effect:**
  - P −57 rows (−627 writes);
  - edges 728 = 680 E-C + 45 ECA + 3 deferred;
  - E-1 then excludes only the 1 wrong-LEI parent. The earlier "5 parents held by > 1 row" were artifacts of the same double claim.
- **Alternative if the ruling differs:** keep P at 365 and withhold those 51 A rows. That loses 51 A writes and creates 51 duplicate-identity pairs. Not recommended.

**F-3 — The read budget needs re-baselining.**
- Measured: D1 counts **2 rows read per row on an `IN (…)` point lookup** (V1: 100 reads for 50 rows).
- Per batch: pre-image + read-back + CAS ≈ 5–6 reads per statement. Over ≈ 25.5k statements that is ≈ 140k, against §6's ≈ 45k for "pre-images and CAS".
- With the two ≈ 74k exports, the plan is ≈ 290k against §6's 250k ceiling.
- Every single execution stays ≤ 1k reads, and the whole run is < 6% of one day's 5M read cap.
- The X1/X2 export multiplier (range scan by rowid) is not yet measured. Friday's export will measure it; `export` aborts above its `--max-reads`.

### Open questions (for the Architect / Operations Lead / Data-Identity Lead; none blocks Wed 14 work)

- **OQ-1 (F-2):** confirm P 308 + ECA 45 + 6 deferred parents. Data-Identity Lead and Architect.
- **OQ-2 (F-3):** read ceiling. Operations Lead.
- **OQ-3:** reason text = GC `reasons_all`, verbatim and pipe-joined, as 006 classified it (`day5_classify.py` `rx_reason`). Where GLEIF gives more than one reason, the field holds them all, e.g. `NO_KNOWN_PERSON|NATURAL_PERSONS`. The alternative is the first reason only.
- **OQ-4:** mirror names (`*_parent_name`) = the parent's GC legal name. Live Phase 3 uses the D1 parent row's name; the GC name keeps the §9 sampled diff against `gleif_006.db` exact.
- **OQ-5:** 011 does not touch `updated_at`. §3's provenance list omits it, and 011 never uses it as a change marker.
- **OQ-6:** `lei_status` is written only where it is NULL (A and B rows). This protects the 2,946 registration-status values (L11-5).
- **OQ-7:** `hold_all_jobs = true` gives run-log outcome `held` and heartbeat `skipped` / reason `hold`. This is outside §7's vocabulary: accept or remap.
- **OQ-8:** a calendar or freeze refusal starts no batch. It goes to `gate.jsonl` and the console, with no run-log line and no heartbeat.
- **OQ-9:** the dated freeze "011 run window — other Entities writers frozen" is matched by name prefix and does not block 011.
- **OQ-10 (Main Lane, commit list):** `.gitignore` does not cover `App/Corporate Atlas/.gleif-reconcile-011-paused` / `-stop`. It is not a 011 path, so this lane did not edit it.
- **OQ-11 (MA-OCT-011.T12 / LANE-1-ENG):** the runner reads the ingest key from `~/MeridianAtlas-work/gleif-011/ops-ingest.env`. The file must be mode 600 (otherwise it is ignored) and hold `OPS_INGEST_URL`, `OPS_EMITTER` and `OPS_INGEST_KEY`. The key is never printed (K-2).
- **OQ-12:** the report-only tier lists in `review-lists.json` (`report_only_tiers_draft`) are a text-pattern draft. They do **not** reconcile with the spec's 1,342 / 1,739 / 852 / 2,336. They are a close-out deliverable, never a write input, and will be reconciled with the Data-Identity Lead's 006 definitions before close-out.

### Files (SHA-256; all untracked, no git writes)

| File | Lines | SHA-256 |
|---|---|---|
| `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` | 795 | `62e35bd5cdfb2073ec9f96990da5038c495c90d59ca16b195f784633fe77f0fc` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs` | 672 | `6a4564f6a77a2cd558acab463d7c0fc92a8772f5190207fa4e068fd48e8eb890` |
| `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` | 496 | `4aedd09c9f74b30ef3dbf3e69e136bfa51f2d0708058a3a028050b8a11461a2f` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-status.sh` | 59 | `bfa291793b989f61a3d092e5bf9e1af6fe376e2e2bc7c1b1bdbfc72feaadcd1d` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-pause.sh` | 16 | `9aecea8dd4e8449054968f4890d0d7627c6bd72f6d77c3c2a3a3190e69a8a712` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-resume.sh` | 25 | `c1be3c32401744b32aca0df4a4e9c746f5a72166209526c888e7b9dcfaeeb0af` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-stop.sh` | 30 | `43405bdac4a502ce84e61f465f32737273ea344a125820daa815f4a79c382fdb` |
| `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` | 278 | `355388364cbcd36cb7f4c2c14dd58d6f9e4fb1028a0d2dca6962ee3f737a6fd7` |
| `App/Corporate Atlas/tests/gleif-reconcile-011-dryrun.mjs` | 94 | `9914929431955d143e3f3abf5e0a5d1bd31f54ede4226e20872475d3bad3a865` |

**Work folder** `~/MeridianAtlas-work/gleif-011/` (mode 700):

| File | SHA-256 |
|---|---|
| `plans/dryrun-d2-v4/plan.json` (**current dry-run plan; not releasable**: it is built from the 29 Sep export) | `d2343d3d01774b193745ff6be5bc88f5d16076254e10f902688856dc95d2a517` |
| `plans/dryrun-d2-v4/handoff-013.json` | `4a286f35405094b27cf63051e47029ffe89eddcfff58ffdd2b2a6093369d90b1` |
| `plans/dryrun-d2-v4/review-lists.json` | `2459fb527881069281c0797c2ef5b8e12f189af1d3cfaf1b717172f8a7181726` |
| `plans/dryrun-d2-v4/exceptions.json` | `e7855f19c933997692915e1d900ebf59e4b4d79d8bd3c774bcdbe96dddb8b22d` |
| `dryrun/2026-10-13-d2-v4/summary.json` | `2465cd67c3396b2ac57fd9f18650eeeaf9d51943446cc2f4f4f1d99eb645ebef` |
| `explain-remote-ro-2026-10-13T100044777Z.json` | `ad7b06d5668acf67b39b8785d8de3094ece4af3cb5e3097ab16a78ce8611d35c` |
| `probe-2026-10-13T095937123Z.json` | `db587ccd86d5f7044176036c4ce70e260ce708d702160fc36f53b68719971639` |
| `selftest/failclosed-2026-10-13/cli-output.txt` (gate-first run) | `ed1fad99fdcad75bed7240b78a7906f475ef6b20acf9189a7627b846cf688385` |
| `selftest/failclosed-2026-10-13/work/runlog.jsonl` | `ba1456429b071d81fbdfd71550b485a4df7c07c3c3889d1e1423cfb4bc9331f6` |
| `selftest/recon-2026-10-13/manifest.json` | `650fc089845ae9f2586c2b8975091c9a0b025c358952be43e6a2ef5ac27035de` |

Plans v1–v3 in `plans/` are superseded: v1 has the F-2 double claim, and v2/v3 have the older SHA pin. Their batches equal v4's from v2 on (`6bb8df99…`).

### Next (Wed 14 – Thu 15)
- **Wed 14:**
  - read the 002 outbox go-live state (A4) and confirm the runner against the live module;
  - optionally re-run the EXPLAIN set (0 reads);
  - build the §9 post-run verification tool: local counts from the re-export, the 200-row sampled diff against `gleif_006.db` with ≥ 25 E-A edges, and the ≥ 10 A-row spot-check list;
  - build the freshness-gate sample selector (≥ 15 A rows of ≤ 50, for Fri 16; no GLEIF calls in this packet).
- **Thu 15:** `d1-today` check, then the **rollback rehearsal**: 20 C-reasons rows that still match the plan pre-image, ≈ 40 writes forward + ≈ 40 restore, ≤ 100 in total, inside a run window. Then the final report.

**Stop point:** end of day, Tue 13.

---

## Wed 14 Oct 2026

### Session checks
- The Control `b4e3e1e1…6fc9` and the Task `e32bfeb6…bcc7` were re-hashed and match. Board state: EXECUTING. Branch `October-2026`; HEAD `1b9dbde` at start and `3960aee` at end (other lanes' commits). No locks. **No git writes by this lane.**
- Every file this lane wrote on Tue 13 still has its reported SHA-256: none was edited outside this lane.
- **Spec:** the build stays bound to **rev 1.9** (copy `claude/packets/MA-OCT-011_Spec_rev1.9.md` = `e09c01b9…2d22`, verified). `claude/MA-OCT-011_Spec.md` is now **rev 1.10** `63280691…0aaa` (MA-OCT-011.R110, REVIEW_NEEDED; review Thu 15), read for awareness. Rev 1.10 adopts F-2 and F-1 as built (P 308, ECA 45, E-A 298) and rules OQ-3/4/5/6/12. OQ-7/8/9 are accepted (Decisions Log 13 Oct). **Every one of these rulings matches the build. No code change was needed except OQ-12, below.**
- 0 GLEIF calls. No secrets read or printed. D1 was touched only for the read-only EXPLAIN set, at 05:22 UTC, outside today's ENT-CR1 fallback window.

### Work done
1. **OQ-12: report-only lists reconciled** (rev 1.10 §3.5 definitions, on 006 FINAL `classification.csv`, `field = 'lei'`, tier tokens matched on `;` boundaries).
   - Counts: **T1_LAPSED 1,342 · T1+/T1c 1,739 · N+ duplicates 852 · review tiers 2,336**, exact.
   - The generator asserts that none of the four lists contains a D7-1 government row and that no A statement lands on a report-only row.
   - The lists are in `review-lists.json` `report_only_tiers`. `--expect-006-final` now checks **58 figures, all reproduced**.
   - The plan batches are unchanged by this (`6bb8df99…`, identical since v2).
2. **Outbox integration (002 A4 module `lib/ops-outbox.mjs`, unchanged since `8f06ed0`, `34114dda…4278`).** New test: the runner, with heartbeats enabled, against a local ingest stub that applies contract v1 (rules copied from `ops-api.js` `validateRunEvent`). Results:
   - every event the runner emits is accepted (start, success, plus failed, killed and skipped in other tests);
   - an Ops outage (503) spools the events, and they are replayed under the same `run_id` after the next delivered event;
   - **ML-1010-3**: `ownWrites` = run-log writes + 5 × delivered events (including replays), exact.
   
   A4 goes live in LANE-1-ENG today. The runner needs no change. The ingest key file is still MA-OCT-011.T12 (OQ-11).
3. **§9 verification tool** `App/Corporate Atlas/scripts/gleif-reconcile-011-verify.mjs`:
   - `postrun`: §9 checks computed **locally from X1/X2-format exports** (V3: no COUNT on D1). It adds the pre-image invariants (`normalized_name`/`type`, existing LEI, non-NULL country, non-placeholder name, the 24 wrong-LEI rows, KI 22.9's edges, new duplicate LEIs) and the **200-row sampled diff against `gleif_006.db` with ≥ 25 E-A edges** (E-3; each edge parent checked against the child's RR direct parent).
   - `sample`: the Fri 16 freshness-gate sample (≤ 50 rows, **≥ 15 A**, unique LEIs, seeded and reproducible), and with `--n 25 --min-a 10` the post-run API spot-check list (R-1 (c)).
   - `compare`: offline. ≥ 98% agreement; any A identity mismatch (legal name, country or LEI) is an **E-4 trigger**; the gate fails below 15 A rows.
   - `fetch`: one `GET /lei-records/{lei}` per row, hard cap 50. It **refuses unless `--confirm-gleif-calls` equals the sample size**. **Not run.**
   - `plan export` now also takes `--transport local:<db>`, so the dry run produces exports in the same format as Friday's.
   - The dry run snapshots the post-run state (`post-run.db`, via `VACUUM INTO`) before its full rollback. `exceptions.json` now lists the 24 wrong-LEI IDs and the 9 government IDs for the post-run check.
4. **Rehearsal (Thu 15 path) exercised locally for the first time.** On a replica, 20 C-reasons rows were applied, then restored, and every row returned to its exact pre-image. A row whose live value had drifted since the export was **skipped and left untouched**. A selection whose estimated writes exceed 100 (20 B rows) is **refused** before any write.

### Tests and evidence
- `node --test "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"` gives **23/23 pass**. New since Tue: outbox / contract v1; freshness and spot-check samples; freshness compare (E-4 trigger); GLEIF fetch refusal (0 calls); rehearsal; rehearsal budget refusal; §9 post-run from exports (inside the full-run test).
- **Dry run on plan `dryrun-d2-v6`:**
  - writes per day: Sat 17 24,503 · Mon 19 24,633 · Tue 20 23,650 · Wed 21 14,462;
  - 0 calendar violations;
  - full rollback identical (`2e4a052b…9ba5e`).
- **`verify postrun` on its exports:** **PASS**.

| Measure | Result |
|---|---|
| LEI rows | 16,627 → **20,304** |
| New parent rows | 308 |
| Phase 3 pool | 8 |
| NLD | **152** |
| `ultimate_parent_exception` | **18,739** |
| `legal_parent` edges | 66 → 1,089 |
| A rows | 3,677 |
| New duplicate LEIs, wrong-LEI rows touched, `normalized_name`/`type` changed, LEI / country / non-placeholder name overwritten | **all 0** |
| KI 22.9 edges | unchanged |
| Sampled diff | **200/200**, 25 E-A edges |

- **Local export reads (replica):** 73,403 (pre) and 74,734 (post), matching §6's ≈ 74k per export. The D1 multiplier for range scans is still to be measured at Friday's export (F-3).
- **Samples (dry-run plan):**
  - freshness: 50 rows, 15 A (A 15, CR 22, B 13);
  - spot-check: 25 rows, 10 A.
  
  Friday re-samples from the releasable plan.

### D1 reads and writes

| UTC | Call | Statements | rows_read | rows_written |
|---|---|---|---|---|
| 05:22:34 | EXPLAIN set on plan v6: 22/22 as expected (same SQL hash `f5ae0dba…` as Tue's final set) | 22 | 0 | 0 |
| **Day total** | | | **0** | **0** |
| **Packet total** | | | **998** of 20k | **0** of 100 |

### Thu 15 rehearsal procedure (≤ 20 rows, ≤ 100 writes)
1. Check that it is inside a run window and outside every `FREEZES.json` window (07:15–10:40 or 11:20–16:40; not 07:55–08:05). The runner refuses otherwise.
2. `scripts/gleif-reconcile-011-status.sh`: no flags, no runner.
3. `node scripts/gleif-reconcile-011.mjs rehearse --plan ~/MeridianAtlas-work/gleif-011/plans/dryrun-d2-v6 --step CR --rows 20 --max-writes 100 --transport remote --operator EngLead-LANE-11`.
   - The startup gates read `hold_all_jobs`.
   - It probes up to 60 CR rows (V1, ≈ 120 reads) and keeps only rows whose live state still equals the plan pre-image.
   - The headroom gate checks `d1-today`.
   - Forward batch (≈ 40 writes declared; stops at > 1.3×), read-back diff, then restore (CAS on `gleif_enrichment_version = 11` + post-image), then a verify that every row equals its pre-image.
4. Record per-statement `meta` (the first measured multipliers for the CR pattern), the checkpoints with their SHA-256s, and total writes ≤ 100.

**Stop on:** any mismatch, writes > 1.3× declared, or headroom unavailable.

### Files (SHA-256; untracked; no git writes)

| File | Lines | SHA-256 |
|---|---|---|
| `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` | 795 | `62e35bd5cdfb2073ec9f96990da5038c495c90d59ca16b195f784633fe77f0fc` (unchanged) |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs` | 694 | `922ce5c7cf9f60d83e9143f94d41a77b1fd94922181a25f3672f42a5005317f4` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-verify.mjs` (new) | 208 | `4e29340a11a60a6f46f6d37a19ca6920bb76e22bbd498a86db1947a914e2c30b` |
| `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` | 496 | `4aedd09c9f74b30ef3dbf3e69e136bfa51f2d0708058a3a028050b8a11461a2f` (unchanged) |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-{status,pause,resume,stop}.sh` | — | unchanged since Tue |
| `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` | 413 | `679599faa0d6b1f5263010b77286f75b65193c4f965f089b27e85c37908504f0` |
| `App/Corporate Atlas/tests/gleif-reconcile-011-dryrun.mjs` | 97 | `54762291226bf9983601a352be146ae04031662385d849303b6d04f42b215482` |

**Work folder** `~/MeridianAtlas-work/gleif-011/`:

| File | SHA-256 |
|---|---|
| `plans/dryrun-d2-v6/plan.json` (**current dry-run plan; not releasable**) | `602ab58ab8f75c2c2455559224856eb3c8e1dc9f8dc97fc3985c71f7899bd6bf` |
| `plans/dryrun-d2-v6/handoff-013.json` | `4a286f35405094b27cf63051e47029ffe89eddcfff58ffdd2b2a6093369d90b1` (unchanged) |
| `plans/dryrun-d2-v6/review-lists.json` | `db65589b046990c21205e5f5016f78a5eab7229482eb324cb246149bed1ee5e3` |
| `plans/dryrun-d2-v6/exceptions.json` | `aa6d17e5cc3fbe293bab111bd29b5174e4a37585360519825b07d569ee6ef89a` |
| `dryrun/2026-10-14-d2-v6/summary.json` | `9c608102c7ce86fbcf9e11bb098892e1ec887bfa2ce20dcd62e512314ed4de3d` |
| `dryrun/2026-10-14-d2-v6/postrun.json` | `d6cc0a51db65036682963cd0bf03846d4cb184ba3ff8ac122ed1fdbd04397047` |
| `explain-remote-ro-2026-10-14T052236489Z.json` | `c1e9dd415072a32ba46a9445ba68ddb4e6263cebefa79f6dc12e0210909c3738` |
| `selftest/freshness-sample-dryrun.json` | `4b1d5903ef0a1fb137b45494c1f0c3b074a93e4482f68a2d4089df9c12166c83` |
| `selftest/spotcheck-sample-dryrun.json` | `ad64975b73b06f13b34abeac3c9a046d8bc1e0aa1889088c35cc135b3938b890` |

### Open items

| Item | State |
|---|---|
| OQ-1 (F-2) | Adopted in rev 1.10; awaits the Thu 15 review |
| OQ-2 (F-3), read ceiling | Operations Lead, Thu 15 |
| OQ-3/4/5/6/7/8/9/12 | Ruled; all match the build |
| OQ-10 (`.gitignore` for the two flag files) | With the Main Lane |
| OQ-11 (ingest key file format for MA-OCT-011.T12) | Open |
| New: plan files and rev 1.10 | When rev 1.10 is approved, the Fri 16 plan header should cite it alongside rev 1.9. That is a one-line change to the `spec` field in the generator, held until approval. |

**Stop point:** end of day, Wed 14.
