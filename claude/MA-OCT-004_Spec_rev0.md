# MA-OCT-004 — Data-Quality Ticketing: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane) — Task MA-OCT-003.SPEC v1, item 2
EXECUTED BY:  Operations Lead (packet owner and spec author; LANE-3, doc-only)
REVIEWED BY:  Data-Identity Lead (separate review packet; the author never reviews this). Architect consulted on the new table and the page route (Addendum D1).
APPROVED BY:  Founder
PACKET:       MA-OCT-004 — Data-quality ticketing
GATE:         Spec approval → build Mon 26 – Wed 28 Oct (Claude Code) → close-out
STATUS:       REV 0 (Thu 15 Oct 2026). Doc-only: 0 D1 reads or writes, no deploys, no git writes.
DOMAIN:       Ops (Addendum D3). Owner Operations Lead. Only writer of ops_* tables: meridian-ops.
BASELINE:     October-2026 @ 3960aee; meridian-ops 0905784d; builds on claude/MA-OCT-003_Spec.md rev 0 (8fb129ac…a0ed91).
```

Input hashes are in Appendix B. This spec extends 003's case engine (`src/cases.js`, routes C-1 and C-2) and reuses 003's conventions. DV-1: `ops_case_event.subject_id` is the numeric id. Atomic guarded batches: 003 §8.4. 003's facts are not repeated here.

---

## 0. Summary of decisions (one line each)

1. **One new table, `ops_dq_ticket_member`**, plus one index (migration `App/Ops/migrations/005-ops-dq.sql`). It lets **one aggregate ticket** carry a tracked list of affected objects: the 24 wrong LEIs (Founder D5 A), the 37 ambiguous ISINs, and the 4 bad edges. No column changes to `ops_data_quality_ticket` (§6).
2. **Lifecycle:** `open → triaged → fix_pending → resolved | dismissed`, plus `reopen`. Resolution uses 006's four-way classification as the `disposition` (`source_absence`, `valid_exception`, `pipeline_omission`, `job_failure`) plus `fixed` (§7). **Tickets are distinct from exceptions but linkable**, through `linked_exception_ref` and 003's index.
3. **Three new endpoints** on `meridian-ops`: D-1 list, D-2 create, D-3 the Access-gated link-out page (007 Q1). That brings the Worker to **14/15**. Detail and actions reuse 003's shared C-1 and C-2 (§8).
4. **007's prefill contract (§8.3) is accepted, with two mappings** written down: `domain=entities` becomes `object_domain='instrument'` (or `'entity'` for `entity:{id}`), and `via=nav-007` becomes `raised_via='consumer_screen'`. **The O4 `ticket_type` vocabulary is confirmed** as `missing_mapping`, `ambiguous_mapping`, `low_confidence_mapping` and `merged_link_unresolved` (§9).
5. **Duplicate reports are folded into the open ticket for the same (type, object)**, not keyed by a permanent `dedupe_key`. A UNIQUE `nav:{type}:{key}` (007 §8.3) would block a fresh report after the ticket is resolved. A repeat click returns the existing ticket and writes at most one `reported_again` event per actor per day (§9.3).
6. **Consumer screens only raise.** The page holds no state, and the create route requires an Access JWT, JSON, and a custom header that cross-site forms cannot send (D4, §9.4).
7. **Known-issue tickets are seeded by a reviewed `wrangler --file` batch (M3)**, as for 003's M1 and M2:
   - **KI 22.44**: one aggregate `wrong_lei` ticket with 24 members (6 replace-with-T1, 5 review, 13 null-and-requeue).
   - **KI 22.17**: one aggregate `isin_duplicate` ticket with the 37 ISINs from 007 Appendix A Q5. The two legacy `DQ-M-000008/9` tickets are dismissed as duplicates of it.
   - **KI 22.9**: one aggregate `bad_relationship_edge` ticket proposing the deletion of the 4 edges, **only if the Founder reopens his 22 Aug `accepted_no_fix`** (Q1).
8. **008's unlinked issuers** (`missing_entity`, one ticket per issuer, Founder 008-Q2) are loaded from 008's hand-over list by **M4**. Raising them from 008's runner directly needs an Access service token (Q2; 003 Q3).
9. **The fixes are not 004's.** Corrections to `entity_master`, `entity_relationships` and `entity_isin_map` are Entities-domain writes by Data-Identity Lead packets after the 011 window (≥ 24 Oct). 004 tracks them: per-member status, and `fix_pending` with a `fix_ref`.
10. **D1:** one-time ≤ about 700 writes (M3 + M4); steady state ≤ about 600 writes and ≤ about 3k reads a day; no execution above 500 reads (§11).

### 0.1 Facts checked in the source and on disk (15 Oct, read-only)

| Fact | Where |
|---|---|
| `ops_data_quality_ticket` exists (001), with the indexes `idx_ops_dq_queue(status, severity, opened_at)`, `idx_ops_dq_object(object_domain, object_key)`, `idx_ops_dq_type(ticket_type, status)` and UNIQUE `case_ref`, `dedupe_key`, `(legacy_source, legacy_id)` | `App/Ops/migrations/002-ops-control-plane.sql` |
| 003 adds `idx_ops_dq_linked_exc`, the shared routes C-1 and C-2 (a DQ ref returns 409 until 004), and M1 = 9 tickets `DQ-M-000001…9` (3 `entity_merge` resolved, 4 `bad_relationship_edge` resolved `accepted_no_fix`, 2 `isin_duplicate` open) | `claude/MA-OCT-003_Spec.md` §6, §8, §10; author's dry-run |
| 007 §8.3 prefill: `type`, `domain=entities`, `key` (= `instrument_key` or `entity:{id}`), `ref` (JSON ≤ 1.5 kB), `via=nav-007`; `raised_by` only from the Access email; Phase 4 button "after 004, by 28 Oct; else deferred" | `claude/MA-OCT-007_Spec.md` rev 1.4 §8, §12 |
| 007 placeholder keys: `CUSIP:` + 6–9 zeros, `NAME:N/A`, `NAME:NA`, `NAME:NONE` | 007 §3.1 |
| KI 22.17: **37 ISINs**, each mapped to exactly 2 entities, a complete list (9 Oct) | `claude/MA-OCT-007_AppendixA_Results.md` Q5 |
| KI 22.44 (RC-12): **24 wrong LEIs**. Proposed actions: replace with the T1 LEI (6), review (5 non-T1 candidates), set NULL and re-queue (13). Evidence `WORK/day6/wrong_lei_detail.csv` (006 work folder, **outside the repo**). Excluded from 011. | `claude/MA-OCT-006_Remediation_Matrix.md` rank 14; Evidence §14.4, §15.3; GATE-1012 D5 A |
| KI 22.9 (RC-20): 4 bad `legal_parent` edges, confirmed W (no RR support). 006 proposes "one aggregate DQ ticket"; the fix is 4 `DELETE`s ≈ 16 writes. Legacy decision `accepted_no_fix`, Founder, 2026-08-22. | Matrix rank 10; Evidence §14.5; 015c migration |
| 008: an unmatched issuer gets `entity_id` NULL plus one `missing_entity` ticket (CIK, SEC name, LEI if known), "once 004 is live, else a list handed to 004". Linkage (Pack C) is pending for 27 of 30 issuers, plus ≤ 3 co-registrants. | `claude/MA-OCT-008_Spec.md` rev 1.2 §11, P0, AC11; 008 BUILD report; AC17 sign-off |

---

## 1. Problem statement

Data-quality problems in Meridian Atlas are found in four places and recorded in none:
- 006's diagnosis: 24 wrong LEIs, 4 bad edges;
- 007's navigation: 37 ambiguous ISINs, plus any unmatched instrument a user meets;
- 008's ingestion: issuers with no entity;
- the legacy Entities exceptions page.

Today they live in markdown evidence files, Known Issue rows and a Founder-only page that 003 retires. Nothing tracks whether a fix happened, a user who sees a wrong link has no way to say so, and 007's "Report mapping problem" button (Founder Q1 = Access-gated link-out) has nowhere to go. October's acceptance needs "integrated exception and data-quality case management".

## 2. Goals (measurable, checked at close-out)

1. **Every known DQ issue is on record:** KI 22.44 (24 members), KI 22.17 (37 members), 008's unmatched issuers (1 ticket each), and, if Q1 is yes, KI 22.9 (4 members). Each has an owner role and a status (AC-11, AC-12).
2. **A user can report a mapping problem in ≤ 2 clicks** from 007's card: the button, then Submit on the prefilled page. The ticket's `raised_by` is the verified identity, and repeat clicks create no duplicate (AC-6 to AC-8).
3. **Every change is audited:** 100% of transitions and member updates write one `ops_case_event` row (AC-2, AC-9).
4. **Tickets link to exceptions** in both directions in the detail view (AC-10).
5. **Inside budget:** ≤ 500 reads per call, ≤ 600 writes a day steady (AC-15).

## 3. Non-goals

| Not in 004 | Why / where |
|---|---|
| Fixing the data (LEI corrections, edge deletions, ISIN dedup, entity creation) | Entities-domain writes; Data-Identity Lead packets after 24 Oct (011 window). 004 tracks the work. |
| Operator console screens | MA-OCT-005 consumes D-1, C-1 and C-2. D-3 is the only page 004 serves (007 Q1 makes it 004's). |
| Showing tickets on consumer pages (entity, instrument, bond) | Not in 007/010 v1. `idx_ops_dq_object` and `idx_ops_dq_member_object` make it a single seek later (P2). |
| One ticket per entity for 006's ~27k gap rows | 006 §8.4: aggregate per root cause; 011 handles the backfill. |
| Anonymous reporting from the public site | D4; 007 Q1 option (c) rejected. |
| Automatic detection of new DQ issues | Sources (006, 007, 008) raise through D-2 or seed files. A DQ sweep would be a new recurring job (P2, three-point check). |

## 4. User stories

- As a **site user (the Founder today)**, when an instrument card says "No issuer", "Ambiguous" or "Low confidence", I want to report it in two clicks without retyping identifiers, so that the problem reaches the Data-Identity Lead with its context.
- As the **Data-Identity Lead**, I want one ticket for the 24 wrong LEIs with each entity's proposed action and its own status, so that I can work through them across several fix packets and see what's left.
- As the **Data-Identity Lead**, I want each SEC issuer that 008 couldn't link to raise one ticket with its CIK and name, so that missing entities get created properly rather than linked to a parent.
- As the **Operations Lead**, I want a DQ ticket that a failed job caused to link to that job's exception, so that closing one shows the other.
- As the **Founder**, I want to resolve a ticket with a reason from 006's four categories, so that we learn which causes dominate.
- *Edge:* As a **user who clicks Report twice**, I want to be told it's already reported (with its ref), not to create a second ticket.
- *Edge:* As a **user whose Access session expired**, I want to meet the Access login and then land back on the prefilled form.

---

## 5. What is live, and what 004 assumes

| Item | State on 15 Oct | 004 assumption |
|---|---|---|
| `ops_data_quality_ticket` (001) | Live, 0 rows | 9 `DQ-M-*` rows after 003 M1 (Thu 22) |
| 003 engine, C-1, C-2 | Specced (rev 0, in review) | **Built and live by Fri 23** (dependency D-1). 004 extends `cases.js`. |
| A6 | Not built | Done by the 003 build (003 D-1) |
| Access app "meridian-ops admin" on `/api/ops/admin` | Live | D-3 sits under that prefix, so the page is Access-gated with no new app |
| 011 run 17–24 Oct; Entities writers frozen | Scheduled | 004 makes no Entities writes. M3 reads no Entities tables (lists are embedded). |
| 008 Pack C linkage | Thu 15 (step 4) | M4 loads its unmatched list after 004 is live (Tue 27–Wed 28) |
| 006 `WORK/` folder | Outside the repo (006 Q1) | The Data-Identity Lead exports the 24 rows for M3 (§10.2) |

---

## 6. Schema (Ops domain)

**Domain declaration (CLAUDE.md new-table rule):** `ops_dq_ticket_member` is **Ops domain**, owned by the Operations Lead, written only by `meridian-ops` and by reviewed `wrangler --file` seed batches. Its `object_key` values refer to Entities, Instrument and source objects **read-only, never as a foreign key** (001 §5.3).

**Migration `App/Ops/migrations/005-ops-dq.sql`** (additive, `IF NOT EXISTS`, dry-run with `--local` first):

```sql
-- MA-OCT-004. Domain: Ops. Owner: Operations Lead. Only writer: meridian-ops (+ reviewed seed batches).
-- One row per affected object of an aggregate DQ ticket (006 §8.4: one ticket per root cause,
-- per-object list attached). Kept forever, like its ticket. ≤ 500 rows at 12 months (~70 at launch).
CREATE TABLE IF NOT EXISTS ops_dq_ticket_member (
  member_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL,                 -- ops_data_quality_ticket.ticket_id
  object_domain   TEXT NOT NULL,                    -- 001 §5.3 vocabulary
  object_key      TEXT NOT NULL,                    -- canonical key, never a name
  object_ref      TEXT NULL,                        -- JSON ≤ 1 KB (e.g. current/correct LEI, names)
  proposed_action TEXT NULL,                        -- Worker-validated (§7.3)
  member_status   TEXT NOT NULL DEFAULT 'open',     -- Worker-validated (§7.3)
  note            TEXT NULL,                        -- ≤ 500 chars, redacted
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ticket_id, object_domain, object_key)     -- lists a ticket's members (autoindex) and makes seeds idempotent
);
-- "Which tickets mention this object?" for aggregate tickets (complements idx_ops_dq_object).
CREATE INDEX IF NOT EXISTS idx_ops_dq_member_object ON ops_dq_ticket_member(object_domain, object_key);
```

There are **no new columns** on `ops_data_quality_ticket`. `fix_ref` (the packet or CR doing the fix) goes in the `fix_pending` event's payload and is copied into `proposed_resolution`'s first line (§7.1).

**`object_domain` and `object_key` rules (001 §5.3, made exact):**

| `object_domain` | `object_key` | Validation |
|---|---|---|
| `entity` | `entity_master.entity_id` | `^[1-9]\d{0,9}$` |
| `instrument` | `instrument_master.instrument_key` | `^[A-Z]{2,8}:\S{1,120}$`; 007 placeholder keys rejected (400). The build confirms the prefix set against `deriveInstrumentKey` (E8). |
| `bond` | 008's bond key | `^[A-Za-z0-9:._-]{1,128}$` |
| `etf`, `filing` | as 001 | as 001 |
| `source_record` | `<system>:<id>` | `^[a-z][a-z0-9_.-]{1,40}:\S{1,120}$`. Systems used by 004: `known-issue` (aggregate anchors, e.g. `known-issue:22.44`), `entity_isin_map` (`entity_isin_map:<ISIN>`), `entity_relationships` (`entity_relationships:<parent>-><child>:legal_parent`), `sec_cik` (`sec_cik:<10-digit CIK>`) |

---

## 7. Lifecycle

### 7.1 Ticket transitions (C-2 actions on `DQ-` refs)

| From | Action | To | Required | Event |
|---|---|---|---|---|
| `open` | `triage` | `triaged` | `owner_role`; optional `severity` | `triaged` |
| `open`, `triaged` | `schedule_fix` | `fix_pending` | `fix_ref` (e.g. `MA-OCT-0xx` or a CR id), `note` | `fix_scheduled` (`payload.fix_ref`) |
| `open`, `triaged`, `fix_pending` | `assign` | same | `owner_role` and/or `assignee` | `assigned` |
| any | `comment` | same | `note` (≤ 2,000) | `commented` |
| `open`, `triaged`, `fix_pending` | `set_severity` | same | `severity`, `note` | `severity_changed` |
| `open`, `triaged`, `fix_pending` | `link_exception` | same | `exception_ref` (must exist; `EXC-…`) | `linked` (sets `linked_exception_ref`) |
| `open`, `triaged`, `fix_pending` | `resolve` | `resolved` | `disposition` (resolve set), `note`. **An aggregate ticket with any member still `open` → 409**, unless `force: true` with a note naming why. | `resolved` |
| `open`, `triaged`, `fix_pending` | `dismiss` | `dismissed` | `disposition` (dismiss set), `note`; `duplicate_of` for `duplicate` | `dismissed` |
| `resolved`, `dismissed` | `reopen` | `open` | `note` | `reopened` (prior disposition in `from_value`/`payload`) |
| `open`, `triaged`, `fix_pending` | `add_members` | same | `members[]` (≤ 100 per call; ≤ 500 per ticket) | `members_added` (count) |
| `open`, `triaged`, `fix_pending` | `member_update` | same | `member` (`object_domain`, `object_key`), `member_status`, optional `note` | `member_updated` (`payload`: key, from, to) |

The mechanics are 003 §8.4: a per-action `SET` list, `expected_status`, a required `request_id`, and one event per batch. `member_update` puts an `UPDATE ops_dq_ticket_member … WHERE ticket_id = ? AND object_domain = ? AND object_key = ? AND member_status = :expected_member_status` in the same batch as the ticket's `updated_at` bump and the event.

### 7.2 Vocabularies (Worker-validated; `cases.js` constants)

| Field | Values |
|---|---|
| `status` | `open`, `triaged`, `fix_pending`, `resolved`, `dismissed` |
| `severity` | `sev1`–`sev4` (003 meanings). Defaults: consumer reports sev3 (`low_confidence_mapping` sev4); `wrong_lei` sev2; others sev3. |
| `disposition` on `resolved` | `fixed`; 006's four: `source_absence` (a), `valid_exception` (b), `pipeline_omission` (c), `job_failure` (d) |
| `disposition` on `dismissed` | `duplicate`, `not_a_problem`, `wont_fix` |
| `disposition` legacy (read-only; never accepted on a write) | `do_not_merge`, `accepted_no_fix`, `pending` (003 M1, verbatim) |
| `ticket_type` (**O4, confirmed**) | **007:** `missing_mapping`, `ambiguous_mapping`, `low_confidence_mapping`, `merged_link_unresolved`. **008:** `missing_entity`. **006:** `wrong_lei`. **Legacy and known issues:** `entity_merge`, `bad_relationship_edge`, `isin_duplicate`. **Console:** `data_error` (anything else; title must say what) |
| `raised_via` | `consumer_screen` (D-3 page), `ops_console` (console and seeds decided by a person), `ingest_auto` (a service caller, e.g. 008 with a service token), `migration` (003 M1) |

### 7.3 Members

| Field | Values |
|---|---|
| `proposed_action` | `replace_lei_t1`, `review`, `null_and_requeue` (22.44); `dedupe` (22.17); `delete_edge` (22.9); `create_entity` (008); `none` |
| `member_status` | `open`, `fixed`, `wont_fix`, `not_a_problem` |

### 7.4 Ownership and triage targets

The default `owner_role` is the **Data-Identity Lead** for every type except `data_error` (Operations Lead). Triage targets are display only, as in 003 §7.2: triage within sev1 4 h, sev2 2 days, sev3 7 days, sev4 none. `age_h` and `overdue` are computed in the D-1 response.

---

## 8. Routes and authentication

### 8.1 Endpoint budget

| | After 003 | After 004 |
|---|---|---|
| `meridian-ops` endpoints | 11 | **14** (1 headroom) |

### 8.2 The three new routes (all under Access app "meridian-ops admin"; the Worker re-verifies the JWT, 001 §6.2)

| # | Method + path | Purpose |
|---|---|---|
| D-1 | `GET /api/ops/admin/dq-tickets` | List. `?status=` (default `open,triaged,fix_pending`), `type`, `severity`, `object_domain`+`object_key` (searches tickets **and** members), `limit` (≤ 100, default 50), `cursor` (keyset on severity, opened_at, ticket_id). |
| D-2 | `POST /api/ops/admin/dq-tickets` | Create (console, D-3 page, service callers). Body in §8.3. Answers **201** `{case_ref}` for a new ticket, or **200** `{case_ref, deduplicated: true}` (§9.3). |
| D-3 | `GET /api/ops/admin/dq/new` | **Link-out page** (007 Q1 (a)). Validates the §9.1 query parameters and returns an HTML form, prefilled and read-only, with one optional free-text note. Submit POSTs to D-2 on the same origin. |

C-1 (`GET /api/ops/admin/cases/DQ-…`) returns the ticket, its events (≤ 200), its members (≤ 200, ordered by `object_domain, object_key`, which is index order with no sort) and its linked exception. C-2 handles §7.1.

### 8.3 D-2 body

- **Required:** `request_id` (UUID), `ticket_type`, `object_domain`, `object_key`.
- **Optional:** `severity`, `title` (≤ 200; default `"<type label>: <object_key>"`), `summary` (≤ 500), `note` (≤ 1,000; stored as the `created` event's body), `object_ref` (JSON ≤ 1.5 kB), `source_system`, `source_record_ref`, `field_name`, `observed_value`, `expected_value`, `evidence` (≤ 2 kB), `proposed_resolution`, `owner_role`, `linked_exception_ref`, `members[]` (≤ 100), `via`.

**Server-set, never from the body:**
- `raised_by`: the JWT email, or `service:<common_name>`.
- `raised_via`: `consumer_screen` if `via='nav-007'` and the actor is a person; `ingest_auto` if the actor is a service token; else `ops_console`.
- `case_ref`: `DQ-` + `printf('%06d', ticket_id)`, through the 003 §8.2 insert-then-update batch with a `DQ-PENDING-<request_id>` placeholder.

**Caller classes:**

| Caller | Types allowed |
|---|---|
| A person with `via='nav-007'` | the 4 007 types |
| A service token | `missing_entity` only |
| The console | any type |

Anything else gets a 403.

### 8.4 CSRF and CORS

- D-2 requires `Content-Type: application/json` **and** `X-Ops-Client: <console|dq-page|service>`.
- A cross-site HTML form can send neither, and any cross-origin `fetch` with them needs a preflight. Admin routes answer preflights with no CORS allowances (001 §6.2), so the browser blocks it.
- D-3 is same-origin with D-2. No `Access-Control-Allow-Origin` is ever sent.

---

## 9. The 007 link-out (Phase 4 contract)

### 9.1 URL and parameter mapping (accepts 007 §8.3)

`https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/dq/new?type=…&domain=entities&key=…&ref=…&via=nav-007`

| 007 param | Validation | Becomes |
|---|---|---|
| `type` | one of the 4 007 types | `ticket_type` |
| `domain` | must be `entities` | used only to accept the request |
| `key` | `entity:{id}` → `object_domain='entity'`, `object_key={id}`; otherwise `object_domain='instrument'`, `object_key=key` (§6 rules; placeholders → error page) | `object_domain`, `object_key` |
| `ref` | URL-decoded JSON ≤ 1.5 kB. **Only** `isin`, `cusip`, `ticker`, `candidates` (≤ 10 positive ints), `state`, `reason` are kept; any other key is dropped. | `object_ref` (+ `"via":"nav-007"`) |
| `via` | must be `nav-007` | `raised_via='consumer_screen'`, `source_system='ma-ui'` |

**Change 007 must make:** none. The URL path is the one detail 007 left as "e.g."; it is now **`/api/ops/admin/dq/new`**, under the existing Access prefix (RQ-3).

### 9.2 The page

- **Content:** the prefilled fields as read-only text, a note box (≤ 1,000), Submit and Cancel.
- **On success:** shows `DQ-000123 created` or `Already reported as DQ-000045 (open)`.
- **On error:** shows the message, with no technical detail.
- **Caching and policy:** `Cache-Control: no-store`. CSP is `default-src 'none'; script-src 'nonce-…'; style-src 'nonce-…'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'`.
- **Escaping:** every value is HTML-escaped.
- **Network:** no external resources. The page makes one D-2 `fetch` and nothing else.
- **No state:** no cookies of its own, and no local storage.
- **Expired Access session:** Access redirects to its login and back to the same URL, so the query string survives. AC-8 checks this.
- **Kill switch:** `OPS_DQ_CONSUMER_ENABLED="false"` makes the page show "Reporting is paused" and makes D-2 refuse `via='nav-007'` with 503 (§11.4).

