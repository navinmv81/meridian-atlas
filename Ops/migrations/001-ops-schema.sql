-- 001-ops-schema.sql
-- Ops domain schema per August_Operating_Layer_Blueprint.md Section 4.
-- Creates: sprintboarditems, releaseledger, operationalevents, openfigicache.
-- All four tables live in the existing shared meridian-etf database
-- (ID 43e80149-5333-4917-b678-6a8218ca4f93).

CREATE TABLE IF NOT EXISTS sprintboarditems (
  ticket_id        TEXT PRIMARY KEY,          -- e.g. 'MA-AUG-001'
  title            TEXT NOT NULL,
  domain           TEXT NOT NULL,             -- 'Entities','ETF','13F','Filings','Ops','Equities','FixedIncome','Derivatives','Control'
  lane             TEXT NOT NULL CHECK(lane IN ('control','data_identity','application','ops','release')),
  stage            TEXT NOT NULL CHECK(stage IN (
                     'IDEA','PRODUCT_SPEC','ARCH_REVIEW','UX_REVIEW','ENG_DIAGNOSTIC',
                     'FOUNDER_APPROVAL','ENG_IMPLEMENT','OPS_RELEASE_REVIEW','RELEASE_READY',
                     'CLOSED','BLOCKED')),
  owner_role       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED','CLOSED')),
  blocker          TEXT NULL,
  next_step        TEXT NULL,
  approval_needed  TEXT NULL,
  notes            TEXT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_stage  ON sprintboarditems(stage);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_domain ON sprintboarditems(domain);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_lane   ON sprintboarditems(lane);

CREATE TABLE IF NOT EXISTS releaseledger (
  release_id                 TEXT PRIMARY KEY,        -- e.g. 'REL-2026-08-001'
  ticket_ids                 TEXT NOT NULL,            -- JSON array, e.g. '["MA-AUG-001"]'
  change_summary             TEXT NOT NULL,
  frontend_files             TEXT NULL,
  worker_files                TEXT NULL,
  d1_migration_status        TEXT NOT NULL DEFAULT 'none' CHECK(d1_migration_status IN ('none','pending','applied','failed','rolled_back')),
  worker_deploy_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(worker_deploy_status IN ('not_started','in_progress','deployed','failed','rolled_back')),
  frontend_push_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(frontend_push_status IN ('not_started','in_progress','pushed','failed','rolled_back')),
  verification_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(verification_status IN ('not_started','in_progress','passed','failed')),
  production_parity_status   TEXT NOT NULL DEFAULT 'unknown' CHECK(production_parity_status IN ('unknown','aligned','diverged')),
  rollback_note               TEXT NULL,
  status                     TEXT NOT NULL DEFAULT 'NOT_READY' CHECK(status IN ('NOT_READY','READY','DEPLOYING','DEPLOYED','VERIFIED','ROLLED_BACK')),
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at                   DATETIME NULL
);
CREATE INDEX IF NOT EXISTS idx_releaseledger_status ON releaseledger(status);

CREATE TABLE IF NOT EXISTS operationalevents (
  event_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL CHECK(event_type IN (
                'packet_created','ticket_state_changed','gate_passed','gate_failed',
                'build_started','build_completed','worker_deployed','frontend_pushed',
                'migration_applied','verification_passed','verification_failed',
                'release_closed','release_rolled_back')),
  ticket_id    TEXT NULL,     -- references sprintboarditems.ticket_id
  release_id   TEXT NULL,     -- references releaseledger.release_id
  actor_role   TEXT NOT NULL, -- 'Architect','Engineering Lead','Operations Lead','Program Orchestrator','Founder','Claude Code'
  payload      TEXT NULL,     -- JSON, event-specific
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operationalevents_ticket  ON operationalevents(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operationalevents_release ON operationalevents(release_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operationalevents_type    ON operationalevents(event_type, created_at);

CREATE TABLE IF NOT EXISTS openfigicache (
  instrument_key    TEXT PRIMARY KEY,   -- references instrument_master.instrument_key
  figi_name         TEXT NULL,
  figi_ticker       TEXT NULL,
  has_warning       INTEGER NOT NULL DEFAULT 0,
  normalized_name   TEXT NULL,          -- pre-computed normalizeName(figi_name)
  matched_entity_id INTEGER NULL,       -- entity_id found against entity_master AT CACHE-WRITE TIME; may be stale, re-check on reuse
  checked_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_openfigicache_normalized_name ON openfigicache(normalized_name);
