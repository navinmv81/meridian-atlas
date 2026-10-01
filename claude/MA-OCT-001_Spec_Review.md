# MA-OCT-001 Spec — Architect Review

```text
REVIEWER:     Architect (hosted in October Main Lane; not the spec author)
PACKET:       MA-OCT-001 — Ops backend foundation (spec)
VERDICT:      PASS WITH NOTES
DATE:         2026-09-26
SPEC:         claude/MA-OCT-001_Spec.md, 780 lines, SHA-256 d69e0ade3cb320a409c44df6c1d18dbc453a8c98ce9f7d94e29c20137fa9b3a5 (re-verified on the Mac)
```

## Evidence checked
1. The full spec (§0–§17) against its brief (`b7f5e28a…`). All 10 "must decide" items are answered.
2. Source facts re-checked on `October-2026` @ `5405e3e`: `App/Ops/src/ops-api.js` is 507 lines; `App/Ops/` holds `migrations/`, `seed-ops-tables.js`, `src/` and `wrangler-ops.toml`. This matches the spec's baseline (§10, §17).
3. Cross-check with the approved MA-OCT-006 spec §8.2 and the Operations Lead review N-3. The two lanes wrote in parallel, so this spec does not yet carry those requirements (see Required item R-1).

## Assessment
This is a strong, buildable foundation spec. The design choices are the right ones for this platform:
- **The run ledger is append-only**, with `UNIQUE(run_id, phase)` and `INSERT OR IGNORE`. That honours the global D1 rule literally, makes retries no-ops, and removes counters entirely.
- **Audit is enforced by triggers**, not by convention.
- **Service auth uses a hashed per-emitter key bound to `job_id`**, so a leaked key can't write another job's runs.
- **Auth and the kill switch are checked before any D1 read**, so an unauthenticated flood costs 0 reads.
- **Emitters are fire-and-forget** with a 2 s ceiling. Ops can never fail a job.
- **The `entity_exceptions` migration** keeps `decided_by`/`decided_at` verbatim and marks them `legacy_migration`, which is honest provenance.
- **The budget is modest:** about 20 writes a day in the pilot, about 150–210 fully wired, with a hard cap of 5k a day (5%).
- **It finds a real security gap:** 4 anonymous POSTs today, not the 3 MA-OCT-000 counted. It closes all 4.

## Required (binding conditions carried into the Build Brief; no spec rewrite needed)

**R-1. Adopt MA-OCT-006 §8.2 in contract v1 *before* the migration runs.** Adding columns after the table exists is cheap, but changing the contract once emitters exist is not. The changes:

| 006 need | Change to this spec |
|---|---|
| `progress_count` separate from attempted | In `ops_job_run`, **replace** `items_processed` with two columns: `items_attempted INTEGER NULL` and `items_progressed INTEGER NULL` (rows whose state actually advanced). Payload fields: `items_attempted`, `items_progressed`. Rule: an emitter that can't tell them apart sends only `items_attempted` and leaves `items_progressed` NULL; it never copies the value. |
| Bounded job metrics | `detail.metrics` is a flat object of integer counters (≤ 16 keys, keys ≤ 32 chars), inside the existing 2 KB `detail` cap. The GLEIF key set is `selected, attempted, progressed, failed, deferred, external_calls, ext_2xx, ext_404, ext_4xx, ext_429, ext_5xx`. The server validates the shape and drops non-integer values. |
| Per-phase `run_key` | Solved with **per-phase `job_id`s**. Enrich is registered as two jobs, `cf.meridian-entities-enrich.phase1` and `cf.meridian-entities-enrich.phase23`, and the same convention applies to any multi-phase Worker. No new column is needed, because `run_id` stays unique per run. Record the convention in §5.2 of the build notes. |
| `skipped` reason codes | `detail.reason` becomes a Worker-validated enum when `event='skipped'`: `hold`, `pause`, `budget`, `auth`, `out_of_window`, `empty_input`. Other events may send free text. |

**R-2. Git coordination with MA-OCT-006.** Both lanes run on `October-2026` between 1 and 9 Oct. The build commits only by explicit path, runs `git pull --ff-only` before every commit, and stops and reports if the fast-forward fails.

## Rulings on the spec's open items

| Item | Ruling |
|---|---|
| **Q1 pilot emitter** | **(A) local `entities-enrich-boost`, endorsed.** It avoids enrich's 44/50 subrequest margin and the workers.dev-to-workers.dev fetch risk (error 1042) in the pilot. Its F6 failures are exactly the evidence that end-only `failed` events need to prove. The Data-Identity Lead acknowledgement stays a build precondition. |
| **Q2 legacy board buttons stop working** | **Accept.** Anonymous mutations fail the release gate. The only cost is the Program Orchestrator's own board buttons, which moves those writes to the Access-protected admin routes until 005. |
| **Q3 bootstrap cron retirement as a 002 prerequisite** | **Yes.** This is the Architect's own N3 recommendation. It frees the one cron slot Ops alerting needs, removes a live unauthenticated write endpoint (N1), and lowers D1 load. It needs a CR with the ETF Product Lead consulted, inside 002. |
| **§10 Worker split (decision needed before the 002 spec)** | **Direction set now: option 1.** Move the governance routes (sprint board and release ledger, 6 endpoints) into a new `meridian-control` Worker, whose tables are `sprintboarditems`, `releaseledger` and `operationalevents`. This doesn't conflict with D3, because D3 governs `ops_*` tables and these aren't `ops_*`. They become a **Control sub-domain owned by the Program Orchestrator**, with `meridian-control` as their only writer. The new Worker still needs its own CR in 002, but the direction is settled so 002 can plan for it. Options 2 and 3 are rejected. Option 2 games the split rule. Option 3 would break D3's single-writer guarantee. |
| **§12 D1 board ID collision** | Program Orchestrator decision (this lane): the August row is closed as the spec describes. The October packet's D1 board row, when the board is next synced, uses **`MA-OCT-001-OPS`**. Every document keeps `MA-OCT-001`. The legacy `ticket_id` is never rewritten, because `operationalevents.ticket_id` references it. |
| 180-day run retention, manual prune, no cron in 001, Access-only new reads | Accepted, all within Operations Lead authority. |

## Notes for later packets (not conditions)
- **N-1 (005). Console origin and auth.** Once `*` is removed from the admin CORS rules, a console hosted on GitHub Pages can't call an Access-protected `workers.dev` API with cookies across origins without further work. Third-party cookie limits apply. 005's spec must pick one approach up front:
  - serve the console from the Worker's own hostname;
  - use an Access-protected same-origin path; or
  - use service-token mediation.
- **N-2 (005). Public legacy reads.** `/api/ops/cf/invocations` and `/api/ops/cf/d1-today` publicly expose Worker names and usage figures. The risk is low, but 005 should decide whether they stay public.
- **N-3 (002). First Worker emitter.** It must pass the error-1042 test before the other Worker emitters are wired, and reserve its heartbeat subrequest(s) in its checkpoint, reviewed by the domain lead.
- **N-4 (003/004). Scale watch.** Dedupe keys and `UNIQUE(legacy_source, legacy_id)` make the migration safe to re-run. It needs a row-for-row verification against a pre-migration dump, which the spec already requires.

## Required before Founder approval
None beyond accepting R-1 and R-2 as Build Brief conditions.
