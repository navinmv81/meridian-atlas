# Meridian Atlas — October Operating Kit v3 Addendum

**Status:** Approved by Founder 2026-09-23 (decisions 1–4 below). Extends `meridian-october-operating-kit-v2.md`; where they conflict, this addendum wins. Scope is unchanged from `meridian-october-revised-scope-v2.md`.
**Issued by:** Program Orchestrator (Control, Cowork master lane)
**Sprint window:** 2026-09-24 → 2026-10-31 (target delivery: end of October)
**Location:** this file, Kit v2 and Scope v2 must all sit in `Meridian Atlas Clean (v11)/claude/`. Copies in `~/Downloads` are not authoritative.

---

## 1. Founder decisions recorded (2026-09-23)

| # | Decision | Effect |
|---|---|---|
| D1 | **Architect role reinstated** as the design and safety reviewer. | Architect reviews every new D1 table or index, every new Worker, route, binding, cron and auth change. Architect does not build. |
| D2 | **Target delivery: end of October 2026.** | Sprint runs 24 Sep – 31 Oct. Calendar in §6. |
| D3 | **Ops is a third data domain, owned by the Operations Lead.** | All `ops_*` tables belong to the Ops domain. Only `meridian-ops` writes to them. |
| D4 | **Front end is kept separate from the backend.** Consumer-facing screens live in the front end. Exceptions, data quality, system health, job state and audit live in the backend. | `entity_exceptions` and its `/exceptions/ui` page move into the Ops backend (§4). Operational state is never held in front-end code. |

> **Action for Founder:** the claude.ai Project Instructions still name only the ETF and Entities domains and the older lane names. Update them in claude.ai to add the Ops domain (D3) and the role mapping in §2. Claude cannot edit Project Instructions.

---

## 2. Roles for October

| October role | Replaces or maps from (September) | Does | Never does |
|---|---|---|---|
| **Founder** | — | Approves at gates, runs UAT and does manual steps needing dashboard or Settings access | — |
| **Program Orchestrator** | Control (Cowork master lane) | Issues briefs, sequences packets, reconciles evidence, maintains Sprint Board, Release Ledger and handoffs | Build or review a packet's code |
| **Architect** | Architect (Team v3) — reinstated | Design and safety review of schema, Workers, routes, auth, crons, indexes and the three-point check | Build |
| **Operations Lead** | Tech Ops / SRE | Owns Ops domain, job registry, run ledger, exceptions, DQ tickets, D1 budget and release-readiness sign-off; can STOP any job or release | Redefine product scope |
| **Engineering Lead** | Engineering Lead | Builds all code (Workers, APIs, front end) to an approved brief | Define features or review its own build |
| **UX Lead** | UX Lead | Specifies screens, states, labels and accessibility before build; accepts the front end | Change API or data shape |
| **Data-Identity Lead** | Entities Product Lead (+ Fixed Income data scope) | Owns sources, schemas, provenance, mappings, GLEIF diagnosis, bond parsing and confidence rules | Start a broad backfill without Ops and Architect write-budget approval |
| **ETF Product Lead** | ETF Product Lead | Reviews anything that touches ETF Workers or ETF tables (e.g. heartbeat wiring in 002) | — |

### How this reads against Kit v2's register

Kit v2's "Primary role" column is the packet **Owner**, the role that defines it and is accountable for it. It is not necessarily the role that executes. §5 below splits every packet into Owner, Executes, Reviews and Approves. Example: MA-OCT-000 is **owned** by the Program Orchestrator and **executed** by the Operations Lead. These don't conflict. The executing session states `ROLE: Operations Lead` in its opening block.

### Rules

1. **The builder never reviews their own work.** A packet's executing role and reviewing role must always be different.
2. **Every instruction carries the four-line header (§3).** An instruction without it must not be acted on.
3. **Reviews end in one verdict:** `PASS`, `PASS WITH NOTES` or `RETURN` (with the reasons). Only a `PASS` or `PASS WITH NOTES` goes to the Founder.
4. **Operations Lead signs release readiness** for every packet that deploys, alongside the reviewer.
5. **Founder approval happens at the gates in §5.** Steps between gates do not need a new approval unless something is out of scope.

---

## 3. Instruction header standard (mandatory)

Every Build Brief, Change Request, review request, handoff and swim-lane prompt starts with this block, on top of the v2 opening block:

```text
ISSUED BY:    [role]  — who defines this instruction
EXECUTED BY:  [role]  — who carries it out
REVIEWED BY:  [role(s)] — who checks output against brief + evidence (≠ executor)
APPROVED BY:  Founder — gate decision
PACKET:       MA-OCT-### — name
GATE:         [Spec approval / Build approval / Release approval / Close-out]
```

