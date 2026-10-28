R9-3: export reads = 73,489 (X1 44,040, X2 29,449; multiplier 1.0); projected total = 73,489 + 140k + 73,489 = 286,978; outcome = PROCEED (≤350k)

# MA-OCT-011.FRI — Report (Fri 16 Oct 2026, run under ML-1016-1)

**Control:** v1 `claude/packets/MA-OCT-011.FRI_Control_v1.md`, SHA-256 `5a0de827df3e36f41f973fce24c84a5dd5a2077413f937fcfb9b02e7f67b9bb6` (matches the board row).
**Task:** v1, SHA-256 `533473453bacebfc323961fabaf47196530796bbf7e8302f34e12bc06f3b9566` (matches the Control).
**Lane:** LANE-11-ENG, Engineering Lead (the session that ran MA-OCT-011.BUILD).
**Start:** the Founder's instruction in chat at 20:37 UTC under **ML-1016-1** (the 15:00 UTC target waived; still Fri 16 after the 06:50 cron, so §4.2c holds).

## Result

| Item | Outcome |
|---|---|
| 1 Preflight | PASS: all hashes match; no locks; HEAD `0dd7ef0` |
| 2 Fresh export | **73,489 reads** (cap 160k); max page 5,000; 0 writes |
| 3 R9-3 | **PROCEED**: projected 286,978 ≤ 350k; ceiling **350,000** |
| 4 R9-1 runner ceiling | **Implemented** (it was missing) and tested; ceiling record written |
| 5 Plan | **Releasable plan `e3854698…e6a8`**, ≈ 83.9k writes + ≈ 1.1k heartbeat writes ≤ 110k; drift fully traced |
| 6 Freshness gate | **PASS: 50/50 (100%), 15 A, 0 A identity mismatches**; 50 GLEIF calls |
| 7 Release-check evidence | Below |

**Budget used:**
- **D1 reads 73,489** (limit 170k);
- **D1 writes 0**; no Ops heartbeats were sent (no runner batch ran);
- **GLEIF calls 50** (limit 50);
- **no git writes**.

## 1. Preflight (20:37 UTC)
- No `.git/*.lock`. HEAD `0dd7ef0` (LANE-1-ENG 007.P1; the Control issued at `d0e6847`).
- Control and Task match.
- Spec rev 1.10 `63280691…0aaa`, OPSR report `87d2036e…6b1f`, my build report `c8f66428…653f` and `FREEZES.json` `cdc9606a…c346` all match.
- All 011 files match the build report: runner `333e48e2…`, core `4aedd09c…`, plan `922ce5c7…`, verify `d649ad52…`, tests `79cce99f…`, dry run `1510c072…`, the 4 control scripts.
- `STATUS_BOARD.md` shows **rev 1.10 APPROVED** (Founder, 15 Oct), so the plan header cites rev 1.9 and rev 1.10.

## 2. Fresh X1/X2 keyset export (20:38:47–20:39:00 UTC; read-only transport)
- **First attempt, 20:38:16:** failed on its first page with Cloudflare API **code 7403** ("account is not valid or is not authorized"). It read 0 rows.
  - `wrangler whoami` showed a valid OAuth session (`d1 (write)`, `account (read)`) but an empty account list.
  - The wrangler OAuth config was rewritten at that same second (token refresh). No Cloudflare environment variable overrides it.
  - A `SELECT 1` 25 s later succeeded with 0 reads.
  - I treated it as a transient refresh race and re-ran the export unchanged. No login and no prompt was involved.
- **Before the export:** `export` now records every page in the work-folder D1 ledger, which R9-1 sums.

| Table | Rows | Metered reads | Pages | Max page | Multiplier | File SHA-256 |
|---|---|---|---|---|---|---|
| X1 `entity_master` | 44,040 | 44,040 | 9 | 5,000 | **1.0** | `b7aa0122baea3ddbc26b68f6b1d6fb0be955969969cd049f3bf81df89f7c389a` |
| X2 `entity_enrichment_queue` | 29,108 | 29,108 | 6 | 5,000 | 1.0 | `1190b55f28a1e5d90d8a9d652e558052fcd9705d6d558d40ce889bade7da7a49` |
| X2 `entity_relationships` | 341 | 341 | 1 | 341 | 1.0 | `5cd873c4b87a333ea31c4f0abcd45ba372595222d8232c3a081ade339311ca17` |
| **Total** | 73,489 | **73,489** | 16 | — | 1.0 | manifest `6ce3fcf6c67deb24b35c683b8218428526ff6e66816383f6f26c132ec3803be6` |

