## Change Request: Local LaunchAgent Control Surface to Raise `entities-enrich` Phase 3 Throughput (bundled with `/run` auth fix)

**Requester:** Founder | **Date:** 2026-08-26 | **Priority:** Medium
**Status:** APPROVED (2026-08-26) — executed 2026-08-27, low-cadence (2/day) test live and verified; full 4-6/day target held pending GLEIF-monitoring review (see Sprint Board, MA-SEP-010 row)
**Packet:** MA-SEP-010 | **Lane:** Data/Identity + Tech Ops

### Description

`entities-enrich`'s Phase 3 (GLEIF parent-chain enrichment) currently runs once/day via its existing Cloudflare Cron Trigger (`50 6 * * *`), processing a checkpoint-governed ~42 entities/invocation. At that cadence, clearing the combined 16,421-entity Entities-domain backlog (10,156 entities already in the eligible pool + the 6,265 legacy rows from Known Issue 22.10) takes an estimated ~13-15 months.

This change adds a local macOS LaunchAgent — mirroring MA-SEP-003's `firds-local-seed` control-surface pattern exactly — that invokes `entities-enrich`'s existing `/run` endpoint additional times per day, entirely outside Cloudflare's Cron Trigger accounting (the account is at its Free-plan cap of 5/5, confirmed unchanged as of 2026-08-26). Target cadence: **4-6 total invocations/day** (existing cron + 3-5 additional LaunchAgent-triggered calls), revising the timeline to an estimated **~2.5-3.7 months**.

