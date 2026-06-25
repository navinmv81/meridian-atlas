# Corporate Atlas v4 — Full Specification
## Entity Identity Layer for Meridian Atlas

**Version:** 4.0  
**Date:** June 14 2026  
**Status:** Awaiting cross-lane review before execution  
**Working directory:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas`  
**Supersedes:** v3.0 (June 14 2026)  
**Review required from:** ETF Product Lead, Tech Ops / SRE before any gate executes

---

## Change Log — Full Version History

### v1 → v2 (June 14 2026)

| # | Change | Reason |
|---|---|---|
| 1 | Module purpose reframed — entity identity layer for entire terminal, not a lookup tool | Every module references companies as strings. entity_master becomes the canonical record that unifies them. |
| 2 | Entity detail page introduced — dedicated full page with breadcrumb navigation | Modals cannot hold cross-module context. A page is a research destination. |
| 3 | `entity_master` schema upgraded — 7 columns → 40+ columns | Thin schema stored only name and LEI. v2 adds address, jurisdiction, legal form, ownership chain, cross-module flags, freshness. |
| 4 | GLEIF Level 1 field inventory documented in full | v1 only stored lei, lei_status, country. v2 maps all available GLEIF Level 1 fields to schema columns. |
| 5 | Level 2 ownership chain added — direct parent + ultimate parent | North arc of galaxy was name blobs. v2 stores parent LEI, parent name, relationship status, and reporting exceptions. |
| 6 | Reporting exceptions stored as first-class data | "Parent declines to report" is meaningful. Entity card shows reason, not blank ownership section. |
| 7 | Cross-module linkage columns added to schema | `has_etf_holdings`, `has_13f_filings`, `has_market_data` — designed for all modules, ETF populated first. |
| 8 | Freshness badge system introduced | `gleif_last_updated` + green/amber/red badge. Same language as ETF holdings module. |
| 9 | ISIN bulk mapping file introduced as enrichment strategy | Replaces slow 45/hour Phase 2 ISIN lookup cron. One file download resolves thousands of ISINs. |
| 10 | Gate structure formalised — Gate 1 schema migration, Gate 2 enrichment, Gate 3 instrument normalisation, Gate 4 exposure aggregation | Clear separation of concerns. Human approval gate between each stage. |

### v2 → v3 (June 14 2026)

| # | Change | Reason |
|---|---|---|
| 1 | GLEIF data strategy replaced — Golden Copy seed + delta maintenance + targeted API for new entities | v2 ISIN bulk file approach required manual download. v3 is fully automated after one-time seed. |
| 2 | Golden Copy file confirmed as full Level 1 data — 4.84GB unzipped CSV with all entity fields | v2 assumed it was a bare LEI list. Confirmed from actual file header — contains name, address, jurisdiction, status, registration. |
| 3 | Level 2 bulk RR file removed from strategy | At ~900 LEI-bearing entities targeted GLEIF API is faster and simpler than processing a multi-gigabyte relationship file. |
| 4 | Seed script introduced as formal five-step process | v2 had no seed script. v3 defines creation via Claude Code, streaming approach, schema verification, write safety. |
| 5 | Schema migration separated from seed writes with mandatory verification step | ALTER TABLE calls must be confirmed landed before any UPDATE writes against new columns. Critical failure mode eliminated. |
| 6 | `meridian-entities-delta` Worker added — monthly autonomous maintenance | Downloads LastMonth delta from Golden Copy API. Updates changed LEIs. Flags INACTIVE entities. Zero manual intervention. |
| 7 | Enrichment Worker redesigned into four phases | Phase A: LEI resolution. Phase B: Level 1 enrichment. Phase C: Level 2 ownership. Phase D: BIC resolution. 20 entities per phase per invocation. |
| 8 | Gate structure revised — Seed Script precedes Gate 0 | Seed populates entity_master before any instrument or exposure gates execute. |
| 9 | `entity_isin_map` removed (prematurely) | Incorrectly removed in v3 — reinstated in v4. |
| 10 | Success criteria updated | Removed entity_isin_map references incorrectly. Fixed in v4. |

### v3 → v4 (June 14 2026)

| # | Change | Reason |
|---|---|---|
| 1 | Local SQLite (`gleif_local.db`) introduced as GLEIF reference layer | Full 3.3M entity universe loaded locally. No filtering. No artificial subset. Mac handles 3.3M rows trivially. |
| 2 | ISIN-to-LEI file fully loaded into local SQLite — all 8.8M rows | Confirmed file: `lei-isin-20260614T071509.csv`, columns LEI,ISIN. Complete coverage — every ISIN in holdings resolves via local lookup. |
| 3 | `entity_master` scope expanded from 385 to 5,000–8,000 entities | v3 was still filtering to 385 known entities. v4 uses 23,748 holdings ISINs as entry point to discover all issuers. 3.3M Golden Copy records are a reference universe, not a subset to filter. |
| 4 | `entity_isin_map` reinstated as critical bridge table | Exact ISIN → entity_id join in Gate 3. Eliminates approximate name matching from exposure aggregation. Without this the ETF exposure strip cannot be populated reliably. |
| 5 | GLEIF API enrichment Worker scope reduced to genuinely new entities only | Local SQLite handles all known entities instantly. API only fires for post-seed discoveries not yet in gleif_local.db. |
| 6 | Monthly delta updates D1 directly via Golden Copy delta API | Worker downloads LastMonth delta, filters to our entity universe, applies changes to D1. gleif_local.db refreshed separately via monthly full file re-download. |
| 7 | Success criteria reframed as entity detail page UI smoke test | Five entity pages must render completely — large US equity, European bond issuer, fund entity, government bond, small-cap. Every section populated. That is the pass condition. |
| 8 | Cross-module traversal fully specified | ETF holding row → entity icon → `/api/entities/isin/{isin}` → entity page → breadcrumb back. Icon greyed if ISIN unresolved. Absent if no ISIN. |
| 9 | New API endpoint `GET /api/entities/isin/:isin` added | Powers ETF Holdings tab click-through. Direct ISIN → entity_id lookup via entity_isin_map. Returns 404 gracefully for unresolved ISINs. |
| 10 | Freshness badge system extended to all surfaces | Galaxy nodes, search results, entity header all use same green/amber/red language. INACTIVE and LAPSED entity badges added. |
| 11 | `gleif_local.db` creation fully specified as Claude Code task | v3 said "seed script creates it" without explaining how. v4 specifies exact Claude Code prompt, Node.js libraries, streaming approach, transaction batching, index creation, and smoke test. |

---

## 1. Purpose and Strategic Role

Corporate Atlas v4 is the **identity layer for the entire Meridian Atlas terminal**.

Every module references companies as strings today. ETF holdings say "Apple Inc." The 13F module shows "APPLE INC." The market module shows "Apple." These are the same entity. There is no canonical record that unifies them.

`entity_master` is that canonical record. Every dataset in the terminal resolves to it. Every module traverses from it. The entity detail page is where a researcher arrives when they want to know everything about a company — not just what Meridian Atlas holds on it, but who it is, where it is incorporated, who owns it, and what every dataset in the terminal says about it.

This is not a lookup feature. It is the connective tissue of the terminal.

### What cross-module traversal looks like in practice

A researcher is looking at QQQ's holdings tab. They see Apple Inc. at 12.4% weight. They click the entity icon next to Apple. They arrive at the Apple entity detail page — full legal identity, Cupertino HQ, California incorporation, FULLY CORROBORATED LEI, no direct parent (natural persons exception), 47 ETFs holding it with weights, link to SEC EDGAR for 13F filings. They click the 13F link — opens SEC EDGAR search for Apple pre-filled. They press back — return to QQQ Holdings tab exactly where they left it.

That journey — from ETF holding to entity page and back — is the success criterion for this module.

### Terminal traversal map

```
ETF Holdings tab
  └── [entity icon on holding row] ──────────────→ Entity Detail Page
                                                         │
                                          ┌──────────────┼──────────────┐
                                          ↓              ↓              ↓
                                    Parent entity   SEC EDGAR      Back to
                                    (north arc)     13F search     ETF holding
                                          │
                                    Ultimate parent
                                    (north arc)

