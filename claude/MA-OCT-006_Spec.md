# MA-OCT-006 — GLEIF Reliability Investigation: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (packet owner; wrote this spec; runs the investigation)
REVIEWED BY:  Operations Lead
APPROVED BY:  Founder
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Spec approval (target Wed 30 Sep) → investigation 1–14 Oct → ranked remediation matrix → go/no-go on MA-OCT-011
```

**Status:** Draft for Operations Lead review. **Written:** 2026-09-26.
**Brief:** `claude/MA-OCT-006_Spec_Brief.md`, SHA-256 `ffd3522a01be79795b3438914966f43f9efd0698349d1a98c1802ebc398d3332` (verified before reading).
**Method for this spec:** MA-OCT-000 evidence plus a read of the source on `October-2026` @ `5405e3e` (`git --no-optional-locks` only; no `.git/*.lock` present). **No D1 queries, no GLEIF calls, no code edits, no git writes** were made by this lane.

Sources read: Scope v2 (GLEIF Reliability), Addendum §2/§5/§6, MA-OCT-000 Close-out (§7, F2–F7, F10) and Architect Review (ruling 2, finding 5), Sprint Board (KI 22.9, 22.10, 22.16, 22.17, backlog MA-OCT-003), `src/entities-seed.js`, `src/entities-enrich.js`, `src/entities-delta.js`, `entities-enrich-boost-run.mjs` and its log, `migrations/corporate-atlas-v1.sql`, `gleif-schema-migrate.js`, `gleif-build-local.js`, `gleif-resolve.js`, `src/firds.js` (lines 150–170).

---

## 1. Problem statement

Meridian Atlas shows missing entity identity data (LEI, parents, names, countries) as one undifferentiated gap. The Founder and the product can't tell whether a gap means "this company has no LEI", "GLEIF declares no parent", "we dropped it", or "a job isn't doing its work". MA-OCT-000 proved the last case is real and hidden: the enrichment Worker reports success twice a day while 26,537 queue rows have never been attempted. Only 16,557 of 43,785 entities (37.8%) have an LEI, and effectively no entity has a real `legal_parent` edge. Until the four causes are separated and counted, any remediation (including MA-OCT-011's offline Level 2 backfill) is a guess about where the write budget should go.

## 2. Goals

1. **Classify every identity gap** in `entity_master` (43,785 entities) into exactly one of the four categories, (a)–(d), with the rule and evidence that placed it there. Wrong-value findings (e.g. KI 22.9) go to a separate **W (integrity)** bucket.
2. **Confirm or refute 13 pre-registered hypotheses** (§4) about why the GLEIF jobs run without making progress. Each gets a verdict backed by evidence.
3. **Measure completeness** by field, entity type, country, source and LEI status, both as raw fill rate and as **achievable** fill rate (what GLEIF actually has).
4. **Deliver a ranked root-cause × remediation matrix** and a **go/no-go on MA-OCT-011**, by 14 Oct.
5. **Stay inside a declared read budget** (§6.3) with zero D1 writes and at most 60 GLEIF API calls.

## 3. Non-goals

| Non-goal | Why |
|---|---|
| Any remediation, including hotfixes, backfills, queue resets and exception writes | Scope v2: "no broad backfill in the investigation packet". Fixes go into separate packets (§9, Q3). |
| Fixing F6 (wrangler OAuth under launchd) or F7 (blind write guard) | Assigned to MA-OCT-002 by the Architect review (finding 6). 006 only reports their GLEIF impact. |
| Re-enabling `entities-delta` or changing any cron | Cron changes need the three-point check and a CR. 006 assesses readiness only (H10). |
| Building Ops heartbeat wiring | Belongs to MA-OCT-001/002. §8 is a dependency note. |
| Resolving KI 22.17 (`entity_isin_map` duplicates) and 22.16 (European legal forms) | Out of scope. 22.16 is measured only for its effect on (c). 22.17 stays on HOLD. |

## 4. What the code already shows (pre-registered hypotheses)

The brief asked for the F4 hypothesis to be tested by code reading first. **It is confirmed, and the code reading found more.** Everything below is from source only. The investigation must confirm each item with runtime evidence before it goes into the matrix.

### 4.1 Who consumes the queue, and who doesn't

| Phase (cron) | Selects from | Selection rule (abridged) | Marks progress? |
|---|---|---|---|
| **Phase 1** (06:00 UTC) | `entity_enrichment_queue` | `type_hint='operating' AND isin_hint IS NULL AND status IN ('pending','failed') AND retry_after due`, `LIMIT 100`, **no ORDER BY** | Only on a hit (sets `isin_hint`, `lookup_method='isin'`). **A miss writes nothing: no `last_attempt`, no status change.** |
| **Phase 2** (06:50 UTC and boost) | queue ⋈ `entity_master` | `isin_hint` set, `em.lei IS NULL`, `em.type!='fund'`, **`eq.status='pending'` only**, `LIMIT 45` | Yes (`in_progress` → `complete` or `failed` + `retry_after`). |
| **Phase 3** (06:50 UTC and boost) | **`entity_master` only** | `lei IS NOT NULL AND type!='fund' AND (lei_status IS NULL OR all three parent fields NULL)`, `LIMIT 45`, **no ORDER BY** | Only on success paths. **Errors are caught and logged with no marker.** |
| `entities-seed` Step 4 (weekly) | writes the queue | every `lei IS NULL`, non-fund entity not already queued → `lookup_method='name_search'`, `type_hint = em.type`, `isin_hint = NULL` | — |

### 4.2 Hypotheses

| ID | Hypothesis | Code evidence | Class | Expected effect |
|---|---|---|---|---|
| **H1** | **F4 CONFIRMED (code):** Phase 3 selects from `entity_master`, not the queue. **No code anywhere performs a GLEIF name search**, so `lookup_method='name_search'` has no consumer. The queue is orphaned for GLEIF purposes. | `entities-enrich.js:275-289`. Repo-wide grep for `name_search` finds only the seed insert and the schema CHECK. | d | ~26,373 `name_search` pending rows can never reach GLEIF. |
| H2 | Phase 1 has head-of-line blocking. With no ORDER BY and no miss marker, the same ≤100 rows are re-selected every run. Its exact-match test is `UPPER(TRIM(security_name)) = UPPER(TRIM(name))`, but the seed stored `stripBondDetail(security_name)`, so stripped names can't match their own source row. | `:94-129`; `entities-seed.js:117-125, 371` | d / c | Phase 1 converts ~0 rows per run after its first pass. Also, "never attempted" in F4 is unreliable, because Phase 1 misses leave no trace. |
| H3 | Phase 2 has been dead since 31 Aug. `failed` rows are never re-selected: Phase 2 needs `status='pending'`, and Phase 1 needs `isin_hint IS NULL`. The 164 `pending/isin` rows fail the join (entity already has an LEI, is a fund, or is a merge orphan: known orphans 408 and 3205). | `:140-151` | d | 956 "retry-due" `failed` rows are permanently stuck. `retry_after` is meaningless for them. |
| **H4** | Phase 3 has head-of-line blocking. It uses index order (`idx_entity_master_phase3`, by `lei`) with no ORDER BY, and a failed GLEIF fetch throws into a catch that writes nothing. If the first 45 candidates fail (HTTP 404/4xx, malformed or retired LEI), they are selected again every run. **The persisted counters fit this exactly:** 44 entities, 44 subrequests, 1 deferred means exactly one fetch per entity, so no relationship follow-ups at all. | `:296-305, 310-313, 467-469`; Close-out §7 | d | The "44 per run" is the same 44 entities every day, with zero net progress. **Alternative:** all 44 have no direct-parent link, so an exception is written and the pool shrinks by ~44 per run. The investigation must tell these apart (T4). |
| H5 | Phase 3 also writes no marker when a direct-parent link exists but the follow-up fetch fails (`relResp !ok → continue`), so the entity loops. | `:392-400, 457-465` | d | Adds to H4. |
| H6 | Only `direct_parent_exception` is ever written, and always as the generic `'NO_LINK_DECLARED'`. The reason (NATURAL_PERSONS, NON_CONSOLIDATING, NO_LEI, …) is discarded. `ultimate_parent_exception` exists (`gleif-schema-migrate.js`) but **no Worker writes it**. | `:373-375, 458-465` | b vs c (unresolvable in D1) | D1 alone can't separate (b) from (c) for parents. Source reconciliation is mandatory. |
| H7 | Parent creation `ON CONFLICT(normalized_name, type) DO UPDATE SET lei = excluded.lei` can **overwrite the LEI of a different `holding` entity** that shares a normalized name. | `:414-420`; same in `entities-delta.js:249-255` | **W** | Some `holding` rows may carry an LEI whose GLEIF legal name doesn't match them. |
| H8 | The queue is never reconciled. Rows stay `pending` after the entity gets an LEI another way (FIRDS, the June bulk load, merges), and merge migrations repoint or delete rows only for the merge map. | seed Step 4; `ma-sep-00*-merge-migration.sql` | d (stale) | Part of the 26,537 is already resolved or orphaned. |
| H9 | Seed Step 4 is skipped whenever Step 3 hits the write checkpoint (the F2/F3 Sunday co-fire), leaving new entities unqueued. Step 4 also copies `type_hint = em.type`, so Phase 1 ignores every `government`, `holding`, `spv` and `manager` row. | `entities-seed.js:414-463` | d | Unqueued entities, and non-operating types with no path at all. |
| H10 | `entities-delta` isn't safe to unfreeze as written: `/run` is unauthenticated (same class as 22.13/22.18); there is no write-budget guard; `DELTA_URL` targets `leilookup.gleif.org/api/v2/filedownload/…`, which must be verified to return raw CSV (the parser can't read a zip); it writes one `delta_inactive_<LEI>` key per lapsed LEI into ETF-domain `holdings_pipeline_state` (a cross-domain write with unbounded key growth); and `refreshParentExceptions()` still has MA-SEP-009 Bug 2 (`directParentRel.data`) and isn't reachable from `/run`. | `entities-delta.js` throughout | d (frozen) | Level 1 fields (`entity_status`, registration status, renewal) are frozen at the 14 Jun Golden Copy load. |
| H11 | F6: the boost job fails on wrangler `Authentication error [code: 10000]`. **The log shows this now also happens on mornings** (21 and 24 Sep). When it does fire, `writes_today` reads 0 (F7). And even a good fire only re-runs Phase 2+3, which adds nothing if H3 and H4 hold. | `logs/entities-enrich-boost.log` (16–25 Sep) | d | Boost adds no net progress. |
| H12 | The June bulk-load resolver (`gleif-build-local.js`, `gleif-resolve.js`) uses the **pre-MA-SEP-001 `normalizeName` order** (suffix stripped before punctuation), so dotted suffixes like `N.V.` and `S.A.` missed matches. Combined with KI 22.16 (no European legal forms), this is a likely source of (c) among the no-LEI entities. | `gleif-build-local.js:13-20` vs `entities-seed.js:106-115` | c | Recoverable LEIs among the 27,228 no-LEI entities. |
| H13 | Phase 1's lookup on `fund_holdings_monthly` wraps `security_name` in functions, so a plain index can't serve it. That could mean up to 100 full scans of the largest ETF table per run. But the 23 Sep D1 total (95k reads) argues against it, so either Phase 1 selects few rows or an expression index exists. | `:111-116` | three-point check | Resolve with EXPLAIN only (0 reads). |

**Also noted, not a hypothesis:** entity jobs write their run state (`enrich_phase3_*`, `delta_*`) into ETF-domain `holdings_pipeline_state`. This is an existing cross-domain write. It is recorded for MA-OCT-001/002 (where job state belongs in `ops_job_run`), not fixed here.

## 5. The four-way classification

### 5.1 Unit of classification

The unit is an **(entity, field) gap**. Fields: `lei`, `direct_parent_lei`, `ultimate_parent_lei`, `name`, `country`. Each gap gets exactly one category. An entity's **headline category** is the category of its highest-priority gap (`lei` > `direct_parent_lei` > `ultimate_parent_lei` > `country` > `name`). Entities with `type='fund'` are reported separately: they are out of GLEIF enrichment by design (fund-manager relationships come from `etf_universe`).

**Gap definitions:**

- `lei`: NULL, or fails format (`LENGTH≠20` or not `^[A-Z0-9]{18}[0-9]{2}$`). A malformed LEI counts as a gap *and* a W finding.
- `name`: empty, or equal to its own LEI (the KI 22.24 placeholder).
- `country`: NULL, or not a valid ISO-3166 alpha-2 code.
- Parent fields: a gap is only assessed for entities with a valid LEI.

### 5.2 Decision rules (applied in order; first match wins)

Evidence sources: **GC** = GLEIF Golden Copy Level 1 (LEI-CDF), **RR** = Level 2 Relationship Records, **RX** = Level 2 Reporting Exceptions, all from the same 1 Oct publication; **D1X** = the D1 exports (§6.2); **CODE** = the §4 code paths.

| Step | Test | Category |
|---|---|---|
| 1 | GLEIF holds the missing value. For `lei`: a **reliable match** (§5.3) exists in GC. For a parent: RR has an ACTIVE `IS_DIRECTLY_CONSOLIDATED_BY` / `IS_ULTIMATELY_CONSOLIDATED_BY` for the child's LEI. For name or country: GC has it for the entity's LEI. | go to 2 |
| 1′ | GLEIF has no value. RX declares an exception for this child and relationship type (any reason), **or** GC shows the entity is its own ultimate parent, **or** the entity type is structurally LEI-less (e.g. `government` with no GC match), **or** GC and D1 agree the LEI is LAPSED/RETIRED/MERGED and the field is legitimately empty | **(b) legitimate absence / reporting exception** |
| 1″ | No GC record and no reliable match. Zero candidates, or ambiguity that can't be resolved (§5.3 tier T3/none), including non-entity strings from holdings names (cash lines, derivatives, bond residue) | **(a) no reliable LEI match** |
| 2 | GLEIF has it. Is the entity sitting in a pipeline path that should deliver it but isn't progressing? Any of: queue row `pending`/`in_progress`/`failed` with no consumer that can act on it (H1, H3); in Phase 1's or Phase 3's non-progressing head set (H2, H4, H5); eligible for Step 4 but unqueued because the step was skipped (H9); Level 1 value stale because `entities-delta` never ran (H10) | **(d) queued, but job frozen, late, stalled or failing** |
| 3 | GLEIF has it and no stalled path explains the gap. The pipeline processed and dropped it, or it has no path by design. Examples: `NO_LINK_DECLARED` written but RR has a parent (H6); a reliable match missed by normalization (H12, KI 22.16); an edge in `entity_relationships` with the mirror field NULL; an LEI in `entity_isin_map`/FIRDS but not on `entity_master`; excluded by a `type_hint` rule (H9) | **(c) in GLEIF, omitted by Meridian at ingestion or mapping** |
| — | Any value **present but wrong**: LEI whose GC legal name doesn't reliably match (H7); edges contradicted by RR (KI 22.9); LEI failing format | **W (integrity)**: outside the four-way count, reported alongside it |

Each classified gap records: `rule_step`, `evidence_ref` (GC/RR/RX record id, D1X row, H-id) and `confidence` (high/medium).

### 5.3 What "reliable LEI match" means

Matching runs locally against GC legal names and other names, using **`entities-seed.js`'s current `normalizeName()`** (the fixed order), plus a 22.16 extension evaluated *separately*, so its effect can be counted.

| Tier | Rule | Reliable? |
|---|---|---|
| T1 | Exact normalized legal name, **unique** in GC, and country agrees (D1 `country` or `legal_address_country`) | Yes |
| T2 | Exact normalized legal or other name, unique, country NULL or disagreeing, **and** corroborated by ISIN (an `instrument_entity_map` ISIN appears in GLEIF's LEI–ISIN file for that LEI) | Yes |
| T3 | Unique token-sort similarity ≥ 0.92, or exact but non-unique | No: counted as (a), flagged as "recoverable with review" |
| none | No candidate | (a) |

The stratified sample (§6.4) measures T1 and T2 precision. **If sampled precision is below 98%, T2 is downgraded to "not reliable"** and the counts are recomputed.

## 6. Evidence plan

### 6.1 Where it runs

**Local Claude Code on the Founder's Mac**, started from `Meridian Atlas Clean (v11)` on `October-2026`. Cowork can't reach GLEIF or Cloudflare. D1 access uses `wrangler d1 execute meridian-etf --remote` in an interactive session (not launchd, which avoids F6).

**Preflight, day 1:**

- `pwd` and branch check.
- `ls .git/*.lock` (rule 6).
- `npx wrangler whoami` plus one catalog read.
- Free disk ≥ 25 GB. 83 GB is free today.

GLEIF files go in a **work folder outside the repo**, `~/Desktop/MeridianAtlas/gleif-work-006/`. `.gitignore` does not cover `App/Corporate Atlas/*.db|*.csv`, so keeping them outside prevents an accidental `git add`. The June files (`gleif_local.db`, the Golden Copy CSV, the LEI–ISIN CSV) are **no longer on disk**, so they must be downloaded fresh.

### 6.2 D1 query ledger (every query gets `EXPLAIN QUERY PLAN` first; stop if the plan differs from "expected")

All exports use **keyset pagination on `rowid`/INTEGER PRIMARY KEY in chunks of ≤ 5,000 rows**. No single execution reads more than 50k rows. The rule "SCAN on `entity_master` means stop" is respected: the expected plan is `SEARCH … USING INTEGER PRIMARY KEY`, never `SCAN`.

| # | Purpose | Query (abridged) | Expected plan | Est. reads |
|---|---|---|---|---|
| D0 | Catalog: tables, indexes and columns for `entity_master`, `entity_enrichment_queue`, `entity_relationships`, `entity_isin_map`, `instrument_entity_map`, `fund_holdings_monthly`, `entity_exceptions` | `SELECT … FROM sqlite_master WHERE tbl_name IN (…)` | catalog | ~150 |
| D1 | Row bounds for chunking | `SELECT MAX(rowid)` per table (5 tables) | `SEARCH … INTEGER PRIMARY KEY` | 5 |
| D2 | **`entity_master` export** (the classification base). Columns: `entity_id, name, normalized_name, type, lei, lei_status, country, legal_address_country, entity_status, lei_registration_status, direct_parent_lei, direct_parent_name, direct_parent_exception, ultimate_parent_lei, ultimate_parent_name, ultimate_parent_exception, match_source, lei_validation_source, created_at, updated_at, gleif_last_updated` | `WHERE entity_id > ? AND entity_id <= ? ` (5k windows) | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` | 43,785 |
| D3 | **Queue export**, all columns | `WHERE entity_id > ? AND entity_id <= ?` | `SEARCH … USING INTEGER PRIMARY KEY` | 28,929 |
| D4 | **`entity_relationships` export** (all types, for the mirror check and KI 22.9) | `WHERE rowid > ? AND rowid <= ?` | `SEARCH … USING INTEGER PRIMARY KEY` | ≤ 40,000 (bounded by D1; stop and re-plan above 50k) |
| D5 | `entity_exceptions` (9 rows: KI 22.9 and 22.17) | full | small-table SCAN (9 rows) | 9 |
| D6 | Phase 3 head set (H4) on **3 days** (2, 3 and 5 Oct), each after the 06:50 cron and before 10:50 boost | the exact Phase 3 SELECT, `LIMIT 45` | `SEARCH USING INDEX idx_entity_master_phase3 (lei>?)` | ≤ 3 × 2,000 |
| D7 | Phase 1 head set (H2) on the same 3 days | the exact Phase 1 SELECT, `LIMIT 100` | `SEARCH USING INDEX idx_enrich_queue_status` | ≤ 3 × 30,000 **worst case**. Run D7 once first; if its reads > 10k, drop days 2–3 and rely on D2/D3 local replay |
| D8 | Run-state keys, daily for 10 days: `enrich_phase3_last_run_*`, `enrich_combined_*`, `delta_*`, `hold_all_jobs`, `writes_today_*` | `WHERE key IN (…)` | `SEARCH … USING INDEX sqlite_autoindex (key=?)` | 10 × 12 |
| D9 | Phase 1 cost check (H13), **EXPLAIN only, not executed** | Phase 1's `fund_holdings_monthly` lookup | expected `SCAN fund_holdings_monthly` unless an expression index exists | **0** |
| D10 | Queue trend re-snapshot (12 Oct) | `GROUP BY status` | `SCAN USING COVERING INDEX idx_enrich_queue_status` | 28,929 |
| D11 | *(conditional, T2 corroboration only)* `instrument_entity_map` export for entities in the sample and the T2 set | `WHERE entity_id IN (…)` in chunks | `SEARCH … USING INDEX` on `entity_id` if D0 shows one; **otherwise skip** and T2 falls back to "not reliable" | ≤ 20,000 |

**Everything else is computed locally** from the D2–D4 exports joined to the GC, RR and RX SQLite. Examples: Phase 2 eligibility of the 164 `pending/isin` rows (H3), queue-to-master orphans (H8), unqueued eligible entities (H9), LEI–name mismatches (H7), the mirror-field check, and all completeness cuts. None of these cost extra D1 reads.

Runtime evidence with **no D1 reads and no GLEIF calls by us:**

- `wrangler tail meridian-entities-enrich` during the **06:50 cron on 2 and 3 Oct**. Capture every `[gleif] phase3 … status=` line and the per-entity error lines. This is the decisive test for H4 and H5.
- `meridian-ops /api/ops/cf/invocations` for seed and enrich, 27 Sep–12 Oct. This also confirms MA-OCT-012's Monday fire.
- The boost log for H11.

### 6.3 Read budget

| Item | Reads |
|---|---|
| D0–D5 (catalog, bounds and exports) | ~113k |
| D6–D8, D10 (runtime tests and trend) | ~40k expected, ~125k if D7 runs 3× at worst case (it won't; see its guard) |
| D11 (conditional) | ≤ 20k |
| **Planned total** | **~175k** |
| **Budget ceiling (proposed)** | **200k.** The executor stops and reports to the Operations Lead at 200k. **Hard stop at 250k** (MA-OCT-000's ceiling). |
| **D1 writes** | **0** |

For scale, 200k is 4% of one day's 5M read cap, spread over 1–12 Oct. No query runs during the Sunday 04:00–07:00 UTC window, or during the Monday 04:00 UTC seed.

### 6.4 Source reconciliation: Golden Copy first, API for freshness only

**Recommendation: the GLEIF Golden Copy files, not the API, for reconciliation.** The API is used only to check that the files are fresh.

| | Golden Copy (recommended) | GLEIF API only |
|---|---|---|
| Coverage | **Whole population:** all 43,785 entities, all RR and RX | A sample only |
| GLEIF load | 3 file downloads | ~3 calls per entity. The API allows about **60 requests/minute** (confirm on day 1), so 400 entities ≈ 1,200 calls |
| Parent absence reasons | RX gives the actual reason (resolves H6) | One more call per entity |
| Precedent | June run (`gleif-build-local.js` → local SQLite) | MA-SEP-009/010 live path |

**Files** (1 Oct publication, from `goldencopy.gleif.org`): LEI2 Level 1 CSV (~4–5 GB unzipped), RR Level 2 CSV, RX Level 2 CSV, and the LEI–ISIN mapping file. They load into `gleif-work-006/gleif_006.db` with a new loader. The June loader can be reused **only** with `normalizeName` swapped for the current `entities-seed.js` export (H12).

**Freshness check:** 50 LEIs drawn from the sample, one `lei-records/{lei}` call each, throttled to ≤ 1/second. Total **≤ 60 GLEIF API calls** for the packet, including retries. Pass condition: ≥ 98% of the Golden Copy snapshot agrees with the API on status and parents.

**Stratified sample, for manual adjudication and to measure T1/T2 precision:** **n = 400 entities**, drawn with a fixed seed recorded in the evidence file.

- Strata (the four the brief names):
  1. **LEI status:** valid LEI / no LEI / malformed.
  2. **Entity type:** operating / government / holding / manager / spv.
  3. **Country:** US / EU+UK / other / NULL.
  4. **Source (derived):**
     - GLEIF bulk (`match_source` not NULL);
     - FIRDS (`name = lei` history or FIRDS LEI);
     - enrich-parent (`type='holding'` created by Phase 3);
     - holdings-seed (everything else).
- Allocation: at least 15 entities per non-empty type × LEI-status cell. The rest is proportional to cell size.
- **Adjudication:** the executor reviews each sampled entity against GC, RR and RX, records the category it truly belongs in, and compares that with the rule engine's category. **Pass: rule-engine agreement ≥ 95% overall and ≥ 90% in every cell with n ≥ 15.** Below that, the rules are revised and re-run once, then reported whatever the result.

## 7. Specific checks the brief requires

### 7.1 Completeness measures

Each measure is reported as **raw fill rate** (filled ÷ all in scope) and **achievable fill rate** (filled ÷ (filled + (c) + (d))). The gap between them is what remediation can win back.

| Field | In-scope denominator | Cuts |
|---|---|---|
| `lei` (valid format) | non-fund entities | type × country bucket × source × (queue status) |
| `direct_parent_lei` | entities with a valid LEI | type × country × source × `lei_status` / `entity_status` |
| `ultimate_parent_lei` | entities with a valid LEI | same |
| `name` (not placeholder) | all | source |
| `country` (valid ISO-2) | all | type × source |

Baseline to reproduce first: 16,557 / 43,785 = 37.8% LEI. If D2 doesn't reproduce this within ±0.5%, stop and reconcile before classifying.

### 7.2 Relationship check (before any parent is called "missing")

For each LEI-bearing entity, in order:

1. Is there an ACTIVE RR relationship for this child and type? If not, go to step 2.
2. Is there an RX exception? Record its reason, e.g. `NON_CONSOLIDATING`, `NATURAL_PERSONS`, `NO_KNOWN_PERSON`, `NO_LEI` (parent exists without an LEI), `BINDING_LEGAL_COMMITMENTS`, `LEGAL_OBSTACLES`, `DISCLOSURE_DETRIMENTAL`, `CONSENT_NOT_OBTAINED`, `DETRIMENT_NOT_EXCLUDED`. That makes the gap **(b)**.
3. Does Meridian have an `entity_relationships` `legal_parent` edge? Check the mirror fields agree. An edge with a NULL mirror, or the reverse, is **(c)**.
4. Is the parent LEI in `entity_master`? If yes, does its GC name reliably match that row (H7)? If not, it's **W**.
5. Only an RR parent that Meridian lacks and isn't explained by (d) counts as **(c) missing parent**.

**KI 22.9, reported as its own item:** the 4 known-bad edges (parent/child 1565/3, 2247/143, 2476/49, 6980/194) are checked against RR, where the expected result is no such relationship. They are also checked against the `entity_exceptions` rows, and against whether the child now has a GC match. They go in the matrix as a **W** row with the MA-SEP-001 merge as root cause. They are **not** part of the MA-OCT-011 coverage count, and their fix route is a data-quality ticket (003/004), not a backfill.

### 7.3 MA-SEP-017 residual (Architect ruling 2)

**Recommendation: (ii), in its zero-cost form. Answer it from the D2 export, then close it. Reject (i).**

- **How:** D2 already carries `created_at` and `updated_at` for every row. Locally, count the rows whose `updated_at` falls on Sun 13 and Sun 20 Sep between 04:00 and 07:00 UTC, split by `created_at` on the same date (new) or earlier (touched). Compare with the pre-fix baseline of 29,839 touched rows on 6 Sep.
- **What the fix predicts:** touched-not-new should be close to 0, plus the Phase 3 and Phase 2 writes that legitimately stamp `updated_at`. Those are separable by `lei_status` and parent-field changes.
- **Bonus check:** the export runs on 2 Oct, after MA-OCT-012's first **Monday** seed fire (28 Sep, via the real `scheduled()` path). So the same count for 28 Sep verifies the fix on the cron path the September test couldn't reach.
- **Why not (i):** a new `updated_at` index costs about 43.8k reads to build and ~43.8k writes on creation. After that, it adds one written row to every `entity_master` UPDATE that sets `updated_at`, which is every enrich, seed and delta update. At today's volume that's hundreds a day, but it would be **tens of thousands per delta month** if H10 is fixed and delta goes live. All of that is to answer a one-time question that an export answers for free.
- **Why not (iii):** the fix still lacks a clean full-run confirmation (Sprint Board MA-SEP-017). Closing it as "superseded" would lose that fact rather than prove it.
- **Result:** MA-SEP-017 closes with a number in 006's close-out.

## 8. Ops feed: dependency note for MA-OCT-001/002 (not a build)

006 hands the Ops control plane the following, **expressed against the 001 heartbeat contract** (events `start`, `success`, `partial`, `skipped`, `failed`, `killed`; payload with duration, reads/writes, cursor, error summary; idempotent; fire-and-forget).

### 8.1 GLEIF jobs that must be in the registry (MA-OCT-002)

| Job | Mode | Domain / owner | Notes for registry |
|---|---|---|---|
| `meridian-entities-seed` | cron, Mon 04:00 UTC (after MA-OCT-012) | Entities / Data-Identity | Emits one run for Steps 1–4. Step 4 skipped must show as `partial`. |
| `meridian-entities-enrich` Phase 1 | cron 06:00 UTC | Entities | A **separate logical job** from Phase 2+3: the dispatch is on minute, and the phases have different inputs. |
| `meridian-entities-enrich` Phase 2+3 | cron 06:50 UTC and `/run` | Entities | — |
| `entities-enrich-boost` | LaunchAgent 11:50 and 17:50 local | Entities / Ops (runner) | A pre-flight auth failure is `failed` (error class `wrangler_auth_10000`), not silence. |
| `meridian-entities-delta` | held (no cron) | Entities | Registry state `frozen`, reason "held; H10 blockers". Never "late". |
| `meridian-entities-figi` | on-request | Entities | — |
| `firds-weekly-seed` | LaunchAgent Sun | Entities | Writes LEIs to `entity_master` (an input to the classification). |
| *(future)* MA-OCT-011 offline loader | manual | Entities | Registered **before** it runs, if 011 is GO. |

### 8.2 What the contract must be able to carry (requirements on 001)

1. **A first-class `progress_count`** (rows whose state actually advanced), separate from `attempted`. F4 is the case of "`success` with zero progress". The Ops sweep must detect it without parsing free text.
2. **Bounded job-specific metrics** (≤ 1 KB JSON), for GLEIF jobs: `selected`, `attempted`, `progressed`, `failed`, `deferred`, `external_calls`, and `external_status` (a count per HTTP class, 2xx/404/4xx/429/5xx).
3. **A per-phase `run_key`** so Phase 1 and Phase 2+3 runs of the same Worker are distinct and idempotent.
4. A **`skipped` reason code** (`hold`, `budget`, `auth`, `out_of_window`), so the boost job's off-window and auth cases are visible.

### 8.3 Exceptions 006 defines for Ops (thresholds; raised by 002's sweep or 003)

| Code | Condition | Severity |
|---|---|---|
| GLEIF-E1 no-progress | ≥ 2 consecutive `success` runs of a phase with `progress_count = 0` while its input backlog > 0 | High |
| GLEIF-E2 stuck in-progress | any queue row `in_progress` for > 24 h (1 row since 2026-06-11 today) | Medium |
| GLEIF-E3 orphaned backlog | queue rows whose `lookup_method` has no registered consumer (H1) | High |
| GLEIF-E4 frozen source | a held GLEIF job whose data it maintains is > 35 days stale (delta: never run) | Medium |
| GLEIF-E5 local auth failure | a local runner reports `wrangler_auth_10000` on ≥ 2 consecutive fires | Medium |
| GLEIF-E6 blind guard | a write guard ran with no `writes_today_<date>` key present (F7) | Low (informational until 002 fixes F7) |

### 8.4 Data-quality tickets

A missing or incorrect LEI is a DQ ticket (Scope v2). 006 recommends **one aggregate ticket per root cause** (the matrix rows), with the per-entity list attached as evidence. It **does not** recommend one ticket per entity. Per-entity tickets would be ~27k writes and would swamp the queue that 004 is building. Per-entity rows can be created later by 011 or 004 from the evidence file, if wanted.

## 9. Deliverables and format

All go in `claude/`, and are committed later by the next executing lane (rule 7):

1. **`MA-OCT-006_Closeout_Summary.md`:** H1–H13 verdicts with evidence, the classification totals, completeness tables, the relationship check, KI 22.9, the MA-SEP-017 residual number, and the query ledger (plan, reads and writes per query).
2. **`MA-OCT-006_Remediation_Matrix.md`:** the ranked matrix (below).
3. **`MA-OCT-006_classification.csv`:** one row per (entity, field) gap: `entity_id, field, category, rule_step, evidence_ref, confidence, h_ids`. This is **evidence, not a D1 load file**.
4. **`MA-OCT-006_sample_adjudication.csv`:** 400 rows, rule-engine vs adjudicated category.

### 9.1 Matrix columns

| Rank | RC-id | Root cause | Category (a–d, W) | Affected (entities / field-gaps) | Evidence (query ids, H-ids, file refs) | Proposed fix and packet | Owner (Addendum §2 role) | D1 write cost (rows, one-time + recurring) | Risk (data, budget, cron, domain) | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|

**Ranking rule:** rank by **recoverable field-gaps × confidence** (high = 1.0, medium = 0.6), descending. Ties break on lower write cost, then lower risk. (a) and (b) rows are included for completeness, but their "fix" is usually "label it in the product" and they rank on product impact, not recoverable count. Every write cost is estimated in D1 rows written, including index writes (one extra row per indexed column changed).

### 9.2 Go/no-go criteria for MA-OCT-011 (offline Level 2 backfill)

**GO only if all of these hold:**

1. **Enough to recover:** ≥ 1,000 (c)+(d) parent gaps (direct or ultimate) that RR can fill, or ≥ 10% of LEI-bearing entities, whichever is smaller.
2. **Live path can't clear them:** fixing H4/H5 alone would not clear them within 4 weeks at the current cadence (2 cron + 2 boost runs a day × ≤ 45 entities).
3. **Identity is reliable:** the W rate among LEI-bearing entities in the sample is ≤ 2%, and H7 overwrites are counted and excluded from the backfill set.
4. **Write budget:** projected writes ≤ 60k in total, with ≤ 20k per day, never on a Sunday or Monday before 08:00 UTC. It must use `db.batch()` with `INSERT OR IGNORE` / content-diff guarded `UPDATE`, and be resumable by cursor.
5. **Separation:** KI 22.9's 4 edges are excluded and routed to 003/004. The writer touches **only** Entities-domain tables (`entity_relationships`, `entity_master` parent fields).
6. **Observability:** the loader can emit 001 heartbeats, or a manual run ledger is agreed with the Operations Lead if 001 isn't live.
7. **Credentials:** no token literals (F1 lesson). It uses the wrangler session or a scoped secret.

**NO-GO if any of these is true:** criterion 1 fails; the gaps are mainly (a) or (b); the W rate is > 2%; or the H4/H5 fix alone clears the backlog in ≤ 4 weeks. **DEFER** (re-assess in November) if 1–3 pass but 4 or 6 can't be met in October.

## 10. Acceptance criteria

- [ ] All 43,785 `entity_master` rows (or the D2 count, reconciled with the baseline to within ±0.5%) have every in-scope gap classified into (a), (b), (c) or (d), or excluded as fund, with W findings listed separately. **Zero unclassified gaps.**
- [ ] H1–H13 each have a verdict (confirmed / refuted / inconclusive) with a cited evidence line. H4 is settled by the 2 and 3 Oct `wrangler tail` evidence plus D6.
- [ ] The F4 numbers are explained: each of the 26,537 pending rows, the 1 `in_progress` row and the 956 due `failed` rows is attributed to a cause (H1/H2/H3/H8/H9).
- [ ] F6 and F10 impacts are stated in GLEIF terms: lost runs and stale Level 1 fields.
- [ ] Completeness tables show raw and achievable fill for all 5 fields across all 4 cuts.
- [ ] The relationship check is done for every LEI-bearing entity. KI 22.9 is reported as a separate W row.
- [ ] The MA-SEP-017 residual has a number for 13 Sep, 20 Sep and 28 Sep, and a close recommendation.
- [ ] Sample adjudication meets the pass thresholds in §6.4, or the failure is reported with revised rules.
- [ ] The Golden Copy freshness check is ≥ 98% agreement, using ≤ 60 GLEIF API calls.
- [ ] The query ledger shows an EXPLAIN plan for every query, **no `SCAN entity_master`**, no single execution over 50k reads, total ≤ 200k (or an Ops-approved extension, never > 250k), and **0 D1 writes**.
- [ ] The matrix is ranked by the §9.1 rule, has every column filled, and states the 011 decision against every criterion in §9.2.
- [ ] No files are written outside `claude/MA-OCT-006_*` and the out-of-repo work folder. No git writes.

## 11. Timeline (1–14 Oct)

| Date | Work | Output |
|---|---|---|
| Thu 1 Oct | Preflight; download the Golden Copy (L1, RR, RX, LEI–ISIN) and build `gleif_006.db`; D0, D1 and D9 (EXPLAIN only) | Plans recorded |
| Fri 2 Oct | D2–D5 exports (~113k reads); first D6/D7/D8 before boost; **`wrangler tail` the 06:50 cron** | Exports and tail capture |
| Sat 3 – Mon 5 Oct | Second `tail` (3 Oct); D6/D7 on 3 and 5 Oct; H1–H13 verdicts by local replay | Hypothesis verdicts. **If H4 is confirmed, the Main Lane is told on 5 Oct** (Q3). |
| Tue 6 – Thu 8 Oct | Classification engine over the full population; sample drawn and adjudicated; API freshness check | Classification CSV and adjudication CSV |
| Fri 9 Oct | Completeness cuts; relationship check; KI 22.9; MA-SEP-017 residual. **Weekly status input** | Interim findings to the Main Lane |
| Sat 10 – Mon 12 Oct | D10 trend snapshot; matrix draft; write-cost estimates; 011 criteria assessment | Matrix draft |
| Tue 13 Oct | Operations Lead review (Addendum §3 reviewer block) | Verdict |
| Wed 14 Oct | Founder gate: 006 close and **011 go/no-go** | Decision |

**Dependencies:**

- MA-OCT-012 Part 2 (Monday 28 Sep fire observed) should be closed before 2 Oct, so D2 captures a post-fix seed run.
- MA-OCT-001's heartbeat contract spec (target 29 Sep) is where §8.2 needs to land.
- If 001 doesn't adopt `progress_count` or metrics, §8.3's E1 has no data source, and the Operations Lead should be told before 001's build approval.

## 12. Open questions for the Founder (3)

| # | Question | Recommended answer | Blocking? |
|---|---|---|---|
| Q1 | May 006 download the full GLEIF Golden Copy (Level 1, RR, RX and LEI–ISIN; ~6–8 GB) to a work folder outside the repo, and use at most 60 GLEIF API calls only to check freshness? | **Yes.** It is the only way to classify the whole population and to read parent-exception reasons (H6). It has precedent (the June run), and it puts zero load on the live API path. | Yes, by 1 Oct |
| Q2 | For the MA-SEP-017 residual, do you accept answering it from 006's export and then closing it, instead of a CR for an `updated_at` index? | **Yes (option ii, zero-cost form).** No extra reads, it also verifies the fix on the real Monday cron path, and it avoids a permanent write surcharge on every `entity_master` update. | No |
| Q3 | If code-confirmed stalls (H4/H5 in Phase 3, H2 in Phase 1) are proven by ~5 Oct, may the Main Lane open a **narrow, separate hotfix packet** (like MA-OCT-012) before 006 closes? It would add a failure marker and a deterministic order, with no backfill. | **Yes, for H4/H5 only.** It is the cheapest fix, and every day it waits the Worker makes no progress. It still goes through Architect and Operations Lead review. Everything else waits for the 14 Oct matrix. | No |

---

*Spec lane record: files written by this lane: `claude/MA-OCT-006_Spec.md` only. D1 queries: 0. GLEIF calls: 0. Git: read-only (`--no-optional-locks`), no lock files found, HEAD `5405e3e` on `October-2026`.*
