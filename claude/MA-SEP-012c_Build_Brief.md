# MA-SEP-012c — Local Snapshot Viewer for Entity Merge Exceptions (view-only)

**Lane:** Data/Identity | **Owner role:** Entities Product Lead | **Stage:** APPROVED — ready to execute
**Supersedes in practice (not in spec):** the live-authenticated-fetch pattern in `admin-exceptions.html` (built for MA-SEP-012 / Known Issue 22.23). That file is not touched or deleted by this packet — this brief only adds a new, separate viewer.
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session and its linked-device bridge both lack live Cloudflare/D1 access, and per this project's session discipline, build/fix work does not execute inside the Control master-lane.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-012c.`

---

## Context

`entity_merge_exceptions` (created by MA-SEP-012b) holds the Founder's merge/no-merge decisions for ambiguous entity pairs. The only way to see its contents today is `admin-exceptions.html`, a local page that authenticates against the live `meridian-entities-api` Worker with a shared secret and calls it over `fetch()`. In practice this has been friction-heavy for the Founder: locating the gitignored secret file, running commands from the correct local folder, and an unresolved "Failed to fetch" browser error (a `file://`-origin restriction is suspected but never confirmed).

**Founder decision (2026-08-31):** replace this with a local **snapshot** — a page with the exceptions data baked directly into the HTML at generation time, with zero network calls of any kind. Of three options presented for how future add/edit decisions would work under this model, the Founder chose **view-only for now — decide on the write/decision-recording mechanism later, as its own separate decision.** Do not build any add/edit capability in this packet.

## Scope

### 1. A small local export script (not a Worker, not a cron)

Write a script (Node, run locally — e.g. `export-exceptions-snapshot.js` or a `.mjs`, whatever fits this repo's existing local-script conventions such as `firds-local-seed`) that:

- Reads `entity_merge_exceptions` from the live `meridian-etf` D1 database via `wrangler d1 execute --remote --json` (a single `SELECT * FROM entity_merge_exceptions ORDER BY decided_at DESC` or similar — read-only, no writes, negligible against the 5M-reads/day cap).
- Generates a **self-contained HTML file** with the row data serialized directly into an inline `<script>` block as a plain JS array/object (e.g. `const EXCEPTIONS = [ {...}, {...} ];`) — not fetched, not loaded from a separate JSON file, baked directly into the page at generation time.
- Renders the same columns the Founder already knows from `admin-exceptions.html`'s table view: entities (A ↔ B), LEI, decision, reason, corporate action note, decided by / decided at.
- Displays a clear "Snapshot generated at `<timestamp>`" line near the top, so the Founder always knows how current it is at a glance.
- Has **no** API URL field, **no** secret field, **no** add/edit form, and makes **no** network request of any kind — confirm this explicitly during verification (see below), not just by omission from the code.
- Outputs the HTML file somewhere the Founder can find and re-open easily (same convention as `index.html` — ask/confirm the exact path if not obvious from existing local-script output conventions; do not guess a location buried in a build directory).
- Is trivially re-runnable on demand — a single command regenerates a fresh snapshot with current data. No install/uninstall/LaunchAgent control surface is needed for this packet (that's a possible future enhancement, not required now).

### 2. Explicitly out of scope for this packet

- Any add/edit/write mechanism — the Founder has deferred that decision. Do not build a "generate SQL" helper, a form, or a live-write path as part of this packet, even if it seems like an easy add.
- Any change to `meridian-entities-api`, its routes, or `ADMIN_EXCEPTIONS_SECRET`.
- Any change to `admin-exceptions.html` itself (leave it as-is; whether to retire it is a separate Founder decision, not this packet's call).
- Any new Worker, cron, or KV namespace.

### 3. Safety

This is a read-only local script hitting D1 via `wrangler d1 execute --remote`, not a Worker — the three-point pre-deployment check (index audit / read test / write budget) does not apply in its usual cron-adjacent form, but do confirm the query is a simple indexed/full-table SELECT against a small table (this table has at most a handful of rows) so there's no ambiguity about read cost.

## Verification

- Run the script once against real live D1. Confirm the row count and content in the generated HTML exactly match a direct `wrangler d1 execute --remote` `SELECT COUNT(*)` / spot-check against the same table.
- Open the resulting HTML file directly via double-click (`file://`, the same way `index.html` is opened) and confirm it renders correctly.
- With the browser's dev tools Network tab open, confirm **zero** network requests fire when the page loads — this is the actual point of the packet, so don't skip this check.

## Close-out

Update `sprintboarditems` (D1) for MA-SEP-012c directly, same pattern as prior packets. Report back to the Control master-lane session with: the exact script name/location and how to re-run it, the file path of the generated snapshot HTML, the row count confirmed against live D1, and confirmation of the zero-network-requests check — so the Sprint Board can be reconciled and Known Issue 22.23 can be updated with the actual outcome.

---
*Drafted 2026-08-31 in the Control master-lane (Cowork) session, from the Founder-approved design (view-only-for-now), for execution in a separate dedicated swim-lane per this project's session discipline.*
