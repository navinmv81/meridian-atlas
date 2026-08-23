# Build Brief

## Ticket
- ID: MA-SEP-004
- Title: Corporate Atlas Parent-Child Hierarchy View
- Stage: APPROVED — Founder approved 2026-08-22. ENG_IMPLEMENT opens once a dedicated swim-lane session starts (spec is grounded against real, already-deployed code — this is a build, not a diagnostic, but First Steps 1-4 below must be confirmed before writing UI code)

## Full spec
See `claude/MA-SEP-004_Spec.md` for the complete spec, including the Goals/Non-Goals, all Requirements with acceptance criteria, and Open Questions. This brief summarizes the actionable scope; the spec is the source of truth if anything here seems to conflict.

## First steps — confirm before building anything (do these first, in order)

1. Confirm real fan-out counts for a handful of high-connectivity entities (e.g. search for BlackRock, Vanguard, State Street, iShares in `entity_master` and count their `fund_manager` children via `entity_relationships`) — this sets the per-group display cap in Requirement 3. Do not guess at a cap number before this.
2. Confirm how many `legal_parent`-type rows exist in `entity_relationships` at all today, and pull 2-3 real examples with actual subsidiary names — needed to sanity-check Requirement 2's "Subsidiaries" group against real data, not a hypothetical.
3. Read `firds-local-seed.mjs` (or check `entity_relationships` directly) to confirm whether MA-SEP-003's EU fund ingestion writes any relationship edges at all. Document the answer either way — this determines whether Requirement 5's spot-check should expect populated or empty EU fund hierarchy data.
4. Confirm whether `entities-api.js`'s `ORDER BY` addition (Requirement 4) needs a fresh `/change-request` or not, against CLAUDE.md's exact trigger conditions (branch/folder/schema/environment change) — a query-logic change to an existing endpoint is very likely not one of those, but confirm rather than assume, and note the answer in this brief's Required Outputs.

## Approved scope

- **Ownership Chain panel** (`App/ma-entities.js`, `_ownershipRow` helper and its call sites ~line 795-810): make "Direct parent" and "Ultimate parent" rows clickable via the existing `_loadEntity`/breadcrumb pattern, when the parent resolves to a known `entity_id`. Leave as plain text when it doesn't (e.g. GLEIF exception cases with a name but no entity match).
- **New "Children" section** on the entity detail page, sourced from `/api/entities/:id/graph`'s existing (already-deployed) `children` array. Two labeled subsections: **Subsidiaries** (`relationship_type = 'legal_parent'`) and **Managed Funds** (`relationship_type = 'fund_manager'`). Each row clickable, same navigation mechanism. Section hidden entirely if zero children.
- **Fan-out cap** per group (informed by First Step 1 above), with an accurate "+N more" indication when a group's true count exceeds the cap — no silent truncation.
- **`entities-api.js`'s `/api/entities/:id/graph` children query**: add `ORDER BY` — `em.name` ascending for `legal_parent` children, and a confirmed-meaningful existing `entity_master` column (e.g. `etf_holding_count` or `isin_match_count`) descending for `fund_manager` children. Requires a `meridian-entities-api` redeploy.
- **EU fund entity spot-check** (Requirement 5): confirm at least one real MA-SEP-003 EU fund entity behaves correctly (or document the gap per First Step 3) in the built UI.

## Architecture constraints

- Vanilla JS only, no frameworks/bundler — extend `ma-entities.js`'s existing patterns (DOM string templates, existing helper functions), don't introduce a new rendering approach.
- Domain boundaries: `ma-entities.js` stays independent of other domain JS files — no new cross-file imports.
- This is an Entities-domain packet touching Entities-domain tables (read-only) and `ma-entities.js` (Entities-domain UI) — no ETF-domain table is read or written.
- Zero new D1 writes. Zero new schema. Zero new Cloudflare Cron Trigger usage.
- `entities-api.js`'s query change: existing index (`idx_entity_rel_parent`/`idx_entity_rel_child`) already covers this — no new index. Run the three-point check anyway per CLAUDE.md's rule that any changed query gets one, and document the real read count from a live invocation.
- LOCAL_MASTER is `Meridian Atlas Clean (v11)` (branch `august-sprint-clean-v11`) per MA-SEP-000. Entities-domain Worker source lives in `App/Corporate Atlas/`; frontend files are flat in `App/`.
- **This packet must run from local Claude Code, not this Cowork cloud session** — same standing constraint as MA-SEP-001/003 (no Cloudflare API access / no `wrangler` from this sandbox, and Open Questions 1-2 above need live D1 reads).

## UX constraints

- Match existing visual language exactly: `_ownershipRow` styling, `var(--bg3)`/`var(--border)`/`var(--r)` panel treatment, the existing 9px uppercase section-label convention already used elsewhere on this page. This is not a redesign.
- Clickable rows need the same hover/interactive affordance already used for galaxy nodes elsewhere in `ma-entities.js` — reuse, don't invent a new visual pattern.
- UX Lead review requested on the two-group Children layout and the "+N more" treatment before finalizing — flag for a checkpoint rather than shipping without that review, given this packet's explicit Entities Product Lead + UX Lead co-ownership.
- Galaxy SVG extension to show children (Spec's P1 Nice-to-Have #1) is explicitly optional — do not let it expand scope past the P0 panel-based approach without flagging back for sign-off first.

## Touched assets

- `App/ma-entities.js` (Ownership Chain panel, new Children section, any new small CSS/DOM helpers)
- `App/Corporate Atlas/src/entities-api.js` (`handleGraph`'s children query — add `ORDER BY` only, no shape change to the response otherwise)
- Read-only: `entity_master`, `entity_relationships` (both Entities-domain, already indexed)

## Do not do

- No recursive/multi-level graph traversal (Non-Goal — v1 is one level + the precomputed `ultimate_parent_*` shortcut, click-through for anything deeper).
- No changes to `entities-seed.js` / `entities-enrich.js` / `entities-delta.js` — how relationships get written is out of scope.
- No changes to the galaxy SVG's south arc (holdings/holders) — different data source, not this packet's concern.
- No new relationship types, no attempt to populate `umbrella_fund`/`peer`.
- No new external dependency or graph-visualization library — vanilla JS, extend existing patterns only.
- No scope expansion into MA-SEP-005/006/007 even if it feels adjacent.

## Required outputs

- Answers to First Steps 1-4 above, documented with real numbers/findings (not asserted).
- Touched files (frontend + `entities-api.js`).
- Before/after screenshots or described behavior for: a clickable ownership-chain entity, an entity with populated Subsidiaries, an entity with populated Managed Funds (ideally a high-fan-out one showing the cap + "+N more" working), and the MA-SEP-003 EU fund spot-check.
- Three-point check documentation for the `entities-api.js` query change (index audit, real read count under 50k, budget note).
- `meridian-entities-api` redeploy confirmation (version/deploy detail, same as prior packets' Release Ledger entries).
- Any real gap found in Open Question 3 (EU fund relationship-writing) — flagged clearly, not silently worked around.
- Release implications for the Release Ledger: Worker redeploy detail for `meridian-entities-api`; confirm no other Worker touched.

---
*Drafted 2026-08-22 in the Control master-lane session, grounded directly against the live repo (schema, existing API endpoint, existing frontend rendering code — see Spec's "Code Grounding" section) rather than assumed from the Scope Document alone. Handed to a dedicated local Claude Code session for execution, per the same pattern as MA-SEP-001 and MA-SEP-003.*
