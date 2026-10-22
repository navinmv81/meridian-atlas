# MA-OCT-002a: Build Report (LANE-1-ENG, Engineering Lead)

**Control:** v1, `claude/packets/MA-OCT-002a_Control_v1.md`, SHA-256 `fe9ed369e771882b238b1f41adf601288778bb72350e1ebf3871475bec78c32a`
**Task:** v1, `claude/packets/MA-OCT-002a_Task_v1.md`, SHA-256 `10ff165a07f37441c1d4bb9db9acb782208d1fa68cd62124cb65a9941364aa5d`
**Spec:** `claude/MA-OCT-002_Spec.md` rev 1.3, SHA-256 `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893`

---

## Day Sun 11 Oct 2026

**Workers Scripts read: YES.** `/usr/local/bin/wrangler whoami` (4.96.0, OAuth, account `ea36070477560935a68ad9110a2fd40b`) lists `workers_scripts (write)`, which includes read. So C1 ran today, and no Founder Workers-Read token is needed for C1.

### Preflight

| Check | Result |
|---|---|
| Control / Task / spec hashes | All match: Control `fe9ed369…c32a` (= STATUS_BOARD row), Task `10ff165a…aa5d`, spec `9ec6773a…3893` |
| Start Approval | Board state READY → EXECUTING on the Founder's Start Approval. The Founder's instruction "execute today's (Sun 11) row" (07:13 UTC) is taken as that approval. `MA-OCT-002a_Status.json` is left for the Main Lane to update. |
| Git | `October-2026` @ `16918e0` = origin; no `.git/*.lock` |
| Time | 07:13 UTC Sun, after the Sun 04:00–07:05 freeze |
| `d1-today` (first action) | **07:13:47Z: `rowsWritten` 80,697 (80.7% of 100k)**, rowsRead 83,771. At 07:28:38Z: unchanged (80,697). |

### 1. C1: deployed = repo, read-only (§10.1 C1, §10.2)

**Method:**
- Downloaded each deployed script through the Cloudflare script-content API (`GET /accounts/{id}/workers/scripts/{name}/content/v2`). The call was authenticated with wrangler 4.96.0's own OAuth session token, read from wrangler's config and never printed or stored.
- Diffed each against `/usr/local/bin/wrangler deploy --dry-run --outdir` bundles of HEAD `16918e0`, built before any edit.

| Worker | Deployed version (100%) | Deployed bundle SHA-256 | HEAD bundle SHA-256 | Result |
|---|---|---|---|---|
| `meridian-entities-delta` | `7d316b5e-b94b-4dc8-b0f7-34780940f01f` (16 Aug) | `96e33071704e0b669b5bfc7574ddae515a39f3c55d1601989ea8a1a68fbd23ab` | `e937a746203964fd5ead14a8da3d2706027c7b2b6e2f9645de2b0d4de0ee3f09` | ✅ **PASS.** Exactly 1 changed line: `detail.relationships` → `detail.data?.relationships`, the ACKed `1b6a7a3` hunk; its comment lines are stripped by the bundler. `b238e36` (`normalizeName` import) is already in the deployed bundle. |
| `meridian-entities-seed` | `82de8589-6765-4e2f-a6d1-d854e285d12d` (24 Sep) | `33ae43bfdd1797dbf27926bade1051acb3b409d301c299d9175de034a7134049` | identical | ✅ **PASS**, byte-identical |
| `meridian-entities-figi` | `ae7fd10d-b519-43d5-ba8f-13d9e1de7376` (16 Aug) | `930a339075dc8f097cc0217d16e17974ad35d0886304cb72ac270be929c2ba7d` | identical | ✅ **PASS**, byte-identical (so `normalizeName` matches) |
| `meridian-bootstrap` | `4cdf40f3-e8fe-4ad9-9b8b-6b6c4196e6f1` (14 Jun) | `4262e6b4d3cbdfca445336d5567d956f346b4b6be111978504ea0fec6334e230` | identical | ✅ **PASS**, byte-identical |

**C1 passes for all four Workers, so no STOP.** Monday's A5 deploys may proceed (L6-2).

### 2. A5 code: local only (CR-6, CR-7, CR-7b)

**Changes (gate only, C3):**
- **`entities-delta.js`, `entities-seed.js`, `entities-figi.js`:** each gets a vendored `checkRunAuth()`. It checks `Authorization: Bearer <RUN_AUTH_SECRET>` **first**, before hold, budget and any D1 read, fails closed when the binding is missing, and compares SHA-256 digests in constant time. Otherwise the route returns 401. Figi gates `/run` **and** `/rematch`.
- **No other changes:** `scheduled()`, cron, hold/budget logic, batch sizes and SQL are untouched.
- **`bootstrap.js`:** the unauthenticated `/trigger` branch is removed, and every path returns 404 (§10: "every path returns 404"; the old `/` 200 body is gone too). The cron path (`scheduled` → `runBootstrap` → `runWeeklySync`) is untouched.

**C3 check:** the new dry-run bundles differ from the deployed scripts only by the gate (+23 lines in seed, figi and delta) plus delta's ACKed hunk, and for bootstrap only by the `fetch` body (−8/+5). Seed's gate is tree-shaken out of the delta and figi bundles, which carry their own.

**Local tests** (`wrangler dev --local`, throwaway secrets generated in memory; never production):

| Worker / route | No header | Wrong bearer | Non-bearer scheme | Correct secret | Binding missing + token | Other path |
|---|---|---|---|---|---|---|
| delta `/run` | 401 | 401 | 401 | 200 (gate passed) | 401 | 404 |
| seed `/run` | 401 | 401 | 401 | passes the gate, then reaches `checkHold` (500 only because the empty local D1 has no `holdings_pipeline_state`) | 401 | 404 |
| figi `/run` | 401 | 401 | 401 | same as seed (`checkHold`) | 401 | 404 |
| figi `/rematch` | 401 | 401 | 401 | same as seed (`checkHold`) | 401 | 404 |
| bootstrap | GET `/trigger` 404 · POST `/trigger` 404 · `/` 404 | | | | | |

The order **gate → hold → budget** is proven by the authorised call's stack trace (`checkHold` at `entities-seed.js:519`, `entities-figi.js:434`).

### 3. A4 code: built beside the live runner, which is NOT modified (CR-5, §8)

**The live boost runner and its plist are untouched:** `entities-enrich-boost-run.mjs` = HEAD, and no install script was run. New files go live on Wed 14 by swap:

