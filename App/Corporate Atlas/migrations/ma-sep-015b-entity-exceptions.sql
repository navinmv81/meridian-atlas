-- MA-SEP-015b — entity_exceptions table
-- DOMAIN: Entities (declared explicitly per CLAUDE.md's new-D1-table rule, and per
-- MA-SEP-015a's design, Open Question 1: "one table per domain — entity_exceptions
-- for the Entities domain"). Owner: Entities Product Lead.
--
-- Generic, cross-exception-type data-quality exception queue. First populated case:
-- 'entity_merge' (migrated from entity_merge_exceptions, MA-SEP-012b). Designed to
-- also fit a future 'isin_duplicate' row (Known Issue 22.17, entity_isin_map) with
-- NO schema change — sketch, not built this round:
--   exception_type       'isin_duplicate'
--   source_table         'entity_isin_map'
--   source_ref           '{"isin":"...","entity_ids":[...]}'
--   flagged_reason       'duplicate ISIN mapped to multiple entity_ids'
--   evidence             free text/JSON detail on the conflicting rows
--   proposed_resolution  NULL until reviewed
--   decision             'pending'
-- See claude/MA-SEP-015a_Spec.md (design) and claude/MA-SEP-015b_Build_Brief.md
-- (this build) for full context.

CREATE TABLE IF NOT EXISTS entity_exceptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_type        TEXT NOT NULL,              -- e.g. 'entity_merge', future 'isin_duplicate'
  source_table          TEXT NOT NULL,              -- e.g. 'entity_master'
  source_ref            TEXT NOT NULL,              -- JSON — the record(s) this exception concerns
  flagged_reason        TEXT NULL,                  -- free text — why this was flagged
  evidence              TEXT NULL,                  -- free text/JSON — supporting detail
  proposed_resolution   TEXT NULL,
  decision              TEXT NOT NULL DEFAULT 'pending',  -- e.g. 'do_not_merge' / 'always_merge' / 'pending'
  corporate_action_note TEXT NULL,                  -- free text, e.g. "2014 spinoff"
  decided_by            TEXT NULL,                  -- authenticated user identity (Cloudflare Access), not free text
  decided_at            TEXT NULL,                  -- set when a decision is made
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table starts at 3 rows (migrated) — indexes here are a formality per the
-- three-point check, same discipline as MA-SEP-012b's entity_merge_exceptions,
-- done for real anyway since the UI will filter by type/source as more exception
-- types are added later.
CREATE INDEX IF NOT EXISTS idx_entity_exceptions_type   ON entity_exceptions(exception_type);
CREATE INDEX IF NOT EXISTS idx_entity_exceptions_source ON entity_exceptions(source_table);
CREATE INDEX IF NOT EXISTS idx_entity_exceptions_decision ON entity_exceptions(decision);

-- Migrated from entity_merge_exceptions (MA-SEP-012b), verified live-dump 2026-09-05
-- via `wrangler d1 execute meridian-etf --remote` against entity_merge_exceptions —
-- real values carried forward unchanged, not re-derived or re-guessed. Field mapping:
--   source_ref            <- JSON of {entity_id_a, entity_id_b, lei} from the old row
--   flagged_reason         <- old `reason` column
--   evidence               <- NULL (no equivalent column existed on the old table)
--   proposed_resolution    <- NULL (no equivalent column existed on the old table)
--   decided_at / created_at <- old `decided_at` (no separate created_at existed on the
--                              old table; decided_at is the earliest real timestamp
--                              available, used for both rather than fabricating one)
INSERT INTO entity_exceptions
  (exception_type, source_table, source_ref, flagged_reason, evidence, proposed_resolution,
   decision, corporate_action_note, decided_by, decided_at, created_at)
VALUES
  ('entity_merge', 'entity_master',
   '{"entity_id_a":931,"entity_id_b":1216,"lei":"54930067J0ZNOEBRW338"}',
   'Shared LEI but legitimately separate, publicly-traded companies today.',
   NULL, NULL, 'do_not_merge', '2014 spinoff', 'Founder (MA-SEP-007)',
   '2026-08-30 19:30:36', '2026-08-30 19:30:36'),

  ('entity_merge', 'entity_master',
   '{"entity_id_a":2589,"entity_id_b":25577,"lei":"259400LGXW3K0GDAG361"}',
   'Same-LEI-different-entity risk case flagged during MA-SEP-007; unverified as a legitimate rename, not assumed safe to merge.',
   NULL, NULL, 'do_not_merge', NULL, 'Founder (MA-SEP-007)',
   '2026-08-30 19:30:36', '2026-08-30 19:30:36'),

  ('entity_merge', 'entity_master',
   '{"entity_id_a":2014,"entity_id_b":25655,"lei":"213800M4NRGFJCI34834"}',
   'Same-LEI-different-entity risk case flagged during MA-SEP-007; different name and country on the same LEI, possibly a legitimate rename, unverified.',
   NULL, NULL, 'do_not_merge', NULL, 'Founder (MA-SEP-007)',
   '2026-08-30 19:30:36', '2026-08-30 19:30:36');