Keyset range scans by rowid meter **1 read per row**. The 2× multiplier (F-3) applies only to `IN (…)` point lookups (pre-image / read-back), as measured Thu 15.

## 3. R9-3 re-projection
The line is at the top of this report: **PROCEED**. The post-run re-export is projected at Friday's figure (73,489); the ≈ 140k run reads come from Thu 15's measured 2×.

## 4. Runner read ceiling (R9-1): implemented, tested
This was **missing** in the build. It is now on the 011 paths:
- **Ceiling record** `~/MeridianAtlas-work/gleif-011/read-ceiling.json` (mode 600; `b6851744…5774`): `{ceiling: 350000, outcome: "PROCEED", since: "2026-10-16T20:38:47.891Z", per_day_max: 200000, r9_3: {…}}`.
- **Cumulative total** = Σ `meta.rows_read` over every remote D1 call in `d1-ledger.jsonl` since `since` (the runner and the plan export both write that ledger). **Now: 73,489 / 350,000.**
- **Gate, before each step:** `executeBatch` refuses a remote step **before any D1 read** if cumulative + the step's estimate (6 × statements + 10, from Thu 15's measured 2× point lookups plus 1 per CAS) would exceed the ceiling, or 011's reads that UTC day would exceed 200k. The refusal is run-log `budget_limit` with heartbeat `skipped` / `budget`.
- `run` on a remote transport **refuses to start without the ceiling record** (fail closed).
- `export` after Friday is capped to the remaining headroom (min of ceiling and day caps).
- Every execution stays ≤ 45k reads (existing limit).
- **Logged in each `recon/<date>/manifest.json`** as `reads_011 {cumulative, ceiling, today, day_max, since}`.
- **Tests (4 new):** the decision logic (missing record, over the ceiling, over 200k/day, OK); the total counts only reads since the export; the runner stops before a batch that would cross the ceiling with **0 D1 calls and 0 writes**; recon logs the totals.

## 5. Plan generation (local; 0 D1 reads)
**Plan** `~/MeridianAtlas-work/gleif-011/plans/release-2026-10-16/plan.json`, **SHA-256 `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8`** (`shasum -c plan.sha256` OK).
- `releasable: true`; 106 batches; cites rev 1.9 and rev 1.10.
- Files: `handoff-013.json` `0597e15d…6009` · `review-lists.json` `db65589b…e5e3` · `exceptions.json` `08417ae3…45dd`.

**Counts per bucket** (29 Sep basis in brackets):

| Bucket | Count |
|---|---|
| P | **304** [308]; plus 50 parents created by A [51] and 6 deferred (F-2) |
| B | **5,823** [7,436] |
| C | 806 entities [812]; 738 outside the pool [738] |
| C-reasons | **9,952** entities [8,345]; 9,860 standalone; 19,810 field writes |
| RC-15 | 859 (830 / 1 / 29) |
| E-C | **675** [680] |
| A | **3,676** [3,677] |
| ECA | **44** [45] |
| E-A | **298** [298]; 1 E-1 exclusion; 215 deferred |
| Q | **3,676** |
| 013 hand-off | 392 twins + 9 LEIs / 22 rows (unchanged) |
| Report-only lists (OQ-12) | 1,342 / 1,739 / 852 / 2,336 |

**Tier tags (N-2):** every statement is tagged. The generator's assertions passed: no wrong-LEI or D7-1 row, no `normalized_name`/`type` write, no overwrite of an LEI, a non-NULL country or a non-placeholder name, and every A row is `lei` (d) high. **0 statements from excluded tiers.**

**Write projection:**
- **83,922** writes (P 3,344 · B 23,424 · C 2,860 · C-reasons 19,719 · RC-15 29 · E-C 2,700 · A 23,126 · ECA 176 · E-A 1,192 · Q 7,352) + ≈ 1,060 heartbeat writes ≈ **84,982** (≤ 110k; rev 1.10 expected ≈ 85,862).
- Schedule from the dry run on a replica of tonight's export (cost-model writes, ≤ 25k/day): **Sat 17 24,459 · Mon 19 24,917 · Tue 20 24,742 · Wed 21 9,804**. 0 calendar violations; holds in order (A pilot, then ECA/E-A release); full rollback identical.
- The Sat 17 pilot is scoped by `--until B-002` (P-001, P-002, B-001 ≈ 4.3k writes; §4.4).

