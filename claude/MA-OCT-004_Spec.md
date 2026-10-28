# MA-OCT-004 — Data-Quality Ticketing: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane) — Task MA-OCT-003.SPEC v1, item 2
EXECUTED BY:  Operations Lead (packet owner and spec author; LANE-3, doc-only)
REVIEWED BY:  Data-Identity Lead (separate review packet; the author never reviews this). Architect consulted on the new table and the page route (Addendum D1).
APPROVED BY:  Founder
PACKET:       MA-OCT-004 — Data-quality ticketing
GATE:         Spec approval → local build from Mon 26 → remote only after 003 is live (Sat 24) → close-out (ML-1017-3)
STATUS:       REV 1 (Sat 17 Oct 2026; packet MA-OCT-003.R1). Applies REVARC A4-1..A4-4, REVDIL 004-1..004-9, the
              Founder's answers to Q1–Q3 (all YES, 17 Oct), ML-1017-3 and the DIL14 §4 DQ list. Change table: Appendix C.
              Doc-only: 0 D1, no deploys, no git writes.
SUPERSEDES:   rev 0 c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889 (kept as claude/MA-OCT-004_Spec_rev0.md)
DOMAIN:       Ops (Addendum D3). Owner Operations Lead. Only writer of ops_* tables: meridian-ops.
BASELINE:     October-2026 @ 0dd7ef0; meridian-ops 0905784d; builds on claude/MA-OCT-003_Spec.md rev 1 (same packet, MA-OCT-003.R1).
```

**Founder decisions (17 Oct, all YES; were §19 Q1–Q3):**

| # | Decision | Where it lands |
|---|---|---|
| F-1 | **Reopen KI 22.9 as an aggregate ticket.** The deletion of the 4 edges is a Data-Identity Lead packet ≥ Sat 24, using the full edge identity including `source` (004-7). The 22 Aug decision stays on record. | §10.3 (M3c, now unconditional) |
| F-2 | **008's runner raises `missing_entity` itself** with a scoped Access service token (`bond-runner`, 003 §8.5). It can raise only; it never resolves or dismisses. | §8.5, §10.4 |
| F-3 | **The new-DQ count goes in the health-check notification** (one indexed count, 0 writes, no new prompt) | §9.5 |

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
   - **KI 22.44**: one aggregate `wrong_lei` ticket with 24 members (6 replace-with-T1, 5 review, 13 null-and-offline-match), taken from 006 Evidence §15.3 (004-8).
   - **KI 22.17**: one aggregate `isin_duplicate` ticket with the 37 ISINs from 007 Appendix A Q5. The two legacy `DQ-M-000008/9` tickets are dismissed as duplicates of it.
   - **KI 22.9**: one aggregate `bad_relationship_edge` ticket proposing the deletion of the 4 edges (F-1). The members carry the full edge identity, including `source` and `created_at` (004-7).
   - **KI 22.43** (004-3), **`wrong_identifier`** on entity 2289's CIK (004-2) and the **OTP Bank** `entity_merge` pair (004-5).
   - **M5**: the 011 close-out hand-off aggregates (004-4), after 011 closes.
8. **008's unlinked issuers** (`missing_entity`, one ticket per issuer, Founder 008-Q2):
   - **M4** loads the first set, with a **named minimum**: Welltower Inc, GM Financial, Pfizer NL and PepsiCo Singapore Financing I (DIL14 §4, 004-1).
   - Later raises come from 008's runner itself, through the `bond-runner` token (F-2).
9. **The fixes are not 004's.** Corrections to `entity_master`, `entity_relationships` and `entity_isin_map` are Entities-domain writes by Data-Identity Lead packets after the 011 window (≥ 24 Oct). 004 tracks them: per-member status, and `fix_pending` with a `fix_ref`.
10. **Who may resolve (004-9):** tickets on Entities data are resolved or dismissed only by the Data-Identity Lead or the Founder. `fixed` needs an earlier `fix_scheduled` event. A service token can never resolve or dismiss. The three legacy `do_not_merge` decisions cannot be reopened without a recorded Founder supersession (004-6).
11. **013 hand-off (A4-4):** seeds and members are never rewritten when 013 merges entities. Readers resolve `entity` keys through `entity_merge_redirect`, read-only, and show "merged into".
12. **D1:** one-time ≤ about 1,000 writes (M3 + M4 + M5); steady state ≤ about 600 writes and ≤ about 3k reads a day; no execution above 500 reads (§11).

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

1. **Every known DQ issue is on record:** KI 22.44 (24 members), KI 22.17 (37 members), KI 22.9 (4 members, F-1), KI 22.43, the 2289 `wrong_identifier`, the OTP Bank pair, 008's unmatched issuers (the named 4 at least, 1 ticket each) and the 011 hand-off aggregates (M5). Each has an owner role and a status (AC-11, AC-12).
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
| `ops_data_quality_ticket` (001) | Live, 0 rows | 9 `DQ-M-*` rows after 003 M1 (Sat 24) |
| 003 engine, C-1, C-2 | Rev 1 (this packet) | **Built locally Mon 19 – Fri 23; live from Sat 24** (ML-1017-3, A4-1). 004 builds locally from Mon 26 and **deploys only after 003 is live**. 004 extends `cases.js`. |
| A6 | Not built | Done by the 003 build (003 D-1) |
| Access app "meridian-ops admin" on `/api/ops/admin` | Live | D-3 sits under that prefix, so the page is Access-gated with no new app |
| 011 run 17–24 Oct; Entities writers frozen | Scheduled | 004 makes no Entities writes. M3 reads no Entities tables (lists are embedded). |
| 008 Pack C linkage and DIL14 | Pack C done; DIL14 (17 Oct) confirms the DQ list with corrections | M4 loads the named minimum set (§10.4) plus anything else in `unmatched-issuers.json`, after 004 is live (Tue 27–Wed 28) |
| KI 22.44 member list | **006 Evidence §15.3 in the repo** (`0d1bbf9b…db1bc`) holds all 25 rows (24 wrong + OPAP cleared) | The M3 seed data (Appendix D) embeds the 24 rows from §15.3 (004-8). No export from `WORK/` is needed. |
| `entity_merge_redirect` (013) | Not yet written (013 runs after 011) | C-1 and D-1 read it **if present**, tolerating a missing table as 007 R3 does (A4-4) |

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
| `open`, `triaged`, `fix_pending` | `resolve` | `resolved` | `disposition` (resolve set), `note`. **An aggregate ticket with any member still `open` → 409**, unless `force: true` with a note naming why. **Entities-data types (§7.5): `fixed` needs an earlier `fix_scheduled` event (409 otherwise), and a service token gets 403.** | `resolved` |
| `open`, `triaged`, `fix_pending` | `dismiss` | `dismissed` | `disposition` (dismiss set), `note`; `duplicate_of` for `duplicate`. **Entities-data types: a service token gets 403.** | `dismissed` |
| `resolved`, `dismissed` | `reopen` | `open` | `note`. **Refused (409 `protected_decision`) on a ticket whose `disposition = 'do_not_merge'` (`DQ-M-000001…3`) unless the body carries `founder_supersession: {reference, decided_at}`** (004-6). That reference goes in the event payload. | `reopened` (prior disposition in `from_value`/`payload`) |
| `open`, `triaged`, `fix_pending` | `add_members` | same | `members[]` (≤ 100 per call; ≤ 500 per ticket) | `members_added` (count) |
| `open`, `triaged`, `fix_pending` | `member_update` | same | `member` (`object_domain`, `object_key`), `member_status`, optional `note` | `member_updated` (`payload`: key, from, to) |

The mechanics are 003 §8.4: a per-action `SET` list, `expected_status`, a required `request_id`, the `NOT EXISTS` idempotency guard, and one event per batch.

**Member-level actions (A4-3).** `member_update`, `add_members` and `link_exception` change a member row or a link column. The ticket bump and the event are conditioned on **that** change having applied, so a no-op never leaves an orphan event and a change never lacks one:

```sql
-- (1) the member change, guarded by expected state and by request idempotency
UPDATE ops_dq_ticket_member SET member_status = :to, note = :note, updated_at = :now
 WHERE ticket_id = :tid AND object_domain = :od AND object_key = :ok AND member_status = :expected_member_status
   AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = 'act:' || :request_id);
-- (2) ticket bump only if (1) applied
UPDATE ops_data_quality_ticket SET updated_at = :now
 WHERE ticket_id = :tid AND EXISTS (SELECT 1 FROM ops_dq_ticket_member
        WHERE ticket_id = :tid AND object_domain = :od AND object_key = :ok AND member_status = :to AND updated_at = :now);
-- (3) event only if (1) applied
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
SELECT 'dq_ticket', CAST(:tid AS TEXT), 'member_updated', json_object('object_domain', :od, 'object_key', :ok, 'from', :expected_member_status, 'to', :to),
       :actor, :actor_source, :actor_role, :now, 'act:' || :request_id
 WHERE EXISTS (SELECT 1 FROM ops_dq_ticket_member
        WHERE ticket_id = :tid AND object_domain = :od AND object_key = :ok AND member_status = :to AND updated_at = :now);
