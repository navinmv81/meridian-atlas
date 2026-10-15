**ENT-CR1 verified** — C1 `idx_iem_entity_key` applied Tue 13 Oct 2026 09:33:45 UTC; E1, E2, E4 pass (AR-3). C2/C3 **deferred** (re-gate needed, §5 below).

# MA-OCT-ENT-CR1.EXEC: Report (LANE-1-ENG, Engineering Lead)

**Control:** v1, `claude/packets/MA-OCT-ENT-CR1.EXEC_Control_v1.md`, SHA-256 `47e0afe8032106222e70d01f671ff88781a5f50d5fc4d4741b4fc15fa4f3db13`
**Task:** v1, `claude/packets/MA-OCT-ENT-CR1.EXEC_Task_v1.md`, SHA-256 `04a849086aecccc1b4cd102f25fbf975c5c6e8ba2d2c75e7a14387dc0d990101`
**CR:** `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` rev 1, SHA-256 `fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20`
**Window:** Tue 13 Oct 08:05–10:30 UTC. Run **09:31:55 (preflight) → 09:35:00 (commit) UTC**, all D1 work 09:32:53–09:34:27 UTC.
**Wrangler:** `/usr/local/bin/wrangler` **4.96.0**, by absolute path for every statement, `--config "App/Corporate Atlas/wrangler-entities-enrich.toml"`, one statement per execution. **0 errors, 0 retries.**
**Start Approval:** the Founder's instruction to execute this Control ("start no earlier than 08:05 UTC") is taken as the Start Approval (board state READY → EXECUTING; `Status.json` left for the Main Lane).