**Drift vs the 29 Sep basis, traced row by row (ML-1015-3).** All of it is live Phase 3 between 29 Sep and tonight:

| Bucket change | Rows | Cause (from the fresh export) |
|---|---|---|
| B −1,613 | 1,613 pool rows | Drained by live Phase 3 (§4.2c). **1,607 are now C-reasons rows** (generic `NO_LINK_DECLARED` → real RX reason). **6** had RR parents, which Phase 3 wrote itself, so there is no C gap left: entities 204894, 205987, 208343, 211900, 213819, 407471. |
| C-reasons +1,607 | 1,607 | The drained pool rows above; 0 C-reasons rows from anywhere else. |
| C −6 entities (812 → 806; direct 728 → 722, ultimate 801 → 795) | 6 | The same 6 drained RR rows (parents now in D1). |
| P −4 (308 → 304) | 4 parent LEIs | Phase 3 created holding rows for them: `254900KNRZSJOJRKPW61` (row 497274), `529900Z75ML9ET439V59` (467291), `549300FTHL5PLMP0NE65` (502684), `894500CEIW278REU1682` (502683). **This covers the "P parent now already present" probe hit of 13 Oct: skipped, listed.** |
| P A-overlap 51 → 50 | 1 | `529900W3MOO00A18X956` (OTP Bank): Phase 3 created holding row 467290 on 6 Oct. |
| A −1 / Q −1 / ECA −1 | 1 / 1 / 1 | **Row 2019 "OTP Bank Nyrt" withheld: "LEI now on another row"** (467290 above). Its ECA edge (child 205987) is now Phase 3's own edge. **Note for 013 / MA-OCT-004:** live Phase 3 has created a duplicate-identity pair (operating 2019 without LEI + holding 467290 with it), exactly the F-2 pattern. 011 does not write it. |
| E-C −5 | 5 edges | Phase 3 wrote these edges with the parents above (children 204894, 208343, 211900, 213819, 407471). |
| New pool rows not in the 006 basis | 2 | 502683, 502684 (Phase 3-created parent rows). Listed, not written (N-2). |
| `not_in_006_tier` | 6 fields | RX reasons on Phase 3-created rows 467290, 467291, 497274 (no 006 classification). Listed, not written (N-2). |
| Fresh LEI rows 16,632 | **+5** vs 16,627 | Exactly the 5 Phase 3-created holding rows above. |

**E-1 exclusions:** 1 (the wrong-LEI parent, unchanged from F-1). E-C edges deferred (F-2 identity overlap): 3.

**§9 expected figures (ML-1015-1), whole-table basis (governing):**

| Measure | Expected |
|---|---|
| LEI-bearing rows | **20,612** = 16,632 (fresh) + 3,676 A + 304 P, i.e. the nominal 20,612 + drift 5 − 1 A withheld − 4 P already present |
| 29 Sep traceability basis | 20,303 (16,627 + 3,676) |
| `NO_LINK_DECLARED` | 155 (152 + the 3 Phase 3 parent rows outside the 006 tiers) |
| Phase 3 pool | 10 (8 + the 2 new rows) |
| `legal_parent` edges | 73 → 1,090 |
| `ultimate_parent_exception` on existing rows | 18,738 |
| New duplicate LEIs | 0 |

`verify postrun` on the dry run of this plan (`dryrun/2026-10-16-release/postrun.json` `c5cbfa71…b146`) gives **PASS**: whole table observed 20,612 = expected 20,612 (drift 5, all before the run, unexplained 0); sampled diff **200/200 with 25 E-A edges**; every invariant 0.

**Found and fixed in the verify tool** (no plan change). The first `postrun` showed 199/200. The sampled diff compared `legal_name` on every touched row, but on C / C-reasons rows 011 writes only reasons and provenance and never Level 1 (RC-8). Row 1145 "Dauch Corporation" keeps its June legal name, while GC 28 Sep has the rename. The diff now compares **exactly the columns each plan statement writes** (every column of a P insert). A test proves both directions: a stale name on a C-reasons row is not flagged, and a wrong name on an A row is.

