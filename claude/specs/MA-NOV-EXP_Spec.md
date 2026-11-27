# MA-NOV-EXP — Exposure-to-company research — Specification v1

```text
PACKET:     MA-NOV-EXP.SPEC (run r-20261111T195830Z-bc14, interactive)
AUTHORS:    Entities Product Lead + Architect
SCOPE:      meridian_atlas_november_content_scope_and_requirements.md §3 (EXP-01–12), §6 — c16c8e19…5a03
INPUTS:     MA-NOV-SA1_Report.md 419e4337…3aea · MA-NOV-BQ2_Report.md 9b133cde…5102 · code at f215681
DECISIONS:  NML-1110-6 (scope as recommended) · NML-1111-3 ("go, spec first")
STATUS:     DRAFT, for Founder spec approval. Nothing is built, deployed or run by this document.
```

Measured numbers in this spec come from the 8 sizing statements in `claude/packets/MA-NOV-EXP.SPEC_Report.md` §2 (marked **[M]**). Estimates are marked **[E]**.

---

## 1 Problem, users, goals, non-goals

**Problem.** A user who holds a few ETFs and some shares cannot see which companies they are really exposed to. Today the site offers ETF pair overlap (instrument-level, 2 ETFs only) and "which ETFs hold this company" on the company page. Nothing combines several inputs with allocations, and nothing says how much of the answer is unknown.

**Users.** Self-directed investors and researchers using Meridian Atlas without an account.

**Goals.**
- G1. From up to 10 inputs (supported ETFs and direct equities, with allocation %), show combined company exposure, split into direct and ETF-derived (EXP-01–05).
- G2. Every number reconciles to 100% of the portfolio. Unknown, unmapped, unsupported and unallocated parts are shown as their own lines. Nothing is redistributed (EXP-02, EXP-07).
- G3. Identity is honest. Instruments go to issuers only through recorded mappings, with the mapping tier shown, and nothing is merged by name at run time (EXP-06).
- G4. Every result has dates: each ETF's holdings month and filing date, and a comparison with the previous stored month (EXP-08).
- G5. From any company in the result, the user can go to Corporate Atlas and the evidence it has (ETF holders, 13F, bonds, instruments). Each source is labelled with its universe and period (EXP-09, EXP-10).
- G6. Calculations are checked against hand-worked examples, including incomplete-data cases (EXP-12).

**Non-goals (scope §6 and decisions).** No persistence or saved portfolios in November. No account or brokerage connection. No performance, backtesting, optimisation, tax lots or recommendations. No new corporate platform: Corporate Atlas is the spine. No geography or asset-class expansion. No new ingestion. Holdings cadence (C1) is handled by its own CRs, not here.

## 2 Journey, screens and states

**Route.** `#/exposure`. It opens as a nav layer (`_navOpen('exposure', …)` in `App/ma-entities.js`), so Back and deep links behave like `#/entity/…`. Inputs live in the URL hash only (`#/exposure?i=ETF:VXUS:50,EQ:2191:15`), with no storage, so a result can be bookmarked without any persistence.

**Screen A — Inputs (EXP-01, EXP-02, EXP-11).**
- An "Add ETF" picker built from `/api/etf-list` (existing). Each ETF shows a support badge: *holdings available (month)* or *not supported: no stored holdings*.
- An "Add company (direct holding)" picker built from `/api/entities/search` (existing). This is issuer-level input (see decision D3).
- Each row has a label, an allocation % field, an edit control and a remove control. A running total is shown with its status: *OK (100%)* · *under (x% unallocated)* · *over: fix before results*.
- Duplicate rows are blocked with a message and an explicit "Combine into one row (a+b%)" button.

**Screen B — Results.**
1. **Header strip:** inputs and allocations; *Holdings dates:* one chip per ETF (`VXUS · Apr 2026 · filed 2026-06-2x`); a mixed-months warning when they differ; a stale warning when a month is more than 3 months older than the newest stored month.
2. **Reconciliation bar (EXP-07):** mapped companies · unmapped holdings · no-identifier holdings · fund residual (not reported as holdings) · unsupported inputs · not loaded · unallocated. The parts add to 100.00%.
3. **Top companies table (EXP-03–06):** company · combined % · direct % · via ETFs % · inputs (count, with expand) · mapping confidence (High / Medium / Low, heuristic = Low) · link. Sortable. A filter "hide low-confidence" changes the display only and moves those rows into a visible "low-confidence (hidden)" line. It never deletes them.
4. **Shared exposure (EXP-05):** companies reached by 2 or more inputs, plus the pairwise ETF overlap at company level for each ETF pair.
5. **Contribution drill-down (EXP-04):** for one company, one line per input: allocation × fund weight = contribution, and the tier of each holding row.
6. **Gaps (EXP-07, EXP-11):** the largest unmapped holdings by weight (name, identifier, weight), unsupported inputs and why, and load errors.
7. **Period comparison (EXP-08):** a toggle "Compare with previous stored month". It shows Δ per company and both months per ETF.
8. **Evidence links (EXP-09/10):** see §6.

**States (EXP-11).**