The review reply uses this block:

```text
REVIEWER:     [role]
PACKET:       MA-OCT-###
VERDICT:      PASS | PASS WITH NOTES | RETURN
EVIDENCE CHECKED: [list]
FINDINGS:     [numbered]
REQUIRED BEFORE APPROVAL: [numbered, or "none"]
```

---

## 4. How D4 (front end kept separate from the backend) applies

- **Backend (`meridian-ops` plus `ops_*` tables in D1)** holds the only authoritative copy of job registry, run history, exceptions, data-quality tickets, case events, health, lateness and kill-switch state.
- **Operator console (`ma-ops.js`)** is a thin, authenticated client. It holds no authoritative state.
- **Consumer screens (ETF, Entities, 13F, Market, Fixed Income, navigation)** show data and its freshness or confidence. They may only *raise* a data-quality ticket, through the authenticated Ops API. They never hold or change operational state.
- **Other Workers** report lifecycle events to `meridian-ops` through an authenticated endpoint or service binding. They never write `ops_*` tables directly.
- **Migrating `entity_exceptions` (MA-SEP-015):**
  - Rows move into `ops_exception` or `ops_data_quality_ticket` by type. Known Issue 22.9's `bad_relationship_edge` rows and 22.17's `isin_duplicate` rows are data-quality tickets.
  - Their decisions (`decided_by`, `decided_at`) are kept as `ops_case_event` history.
  - The `/exceptions/ui` page and routes on `meridian-entities-api` are retired after the migration is verified.
  - The neutered `/admin/exceptions` residue (Known Issues 22.23 and 22.27) is removed in the same packet.
  - Owner: MA-OCT-003 (exceptions) and MA-OCT-004 (DQ tickets). Needs a Change Request plus Architect review.
- **Former backlog MA-OCT-002 ("Exceptions UI complete revamp")** is absorbed into MA-OCT-003 and 004 (backend) and MA-OCT-005 (UI). It no longer exists as a separate item.

---

## 5. Packet register v3: who owns, builds, reviews and approves

| Packet | Name | Owner (defines) | Executes | Reviews | Approves |
|---|---|---|---|---|---|
| MA-OCT-000 | Runtime truth baseline | Program Orchestrator | Operations Lead | Architect | Founder |
| MA-OCT-001 | Ops backend foundation (tables, auth, audit, heartbeat contract) | Operations Lead | Engineering Lead | Architect | Founder |
| MA-OCT-002 | Fleet, schedules, health and drift | Operations Lead | Engineering Lead | Architect + ETF Product Lead | Founder |
| MA-OCT-003 | Exception management (+ `entity_exceptions` migration) | Operations Lead | Engineering Lead | Data-Identity Lead + Architect | Founder |
| MA-OCT-004 | Data-quality ticketing | Operations Lead | Engineering Lead | Data-Identity Lead | Founder |
| MA-OCT-005 | `ma-ops.js` operator console redesign | UX Lead | Engineering Lead | Operations Lead | Founder UAT |
| MA-OCT-006 | GLEIF reliability investigation (read-only diagnosis) | Data-Identity Lead | Data-Identity Lead | Operations Lead | Founder |
| MA-OCT-007 | Standalone instrument–issuer navigation | Engineering Lead | Engineering Lead | UX Lead + Data-Identity Lead | Founder UAT |
| MA-OCT-008 | SEC corporate-bond ingestion | Data-Identity Lead | Engineering Lead | Architect + Operations Lead | Founder |
| MA-OCT-009 | Fixed Income API | Engineering Lead | Engineering Lead | Architect | Founder |
| MA-OCT-010 | Fixed Income page | UX Lead | Engineering Lead | Data-Identity Lead | Founder UAT |
| MA-OCT-011 *(conditional)* | GLEIF remediation, e.g. offline Level 2 relationship backfill (former backlog MA-OCT-003) | Data-Identity Lead | Engineering Lead | Architect + Operations Lead | Founder |

Every row with "Engineering Lead" in both the Owner and Executes columns (007, 009) has a reviewer from a different role. Owning a packet does not make you its reviewer.

### Numbering and file corrections

