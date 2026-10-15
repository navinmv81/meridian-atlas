# MA-OCT-007 — Standalone Instrument–Issuer Navigation: Spec

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Engineering Lead (packet owner; wrote this spec) — build executor: Engineering Lead
REVIEWED BY:  UX Lead + Data-Identity Lead (Fri 9 Oct). ETF Product Lead consulted on ETF screens (consent gate, §9).
APPROVED BY:  Founder — spec approval Mon 12 Oct; Founder UAT in Wave 3 (19–29 Oct)
PACKET:       MA-OCT-007 — Standalone instrument–issuer navigation
GATE:         Spec Thu 8 Oct → reviews Fri 9 Oct → Founder Mon 12 Oct → build Wave 2 (ticket button last, after 004)
LANE:         Platform (SPEC ONLY). Doc-only. No D1 queries, no git writes, no deploys.
BASELINE:     /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11), branch October-2026, HEAD 658326a
BRIEF:        claude/MA-OCT-007_Spec_Brief.md  SHA-256 d57ed1dc…e2b8 (verified in full on Day 1)
```

**Status:** rev 1.3, 10 Oct 2026 (packet MA-OCT-007.R13, Control v1). It applies exactly the five items queued 5–9 Oct and nothing else: (1) R5 batch reads in §7.2 and §11.1; (2) R1f and P10 added to T6; (3) P5 expected-plan cell replaced with the plan observed 7 Oct; (4) A8-5 follow-on in §3.6 (no `status` filter on issuer → bonds); (5) 008 re-cited at rev 1.2 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`. Plus one Appendix A results reference line. Previous version: rev 1.2 `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703`.

*Rev 1.2 status (kept for trace):* rev 1.2, 5 Oct 2026 (due Thu 8 Oct). It adds only the bond join agreed with 008 (Data-Identity Lead): §3.5 now points to a new §3.6; R1f is added to §5.1, §7.2 and §11.1; plan check P10 is added to Appendix A.3; O1 is closed; one decision row is added to Appendix B. Source: `claude/MA-OCT-008_Spec.md` rev 0.2 `a4dba4466394506387ad0e55d67ce911521e3ba535836755d50c45b611ce320a`, §8.1–§8.3. Reviewers may review rev 1.1 as-is and check §3.6 (with R1f and P10) separately. Previous version: rev 1.1 `af45b3dffb69ebd03db20aace7074401277281fc5b8a2cf0e3fde16eff26e3f0`.

*Rev 1.1 status (kept for trace):* rev 1.1, 4 Oct 2026 (due Thu 8 Oct). It applies the Founder's four pre-review fixes and nothing else: (1) Appendix A size probes and conditional splits and totals; (2) Q7 split into 4 rowid ranges; (3) cross-reference fixes in AC6 and §1.3; (4) R5 typical and worst-case reads. Previous version: rev 1 `557a2c07f498500909dec644a2c8480da4425d32af2899a6a713d3cd5dcfcc9a`. Incorporates the Main Lane's Day-1 rulings A–D of 4 Oct (§0.2). Every D1 fact below that is not marked *measured* is an estimate; the read-only query pack in Appendix A turns each into a measured number before build.

---

## 0. Inputs, rulings and how to read this spec

### 0.1 Inputs read (hash prefix…suffix of SHA-256)

| Input | Hash | Used for |
|---|---|---|
| `claude/MA-OCT-007_Spec_Brief.md` | `d57ed1dc…e2b8` | Scope 1–7, "must define" 1–5 |
| `claude/meridian-october-revised-scope-v2.md` | `967bebd7…e1f33445` | Required journeys and the five acceptance criteria |
| `claude/Meridian_October_Operating_Kit_v3_Addendum.md` | `d816aa2b…aa6cbc46` | D4 (§4), packet register (§5), calendar (§6) |
| `claude/MA-OCT-011_Spec.md` (rev 1.1) | `0cb22279…d2cab761` | LEI additions (L11-7: one row per LEI, S1 side only) |
| `claude/MA-OCT-013_Spec_Brief.md` (rev 1.1) | `829ad1e6…488834f8` | Survivor rule S1, the 7-table repoint, "no `entity_id` index" |
| `claude/MA-OCT-004-Bond-Spec.md` (input to 008) | `90531b57…afdc2a2a` | Bond identifiers (`entity_id` via CIK) |
| `App/Corporate Atlas/src/entities-api.js` | `19993e84…d87fe2f6` | Existing routes, Access JWT precedent |
| `App/ma-entities.js` | `688d1688…7864c638` | Entity detail/overlay, linked instruments, breadcrumb |
| `App/ma-etf.js` | `4f47f9c2…4bea860a` | Holding rows, `handleEntityIconClick` |
| `App/ma-data.js` | `91ec44ba…91a41f7b` | Shared data layer (`data_ops*` pattern) |
| `App/Ops/src/ops-api.js` | `c53f4231…3f0bf2d1` | Access-gated `/api/ops/admin/*` |
| Schema: `migrations/corporate-atlas-v1.sql`, `migrations/002-instrument-entity-map-openfigi-source.sql`, `gleif-schema-migrate.js`, `App/Ops/migrations/002-ops-control-plane.sql` | — | Tables, CHECK enums, indexes, `ops_data_quality_ticket` |
| `gate1-instrument-seed.js` (`deriveInstrumentKey`) | — | How `instrument_key` is formed |
| Known Issues 22.17 and 22.41 (as given by the Main Lane; `Sprint_Board.md` is not in this repo by design) | — | Ambiguous and merge-redirect cases |

### 0.2 Main Lane rulings, 4 Oct (binding on this spec)

| # | Ruling | Where applied |
|---|---|---|
| A | Additive CR: `CREATE INDEX` on `instrument_entity_map(entity_id)`. Entities domain; owner Data-Identity Lead; executes Engineering Lead; review Architect; ≈33k writes; Founder approval Mon 12 Oct; applied Tue 13 Oct, before any 013 merge. **A P1 dependency.** Size issuer-page reads both ways. | §7.3, §11, §12, Appendix A |
| B | 013 owns `entity_merge_redirect(duplicate_id PK, survivor_id, merged_at, packet)`, Entities domain. **007 only reads it.** | §6 |
| C | `ma-13f.js` is out of scope (no changes). | §2, §9 |
| D | ETF screens reach `entities-api` only through `ma-data.js` or DOM events, never by a direct fetch from `ma-etf.js`. | §3.4, §9 |

### 0.3 Terms

- **Instrument**: a row in `instrument_master`, keyed by `instrument_key`.
- **Issuer / entity**: a row in `entity_master`, keyed by `entity_id`.
- **Mapping**: any row that links an instrument to an entity: `instrument_entity_map` (one per `instrument_key`) or `entity_isin_map` (zero or more per ISIN).
- **NavLink**: the navigation contract object (§3.2).

---

## 1. Problem, goals and non-goals

### 1.1 Problem statement

A user looking at a security in Meridian Atlas cannot reliably reach the company that issued it, and from a company cannot see everything it has issued. The one link that exists today (the small "e" icon on equity ETF holding rows) resolves through a route that silently picks one issuer when an ISIN has several (`LIMIT 1`, KI 22.17), greys out with "Entity not yet resolved" for every other outcome, does not exist at all on bond-ETF holding rows, and fetches the Entities Worker directly from the ETF module. In the other direction, the entity page shows at most 75 instruments and labels that number as the total. There are no deep links at all, so a merged entity (KI 22.41, MA-OCT-013 under rule S1) has no way to send an old link to its survivor. The cost: users either see a wrong issuer with no warning or a dead end with no explanation, and October's Fixed Income work would have no shared contract to plug into.

### 1.2 Goals (each is measurable at UAT)

1. **Both directions, any supported instrument.** From every supported instrument row or detail surface, one click reaches the issuer or an explicit state screen; from every issuer page, every linked instrument is reachable through pagination. Target: 100% of the UAT script (§13) passes.
2. **Honest states.** Every resolution ends in exactly one of five states (§5), each visibly labelled with its source and confidence. Target: zero silent picks and zero unexplained grey icons in UAT.
3. **Context survives the round trip.** Closing an issuer view returns the user to the exact origin (same ETF, tab, scroll position; same entity page and linked-instruments page). Target: all round-trip UAT steps pass.
4. **Links survive identity change.** A deep link to an entity id merged by 013 lands on the survivor with a "merged into" notice. Target: AC6 passes on the first 013 merge batch.
5. **Within the D1 budget.** Every new query executes at ≤ 50k rows read; an issuer page after the index costs ≈ 50–1,050 reads, not ≈ 33k–66k (§11).

### 1.3 Non-goals (v1)

| Non-goal | Why |
|---|---|
| Fixing any mapping (adding, deleting, re-scoring rows) | Mapping repair belongs to Entities-domain packets (011, 013, KI 22.17). 007 shows states; it never changes them. |
| Executing merges or creating `entity_merge_redirect` | Ruling B: 013 owns the table; 007 only reads it. |
| Changes to `ma-13f.js` | Ruling C. 13F already opens the entity overlay; it inherits the redirect handling for free. |
| Linking the stock quote modal (`ma-modal.js`) or Market screens | Those surfaces are keyed by market symbol (Yahoo), not `instrument_key`. A symbol → instrument mapping is ambiguous (`TICKER:` keys) and would need its own design. Left to a later packet; not specified here. |
| Building the Fixed Income page or bond routes | 008/009/010 own them. 007 defines the contract they plug into (§3.5). |
| A front-end write of any kind, including ticket creation | D4. The ticket button is a link-out to an Access-gated Ops page (§8). |
| A new Worker | Not justified; all routes are additive on `meridian-entities-api` (§7). |