### 9.3 Duplicate handling

D-2 inserts with a guard instead of a permanent key (dedupe_key stays NULL for created tickets):

```sql
INSERT INTO ops_data_quality_ticket (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key,
                                     object_ref, source_system, owner_role, raised_by, raised_via, /* … */ opened_at, updated_at)
SELECT 'DQ-PENDING-' || :request_id, :type, :sev, 'open', :title, :summary, :od, :ok, :ref, :src, :role, :actor, :via, /* … */ :now, :now
 WHERE NOT EXISTS (SELECT 1 FROM ops_data_quality_ticket
                    WHERE object_domain = :od AND object_key = :ok AND ticket_type = :type
                      AND status IN ('open','triaged','fix_pending'));
```

The subquery uses `idx_ops_dq_object` and reads only that object's tickets. D1 runs one statement at a time, so two rapid clicks cannot both insert.

- **If nothing is inserted:** the Worker reads the existing open ticket and returns **200** `{deduplicated: true, case_ref}`. It writes **one** `reported_again` event with `idempotency_key = 'again:' || ticket_id || ':' || actor || ':' || <UTC date>`, so there is at most one per actor per day, and the note goes into it.
- **After resolution:** a later report opens a new ticket.
- **Deviation from 007 §8.3** (`dedupe_key='nav:{type}:{key}'`): it is stated here for the 007 owner. 007 said Phase 4 adapts.

