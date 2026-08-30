# MA-SEP-012b — Entity Merge Exception Management: Build Brief

**Lane:** Data/Identity | **Owner role:** Entities Product Lead | **Stage:** APPROVED — ready to execute
**Depends on:** MA-SEP-012a (design), approved by the Founder 2026-08-30 — see `claude/MA-SEP-012a_Spec.md` for the full design rationale.
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session cannot reach the Cloudflare API for schema changes, secret provisioning, or Worker redeploys, and per this project's session discipline, build work does not execute inside the Control master-lane. Do not fold this into any other packet's session.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-012b.`

---

## Context

MA-SEP-012 (originally filed as `MA-OCT-001`) proposes a durable record of entity-merge exception decisions — cases like SLM Corp/Navient Corp, where a shared LEI does not mean two `entity_master` rows are the same entity — so future dedup/GLEIF-resync passes stop re-litigating the same judgment calls. The design (012a) was approved 2026-08-30, resolving its one blocking Open Question (access control). This brief is the build.

## Scope — build exactly this, nothing more

### 1. New table, Entities domain

Declare the domain explicitly (Entities) in the table's creation prompt, per CLAUDE.md's rule for new tables.

```
entity_merge_exceptions
  id                    PK
  lei                   nullable
  entity_id_a           references entity_master
  entity_id_b           references entity_master
  decision              e.g. 'do_not_merge' / 'always_merge'
  reason                free text
  corporate_action_note free text, e.g. "2014 spinoff"
  decided_by            text
  decided_at            timestamp
```

Seed it at build time with these 3 confirmed exceptions (look up the real `entity_id`s against live `entity_master` — do not guess IDs):

1. SLM Corp / Navient Corp — `do_not_merge` — 2014 spinoff, shared LEI, legitimately separate public companies today.
2. Santander Bank Polska / Erste Bank Polska — `do_not_merge` — same-LEI-different-entity risk case flagged during MA-SEP-007.
3. OPAP Holding SA / Allwyn AG — `do_not_merge` — same-LEI-different-entity risk case flagged during MA-SEP-007.

### 2. Admin surface — new routes on the EXISTING `meridian-entities-api` Worker

Do not create a new Worker. Do not add any new cron trigger.

```
GET  /admin/exceptions       — list all rows
POST /admin/exceptions       — add a new exception
PUT  /admin/exceptions/:id   — edit an existing exception
```

No route may be reachable from `index.html` or any `ma-*.js` file's navigation. Verify this is actually true (grep for any reference to `/admin/exceptions` outside these three new routes — there should be none).

### 3. Access control — every route above checks a shared secret before doing anything

Mirror the exact pattern already live-verified on `entities-enrich`'s `/run` (Known Issue 22.13's fix): a secret header, checked before any query/insert/update, failing closed if the binding is missing.

- Generate a new secret via `openssl rand -hex 32`.
- Store it ONLY via `wrangler secret put` plus a local gitignored file — confirm the file is gitignored **before** writing it, same as the 22.13 precedent.
- Never commit the secret value anywhere, and never paste it back in your close-out report.
- Use a distinct env var name (e.g. `ADMIN_EXCEPTIONS_SECRET`) and header name (e.g. `X-Admin-Exceptions-Secret`) — this must not collide with `entities-enrich`'s own secret.

### 4. Safety

Run the three-point pre-deployment check (index audit / single-execution read test under 50k rows / documented read-write budget) before enabling the routes — this table will be tiny, so this should be a formality, but do it for real rather than assume.

**Do not touch:** any other table, any other Worker, or any existing route on `meridian-entities-api` beyond adding these three new ones. Do not touch `meridian-holdings`, Known Issues 22.12/22.17-22.22, or anything else on the Sprint Board — those are separate packets, separate lanes.

## Verification — live, same shape as Known Issue 22.13's verification

- `GET /admin/exceptions` with no secret header → rejected (not 200).
- `GET /admin/exceptions` with wrong secret → rejected.
- `GET /admin/exceptions` with correct secret → 200, returns the 3 seeded rows.
- `POST`/`PUT` with correct secret → succeed and are reflected on a follow-up `GET`.
- `POST`/`PUT` with no or wrong secret → rejected, and confirm directly against the table (not just the HTTP response) that no row was written or changed.

## Close-out

Update `sprintboarditems` (D1) directly for MA-SEP-012b, same pattern as prior packets. Report back to the Control master-lane session with: the real `entity_id`s used for the 3 seeded rows, the deployed Worker version, secret-storage confirmation (gitignored file path, `wrangler secret put` confirmation — never the secret value itself), and the live verification results above, so the Sprint Board and Release Ledger can be reconciled.

---
*Drafted 2026-08-30 in the Control master-lane (Cowork) session, from the Founder-approved MA-SEP-012a design, for execution in a separate dedicated swim-lane per this project's session discipline.*
*Synced to local disk 2026-08-30 — this file previously existed only in the Claude Project, not in the repo, the same recurring gap hit by MA-SEP-003/004/008/009/010's first local sessions.*
