# Read Packs (October 2026): Query Ledger

```text
ISSUED BY:    Program Orchestrator (Main Lane)
EXECUTED BY:  Engineering Lead (local Claude Code), task B, read-only D1
REVIEWED BY:  Main Lane (verification)
APPROVED BY:  Founder
PACKET:       Read-only query packs for MA-OCT-002, MA-OCT-008, MA-OCT-007
RUN:          2026-10-07 18:37–18:47 UTC (Wednesday; outside 04:00–07:05 UTC)
```

## Preflight

| Check | Result |
|---|---|
| `ls .git/*.lock` | none |
| Branch / HEAD | `October-2026` @ `16918e0`, equal to `origin` (`git ls-remote`, read-only; no fetch) |
| UTC time | 18:33Z at preflight, outside 04:00–07:05 |
| wrangler | **`/usr/local/bin/wrangler` 4.96.0** (global npm install), used for every call by absolute path, so `npx` never resolves a version (006 D7-5). `wrangler whoami`: OAuth, account `ea36070477560935a68ad9110a2fd40b`, scopes include `d1 (write)` |
| `claude/MA-OCT-008_Spec.md` | `a4dba4466394506387ad0e55d67ce911521e3ba535836755d50c45b611ce320a`: starts `a4dba446`, ends `320a` ✅ (rev 0.2) |
| `claude/MA-OCT-002_Spec.md` | `af3cc563…f477f678`, **REV 0 (Day-1 outline, 3 Oct)**. §9 ("EXPLAIN plans") is an empty `[D3]` placeholder, and there is **no D10 EXPLAIN pack** in the file. The file is untracked, and HEAD equals origin, so no newer copy exists in the repo. |
| `claude/MA-OCT-007_Spec.md` | `8e1be2d3…5e921b4e703` (rev 1.2), Appendix A read |

**Method.** Each statement was run through `wrangler d1 execute meridian-etf --remote --json --command`, one at a time, via a runner that refuses anything other than `SELECT` / `EXPLAIN` / `WITH`. Each data statement had its `EXPLAIN QUERY PLAN` run first, in the exact form executed (literal values in place of `?`). `meta.rows_read` and `meta.rows_written` were recorded per execution.

---

## 1. MA-OCT-002 D10 EXPLAIN pack: NOT RUN (blocked)

The pack does not exist in `claude/MA-OCT-002_Spec.md` on disk (REV 0; §9 is a placeholder). No statement was run for 002. The Main Lane needs to supply the D10 pack, either as a newer 002 spec revision or as the statements themselves.

## 2. MA-OCT-008 §13 Pack B (rev 0.1)

| Time (UTC) | # | Query (abridged) | Plan | rows_read | rows_written | vs expected |
|---|---|---|---|---|---|---|
| 18:37:21 | B0-plan | EXPLAIN `SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN (entity_master, issuerperiodsummary, issuereventstream, issuerfilingmaster)` | `SCAN sqlite_master` | 0 | 0 | ✅ |
| 18:37:25 | B0 | same | — | 147 | 0 | ✅ (est. 30–60; sqlite_master is small) |
| 18:37:27 | B1 | EXPLAIN `SELECT entity_id,cik,lei,name,type,entity_status FROM entity_master WHERE cik IN ($CIKS)` | `SCAN entity_master` | 0 | 0 | ✅ = expected F2 outcome. EXPLAIN only, not executed |
| — | B2 | *skipped (B1 = SCAN)* | — | — | — | per pack |
| 18:37:28 | B2-alt-E | EXPLAIN `SELECT entity_id FROM issuerperiodsummary WHERE cik='0000320193' AND entity_id IS NOT NULL LIMIT 1` | `SEARCH issuerperiodsummary USING INDEX sqlite_autoindex_issuerperiodsummary_1 (cik=?)` | 0 | 0 | ✅ |
| 18:37:43–18:38:10 | B2-alt ×30 | same statement, one per CIK (10-digit zero-padded) | (as B2-alt-E) | 3 in total (1 per hit, 0 per miss) | 0 | ✅ |
| 18:43:01 | FMT-plan *(addition)* | EXPLAIN `SELECT cik FROM issuerperiodsummary WHERE cik IN ('19617','1018724') LIMIT 2` | `SEARCH … USING COVERING INDEX sqlite_autoindex_issuerperiodsummary_1 (cik=?)` | 0 | 0 | indexed, no SCAN |
| 18:43:02 | FMT-probe *(addition)* | same | — | 2 | 0 | 0 rows: unpadded format is not used |
| 18:43:11 | B3-plan | EXPLAIN `SELECT entity_id,name,lei,lei_status,type,entity_status,cik FROM entity_master WHERE entity_id IN (348,1662,355)` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | 0 | 0 | ✅ |
| 18:43:12 | B3 | same | — | 6 | 0 | ✅ |
| 18:43:12 | B4 | EXPLAIN `SELECT COUNT(*) FROM instrument_master WHERE cusip_issuer_6='037833'` | `SEARCH instrument_master USING COVERING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?)` | 0 | 0 | ⚠️ **name only.** Expected `idx_instrument_cusip6`. The plan shape is the same (covering SEARCH). See finding 3 |