| State | Trigger | Shown |
|---|---|---|
| Empty | 0 inputs | Short explanation and the two pickers; no results area |
| Invalid | total > 100, a duplicate row, an allocation ≤ 0 or non-numeric | Inline field errors; results hidden; the message names the rule |
| Loading | look-through calls in flight | Per-input spinner; results render once every input has settled |
| Unsupported input | ETF has no stored complete holdings, or the symbol is unknown | Row badge plus a reason; its allocation goes to the *unsupported inputs* line |
| Partial failure | one look-through call fails (5xx or timeout) | That row shows *not loaded – retry*; its allocation goes to *not loaded*; the other inputs still compute |
| Total failure | every call fails, or the network is down | Error panel with retry; no numbers |
| Stale / mixed months | as in Screen B §1 | Warning chip; numbers still shown |
| No previous month | an ETF has only one stored month | Comparison shows "no earlier stored month" for that ETF |
| Mobile (≤ 600 px) | — | Table collapses to company + combined %, with the rest in an expandable row; pickers stack |

## 3 Calculation (EXP-02 – EXP-07)

All arithmetic runs **client-side** in pure functions (`exp_validate`, `exp_compute`) in `App/ma-entities.js`. Values use full double precision; the display shows 2 dp; the reconciliation tolerance is 0.01 percentage points.

### 3.1 Input validation (EXP-02)
- Allocation `a_i`: a number, `0 < a_i ≤ 100`, at most 2 dp. Otherwise the row error is "Allocation must be between 0.01 and 100".
- Total `A = Σ a_i`.
  - `A > 100.005` → **blocked**: "Allocations total A% — reduce by (A−100)%".
  - `A < 99.995` → allowed (decision D2); the line *unallocated = 100 − A* is shown.
  - The tool **never** rescales allocations.
- Duplicate: two ETF rows with the same ticker, or two equity rows with the same `entity_id` after redirect → **blocked** until the user removes one or presses Combine.
- An ETF and a direct holding of the same company is **not** a duplicate. It is the direct + indirect case.
- At most 10 inputs (budget, §4.5).

### 3.2 Identity rule (EXP-06), used by the route and by gate3 v2
For each holding row `h` of ETF `i` in month `m` (from `fund_holdings_monthly`, `snapshot_status='complete'`):
1. `key(h)` = `trim(isin)` if it is 12 characters long; else `'CUSIP:'||trim(cusip)` if 6 or more characters and not `000000000`; else `'TICKER:'||upper(trim(security_ticker))` if present; else **no identifier**. This is the same derivation as `gate1-instrument-seed.js deriveInstrumentKey`, without its `NAME:` branch. `gate2` never maps `NAME:` keys, so they count as no identifier.
2. `entity(h)` = `instrument_entity_map.entity_id` for `key(h)` (PK lookup: exactly one entity per instrument, so a holding cannot be counted twice). If that id is a `duplicate_id` in `entity_merge_redirect`, use `survivor_id` and note "merged record".
3. `tier(h)` = `instrument_entity_map.source` (`isin_tier1` · `openfigi_tier1` · `cusip_tier1` · `heuristic`). `band(h)` = `navBand(source, confidence)`: heuristic or < 70 → Low; 70–89 → Medium; ≥ 90 → High. This is the existing rule in `entities-api.js`.
4. A key with no map row means **unmapped**.

`entity_isin_map` is **not** used. Its PK is `(isin, lei)`, so one ISIN can fan out to several entities. It carries no tier and ignores merge redirects. Today's `gate3` pass 1 uses it, which is a defect (§5.2).

No name-based merging happens at run time. Two entity records for one real company (an unmerged duplicate, e.g. the +145 FIRDS rows) show as two rows. The UI marks a row "possible duplicate" **only** when the pair is in a recorded candidate list. November has no such list, so the mark is not shown (D9).

### 3.3 Formulas
Per ETF input `i`, with allocation `a_i` and fund-reported weights `w_h` (% of fund net assets, as reported, which may be negative):
- `T_i = Σ_h w_h` (reported total) · `M_i = Σ_{h mapped} w_h` · `U_i = Σ_{h unmapped} w_h` · `N_i = Σ_{h no-identifier} w_h` · `R_i = 100 − T_i` (fund residual: cash and other items not reported as holdings; it can be negative).
- `f_{i,e} = Σ_{h: entity(h)=e} w_h` (fund weight in entity `e`).
- **ETF-derived contribution:** `c_{i,e} = a_i · f_{i,e} / 100` (percent of portfolio).

Per direct equity input `j` with allocation `a_j` for entity `e_j`: `d_{e} = Σ_{j: e_j=e} a_j`.

