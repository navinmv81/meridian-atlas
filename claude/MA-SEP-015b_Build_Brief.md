# MA-SEP-015b — Data Quality Exception Engine (Cross-Domain): Build Brief

**Lane:** Data/Identity + Ops | **Owner role:** Entities Product Lead (build) + Tech Ops / SRE (three-point check + access-control verification) | **Stage:** APPROVED — ready to execute
**Depends on:** MA-SEP-015a (design), approved by the Founder 2026-09-05 — see `claude/MA-SEP-015a_Spec.md` for full design rationale and the four resolved Open Questions.
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session cannot reach the Cloudflare API for schema changes, Cloudflare Access configuration, secret/credential provisioning, or Worker redeploys, and per this project's session discipline, build work does not execute inside the Control master-lane. Do not fold this into any other packet's session.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-015b.`

---

## Context

MA-SEP-015a generalizes MA-SEP-012's entity-merge-only, Founder-only exception tooling into a reusable, per-domain exception queue with real per-user access control, served live rather than as a refreshed snapshot. This brief is the build for the Entities-domain half of that model: a new `entity_exceptions` table, migration of the 3 existing `entity_merge_exceptions` rows into it, retirement of the old table/routes, and a live, Cloudflare-Access-protected review UI. **No ETF-domain table is created in this packet** — per the approved design, ETF-domain exceptions get their own table later, owned by ETF Product Lead, when that domain has a real populated case.

## Approved scope — build exactly this, nothing more

### 1. New table, Entities domain: `entity_exceptions`

Declare the domain explicitly (Entities) in the table's creation prompt, per CLAUDE.md's rule for new tables.

```
entity_exceptions
  id                    PK
  exception_type        e.g. 'entity_merge' (first/only type populated this round)
  source_table          e.g. 'entity_master'
  source_ref            JSON — the record(s) this exception concerns (e.g. {"entity_id_a":..,"entity_id_b":..,"lei":..})
  flagged_reason         free text — why this was flagged
  evidence               free text/JSON — supporting detail
  proposed_resolution    free text, nullable
  decision               e.g. 'do_not_merge' / 'always_merge' / 'pending'
  corporate_action_note  free text, nullable, e.g. "2014 spinoff"
  decided_by             text — the authenticated user's identity (from Cloudflare Access), not free text
  decided_at             timestamp, nullable until a decision is made
  created_at             timestamp
```

This shape must not require a schema change to add Known Issue 22.17-style rows later (`exception_type = 'isin_duplicate'`, `source_table = 'entity_isin_map'`) — confirm this by sketching (not building) what a 22.17 row would look like in this schema before finalizing the columns above.

### 2. Migration — verify before retiring anything

1. Dump/export the 3 existing `entity_merge_exceptions` rows in full (real values, not a row count) before touching anything.
2. Insert 3 corresponding rows into `entity_exceptions` (`exception_type = 'entity_merge'`), mapping fields per the schema above — reuse the real `entity_id`s/LEIs already in `entity_merge_exceptions`, do not re-derive or re-guess them.
3. Verify row-for-row: every field in each new `entity_exceptions` row matches its source row's real value, not just a count of 3.
4. Only after that verification passes: retire `entity_merge_exceptions`'s three admin routes on `meridian-entities-api` (`GET/POST/PUT /admin/exceptions*`) and the table itself. Keep the verified dump from step 1 outside the table (e.g. in the close-out report) in case anything needs to be re-checked later. Do not drop the table in the same step as adding the new one — confirm the new table is live-correct first, then drop as a distinct, separately-verified step.

### 3. Access control — Cloudflare Access, not a shared secret

Per the approved design, this replaces MA-SEP-012a's shared-secret pattern:

- Put the new exception-engine route(s) behind Cloudflare Access (Zero Trust), scoped to your own identity (and any other operations user, if named at build time) — not the whole internet, and not reachable by anyone who merely knows the URL.
- The Worker validates the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion` header) rather than implementing or storing any password/credential itself — no new credentials table, no hashing code to write or maintain.
- `decided_by` on each row should be populated from the verified Access identity (e.g. the JWT's `email` claim), not typed free text — this is a real improvement over MA-SEP-012b's free-text `decided_by`, worth calling out in the close-out report as a genuine gain from this access-control change.
- If Cloudflare Access turns out unsuitable for this account for any concrete reason, stop and flag it back before building a custom fallback — do not silently substitute a different auth mechanism than the one named in the approved design.

### 4. Routes — extend the existing `meridian-entities-api` Worker

Do not create a new Worker. Do not add any new cron trigger.

```
GET  /exceptions              — list all entity_exceptions rows
POST /exceptions              — add a new exception
PUT  /exceptions/:id          — edit an existing exception / record a decision
```

(Naming deliberately drops the old `/admin/` prefix and `entity_merge_exceptions`-specific shape, since this is now a generic entity-domain exception surface, not a merge-only one — but keep it un-navigable from `index.html`/`ma-*.js`, same discipline as MA-SEP-012b: this is still an operations tool, not a terminal-facing product surface, per the Design's Non-Goals.)

### 5. UI — a small dedicated ops page, served live

A single page (mirroring the intent of MA-SEP-012c/d's viewer, but live rather than a refreshed snapshot) that lists `entity_exceptions` rows and lets an authenticated user add/edit/decide. Served over `http://`/`https://` behind Cloudflare Access — not a local file, not something that needs a `.command` script run to refresh. This is the direct fix for Known Issue 22.23's root cause (a `file://`-origin restriction, confirmed by MA-SEP-012d's investigation).

### 6. Safety — three-point pre-deployment check

Run the three-point check (index audit / single-execution read test under 50k rows / documented read-write budget) before enabling the new routes — this table will be tiny (starts at 3 rows), so this is a formality, but do it for real, same as MA-SEP-012b did.

## Do not do

- No scope expansion beyond `entity_exceptions` (Entities domain) — no `etf_exceptions` table, no ETF-domain routes or Workers.
- No schema changes beyond the approved design above.
- No cron enablement — this remains a manually-driven review surface, not a scheduled job.
- Do not seed Known Issue 22.17's two instances into `entity_exceptions` in this packet — its fix priority is still on Founder HOLD; seeding it as a data-quality-exception row is a separate, not-yet-approved scope decision, not implied by this Build Brief.
- Do not touch `meridian-holdings`, any ETF-domain table, or any other open packet/Known Issue on the Sprint Board.
- Do not fall back to a shared-secret or custom-password model without stopping to flag it first, even if Cloudflare Access proves fiddly to set up.

## Required outputs (close-out report)

- Touched files (Worker source, any new UI file, migration script/query).
- The real verification evidence for the migration (step 2.3 above) — not just "3 rows migrated," but the actual before/after field comparison.
- Confirmation `entity_merge_exceptions` and its three old routes are fully retired, with the pre-drop backup noted (where it lives, not its content if sensitive).
- Cloudflare Access configuration summary (which identities/emails are authorized) — never any JWT/secret values themselves.
- Live verification matrix: unauthenticated request → rejected; authenticated request → succeeds; a rejected write confirmed not to have landed at the table level (not just an HTTP-level check) — same rigor MA-SEP-012b applied.
- Three-point check results.
- Deployed Worker version.
- Any deviation from this brief, disclosed before or immediately after, not discovered later.

Report back to the Control master-lane session with all of the above so the Sprint Board and Release Ledger can be reconciled, same pattern as every prior packet this sprint.

---
*Drafted 2026-09-05 in the Control master-lane (Cowork) session, from the Founder-approved MA-SEP-015a design, for execution in a separate dedicated swim-lane per this project's session discipline.*
