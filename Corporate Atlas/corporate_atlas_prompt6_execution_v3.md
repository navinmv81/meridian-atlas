# Corporate Atlas — Prompt 6: Instrument Normalization + Exposure Aggregation

**Working directory:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas`  
**Spec version:** v3 — revised after Go-Later decision (June 13 2026)  
**Pipeline context:** ETF holdings pipeline is actively running its second pass. This prompt reads from existing ETF tables and writes only to Corporate Atlas tables. Zero interference with any running pipeline.

---

## Revision Notes (v2 → v3)

| Change | Reason |
|---|---|
| Run split into Gate A (Tasks 6a + 6b) and Gate B (Task 6c) | Go-Later decision: 6c blocked until index and query plan requirements met |
| Three indexes added as a mandatory pre-6c step | instrument_master and instrument_entity_map had no indexes at time of first review — unaudited OR-join on fund_holdings_monthly is a June-12-class risk |
| OR-join in 6c refactored into two sequential passes (ISIN, then CUSIP) | Cleaner index usage; eliminates SQLite OR-branch scan degradation; easier to audit per-pass read consumption |
| Explicit read budget declared per month and per full run for Task 6c | Three-point pre-deployment check compliance — required before any cron or bulk query against fund_holdings_monthly |
| Write budget threshold tightened to 15,000 at Gate 0 | Concurrent pipeline risk — tighter margin required given active second pass |
| TRIM on cusip made explicit in both 6a JS and 6c SQL | Key consistency guarantee between deriveInstrumentKey and JOIN condition |
| fund_entity_link coverage check added to Gate 0 | Entities Product Lead requirement — silent ETF gaps in 6c if link is incomplete |
| Post-run breadth check added | Entities Product Lead requirement — DGRO smoke test alone is insufficient |

---

## Absolute Constraints

These apply to every step without exception:

1. **Read-only tables** — `fund_holdings_monthly`, `etf_master`, `entity_master`, `fund_entity_link` are read-only. Never INSERT, UPDATE, or DELETE on these.
2. **Write-only tables** — `instrument_master`, `instrument_entity_map`, `entity_exposure_monthly`, `fund_exposure_coverage` are the only tables this prompt writes to.
3. **No ETF Refresh files** — Do not open, read, or modify any file inside `../ETF Refresh/`. Do not deploy any Worker.
4. **INSERT OR IGNORE throughout** — Never overwrite existing rows.
5. **Batch all writes** — Use `db.batch()` in groups of 50. Never loop row-by-row without batching. Requires Node.js SDK path — not `wrangler d1 execute` — for all write tasks.
6. **Write guard — live check before every task** — Take a fresh reading within 5 minutes of starting each task:
   ```bash
   wrangler d1 execute meridian-etf --remote \
     --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
   ```
   If value exceeds **80,000** — stop immediately. If value exceeds **65,000** before Task 6c — stop and defer to next UTC day.
7. **Report after each task** — Run the specified row count query after each task and report before moving to the next.
8. **Diagnostic first** — Run Step 1 fully and confirm all results before writing a single row.
9. **TRIM on cusip is mandatory** — Applied in JavaScript before key derivation (Task 6a) and in SQL JOIN conditions (Task 6c). No exceptions.

---

## Run Structure

```
Gate 0 — Pre-flight checks (read-only, no writes)
  └── Step 1: Diagnostic queries
  └── Step 1f: fund_entity_link coverage check (NEW v3)

Gate A — Tasks 6a and 6b
  └── Task 6a: Instrument Normalization → writes to instrument_master
  └── Task 6b: Instrument to Entity Mapping → writes to instrument_entity_map
  └── Task 6b-post: Index creation on instrument_master and instrument_entity_map (NEW v3)

  ── STOP. Report Gate A results. Await human confirmation before Gate B. ──

Gate B — Task 6c (separate run, possibly separate day)
  └── Step 6c-pre: EXPLAIN QUERY PLAN audit on both passes (NEW v3)
  └── Task 6c Pass 1: ISIN-keyed exposure aggregation
  └── Task 6c Pass 2: CUSIP-keyed exposure aggregation
  └── Task 6c-cov: Fund exposure coverage denominator
  └── Post-run verification
