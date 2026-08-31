-- MA-SEP-012d close-out, 2026-08-31 (Entities Product Lead)
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout / LOCAL_MASTER) per claude/MA-SEP-012d_Build_Brief.md.

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-012d',
  'One-Click Refresh for the Entity Merge Exceptions Snapshot',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'CLOSED',
  NULL,
  NULL,
  NULL,
  'Built exactly per claude/MA-SEP-012d_Build_Brief.md (present on local disk when this session started). Wraps MA-SEP-012c''s export-exceptions-snapshot.mjs unchanged -- no edits to its D1 query, zero-network-request property, or output format. Only option 1 (one-click manual refresh) was built, per the Founder''s explicit choice; the LaunchAgent (option 2) and live-http (option 3) variants were deliberately not built, documented in the Build Brief as deferred, not this packet''s job.

ENTRY POINT: App/Corporate Atlas/refresh-exceptions-snapshot.command -- a plain executable shell script (chmod +x, committed with the executable bit preserved, git mode 100755), placed directly next to export-exceptions-snapshot.mjs so it is easy to find without hunting. Day-to-day Founder usage: open Finder, navigate to App/Corporate Atlas/ inside the LOCAL_MASTER checkout, double-click refresh-exceptions-snapshot.command. It regenerates the snapshot from live D1 and opens the fresh entity-exceptions-snapshot.html in the default browser in one action -- no terminal typing, no cd, no remembering the node command.

Resolves its own directory via BASH_SOURCE (not relying on cwd), since a double-clicked .command file''s default working directory is the user''s home directory, not the file''s own location -- confirmed this matters and handled it, not assumed.

VERIFICATION, run for real (not simulated):
  Failure case, run first: temporarily moved wrangler-entities-api.toml aside (App/Corporate Atlas/wrangler-entities-api.toml -> .movedfortest) to force a genuine wrangler/D1 failure, then ran the entry point exactly as double-click would invoke it. Result: clear, visible multi-line error banner in the terminal output (REFRESH FAILED, exit code 1, explains the browser will not be opened), exited non-zero, `open` was never called. Confirmed directly, not just by absence of a browser window: entity-exceptions-snapshot.html''s content was BYTE-IDENTICAL before and after the failed run (md5 bf420297eb7faa46b29637f8103184b9 both times, "Snapshot generated at" timestamp unchanged at 2026-08-31T17:01:15.152Z) -- the failure genuinely did not touch the existing snapshot file at all, not even a partial/truncated write.
  Restored wrangler-entities-api.toml, confirmed it was back in place, re-ran the entry point. Result: exit 0, D1 queried live (3 rows fetched and logged), snapshot file regenerated with a NEW "Snapshot generated at" timestamp (2026-08-31T17:24:10.031Z, ~23 minutes after the prior one -- proving genuine fresh data, not a stale cached copy), `open` invoked against the fresh file with no error. Row count re-confirmed against a direct `SELECT COUNT(*) FROM entity_merge_exceptions` = 3, matching.

No new write path introduced -- the wrapper only shells out to the existing read-only export script and to macOS `open`; confirmed by reading the wrapper''s own contents, not assumed.

Not touched, per explicit scope: export-exceptions-snapshot.mjs''s own logic/query/output format; any LaunchAgent or scheduled execution; any live-fetch/secret-based access; add/edit capability (still deferred from MA-SEP-012c).

Commit: 62fdf77 (entry point + regenerated snapshot + synced Build Brief), pushed to origin/September-2026.'
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
  'REL-2026-08-010',
  '["MA-SEP-012d"]',
  'New double-clickable entry point (refresh-exceptions-snapshot.command) wraps MA-SEP-012c''s export-exceptions-snapshot.mjs unchanged: one double-click regenerates the entity_merge_exceptions snapshot from live D1 and opens it in the default browser. Fails visibly (no browser opened, existing snapshot left untouched) if the underlying script errors. Both the failure case and the happy path were exercised for real (config file temporarily moved aside to force a genuine failure, then restored) -- failure left the snapshot file byte-identical (md5-confirmed), success produced a new timestamp and matched a live row-count check. No new write path; no LaunchAgent/scheduled execution/live-fetch built, per the Founder''s explicit choice of manual one-click refresh only.',
  'App/Corporate Atlas/entity-exceptions-snapshot.html (regenerated output)',
  'App/Corporate Atlas/refresh-exceptions-snapshot.command (wraps App/Corporate Atlas/export-exceptions-snapshot.mjs, unmodified)',
  'none',
  'not_started',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED',
  CURRENT_TIMESTAMP
);
