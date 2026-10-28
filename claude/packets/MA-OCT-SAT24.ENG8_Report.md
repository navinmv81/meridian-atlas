# MA-OCT-SAT24.ENG8 — Report (LANE-8-ENG, Engineering Lead): Sat 24 part 2 — 003 rebase, deploy 3, M1/M2

**Status at 17:01Z: COMPLETE.** Every step of the Task is done:
- production: 004, deploy 3 `14aa968c`, M1/M2, and AC-1b/2/4/12/13/16;
- the 17:00Z sweep on deploy 3 is clean.

The open items are listed at the end.

## Opening checks (08:16Z / 08:30Z)
- Control `9c6e931a…67ed` and Task `4f7598f4…ea82` match the board row and the status file. The board records the Founder's Sat 24 go-live approval (Fri 23).
- No `.git/*.lock`. Shared checkout: `October-2026` at `c3c6e4a` (left untouched).
- Governing documents re-hashed and matched:
  - run sheet `1307bf36…efba`;
  - BREVA `36546418…a0c1`;
  - BREVD `d630fe73…9e58`;
  - FREEZES `cdc9606a…c346` (unchanged; the 011 dated window ended 24 Oct 00:00Z).
- **Gate:** ENG1's "A6 live" message (≈ 08:26Z, report on disk) gives:
  - `meridian-control` `c442209c`;
  - `meridian-ops` `fffe9f9f` (A6). This is **this lane's deploy-3 rollback target (S-5)**;
  - previous ops version `3c88f8d2`.

  `wrangler deployments list` at 08:34Z confirms `fffe9f9f` is 100% live. `origin/October-2026` = `ccff23b`.
- Pre-flight `wrangler whoami` (4.96.0) at 08:34Z: logged in. `d1-today` at 08:34Z: rowsWritten **31**.
- **G-1 (S-2):** the Main Lane's written confirmation is in the Task. **S-1:** A6 is committed (`7330a7f`) and live.

## Step 1: rebase onto A6 in a separate worktree ✅
- **Worktree:** `~/MeridianAtlas-work/ma-oct-003/eng8-worktree`, detached at `origin/October-2026` `ccff23b`.
- **Routes-only diff 01** (`7855781e…525b`) applied with `git apply -C1`. A6 rewrote the header comment that diff 01 used as context. Both anchors, the `lateness.js` import and the top of `handleAdmin` (`verifyAccessJwt` / `who`), are unchanged, so the two hunks landed in the same places. No other edits.
- Added: `src/cases.js`, `migrations/004-ops-cases.sql`, `m1-entity-exceptions-to-ops.sql`, `m2-seed-gleif-cases.sql`, `tools/m1-render.mjs`, `tests/cases-contract.mjs`, `tests/migration-m1.mjs`. **Not added:** `src/sweep-ext.js`, `tests/sweep-ext-contract.mjs`, diff 02.
- **S-3 static check:** a grep of `src/*.js` and `wrangler-ops.toml` for `sweep-ext`, `OPS_SWEEP_GLEIF_CHECKS`, `OPS_SWEEP_AUTORESOLVE`, `suppress`, `gleif_checks`, `auto_resolved` and `rekeyConditions` finds **0 hits**. `sweep-ext.js` is absent from the tree.
- **BREVA N-1 (allowlist hardening):**
  - New `SERVICE_ROUTE_IDS = ['E-1','E-2','C-1','C-2']` in `cases.js`.
  - `serviceGate` refuses the **whole** entry (403 `service_not_allowed`, before D1) if its `routes` list holds anything outside those four, so a stray `"other"` can no longer open `/jobs`.
  - 3 new checks in `cases-contract`: `"other"` added → 403 on `/jobs` **and** on E-1; unknown id `D-9` → 403; the canonical entry still → 200.
  - **Mutation:** with the guard line removed, 2 of 66 fail. Restored.
- **Suite on the rebased tree:**

  | Test | Result |
  |---|---|
  | `cases-contract` | **66/66** |
  | `migration-m1` | 29/29 |
  | A6 `control-split` | **100/100** |
  | `sweep-contract` | 23/23 |
  | `admin-jobs-lateness` | 13/13 |
  | `health-check` | 15/15 |
  | `lateness` | 42/42 |
  | `boost-heartbeat-resilience` | all passed |
  | `ingest-contract` | not run (ML-1021-3) |

