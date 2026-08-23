## Change Request: Consolidate meridian-entities-enrich to 1 Cron Trigger/day (frees capacity for meridian-firds)

**Requester:** Entities Product Lead (Cowork session) | **Date:** 2026-08-17, revised 2026-08-19
**Status:** **REVISED — original mechanism was unsafe, do not execute as originally written. Approach corrected below; still needs one live confirmation before execution.**
**Packet:** MA-SEP-003 (prerequisite step) | **Lane:** Data/Identity

### ⚠️ Revision notice (2026-08-19)

The local Claude Code build session caught a real defect in the original version of this change request before any deploy happened — this is exactly the "flag first, deploy second" discipline this project asks for, working as intended. The original plan ("delete the `50 6 * * *` trigger, keep only `0 6 * * *`") would have **silently and permanently stopped Phase 2/3 (the actual GLEIF enrichment)** while Phase 1 kept logging success — because `entities-enrich.js`'s dispatcher routes on wall-clock `getMinutes()` at invocation time, not on which cron string fired. This is documented in the Worker's own file header and in `wrangler-entities-enrich.toml`'s comments — the original change request should have read those comments and didn't.

This revision also surfaces a **second, deeper risk** found by re-reading the actual source this session (see "New finding" below): Cloudflare's Free plan caps subrequests at **50 per invocation**, and Phase 2 + Phase 3 already run **combined in a single invocation today** (the `mins >= 50` branch), with a theoretical combined ceiling of up to ~135 subrequests (45 for Phase 2, up to 90 for Phase 3 at up to 2 GLEIF calls per entity). If the account is on Free plan and any recent invocation has approached those batch ceilings, **today's production Phase 2/3 run may already be at risk of silently truncating mid-batch** — a pre-existing risk, not something this change request introduces, but one this change request's diagnostic work surfaced and that needs answering before anything here proceeds.

### Description

`meridian-entities-enrich` currently runs on **2 Cron Triggers/day** (06:00 UTC → Phase 1 only; 06:50 UTC → Phase 2 then Phase 3), confirmed directly from the live `entities-enrich.js` and `wrangler-entities-enrich.toml` this session. This change's goal is unchanged — drop to **1 Cron Trigger/day** to free a slot for `meridian-firds` — but the *mechanism* is corrected:

**Original (unsafe) mechanism:** delete the `50 6 * * *` trigger, keep `0 6 * * *`. Rejected — see Revision notice.

**Corrected mechanism:** keep the `50 6 * * *` trigger (the one that already, today, successfully runs Phase 2 then Phase 3 back-to-back), remove the `0 6 * * *` trigger, and **add a call to `runPhase1(env)` at the start of the surviving invocation**, so the single daily invocation runs Phase 1 → Phase 2 → Phase 3 in that order, unconditionally, with the `getMinutes()` branch removed entirely. This preserves the exact same daily throughput as today (all three phases still run once/day) via one invocation instead of two — it does not "halve" anything, correcting an inaccurate claim in the original version of this document.

**Why this is subrequest-safe (probably) but needs one confirmation first:** Phase 1 issues **zero subrequests** (D1 reads/writes only) — adding it to the front of the existing Phase 2/3 invocation adds no new external calls, so it doesn't change today's existing subrequest profile. The open risk is entirely pre-existing: whether today's Phase 2/3 combination is already within the Free-plan 50-subrequest ceiling. **This must be checked (real Cloudflare Worker analytics for recent `entities-enrich` invocations, plus confirming the account's actual plan tier) before this change deploys** — not assumed clean because it "seems to be working."

Cloudflare Workers' Free plan caps **Cron Triggers at 5 per account** (confirmed against live Cloudflare documentation, 2026-08-17). The account is currently at exactly **5 of 5 active triggers**:

| Worker | Trigger(s) | Count |
|---|---|---|
| meridian-bootstrap | Every 4 hours | 1 |
| meridian-holdings | Weekly, Sunday 04:00 UTC | 1 |
| meridian-entities-enrich | Daily, 06:00 + 06:50 UTC | 2 |
| meridian-entities-seed | Weekly, Monday 04:00 UTC | 1 |
| **Total active** | | **5 / 5** — independently re-confirmed by the local Claude Code session, 2026-08-19, reading live `.toml` files directly |

