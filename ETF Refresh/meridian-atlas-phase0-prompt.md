# Meridian Atlas — Phase 0 Migration Prompt
## For use with Antigravity

---

## BEFORE YOU START — MANUAL STEPS (you do these, not Antigravity)

Antigravity cannot create Cloudflare resources. Do these two things first, then paste
the database ID into this prompt before sending it.

**Step 1 — Create the D1 database**
1. Go to Cloudflare dashboard → Workers & Pages → D1
2. Click "Create database"
3. Name it exactly: `meridian-etf`
4. Click Create
5. Copy the `Database ID` (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Step 2 — Paste your database ID below**
Replace `PASTE_YOUR_DATABASE_ID_HERE` in the wrangler.toml section of this prompt
with the UUID you just copied.

Once those two steps are done, give this full prompt to Antigravity.

---

## CONTEXT

I am migrating Meridian Atlas ETF Holdings off a hardcoded JSON array in a Cloudflare Worker
into a Cloudflare D1 database. This is a backend-only migration. The frontend must not change
behaviour at all — same API response shape, same data, same UI.

### Current architecture

- Frontend: `index.html` + `ma-etf.js` served via Cloudflare Pages
- Worker: `meridian-proxy` at `https://meridian-proxy.navinmv1981.workers.dev`
- `/api/etf-list` — currently returns a hardcoded JSON array of ETF objects
- `/api/etf-holdings?symbol=X` — fetches live N-PORT holdings from SEC EDGAR (do not touch)
- `/api/etf-prospectus?symbol=X` — fetches prospectus links (do not touch)

### What the frontend expects from `/api/etf-list`

An array of objects. The only fields consumed by `ma-etf.js` are:

```json
[
  {
    "ticker": "SPY",
    "name": "SPDR S&P 500 ETF Trust",
    "issuer": "State Street / SPDR Series Trust",
    "assetClass": "US Equity",
    "index": "S&P 500 Index"
  }
]
```

`_initEtfsList()` in `ma-etf.js` merges this response with a local `ETF_META` object
to fill in any missing `assetClass` or `index` values. That frontend logic stays untouched.

### Data sources to merge into D1

**Source A — Worker hardcoded JSON (~430 ETFs)**
Fields: `ticker`, `name`, `issuer`, `cik`, `series_id`, and optionally `notes`.
Some entries have `series_id: null` — these are UITs, grantor trusts, or commodity LPs
that have no N-PORT filing.

Example entries:
```json
{ "ticker": "AOR",  "name": "iShares Core Growth Allocation ETF", "issuer": "BlackRock / iShares Trust", "cik": "0001100663", "series_id": "S000023587" }
{ "ticker": "SPY",  "name": "SPDR S&P 500 ETF Trust", "issuer": "State Street / SPDR S&P 500 ETF Trust", "cik": "0000884394", "series_id": null, "notes": "Unit Investment Trust (UIT). No N-PORT." }
{ "ticker": "IAU",  "name": "iShares Gold Trust", "issuer": "BlackRock / iShares Delaware Trust Sponsor LLC", "cik": "0001278028", "series_id": null, "notes": "Grantor trust under the 1933 Act. No N-PORT." }
```

**Source B — ETF_META object in ma-etf.js (~269 ETFs)**
Fields: `issuer` (short display name), `assetClass`, `index`.

Example entries:
```js
AOR:  { issuer:"iShares", assetClass:"Multi-Asset",  index:null },
SPY:  { issuer:"SPDR",    assetClass:"US Equity",     index:"S&P 500 Index" },
AGG:  { issuer:"iShares", assetClass:"Fixed Income – IG", index:"Bloomberg US Aggregate Bond Index" },
```

---

## TASK

The D1 database `meridian-etf` already exists (created manually above).
Antigravity must build everything else.

---

### P1 — Schema + seed

**P1a. Write `schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS etf_master (
  ticker           TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  issuer           TEXT,
  asset_class      TEXT,
  index_name       TEXT,
  cik              TEXT,
  series_id        TEXT,
  has_nport        INTEGER NOT NULL DEFAULT 1,
  net_assets       REAL,
  coverage_status  TEXT NOT NULL DEFAULT 'directory',
  last_filing_date TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_etf_master_issuer   ON etf_master(issuer);
CREATE INDEX IF NOT EXISTS idx_etf_master_coverage ON etf_master(coverage_status);
CREATE INDEX IF NOT EXISTS idx_etf_master_nport    ON etf_master(has_nport);
```

Run with:
```bash
wrangler d1 execute meridian-etf --file=schema.sql
```

**P1b. Write `seed-etf-master.js`**

A Node.js script that merges Source A and Source B and outputs `seed-data.sql`.

Field mapping rules:
- `ticker`          → Source A `ticker` (PRIMARY KEY)
- `name`            → Source A `name`; if ticker only in Source B, use ticker as name
- `issuer`          → Source A `issuer` (full form); null if only in Source B
- `asset_class`     → Source B `ETF_META[ticker].assetClass`; null if not in Source B
- `index_name`      → Source B `ETF_META[ticker].index`; null if not in Source B
- `cik`             → Source A `cik`; null if only in Source B
- `series_id`       → Source A `series_id`; null if only in Source B
- `has_nport`       → 0 if `series_id` is null OR `notes` field is present; else 1
- `coverage_status` → `'deep'` if `has_nport = 1`; else `'directory'`
- `net_assets`      → NULL (populated by Phase 1 EDGAR bootstrap)
- `notes`           → Source A `notes` if present; else NULL

Deduplication: ticker is PRIMARY KEY. Source A wins for `name`, `issuer`, `cik`,
`series_id`, `notes`. Source B wins for `asset_class`, `index_name`.

Tickers only in Source B (not in Source A): insert with `cik = NULL`,
`series_id = NULL`, `has_nport = 0`, `coverage_status = 'directory'`.

Output `seed-data.sql` using `INSERT OR REPLACE INTO etf_master` statements.
Each value must be properly SQL-escaped (single quotes escaped as '').
At the end of the script log:
```
Total rows:            XXX
With asset_class:      XXX
With series_id:        XXX
has_nport = 0 (no N-PORT): XXX
```

Run with:
```bash
node seed-etf-master.js
wrangler d1 execute meridian-etf --file=seed-data.sql
```

---

### P2 — Update Worker to read from D1

The D1 database is already created and bound. Only the `/api/etf-list` route changes.
All other Worker routes are untouched.

**P2a. Update `wrangler.toml`**

Add this binding (database already exists — just add the config):
```toml
[[d1_databases]]
binding = "DB"
database_name = "meridian-etf"
database_id = "43e80149-5333-4917-b678-6a8218ca4f93"
```

**P2b. Replace the `/api/etf-list` handler**

The current handler returns a hardcoded JSON array. Replace it with:

```js
if (url.pathname === '/api/etf-list') {
  try {
    const { results } = await env.DB.prepare(
      `SELECT ticker, name, issuer, asset_class, index_name
       FROM etf_master
       ORDER BY ticker ASC`
    ).all();

    const etfs = results.map(row => ({
      ticker:     row.ticker,
      name:       row.name,
      issuer:     row.issuer,
      assetClass: row.asset_class,   // DB snake_case → response camelCase
      index:      row.index_name     // DB index_name → response key 'index'
    }));

    return new Response(JSON.stringify(etfs), {
      headers: {
        'Content-Type': 'application/json',
        // match whatever CORS headers already exist on other routes
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load ETF list' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

Do not change any other route handler. Do not change the Worker entry point structure.

---

## CONSTRAINTS

- Do NOT modify `index.html` or `ma-etf.js`
- Do NOT modify `/api/etf-holdings` or `/api/etf-prospectus` handlers
- Do NOT add auth, rate limiting, or caching in Phase 0
- `ETF_META` fallback in `ma-etf.js` stays — removed in a later phase
- No EDGAR API calls in Phase 0 — `net_assets` stays NULL for now

---

## DELIVERABLES

1. `schema.sql`
2. `seed-etf-master.js`
3. `seed-data.sql` (generated by running the script)
4. Updated Worker JS — `/api/etf-list` handler only
5. Updated `wrangler.toml` with D1 binding

---

## VERIFICATION — confirm all before closing Phase 0

```
curl https://meridian-proxy.navinmv1981.workers.dev/api/etf-list
```
- [ ] Returns a JSON array (not an object, not an error)
- [ ] Each item has: ticker, name, issuer, assetClass, index
- [ ] assetClass and index are present even if null — not missing keys
- [ ] Row count matches seed script output total
- [ ] spot-check: AOR has assetClass "Multi-Asset"
- [ ] spot-check: SPY has index "S&P 500 Index"

```
curl https://meridian-proxy.navinmv1981.workers.dev/api/etf-holdings?symbol=AOR
```
- [ ] Still returns holdings data (unchanged route)

- [ ] Meridian Atlas frontend: ETF Holdings modal opens, list loads, provider filter works,
      clicking a fund loads holdings — identical to before migration

Phase 1 starts only after all checks pass.