- **Deploy-3 tree hashes (uncommitted; the `OPS_SERVICE_ACTORS` value is still `{}`):**

  | File | SHA-256 |
  |---|---|
  | `ops-api.js` | `1fb19b71…dda6` |
  | `cases.js` | `9784bd6e…b7b9` |
  | `wrangler-ops.toml` | `eb0d83db…8d50` |
  | `cases-contract.mjs` | `0a5e505e…26da` |

- **Note for whoever later updates the shared checkout:** its untracked `App/Ops/src/cases.js` and test files predate N-1. They must be moved aside before `merge --ff-only`, because git refuses to overwrite untracked files. The committed version is authoritative.

## Founder approval (08:4xZ)
In chat:
1. Today's remote steps approved.
2. `ops-script` Client ID supplied (`0b8216d5…99.access`).

## Run-sheet step 4: `004-ops-cases.sql` ✅ (08:44:14Z)
- **Before:** `d1-today` 31 written.
- **Apply:** `--remote --file`, success; rows_read 20, **rows_written 10**.
- **Read-back:** `idx_ops_dq_linked_exc` on `ops_data_quality_ticket` and `idx_ops_exception_job_cond` on `ops_exception` are both present.
- **Rollback:** leave in place (additive).

## Step 2 (S-4): commit ✅ `76f4261`, pushed `ccff23b..76f4261` (fast-forward; origin checked unchanged first)
- **`OPS_SERVICE_ACTORS`:** one entry, key = the Client ID (`common_name`), label `ops-script`, routes E-1/E-2/C-1/C-2. Actions: EXC the 7 actions; DQ only comment, assign and triage.
- **Value checks:** it parses, every route is inside `SERVICE_ROUTE_IDS`, and `serviceGate` maps E-1/C-2 → `service:ops-script`, `other` → 403.
- **JWT actor:** `ops-api.js` builds `service:${common_name}` for service tokens, which matches the gate's lookup.
- **Committed by explicit path (ML-1023-1):** the 9 routes files only.
- **Tests at commit:** 66/66, 29/29, A6 100/100.

## Step 3: deploy 3 ✅ `meridian-ops` **`14aa968c-dcb8-45fc-afbd-d16d8b72aa20`** (08:45:10Z)
- **C1:** deployed = `76f4261`, from the worktree (clean).
- **Previous version (S-5 rollback target): `fffe9f9f-579b-4b60-ac12-b6a728eb24e2`.**
- **Dry run first:**
  - bindings: no `OPS_SWEEP_GLEIF_CHECKS` / `OPS_SWEEP_AUTORESOLVE`;
  - the built bundle has **0** occurrences of `gleif_checks`, `auto_resolved`, `sweep-ext` or `rekeyConditions` (S-3), and does contain the 003 route code.
- **Production deploys today: 3 of 3** (ENG1 C1, ENG1 C4, this one). The cap is reached; any further change is a rollback or the kill switch only (S-5).
- **Anonymous checks (08:45Z):**
  - E-1, C-1, C-2 (POST) and `/jobs` → **302 to the Access login**. A forged `Cf-Access-Jwt-Assertion` header also gets 302.
  - `budget-risk` and `cf/d1-today` → 200.
  - `/api/ops/sprint-board` → 302 (A6 redirect intact).
  - Ingest with a random key → 401.
  - `d1-today` 41 written.
  - The live ingest keys were not exercised by this lane (no key file opened). The secrets are bound to the script and carry across a code deploy. **ENG1 step 6** (the first boost fire after 11:15Z: heartbeats 201) is the live proof on this version.
- **Remote EXPLAIN (§11.2), all `SEARCH`, matching test 1:**

  | # | Query | Plan |
  |---|---|---|
  | 1 | E-1 | covering `idx_ops_exception_queue (status=? AND (severity,opened_at)>(?,?))` |
  | 2 | E-1 `?job_id=` | `idx_ops_exception_job (job_id=?)` plus a temp B-tree bounded by the job's cases (as pinned) |
  | 3 | C-1 events | covering `idx_ops_case_event_subject` |
  | 4 | C-1 linked DQ | **`idx_ops_dq_linked_exc`** |
  | 5 | idempotency probe | covering `sqlite_autoindex_ops_case_event_1` |
  | 6 | case lookup | `sqlite_autoindex_ops_exception_1 (case_ref=?)` |

- **Open cases (read 18):** 8 cases:
  - 3 `job_failed` and 3 `job_missed` for the boost, all opened 13 Oct;
  - 1 `job_failed` for `manual.gleif-reconcile-011`, opened 17 Oct;
  - 1 `budget_risk` sev2, opened 18 Oct.

  **Proposed AC-2/4 case:** `EXC-S-6362258198E6`, the oldest open `job_failed`.