**Pack B results:**

1. **F2 confirmed.** `entity_master` has `cik TEXT` but **no index on `cik`**: 10 indexes, none on `cik`, per B0. `issuerfilingmaster` (`idx_issuerfilingmaster_cik_form`) and `issuereventstream` (`idx_issuereventstream_cik`) do have `cik` indexes. `issuerperiodsummary` is reached through its `UNIQUE(cik, …)` autoindex. In all three, `cik` is `TEXT NOT NULL`.
2. **B2-alt hit 3 of 30 CIKs** (format: 10-digit zero-padded):

   | CIK | entity_id | B3: name / LEI / status |
   |---|---|---|
   | 0001571949 | 348 | Intercontinental Exchange Inc / `5493000F4ZO33MV32P92` / ACTIVE (LEI ACTIVE) |
   | 0000320193 | 1662 | Apple Inc / `HWUPKR0MPOU8FGXBT394` / ACTIVE (LEI ACTIVE) |
   | 0001326801 | 355 | Meta Platforms Inc / `BQ4BKCS1HXDV9HN80Z93` / ACTIVE (LEI ACTIVE) |

   The other **27 miss**, reading 0 rows each: `issuerperiodsummary` has no row at all for those CIKs, as distinct from rows with a NULL `entity_id`. The format probe (unpadded `19617`, `1018724`) also returned 0, so the misses are not a format artefact. All 3 entities have `entity_master.cik` equal to the probed CIK.

   **Per §13: misses > 5,** so the spec does **not** propose an `entity_master(cik)` index for v1. The 27 are linked by LEI or manually. The partial index stays a Phase 2 option.
3. **Duplicate indexes on `instrument_master` (finding, for the Architect / Data-Identity Lead).** P9 (below) shows two pairs on the same columns:
   - `idx_instrument_cusip6` and `idx_instrument_master_cusip_issuer`, both on `cusip_issuer_6`;
   - `idx_instrument_isin` and `idx_instrument_master_isin`, both on `isin`.

   Either index in a pair serves B4. The duplicates add write amplification on every `instrument_master` write. This is recorded only; nothing was changed.

## 3. MA-OCT-007 Appendix A: A.0 and A.3 only (A.1 and A.2 not run; awaiting Main Lane go)

### A.0 size probes

| Time (UTC) | # | Query | Plan | rows_read | rows_written | Result |
|---|---|---|---|---|---|---|
| 18:44:47 | S1-plan | EXPLAIN `SELECT MAX(rowid) AS r FROM instrument_entity_map` | `SEARCH instrument_entity_map` (min/max) | 0 | 0 | ✅ |
| 18:44:48 | S2-plan | EXPLAIN `SELECT MAX(rowid) AS r FROM entity_isin_map` | `SEARCH entity_isin_map` (min/max) | 0 | 0 | ✅ |
| 18:44:54 | S1 | `SELECT MAX(rowid) AS r FROM instrument_entity_map` | — | 1 | 0 | ***R*ᵢ = 32,769**, unchanged from the August figure |
| 18:44:55 | S2 | `SELECT MAX(rowid) AS r FROM entity_isin_map` | — | 1 | 0 | ***R*ₑ = 37,154** |

**What A.0 implies for A.1 and A.2 (planning only; nothing run):**
- **No splits by the 45k rules:** *R*ᵢ ≤ 45k and *R*ₑ ≤ 45k, so Q1+Q2, Q3 and Q4 run unsplit. Q7 uses its 4 standard rowid ranges, about 16.4k each.
- **Q8 must split:** *R*ₑ > 22.5k, so it needs ⌈37,154 / 22.5k⌉ = **2** rowid ranges, about 18.6k rowids and about 37.2k reads each.
- **Q5 caveat for the Main Lane.** The split rule only triggers at *R*ₑ > 45k, but Q5's own estimate is "≈ 1–2 × *R*ₑ", which is **up to about 74k reads unsplit**, over the 50k single-execution ceiling. Recommendation: run Q5 in its split form (ISIN ranges of ≤ 22.5k rows each, so about 2–3 ranges), or EXPLAIN it first and stop if the plan is not covering.
- **Pack total:** ≈ 4 × 32,769 + (5 to 6) × 37,154 ≈ **317k–354k reads**. That is ≤ 1M, so it fits within one day's ≤ 1M budget. The suggested split stands: A.1 on day 1, A.2 on day 2.