Galaxy view
  └── [click any node] ─────────────────────────→ Entity Detail Page

Search
  └── [select entity result] ──────────────────→ Entity Detail Page

13F module (future)
  └── [click filer name] ───────────────────────→ Entity Detail Page
```

---

## 2. Architecture Decisions

| Decision | Value | Rationale |
|---|---|---|
| Local SQLite as GLEIF reference | `gleif_local.db` on Mac — full 3.3M entities + 8.8M ISIN pairs | Mac handles this trivially. No filtering. Complete universe available for any future query. |
| D1 as operational subset | Only entities relevant to holdings universe written to D1 | D1 is the runtime store. Local SQLite is the reference store. Separation is clean. |
| ISIN-first resolution | ISIN → LEI (local) → entity record (local) → D1 write | Exact match. No name matching ambiguity for any instrument that has an ISIN in the file. |
| Name matching as fallback only | For CUSIPs and instruments with no ISIN in the mapping file | Confidence-scored. Only high confidence matches written. Low confidence flagged for review. |
| entity_master growth | 3,491 → 5,000–8,000 fully populated entities | All issuers of held securities. Not just pre-seeded fund/manager entities. |
| entity_isin_map as bridge | Exact ISIN → entity_id lookup for Gate 3 joins | Eliminates approximate name matching from exposure aggregation entirely. |
| GLEIF API scope | New entities only — those appearing after seed with no local match | Local SQLite handles everything known. API only for post-seed discoveries. |
| Monthly delta | Updates local SQLite first via Golden Copy delta API, then propagates to D1 | Local DB always current. D1 receives only changes relevant to our entity universe. |
| Entity detail page | Dedicated full page with context-aware breadcrumb | Research destination. Cannot be a modal — too much content, too many traversal paths. |
| Cross-module entry points | ETF holding row icon + galaxy node click + search result + 13F filer (future) | Every surface where an entity appears becomes a traversal entry point. |
| Freshness badge | Green/amber/red on `gleif_last_updated` — same thresholds as ETF holdings | Consistent terminal language. Users learn one system. |

---

## 3. Local GLEIF Reference Database

### File inventory — already downloaded

| File | Path | Size | Rows | Purpose |
|---|---|---|---|---|
| Golden Copy Level 1 | `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas/20260614-0800-gleif-goldencopy-lei2-golden-copy.csv` | 4.84 GB | 3,340,401 | Full entity universe — who is who |
| ISIN-to-LEI mapping | `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas/lei-isin-20260614T071509.csv` | ~500 MB | 8,866,230 | Every ISIN mapped to its issuer LEI |

### Local SQLite database

**Location:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas/gleif_local.db`  
**Created by:** Seed script Phase 1 (one-time, ~10–15 minutes to build)  
**Never uploaded to D1.** Lives on Mac only. Used by seed script and monthly delta script.

**Tables in gleif_local.db:**

```sql
-- Full Golden Copy — all 3.3M entities
CREATE TABLE lei_records (
  lei TEXT PRIMARY KEY,
  legal_name TEXT,
  other_names TEXT,
  legal_address_line1 TEXT,
  legal_address_city TEXT,
  legal_address_region TEXT,
  legal_address_country TEXT,
  legal_address_postcode TEXT,
  hq_city TEXT,
  hq_country TEXT,
  legal_jurisdiction TEXT,
  legal_form_code TEXT,
  legal_form_text TEXT,
  entity_category TEXT,
  entity_status TEXT,
  expiration_date TEXT,
  expiration_reason TEXT,
  registration_authority TEXT,
  business_register_id TEXT,
  lei_registration_status TEXT,
  lei_initial_registration TEXT,
  lei_last_updated TEXT,
  lei_next_renewal TEXT,
  lei_validation_source TEXT,
  normalized_name TEXT  -- pre-computed for name matching fallback
);

CREATE INDEX idx_lei_records_lei ON lei_records(lei);
CREATE INDEX idx_lei_records_normalized ON lei_records(normalized_name);
CREATE INDEX idx_lei_records_status ON lei_records(entity_status);
CREATE INDEX idx_lei_records_country ON lei_records(legal_address_country);

-- Full ISIN-to-LEI mapping — all 8.8M pairs
CREATE TABLE isin_lei_map (
  isin TEXT NOT NULL,
  lei TEXT NOT NULL,
  PRIMARY KEY (isin, lei)
);

CREATE INDEX idx_isin_lei_map_isin ON isin_lei_map(isin);
CREATE INDEX idx_isin_lei_map_lei ON isin_lei_map(lei);
```

**Build time estimate:** Streaming 4.84GB CSV at ~500MB/min = ~10 minutes. Streaming 8.8M ISIN rows = ~3 minutes. Index creation = ~2 minutes. Total: 15–20 minutes. Runs once. Never again unless files are refreshed.

---

## 4. Golden Copy Column Mapping

Full mapping from Golden Copy CSV columns to `lei_records` table and `entity_master` schema:

| Golden Copy column | Local SQLite column | entity_master column |
|---|---|---|
| `LEI` | `lei` | `lei` |
| `Entity.LegalName` | `legal_name` | `legal_name` |
| `Entity.OtherEntityNames.OtherEntityName.1` | `other_names` (JSON) | `other_names` |
| `Entity.LegalAddress.FirstAddressLine` | `legal_address_line1` | `legal_address_line1` |
| `Entity.LegalAddress.City` | `legal_address_city` | `legal_address_city` |
| `Entity.LegalAddress.Region` | `legal_address_region` | `legal_address_region` |
| `Entity.LegalAddress.Country` | `legal_address_country` | `legal_address_country` |
| `Entity.LegalAddress.PostalCode` | `legal_address_postcode` | `legal_address_postcode` |
| `Entity.HeadquartersAddress.City` | `hq_city` | `hq_city` |
| `Entity.HeadquartersAddress.Country` | `hq_country` | `hq_country` |
| `Entity.LegalJurisdiction` | `legal_jurisdiction` | `legal_jurisdiction` |
| `Entity.LegalForm.EntityLegalFormCode` | `legal_form_code` | `legal_form_code` |
| `Entity.LegalForm.OtherLegalForm` | `legal_form_text` | `legal_form_text` |
| `Entity.EntityCategory` | `entity_category` | `entity_category` |
| `Entity.EntityStatus` | `entity_status` | `entity_status` |
| `Entity.EntityExpirationDate` | `expiration_date` | `expiration_date` |
| `Entity.EntityExpirationReason` | `expiration_reason` | `expiration_reason` |
| `Entity.RegistrationAuthority.RegistrationAuthorityID` | `registration_authority` | `registration_authority` |
| `Entity.RegistrationAuthority.RegistrationAuthorityEntityID` | `business_register_id` | `business_register_id` |
| `Registration.InitialRegistrationDate` | `lei_initial_registration` | `lei_initial_registration` |
| `Registration.LastUpdateDate` | `lei_last_updated` | `lei_last_updated` |
| `Registration.RegistrationStatus` | `lei_registration_status` | `lei_registration_status` |
| `Registration.NextRenewalDate` | `lei_next_renewal` | `lei_next_renewal` |
| `Registration.ValidationSources` | `lei_validation_source` | `lei_validation_source` |

