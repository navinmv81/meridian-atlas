INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-010',
  'Local LaunchAgent boost for entities-enrich Phase 3 throughput (bundled /run auth fix, Known Issue 22.13)',
  'Entities',
  'data_identity',
  'ENG_IMPLEMENT',
  'Entities Product Lead + Tech Ops',
  'ACTIVE',
  NULL,
  'Low-cadence checkpoint (2 additional/day, 10:50+16:50 UTC) is installed, loaded, and real-verified end-to-end as of 2026-08-27 -- awaiting Founder review of this checkpoint before scaling FIRE_HOURS_UTC to the full 4-6/day target per Change Request step 5. Separately: GLEIF response monitoring for the first 1-2 weeks has no durable storage today (Worker logs only exist live via `wrangler tail`, no historical query, same limitation MA-SEP-009 hit) -- real per-call status/latency logging was added and proven working live, but someone needs to actually run `wrangler tail --config wrangler-entities-enrich.toml` during/after the 11:50 and 17:50 local fire windows over the next 1-2 weeks to catch any real rate-limiting; entities-enrich-boost.log only captures the /run call''s own HTTP outcome, not per-GLEIF-call detail. Flagging this as a real gap, not silently assuming it is covered.',
  NULL,
  'MA-SEP-010_Change_Request.md approved in conversation 2026-08-27 (Founder, this session) -- document itself still shows Status: DRAFT / Approvals: Pending, was not updated to reflect the approval; flagged, not silently corrected on the document''s behalf.

--- STEP 1 RESULT (2026-08-27): /run auth fix, closes Known Issue 22.13 ---
Shared secret generated (openssl rand -hex 32, 64 hex chars), stored via `wrangler secret put RUN_AUTH_SECRET --config wrangler-entities-enrich.toml` (piped from a local file, never typed/echoed as a CLI arg). Local copy lives at App/Corporate Atlas/.env.entities-enrich-run -- confirmed gitignored via `git check-ignore -v` against the root .gitignore''s `.env.*` rule before it was written, not after. Never committed to any tracked file or .toml -- wrangler-entities-enrich.toml only carries a comment noting the binding exists.

Code change (src/entities-enrich.js fetch() handler): shared-secret header check (`X-Enrich-Run-Secret`) added before the existing hold/budget checks, so an unauthenticated caller learns nothing about either. Fails closed if RUN_AUTH_SECRET is ever unset. scheduled() (the Cron Trigger path) is a structurally separate function with zero reference to request headers -- confirmed both by direct code read AND by real live evidence (see Step "cron unaffected" below), not assumed. Same deploy also added GLEIF response-status/latency console.log lines to Phase 2/3''s existing fetch() calls (additive only, no change to SUBREQUEST_CHECKPOINT/BATCH/dispatch logic -- Do-Not-Do respected). Deployed: meridian-entities-enrich version 34146536-4bda-47da-ba1a-b8b6f64eb3e1. Both crons confirmed unchanged post-deploy (`0 6 * * *`, `50 6 * * *` -- wrangler deploy output).

Auth verified live via a `wrangler dev --remote` tunnel to the real D1 (not simulated): no header -> HTTP 401 {"ok":false,"message":"Unauthorized"}; wrong secret -> HTTP 401 (same body); correct secret -> HTTP 200 {"ok":true,"message":"Enrichment triggered"}.

CRON PATH REAL-VERIFIED, NOT ASSUMED: fired scheduled() for real against real remote D1 twice via `wrangler dev --remote --test-scheduled`''s /__scheduled endpoint -- once at a mins<50 wall-clock moment (real Phase 1 ran clean, "populated 0 of 100"), once at the real 07:50 UTC mark (mins>=50 branch): real Phase 2+3 execution, checkpoint hit cleanly at 44/44, "selected 45, attempted 40, deferred 5" -- proves the existing cron-triggered invocation is completely unaffected by the new auth requirement, with real evidence, not code-reading alone.