```

The other two follow the same pattern:
- **`add_members`:** `INSERT OR IGNORE` the members with `updated_at = :now`. The bump and event are conditioned on `EXISTS (… member WHERE ticket_id = :tid AND updated_at = :now)`, and the event payload carries the count actually inserted.
- **`link_exception`:** a guarded `UPDATE … SET linked_exception_ref = :exc, updated_at = :now WHERE ticket_id = :tid AND linked_exception_ref IS NOT :exc AND status = :expected_status AND NOT EXISTS (…)`. The event is conditioned on `updated_at = :now`.

**Rule for entity-data members:** `member_update` → `fixed` follows the same authority rule as `resolve fixed` (§7.5). The note names the applied fix packet, and a service token gets 403.

### 7.2 Vocabularies (Worker-validated; `cases.js` constants)

| Field | Values |
|---|---|
| `status` | `open`, `triaged`, `fix_pending`, `resolved`, `dismissed` |
| `severity` | `sev1`–`sev4` (003 meanings). Defaults: consumer reports sev3 (`low_confidence_mapping` sev4); `wrong_lei` sev2; others sev3. |
| `disposition` on `resolved` | `fixed`; 006's four: `source_absence` (a), `valid_exception` (b), `pipeline_omission` (c), `job_failure` (d) |
| `disposition` on `dismissed` | `duplicate`, `not_a_problem`, `wont_fix` |
| `disposition` legacy (read-only; never accepted on a write) | `do_not_merge`, `accepted_no_fix`, `pending` (003 M1, verbatim) |
| `ticket_type` (**O4, confirmed**) | **007:** `missing_mapping`, `ambiguous_mapping`, `low_confidence_mapping`, `merged_link_unresolved`.<br>**008:** `missing_entity` (an SEC issuer with no linked entity; candidates go in members).<br>**006:** `wrong_lei`, plus `no_link_marker` (KI 22.43).<br>**004-2:** `wrong_identifier` (an identifier field such as `cik` stored on the wrong entity; default owner Data-Identity Lead). It is the type DIL14 called `identity_mismatch`; REVDIL's name is taken, because REVDIL also gives the seed shape.<br>**Legacy and known issues:** `entity_merge`, `bad_relationship_edge`, `isin_duplicate`.<br>**011 hand-off (M5):** `gleif_handoff`.<br>**Console:** `data_error` (anything else; the title must say what). |
| `raised_via` | `consumer_screen` (D-3 page), `ops_console` (console and seeds decided by a person), `ingest_auto` (a service caller, e.g. 008 with a service token), `migration` (003 M1) |

### 7.3 Members

| Field | Values |
|---|---|
| `proposed_action` | `replace_lei_t1`, `review`, **`null_and_offline_match`** (22.44; renamed from `null_and_requeue`, because the queue has no `name_search` consumer, 004-8); `dedupe` (22.17); `delete_edge` (22.9); `create_entity`, `confirm_and_assign_lei`, `merge_then_assign_lei` (008, DIL14); `merge_013` (OTP Bank); `none` |
| `member_status` | `open`, `fixed`, `wont_fix`, `not_a_problem` |

### 7.4 Ownership and triage targets

The default `owner_role` is the **Data-Identity Lead** for every type except `data_error` (Operations Lead). Triage targets are display only, as in 003 §7.2: triage within sev1 4 h, sev2 2 days, sev3 7 days, sev4 none. `age_h` and `overdue` are computed in the D-1 response.

### 7.5 Resolve authority for tickets on Entities data (004-9; Founder answer to 003 Q3)

**Entities-data types:** `wrong_lei`, `wrong_identifier`, `no_link_marker`, `bad_relationship_edge`, `entity_merge`, `isin_duplicate`, `missing_entity`, `gleif_handoff`, and the four 007 mapping types.

| Rule | Enforcement |
|---|---|
| `resolve` with `disposition = 'fixed'` needs an earlier `fix_scheduled` event whose `fix_ref` names a Data-Identity Lead packet or CR. The note confirms it was **applied**. | **Worker:** 409 `fix_not_scheduled` without the event (one probe on `idx_ops_case_event_subject`). That the fix was applied is procedural, checked by the reviewer of that packet. |
| `resolve`, `dismiss` and member `fixed` are done by the **Data-Identity Lead or the Founder** | **Procedural:** Access identifies the person, not the role. `actor_role` is recorded on the event, and the D-1 list shows it. |
| **A service token never resolves or dismisses these tickets**, nor reopens them | **Worker:** the `OPS_SERVICE_ACTORS` allowlist (003 §8.5) → 403 before D1 |
| `reopen` on the three `do_not_merge` tickets needs `founder_supersession` | **Worker:** 409 `protected_decision` (§7.1) |
| `fix_ref` lives **only** in the `fix_scheduled` event payload (N4-4) | `proposed_resolution` is never rewritten |

### 7.6 Entity keys after 013 merges (A4-4)

- **Never rewritten.** Seeds, tickets and members keyed by `entity_id` are not changed when MA-OCT-013 merges twins. This covers the KI 22.44 members, 003 M1's `object_key`s, 008's candidate members and the OTP pair.
- **Resolved on read.** C-1 and D-1 resolve each `entity` key through `entity_merge_redirect`. The read is read-only, PK-probed, and **tolerant of a missing table** (the 007 R3 pattern; at most 5 hops, cycle-guarded). They return `merged_into` beside the original key, and the console shows "merged into …".
- **Build check B2** (Appendix A) also compares the 24 KI 22.44 ids with 013's hand-off file (the 392 twins), when that file exists.

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

C-1 (`GET /api/ops/admin/cases/DQ-…`) returns:
- the ticket;
- its events (≤ 200);
- its members: the first page of ≤ 200 in index order (`object_domain, object_key`, no sort), with a **keyset `members_cursor`** for the next page (`?members_after=<domain>|<key>`; N4-2), because a ticket may hold up to 500;
- its linked exception;
- `merged_into` for every `entity` key (§7.6).

C-2 handles §7.1.

### 8.3 D-2 body

- **Required:** `request_id` (UUID), `ticket_type`, `object_domain`, `object_key`.
- **Optional:** `severity`, `title` (≤ 200; default `"<type label>: <object_key>"`), `summary` (≤ 500), `note` (≤ 1,000; stored as the `created` event's body), `object_ref` (JSON ≤ 1.5 kB), `source_system`, `source_record_ref`, `field_name`, `observed_value`, `expected_value`, `evidence` (≤ 2 kB), `proposed_resolution`, `owner_role`, `linked_exception_ref`, `members[]` (≤ 100), `via`.

**Server-set, never from the body:**
- `raised_by`: the JWT email, or `service:<label>` from the allowlist (003 §8.5; the raw `common_name` goes in the event payload).
- `raised_via`: `consumer_screen` if `via='nav-007'` and the actor is a person; `ingest_auto` if the actor is a service token; else `ops_console`.
- `case_ref`: `DQ-` + `printf('%06d', ticket_id)`, through the 003 §8.2 insert-then-update batch with a `DQ-PENDING-<request_id>` placeholder.

**Caller classes:**

| Caller | Types allowed |
|---|---|
| A person with `via='nav-007'` | the 4 007 types |
| The `bond-runner` service token (F-2) | `missing_entity` only, on D-2 only |
| The `ops-script` service token (003 F-3) | none on D-2; on C-2 only `comment`, `assign`, `triage` for `DQ-` refs |
| A person through the console | any type |

Anything else gets a 403, from the 003 §8.5 allowlist, which is checked on **every** admin route. Unknown service tokens are refused before D1 access (A4-2).

### 8.4 CSRF and CORS

- D-2 requires `Content-Type: application/json` **and** `X-Ops-Client: <console|dq-page|service>`.
- A cross-site HTML form can send neither, and any cross-origin `fetch` with them needs a preflight. Admin routes answer preflights with no CORS allowances (001 §6.2), so the browser blocks it.
- D-3 is same-origin with D-2. No `Access-Control-Allow-Origin` is ever sent.


### 8.5 Service tokens (A4-2, F-2)

004 adds **one allowlist entry** to `OPS_SERVICE_ACTORS` (003 §8.5): `bond-runner` → routes `[D-2]`, types `[missing_entity]`.
- It is **one token per caller**: the `bond-runner` token is separate from `ops-script`.
- The token is created by the Founder and **admitted to the "meridian-ops admin" Access policy only after** the 004 deploy carrying the entry is verified (AC-18c).
- It is stored in `~/.meridian-secrets/bond-runner-ops.env` (mode 600), with an expiry set and recorded. It never appears in the repo or logs.
- 008's runner reads it in the same way as its ingest key (008's own build; LANE-8-ENG).

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
- **Caching and policy:** `Cache-Control: no-store`. CSP is `default-src 'none'; script-src 'nonce-…'; style-src 'nonce-…'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'` (REVARC RQ-3 note).
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

### 9.5 New-DQ count in the health-check notification (F-3)

- **What the sweep adds:** one count to its response, `dq_new` = tickets opened since the previous sweep's start.
- **Query:**
  ```sql
  SELECT COUNT(*) FROM ops_data_quality_ticket
   WHERE status = 'open' AND severity IN ('sev1','sev2','sev3','sev4') AND opened_at >= :since
  ```
  Plan: covering `idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)`. `:since` is the previous `local.health-check` start, which L2 already holds. Cost: ≤ 1 + new rows reads, 0 writes.
- **Script change:** `13F Seed/check-pipeline-health.js` adds one line to its existing notification ("2 new data-quality tickets") when `dq_new > 0`. Clean sweeps stay silent, and no new macOS permission is needed (N4-5).
- **When it ships:** with the 004 deploy (Tue 27), as a `meridian-ops` change plus the script change. The script is a local file, so changing it is not a remote step.

---

## 10. Known-issue and source tickets (seeds)

The M3 and M4 batches are reviewed `wrangler d1 execute --remote --file` runs.
- **Actor:** `ops_lead:wrangler`, with `actor_source='system'` (003 DV-2).
- **Idempotency:** each seed ticket carries a fixed `dedupe_key`, so a re-run inserts nothing. The keys are `ki:22.17`, `ki:22.44`, `ki:22.9`, `ki:22.43`, `wrong_identifier:entity:2289:cik`, `entity_merge:2019:467290`, `sec_cik:<CIK>` and `m5:<item>`. The template also refuses a second open ticket on the same object.
- **Calendar (ML-1017-3, A4-1):** every seed runs **after the 004 deploy** (Tue 27 at the earliest), and so after 003's M1 (Sat 24).
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

**Order matters:** the event comes **before** the `UPDATE`, because the event selects `status = 'open'` rows. The legacy row's original `disposition` (`pending`) is kept in that event's payload. Run M3a only **after** 003's V2 check has passed (Sat 24), because V2 compares `disposition` with `decision`.

