# MA-OCT-002b.BUILD — Report (LANE-8-ENG, Engineering Lead)

**Opening checks (06:54Z Fri 30):**
- Control `29321318…092b5a` and Task `5eaa6578…c786`: both re-hashed, and both match the board row (line 92).
- Spec `claude/MA-OCT-002_Spec.md` `9ec6773a…3893` ✓; FREEZES `4d8202bb…d7fc` ✓.
- No `.git/*.lock`. `wrangler whoami` ✓ (4.96.0).
- **Worktree:** `~/MeridianAtlas-work/ma-oct-002b/build-worktree`, detached at `origin/October-2026` `1a59b77`.
- **Local only:** no deploy, no D1 write, no commit today (Control). D1 and Cloudflare analytics are read-only.

## Change log (UTC)
- No production change by this lane today.

## Summary: the six 002b items (spec §5.2), all built and tested locally
| # | Item | Status |
|---|---|---|
| **B1** | Effective schedules via the Workers-Read token; drift live; direct trigger listing | **Built** (Ops only). Needs the **Founder token** (below) |
| **B2** | Worker heartbeats: holdings, seed, enrich phase1 / phase23, bootstrap | **Built**, inert until each Worker's secret is put. Needs the 1042 test, B-2 measurement and sign-offs |
| **B3** | ETF (b) per-ETF write cost, (c) full pass-cycle metric | **Built**: Worker payload + sweep side |
| **B4** | KI 22.14 (enrich budget → analytics); FIRDS 10000 count | **Built** + **reported**: FIRDS failed both post-pin Sundays, so **CR-11 is triggered** |
| **B5** | KI 22.39 migration | **Built**: CR-10 steps 1–2 (table + dual-write). Steps 3–5 are later releases |
| **B6** | financialfact-backfill registry `held` | **Already delivered**: registry `local.financialfact-backfill` status `held` (read 06:58Z) |

Also already delivered by earlier work, and **not rebuilt**:
- the intended-only drift flags `numeric_dow` / `dst_shift` (002a `lateness.js`);
- ETF (a) Sunday baseline / 75k warning (002a sweep);
- **(d) direct trigger listing**, which B1 now provides (`effective_schedule`).

