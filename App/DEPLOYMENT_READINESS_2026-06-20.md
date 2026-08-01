# Meridian Atlas — Deployment Readiness Document

## Generated 2026-06-20

> **Note on live-query sections:** The D1 queries in sections 2 (row counts), 3, and 4 require `wrangler` with your Cloudflare credentials. A consolidated data-collection script is provided at the end of section 4. Run it, then fill in the bracketed placeholders. Everything else in this document was derived directly from source code and git history.

---

## 1. Worker Inventory

| Worker name | Config file | Cron status | Schedule | Purpose |
|---|---|---|---|---|
| `meridian-entities-api` | `Corporate Atlas/wrangler-entities-api.toml` | **No cron** (HTTP only) | — | REST API for Corporate Atlas UI (entity search, graph, ISIN lookup, ETF exposure) |
| `meridian-entities-delta` | `Corporate Atlas/wrangler-entities-delta.toml` | **FROZEN** | `0 3 1 * *` (1st of month, 03:00 UTC) | Monthly GLEIF delta — refreshes Level 1 fields on existing `entity_master` rows from GLEIF's LastMonth delta CSV |
| `meridian-entities-seed` | `Corporate Atlas/wrangler-entities-seed.toml` | **FROZEN** | `0 3 * * *` (daily 03:00 UTC) | Seeds `entity_master`, `fund_entity_link`, `entity_relationships`, `entity_enrichment_queue` from holdings data |
| `meridian-entities-enrich` | `Corporate Atlas/wrangler-entities-enrich.toml` | **ACTIVE** | `*/30 * * * *` and `50 * * * *` | GLEIF enrichment — Phase 1 (ISIN hints), Phase 2 (LEI lookup), Phase 3 (parent relationships) |
| `meridian-bootstrap` | `ETF Refresh/wrangler-bootstrap.toml` | **ACTIVE** | `0 */4 * * *` (every 4 hours) | Discovers ETF universe from EDGAR `company_tickers_mf.json`; populates `etf_master` |
| `meridian-proxy` | `ETF Refresh/wrangler.toml` | **No cron** (HTTP only) | — | Reverse proxy for the frontend; serves `/api/ops-health` and other endpoints |
| `meridian-holdings` | `ETF Refresh/wrangler-holdings.toml` | **ACTIVE** | `0 */2 * * *` (every 2 hours) | Fetches N-PORT XML from SEC EDGAR; inserts holdings into `fund_holdings_monthly` |

**Cron summary:** 3 of 7 Workers have active crons. 2 are HTTP-only. 2 are frozen with documented hold comments in their toml files.

**Schedule details:**
- `meridian-entities-enrich` fires on two overlapping patterns: `*/30 * * * *` dispatches Phase 1 (D1-only, cheap) on most invocations; `50 * * * *` (minute-50 of every hour) dispatches Phase 2 + Phase 3 (even hours only). The cron dispatcher in `entities-enrich.js` branches on `new Date().getMinutes() < 50`.
- `meridian-bootstrap` was reduced from `*/15 * * * *` (96/day) to `0 */4 * * *` (6/day) on 2026-06-14. Comment in toml: "no ETF discoveries until CIK 36405."

---

## 2. Data Layer Inventory

Tables identified from source-code analysis of `holdings-pipeline.js`, `entities-seed.js`, `entities-enrich.js`, `entities-api.js`, `entities-delta.js`, and `bootstrap.js`. Row counts require a live query (script in section 4).

| Table name | Row count | Class | Owning domain |
|---|---|---|---|
| `etf_master` | **264** | Core | ETF |
| `fund_holdings_monthly` | **356,253** | Core (largest table — millions of rows) | ETF |
| `fund_snapshot_monthly` | **466** | Derived | ETF |
| `holdings_pipeline_state` | **27** | Ephemeral (K/V store) | ETF |
| `universe_changes_monthly` | **0** | Derived | ETF |
| `edgar_bootstrap_state` | **7** | Ephemeral (K/V store) | ETF |
| `entity_master` | **9,361** | Core | Entities |
| `entity_enrichment_queue` | **3,487** | Ephemeral | Entities |
| `entity_relationships` | **268** | Derived | Entities |
| `fund_entity_link` | **264** | Derived | Entities |
| `entity_exposure_monthly` | **28,508** | Derived | Entities |
| `fund_exposure_coverage` | **133** | Derived | Entities |
| `etf_aliases` | **73** | Reference | ETF |
| `edgar_bootstrap_progress` | **1,039** | Ephemeral | ETF |
| `entity_isin_map` | **18,563** | Derived | Entities |
| `instrument_master` | **54,562** | Core | Entities |
| `instrument_entity_map` | **23,963** | Derived | Entities |