---

## 5. D1 Schema — entity_master v4

### Current columns (exist today)
```sql
entity_id, normalized_name, type, lei, lei_status, country, created_at
```

### New columns to add via migration
```sql
-- Identity
ALTER TABLE entity_master ADD COLUMN legal_name TEXT;
ALTER TABLE entity_master ADD COLUMN other_names TEXT;           -- JSON array [{name, type}]

-- Classification
ALTER TABLE entity_master ADD COLUMN entity_category TEXT;      -- GENERAL, FUND, BRANCH, SOLE_PROPRIETOR
ALTER TABLE entity_master ADD COLUMN entity_status TEXT;        -- ACTIVE, INACTIVE
ALTER TABLE entity_master ADD COLUMN expiration_date TEXT;
ALTER TABLE entity_master ADD COLUMN expiration_reason TEXT;    -- DISSOLVED, MERGED, etc.

-- Legal address
ALTER TABLE entity_master ADD COLUMN legal_address_line1 TEXT;
ALTER TABLE entity_master ADD COLUMN legal_address_city TEXT;
ALTER TABLE entity_master ADD COLUMN legal_address_region TEXT;
ALTER TABLE entity_master ADD COLUMN legal_address_country TEXT;
ALTER TABLE entity_master ADD COLUMN legal_address_postcode TEXT;

-- Headquarters
ALTER TABLE entity_master ADD COLUMN hq_city TEXT;
ALTER TABLE entity_master ADD COLUMN hq_country TEXT;

-- Incorporation
ALTER TABLE entity_master ADD COLUMN legal_jurisdiction TEXT;
ALTER TABLE entity_master ADD COLUMN legal_form_code TEXT;      -- ISO 20275
ALTER TABLE entity_master ADD COLUMN legal_form_text TEXT;

-- Registration
ALTER TABLE entity_master ADD COLUMN business_register_id TEXT;
ALTER TABLE entity_master ADD COLUMN registration_authority TEXT;

-- LEI metadata
ALTER TABLE entity_master ADD COLUMN lei_registration_status TEXT;
ALTER TABLE entity_master ADD COLUMN lei_initial_registration TEXT;
ALTER TABLE entity_master ADD COLUMN lei_last_updated TEXT;
ALTER TABLE entity_master ADD COLUMN lei_next_renewal TEXT;
ALTER TABLE entity_master ADD COLUMN lei_validation_source TEXT;

-- Identifiers
ALTER TABLE entity_master ADD COLUMN bic_codes TEXT;            -- JSON array
ALTER TABLE entity_master ADD COLUMN primary_ticker TEXT;

-- Ownership — direct parent
ALTER TABLE entity_master ADD COLUMN direct_parent_lei TEXT;
ALTER TABLE entity_master ADD COLUMN direct_parent_name TEXT;   -- denormalised for display
ALTER TABLE entity_master ADD COLUMN direct_parent_relationship_status TEXT;
ALTER TABLE entity_master ADD COLUMN direct_parent_period_start TEXT;
ALTER TABLE entity_master ADD COLUMN direct_parent_exception TEXT;

-- Ownership — ultimate parent
ALTER TABLE entity_master ADD COLUMN ultimate_parent_lei TEXT;
ALTER TABLE entity_master ADD COLUMN ultimate_parent_name TEXT; -- denormalised for display
ALTER TABLE entity_master ADD COLUMN ultimate_parent_relationship_status TEXT;
ALTER TABLE entity_master ADD COLUMN ultimate_parent_exception TEXT;

-- Cross-module flags
ALTER TABLE entity_master ADD COLUMN has_etf_holdings INTEGER DEFAULT 0;
ALTER TABLE entity_master ADD COLUMN etf_holding_count INTEGER DEFAULT 0;
ALTER TABLE entity_master ADD COLUMN has_13f_filings INTEGER DEFAULT 0;    -- future
ALTER TABLE entity_master ADD COLUMN has_market_data INTEGER DEFAULT 0;    -- future
ALTER TABLE entity_master ADD COLUMN primary_ticker TEXT;

-- Data quality
ALTER TABLE entity_master ADD COLUMN gleif_last_updated TEXT;
ALTER TABLE entity_master ADD COLUMN gleif_enrichment_version INTEGER DEFAULT 1;
ALTER TABLE entity_master ADD COLUMN isin_match_count INTEGER DEFAULT 0;   -- how many ISINs resolved to this entity
ALTER TABLE entity_master ADD COLUMN match_source TEXT;                    -- 'isin_direct', 'name_match', 'manual'
```

### New D1 table — entity_isin_map
```sql
CREATE TABLE IF NOT EXISTS entity_isin_map (
  isin TEXT NOT NULL,
  lei TEXT NOT NULL,
  entity_id INTEGER,              -- FK to entity_master once entity is written
  match_source TEXT DEFAULT 'isin_direct',
  confidence INTEGER DEFAULT 100, -- 100=direct ISIN match, 75=name match fallback
  mapped_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (isin, lei)
);

CREATE INDEX IF NOT EXISTS idx_entity_isin_map_isin ON entity_isin_map(isin);
CREATE INDEX IF NOT EXISTS idx_entity_isin_map_lei ON entity_isin_map(lei);
CREATE INDEX IF NOT EXISTS idx_entity_isin_map_entity ON entity_isin_map(entity_id);
```

### New indexes on entity_master
```sql
CREATE INDEX IF NOT EXISTS idx_entity_master_lei
  ON entity_master(lei);
CREATE INDEX IF NOT EXISTS idx_entity_master_status
  ON entity_master(entity_status);
CREATE INDEX IF NOT EXISTS idx_entity_master_jurisdiction
  ON entity_master(legal_jurisdiction);
CREATE INDEX IF NOT EXISTS idx_entity_master_direct_parent
  ON entity_master(direct_parent_lei);
CREATE INDEX IF NOT EXISTS idx_entity_master_ultimate_parent
  ON entity_master(ultimate_parent_lei);
CREATE INDEX IF NOT EXISTS idx_entity_master_match_source
  ON entity_master(match_source);
```

---

## 6. Seed Script — One-Time Local Execution

**Created by:** Claude Code — given this spec, writes `gleif-seed.js` in the Corporate Atlas working directory. Operator reviews script before running.  
**Runs on:** Local Mac only  
**Runtime estimate:** 20–30 minutes total  
**Prerequisite:** Both CSV files confirmed present at paths in Section 3  

### How gleif_local.db is created

`gleif_local.db` does not exist yet. It is created by giving Claude Code the following prompt. Claude Code writes `gleif-build-local.js`, you review it, then run it once. It never runs again unless you refresh the Golden Copy files.

---

**Exact prompt to give Claude Code to create gleif_local.db:**

