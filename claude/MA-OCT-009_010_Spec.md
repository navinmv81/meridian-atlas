# MA-OCT-009 + MA-OCT-010 — Fixed Income API and Fixed Income page: Spec

```text
ISSUED BY:    Main Lane (Program Orchestrator), Sun 25 Oct 2026 — packet MA-OCT-009.SPEC
              Control v1 1bd1c83800a0674ca50fe26c12d2dfe2c62b7ac83259316569918bcdfc349408
              Task    v1 ca66f8661ba9fb14923f6422925e1b15996e84255c2be15a525582d8eae4bfa7
EXECUTED BY:  Engineering Lead (LANE-7), spec author. Doc-only: 0 D1 reads or writes, no deploys, no git writes
REVIEWED BY:  Tue 27 Oct — UX Lead + Data-Identity Lead (REVIEW-007); Architect (REVIEW-A) on §4–§6 and §9
APPROVED BY:  Founder (Decision Request after the reviews; build Wed 28 – Fri 30; last production deploy Sat 31 Oct;
              release sign-off Sun 1 Nov, ML-1024-3)
BASELINE:     /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11), branch October-2026, HEAD c3c6e4a
```

**Status:** rev 0, Sun 25 Oct 2026. Every D1 figure here is an estimate from 008's reports; nothing was queried for this spec.

## 0. Inputs (SHA-256, re-hashed on disk before reading)

| Input | Hash | Used for |
|---|---|---|
| `claude/meridian-october-revised-scope-v2.md` | `967bebd7…f33445` | §Fixed Income Vertical (API + UI layers), §MA-OCT-009/010, release gate "Fixed Income UI" |
| `claude/MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2…15cd3` | §8.1–§8.3 tables and indexes, §14.1 confidence bands, §16 hand-off contract |
| `claude/packets/MA-OCT-008.DIL14_Report.md` | `c517dde7…9c399` | **AC12 FAIL** (1 wrong-issuer link, PepsiCo Singapore Financing I); "until the §5 re-test passes, 009 must not read bond rows" |
| `claude/MA-OCT-007_Spec.md` rev 1.4 | `4d4fffef…397c` | NavLink (§3.2), router and history contract (§3.3), §3.6 bond join, §5.4 copy, R1f |
| `App/Corporate Atlas/src/entities-api.js` | `d18845dd…c70db` | Live R1–R4 routes, `json()` helper (no cache headers today), R1f at the step-3a block |
| `App/ma-entities.js` | `9b42b5ff…e303` | 007 layer stack, issuer layer sections, BR-1 outage pattern |
| `claude/packets/MA-OCT-008.BUILD_Report.md`, `STATUS_BOARD.md`, `claude/October_Decisions_Log.md` | read as found | Live facts: 943 `bond_issuance` rows, 633 final; 30 seed issuers; confidence mix; 43 % of finals carry an ISIN/CUSIP |

## 1. Problem and goals

008 has loaded SEC corporate-bond issuance for 30 issuers, but nothing serves it. Scope v2 asks for directory, issuer, detail, coverage and freshness endpoints (009) and a Fixed Income UI with issuer integration, bond detail with SEC source, a not-live-pricing disclosure and freshness/confidence indicators (010). The Task asks that 010 hang off 007's issuer layer rather than add a new top-level surface.

**Goals (measurable at UAT):**
1. From any issuer with linked CIKs, the issuer layer shows a **Bonds** section: outstanding final tranches in maturity order, paged 25 at a time, plus a maturity ladder.
2. Each bond opens a **bond detail** layer with its terms, parse confidence, SEC source link, and a link back to its issuer.
3. A **Fixed Income directory** (`#/fi`) lists the 30 seed issuers with counts and freshness and opens each issuer (Founder Q1).
4. **No bond row is served while AC12 has not passed** (the gate, §4), and the gate also covers 007's live R1f (§4.3).
5. Every response says `data_type: "issuance_reference"`; every screen shows the not-live-pricing notice.
6. Every new query passes the three-point check; an issuer view adds ≤ 30 reads for a one-CIK issuer.

**Non-goals (v1):** pricing, yields, ratings, TRACE, secondary market; bond-level free-text search across all issuers (cut to November, §11); any write from 009 or 010 (D4); a new Worker, cron or LaunchAgent; FX conversion; bond rows in `instrument_entity_map` (008 F3).