- **Combined:** `E_e = d_e + Σ_i c_{i,e}` · **Direct:** `D_e = d_e` · **Indirect:** `I_e = Σ_i c_{i,e}`.
- **Inputs reaching e:** `k_e = |{i : c_{i,e} ≠ 0}| + |{j : e_j = e}|`. **Shared exposure** = companies with `k_e ≥ 2`.
- **Pairwise ETF overlap (company level, fund-weight basis):** `O_{i,i'} = Σ_e min(f_{i,e}, f_{i',e})`, over entities with both values > 0. This is a different measure from `/api/etf-overlap`, which is security-level, so the UI labels it "by company".
- **Confidence per company:** the lowest band over all holding rows that contribute to `e`. The portfolio line reads "x% of mapped exposure rests on Low-confidence mappings" = `Σ_{e: band=Low} I_e / Σ_e I_e`. Direct inputs are issuer-picked, so they carry no band.
- **Reconciliation (must hold within 0.01):**
  `Σ_e E_e + Σ_i a_i(U_i + N_i + R_i)/100 + unsupported + not_loaded + unallocated = 100`, where `unsupported` and `not_loaded` are the sums of those inputs' allocations and `unallocated = 100 − A`.
- **Negative weights** (derivatives, shorts, cash offsets) are kept as reported, with no clamping. A company with `E_e < 0` is listed with a "net short / derivative" note.
- **Ambiguity:** heuristic-tier exposure is included, not hidden, and is always shown as Low (D8).

### 3.4 Worked example (fixture F1, hand-checkable)
Inputs: ETF **A** 50%, ETF **B** 30%, direct **X** 15%. A = 95% → unallocated 5%.

| ETF A (month 2026-04) | w | tier | ETF B (month 2026-02) | w | tier |
|---|---|---|---|---|---|
| X | 10 | isin_tier1 | X | 6 | openfigi_tier1 |
| Y | 8 | isin_tier1 | Y′ (separate entity record for Y) | 4 | isin_tier1 |
| Z | 5 | heuristic | Z | 12 | heuristic |
| W | 74 | cusip_tier1 | V | 70 | isin_tier1 |
| unmapped holding | 3 | — | (total reported 92 → R_B = 8) | | |

Contributions:
- A × 0.5: X 5.0 · Y 4.0 · Z 2.5 · W 37.0 · unmapped 1.5.
- B × 0.3: X 1.8 · Y′ 1.2 · Z 3.6 · V 21.0 · residual 2.4.

| Company | Direct | Via ETFs | Combined | Inputs | Confidence |
|---|---|---|---|---|---|
| W | 0 | 37.00 | **37.00** | 1 | High (90, cusip_tier1) |
| X | 15.00 | 6.80 | **21.80** | 3 | High |
| V | 0 | 21.00 | **21.00** | 1 | High |
| Z | 0 | 6.10 | **6.10** | 2 | **Low** (heuristic) |
| Y | 0 | 4.00 | **4.00** | 1 | High |
| Y′ | 0 | 1.20 | **1.20** | 1 | High |

- Reconciliation: companies 91.10 + unmapped 1.50 + residual 2.40 + unallocated 5.00 = **100.00** ✓.
- Shared exposure: X (3 inputs), Z (2). Y and Y′ are **not** merged.
- Low-confidence share: 6.10 / 76.10 = **8.02%** of ETF-derived exposure.
- Overlap O_{A,B} = min(10,6) + min(5,12) = **11.00%** (Y and Y′ do not count).
- Mixed months warning: A Apr 2026, B Feb 2026.

## 4 Data contract

### 4.1 Split, and why
- **Server (`meridian-entities-api`): per-ETF look-through only.** One ETF and one month in; that fund's company weights out. The result does not depend on any user's allocation, so it can be cached and shared by all users (Cache API).
- **Client: everything else** (validation, allocation, combination, shared exposure, reconciliation, comparison).
- Reasons:
  - (a) Allocations never leave the browser, so there is nothing to persist or protect.
  - (b) Workers Free allows 10 ms CPU per request. Aggregation is done in D1 (`GROUP BY`), and the result body is built in SQL (`json_group_array`), so the Worker passes one string through and does not loop over thousands of rows.
  - (c) The D1 read budget (5M/day) is protected by per-ETF caching, which a per-portfolio route could not use.
  - (d) Direct equities need no server call beyond the existing entity search.

### 4.2 Route R-EXP1
`GET /api/exposure/etf/{symbol}?month=YYYY-MM` (month optional; default is the latest complete month for that ETF). GET only, same CORS headers. It touches no writes.

**Queries** (≤ 4 D1 calls per request):
1. `SELECT ticker, name, series_id FROM etf_master WHERE ticker = ?` (PK SEARCH).
2. Month: `SELECT report_month FROM fund_holdings_monthly WHERE snapshot_status='complete' AND series_id=? ORDER BY report_month DESC LIMIT 2`. This returns the latest and previous months and reads 2 rows.
   - **Do not use a correlated `MAX(report_month)`.** Measured [M] Q6: it read every month of the series, 104,559 rows for 10,109 holdings. The `LIMIT` form read 3,320 rows in total for 1,231 holdings [M] Q7.
   - With `?month=`, check that month is one of the series' complete months (same index).
