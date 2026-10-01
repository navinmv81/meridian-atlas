# Spec Brief: MA-OCT-006, GLEIF Reliability Investigation (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (packet owner; writes the investigation spec)
REVIEWED BY:  Operations Lead
APPROVED BY:  Founder
PACKET:       MA-OCT-006 — GLEIF reliability investigation
GATE:         Spec approval (target Wed 30 Sep) → investigation runs 1–14 Oct (read-only) → ranked remediation matrix → go/no-go on MA-OCT-011

ROLE:         Data-Identity Lead
LANE:         Data-Identity (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-006_Spec.md (new, the only file this lane writes)
```

## Parallel-lane rules (this lane runs alongside the MA-OCT-001 spec lane and MA-OCT-012's hold)
1. **Doc-only.** No code edits, no deploys, no D1 writes, and **no new D1 queries or GLEIF API calls**. The spec plans the investigation; the investigation runs after approval. Use MA-OCT-000's evidence plus reading the source code.
2. **No git writes:** no add, commit, switch or push. Read git only with `git --no-optional-locks` (Addendum rule 6). The Main Lane commits the approved spec later (rule 7).
3. Write **only** `claude/MA-OCT-006_Spec.md`.
4. Use `/write-spec`.

## Inputs (read first)
- Scope v2 (GLEIF Reliability section) and Addendum §5 (006, and 011 as conditional).
- **MA-OCT-000 evidence:** Closeout §7 (GLEIF snapshot and queue profile), and findings F4, F6, F7 and F10; the Architect review (ruling 2, the MA-SEP-017 SCAN deferred to here; finding 5).
- Source for `entities-seed.js`, `entities-enrich.js` (Phase 1–3 selection logic), `entities-delta.js` and `entities-enrich-boost-run.mjs`.
- `Sprint_Board.md` Known Issues 22.9, 22.10, 22.16 and 22.17; backlog MA-OCT-003 (now 011: offline Level 2 relationship backfill) and its open questions.

## Facts the spec must explain or plan to test
- **F4:** 26,537 queue rows are `pending` and have never been attempted (latest `last_attempt` on any row is 2026-08-31), and 1 row has been `in_progress` since 2026-06-11. Yet `entities-enrich` "succeeds" twice a day and Phase 3 handles about 44 entities per run. **The first hypothesis to test** is that Phase 3 selects from `entity_master`, not from the queue, so the queue is orphaned. Confirm or refute it by reading the code first.
- **F10:** `entities-delta` has never run (cron held).
- **F6:** the evening enrich-boost run fails its headroom check every day.
- **Baseline:** 16,557 of 43,785 entities (37.8%) have an LEI.
- **Queue schema gap:** there is no `retry_count` or `failure_reason` column.

## The spec must define
1. **The four-way classification**, with decision rules applied per entity:
   - (a) no reliable LEI match;
   - (b) legitimate GLEIF absence or reporting exception;
   - (c) the value is in GLEIF but Meridian omitted it at ingestion or mapping;
   - (d) the record is queued but a job is frozen, late, stalled or failing.

   For each category, state what evidence places an entity there.
2. **Evidence plan.** Every query with its purpose, expected `EXPLAIN QUERY PLAN` and read estimate. Plus:
   - a total read budget (propose one; MA-OCT-000 used 160k);
   - a stratified sample for source reconciliation, covering size and strata (entity type, country, source, LEI status), and whether to use the GLEIF API (rate limits, call budget) or the Golden Copy file;
   - where the work runs: local Claude Code, since Cowork can't reach GLEIF or Cloudflare.
3. **The MA-SEP-017 residual** (Architect ruling 2). Choose one: (i) a CR to add an `updated_at` index on `entity_master`, including its write cost; (ii) a sampled check instead; or (iii) close it as superseded. Recommend one.
4. **Completeness measures:** by field (`lei`, `direct_parent_lei`, `ultimate_parent_lei`, name, country), entity type, country, source and LEI status.
5. **Relationship check.** Before calling a parent "missing", check relationship records and reporting exceptions. Include Known Issue 22.9's 4 known-bad edges as a separate item, since it's a different root cause.
6. **Ops feed.** Specify what GLEIF job status and exceptions MA-OCT-006 hands to the Ops control plane (001–004), expressed in terms of the 001 heartbeat contract. This is a dependency note, not a build.
7. **Deliverable format:** a ranked root-cause × remediation matrix covering cause, affected count, evidence, fix, owner, D1 write cost and risk. Plus explicit **go/no-go criteria for MA-OCT-011** (offline Level 2 backfill). No remediation is done inside 006.
8. **Acceptance criteria**, the investigation timeline (1–14 Oct), and at most 3 open Founder questions, each with a recommended answer.

## Output
`claude/MA-OCT-006_Spec.md` with the four-line header. Report to the Main Lane with its SHA-256. The Main Lane routes it to the Operations Lead for review.
