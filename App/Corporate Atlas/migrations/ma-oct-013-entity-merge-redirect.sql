-- ma-oct-013-entity-merge-redirect.sql — MA-OCT-013 (spec rev 1 §6.1, e6dc8567…f098; CR1).
-- One row per duplicate deleted by 013, so 007 R3 and 004 resolve stale ids (single hop).
-- Applied by `merge-013.sh migrate` (≈ 3 writes), never by hand. Rollback (Ops N-7): DROP TABLE
-- entity_merge_redirect only when 0 rows have packet = 'MA-OCT-013'; 007 and 004 tolerate its absence.
CREATE TABLE IF NOT EXISTS entity_merge_redirect (
  duplicate_id INTEGER PRIMARY KEY,  -- rowid alias, no separate index (L11-14)
  survivor_id  INTEGER NOT NULL,
  merged_at    TEXT    NOT NULL,     -- ISO-8601 UTC: the run token (§6.2)
  packet       TEXT    NOT NULL      -- 'MA-OCT-013'
);
