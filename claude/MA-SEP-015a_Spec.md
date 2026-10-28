# MA-SEP-015a — Data Quality Exception Engine (Cross-Domain) — Design (Spec)

**Lane:** Data/Identity + Application + Ops | **Owner role:** Entities Product Lead (design lead) + Tech Ops / SRE (domain-ownership and access-control sign-off) | **Stage:** **APPROVED (2026-09-05)** — Founder sign-off given on all three blocking Open Questions plus the non-blocking transport question. MA-SEP-015b Build Brief drafted the same day (`claude/MA-SEP-015b_Build_Brief.md`) — see that document for execution scope.
**Drafted:** 2026-09-04, Control master-lane (Cowork) session, per Founder request to generalize the existing entity-merge-exceptions tooling into a broader exception-management surface.
**Provisional ticket IDs — not yet confirmed collision-free against live `sprintboarditems`.** Same standing caution as every other ID Control has proposed this sprint (two real collisions already: MA-SEP-002→MA-SEP-007, MA-SEP-011→MA-SEP-013) — confirm with a local D1-connected session before treating `MA-SEP-015`/`MA-SEP-015a`/`MA-SEP-015b` as final.
**Lineage:** This is not new scope invented from nothing — it is the next step in a line that already exists on this board: `MA-OCT-001` ("Data Quality Exception Management tool," surfaced 2026-08-29 from MA-SEP-007's Scenario B risk-case work) → pulled into September and renamed `MA-SEP-012` (2026-08-29) → split into `MA-SEP-012a` (Design, approved 2026-08-30) and `MA-SEP-012b` (Build, closed 2026-08-30) → fast-followed by `MA-SEP-012c` (local read-only snapshot viewer, 2026-08-31) and `MA-SEP-012d` (one-click refresh, 2026-08-31) after the Founder found the secret-gated JSON API unusable day-to-day (Known Issue 22.23). MA-SEP-012's entire arc shipped a real, working tool — but scoped narrowly to one exception type (`entity_merge_exceptions`) and one user (the Founder, via a hidden route + shared secret). This packet is the deliberate widening of that same tool, not a replacement for it.

---

## Problem Statement

MA-SEP-012's arc proved the pattern works: a Founder-facing surface for reviewing flagged data-quality exceptions and recording accept/reject decisions is genuinely useful — the Founder used it for real decisions (SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG). But it was built, correctly, as narrowly as the Founder asked for at the time: one table (`entity_merge_exceptions`), one Worker (`meridian-entities-api`'s admin routes), one access model (hidden route + shared secret, explicitly Founder-only, explicitly not a terminal-facing product surface), and one consumption mode (a locally-generated static snapshot, view-only).

Since then, this project has surfaced several *other* data-quality exception types that share the same underlying shape — a flagged row, a decision that needs a human judgment call, and no current UI to make that call anywhere except a swim-lane session's own investigation:

- **Known Issue 22.17** — `entity_isin_map` duplicate ISIN-to-entity mappings (`task_f3f1be29`, `task_7a94ca1d`), OPEN, no owner assigned yet, fix priority still on Founder HOLD (unchanged by this Design's approval — see Founder Decisions below).
- **Known Issue 22.9** — bad `legal_parent` edges in `entity_relationships` (4 known-wrong rows), accepted-and-documented rather than fixed, root cause still unscheduled.
- **Known Issue 22.16** — European legal-form normalization gaps in `normalizeName()`, which will keep generating ambiguous-tier dedup candidates on every future GLEIF re-sync pass.
- The Tier 2 "Scenario B" shared-LEI/name-mismatch cases from MA-SEP-007 itself — the exact category `entity_merge_exceptions` was built for, now generalized.

Each of these today gets resolved (or left unresolved) inside whatever swim-lane session happens to be looking at it, with no durable, reviewable queue and no consistent place a Founder or future operations user goes to make the call. The Founder's request is to stop building a one-off admin page per exception type and instead build one reusable engine: a generic exception queue and review UI that `entity_merge_exceptions`-style decisions plug into as the first populated case, with room for 22.17/22.9/22.16-style exceptions (and whatever comes after those) to plug in the same way later.

## Founder decisions already made (2026-09-04, via this Control session)

1. **Scope width: cross-domain engine, not entity-merge-only.** "One reusable UI/data model for reviewing and resolving any flagged data-quality exception across domains — entity merges now, FIRDS/ISIN-type issues later." This is a material widening from MA-SEP-012's original entity-merge-only design.
2. **Timing: pull into September, not October backlog.** "Same pattern as MA-OCT-001→MA-SEP-012 — the sprint has real buffer left, so bring it forward now rather than wait." Per the September Sprint — Plan vs. Delivery Reconciliation table, the sprint's own closure gate (MA-SEP-007) closed ~4 weeks ahead of its worst-case target, and the buffer window (Sep 27–30) is not yet reached — there is real room. This does **not** mean the September sprint is "closed" — MA-SEP-013 (go-live) still hasn't run — so this new epic sits alongside that outstanding item, not after it.

## Goals

1. A single, generic exception-review data model and UI — not a per-exception-type bespoke page — where a "data quality exception" is a typed record (type, source table/domain, flagged reason, evidence, proposed resolution, decision, decided-by, decided-at) rather than a table shaped around one specific case.
2. `entity_merge_exceptions`' existing 3 real rows and its Founder-reviewed workflow (accept/reject with reasoning) become the first populated case under the new model — proving the generalization on real data the Founder has already made real decisions about, not a synthetic example.
3. A real access-control model appropriate to "operations exception management," not "Founder's personal hidden page" — resolved below (real per-user credential, not a shared secret).
4. Room for at least one *other* exception type (recommend Known Issue 22.17, `entity_isin_map` duplicates, as the second populated case — it already has two real, unresolved instances filed as tasks) to be added without a schema change, proving genuine cross-domain reusability rather than reusability in name only.
5. Keep the parts of MA-SEP-012c/012d's hard-won lessons that still apply regardless of how big this gets: whatever the final read/write mechanism is, it must actually be usable day-to-day (MA-SEP-012c/d exist because a secret-gated JSON API wasn't), and any live-fetch design must be tested against the real deployment target's origin restrictions before being treated as done (the `file://`-vs-`http://` lesson from Known Issue 22.23) — resolved below by going properly live over `http://` from the start.

