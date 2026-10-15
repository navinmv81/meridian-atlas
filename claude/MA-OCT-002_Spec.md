# MA-OCT-002 — Fleet, Schedules, Health and Drift: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Operations Lead (packet owner; spec lane, doc-only)
REVIEWED BY:  Architect + ETF Product Lead (Wed 7 Oct). Data-Identity Lead consulted on Entities-Worker items.
APPROVED BY:  Founder (spec approval Thu 8 Oct)
PACKET:       MA-OCT-002 — Fleet, schedules, health and drift (SPEC ONLY)
GATE:         Spec → reviews Wed 7 Oct → Founder Thu 8 Oct → build from Fri 9 Oct
STATUS:       REV 1.3 (8–9 Oct; R-C path applied 9 Oct) — doc-only, from the independent review (PASS WITH CONDITIONS) and the Founder's 8 Oct
              decisions: R-A seed `/run` and figi `/run` + `/rematch` gated in A5 (KI 22.49, CR-7b); R-B F7/011 argument
              corrected and re-cited to 011 rev 1.6; R-C CR-7 path (ii) per the Data-Identity Lead (LANE-6, L6-1) with
              deployed = repo diff checks (C1) on CR-6/CR-7/CR-7b; CR-7b ACKed with conditions C1–C6 (L6-2); R-D the Data-Identity Lead's conditions completed; R-E deterministic `case_ref` and an
              idempotent audit row; build-brief notes; 011 rev 1.6 items (pause row task, 120 s freshness); Founder
              answers confirmed 8 Oct. Only scope change: A5 grows by ≈ ¼ day (Founder-chosen).
SUPERSEDES:   rev 1.2 98c0ef370e398d2a5ac0d8f39731d0e49b1eec6cf02d1d8a06446cc298c4dbf2 (8 Oct; reviewed independently)
              rev 1.1 76ed20c43983a1a95042e9f2e0b91e4c0c107a50d36a72fcf5cd24c6d70fe203 (8 Oct; verified by the Main Lane)
              rev 1 62235aaa4c7c1ecbaf4c76885c99d43bdca0a12385caadbd842eb609edc9e997 (7 Oct; verified by the Main Lane)
              rev 0 af3cc5630cc98171c193a56a2a4f0417aad64e9add37c0d8e9f4586d5477f678 (3 Oct, outline + draft split)
EVIDENCE:     claude/MA-OCT-002_Explain_Pack_Results.md 677dd3d0b60fa039ef9186fc6f4da73b10579c1518979c7b4c397e493ea268b4
              (Lane 1, 7 Oct 19:29–19:31 UTC; 374 reads, 0 writes; accepted by the Operations Lead)
REVIEW:       claude/MA-OCT-002_Independent_Review.md 8004afb7d1c2eba8350b537554303a361750c93dc288ea672921ba70a0763ce5
              (fresh session, Architect + ETF PL, on rev 1.2: PASS WITH CONDITIONS; R-A to R-E applied in rev 1.3)
SELF-CHECK:   claude/MA-OCT-002_Review.md b970ddec9a22fe9aa44bac0491bf12f88928352cdef8ec086d2a348e51853bd5 (same session as the
              author, so a self-check, not the independent review; its R-1, R-2, A-3–A-8, B-1, B-2 are applied or carried here)
