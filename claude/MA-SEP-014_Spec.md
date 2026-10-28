# MA-SEP-014 — FIRDS Entity Discoverability & Directory-Tier Labeling (Spec)

**Lane:** Data/Identity + Application | **Owner role:** Entities Product Lead | **Stage:** DRAFT — awaiting Founder approval, not yet a Build Brief, not yet a swim-lane
**Drafted:** 2026-09-02, Control master-lane (Cowork) session, from live code reading (`src/firds.js`, `src/entities-enrich.js`, `src/entities-api.js`, `ma-entities.js`, `ma-search.js`) — not assumed from the original MA-SEP-003 Spec alone.
**Fixes:** Known Issue 22.24 (FIRDS-created entities permanently display their raw LEI as `name`) and Known Issue 22.25 (no product surface anywhere distinguishes or surfaces FIRDS-sourced "directory-tier" entities, and 22.24 makes them unsearchable by name today).
**Sequencing:** **Do not open a Build Brief or swim-lane for this packet until the Founder explicitly says so.** This Spec exists so the fix is scoped and ready — it is deliberately not competing with the Founder's current MA-SEP-007/FIRDS/MA-SEP-009+ test pass, which per Session Discipline takes priority (test → MA-SEP-013 deploy → close sprint).

---

## Problem Statement

MA-SEP-003 shipped FIRDS ingestion to make EU-domiciled funds/ETFs identifiable in Meridian's entity graph where they previously had zero presence at all — that goal is genuinely met in D1. But live MA-SEP-007 testing (2026-09-02) surfaced that this benefit is not actually reachable by an operations user today, for two compounding, root-caused reasons:

1. **Known Issue 22.24:** When FIRDS resolves an LEI that isn't already in `entity_master`, `src/firds.js`'s `resolveEntitiesForLeis()` creates the row using the raw LEI string as a placeholder `name` (a documented, deliberate 2026-08-20/21 design decision). Nothing downstream ever replaces it — `entities-enrich.js`'s Phase 3 enrichment runs against these same rows and already fetches the real GLEIF legal name in the process, but only writes `lei_status`/`country`/parent-LEI fields from that response, never `name`. The placeholder is permanent as the code stands today.
2. **Known Issue 22.25:** `entities-api.js`'s `/api/entities/search` route matches only `entity_master.name` / `normalized_name`. Combined with (1), any FIRDS-discovered fund whose name is still its raw LEI cannot be found by searching its real name — the one general-purpose front door that could have surfaced it for free doesn't. Separately, no frontend file (`ma-entities.js`, `ma-search.js`, or any other) renders any "FIRDS directory-tier, as of {date}" label anywhere, even though `MA-SEP-003_Spec.md`'s own Non-Goals section explicitly named this as future entity-detail rendering's job. It was never built by any packet, including MA-SEP-004 (which shipped Ownership Chain/Children rendering but not this).

Net effect: the FIRDS investment (a full month of build work, three architecture revisions, two OS-level escalations) currently produces zero end-user-visible benefit for at least a subset of what it ingests — visible to the Founder as "I can't see where this benefits our product" and "I don't see anything on the UI." Both concerns are correct and root-caused, not a misunderstanding.

## Goals

1. A FIRDS-created entity's `name` gets hydrated to its real GLEIF legal name automatically, using data the pipeline already fetches — no new external call, no new pipeline.
2. Once hydrated, these entities become findable through the existing `/api/entities/search` route by their real name, same as any other entity — no search-logic change needed, this falls out of Goal 1.
3. An operations user looking at a FIRDS-sourced entity's detail view can tell that's what it is and how current the data is — a small, factual "Directory-tier (ESMA FIRDS), as of {date}" indicator, exactly as the original MA-SEP-003 Spec intended but never shipped.
4. Provide a real, repeatable test an operations user can run themselves to confirm FIRDS's value going forward (see Verification) — not just a D1 row count.

## Non-Goals