(`meridian-entities-delta` exists but its trigger block is commented out — 0 active. All other Workers — `meridian-proxy`, `meridian-13f`, `meridian-filings`, `meridian-entities-api`, `meridian-entities-figi`, `meridian-ops` — are on-request only, no cron.)

### New finding this revision: subrequest ceiling (2026-08-19)

Cloudflare's platform limits (`https://developers.cloudflare.com/workers/platform/limits/`, checked this session) state:

| Plan | Subrequests / invocation | CPU time / Cron Trigger invocation |
|---|---|---|
| Free | 50 | 10 ms |
| Paid | 10,000 (up to 10M) | 30 sec (for <1hr interval crons) |

`entities-enrich.js`'s Phase 2 (`runPhase2`) issues up to 1 GLEIF call per entity, batch size 45 → up to 45 subrequests. Phase 3 (`runPhase3`) issues 1–2 GLEIF calls per entity (detail fetch, plus an optional parent-LEI detail fetch), batch size 45 → up to 90 subrequests. These two phases **already run together, today, in the `mins >= 50` branch** — meaning the existing production invocation already has a theoretical ceiling of ~135 subrequests, nearly 3x the Free-plan cap.

This is not a new risk this change request creates. It is a pre-existing fact about the currently-deployed Worker that this diagnostic work happened to surface. **If the account is on Free plan and any recent live invocation actually approached the 45/45 batch ceilings, GLEIF enrichment may already be silently truncating mid-batch on the affected days** — Phase 2/3's error handling catches per-entity `fetch` failures and marks them `failed` with a retry, so a subrequest-limit exception mid-loop likely surfaces as a batch of `failed` rows rather than a loud crash, which is exactly the kind of thing that stays invisible without checking. This is bigger than MA-SEP-003 and is flagged here for Tech Ops / Founder attention independent of this packet's own outcome.

**The 10ms Free-plan CPU-time-per-Cron-Trigger figure is also worth independent verification** — 10ms is a very tight budget for D1 driver overhead across 100+ rows (Phase 1) or JSON parsing across dozens of GLEIF responses (Phase 2/3), even though `fetch()` I/O wait itself doesn't count against CPU time. Whether this Worker's actual CPU usage per invocation is measured and within budget on the current plan hasn't been independently confirmed by any document in this project — flagged as an open item, not asserted as broken.

### Business Justification

`entities-enrich` drains `entity_enrichment_queue` (GLEIF-sourced entity enrichment) — a background, non-user-facing process with no freshness SLA. The corrected mechanism (merge Phase 1 into the surviving Phase 2/3 invocation) preserves identical daily throughput to today, so there is no queue-drain-rate trade-off to justify — the only real question is whether the combined invocation is safe within actual account limits, which is why this revision adds a confirmation step rather than proceeding straight to deploy.

### Impact Analysis

| Area | Impact | Details |
|---|---|---|
| `entity_enrichment_queue` drain rate | **None** (corrected from "Low–Medium" in the original version) | All three phases still run once/day each — this was a mischaracterization in the original change request, corrected this revision. |
| Live site / UI | None | `entities-enrich` has no direct UI surface. |
| `entity_master` freshness | None | Same daily cadence as today for all phases. |
| Subrequest budget per invocation | **Unknown until confirmed (see New Finding above)** | Combining Phase 1 into the existing Phase 2/3 invocation adds 0 new subrequests (Phase 1 is D1-only) — but the pre-existing Phase 2/3 combination's real-world subrequest count against the Free-plan 50 cap needs confirming before deploy. |
| D1 write budget | None materially | Same total daily write volume as today, consolidated into one invocation instead of two. |
| Cost | None | No plan change; stays on Workers Free — pending confirmation that Free plan's limits are actually sufficient for the combined invocation (see New Finding). |
| Cron Trigger capacity | High (positive) | Frees exactly 1 slot, from 5/5 to 4/5 active — enough for `meridian-firds`'s weekly cron, with 0 slots remaining after. |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Combined Phase 1+2+3 invocation exceeds the Free-plan 50-subrequest ceiling** | **Unknown — needs confirmation** | **High** — would cause partial/failed enrichment runs, likely silently (caught per-entity, logged as retries, easy to miss) | Before deploying: (1) confirm the account's actual Cloudflare plan tier; (2) pull real subrequest counts for `entities-enrich`'s last several live invocations via Cloudflare Worker analytics (or `meridian-ops`'s existing live-metrics route, if it surfaces per-Worker subrequest data) rather than relying on the theoretical 45/90 batch ceilings. If Free plan and real volumes are already near/over 50, this change cannot safely proceed as designed — batch sizes would need reducing first, independent of the cron-slot goal. |
| Enrichment queue backlog grows if the merged invocation fails partway through more often than the current split invocations do | Low–Medium (tied to the above) | Medium | Same `entity_enrichment_queue` monitoring convention already in place (Current State v12 §3.2/22.6) — check row counts and `status='failed'` counts after the first several live runs of the merged invocation. |
| Account is back at the 5-trigger cap immediately after `meridian-firds` is added — any future packet needing its own cron has zero headroom | Medium | Medium | Unchanged from original — documented so it isn't rediscovered as a surprise later. |

