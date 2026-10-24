-- MA-OCT-003 M2 (spec rev 1 §10.4, 7b8bba9f…80c2): two seeded cases + their 'created' events.
-- GLEIF-E3 (orphaned name_search backlog; not auto-detected, §9.3) and GLEIF-E4 for cf.meridian-entities-delta
-- (held, never run; 003-3). Idempotent (INSERT OR IGNORE on UNIQUE case_ref / dedupe_key / idempotency_key);
-- <= 20 writes. Run on Sat 24 after M1 (§16). The Data-Identity Lead confirms the wording and the job_id.
-- EXC-M- is reserved for cases written by a migration or seed file; raised_via='ops_console' because a person decided it.

INSERT OR IGNORE INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, owner_role,
                                     raised_by, raised_via, dedupe_key)
VALUES ('EXC-M-000001', 'gleif_orphaned_backlog', 'sev2', 'open',
        'GLEIF-E3: name_search queue rows have no consumer (RC-1/H1)',
        '006 H1 CONFIRMED: 26,083 pending name_search rows (011 §2) have no consumer in code. Owner: the enrich fix packet (H1, a name_search consumer). MA-OCT-011 buckets A + Q close at most 3,676 of them (partial relief); >= ~22.4k remain. Not auto-detected (needs an Entities index; MA-OCT-003 §9.3).',
        'cf.meridian-entities-enrich.phase1', 'Data-Identity Lead', 'ops_lead:wrangler', 'ops_console',
        'gleif_orphaned_backlog:name_search');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
SELECT 'exception', CAST(exception_id AS TEXT), 'created', 'ops_lead:wrangler', 'system',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'created:gleif_orphaned_backlog:name_search'
  FROM ops_exception WHERE dedupe_key = 'gleif_orphaned_backlog:name_search';
-- 003-3: GLEIF-E4 is true today for the delta Worker (006 §8.3 "delta: never run"); seed it rather than wait for ~5 Nov.
INSERT OR IGNORE INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, owner_role,
                                     raised_by, raised_via, dedupe_key)
VALUES ('EXC-M-000002', 'gleif_frozen_source', 'sev3', 'open',
        'GLEIF-E4: cf.meridian-entities-delta is held and has never run',
        '006 §8.3 GLEIF-E4 (frozen source): the data the delta Worker maintains has never been refreshed by it. Seeded by MA-OCT-003 M2 because the run ledger only dates from 1 Oct, so the automatic 35-day rule could not fire before ~5 Nov.',
        'cf.meridian-entities-delta', 'Data-Identity Lead', 'ops_lead:wrangler', 'ops_console',
        'gleif_frozen_source:cf.meridian-entities-delta:seed');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
SELECT 'exception', CAST(exception_id AS TEXT), 'created', 'ops_lead:wrangler', 'system',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'created:gleif_frozen_source:cf.meridian-entities-delta:seed'
  FROM ops_exception WHERE dedupe_key = 'gleif_frozen_source:cf.meridian-entities-delta:seed';