| File | What it does |
|---|---|
| `App/Corporate Atlas/lib/ops-outbox.mjs` (157 lines) | R-5 module, `createOpsOutbox({outboxDir, name, cfg, log})` → `send(evt)`, `spool(evt)`, `replay({max, ceilingMs})`. Spool on timeout, network error or 5xx; not on 400/401/403/422/202. Replay oldest first, max 10, 2 s each, stop at the first failure, atomic rewrite (temp + rename). More than 6 days old → `expired.jsonl`, counted and logged. HTTP via `node:http(s)` with `req.destroy()` at the ceiling (no lingering socket). Usable by 011's runner. |
| `App/Corporate Atlas/entities-enrich-boost-run.next.mjs` (276 lines) | Pause check first, with no network when paused. An out-of-window fire → run-log `skipped_out_of_window \| utc_minute=<n> in_window=false`, `skipped`/`out_of_window`, **no `/run`**, no `d1-today`, exit 0. Headroom from `GET /api/ops/cf/d1-today` (2 s ceiling, one retry after 2 s) with `REQUIRED_HEADROOM` 5,000; `headroom_80k` is logged and never blocks. If unreachable or not `ok`: run-log `error`, `failed`/`headroom_unavailable`, no `/run`, exit 1. **No wrangler, npx or child_process.** `trigger` comes from `OPS_TRIGGER`. Outbox replay runs after the run-log line and its own terminal heartbeat. |
| `scripts/entities-enrich-boost-install.next.sh` | Adds `OPS_TRIGGER=launchd` to the plist's `EnvironmentVariables` and checks that `lib/ops-outbox.mjs` exists. Otherwise identical. |
| `package.json.next`, `package-lock.json.next` | `"wrangler": "4.96.0"` (exact) in `devDependencies`. The lockfile was generated with `npm install --package-lock-only` in a scratch copy and resolves wrangler 4.96.0. **Nothing was installed in the live folder:** no `node_modules/.bin/wrangler`, so what `npx` resolves for the two live runners is unchanged today. |
| `firds-local-seed.next.mjs` | Calls `node_modules/.bin/wrangler` by absolute path (fails clearly if it's missing); `npx` is removed. |
| `scripts/firds-seed-install.next.sh`, `scripts/firds-seed-status.next.sh` | Print the pinned and installed wrangler versions, and refuse (install: exit 1; status: non-zero exit) on a mismatch or a missing binary. Verified: today's `status.next` reports `pinned <none> / installed <missing> → mismatch`, as expected before the swap. |

**In-lane ruling A4-R1 (reported for review):** a run replays the outbox **only if its own terminal event was delivered**, and spools its own undelivered events **after** that replay.
- This way a run never replays its own just-spooled events; §8.1 says replay happens on the *next* run.
- It also avoids spending up to 10 × 2 s replaying into an outage the run has just observed.
- Wall-time bound: a failed run adds at most 2 s, and a delivered run adds at most 2 s plus the replay.
- It does not affect DI conditions (1)–(3) or idempotency.

**Not taken:** R-3's optional 60 s `d1-today` retry. The spec's one retry after 2 s is implemented; R-3 says "consider", so this is a carry-over question.

**Test:** `App/Ops/tests/boost-heartbeat-resilience.mjs` (extended) → **206 passed, 0 failed** (runner under test: the `.next` file).
- **Runtime matrix:**
  - 6 job paths: fired, skipped_headroom, headroom_unavailable, d1-today not ok, `/run` HTTP 500, out_of_window;
  - each against Ops answering 201, 500, hang, and an unroutable address, compared with a control run with Ops unconfigured;
  - **exit code and run-log line identical in every case;** `/run` called with the same timing (< 250 ms) or not called as required;
  - **largest added wall time 2.03 s;** nothing heartbeat-related on stdout/stderr.
- **Ordering:** the run-log line is written before the terminal heartbeat.
- **Spooling:** undelivered events are spooled; 202, 401 and 422 are not spooled.
- **Replay:** on the next run, with the same `run_id`, after `/run`, after the run-log line and after its own terminal heartbeat. 200 `duplicate` counts as delivered. Max 10 per run; it stops at the first failure.
- **Expiry:** a 7-day-old event goes to `expired.jsonl`.
- **Paused run:** no `/run`, no `d1-today`, no heartbeat, no replay.
- **Outage:** a run that sees one does not replay.
- **Trigger:** `OPS_TRIGGER=launchd` puts `trigger=launchd` on every event.
- **Static checks:** no wrangler or npx in the runner; FIRDS pinned by path; status script prints versions; `package.json.next` pins `4.96.0`.

### 4. A2 code: local only (CR-2, §6.3)

- **`App/Ops/migrations/003-ops-job-pause.sql`:** `ops_job_pause` and `idx_ops_job_pause_job_end`, exactly per §6.3, plus a domain/ownership header.
  - Run with **`--local` only**, twice; the second run is a no-op.
  - `CHECK (ends_at > starts_at)` rejects a reversed window.
  - Local plans: L3 fleet `SCAN ops_job_pause` (declared, bounded); per job `SEARCH ops_job_pause USING INDEX idx_ops_job_pause_job_end (job_id=? AND ends_at>?)`.
- **`App/Ops/src/lateness.js`** (259 lines, pure functions):
  - slot generation for `cf_cron` (Cloudflare semantics: numeric DOW 1 = Sunday, named days, `0` rejected) and `launchd_calendar` (local wall time, DST-correct through `Intl`, optional `weekday`);
  - run grouping and matching (`detail.slot` first, else `[S − 5 min, S + grace]`; `contract-test` never matched);
  - slot states `on_time / late / missed / pending / paused / unobserved`, run states `running / lost / <terminal>`, job state `frozen` (same `cursor_after` ×3, or the F4 signature);
  - intended-only drift flags `numeric_dow` and `dst_shift`.
  - **Not yet wired into `ops-api.js`.** That happens with the Mon 12 deploy, as additive `slots`, `job_state` and `drift` fields on `GET /api/ops/admin/jobs`.
- **`App/Ops/tests/lateness.test.mjs` → 41 passed, 0 failed.**
  - **Recorded boost history** (EXPLAIN pack P4 rows, 2–7 Oct) reproduces §6.3 / AC-a2:
    - **2 Oct 10:50, 4 Oct 16:50, 5 Oct 16:50 and 7 Oct 10:50 = `missed`** (4 before replay; **1 after** simulated replay of the three undelivered failures);
    - **4 and 5 Oct 11:02 = `late` / `success`**; 3 Oct 10:55 = `on_time` / `failed`;
    - contract-test runs are excluded.
  - **Synthetic cases:**
    - a test pause turns 4 Oct 16:50 into `paused`, and the 011 week (17–23 Oct) gives 14 `paused` and 0 `missed`;
    - `held` → `paused`, and a `skipped(pause)` run → `paused`;
    - a job without an emitter → all `unobserved`; pending; running / lost at 120 + 300 s; a manual run outside any slot matches nothing;
    - frozen ×2 plus an ok control;
    - **KI 22.1:** `0 4 * * 1` → Sundays 27 Sep, 4 Oct, 11 Oct, plus `numeric_dow`; `0 4 * * mon` → Mondays;
    - **T-D2 (DST):** boost local 11:50/17:50 → 10:50/16:50 UTC until 24 Oct and 11:50/17:50 UTC from Sun 25 Oct; `dst_shift` raised on 26 Oct and not on 20 Oct;
    - FIRDS Sun 11:00 local → 10:00Z;
    - cost: 49 jobs × 14 days computed in milliseconds.

### D1, Workers and git

| Item | Value |
|---|---|
| **Remote D1** | **0 statements, 0 reads, 0 writes** (Sunday rule: 0 remote writes) |
| Local D1 | 2 migration runs and 3 plan/constraint checks against `.wrangler` local state only |
| Cloudflare API (non-D1) | 4 read-only script-content downloads; 4 `wrangler deployments status` reads; 2 `d1-today` GETs |
| **Worker deploys** | **None.** Live versions unchanged: delta `7d316b5e`, seed `82de8589`, figi `ae7fd10d`, bootstrap `4cdf40f3` (and `meridian-ops` `56c87c9a`). |
| **Commit** | **`8f06ed0`** on `October-2026` (fast-forward from `16918e0`; fetch + `pull --ff-only` + lock check first), pushed. 16 files staged by explicit path, all under `App/`. **No `claude/` files committed** (no Main Lane commit list issued). |
| Key file SHA-256 | `lib/ops-outbox.mjs` `34114ddadb432a992bc4fedf15a7ccb5f1fdbb56b6a0e3e7aea07a9058704278` · `entities-enrich-boost-run.next.mjs` `f4091e6ed140fcaab89162342c140dd3f5bd4e9772b8817558a2df4460c34e52` · `src/lateness.js` `1f194f0415c7b1523383d8db4bb2e8544b81634a58853febd9f33cfa1d376d66` · `migrations/003-ops-job-pause.sql` `6638194f4c66b437dc876a8166edc59075e06c322561249b545b3da5648e6bfb` |
| Secrets | None printed, logged or committed. Pre-commit scan: 0 secret literals in the staged files. Local test secrets were generated in memory and discarded. |

### Deviations, rulings and open items

1. **A4-R1 (in-lane ruling):** replay only after the run's own terminal event is delivered; spool own undelivered events after replay (§3 above). Needs Data-Identity Lead / Operations Lead acknowledgement as part of the CR-5 evidence.
2. **Bootstrap `/`** now returns 404 instead of `200 "Bootstrap Worker"`, following §10's "every path returns 404". The ETF PL should note this at CR-6.
3. **R-3 60 s retry not implemented.** One retry after 2 s, as specified. Question for the Operations Lead: is it wanted before Wed 14?
4. **`d1-today` lag (go-live gate for A4, §8.5):** not measurable today (0 writes). Planned around Mon 12's A1 load: before, +1, +5 and +15 min.
5. **FIRDS pin lands Wed 14** (A-8): swap the `.next` files, run `npm ci` in `App/Corporate Atlas/`, then check that `firds-seed-status.sh` shows `4.96.0 / 4.96.0`. FIRDS runs today (Sun 10:00 UTC) on the unchanged live runner.

### Founder actions needed

- **Mon 12:** none before A5. The per-Worker `RUN_AUTH_SECRET` values are generated and set by this lane with `wrangler secret put`; local copies go in gitignored `.env.entities-{delta,seed,figi}-run`.
- **Tue 13:** about 5 minutes for A3 (Login Items → Allow in the Background for the health-check, and a supervised first run), after ENT-CR1.

### Next (Mon 12, after 08:00 UTC; `d1-today` read before every remote write step)

1. **A5 deploys:** secrets first, then delta, seed and figi deploys and the bootstrap deploy (not within the minute of a 4-h bootstrap fire). Then AC-a5: 401 ×2 per route, `/trigger` 404, and checks that `delta_last_run` is absent and no seed or figi run was recorded.
2. **A2 remote migration, then the A1 registry load** (`registry-sync.mjs` generates the SQL; the Operations Lead reviews it first). Measure `d1-today` lag.
3. Wire lateness into `GET /api/ops/admin/jobs` and deploy `meridian-ops`.

**Stop point reached for Sun 11.** Reply: "MA-OCT-002a day 2026-10-11 reported".

---

## Day Mon 12 Oct 2026

**Started 18:40 UTC** (Founder "continue"), after the Mon 03:30–08:00 seed freeze and outside every `FREEZES.json` window. Git `October-2026` @ `8f06ed0` = origin; no locks. The live versions of all five Workers were re-checked as unchanged since C1 (delta `7d316b5e`, seed `82de8589`, figi `ae7fd10d`, bootstrap `4cdf40f3`, ops `56c87c9a`), so **C1 still holds** for today's deploys.

### Rulings applied first

- **ML-1011-2 (secrets outside the repo and iCloud):**
  - **A5 run secrets:** the three per-Worker `RUN_AUTH_SECRET` values were generated directly into `~/.meridian-secrets/entities-{delta,seed,figi}-run.env` (folder 700, files 600; home dotfolder, not under Desktop/Documents/iCloud Drive). They are 3 distinct values (checked by hash, values never printed) and were piped to `wrangler secret put`. No copy exists in the repo.
  - **A4 bundle:** `entities-enrich-boost-run.next.mjs` and `entities-enrich-boost-install.next.sh` now read the boost's two run secrets (`entities-enrich-run.env`, `ops-ingest.env`) from `MERIDIAN_SECRETS_DIR` (default `~/.meridian-secrets`), not the repo. **Wed 14 go-live adds one step:** move the existing in-repo `App/Corporate Atlas/.env.entities-enrich-run` and `.env.ops-ingest` there (chmod 600). The **live** runner still reads the in-repo files until then; per Task, it isn't modified before Wed 14.
- **ML-1011-3:**
  - (a) the A1 SQL was loaded without a separate Operations Lead review; it is in the commit for close-out review (AC-a1 evidence below);
  - (b) R-3's 60 s `d1-today` retry is not built.

### A5: live (AC-a5)

**Deploys**, from commit `8f06ed0` sources, which equal C1's HEAD plus the gate only (C3 shown Sun 11):

| Worker | New version | Previous (rollback, emergency only) | Cron after deploy |
|---|---|---|---|
| `meridian-entities-seed` | `1cd92fc3-67ec-4991-8291-db7d78a6004e` | `82de8589` | `0 4 * * mon` (unchanged) |
| `meridian-entities-figi` | `5c8c547c-93e7-47cb-a418-b5bad8cef2d2` | `ae7fd10d` | none (unchanged) |
| `meridian-entities-delta` | `b0b774ed-5cdd-4940-aec0-7c2a986015b9` | `7d316b5e` | none: held, commented out (unchanged) |
| `meridian-bootstrap` | `0a968cdc-6474-40d0-adf9-38edd9e5ee0c` | `4cdf40f3` | `0 */4 * * *` (unchanged) |

Deployed 18:42–18:43 UTC, outside C5's windows and well clear of bootstrap's 20:00 fire.

**Production tests (401-only, C4), 18:43 UTC:**

| Route | No secret (GET) | Wrong secret (GET) | No secret (POST) | Wrong secret (POST) |
|---|---|---|---|---|
| delta `/run` | 401 | 401 | 401 | 401 |
| seed `/run` | 401 | 401 | 401 | 401 |
| figi `/run` | 401 | 401 | 401 | 401 |
| figi `/rematch` | 401 | 401 | 401 | 401 |

- **Bootstrap:** GET `/trigger` 404, POST `/trigger` 404, `/` 404.
- **State before and after** (PK reads of `holdings_pipeline_state`):
  - `delta_last_run` **absent** before and after;
  - `writes_today_2026-10-12` **6,366** before and after (no seed or figi write);
  - `hold_all_jobs` false.
- **Bootstrap cron still advances on the new version:** `edgar_bootstrap_state.last_run` went from 2026-10-12T16:00:49Z (before the deploy) to **2026-10-12T20:00:52Z** (PK read at 20:02:30Z, 4 reads), with `status` still `complete`. **AC-a5: PASS**, all items, live before Fri 16 Oct.

### A2 + A1: remote

- **`d1-today` gate** before each write step: 6,745 account writes (+ step ≤ 160) ≤ 70,000 ✅.
- **`003-ops-job-pause.sql`** (18:45 UTC): `ops_job_pause` and `idx_ops_job_pause_job_end` created. 3 row-writes.
- **A1 registry load** (18:45:30–18:45:32 UTC), from the new **`App/Ops/tools/registry-sync.mjs`**:
  - The tool reads the 000 manifest, the toml `[triggers]`, the boost installer's `FIRE_HOURS_UTC` and the installed plists (`plutil`).
  - It diffs against the live registry, read-only with the pinned wrangler 4.96.0.
  - It generated **`App/Ops/migrations/registry-load-2026-10-12.sql`**: 47 `INSERT OR IGNORE`, plus 1 guarded `UPDATE` (the pilot row's `intended_schedule`, previously NULL) with its idempotent `ops_case_event` (`registry_updated`).
  - Ran with `--file`: 49 statements, **146 row-writes**, 17 reads.
- **AC-a1 PASS:**
  - **49 rows:** 2 `held` (`cf.meridian-entities-delta`, `local.financialfact-backfill`), 1 `retired` (`cf.meridian-firds`);
  - `manual.gleif-seed.13f-seed` present;
  - `cf.meridian-entities-enrich.phase1` / `.phase23` present, and no un-phased id;
  - the pilot row kept (emitter `boost-local`);
  - **a second `registry-sync` run reports an empty diff.**
- **Intended schedules (self-check):**
  - holdings `0 4 * * sun`; seed `0 4 * * mon`; enrich `0 6 * * *` / `50 6 * * *`; bootstrap `0 */4 * * *`;
  - boost launchd 11:50/17:50 Europe/London, `utc_targets` 10:50/16:50, `installed_utc_offset` +01:00;
  - FIRDS Sun 11:00 local (dst sev4); health-check daily 18:00 local (A3 changes it); financialfact 09:00 local (held);
  - grace and tolerance values per §6.3; every other job `{"kind":"none"}`.

### A2: lateness on `GET /api/ops/admin/jobs` (`meridian-ops` `b34fa8d8-2430-44be-9756-db71e1394a6c`, deployed 18:48 UTC; previous `56c87c9a`)

- **Additive fields:**
  - per job: `slots` (slot, state, run_id, outcome, reason, started_at), `job_state`, `drift` (intended-only: `numeric_dow`, `dst_shift`) and `run_states`;
  - top level: `lookback_days` (default 7, max 14).
  - Existing keys are unchanged (`runs`, `last_*_at`, `rows_read`).
- **New queries, remote EXPLAIN (18:48 UTC):**
  - L2 `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=? AND started_at>?)` (no temp B-tree);
  - L3 fleet `SCAN ops_job_pause` (declared, bounded); L3 per job `SEARCH ops_job_pause USING INDEX idx_ops_job_pause_job_end (job_id=? AND ends_at>?)`;
  - R1 `SEARCH ops_job_registry USING INDEX sqlite_autoindex_ops_job_registry_1 (job_id=?)`;
  - Q4 unchanged. **No undeclared SCAN.**
- **Post-deploy smoke checks:**
  - the 6 public GETs return 200 with `*` CORS;
  - `admin/jobs` without Access → 302;
  - ingest without a key → 401.
- **`App/Ops/tests/admin-jobs-lateness.test.mjs` → 13/13.**
  - **Setup:** the real `ops-api.js` handler runs in Node on `node:sqlite`, built from the real 002/003 migrations, the real A1 load and the recorded P4 boost runs. The real `verifyAccessJwt` checks a test-signed RS256 JWT. The clock is fixed at 7 Oct 20:00Z.
  - **Auth:** 401 without a JWT.
  - **AC-a2 states:** 4 Oct 16:50 `missed`; 4 and 5 Oct 11:02 `late`; the failed fire shows `failed`; 4 missed; a test pause row turns a slot `paused`.
  - **Fleet:** 49 jobs; jobs without an emitter are `unobserved`, never `missed`; seed Monday 05 Oct, with no `numeric_dow`; `dst_shift` raised for the boost after 25 Oct.
  - The lateness fixture moved to `tests/fixtures/boost-runs-p4-2026-10-07.json`; `lateness.test.mjs` is still 41/41.
- **AC-a2 on production needs the Founder's Access session** (below), including its `rows_read` ≤ 1,000.

### `d1-today` analytics lag (A4 go-live gate, §8.5; R-5 (1); F-4)

Known writes: 3 (migration, 18:45:1x) + 146 (registry load, 18:45:30–32) = 149.

| Sample | UTC | `rowsWritten` |
|---|---|---|
| before | 18:45:30 | 6,745 |
| +0 | 18:45:32 | 6,745 |
| +1 min | 18:46:25 | 6,748 |
| +2 min | 18:47:25 | 6,745 |
| +5 min | 18:50:26 | 6,745 |
| +10 min | 18:55:26 | 6,745 |
| +15 min | 19:00:26 | 6,745 |
| +20 min | 19:05:56 | 6,745 |
| +25 min | 19:10:56 | 6,745 |
| **+30 min** | **19:15:56** | **6,894** (= 6,745 + 149, exact) |

**Result: the `d1-today` analytics lag is 25–30 minutes.** The 149 writes (done by 18:45:32) first appeared between 19:10:56 and 19:15:56, and they appeared complete and exact. The figure is also **not monotonic** while it settles: 6,748 at +1 min, back to 6,745 at +2 min.

**Assessment for the 011 lane** (over 10 minutes, so it goes to 011 before the Fri 16 Oct release check, per §8.5):
- 011's 120 s freshness rule limits the age of the *fetch*. It does not cover the analytics lag, so each `d1-today` reading misses about the last 30 minutes of account writes, including 011's own batches.
- 011 already adds its own un-polled rows (account total + unpolled 011 rows + batch ≤ 70,000; rev 1.6 §4.3). That covers 011's own writes, provided "unpolled" means **every 011 row written in the last ≈ 30 min**, not just since the last fetch.
- Other writers' last-30-minute writes stay invisible. On weekdays outside the enrich windows that's small (hundreds of rows), against the 30k gap between 70k and the 100k cap.
- **Recommendation to 011:** treat 011 rows written in the last 35 minutes as un-polled.

**For the A4 boost pre-flight:** the 5,000 headroom margin, against weekday totals of hundreds to a few thousand rows, absorbs a 30-minute lag. On Sundays (holdings ≈ 70k by about 07:00 UTC), the boost fires at 10:50, well after holdings ends, so the reading is settled by then. **The gate is met: the lag is recorded.**

### D1, Workers and git (Mon 12)

| Item | Value |
|---|---|
| Remote D1 writes | **149** (migration 3 + registry load 146). **Build total to date: 149 / 500.** |
| Remote D1 reads | ≈ 338: point reads 20, AC-a1 checks 98, registry-sync live reads 51, schema check 149, migration 3, load 17. EXPLAINs read 0. **Build total ≈ 338 / 50k.** |
| `d1-today` readings | 18:40Z 6,745 · 18:45:17Z 6,745 · lag table above |
| Worker versions | seed `1cd92fc3`, figi `5c8c547c`, delta `b0b774ed`, bootstrap `0a968cdc`, ops `b34fa8d8` (A-4: one version per item) |
| Commit | **`45cdb9d`** (fast-forward from `8f06ed0`; fetch + `pull --ff-only` + lock check first; 9 files, all under `App/`; secret scan 0), pushed. |
| Key file SHA-256 | `tools/registry-sync.mjs` `fda23091397b9fdf53008e60ddcd5823f8f594b7f42543af77ae8cc40bdd6d30` · `migrations/registry-load-2026-10-12.sql` `872d5d7f2147be57e3695ff487001aa270dad729b24400b33dbaf937ac2faa74` · `src/ops-api.js` `417bf915e81bd3df752f23a13005afc966cd31d4d79726f74f5015e816484063` · `entities-enrich-boost-run.next.mjs` `bde87a7e3bd1f1dd7d59e1db4c7c611cbfae2064ce78f6ff56fd15d52fc9c708` |

### Deviations, rulings and open items

1. **Lateness was wired and `meridian-ops` deployed today** rather than waiting for A3. A2's acceptance (AC-a2) is on this route, and Tue 13 is taken by ENT-CR1 first. It's additive only, with the 001 auth matrix unchanged.
2. **`ops-api.js` is now 1,007 lines** (+ `lateness.js` 259). That is within the 1,500 rule; A-6 estimated about 1,100 after 002a.
3. **The `d1-today` lag is 25–30 minutes**, which is over 10. It goes to the 011 lane with the recommendation above.
4. **ML-1011-2 extends to the boost bundle:** the Wed 14 go-live includes moving two in-repo `.env` files to `~/.meridian-secrets`. This needs Data-Identity Lead awareness as part of CR-5 (the files move; their content doesn't change).

### Founder actions needed

- **AC-a2 on production (about 1 min):** open `https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/jobs?job_id=local.entities-enrich-boost&lookback_days=14` in your browser (Access sign-in), and send the `rows_read` value plus the list of slots marked `missed`.
- **Tue 13:** about 5 minutes for A3 (Allow in the Background + a supervised first run), after ENT-CR1.

**Stop point reached for Mon 12** (20:03 UTC). Reply: "MA-OCT-002a day 2026-10-12 reported". **Next (Tue 13): ENT-CR1 first, under its own Control (08:05–10:30 UTC).** No 002 work before ENT-CR1 is verified; then A3.

---

## Day Tue 13 Oct 2026

**Order kept (RA-7):** MA-OCT-ENT-CR1.EXEC ran first (09:31–09:35 UTC, "ENT-CR1 verified", its own report). 002a work started at 15:32 UTC on the Founder's "continue". Git `October-2026` @ `4bf5530` = origin at start; no locks.

### A3 delivered: alerting sweep + health-check revival (CR-3, CR-4; spec §7)

**Server: `meridian-ops` `0905784d-d46b-4607-b40f-ea89d5d5264d`** (deployed 15:43 UTC; previous `b34fa8d8`)
- **Route:** `POST /api/ops/ingest/sweep`, emitter key `health-check-local` bound to `local.health-check`.
- **Check order:**
  1. `OPS_SWEEP_ENABLED` hard switch (0 reads), then the key, then the registry switches.
  2. Fleet lateness: L2 per emitting job, L3.
  3. `hold_all_jobs`, ETF (a) Sunday writes on Sun/Mon, and (c) `etf_offset`/`last_run_status` (PK reads); headroom via `d1Totals()` (analytics, 1 subrequest).
  4. A dedupe pre-check (unique-index probes).
  5. Raises of **new** findings only: ≤ 20 per call (any excess → one `sweep_overflow`) and `OPS_SWEEP_DAILY_RAISE_CAP` = 100 a day, counted from today's `local.health-check` end events (`detail.metrics.raised`, B-1, 0 extra reads).
  6. Open counts.
- **Raise contract (R-E):** `case_ref = 'EXC-S-' + upper(sha256(dedupe_key)[:12])` with the collision guard; one `ops_case_event` `raised` row per finding (`idempotency_key = 'raised:'||dedupe_key`). The sweep never updates or closes a case.
- **Remote EXPLAIN** (15:42 UTC), all index-backed except the declared bounded `SCAN ops_job_registry`:
  - `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)`;
  - `SEARCH ops_exception USING COVERING INDEX sqlite_autoindex_ops_exception_2 (dedupe_key=?)` (pre-check and audit SELECT);
  - `SEARCH ops_exception USING INDEX sqlite_autoindex_ops_exception_2 (dedupe_key=?)` (collision guard);
  - `SEARCH ops_exception USING COVERING INDEX idx_ops_exception_queue (status=?)` (open counts).
- **`d1-today`:** `cfD1WritesToday()` is refactored onto `d1Totals()`; the response is unchanged.
- **`lateness.js`:** optional `intended_schedule.observed_since`. Slots before it are `unobserved`, so a revived job isn't charged for its dead weeks.
- **`OPS_INGEST_KEYS`:** now holds the `boost-local` and `health-check-local` hashes only. The new key file is `~/.meridian-secrets/health-check-ops-ingest.env` (600; ML-1011-2). Auth was checked with deliberately invalid bodies (both keys → 400, no writes).

**Registry:** `registry-sync` now takes the health-check's schedule from its install script.
- `registry-load-2026-10-13.sql`: 2 guarded UPDATEs on `local.health-check` (`emitter_id = health-check-local`; `intended_schedule` = 08/12/18/22 local Europe/London, tolerance 900 s, grace 8 h, `observed_since` 2026-10-13T16:30Z) plus audit rows.
- Gated by `d1-today` (33,158 at 15:43:48Z, including ENT-CR1's 32,770). **11 row-writes.** Re-run: **empty diff**.

**Local job: revived `13F Seed/check-pipeline-health.js`** (SHA-256 `d2595e2a4efc1ef6469304f71b56ef2365edfdd18864ce108a1760b84c81a181`)
- Pause flag first (no network). Checkpoint **2026-12-31** (Founder Q1); the financialfact-complete condition is removed.
- **One sweep call; no D1 REST reads and no `CF_API_TOKEN`.**
- Own `start` and terminal events as `local.health-check`, with `metrics.raised` and the shared outbox.
- Notifications per §7.4: only on new sev1–sev3, plus an 18:00 line when open sev1/sev2 exist, and "could not reach Ops" on failure.
- Logs go to the gitignored `App/Corporate Atlas/logs/` (`health-check.log`, `health-check-heartbeat.log`, `ops-outbox/health-check.jsonl`, launchd stdout/stderr). The old tracked 13F Seed log files are left untouched.

**Control surface:** `App/Ops/scripts/health-check-{install,pause,resume,status,uninstall}.sh`.
- The install script writes the plist with 4 `StartCalendarInterval` slots (08:00, 12:00, 18:00, 22:00 local), an explicit `PATH`, and `OPS_TRIGGER=launchd`.
- It refuses if the script lacks the 2026-12-31 checkpoint, if the outbox module is missing, or if the key file doesn't name `health-check-local`.

**Tests (local, 0 D1):**

| Test | Result | Covers |
|---|---|---|
| `sweep-contract.mjs` | **23/23** | Real `ops-api.js` on `node:sqlite` with the real migrations and A1 load. 401 (no / wrong key), 403 (another emitter), 202 for each of the 3 switches, **stops at 20 per call with one `sweep_overflow`**, severity-first order, deterministic `EXC-S-` refs, one audit row per raise, `job_missed` key format, ETF (c) figures, analytics headroom, **dedupe: once raised, a further sweep raises 0 new**, `hold_active` sev2 + `budget_risk` sev1 at < 5k headroom, daily cap from L2 (95 already raised → ≤ 5) |
| `health-check.test.mjs` | **15/15** | Real script against a fake Ops: clean = silent; new findings = one notification with counts and titles; 202 → skipped; 500 / unreachable → failed and notified; events spooled, then replayed with the same `run_id`; pause = no network; missing config fails loudly; static checkpoint and no-token checks |
| `lateness.test.mjs` | **42/42** | +1 for `observed_since` |
| `admin-jobs-lateness.test.mjs` | **13/13** | Unchanged |

### Install and first sweeps (production)

| UTC | Step | Result |
|---|---|---|
| 15:54:06 | `App/Ops/scripts/health-check-install.sh` (Founder approved "install") | The old 18:00 agent (self-unloading) was booted out; the new plist linted OK and was loaded with `launchctl bootstrap`. Status: loaded, 4 slots, not paused, config present, checkpoint 2026-12-31 |
| — | Founder step: Allow in the Background | The Founder found **no item named "health-check"**: the list shows **4 "bash" entries, all already enabled**. These agents run `/bin/bash -c "cd … && node …"`, so macOS lists them by executable. No Login Items or permission change was made by this lane. |
| 16:36:25 | Supervised `launchctl kickstart -k gui/<uid>/com.meridianatlas.health-check` (Founder approved "Kickstart") | **runs 1, exit 0** (no EX_CONFIG). No TCC prompt was needed. Sweep in 0.8 s: **raised 6**, findings 6, `rows_read` **88** (≤ 1,000), headroom 66,829, hold false. Heartbeats `start` 201 and `success` 201 (`trigger=launchd`, `metrics.raised=6`); outbox empty. |
| 16:36:26 | Raised cases (all sev3, `raised_via=ingest_auto`, 6 audit rows) | `job_failed` ×3: boost runs `dacfb9cd` (8 Oct 16:56), `9614984b` (9 Oct 16:50), `fded4010` (10 Oct 10:50). `job_missed` ×3: boost slots 7 Oct 10:50Z, 8 Oct 10:50Z, 12 Oct 10:50Z. **All are real** (F6-class failures and undelivered or missed boost fires, the gaps A4's outbox closes from Wed 14). |
| 16:37:17 | `health-check-pause.sh` → status → `health-check-resume.sh` | Pause flag written and shown, then removed. Left **resumed**. |
| **17:00:05** | **Scheduled 18:00 BST slot (launchd, unattended)** | **runs 2, exit 0.** `raised=0`, `already_open=6`, `rows_read` 96, "All clear — no notification sent". Heartbeats 201/201. **The second sweep raised 0 new.** |

**AC-a3 status:**

| Clause | Status |
|---|---|
| Kickstarted once under supervision; logs a sweep with `rows_read` ≤ 1,000 | ✅ (88) |
| Raises one exception per real finding, with a `dedupe_key` | ✅ (6, verified) |
| A second sweep raises 0 new | ✅ (17:00 scheduled run) |
| One notification for the first sweep only | **Pending Founder confirmation** of the 17:36 BST banner. The 18:00 run was silent by its log. |
| Checkpoint 2026-12-31 | ✅ |
| Sweep returns 401 without a key | ✅ (production) |
| 202 with each switch off | ✅ (local test) |
| Stops at 20 raises per call | ✅ (local test) |
| Pause, resume, status work | ✅ (production) |
| Uninstall works | **Not exercised.** It would remove the agent just enabled; same logic as the boost's proven uninstall. |
| The Sunday check reads the 4 or 11 Oct `writes_today` value correctly | Covered by the local test (Mon 19 Oct reads `writes_today_2026-10-18`). The first production evidence is the Mon 19 Oct sweeps, which read `writes_today_2026-10-18`. |

### Findings for the backlog (Founder: "add to backlog for investigation")

1. **`com.meridianatlas.financialfact-backfill` is still loaded and scheduled daily at 09:00 local.** Its last exit is **78: EX_CONFIG** (runs 9). Read-only `launchctl print`, 16:2x UTC.
   - It's kept from running only by whatever causes that EX_CONFIG. The Founder's intent (Founder Q3; registry `held`) is that it stays **off**.
   - If the cause clears (for example, if its "bash" Login Items entry is in fact enabled), it would resume D1 writes outside any CR.
   - Options: unload it (`launchctl bootout gui/<uid>/com.meridianatlas.financialfact-backfill`, keeping the plist) or confirm its Login Items entry.
2. **The EX_CONFIG cause is not "switched off in Allow in the Background".**
   - Spec D1-3's leading hypothesis is not supported: the Founder sees all 4 "bash" entries enabled, and the **revived health-check (same `13F Seed` folder, same label, newly bootstrapped) ran normally (exit 0)**.
   - The old agents' 78s may have come from their stale registrations (old plist/BTM record) rather than the folder. Reinstalling via `bootout` + `bootstrap` cleared it for the health-check.
   - Which "bash" entry is which can be seen with `sudo sfltool dumpbtm` (admin), which this lane did not run.
3. **This lane ran `sfltool dumpbtm` twice at 15:34 UTC** (read-only dump, piped through grep), before the Founder's instruction not to.
   - macOS asked for administrator authorization; it was cancelled, the command returned `authorization failed`, and it produced no data.
   - No Login Items or permission change resulted. It won't be run again (Founder instruction, 13 Oct).

### D1, Workers and git (Tue 13, 002a part)

| Item | Value |
|---|---|
| Remote D1 writes (build) | **11** (registry update). **002a build total: 160 / 500.** |
| Remote D1 reads (build) | ≈ 130: registry-sync live reads 49 × 2 (pre-load and re-run), load 34, EXPLAINs 0, verification reads ≈ 16. **002a build total ≈ 470 / 50k.** |
| Production sweep writes (steady state, not build) | 2 sweeps: 6 raises (≈ 11 each ≈ 66) + 4 run events (≈ 20) ≈ 86 |
| `d1-today` readings | 15:43:48Z 33,158 (includes ENT-CR1's 32,770); first sweep headroom 66,829 → 33,171; second 66,549 → 33,451 |
| Worker versions | `meridian-ops` **`0905784d`** (A3). Rollback note (A-4): rolling back to `b34fa8d8` drops the sweep. A3's own kill switches come first (`OPS_SWEEP_ENABLED=false`, `ingest_enabled=0`, pause flag, uninstall). |
| Commit | **`1b9dbde`** (fast-forward from `4bf5530`; secret scan 0; 14 files under `App/` + `13F Seed/check-pipeline-health.js`), pushed. **No change since** (install is runtime only). |
| Key file SHA-256 | `check-pipeline-health.js` `d2595e2a4efc1ef6469304f71b56ef2365edfdd18864ce108a1760b84c81a181` · `ops-api.js` `c77973deb5d9d9d69335becee56b9e2c841f897721af3bd0a9aa39cf8c9d7f19` · `health-check-install.sh` `895c5fe5faac9f184c741b3fdfe6c7e2e5d9b6747ac48c9a4685f73fa92f9429` |

### Open items

- **Founder:** confirm the 17:36 BST "Needs Attention: 6 new (6 sev3)" banner (AC-a3). Decide on financialfact (finding 1).
- **`ops-api.js` is 1,213 lines** (+ `lateness.js` 260), within the 1,500 rule, and has 15 endpoints. A6 (the `meridian-control` split) moves 6 governance routes out.
- **Next (Wed 14):** A4 go-live outside 10:45–11:15 and 16:45–17:15 UTC.
  - Prerequisite: the `d1-today` lag is recorded (done Mon 12).
  - Steps: swap the `.next` runner and installer; move `.env.entities-enrich-run` and `.env.ops-ingest` to `~/.meridian-secrets/` (ML-1011-2); re-run the boost install script (the install will show a "Background Items Added" notice); observe the next two fires.
  - FIRDS pin: swap the `.next` files and run `npm ci`.
  - A6 if time remains.

**Stop point reached for Tue 13** (17:05 UTC). Reply: "MA-OCT-002a day 2026-10-13 reported".

---

## Day Wed 14 Oct 2026

**Started 05:13 UTC** (Founder "continue"). Git `October-2026` @ `1b9dbde` = origin, no locks. Every code file I wrote still equals `1b9dbde`, and both reports matched their recorded hashes (the "changed on disk" notices were not content changes).
- **Rulings read:** ML-1013-3 (stop before any prompt-raising command; no `sfltool`; no Login Items changes); financialfact stays as it is until 23 Oct (KI 22.30 backlog); AC-a3 banner confirmed by the Founder.
- **`OPS_INGEST_KEYS` before/after rule:** **no `OPS_INGEST_KEYS` put was made today.** The emitter list is unchanged since Tue 13: `boost-local`, `health-check-local`. (For the record, the Tue 13 put replaced `{boost-local}` with `{boost-local, health-check-local}`; no emitter was dropped.)

### A4 go-live (CR-5; spec §8; Data-Identity Lead conditions §8.6)

**Prerequisites:** the `d1-today` lag was recorded (Mon 12: 25–30 min; reconfirmed by ENT-CR1 on Tue 13: +15–30 min), as the §8.5 gate requires. The final test gate before the swap passed: boost-heartbeat-resilience 207/207, lateness 42/42, sweep-contract 23/23, health-check 15/15, admin-jobs-lateness 13/13.

**011 dependency checked first:** 011's new files read their own `ops-ingest.env` from `~/MeridianAtlas-work/gleif-011/`, not the boost's, so moving the boost's secrets cannot affect 011.

| UTC | Step | Result |
|---|---|---|
| 05:15 | ML-1011-2: copy the boost's two run secrets to `~/.meridian-secrets/entities-enrich-run.env` and `ops-ingest.env` (600) | Byte-identical (hash-checked), no values printed |
| **05:16:16** | **Swap (the CR-5 recorded save):** `.next` → live for `entities-enrich-boost-run.mjs`, `scripts/entities-enrich-boost-install.sh`, `firds-local-seed.mjs`, `scripts/firds-seed-install.sh`, `scripts/firds-seed-status.sh`, `package.json`, `package-lock.json`; `.next` copies removed | Saved outside 10:50–10:59 / 16:50–16:59 UTC. Live boost runner SHA-256 `bde87a7e3bd1f1dd7d59e1db4c7c611cbfae2064ce78f6ff56fd15d52fc9c708` (= the tested `.next`). `npx` / `execFileSync` appear in comments only. |
| 05:16:29–33 | **FIRDS pin (A-8):** `npm ci` in `App/Corporate Atlas` | 72 packages; `node_modules/.bin/wrangler --version` = **4.96.0**; `better-sqlite3` loads; `firds-seed-status.sh`: **pinned 4.96.0 / installed 4.96.0**. `node_modules/` gitignored. |
| — | Test against the live runner after the swap | boost-heartbeat-resilience **207/207** |
| — | Commit **`3960aee`** (fast-forward from `1b9dbde`; 7 modified + 7 `.next` deletions, explicit paths), pushed | — |
| 05:42:51 | Boost LaunchAgent reinstall via `entities-enrich-boost-install.sh` (Founder told first, ML-1013-3; Founder "Install") | bootout + bootstrap OK; plist slots 11:50/17:50 local (10:50/16:50 UTC) unchanged; **`OPS_TRIGGER=launchd`** present; exit 0. No prompt reported. |
| **10:54:16** | **First live fire on the new runner** (slot 10:50Z; Mac woke late, in window) | Run log `fired \| utc_minute=54 in_window=true **writes_today=208** headroom=99792 headroom_80k=79792`. `start` heartbeat **not delivered (TimeoutError) → spooled**; `success` 201. `trigger=launchd`. |
| **16:55:16** | **Second fire** (slot 16:50Z, in window) | `fired \| … **writes_today=426** headroom=99574 headroom_80k=79574`; `start` 201, `success` 201; then **`replay start` of run `53c758c5` → 201**, "outbox replay \| delivered=1 expired=0 remaining=0". Outbox empty. |
| 19:06 | Remove the now-redundant in-repo `.env.entities-enrich-run` and `.env.ops-ingest` (gitignored; re-verified identical to the `~/.meridian-secrets` copies first) | Removed |

**`ops_job_run` (read-only, 19:05 UTC; 9 reads):**
- **10:50Z slot:** run `53c758c5`: `start` (received 16:55:18 by replay) and `success` (received 10:54:26).
- **16:50Z slot:** run `1a8fc831`: `start` and `success`.
- All rows `trigger=launchd` with `detail.slot`.
- **Note for 003:** the 10:50 `success` was stored with `end_only=1`, because its `start` arrived afterwards by replay. Both rows exist, and lateness groups them by `run_id`, so the slot reads `on_time` / `success`.

**AC-a4 status:**

| Clause | Status |
|---|---|
| Test-suite clauses (outbox, 4xx/202, expiry, no `/run` before replay, out-of-window, no wrangler/npx, `d1-today` budget/unavailable, FIRDS by path, status prints version, launchd trigger) | ✅ 207/207, on the live runner too |
| `d1-today` lag recorded | ✅ (Mon 12) |
| **Production count over the first 14 scheduled slots after go-live, excluding `paused`** | **Started: 2 of 14** (14 Oct 10:50, 16:50). **2/2 terminal events in `ops_job_run`, 0 permanent losses** (1 recovered by the outbox); **0 `wrangler_auth_10000`**; weekday run-log lines show the **real account total** (208, 426), not `headroom=100000`. Expected to complete about 30 Oct with the 011 pause (17–23 Oct). |

**Data-Identity Lead condition (4) / (b)9 record:**
- saved **2026-10-14T05:16:16Z**;
- first run on it **2026-10-14T10:54:16Z** (slot 10:50Z);
- commit **`3960aee`**.

**Rollback (R-1):** `git checkout 1b9dbde -- <the 7 paths>`, restore the two `.env` copies from `~/.meridian-secrets/`, re-run the boost install script. Rolling A4 back before 17 Oct drops 011's outbox gate to its daily run-log reconciliation fallback.

### Health-check (A3), unattended since Tue 13

| UTC | Slot (local) | Result |
|---|---|---|
| 13 Oct 21:07:06 | 22:00 | swept, raised 0, already_open 6, `rows_read` 98 |
| 14 Oct 07:00:06 | 08:00 | raised 0, `rows_read` 100 |
| 14 Oct 11:10:56 | 12:00 | raised 0, findings 5 (7 Oct left the 7-day window; its case stays open), `rows_read` 101 |
| 14 Oct 17:07:45 | 18:00 | raised 0, `rows_read` 104; silent (no open sev1/sev2) |

All exited 0 and were silent. Headroom figures match the analytics (≤ 101 reads each, against the ≤ 1,000 cap).

### D1, Workers and git (Wed 14)

| Item | Value |
|---|---|
| Remote D1 build writes | **0** (002a build total stays **160 / 500**) |
| Remote D1 build reads | 9 (ledger check). Build total ≈ 480 / 50k. |
| Worker deploys | None. `meridian-ops` is still `0905784d`. |
| `OPS_INGEST_KEYS` | No put today; emitters `boost-local`, `health-check-local` |
| Commit | **`3960aee`**, pushed |

### Observations for the Main Lane (no action taken)

1. **`App/Corporate Atlas/.env.admin-exceptions` is mode 644 inside the repo folder.** It's a pre-existing file outside 002a's scope. It's gitignored, but it's world-readable and on the Desktop (possibly iCloud). ML-1011-2's rule would move it to `~/.meridian-secrets/` with mode 600; it needs an owner decision.
2. **A6 (`meridian-control` split) was not started** (the row says "if time remains"). It gates only 003/004, so it can go to Thu 15 buffer or after 011.
3. **The AC-a3 uninstall test** remains for close-out, on a copy or as a script review.

**Stop point reached for Wed 14** (19:07 UTC). Reply: "MA-OCT-002a day 2026-10-14 reported".

---

## Day Thu 22 Oct 2026: A6 `meridian-control` split (local build; ML-1022-2)

**Authority:** Main Lane ruling ML-1022-2 (Decisions Log, 22 Oct). A6 is built locally today under 002a Control v1 (§13, CR-1, AC-a6), committed, then stops for the Architect review on Fri 23. Deploys come first on Sat 24 (N-3 lifts Sat 00:00Z), then 003 per its run sheet. CR-1 Founder approval comes with the Sat 24 go-live approval.

**Opening checks (17:55 UTC):**
- Control `fe9ed369…c32a` matches the STATUS_BOARD row; Task `10ff165a…5aa5d` matches the Control.
- Spec rev 1.3 is in force (§13 read).
- No `.git/*.lock`.
- HEAD `c3c6e4a` = origin.

**No deploy, no remote D1 access, no Cloudflare write today.** The only Cloudflare-adjacent commands were two local `wrangler deploy --dry-run` bundles.

### Isolation from 003 (LANE-8-ENG)

The shared checkout holds **uncommitted 003 work** in the files A6 must change:
- `App/Ops/src/ops-api.js` (+43/−4: `cases.js` / `sweep-ext.js` imports, sweep hooks, `handleAdmin` service gate);
- `App/Ops/wrangler-ops.toml` (+15: `OPS_CASES_*`, `OPS_SERVICE_ACTORS`, sweep switches);
- `App/Corporate Atlas/src/entities-api.js` and its toml (retirement);
- new `App/Ops/src/cases.js`, `sweep-ext.js`, migrations 004/m1/m2, tests and tools.

To leave every one of those untouched (as instructed):
- A6 was built in a **separate detached git worktree** at `~/MeridianAtlas-work/a6-worktree`, created from `origin/October-2026` (`c3c6e4a`), outside the repo folder and iCloud.
- It was committed there and pushed as a fast-forward of `origin/October-2026`.
- **The main checkout's files, index and branch ref were not changed.** Its local `October-2026` stays at `c3c6e4a`, one commit behind origin, until LANE-8-ENG rebases on Sat 24.

**Rebase preview for LANE-8-ENG:**
- A three-way merge (base `c3c6e4a`, ours = A6, theirs = 003's working copy, read-only) of `ops-api.js` and `wrangler-ops.toml` gives **0 conflicts**, and the merged file parses.
- 003's `handleAdmin` service gate and case hook land just before `/api/ops/admin/jobs`, as written.
- On a scratch copy of A6 + the merged `ops-api.js` + 003's files, **003's own tests pass:** `cases-contract` 63/63, `sweep-ext-contract` 34/34, `sweep-contract` 23/23, plus A6's `control-split` 100/100. (`migration-m1` needs a Corporate Atlas file outside the scratch copy and was not run.)
- **Suggested rebase:**

  ```bash
  git stash
  git merge --ff-only origin/October-2026
  git stash pop
  ```

  Then rerun 003's tests.

### What A6 changes (spec §13, exactly)

**New Worker `meridian-control`:**
- **Files:** `App/Ops/src/control-api.js` (486 lines) and `App/Ops/wrangler-control.toml`. Existing folder, so no folder CR.
- **8 endpoints, same paths:**
  - GET `/api/ops/sprint-board`, `/api/ops/release-ledger`, `/api/ops/events`, `/api/ops/drift`;
  - POST `/api/ops/admin/sprint-board`, `…/:id/stage`, `/api/ops/admin/release-ledger`, `…/:id/event`.
- **The legacy anonymous-POST 401 deny rule is copied.**
- **`verifyAccessJwt` is vendored**, and the file imports nothing.
- **`CF_ACCESS_AUD = ""` is committed on purpose.** Every admin route fails closed (401) until the Founder's new Access app "meridian-control admin" exists and its own AUD is committed (Sat 24 step C3).
- No cron.
- **Moved verbatim:** 21 of 21 moved definitions are byte-identical to the pre-split file (handlers, `STAGE_ORDER`, `RELEASE_EVENT_TYPES`, CORS/json helpers, the Access verification, `withoutCors`, `LEGACY_POST_RE`). Only its `handleAdmin` (4 POSTs) and router are new.

**`meridian-ops` (`App/Ops/src/ops-api.js`, +38/−279) now serves 7 endpoints plus 2 rules:**
- **Endpoints:** GET `budget-risk`, `openfigi-status`, `cf/invocations`, `cf/d1-today`, `admin/jobs`; POST `ingest/run-event`, `ingest/sweep`.
- **Rule 1:** the legacy-POST 401 deny (unchanged).
- **Rule 2 (new):** the 4 moved public GETs (and HEAD) return **302, never 301**, to the same path and query on `https://meridian-control.navinmv1981.workers.dev`. The 302 carries `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`; 0 D1 reads. The optional var `CONTROL_BASE_URL` can override the target, so no `wrangler-ops.toml` change was needed, which avoids a toml conflict with 003.
- **Removed:** the moved handlers, `STAGE_ORDER`, `withoutCors`, the unused `readJson`, and the 4 admin POST branches. Those paths now answer 404 after Access, and nothing is written.
- **Added:** `meridian-control` to `TRACKED_SCRIPTS` (`/api/ops/cf/invocations`).
- **Header comments** updated to the new domain boundary.
- The now-unused `who` line in `handleAdmin` was **kept deliberately**: it is the context line of 003's hook, which is why the merge is clean.

**Domain and writer (the §13 decision, for the Architect):**
- `sprintboarditems`, `releaseledger` and `operationalevents` stay Ops-domain, and their only Worker writer is now `meridian-control`.
- `ops_*` tables stay written only by the `meridian-ops` bundle.
- No cross-domain table.

**Front end unchanged** (§13):
- `ma-ops.js` still calls `meridian-ops`. Its 4 GETs follow the 302.
- Its two POSTs use the legacy anonymous paths, which have returned 401 since 001 and still do (rule 1). No behaviour change.

### Tests (local, 0 D1, no network)

**New `App/Ops/tests/control-split.mjs`: 100/100.** It runs the real handlers on `node:sqlite` with migrations 001–003, real RS256 Access JWTs signed in the test against a stubbed JWKS, and Cloudflare analytics stubbed (the test fails on any unexpected network call).
- **[routes]:** of the 15 pre-split endpoints, `meridian-ops` serves exactly 7 and `meridian-control` exactly 8. Each is served by exactly one Worker, as §13 assigns. Headroom is 8 (003 adds 4 → 11 of the 15 cap; BREVA S-1).
- **[redirect]:** all moved GETs, including query strings, return 302 with the exact Location, ACAO `*` and `no-store`. HEAD too. The `CONTROL_BASE_URL` override works. OPTIONS stays 204 with CORS. Never 301.
- **[parity]:** after following the redirect, each GET's status, body and CORS equal the **pre-split capture** (`tests/fixtures/a6-pre-split-capture.json`), generated today by running the pre-split handler from `c3c6e4a` on the same seeded DB.
  - A 13-call sequence over the 4 admin POSTs gives identical responses on both. It covers create, duplicate, missing fields, a forward stage with a gate, a backward reject, BLOCKED, an unknown ticket, release create, `worker_deployed`, `verification_passed`, the `release_closed` cascade, rollback-without-reason and a bad event type.
  - Identical governance tables at the end; wall-clock columns are compared as set/unset.
- **[auth] (001 AC4 on `meridian-control`):** each of the following → 401, 0 rows, no CORS, on each of the 4 POSTs:
  - no JWT, a forged signature, the wrong aud (`meridian-ops`'s), an expired token, the wrong iss, an unknown kid, a malformed token;
  - **Access unconfigured (empty AUD, as committed).**

  The rest of the matrix:
  - A valid user session → 200 with actor = the verified email (`access_jwt`).
  - A service token → actor `service:<cn>`.
  - Unknown admin path → 404; GET on an admin POST route → 404.
  - The 4 legacy anonymous POSTs → 401, 0 rows, **on both Workers**.
  - On `meridian-ops`, the moved admin POSTs → 401 without a JWT and **404 with a valid ops JWT, 0 rows**.
- **[cors]:** control's public GETs have ACAO `*`; admin OPTIONS has none; public OPTIONS has `*`. A `meridian-ops` route asked of `meridian-control` returns 404 (no overlap).
- **[writers] (the AC-a6 grep, bundle-aware):**
  - `ops_*` are written only inside the `meridian-ops` bundle (`ops-api.js` plus its transitive imports; that includes 003's `cases.js` and `sweep-ext.js` after the rebase, checked on the merged scratch tree);
  - the governance tables are written only in `control-api.js`;
  - `control-api.js` imports nothing, shares no file with the ops bundle and never names an `ops_*` table.

**Mutation check:** the same test run with the pre-split `ops-api.js` in place **fails 17 checks** (routes, redirect) and then stops at parity. The test catches an unsplit Worker.

**Regression (unchanged suites, A6 tree):** `sweep-contract` 23/23 · `lateness` 42/42 · `admin-jobs-lateness` 13/13 · `health-check` 15/15 · `boost-heartbeat-resilience` all passed. `ingest-contract` needs a live URL and was not run.

**Bundles (`--dry-run`):** `meridian-control` 17.27 KiB (4.90 gzip), bindings DB + 2 Access vars (AUD empty). `meridian-ops` 50.26 KiB (14.47 gzip), bindings unchanged.

**Not testable locally (Sat 24 steps C4–C5):** that a real browser follows the cross-origin 302 from GitHub Pages and the `ma-ops.js` tabs render on the live site, and the auth matrix against the real Access app.

### Files (SHA-256)

| File | SHA-256 |
|---|---|
| `App/Ops/src/control-api.js` (new) | `6a5e0a2f98b7589aa055bbb137cacdfab643286e8eab9c428184517971f70832` |
| `App/Ops/wrangler-control.toml` (new) | `f6770d2a014046703419ec744b61141d70a06ceed9a2c1fba2d48ce3cf1b2e6b` |
| `App/Ops/src/ops-api.js` | `173f120e768ed7b49294686d1926b7a60524c9db41a02fc5884aad46b8631d29` |
| `App/Ops/tests/control-split.mjs` (new) | `5bac1384840a4f7fd988214b97e2df17e71ae72b32225dadc4cee1107b7404f8` |
| `App/Ops/tests/fixtures/a6-pre-split-capture.json` (new) | `3a23c79acd0a23bb2e6a728d37b8159f0a66745528053a8762fb2a6b3f552117` |

### Deploy steps for Sat 24 (after the Architect's PASS and the Founder's CR-1 + go-live approval)

**Rules for the day:**
- **Deploy only from the A6 worktree** (`~/MeridianAtlas-work/a6-worktree`, at the A6 commit). **Never from the shared checkout**, which carries 003's uncommitted code; this is the same principle as BREVA S-3.
- Respect FREEZES.json: enrich 05:50–07:10, bootstrap 07:55–08:05, 23:50–00:10. Suggested start: **08:10 UTC**, finished well before 003's run sheet.
- Wrangler only `/usr/local/bin/wrangler` 4.96.0.
- Every step records the version id (BREVA S-5).

| # | Step | Verify | If it fails |
|---|---|---|---|
| C0 | **Preflight.** `git -C ~/MeridianAtlas-work/a6-worktree fetch && git … status`: the worktree is at the A6 commit, clean, and that commit is on `origin/October-2026`. Record the live `meridian-ops` version (`wrangler deployments status --config App/Ops/wrangler-ops.toml`; expected `9d437dd1…` unless something changed). **Live pre-split capture:** `curl -si` the 4 moved GETs on `meridian-ops` and save to `~/MeridianAtlas-work/a6-live/pre/`. | Versions and capture saved | Stop |
| C1 | **Deploy `meridian-control`** (`wrangler deploy --config App/Ops/wrangler-control.toml`, from the worktree). Record the version. | Its 4 GETs → 200, ACAO `*`, bodies equal to the C0 capture. Admin POST without a session → 401 (AUD still empty: fail closed). | Leave it; nothing routes to it yet |
| C2 | **Founder (≈ 15 min):** create the Access app "meridian-control admin" on `meridian-control.navinmv1981.workers.dev/api/ops/admin` with the 001 allow list. Read its **AUD** (an identifier, not a secret) to this lane. | AUD received | Stop; ops is not yet changed |
| C3 | Put the AUD into `CF_ACCESS_AUD` in `App/Ops/wrangler-control.toml`. Commit (explicit path) and push, then **redeploy `meridian-control`**. Record the version. | Admin path without a session → Access login (302) / 401. Forged JWT sent directly → 401. With the Founder's session, a POST with a missing field → **400** (auth passed, 0 rows written; no production rows needed). | Redeploy C1's version |
| C4 | **Deploy `meridian-ops`** (`wrangler deploy --config App/Ops/wrangler-ops.toml`, **from the worktree**, so no 003 code). Record the version. | The 4 moved GETs → **302**, correct Location, ACAO `*`, no-store; following them gives the same status, shape and CORS as the C0 capture. `budget-risk`, `openfigi-status`, `cf/d1-today` → 200. Ingest keys still accepted (400 probes, 0 writes, as T12). `admin/jobs` via Access → 200. Moved admin POSTs → 404. | **`wrangler rollback <C0 version>`** (routes restored in one step; §13); leave control deployed and unused |
| C5 | **Live site (AC-a6):** open the GitHub Pages Ops tabs (Sprint Board, Release Ledger, Events, Drift) in a real browser. Each renders through the redirect, with no CORS error in the console. | Screenshots and console clean | C4 rollback |
| C6 | **Hand-off:** tell LANE-8-ENG that A6 is live. Then 003's rebase (stash / ff / pop; preview above: 0 conflicts) and its run sheet. The next health-check sweep reaches `meridian-ops` unchanged. Afterwards remove the worktree (`git worktree remove ~/MeridianAtlas-work/a6-worktree`). | 003 tests rerun green on the rebased tree | — |

**D1 for the whole A6 deploy:** 0 writes. Reads: the verification GETs only (a few hundred). **Rollback:** §13. Redeploy the C0 `meridian-ops` version; leave `meridian-control` deployed but unused (with an empty AUD it can only serve the 4 public GETs).

### Budget, deviations, open points

- **Today:** 0 D1 reads or writes, 0 deploys, 0 Cloudflare API writes.
- **Git:** one commit from the A6 worktree (explicit paths: the 5 A6 files + this report), pushed as a fast-forward. The Task's Git section says `claude/` files go through a Main Lane commit list; this report is included on the Founder's instruction for today ("commit by explicit path").
- **Founder action needed Sat 24:** step C2 (Access app + AUD) and the CR-1 approval with the go-live approval.
- **For the Architect:**
  - (a) the 302 rule, implemented as §13 (GET and HEAD);
  - (b) the empty-AUD fail-closed default in the committed toml;
  - (c) the bundle-aware writer rule in place of the literal "only in `ops-api.js`" grep, needed once 003's modules land;
  - (d) deploying from the worktree on Sat 24.

**Stop point reached for Thu 22.** Waiting for the Architect review. Reply: "MA-OCT-002a day 2026-10-22 reported".