```

---

## Gate 0 — Pre-Flight Checks

Run all checks. Do not proceed to Gate A until every item below is confirmed.

### Step 1 — Diagnostic (Read Only)

**1a — Confirm target tables are empty:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT 'instrument_master' as tbl, COUNT(*) as cnt FROM instrument_master
  UNION ALL SELECT 'instrument_entity_map', COUNT(*) FROM instrument_entity_map
  UNION ALL SELECT 'entity_exposure_monthly', COUNT(*) FROM entity_exposure_monthly
  UNION ALL SELECT 'fund_exposure_coverage', COUNT(*) FROM fund_exposure_coverage;"
```

**1b — Confirm ISIN and CUSIP availability in holdings:**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END) as has_isin,
    COUNT(CASE WHEN cusip IS NOT NULL AND cusip != '' THEN 1 END) as has_cusip,
    COUNT(CASE WHEN (isin IS NULL OR isin = '') AND (cusip IS NULL OR cusip = '') THEN 1 END) as neither
  FROM fund_holdings_monthly WHERE snapshot_status = 'complete';"
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

**1e — Live write budget (must be below 15,000 to proceed):**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT key, value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```

**1f — fund_entity_link coverage check (NEW v3):**

Confirm that `fund_entity_link` covers all ETFs with complete holdings. The two counts below must be equal or `fund_entity_link` count must be greater. If not — stop and investigate missing links before proceeding.

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT
    (SELECT COUNT(DISTINCT series_id) FROM fund_holdings_monthly WHERE snapshot_status = 'complete') as complete_etfs,
    (SELECT COUNT(*) FROM fund_entity_link) as linked_etfs;"
```

**Gate 0 pass condition:** All four target tables at 0 rows. `fund_entity_link` count >= complete ETF count. Writes below 15,000. Holdings cron confirmed to have just fired (next invocation at least 90 minutes away — check Cloudflare dashboard).

---

## Gate A — Tasks 6a and 6b

### Task 6a — Instrument Normalization

**Purpose:** Create a normalised record in `instrument_master` for every distinct security in `fund_holdings_monthly`.  
**Reads from:** `fund_holdings_monthly`  
**Writes to:** `instrument_master`  
**Estimated writes:** ~15,000–20,000 rows  
**Estimated reads:** ~65,582 rows (one pass over complete holdings rows)

#### Step 6a-1 — Fetch distinct securities:

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
  AND UPPER(TRIM(security_name)) != 'UNKNOWN SECURITY'
GROUP BY isin, cusip, security_ticker, security_name, asset_cat, issuer_country
```

#### Step 6a-2 — Derive instrument_key (TRIM on cusip is mandatory):

```javascript
function deriveInstrumentKey(row) {
  if (row.isin && row.isin.trim().length === 12) {
    return row.isin.trim();
  } else if (row.cusip && row.cusip.trim().length >= 6) {
    // TRIM applied here — must match SQL JOIN in Task 6c exactly
    return `CUSIP:${row.cusip.trim()}`;
  } else if (row.security_ticker && row.security_ticker.trim() !== '') {
    return `TICKER:${row.security_ticker.toUpperCase().trim()}`;
  } else {
    return `NAME:${row.security_name.toUpperCase().trim().replace(/\s+/g, '_').slice(0, 80)}`;
  }
}
```

#### Step 6a-3 — Derive cusip_issuer_6:

```javascript
const cusipIssuer6 = (row.cusip && row.cusip.trim().length >= 6)
  ? row.cusip.trim().slice(0, 6)
  : null;
```

#### Step 6a-4 — Insert into instrument_master (db.batch(), groups of 50):

```sql
INSERT OR IGNORE INTO instrument_master
  (instrument_key, security_name, security_ticker, isin, cusip,
   cusip_issuer_6, asset_cat, country, first_seen_date)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

#### Step 6a-5 — Report:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as instrument_master_rows FROM instrument_master;"
```

Expected: 15,000–25,000 rows. Report count. **Wait for human confirmation before Task 6b.**

---

### Task 6b — Instrument to Entity Mapping

**Purpose:** Link instruments in `instrument_master` to issuer entities in `entity_master`.  
**Reads from:** `instrument_master`, `entity_master`  
**Writes to:** `instrument_entity_map`  
**Estimated writes:** ~8,000–12,000 rows

#### Write budget check before starting:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```
Stop if value exceeds 60,000.

#### Tier 1 — CUSIP issuer grouping (confidence 90):

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

Query CUSIP groups:
```sql
SELECT cusip_issuer_6,
       security_name,
       COUNT(*) as cnt
FROM instrument_master
WHERE cusip_issuer_6 IS NOT NULL
GROUP BY cusip_issuer_6, security_name
ORDER BY cusip_issuer_6, cnt DESC
```

