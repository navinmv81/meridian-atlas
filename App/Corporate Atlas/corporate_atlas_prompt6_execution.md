# Corporate Atlas — Prompt 6: Instrument Normalization + Exposure Aggregation

**Working directory:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas`  
**Date:** June 13 2026  
**Pipeline context:** ETF holdings pipeline is actively running its second pass. This prompt reads from existing tables and writes only to new Corporate Atlas tables. Zero interference with any running pipeline.

---

## Pre-Execution State (Confirmed Before Running)

| Check | Value | Status |
|---|---|---|
| writes_today_2026-06-13 | 3,823 | ✅ Well under 20k threshold |
| instrument_master rows | 0 | ✅ Clean first run |
| instrument_entity_map rows | 0 | ✅ Clean first run |
| entity_exposure_monthly rows | 0 | ✅ Clean first run |
| fund_exposure_coverage rows | 0 | ✅ Clean first run |
| fund_holdings_monthly complete rows | 65,582 | ✅ Confirmed |
| ETFs with complete holdings | 115 | ✅ Confirmed |
| Report months available | 10 | ✅ Confirmed |

---

## Absolute Constraints

These apply to every step in this prompt without exception:

1. **Read-only tables** — `fund_holdings_monthly`, `etf_master`, `entity_master`, `fund_entity_link` are read-only. Never INSERT, UPDATE, or DELETE on these.
2. **Write-only tables** — `instrument_master`, `instrument_entity_map`, `entity_exposure_monthly`, `fund_exposure_coverage` are the only tables this prompt writes to.
3. **No ETF Refresh files** — Do not open, read, or modify any file inside `../ETF Refresh/`. Do not deploy any Worker.
4. **INSERT OR IGNORE throughout** — Never overwrite existing rows. All inserts must use `INSERT OR IGNORE` or `ON CONFLICT DO NOTHING`.
5. **Batch all writes** — Use `db.batch()` in groups of 50. Never loop row-by-row without batching.
6. **Write guard** — Before starting each task, check current write count:
   ```bash
   wrangler d1 execute meridian-etf --remote \
     --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
   ```
   If value exceeds 80,000 — stop immediately and report. Do not proceed.
7. **Report after each task** — After completing Task 6a, 6b, and 6c, run a row count query and report before moving to the next task.
8. **Diagnostic first** — Run Step 1 fully and report findings before writing a single row.

---

## Step 1 — Diagnostic (Read Only)

Run all four queries and report findings. Do not write anything until Step 1 is complete and confirmed.

**1a — Confirm target tables are empty:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT 'instrument_master' as tbl, COUNT(*) as cnt FROM instrument_master UNION ALL SELECT 'instrument_entity_map', COUNT(*) FROM instrument_entity_map UNION ALL SELECT 'entity_exposure_monthly', COUNT(*) FROM entity_exposure_monthly UNION ALL SELECT 'fund_exposure_coverage', COUNT(*) FROM fund_exposure_coverage;"
```

**1b — Confirm ISIN and CUSIP availability in holdings:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as total, COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END) as has_isin, COUNT(CASE WHEN cusip IS NOT NULL AND cusip != '' THEN 1 END) as has_cusip, COUNT(CASE WHEN (isin IS NULL OR isin = '') AND (cusip IS NULL OR cusip = '') THEN 1 END) as neither FROM fund_holdings_monthly WHERE snapshot_status = 'complete';"
```

**1c — Confirm fund_entity_link is populated:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as linked_etfs FROM fund_entity_link;"
```

**1d — Confirm entity_master has operating entities:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT type, COUNT(*) as cnt FROM entity_master GROUP BY type ORDER BY type;"
```

**1e — Check current write budget:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT key, value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```

Report all five results. Confirm all target tables are at 0 rows. Confirm `fund_entity_link` has rows. Confirm writes are below 20,000. Then wait for confirmation before proceeding to Task 6a.

---

## Task 6a — Instrument Normalization

**Purpose:** Create a normalised record in `instrument_master` for every distinct security in `fund_holdings_monthly`.  
**Reads from:** `fund_holdings_monthly`  
**Writes to:** `instrument_master`  
**Expected writes:** ~15,000–20,000 rows

### Implementation

Write a script that runs via `wrangler d1 execute` or as a one-time Node.js script using the Wrangler D1 API. The script must:

**Step 6a-1 — Fetch distinct securities:**

