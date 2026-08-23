INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-001',
  'entity_master duplicate cleanup + normalization fix',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  'Full-scope audit found duplicates far beyond the 3 originally-known pairs (Danaher; CureVac NV/N.V.; Jai Corp Ltd/Limited). Merged 1,833 groups / 1,834 rows across two passes (entity_master 34,958 -> 33,124), all under a strict auto-merge bar (LEI match on every row, or byte-identical name text). Fixed the root-cause normalization bug in entities-seed.js normalizeName() (suffix-strip ran before punctuation-strip, so dotted abbreviations like N.V./S.A./B.V. never matched) and consolidated entities-enrich.js/entities-delta.js off their own crude inline normalization onto the same shared function. Deployed meridian-entities-seed, -enrich, -delta, -figi. Post-merge QA clean: zero orphaned FK refs across 7 dependent tables, zero UNIQUE(normalized_name,type) violations. One unrelated pre-existing data issue found and left alone (2 orphaned entity_enrichment_queue rows, predates this session). Remaining backlog opened as MA-SEP-002.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  stage = excluded.stage,
  notes = excluded.notes,
  next_step = excluded.next_step,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-002',
  'entity_master duplicate cleanup, remaining backlog (review-required)',
  'Entities',
  'data_identity',
  'IDEA',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  '/write-spec to set the confidence bar for category A, and to identify SLM/Navient-style rename cases in category B before any bulk action.',
  'Founder review of App/Corporate Atlas/ma-sep-002-open-duplicates.csv (3,985 rows) and MA-SEP-002_backlog.md',
  'Opened as a direct follow-on to MA-SEP-001 (2026-08-16). 2,224 groups / ~3,985 entity rows left un-merged by design: 1,780 groups (3,561 entities) same-type name matches with no LEI corroboration; 167 groups (336 entities) LEI-collision-but-name-mismatch, includes the SLM Corp/Navient Corp do-not-merge risk case; 17 groups (~34 entities) non-fund cross-type pairs; 27 groups (~54 entities) fund/operating cross-type pairs left alone as intentional design per Founder decision same day. Review file and packet note both live in App/Corporate Atlas/.'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  stage = excluded.stage,
  notes = excluded.notes,
  next_step = excluded.next_step,
  approval_needed = excluded.approval_needed,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
VALUES (
  'MA-SEP-003',
  'ESMA FIRDS European fund data — recurring local weekly job',
  'Entities',
  'data_identity',
  'CLOSED',
  'Entities Product Lead',
  'ACTIVE',
  NULL,
  'Optional follow-up, not blocking: implement the Spec''s originally-described UPDATE-on-change refresh for firds_instrument_reference (currently INSERT OR IGNORE only) to stop ISIN-to-multiple-entity drift when a FIRDS issuer LEI changes between weekly files — 3 real cases found 2026-08-22 on the second real weekly run (US77926X2962, US92189L1035, US92647X7562). No packet opened yet.',
  NULL,
  'Architecture went through three revisions before landing: (1) chunked/resumable meridian-firds Worker built and live-tested (10,986 real instruments) but hit a genuine CPU wall at 82.3% through one file — see MA-SEP-003_Escalation_CPU_Wall.md; (2) pivoted to one-time local seed + daily-delta Worker, but real DLTINS diagnostic numbers (one part alone ~452-460MiB uncompressed, 5x the entire weekly file, for ~0.01% relevant CFI-C records) ruled that out before any Worker code was written — see MA-SEP-003_Escalation_Delta_File_Size.md; (3) final architecture: re-run the weekly FULINS_C file as a recurring local job (macOS LaunchAgent), no Cloudflare Worker or Cron Trigger at all. Built the Founder-required control surface (firds-seed-install/uninstall/pause/resume/status.sh under App/Corporate Atlas/scripts/) and genuinely exercised all four (real run, real no-op pause, resume, uninstall+reinstall). Retired the now-unused meridian-firds Worker deployment and FIRDS_PROGRESS KV namespace (both confirmed gone via wrangler). Found and resolved a cross-packet macOS TCC permission block (launchd-spawned node couldn''t read ~/Desktop at all) that was ALSO silently breaking two already-closed packets'' recurring jobs (MA-AUG-003''s financialfact-backfill, MA-AUG-004''s health-check) since ~2026-08-21 — Founder granted Desktop-folder access to /usr/local/bin/node; a follow-on PATH bug (launchd''s bare PATH doesn''t include /usr/local/bin, so npx/wrangler calls failed with ENOENT) was fixed at the plist level (EnvironmentVariables) for all three LaunchAgents, not just this packet''s. All three re-fired for real via launchctl kickstart and confirmed genuinely working via real log output: health-check ran a real D1 headroom check; financialfact-backfill processed a real 135-issuer batch (11,316 logical / 19,431 real rows written, offset 2470->2605, ~9 daily fires remaining to complete its pool — no manual catch-up run, flagged to Founder per instruction instead); firds-weekly-seed processed a genuinely new weekly file (FULINS_C_20260822, not the same file as the manual test) with real deltas (firds_instrument_reference +31, entity_isin_map +34, instrument_master +31, entity_master +23, entity_enrichment_queue +0 as expected). Full detail: claude/Escalation_LaunchAgent_TCC_Permission.md (RESOLVED). Known gap for follow-up: see next_step. Note: Sprint_Board.md, referenced by this packet''s own Spec/Build Brief as the canonical status doc, does not exist on disk in this repo — only Sprint_Board_August.html (which does not mention MA-SEP-003) and this live sprintboarditems table. Also noticed in passing, unrelated to this packet: MA-AUG-003/MA-AUG-004 rows in this same table show stage=PRODUCT_SPEC, not CLOSED, despite being described elsewhere as already shipped/closed — flagged, not corrected (out of scope today).'
)
ON CONFLICT(ticket_id) DO UPDATE SET
  stage = excluded.stage,
  notes = excluded.notes,
  next_step = excluded.next_step,
  approval_needed = excluded.approval_needed,
  updated_at = CURRENT_TIMESTAMP;