### 9.4 What the public site can and cannot do (D4)

| Can | Cannot |
|---|---|
| Build a URL and open it in a new tab | Send anything to Ops itself; read any ticket; see whether a report exists |

All writes need an Access-verified identity, and **ticket contents are never public** (001 §6.1: new Ops data is Access-only).

---

## 10. Known-issue and source tickets (seeds)

The M3 and M4 batches are reviewed `wrangler d1 execute --remote --file` runs.
- **Actor:** `ops_lead:wrangler`, with `actor_source='system'` (003 DV-2).
- **Idempotency:** each seed ticket carries a fixed `dedupe_key` (`ki:22.44`, `ki:22.17`, `ki:22.9`, `sec_cik:<CIK>`), so a re-run inserts nothing.
- **Before each run:** a `d1-today` read and the F-5 ceiling, as in 003 §10.3.

### 10.1 M3a — KI 22.17 (37 ISINs) and consolidation of the legacy rows

```sql
INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref, source_system,
   evidence, proposed_resolution, owner_role, raised_by, raised_via, dedupe_key)
VALUES ('DQ-SEED-ki2217', 'isin_duplicate', 'sev3', 'triaged',
  'KI 22.17: 37 ISINs map to 2 entities each in entity_isin_map',
  'entity_isin_map has no dedup step on its write path (same shape as KI 22.8). 007 shows these as "Ambiguous".',
  'source_record', 'known-issue:22.17', json_object('ki','22.17','isin_count',37),
  'entity_isin_map', 'MA-OCT-007 Appendix A Q5, 9 Oct 2026: complete list, each ISIN exactly 2 entities (claude/MA-OCT-007_AppendixA_Results.md).',
  'Re-check each ISIN after MA-OCT-013 merges (twins collapse); then a write-path dedup fix (Entities packet).',
  'Data-Identity Lead', 'ops_lead:wrangler', 'ops_console', 'ki:22.17');
UPDATE ops_data_quality_ticket SET case_ref = 'DQ-' || printf('%06d', ticket_id) WHERE case_ref = 'DQ-SEED-ki2217';
INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, proposed_action)
SELECT t.ticket_id, 'source_record', 'entity_isin_map:' || j.value, 'dedupe'
  FROM ops_data_quality_ticket t,
       json_each('["AU000000CMW8","CA46431R1029","DE000A2H7N08","DE000A2JF7A2","DE000A42ERT3","IE0004ZFNTZ6","IE0009D15VO0","IE000I50V6C7","IE000SKTEI24","IE000TG7T8V7","IE000TGK2UK9","IE00BF92LR56","LU0757359368","LU0757360457","LU0757360531","LU0757360614","LU0757360960","LU0864709349","LU0864710354","LU0864714000","LU0864714422","LU1011997381","LU1856130205","LU2183939003","LU2381585913","US0321084339","US0321084826","US29287L1061","US46138K1034","US46436E3201","US46438G3728","US49446R1095","US69374H1547","US9219378190","US9219464065","US92206C1027","US92206C6232"]') j
 WHERE t.dedupe_key = 'ki:22.17';
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(ticket_id AS TEXT), 'created', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('case_ref', case_ref, 'members', 37, 'seed', 'M3a'), 'seed:ki:22.17:created'
  FROM ops_data_quality_ticket WHERE dedupe_key = 'ki:22.17';
-- Consolidate the 2 legacy open isin_duplicate tickets (003 M1: DQ-M-000008/9; their 3 ISINs are in the 37).
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(l.ticket_id AS TEXT), 'dismissed', l.status, 'dismissed',
       'Consolidated into the KI 22.17 aggregate ticket ' || a.case_ref || ' (MA-OCT-004 M3a).',
       'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('disposition','duplicate','duplicate_of', a.case_ref, 'legacy_disposition', l.disposition),
       'seed:ki:22.17:dismiss:' || l.case_ref
  FROM ops_data_quality_ticket l, ops_data_quality_ticket a
 WHERE l.legacy_source = 'entity_exceptions' AND l.ticket_type = 'isin_duplicate' AND l.status = 'open'
   AND a.dedupe_key = 'ki:22.17';
UPDATE ops_data_quality_ticket
   SET status = 'dismissed', disposition = 'duplicate',
       resolution_note = 'Consolidated into ' || (SELECT case_ref FROM ops_data_quality_ticket WHERE dedupe_key = 'ki:22.17') || ' (MA-OCT-004 M3a).',
       resolved_by = 'ops_lead:wrangler', resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE legacy_source = 'entity_exceptions' AND ticket_type = 'isin_duplicate' AND status = 'open';
```