---

## 2. Current state (code evidence, 4 Oct)

| # | Finding | Evidence | Consequence for 007 |
|---|---|---|---|
| E1 | No deep-link routing anywhere in the front end: no `location.hash`, `hashchange`, `pushState` or `popstate`. | grep over `App/*.js`, `App/index.html` | A small hash router is new work (§3.3). |
| E2 | ETF holding → issuer exists only for **equity-style rows that carry an ISIN**: `handleEntityIconClick(el, isin)` fetches `meridian-entities-api/api/entities/isin/:isin` **directly from `ma-etf.js`**, then calls `showEntityOverlay()`. | `ma-etf.js:1973–1976`, `:2989–3027` | Violates ruling D; rewired through a DOM event (§9.1). |
| E3 | On any failure the icon greys out permanently with "Entity not yet resolved" — not-found, ambiguous and network error all look the same. | `ma-etf.js:3018–3025` | Fails Scope v2 "explicit states". Replaced by §5. |
| E4 | Bond-ETF holding rows (the `isBondEtf` branch) show CUSIP and no entity link at all. | `ma-etf.js:1940–1952` | J1 adds a link keyed by `CUSIP:{cusip}` (§3.1). |
| E5 | `/api/entities/isin/:isin` returns `LIMIT 1` from `entity_isin_map` → `entity_master` and returns `em.*`. | `entities-api.js:328–341` | Hides KI 22.17 ambiguity; kept for back-compat, not used by 007. |
| E6 | `/api/entities/:id/instruments` returns at most 75 rows, no cursor, no total, ordered `asset_cat, security_name, source`; the UI then labels the count as "N matched instruments" and offers "Show all N". | `entities-api.js:302–325`, `ma-entities.js:1161–1215` | A 75-row truncation is presented as the total. Replaced by keyset paging with an honest count (§7.2). |
| E7 | **There is no index on `instrument_entity_map(entity_id)`** (also 006 D0). E6's `WHERE iem.entity_id = ?` therefore scans the whole map on every entity page view today: ≈ 32,769 rows (Main Lane figure from MA-SEP-007; Appendix A Q1 measures it). | DDL in `corporate-atlas-v1.sql`, `002-…openfigi-source.sql` (table recreated without one); grep of all repo DDL | Ruling A index is a hard P1 dependency (§12). It also fixes today's cost of E6. |
| E8 | `instrument_key` is deterministic: the 12-char ISIN if present; else `CUSIP:{cusip}` (≥ 6 chars); else `TICKER:{UPPER}`; else `NAME:{UPPER_UNDERSCORED, ≤80}`. | `gate1-instrument-seed.js:51–62` (same in `gate1-instrument-resume.js`, `task_6a_…`) | The front end can derive the key from a holding row without a lookup; resolution is a PK read (§3.1). No CUSIP index is needed. |
| E9 | `instrument_entity_map` has `instrument_key` as PRIMARY KEY, so it holds **at most one issuer per instrument**. `source ∈ {cusip_tier1, isin_tier1, heuristic, openfigi_tier1}`; OpenFIGI confidence is fixed at 70. | `002-…openfigi-source.sql`, `entities-figi.js:77` | Ambiguity can only come from `entity_isin_map` or from the two tables disagreeing (§5). |
| E10 | `entity_isin_map` is PK `(isin, lei)` with `entity_id` **nullable**; `match_source ∈ {isin_direct, firds_direct}`; indexes on `isin`, `lei`, `entity_id`. | `gleif-schema-migrate.js:116–134`, `entities-api.js:236` | Several rows per ISIN = KI 22.17 ambiguous; `entity_id IS NULL` = "LEI known, entity not in Atlas". |
| E11 | Past merges (MA-SEP-001, MA-SEP-007) **deleted the loser rows and `DROP`ped their merge maps**. The repo's SQL files list ≈ 2,600 loser ids across five files (pattern count of each file's first map `INSERT`; not verified against what executed). | `ma-sep-001-merge-migration.sql:91–94`, `ma-sep-007-merge-migration.sql:91–95` | Ids merged before 013 have no redirect row. Fallback state required (§6.5). |
| E12 | `showEntityOverlay(entityId, backLabel)` draws on top of the current panel without destroying it; `restoreEntityPreviousView()` removes the overlay. `ma-13f.js:535` uses the same overlay. | `ma-entities.js:1229–1335` | Overlay already preserves ETF context; 007 builds on it. |
| E13 | `ma-data.js` already hosts shared Worker wrappers (`data_opsGet`, `data_opsPost`) with a note that new code should route through the data layer. | `ma-data.js:164–194` | Ruling D's path: add `data_entitiesGet` and `data_instrumentKey` here (§9.1). |
| E14 | Access precedent: `entities-api` verifies `Cf-Access-Jwt-Assertion` for `/exceptions*` (MA-SEP-015b; team domain and `aud` in `wrangler-entities-api.toml`); `meridian-ops` does the same for `/api/ops/admin/*` (MA-OCT-001). `ops_data_quality_ticket` exists (Ops migration 002) with `dedupe_key UNIQUE`, `raised_by`, `raised_via`. | `entities-api.js:703–786`, `wrangler-entities-api.toml:10–18`, `ops-api.js:887–908` | Basis for the ticket-button recommendation (§8). The 004 ticket-create route does not exist yet. |

---

## 3. Navigation contract (Scope 1)

### 3.1 Canonical identifiers

| Object | Key | Format | Rule |
|---|---|---|---|
| Entity | `entity_id` | positive integer | The only key for an issuer. Names, LEIs and CIKs are context. |
| Instrument | `instrument_key` | string, per E8 | The only key for an instrument. ISIN, CUSIP and ticker are context and lookup inputs, never keys in URLs or in client state. |

**Key derivation in the browser.** `ma-data.js` gets `data_instrumentKey({isin, cusip, ticker, name})`, a byte-for-byte port of `deriveInstrumentKey` (E8), with a unit test that runs the same fixtures through both (§14.1). This is the single place the rule lives on the front end.

### 3.2 The NavLink object (one contract for every source)

Every API response that links an instrument to an issuer returns this shape — OpenFIGI-backed rows now, SEC bond rows from 008/009 later:

```json
{
  "instrument_key": "US5949181045",
  "identifiers": { "isin": "US5949181045", "cusip": "594918104", "ticker": "MSFT" },
  "asset_type": "EC",
  "name": "MICROSOFT CORP",
  "state": "matched",
  "reason": null,
  "candidates": [
    {
      "entity_id": 1234,
      "name": "MICROSOFT CORPORATION",
      "lei": "<20-char LEI>",
      "source": "openfigi_tier1",
      "source_table": "instrument_entity_map",
      "confidence": 70,
      "confidence_band": "medium",
      "redirect": null
    }
  ],
  "as_of": "2026-08-31T…Z"
}
```

| Field | Meaning |
|---|---|
| `state` | `matched` · `low_confidence` · `ambiguous` · `unmatched` (§5). Merge redirection is carried per candidate in `redirect`, not as a state, because it can combine with any of them. |
| `reason` | A machine code for non-matched states: `isin_duplicate`, `source_conflict`, `no_mapping`, `lei_only`, `not_in_universe`, `redirect_unresolved`. |
| `candidates[]` | Zero or more, deduplicated by resolved `entity_id`, sorted by confidence then `entity_id`. Capped at 10; `candidates_truncated: true` if more. |
| `source` | Raw value from the mapping table (`openfigi_tier1`, `cusip_tier1`, `isin_tier1`, `heuristic`, `isin_direct`, `firds_direct`; later `sec_bond`). Never hidden. |
| `confidence` / `confidence_band` | Raw 1–100 integer plus band (§5.2). |
| `redirect` | `null`, or `{ "requested_id", "resolved_id", "chain": [..], "merged_at", "packet" }` (§6). |
| `as_of` | The mapping row's `created_at` / `mapped_at`, so freshness is visible. |

**Extensibility rule for 008/009.** A new mapping source adds a new `source` string and fills the same fields. It must not add a new state or a new key type. A bond whose issuer is resolved via CIK returns `source: "sec_bond"`, `source_table` naming its own table, and a `confidence` set by the 008 spec.

### 3.3 Deep-link routes (hash, GitHub Pages–safe)

| Route | Opens | Example |
|---|---|---|
| `#/entity/{entity_id}` | Issuer view (overlay or Corporate Atlas panel) | `#/entity/1563` |
| `#/instrument/{encodeURIComponent(instrument_key)}` | Instrument card (§4.1) | `#/instrument/CUSIP%3A594918AB0` |
| Optional query `?from={origin}` | Where Back returns to | `#/entity/1563?from=etf%3AVTI%3Aholdings` |