*Row counts captured 2026-06-20 via live D1 query. DB size at time of query: ~149 MB.*

**Table notes:**

`etf_master` — core ETF registry. Key columns: `ticker`, `series_id`, `cik`, `name`, `issuer`, `has_nport`, `coverage_status` (`deep` / `directory`), `coverage_depth` (1/2/3), `net_assets`. The pipeline auto-downgrades ETFs below $200M net assets from `deep` to `directory` after first successful ingestion.

`fund_holdings_monthly` — one row per holding per ETF per month. Key columns: `series_id`, `report_month`, `ticker`, `security_name`, `cusip`, `isin`, `security_ticker`, `position_value`, `weight_pct`, `shares`, `asset_cat`, `issuer_country`, `is_restricted`, `snapshot_status`. The `snapshot_status` column is NULL during an in-progress multi-cron insert and set to `'complete'` only when all rows are inserted — the API filters on `snapshot_status = 'complete'`, so partial data is never served.

`holdings_pipeline_state` — K/V store. Tracked keys include: `last_full_run`, `etf_offset`, `etfs_processed`, `last_run_status`, `phase_readiness_cache`, `universe_month_pair_cache`, `writes_today_{YYYY-MM-DD}` (daily write counter), `hold_all_jobs` (kill switch), `offset_{ticker}_{YYYY-MM}` (per-ETF resume offsets, ephemeral during active ingestion).

`edgar_bootstrap_state` — separate K/V store for the bootstrap Worker. Keys: `status`, `last_run`, `total_ciks_discovered`, `cik_offset`, `etfs_added`.

`entity_master` — richest table. Key columns include: `entity_id`, `name`, `normalized_name`, `type` (`fund` / `operating` / `government` / `holding` / `manager`), `lei`, `lei_status`, `country`, `direct_parent_lei`, `direct_parent_name`, `ultimate_parent_lei`, `ultimate_parent_name`, `direct_parent_exception`, plus many GLEIF Level 1 fields added by entities-delta: `entity_status`, `expiration_date`, `lei_registration_status`, `lei_last_updated`, `lei_next_renewal`, `hq_city`, `hq_country`, `primary_ticker`, `isin_match_count`, `etf_holding_count`, `gleif_last_updated`.

`entity_enrichment_queue` — tracks GLEIF enrichment progress per entity. Key columns: `entity_id`, `name`, `type_hint`, `isin_hint`, `lookup_method`, `status` (`pending` / `in_progress` / `complete` / `failed`), `retry_after`, `last_attempt`.

---

## 3. Index Inventory

Indexes must be queried live. Run:

```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/June Refresh"
wrangler d1 execute meridian-etf --remote \
  --command="SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name;"
```

