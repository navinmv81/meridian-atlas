-- MA-OCT-004 (spec rev 1 §6, 570de1a5…5379). Domain: Ops. Owner: Operations Lead. Only writer: meridian-ops
-- (+ reviewed seed batches). Additive (IF NOT EXISTS); one table, one index; no column change. Dry-run with --local first.
-- Apply: Thu 29, before the 004 deploy (run sheet claude/packets/MA-OCT-004.BUILD_Report.md §6).
--   /usr/local/bin/wrangler d1 execute meridian-etf --remote -c wrangler-ops.toml --file migrations/005-ops-dq.sql
-- Rollback: leave in place (additive; nothing reads it after a code rollback). DROP only with Founder approval and an export (§17).

-- One row per affected object of an aggregate DQ ticket (006 §8.4: one ticket per root cause,
-- per-object list attached). Kept forever, like its ticket. ≤ 500 rows at 12 months (~110 at launch).
CREATE TABLE IF NOT EXISTS ops_dq_ticket_member (
  member_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL,                 -- ops_data_quality_ticket.ticket_id
  object_domain   TEXT NOT NULL,                    -- 001 §5.3 vocabulary
  object_key      TEXT NOT NULL,                    -- canonical key, never a name
  object_ref      TEXT NULL,                        -- JSON ≤ 1 KB (e.g. current/correct LEI, names)
  proposed_action TEXT NULL,                        -- Worker-validated (§7.3)
  member_status   TEXT NOT NULL DEFAULT 'open',     -- Worker-validated (§7.3)
  note            TEXT NULL,                        -- ≤ 500 chars, redacted
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ticket_id, object_domain, object_key)     -- lists a ticket's members (autoindex) and makes seeds idempotent
);
-- "Which tickets mention this object?" for aggregate tickets (complements idx_ops_dq_object).
CREATE INDEX IF NOT EXISTS idx_ops_dq_member_object ON ops_dq_ticket_member(object_domain, object_key);