## AC-16 in production (Founder's browser, Access session) ✅
| Route | Result | rows_read | Limit |
|---|---|---|---|
| E-1 `GET /api/ops/admin/exceptions` | `ok:true`, **8 cases** (open + acknowledged), `next_cursor:null` | **8** | ≤ 102 |
| C-1 `GET /api/ops/admin/cases/EXC-S-6362258198E6` | `kind:"exception"`, 1 `raised` event, `linked_dq_tickets:[]`, registry row and 1 run | **6** | ≤ 230 |

- E-1's order is `(severity, opened_at, id)`: sev2 first, then sev3 by age.
- **AC-1 (Founder session reaches the Worker):** ✅.
- **Legacy `/exceptions/ui` before the Block (anonymous, 08:5xZ):** 302 to the Access login of app `af2ac4…` (expected).

## Run-sheet step 8: freeze ✅
- The Founder set the `/exceptions` Access app (AUD `af2ac4…`) policy to **Block** and confirmed the deny page while signed in (≈ 11:1xZ).
- Anonymous requests still get the Access login (302), which is expected: Access asks who you are before it applies the Block.

## Run-sheet step 9: dump + guard ✅ (11:15Z, after the 10:45–11:15 freeze)
- **Dump:** `~/MeridianAtlas-work/ma-oct-003/pre-migration-entity_exceptions-20261024T111527Z.json`, mode 600, canonical JSON of the result rows.
  - **9 rows**; types ⊂ {entity_merge, bad_relationship_edge, isin_duplicate}.
  - **SHA-256 `996f3d8fe31cc4d3a08617ca446033a1399b89c86edd72d9079e83da651b6942`.**
  - The Mon 26 re-dump must use the same canonicalisation: `json.dumps(results, sort_keys=True, separators=(',',':'))`.
  - A first attempt had stderr mixed into the raw file; its raw file was deleted unread, and only the clean dump exists.
- **Guard** (`exception_type NOT IN` the 3) = **0**.
- **`d1-today`:** 67 written (+300 ≤ 60,000).

## Run-sheet step 10: M1 ✅ (11:15:48Z)
- **Render:** commit `76f426176ecc27370ab6d7a10064af76512d0fcc` → `~/MeridianAtlas-work/ma-oct-003/m1-rendered-76f42617….sql`, mode 600, rendered SHA-256 `56812538…6d76`.
- **Template SHA-256:** `bf0f81d7…f6ce`. **N-6:** this equals `git show 76f4261:App/Ops/migrations/m1-…sql | shasum -a 256`.
- The placeholders are left only in the header comment. Test 2 was re-run locally: 29/29.
- **`--remote --file`:** wrangler printed nothing, so this run's meta was not captured. The writes are therefore shown by the state below, not by meta.
- **Note:** spec §10.3 step 4's `--local` dry run is covered by test 2, which runs the same template against a 015b/015c fixture.

## Run-sheet step 11: V1–V4 ✅
| Check | Result |
|---|---|
| V1 | **9 tickets: 7 resolved + 2 open** |
| V2 (byte-for-byte, the spec query) | **0** |
| V3 events | **created 9 / decision_recorded 7 / migrated 9**, all `recorded_at` 11:15:50.514Z |
| V3 `object_key` set | **{3, 49, 143, 194, 931, 2014, 2589, 28219, 204921}**, the expected set |
| `migrated` payload | 9 of 9 carry `file_sha256` `bf0f81d7…` and `commit` `76f42617…` |
| **Protected pairs** | `DQ-M-000001..3`, `disposition do_not_merge`, resolved, unchanged (V2 covers `disposition` verbatim) |
| **V4** | (a) the same file again via `--file`: `changes 1`, `written 4`, `changed_db true`, but **no row changed**: ticket `updated_at` unchanged, max `event_id` still 44, `last_row_id` 0. (b) To prove it, the 4 statements were re-run via `--command`: **`changes 0`, `changed_db false` on all 4.** |

- **Reading the V4 numbers:** the `written 1` per statement in (b) is D1 counting each `INSERT OR IGNORE` attempt. The import path's `changes 1` is not a data change; 004's file run showed the same artefact. **For the record:** later `--file` runs report one more change than they make.
- **Reads:** V2–V4 read about 870 rows, over the run sheet's ≤ 200. The V3 event join alone read 276. That is still trivial against the 5M/day cap.

