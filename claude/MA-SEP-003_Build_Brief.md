# Build Brief

## Ticket
- ID: MA-SEP-003
- Title: ESMA FIRDS European fund data — recurring local job (`firds-local-seed.mjs` + control scripts)
- Stage: ENG_IMPLEMENT — **architecture revised a second time, 2026-08-21 (Founder-approved). Do the things in "2026-08-21 update v2" below.**

## 2026-08-21 update v2 — read this first, supersedes both prior revisions below

A third local Claude Code session ran the Phase 2 diagnostic exactly as instructed ("get real numbers before building the delta Worker") and found the daily-delta premise was backwards: one part of one day's `DLTINS` file runs ~452–460 MiB uncompressed — over 5x the entire weekly `FULINS_C` file that already broke the chunked-Worker design — for ~39–60 relevant CFI-C records out of 500,000. It correctly stopped and reported this instead of building anything. Full numbers: `claude/MA-SEP-003_Escalation_Delta_File_Size.md`.

**Founder decided, on hearing this, to abandon the daily-delta approach and instead run the weekly `FULINS_C` file repeatedly as a recurring local job** — full design: `claude/MA-SEP-003_Change_Request_Local_Weekly_Job.md`. This is the final architecture. Two things to build, in order:

1. **Add a control surface to the existing `firds-local-seed.mjs` script and wire it to a weekly schedule.** Four scripts under `App/Corporate Atlas/scripts/`:
   - `firds-seed-install.sh` — writes and loads a macOS LaunchAgent (`~/Library/LaunchAgents/com.meridianatlas.firds-weekly-seed.plist`) that fires the seed script weekly, comfortably after ESMA's ~09:00 CET Sunday publish. **Confirm the machine's actual timezone (`date`) before picking the local fire time — don't assume.**
   - `firds-seed-uninstall.sh` — the kill switch. Unloads the LaunchAgent and deletes the `.plist`. After this, nothing fires again until `install` is re-run.
   - `firds-seed-pause.sh` / `firds-seed-resume.sh` — creates/removes a flag file (`App/Corporate Atlas/.firds-seed-paused`). Update `firds-local-seed.mjs` to check for this file as the very first thing it does and exit immediately (logging "paused, skipping") if present — before any network call or D1 write.
   - `firds-seed-status.sh` — reports whether the LaunchAgent is loaded, whether the pause flag is set, and the last run's timestamp/outcome from a log file. Update `firds-local-seed.mjs` to append one line to `App/Corporate Atlas/logs/firds-seed.log` on every run (timestamp, outcome, row-count deltas).
   - **Test all four, actually, before calling this done:** install it, let (or force) one real run fire, pause it and confirm the next scheduled/forced fire is a true no-op (check the log — no network calls, no writes), resume it, then uninstall and reinstall cleanly. Report what you observed at each step, not just that the scripts exist.
2. **Retire the `meridian-firds` Worker deployment.** It's served its purpose (proved the chunked approach viable-then-not, at real scale, with real bugs found along the way) but has no role under this architecture. Undeploy it and remove the now-dead `FIRDS_PROGRESS` KV namespace. If you'd rather leave it deployed-but-permanently-unused for some reason, flag that back rather than deciding silently either way.

Cron for `entities-enrich` (the still-open, now fully separate prerequisite) is **not** touched by any of this — MA-SEP-003 uses no Cloudflare Cron Trigger at all under this architecture, so it no longer needs that resolved. Leave `MA-SEP-003_Change_Request_Cron_Consolidation.md` exactly as-is.

Everything below this point (original diagnostic numbers, earlier approved scope, architecture constraints) is background — the delta-Worker and chunked-Worker designs it describes are both superseded by the above.

## Where to open this — working directory

**Open Claude Code (in the Claude desktop app) directly on this folder:**

```
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/
```

**Confirmed correct** by the first local Claude Code session (2026-08-19): `pwd` matches, `git branch --show-current` → `august-sprint-clean-v11`, `git remote -v` → `navinmv81/meridian-atlas`. That session's own default working directory was a *different*, sibling folder (`June Refresh/Corporate Atlas`) — **explicitly `cd` into the path above**, don't rely on whatever directory Claude Code opens into by default.

