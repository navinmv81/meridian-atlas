-- registry-load-2026-11-20-expbf.sql — MA-NOV-EXP.BFS.GO Part B (Operations Lead).
-- Source: claude/packets/MA-NOV-EXP.BFS.BUILD_Report.md §5 (sha256 d48b45b3…31f0), 003 procedure
-- (App/Ops/migrations/003-ops-job-pause.sql header): reviewed `wrangler d1 execute --remote --file` batch,
-- each control-row write paired with an ops_case_event row (subject_type 'ops_control').
--
-- ORDER MATTERS: the pause row goes in FIRST, so the job is paused before it is registered. The job stays OFF;
-- ending the pause row is the switch-on (FR13) and is NOT part of this file.
--
-- Idempotent: re-running is a no-op.
--   * ops_job_pause has no unique key, so the pause row is inserted only if no open pause exists for the job.
--   * ops_job_registry: INSERT OR IGNORE on the job_id primary key.
--   * ops_case_event: INSERT OR IGNORE on idempotency_key (UNIQUE).
-- No UPDATE, no DELETE. Estimated row-writes: 4 rows + their indexes (≈ 10).

-- (1) Pause row — keeps cf.meridian-entities-enrich.expbf OFF until the Founder switches it on.
INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by)
  SELECT 'cf.meridian-entities-enrich.expbf', strftime('%Y-%m-%dT%H:%M:%SZ','now'), '2099-01-01T00:00:00Z',
         'MA-NOV-EXP.BFS ships off until checks pass and the Founder switches on', 'ops_lead:wrangler'
  WHERE NOT EXISTS (SELECT 1 FROM ops_job_pause
                    WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > strftime('%Y-%m-%dT%H:%M:%SZ','now'));

-- (2) Registry row — as BUILD report §5; daily write cap 40,000.
INSERT OR IGNORE INTO ops_job_registry (job_id, display_name, domain, owner_role, execution_mode, worker_name, source_path,
  intended_schedule, emitter_id, ingest_enabled, expected_max_duration_s, kill_switch_ref, write_budget_profile, status, notes)
VALUES ('cf.meridian-entities-enrich.expbf', 'meridian-entities-enrich (exposure back-fill, 06:00 after Phase 1, Tue–Sat)',
  'Entities', 'Data-Identity Lead', 'cron', 'meridian-entities-enrich', 'App/Corporate Atlas/src/exp-backfill.js',
  '{"kind":"cf_cron","exprs":["0 6 * * *"],"tz":"UTC","on_time_tol_s":600,"grace_s":3600}', 'entities-enrich-cf', 1, 900,
  'ops_job_pause (job_id) + hold_all_jobs (holdings_pipeline_state)', '{"daily_rows_written_cap":40000}', 'active',
  'MA-NOV-EXP.BFS; skips Sun/Mon UTC in code (out_of_window)');

-- (3) Case events, per the 003 procedure.
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'pause_added', NULL, '2099-01-01T00:00:00Z',
          '{"packet":"MA-NOV-EXP.BFS.GO","reason":"MA-NOV-EXP.BFS ships off until checks pass and the Founder switches on","ends_at":"2099-01-01T00:00:00Z"}',
          'ops_lead:wrangler', 'system', 'Operations Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          'pause:cf.meridian-entities-enrich.expbf:MA-NOV-EXP.BFS.GO');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'registry_updated', NULL, 'active',
          '{"packet":"MA-NOV-EXP.BFS.GO","change":"insert","write_budget_profile":{"daily_rows_written_cap":40000},"source":"MA-NOV-EXP.BFS.BUILD_Report.md §5"}',
          'ops_lead:wrangler', 'system', 'Operations Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          'registry:cf.meridian-entities-enrich.expbf:insert:MA-NOV-EXP.BFS.GO');