For each unique `cusip_issuer_6`, take the `security_name` with the highest count. Normalize and look up `entity_master`:

```sql
SELECT entity_id FROM entity_master
WHERE normalized_name = ?
LIMIT 1
```

On match — map ALL instruments sharing that `cusip_issuer_6`:

```sql
INSERT OR IGNORE INTO instrument_entity_map
  (instrument_key, entity_id, source, confidence)
SELECT instrument_key, ?, 'cusip_tier1', 90
FROM instrument_master
WHERE cusip_issuer_6 = ?
```

#### Tier 2 — ISIN country prefix matching (confidence 75):

```sql
SELECT im.instrument_key, im.isin, im.security_name, im.country
FROM instrument_master im
LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
WHERE im.isin IS NOT NULL
  AND im.isin != ''
  AND iem.instrument_key IS NULL
```

For each, extract country from ISIN (first 2 chars). Normalize `security_name` and look up `entity_master`:

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

#### Step 6b verification:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT source, COUNT(*) as cnt FROM instrument_entity_map GROUP BY source ORDER BY source;"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as mapped, (SELECT COUNT(*) FROM instrument_master) as total FROM instrument_entity_map;"
```

Report both. **Wait for human confirmation before Task 6b-post.**

---

### Task 6b-post — Index Creation (NEW v3)

**Purpose:** Create indexes on the newly populated `instrument_master` and `instrument_entity_map` tables before Task 6c joins against them. This step is mandatory. Task 6c must not run without these indexes in place.

**No writes to data rows. DDL only.**

```bash
wrangler d1 execute meridian-etf --remote \
  --command="CREATE INDEX IF NOT EXISTS idx_instrument_master_isin
             ON instrument_master(isin);"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="CREATE INDEX IF NOT EXISTS idx_instrument_master_cusip_issuer
             ON instrument_master(cusip_issuer_6);"
```

```bash
wrangler d1 execute meridian-etf --remote \
  --command="CREATE INDEX IF NOT EXISTS idx_instrument_entity_map_key
             ON instrument_entity_map(instrument_key);"
```

Confirm all three indexes exist:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT name FROM sqlite_master WHERE type='index'
             AND tbl_name IN ('instrument_master','instrument_entity_map')
             ORDER BY tbl_name, name;"
```

Expected output: three index names visible. Report. **Gate A is now complete.**

---

## Gate A Complete — Stop and Report

Before proceeding to Gate B, report the following to the human operator:

1. `instrument_master` row count
2. `instrument_entity_map` row count and breakdown by source
3. Three indexes confirmed present
4. Current `writes_today` value
5. Any anomalies from 6b mapping (unexpectedly low match rate, zero Tier 1 matches, etc.)

**Gate B may only begin after human operator confirms Gate A results are acceptable.**  
**Gate B may be run in the same session or deferred to a separate run on a subsequent UTC day — operator's choice based on remaining write budget.**

---

## Gate B — Task 6c: Exposure Aggregation

**This gate runs only after Gate A is complete and human has confirmed Go for Gate B.**

### Read Budget Declaration (NEW v3 — three-point check compliance)

| Scope | Estimated rows read | Basis |
|---|---|---|
| Per month, Pass 1 (ISIN) | ~8,000–15,000 | Subset of 65,582 complete rows with non-null ISIN, joined via indexed isin column |
| Per month, Pass 2 (CUSIP) | ~5,000–10,000 | Remaining rows with cusip, joined via indexed instrument_key |
| Per month, coverage denominator | ~6,500 | One pass over complete rows for that month, grouped by series_id |
| Full run (10 months × all passes) | ~250,000 est. | Well within 5M daily read limit but must be confirmed via EXPLAIN before running |

**These estimates assume index hits on all JOIN paths. If EXPLAIN QUERY PLAN shows any SCAN TABLE on `fund_holdings_monthly` — stop and do not proceed.**

---

### Step 6c-pre — EXPLAIN QUERY PLAN Audit (NEW v3)

Run these two EXPLAIN queries against the live D1 instance. Review output before writing a single row. Both must show index usage on `fund_holdings_monthly`. If either shows `SCAN TABLE fund_holdings_monthly` — stop, investigate, and resolve before proceeding.

