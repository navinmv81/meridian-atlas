# MA-OCT-003.BREVD — Report (LANE-11, Data-Identity Lead): 003 build review

**Verdict: PASS WITH NOTES.** All three checks hold. The notes are N-1 to N-4 below. N-1 changes the Mon 26 expectation for E2/E4; none blocks Sat 24.

**Control v1:** `claude/packets/MA-OCT-003.BREVD_Control_v1.md` `f6994d9aabf91f25ea51467cb15228739a4860ce00ca0b28fde8253264b047c7`. It matches the STATUS_BOARD row. **Task v1** `c8605466cf35830fa6e955dd6e7098750636b0eae5b4bd461981c5035097d00d` matches.
**Date:** Thu 22 Oct 2026. **Git:** HEAD `c3c6e4a`. No `.git/*.lock`. **Read-only:**
- no code run;
- 0 D1;
- no git writes;
- no key file opened.

**Independence:** I did not build 003 (LANE-8-ENG did). I authored the REVDIL items this build implements.
**Access:** read grant for `~/MeridianAtlas-work/ma-oct-003/patches` only, approved by the Founder this session. There was no macOS prompt. The dump folder was not opened.

## Inputs (hash-checked; all equal the build report)

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-003_Spec.md` rev 1 | `7b8bba9f…80c2` ✓ |
| `claude/packets/MA-OCT-003.BUILD_Report.md` (days 1–3 + Sat 24 run sheet) | `1307bf36…efba` ✓ |
| `App/Ops/src/cases.js` | `6ff88abc…dcc1b` ✓ |
| `App/Ops/src/sweep-ext.js` | `15f3f179…ee130` ✓ |
| `App/Ops/src/ops-api.js` (base + 01 + 02) | `ec85886e…23cd` ✓ |
| `App/Ops/wrangler-ops.toml` | `fadd9d2d…dca` ✓ |
| `App/Ops/migrations/004-ops-cases.sql` | `d7c96c55…f0` ✓ |
| `App/Ops/migrations/m1-entity-exceptions-to-ops.sql` | `bf0f81d7…6ce` ✓ |
| `App/Ops/migrations/m2-seed-gleif-cases.sql` | `a6e621d3…eab` ✓ |
| `App/Ops/tools/m1-render.mjs` | `864fd1cc…bb` ✓ |
| `App/Ops/tests/migration-m1.mjs` | `bb571697…c48` ✓ |
| `App/Ops/tests/sweep-ext-contract.mjs` | `476e41e1…93a` ✓ |
| `App/Ops/tests/cases-contract.mjs` | `82088e3b…ec8b` ✓ |
| `App/Corporate Atlas/src/entities-api.js` | `d18845dd…70db` ✓ |
| `App/Corporate Atlas/wrangler-entities-api.toml` | `a6e0a6ec…788a` ✓ |
| `App/Corporate Atlas/tests/entities-api-retirement.mjs` | `02598a8a…5de8` ✓ |
| `patches/01-routes-ops-api-hooks.diff` | `7855781e…525b` ✓ |
| `patches/02-sweep-ops-api-hooks.diff` | `107b0cf0…a728a` ✓ |
| `patches/03-retirement-entities-api.diff` | `c02f62b1…c714` ✓ |

---

## 1. M1 / M2 and the renderer

| Check | Evidence | Result |
|---|---|---|
| **M1 = spec §10.2** | Compared token by token against the spec's SQL block, with comments and whitespace removed. The **only difference** is the two `migrated`-payload placeholders: `'<filled at build>'` → `'__FILE_SHA__'` / `'__COMMIT__'`. The spec says those are "filled at build". The other three statements and the ticket insert are identical: column list, `object_key` COALESCE precedence, DV-4 `object_ref` + verbatim `source_record_ref`, `decided_by`/`decided_at`/`created_at` copied inside D1, and `INSERT OR IGNORE` on the UNIQUE keys. | ✓ |
| **M2 = spec §10.4** | Identical after normalisation. `EXC-M-000001` (E3, sev2, `job_id` phase1, the 26,083 / 3,676 / ≈ 22.4k wording, owner = the enrich fix packet) and `EXC-M-000002` (E4, sev3, `cf.meridian-entities-delta`), each with its own `created` event. | ✓ |
| **Renderer** | It replaces only the single exact fragment (the split must give exactly 2 parts), so no other text can be rewritten. It refuses NUL, and any commit that is not 7–40 lowercase hex. `file_sha256` = the template's SHA-256. Output mode 600, outside the repo. | ✓ |
| **V1–V4 and exact counts** | Test 2 (as written; not run by me) checks:<br>- per-statement changes `9,9,7,9`;<br>- V1 9 tickets = **7 resolved + 2 open**;<br>- **V2 = 0**, using the spec's byte-for-byte query;<br>- V3 `created` 9 / `decision_recorded` 7 / `migrated` 9;<br>- the **`object_key` set {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219}**;<br>- V4 re-run `0,0,0,0`.<br>Run-sheet step 11 carries the same expectations, with the Data-Identity Lead as checker. | ✓ |
| **Three Founder `do_not_merge` pairs preserved** | Test 2 asserts `DQ-M-000001..3` are the `do_not_merge` tickets. M1 copies `decision` → `disposition` verbatim, and V2 checks it byte-for-byte. The pairs come from the 015b `source_ref`: 931/1216, 2589/25577, 2014/25655. | ✓ |
| **Unchangeable by any 003 path** | M1 is `INSERT OR IGNORE` only. M2 touches only `ops_exception`. C-2 rejects every `DQ-` action with **409 `dq_actions_arrive_with_ma_oct_004`** (`cases.js:377`), after the service gate and before any validation or D1 write. The sweep (auto-resolve) writes only `ops_exception` `job_missed` rows. **No 003 code writes `ops_data_quality_ticket` apart from M1's insert.** The `OPS_SERVICE_ACTORS` shape in `wrangler-ops.toml` gives a token only `comment`/`assign`/`triage` on DQ, never resolve, dismiss or reopen. | ✓ (004's own reopen guard: N-3) |
| **`entity_exceptions` untouched / read-only** | M1 reads it in full (9 rows) and writes nothing to it. Test 2 asserts the table is byte-identical after M1, and test 4 after the retirement. Retirement removes every write handler (POST/PUT) and leaves `entities-api.js` with **no INSERT/UPDATE/DELETE statement at all**. R-3's 410 answers before D1. The Mon 26 re-dump compare is in the run sheet. | ✓ |

## 2. Sweep E1–E6 against 006 §8.3 as amended

| Code | Build (`sweep-ext.js`) | Against the spec / 006 | Result |
|---|---|---|---|
| E1 | `GLEIF_JOBS` = phase1, phase23, boost, delta; **`manual.gleif-reconcile-011` excluded** (line 16–17). It fires on the last 2 end events `success`/`partial` with `items_attempted > 0`, `items_progressed = 0`; sev2. It drops the boost's F4 `job_frozen` only when the cursor branch is not also true (BN-6). | §9.3 + 003-4 | ✓ |
| E2 | `job_id` = **`cf.meridian-entities-enrich.phase23`** (`E2_JOB`, line 20). `status='in_progress' AND last_attempt < cutoff LIMIT 50`; the cutoff is formatted `YYYY-MM-DD HH:MM:SS`, like `last_attempt`. sev3. The summary says resetting is an Entities write that 003 never does. It reads only. | 003-1 | ✓ |
| E3 | Not automated; seeded by M2 | 003-2 | ✓ |
| E4 | Held GLEIF jobs, `MAX(started_at)` of `success`, > 35 days, else the registry `created_at`. The delta case is **seeded** (`EXC-M-000002`). S2 suppresses on (job, type, open), so the automatic rule cannot raise a second delta case. The 011 runner is not in `GLEIF_JOBS`. | 003-3 | ✓ |
| E5 | Execution modes `local_schedule` **and `manual`** (BN-7), with the 2 auth classes; sev3 | §9.3 says the 011 runner still gets `local_auth_failure`, which needs `manual`. That is correct from the data-identity side, and the Architect confirms. | ✓ |
| E6 | `guard_blind = 1` in any end event's metrics; sev4; dormant | 006 E6. Not gated to `GLEIF_JOBS`, which is harmless (N-2). | ✓ |

**Tests (as written):**
- Test 3 (B) covers E2 on phase23 counting only the > 24 h row, held-phase1 E4, the delta seed only, no E1 for 011, E5, E6, once a UTC day, and the switch off.
- The 011 fixture is two resumed 250-row batches with `progressed = 0`, which is exactly REVDIL 003-4.

**Expected first case for the 11 Jun stuck row:**
- one `gleif_stuck_in_progress`, sev3, `job_id` phase23;
- `dedupe_key` `gleif_stuck_in_progress:cf.meridian-entities-enrich.phase23:<UTC date>`;
- title "GLEIF-E2: 1 enrichment queue row(s) stuck in_progress > 24 h", summary "Oldest last_attempt 2026-06-11 22:04:02 …";
- one `raised` event.

This holds if R3 still shows that row. 011's Q step only touches `pending`/`failed` rows, and A was restored after the E-4, so it should. Later days are suppressed by S2 while the case is open. **When it appears: see N-1.**

## 3. Nothing in 003 writes Entities tables

- A grep over `ops-api.js`, `cases.js` and `sweep-ext.js` for every `INSERT`/`UPDATE`/`DELETE`/`REPLACE` target finds only Ops tables: `ops_exception`, `ops_case_event`, `ops_job_run`, and the governance tables that A6 moves out.
- The migrations write only `ops_*` (004 indexes on Ops tables; M1/M2).
- `entity_enrichment_queue` and `entity_exceptions` are **read** only (E2's LIMIT 50; M1, V2, the guard and the dumps).
- `entities-api.js` after retirement contains **no write statement**.
- The diffs 01/02/03 add no Entities write.

**✓**

---

## Notes

- **N-1 (timing; for the Mon 26 Control):**
  - E2 and E4 run only on the **first sweep of the UTC day**, defined as no earlier `local.health-check` end event today (`firstSweepToday`).
  - The run sheet puts deploy 4 **after the 08:00 UTC sweep** on Mon 26 and says to observe the 12:00 sweep. The 08:00 sweep (old code) will already have logged today's end event, so **the 12:00, 18:00 and 22:00 sweeps on Mon 26 will not run E2/E4**.
  - **The 11 Jun case will first appear at the Tue 27 08:00 UTC sweep.**
  - The Mon 26 Control should expect `gleif_checks {e2: null, e4: null}` on Mon 26 and check E2 (and the absence of a second delta E4) on Tue 27 08:00. AC-9 and AC-11 can still be observed on Mon 26.
  - This is not a code defect, because spec §9.3 asks for once a day. Only the expectation needs moving.
- **N-2:** E6 is not limited to `GLEIF_JOBS`, so it would also raise for the 011 runner or a bond runner if one ever emitted `guard_blind = 1`. The spec excludes 011 only from E1/E4, so this is consistent. No change.
- **N-3:** in 003, the `do_not_merge` protection is the **absence of any DQ write path** (C-2 409 for `DQ-`). The Worker-enforced `reopen` refusal (409 `protected_decision` unless `founder_supersession`) is **004's** build (004 §7.1/§7.5, AC-18), and must be checked at the 004 build review, before `dq_actions_arrive_with_ma_oct_004` is lifted.
- **N-4:** run-sheet step 14 runs AC-2/4 on an **Ops** case (the oldest open `job_failed`), not a DQ or Entities one. I agree. Step 11's V1–V3 values are confirmed above. I will check them on Sat 24 if the Control asks.

## Outputs

`claude/packets/MA-OCT-003.BREVD_Report.md` only. No other file was written. No git writes. 0 D1.