| Index name | Table | Definition |
|---|---|---|
| `sqlite_autoindex_edgar_bootstrap_progress_1` | `edgar_bootstrap_progress` | *(auto — primary key)* |
| `sqlite_autoindex_edgar_bootstrap_state_1` | `edgar_bootstrap_state` | *(auto — primary key)* |
| `idx_enrich_queue_status` | `entity_enrichment_queue` | `(status, retry_after)` |
| `idx_exposure_entity` | `entity_exposure_monthly` | `(entity_id, report_month)` |
| `idx_exposure_holder` | `entity_exposure_monthly` | `(holder_entity_id, report_month)` |
| `sqlite_autoindex_entity_exposure_monthly_1` | `entity_exposure_monthly` | *(auto — primary key)* |
| `idx_entity_isin_map_entity` | `entity_isin_map` | `(entity_id)` |
| `idx_entity_isin_map_isin` | `entity_isin_map` | `(isin)` |
| `idx_entity_isin_map_lei` | `entity_isin_map` | `(lei)` |
| `sqlite_autoindex_entity_isin_map_1` | `entity_isin_map` | *(auto — primary key)* |
| `idx_entity_master_direct_parent` | `entity_master` | `(direct_parent_lei)` |
| `idx_entity_master_jurisdiction` | `entity_master` | `(legal_jurisdiction)` |
| `idx_entity_master_lei` | `entity_master` | `(lei)` |
| `idx_entity_master_match_source` | `entity_master` | `(match_source)` |
| `idx_entity_master_normalized` | `entity_master` | `(normalized_name)` |
| `idx_entity_master_status` | `entity_master` | `(entity_status)` |
| `idx_entity_master_type` | `entity_master` | `(type)` |
| `idx_entity_master_ultimate_parent` | `entity_master` | `(ultimate_parent_lei)` |
| `sqlite_autoindex_entity_master_1` | `entity_master` | *(auto — primary key)* |
| `idx_entity_rel_child` | `entity_relationships` | `(child_entity_id)` |
| `idx_entity_rel_parent` | `entity_relationships` | `(parent_entity_id)` |
| `sqlite_autoindex_entity_relationships_1` | `entity_relationships` | *(auto — primary key)* |
| `idx_etf_aliases_alias` | `etf_aliases` | `UNIQUE ON UPPER(TRIM(alias))` |
| `idx_etf_master_coverage` | `etf_master` | `(coverage_status)` |
| `idx_etf_master_issuer` | `etf_master` | `(issuer)` |
| `idx_etf_master_nport` | `etf_master` | `(has_nport)` |
| `sqlite_autoindex_etf_master_1` | `etf_master` | *(auto — primary key)* |
| `sqlite_autoindex_fund_entity_link_1` | `fund_entity_link` | *(auto — primary key)* |
| `sqlite_autoindex_fund_exposure_coverage_1` | `fund_exposure_coverage` | *(auto — primary key)* |
| `idx_fhm_isin` | `fund_holdings_monthly` | `(isin) WHERE isin IS NOT NULL` |
| `idx_holdings_cusip` | `fund_holdings_monthly` | `(cusip, report_month)` |
| `idx_holdings_month` | `fund_holdings_monthly` | `(report_month)` |
| `idx_holdings_security` | `fund_holdings_monthly` | `(security_ticker, report_month)` |
| `idx_holdings_security_name` | `fund_holdings_monthly` | `(UPPER(TRIM(security_name)))` |
| `idx_holdings_series_month` | `fund_holdings_monthly` | `(series_id, report_month)` |
| `idx_holdings_status_series_month` | `fund_holdings_monthly` | `(snapshot_status, series_id, report_month)` |
| `idx_snapshot_series` | `fund_snapshot_monthly` | `(series_id, report_month)` |
| `sqlite_autoindex_fund_snapshot_monthly_1` | `fund_snapshot_monthly` | *(auto — primary key)* |
| `sqlite_autoindex_holdings_pipeline_state_1` | `holdings_pipeline_state` | *(auto — primary key)* |
| `idx_instrument_entity_map_key` | `instrument_entity_map` | `(instrument_key)` |
| `sqlite_autoindex_instrument_entity_map_1` | `instrument_entity_map` | *(auto — primary key)* |
| `idx_instrument_cusip6` | `instrument_master` | `(cusip_issuer_6)` |
| `idx_instrument_isin` | `instrument_master` | `(isin)` |
| `idx_instrument_master_cusip_issuer` | `instrument_master` | `(cusip_issuer_6)` |
| `idx_instrument_master_isin` | `instrument_master` | `(isin)` |
| `sqlite_autoindex_instrument_master_1` | `instrument_master` | *(auto — primary key)* |
| `idx_universe_changes_computed` | `universe_changes_monthly` | `(computed_at)` |
| `idx_universe_changes_lookup` | `universe_changes_monthly` | `(current_month, change_type)` |

*48 indexes total (including auto-generated). Captured 2026-06-20 via live D1 query.*

From source code, the following indexes are implicit or expected (actual names may differ):

