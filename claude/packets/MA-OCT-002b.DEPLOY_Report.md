# MA-OCT-002b.DEPLOY — Report (LANE-8-ENG, Engineering Lead)

**Opening checks (Thu 5 Nov, 20:08Z):**
- Control `e6dbb30d…02b3` matches board row 111; Task `472be5b0…82b8` matches.
- No `.git/*.lock`. `wrangler whoami` ✓ (4.96.0).
- **ML-1105-3** (Decisions Log line 230): 013 falls back to November, so there is no 013 run tonight and 002b starts now. Production steps end by 23:45Z; anything unfinished runs Fri morning, before November work.

**Sign-offs (preconditions):** neither is REJECTED for any step.

| Report | Verdict | Conditions |
|---|---|---|
| `MA-OCT-002b.SIGNE_Report.md` `5faaaa1a…` (ETF PL) | SIGNED with 3 | **C-1** move the holdings measurement read after the cursor saves, in try/catch (blocks M10 until done); **C-2** `OPS_HEARTBEAT_START` stays unset until M4 shows ≥ 2 subrequests of room, and turning it on needs a new ETF-PL sign-off; **C-3** re-sign E5 if another `writes_today_*` writer is ever scheduled on a Sunday |
| `MA-OCT-002b.SIGND_Report.md` `34ddcb86…` (Data-Identity Lead) | 4 SIGNED, 2 with condition | **#3** measure the enrich `:50` fires: if `subrequests_total + 1 > 46`, the phase23 heartbeat goes off; **#6** CR-10 steps 3–5 each need their own sign-off (`ON CONFLICT DO UPDATE` from step 3; no new keys without a §14 decision) |

- **RQ-2 (Main Lane):** Phase 2+3 keeps the counter. This is already so in the build.

**Other lanes:** today's reports are 013.BUILD (07:27Z, local) and 013.CHECK (19:28Z, read-only FAIL). Neither has an open production change, and 013 is off tonight.

## M0: rebase, C-1, tests, commit ✅
- **Rebase:** the 002b build moved from `1a59b77` onto `origin/October-2026` **`3c8866b`** (≥ `f362131` ✓). Origin's changes to my paths were 004/005 in `ops-api.js` and `wrangler-ops.toml`; they merged with no conflict.
- **ETF-PL C-1 applied:** in `holdings-pipeline.js` the measurement read (`getTodayWriteCount`) now runs after both `etf_offset` / `last_run_status` saves, inside `try/catch` (a failure only drops the measurement). A new static check in `heartbeats-contract` pins it.
- **Suites on the rebased tree, all green:**

  | Group | Results |
  |---|---|
  | 002b | schedules 24/24, heartbeats **34/34**, invocations 4/4, entity-pipeline-state 4/4, firds-cause 4/4 |
  | Ops | sweep-contract ✓, sweep-ext 34/34, cases 66/66, migration-m1 29/29, A6 control-split 100/100, admin-jobs-lateness ✓, health-check ✓, lateness ✓, boost-heartbeat ✓ |
  | 004/005 | console-shell ✓, dq-contract ✓, dq-page ✓, dq-seeds ✓, ops-a ✓, ops-console ✓ |
  | bonds | bonds-parse 31/31 |

- **Commit `7c0ad2e`**: 21 files by explicit path (no forbidden path), pushed `3c8866b..7c0ad2e`.

