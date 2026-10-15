# MA-OCT-008 — SEC Corporate-Bond Ingestion: Spec

```text
ROLE: Data-Identity Lead   LANE: Data-Identity (SPEC ONLY)   BRANCH: October-2026 (read-only)
EXECUTE FROM: claude/MA-OCT-008_Spec_Brief.md (c050d3e52082fc003dca08359ecb3e2577b97e533af0d9e2010a28291718c227)
INPUT SPEC:   claude/MA-OCT-004-Bond-Spec.md (90531b573b8df4466c54c3a0a494350aa5e05b961082dc23bcca7df4afdc2a2a)
REVIEWS: Architect + Operations Lead (Fri 9 Oct)   APPROVAL: Founder (Mon 12 Oct: spec, seed list, CR1)
```

**Status:** **rev 1.2 (Fri 9 Oct 2026).** This revision applies the Architect review's required edits A8-1 to A8-6 (`claude/MA-OCT-008_Architect_Review.md` `1e91b3d3da4188238178b2fc0786a0bf38edc464e3742c00297c85de100f222d`, PASS WITH NOTES), notes N8-1 to N8-3 and ETF PL note EP-1, and the Main Lane's answers to Q-a (`claude/relays/FREEZES.json`) and Q-b. It builds on rev 1.1 (`bfa13b616112cb69ff2425b176dd35d31e5b6480d701b1af7c65a3ed51e9cee2`), which carries the Operations Lead's edits (`claude/MA-OCT-008_Ops_Review.md` `74eb8e65…a4bf`). The sections changed in rev 1.2 are listed in §18.2 for the Architect's delta check. Nothing here is approved.

**Inputs cited (SHA-256 as verified on disk, Fri 9 Oct ~17:00 UTC; rev 1.2, A8-1):**
- Brief and 004 above.
- `claude/ReadPacks_2026-10_Query_Ledger.md` `7683a59d478bec0e2d449ebf0ff1aa4a408aef2a793b41fb72b4427b58c3c019` (Pack B results, 7 Oct).
- `claude/MA-OCT-007_Spec.md` rev 1.2 `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703` (§3.2, §3.5–§3.6, §5.2, R1f, P10).
- `claude/MA-OCT-001_Spec.md` §7 (heartbeat contract v1, as amended by A1).
- `claude/MA-OCT-011_Spec.md` **rev 1.8** `096f857d5f20725b4116149aa7438b995953d7232c14c94d178987593412b270` (runner, F-1..F-5 gate and calendar precedent). This supersedes rev 1.7 `30462894…cadf0`, which the Architect review cites.
- `claude/MA-OCT-013_Spec_Brief.md` **rev 1.6** `00ec63032bfc9b0c85ff71c919ae95c64faea5e89f59485b19cd337470b53485` (S1; repoint 7, the conditional `bond_issuer_link` repoint). This supersedes rev 1.5 `8319cc09…2085`.
- `claude/MA-OCT-002_Spec.md` **rev 1.3** `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893` (approved 9 Oct: outbox, §8.5 `d1-today`, wrangler pin, registry).
- `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` (step 1 tooling preflight, quoted in §9.2).
- `claude/relays/FREEZES.json` `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346` (issued 9 Oct; read at run time, §12.3).

---

## 0. Summary of decisions (one line each)

| # | Decision | Section |
|---|---|---|
| D1 | Source: SEC EDGAR only. `424B2/3/5/7` are the authoritative final terms; `FWP` is informational (CUSIP/ISIN enrichment and a cross-check), never a tranche of its own. | §7 |
| D2 | Preliminary filings are detected on **visible text**, on 424B forms only, keyed on "SUBJECT TO COMPLETION" or "is not complete and may be changed" (rulings R1, R2). Verified on ICE, Duke and UnitedHealth. | §6.1, §7.2 |
| D3 | A security-type gate runs before parsing: non-debt (R3, e.g. Equity Units) and structured or market-linked notes are recorded as skipped, never parsed. | §7.3 |
| D4 | **Domain: Entities/instrument.** No fourth domain. Two new tables: `bond_issuer_link` and `bond_issuance`. The 008 runner is the sole writer; 009 reads only. | §8 |
| D5 | Bonds do **not** go into `instrument_entity_map` (no CHECK rebuild). 009 serves issuer→bonds; 007 NavLink `source = "sec_bond"`. Agreed with 007. | §8.3 |
| D6 | **No `entity_master(cik)` index** (F2, confirmed by Pack B and accepted by the Main Lane). CIK→entity is resolved once per issuer. | §8, §11 |
| D7 | **Runs as a local, manual runner** on the Founder's Mac, like 011. No Worker, no cron (slots at 5/5), no LaunchAgent. It has stop, pause, resume and status controls, and sends 001 heartbeats with a local outbox. | §9 |
| D8 | **Folder CR `MA-OCT-008-CR1`:** code under `App/Corporate Atlas/bonds/`, migration under `App/Corporate Atlas/migrations/`. `Fixed Income/src/` is not used. | §10 |
| D9 | Entity linkage: CIK → LEI → reviewed name match → manual. A subsidiary filer is **never** linked to its parent. Unmatched issuers keep `entity_id` NULL and raise a 004 DQ ticket. | §11 |
| D10 | Seed list: **30 issuers**, with the 5 structured-note G-SIBs replaced (Founder Q1). Fallback 20 marked. | §5 |
| D11 | Initial load ≈ 4k D1 writes (ceiling 8k); steady state < 500 writes a week. Freezes: Sun 04:00–07:05 UTC, Mon before 07:05 UTC, and 17–23 Oct if 011 is GO. | §12 |
| D12 | Acceptance: ≥ 98% field precision on a 60-tranche stratified sample, 0 wrong-issuer links, and **0 preliminary rows served**. | §14, §15 |

## 1. Problem statement

Meridian Atlas has no bond-level data. A user who reaches an issuer such as Duke Energy or Toyota Motor Credit can see its equity, holdings exposure and filings, but not the debt it has issued, which for many large issuers is the larger and more frequent source of capital markets activity. Scope v2 commits a Fixed Income vertical for October (008 data → 009 API → 010 page). 008 is the data layer, and it must be trustworthy from day one: the 004 input spec showed that issuers file a blank preliminary supplement before the priced one, and this lane showed that the naive marker rule also misfires on term sheets and that 424B5 carries non-debt deals. Serving any of those as bond terms would be a visible error on a reference-data product.

## 2. Goals (measurable)

1. **Coverage:** every approved seed issuer has a `bond_issuer_link` row, and every final debt 424B filed since 1 Jan 2024 by an active issuer is either a parsed tranche or an audit row with a stated reason. Target 100% of discovered filings accounted for.
2. **Correctness:** ≥ 98% of sampled key fields (principal, coupon or spread, maturity, rate type) match the source document (§14). 0 wrong-issuer links.
3. **No preliminary terms served:** 0 rows with `filing_status <> 'final'` returned by any 009 route, and every known preliminary filing in the test set classified `preliminary`.
4. **Navigable:** every linked issuer reaches its bonds through 007's contract, and every bond with a CUSIP or ISIN reaches its issuer (`source = "sec_bond"`).
5. **Inside the budgets:** initial load ≤ 8k D1 writes in total and ≤ 8k on any day; no statement over 50k reads; ≤ 5 SEC requests a second.

## 3. Non-goals (v1)

| Non-goal | Why |
|---|---|
| Municipal bonds | MSRB EMMA is disqualified for this product (scope v2). |
| Secondary pricing, yields, TRACE | Needs a FINRA entitlement; issuance reference data only. 010 shows the not-live-pricing disclosure. |
| Paid or entitled sources | Project premise: open data only. |
| The 009 API and the 010 page | Separate packets; §16 is the hand-off contract. |
| Structured or market-linked notes | High volume, not plain debt; recorded as skipped (§7.3). |
| Universe-wide expansion (all ~44k entities) | Phase 2, through a later `/roadmap-update`, after v1 accuracy is proven. |
| A recurring schedule | No cron slot; a scheduled job needs its own packet and three-point check. |

## 4. User stories

- As a **research user**, I want to open an issuer and see its bonds (tranche, coupon or spread, principal, maturity, filing date and the SEC source) so that I can see its debt profile next to its equity and holdings.
- As a **research user**, I want a bond held by an ETF to lead me to its issuer, with the mapping source and confidence shown, so that I can trust the link.
- As a **research user**, I want to see when the data was last refreshed and how confidently each tranche was parsed, so that I never mistake reference data for live pricing.
- As the **Data-Identity Lead**, I want issuers that cannot be linked to an entity to stay visible as unmatched and to raise a DQ ticket, so that nothing is silently mis-linked or auto-created.
- As the **Operations Lead**, I want every run to report start and end through the 001 contract, respect the hold flag and the D1 headroom gate, and be stoppable mid-run, so that bond ingestion never competes with core jobs.
- **Edge:** as a user, a filing that was preliminary, non-debt, structured or unparseable never appears as a bond; it shows only in coverage counts.

## 5. Seed issuer list (brief scope 1)

**Final proposal for the Founder (12 Oct): 30 issuers; ★ = the 20-issuer fallback (cut list item 3).** All CIKs are verified against SEC `submissions` (requests 3–32, 4 Oct; 45–49, 8 Oct). Counts are 424B filings (excluding FWP) since 1 Jan 2024 from those responses. `entity_id`/LEI are from Pack B (7 Oct); "C" means it is resolved by Pack C at build (§11.2).

