# Meridian Atlas — Agentic Delivery Factory Operating Kit

## Status

November review edition — 2 November 2026. Replaces the earlier operating-kit edition. Read with `claude_project_agentic_delivery_spec.md`. These documents define intended operation; they do not prove tool capabilities or authorise activation. Detailed schema, paths and launcher are to be approved after environment assessment.

## 1. Operating objectives

Keep Founder informed through the live HTML Control Tower. Remove Founder-mediated instruction/summary relay. Keep independent review and approval gates. Deliver within available usage using the selected model unchanged. Preserve separate role identities without maintaining a continuously active agent for every role.

## 2. Roles

| Role | Responsibility | Boundary |
|---|---|---|
| Founder | Scope, material decisions, permission grants, required approvals, outcome acceptance | Not routine courier |
| Main Lane / Program Orchestrator | Priorities, outcomes, approval preparation, exception resolution | No repeated narration or implicit production authority |
| Deterministic dispatcher | Validate readiness and launch approved runs; project state into dashboard | No independent product judgement or permission expansion |
| Code executor | Bounded implementation/investigation, tests, checkpoints and evidence | Cannot self-review, approve or close |
| Independent reviewer | Separate run/session examining scope, diff, tests and evidence | Cannot be the executing session relabelled |
| Specialist | Resolve a named domain question or mandatory domain review | Invoked only when needed |

Cowork/Code responsibilities depend on verified access and available launch mechanisms. No assumptions of native cross-chat handoff or shared Project upload state.

## 3. Four-line authority header

Every executable contract begins:

```text
ISSUED BY: named issuing role/actor
EXECUTED BY: named worker/actor
REVIEWED BY: named independent reviewer
APPROVED BY: named approver and applicable gate
```

Also identify work ID, outcome, phase, repository/branch, exact brief revision/hash, allowed paths/tools, budget, tests, production restrictions, stop gate and expected outputs. These are required contract fields, not permission to fill missing authority by assumption.

## 4. Records and source ownership

Adopt the one approved state design from the technical assessment; do not maintain JSON and YAML systems side by side. Each fact has one authoritative owner. Dashboard and board are views. Work records link to evidence, review and approval. Preserve existing release and decision history; agreed projections must reconcile after failed updates.

Separate stable governance from live state. Project uploads are reference snapshots unless synchronisation is explicitly implemented and tested. Confirm local access before telling a lane to read a shared path. Do not overwrite an existing repository `CLAUDE.md` with a Project reference file of similar name; inspect, merge approved rules and preserve safeguards.

## 5. Readiness and dispatch

A work unit is eligible only if dependencies, approved scope, named reviewer, tests, branch, permissions, budget and output contract exist; pause/hold is absent and capacity allows. Begin with one execution worker. Use a lease/run ID to avoid duplicate dispatch.

Default automation is off until the pilot architecture and permissions are approved. Scheduling intervals/operating windows are configuration decisions, not inherited October/BST constants. Use an agreed timezone such as Europe/London with explicit timestamps.

Routine checks and dashboard refreshes use ordinary code. Do not wake a model merely to report no change. A manual launch may be used during bootstrap, but label it assisted until automated launch is demonstrated.

## 6. Worker procedure

1. Verify repository/branch, work revision, active lease, pause/hold and scope.
2. Inspect relevant files only; read persistent safeguards and required references.
3. Execute within permitted surfaces; run relevant tests and bounded fixes.
4. Stop on ambiguity affecting permissions, budget, identity, schema or production risk.
5. Save checkpoint and evidence before exit where possible.
6. Submit review-needed state; do not approve or close.

Evidence contains outcome, diff/changed files, commands/checks and results, budgets used where measurable, non-actions, limitations, source references and next gate. Do not claim unrun tests passed. Keep conversational receipt concise; retain detail in artifacts.

## 7. Review and decisions

Separate reviewer receives the work contract, artifact/diff revision, tests and evidence; inspects surrounding context as needed. Verdicts: PASS, PASS_WITH_NOTES, FAIL, NEEDS_FOUNDER_DECISION.

FAIL requests scoped fixes; changed scope requires approval. PASS_WITH_NOTES must state whether notes block acceptance and who accepts residual risk. A reviewer pass is not deployment permission. Require new review/approval for materially changed artifacts.

Decision request includes one question, why blocked, options, recommendation, risk, deadline/impact and exact revision affected. Record actual Founder choice and permitted action. Silence or a stale approval is not consent.

## 8. Approval boundaries

Founder may preauthorise bounded read-only research, local tests or repository edits through an explicit work contract. Nothing auto-starts merely because its category appears low risk.

Require specific approval for production deployment, database writes/reprocessing, schema/migrations, cron/scheduler/LaunchAgent changes, secrets/tokens, additional spend, branch exceptions and scope expansion. Existing stricter safeguards prevail.

## 9. Branch, Git and platform discipline

Verify the post-patch release baseline and obtain an approved November working branch. Historical September/October names are not current authority. Do not silently create/switch branches.

Local authorised Code runs perform Git writes; Main Lane Git reads use `--no-optional-locks`. Check repository lock state before work, including actual Git directories when worktrees are used. Never delete a lock solely because it exists; verify no owning process and obtain approval for uncertain recovery. Keep approved Main Lane document edits in the next authorised commit with explicit file checks; no blanket staging of unrelated work.

Preserve current domain ownership, vanilla-JS/Workers constraints where mandated, front/backend separation and D1/storage/API budgets. Ops remains owned by Operations Lead; only `meridian-ops` writes `ops_*` under approved rules. Preserve applicable `INSERT OR IGNORE`, `db.batch()`, query-plan and recovery checks; do not invent missing numerical limits. Obtain current limits from approved project references before work.

## 10. Usage and interruption

Selected model stays unchanged. Limit active execution initially to one. Invoke specialist/reviewer only for defined work. Avoid repeated whole-project reads, copied summaries and needless subagents. Run tests and bounded fixes together; persist concise resumable checkpoints.

Hold dispatch when allowance is unavailable or Founder sets a capacity hold. Display the reason and reset time if known; distinguish manual entries from verified telemetry. No retry storm. Continue non-AI visibility. Before resuming verify working tree, lease, artifact versions, permissions and whether an external action already occurred.

## 11. Founder routine

At a review window or notification, inspect: running work, changed results, review queue, blockers and approvals. Respond to scoped decisions, not repeated status requests. Set pause if necessary. Main Lane resolves priority/meaning; ordinary state changes should not require a new Main Lane conversation.

The Control Tower must show heartbeat and stale state so Founder can distinguish idle, blocked, capacity-held and offline operation. Markdown digest is an optional deterministic fallback, not the primary interface or a model-written entry every polling cycle.

## 12. Closure and acceptance

Close only when deliverables/tests, independent review, required Founder acceptance and record reconciliation are complete. Keep ticket state distinct from individual work-cell state. Reconcile board, release ledger and decision history together using recoverable updates; do not destroy October records to create November records.

Pilot acceptance requires the actual dispatch → execution → review → Founder gate → record loop plus pause/recovery/duplicate tests. Missing automatic review launch must be recorded as a limitation. November content work then uses the accepted workflow; do not create a second delivery process.