**Observation for RELARC (no action taken).** Such C rows still receive `lei_validation_source = 'GC-20260928-1600'` (§3 provenance) while their Level 1 stays older than GC. That is as specified (RC-8 out of scope).

## 6. Freshness gate (§11, R-1 (a)): PASS
- **Sample:** seed `MA-OCT-011.FRI-2026-10-16`, drawn from the releasable plan `e3854698…`; 50 rows, 50 unique LEIs, **15 A**, 25 C-reasons, 9 B, 1 C (`sample.json` `07335721…5427`).
- **Comparator:** each row carries its GC 28 Sep snapshot, and every row is compared on legal name, legal-address country, entity status, registration status and LEI. The comparator was tightened tonight: before, a C-reasons row, whose plan SET has no Level 1, would have "agreed" trivially. A test now covers this.
- **Calls:** **50 GLEIF calls** (`GET /api/v1/lei-records/{lei}`, one per LEI, 1.2 s apart), 20:47:55–20:49:03 UTC, **50 × HTTP 200** (`api/calls.jsonl` `f023216d…60b8`).
- **Result** (`compare.json` `605bc75b…9529`): **50/50 agree (100% ≥ 98%)**; **A rows 15, A identity mismatches 0**, so there is **no E-4 trigger** and `holds/e4-trigger.json` was not written.