Within this repo, Entities-domain Worker source lives at `App/Corporate Atlas/` — this is where `entities-seed.js`, `entities-enrich.js`, `entities-api.js`, `entities-figi.js`, `entities-delta.js`, and their `wrangler-*.toml` configs already live. The new `meridian-firds` Worker source and its `wrangler-firds.toml` belong here too.

**On running commands — you don't need a separate Terminal window.** Claude Code runs `git`/`wrangler`/`npm` commands itself via its own tool, the same way this Cowork session runs its own shell commands. You approve what it wants to run; you don't type into Terminal.app yourself.

## Diagnostic step — COMPLETE, real numbers (2026-08-19)

Downloaded and MD5-verified `FULINS_C_20260815_01of01.zip` from `firds.esma.europa.eu` (checksum matched ESMA's own Solr-listed value):

- Compressed: 3,648,703 bytes (~3.65 MB). **Uncompressed: 90,818,287 bytes (~86.6 MiB).**
- **150,558 total `<RefData>` records, but only 18,353 unique ISINs** — each instrument repeats once per trading venue it's listed on. Dedupe on ISIN, not record count.
- **CFI category "C" confirmed at record level:** 100% of records carry a `ClssfctnTp` starting with `C` (e.g. `CBCIXS`, `CBMGXS`, `CBOIXS`).
- **Single-invocation parsing is not viable.** ~86.6MB uncompressed sits close to the Workers 128MB isolate memory ceiling before parsed structures/buffering are added, and at ~7–10 rows/`db.batch()` call, upserting 18,353 unique ISINs is ~1,800–2,600 separate batch calls — this will not complete in one invocation regardless of CPU budget.

**Conclusion, now locked into scope:** `meridian-firds` must be built as a **chunked/resumable Worker from v1**, mirroring `edgar_bootstrap_progress`'s resumable-offset pattern (persist a progress marker, process a bounded chunk per invocation — whether that's per-invocation on-request calls you trigger manually during build/testing, or eventually cron-driven once the cron question below is resolved — resume from the saved offset next time). This is no longer an open question — design it in from the start, don't treat it as a fallback.

## Old "New prerequisite" section — no longer applicable to this packet (kept for context only)

**2026-08-21 v2 note: this entire section is now moot for MA-SEP-003.** Under the final local-job architecture, this packet uses no Cloudflare Cron Trigger at all — nothing here blocks anything in the Build Brief above. It's kept below only because the `entities-enrich` findings themselves are real and may still matter for that Worker's own sake, entirely independent of FIRDS now. Do not treat anything below this line as work this packet still needs.

Two things must be confirmed **before** any cron change to `entities-enrich` (unrelated to FIRDS):

1. **Confirm the account's actual Cloudflare Workers plan (Free vs Paid).** This wasn't verifiable from the repo alone. It matters materially: Free plan caps subrequests at 50/invocation and Cron Trigger CPU time at 10ms; Paid allows up to 10,000 subrequests and 30 seconds of CPU time for sub-hourly crons. Check the Cloudflare dashboard billing/plan page, or `wrangler` account info if it surfaces this.
2. **Pull real subrequest counts for `entities-enrich`'s last several live invocations** (Cloudflare Worker analytics, or `meridian-ops`'s existing live-metrics route if it covers per-Worker subrequest data). This is because Phase 2 (`runPhase2`, up to 45 GLEIF calls) and Phase 3 (`runPhase3`, up to 90 GLEIF calls at up to 2 per entity) **already run together in a single invocation today** (the `mins >= 50` branch) — a theoretical combined ceiling of ~135 subrequests, well over the Free-plan 50/invocation cap. If the account is on Free plan and any recent invocation has approached those batch ceilings, **today's production GLEIF enrichment may already be silently truncating mid-batch**, independent of anything MA-SEP-003 does. This is bigger than this packet — flag it to Tech Ops/Founder regardless of what happens with the cron consolidation.

