-- MA-OCT-003 M1 (spec rev 1 §10.1–§10.2, 7b8bba9f…80c2; CR-003-1): copy the legacy entity_exceptions rows
-- into ops_data_quality_ticket (DQ-M-nnnnnn), with 3 events per row. One --file batch, idempotent:
-- every statement is INSERT OR IGNORE on a UNIQUE key, so a re-run inserts 0 rows (AC-13).
-- Values are copied inside D1, so decided_by / decided_at / created_at arrive byte-for-byte (AC-12, V2).
--
-- TEMPLATE. Do not run this file as-is: render it first, which fills __FILE_SHA__ (this template's SHA-256)
-- and __COMMIT__ (the commit that carries it) in the 'migrated' event payload:
--   node App/Ops/tools/m1-render.mjs --commit <sha> --out ~/MeridianAtlas-work/ma-oct-003/m1-rendered.sql
-- Guard (runbook step, not in this file; must return 0, else STOP — spec §10.1):
--   SELECT COUNT(*) FROM entity_exceptions WHERE exception_type NOT IN ('entity_merge','bad_relationship_edge','isin_duplicate')
-- Run on Sat 24 only, after the Access Block and the dump (§10.3). Domain: Ops writes; entity_exceptions is read only.

INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref,
   source_system, source_record_ref, evidence, proposed_resolution, disposition, resolution_note,
   resolved_by, resolved_at, owner_role, raised_by, raised_via, legacy_source, legacy_id, opened_at, updated_at)
SELECT 'DQ-M-' || printf('%06d', e.id), e.exception_type, 'sev3',
       CASE e.decision WHEN 'pending' THEN 'open' ELSE 'resolved' END,
       e.exception_type || ' (legacy #' || e.id || ')', e.flagged_reason, 'entity',
       CAST(COALESCE(json_extract(e.source_ref,'$.child_entity_id'), json_extract(e.source_ref,'$.entity_id_a'),
                     json_extract(e.source_ref,'$.entity_ids[0]'), json_extract(e.source_ref,'$.isins[0].entity_ids[0]')) AS TEXT),
       json_object('source_table', e.source_table, 'source_ref', json(e.source_ref)),
       'entity_exceptions', e.source_ref, e.evidence, e.proposed_resolution, e.decision, e.corporate_action_note,
       e.decided_by, e.decided_at, 'Data-Identity Lead', 'legacy:entity_exceptions', 'migration',
       'entity_exceptions', CAST(e.id AS TEXT), e.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM entity_exceptions e
 WHERE e.exception_type IN ('entity_merge','bad_relationship_edge','isin_duplicate');

-- Event 1: created (original time)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'created', 'legacy:entity_exceptions', 'legacy_migration', e.created_at,
       json_object('case_ref', t.case_ref, 'legacy_id', e.id), 'mig:entity_exceptions:' || e.id || ':created'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT);

-- Event 2: decision_recorded (only for decided rows; decided_by verbatim as actor)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'decision_recorded', e.decision, e.corporate_action_note,
       COALESCE(e.decided_by, 'legacy:unrecorded'), 'legacy_migration', COALESCE(e.decided_at, e.created_at),
       json_object('decided_by', e.decided_by, 'decided_at', e.decided_at), 'mig:entity_exceptions:' || e.id || ':decision'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT)
 WHERE e.decision <> 'pending';

-- Event 3: migrated (now; DV-2)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'migrated', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('packet','MA-OCT-003','file','m1-entity-exceptions-to-ops.sql','file_sha256','__FILE_SHA__','commit','__COMMIT__'),
       'mig:entity_exceptions:' || e.id || ':migrated'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT);