--- STEP 2 RESULT: local LaunchAgent control surface ---
Built mirroring firds-local-seed''s exact pattern: entities-enrich-boost-run.mjs (payload, pause-check-first, one-line-per-run log) plus scripts/entities-enrich-boost-{install,pause,resume,status,uninstall}.sh. Installed for real (`launchctl bootstrap` succeeded, LABEL com.meridianatlas.entities-enrich-boost) -- confirmed loaded via status script. Pause/resume exercised live: paused -> manual run produced a true no-op (real log line "paused | skipped run -- pause flag set, no network/D1 activity", zero network/D1 calls made) -> resumed -> flag correctly cleared. Caught and fixed my own bug in entities-enrich-boost-status.sh''s schedule display (grep/sed mis-paired Hour with the wrong Minute, printing "11:17" instead of "11:50"/"17:50") -- replaced with PlistBuddy, re-verified correct (11:50, 17:50).

--- STEP 3/4 RESULT: timing window + pre-flight headroom check, both real-verified ---
entities-enrich-boost-run.mjs checks the real UTC minute at fire time and logs explicitly whether it landed in :50-:59 (Phase 3-eligible) or not, per the Change Request''s "verify in testing, not just in schedule config" requirement.

REAL BUG FOUND AND FIXED ON THE FIRST LIVE AUTOMATED ATTEMPT: the first-ever scheduled fire (07:50:05 UTC, via a detached background wrapper matching launchd''s non-interactive invocation shape) failed at the pre-flight headroom check with an unhelpfully generic "Command failed" error -- the script''s original error handling only logged err.message, not the underlying stdout/stderr, hiding the real cause. Root-caused as likely an execFileSync default-stdio (3 open pipes) issue under a detached/non-TTY process -- fixed by setting `stdio: ["ignore","pipe","pipe"]` explicitly, and by making the catch block surface err.status/err.stdout/err.stderr, not just err.message, so a repeat would be diagnosable. Re-verified successfully twice afterward under matching detached/disowned/stdin-from-null conditions (07:51:05 and 07:52:02 UTC) -- both real production /run calls succeeded end-to-end: headroom check passed (writes_today read live, 0/100,000 used, well clear of the 5,000 threshold), correct secret sent, real Phase 3 GLEIF work triggered (server logs: "attempted 38, deferred 7" and "attempted 42, deferred 3", both checkpoint-clean).

--- STEP 5 RESULT: low-cadence test installed and real-verified end-to-end ---
LaunchAgent installed at the intended low-cadence test schedule (2 additional/day: 10:50 + 16:50 UTC = 11:50 + 17:50 local BST, both chosen clear of the existing 06:xx UTC cron and the Sunday 04:00-07:00 UTC meridian-holdings collision window -- Known Issue 22.12). Three real Phase 2/3 invocations happened within a ~3-minute window today during testing (tighter clustering than the real 2/day schedule will ever produce, an unavoidable side effect of needing to test same-day rather than wait): the /__scheduled cron-path test, and the two real /run calls above. Checked for the exact race the Change Request flagged (Phase 3''s SELECT has no claiming/locking step): zero duplicate entity_relationships rows found across all three invocations combined (`GROUP BY ... HAVING COUNT(*) > 1` returned no rows) -- no corruption even under materially tighter-than-real-world clustering.

GLEIF HEALTH, REAL DATA: 100+ real GLEIF calls logged across the three invocations (self-detail, direct-parent, ultimate-parent), every single one HTTP 200, latency range 160-373ms, zero errors, zero signs of rate-limiting -- via both the real production Worker (`wrangler tail`) and the dev-tunnel cron-path test. This is a genuinely useful early data point (real GLEIF calls at a much higher burst rate than 2-6/day will ever produce, all clean) though it does not by itself prove 1-2 weeks of sustained 2/day traffic is safe -- ongoing monitoring still needed (see next_step).

REAL THROUGHPUT, BACKLOG IMPACT: entity_master''s Phase 3 eligible pool went from 10,118 (after today''s regular 06:50 UTC cron fire, itself 38 entities under the pre-auth code) to 10,001 after the three post-deploy test invocations -- net -117 across ~120 real attempted-entity-count reported by the three invocations combined (40+38+42), consistent with expectations (small variance plausibly from a newly-created parent entity re-entering the eligible pool, not a discrepancy).

--- NOT DONE YET, correctly not started per instruction ---
Scaling FIRE_HOURS_UTC to the full 4-6/day target (Change Request explicitly gates this on the low-cadence checkpoint being reviewed first). Sustained 1-2 week GLEIF monitoring (today''s evidence is real but is a single clustered burst, not 1-2 weeks of the real 2/day cadence).'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  stage = excluded.stage,
  status = excluded.status,
  next_step = excluded.next_step,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;
