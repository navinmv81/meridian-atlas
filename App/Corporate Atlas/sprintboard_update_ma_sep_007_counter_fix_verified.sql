-- MA-SEP-007 / task_043cab6b addendum, 2026-08-29: firdsRefRefreshed counter fix (c8918f3) live-tested and confirmed.
-- MA-SEP-007 itself stays CLOSED (per REL-2026-08-006) -- this is a note-only addendum to that
-- already-closed record, not a reopen, since the counter bug it flagged as an open follow-up is
-- now resolved.

UPDATE sprintboarditems
SET notes = notes || '

ADDENDUM (2026-08-29, task_043cab6b resolved): commit c8918f3 fixed the firdsRefRefreshed
re-run bug flagged in this row''s notes above (the a994844 counter fix scoped the count by
source_file+publication_date -- a file identity, not a run identity -- so it echoed a
processed file''s full historical refresh count forever instead of the current call''s real
delta). c8918f3 rescopes the count to a run boundary: captures D1''s own datetime(''now'')
immediately before the refresh UPDATE batch, then counts only rows whose last_updated_at is
at or after that marker.

Live-tested against real D1, re-running the same already-processed FULINS_C_20260829_01of01.zip
file a third time: firdsRefRefreshed correctly reported 0 (previously reported 18,371 on an
identical no-op re-run). Independently verified via real evidence, not the counter itself --
table-wide MAX(last_updated_at) across all of firds_instrument_reference stayed at
2026-08-29 11:28:53 (unchanged from the pre-run baseline), and 0 rows were newer than that
baseline post-run, confirming the reported 0 is genuinely correct, not a coincidental
miscalculation. task_043cab6b dismissed as resolved.

Sibling gap, still open, not touched by c8918f3 or this session: firdsRefWritten (the
original INSERT OR IGNORE counter) has the same meta.changes-summing pattern through the
same local-seed D1 shim and will have some version of the same always-wrong problem -- flagged
in c8918f3''s own commit message, no follow-up task filed for it yet.',
  updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'MA-SEP-007';