| # | Issuer (SEC filer name) | CIK | 424B since 2024 | Why it's in | `entity_id` / LEI | ★ |
|---|---|---|---|---|---|---|
| 1 | Intercontinental Exchange, Inc. | 0001571949 | 7 | Control case: 004 prelim→final pair | **348** / `5493000F4ZO33MV32P92` | ★ |
| 2 | Wells Fargo & Company | 0000072971 | 495 (since Jul 2026) | The one G-SIB kept: structured-note filter test, plain senior notes | C | ★ |
| 3 | Capital One Financial | 0000927628 | 16 | Bank senior and subordinated, 424B5 | C | ★ |
| 4 | American Express | 0000004962 | 17 | Fixed and floating senior, 424B2 | C | ★ |
| 5 | Caterpillar Financial Services | 0000764764 | 43 | MTN pricing supplements (424B2/B3) | C (subsidiary) | ★ |
| 6 | John Deere Capital Corp | 0000027673 | 35 | MTN shelf, small tranches | C (subsidiary) | ★ |
| 7 | Toyota Motor Credit Corp | 0000834071 | 97 | MTN shelf, foreign parent (LEI test) | C (subsidiary) | ★ |
| 8 | General Motors Financial Co. | 0000804269 | 44 | Captive finance, 424B5 deals | C (subsidiary) | |
| 9 | Apple Inc. | 0000320193 | 2 | Multi-tranche 424B2; CIK-linked | **1662** / `HWUPKR0MPOU8FGXBT394` | ★ |
| 10 | Amazon.com | 0001018724 | 13 | Jumbo multi-tranche 424B5 with FWPs | C | ★ |
| 11 | Meta Platforms | 0001326801 | 6 | Jumbo deals; CIK-linked | **355** / `BQ4BKCS1HXDV9HN80Z93` | ★ |
| 12 | Oracle | 0001341439 | 13 | Frequent multi-tranche 424B2/B5 | C | ★ |
| 13 | AT&T | 0000732717 | 11 | Telecom, many tranches | C | ★ |
| 14 | Verizon Communications | 0000732712 | 58 | 424B3 exchange-offer edge (skip test) | C | |
| 15 | Comcast | 0001166691 | 5 | Media multi-tranche | C | ★ |
| 16 | Pfizer | 0000078003 | 4 | Issuer vs finance-sub structure | C | |
| 17 | AbbVie | 0001551152 | 8 | Pharma; prelim→FWP→final pattern | C | ★ |
| 18 | UnitedHealth Group | 0000731766 | 6 | Second-issuer check (Donnelley) | C | ★ |
| 19 | CVS Health | 0000064803 | 6 | Health services, BBB | C | |
| 20 | Boeing | 0000012927 | 6 | Industrial, multi-deal days | C | |
| 21 | Home Depot | 0000354950 | 4 | Retail multi-tranche | C | |
| 22 | PepsiCo | 0000077476 | 12 | *(replacement)* Consumer, frequent 424B2 | C | ★ |
| 23 | Union Pacific | 0000100885 | 3 | *(replacement)* Rail; 424B2/B3/B5 mix | C | |
| 24 | Lowe's Companies | 0000060667 | 2 | *(replacement)* Retail, 424B2/B5 | C | |
| 25 | Duke Energy Corp | 0001326160 | 22 | Second-issuer check (Toppan); Equity Units skip test | C | ★ |
| 26 | Southern Co | 0000092122 | 16 | Junior subordinated and hybrids | C | ★ |
| 27 | NextEra Energy | 0000753308 | 38 | Same-day multi-deal filings | C | ★ |
| 28 | Dominion Energy | 0000715957 | 30 | *(replacement)* Utility, all four 424B forms | C | |
| 29 | Realty Income | 0000726728 | 22 | REIT 424B5, re-openings and 424B7 | C | ★ |
| 30 | Welltower | 0000766704 | 23 | *(replacement)* REIT, 424B5/424B7 | C | |

**Removed from the draft (Founder Q1):** JPMorgan (19617), Bank of America (70858), Goldman Sachs (886982), Morgan Stanley (895421) and Citigroup (831001). They filed **10.6k–22.8k 424B2s each in the last 12 months**, almost all structured notes; their `recent` window covers only about 12 months, so even discovery needs `files[]` paging. Wells Fargo stays as the single filter test, with its initial load capped (L8-1).

**Scale of the initial load (from these counts):** about 630 424B documents (Wells capped at 60) plus about 300 FWPs, so about 1,000 SEC requests and, after the gates, about 480 final filings → about 860 tranche rows plus about 150 audit rows (§12).

## 6. Second-issuer preliminary-filing check (brief scope 2): PASS

Run 4 Oct (requests 39–44). Full result table and rulings R1–R3 in §6.1 below. Two issuers other than ICE, with different filing agents (Toppan `tm…`, Donnelley `d…`), both detected; finals and the UnitedHealth FWP clean. The one failure (Duke FWP) was the 004 rule itself, now corrected by R2.

### 6.1 Second-issuer check: RESULT (4 Oct 2026, requests 39–44, all 200)

| Issuer / agent | Filing | First-2,000-text marker | Expected | Result |
|---|---|---|---|---|
| Duke Energy (Toppan, `tm…`) | 424B5 10 Aug 2026, `0001104659-26-093014` | "preliminary prospectus supplement… not complete" @116; "Subject to Completion" also <2,000 | preliminary | **PASS** |
| Duke Energy | FWP 11 Aug, `0001104659-26-093620` (pricing term sheet) | "Supplementing the **Preliminary Prospectus** Supplement" @154 | final terms | **FALSE POSITIVE** with 004's rule |
| Duke Energy | 424B5 12 Aug, `0001104659-26-094253` | none | final | **PASS** |
| UnitedHealth (Donnelley, `d…`) | 424B5 17 Jun 2025, `0001193125-25-141793` | "Subject to completion… Preliminary" @141 | preliminary | **PASS** |
| UnitedHealth | FWP 17 Jun, `0001193125-25-142149` ("FINAL TERM SHEET") | none | final terms | **PASS** |
| UnitedHealth | 424B5 18 Jun, `0001193125-25-142782` | none | final | **PASS** |

**Rulings to carry into §7:**
- **R1.** Run the marker test on **visible text** (markup stripped), not raw bytes. The Duke FWP hit shows up only after stripping.
- **R2.** The bare string "PRELIMINARY PROSPECTUS" over-matches: FWPs routinely cite the prelim they supplement. Apply the preliminary rule to 424B forms only, and key it on "SUBJECT TO COMPLETION" or "is not complete and may be changed". FWPs stay informational (004 Q3).
- **R3.** 424B5 is also used for non-debt securities. Duke's Aug 2026 deal is **35,000,000 Equity Units**. Discovery needs a security-type gate ("Notes|Debentures|Bonds" on the cover, excluding "Equity Units|Common Stock|Depositary Shares"), and a filing that fails it is stored as `skipped_non_debt`, not parsed.

## 7. Discovery → parse → store (brief scope 3)

### 7.1 Discovery
1. Per active issuer, `GET https://data.sec.gov/submissions/CIK##########.json`.
2. Take `filings.recent` rows with form in {424B2, 424B3, 424B5, 424B7, FWP} and `filingDate ≥ lookback` (initial: 2024-01-01; Wells: the 60 most recent 424B2, L8-1). Read `filings.files[]` pages only when the lookback is older than the oldest `recent` row (not needed for the proposed 30).
3. Skip accessions already present in `bond_issuance` (any `tranche_seq`). Read: `SELECT DISTINCT accession_number FROM bond_issuance WHERE accession_number IN (…≤100)`, which is a `SEARCH` on the primary-key autoindex. No new index is needed. **Re-parse path (A8-4):** because discovery skips any accession already present, a parser fix is re-applied **only** by `DELETE FROM bond_issuance WHERE parser_version = ?` (or `… AND cik = ?`; §15.4), run under the headroom gate, followed by an incremental run. The runner never updates rows in place.
4. Fetch each new primary document from `https://www.sec.gov/Archives/edgar/data/{cik}/{accession-no-dashes}/{primaryDocument}`.

### 7.2 Final-filing detection (R1, R2)
- Strip `<script>`, `<style>` and tags, unescape entities, collapse whitespace; test the **first 2,000 visible characters**.
- 424B forms: **preliminary** if the text matches `SUBJECT\s+TO\s+COMPLETION` or `is\s+not\s+complete\s+and\s+may\s+be\s+changed` (case-insensitive). Otherwise final candidate.
- FWP: never classified by this rule (R2). An FWP is informational.
- A preliminary filing is stored as one audit row (`tranche_seq = 0`, `filing_status = 'preliminary'`). The later final 424B for the same deal is ingested on its own accession; no pairing is needed for correctness. Pairing (same issuer, same registration number, final within 10 days) is recorded in the run log for coverage only.

### 7.3 Security-type gate (R3) and the structured-note filter (rev 1.2, A8-3)
**Applied to the security title only:** the cover's offering lines and the "Title of the Notes"/"Title of Securities" term, which appear in the first 6,000 visible characters of a final candidate.

**Precedence: other → structured → non-debt → debt. The first match wins.** Market-linked notes are titled "… Notes due 2030", so they also match the debt rule; that is why the order matters.

| Order | Outcome | Rule (case-insensitive) | Stored as |
|---|---|---|---|
| 1 | Other | `exchange offer`, `remarketing`, `selling (security\s*)?holders`, `resale prospectus` | `skipped_other` |
| 2 | Structured | **Either** a structured product word: `Market[- ]Linked`, `Autocallable`, `Auto[- ]Callable`, `Buffered`, `Contingent (Coupon|Interest)`, `Leveraged`, `Accelerated Return`, `Principal at Risk`, `Index[- ]Linked`, `Equity[- ]Linked`, `Absolute Return`, `Digital`, `Barrier`; **or** `linked to` with an underlier word (`index`, `indices`, `basket`, `stock`, `shares`, `ETF`, `fund`, `commodity`, `currency`) in the **same sentence**. **Excluded:** a sentence whose only "linked to" or "based on" object is a benchmark rate (`SOFR`, `Compounded SOFR`, `Term SOFR`, `EFFR`, `Treasury`, `Prime`, `Fed Funds`, `CMT`). That is a plain floating-rate note, not a structured one. | `skipped_structured` |
| 3 | Non-debt | `Equity Units`, `Common Stock`, `Depositary Shares`, `Preferred Stock`, `Warrants`, or `\bUnits\b` — **in the security title only** | `skipped_non_debt` |
| 4 | Debt | `\b(Notes?|Debentures?|Bonds?)\s+due\b`, or "Medium-Term Notes" with a pricing-supplement header | parse (§7.4) |
| — | None of the above | No title found | `parse_failed` (filing level, `tranche_seq = 0`) |

