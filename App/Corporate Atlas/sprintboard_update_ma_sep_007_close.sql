-- MA-SEP-007 final close-out, 2026-08-29 (Known Issue 22.8 follow-up confirmed, packet complete)
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout) with live D1 + GLEIF access.

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-007',
  'entity_master duplicate merge (Tier 1/1b + Tier 2, A/B/C rule) -- CLOSED',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'CLOSED',
  NULL,
  NULL,
  NULL,
  'PACKET COMPLETE (2026-08-29). Every group across both scopes reached a final resolution -- merged, or deliberately left alone by design/Founder decision. Nothing remains pending.

CUMULATIVE MERGE TOTALS (real SELECT COUNT(*), not self-reported meta.changes, at every step):
  Tier 2 auto-eligible (105 Scenario-B + 16 Scenario-C):     45,201 -> 45,078  (-123, 121 groups, incl. 2 three-way)
  Tier 2 individual-review exceptions (4 approved):          45,078 -> 45,074  (-4, 4 groups)
  Tier 1/1b (1,665 Category-A + 55 Category-B script-variant): 45,074 -> 43,354  (-1,720, 1,719 groups, incl. 1 three-way)
  TOTAL MERGED: 1,844 groups, entity_master 45,201 -> 43,354 (-1,847 loser rows)

Separately (not merge-related, do not conflate with the totals above): the Known Issue 22.8 live-test runs of firds-local-seed.mjs added +23 entity_master rows (new issuer entities first seen in that FIRDS pull) and 0 net change on the follow-up re-run -- current live count 43,377, reflecting merges (-1,847) plus this unrelated, expected FIRDS-ingestion growth (+23).

FINAL, PERMANENT NON-MERGES (all deliberate, none of these are open items):
  - 116 Scenario-A deferred groups (115 Category-A country-mismatch + 1 reclassified Category-C, BlackRock/Blackrock Inc) -- no LEI on either side, not enough evidence to merge safely, left as-is by design.
  - 3 disapproved Scenario-B individual-review pairs (SLM Corp/Navient Corp -- known 2014 spinoff; Santander Bank Polska/Erste Bank Polska; OPAP Holding SA/Allwyn AG) -- Founder decision, staying separate.
  - 1 Tier 1b exclusion (Taiwan Speciality Chemicals Co/Corporation, entity_id 92126/107305) -- Founder decision, genuine legal-form difference despite 0.87 similarity, left alone.

KNOWN ISSUE 22.8 FOLLOW-UP (2026-08-29, this session, gates this close-out): confirmed commit a994844''s fix with two live-test runs of firds-local-seed.mjs against the same FULINS_C_20260829_01of01.zip file.
  - Write-volume/full-table-rewrite bug: CONFIRMED FIXED, with hard evidence -- table-wide MAX(last_updated_at) after the second run was still 2026-08-29 11:28:53 (the first run''s timestamp), and 0 rows had any timestamp past that window, proving the second run''s refresh UPDATE genuinely touched nothing (correct behavior, since nothing in the file had changed between the two runs).
  - firdsRefRefreshed counter: STILL BROKEN, in a new way. Reported 18,371 on BOTH runs, identical, despite the second run doing 0 real work (per the table-wide evidence above). Root cause: the fix''s counting query scopes by (source_file, publication_date), which identify a FILE, not a RUN -- they persist unchanged across repeated executions against the same file, so the query echoes back that file''s full historical refresh count forever, not the current call''s actual delta. New follow-up flagged separately (not fixed here, per one-session-one-packet rule) -- this is a distinct bug from the one a994844 targeted, not a re-occurrence of the same one.
  - Decision, confirmed with the Founder in-session: proceed with this close-out despite the open counter bug, since it is an observability/logging gap, not a data-correctness issue -- the underlying FIRDS reference data and the 3-ISIN retroactive cleanup from the prior session are unaffected and independently verified correct.

Full detail across all three sessions: sprintboarditems notes history (this row), Release Ledger REL-2026-08-004/005/006, MA-SEP-007_Merge_Rules_Finalized.md, MA-SEP-007_Tier2_Review.xlsx.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  title = excluded.title,
  stage = excluded.stage,
  status = excluded.status,
  blocker = excluded.blocker,
  next_step = excluded.next_step,
  approval_needed = excluded.approval_needed,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO releaseledger (
  release_id, ticket_ids, change_summary, frontend_files, worker_files,
  d1_migration_status, worker_deploy_status, frontend_push_status,
  verification_status, production_parity_status, status, closed_at
)
VALUES (
  'REL-2026-08-006',
  '["MA-SEP-007"]',
  'MA-SEP-007 final close-out. Known Issue 22.8 follow-up (commit a994844) live-tested twice against the same FULINS_C_20260829_01of01.zip file: the full-table-rewrite bug is confirmed fixed (table-wide MAX(last_updated_at) proved the second run touched 0 rows), but the firdsRefRefreshed counter is still broken -- it reported the identical 18,371 on both runs (a stale, file-scoped cumulative count, not the current run''s real delta of 0) -- flagged as a new, separate follow-up, not fixed in this release. Packet-wide totals: 1,844 groups merged across three sessions (121 Tier 2 auto + 4 Tier 2 exceptions + 1,719 Tier 1/1b), entity_master 45,201 -> 43,354 via merges (real COUNT(*) at every step, not meta.changes), plus +23 unrelated from FIRDS-ingestion live-testing (current live count 43,377). 120 items reached a final permanent non-merge decision (116 Scenario-A deferred by design, 3 disapproved individual-review pairs, 1 Tier 1b exclusion) -- none open. MA-SEP-007 moved to CLOSED in sprintboarditems.',
  NULL,
  'App/Corporate Atlas/src/firds.js (a994844, prior commit, live-tested not modified this session), App/Corporate Atlas/sprintboard_update_ma_sep_007_close.sql',
  'applied',
  'not_started',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED',
  CURRENT_TIMESTAMP
);
