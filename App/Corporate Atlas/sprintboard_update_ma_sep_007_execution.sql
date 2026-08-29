-- MA-SEP-007 Tier 2 merge execution close-out, 2026-08-29
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout) with live D1 + GLEIF access, per the
-- Merge_Rules_Finalized packet's hand-off from the Cowork device-bridge session.

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-007',
  'entity_master Tier 2 duplicate merge — A/B/C rule execution',
  'Entities',
  'data_identity',
  'ENG_IMPLEMENT',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  'Awaiting Founder row-by-row Decision on the remaining 123 Tier 2 groups (115 Scenario-A defer-by-design + 7 Scenario-B individual-review exceptions below the 0.5 similarity floor/named overrides + 1 Scenario-C-reclassified-to-A group, BlackRock/Blackrock Inc). Re-run this same execution path against whichever of those the Founder marks Approve; anything left blank or marked Disapprove stays untouched, per standing instruction.',
  NULL,
  'EXECUTION RESULT (2026-08-29): 121 of 244 Tier 2 groups actioned this run — every row with Decision=Approve as of this run (105 Scenario-B auto-eligible + 16 Scenario-C auto-eligible), 0 of the 7 individual-review or 116 deferred groups had a Founder decision filled in yet, so 0 of those were touched (not assumed approved).

Real entity_master row count, SELECT COUNT(*) not self-reported meta.changes per this project''s own meta.changes lesson: 45,201 before -> 45,078 after (delta -123, matches the 123 loser entity_ids exactly: 119 two-way groups + 2 three-way groups [Deutsche Börse AG 3-way, survivor 2458; Münchener Rückversicherungs-Gesellschaft AG 3-way, survivor 2404] = 119+4).

Survivor selection: Scenario C used the packet''s explicit rule (merge onto whichever entity_id already carries the LEI — confirmed per-row, not always the lower id, e.g. Invesco Ltd 1552 survived over Invesco 286). Scenario B''s survivor was NOT specified by the packet (both/all sides already share the LEI) -- adopted "lowest entity_id survives" after checking precedent: 1011 of 1021 MA-SEP-001 pairs (99%) kept the lower id, and the xlsx''s own Entity 1/2/3 ordering matched this in all 121 approved rows. Confirmed with the Founder in-session before executing, not assumed silently.

Table-list correction found and applied: the packet (and the original MA-SEP-001 Build Brief spec) name six dependent tables, but MA-SEP-001''s actual executed SQL (ma-sep-001-merge-migration.sql / -pass2.sql, the exact files the packet points to as reference) also repoints a 7th, entity_isin_map (added later via gleif-schema-migrate.js, not in the base schema when the Build Brief was written). Included it here — confirmed with the Founder before executing. fund_exposure_coverage.holder_entity_id and entity_exposure_monthly.holder_entity_id both confirmed live, 0 affected rows, no statement needed (same as MA-SEP-001 precedent).

/validate-data close-out: 0 orphaned FKs introduced by this run across all 7 dependent tables; 0 new uniqueness violations (checked entity_relationships and entity_exposure_monthly composite PKs directly); hand spot-checked a sample incl. both 3-way groups and a Scenario-C higher-id survivor (Invesco Ltd) -- all correct. Found 2 PRE-EXISTING orphaned entity_enrichment_queue rows (entity_id 408, 3205, "Kratos Defense..." dupes) unrelated to any of today''s 121 groups -- flagged separately below, not fixed here (out of this packet''s scope, one-session-one-packet rule).

Read/write budget: reads were ~15 small COUNT/schema queries (all tables 264-45,201 rows, all under the 50k single-read threshold) + 121 live GLEIF API calls (0 errors). Write was 1 batch execution, 22 statements, against tables ranging 133-45,201 rows -- no full scan of a large unindexed table (fund_entity_link and instrument_entity_map have no index on entity_id, but at 264 and 32,769 rows respectively a full scan is trivial, confirmed via the pre-execution three-point check, not assumed safe.

New backlog item flagged separately (not fixed in this run, needs its own pass): pre-existing entity_enrichment_queue orphans for entity_id 408 and 3205 (name "Kratos Defense & Security Solutions" variants), left over from prior activity (likely MA-SEP-001 or earlier), unrelated to any of today''s 121 merge groups.'
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
  'REL-2026-08-004',
  '["MA-SEP-007"]',
  'entity_master Tier 2 duplicate merge, 121 of 244 groups (105 Scenario-B auto + 16 Scenario-C auto, incl. 2 three-way groups). Survivor name sourced live from GLEIF lei-records API per group (not reused from either existing row). Repointed 7 dependent tables (entity_relationships, fund_entity_link, instrument_entity_map, entity_exposure_monthly, fund_exposure_coverage, entity_enrichment_queue, entity_isin_map -- the 7th added beyond the packet''s 6-table list, matching MA-SEP-001''s actual executed pattern). entity_master: 45,201 -> 45,078 rows (real COUNT(*), not meta.changes). 0 orphaned FKs introduced, 0 new uniqueness violations, spot-checked by hand. 2 pre-existing unrelated orphaned entity_enrichment_queue rows found (408, 3205) -- flagged on MA-SEP-007, not fixed here. Remaining 123 of 244 groups (115 Scenario-A defer + 7 Scenario-B individual-review + 1 reclassified) await Founder decision, untouched.',
  NULL,
  'App/Corporate Atlas/ma-sep-007-merge-migration.sql',
  'applied',
  'not_started',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED'
);

-- New backlog idea surfaced during MA-SEP-007's rule-finalization conversation, logged per close-out
-- instruction. Next available MA-<MONTH>-<NNN> id confirmed live against sprintboarditems before writing
-- (0 existing MA-OCT-* rows found) -- not assumed, per this project's prior MA-SEP-002/007 id collision.
INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-OCT-001',
  'Data Quality Exception Management tool',
  'Entities',
  'data_identity',
  'IDEA',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  'Needs /write-spec before any build session, per CLAUDE.md''s standing rule. Not started -- logging only, per the one-session-one-packet rule.',
  'Founder review of the spec, once written; also needs its own small design decision on the internal-only admin-surface access-control mechanism (this project has no existing auth pattern to reuse).',
  'Proposed scope: a new, small D1 table recording durable entity-merge exception decisions (lei_or_key, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by, decided_at) so a verified call (e.g. SLM Corp/Navient Corp: known 2014-spinoff LEI-reuse, do not merge) persists and is checked automatically by future dedup/enrichment passes instead of being re-litigated every GLEIF re-sync. Plus a simple internal-only admin surface to view/add/edit exceptions, explicitly not exposed to Meridian Atlas''s terminal end users. Surfaced during MA-SEP-007''s Scenario-B rule conversation (Santander Bank Polska/Erste Bank Polska-shape cases: LEI retention/reuse through corporate actions is a recognized recurring pattern, confirmed from the Founder''s own transaction experience, not a one-off). Domain proposed: Entities (subject matter is entity-dedup exceptions specifically); likely also touches Tech Ops/Architect for the access-control mechanism. Non-goals for the spec to confirm: not a general cross-domain data-quality tool on day one; not a replacement for /validate-data''s existing checks. Full detail: MA-SEP-007_Merge_Rules_Finalized.md §4.'
);