> **Working directory:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas`
>
> **Task:** Create a Node.js script `gleif-build-local.js` that builds a local SQLite database `gleif_local.db` in the current working directory from two CSV files that are already present.
>
> **File 1 — Golden Copy Level 1:**
> `20260614-0800-gleif-goldencopy-lei2-golden-copy.csv`
> 3,340,401 rows. 4.84GB. Tab-separated or comma-separated — check the actual delimiter from the first line before parsing.
>
> **File 2 — ISIN-to-LEI mapping:**
> `lei-isin-20260614T071509.csv`
> 8,866,230 rows. Two columns: `LEI,ISIN` (confirmed).
>
> **Requirements:**
>
> 1. Use the `better-sqlite3` npm package for all SQLite operations — synchronous, fast, no callbacks needed.
> 2. Use Node.js `readline` + `fs.createReadStream` to stream both files line by line. Never load either file into memory. Never use readFileSync.
> 3. Create `gleif_local.db` with two tables:
>
> ```sql
> CREATE TABLE IF NOT EXISTS lei_records (
>   lei TEXT PRIMARY KEY,
>   legal_name TEXT,
>   other_names TEXT,
>   legal_address_line1 TEXT,
>   legal_address_city TEXT,
>   legal_address_region TEXT,
>   legal_address_country TEXT,
>   legal_address_postcode TEXT,
>   hq_city TEXT,
>   hq_country TEXT,
>   legal_jurisdiction TEXT,
>   legal_form_code TEXT,
>   legal_form_text TEXT,
>   entity_category TEXT,
>   entity_status TEXT,
>   expiration_date TEXT,
>   expiration_reason TEXT,
>   registration_authority TEXT,
>   business_register_id TEXT,
>   lei_registration_status TEXT,
>   lei_initial_registration TEXT,
>   lei_last_updated TEXT,
>   lei_next_renewal TEXT,
>   lei_validation_source TEXT,
>   normalized_name TEXT
> );
>
> CREATE TABLE IF NOT EXISTS isin_lei_map (
>   isin TEXT NOT NULL,
>   lei TEXT NOT NULL,
>   PRIMARY KEY (isin, lei)
> );
> ```
>
> 4. Parse the Golden Copy CSV header row first to build a column-index map. Map these columns to lei_records:
>    - `LEI` → `lei`
>    - `Entity.LegalName` → `legal_name`
>    - `Entity.OtherEntityNames.OtherEntityName.1` → `other_names`
>    - `Entity.LegalAddress.FirstAddressLine` → `legal_address_line1`
>    - `Entity.LegalAddress.City` → `legal_address_city`
>    - `Entity.LegalAddress.Region` → `legal_address_region`
>    - `Entity.LegalAddress.Country` → `legal_address_country`
>    - `Entity.LegalAddress.PostalCode` → `legal_address_postcode`
>    - `Entity.HeadquartersAddress.City` → `hq_city`
>    - `Entity.HeadquartersAddress.Country` → `hq_country`
>    - `Entity.LegalJurisdiction` → `legal_jurisdiction`
>    - `Entity.LegalForm.EntityLegalFormCode` → `legal_form_code`
>    - `Entity.LegalForm.OtherLegalForm` → `legal_form_text`
>    - `Entity.EntityCategory` → `entity_category`
>    - `Entity.EntityStatus` → `entity_status`
>    - `Entity.EntityExpirationDate` → `expiration_date`
>    - `Entity.EntityExpirationReason` → `expiration_reason`
>    - `Entity.RegistrationAuthority.RegistrationAuthorityID` → `registration_authority`
>    - `Entity.RegistrationAuthority.RegistrationAuthorityEntityID` → `business_register_id`
>    - `Registration.InitialRegistrationDate` → `lei_initial_registration`
>    - `Registration.LastUpdateDate` → `lei_last_updated`
>    - `Registration.RegistrationStatus` → `lei_registration_status`
>    - `Registration.NextRenewalDate` → `lei_next_renewal`
>    - `Registration.ValidationSources` → `lei_validation_source`
>
> 5. Compute `normalized_name` for each row using this function before inserting:
> ```javascript
> function normalizeName(name) {
>   if (!name) return null;
>   return name
>     .toUpperCase()
>     .trim()
>     .replace(/\s+(INC\.?|CORP\.?|LTD\.?|LLC\.?|PLC\.?|NV|AG|SA|SAS|GMBH|BV|SE|HOLDING|HOLDINGS|GROUP|CO\.?|COMPANY|TRUST|ETF|FUND|FUNDS)\.?\s*$/i, '')
>     .replace(/[,\.]/g, '')
>     .replace(/\s+/g, ' ')
>     .trim();
> }
> ```
>
> 6. Use `better-sqlite3` prepared statements and wrap inserts in explicit transactions — commit every 10,000 rows. This is critical for performance. Without transactions, 3.3M individual inserts will take hours. With transactions, expect ~10 minutes.
>
> 7. Log progress every 200,000 rows for the Golden Copy, every 500,000 rows for the ISIN file.
>
> 8. After both files are loaded, create all indexes:
> ```sql
> CREATE INDEX IF NOT EXISTS idx_lei_records_normalized ON lei_records(normalized_name);
> CREATE INDEX IF NOT EXISTS idx_lei_records_status ON lei_records(entity_status);
> CREATE INDEX IF NOT EXISTS idx_lei_records_country ON lei_records(legal_address_country);
> CREATE INDEX IF NOT EXISTS idx_isin_lei_map_isin ON isin_lei_map(isin);
> CREATE INDEX IF NOT EXISTS idx_isin_lei_map_lei ON isin_lei_map(lei);
> ```
>
> 9. Run verification queries and report:
> ```sql
> SELECT COUNT(*) FROM lei_records;    -- expect 3,340,401
> SELECT COUNT(*) FROM isin_lei_map;   -- expect 8,866,230
> SELECT lei, legal_name, entity_status, hq_city, legal_jurisdiction
>   FROM lei_records
>   WHERE lei = 'HWUPKR0MPOU8FGXBT394';  -- Apple Inc. smoke test
> ```
>
> 10. Install `better-sqlite3` if not already present: `npm install better-sqlite3`
>
> **Do not write to D1. Do not call any external API. Do not modify any file in `../ETF Refresh/`. This script only reads the two local CSV files and writes `gleif_local.db`.**
>
> **When done:** report the three verification query results and stop.

---

Once `gleif_local.db` exists and verification passes, the seed script `gleif-seed.js` (a separate Claude Code task) reads from it. The two scripts are separate — build the local database first, verify it, then run the seed.

### Phase 1 — Build local GLEIF database (gleif_local.db)

Stream both CSV files into local SQLite using `gleif-build-local.js` as specified above. Never load into memory. Use Node.js `readline` + `fs.createReadStream` with `better-sqlite3` transactions throughout.

Run `gleif-build-local.js` as described above. Verify the three smoke test results before proceeding to Phase 2. Stop if either count is significantly below expected.

### Phase 2 — Resolve holdings universe against local GLEIF database

**Step 2a — Load distinct ISINs from D1:**
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT DISTINCT isin FROM fund_holdings_monthly
             WHERE isin IS NOT NULL AND isin != ''
             AND snapshot_status = 'complete';"
```
Expected: 23,748 distinct ISINs. Store as a Set.

**Step 2b — ISIN resolution (primary path):**

For each of the 23,748 ISINs, query local SQLite:
```sql
SELECT isl.lei, lr.*
FROM isin_lei_map isl
JOIN lei_records lr ON isl.lei = lr.lei
WHERE isl.isin = ?
```

Group results by LEI — one entity record per LEI, collecting all ISINs that map to it.

Build result structure:
```javascript
{
  lei: 'HWUPKR0MPOU8FGXBT394',
  entity: { /* all lei_records fields */ },
  matched_isins: ['US0378331005', 'US0378331005', ...],
  isin_count: 12
}
```

Log:
- ISINs successfully matched: expected 14,000–19,000
- ISINs with no ISIN file match: remainder — goes to fallback
- Distinct LEIs resolved: expected 3,000–6,000

**Step 2c — CUSIP fallback for unmatched instruments:**

For ISINs with no match in the ISIN file, load their security_name and cusip from D1:
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT DISTINCT isin, cusip, security_name
             FROM fund_holdings_monthly
             WHERE snapshot_status = 'complete'
             AND isin IN ([unmatched ISINs]);"