## Step 0: approvals on file
- **Founder:** GATE-1012 **D4 A** (`claude/packets/GATE-1012_Decision.md`, 10 Oct).
- **Architect:** PASS WITH CONDITIONS, `claude/MA-OCT-ENT-CR1_Architect_Review.md` = `bb99d7c03fd6ebd91d46e367732088d0c21bd5ae244ff475dc7a193f1037d750` (matches the Task's `bb99d7c0…d750`).
- **Operations Lead:** **OPS-R4** in the Decisions Log (9 Oct). It's a one-time C1 exception to the 50k ceiling, with a cap of ≤ 90k and *R*ᵢ ≤ 36,000.
- **Hashes:** the Control matches the STATUS_BOARD row; the Task and CR hashes match.
- **Inside the window:** no Entities deploys (A5 finished Mon 12), no figi `/run`, no gate2-refresh, no gate3-exposure.

## Step 1: tooling preflight (09:32:45 UTC)
`wrangler --version` 4.96.0. `whoami`: OAuth, `d1 (write)`. `.git/*.lock`: none. `October-2026` @ `45cdb9d` = origin.

## Step 2: gates (09:32:53–09:32:56 UTC)

| Gate | Statement (plan) | rows_read | Result |
|---|---|---|---|
| S1 | `SELECT MAX(rowid) FROM instrument_entity_map` (`SEARCH instrument_entity_map`, min/max) | 1 | ***R*ᵢ = 32,769**: ≤ 45,000 (CR) and ≤ 36,000 (OPS-R4) ✅ |
| S3 | `SELECT MAX(rowid) FROM instrument_master` (`SEARCH instrument_master`, min/max) | 1 | ***N*ᵢₘ ≤ 73,006** (upper bound). **The CR assumed ≈ 55k; see §5.** |
| ST | `SELECT name FROM sqlite_master WHERE name = 'sqlite_stat1'` | 149 | **No stat table** (empty), so no stale statistics. Not an error (N-2). `ANALYZE` not run. |
| hold | `holdings_pipeline_state` `hold_all_jobs` (PK) | 1 | `false` ✅ |
| AR-2(a) as amended by ML-1012-1 | `GET /api/ops/cf/d1-today` 09:32:56Z and again 09:33:45Z (right before C1) | 0 | `rowsWritten` **190** ≤ 25,000 ✅ |

## Step 3: before set (09:33:27–09:33:35 UTC; EXPLAIN = 0 reads)

**P9 before** (149 reads): `instrument_master`: `sqlite_autoindex_instrument_master_1`, `idx_instrument_isin`, `idx_instrument_cusip6`, `idx_instrument_master_isin`, `idx_instrument_master_cusip_issuer`; `instrument_entity_map`: `sqlite_autoindex_instrument_entity_map_1` only. That is 5 + 1, as expected.

| # | Before plan (verbatim) |
|---|---|
| E1 (007 P6) | `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key>?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` — **as measured 7 Oct (P5)** |
| E2 (007 P7) | `CO-ROUTINE (subquery-1)` / `SCAN instrument_entity_map` / `SCAN (subquery-1)` |
| E3 (`/instruments`) | `SCAN iem` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` / `USE TEMP B-TREE FOR ORDER BY` |
| E4 (013 lookup) | `SCAN instrument_entity_map` |
| E5 (figi isin path) | `SCAN im` / `CORRELATED SCALAR SUBQUERY 1` / `SEARCH iem USING COVERING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` / `CORRELATED SCALAR SUBQUERY 2` / `SEARCH ofc USING COVERING INDEX sqlite_autoindex_openfigicache_1 (instrument_key=?)` — the expected SCAN (N-1); no MULTI-INDEX OR |
| E6 (B4) | `SEARCH instrument_master USING COVERING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?)` |
| E7 | `SEARCH instrument_master USING INDEX idx_instrument_master_isin (isin=?)` |
| E8 (13F) | `SEARCH h USING INDEX sqlite_autoindex_holding13f_normalized_1 (accession_number=? AND cik=?)` / `SEARCH im USING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?) LEFT-JOIN` / `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN` / `USE TEMP B-TREE FOR ORDER BY` |
| E8b (manager positions, `winning_filing` + `base`) | `CO-ROUTINE (subquery-1)` / `CO-ROUTINE (subquery-4)` / `SCAN filing13f USING INDEX idx_filing13f_cik` / `USE TEMP B-TREE FOR LAST 2 TERMS OF ORDER BY` / `SCAN (subquery-4)` / `SEARCH h USING INDEX idx_holding13f_report_period (report_period=?)` / `BLOOM FILTER ON (subquery-1) (rn=? AND cik=? AND report_period=? AND accession_number=?)` / `SEARCH (subquery-1) USING AUTOMATIC PARTIAL COVERING INDEX (…)` / `SEARCH im USING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?) LEFT-JOIN` / `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN` |
| E9a (gate3 pass 2) | `SEARCH fhm USING INDEX idx_holdings_month (report_month=?)` / `SEARCH im USING COVERING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` / `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` / `SCAN fel` / `USE TEMP B-TREE FOR GROUP BY` |
| E9b (gate3 coverage) | `SCAN fel` / `SEARCH fhm USING INDEX idx_holdings_status_series_month (snapshot_status=? AND series_id=? AND report_month=?)` / `SEARCH eim USING COVERING INDEX idx_entity_isin_map_isin (isin=?) LEFT-JOIN` / `SEARCH iem USING COVERING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN` / `USE TEMP B-TREE FOR GROUP BY` |
| E10 (gate2-refresh) | `SCAN im USING INDEX sqlite_autoindex_instrument_master_1` / `SEARCH iem USING COVERING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?) LEFT-JOIN` |

## Step 4: C1 and verification

| Time (UTC) | Statement | rows_read | rows_written |
|---|---|---|---|
| 09:33:45 | `CREATE INDEX IF NOT EXISTS idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);` | **65,911** (= 2.01 × *R*ᵢ; within the OPS-R4 cap of 90k; inside the 32.8k–82k declared range) | **32,770** (= *R*ᵢ 32,769 index entries + 1 schema row) |

These are the **project's first measured DDL costs**: a `CREATE INDEX` costs about 2 × *R* reads (table pass plus sort) and *R* + 1 writes.

| # | After plan (verbatim) | Required | Result |
|---|---|---|---|
| E1 | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | `idx_iem_entity_key`, no temp B-tree | ✅ |
| E2 | `CO-ROUTINE (subquery-1)` / `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` / `SCAN (subquery-1)` | covering `idx_iem_entity_key` | ✅ (the `SCAN` is over the ≤ 1,001-row co-routine, not the table) |
| E4 | `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` | covering `idx_iem_entity_key` | ✅ |

**C1 + E1 + E2 + E4 pass → "ENT-CR1 verified" (AR-3).** This releases 013's precondition and 007's R2/R4. No RB-1 was needed.

## Step 5: C2/C3 deferred (not applied)

- **Gate AR-2(b) as written passes:** `d1-today` 190 + this packet's writes 32,770 = **32,960 ≤ 35,000**.
- **The gate's stated purpose no longer holds**, so I deferred C2/C3 instead of running them.
  - The CR says (§3 risk 3; §5 "Write gates"; §5 Total): the ≤ 35,000 gate "leaves room for one DROP billed at ≈ 55k", "so the day stays under 100k in the worst case".
  - That worst case assumed *N*ᵢₘ ≈ 55k. Today S3 measured **73,006**.
  - A DROP billed per entry would therefore take the account to about **32,960 + 73,006 ≈ 105,966**, over the 100k daily cap. On top of that, the `d1-today` lag (25–30 min) hides other writers' recent rows.
- **AR-3 permits C2/C3 to slip** to Wed 14 Oct or after 23 Oct without affecting "ENT-CR1 verified". Both twins simply stay, which is the pre-CR state: an existing write amplification of 2 extra index writes per `instrument_master` insert.
- **Proposed re-gate (for the Main Lane / Operations Lead):**
  - before each DROP: `d1-today` + the packet's own writes + **1.05 × *N*ᵢₘ ≤ 100,000**, i.e. a reading of **≤ ~23,000** with *N*ᵢₘ = 73,006;
  - run C2 and C3 on a day with no C1-size write, e.g. Wed 14 Oct early in the window, when the account total is in the hundreds;
  - keep AR-2(c): stop before C3 if C2 reports > 1,000 writes.
- If C2/C3 run later, they go in `App/Corporate Atlas/migrations/ent-cr1b-drop-duplicate-indexes.sql`, and E5, E6, E7, E8 and E8b are re-checked then.
- **RB-2 note:** at *N*ᵢₘ = 73,006, a recreate would cost about 73k reads (up to about 183k at 2.5 ×) and about 73k writes each, more than the CR's stated ≈ 55k / 137k. **RB-2 is not pre-approved** (OPS-R4).

## Step 6: after set (09:34:17–09:34:23 UTC)

**P9 after** (150 reads): `instrument_master` is unchanged (5 indexes, since C2/C3 did not run); `instrument_entity_map` has `sqlite_autoindex_instrument_entity_map_1` + **`idx_iem_entity_key` ON instrument_entity_map(entity_id, instrument_key)**.

| # | After plan (verbatim) | vs before |
|---|---|---|
| E3 | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` / `USE TEMP B-TREE FOR ORDER BY` | ✅ **Improved**: `SCAN iem` → `SEARCH … idx_iem_entity_key`. Same temp B-tree (it orders on `im` columns, as expected); no new SCAN. |
| E5 | identical to before | ✅ unchanged (expected SCAN, N-1) |
| E6 | identical to before (`idx_instrument_master_cusip_issuer`) | ✅ unchanged (C3 not run) |
| E7 | identical to before (`idx_instrument_master_isin`) | ✅ unchanged (C2 not run) |
| E8 | identical to before | ✅ unchanged |
| E8b | identical to before | ✅ unchanged |
| E9a, E9b | identical to before | ✅ unchanged (no-regression) |
| E10 | identical to before | ✅ unchanged |

