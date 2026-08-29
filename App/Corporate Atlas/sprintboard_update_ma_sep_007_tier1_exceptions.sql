-- MA-SEP-007 Tier 1/1b + exceptions execution close-out, 2026-08-29 (continuation session)
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout) with live D1 + GLEIF access, continuing on from
-- the prior MA-SEP-007 Tier 2 execution (c9e4c88) and this session's own Tier 1/1b +
-- exceptions prep (c3beb81).

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-007',
  'entity_master Tier 1/1b + Tier 2 duplicate merge — A/B/C rule execution',
  'Entities',
  'data_identity',
  'ENG_IMPLEMENT',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  'Remaining open items, none blocking: 116 Scenario-A deferred groups (115 Category-A country-mismatch + 1 reclassified Category-C group, BlackRock/Blackrock Inc — by design, not a gap, no LEI on either side); 3 disapproved Scenario-B individual-review pairs (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG — explicitly staying separate per Founder decision); 1 Tier 1b exclusion (Taiwan Speciality Chemicals Co/Corporation — Founder decision, genuine legal-form difference, left alone). None of these are pending further action unless the Founder revisits a decision.',
  NULL,
  'CONTINUATION EXECUTION RESULT (2026-08-29, same day as the Tier 2 run): this session actioned 1,723 additional groups on top of the prior 121 -- 4 Tier 2 individual-review exceptions (IBM/International Business Machines Corp., MERCK KGaA, RWE AG, RELX PLC, all Founder-approved same day) + 1,719 of 1,720 Tier 1/Tier 1b candidate groups (1,664 Category-A same-country-no-LEI pairs... correction, actual count is 1,665 per the merge map -- the migration file''s own header comment says 1,664, a typo, verified by counting the actual VALUES list -- + 55 Category-B script-variant-of-same-LEI pairs), incl. one 3-way group (Oriental Union Chemical Corp, survivor 94173, two losers). Taiwan Speciality Chemicals Co (92126)/Corporation (107305) correctly excluded per Founder decision -- confirmed both rows still present, untouched, after the run.

Real entity_master row counts, SELECT COUNT(*) not self-reported meta.changes (this project''s own meta.changes lesson, re-confirmed necessary again this session -- see below):
  Step 1 (4 exceptions):     45,078 -> 45,074  (delta -4, exact)
  Step 2 (1,719 Tier1/1b):   45,074 -> 43,354  (delta -1,720, exact)
  This session cumulative:   45,078 -> 43,354  (delta -1,724, exact, matches prediction)
  Both sessions combined:    45,201 -> 43,354  (delta -1,847 total loser rows removed across 1,844 groups: 121+4+1,719)

Survivor selection: exceptions batch used the same "lowest entity_id" rule as Tier 2 Scenario B (all 4 pairs already shared an LEI). Tier 1 (Category A, no LEI) kept the existing name unchanged, no GLEIF fetch -- per rule, there''s no LEI to verify a canonical name against. Tier 1b (55 script-variant-of-same-LEI pairs) got a live GLEIF name fetch each, same as Tier 2 Scenario B/C (0 of 55 fetch errors). Names were filled into each migration''s scratch _name_map table, verified 0 NULLs remained, before running the repoint pass past each file''s "STOP HERE" marker -- not skipped.

REAL FINDING, not glossed over: this session also live-tested the Known Issue 22.8 fix (firds-local-seed.mjs / src/firds.js, committed c9e4c88, never live-tested until now). Ran firds-local-seed.mjs once manually against the live 2026-08-29 FULINS_C file (18,404 records). The fix''s own self-reported counter (firdsRefRefreshed, computed by summing D1''s meta.changes across a batched UPDATE) printed 0 -- but real evidence (first_seen_at vs last_updated_at) shows the refresh pass actually rewrote 18,371 pre-existing rows this run, not 0. This is the exact "meta.changes lesson" this project already learned in MA-SEP-003, recurring in this new code path -- self-reported write counts from a batched D1 UPDATE cannot be trusted here either, only real before/after evidence. Separately: the refresh WHERE clause (`publication_date < incoming publication_date`) is not the narrow "only genuinely stale rows" pass its own code comment implies -- since a weekly file''s publication_date always advances past whatever is stored, it rewrites virtually the entire previously-seen table (18,371 of 18,384 pre-existing rows) every single week, with real write-budget implications against the documented 80,000/day D1 write guard that were not accounted for when the fix was designed. Functionally the fix itself is correct (verified: all 3 known-affected ISINs now carry the current, GLEIF/FIRDS-confirmed LEI, not the stale one), but the counter is broken and the write-volume design question is open. Flagged as a separate follow-up, not fixed in this session (out of this packet''s scope).