- `origin` grammar: `etf:{symbol}:{tab}` · `entity:{id}:{page}` · `instrument:{key}` · `direct`.
- Hash routing needs no server rewrite, so it works on GitHub Pages `/docs`.
- **Router location:** a ≈40-line inline script in `index.html` (the shell). It parses the hash and dispatches `document.dispatchEvent(new CustomEvent('ma:route', {detail}))`. Domain modules listen; the router imports nothing, so domain boundaries hold.
- Each in-app navigation does `history.pushState` with the new hash, so the browser Back button walks the trail. When the API resolves a merged id, the router calls `history.replaceState` with the survivor's id, so a re-shared link is canonical.
- An unknown or malformed route shows the normal home screen plus a one-line toast ("That link isn't valid"). It never throws.

### 3.4 Events between modules (ruling D)

| Event | Fired by | Handled by | `detail` |
|---|---|---|---|
| `ma:route` | `index.html` router | `ma-entities.js` | `{ type: 'entity'|'instrument', id, from }` |
| `ma:open-instrument` | `ma-etf.js` holding row | `ma-entities.js` | `{ instrument_key, isin, cusip, ticker, name, asset_type, from }` |
| `ma:instrument-state` | `ma-entities.js` after resolving | `ma-etf.js` (restyles its own icon) | `{ instrument_key, state, confidence_band }` |

`ma-etf.js` never calls `entities-api`. If it later needs data (the P1 batch badges, R5), it calls `data_entitiesGet()` in `ma-data.js`.

### 3.5 Bond contract (J3; contract only now)

- **Key:** a bond uses the same `instrument_key` rule: ISIN if 12 chars, else `CUSIP:{cusip9}`. 008 must not invent a third key form.
- **Bond → issuer:** the 010 bond detail emits `ma:open-instrument` (or links to `#/entity/{entity_id}?from=bond:{key}`) with a NavLink whose `source` is `sec_bond`. The issuer view treats it like any other.
- **Issuer → bonds:** agreed with 008. 009 serves `GET /api/fi/issuers/{entity_id}/bonds` and the issuer view renders it as a second section. Bonds are **not** written into `instrument_master` / `instrument_entity_map`. See §3.6.
- **Conformance check:** when 009 lands, the build lane runs a contract test (§14.1, T9) against a real 009 response.

### 3.6 Agreed bond join with 008 (008 §8.1–§8.3, rev 1.2)

Source: `claude/MA-OCT-008_Spec.md` rev 1.2 `bcdad9a2…5cd3`, §8.1–§8.3 (agreed at rev 0.2 `a4dba446…320a`, 5 Oct). 008 has accepted 007's notes (a) collect across every CIK linked to the `entity_id`, and (b) index `idx_bi_cik_final_key`. This closes O1.

008 rev 1.2 adds L8-2 (`filing_status` values `skipped_structured`, `skipped_other`) and L8-3 (`bond_issuer_link.last_polled_at`). Both are additive and affect neither R1f (`filing_status = 'final'`) nor the NavLink contract.

**Tables (Entities domain; the 008 runner is the only writer; 007 only reads):**

| Table | Key | Content used by 007 |
|---|---|---|
| `bond_issuer_link` | PK `cik` (≈ 30 rows, one per issuer) | `entity_id` (NULL = unmatched), `link_method`, `confidence`, `status`, `linked_at`, `verified_at` |
| `bond_issuance` | PK `(accession_number, tranche_seq)` | `cik`, `instrument_key` (E8 rule, or NULL if the filing has neither ISIN nor CUSIP), `filing_status` |

**NavLink fields for a bond candidate:** `source: "sec_bond"`, `source_table: "bond_issuer_link"`, `asset_type: "DBT"`, `as_of = COALESCE(verified_at, linked_at)`. Bands (§5.2) from `link_method`:

| `link_method` | `confidence` | Band / state |
|---|---|---|
| `cik` | 95 | high |
| `lei` | 85 | medium |
| `manual` | 100 | high |
| `unmatched` | 1 (`entity_id` NULL) | state `unmatched` |

**Bond → issuer:** R1f (§5.1, §7.2), optional, switched on once 008's tables exist.

**Issuer → bonds** (009 `GET /api/fi/issuers/{entity_id}/bonds?limit=25&cursor=`; second section on the issuer view):
- Resolve `entity_id` through R3 (§6.2) first; use `resolved_id` from then on.
- Read the linked CIKs (`bond_issuer_link WHERE entity_id = ?`, `idx_bil_entity`; no `status` filter, matching 008 rev 1.2 §8.3 step 1 and R1f).
- `status` ∈ (`active`, `paused`); `paused` = stop polling SEC only, bonds stay visible (008 A8-5).
- Run one keyset query per linked CIK on `idx_bi_cik_final_key`, all in a single `db.batch()`. Merge in the Worker by `(maturity_date, accession_number, tranche_seq)`, with **one cursor across all CIKs** (the global tuple), so no CIK is skipped or repeated. No single `cik IN (…)` statement (it would need a temp B-tree sort).
- Limit: default 25, maximum 100.
- Reads: at most 26 × *n*CIK + *n*CIK per page (27 for one CIK; 81 at 3 CIKs). Plus R3: +0 on a hit, ≤ 7 on a redirect.
- Plan check: 008's **P-B1** must show `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key` with **no** temp B-tree.

**Merges:** 013 repoints `bond_issuer_link.entity_id` (≤ 30 rows) under rule S1 when it merges. R3 remains the read-time backstop for any id not yet repointed.

---

## 4. Journeys (Scope 2)

### 4.1 J1 — Instrument row or detail → issuer

**Supported surfaces in v1:** ETF holding rows (equity and bond branches, `ma-etf.js`); Corporate Atlas linked-instrument rows (`ma-entities.js`); the new Instrument card.

**The Instrument card** (`#/instrument/{key}`, rendered by `ma-entities.js` as an overlay) is the v1 "instrument detail surface". It shows name, all identifiers present, asset type, state badge, source, confidence and `as_of`, and then:

| State | What the card shows |
|---|---|
| `matched` | Issuer row with "Open issuer". |
| `low_confidence` | Issuer row with an amber "Low confidence" badge, the reason line ("matched by heuristic, confidence 55"), and "Open issuer". |
| `ambiguous` | A chooser listing every candidate (name, LEI, source, confidence); no default is selected (Founder Q3). |
| `unmatched` | "No issuer linked" with the reason (`no_mapping`, `lei_only` with the LEI shown, `not_in_universe`), plus the report button when P4 ships. |

**Click behaviour from a row:**

1. The user clicks the issuer icon on a holding row. `ma-etf.js` derives the key via `data_instrumentKey`, fires `ma:open-instrument` with `from = etf:{symbol}:{tab}`.
2. `ma-entities.js` calls R1 (`GET /api/instruments/{key}`).
3. If `state = matched` with exactly one candidate, it opens the issuer overlay directly, with a provenance strip at the top: "Reached from *MICROSOFT CORP* · ISIN US5949181045 · OpenFIGI · confidence 70 (medium) · View instrument". One click, no extra card.
4. Any other state opens the Instrument card instead.
5. `ma-entities.js` fires `ma:instrument-state`; `ma-etf.js` restyles that row's icon (§5.3).

### 4.2 J2 — Issuer → linked instruments

- The issuer view's "Linked instruments" section calls R2 with `limit=25`.
- Header: "Linked instruments · *N*" where *N* is exact up to 1,000, else "1,000+".
- Each row shows name, ticker, the distinguishing identifier (existing `_instrumentRowHtml` logic), asset type, source badge and confidence band.
- "Show 25 more" appends the next keyset page (progressive disclosure). A user-selectable page size of 25/50/100 is P1. No page ever fetches more than 100 rows.
- Clicking a row opens its Instrument card (`from = entity:{id}:{page}`), so J2 → J1 is a round trip.
- An issuer with zero linked instruments shows "No linked instruments in Meridian Atlas" — not an error.

### 4.3 J3 — Bond detail ↔ issuer

Contract only (§3.5). Wired by 009/010. P2 in this spec.

### 4.4 Context preservation (all journeys)

| From | To | Back returns to | How |
|---|---|---|---|
| ETF holdings (any tab, scrolled) | Issuer overlay | The same ETF, tab, scroll, sort | The overlay sits on top; the ETF DOM is never touched (E12). AC2 checks scroll. |
| Issuer page, linked-instruments page *k* | Instrument card → its issuer | The original issuer, with pages 1…*k* already loaded and the scroll position restored | The issuer view keeps its cursor stack and scroll offset in a per-overlay object; the card is a new overlay layer. |
| Instrument card | Issuer (ambiguous chooser pick) | The card, still showing the chooser | Overlay stack. |
| Deep link, cold load | Issuer or card | Home, or `from` if present | `from` is parsed; if the origin can't be rebuilt (for example an ETF tab), Back goes to that ETF's default tab. |

The browser Back button and the in-app "← Back" control give the same result (§3.3).

---

## 5. Mapping states (Scope 3)

### 5.1 Resolution rule (server side, in R1)