- **No relationship-edge changes.** FIRDS confirmed (MA-SEP-004's diagnostic) to write zero relationship edges — that stays true. A found-and-labeled FIRDS entity still renders as an isolated node (no ETF holdings, no ownership chain, no fund-manager link) unless a future, separate packet builds that linkage. Out of scope here.
- **No EU fund holdings depth.** Still the standing Non-Goal from MA-SEP-003 — this packet only makes existing directory-tier identity data visible and findable, it does not add holdings.
- **No new D1 table, no schema change.** `name` already exists on `entity_master`; the "as of {date}" label reads `firds_instrument_reference.publication_date` (or `entity_master`'s own `gleif_last_updated`/`updated_at`, whichever the build session confirms is the more accurate source — see Open Question 1) via a join, not a new column.
- **No retroactive backfill batch job.** The Phase 3 fix (Goal 1) is a code change to an already-scheduled, already-running enrichment path — it naturally sweeps up every existing name-equals-LEI row over Phase 3's normal cadence (same self-healing shape as Known Issue 22.10's fix via MA-SEP-009), not a one-time bulk UPDATE. If the Founder wants the existing backlog hydrated faster than organic Phase 3 cadence allows, that's a separate, explicit decision — flagged as Open Question 2, not assumed.
- **No changes to non-FIRDS entities' search or display behavior.** The label only ever appears where a row's data actually indicates FIRDS/directory-tier origin.

## Scope

### 1. Fix the name-placeholder gap (Known Issue 22.24)

In `entities-enrich.js`'s `runPhase3()`, inside the existing GLEIF self-detail branch (the one that already writes `lei_status`/`country`), add a `name` write to the same `UPDATE entity_master ... WHERE entity_id = ?` — sourced from the same already-fetched response (`attrs.entity?.legalName?.name`, the identical field already read for parent-name resolution elsewhere in this file). Gate it so it only overwrites `name` when the row's current `name` equals its own `lei` (i.e., only touches genuinely-placeholder rows) — never overwrite a real, already-correct name. No new fetch, no new subrequest, no change to Phase 3's existing subrequest-checkpoint logic.

### 2. Search discoverability (Known Issue 22.25, part 1)

No code change expected here — Goal 1's fix should make these entities searchable through the existing `/api/entities/search` route automatically, since it already matches on `name`. Verification (below) proves this rather than assumes it; if for some reason it doesn't fall out cleanly (e.g. `normalized_name` needs a matching backfill), that becomes a small addendum to Scope Item 1, not a new mechanism.

### 3. Directory-tier UI label (Known Issue 22.25, part 2)

Add a small, factual indicator to the entity detail view (`ma-entities.js`) for entities sourced from FIRDS — "Directory-tier (ESMA FIRDS), as of {date}." Exact detection rule and date source to be confirmed against live schema during build (see Open Question 1) — likely either a join to `firds_instrument_reference` via `entity_isin_map`, or a boolean/source marker already implicit in how these rows were created. State the actual mechanism chosen in the close-out report rather than assuming this exact join shape is final. Placement: near the existing entity-type/LEI header area, not a new section — small and factual, not a new UI surface in its own right.

### 4. Explicitly out of scope for this packet

- Relationship-edge creation of any kind.
- Any holdings-depth work.
- Any change to `firds-local-seed.mjs`'s own weekly ingestion logic beyond what Scope Item 1 requires in the shared `entities-enrich.js` file.
- Retroactive bulk backfill (see Non-Goals) unless the Founder explicitly asks for it as an addendum.

## Safety

This is a small, low-risk change to an already-live, already-scheduled Worker (`meridian-entities-enrich`) and its existing UI companion (`ma-entities.js`) — not a new Worker, cron, or table. Three-point check applies narrowly:

1. **Index audit:** no new query shape — the `UPDATE ... WHERE entity_id = ?` already exists; adding one field to its `SET` clause changes no index usage. The UI label's join (once its shape is confirmed) should use the same `entity_isin_map`/`firds_instrument_reference` indexes already in place from MA-SEP-003.
2. **Read/write budget:** zero new subrequests (uses the response Phase 3 already fetches), zero new D1 writes beyond the field already being written per row (same row, same `UPDATE`).
3. **Documented budget:** confirm in the close-out that Phase 3's real observed subrequest count and D1 write count per invocation are unchanged from before this fix — a one-line before/after comparison is sufficient given the change's shape.

## Verification

- Confirm the fix by re-running against one or more of the three known-affected rows (`entity_id` 210102, 210982, 211328) via a real Phase 3 invocation (or the narrowest safe equivalent this project's testing conventions already use for this Worker) — `name` should update to the real GLEIF legal name, `lei` unchanged, no other row touched.
- **The concrete, Founder-facing test:** after the fix, search the live Corporate Atlas UI for the real fund name (e.g. "UBS" or "iShares") and confirm the previously-invisible entity now appears — this is the direct, reproducible demonstration of both the original defect and the fix, not just a D1 read.
- Confirm the new UI label renders correctly on a real FIRDS-sourced entity's detail view, and does **not** render on a non-FIRDS entity (e.g. a US GLEIF-sourced or N-PORT-derived entity) — a false positive here would be worse than no label at all.
- Confirm Phase 3's real subrequest/write counts are unchanged from a pre-fix baseline run, per Safety item 3.

## Open Questions

1. **(Entities Product Lead, build-time)** Exact source/join for the "as of {date}" timestamp and the FIRDS-origin detection rule — `firds_instrument_reference.publication_date` via `entity_isin_map`, or something already simpler on `entity_master` itself. Confirm against live schema during build; state the actual choice in the close-out rather than assuming this Spec's guess is final.
2. **(Founder, non-blocking)** Whether the existing backlog of name-equals-LEI rows should be hydrated faster than organic Phase 3 cadence (a one-time backfill pass), or left to resolve naturally as Phase 3 processes its normal queue. Not required for this packet's acceptance criteria either way — flagged for an explicit answer, not assumed.

## Timeline

No hard deadline. Per Session Discipline, this packet's own swim-lane does not open until the Founder explicitly approves proceeding — current priority remains the in-progress MA-SEP-007/FIRDS/MA-SEP-009+ test pass and MA-SEP-013 go-live.

---
*Drafted 2026-09-02 in the Control master-lane (Cowork) session, from the Founder's own live-testing finding and this session's direct code read — not yet approved, not yet a Build Brief.*