**Decision gate:** if Free plan and real observed volumes are safely under 50 subrequests/invocation with real margin, proceed to the corrected cron-consolidation mechanism in the revised Change Request. If volumes are already near/over 50, or the plan tier can't be confirmed, **stop and escalate to Founder/Architect** rather than guessing or reducing batch sizes unilaterally.

The full corrected mechanism, impact analysis, and rollback plan are in `claude/MA-SEP-003_Change_Request_Cron_Consolidation.md` — read that in full before touching `entities-enrich.js`. Do not re-attempt the original "just delete the 06:50 trigger" approach; it's been withdrawn.

## Approved scope
- **New table** `firds_instrument_reference` — **Entities domain**, Core classification (fetched from an external authoritative source, same logic as `entity_master`). Already deployed, schema unchanged by either 2026-08-21 revision. Exact `CREATE TABLE` statement, columns, and index are in `claude/MA-SEP-003_Spec.md` under "Proposed Schema Change." Do not deviate from the column set without flagging back to the Founder first.
- **Recurring local job**: `firds-local-seed.mjs` (already built and tested), run weekly via a macOS LaunchAgent, with a full control surface (install / kill switch / pause+resume / status — see "2026-08-21 update v2" above and `MA-SEP-003_Spec.md` Requirement 6 for exact acceptance criteria). No Cloudflare Worker, no Cloudflare Cron Trigger.
- **Retirement of the `meridian-firds` Worker deployment** and its `FIRDS_PROGRESS` KV namespace — no longer needed under this architecture.
- **Linkage into the existing graph — reuse only, no new resolver:**
  - New ISINs with a resolvable LEI → `entity_isin_map` (ISIN → entity_id), exactly as the existing bridge works today.
  - Unresolvable LEIs → queued into `entity_enrichment_queue`, same GLEIF-driven path already used by `meridian-entities-seed`/`meridian-entities-enrich`. Do not build a parallel resolver.
  - New instruments → `instrument_master`, keyed by `instrument_key` derived from ISIN (ISIN-fallback derivation already exists — same logic used for non-CUSIP securities elsewhere in the codebase, e.g. the 13F CUSIP-first/ISIN-fallback pattern).
- Done-condition (per Meridian-Sept-Scope.md): EU fund/ETF instruments identifiable and classified in the entity/instrument graph, kept current by a weekly local job the Founder can pause or stop at will.

## Architecture constraints
- This is an **Entities-domain** table and Worker (owned by Entities Product Lead per project instructions) — same domain as `entity_master`, `entity_isin_map`, `instrument_master`. Do not touch any ETF-domain table (`etf_master`/`etfmaster`, `fund_holdings_monthly`/`fundholdingsmonthly`, `fund_snapshot_monthly`, `universe_changes_monthly`, `holdings_pipeline_state`, `etf_aliases`, `edgar_bootstrap*`) — read or write.
- **Confirm live physical table/column names before writing any query.** MA-SEP-001's Build Brief flagged a real naming ambiguity (`entitymaster` vs `entity_master`) — check the live schema first, don't assume either convention.
- D1 writes: always `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING`, batched via `db.batch()` — never loop individual inserts. Batch size should respect the D1 REST 100-parameter ceiling learned during the 13F build (≈7–10 rows per call depending on final column count) unless you've tested a higher safe number first.
- The local seed script runs under Node (not the Worker's Web-API-only constraint — that constraint applied to the now-retired `meridian-firds` Worker, not this local script). D1 writes from the local script go via `wrangler d1 execute` or the D1 HTTP API.
- No Cloudflare Cron Trigger for this packet at all — the weekly schedule lives entirely in the local LaunchAgent.
- LOCAL_MASTER is `Meridian Atlas Clean (v11)` (branch `august-sprint-clean-v11`) per MA-SEP-000. Backend-only packet — no frontend/`App/` UI changes in scope (see UX constraints below).
- **This packet must run from local Claude Code, not a Cowork cloud session.** Confirmed twice now: `firds.esma.europa.eu` returned HTTP 403 to a direct request from the Cowork sandbox, though the local session downloaded the same file successfully.

## UX constraints
- None in this packet's scope. Backend data-layer packet only. Any future UI surfacing (entity detail page, MA-SEP-004's hierarchy view) should render a "FIRDS directory-tier, as of {publication_date}" label wherever this data appears — do not let it read as N-PORT-equivalent holdings depth.