BRIEF:        claude/MA-OCT-002_Spec_Brief.md  1fb5881c41540755c2a0cd719777dabe73fd6d4299d6567fa2e9ff7efa8ca55b
```

**Binding inputs carried into this spec:** 001 Architect close-out review (4 Oct: items a–d carried to 002, binding); Main Lane instruction of 5 Oct (items (g) wrangler pin and (h) KI 22.47); 006 Ops review notes N-1, N-4, N-5 (5 Oct); Founder decisions of 7 Oct on Q1–Q3 (§16); Main Lane rulings of 7 Oct (ML-1 accepted conditional on the Data-Identity Lead's ACK; D2-1, D2-2 accepted) and its rev 1.1 asks.

---

## 0. Summary of decisions (one line each)

1. **Phasing:** 002a (6 items, build Fri 9 – Wed 14 Oct) unblocks 003/004 and 011; 002b (6 items) follows from Thu 15 Oct.
2. **Registry:** 49 rows loaded from the 000 manifest by a generated, reviewed `--file` batch; kept current by a local `registry-sync` diff that every schedule-changing change must attach.
3. **Schedules:** intended schedule = source (tomls, install scripts / plists) stored as typed JSON with its time zone; effective = Cloudflare schedules API via the Workers-Read token (002b). Cloudflare day-of-week semantics (1 = Sunday) and launchd local time (DST) are modelled, not assumed.
4. **Drift:** a new, Access-only field on `GET /api/ops/admin/jobs`. The legacy public `GET /api/ops/drift` is **release** drift and is left alone (ruling D1-1).
5. **Lateness:** computed at read time per scheduled slot: `on_time / late / missed / paused / pending / unobserved`; per run: `running / lost / success / partial / skipped / failed`; per job: `frozen`.
6. **Planned pauses:** new Ops table `ops_job_pause`; the 011 boost pause (17–23 Oct, if GO) never raises a miss.
7. **Alerting sweep:** the revived `health-check` LaunchAgent calls one new key-authenticated route, `POST /api/ops/ingest/sweep`, 4× a day; the Worker raises deduplicated `ops_exception` rows; the agent shows a macOS notification (Founder Q2). No cron slot.
8. **Local outbox:** undelivered events are spooled on disk and replayed with the same `run_id` after the next run's own events, idempotently. Ships in one boost-runner change with the out-of-window fix (KI 22.47), the `OPS_TRIGGER` label and the **F7 fix** (pre-flight headroom from Cloudflare analytics, which also takes wrangler out of the boost — the F6 fix for this job) — **live before 17 Oct**. Every other local runner and read lane pins **wrangler 4.96.0**.
9. **Security:** bootstrap `/trigger` removed; entities-delta `/run`, entities-seed `/run` and entities-figi `/run` + `/rematch` gated with a per-Worker `RUN_AUTH_SECRET` (fail closed). All before 011's 17 Oct run.
10. **Worker split:** governance routes move to a new `meridian-control` Worker (CR-1); `meridian-ops` drops to 7 endpoints, leaving 8 for 003/004.
11. **Worker heartbeats (002b):** authenticated ingest after the 1042 test; enrich Phase 2+3 reports end-only and reserves its fetch in the checkpoint (44 → 43).
12. **KI 22.39:** entity run facts move to `ops_job_run`; entity state moves to a new Entities-domain table; ETF table cleaned by its owner. No cross-domain writes.
13. **Founder decisions (7 Oct):** health-check review date 31 Dec 2026; macOS notification only; financialfact-backfill retired for October (registry `held`).

### 0.1 Ops binding items (Main Lane, 7 Oct) — where each is met

| # | Binding item | Priority | Where in this spec | Phase | Acceptance |
|---|---|---|---|---|---|
| OB-1 | Local outbox with **same-`run_id` replay** | **P0** | §8.1 | 002a A4, live by Wed 14 Oct | AC-a4 |
| OB-2 | **Missed-fire detection from the schedule** (not from received events) | P0 | §6.3 (slot generation), §7.2 (`job_missed`) | 002a A2 + A3 | AC-a2, AC-a3 |
| OB-3 | **`out_of_window` → `skipped`**, shipped together with the **trigger fix** (`OPS_TRIGGER=launchd`) | P0 | §8.2, §8.4 | 002a A4 | AC-a4 |
| OB-4 | **F7 `writes_today` fix** (boost guard blind Mon–Sat) | P0 (moved from B4) | §8.5, §15 | 002a A4 | AC-a4 |
| OB-5 | **F6 raised to High** (wrangler 10000 on 4 of 12 boost slots, about 1 in 3) | High | §8.3, §8.5, §15 | 002a A4 (boost: wrangler removed; FIRDS and read lanes: pinned 4.96.0) | AC-a4, §20 |

**Evidence that ties OB-1 and OB-2 together (EXPLAIN pack P4 vs the boost run log).** Since 2 Oct 10:50 UTC, 4 scheduled slots have **no terminal row** in `ops_job_run`: 2 Oct 10:50, 5 Oct 16:50 and 7 Oct 10:50 fired and **failed, but the `failed` event was never delivered**; 4 Oct 16:50 **never fired at all**. Only a schedule-based check sees all four; only the outbox recovers the first three.

---

## 1. Problem statement

MA-OCT-001 built the control plane (5 `ops_*` tables, Access-gated admin, ingest contract v1) and proved one local emitter. The fleet is still invisible:

- **The registry holds 2 of 49 jobs.** Schedules are compared by hand from tomls and plists.
- **Nothing runs on a clock that alerts.** The only watchdog (`health-check`) has not run since 22 Aug; nobody noticed for six weeks (F5, KI 22.30). It cannot be revived as-is: its script self-unloads after a hard-coded 29 Aug checkpoint (D1-2).
- **Failures are the events most often lost.** Since go-live (2 Oct 10:50 → 7 Oct 16:53 UTC, boost run and heartbeat logs, cross-checked with EXPLAIN pack P4): 12 slots, 11 fires, **1 slot missed with no trace** (4 Oct 16:50), **4 fires failed** with wrangler error 10000 (**about 1 slot in 3**, F6), and **3 of those 4 `failed` events were never delivered** — Ops saw only 1 of the 4 failures. Two late fires (4 and 5 Oct, 11:02 UTC) did no Phase 3 work but reported `success` (KI 22.47).
- **Four Workers expose unauthenticated run routes:** bootstrap `/trigger` (KI 22.35), entities-delta `/run` (KI 22.36), entities-seed `/run` and entities-figi `/run` + `/rematch` (KI 22.49, found by the independent review). The seed and figi routes are guarded only by `hold_all_jobs` and a budget check that reads the weekday-blind `writes_today_<date>` counter, so an anonymous weekday seed run could write up to ≈ 61k rows.
- **`meridian-ops` has 1 route of headroom;** 003 and 004 need about 8–10.

## 2. Goals (measurable)

| # | Goal | Measure | Target |
|---|---|---|---|
| G1 | Every job is registered | `ops_job_registry` rows vs manifest | 49/49 (47 manifest + enrich split + `ops.ingest`) |
| G2 | No silent miss while the Mac is in use | A missed slot, lost run or failed run of an emitting job becomes an `ops_exception` row | Within the next sweep (≤ 6 h awake); 100% |
| G3 | No permanently lost local event | Terminal events in the boost run log vs `ops_job_run` | 100% within one later run (pilot today: 8/11) |
| G4 | Drift is visible | Intended vs effective schedule per cron Worker | 5/5 cron Workers compared (002b); KI 22.1 and DST test cases pass |
| G5 | Route headroom for 003/004 | `meridian-ops` endpoints after the split | ≤ 7 of 15 |
| G6 | No anonymous run routes | Unauthenticated bootstrap `/trigger`; delta, seed and figi `/run`; figi `/rematch` | 404 (bootstrap) / 401 (the other five), before 17 Oct |

## 3. Non-goals

- **`ma-ops.js` and any console UI** — MA-OCT-005. 002 exposes data on the admin read only.
- **Exception and DQ workflows** (assign, transition, resolve, migration of `entity_exceptions`) — 003/004. 002 only *raises* rows, with 001's dedupe keys, so 003's later auto-raise is a no-op.
- **Any change to 011's runner**, and any Entities-Worker or boost change during a GO'd 011 run (17–23 Oct).
- **Retiring the bootstrap cron** (Founder Q3, 26 Sep = keep) and **any new cron slot** (5/5).
- **Paid-plan features, third-party schedulers or email services** (CLAUDE.md premises).

## 4. User stories

- As the **Founder**, I want a notification on my Mac when a scheduled job missed its slot, failed or stalled, so that I learn in hours rather than after weeks (F5).
- As the **Operations Lead**, I want every job with its owner, schedule, kill switch and write guard in one registry, so that I stop reconciling tomls and plists by hand.
- As the **Operations Lead**, I want intended and effective schedules compared automatically, so that a Cloudflare day-of-week or DST surprise (KI 22.1) is caught on day one.
- As the **Data-Identity Lead**, I want planned pauses honoured, so that the 011 boost pause does not page anyone.
- As the **ETF Product Lead**, I want a warning when a Sunday holdings run approaches the 80k guard and a pass-cycle freshness figure, so that coverage risk is visible before a partial run.
- As the **Architect**, I want governance routes out of `meridian-ops`, so that the control plane can grow in 003/004 without breaking the 15-route rule.
- **Edge cases:** the Mac asleep at a slot (late, not missed, if it fires after wake); the Mac off (missed); a job with no emitter yet (`unobserved`, never `missed`); the sweep itself dead (visible only when someone looks — §7.5).

---

## 5. Phasing

### 5.1 002a — must-have, build ≤ 4 days

Build days: **Fri 9, Sat 10, Tue 13, Wed 14 Oct**, with Thu 15 as buffer. Nothing on Sun 11 04:00–07:00 UTC or Mon 12 (006/011 gate day; seed 04:00 UTC).

| # | Item | Brief | Unblocks | Consult / sign-off | Est. |
|---|---|---|---|---|---|
| A1 | Registry population + `registry-sync` (§6.1) | 1 | **003, 004** (cases link to `job_id`) | — | 0.5 d |
| A2 | Read-time lateness, `ops_job_pause`, planned pauses (§6.3) | 3, (e) | 003 (sweep input); 011 pause | — | 0.75 d |
| A3 | Alerting sweep + health-check revival (§7), incl. ETF interim checks (a)/(c) (§9) | 4, 9(a)(c) | **003** (first `ops_exception` producer) | ETF PL (reads only) | 1 d |
| A4 | Boost-runner bundle: outbox (P0), out-of-window + trigger label, **F7 pre-flight from analytics (removes wrangler from the boost; F6)**; wrangler pin 4.96.0 for FIRDS and read lanes (§8) | 6, 8, (f)(g)(h) | **011 bulk start** (006 Ops N-4) | **Data-Identity Lead ACK** | 0.75 d |
| A5 | Remove bootstrap `/trigger`; gate delta `/run`, seed `/run`, figi `/run` + `/rematch` (§10; KI 22.35, 22.36, 22.49) | 7 | **011** (no anonymous writer during 17–23 Oct) | ETF PL; Data-Identity Lead | **0.5 d** (was 0.25; +¼ d for seed and figi, Founder 8 Oct) |
| A6 | `meridian-control` split (§13) | 11 | **003, 004** (route headroom) | Architect (CR-1) | 0.75 d |

Order inside 002a: A6 → A1 → A2 → A3, with A4 and A5 in parallel on their own owners' sign-off. A6 is a preference, not a dependency: the sweep would be endpoint 15 of 15, which is within the rule (independent review). **A4 and A5 are on 011's critical path** (006 Ops N-4: no bulk start until the outbox is live; KI 22.49: no anonymous writer during the run). **If time is short, A4 and A5 go before A6**; A6 only gates 003/004, which start after 15 Oct.

### 5.2 002b — can follow (from Thu 15 Oct; Entities changes only outside 17–23 Oct)

| # | Item | Brief | Depends on |
|---|---|---|---|
| B1 | Effective schedules via the Workers-Read token; drift rule live; direct trigger listing (§6.2) | 2, 9(d) | **Founder token** |
| B2 | Worker heartbeats: holdings, seed, enrich phase1 / phase23, bootstrap (§12) | 5 | ETF PL; Data-Identity Lead; 1042 test |
| B3 | ETF items (b) per-ETF write cost, (c) full pass-cycle metric (§9) | 9(b)(c) | B2 holdings emitter |
| B4 | KI 22.14 (enrich counter → analytics budget source); FIRDS fallback if 10000 persists after the pin (§15). F7 for the boost moved to A4. | 8 | Data-Identity Lead |
| B5 | KI 22.39 migration (§14) | 10 | Data-Identity Lead, ETF PL; after 011 |
| B6 | financialfact-backfill: registry `held`, revisit in November (Founder Q3) | — | — |

---

## 6. Registry, schedules and lateness

### 6.1 Registry population and how it stays current (A1)

**Source.** `claude/MA-OCT-000_job_manifest.json` (47 jobs). Mapping into 001's `ops_job_registry` columns, with **no schema change** to that table:

| Registry column | From | Rule |
|---|---|---|
| `job_id` | `job_id` | Two corrections: the duplicate `manual.gleif-seed` (untracked `13F Seed/gleif-seed.js`) loads as **`manual.gleif-seed.13f-seed`** (D1-4); `cf.meridian-entities-enrich` loads as **`.phase1`** (`0 6 * * *`) and **`.phase23`** (`50 6 * * *`), and the un-phased id is not created. |
| `domain`, `owner_role`, `source_path`, `worker_name` | manifest | `owner_role` = `proposed_owner_role` |
| `execution_mode` | manifest | Normalised to 001's vocabulary: `cron`, `on_request`, `local_schedule`, `manual`, `retired`, `control` |
| `status` | derived | `active`; **`held`** for `cf.meridian-entities-delta` (cron commented out) and `local.financialfact-backfill` (Founder Q3); **`retired`** for `cf.meridian-firds` |
| `intended_schedule` | toml / install script / plist | Typed JSON (§6.2) |
| `emitter_id` | — | Set only where an emitter exists or is built in 002: `boost-local` (exists), `health-check-local` (A3); Worker emitters in B2 |
| `expected_max_duration_s` | default table | holdings, seed, enrich, bootstrap 900; boost and health-check 120; firds, financialfact 3,600 |
| `kill_switch_ref`, `write_budget_profile` | manifest `kill_switch`, `write_guard` | Copied as text / JSON |
| `notes` | manifest `notes` | Truncated to 500 characters |

**Load.** A new local tool `App/Ops/tools/registry-sync.mjs` reads the manifest, every `wrangler*.toml` `[triggers]`, the install scripts (`FIRE_HOURS_UTC`, launchd `Weekday`/`Hour`) and, when run on the Mac, the installed plists. It **generates** `App/Ops/migrations/registry-load-<date>.sql`:

- `INSERT OR IGNORE` for each new job (the two existing rows are untouched);
- for a changed field on an existing row, one guarded `UPDATE ops_job_registry SET <field>=?, updated_at=… WHERE job_id=? AND <field> IS NOT ?`, plus an `ops_case_event` row (`subject_type='ops_control'`, `event_type='registry_updated'`, old and new value in the payload). This is 001's switch-toggle precedent; `ops_job_registry` is Ops-owned configuration and `meridian-ops` stays its only *service* writer.

The Operations Lead reviews the generated file, then the build lane runs it once with `wrangler d1 execute --remote --file`. Re-running the tool afterwards must produce an **empty diff** (AC-a1).

**Staying current.**
1. **Rule:** any change that edits a `[triggers]` block, an install script's schedule, a plist, or adds or retires a runner must attach the `registry-sync` diff to its build brief and run it in the same release. Added to the release checklist.
2. **Backstop:** the sweep compares intended schedules held in the registry with effective Cloudflare triggers daily (B1), so a missed sync shows up as drift within a day.

### 6.2 Intended vs effective schedules and the drift rule (definitions in A1/A2; live comparison B1)

**Intended schedule JSON** (one of three kinds):

```json
{"kind":"cf_cron","exprs":["0 4 * * sun"],"tz":"UTC"}
{"kind":"launchd_calendar","tz":"Europe/London","entries":[{"hour":11,"minute":50},{"hour":17,"minute":50}],
 "utc_targets":["10:50","16:50"],"installed_utc_offset":"+01:00"}
{"kind":"none"}
```

- **Cloudflare semantics, not cron-standard:** the evaluator treats a numeric day-of-week as **1 = Sunday … 7 = Saturday** (KI 22.1). Named days are preferred, and any numeric day-of-week in a toml raises the drift warning `numeric_dow`.
- **launchd semantics:** `StartCalendarInterval` fires in local wall-clock time. A missed fire while asleep runs **once on wake**; while the Mac is shut down it is skipped. Local jobs keep the installer's UTC targets beside the installed local entries, so DST can be detected.

**Effective schedule (B1).** The Founder's Workers-Read token is stored as the `meridian-ops` secret `CF_WORKERS_READ_TOKEN`. The sweep calls `GET /accounts/{id}/workers/scripts/{name}/schedules` for the 5 registered cron Workers (5 subrequests per sweep, no D1 reads) and writes `effective_schedule` only when it changes (guarded `UPDATE` + audit row; about 0 writes on a normal day). This also delivers ETF item **(d) direct trigger listing**.

**Drift rule.** Compare the normalised intended set with the normalised effective set per job:

| Drift type | Condition | Severity |
|---|---|---|
| `expr_mismatch` | Both exist, sets differ after normalisation (names ↔ CF numbers) | sev2 |
| `missing_trigger` | Intended cron, no effective trigger | sev2 |
| `unexpected_trigger` | Effective trigger on a job whose intended kind is `none` or whose status is `held` (e.g. entities-delta reactivated) | sev2 |
| `numeric_dow` | Intended expression uses a numeric day-of-week | sev3 |
| `dst_shift` | Local job whose installed local entries no longer map to its `utc_targets` at today's UTC offset | sev3 |
| `not_deployed` | Registry `active` cron Worker missing from the account | sev2 |

**Test cases (AC-b1):**
- **T-D1 (KI 22.1):** intended `0 4 * * 1` with "Monday" in the toml comment → the evaluator resolves Sunday 04:00 UTC and raises `numeric_dow`; replayed against the 000 evidence it reproduces the Sunday co-fire.
- **T-D2 (DST, 25 Oct):** boost installed at local 11:50/17:50 with offset +01:00 → from Sun 25 Oct (+00:00) the slots fall at 11:50/17:50 UTC and `dst_shift` is raised until the install script is re-run (Data-Identity Lead, after 23 Oct). FIRDS (Sun 11:00 local) is reported at sev4 only (its target is "after FULINS publishes", so either offset is acceptable).

**Where it is served.** Drift is new Ops data, so it is **Access-only** (001 §6.1): an additive `drift` array on `GET /api/ops/admin/jobs` (no new route). The legacy public `GET /api/ops/drift` compares `releaseledger` deploy and push status (`ops-api.js:319`), moves with the governance routes to `meridian-control` (§13), and keeps its name and meaning (**ruling D1-1**).

### 6.3 Lateness, lost runs and planned pauses (A2)

**Slots.** For each `active` job with an intended schedule, generate the expected slots inside the lookback window (default 7 days, maximum 14). Cron Workers use the effective schedule once B1 is live and it agrees with intended; otherwise intended.

**Matching runs to slots.** A run belongs to slot `S` if its `detail.slot` equals `S` (the boost already sends it), else if `started_at` falls in `[S − 5 min, S + grace]`. Runs with `trigger = 'contract-test'` (the 4 MA-OCT-001 AC6 rows of 1 Oct 05:52 UTC, EXPLAIN pack P3/P4) and `trigger = 'manual'` runs outside any slot window are never matched to a slot.

**Detection is driven by the schedule, not by received events (OB-2).** A slot with no matching run becomes `missed` after its grace whether or not anything ever arrived. Replayed events (§8.1) can later turn a `missed` slot into `failed` or `success`; the `job_missed` case already raised stays for 003 to close with the replayed outcome as its resolution. On the 2–7 Oct history this yields 4 `missed` slots before replay (2 Oct 10:50, 4 Oct 16:50, 5 Oct 16:50, 7 Oct 10:50) and 1 after replay (4 Oct 16:50).

**Per-slot state:**

| State | Rule |
|---|---|
| `on_time` | Matching run started ≤ `S + on_time_tol` |
| `late` | Matching run started after `S + on_time_tol` and ≤ `S + grace` |
| `missed` | No matching run, and now > `S + grace` |
| `pending` | No matching run yet, now ≤ `S + grace` |
| `paused` | `S` falls in an `ops_job_pause` window, **or** the job's status is `held`, **or** the run's end event is `skipped` with `reason='pause'` |
| `unobserved` | The job has no `emitter_id` (it cannot report) — **never** `missed` |

The run's own outcome (`success / partial / skipped(reason) / failed / killed`) is shown beside the slot state. A late boost fire that is skipped with `reason='out_of_window'` is `late` + `skipped(out_of_window)`: it is counted, not raised, because it already appears in the daily summary metric.

**Per-run state:** `running` (start, no end, age ≤ `expected_max_duration_s`); **`lost`** (start, no end, age > `expected_max_duration_s` + 300 s — the CPU/wall kill case, 001 §7.2); `end_only` (terminal with no start, shown as received).

**Per-job state:** **`frozen`** when the last 3 runs that ended `success` or `partial` report the same non-null `cursor_after`, **or** `items_attempted > 0` with `items_progressed = 0` (F4 signature). Holdings uses the pass-cycle metric instead (§9).

**Grace table** (stored in `intended_schedule` as `on_time_tol_s` and `grace_s`; defaults below):

| Job | Slot | On-time tolerance | Grace |
|---|---|---|---|
| `cf.meridian-holdings` | Sun 04:00 UTC | 10 min | 2 h |
| `cf.meridian-entities-seed` | Mon 04:00 UTC | 10 min | 2 h |
| `cf.meridian-entities-enrich.phase1` / `.phase23` | 06:00 / 06:50 UTC daily | 10 min | 1 h |
| `cf.meridian-bootstrap` | every 4 h | 10 min | 1 h |
| `local.entities-enrich-boost` | 10:50 / 16:50 UTC (DST-aware) | 9 min (the :50–:59 Phase 3 window) | 3 h (Mac wake) |
| `local.firds-weekly-seed` | Sun 11:00 local | 30 min | 12 h |
| `local.health-check` (the sweep) | 4 local slots (§7.1) | 15 min | 8 h |

**Planned pauses: new table `ops_job_pause`.** Domain **Ops** (owner Operations Lead; only service writer `meridian-ops`; until an admin route exists in 005, rows are written by a reviewed `wrangler --file` batch with an `ops_case_event` row, as for kill switches).

```sql
CREATE TABLE IF NOT EXISTS ops_job_pause (
  pause_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      TEXT NOT NULL,          -- ops_job_registry.job_id
  starts_at   TEXT NOT NULL,          -- ISO-8601 UTC
  ends_at     TEXT NOT NULL,          -- ISO-8601 UTC, exclusive
  reason      TEXT NOT NULL,          -- e.g. 'MA-OCT-011 run window (Founder GO 12 Oct)'
  created_by  TEXT NOT NULL,          -- verified identity or 'ops_lead:wrangler'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_ops_job_pause_job_end ON ops_job_pause(job_id, ends_at);
```

Rows: a handful a month; kept forever (audit); < 1 KB a year. **011 pause (dated release task, §18):** if 011 is GO on 12 Oct, the **Operations Lead** inserts one row for `local.entities-enrich-boost`, `2026-10-17T00:00Z` → `2026-10-24T00:00Z`, **by Fri 16 Oct** (011 rev 1.6 §11 and its Fri 16 Oct release check depend on it). It needs the A2 migration (Sat 10). The runner's own pause flag also emits nothing (Data-Identity condition: paused = no network), so without this row the week would show 14 `missed` slots — the row is what prevents it.

**Queries (read cost; plans in §11.2):**
- **L1 fleet** = 001's Q4 (registry scan ≤ 60 rows + 4 indexed searches per job), unchanged: about 250 rows at 49 jobs.
- **L2 recent runs** for each job with an emitter: `SELECT run_id, phase, event_type, started_at, ended_at, cursor_after, items_attempted, items_progressed, detail FROM ops_job_run WHERE job_id = ? AND started_at >= ? ORDER BY started_at` → `idx_ops_job_run_job_at`. 7 days: boost ≈ 28 rows, health-check ≈ 56; with 002b Workers ≈ 200 in total.
- **L3 pauses:** `SELECT job_id, starts_at, ends_at, reason FROM ops_job_pause WHERE ends_at >= ?` → full scan of a table of a few rows; declared, bounded (≤ 100 rows by retention review).

The lateness computation runs in the Worker. `GET /api/ops/admin/jobs` gains additive fields `slots`, `job_state`, `drift`; `?lookback_days=` (≤ 14).

---

## 7. Alerting sweep — the clock (A3)

### 7.1 Caller: the revived `health-check` LaunchAgent

Founder Q3 (26 Sep) kept the bootstrap cron, so the clock is local (001 spec §9 fallback (a)). No cron slot is used (5/5).

**Why it is dead today (D1-2, D1-3).**
- Its plist is correct (points at `Clean (v11)/13F Seed`, full PATH; Founder check 3 Oct).
- launchd fires it on time daily but refuses to start the process: `xpcproxy` logs `Launch constraint set…`, launchd logs `service inactive` within milliseconds, `last exit code = 78: EX_CONFIG` (Founder `log show`, 1–3 Oct). `backgroundtaskmanagementd` tracks both 13F Seed agents. Leading cause: both are switched **off** under System Settings → General → Login Items → *Allow in the Background*. Not yet confirmed.
- Even if started, the script would unload itself on its first run: `CHECKPOINT_DATE = 2026-08-29`.

**Revival, in this order (CR-4):**
1. **Confirm the cause** (read-only): Login Items list, or `sfltool dumpbtm`. Check the boost and FIRDS entries at the same time.
2. **Change the script** `13F Seed/check-pipeline-health.js` (path and label unchanged, so the Founder-known control surface stays):
   - `CHECKPOINT_DATE` → **2026-12-31** (Founder Q1). The financialfact-complete condition is removed (that job is retired for October).
   - Replace its direct D1 REST reads (`CF_API_TOKEN`) with **one call to the sweep route** (§7.2). The sweep returns `hold_all_jobs`, headroom and the new findings, so the script no longer needs the account D1 token.
   - Report its own run as job `local.health-check` (emitter `health-check-local`): `start` and terminal events through the existing ingest, with the 2 s ceiling and the outbox (§8.1).
   - Notify (§7.4).
3. **New control surface** (CLAUDE.md requirement for local jobs): `App/Ops/scripts/health-check-{install,pause,resume,status,uninstall}.sh`, modelled on the boost scripts — explicit `PATH`, TCC note, pause flag `13F Seed/.health-check-paused`, `launchctl bootout` for the hard stop. The install script writes the plist.
4. **Cadence:** 4 local slots a day — **08:00, 12:00, 18:00, 22:00**. Detection lag while the Mac is awake is therefore ≤ about 6 h; after a sleep, launchd runs one catch-up fire on wake.
5. **Founder step:** switch the item on under *Allow in the Background*, then one supervised `launchctl kickstart -k` with the log checked (AC-a3).

### 7.2 The sweep route

`POST /api/ops/ingest/sweep` on `meridian-ops`. Auth: the 001 per-emitter key (`X-Ops-Emitter: health-check-local`, `X-Ops-Ingest-Key`); the registry row `local.health-check` must name that emitter. Body: `{"v":1,"run_id":"…","lookback_days":7}`.

**Server steps** (each exits early; budget in §11):
1. `OPS_SWEEP_ENABLED` var (hard switch, 0 D1 reads) → 202.
2. Authenticate; registry switch (`ingest_enabled` on `local.health-check` and `ops.ingest`) → 202 if off.
3. **Fleet and lateness:** L1, L2, L3 (§6.3).
4. **Platform checks:** `hold_all_jobs` (1 PK read of `holdings_pipeline_state`, read-only); D1 headroom (existing `cfD1WritesToday()`, 1 subrequest); ETF checks (a) and (c) interim (§9, 3 PK reads); effective schedules (B1, 5 subrequests, once a day).
5. **Raise** (below), capped at **20 new exceptions per sweep**; any excess becomes one `sweep_overflow` exception.
6. Return `{ok, hold_all_jobs, headroom, new:[…], open_counts:{sev1,sev2,sev3}, rows_read}`.

**What it raises.** Exception types are Worker-validated (001 §5.1, vocabulary extendable by 003). The sweep **never updates or closes** a case; transitions belong to 003.

**Raise contract (R-E; 003 builds its auto-raise on it).** Each raise is two statements in one `db.batch()`:
1. `INSERT OR IGNORE INTO ops_exception (case_ref, dedupe_key, …) VALUES (?, ?, …)` with a **deterministic, unique `case_ref` derived from `dedupe_key`**: `'EXC-S-' || upper(first 12 hex chars of SHA-256(dedupe_key))` (48 bits; computed in the Worker with `crypto.subtle.digest`). The same finding therefore always produces the same `case_ref`, so a `case_ref` hit and a `dedupe_key` hit coincide and no distinct finding can be silently swallowed by a `case_ref` collision. Human-created cases (003) keep the `EXC-000001` sequence; the `EXC-S-` prefix keeps the two spaces apart. **Collision guard:** if the insert reports `changes = 0`, the Worker re-reads the row by `dedupe_key` (S1, 1 read); if no row has that `dedupe_key`, the `case_ref` collided with a different finding, and the Worker retries once with 16 hex chars and logs the event.
2. `INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key) SELECT 'exception', CAST(exception_id AS TEXT), 'raised', 'service:health-check-local', 'ingest_key', ?, ? FROM ops_exception WHERE dedupe_key = ?` with **`idempotency_key = 'raised:' || dedupe_key`** (the column is `UNIQUE`, `002-ops-control-plane.sql`). The audit row is written once per finding, not once per sweep, so the append-only table does not grow 4× a day for a persisting condition.

**Daily raise cap without an extra read (build-brief note, §19.5 B-1).** The script's own end event carries `detail.metrics.raised` (the count the route returned). The route sums `raised` over today's `local.health-check` end events, which L2 already reads, and adds the current call: 0 extra reads.

| `exception_type` | Raised when | `dedupe_key` | Severity |
|---|---|---|---|
| `job_missed` | A slot is `missed` | `job_missed:<job_id>:<slot>` | sev3; sev2 for weekly jobs (holdings, seed, firds) |
| `job_lost` | A run is `lost` | `job_lost:<run_id>` | sev2 |
| `job_failed` | A terminal `failed` or `killed` event | `job_failed:<run_id>` (001 §7.4 key, so 003's auto-raise is a no-op) | sev3; sev2 at ≥ 3 consecutive |
| `job_frozen` | A job is `frozen` | `job_frozen:<job_id>:<cursor>` | sev3 |
| `hold_active` | `hold_all_jobs = true` | `hold_active:<UTC date>` | sev2 |
| `budget_risk` | Headroom < 5,000 (sev1), or holdings Sunday writes ≥ 75,000 (sev3, §9) | `budget_risk:<kind>:<UTC date>` | as stated |
| `schedule_drift` | Any drift (§6.2), B1 | `schedule_drift:<job_id>:<type>:<expr hash>` | per §6.2 |
| `sweep_overflow` | > 20 new in one sweep | `sweep_overflow:<run_id>` | sev2 |

`run_snapshot` is filled for run-linked types (survives the 180-day prune).

### 7.3 Run-time gates for the sweep (three-point check, recurring process)

| Gate | Rule |
|---|---|
| **Hold** | The sweep does **not** obey `hold_all_jobs`: it only reads and raises, and a hold is itself a finding (same reasoning as 001 §8.4). |
| **Budget** | ≤ 20 raises per call → ≤ about 250 row-writes per sweep, ≤ 1,000 a day at 4 sweeps. Reads ≤ 1,000 per call (§11). The 001 ingest daily cap does not count sweep raises; the per-call cap does. |
| **Kill switches** | (1) `OPS_SWEEP_ENABLED="false"` + deploy (0 reads); (2) `ingest_enabled=0` on `local.health-check` (no deploy); (3) local pause flag; (4) `health-check-uninstall.sh`. |
| **Recovery** | Stateless. Each sweep looks back 7 days, so missed sweeps need no backfill and a Mac that was away for up to a week is fully re-evaluated on its first sweep. Wrongly raised cases are closed in 003 (until then by a guarded wrangler `UPDATE` with an audit row). |

### 7.4 Notification channel (Founder Q2 = macOS notification only)

- One native macOS notification per sweep, only when the sweep returns **new** sev1–sev3 exceptions (dedupe makes a repeated condition silent). Text: count by severity and the first three titles.
- The 18:00 sweep adds one daily line when open sev1/sev2 cases exist, even if none are new.
- Clean sweeps are silent (the script's existing low-noise rule).
- `ops_exception` rows are the system of record; the notification is only a pointer.
- Email is deferred: sending from a Worker needs Cloudflare Email Routing on a custom domain, and the account serves from `workers.dev` only.

### 7.5 What Ops can and cannot see

| Situation | Recorded? | Alerted? |
|---|---|---|
| Cloudflare Worker runs while the Mac sleeps (002b emitters) | Yes, in `ops_job_run` | On the next sweep after wake |
| Local job fires late after wake | Yes (`late`) | Not alerted unless it fails or is skipped repeatedly |
| Mac shut down through a local slot | No run exists | `job_missed` on the next sweep |
| Mac shut down or away for days | Cloudflare runs recorded; local slots missed | All raised together on the first sweep after return (≤ 7-day lookback; older history is visible on the admin read but not raised) |
| **The sweep itself is dead** | Its own `local.health-check` slots show `missed` | **Not alerted** — nothing else runs on a clock. Visible only when someone opens the admin read or 005's console ("sweep last ran N h ago"). This is the accepted cost of Founder Q3. |
| Ops Worker unreachable | Sweep fails; the script logs it and notifies "sweep could not reach Ops" | Yes (local notification) |

**Review question RQ-1 (Architect + ETF PL, not Founder):** the kept bootstrap cron fires every 4 hours. With `status = complete` it does **not** exit at once: `runBootstrap` calls `runWeeklySync()` on every fire (`bootstrap.js:60–62`, `299–345`), which sets `last_run`, re-discovers the SEC fund series list (external fetch), reads `edgar_bootstrap_progress` in full, resolves `NOTICKER_` tickers with `UPDATE etf_master`, and processes up to `BATCH_SIZE` new series into `etf_master`. It is the ETF universe's ongoing sync. Adding a sweep call there would give a cloud-side clock with no new slot, but it adds a subrequest and an Ops dependency to an invocation that already makes external calls and writes an ETF table. Recommended: **defer to B2 with evidence** — decide only after that invocation's real subrequest use is measured (§19.5 B-2), and then only as one `ctx.waitUntil` call **after** the sync finishes, under its own emitter key, with ETF PL sign-off.

---

## 8. Boost-runner bundle: outbox, out-of-window, trigger label, F7 pre-flight; wrangler pin for other runners (A4)

All five changes (§8.1–§8.5) touch `App/Corporate Atlas/entities-enrich-boost-run.mjs` and `scripts/entities-enrich-boost-install.sh`. They ship as **one change (CR-5)**: one Data-Identity Lead ACK, one recorded go-live (save time UTC + first run + commit SHA, per the 1 Oct Main Lane ruling (a)), saved outside 10:50–10:59 and 16:50–16:59 UTC, **live by Wed 14 Oct** (before the 17 Oct freeze and 011's bulk start).

### 8.1 Local outbox (binding from the 001 Architect review, item a)

**Evidence.** In 6 days the pilot lost 3 of 4 `failed` events (2, 5 and 7 Oct; logged `not delivered: TimeoutError`). Every loss came in the same second as a wrangler 10000 failure, and every one was followed within about 6 h by a run whose events **were** delivered. A replay on the next run would have recovered all 3.

**Design.**
- **Spool:** an event that is not delivered (timeout, network error, HTTP 5xx) is appended as one JSON line to `App/Corporate Atlas/logs/ops-outbox/entities-enrich-boost.jsonl` (already gitignored by `App/.gitignore` `Corporate Atlas/logs/`). The line holds the exact event body sent, including `run_id`, `phase` and `started_at`.
- **Not spooled:** 400/401/403/422 (permanent); 202 (switched off on purpose). Logged to the heartbeat log as today.
- **Replay:** on the next run that is not paused, **after** that run's run-log line and its own terminal heartbeat (so `/run` timing and the outcome are untouched), send up to 10 spooled events oldest first, 2 s ceiling each, stopping at the first failure. 201 or `200 duplicate` → delivered; the file is rewritten atomically (temp file + rename) without that line.
- **Expiry:** events with `started_at` older than 6 days (the server rejects > 7) move to `ops-outbox/expired.jsonl` and are logged as a permanent loss — counted, never silently dropped.
- **Idempotent by construction:** 001's `UNIQUE(run_id, phase)` + `INSERT OR IGNORE`. A replay can never double-count.
- **Data-Identity conditions (1 Oct) kept:** (1) run-log lines unchanged in format and written first (one new outcome value, §8.2); (2) heartbeat and outbox output only in the heartbeat log and the outbox files; (3) the pause check stays first and a paused run does no network work, including no replay; heartbeat and replay failures never change the exit code; (4) go-live recorded.
- **Wall-time bound:** a run adds at most 2 s (own terminal event) + 10 × 2 s (replay, only after the outcome is final) and in practice stops at the first failure. The replay never runs before `/run`.

The same outbox helper is used by the revived health-check (§7.1). Worker emitters do not spool (§12).

### 8.2 Out-of-window fires report `skipped` (KI 22.47, item h)

**Evidence.** 4 and 5 Oct fired at 11:02 UTC (Mac woke late), outside the :50–:59 window. Enrich runs Phase 2+3 only at minute ≥ 50, so these calls ran Phase 1 only (which the 06:00 cron already does daily) and did no GLEIF work — yet both reported `success`.

**Change.** When the fire is outside :50–:59 UTC, the runner **does not call `/run`**. It writes run-log outcome `skipped_out_of_window` and sends `skipped` with `detail.reason = 'out_of_window'` (contract v1 enum).

**This supersedes Main Lane ruling (b) of 1 Oct** ("no behaviour change to the runner"; out-of-window fires call `/run` and report what happened). It changes runner behaviour and adds one run-log outcome value, so it needs the **Data-Identity Lead's ACK** (amends condition (1)) and a Main Lane ruling. **Fallback if declined:** keep calling `/run` and send `partial` with `detail.reason = 'out_of_window'`, `items_* = null` — truthful, but the slot still shows as served. Lateness (§6.3) treats either form as `late` + not productive.

### 8.3 Pin the wrangler version (item g; 006 D7-5, Ops N-1)

**Evidence.** The runner calls `npx wrangler d1 execute …`. There is no local wrangler install in `App/Corporate Atlas/`, so `npx` resolves whatever version is cached or newest. On 5 Oct a read lane's `npx` fetched wrangler 4.147.0 against a session created by 4.96.0 and got Cloudflare error 7403. F6 (error 10000) is the same class: 4 of 11 boost fires, first fire of the day in 3 of 4 cases.

**Rule (standing, every local runner and every read lane):**
1. **Pin: wrangler `4.96.0`** — the version of the current OAuth login (Lane 1, 7 Oct: `/usr/local/bin/wrangler` 4.96.0, `whoami` OAuth, account `ea36…b40b`, `d1 (write)`). One repo-wide pin: `App/Corporate Atlas/package.json` gets `"wrangler": "4.96.0"` (exact, no caret) in `devDependencies`, with a committed lockfile and `npm ci`. Upgrading means upgrading the pin and re-logging-in together, as one change with its own note in the Decisions Log.
2. Runners call `./node_modules/.bin/wrangler` by absolute path. **Never `npx wrangler`** and never a bare `wrangler` from `PATH`.
3. Applies to: `firds-local-seed.mjs`, any lane D1 query helper (read lanes use the same pinned binary or `/usr/local/bin/wrangler` after checking it reports 4.96.0, as Lane 1 did), and every future local runner. **The boost runner no longer calls wrangler at all** after §8.5.
4. `*-status.sh` prints the pinned and installed versions; the install script refuses to install if they differ.

**Measure:** boost 10000 rate → 0 by construction (§8.5). FIRDS: 10000 count over the next 4 Sunday runs; if any recur with the pin, B4 (§15) moves FIRDS off wrangler too.

### 8.4 `trigger` label (001 carry-over, item b)

The install script adds `OPS_TRIGGER=launchd` to the plist's `EnvironmentVariables`; the runner uses it when set (`XPC_SERVICE_NAME` is not set to the label by this `/bin/bash -c` agent). Manual runs stay `manual`.

### 8.5 F7 fix: pre-flight headroom from Cloudflare analytics (OB-4; also the boost's F6 fix, OB-5)

**Evidence.**
- The pre-flight reads `writes_today_<date>` from `holdings_pipeline_state` with `npx wrangler d1 execute`. EXPLAIN pack P7 shows those keys exist only for Sundays (holdings) and Mondays (seed) since 28 Sep (`2026-09-27`, `-28`, `2026-10-04`, `-05`). On every other day the runner reads 0 and logs `headroom=100000` (boost log, 2, 3, 6, 7 Oct).
- That wrangler call **is** the step that fails with 10000: all 4 F6 failures since go-live are `headroom check failed: wrangler d1 execute failed`.
- `meridian-ops` `GET /api/ops/cf/d1-today` is live and reports the real account total from Cloudflare analytics: 7 Oct 19:30 UTC `{"rowsWritten": 390, "daily_cap": 100000}` (EXPLAIN pack, HTTP check). It needs no OAuth and no wrangler.

**Change.** The pre-flight calls `d1-today` (public GET, 2 s ceiling, one retry after 2 s) and computes `headroom = daily_cap − rowsWritten`. Same threshold (`REQUIRED_HEADROOM = 5,000`), same place in the flow (after the pause check, before `/run`), same run-log fields (`writes_today=` now carries the analytics figure). If the route is unreachable or not `ok`: run-log outcome `error`, `failed` with `error.class = 'headroom_unavailable'`, no `/run` — the same handling the wrangler failure has today. The `wrangler` code path and its `npx` call are deleted from the runner.

**Analytics lag.** Not yet measured. Build step: record `d1-today` immediately before and after the A1 registry load (≈ 150 known writes) and again after 5 minutes; record the lag in the close-out. **This is a go-live gate for A4:** the runner is not saved until the lag is recorded.

**Second, informational figure (Data-Identity condition, non-blocking).** The run-log line also carries `headroom_80k = 80,000 − rowsWritten`, the headroom against holdings' 80k guard. It never blocks `/run`; the blocking rule stays `daily_cap − rowsWritten ≥ 5,000`. The guard's 5,000 margin against observed weekday totals of hundreds to a few thousand rows (P7 history; 7 Oct = 390) absorbs a lag of minutes. 011 already relies on the same route for its per-batch rule (011 rev 1.6 (`6f9681ab…4513c`) §4.3).

**011's 120 s freshness limit (011 rev 1.6 §4.3).** 011 rejects a `d1-today` figure fetched more than 120 s before a batch or carrying a different UTC date. That limit is about the age of the *fetch*, not the analytics lag. When A4 measures the lag (above), the Operations Lead records it in the close-out and states whether 120 s plus the lag still leaves 011's ≤ 70k ceiling safe (011 batches are far below the 30k gap between 70k and the 100k cap, so a lag of minutes is expected to be adequate). If the measured lag exceeds 10 minutes, it goes to the 011 lane before its Fri 16 Oct release check.

**Why now, not in B4.** It is the same file, the same sign-off and the same go-live as §8.1–§8.4; it removes the single largest cause of lost boost runs (4 of 12 slots) before 011; and it ends the boost's dependence on an ETF-domain key it never maintained.

**011 does not depend on `writes_today`; other writers' blind guards are closed or small (corrected in rev 1.3, R-B).** Cited against 011 rev 1.6 (`6f9681ab…4513c`):
1. 011's runner reads `d1-today` before every batch, requires account total + unpolled 011 rows + batch ≤ 70,000 and 011's day total + batch ≤ 25,000, and **fails closed** if the figure is unavailable or older than 120 s (§4.3, §7).
2. The boost is paused 17–23 Oct and sends nothing while paused; the week is marked by the `ops_job_pause` row (§8, §11).
3. 011 never runs on Sunday, on Monday before 08:00 UTC, or in the enrich windows (§4.4) — the only days the counter is written.
4. **Blind guards of other writers during the window**, and how each is handled:

| Writer | Guard reads | Status during 17–23 Oct |
|---|---|---|
| Enrich cron (06:00, 06:50) | `writes_today` (blind on weekdays, KI 22.14) | Small (Phase 3 caps at 44 entities, P7); 011 avoids 05:50–07:10; inside 011's analytics total. Stays in 002b. |
| **Seed `/run`** (on request) | `writes_today` (blind) | **Anonymous until A5** — could write ≈ 61k rows. **Closed by A5 / CR-7b before 17 Oct** (Founder 8 Oct, KI 22.49). |
| **Figi `/run`, `/rematch`** (on request) | `writes_today` (blind) | **Anonymous until A5. Closed by A5 / CR-7b before 17 Oct.** |
| Delta `/run` (on request) | `writes_today` (blind) | Anonymous until A5; closed by CR-7. |
| Holdings (Sun 04:00) | Its own counter (holdings + seed only) | Not in 011's days. |

So 011 is protected by its own fail-closed `d1-today` gate, **provided A5 is live before 17 Oct**. If A5 slips past Fri 16 Oct, KI 22.49 is an open risk to 011 and goes to the Founder before the run.

**011 lane note (closed):** the rev 1.2 wording that a paused boost "reports `skipped/pause`" is corrected in 011 rev 1.6 (`6f9681ab…4513c`) §8 (a paused boost sends nothing; the `ops_job_pause` row marks the week).

### 8.6 Data-Identity Lead conditions on ML-1 and CR-5 (binding)

**(a) ML-1 — out-of-window fires (§8.2):**
1. The run-log line is written **first**, before any heartbeat.
2. `skipped_out_of_window` is the **only** new run-log outcome value; all existing values and the line format are unchanged.
3. The line keeps the existing **3-field layout** (`<UTC timestamp> | <outcome> | <detail>`) and carries `utc_minute=<n>` and `in_window=false` in its detail field.
4. The Phase 3 window stays **:50–:59 UTC, inclusive**.
5. The pause check stays **first**; while paused the runner does **no network work** (no heartbeat, no replay, no `d1-today` call).
6. An out-of-window skip **exits 0**.

**(b) CR-5 — the boost-runner bundle:**
1. **Replay** runs only **after** the run's own run-log line **and** its own terminal heartbeat (§8.1).
2. The spool lives under **`App/Corporate Atlas/logs/ops-outbox/`**, which is gitignored (`App/.gitignore`: `Corporate Atlas/logs/`).
3. **Expired** outbox events are **counted** (moved to `expired.jsonl` and logged), **never dropped silently**.
4. The wrangler pin (4.96.0) also covers **`firds-local-seed.mjs`**.
5. `package.json` and its **lockfile** live in **`App/Corporate Atlas/`** (both files exist today; `wrangler` is added as an exact `devDependency`).
6. The install and status scripts **refuse** on a version mismatch (pinned ≠ installed).
7. The **`d1-today` lag is measured before go-live** (§8.5 gate).
8. If `d1-today` is **unreachable or not `ok`**: run-log outcome **`error`**, heartbeat `failed` with `error.class = 'headroom_unavailable'`, and **no `/run`** (§8.5).
9. **One recorded save** (UTC time, first run, commit SHA), never within 10:50–10:59 or 16:50–16:59 UTC, and **live by Wed 14 Oct**.
10. The pre-flight also computes headroom against the **80k guard** (`headroom_80k`), non-blocking (§8.5).

Any change to these conditions needs a new Data-Identity Lead ACK.

## 9. ETF items from the MA-OCT-012 reviews

| Item | 002a (interim, read-only) | 002b (full) |
|---|---|---|
| **(a) Sunday write baseline** 70,672; warn ≥ 75k | The sweep reads `writes_today_<last Sunday>` (1 PK read of `holdings_pipeline_state`) on Sundays and Mondays; ≥ 75,000 → `budget_risk` sev3; ≥ 80,000 (the guard) → sev2 | Holdings end event carries `rows_written` and `detail.metrics.writes_today_after` |
| **(b) Per-ETF write cost** | — | Holdings end event carries `detail.per_etf = [{t, w}]` (≤ 20 entries, ~600 bytes, inside the 2 KB cap). Predicted cost of the next batch = sum of last observed costs for the next 20 ETFs; warn when prediction + baseline headroom < 5,000 |
| **(c) Pass-cycle freshness** (~12-week full pass) | The sweep reads `etf_offset` and `last_run_status` (2 PK reads) and reports `offset/total` and an estimate `weeks_to_complete = (total − offset) / 20` | From B2 history: weeks since the last `complete:` end event; `frozen` if the offset did not advance on a Sunday run |
| **(d) Direct trigger listing** | — | B1 (§6.2) |

All reads of `holdings_pipeline_state` are read-only point lookups on its primary key (`key TEXT PRIMARY KEY`, `schema-phase1-holdings.sql:41`). Ops never writes ETF-domain tables.

---

## 10. Security gating (A5)

| Route | Today | Change | Owner sign-off | Test |
|---|---|---|---|---|
| `meridian-bootstrap` `/trigger` (KI 22.35, N1) | Any GET/POST runs `runBootstrap` via `waitUntil`, unauthenticated | **Remove** the branch; every path returns 404. The cron already runs `runWeeklySync()` every 4 hours (SEC series discovery, a full read of `edgar_bootstrap_progress`, `etf_master` ticker updates and new-series inserts; `bootstrap.js:60–62`, `299–345`), so no manual trigger is needed — and an anonymous trigger lets anyone start that work. The cron path is untouched. If a manual trigger is ever needed, re-add it behind `RUN_AUTH_SECRET`. | **ETF Product Lead** (CR-6) | `/trigger` → 404; cron still fires (`runWeeklySync` sets `edgar_bootstrap_state.last_run` first, so it advances at the next 4-h slot). Deploy away from the minute of a 4-h fire (00/04/08/12/16/20:00 UTC) |
| `meridian-entities-delta` `/run` (KI 22.36, N4) | Any request to `/run` starts `runDelta` (never run in production, KI 22.34) | **Gate** with a Worker secret `RUN_AUTH_SECRET` (`Authorization: Bearer <secret>`): **fail closed** — if the secret binding is missing (`!env.RUN_AUTH_SECRET`) or the header does not match, return 401 before any D1 read. Comparison is constant-time (hash both values with `crypto.subtle.digest` and compare the digests); note that enrich's existing check uses `!==` and is not the model here. Secret only via `wrangler secret put`; local copy in gitignored `.env.entities-delta-run`. Kept (not removed) because KI 22.34 reactivation is its own future packet. **Build path: §10.2, option (ii) (Data-Identity Lead, L6-1).** | **Data-Identity Lead** (CR-7) | No secret / wrong secret → 401, and `delta_last_run` still absent afterwards. **The authorised path is tested only locally (`wrangler dev`), never against production** — a remote authorised call would run delta. |
| `meridian-entities-seed` `/run` (KI 22.49) | Any request to `/run` runs the seed after `hold_all_jobs` and a `writes_today` budget check (blind on weekdays); up to ≈ 61k logical rows (`entities-seed.js:489`) | **Gate** exactly as delta: own `RUN_AUTH_SECRET`, fail closed, 401 before any D1 read; local copy in gitignored `.env.entities-seed-run`. The Monday cron (`0 4 * * mon`) is untouched. No code or script in the repo calls this route (grep, 8 Oct). | **Data-Identity Lead** (CR-7b) | No secret / wrong secret → 401 (×2); no seed write follows (seed run state unchanged). Authorised path only under `wrangler dev`. |
| `meridian-entities-figi` `/run`, `/rematch` (KI 22.49) | Both routes run after `hold_all_jobs` and a blind `writes_today` check (`entities-figi.js:404`); `/rematch` takes `?limit=` up to 5,000 | **Gate** both routes as delta: own `RUN_AUTH_SECRET`, fail closed, 401 before any D1 read; local copy in gitignored `.env.entities-figi-run`. No other change. No code in the repo calls these routes (grep, 8 Oct). | **Data-Identity Lead** (CR-7b) | `/run` and `/rematch` each: no secret / wrong secret → 401 (×2 each). Authorised paths only under `wrangler dev`. |

Deploy rules: not Sun 04:00–07:00 UTC, not Mon 03:30–05:00 UTC; delta not 17–23 Oct. Neither change adds a D1 query, so the three-point check is "no change".

### 10.1 Data-Identity Lead conditions on CR-7 and CR-7b (delta, seed and figi gates, binding)

From the Data-Identity Lead's 8 Oct CR-7 ACK (Decisions Log, 8 Oct), applied to seed and figi by the Founder's 8 Oct decision ("same conditions pattern as CR-7"), and **ACKed for seed and figi with conditions C1–C6** (`claude/relays/LANE-6_REPORT.md` `54ac356e…f972`, ruling L6-2). Items 1–5 below are the CR-7 conditions; C1–C6 follow and bind all three Workers.

1. **Auth gate only** — no other change to the Worker: no cron change, no logic change, **MA-SEP-009 Bug 2 untouched** (delta). The commented-out delta cron stays commented; the seed's Monday cron is unchanged.
2. **Confirm deployed source = repo first** (each Worker), and follow §10.2 if they differ. Stop and report on any unexplained difference.
3. **Remote tests are unauthorised only**: no secret and wrong secret → **401 ×2** per route, and the job's state is unchanged afterwards (delta: **`delta_last_run` still absent**; seed and figi: no run recorded). Authorised paths are tested only under `wrangler dev`.
4. Secrets are set with **`wrangler secret put`**, one per Worker; local copies in gitignored `.env.entities-<worker>-run` files; **never logged** (not in console output, run logs, close-out or chat).
5. Deploy **not 17–23 Oct, not Sun 04:00–07:00 UTC, not Mon 03:30–05:00 UTC** — so in practice **by Fri 16 Oct** (seed: also not within its Monday 04:00 run).

**Data-Identity Lead conditions C1–C6 (L6-2; bind CR-7 and CR-7b):**
- **C1 — Deployed-vs-repo diff before deploy (stop rule).** For each Worker, download the deployed script read-only (Cloudflare Workers script-content API, wrangler 4.96.0 session) and diff it against a `wrangler deploy --dry-run --outdir` bundle of the repo, **before** adding the auth check. Allowed differences: **delta = the `1b6a7a3` hunk only; seed and figi = none.** Anything else → STOP and report to the Main Lane; do not deploy. (If figi's deployed `normalizeName` differs from the repo, shipping the repo would change figi's name keys: C1 stops rather than deploys.)
- **C2 — Auth pattern.** One `RUN_AUTH_SECRET` **per Worker (different values)**, checked **first** (before hold and budget), constant-time compare, **fail closed** if the binding is missing, 401 otherwise. Secrets only via `wrangler secret put`; local copies in gitignored `.env.entities-{delta,seed,figi}-run` (root `.gitignore` covers `.env.*`); never in a toml, script or log.
- **C3 — Only the gate changes.** No change to `scheduled()`, cron, hold/budget logic, batch sizes or SQL. Figi: gate `/run` **and** `/rematch` with the same secret. Seed's Monday 04:00 cron is unaffected (it never goes through `fetch()`).
- **C4 — Production tests are 401-only.** No secret and wrong secret → 401 on all four routes. Authorised paths only under `wrangler dev`. Evidence: `delta_last_run` still absent; no new seed or figi writes from the test.
- **C5 — Windows.** Not Sun 04:00–07:00 UTC; seed not Mon 03:30–05:00 UTC; none of the three during 17–23 Oct if 011 is GO; also not 05:50–07:10 UTC (enrich), because figi and delta bundle seed's module.
- **C6 — Callers.** No local script calls these URLs today (repo grep). Any future manual call uses the header from the local `.env` file; the runbook line goes in the 002 close-out.

### 10.2 Deployed = repo, and the CR-7 path (R-C)

**Evidence (git history, read-only, 8 Oct):**

| Worker | Deployed version (000 manifest / 012) | Last repo change to its source | Equality |
|---|---|---|---|
| `meridian-entities-delta` | `7d316b5e`, 16 Aug | `b238e36` (23 Aug) and `1b6a7a3` (24 Aug, MA-SEP-009 path correction) | **Differs** — the "deployed = repo" condition will stop the build |
| `meridian-entities-seed` | `82de8589`, 24 Sep (MA-OCT-012, from repo) | `472d7bf` (9 Sep) | Expected equal; verify |
| `meridian-entities-figi` | `ae7fd10d`, 16 Aug | `993dd03` (12 Aug) | Expected equal; verify |
| `meridian-bootstrap` (CR-6) | `4cdf40f3`, 14 Jun | No change since the 1 Aug baseline `33b777c`; history before that is not in this repo | **Not shown**; verify |

**How to verify (C1):** download each deployed script read-only (Workers script-content API through the wrangler 4.96.0 OAuth session, which has `workers_scripts` scope; or the Founder's Workers-Read token) and diff it against a `wrangler deploy --dry-run --outdir` bundle of `HEAD`. Read-only, on Fri 9 / Sat 10, before any edit.

**CR-7 path — DECIDED: option (ii)** (Data-Identity Lead, `claude/relays/LANE-6_REPORT.md` `54ac356e…f972`, ruling L6-1). CR-7 deploys the **repo** `entities-delta.js` plus the auth check only. The Data-Identity Lead ACKs both post-deploy commits:
- **`b238e36` (23 Aug):** delta imports `normalizeName` from `entities-seed.js` for the parent insert. This is the MA-SEP-001 fix deployed on 16 Aug (`7d316b5e`) and committed a week later (Founder, 16 Aug: keep it), so it is very likely already in the deployed bundle.
- **`1b6a7a3` (24 Aug):** one line in `refreshParentExceptions()` (`detail.relationships` → `detail.data?.relationships`). That function runs only from `scheduled()`; the cron is held, and `/run` calls `runDelta()` only, so the line cannot execute in production.

Why not (i): gating the deployed source would deploy code that exists in no commit — exactly the intended-vs-deployed drift 002 exists to detect — and the next repo deploy would silently revert it.

**Condition (1) "Bug 2 untouched" holds:** the repo delta still carries MA-SEP-009 Bug 2 and the H10 blockers (006 Evidence §13) in `refreshParentExceptions()`; CR-7 does not change them, and none is reachable while the cron is held. Reactivation stays KI 22.34's own packet. The CR-7 stop rule is amended to C1 ("deployed = repo except the listed ACKed hunk, else stop").

**CR-6 (bootstrap):** the same C1-style diff (deployed `4cdf40f3` vs a dry-run bundle of `HEAD`) runs before the `/trigger` edit. Allowed difference: none. If they differ, STOP and report the difference to the ETF PL before any deploy; do not ship unreviewed repo changes to an ETF Worker.

---

## 11. D1 budget, query plans and the three-point check

**Write-cost assumptions** (from the 001 schema): an `ops_job_run` event ≈ 5 row-writes (row + 4 index entries); an `ops_exception` raise ≈ 7 + its `ops_case_event` row ≈ 4 → **≈ 11 per raise**; a registry row ≈ 3.

### 11.1 Writes

**Build (both phases, remote):**

| Step | Row-writes |
|---|---|
| Registry load (≈ 47 new rows × 3) | ≈ 150 |
| `ops_job_pause` migration + one 011 pause row (if GO) | ≈ 10 |
| Sweep smoke tests on remote (real findings, ≤ 20 raises) | ≤ 220 |
| Outbox / health-check remote checks (≈ 10 events) | ≈ 50 |
| `meridian-control` split (no data moves) | 0 |
| **Total (cap, same as 001)** | **≤ 500** (reads ≤ 50k) |

**Steady state per day:**

| Source | 002a | + 002b |
|---|---|---|
| Boost: 2 fires × 2 events × 5 | 20 | 20 |
| Health-check: 4 sweeps × 2 events × 5 | 40 | 40 |
| Sweep raises: typically 0–3 × 11 | ≤ 35 | ≤ 35 |
| Worker events (enrich 3, bootstrap 6 end-only, holdings/seed ≈ 0.6) × 5 | — | ≈ 50 |
| Registry / effective-schedule updates, pauses | ≈ 0 | ≈ 0 |
| **Total** | **≈ 95 (0.1%)** | **≈ 145 (0.15%)** |

**Hard ceilings:** ingest daily cap 1,000 events (001) ≤ 5,000; sweep ≤ 20 raises per call and **≤ 100 per UTC day** (new `OPS_SWEEP_DAILY_RAISE_CAP`) ≤ 1,100. Worst case ≈ 6,100 a day (6%). Sunday (holdings ≈ 70.7k) keeps > 20k headroom even at the worst case.

**Retention:** `ops_job_run` 180 days (001's manual monthly prune, unchanged); `ops_exception`, `ops_case_event`, `ops_job_pause` kept forever (< 1 MB a year together); local outbox entries ≤ 6 days, expired file kept as evidence.

### 11.2 Reads and query plans

| Query | Where | Expected plan | Rows per call |
|---|---|---|---|
| L1 fleet (001 Q4) | admin/jobs, sweep | `SCAN ops_job_registry` (declared, ≤ 60) + 4 × `SEARCH ops_job_run USING (COVERING) INDEX …(job_id=? …)` | ≈ 250 |
| L2 recent runs | admin/jobs, sweep | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=? AND started_at>?)` — **confirmed (P4)** | 002a ≈ 90; 002b ≈ 300 |
| L3 pauses | admin/jobs, sweep | `SCAN ops_job_pause` (declared, ≤ 100 rows) or `SEARCH … idx_ops_job_pause_job_end` | < 10 |
| S1 raise | sweep | `INSERT OR IGNORE` unique probe on `dedupe_key` (`sqlite_autoindex_ops_exception_2`, **confirmed (P5)**) | ≈ 1 per raise (≤ 20) |
| S2 hold | sweep | `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)` (autoindex confirmed by P1) | 1 |
| S3 ETF (a)/(c) | sweep | same PK search × 3 | 3 |
| Effective schedules (B1) | sweep, once a day | Cloudflare API, 0 D1 reads | 0 |
| **Per sweep** | | | **≤ 600 (cap 1,000)** |

