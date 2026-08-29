# MA-OCT-001 — Data Quality Exception Management Tool (Spec)

**Lane:** Data/Identity | **Owner role:** Entities Product Lead | **Stage:** DRAFT — ready for Founder review, not yet approved
**Drafted:** 2026-08-29, Cowork swim-lane (device-bridge) session, Role: Entities Product Lead, Packet: MA-SEP-007
**Dependencies:** Surfaced during MA-SEP-007's Scenario A/B/C merge-rule conversation. Not blocking MA-SEP-007's own close — this is a separate backlog item logged for an October build.

## Problem Statement

Working through MA-SEP-007's Scenario B (both sides of a duplicate share an LEI) surfaced a recurring pattern: a shared LEI does not always mean two `entity_master` rows are the same entity. `SLM Corp` / `Navient Corp` share an LEI from a 2014 spinoff but are legitimately separate, publicly-traded companies today. `Santander Bank Polska` / `Erste Bank Polska` and `OPAP Holding SA` / `Allwyn AG` raised the same question with less certainty. The Founder's own transaction experience confirms this is a known, recurring corporate-action pattern (LEI retention/reuse through spinoffs and absorptions), not a one-off data anomaly. Right now, every one of these judgment calls is made from scratch, in conversation, during whichever dedup pass happens to surface it — there is no durable record. The next GLEIF re-sync or entity-dedup pass will re-encounter `SLM Corp` / `Navient Corp` and re-ask the same question, at the cost of Founder review time and with no guarantee the same call is made twice.

## Goals

1. Every entity-merge exception decision (e.g. "SLM Corp/Navient Corp: known 2014 spinoff, do not merge") is captured exactly once and never manually re-reviewed by the Founder in a future pass.
2. Future dedup/enrichment passes (the next MA-SEP-007-style packet) check this table automatically before flagging a pair for Founder review, reducing repeat review volume over time.
3. The tool and its contents are visible only to the Founder — explicitly not exposed anywhere in Meridian Atlas's terminal end-user surface.
4. Stays inside a trivial D1 read/write budget — no cron, no scheduled job, negligible row count relative to free-tier ceilings.
5. New table's domain ownership is explicitly declared per CLAUDE.md's rule before any build session starts.

## Non-Goals

- **Not a general-purpose, cross-domain data-quality tool.** Scoped to entity-merge / LEI-collision exceptions specifically, matching what MA-SEP-007 actually needed. A broader data-quality surface (ETF holdings anomalies, 13F parsing exceptions, etc.) is a separate, later idea if ever pursued.
- **Not a replacement for `/validate-data`.** `/validate-data` checks referential integrity and uniqueness after a change; this tool prevents re-litigating identity judgment calls before a change. Different jobs.
- **Not an audit-trail/versioning system in v1.** Records the current decision and its reasoning, not a full history of how that decision changed over time. Revisit if a real need for history shows up.
- **Not exposed in the terminal UI in any form this version.** No end-user-facing surface at all — internal/Founder-only, full stop. If a future version ever needs broader visibility, that's a new spec, not an extension of this one.

## Requirements

### Must-Have (P0)

1. **New D1 table, Entities domain**: `entity_merge_exceptions` — recording durable exception decisions. Proposed columns: `id` (PK), `lei` (nullable — some exceptions may not be LEI-keyed), `entity_id_a`, `entity_id_b`, `decision` (`do_not_merge` / `always_merge` / other as needed), `reason` (free text), `corporate_action_note` (free text, e.g. "2014 spinoff"), `decided_by`, `decided_at`.
   - *Acceptance:* table created with an explicit domain declaration (Entities) in its creation prompt, per CLAUDE.md's rule for new tables; owned and written only by Entities-domain pipelines/tools.
2. **Automatic check in future dedup passes.** Any future entity-dedup or GLEIF-re-sync pass queries this table before flagging a pair as ambiguous/needing review; a pair with a recorded decision is skipped, not re-surfaced.
   - *Acceptance:* the next dedup-style packet after this table exists demonstrably skips at least the 3 exceptions this session already confirmed (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG) without re-asking the Founder.
3. **Internal-only admin surface** to view/add/edit exceptions — not exposed to terminal end users. Exact mechanism (separate unlinked route, shared-secret gate, or something else) is an open design question (see Open Questions) — this project has no existing auth pattern to reuse, so this needs its own small design decision before the build session, not an assumption baked into this spec.
   - *Acceptance:* the surface is reachable by the Founder and verifiably unreachable from the public terminal's normal navigation/routes.

### Nice-to-Have (P1)

1. Seed the table at build time with the 3 exceptions already confirmed this session (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG) so the tool has real content from day one instead of launching empty.

### Future Considerations (P2)

1. Extend beyond entity-merge exceptions to other recurring data-quality judgment calls, if a real second use case shows up (not assumed now).
2. Add decision history/versioning if a real need for "what did we decide before, and when did it change" shows up.

## Read/Write Budget & Safety Reasoning

- **Reads:** one lookup per candidate pair during a dedup pass, against a table sized in the tens to low hundreds of rows even after years of use — negligible against the 5M reads/day free-tier ceiling.
- **Writes:** manual, Founder-driven, one row per exception decision — effectively zero volume, nowhere near the 100k writes/day ceiling.
- **No new Worker, no new cron.** The admin surface can likely piggyback on an existing Worker's routing (Tech Ops to confirm at build time) rather than requiring a new deployment.

## Open Questions

1. **(Founder / Tech Ops — blocking)** What access-control mechanism enforces "Founder-only, not visible to terminal end users"? Candidates: a separate, unlinked route with no navigation entry point; a shared-secret query parameter; something else. This project has no existing auth pattern to reuse, so this needs a real decision, not an assumption, before the build session starts.
2. **(Tech Ops — non-blocking)** Does the admin surface get its own minimal Worker, or attach to an existing one (e.g. `meridian-entities-api`)? Affects the three-point pre-deployment check if a new Worker is involved.
3. **(Entities Product Lead — non-blocking)** Finalize the exact `entity_merge_exceptions` column list at build time — the list above is a proposal, not locked.

## Timeline Considerations

- Target: October release, per the Founder's original ask when this idea surfaced (2026-08-28).
- No hard deadline or external dependency — this is a backlog item, not a blocker for anything currently in flight.
- **Must run from local Claude Code, not a Cowork session**, for the same standing reason as every other D1-writing packet on this project: this cloud sandbox cannot reach the Cloudflare API for schema changes or D1 writes.
- A Build Brief should follow once the Founder has reviewed this spec and Open Question 1 (access-control mechanism) has an answer — execution then hands off to a dedicated swim-lane session, per this project's standard pattern.

---
*Drafted 2026-08-29 in the Cowork swim-lane (device-bridge) session, Role: Entities Product Lead, Packet: MA-SEP-007 — this is a scoping draft for Founder review, not yet approved. Full background: `MA-SEP-007_Merge_Rules_Finalized.md` §4.*
