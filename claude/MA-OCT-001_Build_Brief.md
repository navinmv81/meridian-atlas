# Build Brief: MA-OCT-001, Ops Backend Foundation

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Engineering Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Architect (close-out). Operations Lead signs release readiness.
APPROVED BY:  Founder — spec approved 2026-09-26 (Q1 = A, Q2 = accept, Q3 = no)
PACKET:       MA-OCT-001 — Ops backend foundation
GATE:         Build 1–7 Oct → pilot observation 7–9 Oct → close-out → Architect review → Founder
```

## Governing documents (verify hashes first; stop if any differs)
| File | SHA-256 |
|---|---|
| `claude/MA-OCT-001_Spec.md` | `d69e0ade3cb320a409c44df6c1d18dbc453a8c98ce9f7d94e29c20137fa9b3a5` |
| `claude/MA-OCT-001_Spec_Review.md` | `8573326fda863a0502e0b8973edd2febb8ca7cee962c66caf43237eeed8f5531` |

Build exactly as in the spec: §5 schema, §6 auth, §7 contract, §8 budget and kill switches, §11 boundaries, §12 housekeeping, and §13 requirements, acceptance criteria, test plan and rollback. **The binding amendments below override the spec where they differ.**

## Binding amendments (Architect review R-1 and R-2, plus Founder decisions)

**A1. Contract v1 carries MA-OCT-006 §8.2, and goes into the schema before the migration runs.**
- **`ops_job_run`:** replace `items_processed` with `items_attempted INTEGER NULL` and `items_progressed INTEGER NULL`. Rule: an emitter that can't tell the two apart sends only `items_attempted` and leaves `items_progressed` NULL. It never copies the value across.
- **Payload:** `items_attempted` and `items_progressed` replace `items_processed`.
- **`detail.metrics`:** a flat object of integer counters, at most 16 keys, each key at most 32 characters, inside the existing 2 KB `detail` cap. The server validates it and drops any value that isn't an integer. The GLEIF key set to document is `selected, attempted, progressed, failed, deferred, external_calls, ext_2xx, ext_404, ext_4xx, ext_429, ext_5xx`.
- **`skipped` reasons:** when `event='skipped'`, `detail.reason` must be one of `hold, pause, budget, auth, out_of_window, empty_input` (enforced by the Worker). Other events keep free text.
- **Per-phase job IDs:** multi-phase Workers register one `job_id` per phase, for example `cf.meridian-entities-enrich.phase1` and `cf.meridian-entities-enrich.phase23`. Document this convention in the migration file header. No new column is needed.
- **Pilot mapping (boost runner):**
  - Pre-flight skip on headroom → `skipped` with `reason=budget`.
  - Wrangler auth error (F6) → end-only `failed`, `error.class='wrangler_auth_10000'`.
  - After `/run`: `success` or `partial`, with `items_attempted` and `items_progressed` taken from the Worker's response fields where it provides them, otherwise `null`.
- **AC6 and AC9 are extended:** they must show one event with `items_progressed = 0` and `items_attempted > 0` recorded correctly, if it happens naturally during the pilot. That is F4's signature. If it doesn't occur, test it with a contract test.

**A2. Git coordination (Addendum rules 6–7).** MA-OCT-006 runs on the same branch from 1 to 12 Oct.
- Stage **by explicit path only**. Never use `git add -A` or `git add .`.
- Before **every** commit, run `git fetch` and `git pull --ff-only`. If that fails, **stop and report**. Don't merge, rebase or force anything.
- The first commit includes these pending Main Lane governance docs (rule 7), each only if its hash matches:
  - `claude/MA-OCT-001_Spec.md`, `claude/MA-OCT-001_Spec_Review.md`, `claude/MA-OCT-001_Build_Brief.md`;
  - `claude/MA-OCT-006_Spec_Brief.md`, `claude/MA-OCT-006_Spec.md`, `claude/MA-OCT-006_Spec_Review.md`, `claude/MA-OCT-006_Build_Brief.md`;
  - `claude/October_Decisions_Log.md`.

  Get the current hash list from the Main Lane before committing, because the Decisions Log changes daily. If MA-OCT-006 has already committed a file, skip it.

**A3. Founder decisions.**
- **Q1 = (A):** the pilot emitter is the local `entities-enrich-boost-run.mjs`. **Precondition:** the Data-Identity Lead acknowledges the script change in writing, as one line in the close-out quoting the approval source. The Main Lane will relay it.
- **Q2 = accept:** the 4 legacy anonymous POST routes are closed. The public page's Sprint Board and Release Ledger buttons stop working until 005.
- **Q3 = no:** the bootstrap cron is **not** retired. 001 is unaffected (no cron). Record in the close-out that 002's alerting sweep will use fallback (a) from spec §9: reviving the local `health-check` LaunchAgent as the caller.

**A4. D1 board row.** The §12 housekeeping closes the August `MA-OCT-001` row, as specified. **Do not** create a board row for the October packet in 001. That happens at the next board sync, under the ID `MA-OCT-001-OPS`.

## Founder steps during the build (the lane asks for these at the right moment)
1. **Day 1 (about 15 minutes):** create the Cloudflare Access app "meridian-ops admin" on `meridian-ops.navinmv1981.workers.dev/api/ops/admin`, with the same allow list as the 015b `/exceptions` app. Share the **AUD tag and team domain only**; they are identifiers, not secrets.
2. **Never paste keys into chat.** The lane generates `OPS_INGEST_KEYS` and sets it with `wrangler secret put`. The local key file `App/Corporate Atlas/.env.ops-ingest` must be gitignored, and the lane verifies that with `git check-ignore`.

## Preflight (stop on any failure)
1. `pwd` = baseline root. Branch = `October-2026`. `ls .git/*.lock` returns nothing.
2. Both hashes above match.
3. `wrangler deployments status --name meridian-ops` shows `589ae24c` (record it for rollback).
4. `sqlite_master` has no `ops_%` tables. Record the `sprintboarditems` DDL (spec §12).
5. D1 budget snapshot (`/api/ops/cf/d1-today`).
6. Not a Sunday, and not Monday before 08:00 UTC. That keeps clear of holdings and the seed job.

## Budget and safety
- The build uses **≤ 500 D1 row-writes** and **≤ 50k reads** in total (AC14).
- Every new query gets `EXPLAIN QUERY PLAN` before it ships. Any SCAN not declared in spec §8.2 means stop.
- No cron, no `scheduled()` handler, no service binding, no new Worker.
- The only production code touched is `App/Ops/src/ops-api.js`, `App/Ops/wrangler-ops.toml`, `App/Ops/migrations/002-ops-control-plane.sql` (new), and the pilot script `App/Corporate Atlas/entities-enrich-boost-run.mjs`. Optionally, `App/Ops/tests/ingest-contract.mjs` (P1). **No front-end files.**

## Report-backs to the Main Lane
1. **After local tests (step 2 of the spec's test plan, §13.3):** AC6, AC11 and the A1 schema diff.
2. **After remote deploy (step 4):** AC1–AC5, AC7, AC15, the Worker version ID, and a link to the Release Ledger entry text.
3. **Close-out, about 9 Oct:** AC1–AC16 plus A1, the evidence, the commit SHAs and the rollback record. The Architect review follows.