## Run-sheet step 12: M2 ✅ (11:17:16Z)
- **File:** `m2-seed-gleif-cases.sql` `a6e621d3…5eab`, `--file`: read 66, **written 26**, changes 5 (4 plus the import artefact).
  - **Written is over the ≤ 20 estimate:** the extra rows are index entries on `ops_exception`.
- **Read-back:**
  - **`EXC-M-000001`** `gleif_orphaned_backlog` sev2 open, `cf.meridian-entities-enrich.phase1`, 1 `created` event;
  - **`EXC-M-000002`** `gleif_frozen_source` sev3 open, `cf.meridian-entities-delta`, 1 `created` event.
- **Re-run** via `--command`: `changes 0` and `changed_db false` on all 4 statements.
- **Open cases now:** 10.

## Run-sheet step 13: AC-12 / AC-13
- **AC-12 (migration exact):** met by V1–V4.
- **AC-13 (seeded GLEIF cases):** met by step 12.

## INCIDENT (08:46Z): `ops-script` Client Secret printed into the session transcript
- **What happened:** while checking the shape of `~/.meridian-secrets/ops-script.secret` (mode 600; a single bare value with no newline), this lane ran a `sed` redaction whose pattern did not match the value's format. The **Client Secret was printed** to this Claude Code session's output. No file, report or commit contains it.
- **Exposure:** the token is **not admitted** to any Access policy (step 13 not done), so today it grants no access.
- **Required before admission:** the Founder **rotates the token's client secret** in Zero Trust and overwrites `~/.meridian-secrets/ops-script.secret`.
  - **Update ≈ 11:1xZ:** the Founder **rotated the secret; the Client ID is unchanged** (`0b8216d5…99.access`), so `OPS_SERVICE_ACTORS` and deploy 3 stand.
  - **The file still shows mtime 08:08Z** (54 bytes, mode 600), which is **before** the rotation. It still holds the old, printed value, and must be overwritten before step 14.
  - If rotation **keeps the Client ID**, nothing else changes.
  - If it **issues a new Client ID**, `OPS_SERVICE_ACTORS` needs a new commit and deploy. That would exceed today's 3-deploy cap, so admission and AC-1b/2/4 move to Mon 26.
- **Process fix in this lane:** secret files are checked by `wc -c` / mode only, never by redact-and-print.

## Held (history)
- At 08:35Z the permission control refused 004. The Founder then approved the remote steps.

## Timing
- Freezes ahead: 10:45–11:15 and 16:45–17:15. Sweeps at 11:00, 17:00 and 21:00.
- If 004 + deploy 3 + M1/M2 cannot finish by 10:40, M1/M2 move to 11:20Z or later.

## Run-sheet step 14: AC-1b, AC-2, AC-4 with the token ✅

**First attempt (11:24Z, held):**
- All three calls got **302 to the Access login** (`kid` `7f1b6784…`). The Access edge refused the token, so no request reached the Worker and nothing was granted. 0 writes.
- **Cause (Founder):** the Service Auth policy had **not been saved**. It was saved at ≈ 11:25Z.
- The token file at that point: mtime 11:23:56Z, 54 bytes, mode 600, no whitespace. The Founder confirms it holds the rotated secret.
- The secret is passed to curl on stdin (`-K -`), never echoed or put on the command line.

**N-8: refusals first (11:26:00Z):**

| Check | Result |
|---|---|
| C-2 `resolve` on `DQ-M-000004` | **403 `service_action_not_allowed`** |
| `GET /api/ops/admin/jobs` | **403 `service_route_not_allowed`** |

Both are refused by the gate before validation and before D1.

**AC-2 / AC-4 on `EXC-S-6362258198E6` (Founder-chosen), 11:26:15Z, request_id `4378e6db-686e-4e1f-9ada-6cbaadf6d92f`:**

| # | Call | Result |
|---|---|---|
| 1 | `acknowledge`, expected `open` | **200**, case → `acknowledged`, rows_read 22 |
| 2 | Same body again | **200 `replay: true`**, rows_read 2, no new event |
| 3 | Same request_id, different body (`comment`) | **409 `request_id_reused`**, current state `acknowledged` |

- **D1 read-back:**
  - the case has exactly 2 events: `raised` (8) and **`acknowledged` (99)**, open → acknowledged;
  - actor **`service:ops-script`**, `actor_source` `access_service_token`;
  - the payload holds the full pre-image (BN-1) and `request.common_name` = the Client ID;
  - the case's `updated_at` is 11:26:15.227Z.
- **AC-3 (the race)** stays proven by test 1, as planned; no second real transition was made.
- **Writes:** about 6.

