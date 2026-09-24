# Meridian Atlas — October Operating Kit v2

## Purpose

This kit governs every October release session. It establishes the authoritative local workspace, role and lane controls, packet boundaries, build handoffs, operational safety rules and release evidence required to work consistently across separate Claude projects.

This version supersedes prior October operating-kit path assumptions.

---

## Authoritative Workspace

The following three locations together form the release baseline:

| Purpose | Authoritative path | Rule |
|---|---|---|
| Core baselined release files | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` | Use for repository-level context, baseline documents, configuration and supporting files |
| Latest application files | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App` | Use as the source of truth for current application code and all implementation work |
| September release and build instructions | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude` | Read before planning, changing, building, testing or releasing October work |

### Path precedence

When files or instructions appear to conflict, apply this order:

1. **Build and release procedure:** the instructions in `.../claude` take precedence.
2. **Current implementation:** the latest code in `.../App` takes precedence over older duplicate application files elsewhere.
3. **Release baseline and context:** the root `Meridian Atlas Clean (v11)` folder supplies the baseline documents and repository context.
4. **Unresolved conflict:** stop and raise a change request; do not guess, merge copies or overwrite a newer file with an older baseline.

The old `June Refresh/`, `ETF Refresh/`, `Corporate Atlas/`, `Ops/` and proposed `Fixed Income/` execution paths from earlier operating-kit drafts are not valid unless they exist inside the confirmed baseline and the current `claude` instructions explicitly direct their use.

---

## Mandatory Session Start

Every new Claude or Claude Code project must begin from the baseline root:

```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)"
pwd
git status --short --branch
```

Then perform these steps in order:

1. Read the relevant September release and build instructions from:

```text
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude
```

2. Inspect the current implementation in:

```text
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App
```

3. Identify the exact files affected by the active packet.
4. Compare any apparent duplicate against the `App` copy before editing.
5. State role, lane, packet, working directory and authoritative files.
6. Do not modify files until the packet scope and acceptance criteria are confirmed.

### Required opening block

```text
ROLE: [Program Orchestrator / Operations Lead / Engineering Lead / UX Lead / Data-Identity Lead]
LANE: [Control / Operations / Application / Design-UX / Data-Identity]
PACKET: [MA-OCT-### — packet name]
BASELINE ROOT: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
IMPLEMENTATION ROOT: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App
BUILD INSTRUCTIONS: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude
EXECUTE FROM: [exact folder required by the build instructions]
FILES IN SCOPE: [explicit file list]
```

If this block is missing or an execution path points outside the confirmed baseline without approval, the packet must not proceed.

---

## Source-of-Truth Rules

### Application code

`App` is the authoritative current-code location. All application discovery, modification and local validation starts there unless the `claude` build instructions prescribe a specific command from the baseline root.

### Build instructions

The `claude` folder is the authoritative source for September release knowledge and build/deployment procedure. October work may extend those instructions through an approved packet, but must not silently replace or contradict them.

### Baseline files

The baseline root is the release workspace. Repository documents, configuration, release artefacts and supporting material found there remain in scope, but an older root-level copy of an application file must not override the latest copy in `App`.

### Duplicate-file safety

Before editing a file whose name exists in more than one location:

```bash
find "/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)" -type f -name "FILE_NAME"
```

The session must record which copy is authoritative. Do not edit two copies to “keep them in sync” unless the release instructions explicitly require it.

---

## Operating Model

- One session equals one packet and one declared primary lane.
- Supporting roles may review or contribute, but ownership remains explicit.
- No packet absorbs another packet's work without a change request.
- No schema, schedule, Worker, folder, security or deployment change occurs implicitly.
- The active packet must identify exact input files, output files, tests and release evidence.
- Every packet ends with a status update and a concise handoff suitable for a fresh Claude project.

---

## October Workstreams

| Workstream | Outcome | Primary owner | Supporting owners |
|---|---|---|---|
| Operations Control Plane | Backend-owned operational system surfaced through `ma-ops.js` | Operations Lead | Engineering Lead, UX Lead |
| GLEIF Reliability | Diagnose missing entity information and job operation | Data-Identity Lead | Operations Lead |
| Instrument–Issuer Navigation | Standalone bidirectional navigation across Meridian Atlas | Engineering Lead | UX Lead, Data-Identity Lead |
| Fixed Income Vertical | Corporate-bond ingestion, API and Fixed Income UI | Data-Identity Lead | Engineering Lead, UX Lead |

The DCF refresh is deferred. Standalone instrument–issuer navigation remains committed scope and must not be absorbed into Fixed Income.

---

## October Packet Register

| Packet | Primary role | Lane | Outcome |
|---|---|---|---|
| MA-OCT-000 | Program Orchestrator | Control | Runtime truth baseline and authoritative file/job inventory |
| MA-OCT-001 | Operations Lead | Operations | Ops backend foundation and system of record |
| MA-OCT-002 | Operations Lead | Operations | Complete job registry, effective schedules and run health |
| MA-OCT-003 | Operations Lead | Operations | Backend exception-management workflow |
| MA-OCT-004 | Operations Lead | Operations | Backend data-quality ticketing and audit trail |
| MA-OCT-005 | UX Lead | Design-UX | `ma-ops.js` redesign over the Ops backend |
| MA-OCT-006 | Data-Identity Lead | Data-Identity | GLEIF feed, queue and job investigation |
| MA-OCT-007 | Engineering Lead | Application | Standalone instrument–issuer bidirectional navigation |
| MA-OCT-008 | Data-Identity Lead | Data-Identity | SEC corporate-bond ingestion and entity linkage |
| MA-OCT-009 | Engineering Lead | Application | Fixed Income serving API |
| MA-OCT-010 | UX Lead | Design-UX | Fixed Income page and issuer/bond journeys |

---

## Role Rules

### Program Orchestrator

Owns packet order, scope boundaries, dependency management, release evidence and cross-project continuity. It does not implement another role's packet by default.

### Operations Lead

Owns the job registry, schedules, run ledger, exceptions, data-quality ticketing, controls, operational acceptance and release readiness. It may stop a job or release where controls or evidence are inadequate.

### Engineering Lead

Owns application/backend implementation, APIs, integration contracts, canonical routing, tests and technical release quality. It cannot redefine product scope without a change request.

### UX Lead

Owns information architecture, workflows, states, accessibility, design-system consistency, transparency labels and front-end acceptance. It specifies error, empty, loading, stale and low-confidence states before implementation closes.

### Data-Identity Lead

Owns primary-source ingestion, schemas, provenance, mappings, GLEIF investigation, bond parsing, confidence rules and data-quality validation. It cannot initiate a broad remediation/backfill without write-budget approval.

---

## Packet Handoff Template

Every implementation handoff must use this structure:

```text
ROLE:
LANE:
PACKET:
BASELINE ROOT: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
IMPLEMENTATION ROOT: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App
BUILD INSTRUCTIONS: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude
EXECUTE FROM:
FILES IN SCOPE:
FILES OUT OF SCOPE:
DEPENDENCIES:
ACCEPTANCE CRITERIA:
TEST COMMANDS:
ROLLBACK METHOD:
REQUIRED EVIDENCE:
```

A handoff must not say “update the app” or “fix Ops” without naming the files and acceptance criteria.

---

## Change Control

Use a change request before:

- Creating or moving a folder.
- Selecting a different copy of a duplicated file.
- Adding or removing a Worker, cron or local scheduled job.
- Adding or changing a D1 table or index.
- Changing authentication, routes, bindings or secrets.
- Altering the release/build instructions in `claude`.
- Expanding a packet into another lane.
- Starting a broad GLEIF backfill or remediation.

Each request records reason, affected paths, risks, D1 impact, rollback and approval.

---

## Data and Worker Safety

Before activating any D1-writing process:

1. Confirm the global hold/kill switch is absent or false.
2. Confirm sufficient write headroom for the projected run.
3. Confirm a mid-loop checkpoint and safe resumability.
4. Confirm indexes and query plan for high-volume access.
5. Confirm the job appears in the Ops registry with intended schedule and owner.
6. Confirm start, completion, skip, failure and partial-run events reach the Ops run ledger.

No recurring job is complete merely because a cron exists. It needs an owner, expected completion signal, lateness threshold, failure visibility and default-to-off behaviour where its purpose is finite.

---

## Ops Integration Standard

All recurring and on-request jobs inventoried during MA-OCT-000 must be represented in the Ops control plane. At minimum, each record contains:

- Job and Worker identifier.
- Domain and owner.
- Source path relative to the confirmed baseline.
- Intended and effective schedule.
- Execution mode.
- Last start, last success and last failure.
- Next expected run and lateness threshold.
- Kill-switch status.
- Cursor/checkpoint.
- Read/write usage where measurable.
- Linked exceptions and data-quality tickets.

`ma-ops.js` remains a frontend file in `App`; authoritative operational state resides behind `meridian-ops` APIs.

---

## GLEIF Investigation Gate

MA-OCT-006 is diagnostic before remedial. It must classify missing information as:

- No reliable LEI match.
- Legitimate GLEIF absence or reporting exception.
- Meridian ingestion or mapping omission.
- Queue or job-operational failure.

The packet must inspect schedules, runtime state, queue ageing, retries, failure reasons, cursors and source-versus-Meridian samples. Mass remediation is a new packet requiring approval.

---

## Navigation Standard

MA-OCT-007 remains standalone and platform-wide:

- Instrument to issuer.
- Issuer to linked instruments.
- Canonical IDs rather than names as routing keys.
- ISIN, CUSIP, ticker, asset type, match source and confidence retained where available.
- Explicit unmatched, ambiguous and low-confidence states.
- Ability to raise a linked data-quality ticket.

Fixed Income uses this navigation contract but does not own or limit it.

---

## Fixed Income Standard

The Fixed Income vertical includes data, API and UI:

- SEC EDGAR corporate issuance data only for October.
- Final priced filings; preliminary filings rejected or explicitly quarantined.
- Provenance and parsing confidence stored with each tranche.
- Entity linkage through CIK and canonical Meridian identifiers.
- Fixed Income directory, issuer journey and bond detail page.
- Clear disclosure that the data is issuance/reference information, not live secondary-market pricing.

---

## Verification and Release

Before any release:

1. Confirm the working directory is inside the baseline root.
2. Confirm all changed application files came from `App`.
3. Re-read the applicable instructions in `claude`.
4. Run packet-specific tests and regression checks.
5. Verify no unintended duplicate file was edited.
6. Review git diff and status.
7. Record schema, schedule, Worker and route changes.
8. Capture deployment identifiers and timestamps.
9. Run post-deployment smoke tests.
10. Update the Ops registry, sprint board and fresh-session handoff.

### Release evidence

Each packet closes with:

- Changed-file list using absolute or baseline-relative paths.
- Test commands and results.
- Before/after evidence.
- Deployment evidence where applicable.
- D1 and schedule impact.
- Known limitations.
- Rollback command or procedure.
- Final status: complete, partial, blocked or rolled back.

---

## Prohibited Actions

- Do not execute from an old workspace because a prior prompt mentions it.
- Do not treat root-level duplicate application files as newer than `App` without evidence.
- Do not bypass the instructions in `claude`.
- Do not copy whole folders between old and new workspaces as a substitute for a reviewed diff.
- Do not expose Cloudflare credentials or other secrets in chat, source, logs or frontend code.
- Do not combine investigation, remediation, UI and deployment into one uncontrolled packet.
- Do not enable schedules or bulk writes without operational registration and budget checks.

---

## Fresh-Project Bootstrap Prompt

Paste the following at the start of a new Claude project:

```text
Use the Meridian Atlas October Operating Kit v2.

The complete release baseline is:
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)

The latest application code is:
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App

The authoritative September release and build instructions are:
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude

Before doing any work:
1. Read the relevant instructions in the claude folder.
2. Inspect the latest implementation in App.
3. State ROLE, LANE, PACKET, EXECUTE FROM and FILES IN SCOPE.
4. Report duplicate or conflicting files before editing.
5. Stay inside one packet and follow its acceptance criteria.

Active packet: [INSERT PACKET ID AND NAME]
```

---

## Governing Statement

The three confirmed paths are one coordinated release baseline: the root provides release context, `App` provides the latest implementation, and `claude` provides the authoritative release/build procedure. Every October packet must identify and use all three correctly before work begins.
