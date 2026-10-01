# Spec Brief: MA-OCT-001, Ops Backend Foundation (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Operations Lead (packet owner; writes the spec)
REVIEWED BY:  Architect
APPROVED BY:  Founder
PACKET:       MA-OCT-001 — Ops backend foundation
GATE:         Spec approval (target Tue 29 Sep) → Build Brief issued by Main Lane → Wave 1 build (1–9 Oct, Engineering Lead)

ROLE:         Operations Lead
LANE:         Operations (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-001_Spec.md (new, the only file this lane writes)
```

## Parallel-lane rules (this lane runs alongside the MA-OCT-006 spec lane and MA-OCT-012's hold)
1. **Doc-only.** No code edits, no `wrangler deploy`, and no D1 writes. D1 reads are limited to the schema catalogue (`sqlite_master`) and `wrangler d1 info`.
2. **No git writes at all:** no add, commit, switch or push. Read git only with `git --no-optional-locks` (Addendum rule 6). The Main Lane commits the approved spec later, through the next executing lane (rule 7).
3. Write **only** `claude/MA-OCT-001_Spec.md`. Don't touch the Decisions Log, the Addendum, or any other lane's files.
4. Use `/write-spec` (mandatory per CLAUDE.md).

## Inputs (read first)
- `claude/meridian-october-revised-scope-v2.md`: Operations Control Plane section and release gates.
- `claude/Meridian_October_Operating_Kit_v3_Addendum.md`: §1 D3/D4, §4 (front end kept separate from the backend, `entity_exceptions` migration), §5.
- `claude/MA-OCT-000_Closeout_Summary.md`, `MA-OCT-000_Job_Manifest.md` / `.json` (47 jobs), and `MA-OCT-000_Architect_Review.md` (N1, N3, ruling 1).
- The current `App/Ops/` source (`meridian-ops` Worker, `wrangler-ops.toml`) and `App/ma-ops.js`, for what exists today.
- `claude/MA-SEP-015a_Spec.md` / `MA-SEP-015b_Build_Brief.md`: the Cloudflare Access precedent and the `entity_exceptions` design.

## The spec must decide and document
1. **Schema for the 5 Ops tables** (`ops_job_registry`, `ops_job_run`, `ops_exception`, `ops_data_quality_ticket`, `ops_case_event`). For each table:
   - columns, keys and indexes;
   - Team v3 table rules: Core, Derived/Cache or Ephemeral; rows at launch, per month and at 12 months; retention and prune rule;
   - domain = **Ops**; the only writer is `meridian-ops`.

   Also show how exceptions and tickets link to jobs, runs and domain objects (entity, instrument, ETF, filing, bond). The design must allow MA-OCT-003/004 to migrate `entity_exceptions` rows without losing `decided_by` and `decided_at`.
2. **Authentication model.** Covers human mutations (Cloudflare Access, following the MA-SEP-015b precedent) and service-to-service heartbeats (shared secret vs service binding). No service bindings exist today, so adding one needs a CR. The spec must show that no anonymous mutation route exists and that no secret reaches the front end.
3. **Heartbeat and run-event contract.** Covers:
   - the events: start, success, partial, skipped, failed, killed;
   - the payload: duration, reads and writes, cursor, error summary;
   - idempotency, so a retried event doesn't double-count;
   - behaviour when `meridian-ops` is down: jobs must **never** fail because Ops is unreachable (fire-and-forget with a timeout).
4. **D1 budget.** Projected writes per day from heartbeats and audit events across the 47 jobs, reads per Ops API call, the index plan (`EXPLAIN QUERY PLAN` intent for each query) and a kill switch. This must satisfy the three-point check.
5. **Cron-slot plan (Architect N3).** The account is at 5 of 5 slots. State whether Ops needs a scheduled sweep for lateness detection. If it does, the recommended source is retiring the `meridian-bootstrap` cron (finished since 11 June) together with auth-gating or removing its unauthenticated `/trigger` (N1). That needs ETF Product Lead consultation and a CR, so list it as a prerequisite, not something 001 does silently.
6. **Worker size.** Check whether `meridian-ops` stays under the split rule (15 routes / ~1,500 lines) after 001, or whether an Architect decision on a new Worker is needed.
7. **Boundaries.** 001 builds the foundation only. Registry population and schedule drift belong to 002 (which also needs the Workers-Read-scoped token from Architect ruling 1). Exception and DQ workflow and the migration belong to 003 and 004. UI belongs to 005. Wiring individual Workers to emit heartbeats is staged: 001 defines the contract and wires **zero or one** pilot Worker, and 002 wires the rest.
8. **Housekeeping for the build step.** In the build, update the D1 `sprintboarditems` row `MA-OCT-001` (the August item) to `SUPERSEDED → MA-OCT-003/004` (Architect finding 8). This is one guarded write.
9. **Acceptance criteria and test plan** for the 001 build, plus rollback (dropping or ignoring new tables, redeploying the prior `meridian-ops` version `589ae24c`).
10. **Open questions** for the Founder: at most 3, each with a recommended answer.

## Output
`claude/MA-OCT-001_Spec.md`, starting with the four-line header. Report to the Main Lane when it's written, with the file's SHA-256. The Main Lane runs the Architect review.