Daily reads: 4 sweeps ≈ 2.4k + admin views (≈ 20 × 600 ≈ 12k) ≈ **15k (0.3% of 5M)**. No query reads a large table; `fund_holdings_monthly` and every Entities table are untouched.

**Lane 1 evidence — DONE.** `claude/MA-OCT-002_Explain_Pack_Results.md` (`677dd3d0…68b4`): 7 Oct 19:29–19:31 UTC, Wednesday (outside 04:00–07:05 UTC); HEAD `16918e0`, no locks; `/usr/local/bin/wrangler` 4.96.0 by absolute path, never `npx`; a runner that refused anything but SELECT/EXPLAIN; every plan taken before its statement. **374 rows read (budget 5,000), 0 written, no STOP.** Accepted by the Operations Lead.

| # | Query (what it verifies) | Live plan (verbatim) | Check | EXPLAIN rows_read | Exec rows_read | Written |
|---|---|---|---|---|---|---|
| P1 | `sqlite_master` for `ops_%` + `holdings_pipeline_state` (001 schema as built; autoindex names) | `SCAN sqlite_master` | ✅ allowed | 0 | 147 | 0 |
| P2 | `ops_job_registry` (A1 baseline) | `SCAN ops_job_registry` | ✅ allowed (≤ 60) | 0 | 2 | 0 |
| P3 | Pilot run shape by `event_type`, `end_only` | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_type_at (job_id=?)` / `USE TEMP B-TREE FOR GROUP BY` | ✅ (temp B-tree for GROUP BY only; stop rule covers P4/P6) | 0 | 38 | 0 |
| P4 | **L2** recent runs for one job | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=? AND started_at>?)` | ✅ no temp B-tree | 0 | 19 | 0 |
| P5 | **S1** dedupe probe | `SEARCH ops_exception USING INDEX sqlite_autoindex_ops_exception_2 (dedupe_key=?)` | ✅ | 0 | 0 | 0 |
| P6 | Exceptions per job (003 queue input) | `SEARCH ops_exception USING INDEX idx_ops_exception_job (job_id=?)` | ✅ no temp B-tree | 0 | 0 | 0 |
| P7a | `holdings_pipeline_state` row count (stop if > 500) | `SCAN holdings_pipeline_state USING COVERING INDEX sqlite_autoindex_holdings_pipeline_state_1` | ✅ allowed (62 rows) | 0 | 62 | 0 |
| P7 | Key inventory (KI 22.39, ETF (a)/(c)) | `SCAN holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1` | ✅ allowed | 0 | 62 | 0 |
| P8 | Governance table counts (`meridian-control` sizing) | `COMPOUND QUERY` / `LEFT-MOST SUBQUERY` / `SCAN sprintboarditems USING COVERING INDEX idx_sprintboarditems_lane` / `UNION ALL` / `SCAN releaseledger USING COVERING INDEX idx_releaseledger_status` / `UNION ALL` / `SCAN operationalevents USING COVERING INDEX idx_operationalevents_type` | ✅ allowed | 0 | 44 | 0 |
| HTTP | `GET /api/ops/cf/d1-today` (no D1) | — | ✅ live | — | — | — |

