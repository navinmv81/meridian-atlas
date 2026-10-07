# MA-OCT-006 — Evidence Record

Executor: Data-Identity Lead (local Claude Code, `Meridian Atlas Clean (v11)`, branch `October-2026`).

## 1. Day-1 preflight (Mon 28 Sep 2026, 19:23 UTC)

| # | Check | Result |
|---|---|---|
| 1 | `pwd`, branch, HEAD | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `October-2026`, HEAD `fa9c7234a284df13b2ffcbe42be9aad8fa5ff4b1` (= `fa9c723`). **PASS** |
| 2 | `ls .git/*.lock` | no matches. **PASS** |
| 3 | `npx wrangler whoami`, interactive | authenticated via OAuth; scopes include `d1 (write)` and `workers_tail (read)`. **PASS** |
| 4a | Free disk ≥ 25 GB | 84 GiB free on `/System/Volumes/Data` before the download; about 7 GB used by the work folder after the load. **PASS** |
| 4b | Work folder not iCloud-synced (N-1) | See §2. **PASS** |
| 5 | Hashes | Build Brief `9522a006…b11e9`, Spec `1dab3539…b7273`, Spec Review `6ae65d79…06` all match the Main Lane's values. **PASS** |
| 6 | After 07:30 UTC | Started 19:23 UTC. **PASS** |

## 2. iCloud check (condition N-1)

- **Work folder:** `/Users/navinkumar/MeridianAtlas-work/gleif-006/`. It is a new directory directly under `$HOME`. It is not under `~/Desktop`, `~/Documents`, `~/Library/Mobile Documents` (iCloud Drive) or `~/Library/CloudStorage` (OneDrive-Personal).
- `ls -la ~/Library/Mobile\ Documents/` returned `Operation not permitted`, and `brctl status` returned `Access denied` (BRCloudDocsErrorDomain 141). Both are **TCC denials to this terminal session**. They are not evidence either way.
- **Positive evidence instead:**
  - iCloud's "Desktop & Documents" sync covers only `~/Desktop` and `~/Documents`.
  - `~/Desktop` is a real directory, not a symlink into Mobile Documents, and has no iCloud xattr.
  - The only cloud-storage provider in `~/Library/CloudStorage` is `OneDrive-Personal`, whose sync root is that folder.
  - The work folder is outside all of these, so **no sync provider covers it.**
- **Residual:** if the Founder wants belt-and-braces, System Settings → Apple ID → iCloud → iCloud Drive → "Desktop & Documents Folders" shows the setting directly. It doesn't change the conclusion for this path.

## 3. GLEIF source files (Amendment E1)

- **Golden Copy publication used:** **2026-09-28 16:00:00 UTC**, the latest available at download time. Response header `x-gleif-publish-date: 2026-09-28T16:00:00+00:00` from `goldencopy.gleif.org/api/v2/golden-copies/publishes/latest`. The files were downloaded at 19:24 UTC.
- **LEI–ISIN deviation from E1 ("same publication"):** the LEI–ISIN mapping is **not part of the Golden Copy publication**. GLEIF publishes it separately (`mapping.gleif.org`, once a day). The file used is **the same-day file, `isin-lei-20260928T071511.zip`, uploaded 2026-09-28T07:15:11Z**, the latest available. It is only used for T2 ISIN corroboration. A 9-hour skew in ISIN mappings has no material effect on it.
- **File names on disk (corrected per ruling R1):** the file is **`isin-lei-20260928T071511.zip`**, uploaded 2026-09-28T07:15:11Z. That zip contains **`lei-isin-20260928T071511.csv`**, and GLEIF's own naming reverses the word order inside the zip. Both are the actual on-disk names, in `WORK/gc/`. The table below uses the zip name and the CSV name in their own columns.

| File | Records | Zip SHA-256 | Unzipped CSV SHA-256 | CSV size |
|---|---|---|---|---|
| LEI2 Level 1 `20260928-1600-gleif-goldencopy-lei2-golden-copy.csv` | 3,444,580 | `7a72b72b2cb51956bc2008d7bb41c7a15241e1789a08707752ecedcb49a709b1` | `a15e71a863b9b22cfca8dcd6f62eb21fc3b297050ddaac76cfdbbac9cad03321` | 5.00 GB |
| RR Level 2 `20260928-1600-gleif-goldencopy-rr-golden-copy.csv` | 489,184 | `040fe45f2ea49e3b805cbf7271375899b5356dbc243f31a869929717eaee4c21` | `00186e43bcd91d08d456f6dd11c5f8f8ce60471155b8f0377858db727016276d` | 244 MB |
| RX Level 2 `20260928-1600-gleif-goldencopy-repex-golden-copy.csv` | 6,383,042 | `f086de5d97c067be5460697c32ba91ac1911bff90cf215cae78e265bbfcd11e8` | `3ecf1687ecf1332196b095fc26fdb0d57d7b1c29dbdeaa3cf192abb3b01d2073` | 710 MB |
| LEI–ISIN `lei-isin-20260928T071511.csv` | 9,150,433 | `1b4aa25d887e4ae1638aa785f3f246773c9fbb4e2ddb59d5150199008318d44a` | `4039a62e2209164cbb0b8415f3dc83171773c92627df4c37a3a2b0fa3761a9b1` | 311 MB |

The zip byte sizes match the sizes published in the API index exactly (505,825,912 / 24,403,634 / 61,882,677 bytes).

## 4. `gleif_006.db` (local SQLite, work folder)

- Loader `load_gleif_006.py` (work folder) ran in 90 s. The database is 3.69 GB.
- Tables:
  - `gc_lei`: 3,444,580 rows.
  - `gc_name`: 4,100,396 rows (legal, other and transliterated names, each with its normalized form).
  - `rr`: 489,184 rows. Of these, 126,953 are ACTIVE `IS_DIRECTLY_CONSOLIDATED_BY` and 133,143 are ACTIVE `IS_ULTIMATELY_CONSOLIDATED_BY`.
  - `rx`: 6,383,042 rows (3,195,148 direct, 3,187,894 ultimate).
  - `lei_isin`: 9,150,433 rows.
- **Normalization (H12 guard):** names are normalized with a Python port of `entities-seed.js` `normalizeName()` at `fa9c723`, which is the post-MA-SEP-001 order. **Parity test against the Node original: 10,250 names compared, 0 mismatches** (`check_norm_parity.mjs`).

## 5. GLEIF call count (≤ 60 budget)

| Call | Purpose | Count |
|---|---|---|
| `goldencopy.gleif.org/api/v2/golden-copies/publishes/latest` | find the latest publication (E1) | 1 |
| `mapping.gleif.org/api/v2/isin-lei/latest` | find the latest LEI–ISIN file | 1 |
| file downloads (4) | Golden Copy distribution, approved under Q1 | not counted as API calls |
| `api.gleif.org` `lei-records` | freshness check (days 5–7) | 0 so far |

Counted conservatively: **2 of 60 used. 58 remain** for the 50-LEI freshness check and its retries.

## 6. D1

See `claude/MA-OCT-006_Query_Ledger.md`. Day 1: **160 reads, 0 writes.**

## 7. Main Lane and Founder rulings (R1–R4 2026-09-28; R5–R6 recorded 2026-09-30; R7–R10 logged 2026-09-30, recorded 2026-10-01)

| # | Ruling | Effect |
|---|---|---|
| R1 | The same-day LEI–ISIN file (07:15Z, 28 Sep) is **ACCEPTED** as a logged E1 deviation. | Recorded in §3. The file names are corrected there: the zip `isin-lei-20260928T071511.zip` contains `lei-isin-20260928T071511.csv`. |
| R2 | `entity_isin_map` as a T2 ISIN source is **REFUSED**. Every writer (`isin-backfill.js:173-189`, `isin-backfill-step4.js`, `src/firds.js:298-305`, `gleif-seed.js`) sets `entity_id` by looking up `entity_master` on that row's LEI. So the table only covers entities that already have an LEI, and its ISINs come from GLEIF/FIRDS mapping (circular). | D11 stays skipped. T2 = "not reliable". T2 and T3 candidates are reported as (a) "recoverable with review". No effect on the MA-OCT-011 decision. `entity_isin_map` is not queried. |
| R3 | (Founder) **Early CSV cleanup.** N-1 is amended from "delete the unzipped CSVs at close-out" to "delete them once `gleif_006.db` is verified". | Executed on day 2 (see §9). The zips are kept as the rebuild source. |
| R4 | (Founder) **Close-out cleanup**, after the Founder's MA-OCT-011 decision (12 Oct), once the close-out commit is pushed and all SHA-256s are recorded here. **NO-GO:** delete the whole `WORK` folder, and `~/MeridianAtlas-work` if it is then empty. **GO:** delete everything in `WORK` except `gleif_006.db`, and delete `gleif_006.db` at MA-OCT-011's close. Report `du -sh` before and after. | **Owned by the close-out lane.** Not executed on day 2. |
| R5 | (Founder, 2026-09-29) **September carry-over residual** (`seedIssuerEntities` `updated_at` check, handed to 006 by the Sprint Board). MA-SEP-017 is a September item and is already closed. This is **not** a reopening or closing action. | 006's answer to the handed-over residual is the day-2 numbers (§8.4 b). **Mon 28 Sep, the first Monday cron: 2,406 rows touched-not-new, against 27,308 before the fix on Sat 6 Sep (about 91% fewer).** The 13 and 20 Sep zeros are **not** evidence, because later stamps overwrite them. **New October Known Issue** (number to be assigned by the Main Lane): *"entities-seed sticky diff: the `ON CONFLICT … WHERE name IS NOT excluded.name OR country IS NOT excluded.country` guard only sets `updated_at`, so differing rows are re-stamped on every run (about 2.4k rows/week; `entities-seed.js:392-398`)."* Its fix goes into the 006 remediation matrix as a **root cause, not a hotfix** (Q3 = no). |
| R6 | (Main Lane) **Report 2a corrections.** | (a) The missing `writes_today_2026-09-29` key is cited as **Known Issue 22.14** (entities-enrich never increments the counter) **plus F7** (the guard reads a missing key as 0). (b) The `normalized_name` drift (§8.4 a) is logged as a **candidate W (integrity) root cause**: `UNIQUE(normalized_name, type)` is the de-duplication key, so a stale `normalized_name` can let the seed or FIRDS create a duplicate entity. Quantified in §11. (c) The `&amp;` explanation for H2 stays **unconfirmed until D7b** (§11). |
| R7 | **H4 is settled** by the 30 Sep tail plus D6 on 29 and 30 Sep. No further tail captures are needed. | §10 and §13: H4 verdict cites tail 2 and D6-0929/0930/1001. |
| R8 | **D7 is not repeated a third time.** Two byte-identical runs confirm H2. D6 and D8 run once more as a trend point. | Day 4: D6-1001 and D8-1001 only. |
| R9 | **Early 011 scope flag.** The matrix presents two options with write costs: "offline GLEIF reconciliation (Level 1 matching + placeholder hydration + Level 2 parents with reasons, duplicate-aware)" and "Level 2 parent backfill only". It also presents a separate duplicate-merge packet for KI 22.41. The Founder decides on 12 Oct. | Carried into the matrix (Report 4). |
| R10 | **Schedule pull-forward.** Report 2 moves to Thu 1 Oct. Full classification and the 400-entity sample start Fri 2 Oct. The Ops review (Sat 10 Oct) and the Founder gate (Mon 12 Oct) are unchanged. | Day 4 = Report 2. |

**Main Lane log confirmation (30 Sep):**
- R1–R10 are logged.
- Known Issues assigned: **22.40** = entities-seed sticky diff; **22.41** = duplicate twin pairs [W-A]; **22.42** = HTML-escaped names [W-B]; **22.43** = H6 wrong `NO_LINK_DECLARED` markers [W-C].
- The 011 scope flag is noted for the 10 Oct Ops review.

**MA-OCT-001 pilot answer (Main Lane ask, recorded 2026-10-01).** 001 Build Brief SHA-256 `ab5d733d…6fc4`, A1 and A3 read:

> "YES — the Data-Identity Lead accepts the 001 Build Brief A3 pilot change to entities-enrich-boost-run.mjs. H11 (late fires when the Mac sleeps; 14 of 29 fires failed wrangler auth 16–30 Sep) strengthens the case for it rather than objecting, with three notes for 001: (1) each event carries the scheduled slot (10:50/16:50 UTC) as well as the actual fire time, so 002 can measure lateness; (2) A1 already defines `skipped` reason `out_of_window` — the pilot mapping should use it for a fire outside minutes :50–:59 (only Phase 1 runs then), not report `success`; (3) already covered by 001 Spec §9 (002 computes lateness against the registry schedule) — restated only so that a fire that never happens (Mac asleep) is caught there, since the pilot cannot emit it. Report 1's note stands: /run returns no counts, so the pilot cannot show F4's zero-progress pattern."

Shortened from the Main Lane wording because A1 already lists `out_of_window` (note 2) and 001 Spec §9 already assigns lateness to 002 (note 3). Note 1 is not covered anywhere in 001.

**Recorded Fri 2 Oct 2026 (day 5):**

| # | Ruling / notice | Effect |
|---|---|---|
| D4-1 | (In-lane ruling, 1 Oct; reported to the Main Lane 1 Oct) GLEIF `DUPLICATE`-status LEIs are **excluded from T1**. A DUPLICATE registration is not the entity's valid LEI. | 9 rows leave T1 (§12.1). Applied in the day-5 classification (§14). |
| P-ACK | **MA-OCT-001 pilot ACK**, sent 2026-10-01 18:41 UTC: **ACK WITH CONDITIONS.** (1) Boost-log lines stay byte-identical in format and outcome values, and are written before the heartbeat. (2) Heartbeat output goes to a separate log. (3) The pause flag is checked first; the heartbeat never changes the exit code or `/run`. (4) The go-live SHA and time are recorded. (5) Non-blocking notes on scheduled slot / `out_of_window` / missed fires. | Checked by Step 7 (§14.8). |
| ML-1 | (Main Lane notice, 1 Oct) The pilot runner went live **2026-10-01 19:08:13 UTC** (commit `da38cf5`). First pilot run 2 Oct 10:50 UTC. Heartbeats go to `CA/logs/entities-enrich-boost-heartbeat.log`. **H11 split time = 2026-10-01 19:08:13 UTC:** boost runs before it are pre-pilot evidence; runs after it are read together with the heartbeat log. | H11 evidence is split at this time. |
| ML-2 | (Main Lane reading of condition (1), **accepted by the Data-Identity Lead on 1 Oct**) `start` is sent concurrently with `/run` after the pre-flight, is never awaited before `/run`, and never touches the boost log. Condition (1) applies to terminal events (`skipped` / `failed` / `success` / `partial`). | The intent holds as long as a hung or failed `start` cannot delay `/run`, change the exit code, or stop the terminal boost-log line from being written. |

**Recorded Fri 2 Oct 2026 (day 6).** D6-1 and D6-2 were issued with the day-6 run instructions (`MA-OCT-006_Day6_Run_Instructions.md`, SHA-256 `c62e718e…8582`). D6-3 to D6-6 are in-lane rulings made today and reported in Report 3b.