3. Look-through, as plan-checked [M] Q4: every step is a SEARCH (`idx_holdings_status_series_month`, `sqlite_autoindex_instrument_entity_map_1`, `entity_merge_redirect` rowid), plus a temp B-tree for GROUP BY:
   ```sql
   WITH h AS (SELECT weight_pct w, security_name, cusip, isin,
       CASE WHEN length(trim(isin))=12 THEN trim(isin)
            WHEN length(trim(cusip))>=6 AND trim(cusip)<>'000000000' THEN 'CUSIP:'||trim(cusip)
            WHEN trim(coalesce(security_ticker,''))<>'' THEN 'TICKER:'||upper(trim(security_ticker)) END k
     FROM fund_holdings_monthly WHERE snapshot_status='complete' AND series_id=?1 AND report_month=?2),
   r AS (SELECT h.*, m.source, m.confidence, m.entity_id raw_eid, COALESCE(rd.survivor_id, m.entity_id) eid
     FROM h LEFT JOIN instrument_entity_map m ON m.instrument_key=h.k
            LEFT JOIN entity_merge_redirect rd ON rd.duplicate_id=m.entity_id)
   SELECT json_object(
     'entities', (SELECT json_group_array(json_array(g.eid, em.name, g.w, g.n, g.tiers, g.minconf, g.redirected))
                  FROM (SELECT eid, ROUND(SUM(w),6) w, COUNT(*) n, GROUP_CONCAT(DISTINCT source) tiers,
                               MIN(CASE WHEN source='heuristic' THEN 0 ELSE confidence END) minconf,
                               MAX(raw_eid<>eid) redirected
                        FROM r WHERE eid IS NOT NULL GROUP BY eid) g
                  LEFT JOIN entity_master em ON em.entity_id=g.eid),
     'tiers', (SELECT json_group_object(t, json_array(n, w)) FROM
                 (SELECT COALESCE(source, CASE WHEN k IS NULL THEN 'no_identifier' ELSE 'unmapped' END) t,
                         COUNT(*) n, ROUND(SUM(w),6) w FROM r GROUP BY 1)),
     'unmapped_top', (SELECT json_group_array(json_array(security_name, k, w)) FROM
                 (SELECT security_name, k, w FROM r WHERE eid IS NULL ORDER BY w DESC LIMIT 25))) body
   ```
   `minconf` treats heuristic as 0, so the client band is Low.
   - **Single hop only:** a chained redirect (duplicate → duplicate) resolves one hop in SQL. The build packet adds a second `LEFT JOIN` hop and counts any row still pointing at a duplicate as `redirect_unresolved` in `tiers`. 013 chains are ≤ 3 hops (`NAV_MAX_HOPS`).
4. Snapshot dates: `SELECT filing_date, period_end, net_assets, holdings_count FROM fund_snapshot_monthly WHERE series_id=? AND report_month=?` (PK).

**Response 200**
```json
{
  "symbol": "EEM", "name": "…", "series_id": "S00000…",
  "report_month": "2026-02", "previous_month": "2026-01",
  "filing_date": "2026-04-2x", "period_end": "2026-02-28",
  "holdings_count": 1231,
  "tiers": { "isin_tier1": [135, 18.953], "openfigi_tier1": [160, 7.777], "cusip_tier1": [87, 2.651],
             "heuristic": [660, 65.881], "unmapped": [169, 6.403], "no_identifier": [20, -0.153] },
  "entities": [[2191, "Taiwan Semiconductor Manufacturing Co Ltd", 13.141, 3, "heuristic", 0, 0], …],
  "unmapped_top": [["…", "CUSIP:…", 0.41], …],
  "source": { "dataset": "SEC Form N-PORT holdings (meridian-holdings)", "weights": "percent of fund net assets as reported" },
  "computed_at": "ISO-8601", "contract": "exp-1"
}
```

**Errors**

| Status | Body `error` | When |
|---|---|---|
| 400 | `invalid_symbol` / `invalid_month` | Malformed input |
| 404 | `etf_not_found` | Ticker not in `etf_master` |
| 404 | `no_holdings` (with `reason: no_series_id` or `none_complete`) | Unsupported input (EXP-11), e.g. SPY and QQQ today [M] Q5 |
| 404 | `month_not_stored` | `?month=` not among the complete months |
| 422 | `too_large` | `holdings_count > 25,000` (none today; max 17,409 BND [M] Q3) |
| 500 | `internal` | Anything else; the client marks the input *not loaded* |

**Caching.**
- Cache API key = URL + `contract`. Edge TTL 24 h; browser `Cache-Control: public, max-age=3600`.
- A stored complete month does not change. Mapping and redirect updates land daily, so a cached body is at most 24 h behind the mapping. The response says so (`computed_at`), and the UI shows "mappings as of <computed_at date>".
- Errors are not cached, except a 404 `no_holdings`, which gets 1 h.

### 4.3 Tables read (no writes)
`etf_master` · `fund_holdings_monthly` · `fund_snapshot_monthly` (ETF domain, read-only) · `instrument_entity_map` · `entity_merge_redirect` · `entity_master` (Entities domain). The company page panels also read `entity_exposure_monthly` and `fund_exposure_coverage` (§5).

### 4.4 Row-read budget per call
Measured cost is about 2.7 rows per holding [M] Q7: 3,320 rows for 1,231 holdings, including the month lookup. Name lookups add about 1 row per entity [E].

