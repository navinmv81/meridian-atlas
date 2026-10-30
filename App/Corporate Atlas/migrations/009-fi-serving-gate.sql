-- 009-fi-serving-gate.sql — MA-OCT-009 (spec rev 1 §4.1, 2f83d58e0042ebfe920f5823598ee3827c21c57b6bbc103f552cef419b2841f4).
-- Entities domain. Owner: Entities Product Lead (Data-Identity Lead lane). Reader: meridian-entities-api only.
-- Created CLOSED. Opening / closing is one guarded UPDATE (spec §4.1), never part of this file.
-- Apply before the 009 Worker deploy, outside any freeze window (≈ 3 writes):
--   /usr/local/bin/wrangler d1 execute meridian-etf --remote -c wrangler-entities-enrich.toml --file migrations/009-fi-serving-gate.sql
-- Rollback: none needed; the table is left in place (fails closed, 1 row). DROP TABLE fi_serving_gate only by a new CR.

CREATE TABLE IF NOT EXISTS fi_serving_gate (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  state       TEXT NOT NULL CHECK (state IN ('closed','open')),
  changed_at  TEXT NOT NULL,
  changed_by  TEXT NOT NULL,
  evidence    TEXT NOT NULL
);
INSERT OR IGNORE INTO fi_serving_gate (id, state, changed_at, changed_by, evidence)
VALUES (1, 'closed', strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'Engineering Lead',
        'claude/packets/MA-OCT-008.DIL14_Report.md c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399 (AC12 FAIL)');