**Order matters:** the event comes **before** the `UPDATE`, because the event selects `status = 'open'` rows. The legacy row's original `disposition` (`pending`) is kept in that event's payload. Run M3a only **after** 003's V2 check has passed (Thu 22), because V2 compares `disposition` with `decision`.

### 10.2 M3b — KI 22.44 (24 wrong LEIs)

- **Ticket:** `wrong_lei`, sev2, `triaged`, anchor `known-issue:22.44`, `dedupe_key 'ki:22.44'`.
- **`evidence`:** "MA-OCT-006 RC-12; Evidence §14.4/§15.3; D5-8, D6-4 (OPAP cleared), D6-5; WORK/day6/wrong_lei_detail.csv".
- **`proposed_resolution`:** "Replace with T1 LEI (6); review 5 non-T1 candidates; set NULL and re-queue (13). Excluded from 011. Manual correction by a Data-Identity Lead packet after 24 Oct; 011 never overwrites an existing LEI."
- **Members (24):** `object_domain='entity'` and `object_key=entity_id`, each with `proposed_action` and `object_ref = {name, current_lei, correct_lei|null, kind: 'subsidiary'|'other_or_predecessor'}`.
- **Who provides the member rows:** the members come from `wrong_lei_detail.csv`, which is outside the repo. **The Data-Identity Lead exports a JSON array** of `{entity_id, name, current_lei, correct_lei, kind, proposed_action}` to `App/Ops/seeds/ki-22-44-members.json` (tracked; it holds public LEIs and names only). The build embeds it in a `json_each` insert, as in M3a. **Check:** 24 rows; action counts 6/5/13; the names match the 24 in Evidence §14.4.
- **If the file is not ready by build day:** the ticket is seeded with **0 members**, and the members are added later through C-2 `add_members` (the ticket shows `members: 0`).