## Live state before any change (20:14Z)
- **`meridian-ops` live = `1109edb6-0ad7-448e-a67f-57a2ae123594`** (MA-OCT-005, 30 Oct 21:23Z). This is the M2 rollback target.
- **`OPS_INGEST_KEYS`:** the last secret change on `meridian-ops` was **K-5 (24 Oct 08:18Z)**, and there is no secret change since. So the live map is ENG1's 3-emitter K-5 canonical map (`boost-local`, `health-check-local`, `local-bonds`), and `gleif-a2` (A2.BUILD D-2) was never put. A2 is post-go-live (ML-1030-4).
- **Timing:** no Worker cron fires before 23:45Z (bootstrap's next is 00:00Z, enrich 06:00 / 06:50Z, seed Mon, holdings Sun), and today's first sweep (08:00Z) has run. **So the first heartbeat events and the first schedules refresh (first sweep of the UTC day) can only be observed Fri.** That observation is the Fri-morning remainder.

## Change log (UTC; one production change at a time)
- 20:1xZ: M1 done. 4 ingest keys at `~/MeridianAtlas-work/ma-oct-002b/keys/ops-ingest-<emitter>.key`, 64 hex each, mode 600, dir 700, never printed.
- 20:13:42Z: **starting** M2a: `meridian-ops` deploy from `7c0ad2e`. C1: `App/Ops` is identical at `ca15f70` (live source) and `3c8866b`, so the delta is 002b only (`ops-api.js`, `schedules.js`, `etf-cycle.js`). Rollback = `1109edb6`.
- 20:13:56Z: M2a done. **`meridian-ops` `2af53666-2a14-4b56-8161-b8a4954b2c92`**: budget-risk 200, d1-today 200, admin 302 (Access). The live `?subrequests=1` works.
- 20:15Z: M4 (B-2, read-only, CF analytics): holdings Sun 1 Nov **21**; bootstrap 4-hourly **18** each; seed Mon 2 **0**; enrich 06:00 / 06:50 on 3–5 Nov **0 / 0**. The field counts outbound fetches only, so D1 binding calls are excluded.
  - **DIL #3:** the `:50` fires show 0 GLEIF subrequests, so `0 + 1 ≤ 46` and the phase23 heartbeat stays on. Phase 2+3 ran with no GLEIF calls in these 3 days (data question for the Data-Identity Lead, not a deploy blocker).
  - **ETF C-2:** fetch room is 50 − 21 = 29, but holdings counts D1 calls against the same 50, so room cannot be shown from this metric. `OPS_HEARTBEAT_START` stays **unset**; a new ETF-PL sign-off is needed anyway.
- 20:14:48Z: **starting** M2b: `OPS_INGEST_KEYS` re-put (the K-5 map + 4 hashes) from stdin.
- 20:14:50Z: M2b done. **`meridian-ops` `cbb86f62-40a5-4d3a-918a-edf4bb331989`** (Secret Change).
  - The map is the K-5 canonical entries byte-identical (`boost-local` 9613478a, `health-check-local` 996a3312, `local-bonds` 0985ac0a) plus `holdings-cf` 748a49e1, `bootstrap-cf` aeeb529d, `entities-seed-cf` a33c0d26, `entities-enrich-cf` d5ec4948.
  - New canonical map (hashes only, mode 600): `~/MeridianAtlas-work/ma-oct-002b/ops-ingest-keys.canonical-map.002b.json`.
  - **Check:** each new emitter with its own key → **400** "unsupported contract version" (auth passed); a random key → **401**. The 3 existing entries are hash-identical; `health-check-local` is also proven live by the next sweep.
  - **Rollback:** re-put the K-5 map (3 entries).
- 20:16:22Z: **starting** M3: registry `emitter_id` + `observed_since` for 5 jobs.
  - **Three-point check:** UPDATE `SEARCH sqlite_autoindex_ops_job_registry_1 (job_id=?)`; 15 statements, ≈ 30 writes; `d1-today` 97.
  - **Why `observed_since = 2026-11-05T23:50:00Z`** (002a `lateness.js`): with an emitter set, the sweep would otherwise mark every past-week slot `missed` (bootstrap 6 a day). Slots before 23:50Z are `unobserved`, and the first real slot (bootstrap, Fri 00:00Z) alarms if no event arrives. Exprs are unchanged, so B1 drift is unaffected.
  - **Files:** SQL `~/MeridianAtlas-work/ma-oct-002b/state/m3-registry-emitters.sql` `bc547361…6b0e`; rollback `…rollback.sql` `ad42be26…e31b`.
- 20:16:23Z: M3 done. `changes` 1 × 15, 50 writes. Read-back: 5 jobs with `emitter_id` (`holdings-cf`, `bootstrap-cf`, `entities-seed-cf`, `entities-enrich-cf` ×2) and `observed_since 2026-11-05T23:50:00Z`; exprs unchanged.
- 20:17Z: Live versions (rollback targets): bootstrap `0a968cdc-6474-40d0-adf9-38edd9e5ee0c`, holdings `93ab6411-8fc4-4e37-aa01-673bb8eb7397`, enrich `23fd2660-e9fa-46e8-b161-f92198be9453`, seed `1cd92fc3-67ec-4991-8291-db7d78a6004e`, delta `b0b774ed-5cdd-4940-aec0-7c2a986015b9`. **C1:** no commit to any of their sources after its last deploy (to `3c8866b`).
- 20:17:30Z: **starting** M6: `meridian-bootstrap` deploy (ETF; end-only) + `OPS_INGEST_KEY` (stdin).
- 20:17:48Z: M6 done. **`meridian-bootstrap` `08928b71-9b83-4bdf-ac31-5a336ddea620`** (code), then **`0b6cc67e-b949-4c8c-8ff6-6b1812887813`** (`OPS_INGEST_KEY` put; `secret list` shows the name only). First heartbeat (1042 test) at the **00:00Z Fri** fire.
- 20:18:03Z: **starting** M7: migration `009-entity-pipeline-state.sql` (Entities, additive).
- 20:18:05Z: M7 done. `entity_pipeline_state` + `sqlite_autoindex_entity_pipeline_state_1` exist (3 writes, migration `f6de2cfc…`).
- 20:18:31Z: **starting** M8: `meridian-entities-enrich` deploy + `OPS_INGEST_KEY` (DIL #3 measured above: on).
- 20:18:48Z: M8 done. **`meridian-entities-enrich` `330df2e5-5753-47c5-acdd-9c0e936a6099`** (code; schedules `0 6 * * *`, `50 6 * * *` unchanged), then **`d669f9fc-89fb-464c-95d5-c5deb3b9e294`** (key put). Secrets: `OPS_INGEST_KEY`, `RUN_AUTH_SECRET`. First events at Fri 06:00 / 06:50Z.
- 20:19:06Z: **starting** M9: `meridian-entities-seed` deploy + key, then `meridian-entities-delta` deploy (held: dual-write code only, no key).
- 20:19:24Z: M9 seed done. **`meridian-entities-seed` `a0ad63d3-d021-4bf2-933c-ed05ac99c4fe`** (code; `0 4 * * mon`), then **`14332e4c-50c0-40c6-bf28-5e634a9fea77`** (key). First event Mon 9 Nov 04:00Z.
- 20:20:25Z: M9 delta done. **`meridian-entities-delta` `47c216c0-46c6-455b-a411-b447ed010f37`**: no trigger (held), no key; dual-write code only.
- 20:20:58Z: **starting** M10: `meridian-holdings` deploy + key (ETF-PL C-1 applied in `7c0ad2e`; C-2: `OPS_HEARTBEAT_START` unset, end-only).
- 20:21:15Z: M10 done. **`meridian-holdings` `57982e6b-6939-4d92-b1e8-edd4bf162264`** (code; `0 4 * * sun`; bindings `OPS_INGEST_URL`, `OPS_EMITTER` only, so **no** `OPS_HEARTBEAT_START`), then **`790a5482-28d3-443f-b5f3-32633e01d898`** (key). Secrets: `HOLDINGS_RUN_AUTH_SECRET`, `OPS_INGEST_KEY`. First event Sun 8 Nov 04:00Z (end-only).
- 20:21Z: **M5 waiting for the Founder** (`CF_WORKERS_READ_TOKEN`). No other change is open in this lane.
- 20:46:47Z: M5 done (Founder put the secret). `secret list` shows **`CF_WORKERS_READ_TOKEN`** (name only), beside `CF_ANALYTICS_TOKEN` and `OPS_INGEST_KEYS`. **`meridian-ops` `d9c3c386-e6e1-45bd-afd9-26cc3a06d409`** (Secret Change). First used at the first sweep of the UTC day (Fri 08:00Z).
- 22:00:06Z: **Sweep check (first sweep after M2b/M3/M5)** on `meridian-ops` `d9c3c386`: response **HTTP 200**, start and success heartbeats **201**, so `health-check-local` still authenticates against the re-put map (its K-5 entry survived).
  - New response fields: `schedules: null` (expected, not the first sweep of the UTC day), and the `etf` object carries `cycle: null` (expected, no Sunday cycle yet).
  - Totals: `findings` 14, `already_open` 13, `raised` 1, `rows_read` 266, headroom 99,850.
  - The one new case, `EXC-S-B6FBAAF278B6` (`local.entities-enrich-boost` missed 17:50Z), is the known evening-run failure (MA-OCT-000 finding 4). It is not caused by this packet: boost-local is not one of the M3 jobs.
  - No `job_missed` was raised for the 5 M3 jobs, so the `observed_since` change works as intended.

## Close-out for Thu 5 Nov (production window)

- All production changes (M2a, M2b, M3, M5–M10) were done by 20:47Z, one at a time, each with its rollback id above. No change is open, and none will be made after 23:45Z.
- **Still to observe (Fri 6 Nov, before November work, per ML-1105-3).** These are checks only. A change is made only if one of them fails.
  1. **bootstrap 00:00Z:** the first `cf.meridian-bootstrap` heartbeat lands 201 in `ops_job_run` (this is the 1042 test). If it is refused, set `global_fetch_strictly_public` (Fri morning, as its own change) or stop for option B.
  2. **enrich 06:00 / 06:50Z:** phase1 start + end, and phase23 end-only.
  3. **First sweep of Fri:** `schedules.checked` = 6, `effective_schedule` written, 0 `schedule_drift`. This proves `CF_WORKERS_READ_TOKEN`.
- "002b live" goes to the Founder once items 1–3 pass.

## Fri 6 Nov observations

- 00:03:29Z: **Check 1 (bootstrap 00:00Z, the 1042 test): FAILED. No heartbeat arrived.**
  - `meridian-bootstrap` did fire: `edgar_bootstrap_state.last_run` = `2026-11-06T00:00:02.034Z`.
  - But `ops_job_run` has **no** row for `cf.meridian-bootstrap` / `bootstrap-cf` (none ever).
  - The registry row is correct (`emitter_id bootstrap-cf`, `observed_since 2026-11-05T23:50:00Z`).
  - The heartbeat is fail-soft, so the run itself was unaffected.
  - **Likely cause:** error 1042. The Worker's `compatibility_date` is `2024-01-01`, and without `global_fetch_strictly_public`, a fetch to another `*.workers.dev` Worker on the same account is refused.
  - The error shows only as a `console.log` line, so I confirm it read-only with `wrangler tail meridian-bootstrap` across the 04:00Z fire.
  - Expected side effect: the sweep raises `job_missed` for the 00:00Z slot once the grace period ends. That is the alarm working, and it is left open.
  - The other three CF emitters (holdings, entities-seed, entities-enrich) use the same URL, and all have old compatibility dates. They will fail the same way.
- Process note: the first watcher (started 22:00:51Z) had a zsh test-syntax error, so it ran its query at 22:01Z (code 10000) and exited. It was rerun with a corrected wait. No effect on production.
- 04:03:42Z: **Cause, from `wrangler tail meridian-bootstrap` across the 04:00Z fire.** The run was `outcome ok` on version `0b6cc67e`. Its log line reads `[ops-heartbeat] cf.meridian-bootstrap success: HTTP 404`.
  - So the fetch was answered with 404, not routed to `meridian-ops`. The same URL from outside gets 400/401 (M2b).
  - This is the same-account `workers.dev` routing issue that the Task's "1042 test" anticipated. It shows as a 404 here, not as 1042.
  - Fix, as the Task names it: `compatibility_flags = ["global_fetch_strictly_public"]`.
  - Only outbound fetches change. The other fetch targets in these 4 Workers are public (SEC, GLEIF).
- 04:05:59Z: commit **`e93d71e`** (4 toml lines; Ops suites green: 18 pass, plus the env-only `ingest-contract`), pushed `5e41e7b..e93d71e`. All 4 dry-runs are clean.
- One change at a time, each with its secrets re-checked (names only) and its schedule unchanged:
  - 04:06:08Z **F1** `meridian-bootstrap` → **`b2ab8f09-3e71-4200-a57a-fd4eac03fa55`** (rollback `0b6cc67e`).
  - 04:06:34Z **F2** `meridian-entities-enrich` → **`5c64e54e-8467-40e9-9591-a547529b1d15`** (rollback `d669f9fc`).
  - 04:06:47Z **F3** `meridian-entities-seed` → **`135607d4-b6f6-4dc8-8b79-0e2d4b7e4389`** (rollback `14332e4c`).
  - 04:07:10Z **F4** `meridian-holdings` → **`888af088-5b5b-4923-b666-7f1cb0812126`** (rollback `790a5482`; still end-only).
  - F2 and F3 ran back-to-back in one command, but each deploy was confirmed before the next started.
- **Proof points:** enrich 06:00/06:50Z (first), bootstrap 08:00Z.
- 06:59:12Z: **Check 2 (enrich): PASS.** Rows landed in `ops_job_run` from emitter `entities-enrich-cf` (first read hit code 10000; retried):
  - 465: phase1 `start`, trigger `cron:0 6 * * *`, started 06:00:02.048Z.
  - 466: phase1 `end success`, ended 06:00:20.454Z.
  - 467: phase23 `end success` (end-only), trigger `cron:50 6 * * *`, 06:50:01.820Z → 06:50:02.827Z.
  - This proves the `global_fetch_strictly_public` fix (enrich `5c64e54e`).
- 08:00:10Z: **Check 3 (first sweep of Fri): PASS.** HTTP 200 on `meridian-ops` `d9c3c386`. It returned `"schedules":{"checked":6,"updated":7,"drift":0,"errors":{}}`, so `CF_WORKERS_READ_TOKEN` works.
  - `effective_schedule` was written for 7 jobs, all matching intent:
    - holdings `0 4 * * sun`, seed `0 4 * * mon`, enrich (both jobs) `0 6 * * *` + `50 6 * * *`, bootstrap `0 */4 * * *`;
    - delta and figi `none` (held).
  - 0 `schedule_drift` cases.
- 08:04Z: **Check 1 retest (bootstrap 08:00Z): PASS.** Row 470, `cf.meridian-bootstrap` `end success`, trigger `cron:0 */4 * * *`, 08:00:01.944Z → 08:00:15.453Z (bootstrap `b2ab8f09`).
- **Cases the 08:00Z sweep raised (left open; they are true alarms, not deploy defects):**
  - `EXC-S-6AAA3F5000EC` / `EXC-S-67C811400F2E`: bootstrap missed 00:00Z and 04:00Z. Correct: those heartbeats got 404 before the fix. Close them by hand with a note pointing to `e93d71e`.
  - `EXC-S-8D9277CA552E`: `cf.meridian-entities-enrich.phase1` frozen. Row 466 reports `items_attempted 100`, `items_progressed 0`. This is the first heartbeat-level view of the enrich stall (MA-OCT-000 finding 2), now visible thanks to B2. **For the Data-Identity Lead.**

## 002b live (Fri 6 Nov 08:04Z)

All three proof points passed. The Founder was told "002b live".

**Production changes in this packet**, one at a time; final versions with rollback ids:

| Step | Target | Final version | Rollback |
|---|---|---|---|
| M2a | `meridian-ops` code | `2af53666` | `1109edb6` |
| M2b | `OPS_INGEST_KEYS` | `cbb86f62` | re-put K-5 map |
| M5 | `CF_WORKERS_READ_TOKEN` | `d9c3c386` | delete secret |
| M3 | registry: 5 jobs `emitter_id` + `observed_since` | — | `m3-…rollback.sql` `ad42be26…e31b` |
| M7 | migration 009 `entity_pipeline_state` | — | drop table (empty) |
| M6, F1 | `meridian-bootstrap` | `b2ab8f09` | `0b6cc67e` (pre-packet `0a968cdc`) |
| M8, F2 | `meridian-entities-enrich` | `5c64e54e` | `d669f9fc` (pre-packet `23fd2660`) |
| M9, F3 | `meridian-entities-seed` | `135607d4` | `14332e4c` (pre-packet `1cd92fc3`) |
| M9 | `meridian-entities-delta` | `47c216c0` | `b0b774ed` |
| M10, F4 | `meridian-holdings` | `888af088` | `790a5482` (pre-packet `93ab6411`) |

- **Commits:** `7c0ad2e` (build rebase + ETF C-1) and `e93d71e` (`global_fetch_strictly_public`), both on `October-2026`.
- **D1 writes by this lane:** M3 50 and M7 3. All other queries were read-only.
- **Deviation:** the fix (F1–F4) went in on Fri 04:06–04:07Z, outside Thursday's window. ML-1105-3 allows unfinished work to run on Friday morning, and the Task names this fix. The cause showed as HTTP 404, not 1042 (wrangler tail).

**Open items, each for its own owner or packet:**
1. **ETF C-2:** holdings start events (`OPS_HEARTBEAT_START`) need a new sign-off. The M4 metric counts no D1 calls, so it can't show the room needed.
2. **Data-Identity Lead:** two items. The enrich phase1 freeze (100 attempted, 0 progressed; `EXC-S-8D9277CA552E`), and no Phase 2+3 GLEIF calls in the 3 days before M4.
3. Close the two bootstrap `job_missed` cases with a note pointing to `e93d71e`.
4. **CR-10 steps 3–5** need their own sign-offs.
5. A registry-sync diff may flag the new `observed_since` key. Expected, but registry-sync's owner should note it.
6. The `011` outbox test failure was there before this packet.
7. **CR-11 (FIRDS)** is open.
8. This report is not committed (left for the Main Lane, as with other packet reports).
