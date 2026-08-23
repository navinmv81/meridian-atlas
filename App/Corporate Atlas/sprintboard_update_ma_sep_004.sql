INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-004',
  'Corporate Atlas Parent-Child Hierarchy View',
  'Entities',
  'application',
  'CLOSED',
  'Entities Product Lead + UX Lead',
  'ACTIVE',
  NULL,
  'Two real, evidenced gaps found during build, both out of this packet''s scope to fix: (1) MA-SEP-001 regression -- 4 legal_parent entity_relationships rows (from 2026-06-10/11) point at entity_ids whose type/lei/name were overwritten by MA-SEP-001''s 2026-08-16 merge (all 4 children now show type=fund with lei=null, but the relationship predates and survived the merge unreconciled) -- Cheniere Energy/GM/Banco Comercial Portugues/ABB now incorrectly show as legal parents of unrelated ETFs. (2) direct_parent_lei/ultimate_parent_lei are 0/43,578 populated database-wide (only direct_parent_exception has data, 6,265 rows) -- the mirror-write code in entities-enrich.js Phase 3 is correct and would populate them on a real GLEIF direct-parent/ultimate-parent hit, but either no such hit has ever occurred or the historical 4 hits were wiped by the same MA-SEP-001 merge. Requirement 1''s clickable-parent feature is code-verified correct (synthetic data test) but has zero real positive examples to demonstrate against production data today.',
  NULL,
  'Approved scope built and verified against real production data (not mocked). Two-piece change: (1) entities-api.js handleGraph children query gained ORDER BY (legal_parent alpha, fund_manager by etf_holding_count desc -- confirmed the meaningfully-populated importance column live) plus LIMIT 20->200 (justified: real max fan-out is 96 for BlackRock/iShares Trust entity_id 273, already exceeding the old LIMIT 20 -- the frontend''s own per-group cap needs the true total to show an accurate "+N more", impossible if the backend silently truncated below that first). Three-point check: EXPLAIN QUERY PLAN confirms indexed SEARCH on the entity_relationships PK (parent_entity_id), no full scan, sort is an in-memory temp b-tree over the already-filtered small row set; real live invocation against the worst case (entity 273) read 289 rows, far under the 50k threshold. Deployed (version d43a851f), verified live (96 children now returned in correct order, was 20 unordered before). (2) ma-entities.js: showEntityDetail/showEntityOverlay now also fetch /graph (non-fatally) for parent-entity-id resolution and children data; _ownershipRow renders Direct/Ultimate parent as clickable when a parents[] LEI match exists, else unchanged plain text; new Children section (Subsidiaries / Managed Funds, cap 12, accurate "+N more", hidden if zero) inserted after the Ownership/Identifiers row; navigation is context-aware (showEntityDetail vs showEntityOverlay) via the existing backHandler signal, fixing a bug that would otherwise have broken navigation from the ETF-Holdings overlay entry point. Verified live in-browser against real production API data: BlackRock/iShares Trust shows "MANAGED FUNDS (96)" correctly ordered with "+84 more" (96-12, exact); a real MA-SEP-003 EU fund entity (28169, GREAT EAGLE HOLDINGS LIMITED) renders with Children section correctly absent and Ownership Chain gracefully "None reported"/"Not reported", no EU-specific code path, no crash -- confirms MA-SEP-003''s FIRDS ingestion writes zero relationship edges (Open Question 3), as expected. entities-api.js''s ORDER BY change confirmed NOT to need its own /change-request per CLAUDE.md''s exact trigger list (environment/branch/folder/schema change) -- no schema change, no new index, existing PK index already covers it. Frontend change (ma-entities.js) is complete and verified against live production data via local static-file serving, but NOT yet copied to DEPLOY_BRANCH (corporate-atlas-v4-deploy-clean) -- that manual copy-and-push step, per CLAUDE.md''s standing Environment Truth note, was not in this packet''s Build Brief scope and has not been performed.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  stage = excluded.stage,
  notes = excluded.notes,
  next_step = excluded.next_step,
  approval_needed = excluded.approval_needed,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO releaseledger (release_id, ticket_ids, change_summary, frontend_files, worker_files, d1_migration_status, worker_deploy_status, frontend_push_status, verification_status, production_parity_status, rollback_note, status)
VALUES (
  'REL-2026-08-001',
  '["MA-SEP-004"]',
  'Corporate Atlas parent-child hierarchy view: clickable Ownership Chain (Direct/Ultimate parent), new Children section (Subsidiaries/Managed Funds, capped with accurate overflow count). entities-api.js children query gained ORDER BY + LIMIT 20->200 (index-covered, three-point-checked, no schema change).',
  'ma-entities.js',
  'entities-api.js (handleGraph children query only)',
  'none',
  'deployed',
  'not_started',
  'passed',
  'diverged',
  'Backend: redeploy wrangler-entities-api.toml from the prior version (git history) if the ORDER BY/LIMIT change needs reverting -- zero schema/index change means no D1 rollback needed. Frontend: not yet pushed to DEPLOY_BRANCH, so no live-site rollback is needed either; simply do not perform the copy-and-push step.',
  'VERIFIED'
)
ON CONFLICT(release_id) DO UPDATE SET
  change_summary = excluded.change_summary,
  status = excluded.status,
  updated_at = CURRENT_TIMESTAMP;