### 10.3 M3c — KI 22.9 (4 edges), only if Founder Q1 = yes

- **Ticket:** `bad_relationship_edge`, sev3, `triaged`, anchor `known-issue:22.9`, `dedupe_key 'ki:22.9'`.
- **`proposed_resolution`:** "Delete the 4 legal_parent edges (006 RC-20, ≈ 16 writes, Entities packet after 24 Oct)."
- **Members:** `entity_relationships:1565->3:legal_parent`, `2247->143`, `2476->49`, `6980->194` (`proposed_action='delete_edge'`).
- **Links:** one `linked` event on each of the 4 legacy `DQ-M-000004…7` tickets, naming the new ref. The legacy tickets stay `resolved/accepted_no_fix`, because history is not rewritten.
- **If Q1 is no:** M3c is skipped, and KI 22.9 stays as the 4 resolved legacy tickets.

### 10.4 M4 — 008 unmatched issuers (after Pack C; Tue 27–Wed 28)

- **Source:** the 008 build writes its unmatched list to `App/Corporate Atlas/bonds/state/unmatched-issuers.json` (gitignored `state/`), as `[{cik, sec_name, lei|null, co_registrant_of|null}]`.
- **Batch:** M4 inserts one `missing_entity` ticket per CIK:
  - `object_domain='source_record'`, `object_key='sec_cik:'||cik`, `dedupe_key='sec_cik:'||cik`;
  - sev3, `open`;
  - `proposed_resolution` "Create the entity properly (never link a subsidiary filer to its parent — 008 §11 rule 2)";
  - one member `create_entity`;
  - a `created` event.
- **Rows:** ≤ 33.
- **Later runs (008 re-verification, §11 rule 4):**
  - **if Q2 = yes**, 008's runner calls D-2 with an Access service token, and the server's dedupe makes repeats free;
  - **otherwise** the list is re-handed and M4 is re-run (an idempotent re-run).

---

## 11. D1 budget and the three-point check

Counting basis: 003 §11 (INSERT = 1 + 1 per index; UPDATE = 1 + 1 per changed index key).

### 11.1 Writes

| Source | Per unit | Volume | Per day / one-time |
|---|---|---|---|
| D-2 create: INSERT ≈ 8 (row + 7 indexes) + case_ref UPDATE 2 + event 3 | ≈ 13 | ≤ 20 a day (button + console) | ≤ 260 / day |
| `reported_again` event | 3 | ≤ 20 a day | ≤ 60 / day |
| C-2 transition (UPDATE ≈ 2 + event 3) | ≈ 5 | ≤ 30 a day | ≤ 150 / day |
| `member_update` (member UPDATE 1 + 0–1 index; ticket bump 1; event 3) | ≈ 6 | ≤ 20 a day | ≤ 120 / day |
| **Steady total** | | | **≤ ≈ 600 / day** (0.6% of 100k) |
| `005-ops-dq.sql` | — | — | ≈ 0 (empty table) |
| **M3a** (1 ticket 13 + 37 members × 3 + 3 events × 3 + 2 legacy dismissals × 5) | | | ≈ 145 |
| **M3b** (13 + 24 × 3 + 3) | | | ≈ 90 |
| **M3c** (13 + 4 × 3 + 5 events × 3) | | | ≈ 40 |
| **M4** (≤ 33 × (13 + 3 + 3)) | | | ≤ 630 |
| **One-time total** | | | **≤ ≈ 900** (≤ ≈ 700 if, as expected, ≤ 20 issuers are unmatched) |

