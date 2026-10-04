# MA-OCT-001 — Ops Backend Foundation: Close-out Summary

```text
ISSUED BY:    Engineering Lead (MA-OCT-001 build lane, local Claude Code)
REVIEWED BY:  Architect (pending). Operations Lead signs release readiness (pending).
APPROVED BY:  Founder (pending)
PACKET:       MA-OCT-001 — Ops backend foundation (BUILD)
STATUS:       FINAL — 15 of 16 ACs pass. AC9: ❌ against its strict 100% bar (3 of 4 fires captured,
              1 miss accounted for); PASS WITH NOTES case put to the Architect (§2).
WRITTEN:      2026-10-02 ~17:10 UTC (draft); finalised 2026-10-04 ~08:10 UTC after the 3 Oct 16:50 UTC fire
```

**Governing documents (hash-verified at start, 2026-10-01 05:11 UTC):** Spec `d69e0ade…`, Spec Review `8573326f…`, Build Brief `ab5d733d…`. Amendments A1–A4 applied.
**Commit:** `da38cf5` on `October-2026` (fast-forward from `fa9c723`, pushed 2026-10-01).
**Worker:** `meridian-ops` live version **`56c87c9a-349b-4c6c-8a4f-2430d1a83103`** (code version `cf5cdaac` + the final `OPS_INGEST_KEYS` secret). **Rollback point:** `589ae24c-317a-40b0-9b05-54a8f2a20d57`.

---

## 1. Acceptance criteria

