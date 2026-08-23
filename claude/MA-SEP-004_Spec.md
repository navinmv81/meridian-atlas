# MA-SEP-004 — Corporate Atlas Parent-Child Hierarchy View (Spec)

**Lane:** Application (`ma-entities.js`) + Data/Identity | **Owner role:** Entities Product Lead + UX Lead | **Stage:** APPROVED — Founder approved 2026-08-22, ready to open in a dedicated swim-lane session
**Drafted:** 2026-08-22, Control master-lane session, grounded directly against the live repo (not assumed) — see "Code Grounding" below
**Dependencies:** MA-SEP-001 (entity dedup) — CLOSED 2026-08-16. MA-SEP-003 (ESMA FIRDS) — CLOSED 2026-08-22, 18,384 EU fund/ETF instruments now in the graph. Both satisfied; this packet is unblocked.

## Code Grounding (read this first — this is a smaller, lower-risk packet than it looks, because most of the backend already exists)

Verified directly against the live repo this session, not assumed:

- **`entity_relationships` already exists** (`App/Corporate Atlas/migrations/corporate-atlas-v1.sql`): `parent_entity_id`, `child_entity_id`, `relationship_type` (CHECK IN `legal_parent`, `fund_manager`, `umbrella_fund`, `peer`), `source` (CHECK IN `gleif`, `etf_universe`, `manual`), PK on (parent, child, type), indexed both directions (`idx_entity_rel_parent`, `idx_entity_rel_child`). **Only `legal_parent`** (source `gleif`, written by `entities-enrich.js`/`entities-delta.js`) **and `fund_manager`** (source `etf_universe`, written by `entities-seed.js`) **are ever actually inserted anywhere in the codebase** — `umbrella_fund` and `peer` are schema-reserved, zero rows, out of scope here.
- **`entity_master` already carries a precomputed shortcut for the top of the chain**: `direct_parent_name`/`direct_parent_lei`/`direct_parent_exception` and `ultimate_parent_name`/`ultimate_parent_lei`/`ultimate_parent_exception`, kept in sync as a mirror every time `entities-enrich.js`/`entities-delta.js` write a new `entity_relationships` row (actual code comment: "Mirror onto entity_master so the UI can read it directly"). This means "ultimate parent" needs no recursive graph walk — it's already a flat lookup.
- **The backend endpoint this packet needs already exists and is already deployed.** `GET /api/entities/:id/graph` (`meridian-entities-api`, `App/Corporate Atlas/src/entities-api.js`) already queries and returns both `parents` (no LIMIT, all relationship types) and `children` (same join reversed, `LIMIT 20`, no `ORDER BY`) for any entity, joined to `entity_master` for name/type/lei/country. **This is not something to build — it's something to finally render.**
- **The gap is entirely on the frontend.** `App/ma-entities.js` (~1,550 lines) already consumes this endpoint's `parents` field to draw up to 3 "north" nodes in an existing SVG "galaxy" visualization (`_buildSvgContent` — color-codes `legal_parent` solid blue vs `fund_manager` dashed orange). **`children` is fetched by the API today and rendered nowhere.** Separately, the entity detail page's "Ownership Chain" panel (~line 795) shows `direct_parent_name`/`lei` and `ultimate_parent_name`/`lei` as flat, non-interactive text (`_ownershipRow` helper) — not clickable, no tree, no children.
- **Click-to-navigate already exists and is proven.** Clicking a galaxy node calls `_loadEntity(entityId)`, which pushes onto a `_breadcrumb` array and re-renders (`_renderBreadcrumb`, `entBcNavigate`). This is the mechanism to reuse for hierarchy navigation — not a new pattern to invent.
- **Fan-out is a real, unaddressed risk in the existing endpoint.** A `fund_manager`-type children query for a large asset manager could plausibly return hundreds of managed funds; the existing `LIMIT 20` with no `ORDER BY` returns an arbitrary 20, not a meaningful top 20. `legal_parent` children (actual subsidiaries) are almost certainly much lower-fanout by comparison, but this is not yet confirmed against real data (see Open Questions).