```sql
SELECT DISTINCT
  isin,
  cusip,
  security_ticker,
  security_name,
  asset_cat,
  issuer_country,
  MIN(report_month) as first_seen_date
FROM fund_holdings_monthly
WHERE snapshot_status = 'complete'
  AND security_name IS NOT NULL
  AND security_name != ''
  AND UPPER(TRIM(security_name)) != 'N/A'
  AND UPPER(TRIM(security_name)) != 'NA'
GROUP BY isin, cusip, security_ticker, security_name, asset_cat, issuer_country
```

**Step 6a-2 — Derive instrument_key for each row using this priority:**

```javascript
function deriveInstrumentKey(row) {
  if (row.isin && row.isin.length === 12) {
    return row.isin;
  } else if (row.cusip && row.cusip.length >= 6) {
    return `CUSIP:${row.cusip}`;
  } else if (row.security_ticker && row.security_ticker.trim() !== '') {
    return `TICKER:${row.security_ticker.toUpperCase().trim()}`;
  } else {
    return `NAME:${row.security_name.toUpperCase().trim().replace(/\s+/g, '_').slice(0, 80)}`;
  }
}
```

**Step 6a-3 — Derive cusip_issuer_6:**

```javascript
const cusipIssuer6 = (row.cusip && row.cusip.length >= 6)
  ? row.cusip.slice(0, 6)
  : null;
```

**Step 6a-4 — Insert into instrument_master:**

```sql
INSERT OR IGNORE INTO instrument_master
  (instrument_key, security_name, security_ticker, isin, cusip,
   cusip_issuer_6, asset_cat, country, first_seen_date)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Use `db.batch()` in groups of 50. After all inserts complete, run:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as instrument_master_rows FROM instrument_master;"
```

Report the count. **Wait for confirmation before proceeding to Task 6b.**

---

## Task 6b — Instrument to Entity Mapping

**Purpose:** Link instruments in `instrument_master` to issuer entities in `entity_master`.  
**Reads from:** `instrument_master`, `entity_master`  
**Writes to:** `instrument_entity_map`  
**Expected writes:** ~8,000–12,000 rows

### Check write budget before starting:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```
Stop if value exceeds 80,000.

### Tier 1 — CUSIP issuer grouping (confidence 90)

Group `instrument_master` rows by `cusip_issuer_6`. For each group, find the most frequently occurring `security_name` as the issuer proxy. Match against `entity_master` using `normalizeName`:

```javascript
function normalizeName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Query to get CUSIP groups:
```sql
SELECT cusip_issuer_6,
       security_name,
       COUNT(*) as cnt
FROM instrument_master
WHERE cusip_issuer_6 IS NOT NULL
GROUP BY cusip_issuer_6, security_name
ORDER BY cusip_issuer_6, cnt DESC
```

For each unique `cusip_issuer_6`, take the `security_name` with the highest count. Normalize it and look up `entity_master`:

```sql
SELECT entity_id FROM entity_master
WHERE normalized_name = ?
LIMIT 1
```

On match — map ALL instruments sharing that `cusip_issuer_6` to the matched entity:

```sql
INSERT OR IGNORE INTO instrument_entity_map
  (instrument_key, entity_id, source, confidence)
SELECT instrument_key, ?, 'cusip_tier1', 90
FROM instrument_master
WHERE cusip_issuer_6 = ?
```

### Tier 2 — ISIN country prefix matching (confidence 75)

For instruments keyed by ISIN that have no mapping yet:

```sql
SELECT im.instrument_key, im.isin, im.security_name, im.country
FROM instrument_master im
LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
WHERE im.isin IS NOT NULL
  AND im.isin != ''
  AND iem.instrument_key IS NULL
```

For each, extract country from ISIN (first 2 chars). Normalize `security_name` and look up `entity_master` with country hint:

```sql
SELECT entity_id FROM entity_master
WHERE normalized_name = ?
  AND (country = ? OR country IS NULL)
LIMIT 1
```

On match:
```sql
INSERT OR IGNORE INTO instrument_entity_map
  (instrument_key, entity_id, source, confidence)
VALUES (?, ?, 'isin_tier1', 75)
```

After all mapping complete, run verification:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT source, COUNT(*) as cnt FROM instrument_entity_map GROUP BY source ORDER BY source;"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as mapped, (SELECT COUNT(*) FROM instrument_master) as total FROM instrument_entity_map;"
```

Report both results. **Wait for confirmation before proceeding to Task 6c.**

---

## Task 6c — Exposure Aggregation

