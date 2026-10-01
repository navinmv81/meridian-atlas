-- 002-ops-control-plane.sql
-- MA-OCT-001 — Ops backend foundation. Spec: claude/MA-OCT-001_Spec.md §5,
-- with Build Brief amendment A1 (contract v1 carries MA-OCT-006 §8.2).
--
-- Domain: Ops. Owner: Operations Lead. ONLY WRITER: meridian-ops
-- (App/Ops/src/ops-api.js). No ETF/Entities/13F pipeline may write these
-- tables; other Workers and local jobs report only via
-- POST /api/ops/ingest/run-event.
--
-- Creates 5 tables, 11 indexes, 3 triggers. Additive only: CREATE ... IF NOT
-- EXISTS throughout, so re-running is a no-op. Dry-run with --local first.
--
-- Conventions:
--   * Timestamps are ISO-8601 UTC TEXT, default strftime('%Y-%m-%dT%H:%M:%fZ','now').
--   * Workflow vocabularies (status, severity, ticket/exception types) are
--     validated in the Worker, not with CHECK, so 003/004 can extend them
--     without a table rebuild. Only the fixed contract enums (phase,
--     event_type, actor_source) are CHECKs.
--   * JSON columns hold display metadata only; anything filtered or joined on
--     is a normalised, indexed column.
--
-- A1 — run-ledger counters (replaces spec §5.2 items_processed):
--   * items_attempted  = items the run tried to process.
--   * items_progressed = items whose state actually advanced.
--   An emitter that cannot tell the two apart sends only items_attempted and
--   leaves items_progressed NULL. It never copies one value into the other.
--   items_progressed = 0 with items_attempted > 0 is the F4 signature
--   ("ran but did no work").
--
-- A1 — detail.metrics: optional flat object of integer counters (<= 16 keys,
--   keys <= 32 chars) inside the 2 KB detail cap; the Worker drops non-integer
--   values. GLEIF key set: selected, attempted, progressed, failed, deferred,
--   external_calls, ext_2xx, ext_404, ext_4xx, ext_429, ext_5xx.
--
-- A1 — skipped reasons: when event='skipped', detail.reason must be one of
--   hold, pause, budget, auth, out_of_window, empty_input (Worker-enforced).
--
-- A1 — PER-PHASE JOB IDs: a multi-phase Worker registers ONE job_id PER PHASE
--   in ops_job_registry, e.g. 'cf.meridian-entities-enrich.phase1' and
--   'cf.meridian-entities-enrich.phase23'. Each phase's run gets its own
--   run_id. No phase/run_key column is needed.
--
-- Job id namespace: 'cf.<worker>', 'local.<job>', 'manual.<script>'; the
-- reserved control row 'ops.ingest' holds the global ingest switch.
--
-- Retention: ops_job_run keeps 180 days, pruned manually (never by cron) in
-- chunks of <= 1000 via idx_ops_job_run_received. ops_case_event is never
-- pruned (delete trigger). All other tables keep forever.