## Step 5: sweeps on deploy 3 (S-3)
**The 11:00Z sweep has already run on deploy 3** (it went live at 08:45Z):
- `swept | raised=0 findings=1 already_open=1 overflow=0 hold=false … rows_read=284`;
- heartbeats start and success both HTTP 201, so the `health-check-local` ingest key works on `14aa968c`;
- end-event metrics: `{raised 0, findings 1, already_open 1, open_sev2 1, open_sev3 7, rows_read 284}`.

**Limit on the literal S-3 check:**
- The health-check runner (`13F Seed/check-pipeline-health.js:145`, `:156`) logs and stores **only fixed fields**. The raw sweep response is not kept anywhere.
- So "no `suppressed` / `gleif_checks` / `auto_resolved` fields" **cannot be observed directly** from any log or table, on any sweep.
- **The evidence used instead:**
  1. The deploy-3 bundle (dry run of `76f4261`, the deployed commit) contains **0** occurrences of those field names or of `sweep-ext`.
  2. `wrangler deployments list` confirms `14aa968c` is 100% live.
  3. The sweep's behaviour is unchanged, which a working `sweep-ext` would not give: `raised=0`, `already_open=1`, rows_read in the 002a range.
- **Fix:** logging the full response (or its key set) is a small runner change, recommended for the Mon 26 deploy 4, where its new fields must be seen. It is not made today (out of scope).

**17:00Z sweep on deploy 3 ✅:**
- `swept | raised=0 findings=0 already_open=0 overflow=0 hold=false headroom=99725 open={"sev2":2,"sev3":7} rows_read=238` (≤ 1,000);
- heartbeats start and success both 201 (run `284ff8a4…`);
- live version re-checked at 17:00:30Z: `14aa968c` at 100%.

**The open counts reconcile with today's changes:**
- sev2 2 = `budget_risk` + the M2 seed `EXC-M-000001`;
- sev3 7 = 5 boost cases + the 011 `job_failed` + the M2 seed `EXC-M-000002`. `EXC-S-6362258198E6` is now acknowledged and no longer counted as open.

**No raises and no errors.** S-3 holds on the evidence above.

## Close-out

**Production changes by this lane:**

| # | Change |
|---|---|
| 1 | 004 indexes (08:44Z) |
| 2 | deploy 3 `meridian-ops` `14aa968c` (08:45Z; rollback `fffe9f9f`) |
| 3 | M1 (11:15Z) |
| 4 | M2 (11:17Z) |
| 5 | one `acknowledge` (11:26Z) |

**Founder actions:**
- token creation;
- Block on the legacy app;
- secret rotation (Client ID unchanged);
- Service Auth policy on meridian-ops admin.

**Deploys today:** 3 of the 3-deploy cap (ENG1 ×2 + this lane). No rollback or kill switch was used.

**D1 by this lane:** about 175 row-writes (004 10, M1 ≈ 150 incl. accounting, M2 26, the action ≈ 6). Reads about 2,000, all bounded.

**Git:** `76f4261` (explicit paths, ML-1023-1), pushed. This report is not committed; it waits for the Main Lane's commit list.

**Open items:**
1. **Main Lane:**
   - board and Ledger update;
   - commit this report;
   - the Mon 26 Control.
2. **Mon 26 deploy 4:** first log the sweep response's key set in `check-pipeline-health.js`, so deploy 4's new fields (`suppressed`, `gleif_checks`, `auto_resolved`) can be seen. Per BREVD N-1, E2/E4 first run at **Tue 27 08:00Z**.
3. **Mon 26:**
   - re-dump `entity_exceptions`: it must be **byte-identical** to `996f3d8f…6942`, using the same canonicalisation;
   - then deploy 5 (retirement, after 007's release), R-6, R-7, R-8.
4. **Shared checkout:**
   - it is still at `c3c6e4a`;
   - its untracked 003 copies are older than `76f4261` (N-1) and must be moved aside before `merge --ff-only origin/October-2026`;
   - its working-tree `ops-api.js` / `wrangler-ops.toml` still hold diffs 01+02 and the empty allowlist.
5. **Worktree `~/MeridianAtlas-work/ma-oct-003/eng8-worktree`:** kept for deploy 4 (diff 02 is rebased there on Mon 26).
6. **Incident (08:46Z):** closed by the rotation (the Client ID is unchanged and the file was replaced at 11:23:56Z). It is recorded here for the Main Lane log.
7. **ENG1 carry-over still open:** the authenticated `meridian-control` admin check (C3).
