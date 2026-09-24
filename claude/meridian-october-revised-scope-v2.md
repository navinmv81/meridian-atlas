# Meridian Atlas — Revised October Scope v2

## Executive decision

October is organised around four committed workstreams:

1. **Operations Control Plane** — job inventory, schedule visibility, exception management and data-quality ticketing.
2. **GLEIF Reliability Investigation** — determine why entity information remains incomplete and whether jobs are operating correctly.
3. **Standalone Instrument–Issuer Navigation** — bidirectional navigation across Meridian Atlas, independent of the Fixed Income module.
4. **Fixed Income Vertical** — SEC EDGAR corporate-bond ingestion, serving APIs and a new Fixed Income UI.

The DCF refresh is deferred. Standalone instrument–issuer navigation is explicitly retained in committed October scope.

## Architectural direction

`ma-ops.js` remains the browser presentation layer. It becomes a thin authenticated client of an expanded `meridian-ops` backend. Operational state, workflow, permissions and audit history move to backend APIs and D1.

## Committed outcomes

| Workstream | Outcome | Primary owner | Supporting owners |
|---|---|---|---|
| Operations Control Plane | Backend system of record plus integrated Ops UI | Operations Lead | Engineering Lead, UX Lead |
| GLEIF Reliability | Evidence-based diagnosis and approved remediation plan | Data/Identity Lead | Operations Lead |
| Instrument–Issuer Navigation | Platform-wide bidirectional navigation | Engineering Lead | UX Lead, Data/Identity Lead |
| Fixed Income Vertical | Bond ingestion, API and new Fixed Income page | Data/Identity Lead | Engineering Lead, UX Lead |

## Operations Control Plane

The existing `meridian-ops` Worker becomes the sole backend owner of operational records. Other Workers report lifecycle events through an authenticated internal endpoint or service binding rather than writing directly to Ops tables.

### Core domains

- **Job registry:** every Worker, cron, on-request process, local LaunchAgent and approved manual script.
- **Run ledger:** start, success, partial, skipped, failed, killed, duration, reads/writes, cursor and error summary.
- **Exceptions:** operational failures requiring triage and resolution.
- **Data-quality tickets:** concerns linked to an entity, instrument, ETF, filing, bond or source record.
- **Audit history:** assignments, comments, state changes and closure decisions.

### Proposed tables

| Table | Purpose |
|---|---|
| `ops_job_registry` | Canonical definition and intended schedule of every job |
| `ops_job_run` | Immutable run and heartbeat history |
| `ops_exception` | Operational exceptions with severity, ownership and status |
| `ops_data_quality_ticket` | Data-quality cases and affected domain objects |
| `ops_case_event` | Audit trail for case activity |

Exceptions and tickets remain distinct but linkable. A failed enrichment run is an exception; an incorrect or missing LEI field is a data-quality ticket.

### Job inventory

Each job must show:

- Worker/job name, owner, source file and domain.
- Execution mode: cron, on-request, local schedule or manual.
- Intended schedule from source control.
- Effective deployed schedule from Cloudflare.
- Last start, last success, last failure and next expected run.
- Health, lateness, frozen state, kill switch and write-budget profile.
- Drift where intended and deployed schedules differ.

### Ops UI

`ma-ops.js` is redesigned around:

- Fleet overview.
- Intended-versus-deployed schedules.
- Job run history.
- Exceptions queue.
- Data-quality queue.
- Case detail and audit timeline.
- D1 budget and kill-switch view.

Mutation endpoints must be authenticated and audited. Anonymous case updates, reruns and job controls are prohibited.

## GLEIF Reliability Investigation

The investigation separates four conditions currently appearing as generic missing information:

1. No reliably matched LEI.
2. Legitimate source absence or reporting exception.
3. GLEIF has the value but Meridian omitted it during ingestion or mapping.
4. The record is queued but a job is frozen, late, stalled or repeatedly failing.

### Required work

- Inventory GLEIF jobs, schedules, kill switches, cursors and last successful runs.
- Profile `entityenrichmentqueue` by status, age, retries, lookup method and failure reason.
- Measure completeness by field, entity type, country, source and LEI status.
- Reconcile samples against the GLEIF API and current concatenated files.
- Check relationship records and reporting exceptions before marking parents as missing.
- Determine whether reduced or frozen seed, enrichment or delta jobs cause stale or unqueued records.
- Feed GLEIF job status and exceptions into the Ops control plane.
- Produce a ranked root-cause and remediation matrix.

No broad backfill is included in the investigation packet. Remediation requires a separate change request and D1 write-budget review.

## Instrument–Issuer Navigation

This remains a standalone October packet and must not be absorbed into Fixed Income. It applies across the existing instrument universe, including equities and other mapped instruments as well as newly ingested bonds.