## Problem Statement

Meridian Atlas already computes and stores real corporate-ownership and fund-management relationships for every entity — the data exists, is indexed, and is already served by a working API endpoint. But the entity detail page shows only two flat text rows ("Direct parent," "Ultimate parent") with no way to click through to them, and shows nothing at all about what an entity owns or manages. A user looking at BlackRock, Inc. today cannot see that it manages hundreds of iShares funds; a user looking at an iShares fund can see its manager's name as text but can't click through to it. This is a rendering gap on top of working data, not a missing-data problem.

## Goals

1. Any entity with a known direct or ultimate parent shows that relationship as a clickable element that navigates to the parent entity, reusing the existing `_loadEntity`/breadcrumb mechanism — not new plain text.
2. Any entity with known children (owned subsidiaries via `legal_parent`, or managed funds via `fund_manager`) shows them, grouped by relationship type, each clickable to navigate to that child.
3. EU fund/ETF entities from MA-SEP-003 slot into this view exactly like any other entity, with no EU-specific code path — confirmed, not assumed (see Open Question 3).
4. High fan-out (a manager with hundreds of funds) degrades gracefully — a capped, meaningfully-ordered list with a clear "N more" affordance, never an unbounded render or a silent arbitrary-20 truncation.
5. Zero new D1 writes, zero new Cloudflare Cron Trigger usage, zero schema changes unless Open Question 1 forces one (flagged, not assumed).

## Non-Goals

- **Recursive / unbounded ancestor-or-descendant graph traversal.** V1 shows one level of parents (already effectively unlimited via the existing query) and one level of children (capped), plus the precomputed `ultimate_parent_*` shortcut for the top of the chain. Grandchildren/great-grandparents are reached by clicking through, one hop at a time, using navigation that already exists — not eagerly rendered. A full recursive tree is a plausible future packet if this proves insufficient, not this one.
- **New relationship types.** `umbrella_fund` and `peer` stay unused. Nothing here changes what gets written to `entity_relationships` — this packet is a consumer of that table, not a producer.
- **Changes to `entities-seed.js` / `entities-enrich.js` / `entities-delta.js`.** How relationships get created is entirely out of scope. If Open Question 3 finds a real gap in FIRDS's relationship-writing, that becomes its own scoped fast-follow, not silently absorbed into this packet.
- **Changes to the galaxy SVG's south arc (holdings/holders).** That's exposure-data-driven (`entity_exposure_monthly`), a different data source and a different concern from relationship-based children. Not touched.
- **A general-purpose org-chart / graph-visualization library.** This stays vanilla JS per project rules, extending the existing SVG/DOM patterns already in `ma-entities.js` — no new dependency.

## Requirements

### Must-Have (P0)

1. **Ownership Chain panel becomes clickable.** The existing "Direct parent" / "Ultimate parent" rows (`_ownershipRow` helper, ~line 795-810) navigate to that entity via the existing `_loadEntity` pattern when a resolvable `*_lei`/entity match exists, instead of rendering inert text. If a parent name exists but doesn't resolve to a known `entity_id` (e.g. an unenriched GLEIF exception), it stays plain text — do not invent a fake link.
   - *Acceptance:* clicking "Direct parent" or "Ultimate parent" on an entity with a resolvable parent navigates to that entity's detail view and updates the breadcrumb, identically to clicking a galaxy node today.
2. **New "Children" section on the entity detail page**, populated from the existing `/api/entities/:id/graph` endpoint's already-returned `children` array, grouped into two labeled subsections: **Subsidiaries** (`relationship_type = 'legal_parent'`) and **Managed Funds** (`relationship_type = 'fund_manager'`). Each row is clickable via the same navigation mechanism as Requirement 1. Empty state: section is hidden entirely if an entity has zero children (no empty box, no "None" placeholder clutter).
   - *Acceptance:* an entity known to have subsidiaries and/or managed funds (confirm real examples during the build session, see Open Question 2) shows both groups correctly populated and independently clickable; an entity with neither shows no Children section at all.
