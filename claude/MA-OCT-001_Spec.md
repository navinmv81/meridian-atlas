# MA-OCT-001 — Ops Backend Foundation: Spec

```text
ISSUED BY:    Operations Lead (packet owner; wrote this spec in the MA-OCT-001 spec lane)
EXECUTED BY:  Engineering Lead (Wave 1 build, 1–9 Oct, from a Main Lane Build Brief)
REVIEWED BY:  Architect
APPROVED BY:  Founder
PACKET:       MA-OCT-001 — Ops backend foundation (tables, auth, audit, heartbeat contract)
GATE:         Spec approval (target Tue 29 Sep)
```

**Status:** DRAFT for Architect review. Written 2026-09-26 with `/write-spec`, per `claude/MA-OCT-001_Spec_Brief.md` (SHA-256 `b7f5e28ab5acb0dcaa5393f1466c3474c7e952add1864dc164b77d5fb110bdad`, verified in the project copy and on disk before reading).
**Baseline read:** `Meridian Atlas Clean (v11)` on `October-2026` at `5405e3e`. Git was read only with `git --no-optional-locks`, and `ls .git/*.lock` found no locks. Nothing was written except this file.
**Supersedes as input:** `claude/MA-OCT-001-LEGACY_DQ_Exception_Spec.md` (the August item, renamed under F8). This spec treats it as history only. None of its design is carried forward except through `entity_exceptions` (§5.4).

---

## 0. Summary of decisions (one line each)

| # | Brief item | Decision |
|---|---|---|
| 1 | Schema | Five Ops-domain tables. `meridian-ops` is the only writer. The run ledger is **append-only**, with one row per lifecycle phase (`start` and `end`) and `UNIQUE(run_id, phase)`. Cases use polymorphic object links. The audit table is append-only and **enforced by triggers**. (§5) |
| 2 | Auth | Humans go through **Cloudflare Access** on `/api/ops/admin/*`, and the Worker re-verifies the JWT (the MA-SEP-015b pattern). Services use a **per-emitter shared secret** on `/api/ops/ingest/*`, and `meridian-ops` stores only its hash. **No service binding in 001.** The 4 existing anonymous POST routes are closed. (§6) |
| 3 | Heartbeat contract | Contract v1 has 6 events and 2 phases. Emitters generate `run_id` (UUID). `INSERT OR IGNORE` makes retries no-ops. Emitters are fire-and-forget, time out after 2 s and never change the job's outcome. (§7) |
| 4 | D1 budget | Typical load is about 20 row-writes a day during the pilot, about 250 a day with every job wired, and a hard cap of 5,000 a day. Every query has an index-backed plan. There are 3 kill-switch layers. (§8) |
| 5 | Cron slots | **001 needs no cron.** 002 will need one sweep for silent-failure alerting. Its prerequisite is retiring the bootstrap cron and gating `/trigger` (N1/N3), which needs an ETF Product Lead consult and a CR. 001 does not do this. (§9) |
| 6 | Worker size | After 001: **14 of 15 routes, about 950–1,050 lines.** 001 fits, but 002–004 will not. An Architect decision is needed **before 002's spec is approved**. (§10) |
| 7 | Boundaries | 001 covers the foundation only. It wires one pilot emitter, recommended as the **local `entities-enrich-boost` runner** rather than a Worker (Q1). (§11) |
| 8 | Housekeeping | One guarded `UPDATE` on `sprintboarditems` `MA-OCT-001`, plus its audit row. (§12) |
| 9 | Acceptance, test and rollback | 16 acceptance criteria. Rollback redeploys `589ae24c` and ignores the new tables. (§13) |
| 10 | Founder questions | Three, each with a recommendation. (§15) |

---

## 1. Problem statement

Meridian Atlas has 47 jobs (MA-OCT-000 manifest): 11 deployed Workers, 5 active cron triggers, 4 LaunchAgents and 31 manual scripts. None of them reports to a system of record. MA-OCT-000 found four High findings only by reading logs, D1 state keys and Cloudflare analytics by hand:

- F2: the seed job fired on the wrong day for 4 weeks.
- F3: holdings ended `partial` every Sunday.
- F4: the GLEIF queue has been stalled since 31 Aug while enrich "succeeds" twice a day.
- F5: the only health-check job has been dead for 31 days, and nobody was alerted.

The cost is silent data loss (ETF holdings every Sunday) and days or weeks of undetected failure. Separately, the existing `meridian-ops` Worker accepts **anonymous POSTs** that mutate `sprintboarditems` and `releaseledger` (§6.4), and its CORS policy is `*`. That fails the October security gate as it stands.

## 2. Goals (measurable)

1. **One authoritative store.** All five `ops_*` tables exist in D1 `meridian-etf`, and only `meridian-ops` writes them. Verified by a static grep of every Worker and script: 0 other writers.
2. **No anonymous mutations.** 100% of mutation routes on `meridian-ops` reject unauthenticated calls, verified at the table level (no row lands) for every route.
3. **A proven run ledger.** The pilot emitter records a `start` and an `end` row for 100% of its runs over at least 2 consecutive days, and each row matches the job's own log outcome.
4. **Zero coupling risk.** With Ops unreachable, the pilot job's outcome and exit code are unchanged, and it waits at most 2.5 s.
5. **Budget-safe.** The 001 build uses 500 D1 row-writes or fewer and 50k reads or fewer. At steady state with all jobs wired, Ops uses 0.5% of the daily write cap or less (§8).

## 3. Non-goals

| Non-goal | Why / where it goes |
|---|---|
| Populating the registry beyond the control row and the pilot row | **MA-OCT-002.** It needs the Workers-Read token (Architect ruling 1) and the manifest import. |
| Schedule drift, lateness or health computation | **002.** 001 stores the columns but computes nothing. |
| Exception and DQ workflow (create, assign, transition routes) and the `entity_exceptions` migration | **003 and 004.** 001 provides the schema, the migration mapping (§5.4) and the audit mechanics only. |
| Any UI, including changes to `ma-ops.js` | **005.** 001 changes no front-end file. |
| Job controls (rerun, freeze, stop) | Deferred by Scope v2 until auth and audit are proven. The registry *describes* each job's own kill switch but does not operate it. |
| Wiring more than one emitter | **002** wires the rest, with ETF Product Lead review for ETF Workers. |
| Any cron, scheduled handler or service binding | §9 and §6.3. |

## 4. User stories

- As the **Operations Lead**, I want every job run to leave a start and an end record with duration, rows read and written, cursor and error summary, so I can tell "ran" apart from "did work". (F4 is the case this has to catch.)
- As the **Operations Lead**, I want to turn Ops ingest off globally or for one job without redeploying anything, so a noisy emitter can never threaten the D1 budget.
- As a **job owner** (Data-Identity Lead or ETF Product Lead), I want heartbeat emission to be unable to fail or slow my job, so Ops never becomes a new failure mode for ETF or Entities data.
- As the **Founder**, I want every Ops mutation tied to my verified Cloudflare Access identity, so audit history can't be spoofed and nobody who merely knows the URL can change anything.
- As the **Data-Identity Lead** (for 003 and 004), I want historical `entity_exceptions` decisions to migrate with the original `decided_by` and `decided_at` intact, so past Founder decisions keep their provenance.
- As the **Architect**, I want every Ops query to have a declared plan and read budget before it ships (the three-point check).
- *Edge:* when Ops is down, times out or returns 5xx, the job carries on exactly as before. When a heartbeat is retried, nothing double-counts. When a `start` is lost, an end-only event still records the run.

---

## 5. Schema (Ops domain)

### 5.1 Domain and ownership declaration (CLAUDE.md new-table rule)