| # | Ruling | Effect |
|---|---|---|
| D6-1 | (Data-Identity Lead) **`government` entities are excluded from automated LEI matching (T1 included) and routed to manual review.** The government/no-LEI sample cell scored 20–33% (n = 15). | **T1 drops from 4,115 rows / 3,723 LEIs to 4,109 rows / 3,717 LEIs.** Six sovereign or sub-sovereign rows move to manual review: 103436 Ecuador, 103486 Guatemala, 103492 Colombia, 103501 Kenya, 105461 Newfoundland and Labrador, and 106518 Morocco. All six were RC-1, so RC-1 high falls from 3,861 to 3,855. |
| D6-2 | (Founder, 2 Oct) The remaining close-out work is pulled forward and runs from 2 Oct. Only the D10 snapshot needs a weekday morning. The Ops review (Sat 10 Oct) and the Founder gate (Mon 12 Oct) are unchanged. | Day 6 = Report 3b plus the DRAFT close-out package. |
| D6-3 | (In-lane) **The T1 precision count is corrected to the spec T1 tier only.** §14.6 says "38/38 (spec T1 tier only)", but `day5_adjudicate.py:125` counted `T1` **and** `T1_LAPSED(D5-4)`: 31 T1 plus 7 T1_LAPSED. Under D6-1, one of the 31 (106518 Kingdom of Morocco) is also now excluded. | Strict prior n = 50 (day 4) + 30 − 1 = **79 distinct entities**, not 88. Entity 110291 was checked on both day 4 and day 5, so the recorded 88 also double-counts one row. Top-up of **71** (seed 20261003) gives a strict total of **150/150, lower bound 98.02%**. On the recorded tiers (87 distinct + 71) it is 158/158, lower bound 98.12%. Both bases reach 98% (§15.2). |
| D6-4 | (In-lane) **OPAP Holding SA (2014) is cleared.** It is not a wrong LEI. GC LEI `213800M4NRGFJCI34834` is legally ALLWYN AG (PENDING_TRANSFER), and its GC other name is ORGANISMOS PROGNOSTIKON AGONON PODOSFAIROU AE, which is OPAP S.A.'s full legal name. So this is a rename of the same legal entity. | **Wrong LEIs drop from 25 to 24**, and the population W rate is 24 / 8,342 = 0.29%. `claude/MA-OCT-006_classification.csv` is **not edited** (day-6 rule 3). Its OPAP W row (medium) stands as data, and the matrix uses 24. |
| D6-5 | (In-lane) **4 parent-gap entities carry a wrong LEI** (575 United Community Banks, 1514 Jacobs Solutions, 1809 Old National Bancorp, 1868 Wendy's). Their RR "parent" is the listed company itself, because the row holds its subsidiary's LEI. | They are excluded from any parent backfill (criterion 3). **RR-fillable parent gaps drop from 1,537 to 1,529** (728 direct + 801 ultimate, 812 entities). RC-5 high drops from 1,392 to 1,384. |
| D6-6 | (In-lane) **§9.2 criterion 1 is counted in the spec's §5.1 unit**, the (entity, field) gap: 1,529. It is not counted in entities (812). | Criterion 1 passes as worded. Counted in entities, it would fail (812 < 1,000). This is flagged for the Founder at the gate. |

**Recorded Mon 5 Oct 2026 (day 7).** In-lane rulings and deviations from the day-7 run (instructions `MA-OCT-006_Day7_Run_Instructions.md`, SHA-256 `9c376145…d8be`). They are reported in Report 4.

| # | Ruling / deviation | Effect |
|---|---|---|
| D7-1 | **D6-1 scope in the re-sync.** D6-1 excludes government from *automated LEI matching*. It is therefore applied to **every** government `lei` gap that an automated tier assigned to (d): 6 T1 (high), 1 T1_LAPSED and 2 T1+ (medium). That makes 9 rows, not the 6 the run instructions expected. The 2 government rows in (c) "duplicate entity" (250160 United States Lime, 267868 United States Steel, both mistyped and both duplicates of an operating row) are **not** changed. They assign no LEI, and they are merge findings for MA-OCT-013. | 9 rows (d) → (a) `RC-A2` manual review. RC-1 high stays 3,855 (D6-1 already counted it); RC-1 medium falls from 2,886 to 2,883. |
| D7-2 | **D6-5 applied in the re-sync.** The 8 parent rows of the 4 wrong-LEI entities are re-assessed against each entity's *correct* LEI. All 4 correct LEIs have no ACTIVE RR parent and an RX `NO_KNOWN_PERSON` exception for both direct and ultimate. Their 4 KI 22.43 W rows are removed: against the correct LEI, the `NO_LINK_DECLARED` marker is not wrong. | 8 rows (c) → (b), medium (they depend on the RC-12 LEI fix). KI 22.43 falls from 661 to **657**. |
| D7-3 | **Sample adjudication re-synced to D6-1.** 106518 Kingdom of Morocco and 96163 Treasury Wine Estates (mistyped `government`) now have rule category (a), while the reviewer found the LEI (d). | Run-2 agreement falls from 359 to **357/400 (89.25%)**. The government/no-LEI cell falls from 3/15 to 1/15. This is expected: D6-1 routes that cell to a reviewer instead of the rule engine. |
| D7-4 | **The ETF cursor key (Main Lane addition to D8).** The key is `etf_offset`, read at `App/ETF Refresh/src/holdings-pipeline.js:107` and written at `:174`/`:178`. The file is under `src/`, not at the path given in the instruction. `last_run_status` (`:175`/`:179`) was added alongside it. | D8-1005 has 12 keys instead of 10, at 21 reads. |
| D7-5 | **Transient wrangler failure.** The first D10 EXPLAIN failed with Cloudflare API code **7403** ("account not valid or not authorized"). `d1q.sh`'s `npx --prefix` had just fetched wrangler 4.147.0, while the interactive session is 4.96.0. `wrangler whoami` was valid (OAuth, `d1 (write)` scope), and one retry 16 s later succeeded. | 0 reads charged. Same class as F6 (intermittent wrangler / Cloudflare API auth), and recorded for MA-OCT-002. |

## 8. Day 2 (Tue 29 Sep 2026)

**Preflight, 06:56 UTC:** branch `October-2026`; no `.git/*.lock`; `wrangler whoami` shows an OAuth session. Spec `1dab3539…b7273` and Spec Review `6ae65d79…06` match. `du -sh WORK` before cleanup was 9.9G.

**Tail 1: missed.** The session started at 06:56 UTC, after the 06:48 cut-off. Tail 2 is on Wed 30 Sep 06:50 UTC.

### 8.1 Files (all in `WORK/day2/`; none committed; all are under 10 MB, but they stay out of the repo per the day-2 instruction)

| File | Rows | Bytes | SHA-256 |
|---|---|---|---|
| `d2_entity_master.csv` | 43,998 | 7,397,088 | `ad4d40a0ba21a07f70a88e7bda7eee1d0d26a8b8a7876f87b77af7a2d45abd62` |
| `d3_queue.csv` | 29,071 | 2,861,072 | `23a52f9483a9b387c5ce40f8f050c742e82cc8d0bb7fb48014c0020a61299f2f` |
| `d4_relationships.csv` | 334 | 19,451 | `aa2f30a01202aa7c345ef7f5a1a131d55ffb0c92b4758c76c07b848e82ba4feb` |
| `d5_exceptions.csv` | 9 | 6,712 | `b065734390bc75eb1f1b5ad4f12be9974863b590e03bb19697d90d13eb7cfac7` |
| `d6-20260929.csv` | 45 | 2,930 | `8668469da654ac6604213adace78429a7d0a2b375c6f9201602d5874a89fef38` |
| `d7-20260929.csv` | 100 | 3,604 | `74144feaf41462e2c9863a90d756db77b745acb6ae67323f9455ecd29a546219` |
| `d8-20260929.csv` | 6 | 221 | `f03b664b35d05e2d343c89b4c9c14d45ab935ed250cb78b468b80e8fea558b57` |

In the CSVs, SQL NULL is written as `\N`, so it can be told apart from an empty string.

### 8.2 Reconciliation (spec §7.1): PASS

| Measure | Baseline | D2 | Δ | Tolerance |
|---|---|---|---|---|
| Rows | 43,785 | 43,998 | +213 (+0.49%) | ±0.5% ✅ (close to the edge) |
| LEI not null | 16,557 | 16,627 | +70 (+0.42%) | ±0.5% ✅ |

The growth is real, not an export error. `MAX(entity_id)` went from 463,722 (day 1) to 467,289. The +213 rows are new entities: 143 created at the Mon 28 Sep 04:00 seed, plus others. By type: operating 32,931; holding 10,619; fund 290; government 114; manager 43; spv 1.

### 8.3 Runtime snapshots

- **D8** (after the 29 Sep 06:50 run):
  - `enrich_phase3_last_run_entities` = 42, `_subrequests` = 44, `_deferred` = 3; `enrich_combined_last_invocation_subrequests` = 44; `hold_all_jobs` = false; `writes_today_2026-09-28` = 34,331.
  - **Absent:** `writes_today_2026-09-29` (even though the 06:50 run wrote about 43 rows, which is F7's blind-guard signature), and all three `delta_*` keys (delta has never run; H10).
- **D6** (Phase 3 head set, 45 rows):
  - All are `type='holding'`, `lei_status` NULL, `name` = their own LEI (KI 22.24 placeholder). All LEIs pass the format check.
  - Local Golden Copy: all 45 are in L1 (44 ISSUED, 1 LAPSED), and **all 45 have an RX direct-parent exception** (36 `NON_CONSOLIDATING`, 8 `NO_KNOWN_PERSON`, plus the 1 LAPSED with `NON_CONSOLIDATING`). None has an ACTIVE RR direct parent.
  - No tail errors to cross-check (tail 1 missed).
- **D7** (Phase 1 head set, 100 rows): 1,487 reads, so the guard allows repeats. The head starts at entity_ids 324, 326, 327, 364, 408, … and includes merge orphan 408. **Many queue names carry HTML entities (`S&amp;P`, `Deere &amp; Co`, `B&amp;G Foods`)**. That is a likely additional H2 match-failure cause, to be confirmed by local replay.

### 8.4 Step 4 local checks (0 D1 reads). Script `WORK/analyze_day2.py`, output `WORK/day2/step4_results.json`

**(a) `normalized_name` drift:** **4,439 of 43,998** stored values differ from `normalizeName(name)` (operating 2,126, holding 2,311, fund 1, government 1). The examples show two patterns:

1. `name` was later replaced by the GLEIF legal name, but `normalized_name` still holds the holdings-string form. Examples: 716 "THE HANOVER INSURANCE GROUP, INC." stored as `HANOVER INSURANCE GROUP INC/THE`; 1438 `CARLISLE COS`; 1452 `PNC FINANCIAL SERVICES GROUP I` (truncated).
2. The stored value keeps a suffix that the current order strips. Examples: 1145 `DAUCH CORPORATION`, 1274 `NOURYON FINANCE BV`, 1344 `BELRON GROUP SA`.

This bears on H12 and on the unique key `(normalized_name, type)`. It is not a W finding by itself.

**(b) MA-SEP-017 residual:** rows with `updated_at` in 04:00–07:00 UTC.

| Date | New | Touched, 04:xx (seed) | Touched, 06:xx (enrich Phase 3) |
|---|---|---|---|
| Sat 6 Sep (pre-fix) | 84 | 27,308 | 41 |
| Sun 13 Sep | 0 | **0** | 44 |
| Sun 20 Sep | 1 | **0** | 44 |
| Mon 28 Sep (first Monday cron, MA-OCT-012) | 143 | **2,406** | 44 |

- Pre-fix baseline in the spec: 29,839. The 6 Sep figure here (27,349 touched) is lower because some of those rows were stamped again later.
- **Interpretation:** `updated_at` only keeps the latest stamp, so each date's count is a **floor**. The 13 and 20 Sep zeros cannot be told apart from "touched again on 28 Sep".
- **Code cause, `entities-seed.js:392-398`:** the MA-SEP-017 guard is `ON CONFLICT … DO UPDATE SET updated_at = CURRENT_TIMESTAMP WHERE name IS NOT excluded.name OR country IS NOT excluded.country`. It **never writes `name` or `country`**, so a row that differs once differs forever, and it is re-stamped on every seed run.
- **The 2,406 rows:** 04:00–04:04 on 28 Sep. 2,364 were created in June. 1,939 have an LEI, so their `name` is probably the GLEIF legal name, which differs from the holdings issuer string.
- **Conclusion:** the fix cut touches by about 91% (27.3k → about 2.4k per run), but it **does not reach ~0**. A fixed residual of about 2.4k rows is re-stamped every week. This also means the **Monday cron path works as intended**.
- **Recommendation for Main Lane:** close MA-SEP-017 with this number, and log the "sticky diff" as a Known Issue candidate. A fix would be to also `SET name/country`, or to drop the `name` test for LEI-bearing rows. That is not this packet's scope.

**(c) Queue attribution, first pass (H1/H3/H8/H9):** the queue has 29,071 rows: pending 26,680; failed 1,220; complete 1,170; in_progress 1.

| status | lookup_method | type_hint | Master state | Rows |
|---|---|---|---|---|
| pending | name_search | operating | no LEI (H1: no consumer) | 26,083 |
| complete | isin | operating | has LEI | 1,170 |
| failed | isin | operating | no LEI (H3: never re-selected) | 902 |
| pending | name_search | operating | **has LEI (H8 stale)** | 377 |
| failed | NULL | fund | fund | 264 |
| pending | isin | operating | **has LEI (H8 stale)** | 164 |
| pending | name_search | government | no LEI | 50 |
| failed | name_search | manager | no LEI | 41 |
| failed | isin | operating | has LEI (stale) | 11 |
| pending | name_search | operating | **orphan** (not in master) | 2 |
| failed | name_search | government | no LEI | 2 |
| pending | name_search | government | has LEI (stale) | 2 |
| pending | name_search | manager | no LEI | 2 |
| in_progress | name_search | operating | no LEI (entity 2147 ADNOC Drilling, `last_attempt` 2026-06-11 22:04) | 1 |

- **The 164 `pending/isin` rows: 164 of 164 fail Phase 2's join because the entity already has an LEI.** Zero are Phase 2-eligible, and zero are orphans or funds. This confirms H3's mechanism, since Phase 2 has nothing to do.
- `MAX(last_attempt)` in the queue = **2026-08-31 06:50:59**. This matches MA-OCT-000 F4.
- Unqueued non-fund, no-LEI entities: **0**. Nothing is missing today, so H9's "unqueued" effect is not present at this snapshot. Its type-hint effect is covered by the government and manager rows above.

**(d) LEI format:** 16,627 non-null LEIs. **0 empty strings. 0 fail `^[A-Z0-9]{18}[0-9]{2}$`.**

### 8.5 H4, early read (to be settled by tail 2 and D6 on 30 Sep and 2 Oct)

`updated_at` 06:xx footprints in D2:

| Date | Rows | Detail |
|---|---|---|
| 13 Sep | 44 | all `holding`, `lei_status` ACTIVE, `direct_parent_exception` = `NO_LINK_DECLARED`, none still name=LEI |
| 20 Sep | 44 | same |
| 27 Sep | 44 | same |
| 28 Sep | 44 | same |
| 29 Sep | 43 | 41 `NO_LINK_DECLARED`, 2 with a parent; 42 ACTIVE, 1 INACTIVE |

- Each date keeps **its own** 44 rows. If Phase 3 re-selected the same 44, only the latest date would show them.
- **So H4 as stated ("same 44 every day, zero net progress") is refuted on the early read, and the spec's alternative holds:** each run resolves about 44 entities, mostly by writing the generic exception (H6), and the pool shrinks.
- **Remaining Phase 3 pool: 7,436 entities**, all `holding`, of which 7,426 are LEI placeholders with `lei_status` NULL. At about 44 per day (cron only; the boost is failing, H11), that is about **169 days** to drain.
- **The D6 head's RX profile** (45 of 45 have a declared exception) predicts that most of the pool will end as (b), with `NO_LINK_DECLARED` masking the real RX reason (H6).

## 9. Early CSV cleanup (ruling R3), Tue 29 Sep 2026, about 07:09 UTC

**Checks before deleting, all PASS:**
- `gleif_006.db` opened read-only; `PRAGMA quick_check` = `ok`.
- Row counts match §3 exactly: `gc_lei` 3,444,580; `rr` 489,184; `rx` 6,383,042; `lei_isin` 9,150,433.
- All 4 zips are present, and their SHA-256 values match §3 (`7a72b72b…`, `040fe45f…`, `f086de5d…`, `1b4aa25d…`).

**Location note:** the day-2 instruction said to list the CSVs at the top level of WORK. The top level held **0** CSVs, because the files were unzipped into `WORK/gc/` on day 1. The four files deleted are the same four Golden Copy / LEI–ISIN CSVs, inside WORK.

**Deleted, by exact path (no wildcards):**
1. `WORK/gc/20260928-1600-gleif-goldencopy-lei2-golden-copy.csv` (5,003,659,414 B)
2. `WORK/gc/20260928-1600-gleif-goldencopy-rr-golden-copy.csv` (243,514,075 B)
3. `WORK/gc/20260928-1600-gleif-goldencopy-repex-golden-copy.csv` (709,999,257 B)
4. `WORK/gc/lei-isin-20260928T071511.csv` (311,114,731 B)

**Kept:** the 4 zips (the rebuild source), `gleif_006.db`, `day2/`, `d1out/`, `ledger.jsonl` and the scripts.

**`du -sh WORK`:** 9.9G before, 4.1G after.

## 10. Interim hypothesis verdicts (day 3). **INTERIM, superseded by §13 (FORMAL, 1 Oct)**

**INTERIM, Wed 30 Sep 2026.** Local replay only (0 D1 reads for the verdicts themselves). The formal version is **Report 2, Fri 2 Oct**. "File" citations are in `WORK/day2/` or `WORK/day3/`. Query IDs are in the ledger.

| H | Interim verdict | Evidence (file + query ID) | Fri 2 Oct still needs |
|---|---|---|---|
| **H1** name_search has no consumer | **Confirmed** | Code (spec §4.1). `step4_results.json` c: 26,083 `pending/name_search/operating`, no LEI. D7-0930 plus D7b-0930: Phase 1 only ever sees the same 100 head rows, so the 26k are never examined by any job. | Nothing new. Formal attribution of the 26,537 pending rows. |
| **H2** Phase 1 head-of-line | **Confirmed** | Tail 2: "populated 0 of 100" at 06:00. D7-0929 vs D7-0930: **100/100 overlap, same order, byte-identical CSV** (SHA `74144fea…` both days). D7b-0930: 0 of 100 hits. **Cause of the misses:** 80 of 100 names carry `&amp;`, and the unescaped name hits 10 of 10 (`d7b-20260930.json`). The other 20 are non-issuer names (option contracts `SPY 10.01 C`, counterparties, exchanges, money-market sweeps) with no ISIN to find. **`stripBondDetail`: 0 of 100 in the head.** Root cause: no miss marker and no ORDER BY. `&amp;` only explains why this particular head never clears. | D7 on Fri (third day). Expect identical again. |
| **H3** Phase 2 dead | **Confirmed** | Tail 2: "Phase 2: nothing to enrich", 0 isin-search fetches. `step4_results.json` c: 164/164 `pending/isin` rows already have an LEI; 902 + 11 `failed/isin` rows are never re-selected; `MAX(last_attempt)` = 31 Aug 06:50:59. | Nothing new. |
| **H4** Phase 3 same 44 daily | **Refuted as stated; the spec's alternative is confirmed** | D6-0929 vs D6-0930: **0 overlap.** Both heads are exact LEI-order slices of the day-2 pool (positions 0–44 and 132–176). 132 = 3 runs × 44 (boosts 29 Sep 10:50 and 16:50, cron 30 Sep 06:50). Tail 2: 44 self-detail fetches, all HTTP 200, 0 errors, 1 deferred. §8.5: separate 44-row 06:xx footprints on each date. | Third D6 on Fri. Expect a head at pool position about 132 + 44 × (runs since). The spec's §10 acceptance wording ("settled by the 2 and 3 Oct tail") needs a Main Lane ruling, since this tail already settles it. |
| **H5** failed parent follow-up loops | **Inconclusive (path not exercised)** | Tail 2: 0 direct-parent or ultimate-parent fetches, so the `!relResp.ok → continue` path never ran. GC: only **71 of 7,436** pool entities have an ACTIVE RR direct parent, so the path fires rarely. | A tail that catches one of the 71, or a code-only verdict ("latent"). |
| **H6** only the generic exception | **Confirmed** | D2: `direct_parent_exception` = `NO_LINK_DECLARED` on 9,142 rows (no other value); `ultimate_parent_exception` non-null on **0** rows. GC for the 44 processed on 30 Sep: 35 NON_CONSOLIDATING, 9 NO_KNOWN_PERSON, all flattened (`gc_run0650_processed_est.csv`). **661 of the 9,142 `NO_LINK_DECLARED` rows have an ACTIVE RR direct parent in GC 28 Sep.** These are candidate (c), subject to freshness (the RR may post-date the write). | The freshness check (API sample, days 5–7) on some of the 661. |
| **H7** parent upsert overwrites another holding's LEI | **Refuted at this snapshot (latent code risk stays)** | `h7_local.json`: all **2,334** named `holding` rows with an LEI match one of that LEI's GC names. 0 mismatches, 0 names matching a different LEI. | None. Keep as latent W in the matrix (the code path is unchanged). |
| **H8** queue never reconciled | **Confirmed** | `step4_results.json` c: 377 + 164 + 11 + 2 = **554 queue rows whose entity already has an LEI**, plus 2 orphans (not in master) and 1 `in_progress` since 11 Jun. | Nothing new. |
| **H9** Step 4 skip / type_hint | **Partly confirmed** | Type-hint effect present: 52 `government` + 43 `manager` no-LEI rows have no Phase 1 path (step4 c). Unqueued effect **absent today**: 0 unqueued non-fund no-LEI entities. | Check whether Sun/Mon seed runs leave unqueued rows (D2 re-export not planned; code verdict). |
| **H10** delta not safe to unfreeze | **Confirmed on code; runtime shows it never ran** | D8-0929 and D8-0930: all three `delta_*` keys absent. Code items are per spec §4.2. | `DELTA_URL` raw-CSV check (API call budget) if in scope. |
| **H11** boost fails / adds nothing | **Partly confirmed** | `logs/entities-enrich-boost.log`, 16–29 Sep: 28 attempts, **13 errors** (CF API code 10000 at the headroom check; 10 of them evening). Of the 15 that fired, **13 read `writes_today=0`** (F7 / KI 22.14; D8-0930 again has no `writes_today_2026-09-29` or `_2026-09-30`). **But "adds nothing" is refuted for Phase 3:** the 29 Sep boosts (both fired) advanced the Phase 3 head by 2 × 44 (D6 position 132). | Step 7 (§11.7): the 30 Sep 10:59 boost failed at the headroom check (code 10000). The tail saw 0 invocations, so it never reached the Worker. A tail on a day the boost *fires* would show that path directly. |
| **H12** June resolver's old normalizer | **Partly confirmed (small direct effect)** | `h12_local.json`: 7,289 of 27,081 no-LEI non-fund entities have a **unique** exact GC name match under the current normalizer. Of these, only **189 are June-created and would have been missed by the June resolver's suffix-first order** (e.g. `Spotify Technology SA`, `Elastic NV`). 1,078 June-created entities match even under the old order, so they were missed for another reason. The other ~6,000 were created after June, when no resolver runs at all (H1). These are candidates only; §5.3 reliability is not yet applied. | Apply §5.3 (T1–T3) to the 7,289 candidates. The 400-sample adjudication. |
| **H13** Phase 1 full scans | **Refuted** | D9 (day 1) and D7b-0930-explain: `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)`. D7b: 110 executions, 159 reads (88 misses at 0 reads, max 42). | None. |

**New W (integrity) findings from day-3 local replay (for the remediation matrix):**
- **W-A (R6 b), observed:** **1,928 duplicate entity pairs** caused by stale `normalized_name` keys (§11.4).
- **W-B:** **90** June-created `&amp;` entity names have an unescaped twin in `entity_master` (§11.3).
- **Mechanism note:** Phase 3's KI 22.24 name hydration (`entities-enrich.js:331-343`) sets `name` but never `normalized_name`. So 10,595 LEI-placeholder rows keep `normalized_name` = their LEI, and 2,310 of them now carry a real name under an LEI key.

## 11. Day 3 (Wed 30 Sep 2026)

**Preflight (05:53–05:55 UTC):**
- Branch `October-2026`; no `.git/*.lock`.
- Spec `1dab3539…b7273` and Spec Review `6ae65d79…06` match.
- `du -sh WORK` = 4.1G.
- The session started at 05:53 UTC (06:53 BST), before the 06:48 cut-off.

### 11.1 Tail 2: **captured both runs**

- Started 05:53:27 UTC, stopped 07:05:03 UTC.
- `WORK/day3/tail-20260930.jsonl` (SHA `384965d0…c39f8`); summary `WORK/day3/tail-summary.md` (SHA `ba80d269…d355`).
- **06:00 Phase 1:** `populated 0 of 100`. Wall time 27.4 s, 0 errors.
- **06:50 Phase 2+3:** `Phase 2: nothing to enrich`; `Phase 3: selected 45, attempted 44, deferred 1 (checkpoint), 44 GLEIF subrequests`; combined 44.
  - 44 × self-detail HTTP 200. **0 parent fetches, 0 non-2xx, 0 "Phase 3 error on" lines, 0 exceptions.**
- Script version `23fd2660-…` on both.

### 11.2 Runtime snapshots (07:05 UTC)

- **D8-0930** (15 reads): `enrich_phase3_last_run_entities` 44, `_subrequests` 44, `_deferred` 1, `enrich_combined_last_invocation_subrequests` 44, `hold_all_jobs` false.
  - **Absent:** `writes_today_2026-09-30`, `writes_today_2026-09-29` (both days had enrich writes: KI 22.14 + F7), and all `delta_*`.
- **D6-0930** (5,194 reads): 45 rows, all `holding`, `lei_status` NULL, name = own LEI, format OK.
  - **Overlap with D6-0929: 0.** First LEI `529900N73S4HJ1DZZ853` (day 2: first `529900KMLT6ZXE4YO536`, last `529900LL5VKXVCWY7S93`).
  - GC: 45/45 in L1 (43 ISSUED, 2 LAPSED); 0 ACTIVE RR; RX direct 40 NON_CONSOLIDATING, 5 NO_KNOWN_PERSON.
  - **Why the reads are what they are:** `idx_entity_master_phase3` is a partial index on `(lei, type, lei_status, direct_parent_lei, ultimate_parent_lei, direct_parent_exception) WHERE lei IS NOT NULL`. The query has no ORDER BY, so it walks the index from the lowest LEI and reads every entry that is already processed until 45 still qualify. D2 has 4,939 LEI rows below the day-2 head and 5,129 below the day-3 head. 4,939 + 45 + skips ≈ 5,003 and 5,129 + 45 + new rows ≈ 5,194. **Reads grow by about 44 per Phase 3 run**, reaching about 12.5k when the pool drains.
- **D7-0930** (1,487 reads): **100/100 overlap with D7-0929, same order, byte-identical file.** H2 head-of-line confirmed.

### 11.3 D7b: Phase 1's own lookup, replayed (H2 test)

- EXPLAIN (0 reads): `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)`. **PASS.**
- **100 distinct names, 0 hits.** 80 contain `&amp;` (no other HTML entity seen); 20 contain none.
- The 20 non-entity misses are non-issuer strings: 8 SPY/QQQ option legs, 2 Dreyfus money-market sweeps, the State Street securities-lending MMF, `BRERA HOLDINGS PLC WTS`, `SFR-Numericable (YPSO, Altice France)`, J.P. Morgan Securities LLC, CME, CBOT, ICE Futures U.S., Warsaw, Montreal and Eurex exchanges.
- **Unescape test, first 10 missed `&amp;` names: 10/10 hit** (e.g. `Deere & Co` → US2441991054, `iShares Core S&P 500 ETF` → US4642872000).
- **Answer (R6 c):** H2's head is blocked by **`&amp;` escaping (80%) and non-issuer names (20%)**, not `stripBondDetail` (0 of 100).
  - `fund_holdings_monthly.security_name` is stored unescaped, but 105 `entity_master` names (all created in June) and 106 Phase 1-eligible queue rows are escaped.
  - Those 106 are only 0.4% of 26,462 eligible rows, but with no ORDER BY and no miss marker they occupy the head permanently.
  - 90 of the 105 escaped master names already have an unescaped twin (W-B).
- Budget: **110 executions, 159 reads** (cap 2,000; max single 42). `fund_holdings_monthly` is ETF-domain and was only read. Output `WORK/day3/d7b-20260930.json` (SHA `9726c527…0d89`).

### 11.4 `normalized_name` drift split (R6 b; 0 reads; `WORK/analyze_day3_norm.py`)

| Class | Rows | Definition | Twin row on the correct key |
|---|---|---|---|
| (i) key = own LEI | 2,310 (all `holding`) | FIRDS placeholder; Phase 3 hydrated `name`, never `normalized_name` | **0** same-type collisions (22 have a name twin of type `operating`) |
| (ii) old-normalizer pattern | 1,978 | stored = pre-1-Aug order (1,689), pre-MA-SEP-001 order (288), or residual suffix (1) | **1,880** |
| (iii) other | 151 | `name` later replaced by the GLEIF legal name; key still holds the holdings string | **48** |
| **Total** | **4,439** | | **1,928** |

- The requested "hidden duplicate" count for (i) is **0**.
- The duplicates are **not hidden but realised**. For 1,928 drift rows (756 with an LEI, 1,172 without), a second `operating` row **already exists** on the correctly normalized key, and that twin has **no LEI**.
  - Twins created **1,582 at the 23 Aug 04:00 seed** (the first seed after MA-SEP-001 changed `normalizeName` on 16 Aug), 220 at the 30 Aug seed and 107 on 29 Jul.
  - 1,920 of the twins are `pending/name_search` in the queue, so they are part of H1's 26k.
  - Example: 1145 `Dauch Corporation` (LEI, key `DAUCH CORPORATION`) vs 220809 `Dauch Corporation` (no LEI, key `DAUCH`, created 23 Aug).
- **R6(b) is upgraded from candidate to observed W root cause:** a normalizer change was not paired with a key migration.
- Files: `norm_split.json` (SHA `e22ba723…987f`), `norm_hidden_duplicates.csv` (1,928 rows, SHA `9cafca93…a95`).

### 11.5 Other local checks (0 reads)

- `h7_local.json` (H7): SHA `925e20f2…b99c`.
- `h12_local.json` (H12): SHA `54e77808…eb8`.
- Boost log tally (H11): see §10.

### 11.6 Day-3 files (`WORK/day3/`; none committed)

| File | Rows | SHA-256 |
|---|---|---|
| `d8-20260930.csv` | 5 | `ffe558d334ed8f513c3511a61ec5679afff069dfae9cbfec4387804a1ea7f19e` |
| `d6-20260930.csv` | 45 | `44e7971f134eabcc52ecc65b13bbd7fa87bf59246c1a017c686f4ac20543535d` |
| `d7-20260930.csv` | 100 | `74144feaf41462e2c9863a90d756db77b745acb6ae67323f9455ecd29a546219` (identical to day 2) |
| `gc_d6-20260930.csv` | 45 | `cb1e7af4c98b112a8678e22a11e1766d1041997e26aeba50a3381eaa24b0b078` |
| `run0650_processed_est.csv` / `gc_run0650_processed_est.csv` | 44 | `df9d5c78…7223` / `05bafba2…9e5c` |
| `tail-20260930.jsonl` | 2 events | `384965d04ff1195c1a0ad10860e4b0cf40b93f6398211fbe698c54e8b826b99c` |

### 11.7 Step 7: boost-window tail (H11)

**Timing.** The tail was armed for 10:48–11:05 but **actually ran 10:59:01–11:15:47 UTC** (`tail-1050-start.txt` / `-stop.txt`). The polling loop that starts and stops the tail was delayed by about 11 minutes, most likely because the Mac was asleep. The LaunchAgent's own late 10:59 fire points the same way.

**Result.** The capture file `tail-20260930-1050.jsonl` is **0 bytes** (SHA `e3b0c442…b855`, empty). That means no `/run` fetch and no other invocation reached `meridian-entities-enrich` in the window.

**Boost log line for today** (`logs/entities-enrich-boost.log`):
`2026-09-30T10:59:03.619Z | error | headroom check failed: wrangler d1 execute failed: … SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-09-30' | status=1 | … "A request to the Cloudflare API (/accounts/ea36070477560…`

**Reading.** The morning boost failed locally at the headroom check (the H11 / MA-OCT-000 F4 wrangler API error) and never called `/run`. The empty tail agrees with that. No `/run` calls were made by this lane.

**H11 tally, 16–30 Sep:** 29 attempts, 14 errors, 15 fired.

## 12. Day 4 (Thu 1 Oct 2026): reliability tiers, freshness check, first-cut prize

**Preflight, 05:45 UTC:**
- Branch `October-2026`, HEAD `fa9c723`; no `.git/*.lock`.
- Spec `1dab3539…b7273` and Spec Review `6ae65d79…06` match.
- `du -sh WORK` = 4.1G; `day4/` created.
- The session opened at 05:45 UTC, before 07:05, so **all D1 work (§12.5) waited until 07:05 UTC**. Steps 1, 3, 4 and 6 ran first, with 0 D1 reads.

### 12.1 §5.3 tiers on the H12 unique-name candidates (0 D1 reads)

- **Inputs:**
  - D2 export (29 Sep, `day2/d2_entity_master.csv`);
  - KI 22.41 pairs (`day3/norm_hidden_duplicates.csv`);
  - `gleif_006.db` (GC 2026-09-28 16:00 UTC).
- **Method:** current `normalizeName` over `gc_name`, covering the legal name plus other and transliterated names.
- **Script:** `WORK/h12_tiers.py`.
- **Reproduces day 3 exactly:** of the 27,081 no-LEI non-fund entities, 18,739 have no GC match, 1,053 match ambiguously (exact, but to >1 LEI), and **7,289 are unique candidates**.

| Bucket (first match wins, in this order) | Rows | Treatment |
|---|---|---|
| Excluded: **KI 22.41 [W-A] twin**, whose LEI is on the other row of the pair | 606 | Not counted. A duplicate-merge item, not an LEI gap. |
| Excluded: **GC LEI already on another D2 row** | 743 | Not counted. Another duplicate entity (different key or type). |
| Excluded: GC status **LAPSED** | 1,510 | Not counted. The identity is found, but the registration is lapsed. |
| Excluded: GC status **RETIRED** (GC has no `MERGED` registration status; merged LEIs appear as RETIRED) | 49 | Not counted. |
| Excluded: GC status **ANNULLED** | 4 | Not counted. |
| **T1**: unique, country agrees (D2 `country`/`legal_address_country` = GC legal-address country) | **4,124** | Reliable. |
| ↳ of which GC status **DUPLICATE** | 9 | **In-lane ruling D4-1: excluded from T1.** A GLEIF `DUPLICATE` registration is not the entity's valid LEI. |
| ↳ **T1 net** | **4,115 rows → 3,723 distinct LEIs** | 758 of the rows are KI 22.41 pairs where *neither* row has an LEI (both rows match the same LEI). Hydration must be duplicate-aware: about 385 LEIs are shared by 2–4 rows. |
| **T2**: unique, country disagrees (0 with a NULL country) | 253 | Not reliable (R2). Reported as (a) "recoverable with review". 250 ISSUED, 3 DUPLICATE. |
| **T3**: exact but non-unique (from the ambiguous set) | 1,053 | Not reliable. (a) "recoverable with review". The token-sort ≥0.92 part of T3 is not computed yet; it comes with the classification on Fri 2 Oct. |

**T1 precision sample:**
- n = 50 rows, `random.Random(20261001).sample` over the 4,124 T1 rows (`day4/t1_sample50.csv`, SHA `180e2174…3814`). None of the 50 is a DUPLICATE-status row.
- **Checked by eye: 50/50 correct.** Name equal modulo suffix punctuation, same country, legal form consistent with the holdings name.
- 11 of the 50 matched through a GLEIF other or transliterated name, because the legal name is in Korean, Japanese, Chinese, Thai or Greek script (e.g. Lotte Shopping → 롯데쇼핑 주식회사, Tokyo Electron Device → 東京エレクトロンデバイス株式会社, Kri-Kri Milk Industry → ΚΡΙ-ΚΡΙ …). Those matches are also correct.
- **Estimated T1 precision: 100% (50/50).** With n = 50 the one-sided 95% lower bound is about 94.2%, so the sample can't prove ≥98% on its own. The 400-entity adjudicated sample (from Fri 2 Oct) carries the formal §6.4 test.
- No T1 re-examination is triggered.

Files: `day4/h12_tiers.csv` (7,289 rows, SHA `a280c3c2…27f9`), `day4/h12_tiers_summary.json` (SHA `42b6611e…d30`).

### 12.2 Freshness check (GLEIF API)

- **Sample:** 50 LEIs, seed `20261001` (`day4/freshness_sample.json`, SHA `e08c3fa6…92fe`).
  - 25 from the **661 KI 22.43 rows** (rebuilt locally and reproduced exactly: 9,142 `NO_LINK_DECLARED`, of which 661 have an ACTIVE GC direct parent; `day4/ki2243_rows.csv`, SHA `038a088f…bae7`).
  - 25 distinct LEIs from T1 net.
- **Calls:** exactly 50 × `GET https://api.gleif.org/api/v1/lei-records/{lei}`, 05:47–05:48 UTC, ≥1.1 s apart, no retries. **50/50 HTTP 200.** Log: `day4/freshness_calls.jsonl` (SHA `ed3f84da…981c`); bodies in `day4/api/`.

| Field compared with GC 2026-09-28 16:00 UTC | Agree |
|---|---|
| Entity status | 50/50 |
| Registration status | 50/50 |
| Legal name | 50/50 |
| Direct-parent link exists | 50/50 (29 have a link: 25 KI 22.43 + 4 T1; 21 T1 show `reporting-exception` instead) |
| **All four** | **50/50 = 100%. PASS (≥98%)** |

- Results: `day4/freshness_results.csv` (SHA `cab0ae39…afe9d`).
- **KI 22.43 freshness:** all 25 sampled rows have a live GLEIF direct-parent link today. Their `NO_LINK_DECLARED` marker is therefore wrong now, not a Golden Copy artefact.
- **Timing test (all 661, local):** for **593**, the GC relationship record's `LastUpdateDate` is on or before the date the marker was written (`updated_at`). The relationship existed when Phase 3 wrote "no link", so the marker was **wrong when written**. For the other **68**, the RR record was updated after the write, so it can't be decided from the data (stale vs wrong).
- **GLEIF API total: 52 of 60** (2 metadata calls on day 1 plus 50 today). **8 remain.**

### 12.3 Size of the prize: **FIRST CUT** (0 D1 reads; `WORK/prize_firstcut.py`, `day4/prize_firstcut.json`)

**No-LEI non-fund entities (D2, 29 Sep): 27,081.** The 290 funds are out of GLEIF scope. Buckets are mutually exclusive, first match wins.

| # | Bucket | Entities | Class (provisional) |
|---|---|---|---|
| 1 | KI 22.41 [W-A] duplicate, partner row already has the LEI | 606 | W: merge, not an LEI gap |
| 2 | GC LEI already on another D2 row (another duplicate entity) | 743 | W: merge |
| 3 | **T1-recoverable from GC** (net of DUPLICATE status) | **3,357 + 758 in KI 22.41 pairs = 4,115 rows (3,723 LEIs)** | (c) / (d) |
| 4 | GC match, but status LAPSED 1,510 / RETIRED 49 / ANNULLED 4 / DUPLICATE 9 | 1,572 | (b)-candidate (identity found; a status label decides) |
| 5 | T2/T3 review candidates: country disagrees 253, exact-ambiguous 1,053 | 1,306 | (a) "recoverable with review" |
| 6 | Pattern classes with no unique GC match: US municipal/public 1,645, ABS/securitisation trusts 1,034, **non-issuers** 82 (derivative legs 29, currency/cash 25, exchanges/CCPs 24, MMF/sweeps 4), ETF-like holdings 18 | 2,779 | mostly (a)/(b) |
| 7 | **Unexplained remainder** (937 of them in KI 22.41 pairs) | **15,960** | to be classified Fri 2 Oct |

- **Reading:** the remainder is mostly real issuers, not junk. Typical cases:
  - Asian issuers whose GLEIF legal name is in native script with no English other-name (`Sinfonia Technology`, `Taiwan Mask Corp`);
  - suffix and abbreviation variants (`… Bhd`, `… Tbk PT`, `Perfect World Co Ltd/China`);
  - issuers that likely have no LEI.
- Token-sort T3 and the 400-sample will split this bucket. **The non-issuer share is small (82 by simple patterns).**

**Phase 3 pool (D2, 29 Sep): 7,436, all `holding`.** All of it can be hydrated offline from the GC:

| GC fact | Entities |
|---|---|
| In Level 1 (name, status, address hydratable offline) | **7,436 / 7,436** (ISSUED 7,220, LAPSED 151, RETIRED 58, PENDING_TRANSFER 7) |
| Direct parent: ACTIVE RR | 71 |
| Direct parent: RX exception with its real reason | 7,358 (NON_CONSOLIDATING 5,988, NO_KNOWN_PERSON 1,204, NATURAL_PERSONS 89, NON_PUBLIC 60, NO_LEI 15, other 2) |
| Direct parent: neither | 7 |
| Ultimate parent: ACTIVE RR | 74 |

**FIRST CUT:** the pool can be cleared offline with real exception reasons in one pass, against about 169 days at the live rate (§12.5). Counts are from the 29 Sep D2 snapshot.

### 12.5 Runtime trend (07:05 UTC, after the 06:50 run)

> **Later figure (day 7):** the head is at day-2 position 524 on 5 Oct, the observed rate fell to about 67 a day, and the drain takes about 103 days. See §16.1.

- **D8-1001** (15 reads, `day4/d8-20261001.csv`, SHA `ffe558d3…f19e`, the same values as day 3):
  - `enrich_phase3_last_run_entities` 44, `_subrequests` 44, `_deferred` 1; `enrich_combined_last_invocation_subrequests` 44; `hold_all_jobs` false.
  - **Absent:** `writes_today_2026-10-01` and `writes_today_2026-09-30` (KI 22.14 + F7, fourth day running), and all `delta_*` (H10).
- **D6-1001** (5,352 reads; `day4/d6-20261001.csv`, SHA `f1fd56e6…6560`; GC lookup `day4/gc_d6-20261001.csv`, SHA `63ecb705…f652`):
  - 45 rows, all `holding`, 44 with name = own LEI. All are in L1 (42 ISSUED, 2 LAPSED, 1 RETIRED). 0 ACTIVE RR. RX direct: 33 NON_CONSOLIDATING, 12 NO_KNOWN_PERSON.

| Snapshot | Head LEI | Position in day-2 pool order (LEI-sorted, 7,436) | Advance | Phase 3 runs in between |
|---|---|---|---|---|
| D6-0929 07:05 | `529900KMLT6ZXE4YO536` | 0–44 | — | — |
| D6-0930 07:05 | `529900N73S4HJ1DZZ853` | 132–176 | +132 | 3: boosts 29 Sep 10:50 and 16:50 (both fired), cron 30 Sep 06:50 |
| D6-1001 07:05 | `529900OYPKOG9VUAFN26` | **220–264** | **+88** | **2**: boost 30 Sep **16:58:44** (fired, `utc_minute=58`, in window), cron 1 Oct 06:50. The 30 Sep 10:59 boost failed at the headroom check (wrangler code 10000). |

- **Boost log, 30 Sep – 1 Oct:** 2 attempts, 1 fired, 1 error. The fire was 8 minutes late.
- **The head advances exactly 44 per successful Phase 3 run.** It has moved 220 in 5 runs over 2 days (2.5 runs/day). 0 overlap between consecutive snapshots.
- **Projected days to clear** the remaining about 7,172 (7,436 − 264; new placeholders could add to it):

| Rate assumption | Per day | Days |
|---|---|---|
| Observed, 2.5 runs/day | 110 | about 65 (about 5 Dec) |
| Cron only, boost failing | 44 | about 163 |
| All 4 runs succeeding | 176 | about 41 |

- **Most of these runs only write `NO_LINK_DECLARED`** (H6): 45 of 45 in today's head have an RX exception.

## 13. Hypothesis verdicts: **FORMAL** (Report 2, Thu 1 Oct 2026). Supersedes §10

> **Later figures (day 7):** the H11 tally through 5 Oct is in §16.2, and the KI 22.43 count is 657 after D6-5 (§16.3). The verdicts are unchanged.

File citations are in `WORK/day2|day3|day4/`. Query IDs are in the ledger. RC-ids are provisional root-cause IDs for the remediation matrix (Report 4).

| H | Verdict | Evidence (file / query / line) | Affected | RC | KI |
|---|---|---|---|---|---|
| **H1** `name_search` has no consumer | **CONFIRMED** | Code: `name_search` appears only at `entities-seed.js:425` (insert) and the schema CHECK; Phase 3 reads `entity_master` only (`entities-enrich.js:275-289`). D3-0929 → `step4_results.json` c. D7-0929 = D7-0930 (byte-identical): Phase 1 never moves past its 100-row head. | **26,083** pending `name_search`/operating no-LEI queue rows (+52 gov/manager, see H9) | RC-1 | — |
| **H2** Phase 1 head-of-line | **CONFIRMED** | Tail 2 (30 Sep 06:00): "populated 0 of 100". D7-0929/0930 byte-identical (SHA `74144fea…`). D7b-0930: 0/100 hits; 80/100 names carry `&amp;`, and unescaping hits 10/10; the other 20 are non-issuer strings. `entities-enrich.js:94-129`: no ORDER BY, no miss marker. `stripBondDetail`: 0 of 100. | All 26,462 Phase 1-eligible rows are blocked behind a fixed head of 100 | RC-2 | **22.42** [W-B] (escaped names in the head) |
| **H3** Phase 2 dead | **CONFIRMED** | Tail 2: "Phase 2: nothing to enrich". D3-0929: 164/164 `pending/isin` rows already have an LEI; 902 + 11 `failed/isin` rows are never re-selected (`:140-151` needs `status='pending'`); `MAX(last_attempt)` 2026-08-31 06:50:59. | 913 failed/isin (902 still without an LEI) + 164 pending/isin (no-op) | RC-3 | — |
| **H4** Phase 3 same 44 daily | **REFUTED as stated; the spec's alternative CONFIRMED** (R7) | D6-0929/0930/1001: head at day-2 positions 0 → 132 → 220, 0 overlap. Each step equals 44 × successful runs (boost log). Tail 2: 44 × HTTP 200, 0 errors. D2 06:xx footprints: a distinct 44 on each of 13/20/27/28/29 Sep. | 7,436 pool; drains at 44/run (§12.5: about 65 days at the observed rate) | RC-4 (throughput) | — |
| **H5** failed parent follow-up loops | **NOT OBSERVED; LATENT (code)** | `:392-400, 457-465` `!relResp.ok → continue` writes no marker. Tail 2: 0 parent fetches. Only 71 of 7,436 pool entities have an ACTIVE RR direct parent. No further tail (R7). | ≤ 71 entities could loop if their follow-up fetch fails | RC-13 (latent) | — |
| **H6** only the generic exception | **CONFIRMED** | D2: `direct_parent_exception` = `NO_LINK_DECLARED` on 9,142 rows, no other value; `ultimate_parent_exception` non-null on 0. GC RX for processed heads: real reasons (NON_CONSOLIDATING, NO_KNOWN_PERSON, …) discarded. **661 of the 9,142 have an ACTIVE GC direct parent.** API freshness: 25/25 sampled have a live parent link on 1 Oct. For 593/661 the RR record pre-dates the write. | 9,142 flattened reasons; **661 wrong markers** (≥593 wrong when written) | RC-5 | **22.43** [W-C] |
| **H7** parent upsert overwrites another holding's LEI | **REFUTED at this snapshot; LATENT code risk** | `h7_local.json`: 2,334 named LEI-bearing `holding` rows all match one of their LEI's GC names; 0 mismatches. The code path (`:414-420`, `entities-delta.js:249-255`) is unchanged. | 0 today | RC-12 (latent) | — |
| **H8** queue never reconciled | **CONFIRMED** | D3-0929 × D2-0929: 377 + 164 + 11 + 2 = **554** rows whose entity already has an LEI; 2 orphans; 1 `in_progress` since 2026-06-11 (entity 2147); 264 `failed` fund rows. | 554 stale + 2 orphan + 1 stuck + 264 fund | RC-6 | — |
| **H9** Step 4 skip / `type_hint` | **PARTLY CONFIRMED** | `type_hint` effect: 52 government + 43 manager no-LEI rows have no Phase 1 path (`entities-seed.js:414-463` copies `type_hint = em.type`; Phase 1 needs `operating`). Unqueued effect: **absent at the 29 Sep snapshot** (0 unqueued non-fund no-LEI). The skip path stays a code risk. | 95 | RC-7 | — |
| **H10** delta not safe to unfreeze | **CONFIRMED** (code) / never ran (runtime) | D8-0929/0930/1001: no `delta_*` keys. Code blockers per spec §4.2: unauthenticated `/run`, no budget guard, cross-domain keys, MA-SEP-009 Bug 2. `DELTA_URL` raw-CSV not tested (API budget kept). | All Level 1 fields frozen at the June load for 16,627 LEI-bearing rows | RC-8 | (N-4 security, for 002) |
| **H11** boost fails / adds nothing | **CONFIRMED (fails often, guard blind); "adds nothing" REFUTED** | Boost log 16 Sep – 1 Oct: **30 attempts, 14 errors** (wrangler code 10000 at the headroom check), **16 fired**, of which 14 read `writes_today=0` (KI 22.14 + F7; D8 shows no `writes_today_*` key on any of the 4 days). Fires run late (10:59, 16:58). Every fired boost advanced the Phase 3 head by 44 (§12.5). | 14/30 (47%) of boost runs lost; Phase 2 gain 0 | RC-4 (throughput), RC-14 (guard) | 22.14 |
| **H12** June resolver's old normalizer | **PARTLY CONFIRMED (small direct effect, large indirect)** | `h12_local.json`: 7,289 unique-name candidates; only 189 are June-created and missed solely by the old order. §12.1: **T1 net 4,115 rows (3,723 LEIs)** recoverable offline, 50/50 precision sample; 2,963 + 355 + 51 of the T1 rows were created July–Sept, when no resolver runs at all. | 4,115 T1 rows (+1,306 T2/T3 review) | RC-9 (no offline Level 1 matching since June) | — |
| **H13** Phase 1 full scans | **REFUTED** | D9 (day 1) and D7b-0930-explain: `SEARCH fund_holdings_monthly USING INDEX idx_holdings_security_name (<expr>=?)`. D7b: 110 executions, 159 reads. | 0 | — | — |

**F4 attribution** (acceptance criterion, D3-0929; the 29 Sep queue is 26,680 pending vs MA-OCT-000's 26,537):

| Status | Count | Cause |
|---|---|---|
| pending | 26,680 | 26,083 H1; 543 H8 stale (377 + 164 + 2 gov); 50 + 2 H9 (government/manager, no Phase 1 path); 2 H8 orphans |
| in_progress | 1 | H8, stuck since 11 Jun |
| failed | 1,220 | 902 + 11 H3 (isin, never re-selected); 264 fund (H8, out of scope); 41 + 2 H9 (manager/government name_search) |

**Integrity findings (W), under their Known Issue numbers:**

| KI | [W] | Finding | Size | Cause | RC |
|---|---|---|---|---|---|
| **22.40** | — | entities-seed sticky diff: `ON CONFLICT … WHERE name IS NOT excluded.name OR country IS NOT excluded.country` sets only `updated_at` (`entities-seed.js:392-398`) | **2,406 rows re-stamped on Mon 28 Sep** (vs 27,308 before the fix); about 2.4k per run, recurring | Guard compares fields it never writes | RC-11 |
| **22.41** | [W-A] | Duplicate twin pairs: a stale `normalized_name` key plus a new row on the correct key | **1,928 pairs** (1,582 created at the 23 Aug seed, 220 on 30 Aug, 107 on 29 Jul); 1,920 twins sit in H1's queue. Plus **743** no-LEI rows whose GC LEI is already on another row (§12.1) | `normalizeName` change (MA-SEP-001, 16 Aug) with no key migration; Phase 3 hydrates `name` but never `normalized_name` (`:331-343`) | RC-10 |
| **22.42** | [W-B] | HTML-escaped names (`&amp;`) | 105 `entity_master` names (June-created), **90 with an unescaped twin**; 106 Phase 1-eligible queue rows, 80 of them in Phase 1's permanent head | Unescaped source text at the June load | RC-2 / RC-10 |
| **22.43** | [W-C] | Wrong `NO_LINK_DECLARED` markers | **661** with an ACTIVE GC direct parent; **≥593 wrong when written**; 25/25 confirmed live by the API on 1 Oct | H6: Phase 3 writes the generic marker without reading the relationship result correctly, or the June bulk writes did (281 written in June, 356 in Sept) | RC-5 |

**Size of the prize:** §12.3 (FIRST CUT).

## 14. Day 5 (Fri 2 Oct 2026): fuzzy T3, full classification, 400-entity sample, completeness (Report 3)

**Preflight.** Run instructions `claude/MA-OCT-006_Day5_Run_Instructions.md`, SHA-256 `b5cb73b3…6bf4`, verified. 05:17 UTC (re-run 05:35 UTC on receipt of the instructions file):
- branch `October-2026`, HEAD `da38cf5`; no `.git/*.lock`;
- Spec `1dab3539…b7273` and Spec Review `6ae65d79…06` match;
- `DAY5` created; `du -sh WORK` = 4.1G.

**Today: 0 D1 reads, 0 D1 writes, 0 GLEIF API calls, no `/run`, no deploys, no git writes.** Inputs are the DAY2 exports (29 Sep), the DAY3/DAY4 outputs and `gleif_006.db` (GC 2026-09-28 16:00 UTC). Scripts are in `WORK/`: `day5_buckets.py`, `day5_t3_fuzzy.py`, `day5_script_gap.py`, `day5_classify.py`, `day5_tiers_rev.py`, `day5_sample.py`, `day5_adjudicate.py`, `day5_completeness.py`.

### 14.1 In-lane rulings and deviations (day 5). Also listed under "Rulings for the Main Lane" in Report 3

| # | Ruling | Effect |
|---|---|---|
| D5-1 | A no-LEI row whose matched GC LEI is **already on another D2 row** is classified **(c) duplicate entity** (RC-10, KI 22.41). Rule 2 would say (d), because the row is queued, but no pipeline should deliver an LEI that another row already holds. The fix is a merge, not hydration. | 1,349 rows (exact). Run 2 adds 852 found by the extended key (medium). |
| D5-2 | **Script-gap capacity guard.** The literal test labels 10,221 remainder entities "script gap": no Latin GC candidate in the country, and the country has ≥1 native-only record. That is not credible. For example, the US has 4,338 such entities but **3** native-only GC records. The per-entity label is therefore applied only where the country's native-only pool can hold every no-Latin-candidate entity. | 3,025 labelled (CN 2,969). Upper bound 3,422. |
| D5-3 | A valid-LEI parent gap where GLEIF holds **neither RR nor RX** is classified **(b) "no Level 2 data at GLEIF"**, confidence medium. Rule 1′ does not list this case. | 40 direct, 40 ultimate |
| D5-4 | A **LAPSED** unique exact GC match with country agreement is treated as "GLEIF holds the value". A lapsed LEI still identifies the entity. On day 4 these sat in a "(b) candidate" bucket. | 1,343 rows → (d), medium |
| D5-5 | For a no-LEI entity, the **country gap follows the lei gap's category**. GLEIF can only supply the country through the matched LEI. | 91 (a), 1 (c) |
| D5-6 | **The one permitted rule revision (run 2)**, after run 1 failed the sample thresholds (§14.6). Rev-A: a `name_search` queue row with no consumer is (d) for every type (H1 precedes H9; run 1 had government/manager as (c)). Rev-B: the "government with no GC match → (b)" shortcut is dropped (→ (a)). Rev-C/D/E: an extended key **N+** (Unicode/diacritic fold, `&`→AND, punctuation→space, `/QUALIFIER` tails dropped, CIE/CIA/INTL/NATL expanded, all trailing legal-form tokens stripped). Country agreement now accepts the GC legal **or HQ** country. An exact-but-ambiguous match is resolved when exactly one candidate's country agrees. | **The classification of record is run 2.** Its N+-derived rows (T1+ 1,407, T1c 334, duplicate N+ 852; all `confidence=medium`, `evidence_ref` contains "N+ key") **fail the §5.3 98% test on the sample (23/26)**. They are counted as "recoverable with review", not reliable. Run 1 is kept: `WORK/day5/run1/`. |
| D5-7 | **Adjudication standard.** "True category" means whether a reviewer can identify the entity's LEI in GC with confidence, not whether the §5.3 tier engine could. A tier-literal standard would make the test close to circular. | That is why T2/T3/no-candidate rows that a reviewer resolves count as disagreements. |
| D5-8 | **H7 extended to all LEI-bearing rows.** 63 automatic LEI/name mismatches were checked by eye: 24 wrong LEIs and 1 uncertain. | 25 W rows (RC-12); see §14.4. |

### 14.2 Step 2: fuzzy T3 and script gap (0 reads)

**Method.**
- Metric: fuzzywuzzy's pure-Python `token_sort_ratio`, i.e. `difflib.SequenceMatcher` over sorted tokens, ≥ 0.92.
- Inputs: current `normalizeName` output, against all 3.95M distinct GC legal, other and transliterated keys.
- Candidate blocking: names sharing one of the query's 3 rarest tokens, then a necessary length window.
- Scope: the 18,739 no-exact-match entities (remainder plus pattern classes).
- Runtime 6.9 min on 10 cores.

**Remainder (15,960, §12.3):**

| Result | Entities |
|---|---|
| **T3 unique fuzzy** (→ (a) "recoverable with review") | **1,419** (country agrees 1,116; GC ISSUED 937, LAPSED 451, RETIRED 25, DUPLICATE 5, PENDING_TRANSFER 1) |
| Fuzzy ≥ 0.92 but to more than one LEI | 371 |
| **Stays "none"** | **14,170** |
| ↳ no Latin-script GC name in the same country carries all of its distinctive tokens | 11,831 |
| ↳ **"(a) script gap"** (D5-2 label) | **3,025** (CN 2,969, RU 21, GR 15, BE 9, other 11). Upper bound 3,422. The literal, unguarded test gives 10,221. |

- Pattern classes (2,779) for reference: 281 unique fuzzy, 208 ambiguous, 2,290 none.
- Native-only GC records (non-Latin legal name and no Latin other or transliterated name) total **92,118**, and **90,344 of them are CN**. JP (53), KR (15), TW (54), HK (47) and TH (55) have almost none. So the day-4 reading ("Asian issuers whose GLEIF legal name is native-script only") holds **for China only**. The JP/KR/TW remainder mostly has no GC record at all.
- **Fuzzy precision spot check:** 25 random remainder T3-unique rows, **21/25 correct (84%)**. The wrong ones are ProMOS→RoMo B.V., Santander Bank Polska→Erste Bank Polska, Norstar→Nyrstar, and Retail Partners (JP)→CM Retail Partners (US). This confirms T3 is correctly "not reliable".
- Files: `day5/t3_fuzzy.csv` (18,739 rows, SHA `d4a78a19…40be`), `day5/t3_fuzzy_summary.json`, `day5/script_gap_summary.json`.

### 14.3 Step 3: full classification (0 reads)

> **Corrected later:** the classification of record is the **day-7 re-sync** (run 2 plus D6-1, D6-4 and D6-5). Its counts and diff are in §16.3.

**Scope:** all 43,998 D2 rows. Funds are reported as `F`.

**Acceptance check:**
- **76,624 gaps expected by the §5.1 definitions; 76,624 classified; 0 unclassified.** 0 duplicate (entity, field) gap rows.
- Of the gaps, 76,044 are non-fund and 580 are fund.

Outputs:
- `WORK/day5/classification.csv` (run 2, 80,092 rows: gap rows plus W rows) → copied to `claude/MA-OCT-006_classification.csv`. Size 6.8 MB, so no gzip (N-2). **SHA-256 of both: `f364449c8a8c0b5843bed19626d634c47fa3f509604cea3cc9b95ee2f2dc3638`.**
- Run 1: `WORK/day5/run1/classification.csv`, SHA `4df288ef…fb68`.

**Category × field (gap rows; run 2, with run 1 in brackets where it differs):**

| Field | (a) | (b) | (c) | (d) | F (fund) | Total |
|---|---|---|---|---|---|---|
| `lei` | 17,628 [20,180] | 53 [94] | 2,201 [1,356] | 7,199 [5,451] | 290 | 27,371 |
| `direct_parent_lei` | 0 | 15,846 | 661 | 71 | — | 16,578 |
| `ultimate_parent_lei` | 0 | 15,773 | 731 | 74 | — | 16,578 |
| `name` | 0 | 0 | 859 | 7,426 | 0 | 8,285 |
| `country` | 91 | 0 | 5 | 7,426 | 290 | 7,812 |
| **Total** | **17,719** | **31,672** | **4,457** | **22,196** | **580** | **76,624** |

**Category × entity type (gap rows, run 2):**

| Type | (a) | (b) | (c) | (d) |
|---|---|---|---|---|
| operating | 17,592 | 10,558 | 3,589 | 7,190 |
| holding | 0 | 20,994 | 860 | 14,997 |
| government | 41 | 118 | 8 | 9 |
| manager | 86 | 0 | 0 | 0 |
| spv | 0 | 2 | 0 | 0 |
| **fund (separate)** | | | | F = 580 (290 `lei`, 290 `country`) |

**Headline category per entity (run 2):**

| Type | (a) | (b) | (c) | (d) | No gap |
|---|---|---|---|---|---|
| operating | 17,544 | 5,340 | 2,857 | 7,190 | 0 |
| holding | 0 | 10,500 | 29 | 71 | 19 |
| government | 41 | 59 | 5 | 9 | 0 |
| manager | 43 | — | — | — | — |
| spv | — | 1 | — | — | — |

Funds: 290 (separate).

**How the `lei` gaps are built (run 2):**

| Category | Bucket | Rows |
|---|---|---|
| (d) | T1 reliable | 4,115 (H1 / RC-1 etc.) |
| (d) | T1_LAPSED (D5-4) | 1,343 |
| (d) | T1+ (N+) | 1,407 |
| (d) | T1c | 334 |
| (c) | Duplicate entity | 1,349 exact + 852 N+ |
| (b) | RETIRED / ANNULLED | 49 / 4 |
| (a) | No candidate | 12,209, including 39 government |
| (a) | Script gap | 3,011 |
| (a) | T3 fuzzy review | 991 |
| (a) | Fuzzy ambiguous | 531 |
| (a) | T3 exact ambiguous | 458 |
| (a) | T2 country-disagrees | 348 |
| (a) | Non-issuer strings | 72 |
| (a) | GC DUPLICATE status (D4-1) | 8 |

The (d) `lei` rows break down by RC as RC-1 6,747, RC-3 452 (H3 failed/isin) and RC-6 0.

**Relationship check (§7.2) over all 16,627 LEI-bearing entities:**

| Gap category | Direct | Ultimate | Detail |
|---|---|---|---|
| (b) RX exception | 15,711 | 15,638 | Direct reasons: NON_CONSOLIDATING 10,367, NO_KNOWN_PERSON 4,195, NATURAL_PERSONS 582, NON_PUBLIC 339, NO_LEI 226, other 2 |
| (b) Lapsed or retired, no Level 2 data | 95 | 95 | |
| (b) No RR and no RX (D5-3) | 40 | 40 | |
| (c) ACTIVE RR parent, `NO_LINK_DECLARED` written | **661** | **731** | Direct = KI 22.43 |
| (d) ACTIVE RR parent, still in the Phase 3 pool | 71 | 74 | |
| Filled parents | 49 | 49 | All agree with RR (0 contradicted) |

`legal_parent` edges against the mirror fields (66 edges):
- 62 match their mirror;
- 4 are KI 22.9;
- 0 edges have no mirror, and 0 mirrors have no edge.

**W findings (outside the four-way count; W rows in the CSV):**

| W item | Rows |
|---|---|
| KI 22.41 `entity_row` | 2,671 (1,928 twin pairs + 743 LEI-on-other-row) |
| KI 22.43 `direct_parent_exception` | 661 |
| KI 22.42 escaped `name` | 105 |
| Wrong LEI (RC-12) | 25 (§14.4) |
| Literal `'NULL'` string in `lei_status` | 2 |
| KI 22.9 `legal_parent_edge` | 4 (§14.5) |

The sample also implies that duplicates are wider than KI 22.41's exact-key pairs: 852 more via N+, and §14.6.

### 14.4 H7 extended: wrong LEI on LEI-bearing rows (W, RC-12)

> **Corrected later:** OPAP is cleared, leaving **24** wrong LEIs (D6-4, §15.3).

- An automatic name check against each LEI's GC names covered 8,342 named LEI-bearing rows: 8,227 exact, 13 fuzzy, 39 token-subset and **63 mismatches**.
- All 63 were checked by eye:
  - **38 are fine.** They are renames of the same legal entity (Cinedigm→Cineverse, Career Education→Perdoceo, Ocwen→Onity, J2 Global→Ziff Davis, General Electric→GE Aerospace), suffix or abbreviation variants, or script variants.
  - **24 are wrong LEIs.** 18 carry the **subsidiary's** LEI on the listed parent: Investar, United Community Banks, United Fire, Graphic Packaging, Franklin Financial, Carter Bankshares, Oak Valley, ServisFirst, Chemung, Bar Harbor, Amalgamated Financial, Mid Penn, Sierra Bancorp, City Holding, MDU Resources, Jacobs Solutions, Old National, Wendy's. 6 carry **another or predecessor entity's** LEI: Crescent Energy (Contango), Chord (Whiting; Chord has its own LEI), SLM (Navient; d5 exception 1), Mercury General (Grand Peak Capital), Alpha Metallurgical (Alpha Natural Resources), APA Corp (Apache).
  - **1 is uncertain:** OPAP Holding SA vs ALLWYN AG (d5 exception 3).
- **Cause:** 23 of the 25 came from the June `isin_direct` bulk mapping, which took the ISIN issuer's LEI. The H7 upsert code path is still clean (§13).
- **W rate:** 25 / 8,342 = 0.30% of named LEI-bearing rows. In the sample, 2 of 164 LEI-bearing entities (1.2%).

### 14.5 Step 4: KI 22.9 (separate W item; route to MA-OCT-003/004 as a DQ ticket, not to 011)

| Edge (parent → child) | D4 rowid / created | Parent | Child (type, LEI) | RR child→parent | d5 exception | Child's GC match today |
|---|---|---|---|---|---|---|
| 1565 → 3 | 265 / 2026-06-10 19:51:32 | Cheniere Energy Inc (`MIHC87W9…`) | Alerian MLP ETF (fund, no LEI) | **none** | id 4, `accepted_no_fix` | `549300WPBLCQJSVVVV61` ALERIAN MLP ETF (ISSUED); its only RR is fund-managed-by / subfund-of |
| 2247 → 143 | 267 / 2026-06-11 00:00:55 | General Motors Company (`54930070…`) | PIMCO Enhanced Short Maturity Active ETF (fund) | **none** | id 5 | `VOYE9Z80GB9431LFS645` (prefix match, ISSUED); fund RR only |
| 2476 → 49 | 266 / 2026-06-10 20:00:59 | Banco Comercial Português (`JU1U6S0D…`) | iShares MSCI Poland ETF (fund) | **none** | id 6 | `549300AWENQCY4VS9S36` (exact, ISSUED); fund RR only |
| 6980 → 194 | 268 / 2026-06-11 02:00:56 | ABB Ltd (`5493000L…`, type `holding`) | SPDR Portfolio Short Term Corporate Bond ETF (fund) | **none** | id 7 | no GC match by name |

- **Verdict:** confirmed **W**. No relationship exists in RR between any child (or its GC match) and the parent. All four children are funds (fund-manager relationships only). Root cause: **the MA-SEP-001 merge.**
- Edge `source='gleif'`, created on 10–11 Jun.
- Routed as one aggregate DQ ticket to MA-OCT-003/004. **Excluded from MA-OCT-011.**

### 14.6 Step 5: the 400-entity adjudicated sample (spec §6.4)

> **Corrected later:** the T1 precision basis was strict n = 79 distinct, now 150/150 with lower bound 98.02% (D6-3, §15.2). Run-2 agreement is 357/400 after the D6-1 re-sync (§16.3).

**Draw.**
- Seed **20261002**, `day5_sample.py`, non-fund only.
- Cells (type × LEI state) and their allocation (base = min(15, size), the rest proportional):

| Cell | Population | Sampled |
|---|---|---|
| operating, no LEI | 26,986 | 206 |
| operating, valid LEI | 5,945 | 57 |
| holding, valid LEI | 10,619 | 90 |
| government, valid LEI | 62 | 16 |
| government, no LEI | 52 | 15 |
| manager, no LEI | 43 | 15 |
| spv, valid LEI | 1 | 1 |

- There are no malformed LEIs, so the "malformed" stratum is empty.
- Inside each cell: implicit proportional stratification by country bucket × derived source (sorted, then a systematic draw from a seeded start).

**Adjudication.**
- Evidence files: `day5/sample400_evidence.txt` (raw GC/RR/RX facts, no rule output; SHA `740ab14c…df26`), `day5/sample_lei_compact.txt` and `day5/sample_nolei_compact.txt`.
- Two batches of targeted GC lookups on uncertain rows.
- Every row was read by eye. Decisions are encoded in `WORK/day5_adjudicate.py` (`FOUND`: the LEI a reviewer identified, with confidence and note).

**Result.**

| | Run 1 (spec rules as built) | Run 2 (after the one revision, D5-6) |
|---|---|---|
| **Overall agreement** | **341/400 = 85.3%: FAIL (≥95%)** | **359/400 = 89.75%: FAIL** |
| operating, no LEI (n=206) | 157 = 76.2%: **FAIL** | 177 = 85.9%: **FAIL** |
| government, no LEI (n=15) | 5 = 33.3%: **FAIL** | 3 = 20.0%: **FAIL** |
| operating, valid (57) / holding, valid (90) / government, valid (16) / manager, no LEI (15) | 100% each | 100% each |
| Confusion (rule → true) | a→d 34, a→c 15, b→d 5, b→c 3, c→d 2 | a→d 23, a→c 11, a→b 4, d→a 3 |

**Run 2 was measured on the same sample that informed the revision, so its 89.75% is optimistic.**

**What the disagreements are.** In every case the reviewer found the LEI that the rule missed. None is a wrong (c)/(d):
1. **Normalizer gaps** (`CO.,LTD`→`COLTD`; only one suffix stripped; `/The`, `/Canada`, `/DE` tails; diacritics, e.g. Sabancı; `Cie`; `&`).
2. **Country test on HK-listed issuers** incorporated in KY, BM or CN (Longfor, Man Wah, Qingdao Port, Everest Medicines).
3. **Same-name LEIs** that country or status separates (Merus, TIM, Agnico Eagle, Banyan Tree).
4. **Renames** (Ponce←PDL, HD Hyundai Mipo).
5. **Sovereigns** registered under another form (Federal Republic of Nigeria, Republica del Peru, Republik Österreich, a finance ministry or Treasury).
6. **Duplicate entities** whose LEI is already on another D2 row: Mosaic, Omega, FNMA, Compagnie des Alpes, PBF, Asbury, Broadway, CAPREIT, Shionogi/T&D (KI 22.42 twins), IBRD, Austria, Peru, Federal Realty.

So the rules **under-count recoverable LEIs**. They do not mislabel what they do recover.

**T1 precision (spec T1 tier only):**
- Sampled T1 rows: **38/38 correct.** Together with the day-4 50: **88/88 = 100%.**
- **The one-sided 95% (Clopper–Pearson) lower bound is 96.65%, which is BELOW 98%.** The combined sample cannot show ≥98%. Zero errors over at least 149 rows would be needed.
- Revision tiers on the sample: T1+ 14/15, T1c 2/4, duplicate-N+ 7/7. They are not reliable (D5-6).

**Sample-weighted estimate of the TRUE headline category** (cell weight = population ÷ n):

| Cell | (a) | (c) | (d) |
|---|---|---|---|
| operating, no LEI | **≈ 14,410** | **≈ 3,406** | **≈ 9,170** |

- The (a) share in that cell is 53.4% ± 6.8 pp (95%).
- Government, no LEI: (b) 14, (c) 14, (d) 24.

**Files:**

| File | Rows | SHA-256 |
|---|---|---|
| `WORK/day5/sample400.csv` (run 2, with run-1 columns) | | `be592598…745b6c` |
| `claude/MA-OCT-006_sample_adjudication.csv` | 400 + header; the note carries `run1_rule=` | `ec8671a383fd406cee3e8cb4d1f33b084f232464a9c9ec6207007b2f2d1294e3` |
| `day5/sample400_draw.csv` | | `d139630f…a8f` |
| Run 1 `day5/run1/sample400.csv` | | `4c324b92…ef80` |

### 14.7 Step 6: completeness (spec §7.1; run 2)

> **Corrected later:** the re-synced completeness figures are in §16.4.

**Baseline cross-check:** D2 LEI fill = **16,627 / 43,998 = 37.8%**. **Reproduced.** Non-fund only: 16,627 / 43,708 = 38.0%.

**Raw vs achievable fill.** Achievable = filled ÷ (filled + (c) + (d)).

| Field | In scope | Filled | Raw | (c)+(d) | **Achievable** |
|---|---|---|---|---|---|
| `lei` (non-fund) | 43,708 | 16,627 | **38.0%** | 9,400 (run 1: 6,807) | **63.9%** (run 1: 16,627 / 23,434 = 71.0%) |
| `direct_parent_lei` (valid LEI) | 16,627 | 49 | **0.29%** | 732 | **6.3%** |
| `ultimate_parent_lei` (valid LEI) | 16,627 | 49 | **0.29%** | 805 | **5.7%** |
| `name` (all) | 43,998 | 35,713 | 81.2% | 8,285 | 81.2% (every placeholder is recoverable; see note) |
| `country` (all) | 43,998 | 36,186 | 82.2% | 7,431 | 83.0% |

**Note on "achievable" for `lei`:** it falls as recoverable gaps are found. Filled stays constant while the denominator grows. The useful reading is the **recoverable count**: 9,400 rows (run 2), of which 5,464 are reliable (1,349 duplicates + 4,115 T1), against the sample's true estimate of ≈ 12.6k.

**Note on `name` and `country`:** "achievable = raw" because the 8,285 placeholders are themselves (c)/(d). Once hydrated, `name` reaches 100% of LEI-bearing rows.

**`lei` by cut (raw → achievable):**

| Cut | Raw | Achievable | Notes |
|---|---|---|---|
| Type: operating | 18.1% | 38.8% | |
| Type: government | 54.4% | 84.9% | |
| Type: holding / spv | 100% | 100% | |
| Type: manager | 0% | — | all (a) |
| Country: US | 27.9% | 59.0% | |
| Country: EU+UK | 68.5% | 80.4% | |
| Country: other | 9.6% | 22.4% | |
| Country: NULL | 99.4% | 100% | |
| Source: holdings-seed | 4.7% | 12.4% | |
| Source: GLEIF bulk / FIRDS / enrich-parent | 100% | 100% | by construction |
| LEI state | — | — | valid 100%, none 0% (by definition) |

**`direct_parent_lei` by cut (raw → achievable; `ultimate_parent_lei` within ±1 pp):**

| Cut | Raw | Achievable |
|---|---|---|
| Type: holding | 0.46% | 40.8% (49 filled + 71 (d)) |
| Type: operating | 0% | 0% (658 (c), so achievable = 0/658) |
| Type: government | 0% | 0% (3 (c)) |
| Source: GLEIF bulk | 0% | 0% (396 (c)) |
| Source: holdings-seed | 0% | 0% (265 (c)) |
| Source: FIRDS | 0.40% | 38.2% |
| Country: EU+UK | 1.04% | 13.6% |
| Country: US | 0% | 0% |
| Country: other | 0.34% | 3.7% |
| Country: NULL | 0% | 0% |

**Where the parent numbers come from.**
- 95.6% of LEI-bearing direct-parent gaps are **(b)** (a GLEIF reporting exception).
- The parent "prize" is the 661/731 (c) KI 22.43 rows plus 71/74 (d).
- Full tables: `WORK/day5/run2/completeness.json`.

### 14.8 Pilot H11 check (Step 7; read-only; session open after 11:05 UTC)

Read at 12:36 UTC: `CA/logs/entities-enrich-boost.log`, `CA/logs/entities-enrich-boost-heartbeat.log` and the launchd stdout/stderr.

| Check | Result |
|---|---|
| (i) Boost-log lines after the split (2026-10-01 19:08:13 UTC) keep the old format and outcome values | **PASS.** One line: `2026-10-02T10:50:03.689Z \| error \| headroom check failed: wrangler d1 execute failed: … Cloudflare API …`. It has 5 fields, exactly like the pre-pilot error line of 30 Sep 10:59. The outcome values ever used are `error` 36, `fired` 40 and `paused` 1. Nothing new. |
| (ii) Heartbeat lines appear only in the heartbeat log | **PASS.** 0 occurrences of `run_id`/heartbeat text in the boost log or the launchd logs. The heartbeat log holds one line: `2026-10-02T10:50:05.702Z \| failed \| run_id=e38fff34-… \| not delivered: TimeoutError`. |
| (iii) Every fire has its boost-log line, even if its heartbeat failed | **PASS.** The boost-log line (10:50:03.689) was written **before** the heartbeat attempt (10:50:05.702). The heartbeat then failed to deliver (TimeoutError). There was no `start` event, as expected under ML-2, because the pre-flight failed before `/run`. |
| (iv) Fire time against its 10:50 UTC slot | **On time:** the fire started 10:50:01.604Z (launchd stdout), minute 50, in window. |

- **H11 reading after the split: 1 attempt, 1 error** (wrangler / Cloudflare API code 10000 at the headroom check, as on 14 of the earlier 30). `/run` was not called, so Phase 3 did not advance at 10:50.
- **For the MA-OCT-001 lane** (a note, not a ruling): the `failed` heartbeat was **not delivered** (`TimeoutError`), so Ops did not see this failure. The local log has it.
- The 16:50 UTC slot is **carried to Report 4**, unless this session is still open after 17:05 UTC.

### 14.9 Size of the prize: UPDATED (replaces the §12.3 first cut; run 2; D2 29 Sep)

> **Corrected later:** T1 is 4,109 rows / 3,717 LEIs (D6-1), and parent gaps are 1,529 (D6-5). See §15 and §16.

**No-LEI, non-fund entities: 27,081.** Buckets are mutually exclusive.

| # | Bucket | Rows | Class | Reliability |
|---|---|---|---|---|
| 1 | Duplicate entity: matched LEI already on another D2 row (exact key) | 1,349 | (c) + W 22.41 | high (merge, not hydrate) |
| 2 | Duplicate entity found by the N+ key | 852 | (c) + W 22.41 | medium (7/7 on the sample) |
| 3 | **T1 reliable** (unique exact, country agrees, ISSUED/PENDING) | **4,115 rows (3,723 LEIs)** | (d) | high (88/88; lower bound 96.65%) |
| 4 | T1 with LAPSED GC status (D5-4) | 1,343 | (d) | medium |
| 5 | T1+ / T1c (N+ key, HQ country, country-disambiguated) | 1,407 / 334 | (d) | **not reliable** (14/15, 2/4) |
| 6 | GC RETIRED / ANNULLED | 53 | (b) | high |
| 7 | Review candidates: T3 fuzzy 991, exact-ambiguous 458, fuzzy-ambiguous 531, T2 348, DUPLICATE-status 8 | 2,336 | (a) "recoverable with review" | — |
| 8 | Script gap (CN-dominated, D5-2) | 3,011 | (a) | medium |
| 9 | Non-issuer strings (cash, derivatives, exchanges, MMF) | 72 | (a) | high |
| 10 | No GC candidate | 12,209 (39 government) | (a) | high |

**Reading.**
- **Reliable LEI recovery: 4,115 rows** (3,723 LEIs, of which ~385 are shared by KI 22.41 pairs), plus **1,349 merges**.
- With the medium tiers: up to ~9,400.
- **Sample-weighted truth:** ≈ 12.6k recoverable ((c) ≈ 3.4k, (d) ≈ 9.2k) and ≈ 14.4k with no LEI to find.

**LEI-bearing entities: 16,627.**
- Parents recoverable from RR: 732 direct + 805 ultimate (all KI 22.43 or Phase 3 pool).
- 15,846 / 15,773 have a real GLEIF exception reason that D1 currently flattens to `NO_LINK_DECLARED` or leaves blank (H6).
- 8,285 placeholders can be hydrated from GC L1 (name), and 7,426 can also get country and status.

## 15. Day 6 (Fri 2 Oct 2026): pilot 16:50 check, T1 top-up, wrong-LEI detail, matrix, 011 assessment, DRAFT close-out (Report 3b)

**Preflight, 17:15 UTC:**
- Run instructions `claude/MA-OCT-006_Day6_Run_Instructions.md`, SHA-256 `c62e718edcab1a6791db524798c7ad00379f48a5de0b2a6b0b44ffbd099d8582`, verified.
- Branch `October-2026`; no `.git/*.lock`.
- Spec `1dab3539…b7273` and Spec Review `6ae65d79…06` match.
- `DAY6` created; `du -sh WORK` = 4.1G before and after.

**Today: 0 D1 reads, 0 D1 writes, 0 GLEIF API calls, no `/run`, no deploys, no git writes.** Inputs: the DAY2 exports (29 Sep), DAY3–DAY5 outputs, and `gleif_006.db` (opened `mode=ro`). Scripts in `WORK/`: `day6_t1_topup.py`, `day6_wrong_lei.py`, `day6_wrong_lei_final.py`, `day6_costs.py`, `day6_costs2.py`. Rulings D6-1 to D6-6 are in §7.

### 15.1 Pilot H11 check (16:50)

Read at 17:15 UTC: `CA/logs/entities-enrich-boost.log`, `CA/logs/entities-enrich-boost-heartbeat.log`, and the launchd stdout/stderr. The runner `entities-enrich-boost-run.mjs` (SHA `f92bd2d2…1d78`, unchanged since `da38cf5`) was read only.

| Check | Result |
|---|---|
| (i) Boost-log format and outcome values unchanged | **PASS.** One line: `2026-10-02T16:50:05.134Z \| fired \| utc_minute=50 in_window=true writes_today=0 headroom=100000 response={"ok":true,"message":"Enrichment triggered"}`. This is the same 3-field `fired` layout as every pre-pilot `fired` line. Outcome values ever used: `error` 36, `fired` 41, `paused` 1. Nothing new. |
| (ii) Heartbeat lines only in the heartbeat log | **PASS.** 0 `run_id`/heartbeat occurrences in the boost log or the launchd stdout/stderr. The heartbeat log gained 2 lines: `16:50:05.048Z \| start \| run_id=101a6ae5-… \| HTTP 201 {"ok":true,"recorded":true}` and `16:50:05.253Z \| success \| run_id=101a6ae5-… \| HTTP 201 {"ok":true,"recorded":true}`. |
| (iii) Boost-log line written even if the heartbeat failed | **PASS (the order holds).** The heartbeat did not fail this time. The terminal `success` (16:50:05.253) came **after** the boost-log line (16:50:05.134), as the runner requires (`:305` `appendRunLog` then `:308` `await heartbeatEnd`). `start` (16:50:05.048) went before the boost-log line. That is consistent with ML-2: `start` is concurrent with `/run`, not awaited first, and never writes to the boost log. |
| (iv) Fire time against the 16:50 slot | **On time.** The fire started at 16:50:01.789Z (launchd stdout): minute 50, in window. |
| `/run` called? | **Yes.** HTTP 200 `{"ok":true,"message":"Enrichment triggered"}`. |
| Terminal heartbeat | **Delivered** (`success`, HTTP 201). |

- **H11 after the split (2026-10-01 19:08:13 UTC):** 2 attempts. One errored (10:50, wrangler code 10000, `failed` heartbeat not delivered) and one fired (16:50, both events delivered).
- **Since 16 Sep:** 34 attempts, **15 errors (44%)**, 19 fired. 17 of the 19 fires read `writes_today=0`. The two non-zero reads were Sundays (20 and 27 Sep), when the holdings job writes the key (RC-14).
- Phase 3 should have advanced 44 entities at 16:50. That is not verified, because no D1 read was made today.
- Later fires: none. The run ended before 3 Oct.

### 15.2 T1 precision top-up (Step 2)

**Basis correction (D6-3).** §14.6's "38/38 (spec T1 tier only)" counted 31 `T1` plus 7 `T1_LAPSED(D5-4)` sample rows (`day5_adjudicate.py:125`). Under D6-1, one of the 31 (106518 Kingdom of Morocco) is excluded. Entity 110291 was checked on both day 4 and day 5. **So the strict prior checked T1 is 50 (day 4) + 30 − 1 = 79 distinct entities.** The recorded figure was 88.

**Draw.**
- Seed **20261003**, `random.Random(20261003).sample` of **71** rows. The draw was first run at k = 70. When the 110291 overlap was found, it was extended to k = 71. The first 70 picks are identical, because `random.sample` picks sequentially, so the draw is just continued, not redrawn.
- Pool: the 4,115 run-2 T1 rows, minus 6 government (D6-1) = 4,109, minus the 87 distinct entity_ids already checked (day-4 50 plus sample T1/T1_LAPSED 38, with 110291 in both) = **4,030**.
- Script `WORK/day6_t1_topup.py`; draw metadata in `day6/t1_topup_draw_meta.json`.

**Check.** Each row was read by eye against its GC L1 record: legal name plus other and transliterated names, legal-address and HQ country, ELF legal-form code, entity status and registration status. This is the 1 Oct standard.

**Result: 71/71 correct.**
- All 71 are ACTIVE/ISSUED.
- All countries agree. Kaltura has a legal address in the US and HQ in IL.
- Every name equals the GC name modulo suffix punctuation and case. Some matched through a GC other or transliterated name: Air China, Yageo, Winbond, LG Innotek, Hennge, The Wharf (Holdings), Trina Solar (row 71), and others.
- Legal forms are consistent with the holdings suffix.
- Rows looked at closely, all correct:
  - Vanguard Real Estate II Index Fund: correct identity, but D2 types it `operating` though it is a fund. That is a type issue, not an LEI error.
  - Madison Park Funding XLII (formerly Atrium VIII).
  - Edenbrook Mortgage Funding (its 2022-1/2023-1 names are renames of the same LEI).
  - RAK Capital.
  - Saudi Electricity (now Saudi Energy Company).
  - Ten Sixty Four (formerly Medusa Mining).

| Basis | Combined n | Errors | One-sided 95% lower bound (Clopper–Pearson) | Reaches 98%? |
|---|---|---|---|---|
| **Strict spec T1, after D6-1, distinct** (79 + 71) | **150** | **0** | **98.02%** | **YES** |
| Recorded §14.6 tiers, distinct (87 + 71) | 158 | 0 | 98.12% | YES |

**T1 is reliable at the §5.3 98% standard.** T1 count after D6-1: **4,109 rows / 3,717 LEIs**.

Files:
- `day6/t1_topup.csv` (71 rows; per-row checks, verdict and note), SHA `c58cc2bef0962b54c9c6be80e82b082f80e3b6542e6fe066b71e2c6d4f3f12dc`;
- `day6/t1_topup_review.csv`, SHA `6ad7267f…626e`;
- `day6/t1_topup_draw_meta.json`, SHA `d5e91355…bed6`.

### 15.3 Wrong-LEI detail (Step 3; the new integrity class)

All 25 W-H7 rows were re-examined against GC L1, RR and RX. Scripts `day6_wrong_lei.py` and `day6_wrong_lei_final.py`.

**Result:**
- **24 wrong LEIs**: 18 carry a subsidiary's LEI, 6 another or predecessor entity's LEI.
- **1 cleared** (OPAP, D6-4).
- Source: 23 `isin_direct` (the June bulk mapping) and 1 NULL (SLM).
- None of the correct LEIs is already on another D2 row.

| entity_id | Entity | Current LEI → GC legal name (status) | Class | GLEIF relationship between the two | Source | Correct LEI (T1) / other candidate |
|---|---|---|---|---|---|---|
| 528 | Investar Holding Corp | `549300CPKDUJKREQRG38` Investar Bank, N.A. (PENDING_TRANSFER) | subsidiary | none in RR; RX direct = NON_CONSOLIDATING | isin_direct | **T1** `54930001EK2YM28LOJ08` |
| 575 | United Community Banks Inc/GA | `T68X8LLAQYRNDV034K14` United Community Bank (ISSUED) | subsidiary | **RR ACTIVE: current is the direct and ultimate child of the correct LEI** | isin_direct | `549300GVW0FV66X3U703` (not T1: N+ "/GA" tail) |
| 576 | United Fire Group Inc | `549300ZRC3FQZU7GNY20` United Fire & Casualty Co (ISSUED) | subsidiary | none in RR; RX direct = NO_LEI | isin_direct | none in GC |
| 596 | Crescent Energy Co | `549300WN2AGOX1011V72` Contango Oil & Gas (LAPSED) | other/predecessor | none in RR; RX = NON_CONSOLIDATING | isin_direct | **T1** `254900FBNP5A21Q39U97` |
| 702 | Graphic Packaging Holding Co | `SO75N4VY5NXGQSK8YQ65` Graphic Packaging International, LLC (ISSUED) | subsidiary | none in RR; RX = NON_CONSOLIDATING | isin_direct | none in GC |
| 838 | Franklin Financial Services Corp | `5493008E3WZYM5146L29` Farmers and Merchants Trust Co of Chambersburg (LAPSED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 890 | Carter Bankshares Inc | `549300SO0M022D8D8358` Carter Bank & Trust (ISSUED) | subsidiary | none in RR; RX = NON_CONSOLIDATING | isin_direct | none in GC |
| 899 | Oak Valley Bancorp | `549300D2R9YSQ442G068` Oak Valley Community Bank (ISSUED) | subsidiary | none in RR; RX = NO_KNOWN_PERSON | isin_direct | none in GC |
| 902 | Chord Energy Corp | `52990028CHK9KUB1B293` Whiting Petroleum (LAPSED) | other/predecessor | none in RR; RX = NON_CONSOLIDATING | isin_direct | `529900FA4V2YNIKZ0M71` (not T1: LAPSED) |
| 927 | ServisFirst Bancshares Inc | `549300XSS1CPK8G7B851` ServisFirst Bank (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 931 | SLM Corp | `54930067J0ZNOEBRW338` Navient Corp (ISSUED) | other/predecessor (2014 spin-off) | none in RR; RX = NATURAL_PERSONS | NULL | `4K8SLPBF5DXXGPW03H93` (not T1: RETIRED) |
| 943 | Chemung Financial Corp | `549300WU17K1CLH8VI32` Chemung Canal Trust Co (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 1015 | Bar Harbor Bankshares | `549300VR3QTN4GZYUR03` Bar Harbor Bank & Trust (ISSUED) | subsidiary | none in RR; RX = NON_CONSOLIDATING | isin_direct | none in GC |
| 1049 | Mercury General Corp | `5493008B54WFZLDKD530` Grand Peak Capital Corp (LAPSED) | other | none in RR; RX = NON_CONSOLIDATING | isin_direct | `5493001Q9EXPCEL4W527` (not T1: LAPSED) |
| 1134 | Alpha Metallurgical Resources Inc | `549300C9E158C3V6PT51` Alpha Natural Resources (LAPSED) | other/predecessor | none in RR; RX = NON_CONSOLIDATING | isin_direct | **T1** `254900VEBGZO2PY8R678` |
| 1138 | Amalgamated Financial Corp | `254900FMBXF85WQYV433` Amalgamated Bank (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 1157 | Mid Penn Bancorp Inc | `254900L0MIAM922ZEC34` Mid Penn Bank (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 1162 | Sierra Bancorp | `5493003HTEY5OCC5SP27` Bank of the Sierra (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 1181 | City Holding Co | `549300KJZ82173UB3I21` City National Bank of West Virginia (ISSUED) | subsidiary | none in RR; RX = NO_LEI | isin_direct | none in GC |
| 1455 | MDU Resources Group Inc | `0T6SBMK3JTBI1JR36794` Montana-Dakota Utilities Co (ISSUED) | subsidiary | none in RR; RX = NON_PUBLIC | isin_direct | none in GC |
| 1514 | Jacobs Solutions Inc | `549300CZ8QS1GE53O776` Jacobs Engineering Group (ISSUED) | subsidiary | **RR ACTIVE: current is the direct and ultimate child of the correct LEI** | isin_direct | **T1** `254900E3KHXCC2C8K272` |
| 1803 | APA Corp. | `72ZZ1XRHOOU9P9X16K08` Apache Corp (LAPSED) | other/predecessor | none in RR (Apache LAPSED); RX = NON_CONSOLIDATING | isin_direct | **T1** `549300VCIWLRHYVSHC79` |
| 1809 | Old National Bancorp | `549300AT7EB9FJAF0E61` Old National Bank (ISSUED) | subsidiary | **RR ACTIVE: current is the direct and ultimate child of the correct LEI** | isin_direct | **T1** `549300MMK90CL5KMVX16` |
| 1868 | Wendy's Co/The | `549300PQTT267ME8D359` Wendy's International, LLC (ISSUED) | subsidiary | **RR ACTIVE: current is the direct and ultimate child of the correct LEI** | isin_direct | `529900M0JIUCMWVKHG76` (not T1: N+ "/The" tail; LAPSED) |
| 2014 | OPAP Holding SA | `213800M4NRGFJCI34834` ALLWYN AG (PENDING_TRANSFER) | **cleared: rename** (D6-4) | same legal entity (GC other name = OPAP S.A.'s full legal name) | NULL | n/a: the current LEI is correct |

**Summary:**

| | Rows |
|---|---|
| Wrong LEIs | **24** (subsidiary 18, other or predecessor 6) |
| ↳ correct LEI is a **T1** match | **6** (Investar, Crescent, Alpha Metallurgical, Jacobs, APA, Old National) |
| ↳ candidate found, not T1 (N+ tail, LAPSED or RETIRED) | **5** (United Community Banks, Chord, SLM, Mercury General, Wendy's) |
| ↳ no LEI for the listed company in GC | **13**. For 8 of these, GLEIF's own RX on the subsidiary says the parent has **NO_LEI**. |
| RR edge between the current and correct LEI | 4 (575, 1514, 1809, 1868). These 4 are excluded from parent backfill (D6-5). |
| Cleared | 1 (OPAP) |

**Fix route:** one aggregate DQ ticket to **MA-OCT-004** (matrix rank 14), owned by the Operations Lead with adjudication by the Data-Identity Lead. All 24 are excluded from MA-OCT-011. 006 proposes no fix beyond naming that owner packet.

Files: `day6/wrong_lei_detail.csv` (25 rows), SHA `41502aa7666e8aa36a396d3e4e5055d6562c381e363e9ffef257450efcb51c01`; `day6/wrong_lei_detail_raw.csv`, SHA `af024c26…481d`.

### 15.4 Ranked remediation matrix (Step 4)

> **Re-synced on day 7:** see §16.5.

The matrix is written to `claude/MA-OCT-006_Remediation_Matrix.md`. Ranking uses high-confidence counts only (D5-6), with medium counts in their own column. Every write cost is a "006 estimate" and is computed from row counts and the D0 index list (`WORK/day6/cost_counts.json`, `cost_model.json`).

| Rank | RC | Gaps (high) | 006 est. writes |
|---|---|---|---|
| 1 | RC-4 Phase 3 placeholder pool | 14,997 | 44,616 |
| 2 | RC-1 / RC-9 no consumer, no offline matching | 3,855 | ≤ 26,985 |
| 3 | RC-5 generic exception (KI 22.43) | 1,384 | part of C, 10,175 |
| 4 | RC-10 duplicates (KI 22.41) | 1,349 | ≈ 37,836 + repoints (MA-OCT-013) |
| 5 | RC-15 pre-MA-SEP-014 placeholders | 859 | 2,577 |

**R9 options:**
- **Option 1:** ≈ **100,373** writes; closes **20,957** high-confidence gaps.
- **Option 2:** ≈ **10,175** writes (4,740 without parent inserts); closes **1,529**.
- **MA-OCT-013:** ≈ 37,836 writes plus link repoints that 006 did not measure.

### 15.5 MA-OCT-011 go/no-go (Step 5; matrix §3)

> **Re-synced on day 7:** see §16.5. The outcomes are unchanged.

| # | Option 1 | Option 2 |
|---|---|---|
| 1 Enough to recover (1,529 ≥ 1,000; D6-6) | PASS | PASS |
| 2 Live path can't clear (1,384 processed KI 22.43 rows never re-selected; pool about 41–65 days) | PASS | PASS |
| 3 Identity reliable (sample W 2/164 = 1.2%; H7 = 0; 24 wrong LEIs excluded) | PASS | PASS |
| 4 Write budget (≤ 60k total, ≤ 20k/day) | **FAIL AS WORDED** (≈ 100k); see the 011 spec lane | PASS |
| 5 Separation (only `entity_relationships` and `entity_master` parent fields; KI 22.9 excluded) | **NOT APPLICABLE AS WORDED**; see the 011 spec lane | PASS. The 365 parent-entity inserts fall outside the wording. |
| 6 Observability (001 ingest live; 16:50 events delivered; 10:50 not delivered) | PASS (conditional) | PASS (conditional) |
| 7 Credentials (wrangler session or scoped secret, no literals) | PASS (design condition) | PASS (design condition) |

**006 recommendation:**
- **Option 1: DEFER under the §9.2 wording as it stands. GO if the Founder accepts the 011 lane's amended criteria 4 and 5.**
- **Option 2: GO**, as the fallback.
- **MA-OCT-013:** a separate packet, before or interleaved with bucket A.

### 15.6 DRAFT close-out summary (Step 6)

`claude/MA-OCT-006_Closeout_Summary.md` is written and marked **DRAFT — pending D10 trend snapshot and Operations Lead review**, with the Addendum §3 header.

### 15.7 Files written today

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-006_Remediation_Matrix.md` (new) | `ce93f54f432b4c01d00c0497897b5e4bee0eba25ab98b5e66eda0a9efa54bea6` |
| `claude/MA-OCT-006_Closeout_Summary.md` (new, DRAFT) | `942f4a0655a878de98c04f6cfbdec94bc8854924962c451e4f027be23a1b0abc` |
| `WORK/day6/t1_topup.csv` | `c58cc2bef0962b54c9c6be80e82b082f80e3b6542e6fe066b71e2c6d4f3f12dc` |
| `WORK/day6/wrong_lei_detail.csv` | `41502aa7666e8aa36a396d3e4e5055d6562c381e363e9ffef257450efcb51c01` |
| `WORK/day6/cost_counts.json` / `cost_model.json` | `1c16505e…e5b3` / `a4d8169f…a975` |

Also edited: this file (§7 day-6 rulings, §15) and `claude/MA-OCT-006_Query_Ledger.md` (day 6). No other repo file was touched. The MA-OCT-011 and MA-OCT-013 files were not edited.

## 16. Day 7 and final re-sync (Mon 5 Oct 2026; Report 4)

**Preflight, 19:42 UTC:**
- `caffeinate -i -t 14400` was running in the background (pid 6413).
- Run instructions `claude/MA-OCT-006_Day7_Run_Instructions.md`, SHA-256 `9c3761453e01ed6a555e2a51a6a86eb6d2f8824c61b6b210446111854a63d8be`, verified.
- Branch `October-2026`, HEAD `658326a`; no `.git/*.lock`.
- Spec `1dab3539…b7273`, Spec Review `6ae65d79…06`, Matrix `ce93f54f…bea6` and DRAFT close-out `942f4a06…0abc` all match.
- `DAY7` created; `du -sh WORK` = 4.1G.
- **The session opened after 07:05 UTC, so the order rule (no D1 before 07:05) was met throughout.** Steps ran in the order 0 → 2 → 3 → 1 → 4 → 5 → 6.

**Today: 34,938 D1 reads, 0 D1 writes, 0 GLEIF API calls, no `/run`, no deploys, no git writes.**

### 16.1 Final runtime snapshot (Step 1; 19:45 UTC)

Runner `WORK/run_day7.py` (it imports `run_day4.py`'s guarded `q()`), through `d1q.sh`. Each query was EXPLAINed in the as-run form first. Details are in the ledger.

**D10 (queue trend), 29,108 reads.** Plan: `SCAN entity_enrichment_queue USING COVERING INDEX idx_enrich_queue_status`, as expected.

| status | MA-OCT-000 baseline | D3-0929 (29 Sep) | **D10-1005 (5 Oct)** | Δ since 29 Sep |
|---|---|---|---|---|
| pending | 26,537 | 26,680 | **26,717** | +37 |
| complete | 1,170 | 1,170 | **1,170** | 0 |
| failed | 1,220 | 1,220 | **1,220** | 0 |
| in_progress | 1 | 1 | **1** | 0 |
| **total** | 28,929 | 29,071 | **29,108** | +37 |

**Reading:** the queue only grows (new rows from seed Step 4). **No row has changed status since MA-OCT-000.** F4 and H1–H3 still hold on 5 Oct.

**D8 (run state), 21 reads.** Plan: `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)`. The 12 keys are the 10 day-4 keys with today's dates, plus `etf_offset` and `last_run_status` (D7-4).

| Key | Value |
|---|---|
| `enrich_phase3_last_run_entities` / `_subrequests` / `_deferred` | 44 / 44 / 1 (unchanged since 30 Sep) |
| `enrich_combined_last_invocation_subrequests` | 44 |
| `hold_all_jobs` | false |
| `writes_today_2026-10-04` (Sun) | **36,434** |
| `writes_today_2026-10-05` (Mon) | **33,097** |
| `delta_last_run`, `delta_entities_updated`, `delta_inactive_flagged` | **absent** (H10: delta has still never run) |
| **`etf_offset`** (Main Lane addition) | **71** (MA-OCT-000 recorded 31 of 237 on 20 Sep) |
| **`last_run_status`** | **`running:71/237:partial:0`** |

- The two `writes_today_*` keys exist today because other jobs wrote them: the Sunday holdings run, and a Monday writer. The writer was not identified, but the 5 Oct 11:02 boost pre-flight read the same 33,097.
- Enrich still never increments the key (KI 22.14 + F7, matrix RC-14). The weekday keys of 29 Sep – 1 Oct were absent.

**D6 (Phase 3 head), 5,809 reads.** Plan: `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei>?)`.
- 45 rows, all `holding`, `lei_status` NULL, name = own LEI, format OK.
- 0 overlap with D6-1001.

| Snapshot | Head LEI | Day-2 pool position | Advance | Phase 3 runs in between (cron + in-window boosts that fired) |
|---|---|---|---|---|
| D6-1001 07:05 | `529900OYPKOG9VUAFN26` | 220–264 | — | — |
| **D6-1005 19:45** | `529900URURX47M8NS987` | **524–568** | **+304** | **7**: cron 06:50 on 2, 3, 4 and 5 Oct; boosts 1 Oct 16:52, 2 Oct 16:50 and 3 Oct 16:53. The out-of-window fires (4 and 5 Oct 11:02) run Phase 1 only. |

- 304 = 7 × 44 − 4. The 4-slot shortfall fits placeholders created after 29 Sep taking head slots in that LEI range (for example from the Sun 4 Oct FIRDS seed). That was not verified; no extra read was made.
- **Observed rate, 1 Oct 07:05 → 5 Oct 19:45** (4.53 days): **about 67 a day** (1.55 successful runs a day), down from about 110 a day on 29 Sep – 1 Oct. Since 2 Oct, the morning boost has failed (2 and 3 Oct) or fired out of window (4 and 5 Oct) every day (§16.2).

**Final drain estimate:** 7,436 − 524 = **6,912** day-2 pool entities remain, plus any new placeholders.

| Rate assumption | Per day | Days | Date |
|---|---|---|---|
| **Observed 1–5 Oct** | about 67 | **about 103** | about 16 Jan 2027 |
| Cron only | 44 | about 157 | about 11 Mar 2027 |
| All 4 runs succeed | 176 | about 39 | about 13 Nov 2026 |

Files: `day7/d10-20261005.csv` (SHA `20c6049a…56b4`), `day7/d8-20261005.csv` (`7e85521b…946f`), `day7/d6-20261005.csv` (`d8c91c4e…c842`).

### 16.2 Pilot H11 tally since go-live (Step 2; split 2026-10-01 19:08:13 UTC)

Sources: `CA/logs/entities-enrich-boost.log`, `…-heartbeat.log`, and launchd stdout/stderr, all read only.

| Slot (UTC) | Fire time (launchd) | Outcome | `/run` called | Terminal heartbeat |
|---|---|---|---|---|
| 2 Oct 10:50 | 10:50:01 | `error`: wrangler code 10000 at the pre-flight | no | `failed`, **not delivered** (TimeoutError) |
| 2 Oct 16:50 | 16:50:01 | `fired`, in window | yes, 200 | `success`, delivered (201) |
| 3 Oct 10:50 | **10:55:51** (+6 min) | `error`: code 10000 | no | `failed`, delivered (201) |
| 3 Oct 16:50 | **16:52:56** (+3 min) | `fired`, in window | yes, 200 | `success`, delivered |
| 4 Oct 10:50 | **11:02:31** (+12 min) | `fired`, **out of window** (minute 2; Phase 1 only) | yes, 200 | `success`, delivered |
| 4 Oct 16:50 | **no fire** (absent from every log) | missed (Mac asleep, presumed) | no | none |
| 5 Oct 10:50 | **11:02:48** (+13 min) | `fired`, **out of window** | yes, 200 | `success`, delivered |
| 5 Oct 16:50 | 16:50:36 | `error`: code 10000 | no | `failed`, **not delivered** (TimeoutError) |

**Summary:**
- 8 slots; **7 fires, 1 missed**.
- **3 failures**, all wrangler / Cloudflare API code 10000 at the pre-flight.
- 4 fires called `/run`, but only **2 were in window**, so only 2 could advance Phase 3.
- 7 terminal heartbeats; **2 not delivered** (both `failed` events, TimeoutError).
- **Late fires:** 4 (+3 to +13 min). Two of them were late enough to fall out of window.
- Boost-log format and outcome values are unchanged: `error` 38 and `fired` 44 in total, `paused` 1. Heartbeat lines appear only in the heartbeat log.

**Notes for MA-OCT-001/002 (not rulings):**
1. The two out-of-window fires reported **`success`**, although only Phase 1 ran. The A1 `skipped`/`out_of_window` mapping (ACK note 2) is not in the pilot, so Ops sees success for a run that cannot advance Phase 3.
2. The missed 4 Oct 16:50 slot left no trace anywhere. Only a registry-side lateness check (002) can see it.
3. Both undelivered events are `failed` events, which are exactly the ones Ops most needs.

**H11 since 16 Sep:** 39 attempts, **17 errors (44%)**, 22 fired (2 out of window), plus 1 missed fire.

### 16.3 Final classification re-sync (Step 3)

Script `WORK/day7_resync.py`. Input: `day5/classification.csv` (run 2). Output: `day7/classification.csv`, copied to `claude/MA-OCT-006_classification.csv`. Diff: `day7/classification_diff.csv` (SHA `93dd311f…d568`).

| File | Old SHA-256 | New SHA-256 |
|---|---|---|
| `claude/MA-OCT-006_classification.csv` | `f364449c8a8c0b5843bed19626d634c47fa3f509604cea3cc9b95ee2f2dc3638` | **`cb3b3a841147235d0d2189fec0fba481758676602015d62cc49ae9babc13df64`** |
| `claude/MA-OCT-006_sample_adjudication.csv` | `ec8671a383fd406cee3e8cb4d1f33b084f232464a9c9ec6207007b2f2d1294e3` | **`929ae3e74a6128ac40b29997fe45b84aa37b9631b862d3a5088474ca04212c91`** |

**Zero-unclassified check: PASS.**
- 76,624 gap rows, one per (entity, field); 0 unclassified.
- Exactly the same (entity, field) set as day 5.
- Total rows go from 80,092 to **80,087** (W rows 3,468 → 3,463).

**Exactly which rows changed (22):**

| Ruling | Action | Rows | Detail |
|---|---|---|---|
| D6-1 (scope D7-1) | `lei` (d) → (a) `RC-A2`, manual review | 9 | **T1 (high):** 103436 Ecuador, 103486 Guatemala, 103492 Colombia, 103501 Kenya, 105461 Newfoundland and Labrador, 106518 Morocco. **Medium:** 96163 Treasury Wine Estates (T1_LAPSED, mistyped `government`), 103384 Angola (T1+), 103395 Kazakhstan (T1+). |
| D6-4 | W-H7 row removed | 1 | 2014 OPAP Holding SA |
| D6-5 (D7-2) | parent (c) → (b), medium | 8 | direct and ultimate for 575, 1514, 1809 and 1868, re-assessed against the correct LEI (RX `NO_KNOWN_PERSON`) |
| D6-5 (D7-2) | KI 22.43 W row removed | 4 | `direct_parent_exception` for 575, 1514, 1809 and 1868 |

These match the instructions' expected list, plus 3 medium government rows (D7-1).

**Re-synced category × field (gap rows):**

| Field | (a) | (b) | (c) | (d) | F | Total |
|---|---|---|---|---|---|---|
| `lei` | 17,637 | 53 | 2,201 | 7,190 | 290 | 27,371 |
| `direct_parent_lei` | 0 | 15,850 | 657 | 71 | — | 16,578 |
| `ultimate_parent_lei` | 0 | 15,777 | 727 | 74 | — | 16,578 |
| `name` | 0 | 0 | 859 | 7,426 | 0 | 8,285 |
| `country` | 91 | 0 | 5 | 7,426 | 290 | 7,812 |
| **Total** | **17,728** | **31,680** | **4,449** | **22,187** | **580** | **76,624** |

**W rows:** KI 22.41 2,671; KI 22.43 **657**; KI 22.42 105; wrong LEI (RC-12) **24**; KI 22.9 4; `'NULL'` 2.

**High-confidence recoverable by RC:** RC-4 14,997; RC-1 3,855; RC-5 1,384; RC-10 1,349; RC-15 859; RC-3 254; RC-16 4. These are identical to the day-6 matrix.

**Medium:** RC-1 2,883; RC-10 853; RC-3 198. Tiers: T1 4,109; T1_LAPSED 1,342; T1+ 1,405 (d); T1c 334 (d); duplicate N+ 852.

**Sample adjudication (D7-3):**
- Run-2 agreement is **357/400 = 89.25%** (was 359). The government/no-LEI cell is 1/15. Every other cell is unchanged (operating/no-LEI 177/206; the LEI-bearing cells, manager and spv are all 100%).
- The pass threshold (≥ 95% overall, ≥ 90% per cell) is still failed, as reported on day 5 (acceptance criterion 8: met with deviation).

### 16.4 Re-synced completeness (`WORK/day7/run3/completeness.json`, SHA `2d5deb74…7b9e`)

Recomputed by `day5_completeness.py` on a run-3 `entities.csv`: run 2 with the 17 re-synced category cells.

| Field | Raw | Achievable (day 5 → day 7) |
|---|---|---|
| `lei` (non-fund) | 38.0% | 63.9% → **63.9%** ((c)+(d) 9,400 → 9,391) |
| `direct_parent_lei` | 0.29% | 6.3% → **6.3%** ((c)+(d) 732 → 728) |
| `ultimate_parent_lei` | 0.29% | 5.7% → **5.8%** ((c)+(d) 805 → 801) |
| `name` | 81.2% | 81.2% (unchanged) |
| `country` | 82.2% | 83.0% (unchanged) |

- Only one cut moves materially: **`lei` for `government`, 84.9% → 96.9%** achievable, because 9 (d) rows became (a).
- The other changed cuts move by ≤ 0.04 pp (country "other", source "holdings-seed") or by 4 parent rows (US, GLEIF bulk, operating).

### 16.5 Matrix and 011 assessment, re-synced (Step 4)

**Changed in `MA-OCT-006_Remediation_Matrix.md`:**
- status → Final;
- basis → re-synced classification plus the 5 Oct snapshot;
- RC-4: observed rate 67 a day, head at position 524;
- RC-1 medium: 2,883;
- RC-5: KI 22.43 is 657;
- RC-14: evidence through 5 Oct;
- normalizer row: 2,591 / 18,137;
- product-note row: (b) 15,850 / 15,777, medium 88;
- (a) row: 17,637;
- criterion 1: the D6-6 statement made explicit;
- criterion 2: 39–103 days;
- criterion 6: the full pilot tally;
- criterion 7: 17 of 39 failed.

**Unchanged:**
- every ranking figure and every rank;
- all write-cost estimates (they already used the post-D6 counts: Option 1 100,373; Option 2 10,175 / 4,740; 013 ≈ 37,836);
- every PASS/FAIL outcome;
- the 006 recommendation: **Option 1 DEFER as worded, GO if the Founder accepts the 011 lane's amended criteria 4 and 5; Option 2 GO as fallback; MA-OCT-013 separate.**

### 16.6 Work files written today (outside the repo)

| File | SHA-256 |
|---|---|
| `day7/d10-20261005.csv` | `20c6049ad1172aa3af41ee5f6e53d0b8d4a3db8ca22f4e086d29581ca5a956b4` |
| `day7/d8-20261005.csv` | `7e85521b785062520ba09872c4ce6da3a389f96f8e8491438455be6825a2946f` |
| `day7/d6-20261005.csv` | `d8c91c4ee9e57e0e51eaea5c7eb25d1023e33177c4ad93ecdaa76f5cbf66c842` |
| `day7/classification.csv` | `cb3b3a841147235d0d2189fec0fba481758676602015d62cc49ae9babc13df64` |
| `day7/classification_diff.csv` | `93dd311f86ffdaabe3968810d5b1dc1cdb9ca5b3f1ca2cdd5b2340cf1f88d568` |
| `day7/sample_adjudication.csv` | `929ae3e74a6128ac40b29997fe45b84aa37b9631b862d3a5088474ca04212c91` |
| `day7/run3/completeness.json` | `2d5deb747c38f3d162396796c3ad3a03034918f6c80b920653aca038fe9f7b9e` |
| `day7/run3/entities.csv` | `24bffde2d0077afd1908da72648fef98626c3defaa76e80529e8e4ba0466f8d8` |