## 2. Current state (code evidence, 25 Oct)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| C1 | 008's tables are **live** in D1: 943 rows, 633 `final`, 30 `bond_issuer_link` rows (Fri 16 Oct load). | STATUS_BOARD row MA-OCT-008.BUILD | 009 can be built and tested against real plans; data must stay gated (C3). |
| C2 | Final confidence mix (build report, 628 finals): 100 → 44, 95 → 228, 90 → 51, 85 → 288, 75 → 2, 70 → 15. 17 rows sit in the 60–79 "check source" band; none is below 60. | `MA-OCT-008.BUILD_Report.md` | The `parse_confidence ≥ 60` filter (008 §16) removes nothing today but must stay. |
| C3 | **AC12 FAILED** on 17 Oct: one wrong-issuer link (PepsiCo Singapore Financing I's 4 rows stored under PepsiCo Inc, entity 1457). Fix R-1..R-4 and the re-test are planned Wed 28 – Fri 30. | DIL14 §1, §5 | 009 must ship **closed** and open only on evidence (§4). |
| C4 | **007's R1f is live and ungated.** Step 3a of R1 reads `bond_issuance` / `bond_issuer_link` with no AC12 gate and no `parse_confidence` filter. Since the 16 Oct load created the tables, R1 can already return a `sec_bond` candidate, including PepsiCo Inc for the PepsiCo Singapore keys. | `entities-api.js` step-3a block; P1 report ("R1f activates automatically") | A live exposure of the AC12 data today. Founder Q3 and §4.3. |
| C5 | `meridian-entities-api` sends no `Cache-Control` and uses no Cache API; `json()` sets CORS headers only. | `entities-api.js:14–16` | 009 adds caching only where it earns it (§5.7). |
| C6 | The issuer layer renders fixed sections (exposure strip, linked instruments, issuer panels) through loaders that take the layer as `root` (007 P1). | `ma-entities.js` `_loadLinkedInstruments`, `_navRenderEntity` | The Bonds section is one more loader of the same shape. |
| C7 | The router accepts only `#/entity/{id}` and `#/instrument/{key}`. | `App/index.html` router `parse()` | 010 adds `#/fi` and `#/bond/{accession}/{seq}` (§7.1). |
| C8 | Only 43 % of finals carry an ISIN or CUSIP; co-registrant rows now sit under their own CIK (L8-12); some issuers are unlinked (DQ-2..DQ-5). | Build report §3, DIL14 §4 | Bonds need a route that does not depend on `instrument_key` or on an entity link (§5.2, §5.3). |

## 3. Domain and tables

- **Read only:** `bond_issuance`, `bond_issuer_link` (Entities domain, written only by the 008 runner and 013's repoint); `entity_master` and `entity_merge_redirect` through 007's R3.
- **One new table, Entities domain:** `fi_serving_gate` (§4.1). **Owner:** Data-Identity Lead (Entities). **Writer:** an operator `wrangler d1 execute` of one row, on the Data-Identity Lead's signed AC12 result and the Founder's acknowledgement. **Reader:** `meridian-entities-api` only. Not cross-domain.
- **No ETF-domain table** is read or written. No Ops table is read (§5.5 explains freshness without the Ops API).

## 4. The AC12 gate

### 4.1 Mechanism (Founder Q2)

```sql
-- migration: App/Corporate Atlas/migrations/009-fi-serving-gate.sql   (Entities domain; ≈ 3 writes)
CREATE TABLE IF NOT EXISTS fi_serving_gate (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  state       TEXT NOT NULL CHECK (state IN ('closed','open')),
  changed_at  TEXT NOT NULL,
  changed_by  TEXT NOT NULL,          -- role, e.g. 'Data-Identity Lead'
  evidence    TEXT NOT NULL           -- report path + SHA-256, e.g. the AC12 re-test report
);
INSERT OR IGNORE INTO fi_serving_gate (id, state, changed_at, changed_by, evidence)
VALUES (1, 'closed', datetime('now'), 'Engineering Lead', 'MA-OCT-008.DIL14 AC12 FAIL c517dde7…9c399');
```

- **Opening:** after the Data-Identity Lead signs the AC12 re-test, one statement: `UPDATE fi_serving_gate SET state='open', changed_at=…, changed_by='Data-Identity Lead', evidence='<report path> <sha256>' WHERE id=1;`. Logged in the Decisions Log the same day. No deploy is needed, so the gate can open on any day the data passes, including after the Sat 31 deploy cutoff (a single-row write is not a bulk write; Sun 1 Nov only with the Founder's say-so).
- **Closing (kill switch):** the same statement with `state='closed'`. Takes effect on the next request (§5.7 caps caching at 60 s).
- **Read:** every 009 request starts with `SELECT state FROM fi_serving_gate WHERE id = 1` (1 PK read). **Fails closed:** a missing table, a missing row, any D1 error on this read, or any value other than `open` means closed.

**Alternative considered:** a Worker variable `FI_SERVE` changed by redeploy. Rejected as the primary: each flip is a deploy, the deploy calendar ends Sat 31, and the AC12 re-test may land late on Fri 30.

### 4.2 Behaviour when closed

| Route | Closed response (HTTP 200) |
|---|---|
| Issuer → bonds, CIK → bonds, bond detail, directory | `{ data_type: "issuance_reference", gate: "closed", bonds: [] (or bond: null, issuers: []), coverage: { available: true, served: false } }` |
| Ladder summary | `{ data_type, gate: "closed", years: [] }` |

The page shows "Bond data is being quality-checked and isn't shown yet." (§7.5). No row, count or issuer name from the bond tables leaves the Worker while closed. When the tables themselves are missing, every route returns `coverage.available = false` (008 §16), whatever the gate says.

### 4.3 R1f under the same gate (fixes C4)

R1's step 3a reads the gate (1 extra PK read, only when step 3a runs) and skips the bond lookup unless `open`. It also adds `AND parse_confidence >= 60` to the `bond_issuance` read, matching 008 §16. This ships with the 009 Worker deploy (Wed 28). **Until then the live R1f stays ungated** (Founder Q3 for an earlier stop). After the gate opens, a `sec_bond` candidate appears in R1 exactly as 007 §3.6 defines.

## 5. 009 — routes on `meridian-entities-api`

All routes are `GET`, additive, on the existing Worker (Entities domain), with the existing CORS header. Every success body carries `data_type: "issuance_reference"` and `gate`. No route writes.

### 5.1 Served-row rule (all routes)

`filing_status = 'final' AND parse_confidence >= 60`, from 008 §16. Each row exposes `parse_confidence` and `check_source: parse_confidence < 80`.

### 5.2 F1 — issuer → bonds: `GET /api/fi/issuers/{entity_id}/bonds?limit=25&cursor=&include_matured=0`

1. Gate (1 read).
2. Resolve `entity_id` via 007 R3 (`entity_master` PK, then `entity_merge_redirect`, ≤ 3 hops). 404 `gone` / 409 as 007 §6.3.
3. **Step 1** (008 §8.3): `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE entity_id = ?` (`idx_bil_entity`; no `status` filter). No rows → `200 { bonds: [], ciks: [] }` and 010 hides the section.
4. **Step 2**, once per CIK in one `db.batch()`:
   ```sql
   SELECT accession_number, tranche_seq, cik, instrument_key, isin, cusip, tranche_label, security_class,
          rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date,
          seniority, form_type, filing_date, source_url, parse_confidence
   FROM bond_issuance
   WHERE cik = ? AND filing_status = 'final'
     AND (maturity_date, accession_number, tranche_seq) > (?, ?, ?)
   ORDER BY maturity_date, accession_number, tranche_seq
   LIMIT ?;      -- limit + 1
   ```
   `filing_status = 'final'` stays a SQL **literal** (a bound parameter would stop the partial index from being used; N7-5). `parse_confidence >= 60` is applied in the Worker after the read, not in SQL, so the plan stays exactly P-B1.
5. Merge the per-CIK lists by the tuple, drop rows under 60, return up to `limit`.
6. **Cursor:** base64url of JSON `[maturity_date, accession_number, tranche_seq]`, the **last tuple scanned** (not the last one returned), so a filtered row can never cause a repeat or a gap. `next_cursor = null` only when every CIK is exhausted.
7. **Outstanding by default:** with `include_matured=0`, the first page starts from `[today_utc, '', -1]`, so matured tranches are excluded by the index range itself, at no extra read. `include_matured=1` starts from `['', '', -1]`.
8. `limit` default 25, clamped to [1, 100]; non-integer `limit` or an undecodable `cursor` → 400.

**Response:** `{ data_type, gate, entity_id, redirect, ciks: [{cik, issuer_name, link_method, confidence, last_polled_at}], bonds: [BondRow…], next_cursor, freshness: {last_polled_at, latest_filing_date} }`. `BondRow` is the step-2 field list plus `check_source` and `rate_label` (§7.4).

### 5.3 F1b — CIK → bonds: `GET /api/fi/ciks/{cik}/bonds?…`

Same as F1 with a single CIK (10 digits), for unlinked issuers (DQ-2..DQ-5, PepsiCo Singapore after R-1). Step 1 becomes the `bond_issuer_link` PK read. Response as F1 with `entity_id: null`.

### 5.4 F2 — bond detail: `GET /api/fi/bonds/{accession_number}/{tranche_seq}`

1. Gate; 2. `SELECT … FROM bond_issuance WHERE accession_number = ? AND tranche_seq = ?` (PK autoindex) — 404 if absent or not served (§5.1); 3. `bond_issuer_link` PK by `cik`; 4. if `entity_id` is set: `entity_master` PK via R3.

**Response:** `{ data_type, gate, bond: BondRow + {parser_version, ingested_at}, issuer: NavLink }`, where `issuer` is a 007 NavLink for the bond's `instrument_key` (or a key-less NavLink when NULL) with `source: "sec_bond"`, `source_table: "bond_issuer_link"`, `asset_type: "DBT"` and the 008 §8.1 band (cik 95 high, lei 85 medium, manual 100 high, unmatched → `unmatched`). **N8-3:** if the bond's `instrument_key` maps to more than one CIK among served rows, state is `ambiguous`.

### 5.5 F3 — directory and coverage: `GET /api/fi/coverage`

```sql
SELECT cik, issuer_name, entity_id, link_method, confidence, last_polled_at FROM bond_issuer_link;     -- ≈ 30 rows, SCAN
SELECT cik, COUNT(*) AS finals, MAX(filing_date) AS latest_filing, MIN(maturity_date) AS first_mat,
       MAX(maturity_date) AS last_mat
FROM bond_issuance WHERE filing_status = 'final' AND parse_confidence >= 60 GROUP BY cik;          -- partial index SCAN
SELECT COUNT(*) FROM (SELECT instrument_key FROM bond_issuance
  WHERE filing_status = 'final' AND instrument_key IS NOT NULL GROUP BY instrument_key HAVING COUNT(DISTINCT cik) > 1);   -- N8-3
```

**Response:** `{ data_type, gate, issuers: [{cik, issuer_name, entity_id, link_method, band, finals, latest_filing, last_polled_at}], totals: {issuers, linked, unmatched, finals}, multi_cik_keys, as_of }`. Freshness is per issuer `last_polled_at` and `latest_filing`, and globally `MAX(last_polled_at)`; 009 never says "live". The Ops run record for `local.bonds-ingest` (008 §16) is **not** read: it needs the authenticated Ops API, and `last_polled_at` carries the same fact.

### 5.6 F4 — maturity ladder: `GET /api/fi/issuers/{entity_id}/ladder` (first cut, §11)

Per linked CIK in one batch: `SELECT substr(maturity_date,1,4) AS y, currency, COUNT(*) AS n, SUM(principal_amount) AS principal FROM bond_issuance WHERE cik = ? AND filing_status = 'final' AND parse_confidence >= 60 AND maturity_date >= ? GROUP BY y, currency;` Merged by year in the Worker.

### 5.7 Caching

| Route | Cache |
|---|---|
| F3 coverage, F4 ladder | Worker Cache API (`caches.default`), key = URL + gate state, TTL 1 h; `Cache-Control: public, max-age=60` to the browser. The gate is read **before** the cache, so a closed gate never serves a cached open response. |
| F1, F1b, F2 | No Worker cache; `Cache-Control: public, max-age=60`. |
| Gate closed or tables missing | `Cache-Control: no-store`. |

### 5.8 Errors

| Case | Status / body | 010 shows |
|---|---|---|
| Bad `limit` / `cursor` / CIK / accession | 400 `{error}` | "That link isn't valid." |
| Entity gone / redirect loop | 404 / 409 as 007 §6.3 | 007's gone page / notice |
| Bond not found or not served | 404 `{error:'not_found'}` | "This bond isn't available." |
| Tables missing | 200, `coverage.available = false` | "Fixed Income data isn't available yet." |
| Gate closed | 200, `gate: 'closed'` | §7.5 notice |
| D1 or Worker error | 500 JSON | "Couldn't reach Corporate Atlas." + Retry (007 BR-1: 5xx = outage) |

## 6. Read budget and three-point check

| Query | Index / plan | Reads per execution | Check |
|---|---|---|---|
| Gate | `fi_serving_gate` INTEGER PK | 1 | ✔ |
| F1 step 1 | `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)` (P-B2) | 1–3 | ✔ |
| F1 step 2 (per CIK) | `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND …)`, **no temp B-tree** (P-B1) | ≤ 2 × 26 (index + row, *k* = 2 worst) | ✔ |
| F1b step 1 | `bond_issuer_link` PK | 1 | ✔ |
| F2 | `bond_issuance` PK autoindex; `bond_issuer_link` PK; `entity_master` PK + R3 | ≤ 10 | ✔ |
| F3 issuers | `SCAN bond_issuer_link` (≈ 30 rows; justified: whole small table) | ≈ 30 | ✔ |
| F3 per-CIK counts | `SCAN bond_issuance USING INDEX idx_bi_cik_final_key` + temp B-tree for GROUP BY | ≈ 2.5 × 633 ≈ 1.6k (9 Oct grouped-scan rule) | ✔, cached 1 h |
| F3 N8-3 | `SEARCH`/`SCAN` on `idx_bi_instrument` + temp B-tree | ≈ 2.5 × 272 ≈ 0.7k | ✔, cached 1 h |
| F4 ladder (per CIK) | `SEARCH … idx_bi_cik_final_key (cik=? AND maturity_date>?)` + temp B-tree | ≤ 2.5 × the issuer's finals (≤ 1.6k worst, for the largest issuer) | ✔, cached 1 h |
| R1f (gated) | as 007 P10, plus 1 gate read | + 1 | ✔ |

**Per screen:**
- Issuer view, one CIK: gate 1 + R3 1 + step 1 1 + step 2 ≤ 52 ≈ **≤ 55**; ladder ≤ 1.6k uncached, 0 cached. Issuer with no CIK: **3** (hides the section).
- Bond detail: **≤ 11**.
- Directory: **≤ 2.4k uncached, 1 cached** (gate only).
- **Daily planning figure:** 300 issuer views × 55 + 300 detail × 11 + 24 h × (directory + 5 ladders) uncached per colo ≈ **≈ 0.25M/day worst**, ≈ 5 % of the 5M cap. **Writes: 0** (the gate migration's ≈ 3 writes and each gate flip's 1 write are operator actions).

**No new cron, Worker, LaunchAgent or index.** P-B1 and P-B2 are 008's plan checks; this spec adds P-F1 (F2 PK), P-F2 (F3 grouped scan, confirm ≤ 2k), P-F3 (F4) and P-F4 (gate PK), all EXPLAIN-only in the build lane (§10).

## 7. 010 — Fixed Income UI in `ma-entities.js`

### 7.1 Surfaces and routes

| Surface | Route | Opens as |
|---|---|---|
| **Bonds** section | none (inside `#/entity/{id}`) | A section on the 007 issuer layer, after "Linked instruments" |
| **Bond detail** | `#/bond/{accession_number}/{tranche_seq}` | A 007 layer (one history entry, Back closes it) |
| **Fixed Income directory** | `#/fi` | A 007 layer, opened from one nav link "Fixed Income" (Founder Q1) |
| **Unlinked issuer** | `#/fi/cik/{cik}` | A 007 layer listing F1b, with "Issuer not linked to Corporate Atlas yet" |

Router change (`index.html`): `parse()` also accepts `fi`, `fi/cik/{10 digits}` and `bond/{accession}/{seq}` (accession `\d{10}-\d{2}-\d{6}`, seq a positive integer). Everything else in 007 §3.3 (history contract, `from` grammar, invalid-link toast) is unchanged. A bond row opened from an issuer uses `from=entity:{id}:{page}`.

### 7.2 Bonds section (issuer layer)

- Loaded by `_loadIssuerBonds(entityId, root)`, same shape as `_loadLinkedInstruments`. It calls F1 (and F4 once F1 has rows) through `data_entitiesGet`.
- **Hidden** when `ciks` is empty (most entities). **Shown** with the §7.5 notice when the gate is closed and the entity has CIKs.
- Header: "Bonds · SEC issuance data" with the freshness line "Last checked with SEC {date} · latest filing {date}".
- **Maturity ladder** (F4): one bar per year, height = number of tranches; the label shows the count and the USD principal; other currencies are listed under the bar as counts ("+ 2 EUR"). No FX. Plain HTML/CSS bars, no chart library.
- **Table**, 25 rows a page, "Show 25 more ↓", in maturity order:

  | Maturity | Coupon / spread | Type | Principal | Seniority | Tranche | Filed | |
  |---|---|---|---|---|---|---|---|

  The last column holds the confidence chip ("High · 95"; amber "Check source · 75" when `check_source`).
- Toggle: "Show matured" (refetches with `include_matured=1`).
- Each row opens the bond detail layer.

### 7.3 Bond detail layer

- Title: tranche label (else "{coupon} {Type} due {maturity}"), issuer name.
- Terms grid: principal + currency, coupon or benchmark + spread, rate type, maturity, seniority, security class, form type, filing date, accession number, ISIN/CUSIP when present (placeholder values hidden, 007 BR-2).
- **Source:** "View filing on SEC.gov" → `source_url` in a new tab (`rel="noopener noreferrer"`).
- **Quality:** "Parse confidence {n}" with the band chip; for 60–79, "Check the filing: some terms were parsed with lower confidence." Parser version and ingest date in small text.
- **Issuer:** the NavLink candidate row (007 `_navCandidateHtml`) → "Open issuer →". For `unmatched`: "Issuer not linked to Corporate Atlas yet · {issuer_name} (CIK {cik})" and a link to `#/fi/cik/{cik}`.
- "View instrument" (007 card) only when `instrument_key` is set.

### 7.4 Labels (honest terms)

| Field | Rule |
|---|---|
| Rate type | `fixed` → "Fixed coupon" (never "fixed for life": reset notes are stored as `fixed` with the initial coupon, DIL14); `floating` → "Floating"; `fixed_to_floating` → "Fixed-to-floating". |
| Coupon / spread | Fixed: "5.850%". Floating: "{benchmark} + {spread} bp". Floating with spread NULL: "{benchmark or 'Floating'} · spread not parsed — see filing". |
| Principal | "$1,250,000,000" / "€750,000,000"; NULL → "—". |
| Seniority | As stored; NULL → "Not stated on cover". |

### 7.5 States and copy

| State | Copy |
|---|---|
| Disclosure (every FI surface, always) | "Issuance and reference data from SEC filings. Not live prices or yields." |
| Gate closed | "Bond data is being quality-checked and isn't shown yet." |
| Tables missing | "Fixed Income data isn't available yet." |
| No outstanding bonds | "No outstanding bonds in Meridian Atlas for this issuer." + "Show matured" |
| Outage / 5xx | "Couldn't reach Corporate Atlas." + ↻ Retry (never an empty state) |
| Not found | "This bond isn't available." |
| Unlinked issuer | "Issuer not linked to Corporate Atlas yet." |

Machine codes never show. 375 px: the table becomes stacked rows (maturity + coupon on line 1, principal + chip on line 2), with no horizontal page scroll.

### 7.6 Directory (`#/fi`)

From F3: a filter box (client-side, issuer name or CIK), then one row per issuer: name, link chip (Linked / "Not linked yet"), final bond count, latest filing, last checked. A linked row opens `#/entity/{id}`; an unlinked row opens `#/fi/cik/{cik}`. Header totals: "{issuers} issuers · {finals} bonds · {unmatched} not linked yet". The disclosure sits at the top.

## 8. Deploy shape

- **One Worker deploy** of `meridian-entities-api` (Wed 28, after the build lane's tests and EXPLAINs): F1, F1b, F2, F3, F4, the gate read, R1f gated. Backward-compatible: no existing route changes shape. The gate table is created **closed** first (migration), so the deploy serves nothing new.
- **One front-end change** (`App/index.html`, `App/ma-entities.js`, `App/ma-data.js` if a helper is needed), released with the October release via `generate-docs.mjs` (Sat 31 at the latest).
- The gate opens separately, on AC12 evidence, by the Data-Identity Lead (§4.1).

## 9. Tests (build lane)

| # | Test | Type |
|---|---|---|
| T-F1 | Gate: missing table, missing row, `closed`, garbage value, D1 error → closed responses with no bond fields; `open` → rows | Worker unit (node:sqlite shim, as `nav-007-worker.test.mjs`) |
| T-F2 | F1 multi-CIK merge: 3 CIKs, pages of 2/25/100, no gaps or repeats, global cursor; filtered row (< 60) neither repeats nor gaps; `include_matured` 0/1; `next_cursor` null at the end; bad cursor/limit → 400 | Unit |
| T-F3 | F1 R3: merged id → survivor + `redirect`; gone → 404 | Unit |
| T-F4 | F2: PK hit, not-served row → 404, unmatched issuer NavLink, N8-3 ambiguous, `check_source` | Unit |
| T-F5 | F3/F4: counts, N8-3 count, cache keyed by gate state (close the gate → no cached open body served) | Unit |
| T-F6 | R1f: gate closed → no `sec_bond` candidate; open → candidate; `parse_confidence < 60` excluded; missing tables tolerated (007 T2 still 58/58) | Unit |
| T-F7 | `data_type: "issuance_reference"` on every success body; `no-store` when closed | Unit |
| T-F8 | EXPLAIN P-B1, P-B2, P-F1..P-F4 match §6 (live D1, EXPLAIN only, 0 rows read) | Build lane |
| T-F9 | Front end against fixtures: section hidden / closed / rows; ladder; paging; detail; directory; unlinked issuer; every §7.5 copy line; 5xx → Retry; Back closes one layer; 375 px | Browser preview |
| T-F10 | Live smoke after the deploy, gate closed: F1/F2/F3 return `gate: closed` and no bond fields; R1 for a PepsiCo Singapore key returns no `sec_bond` | ≤ 10 Worker calls |

## 10. Build plan by day (fits Wed 28 – Sat 31)

| Day | Work | Gate to the next day |
|---|---|---|
| **Wed 28** (usage reset) | Worker: gate migration (closed); F1, F1b, F2, F3, F4; R1f gate; T-F1..T-F7; EXPLAIN T-F8; deploy; T-F10. Record the pre-deploy version id. | Deploy live, gate closed, smoke passes |
| **Thu 29** | Front end: router routes; Bonds section + ladder; bond detail; directory; unlinked issuer; T-F9 on fixtures | Preview passes on fixtures |
| **Fri 30** | Build review (UX + Data-Identity, BR-style, fixtures or live if the gate is open) and Founder UAT. In parallel (008 lanes): R-1..R-4 and the AC12 re-test. | Review READY; UAT pass |
| **Sat 31** | Fixes from review/UAT; front-end release in the October release; **last production deploy**. If AC12 has passed, the Data-Identity Lead opens the gate and runs T-F10 live with the gate open. | — |
| Sun 1 Nov | Release sign-off only. Gate opens on Sunday only with the Founder's say-so. | — |

**If the AC12 re-test has not passed by Sat 31,** 010 still ships: the section shows the quality-check notice for the 30 seed issuers, and the gate opens whenever AC12 passes, with no deploy.

## 11. What to cut if the week slips (in this order)

1. **F4 maturity ladder** (keep the table). Saves about half a day across Worker and front end.
2. **"Show matured" toggle** (outstanding only).
3. **F1b + unlinked-issuer layer** (unlinked issuers then show in the directory as "Not linked yet" with no click-through).
4. **F3 directory `#/fi`.** This fails scope v2's "first-class destination" and needs the Founder's agreement (Q1).

Already out of v1: bond-level search across all issuers (scope v2 "search" is met by the directory's issuer filter); filters by rate type or seniority (client-side, November).

## 12. Rollback

| Part | Rollback | Time |
|---|---|---|
| Data exposure | Close the gate (1 UPDATE); effective within 60 s | Minutes |
| Worker | `wrangler rollback` to the recorded pre-009 version; 007 routes are unchanged, and R1f returns to its pre-009 (ungated) form, so close the gate **and** check C4 before rolling back | Minutes |
| Front end | Revert the 010 changes before the release, or after release revert + `generate-docs.mjs`; the Worker alone is invisible to users | Minutes |
| Gate table | Leave in place (fails closed; 1 row) | — |

## 13. Acceptance criteria

- **AC-F1 Gate.** With the gate closed or missing, no route returns a bond row, count or issuer name from the bond tables, and R1 returns no `sec_bond` candidate (T-F1, T-F6, T-F10).
- **AC-F2 Issuer bonds.** For a linked issuer, the Bonds section shows outstanding finals in maturity order, 25 per page, no gaps or repeats across pages and CIKs (T-F2).
- **AC-F3 Detail.** Each bond opens a detail layer with terms, parse confidence, SEC link and an issuer link that follows 007 states and R3 (T-F4).
- **AC-F4 Honest labels.** No "fixed for life"; floating rows without a spread say so; 60–79 rows show "Check source" (§7.4).
- **AC-F5 Disclosure.** Every FI surface shows the not-live-pricing line, and every response carries `data_type: "issuance_reference"` (T-F7, T-F9).
- **AC-F6 Freshness.** Every issuer shows "Last checked with SEC" and "latest filing"; nothing says "live".
- **AC-F7 Directory.** `#/fi` lists all 30 seed issuers with counts; linked ones open the issuer, unlinked ones the CIK layer.
- **AC-F8 States.** Every §7.5 state renders its copy; a 5xx shows Retry (T-F9).
- **AC-F9 Navigation.** Back closes exactly one layer from bond detail, directory and CIK layers; deep links `#/fi`, `#/bond/…` cold-load to Home underneath (007 N7-13).
- **AC-F10 Budget.** Every plan matches §6 before deploy; no single execution over 50k; one-CIK issuer view ≤ 55 reads, excluding the cached ladder.

## 14. Open questions for the Founder (3)

| # | Question | Recommendation |
|---|---|---|
| **Q1** | Scope v2 asks for a "first-class Fixed Income navigation destination"; the Task asks 010 to hang off the issuer layer. Is a **"Fixed Income" nav link opening the `#/fi` directory as a 007 layer** (no new panel or module) the destination you want for October? | **Yes.** It meets the scope with one small surface, keeps bond lists on the issuer layer, and reuses 007's layers and Back behaviour. A full Fixed Income panel with cross-issuer bond search moves to November. |
| **Q2** | Gate mechanism: a one-row Entities-domain table `fi_serving_gate` opened by one statement on AC12 evidence, or a Worker variable flipped by redeploy? | **The table.** It opens and closes without a deploy, so it works after the Sat 31 cutoff and doubles as a kill switch. Cost: ≈ 3 writes to create, 1 read per request. |
| **Q3** | 007's R1f is live and ungated today (C4), so PepsiCo Singapore bond keys can show PepsiCo Inc as a `sec_bond` issuer candidate. Stop it before Wed 28? | **Yes, cheaply.** Before the 007 front-end release on Mon 26, run ≤ 8 PK reads to see whether any of the 4 PepsiCo Singapore keys exists in `instrument_master` or a holding. If none does, the exposure is API-only and closes with the Wed 28 deploy (§4.3) or earlier with 008's R-1. If any does, ship a one-constant R1f switch-off with Monday's work. |

## 15. Review questions (Tue 27)

**UX Lead:**
1. Is the Bonds section's place (after Linked instruments) right, or should it come first for issuers that have bonds?
2. Is the ladder's "USD principal + other currencies as counts" honest enough, or should the ladder show counts only?
3. Is the 375 px stacked-row table acceptable for an 8-column table?

**Data-Identity Lead:**
4. Is `#/bond/{accession}/{seq}` acceptable as a bond-record route? It is a filing-tranche id, not an `instrument_key`, so 007's "no third key form" rule (which governs instrument keys) is not broken; please confirm.
5. Is applying `parse_confidence ≥ 60` in the Worker (cursor = last scanned tuple) acceptable, rather than in SQL?
6. Should F3 coverage counts be withheld while the gate is closed (this spec: yes), or are counts safe to show?
7. Gate opening authority: Data-Identity Lead on AC12 evidence with the Founder's acknowledgement — enough, or Founder only?

**Architect:**
8. Cache API keyed by URL + gate state, gate read before the cache: any path where a closed gate serves a cached open body?
9. Is the per-colo 1 h cache on F3/F4 acceptable against the runner's update cadence (manual runs, a few a week)?

## 16. Decision trace

| Item | Decision | Source |
|---|---|---|
| Domain of new table | `fi_serving_gate`: Entities; owner Data-Identity Lead | This spec §3, project rule |
| Bond tables | Read only, 008 §8 exactly | 008 §16 |
| Served rows | `final` and `parse_confidence ≥ 60`; 60–79 flagged | 008 §14.1, §16 |
| AC12 | Ship closed; open on the re-test; R1f gated too | DIL14 §5; this spec §4 |
| Surface | Issuer layer + `#/fi` layer (Q1) | Task; scope v2 |
| No Ops API read | Freshness from `last_polled_at` | This spec §5.5 |