| ETF | Holdings [M] | Uncached reads [E] |
|---|---|---|
| typical (mean of the latest months) | ≈ 900 | ≈ 3.4k |
| VXUS | 8,878 | ≈ 30k |
| BND (largest) | 17,409 | ≈ 60k |

Cached: 0 D1 reads.

### 4.5 Daily budget
- Worst plausible load: 200 uncached ETF-months/day × 10k = 2M reads/day [E]. That is 40% of the 5M/day cap, which is too much at the tail.
- Controls:
  - (1) Edge cache 24 h.
  - (2) At most 10 inputs per analysis.
  - (3) The client fetches each ETF once per session (in-memory map).
  - (4) The route's `console.log` line `exp_lookthrough symbol month rows_read` (from `meta.rows_read`), so Tech Ops can sum it via `wrangler tail` or Ops DQ.
  - (5) Review gate: if 7-day average reads attributable to R-EXP1 exceed 500k/day, Tech Ops raises a KI and the Main Lane decides on a tighter TTL or a precomputed table.
- Usage today is low: no portfolio feature exists yet, so the expected load is well under 100k/day [E].

## 5 Freshness (EXP-08) and the gate3 back-fill

### 5.1 What "current" means
- Each ETF has its **own** latest month. Measured [M] Q3: latest months run from 2026-01 (1 ETF) to 2026-08 (6). Most ETFs fall in 2026-03 to 2026-06, because N-PORT is published with a lag and the holdings cycle is at 133/237.
- So a portfolio result is normally **mixed-month**. The UI always shows one date chip per ETF: "Holdings: <Mon YYYY> · filed <date> · source SEC N-PORT".
- Direct equities carry no holdings date: "your stated allocation".
- Header: "Computed in your browser on <today> from stored holdings; not live positions."
- **Period differences:** "previous stored month" = the next older complete month for that ETF (route `previous_month`). It is fetched only when the user turns on Compare, via `?month=`, which doubles that ETF's read once.
  - `Δc_{i,e} = a_i (f_{i,e}(m) − f_{i,e}(m′))/100`. Combined `ΔE_e = Σ_i Δc_{i,e}`; direct inputs have no Δ.
  - The months can be non-consecutive. Both are named ("Apr 2026 vs Jan 2026").
  - Entities present in only one month show as *new* or *exited*.
  - Holdings keep more than two months (2025-05 to 2026-08 [M] Q2). The decided limit is "two stored months" (NML-1110-6), so the comparison covers only the two most recent.

### 5.2 Read holdings directly, or the pre-computed table? Compare

| Criterion | Request-time from `fund_holdings_monthly` (R-EXP1) | Pre-computed `entity_exposure_monthly` (gate3) |
|---|---|---|
| Freshness | Current as soon as holdings land | Latest 2026-03, computed 2026-06-14 [BQ2]; stale until a manual run |
| Coverage | All 241 ETFs with stored holdings [M] Q3 | 42 funds in 2026-03 [BQ2] |
| Mapping tier (EXP-06) | Yes (`source`, `confidence`) | **No**: the table has no tier column, so this needs a schema change |
| Identity correctness | One map row per holding plus redirect | Pass 1 joins `entity_isin_map` (PK `isin, lei`): ISIN fan-out can double count; no redirect handling |
| Unmapped detail | Per holding (top 25) | Only the `mapped_weight` total |
| Writes | 0 | ≈ 20k–200k row-writes for 2026-04..08 [E], §5.4 |
| Reads | ≈ 3.4k typical per uncached call | ≈ 2 small reads per call |
| Previous month | Any stored month | Only months gate3 has run |

**Decision proposed (D1): EXP reads holdings directly through R-EXP1.**
- `entity_exposure_monthly` stays as the source for the **company page** "ETFs holding this company" panels. That is a reverse lookup (company → all ETFs), and doing it at request time would need an ISIN index on `fund_holdings_monthly` that does not exist.
- `entities-api.js` line 3 says "All routes read pre-computed tables only — no raw fund_holdings_monthly joins at request time". This is a design rule of that Worker, not a CLAUDE.md non-negotiable. D1 asks the Founder to approve the exception for R-EXP1, bounded by §4.4–4.5.

### 5.3 Company page consistency (needed for EXP-09/10)
The company page panels read `entity_exposure_monthly` and pick `MAX(report_month)` for the entity (`handleEtfExposure`). Once later months exist, that shows only the funds that reported that month. After a back-fill, 2026-08 would show at most 6 funds [M] Q3.
- **Fix (unit W1):**
  - `/api/entities/:id/etf-exposure` returns each holder's **latest month**: a window or `GROUP BY holder` over `idx_exposure_entity (entity_id, report_month)`, which is a SEARCH, bounded by the entity's rows.
  - The panel labels "ETF holder data: months <min>–<max>; N funds; computed <date>".
- Until the back-fill runs, the panel label reads "ETF holder data as of Mar 2026 (42 funds)". The EXP result and the company panel can then disagree. The company page shows a note: "Exposure tool uses newer holdings for some ETFs."

### 5.4 gate3 back-fill (2026-04 … 2026-08)

