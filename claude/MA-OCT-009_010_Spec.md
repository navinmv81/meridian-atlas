# MA-OCT-009 + MA-OCT-010 — Fixed Income API and Fixed Income page: Spec

```text
ISSUED BY:    Main Lane (Program Orchestrator) — rev 0: MA-OCT-009.SPEC (Sun 25 Oct); rev 1: MA-OCT-009.SPEC1 (Wed 28 Oct)
              SPEC1 Control v1 ae093714dcc5853acdb84a0866c9661d1236c9ff75beddb4602aef8796c7b62c
              SPEC1 Task    v1 bf66d5554a2c677d2e2e633cd1de153d0353d654f49cb5dfe1ccef7b0bd298a9
EXECUTED BY:  Engineering Lead (LANE-7), spec author. Doc-only: 0 D1 reads or writes, no deploys, no git writes
REVIEWED BY:  Tue 27 Oct — Architect (REVIEW-A) 15d0ef4c4dc878fc346f3cbc886ccdc1b02e16543ed128456e059011af370d58;
              Data-Identity Lead (LANE-11) 5bb8b8c77343469de890c059e9c1a9c0ed99d76c1863123abd3046e345882777.
              Both PASS WITH NOTES; rev 1 folds all 16 MUST-FIX items (§17).
APPROVED BY:  Founder — Q1–Q3 decided 25 Oct (yes, §14); Option C calendar (ML-1025-5): 009 deploy Thu 29 with the gate
              closed; 007 + 010 front ends in the Mon 2 Nov October site release; go-live and sign-off Tue 3 Nov
BASELINE:     branch October-2026; code base = LANE-1-ENG's committed 003 retirement entities-api.js (§0, placeholder)
```

**Status:** rev 1, Wed 28 Oct 2026. Folds Architect M-1..M-7 and Data-Identity M-1..M-9; every NOTE is accepted or deferred in §17. Design unchanged from rev 0. Previous version: rev 0 `8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4`. Every D1 figure is an estimate from 008's reports and the two reviews; nothing was queried for this spec.

## 0. Inputs

| Input | SHA-256 | Used for |
|---|---|---|
| `claude/meridian-october-revised-scope-v2.md` | `967bebd7…f33445` | §Fixed Income Vertical; release gate "Fixed Income UI" |
| `claude/MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2…15cd3` | §8.1–§8.3 tables and indexes, §14.1 bands, §16 hand-off |
| `claude/packets/MA-OCT-008.DIL14_Report.md` | `c517dde7…9c399` | AC12 FAIL; "until the §5 re-test passes, 009 must not read bond rows" |
| `claude/MA-OCT-007_Spec.md` rev 1.4 | `4d4fffef…397c` | NavLink, router/history contract, §3.6 bond join, §5.4 copy, R1f |
| `claude/MA-OCT-009_010_Architect_Review.md` | `15d0ef4c…0d58` | Architect M-1..M-7, N-1..N-9 |
| `claude/MA-OCT-009_010_DIL_Review.md` | `5bb8b8c7…2777` | Data-Identity M-1..M-9, N-1..N-7, D-1..D-6 |
| **Code base (Architect M-1, N-3; DIL M-1):** `App/Corporate Atlas/src/entities-api.js` at LANE-1-ENG's **committed** 003 retirement commit | **`<SHA-256 and commit — from claude/packets/MA-OCT-WED28.ENG1_Report.md; not yet reported at 19:45Z Wed 28>`** | The 009 diff is built on this file, not on rev 0's working copy `d18845dd…` or on `721d093`'s `fac446bf…` |
| `App/ma-entities.js`, `App/index.html`, `App/ma-data.js` | at the same commit | 007 layer stack, router, BR-1 outage pattern, BR-2 placeholder identifiers |
| `App/ETF Refresh/schema-phase1-holdings.sql` | read as found | `idx_holdings_cusip (cusip, report_month)` for the PepsiCo check (§4.4) |

**Data facts used (from the reviews and 008 reports, 16 Oct load):** 943 `bond_issuance` rows, 633 `final`; 30 `bond_issuer_link` rows; minimum final `parse_confidence` 70; 276 of 633 finals carry an `instrument_key`; no key spans two CIKs (N8-3 = 0); 19 keys appear in more than one filing (reopenings; one exact duplicate, CUSIP `14913UAP5`, D-3); 37 Caterpillar finals have boilerplate tranche labels (D-2); 37 floating finals have no spread (D-4); 388 finals have no parsed seniority. **The 4 PepsiCo Singapore rows (`0001104659-24-022370` / 1–4) have `instrument_key = NULL`** and sit under CIK 0000077476 → entity 1457 until 008's R-1 moves them.

## 1. Problem and goals

008 has loaded SEC corporate-bond issuance for 30 issuers, but nothing serves it. Scope v2 asks for directory, issuer, detail, coverage and freshness endpoints (009) and a Fixed Income UI with issuer integration, bond detail with SEC source, a not-live-pricing disclosure and freshness/confidence indicators (010). 010 hangs off 007's issuer layer; the `#/fi` directory is the "first-class destination" (Founder Q1).