```

For each unmatched instrument, normalise `security_name` and query local SQLite:
```sql
SELECT lei, legal_name, entity_status, legal_jurisdiction
FROM lei_records
WHERE normalized_name = ?
LIMIT 5
```

Score matches. Write only where confidence >= 80. Flag uncertain matches to a review file `seed-review.json` — do not write these to D1 automatically.

**Step 2d — Load existing entity_master for deduplication:**
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT entity_id, lei, normalized_name, type FROM entity_master;"
```

Build map: `lei → entity_id` for existing entities. Build map: `normalized_name → entity_id` for entities without LEI.

### Phase 3 — Schema migration

Run each ALTER TABLE statement from Section 5 individually via `wrangler d1 execute`. Wrap each in try/catch — catch "duplicate column" errors silently, log and continue.

After all ALTER TABLE calls complete — mandatory verification:
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT name FROM pragma_table_info('entity_master') ORDER BY name;"
```

Confirm every new column from Section 5 is present. If any column missing — stop and report. Do not proceed to Phase 4.

Create `entity_isin_map` table and all indexes from Section 5.

Report: "Schema migration verified. All columns present."

### Phase 4 — Write to D1

**WRITE METHOD — MANDATORY (added June 14 2026, cross-lane review):**
All Phase 4 writes use the Node.js Wrangler D1 SDK with `db.batch()` in groups
of 50. The `wrangler d1 execute` CLI path is not used for bulk inserts — it lacks
native batch support and will be prohibitively slow at 5,000+ rows and may hit
CLI rate limits. The seed script (`gleif-seed.js`) is a Node.js file created by
Claude Code, not a shell script. This is the same pattern as Prompt 6 v3 and is
required for all bulk write operations across Corporate Atlas.

**Write budget check before starting:**
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT value FROM holdings_pipeline_state
             WHERE key = 'writes_today_2026-06-14';"
```
Stop if above 15,000.

**Step 4a — INSERT new entities (discovered via ISIN resolution, not yet in entity_master):**

For each resolved LEI that has no matching entity_id in existing entity_master:

```sql
INSERT OR IGNORE INTO entity_master
  (normalized_name, type, lei, lei_status, country,
   legal_name, entity_category, entity_status,
   legal_address_line1, legal_address_city, legal_address_region,
   legal_address_country, legal_address_postcode,
   hq_city, hq_country, legal_jurisdiction,
   legal_form_code, legal_form_text,
   business_register_id, registration_authority,
   lei_registration_status, lei_initial_registration,
   lei_last_updated, lei_next_renewal, lei_validation_source,
   isin_match_count, match_source, gleif_last_updated,
   gleif_enrichment_version)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
```

`type` derived from `entity_category`:
- FUND → 'fund'
- GENERAL + financial jurisdiction → 'operating'
- everything else → 'operating'

Batch size: 10 rows per wrangler CLI call. escapeVal() on every value.

Log progress every 100 entities.

**Step 4b — UPDATE existing entities (already in entity_master, now enriched):**

For each resolved LEI that has an existing entity_id — UPDATE all Level 1 columns. One UPDATE per entity. 385 max for existing entities. Fast.

**Step 4c — Write entity_isin_map:**

For every ISIN → LEI pair that resolved successfully, write to entity_isin_map. At this point we have entity_ids for all new and existing entities, so `entity_id` can be populated.

Batch: 10 rows per wrangler CLI call. Expected: 14,000–19,000 rows.

**Step 4d — Retrieve assigned entity_ids for newly inserted entities:**
```bash
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT entity_id, lei FROM entity_master WHERE gleif_enrichment_version = 2;"
```

Use these to backfill `entity_id` in `entity_isin_map` for newly inserted entities.

### Phase 5 — Seed Verification

Run all five verification queries and report:

```bash
# 1 — Entity counts
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT
    COUNT(*) as total_entities,
    COUNT(CASE WHEN lei IS NOT NULL THEN 1 END) as has_lei,
    COUNT(CASE WHEN entity_status IS NOT NULL THEN 1 END) as has_status,
    COUNT(CASE WHEN legal_jurisdiction IS NOT NULL THEN 1 END) as has_jurisdiction,
    COUNT(CASE WHEN hq_city IS NOT NULL THEN 1 END) as has_hq,
    COUNT(CASE WHEN gleif_enrichment_version = 2 THEN 1 END) as v2_enriched
  FROM entity_master;"
```

```bash
# 2 — Entity status breakdown
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT entity_status, COUNT(*) as cnt
  FROM entity_master WHERE lei IS NOT NULL
  GROUP BY entity_status ORDER BY cnt DESC;"
```

```bash
# 3 — ISIN bridge coverage
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT
    COUNT(*) as isin_map_rows,
    COUNT(DISTINCT lei) as distinct_leis,
    COUNT(DISTINCT entity_id) as distinct_entities,
    COUNT(CASE WHEN entity_id IS NOT NULL THEN 1 END) as fully_linked
  FROM entity_isin_map;"
```

```bash
# 4 — Sample entity card data quality check
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT legal_name, lei, entity_status, legal_jurisdiction,
    hq_city, hq_country, legal_address_city, lei_validation_source,
    match_source, isin_match_count
  FROM entity_master
  WHERE lei IS NOT NULL AND entity_status IS NOT NULL
  ORDER BY isin_match_count DESC
  LIMIT 15;"
```

```bash
# 5 — Final write budget
wrangler d1 execute meridian-etf --remote --json \
  --command="SELECT value FROM holdings_pipeline_state
  WHERE key = 'writes_today_2026-06-14';"
```

**Seed is complete when:** total_entities >= 5,000, has_status >= 4,000, isin_map_rows >= 14,000, fully_linked >= 14,000, writes_today below 80,000.

---

## 7. Gate Structure — Post-Seed

```
Seed Script (local Mac, one-time — Section 6)
  └── Phase 1: Build gleif_local.db
  └── Phase 2: Resolve 23,748 ISINs against local GLEIF database
  └── Phase 3: Schema migration + verification
  └── Phase 4: Write new entities + update existing + populate entity_isin_map
  └── Phase 5: Verify seed results
  └── STOP. Human reviews verification output before Gate 0.

Gate 0 — Pre-flight checks (Section 9)

Gate 1 — Instrument Normalization (Task 6a)
  └── Resume from 12,660 partial rows in instrument_master
  └── INSERT OR IGNORE — safe resume
  └── Report final row count. Stop.

Gate 2 — Instrument to Entity Mapping (Task 6b)
  └── Primary path: instrument_key → entity_isin_map → entity_id (exact)
  └── Fallback: CUSIP issuer grouping (confidence 90)
  └── Fallback: name matching (confidence 75)
  └── Create three indexes (Task 6b-post)
  └── Report mapping breakdown by source. Stop.

Gate 3 — Exposure Aggregation (Task 6c)
  └── EXPLAIN QUERY PLAN audit mandatory before any writes
  └── Pass 1: ISIN-keyed — join via entity_isin_map (exact)
  └── Pass 2: CUSIP-keyed — join via instrument_entity_map (approximate fallback)
  └── Coverage denominator per month
  └── Report table counts and coverage %. Stop.

Gate 4 — Cross-Module Flags
  └── Populate has_etf_holdings, etf_holding_count on entity_master
  └── Populate primary_ticker on entity_master
  └── Report. Stop.
```

---

## 8. Autonomous Maintenance Pipeline

### Worker: meridian-entities-seed (existing — minor update)

**Schedule:** Daily 03:00 UTC  
**Change:** After seeding new entities from ETF holdings, check `entity_isin_map` for any new ISINs not yet mapped. Queue for enrichment.

### Worker: meridian-entities-enrich (redesigned — targeted API only)