Known Issue 22.8 retroactive cleanup, exact findings (not just "done"): entity_isin_map held 2 rows per ISIN for all 3 known-affected ISINs before cleanup --
  US77926X2962: kept entity_id 215225 (LEI 529900VX3QN4D0OUYF04, current), deleted entity_id 204921 (LEI 724500D4BFEWKWVC1G62, stale)
  US92189L1035: kept entity_id 215231 (LEI 5299006ZFW6USLS7BT22, current), deleted entity_id 204920 (LEI 254900QBKK4WBSO3GE51, stale)
  US92647X7562: kept entity_id 215234 (LEI 254900RL22F8ZCNOZE73, current), deleted entity_id 204921 (LEI 724500D4BFEWKWVC1G62, stale)
Real before/after: entity_isin_map row count unaffected by the same-day ingest run (isinMapWritten:0, no new duplicates formed), 3 rows removed by the explicit DELETE (real count matches, not just meta.changes -- verified by re-querying the 3 ISINs post-delete, exactly 1 row each remains, each matching firds_instrument_reference''s current LEI).

/validate-data close-out: 0 orphaned FKs introduced by this session across all 7 dependent tables; the only 2 orphaned entity_enrichment_queue rows found (408, 3205) are the same pre-existing, unrelated ones flagged in the prior session''s notes -- confirmed still exactly those 2 and no new ones, not fixed here (separate flagged follow-up, out of scope). 0 new uniqueness violations (entity_relationships, entity_exposure_monthly, entity_isin_map composite PKs all checked directly). Spot-checked a sample incl. the 3-way group, a Tier1b non-Latin-script GLEIF name (Hellenic Telecom -- Greek script legal name, expected, GLEIF returns the officially registered form regardless of script), and the Taiwan Speciality Chemicals exclusion holding.

Read/write budget: reads were ~20 COUNT/existence/schema queries (largest table ~45k rows, all under the 50k single-read threshold) + 55 live GLEIF calls (0 errors) + 1 full firds-local-seed.mjs run (18,404 records, real D1 writes at the scale noted above). Writes were 4 batch executions (exceptions setup, exceptions repoint, tier1/1b setup, tier1/1b repoint) across tables ranging 133-45k rows pre-run, plus the firds ingest run''s own writes, plus 1 explicit 3-row DELETE for the retroactive cleanup -- no full scan of a large unindexed table beyond what was already three-point-checked in the prior session (same tables, same discipline).'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  title = excluded.title,
  stage = excluded.stage,
  status = excluded.status,
  blocker = excluded.blocker,
  next_step = excluded.next_step,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO releaseledger (
  release_id, ticket_ids, change_summary, frontend_files, worker_files,
  d1_migration_status, worker_deploy_status, frontend_push_status,
  verification_status, production_parity_status, status
)
VALUES (
  'REL-2026-08-005',
  '["MA-SEP-007"]',
  'entity_master Tier 1/1b + Tier 2-exceptions duplicate merge: 1,723 additional groups (4 Tier 2 individual-review exceptions + 1,719 of 1,720 Tier 1/1b candidates, 1 excluded -- Taiwan Speciality Chemicals Co/Corporation, Founder decision). entity_master 45,078 -> 43,354 (real COUNT(*), delta -1,724, this session). Combined with the prior Tier 2 auto-merge run same day: 45,201 -> 43,354 overall (-1,847 loser rows / 1,844 groups). Repointed the same 7 dependent tables as the prior run. 0 orphaned FKs introduced, 0 new uniqueness violations; the 2 pre-existing unrelated entity_enrichment_queue orphans (408, 3205) remain flagged, unfixed, out of scope. Also: live-tested the Known Issue 22.8 fix (firds-local-seed.mjs, committed c9e4c88) for the first time -- functionally correct (3 known-affected ISINs, US77926X2962/US92189L1035/US92647X7562, now carry the current FIRDS/GLEIF LEI after retroactive cleanup removed the 3 stale entity_isin_map rows) but found its self-reported firdsRefRefreshed counter is broken (reported 0, real refresh count was 18,371 rows via first_seen_at/last_updated_at comparison) and its refresh WHERE clause rewrites virtually the entire firds_instrument_reference table every week rather than only genuinely-stale rows -- both flagged as a separate follow-up, not fixed in this release.',
  NULL,
  'App/Corporate Atlas/ma-sep-007-tier1-merge-migration.sql, App/Corporate Atlas/ma-sep-007-exceptions-merge-migration.sql (both executed as-is, already committed c3beb81); firds-local-seed.mjs / src/firds.js live-tested (already committed c9e4c88, no new code change)',
  'applied',
  'not_started',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED'
);