**Guards against false skips:**
- AC16 checks that plain Compounded-SOFR floating-rate notes stay `final`.
- AC17 makes the Data-Identity Lead sign every `skipped_*` row from the dry run for the 29 issuers other than Wells Fargo before the first live batch. The §14.2 sample draws only `final` rows, so it cannot see a false skip.

### 7.4 Tranche parsing
- **Cover first:** the cover lists each tranche, e.g. "$500,000,000 4.400% Notes due June 15, 2028". One tranche per match, `tranche_seq` in cover order.
- **Fields:** principal (`$[\d,]+` with optional "million|billion"), coupon (`[\d.]+%`), rate type (fixed / floating when "Floating Rate" plus a benchmark such as Compounded SOFR, with spread in bps from "+ 0.xx%" or "plus xx basis points" / fixed-to-floating when "Fixed-to-Floating" or "Fixed/Floating"), maturity (full date if stated on the cover or in the "Maturity Date" line of the terms section, else year only → that **tranche** is stored as `parse_failed` (§8.2 rule), since a final row needs a full date), seniority ("Senior", "Subordinated", "Junior Subordinated", only when stated on the cover or in the title), currency (USD unless "€", "EUR", "£", "CHF", "¥" appear in the tranche title).
- **Identifiers:** CUSIP and ISIN from the terms section of the 424B, else from the same deal's FWP term sheet (same issuer, same registration number, filed within 3 days before the 424B), matched to the tranche by coupon and maturity. Check digits are validated; a failed check leaves the identifier NULL.
- **MTN pricing supplements** (424B2/B3, captive finance): one tranche per filing, terms from the pricing-supplement table.
- Every row records `parser_version` (e.g. `bonds-1.0.0`) and `parse_confidence` (§14).

### 7.5 Store
Batched `INSERT OR IGNORE` through the pinned wrangler (§9), ≤ 100 statements per batch. A filing writes all of its tranche rows in one batch, so a partly written filing cannot exist after a successful batch; a failed batch is retried whole and is idempotent.

## 8. Domain, tables, keys, indexes, idempotency (brief scope 4). Agreed with 007 (007 rev 1.2 §3.6); rev 1 additions marked ⊕

**Domain: Entities/instrument (default, so no fourth domain is needed).** Owner: Data-Identity Lead. **Writers (rev 1.2, A8-5):** the 008 ingestion runner is the **sole inserter** into both tables. **013 repoints `bond_issuer_link.entity_id`** under rule S1 (013 rev 1.6, repoint 7, conditional on the table existing). 009 reads only. **ETF-tree tables (A8-6):** no ETF-domain table is **written**. Three are **read**, read-only and by index:
- Pack B and Pack C read `issuerperiodsummary` and `issuereventstream` by their `cik` indexes, once, at build (§11.2, §13);
- the runner reads `holdings_pipeline_state` by primary key, once per run, for `hold_all_jobs` (§9.3).

**Findings that shape this section:**
- **F1:** `issuerfilingmaster` has no `entity_id` column. The real CIK→entity path is `entity_master.cik`, stored as a 10-digit zero-padded string (`seed-entity-cik.js:127`).
- **F2:** no index on `entity_master(cik)` is defined in any repo migration. The design below resolves CIK→entity **once per issuer** (30 rows) and never per run, so **v1 needs no new `entity_master` index**.
- **F3:** writing bonds into `instrument_entity_map` would need a CHECK-constraint table rebuild (about 33k writes, per 007 §3.5). **Not proposed.** 008 answers 007 O1 with **option (ii)**: Fixed Income keeps its own tables and 009 serves issuer→bonds.

### 8.1 `bond_issuer_link`: the linked table (one row per issuer)

```sql
CREATE TABLE IF NOT EXISTS bond_issuer_link (
  cik          TEXT PRIMARY KEY,                -- 10-digit zero-padded, same form as entity_master.cik
  entity_id    INTEGER NULL,                    -- NULL = unmatched; an entity is never auto-created
  link_method  TEXT NOT NULL CHECK (link_method IN ('cik','lei','manual','unmatched')),
  confidence   INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 100),
  issuer_name  TEXT NOT NULL,                   -- SEC submissions name, for display and audit
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),   -- rev 1.2 (A8-5): 'paused' = stop polling SEC only; bonds stay visible. Unmatched = link_method/entity_id, not status
  linked_at    TEXT NOT NULL,
  verified_at  TEXT NULL,
  last_polled_at TEXT NULL,                     -- ⊕ rev 1 (L8-3): last SEC check for this CIK; 009 freshness
  note         TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_bil_entity ON bond_issuer_link(entity_id) WHERE entity_id IS NOT NULL;
```

**How the link is set:**

| `link_method` | Rule | `confidence` | 007 band |
|---|---|---|---|
| `cik` | Exact match on `entity_master.cik` | 95 | high |
| `lei` | No CIK match, but the filer's LEI matches `entity_master.lei` | 85 | medium |
| `manual` | Data-Identity Lead decision, recorded in `note` | 100 | high |
| `unmatched` | No match; `entity_id` is NULL | 1 | none (`unmatched`) |

**Why the link sits in its own table:**
- **Merge repointing stays small.** 013 (rule S1) repoints at most 30 rows here, never one row per tranche. Ask to 013: add `bond_issuer_link.entity_id` to the S1 repoint list.
- **Unmatched issuers are visible.** They stay as rows with `entity_id` NULL and raise a 004 data-quality ticket (scope 7).
- **The seed list is the table.** The Founder-approved list becomes these 30 rows.
- **`status` (rev 1.2, A8-5):** `active` means the runner polls SEC for this CIK. `paused` means it **stops polling only**: existing bonds stay stored, visible and navigable in both directions. "Unmatched" is expressed only by `link_method = 'unmatched'` with `entity_id` NULL, never by `status`. So neither issuer→bonds (§8.3 step 1) nor 007's R1f filters on `status`. The 007 lane is asked to drop `AND status = 'active'` from its §3.6 issuer→bonds text, so the two specs match.

### 8.2 `bond_issuance`: one row per tranche (plus one audit row per skipped filing)

```sql
CREATE TABLE IF NOT EXISTS bond_issuance (
  accession_number TEXT NOT NULL,
  tranche_seq      INTEGER NOT NULL,            -- 1..n in cover order; 0 = filing-level audit row
  cik              TEXT NOT NULL,               -- → bond_issuer_link.cik
  instrument_key   TEXT NULL,                   -- 007 E8 rule: ISIN if 12 chars, else 'CUSIP:'||cusip; NULL if neither is on the filing
  isin TEXT NULL, cusip TEXT NULL,
  form_type        TEXT NOT NULL,               -- 424B2/3/5/7 (FWP is informational only, not stored as a tranche)
  filing_date      TEXT NOT NULL,
  filing_status    TEXT NOT NULL CHECK (filing_status IN ('final','preliminary','skipped_non_debt','skipped_structured','skipped_other','parse_failed')),  -- ⊕ rev 1 (L8-2): two skip reasons added
  tranche_label    TEXT NULL,
  security_class   TEXT NULL,                   -- notes | debentures | bonds
  rate_type        TEXT NULL CHECK (rate_type IN ('fixed','floating','fixed_to_floating') OR rate_type IS NULL),
  coupon_rate      REAL NULL, spread_bps INTEGER NULL, benchmark TEXT NULL,
  principal_amount REAL NULL, currency TEXT NOT NULL DEFAULT 'USD',
  maturity_date    TEXT NULL, seniority TEXT NULL,
  source_url       TEXT NOT NULL,
  parse_confidence INTEGER NOT NULL CHECK (parse_confidence BETWEEN 0 AND 100),
  parser_version   TEXT NOT NULL,
  ingested_at      TEXT NOT NULL,
  PRIMARY KEY (accession_number, tranche_seq),
  CHECK (filing_status <> 'final' OR maturity_date IS NOT NULL)   -- keyset safety: NULLs would drop out of the row-value cursor
);
CREATE INDEX IF NOT EXISTS idx_bi_cik_final_key ON bond_issuance(cik, maturity_date, accession_number, tranche_seq)
  WHERE filing_status = 'final';                -- 007 note (b): keyset order straight from the index, no sort; audit rows excluded
CREATE INDEX IF NOT EXISTS idx_bi_instrument   ON bond_issuance(instrument_key) WHERE instrument_key IS NOT NULL;
```

**Rules:**
- **Idempotency:** every write is `INSERT OR IGNORE` on `(accession_number, tranche_seq)`, in `db.batch()` or batched `wrangler d1 execute`. A re-run writes 0 rows.
- **No synthetic keys:** a tranche with no ISIN or CUSIP on the filing keeps `instrument_key` NULL. It is reachable from its issuer (009) but is not a standalone instrument link, and 008 never invents a third key form (007 §3.5).
- **Final filings only reach users (rev 1.2, A8-4):**
  - **Whole-filing outcomes** (`preliminary`, `skipped_non_debt`, `skipped_structured`, `skipped_other`, and a whole-filing `parse_failed` where no tranche title is found) get **one `tranche_seq = 0` audit row** with every numeric field NULL.
  - **A tranche that fails inside an otherwise good filing** keeps its own `tranche_seq` (1..n) with `filing_status = 'parse_failed'`. Its parsed fields are kept for adjudication, and its `instrument_key` is set NULL (raw `isin`/`cusip` stay in their columns), so it sits **outside both partial indexes**. That is 2 writes: row and PK.
  - 009 serves `filing_status = 'final'` only. These rows give 009 its coverage metadata.

### 8.3 Joining the 007 navigation contract (NavLink, `source = "sec_bond"`)

