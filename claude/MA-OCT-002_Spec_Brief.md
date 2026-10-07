# Spec Brief: MA-OCT-002, Fleet, Schedules, Health and Drift (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Operations Lead (packet owner; writes the spec) — local Claude Code, Clean (v11)
REVIEWED BY:  Architect + ETF Product Lead (Wed 7 Oct). Data-Identity Lead consulted on Entities-Worker items.
APPROVED BY:  Founder
PACKET:       MA-OCT-002 — Fleet, schedules, health and drift
GATE:         Spec by Tue 6 Oct → reviews Wed 7 Oct → Founder spec approval Thu 8 Oct → build from Fri 9 Oct (Wave 2: 002 → 003 → 004)

ROLE:           Operations Lead
LANE:           Operations (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-002_Spec.md (new, the only file this lane writes)
```

## Why
MA-OCT-001 built the Ops control plane (5 `ops_*` tables, Access-gated admin, ingest contract v1, kill switches; `meridian-ops` `56c87c9a`, commit `da38cf5`) and proved one emitter (the boost pilot). The fleet is still mostly invisible: the registry is not populated, schedules are compared by hand, nothing alerts on silence (F5: two LaunchAgents dead since 22–23 Aug with nobody told), and two Workers expose unauthenticated run routes. 002 turns the control plane into a working fleet view with drift and lateness, and puts a clock behind alerting.

## Lane rules (hard)
1. **Doc-only.** No code edits, no deploys, no secrets, no cron or LaunchAgent changes, no Cloudflare API calls that need the new token.
2. **D1:** read-only and minimal. At most 5,000 reads in total, every query with `EXPLAIN QUERY PLAN` first, no `SCAN` on a large table. 0 writes.
3. **No git writes.** Read git only with `git --no-optional-locks`; check `ls .git/*.lock` first (Addendum rule 6). The approved spec is committed later by the next executing lane (rule 7).
4. Write **only** `claude/MA-OCT-002_Spec.md`. Report any in-lane ruling to the Main Lane the same day.
5. Use `/write-spec`.

## Inputs (read first)
- `claude/meridian-october-revised-scope-v2.md` (Operations Control Plane: job inventory and Ops UI expectations) and Addendum §4–§5.
- `claude/MA-OCT-000_Job_Manifest.md` and `claude/MA-OCT-000_job_manifest.json` (47 jobs; intended vs effective schedules; findings F1–F10, N1, N3).
- `claude/MA-OCT-001_Spec.md` (§5 schema, §7 contract incl. Build Brief A1, **§9 cron-slot plan, §10 Worker size**), `claude/MA-OCT-001_Spec_Review.md`, `claude/MA-OCT-001_Build_Brief.md`, and the 001 close-out when it lands (pilot evidence, the undelivered 2 Oct heartbeat, the `node:https` deviation).
- Source: `App/Ops/` (`ops-api.js`, migration `002-ops-control-plane.sql`), every `wrangler*.toml`, the LaunchAgent plists and scripts (boost, health-check, financialfact-backfill, firds-weekly-seed), `holdings-pipeline.js`, `entities-seed.js`, `entities-enrich.js`, `entities-delta.js`, `bootstrap.js`.
- `Sprint_Board.md` (Project) Known Issues 22.5, 22.14, 22.30–22.33, 22.35, 22.36, 22.39, and the MA-OCT-002 row items (a)–(f).

## Scope to specify
1. **Registry population.** Load the 47-job manifest into `ops_job_registry` (owner, domain, mode, intended schedule, source path, kill switch, write-guard profile), using the per-phase `job_id` convention (e.g. `cf.meridian-entities-enrich.phase1` / `.phase23`). Define how the registry stays current when a toml or plist changes.
2. **Intended vs effective schedules and drift.** Intended = source control (tomls, plists). Effective = Cloudflare triggers read with the **Workers-Read-scoped token** (Architect ruling 1; Founder creates it before ~7 Oct). Define the drift rule and how `/api/ops/drift` (today returns an empty list) becomes real. Include the Cloudflare day-of-week trap (1 = Sunday; KI 22.1) as a drift test case.
3. **Lateness and lost runs.** Computed at read time from the registry schedule and `ops_job_run`. Define grace windows per job, "late", "missed" and "frozen", and **planned pauses** (item (e): 011 may pause the boost 17–23 Oct; a planned pause must not raise a miss).
4. **Alerting sweep (the clock).** Founder Q3 (26 Sep) = keep the bootstrap cron, so the sweep caller is the **revived local `health-check` LaunchAgent** (fallback (a) in 001 spec §9; KI 22.30). Define what it checks, where alerts land (`ops_exception` rows and one notification channel — propose it), de-duplication, and the honest limit: it only runs while the Mac is awake, so state what Ops can and cannot see. No new cron slot (5/5).
5. **Worker heartbeats.** Which cron Workers emit run events in 002 (holdings, seed, enrich phases, bootstrap) and how: service binding vs authenticated ingest; subrequest cost against the 50-per-invocation limit (enrich is already near it — MA-SEP-003 note); failure handling. Changes to `meridian-holdings` / `meridian-bootstrap` need the **ETF Product Lead**; to `entities-*` Workers the **Data-Identity Lead** is consulted.
6. **Undelivered local heartbeats (item (f)).** The 2 Oct 10:50 pilot failure event was not delivered. Specify whether terminal events get a retry or an on-disk spool replayed on the next run, keeping Data-Identity conditions (1)–(4) from 1 Oct intact (boost log untouched, pause first, exit code and `/run` timing unchanged, 2 s ceiling per attempt).
7. **Security gating.** KI 22.35 (`meridian-bootstrap` `/trigger` unauthenticated, N1) and KI 22.36 (`meridian-entities-delta` `/run` unauthenticated, N4): gate or remove, with the owners consulted.
8. **F6 / F7 / counters.** KI 22.31 (wrangler auth 10000 under launchd; boost failed 15 of 34 runs since 16 Sep), KI 22.32 (boost write guard blind) and KI 22.14 (enrich never increments `writes_today_<date>`). Propose the fix and its owner; enrich code changes are Entities-domain and need the Data-Identity Lead.
9. **ETF items from the MA-OCT-012 reviews:** (a) holdings-only Sunday write baseline (70,672) with a warning at ≥75k; (b) per-ETF write-cost tracking; (c) a holdings pass-cycle freshness metric (~12-week full pass; weeks since last `complete:`); (d) direct trigger listing via the new token.
10. **KI 22.39:** entity run state written into ETF-domain `holdings_pipeline_state`. Propose where it belongs (`ops_job_run` or Entities-domain state) and the migration path; no cross-domain writes.
11. **Worker size and the `meridian-control` split.** 001 left 1 route of headroom (001 spec §10). The Architect's direction is option 1 (governance routes to a new `meridian-control` Worker). Specify the split, the change request it needs, and the domain/write-owner decision for `sprintboarditems`, `releaseledger` and `operationalevents`.

**Out of scope:** the operator console (`ma-ops.js`, MA-OCT-005); exceptions and DQ workflows (003/004) beyond the `ops_exception` rows the sweep raises; any change to 011's runner; retiring the bootstrap cron (Founder Q3 = no).

## The spec must define
1. **Phasing.** Wave 2 has 002 → 003 → 004 in sequence to 21 Oct. Split 002 into **002a (must-have, build ≤ 4 days)** and **002b (can follow)**, and say which items unblock 003/004.
2. **D1 budget:** writes to build (registry load, migrations) and per day in steady state (heartbeat events per job per day, sweep writes), read cost of each fleet/drift/lateness query with `EXPLAIN` plans, and retention.
3. **Three-point check** (Team v3) for every new query and any recurring process; run-time gates (hold, budget, recovery) for the sweep.
4. **Change requests:** list each (e.g. `meridian-control` split, new routes, Worker heartbeat wiring, gating 22.35/22.36, LaunchAgent revival), with owner and reviewer.
5. **Freeze windows:** no change to Entities Workers or the boost runner during a GO'd 011 run (17–23 Oct), and none during the Sunday 04:00–07:00 UTC and Monday 04:00 UTC windows.
6. **Acceptance criteria, test plan, rollback** per phase, plus at most 3 Founder questions, each with a recommended answer.

## Report-backs to the Main Lane
1. **Day 1:** preflight (branch, no locks, files readable), outline, the 002a/002b split in draft, and any Founder question that blocks the spec.
2. **Tue 6 Oct:** `claude/MA-OCT-002_Spec.md` with its SHA-256. The Main Lane routes it to the Architect and the ETF Product Lead.
