-- MA-SEP-011: Known Issue 22.12 close-out (meridian-holdings write cadence review + 3 guard fixes)
-- 2026-08-30, Architect/ETF Product Lead, true local Claude Code Terminal session.
--
-- TICKET ID CAUTION, flagged not silently assumed: MA-SEP-011 was the next free
-- ticket_id in the LIVE sprintboarditems table at the time this was written (verified
-- via SELECT ticket_id ORDER BY ticket_id -- MA-SEP-001 through MA-SEP-010 exist,
-- MA-OCT-001 exists, nothing at MA-SEP-011/012 yet). This packet's own instructions
-- referenced "MA-SEP-012b" as an off-limits parallel scope (entity_merge_exceptions,
-- meridian-entities-api) that does NOT appear anywhere in this live table, this repo's
-- files, or git history -- meaning a Cowork session is very likely mid-flight on
-- MA-SEP-011/012/012b work that hasn't synced here yet. This project has hit a real
-- ticket_id collision before (MA-SEP-002/007, 2026-08-16) -- flagging this same risk
-- again rather than assuming MA-SEP-011 is safely mine. If MA-SEP-011 turns out to
-- already be claimed elsewhere, this row's ticket_id needs renumbering before it's
-- treated as final.

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-011',
  'meridian-holdings cadence review close-out (Known Issues 22.12/22.18/22.19/22.20)',
  'ETF',
  'data_identity',
  'CLOSED',
  'Architect / ETF Product Lead',
  'CLOSED',
  NULL,
  NULL,
  NULL,
  'Known Issue 22.12 (weekly write cadence review, 2026-08-30): confirmed sound. The qualifying ETF universe (has_nport=1, series_id set, coverage_status=''deep'') has been flat at 237 since a single 2026-06-01 seed event (seed-etf-master.js, never re-run) -- it cannot grow on its own. The apparent week-over-week climb in real rows_written (28,106 -> 60,304 -> 74,778 -> 98,651 across 2026-08-02 through 2026-08-23) was batch-composition variance while a fixed PIPELINE_BATCH_SIZE=20 works through the 237-ETF backlog (etf_offset stood at 233/237 as of 2026-08-30), not accelerating growth -- confirmed by the next Sunday (2026-08-30) coming back down to 81,454. The existing 3-layer write guard (outer/per-ETF/mid-loop-per-100-rows, all measured in real rows_written) is confirmed working. Full detail: claude/Known_Issue_22.12_Review.md (committed ecf5ace, previously written but uncommitted).

CORRECTION TO THE ORIGINAL 2026-08-30 REVIEW, flagged not silently reconciled: this close-out packet''s own framing claimed the growth was "batch-composition noise from a Sprint Board date-mislabeling bug" -- this is NOT what the review found or what this session could confirm. The review''s actual, verified finding is backlog batch-composition variance (described above), not a date-mislabeling bug of any kind. Also: claude/Known_Issue_22.12_Closeout_Build_Brief.md, referenced by this packet as possibly present, does not exist anywhere in this repo -- same "referenced but never landed on local disk" gap this project has hit before with other Cowork-session documents.

Known Issue 22.18 (unauthenticated /run): fixed. Shared-secret header check (X-Holdings-Run-Secret / HOLDINGS_RUN_AUTH_SECRET binding), checked before hold/budget logic, fails closed if the binding is missing -- same pattern as entities-enrich''s RUN_AUTH_SECRET (Known Issue 22.13). Secret generated via openssl rand -hex 32, stored via wrangler secret put + a gitignored local file, never committed, never logged. Live-verified: unauthenticated /run -> 401 {"ok":false,"message":"Unauthorized"}; correct-secret /run -> 200 {"ok":true,"message":"Pipeline triggered"}, and since today''s real budget was already at 81,454, the real triggered run safely hit the existing outer guard (last_run_status="write_limit:81454:skipped", etf_offset unchanged at 233 -- confirmed via a fresh D1 read, not just the HTTP response).

Known Issue 22.19 (mark-complete UPDATE not pre-checked): diagnosed the actual failure mode, not just flagged. `done` (whether an ETF/month''s insert loop finished) is computed purely from rowCursor vs holdings.length, with no awareness of whether the mid-loop budget checkpoint fired on that exact final batch. When an ETF/month''s LAST insert batch is also the batch that crosses DAILY_WRITE_LIMIT, the guard''s own `break` fires but `done` still evaluates true -- so the mark-complete UPDATE (previously counted only after the fact, never pre-checked, and capable of a non-negligible rows_written on its own per the 2026-07-25 code comment: ~3,416/call in one cited example) ran unconditionally immediately after the guard had just signaled the day''s budget was exhausted. Fixed: real pre-check before the UPDATE; defers (done:false, same rowCursor) if already over budget, so the existing per-ETF-month resume mechanism (offset_{ticker}_{month} keys) retries just the mark-complete step next cron cycle -- no re-insertion, no data loss.

