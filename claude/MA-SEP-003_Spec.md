# MA-SEP-003 — ESMA FIRDS European Fund Data (Spec)

**Lane:** Data/Identity | **Owner role:** Entities Product Lead | **Stage:** ENG_IMPLEMENT — architecture revised **twice** on 2026-08-21 (both Founder-approved): first to a daily delta Worker, then — after real delta-file numbers came back far larger than assumed — to a **recurring weekly local job with an explicit start/stop/kill-switch control surface**, replacing both the chunked-Worker and daily-delta-Worker approaches. See "2026-08-21 Architecture Revision v2" below; this is the current, active design. No Cloudflare Cron Trigger is needed for this packet at all under this design.
**Drafted:** 2026-08-17, Entities Product Lead lane (Cowork) | **Revised:** 2026-08-19 (diagnostic findings), 2026-08-21 v1 (CPU-wall → daily delta Worker), 2026-08-21 v2 (delta file-size reality check → recurring local job — see below) | **Dependency:** MA-SEP-001 (entity dedup) — CLOSED 2026-08-16, cleared

## 2026-08-21 Architecture Revision v2 (read this first — current design)

Phase 2's diagnostic step (pulling real `DLTINS` files, per v1's own instruction to get real numbers before building) found the daily-delta premise was backwards: one part of one day's delta file is **~452–460 MiB uncompressed — over 5x the entire weekly `FULINS_C` file** that already broke the chunked-Worker design, because ESMA's deltas cover *every* instrument type across the whole EU market, not just funds, and are capped at 500,000 records/part the same way weekly files are (3–4 parts/day observed). CFI-C (fund) records were **39–60 out of 500,000 per part (~0.01%)** — real, but a needle in a haystack that costs more to fetch than the entire weekly full-file approach it was meant to replace. Full real numbers and analysis: `claude/MA-SEP-003_Escalation_Delta_File_Size.md`.

