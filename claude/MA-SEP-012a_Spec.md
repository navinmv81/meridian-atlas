# MA-SEP-012a — Entity Merge Exception Management: Design (finalized)

**Lane:** Data/Identity | **Owner role:** Entities Product Lead (+ Tech Ops for the Worker-routing call) | **Stage:** DESIGN — finalized 2026-08-30 pending Founder confirmation, ready to hand off to MA-SEP-012b (build)
**Supersedes:** `claude/MA-SEP-012_Spec.md` (single-ticket draft, 2026-08-29), which itself superseded `claude/MA-OCT-001_Spec.md`. Split into 012a (this doc — design) / 012b (build) on 2026-08-30 per Founder request, so the design can be reviewed and signed off in Control before a D1-writing swim-lane opens.
**Problem statement, Goals, Non-Goals:** unchanged from the original draft — see that document's §Problem Statement/Goals/Non-Goals, reproduced in full at the bottom of this file for a self-contained record.

## What changed from the draft

The draft left the access-control mechanism (Open Question 1) unresolved and blocking. The Founder resolved it 2026-08-30, with one added requirement beyond the original draft: **the surface isn't just a viewer — it's where the Founder actually records merge/no-merge decisions.** That's a clarification of Requirement 3's intent (view/add/edit), not new scope; "decision making capability" is folded into the finalized design below rather than tracked as a separate item.

## Finalized design

**1. Table — `entity_merge_exceptions` (Entities domain), unchanged from the draft:**

| Column | Notes |
|---|---|
| `id` | PK |
| `lei` | nullable — some exceptions may not be LEI-keyed |
| `entity_id_a`, `entity_id_b` | the two `entity_master` rows the decision covers |
| `decision` | `do_not_merge` / `always_merge` / other as needed |
| `reason` | free text |
| `corporate_action_note` | free text, e.g. "2014 spinoff" |
| `decided_by` | who made the call |
| `decided_at` | timestamp |

Seeded at build time with the 3 exceptions already confirmed during MA-SEP-007 (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG), per the draft's P1 nice-to-have — promoted to part of this design since the table would otherwise launch empty.