-- (1) ops_job_registry — the canonical job definition ---------------------
CREATE TABLE IF NOT EXISTS ops_job_registry (
  job_id                  TEXT PRIMARY KEY,
  display_name            TEXT NOT NULL,
  domain                  TEXT NOT NULL,             -- 'ETF','Entities','13F','Ops','FixedIncome'
  owner_role              TEXT NOT NULL,
  execution_mode          TEXT NOT NULL,             -- 'cron','on_request','local_schedule','manual','retired','control'
  worker_name             TEXT NULL,
  source_path             TEXT NULL,
  intended_schedule       TEXT NULL,                 -- JSON (002)
  effective_schedule      TEXT NULL,                 -- JSON (002, from the CF API)
  emitter_id              TEXT NULL,                 -- the ingest identity allowed to report for this job
  ingest_enabled          INTEGER NOT NULL DEFAULT 1, -- per-job switch; on 'ops.ingest' it is the global switch
  expected_max_duration_s INTEGER NULL,
  kill_switch_ref         TEXT NULL,                 -- describes the job's OWN switch (not operated by Ops)
  write_budget_profile    TEXT NULL,                 -- JSON
  status                  TEXT NOT NULL DEFAULT 'active', -- 'active','held','retired'
  notes                   TEXT NULL,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ops_job_registry_emitter ON ops_job_registry(emitter_id);

-- (2) ops_job_run — the run ledger (append-only, one row per phase) -------
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
  items_attempted  INTEGER NULL,                  -- A1
  items_progressed INTEGER NULL,                  -- A1 (NULL when the emitter can't tell)
  cursor_before    TEXT NULL,
  cursor_after     TEXT NULL,
  error_class      TEXT NULL,                     -- short code, e.g. 'CF_API_10000'
  error_summary    TEXT NULL,                     -- <= 500 chars, redacted
  detail           TEXT NULL,                     -- JSON <= 2 KB (reason, metrics)
  end_only         INTEGER NOT NULL DEFAULT 0,    -- 1 = terminal arrived with no start row
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

-- (3) ops_exception — operational failures that need triage ---------------
CREATE TABLE IF NOT EXISTS ops_exception (
  exception_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ref       TEXT NOT NULL UNIQUE,            -- 'EXC-000001'
  exception_type TEXT NOT NULL,                   -- 003 vocabulary
  severity       TEXT NOT NULL DEFAULT 'sev3',
  status         TEXT NOT NULL DEFAULT 'open',
  title          TEXT NOT NULL,
  summary        TEXT NULL,
  job_id         TEXT NULL,
  run_id         TEXT NULL,
  run_snapshot   TEXT NULL,                       -- JSON copy of key run fields (survives the 180-day prune)
  object_domain  TEXT NULL,
  object_key     TEXT NULL,
  object_ref     TEXT NULL,                       -- JSON
  owner_role     TEXT NULL,
  assignee       TEXT NULL,
  resolution     TEXT NULL,
  resolved_by    TEXT NULL,
  resolved_at    TEXT NULL,
  raised_by      TEXT NOT NULL,
  raised_via     TEXT NOT NULL,                   -- 'ops_console','ingest_auto','consumer_screen','migration'
  dedupe_key     TEXT NULL UNIQUE,
  legacy_source  TEXT NULL,
  legacy_id      TEXT NULL,
  opened_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (legacy_source, legacy_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_exception_queue  ON ops_exception(status, severity, opened_at);
CREATE INDEX IF NOT EXISTS idx_ops_exception_job    ON ops_exception(job_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_ops_exception_object ON ops_exception(object_domain, object_key);

-- (4) ops_data_quality_ticket — data concerns about a domain object -------
CREATE TABLE IF NOT EXISTS ops_data_quality_ticket (
  ticket_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ref              TEXT NOT NULL UNIQUE,     -- 'DQ-000001'
  ticket_type           TEXT NOT NULL,            -- 004 vocabulary
  severity              TEXT NOT NULL DEFAULT 'sev3',
  status                TEXT NOT NULL DEFAULT 'open',
  title                 TEXT NOT NULL,
  summary               TEXT NULL,
  object_domain         TEXT NOT NULL,
  object_key            TEXT NOT NULL,
  object_ref            TEXT NULL,                -- JSON
  source_system         TEXT NULL,
  source_record_ref     TEXT NULL,
  field_name            TEXT NULL,
  observed_value        TEXT NULL,
  expected_value        TEXT NULL,
  evidence              TEXT NULL,
  proposed_resolution   TEXT NULL,
  disposition           TEXT NULL,
  resolution_note       TEXT NULL,
  resolved_by           TEXT NULL,
  resolved_at           TEXT NULL,
  job_id                TEXT NULL,
  run_id                TEXT NULL,
  linked_exception_ref  TEXT NULL,                -- → ops_exception.case_ref
  owner_role            TEXT NULL,
  assignee              TEXT NULL,
  raised_by             TEXT NOT NULL,
  raised_via            TEXT NOT NULL,
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

-- (5) ops_case_event — the audit trail (append-only, immutable) -----------
CREATE TABLE IF NOT EXISTS ops_case_event (
  event_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type    TEXT NOT NULL,                  -- 'exception','dq_ticket','job','ops_control'
  subject_id      TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  from_value      TEXT NULL,
  to_value        TEXT NULL,
  body            TEXT NULL,
  payload         TEXT NULL,                      -- JSON
  actor           TEXT NOT NULL,                  -- verified email | 'service:<id>' | legacy verbatim value
  actor_source    TEXT NOT NULL CHECK (actor_source IN ('access_jwt','access_service_token','ingest_key','system','legacy_migration')),
  actor_role      TEXT NULL,
  occurred_at     TEXT NOT NULL,
  recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  idempotency_key TEXT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_ops_case_event_subject ON ops_case_event(subject_type, subject_id, occurred_at);
CREATE TRIGGER IF NOT EXISTS trg_ops_case_event_no_update
  BEFORE UPDATE ON ops_case_event BEGIN SELECT RAISE(ABORT, 'ops_case_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_ops_case_event_no_delete
  BEFORE DELETE ON ops_case_event BEGIN SELECT RAISE(ABORT, 'ops_case_event is append-only'); END;
