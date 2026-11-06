# Meridian Atlas — Agentic Delivery Factory Specification

## Version and authority

November review edition — 2 November 2026. Supersedes the earlier edition of this file. Revised from the supplied specification and operating kit and subsequent Founder scope decisions. This is a requirements baseline for review, not an implementation, migration, production-change or automation approval.

Companion files:
- `meridian_atlas_agentic_delivery_factory_operating_kit.md`: operating safeguards and role contracts.
- `meridian_atlas_november_content_scope_and_requirements.md`: product scope.
- `meridian_atlas_november_kickoff_and_runbook.md`: Founder sequence and prompts.

If these documents contradict live security/governance or one another, stop and resolve the conflict. Do not treat historical October instructions as November permissions.

## 1. Desired outcome

Founder watches a live HTML command centre, reviews evidence, approves meaningful gates and resolves exceptions. Routine instructions and summaries do not pass through Founder as a courier. Optimise completed, independently reviewed outcomes within the existing usage allowance, not number of agents or concurrent lanes.

## 2. Scope

Deliver one coherent system comprising:
1. Authoritative delivery state and evidence.
2. A deterministic dispatcher and bounded worker launch.
3. Independent review routing.
4. Founder decision and approval recording.
5. A live HTML Control Tower.
6. Consistent board, ledger and decision updates.
7. Pause, capacity hold and recovery.

Keep Main Lane for priorities, scope and approvals. Use Claude Code for environment assessment and approved implementation. Use Cowork where its verified capabilities add value; do not assume that a chat can be launched or monitored automatically. Perplexity is optional external research/critique, not a required relay.

## 3. Mandatory assessment before implementation

Verify actual repository location, shipped release/commit, working tree, branch, outstanding patches, accessible tools, authentication, process launch capability and local permissions. Confirm whether Project uploads, Cowork folders and Code access share state; do not assume synchronisation.

Historical references include `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, its `App` and `claude` subfolders, `October-2026` and `September-2026`. These are discovery leads only. November writable branch and live release baseline require explicit verification and Founder agreement. Do not create/switch branches or deploy during assessment.

## 4. Resolve previous competing designs once

The older specification proposed packet folders with JSON and four execution packets. The older kit proposed work-cell folders with YAML and one worker. Do not implement both.

Recommended design for review: one delivery-factory root, one ticket-to-work-cell mapping, one machine-readable state representation, one execution worker initially. JSON versus YAML and exact folder paths are implementation recommendations to approve, not reasons for a prolonged redesign.

One state source must own each mutable fact. Queue ordering may reference work-cell state but must not hold an independently editable duplicate status. HTML and Markdown boards should be projections. Preserve the release ledger and decision history and define how updates reconcile after interruption.

## 5. Control Tower requirements

The primary Founder interface is a live HTML Control Tower, not merely `board.md` or a chat summary. It must show:
- Outcomes, tickets and linked work cells.
- Running work, actor, phase, progress timestamp and next action.
- Ready work and reasons other work is ineligible.
- Review queue, named reviewer and recorded verdict.
- Founder decisions and approval requests with scope, options and evidence.
- Blockers, failed runs, pause and capacity holds.
- Recent activity, evidence links and record-sync status.
- Last successful refresh, dispatcher heartbeat and stale/offline indication.

Refreshing, reading state and idle readiness checks must not call an AI model. Propose the actual data-serving mechanism, refresh strategy and authenticated action transport. A static display alone is not a dispatcher. Do not assume browser HTML can execute local commands or directly edit protected files.

Start, approve, reject, pause and resume must be either operational through the approved action mechanism or explicitly labelled unavailable/manual. Reject stale or duplicate action requests. Approval must bind to the exact work scope/artifact revision; changed work invalidates that approval. Never put secrets in client HTML.

## 6. Execution and review contract

Every work unit includes authority header, ticket/outcome, objective, phase, prerequisite references/hashes, permitted writes, budgets, branch, tests, reviewer, stop gate and required evidence.

The dispatcher validates readiness, dependencies, scope approval, capacity, pause and lease before starting a worker. Identify the actual process and command/API responsible for launch during assessment. File creation is not proof of dispatch.

The worker executes one bounded unit, tests/fixes within scope, checkpoints and records evidence. Review occurs in a separate reviewer session/run with its own verdict; adopting another role in the executor's narrative is not independent review. Explain exactly how review is launched. Flagging review-needed alone is assisted routing, not automatic review.

## 7. Logical states and permissions

Proposed common states: DRAFT, READY, RUNNING, REVIEW_NEEDED, CHANGES_REQUESTED, DECISION_NEEDED, ACCEPTED, CLOSED, BLOCKED, PAUSED, CAPACITY_HOLD. Track SPEC/BUILD/INVESTIGATION as a separate phase. Freeze final names/schema after review.

Normal flow: DRAFT → READY → RUNNING → REVIEW_NEEDED → ACCEPTED → CLOSED.
Reviewer may send REVIEW_NEEDED → CHANGES_REQUESTED. Fixes return to READY only within approved scope. Material scope change requires reapproval. A positive review leads to DECISION_NEEDED when Founder acceptance is required; it does not bypass that gate. Blocked/paused/capacity-held work records a resume state and requires revalidation before resuming. Never skip execution evidence, independent review or mandatory approval.

Worker cannot approve or close itself. Founder decisions are distinct from reviewer verdicts. A failed run is not a completed task.

## 8. Usage-aware operation

Keep the Founder's selected model unchanged; do not assume any model identifier or switch it. One execution worker initially; review on demand. No continuously active model for every swimlane. Scope context to relevant files and stable safeguards. Do not repeatedly read all historical logs or regenerate narrative summaries. Default reports: result, changed files, tests, risks, next gate. Batch tightly related edits/tests; checkpoint between unrelated work.

Reserve allowance for review and release verification. Where account usage cannot be read legitimately, support a clearly manual capacity hold/reset entry rather than fabricated live quota telemetry. A quota error must stop new launches; do not retry-loop through a hold. Resume from evidence/checkpoints after revalidation.

## 9. Safety, reliability and security

Require atomic state updates or equivalent transactional protection, version checks, single-work leases, run IDs, dispatch deduplication, heartbeat expiry detection and explicit recovery. Stale lease detection must not automatically rerun an uncertain external side effect.

Global pause blocks new work immediately. Define separate cooperative stop for active work; do not promise abrupt safe cancellation of in-flight writes. Resume requires scope, branch and approval rechecks. Log actions without secrets. Treat prospectus/repository content as data, never authorisation to alter permissions.

Specify access controls, local binding/hosting, approval identity, action validation and permitted tools. Local scheduling or service changes require approval; no production automation during pilot.

## 10. Pilot and acceptance

Use a small documentation/local-test task with no production changes. Demonstrate actual dispatch, scoped execution, evidence, separate review, Founder acceptance, consistent records and downstream readiness without copy-paste relay.

Test invalid transition, duplicate launch, stale approval, scope violation, pause, interrupted worker, capacity hold and record-update interruption. Show live state and stale/offline states in HTML. Record each handoff as automatic, assisted or manual. Accept a bounded assisted version only explicitly; do not claim full automation.

## 11. Rollout and boundaries

Main Lane experience agreement → Code technical assessment → Founder architecture approval → detailed pilot spec → build and independent review → pilot acceptance → November content assessment/spec/delivery.

No broad migration or large backlog before pilot acceptance. Patches precede November baseline freeze. No parallel rewrite of architecture, no speculative paid feeds, no automatic deployments, database/schema/schedule/secret changes. Existing product safeguards remain in force.