**gate3 v2 (unit W5)** replaces `gate3-exposure.js` for new months:
- It is a SQL file run with `npx wrangler d1 execute meridian-etf --remote --file` from the repo root (OAuth). That removes the hardcoded account/DB ids and the `CF_API_TOKEN` REST path.
- Per month it runs 2 `INSERT … SELECT` statements, executed inside D1 with no row round-trips:
  - `entity_exposure_monthly`, built with the **§3.2 identity rule** (map plus redirect, no `entity_isin_map`), so EXP and the company page agree;
  - `fund_exposure_coverage`.
- Every row carries `computed_at = '<run token>'`.
- The month is a parameter. It is not a hardcoded list.
- The existing `INSERT OR IGNORE` semantics are kept, so months already present are not touched. Re-computing 2025 to 2026-03 with the new identity rule is **out of scope** (December, D5).

**Write volume [E]:**
- Fund-months 2026-04..08 = 70 + 56 + 51 + 24 + 6 = **207** [M] Q2.
- Rows per fund-month ≈ 242. That is 2026-03's 9,680 rows over 40 holders [BQ2].
- `entity_exposure_monthly` rows ≈ 207 × 242 ≈ **50k**, plus 207 coverage rows.
- D1 counts index updates as rows written. This table has the PK autoindex plus 2 indexes, so the upper bound is ≈ 4 × 50k ≈ **200k row-writes**.
- If only about 40% of fund-months link to a holder, as in 2026-03 (40 of 101), the lower bound is ≈ 20k–80k.
- **Measured before writing (unit W5, read-only):** `SELECT COUNT(*) FROM (<the INSERT's SELECT>)` per month gives the exact rows. The first month's `meta.rows_written` gives the true multiplier.

