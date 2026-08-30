-- MA-SEP-012b close-out, 2026-08-30 (Entities Product Lead)
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout) with live D1 + Cloudflare access, per the
-- MA-SEP-012a-approved design and MA-SEP-012b Build Brief (both synced this session).

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-012b',
  'Entity Merge Exception Management — build (entity_merge_exceptions + /admin/exceptions)',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'CLOSED',
  NULL,
  NULL,
  NULL,
  'Built exactly per claude/MA-SEP-012b_Build_Brief.md (synced from the Claude Project this session -- previously existed only there, not on local disk; same recurring gap prior packets have hit).

TABLE: entity_merge_exceptions created (Entities domain, declared explicitly per CLAUDE.md''s new-table rule), columns id/lei/entity_id_a/entity_id_b/decision/reason/corporate_action_note/decided_by/decided_at, indexed on entity_id_a, entity_id_b, and lei. Seeded with the 3 exceptions confirmed during MA-SEP-007 -- entity_ids looked up LIVE against entity_master by matching LEI (not guessed):
  SLM Corp (931) / Navient Corp (1216) -- LEI 54930067J0ZNOEBRW338
  Santander Bank Polska SA (2589) / Erste Bank Polska Spolka Akcyjna (25577) -- LEI 259400LGXW3K0GDAG361
  OPAP Holding SA (2014) / Allwyn AG (25655) -- LEI 213800M4NRGFJCI34834
(Each pair confirmed correct via matching LEI directly against live data -- name search alone returned several unrelated/duplicate-name entities per company, e.g. securitization trusts named "NAVIENT ...", a second "Erste Bank Polska" row with a NULL LEI, and "ALLWYN ENTERTAINMENT FIN" -- LEI matching disambiguated correctly in every case.)

ROUTES: added GET /admin/exceptions (list), POST /admin/exceptions (add), PUT /admin/exceptions/:id (edit) to the EXISTING meridian-entities-api Worker -- no new Worker, no new cron. Every route checks a shared secret (X-Admin-Exceptions-Secret header vs ADMIN_EXCEPTIONS_SECRET binding) before any query, failing closed if the binding is missing -- mirrors entities-enrich''s /run auth (Known Issue 22.13) exactly, distinct secret/header name so the two never collide. Confirmed via repo-wide grep: zero references to /admin/exceptions anywhere outside entities-api.js itself (no navigation entry in index.html or any ma-*.js file).

SECRET: generated via openssl rand -hex 32. Stored via `wrangler secret put ADMIN_EXCEPTIONS_SECRET --config wrangler-entities-api.toml` (piped from a local file, never typed/echoed as a CLI arg) and a local copy at App/Corporate Atlas/.env.admin-exceptions -- confirmed gitignored via `git check-ignore -v` against the root .gitignore''s .env.* rule BEFORE it was written, not after. Never committed, never logged, never included in this report.

THREE-POINT CHECK: existing/new indexes (entity_id_a, entity_id_b, lei on the new table; entity_id PK on entity_master) cover every new query -- confirmed via live read tests: list-exceptions query read 3 rows, entity-existence check read 4 rows, both trivially under the 50k threshold. Read/write budget: negligible, matching MA-SEP-012a''s own estimate (tens to low hundreds of rows, manual Founder-driven writes only, no cron).

DEPLOY: meridian-entities-api version a7e5dcd0-78d6-404f-8c69-c1aa4dfcc5f9.

LIVE VERIFICATION, exactly per the Build Brief (same shape as Known Issue 22.13''s verification):
  GET no secret -> 401 Unauthorized. CONFIRMED.
  GET wrong secret -> 401 Unauthorized. CONFIRMED.
  GET correct secret -> 200, returned all 3 seeded rows exactly. CONFIRMED.
  POST correct secret -> 201, new row created and reflected on a follow-up GET. CONFIRMED (used a throwaway test row, entity_id_a=931/entity_id_b=2589, decided_by=TEST_VERIFICATION_ONLY, real existing entity_ids so the FK-existence check would pass).
  PUT correct secret -> 200, edit reflected on a follow-up GET. CONFIRMED (edited the same test row''s reason field).
  POST no secret, POST wrong secret, PUT no secret, PUT wrong secret -> all 401 Unauthorized via HTTP. CONFIRMED DIRECTLY AGAINST THE TABLE, not just the HTTP response: 0 rows exist with decided_by=SHOULD_NOT_EXIST after the unauthenticated POST attempts; the test row''s reason field was still the authenticated PUT''s value ("verification test row - EDITED"), not the unauthenticated PUT attempt''s "SHOULD_NOT_APPLY"; total row count unchanged at 4 (3 seeded + 1 test) throughout all 4 negative tests.
  Test row (id=4) deleted after verification -- confirmed via a fresh read that exactly the 3 real seeded rows remain (ids 1/2/3, entity_ids matching the lookup above).

Commits: 7d7a33c (table + routes + synced docs), pushed to origin/September-2026.

Not touched, per explicit scope: any other table, any other Worker, any existing route on meridian-entities-api, meridian-holdings, Known Issues 22.12/22.17-22.22.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  title = excluded.title,
  stage = excluded.stage,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO releaseledger (
  release_id, ticket_ids, change_summary, frontend_files, worker_files,
  d1_migration_status, worker_deploy_status, frontend_push_status,
  verification_status, production_parity_status, status, closed_at
)
VALUES (
  'REL-2026-08-008',
  '["MA-SEP-012b"]',
  'New table entity_merge_exceptions (Entities domain), seeded with the 3 MA-SEP-007-confirmed exceptions (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG -- entity_ids looked up live via matching LEI, not guessed). Added GET/POST /admin/exceptions and PUT /admin/exceptions/:id to meridian-entities-api, secret-gated (ADMIN_EXCEPTIONS_SECRET, distinct from entities-enrich''s RUN_AUTH_SECRET), checked before any query. No navigation reference anywhere in the frontend (confirmed via repo-wide grep). Deployed version a7e5dcd0-78d6-404f-8c69-c1aa4dfcc5f9. Live-verified exactly per the Build Brief: unauthenticated/wrong-secret GET/POST/PUT all rejected (401, confirmed directly against the table -- 0 writes), correct-secret GET/POST/PUT all succeed and reflect on follow-up GET. Test row used for verification cleaned up; exactly the 3 real seeded rows remain.',
  NULL,
  'App/Corporate Atlas/src/entities-api.js, App/Corporate Atlas/migrations/ma-sep-012b-entity-merge-exceptions.sql',
  'applied',
  'deployed',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED',
  CURRENT_TIMESTAMP
);
