INSERT INTO releaseledger (
  release_id, ticket_ids, change_summary, frontend_files, worker_files,
  d1_migration_status, worker_deploy_status, frontend_push_status,
  verification_status, production_parity_status, status
)
VALUES (
  'REL-2026-08-003',
  '["MA-SEP-010"]',
  'meridian-entities-enrich: added shared-secret auth to /run (closes Known Issue 22.13) + GLEIF response-status/latency logging (additive, no dispatch/checkpoint/BATCH change). Deployed version 34146536-4bda-47da-ba1a-b8b6f64eb3e1, both crons unchanged (0 6 * * *, 50 6 * * *). New RUN_AUTH_SECRET secret bound via wrangler secret put (not in any committed file). Local-only addition (no frontend/worker file beyond entities-enrich.js): entities-enrich-boost-run.mjs + scripts/entities-enrich-boost-{install,pause,resume,status,uninstall}.sh, a macOS LaunchAgent (com.meridianatlas.entities-enrich-boost) invoking /run 2 additional times/day (10:50+16:50 UTC) outside Cloudflare Cron Trigger accounting -- low-cadence test step per the approved Change Request, not yet the full 4-6/day target.',
  NULL,
  'App/Corporate Atlas/src/entities-enrich.js',
  'none',
  'deployed',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED'
);