1. Look up `instrument_master` by `instrument_key` (PK). Miss → remember `not_in_universe`; continue with the ISIN if the caller supplied one.
2. Look up `instrument_entity_map` by `instrument_key` (PK) → zero or one candidate.
3. Look up `entity_isin_map` by ISIN (index `idx_entity_isin_map_isin`), `LIMIT 11` → zero or more rows. Rows with `entity_id IS NULL` don't become candidates; they set `reason = lei_only` if nothing else matches.
3a. **R1f (optional; on once 008's tables exist):** `SELECT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' LIMIT 1`, then a PK lookup on `bond_issuer_link` by that `cik` → zero or one candidate (`source: "sec_bond"`, §3.6). A missing table is treated as "no candidate", as R3 does. A `bond_issuer_link` row with `entity_id` NULL is not a candidate. About 2 reads.
4. Resolve every candidate `entity_id` through `entity_master` (PK). A miss goes to the redirect path (§6).
5. Deduplicate by resolved `entity_id`; keep the highest confidence and list all sources.
6. Decide the state:

| Distinct resolved candidates | Condition | `state` | `reason` |
|---|---|---|---|
| 0 | — | `unmatched` | `lei_only` · `not_in_universe` · `no_mapping` · `redirect_unresolved` |
| 1 | band is `low` | `low_confidence` | `null` |
| 1 | band is `medium` or `high` | `matched` | `null` |
| ≥ 2 | several `entity_isin_map` rows (**KI 22.17**) | `ambiguous` | `isin_duplicate` |
| ≥ 2 | `instrument_entity_map` and `entity_isin_map` disagree, or R1f (`bond_issuer_link`) gives a differing issuer | `ambiguous` | `source_conflict` |

Note: two `entity_isin_map` rows that resolve (directly or via redirect) to the same survivor collapse to one candidate. This is what makes a merged twin pair stop looking ambiguous after 013.

### 5.2 Confidence bands (Founder Q2)

| Band | Rule | Today's sources |
|---|---|---|
| high | confidence ≥ 90 and source ≠ `heuristic` | `cusip_tier1`, `isin_tier1`, `isin_direct`, `firds_direct` (default 100) |
| medium | 70–89 and source ≠ `heuristic` | `openfigi_tier1` (fixed 70) |
| low | confidence < 70, **or** source = `heuristic` | `heuristic` |

The raw number is always shown next to the band. Appendix A Q2 measures how many rows fall in each band before UAT.

### 5.3 Display rules (every surface)

- Badge text and colour per state: Matched (teal), Low confidence (amber), Ambiguous (orange), Unmatched (grey with a "?" glyph), plus a "Merged" chip when `redirect` is set.
- Source label and confidence number appear next to the badge, never only in a tooltip.
- ETF row icon after resolution: teal "e" (matched), amber "e!" (low), orange "e?" (ambiguous), grey "e–" (unmatched, **still clickable**, opens the card with the reason). The current permanent `pointer-events:none` grey-out is removed.
- A network or 5xx failure is **not** a mapping state: the icon shows "retry" and a toast says "Couldn't reach Corporate Atlas", so outages are never shown as "unmatched".
- Colour is never the only signal: each badge has text, for accessibility.

---

## 6. Identity changes during October (Scope 4, ruling B)

### 6.1 What changes

- **011** adds about 3.7k LEIs to existing rows on the S1 side (L11-7). Keys don't change; a LEI shows up on the next fetch. No 007 handling needed beyond not caching entity payloads across sessions.
- **013** merges KI 22.41 twins under S1 (the older, LEI-bearing row survives), repoints the 7 tables (including `instrument_entity_map` and `entity_isin_map`), deletes the twin, and writes `entity_merge_redirect(duplicate_id, survivor_id, merged_at, packet)`. After 013, every mapping already points at the survivor, so **live resolution is correct without redirects**. Redirects matter for deep links, shared URLs, browser history, and client state held across the merge (breadcrumbs, open overlays).

### 6.2 Resolution order (R3, every route that takes an `entity_id`)

1. `SELECT … FROM entity_master WHERE entity_id = ?` (PK). Hit → return it, `redirect: null`.
2. Miss → `SELECT survivor_id, merged_at, packet FROM entity_merge_redirect WHERE duplicate_id = ?` (PK). Hit → append to the chain, set the id to `survivor_id`, go to step 1.
3. **Hop limit 3** (A→B→C→D is the most that's followed; 013 should never produce more than 1, so 3 is a safety margin). A 4th hop → stop with `redirect_too_deep`.
4. **Cycle guard:** if an id repeats in the chain → stop with `redirect_cycle`.
5. Miss in both tables → `gone` (§6.5).
6. **Missing table tolerance:** until 013 creates `entity_merge_redirect`, the query fails with "no such table"; the Worker treats that as "no redirect row" (step 5). So R3 can ship before 013.

Worst case reads: 4 PK lookups on `entity_master` + 3 on the redirect table = **≤ 7 reads**, plus 1 for a normal hit.

### 6.3 API response shape

`GET /api/entities/:id` keeps today's body and adds one field. Status is **200** for a followed redirect (one round trip; no client re-fetch):

```json
{
  "entity": { "entity_id": 2730, "name": "Bayer Aktiengesellschaft", "...": "..." },
  "redirect": {
    "requested_id": 25782,
    "resolved_id": 2730,
    "chain": [25782, 2730],
    "merged_at": "2026-10-27T…Z",
    "packet": "MA-OCT-013"
  }
}
```

Failure bodies:

| HTTP | Body | When |
|---|---|---|
| 404 | `{ "error": "not_found", "state": "gone", "requested_id": 25782 }` | No entity row and no redirect row (includes pre-013 merges) |
| 409 | `{ "error": "redirect_unresolved", "state": "redirect_too_deep" \| "redirect_cycle", "chain": [...] }` | Hop limit or cycle |
| 200 + `redirect`, survivor missing | treated as `gone` with `chain` included | Redirect points at a deleted row |

The id-scoped sub-routes used by 007 (R2) apply the same order and return `{ "redirect": {...} }` alongside data for the survivor. Existing sub-routes (`/graph`, `/etf-exposure`, `/exposure`, `/issuer-panels`) are not changed: the front end always resolves the id via R3 first, then calls sub-routes with `resolved_id`.

### 6.4 Front-end handling and the "merged into" notice

- On `redirect != null`, the issuer view renders a notice above the header:
  > *(Illustrative ids and date.)* **Merged record.** Entity #25782 was merged into **Bayer Aktiengesellschaft (#2730)** on 27 Oct 2026 (MA-OCT-013). You are viewing the surviving record.
  For a chain, it reads "…merged (via #B) into…".
- The router `replaceState`s the hash to the survivor id; breadcrumbs that held the old id are rewritten.
- NavLink candidates carrying `redirect` show a small "Merged" chip in the Instrument card.
- `redirect_too_deep` / `redirect_cycle`: show the fallback (§6.5) with the text "This record's merge history couldn't be resolved," and log `console.warn` with the chain (for UAT evidence). P4 adds the report button here.

### 6.5 Fallback: ids merged before 013, or with no redirect row

- Ids removed by MA-SEP-001 / MA-SEP-007 (≈ 2,600 listed in repo SQL, E11) and any other deleted id return `gone`.
- The view shows: "This entity is no longer in Meridian Atlas. It may have been merged into another record." Then a search box prefilled with the last known name (from the `from`/breadcrumb context if present; else empty), and the Corporate Atlas search results under it.
- No guessing of a survivor by name or LEI.
- **Recommendation to 013 (not a 007 dependency):** optionally backfill `entity_merge_redirect` from the five repo merge files with `packet = 'MA-SEP-001'` / `'MA-SEP-007'`, after checking each `survivor_id` exists. That turns most `gone` cases into redirects for ≈ 2,600 writes. Open question O3.

---

## 7. API needs (Scope 5)

All routes are additive, `GET`-only, on `meridian-entities-api` (Entities domain). No new Worker. Responses keep the existing public `CORS` header. Every query below is listed again in Appendix A with its expected `EXPLAIN QUERY PLAN` for the Main Lane's query pack.

### 7.1 Reuse

| Route | 007 use |
|---|---|
| `GET /api/entities/:id` | Issuer landing. Extended with redirect handling (R3). Unchanged for existing ids. |
| `GET /api/entities/:id/instruments` | Extended with paging (R2). **Without `limit`/`cursor`, behaviour is unchanged** (legacy 75-row body), so the current front end keeps working during rollout and after a front-end rollback. |
| `GET /api/entities/:id/issuer-panels`, `/graph`, `/etf-exposure` | Unchanged; called with `resolved_id`. |
| `GET /api/entities/isin/:isin` | Unchanged; no longer used by the ETF screen after Phase 2. Retirement is a later packet. |

### 7.2 New and extended routes

| # | Route | Purpose | Reads (per call) |
|---|---|---|---|
| R1 | `GET /api/instruments/:key[?isin=]` | NavLink for one instrument (J1, Instrument card) | ≈ 6–8 typical; **≤ 32 worst** (10 candidates + redirects; includes ≈ 2 for R1f) |
| R2 | `GET /api/entities/:id/instruments?limit=25&cursor=` | Paged linked instruments (J2) | See §11: ≈ 52 per page with index; ≈ 32.8k without |
| R3 | redirect handling in `GET /api/entities/:id` | Merge-safe landing | +0 on a hit; ≤ 7 on a redirect |
| R4 | (P1) `count` on R2's first page | "N linked" header | ≤ 1,001 with index |
| R5 | (P1) `GET /api/instruments?keys=k1,…,k50` | Batch NavLink states to badge a visible page of holdings before click | Typical ≈ 300–400 (50 × 6–8); worst ≤ 1,600 (50 × 32) |

**R1 queries:**

```sql
-- R1a instrument (PK)
SELECT instrument_key, security_name, security_ticker, isin, cusip, asset_cat, country
FROM instrument_master WHERE instrument_key = ?;
-- R1b primary mapping (PK)
SELECT entity_id, source, confidence, created_at
FROM instrument_entity_map WHERE instrument_key = ?;
-- R1c GLEIF/FIRDS ISIN mappings (index on isin); ISIN = R1a.isin, else ?isin=, else key if 12 chars
SELECT entity_id, lei, match_source, confidence, mapped_at
FROM entity_isin_map WHERE isin = ? LIMIT 11;
-- R1d candidate names (PK, ≤ 10 ids)
SELECT entity_id, name, lei, type, entity_status
FROM entity_master WHERE entity_id IN (?, …);
-- R1e redirect lookups for misses in R1d (PK), per §6.2
-- R1f (optional; on once 008's tables exist) bond candidate, §3.6. Missing table = no candidate.
SELECT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' LIMIT 1;   -- idx_bi_instrument
SELECT entity_id, link_method, confidence, linked_at, verified_at FROM bond_issuer_link WHERE cik = ?;  -- PK
```

**R2 query (keyset on `instrument_key`):**

```sql
SELECT iem.instrument_key, iem.source, iem.confidence, iem.created_at,
       im.security_name, im.security_ticker, im.isin, im.cusip, im.asset_cat, im.country
FROM instrument_entity_map iem
JOIN instrument_master im ON im.instrument_key = iem.instrument_key
WHERE iem.entity_id = ? AND iem.instrument_key > ?      -- cursor; '' on page 1
ORDER BY iem.instrument_key
LIMIT ?;                                                 -- limit + 1 (to detect next page); limit ∈ [1,100], default 25
```

Response: `{ instruments: [NavLink-row…], next_cursor: "<last key>" | null, total: n | null, total_capped: bool, redirect: {...}|null }`. `limit` above 100 is clamped to 100; a non-integer is a 400.

**R4 count (first page only, capped):**

```sql
SELECT COUNT(*) AS n FROM (SELECT 1 FROM instrument_entity_map WHERE entity_id = ? LIMIT 1001);
```

`n = 1001` is shown as "1,000+".

**Ordering trade-off (for UX review):** keyset paging needs a stable, indexed order, so R2 orders by `instrument_key` (ISIN-first, then `CUSIP:…`, `TICKER:…`). Today's order (`asset_cat, security_name`) can't be paged cheaply. Each page is grouped by asset type on the client. A server-side `asset_cat` filter is P1.

### 7.3 Index audit

| Query | Index used | Exists today? |
|---|---|---|
| R1a, R1b | `sqlite_autoindex_*` (TEXT PRIMARY KEY) | Yes |
| R1c | `idx_entity_isin_map_isin` | Yes |
| R1d, R3 entity lookup | INTEGER PRIMARY KEY (rowid) | Yes |
| R3 redirect lookup | `entity_merge_redirect` PK | Created by 013 (ruling B) |
| R2, R4 | **`instrument_entity_map(entity_id)`** | **No → ruling A CR, applied Tue 13 Oct** |

**Recommendation to the ruling-A CR owner (Data-Identity Lead):** make the index composite, `CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key)`. It serves every `entity_id = ?` lookup the single-column index would (including 013's repoints), costs the same ≈ 33k writes, and lets R2 read exactly one page with no temp sort (§11). If the CR keeps the single column, R2 still works; it reads all of an issuer's map rows and sorts them (cost ∝ the issuer's instrument count, bounded by Appendix A Q3). Open question O2.

---

## 8. Ticket escalation (Scope 6; Phase 4, after 004)

### 8.1 Behaviour

- A "Report mapping problem" button on the Instrument card in the `unmatched`, `ambiguous` and `low_confidence` states, and on the `gone` / `redirect_unresolved` fallback.
- The public page holds and writes no state (D4). The button only builds a URL.

### 8.2 Authentication options (Founder Q1)

| Option | How | Verdict |
|---|---|---|
| **(a) Access-gated link-out** | The button opens a new tab at a 004-owned page under Cloudflare Access on `meridian-ops` (e.g. `/admin/dq/new?…`). Access forces login; the page shows a prefilled form; on confirm, the page POSTs to 004's `/api/ops/admin/…` route with the Access JWT; the Worker sets `raised_by` from the verified email. | **Recommended.** Same pattern as the MA-SEP-015b `/exceptions/ui` page behind Access on `entities-api` (team domain `meridian-atlas-except.cloudflareaccess.com`, `verifyAccessJwt`) and MA-OCT-001's Access-gated `/api/ops/admin/*`. No session on the public site, no secret in the browser, anonymous users simply meet the Access login. |
| (b) Hidden for anonymous users | Show the button only to signed-in users. | The public site has no session to detect, so the button would be hidden for everyone and AC5 would fail. |
| (c) Public unauthenticated POST | The public page writes a ticket directly. | Rejected: breaks D4 ("raise through the authenticated Ops API only") and invites spam writes against the D1 budget. |

### 8.3 Prefill contract (for 004 to accept)

Query parameters carry identifiers only — no personal data:

| Param | Value | Maps to `ops_data_quality_ticket` |
|---|---|---|
| `type` | `missing_mapping` · `ambiguous_mapping` · `low_confidence_mapping` · `merged_link_unresolved` | `ticket_type` (vocabulary is 004's to confirm) |
| `domain` | `entities` | `object_domain` |
| `key` | `instrument_key` (or `entity:{id}` for `gone`) | `object_key` |
| `ref` | JSON of `{isin, cusip, ticker, candidates:[ids], state, reason}` (URL-encoded, ≤ 1.5 kB) | `object_ref` |
| `via` | `nav-007` | `raised_via` |

`source_system = 'ma-ui'`; `raised_by` comes **only** from the verified Access email, server-side. 004 sets `dedupe_key = 'nav:{type}:{key}'` so repeat clicks don't duplicate a ticket. If 004 ships a different route or vocabulary, Phase 4 adapts to it; the button and prefill builder are ≈ 30 lines.

**Gate:** Phase 4 starts only after (i) 004's create route and page are deployed and approved, and (ii) the Founder has answered Q1. If 004 slips past Wave 3, the button is cut and AC5 is recorded as deferred with the Founder (it is not on the "never cut" list; "navigation in both directions" is).

---

## 9. Screens touched (Scope 7)

| File | Domain | Change | Consent / review |
|---|---|---|---|
| `App/index.html` | Shell | Inline hash router (§3.3), ≈ 40 lines; no new `<script src>` | UX Lead |
| `App/ma-data.js` | Shared | `data_instrumentKey()`, `data_entitiesGet(path)` (pattern of `data_opsGet`) | Engineering Lead |
| `App/ma-entities.js` | Entities display | Instrument card; state badges; paged linked instruments; redirect notice and fallback; `ma:route` / `ma:open-instrument` listeners; `ma:instrument-state` emitter; provenance strip | UX Lead + Data-Identity Lead |
| `App/ma-etf.js` | ETF | Replace the direct fetch in `handleEntityIconClick` with `ma:open-instrument`; add the icon to bond-branch rows (`CUSIP:` key); listen for `ma:instrument-state`; remove the permanent grey-out | **ETF Product Lead consent required before Phase 2 build** |
| `App/Corporate Atlas/src/entities-api.js` | Entities Worker | R1, R2 (+R4), R3; tolerant of missing redirect table | Architect (Worker deploy, read budget) |
| `App/ma-13f.js`, `ma-modal.js`, `ma-market.js`, `ma-ops.js` | — | **None** (ruling C; §1.3) | — |

**No writes from the front end** in any phase. `docs/` is regenerated by `generate-docs.mjs`, never edited by hand.

---

## 10. Acceptance criteria

AC1–AC5 map one-to-one to Scope v2's five criteria; AC6 is the merge-redirect case; AC7–AC8 are spec-level guards.

**AC1 — Both directions without losing context** (Scope v2 #1)
- Given the VTI ETF holdings tab scrolled to row 40, when the user clicks the issuer icon on a matched row, then the issuer overlay opens with a provenance strip; and when they press Back (in-app or browser), the same ETF, tab and row 40 are on screen.
- Given an issuer page with linked-instruments page 2 loaded, when the user opens an instrument card from page 2 and then that instrument's issuer and comes back twice, then pages 1–2 are still loaded and the scroll position is restored.
- Negative: closing the overlay never reloads ETF holdings (no new `/api/etf-holdings-stored` request in the network log).

**AC2 — Scalable linked-instruments view** (Scope v2 #2)
- Given an issuer with more than 25 linked instruments, the first view shows 25 rows and the header "Linked instruments · N" (or "1,000+"); "Show 25 more" appends the next page in key order with no duplicates or gaps.
- `limit=500` is clamped to 100; `limit=abc` returns 400.
- The worker log shows `rows_read` ≤ 100 for a page-2+ call on the composite index (≤ issuer count + 26 on the single-column index).
- Negative: the count text never claims a total that it has truncated.

**AC3 — Canonical keys, not names** (Scope v2 #3)
- Every deep link and every event `detail` carries `entity_id` or `instrument_key`. A grep of the changed front-end code finds no navigation keyed by `name`, `isin`, `cusip` or `ticker` alone.
- `data_instrumentKey` passes the shared fixture set with the same output as `deriveInstrumentKey` (T1).
- Two different instruments with the same name (e.g. two Microsoft bonds) open two different cards.

**AC4 — One contract for OpenFIGI and SEC bonds** (Scope v2 #4)
- R1 and R2 return NavLink rows matching the §3.2 schema for every existing source (`openfigi_tier1`, `cusip_tier1`, `isin_tier1`, `heuristic`, `isin_direct`, `firds_direct`).
- The contract test (T9) passes against a recorded fixture with `source: "sec_bond"` now, and against a live 009 response when 009 lands (checked in 009's gate, not blocking 007 UAT).

**AC5 — Missing mapping → data-quality ticket** (Scope v2 #5; Phase 4)
- Given an unmatched instrument card, when a signed-in operator clicks "Report mapping problem" and confirms on the Access-gated page, then exactly one `ops_data_quality_ticket` row exists with `object_key` = the `instrument_key`, `raised_via = 'nav-007'`, and `raised_by` = the Access email.
- Clicking twice creates no second ticket (dedupe).
- An anonymous user meets the Access login and no row is written.
- The public page sends no `POST` (network log).

**AC6 — Merge redirect** (Scope 4)
- Given a 013-merged `duplicate_id` A with survivor B, `#/entity/A` opens B with the "merged into" notice, and the address bar changes to `#/entity/B`.
- A test chain A→B→C (fixture) resolves to C with "via #B"; a 4-hop chain returns `redirect_too_deep`; a cycle returns `redirect_cycle`; both render the fallback without an error.
- A pre-013 merged id (one id from `ma-sep-007-merge-migration.sql`, checked absent in `entity_master` via Appendix A Q9) shows the `gone` fallback with the search box.
- Before 013 has created the table, R3 returns normal results and `gone` for unknown ids (no 500).

**AC7 — Honest states**
- For each of `matched`, `low_confidence`, `ambiguous` (`isin_duplicate`), `unmatched` (`no_mapping`, `lei_only`, `not_in_universe`), a UAT instrument (chosen from Appendix A Q4–Q6) shows the right badge, source and confidence on the row and on the card.
- An ambiguous card never pre-selects a candidate.
- With the Worker unreachable (UAT step via a blocked request), the row shows "retry", not "unmatched".

**AC8 — Read budget**
- Each new query's `EXPLAIN QUERY PLAN` matches Appendix A before deploy (the plan check is the deploy gate).
- No single execution exceeds 50k rows read; an issuer page view after the index costs ≤ 1,100 rows read (§11).

---

## 11. Read budget and pagination limits

### 11.1 Per call

Map size *M* ≈ 32,769 (Main Lane figure from MA-SEP-007; Appendix A Q1 measures it). *n* = the issuer's mapped-instrument count (most issuers: 1–20; worst case measured by Q3).

| Call | No index (today) | Single-column index `(entity_id)` | **Composite `(entity_id, instrument_key)`** (recommended) |
|---|---|---|---|
| R2 page (25) | SCAN iem ≈ *M* + 25 PK joins ≈ **32.8k** | SEARCH *n* + temp sort + 25 joins ≈ *n* + 26 | SEARCH 26 + 26 joins ≈ **52** |
| R2 page (max 100) | ≈ 32.9k | ≈ *n* + 101 | ≈ **202** |
| R4 count (page 1 only) | SCAN ≈ *M* ≈ 32.8k | ≤ min(*n*, 1,001) | ≤ min(*n*, 1,001) (covering) |
| **Issuer page, first view (R3 + R2 + R4)** | **≈ 65.6k → over the 50k ceiling as one view; not allowed** | ≈ 2*n* + 27 | ≈ *n* + 53 (≤ **1,054**) |
| R1 instrument card | ≈ 6–8 typical, ≤ 32 worst (includes ≈ 2 for R1f) | same | same |
| Issuer → bonds page (009, §3.6; 25 default, 100 max) | ≤ 26 × *n*CIK + *n*CIK (27 for one CIK) + R3; uses 008's indexes, not `instrument_entity_map` | same | same |
| R3 redirect | +0 on a hit, ≤ 7 on a chain | same | same |
| R5 batch (P1, 50 keys) | Typical ≈ 300–400 (50 × the R1 typical 6–8); worst ≤ 1,600 (50 × the R1 worst 32) | same | same |

### 11.2 Consequences

- **R2 and R4 do not ship before the ruling-A index is live (Tue 13 Oct).** Without it, one issuer page view costs ≈ 65.6k rows read — over the 50k single-execution ceiling when counted as a view, and at ≈ 100 views/day it would be ≈ 6.6M reads/day, over the 5M/day free-tier cap by itself. (The existing unpaged `/instruments` route already costs ≈ 32.8k per view today; the index fixes that too.)
- Pagination limits: default 25, maximum 100, cursor = last `instrument_key`, no `OFFSET`.
- Count capped at 1,001.
- R1 candidate cap 10 (+1 to detect truncation).
- R5 batch cap 50 keys.

### 11.3 Daily estimate after the index (planning only)

Assume 300 issuer views and 1,000 instrument resolutions a day: 300 × ≤ 1,054 + 1,000 × 6 ≈ **0.32M rows read/day worst case**, ≈ 6% of the 5M/day cap; typical (*n* ≈ 20) ≈ 0.03M. Writes: **0**.

---

## 12. Phasing (Wave 2, 8–21 Oct; UAT in Wave 3)

| Phase | Content | Depends on | Target |
|---|---|---|---|
| **P0 (prereqs, not 007 work)** | Ruling-A index CR approved (Mon 12 Oct) and applied (Tue 13 Oct). Appendix A query pack run and results attached to the build brief. | Data-Identity Lead; Main Lane routing | 12–13 Oct |
| **Phase 1 — contract, router, J1/J2 on Corporate Atlas, states, redirect** | R1, R2, R3, R4 on `entities-api` (Worker deploy, separate from Pages); `index.html` router; `ma-data.js` helpers; `ma-entities.js` card, badges, paging, notice, fallback | P0 index for R2/R4 (R1/R3 may deploy earlier) | Build 14–17 Oct |
| **Phase 2 — ETF wiring** | `ma-etf.js` events, bond-branch icon, state restyle | **ETF Product Lead consent**, Phase 1 | 19–21 Oct |
| **Phase 3 — bond contract** | No code. T9 fixture test; conformance check when 009 lands | 009 | With 009's gate |
| **Phase 4 — ticket button** | Button and prefill builder | 004 route + page approved; Founder Q1 | After 004, by 28 Oct; else deferred |
| UAT | §13 | Phases 1–2 (and 4 if ready) | Wave 3, 19–29 Oct |
| Release | Front end via `generate-docs.mjs` at the October go-live; the Worker is already deployed | Release gates | 29–31 Oct |

**Deploy note:** The Worker deploy (`wrangler deploy` of `meridian-entities-api`) and the front-end release (commit `docs/` → Pages) are separate mechanisms (CLAUDE.md). The Worker ships first and is backward-compatible (§7.1), so the live site is unaffected until the front end ships. Record the pre-deploy Worker version id for rollback.

---

## 13. Founder UAT script

Before the session, the build lane fills the bracketed values from Appendix A results and lists them in the UAT sheet. About 30 minutes.

| # | Step | Expected |
|---|---|---|
| 1 | Open ETF **[equity ETF]**, Holdings tab; scroll to row ≈ 40; click the issuer icon on **[matched holding]**. | Issuer overlay opens; strip shows "Reached from … · OpenFIGI/ISIN · confidence N (band)". |
| 2 | Press the in-app Back. | Same ETF, same tab, row ≈ 40 visible; holdings did not reload. |
| 3 | Repeat step 1, then press the **browser** Back button. | Same result as step 2. |
| 4 | Open bond ETF **[bond ETF]**; click the issuer icon on a CUSIP-only row. | Card or issuer opens (the icon is new on bond rows). |
| 5 | Click the icon on **[low-confidence holding]**. | Card with amber "Low confidence", source "heuristic", the number shown; "Open issuer" works. |
| 6 | Open `#/instrument/[ambiguous ISIN, KI 22.17]`. | Card "Ambiguous — several issuers share this ISIN", candidates listed with LEI, source and confidence; none pre-selected. Pick one; Back returns to the card. |
| 7 | Click the icon on **[unmatched holding]**. | Grey icon stays clickable; card "No issuer linked" with the reason (e.g. "LEI known: …, not in Atlas"). |
| 8 | Open issuer **[large issuer, n > 50]**. | "Linked instruments · N"; 25 rows; "Show 25 more" adds 25 more, no repeats. |
| 9 | From page 2 of step 8, open an instrument, then its issuer, then Back twice. | Back on the same issuer, pages 1–2 loaded, same scroll. |
| 10 | Copy the address bar on an issuer page; paste it in a new tab. | The same issuer opens directly (deep link). |
| 11 | Open `#/entity/[pre-013 merged id]`. | "No longer in Meridian Atlas… may have been merged" with a search box; no error. |
| 12 | *(After the first 013 batch)* Open `#/entity/[013 duplicate_id]`. | Survivor opens with the "merged into" notice; the address bar shows the survivor id. |
| 13 | *(Phase 4)* On step 7's card, click "Report mapping problem". | Access login (if not signed in) → prefilled form → confirm → a DQ case ref is shown. Clicking again shows the same case. |
| 14 | Turn off Wi-Fi; click an issuer icon. | "Couldn't reach Corporate Atlas · retry", not "unmatched". |

Pass = all applicable steps pass. Step 12 may be signed off later if 013 runs after UAT; step 13 only if Phase 4 shipped.

---

## 14. Test plan and rollback

### 14.1 Tests (build lane)

| # | Test | Type | Where |
|---|---|---|---|
| T1 | `data_instrumentKey` ≡ `deriveInstrumentKey` on ≥ 30 fixtures (12-char ISIN, padded ISIN, 6/8/9-char CUSIP, ticker-only, name-only incl. long and spaced names) | Node unit test | `App/Corporate Atlas/tests/` (new; pattern of `App/Ops/tests/*.mjs`) |
| T2 | R1 state decision table (§5.1) over a mocked D1: each state and reason | Node unit test against the handler with a stub `env.DB` | same |
| T3 | R2 keyset: no gaps or duplicates across pages; clamp at 100; 400 on bad `limit`; `next_cursor` null on the last page | Unit | same |
| T4 | R3 redirect: hit, 1-hop, 3-hop, 4-hop (`redirect_too_deep`), cycle, survivor missing, table missing | Unit | same |
| T5 | Legacy `/instruments` without params returns the unchanged 75-row body | Unit (regression) | same |
| T6 | `EXPLAIN QUERY PLAN` for R1a–R1e, R2, R4, R3 equals Appendix A; plus **R1f** (bond → issuer, optional) as plan check **P10** once 008's tables exist (cross-ref 008 P-B1) | Read-only D1 check, run by the executing lane before deploy | Query pack |
| T7 | Front end in the preview: J1/J2 round trips, states, Back button, deep links, no `fetch` to `entities-api` from `ma-etf.js` (network log) | Browser preview (desktop + 375 px mobile) | Build lane |
| T8 | Grep gate: no `meridian-entities-api` URL in `ma-etf.js`; no `POST` in 007's front-end code | Static check | Build lane |
| T9 | NavLink JSON-schema conformance on R1/R2 output and on a `sec_bond` fixture | Unit | same |

### 14.2 Rollback

| Part | Rollback | Time |
|---|---|---|
| Front end | Revert the 007 changes in `App/` on `October-2026`, run `node generate-docs.mjs`, commit `docs/` (at or after the October go-live). Before go-live, simply don't release them. | Minutes |
| Worker | `wrangler rollback` to the recorded pre-007 version of `meridian-entities-api`. Because the legacy routes are unchanged (T5), a front-end rollback alone is also safe, and a Worker rollback alone leaves the old front end working. | Minutes |
| Data | None — 007 writes nothing. The ruling-A index has its own CR and rollback (`DROP INDEX`). | — |

---

## 15. Questions

### 15.1 Founder questions (3)

| # | Question | Recommended answer |
|---|---|---|
| **Q1** | How should "Report mapping problem" authenticate on a public site with no session? | **(a) Access-gated link-out** to a 004-owned page on `meridian-ops`, as for the MA-SEP-015b `/exceptions` Access app and MA-OCT-001's `/api/ops/admin/*`. (b) hides it for everyone; (c) breaks D4. |
| **Q2** | Should OpenFIGI matches (fixed confidence 70) be shown as "medium" rather than "low confidence"? | **Yes.** Low = below 70 or `heuristic`; medium = 70–89; high = 90+. The raw number is always shown, so nothing is hidden. |
| **Q3** | For an ambiguous ISIN (KI 22.17), should navigation auto-pick the most likely issuer? | **No.** Show every candidate with source and confidence and let the user choose. Auto-picking repeats today's silent `LIMIT 1` problem. |

### 15.2 Other open questions (not Founder; non-blocking for the spec)

| # | Question | For | Needed by |
|---|---|---|---|
| O1 | ~~Issuer → bonds: CHECK rebuild CR or a 009 route?~~ **Closed 5 Oct:** the 009 route with 008's linked table. See §3.6. | 008/009 owners | Closed |
| O2 | Composite `(entity_id, instrument_key)` instead of single-column for the ruling-A index? Same write cost; R2 reads ≈ 52 vs *n* + 26 per page. | Data-Identity Lead (CR owner) + Architect | CR approval, Mon 12 Oct |
| O3 | Should 013 backfill `entity_merge_redirect` for the ≈ 2,600 MA-SEP-001/007 losers? About 2.6k writes; turns `gone` into redirects. | 013 owner (Data-Identity Lead) | 013 spec |
| O4 | `ticket_type` vocabulary and the prefill page for §8.3. | 004 owner (Operations Lead) | 004 spec |
| O5 | Is `instrument_key` order acceptable for linked instruments, with grouping by asset type inside each page? | UX Lead | Review, Fri 9 Oct |
| O6 | Consent to Phase 2 changes in `ma-etf.js` (§9). | ETF Product Lead | Before Phase 2 build |

---

## Appendix A — Read-only D1 query pack (for the Main Lane to route; not run in this lane)

**Results:** `claude/MA-OCT-007_AppendixA_Results.md` `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa` (complete 9 Oct; 37 ambiguous ISINs, 0 dangling refs). Reference only; rev 1.3 makes no design change from it.

Rules for the executing session:

- Use `wrangler d1 execute meridian-etf --remote`, read-only, one statement at a time.
- Record `rows_read` from `meta` for every statement.
- Stop if any single statement would exceed 50k rows read.
- Run order: the **A.0 size probes first**, then the `EXPLAIN QUERY PLAN` lines in A.3 (they read no table rows), then A.1 and A.2 as sized by A.0.

### A.0 Size probes (run first; they decide how A.1 and A.2 are split)

**Why probes come first.** *M* = 32,769 is an **August** figure (MA-SEP-007). Since then FIRDS (`firds_direct`) has added rows to `entity_isin_map` and `instrument_master`, so neither table's current size is known. Both are ordinary rowid tables (TEXT / composite primary keys, not `WITHOUT ROWID`, per the repo DDL). `MAX(rowid)` is therefore a one-seek **upper bound** on the row count. It can overstate the count if rows were deleted, which errs on the safe side.

| # | Query | Expected plan | Est. rows read | Sets |
|---|---|---|---|---|
| S1 | `SELECT MAX(rowid) AS r FROM instrument_entity_map;` | `SEARCH instrument_entity_map` (min/max optimisation: a single B-tree seek) | ≈ 1 | *R*ᵢ |
| S2 | `SELECT MAX(rowid) AS r FROM entity_isin_map;` | `SEARCH entity_isin_map` (min/max optimisation) | ≈ 1 | *R*ₑ |

**Split rule.** If *R*ᵢ > 45k, Q1–Q3 are split into ranges. If *R*ₑ > 45k, Q5 and Q8 are split. Each split form is given in its row below. Ranges are chosen so that every statement's estimate stays ≤ 45k. Where the estimate counts two reads per row (Q5's index plus table lookup, and Q7/Q8's `entity_master` PK lookup), that means a range width of ≤ 22.5k rowids. `instrument_master` growth affects no pack query, since none scans it, and R1 reads it by PK only.

### A.1 Sizing and state distribution

| # | Query | Expected plan | Est. rows read | Purpose |
|---|---|---|---|---|
| Q1+Q2 | `SELECT source, confidence, COUNT(*) AS n, COUNT(DISTINCT entity_id) AS entities FROM instrument_entity_map GROUP BY source, confidence;` **Split form (if *R*ᵢ > 45k):** add `WHERE rowid > ? AND rowid <= ?` over ranges of ≤ 45k rowids. Sum `n` across ranges, and drop `COUNT(DISTINCT entity_id)`, which does not add across ranges (Q3 gives the issuer count). | `SCAN instrument_entity_map` + `USE TEMP B-TREE FOR GROUP BY` (+ for DISTINCT). Split: `SEARCH instrument_entity_map USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` + temp B-tree | ≈ *R*ᵢ in all (≤ 45k per range) | Measures the current *M* (sum of `n`) and the band distribution (§5.2) |
| Q3 | `SELECT entity_id, COUNT(*) AS n FROM instrument_entity_map GROUP BY entity_id ORDER BY n DESC LIMIT 20;` **Split form (if *R*ᵢ > 45k):** run **after** the ruling-A index (13 Oct) with `WHERE entity_id > ? AND entity_id <= ?` over ⌈*R*ᵢ / 45k⌉ + 1 equal `entity_id` ranges. Halve any range whose `rows_read` passes 45k. Merge the per-range top-20s; this is valid because the ranges partition `entity_id`. Unsplit, Q3 may run before the index. | Before the index: `SCAN` + `USE TEMP B-TREE FOR GROUP BY` + `… ORDER BY`. After: `SEARCH … USING COVERING INDEX idx_iem_entity… (entity_id>? AND entity_id<?)` | ≈ *R*ᵢ in all | Worst-case *n* per issuer (§11); picks the UAT large issuer |
| Q4 | `SELECT COUNT(*) FROM entity_isin_map;` | `SCAN entity_isin_map USING COVERING INDEX idx_entity_isin_map_entity` (smallest index) | ≈ *R*ₑ (exact row count; checks S2) | Exact size; Q5/Q8 range planning |
| Q5 | `SELECT isin, COUNT(*) AS rows_, COUNT(DISTINCT entity_id) AS ents FROM entity_isin_map GROUP BY isin HAVING ents > 1 ORDER BY rows_ DESC LIMIT 50;` **Split form (if *R*ₑ > 45k):** add `WHERE isin >= ? AND isin < ?` over ISIN ranges by leading country code (e.g. `'' – 'D'`, `'D' – 'J'`, `'J' – 'U'`, `'US'` alone, `'V' – '~'`), adjusted so that each range holds ≤ 22.5k rows. Merge the top-50s; groups never straddle ranges. | `SCAN entity_isin_map USING INDEX idx_entity_isin_map_isin` (or the PK autoindex) + `USE TEMP B-TREE FOR count(DISTINCT)`. Split: `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin>? AND isin<?)` | ≈ 1–2 × *R*ₑ in all (index entry plus table row for `entity_id`) | KI 22.17 ambiguous ISINs; picks UAT step 6 |
| Q6 | `SELECT COUNT(*) FROM entity_isin_map WHERE entity_id IS NULL;` | `SEARCH entity_isin_map USING COVERING INDEX idx_entity_isin_map_entity (entity_id=?)` | ≤ *R*ₑ (= the null count) | Size of `lei_only` |

### A.2 Dangling ids (merge history)

| # | Query | Expected plan | Est. rows read | Purpose |
|---|---|---|---|---|
| Q7 | `SELECT COUNT(*) FROM instrument_entity_map iem WHERE iem.rowid > ? AND iem.rowid <= ? AND NOT EXISTS (SELECT 1 FROM entity_master em WHERE em.entity_id = iem.entity_id);` run in **4 rowid ranges** bounded by S1: `(0, ⌈R/4⌉]`, `(⌈R/4⌉, ⌈R/2⌉]`, `(⌈R/2⌉, ⌈3R/4⌉]`, `(⌈3R/4⌉, R]` with *R* = *R*ᵢ | `SEARCH iem USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` + `CORRELATED SCALAR SUBQUERY` → `SEARCH em USING INTEGER PRIMARY KEY (rowid=?)` | **Per range ≈ *R*ᵢ/4 map rows + *R*ᵢ/4 `entity_master` PK lookups = *R*ᵢ/2.** At the August *R*ᵢ = 32,769: ≈ 8.2k + 8.2k ≈ **16.4k per range, ≈ 65.5k in all**. 4 ranges keep each ≤ 45k while *R*ᵢ ≤ 90k. Above that, use ⌈*R*ᵢ / 22.5k⌉ ranges. | Mappings that point at deleted ids (should be 0 after past repoints) |
| Q8 | `SELECT COUNT(*) FROM entity_isin_map eim WHERE eim.entity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entity_master em WHERE em.entity_id = eim.entity_id);` **Split form (if *R*ₑ > 22.5k, so that each statement stays ≤ 45k):** add `AND eim.rowid > ? AND eim.rowid <= ?` over ⌈*R*ₑ / 22.5k⌉ rowid ranges bounded by S2 | `SCAN eim USING COVERING INDEX idx_entity_isin_map_entity` + `SEARCH em USING INTEGER PRIMARY KEY`. Split: `SEARCH eim USING INTEGER PRIMARY KEY (rowid>? AND rowid<?)` + `SEARCH em USING INTEGER PRIMARY KEY` | ≈ 2 × *R*ₑ in all (row + PK lookup); ≤ 45k per range | Same, for ISIN mappings |
| Q9 | `SELECT entity_id FROM entity_master WHERE entity_id IN (25782, 1818, 26410, 25623, 25751);` | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | 0–5 | Confirms sample MA-SEP-007 losers are absent (UAT step 11, AC6) |

### A.3 Plan checks for the new routes (no table rows read)

| # | Statement | Expected plan |
|---|---|---|
| P1 | `EXPLAIN QUERY PLAN` R1a | `SEARCH instrument_master USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` |
| P2 | `EXPLAIN QUERY PLAN` R1b | `SEARCH instrument_entity_map USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` |
| P3 | `EXPLAIN QUERY PLAN` R1c | `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin=?)` (or the PK autoindex on `(isin, lei)`) |
| P4 | `EXPLAIN QUERY PLAN` R1d | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` |
| P5 | `EXPLAIN QUERY PLAN` R2 — **before** the index | **Observed 7 Oct** (`claude/ReadPacks_2026-10_Query_Ledger.md`): `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key>?)` + `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)`; **no** temp B-tree. With no `entity_id` index the planner range-walks the PK autoindex in `ORDER BY` order and filters `entity_id` per row, so a page reads ≈ *M* rows (it stops early only after `LIMIT` matches). E7's conclusion is unchanged: R2 does not ship before the index. |
| P6 | `EXPLAIN QUERY PLAN` R2 — **after** a composite index | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` + `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1`; **no** temp B-tree |
| P6′ | same, after a single-column index | `SEARCH iem USING INDEX idx_iem_entity (entity_id=?)` + `USE TEMP B-TREE FOR ORDER BY` |
| P7 | `EXPLAIN QUERY PLAN` R4 after the index | `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity… (entity_id=?)` |
| P8 | `EXPLAIN QUERY PLAN` R3 redirect (after 013 creates the table) | `SEARCH entity_merge_redirect USING INTEGER PRIMARY KEY (rowid=?)` |
| P10 | `EXPLAIN QUERY PLAN` R1f — **after 008 creates its tables** | `SEARCH bond_issuance USING INDEX idx_bi_instrument (instrument_key=?)`, then `SEARCH bond_issuer_link USING INDEX sqlite_autoindex_bond_issuer_link_1 (cik=?)`. Cross-reference 008's P-B1 (issuer → bonds keyset on `idx_bi_cik_final_key`, no temp B-tree). |
| P9 | `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('instrument_master','instrument_entity_map','entity_isin_map','entity_master');` | `SCAN sqlite_master` — tens of rows | Confirms the live index list matches the repo DDL (E7) |

**Pack total (conditional on the A.0 probes):** with *R*ᵢ and *R*ₑ from S1 and S2, the total is:

| Part | Rows read |
|---|---|
| Q1+Q2 | ≈ *R*ᵢ |
| Q3 | ≈ *R*ᵢ |
| Q4 | ≈ *R*ₑ |
| Q5 | ≈ 1–2 × *R*ₑ |
| Q6 | ≤ *R*ₑ |
| Q7 | ≈ 2 × *R*ᵢ |
| Q8 | ≈ 2 × *R*ₑ |
| S1, S2, Q9, P1–P10 | < 100 |
| **Total** | **≈ 4 × *R*ᵢ + (5 to 6) × *R*ₑ** |

No statement exceeds 45k once the split rules apply, and the pack writes nothing.

- **Worked example, August size only:** at *R*ᵢ = 32,769, the *R*ᵢ terms come to ≈ 131k. The *R*ₑ terms are unknown until S2 runs.
- **When the pack fits in one day:** only if the computed total is ≤ 1M rows read. That keeps it to ≤ 20% of the 5M/day free-tier cap, with room for normal traffic. At the August *R*ᵢ, that holds while *R*ₑ ≲ 145k.
- **Suggested day split:** A.0 + A.3 + A.1 on day 1, then A.2 on day 2.
- **If the total is over 1M:** run A.0 and A.3 first, then spread the ranges across days at ≤ 1M rows read per day. Report the planned per-day totals to the Main Lane before starting.

---

## Appendix B — Ruling and decision trace

| Item | Decision | Source |
|---|---|---|
| Index on `instrument_entity_map(entity_id)` | Additive CR, applied Tue 13 Oct, P1 dependency; composite form recommended (O2) | Main Lane ruling A, 4 Oct |
| `entity_merge_redirect` | Owned and written by 013; read-only for 007 | Ruling B |
| `ma-13f.js` | Out of scope | Ruling C |
| ETF → `entities-api` path | `ma-data.js` or DOM events only | Ruling D |
| Survivor rule | S1, the older LEI-bearing row survives | Founder, 3 Oct (013 brief rev 1.1) |
| Ticket-button auth | Founder question Q1, recommend (a) | Main Lane, 4 Oct |
| Brief hash shorthand | `d57ed1dc…e2b8` (corrected from the Day-1 report) | Main Lane, 4 Oct |
| Bond join (O1) | 009 route over 008's `bond_issuer_link` + `bond_issuance`; R1f optional; 013 repoints `bond_issuer_link.entity_id`; R3 as backstop (§3.6) | 008 rev 0.2 §8.1–§8.3 (Data-Identity Lead), 5 Oct; re-cited at 008 rev 1.2 `bcdad9a2…5cd3` (rev 1.3, 10 Oct); Main Lane ruling "both, not either", 5 Oct |