## Touched assets
- New table: `firds_instrument_reference` (Entities domain) — already deployed, unchanged
- Write (new rows only, `INSERT OR IGNORE`): `entity_isin_map`, `instrument_master`, `entity_enrichment_queue`
- Read-only: `entity_master` (LEI lookups)
- New local script + control scripts: `firds-local-seed.mjs` (already exists, gains a pause-flag check), `firds-seed-install.sh`, `firds-seed-uninstall.sh`, `firds-seed-pause.sh`, `firds-seed-resume.sh`, `firds-seed-status.sh` (all new, under `App/Corporate Atlas/scripts/`)
- Retired: `meridian-firds` Worker deployment, `FIRDS_PROGRESS` KV namespace
- **Not touched:** `meridian-entities-enrich` — the earlier prerequisite section is now unrelated to this packet, see above.

## Do not do
- No scope expansion — do not start MA-SEP-004/005/006/007 work even if it feels adjacent.
- No ETF-domain table reads or writes, under any circumstance.
- No position-level EU fund holdings ingestion. FIRDS is reference data only; explicitly out of scope. If this comes up mid-session, stop and flag it — do not fold it in.
- Do not build a daily-delta ingestion path of any kind — this was tried, diagnosed, and explicitly rejected (see `MA-SEP-003_Escalation_Delta_File_Size.md`). If the idea resurfaces, point back to that doc rather than re-litigating it.
- Do not touch `entities-enrich.js` or any Cloudflare cron config — that's fully decoupled from this packet now.
- No schema changes beyond the single `firds_instrument_reference` table as specced — flag any deviation to the Founder before implementing.
- Do not skip actually exercising the four control scripts (install/kill-switch/pause-resume/status) — writing them isn't enough, they need to be run and observed working, per Requirement 6's acceptance criteria.

## Required outputs
- Touched files (local seed script + its pause-check addition, all four new control scripts, LaunchAgent `.plist`)
- Final row counts for `firds_instrument_reference`, `entity_isin_map`, `instrument_master`, `entity_enrichment_queue` (before/after, real deltas — not self-reported write counts, per the `meta.changes` lesson from the earlier Worker build)
- Confirmation each control script was actually run and what was observed (install → real fire → pause → confirmed no-op → resume → uninstall → reinstall)
- Confirmation `meridian-firds` Worker and `FIRDS_PROGRESS` KV namespace were retired (or, if left in place, why)
- Query/index implications: confirm no full scan introduced (EXPLAIN QUERY PLAN)
- Tests performed: `/validate-data` output
- Release implications: none for Cloudflare (no Worker/cron changes) — note the local LaunchAgent's exact schedule and how to verify it's active
- Risks / follow-ups: the `entities-enrich` subrequest-ceiling finding is still real and still open, entirely separate from this packet now — worth someone picking up on its own merits eventually

---
*Drafted 2026-08-17, revised 2026-08-19, 2026-08-21 v1, and 2026-08-21 v2 in the Entities Product Lead / Control lane (Cowork session), per Sept Operating Kit's session structure, incorporating three local Claude Code sessions' findings. Full spec: `claude/MA-SEP-003_Spec.md`. Active change request: `claude/MA-SEP-003_Change_Request_Local_Weekly_Job.md`. Superseded change request: `claude/MA-SEP-003_Change_Request_Delta_Architecture.md`. Unrelated, still-open item: `claude/MA-SEP-003_Change_Request_Cron_Consolidation.md`. Escalations (both resolved by the above): `claude/MA-SEP-003_Escalation_CPU_Wall.md`, `claude/MA-SEP-003_Escalation_Delta_File_Size.md`.*