### Implementation Plan

| Step | Owner | Timeline | Dependencies |
|---|---|---|---|
| **Confirm Cloudflare account plan tier (Free vs Paid)** | Local Claude Code session (Cloudflare dashboard or `wrangler` account info) | Before any code change | None — do this first |
| **Pull real subrequest/error counts for `entities-enrich`'s last 5–10 live invocations** (Cloudflare Worker analytics, or `meridian-ops`'s existing metrics route if it covers this) | Local Claude Code session | Before any code change | Plan tier known |
| **Decision gate:** if Free plan and real volumes are safely under 50 subrequests/invocation with margin, proceed below. If volumes are already near/over 50, or plan tier can't be confirmed, **stop and escalate to Founder/Architect** — do not guess. | Entities Product Lead / Founder | Before any code change | Above two steps complete |
| Edit `entities-enrich.js`: remove the `getMinutes()`/`getHours()` branch in both `scheduled()` and `fetch()`; call `runPhase1(env)`, then `runPhase2(env)`, then `runPhase3(env)` unconditionally, in that order, each run | Local Claude Code session | After decision gate clears | Decision gate |
| Update `wrangler-entities-enrich.toml`: `crons = ["50 6 * * *"]` (single entry — **keep the 06:50 slot, not 06:00**, since that's the one whose invocation already runs Phase 2/3 successfully today) | Local Claude Code session | Same session | Code change above |
| Redeploy `meridian-entities-enrich`, confirm via live `.toml` and/or Cloudflare dashboard that exactly 1 trigger is active | Local Claude Code session | Same session | Config change |
| Manually invoke `/run` once and check `entity_enrichment_queue`/`entity_master` row-level results plus Worker logs for any subrequest-limit or CPU-limit errors, before trusting the cron to run unattended | Local Claude Code session | Same session | Redeploy complete |
| Enable `meridian-firds`'s weekly Cron Trigger only after all of the above is confirmed clean | Local Claude Code session | MA-SEP-003 build session, after three-point check | Cron slot confirmed free and safe |

### Communication Plan

Single-Founder project — no broader team notification needed. Recorded in Sprint Board's Decisions log and in this document. The subrequest-ceiling finding is significant enough to also flag as a standalone Tech Ops item, independent of whether MA-SEP-003 proceeds on its original timeline.

### Rollback Plan

- **Trigger:** If the merged invocation shows subrequest failures, CPU-limit errors, or `entity_enrichment_queue` backlog growth after deploy.
- **Steps:** Revert `wrangler-entities-enrich.toml` to `crons = ["0 6 * * *", "50 6 * * *"]` and revert `entities-enrich.js`'s dispatcher to the original `getMinutes()`-gated version (git revert of the single commit, not a manual re-write). Redeploy.
- **Verification:** Confirm 2 active triggers again via `.toml`/dashboard check. Note: if `meridian-firds`'s cron has been enabled by this point, the account will be back at 5/5 with no room for `entities-enrich`'s second trigger — rollback would require freeing a slot elsewhere (e.g. moving `meridian-firds` to on-request) rather than a pure revert.

### Approvals Required

| Approver | Role | Status |
|---|---|---|
| Founder | Product owner | **Original mechanism approved 2026-08-17; that mechanism is withdrawn. Revised mechanism above needs fresh Founder approval, contingent on the plan-tier/subrequest-volume confirmation gate in the Implementation Plan.** |