### A.3 plan checks (EXPLAIN only; no table rows read)

| Time (UTC) | # | Statement (abridged, literal values) | Live plan | rows_read | vs expected |
|---|---|---|---|---|---|
| 18:45:46 | P9-plan | EXPLAIN `SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index' AND tbl_name IN (instrument_master, instrument_entity_map, entity_isin_map, entity_master)` | `SCAN sqlite_master` | 0 | ✅ |
| 18:45:47 | P9 | same | — | 147 | ✅. Index list below |
| 18:47:12 | P1 | R1a `… FROM instrument_master WHERE instrument_key='US0378331005'` | `SEARCH instrument_master USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | 0 | ✅ |
| 18:47:13 | P2 | R1b `… FROM instrument_entity_map WHERE instrument_key='US0378331005'` | `SEARCH instrument_entity_map USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` | 0 | ✅ |
| 18:47:14 | P3 | R1c `… FROM entity_isin_map WHERE isin='US0378331005' LIMIT 11` | `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin=?)` | 0 | ✅ |
| 18:47:15 | P4 | R1d `… FROM entity_master WHERE entity_id IN (1662,348,355)` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | 0 | ✅ |
| 18:47:16 | P5 | R2 before the index: `… FROM instrument_entity_map iem JOIN instrument_master im ON … WHERE iem.entity_id=1662 AND iem.instrument_key > '' ORDER BY iem.instrument_key LIMIT 26` | `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key>?)` + `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | 0 | ⚠️ **differs in form.** Expected `SCAN iem` + `SEARCH im` + `USE TEMP B-TREE FOR ORDER BY`. See below |
| — | P6 / P6′ / P7 | R2 and R4 after the ruling-A index | **not checkable**: no `instrument_entity_map(entity_id)` index exists yet (P9). Due with the 13 Oct CR | — | n/a |
| — | P8 | R3 redirect | **not checkable**: `entity_merge_redirect` does not exist yet (013) | — | n/a |
| — | P10 | R1f | **not checkable**: 008 tables do not exist yet | — | n/a |

**P5 deviation.** With no `entity_id` index, the planner walks the `instrument_key` PK autoindex as a range scan (`instrument_key>?`) in ORDER BY order and filters `entity_id` on each row, so it needs no temp B-tree. On page 1 the cursor is `''`, so the range covers the whole table. The read cost is therefore still up to about *M* (≈ 32.8k) per page, and it stops early only once `LIMIT` matching rows have been found.

**E7's conclusion holds:** R2 must not ship before the index. Only the plan text differs from the pack. The pack's expected-plan cell for P5 should be updated to this form.

**Live index list (P9):**

| Table | Indexes |
|---|---|
| `entity_master` | `sqlite_autoindex_entity_master_1`, `idx_entity_master_type`, `_lei`, `_normalized`, `_status`, `_jurisdiction`, `_direct_parent`, `_ultimate_parent`, `_match_source`, `_phase3` (lei, type, lei_status, direct_parent_lei, ult…) |
| `instrument_master` | `sqlite_autoindex_instrument_master_1`, `idx_instrument_isin` (isin), `idx_instrument_cusip6` (cusip_issuer_6), `idx_instrument_master_isin` (isin, **dup**), `idx_instrument_master_cusip_issuer` (cusip_issuer_6, **dup**) |
| `entity_isin_map` | `sqlite_autoindex_entity_isin_map_1`, `idx_entity_isin_map_isin`, `idx_entity_isin_map_lei`, `idx_entity_isin_map_entity` |
| `instrument_entity_map` | `sqlite_autoindex_instrument_entity_map_1` only. **No `entity_id` index** (as expected before the ruling-A CR) |

---

## Totals

| | Value |
|---|---|
| Executions | **50** (008: 39 including 2 additions; 007: 11) |
| Rows read | **307** (008: 156 + 2 for the additions; 007: 149) |
| Rows written | **0** |
| Largest single execution | **147 rows** (B0 and P9, `sqlite_master`) |
| Any `SCAN entity_master` / `SCAN fund_holdings_monthly` executed | **None.** B1's `SCAN entity_master` was EXPLAIN-only, as the pack prescribes |
| wrangler | `/usr/local/bin/wrangler` 4.96.0 (absolute path, every call) |
| Not run | 002 D10 pack (missing from the spec); 007 A.1 and A.2 (awaiting Main Lane go) |