Bundled into the same change: `/run` currently has **zero authentication** (Known Issue 22.13, found during this packet's investigation) — any client that knows the Worker's URL can trigger a live production enrichment run. Since the LaunchAgent needs to call `/run` regardless, this change adds a shared-secret header check to `/run` at the same time, closing that gap as part of the same deploy rather than as a separate fast-follow.

This is grounded against real, live-verified findings from MA-SEP-010's investigation (`wrangler deployments list` cross-check, live D1 queries against `meridian-etf`) — see the Sprint Board's MA-SEP-010 row for the full evidence trail. This document is drafted by the Control master-lane session, which has no live repo/Cloudflare/D1 access; the local Claude Code session that built and verified the investigation is the source of the real numbers cited here.

### Business Justification

The root-cause bug behind Known Issue 22.10 is already fixed (MA-SEP-009) — every entity Phase 3 touches now gets correct treatment. What remains is a backlog-clearing speed problem: at current cadence, the P0-adjacent "clickable Direct/Ultimate parent" feature (MA-SEP-004 Requirement 1) has a real, non-trivial chance of showing zero populated cases in production for well over a year. Raising throughput meaningfully shortens that to a few months, at a small, well-understood incremental cost, while closing an unrelated but real security gap (`/run`'s missing auth) in the same motion.

### Impact Analysis

| Area | Impact | Details |
|---|---|---|
| `meridian-entities-enrich` Worker | Medium | `/run` gains a shared-secret header check (new small code path); Phase 3 dispatch logic itself is unchanged (still gated by `getMinutes()` and `SUBREQUEST_CHECKPOINT=44`). No schema change. |
| Cloudflare Cron Triggers | None | This change does not add, remove, or modify any Cron Trigger — the account stays at 5/5. The additional invocations are HTTP-triggered from the local machine, not Cloudflare-scheduled. |
| D1 write budget | Low, on non-Sundays | Entities-enrich's real per-invocation footprint is ~70-115 writes; at 4-6 invocations/day that's roughly 280-690 writes/day typical case (rough worst-case ~2,000-3,000/day) — trivial against the shared 100,000/day cap on a normal day. |
| Known Issue 22.12 (Sunday collision) | Real, but bounded | Additional invocations landing on a Sunday compete for the same shrinking headroom `meridian-holdings` already consumes near its cap. Mitigated by: (a) the LaunchAgent's own pre-flight headroom check (see Requirements below) refusing to fire without confirmed real headroom, and (b) deliberately weighting the additional invocation schedule away from the Sunday 04:00-07:00 UTC window where practical. |
| Known Issue 22.14 (write-counter blind spot) | Unresolved by this change, monitored | `entities-enrich` still won't increment `writes_today_<date>` after this change — the guard remains blind to its own writes at whatever new frequency is chosen. This change does not fix 22.14; it is explicitly out of scope here (see Do-Not-Do) but its risk grows with invocation frequency, so 4-6/day (not 12/day) was chosen partly to keep this blind spot's real-world impact small. |
| GLEIF external API | Unknown, monitored | No documented or tested rate-limit behavior exists for GLEIF's public API at this call frequency. 4-6 invocations/day was chosen specifically to stay well clear of the untested territory that 12/day (hourly) would enter. The build should log GLEIF response codes/latency so any rate-limiting shows up immediately, not silently. |
| Local machine dependency | Medium (same as MA-SEP-003 precedent) | Adds a second local LaunchAgent (alongside `firds-local-seed`, `financialfact-backfill`, `health-check`) that must be running for the additional throughput to materialize. If the Founder's machine is off/asleep at a scheduled fire time, that invocation is simply skipped — self-correcting, not a hard failure, same as the existing local jobs' behavior. |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A LaunchAgent-triggered call lands outside the `:50-:59` per-hour window and silently no-ops for Phase 3 (only running the cheap Phase 1 ISIN pass) | High if not deliberately scheduled | Medium — wasted trigger, not data risk | Explicit requirement: every additional invocation's fire time must be scheduled to land inside `:50-:59` of its hour, verified in testing before relying on it. |
| An additional invocation fires on a day/time where real D1 headroom is actually low (e.g., a Sunday during `meridian-holdings`' run) and gets refused, or worse, partially succeeds into a tight budget | Medium | Medium | Mandatory pre-flight direct query of `writes_today_<date>` before every fire (not trusting the 429 alone) — same discipline MA-SEP-009 used before every manual `/run` trigger. Schedule to avoid the Sunday 04:00-07:00 UTC window by default. |
| GLEIF begins rate-limiting or blocking at the new call frequency | Low-Medium, genuinely unknown | Medium — could degrade or break enrichment entirely | Start at the low end of the 4-6/day range, monitor GLEIF response codes/latency for the first 1-2 weeks, and hold before any further increase. Do not jump to hourly without separately revisiting this. |
| The shared-secret header check is misconfigured (e.g., secret embedded in a committed file) and either breaks legitimate calls or leaks the secret | Low if implemented carefully | Medium | Store the secret via `wrangler secret put` (Cloudflare secrets store), not in `wrangler-entities-enrich.toml` or any committed file; the LaunchAgent's local script reads it from a local, non-repo config file, matching how existing local jobs handle Cloudflare API tokens post-MA-AUG-004's credential-leak remediation. |
| Phase 3's SELECT has no claiming/locking step, and two invocations' `ctx.waitUntil` async work overlaps | Low at 4-6/day (invocations are hours apart, real runs complete in well under a minute) | Low | No code change needed at this cadence; flagged in the Change Request for the record. Revisit if cadence is ever pushed toward sub-hourly in a future change. |

### Implementation Plan

| Step | Owner | Timeline | Dependencies |
|---|---|---|---|
| Add a shared-secret header check to `/run` in `entities-enrich.js`; store the secret via `wrangler secret put`, not in any committed file | Local Claude Code | First | Founder approval of this Change Request |
| Redeploy `meridian-entities-enrich`; confirm the existing cron-triggered `/run` call (from `scheduled()`, if it also invokes the same handler) still works correctly with the new auth requirement, or is exempted appropriately | Local Claude Code | After auth added | Auth code merged |
| Build the local LaunchAgent control surface (install / pause / resume / status / uninstall scripts), mirroring `firds-local-seed`'s existing scripts exactly where the pattern transfers | Local Claude Code | Parallel to above | — |
| Schedule 3-5 additional daily fire times, each verified to land inside `:50-:59` of its hour, weighted away from the Sunday 04:00-07:00 UTC window where practical | Local Claude Code | Same step | Control surface built |
| Implement the mandatory pre-flight headroom check (direct `writes_today_<date>` query) inside the LaunchAgent's invocation script, refusing to call `/run` if real headroom is insufficient — do not rely on the 429 alone | Local Claude Code | Same step | — |
| Test end-to-end at low cadence first (e.g., 2 additional/day) before committing to the full 4-6 target; monitor GLEIF response codes/latency for 1-2 weeks | Local Claude Code | First week live | Control surface installed |
| Update Sprint Board, Release Ledger, and Known Issues 22.13 (closed) with real deploy/version detail and real observed throughput | Local Claude Code | Close of packet | Verified working |

### Do Not Do

- Do not fix Known Issue 22.14 (the write-counter blind spot) as part of this change — explicitly out of scope, tracked separately, revisit if cadence increases further.
- Do not push straight to hourly (12/day) cadence — start at 4-6/day per the Founder's decision, given the untested GLEIF rate-limit risk.
- Do not store the new shared secret in any committed file, `.toml`, or script under version control.
- Do not add a new Cloudflare Cron Trigger — the account has zero headroom (5/5); this change is local-job-only by design.
- Do not touch Phase 3's dispatch logic, checkpoint value, or `BATCH` constant — those were already tuned and live-verified in MA-SEP-009; this packet only adds invocation frequency via the local job.

### Rollback Plan

- **Trigger:** GLEIF begins rate-limiting/erroring at the new frequency, the pre-flight headroom check proves insufficient in practice (a real budget collision occurs), or the auth change breaks the existing cron-triggered invocation.
- **Steps:** the LaunchAgent has its own pause/uninstall control (same as `firds-local-seed`) — pausing or uninstalling it immediately returns `entities-enrich` to its original once/day Cloudflare-cron-only cadence, with zero code rollback needed for the throughput change itself. If the auth header check causes a problem, it can be reverted independently via a redeploy of `entities-enrich.js` without touching the LaunchAgent.
- **Verification:** closing Sprint Board/Release Ledger entries state the real observed cadence achieved, any GLEIF rate-limit signals seen, and confirm the existing cron-triggered invocation still works correctly post-auth-change.

### Approvals Required

| Approver | Role | Status |
|---|---|---|
| Founder | Product owner | **Approved 2026-08-26 (in conversation with the Control session)** |

---
*Drafted 2026-08-26 in the Control master-lane session, grounded against MA-SEP-010's live-verified investigation findings (Sprint Board row, this project) rather than assumed. Handed to a dedicated local Claude Code session for execution once approved, per the same pattern as MA-SEP-001/003/008.*