**Schedule:** Every 30 minutes  
**Scope:** Only entities that appeared after the seed run — new ETF holdings discoveries with no local GLEIF match.

**Phase A — LEI resolution for new entities:**
Takes 20 entities WHERE `lei IS NULL` and `gleif_enrichment_version < 2`. Calls GLEIF API fuzzy name search. On match — writes LEI, queues for Phase B.

**Phase B — Level 1 enrichment for newly resolved entities:**
Takes 20 entities WHERE `lei IS NOT NULL` AND `gleif_enrichment_version < 2`. Calls GLEIF API Level 1 endpoint. Writes all v4 columns.

**Phase C — Level 2 ownership for all LEI-bearing entities:**
Takes 20 entities WHERE `lei IS NOT NULL` AND `direct_parent_lei IS NULL` AND `direct_parent_exception IS NULL`. Calls GLEIF API Level 2 endpoints. Writes parent chain and denormalised parent names.

**Phase D — BIC resolution (fund/manager only, even hours):**
Takes 20 fund/manager entities WHERE `bic_codes IS NULL`. Calls GLEIF BIC mapping endpoint.

**Rate limit:** 60 requests/minute. Max 20 API calls per phase. 1,100ms delay between calls. Well within 50 subrequest free-tier limit.

### Worker: meridian-entities-delta (new)

**Schedule:** 1st of each month, 02:00 UTC  
**Purpose:** Keeps local GLEIF database and D1 entity_master current with GLEIF changes.

**Step 1 — This Worker cannot update gleif_local.db directly** (local Mac file, not accessible from Cloudflare). Instead it downloads the LastMonth delta directly and processes it in-memory:

```
GET https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest.csv?delta=LastMonth
```

Follow 302 redirect. Parse CSV response in-memory (delta is small — changed records only).

**Step 2 — Filter to LEIs in entity_master:**
```sql
SELECT DISTINCT lei FROM entity_master WHERE lei IS NOT NULL
```

**Step 3 — Apply changes:**

| Change type | Action |
|---|---|
| entity_status → INACTIVE | Update entity_master. Set gleif_last_updated. UI shows INACTIVE badge. |
| lei_registration_status → LAPSED or RETIRED | Update status. Log change. |
| Entity.LegalName changed | Update legal_name. Append previous to other_names JSON array. |
| Address fields changed | Update address columns. |
| New LEI not yet in entity_master | Insert skeleton row. Queue for Phase B enrichment. |

**Step 4 — Log to holdings_pipeline_state:**
```
entity_delta_last_run: { date, entities_updated, newly_inactive, new_leis_found }
```

**Note on gleif_local.db:** The local SQLite on your Mac is updated separately — re-download the full Golden Copy file monthly and rebuild `gleif_local.db` using the same seed script Phase 1. Takes 15 minutes. Add to your monthly routine alongside reviewing the delta Worker output.

---

## 9. Gate 0 — Pre-Flight Checklist

| # | Check | Command | Pass condition | Action if failing |
|---|---|---|---|---|
| 1 | Seed confirmed complete | `SELECT COUNT(*) FROM entity_master WHERE gleif_enrichment_version = 2` | >= 4,000 | Run seed script first |
| 2 | entity_isin_map populated | `SELECT COUNT(*) FROM entity_isin_map` | >= 14,000 | Run seed script first |
| 3 | Schema verified | `SELECT name FROM pragma_table_info('entity_master')` | All v4 columns present | Re-run seed Phase 3 |
| 4 | Write guard | `SELECT value FROM holdings_pipeline_state WHERE key = 'writes_today_{date}'` | Below 15,000 | Wait for UTC midnight reset |
| 5 | instrument_master state | `SELECT COUNT(*) FROM instrument_master` | 12,660 (resume) or 0 (fresh) | Note for Gate 1 |
| 6 | entity_exposure_monthly clean | `SELECT COUNT(*) FROM entity_exposure_monthly` | 0 | Confirm resume if non-zero |
| 7 | fund_entity_link coverage | Compare linked_etfs vs complete_etfs | linked_etfs >= complete_etfs | Investigate missing links |
| 8 | ETF pipeline cron idle | Cloudflare dashboard | Not actively writing | Defer 30 minutes if mid-run |

---

## 10. API — meridian-entities-api

### GET /api/entities/:id — full entity record

```json
{
  "entity_id": 42,
  "lei": "HWUPKR0MPOU8FGXBT394",
  "legal_name": "Apple Inc.",
  "normalized_name": "APPLE",
  "type": "operating",
  "entity_category": "GENERAL",
  "entity_status": "ACTIVE",
  "match_source": "isin_direct",
  "isin_match_count": 12,

  "legal_address": {
    "line1": "C/O C T Corporation System, 818 West 7th Street",
    "city": "Los Angeles",
    "region": "US-CA",
    "country": "US",
    "postcode": "90017"
  },

  "headquarters": {
    "city": "Cupertino",
    "country": "US"
  },

  "incorporation": {
    "jurisdiction": "US-CA",
    "legal_form_code": "8888",
    "legal_form_text": "INCORPORATED",
    "business_register_id": "C0806592",
    "registration_authority": "RA000598"
  },

  "lei_registration": {
    "status": "ISSUED",
    "initial_date": "2012-06-06",
    "last_updated": "2017-12-12",
    "next_renewal": "2018-12-13",
    "validation_source": "FULLY_CORROBORATED"
  },

  "ownership": {
    "direct_parent": {
      "lei": null,
      "name": null,
      "relationship_status": null,
      "period_start": null,
      "exception": "NATURAL_PERSONS"
    },
    "ultimate_parent": {
      "lei": null,
      "name": null,
      "exception": "NATURAL_PERSONS"
    }
  },

  "identifiers": {
    "bic_codes": [],
    "primary_ticker": "AAPL"
  },

  "cross_module": {
    "has_etf_holdings": true,
    "etf_holding_count": 47,
    "has_13f_filings": false,
    "has_market_data": false
  },

  "freshness": {
    "gleif_last_updated": "2026-06-14",
    "status": "current"
  }
}
```

### GET /api/entities/:id/graph

North arc: direct parent node + ultimate parent node with jurisdiction context. South arc: top holdings issuers by weight. Ownership exceptions shown as labelled node with reason text.

### GET /api/entities/:id/etf-exposure

```json
{
  "entity_id": 42,
  "holdings": [
    { "etf_symbol": "QQQ", "etf_name": "Invesco QQQ Trust", "weight_sum": 12.4, "report_month": "2025-01-31" },
    { "etf_symbol": "VGT", "etf_name": "Vanguard IT ETF", "weight_sum": 8.7, "report_month": "2025-01-31" }
  ],
  "total_etfs": 47,
  "coverage_note": "Based on N-PORT filings. 60-day reporting lag applies."
}
```

### GET /api/entities/search (upgraded)

Returns `entity_status`, `legal_jurisdiction`, `hq_city`, `primary_ticker`, `isin_match_count` in results. Search dropdown shows meaningful context immediately — not just a name.

### GET /api/entities/isin/:isin (new)

Direct ISIN-to-entity lookup. Powers the ETF Holdings tab click-through.

```json
{
  "isin": "US0378331005",
  "entity_id": 42,
  "lei": "HWUPKR0MPOU8FGXBT394",
  "legal_name": "Apple Inc.",
  "entity_status": "ACTIVE",
  "hq_city": "Cupertino",
  "hq_country": "US"
}
```

Returns 404 if ISIN not in `entity_isin_map`. Frontend handles 404 gracefully — entity icon shown as greyed-out for unresolved ISINs.

---

## 11. UI — The Success Criterion

