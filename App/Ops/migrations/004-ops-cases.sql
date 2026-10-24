-- MA-OCT-003 (spec rev 1 §6, 7b8bba9f…80c2). Domain: Ops. Owner: Operations Lead. Only writer: meridian-ops.
-- Additive (IF NOT EXISTS); no table, no column. Dry-run with --local first.
-- Apply: Sat 24 >= 08:05 UTC, after the A6 deploys and before deploy 3 (spec §16; ML-1017-3).
--   /usr/local/bin/wrangler d1 execute meridian-etf --remote -c wrangler-ops.toml --file migrations/004-ops-cases.sql
-- Rollback: leave in place (additive). DROP INDEX only with Founder approval (spec §17).

-- Serves case detail "DQ tickets linked to this exception" (§8.2 C-1) as an index seek
-- instead of a scan. Also used by 004's link action. <= 1,000 rows at 12 months.
CREATE INDEX IF NOT EXISTS idx_ops_dq_linked_exc
  ON ops_data_quality_ticket(linked_exception_ref);

-- A3-4: bounds the sweep's suppression probe S2 (§9.1) to one job's condition-type cases that are open,
-- acknowledged, or resolved inside the 30-day snooze. Without it, S2 would read every case of the job.
CREATE INDEX IF NOT EXISTS idx_ops_exception_job_cond
  ON ops_exception(job_id, exception_type, status, resolved_at);
