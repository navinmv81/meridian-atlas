-- 003-ops-job-pause.sql
-- MA-OCT-002a A2 (CR-2). Spec: claude/MA-OCT-002_Spec.md rev 1.3 §6.3.
--
-- Planned pauses for registered jobs. A slot whose time falls in
-- [starts_at, ends_at) is `paused`, never `missed` (read-time lateness, A2).
-- First use: the MA-OCT-011 boost pause, local.entities-enrich-boost
-- 2026-10-17T00:00Z → 2026-10-24T00:00Z, inserted by the Operations Lead by
-- Fri 16 Oct if 011 is GO (a separate, Operations Lead–authorised write).
--
-- Domain: Ops. Owner: Operations Lead. ONLY service writer: meridian-ops.
-- Until an admin route exists (MA-OCT-005), rows are written by a reviewed
-- `wrangler d1 execute --remote --file` batch together with an ops_case_event
-- row (subject_type='ops_control', event_type='pause_added'), as for the 001
-- kill-switch toggles.
--
-- Additive only (IF NOT EXISTS); re-running is a no-op. Dry-run with --local first.
-- Size: a handful of rows a month, kept forever (audit), < 1 KB a year.
-- Read (L3): SELECT job_id, starts_at, ends_at, reason FROM ops_job_pause
--            WHERE ends_at >= ?  — declared bounded scan (≤ 100 rows) or
--            SEARCH idx_ops_job_pause_job_end; checked at build (three-point step 1).

CREATE TABLE IF NOT EXISTS ops_job_pause (
  pause_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      TEXT NOT NULL,          -- ops_job_registry.job_id
  starts_at   TEXT NOT NULL,          -- ISO-8601 UTC, inclusive
  ends_at     TEXT NOT NULL,          -- ISO-8601 UTC, exclusive
  reason      TEXT NOT NULL,          -- e.g. 'MA-OCT-011 run window (Founder GO 12 Oct)'
  created_by  TEXT NOT NULL,          -- verified identity or 'ops_lead:wrangler'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_ops_job_pause_job_end ON ops_job_pause(job_id, ends_at);
