# MA-SEP-012d — One-Click Refresh for the Entity Merge Exceptions Snapshot

**Lane:** Data/Identity | **Owner role:** Entities Product Lead | **Stage:** APPROVED — ready to execute
**Depends on:** MA-SEP-012c (CLOSED, 2026-08-31) — see `claude/MA-SEP-012c_Build_Brief.md` for the export script and snapshot page this packet wraps. Do not redesign or rewrite that script; this packet only makes it easier to re-run.
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session and its linked-device bridge both lack live Cloudflare/D1 access, and per this project's session discipline, build/fix work does not execute inside the Control master-lane.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-012d.`

---

## Context

MA-SEP-012c built `export-exceptions-snapshot.mjs`, a local script that generates a self-contained, zero-network HTML snapshot of `entity_merge_exceptions`. It works exactly as designed, but on seeing the finished page the Founder pointed out a real gap: a snapshot that's only current when someone remembers to open a terminal, `cd` into the right folder, and type `node export-exceptions-snapshot.mjs` isn't actually usable for day-to-day operational decisions.

Separately, MA-SEP-012c's own verification turned up a useful fact: serving the snapshot file over a local static server (rather than opening it via `file://`) worked cleanly — one request, no errors. That's real evidence the original `admin-exceptions.html` "Failed to fetch" problem (Known Issue 22.23) was specifically a `file://`-origin restriction, not CORS, the API, or the secret.

**Three options were put to the Founder for how the snapshot should stay current — he chose the first:**
1. **One-click manual refresh** (chosen) — a double-clickable script regenerates the snapshot and opens the fresh page in one action. Still zero live network calls at view time; the Founder clicks it when he wants current data.
2. Scheduled auto-refresh via a LaunchAgent (not chosen — deferred, could revisit later if manual refresh still feels like too much friction in practice).
3. Go properly live over `http://` instead of `file://` (not chosen — deferred; the `file://` theory is credible but unconfirmed, and this would reintroduce secret handling).

**Build only option 1.** Do not build the LaunchAgent or live-fetch variants — they're documented above so the next person doesn't have to rediscover the options, not because this packet should build all three.

## Scope

### 1. A one-click refresh mechanism

Build a double-clickable entry point (a macOS `.command` file is the simplest fit — plain executable shell script with a `.command` extension, runs in Terminal when double-clicked, no code-signing/packaging needed; use whatever this repo's existing local-script conventions already favor if there's a closer precedent) that, in one action:

1. Runs `export-exceptions-snapshot.mjs` from `App/Corporate Atlas/` (same script MA-SEP-012c built — do not duplicate its logic).
2. On success, opens the freshly generated `entity-exceptions-snapshot.html` in the Founder's default browser (`open <path>` on macOS).
3. On failure (e.g. `wrangler` not authenticated, network issue), fails visibly — a clear error message in the Terminal window, not a silent no-op — and does **not** open a stale or missing file.

Name and place it so it's easy to find without hunting — e.g. `App/Corporate Atlas/refresh-exceptions-snapshot.command`, right next to the export script. State your actual naming/placement choice in the close-out report rather than assuming this exact name is final.

### 2. Explicitly out of scope

- No LaunchAgent, no scheduled execution — that's option 2, not chosen.
- No change to bring back live fetch/secret-based access — that's option 3, not chosen.
- No changes to `export-exceptions-snapshot.mjs`'s own logic beyond what's needed to be safely callable from the new entry point (e.g. don't change its D1 query, its zero-network-request property, or its output format).
- No add/edit capability — still out of scope, per MA-SEP-012c's original deferral.

### 3. Safety

Same shape as MA-SEP-012c: this wraps an existing read-only D1 script, no new write path, no Worker/cron change. No three-point check needed beyond confirming the wrapper itself doesn't introduce a new write path (it shouldn't).

## Verification

- Double-click the new entry point for real (or the closest equivalent this sandbox/session can exercise — if double-click itself can't be simulated, run the underlying command exactly as double-click would invoke it and confirm the browser opens with fresh data).
- Confirm the opened page reflects current D1 data, not a stale cached copy — e.g. by checking the "Snapshot generated at" timestamp matches the just-completed run.
- Confirm a deliberate failure case (e.g. temporarily break the `wrangler` call, or simulate one) produces a visible error rather than silently opening a stale file — then restore and confirm the happy path still works.

## Close-out

Update `sprintboarditems` (D1) for MA-SEP-012d directly. Report back to the Control master-lane session with: the exact entry point's name/location and how the Founder should use it day-to-day (what to double-click, from where), confirmation the happy-path and failure-case checks both passed, and the commit hash.

---
*Drafted 2026-08-31 in the Control master-lane (Cowork) session, from the Founder-approved refresh-model decision (one-click manual refresh), for execution in a separate dedicated swim-lane per this project's session discipline.*