**Daily create cap:** `OPS_DQ_DAILY_CREATE_CAP = 100`, counted with:

```sql
SELECT COUNT(*) FROM ops_data_quality_ticket
 WHERE status = 'open' AND severity IN ('sev1','sev2','sev3','sev4') AND opened_at >= :today
```

Plan: `SEARCH … idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)`. When the cap is reached, D-2 answers 429. Seeds are exempt.

### 11.2 Reads and query plans

| Query | Plan (author's local check, §15) | Rows read |
|---|---|---|
| D-1 default | `SEARCH ops_data_quality_ticket USING INDEX idx_ops_dq_queue (status=?)` per status, keyset | ≤ 3 × (limit + 1) ≤ 153 |
| D-1 `?type=` | `SEARCH … idx_ops_dq_type (ticket_type=? AND status=?)` | ≤ limit + 1 per status |
| D-1 object filter | `idx_ops_dq_object (object_domain=? AND object_key=?)` + `idx_ops_dq_member_object (…)` → PK | ≤ 50 |
| D-2 dedupe guard | `idx_ops_dq_object` (subquery) | ≤ 10 |
| D-2 cap count | `idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)` | ≤ 100 |
| C-1 DQ detail | case_ref autoindex 1 + events ≤ 200 (`idx_ops_case_event_subject`) + members ≤ 200 (UNIQUE autoindex, `ticket_id=?`) + linked exception 1 | **≤ 405** |
| C-2 `resolve` member check | `SELECT 1 FROM ops_dq_ticket_member WHERE ticket_id = ? AND member_status = 'open' LIMIT 1` (autoindex prefix) | ≤ 500 worst, typically ≤ 37 |
| D-3 page | 0 D1 reads (validation only) | 0 |

**Per-call maximum ≤ 500. Daily** at about 100 console and page calls ≈ 3k reads.

### 11.3 Three-point check

| Point | Result |
|---|---|
| 1. Index audit | Every query is a `SEARCH` on a named index, or a PK or unique probe. No Entities, ETF or `fundholdingsmonthly` table is read; M3 and M4 embed their lists. One new table and one new index. |
| 2. Single execution < 50k reads | Max ≈ 500 (C-1 on a full aggregate, or the `resolve` member check). Measured at build (AC-15). |
| 3. Read/write budget per invocation | §11.1–§11.2. Build writes ≤ 900, inside the F-5 ceiling and checked against `d1-today` before each seed. |

### 11.4 Kill switches

| Switch | Effect | Cost |
|---|---|---|
| `OPS_DQ_CONSUMER_ENABLED="false"` + deploy | D-3 shows "Reporting is paused"; D-2 refuses `via='nav-007'` with 503 | 0 reads |
| `OPS_DQ_ENABLED="false"` + deploy | D-1, D-2, D-3 and C-2 for `DQ-` refs answer 503 before D1 | — |
| 003's `OPS_CASES_ENABLED` | Still closes everything | — |
| 007's own switch | Its front-end release simply doesn't ship the button | — |

---

## 12. Worker size

| File | After 003 | After 004 |
|---|---|---|
| `src/cases.js` | ≈ 450 | ≈ 800 (DQ engine, members, D-1, D-2) |
| `src/dq-page.js` (new; the D-3 HTML and its inline script) | — | ≈ 180 |
| `src/ops-api.js` | ≈ 1,100 | ≈ 1,115 (3 router lines, imports) |

Every file stays under 1,500 lines. The Worker has 14 endpoints, leaving **1 spare**. Anything beyond that needs another split decision, so 005 must not add Worker routes; it uses these ones.

---

## 13. Requirements

**P0:**

| # | Requirement |
|---|---|
| R1 | `005-ops-dq.sql` |
| R2 | D-1, D-2 (§8.3 rules, §9.3 dedupe, §8.4 CSRF guard, cap) |
| R3 | The DQ engine in C-1/C-2 (§7) |
| R4 | The D-3 page (§9) |
| R5 | M3a, M3b (with members, or 0 members if the file is late), M3c (if Q1 = yes), M4 |
| R6 | Tests (§15) and the build report |

**P1:**
- service-token raising for 008 (Q2);
- the sweep's DQ count in the macOS notification (Q3: one `idx_ops_dq_queue` count, 0 writes, plus a one-line change to `check-pipeline-health.js`);
- `age_h`/`overdue`.

**P2:**
- tickets shown on entity, instrument and bond pages;
- a DQ detection sweep;
- per-member links from member rows to fix packets.

---

## 14. Acceptance criteria (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | No JWT, or the wrong AUD | D-1, D-2, D-3, or C-1/C-2 on a `DQ-` ref | 401, no CORS headers, counts unchanged |
| AC-2 | An open ticket | `triage` → `schedule_fix` (`fix_ref`) → `resolve fixed` | Each step 200, with 1 event each (`triaged`, `fix_scheduled` with `payload.fix_ref`, `resolved`), `resolved_by` = the JWT email |
| AC-3 | An aggregate with 1 open member | `resolve` without `force` | 409 `members_open`; nothing written. With `force: true` and a note → 200 |
| AC-4 | Any ticket | `resolve` with `disposition='duplicate'`, or `dismiss` with `fixed` | 400 |
| AC-5 | A legacy `DQ-M-*` ticket | C-1 | `disposition` is shown verbatim (`do_not_merge`, `accepted_no_fix`), with the 003 M1 events (`created`, `decision_recorded`, `migrated`) |
| AC-6 | A signed-in user and a 007 URL with `type=missing_mapping&key=ISIN:US0000000000…&via=nav-007` | Open D-3, Submit | 201. Ticket `raised_via='consumer_screen'`, `source_system='ma-ui'`, `object_domain='instrument'`, `raised_by` = the JWT email, and `object_ref` holding only the whitelisted keys |
| AC-7 | AC-6 done | Submit the same URL twice more the same day | 200 `deduplicated` with the same `case_ref`; exactly **1** `reported_again` event. After the ticket is resolved, a new report creates a new ticket. |
| AC-8 | No Access session | Open the D-3 URL | Access login, then the prefilled form with the same values |
| AC-9 | M3b loaded | `member_update` on one member → `fixed` | The member row changes; 1 `member_updated` event; the ticket's `updated_at` changes; `expected_member_status` stale → 409 |
| AC-10 | A ticket and an exception | `link_exception` | C-1 on the ticket shows the exception; C-1 on the exception shows the ticket (003 `idx_ops_dq_linked_exc`) |
| AC-11 | 003 V2 passed | M3a | 1 ticket with 37 members; `DQ-M-000008/9` `dismissed/duplicate` with events naming the new ref; payload keeps `pending`. Re-run: 0 changes |
| AC-12 | The member file is present (or not), and Q1 is answered | M3b, M3c | 22.44: 24 members, actions 6/5/13 (or 0 members and a note). 22.9 per Q1. Re-run: 0 changes |
| AC-13 | 008's unmatched list | M4 | One `missing_entity` ticket per CIK, with no parent link and no duplicates on re-run |
| AC-14 | `OPS_DQ_CONSUMER_ENABLED="false"` | D-3 and D-2 with `via=nav-007` | The page says paused; D-2 503; console create still 201 |
| AC-15 | Production | Each route once | `rows_read`: D-1 ≤ 153, D-2 ≤ 120, C-1 (KI 22.17 ticket) ≤ 405; remote EXPLAIN matches §11.2 |
| AC-16 | A static check | grep of `App/` and `docs/` | No ops key, JWT or ticket content in front-end code. 007's button builds only the §9.1 URL. |

---

## 15. Test plan (order)

1. **`App/Ops/tests/dq-contract.mjs`** (`node:sqlite`, the real migrations 002–005, the real `ops-api.js`, `cases.js` and `dq-page.js`; RS256 test keys as in 003): AC-1 to AC-7, AC-9, AC-10 and AC-14, the caller-class matrix (§8.3), the CSRF header rule, the cap (429), and object-key validation including 007's placeholders.
2. **`App/Ops/tests/dq-seeds.mjs`:** applies 003 M1 to the 015b/015c rows, runs V2 (**before** M3a), then M3a, M3b (from a fixture with the same shape), M3c and M4 (fixture). Checks AC-11 to AC-13 and re-runs each for 0 changes.
3. **`dq-page` render test:** escaping (a `<script>` value in `ref` comes out inert), CSP header present, the whitelist drops extra keys, an invalid `type` gives the error page.
4. **Remote, in order:** `005-ops-dq.sql` → deploy → AC-1 → AC-15 → M3a → M3b → M3c (per Q1) → M4 (after the 008 list) → AC-6 to AC-8 in production (Founder, a browser on the real site) → AC-14 (switch on, then off again).

**Author's local check of this spec's SQL (not a review):**
- **Setup:** Python `sqlite3` with the real `002-ops-control-plane.sql`, 003's index, this §6 DDL, and 003's M1 over the real 015b/015c rows.
- **Result (15 Oct):** after M1 there are 9 tickets. **M3a:** 44 changes → `DQ-000010` (`triaged`, 37 distinct members), and `DQ-M-000008/9` → `dismissed/duplicate` with `resolution_note` naming `DQ-000010`. Their `dismissed` events keep `from_value='open'`, `legacy_disposition='pending'` and `duplicate_of='DQ-000010'`. **Re-run: 0 changes.**
- **`EXPLAIN QUERY PLAN`** (all `SEARCH`, matching §11.2):
  - D-2 guard → `idx_ops_dq_object`;
  - cap count → **covering** `idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)`;
  - `resolve` member check and the member list → `sqlite_autoindex_ops_dq_ticket_member_1 (ticket_id=?)`;
  - object filter → `idx_ops_dq_member_object`;
  - `?type=` → `idx_ops_dq_type`;
  - D-1 default → `idx_ops_dq_queue`.
- **Limitation:** local plans only. Remote plans are confirmed at build (AC-15).

---

## 16. Build plan (Claude Code, LANE-1-ENG; ML-1012-2 commit rule)

Every remote step reads `d1-today` first, avoids the FREEZES windows, and keeps 2 minutes clear of the sweep slots. **UK clocks change Sun 25 Oct:** from then the slots are 08:00, 12:00, 18:00 and 22:00 UTC, and the boost windows move by an hour in UTC. Re-read FREEZES.json on the day.

| Day | Work | Remote writes |
|---|---|---|
| **By Fri 16** | The Founder answers Q1–Q3. The Data-Identity Lead starts `ki-22-44-members.json`. | 0 |
| **Fri 23 (003's buffer day, only if 003 is on track)** | `005-ops-dq.sql` local; `cases.js` DQ engine skeleton and test 1 scaffolding (local only) | 0 |
| **Mon 26 (after 08:05 UTC; 03:30–08:00 is the seed freeze)** | `005-ops-dq.sql` remote. D-1, D-2 and the engine. Tests 1 and 2. Deploy `meridian-ops`. AC-1, AC-15 (part). | ≈ 1 + tests ≤ 50 |
| **Tue 27** | D-3 page and test 3. Deploy. M3a, M3b, M3c. AC-11, AC-12. Hand the D-3 URL to the 007 lane. | ≈ 275 |
| **Wed 28** | M4 (008 list). AC-6 to AC-8 with the Founder. AC-13, AC-14, AC-15. Report. **007 Phase 4 can ship its button from here** (007 §12: "by 28 Oct; else deferred"). | ≤ 630 |
| Thu 29 | Buffer; 005 UAT uses D-1, C-1 and C-2 | 0 |

**Dependencies:**

| # | Dependency |
|---|---|
| D-1 | 003 built, with C-1/C-2 and `idx_ops_dq_linked_exc` live, and M1 verified |
| D-2 | A6 live (003 D-1) |
| D-3 | 008 Pack C done and the unmatched list written |
| D-4 | The Data-Identity Lead's KI 22.44 member file |
| D-5 | The 007 lane builds Phase 4 against §9.1 |
| D-6 | 005 builds on D-1, C-1 and C-2 and adds no Worker routes (§12) |

**If 004 slips past Wed 28:** 007's button is deferred (007 §12; it is not on the never-cut list). M3 and M4 still run, because the tickets matter more than the button.

---

## 17. Rollback

| Change | Trigger | Rollback | Check |
|---|---|---|---|
| `meridian-ops` 004 deploy | Errors or a read regression | `OPS_DQ_ENABLED="false"`, or redeploy the 003 version | 503s, or the routes are gone; 003 routes unaffected |
| D-3 page only | Abuse or a page defect | `OPS_DQ_CONSUMER_ENABLED="false"` | The page says paused |
| `ops_dq_ticket_member` | Never expected | Leave it in place (additive; nothing reads it after a rollback). A drop needs Founder approval and an export first. | — |
| M3/M4 seed tickets | Wrong content | `dismiss` the ticket with `not_a_problem` and a note, plus `member_update` to `not_a_problem`. Events cannot be deleted (trigger), so they stay as an honest record. A corrected seed uses a new `dedupe_key` (`ki:22.44.r2`). | C-1 shows dismissed |
| M3a legacy dismissals | The Data-Identity Lead disagrees with the consolidation | C-2 `reopen` on `DQ-M-000008/9` (`open`; prior disposition in the event) | Both open again |

There is no Entities, ETF or front-end change to roll back. 007's button is 007's release.

---

## 18. Success metrics (31 Oct)

- **Leading:**
  - KI 22.44, 22.17 and 008's unmatched issuers are all on record with an owner (100%).
  - ≥ 1 real report through the 007 button at UAT, with 0 duplicates.
  - 100% of transitions are audited.
- **Lagging (November):**
  - the share of KI 22.44 members `fixed` after the Data-Identity Lead's correction packet;
  - KI 22.17 members left after 013;
  - the median days from `open` to `triaged` (target ≤ 7 for sev3).

---

## 19. Open questions for the Founder (3)

1. **Q1: Reopen KI 22.9 for a fix?** On 22 Aug you accepted the 4 bad `legal_parent` edges as `accepted_no_fix`. 006 has since confirmed that none has any GLEIF relationship behind it, and 007's navigation will show those ETFs under a company parent. **Recommended: yes.** A new aggregate ticket proposes deleting the 4 edges (≈ 16 Entities writes, a Data-Identity Lead packet after 24 Oct). Your August decision stays on record unchanged. If no, nothing is seeded.
2. **Q2: May 008's runner raise its own `missing_entity` tickets?** It would use an Access service token, which depends on your answer to 003 Q3. **Recommended: yes**, so re-verification after October raises tickets without a manual step. If no, Ops re-loads 008's hand-over list each time.
3. **Q3: Should new DQ tickets appear in the health-check's macOS notification?** For example, "2 new data-quality tickets". It costs one indexed count per sweep and 0 writes. **Recommended: yes**, because button reports otherwise wait for 005's console to be opened.

### Review questions (not Founder)

| # | Question | For |
|---|---|---|
| RQ-1 | Accept `ops_dq_ticket_member` (new Ops table) and `idx_ops_dq_member_object`? | Architect |
| RQ-2 | Accept the object-scoped dedupe (§9.3) instead of 007's permanent `dedupe_key`? | Architect; 007 owner (informed) |
| RQ-3 | Accept the page path `/api/ops/admin/dq/new` (inside the existing Access prefix), its CSP, and the `X-Ops-Client` CSRF rule? | Architect |
| RQ-4 | Confirm the prefill mapping `domain=entities` → `instrument`/`entity`, and the `ref` whitelist. | Data-Identity Lead; 007 owner (informed) |
| RQ-5 | Confirm the `ticket_type` and `disposition` vocabularies, the KI 22.17 consolidation (dismissing `DQ-M-000008/9`), the `source_record` key formats, and the KI 22.44 member file. | Data-Identity Lead |
| RQ-6 | Confirm M4's input format with the 008 build lane (`bonds/state/unmatched-issuers.json`). | Data-Identity Lead / LANE-8-ENG |

---

## Appendix A — Read pack

**None needed for this spec.** Every count comes from evidence files: 37 ISINs (007 Appendix A Q5), 24 wrong LEIs (006), 4 edges (006 and 015c), and 9 legacy rows (003 read pack R1/R2, being run in T12 today).

Three **build-time checks** (≤ 200 reads, run on Tue 27 before M3):

| # | Check | Why |
|---|---|---|
| B1 | `SELECT isin, COUNT(DISTINCT entity_id) FROM entity_isin_map WHERE isin IN (<37>) GROUP BY isin`, through `idx_entity_isin_map_isin` (≤ 80 rows) | Records how many of the 37 are still ambiguous after any 013 merges. Members whose ISIN is no longer ambiguous get `member_update` → `fixed` straight after M3a. |
| B2 | `SELECT entity_id, lei FROM entity_master WHERE entity_id IN (<24>)`, PK (24 rows) | Confirms `current_lei` in the member file still matches live data, because 011 never overwrites an existing LEI |
| B3 | `SELECT COUNT(*) FROM ops_data_quality_ticket WHERE legacy_source = 'entity_exceptions'`, autoindex | Must equal 003's M1 count before M3a |

---

## Appendix B — Inputs read (SHA-256 at read time, 15 Oct)

| File | SHA-256 |
|---|---|
| `claude/packets/MA-OCT-003.SPEC_Control_v1.md` | `c38b4b7a1d6ec562c5a018d979bea8eb87e545eca6bddbd6e510f36024fb5cd2` |
| `claude/packets/MA-OCT-003.SPEC_Task_v1.md` | `8b23b06f03253abe7421d108c001ec456f0fc1972bd5c60399973af6cddfe675` |
| `claude/MA-OCT-003_Spec.md` (rev 0) | `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` |
| `claude/MA-OCT-007_Spec.md` (rev 1.4) | `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c` |
| `claude/MA-OCT-007_AppendixA_Results.md` | `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa` |
| `claude/MA-OCT-008_Spec.md` (rev 1.2) | `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` |
| `claude/MA-OCT-008_AC17_Signoff.md` | `5cdb7d89ac34360698b991c6d1769a5381b5a0a5d1b222cc46462063f889f4e0` |
| `claude/packets/MA-OCT-008.BUILD_Report.md` | `142383c67c6687d7029dd7f12f532c605b0534b2a691eb32d9bddb0f9ef6220b` |
| `claude/MA-OCT-006_Remediation_Matrix.md` | `db5942247275b450536e5e2370f7e36bd12b389bb4935e9202bfaa6049f33b5a` |
| `claude/MA-OCT-006_Evidence.md` | `0d1bbf9b69f1e6a28e3bffe4f07175e500f9293c3ee5adb3f20fbdb526ddb1bc` |
| `claude/MA-OCT-006_Closeout_Summary.md` | `f54ae3bf814d81916cc1b332a7e5e1f43b507e264fbe220ee950cfaaa7637537` |
| `claude/MA-OCT-006_Spec.md` | `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273` |
| `claude/MA-OCT-013_Spec_Brief.md` | `a79bb98b7c0966bb6de2d16594208c041f033673992e9663f8806214700613de` |
| `claude/packets/GATE-1012_Decision.md` | `a9ddd037c6860774b30598b6ecfabbef5208a74e6ca5fd441adcc93b728f9e9a` |
| `claude/October_Decisions_Log.md` (15 Oct) | `f761cc4b955916311490db9edbdaadca2d07999e07921138b22ec85f0db43f6f` |
| `claude/meridian-october-revised-scope-v2.md` | `967bebd7c1762a0389d150d96a04ae08c4f0df0cdaf127328f0f4a88e1f33445` |
| `claude/Meridian_October_Operating_Kit_v3_Addendum.md` | `d816aa2b6101d0507282ee770a6363e66ed77505c1c75cf10b3241bbaa6cbc46` |
| `claude/MA-OCT-001_Spec.md` | `d69e0ade3cb320a409c44df6c1d18dbc453a8c98ce9f7d94e29c20137fa9b3a5` |
| `App/Ops/migrations/002-ops-control-plane.sql` | `6a12bae6077b932696083cb2b9e058d5e618d0c499ad6edff8e2cd6295fdc836` |
| `App/Ops/src/ops-api.js` | `c77973deb5d9d9d69335becee56b9e2c841f897721af3bd0a9aa39cf8c9d7f19` |
| `App/Corporate Atlas/migrations/ma-sep-015b-entity-exceptions.sql` | `77ef2ce9949fd82eab83ec0012a0fa5e06727e23854628af7926fd30fbdbba65` |
| `App/Corporate Atlas/migrations/ma-sep-015c-seed-known-issues.sql` | `cf006427970cb7f6068ceb0f99d72ff6240abff26ece08e97a26f73d3b0b8bf1` |

**Limits of this spec lane:**
- No D1 access.
- `WORK/day6/wrong_lei_detail.csv` is outside the repo and was not read, so the 24 entity ids come from the Data-Identity Lead's export (§10.2).
- 008's unmatched count is unknown until Pack C runs.