## B1: effective schedules and drift (`App/Ops/src/schedules.js`, new, 149 lines)
**Fetch:**
- `GET /accounts/{CF_ACCOUNT_TAG}/workers/scripts/{name}/schedules` with the new secret **`CF_WORKERS_READ_TOKEN`**.
- 6 Workers (R-4): holdings, seed, enrich, bootstrap, **delta, figi** (so `unexpected_trigger` is detectable).
- Runs on the **first sweep of the UTC day only** (003's `firstSweepToday`): **≤ 6 subrequests a day, 0 extra D1 reads** (the sweep already holds the registry).

**Writes:**
- `effective_schedule` is written **only on change**: a guarded UPDATE plus an `ops_control` / `registry_updated` audit row (the registry-sync convention).
- Each Worker API error fails soft for that Worker only.

**Drift:**
- Compared per Worker after normalising names to Cloudflare numbers (1 = Sunday). Enrich's two jobs share one Worker.
- Types: `expr_mismatch`, `missing_trigger`, `unexpected_trigger` (including `held` jobs), `not_deployed`.
- Raised as **`schedule_drift`** with a stable dedupe key, so one mismatch gives one case.
- Shown in the **existing `drift` array of `GET /api/ops/admin/jobs`** (from the stored value, 0 reads).
- Switches: `OPS_SCHEDULES_ENABLED="false"`; no token → `skipped:"no_token"`.

**Test** `App/Ops/tests/schedules-contract.mjs`: **24/24**, on the real ops-api plus the 12 Oct registry load and a fake Cloudflare API.
- T-D1 (`0 4 * * 1` resolves to Sunday, `numeric_dow`) and T-D2 (`dst_shift` from 25 Oct) both pass.
- **AC-b1:** a deliberate mismatch raises **one** `schedule_drift` case (seed, sev2), and the next day it is still one.
- Write-only-on-change, ≤ 6 calls, the 404 → `not_deployed`, the no-token and disabled paths all pass.
- **Mutation:** Sunday mapped to 0 (cron-standard, the KI 22.1 bug) → norm and T-D1 fail.

## B2: Worker heartbeats (`ops-heartbeat.js`, one identical copy each in `App/ETF Refresh/src` and `App/Corporate Atlas/src`; no cross-domain import)
**Helper:** 001 §7.5. `ctx.waitUntil` only, a 2 s `AbortSignal.timeout`, **0 retries, no outbox**, never rejects into the job.
- **Inert (0 subrequests)** until `OPS_INGEST_URL` + `OPS_EMITTER` (vars, added to each toml) **and** the secret `OPS_INGEST_KEY` exist.
- `OPS_HEARTBEATS_ENABLED="false"` turns it off again.
- Called from `scheduled()` only, with trigger `cron:<expr>`. Never from `/run`, so boost-driven enrich calls are not double-reported.

| Worker / job | Events | Subrequests | Payload |
|---|---|---|---|
| `meridian-holdings` | **end-only by default** (start only with `OPS_HEARTBEAT_START="true"`, after B-2) | 1, + 1 D1 counter read only when on | `rows_written`, cursor `etf_offset` before → after (`complete:<total>` on a pass end), `items_attempted` / `items_progressed`, `detail.per_etf` ×≤ 20, `detail.next` (next 20 tickers), `detail.metrics.writes_today_after`; `skipped` hold / budget |
| `meridian-entities-seed` | start + end | 2 | steps completed of 4; `partial` when the write cap stops it; `skipped` hold / budget |
| `…enrich.phase1` | start + end | 2 (0 GLEIF) | ISINs populated; `skipped(empty_input)` |
| `…enrich.phase23` | **end-only**; `SUBREQUEST_CHECKPOINT` **44 → 43** | 1, reserved | GLEIF counters in `detail.metrics` (phase2 matched / subrequests, phase3 processed / deferred / subrequests, total) |
| `meridian-bootstrap` | **end-only by default** (as holdings) | 1 | weekly sync: series considered (≤ `BATCH_SIZE`), added, `tickers_resolved`; `skipped(empty_input)` only with no new series **and** no `NOTICKER_` row; `failed` on a discovery error |

- **Return values:** the run functions now return what they did (holdings summary, seed steps, Phase 1 counts, weekly-sync summary). **No other behaviour changed.**
- **Phase23 deviation:** **no `items_attempted` / `items_progressed`**. Phase 3 counts attempts, not progress, and 003's E1 (attempted > 0, progressed = 0) must not read attempts as progress. **For the Data-Identity Lead:** the 006 §8.2 key set (§12 sign-off).
- **Test** `App/Ops/tests/heartbeats-contract.mjs`: **33/33**.
  - **Every event shape from the four Workers is POSTed to the real `meridian-ops` ingest route and accepted (201)**, and stored in `ops_job_run`: end-only holdings with 20 `per_etf` + `next` in ≤ 2 KB, seed start + end, phase1, end-only phase23, bootstrap success / skipped / failed.
  - A wrong emitter gets 403. The helper rules hold.
  - Static: every heartbeat is in `scheduled()` and none is in `fetch()`; checkpoint 43; holdings and bootstrap are end-only by default.
- **Dry-run builds:** holdings 20.4 KiB, bootstrap 13.2 KiB, seed 16.8 KiB, enrich 19.9 KiB, with the new vars bound.

## B3: ETF items (b) and (c)
- **Worker side:** in the B2 holdings payload above.
- **Sweep side:** `App/Ops/src/etf-cycle.js` (new, 43 lines). **One bounded read:** holdings' last 20 end events, `idx_ops_job_run_job_at`, ≤ 20 rows, only once holdings has an emitter. It adds **`etf.cycle`** to the sweep response:
  - `last_complete_at`, `weeks_since_complete`;
  - `frozen`: the latest non-skipped run did not move the offset;
  - `predicted_next_batch`: Σ the last observed cost of each of the next 20 tickers, with unseen ones at the mean; `predicted_unknown`; `headroom_after`.
  - It raises **`budget_risk` sev3** when the prediction leaves **< 5,000 under the 80k guard**. That is this lane's reading of §9's "prediction + baseline headroom < 5,000"; **ETF PL to confirm.**
- **Tests** (in `heartbeats-contract`):
  - **AC-b3:** a synthetic 20 × 3,800 = 76,000 warns, 60,000 doesn't;
  - last complete 9 Aug → 12 weeks;
  - frozen detection;
  - computed on the events stored through real ingest.
- The 75k Sunday warning (002a) is unchanged and already covered by `sweep-contract`.

## B4: KI 22.14 and FIRDS
- **KI 22.14:** `entities-enrich.js` `checkWriteBudget(env, { analytics })`.
  - In **Phase 1 only** (0 GLEIF subrequests, room for 1 fetch) it reads `meridian-ops` `GET /api/ops/cf/d1-today` (new var `OPS_D1_TODAY_URL`), the real account total from every writer.
  - It compares that against the **F-5 ceiling of 60,000** (ML-1012-1: lag 25–30 min), with the same 5,000 headroom.
  - **Fallback:** the old counter, on any failure.
  - It adds **no** writer to the ETF-domain counter.
  - **Phase 2+3 keeps the counter:** another fetch would eat its 4-subrequest margin, which needs a **Data-Identity Lead ruling**. That fetch is also an RQ-2 case.
- **FIRDS 10000 count (AC-b4):** the pin landed Wed 14 Oct (`3960aee`).
  - **Both post-pin Sundays, 18 Oct and 25 Oct, failed** at the first `wrangler d1 execute` (`SELECT COUNT(*) FROM firds_instrument_reference`), with the pinned `node_modules/.bin/wrangler` (4.96.0). Before the pin it was 3 of 6 in September.
  - **The error code was never recorded:** the runner logs only "Command failed", so 10000 versus another cause can't be shown.
  - **Since > 0 failed, AC-b4's rule applies: moving FIRDS off wrangler gets its own CR (CR-11). This lane recommends opening it.**
- **Code to classify future failures:** `firds-local-seed.mjs` `wranglerCause()` appends `cause: codes=<…> message="…"` from wrangler's own stdout/stderr (32-hex ids redacted).
  - **Test** `App/Corporate Atlas/tests/firds-wrangler-cause.test.mjs`: **4/4**. It extracts the function from source, **because importing the runner runs `main()`** (see the incident below).
  - Sun 1 Nov is in the A2 freeze, so FIRDS's next fire will show the cause only if this lands first. It won't, so the cause appears from Sun 8 Nov.

## B5: KI 22.39 (CR-10 steps 1–2)
- **Migration** `App/Corporate Atlas/migrations/009-entity-pipeline-state.sql`: `entity_pipeline_state (key PK, value NOT NULL, updated_at)`, additive and idempotent, ≈ 2 writes, Entities domain.
- **Dual-write (step 2):** `entities-delta.js` writes every `delta_inactive_<LEI>` to **both** tables in the same batch. Delta is `held` with no trigger, so this has 0 runtime effect today.
- **Enrich's 4 run facts** (`enrich_phase3_last_run_*`, `enrich_combined_*`) belong in `ops_job_run` (§14 table). B2's phase23 end event now carries them, and that is their dual-write for this release.
- **Seed and figi** write only the shared `writes_today_*` counter, which stays (§14).
- **Test** `entity-pipeline-state.test.mjs`: **4/4**.
- **Later releases (not today):**
  - step 3: readers switch. The one code reader is `App/Corporate Atlas/entities-enrich-boost-run.mjs` (enrich run facts); the 006/011 query packs and Ops reads too;
  - step 4: stop the `holdings_pipeline_state` writes;
  - step 5: the ETF PL's guarded `DELETE` of the listed keys.

## B-2 measurement support (no new route)
- The existing public `GET /api/ops/cf/invocations` gains an **opt-in** `?subrequests=1`, which adds a second query: per-minute `sum { requests subrequests }`.
- `meridian-bootstrap` is added to its tracked scripts.
- **Fail-soft:** a GraphQL schema error comes back as `subrequests.error` and the base response is unchanged. Field name not verified live; the test fakes it.
- **Test** `invocations-subrequests.mjs`: **4/4**.
- **Why:** this lane cannot read the analytics token (ML-1024-1), and today's public route has no subrequest field, so **B-2 could not be measured today**. It is run-sheet step M2.

## Endpoint fit (`meridian-ops` 15/15 once 005 deploys)
**002b adds no route to `meridian-ops`:**

| Item | Where it lives |
|---|---|
| B1 | the existing `/api/ops/admin/jobs` `drift` array + the sweep response (`schedules`) |
| B2 | the existing `POST /api/ops/ingest/run-event` |
| B3 | the sweep response (`etf.cycle`) |
| B4 | the existing public `GET /api/ops/cf/d1-today` |
| B-2 | an opt-in parameter on the existing `/api/ops/cf/invocations` |

- **Static test:** `schedules-contract` asserts there is no new path literal.
- **Size:** `ops-api.js` **1045 lines** (001 rule ≈ 1,500), plus the new modules `schedules.js` 149 and `etf-cycle.js` 43.
- **005 overlap:** 005 also changes `ops-api.js` (the console route). **This lane rebases its `ops-api.js` hunks onto 005's commit before deploy** (the 003 / A6 pattern). The hooks are small:
  - 2 imports;
  - the `withLateness` `reg` argument;
  - one block after the 003 daily checks;
  - the `etf.cycle` block;
  - the invocations block.

## Suite on the 002b tree (all green)
| Test | Result |
|---|---|
| `schedules-contract` | 24/24 |
| `heartbeats-contract` | 33/33 |
| `invocations-subrequests` | 4/4 |
| `sweep-contract` | ✓ |
| `sweep-ext-contract` | 34/34 |
| `cases-contract` | 66/66 |
| `migration-m1` | 29/29 |
| A6 `control-split` | 100/100 |
| `admin-jobs-lateness` | ✓ |
| `health-check` | ✓ |
| `lateness` | ✓ |
| `boost-heartbeat-resilience` | ✓ |
| `firds-wrangler-cause` | 4/4 |
| `entity-pipeline-state` | 4/4 |
| ETF `ops-health` | 26/26 |
| `entities-api-retirement` | 77/77 |
| `nav-007-worker` | 58/58 |
| `nav-007-key` | 34/34 |
| `nav-007-frontend` | 39/39 |
| `ingest-contract` | not run (ML-1021-3) |

- **`gleif-reconcile-011.test`: 41 pass / 1 fail**, "heartbeats through the real 002 outbox … 5xx spooled then replayed". This is **pre-existing**: the identical failure occurs on a clean tree at `71fab4b` with none of this build. **For 011's owner (LANE-11).**
- **`meridian-ops` dry-run build:** 97.18 KiB.

## Incident (14:28Z, local only, no effect)
- **What happened:** while checking `firds-local-seed.mjs`, this lane ran `node -e "import('./firds-local-seed.mjs')"` in the worktree. The runner calls `main()` at import.
- **Why nothing ran:** the worktree has no `node_modules`, so the first D1 call threw "pinned wrangler not found" **before any network or D1 activity**. No ESMA fetch and no Cloudflare call happened.
- **Clean-up:** the one stray worktree log line was deleted, and no process remains.
- **Fix:** the new test reads the function from source and never imports the runner. **Note for whoever tests it next:** the runner should guard `main()` with a `process.argv[1]` check. Not changed here (Data-Identity Lead's script).

## Founder action (one): create the read-only Workers token for B1
**Steps:** never paste the value in chat.
1. Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**.
2. Name: `meridian-ops workers read`. Permissions: **Account → Workers Scripts → Read** (only this). Account Resources: **Include → the account whose id starts `ea360704…`** (the one `wrangler-holdings.toml` names). No zone resources. Optionally set an expiry date and record it in the report.
3. **Continue → Create Token**, then copy the token once.
4. In your own Terminal, in `App/Ops` of the repo, run `/usr/local/bin/wrangler secret put CF_WORKERS_READ_TOKEN --config wrangler-ops.toml` and paste at the prompt. This is a `meridian-ops` version change, so do it **inside its run-sheet slot (M5)**, not ad hoc. If preferred, the lane runs the command and you paste at the prompt.
5. Tell the lane "token put". The lane checks the secret's **name** with `wrangler secret list`, never its value.

**Sign-offs needed before the matching run-sheet steps (§12):**
- **ETF PL:** holdings and bootstrap heartbeats, and the B3 warning reading.
- **Data-Identity Lead:** seed and enrich heartbeats, the checkpoint 43, the phase23 key set, Phase 1's analytics budget source, and 009 + the delta dual-write.
- **Main Lane:** RQ-2 for Phase 2+3, and opening CR-11.

## Three-point check
| Item | Plan | Single execution | Budget |
|---|---|---|---|
| B1 | 0 extra reads (registry already read by the sweep); UPDATE by PK `job_id`; INSERT OR IGNORE on the `idempotency_key` UNIQUE | ≤ 6 subrequests + ≤ 14 statements, once a day | **One-time:** 7 jobs × (UPDATE + audit) ≈ 14 rows ≈ **≈ 40 writes**. **Then:** ≈ 0/day |
| B2 | existing ingest Q1 PK + INSERT OR IGNORE `ops_job_run` | 1 row per event | holdings 1/wk, seed 2/wk, phase1 2/day, phase23 1/day, bootstrap 6/day → **≈ 9 events/day ≈ 30–40 writes/day** (001 cap 1,000 events) |
| B3 | `SEARCH idx_ops_job_run_job_at (job_id=?)` LIMIT 20 | ≤ 20 rows | ≤ 80 reads/day, 0 writes |
| B4 | 1 public GET (no D1) in Phase 1 | — | 0 writes |
| B5 | `CREATE TABLE IF NOT EXISTS` | — | ≈ 2 writes; delta dual-write 0 today (held) |
| Setup | registry emitter UPDATE ×5 (by PK, guarded) + audit ×5 | 10 statements, one batch | **≈ 30 writes** once |

- **Boundaries:** Ops writes only Ops tables. The B5 table is Entities (Data-Identity Lead). Ops reads no ETF table beyond 002a's point lookups.
- **No cron is added:** the cron count stays 5/5. B1 reads triggers; it never sets them.

## Deploy run sheet: **Mon 2 Nov, after 08:00Z and after 013's last step**, one change at a time
**Constraints:**
- **Not Sat 31:** 002b touches Entities Workers (seed, enrich, delta, the 009 table), and the A2 window (Sat 07:10Z → Sun 00:10Z) freezes other Entities writers. A2 also reports through `meridian-ops` ingest, so no `meridian-ops` change is made during A2.
- **Freezes Mon:** boost bands 11:45–12:15 and 17:45–18:15 (GMT); 23:50–00:10; sweeps at 08:00, 12:00, 18:00 and 22:00 ±2 min.
- **Every step:** announce "starting <change>" with UTC time in the report log; check the other Mon lanes' reports for an open change; `d1-today` before every write (F-5); record C1 deployed = repo and the previous version id before every deploy.

| # | Step | Who | Writes | Check | Rollback |
|---|---|---|---|---|---|
| M0 | Rebase the `ops-api.js` hunks onto 005's commit in this worktree; full suite; **commit** (list below; LANE-8-ENG by explicit path if ML-1028-1 is extended, else LANE-1-ENG) | LANE-8-ENG | 0 | suite green | drop the rebase |
| M1 | Generate 4 ingest keys (`holdings-cf`, `bootstrap-cf`, `entities-seed-cf`, `entities-enrich-cf`) into `~/.meridian-secrets/ops-ingest-<emitter>.key` (mode 600, never printed) | LANE-8-ENG | 0 | files exist, mode 600 | delete files |
| M2 | **`meridian-ops` deploy (002b code)** + `OPS_INGEST_KEYS` re-put = the current canonical map + 4 hashes, from stdin (ENG1's K-5 method; names and hash prefixes recorded) | LANE-8-ENG | 0 | C1; the 3 existing emitters still 400 (accepted); `d1-today` 200; anonymous admin → Access; `/cf/invocations?script=meridian-bootstrap&subrequests=1` → B-2 data or `subrequests.error` | `wrangler rollback <previous>` (005's version) |
| M3 | Registry: `emitter_id` for the 5 jobs (guarded UPDATE + audit, one batch) | LANE-8-ENG | ≈ 30 | read-back | UPDATE back to NULL + audit |
| M4 | **B-2 measurement:** `?subrequests=1` for `meridian-holdings` (Sun 1 Nov run) and `meridian-bootstrap` (today's fires) | LANE-8-ENG | 0 | record per-invocation subrequests | — |
| M5 | Founder: `CF_WORKERS_READ_TOKEN` secret (above) | **Founder** | 0 | `secret list` shows the name | `wrangler secret delete` |
| M6 | **1042 test (B2 step 0):** deploy `meridian-bootstrap` (ETF, end-only), then `secret put OPS_INGEST_KEY` from the M1 file. At its next 4-hourly fire (12:00 / 16:00 / 20:00Z) check `ops_job_run` for `cf.meridian-bootstrap` (trigger `cron:0 */4 * * *`). **If refused (1042):** set `global_fetch_strictly_public` on the emitter and redeploy; if that fails, stop (option B, its own CR) | LANE-8-ENG; **ETF PL** sign-off | ≈ 4 per fire | event row present | `wrangler secret delete OPS_INGEST_KEY` (inert) or rollback |
| M7 | Entities migration `009-entity-pipeline-state.sql` | LANE-8-ENG; **Data-Identity Lead** | ≈ 2 | `sqlite_master` | leave (additive) |
| M8 | Deploy `meridian-entities-enrich` + `OPS_INGEST_KEY`. **Not 05:50–07:10.** First fire Tue 3 06:00 / 06:50Z | LANE-8-ENG; **Data-Identity Lead** | 0 now | Tue 3: phase1 start + end, phase23 end-only, Phase 1 log "analytics" | rollback |
| M9 | Deploy `meridian-entities-seed` + key (first fire Mon 9 Nov 04:00Z) and `meridian-entities-delta` (held: dual-write code only, no key) | LANE-8-ENG; **Data-Identity Lead** | 0 | C1 | rollback |
| M10 | Deploy `meridian-holdings` + key. **Not Sat 22:00 – Sun 08:00.** First fire Sun 8 Nov 04:00Z; `OPS_HEARTBEAT_START` stays unset until M4 shows room | LANE-8-ENG; **ETF PL** | 0 now | Sun 8: end event with `per_etf` / `next` | rollback |
| M11 | Observe the **Tue 3 08:00Z sweep** (first of the UTC day): `schedules.checked = 6` (or `skipped:"no_token"` if M5 is pending), `effective_schedule` written ≤ 7 jobs, **0 `schedule_drift`** expected (live crons = intended, read 23 Oct), `etf.cycle` null until holdings' first event | LANE-8-ENG | ≈ 40 once | response logged in full (`f444ce7` runner) | `OPS_SCHEDULES_ENABLED="false"` + deploy |

- **Totals Mon 2:**
  - `meridian-ops` 1 deploy + 1 secret re-put;
  - 4 Worker deploys (bootstrap, enrich, seed with delta, holdings);
  - D1 ≈ 35 writes, + ≈ 40 on Tue 3's first sweep.
- **Option C:** Mon 2 is the last production-change day before go-live. If the Main Lane prefers fewer Mon changes, **M0–M5 + M11 (Ops only) can go alone**, with the Worker heartbeats M6–M10 after go-live (Wed 4 or later). B1 and B3 work without them (B3 waits for holdings' events).
- **Rollback order:** reverse dependency: M10 → M6 Worker rollbacks (or delete each `OPS_INGEST_KEY`, which makes them inert); M3 registry back; M2 `meridian-ops` rollback. 009 stays.

## Commit list (none today, per the Control; worktree at `1a59b77`, uncommitted)
1. **002b Ops:**
   - `App/Ops/src/schedules.js` `4507715a80d93fb5…`
   - `App/Ops/src/etf-cycle.js` `098ff71285f5c0db…`
   - `App/Ops/src/ops-api.js` `5b795202e1c773ba…`
   - `App/Ops/tests/schedules-contract.mjs`, `heartbeats-contract.mjs`, `invocations-subrequests.mjs`
2. **002b ETF:**
   - `App/ETF Refresh/src/ops-heartbeat.js` `9ba08d1d2c778006…`
   - `App/ETF Refresh/src/holdings-pipeline.js` `9d0983c1e5b3c519…`
   - `App/ETF Refresh/src/bootstrap.js` `09f4428c6b4346b5…`
   - `App/ETF Refresh/wrangler-holdings.toml`, `wrangler-bootstrap.toml`
3. **002b Entities:**
   - `App/Corporate Atlas/src/ops-heartbeat.js` (identical to the ETF copy)
   - `src/entities-seed.js` `1b199fbf111cd980…`
   - `src/entities-enrich.js` `889a389416bf5b23…`
   - `src/entities-delta.js` `de13181864a041b5…`
   - `wrangler-entities-seed.toml`, `wrangler-entities-enrich.toml`
   - `migrations/009-entity-pipeline-state.sql` `f6de2cfca1b3ed08…`
   - `firds-local-seed.mjs` `9e8ac430cd76e0ab…`
   - `tests/entity-pipeline-state.test.mjs`, `tests/firds-wrangler-cause.test.mjs`

## Close-out
**Today (local only):** 0 deploys, 0 D1 writes, 0 commits.
- **D1 reads:** the registry (51 rows) and 2 public analytics GETs.

**Open items for others:**
1. **Founder:** the B1 token.
2. **ETF PL and Data-Identity Lead:** their §12 sign-offs, including the phase23 key set and the B3 warning reading.
3. **Main Lane:**
   - the Mon 2 slot and its size;
   - CR-11 (FIRDS off wrangler);
   - RQ-2 for enrich Phase 2+3.
4. **LANE-11:** the pre-existing 011 outbox test failure.
5. **Data-Identity Lead:** a `main()` guard for `firds-local-seed.mjs`.