- `MA-OCT-004-Bond-Spec.md` is renamed in intent to **input spec for MA-OCT-008**. Its file name is kept for history. Its `EXECUTE FROM: Fixed Income/src/` is **not approved**: the folder location needs a Change Request plus Architect review inside MA-OCT-008's spec gate.
- Former backlog **MA-OCT-002** is absorbed into 003, 004 and 005 (§4).
- Former backlog **MA-OCT-003** becomes **MA-OCT-011**. It is conditional on MA-OCT-006's remediation matrix and needs a separate Founder approval.
- `MA-OCT-001_Spec.md` found in the baseline **root** (not `claude/`) is treated as a **draft input** to MA-OCT-001's spec gate. It is not approved, and moving it is done by the MA-OCT-001 owner, not by MA-OCT-000.
- MA-OCT-000 must check these IDs against the live `sprintboarditems` table for collisions before they are written back.

---

## 6. Delivery calendar (24 Sep → 31 Oct)

At most two build lanes run at once. The Founder has about one checkpoint a day.

| Wave | Dates | Packets | Founder gates |
|---|---|---|---|
| **0: Baseline and setup** | 24–30 Sep | MA-OCT-000 runs. September carry-overs are confirmed. Owners write specs for 001 and 006. | OCT-000 approval (~29 Sep). October branch Change Request. Specs for 001 and 006 approved. |
| **1: Foundations** | 1–9 Oct | **Lane A:** 001 build. **Lane B:** 006 diagnosis (read-only). **Prep:** 008 seed list plus a second-issuer check that preliminary filings are detected; 007 UX spec. | 001 build approval. 008 seed list approved. 007 spec approved. |
| **2: Build out** | 8–21 Oct | **Lane A:** 002 → 003 → 004 in order. **Lane B:** 007 build (ticket button last, after 004), then 008 build. **006 closes ~14 Oct** with a ranked remediation matrix. | 006 close and go or no-go on 011. 002, 003 and 004 approvals. |
| **3: Screens** | 19–29 Oct | **Lane A:** 005 operator console. **Lane B:** 009 API → 010 Fixed Income page. | UAT for 005, 007 and 010. |
| **Release and close** | 29–31 Oct | All release gates from the scope doc checked. Deploy. Release Ledger updated. October close-out. | Release approval. October acceptance statement signed. |

**Weekly status (Program Orchestrator), every Friday:** 2, 9, 16, 23 and 30 Oct.

### Fallback cut list (use only if the 17 Oct checkpoint shows slippage; Founder picks)

1. 005: D1 budget and kill-switch view ships read-only (no controls). This is already consistent with the scope's deferral of automated controls.
2. 002: drift between intended and deployed schedules is a manual snapshot, not an automatic check.
3. 008: seed list of 20 issuers instead of 30.
4. 010: basic search and filters only. Advanced filtering is deferred.

**Never cut:** authentication and audit on changes, the GLEIF four-way classification, navigation in both directions, rejection of preliminary filings, the not-live-pricing disclosure, and the D1 safety gate.

---

## 7. Wave 0 checklist (24–30 Sep)

| # | Item | Executed by | Reviewed by |
|---|---|---|---|
| 0.1 | Run MA-OCT-000 (see `claude/MA-OCT-000_Build_Brief.md`) | Operations Lead (local Claude Code, started **from `Meridian Atlas Clean (v11)`**) | Architect |
| 0.2 | MA-SEP-013 Step 5: **DONE 2026-09-23.** The Founder switched GitHub Pages to `September-2026` `/docs` manually and the site is live. Follow-up fix commit `420487d` (`.nojekyll`). Step 6 (CLAUDE.md `DEPLOY_BRANCH` update) and Step 7 (Board and Ledger close-out) remain | Founder (Step 5, done), Operations Lead (Step 6, inside OCT-000), Program Orchestrator (Step 7) | Program Orchestrator |
| 0.3 | MA-SEP-017 residual: `seedIssuerEntities` `updated_at` check from the 14 and 21 Sep Monday crons | Operations Lead (inside OCT-000, read-only) | Data-Identity Lead |
| 0.4 | Known Issue 22.1: Founder walks through the dashboard checklist from MA-SEP-016 Part 4 (rule out `meridian-holdings` Sunday 04:00 misattribution) | Founder | Operations Lead |
| 0.5 | October branch Change Request (`October-2026` from `September-2026`) | Operations Lead (drafts inside OCT-000) | Architect |
| 0.6 | Specs for MA-OCT-001 and MA-OCT-006 (`/write-spec`) | Operations Lead (001), Data-Identity Lead (006) | Architect (001), Operations Lead (006) |
| 0.7 | Update Project Instructions in claude.ai (§1 note) | Founder | — |
| 0.8 | Sprint Board mirror: add the October register v3 and retire backlog rows OCT-002 and OCT-003 per §5 | Program Orchestrator | Founder |
