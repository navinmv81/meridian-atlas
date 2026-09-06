-- MA-SEP-015c — Seed Known Issue 22.9 (4 rows) and Known Issue 22.17 (2 rows) into
-- entity_exceptions. All entity_ids/ISINs looked up live against D1 on 2026-09-06 —
-- none guessed or reused from the Build Brief's own draft text without verification.
-- See claude/MA-SEP-015c_Build_Brief.md for full context.

-- ── Known Issue 22.9 — bad_relationship_edge (4 rows) ───────────────────────────
-- All 4 pairs confirmed live via:
--   SELECT r.parent_entity_id, pm.name, r.child_entity_id, cm.name, r.created_at,
--          cm.updated_at, cm.lei
--   FROM entity_relationships r
--   JOIN entity_master pm ON pm.entity_id = r.parent_entity_id
--   JOIN entity_master cm ON cm.entity_id = r.child_entity_id
--   WHERE r.relationship_type = 'legal_parent';
-- Edge creation timestamps (2026-06-10/11) and child lei = NULL both confirmed live,
-- matching the Build Brief's description. ONE DEVIATION FLAGGED: the Build Brief's
-- draft flagged_reason asserted the child entity's updated_at "exactly matches the
-- 2026-08-16 04:00:51 merge timestamp" — live data as of 2026-09-06 shows all 4
-- children's updated_at as 2026-09-06 04:00:32/33, not 2026-08-16. Checked whether
-- this was specific to these 4 rows: it is not — 29,839 of entity_master's rows
-- share a 2026-09-06 updated_at (a large, unrelated bulk update this packet did not
-- investigate further, per "do not touch other open packets/issues"). The specific
-- timestamp-correlation claim is therefore no longer independently verifiable
-- against live data and has been dropped from flagged_reason below rather than
-- copied in unverified — flagged back to Control in the close-out report.

INSERT INTO entity_exceptions
  (exception_type, source_table, source_ref, flagged_reason, evidence, proposed_resolution,
   decision, corporate_action_note, decided_by, decided_at)
VALUES
  ('bad_relationship_edge', 'entity_relationships',
   '{"parent_entity_id":1565,"child_entity_id":3,"relationship_type":"legal_parent"}',
   'legal_parent edge does not reflect a real legal-parent relationship (parent Cheniere Energy Inc is a real operating company; child Alerian MLP ETF is an ETF) -- likely a MA-SEP-001 dedup-merge side effect. Edge created 2026-06-10 19:51:32 (confirmed live); child entity currently carries lei = NULL (confirmed live). Note: the child''s updated_at no longer independently confirms the originally-cited 2026-08-16 04:00:51 merge-timestamp correlation -- entity_master underwent a large bulk update on 2026-09-06 (~29,839 rows, unrelated to this packet) that overwrote it; see this migration''s header comment.',
   'Known Issue 22.9 (Sprint Board); entities-enrich.js/entities-delta.js write sites read (not touched) during MA-SEP-004''s diagnostic.',
   'root-cause fix would require revisiting MA-SEP-001''s entity_relationships repoint logic; not yet scheduled',
   'accepted_no_fix', NULL, 'Founder', '2026-08-22'),

  ('bad_relationship_edge', 'entity_relationships',
   '{"parent_entity_id":2247,"child_entity_id":143,"relationship_type":"legal_parent"}',
   'legal_parent edge does not reflect a real legal-parent relationship (parent General Motors Company is a real operating company; child PIMCO Enhanced Short Maturity Active ETF is an ETF) -- likely a MA-SEP-001 dedup-merge side effect. Edge created 2026-06-11 00:00:55 (confirmed live); child entity currently carries lei = NULL (confirmed live). Note: the child''s updated_at no longer independently confirms the originally-cited 2026-08-16 04:00:51 merge-timestamp correlation -- entity_master underwent a large bulk update on 2026-09-06 (~29,839 rows, unrelated to this packet) that overwrote it; see this migration''s header comment.',
   'Known Issue 22.9 (Sprint Board); entities-enrich.js/entities-delta.js write sites read (not touched) during MA-SEP-004''s diagnostic.',
   'root-cause fix would require revisiting MA-SEP-001''s entity_relationships repoint logic; not yet scheduled',
   'accepted_no_fix', NULL, 'Founder', '2026-08-22'),

  ('bad_relationship_edge', 'entity_relationships',
   '{"parent_entity_id":2476,"child_entity_id":49,"relationship_type":"legal_parent"}',
   'legal_parent edge does not reflect a real legal-parent relationship (parent Banco Comercial Português S.A. is a real operating company; child iShares MSCI Poland ETF is an ETF) -- likely a MA-SEP-001 dedup-merge side effect. Edge created 2026-06-10 20:00:59 (confirmed live); child entity currently carries lei = NULL (confirmed live). Note: the child''s updated_at no longer independently confirms the originally-cited 2026-08-16 04:00:51 merge-timestamp correlation -- entity_master underwent a large bulk update on 2026-09-06 (~29,839 rows, unrelated to this packet) that overwrote it; see this migration''s header comment.',
   'Known Issue 22.9 (Sprint Board); entities-enrich.js/entities-delta.js write sites read (not touched) during MA-SEP-004''s diagnostic.',
   'root-cause fix would require revisiting MA-SEP-001''s entity_relationships repoint logic; not yet scheduled',
   'accepted_no_fix', NULL, 'Founder', '2026-08-22'),

  ('bad_relationship_edge', 'entity_relationships',
   '{"parent_entity_id":6980,"child_entity_id":194,"relationship_type":"legal_parent"}',
   'legal_parent edge does not reflect a real legal-parent relationship (parent ABB Ltd is a real operating company; child SPDR Portfolio Short Term Corporate Bond ETF is an ETF) -- likely a MA-SEP-001 dedup-merge side effect. Edge created 2026-06-11 02:00:56 (confirmed live); child entity currently carries lei = NULL (confirmed live). Note: the child''s updated_at no longer independently confirms the originally-cited 2026-08-16 04:00:51 merge-timestamp correlation -- entity_master underwent a large bulk update on 2026-09-06 (~29,839 rows, unrelated to this packet) that overwrote it; see this migration''s header comment.',
   'Known Issue 22.9 (Sprint Board); entities-enrich.js/entities-delta.js write sites read (not touched) during MA-SEP-004''s diagnostic.',
   'root-cause fix would require revisiting MA-SEP-001''s entity_relationships repoint logic; not yet scheduled',
   'accepted_no_fix', NULL, 'Founder', '2026-08-22');