### 10.2 M3 — the remaining known items (one reviewed data file plus one fixed template)

M3a (above) is hand-written because it also consolidates legacy rows. The remaining seeds share one shape, so they are **data, not code**:

- **Data:** `App/Ops/seeds/m3-seeds.json` and `App/Ops/seeds/m4-minimum.json`. These hold public identifiers and names only, and are tracked. The build creates them **byte-for-byte from Appendix D**, and the build report records each file's SHA-256.
- **Template:** below, fixed in this spec.
- **Generator:** `App/Ops/tools/seed-sql.mjs` (≈ 30 lines). It reads a JSON file, re-serialises it compactly, doubles single quotes, and replaces `__SEEDS__` and `__FILE_SHA__`. It writes `App/Ops/migrations/m3-seeds.sql` / `m4-minimum.sql`, which are run with `wrangler d1 execute --remote --file`.
- **Author's dry-run:** done on 17 Oct (§15).

```sql
-- MA-OCT-004 seed template. The generator App/Ops/tools/seed-sql.mjs replaces __SEEDS__ with the reviewed JSON
-- (single quotes doubled) and __FILE_SHA__ with that JSON file's SHA-256. Idempotent: a re-run changes nothing.
-- (1) tickets: dedupe_key UNIQUE, and never a second open ticket on the same object
INSERT OR IGNORE INTO ops_data_quality_ticket
  (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref, source_system,
   field_name, observed_value, expected_value, evidence, proposed_resolution, owner_role, raised_by, raised_via, dedupe_key)
SELECT 'DQ-SEED-' || json_extract(s.value,'$.dedupe'), json_extract(s.value,'$.type'), json_extract(s.value,'$.sev'),
       json_extract(s.value,'$.status'), json_extract(s.value,'$.title'), json_extract(s.value,'$.summary'),
       json_extract(s.value,'$.od'), json_extract(s.value,'$.ok'), json_extract(s.value,'$.ref'), json_extract(s.value,'$.src'),
       json_extract(s.value,'$.field'), json_extract(s.value,'$.obs'), json_extract(s.value,'$.exp'),
       json_extract(s.value,'$.evidence'), json_extract(s.value,'$.proposal'), json_extract(s.value,'$.owner'),
       'ops_lead:wrangler', 'ops_console', json_extract(s.value,'$.dedupe')
  FROM json_each('__SEEDS__') s
 WHERE NOT EXISTS (SELECT 1 FROM ops_data_quality_ticket x
                    WHERE x.object_domain = json_extract(s.value,'$.od') AND x.object_key = json_extract(s.value,'$.ok')
                      AND x.status IN ('open','triaged','fix_pending'));
-- (2) final case_ref
UPDATE ops_data_quality_ticket SET case_ref = 'DQ-' || printf('%06d', ticket_id) WHERE case_ref LIKE 'DQ-SEED-%';
-- (3) members
INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, object_ref, proposed_action)
SELECT t.ticket_id, json_extract(m.value,'$.d'), json_extract(m.value,'$.k'), json_extract(m.value,'$.ref'), json_extract(m.value,'$.act')
  FROM json_each('__SEEDS__') s
  JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe'),
       json_each(json_extract(s.value,'$.members')) m;
-- (4) created events
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'created', 'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('case_ref', t.case_ref, 'seed', t.dedupe_key, 'members', json_array_length(json_extract(s.value,'$.members')),
                   'file_sha256', '__FILE_SHA__'),
       'seed:' || t.dedupe_key || ':created'
  FROM json_each('__SEEDS__') s JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe');
-- (5) fix_scheduled events (fix_ref lives only here; N4-4)
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(t.ticket_id AS TEXT), 'fix_scheduled', 'fix_pending', 'ops_lead:wrangler', 'system',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), json_object('fix_ref', json_extract(s.value,'$.fix_ref')),
       'seed:' || t.dedupe_key || ':fix'
  FROM json_each('__SEEDS__') s JOIN ops_data_quality_ticket t ON t.dedupe_key = json_extract(s.value,'$.dedupe')
 WHERE json_extract(s.value,'$.fix_ref') IS NOT NULL;
```

| Seed (in `m3-seeds.json`) | Type, severity, status | Anchor object | Members | Source of the facts | Review item |
|---|---|---|---|---|---|
| **KI 22.44** | `wrong_lei`, sev2, `triaged` | `source_record` `known-issue:22.44` | **24** entities from Evidence §15.3 (`0d1bbf9b…db1bc`): **6 `replace_lei_t1`** (528, 596, 1134, 1514, 1803, 1809); **5 `review`** (575, 902, 931, 1049, 1868); **13 `null_and_offline_match`** (576, 702, 838, 890, 899, 927, 943, 1015, 1138, 1157, 1162, 1181, 1455). OPAP 2014 is absent (cleared, D6-4). Member 931 cites `DQ-M-000001`. | Evidence §15.3, §14.4; D5-8, D6-4, D6-5 | 004-8 |
| **KI 22.9** | `bad_relationship_edge`, sev3, `triaged` | `known-issue:22.9` | **4 edges with full identity** (`parent, child, relationship_type, source='gleif', created_at` verbatim, D4 rowid in `object_ref`): 1565→3, 2247→143, 2476→49, 6980→194 | Evidence §14.5; 015c | F-1, 004-7 |
| **KI 22.43** | `no_link_marker`, sev3, `fix_pending` (`fix_ref` MA-OCT-011 bucket C) | `known-issue:22.43` | 0 (657 > the 500 cap); the 011 close-out list SHA is added later by `comment` (H-1) | Matrix rank 3 (RC-5); D7-2 | 004-3 |
| **Welltower OP LLC CIK** | `wrong_identifier`, sev2, `triaged` | `entity` 2289, `field_name='cik'`, observed `0000766704`, expected `0001917598` | 0 | DIL14 §4 DQ-1 | 004-2 |
| **OTP Bank pair** | `entity_merge`, sev3, `fix_pending` (`fix_ref` MA-OCT-013) | `entity` 2019 | entity 2019 and 467290 (`merge_013`) | 011 FRI report; RELARC N-3 | 004-5 |

**M3c companion (`m3c-links.sql`, run after the template):** a `linked` event on each of the 4 legacy `DQ-M-000004…7` tickets, naming the new aggregate. The legacy rows are **not** updated; the 22 Aug `accepted_no_fix` stays verbatim.

```sql
-- M3c: link the 4 legacy KI 22.9 tickets (resolved, accepted_no_fix, unchanged) to the new aggregate.
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, body, actor, actor_source, occurred_at, payload, idempotency_key)
SELECT 'dq_ticket', CAST(l.ticket_id AS TEXT), 'linked',
       'Reopened as a fix in ' || a.case_ref || ' (Founder 17 Oct, MA-OCT-004 F-1). This 22 Aug decision is kept unchanged.',
       'ops_lead:wrangler', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       json_object('superseded_by', a.case_ref, 'legacy_disposition', l.disposition), 'seed:ki:22.9:link:' || l.case_ref
  FROM ops_data_quality_ticket l, ops_data_quality_ticket a
 WHERE l.legacy_source = 'entity_exceptions' AND l.ticket_type = 'bad_relationship_edge' AND a.dedupe_key = 'ki:22.9';
```

**The later edge delete (Data-Identity Lead packet ≥ Sat 24, not 004) must match all five identity fields** of each member's `object_ref`. A row whose `source` or `created_at` differs, for example an edge 011 wrote, is never deleted (004-7). Build check B4 (Appendix A) re-reads the 4 rows by primary key before M3.

### 10.3 (merged into §10.2: KI 22.9 is now unconditional, per Founder decision F-1)

### 10.4 M4 — 008 unmatched issuers: the named minimum set plus 008's list (004-1; DIL14 §4)

The same template, run on `m4-minimum.json` (Appendix D), then on the tickets generated from 008's `bonds/state/unmatched-issuers.json` (`[{cik, sec_name, lei|null, co_registrant_of|null}]`). The generator maps each row to a `missing_entity` seed with `dedupe='sec_cik:'||cik`. The file's SHA-256 is recorded in the build report (N4-3).

**Named minimum set, seeded whatever the file holds.** DIL14 corrected REVDIL here, and DIL14's evidence is taken: GM Financial and Pfizer NL do have candidate entities. Each ticket's members say what to do.

| CIK | Issuer | LEI (in `object_ref`) | Members (`proposed_action`) | Note |
|---|---|---|---|---|
| 0000766704 | Welltower Inc | `254900F33BIAR82QTA19` | `gleif:254900F33BIAR82QTA19` (`create_entity`) | sev4: 0 final bond rows. Never link to Welltower OP LLC (2289). |
| 0000804269 | GM Financial | `5493008B6JBRUJ90QL97` | entities 3324, 30187, 103981 (`merge_then_assign_lei`) | A duplicate cluster with no LEI. Do not create a fourth row; this is a 013 input. |
| 0002058265 | Pfizer Netherlands International Finance B.V. | `254900YI79T8NMNA4349` | entity 106006 (`confirm_and_assign_lei`) | `co_registrant_of = 'Pfizer Inc'`; **never linked to the parent** (L8-12) |
| 0002007029 | PepsiCo Singapore Financing I Pte. Ltd. | unknown | entities 3367, 31416 (`merge_then_assign_lei`) | **Its 4 rows currently sit under guarantor PepsiCo Inc (1457, P-1).** 008's R-1 moves them; the link stays `unmatched` until resolved; never link to the guarantor. |

**Later raises (F-2):** 008's runner calls D-2 with the `bond-runner` token (§8.5). The object-scoped dedupe (§9.3) makes a repeat raise for a CIK with an open ticket return the existing ticket.

### 10.5 M5 — MA-OCT-011 close-out hand-off (004-4; after 011 closes, ≥ Sat 24)

