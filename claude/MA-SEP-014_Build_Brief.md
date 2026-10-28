# MA-SEP-014 — FIRDS Entity Discoverability & Directory-Tier Labeling (Build Brief)

**Lane:** Data/Identity + Application | **Owner role:** Entities Product Lead | **Stage:** APPROVED — ready to execute
**Fixes:** Known Issue 22.24 (FIRDS-created entities permanently display their raw LEI as `name`) and Known Issue 22.25 (no product surface anywhere distinguishes or surfaces FIRDS-sourced "directory-tier" entities, and 22.24 makes them unsearchable by name today).
**Full requirements/rationale:** `claude/MA-SEP-014_Spec.md` — read that first for Goals/Non-Goals and the full root-cause writeup. This Build Brief is the execution instructions; do not re-derive scope from first principles if the two ever seem to disagree — flag the discrepancy rather than picking one silently.
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session and its linked-device bridge both lack live Cloudflare/D1 access, and per this project's session discipline, build/fix work does not execute inside the Control master-lane.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-014.`

---

## Context

Live MA-SEP-007 testing (2026-09-02) found `entity_master` rows created via FIRDS LEI resolution permanently display their raw LEI as `name` (Founder found 3 real cases: `entity_id` 210102, 210982, 211328 — a real UBS fund and a real iShares bond fund). Traced to `src/firds.js`'s `resolveEntitiesForLeis()`, which creates these rows with the LEI as a documented placeholder name — flagged in its own code comment as "not silently accepted," but nothing downstream ever fixes it. Separately, the Founder asked where FIRDS actually benefits the product, since nothing in the UI shows it — root-caused to two compounding facts: `entities-api.js`'s search route only matches `entity_master.name`/`normalized_name` (so a name-equals-LEI row is unsearchable by its real name), and no frontend file anywhere renders the "FIRDS directory-tier, as of {date}" label the original MA-SEP-003 Spec called for. Full detail and code citations: `claude/MA-SEP-014_Spec.md`.

## Scope

### 1. Fix the name-placeholder gap (Known Issue 22.24)

In `entities-enrich.js`'s `runPhase3()`, inside the existing GLEIF self-detail branch (the one that already writes `lei_status`/`country` from the fetched response), add `name` to the same `UPDATE entity_master ... WHERE entity_id = ?` — sourced from `attrs.entity?.legalName?.name` (the same field already read for parent-name resolution elsewhere in this file). **Gate this so it only overwrites `name` when the row's current `name` equals its own `lei`** — never touch a row with a real, already-correct name. No new fetch, no new subrequest.

### 2. Confirm search discoverability falls out for free (Known Issue 22.25, part 1)

No code change expected. After Scope Item 1 lands and a real Phase 3 run hydrates a previously-affected row, confirm `/api/entities/search` now returns it when searching the real fund name. If it doesn't fall out cleanly (e.g. `normalized_name` needs its own backfill on update), fix that as a small addendum to Item 1 — do not build a separate search mechanism.

### 3. Directory-tier UI label (Known Issue 22.25, part 2)

Add a small, factual indicator to the entity detail view (`ma-entities.js`) for entities sourced from FIRDS — "Directory-tier (ESMA FIRDS), as of {date}." Confirm the actual detection rule and date source against live schema before building (see Spec's Open Question 1 — likely a join to `firds_instrument_reference` via `entity_isin_map`, but verify rather than assume). Placement: near the existing entity-type/LEI header area, not a new section.

### 4. Explicitly out of scope

- Any relationship-edge creation (FIRDS stays confirmed at zero edges written).
- Any EU fund holdings-depth work.
- Any change to `firds-local-seed.mjs`'s own weekly ingestion logic beyond what Item 1 requires in the shared `entities-enrich.js` file.
- Retroactive bulk backfill of existing name-equals-LEI rows — Item 1's fix sweeps these up naturally over Phase 3's normal cadence (self-healing, same shape as Known Issue 22.10's fix). If the Founder wants the existing 3 known rows (and any others) fixed faster than organic cadence, flag it back rather than assuming — do not run an ad hoc bulk UPDATE as part of this packet.

## Safety

Small, low-risk change to an already-live, already-scheduled Worker (`meridian-entities-enrich`) and its UI companion — not a new Worker, cron, or table.

1. **Index audit:** no new query shape — adding one field to the existing `UPDATE ... WHERE entity_id = ?`'s `SET` clause changes no index usage. The UI label's join should reuse the existing `entity_isin_map`/`firds_instrument_reference` indexes from MA-SEP-003.
2. **Read/write budget:** zero new subrequests (reuses the response Phase 3 already fetches), zero new D1 writes beyond the field already being written per row.
3. **Documented budget:** confirm in the close-out that Phase 3's real observed subrequest and write counts per invocation are unchanged from a pre-fix baseline.

## Verification

- Re-run Phase 3 for real (or the narrowest safe equivalent this project's testing conventions already use for this Worker) against at least one of the three known-affected rows (`entity_id` 210102, 210982, or 211328). Confirm `name` updates to the real GLEIF legal name, `lei` unchanged, no other row touched.
- **The concrete, Founder-facing test:** after the fix, search the live Corporate Atlas UI for the real fund name (e.g. "UBS" or "iShares") and confirm the previously-invisible entity now appears.
- Confirm the new UI label renders on a real FIRDS-sourced entity's detail view and does **not** render on a non-FIRDS entity (e.g. a US GLEIF-sourced or N-PORT-derived entity) — a false positive here is worse than no label.
- Confirm Phase 3's real subrequest/write counts are unchanged from a pre-fix baseline run.

## Close-out

Update `sprintboarditems` (D1) for MA-SEP-014 directly. Report back to the Control master-lane session with: the exact diff/commit for the Phase 3 `name` fix, confirmation of the search-discoverability check (with the specific entity_id and search term used), the UI label's actual detection/join mechanism (per Spec Open Question 1), the false-positive check result, the before/after subrequest-and-write-count comparison, and the commit hash(es). Also state plainly whether Known Issue 22.24 and 22.25 should be marked CLOSED or left open with a residual note (e.g. if the backlog-hydration-speed question in Scope Item 4 needs a separate Founder decision).

---
*Drafted 2026-09-03 in the Control master-lane (Cowork) session, per Founder approval to move from Spec to execution. See `claude/MA-SEP-014_Spec.md` for full Goals/Non-Goals and root-cause detail.*