**What the results establish:**
- **Schema (P1):** all 5 `ops_*` tables, their indexes and the 3 append-only triggers exist as 001 built them; `holdings_pipeline_state` has `sqlite_autoindex_holdings_pipeline_state_1` (its `key` PK), so S2/S3 point reads plan as `SEARCH … (key=?)` — confirmed again remotely at build (three-point step 1).
- **Registry (P2):** exactly `ops.ingest` and `local.entities-enrich-boost` (emitter `boost-local`, `expected_max_duration_s = 120`). A1 adds 47.
- **Run ledger (P3/P4):** 19 rows for the boost: the 4 AC6 contract-test rows of 1 Oct (start, success, end-only `skipped`, end-only `partial`) and 15 pilot rows — 7 `start` + 7 `success`, and 1 end-only `failed` (3 Oct 10:55, the one delivered failure). 8 pilot terminal events with `detail.slot`; 2 with `out_of_window = true`, both `success` (4 and 5 Oct 11:02, KI 22.47). Slots with no terminal row: 2 Oct 10:50, 4 Oct 16:50, 5 Oct 16:50, 7 Oct 10:50 — matches the run log (§0.1).
- **Cost check for L2:** 19 rows for 10 days of one job, i.e. below the ≈ 28-per-7-days estimate (pilot fires twice a day); the 002a sweep estimate of ≈ 90 rows for L2 stands.
- **Exceptions (P5/P6):** 0 rows; the sweep will be the first producer.
- **`holdings_pipeline_state` (P7):** 62 keys — 4 enrich (Entities run facts), 4 financialfact (13F), 49 `writes_today_*` back to 7 Jun (never pruned), and the holdings keys (`etf_offset = 71`, `last_run_status = running:71/237:partial:0`, `last_full_run = 2026-10-04T04:00:44.799Z`, `etfs_processed = 20`, `offset_AVEM_2026-05 = 3500`, `hold_all_jobs = false`). **No `delta_*` keys.** Feeds §8.5, §9 and §14.
- **Governance tables (P8):** `sprintboarditems` 19, `releaseledger` 12, `operationalevents` 13 — no data moves in the split (§13).
- **`d1-today` (HTTP):** `{"ok":true,"date":"2026-10-07","rowsWritten":390,"daily_cap":100000,"pct_of_cap":0.4,…}` at 19:30:56Z — the route the F7 fix uses is live.