The entity detail page is the measure of success for this entire module. Every upstream pipeline decision — the local SQLite strategy, the ISIN-first resolution, the entity_isin_map bridge, the Level 2 ownership enrichment — exists to make this page render completely and correctly.

### What must be explicitly redesigned — ma-entities.js

The current `ma-entities.js` must be **substantially rewritten** as part of this spec. It is not sufficient to patch it. The existing implementation was built around the thin `entity_master` schema — name blobs, minimal metadata, no address data, no ownership context, no cross-module traversal. That code cannot surface the v4 data model without a ground-up redesign of its view layer.

**Current state of ma-entities.js — what exists today:**

| Component | Current state | v4 requirement |
|---|---|---|
| Galaxy SVG | Radial layout, north arc = parents/managers, south arc = top holdings. Node click re-centres galaxy. | Keep radial layout. Upgrade node click to navigate to entity detail page instead of re-centring. Enrich node tooltips with legal_name, entity_status badge, hq_city. |
| Entity search | Name or LEI search, returns name blob results. | Upgrade results to show entity_status badge, hq_city, primary_ticker, isin_match_count. |
| Exposure strip | Shows coverage badge. | Upgrade to use `/api/entities/:id/etf-exposure` — show ETF name, weight bar, report month. |
| Breadcrumb | None. | Add context-aware breadcrumb — "← Back to Galaxy" or "← Back to QQQ Holdings". |
| Entity detail view | Does not exist — node click re-centres galaxy, no dedicated detail surface. | **Build from scratch** — see layout spec below. |
| Ownership section | North arc shows parent/manager nodes. | Replace with structured ownership panel — direct parent name + LEI + exception reason, ultimate parent name + LEI + exception reason. |
| Freshness badge | Basic coverage badge only. | Full freshness system — green/amber/red on gleif_last_updated, INACTIVE and LAPSED entity badges. |

**Implementation sequence for ma-entities.js redesign:**

This is a phased rewrite, not a single commit. Each phase is a separate Claude Code task, reviewed and tested before the next begins.

```
Phase UI-1 — Entity detail page (new surface)
  Build the entity detail page function in ma-entities.js
  Called with an entity_id — fetches /api/entities/:id
  Renders all sections: header, ownership, identifiers, ETF exposure, 13F link
  Breadcrumb: "← Back to Galaxy"
  No galaxy changes yet — this is a standalone new function

Phase UI-2 — Galaxy node click upgrade
  Change node click handler from re-centre to navigate to entity detail page
  Pass entity_id to entity detail page function
  Add richer node tooltip on hover: legal_name, entity_status badge, hq_city
  Breadcrumb on entity detail page: "← Back to Galaxy"

Phase UI-3 — Search upgrade
  Upgrade search results to show entity_status, hq_city, primary_ticker, isin_match_count
  Search result click navigates to entity detail page
  Breadcrumb: "← Back to Search results"

Phase UI-4 — ETF Holdings tab cross-module link (ma-etf.js change)
  Add entity icon to each holding row in ma-etf.js Holdings tab
  On click: call /api/entities/isin/{isin} → navigate to entity detail page
  Breadcrumb: "← Back to {ETF ticker} Holdings"
  Greyed icon for unresolved ISINs. No icon if no ISIN.
  This phase touches ma-etf.js — requires ETF Product Lead review before deploy.

  IMPLEMENTATION CONSTRAINTS — Phase UI-4 (added June 14 2026, cross-lane review)
  These are non-negotiable and must be confirmed in the ETF Product Lead review
  before Phase UI-4 is deployed:

  A1 — ETF Lead conditions (R6 sign-off requirements):
    - Icon element is purely additive — no existing DOM elements moved or restructured
    - No changes to fetchHoldings(), renderHoldings(), or any existing ma-etf.js
      data structures or fetch logic
    - Icon appended after security_name span only — no holdings row layout changes

  A2 — Click-on-demand rule (non-negotiable implementation requirement):
    - GET /api/entities/isin/:isin fires ONLY on user click — never on row render
    - Firing this call on render for a fund like QQQ (100+ holdings) would produce
      100+ sequential subrequests on page load — prohibited
    - Icon renders synchronously from the existing isin field already present in
      the holding row data — no additional data fetch required to display the icon
    - Show loading state on click while API call resolves
    - Handle 404 gracefully — icon shown as greyed-out with tooltip
      "Entity not yet resolved", no error thrown, no console noise
    - Handle network error gracefully — same greyed treatment as 404

Phase UI-5 — Freshness badges everywhere
  Apply green/amber/red freshness badge to entity detail page header
  Apply INACTIVE / LAPSED badges
  Apply freshness to galaxy node tooltips
  Apply freshness to search results
```

**Constraints for all UI phases:**

- Vanilla JS only — no frameworks, no React, no Vue
- No new external dependencies — all rendering is DOM manipulation
- Each phase is a separate Claude Code session with its own review step
- Phase UI-4 requires explicit ETF Product Lead sign-off before deployment
- The galaxy SVG radial layout is preserved — only behaviour and data change, not structure
- `ma-modal.js` is used for any confirmation dialogs — no new modal systems

---

### Entity Detail Page

Triggered by: ETF holding row icon click, galaxy node click, search result selection, 13F filer click (future).

Replaces main content area. Context-aware breadcrumb returns to origin.

```
[← Back to QQQ Holdings]    or    [← Back to Galaxy]    or    [← Search results]

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  APPLE INC.                                          [● ACTIVE]  [ISSUED]   │
│                                                                              │
│  LEI: HWUPKR0MPOU8FGXBT394                          Ticker: AAPL            │
│  Incorporated in: California, United States                                 │
│  Legal form: INCORPORATED                                                    │
│  HQ: Cupertino, CA, US                                                      │
│  Registered address: 818 West 7th Street, Los Angeles, CA 90017, US        │
│                                                                              │
│  Validation: FULLY CORROBORATED  ·  LEI issued: Jun 2012                   │
│  Next renewal: Dec 2018  ·  [● Data current as of Jun 2026]                │
│                                                                              │
│  [View on search.gleif.org →]   [Search SEC EDGAR →]                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐  ┌─────────────────────────────────────┐
│  OWNERSHIP CHAIN                │  │  IDENTIFIERS                        │
│                                 │  │                                     │
│  Direct parent:                 │  │  LEI    HWUPKR0MPOU8FGXBT394       │
│  None reported                  │  │  BIC    —                           │
│  Reason: Natural persons        │  │  Ticker AAPL                        │
│                                 │  │  Reg ID C0806592                    │
│  Ultimate parent:               │  │  Auth   RA000598 (California)       │
│  None reported                  │  │                                     │
│  Reason: Natural persons        │  │  Matched via 12 ISINs               │
│                                 │  │  Source: ISIN direct                │
└─────────────────────────────────┘  └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  ETF EXPOSURE  ·  47 ETFs in your universe hold this entity                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  QQQ   Invesco QQQ Trust            ████████████████  12.4%   Jan 2025     │
│  VGT   Vanguard IT ETF              ████████████      8.7%    Jan 2025     │
│  XLK   SPDR Tech Select             ██████████        7.2%    Jan 2025     │
│  FTEC  Fidelity MSCI IT             ████████          6.1%    Jan 2025     │
│  IYW   iShares US Technology        ███████           5.8%    Jan 2025     │
│                                                                              │
│  [Show all 47 ETFs ↓]                                                       │
│                                                                              │
│  ⚠ N-PORT filings carry a 60-day reporting lag                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  13F INSTITUTIONAL FILINGS                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Search SEC EDGAR for Apple Inc. 13F filings →]                           │
│  Opens in new tab — live SEC lookup                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Freshness badge system

Applied everywhere GLEIF data appears — entity detail page, galaxy nodes, search results.

| Badge | Colour | Condition | Text shown |
|---|---|---|---|
| current | Green ● | `gleif_last_updated` within 90 days | "Data current as of {date}" |
| aging | Amber ● | 91–180 days | "LEI data may be outdated" |
| stale | Red ● | 181+ days | "LEI data significantly outdated — verify at search.gleif.org" |
| no data | Grey ● | `gleif_last_updated` is null | "Not yet enriched" |
| inactive | Red [INACTIVE] | `entity_status = 'INACTIVE'` | "[INACTIVE]" badge on entity header |
| lapsed | Amber [LAPSED] | `lei_registration_status = 'LAPSED'` | "[LAPSED]" badge alongside LEI |

### Cross-module traversal — ETF Holdings tab

Each holding row in `ma-etf.js` Holdings tab gains a small entity icon to the right of the security name. Behaviour:

```
If ISIN present and entity_isin_map has a match:
  → Icon shown as active (clickable)
  → Click calls GET /api/entities/isin/{isin}
  → On success: navigate to entity detail page
  → Breadcrumb set to "← Back to {ETF ticker} Holdings"
  → Browser back button also works