**Final approved architecture:** the weekly `FULINS_C` file is *already* exactly what's needed — pre-filtered to funds by ESMA itself, and a complete snapshot each week rather than a diff, so re-running the same idempotent seed logic weekly naturally catches new instruments, refreshes changed ones, and lets instruments that stopped trading simply age out of relevance (no delta record-type logic needed at all — see Requirement 1 and Non-Goals below). This becomes a **recurring weekly job on the Founder's own machine** (macOS `launchd`/LaunchAgent, same class of mechanism already used for MA-AUG-003's backfill), not a Cloudflare Worker of any kind. **No Cloudflare Cron Trigger is used by this packet under this design** — the account's 5/account Cron Trigger cap, which motivated the original `entities-enrich` consolidation work, is no longer something this packet needs at all. That consolidation work may still be worth doing for `entities-enrich`'s own sake (see the still-open, now fully decoupled `MA-SEP-003_Change_Request_Cron_Consolidation.md`), but nothing in MA-SEP-003 is waiting on it anymore.

**Because this is now a recurring, unattended, indefinitely-running local job, the Founder explicitly required a first-class control surface** — install, pause/resume, fully stop, and check status — not just a script that fires forever with no way to turn it off short of deleting files by hand. Full design: new Requirement 6 below.

Superseded by this revision: the daily delta Worker design in the previous revision (Requirement 1's "(1b)" and the whole of `claude/MA-SEP-003_Change_Request_Delta_Architecture.md`'s Phase 2). What's *not* superseded: Phase 1 (the one-time local seed script and its already-tested parsing/linkage logic) — it's simply promoted from a one-time bootstrap into the recurring job's payload, unchanged in substance.

## 2026-08-19 Diagnostic Findings

The local Claude Code build session ran the diagnostic step this spec called for and found real numbers plus two genuine blockers, all incorporated into this revision:

1. **Chunking is required, not optional** — real file numbers (86.6MiB uncompressed, 150,558 records / 18,353 unique ISINs) rule out a single-invocation Worker. See Requirement 1 and Open Question 1.
2. **The originally-approved cron-consolidation mechanism was unsafe** — it would have silently broken GLEIF enrichment. A corrected mechanism is proposed, but it surfaced a further pre-existing risk (Free-plan subrequest ceiling) that needs a live confirmation before any cron change proceeds. See Requirement 4 and `MA-SEP-003_Change_Request_Cron_Consolidation.md`.
3. **This spec and the Change Request had never actually reached the repo** — they existed only in this Cowork session's Claude Project, not on disk, which is why the local session couldn't find them on its first pass. Fixed this revision — both docs are now written to `claude/` in LOCAL_MASTER directly.

None of this changes the packet's fundamental scope or schema — the `firds_instrument_reference` table design is unaffected. It changes the build sequencing: chunking must be designed in from the start, and cron enablement (for both `meridian-firds` and the `entities-enrich` consolidation) is gated on confirmation steps that haven't run yet.

---

## Problem Statement

Meridian Atlas's entity/instrument graph currently identifies securities almost entirely through US-centric pathways — CUSIP-first derivation from `fund_holdings_monthly` (N-PORT) and SEC 13F filings. EU-domiciled funds and ETFs (UCITS, AIFs) have no reference-data pathway at all: their ISINs, issuer LEIs, and instrument classification don't exist anywhere in `instrument_master` or `entity_isin_map` unless they happen to appear as a holding inside a US fund's N-PORT filing. Any EU fund a user searches for today simply isn't identifiable in Corporate Atlas. This is a coverage gap, not a data-quality gap — there's nothing to fix, only something to add.

## Goals

1. Every EU-domiciled fund/ETF instrument classified under CFI category C (Collective Investment Vehicles) in ESMA FIRDS is identifiable by ISIN in Meridian's instrument graph.
2. Each identified instrument resolves to its issuer's LEI and, where that LEI already exists in `entity_master` (or can be enrichment-queued the same way GLEIF-sourced entities are today), to a canonical `entity_id`.
3. Ingestion runs on a real, documented Cloudflare free-tier read/write budget — no full scans, no unbounded cron.
4. Coverage is explicitly labeled directory-tier (identity + classification only) — never implied to be N-PORT-equivalent holdings depth.
5. Zero writes to any ETF-domain table; zero new coupling into `fund_holdings_monthly`-based pipelines.

## Non-Goals

- **Position-level EU fund holdings.** Explicitly excluded per Meridian-Sept-Scope.md — FIRDS is reference (directory) data only, never a holdings feed. A future packet could pursue UCITS KIID/annual-report holdings separately; not this one.
- **Non-fund FIRDS instrument classes** (equities, debt, derivatives — CFI categories other than C). Everything else in FIRDS is out of scope; ingesting it would blow the "depth over breadth" principle and the read/write budget for no product value today.
- **New UI surface.** This packet is data-layer only. MA-SEP-004 (parent-child hierarchy view) and any existing generic entity/instrument detail rendering are the surfaces that will eventually show this data — this packet's job is to make sure whatever they show carries an explicit directory-tier source label, not to build new screens.
- **Daily freshness.** ESMA publishes daily delta (`DLTINS`) files; **confirmed 2026-08-21 not to be a viable path at any point this session** — a single day's delta is far larger than the entire weekly full file for a tiny fraction of relevant (CFI-C) records (see "2026-08-21 Architecture Revision v2" and `MA-SEP-003_Escalation_Delta_File_Size.md`). v1 uses the weekly `FULINS_C` full file only, run repeatedly — this is the final position, not a placeholder pending a future daily mechanism.
- **A live/running Cloudflare Worker for FIRDS ingestion.** Superseded 2026-08-21 — the final v1 architecture is a recurring local job on the Founder's machine, not a Worker. `meridian-firds`'s Worker deployment (built and live-tested during the chunked-Worker attempt) is retired, not extended.
- **Non-EU FIRDS filers (UK FCA FIRDS).** ESMA and the UK FCA run parallel FIRDS systems post-Brexit; this packet is ESMA-only. FCA FIRDS is a separate future decision.

## Data Source — ESMA FIRDS (researched this session)

- **What it is:** ESMA's MiFID II/MiFIR reference-data system. Publicly identifies every in-scope financial instrument by ISIN, with issuer LEI, CFI classification (ISO 10962), full/short name, notional currency, trading venue MIC, and first-trade date. Free, no auth required.
- **Access:** Machine interface is a Solr query endpoint — `https://registers.esma.europa.eu/solr/esma_registers_firds_files/select?q=*&fq=publication_date:[...]&wt=xml` — returns the list of published file URLs for a given date, which are then downloaded directly (no API key).
- **File types:**
  - `FULINS_<CFI-1st-letter>_<YYYYMMDD>_<N>of<M>.zip` — full snapshot, split by CFI first letter (Collective Investment Vehicles = **C**), split further if a category exceeds 500,000 records. Published **weekly, Sundays by 09:00 CET.**
  - `DLTINS_<YYYYMMDD>_<N>of<M>.zip` — daily delta (adds/modifies/terminates/cancels since last file), covering *all* instrument types, not just funds, and split at the same 500,000-record/part ceiling as weekly files (3–4 parts/day observed). **Confirmed 2026-08-21, not used, and not planned:** one part alone runs ~452–460 MiB uncompressed for ~39–60 relevant CFI-C records — larger than the entire weekly `FULINS_C` file for a tiny fraction of the useful data. See Non-Goals and `MA-SEP-003_Escalation_Delta_File_Size.md`.
  - Format: XML, per ESMA-published XSD schemas (`auth.017...FULINS`, `auth.036...DLTINS`).
- **Scale (context, not FIRDS-C-specific):** FIRDS covers ~5.48M instruments across all instrument types (source: OpenSanctions' FIRDS mirror, updated monthly). The CFI-C (fund/ETF) subset is a small fraction of that — exact count unverified, see Open Questions.
- **CFI category "C" = Collective Investment Vehicles** per ISO 10962 and confirmed by ESMA's own `FULINS_C_...` filename convention in its published instructions doc. Treated as high-confidence but not yet empirically verified against a live pull — first build step, not an assumption to carry forward silently.

## Proposed Schema Change

**New table.** Per project rule, domain ownership is declared explicitly here: **this is an Entities-domain table**, owned by the Entities Product Lead, same as `entity_master` / `entity_isin_map`. No ETF-domain table is read or written by this packet.

```sql
-- Table class: Core — Entities (per Storage Strategy v1: fetched from an external
-- authoritative source (ESMA), not rebuilt from another internal table — same
-- classification logic as entity_master, which is Core because it's GLEIF-sourced.)

CREATE TABLE IF NOT EXISTS firds_instrument_reference (
  isin              TEXT PRIMARY KEY,
  lei               TEXT,                 -- issuer LEI, as published by FIRDS
  cfi_code          TEXT NOT NULL,        -- full 6-char CFI, first letter = 'C'
  full_name         TEXT,
  short_name        TEXT,
  notional_currency TEXT,
  trading_venue_mic TEXT,                 -- nullable; instrument may trade on multiple venues, first/primary only in v1
  first_trade_date  TEXT,
  publication_date  TEXT NOT NULL,        -- FIRDS record's own reference date
  source_file       TEXT,                 -- FULINS filename this row was last confirmed in, for traceability
  first_seen_at     TEXT DEFAULT (datetime('now')),
  last_updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_firds_lei ON firds_instrument_reference(lei);
```

**No new columns on existing tables.** Linkage into the existing graph reuses the bridges already built for the identical US problem (per the 13F precedent — "don't build a second bridge"):

- `entity_isin_map` (ISIN → entity_id) gets new rows once an ingested ISIN's LEI resolves to an existing `entity_master.lei`. Where the LEI is not yet present, the entity is queued via the existing `entity_enrichment_queue` mechanism — same GLEIF-driven path already used, no new resolver.
- `instrument_master` gets new rows keyed by `instrument_key` derived from ISIN (ISIN-fallback derivation already exists for non-US securities) — this makes EU fund instruments visible to any code that already queries `instrument_master`, at zero schema cost.

**Retention:** Keep forever, mirroring `entity_isin_map` — reference-data rows have no natural expiry. Weekly re-pull uses `INSERT OR IGNORE` plus a keyed `UPDATE ... WHERE last_updated_at < publication_date` refresh for changed rows (not a delete/reinsert), so historical `first_seen_at` is preserved.

**Sizing (per Storage Strategy v1's four mandatory fields):**

| Field | Estimate | Confidence |
|---|---|---|
| Rows at launch | Unverified — needs first live `FULINS_C` pull to confirm. Placeholder estimate: low tens of thousands, based on `entity_isin_map`'s existing 14–19k rows for the current (mostly US) universe as a rough scale anchor. | Low — flagged as an Open Question, not asserted |
| Rows/month after launch | Small — weekly full-file diffing only adds genuinely new/changed ISINs | Low |
| Rows at 12 months | Well under the 500,000-row / 500MB Architect-review trigger on any plausible estimate | Medium |
| Retention rule | Keep forever (Core — Entities) | High |

Because the 12-month estimate is comfortably under the Storage Strategy v1 automatic-Architect-review threshold, this table alone would not require escalation on size — **it still requires Founder + Architect sign-off because it is a new Worker and a new table**, per the Sprint Board's own stated approval requirement for this packet.

## Requirements

### Must-Have (P0)
1. **(FINAL, 2026-08-21 v2)** The weekly `FULINS_C` full file is ingested by a **recurring local job** — a script run on the Founder's machine on a weekly schedule (not a Cloudflare Worker of any kind, not cron-triggered inside Cloudflare). It reuses the parsing, CFI-C filtering, ISIN dedup, and entity-linkage logic already built and live-tested in `src/firds-parse.js`/`src/firds.js`, writing to D1 via `wrangler d1 execute` or the D1 HTTP API. Every write remains `INSERT OR IGNORE`, so each week's run is safe to simply re-run start to finish: new instruments get added, existing ones get silently reconfirmed, and instruments no longer present in the newest weekly file simply stop being refreshed (no delete/expire logic needed — consistent with this table's "keep forever" retention policy already specced below). This single mechanism replaces both the earlier chunked-Worker design (hit a CPU wall, see `MA-SEP-003_Escalation_CPU_Wall.md`) and the daily-delta-Worker design (delta files proved far larger than the problem they were meant to solve, see `MA-SEP-003_Escalation_Delta_File_Size.md`).
   - *Acceptance:* the seed script completes a full pass over one real weekly `FULINS_C` file in one run, dedupes correctly on ISIN (not on raw `<RefData>` record count), and reports real before/after row counts for `firds_instrument_reference`, `entity_isin_map`, `instrument_master`, and `entity_enrichment_queue`.
2. New ISINs with a resolvable LEI populate `entity_isin_map`; unresolvable LEIs are queued into `entity_enrichment_queue`, not silently dropped.
   - *Acceptance:* spot-check of 20 known EU ETF ISINs (e.g. iShares/Vanguard/SSGA/Invesco UCITS ETFs, matching the issuers already in Meridian-Atlas-Team-v3's approved free-data list) shows correct LEI/entity resolution or correct enrichment-queue placement.
3. `instrument_master` gains ISIN-keyed rows for every ingested FIRDS-C instrument not already present.
   - *Acceptance:* `instrument_master` row count increases only by genuinely new ISINs; no duplicate `instrument_key`s created for ISINs that already exist via the N-PORT pathway.
4. ~~**Weekly Cron Trigger, contingent on a prerequisite Cron Trigger budget fix.**~~ **Superseded 2026-08-21 v2 — no longer applicable to this packet.** Under the final local-job architecture, MA-SEP-003 uses no Cloudflare Cron Trigger at all — the weekly schedule lives entirely in a macOS LaunchAgent on the Founder's machine. The account's 5/5 Cron Trigger situation and the `entities-enrich` subrequest-ceiling risk found while investigating it are both real and still worth resolving (see `MA-SEP-003_Change_Request_Cron_Consolidation.md`, still open) — but nothing in MA-SEP-003 is waiting on that resolution anymore. This finding is kept in the record because it's genuinely useful (and because the consolidation work may still happen for `entities-enrich`'s own sake), not because this packet still needs it.
5. Zero reads or writes against any ETF-domain table (`etf_master`, `fund_holdings_monthly`, `fund_snapshot_monthly`, `universe_changes_monthly`, `holdings_pipeline_state`, `etf_aliases`, `edgar_bootstrap*`).
6. **(NEW, 2026-08-21 v2) The recurring local job must have an explicit, documented control surface — install, pause/resume, and a full stop ("kill switch") — not just a script that fires on a schedule with no way to turn it off short of manually editing system files.** This is a Founder-required acceptance criterion, not an optional nicety.
   - **Install:** a single script writes and loads a macOS LaunchAgent (`~/Library/LaunchAgents/com.meridianatlas.firds-weekly-seed.plist`) that fires the seed script weekly, comfortably after ESMA's ~09:00 CET Sunday publish window (exact local time to be set against the machine's actual timezone — confirm with `date`, don't assume).
   - **Kill switch (hard stop):** a single script fully unloads and removes the LaunchAgent (`launchctl bootout` + delete the `.plist`). After this runs, nothing fires again, on any schedule, until `install` is explicitly re-run. This is the "make it stop, permanently, right now" control.
   - **Pause / resume (soft stop):** a lightweight flag file (e.g. `App/Corporate Atlas/.firds-seed-paused`) that the seed script checks as the very first thing it does, before any network call or D1 write — if present, it logs "paused, skipping this run" and exits immediately, at zero cost. The LaunchAgent stays scheduled; each fire just becomes a no-op while paused. A separate script creates/removes this file. This gives a lighter-weight, instantly-reversible control that doesn't require touching `launchctl` at all.
   - **Status:** a script that reports, in one glance: is the LaunchAgent currently loaded, is the pause flag currently set, and when the job last ran with what outcome (read from a small log file the seed script appends to on every run — timestamp, outcome, row-count deltas). No more digging through `launchctl` output or guessing whether last Sunday's run actually happened.
   - *Acceptance:* all four controls (install / kill switch / pause+resume / status) exist as separate, clearly-named scripts, are exercised at least once each during the build session (including actually firing a real run, pausing it, confirming a paused fire is a true no-op, resuming, and fully uninstalling and reinstalling), and are documented in the Build Brief's Required Outputs with the exact commands to run each one.

### Nice-to-Have (P1)
1. `source_file` / `publication_date` surfaced somewhere queryable so a future UI (MA-SEP-004 or entity detail page) can render "FIRDS directory-tier, as of {date}" rather than a generic "coverage" label.
2. A lightweight `/validate-data` pass specific to this table (orphan `entity_isin_map` rows pointing at FIRDS ISINs with no `entity_master` match, duplicate ISIN-to-multiple-entity mappings).

### Future Considerations (P2)
1. ~~Daily `DLTINS` delta ingestion, once the weekly pipeline has run cleanly for a few cycles.~~ **Superseded 2026-08-21** — this is now core v1 architecture (Requirement 1), not deferred.
2. UK FCA FIRDS as a second, structurally similar source.
3. Full CFI taxonomy beyond category C, if a future packet needs equities/debt reference data for EU issuers.

## Read/Write Budget & Safety Reasoning (Entities Product Lead responsibility)

- **Cadence:** weekly, Sunday-anchored (matches FULINS publication) — run by a local macOS LaunchAgent, not a Cloudflare cron. **No Cloudflare Cron Trigger budget is consumed by this packet** under the final architecture — the three-point check below is about D1 read/write safety, not cron-slot budgeting, since there is no Cloudflare cron here to gate.
- **Reads against D1:** the seed script fetches the ESMA file listing and the `FULINS_C` zip(s) directly (external HTTP, not counted against D1); D1 reads are limited to existing-row lookups for the batch being upserted — same shape as `meridian-entities-seed`'s existing GLEIF-driven inserts, well inside the 5M reads/day free-tier ceiling for a once-weekly job.
- **Writes:** `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING`, `db.batch()`, batched at the D1 REST 100-parameter ceiling learned during the 13F build (≈7–10 rows per call depending on final column count) — never a per-row loop. A low-tens-of-thousands full-table pass stays comfortably inside the 100k writes/day cap for one weekly run; exact figure documented from Phase 1's real run (see Build Brief).
- **Three-point check, applied to the recurring job (not a Cloudflare cron, but the same underlying discipline):** (1) index audit confirms no full scan on `firds_instrument_reference` or the tables it writes into; (2) a real run's read count stays under 50k rows; (3) the actual read/write count from a real run is documented back into this spec or its Build Brief before the LaunchAgent is installed for ongoing weekly use.

## Open Questions

0. **(Engineering — RESOLVED 2026-08-21, and the resolution changed the architecture)** Real `DLTINS` delta file size and record count. **Answer: far larger than assumed** — one part alone runs ~452–460 MiB uncompressed (vs. 86.6 MiB for the entire weekly `FULINS_C` file) for ~39–60 relevant CFI-C records out of 500,000/part. This ruled out the daily-delta-Worker approach entirely rather than just requiring it to be built differently — see `MA-SEP-003_Escalation_Delta_File_Size.md` and "2026-08-21 Architecture Revision v2" above. Record-type tags: `NewRcrd`/`ModfdRcrd`/`TermntdRcrd` confirmed at real volume, `CancRcrd` not observed in this sample (treat as real-but-rare). CFI code confirmed present per-record. None of this matters for the final local-job architecture, which needs none of it — kept here as a record of real, useful diagnostic work.
1. **(Engineering — RESOLVED 2026-08-19 for the weekly full-file approach, which is now superseded — see "2026-08-21 Architecture Revision" above)** Can `meridian-firds` parse a full `FULINS_C` XML file within a single Cloudflare Worker invocation's CPU/memory limits, or does this need chunked/resumable processing (mirroring `edgar_bootstrap_progress`'s resumable-offset pattern)? **Answer: chunked/resumable processing is required, and was built — but chunking a full-file pass across many invocations still hits a second, independent CPU wall from cumulative re-decompression cost. Superseded by the local-seed + daily-delta architecture; this finding remains valid and instructive, just no longer the active design.** Real numbers from `FULINS_C_20260815_01of01.zip`, downloaded and MD5-verified against ESMA's own Solr-listed checksum: compressed 3,648,703 bytes (~3.65 MB), **uncompressed 90,818,287 bytes (~86.6 MiB)**, **150,558 total `<RefData>` records but only 18,353 unique ISINs** (each instrument repeats once per trading venue it's listed on — the spec's schema and ingest logic must dedupe on ISIN, not assume one record = one row). The uncompressed text sits close to the Workers 128MB isolate memory ceiling before any parsed structures or response buffering, and at ~7–10 rows/`db.batch()` call, upserting even just the 18,353 unique ISINs is ~1,800–2,600 separate batch calls — this will not complete in one invocation regardless of CPU budget. **P0 Requirement #1 below is updated accordingly: `meridian-firds` must be built as a chunked/resumable Worker from v1**, not treated as a single-shot build with chunking as a fallback.
   - **CFI category "C" also confirmed at record level this session** (not just file-listing level as previously noted): 100% of records in the real file carry a `ClssfctnTp` starting with `C` (e.g. `CBCIXS`, `CBMGXS`, `CBOIXS` — Collective Investment Vehicles codes). Open Question 2 below is now fully closed, both at the file-index and record level.
2. **(Engineering — RESOLVED)** Confirm CFI category "C" is in fact the correct filter for funds/ETFs against a live pulled file, not just the filename convention shown in ESMA's instructions PDF. **Confirmed 2026-08-17 at the file-index level, and confirmed 2026-08-19 at the record level** (100% of real `FULINS_C` records carry a `C`-prefixed `ClssfctnTp` — see Open Question 1 above).
3. **(Architect — blocking, per Sprint Board's stated approval requirement)** Sign off on the schema above (new table, Entities-domain, Core classification) and the "reuse existing bridges, no new resolver" approach before a build session opens.
4. **(Resolved this session — Cron Trigger budget)** Cloudflare Workers Free plan caps Cron Triggers at 5/account (confirmed live against Cloudflare's own limits documentation, 2026-08-17). The account was found to be at exactly 5/5 active (`meridian-bootstrap` ×1, `meridian-holdings` ×1, `meridian-entities-enrich` ×2, `meridian-entities-seed` ×1). Total Worker *script* count was not the constraint (11 of 100 used) — Cron Triggers were. Founder-directed resolution: consolidate `meridian-entities-enrich` to 1 trigger/day, freeing the slot `meridian-firds` needs. See `MA-SEP-003_Change_Request_Cron_Consolidation.md` for the full impact analysis and rollback plan. **Flag for any future packet:** the account returns to 5/5 once `meridian-firds`'s cron is enabled — zero headroom remains for the next packet needing its own schedule.
5. **(Entities Product Lead — non-blocking)** Real row-count estimate for `firds_instrument_reference` at launch — narrowed this session (single-file, so bounded well under 500,000) but exact figure still pending a local-session download since this sandbox is blocked from fetching the file directly. Should be confirmed and this spec updated before the Sizing table above is treated as final.
6. **(Founder — non-blocking)** Whether to also backfill FIRDS data for EU ETFs already known to Meridian via other means (e.g. any EU fund families already partially represented from N-PORT-adjacent US listings), or treat this purely as new-coverage-only for v1.

## Timeline Considerations

- No hard external deadline. Per `Meridian_Atlas_September_Sprint_Plan.md`, this packet is slotted for weeks 3–4 (Sep 6–12) but is unblocked now (MA-SEP-001 closed 2026-08-16, ahead of schedule) — kicking off early is consistent with the sprint's real buffer, not a schedule risk.
- **Must run from local Claude Code, not this Cowork session**, once build begins — this cloud sandbox cannot reach the Cloudflare API / has no `wrangler`, the same confirmed constraint documented for MA-SEP-001 and MA-AUG-003. This session's job ends at an approved spec + Build Brief; execution hands off exactly like MA-SEP-001 did.
- **Final phasing (2026-08-21 v2):** (1) spec + schema approved — done; (2) table deployed, chunked-Worker approach built/tested/retired after hitting a real CPU wall — done, see `MA-SEP-003_Escalation_CPU_Wall.md`; (3) local one-time seed run — done, 10,986 real instruments live; (4) daily-delta-Worker approach diagnosed and rejected after real numbers came back — done, see `MA-SEP-003_Escalation_Delta_File_Size.md`; (5) **next:** build the recurring-local-job control surface (install/kill-switch/pause-resume/status per Requirement 6), verify one real weekly run end-to-end, retire the now-unused `meridian-firds` Worker deployment; (6) `/validate-data` pass; (7) Sprint Board close-out. The `entities-enrich` cron-consolidation prerequisite (`MA-SEP-003_Change_Request_Cron_Consolidation.md`) is fully decoupled from this phasing — it can proceed or not on its own timeline, independent of MA-SEP-003.