**Not covered by the pack (planned at build, three-point step 1):** L1 (001 Q4, already measured at 7 rows read in 001 AC3), L3 on the new `ops_job_pause`, and the sweep's raise batch.

### 11.3 Three-point check

| Item | 1. Index audit | 2. Single-execution read test (< 50k) | 3. Documented budget |
|---|---|---|---|
| L1–L3, S1–S3 | §11.2 plans; Lane 1 now, remote re-run after migration in the build | Live `meta.rows_read` per route in the close-out | Header comment in `ops-api.js` (READ/WRITE BUDGET block) and this section |
| Registry load (writes) | `INSERT OR IGNORE` on PK; guarded `UPDATE` on PK | n/a (≈ 47 rows) | ≈ 150 writes |
| **Recurring: sweep (LaunchAgent, no cron)** | as above | One supervised remote sweep, `rows_read` recorded | ≤ 1,000 reads, ≤ 250 writes per call; ≤ 100 raises a day |
| Worker heartbeats (002b) | No new query in the emitting Workers (fetch only) | — | +1 subrequest per invocation, reserved (§12) |
| Cron check | **No new cron and no `scheduled()` handler.** Cron slots stay 5/5. | | |

---

## 12. Worker heartbeats (B2)

**Transport: 001 option A (authenticated ingest), after the 1042 test** (binding, 001 Architect item d). Each Worker gets the secret `OPS_INGEST_KEY` and the var `OPS_INGEST_URL`; `meridian-ops` gets one emitter hash per Worker in `OPS_INGEST_KEYS`. Step 0 of B2: deploy the holdings emitter first and confirm a `workers.dev` → `workers.dev` fetch is not refused (error 1042). If refused: `global_fetch_strictly_public` on the emitter; if that fails, option B (service binding, its own CR).