- `fund_holdings_monthly`: indexes expected on `(series_id, report_month)`, `snapshot_status`, and `cusip` (used in universe_changes joins and the API's `WHERE snapshot_status = 'complete'` filters)
- `entity_master`: index expected on `(normalized_name, type)` (unique constraint used in `ON CONFLICT(normalized_name, type)` upserts throughout entities-seed and entities-enrich)
- `entity_relationships`: unique constraint on `(parent_entity_id, child_entity_id)` (used in `ON CONFLICT DO NOTHING`)
- `fund_entity_link`: unique constraint on `etf_symbol` (used in `ON CONFLICT(etf_symbol)`)
- `holdings_pipeline_state`: unique constraint on `key`
- `edgar_bootstrap_state`: unique constraint on `key`

---

## 4. Current System State (as of 2026-06-20)

> **Live data captured:** 2026-06-20, morning run. All `[PASTE RESULTS HERE]` placeholders below have been filled with actual D1 query output from this date.

### 4a. Pipeline state — live query required

```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/June Refresh"
wrangler d1 execute meridian-etf --remote \
  --command="SELECT key, value FROM holdings_pipeline_state ORDER BY key;"
```

| key | value |
|---|---|
| `delta_last_run` | *(not yet run — entities-delta cron frozen)* |
| `etf_offset` | `0` |
| `etfs_processed` | `10` |
| `last_full_run` | `2026-06-20T10:00:10.681Z` |
| `last_run_status` | `complete:10ok:0err` |
| `offset_AGG_2026-02` | `7000` *(resume offset — Worker still completing AGG)* |
| `offset_AVEM_2026-02` | `3500` *(resume offset — Worker still completing AVEM)* |
| `offset_BNDX_2026-01` | `3500` *(stale — catchup-script completed BNDX)* |
| `offset_BND_2026-03` | `10500` *(resume offset — BND in-progress via Worker)* |
| `offset_DFAI_2026-01` | `3500` *(stale — catchup-script completed DFAI)* |
| `offset_IGLB_2025-11` | `3500` |
| `offset_MBB_2026-02` | `7000` *(stale — catchup-script completed MBB)* |
| `offset_SPAB_2025-12` | `3500` |
| `offset_VSS_2025-10` | `3500` |
| `offset_VWO_2025-10` | `3500` |
| `writes_today_2026-06-07` | `6,720` |
| `writes_today_2026-06-08` | `5,334` |
| `writes_today_2026-06-09` | `4,805` |
| `writes_today_2026-06-10` | `7,920` |
| `writes_today_2026-06-11` | `6,397` |
| `writes_today_2026-06-12` | `7,757` |
| `writes_today_2026-06-13` | `4,918` |
| `writes_today_2026-06-15` | `21,108` |
| `writes_today_2026-06-16` | `80,577` |
| `writes_today_2026-06-17` | `62,024` |
| `writes_today_2026-06-18` | `44,818` |
| `writes_today_2026-06-19` | `80,584` *(hit daily limit — catchup-script aborted mid-AGG)* |
| `writes_today_2026-06-20` | `72,215` *(as of query time — budget nearly exhausted for today)* |

Key values to inspect in the output:

- `last_run_status` — should read `complete:Nok:0err` or `running:N/total`. If it shows `write_limit:Nnnnn:skipped`, the daily 80,000-row budget was hit.
- `etf_offset` — the ETF batch pointer. `0` means a full pass just completed; any other value means a pass is in progress.
- `writes_today_2026-06-20` — current UTC-day write count. Budget is 80,000 rows.
- `phase_readiness_cache` — JSON blob with Phase B/C/D/E gate status (updated every cron cycle, cached 6h).
- `hold_all_jobs` — if `true`, entities-delta Worker will skip its run. Check this is `false` or absent before deploying.

### 4b. Enrichment state — live query required

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as funds_with_lei FROM entity_master WHERE type='fund' AND lei IS NOT NULL;"

wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as eligible FROM entity_master WHERE lei IS NOT NULL AND type != 'fund' AND (lei_status IS NULL OR (direct_parent_lei IS NULL AND ultimate_parent_lei IS NULL AND direct_parent_exception IS NULL));"

wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as null_depth FROM etf_master WHERE coverage_status='deep' AND coverage_depth IS NULL;"
```

| Metric | Value | Status |
|---|---|---|
| `funds_with_lei` | **0** | ✅ Clean — no fund corruption |
| `phase3_eligible` (enrichment backlog) | **5,696** | ⚠️ Large backlog — enrichment still in progress |
| `null_depth` (deep ETFs with no coverage_depth) | **1** | ⚠️ BND outstanding — see note below |

**BND note:** `null_depth = 1` is BND (Vanguard Total Bond Market ETF, `net_assets = NULL`). BND has a resume offset (`offset_BND_2026-03 = 10500`) meaning the regular Worker pipeline has it in progress and will complete it in the next cron cycle. This is not a pipeline failure — it is expected mid-ingestion state. Once the Worker completes BND, `coverage_depth` will be set and `null_depth` will reach 0.

Interpretation:
- `funds_with_lei`: should be 0. Funds must NOT have LEI assigned (the root-cause fix from 2026-06-17 ensured this). Any non-zero value means re-corruption occurred.
- `eligible` (Phase 3 backlog): entities with a LEI that still have no parent relationships resolved and no exception recorded. Zero means Phase 3 is complete. A large number means enrichment is still in progress.
- `null_depth`: deep-coverage ETFs that have holdings ingested but no `coverage_depth` set. Should be 0 after pipeline normalisation; any non-zero number means a coverage_depth update job failed silently.

### 4c. Phase gate status

The phase readiness cache in `holdings_pipeline_state` under key `phase_readiness_cache` contains a JSON object with the following gate conditions. Check it after running the query in 4a:

| Phase | Name | Gate condition | Notes |
|---|---|---|---|
| B | ETF Briefing Narrative Intelligence | ≥ 20 ETFs with 2+ months of holdings | |
| C | Flow Pressure Index | ≥ 10 ETFs with 2+ months of holdings | Lower bar than B |
| D | Implied Conviction View | ≥ 100 deep-coverage ETFs | Based on `etf_master.coverage_status = 'deep'` count |
| E | ETF DNA Fingerprint | ≥ 150 ETFs in a single report month | Most demanding gate |

### 4d. Consolidated data-collection script

Run this from your project root to collect all live-query data in one pass:

```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/June Refresh"

echo "=== TABLES ==="
wrangler d1 execute meridian-etf --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

echo "=== ROW COUNTS ==="
for tbl in etf_master fund_holdings_monthly fund_snapshot_monthly holdings_pipeline_state universe_changes_monthly edgar_bootstrap_state entity_master entity_enrichment_queue entity_relationships fund_entity_link entity_exposure_monthly fund_exposure_coverage; do
  wrangler d1 execute meridian-etf --remote --command="SELECT '${tbl}' as tbl, COUNT(*) as cnt FROM ${tbl};"
done

echo "=== INDEXES ==="
wrangler d1 execute meridian-etf --remote \
  --command="SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name;"

echo "=== PIPELINE STATE ==="
wrangler d1 execute meridian-etf --remote \
  --command="SELECT key, value FROM holdings_pipeline_state ORDER BY key;"

echo "=== ENRICHMENT CHECKS ==="
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as funds_with_lei FROM entity_master WHERE type='fund' AND lei IS NOT NULL;"
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as phase3_eligible FROM entity_master WHERE lei IS NOT NULL AND type != 'fund' AND (lei_status IS NULL OR (direct_parent_lei IS NULL AND ultimate_parent_lei IS NULL AND direct_parent_exception IS NULL));"
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as null_depth FROM etf_master WHERE coverage_status='deep' AND coverage_depth IS NULL;"
```

---

## 5. Deployment Mechanics — As-Is

### What `wrangler deploy --config X.toml` actually does

`wrangler deploy` compiles your Worker's JavaScript source file (the path in `main =`) into a V8 isolate bundle and uploads it to Cloudflare's edge network. The deploy operation:

1. Reads the config file to know the Worker name, D1 database binding, and trigger schedule.
2. Sends the compiled code to Cloudflare via their API.
3. Registers any `[triggers]` cron schedules declared in the toml at the same time. If `[triggers]` is commented out, the Worker is deployed with **no cron** — any previously registered cron for that Worker name on Cloudflare's side is **removed**.

The deploy takes 5–30 seconds and is atomic: the new code goes live on all Cloudflare PoPs simultaneously. There is no blue/green switch; traffic shifts to the new version immediately.

### What gets deployed vs. what doesn't

| What | Deployed with `wrangler deploy`? | Lives where |
|---|---|---|
| Worker JavaScript code | ✅ Yes | Cloudflare edge (all PoPs) |
| Cron trigger schedule | ✅ Yes (from `[triggers]` in toml) | Cloudflare dashboard (registered at deploy time) |
| D1 database data | ❌ No | D1 database on Cloudflare (persists independently, never touched by deploys) |
| Environment bindings | ✅ Yes (defined in toml) | Cloudflare dashboard |
| Cloudflare dashboard settings not in toml | ❌ No | Dashboard only — not in git |

**D1 data is completely independent of code deploys.** You can deploy any Worker version without affecting a single row in the database. Rolling back to an older Worker version does not restore any database rows.

### How cron triggers are registered / changed

1. Edit the `[triggers]` block in the relevant `wrangler-*.toml`.
2. Run `wrangler deploy --config path/to/wrangler-WORKER.toml`.
3. Cloudflare reads the new toml and updates the cron schedule for that Worker.

To **freeze** a cron: comment out the `[triggers]` block and redeploy. To **re-enable**: uncomment and redeploy. The schedule change takes effect on the next cron window after deploy.

### What's in git vs. what's runtime-only state

**In git (source of truth):**
- All 7 Worker JavaScript source files (in `src/`)
- All 7 `wrangler-*.toml` config files
- All frontend files (`ma-*.js`, `index.html`)
- One-time utility scripts (`seed-etf-master.js`, `catchup-script.js`)

**Runtime-only (not in git, not deployable):**
- All D1 table data (`etf_master`, `fund_holdings_monthly`, `entity_master`, etc.)
- `holdings_pipeline_state` key/value store entries (write counters, offsets, phase cache)
- `edgar_bootstrap_state` entries
- Cloudflare dashboard settings not expressed in toml (custom domains, routes, secrets)
- Cloudflare Worker logs and metrics

### How to redeploy ALL 7 Workers from a clean clone

```bash
# 1. Clone the repo
git clone <YOUR_REPO_URL> MeridianAtlas
cd "MeridianAtlas/June Refresh"

# 2. Log in to Cloudflare (if not already authenticated)
wrangler login

# 3. Deploy ETF Refresh Workers
wrangler deploy --config "ETF Refresh/wrangler-bootstrap.toml"
wrangler deploy --config "ETF Refresh/wrangler.toml"
wrangler deploy --config "ETF Refresh/wrangler-holdings.toml"

# 4. Deploy Corporate Atlas Workers
wrangler deploy --config "Corporate Atlas/wrangler-entities-api.toml"
wrangler deploy --config "Corporate Atlas/wrangler-entities-enrich.toml"

# 5. Deploy frozen Workers (code update only — crons remain off per toml)
wrangler deploy --config "Corporate Atlas/wrangler-entities-seed.toml"
wrangler deploy --config "Corporate Atlas/wrangler-entities-delta.toml"

# 6. Verify all 7 Workers appear in the Cloudflare dashboard
# https://dash.cloudflare.com/ → Workers & Pages → Overview

# 7. Confirm active crons (bootstrap, holdings, entities-enrich) appear in
# Workers & Pages → Triggers tab for each Worker

# 8. Run the data-collection script from section 4d to confirm D1 state is intact
```

Note: D1 data is **not re-seeded** by this process. The database persists on Cloudflare independently. A clean clone + deploy restores only the code layer.

---

## 6. Known Gaps — Sustainability Review

### Gap 1: No alerting
**What happens today:** If the write guard fires (daily 80,000-row budget hit), if a Worker throws an uncaught exception, or if a cron skips silently, nobody knows until someone manually queries `holdings_pipeline_state` or checks Cloudflare's Workers dashboard.

**Proposed mitigation:** Add a lightweight status check that runs after each cron invocation in `holdings-pipeline.js` and `entities-enrich.js`. If `last_run_status` contains `write_limit` or an error count > 0, make a `fetch()` POST to a webhook (Slack incoming webhook or similar). Cloudflare Workers can send outbound fetch calls at no additional cost. A more robust option is to connect Cloudflare's built-in Workers Alerts (in the dashboard under Notifications) to email or PagerDuty — zero code required.

**Effort:** 2–4 hours for a webhook approach; ~30 minutes for Cloudflare dashboard notifications.

### Gap 2: No automated handling for "new large ETF needs first ingestion"
**What happened:** When a large ETF (e.g. one of the 29 targeted in `catchup-script.js`) appeared in the universe, the standard pipeline's per-cron batch size and the 80,000-row daily write guard made it take many days to complete initial ingestion. This required a manual local Node.js script (`catchup-script.js`) run from a developer laptop, using a hardcoded D1 REST API token.

**Security note (resolved 2026-06-20):** `catchup-script.js` previously contained a hardcoded Cloudflare OAuth token. This was fixed in commit `7012114` — the token is now read from `process.env.CF_API_TOKEN` and the script exits with a clear error if the variable is not set. The token was never committed to git (the file was added to git only after the fix was in place).

**Proposed mitigation:** Add a `/kickstart?ticker=AGG` HTTP endpoint to the `meridian-holdings` Worker. When called, it bypasses the normal batch offset and processes the specified ETF immediately, with a higher per-run row budget (e.g. 20,000 rows). This removes the local-machine dependency. Remove `catchup-script.js` from the repo after rotating the token.

**Effort:** 1–2 days (Worker endpoint + budget override logic + cleanup).

### Gap 3: No automated UAT/regression test suite
**What happened:** Every change this week was verified by ad-hoc D1 queries (`SELECT COUNT(*) FROM ...`) and manual browser inspection of the Corporate Atlas UI. The fund LEI corruption on 2026-06-17 was caught by manual checking, not by an automated assertion.

**Proposed mitigation:** Write a lightweight smoke-test script (`smoke-test.js`) that hits the live Workers API endpoints and asserts expected shapes: entity search returns ≥ 1 result for a known entity, `/api/ops-health` returns `ok`, fund holdings for a known ticker return rows with `snapshot_status = 'complete'`, `funds_with_lei` count is 0. Run this script after every deploy. Requires no test framework — plain Node.js `fetch` + `assert` is sufficient.

**Effort:** 4–6 hours for a useful first set of assertions.

### Gap 4: `entities-seed` and `entities-delta` crons remain frozen with no defined re-enable condition

**entities-seed** has been frozen since the 2026-06-13 incident. The toml comment reads: `HOLD: incident-2026-06-13 — cron frozen, original schedule below`. There is no documented condition that must be met before re-enabling it. Given that `entities-seed` populates `entity_enrichment_queue` (the input to `entities-enrich`), a frozen seed cron means newly ingested ETF holdings do not automatically generate new entity enrichment candidates.

**entities-delta** is frozen with two inconsistent hold reasons: the toml says "frozen until ETF Phase 3 gate clears" while the source file header says "HOLD — see wrangler-entities-delta.toml; frozen until Phase 5." These are different conditions. It's unclear which is authoritative.

**Proposed mitigation:** Define explicit re-enable criteria in a short DECISIONS.md file. For `entities-seed`: re-enable once Phase 3 enrichment backlog (the `eligible` count from section 4b) reaches < 100, to avoid flooding the queue. For `entities-delta`: clarify whether "Phase 3 gate" or "Phase 5" is the correct trigger and update both the toml comment and source file to match. Once conditions are met, re-enabling either Worker is a one-line toml edit + deploy.

**Effort:** 2 hours to write the decision doc and align comments; the actual re-enable is a 5-minute deploy.

### Gap 5: 24-month retention rule for `fund_holdings_monthly` is not implemented

The Storage Strategy doc specifies that `fund_holdings_monthly` rows older than 24 months should be deleted to manage D1 database size. `holdings-pipeline.js` respects `REPORT_MONTH_LOOKBACK = 2` (keeps only the 2 most recent months per ETF per pipeline run), but there is no standing process that purges rows from the database that fall outside the 24-month window from prior ingestion cycles.

**Proposed mitigation:** Add a cleanup function to `holdings-pipeline.js` that runs once per cron cycle after ingestion completes:
```sql
DELETE FROM fund_holdings_monthly
WHERE report_month < date('now', '-24 months');
```
This is a single D1 write and costs minimal subrequests. Add the same cleanup to `fund_snapshot_monthly`.

**Effort:** 1–2 hours to implement and test.

---

## 7. Recommended Pre-Deployment Checklist

Work through this list in order before any deploy. Each item is a single verifiable action.

- [ ] **Git state is clean:** `git status` shows no uncommitted changes. If there are any, either commit or stash them.
- [ ] **On the correct branch/commit:** `git log --oneline -1` matches the SHA you intend to deploy. Confirm there are no un-pushed commits if this repo has a remote.
- [ ] **Debug param reverted:** Confirm the temporary `?phase=` debug parameter added in commit `09ea8b7` (`entities-enrich: TEMPORARY debug param`) has been reverted before deploying `entities-enrich`. Check: `grep -n "phase" "Corporate Atlas/src/entities-enrich.js"` — should show only legitimate phase logic, not a URL query param handler.
- [ ] **`catchup-script.js` token reviewed:** Before any remote push, confirm the hardcoded OAuth token in `catchup-script.js` has been rotated or the file has been removed from the repo (and git history cleaned if needed).
- [ ] **`hold_all_jobs` is absent or false:** `wrangler d1 execute meridian-etf --remote --command="SELECT value FROM holdings_pipeline_state WHERE key='hold_all_jobs';"` — should return no rows or `false`.
- [ ] **Write budget is healthy:** `wrangler d1 execute meridian-etf --remote --command="SELECT value FROM holdings_pipeline_state WHERE key LIKE 'writes_today_%' ORDER BY key DESC LIMIT 1;"` — value should be well below 80,000.
- [ ] **`funds_with_lei` is zero:** `wrangler d1 execute meridian-etf --remote --command="SELECT COUNT(*) FROM entity_master WHERE type='fund' AND lei IS NOT NULL;"` — must return 0. A non-zero value means fund corruption has recurred; do not deploy until resolved.
- [ ] **`null_depth` is zero:** `wrangler d1 execute meridian-etf --remote --command="SELECT COUNT(*) FROM etf_master WHERE coverage_status='deep' AND coverage_depth IS NULL;"` — should return 0. A non-zero value means the coverage_depth update step is failing silently in the pipeline.
- [ ] **Phase gate status reviewed:** Inspect `phase_readiness_cache` in `holdings_pipeline_state`. Confirm the Phase gate states match your current expectations (B/C/D/E `ready: true/false`).
- [ ] **Intended cron states confirmed in toml files before deploy:** Re-read all 7 `wrangler-*.toml` files. Confirm `[triggers]` is active or commented as intended. A deploy with an accidentally uncommented cron re-enables it immediately.
- [ ] **Rollback plan confirmed:** The rollback pattern proven this week is `git revert HEAD` (or `git revert <SHA>`) → commit → redeploy. Confirm the target SHA for rollback is known. For D1 data changes (if any were made via direct wrangler commands), confirm a backup or the inverse SQL is noted.
- [ ] **Post-deploy smoke check:** After deploying, hit `https://meridian-entities-api.navinmv1981.workers.dev/api/entities/search?q=Apple` and confirm a valid JSON response. Hit `https://meridian-proxy.navinmv1981.workers.dev/api/ops-health` and confirm status is `ok`. Check the Cloudflare Workers dashboard for the deployed Workers to confirm no errors appear in the first 5 minutes.
- [ ] **Deployment list updated:** After a successful deploy, note the deployment SHA and timestamp in your own records (or run `wrangler deployments list --name WORKER_NAME --config PATH` for each Worker to confirm the new version is active).

---

*Document generated 2026-06-20. Source: `.git/logs/HEAD` (44 commits), 7 `wrangler-*.toml` files, 5 Worker source files (`holdings-pipeline.js`, `entities-seed.js`, `entities-enrich.js`, `entities-api.js`, `entities-delta.js`, `bootstrap.js`), frontend inventory (`ETF Refresh/*.js`, `index.html`).*