-- ── Known Issue 22.17 — isin_duplicate (2 rows) ─────────────────────────────────
-- Confirmed live via `SELECT * FROM entity_isin_map WHERE isin = ?` for each ISIN.
-- DEVIATION FLAGGED: task_7a94ca1d covers TWO distinct ISINs (AU000000CMW8 and
-- US49446R1095), each independently duplicated across 2 entity_ids -- not one ISIN
-- with two entity_ids as the schema's single-"isin"-key example implies. Represented
-- both under one row (matching the Build Brief's "2 rows total" instruction and its
-- grouping of these two ISINs as one bulleted instance/task) using a small, still
-- schema-compatible source_ref shape (a JSON array under "isins" instead of a single
-- "isin" key) rather than fabricate a single ISIN to fit the literal template.

INSERT INTO entity_exceptions
  (exception_type, source_table, source_ref, flagged_reason, evidence, proposed_resolution,
   decision, corporate_action_note, decided_by, decided_at)
VALUES
  ('isin_duplicate', 'entity_isin_map',
   '{"isin":"US69374H1547","entity_ids":[204921,244971]}',
   'entity_isin_map has no dedup/cleanup step on its own write path -- same defect class as Known Issue 22.8, independent of that fix (which only touched firds_instrument_reference). Confirmed live: ISIN US69374H1547 maps to 2 distinct entity_ids (204921 via LEI 724500D4BFEWKWVC1G62, mapped 2026-08-22; 244971 via LEI 529900N5ZZ87RRY9Y613, mapped 2026-08-29).',
   'task_f3f1be29; the 2026-08-30 verification pass that found this.',
   'likely the same content-diff-WHERE shape as Known Issue 22.8''s fix; not yet scoped as its own packet',
   'pending', NULL, NULL, NULL),

  ('isin_duplicate', 'entity_isin_map',
   '{"isins":[{"isin":"AU000000CMW8","entity_ids":[28219,204822]},{"isin":"US49446R1095","entity_ids":[25003,204841]}]}',
   'entity_isin_map has no dedup/cleanup step on its own write path -- same defect class as Known Issue 22.8, independent of that fix (which only touched firds_instrument_reference). Confirmed live: an older, pre-existing pair of duplicate ISIN mappings -- AU000000CMW8 maps to entity_ids 28219 and 204822; US49446R1095 maps to entity_ids 25003 and 204841.',
   'task_7a94ca1d; the 2026-08-30 verification pass that found this.',
   'likely the same content-diff-WHERE shape as Known Issue 22.8''s fix; not yet scoped as its own packet',
   'pending', NULL, NULL, NULL);
