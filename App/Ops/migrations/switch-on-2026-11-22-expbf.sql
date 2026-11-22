-- MA-NOV-EXP.BFS.ON (FR13) switch-on: end the open pause row, plus a case event.
-- Copied from claude/packets/MA-NOV-EXP.BFS.GO_Report.md (sha256 6d494906…e293), placeholders filled.
-- Founder words (Start Approval, 2026-11-22T09:58Z): "switch on back-fill"
-- Run once, from the repo root:
--   npx wrangler d1 execute meridian-etf --remote --file App/Ops/migrations/switch-on-2026-11-22-expbf.sql
UPDATE ops_job_pause SET ends_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')
   AND starts_at < strftime('%Y-%m-%dT%H:%M:%SZ','now');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'pause_ended', '2099-01-01T00:00:00Z', strftime('%Y-%m-%dT%H:%M:%SZ','now'),
          '{"packet":"MA-NOV-EXP.BFS.ON","founder_words":"switch on back-fill","pause_id":3}',
          'ops_lead:wrangler', 'system', 'Operations Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          'pause_end:cf.meridian-entities-enrich.expbf:3');
