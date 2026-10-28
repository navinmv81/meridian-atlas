# MA-OCT-003.BUILD — Report

**Lane:** LANE-8-ENG (Engineering Lead; 008 work resumes after 24 Oct) · **Control** v1 `9416b6ce861091b035b7ae97551a88dd5e34e4953e6a51edceb83bdf8d94dded` · **Task** v1 `963214b6730931360f9997d4bcd5be218f4cf4146a6b047b6b4f38dc03fa800a` · **Spec** rev 1 `7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2`

Reviewers: Architect + Data-Identity Lead. The builder does not review its own work; everything below is input for them and for the Main Lane.

---

## Wed 21 Oct 2026 — day 1 (preflight, read pack, routes build, test 1)

### 0. Preflight
- Control re-hashed = `STATUS_BOARD.md` row 33 ✔. Task re-hashed = Control's value ✔. Spec on disk = Task's value ✔ (the working copy differs from HEAD's committed version; the on-disk file is the approved rev 1).
- LOCAL_MASTER path, branch `October-2026`, HEAD `3989ab1`, no `.git/*.lock`. Git read with `--no-optional-locks` only. **No git writes.**
- `/usr/local/bin/wrangler --version` = 4.96.0. FREEZES.json `cdc9606a…c346` (011 dated window to Sat 24 00:00Z).
- Spec read in full (§0–§19, Appendix A–D), plus the R1C-ARC report (PASS WITH NOTES).
  - G-1 binds the Sat 24 run sheet.
  - R1-1 is applied (one `X-Ops-Client` vocabulary).
  - R1-7 is wording only.
- **A6 coordination (Task step 1):**
  - A6 (`meridian-control`; governance routes leaving `ops-api.js`) is **not built** yet: no `control-api.js`, no `wrangler-control.toml`, no A6 packet on the board. `App/Ops/src/ops-api.js` is still the 13 Oct base `c77973de…7c9f`.
  - To keep the two builds mergeable, all 003 logic is in a **new module `src/cases.js`**. `ops-api.js` gets only a 6-line routes hook (1 import + 5 lines at the top of `handleAdmin`), and no A6-owned line is touched.
  - The hunks are saved as `~/MeridianAtlas-work/ma-oct-003/patches/01-routes-ops-api-hooks.diff` `7855781e…525b` (outside the repo), so LANE-1-ENG can rebase them onto A6.
  - The sweep extensions (Thu) go in their own module and their own diff, so the Sat 24 deploy (routes) and the Mon 26 deploy (sweep) can be committed separately.

### 1. Read pack (Appendix A R1–R5) — read-only, 54 rows read, 0 written
EXPLAIN first for each statement, then the statement. All plans matched Appendix A. R1's EXPLAIN hit a transient Cloudflare 7403 (an auth blip; nothing ran) and the retry succeeded. `decided_by` values are not reproduced here.

| # | Plan (remote EXPLAIN) | rows_read | Result |
|---|---|---|---|
| R1 | `SCAN entity_exceptions USING INDEX idx_entity_exceptions_type` + temp B-tree (the ordered scan accepted as R-T12-1) | 18 | **N = 9, unchanged:** `entity_merge`/`do_not_merge` 3 (ids 1–3, 3 decided); `bad_relationship_edge`/`accepted_no_fix` 4 (ids 4–7, 4 decided); `isin_duplicate`/`pending` 2 (ids 8–9, 0 decided) |
| R2 | `SCAN entity_exceptions` (bounded) | 18 | **0 rows**: no row after id 9, no non-DQ type, no malformed `source_ref` → M1's guard passes |
| R3 | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` | 2 | **1** `in_progress` row, oldest `2026-06-11 22:04:02`: E2 will raise one case on its first daily check (H-3 owns the reset) |
| R4 | EXPLAIN only: `SEARCH … idx_enrich_queue_status (status=?)` + `USE TEMP B-TREE FOR GROUP BY` | 0 | Confirms E3 stays unautomated |
| R5 | `SCAN ops_exception` + temp B-tree (bounded) | 16 | **8 open cases** (15 Oct: 6): `job_failed` sev3 ×4 and `job_missed` sev3 ×3 (from 13 Oct 16:36Z), plus **`budget_risk` sev2 ×1, opened 2026-10-18 07:07:24Z**. None is acknowledged. This is the baseline for AC-9, AC-11 and the §18 metric |

Ledger: `~/MeridianAtlas-work/ma-oct-003/d1-ledger.jsonl` (9 calls, 54 reads, 0 writes).

### 2. Built today (local only; nothing deployed, migrated or applied)
| File | What |
|---|---|
| `App/Ops/migrations/004-ops-cases.sql` (new) | §6 verbatim: `idx_ops_dq_linked_exc`, `idx_ops_exception_job_cond`. Applied only to the local `node:sqlite` copy in tests. |
| `App/Ops/src/cases.js` (new, 435 lines) | **E-1** queue (keyset per status on `idx_ops_exception_queue`, or `idx_ops_exception_job` for `?job_id=`, merged; `age_h` and `overdue` P1). **E-2** manual create. **C-1** detail for `EXC-` and `DQ-`. **C-2** transitions (§7.1). The §8.4 engine with the A3-3(a) `NOT EXISTS` guard. CSRF rule A3-5. Validation §8.3, with `redact()`, the `case_ref` pattern and `object_key` formats per 001 §5.3. The §8.5 `OPS_SERVICE_ACTORS` allowlist. Kill switch `OPS_CASES_ENABLED`. |
| `App/Ops/src/ops-api.js` (edited, +6 lines) | Import, then in `handleAdmin` after `verifyAccessJwt`: the `serviceGate()` allowlist on **every** admin route, then `handleCases()`. No other change. |
| `App/Ops/wrangler-ops.toml` (edited, +10 lines) | `OPS_CASES_ENABLED = "true"`, and `OPS_SERVICE_ACTORS = "{}"` with the documented shape (identifiers only). |
| `App/Ops/tests/cases-contract.mjs` (new) | Test 1 (§15 step 1) |

**Build notes for the reviewers (in code, named):**
1. **BN-1, event-first batch (Architect).** §8.4 writes "guarded `UPDATE`, then the event if it applied". The build writes the **event first**, with the case's pre-image captured in SQL (`json_object(...)` of status, severity, owner, assignee and resolution fields), under `WHERE case_ref = ? AND status = :expected AND NOT EXISTS (idempotency_key)`. It then runs the guarded `UPDATE … AND EXISTS (that event, same :now)`, in the same `db.batch()` transaction.
   - The invariant is unchanged: no change without exactly one event, and a reused `request_id` never changes state.
   - Gain: `reopen` keeps the **exact** prior resolution (AC-6), and `assign` keeps the exact prior owner and assignee, even when two requests race. With UPDATE-first, those values are gone by the time the event row is written.
   - Reads per action: 6 (AC-16 ≤ 6).
2. **BN-2, manual create locator.** E-2 sets `dedupe_key = 'manual:'||request_id`. That lets the batch's `UPDATE case_ref` and its `created` event find the new row without knowing `exception_id`, and makes a replay a no-op on a UNIQUE key. `dedupe_key` is otherwise unused by manual cases.
3. **BN-3, `X-Ops-Client`** = `console|script|service|dq-page` (R1C-ARC R1-1). One set for 003 and 004.
4. **BN-4, E-2 `run_id`** not found in the ledger (pruned, or wrong) → **422**, rather than a case with an empty `run_snapshot`. A `run_id` of another job → 422.
5. **BN-5, the allowlist covers `/api/ops/admin/jobs` too.** Any admin route outside an entry's `routes` returns 403, so a service token cannot reach `/jobs` or the governance POSTs. After A6 moves the governance routes away, this check stays on `meridian-ops`.

### 3. Tests
| Suite | Result |
|---|---|
| **`tests/cases-contract.mjs` (new, test 1)** | **63 passed, 0 failed** |
| `tests/sweep-contract.mjs` | ALL PASSED (23), unchanged by the hook |
| `tests/admin-jobs-lateness.test.mjs` | ALL PASSED (13) |
| `tests/health-check.test.mjs` | ALL PASSED (15) |
| `tests/lateness.test.mjs` | ALL PASSED (42) |
| `tests/boost-heartbeat-resilience.mjs` | 207 passed, 0 failed |
| `tests/ingest-contract.mjs` | **Not run.** It is an integration harness that needs a running `wrangler dev` plus a real emitter key in the environment; it is not a unit test and was not touched by 003. To run against `wrangler dev --local` on Thu/Fri if the Main Lane wants it counted. |

Test 1 covers:
- **AC-1:** 401 without a JWT and with the wrong AUD, on all 4 routes; 400 for `text/plain`, a missing `X-Ops-Client`, or an unknown one; **0 D1 calls**, no CORS header, table counts unchanged.
- **AC-1b:**
  - an unknown `common_name` → 403;
  - `ops-script` `resolve`/`dismiss`/`reopen` on a `DQ-` ref → 403;
  - `ops-script` on `/sprint-board`, `/release-ledger` and `/jobs` → 403, all before D1;
  - an unparseable `OPS_SERVICE_ACTORS` fails closed;
  - `ops-script` `acknowledge` on an `EXC-` ref → 200, with actor `service:ops-script` and `common_name` in the payload.
- **Kill switch:** 503 with 0 D1 calls.
- **AC-2.**
- **AC-3:** two concurrent requests on the same `expected_status` → one 200, one 409, 1 event.
- **AC-4 (1) and (2):** a replay is 200 with 0 events; a reuse with a different action is 409 `request_id_reused` with 0 changes.
- **AC-5**, plus validation (`duplicate_of`, UUID, unknown action, note > 2,000).
- **Stale and illegal transitions:** 409 with the current state; 404; a bad `case_ref` is 400 before D1.
- **Individual actions:** `set_severity`; `resolve` (`resolved_by` = verified actor, never a body field); a comment on a resolved case keeps its resolution; **AC-6** reopen with the prior values in the event; dismiss as duplicate.
- **"No change without an event"** checked over the whole table.
- **AC-7:** case ref matches `EXC-\d{6}`, replay is 200, unknown job is 422, object format checked, title/summary redacted, role vocabulary.
- **AC-8:** row, events oldest first, registry, linked DQ; plus DQ detail and 404.
- **E-1:** sort order, `overdue`, keyset paging over 4 statuses (every case exactly once), `?job_id=`, bad cursor/status → 400 before D1.
- **`/jobs` regression.**
- **Local EXPLAIN** (remote confirmation is AC-16 on Sat 24): E-1 `SEARCH idx_ops_exception_queue (status=?)` with no temp B-tree; `?job_id=` on `idx_ops_exception_job`; events on covering `idx_ops_case_event_subject`, no temp B-tree; linked DQ on `idx_ops_dq_linked_exc`; idempotency on its autoindex; case on `sqlite_autoindex_ops_exception_1`.
- **Measured local reads:** C-2 ≤ 6, E-2 ≤ 6, C-1 ≤ 230.

### 4. Files (SHA-256 at report time)
| File | SHA-256 |
|---|---|
| `App/Ops/src/cases.js` | `6ff88abc4502038a85b669edcb99a341a39c91e4576099750610be88795dcc1b` |
| `App/Ops/src/ops-api.js` (base `c77973de…7c9f` + 6 lines) | `8b00348fcfd2896ad516898f4549b766613cbea7f44bb8590a8dc0ac287014b9` |
| `App/Ops/migrations/004-ops-cases.sql` | `d7c96c55055019fb22f952f4c601e20489645c2a650814a9829f488e3d8ce3f0` |
| `App/Ops/wrangler-ops.toml` | `eb0d83dbda330447e42b26df787fcc485c83e6f9db19fdc68534e567acb18d50` |
| `App/Ops/tests/cases-contract.mjs` | `82088e3b94121841d333130d754e1aa8f6ca33dd8ab5ab19cf3c5d6907d0ec8b` |
| `~/MeridianAtlas-work/ma-oct-003/patches/01-routes-ops-api-hooks.diff` (outside repo) | `7855781ef96ceb1818b84c67ee147cce8cbc40dd8ef58629a450fa404464525b` |

### 5. Questions (for the Main Lane; none blocks Thu/Fri)
1. **Token Client ID before deploy 3 (run sheet).** §8.5 needs the `ops-script` token's `common_name` (its Access **Client ID**, an identifier) in `OPS_SERVICE_ACTORS` at deploy 3. §16 has the Founder create the token *after* deploy 3, so that would need a 4th `meridian-ops` deploy on Sat 24 (over the ≤ 3 cap). **Proposal for the Fri run sheet:** the Founder *creates* the token before deploy 3 but does **not** add it to the Access policy; its Client ID goes into `OPS_SERVICE_ACTORS` at deploy 3; admission happens only after AC-1b passes, which is what §8.5 requires. A token that hasn't been admitted is refused at the Access edge, so nothing is exposed meanwhile. Please confirm, or rule otherwise.
2. **A6 base.** Who rebases the 6-line routes hook onto LANE-1-ENG's A6 version of `ops-api.js` before Sat 24: LANE-1-ENG at A6 commit, or this lane once A6 is on disk? The hook sits at the top of `handleAdmin`, which A6 keeps.
3. **`ingest-contract.mjs`:** count it as out of scope for "0 skipped" (integration harness), or run it against `wrangler dev --local`?

### Thu 22 / Fri 23 plan
- **Thu 22:**
  - sweep extensions §9.1–§9.5 in `src/sweep-ext.js`, with their own hook and diff;
  - test 3 (`sweep-contract.mjs` extended, AC-9 to AC-11);
  - M1/M2 files plus test 2 (`migration-m1.mjs`, against the 015b/015c files).
- **Fri 23:**
  - retirement edits on `entities-api.js` by symbol (R-1 to R-5), plus test 4 and `nav-007-worker.test.mjs` 58/58;
  - the Sat 24 run sheet, with G-1 as deploy 2's precondition.

---

## Thu 22 Oct 2026 — day 2 (sweep extensions + test 3; M1/M2 files + test 2)

**Rulings applied (ML-1021-3):**
1. The `ops-script` token is created before deploy 3 and added to the Access policy only after the allowlist checks pass. This goes into Fri's run sheet.
2. A6 lands first on Sat 24; this lane then rebases its hooks onto it and LANE-1-ENG commits.
3. `tests/ingest-contract.mjs` is out of scope and **recorded as not run**.

**Preflight:** no `.git/*.lock`; HEAD `c3c6e4a` (007.P1 commits since day 1; none touches `App/Ops`). Day-1 files re-hashed, all unchanged. Spec unchanged (`7b8bba9f…80c2`). **Local only: 0 D1 reads, 0 D1 writes, no deploy, no git write.**

### 1. Sweep extensions (§9.1–§9.5): `App/Ops/src/sweep-ext.js` (new, 165 lines) + sweep hooks in `ops-api.js`
- **§9.1 one case per (job, condition):**
  - `rekeyConditions()` keys the 6 condition types `<type>:<job>:<UTC date>`; `job_frozen` keeps its cursor marker, as `job_frozen:<job>:<cursor>:<date>`.
  - `suppress()` runs **S2** as `UNION ALL`, one statement per job that has a condition finding, batched.
  - Suppressed findings count in `already_open` and write nothing.
- **§9.2:** `L2_SQL` gains `error_class`, which costs 0 reads.
- **§9.3 GLEIF catalogue:** `GLEIF_JOBS` = phase1, phase23, boost and delta; `manual.gleif-reconcile-011` is excluded.
  - E1, E5 and E6 come from L2 rows.
  - E2 (`entity_enrichment_queue`, `LIMIT 50`, `job_id` phase23) and E4 (held GLEIF jobs, `MAX(started_at)` per job) run once per UTC day, on the first sweep with no earlier `local.health-check` end event today.
- **§9.4 auto-resolve (F-1):**
  - Candidates are the open/acknowledged `job_missed` cases, `LIMIT 100`. A case's slot is parsed from its `dedupe_key` and must be inside this sweep's lookback with state `on_time`/`late` and a matched run.
  - Any case with a `reopened` event is skipped (probe + SQL guard).
  - Cap 20 per call, apart from raises. Key `autoresolve:<case_ref>:<now>`; `resolved_by` = `service:<emitter>`; actor source `ingest_key`; the run id goes in the payload.
- **§9.5:** the response adds `suppressed`, `s2_rows_read` (per job, for AC-16), `gleif_checks {e2, e4}`, `auto_resolved` and `autoresolve_skipped_reopened`.
- **Switches:**
  - `OPS_SWEEP_GLEIF_CHECKS="false"` turns E1–E6 off with 0 reads.
  - `OPS_SWEEP_AUTORESOLVE` enables auto-resolve **only when exactly `"true"`**.
  - Both are added to `wrangler-ops.toml` as part of the **Mon 26 hunk**: `"true"` / `"true"`.
- **`ops-api.js`:** 1,252 lines (spec §12 ≈ 1,100 after A6, which removes the governance handlers); `sweep-ext.js` 165; `cases.js` 435. All are under 1,500.

**Build notes (continuing day 1's BN-1…BN-5):**
- **BN-6:** `lateness.js` reports `frozen` without saying why. `frozenBranches()` re-derives the cursor and F4 branches from the same L2 rows, so E1 drops a boost `job_frozen` **only when the cursor branch is not also true**. That is spec §9.3's "F4 branch skipped". `lateness.js` is unchanged; spec §12 had foreseen ≈ 280 lines there, which turned out not to be needed, because the sweep's slot states already carry the matched `run_id`.
- **BN-7, E5 scope:** §9.3 says "any `local_schedule` job". §9.3 also says the sweep still raises `local_auth_failure` for the 011 runner, which is `manual`. E5 therefore covers execution modes `local_schedule` **and** `manual` (local runners: 011, bonds). For the Architect to confirm.
- **BN-8:** test 3 is a new file, `tests/sweep-ext-contract.mjs`. 002a's `sweep-contract.mjs` (23 cases) is left **byte-identical to HEAD** as the regression baseline, and it still passes against the extended sweep.
- **BN-9:** auto-resolve is off unless the var is exactly `"true"`, so a missing var never auto-closes anything.
- **BN-10:**
  - E2's cutoff is formatted `YYYY-MM-DD HH:MM:SS` to compare correctly with `last_attempt` (R3 shows that format).
  - E2/E4 failures **fail soft**: they are logged, and the sweep still raises everything else. The 002a fixture has no Entities table, and the sweep carried on, as intended.
- **BN-11:** auto-resolve uses BN-1's event-first shape, with the reopened guard **also in SQL**, so a reopen that lands between the probe and the batch still wins.
- **BN-12, keys:** existing open `job_frozen` cases carry the old key (no date). S2 suppresses on (job, type) and not on key, so there is no duplicate after deploy 4.

### 2. M1 / M2: files + renderer
| File | What |
|---|---|
| `App/Ops/migrations/m1-entity-exceptions-to-ops.sql` (new) | §10.2 verbatim: 1 ticket statement + 3 event statements. The `migrated` payload carries `__FILE_SHA__` / `__COMMIT__`; the spec says "filled at build", and a file can't contain its own hash. |
| `App/Ops/tools/m1-render.mjs` (new) | Renders M1 for Sat 24: `file_sha256` = the **template's** SHA-256, `commit` = the commit that carries it. It replaces the single exact payload fragment by splitting (count must be 1), refuses NUL and any commit that is not 7–40 lowercase hex, and writes mode 600 to `~/MeridianAtlas-work/ma-oct-003/` (R1C-ARC R1-5 discipline). |
| `App/Ops/migrations/m2-seed-gleif-cases.sql` (new) | §10.4 verbatim: `EXC-M-000001` (E3, sev2, phase1) and `EXC-M-000002` (E4 delta, sev3), each with 1 `created` event. |

### 3. Tests: all pass; 0 skipped in scope (`ingest-contract.mjs` recorded as not run, ML-1021-3)
| Suite | Result |
|---|---|
| `tests/cases-contract.mjs` (test 1, day 1) | **63 / 63** |
| **`tests/migration-m1.mjs` (test 2, new)** | **29 / 29** |
| **`tests/sweep-ext-contract.mjs` (test 3, new)** | **34 / 34** |
| `tests/sweep-contract.mjs` (002a, unchanged) | 23 / 23 |
| `tests/admin-jobs-lateness.test.mjs` | 13 / 13 |
| `tests/health-check.test.mjs` | 15 / 15 |
| `tests/lateness.test.mjs` | 42 / 42 |
| `tests/boost-heartbeat-resilience.mjs` | 207 / 207 |
| `tests/ingest-contract.mjs` | **not run** (integration harness; ML-1021-3) |

**Test 2** covers:
- the renderer (template SHA recorded, header comments untouched, 4 statements);
- the fixture: 015b + 015c give 9 rows, ids 1–9; the guard returns 0;
- **AC-12**: per-statement changes `9,9,7,9`; **V1** 9 tickets, 7 resolved + 2 open; **V2 = 0 mismatches**; **V3** created 9 / decision_recorded 7 / migrated 9; **`object_key` set = {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219}**;
- the mapping: `DQ-M-` refs, `legacy_*`, titles, owner/severity, DV-4 `object_ref` and verbatim `source_record_ref`, the 3 protected `do_not_merge` tickets as DQ-M-000001..3, DV-2 migrated actor and payload, `decision_recorded` actor = `decided_by` verbatim, `created` at the original time;
- **AC-13 / V4**: a re-run gives `0,0,0,0`, and `entity_exceptions` is unchanged;
- the unknown-type fixture: the guard returns 1, and that row is never migrated;
- the malformed-JSON fixture: the batch fails and **0 tickets, 0 events** are written (transaction);
- **M2**: 2 cases + 2 events, a re-run gives 0, refs match the C-1 pattern;
- renderer refusals: NUL, a quote in the commit, uppercase, fragment ×0 or ×2; the splitter-safety check.

**Test 3** covers four scenarios:
- **(A) AC-9:** day 1 raises 1 case with the dated key; days 2–3 are suppressed with 0 new cases; S2 ≤ 190 reads per job. After `accepted_risk` there are 0 raises at +1 and +28 days; it raises again at +31 days; after `fixed` it raises the next day. S2 is two seeks on `idx_ops_exception_job_cond`, no SCAN.
- **(B) AC-10:**
  - E1 sev2 (boost), and no `job_frozen` for the boost;
  - E2 sev3 with `job_id` phase23, counting only the > 24 h row;
  - E4 sev3 for a held phase1, while delta shows only the seeded `EXC-M-000002` (S2);
  - E5 sev3, E6 sev4, no E1 for 011;
  - `gleif_checks {e2: 1, e4: 2}`, `rows_read` ≤ 1,000;
  - E2 and E4 plans; once a UTC day (a later sweep doesn't re-read the queue or re-raise);
  - the switch off gives no E1–E6 and no queue read, and the F4 `job_frozen` returns.
- **(C) AC-11:** `"false"` and an absent switch change nothing. `"true"` resolves the 2 replayed cases (`replayed`, `service:health-check-local`), with exactly 1 `auto_resolved` event each naming the matched run. The reopened case is untouched and counted. An out-of-window slot is never resolved. A repeat sweep writes 0. Every resolve has its event at the same time.
- **(D) cap:** 22 candidates → 20 resolved, then 2 on the next call; a daily raise cap of 1 doesn't limit auto-resolves; `rows_read` ≤ 1,000.

**Mutation check:** with S2 disabled, 6 checks fail; with the reopen guard removed, 4 fail. The file was restored, hash verified.

### 4. Commit layout for LANE-1-ENG (two diffs, each rebased onto A6 after it lands Sat 24, ML-1021-3 (2))
| Diff (outside repo) | SHA-256 | Ships |
|---|---|---|
| `~/MeridianAtlas-work/ma-oct-003/patches/01-routes-ops-api-hooks.diff` | `7855781e…525b` | **Sat 24, deploy 3:** routes hook + `OPS_CASES_ENABLED`, `OPS_SERVICE_ACTORS` |
| `~/MeridianAtlas-work/ma-oct-003/patches/02-sweep-ops-api-hooks.diff` | `107b0cf0dd1da5cebb75f2e33fae8832225e87da4dbcdfc5068f0689a8ff728a` | **Mon 26, deploy 4:** sweep hooks, `L2_SQL` + `error_class`, `OPS_SWEEP_GLEIF_CHECKS`, `OPS_SWEEP_AUTORESOLVE` |

Verified: HEAD + 01 + 02 reproduces the working tree byte for byte (`ops-api.js`, `wrangler-ops.toml`).

**Commit file sets:**
- Routes commit: `src/cases.js`, `migrations/004-ops-cases.sql`, `migrations/m1-entity-exceptions-to-ops.sql`, `migrations/m2-seed-gleif-cases.sql`, `tools/m1-render.mjs`, `tests/cases-contract.mjs`, `tests/migration-m1.mjs`, plus diff 01.
- Sweep commit: `src/sweep-ext.js`, `tests/sweep-ext-contract.mjs`, plus diff 02.

### 5. Files (SHA-256 at report time)
| File | SHA-256 |
|---|---|
| `App/Ops/src/sweep-ext.js` | `15f3f179a10b4c6757a6eb1e1e7640749d3820ab901ea7efa888fe8dc41ee130` |
| `App/Ops/src/ops-api.js` (base + 01 + 02) | `ec85886ee1166b6d46fc04404cf5c614cbf51a62a6df51a58c6923fdbf2623cd` |
| `App/Ops/wrangler-ops.toml` | `fadd9d2d67a897ffbb492500005ffe811e423f3c2fc2a36038f81f8e7b903dca` |
| `App/Ops/src/cases.js` (unchanged) | `6ff88abc4502038a85b669edcb99a341a39c91e4576099750610be88795dcc1b` |
| `App/Ops/migrations/004-ops-cases.sql` (unchanged) | `d7c96c55055019fb22f952f4c601e20489645c2a650814a9829f488e3d8ce3f0` |
| `App/Ops/migrations/m1-entity-exceptions-to-ops.sql` | `bf0f81d7abf73525bac590fe2eebed81f81f6db1c4e997881d203a37fc24f6ce` |
| `App/Ops/migrations/m2-seed-gleif-cases.sql` | `a6e621d39ef3733fbc3fe6c4495bebded2f5247bd3641e50d02479914ef55eab` |
| `App/Ops/tools/m1-render.mjs` | `864fd1cc004c338794b85b049be1d065adce702df40b1860a3e20df4fb13e7bb` |
| `App/Ops/tests/migration-m1.mjs` | `bb57169746c5c090c65f867aacaab3205c3ed99740ce3b63f8deb8e66d48c078` |
| `App/Ops/tests/sweep-ext-contract.mjs` | `476e41e107d89346068f140001675ebf9129325fe77384c429f59f4c1a77593a` |
| `App/Ops/tests/cases-contract.mjs` (unchanged) | `82088e3b94121841d333130d754e1aa8f6ca33dd8ab5ab19cf3c5d6907d0ec8b` |

### 6. For the reviewers / Main Lane
1. **Architect:** BN-1 (event-first batch), BN-6 (E1 vs F4 re-derivation), BN-7 (E5 includes `manual` runners), BN-11.
2. **Data-Identity Lead:** M2's wording and `job_id`s (unchanged from §10.4). In production, E2 will raise **one** case for the 11 Jun row on the first daily sweep after deploy 4 (R3), owned by H-3.
3. **Fri 23:** retirement edits on `entities-api.js` by symbol (R-1 to R-5); test 4 plus `nav-007-worker.test.mjs` 58/58; the Sat 24 run sheet with G-1, ML-1021-3 (1) and the dump and M1 render steps.

---

## Thu 22 Oct 2026 — day 3, brought forward (ML-1022-1): retirement edits, test 4, Sat 24 run sheet

**Preflight:** no `.git/*.lock`; HEAD `c3c6e4a`. `entities-api.js` = `fac446bf…e245`, the spec's basis, **unchanged since `0dd7ef0`** (D-4 holds: the diff against `0dd7ef0` equals the diff against HEAD). FREEZES `cdc9606a…c346` (no dated window on Sat 24). **Local only: 0 D1 reads by this lane today, 0 writes, no deploy, no git write.** Per ML-1022-1, the `entities-api.js` change deploys **Sat 24 or later, after 007's release**, and LANE-1-ENG commits it.

### 1. Retirement edits (§10.5 R-1 to R-5), by symbol, base `0dd7ef0`
`App/Corporate Atlas/src/entities-api.js`: 1,678 → **955 lines** (−741, +12). An assertion script removed one contiguous block, from the "MA-SEP-012b … admin surface — RETIRED" header to `export default`. It checked that the block declared **exactly** these 19 symbols and nothing else:
- `checkAdminExceptionsAuth`, `handleListExceptions`, `handleAddException`, `handleEditException`;
- `_accessJwksCache`, `_accessJwksCacheAt`, `ACCESS_JWKS_TTL_MS`, `base64UrlToUint8Array`, `base64UrlDecodeJson`, `getAccessJwks`, `verifyAccessJwt`;
- `ENTITY_EXCEPTIONS_COLUMNS`, `handleListEntityExceptions`, `normalizeSourceRef`, `nowSqlTimestamp`, `handleAddEntityException`, `handleEditEntityException`, `entityExceptionsUiHtml`, `handleEntityExceptionsUi`.

A grep first confirmed that every helper among them had no caller outside the exception code, which R-1's "only if no other caller" requires.

| # | Change |
|---|---|
| R-1 | The `/exceptions/ui`, `/exceptions` and `/^\/exceptions\/(\d+)$/` router branches are deleted, along with their handlers, the UI, the column list and the JWT/JWKS helpers. |
| R-2 | The `/admin/exceptions` residue is deleted: its auth check, its 3 handlers on the dropped `entity_merge_exceptions`, its 2 router branches and the retired-block comments. An assertion confirmed the replaced router span contains no `/api/` route. |
| R-3 | One rule replaces them: `/^\/(admin\/)?exceptions(\/|$)/` → `410 {"error":"gone","moved_to":"meridian-ops /api/ops/admin/cases (MA-OCT-003)"}`, before any D1 access. Marked for removal in November. |
| R-4 | CORS keeps `GET, OPTIONS` (007's routes). POST and PUT are dropped, since no POST/PUT handler remains, and so are the two exception request headers. |
| R-5 | `wrangler-entities-api.toml`: `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are removed. `[vars]` is now empty, so the section is gone too. The `/exceptions` Access app keeps its AUD until R-10, so a rollback restores the old version with no config change. |

Nothing under `/api/entities/*` or `/api/instruments/*` changed. The diff is saved as `~/MeridianAtlas-work/ma-oct-003/patches/03-retirement-entities-api.diff` `c02f62b13f77eef4a44bcc2179d5091698656069d934ea2edf2595e0efecc714`: **its own commit**, against base `0dd7ef0` = HEAD for this file.

### 2. Test 4: `App/Corporate Atlas/tests/entities-api-retirement.mjs` (new): **77 / 77**
1. **R-9 static greps** over `App/` and `docs/` for the six spec strings:
   - Only SQL history remains: the 012b/015b migrations, `sprintboard_update_*.sql` records, and `registry-load-2026-10-12.sql`, whose owner text R-8 changes on Mon 26.
   - The R-3 rule lines are the only hits in live code.
   - `docs/` has no hit at all.
   - **Note for the Architect:** the spec's needle `/admin/exceptions` is a substring of 003's new `meridian-ops` route `/api/ops/admin/exceptions`. The test excludes exactly that prefix and nothing else.
   - Plus per-symbol absence checks, CORS, the toml, and "no POST/PUT handler remains".
2. **AC-14 part 3:** every retired path, 8 of them × GET/POST/PUT/DELETE = 32 calls, returns **410** with the exact body and **0 D1 calls**. `entity_exceptions` is unchanged. Look-alike paths (`/exceptionsfoo`, `/admin/exceptionsx`, `/api/exceptions`) still return 404.
3. **Differential A3-2.** The original Worker, loaded from `git show 0dd7ef0`, and the edited one were given 21 identical non-exception requests on the same fixture DB. They gave identical status and body every time:
   - `/api/entities/search` (two queries), `/:id` (found / not found), `/isin/:isin` (upper and lower case, unknown);
   - 007's `/api/instruments/:key` (ISIN, `CUSIP:`, unknown) and paging (`limit` valid / invalid, unknown entity);
   - 404 paths.

   The graph, etf-exposure, exposure and issuer-panels routes were compared on their **error path only**, because the fixture lacks those tables, so they are weak evidence. OPTIONS still returns 204, with Allow-Methods changed from `GET, POST, PUT, OPTIONS` to `GET, OPTIONS`. As a baseline, the original returns 401 on `/exceptions/ui` (Worker reached) and the edited one returns 410.
4. **`tests/nav-007-worker.test.mjs` passes 58/58** against the edited Worker (spawned), and `nav-007-key` passes 34/34.

**Mutation check:** run against the *original* `entities-api.js`, test 4 fails 48 of 77. The edited file was restored with its hash verified (`d18845dd…70db`).

**Full suite now:**

| Suite | Result |
|---|---|
| cases-contract | 63/63 |
| migration-m1 | 29/29 |
| sweep-ext-contract | 34/34 |
| sweep-contract (002a, unchanged) | 23/23 |
| admin-jobs-lateness | 13/13 |
| health-check | 15/15 |
| lateness | 42/42 |
| boost-heartbeat-resilience | 207/207 |
| **entities-api-retirement** | **77/77** |
| nav-007-worker | **58/58** |
| nav-007-key | 34/34 |
| nav-007-frontend | 39/39 |
| `ingest-contract.mjs` | not run (ML-1021-3) |

### 3. Commit layout for LANE-1-ENG (ML-1012-2)
| Commit | Files | Diff (outside repo) | Deploys |
|---|---|---|---|
| **003 routes** | `App/Ops/src/cases.js`, `migrations/004-ops-cases.sql`, `migrations/m1-entity-exceptions-to-ops.sql`, `migrations/m2-seed-gleif-cases.sql`, `tools/m1-render.mjs`, `tests/cases-contract.mjs`, `tests/migration-m1.mjs` + the hunks of `ops-api.js` / `wrangler-ops.toml` in diff **01** | `01-routes-ops-api-hooks.diff` `7855781e…525b` | Sat 24, deploy 3 |
| **003 sweep** | `App/Ops/src/sweep-ext.js`, `tests/sweep-ext-contract.mjs` + diff **02** hunks | `02-sweep-ops-api-hooks.diff` `107b0cf0…a728a` | Mon 26, deploy 4 |
| **003 retirement** | `App/Corporate Atlas/src/entities-api.js`, `wrangler-entities-api.toml`, `tests/entities-api-retirement.mjs` | `03-retirement-entities-api.diff` `c02f62b1…c714` | after 007's release (Sat 24 or later; spec: Mon 26, deploy 5) |

Diffs 01 and 02 are rebased onto A6's `ops-api.js` by this lane once A6 lands (ML-1021-3 (2)). Diff 03 has no A6 dependency.

---

## Sat 24 Oct run sheet (MA-OCT-003 + the A6 handshake): **for the Main Lane to issue as the Sat 24 Control**

### Ground rules for every step
- **Times:** ≥ 08:05 UTC. Re-read `claude/relays/FREEZES.json` **on the day**. As of today the Sat windows are 05:50–07:10, 07:55–08:05, **10:45–11:15**, **16:45–17:15** and 23:50–00:10 UTC. Keep **±2 min clear of the sweeps at 07:00, 11:00, 17:00 and 21:00 UTC** (BST until Sun 25).
- **Before every remote write:** read `d1-today`, and stop if `rowsWritten + step estimate > 60,000` (F-5, ML-1012-1).
- **Before every deploy:** confirm **C1 deployed = repo** (002 §10.2 method) and record the previous version id.
- **Wrangler:** `/usr/local/bin/wrangler` 4.96.0 only, never `npx`.
- **Owner of every remote step:** LANE-1-ENG (spec §16). This lane (LANE-8-ENG) owns step R0 (rebase) and the evidence checks it is asked for.
- **Cap:** ≤ 3 production deploys on Sat 24 (A3-1).
- **Values:** no secret value in any report. Dump rows are never pasted (they contain identities).

### Planned timeline (UTC)
- 08:05–09:40: gates, A6, 004 indexes.
- 09:45: deploy 3.
- ~10:00–10:40: freeze, dump, M1, M2 (finished before the 10:45 band).
- 11:20–12:30: token admission and the production ACs.
- 17:00 and 21:00: observe the sweeps.

| # | Step | Who | Reads / writes | Pass check | Rollback |
|---|---|---|---|---|---|
| **G-1** | **Precondition for every `meridian-ops` deploy:** no 011 batch in flight, and 011 closed or held at a checkpoint. 011.RUN is CLOSED (no batches remain) and 011.CLOSE is reads-only; **confirmed in writing by LANE-11-ENG and the Main Lane before step 3.** If not confirmed: the slip rule moves the whole block to Mon 26 / Tue 27. | Main Lane, LANE-11-ENG | 0 / 0 | Written confirmation | — |
| **R0** | A6 is on disk and committed. This lane **rebases diff 01** onto A6's `ops-api.js` (the hook sits at the top of `handleAdmin`, which A6 keeps) and re-runs the full `App/Ops` suite on the rebased tree. **LANE-1-ENG commits "003 routes".** Record the commit id; it feeds step 10. | LANE-8-ENG, then LANE-1-ENG | 0 / 0 | Suite green on the rebased tree; `cases-contract` 63/63 | Drop the rebase; nothing deployed yet |
| 1 | Founder creates the Access app **"meridian-control admin"** (A6, 002 §13) | **Founder** (dashboard) | — | App listed; AUD recorded | Delete the app |
| 2 | **Deploy 1:** `meridian-control` (A6) | LANE-1-ENG | 0 / 0 | AC-a6 part 1 (002 spec) | Leave it deployed but unused (002 §13) |
| 3 | **Deploy 2:** `meridian-ops` **without** the governance routes (A6). `GET /api/ops/cf/d1-today` and `POST /api/ops/ingest/run-event` must answer exactly as before (the 011 runner and the boost depend on them). | LANE-1-ENG | ≈ 10 reads / 0 | AC-a6; `d1-today` 200; one run-event contract call accepted | `wrangler rollback` to `0905784d` (routes restored in one step) |
| 4 | `004-ops-cases.sql`: `--remote -c wrangler-ops.toml --file migrations/004-ops-cases.sql`. Then remote `EXPLAIN` of the two new plans (S2 on `idx_ops_exception_job_cond`; C-1 linked DQ on `idx_ops_dq_linked_exc`) | LANE-1-ENG | ≈ 20 / **≈ 10** (index entries over 8–10 `ops_exception` rows and 0 DQ rows) | Both indexes in `sqlite_master`; EXPLAIN = §11.2 | Leave in place (additive). DROP only with Founder approval |
| 5 | **Founder creates the `ops-script` Access service token but does NOT add it to the Access policy** (ML-1021-3 (1)). The **Client ID** (an identifier) goes into `OPS_SERVICE_ACTORS` in `wrangler-ops.toml`. The **Client Secret** is saved by the Founder to `~/.meridian-secrets/ops-script.env` (mode 600), with the expiry date set and recorded in the report. It is never printed, committed or pasted. | **Founder** (Zero Trust); LANE-1-ENG edits the var | 0 / 0 | The entry's shape matches `wrangler-ops.toml`'s comment; the file is mode 600 | Delete the token |
| 6 | **Deploy 3:** `meridian-ops` with the **003 routes + allowlist** (commit "003 routes" + the step-5 var), **not** the sweep extensions | LANE-1-ENG | 0 / 0 | Version id recorded | `OPS_CASES_ENABLED="false"` (503 before D1) or `wrangler rollback` to the deploy-2 version |
| 7 | **Production checks on deploy 3**, from the Founder's browser (Access session):<br>- **AC-1:** no-JWT / CSRF behaviour is proven at Worker level by test 1; production shows the Access edge refusing an unauthenticated call.<br>- **AC-16:** `GET /api/ops/admin/exceptions` lists the open cases (8 on 21 Oct); `rows_read` ≤ 102. `GET /api/ops/admin/cases/<a sweep case>` gives `rows_read` ≤ 230.<br>- Remote `EXPLAIN` of the §11.2 set (E-1, C-1 ×4, idempotency probe). | Founder (browser), LANE-1-ENG (EXPLAIN) | ≈ 350 / 0 | Values recorded; plans = §11.2 | As step 6 |
| 8 | **Freeze:** the Founder sets the existing `/exceptions` Access app's policy to **Block**. Check that `GET /exceptions/ui` now returns Access's 403 | **Founder** (Zero Trust) | 0 / 0 | 403 from Access | Unblock the policy (instant) |
| 9 | **Dump:** `wrangler d1 execute meridian-etf --remote --json --command "SELECT * FROM entity_exceptions ORDER BY id"` → `~/MeridianAtlas-work/ma-oct-003/pre-migration-entity_exceptions-<UTC>.json` (mode 600, outside the repo and iCloud). **Record only its SHA-256 and row count (expect 9).** Then the **guard**: `SELECT COUNT(*) FROM entity_exceptions WHERE exception_type NOT IN ('entity_merge','bad_relationship_edge','isin_duplicate')` → must be **0**, else STOP. Then `d1-today`: `rowsWritten + 300 ≤ 60,000` | LANE-1-ENG | ≈ 30 / 0 | 9 rows; guard 0; headroom ok | — |
| 10 | **Render M1** with the routes commit id from R0: `node App/Ops/tools/m1-render.mjs --commit <id>` → `~/MeridianAtlas-work/ma-oct-003/m1-rendered-<id>.sql`. Record the template and rendered SHA-256. Re-run test 2 locally (29/29). Then `--remote --file <rendered>` | LANE-1-ENG | ≈ 50 / **≈ 150** (§11.1) | wrangler meta `rows_written` ≈ 150; "Total queries executed" 4 | Before retirement: unblock the legacy policy (legacy is authoritative again) and mark the 9 tickets `dismissed` / `migration_rolled_back` with an event. Events cannot be deleted (trigger) |
| 11 | **Verify V1–V4 (AC-12, AC-13):**<br>- V1: 9 tickets, **7 resolved + 2 open**.<br>- **V2 = 0** (the byte-for-byte query in §10.3).<br>- V3: events created 9 / decision_recorded 7 / migrated 9; **`object_key` set = {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219}**.<br>- **V4:** re-run the same rendered file → `rows_written` 0 on all statements. | LANE-1-ENG; Data-Identity Lead checks | ≤ 200 / 0 | All exact | As step 10 |
| 12 | **M2:** `--remote --file migrations/m2-seed-gleif-cases.sql`. Then read back `EXC-M-000001` (E3, sev2, phase1) and `EXC-M-000002` (E4, sev3, delta), each with 1 `created` event | LANE-1-ENG | ≈ 10 / **≤ 20** | 2 cases + 2 events; a re-run writes 0 | Resolve both as `superseded` with a note (no delete) |
| 13 | **Founder adds the `ops-script` token to the Access policy**, only now: after deploy 3 is verified (step 7) and with AC-1b already proven at Worker level (test 1). | **Founder** (Zero Trust) | 0 / 0 | Token in the policy | Remove it from the policy (immediate), then revoke |
| 14 | **AC-1b in production** with the token:<br>- E-1 → 200;<br>- C-2 `resolve` on `DQ-M-000004` → **403** `service_action_not_allowed`;<br>- `GET /api/ops/admin/jobs` → **403** `service_route_not_allowed`.<br>Then **AC-2 / AC-4** on **one case the Founder picks** (proposed: the oldest open `job_failed`, a real triage action): `acknowledge` (actor `service:ops-script`); the same `request_id` again → 200 replay, 0 writes; the same `request_id` with `comment` → 409 `request_id_reused`.<br>AC-3 (the race) stays proven in test 1, to avoid a second real transition. | LANE-1-ENG with the token; Founder picks the case | ≈ 30 / **≈ 6** | Codes and events as in test 1 | As step 13; the case can be reopened by the Founder |
| 15 | **Observe** the **17:00 and 21:00 UTC** sweeps on deploy 3. The sweep code is unchanged from 002a: raises work, `rows_read` ≤ 1,000, no errors in the logs | LANE-1-ENG | the sweeps' own / their own | Two normal sweep responses | Step 6 rollback |
| — | **End of day:** the report records version ids, SHA-256s, each step's reads and writes, the token expiry date (not its value) and the dump hash | LANE-1-ENG; LANE-8-ENG evidence | — | — | — |

**Sat 24 totals (003 + A6):** ≤ **3 production deploys**; D1 writes **≈ 200**: 004 ≈ 10, M1 ≈ 150, M2 ≤ 20, AC-2/4 ≈ 6, plus heartbeats/ingest from normal traffic. Reads ≈ 700. That is inside spec §16's ≈ 230.

**Founder actions on Sat 24:**
1. Create the "meridian-control admin" Access app (step 1).
2. Create the `ops-script` token and store its secret, **without** admitting it (step 5).
3. Block the legacy `/exceptions` Access app (step 8).
4. Admit the token to the policy (step 13).
5. Pick the case for AC-2/4 (step 14).

**If Sat 24 slips:** the whole block moves to Mon 26 / Tue 27 in the same order (§16). Sun 25: nothing remote (clock change, holdings freeze, FIRDS day).

### Mon 26 preview (not run on Sat; for the Mon 26 Control)
- **Deploy 4,** `meridian-ops` sweep extensions (diff 02 rebased onto A6 + "003 sweep" commit), after the 08:00 UTC sweep (GMT from Mon 26: sweeps at 08:00, 12:00, 18:00 and 22:00 UTC), with `OPS_SWEEP_AUTORESOLVE="true"` and `OPS_SWEEP_GLEIF_CHECKS="true"`. Observe the 12:00 sweep for AC-9 to AC-11 where the data allows.
  - **Expected:** E2 raises one case for the 11 Jun stuck row (H-3). The seeded E4 delta case suppresses the automatic one.
- **Re-dump** `entity_exceptions` and compare its SHA-256 with Sat 24's: must be **byte-identical** (proof there were no writes after the freeze).
- **Deploy 5,** `meridian-entities-api` retirement (diff 03), **after 007's release** (ML-1022-1). Before deploying: C1 deployed = repo, and record the previous version id.
  - Then AC-14: Access 403 on the blocked paths, production **410 on `/admin/exceptions`**, and `/api/entities/*` + `/api/instruments/*` unchanged.
  - Rollback: `wrangler rollback` (only `/exceptions` returns; its Access app is still blocked).
- **R-6:** `wrangler secret list --name meridian-entities-api` (names only); delete any admin-exceptions secret.
- **R-7** (local, Founder approval): delete `~/.meridian-secrets/admin-exceptions.env` and `App/Corporate Atlas/entity-exceptions-snapshot.html`.
- **R-8:** the registry `owner_role` update with an audit row. Then AC-15.
- **Sat 31:** R-10: delete the blocked Access app; check the production 410 (AC-14b); delete both dumps and record the deletion.

### Files (SHA-256 at report time)
| File | SHA-256 |
|---|---|
| `App/Corporate Atlas/src/entities-api.js` | `d18845ddc26666bf3253c0ed96cd77604f24b5b840c41925676d930a83ac70db` |
| `App/Corporate Atlas/wrangler-entities-api.toml` | `a6e0a6ec104bfd80f7ad962c4a34ee5edb69fe5512474f0cfdc569945570788a` |
| `App/Corporate Atlas/tests/entities-api-retirement.mjs` | `02598a8a80ef0db3fd1693e47e1fc43c4534cfb91ac86b6eb2e5e573f61f5de8` |
| `~/MeridianAtlas-work/ma-oct-003/patches/03-retirement-entities-api.diff` | `c02f62b13f77eef4a44bcc2179d5091698656069d934ea2edf2595e0efecc714` |
| `App/Ops/*` (unchanged since day 2) | as in the Thu 22 day-2 table |

### For the reviewers / Main Lane
1. **Architect:**
   - BN-1, BN-6, BN-7 and BN-11 (days 1–2);
   - R-9's needle overlap with `/api/ops/admin/exceptions`;
   - step 5's token order (ML-1021-3);
   - the run sheet as a whole.
2. **Data-Identity Lead:** V1–V3 expectations at step 11; the AC-2/4 case choice at step 14 (an Ops case, not an Entities one).
3. **Main Lane:**
   - issue the Sat 24 Control from this run sheet;
   - obtain the G-1 confirmation;
   - sequence deploy 5 after 007's release.

This lane stops here (final stop point of the Task).
