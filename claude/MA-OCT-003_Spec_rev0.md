# MA-OCT-003 — Exception Management: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane) — Task MA-OCT-003.SPEC v1
EXECUTED BY:  Operations Lead (packet owner and spec author; LANE-3, doc-only)
REVIEWED BY:  Data-Identity Lead + Architect (separate review packets; the author never reviews this)
APPROVED BY:  Founder
PACKET:       MA-OCT-003 — Exception management (+ entity_exceptions migration, /exceptions retirement, /admin residue removal)
GATE:         Spec approval → build 19–23 Oct (Claude Code) → retirement deploy ≥ Sat 24 Oct → close-out
STATUS:       REV 0 (Wed 14 Oct 2026). Doc-only: 0 D1 reads or writes, no deploys, no git writes.
DOMAIN:       Ops (Addendum D3). Owner Operations Lead. Only writer of ops_* tables: meridian-ops.
BASELINE:     October-2026 @ 3960aee; meridian-ops 0905784d (A3 sweep live 13 Oct).
```

Input hashes are in Appendix C. Where this spec differs from 001 §5.4 or 002 §7.2, the difference is named, with its reason, in §0.2.

---

## 0. Summary of decisions (one line each)

1. **No new table.** 003 uses the 001 tables (`ops_exception`, `ops_case_event`, `ops_data_quality_ticket`). It adds **one index** (`idx_ops_dq_linked_exc`), in migration `App/Ops/migrations/004-ops-cases.sql` (§6).
2. **The workflow lives in `meridian-ops`, behind the existing Access app "meridian-ops admin"**. It adds **4 endpoints**: 2 exception routes, plus 2 shared case routes that 004 reuses for DQ tickets (§8).
3. **Assumption, stated as the Task asks: A6 (`meridian-control`) is NOT live today.** `ops-api.js` has 15 endpoints out of 15 (checked in the source at `3960aee`). **A6 is a hard build prerequisite**: without it 003 would take the Worker to 19. If A6 isn't live by Mon 19 Oct, day 1 of the 003 build does A6 first, under 002's CR-1 (§16).
4. **Statuses:** `open → acknowledged → resolved | dismissed`, and `reopen` back to `open`. **Severities:** `sev1`–`sev4`. **Resolution codes** are listed in §7. Every change is one atomic `db.batch()`: a guarded `UPDATE` plus one `ops_case_event` row, with optimistic concurrency and a client request id (§8.4).
5. **The 002a sweep stays the only automatic raiser.** 003 adds no raise at ingest time: one code path, deterministic `EXC-S-` refs. 003 extends the sweep in four ways (§9):
   - one open case per (job, condition type), with a 30-day snooze for accepted risks;
   - GLEIF-E1, E2, E4, E5 and E6;
   - auto-resolve of `job_missed` when a replayed run fills the slot (Founder Q1);
   - `error_class` added to L2.
6. **GLEIF-E3 (orphaned `name_search` backlog) is not automated in October.** A full check costs about 66k reads per execution. One case is seeded instead, pointing at RC-1/H1 and MA-OCT-011 (§9.3).
7. **The `entity_exceptions` migration is a reviewed `wrangler d1 execute --file` batch** using `INSERT OR IGNORE … SELECT FROM entity_exceptions`. Values are copied inside D1, so `decided_by`, `decided_at` and `created_at` arrive byte-for-byte. Re-running it is a no-op (§10).
8. **All 9 known legacy rows are DQ types** (3 `entity_merge`, 4 `bad_relationship_edge`, 2 `isin_duplicate`), so they become `ops_data_quality_ticket` rows `DQ-M-nnnnnn`. **Any other type stops the build** (fail closed) until the Data-Identity Lead and Operations Lead classify it. Read pack R1/R2 confirms the counts (Appendix A).
9. **Order: freeze → dump → migrate → verify.** The freeze is a Founder dashboard step: set the existing `/exceptions` Access app's policy to Block, which needs no deploy and is reversible. Retirement of `/exceptions`, `/exceptions/ui` and `/exceptions/:id`, and removal of the `/admin/exceptions` residue (KI 22.23, 22.27), is **one `meridian-entities-api` deploy on or after Sat 24 Oct 08:05 UTC** (N-3: no Entities Worker deploys 17–23 Oct). It is covered by CR-003-1 (Appendix B), which needs Architect review.
10. **`entity_exceptions` is kept, frozen, in October.** Dropping it is a November decision under its own approval (Founder Q2).
11. **D1:** steady state ≤ about 150 writes and ≤ about 3k reads a day; the one-time migration is ≤ about 300 writes. Every query is index-backed or a declared bounded scan, and no single execution exceeds 1,000 reads (§11).

### 0.1 Facts checked in the source and on disk (14 Oct, read-only)

| Fact | Where |
|---|---|
| `meridian-ops` routes: 8 public GETs, 4 admin POSTs, 1 admin GET (`/jobs`), 2 ingest POSTs (`run-event`, `sweep`) = **15** | `App/Ops/src/ops-api.js` lines 1144–1203 (1,213 lines) |
| No `control-api.js` or `wrangler-control.toml` exists, so A6 is not built | `App/Ops/` listing |
| The sweep raises with `case_ref='EXC-S-'+12 hex`, `raised_via='ingest_auto'`, `owner_role` from the registry, and an audit row with **`subject_id = CAST(exception_id AS TEXT)`** | `ops-api.js` 1094–1124 |
| The sweep's dedupe pre-check matches **any** row with that `dedupe_key`, whatever its status | `ops-api.js` 1070–1076 |
| 6 open sev3 cases since 13 Oct 16:36Z: `job_failed` ×3 and `job_missed` ×3, all `local.entities-enrich-boost` | 002a Report, Tue 13 |
| `entity_exceptions`: 3 rows from 015b and 6 rows from 015c (9 known; rows added later through `POST /exceptions` are unknown) | `migrations/ma-sep-015b-entity-exceptions.sql`, `ma-sep-015c-seed-known-issues.sql` |
| The `/admin/exceptions` residue: `checkAdminExceptionsAuth()` always returns false. Its handlers still reference the dropped `entity_merge_exceptions`. CORS still allows `X-Admin-Exceptions-Secret`. | `entities-api.js` 8–15, 547–672, 1273–1286 |
| `verifyAccessJwt()` in entities-api is used only by the `/exceptions` routes | `entities-api.js` grep |
| KI 22.27's tools (`export-exceptions-snapshot.mjs`, `.command`) are gone. The gitignored output `entity-exceptions-snapshot.html` and the local `.env.admin-exceptions` are still present. | disk listing (the `.env` file was not opened) |
| `entity_enrichment_queue` index: `idx_enrich_queue_status(status, retry_after)`. `lookup_method` is not indexed. | `migrations/corporate-atlas-v1.sql` |

### 0.2 Deviations from earlier specs (each needs reviewer acceptance)

| # | Earlier text | This spec | Reason |
|---|---|---|---|
| DV-1 | 001 §5.2: `ops_case_event.subject_id` = `case_ref` | **`subject_id` = `CAST(exception_id AS TEXT)` for `exception`, `CAST(ticket_id AS TEXT)` for `dq_ticket`.** `case_ref` is carried in `payload` only where useful. | The live sweep already writes the numeric id (002 §7.2), and the table's triggers forbid fixing those rows. One convention beats two. Both ids are immutable. |
| DV-2 | 001 §5.4 step 3: the `migrated` event's actor is the operator's Access identity | `actor='ops_lead:wrangler'`, `actor_source='system'`; `payload` holds the file SHA-256 and the commit | The migration runs through `wrangler --file`, so no JWT is present. The precedent is `ops_job_pause.created_by='ops_lead:wrangler'` (002 §6.3). |
| DV-3 | 001 §5.4: `object_key` = `entity_id_a` or the first entity id in `source_ref` | `bad_relationship_edge` uses `child_entity_id` (the ETF that carries the wrong parent) | That is the object a user would open. Data-Identity Lead to confirm. |
| DV-4 | 001 §5.4 maps `source_ref` into `object_ref` | `object_ref` = `{"source_table":…, "source_ref":<parsed JSON>}`, and **`source_record_ref` = the `source_ref` text verbatim** | Gives a usable JSON object and a byte-for-byte copy. |
| DV-5 | 002 §7.2: "the sweep never updates or closes a case" | The sweep may **auto-resolve `job_missed` only**, under its own switch (§9.4), if the Founder says yes (Q1) | 002 §6.3 handed replayed-slot closure to 003. This is the narrowest way to do it. |

---

## 1. Problem statement

Since 13 Oct the sweep has raised real operational exceptions (6 open, sev3), but nothing can move them: no transition, no owner, no resolution, no queue. They will pile up from four sweeps a day. Meanwhile the only working case tool, `/exceptions/ui` on `meridian-entities-api`, holds Entities data-quality decisions in an Entities-domain table, against D4 ("exceptions, data quality, system health … live in the backend"). Its dead `/admin/exceptions` predecessor still ships in the same Worker. Two queues, in two domains, with two auth models, is the fragmentation that October's scope closes.

## 2. Goals (measurable, checked at close-out)

1. **Every exception is workable:** 100% of `ops_exception` rows can be acknowledged, assigned, commented, resolved, dismissed and reopened through authenticated routes, and every change leaves one `ops_case_event` row (AC-1 to AC-7).
2. **No duplicate noise:** at most **one open case per (job, condition type)** at any time, and a persisting condition raises 0 new cases on later sweeps (AC-9).
3. **One queue:** all `entity_exceptions` rows are in Ops with `decided_by`, `decided_at` and `created_at` byte-identical (AC-12), and `/exceptions*` and `/admin/exceptions*` answer 410 with **0** writes to `entity_exceptions` after the freeze (AC-14).
4. **GLEIF health is visible:** E1, E2, E4, E5 and E6 are raised by the sweep inside the existing caps, and E3 is on record as a case (AC-10).
5. **Inside budget:** the sweep stays ≤ 1,000 reads per call, admin case routes ≤ 250 reads per call, and steady writes ≤ 150 a day (AC-16).

## 3. Non-goals

| Not in 003 | Why / where |
|---|---|
| The operator console UI | MA-OCT-005 (`ma-ops.js`). 003 is backend only. |
| DQ ticket lifecycle, ticket types, the consumer "raise a ticket" path, the 007 prefill page | **MA-OCT-004.** 003 only *migrates* legacy DQ rows (status `open`/`resolved`, as 001 §5.4 says) and shows linked tickets read-only. |
| Raising exceptions at ingest time | The sweep already raises `job_failed:<run_id>` within ≤ 6 h. A second raiser would need the same deterministic ref and adds a write to the hot path for no clear need. |
| Email, Slack or push notification on transitions | 002 §7.4: macOS notification only, from the sweep. Transitions are silent. |
| Dropping `entity_exceptions` | Founder Q2. Kept and frozen in October. |
| Automatic GLEIF-E3 detection | It needs an Entities-domain index (a CR) or about 66k reads per check (§9.3). |
| Exceptions raised from consumer screens | D4: consumer screens may only raise **DQ tickets** (004). |

## 4. User stories

- As the **Operations Lead**, I want one queue of open exceptions sorted by severity and age, so that I triage the worst first.
- As the **Operations Lead**, I want to acknowledge a case and assign it to a role, so that the sweep's raise has a named owner.
- As the **Founder**, I want to resolve a case with a reason code and a note, and reopen it if it comes back, so that the record shows what was decided and by whom (a verified identity).
- As the **Data-Identity Lead**, I want the 9 legacy `entity_exceptions` decisions in Ops with their original `decided_by` and `decided_at`, so that the 2014-spinoff `do_not_merge` decision and the KI 22.9 `accepted_no_fix` decisions keep their provenance.
- As the **Data-Identity Lead**, I want GLEIF no-progress, stuck-queue, frozen-source and auth-failure conditions raised automatically, so that 006's catalogue is watched without me reading logs.
- As the **Operations Lead**, I want a replayed boost fire to close its own `job_missed` case, so that the queue reflects reality after the outbox replays (Q1).
- *Edge:* As the **Operations Lead**, when two of my browser tabs act on the same case, I want the second action rejected with the case's current state, not silently applied.
- *Edge:* As the **Founder**, I want an accepted risk (for example, the known `name_search` backlog) to stay quiet for 30 days after I accept it, not re-raise every morning.

---

## 5. What is live, and what 003 assumes

| Item | State on 14 Oct | 003 assumption |
|---|---|---|
| `ops_*` tables (001) | Live | Used as they are. One index added (§6). |
| Sweep + health-check (002a A3) | Live; 6 open cases | Extended (§9), with the R-E raise contract unchanged |
| Outbox replay (002a A4) | Live from 14 Oct | Feeds the auto-resolve (§9.4) |
| `meridian-ops admin` Access app (001) | Live, own AUD `7f1b67…` | All 003 routes sit under `/api/ops/admin/` |
| **A6 `meridian-control` split** | **Not built** | **Prerequisite** (§16). Routes stay on `meridian-ops` either way, because `ops_*` writes belong to `meridian-ops` alone (002 §13). |
| `/exceptions` Access app (015b), AUD `af2ac4…` | Live, Founder only | Policy set to **Block** at the freeze, deleted on 31 Oct |
| 011 run window 17–24 Oct; F-5 account ceiling 60,000 (ML-1012-1) | Scheduled | Every remote write step reads `d1-today` first and stops if `rows_written + step estimate > 60,000` |

---

## 6. Schema (Ops domain)

**Domain declaration (CLAUDE.md new-table rule):** no new table. Every write lands in Ops-domain tables written only by `meridian-ops`, apart from the reviewed `wrangler --file` batches (M1, M2), which follow the 001 kill-switch and 002 pause precedent. `entity_exceptions` (Entities) and `entity_enrichment_queue` (Entities) are **read only**.

**Migration `App/Ops/migrations/004-ops-cases.sql`** (additive, `IF NOT EXISTS`, dry-run with `--local` first):

```sql
-- MA-OCT-003. Domain: Ops. Owner: Operations Lead. Only writer: meridian-ops.
-- Serves case detail: "DQ tickets linked to this exception" (§8.2 C-1) as an index seek
-- instead of a scan. Also used by 004's link action. ≤ 1,000 rows at 12 months.
CREATE INDEX IF NOT EXISTS idx_ops_dq_linked_exc
  ON ops_data_quality_ticket(linked_exception_ref);