## Non-Goals

- **No automatic detection/flagging engine in this phase.** This packet builds the review-and-decide surface for exceptions that already exist as findings (task-filed, Known-Issue-logged, or otherwise already surfaced by a swim-lane session) — it does not build new detection logic that scans D1 and generates new flagged rows on its own. A future packet could add that; explicitly out of scope here.
- **No change to how `entity_merge_exceptions`' 3 existing rows were decided.** Those decisions (SLM/Navient, Santander/Erste, OPAP/Allwyn) stand as-is; migrating them into the new schema (see Founder Decisions, OQ3) carries the decisions forward unchanged — it does not revisit them.
- **No commitment yet to migrating Known Issue 22.17 into this engine as a populated row in this phase.** Its fix priority remains on Founder HOLD (unchanged by this Design's approval); MA-SEP-015b's Build Brief scopes the schema/migration/access-control work only, and treats seeding 22.17's two instances as an optional stretch item, not committed scope, pending a separate HOLD decision.
- **No terminal-facing/customer-facing surface.** This remains an operations/Founder tool, same as MA-SEP-012's whole arc — the access-control widening (real per-user credential) is about who on the operations side can use it, not about exposing it in the public product.

## Open Questions — RESOLVED 2026-09-05 (Founder, via this Control session)

1. **Domain ownership of the new generic exception-queue table(s).** CLAUDE.md is explicit: *"When introducing a new D1 table, explicitly decide whether it belongs to the ETF domain or the Entities domain... Cross-domain tables (written by both domains) are not allowed without explicit discussion."*
   **DECIDED: one table per domain** (`entity_exceptions` for the Entities domain, a future `etf_exceptions` for the ETF domain whenever ETF Product Lead needs one) — each owned normally under existing domain-ownership rules; the UI/API layer does the cross-domain aggregation, not the storage layer. This packet's Delivery (MA-SEP-015b) builds only `entity_exceptions` (Entities-domain, owned by Entities Product Lead) — no ETF-domain table is created now.
2. **Access-control model.** MA-SEP-012a's approved design was a hidden route + shared secret, explicitly justified as "Founder-only, not a terminal-facing product surface." Broadening this into an "operations exception management" tool changes what "access control" needs to mean.
   **DECIDED: a real per-user credential model**, not a shared secret. **Control's recommended mechanism, for Delivery to confirm at build time:** Cloudflare Access (Zero Trust) in front of the exception-engine route(s) — free for up to 50 users on Cloudflare's free tier, integrates natively with Workers (the Worker validates the `Cf-Access-Jwt-Assertion` header against Cloudflare's own identity check rather than the Worker owning any password/credential storage itself), and avoids building and maintaining custom authentication code or a credentials table. This avoids repeating Known Issue 22.23's mistake of shipping an access model that turns out unusable, since Cloudflare Access is provisioned and tested as infrastructure before any application code depends on it. If Cloudflare Access turns out unsuitable at build time (e.g. a real constraint specific to this Cloudflare account), flag it back to the Founder before falling back to a custom-built credential system.
3. **Migration path for `entity_merge_exceptions` and MA-SEP-012b's existing routes.**
   **DECIDED: migrate and retire.** Migrate the 3 existing rows into the new `entity_exceptions` schema, verify the migration (row-for-row, not just a count match), then retire `entity_merge_exceptions` and MA-SEP-012b's three admin routes on `meridian-entities-api`. Given these are real Founder decisions (not disposable test data), Delivery must keep a verified backup (e.g. a dumped copy of the 3 source rows) before dropping anything, and must not drop the old table until the new one is confirmed live-correct.
4. **Read/write transport mechanism.** Given Known Issue 22.23's history, Design sign-off names a mechanism rather than leaving it to be rediscovered the same way MA-SEP-012 was.
   **DECIDED: go properly live over `http://`**, not a generated-snapshot-plus-refresh model. A real authenticated API (protected by the Cloudflare Access decision above) serving a small dedicated ops page, supporting live reads and writes — not a static file that goes stale between manual refreshes. This directly avoids the `file://`-origin restriction that caused Known Issue 22.23 in the first place (confirmed by MA-SEP-012d's investigation to be the specific cause, not CORS or the secret itself).

## Sequencing

MA-SEP-015a (this Design) is now approved — see Founder Decisions above. `claude/MA-SEP-015b_Build_Brief.md` has been drafted and is ready to run in its own dedicated swim-lane (this Cowork session cannot reach the Cloudflare API for schema changes, Cloudflare Access configuration, or Worker redeploys), mirroring MA-SEP-012a→012b's own handoff exactly.

## Timeline

Pulled into September per the Founder's explicit 2026-09-04 decision (see above). Design approved 2026-09-05, same day the Open Questions were put to the Founder — faster than MA-SEP-012a's own turnaround, reflecting that three of the four questions already carried a clear recommendation going in.

---
*Drafted 2026-09-04 in the Control master-lane (Cowork) session, from the Founder's own scoping decision plus this project's existing Known Issue log. Updated 2026-09-05 with the Founder's resolution of all four Open Questions — Design now APPROVED, Build Brief drafted the same day.*