| # | Result | Evidence |
|---|---|---|
| AC1 | ✅ | Pre-migration remote `sqlite_master` had 0 `ops_%` objects. After the migration: 5 tables, 11 indexes and 3 triggers, matching §5 with A1 applied. The migration file contains nothing else. The registry holds exactly 2 rows: `ops.ingest` and `local.entities-enrich-boost` (emitter `boost-local`). |
| AC2 | ✅ | See §3 for the remote EXPLAIN plans. Q4's SCAN of `ops_job_registry` is the only SCAN, as declared. Q3's `SCAN CONSTANT ROW` is the literal `INSERT…SELECT` row (0 table reads). One planned deviation from the spec: Q4's 4th subquery was rewritten (§3). |
| AC3 | ✅ | Live `rows_read`: Q1 4, Q2 4, Q3 probe 1, Q4 fleet 7, Q5 history 8. `GET /api/ops/admin/jobs` returned `rows_read: 7` through a real Access session. All are far below 50k. |
| AC4 | ✅ | **Edge:** all 5 admin routes without Access, and a forged JWT or `CF_Authorization` cookie, return 302 to the Access login. **Worker** (requests sent directly to a local dev using the production AUD and team domain): no header, malformed, wrong `aud` (015b's), wrong `iss`, expired, unknown `kid` and forged signature each return **401**. **Valid session:** the Founder signed in through Access, and `GET /api/ops/admin/jobs` returned `{"ok":true,"jobs":[…2 rows…],"rows_read":7}` (2026-10-01). **Ingest:** no key 401, wrong key 401, key presented under another emitter id 401, the temporary emitter `ops-contract-test`'s key on the boost job **403**. **Counts:** 0 rows landed in any table during the auth matrix (`sprintboarditems` 19, `releaseledger` 12, `operationalevents` 12 and `ops_job_run` 0 before and after). |
| AC5 | ✅ | All 4 legacy POST paths return 401 `moved to /api/ops/admin/…`. The three legacy table counts were unchanged. |
| AC6 | ✅ | Local and remote. The same start twice gives 201 then 200 `duplicate` (1 row). The same end twice gives 201 then `duplicate`. `failed` after `success` gives `duplicate`, and the first terminal wins. An end-only event is stored with `end_only=1`. **A1:** `items_attempted=44, items_progressed=0` is stored as 44 / **0**, which is the F4 signature. An attempted-only event leaves `items_progressed` NULL. Non-integer `detail.metrics` values are dropped. The test rows are tagged `trigger='contract-test'`, run_id `28d0dc53…`. |
| AC7 | ✅ | **D1 global switch:** 202 `ingest_disabled`. **Per-job switch:** 202 `job_ingest_disabled`. Locally, another job still recorded 201 while that switch was on. Remote has only one emitting job, by design. **Audit:** each of the 4 toggles wrote an `ops_case_event` row (`ingest_toggled`, 1→0→1, event_ids 1–4). **Cap:** a temporary deploy with cap 3 (`013b8bd0`) returned 202 `daily_cap`, with the tail log line `daily cap reached (4/3)`. **Hard switch:** a temporary deploy with `OPS_INGEST_ENABLED=false` (`b267bb8d`) returned 202, with the tail log line `hard switch … 0 D1 reads`. The normal deploy was restored, and the switches are on. |
| AC8 | ✅ | `App/Ops/tests/boost-heartbeat-resilience.mjs`: **115/115 pass.** It runs the real script in a temp copy with stubbed `/run` and `wrangler`. 4 job paths (fired, skipped_headroom, headroom_error, run_http_500) are each run against Ops answering 201, Ops returning 500, Ops hanging, and an unroutable `10.255.255.1`, and compared with a control run that has heartbeats unconfigured. Results: exit code and run-log line identical in every case; `/run` called within ≤21 ms of control; **added wall time at most 2.07 s**. A defect the test found and that was fixed before go-live is in §4. |
| AC9 | ❌ **strict bar missed; PASS WITH NOTES proposed** | See §2. Over 2 consecutive days (2–3 Oct) there were 4 fires, and **3 were captured**. Every captured fire matches its run-log line: `fired` → `success` (start + end) ×2, and F6 `error` → end-only `failed` with `error_class='wrangler_auth_10000'` ×1, as A1 maps it. **1 miss** (2 Oct 10:50, run `e38fff34…`): the heartbeat timed out while wrangler hit F6 in the same second, and the miss is accounted for in the local heartbeat log with run_id and cause. |
| AC10 | ✅ | The grep for `OPS_INGEST`, `X-Ops-Ingest-Key`, `CF_Authorization` and the key prefix across `App/*.js`, `App/index.html` and `docs/` finds **0** matches. The key value appears in 0 committed files. `wrangler-ops.toml` holds identifiers only (team domain, AUD, switch and cap). `wrangler secret list` shows `CF_ANALYTICS_TOKEN` and `OPS_INGEST_KEYS`. `git check-ignore` confirms `App/Corporate Atlas/.env.ops-ingest` is ignored (`.gitignore:12 .env.*`); the file is mode 600. |
| AC11 | ✅ | Local: `UPDATE ops_job_run` aborts with "ops_job_run is append-only". `UPDATE` and `DELETE` on `ops_case_event` abort with "ops_case_event is append-only". `DELETE` on `ops_job_run` works (the prune path). The phase/event CHECK rejects `start`+`success`. |
| AC12 | ✅ | Guarded `UPDATE` run as one `--file` batch with its audit row (2026-10-01 19:11:36 UTC). Afterwards exactly 1 board row had changed (`MA-OCT-001` → `CLOSED`/`CLOSED`, SUPERSEDED marker prepended, notes 1,165 → 1,298 chars). It has one `operationalevents` row (#13, `ticket_state_changed`). The board still has 19 rows, and **no October row** was created (A4). The preflight row was captured in full before the write: `IDEA`/`ACTIVE`, `updated_at` 2026-08-29 09:28:54. |
| AC13 | ✅ | **14 endpoints** (8 public legacy GETs, 4 admin POSTs, 1 admin GET, 1 ingest POST) plus the legacy-POST deny rule. That is ≤ 15. `src/ops-api.js` is **955 lines**, ≤ 1,500. |
| AC14 | ✅ | Build D1 usage from per-statement `meta`: about **115 row-writes**. That covers the migration 33, registry seed 6, test events about 20, switch toggles 20, housekeeping 7 and 5 pilot events about 25 (2–3 Oct). Reads were about 3k, against the budgets of 500 writes and 50k reads. `/api/ops/cf/d1-today` for 1 Oct read 10,538 / 4 before the build. |
| AC15 | ✅ | All 8 legacy GETs match the pre-deploy capture: same status, `*` CORS and response shape. On the live site (`navinmv81.github.io/meridian-atlas/`), all 5 `ma-ops.js` tabs render, and every `meridian-ops` request returns 200. The console's 402 is `meridian-proxy/?ipos=1`, which is unrelated. |
| AC16 | ✅ | The grep for `INSERT/UPDATE/DELETE/REPLACE … ops_*` across `App/` and `13F Seed/` outside `App/Ops/src/ops-api.js` and `App/Ops/migrations/` finds **none**. |

## 2. AC9: pilot evidence (2–3 Oct, final)

| Fire (UTC) | Boost run log (`logs/entities-enrich-boost.log`) | Heartbeat log | `ops_job_run` |
|---|---|---|---|
| 2026-10-02 10:50:03 | `error`, headroom check failed (wrangler d1 execute; F6, `[code: 10000]` in the launchd stderr log) | `failed` run `e38fff34…` → **not delivered: TimeoutError** (10:50:05.7) | ❌ **none** |
| 2026-10-02 16:50:01 | `fired`, in window, `/run` 200 (log line 16:50:05.134) | `start` → 201 (05.048); `success` → 201 (05.253) | `start` + `success`, run `101a6ae5…`, `end_only=0`, `slot=2026-10-02T16:50Z`, `out_of_window=false`, `http_status=200` |
| 2026-10-03 10:55:51 (slot 10:50; late fire, still in window) | `error`, headroom check failed (F6, `[code: 10000]`) at 10:55:53.423 | `failed` run `defd7823…` → 201 (53.803) | ✅ end-only `failed`, `error_class='wrangler_auth_10000'`, `end_only=1`, `slot=2026-10-03T10:50Z`, `out_of_window=false` (received 53.807) |
| 2026-10-03 16:52:56 (slot 16:50; late fire, in window) | `fired`, in window, `/run` 200 (log line 16:53:00.107) | `start` → 201 (00.006); `success` → 201 (00.249) | ✅ `start` + `success`, run `207c93ae…`, `end_only=0`, `slot=2026-10-03T16:50Z`, `out_of_window=false`, `http_status=200` (received 00.022 / 00.227) |

**Totals:** 4 fires, 3 captured (75%), 1 miss. Every captured event matches its run-log outcome. Every terminal event was received after its run-log line was written. No fire changed its exit code or log line.

The 3 Oct fires landed 5 min and 3 min after their slot; the Mac was probably asleep. The `slot` field still mapped each fire to the right slot, and both stayed in the :50–:59 window. F6 is the expected cause of the `failed` events, and it is outside 001.

**PASS WITH NOTES case for the Architect** (Operations Lead ruling, 2 Oct):
- (i) Every delivered fire matches the run log: 3 of 3. Note that this is **3 delivered, not the 4 the ruling named**. Only 4 fires fell in the 2–3 Oct window and one was missed, and the Founder chose to keep the 3 Oct 16:50 cutoff rather than extend to 4 Oct 10:50.
- (ii) The one miss is accounted for in `logs/entities-enrich-boost-heartbeat.log` with run_id `e38fff34-b22b-4e07-a222-4601e5437c18` and cause `not delivered: TimeoutError`.
- (iii) Guaranteed delivery from local emitters becomes a 002 requirement (§5 item 1).

The emitter was not changed during the observation.

**10:50 analysis.** The emitter did exactly what it should: the run log was written first, the heartbeat gave up at the 2 s ceiling, the exit code was unchanged, and nothing reached the console. But the event **never reached Cloudflare**. `meridian-ops` analytics show no invocation at that time. The wrangler pre-flight, which also goes to Cloudflare, failed in the same second. The Mac was awake (display on, a Teams call active), so sleep or wake is not the cause.

**F6 is a Cloudflare auth rejection (10000).** `logs/entities-enrich-boost-launchd-stderr.log` holds wrangler's full JSON. As of 2 Oct, 35 of 35 entries were `Authentication error [code: 10000]`, against 36 `error` lines in the run log. As of 4 Oct it is 36 of 36 against 37, with no other error code. The request therefore reached Cloudflare's API.

On 3 Oct 10:55, F6 recurred while the heartbeat reached Cloudflare 0.4 s later. So F6 does not need a connectivity blip, which is evidence for the F6 issue owner.

The 10:50 co-failure fits a short connectivity blip that broke wrangler's token renewal and the heartbeat together. **This is not proven,** and F6 is tracked as its own known issue, outside 001.

Under the design (§7.4), a lost heartbeat under-reports honestly rather than being invented. The 100% capture target was missed on this run. The miss is accounted for in the local heartbeat log with its run_id and cause.

**Data-Identity Lead conditions:**
- **(1)** The run-log format is unchanged. The terminal heartbeat is sent after its log line: 05.134 before 05.201 at receipt. `start` goes out once the pre-flight passes, before the outcome line can exist.
- **(2)** Heartbeat output went only to `entities-enrich-boost-heartbeat.log`.
- **(3)** The pause check is still first. `/run` timing is unaffected, as AC8 showed.
- **(4)** The file was saved at **2026-10-01 19:08:13 UTC** (first save 19:05:05; both outside the windows). The **first run on the new code was 2026-10-02 10:50:03 UTC**, and the commit is `da38cf5`.
- **(5)** Every event carries `slot`, `fired_at` and `out_of_window`.

## 3. Query plans (remote, after migration)

```text
Q1  SEARCH ops_job_registry USING INDEX sqlite_autoindex_ops_job_registry_1 (job_id=?)
Q2  SEARCH ops_job_run USING COVERING INDEX idx_ops_job_run_received (received_at>?)
Q3  SCAN CONSTANT ROW / SCALAR SUBQUERY 1 / SEARCH ops_job_run USING COVERING INDEX sqlite_autoindex_ops_job_run_1 (run_id=? AND phase=?)
Q4  SCAN r (ops_job_registry, ≤60 rows, declared)
      + 3 × SEARCH ops_job_run USING COVERING INDEX idx_ops_job_run_job_type_at (job_id=? AND event_type=?)
      + SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=?)   -- last_end_at, LIMIT 1
      USE TEMP B-TREE FOR ORDER BY (outer, ≤60 rows)
Q5  SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=?) / USE TEMP B-TREE FOR LAST TERM OF ORDER BY (phase tiebreak only)
Q6  SEARCH ops_job_run USING INTEGER PRIMARY KEY (rowid=?) / LIST SUBQUERY / SEARCH … COVERING INDEX idx_ops_job_run_received (received_at<?)
```

**Deviation, recorded for the Architect.** The spec's Q4 `last_end_at` subquery (`MAX(started_at) … event_type <> 'start'`) planned as `SEARCH … idx_ops_job_run_job_at (job_id=?)` *without* the MIN/MAX shortcut. It reads every row the job has: about 720 a job with the pilot, thousands at full wiring, against the declared "about 300 per fleet call". It was replaced with `phase = 'end' ORDER BY started_at DESC LIMIT 1`, which the table's CHECK makes equivalent and which reads about 2 rows. No new SCAN.

## 4. Build notes and deviations

- **A1, applied before the migration:** `items_processed` was replaced by `items_attempted` and `items_progressed`. `detail.metrics` is validated (≤16 keys, keys ≤32 chars, non-integer values dropped). `skipped` requires `reason ∈ {hold, pause, budget, auth, out_of_window, empty_input}`. `items_processed` is rejected with 400. The per-phase `job_id` convention is documented in the migration header.
- **Pilot emitter fix found by the AC8 test, before go-live.** With an unroutable Ops host, `fetch` + `AbortSignal.timeout` resolved at 2 s, but undici's TCP connect kept the process alive for about 10 s. The exit code and log were still unchanged; only wall time was affected. The emitter now uses `node:http(s)` with `req.destroy()` at the ceiling, and the added wall time is at most 2.07 s.
- **Known defect, carried to 002 (Operations Lead ruling, 2 Oct):** pilot events carry `trigger='manual'` even when launchd fires them. The script checks `XPC_SERVICE_NAME`, which this LaunchAgent (`/bin/bash -c … node …`) doesn't set to the label. It is cosmetic: it doesn't affect outcomes or AC9 matching. The boost script and its plist are **not** changed during the observation. Candidate fix for 002, which needs Data-Identity Lead sign-off: set `OPS_TRIGGER=launchd` in the plist's `EnvironmentVariables` through `entities-enrich-boost-install.sh`, and read it in the script.
- **Access app.** Getting it set up took three tries. The path is correct now: `meridian-ops.navinmv1981.workers.dev/api/ops/admin`, AUD `7f1b6784…`, team domain `meridian-atlas-except.cloudflareaccess.com`. The two placeholder apps named `navinmv1981.workers.dev` stay in place, per the Main Lane ruling.
- **Temporary test emitter.** `ops-contract-test` was added to `OPS_INGEST_KEYS` for AC4 and then removed. Its key now gets 401.
- **Local permission rules.** `.claude/settings.local.json` holds 3 wrangler allow rules for this build. It is not staged or committed, per the Main Lane ruling.
- **Q3 (bootstrap cron):** the Founder decided **no**. 002's alerting sweep will use spec §9 fallback (a): reviving the local `health-check` LaunchAgent as the caller.

## 5. Recommendations for MA-OCT-002 (not built)

1. **Requirement: guaranteed delivery from local emitters.** Keep an on-disk outbox of undelivered events and replay them on the next run with the same `run_id` and a `started_at` within 7 days. 001's `UNIQUE(run_id, phase)` + `INSERT OR IGNORE` already makes a replay idempotent, so a replay can never double-count. This closes gaps like 2 Oct 10:50 without breaking the 2 s ceiling.
2. **Fleet health in 002** can use `end_only` and a missing `end` row together with `expected_max_duration_s=120` (already set on the pilot row) to flag lost runs.
3. **Carry-over defect:** the `trigger='manual'` label (§4).

(F6 itself is tracked as its own known issue. Its error code is already captured in full in `logs/entities-enrich-boost-launchd-stderr.log`.)

## 6. Rollback record

| Layer | Rollback | State |
|---|---|---|
| Worker | `wrangler rollback --name meridian-ops 589ae24c`. This **restores the 4 anonymous POSTs**, so it is for emergencies only. | Not used |
| Tables | Leave the 5 `ops_*` tables in place, unused. Dropping them needs Founder approval and an export first (spec §13.4). | — |
| Pilot | Delete or rename `App/Corporate Atlas/.env.ops-ingest` (instant no-op), or set `ingest_enabled=0` on `local.entities-enrich-boost`. To revert the script: `git checkout fa9c723 -- "App/Corporate Atlas/entities-enrich-boost-run.mjs"`. | — |
| Access and secrets | Disable the "meridian-ops admin" Access app. `wrangler secret delete OPS_INGEST_KEYS --name meridian-ops`. | — |
| Housekeeping | Restore `stage='IDEA'`, `status='ACTIVE'`, the original `notes` (1,165 chars, captured) and `updated_at='2026-08-29 09:28:54'` with one guarded `UPDATE`, plus an `operationalevents` row. | — |

## 7. Next

- **Architect review:** in particular the AC9 PASS WITH NOTES case (§2) and the Q4 query deviation (§3).
- **Operations Lead:** release-readiness sign-off.
- **Founder:** approval.
- **Carried to MA-OCT-002:** local-emitter outbox (§5 item 1), the `trigger='manual'` defect (§4), and alerting through `health-check` fallback (a) (Q3 = no).