**EXPLAIN — Pass 1 (ISIN join):**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="EXPLAIN QUERY PLAN
  SELECT
    fhm.report_month,
    iem.entity_id,
    fel.entity_id as holder_entity_id,
    SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum
  FROM fund_holdings_monthly fhm
  JOIN instrument_master im
    ON fhm.isin IS NOT NULL
    AND fhm.isin != ''
    AND fhm.isin = im.isin
  JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
  JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
  WHERE fhm.report_month = '2024-10-31'
    AND fhm.snapshot_status = 'complete'
  GROUP BY fhm.report_month, iem.entity_id, fel.entity_id;"
```

**EXPLAIN — Pass 2 (CUSIP join):**
```bash
wrangler d1 execute meridian-etf --remote \
  --command="EXPLAIN QUERY PLAN
  SELECT
    fhm.report_month,
    iem.entity_id,
    fel.entity_id as holder_entity_id,
    SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum
  FROM fund_holdings_monthly fhm
  JOIN instrument_master im
    ON fhm.cusip IS NOT NULL
    AND fhm.cusip != ''
    AND 'CUSIP:' || TRIM(fhm.cusip) = im.instrument_key
  JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
  JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
  WHERE fhm.report_month = '2024-10-31'
    AND fhm.snapshot_status = 'complete'
    AND (fhm.isin IS NULL OR fhm.isin = '')
  GROUP BY fhm.report_month, iem.entity_id, fel.entity_id;"
```

**Pass condition:** No `SCAN TABLE fund_holdings_monthly` in either output. Report the full EXPLAIN output to the human operator. Wait for explicit confirmation before proceeding.

---

### Live write budget check before Task 6c:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```
Stop if value exceeds 65,000.

---

### Get distinct report months:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT DISTINCT report_month FROM fund_holdings_monthly
             WHERE snapshot_status = 'complete'
             ORDER BY report_month;"
```

Report the list. Process each month in sequence, oldest first.

---

### Task 6c Pass 1 — ISIN-Keyed Exposure Aggregation

For each report month, insert entity exposure rows for instruments matched via ISIN:

```sql
INSERT OR IGNORE INTO entity_exposure_monthly
  (report_month, entity_id, holder_entity_id, weight_sum, computed_at)
SELECT
  fhm.report_month,
  iem.entity_id,
  fel.entity_id as holder_entity_id,
  SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum,
  CURRENT_TIMESTAMP
FROM fund_holdings_monthly fhm
JOIN instrument_master im
  ON fhm.isin IS NOT NULL
  AND fhm.isin != ''
  AND fhm.isin = im.isin
JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
WHERE fhm.report_month = ?
  AND fhm.snapshot_status = 'complete'
GROUP BY fhm.report_month, iem.entity_id, fel.entity_id
```

After each month, check row count in `entity_exposure_monthly` and report before moving to next month.

---

### Task 6c Pass 2 — CUSIP-Keyed Exposure Aggregation

For each report month, insert additional entity exposure rows for instruments matched via CUSIP that were not covered by the ISIN pass. The `INSERT OR IGNORE` ensures no double-counting if a row was already inserted by Pass 1.

Note: TRIM applied to `fhm.cusip` in the JOIN condition — must be byte-identical to the key written in Task 6a.

```sql
INSERT OR IGNORE INTO entity_exposure_monthly
  (report_month, entity_id, holder_entity_id, weight_sum, computed_at)
SELECT
  fhm.report_month,
  iem.entity_id,
  fel.entity_id as holder_entity_id,
  SUM(CAST(fhm.weight_pct AS REAL)) as weight_sum,
  CURRENT_TIMESTAMP
FROM fund_holdings_monthly fhm
JOIN instrument_master im
  ON fhm.cusip IS NOT NULL
  AND fhm.cusip != ''
  AND 'CUSIP:' || TRIM(fhm.cusip) = im.instrument_key
JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
WHERE fhm.report_month = ?
  AND fhm.snapshot_status = 'complete'
  AND (fhm.isin IS NULL OR fhm.isin = '')
GROUP BY fhm.report_month, iem.entity_id, fel.entity_id
```

After each month, report incremental row count added by Pass 2 vs Pass 1 total.

---

### Task 6c-cov — Fund Exposure Coverage Denominator

For each report month, compute total weight vs mapped weight per ETF. Process after both passes complete for that month.

```sql
INSERT OR IGNORE INTO fund_exposure_coverage
  (report_month, holder_entity_id, total_weight, mapped_weight, computed_at)
