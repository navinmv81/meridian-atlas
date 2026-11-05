-- MA-OCT-002b B5 (spec 002 rev 1.3 §14, KI 22.39, CR-10 step 1): an Entities-domain home for state an Entities job
-- must read back (delta_inactive_<LEI>, any entity cursor). Written only by Entities Workers; owner Data-Identity Lead.
-- Run facts (enrich_phase3_last_run_*, delta_last_run, delta_entities_updated) go to ops_job_run via B2 instead, and
-- the shared writes_today_<date> counter stays an ETF-owned key that Entities may read (§14 table).
-- Additive and idempotent: ≈ 2 row-writes (schema). Rollback: DROP TABLE only after the dual-write release is reverted.
CREATE TABLE IF NOT EXISTS entity_pipeline_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