**Pass rule met.** E1, E2 and E4 show `idx_iem_entity_key`. E3, E5, E9 and E10 gained no SCAN or temp B-tree. E6, E7, E8 and E8b are N/A today and have the same plans as before.

### Added to the after-set by the Task (ML-1010-4, for 007)

| # | Statement | Plan | rows_read | Result |
|---|---|---|---|---|
| **R7-7** limit 25 | 007 rev 1.4 R2 on entity **28088**, `LIMIT 26` (limit + 1) | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | **52** | ✅ at or below the expected 60–410 range |
| **R7-7** limit 100 | same, `LIMIT 101` | same | **202** | ✅ |
| **R7-2** `instrument_master` | `SELECT instrument_key FROM instrument_master WHERE instrument_key = 'CUSIP:000000000'` | `SEARCH … COVERING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | 1 | **Row EXISTS** |
| **R7-2** `instrument_entity_map` | `SELECT instrument_key, entity_id FROM instrument_entity_map WHERE instrument_key = 'CUSIP:000000000'` | `SEARCH … sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` | 0 | **Row does NOT exist** |

### Totals (per-statement D1 `meta`)

| | Value | Cap |
|---|---|---|
| Executions | 40 (0 errors, 0 retries) | — |
| Rows read | **66,617** (C1 65,911 + all others 706) | ≤ 90k (OPS-R4) ✅ |
| Rows written | **32,770** (C1 only) | AR-2 gates ✅ |
| Largest single execution | C1, 65,911 reads (under the pre-granted exception) | ≤ 90k ✅ |

## `d1-today` lag after C1 (required by ML-1012-1; timestamped GETs, 0 D1 reads)

Known write batch: C1 = 32,770 rows, completed 09:33:45 UTC. Reading just before C1 (09:33:45Z): `rowsWritten` 190.

| Sample | UTC | `rowsWritten` |
|---|---|---|
| +1 min | 09:34:45 | 190 (not yet visible) |
| +5 min | 09:38:45 | 190 (not yet visible) |
| +15 min | 09:48:45 | 190 (not yet visible) |
| **+30 min** | **10:03:45** | **32,960** (= 190 + 32,770, exact) |
| +45 min | 10:18:45 | 32,960 |

**Result:** C1's 32,770 writes first appeared between **+15 and +30 min** after the write, complete and exact. This is consistent with the 12 Oct measurement (25–30 min, 149 writes). The lag doesn't depend on batch size (149 rows vs 32,770 rows). ML-1012-1's assumption of about 30 min stands.

## Step 7: repo DDL of record and note

- **`App/Corporate Atlas/migrations/ent-cr1-index-change.sql`** (SHA-256 `7207fd9c52d13c3748bf9772850c19e41eb4db15d28b1a2a900314a45135c4ed`): **C1 only**, the statement actually applied (AR-3), with a header recording the measured cost and the C2/C3 deferral.
- **`App/Corporate Atlas/corporate_atlas_prompt6_execution_v3.md`:** a one-line note inserted directly above the ad-hoc `CREATE INDEX idx_instrument_master_*` blocks (old lines 312–318): "> superseded by MA-OCT-ENT-CR1 (13 Oct 2026); do not replay" (N-4).
- **Commit `4bf5530`** (fast-forward from `45cdb9d`; fetch + `pull --ff-only` + lock check first; those 2 files only, by explicit path), pushed. The report file is **not** committed (no Main Lane commit list).

## Step 8: close-out summary

- **ENT-CR1 verified:** C1 applied, and E1, E2 and E4 pass. **013's precondition is met and 007 R2/R4 are unblocked.**
- **C2/C3 deferred:** a re-gate is needed because *N*ᵢₘ = 73,006 > 55k. The proposal is in §5.
- **No rollback taken.** No Entities deploys, figi `/run`, gate2-refresh or gate3-exposure in the window.
- **`d1-today` lag:** C1 visible at +15–30 min (09:48:45 → 10:03:45 UTC), exact.
- **Measured DDL cost:** `CREATE INDEX` on *R* rows = **2.01 × *R* reads, *R* + 1 writes**. This replaces the estimates for future index CRs.

**Stop point reached after step 8.**
