-- MA-OCT-004 M3c (spec rev 1 §10.2, verbatim). Run after the M3 template (needs the ki:22.9 aggregate).
-- The legacy rows are not updated; the 22 Aug accepted_no_fix stays verbatim. Idempotent.
--   /usr/local/bin/wrangler d1 execute meridian-etf --remote -c wrangler-ops.toml --file migrations/m3c-links.sql
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(l.ticket_id AS TEXT), 'linked',
       'Reopened as a fix in ' || a.case_ref || ' (Founder 17 Oct, MA-OCT-004 F-1). This 22 Aug decision is kept unchanged.',
       'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('superseded_by', a.case_ref, 'legacy_disposition', l.disposition), 'seed:ki:22.9:link:' || l.case_ref
  FROM ops_data_quality_ticket l, ops_data_quality_ticket a
 WHERE l.legacy_source = 'entity_exceptions' AND l.ticket_type = 'bad_relationship_edge' AND a.dedupe_key = 'ki:22.9';