The same template. **One aggregate `gleif_handoff` ticket per item**, each with 0 members, `owner_role` Data-Identity Lead, anchor `source_record` `ma-oct-011:<item>`, and `evidence` = the list file and SHA-256 that **LANE-11 supplies at 011 close-out (H-1)**. M5 runs only when those SHAs exist; until then the build records it as waiting on H-1.

| `dedupe` | Item | Count (011 / REVDIL) |
|---|---|---|
| `m5:deferred_a_edges` | Deferred A edges | 215 |
| `m5:t1_lapsed_parents` | T1_LAPSED parent LEIs and their waiting edges | 6 LEIs, 3 edges |
| `m5:e1_exclusion` | The E-1 exclusion: child 99231, parent `549300CZ8QS1GE53O776` (RC-12) | 1 |
| `m5:ki2241_to_013` | LEIs on several rows (KI 22.41 → 013) | 31 LEIs / 62 rows |
| `m5:government_rows` | Government rows excluded from automated matching (D7-1) | 9 |
| `m5:report_only_tiers` | Report-only tiers: T1_LAPSED 1,342; T1+/T1c 1,739; N+ 852; review 2,336 | 6,269 |
| `m5:no_reason_rows` | Rows with neither RR nor RX | 128 |

### 10.6 Seeds and the 013 merges (A4-4)