**Rules (001 §7.5):** `ctx.waitUntil(sendOpsEvent(…))`, never awaited in the job's flow; 2 s timeout; **0 retries and no outbox** in Workers (subrequest budget) — a lost Worker event shows as a `missed` slot or `lost` run; heartbeats only from `scheduled()` (trigger `cron:<expr>`), **not** from `/run`, so boost-driven enrich calls are not double-reported.

| Worker | Job id(s) | Events | Subrequests added | Payload highlights | Sign-off |
|---|---|---|---|---|---|
| `meridian-holdings` | `cf.meridian-holdings` | start + end, **or end-only** if B-2 shows no room | 1–2, **reserved only after measurement (§19.5 B-2)**: the Worker's own budget model (`holdings-pipeline.js:10–17`) counts fetch and D1 calls against the 50 limit and is tuned close to it | `rows_written`, `cursor` = `etf_offset` before/after, `items_attempted` = batch ETFs, `items_progressed` = completed ETFs, `detail.per_etf`, `detail.metrics.writes_today_after` | **ETF PL** |
| `meridian-entities-seed` | `cf.meridian-entities-seed` | start + end | 2 | `rows_written`, skipped `budget` when below its 65k headroom | Data-Identity Lead |
| `meridian-entities-enrich` | `.phase1` | start + end | 2 (Phase 1 uses 0 GLEIF subrequests) | `items_attempted/progressed` (ISINs populated) | Data-Identity Lead |
| `meridian-entities-enrich` | `.phase23` | **end-only** | 1, **reserved: `SUBREQUEST_CHECKPOINT` 44 → 43** (keeps the 4-subrequest margin, MA-SEP-009) | GLEIF key set from 006 §8.2 in `detail.metrics` | **Data-Identity Lead** |
| `meridian-bootstrap` | `cf.meridian-bootstrap` | start + end (end-only if B-2 shows no room); `success`/`partial`, or `skipped` with `reason='empty_input'` only when the sync finds no new series and no `NOTICKER_` row to resolve | 1–2, **reserved only after measurement (§19.5 B-2)** | `items_attempted` = new series considered (≤ `BATCH_SIZE`), `items_progressed` = series added, `rows_written`, `detail.metrics.tickers_resolved` | **ETF PL** |

Deploy windows: holdings not Sat 22:00 – Sun 08:00 UTC; seed not Mon 03:30–05:00 UTC; enrich not 05:50–07:10 UTC daily and not 17–23 Oct; none on Sun 04:00–07:00 UTC.

---

## 13. `meridian-control` split (A6, CR-1)

**Today:** `meridian-ops` has 14 endpoints (8 public GETs, 4 admin POSTs, 1 admin GET, 1 ingest) and 955 lines; 1 route of headroom (001 §10; Architect option 1).

**Move to a new Worker `meridian-control`** (`App/Ops/src/control-api.js`, `App/Ops/wrangler-control.toml`; existing folder, so no folder CR), **same paths**, so 005 only changes a base URL:

| Moves to `meridian-control` (8) | Stays in `meridian-ops` (7 after 002a) |
|---|---|
| GET `/api/ops/sprint-board`, `/api/ops/release-ledger`, `/api/ops/events`, `/api/ops/drift` (release drift) | GET `/api/ops/budget-risk`, `/api/ops/openfigi-status`, `/api/ops/cf/invocations`, `/api/ops/cf/d1-today` |
| POST `/api/ops/admin/sprint-board`, `…/:id/stage`, `/api/ops/admin/release-ledger`, `…/:id/event` | GET `/api/ops/admin/jobs`; POST `/api/ops/ingest/run-event`; **POST `/api/ops/ingest/sweep` (new)** |