**Bond → issuer** (009 bond detail; optional R1f in 007's R1):
```sql
SELECT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' LIMIT 1;    -- idx_bi_instrument
SELECT entity_id, link_method, confidence, linked_at, verified_at FROM bond_issuer_link WHERE cik = ?;  -- PK
-- then 007 R1d (entity_master PK) + R3 redirect
```
The candidate fields are: `source: "sec_bond"`, `source_table: "bond_issuer_link"`, `confidence` from §8.1 and `as_of = COALESCE(verified_at, linked_at)`. If the same `instrument_key` also has an `instrument_entity_map` row (an ETF-held bond) and the issuers differ, 007's existing `ambiguous` / `source_conflict` rule applies unchanged.

**Issuer → bonds** (009 `GET /api/fi/issuers/{entity_id}/bonds?limit=25&cursor=`). Per 007 note (a), this collects bonds across **every CIK linked to the `entity_id`**. Examples: a parent and its finance subsidiary linked to one entity, or two CIKs that end up on one S1 survivor after 013.
```sql
-- step 1: all linked CIKs (idx_bil_entity; normally 1, small n). rev 1.2 (A8-5): no status filter, matching 007 R1f
SELECT cik FROM bond_issuer_link WHERE entity_id = ?;
-- step 2: per CIK, the same keyset statement (idx_bi_cik_final_key; SEARCH, no temp B-tree)
SELECT accession_number, tranche_seq, cik, instrument_key, tranche_label, rate_type, coupon_rate, spread_bps,
       principal_amount, maturity_date, seniority, filing_date, parse_confidence, source_url
FROM bond_issuance
WHERE cik = ? AND filing_status = 'final' AND (maturity_date, accession_number, tranche_seq) > (?, ?, ?)
ORDER BY maturity_date, accession_number, tranche_seq LIMIT 26;
```
**How the merge works:**
- 009 runs step 2 once per linked CIK in one `db.batch()`, merges the sorted lists in the Worker by `(maturity_date, accession_number, tranche_seq)`, and returns the first 25.
- The cursor is that global tuple, so each CIK resumes correctly and **no CIK is skipped or repeated**. `accession_number` is globally unique, which makes the tuple a total order across CIKs.
- A single `cik IN (…)` statement is **not** used, because it needs a temp B-tree sort over all of the issuer's tranches.

**Reads per page:** at most 26 × *n*CIK + *n*CIK. That is 27 for the usual single CIK, and 81 at an assumed cap of 3 CIKs per entity (to be confirmed by B2/B3). A first-page `total` is optional (P1). If 009 adds it, it is a capped `COUNT` per CIK over the same partial index, limited to 1,001 each.

**Plan checks (build lane, after migration):**
- **P-B1:** `EXPLAIN QUERY PLAN` of step 2 must show `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND …)` with **no** `USE TEMP B-TREE FOR ORDER BY`.
- **P-B2:** step 1 must show `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)`.

`asset_type` is `"DBT"`, which matches the N-PORT `asset_cat`.

## 9. Where it runs (brief scope 5)

### 9.1 Options weighed

| Option | Verdict | Why |
|---|---|---|
| On-request Worker route (new `meridian-bonds`) | Rejected | Workers Free gives 10 ms CPU per invocation; parsing a 0.3–1.3 MB prospectus (measured 4 Oct) needs far more. 50 subrequests per invocation would cap a run at under 50 documents, while the initial load is about 1,000. It would also be a 20th route surface to secure. |
| Extend `meridian-filings` | Rejected | Same CPU and subrequest limits, and it is an ETF Refresh Worker with no D1 writes today; adding Entities-domain writes to it would cross a domain line. |
| **Local manual runner (011 precedent)** | **Chosen** | No CPU or subrequest ceiling, SEC rate control is local, no cron slot is used (5/5), and writes go through the pinned wrangler with the same guards as 011. |

### 9.2 The runner
- **Files** (CR1, §10): `App/Corporate Atlas/bonds/bonds-ingest.mjs` (runner), `bonds-parse.mjs` (pure parser, unit-testable), `bonds-config.json` (seed CIKs, lookback, caps), and control scripts `bonds-stop.sh`, `bonds-pause.sh`, `bonds-resume.sh`, `bonds-status.sh`. Flag files and the run log live in `bonds/state/` (gitignored).
- **Invocation:** manual only, by the Founder or a Claude Code session on the Mac: `node bonds-ingest.mjs --mode=initial|incremental [--dry-run] [--cik=…]`. No LaunchAgent and no schedule; a schedule would be a new packet with its own three-point check (CLAUDE.md control-surface rule).
- **SEC rules:** `User-Agent: Meridian Atlas navinmv1981@gmail.com` (Founder, 4 Oct) from the `SEC_USER_AGENT` env var; ≥ 200 ms between requests (≤ 5 a second, half SEC's limit); on 403 or 429, stop the run with outcome `failed` / `SEC_RATE`; at most 1,500 SEC requests per run.
- **D1 writes (rev 1.2, A8-1):** wrangler is pinned exactly as in ENT-CR1 step 1. Before each run, `/usr/local/bin/wrangler --version` must print **4.96.0**, or `App/Corporate Atlas/node_modules/.bin/wrangler` is used once 002's CR-5 pin lands, checked the same way. A mismatch refuses the run. **Never `npx`.** Command: `d1 execute meridian-etf --remote --file <batch.sql>`, ≤ 100 statements per batch. Cloudflare error 10000 (F6): retry the whole batch once after 5 s, then stop with `failed` / `CF_API_10000`. The cursor stays on the last committed filing, and the next run resumes there idempotently. **Batch SQL carries literal values** (single quotes doubled) because `--file`/`--command` cannot bind `?`; the batch file is kept in `bonds/state/` as the record (EP-1).
- **Dry run:** `--dry-run` does discovery, fetch and parse, writes the would-be SQL to `bonds/state/dryrun-<date>.sql`, and makes **0** D1 writes. It is required before the first live run (§15.3).

### 9.3 Run gates (checked in this order; rev 1.1, Ops R-2, R-3, R-4, A-1)
Outcomes use the 001 contract v1 as amended by A1. Every `skipped` carries `detail.reason` from the A1 codes.

1. **Freeze window** (§12.3), checked at start **and before every batch**, from `claude/relays/FREEZES.json` (parsed; rev 1.2, Q-a). Inside a window at start → end `skipped`, `reason=out_of_window`. A window that begins mid-run stops the run between batches → `partial` (cursor kept). **If the file is missing or unparseable → fail closed:** `skipped`, `reason=out_of_window`, `detail.reason = "freezes_unavailable"`. The file's SHA-256 is written to the run log.
2. **`hold_all_jobs`**, at start (R-3). **Source:** the 002 sweep or admin route if it is live (after 002 A3). Otherwise, **one primary-key read** through the pinned wrangler: `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs';`. This is a read-only cross-domain read (ETF-domain table, same statement as `entities-delta.js:63`), and 008 never writes it.
   - `'true'` → end `skipped`, `reason=hold`.
   - **Unreadable** (route or wrangler error, no row, or an unparseable value) → **fail closed**: end `skipped`, `reason=hold`, `detail.hold = "unavailable"`.
3. **Pause flag** (`bonds/state/PAUSE`): at start → end `skipped`, `reason=pause`. Before every batch → end `partial` with the cursor.
4. **Stop flag** (`bonds/state/STOP`), before every batch: finish the in-flight batch, write the cursor, end `killed` (`detail.reason = "operator_stop"`).
5. **Headroom gate**, before every batch (011 §4.3 rule plus OPS-R3 F-1 to F-3; fails closed). Read account `rowsWritten` from `GET /api/ops/cf/d1-today`, with a 2 s timeout and one retry after 2 s. Run a batch only if **all** of these hold:
   - **Fresh:** the response is ok and parseable, its fetch age is **≤ 120 s**, and its UTC date equals today's UTC date.
   - **F-1 (unpolled rows):** `rowsWritten` + this run's rows written in the **longer** of (the last 15 minutes) and (since the previous `d1-today` fetch) + the batch ≤ **70,000** (the account ceiling).
   - **F-2 (monotonic):** within one UTC day, `rowsWritten` is not lower than at this run's previous fetch.
   - **F-3 (day boundary):** no batch starts between **23:50 and 00:10 UTC**.
   - **Run cap:** this run's day total + the batch ≤ **8,000**.
   - **Any failure** → no batch, cursor unchanged. End `partial`, `reason=headroom_unavailable` (for freshness, F-2 or errors) or `reason=headroom` (for the 70k or 8k caps). An F-3 window ends `partial`, `reason=out_of_window`.
   - **A-1 / F-5:** the **first live run** waits until the 002 A4 analytics-lag measurement is recorded (OPS-R3 F-4). If the measured lag is **> 10 min**, the account ceiling becomes **60,000** and the F-1 window becomes **lag + 5 min**. The runner reads these two values from `bonds-config.json` (`account_ceiling`, `unpolled_window_min`), which the build lane sets from the recorded measurement (Q-b: recorded by LANE-1-ENG in its 002a report and logged in the Decisions Log; the build lane cites that row's date in the run log). They are never defaulted silently, and a missing value refuses a live run.
6. **Declared budget:** stop at > 1.3× the run's declared writes (§12.1) → `partial`, `detail.reason = "budget"`.

### 9.4 Ops reporting (001 contract v1 as amended by A1; rev 1.1, Ops R-1, N-3)
- `job_id = "local.bonds-ingest"`, `trigger = "manual"`, `X-Ops-Emitter = local-bonds`.
- **Before the first live write (N-3):** a registry row in `ops_job_registry` (002) with `expected_max_duration_s = 3600`, **and** a `local-bonds` entry in `OPS_INGEST_KEYS`. That entry needs a `wrangler secret put` and a new `meridian-ops` version. The Operations Lead authorises both, the build lane executes them, and the version id is recorded in the close-out. The ingest key lives in a gitignored `App/Corporate Atlas/bonds/state/.env.ops-ingest` (or the existing `App/Corporate Atlas/.env.ops-ingest`), never in a committed file.
- **Events:** `start`, then one terminal (`success`, `partial`, `skipped`, `failed` or `killed`) with:
  - `rows_read` and `rows_written`, from the wrangler `meta` totals;
  - **`items_attempted`**: filings examined;
  - **`items_progressed`**: filings that produced at least one new row in `bond_issuance` (tranche or audit row);
  - `cursor` (`{before, after}` as the last committed accession);
  - **`detail.metrics`**: flat integer counters only, **≤ 16 keys, each key ≤ 32 characters, ≤ 2 KB**. The fixed key set is: `final_tranches`, `preliminary`, `skipped_non_debt`, `skipped_structured`, `skipped_other`, `parse_failed`, `sec_requests`, `sec_errors`, `batches`, `batches_retried`, `issuers_polled`, `links_reverified`, `links_unmatched`.
  - Free-text explanations go in `detail.reason`, never in `metrics`.
- **Local outbox** (002 A4 pattern): undelivered events are spooled to `bonds/state/outbox/` and replayed with the same `run_id` at the next run. Until 002's outbox module can be imported, the Operations Lead reconciles the runner's append-only run log against `ops_job_run` **after each live run** (Ops N-2, committed).

## 10. Folder change request `MA-OCT-008-CR1` (brief scope 6)

**Change:** add `App/Corporate Atlas/bonds/` (runner, parser, config, 4 control scripts, `fixtures/`, `state/` gitignored) and `App/Corporate Atlas/migrations/008-bonds.sql` (the §8 DDL). No other folder changes. `Fixed Income/src/` (004) is **not** created.

| Option | Assessment |
|---|---|
| **A. `App/Corporate Atlas/bonds/` (recommended)** | Matches the declared domain (Entities) and CLAUDE.md's rule that Entities-domain jobs and their control scripts live in `App/Corporate Atlas/`. No new top-level tree; `generate-docs.mjs` (front-end only) is unaffected. |
| B. `App/Fixed Income/` | Reads as a fourth domain, which this spec does not declare; it would split Entities-domain code across two trees. |
| C. `Fixed Income/src/` at the repo root (004) | Same as B, plus it sits outside `App/` like the `13F Seed/` asymmetry CLAUDE.md already calls out. |

**Impact:** new files only; no existing file changes except `.gitignore` (one line, `App/Corporate Atlas/bonds/state/`). **Rollback:** delete the folder and the gitignore line; nothing imports it. 010's front-end file (`App/ma-fi.js` or similar) is 010's own decision and is not part of CR1. **Review:** Architect (Fri 9 Oct). **Approval:** Founder (Mon 12 Oct, Q3).

## 11. Entity linkage while identity changes (brief scope 7)

### 11.1 Rules
1. **Order:** CIK (C1/B2-alt) → LEI (C2) → reviewed exact-name match (C3, recorded as `manual`) → manual decision → otherwise `unmatched`.
2. **Never auto-create** an entity. **Never link a subsidiary filer to its parent** (e.g. Toyota Motor Credit is not Toyota Motor Corporation): a bond's issuer is the legal filer. If the filer has no entity row, the link is `unmatched`, its bonds are still ingested and served by 009 with the SEC issuer name, and one **004 DQ ticket** (`missing_entity`, prefill: CIK, SEC name, LEI if known) is raised per issuer.
3. **S1 survivors (013):** before any `bond_issuer_link` write, each candidate `entity_id` is looked up in `entity_merge_redirect` (013) if that table exists, and the survivor is written with `verified_at` set. If `bond_issuer_link` exists when 013 runs, 013 rev 1.4 repoints it (≤ 30 rows). Either order is safe (Main Lane, 5 Oct).
4. **Re-verification:** each live run re-reads its issuers' `entity_id`s by primary key (≤ 30 reads). A missing id is re-resolved through the redirect table; if still missing, the link becomes `unmatched` with a note and a DQ ticket. No tranche row changes.

### 11.2 Pack C: build-time linkage reads (read-only; Lane 1 or the build lane; ≤ 150 rows read, 0 writes)
Pack B linked 3 of 30 (ICE 348, Apple 1662, Meta 355). Pack C resolves the other 27 before seeding `bond_issuer_link`.

| # | Statement | Expected plan | Est. reads |
|---|---|---|---|
| C1 | `SELECT entity_id FROM issuereventstream WHERE cik = '<10-digit CIK>' AND entity_id IS NOT NULL LIMIT 1;` ×27 (literal per EP-1). **Read estimate (rev 1.2, A8-6):** the index covers `cik` only and `entity_id` is filtered after each row lookup, so an execution can read **every event row for that CIK** when `entity_id` is NULL: expected hundreds, ≪ 50k. Record `rows_read` per execution. | `SEARCH issuereventstream USING INDEX idx_issuereventstream_cik (cik=?)` (index confirmed by Pack B B0) | ≤ 27 executions, each ≤ that CIK's event rows (est. ≤ ~5k total) |
| C2 | `SELECT entity_id, name, lei, entity_status, cik FROM entity_master WHERE lei IN (…);` for issuers still unmatched, with LEIs taken from GLEIF (Golden Copy `gleif_006.db` if retained, else ≤ 30 GLEIF API lookups approved for the build lane) | `SEARCH entity_master USING INDEX idx_entity_master_lei (lei=?)` | ≤ 30 |
| C3 | `SELECT entity_id, name, lei, type, cik FROM entity_master WHERE normalized_name = ?;` with the `seed-entity-cik.js` name normaliser | `SEARCH entity_master USING INDEX idx_entity_master_normalized (normalized_name=?)` (or the UNIQUE autoindex) | ≤ 60 |
| C4 | `SELECT * FROM entity_merge_redirect WHERE requested_id IN (…);` (only if 013 has created it) | `SEARCH entity_merge_redirect USING INTEGER PRIMARY KEY` | ≤ 30 |

Every Pack C statement runs `EXPLAIN QUERY PLAN` first, in exactly the as-run form, and stops on any `SCAN entity_master`. **Literal binds (EP-1):** `wrangler d1 execute --command` cannot bind `?`, so each `?` above is replaced with a quoted literal (10-digit CIK, LEI or normalised name), and the substituted text is recorded verbatim in the query ledger. C3 hits are proposals; the Data-Identity Lead signs each one before it is written as `manual`. **Pack C total (rev 1.2):** C2–C4 ≤ 120 rows, plus C1 at an estimated ≤ ~5k (27 × a few hundred). Each execution is recorded, and any single execution over 10k stops the pack for review.

## 12. D1 budget, three-point check, run gates and freezes

### 12.1 Budget

| Item | Rows | Writes per row | Writes | Reads |
|---|---|---|---|---|
| Migration (2 tables, 3 indexes) | — | — | ≈ 0 | ≈ 0 |
| `bond_issuer_link` seed | 30 | 3 (table, PK, partial index) | ≈ 90 | ≈ 30 |
| Final tranche rows | ≈ 860 | 4 (table, PK autoindex, `idx_bi_cik_final_key`, `idx_bi_instrument` when keyed) | ≈ 3,400 | ≈ 900 (PK probe on insert) |
| Audit rows (`tranche_seq = 0`) | ≈ 150 | 2 | ≈ 300 | ≈ 150 |
| Discovery probes and re-verification | — | — | 0 | ≈ 1,100 |
| **Initial load** | | | **≈ 3.8k (declared 6k; hard ceiling 8k)** | **≈ 2.2k** |
| **Steady state** (incremental run, about weekly) | 10–40 filings | | **< 500 a run** | < 300 |

The initial load can run in one day under the 8k day cap; if the headroom gate trips, it resumes next day from the cursor.

### 12.2 Three-point check

| Point | Per query | Per run |
|---|---|---|
| (i) Index audit | Every runtime statement is a `SEARCH`: `bond_issuance` by PK (`accession_number IN …`) and `idx_bi_cik_final_key`; `bond_issuer_link` by PK and `idx_bil_entity`; `entity_master` by PK; Pack C as §11.2. Plan checks P-B1, P-B2 (§8.3) and P-B3 (`EXPLAIN` of the accession probe → PK autoindex) run after the migration and **before** the first live batch; the runner aborts on any other plan. Allowed small-table scans: `bond_issuance` for verification and coverage only (≤ ~2k rows). | — |
| (ii) Single-execution read test | Largest statement: the 009 coverage aggregate over `bond_issuance` (≤ ~2k rows). Nothing approaches 50k. | Measured on the **pilot's** first live batch (§15.3 step 5) and logged. |
| (iii) Declared read/write budget | Each batch file states its statement count and expected writes. | Initial load declared at 6k writes; stop at > 1.3× (7.8k), under the 8k ceiling. Incremental runs declare their own count from discovery. |

### 12.3 Freezes (rev 1.2: parsed from `claude/relays/FREEZES.json`, Q-a; replaces rev 1.1's list and L8-7's operator flag)
The runner reads `claude/relays/FREEZES.json` at start and before every batch, and refuses any live batch inside a window (§9.3 gate 1). The Main Lane owns the file. The windows in force as issued on 9 Oct (`cdc9606a…c346`), all UTC:

| Window | When |
|---|---|
| Holdings Sunday | Sun 04:00–07:05 |
| Entities-seed Monday | Mon 03:30–08:00 |
| Entities-enrich (A8-2) | Daily **05:50–07:10** |
| Bootstrap fire buffer | Daily 07:55–08:05 |
| Boost AM / PM (standard band; A8-2, Ops R-5) | Daily **10:45–11:15** and **16:45–17:15** |
| UTC midnight (F-3) | Daily 23:50–00:10 |
| ENT-CR1 index change | Tue 13 Oct 08:05–10:30 (fallback Wed 14 Oct 08:05–10:30) |
| 011 run window (if GO) | Sat 17 Oct 00:00 – Sat 24 Oct 00:00 |

- **Source of truth:** the file wins over this table. A window added to the file later binds without a spec change.
- A dry run ignores freezes, because it makes 0 writes, but it still logs which windows would have applied.

### 12.4 When the live runs happen (rev 1.1, Ops A-1, A-2)
- **Weekdays only, Tue–Fri**, outside every `FREEZES.json` window. In practice that means after 08:05 UTC, avoiding the boost bands.
- **Order:** dry run (any day; 0 writes) → A-1 lag recorded → pilot (3 issuers) → initial load.
- **Target:** pilot **Thu 15 Oct**, initial load **Fri 16 Oct**, both after 002 A4 is live (Wed 14 Oct) and its lag is recorded, and before the 011 window.
- **If either slips** past Fri 16 Oct and 011 is GO, the next slot is **Tue 27 Oct** (Mon 26 is avoided per A-2). 009 builds against fixtures until then.
- **Measured multipliers (N-1):** the pilot records `rows_written` per statement type. If any multiplier is above **4.5×**, the initial load is re-declared before step 6 of §15.3.

## 13. Read-only D1 query pack, Pack B (run 7 Oct by Lane 1; results below)

**Result (from `claude/ReadPacks_2026-10_Query_Ledger.md` `7683a59d…3c019`):** 39 executions for 008, 158 rows read, 0 writes. **F2 confirmed** (`entity_master.cik` has no index; B1 `SCAN` was EXPLAIN-only). B2-alt hit **3 of 30** (ICE 348, Apple 1662, Meta 355; CIKs 10-digit padded; misses are true absences, not format). **27 misses > 5**, so no `entity_master(cik)` index for v1; linkage continues through Pack C (§11.2). B4's plan used `idx_instrument_master_cusip_issuer`, a duplicate of `idx_instrument_cusip6` (finding routed to the 13 Oct index CR; no 008 action). The original pack text is kept below for the record.

**Original Pack B text (rev 0.1), kept for the record:**

**When:** after 006's D10 snapshot on Mon 5 Oct has finished, and **not before 07:05 UTC**. Avoid Sun 04:00–07:00 UTC, the Mon 04:00 UTC seed, and 17–23 Oct if the 011 run goes ahead.

**How:** `wrangler d1 execute meridian-etf --remote`, one statement at a time, recording `meta.rows_read`. Run `EXPLAIN QUERY PLAN` first, in exactly the form that will be run. Stop on any `SCAN entity_master`. **0 writes.**

**The 30 CIKs (`$CIKS`):**

```
'0001571949','0000019617','0000070858','0000072971','0000886982','0000895421','0000831001','0000927628','0000004962','0000764764','0000027673','0000834071','0000804269','0000320193','0001018724','0001326801','0001341439','0000732717','0000732712','0001166691','0000078003','0001551152','0000731766','0000064803','0000012927','0000354950','0001326160','0000092122','0000753308','0000726728'
```

| # | Statement | Expected plan | Est. rows read | Decides |
|---|---|---|---|---|
| B0 | `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN ('entity_master','issuerperiodsummary','issuereventstream','issuerfilingmaster');` | `SCAN sqlite_master` | ≈ 30–60 | That the `cik` column exists, the live index list (**confirms or refutes F2**), and the `cik` format in each table |
| B1 | `EXPLAIN QUERY PLAN SELECT entity_id, cik, lei, name, type, entity_status FROM entity_master WHERE cik IN ($CIKS);` | **Expected: `SCAN entity_master`** (no index, per F2). If an index exists live: `SEARCH entity_master USING INDEX … (cik=?)` | 0 | **The F2 EXPLAIN.** SCAN → skip B2 and use B2-alt. SEARCH → run B2 |
| B2 | *(only if B1 = SEARCH)* the B1 statement itself | `SEARCH … (cik=?)` | ≤ 60 | `entity_id`/LEI per CIK; shows CIKs mapped to more than one entity (KI 22.41 twins) |
| B2-alt-E | `EXPLAIN QUERY PLAN SELECT entity_id FROM issuerperiodsummary WHERE cik = ? AND entity_id IS NOT NULL LIMIT 1;` | `SEARCH issuerperiodsummary USING INDEX sqlite_autoindex_issuerperiodsummary_1 (cik=?)` (UNIQUE(cik, xbrl_tag, period_type)) | 0 | That the fallback path is indexed |
| B2-alt | *(only if B1 = SCAN and B2-alt-E = SEARCH)* the statement above, **30 times, one per CIK**, in the CIK format B0 shows | `SEARCH … (cik=?)`, stops at the first hit | ≈ 30–90 in total | Candidate `entity_id` per CIK. CIKs with no hit go to the LEI path or manual review. **Do not fall back to a SCAN.** |
| B3 | `SELECT entity_id, name, lei, lei_status, type, entity_status, cik FROM entity_master WHERE entity_id IN (<ids from B2 / B2-alt>);` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | ≤ 30 | LEI and status. A missing id means it may have been merged away; it is re-checked after 013 |
| B4 | `EXPLAIN QUERY PLAN SELECT COUNT(*) FROM instrument_master WHERE cusip_issuer_6 = ?;` | `SEARCH instrument_master USING COVERING INDEX idx_instrument_cusip6 (cusip_issuer_6=?)` | 0 | That the overlap probe with ETF-held bonds is safe at build time |

**Pack B total: about 200 rows read or fewer, and 0 writes.** No statement comes near 50k. Results go into §5.1 (`entity_id`/LEI columns) and seed `bond_issuer_link` at build time (§8.1).

**If B0 shows a live `cik` index**, F2 is withdrawn and B2 replaces B2-alt. **If B2-alt misses more than 5 of the 30 CIKs**, the spec does **not** propose a `entity_master(cik)` index for v1. The misses are linked by LEI or manually, because each issuer is linked only once. A partial index (`WHERE cik IS NOT NULL`) is listed as a Phase 2 option, with its one-off cost of about a 43.8k-row table read plus about *N*-with-CIK writes.

## 14. Parsing confidence and acceptance threshold

### 14.1 `parse_confidence` (0–100) per tranche row

| Component | Points |
|---|---|
| Tranche found in the cover table or cover title pattern | 40 |
| Principal parsed and > 0 | 15 |
| Coupon (fixed) or benchmark + spread (floating) parsed | 15 |
| Full maturity date parsed | 15 |
| CUSIP or ISIN with a valid check digit | 10 |
| Same-deal FWP agrees on principal, coupon/spread and maturity | 5 |

- **≥ 80:** served as normal. **60–79:** served with a "check source" flag (009 exposes the number, 010 shows it). **< 60:** that tranche is stored as `parse_failed` with its own `tranche_seq` and its fields kept for adjudication (§8.2, A8-4); it is never served.
- Any FWP disagreement on a key field forces the row to ≤ 59 (`parse_failed`) and logs the conflict; the 424B is authoritative but a disagreement means the parse is suspect.

### 14.2 Acceptance threshold (sampled precision on final terms)
- **Sample:** 60 final tranche rows, stratified: at least 1 per active issuer with tranches, the rest proportional, drawn after the initial load with a recorded seed.
- **Check:** for each row, principal, coupon or spread, maturity date and rate type against the source document: 240 field checks, plus issuer link correctness for each of the 30 issuers.
- **Pass:** ≥ 98% of field checks correct (≤ 4 errors), **0 wrong-issuer links**, and **0** served rows whose source is a preliminary, structured or non-debt filing. A fail blocks 009 from reading the tables until a parser fix and re-sample.
- Adjudicated by the Data-Identity Lead; spot-checked by the Operations Lead (executors never review their own work).

## 15. Requirements, acceptance criteria, test plan and rollback

### 15.1 Requirements
- **P0:** discovery for the approved seed list; R1–R3 gates; structured filter; tranche parse; the two tables and indexes in §8; idempotent batched writes; run gates §9.3; 001 heartbeats; stop/pause/resume/status; Pack C linkage with S1 handling; DQ tickets for unmatched issuers (once 004 is live, else a list handed to 004).
- **P1:** FWP CUSIP/ISIN enrichment and cross-check; per-issuer `last_polled_at`; coverage counts for 009.
- **P2 (design for, do not build):** Phase 2 universe expansion; a scheduled run; the partial `entity_master(cik)` index.

### 15.2 Acceptance criteria (Given / When / Then)
| # | Criterion |
|---|---|
| AC1 | Given the ICE (11 Aug 2026), Duke (10 Aug 2026) and UnitedHealth (17 Jun 2025) preliminary 424B5s, when parsed, then each is `preliminary` with **0** tranche rows. |
| AC2 | Given the Duke FWP of 11 Aug 2026, when processed, then it is **not** classified preliminary (R2) and produces no tranche row. |
| AC3 | Given Duke's 12 Aug 2026 final 424B5 (Equity Units), then it is `skipped_non_debt` with 0 tranche rows (R3). |
| AC4 | Given the UnitedHealth final 424B5 of 18 Jun 2025, then its tranches (e.g. $500,000,000 4.400% Notes due 15 Jun 2028) are stored with full maturity dates and `parse_confidence` ≥ 80. |
| AC5 | Given a Wells Fargo market-linked 424B2, then it is `skipped_structured`. |
| AC6 | Given a completed run, when it is re-run with no new filings, then it writes **0** rows. |
| AC7 | Given the stop flag set mid-run, then the in-flight batch completes, no further batch runs, and the terminal event is `killed` with a cursor. |
| AC8 | Given `d1-today` unavailable, older than 120 s, dated a different UTC day, or lower than the previous fetch the same day (F-2), then no batch runs and the outcome is `partial`, `reason=headroom_unavailable`. Given 23:50–00:10 UTC (F-3), no batch starts. |
| AC9 | Given a freeze window, then the runner refuses to start. |
| AC10 | Given P-B1, P-B2 and P-B3 after the migration, then each shows the expected `SEARCH` and no temp B-tree. |
| AC11 | All 30 issuers have a `bond_issuer_link` row; every unmatched one has a DQ ticket (or a handed-over list) and no subsidiary is linked to its parent. |
| AC12 | §14.2 sample passes. |
| AC13 | Every run appears in `ops_job_run` (or the reconciled run log) with start and terminal events, `items_attempted` / `items_progressed`, and `detail.metrics` within the A1 limits. |
| AC14 | Given `hold_all_jobs` = `'true'` or unreadable, then the run ends `skipped`, `reason=hold` (with `detail.hold = "unavailable"` when unreadable) and makes 0 writes. Given the pause flag at start, `reason=pause`. Given a `FREEZES.json` window, or the file missing or unparseable, `reason=out_of_window` (`freezes_unavailable` in the second case). |
| AC15 | Given no recorded A4 lag measurement (missing `account_ceiling` / `unpolled_window_min` in config), a live run refuses to start; a dry run is unaffected. |
| AC16 | (rev 1.2, A8-3) Given a plain Compounded-SOFR floating-rate senior note from a non-G-SIB issuer (an American Express or Capital One 424B2), then it is `final` with `rate_type = 'floating'`, benchmark `SOFR` and a parsed spread, **not** `skipped_structured`. Given a Wells Fargo note linked to an index or basket, it is `skipped_structured`. |
| AC17 | (rev 1.2, A8-3) Given the dry run, then it lists every `skipped_*` row for the 29 issuers other than Wells Fargo, and the Data-Identity Lead signs each one (kept or corrected) in the run log **before the first live batch**. |
| AC18 | (rev 1.2, A8-4) Given a filing where one tranche parses at < 60, then that tranche is stored `parse_failed` with its own `tranche_seq` and NULL `instrument_key`, the filing's other tranches are `final`, and a later `DELETE … WHERE parser_version = ?` plus an incremental run re-ingests the filing. |

### 15.3 Test plan (build lane, in order)
1. **Parser unit tests** on fixtures (`bonds/fixtures/`): the six documents fetched 4 Oct, the ICE 11/13 Aug 2026 pair, one MTN pricing supplement each from Caterpillar Financial, Deere Capital and Toyota Motor Credit, one Wells structured 424B2, one Verizon 424B3 exchange offer, one Southern junior subordinated deal. AC1–AC5 run here.
2. **Dry run** over all 30 issuers (`--dry-run`): 0 D1 writes. Review counts by `filing_status` and 20 random parsed rows. **AC17:** the Data-Identity Lead signs every `skipped_*` row from the 29 non-Wells issuers. Run AC16 on fixtures and on at least one real American Express or Capital One SOFR note.
3. **Migration** (`008-bonds.sql`) in a non-freeze window, then P-B1–P-B3 (AC10).
4. **Pack C** and the `bond_issuer_link` seed (AC11).
5. **Live pilot** (only after A-1 and N-3 are done; §12.4): 3 issuers (ICE, UnitedHealth, Toyota Motor Credit). Check AC6 by re-running. Record the measured write multipliers per statement type (N-1). **N8-2:** confirm that `wrangler d1 execute --file` reports `rows_written` per batch. If it does not, count writes from the batch file's declared statements and reconcile them against `d1-today` after the batch.
6. **Initial load** for the rest, on a Tue–Fri slot (§12.4). Re-declare first if any multiplier is above 4.5×. AC7–AC9, AC14 and AC15 are each exercised once on the pilot or a dry run.
7. **Sample** (§14.2, AC12) and Ops reconciliation (AC13).

### 15.4 Rollback
- **Data:** `DELETE FROM bond_issuance WHERE parser_version = ?` (a parser regression) or `WHERE cik = ?` (one issuer); both are small-table operations (≤ ~2k rows).
- **Full:** `DROP TABLE bond_issuance; DROP TABLE bond_issuer_link;` Nothing else references them; 013's repoint is conditional on the table existing. 009 must treat a missing table as "no data" (§16).
- **Code:** remove `App/Corporate Atlas/bonds/` and the migration file (CR1 rollback).
- **Ops:** set the job's registry row to `held`.

## 16. Hand-off contract to 009

- **Tables and indexes:** §8 exactly. 009 reads only; it never writes either table.
- **Served rows:** `filing_status = 'final'` and `parse_confidence ≥ 60` only. Rows 60–79 carry `check_source: true`.
- **Fields per tranche:** `accession_number`, `tranche_seq`, `cik`, `instrument_key`, `isin`, `cusip`, `tranche_label`, `security_class`, `rate_type`, `coupon_rate`, `spread_bps`, `benchmark`, `principal_amount`, `currency`, `maturity_date`, `seniority`, `form_type`, `filing_date`, `source_url`, `parse_confidence`, `parser_version`, `ingested_at`.
- **Issuer fields:** from `bond_issuer_link`: `entity_id` (may be NULL), `issuer_name`, `link_method`, `confidence`, `linked_at`, `verified_at`, `last_polled_at`. NavLink mapping per §8.3 and 007 §3.2/§3.6.
- **Freshness:** per issuer `last_polled_at` (when the runner last checked SEC for that CIK) and `MAX(filing_date)` of its final rows; globally the last `success`/`partial` run of `local.bonds-ingest` from the Ops API. 009 shows "as of" from these, never "live".
- **Coverage metadata:** counts by `cik` × `filing_status` (`SELECT cik, filing_status, COUNT(*) FROM bond_issuance GROUP BY cik, filing_status`; a small-table scan, ≤ ~2k rows, which 009 should cache for ≥ 1 h), plus the seed list size and the count of unmatched issuers. **N8-3:** the coverage query also counts distinct `cik` per `instrument_key`. More than 1 flags a co-issuer or guarantor structure, where bond→issuer's `LIMIT 1` pick would be arbitrary; 009 shows those as `ambiguous`.
- **Disclosure:** every 009 response carries `data_type: "issuance_reference"`, so 010 can show the not-live-pricing notice.
- **Missing tables:** 009 returns empty results with `coverage.available = false`, never an error, so rollback (§15.4) cannot break the page.

## 17. Open questions for the Founder (3)

| # | Question | Recommended answer |
|---|---|---|
| **Q1** | Replace the five structured-note G-SIBs (JPMorgan, Bank of America, Goldman Sachs, Morgan Stanley, Citigroup) with PepsiCo, Union Pacific, Lowe's, Dominion Energy and Welltower, keeping Wells Fargo as the only filter test? | **Yes.** They file 10.6k–22.8k structured 424B2s a year each; plain senior notes are a small fraction and the filter would carry the whole risk. The replacements are verified (8 Oct) and add plain corporate, utility and REIT issuance. |
| **Q2** | For an issuer with no entity in Corporate Atlas (likely the captive finance subsidiaries), ingest its bonds with the issuer **unlinked** plus a DQ ticket, rather than linking to the parent or leaving it out? | **Yes, ingest unlinked.** Linking to the parent would be a wrong-issuer link; leaving it out loses the most frequent issuers on the list. The ticket gets the entity created properly later. |
| **Q3** | Approve CR1: code in `App/Corporate Atlas/bonds/` (not `Fixed Income/src/`)? | **Yes (option A).** It matches the Entities domain and the existing rule for where Entities-domain jobs live, and creates no new top-level tree. |

## 18. Changed since rev 0.2 (`a4dba446…320a`)
- §0–§7, §9–§12 and §14–§17 written in full; the 4 Oct draft list (old §5.1) is superseded by §5; §5 final list (Q1 replacements) and Pack B `entity_id`/LEI for 3 issuers; §13 annotated with the 7 Oct results.
- **§8 changes, all additive (no effect on 007's NavLink or the agreed routes):** `bond_issuer_link` gains `last_polled_at TEXT NULL`; `bond_issuance.filing_status` gains `skipped_structured` and `skipped_other`. Indexes, keys and the §8.3 queries are unchanged.

### 18.1 Changed in rev 1.1 (from rev 1 `f3a350c1…1adb`) — for the Architect's check
| Section | Change | Ops item |
|---|---|---|
| Status line | rev 1.1; cites the Ops review | — |
| §9.3 | Rewritten: A1 `skipped` reason codes (`out_of_window`, `hold`, `pause`); `hold_all_jobs` source (002 route, else one PK read of `holdings_pipeline_state`), fail closed; `d1-today` freshness (≤ 120 s, same UTC date), F-1, F-2, F-3; A-1 / F-5 config values | R-2, R-3, R-4, A-1 |
| §9.4 | `items_attempted` / `items_progressed` replace `items_processed`; `detail.metrics` fixed key set within A1 limits; registry row + `OPS_INGEST_KEYS` entry before first live write; key file location | R-1, N-2, N-3 |
| §12.3 | Freezes added: boost slots, 23:50–00:10 UTC, ENT-CR1 Tue 13 Oct (Wed 14 fallback), relay-declared windows via `--relay-checked` | R-5, F-3 |
| §12.4 (new) | Live-run calendar: Tue–Fri; pilot Thu 15, load Fri 16 Oct, else Tue 27 Oct; multiplier re-declare at > 4.5× | A-1, A-2, N-1 |
| §15.2 | AC8 widened; AC13 widened; AC14 and AC15 added | R-1 to R-4, A-1 |
| §15.3 | Steps 5 and 6 gated on A-1 and N-3; multipliers recorded | A-1, N-1, N-3 |
| Appendix B | L8-7, L8-8 added | — |

**Unchanged from rev 1:** §0–§8, §10, §11, §12.1, §12.2, §13, §14, §15.1, §15.4, §16, §17, Appendix A.

### 18.2 Changed in rev 1.2 (from rev 1.1 `bfa13b61…9cee2`) — Architect delta check
| Section | Change | Item |
|---|---|---|
| Status line, Inputs | Re-cited final inputs on disk: 011 rev 1.8, 013 rev 1.6, 002 rev 1.3, 007 rev 1.2, `FREEZES.json` | A8-1 |
| §7.1 step 3 | Re-parse path: `DELETE` by `parser_version` + incremental run; no in-place updates | A8-4 |
| §7.3 | Rewritten: title-only scope; precedence other → structured → non-debt → debt; structured pattern needs an underlier word and excludes benchmark rates; `\bUnits\b` in the title only | A8-3 |
| §7.4 | Year-only maturity → that tranche `parse_failed` | A8-4 |
| §8 domain paragraph | "Sole inserter"; 013 repoints `entity_id`; ETF-tree reads stated (`issuerperiodsummary`, `issuereventstream`, `holdings_pipeline_state`) | A8-5, A8-6 |
| §8.1 | `status` CHECK is now (`active`, `paused`); `paused` = stop polling, bonds visible; 007 asked to drop its status filter | A8-5 |
| §8.2 | Whole-filing vs per-tranche `parse_failed`; per-tranche rows keep `tranche_seq`, NULL `instrument_key`, 2 writes | A8-4 |
| §8.3 step 1 | `AND status = 'active'` removed (matches R1f) | A8-5 |
| §9.2 | Wrangler pin exactly as ENT-CR1 step 1 (`--version` = 4.96.0, or the node_modules pin after CR-5; never `npx`); literal SQL in batch files | A8-1, EP-1 |
| §9.3 gate 1 | Freezes parsed from `FREEZES.json` at start and before every batch; fail closed if missing | Q-a, A8-2 |
| §9.3 gate 5 | A-1 source of the lag value (Q-b) | Q-b |
| §11.2 | C1 literal form and real read estimate; EP-1 literal binds; Pack C total restated | A8-6, EP-1 |
| §12.2 | "pilot's first live batch" | N8-1 |
| §12.3 | Replaced by the `FREEZES.json` table: enrich **05:50–07:10**, Mon 03:30–08:00, bootstrap 07:55–08:05, boost **10:45–11:15 / 16:45–17:15**, 23:50–00:10, ENT-CR1, 011 | A8-2, Q-a |
| §12.4 | Live runs after 08:05 UTC, outside all windows | A8-2 |
| §14.1 | < 60 → per-tranche `parse_failed` | A8-4 |
| §15.2 | AC14 updated (freeze-file failure); **AC16** (plain SOFR FRN stays `final`), **AC17** (dry-run sign-off of every `skipped_*`), **AC18** (per-tranche `parse_failed` + re-parse) | A8-3, A8-4 |
| §15.3 | Step 2: AC16/AC17; step 5: N8-2 `rows_written` check | A8-3, N8-2 |
| §16 | N8-3 distinct-`cik`-per-`instrument_key` count | N8-3 |
| Appendix B | L8-7 superseded; L8-9, L8-10, L8-11 added | — |

**Already met in rev 1.1 (A8-2 part):** F-1..F-5, the ≤ 120 s fetch age and the UTC-date check (§9.3 gate 5). **Not changed:** N8-4 (retry policy harmonisation, deferred as the review allows) and N8-5 (Operations Lead actions, already in §9.4). **Unchanged sections:** §0–§6, §9.1, §9.4, §10, §11.1, §12.1, §13, §15.1, §15.4, §17, Appendix A.

## Appendix A — SEC request log (lane total: 49 of 50; 41 returned 200, 8 refused by the network allowlist and never reached SEC)
User-Agent `Meridian Atlas navinmv1981@gmail.com`; ≥ 300 ms between requests. Requests 45–49 (8 Oct) verified the five Q1 replacement issuers.

| # | UTC | Status | From | URL |
|---|---|---|---|---|
| 1 | 2026-10-04T08:27:58Z | proxy refused | device | `https://data.sec.gov/submissions/CIK0000019617.json` |
| 2 | 2026-10-04T08:28:17Z | proxy 403 | cloud | `https://data.sec.gov/submissions/CIK0000019617.json` |
| 3 | 2026-10-04T08:31:21Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001571949.json` |
| 4 | 2026-10-04T08:31:26Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000019617.json` |
| 5 | 2026-10-04T08:31:27Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000070858.json` |
| 6 | 2026-10-04T08:31:27Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000072971.json` |
| 7 | 2026-10-04T08:31:28Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000886982.json` |
| 8 | 2026-10-04T08:31:28Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000895421.json` |
| 9 | 2026-10-04T08:31:29Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000831001.json` |
| 10 | 2026-10-04T08:31:29Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000927628.json` |
| 11 | 2026-10-04T08:31:30Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000004962.json` |
| 12 | 2026-10-04T08:31:30Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000764764.json` |
| 13 | 2026-10-04T08:31:31Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000027673.json` |
| 14 | 2026-10-04T08:31:31Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000834071.json` |
| 15 | 2026-10-04T08:31:32Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000804269.json` |
| 16 | 2026-10-04T08:31:32Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000320193.json` |
| 17 | 2026-10-04T08:31:33Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001018724.json` |
| 18 | 2026-10-04T08:31:33Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001326801.json` |
| 19 | 2026-10-04T08:31:34Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001341439.json` |
| 20 | 2026-10-04T08:31:34Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000732717.json` |
| 21 | 2026-10-04T08:31:35Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000732712.json` |
| 22 | 2026-10-04T08:31:35Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001166691.json` |
| 23 | 2026-10-04T08:31:36Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000078003.json` |
| 24 | 2026-10-04T08:31:36Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001551152.json` |
| 25 | 2026-10-04T08:31:37Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000731766.json` |
| 26 | 2026-10-04T08:31:37Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000064803.json` |
| 27 | 2026-10-04T08:31:38Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000012927.json` |
| 28 | 2026-10-04T08:31:38Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000354950.json` |
| 29 | 2026-10-04T08:31:39Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0001326160.json` |
| 30 | 2026-10-04T08:31:39Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000092122.json` |
| 31 | 2026-10-04T08:31:39Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000753308.json` |
| 32 | 2026-10-04T08:31:40Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000726728.json` |
| 33 | 2026-10-04T08:31:59Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926093014/tm2622403-1_424b5.htm` |
| 34 | 2026-10-04T08:31:59Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926093620/tm2622403d3_fwp.htm` |
| 35 | 2026-10-04T08:32:00Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926094253/tm2622403-2_424b5.htm` |
| 36 | 2026-10-04T08:32:01Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525141793/d883518d424b5.htm` |
| 37 | 2026-10-04T08:32:01Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm` |
| 38 | 2026-10-04T08:32:02Z | proxy 403 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm` |
| 39 | 2026-10-04T08:35:39Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926093014/tm2622403-1_424b5.htm` |
| 40 | 2026-10-04T08:35:43Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926093620/tm2622403d3_fwp.htm` |
| 41 | 2026-10-04T08:35:43Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/1326160/000110465926094253/tm2622403-2_424b5.htm` |
| 42 | 2026-10-04T08:35:44Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525141793/d883518d424b5.htm` |
| 43 | 2026-10-04T08:35:44Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525142149/d883518dfwp.htm` |
| 44 | 2026-10-04T08:35:45Z | 200 | cloud | `https://www.sec.gov/Archives/edgar/data/731766/000119312525142782/d883518d424b5.htm` |
| 45 | 2026-10-08T19:47:22Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000077476.json` |
| 46 | 2026-10-08T19:47:23Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000100885.json` |
| 47 | 2026-10-08T19:47:23Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000060667.json` |
| 48 | 2026-10-08T19:47:23Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000715957.json` |
| 49 | 2026-10-08T19:47:24Z | 200 | cloud | `https://data.sec.gov/submissions/CIK0000766704.json` |

## Appendix B — In-lane rulings (for the Main Lane to log)

| # | Ruling | Why |
|---|---|---|
| R1 | Preliminary test on visible text, not raw bytes (4 Oct). | Duke FWP hit appears only after stripping markup. |
| R2 | Preliminary rule on 424B forms only, keyed on "SUBJECT TO COMPLETION" / "is not complete and may be changed" (4 Oct). | 004's bare "PRELIMINARY PROSPECTUS" falsely flags FWPs. |
| R3 | Security-type gate before parsing (4 Oct). | 424B5 carries non-debt deals (Duke Equity Units). |
| L8-1 | Wells Fargo initial load capped at its 60 most recent 424B2s. | 495 424B2s since July 2026; it is a filter test, not a coverage target. |
| L8-2 | `filing_status` adds `skipped_structured` and `skipped_other` (additive). | Coverage must say why a filing was not parsed. |
| L8-3 | `bond_issuer_link` adds `last_polled_at` (additive; not part of NavLink). | 009 freshness per issuer. |
| L8-4 | A subsidiary filer is never linked to its parent entity. | A bond's issuer is the legal filer; anything else is a wrong-issuer link. |
| L8-5 | Pack C (§11.2, ≤ 150 reads) replaces any CIK index for the 27 Pack B misses. | Follows from F2 and the Main Lane's acceptance. |
| L8-6 | SEC requests 45–49 (8 Oct 19:47 UTC) used for the Q1 replacements; lane total 49 of 50. | Within the brief's SEC exception (seed-list checks). |
| L8-7 | ~~Relay-declared freezes are honoured through a mandatory `--relay-checked=<today>` operator flag.~~ **Superseded in rev 1.2** by the parsed `claude/relays/FREEZES.json` check (Main Lane Q-a answer). | Ops R-5 asks the runner to read relay windows at start; NEXT files are prose. |
| L8-9 | `status` has two values (`active`, `paused`); `paused` stops polling only and bonds stay visible; no route filters on `status` (A8-5). | Removes the duplicate "unmatched" meaning and the 007/008 visibility mismatch. |
| L8-10 | A per-tranche `parse_failed` row keeps its `tranche_seq` and fields with `instrument_key` NULL; `tranche_seq = 0` is for whole-filing outcomes only; re-parse = `DELETE` by `parser_version` + incremental run (A8-4). | One meaning per row type; no in-place updates. |
| L8-11 | Classifier precedence other → structured → non-debt → debt, with a benchmark-rate exclusion on "linked to" (A8-3). | Prevents false skips of plain SOFR floating-rate notes. |
| L8-8 | The A-1 / F-5 values (`account_ceiling`, `unpolled_window_min`) are explicit config with no default; a live run refuses to start without them. | A silent 70k default would bypass A-1. |
