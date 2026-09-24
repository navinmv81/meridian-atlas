# MA-OCT-004 — Fixed Income Bond Data Specification

```
ROLE: Data-Identity Lead
LANE: Data-Identity
PACKET: MA-OCT-004
EXECUTE FROM: Fixed Income/src/ (new domain — create folder if not present)
```

---

## Problem Statement

Meridian Atlas currently has no bond-level fixed income data — only macro/economic yield curve data. This packet adds real corporate bond issuance data: principal amount, coupon, maturity, and issuer linkage, sourced exclusively from SEC EDGAR.

---

## Explicit Scope Boundary

**In scope:** Corporate bond issuance reference data — principal amount, coupon/interest rate, maturity date, tranche structure, issuer identity — extracted from SEC prospectus supplement filings.

**Out of scope (do not build):**
- Municipal bonds (MSRB EMMA is legally disqualified — see October Scope Document Revision Note).
- Trade-level bond pricing or secondary market data (requires FINRA TRACE — pending the FINRA entitlement assessment carried over from September; not decided).
- Any bond data requiring a paid subscription or entitlement agreement.

---

## Data Source — Verified This Sprint

**Discovery layer:** `data.sec.gov/submissions/CIK{10-digit-cik}.json` — free, no API key, JSON-formatted, returns full filing history per issuer including form type, filing date, and accession number. Already proven working against CIK 0001571949 (Intercontinental Exchange) — returned 26 relevant filings (`424B2`, `424B3`, `424B5`, `424B7`, `FWP`) spanning 2020–2026 in a single request.

**Document layer:** Filings are fetched at `sec.gov/Archives/edgar/data/{cik}/{accession-no-dashes}/{primary-document-filename}` — a stable, predictable URL pattern already used by `meridian-filings`. Confirmed working: fetched a 529,841-byte HTML document from this exact pattern in this session with no authentication.

**Target form types:** `424B2`, `424B3`, `424B5`, `424B7` (prospectus supplements — different subtypes for different offering structures), `FWP` (free-writing prospectus — often filed a day or two before the priced 424B, contains preliminary marketing terms).

---

## Critical Finding This Sprint: Preliminary vs. Final Filings

Real-world verification against ICE's 2026-08-11 424B5 filing revealed that companies frequently file a **preliminary** prospectus supplement first (header text: "SUBJECT TO COMPLETION, DATED [date]... PRELIMINARY PROSPECTUS SUPPLEMENT"), with every numeric field blank (e.g. "$___ FLOATING RATE SENIOR NOTES DUE 20__"), followed by a **final, priced** version days later once terms are set. In ICE's case: preliminary filed 2026-08-11, final priced version filed 2026-08-13, same offering.

**Mandatory parsing rule:** Any filing containing the strings "SUBJECT TO COMPLETION" or "PRELIMINARY PROSPECTUS" in its first 2,000 characters must be flagged as `preliminary` and excluded from numeric extraction — either skipped entirely, or stored with a `status = 'preliminary'` flag and revisited once the final version is detected. **This must be validated against a second real example before build begins** (per the October Operating Kit's build gate) — the ICE case alone is not sufficient confirmation of the pattern's consistency across issuers.

---

## Proposed Schema

**New table: `bond_issuance`**

| Column | Type | Notes |
|---|---|---|
| `issuance_id` | INTEGER PRIMARY KEY | |
| `entity_id` | INTEGER | FK to `entity_master`, resolved via CIK |
| `cik` | VARCHAR | Issuer CIK, direct from filing |
| `accession_number` | VARCHAR | Source filing reference |
| `form_type` | VARCHAR | 424B2/424B3/424B5/424B7/FWP |
| `filing_date` | VARCHAR | |
| `filing_status` | VARCHAR | `preliminary` or `final` |
| `tranche_label` | VARCHAR | e.g. "Floating Rate Senior Notes due 2029", "4.25% Senior Notes due 2036" |
| `principal_amount` | DECIMAL | NULL if preliminary/unparsed |
| `coupon_rate` | DECIMAL | NULL for floating-rate tranches |
| `rate_type` | VARCHAR | `fixed` or `floating` |
| `floating_rate_spread_bps` | INTEGER | Only populated for floating tranches |
| `maturity_date` | VARCHAR | NULL if unparsed |
| `use_of_proceeds` | VARCHAR | Free text, truncated — e.g. "MarketAxess Acquisition funding" |
| `source_url` | VARCHAR | Direct link to the filing document |
| `ingested_at` | VARCHAR | |

**Linkage:** `entity_id` resolved the same way `issuerfilingmaster` already resolves CIK → entity — reuse existing lookup logic rather than building a new matching path.

---

## Worker Design

**New Worker:** `meridian-bonds`, located at `Fixed Income/src/bonds-pipeline.js`.

**Trigger:** On-request initially (matching the pattern of `meridian-filings` and `meridian-13f`, both no-cron/on-request) — cron can be added in a later packet once a stable target issuer list and cadence are defined. Do not enable a cron trigger for this Worker without the three-point check, per Non-Negotiable Rules.

**Processing steps:**
1. Query `data.sec.gov/submissions/CIK{cik}.json` for a given issuer (initially: a manually seeded list of well-known bond issuers, not the full ~11,111-entity universe — see Phased Rollout below).
2. Filter for target form types within a configurable lookback window.
3. Fetch each matching document.
4. Check first 2,000 characters for preliminary-filing markers; tag accordingly.
5. For final filings only: parse cover-page tranche structure via regex against known patterns (e.g. `\$[\d,]+ ([\d.]+)% Senior Notes due (\d{4})`, `Floating Rate Senior Notes due (\d{4})`).
6. Write to `bond_issuance`, respecting the standard headroom-based write guard and mid-loop checkpoint used by every other D1-writing pipeline.

---

## Phased Rollout (Recommended, Not Optional)

**Phase 1 (October):** Seed with a small, manually curated list of 20–30 large, frequent bond issuers (financial institutions, large-cap industrials) to validate the parsing logic against real variation in filing structure before any attempt at broad coverage. This directly addresses the "must validate against a second real example" gate above, at manageable scale.

**Phase 2 (deferred, not October):** Expand to a broader issuer set once Phase 1's parsing accuracy is confirmed acceptable — the exact expansion mechanism (full `entity_master` sweep vs. targeted expansion) is a decision for a future `/roadmap-update`, not assumed here.

---

## Done-Condition for MA-OCT-004

- `meridian-bonds` Worker live, callable on-request.
- `bond_issuance` table populated with final (non-preliminary) tranche data for at least the Phase 1 seed list.
- Preliminary-filing detection validated against at least two independent real issuer examples (ICE plus one other).
- Each `bond_issuance` row correctly linked to `entity_master` via CIK.
- UI surfacing deferred to a future packet — MA-OCT-004 is data-layer only; no frontend display work is in scope for this packet.

---

## Open Questions to Resolve Before Build (Not During)

1. Which 20–30 issuers form the Phase 1 seed list — Founder input needed.
2. Exact regex patterns for coupon/maturity extraction — needs testing against the seed list's actual filing variety, not assumed from the ICE example alone.
3. Whether `FWP` filings should be parsed independently or only used to confirm/cross-check the subsequent priced 424B — recommend treating FWP as informational-only for v1, priced 424B as the authoritative source.