3. **Fan-out handling.** Each of the two child groups (Subsidiaries, Managed Funds) is independently capped at a small, clearly-labeled number (recommend starting at 10-15 per group, pending Open Question 2's real counts) with a "+N more" affordance if the group's true count exceeds the cap — the exact interaction for "+N more" (expand in place vs. a simple count with no expansion in v1) is a build-session UX call, not specified rigidly here, but a raw, unlabeled overflow is not acceptable.
   - *Acceptance:* an entity with a large managed-funds count (e.g. a major asset manager, confirmed during build) shows a capped, ordered list plus an accurate "+N more" count, not a silent truncation and not an unbounded render.
4. **`/graph` endpoint's children query gains an `ORDER BY`**, so the existing `LIMIT 20` returns a meaningful top 20 rather than arbitrary rows. Recommend ordering by `em.name` for `legal_parent` children (alphabetical, since there's no obvious "importance" signal for subsidiaries) and by an existing importance signal already on `entity_master` (e.g. `etf_holding_count` or `isin_match_count`, whichever the build session confirms is populated and meaningful for fund-type entities) descending for `fund_manager` children. This is a query-shape change to an existing, already-indexed query — no new index, no new table, no full scan — but per CLAUDE.md's rule on any changed query, run the three-point check and document the real read count from a live invocation before calling this done.
   - *Acceptance:* three-point check documented in the Build Brief's Required Outputs; a real invocation's read count confirmed under 50k rows (near-certain given the existing `LIMIT 20`, but confirm rather than assume).
5. **EU fund entities from MA-SEP-003 render identically to any other entity** in both the Ownership Chain panel and the new Children section — no EU-specific branch anywhere in this packet's code. If Open Question 3 finds FIRDS-sourced entities don't yet have `entity_relationships` rows at all, that's a real, separately-scoped gap to flag back to the Founder — not something this packet's UI code should special-case around.
   - *Acceptance:* at least one real EU fund entity (from the 18,384 landed by MA-SEP-003) is spot-checked in the built UI during the build session and behaves exactly like a comparable US entity, or the gap is clearly documented if it doesn't.

### Nice-to-Have (P1)

1. Extend the galaxy SVG to show children as a new visual arc (distinct from the existing south arc, which stays holdings/holders-only per Non-Goals) — genuinely nice for a handful of entities but meaningfully more layout work than the panel-based approach in P0, and not required to satisfy the packet's done-condition ("any entity with known parent/child relationships shows a working hierarchy view" is satisfied by the P0 panel alone). Defer to a build-session judgment call on remaining time/complexity, with explicit Founder sign-off before adding new SVG layout logic — do not let this quietly become the main event.
2. A small "relationship source" indicator (gleif vs etf_universe) next to each row, for anyone auditing data provenance — cheap to add given `source` is already in the query result, purely additive.

### Future Considerations (P2)

1. Full recursive ancestor/descendant tree rendering, if click-through navigation proves insufficient once real usage shows people wanting multi-level views at a glance.
2. Surfacing `umbrella_fund`/`peer` relationships, if a future packet ever starts writing them.
3. A dedicated "corporate family" page distinct from the single-entity detail view, for exploring a large group (e.g. all of BlackRock's structure) without repeated click-throughs.

## UX Requirements

- Reuse existing visual language (`_ownershipRow`, existing panel styling: `var(--bg3)`, `var(--border)`, `var(--r)`, the existing 9px uppercase section-label style) — this is a rendering/interaction change on an established page, not a redesign.
- Clickable rows need a clear visual affordance that they're interactive (existing hover/cursor patterns already used elsewhere in `ma-entities.js` — match them, don't invent a new one).
- UX Lead review requested on the two-group Children layout and the "+N more" treatment before the build session finalizes it, per this packet's stated Entities Product Lead + UX Lead co-ownership.

## Read/Write Budget & Safety Reasoning

