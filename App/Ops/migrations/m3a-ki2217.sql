-- MA-OCT-004 M3a (spec rev 1 §10.1, verbatim): KI 22.17 aggregate (37 ISINs) and consolidation of the 2 legacy
-- open isin_duplicate tickets (003 M1: DQ-M-000008/9). Idempotent: a re-run changes nothing (AC-11).
-- Run only after 003 V2 has passed and B3 = 9. Order matters: the dismissal event comes before the UPDATE.
--   /usr/local/bin/wrangler d1 execute meridian-etf --remote -c wrangler-ops.toml --file migrations/m3a-ki2217.sql
INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref, source_system,
   evidence, proposed_resolution, owner_role, raised_by, raised_via, dedupe_key)
VALUES ('DQ-SEED-ki2217', 'isin_duplicate', 'sev3', 'triaged',
  'KI 22.17: 37 ISINs map to 2 entities each in entity_isin_map',
  'entity_isin_map has no dedup step on its write path (same shape as KI 22.8). 007 shows these as "Ambiguous".',
  'source_record', 'known-issue:22.17', json_object('ki','22.17','isin_count',37),
  'entity_isin_map', 'MA-OCT-007 Appendix A Q5, 9 Oct 2026: complete list, each ISIN exactly 2 entities (claude/MA-OCT-007_AppendixA_Results.md).',
  'Re-check each ISIN after MA-OCT-013 merges (twins collapse); then a write-path dedup fix (Entities packet).',
  'Data-Identity Lead', 'ops_lead:wrangler', 'ops_console', 'ki:22.17');
UPDATE ops_data_quality_ticket SET case_ref = 'DQ-' || printf('%06d', ticket_id) WHERE case_ref = 'DQ-SEED-ki2217';
INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, proposed_action)
SELECT t.ticket_id, 'source_record', 'entity_isin_map:' || j.value, 'dedupe'
  FROM ops_data_quality_ticket t,
       json_each('["AU000000CMW8","CA46431R1029","DE000A2H7N08","DE000A2JF7A2","DE000A42ERT3","IE0004ZFNTZ6","IE0009D15VO0","IE000I50V6C7","IE000SKTEI24","IE000TG7T8V7","IE000TGK2UK9","IE00BF92LR56","LU0757359368","LU0757360457","LU0757360531","LU0757360614","LU0757360960","LU0864709349","LU0864710354","LU0864714000","LU0864714422","LU1011997381","LU1856130205","LU2183939003","LU2381585913","US0321084339","US0321084826","US29287L1061","US46138K1034","US46436E3201","US46438G3728","US49446R1095","US69374H1547","US9219378190","US9219464065","US92206C1027","US92206C6232"]') j
 WHERE t.dedupe_key = 'ki:22.17';
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(ticket_id AS TEXT), 'created', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('case_ref', case_ref, 'members', 37, 'seed', 'M3a'), 'seed:ki:22.17:created'
  FROM ops_data_quality_ticket WHERE dedupe_key = 'ki:22.17';
-- Consolidate the 2 legacy open isin_duplicate tickets (003 M1: DQ-M-000008/9; their 3 ISINs are in the 37).
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(l.ticket_id AS TEXT), 'dismissed', l.status, 'dismissed',
       'Consolidated into the KI 22.17 aggregate ticket ' || a.case_ref || ' (MA-OCT-004 M3a).',
       'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('disposition','duplicate','duplicate_of', a.case_ref, 'legacy_disposition', l.disposition),
       'seed:ki:22.17:dismiss:' || l.case_ref
  FROM ops_data_quality_ticket l, ops_data_quality_ticket a
 WHERE l.legacy_source = 'entity_exceptions' AND l.ticket_type = 'isin_duplicate' AND l.status = 'open'
   AND a.dedupe_key = 'ki:22.17';
UPDATE ops_data_quality_ticket
   SET status = 'dismissed', disposition = 'duplicate',
       resolution_note = 'Consolidated into ' || (SELECT case_ref FROM ops_data_quality_ticket WHERE dedupe_key = 'ki:22.17') || ' (MA-OCT-004 M3a).',
       resolved_by = 'ops_lead:wrangler', resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE legacy_source = 'entity_exceptions' AND ticket_type = 'isin_duplicate' AND status = 'open';