**Purpose:** Compute entity exposure facts and coverage denominators for every report month.  
**Reads from:** `fund_holdings_monthly`, `instrument_master`, `instrument_entity_map`, `fund_entity_link`  
**Writes to:** `entity_exposure_monthly`, `fund_exposure_coverage`  
**Expected writes:** ~6,000–16,000 rows combined

### Check write budget before starting:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```
Stop if value exceeds 80,000.

### Get distinct report months:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT DISTINCT report_month FROM fund_holdings_monthly WHERE snapshot_status = 'complete' ORDER BY report_month;"
```

Report the list of months found. Then process each month in sequence.

### For each report month — entity_exposure_monthly:

```sql
INSERT OR IGNORE INTO entity_exposure_monthly
  (report_month, entity_id, holder_entity_id, weight_sum, computed_at)
SELECT
  fhm.report_month,
  iem.entity_id,
  fel.entity_id as holder_entity_id,
  SUM(CAST(fhm.pct_val AS REAL)) as weight_sum,
  CURRENT_TIMESTAMP
FROM fund_holdings_monthly fhm
JOIN instrument_master im ON (
  (fhm.isin IS NOT NULL AND fhm.isin != '' AND fhm.isin = im.isin)
  OR
  (fhm.cusip IS NOT NULL AND fhm.cusip != '' AND 'CUSIP:' || fhm.cusip = im.instrument_key)
)
JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
WHERE fhm.report_month = ?
  AND fhm.snapshot_status = 'complete'
GROUP BY fhm.report_month, iem.entity_id, fel.entity_id
```

### For each report month — fund_exposure_coverage:

```sql
INSERT OR IGNORE INTO fund_exposure_coverage
  (report_month, holder_entity_id, total_weight, mapped_weight, computed_at)
SELECT
  fhm.report_month,
  fel.entity_id as holder_entity_id,
  SUM(CAST(fhm.pct_val AS REAL)) as total_weight,
  COALESCE(SUM(CASE WHEN iem.instrument_key IS NOT NULL
    THEN CAST(fhm.pct_val AS REAL) ELSE 0 END), 0) as mapped_weight,
  CURRENT_TIMESTAMP
FROM fund_holdings_monthly fhm
JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
LEFT JOIN instrument_master im ON (
  (fhm.isin IS NOT NULL AND fhm.isin != '' AND fhm.isin = im.isin)
  OR
  (fhm.cusip IS NOT NULL AND fhm.cusip != '' AND 'CUSIP:' || fhm.cusip = im.instrument_key)
)
LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
WHERE fhm.report_month = ?
  AND fhm.snapshot_status = 'complete'
GROUP BY fhm.report_month, fel.entity_id
```

Process one month at a time. After each month report the row counts inserted.

### After all months complete — final verification:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT report_month, COUNT(*) as entity_pairs FROM entity_exposure_monthly GROUP BY report_month ORDER BY report_month DESC;"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT AVG(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as avg_coverage_pct, MIN(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as min_coverage_pct, MAX(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as max_coverage_pct FROM fund_exposure_coverage;"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```

Report all three results.

---

## Post-Completion Checks

After all three tasks complete, run this full summary:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT 'instrument_master' as tbl, COUNT(*) as cnt FROM instrument_master UNION ALL SELECT 'instrument_entity_map', COUNT(*) FROM instrument_entity_map UNION ALL SELECT 'entity_exposure_monthly', COUNT(*) FROM entity_exposure_monthly UNION ALL SELECT 'fund_exposure_coverage', COUNT(*) FROM fund_exposure_coverage;"
```

Then test the Corporate Atlas API to confirm the galaxy south arc is now populated. Call the graph endpoint for a known fund entity — use the entity_id for ACWI from `fund_entity_link`:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT entity_id FROM fund_entity_link WHERE etf_symbol = 'ACWI';"
```

Then call:
```bash
curl "https://meridian-entities-api.navinmv1981.workers.dev/api/entities/[ACWI_ENTITY_ID]/graph"
```

Replace `[ACWI_ENTITY_ID]` with the entity_id returned above. Report whether `holdings` array in the response is now populated with issuer entities and weight values.

---

## Success Criteria

| Check | Expected |
|---|---|
| instrument_master rows | 15,000–25,000 |
| instrument_entity_map rows | 8,000–15,000 |
| entity_exposure_monthly rows | 5,000–15,000 |
| fund_exposure_coverage rows | ~1,150 (115 ETFs × 10 months) |
| Average coverage % | 30–70% (partial pipeline — will improve as more ETFs complete) |
| ACWI graph response holdings array | Non-empty with weight values |
| writes_today final | Below 80,000 |
| Any existing ETF table modified | Must be zero |