- **Headroom after 002a: 8 endpoints** for 003 (≈ 4–5) and 004 (≈ 4–5).
- **Front end unchanged in 002.** `ma-ops.js` keeps calling `meridian-ops`. A single redirect *rule* (like 001's legacy-POST deny rule, not an endpoint) answers the 4 moved public GETs with **`302` (or `307`) — not `301`, which browsers cache permanently and would outlive a rollback and the 005 cut-over** — to the same path on `meridian-control`, carrying `Access-Control-Allow-Origin: *` on the redirect so cross-origin `fetch` follows it. 005 points `ma-ops.js` at `meridian-control` and the rule is deleted.
- **Auth:** a new Access app "meridian-control admin" on `meridian-control.navinmv1981.workers.dev/api/ops/admin` with the 001 allow list, its own AUD (Founder step, ≈ 15 min); `verifyAccessJwt()` vendored (no cross-folder imports); legacy-POST deny rule copied.
- **Domain and writer decision (for the Architect):** `sprintboarditems`, `releaseledger` and `operationalevents` **stay Ops-domain**, owned by the Operations Lead, with the Program Orchestrator as business owner of the contents. Their **only writer becomes `meridian-control`**; `meridian-ops` stops writing them. The `ops_*` tables stay written only by `meridian-ops`. One writer per table holds; no cross-domain table is created.
- **Rollback:** redeploy the previous `meridian-ops` version (routes restored in one step); leave `meridian-control` deployed but unused.

---

## 14. KI 22.39 — entity run state in ETF-domain `holdings_pipeline_state` (B5)

**Today:** enrich writes `enrich_phase3_last_run_*`; delta writes `delta_last_run`, `delta_entities_updated`, `delta_inactive_flagged` and unbounded `delta_inactive_<LEI>`; seed and enrich read, and seed writes, the shared `writes_today_<date>` counter. All of these sit in an ETF-domain table (cross-domain writes). **Lane 1 P7 (7 Oct), 62 keys:** Entities keys present are only the 4 enrich keys (`enrich_combined_last_invocation_subrequests`, `enrich_phase3_last_run_deferred`, `_entities`, `_subrequests`); **no `delta_*` keys** (delta has never run); the 13F financialfact job also writes 4 keys there (`financialfact_backfill_*`) — the same class of cross-domain write, handled when that job is revisited (Founder Q3); and 49 `writes_today_*` keys since 7 Jun have never been pruned (ETF PL housekeeping, not 002).

**Where each class belongs:**

| Class | Example keys | Target | Owner |
|---|---|---|---|
| Run facts (what a run did) | `enrich_phase3_last_run_entities/_deferred/_subrequests`, `delta_last_run`, `delta_entities_updated` | `ops_job_run` end event (`detail.metrics`), via B2 | Ops (read-only for Entities) |
| State a job must read back | `delta_inactive_<LEI>` (entity flags), any entity cursor | New **Entities-domain** table `entity_pipeline_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)` | **Data-Identity Lead**, written only by Entities Workers |
| Shared daily write counter | `writes_today_<date>` | Unchanged until B4 decides the budget source (§15); stays an ETF-owned key that Entities may **read** | ETF PL |

**Migration path (CR-10; after 011, not 17–23 Oct):** (1) create `entity_pipeline_state` (Entities CR); (2) Entities Workers dual-write for one release; (3) readers switch (boost status script, 006/011 query packs, Ops reads); (4) Entities Workers stop writing `holdings_pipeline_state`; (5) the **ETF PL** deletes the listed entity keys with one guarded `DELETE … WHERE key IN (…)` batch (owner of the table does the delete). Writes: < 50 (4 keys moved, dual-write for one release, 4 deletes); P7 shows no `delta_inactive_*` keys.

---

## 15. F6, F7 and KI 22.14 (B4)

| Issue | Cause (current understanding) | Fix | Owner |
|---|---|---|---|
| **F6 / KI 22.31** wrangler 10000 under launchd — **priority raised to High** (4 of 12 boost slots since 2 Oct, about 1 in 3; FIRDS 3 of 6 in September) | Not diagnosed. Live hypotheses: wrangler version drift via `npx` (006 N-1; the 7403 precedent); network not ready right after wake (3 of 4 boost failures were the first fire of the day; the heartbeat failed in the same second) | **Boost (002a A4):** wrangler removed from the runner entirely (§8.5) — the failing step no longer exists. **FIRDS and read lanes (002a A4):** pinned 4.96.0, called by path (§8.3). **B4 fallback:** if FIRDS still hits 10000 with the pin, move its D1 access off wrangler (own CR) | Data-Identity Lead (scripts); Ops Lead (route) |
| **F7 / KI 22.32** boost guard blind Mon–Sat | It reads `writes_today_<date>`, which only holdings (Sun) and seed (Mon) write (P7: keys only on 27/28 Sep and 4/5 Oct since 28 Sep); the boost log shows `headroom=100000` on weekdays | **Moved into 002a A4 (§8.5):** pre-flight from `d1-today` (real account total, all writers). Lag measured at build. 011 shown independent of `writes_today` (§8.5) | Data-Identity Lead |
| **KI 22.14** enrich reads but never increments the counter | Counter design: each Worker must remember to add its own writes; enrich never did | Do **not** add another writer to the ETF-domain counter. Enrich's budget check moves to the analytics figure (1 subrequest from Phase 1 or a service binding, inside its reserved margin) once B2's 1042 result is known | Data-Identity Lead; ETF PL consulted |

**Review question RQ-2 (Architect):** should Cloudflare analytics (`d1-today`) become the single budget source for every non-holdings job? Recommended **yes** — it counts every writer including 011 and Ops, and needs no shared mutable counter. Holdings keeps its own in-run guard.

---

## 16. Decisions, rulings and open review questions

### 16.1 Founder decisions (given 7 Oct; **confirmed 8 Oct**, Decisions Log)

| # | Question | Decision | Effect in this spec |
|---|---|---|---|
| Q1 | Health-check review date | **Confirmed 8 Oct: 31 Dec 2026** — then it notifies, unloads itself and its registry row goes to `held` until renewed | §7.1 step 2 |
| Q2 | Notification channel | **Confirmed 8 Oct: macOS notification only** for now; `ops_exception` is the record; email deferred | §7.4, §7.5 |
| Q3 | financialfact-backfill | **Confirmed 8 Oct: retire for October**: stays off, script kept, registry `held`; revisit in November as its own packet with a named 13F owner | §6.1, B6 |

**Q4 (8 Oct, from the independent review R-A):** gate seed `/run` and figi `/run` + `/rematch` in 002a A5 (≈ ¼ day; closes KI 22.49 before 011's 17 Oct run). Effect: §10, §10.1, §10.2, CR-7b.

### 16.2 In-lane rulings (reported to the Main Lane)

- **D1-1:** `/api/ops/drift` is release drift; it is not repurposed and moves to `meridian-control` with its tables.
- **D1-4:** the duplicate `manual.gleif-seed` loads as `manual.gleif-seed.13f-seed`.
- **D2-1:** the boost trigger-label fix (B6 in rev 0) moves into A4, because it is the same file and the same sign-off.
- **D2-2:** ETF items (a) and (c) get read-only interim checks in the 002a sweep (§9), ahead of the B2 holdings emitter.

### 16.3 Needs a Main Lane ruling

- **ML-1 — ACCEPTED by the Main Lane (7 Oct), conditional on the Data-Identity Lead's ACK:** §8.2 supersedes the 1 Oct ruling (b) on out-of-window fires (the runner stops calling `/run` and reports `skipped`/`out_of_window`). If the ACK is declined, the §8.2 fallback applies. The Data-Identity Lead's conditions are written in §8.6 (ML-1, CR-5) and §10.1 (CR-7).
- **D2-1 and D2-2 — ACCEPTED (7 Oct).**
- **New for the Data-Identity Lead's ACK (CR-5):** the F7 pre-flight change (§8.5) — headroom source switches from `writes_today_<date>` via wrangler to `d1-today`; threshold, position in the flow and run-log fields unchanged.

### 16.4 Review questions (Architect / ETF PL — not Founder)

- **RQ-1:** bootstrap's kept cron as a cloud-side clock for the sweep (§7.5). Bootstrap is not idle (it runs `runWeeklySync` every 4 h). Recommended: **defer to B2 with evidence** — decide after its subrequest use is measured (§19.5 B-2), and only as a post-sync `ctx.waitUntil` call with ETF PL sign-off.
- **RQ-2:** Cloudflare analytics as the single budget source for non-holdings jobs (§15). Recommended: yes.
- **RQ-3:** governance tables stay Ops-domain with `meridian-control` as their sole writer (§13). Recommended: yes.
- **RQ-4:** the 302/307 redirect rule for moved public GETs until 005 (§13; not 301). Recommended: yes; alternative is keeping the 4 GETs in `meridian-ops`, which leaves only 4 endpoints for 003/004.

---

## 17. Change requests

| CR | Item | Phase | Owner (requests) | Sign-off / consult | Reviewer | Approver |
|---|---|---|---|---|---|---|
| CR-1 | `meridian-control` Worker, route move, redirect rule, Access app | A6 | Operations Lead | — | Architect | Founder |
| CR-2 | Ops migration `003-ops-job-pause.sql` (new Ops table) | A2 | Operations Lead | — | Architect | Founder (with spec) |
| CR-3 | New route `POST /api/ops/ingest/sweep`; additive `admin/jobs` fields; `OPS_SWEEP_*` vars | A3 | Operations Lead | — | Architect | Founder (with spec) |
| CR-4 | Health-check revival: script change, 31 Dec checkpoint, control scripts, 4× cadence, Login Items | A3 | Operations Lead | Founder step (Allow in Background) | Architect | Founder |
| CR-5 | Boost-runner bundle (§8): outbox (P0), out-of-window + `OPS_TRIGGER`, F7 pre-flight from `d1-today` (wrangler removed from the boost); wrangler 4.96.0 pin for the FIRDS runner and read lanes | A4 | Operations Lead | **Data-Identity Lead ACK** (script owner); Main Lane ML-1 | Architect | Founder |
| CR-6 | Remove bootstrap `/trigger`; deployed = repo check first (§10.2) | A5 | Operations Lead | **ETF PL** | Architect | Founder (with spec) |
| CR-7 | Gate entities-delta `/run`; path (ii): repo version + gate, `1b6a7a3` the only allowed diff (§10.2, L6-1) | A5 | Operations Lead | **Data-Identity Lead** | Architect | Founder (with spec) |
| **CR-7b** | **Gate entities-seed `/run` and entities-figi `/run` + `/rematch` (KI 22.49); deployed = repo check first** | A5 | Operations Lead | **Data-Identity Lead** (ACK with conditions C1–C6, 8 Oct, L6-2) | Architect | **Founder (decided 8 Oct)** |
| CR-A1 | Registry load (generated `--file` batch into Ops tables; traceability only) | A1 | Operations Lead | — | Operations Lead review of the generated SQL | Founder (with spec) |
| CR-8 | `CF_WORKERS_READ_TOKEN` secret, effective schedules, drift | B1 | Operations Lead | Founder (token) | Architect | Founder |
| CR-9 | Worker heartbeat wiring ×4 Workers incl. enrich checkpoint 44 → 43 | B2 | Operations Lead | **ETF PL** (holdings, bootstrap); **Data-Identity Lead** (seed, enrich) | Architect + ETF PL | Founder |
| CR-10 | `entity_pipeline_state` + KI 22.39 migration | B5 | Data-Identity Lead | ETF PL (deletes from its table) | Architect | Founder |
| CR-11 | KI 22.14 enrich budget source → analytics; FIRDS off wrangler if 10000 persists after the pin | B4 | Data-Identity Lead | ETF PL consulted | Architect | Founder |

financialfact-backfill needs no CR (it stays off; registry row `held`).

---

## 18. Freeze windows and build calendar

| Window | Rule |
|---|---|
| **011 run 17–23 Oct (if GO)** | No change to Entities Workers or the boost runner. A4 must be live by Wed 14 Oct; the `ops_job_pause` row is inserted by Fri 16 Oct. |
| Sundays 04:00–07:00 UTC | No deploy, migration, registry load or remote test |
| Mondays 03:30–05:00 UTC | No deploy (seed at 04:00) |
| Daily 05:50–07:10 UTC | No enrich deploy (Phase 1 06:00, Phase 2+3 06:50) |
| Daily 10:50–10:59, 16:50–16:59 UTC | No save of the boost runner or its plist |
| Mon 12 Oct | 006 close / 011 gate: no 002 deploys (one Founder checkpoint a day) |
| Sun 25 Oct (DST ends) | Expect `dst_shift` on the boost (T-D2); re-run its install script after 23 Oct |

**Build calendar (002a):**

| Day | Work |
|---|---|
| Fri 9 Oct | A6 split (CR-1) local + remote; A5 bootstrap removal (ETF PL present) |
| Sat 10 Oct | Deployed = repo checks (§10.2, read-only); A1 registry load (+ `d1-today` lag measurement around it, §8.5); A2 migration + lateness; A5 delta, seed and figi gating (C1 diff first; delta path (ii); outside 05:50–07:10 UTC, C5) |
| Tue 13 Oct | A3 sweep route + health-check revival (Founder: Login Items, supervised first run) |
| Wed 14 Oct | A4 boost bundle go-live (outside the windows); close-out evidence |
| Thu 15 Oct | Buffer; 002a close-out → 003 starts |
| **Fri 16 Oct** | **Release task (Operations Lead): insert the `ops_job_pause` row** for `local.entities-enrich-boost`, `2026-10-17T00:00Z` → `2026-10-24T00:00Z`, if 011 is GO (§6.3); confirm A4 and A5 are live (011's Fri 16 Oct release check) |

---

## 19. Acceptance criteria, test plan and rollback

### 19.1 002a acceptance criteria

| # | Given / When / Then |
|---|---|
| AC-a1 | **Given** the migration and registry load have run, **when** the registry is read, **then** it holds 49 rows: every manifest job (with `manual.gleif-seed.13f-seed` and the two enrich phase ids, no un-phased enrich id), `ops.ingest`, and the unchanged pilot row; statuses `held` for delta and financialfact, `retired` for firds; and a second `registry-sync` run produces an **empty diff**. |
| AC-a2 | **Given** the boost history 2–14 Oct, **when** `GET /api/ops/admin/jobs?job_id=local.entities-enrich-boost&lookback_days=14` is called, **then** every slot state matches the run log: 4 Oct 16:50 = `missed`; 4 and 5 Oct 11:02 = `late`; the failed fires show `failed`; a test `ops_job_pause` row turns a past slot into `paused`; jobs without an emitter show `unobserved`, never `missed`; and the call reads ≤ 1,000 rows. |
| AC-a3 | **Given** the health-check is reinstalled and allowed in the background, **when** it is kickstarted once under supervision, **then** it logs a sweep with `rows_read` ≤ 1,000; raises one exception per real finding with a `dedupe_key`; **a second sweep raises 0 new**; one macOS notification appears for the first sweep only; the script's checkpoint is 2026-12-31; the sweep route returns 401 without a key, 202 with each switch off, and stops at 20 raises per call (local test). Pause, resume, status and uninstall each work. The Sunday check reads the 4 or 11 Oct `writes_today` value correctly. |
| AC-a4 | **Given** the bundle is live, **when** the extended `App/Ops/tests/boost-heartbeat-resilience.mjs` runs, **then**: an undelivered terminal event is spooled and replayed on the next run (`201` or `200 duplicate`, then removed); 4xx and 202 are not spooled; > 6-day events move to `expired.jsonl`; replay never runs before `/run`; exit code and run-log lines are identical to control except the new `skipped_out_of_window` outcome; an out-of-window fire makes **no** `/run` call and sends `skipped`/`out_of_window`; the boost runner contains **no** wrangler or `npx` call and reads headroom from `d1-today` (stubbed: below 5,000 → `skipped`/`budget`; unreachable → `failed`/`headroom_unavailable`, no `/run`); `firds-local-seed.mjs` calls the pinned 4.96.0 binary by path and its status script prints the version; launchd fires carry `trigger='launchd'`. **Lag:** `d1-today` recorded before, after and 5 min after the A1 load. **In production, over the first 14 scheduled slots after go-live, excluding `paused` slots** (with 011 GO and the boost paused 17–23 Oct this completes ≈ 30 Oct; without the pause ≈ 21 Oct): every terminal event in the run log is in `ops_job_run` (0 permanent losses); 0 boost failures of class `wrangler_auth_10000`; weekday run-log lines show the real account total, not `headroom=100000`. |
| AC-a5 | **Given** the deploys, **then** `meridian-bootstrap /trigger` → 404 and its cron still advances `edgar_bootstrap_state.last_run`; `meridian-entities-delta /run`, `meridian-entities-seed /run`, `meridian-entities-figi /run` and `/rematch` each return 401 without a secret and with a wrong secret (×2 per route); `delta_last_run` is still absent and no seed or figi run is recorded. Deployed = repo was checked first for each Worker (§10.2). Authorised paths are tested only under `wrangler dev`. All live before Fri 16 Oct. |
| AC-a6 | **Given** the split, **then** `meridian-ops` serves 7 endpoints + 2 rules and `meridian-control` 8; the 4 moved public GETs reached through `meridian-ops` return, after the redirect, the same status, shape and CORS as a pre-split capture; `ma-ops.js` tabs render on the live site; the 001 AC4 auth matrix passes on `meridian-control`; a grep shows `ops_*` written only in `ops-api.js` and the governance tables only in `control-api.js`. |
| AC-a7 | Build D1 usage ≤ 500 writes and ≤ 50k reads (per-statement `meta`); every new query's remote `EXPLAIN` in the close-out; no undeclared SCAN. |

### 19.2 002b acceptance criteria (summary)

- **AC-b1:** effective schedules read for the 5 cron Workers; T-D1 and T-D2 pass; a deliberate test mismatch on a non-production evaluation raises `schedule_drift` once.
- **AC-b2:** 1042 test recorded; each wired Worker produces its events from cron with the declared subrequest count; enrich Phase 2+3 checkpoint is 43; no `/run`-triggered events.
- **AC-b3:** a holdings Sunday run reports `per_etf` costs and the pass-cycle metric; the 75k warning fires on a synthetic value in a local test.
- **AC-b4:** FIRDS 10000 count over the 4 Sundays after the pin is reported; if > 0, moving FIRDS off wrangler gets its own CR (CR-11). Enrich's budget check reads the analytics figure (KI 22.14).
- **AC-b5:** after migration no Entities Worker writes `holdings_pipeline_state` (grep plus a 7-day check of the listed keys' `updated_at`).

### 19.3 Test plan (order)

1. Local: `wrangler dev` for `meridian-ops` and `meridian-control`; migration `003-ops-job-pause.sql` with `--local`; lateness unit tests against the recorded boost history (2–14 Oct) and synthetic cases (pause, lost, frozen, `unobserved`, DST, CF day-of-week).
2. Local: extended `boost-heartbeat-resilience.mjs` (outbox, out-of-window, pin) and a new `sweep-contract.mjs` (auth, switches, caps, dedupe).
3. Remote, Fri 9 Oct: deploy `meridian-control`; Access app (Founder); deploy `meridian-ops` without governance routes + redirect rule; AC-a6.
4. Remote, Sat 10 Oct: migration; registry load; AC-a1, AC-a2; delta gating, AC-a5.
5. Remote, Tue 13 Oct: sweep route; health-check install and supervised run; AC-a3.
6. Local file save, Wed 14 Oct (outside the windows): boost bundle; first two fires observed; AC-a4 begins its 7-day count.

### 19.4 Rollback

| Item | Rollback | Data |
|---|---|---|
| A6 | Redeploy the previous `meridian-ops` version (routes restored); leave `meridian-control` idle; disable its Access app | None moved |
| A1 | Registry rows stay (harmless). Wrong values: guarded `UPDATE` with audit row. Jobs are never deleted (001 rule) | — |
| A2 | Remove the lateness fields by redeploying; `ops_job_pause` stays (Founder approval needed to drop a table) | — |
| A3 | `OPS_SWEEP_ENABLED=false` (instant); `health-check-uninstall.sh`; raised cases stay for 003 | Cases kept |
| A4 | `git checkout <pre-bundle SHA> -- <runner, install script>` and re-run the install script; the outbox file is inert without the code | Spooled events can still be replayed later |
| A5 | **Prefer roll-forward** (fix the gate and redeploy). Redeploying the previous versions reopens anonymous `/trigger`, delta `/run`, seed `/run` and figi `/run` + `/rematch` — emergency only, and never 17–23 Oct without the Founder | — |
| 002b | Per CR; Worker emitters are no-ops when their key or URL is removed (001 §7.5) | — |

---

### 19.5 Carry-forward into the Build Brief

From the same-session self-check (`claude/MA-OCT-002_Review.md`, `b970ddec…3bd5`). Not approval conditions; each must appear in the 002 Build Brief.

| # | Item | When |
|---|---|---|
| B-1 | **Daily raise cap with zero extra reads** (independent review): sum `detail.metrics.raised` over today's `local.health-check` end events (already read by L2) plus the current call (§7.2). No new query; `idx_ops_case_event_subject` cannot serve a cross-subject daily count, so that option is dropped. | A3 build |
| B-2 | **Measure real subrequest use** of one holdings run (Sunday) and one bootstrap fire (tail or invocation metrics) before reserving heartbeat subrequests; use end-only where there is no room (§12). | Before B2 build |
| A-3 | Get the Data-Identity Lead ACK on CR-5 **by Fri 9 Oct** and move the A4 save to **Sat 10 or Tue 13 Oct** (A4 is on 011's critical path and depends on no other 002a item). | Build calendar |
| A-4 | **Rollback after A3 is roll-forward:** once the sweep route is live, rolling back A6 means re-adding the governance routes to `meridian-ops`, not redeploying the pre-A6 version (which would also drop the sweep). Record the Worker version ID per item. | Throughout the build |
| A-5 | Redirects are **302/307**, not 301 (§13). | A6 |
| A-6 | State a **line estimate** for `ops-api.js` after 002a (001 rule: 15 routes **or** ≈ 1,500 lines). Working estimate ≈ 1,100 (955 − ≈ 250 governance + ≈ 350–450 lateness, sweep and raise). | A6/A3 |
| A-7 | P1 rule: raise sev3 after **3 consecutive non-productive boost slots** (`skipped(out_of_window)` or `skipped(budget)`), so a stalled boost is not silent. | A3 (P1) |
| A-8 | Land the **FIRDS** part of CR-5 (pin) **by Wed 14 Oct or after 23 Oct**; FIRDS runs Sun 18 Oct inside the 011 window. | A4 |
| R-1 | **Rollback order:** A3 → A2 → A1 → A6 (reverse dependency order; A2 cannot be rolled back while the sweep is enabled). Add rollback rows for the wrangler pin (`package.json` + lockfile) and the FIRDS runner change. Rolling A4 back before 17 Oct drops 011's outbox gate to its fallback (daily run-log reconciliation); say so in the close-out. | Throughout the build |
| R-2 | **If time is short, A4 and A5 go before A6** (§5.1). | Build calendar |
| R-3 | **F6 metric** (AC-a4, §20) counts both `wrangler_auth_10000` and `headroom_unavailable` (network-not-ready-on-wake hypothesis); consider retrying `d1-today` for up to ≈ 60 s inside the :50–:59 window instead of one 2 s retry. | A4 |
| R-4 | **CR-8:** cron schedules belong to **4 Workers (5 expressions)**; also list `meridian-entities-delta` and `meridian-entities-figi` so `unexpected_trigger` is detectable (≈ 6 subrequests a day). §6.2 and G4 wording "5 cron Workers" is read as "5 expressions on 4 Workers". | B1 |
| R-5 | **011 by Fri 16 Oct:** (1) `d1-today` lag measured and recorded with the 120 s assessment (§8.5); (2) 011's job `manual.gleif-reconcile-011` and its emitter key registered (owner: Operations Lead, by Fri 16 Oct; not among A1's 49 rows); (3) "outbox live" for 011 defined: the A4 outbox helper is a standalone module (`App/Corporate Atlas/lib/ops-outbox.mjs`, interface `spool(event)`, `replay({max, ceilingMs})`) that 011's runner may import; otherwise 011 uses its daily reconciliation fallback. | Before 17 Oct |
| R-6 | **`meridian-control` CORS:** after a cross-origin redirect the request `Origin` is `null`; `control-api.js` answers with `Access-Control-Allow-Origin: *` (as `ops-api.js:62–63` does) and never echoes the origin. Also note `GET /api/ops/openfigi-status` (stays in `meridian-ops`) runs `COUNT(*)` over three Entities tables: pre-existing, not called by the admin read or the sweep. | A6 |

## 20. Success metrics

| Metric | Baseline | Target | When |
|---|---|---|---|
| Time from a dead local job to a notification (Mac in daily use) | 31+ days (F5) | ≤ 24 h | First failure after 14 Oct |
| Terminal-event delivery (boost) | 8 of 11 in 2–7 Oct | 100% within one later run | First 14 scheduled slots after A4 go-live, excluding `paused` |
| Slots without a trace | 1 in 12 (4 Oct 16:50) | Every miss raised as `job_missed` | From A3 go-live |
| Boost failures from F6 (wrangler 10000) | 4 of 12 slots (about 1 in 3) | 0 (wrangler removed) | First 14 scheduled slots after A4 go-live, excluding `paused` |
| FIRDS failures from F6 | 3 of 6 Sunday runs (September) | 0 of 4 | 4 Sundays after the pin |
| Boost guard sees real weekday usage (F7) | `headroom=100000` every weekday | Real account total every run | From A4 |
| `meridian-ops` endpoints | 14 of 15 | 7 of 15 | After A6 |
| Cron Workers with intended = effective verified | 0 (by hand, 000) | 5 of 5 daily | After B1 |

---

## 21. Evidence and limits of this spec lane

- **Preflight (3 Oct):** brief hash verified; branch `October-2026`; no locks. **At rev 1 (7 Oct):** HEAD `16918e0` (006 close-out), no locks, read with `--no-optional-locks`.
- **Files written:** only `claude/MA-OCT-002_Spec.md` (repo and Project copy). No code, deploy, secret, cron, LaunchAgent or git change.
- **D1:** **0 reads by this lane.** The read pack ran in Lane 1 (local Claude Code, wrangler 4.96.0 by path) on 7 Oct 19:29–19:31 UTC: **374 reads, 0 writes, all plans as expected** (`claude/MA-OCT-002_Explain_Pack_Results.md` `677dd3d0…68b4`, accepted by the Operations Lead); §11.2.
- **Log evidence (read-only, 7 Oct):** `App/Corporate Atlas/logs/entities-enrich-boost.log` and `…-heartbeat.log`, 2 Oct 10:50 → 7 Oct 16:53 UTC: 12 slots, 11 fires, 4 errors (10000), 4 `failed` heartbeats of which 3 undelivered, 2 out-of-window `success`. This extends 006 Report 4's tally (8 slots to 5 Oct) with the same pattern.
- **Founder evidence (3 Oct, read-only):** both 13F Seed plists and `launchctl print` (exit 78, EX_CONFIG); `log show` for 1–3 Oct. The Login Items cause is **not yet confirmed**.
- **Wrangler version:** 4.96.0 with an OAuth login and `d1 (write)` scope, recorded by Lane 1 (7 Oct).
- **011 dependency check (§8.5):** re-cited in rev 1.3 to 011 rev 1.6 (`6f9681ab806ec1697a437a1e901e97a13e4395ebd689c3888ab7ac66d8f4513c`) §4.3, §4.4, §7, §8, §11 (rev 1.2 line numbers retired).
- **Rev 1.3 (8 Oct):** seed `/run` (`entities-seed.js:489`) and figi `/run`/`/rematch` (`entities-figi.js:404`) read in source; no caller of either in the repo (grep); git history of delta, seed, figi and bootstrap sources (§10.2); `ops_case_event.idempotency_key TEXT NULL UNIQUE` and `ops_exception.case_ref NOT NULL UNIQUE` in `002-ops-control-plane.sql`; 011 rev 1.6 `6f9681ab…4513c` §4.3, §4.4, §7, §8, §11. CR-7 path and CR-7b ACK from `claude/relays/LANE-6_REPORT.md` `54ac356e09e030f57fe6d24ef1b47a36635686ed21a6372d390c17140431f972` (Data-Identity Lead, 8 Oct; rulings L6-1, L6-2), applied 9 Oct.
- **Rev 1.2 (8 Oct):** bootstrap behaviour read from `App/ETF Refresh/src/bootstrap.js` (lines 60–62, 299–345); holdings budget model from `holdings-pipeline.js` lines 10–17; `App/Corporate Atlas/package.json` and `package-lock.json` exist (no wrangler dependency yet).
- **Not verified here:** the Workers-Read token (not yet issued); the 1042 behaviour; analytics lag on `d1-today` (measured at build, §8.5); the Login Items cause of the health-check's exit 78.
