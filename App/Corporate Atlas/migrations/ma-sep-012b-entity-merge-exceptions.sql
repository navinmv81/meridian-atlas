-- MA-SEP-012b — entity_merge_exceptions table
-- DOMAIN: Entities (declared explicitly per CLAUDE.md's new-D1-table rule, and per
-- MA-SEP-012a's design, §1: "Table — entity_merge_exceptions (Entities domain)").
-- Owner: Entities Product Lead.
--
-- Durable record of entity-merge exception decisions (e.g. "SLM Corp/Navient Corp:
-- known 2014 spinoff, do not merge") so future dedup/GLEIF-resync passes stop
-- re-litigating the same judgment call. See claude/MA-SEP-012a_Spec.md (design) and
-- claude/MA-SEP-012b_Build_Brief.md (this build) for full context.

CREATE TABLE IF NOT EXISTS entity_merge_exceptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  lei                   TEXT NULL,                 -- nullable: some exceptions may not be LEI-keyed
  entity_id_a           INTEGER NOT NULL,           -- references entity_master(entity_id)
  entity_id_b           INTEGER NOT NULL,           -- references entity_master(entity_id)
  decision              TEXT NOT NULL CHECK(decision IN ('do_not_merge','always_merge')),
  reason                TEXT NULL,
  corporate_action_note TEXT NULL,
  decided_by            TEXT NOT NULL,
  decided_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexed on both entity_id columns since a future dedup pass will look up "has this
-- pair already been decided" from either side — table is tiny (tens to low hundreds
-- of rows per the 012a design's own read/write budget estimate), so this is a
-- formality per the three-point check, not a real risk, but done for real per
-- MA-SEP-012a's read/write budget note.
CREATE INDEX IF NOT EXISTS idx_merge_exceptions_entity_a ON entity_merge_exceptions(entity_id_a);
CREATE INDEX IF NOT EXISTS idx_merge_exceptions_entity_b ON entity_merge_exceptions(entity_id_b);
CREATE INDEX IF NOT EXISTS idx_merge_exceptions_lei      ON entity_merge_exceptions(lei);

-- Seed with the 3 exceptions confirmed during MA-SEP-007. entity_ids looked up live
-- against entity_master by matching LEI (not guessed) -- see close-out notes for the
-- exact lookup query and results.
INSERT INTO entity_merge_exceptions (lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by)
VALUES
  ('54930067J0ZNOEBRW338', 931, 1216, 'do_not_merge',
   'Shared LEI but legitimately separate, publicly-traded companies today.',
   '2014 spinoff', 'Founder (MA-SEP-007)'),
  ('259400LGXW3K0GDAG361', 2589, 25577, 'do_not_merge',
   'Same-LEI-different-entity risk case flagged during MA-SEP-007; unverified as a legitimate rename, not assumed safe to merge.',
   NULL, 'Founder (MA-SEP-007)'),
  ('213800M4NRGFJCI34834', 2014, 25655, 'do_not_merge',
   'Same-LEI-different-entity risk case flagged during MA-SEP-007; different name and country on the same LEI, possibly a legitimate rename, unverified.',
   NULL, 'Founder (MA-SEP-007)');
