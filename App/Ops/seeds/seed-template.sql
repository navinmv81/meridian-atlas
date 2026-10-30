-- MA-OCT-004 seed template. The generator App/Ops/tools/seed-sql.mjs replaces __SEEDS__ with the reviewed JSON
-- (single quotes doubled) and __FILE_SHA__ with that JSON file's SHA-256. Idempotent: a re-run changes nothing.
-- (1) tickets: dedupe_key UNIQUE, and never a second open ticket on the same object
INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref, source_system,
   field_name, observed_value, expected_value, evidence, proposed_resolution, owner_role, raised_by, raised_via, dedupe_key)
SELECT 'DQ-SEED-' || json_extract(s.value,'$.dedupe'), json_extract(s.value,'$.type'), json_extract(s.value,'$.sev'),
       json_extract(s.value,'$.status'), json_extract(s.value,'$.title'), json_extract(s.value,'$.summary'),
       json_extract(s.value,'$.od'), json_extract(s.value,'$.ok'), json_extract(s.value,'$.ref'), json_extract(s.value,'$.src'),
       json_extract(s.value,'$.field'), json_extract(s.value,'$.obs'), json_extract(s.value,'$.exp'),
       json_extract(s.value,'$.evidence'), json_extract(s.value,'$.proposal'), json_extract(s.value,'$.owner'),
       'ops_lead:wrangler', 'ops_console', json_extract(s.value,'$.dedupe')
  FROM json_each('__SEEDS__') s
 WHERE NOT EXISTS (SELECT 1 FROM ops_data_quality_ticket x
                    WHERE x.object_domain = json_extract(s.value,'$.od') AND x.object_key = json_extract(s.value,'$.ok')
                      AND x.status IN ('open','triaged','fix_pending'));
-- (2) final case_ref
UPDATE ops_data_quality_ticket SET case_ref = 'DQ-' || printf('%06d', ticket_id) WHERE case_ref LIKE 'DQ-SEED-%';
-- (3) members
INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, object_ref, proposed_action)
SELECT t.ticket_id, json_extract(m.value,'$.d'), json_extract(m.value,'$.k'), json_extract(m.value,'$.ref'), json_extract(m.value,'$.act')
  FROM json_each('__SEEDS__') s
  JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe'),
       json_each(json_extract(s.value,'$.members')) m;
-- (4) created events
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'created', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('case_ref', t.case_ref, 'seed', t.dedupe_key, 'members', json_array_length(json_extract(s.value,'$.members')),
                   'file_sha256', '__FILE_SHA__'),
       'seed:' || t.dedupe_key || ':created'
  FROM json_each('__SEEDS__') s JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe');
-- (5) fix_scheduled events (fix_ref lives only here; N4-4)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'fix_scheduled', 'fix_pending', 'ops_lead:wrangler', 'system',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), json_object('fix_ref', json_extract(s.value,'$.fix_ref')),
       'seed:' || t.dedupe_key || ':fix'
  FROM json_each('__SEEDS__') s JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe')
 WHERE json_extract(s.value,'$.fix_ref') IS NOT NULL;