SELECT
  fhm.report_month,
  fel.entity_id as holder_entity_id,
  SUM(CAST(fhm.weight_pct AS REAL)) as total_weight,
  COALESCE(SUM(CASE WHEN iem.instrument_key IS NOT NULL
    THEN CAST(fhm.weight_pct AS REAL) ELSE 0 END), 0) as mapped_weight,
  CURRENT_TIMESTAMP
FROM fund_holdings_monthly fhm
JOIN fund_entity_link fel ON fhm.series_id = fel.series_id
LEFT JOIN instrument_master im ON (
  (fhm.isin IS NOT NULL AND fhm.isin != '' AND fhm.isin = im.isin)
  OR
  (fhm.cusip IS NOT NULL AND fhm.cusip != '' AND 'CUSIP:' || TRIM(fhm.cusip) = im.instrument_key)
)
LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
WHERE fhm.report_month = ?
  AND fhm.snapshot_status = 'complete'
GROUP BY fhm.report_month, fel.entity_id
```

Note: The coverage denominator query intentionally retains the OR-join as a LEFT JOIN — it must count all holdings rows regardless of match path to produce an accurate denominator. This is safe here because it is a LEFT JOIN (not an INNER JOIN) and the OR branch does not exclude unmatched rows from the result set.

---

## Post-Completion Verification

### Full table summary:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT 'instrument_master' as tbl, COUNT(*) as cnt FROM instrument_master
  UNION ALL SELECT 'instrument_entity_map', COUNT(*) FROM instrument_entity_map
  UNION ALL SELECT 'entity_exposure_monthly', COUNT(*) FROM entity_exposure_monthly
  UNION ALL SELECT 'fund_exposure_coverage', COUNT(*) FROM fund_exposure_coverage;"
```

### Exposure breadth check (NEW v3 — Entities Product Lead requirement):
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT
    COUNT(DISTINCT holder_entity_id) as distinct_holders,
    COUNT(DISTINCT report_month) as distinct_months,
    COUNT(DISTINCT entity_id) as distinct_issuers
  FROM entity_exposure_monthly;"
```

Expected: distinct_holders >= 5, distinct_months >= 3. If either is below threshold — investigate before declaring Gate B complete.

### Coverage quality check:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT
    AVG(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as avg_coverage_pct,
    MIN(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as min_coverage_pct,
    MAX(ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1)) as max_coverage_pct
  FROM fund_exposure_coverage;"
```

Expected: avg_coverage_pct between 30–70%. If below 30% — document as a baseline and flag for review; do not block on this alone.

### Month-by-month exposure distribution:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT report_month, COUNT(*) as entity_pairs
             FROM entity_exposure_monthly
             GROUP BY report_month ORDER BY report_month DESC;"
```

### DGRO graph smoke test:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT entity_id FROM fund_entity_link WHERE etf_symbol = 'DGRO';"
```

Then call:
```bash
curl "https://meridian-entities-api.navinmv1981.workers.dev/api/entities/[DGRO_ENTITY_ID]/graph"
```

Replace `[DGRO_ENTITY_ID]` with the entity_id returned above. Confirm `holdings` array is non-empty with weight values.

### Final write budget:
```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_2026-06-13';"
```

Must be below 80,000. Record value for the day's log.

---

## Success Criteria

| Check | Expected |
|---|---|
| instrument_master rows | 15,000–25,000 |
| instrument_entity_map rows | 8,000–15,000 |
| Indexes on instrument_master and instrument_entity_map | 3 confirmed present |
| entity_exposure_monthly rows | 5,000–15,000 |
| fund_exposure_coverage rows | ~1,150 (115 ETFs × 10 months) |
| Distinct holders in entity_exposure_monthly | >= 5 |
| Distinct months in entity_exposure_monthly | >= 3 |
| Average coverage % | 30–70% (partial pipeline — improves as ETFs complete) |
| DGRO graph response holdings array | Non-empty with weight values |
| writes_today final | Below 80,000 |
| Any existing ETF table modified | Must be zero |
| EXPLAIN QUERY PLAN — no SCAN TABLE on fund_holdings_monthly | Confirmed before 6c runs |

---

## Index Inventory Added by This Prompt

| Table | Index name | Columns | Added by |
|---|---|---|---|
| instrument_master | idx_instrument_master_isin | (isin) | Task 6b-post |
| instrument_master | idx_instrument_master_cusip_issuer | (cusip_issuer_6) | Task 6b-post |
| instrument_entity_map | idx_instrument_entity_map_key | (instrument_key) | Task 6b-post |

These should be added to the D1 index inventory in the Current State document after Gate B completes successfully.