**Goals (measurable at UAT):**
1. From any issuer with linked CIKs, the issuer layer shows a **Bonds** section: outstanding final tranches in maturity order, 25 a page, and a maturity ladder (first cut, §11).
2. Each bond opens a **bond detail** layer with its terms, parse confidence, SEC source link and a link back to its issuer (the bond's own filer).
3. A **Fixed Income directory** (`#/fi`) lists the 30 seed issuers with counts and freshness and opens each one.
4. **No bond row, count, CIK or issuer name is served while the gate is closed** (§4), and the gate also covers 007's R1f.
5. Every response says `data_type: "issuance_reference"`; every screen shows the not-live-pricing notice.
6. Every new query passes the three-point check; a one-CIK issuer view adds ≤ 55 reads (excluding the ladder).

**Non-goals (v1):** pricing, yields, ratings, TRACE; cross-issuer bond search (November); a guarantor field (DIL N-6, November); writes from 009/010 (D4); a new Worker, cron, LaunchAgent or index; FX; bond rows in `instrument_entity_map` (008 F3).

## 2. Current state (code evidence)

| # | Finding | Consequence |
|---|---|---|
| C1 | 008's tables are live: 943 rows, 633 final, 30 issuers (16 Oct). | Build against real plans; data stays gated. |
| C2 | Minimum final `parse_confidence` is 70; rows under 60 are stored as `parse_failed`. | The `≥ 60` filter is a safeguard; it removes nothing today. |
| C3 | AC12 failed 17 Oct (PepsiCo Singapore under PepsiCo Inc). R-1..R-4 and the re-check run Wed 28 (WED28.ENG8), with no gate opening. | 009 ships closed and opens only on the §4.5 evidence. |
| C4 | **007's R1f is live and ungated** (no gate, no confidence filter, `LIMIT 1` CIK pick). **Corrected in rev 1 (DIL fact 1):** the 4 PepsiCo Singapore rows have `instrument_key = NULL`, so R1f **cannot** return them today; their exposure is only through F1/F2, which are gated. R1f remains ungated for every other bond key until the 009 deploy. | Gated R1f ships Thu 29 (§4.3); the Mon 2 front-end release depends on it (§8). |
| C5 | `meridian-entities-api` sends no `Cache-Control`; it is served only at `*.workers.dev` (no route or custom domain). | Worker Cache API hits are unproven there (Architect M-6, §5.7). |
| C6 | Issuer-layer sections load through functions that take the layer as `root`. | The Bonds section is one more loader of that shape. |
| C7 | The router accepts only `#/entity/{id}` and `#/instrument/{key}`. | 010 adds `#/fi`, `#/fi/cik/{cik}`, `#/bond/{accession}/{seq}` (§7.1). |
| C8 | 43 % of finals carry a key; co-registrant rows sit under their own CIK (L8-12); some filers are unlinked (DQ-2..DQ-5). | Bonds need routes that depend on neither `instrument_key` nor an entity link. |

## 3. Domain and tables

- **Read only:** `bond_issuance`, `bond_issuer_link` (Entities; written only by the 008 runner and 013's repoint); `entity_master`, `entity_merge_redirect` through 007 R3. **One ETF-domain read**, in the pre-deploy PepsiCo check only (§4.4): `fund_holdings_monthly` by `idx_holdings_cusip`, read-only, ≤ 4 point reads, never by ISIN.
- **One new table, Entities domain:** `fi_serving_gate` (§4.1). **Owner:** Entities Product Lead (Data-Identity Lead lane) (Architect N-2). **Writer:** an engineering lane executing one guarded statement on the Data-Identity Lead's signed instruction (§4.1). **Reader:** `meridian-entities-api` only. Not cross-domain.
- No Ops table is read; no ETF table is written.

## 4. The AC12 gate

### 4.1 Mechanism (Founder Q2: table)

```sql
-- migration: App/Corporate Atlas/migrations/009-fi-serving-gate.sql   (Entities domain; ≈ 3 writes)
CREATE TABLE IF NOT EXISTS fi_serving_gate (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  state       TEXT NOT NULL CHECK (state IN ('closed','open')),
  changed_at  TEXT NOT NULL,          -- ISO-8601 UTC; also part of the cache key (§5.7)
  changed_by  TEXT NOT NULL,          -- the authority (role), not the executor
  evidence    TEXT NOT NULL           -- report paths + FULL SHA-256s
);
INSERT OR IGNORE INTO fi_serving_gate (id, state, changed_at, changed_by, evidence)
VALUES (1, 'closed', strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'Engineering Lead',
        'claude/packets/MA-OCT-008.DIL14_Report.md c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399 (AC12 FAIL)');
```

**Open (DIL M-7):**
```sql
UPDATE fi_serving_gate
SET state='open', changed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), changed_by='Data-Identity Lead',
    evidence='<AC12 re-test report path> <full sha256>; <PepsiCo check report path> <full sha256>; <open instruction path> <full sha256>'
WHERE id=1 AND state='closed';
-- require meta.changes = 1, then read back:
SELECT * FROM fi_serving_gate WHERE id=1;
```
**Close (kill switch):** the mirror statement with `state='closed'` and `WHERE id=1 AND state='open'`, same `changes = 1` check and read-back.

**Who and when (DIL M-2, M-7, N-4; Architect N-8; DIL Q7):**
- **Opening** is a production-visible change. Separation of roles: the AC12 adjudicator (LANE-8's Data-Identity Lead) signs the re-test; LANE-11's Data-Identity Lead checks the §4.5 evidence and signs the open instruction; **the Founder's acknowledgement** is logged in the Decisions Log; an **engineering lane** (Claude Code; Cowork cannot run D1) executes the statement and records itself as executor in its report. `changed_by` records the authority.
- **Calendar:** opening may happen any day once the §4.5 evidence holds, up to **Mon 2 Nov**. **After Mon 2 Nov, opening needs the Founder's approval**, not only an acknowledgement. A flip is a data write (1 row), not a deploy.
- **Closing** needs no acknowledgement: any lane, any time, logged the same day.
- After an opening, T-F10 runs again with the gate **open**.

**Read (every 009 request, and R1f step 3a):** `SELECT state, changed_at FROM fi_serving_gate WHERE id = 1` (1 PK read).
- Missing table or missing row → **closed** (normal before the migration).
- Any value other than `open` → closed.
- **Any other D1 error → HTTP 500** (outage; 007 BR-1 shows "Couldn't reach Corporate Atlas" + Retry). Still fail-closed: no data leaves (Architect N-1).

**Alternative considered:** a Worker variable flipped by redeploy. Rejected: every flip would be a deploy, and the last production change is Mon 2 Nov.

### 4.2 Behaviour when closed (DIL M-4, Q6)

| Route | Closed response (HTTP 200, `Cache-Control: no-store`) |
|---|---|
| F1 issuer → bonds | `{ data_type: "issuance_reference", gate: "closed", has_bond_link: true|false, ciks: [], bonds: [] }` — a boolean only |
| F1b CIK → bonds | `{ data_type, gate: "closed", has_bond_link: true|false, ciks: [], bonds: [] }` |
| F2 bond detail | `{ data_type, gate: "closed", bond: null, issuer: null }` |
| F3 directory/coverage | `{ data_type, gate: "closed", issuers: [], totals: null }` — **no counts** (DIL Q6, N-3) |
| F4 ladder | `{ data_type, gate: "closed", years: [] }` |

No CIK, issuer name, count or row from the bond tables leaves the Worker while closed. Tests T-F1 and T-F10 assert that no `cik`, `issuer_name`, count or bond field is present. When the bond tables themselves are missing, every route returns `coverage.available = false` (008 §16).

### 4.3 R1f under the gate (fixes C4; DIL M-5; Architect N-4)

R1 step 3a, in the 009 deploy:
1. Read the gate (§4.1). Unless `open`, add no `sec_bond` candidate.
2. When open: `SELECT DISTINCT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' AND parse_confidence >= 60 LIMIT 2` (`idx_bi_instrument`).
   - 0 CIKs → no candidate.
   - 1 CIK → `bond_issuer_link` PK read → the `sec_bond` candidate per 007 §3.6.
   - **2 CIKs → no `sec_bond` candidate, and the state is `source_conflict`** as 007 §5.1 defines (never an arbitrary pick).
3. Missing tables still mean "no candidate" (007 behaviour).

Cost: +1 gate read on step 3a, +1 index read for the DISTINCT probe. Backward-compatible for every 007 consumer (Architect check 2).

### 4.4 Pre-deploy PepsiCo check (one definition; DIL M-3 + Architect M-3)

**When:** in the 009 build, read-only, **before the Thu 29 Worker deploy**, and again **before the Mon 2 Nov front-end release**.

**Steps (EXPLAIN each first and record the plan):**
- **S1 (4 PK reads):** `SELECT accession_number, tranche_seq, cik, instrument_key, cusip, filing_status, parse_confidence FROM bond_issuance WHERE accession_number = '0001104659-24-022370' AND tranche_seq IN (1,2,3,4)` — PK autoindex.
- **S2 (only for S1 rows with a non-null `instrument_key`; ≤ 4 PK reads):** `SELECT instrument_key FROM instrument_master WHERE instrument_key IN (…)` — PK autoindex.
- **S3 (only for S1 rows with a non-null `cusip`; ≤ 4 point reads):** `SELECT 1 FROM fund_holdings_monthly WHERE cusip = ? LIMIT 1` — must EXPLAIN as `SEARCH fund_holdings_monthly USING INDEX idx_holdings_cusip (cusip=?)`. **Never** probe `fund_holdings_monthly` by ISIN or `instrument_key`: it has no index on either, so that would be a full scan of the largest table (Architect M-3). If the EXPLAIN shows anything other than that SEARCH, stop and skip S3.

**PASS** if, for every S1 row, any of:
- `cik = '0002007029'` (R-1 done); or
- the row no longer exists (R-1 deleted and not re-ingested; record it); or
- `instrument_key IS NULL` **and** S3 found no holding for its CUSIP (or the CUSIP is NULL); or
- the key has no `instrument_master` row **and** S3 found no holding.

**FAIL** if any S1 row has `cik = '0000077476'` and is reachable (a non-null key in `instrument_master`, or a holding by CUSIP). On FAIL: the Mon 2 Nov release may not ship until the gated R1f is live **and** T-F10 shows R1 returning no `sec_bond` candidate for that key; open a 004 ticket.

**Expected today:** PASS on 4 reads (all keys and CUSIPs NULL; S2 and S3 not run). **Bound:** ≤ 12 reads. **Record** in the build report: the S1 rows (listed columns only), each plan, `rows_read`, PASS/FAIL.

### 4.5 Gate-opening evidence (DIL)

The gate opens only when all four hold, each cited by path and full SHA-256 in `evidence`:
1. **AC12 re-test report:** every DIL14 §5 condition met — 60-row sample ≥ 98 % with corrections; **0 wrong-issuer links** in the sample and in the R-3 filer-list scan; the 37 formerly spread-less rows ≥ 98 % correct; R-4 moves signed.
2. **PepsiCo rows:** `0001104659-24-022370` / 1–4 under CIK 0002007029, whose `bond_issuer_link` row is `unmatched`, `entity_id` NULL, `status = 'paused'` (L8-12) until DQ-5 is resolved.
3. **F1 for entity 1457** lists none of those tranches (fixture run on live data with T-F1's open state).
4. **§4.4 check:** PASS.

## 5. 009 — routes on `meridian-entities-api`

All `GET`, additive, on the existing Worker. CORS as after 003's retirement (`GET, OPTIONS`). FI responses use a **separate helper `fi_json()`** that adds `Cache-Control`, so 007's `json()` and R1–R4 headers stay byte-identical; 003's differential test is reused to prove it (Architect N-6). Every success body carries `data_type: "issuance_reference"` and `gate`.

### 5.1 Served-row rule

`filing_status = 'final' AND parse_confidence >= 60` (008 §16). Each row exposes `parse_confidence` and `check_source: parse_confidence < 80`.

### 5.2 F1 — issuer → bonds: `GET /api/fi/issuers/{entity_id}/bonds?limit=25&cursor=&include_matured=0`

**Identity rule (DIL M-6):** `bond_issuer_link.entity_id` is always the **filer's own** legal entity (L8-4, L8-12, DIL14). A parent never collects a subsidiary's or co-registrant's bonds, and a guarantor is never the issuer. An entity has several CIKs only when those CIKs are the same legal entity (for example after a 013 twin merge). 008 §8.3's "parent and finance subsidiary" example does not apply to 009.

1. Gate (1 read; §4.1).
2. Resolve `entity_id` via 007 R3 (≤ 3 hops). 404 `gone` / 409 as 007 §6.3.
3. **Step 1:** `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE entity_id = ?` (`idx_bil_entity`, P-B2; no `status` filter). **Closed gate:** return `has_bond_link = (rows > 0)` and stop (§4.2). **More than 10 CIKs → 422 `too_many_ciks`** (Architect N-5). No rows → `200 { has_bond_link: false, ciks: [], bonds: [] }`.
4. **Step 2**, once per CIK in one `db.batch()`, each fetching `limit + 1` rows:
   ```sql
   SELECT accession_number, tranche_seq, cik, instrument_key, isin, cusip, tranche_label, security_class,
          rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date,
          seniority, form_type, filing_date, source_url, parse_confidence
   FROM bond_issuance
   WHERE cik = ? AND filing_status = 'final'
     AND (maturity_date, accession_number, tranche_seq) > (?, ?, ?)
   ORDER BY maturity_date, accession_number, tranche_seq
   LIMIT ?;
   ```
   `'final'` is a SQL **literal** (a bound value would lose the partial index). The `≥ 60` filter runs in the Worker after the read, so the plan stays exactly P-B1 (DIL N-2).
5. **Merge and cursor (Architect M-7):**
   - Merge the per-CIK lists in tuple order `(maturity_date, accession_number, tranche_seq)` (a total order: `accession_number` is globally unique).
   - **Consume** rows one at a time in merged order. A consumed row is either returned (`parse_confidence ≥ 60`) or dropped (< 60).
   - Stop when `limit` rows have been returned, **or** when any CIK that still had more rows (it returned `limit + 1`) has had its fetched buffer fully consumed — beyond that point the merge order is unknown.
   - **`next_cursor` = the tuple of the last row consumed in merged order.** It is **not** the largest tuple fetched from any CIK: rows fetched but not consumed (each CIK's tail past the page cut) are fetched again on the next page.
   - `next_cursor = null` only when every CIK's list is exhausted (each returned ≤ `limit` rows) and all were consumed.
   - A page can return fewer than `limit` rows with a non-null `next_cursor` (only when rows were dropped); 010 keeps "Show 25 more" while `next_cursor` is set (DIL N-2).
   - Encoding: base64url of JSON `[maturity_date, accession_number, tranche_seq]`.
6. **Outstanding by default:** `include_matured=0` starts the first page at `[today_utc, '', -1]`, so matured tranches are excluded by the index range. `include_matured=1` starts at `['', '', -1]`.
7. `limit` default 25, clamped to [1, 100]; non-integer `limit` or an undecodable cursor → 400.

**Response (gate open):** `{ data_type, gate, has_bond_link: true, entity_id, redirect, ciks: [{cik, issuer_name, link_method, confidence, last_polled_at}], bonds: [BondRow…], next_cursor, freshness: {last_polled_at, latest_filing_date} }`. `BondRow` = step-2 fields + `check_source` + `rate_label` (§7.4); `cik` is on every row (DIL M-6).

### 5.3 F1b — CIK → bonds: `GET /api/fi/ciks/{cik}/bonds?…`

As F1 with one CIK (10 digits), for unlinked filers (DQ-2..DQ-5, PepsiCo Singapore after R-1). Step 1 is the `bond_issuer_link` PK read; `has_bond_link` = the row exists. `entity_id: null`.

### 5.4 F2 — bond detail: `GET /api/fi/bonds/{accession_number}/{tranche_seq}`

1. Gate. 2. `bond_issuance` PK; 404 if absent or not served (§5.1). 3. `bond_issuer_link` PK by the row's **own** `cik`. 4. If `entity_id` is set, `entity_master` PK via R3. 5. If `instrument_key` is set: `SELECT COUNT(*) FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' AND parse_confidence >= 60` and `SELECT COUNT(DISTINCT cik) …` (`idx_bi_instrument`; a handful of reads) for "Also filed in N other filing(s)" (DIL N-1) and N8-3.

**Response:** `{ data_type, gate, bond: BondRow + {parser_version, ingested_at, other_filings}, filer: {cik, issuer_name}, issuer: NavLink }`. `issuer` is a 007 NavLink with `source: "sec_bond"`, `source_table: "bond_issuer_link"`, `asset_type: "DBT"`, band per 008 §8.1 (cik 95 high, lei 85 medium, manual 100 high, unmatched → `unmatched`); if the key spans more than one CIK, the state is `ambiguous`. The LEI is only the linked entity's `entity_master.lei` (DIL M-8).

### 5.5 F3 — directory and coverage: `GET /api/fi/coverage`

```sql
SELECT cik, issuer_name, entity_id, link_method, confidence, last_polled_at FROM bond_issuer_link;   -- ≈ 30 rows
SELECT cik, COUNT(*) AS finals, MAX(filing_date) AS latest_filing
FROM bond_issuance WHERE filing_status = 'final' AND parse_confidence >= 60 GROUP BY cik;
SELECT COUNT(*) FROM (SELECT instrument_key FROM bond_issuance
  WHERE filing_status = 'final' AND parse_confidence >= 60 AND instrument_key IS NOT NULL
  GROUP BY instrument_key HAVING COUNT(DISTINCT cik) > 1);          -- N8-3, served-row rule (DIL N-3)
```

**Response (open only):** `{ data_type, gate, issuers: [{cik, issuer_name, entity_id, link_method, band, finals, latest_filing, last_polled_at}], totals: {issuers, linked, unmatched, finals}, multi_cik_keys, as_of }`. Freshness: per issuer `last_polled_at` and `latest_filing`; globally `MAX(last_polled_at)`. The Ops run record is not read. Counts and freshness can lag a runner run by up to 1 h if the cache works (§5.7; Architect N-9); the freshness tooltip says "Updated within the last hour".

### 5.6 F4 — maturity ladder: `GET /api/fi/issuers/{entity_id}/ladder` (first cut, §11; DIL M-9)

Per linked CIK in one batch (same identity rule and 10-CIK cap as F1):
```sql
SELECT substr(maturity_date,1,4) AS y, currency, instrument_key, accession_number, tranche_seq, principal_amount
FROM bond_issuance
WHERE cik = ? AND filing_status = 'final' AND maturity_date >= ?
ORDER BY maturity_date, accession_number, tranche_seq;            -- idx_bi_cik_final_key range, no temp B-tree
```
The Worker drops rows under 60 and aggregates per year:
- **`securities`** = distinct securities, keyed by `instrument_key` when present, else `(accession_number, tranche_seq)`. Reopenings and the D-3 duplicate count once.
- **`principal_usd`** = the sum for USD securities that appear in **one** filing only. Securities filed more than once are counted in `reopened` and their principal is left out.
- **`other_currencies`** = counts by currency.

### 5.7 Caching (Architect M-5, M-6)

| Route | Cache |
|---|---|
| F3, F4 | Worker Cache API, **key = URL + gate `state` + gate `changed_at`** (both from the one gate read; no extra cost), TTL 1 h. Every gate flip changes the key, so a pre-incident open body can never come back after a close and reopen. Browser `Cache-Control: public, max-age=60`. Responses carry a diagnostic header `x-fi-cache: hit|miss`. |
| F1, F1b, F2 | No Worker cache; `Cache-Control: public, max-age=60`. |
| Gate closed or tables missing | `Cache-Control: no-store`; never written to the cache. |

The gate is always read before the cache, so a closed gate never serves a cached open body (Architect Q8).

**Cache proof (M-6):** `meridian-entities-api` runs only on `*.workers.dev`, where Cloudflare does not promise Cache API operations. **T-F10 calls F3 twice and records `x-fi-cache`.** If the second call is not a `hit`, the cache is treated as absent: §6's **uncached budget** applies (planned figure), and F4 stays first in the §11 cut order. The routes behave correctly either way.

### 5.8 Errors

| Case | Status / body | 010 shows |
|---|---|---|
| Bad `limit` / cursor / CIK / accession | 400 `{error}` | "That link isn't valid." |
| More than 10 CIKs | 422 `{error:'too_many_ciks'}` | "Bond data unavailable for this issuer." |
| Entity gone / redirect loop | 404 / 409 as 007 §6.3 | 007's gone page / notice |
| Bond not found or not served | 404 `{error:'not_found'}` | "This bond isn't available." |
| Tables missing | 200, `coverage.available = false` | "Fixed Income data isn't available yet." |
| Gate closed | 200, `gate: 'closed'` (§4.2) | §7.5 notice |
| Gate read error or other D1/Worker error | 500 JSON | "Couldn't reach Corporate Atlas." + Retry |

## 6. Read budget and three-point check

| Query | Index / plan | Reads per execution |
|---|---|---|
| Gate | `fi_serving_gate` INTEGER PK (P-F4) | 1 |
| F1 step 1 | `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)` (P-B2) | 1–3 (≤ 10 CIKs) |
| F1 step 2 (per CIK) | `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND …)`, no temp B-tree (P-B1) | ≤ 2 × 26 |
| F1b step 1 | `bond_issuer_link` PK | 1 |
| F2 | PKs + R3; `idx_bi_instrument` counts (P-F1) | ≤ 15 |
| F3 issuers | `SCAN bond_issuer_link` (≈ 30 rows) | ≈ 30 |
| F3 per-CIK counts | `SCAN … idx_bi_cik_final_key` + temp B-tree for GROUP BY (P-F2) | ≈ 2.5 × 633 ≈ 1.6k |
| F3 N8-3 | `idx_bi_instrument` + temp B-tree | ≈ 2.5 × 276 ≈ 0.7k |
| F4 (per CIK) | `SEARCH … idx_bi_cik_final_key (cik=? AND maturity_date>?)`, no temp B-tree (P-F3) | ≤ 2 × the issuer's outstanding finals (≤ 1.3k worst) |
| R1f (gated) | gate PK + `idx_bi_instrument` DISTINCT probe + `bond_issuer_link` PK | + 3 |
| PepsiCo check | PKs + `idx_holdings_cusip` (§4.4) | 4 expected, ≤ 12 |

No single execution exceeds ≈ 2.4k (directory, uncached), far below 50k.

**Per screen:** one-CIK issuer view ≈ gate 1 + R3 1 + step 1 1 + step 2 ≤ 52 = **≤ 55**; issuer with no CIK = **3**; bond detail **≤ 16**; directory **≤ 2.4k**; ladder **≤ 1.3k**.

**Daily planning figures (Architect M-6):**
- **Uncached (planned until T-F10 proves hits):** 300 issuer views × (55 + up to 1.3k ladder) + 300 details × 16 + ≈ 100 directory calls × 2.4k ≈ **0.6–0.75M reads/day worst** (≈ 12–15 % of the 5M cap).
- **Cached (if proven):** ≈ 0.25M/day worst.
- **Writes: 0** from routes. Operator writes: gate migration ≈ 3; each flip 1.

**No new cron, Worker, LaunchAgent or index.** Plan checks: P-B1, P-B2 (008) and P-F1 (F2 PK + counts), P-F2 (F3, confirm ≤ 2.4k), P-F3 (F4, no temp B-tree), P-F4 (gate PK), all EXPLAIN-only in the build (T-F8).

## 7. 010 — Fixed Income UI in `ma-entities.js`

### 7.1 Surfaces and routes

| Surface | Route | Opens as |
|---|---|---|
| **Bonds** section | none (inside `#/entity/{id}`) | A section on the 007 issuer layer, after "Linked instruments" |
| **Bond detail** | `#/bond/{accession_number}/{tranche_seq}` | A 007 layer |
| **Fixed Income directory** | `#/fi` | A 007 layer, from one nav link "Fixed Income" (Founder Q1) |
| **Unlinked filer** | `#/fi/cik/{cik}` | A 007 layer listing F1b |

Router change (`index.html`): `parse()` also accepts `fi`, `fi/cik/{10 digits}` and `bond/{accession}/{seq}` (accession `\d{10}-\d{2}-\d{6}`, seq a positive integer). 007 §3.3 is otherwise unchanged. **The bond route identifies a filing-tranche record, not an instrument** (DIL N-1, Q4): its value never appears as an `instrument_key`, in NavLink `identifiers`, or in any written table.

### 7.2 Bonds section (issuer layer)

- `_loadIssuerBonds(entityId, root)`, same shape as `_loadLinkedInstruments`, via `data_entitiesGet`.
- **Hidden** when `has_bond_link` is false (most entities). **Gate closed and `has_bond_link` true:** only the §7.5 quality-check notice and the disclosure (DIL M-4).
- Header: "Bonds · SEC issuance data"; freshness line "Last checked with SEC {date} · latest filing {date}".
- **Maturity ladder (F4):** one bar per year, height = distinct securities; label "{n} securities"; "USD {principal} (single-filing securities)" in small text; "{k} reopened" and other-currency counts under the bar. No FX. Plain HTML/CSS bars. **Counts-only fallback** if the reviewers or the build prefer (DIL M-9 option).
- **Table**, 25 a page, "Show 25 more ↓" while `next_cursor` is set, in maturity order: Maturity · Coupon / spread · Type · Principal · Seniority · Tranche · Filed · confidence chip ("High · 95", amber "Check source · 75").
- When the entity has more than one CIK, each row also shows "Filed by {issuer_name}" (DIL M-6).
- "Show matured" toggle (`include_matured=1`).
- Each row opens the bond detail layer with `from=entity:{id}:{page}`.

### 7.3 Bond detail layer

- **Title:** `tranche_label`, unless it matches `PROSPECTUS|SUPPLEMENT|Dated` or is longer than 120 characters (D-2), in which case the generated title "{coupon} {Type} due {maturity}" is used (DIL N-5).
- **Terms:** principal + currency, coupon or benchmark + spread, rate type, maturity, seniority, security class, form type, filing date, accession number, ISIN/CUSIP when present (placeholders hidden, 007 BR-2).
- **"Also filed in {n} other filing(s)"** when `other_filings > 0` (reopenings; DIL N-1).
- **Source:** "View filing on SEC.gov" → `source_url`, new tab, `rel="noopener noreferrer"`.
- **Quality:** "Parse confidence {n}" with the chip; for 60–79, "Check the filing: some terms were parsed with lower confidence." Parser version and ingest date in small text.
- **Filer and issuer (DIL M-8, N-6):**
  - The **filer CIK shown is the bond's own `cik` from `bond_issuer_link`**, never `entity_master.cik` (entity 2289's is wrong, DQ-1).
  - Linked filer: the NavLink candidate row (007 `_navCandidateHtml`) → "Open issuer →". The LEI shown is only the linked entity's `entity_master.lei`.
  - Unmatched filer: "Issuer not linked to Corporate Atlas yet · {issuer_name} (CIK {cik})" → `#/fi/cik/{cik}`. **No LEI is shown**, even when GLEIF has one.
  - **No guarantor** is shown or derived in v1.
- "View instrument" (007 card) only when `instrument_key` is set.

### 7.4 Labels (honest terms)

| Field | Rule |
|---|---|
| Rate type | `fixed` → "Fixed coupon" (never "fixed for life"; reset notes are stored as `fixed`); `floating` → "Floating"; `fixed_to_floating` → "Fixed-to-floating" |
| Coupon / spread | Fixed "5.850%"; floating "{benchmark} + {spread} bp"; floating with NULL spread "{benchmark or 'Floating'} · spread not parsed — see filing" |
| Principal | "$1,250,000,000" / "€750,000,000"; NULL "—" |
| Seniority | As stored; NULL → **"Not parsed — see filing"** (DIL N-7) |

### 7.5 States and copy

| State | Copy |
|---|---|
| Disclosure (every FI surface) | "Issuance and reference data from SEC filings. Not live prices or yields." |
| Gate closed (`has_bond_link` true, directory, CIK layer, detail) | "Bond data is being quality-checked and isn't shown yet." |
| Tables missing | "Fixed Income data isn't available yet." |
| No outstanding bonds | "No outstanding bonds in Meridian Atlas for this issuer." + "Show matured" |
| Too many CIKs | "Bond data unavailable for this issuer." |
| Outage / 5xx | "Couldn't reach Corporate Atlas." + ↻ Retry |
| Not found | "This bond isn't available." |
| Unlinked filer | "Issuer not linked to Corporate Atlas yet." |

Machine codes never show. 375 px: the table becomes stacked rows (maturity + coupon, then principal + chip), with no horizontal page scroll.

### 7.6 Directory (`#/fi`)

From F3 (open gate only): a client-side filter (name or CIK), then one row per filer: name, link chip (Linked / "Not linked yet"), final bond count, latest filing, last checked. **The CIK shown is `bond_issuer_link.cik`** (DIL M-8). Linked rows open `#/entity/{id}`; unlinked rows open `#/fi/cik/{cik}`. Header totals "{issuers} issuers · {finals} bonds · {unmatched} not linked yet". Gate closed: the notice and the disclosure only.

## 8. Deploy shape and release gate

- **One Worker deploy** of `meridian-entities-api`, **Thu 29 Oct**, built on the committed 003 retirement `entities-api.js` (§0). Contents: F1, F1b, F2, F3, F4, `fi_json()`, gate read, gated R1f. The gate table is migrated **closed** first, so the deploy serves no bond data. **Record the pre-deploy version id** (the version live just before 009: the deploy-5 retirement version if WED28.ENG1 deployed it, else the version then live) and the new version id.
- **Front ends (007 + 010)** ship in the **Mon 2 Nov October site release** (Pages source switch, ML-1026-1).
- **Release gate (Architect M-2):** the Mon 2 site release may ship **only if the gated R1f (the 009 deploy) is live** and the §4.4 re-check is PASS. If the 009 deploy is not live by then, a one-constant R1f switch-off must be deployed first, or the release waits. Until Mon 2, R1f's ungated exposure is API-only (Pages still serves `September-2026/docs`).
- The gate opens separately (§4.1, §4.5). The front end works with the gate closed (notices only).

## 9. Tests

| # | Test | Type |
|---|---|---|
| T-F1 | Gate: missing table/row, `closed`, garbage → closed bodies with **no `cik`, `issuer_name`, count or bond field**; `has_bond_link` correct; other D1 error → 500; `open` → rows | Worker unit (node:sqlite shim) |
| T-F2 | F1 merge: 3 CIKs; limits 2/25/100; no gaps or repeats; **a CIK whose fetched tail extends past the page cut** (Architect M-7); dropped (< 60) rows; a page short of `limit` with `next_cursor` set; `include_matured` 0/1; null cursor at the end; bad cursor/limit → 400; 11 CIKs → 422 | Unit |
| T-F3 | F1 R3: merged id → survivor + `redirect`; gone → 404 | Unit |
| T-F4 | F2: PK hit; not-served → 404; unmatched filer (no LEI); multi-CIK key → `ambiguous`; `other_filings`; `check_source` | Unit |
| T-F5 | F3/F4: counts with the `≥ 60` rule; N8-3; ladder distinct securities incl. a reopened key and the D-3 duplicate; cache key changes on every gate flip (close → reopen never serves the pre-close body) | Unit |
| T-F6 | R1f: closed → no `sec_bond`; open + 1 CIK → candidate; open + 2 CIKs → no candidate and `source_conflict`; < 60 excluded; missing tables tolerated; 007's 58 Worker tests still pass | Unit |
| T-F7 | `data_type` on every success body; `no-store` when closed; 007 R1–R4 response headers byte-identical (003 differential test) | Unit |
| T-F8 | EXPLAIN P-B1, P-B2, P-F1..P-F4 and the §4.4 plans (live D1, EXPLAIN only) | Build lane |
| T-F9 | Front end on fixtures: section hidden / closed / rows; ladder; paging incl. a short page; detail (title rule, filer CIK, no LEI for unmatched, reopenings line); directory; CIK layer; every §7.5 line; 5xx → Retry; Back closes one layer; 375 px | Browser preview |
| T-F10 | Live smoke after the deploy, gate closed: F1/F1b/F2/F3/F4 return closed bodies with none of the withheld fields; R1 for a bond key returns no `sec_bond`; **F3 called twice, `x-fi-cache` recorded (M-6 proof)**. Re-run with the gate open right after it opens. | ≤ 12 Worker calls each time |

## 10. Build plan by day (Option C)

| Day | Work | Gate to the next step |
|---|---|---|
| **Wed 28** | Spec rev 1 (this). LANE-1-ENG: commit list → **003 retirement commit (009 base)** → deploy 5 if allowed. LANE-8-ENG: 008 PepsiCo fix (R-1) + AC12 re-check (no gate opening). Main Lane: put 008's `migrations/008-bonds.sql` and `App/Corporate Atlas/bonds/` on the commit list (Architect N-7). | Retirement commit and its `entities-api.js` hash reported (fills §0) |
| **Thu 29** | 009 build on the retirement base: F1–F4, `fi_json()`, gate read, gated R1f; T-F1..T-F7. Then, in order: **gate migration (closed)** → **§4.4 PepsiCo check** → **T-F8 EXPLAIN** → **deploy** (pre-deploy version id recorded) → **T-F10** (closed, with the cache proof). Architect code review of 009. If AC12 has passed: §4.5 evidence → open instruction (LANE-11) → Founder acknowledgement → engineering lane opens the gate → T-F10 open. | Deploy live and closed; smoke passes |
| **Fri 30** | 010 front end: router routes; Bonds section + ladder; bond detail; directory; CIK layer; T-F9 on fixtures. | Preview passes |
| **Sat 31** | Build review (UX + Data-Identity, BR-style) on fixtures, or live if the gate is open; fixes. Worker fix only if a review finds one. | Review READY |
| Sun 1 | Doc work only. | — |
| **Mon 2 Nov** | After 08:00Z: §4.4 re-check; confirm gated R1f live (§8 release gate); **October site release** with 007 + 010 front ends; Founder UAT. Gate opening from today on needs the Founder's approval. | UAT pass |
| Tue 3 | Go-live sign-off, Release Ledger. | — |

**If AC12 has not passed by Mon 2,** 010 still ships with the notices; the gate opens later with the Founder's approval and no deploy.

## 11. What to cut if the week slips (in order)

1. **F4 maturity ladder** (table only). Also the first cut if the cache proof fails (M-6).
2. **"Show matured" toggle.**
3. **F1b + CIK layer** (unlinked filers shown in the directory as "Not linked yet", with no click-through).
4. **F3 directory `#/fi`** — fails scope v2's "first-class destination"; needs the Founder.

Out of v1: cross-issuer bond search; rate-type and seniority filters (November).

## 12. Rollback (Architect M-4; DIL M-1)

**Rollback target:** the pre-009 version id recorded at the Thu 29 deploy (the 003 retirement version or whatever was then live), never the pre-003 version.

| Situation | Action |
|---|---|
| **Data-only incident** (a wrong row, a bad count) | **Close the gate** (§4.1). Never roll the Worker back for a data problem. |
| Worker defect, **before** AC12 has passed and R-1 is applied | Do **not** roll back below the 009 version once the front end is live (Mon 2): a rollback restores the **ungated** R1f, which closing the gate cannot reach. If a rollback is unavoidable, deploy the R1f switch-off constant with it, or ship a forward fix instead. Before Mon 2, a rollback is acceptable (exposure API-only) but must be followed by the switch-off or a re-deploy the same day. |
| Worker defect, **after** AC12 has passed and R-1 is applied | Rollback to the recorded version is acceptable: the wrong-issuer rows are gone and no served row is under 60 (C2). |
| Front end defect | Before release: don't ship it. After release: revert the 010 changes and run `generate-docs.mjs`. The Worker alone is invisible to users. |
| Gate table | Left in place (fails closed; 1 row). |

## 13. Acceptance criteria

- **AC-F1 Gate.** With the gate closed or missing, no route returns a bond row, count, CIK or issuer name, `has_bond_link` is the only bond-derived field, and R1 returns no `sec_bond` candidate (T-F1, T-F6, T-F10).
- **AC-F2 Issuer bonds.** For a linked issuer, outstanding finals in maturity order, 25 a page, no gaps or repeats across pages and CIKs, cursor per §5.2 (T-F2).
- **AC-F3 Detail.** Each bond opens a detail layer with terms, parse confidence, SEC link and the bond's **own filer** as issuer, following 007 states and R3 (T-F4).
- **AC-F4 Honest labels.** No "fixed for life"; floating rows without a spread say so; NULL seniority says "Not parsed"; 60–79 rows show "Check source"; boilerplate labels are replaced (§7.3–§7.4).
- **AC-F5 Disclosure.** Every FI surface shows the not-live-pricing line; every response carries `data_type` (T-F7, T-F9).
- **AC-F6 Freshness.** Every issuer shows "Last checked with SEC" and "latest filing"; nothing says "live".
- **AC-F7 Directory.** With the gate open, `#/fi` lists all 30 seed filers; linked ones open the issuer, unlinked ones the CIK layer.
- **AC-F8 Provenance.** The CIK shown is always `bond_issuer_link.cik`; an unmatched filer shows no LEI; no guarantor is shown (DIL M-8, N-6).
- **AC-F9 States.** Every §7.5 state renders its copy; a 5xx shows Retry (T-F9).
- **AC-F10 Navigation.** Back closes exactly one layer from bond detail, directory and CIK layers; cold deep links land on Home underneath (007 N7-13).
- **AC-F11 Budget.** Every plan matches §6 before the deploy; no single execution over 50k; the cache proof is recorded and the planned daily figure is chosen from it (§6).
- **AC-F12 Release gate.** The Mon 2 site release ships only with gated R1f live and §4.4 PASS (§8).

## 14. Founder questions (decided 25 Oct — not re-opened)

| # | Question | Decision |
|---|---|---|
| **Q1** | Destination: a "Fixed Income" nav link opening `#/fi` as a 007 layer? | **Yes.** Full FI panel with cross-issuer search in November. |
| **Q2** | Gate: one-row Entities-domain table `fi_serving_gate`? | **Yes.** Created closed; opened on AC12 evidence; also the kill switch. |
| **Q3** | Stop R1f's exposure before a front end can reach it? | **Yes.** Now the §4.4 pre-deploy check + the §8 release gate + gated R1f in the Thu 29 deploy. |

## 15. Review questions — answered (Tue 27)

| Q | Answer | Where |
|---|---|---|
| 1–3 (UX) | Not reviewed by a UX lane before rev 1; to the Sat 31 build review | §10 |
| 4 | Yes: the bond route is a filing-tranche id, not an instrument key (DIL N-1) | §7.1 |
| 5 | Yes: `≥ 60` in the Worker, cursor per §5.2 (DIL N-2, Architect M-7) | §5.2 |
| 6 | Withhold counts while closed (DIL N-3) | §4.2 |
| 7 | Data-Identity Lead + Founder acknowledgement; an engineering lane executes (DIL N-4) | §4.1 |
| 8 | No closed-gate leak; stale-open path closed by the `changed_at` key (Architect M-5) | §5.7 |
| 9 | 1 h acceptable with M-5; the cache may be absent on `workers.dev` (M-6) | §5.7, §6 |

## 16. Decision trace

| Item | Decision | Source |
|---|---|---|
| Domain of new table | `fi_serving_gate`: Entities; owner Entities Product Lead (Data-Identity Lead lane) | §3; Architect N-2 |
| Bond tables | Read only, 008 §8 | 008 §16 |
| Served rows | `final` and `parse_confidence ≥ 60`; 60–79 flagged | 008 §14.1, §16 |
| Issuer identity | The bond's own filer CIK's entity; no guarantor | DIL M-6, M-8, N-6 |
| AC12 | Ship closed; open on §4.5 evidence; R1f gated with the 2-CIK rule | DIL14 §5; DIL M-5; §4 |
| Calendar | Option C: deploy Thu 29; front ends Mon 2 Nov; go-live Tue 3 | ML-1025-5, ML-1026-1, ML-1027-2 |
| Surface | Issuer layer + `#/fi` layer | Founder Q1 |

## 17. Changes in rev 1

### MUST-FIX (all 16 folded)

| Item | Change | Section(s) |
|---|---|---|
| **Architect M-1** Option C re-plan; build on the committed retirement `entities-api.js` | Header, §0 base row (placeholder for the WED28.ENG1 hash), §8 Thu 29 deploy, §10 day plan; "Sat 31 last deploy" and "Sun 1 sign-off" removed | §0, §4.1, §8, §10 |
| **Architect M-2** front-end release gate | Mon 2 release only with gated R1f live (else the switch-off first) | §8, §10, AC-F12 |
| **Architect M-3** PepsiCo check: CUSIP index only, no ISIN scan | Merged into one definition with DIL M-3: S3 uses `idx_holdings_cusip`, never ISIN or `instrument_key` | §4.4 |
| **Architect M-4** rollback rule | Data incidents → close the gate; no rollback below 009 once the front end is live before AC12/R-1; after them rollback OK | §12 |
| **Architect M-5** cache key | Key = URL + gate `state` + `changed_at` | §5.7, T-F5 |
| **Architect M-6** Cache API on `workers.dev` | `x-fi-cache` proof in T-F10; uncached budget 0.6–0.75M/day as the planned figure; F4 first cut | §5.7, §6, §9, §11 |
| **Architect M-7** multi-CIK cursor | Cursor = last row consumed in merged order; stop rule; T-F2 tail-past-cut case | §5.2, T-F2 |
| **DIL M-1** stale code baseline | Same as Architect M-1; rollback target = recorded pre-009 version | §0, §8, §12 |
| **DIL M-2** calendar and gate-opening window | Opening by Mon 2 with acknowledgement, after Mon 2 with Founder approval; closing any time | §4.1, §8, §10 |
| **DIL M-3** PepsiCo check premise and pass/fail | Premise corrected (keys NULL; C4); S1/S2 PK checks with exact PASS/FAIL, merged with Architect M-3 | §2 C4, §4.4 |
| **DIL M-4** closed-gate contradiction | Closed F1/F1b return only `has_bond_link`; section shows the notice only when true; tests assert no withheld fields | §4.2, §5.2, §7.2, T-F1, T-F10 |
| **DIL M-5** R1f `LIMIT 1` CIK pick | `SELECT DISTINCT cik … LIMIT 2`; 2 CIKs → no candidate, `source_conflict` | §4.3, T-F6 |
| **DIL M-6** multi-CIK vs guarantor rule | Identity rule stated; parent/subsidiary example struck; "Filed by" per row | §5.2, §7.2 |
| **DIL M-7** gate statement guard, read-back, evidence | Guarded UPDATE, `changes = 1`, read-back, full SHA-256s, executor vs authority | §4.1 |
| **DIL M-8** CIK/LEI provenance | Filer CIK from `bond_issuer_link`; LEI only via the linked entity; none for unmatched | §5.4, §7.3, §7.6, AC-F8 |
| **DIL M-9** ladder double-count | Distinct securities; principal only for single-filing securities; counts-only fallback | §5.6, §7.2, T-F5 |

### NOTES

| Note | Disposition | Section |
|---|---|---|
| Architect N-1 non-missing-table D1 error → 5xx | Accepted | §4.1, §5.8 |
| Architect N-2 owner label | Accepted | §3 |
| Architect N-3 re-pin to the committed retirement file | Accepted (placeholder until WED28.ENG1 reports) | §0 |
| Architect N-4 R1f N8-3 | Accepted, via DIL M-5 | §4.3 |
| Architect N-5 CIK cap | Accepted (≤ 10, else 422) | §5.2, §5.6, §5.8 |
| Architect N-6 separate response helper | Accepted (`fi_json()`, differential test) | §5, T-F7 |
| Architect N-7 008 migration/runner untracked | Accepted as a Wed 28 commit-list prerequisite (Main Lane) | §10 |
| Architect N-8 gate-flip calendar; T-F10 again when open | Accepted | §4.1, T-F10 |
| Architect N-9 1 h lag | Accepted (freshness tooltip) | §5.5 |
| DIL N-1 bond route is a record id; reopenings line | Accepted | §5.4, §7.1, §7.3 |
| DIL N-2 short pages keep "Show more" | Accepted | §5.2, §7.2 |
| DIL N-3 withhold counts; N8-3 filter | Accepted | §4.2, §5.5 |
| DIL N-4 separation of roles | Accepted | §4.1 |
| DIL N-5 boilerplate tranche titles | Accepted | §7.3 |
| DIL N-6 no guarantor in v1 | Accepted | §7.3, §1 |
| DIL N-7 seniority copy | Accepted | §7.4 |
| DIL D-2, D-3 (new 004 tickets) | Deferred to 004/008 (data fixes); 009 handles them on display (§7.3 title rule, §5.6 distinct securities) | — |
| UX review questions 1–3 | Deferred to the Sat 31 build review | §10, §15 |