## 7. Release-check evidence (for RELOPS)
- **Fail-closed `d1-today` outage:** test `item 5 — d1-today outage: 0 writes, headroom_unavailable, failed heartbeat, cursor unchanged` **passes** (tonight's run of `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs`, **34/34**). CLI evidence from Tue 13 is in `selftest/failclosed-2026-10-13/`. The headroom gate runs before any D1 read.
- **F-4 lag record:** `d1-today` lag measured **25–30 min** on 12–13 Oct (ML-1012-1; ENT-CR1's C1 writes appeared at +15–30 min, Decisions Log 13 Oct). **F-5 is in force:** account ceiling **60,000**, and the F-1 own-row window is **max(45 min, time since the last fetch)**. Both are in the runner (`LIMITS.accountCeiling = 60000`, `ownRowWindowMinMs = 45 min`).
- **Read ceiling R9-1:** in force at 350,000 (§4 above).
- **Control-surface commands for Sat 17** (from `App/Corporate Atlas/`; interactive, `--operator` required):

  | Purpose | Command |
  |---|---|
  | Status (read-only) | `scripts/gleif-reconcile-011-status.sh` |
  | **Pilot** (P-001, P-002, B-001; stops before B-002) | `node scripts/gleif-reconcile-011.mjs run --plan ~/MeridianAtlas-work/gleif-011/plans/release-2026-10-16 --transport remote --until B-002 --operator <name>` |
  | Pause / resume | `scripts/gleif-reconcile-011-pause.sh` / `scripts/gleif-reconcile-011-resume.sh` |
  | Kill switch | `scripts/gleif-reconcile-011-stop.sh` (clear with `-resume.sh --clear-stop`) |
  | Per-batch restore | `node scripts/gleif-reconcile-011.mjs restore --plan … --batch <id> --transport remote --operator <name>` |
  | Daily reconciliation export (R-4; logs the read total) | `node scripts/gleif-reconcile-011.mjs recon --date 2026-10-17 --transport remote` |

  Run windows on Sat 17: 07:15–10:40, 11:20–16:40, 17:20–21:00 UTC (not 07:55–08:05, 10:45–11:15, 16:45–17:15). The "011 run window" freeze does not block 011 (OQ-9).
- **Observability:** the ingest key file `~/MeridianAtlas-work/gleif-011/ops-ingest.env` is present (mode 600; T12, LANE-1-ENG). Its K-3/K-4 verification is RELOPS' check. **No heartbeat has yet been sent by the 011 runner from the main work folder:** Thu 15's rehearsal ran in a sub-folder with no key file, while T12 was in progress. **The Sat 17 pilot is therefore the emitter's first live use by the runner.** If the outbox delivers nothing, the run log plus R-4 daily reconciliation is the record.

## Code changes tonight (011 paths only; untracked; no git writes)

| File | Lines | SHA-256 | Change |
|---|---|---|---|
| `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` | 896 | `ce1e6623f447d02df69b110dd43651b5872b68d5569ca1082b03b4c5ad4851fe` | R9-1 gate in `executeBatch`; `run` refuses without the ceiling record; recon logs `reads_011` |
| `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` | 535 | `830b49a807b89ad96efdc7f6d4582e4b8c87c43ff7cf1201f856c58c5c4663c7` | `readTotals`, `readCeilingDecision`, `estBatchReads`, `READ_DAY_MAX` |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs` | 706 | `02ac8c678df5c862f45006c7057913ea517dfd34d9a4b5cd99cb5c3c3be667b8` | export writes the D1 ledger and is capped by the remaining ceiling; plan header cites rev 1.9 + rev 1.10 |
| `App/Corporate Atlas/scripts/gleif-reconcile-011-verify.mjs` | 254 | `c4c287d6b2da79e68cdccffdeca48a5165699909b235f0d98884b3f4c5737750` | sampled diff on written columns only; freshness sample carries the GC snapshot and compares 4 GC fields on every row |
| `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` | 624 | `efd206a08d1212c239b894f6e7177f4efa0c328b15350b228b8bd86e316fc7d3` | +4 R9-1 tests; sampled-diff and freshness-comparator checks; **34/34 pass** |
| `App/Corporate Atlas/tests/gleif-reconcile-011-dryrun.mjs` | 99 | `1510c072…0330` | unchanged |

## Artefacts (`~/MeridianAtlas-work/gleif-011/`)

| File | SHA-256 |
|---|---|
| `exports/2026-10-16-fresh/manifest.json` | `6ce3fcf6c67deb24b35c683b8218428526ff6e66816383f6f26c132ec3803be6` |
| `exports/2026-10-16-fresh/entity_master.jsonl` | `b7aa0122baea3ddbc26b68f6b1d6fb0be955969969cd049f3bf81df89f7c389a` |
| `exports/2026-10-16-fresh/queue.jsonl` | `1190b55f28a1e5d90d8a9d652e558052fcd9705d6d558d40ce889bade7da7a49` |
| `exports/2026-10-16-fresh/relationships.jsonl` | `5cd873c4b87a333ea31c4f0abcd45ba372595222d8232c3a081ade339311ca17` |
| **`plans/release-2026-10-16/plan.json`** | **`e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8`** |
| `plans/release-2026-10-16/handoff-013.json` | `0597e15dedcf50a4bcc4f8e35b3a9f826a1b0278c093699aa3808d70b3a56009` |
| `plans/release-2026-10-16/review-lists.json` | `db65589b046990c21205e5f5016f78a5eab7229482eb324cb246149bed1ee5e3` |
| `plans/release-2026-10-16/exceptions.json` | `08417ae3366e386c042dd96ee7ae4528650a2ae76b489a9af31d31bd23d045dd` |
| `read-ceiling.json` | `b6851744d31b4d7f6c15dfc9240a1cb63728ec877772eadbf8cf95d997525774` |
| `freshness-2026-10-16/sample.json` | `0733572109107b3dadc1d53068e1b6416cb2335c92edf383eb150b84e7835427` |
| `freshness-2026-10-16/api/calls.jsonl` | `f023216d902dd777cbc083f07c65321ab0a336d7bb17948d05600b2d86a460b8` |
| `freshness-2026-10-16/compare.json` | `605bc75be80cdd6bb6d345bbe5e5570acab5d6c317a554d89a5fe03918899529` |
| `dryrun/2026-10-16-release/summary.json` | `2c22bd1031b5565282a17aa80524b6bba9da673948f7ebd13a0455e45664dcdb` |
| `dryrun/2026-10-16-release/postrun.json` | `c5cbfa71482151c10fab1b08d211064b66eb760831e90ba9ebdf78c60facb146` |
| `d1-ledger.jsonl` (includes the 16 export pages) | `fed681a2b19b22c401a2be69942c641f9fc32302cbb7009836c9a3691d613bcf` |

**Stop point:** after this report. Not done here, by design: no production write batch, no pilot, no registry/key/pause-row work, no Worker deploy, no git writes. Next: RELARC + RELOPS on Sat 17 morning, then the Founder's release approval, then the pilot.