Known Issue 22.20 (catchup-script.js bypasses the guard): CORRECTED from the original review''s characterization. catchup-script.js was NOT "invisible to the guard entirely" -- it already reads/writes the same writes_today_* counter key and has its own pre-checks (WRITE_ABORT_LIMIT=75,000, WRITE_GUARD_LIMIT=70,000, both conservatively below the main pipeline''s 80,000). The real, more precise bug: it counted its own inserts using chunk.length (a logical row count) instead of D1''s real rows_written, silently under-representing its true write cost in the SAME shared counter the main pipeline''s guard also reads -- confirmed live (2026-08-30): a 7-row multi-row INSERT via this script''s exact D1 REST shape reported meta.changes:7 but meta.rows_written:50 (a ~7x undercount). It also never counted or pre-checked its own mark-complete UPDATE at all (worse than the main pipeline, which at least counted it after the fact, pre-2026-08-30-fix). Chose to harden the existing equivalent-guard mechanism (fix the counting unit + add the same mark-complete pre-check as 22.19) rather than a rewrite or literal routing through the Worker''s code, since this is a separate local Node process with no access to env.DB -- literal routing isn''t feasible. Also closed a gap the fix itself introduced a need for: this script has no persisted per-row resume state (unlike the main pipeline''s offset keys), so a deferred mark-complete needed to be detected live via a snapshot_status IS NULL check on re-run, not a stored offset -- otherwise the existing "already complete" row-count check would have silently skipped a deferred month forever without ever finishing it.

Three-point check (all write-path/cron-adjacent changes): existing composite index idx_holdings_status_series_month (snapshot_status, series_id, report_month) fully covers every new query added -- confirmed via a live 0-rows-read test against real data (AGG 2026-02). No new writes introduced anywhere -- only existing writes correctly attributed to the real metered value or gated by a real pre-check. Read/write budget per invocation: +1-2 indexed single-key reads at most per ETF/month completion, negligible.

Live verification beyond the /run auth test: mark-complete pre-check branching logic and the real-rows_written-vs-chunk.length fix were verified via an isolated test harness against a dedicated test key (writes_today_TEST_22_19_VERIFY) and an unmistakably fake series_id (TEST_VERIFY_22_20) -- confirmed both branches (defer at 81,454, proceed at 100) and confirmed the real/logical row-count mismatch (50 vs 7) using real D1 infrastructure, never the actual production writes_today_2026-08-30 counter. Cleanup independently re-verified (test key and test rows both confirmed gone via a fresh read, production counter confirmed unchanged at 81,454 throughout).

Deploy note: the first deploy attempt failed to sync the cron trigger ("invalid cron string: 0 4 * * 0", code 10100) because wrangler-holdings.toml''s numeric-Sunday cron string has apparently never matched what Cloudflare''s dashboard actually stored since 2026-07-28 (named "sun", not numeric "0") -- a pre-existing file/live drift, not introduced this session. Verified via the schedules API BEFORE touching anything further that the live trigger was completely unmodified by the failed attempt. Corrected the file to the working "0 4 * * sun" string and redeployed clean -- same schedule, same effect, not a cadence change, just a corrected representation.

Not touched, per explicit scope: Known Issue 22.17 (entity_isin_map dedup gap), Known Issues 22.21/22.22 (AGG anomalies), MA-SEP-012b''s scope (entity_merge_exceptions, meridian-entities-api -- no trace of this found anywhere in this repo, consistent with the recurring pattern of Cowork-referenced work not yet landed on local disk).

Commits: ecf5ace (review doc), 19f1428 (code changes for items 1-3), both pushed to origin/September-2026.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  title = excluded.title,
  stage = excluded.stage,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO releaseledger (
  release_id, ticket_ids, change_summary, frontend_files, worker_files,
  d1_migration_status, worker_deploy_status, frontend_push_status,
  verification_status, production_parity_status, status, closed_at
)
VALUES (
  'REL-2026-08-007',
  '["MA-SEP-011"]',
  'meridian-holdings: retired emergency-mitigation framing (comment-only), added /run auth (Known Issue 22.18, HOLDINGS_RUN_AUTH_SECRET), fixed mark-complete pre-check (Known Issue 22.19), fixed catchup-script.js write-guard unit mismatch + added its mark-complete pre-check (Known Issue 22.20). Also corrected wrangler-holdings.toml''s cron string (numeric -> named Sunday) after a failed deploy revealed a pre-existing file/live drift -- same schedule, confirmed via the schedules API before and after. Deployed version 93ab6411-8fc4-4e37-aa01-673bb8eb7397. Live-verified: /run auth 401/200, outer guard correctly skipped real work given today''s already-exhausted budget (81,454). Mark-complete and rows_written-vs-chunk.length fixes verified via an isolated test harness, never touching the real production counter.',
  NULL,
  'App/ETF Refresh/wrangler-holdings.toml, App/ETF Refresh/src/holdings-pipeline.js, App/ETF Refresh/catchup-script.js',
  'none',
  'deployed',
  'not_started',
  'passed',
  'aligned',
  'VERIFIED',
  CURRENT_TIMESTAMP
);