These rows are **never rewritten** by 013: the KI 22.44 members, the OTP pair, the 008 candidate members, and 003 M1's `object_key`s. They are read through `entity_merge_redirect` (§7.6).

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
| **M3** template (5 tickets × 13 + 30 members × 3 + 5 created + 2 fix_scheduled events × 3) + M3c links (4 × 3) | | | ≈ 190 (author's dry-run: 47 + 4 row changes before index entries) |
| **M4** (the 4 named tickets × 13 + 7 members × 3 + 4 events × 3, plus ≤ 29 more from 008's list × 19) | | | ≈ 85 + ≤ 550 |
| **M5** (7 tickets × (13 + 3)) | | | ≈ 115 |
| **One-time total** | | | **≤ ≈ 1,100** (≈ 550 if, as expected, 008's list adds few beyond the named 4). Each `--file` run reads `d1-today` first (F-5). |

**Daily create cap:** `OPS_DQ_DAILY_CREATE_CAP = 100`, counted **across all five statuses** (N4-1), so triaging a ticket does not free cap:

```sql
SELECT COUNT(*) FROM ops_data_quality_ticket
 WHERE status IN ('open','triaged','fix_pending','resolved','dismissed')
   AND severity IN ('sev1','sev2','sev3','sev4') AND opened_at >= :today
```

Plan: 5 × 4 seeks on the covering `idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)`; it reads only today's tickets. When the cap is reached, D-2 answers 429. Seeds are exempt.

### 11.2 Reads and query plans

| Query | Plan (author's local check, §15) | Rows read |
|---|---|---|
| D-1 default | `SEARCH ops_data_quality_ticket USING INDEX idx_ops_dq_queue (status=?)` per status, keyset | ≤ 3 × (limit + 1) ≤ 153 |
| D-1 `?type=` | `SEARCH … idx_ops_dq_type (ticket_type=? AND status=?)` | ≤ limit + 1 per status |
| D-1 object filter | `idx_ops_dq_object (object_domain=? AND object_key=?)` + `idx_ops_dq_member_object (…)` → PK | ≤ 50 |
| D-2 dedupe guard | `idx_ops_dq_object` (subquery) | ≤ 10 |
| D-2 cap count | `idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)` | ≤ 100 |
| C-1 DQ detail | case_ref autoindex 1 + events ≤ 200 (`idx_ops_case_event_subject`) + one member page ≤ 200 (UNIQUE autoindex, `ticket_id=?`, keyset) + linked exception 1 + `entity_merge_redirect` PK probes for `entity` keys on the page (≤ 200 × ≤ 5 hops, typically 0, because the table is absent until 013) | **≤ 405 typical; ≤ 500 with redirects** |
| `resolve fixed` precondition | `idx_ops_case_event_subject (subject_type=? AND subject_id=?)`, `event_type='fix_scheduled'` | ≤ 200 |
| §7.1 guards (`NOT EXISTS` idempotency, member `EXISTS`) | `sqlite_autoindex_ops_case_event_1`, member UNIQUE autoindex | 1–2 per action |
| C-2 `resolve` member check | `SELECT 1 FROM ops_dq_ticket_member WHERE ticket_id = ? AND member_status = 'open' LIMIT 1` (autoindex prefix) | ≤ 500 worst, typically ≤ 37 |
| D-3 page | 0 D1 reads (validation only) | 0 |

**Per-call maximum ≤ 500. Daily** at about 100 console and page calls ≈ 3k reads.

### 11.3 Three-point check

| Point | Result |
|---|---|
| 1. Index audit | Every query is a `SEARCH` on a named index, or a PK or unique probe. No ETF or `fundholdingsmonthly` table is read. Entities reads are only the `entity_merge_redirect` PK probes (A4-4) and build checks B1, B2 and B4. M3 and M4 embed their lists. One new table and one new index. |
| 2. Single execution < 50k reads | Max ≈ 500 (C-1 on a full aggregate, or the `resolve` member check). Measured at build (AC-15). |
| 3. Read/write budget per invocation | §11.1–§11.2. Build writes ≤ 1,100, inside the F-5 ceiling and checked against `d1-today` before each seed. |

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
| R5 | M3a; the M3 template seeds (KI 22.44, KI 22.9, KI 22.43, `wrong_identifier` 2289, OTP Bank) with the M3c links; M4 (the named 4 + 008's list); M5 when H-1 delivers |
| R6 | §7.5 resolve authority, §7.1 `do_not_merge` reopen guard, §7.1 member guards (A4-3), §7.6 redirect resolution (A4-4) |
| R7 | The `bond-runner` allowlist entry (§8.5, F-2) and the `dq_new` count in the sweep and the health-check notification (§9.5, F-3) |
| R8 | Tests (§15) and the build report |

**P1:**
- `age_h`/`overdue`.

**P2:**
- tickets shown on entity, instrument and bond pages;
- a DQ detection sweep;
- per-member links from member rows to fix packets.

---

## 14. Acceptance criteria (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | No JWT, or the wrong AUD; or a POST without JSON + `X-Ops-Client` | D-1, D-2, D-3, or C-1/C-2 on a `DQ-` ref | 401 or 400 before D1, no CORS headers, counts unchanged |
| AC-2 | An open ticket | `triage` → `schedule_fix` (`fix_ref`) → `resolve fixed` | Each step 200, with 1 event each (`triaged`, `fix_scheduled` with `payload.fix_ref`, `resolved`), `resolved_by` = the JWT email. `proposed_resolution` is unchanged (N4-4). |
| AC-3 | An aggregate with 1 open member | `resolve` without `force` | 409 `members_open`; nothing written. With `force: true` and a note → 200 |
| AC-4 | Any ticket | `resolve` with `disposition='duplicate'`, or `dismiss` with `fixed` | 400 |
| AC-5 | A legacy `DQ-M-*` ticket | C-1 | `disposition` is shown verbatim (`do_not_merge`, `accepted_no_fix`), with the 003 M1 events (`created`, `decision_recorded`, `migrated`) |
| AC-6 | A signed-in user and a 007 URL with `type=missing_mapping&key=ISIN:US0000000000…&via=nav-007` | Open D-3, Submit | 201. Ticket `raised_via='consumer_screen'`, `source_system='ma-ui'`, `object_domain='instrument'`, `raised_by` = the JWT email, and `object_ref` holding only the whitelisted keys |
| AC-7 | AC-6 done | Submit the same URL twice more the same day | 200 `deduplicated` with the same `case_ref`; exactly **1** `reported_again` event. After the ticket is resolved, a new report creates a new ticket. |
| AC-8 | No Access session | Open the D-3 URL | Access login, then the prefilled form with the same values |
| AC-9 | M3 loaded, and a `fix_scheduled` event on the KI 22.44 ticket | 1. `member_update` on one member → `fixed`; 2. the same with a stale `expected_member_status`; 3. the same `request_id` with a different member | 1: the member row changes, with 1 `member_updated` event and the ticket's `updated_at` bumped. 2: 409, and **no** event and **no** ticket bump (A4-3). 3: 409 `request_id_reused`, 0 changes. |
| AC-10 | A ticket and an exception | `link_exception` | C-1 on the ticket shows the exception; C-1 on the exception shows the ticket (003 `idx_ops_dq_linked_exc`) |
| AC-11 | 003 V2 passed | M3a | 1 ticket with 37 members; `DQ-M-000008/9` `dismissed/duplicate` with events naming the new ref; payload keeps `pending`. Re-run: 0 changes |
| AC-12 | M3 template + M3c links (Appendix D data) | Run, then re-run | **KI 22.44:** 24 members, actions **6 / 5 / 13** (`replace_lei_t1` / `review` / `null_and_offline_match`); OPAP 2014 absent; member 931's `object_ref.see_also` = `DQ-M-000001`. **KI 22.9:** 4 `delete_edge` members whose keys carry `legal_parent:gleif:<created_at>`, plus 4 `linked` events on `DQ-M-000004…7`, which stay `resolved/accepted_no_fix`. **Re-run: 0 changes.** |
| AC-13 | `m4-minimum.json` and 008's list | M4 | **At least the named 4:** Welltower Inc (`0000766704`), GM Financial (`0000804269`, 3 candidate members), Pfizer NL (`0002058265`, `co_registrant_of = 'Pfizer Inc'`, member 106006) and PepsiCo Singapore Financing I (`0002007029`, members 3367 and 31416, `current_wrong_link_entity = 1457`). **Each has its LEI in `object_ref` where known.** No ticket links a subsidiary to its parent or guarantor. A CIK in both files makes one ticket. Re-run: 0 changes. |
| AC-14 | `OPS_DQ_CONSUMER_ENABLED="false"` | D-3 and D-2 with `via=nav-007` | The page says paused; D-2 503; console create still 201 |
| AC-15 | Production | Each route once | `rows_read`: D-1 ≤ 153, D-2 ≤ 120, C-1 (KI 22.17 ticket) ≤ 405; remote EXPLAIN matches §11.2 |
| AC-16 | A static check | grep of `App/` and `docs/` | No ops key, JWT, service-token value or ticket content in front-end code. 007's button builds only the §9.1 URL. |
| AC-17 | M3 template run | C-1 on each seed | **KI 22.43:** `no_link_marker`, `fix_pending`, 0 members, 1 `fix_scheduled` event with `fix_ref` MA-OCT-011. **`wrong_identifier`:** entity 2289, `cik` 0000766704 → 0001917598. **OTP:** `entity_merge`, members 2019 and 467290, `fix_ref` MA-OCT-013. **M5** (when H-1 delivers): 7 `gleif_handoff` tickets with the list SHAs. Re-run: 0 changes. |
| AC-18 | Tickets of Entities-data types | 1. `resolve fixed` with no `fix_scheduled` event; 2. the `bond-runner` or `ops-script` token on `resolve`, `dismiss` or `reopen`; 3. `reopen` on `DQ-M-000001…3` without `founder_supersession`; 4. the same with it | 1: 409 `fix_not_scheduled`. 2: 403 before D1. 3: 409 `protected_decision`, and the row is unchanged. 4: 200, with the supersession in the event payload. |
| AC-18c | The 004 deploy is verified | The Founder admits the `bond-runner` token; then the token calls D-2 (`missing_entity`), D-2 (`missing_mapping`) and D-1 | 201/200, then 403, then 403. **Admission happens only after this AC passes in the test harness and the allowlist is live.** |
| AC-19 | C-1 on a ticket whose `entity` member was merged by 013 (a fixture redirect row) | C-1 | The member shows `merged_into` the survivor; the stored `object_key` is unchanged. With no redirect table, C-1 still answers 200. |
| AC-20 | A sweep after a new ticket | The sweep runs | The response carries `dq_new ≥ 1`; the notification line appears; a clean sweep is silent (F-3). |

---

## 15. Test plan (order)

1. **`App/Ops/tests/dq-contract.mjs`** (`node:sqlite`, the real migrations 002–005, the real `ops-api.js`, `cases.js` and `dq-page.js`; RS256 test keys and service-token JWTs as in 003). It covers:
   - AC-1 to AC-7, AC-9, AC-10, AC-14, AC-18, AC-18c and AC-19;
   - the caller-class matrix (§8.3) and the `OPS_SERVICE_ACTORS` allowlist;
   - the CSRF header rule and the five-status cap (429);
   - object-key validation, including 007's placeholders.
2. **`App/Ops/tests/dq-seeds.mjs`:**
   - applies 003 M1 and M2 to the 015b/015c rows and runs V2 (**before** M3a);
   - then runs M3a, the generator over `m3-seeds.json`, `m3c-links.sql`, and the generator over `m4-minimum.json` plus a fixture `unmatched-issuers.json` that repeats one named CIK;
   - checks AC-11, AC-12, AC-13 and AC-17, and re-runs each for 0 changes.
3. **`dq-page` render test:** escaping (a `<script>` value in `ref` comes out inert), CSP header present, the whitelist drops extra keys, an invalid `type` gives the error page.
4. **`sweep-contract.mjs`** (003's) gains AC-20 (`dq_new`). `health-check.test.mjs` gains the notification line.
5. **Remote, in order (§16):**
   - **Tue 27:** B1, B2, B4 → `005-ops-dq.sql` → deploy → AC-1, AC-15 → M3a → M3 + M3c links → M4 → AC-11 to AC-13, AC-17.
   - **Wed 28:** `bond-runner` token (AC-18c) → AC-6 to AC-8 in production (Founder, a browser on the real site) → AC-14 (switch on, then off again) → AC-20 → M5 when H-1 delivers.

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
- **Rev 1 dry-run (17 Oct; the same setup plus 003 rev 1's M2, this spec's template over the Appendix D data, and `m3c-links.sql`):**
  - **Rows:** M2 makes 4 changes (`EXC-M-000001` E3, `EXC-M-000002` E4-delta). M3 makes 47: `DQ-000011` KI 22.44 (24 members), `DQ-000012` KI 22.9 (4), `DQ-000013` KI 22.43 (0, `fix_pending`), `DQ-000014` `wrong_identifier` 2289, `DQ-000015` OTP (2, `fix_pending`). M3c links make 4. M4 makes 19: `DQ-000016…19`, the named 4, with 1, 3, 1 and 2 members.
  - **Member actions:** `replace_lei_t1` 6, `review` 5, `null_and_offline_match` 13, `delete_edge` 4, `dedupe` 37, `merge_then_assign_lei` 5, `merge_013` 2, `create_entity` 1, `confirm_and_assign_lei` 1.
  - **Events:** `created` 19, `decision_recorded` 7, `migrated` 9, `dismissed` 2, `fix_scheduled` 2, `linked` 4.
  - **Re-runs** of M2, M3a, M3, the M3c links and M4: **0 changes each**.
- **Limitation:** local plans only. Remote plans are confirmed at build (AC-15).

---

## 16. Build plan (Claude Code, LANE-1-ENG; ML-1012-2 commit rule)

**Calendar (ML-1017-3, A4-1):** 004 builds **locally from Mon 26** and **deploys only after 003 is live**. 003's routes go live Sat 24 and its sweep extensions and retirement Mon 26 (003 §16). The Fri 23 local prep in rev 0 is dropped, as the Task's calendar says "local build from Mon 26".

**Every remote step:**
- reads `d1-today` first;
- records C1 deployed = repo and the previous version id;
- re-reads `FREEZES.json` on the day;
- keeps 2 minutes clear of the sweep slots, which from Mon 26 are 08:00, 12:00, 18:00 and 22:00 UTC (GMT).

| Day | Work | Remote writes |
|---|---|---|
| **Done** | Founder answers F-1 to F-3 (17 Oct). The KI 22.44 data comes from Evidence §15.3 (no export needed). | 0 |
| **Mon 26 (local; 003's deploys 4 and 5 run the same day)** | `005-ops-dq.sql --local`. `cases.js`: the DQ engine (§7.1 with the §7.5 and §7.6 rules and the A4-3 guards), D-1, D-2, the `bond-runner` allowlist entry, the `dq_new` count. `seeds/*.json` from Appendix D, `seed-sql.mjs`, `m3c-links.sql`. Tests 1, 2 and 4. | 0 |
| **Tue 27** | D-3 page and test 3 (local, morning). Then remote: B1, B2, B4 → `005-ops-dq.sql` → **deploy** → AC-1, AC-15 → M3a → M3 + M3c links → M4 (named 4 + 008's list, file SHA recorded) → AC-11 to AC-13, AC-17. `check-pipeline-health.js` line (local). Hand the D-3 URL to the 007 lane. | ≈ 1 + ≈ 145 + ≈ 190 + ≤ 635 |
| **Wed 28** | Founder admits the `bond-runner` token (AC-18c). AC-6 to AC-8 with the Founder, then AC-14 and AC-20. Report. **007 Phase 4 can ship its button from here**, at the edge of 007 §12's "by 28 Oct; else deferred"; the Main Lane records the effect (ML-1017-3). | ≤ 30 |
| **Thu 29** | Buffer; 005 UAT uses D-1, C-1 and C-2 | 0 |
| **After 011 close-out (H-1)** | M5 (7 hand-off aggregates) | ≈ 115 |

**Dependencies:**

| # | Dependency |
|---|---|
| D-1 | **003 live:** routes and the `idx_ops_dq_linked_exc` / `idx_ops_exception_job_cond` indexes from Sat 24, and M1 verified Sat 24 (003 §16). **If 003's Sat 24 deploys slip, 004's Tue 27 remote day slips by the same amount, and 007's button is deferred under 007 §12** (A4-1). |
| D-2 | A6 live (Sat 24, 003 D-1) |
| D-3 | 008's `unmatched-issuers.json` written (Pack C done). The named 4 are seeded even without it. |
| D-4 | H-1: LANE-11's 011 close-out lists and SHAs for M5 and the KI 22.43 comment |
| D-5 | The 007 lane builds Phase 4 against §9.1 |
| D-6 | 005 builds on D-1, C-1 and C-2 and adds no Worker routes (§12) |
| D-7 | LANE-8-ENG reads the `bond-runner` token for 008's runner (its own build) |

**If 004 slips past Wed 28:** 007's button is deferred (007 §12; it is not on the never-cut list). M3 and M4 still run, because the tickets matter more than the button.

---

## 17. Rollback

| Change | Trigger | Rollback | Check |
|---|---|---|---|
| `meridian-ops` 004 deploy | Errors or a read regression | `OPS_DQ_ENABLED="false"`, or redeploy the 003 version | 503s, or the routes are gone; 003 routes unaffected |
| D-3 page only | Abuse or a page defect | `OPS_DQ_CONSUMER_ENABLED="false"` | The page says paused |
| `bond-runner` token | Misuse or a leak | The Founder removes it from the Access policy, then revokes it. 008's runner falls back to its hand-over list (M4 re-run). | The next call gets the Access 403 |
| `ops_dq_ticket_member` | Never expected | Leave it in place (additive; nothing reads it after a rollback). A drop needs Founder approval and an export first. | — |
| M3/M4/M5 seed tickets | Wrong content | `dismiss` the ticket with `not_a_problem` and a note, plus `member_update` to `not_a_problem`, done by the Data-Identity Lead or the Founder (§7.5). Events cannot be deleted (trigger), so they stay as an honest record. A corrected seed uses a new `dedupe_key` (`ki:22.44.r2`). | C-1 shows dismissed |
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

## 19. Decisions, review outcomes and hand-offs

**Founder questions:** none open. Q1–Q3 were answered YES on 17 Oct and are in the body as F-1 (§10.2, KI 22.9), F-2 (§8.5, §10.4) and F-3 (§9.5).

**Review questions (rev 0), as the reviewers answered them:**

| # | Question | Outcome |
|---|---|---|
| RQ-1 | `ops_dq_ticket_member` and its index | **Accepted** (REVARC) |
| RQ-2 | Object-scoped dedupe | **Accepted** (REVARC). 007's owner is informed. |
| RQ-3 | Page path, CSP, CSRF rule | **Accepted** (REVARC), with `base-uri 'none'` added to the CSP (§9.2) |
| RQ-4 | Prefill mapping and `ref` whitelist | **Accepted** (REVDIL) |
| RQ-5 | Vocabularies, KI 22.17 consolidation, key formats, KI 22.44 members | **Accepted, with changes:** `wrong_identifier` added (004-2), `null_and_offline_match` renamed (004-8), members from Evidence §15.3 (004-8), the edge key carries `source` and `created_at` (004-7) |
| RQ-6 | M4 input format | **Accepted** (REVDIL); LANE-8-ENG confirms the path |

**Hand-offs:**

| # | Hand-off | Owner |
|---|---|---|
| H-1 | 011 close-out lists and SHAs for M5 and the KI 22.43 comment | LANE-11 (Data-Identity Lead), at 011 close-out |
| H-2 | 013 excludes the three `do_not_merge` pairs, adds the OTP Bank pair (2019 / 467290) and the GM Financial and PepsiCo Singapore duplicate clusters as inputs, and reads `do_not_merge` from Ops | Data-Identity Lead (013 brief) / Main Lane |
| H-3 | 008 applies the Welltower OP LLC → 2289 link only **after** the `wrong_identifier` fix on 2289 | LANE-8 / Data-Identity Lead |
| H-4 | The fix packets this spec tracks, all ≥ Sat 24 and all Entities writes: KI 22.44 corrections, the KI 22.9 edge deletes (full identity), the 2289 `cik`, the 11 Jun stuck queue row (003 H-3) | Data-Identity Lead |

---

## Appendix A — Read pack

**None needed for this spec.** Every count comes from evidence files:
- 37 ISINs (007 Appendix A Q5);
- 24 wrong LEIs (006 Evidence §15.3);
- 4 edges (006 §14.5 and 015c);
- the 008 items (DIL14 §4);
- 9 legacy rows (003 read pack R1/R2, run 15 Oct: N = 9).

Four **build-time checks** (≤ 250 reads, run on Tue 27 before M3):

| # | Check | Why |
|---|---|---|
| B1 | `SELECT isin, COUNT(DISTINCT entity_id) FROM entity_isin_map WHERE isin IN (<37>) GROUP BY isin`, through `idx_entity_isin_map_isin` (≤ 80 rows) | Records how many of the 37 are still ambiguous. A member whose ISIN is no longer ambiguous gets `member_update` → `fixed` after M3a, with a note naming the change that cleared it (§7.5). If no applied packet explains it, the member gets a `comment` instead. |
| B2 | `SELECT entity_id, lei FROM entity_master WHERE entity_id IN (<24>)`, PK (24 rows) | Confirms `current_lei` in Appendix D still matches live data, because 011 never overwrites an existing LEI. **A4-4:** the 24 ids are also compared with 013's hand-off file (the 392 twins) when it exists; any overlap is noted on the member by `comment`, and the key is not rewritten. |
| B4 | `SELECT parent_entity_id, child_entity_id, relationship_type, source, created_at FROM entity_relationships WHERE parent_entity_id = ? AND child_entity_id = ? AND relationship_type = 'legal_parent'`, PK, × 4 | Confirms the 4 KI 22.9 edges still carry the identity in Appendix D (`source='gleif'`, `created_at` verbatim). A mismatch goes on the member as a `comment`, and the later delete must not touch that row (004-7). |
| B3 | `SELECT COUNT(*) FROM ops_data_quality_ticket WHERE legacy_source = 'entity_exceptions'`, autoindex | Must equal 003's M1 count (9) before M3a |

---

## Appendix B — Inputs read (SHA-256 at read time, 15 Oct; rev 1 additions 17 Oct at the end)

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
| **Rev 1 (17 Oct):** `claude/packets/MA-OCT-003.REVARC_Report.md` | `598caa80c6298a89c7eca2edcf42739a52f558313e1d1494812964e9756e2d63` |
| `claude/packets/MA-OCT-003.REVDIL_Report.md` | `37aaa05723471731d6415a7357808fee38ec256c600daf1349c89b5503f4f217` |
| `claude/packets/MA-OCT-008.DIL14_Report.md` (§4) | `c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399` |
| `claude/packets/MA-OCT-003_ReadPack_Results.md` | `93a8d4349954b85a8123e84c21fb26bc10328c36d3352271e2a1e20995f2af99` |
| `claude/packets/MA-OCT-003.R1_Task_v1.md` | `1c3c1e6e199f903715853fa6c7d6ec8844bce1eccc5789674cf864622c0a1f1a` |
| `claude/October_Decisions_Log.md` (17 Oct, ML-1017-1..3) | `df022fe23818d25cd5eda420db7beaf62da97c99175ccd526b9be147aafc631e` |
| `claude/MA-OCT-006_Evidence.md` (§14.5, §15.3; same hash as rev 0) | `0d1bbf9b69f1e6a28e3bffe4f07175e500f9293c3ee5adb3f20fbdb526ddb1bc` |
| `App/Corporate Atlas/migrations/corporate-atlas-v1.sql` (`entity_relationships` PK; queue index) | read 17 Oct |

**Limits of this spec lane:**
- No D1 access.
- The KI 22.44 members come from Evidence §15.3 in the repo. `WORK/day6/wrong_lei_detail.csv` (SHA `41502aa7…1c01` per §15.3) was not read, and is not needed.
- 008's full unmatched list is known only when `unmatched-issuers.json` is read at build. The named 4 are seeded either way.


---

## Appendix C — Change table, rev 0 → rev 1 (MA-OCT-003.R1)

**Overlaps and conflicts, and the wording taken:**

| # | Meeting point | Wording taken | Why |
|---|---|---|---|
| 1 | DIL14 `identity_mismatch` and REVDIL `wrong_identifier` (2289 CIK) | `wrong_identifier` | REVDIL reviews 004 and gives the seed shape; the meaning is identical |
| 2 | REVDIL 004-1 ("no entity" for GM Financial and Pfizer NL) and DIL14 DQ-3/DQ-4 (corrected: candidates exist) | `missing_entity` tickets **with candidate members** and DIL14's proposed actions. Only Welltower Inc gets `create_entity`. | DIL14 is later and checked against the 16 Oct export. It also adds PepsiCo Singapore Financing I (DQ-5), and Task item 4 lists that too. |
| 3 | REVDIL 004-8 (members from Evidence §15.3) and rev 0 (a Data-Identity Lead export from `WORK/`) | §15.3 in the repo; the data is embedded verbatim in Appendix D | It removes a dependency, and the check (24, 6/5/13, names) holds by construction |
| 4 | A4-2 (token scope) and 004-9 (resolve authority) | The allowlist is defined once (003 §8.5). 004 adds the `bond-runner` entry, and §7.5 holds the authority rules | One mechanism for both Founder answers (003 Q3, 004 Q2) |
| 5 | REVDIL 004-7 (`source` in the edge key) and the `entity_relationships` PK `(parent, child, relationship_type)` | The key carries `source` **and** `created_at`; `object_ref` holds all five fields; B4 re-reads them | `source` alone cannot tell a legacy edge from an 011 edge, because both are `gleif`. `created_at` can. |

| # | Source | Change | Where |
|---|---|---|---|
| 1 | A4-1 | Dates follow ML-1017-3: 003 live from Sat 24; 004 local from Mon 26 and remote from Tue 27; slip rule for 007's button | Header, §5, §16 (D-1) |
| 2 | A4-2 | Worker allowlist on every admin route; `bond-runner` entry; one token per caller; admitted only after verification; storage and expiry | §8.3, §8.5, AC-18, AC-18c, §17 |
| 3 | A4-3 | Member, `add_members` and `link_exception` changes are guarded; bump and event conditioned on the change; `NOT EXISTS` idempotency | §7.1, AC-9 |
| 4 | A4-4 | 013 hand-off: never rewrite; read through `entity_merge_redirect`; B2 checks against 013's list | §0 item 11, §5, §7.6, §8.2 C-1, §10.6, App. A B2, AC-19 |
| 5 | REVARC notes | CSP `base-uri 'none'` (RQ-3); five-status cap (N4-1); member keyset page (N4-2); M4 file SHA (N4-3); `fix_ref` only in the event (N4-4); N4-5 noted | §9.2, §11.1, §8.2, §10.4, §7.5 |
| 6 | 004-1 | Named minimum set in M4 and AC-13: Welltower Inc, GM Financial, Pfizer NL (co-registrant, no parent link), plus PepsiCo Singapore Financing I | §0 item 8, §10.4, AC-13, App. D |
| 7 | 004-2 | `wrong_identifier` type; 2289 `cik` seed; sequenced before 008's 2289 link | §7.2, §10.2, AC-17, §19 H-3 |
| 8 | 004-3 | KI 22.43 aggregate, 0 members, `fix_ref` MA-OCT-011; recurrence goes to the enrich fix packet | §7.2 (`no_link_marker`), §10.2, AC-17 |
| 9 | 004-4 | M5: 7 `gleif_handoff` aggregates after 011 close-out (H-1) | §10.5, AC-17, §16 |
| 10 | 004-5 | OTP Bank `entity_merge` seed (2019 / 467290), `fix_ref` MA-OCT-013 | §10.2, AC-17, §19 H-2 |
| 11 | 004-6 | `reopen` on `do_not_merge` tickets refused without `founder_supersession` | §0 item 10, §7.1, §7.5, AC-18 |
| 12 | 004-7 | KI 22.9 members carry the full edge identity, `source` included | §10.2, AC-12, App. A B4 |
| 13 | 004-8 | KI 22.44 members from Evidence §15.3 (24 = 25 less OPAP; 6/5/13); `null_and_offline_match`; 931 cites `DQ-M-000001` | §5, §7.3, §10.2, AC-12, App. D |
| 14 | 004-9 | Resolve authority (§7.5); AC-17, AC-18 added | §0 item 10, §7.1, §7.5, AC-18 |
| 15 | F-1 (004 Q1) | KI 22.9 aggregate now unconditional; legacy tickets linked, not changed | Header, §0, §10.2, AC-12 |
| 16 | F-2 (004 Q2) | 008's runner raises `missing_entity` with the `bond-runner` token | Header, §0 item 8, §8.5, §10.4 |
| 17 | F-3 (004 Q3) | `dq_new` in the sweep and the notification line; P0 | Header, §9.5, §13 R7, AC-20 |
| 18 | Task item 4 | All listed DQ items seeded (Welltower CIK on 2289; Welltower Inc, GM Financial, Pfizer NL; PepsiCo Singapore linked to guarantor 1457; OTP pair; KI 22.44, 22.43, 22.9) | §10.2, §10.4, App. D |
| 19 | Author's dry-run | Rev 1 seeds dry-run on the real legacy rows; all re-runs give 0 changes | §15 |

---

## Appendix D — Seed data, verbatim (the build writes these files byte-for-byte)

**`App/Ops/seeds/m3-seeds.json`** (5 seeds; 30 members):

```json
[
 {
  "dedupe": "ki:22.44",
  "type": "wrong_lei",
  "sev": "sev2",
  "status": "triaged",
  "title": "KI 22.44: 24 entities carry a wrong LEI (subsidiary 18, other/predecessor 6)",
  "summary": "23 from the June isin_direct bulk mapping, 1 unknown source (SLM). Excluded from MA-OCT-011; 011 never overwrites an existing LEI.",
  "od": "source_record",
  "ok": "known-issue:22.44",
  "ref": {
   "ki": "22.44",
   "rc": "RC-12",
   "members": 24
  },
  "src": "ma-oct-006",
  "evidence": "MA-OCT-006 Evidence §15.3 (0d1bbf9b…db1bc; wrong_lei_detail.csv SHA 41502aa7…1c01), §14.4; D5-8, D6-4 (OPAP cleared), D6-5; Matrix rank 14.",
  "proposal": "Per member: replace with the T1 LEI (6); review the non-T1 candidate (5); set NULL and match in the next offline GLEIF pass (13). Manual correction by a Data-Identity Lead packet after 24 Oct.",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "entity",
    "k": "528",
    "act": "replace_lei_t1",
    "ref": {
     "name": "Investar Holding Corp",
     "current_lei": "549300CPKDUJKREQRG38",
     "correct_lei": "54930001EK2YM28LOJ08",
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "575",
    "act": "review",
    "ref": {
     "name": "United Community Banks Inc/GA",
     "current_lei": "T68X8LLAQYRNDV034K14",
     "correct_lei": "549300GVW0FV66X3U703",
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "576",
    "act": "null_and_offline_match",
    "ref": {
     "name": "United Fire Group Inc",
     "current_lei": "549300ZRC3FQZU7GNY20",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "596",
    "act": "replace_lei_t1",
    "ref": {
     "name": "Crescent Energy Co",
     "current_lei": "549300WN2AGOX1011V72",
     "correct_lei": "254900FBNP5A21Q39U97",
     "kind": "other_or_predecessor"
    }
   },
   {
    "d": "entity",
    "k": "702",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Graphic Packaging Holding Co",
     "current_lei": "SO75N4VY5NXGQSK8YQ65",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "838",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Franklin Financial Services Corp",
     "current_lei": "5493008E3WZYM5146L29",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "890",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Carter Bankshares Inc",
     "current_lei": "549300SO0M022D8D8358",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "899",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Oak Valley Bancorp",
     "current_lei": "549300D2R9YSQ442G068",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "902",
    "act": "review",
    "ref": {
     "name": "Chord Energy Corp",
     "current_lei": "52990028CHK9KUB1B293",
     "correct_lei": "529900FA4V2YNIKZ0M71",
     "kind": "other_or_predecessor"
    }
   },
   {
    "d": "entity",
    "k": "927",
    "act": "null_and_offline_match",
    "ref": {
     "name": "ServisFirst Bancshares Inc",
     "current_lei": "549300XSS1CPK8G7B851",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "931",
    "act": "review",
    "ref": {
     "name": "SLM Corp",
     "current_lei": "54930067J0ZNOEBRW338",
     "correct_lei": "4K8SLPBF5DXXGPW03H93",
     "kind": "other_or_predecessor",
     "see_also": "DQ-M-000001 (do_not_merge 931/1216)"
    }
   },
   {
    "d": "entity",
    "k": "943",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Chemung Financial Corp",
     "current_lei": "549300WU17K1CLH8VI32",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1015",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Bar Harbor Bankshares",
     "current_lei": "549300VR3QTN4GZYUR03",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1049",
    "act": "review",
    "ref": {
     "name": "Mercury General Corp",
     "current_lei": "5493008B54WFZLDKD530",
     "correct_lei": "5493001Q9EXPCEL4W527",
     "kind": "other"
    }
   },
   {
    "d": "entity",
    "k": "1134",
    "act": "replace_lei_t1",
    "ref": {
     "name": "Alpha Metallurgical Resources Inc",
     "current_lei": "549300C9E158C3V6PT51",
     "correct_lei": "254900VEBGZO2PY8R678",
     "kind": "other_or_predecessor"
    }
   },
   {
    "d": "entity",
    "k": "1138",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Amalgamated Financial Corp",
     "current_lei": "254900FMBXF85WQYV433",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1157",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Mid Penn Bancorp Inc",
     "current_lei": "254900L0MIAM922ZEC34",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1162",
    "act": "null_and_offline_match",
    "ref": {
     "name": "Sierra Bancorp",
     "current_lei": "5493003HTEY5OCC5SP27",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1181",
    "act": "null_and_offline_match",
    "ref": {
     "name": "City Holding Co",
     "current_lei": "549300KJZ82173UB3I21",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1455",
    "act": "null_and_offline_match",
    "ref": {
     "name": "MDU Resources Group Inc",
     "current_lei": "0T6SBMK3JTBI1JR36794",
     "correct_lei": null,
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1514",
    "act": "replace_lei_t1",
    "ref": {
     "name": "Jacobs Solutions Inc",
     "current_lei": "549300CZ8QS1GE53O776",
     "correct_lei": "254900E3KHXCC2C8K272",
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1803",
    "act": "replace_lei_t1",
    "ref": {
     "name": "APA Corp.",
     "current_lei": "72ZZ1XRHOOU9P9X16K08",
     "correct_lei": "549300VCIWLRHYVSHC79",
     "kind": "other_or_predecessor"
    }
   },
   {
    "d": "entity",
    "k": "1809",
    "act": "replace_lei_t1",
    "ref": {
     "name": "Old National Bancorp",
     "current_lei": "549300AT7EB9FJAF0E61",
     "correct_lei": "549300MMK90CL5KMVX16",
     "kind": "subsidiary"
    }
   },
   {
    "d": "entity",
    "k": "1868",
    "act": "review",
    "ref": {
     "name": "Wendy's Co/The",
     "current_lei": "549300PQTT267ME8D359",
     "correct_lei": "529900M0JIUCMWVKHG76",
     "kind": "subsidiary"
    }
   }
  ]
 },
 {
  "dedupe": "ki:22.9",
  "type": "bad_relationship_edge",
  "sev": "sev3",
  "status": "triaged",
  "title": "KI 22.9: 4 legal_parent edges with no GLEIF relationship (MA-SEP-001 merge)",
  "summary": "Reopened as a fix by Founder decision 17 Oct (004 F-1). The 22 Aug accepted_no_fix stays on record on DQ-M-000004…7.",
  "od": "source_record",
  "ok": "known-issue:22.9",
  "ref": {
   "ki": "22.9",
   "rc": "RC-20",
   "members": 4,
   "legacy": [
    "DQ-M-000004",
    "DQ-M-000005",
    "DQ-M-000006",
    "DQ-M-000007"
   ]
  },
  "src": "ma-oct-006",
  "evidence": "MA-OCT-006 Evidence §14.5 (0d1bbf9b…db1bc); Matrix rank 10; 015c migration.",
  "proposal": "Delete the 4 edges by full identity (parent, child, relationship_type, source, created_at); ≈ 16 Entities writes; Data-Identity Lead packet ≥ Sat 24. Never touch an edge whose source or created_at differs (e.g. an 011 edge).",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "source_record",
    "k": "entity_relationships:1565->3:legal_parent:gleif:2026-06-10T19:51:32",
    "act": "delete_edge",
    "ref": {
     "parent_entity_id": 1565,
     "child_entity_id": 3,
     "relationship_type": "legal_parent",
     "source": "gleif",
     "created_at": "2026-06-10 19:51:32",
     "d4_rowid": 265
    }
   },
   {
    "d": "source_record",
    "k": "entity_relationships:2247->143:legal_parent:gleif:2026-06-11T00:00:55",
    "act": "delete_edge",
    "ref": {
     "parent_entity_id": 2247,
     "child_entity_id": 143,
     "relationship_type": "legal_parent",
     "source": "gleif",
     "created_at": "2026-06-11 00:00:55",
     "d4_rowid": 267
    }
   },
   {
    "d": "source_record",
    "k": "entity_relationships:2476->49:legal_parent:gleif:2026-06-10T20:00:59",
    "act": "delete_edge",
    "ref": {
     "parent_entity_id": 2476,
     "child_entity_id": 49,
     "relationship_type": "legal_parent",
     "source": "gleif",
     "created_at": "2026-06-10 20:00:59",
     "d4_rowid": 266
    }
   },
   {
    "d": "source_record",
    "k": "entity_relationships:6980->194:legal_parent:gleif:2026-06-11T02:00:56",
    "act": "delete_edge",
    "ref": {
     "parent_entity_id": 6980,
     "child_entity_id": 194,
     "relationship_type": "legal_parent",
     "source": "gleif",
     "created_at": "2026-06-11 02:00:56",
     "d4_rowid": 268
    }
   }
  ]
 },
 {
  "dedupe": "ki:22.43",
  "type": "no_link_marker",
  "sev": "sev3",
  "status": "fix_pending",
  "fix_ref": "MA-OCT-011 (bucket C)",
  "title": "KI 22.43: 657 NO_LINK_DECLARED markers are wrong (GLEIF has an ACTIVE parent)",
  "summary": "Aggregate with 0 members (657 > the 500 member cap). Resolve after 011 §9 verification. Recurrence: live Phase 3 keeps writing the generic marker (H6) — stays open under the enrich fix packet.",
  "od": "source_record",
  "ok": "known-issue:22.43",
  "ref": {
   "ki": "22.43",
   "rc": "RC-5",
   "rows": 657
  },
  "src": "ma-oct-006",
  "evidence": "MA-OCT-006 Matrix rank 3 (RC-5), ki2243_rows.csv; 657 after D7-2. 011 close-out list SHA to be added by comment (H-1).",
  "proposal": "MA-OCT-011 bucket C writes the GLEIF reason; enrich fix packet stops the recurrence.",
  "owner": "Data-Identity Lead",
  "members": []
 },
 {
  "dedupe": "wrong_identifier:entity:2289:cik",
  "type": "wrong_identifier",
  "sev": "sev2",
  "status": "triaged",
  "title": "Entity 2289 (Welltower OP LLC) stores Welltower Inc's CIK",
  "summary": "cik 0000766704 belongs to Welltower Inc; Welltower OP LLC is 0001917598. Must be fixed before 008 applies its signed Welltower OP LLC -> 2289 link (008.DIL14 item 2; H-3).",
  "od": "entity",
  "ok": "2289",
  "ref": {
   "name": "Welltower OP LLC",
   "lei": "T6IZ0MBEG5ACZDTR7D06"
  },
  "src": "ma-oct-008",
  "field": "cik",
  "obs": "0000766704",
  "exp": "0001917598",
  "evidence": "MA-OCT-008.DIL14 §4 DQ-1 (c517dde7…c9399); Pack C packc-b3.json / packc-c2.json.",
  "proposal": "One Entities UPDATE of entity_master.cik (~2 writes), Data-Identity Lead, after 24 Oct, before the 2289 link.",
  "owner": "Data-Identity Lead",
  "members": []
 },
 {
  "dedupe": "entity_merge:2019:467290",
  "type": "entity_merge",
  "sev": "sev3",
  "status": "fix_pending",
  "fix_ref": "MA-OCT-013",
  "title": "OTP Bank: entity 2019 (operating, no LEI) and 467290 (holding, LEI 529900W3MOO00A18X956) — merge in 013",
  "summary": "467290 was created by live Phase 3 on 6 Oct; MA-OCT-011 withheld 2019. Input for 013 (H-2).",
  "od": "entity",
  "ok": "2019",
  "ref": {
   "pair": [
    2019,
    467290
   ],
   "lei": "529900W3MOO00A18X956"
  },
  "src": "ma-oct-011",
  "evidence": "MA-OCT-011.FRI_Report; RELARC N-3; REVDIL 004-5.",
  "proposal": "Resolve the pair in MA-OCT-013 (S1); never by 004.",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "entity",
    "k": "2019",
    "act": "merge_013",
    "ref": {
     "name": "OTP Bank Nyrt",
     "type": "operating"
    }
   },
   {
    "d": "entity",
    "k": "467290",
    "act": "merge_013",
    "ref": {
     "type": "holding",
     "lei": "529900W3MOO00A18X956"
    }
   }
  ]
 }
]
```

**`App/Ops/seeds/m4-minimum.json`** (the named 4; 7 members):

```json
[
 {
  "dedupe": "sec_cik:0000766704",
  "type": "missing_entity",
  "sev": "sev4",
  "status": "open",
  "title": "SEC issuer Welltower Inc (CIK 0000766704) has no entity",
  "summary": "Low priority: 0 final bond rows under its own CIK (equity skips only). Never link to Welltower OP LLC.",
  "od": "source_record",
  "ok": "sec_cik:0000766704",
  "ref": {
   "cik": "0000766704",
   "sec_name": "Welltower Inc",
   "lei": "254900F33BIAR82QTA19",
   "co_registrant_of": null
  },
  "src": "ma-oct-008",
  "evidence": "MA-OCT-008.DIL14 §4 DQ-2 (name search of the 16 Oct export finds only OP LLC rows 2289, 245698).",
  "proposal": "Manual creation from GLEIF Level 1, then a manual link (008 §11.1: never automatic).",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "source_record",
    "k": "gleif:254900F33BIAR82QTA19",
    "act": "create_entity",
    "ref": {
     "name": "Welltower Inc"
    }
   }
  ]
 },
 {
  "dedupe": "sec_cik:0000804269",
  "type": "missing_entity",
  "sev": "sev3",
  "status": "open",
  "title": "SEC issuer GM Financial (CIK 0000804269): 3 duplicate no-LEI candidates, none linked",
  "summary": "No entity carries LEI 5493008B6JBRUJ90QL97; three no-LEI candidate rows are themselves duplicates. Do not create a fourth row. Also an input for 013.",
  "od": "source_record",
  "ok": "sec_cik:0000804269",
  "ref": {
   "cik": "0000804269",
   "sec_name": "General Motors Financial Company, Inc.",
   "lei": "5493008B6JBRUJ90QL97",
   "co_registrant_of": null
  },
  "src": "ma-oct-008",
  "evidence": "MA-OCT-008.DIL14 §4 DQ-3 (corrected).",
  "proposal": "Resolve the cluster to one survivor (S1, 013), assign the LEI by a manual Level-1 write, then a manual link.",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "entity",
    "k": "3324",
    "act": "merge_then_assign_lei",
    "ref": {
     "name": "GENERAL MOTORS FINL CO"
    }
   },
   {
    "d": "entity",
    "k": "30187",
    "act": "merge_then_assign_lei",
    "ref": {
     "name": "General Motors Financial Co Inc"
    }
   },
   {
    "d": "entity",
    "k": "103981",
    "act": "merge_then_assign_lei",
    "ref": {
     "name": "GENERAL MOTORS FINANCIAL COMPANY INC"
    }
   }
  ]
 },
 {
  "dedupe": "sec_cik:0002058265",
  "type": "missing_entity",
  "sev": "sev3",
  "status": "open",
  "title": "SEC co-registrant Pfizer Netherlands International Finance B.V. (CIK 0002058265) not linked",
  "summary": "Co-registrant of Pfizer (L8-12). Candidate 106006 (NL, no LEI). Never link to the parent.",
  "od": "source_record",
  "ok": "sec_cik:0002058265",
  "ref": {
   "cik": "0002058265",
   "sec_name": "Pfizer Netherlands International Finance B.V.",
   "lei": "254900YI79T8NMNA4349",
   "co_registrant_of": "Pfizer Inc"
  },
  "src": "ma-oct-008",
  "evidence": "MA-OCT-008.DIL14 §4 DQ-4 (corrected); MA-OCT-008.AC17 L8-12.",
  "proposal": "Confirm 106006 against GLEIF, assign the LEI manually, then a manual link.",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "entity",
    "k": "106006",
    "act": "confirm_and_assign_lei",
    "ref": {
     "name": "Pfizer Netherlands International Finance BV",
     "country": "NL"
    }
   }
  ]
 },
 {
  "dedupe": "sec_cik:0002007029",
  "type": "missing_entity",
  "sev": "sev3",
  "status": "open",
  "title": "SEC issuer PepsiCo Singapore Financing I Pte. Ltd. (CIK 0002007029): rows sit under guarantor PepsiCo Inc",
  "summary": "Its 4 bond rows are under PepsiCo Inc (entity 1457, P-1) and move under 008's R-1. Two duplicate no-LEI candidates. The link stays unmatched until resolved; never link to the guarantor.",
  "od": "source_record",
  "ok": "sec_cik:0002007029",
  "ref": {
   "cik": "0002007029",
   "sec_name": "PepsiCo Singapore Financing I Pte. Ltd.",
   "lei": null,
   "co_registrant_of": null,
   "current_wrong_link_entity": 1457
  },
  "src": "ma-oct-008",
  "evidence": "MA-OCT-008.DIL14 §4 DQ-5 (new).",
  "proposal": "008 R-1 moves the rows off 1457; resolve the duplicates to one survivor (013), then a manual link.",
  "owner": "Data-Identity Lead",
  "members": [
   {
    "d": "entity",
    "k": "3367",
    "act": "merge_then_assign_lei",
    "ref": {
     "name": "PEPSICO SINGAPORE FIN"
    }
   },
   {
    "d": "entity",
    "k": "31416",
    "act": "merge_then_assign_lei",
    "ref": {
     "name": "Pepsico Singapore Financing I Pte Ltd"
    }
   }
  ]
 }
]
```

Field key: `dedupe` → `dedupe_key`; `type` → `ticket_type`; `sev`; `status`; `od`/`ok` → `object_domain`/`object_key`; `ref` → `object_ref`; `src` → `source_system`; `field`/`obs`/`exp` → `field_name`/`observed_value`/`expected_value`; `proposal` → `proposed_resolution`; `owner` → `owner_role`; `fix_ref` → the `fix_scheduled` event only. Members: `d`/`k` → `object_domain`/`object_key`; `act` → `proposed_action`; `ref` → `object_ref`.