### Required journeys

- From any supported instrument row or detail surface to the linked issuer entity.
- From an issuer entity to all linked instruments.
- From a bond detail to the issuer and from the issuer back to that bond.
- Preserve identifier context: ISIN, CUSIP, ticker, asset type, mapping source and confidence where available.
- Show explicit states for unmatched, ambiguous and low-confidence mappings rather than hiding them.

### Acceptance criteria

- Navigation works in both directions without losing the originating context.
- Entity pages provide a scalable linked-instruments view with pagination or progressive disclosure.
- Instrument links use canonical entity and instrument identifiers, not names as keys.
- Existing OpenFIGI-backed mappings and future SEC bond mappings use the same navigation contract.
- Missing mappings can create a data-quality ticket in Ops from the affected screen.

## Fixed Income Vertical

October delivers a complete vertical slice rather than ingestion alone.

### Data layer

- Discover corporate debt prospectus filings from SEC EDGAR.
- Reject preliminary or subject-to-completion filings.
- Parse final priced tranches.
- Store issuer, CIK, linked entity, tranche label, rate type, coupon/spread, principal, maturity, seniority where reliable, filing date, accession number, source URL and parsing confidence.
- Keep municipal bonds, secondary-market pricing and intermediary feeds out of scope.

### API layer

Provide endpoints for:

- Bond directory and search.
- Bonds by issuer/entity.
- Bond detail.
- Coverage, freshness and parsing metadata.

### UI layer

Add a first-class **Fixed Income** navigation destination with:

- Searchable and filterable corporate issuance directory.
- Issuer view connected through the standalone navigation contract.
- Bond detail with terms and direct SEC source.
- Clear disclosure that this is issuance/reference data, not live pricing.
- Freshness and parsing-confidence indicators.

## Delivery sequence

### MA-OCT-000 — Runtime truth baseline

Reconcile all known Workers against the live account; inventory crons, on-request Workers, local schedules and manual scripts; capture current GLEIF job state; update `CLAUDE.md`; create the job manifest.

### MA-OCT-001 — Ops backend foundation

Add Ops tables, authenticated APIs, audit events and job heartbeat contracts.

### MA-OCT-002 — Fleet and schedules

Populate the registry; integrate effective Cloudflare schedules; add health, lateness and configuration-drift detection.

### MA-OCT-003 — Exception management

Move exception workflow and authoritative state into the Ops backend; link exceptions to jobs and runs.

### MA-OCT-004 — Data-quality ticketing

Add creation, triage, assignment, evidence, disposition, object linkage and audit history.

### MA-OCT-005 — Ops frontend redesign

Refactor `ma-ops.js` as the client of the backend; deliver fleet, schedules, exceptions, tickets, case and budget views.

### MA-OCT-006 — GLEIF investigation

Execute the reliability investigation; integrate GLEIF operations into Ops; produce separately approved remediation packets.

### MA-OCT-007 — Standalone instrument–issuer navigation

Deliver platform-wide bidirectional navigation, canonical routing, mapping context, confidence states and ticket escalation for missing mappings.

### MA-OCT-008 — Bond ingestion

Implement SEC discovery, final-filing detection, parsing, confidence and entity linkage.

### MA-OCT-009 — Fixed Income API

Add directory, issuer, detail, coverage and freshness endpoints.

### MA-OCT-010 — Fixed Income UI

Add navigation, directory, entity integration and bond detail.

## Release gates

| Gate | Evidence required |
|---|---|
| Ops ownership | `ma-ops.js` holds no authoritative state; backend owns workflow and audit |
| Job coverage | Every job has owner, mode, intended/effective schedule and last-run state |
| Security | Mutation endpoints authenticated; no secrets exposed to the frontend |
| GLEIF diagnosis | Missing data classified as source absence, valid exception, pipeline omission or job failure |
| Navigation | Instrument-to-issuer and issuer-to-instrument journeys work platform-wide |
| Bond quality | Preliminary filings rejected; accepted records retain SEC provenance and confidence |
| Fixed Income UI | Real records render with freshness and not-live-pricing disclosure |
| D1 safety | Indexes, projected reads/writes, kill switch and mid-loop checkpoint reviewed |

## Deferred

- DCF calculator refresh.
- Municipal bond data.
- Secondary-market corporate bond prices.
- GLEIF mass remediation before diagnosis closes.
- Automated rerun/freeze controls before authentication and audit are proven.

## October acceptance statement

October closes only when Meridian Atlas has a backend-owned operational control plane surfaced through `ma-ops.js`; a complete job and schedule inventory; integrated exception and data-quality case management; an evidence-based diagnosis of GLEIF incompleteness; standalone bidirectional instrument–issuer navigation across the platform; and a usable Fixed Income page backed by SEC corporate bond issuance data.
