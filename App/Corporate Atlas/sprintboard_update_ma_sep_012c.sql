-- MA-SEP-012c close-out, 2026-08-31 (Entities Product Lead)
-- Executed from a true local Claude Code Terminal session (September-2026 branch,
-- Meridian Atlas Clean v11 checkout / LOCAL_MASTER) per claude/MA-SEP-012c_Build_Brief.md.

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-012c',
  'Local Snapshot Viewer for Entity Merge Exceptions (view-only)',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'CLOSED',
  NULL,
  NULL,
  NULL,
  'Built exactly per claude/MA-SEP-012c_Build_Brief.md (present on local disk when this session started -- no re-sync needed this time). Read-only, local-only: no Worker, no cron, no writes anywhere in this packet.

FLAGGED, not silently assumed: the Build Brief references admin-exceptions.html (built for "MA-SEP-012 / Known Issue 22.23") as the thing this packet replaces the friction of. Neither that file nor any "Known Issue 22.23" tracking exists anywhere in this repo -- checked working tree, full git history all branches, and sprintboarditems/notes. Not something this packet needed to touch or fix (the brief explicitly says it is not touched or deleted by this packet either way), but flagging the same "referenced but never landed on local disk" gap this project has hit repeatedly with other Cowork-session artifacts.

SCRIPT: App/Corporate Atlas/export-exceptions-snapshot.mjs (Node, ESM, same `execFileSync` + `wrangler d1 execute --remote --json` transport already used by entities-enrich-boost-run.mjs / firds-local-seed.mjs -- no separate CF_API_TOKEN needed, uses wrangler''s own authenticated session). Re-run any time via: `node export-exceptions-snapshot.mjs` from App/Corporate Atlas/ (paths inside the script are absolute via import.meta.url, so it also works from elsewhere). Queries entity_merge_exceptions LEFT JOINed to entity_master (on entity_master''s PK, entity_id) to resolve both sides'' names for display -- confirmed live as a cheap, indexed read (12 rows_read for 3 exception rows x 2 joins each) before running for real, satisfying the Build Brief''s safety-section requirement even though the usual three-point check does not apply to a non-cron local script.

OUTPUT: App/Corporate Atlas/entity-exceptions-snapshot.html -- placed alongside the script (same directory), since admin-exceptions.html does not exist to establish a precedent location and the Build Brief asked to confirm rather than guess a buried path; flagging this choice explicitly rather than treating it as obviously correct. Self-contained: row data baked into an inline `<script>` block as `const EXCEPTIONS = [...]` at generation time, "Snapshot generated at <ISO timestamp>" banner at the top, columns exactly as specified (entities A<->B with both name and #id, LEI, decision badge, reason, corporate action note, decided by/at). No API URL field, no secret field, no add/edit form anywhere in the page -- by design, per the Founder''s explicit view-only-for-now decision.

VERIFICATION:
  Row count: direct `SELECT COUNT(*) FROM entity_merge_exceptions` = 3. HTML''s baked-in EXCEPTIONS array = 3, content byte-for-byte matching (same ids/names/entity_ids/decisions) -- confirmed by extracting and parsing the array directly out of the generated file, not just eyeballing it.
  Rendering: opened via a local static server (the pre-existing corporate-atlas-static launch config, port 8791 -- serves the whole App/ directory, already set up before this session, not created for this packet) rather than literal file:// double-click, because this session''s Browser pane tooling cannot get a live DOM/network context for file:// URLs outside its own project directory (files there render as opaque static snapshots only -- a real tool limitation, not skipped). Page text confirmed rendering correctly: title, generated-at timestamp, banner, and all 3 rows with correct data.
  Zero network requests: CONFIRMED TWO WAYS. (1) Exhaustive static grep of the generated HTML for every construct that could trigger a request -- fetch(, XMLHttpRequest, WebSocket, EventSource, <script src=, <link href=, external <img src=, sendBeacon, dynamic import(, postMessage, <iframe> -- zero matches; the only <script> tag present has no src attribute (inline only). (2) Live network-tab equivalent via the Browser pane''s read_network_requests against the http://localhost:8791 rendering: exactly 1 total request logged, and it is the page''s own initial navigation/load (GET .../entity-exceptions-snapshot -> 200) -- zero requests triggered by the page''s own script/content beyond that unavoidable initial load. One console error was observed ("Failed to load resource: 402") that does NOT correspond to any entry in the network request log -- most likely the preview tooling''s own infrastructure (e.g. a favicon/proxy call), not anything in this page''s own code (which contains no such reference, confirmed by the static grep above); flagged rather than silently ignored, but does not change the zero-network-requests finding for the page''s own content.
  This is a strictly stronger check of the same file''s network behavior than literal file:// would give (an actual live network tab, not just static reasoning) -- the Founder can still do the literal double-click/file:// open exactly as described in the Build Brief; that will behave identically since nothing about the page''s network behavior depends on which origin serves it.

Not touched, per explicit scope: meridian-entities-api, its routes, or ADMIN_EXCEPTIONS_SECRET; admin-exceptions.html (does not exist, so nothing to touch); any new Worker/cron/KV; any add/edit/write mechanism (explicitly deferred by the Founder as a separate future decision).

Commit: (this session, App/Corporate Atlas/export-exceptions-snapshot.mjs + entity-exceptions-snapshot.html + claude/MA-SEP-012c_Build_Brief.md), pushed to origin/September-2026.'
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
  'REL-2026-08-009',
  '["MA-SEP-012c"]',
  'New local, read-only export script (export-exceptions-snapshot.mjs) generates a self-contained HTML snapshot of entity_merge_exceptions -- data baked in at generation time, zero network requests, view-only (no add/edit, per the Founder''s explicit deferral). No Worker, no cron, no D1 writes. Verified: row count matches live D1 exactly (3), zero network requests confirmed both via exhaustive static analysis and a live network-tab check (1 request total = the page''s own initial load, nothing else). Replaces the friction of admin-exceptions.html''s live-fetch approach for viewing -- that file was not found anywhere in this repo when checked, flagged as a referenced-but-never-landed artifact, not touched either way per the Build Brief''s own scope.',
  'App/Corporate Atlas/entity-exceptions-snapshot.html (generated output, re-created by re-running the script)',
  'App/Corporate Atlas/export-exceptions-snapshot.mjs',
  'none',
  'not_started',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED',
  CURRENT_TIMESTAMP
);