```

Cost: index build over the current DQ table (0 rows before M1) is about 0 writes. Every later DQ insert carries 1 more index row.

**Columns:** none added. Acknowledgement time, assignment history and reopen counts are read from `ops_case_event`.

**Vocabularies (Worker-validated, as 001 intends; `src/cases.js` constants):**

| Field | Values |
|---|---|
| `status` | `open`, `acknowledged`, `resolved`, `dismissed` |
| `severity` | `sev1`, `sev2`, `sev3`, `sev4` |
| `resolution` (on `resolved`) | `fixed`, `replayed`, `transient`, `accepted_risk`, `superseded` |
| `resolution` (on `dismissed`) | `false_positive`, `duplicate` (needs `duplicate_of`), `not_actionable` |
| `exception_type` | from 002: `job_missed`, `job_lost`, `job_failed`, `job_frozen`, `hold_active`, `budget_risk`, `schedule_drift`, `sweep_overflow`. **New in 003:** `gleif_no_progress` (E1), `gleif_stuck_in_progress` (E2), `gleif_orphaned_backlog` (E3), `gleif_frozen_source` (E4), `local_auth_failure` (E5), `blind_guard` (E6), and `manual` (console-raised, for anything else) |
| `ops_case_event.event_type` (exception subject) | `raised`, `created`, `acknowledged`, `assigned`, `commented`, `severity_changed`, `resolved`, `dismissed`, `reopened`, `auto_resolved`. Migration (DQ subject): `created`, `decision_recorded`, `migrated` |
| `raised_via` | `ingest_auto` (sweep), `ops_console` (POST create), `migration` |
| `owner_role` | the Addendum §2 role names |

**Severity meaning:** sev1 = the platform is at risk now (D1 headroom < 5k, data corruption). sev2 = a weekly job missed or lost, repeated failures, a hold in force, sweep overflow. sev3 = a single failure or miss, a GLEIF condition. sev4 = informational.

---

## 7. Workflow

### 7.1 Transitions

| From | Action | To | Required | Event |
|---|---|---|---|---|
| `open` | `acknowledge` | `acknowledged` | — | `acknowledged` |
| `open`, `acknowledged` | `assign` | same | `owner_role` and/or `assignee` (email) | `assigned` (from/to in the event) |
| any | `comment` | same | `note` (≤ 2,000 chars) | `commented` |
| `open`, `acknowledged` | `set_severity` | same | `severity`, `note` | `severity_changed` |
| `open`, `acknowledged` | `resolve` | `resolved` | `resolution` (resolved set), `note` | `resolved` |
| `open`, `acknowledged` | `dismiss` | `dismissed` | `resolution` (dismissed set), `note`; `duplicate_of` if `duplicate` | `dismissed` |
| `resolved`, `dismissed` | `reopen` | `open` | `note` | `reopened`. `resolution`, `resolved_by` and `resolved_at` are cleared and kept in the event's `from_value` / `payload` |
| `open`, `acknowledged` | *(sweep)* auto-resolve | `resolved` | `job_missed` only (§9.4) | `auto_resolved` |

Anything else returns `409 {"error":"illegal_transition","current":{…}}`. `resolved_by` is set to the verified actor, never to a body field.

### 7.2 Ownership and triage targets

- **Default owner:** the sweep already sets `owner_role` from `ops_job_registry.owner_role`. Platform cases with no job (`hold_active`, `budget_risk`, `sweep_overflow`) default to **Operations Lead**. Console-created cases must name one.
- **Assignee:** a verified Access email or `service:<name>`. It is not checked against a user list, because Access is the user list.
- **Triage targets (display only; 0 writes, no alerts):** acknowledge within sev1 4 h, sev2 24 h, sev3 72 h, sev4 no target. The list route returns `age_h` and `overdue: true/false`. Overdue is computed from `opened_at` while `status='open'`.
- **Routes for triage and resolution (Access-protected):** `meridian-ops` `/api/ops/admin/*` (§8). The console (005) is the human client. Until then, the Founder can use the browser (GETs work directly; POSTs through the dev-tools console on the authenticated origin), or a scripted caller with an Access service token (Founder Q3).

---

## 8. Routes and authentication

### 8.1 Endpoint budget (001 §10 split rule: 15)

| | Before | After A6 | After 003 | After 004 (planned) |
|---|---|---|---|---|
| `meridian-ops` endpoints | 15 | 7 | **11** | 14 (004: list tickets, create ticket, link-out page) |

The two **shared** case routes (C-1, C-2) dispatch on the `case_ref` prefix, so 004 adds no detail or action routes of its own (Architect RQ-2).

### 8.2 The four routes (all behind Access app "meridian-ops admin", with the Worker re-verifying the JWT as in 001 §6.2)

| # | Method + path | Purpose |
|---|---|---|
| E-1 | `GET /api/ops/admin/exceptions` | Queue. `?status=` (default `open,acknowledged`), `severity`, `type`, `job_id`, `limit` (≤ 100, default 50), `cursor` (keyset). |
| E-2 | `POST /api/ops/admin/exceptions` | Manual create. Body: `exception_type`, `severity`, `title` (≤ 200), `summary` (≤ 500), `owner_role`, and optional `job_id` (must exist), `run_id` (fills `run_snapshot`), `object_domain`/`object_key` (001 §5.3 rules), `request_id`. |
| C-1 | `GET /api/ops/admin/cases/:case_ref` | Detail for any case. Prefix `EXC-` → `ops_exception`, `DQ-` → `ops_data_quality_ticket`. Returns the row, events (≤ 200, oldest first), the registry row for `job_id`, run rows for `run_id` (if not pruned), linked DQ tickets (for an exception) or the linked exception (for a DQ ticket). |
| C-2 | `POST /api/ops/admin/cases/:case_ref/action` | Transitions (§7.1). Body: `action`, `expected_status`, `request_id` (UUID), plus the fields the action needs, and optional `actor_role` (a label). **003 implements the exception kind.** A `DQ-` ref returns `409 {"error":"dq_actions_arrive_with_ma_oct_004"}` until 004 extends the same engine. |

**Manual `case_ref`:** `EXC-` + `printf('%06d', exception_id)`. In one batch: `INSERT … case_ref = 'EXC-PENDING-' || request_id`, then `UPDATE ops_exception SET case_ref = 'EXC-' || printf('%06d', exception_id) WHERE case_ref = ?`, then the `created` event. The `EXC-`, `EXC-S-` and `EXC-M-` spaces cannot collide: numeric ids are unique, and the other two always carry a letter segment.

**CORS:** none, same as all `/api/ops/admin/*` (001 §6.2). Error bodies never echo JWTs or headers.

### 8.3 Validation

- `case_ref` must match `^(EXC|DQ)-(S-[0-9A-F]{12,16}|M-\d{6}|\d{6})$`.
- `note` and `summary` are redacted with the 001 `redact()` before storage.
- `job_id` must exist in `ops_job_registry` (PK read).
- `object_key` format is checked per domain (001 §5.3).

### 8.4 Atomicity, concurrency and idempotency

One `db.batch()` per action:

```sql
-- (1) guarded state change; :now is unique per request (ms ISO + request_id in the event)
UPDATE ops_exception
   SET status = :to, severity = COALESCE(:sev, severity), owner_role = COALESCE(:role, owner_role),
       assignee = COALESCE(:assignee, assignee), resolution = :resolution,
       resolved_by = :resolved_by, resolved_at = :resolved_at, updated_at = :now
 WHERE case_ref = :ref AND status = :expected_status;
-- (2) audit row only if (1) applied
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, payload,
                                      actor, actor_source, actor_role, occurred_at, idempotency_key)
SELECT 'exception', CAST(exception_id AS TEXT), :event, :expected_status, :to, :note, :payload,
       :actor, :actor_source, :actor_role, :now, 'act:' || :request_id
  FROM ops_exception WHERE case_ref = :ref AND updated_at = :now AND status = :to;
```

- `changes = 0` on (1): re-read the row. If an event with `idempotency_key = 'act:'||request_id` exists, return **200 with the current state** (a replay). Otherwise return **409** with the current state (a stale `expected_status`).
- **The `SET` list is chosen per action; it is not one generic statement.** Only `resolve`, `dismiss` and `reopen` write `resolution`, `resolved_by` and `resolved_at` (`reopen` sets them to NULL). Every other action leaves those columns out of `SET`, so a comment on a resolved case keeps its resolution. The template above shows the union of columns.
- `comment` uses the same shape, with `status` unchanged, so concurrent comments also serialise on `updated_at`.
- `request_id` is **required** on E-2 and C-2 (400 without it).
- `actor` and `actor_source` come from the JWT (`access_jwt` or `access_service_token`), never from the body.

---

## 9. Sweep extensions (auto-raise)

The R-E raise contract (002 §7.2: deterministic `EXC-S-`, a dedupe pre-check, `INSERT OR IGNORE` plus one `raised` event) is **unchanged**. The extensions below run inside the existing per-call cap (20) and daily cap (100), and the existing switches still apply.

### 9.1 One open case per (job, condition)

**Condition types:** `job_frozen`, `gleif_no_progress`, `gleif_stuck_in_progress`, `gleif_frozen_source`, `local_auth_failure`, `blind_guard`.

- Their `dedupe_key` becomes `<type>:<job_id>:<UTC date of detection>`. `job_frozen` keeps its cursor marker: `job_frozen:<job_id>:<cursor>:<date>`.
- Before raising, the sweep runs **S2** for each job that has a condition finding:

```sql
SELECT exception_type FROM ops_exception
 WHERE job_id = ?
   AND (status IN ('open','acknowledged')
        OR (status = 'resolved' AND resolution = 'accepted_risk' AND resolved_at >= ?))   -- now − 30 days
```

  Plan: `SEARCH ops_exception USING INDEX idx_ops_exception_job (job_id=?)`, bounded by the cases per job (≤ about 50 a year).
- If S2 returns the finding's type, the finding is suppressed. It counts in `already_open` and writes nothing.
- **Event-type findings** (`job_missed`, `job_lost`, `job_failed`, `sweep_overflow`) keep their per-slot or per-run keys. **Platform findings** (`hold_active`, `budget_risk`) keep their per-date keys: one case a day while the condition lasts is intended, because those are the costly states.
- **Effect:** a persisting condition gives one case. Resolving it as anything other than `accepted_risk` lets it re-raise the next day. `accepted_risk` silences it for 30 days.

### 9.2 L2 gains `error_class`

`L2_SQL` adds `error_class` to its column list. This costs 0 extra reads (same rows, same `idx_ops_job_run_job_at`).

### 9.3 GLEIF exception catalogue (006 §8.3)

`GLEIF_JOBS` is a code constant, like `WEEKLY_JOBS`: `cf.meridian-entities-enrich.phase1`, `cf.meridian-entities-enrich.phase23`, `local.entities-enrich-boost`, `cf.meridian-entities-delta`, and the 011 runner's job id once T-1 registers it.

| Code | `exception_type` | Rule in the sweep | Data and cost | Severity (006 → Ops) |
|---|---|---|---|---|
| E1 no-progress | `gleif_no_progress` | GLEIF job: its last **2** end events are `success`/`partial` with `items_attempted > 0` and `items_progressed = 0`. When E1 fires for a job, the F4 branch of `job_frozen` is skipped for that job (no double raise). | L2 rows; **0 extra reads** | High → **sev2** |
| E2 stuck in-progress | `gleif_stuck_in_progress` | `entity_enrichment_queue` has a row `in_progress` with `last_attempt` > 24 h old. Evaluated **once per UTC day**, on the first sweep with no earlier `local.health-check` end event today (known from L2). | `SELECT entity_id, last_attempt FROM entity_enrichment_queue WHERE status = 'in_progress' AND last_attempt < ? LIMIT 50` → expected `SEARCH … idx_enrich_queue_status (status=?)`; **≤ 50 reads** (read pack R3 confirms). Cross-domain **read** (Architect RQ-4). `job_id` = the registered owner of the queue's `in_progress` writes (Data-Identity Lead to name; expected `cf.meridian-entities-enrich.phase1`). | Medium → **sev3** |
| E3 orphaned backlog | `gleif_orphaned_backlog` | **Not automated.** A `GROUP BY lookup_method` over about 26.5k pending rows is about 66k reads per execution (ML 2.5 × N rule), and `lookup_method` has no index (Entities CR needed). **One case is seeded by M2** (§10.4), pointing at RC-1/H1 and MA-OCT-011. | R4 is EXPLAIN only | High → sev2 (seeded) |
| E4 frozen source | `gleif_frozen_source` | GLEIF job with registry `status = 'held'` and no `success` in `ops_job_run` for > 35 days (or none ever, with the registry row older than 35 days). Once a day. | `SELECT MAX(started_at) FROM ops_job_run WHERE job_id = ? AND event_type = 'success'` → `idx_ops_job_run_job_type_at`, 1 read per held job (≤ 5). **It cannot fire before about 5 Nov**, because the ledger and registry date from 1–12 Oct. This is by design. | Medium → **sev3** |
| E5 local auth failure | `local_auth_failure` | Any `local_schedule` job: its last **2** end events have `error_class` in `{wrangler_auth_10000, CF_API_10000}` | L2 rows (with §9.2); 0 extra reads | Medium → **sev3** |
| E6 blind guard | `blind_guard` | An end event with `detail.metrics.guard_blind = 1` | L2 rows; 0 extra reads. **Dormant**: A4 removed the boost's blind guard (F7), and no emitter sends the key today. 002b B4 may adopt it. | Low → **sev4** |

### 9.4 Auto-resolve of replayed `job_missed` (Founder Q1; switch `OPS_SWEEP_AUTORESOLVE`, default `"false"` until Q1 = yes)

- **Input:** open or acknowledged `job_missed` cases. Query: `SELECT case_ref, job_id, dedupe_key FROM ops_exception WHERE status IN ('open','acknowledged') AND exception_type = 'job_missed'` → `idx_ops_exception_queue (status=?)`, bounded by the open set (≤ 100).
- **Rule:** parse the slot from `dedupe_key`. If the slot is inside the lookback window and its lateness state is now `on_time` or `late` (a run matched it after replay), resolve the case.
- **Write:** §8.4's batch shape with:
  - `resolution = 'replayed'`;
  - `resolved_by = 'service:health-check-local'`;
  - `actor_source = 'ingest_key'`;
  - event `auto_resolved` with `idempotency_key = 'autoresolve:'||case_ref`;
  - the matched `run_id` in `payload`.
- **Caps:** ≤ 20 per call, counted separately from raises. A slot outside the window is never auto-resolved.

### 9.5 Sweep response additions

`auto_resolved: [case_ref…]`, `suppressed: n`, `gleif_checks: {e2: n|null, e4: n|null}`.

---

## 10. `entity_exceptions` migration (Addendum §4; CR-003-1)

### 10.1 Mapping (rows go by type; DQ types per Addendum §4 and 001 §5.4)

| `exception_type` | Target | Notes |
|---|---|---|
| `entity_merge`, `bad_relationship_edge`, `isin_duplicate` | `ops_data_quality_ticket`, `case_ref = 'DQ-M-' \|\| printf('%06d', id)` | 004 owns their lifecycle after migration |
| **any other value** | **STOP.** Not migrated by M1. | The Data-Identity Lead and Operations Lead classify it. The operational kind goes to `ops_exception` as `EXC-M-nnnnnn` through a spec delta. The read pack shows whether this case exists. |

| `entity_exceptions` | `ops_data_quality_ticket` |
|---|---|
| `id` | `legacy_source = 'entity_exceptions'`, `legacy_id = CAST(id AS TEXT)` |
| `exception_type` | `ticket_type` (verbatim) |
| `source_table`, `source_ref` | `object_ref = json_object('source_table', source_table, 'source_ref', json(source_ref))`; **`source_record_ref = source_ref` (verbatim text)**; `source_system = 'entity_exceptions'` |
| — | `object_domain = 'entity'`; `object_key` = first non-null of `$.child_entity_id`, `$.entity_id_a`, `$.entity_ids[0]`, `$.isins[0].entity_ids[0]` (as text) |
| `flagged_reason` | `summary` |
| `evidence`, `proposed_resolution` | same columns |
| `decision` | `disposition` (verbatim); `status = CASE decision WHEN 'pending' THEN 'open' ELSE 'resolved' END` |
| `corporate_action_note` | `resolution_note` |
| `decided_by`, `decided_at` | `resolved_by`, `resolved_at` (**verbatim**; NULL stays NULL) |
| `created_at` | `opened_at` (**verbatim**, `'YYYY-MM-DD HH:MM:SS'` format kept as is) |
| — | `title = ticket_type \|\| ' (legacy #' \|\| id \|\| ')'`; `severity = 'sev3'`; `owner_role = 'Data-Identity Lead'`; `raised_by = 'legacy:entity_exceptions'`; `raised_via = 'migration'` |

### 10.2 M1 — `App/Ops/migrations/m1-entity-exceptions-to-ops.sql` (one `--file` batch, idempotent)

```sql
-- Guard (runbook step, not in the file): SELECT COUNT(*) FROM entity_exceptions
--   WHERE exception_type NOT IN ('entity_merge','bad_relationship_edge','isin_duplicate')  → must be 0, else STOP.
INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref,
   source_system, source_record_ref, evidence, proposed_resolution, disposition, resolution_note,
   resolved_by, resolved_at, owner_role, raised_by, raised_via, legacy_source, legacy_id, opened_at, updated_at)
SELECT 'DQ-M-' || printf('%06d', e.id), e.exception_type, 'sev3',
       CASE e.decision WHEN 'pending' THEN 'open' ELSE 'resolved' END,
       e.exception_type || ' (legacy #' || e.id || ')', e.flagged_reason, 'entity',
       CAST(COALESCE(json_extract(e.source_ref,'$.child_entity_id'), json_extract(e.source_ref,'$.entity_id_a'),
                     json_extract(e.source_ref,'$.entity_ids[0]'), json_extract(e.source_ref,'$.isins[0].entity_ids[0]')) AS TEXT),
       json_object('source_table', e.source_table, 'source_ref', json(e.source_ref)),
       'entity_exceptions', e.source_ref, e.evidence, e.proposed_resolution, e.decision, e.corporate_action_note,
       e.decided_by, e.decided_at, 'Data-Identity Lead', 'legacy:entity_exceptions', 'migration',
       'entity_exceptions', CAST(e.id AS TEXT), e.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM entity_exceptions e
 WHERE e.exception_type IN ('entity_merge','bad_relationship_edge','isin_duplicate');

-- Event 1: created (original time)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'created', 'legacy:entity_exceptions', 'legacy_migration', e.created_at,
       json_object('case_ref', t.case_ref, 'legacy_id', e.id), 'mig:entity_exceptions:' || e.id || ':created'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT);

-- Event 2: decision_recorded (only for decided rows; decided_by verbatim as actor)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'decision_recorded', e.decision, e.corporate_action_note,
       COALESCE(e.decided_by, 'legacy:unrecorded'), 'legacy_migration', COALESCE(e.decided_at, e.created_at),
       json_object('decided_by', e.decided_by, 'decided_at', e.decided_at), 'mig:entity_exceptions:' || e.id || ':decision'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT)
 WHERE e.decision <> 'pending';

-- Event 3: migrated (now; DV-2)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'migrated', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('packet','MA-OCT-003','file','m1-entity-exceptions-to-ops.sql','file_sha256','<filled at build>','commit','<filled at build>'),
       'mig:entity_exceptions:' || e.id || ':migrated'
  FROM entity_exceptions e JOIN ops_data_quality_ticket t
    ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT);
```

The joins use `UNIQUE(legacy_source, legacy_id)` (autoindex), and `entity_exceptions` is read in full (9 rows, a declared bounded scan). Re-running the file inserts 0 rows (AC-13).

### 10.3 Freeze, dump, migrate, verify (runbook; build day Thu 22)

1. **Founder:** in Zero Trust, set the policy of the Access app covering `meridian-entities-api…/exceptions` to **Block**. Verify that `GET /exceptions/ui` now returns Access's 403. (No deploy; reversible.)
2. **Dump:** `wrangler d1 execute meridian-etf --remote --json --command "SELECT * FROM entity_exceptions ORDER BY id"` → `App/Corporate Atlas/logs/ma-oct-003-pre-migration-entity_exceptions-<UTC>.json` (gitignored). Record its SHA-256 and row count in the build report. **Never paste row contents into reports** (they contain identities).
3. Run the guard. Read `d1-today` (F-5: stop if `rows_written + 300 > 60,000`).
4. `--local` dry-run against a local copy built from the 015b and 015c files, then `--remote --file m1-…sql`.
5. **Verify** (V1–V4, ≤ 200 reads):
   - V1: the row counts match.
   - V2: byte-for-byte:
     ```sql
     SELECT COUNT(*) FROM entity_exceptions e
       JOIN ops_data_quality_ticket t
         ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT)
      WHERE t.resolved_by IS NOT e.decided_by
         OR t.resolved_at IS NOT e.decided_at
         OR t.opened_at IS NOT e.created_at
         OR t.disposition IS NOT e.decision
         OR t.source_record_ref IS NOT e.source_ref
     ```
     Expect **0**.
   - V3: the events: `created` = N, `decision_recorded` = the decided count, `migrated` = N.
   - V4: re-run the file → `changes = 0` on all 4 statements.
6. Run step 2 again **on Sat 24, before retirement**. The dump must be byte-identical to step 2's (proof that nothing was written after the freeze).

### 10.4 M2 — seeded E3 case (same day, same `--file` discipline, ≤ 10 writes)

```sql
INSERT OR IGNORE INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, owner_role,
                                     raised_by, raised_via, dedupe_key)
VALUES ('EXC-M-000001', 'gleif_orphaned_backlog', 'sev2', 'open',
        'GLEIF-E3: name_search queue rows have no consumer (RC-1/H1)',
        '006 H1 CONFIRMED: ~26k pending name_search rows, no consumer in code. Remediation: MA-OCT-011 bucket A (run 17–23 Oct). Not auto-detected (needs an Entities index; MA-OCT-003 §9.3).',
        'cf.meridian-entities-enrich.phase1', 'Data-Identity Lead', 'ops_lead:wrangler', 'ops_console',
        'gleif_orphaned_backlog:name_search');
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
SELECT 'exception', CAST(exception_id AS TEXT), 'created', 'ops_lead:wrangler', 'system',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'created:gleif_orphaned_backlog:name_search'
  FROM ops_exception WHERE dedupe_key = 'gleif_orphaned_backlog:name_search';
```

`EXC-M-` is reserved for cases written by a migration or seed file. M2 uses `raised_via='ops_console'` because a person decided it. The Data-Identity Lead confirms the wording and the `job_id`.

### 10.5 Retirement and residue removal (one `meridian-entities-api` deploy, ≥ Sat 24 Oct 08:05 UTC)

Precondition: §10.3 step 6 passed, and the deployed version equals the repo (C1 method, 002 §10.2).

| # | Change | File / place |
|---|---|---|
| R-1 | Delete the `/exceptions`, `/exceptions/ui` and `/exceptions/:id` dispatch, their handlers, `entityExceptionsUiHtml()`, `ENTITY_EXCEPTIONS_COLUMNS`, and `verifyAccessJwt()` with its JWKS helpers, **if a grep shows no other caller** | `App/Corporate Atlas/src/entities-api.js` |
| R-2 | Delete the `/admin/exceptions` residue: lines 547–672 (`checkAdminExceptionsAuth`, list, add and edit handlers on the dropped `entity_merge_exceptions`) and dispatch 1273–1286 (KI 22.23, 22.27) | same |
| R-3 | One **rule** (not an endpoint): any path equal to or under `/exceptions` or `/admin/exceptions` returns `410 {"error":"gone","moved_to":"meridian-ops /api/ops/admin/cases (MA-OCT-003)"}`, writing nothing. It is removed in November. | same |
| R-4 | CORS: drop `X-Admin-Exceptions-Secret` and `Cf-Access-Jwt-Assertion` from allowed headers. Drop `POST`/`PUT` from allowed methods if a grep shows no other caller. | same |
| R-5 | Remove `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` from `[vars]` (no caller after R-1) | `wrangler-entities-api.toml` |
| R-6 | `wrangler secret list --name meridian-entities-api`. If an `ADMIN_EXCEPTIONS_SECRET`-style secret exists, `wrangler secret delete` it. Names only; **values are never printed.** | Cloudflare |
| R-7 | Delete the local `App/Corporate Atlas/.env.admin-exceptions` (never opened) and the gitignored `entity-exceptions-snapshot.html` (holds legacy rows). The deletes need the Founder's approval (bridge delete permission, or the local lane). | disk |
| R-8 | Registry: `cf.meridian-entities-api` `owner_role` drops "/ Operations Lead for /exceptions until MA-OCT-003" (a guarded UPDATE plus an audit row, `registry-load-<date>.sql`) | `App/Ops/migrations/` |
| R-9 | Static check: after the edit, a grep for `entity_merge_exceptions`, `X-Admin-Exceptions-Secret`, `entityExceptionsUi`, `/admin/exceptions` and `handleListEntityExceptions` across `App/` and `docs/` returns only `migrations/*.sql` history and the R-3 rule | build test |
| R-10 | **Founder, 31 Oct:** after 7 days of 410s with no complaint, delete the blocked `/exceptions` Access app | Zero Trust |

**Coordination:** 007 Phase 1 and 2 may also change `entities-api.js`. The retirement is **its own commit**, and the 24 Oct deploy ships whatever the repo holds at that commit. Both lanes' changes must already be reviewed (the Main Lane sequences them; dependency D-4).

---

## 11. D1 budget and the three-point check

Counting basis as in 011 §9: INSERT = 1 + 1 per index holding the row; UPDATE = 1 + 1 per index whose key changes.

### 11.1 Writes

| Source | Per unit | Volume | Per day / one-time |
|---|---|---|---|
| Action (status change): UPDATE ≈ 2 (queue index) + event 3 (row, subject idx, idempotency idx) | ≈ 5 | ≤ 30 a day expected | **≤ 150 / day** |
| Manual create: INSERT ≈ 7 + case_ref UPDATE 2 + event 3 | ≈ 12 | ≤ 3 a day | ≤ 36 / day |
| Sweep auto-resolve | ≈ 5 | ≤ 20 per call, typically 0–3 | ≤ 100 per call worst case |
| Sweep condition raises | unchanged (002: ≤ 250 per call, ≤ 1,000 a day) | — | — |
| **M1 (one time)** | ticket ≈ 8 (row + 7 indexes); events ≈ 3 each × ≈ 2.8 | 9 known rows → ≈ 72 + ≈ 75 | **≈ 150**. **Abort and re-spec if R1 shows > 100 rows.** |
| M2 + registry R-8 + 004 index | — | — | ≤ 25 |

### 11.2 Reads and query plans (to confirm by EXPLAIN at build)

| Query | Expected plan | Rows read |
|---|---|---|
| E-1 default queue | `SEARCH ops_exception USING INDEX idx_ops_exception_queue (status=?)` ×2 statuses, ordered by severity, opened_at; keyset | ≤ limit + 1 per status (≤ 102) |
| E-1 `?job_id=` | `SEARCH … idx_ops_exception_job (job_id=?)` | ≤ cases per job |
| E-1 closed statuses | `SEARCH … idx_ops_exception_queue (status=?)` over resolved/dismissed, declared bounded (≤ 500 a year) | ≤ 500 |
| C-1 case | `SEARCH … sqlite_autoindex_ops_exception_1 (case_ref=?)` | 1 |
| C-1 events | `SEARCH ops_case_event USING INDEX idx_ops_case_event_subject (subject_type=? AND subject_id=?)` LIMIT 200 | ≤ 200 |
| C-1 registry / runs | PK; `sqlite_autoindex_ops_job_run_1 (run_id=?)` | ≤ 3 |
| C-1 linked DQ | `SEARCH ops_data_quality_ticket USING INDEX idx_ops_dq_linked_exc (linked_exception_ref=?)` | ≤ 20 |
| C-2 action | unique-index probes | ≤ 5 |
| Sweep S2 suppression | `idx_ops_exception_job (job_id=?)` | ≤ 50 × jobs with findings (≤ 5) |
| Sweep auto-resolve input | `idx_ops_exception_queue (status=?)` | ≤ 100 |
| Sweep E2 (daily) | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` | ≤ 50 (R3) |
| Sweep E4 (daily) | `idx_ops_job_run_job_type_at` | ≤ 5 |
| M1 + verification | `entity_exceptions` full (9 rows), autoindex joins | ≤ 200 total |

**Per-call maxima:** C-1 ≤ 230; E-1 ≤ 500 (closed history), typically ≤ 102; sweep: today's 88–96 plus at most about 450, so **≤ 1,000** (002 §7.3 holds).

**Daily:** the console at about 100 calls is ≤ about 3k reads, plus the sweep at about 4k. That is under 0.2% of 5M.

### 11.3 Three-point check

| Point | Result |
|---|---|
| 1. Index audit | Every query above is a `SEARCH` on a named index or a declared bounded scan (`entity_exceptions` 9 rows; closed cases ≤ 500). No query touches `fundholdingsmonthly` or `entity_master`. **One new index** (§6). E3 was dropped from automation **because** it fails point 1. |
| 2. Single-execution read test < 50k | Max ≈ 1,000 (a sweep). Checked at build by remote EXPLAIN and one measured `rows_read` per route (AC-16). |
| 3. Read/write budget per invocation | §11.1–§11.2. Build writes ≤ 500 (M1 + M2 + R-8 + tests); steady ≤ 150 a day. |

**Kill switches (fastest first):**

| Switch | Effect | Cost |
|---|---|---|
| `OPS_CASES_ENABLED="false"` + deploy | E-1, E-2, C-1 and C-2 return 503 before any D1 access | — |
| `OPS_SWEEP_AUTORESOLVE="false"` | Turns off §9.4 | No D1 reads |
| `OPS_SWEEP_GLEIF_CHECKS="false"` | Turns off E1, E2, E4, E5 and E6 | No D1 reads |
| The existing 002 sweep switches | As in 002 | — |

---

## 12. Worker size

| File | Today | After A6 | After 003 |
|---|---|---|---|
| `src/ops-api.js` | 1,213 | ≈ 980 (governance handlers out) | ≈ 1,100 (sweep extensions + router lines) |
| `src/cases.js` (new module, imported like `lateness.js`) | — | — | ≈ 450 (routes, the transition engine, validation; 004 extends it) |
| `src/lateness.js` | 263 | 263 | ≈ 280 (exposes slot matching for auto-resolve) |

Every file stays under 1,500 lines, and the Worker has 11 endpoints (4 left after 003, 1 after 004).

---

## 13. Requirements

**P0 (must ship by 23 Oct, apart from retirement on 24 Oct):**
- R1 Migration `004-ops-cases.sql` (§6).
- R2 Routes E-1, E-2, C-1 and C-2 (exception kind) with the §7 workflow, §8.4 atomicity and the Access auth matrix.
- R3 Sweep: §9.1 suppression and snooze, §9.2, E1, E2, E4, E5 and E6, and the kill switches.
- R4 M1 + M2, with the freeze, dump and verification runbook.
- R5 Retirement and residue removal R-1 to R-9 (≥ 24 Oct). R-10 on 31 Oct.
- R6 Tests (§15) and the build report.

**P1:** §9.4 auto-resolve (code ships behind its switch whatever Q1's answer). The `overdue` display flag.

**P2 (design allows it, not built):** an automatic E3 once an Entities index exists; ingest-time raise using `sweepCaseRef()`; an email channel; the `entity_exceptions` drop (November).

---

## 14. Acceptance criteria (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | No `Cf-Access-Jwt-Assertion`, or a JWT with the wrong AUD | Any of E-1, E-2, C-1 or C-2 is called | 401. No CORS headers. Table counts unchanged. |
| AC-2 | An open sweep case | `acknowledge` with `expected_status=open` | Status `acknowledged`. Exactly 1 `acknowledged` event with `actor` = the JWT email and `actor_source='access_jwt'`. |
| AC-3 | Two requests with the same `expected_status` | Both are sent | One 200, one 409 carrying the current state. 1 event. |
| AC-4 | A request that succeeded | The same `request_id` is sent again | 200 with the same state. 0 new events. |
| AC-5 | An open case | `resolve` without `resolution`, or with a code from the dismissed set | 400. Nothing written. |
| AC-6 | A resolved case | `reopen` with a note | Status `open`. `resolution`, `resolved_by` and `resolved_at` are NULL. The `reopened` event's payload keeps the prior values. |
| AC-7 | A valid manual create | E-2 | `case_ref` matches `EXC-\d{6}`. `raised_via='ops_console'`. 1 `created` event. An unknown `job_id` → 422. |
| AC-8 | Case EXC-S-… with linked DQ tickets (004 test fixture) | C-1 | Returns the row, events oldest first, the registry row and the linked tickets. Plan uses `idx_ops_dq_linked_exc`. |
| AC-9 | A job frozen across 3 consecutive sweeps | The sweeps run | 1 case is raised, and the later sweeps report it as `suppressed`. After `resolve accepted_risk`, 0 raises for 30 days. After `resolve fixed`, the next day's sweep raises a new case if the condition persists. |
| AC-10 | Fixtures: a GLEIF job with 2 zero-progress successes; a queue row `in_progress` > 24 h; a held GLEIF job with no success > 35 d; 2 local auth failures; a `guard_blind=1` event | A sweep runs | E1 sev2, E2 sev3, E4 sev3, E5 sev3 and E6 sev4 are raised once each. No `job_frozen` for the E1 job. M2's E3 case exists. |
| AC-11 | A `job_missed` case and a later replayed run that matches its slot | A sweep runs with `OPS_SWEEP_AUTORESOLVE="true"` | Case `resolved`, `resolution='replayed'`, 1 `auto_resolved` event naming the run. With `"false"`, unchanged. |
| AC-12 | The freeze is in force and the dump is taken | M1 runs remotely | V1 counts equal. **V2 = 0 mismatches** (`decided_by`, `decided_at`, `created_at`, `decision`, `source_ref` byte-identical). V3 event counts as expected. |
| AC-13 | M1 has run | M1 runs again | 0 changes on all statements |
| AC-14 | Retirement is deployed | `GET`, `POST` and `PUT` on `/exceptions`, `/exceptions/ui`, `/exceptions/1` and `/admin/exceptions` | 410 and 0 D1 access. The Sat 24 dump equals the Thu 22 dump. `/api/entities/*` responses are unchanged (smoke test on 3 routes). |
| AC-15 | Retirement is deployed | The R-9 grep and the `wrangler secret list` | Only history hits. No admin-exceptions secret remains. The `.env.admin-exceptions` and snapshot files are absent. |
| AC-16 | Production | Each route is called once, and one sweep runs | `rows_read`: E-1 ≤ 102, C-1 ≤ 230, C-2 ≤ 5, sweep ≤ 1,000. Remote EXPLAIN matches §11.2. |

---

## 15. Test plan (order)

1. **`App/Ops/tests/cases-contract.mjs`** (`node:sqlite`, the real migrations 002–004, the registry load, the real `ops-api.js` and `cases.js`): AC-1 to AC-8. JWTs are signed with a locally generated RS256 key pair, and the JWKS fetch is stubbed (no network). If the existing `admin-jobs-lateness.test.mjs` already has a JWT harness, reuse it.
2. **`App/Ops/tests/migration-m1.mjs`:** builds `entity_exceptions` from the real 015b and 015c SQL files (9 rows), runs M1, then checks V1–V4, AC-12 and AC-13. Unknown-type fixture: the guard returns 1, and the runbook stops. Malformed `source_ref` fixture: the statement fails and nothing is partially inserted.
3. **`sweep-contract.mjs` extended** (23 cases today): AC-9 to AC-11, the caps (20 a call and 100 a day, still counted with auto-resolves kept separate), and the switches.
4. **`App/Corporate Atlas/tests/entities-api-retirement.mjs`:** the R-9 static greps; a stub fetch to every retired path → 410; a smoke test on `/api/entities/search`, `/isin/:isin` and `/:id`.
5. **Remote, in this order:** 004 index → `meridian-ops` deploy → AC-1 (production) → AC-16 → Founder freeze → M1 → AC-12/13 → M2.
   - The production AC-2 to AC-4 checks are run by the Founder from the browser console on the authenticated `meridian-ops` origin, or by a lane holding a service token (Q3).
   - Retirement on Sat 24 → AC-14 and AC-15.

---

## 16. Build plan (Claude Code, LANE-1-ENG; only LANE-1-ENG commits, per ML-1012-2)

**Every remote step:**
- reads `d1-today` first and respects the F-5 ceiling of 60,000;
- avoids every FREEZES window: Mon 03:30–08:00, daily 05:50–07:10, 07:55–08:05, 10:45–11:15, 16:45–17:15 and 23:50–00:10 UTC;
- keeps 2 minutes clear of sweep slots (07:00, 11:00, 17:00 and 21:00 UTC while BST lasts; 08:00, 12:00, 18:00 and 22:00 UTC after Sun 25 Oct).

| Day | Work | Remote writes |
|---|---|---|
| **D-0 (≤ Fri 16, Main Lane)** | Confirm A6 is live. **If not, Mon 19 starts with A6** (002 §13, CR-1, 0.75 d), and 003 moves its buffer day into the build. Founder answers Q1–Q3. LANE-1-ENG runs read pack Appendix A (≤ 5k reads). | 0 |
| Mon 19 (after 08:05 UTC) | `004-ops-cases.sql` (local, then remote). `cases.js`: E-1 and C-1. Tests 1 (reads). | ≈ 1 |
| Tue 20 | E-2 and C-2 with the engine (§8.4). Tests 1 complete. Deploy `meridian-ops`. AC-1 and AC-16 (routes). | ≤ 30 (tests) |
| Wed 21 | Sweep extensions §9.1–§9.5. Test 3. Deploy (after the 17:15 UTC boost window). Observe the 21:00 UTC sweep. | sweep-driven |
| Thu 22 | Founder freeze → dump → M1 → V1–V4 → M2. Test 2 before remote. AC-12 and AC-13. | ≈ 175 |
| Fri 23 | Buffer. AC-2 to AC-4 in production. Retirement code in its own commit; test 4. Report. | ≤ 20 |
| **Sat 24 (≥ 08:05 UTC; N-3 ends 23 Oct)** | Re-dump and compare. C1 deployed = repo. Deploy `meridian-entities-api` (R-1 to R-6). R-7, R-8. AC-14 and AC-15. | ≤ 10 |
| Sat 31 | Founder: R-10 (delete the blocked Access app). | 0 |

**Dependencies:**

| # | Dependency |
|---|---|
| D-1 | A6 live |
| D-2 | 004 spec approved (its vocabulary is shared; it extends `cases.js`) |
| D-3 | 002a closed, so the sweep code is stable |
| D-4 | 007's `entities-api.js` changes sequenced around the Sat 24 deploy |
| D-5 | T-1 registers the 011 runner, so `GLEIF_JOBS` can be complete |

---

## 17. Rollback

| Change | Trigger | Rollback | Check |
|---|---|---|---|
| `meridian-ops` 003 deploy | Route errors or a read regression | `OPS_CASES_ENABLED="false"`, or redeploy the previous version (A6, or `0905784d`) | 503s, or the routes are gone; the sweep still raises |
| Sweep extensions | Wrong suppression or auto-resolve | `OPS_SWEEP_AUTORESOLVE="false"` and `OPS_SWEEP_GLEIF_CHECKS="false"`, then redeploy the previous version | The next sweep's response shows no new fields |
| 004 index | Never expected | Leave it in place (additive). `DROP INDEX idx_ops_dq_linked_exc` only with Founder approval. | — |
| M1 / M2 | V2 ≠ 0, or the Data-Identity Lead rejects the mapping | **Before retirement:** unblock the `/exceptions` Access policy (legacy is authoritative again), and mark the migrated tickets `dismissed` with resolution note `migration_rolled_back` and an event. `ops_case_event` rows cannot be deleted (trigger); they stay as an honest record. Re-run after a fix: new rows need new keys, so a fixed M1 uses `legacy_source='entity_exceptions.r2'` | The legacy page works again; the Ops rows are flagged |
| Retirement deploy | Any `/api/entities/*` regression | `wrangler rollback` to the previous `meridian-entities-api` version. **Only `/exceptions` comes back.** The Access app still exists (blocked) until 31 Oct, and its AUD is unchanged, so unblocking restores it with no config change. | AC-14 smoke routes; `/exceptions/ui` behind Access |
| R-6 / R-7 deletes | Not reversible | They are dead credentials or stale copies. Taken only after AC-14 passes. | — |

---

## 18. Success metrics (measured 31 Oct)

- **Leading:**
  - 100% of the open cases on 23 Oct are acknowledged or closed by 27 Oct (005 UAT window).
  - 0 cases share an open (job, condition type) pair.
  - Sweep `rows_read` ≤ 1,000 on 100% of runs.
- **Lagging:**
  - 0 writes to `entity_exceptions` after the freeze.
  - 1 case queue: legacy routes answer 410.
  - Median time-to-acknowledge for sev2 ≤ 24 h over 24–31 Oct (from `ops_case_event`).

---

## 19. Open questions for the Founder (3)

1. **Q1: Auto-resolve replayed misses?** When the outbox replays a boost run that fills a `missed` slot, should the sweep close that `job_missed` case itself (`resolution='replayed'`, audited as the service)? **Recommended: yes.** Otherwise each replay leaves a case you must close by hand. The code ships either way, switched off unless you say yes.
2. **Q2: Keep `entity_exceptions` frozen until November?** **Recommended: keep it** (9 rows, ≈ 0 cost, a fallback for the M1 rollback), and drop it in November under its own approval after an export. The alternative is dropping it on Sat 24 after the re-dump.
3. **Q3: Create an Access service token for scripted case actions?** It's scoped to "meridian-ops admin" and stored under `~/.meridian-secrets` (ML-1011-2); about 10 minutes in Zero Trust. **Recommended: yes.** It lets the build lane run the production checks AC-2 to AC-4 and lets the Main Lane act on cases before 005's console arrives. If no, you run those three checks from your browser console on Fri 23.

### Review questions (Architect / Data-Identity Lead — not Founder)

| # | Question | For |
|---|---|---|
| RQ-1 | Accept DV-5: the sweep may update `job_missed` cases (auto-resolve only, its own switch and cap)? | Architect |
| RQ-2 | Accept the shared `/cases/:case_ref` detail and action routes for both kinds, to hold the Worker at 14/15 after 004? | Architect |
| RQ-3 | Accept DV-1 (`subject_id` = numeric id) as the convention, and correct 001 §5.2's comment? | Architect |
| RQ-4 | Accept the sweep's daily cross-domain read of `entity_enrichment_queue` (E2, ≤ 50 rows, index-backed)? | Architect, Data-Identity Lead |
| RQ-5 | Accept M1/M2 via `wrangler --file` with `actor='ops_lead:wrangler'` (DV-2)? | Architect |
| RQ-6 | Confirm DV-3, DV-4, the `object_key` precedence, E2's owning `job_id` and M2's wording. | Data-Identity Lead |
| RQ-7 | Confirm that E1's "backlog > 0" may be read as `items_attempted > 0` (no queue read). | Data-Identity Lead |

---

## Appendix A — Read pack for LANE-1-ENG

Read-only, ≤ 5 statements, ≤ 5k reads total. Run with `/usr/local/bin/wrangler` 4.96.0, `d1 execute meridian-etf --remote --json`. Run `EXPLAIN QUERY PLAN` first for each; stop if any plan differs from the expected one. **Do not paste `decided_by` values into reports.**

| # | Statement | Expected plan | Est. reads | Answers |
|---|---|---|---|---|
| R1 | `SELECT exception_type, decision, COUNT(*) AS n, MIN(id) AS min_id, MAX(id) AS max_id, SUM(decided_by IS NOT NULL) AS decided FROM entity_exceptions GROUP BY exception_type, decision` | `SCAN entity_exceptions` (or a covering index) + temp B-tree; declared bounded (≈ 9 rows) | ≤ 50 | Row counts by type. Is N > 9? (M1 sizing, §11.1 abort rule) |
| R2 | `SELECT id, exception_type, source_table, decision, length(source_ref) AS ref_len, json_valid(source_ref) AS ref_ok, created_at FROM entity_exceptions WHERE id > 9 OR exception_type NOT IN ('entity_merge','bad_relationship_edge','isin_duplicate') OR json_valid(source_ref) = 0` | `SCAN entity_exceptions`, bounded | ≤ 50 | Rows added after 015c; any non-DQ type (the fail-closed guard); malformed JSON that would break M1 |
| R3 | `SELECT COUNT(*) AS n, MIN(last_attempt) AS oldest FROM entity_enrichment_queue WHERE status = 'in_progress'` | `SEARCH entity_enrichment_queue USING INDEX idx_enrich_queue_status (status=?)` (covering is not required) | ≤ 50 | E2 plan and cost; whether 006's single stuck row is still there |
| R4 | **EXPLAIN QUERY PLAN only, do not execute:** `SELECT lookup_method, COUNT(*) FROM entity_enrichment_queue WHERE status = 'pending' GROUP BY lookup_method` | `SEARCH … idx_enrich_queue_status` + `USE TEMP B-TREE FOR GROUP BY` | 0 | Confirms E3 is not cheap to automate (§9.3) |
| R5 | `SELECT exception_type, status, severity, COUNT(*) AS n, MIN(opened_at) AS first FROM ops_exception GROUP BY 1, 2, 3` | `SCAN ops_exception` (≤ 50 rows) or the queue index + temp B-tree; bounded | ≤ 100 | Today's case mix: the 6 sev3 cases plus anything raised since 13 Oct; baseline for AC-9 and AC-11 |

Return the results as one table per statement, with `rows_read` from the D1 meta, in the 003 build preflight.

---

## Appendix B — CR-003-1: Move entity exception management into Ops and retire the legacy surfaces

**Requester:** Operations Lead (LANE-3) | **Date:** 2026-10-14 | **Priority:** High | **Status:** Draft — pending Architect review, then Founder approval with this spec

### Description

Move every `entity_exceptions` row into Ops tables (§10). Freeze the legacy table, then retire the `/exceptions`, `/exceptions/ui` and `/exceptions/:id` routes on `meridian-entities-api`. Remove the dead `/admin/exceptions` code, CORS allowance, vars, secret and local files (KI 22.23, 22.27).

### Business justification

D4 (backend owns exceptions and DQ), one case queue, and removing dead attack surface (an unreachable admin route still shipped, plus an orphaned secret).

### Impact analysis

| Area | Impact | Details |
|---|---|---|
| Users | Low | Founder only. Legacy page blocked from Thu 22, 410 from Sat 24. Cases are viewed through `meridian-ops` (browser or the 005 console). |
| Systems | Medium | `meridian-entities-api` (1 deploy, Sat 24); `meridian-ops` (2–3 deploys, 20–21 Oct); D1 (Ops rows ≈ 175 writes; `entity_exceptions` read-only); Zero Trust (1 app blocked, deleted 31 Oct) |
| Processes | Low | DQ decisions move to the Ops case model (004). The job manifest and KI list are updated. |
| Cost | None | Free tier, ≤ 0.3% of the daily write cap |

### Risk assessment

| Risk | L | I | Mitigation |
|---|---|---|---|
| Legacy writes between dump and retirement | L | M | Access Block before the dump; re-dump compare on Sat 24 (§10.3 step 6) |
| M1 value drift (format or whitespace) | L | H | Copied inside D1 with no transcription; V2 byte check; the `source_ref` text is kept verbatim |
| An unknown legacy type is misfiled | L | M | Fail-closed guard; R2 read pack |
| The retirement deploy carries unreviewed 007 changes | M | M | Its own commit; C1 deployed = repo; Main Lane sequencing (D-4) |
| Removing `verifyAccessJwt` breaks another route | L | H | Grep gate (R-1); smoke test on `/api/entities/*`; one-step `wrangler rollback` |
| Deleting the local secret file or snapshot loses something needed | L | L | The values are dead (the route always returns 401); deleted only after AC-14 |
| N-3 breached | L | H | Entities deploy no earlier than Sat 24 08:05 UTC, written into the calendar |

### Implementation plan

§16, Thu 22 to Sat 31. Owners: LANE-1-ENG (build and deploys), Founder (Access Block on Thu 22, deletes on Sat 24, app delete on Sat 31), Operations Lead (sign-off on release readiness).

### Communication plan

| Audience | Message | Channel | Timing |
|---|---|---|---|
| Founder | "Legacy exceptions page will be blocked Thu 22; use meridian-ops" | Build report + Main Lane | Wed 21 |
| Data-Identity Lead | Migrated rows `DQ-M-*` ready for 004 triage | Status Board | Thu 22 |
| All lanes | `/exceptions*` → 410; KI 22.23/22.27 closed | Decisions Log | Sat 24 |

### Rollback plan

§17: unblock Access before retirement; `wrangler rollback` after it. **Verification:** the legacy page loads behind Access, and `/api/entities/*` responses are unchanged.

### Approvals required

| Approver | Role | Status |
|---|---|---|
| Architect | Design and safety review | Pending |
| Data-Identity Lead | Mapping (DV-3, DV-4), E2 and E3 | Pending |
| Founder | Gate | Pending |

---

## Appendix C — Inputs read (SHA-256 at read time, 14 Oct)

| File | SHA-256 |
|---|---|
| `claude/packets/MA-OCT-003.SPEC_Control_v1.md` | `c38b4b7a1d6ec562c5a018d979bea8eb87e545eca6bddbd6e510f36024fb5cd2` |
| `claude/packets/MA-OCT-003.SPEC_Task_v1.md` | `8b23b06f03253abe7421d108c001ec456f0fc1972bd5c60399973af6cddfe675` |
| `claude/meridian-october-revised-scope-v2.md` | `967bebd7c1762a0389d150d96a04ae08c4f0df0cdaf127328f0f4a88e1f33445` |
| `claude/Meridian_October_Operating_Kit_v3_Addendum.md` | `d816aa2b6101d0507282ee770a6363e66ed77505c1c75cf10b3241bbaa6cbc46` |
| `claude/MA-OCT-001_Spec.md` | `d69e0ade3cb320a409c44df6c1d18dbc453a8c98ce9f7d94e29c20137fa9b3a5` |
| `claude/MA-OCT-002_Spec.md` (rev 1.3) | `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893` |
| `claude/MA-OCT-007_Spec.md` (rev 1.4; §8 used by 004, not 003) | `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c` |
| `claude/MA-OCT-006_Spec.md` (§8.3 E1–E6) | `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273` |
| `claude/packets/MA-OCT-002a_Report.md` | `c86a49404b1d510c7f96a43605dbbb69054c176a88198d069321b2a29fa67b22` |
| `claude/October_Decisions_Log.md` | `89bde9d8dd8023030507edb513cb33c132bda212e567eb0497d16af49fd38102` |
| `CLAUDE.md` | `fb936197dd5c8b50716da09611184dfe5b8b05cb5a9ba89faa37ac0149bc77f0` |
| `App/Ops/src/ops-api.js` | `c77973deb5d9d9d69335becee56b9e2c841f897721af3bd0a9aa39cf8c9d7f19` |
| `App/Ops/src/lateness.js` | `48dfcb9b8d2d42bd85d676c501fa81a34c1716cfb07a292e0051db14086bce37` |
| `App/Ops/wrangler-ops.toml` | `64869a8e8f45a7a9b29f4f8f12e836ff61c0a7c5b9040f84134ab1a3fd215bf8` |
| `App/Ops/migrations/002-ops-control-plane.sql` | `6a12bae6077b932696083cb2b9e058d5e618d0c499ad6edff8e2cd6295fdc836` |
| `App/Ops/migrations/003-ops-job-pause.sql` | `6638194f4c66b437dc876a8166edc59075e06c322561249b545b3da5648e6bfb` |
| `App/Corporate Atlas/src/entities-api.js` | `19993e84255ef39f658ebbcb5df0b93a2d369d1fb0802fb4b4e80b7cd87fe2f6` |
| `App/Corporate Atlas/wrangler-entities-api.toml` | `492c0c78d2b871bb77831f4d5990bce387b888d289ed1dce8eaae1e81b17e049` |
| `App/Corporate Atlas/migrations/ma-sep-015b-entity-exceptions.sql` | `77ef2ce9949fd82eab83ec0012a0fa5e06727e23854628af7926fd30fbdbba65` |
| `App/Corporate Atlas/migrations/ma-sep-015c-seed-known-issues.sql` | `cf006427970cb7f6068ceb0f99d72ff6240abff26ece08e97a26f73d3b0b8bf1` |
| `claude/MA-SEP-015a_Spec.md` | `25dca550e93dcc6ae086dac329fbd650123d4299c3c902011509b916f87127d8` |
| `claude/MA-SEP-015b_Build_Brief.md` | `c1c98637b2f0a9a4ec59ea81cc2724d9a53fe6789945c497a55f5552f3592257` |
| `claude/MA-SEP-015c_Build_Brief.md` | `be5974ece8088b9feb19809d120548b8bf4a148300073c6a748b3a1bccf84552` |
| `claude/MA-OCT-000_Job_Manifest.md` | `f56ba53eb53bb985e08c5e37468a0fbbb6155a1a265ff9ec6e8e8f42c010dafc` |

**Local check of this spec's SQL (author's own dry-run; it does not replace review):**
- **Setup:** Python `sqlite3` 3.45.1 in an in-memory database, loaded from the real files `002-ops-control-plane.sql`, §6's index, `ma-sep-015b-entity-exceptions.sql` and `ma-sep-015c-seed-known-issues.sql`.
- **M1:** 9 tickets (`DQ-M-000001`–`000009`; 7 `resolved`, 2 `open`) and events `created` 9, `decision_recorded` 7, `migrated` 9.
- **V2 = 0 mismatches.** Re-running M1 makes 0 changes.
- **M2:** 2 rows; re-running it makes 0 changes.
- **`object_key` results:** 931, 2589 and 2014 (merge `entity_id_a`); 3, 143, 49 and 194 (edge `child_entity_id`); 204921 and 28219 (ISIN first entity).
- **`EXPLAIN QUERY PLAN`:**
  - `idx_ops_dq_linked_exc` (C-1 linked);
  - `idx_ops_exception_job` (S2);
  - `idx_ops_exception_queue` (auto-resolve input and the E-1 queue, with no temp B-tree);
  - `idx_ops_case_event_subject` (C-1 events).
- **Limitation:** these are local plans. D1's remote plans are confirmed at build (AC-16).

**Limits of this spec lane:**
- No D1 access. Every count marked "known" comes from the migration files. Appendix A confirms them.
- `.env.admin-exceptions` was not opened.
- The `/exceptions` Access app's policy was not inspected, because it is dashboard-only.