If ISIN present but no entity_isin_map match:
  → Icon shown as greyed out (not clickable)
  → Tooltip: "Entity not yet resolved"

If no ISIN:
  → Icon not shown
```

### Galaxy view integration

Existing galaxy SVG nodes gain richer tooltip on hover showing: legal_name, entity_status badge, hq_city, legal_jurisdiction. Node click navigates to entity detail page. Back button returns to galaxy at same zoom/pan state.

### Search upgrade

Search results for entity queries show: legal_name, entity_status badge, hq_city + hq_country, primary_ticker, isin_match_count ("matched via 12 ISINs"). User knows immediately what kind of entity they are selecting before clicking.

---

## 12. Success Criteria

### The real success criterion

Open the entity detail page for five different entities — a large US equity issuer, a European bond issuer, a fund entity, a government bond issuer, and a small-cap holding. Every page must render completely:

- Legal name, status badge, LEI, ticker all populated
- Full address block — legal and HQ — not blank
- Jurisdiction and legal form shown
- Validation source shown
- Ownership section shows either parent name or exception reason — never blank
- ETF exposure strip populated with at least one ETF
- Freshness badge green
- 13F SEC EDGAR link functional

If any of those five pages renders with blank sections, the seed or enrichment pipeline has a gap. Fix the gap before declaring success.

### Quantitative checks

| Check | Expected |
|---|---|
| entity_master total rows after seed | 5,000–8,000 |
| entity_master rows with entity_status populated | >= 4,500 |
| entity_master rows with legal_jurisdiction populated | >= 4,000 |
| entity_master rows with hq_city populated | >= 3,500 |
| entity_isin_map rows | >= 14,000 |
| entity_isin_map rows with entity_id populated | >= 14,000 |
| instrument_master rows | 15,000–25,000 |
| instrument_entity_map rows | 8,000–15,000 |
| entity_exposure_monthly rows | 5,000–15,000 |
| fund_exposure_coverage rows | ~1,150 |
| Average ETF exposure coverage % | 30–70% |
| Entity detail page — 5 entity smoke test | All sections populated |
| ETF Holdings tab — entity icon visible on ISIN-bearing rows | Confirmed |
| ETF Holdings tab — click through to entity page working | Confirmed |
| Any existing ETF table modified | Zero |
| writes_today at completion | Below 80,000 |

---

## 13. Index Inventory — Full v4

| Table | Index | Columns | Created by |
|---|---|---|---|
| entity_master | idx_entity_master_lei | (lei) | Seed Phase 3 |
| entity_master | idx_entity_master_status | (entity_status) | Seed Phase 3 |
| entity_master | idx_entity_master_jurisdiction | (legal_jurisdiction) | Seed Phase 3 |
| entity_master | idx_entity_master_direct_parent | (direct_parent_lei) | Seed Phase 3 |
| entity_master | idx_entity_master_ultimate_parent | (ultimate_parent_lei) | Seed Phase 3 |
| entity_master | idx_entity_master_match_source | (match_source) | Seed Phase 3 |
| entity_isin_map | idx_entity_isin_map_isin | (isin) | Seed Phase 3 |
| entity_isin_map | idx_entity_isin_map_lei | (lei) | Seed Phase 3 |
| entity_isin_map | idx_entity_isin_map_entity | (entity_id) | Seed Phase 3 |
| instrument_master | idx_instrument_master_isin | (isin) | Gate 2 post |
| instrument_master | idx_instrument_master_cusip_issuer | (cusip_issuer_6) | Gate 2 post |
| instrument_entity_map | idx_instrument_entity_map_key | (instrument_key) | Gate 2 post |
| gleif_local.db lei_records | idx_lei_records_lei | (lei) | Seed Phase 1 |
| gleif_local.db lei_records | idx_lei_records_normalized | (normalized_name) | Seed Phase 1 |
| gleif_local.db isin_lei_map | idx_isin_lei_map_isin | (isin) | Seed Phase 1 |
| gleif_local.db isin_lei_map | idx_isin_lei_map_lei | (lei) | Seed Phase 1 |

---

## 14. What This Spec Does Not Change

- ETF pipeline Workers — untouched
- `fund_holdings_monthly`, `etf_master`, `fund_snapshot_monthly` — read-only throughout
- `meridian-proxy` route count — entity routes stay in `meridian-entities-api`
- 13F cross-module filer name → entity page — schema ready, implementation deferred
- Market data cross-module — schema ready, deferred
- `gleif_local.db` — local Mac only, never uploaded to D1 or Cloudflare

---

## 15. Current State Carry-Forward

| Item | Status entering v4 |
|---|---|
| `entity_master` | 3,491 rows, thin schema. Seed script migrates schema and expands to 5,000–8,000 rows. |
| `entity_isin_map` | Does not exist yet. Created by seed Phase 3. |
| `instrument_master` | 12,660 rows from partial Task 6a. Safe to resume via INSERT OR IGNORE. |
| `instrument_entity_map` | 0 rows — clean |
| `entity_exposure_monthly` | 0 rows — clean |
| `fund_exposure_coverage` | 0 rows — clean |
| `gleif_local.db` | Does not exist yet. Created by seed Phase 1. |
| Golden Copy CSV | Downloaded. 4.84GB. Ready for seed. |
| ISIN-to-LEI CSV | Downloaded. 8.8M rows. Ready for seed. |
| `meridian-entities-enrich` | Redesigned — targeted API only for post-seed discoveries. |
| `meridian-entities-delta` | New Worker — 1st of month maintenance. |

---

## 16. Open Items for Cross-Lane Review

| # | Item | Owner |
|---|---|---|
| R1 | Seed script writes to entity_master — confirm no ETF pipeline contention | ETF Product Lead |
| R2 | entity_isin_map created as new D1 table — confirm acceptable within 10-database limit | Tech Ops |
| R3 | Gate 3 EXPLAIN QUERY PLAN — entity_isin_map join path must show index usage | Tech Ops |
| R4 | meridian-entities-delta three-point pre-deployment check | Tech Ops |
| R5 | GET /api/entities/isin/:isin endpoint — confirm route count stays within 15-route trigger | ETF Product Lead |
| R6 | ETF Holdings tab entity icon — confirm ma-etf.js change reviewed by ETF Product Lead before deploy | ETF Product Lead |

---

*Corporate Atlas v4 Specification · Meridian Atlas · June 14 2026 · Entities Product Lead*
*Status: Ready for cross-lane review — ETF Product Lead and Tech Ops sign-off required before seed script runs*