**2. Access control — resolves Open Question 1.** A hidden route with no navigation entry anywhere in `index.html` or any `ma-*.js` file satisfies "not exposed to terminal end users," but on its own is obscurity, not access control — anyone who finds or guesses the URL could read or write it, which falls short of "only I should be able to see." So the finalized design adds a shared-secret gate on top of the hidden route: every request (reads and writes) must carry a secret credential, checked before any query runs, failing closed if the secret binding is missing. This isn't a new pattern for this project — it directly reuses the shape already built and live-verified for `entities-enrich`'s `/run` endpoint (Known Issue 22.13's fix: `X-Enrich-Run-Secret` header vs. `env.RUN_AUTH_SECRET`, secret generated via `openssl rand -hex 32`, stored only via `wrangler secret put` plus a local gitignored file, never committed). Reusing a proven pattern rather than inventing a new auth mechanism for this project.

**3. The surface itself is a decision-making tool, not a read-only log.** Three operations, all secret-gated:
- **List** existing exceptions (view what's already been decided).
- **Add** a new exception — this is where a merge/no-merge call made in conversation (like SLM/Navient) gets turned into a durable row, on the spot, without a separate build step.
- **Edit** an existing exception (correcting a reason, or reversing a decision if new information changes the call).

**4. Hosting — resolves Open Question 2.** Attaches as new routes on the existing `meridian-entities-api` Worker (e.g. `GET/POST/PUT /admin/exceptions`, secret-gated) rather than a new Worker — no new deployment, no new cron, no change to the account's Cron Trigger budget. Tech Ops to confirm this is clean against the three-point pre-deployment check at build time (it's a low-volume, indexed, on-request-only route, so this should be a formality, not a real risk).

**5. Integration with future dedup passes — unchanged from the draft.** Any future entity-dedup or GLEIF-re-sync pass (the next MA-SEP-007-style packet) queries this table before flagging a pair as ambiguous; a pair with a recorded decision is skipped, not re-surfaced. Acceptance: the next such pass demonstrably skips the 3 seeded exceptions without re-asking the Founder.

## Read/Write budget & safety — unchanged from the draft

Reads: one lookup per candidate pair during a dedup pass, against a table sized in the tens to low hundreds of rows — negligible against the 5M/day ceiling. Writes: manual, Founder-driven, effectively zero volume against the 100k/day ceiling. No new Worker, no new cron — confirmed by this design (item 4 above).

## Remaining open item, non-blocking

- **(Entities Product Lead, at build time)** Finalize the exact `entity_merge_exceptions` column list — the list above is the design's proposal, not schema-locked until MA-SEP-012b actually creates the table.

## Handoff to MA-SEP-012b

This design is ready for Founder sign-off. Once confirmed, MA-SEP-012b (build) opens as its own dedicated local Claude Code swim-lane — this cloud sandbox cannot reach the Cloudflare API for the schema change, secret provisioning, or Worker redeploy this needs. Suggested opener: **"Role: Entities Product Lead. Packet: MA-SEP-012b."** Build scope: create `entity_merge_exceptions` (Entities domain, declared explicitly per CLAUDE.md's new-table rule) and seed its 3 known rows; add the secret-gated `/admin/exceptions` routes to `meridian-entities-api`; generate and store the shared secret via `wrangler secret put` (never committed); verify the three-point check; live-verify unauthenticated → rejected, correct-secret → 200, same shape as Known Issue 22.13's verification.

---
*Design finalized 2026-08-30 in the Control master-lane (Cowork) session, from the Founder's direct answers to the two open design questions in the original draft. Full original Problem Statement / Goals / Non-Goals below, unchanged.*

## Appendix — original Problem Statement, Goals, Non-Goals (unchanged from the 2026-08-29 draft)

### Problem Statement

Working through MA-SEP-007's Scenario B (both sides of a duplicate share an LEI) surfaced a recurring pattern: a shared LEI does not always mean two `entity_master` rows are the same entity. `SLM Corp` / `Navient Corp` share an LEI from a 2014 spinoff but are legitimately separate, publicly-traded companies today. `Santander Bank Polska` / `Erste Bank Polska` and `OPAP Holding SA` / `Allwyn AG` raised the same question with less certainty. The Founder's own transaction experience confirms this is a known, recurring corporate-action pattern (LEI retention/reuse through spinoffs and absorptions), not a one-off data anomaly. Right now, every one of these judgment calls is made from scratch, in conversation, during whichever dedup pass happens to surface it — there is no durable record. The next GLEIF re-sync or entity-dedup pass will re-encounter `SLM Corp` / `Navient Corp` and re-ask the same question, at the cost of Founder review time and with no guarantee the same call is made twice.

### Goals

1. Every entity-merge exception decision (e.g. "SLM Corp/Navient Corp: known 2014 spinoff, do not merge") is captured exactly once and never manually re-reviewed by the Founder in a future pass.
2. Future dedup/enrichment passes (the next MA-SEP-007-style packet) check this table automatically before flagging a pair for Founder review, reducing repeat review volume over time.
3. The tool and its contents are visible only to the Founder — explicitly not exposed anywhere in Meridian Atlas's terminal end-user surface.
4. Stays inside a trivial D1 read/write budget — no cron, no scheduled job, negligible row count relative to free-tier ceilings.
5. New table's domain ownership is explicitly declared per CLAUDE.md's rule before any build session starts.

### Non-Goals

- **Not a general-purpose, cross-domain data-quality tool.** Scoped to entity-merge / LEI-collision exceptions specifically, matching what MA-SEP-007 actually needed. A broader data-quality surface (ETF holdings anomalies, 13F parsing exceptions, etc.) is a separate, later idea if ever pursued.
- **Not a replacement for `/validate-data`.** `/validate-data` checks referential integrity and uniqueness after a change; this tool prevents re-litigating identity judgment calls before a change. Different jobs.
- **Not an audit-trail/versioning system in v1.** Records the current decision and its reasoning, not a full history of how that decision changed over time. Revisit if a real need for history shows up.
- **Not exposed in the terminal UI in any form this version.** No end-user-facing surface at all — internal/Founder-only, full stop. If a future version ever needs broader visibility, that's a new spec, not an extension of this one.