- **Domain: Ops** (Addendum D3). **Owner:** Operations Lead. **Only writer:** `meridian-ops`.
- These are **not** ETF-domain or Entities-domain tables, and neither domain's pipelines may write them. Other Workers and local jobs report only through `POST /api/ops/ingest/run-event`.
- All five tables live in the shared D1 `meridian-etf` (the existing binding `DB` in `wrangler-ops.toml`), as the existing Ops tables do.
- Migration file (build): `App/Ops/migrations/002-ops-control-plane.sql`, using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` only. It is dry-run with `--local` first.

**Conventions**
- Timestamps are ISO-8601 UTC `TEXT`, with the server default `strftime('%Y-%m-%dT%H:%M:%fZ','now')`.
- **Workflow vocabularies are validated in the Worker, not with `CHECK`.** SQLite can only change a `CHECK` by rebuilding the table, and 003 and 004 must be free to add statuses. The exception is the fixed contract enums: `phase`, `event_type` and `actor_source`.
- JSON columns hold display metadata only. Anything filtered or joined on is a normalised, indexed column (Storage Strategy v1 §4).

### 5.2 Tables

#### (1) `ops_job_registry`: the canonical job definition

```sql
CREATE TABLE IF NOT EXISTS ops_job_registry (
  job_id                  TEXT PRIMARY KEY,          -- manifest id: 'cf.meridian-holdings', 'local.entities-enrich-boost', 'manual.catchup-script'; reserved control row 'ops.ingest'
  display_name            TEXT NOT NULL,
  domain                  TEXT NOT NULL,             -- 'ETF','Entities','13F','Ops','FixedIncome'
  owner_role              TEXT NOT NULL,
  execution_mode          TEXT NOT NULL,             -- 'cron','on_request','local_schedule','manual','retired','control'
  worker_name             TEXT NULL,
  source_path             TEXT NULL,
  intended_schedule       TEXT NULL,                 -- JSON (002)
  effective_schedule      TEXT NULL,                 -- JSON (002, from the CF API)
  emitter_id              TEXT NULL,                 -- the ingest identity allowed to report for this job
  ingest_enabled          INTEGER NOT NULL DEFAULT 1, -- per-job ingest switch; on 'ops.ingest' it is the global switch
  expected_max_duration_s INTEGER NULL,              -- for 002's hung/lost detection
  kill_switch_ref         TEXT NULL,                 -- describes the job's OWN switch, e.g. 'hold_all_jobs' (not operated by Ops)
  write_budget_profile    TEXT NULL,                 -- JSON, e.g. {"guard":"DAILY_WRITE_LIMIT=80000","typical_rows_written":...}
  status                  TEXT NOT NULL DEFAULT 'active', -- 'active','held','retired'
  notes                   TEXT NULL,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ops_job_registry_emitter ON ops_job_registry(emitter_id);
```

| Class | Rows at launch | Per month | At 12 months | Retention / prune |
|---|---|---|---|---|
| **Core (Ops)** | **2** in 001 (`ops.ingest` control and the pilot job); 002 takes it to about 48 | 0–2 | about 60 | Keep forever. Jobs are retired with `status='retired'` and never deleted, because run and case history reference `job_id`. |

#### (2) `ops_job_run`: the run ledger (append-only, one row per phase)

```sql
CREATE TABLE IF NOT EXISTS ops_job_run (
  event_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id           TEXT NOT NULL,                 -- emitter-generated UUID, stable across retries
  phase            TEXT NOT NULL CHECK (phase IN ('start','end')),
  event_type       TEXT NOT NULL CHECK (event_type IN ('start','success','partial','skipped','failed','killed')),
  job_id           TEXT NOT NULL,                 -- ops_job_registry.job_id
  emitter_id       TEXT NOT NULL,
  trigger          TEXT NULL,                     -- 'cron:0 6 * * *', 'fetch:/run', 'launchd', 'manual'
  started_at       TEXT NOT NULL,                 -- emitter clock: the run's start (same value on both phases)
  ended_at         TEXT NULL,                     -- end phase only
  duration_ms      INTEGER NULL,
  rows_read        INTEGER NULL,
  rows_written     INTEGER NULL,
  items_processed  INTEGER NULL,
  cursor_before    TEXT NULL,
  cursor_after     TEXT NULL,
  error_class      TEXT NULL,                     -- short code, e.g. 'CF_API_10000', 'TOO_MANY_SUBREQUESTS'
  error_summary    TEXT NULL,                     -- ≤ 500 chars, redacted (§7.6)
  detail           TEXT NULL,                     -- JSON ≤ 2 KB (e.g. {"reason":"headroom"})
  end_only         INTEGER NOT NULL DEFAULT 0,    -- 1 = terminal arrived with no start row (lost start or end-only mode)
  contract_version INTEGER NOT NULL,
  received_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (run_id, phase),
  CHECK ((phase = 'start') = (event_type = 'start'))
);
CREATE INDEX IF NOT EXISTS idx_ops_job_run_job_type_at ON ops_job_run(job_id, event_type, started_at);
CREATE INDEX IF NOT EXISTS idx_ops_job_run_job_at      ON ops_job_run(job_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ops_job_run_received    ON ops_job_run(received_at);
CREATE TRIGGER IF NOT EXISTS trg_ops_job_run_no_update
  BEFORE UPDATE ON ops_job_run BEGIN SELECT RAISE(ABORT, 'ops_job_run is append-only'); END;
```

Why append-only rather than one mutable row per run:
- Every write is a plain `INSERT OR IGNORE`, so the global D1 rule is honoured literally and retries are no-ops by construction.
- "Immutable run history" (Scope v2) is enforced by the trigger, not by convention.
- No counters are ever incremented, so nothing can double-count. All aggregates are computed at read time from distinct rows.

A run's state is derived when read. There are three cases:
- A `start` row with no `end` row means the run is still running, or was lost once it passes `expected_max_duration_s`. Lost detection belongs to 002.
- An `end` row gives the run's outcome.
- An `end` row with `end_only=1` means the start was never received.

| Class | Rows at launch | Per month | At 12 months | Retention / prune |
|---|---|---|---|---|
| **Ephemeral / Operational** | 0 | About 120 with the pilot; about 900 with everything wired (§8.1) | About 5,400 at steady state (capped by retention) | **Keep 180 days.** Prune monthly on the 1st, **manually** with wrangler, following Storage Strategy v1 ("not as a cron Worker"). Deletes go in chunks of 1,000 or fewer: `DELETE FROM ops_job_run WHERE event_id IN (SELECT event_id FROM ops_job_run WHERE received_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-180 days') LIMIT 1000);`, which uses `idx_ops_job_run_received`. Deletes are allowed; only updates are blocked. Cases keep a `run_snapshot`, so pruning never orphans a case. |

#### (3) `ops_exception`: operational failures that need triage

```sql
CREATE TABLE IF NOT EXISTS ops_exception (
  exception_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ref       TEXT NOT NULL UNIQUE,            -- 'EXC-000001', assigned by the Worker
  exception_type TEXT NOT NULL,                   -- e.g. 'job_failed','job_lost','budget_breach','schedule_drift' (003 vocabulary)
  severity       TEXT NOT NULL DEFAULT 'sev3',    -- 'sev1'..'sev4'
  status         TEXT NOT NULL DEFAULT 'open',    -- 003 vocabulary, Worker-validated
  title          TEXT NOT NULL,
  summary        TEXT NULL,
  job_id         TEXT NULL,                       -- link → ops_job_registry
  run_id         TEXT NULL,                       -- link → ops_job_run.run_id
  run_snapshot   TEXT NULL,                       -- JSON copy of key run fields at raise time (survives the 180-day prune)
  object_domain  TEXT NULL,                       -- see §5.3; NULL for pure job failures
  object_key     TEXT NULL,
  object_ref     TEXT NULL,                       -- JSON, compound or original keys
  owner_role     TEXT NULL,
  assignee       TEXT NULL,                       -- verified Access email
  resolution     TEXT NULL,
  resolved_by    TEXT NULL,
  resolved_at    TEXT NULL,
  raised_by      TEXT NOT NULL,                   -- verified identity, 'service:<emitter_id>' or 'legacy:<source>'
  raised_via     TEXT NOT NULL,                   -- 'ops_console','ingest_auto','consumer_screen','migration'
  dedupe_key     TEXT NULL UNIQUE,                -- e.g. 'job_failed:<run_id>', so re-raising is idempotent
  legacy_source  TEXT NULL,                       -- e.g. 'entity_exceptions'
  legacy_id      TEXT NULL,
  opened_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (legacy_source, legacy_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_exception_queue  ON ops_exception(status, severity, opened_at);
CREATE INDEX IF NOT EXISTS idx_ops_exception_job    ON ops_exception(job_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_ops_exception_object ON ops_exception(object_domain, object_key);
```

| Class | Rows at launch | Per month | At 12 months | Retention / prune |
|---|---|---|---|---|
| **Core (Ops)**: human decisions that can't be rebuilt | 0 (003 migrates operational `entity_exceptions` rows, if any) | 5–30 | 500 or fewer | Keep forever. Closed cases stay for audit. |

#### (4) `ops_data_quality_ticket`: data concerns about a domain object

```sql
CREATE TABLE IF NOT EXISTS ops_data_quality_ticket (
  ticket_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ref              TEXT NOT NULL UNIQUE,     -- 'DQ-000001'
  ticket_type           TEXT NOT NULL,            -- e.g. 'missing_lei','entity_merge','bad_relationship_edge','isin_duplicate','missing_mapping' (004 vocabulary)
  severity              TEXT NOT NULL DEFAULT 'sev3',
  status                TEXT NOT NULL DEFAULT 'open',   -- 004 vocabulary
  title                 TEXT NOT NULL,
  summary               TEXT NULL,
  object_domain         TEXT NOT NULL,            -- required: a DQ ticket is always about an object (§5.3)
  object_key            TEXT NOT NULL,
  object_ref            TEXT NULL,                -- JSON (e.g. the legacy source_ref, verbatim)
  source_system         TEXT NULL,                -- 'gleif','sec_edgar','openfigi','nport','firds','internal'
  source_record_ref     TEXT NULL,                -- e.g. an accession number or LEI record id
  field_name            TEXT NULL,
  observed_value        TEXT NULL,
  expected_value        TEXT NULL,
  evidence              TEXT NULL,                -- JSON or text
  proposed_resolution   TEXT NULL,
  disposition           TEXT NULL,                -- 004 vocabulary, e.g. 'fixed','source_absence','valid_exception','pipeline_omission','job_failure','wont_fix' (maps to 006's four-way classification)
  resolution_note       TEXT NULL,
  resolved_by           TEXT NULL,
  resolved_at           TEXT NULL,
  job_id                TEXT NULL,                -- optional link to the job that produced the bad data
  run_id                TEXT NULL,
  linked_exception_ref  TEXT NULL,                -- optional link → ops_exception.case_ref
  owner_role            TEXT NULL,
  assignee              TEXT NULL,
  raised_by             TEXT NOT NULL,
  raised_via            TEXT NOT NULL,            -- 'ops_console','consumer_screen','migration','ingest_auto'
  dedupe_key            TEXT NULL UNIQUE,
  legacy_source         TEXT NULL,
  legacy_id             TEXT NULL,
  opened_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (legacy_source, legacy_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_dq_queue  ON ops_data_quality_ticket(status, severity, opened_at);
CREATE INDEX IF NOT EXISTS idx_ops_dq_object ON ops_data_quality_ticket(object_domain, object_key);
CREATE INDEX IF NOT EXISTS idx_ops_dq_type   ON ops_data_quality_ticket(ticket_type, status);
```

| Class | Rows at launch | Per month | At 12 months | Retention / prune |
|---|---|---|---|---|
| **Core (Ops)** | 0 (004 migrates `entity_exceptions`: the 3 known `entity_merge` rows plus any 22.9 or 22.17 rows present) | 10–50 (the 007 ticket button and 006 follow-ups) | 1,000 or fewer | Keep forever. |

#### (5) `ops_case_event`: the audit trail (append-only, immutable)

```sql
CREATE TABLE IF NOT EXISTS ops_case_event (
  event_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type    TEXT NOT NULL,                  -- 'exception','dq_ticket','job','ops_control'
  subject_id      TEXT NOT NULL,                  -- case_ref ('EXC-…','DQ-…'), job_id, or control key ('ops.ingest')
  event_type      TEXT NOT NULL,                  -- 'created','comment','assigned','status_changed','decision_recorded','linked','migrated','ingest_toggled',…
  from_value      TEXT NULL,
  to_value        TEXT NULL,
  body            TEXT NULL,                      -- comment or rationale text
  payload         TEXT NULL,                      -- JSON
  actor           TEXT NOT NULL,                  -- verified email | 'service:<id>' | legacy verbatim value
  actor_source    TEXT NOT NULL CHECK (actor_source IN ('access_jwt','access_service_token','ingest_key','system','legacy_migration')),
  actor_role      TEXT NULL,
  occurred_at     TEXT NOT NULL,                  -- when it happened (legacy decided_at is preserved here)
  recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  idempotency_key TEXT NULL UNIQUE                -- e.g. 'mig:entity_exceptions:3:decision'
);
CREATE INDEX IF NOT EXISTS idx_ops_case_event_subject ON ops_case_event(subject_type, subject_id, occurred_at);
CREATE TRIGGER IF NOT EXISTS trg_ops_case_event_no_update
  BEFORE UPDATE ON ops_case_event BEGIN SELECT RAISE(ABORT, 'ops_case_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_ops_case_event_no_delete
  BEFORE DELETE ON ops_case_event BEGIN SELECT RAISE(ABORT, 'ops_case_event is append-only'); END;
```

| Class | Rows at launch | Per month | At 12 months | Retention / prune |
|---|---|---|---|---|
| **Core (Ops)**: audit | 0–2 in 001 (control toggles, if exercised) | 50–300 | 4,000 or fewer | **Keep forever. No prune.** The delete trigger enforces this; dropping the trigger requires an Architect-reviewed CR. |

`subject_type` is not a `CHECK`, so 003–005 can add subjects. `occurred_at` and `recorded_at` are kept apart so that migrated history keeps its real time.

**Growth check:** every table stays under 10k rows and under 10 MB at 12 months, far below Storage Strategy v1's 500k-row / 500 MB Architect trigger.

### 5.3 How cases link to jobs, runs and domain objects

```text
ops_job_registry.job_id ──< ops_job_run.job_id                (run history)
ops_job_run.run_id ──────< ops_exception.run_id               (+ run_snapshot copy)
ops_job_registry.job_id ─< ops_exception.job_id / ops_data_quality_ticket.job_id
ops_exception.case_ref ──< ops_data_quality_ticket.linked_exception_ref  (e.g. a failed enrich run → the LEIs it left missing)
(any case).case_ref ─────< ops_case_event.subject_id           (audit)
(any case).(object_domain, object_key) → a domain object, read-only (never an FK: cross-domain, and Ops never writes there)
```

| `object_domain` | `object_key` (canonical, never a name) | Source of truth (read-only to Ops) |
|---|---|---|
| `entity` | `entity_master.entity_id` (integer as text) | Entities |
| `instrument` | `instrument_master.instrument_key` | Entities |
| `etf` | `etf_master` primary key (the build confirms the column from `sqlite_master`) | ETF |
| `filing` | SEC accession number | 13F / Fixed Income |
| `bond` | the MA-OCT-008 bond key (defined by 008; the column needs no change) | Fixed Income |
| `source_record` | `<system>:<id>`, e.g. `gleif:<LEI>`, `firds:<ISIN>` | External |

`idx_*_object` lets an entity, instrument or bond page (007, 010) list its open tickets with a single index seek. The Worker validates key format per domain, for example that `entity` keys are numeric.

### 5.4 `entity_exceptions` migration path (design only; executed in 003/004)

The design guarantees that `decided_by` and `decided_at` survive **byte-for-byte**, and that re-running the migration is a no-op.

| `entity_exceptions` | Target (`ops_data_quality_ticket` for `entity_merge`, `bad_relationship_edge`, `isin_duplicate` per Addendum §4; `ops_exception` for any operational type) |
|---|---|
| `id` | `legacy_source='entity_exceptions'`, `legacy_id=id` (UNIQUE, so `INSERT OR IGNORE` makes a re-run a no-op) |
| `exception_type` | `ticket_type` / `exception_type` (verbatim) |
| `source_table`, `source_ref` | `object_ref` = `{"source_table":…, "source_ref":<verbatim JSON>}`; `object_domain='entity'`, `object_key`=`entity_id_a` (or the first entity id in `source_ref`) |
| `flagged_reason` | `summary` |
| `evidence`, `proposed_resolution` | same-named columns |
| `decision` | `disposition` (verbatim); `status` = `'open'` if `pending`, else `'resolved'` |
| `corporate_action_note` | `resolution_note` |
| `decided_by` | `resolved_by` **and** the actor on the `decision_recorded` event (verbatim) |
| `decided_at` | `resolved_at` **and** `occurred_at` on the `decision_recorded` event (verbatim) |
| `created_at` | `opened_at` |

Audit events per migrated row, written with `INSERT OR IGNORE`, each carrying an `idempotency_key`:

1. `created`: `occurred_at=created_at`, `actor='legacy:entity_exceptions'`, `actor_source='legacy_migration'`.
2. If a decision exists, `decision_recorded`: `actor=decided_by` (verbatim), `actor_source='legacy_migration'`, `occurred_at=decided_at`, `to_value=decision`, `body=corporate_action_note`, key `mig:entity_exceptions:<id>:decision`.
3. `migrated`: `occurred_at=now`, with the actor being the **Access identity of the person running the migration**.

`actor_source='legacy_migration'` records honestly that pre-015b values such as `'Founder (MA-SEP-007)'` were free text, not verified by JWT. Row-for-row verification in 003/004 compares `decided_by` and `decided_at` against a pre-migration dump. The `/exceptions/ui` page and routes are retired in 003/004, not in 001.

---

## 6. Authentication model

### 6.1 Route classes (every route after 001)

| # | Method + path | Class | Auth |
|---|---|---|---|
| 1 | GET `/api/ops/sprint-board` | legacy read | public (unchanged) |
| 2 | GET `/api/ops/release-ledger` | legacy read | public (unchanged) |
| 3 | GET `/api/ops/events` | legacy read | public (unchanged) |
| 4 | GET `/api/ops/drift` | legacy read | public (unchanged) |
| 5 | GET `/api/ops/budget-risk` | legacy read | public (unchanged) |
| 6 | GET `/api/ops/openfigi-status` | legacy read | public (unchanged) |
| 7 | GET `/api/ops/cf/invocations` | legacy read | public (unchanged; the CF token stays server-side) |
| 8 | GET `/api/ops/cf/d1-today` | legacy read | public (unchanged) |
| 9 | POST `/api/ops/admin/sprint-board` | **mutation** (moved) | **Access + Worker JWT verify** |
| 10 | POST `/api/ops/admin/sprint-board/:id/stage` | **mutation** (moved) | **Access + Worker JWT verify** |
| 11 | POST `/api/ops/admin/release-ledger` | **mutation** (moved) | **Access + Worker JWT verify** |
| 12 | POST `/api/ops/admin/release-ledger/:id/event` | **mutation** (moved) | **Access + Worker JWT verify** |
| 13 | GET `/api/ops/admin/jobs` (fleet, or `?job_id=` for run history) | new Ops read | **Access + Worker JWT verify** |
| 14 | POST `/api/ops/ingest/run-event` | **service mutation** | **per-emitter key** (§6.3) |
| — | Old POST paths (`/api/ops/sprint-board`, `…/stage`, `/api/ops/release-ledger`, `…/event`) | deny rule, not an endpoint | always `401 {"error":"moved to /api/ops/admin/…; authentication required"}`, and nothing is written |

(Correction to the MA-OCT-000 count: today there are 12 method+path endpoints, and 4 of them are POSTs, not 3. The deny rule covers all four.)

**New Ops data is Access-only, even for reads.** Run error summaries and case contents are operational internals and must not be readable from the public site. Whether the 8 legacy reads stay public is 005's decision.

### 6.2 Human mutations: Cloudflare Access (MA-SEP-015b precedent)

- **Founder step (Zero Trust dashboard):** create an Access application named "meridian-ops admin", covering `meridian-ops.navinmv1981.workers.dev/api/ops/admin`. Its Allow policy uses the **same identity list as the MA-SEP-015b `/exceptions` app** (the Founder only, unless another operator is named at build). 015b proved that path-scoped Access on `workers.dev` works on this account.
- **Worker defence in depth:** `meridian-ops` re-verifies `Cf-Access-Jwt-Assertion` on **every** `/api/ops/admin/*` request, whatever the method. It checks the RS256 signature against `https://<team>/cdn-cgi/access/certs` (JWKS cached in isolate memory), `aud`, `iss` and `exp`. The code is a vendored copy of `verifyAccessJwt()` from `entities-api.js`.
- **Fail closed:** if `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` is missing, every admin route returns 401. Both are plain `[vars]` in `wrangler-ops.toml`: they are identifiers, not credentials, following the entities-api precedent. This app gets **its own AUD**; it does not reuse 015b's.
- **Identity:** the `actor` is the JWT's `email` claim. An Access **service token** (`common_name` claim) is accepted as `service:<common_name>` with `actor_source='access_service_token'`, for scripted Main Lane or Engineering calls (P1). The request body's `actor_role` is still recorded as a *role label*, but identity always comes from the JWT. Legacy `operationalevents` rows get the verified identity in `payload.actor`, with no schema change to that table.
- **CORS:** `/api/ops/admin/*` and `/api/ops/ingest/*` return **no** `Access-Control-Allow-Origin`, and OPTIONS returns 204 with no allowances. They are same-origin or non-browser only until 005 names the console's origin. The legacy reads keep `*`.

### 6.3 Service-to-service heartbeats: decision

| Option | Serves Workers? | Serves local LaunchAgents and manual scripts? | Needs a CR? | Notes |
|---|---|---|---|---|
| **A. Per-emitter shared secret** on a public ingest route | Yes | **Yes** | No (new secrets and vars only) | Enforced by the Worker, revocable per emitter, and follows the `RUN_AUTH_SECRET` precedent |
| B. Service binding (with an RPC entrypoint) | Yes | **No** | **Yes** (none exist today) | Removes the public hop for Workers only, so A is still needed for local jobs |
| C. Access service token per emitter | Yes | Yes | No | Adds an edge hop and a Zero Trust dependency to every heartbeat. Workers.dev-to-workers.dev fetch caveats apply as for A. |

**Decision: A, now.** B stays P2 (a later CR, if the Worker-to-Worker hop proves troublesome in 002). Because B cannot serve the 35 local and manual jobs, a public, key-authenticated ingest route is needed whatever else is chosen.

A works like this:
- Emitters send the headers `X-Ops-Emitter: <emitter_id>` and `X-Ops-Ingest-Key: <key>`.
- `meridian-ops` holds the secret `OPS_INGEST_KEYS`, a JSON map `{emitter_id: sha256_hex(key)}`. **It stores hashes, not keys.** It hashes the presented key with `crypto.subtle.digest` and compares in constant time.
- The request's `job_id` must be registered with `emitter_id` equal to the header value, or it gets a 403. A key leaked for one emitter therefore cannot write runs for another job.
- Keys are 32 random bytes, base64url-encoded. They are rotated by adding the new hash, updating the emitter, then removing the old hash.
- Emitter storage:
  - **Worker emitters (002):** a Worker secret `OPS_INGEST_KEY` plus a `[vars]` `OPS_INGEST_URL`.
  - **Local emitters:** `App/Corporate Atlas/.env.ops-ingest`. It is already gitignored by the `.env.*` rule, and it follows the pattern of `.env.entities-enrich-run`.

**Platform risk for 002 (not 001):** Cloudflare can refuse a fetch from one `workers.dev` Worker to another on the same account (error 1042). The first Worker emitter in 002 must verify this. If it is refused, the fallbacks are:
1. The compatibility flag `global_fetch_strictly_public` on the emitter (Architect review).
2. Option B (CR).

001's recommended pilot is local (Q1), so 001 does not depend on this.

### 6.4 Proof that no anonymous mutation route exists

- **Today:** 4 anonymous POSTs mutate `sprintboarditems`, `releaseledger` and `operationalevents`, with CORS `*`. The public `ma-ops.js` Sprint Board stage button and Release Ledger event button call two of them.
- **After 001:** every write path is either behind Access with a Worker-verified JWT (routes 9–12), or behind a per-emitter key (route 14). The old paths are an explicit deny.
- **Verified at build by AC4 and AC5:**
  - an unauthenticated call to each mutation route fails;
  - a table-level `COUNT(*)` before and after shows 0 rows landed;
  - a static check confirms the router has no POST branch outside `/api/ops/admin/` and `/api/ops/ingest/`.

### 6.5 Proof that no secret reaches the front end

- `ma-ops.js` and `ma-data.js` hold only the public base URL (`OPS_WORKER_BASE`), and 001 changes neither file.
- Browser authentication is the Access `CF_Authorization` cookie, which Cloudflare manages and scopes to the Access-protected hostname. No token is ever in JavaScript.
- The ingest keys exist only as Worker secrets (hashed in `meridian-ops`) and in gitignored local `.env.*` files.
- **Verified at build by AC10:** a grep of `App/` and `docs/` for `OPS_INGEST`, `X-Ops-Ingest-Key`, `CF_Authorization` and the key prefix finds no matches. `wrangler-ops.toml` contains no secret values.

---

## 7. Heartbeat and run-event contract (v1)

### 7.1 Endpoint

`POST https://meridian-ops.navinmv1981.workers.dev/api/ops/ingest/run-event`, with headers `Content-Type: application/json`, `X-Ops-Emitter` and `X-Ops-Ingest-Key`. The body may be 8 KB at most.

```json
{
  "v": 1,
  "run_id": "7f1c1d2e-…",                     // crypto.randomUUID(), generated once per run; reused on retries
  "job_id": "local.entities-enrich-boost",
  "event": "success",                          // start | success | partial | skipped | failed | killed
  "trigger": "launchd",
  "started_at": "2026-10-02T10:50:01.123Z",   // required on every event
  "ended_at": "2026-10-02T10:50:09.870Z",     // terminal only
  "duration_ms": 8747,                          // terminal only
  "rows_read": 1204, "rows_written": 131, "items_processed": 44,   // null if unknown, never guessed
  "cursor": { "before": "offset=31", "after": "offset=58" },       // optional
  "error": { "class": "CF_API_10000", "summary": "wrangler d1 execute failed …" },  // failed or killed
  "detail": { "reason": "headroom", "headroom": 3200 }             // optional, ≤ 2 KB
}
```

### 7.2 Event semantics

| Event | Phase | Meaning | Required extras |
|---|---|---|---|
| `start` | start | The run has begun and passed its own preconditions | none |
| `success` | end | All intended work for this run is done | `duration_ms` |
| `partial` | end | Did some work and stopped at a designed checkpoint or guard, with work remaining (for example holdings `31/237`, or enrich's subrequest checkpoint) | `cursor.after` where the job has one |
| `skipped` | end | Ran and deliberately did nothing: hold flag, pause flag, insufficient headroom, or an empty queue | `detail.reason` |
| `failed` | end | An error ended the run | `error.class`, `error.summary` |
| `killed` | end | Stopped mid-run by an external control: hold flipped mid-loop, operator stop, or a caught platform limit | `error.class` or `detail.reason` |

A run that Cloudflare kills and cannot catch (CPU or wall-clock limit) sends no end event. It shows as `start` with no `end`, and 002's read-time lost-run rule (`expected_max_duration_s`) flags it. This is the reason `start` is valuable.

### 7.3 Server behaviour and responses

Checks run in this order, and each one exits early:

1. Check the `OPS_INGEST_ENABLED` var: 0 D1 reads.
2. Authenticate the emitter.
3. Validate the schema: types, enums, `started_at` between now − 7 days and now + 5 minutes, and field sizes.
4. Run one registry query for the job row plus the `ops.ingest` row. This covers the global and per-job switches and the emitter match.
5. Apply the daily cap.
6. `INSERT OR IGNORE`.

| Status | Body | When |
|---|---|---|
| 201 | `{"ok":true,"recorded":true}` | New row |
| 200 | `{"ok":true,"recorded":false,"reason":"duplicate"}` | The same `(run_id, phase)` already exists. This covers retries **and** a conflicting second terminal: the first terminal wins, and the conflict is logged to the console only. |
| 202 | `{"ok":true,"recorded":false,"reason":"ingest_disabled"\|"job_ingest_disabled"\|"daily_cap"}` | A kill switch is active (§8.4) |
| 400 | `{"ok":false,"error":…}` | Validation failed |
| 401 / 403 | — | Bad or missing key / the emitter isn't allowed for this `job_id` |
| 422 | `{"ok":false,"error":"unknown_job"}` | `job_id` isn't registered (normal until 002 populates the registry) |

A **terminal event with no start row** is accepted and recorded with `end_only=1`. Emitters under subrequest pressure may choose end-only mode, which costs 1 fetch per run instead of 2.

### 7.4 Idempotency (a retry never double-counts)

- The emitter generates `run_id` **once per run** and reuses it on any retry, so the pair `(run_id, phase)` identifies an event.
- `UNIQUE(run_id, phase)` with `INSERT OR IGNORE` makes a duplicate a guaranteed no-op, even if two retries race.
- Ops keeps **no counters**. Run counts, success rates and rows written are aggregated at read time over distinct rows. A retried heartbeat cannot inflate anything, and a lost heartbeat under-reports honestly (it shows as start-only or missing) rather than being invented.
- Exceptions raised automatically from runs (003) use `dedupe_key='job_failed:<run_id>'`, which makes raising idempotent too.

### 7.5 Emitter rules: jobs never fail because Ops is unreachable

1. **Never on the critical path.** Workers call `ctx.waitUntil(sendOpsEvent(…))` and never `await` it in the job's flow. Local Node jobs `await` it with a **2 s ceiling** before `process.exit`, because exit would otherwise abort an in-flight fetch.
2. **Timeout.** Use `AbortSignal.timeout(2000)`. Workers make 0 retries (to save subrequest budget). Local jobs may retry once, reusing the same `run_id`.
3. **Swallow everything.** Network errors, timeouts and any non-2xx response are caught and logged with `console.warn` only. The job's status, return value, exit code and own logs are unchanged.
4. **No-op if unconfigured.** A missing `OPS_INGEST_URL` or key means the emitter silently does nothing. Deleting the env file or secret is therefore an emitter-side kill switch.
5. **Subrequest accounting (Workers, 002).** A heartbeat fetch counts against the Free-plan limit of 50 subrequests per invocation. For example, enrich runs a checkpoint of 44 with a designed 4-subrequest margin (MA-SEP-009). Every Worker emitter must reserve its heartbeat fetches in its own checkpoint, or use end-only mode. Changing a Worker's checkpoint is a domain change and is reviewed by that domain's lead in 002.
6. **Contract version.** Every event carries `"v":1`. Ops rejects unknown versions with 400, which the emitter ignores. A breaking change bumps `v`, and Ops accepts both versions during a transition.

Reference emitter (vendored into each emitter with no cross-folder imports, at about 25 lines):

```js
// ops-heartbeat (contract v1). Fire-and-forget. Never throws.
async function sendOpsEvent(cfg, evt) {
  if (!cfg || !cfg.url || !cfg.key || !cfg.emitter) return;          // unconfigured → no-op
  try {
    await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
                 'X-Ops-Emitter': cfg.emitter, 'X-Ops-Ingest-Key': cfg.key },
      body: JSON.stringify({ v: 1, ...evt,
        error: evt.error ? { class: String(evt.error.class || 'ERROR').slice(0, 64),
                             summary: redact(String(evt.error.summary || '')).slice(0, 500) } : null }),
      signal: AbortSignal.timeout(2000)
    });
  } catch (e) { console.warn('[ops-heartbeat] not delivered:', e && e.name); }
}
function redact(s) {
  return s.replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
          .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}
// Worker:  ctx.waitUntil(sendOpsEvent(cfg, {...}))
// Node:    await Promise.race([sendOpsEvent(cfg, {...}), new Promise(r => setTimeout(r, 2000))])
```

### 7.6 Redaction

Emitters redact error summaries before sending, and `meridian-ops` applies the same `redact()` again before storing. Summaries are capped at 500 characters and `detail` at 2 KB. Stack traces, headers and URLs with query strings are never sent. This matters because error text reaches D1, and later the console.

---

## 8. D1 budget and the three-point check

### 8.1 Projected writes per day

Assumptions:
- Each recorded event costs about 5 row-writes: 1 row plus 4 index entries. This is conservative against the 2.56–3.69× multiplier observed in August.
- Run counts come from the MA-OCT-000 manifest.

| Scenario | Runs per day | Events | Run-ledger row-writes | Case and audit row-writes | **Total per day** | % of 100k |
|---|---|---|---|---|---|---|
| **001, pilot only** (boost, 11:50 and 17:50) | 2 | 4 | 20 | about 0 | **about 20** | 0.02% |
| **002, all 16 scheduled or deployed jobs plus manual jobs wired, bootstrap still firing 6× a day** | about 15.4: enrich 2, bootstrap 6, boost 2, financialfact 1, health-check 1, plus 3 weekly jobs ÷ 7 and about 3 manual | about 31 | about 155 | about 55 (about 10 case events × 3, about 5 case writes × 5) | **about 210** | 0.21% |
| Same, after the bootstrap cron is retired | about 9.4 | about 19 | about 95 | about 55 | **about 150** | 0.15% |
| **Hard ceiling** (daily cap of 1,000 events) | — | 1,000 | 5,000 | — | **5,000 at most** | 5% |
| Monthly prune (1st of the month, run manually on a non-Sunday) | — | — | about 900 deletes × 5 ≈ 4,500 | — | once a month | 4.5% that day |

- Sunday is the only day near the cap (F3). Ops adds about 0.2% there.
- `meridian-ops` **never writes** `writes_today_*` keys. Those belong to the ETF and Entities guards in `holdings_pipeline_state`.
- **Storage:** less than 5 MB a year across all five tables.

### 8.2 Reads per Ops API call and the query plan intent

| Query | Route | `EXPLAIN QUERY PLAN` intent | Rows read per call |
|---|---|---|---|
| Q1 registry lookup: `SELECT job_id, emitter_id, ingest_enabled, status FROM ops_job_registry WHERE job_id IN (?, 'ops.ingest')` | ingest | `SEARCH ops_job_registry USING INDEX sqlite_autoindex_ops_job_registry_1 (job_id=?)` | 2 |
| Q2 daily cap: `SELECT COUNT(*) FROM ops_job_run WHERE received_at >= ?` (UTC midnight) | ingest | `SEARCH ops_job_run USING COVERING INDEX idx_ops_job_run_received (received_at>?)` | events so far today: about 4–31 typical, 1,000 at most |
| Q3 `INSERT OR IGNORE INTO ops_job_run …` | ingest | unique-index probe on `(run_id, phase)` | about 1 |
| Q4 fleet: `SELECT r.*, (SELECT MAX(started_at) FROM ops_job_run WHERE job_id=r.job_id AND event_type='start'), …'success'…, …'failed'…, (SELECT MAX(started_at) FROM ops_job_run WHERE job_id=r.job_id AND event_type<>'start') FROM ops_job_registry r ORDER BY r.domain, r.job_id` | GET admin/jobs | `SCAN ops_job_registry` (**60 rows or fewer**, Ops-owned and bounded; same precedent as the 59-row `holdings_pipeline_state` SCAN accepted in MA-OCT-000 Q2) + `USE TEMP B-TREE FOR ORDER BY` + 4 × correlated `SEARCH ops_job_run USING COVERING INDEX idx_ops_job_run_job_type_at (job_id=? AND event_type=?)` (the 4th uses a range on event_type) | about 60 + 4 × 60 = **about 300** |
| Q5 run history: `SELECT … FROM ops_job_run WHERE job_id=? ORDER BY started_at DESC, phase LIMIT ?` (limit 100 or fewer) | GET admin/jobs?job_id= | `SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at (job_id=?)` (no temp sort on `started_at`) | **100 or fewer** |
| Q6 prune (manual, monthly) | wrangler | `SEARCH ops_job_run USING COVERING INDEX idx_ops_job_run_received (received_at<?)` inside the `IN` subquery | 1,000 or fewer per chunk |
| Legacy admin POSTs | routes 9–12 | unchanged from today (point queries on PK) | unchanged; JWT verification reads JWKS over HTTP, not D1 |

- **Budget per invocation (Team v3 rule 3):** ingest reads about 35 rows typically and about 1,005 at worst, and writes about 5 row-writes. The fleet route reads about 300. Run history reads 101 or fewer. The build **writes this as a header comment in `ops-api.js`**, updating the existing READ/WRITE BUDGET block.
- **Daily read projection:** ingest is about 31 × 35 ≈ 1.1k. With the future console (005), about 50 fleet views × 300 ≈ 15k. The total is 0.3% of 5M or less.
- **Large tables:** no route touches `fund_holdings_monthly` or any other large table. No new query reads any non-Ops table.

### 8.3 Three-point check

| Point | How 001 satisfies it | Evidence the build must produce |
|---|---|---|
| 1. Index audit | Every query above has a SEARCH plan on a named index. The only SCAN is Q4 on the 60-row-or-fewer `ops_job_registry`, which is declared and bounded. | `EXPLAIN QUERY PLAN` output for Q1–Q6, run against the remote DB after migration, pasted into the close-out. **Any unexpected SCAN means stop.** |
| 2. Single-execution read test (under 50k) | Worst case per call is about 1,005 reads | One live call per new route, with `meta.rows_read` recorded from the D1 result |
| 3. Documented read/write budget | §8.1–8.2, plus the header comment | Header comment diff in the close-out |
| (Cron check) | Not applicable: 001 adds **no** cron or scheduled handler | — |

### 8.4 Kill switch (three layers, fastest first)

1. **Hard switch (0 D1 reads):** `OPS_INGEST_ENABLED="false"` in `wrangler-ops.toml [vars]`, then `wrangler deploy`. Ingest returns 202 before touching D1.
2. **Soft switch in D1 (no deploy):**
   - `UPDATE ops_job_registry SET ingest_enabled=0 WHERE job_id='ops.ingest'` turns ingest off globally.
   - The same update with a specific `job_id` turns it off for one job.
   - The build runs this with `wrangler d1 execute` in a `--file` batch together with an `ops_case_event` row (`subject_type='ops_control'`, `event_type='ingest_toggled'`).
   - An admin toggle route is **not** added in 001; it would be the 15th route (§10). 002 or 005 may add one.
3. **Automatic cap:** `OPS_INGEST_DAILY_EVENT_CAP` (var, default **1000**). Once today's event count reaches the cap, further events return 202 `daily_cap`. This bounds Ops at 5,000 row-writes a day, or 5%, whatever an emitter does.

**Emitter side:** removing the emitter's key or URL makes it a no-op (§7.5). Also, Ops ingest deliberately **does not** obey `hold_all_jobs`. Ops must keep observing while jobs are held, and a held job emitting `skipped` is exactly the signal wanted.

---

## 9. Cron-slot plan (Architect N3)

- **001 needs no cron.** It adds no `[triggers]` and no `scheduled()` handler, so the account stays at 5 of 5 slots.
- **Does Ops need a scheduled sweep at all? Yes, in 002, for alerting.** Lateness and lost-run *display* can be computed at read time (Q4 plus the registry schedule), which needs no cron. But F5 shows that silence is the failure mode that matters: a dead job alerts nobody unless something runs on a clock. Read-time computation only helps when someone is already looking.
- **Recommended source for that slot:** retire the `meridian-bootstrap` cron (`status=complete` since 11 June, still firing 6 times a day), **together with** auth-gating or removing its unauthenticated `/trigger` (N1).
  - This is **a prerequisite for 002, not an action in 001.**
  - It is owned by the **ETF Product Lead** (consulted) and needs a **CR** with Architect review.
  - Its three-point impact is a reduction: bootstrap's reads and writes go away.
- **Fallbacks, if the ETF Product Lead or the Founder declines:**
  - (a) Revive the dead local `health-check` LaunchAgent (F5) as the sweep caller: no slot needed, but it depends on the Mac being awake.
  - (b) Consolidate enrich's two triggers into one: this is an Entities change and is not recommended during 006.
  - (c) Read-time only, with no alerting: this accepts F5-class risk.
- **Founder question Q3** asks for authority to put this prerequisite into 002's spec.

## 10. Worker size (split rule: 15 routes or about 1,500 lines)

| | Today (`589ae24c` source) | After 001 (estimate) |
|---|---|---|
| Routes (method + path endpoints) | 12 | **14** (8 public reads, 4 admin POSTs, 1 admin read, 1 ingest) plus the legacy deny rule |
| `src/ops-api.js` lines | 507 | **about 950–1,050**: +90 JWT verify (vendored), +170 ingest (auth, validation, redaction, switches), +90 fleet and history reads, +40 routing, CORS and the deny rule, +30 budget header |

**Verdict:** 001 stays under both limits, with **1 route of headroom**. 002 (schedules sync, drift), 003 (about 4–5 exception routes) and 004 (about 4–5 ticket routes) will certainly cross 15. **An Architect decision is required before 002's spec is approved**, not in 001. The options, in the Ops Lead's order of preference:

1. **Move the Program Orchestrator governance routes** (sprint-board and release-ledger: 6 endpoints) into a separate `meridian-control` Worker. This keeps `meridian-ops` purely the operational control plane, but it needs a decision on whether `sprintboarditems`, `releaseledger` and `operationalevents` stay Ops-domain under a second writer.
2. **Resource-style routing** (`/api/ops/admin/cases/:kind/:ref/:action`) to hold the endpoint count down. This is cheap but pushes against the spirit of the rule.
3. **Split `meridian-ops` into read and ingest Workers.** This conflicts with D3's "only `meridian-ops` writes `ops_*`" unless D3 is amended.

## 11. Boundaries: what 001 builds and what it doesn't

| Item | 001 | Later |
|---|---|---|
| 5 tables, indexes and triggers (§5) | **Builds** | — |
| Control row `ops.ingest` and **one** pilot registry row | **Builds** (2 `INSERT OR IGNORE`) | 002 imports the other roughly 46 rows from `MA-OCT-000_job_manifest.json` (`INSERT OR IGNORE`, so re-runs are safe) |
| Access app, JWT verification, admin prefix, legacy POST deny | **Builds** | 005 decides the console origin and CORS |
| Ingest route, contract v1, kill switches, cap | **Builds** | — |
| Fleet and run-history reads (raw state only; no health or lateness computation) | **Builds** | 002 adds health, lateness, drift and the effective schedule (needs the Workers-Read token from ruling 1) |
| Pilot emitter | **One** (Q1; recommended: local `entities-enrich-boost-run.mjs`) | 002 wires the rest, with ETF Product Lead review for ETF Workers and Data-Identity Lead review for Entities Workers |
| Exception and DQ create, assign and transition routes; auto-raise from failed runs | Schema only | 003 and 004 |
| `entity_exceptions` migration and `/exceptions/ui` retirement | Mapping only (§5.4) | 003 and 004 (CR plus Architect review) |
| `ma-ops.js`, `ma-data.js`, `index.html` | **No change** | 005 |
| Bootstrap cron retirement and `/trigger` gating | **No** | 002 prerequisite (ETF Product Lead, CR) |
| Service binding, new Worker, new cron | **No** | P2 / §10 / §9 |

**Pilot change (if Q1 = A):**
- In `App/Corporate Atlas/entities-enrich-boost-run.mjs`, add a vendored `sendOpsEvent` and 3 call sites:
  - `start` after the pre-flight passes;
  - `skipped` on `skipped_headroom`;
  - `failed` on error;
  - `success` or `partial` after `/run` returns, using the Worker's response fields where present, else `null`.
- It reads `.env.ops-ingest`, and the file's absence means no-op.
- The pilot's registry row is `local.entities-enrich-boost`, emitter `boost-local`.
- This is an Entities-domain script, so the **Data-Identity Lead acknowledges** the change as its owner. It doesn't change `/run`, headroom logic or enrich itself, so it doesn't disturb MA-OCT-006's evidence and in fact adds run-level evidence to it.

## 12. Build housekeeping: one guarded write (Architect finding 8)

The live `sprintboarditems` `stage` and `status` `CHECK` constraints (from migration `001-ops-schema.sql`) have **no `SUPERSEDED` value**. The marker therefore goes into `notes`, and the row closes. The build confirms the constraint from `sqlite_master` first.

```sql
-- Preflight (1 row read): expect title='Data Quality Exception Management tool', stage='IDEA'. Capture the full row for rollback.
SELECT ticket_id, title, stage, status, notes, updated_at FROM sprintboarditems WHERE ticket_id = 'MA-OCT-001';

-- Guarded write (run as one --file batch with its audit row). Expect changes = 1; if 0 → STOP and report, do not retry.
UPDATE sprintboarditems
SET stage = 'CLOSED', status = 'CLOSED',
    notes = 'SUPERSEDED → MA-OCT-003/004 (Architect F8, MA-OCT-000 review 2026-09-24; legacy spec claude/MA-OCT-001-LEGACY_DQ_Exception_Spec.md). ' || COALESCE(notes, ''),
    updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'MA-OCT-001'
  AND title = 'Data Quality Exception Management tool'
  AND stage <> 'CLOSED';
INSERT INTO operationalevents (event_type, ticket_id, actor_role, payload)
VALUES ('ticket_state_changed', 'MA-OCT-001', 'Engineering Lead',
        '{"from_stage":"IDEA","to_stage":"CLOSED","superseded_by":["MA-OCT-003","MA-OCT-004"],"source":"MA-OCT-001 build housekeeping"}');
```

**Note for the Main Lane (not a Founder question):** because `ticket_id` is the primary key, register v3's "MA-OCT-001 = Ops backend foundation" **cannot have its own D1 row** while the August row holds that ID. The Program Orchestrator should decide how the October packet is represented on the D1 board, for example as a note on the closed row or as a suffixed ID.

---

## 13. Requirements, acceptance criteria and test plan

### 13.1 Requirements

**P0 (must ship)**
- R1. The §5 schema, exactly as specified, is migrated with `IF NOT EXISTS`, local dry run first.
- R2. The §6 auth: Access app, JWT verification that fails closed, the admin prefix, the legacy deny, and CORS tightened.
- R3. The §7 ingest route with contract v1, idempotency and redaction.
- R4. The §8.4 kill switches (layers 1–3) and the budget header comment.
- R5. The `GET /api/ops/admin/jobs` fleet and run-history reads.
- R6. The control row, the pilot registry row and the pilot emitter (per Q1).
- R7. The §12 housekeeping write.

**P1 (fast follow in 001 if time allows, otherwise 002)**
- Access service-token support for scripted admin calls.
- A contract test script `App/Ops/tests/ingest-contract.mjs` (curl-equivalent, reusable by 002 for every emitter).

**P2 (design for, don't build)**
- Service-binding RPC ingest for Worker emitters.
- An admin toggle route for ingest switches.
- Many-to-many case links.
- Progress heartbeats for long local backfills.

### 13.2 Acceptance criteria (Given/When/Then, checked in the close-out)

| # | Criterion |
|---|---|
| AC1 | Given the migration has run, **then** `sqlite_master` shows the 5 tables, 11 indexes, 3 triggers and 0 other changes. It is diffed against §5, and the pre-migration `SELECT name FROM sqlite_master WHERE name LIKE 'ops_%'` returns none. |
| AC2 | `EXPLAIN QUERY PLAN` for Q1–Q6 matches §8.2. The only SCAN is Q4 on `ops_job_registry`. |
| AC3 | Each new route, executed once, shows `meta.rows_read` under 50k (expected: 1,100 or fewer) and is recorded. |
| AC4 | **Auth matrix** (each checked at the table level with `COUNT(*)` before and after): routes 9–13 without Access → 302, 401 or 403 and 0 rows; with a forged or wrong-`aud` JWT sent directly → 401; with a valid Access session → 2xx. Ingest with no key → 401; a wrong key → 401; emitter A's key for emitter B's job → 403; all with 0 rows. |
| AC5 | All 4 legacy POST paths → 401, with `sprintboarditems`, `releaseledger` and `operationalevents` counts unchanged. |
| AC6 | **Idempotency:** the same `start` twice → 1 row; the same `end` twice → 1 row; a `success` then a `failed` for the same `run_id` → 1 end row (the first wins, and the response is `duplicate`); an end-only event → 1 row with `end_only=1`. |
| AC7 | **Kill switches:** env `false` → 202 and **0 D1 reads** (confirmed in the Worker's log); the D1 global switch → 202; the per-job switch → 202 for that job only; the cap set to 3 on a test → the 4th event gets 202 `daily_cap`. Each toggle writes an `ops_case_event` row. |
| AC8 | **Ops-down resilience:** the pilot job is run with `OPS_INGEST_URL` pointing at an unroutable address (such as `https://10.255.255.1`), and separately at a path returning 500. The job's exit code and run-log outcome are identical to a control run, and the added wall time is 2.5 s or less. |
| AC9 | **Pilot evidence:** at least 2 consecutive days and at least 4 fires each have a start and an end row. The event type matches the job's own run log (`success` / `skipped_headroom` → `skipped` / `error` → `failed`). The boost evening failure (F6), if it recurs, is recorded as `failed` with `error_class`. |
| AC10 | **No secrets in the front end:** the grep in §6.5 finds 0 matches in `App/` and `docs/`; `wrangler-ops.toml` has no secret values; `wrangler secret list` shows `OPS_INGEST_KEYS`; `.env.ops-ingest` is ignored (`git check-ignore`). |
| AC11 | **Append-only:** with `--local`, an `UPDATE` on `ops_job_run` or `ops_case_event`, and a `DELETE` on `ops_case_event`, each abort with the trigger message. On remote, a `DELETE` on `ops_job_run` still works (the prune path). |
| AC12 | The housekeeping `UPDATE` reports `changes = 1`, and the preflight row is captured in the close-out. |
| AC13 | Route table and line count in the close-out: 15 routes or fewer and 1,500 lines or fewer. |
| AC14 | The build's total D1 usage is 500 row-writes or fewer and 50k reads or fewer, measured with `/api/ops/cf/d1-today` before and after and the per-statement `meta`. |
| AC15 | **No regression:** the 8 legacy GET routes return the same shapes, and the `ma-ops.js` read tabs (Health, Sprint, Release, Events, Drift and Budget) render on the live site. |
| AC16 | The static domain check finds no `ops_` write statements in any file outside `App/Ops/src/ops-api.js` and `App/Ops/migrations/` (grep across `App/` and `13F Seed/`). |

### 13.3 Test plan (order)

1. **Preflight:**
   - Record `wrangler deployments status --name meridian-ops`, expecting `589ae24c`.
   - Read `sqlite_master` for `ops_%` names and for the `sprintboarditems` DDL.
   - Record a D1 budget snapshot.
   - Run `ls .git/*.lock`.
2. **Local:** `wrangler d1 execute meridian-etf --local --file migrations/002-ops-control-plane.sql`. Run the AC11 trigger tests and the AC6 idempotency tests against `wrangler dev --local`.
3. **Founder:** create the Access app (§6.2) and share the AUD and team domain values (identifiers only). Engineering sets the `OPS_INGEST_KEYS` secret.
4. **Remote:**
   - Run the migration on remote and check AC1.
   - Run AC2.
   - Deploy `meridian-ops`.
   - Run AC3, AC4, AC5, AC7 and AC15.
5. **Pilot:** install `.env.ops-ingest`, add the pilot registry row and the pilot script change. Run AC8 (manual runs), then observe AC9 over 2 days.
6. **Housekeeping:** AC12.
7. **Close-out:** AC10, AC13, AC14 and AC16, with the evidence pasted in and the Worker version recorded.

### 13.4 Rollback

| Layer | Action | Note |
|---|---|---|
| Worker | `wrangler rollback --name meridian-ops 589ae24c` (or `wrangler versions deploy`) | ⚠️ **This restores the 4 anonymous POSTs.** It is an emergency only, followed by a fix-forward. The Operations Lead records it in the Release Ledger. |
| Tables | **Leave them in place and ignored.** They are additive, and nothing reads them after a rollback. | Dropping them needs separate Founder approval. First export any real rows (`wrangler d1 export --table …`), then drop in this order: triggers, `ops_case_event`, `ops_data_quality_ticket`, `ops_exception`, `ops_job_run`, `ops_job_registry`. |
| Pilot | Delete or rename `.env.ops-ingest` (instant no-op), or set the per-job `ingest_enabled=0`. Revert the script with git in a local Claude Code lane. | The job's behaviour is unaffected either way. |
| Access and secrets | Disable the Access app. Run `wrangler secret delete OPS_INGEST_KEYS --name meridian-ops`. | — |
| Housekeeping | Restore `stage`, `status`, `notes` and `updated_at` from the preflight capture with a single guarded `UPDATE`, plus an `operationalevents` row. | — |

## 14. Success metrics

| Metric | Type | Target | Measured by | When |
|---|---|---|---|---|
| Pilot run capture rate: runs with a start and an end ÷ runs in the job's own log | Leading | 100% (stretch: 100% including failure paths) | Q5 against the boost run log | Build plus 2 days |
| Anonymous mutation routes | Leading | 0 | AC4 and AC5 | At build |
| Heartbeat-induced job failures or exit-code changes | Leading | 0 | AC8 plus 2 weeks of pilot logs | Build plus 2 weeks |
| Ops share of the daily D1 write cap | Leading | 0.5% or less (steady), and never above the 5% cap | `/api/ops/cf/d1-today` and a Q2 count | Weekly through October |
| Jobs with a start or end record in the last expected window | Lagging (002) | Every wired job | Q4 | 002 close |
| Time from a job silently failing to someone knowing | Lagging (002 sweep) | 24 h or less (F5 baseline: 31 days) | 002 alert log | October close |

## 15. Open questions for the Founder (3)

| # | Question | Options | **Recommendation** |
|---|---|---|---|
| **Q1** | Which pilot emitter does 001 wire? | **(A)** The local `entities-enrich-boost` runner. **(B)** The `meridian-entities-enrich` Worker. **(C)** None; synthetic contract tests only. | **(A).** It runs twice a day (fast evidence) and has real `success`, `skipped` and `failed` paths (its evening failure is F6). It needs no Worker redeploy, so it avoids both enrich's tight 44/50 subrequest margin and the Worker-to-Worker fetch risk (§6.3). It does not disturb 006. (B) would need enrich's checkpoint lowered and Data-Identity review mid-006. (C) proves nothing end to end. The Worker path is then proven by the first Worker emitter in 002. |
| **Q2** | Do you accept that closing the anonymous POSTs means the **Sprint Board stage** and **Release Ledger event** buttons in the public `ma-ops.js` stop working from 001 until 005 ships the authenticated console? | Accept / keep the old routes open until 005 | **Accept.** The release gate forbids anonymous mutations, and today anyone who knows the URL can change the board. Reads keep working. Board writes during the gap go through the Access-protected admin routes: browser session at the Access URL, or curl with an Access service token. |
| **Q3** | Do you authorise MA-OCT-002's spec to carry, as a prerequisite, a CR to **retire the `meridian-bootstrap` cron and auth-gate or remove `/trigger`**, with the ETF Product Lead consulted, to free the one cron slot Ops alerting needs? | Yes / No (then fallback (a) in §9: revive the local health-check as the sweep caller) | **Yes.** The Architect recommends it (N3). It removes a live unauthenticated write endpoint (N1), reduces D1 load, and costs nothing: bootstrap has been complete since 11 June. |

**Not asked (decided in this spec, within Operations Lead authority):** the shared-secret heartbeat auth (§6.3), 180-day run retention (§5.2), no cron in 001 (§9), and Access-only for new Ops reads (§6.1).

## 16. Timeline and dependencies

| Date | Step | Dependency |
|---|---|---|
| Tue 29 Sep | Architect review, then Founder spec approval | This spec |
| 30 Sep | The Main Lane issues the Build Brief. This spec is committed via the next executing lane (rule 7). | Approval |
| 1–7 Oct | Build (steps 1–6 of §13.3). The Founder creates the Access app on day 1 (about 15 minutes). | Founder Zero Trust access. Data-Identity Lead acknowledges the pilot script change (Q1 = A). |
| 7–9 Oct | Pilot observation (AC9, 2 days or more). Close-out, then Architect review. | — |
| 8 Oct onward | 002 starts. It needs: the Workers-Read token (ruling 1), the §10 Architect split decision, and the §9 bootstrap CR (Q3). | 001 closed |

## 17. Evidence and limits of this spec lane

- **Read:** the spec brief (hash verified); Scope v2; Addendum v3 (§1, §4, §5); the MA-OCT-000 close-out, job manifest and Architect review; the MA-SEP-015a spec and 015b build brief; the October Decisions Log; Storage Strategy v1 and Team v3 (project knowledge) for table classes and the split rule; and the following source files:
  - `App/Ops/src/ops-api.js` (507 lines, 12 endpoints);
  - `App/Ops/migrations/001-ops-schema.sql`;
  - `App/Ops/wrangler-ops.toml`;
  - `App/ma-ops.js` and `App/ma-data.js` (Ops call sites);
  - `entities-api.js` (Access verification);
  - `entities-enrich.js` (subrequest checkpoint);
  - `entities-enrich-boost-run.mjs`;
  - `ma-sep-015b-entity-exceptions.sql`;
  - `.gitignore`.
- **Not run:** no D1 read was made (`wrangler` isn't available in this lane's shell), so the `sqlite_master` checks move to the build preflight (§13.3 step 1, AC1). The live schemas of the legacy tables are taken from their migration sources.
- **No writes** other than this file. No code, deploy, D1 or git changes. No locks found.