- **Zero new writes.** This packet only reads `entity_relationships` and `entity_master` via the existing endpoint (with the Requirement 4 `ORDER BY` addition). No D1 write path is touched.
- **Zero new Cloudflare Cron Trigger usage.** Nothing here runs on a schedule — it renders on page load, same as the rest of the entity detail page today.
- **Read cost:** the existing `/graph` endpoint's `parents` query (no LIMIT) is the only genuinely unbounded read in scope. It's already live in production for the existing galaxy view (capped client-side to 3 rendered nodes) — Requirement 4's `ORDER BY` addition only touches the already-`LIMIT 20` children query, not this one. Confirm during the build session that no entity's raw `parents` count is large enough to matter (a `legal_parent`/`fund_manager` parent set should be small by construction — an entity typically has one direct parent and one manager, and the "no LIMIT" only accounts for occasional multiple-source or multiple-type situations) — flagged in Open Questions rather than assumed safe.
- **Three-point check** applies specifically to Requirement 4's `ORDER BY` change per CLAUDE.md's rule that any changed query needs it, even though the underlying index and LIMIT are unchanged.

## Open Questions

1. **(Engineering — blocking)** Does adding `ORDER BY em.name` (or an importance column) to the existing children query in `entities-api.js` require re-deploying `meridian-entities-api`? Almost certainly yes (it's a code change to a live Worker) — confirm the deploy mechanism and whether this needs its own `/change-request` (it's a query-logic change to an existing endpoint, not a schema/environment/branch change, so likely no — but confirm against CLAUDE.md's exact trigger conditions before assuming).
2. **(Engineering — blocking, needs a live D1 read the Cowork sandbox cannot perform)** Real fan-out counts for a few known high-connectivity entities (e.g. a major asset manager like BlackRock/Vanguard/State Street/iShares, if present in `entity_master`) — needed to pick a sensible per-group cap (Requirement 3) instead of guessing at "10-15." Also confirm real examples of entities with `legal_parent` children (actual subsidiaries) exist in the current data at all, versus the relationship type being present in schema but sparsely populated — the spec's grounding confirmed `legal_parent` rows are written by `entities-enrich.js`/`entities-delta.js`, but not how many exist today. **First step of the build session, before any UI code.**
3. **(Engineering — blocking)** Does `firds-local-seed.mjs` (MA-SEP-003's ingestion script) write anything to `entity_relationships` for EU fund entities (e.g. a `fund_manager` edge to the EU fund's management company), or does it only populate `entity_isin_map`/`instrument_master`/`entity_master` without any relationship edge? If the latter, EU funds will correctly show *no* Children/Ownership Chain data (not broken, just empty) — but this should be confirmed and documented, not discovered as a surprise during Requirement 5's spot-check.
4. **(UX — non-blocking)** Exact interaction for "+N more" in a capped group — inline expand, a "view all" link to somewhere, or just an accurate count with no further action in v1. Recommend the simplest (accurate count, no expansion) for v1 per this packet's modest scope, but UX Lead's call.
5. **(Founder — non-blocking)** Whether `umbrella_fund`/`peer` being schema-reserved-but-empty is worth a one-line note anywhere in the UI ("relationship types not yet tracked") or is simply a non-issue until something ever writes them. Recommend: non-issue, no UI treatment needed for an empty case.

## Timeline Considerations

- No hard external deadline. Both dependencies (MA-SEP-001, MA-SEP-003) are closed and this packet is fully unblocked as of 2026-08-22 — per `Meridian_Atlas_September_Sprint_Plan.md`'s buffer, there's no schedule pressure.
- **Should run from local Claude Code, not this Cowork session, for the same standing reason as MA-SEP-001/003:** this cloud sandbox cannot reach the Cloudflare API to deploy `meridian-entities-api`'s `ORDER BY` change (Requirement 4) or verify live D1 fan-out counts (Open Question 2). Frontend-only changes to `ma-entities.js` could technically be made via the device bridge and a manual copy-to-deploy step, but since this packet also needs a live Worker redeploy and live D1 reads, running the whole packet from local Claude Code (as MA-SEP-001 and MA-SEP-003 did) is simpler and consistent with precedent.
- **This session's job ends at an approved spec + Build Brief** — execution hands off to a dedicated swim-lane session exactly like MA-SEP-001 and MA-SEP-003 did.