**Daily-cap plan:**
- Counters [M] Q8: Sundays ≈ 80k (holdings guard), Mondays ≈ 32–37k (entities-seed). Tue–Sat are not recorded by these counters. Enrich and boost run daily but are not counted here, which is an unmeasured gap.
- Rule: run on **Tue or Thu only**, never Sun, Mon or Wed (Wed is reserved for C1's holdings run), ≤ **50k row-writes per day**, stop when the next month would pass the day's limit. In practice that is one month per day: worst case 5 days, likely 2–3.
- After each month: row counts against the dry-run count, and coverage rows equal to the holders.

**Local script or Worker?**
- The back-fill is a **one-off** production processing run, approved with its own write budget. It is not a recurring job, so the CLAUDE.md recurring-job rule does not apply. Running it from local Claude Code is fine.
- A **recurring** refresh (after each holdings cycle) must stay inside Cloudflare. The viable in-Cloudflare path is to append the same 2 `INSERT … SELECT` statements to `meridian-holdings` when a cycle completes. That uses no new cron, and slots stay at 5/5.
- A LaunchAgent is **not** allowed while that path exists. The recurring refresh is deferred to December (D5).

**UI labels after the back-fill:** company panel "ETF holder data: <min>–<max>, N funds, computed <date>"; coverage per fund "x% of fund weight mapped to companies".

## 6 Evidence links (EXP-09, EXP-10)

| From the result | Goes to | Existing route / panel | Label (EXP-10) |
|---|---|---|---|
| Company row | Corporate Atlas company page `#/entity/{id}?from=exposure:{hashOfInputs}` (`_navParseFrom` gains type `exposure`; Back returns to the result) | `/api/entities/:id`, `/graph` | — |
| Company page · instruments | Instrument layer | `/api/entities/:id/instruments?limit=`, `/api/instruments/:key` | "Instruments mapped to this issuer; mapping tier shown" |
| Company page · ETF holders | ETF holders panel | `/api/entities/:id/etf-exposure` (W1 fix) | "Funds in Meridian's N-PORT set (241 of 264 listed ETFs have stored holdings); months <min>–<max>; not all ETFs" |
| Company page · 13F | Issuer panels (13F ownership) | `/api/entities/:id/issuer-panels` | "13F-HR filers in Meridian's set, quarter ending <period>; US-listed long positions only; not total ownership" |
| Company page · bonds | FI bonds | `/api/fi/issuers/:id/bonds` | "SEC-registered offerings parsed for 30 configured issuers since 2024-01-01; final records only" |
| Contribution line (ETF) | That ETF's holdings view | existing ETF holdings overlay (`from=etf:{symbol}:holdings`) | "Holdings <month>, filed <date>" |
| Unmapped holding | Instrument layer for its key | `/api/instruments/:key` (unresolved state already handled) | "Not mapped to a company" |

Banned wording anywhere in EXP: "current ownership", "all holders", "complete", "real-time". The words used are "stored", "reported", "as of".

## 7 Acceptance tests (EXP-12)

The fixtures for T1, T3, T4, T7 and T8 are local JSON look-through bodies plus a node test (`App/Corporate Atlas/tests/exp-compute.mjs`), loading the pure functions from `ma-entities.js` via `vm`. T2, T5 and T6 are checked against the deployed route on the UAT day. Their expected values are re-captured then from the route response and checked by hand.

| # | Case | Inputs | Expected |
|---|---|---|---|
| T1 | Worked example (direct + ETF same company, heuristic, unmapped, split identity, residual, unallocated) | F1 (§3.4) | Exactly the §3.4 table; reconciliation 100.00; shared = {X, Z}; Y and Y′ separate; Low share 8.02%; O_{A,B} 11.00 |
| T2 | Overlapping ETFs, mixed months (live) | VXUS 50, EEM 50 | Captured [M] Q6 on 2026-11-11 (re-capture at UAT): months Apr 2026 and Feb 2026 → mixed-month warning. TSMC = 0.5×3.928 + 0.5×13.141 = **8.53%**, Low (heuristic). Samsung = 0.5×1.854 + 0.5×6.767 = **4.31%**, Low. Shared companies = **975**; O = **25.63%**. Mapped companies 0.5×93.615 + 0.5×95.262 = **94.44**; unmapped + no-id = 0.5×(5.224+2.524) + 0.5×(6.403−0.153) = **7.00**; residual 0.5×(−1.363) + 0.5×(−1.512) = **−1.44**; total **100.00** |
| T3 | Over-allocation | ETF A 60, ETF B 50 | Blocked: "Allocations total 110% — reduce by 10%"; no results; no rescaling |
| T4 | Duplicate input | EEM 30, EEM 20 | Blocked; a Combine button produces EEM 50; then results as for EEM 50 alone with unallocated 50 |
| T5 | Unsupported input (live) | SPY 40, EEM 60 | SPY row "not supported: no stored holdings" (404 `no_holdings`, [M] Q5); unsupported line 40.00; EEM part = 0.6 × EEM; total 100.00 |
| T6 | Stale month (live) | IYLD 100 | Month Jan 2026 [M] Q3, which is more than 3 months older than the newest stored (Aug 2026) → stale warning; Compare shows the previous stored month or "no earlier stored month" |
| T7 | All unmapped, negative weights | fixture: ETF C 100 = {unmapped 70, no-identifier −2, mapped X 30, reported total 98} | X 30.00; unmapped 70.00; no-id −2.00; residual 2.00; total 100.00; no company created from unmapped rows |
| T8 | Merge redirect | fixture: holdings map to `duplicate_id` 900 → survivor 100 | One row for entity 100 with the "merged record" note; no row for 900 |
| T9 | Previous-month Δ | fixture: ETF D months m (X 10, Y 5) and m′ (X 8, Z 4), allocation 50 | ΔX +1.00, Y new +2.50, Z exited −2.00; both months named |
| T10 | Partial failure | fixture: second call returns 500 | That input is "not loaded"; its allocation goes to the not-loaded line; the other input computes; total 100.00 |

**UI state tests (UAT checklist):** empty, invalid, loading, unsupported, partial failure, total failure (offline), stale or mixed months, no previous month, mobile at 375 px, keyboard focus order across the pickers and table, Back from the company page returns to the same result (hash restore).

## 8 Change and rollback plan

| Change | Gate before | How | Rollback |
|---|---|---|---|
| C-1 Worker: R-EXP1 route + `/etf-exposure` per-holder fix (`meridian-entities-api`) | Review PASS; three-point check recorded (§10); Founder deploy approval | `npx wrangler deploy -c "App/Corporate Atlas/wrangler-entities-api.toml"`; record the previous and new version ids | `npx wrangler rollback <previous version id>`. The route is additive and the front end is unaware of it until C-2 |
| C-2 Pages: EXP UI in `App/ma-entities.js` + entry link in `App/index.html` | Review PASS; UAT on a local preview against the deployed C-1; Founder release approval | `App/` edit → `node generate-docs.mjs` → commit `docs/` → push the Pages source branch named in CLAUDE.md at release time | `git revert` the docs commit and push; Pages rebuilds in about 1 min (hard-refresh: 10 min cache) |
| C-3 Prod processing: gate3 v2 back-fill 2026-04..08 | Dry-run counts reported; Founder write approval with budget (≤ 50k/day, Tue/Thu); no other heavy job that day | `wrangler d1 execute --remote --file gate3v2-<month>.sql`, one month per day | `DELETE FROM entity_exposure_monthly WHERE computed_at='<token>'` and the same for `fund_exposure_coverage`. Months before 2026-04 are never touched |

No schema change, no new cron, no new secret. If D1 is rejected, the plan falls back to a schema change (tier column) plus gate3 v2 as the only source, which needs its own CR.

## 9 Work units

Dependency-ordered; one packet each; S ≤ 1 day, M 2–3 days.

| Unit | Content | Writable paths | Gates | Size |
|---|---|---|---|---|
| EXP.W1 | R-EXP1 route + `/etf-exposure` per-holder-latest-month fix + route tests on local SQLite fixtures; read-budget header comment | `App/Corporate Atlas/src/entities-api.js`, `App/Corporate Atlas/tests/exp-route*.mjs`, `App/Corporate Atlas/tests/fixtures/exp/*` | Review; three-point check; Founder deploy approval (C-1) | M 2.5 |
| EXP.W2 | `exp_validate` / `exp_compute` pure functions + tests T1, T3, T4, T7–T10 | `App/ma-entities.js` (EXP section only), `App/Corporate Atlas/tests/exp-compute.mjs` | Review | M 1.5 |
| EXP.W3 | UI: `#/exposure` layer, pickers, results, gaps, compare, links, states, entry link | `App/ma-entities.js`, `App/index.html` (entry link only), `docs/` via generate-docs | Review; local preview; Founder release approval (C-2) | M 2 |
| EXP.W5 | gate3 v2 SQL + read-only dry-run counts per month | `App/Corporate Atlas/gate3v2/*.sql`, its report | Review; Founder write approval for W6 | S 0.5 |
| EXP.W6 | Back-fill run 2026-04..08 (Tue/Thu, ≤ 50k/day) + verification | report only (D1 writes under approval) | Prod processing approval (C-3) | S 0.5 (spread over 2–5 calendar days) |
| EXP.W7 | EXP-12 verification on the live route (T2, T5, T6) + UAT demo | report only | Founder UAT | S 1 |

Total **8.0 packet-days**, within SA1's EXP ≈ 8. W1 → W2 → W3 → W7 is the critical path (7 days). W5 and W6 can slot in on review-only days. If W5 and W6 are dropped (D4), the total is 7 and the company panel keeps its "Mar 2026" label.

## 10 Cross-lane review

**ETF Product Lead (perspective written here; needs their sign-off at W1 review).**
- Tables read: `etf_master`, `fund_holdings_monthly`, `fund_snapshot_monthly`. Read-only, with no ETF contract or Worker change.
- **Dependency registered:** R-EXP1 relies on `idx_holdings_status_series_month (snapshot_status, series_id, report_month)` [M] Q4. The ETF lane must not drop or reorder it without notice.
- Two overlap measures will exist: `/api/etf-overlap` (by security, CUSIP or name) and EXP (by company). The UI names them "by security" and "by company". No change to the ETF page in November.
- Observation for the ETF lane (not EXP scope): `/api/etf-exposure` uses a correlated `MAX(report_month)` subquery per row, the same pattern that cost 104,559 rows in Q6. Worth a KI.
- Holdings cadence (C1) improves EXP freshness but EXP does not depend on it.

**Tech Ops (three-point check for R-EXP1; no cron, so it is recorded for the route as a standing practice).**
1. Index audit: EXPLAIN [M] Q4 shows SEARCH on every table, plus a temp B-tree for GROUP BY; no SCAN.
2. Single-execution reads: measured 3,320 rows for 1,231 holdings [M] Q7. The worst case is ≈ 60k for BND [E]; 422 above 25k holdings.
3. Read-budget declaration: a header comment in `entities-api.js` (W1) stating ≤ 4 D1 calls, ≈ 2.7 rows/holding, 24 h edge cache, and the `exp_lookthrough` log line.

Further points:
- CPU: Workers Free 10 ms. The body is assembled in SQL (`json_group_array`), so the Worker does no per-row JS. W1 measures CPU with `wrangler tail` on VXUS and BND. If either is over 10 ms, it stops and raises the issue.
- Subrequests: ≤ 4 per request.
- gate3 v2 writes: ≤ 50k/day on Tue/Thu, with rollback by token. The daily totals of enrich and boost on Tue/Thu are **unmeasured**, so W5 reads the Ops write counters for those days first.

## 11 Open decisions for the Founder

1. **D1 — Request-time look-through.** Let `meridian-entities-api` read `fund_holdings_monthly` for R-EXP1, an exception to that Worker's "pre-computed tables only" rule, bounded by §4.4–4.5. **Recommend: yes.** It is the only way to get current data, tiers and correct identity without a schema change.
2. **D2 — Allocation totals.** Totals under 100% are allowed and shown as "unallocated"; over 100% is blocked. **Recommend: yes.**
3. **D3 — Direct equities at issuer level.** The user picks a company; share-class or ticker input waits until later. **Recommend: yes, for November.**
4. **D4 — gate3 back-fill 2026-04..08 in November** (W5 and W6, ≈ 1 packet-day, ≤ 50k row-writes/day on Tue/Thu, gate3 v2 identity rule). **Recommend: yes.** Without it the company page's ETF-holder panel stays at Mar 2026 / 42 funds and disagrees with EXP.
5. **D5 — Recurring refresh and re-computing old months** (in `meridian-holdings` after each cycle, no new cron). **Recommend: defer to December.**
6. **D6 — UI in `App/ma-entities.js`** instead of a new 12th front-end file. A new file would change `generate-docs.mjs` and the release path, which needs a CR. **Recommend: `ma-entities.js`.**
7. **D7 — Limits.** At most 10 inputs; route refuses ETFs above 25,000 holdings. **Recommend: yes.**
8. **D8 — Heuristic mappings.** They are included in results and always shown as Low confidence, with a display-only "hide low-confidence" filter. Measured: 65.9% of EEM's weight and 22.7% of VXUS's rest on heuristic mappings [M] Q6, so excluding them would hide most emerging-market exposure. **Recommend: include and label.**
9. **D9 — Possible-duplicate marks.** November marks no "possible duplicate" pairs: there is no recorded candidate list, and name-similarity at run time would be silent merging by another name. **Recommend: yes. A 013 follow-up list can add marks later.**
