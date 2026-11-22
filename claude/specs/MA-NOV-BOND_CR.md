# Change Request: BOND-CR1 (3 columns on `bond_issuance`) + BOND-CR2 (offering facts and parties tables)

```text
PACKET:     MA-NOV-BOND.CR · Control v1 (7d9c5d4e…d55f) · Task v1 (ce6552c4…c2f0) — both verified
RUN:        r-20261122T143042Z-485e · interactive · 2026-11-22
ROLE:       Data-Identity Lead (owner) + Architect + Tech Ops (three-point check)
STATUS:     PENDING APPROVAL — Founder approves CR1 and CR2 (checkpoint 2, Sun 22). Nothing has been run against D1.
INPUTS:     spec v2 c4281815…aef §7 (CR2) · spec v1 b30a75ce…2e53 §5–6 (CR1) · FIX2 report 1373dc9f…6e19 §5, §7
            — pins verified · migrations/008-bonds.sql · bonds/apply/ (FIX2 files, hashes as in the FIX2 report)
PRIORITY:   High — CR1 gates write approval 1 (Thu 26, U6); CR2 gates write approval 2 (Sat 28, U8)
```

## 1 Description

| | BOND-CR1 | BOND-CR2 |
|---|---|---|
| **What** | Add 3 nullable TEXT columns to `bond_issuance`: `status_reason`, `superseded_by`, `status_note` | Create 2 new tables: `bond_offering_fact` and `bond_offering_party` (`WITHOUT ROWID`, primary key only) |
| **Why** | Spec v1 §5 (BOND-03): the reason a filing is not shown, and the final that replaces a draft, are not stored, so they can't be shown. FIX2's apply writes `status_reason` and `superseded_by`. `status_note` (FIX2 §7) holds the plain note the UI may show ("tranche dropped at pricing", the F5 allocation note). | Spec v2 §3–5 (BOND-06–12): offering facts and parties, each with its source location, need a place to live. Decision 6 (NML-1122-2). |
| **Migration** | `App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql` (b2cd3751…31ff) | `App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql` (3a2050cd…4e6b) |
| **Rollback** | `ma-nov-bond-cr1-rollback.sql` (0a472553…2144) | `ma-nov-bond-cr2-rollback.sql` (54341630…893d) |
| **Applied by** | U6 BOND.APPLY1, Thu 26 evening, before `fix2-apply-run1.sql` | U8 BOND.VERIFY, Sat 28 after 08:00Z, before the offering runs |
| **Domain / owner** | Entities · Data-Identity Lead · sole writer `bonds/bonds-ingest.mjs` (as 008) | same |

All four files are **written and committed, not run**. The file names follow the Control. Spec v1's working name `ma-nov-bond-cr1-status-reason.sql` and spec v2's `ma-nov-bond-cr2-offering.sql` are replaced by these.

### 1.1 CR1 columns

| Column | Set on | Values | Written by |
|---|---|---|---|
| `status_reason` | every non-final row; NULL on finals | the code list in spec v1 §5 (`superseded`, `draft_no_final`, `structured`, `equity`, …) | `fix2-apply-run1.sql`, then every run |
| `superseded_by` | drafts only | accession number of the final | `fix2-apply-run1.sql`, then every run |
| `status_note` | any row, rarely | short plain note, e.g. "tranche dropped at pricing" | **not** by `fix2-apply-run1.sql` (it carries the notes in the run log only). A later run fills it (FIX2 §1: 4 F2b notes + 1 F5 note today). |

All three columns have no default, no CHECK and no index, so they can be dropped again (§6). "Partial" stays derived from NULL `cusip`/`isin`/`coupon_rate`/`spread_bps` (spec v1 §5). The code list is enforced by the parser, not by a CHECK, because a CHECK would make the column impossible to drop and every new code would mean a table rebuild.

**Decision D-CR1 — `status_note`:** Main Lane recommends adding it (FIX2 §7). It costs nothing to add (no row rewrite), and without it the "tranche dropped at pricing" and allocation notes stay Ops-only. *Recommend: approve the third column.* If you decline, delete the `status_note` line from both CR1 files before U6. The FIX2 apply doesn't reference the column, so nothing else changes.

### 1.2 CR2 tables

As spec v2 §7, with one addition: `value_text` has the CHECK `value_text IS NULL OR length(value_text) <= 300` (spec v2 §8: "checked by the table"). Keys:
- `bond_offering_fact` PK `(accession_number, tranche_seq, field)`; tranche 0 = whole offering. Role-group states are rows with `field = 'parties.<role>'`.
- `bond_offering_party` PK `(accession_number, party_seq)`; `tranche_seq` defaults to 0 (all tranches).

There is no secondary index and no foreign key. `field` is a closed list enforced by the extractor. `state`, `source_doc` and `role` are CHECKs. No row means "Not read yet".

**Expected rows (spec v2 §7, confirmed at the U7 dry run):**

| Rows | Estimate |
|---|---|
| offering-level facts | ≈ 14 fields × 325 filings × 0.85 ≈ 3,900 |
| tranche-level facts | ≈ 9 × 632 × 0.9 ≈ 5,100 |
| parties | ≈ 325 × 9 ≈ 2,900 |
| **Total** | **≈ 12,000** row-writes (one per row: WITHOUT ROWID, PK only) · ≈ 4 MB |

## 2 Business justification

BOND-03 needs CR1: without stored reasons, the issuer page can't say "31 bonds shown · 4 drafts · 1 couldn't read · 9 not covered", and FIX2's apply, which makes T1 and T2 true, can't run. BOND-06–12 need CR2: there is nowhere to store offering facts and parties with their sources. Both are on the November must list (NML-1121-12).

## 3 Impact analysis

| Area | Impact | Details |
|---|---|---|
| Users | Low (positive) | No visible change until U9 (API + UI release Sun 29). Before U9, no reader selects the new columns or tables. |
| Systems | Low | One existing table gains 3 nullable columns. Two new tables. D1 `meridian-etf` only. No Worker, cron, front-end or `docs/` change in this CR. Existing queries are unaffected: every 009 query names its columns, and the API's `FI_BOND_COLS` list doesn't change. The P-B1 plan is unchanged (§4.1). |
| Processes | Low | `bonds-ingest.mjs` writes the new columns or tables from U5/U7 on. The Ops line (spec v1 §5) reads F3 totals. |
| Cost / quota | Low | CR1 ≈ 0 row-writes. CR2 DDL ≈ 0. The data runs that follow are budgeted separately: FIX2 apply 1,229; offering ≈ 12k (§4.3). Storage +≈ 4 MB, on 468 MB used of 5 GB. |
| Other domains | None | No cross-domain read or write. `entity_id` and the 013 tables are untouched. |

## 4 Three-point check

Method: plans from a local `node:sqlite` copy (SQLite 3.51.2) holding today's 943 D1 rows (§5), with CR1 and the FIX2 apply in place. The shape for the existing table was confirmed on D1 itself with one remote `EXPLAIN QUERY PLAN`. The CR2 tables don't exist on D1 yet, so their plans are local only.

### 4.1 Index audit — plans of the read queries the API and UI will use

| Query (route) | Plan | Rows read per execution |
|---|---|---|
| CR2 facts for a bond (F2 `offering`) — `WHERE accession_number = ? AND tranche_seq IN (0, ?)` | `SEARCH bond_offering_fact USING PRIMARY KEY (accession_number=? AND tranche_seq=?)` | ≤ 60 |
| CR2 parties for a bond (F2) — `WHERE accession_number = ? ORDER BY party_seq` | `SEARCH bond_offering_party USING PRIMARY KEY (accession_number=?)` (no sort step) | ≤ 20 |
| CR2 per-run rollback / re-parse replace — `DELETE … WHERE parser_version = ? AND accession_number IN (…)` | `SEARCH … USING PRIMARY KEY (accession_number=?)`, both tables | rows of the named filings |
| CR1 bond detail (F2, + 3 columns) | `SEARCH bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1 (accession_number=? AND tranche_seq=?)` | 1 |
| CR1 `superseded_by` link (draft → final) | `SEARCH … sqlite_autoindex_bond_issuance_1 (accession_number=?)` | 1 |
| P-B1 issuer bond list (unchanged) | `SEARCH bond_issuance USING COVERING INDEX idx_bi_cik_final_key (…)` | ≤ 26 |
| **CR1 F1 document counts** — `WHERE cik IN (…) GROUP BY filing_status, status_reason` | **`SCAN bond_issuance` / temp B-tree for GROUP BY.** D1 gives the same plan (remote check on the current schema) | **943 (whole table)** |
| **CR1 F5 documents list** — `WHERE cik = ? AND filing_status <> 'final' … ORDER BY filing_date DESC LIMIT 26` | **`SCAN bond_issuance` / temp B-tree for ORDER BY** | **943** |
| CR1 F3 coverage totals (directory, Ops line) | `SCAN bond_issuance` / temp B-tree (a whole-table total by design) | 943 |

**No CR2 query scans.** The F1 document counts and the F5 list **do scan `bond_issuance`**, because no index starts with `cik` for non-final rows: `idx_bi_cik_final_key` is partial (`final` only). Spec v1 §5 estimated "≤ ~150 rows read per issuer". That holds only with an index: the largest issuer has 125 rows (CIK 0000834071), and the top five have 125, 83, 62, 60 and 49 rows.

**Decision D-CR3 — index for the document queries (not in the migration files):**
- **Option A (recommended): no index now.** The table is 943 rows, bounded to 34 CIKs, and grows only by manual runs. 943 rows per issuer view (plus 943 for F5 when the list is opened) is far below the 50k single-execution limit. Against the 5M reads a day, it would take about 2,600 issuer views a day with the list opened each time (about 5,300 without) to matter. Leaving it out keeps U6's writes and FIX2's 1,229 estimate unchanged.

  U9 measures the real F1/F5 `rows_read` on D1. If it ships the routes and wants them indexed, it adds `CREATE INDEX idx_bi_cik_status ON bond_issuance(cik, filing_status, filing_date, accession_number)` under its own three-point note. That costs about 943 writes once and +1 index write per later row write, and the plan becomes `SEARCH … USING INDEX idx_bi_cik_status (cik=?)`, ≤ 125 rows (tested locally).
- **Option B: add the index to CR1 now.** It would change FIX2's write estimate, because status and reason updates would touch the index, and it would need a rebuilt estimate before U6.

### 4.2 Single-execution read test (< 50k)

| Statement | Rows read | < 50k |
|---|---|---|
| Largest new-query read (F1/F5/F3 scan) | 943 (today; 1 row per filing tranche) | ✓ |
| Bond view with offering (F2 + facts + parties) | ≈ 1 + 60 + 20 ≈ 81 | ✓ |
| CR1 `ALTER TABLE … ADD COLUMN` ×3 | schema only | ✓ |
| CR2 `CREATE TABLE` ×2 | schema only | ✓ |
| FIX2 apply, any single statement | 1–2 (PK SEARCH; INSERT … SELECT WHERE EXISTS by PK) | ✓ |

### 4.3 Read and write budget

| Day | Step | Row-writes | Day total | Limits |
|---|---|---|---|---|
| Thu 26 (U6, evening, Tue–Fri ≥ 08:00Z, outside the 05:50–07:10Z freeze) | CR1 migration | ≈ 0 (ADD COLUMN with a NULL default rewrites no row) | | |
| | FIX2 apply run 1 | 1,229 (FIX2 §5, counting index entries) | ≈ 40k back-fill (06:00) + 1.2k ≈ **41k** | 60k headroom ceiling · 100k/day ✓ |
| Sat 28 (U8, after 08:00Z) | CR2 migration | ≈ 0 | | |
| | Offering runs (2 × ≤ 8k) | ≈ 12,000 | ≈ 40k + 12k (+ D6 ≈ 1k) ≈ **53k** | ✓ (spec v2 §7) |
| only if rolled back | CR1 rollback | **≈ 2,830** (SQLite rewrites the table once per DROP COLUMN: 3 × 943) | | budget it; or use the 0-write fallback (§6) |
| only if rolled back | FIX2 rollback | 1,229 | | |
| only if rolled back | CR2 rollback (DROP TABLE) | ≤ rows held (≈ 12k at most) | | prefer the per-run DELETE rollback |

Reads: the migrations read nothing. Each run reads under 1k (headroom checks only; parsing is offline). Each bond view reads about 80 rows. **Cron and windows:** no cron trigger is added (capacity last seen 5/5). All steps are manual local runs, never on a Monday (entities-seed ≈ 37.5k) or a Sunday morning (holdings ≈ 80k).

## 5 Rehearsal — FIX2 apply and rollback on a local copy (FIX2 §7)

Today's `bond_issuance` was read with one `SELECT *` (943 rows, 632 filings, 0 written) and loaded into a local SQLite file built from `008-bonds.sql`. Script: `rehearse.mjs` (8e7da273…f3ab); result: `rehearsal-result.json` (102dd16b…9ca7). Both are in the session scratchpad.

| Step | Result |
|---|---|
| Load | 943 rows. Read back, they are identical to the D1 JSON results (canonical results SHA-256 `cbe392e1…6251`). Integrity check ok. |
| Before state vs FIX2 | Classes identical to `fix2-summary.json` `before_classes` (preliminary 184 · final with id 276 · final no id 356 · skipped_non_debt 45 · skipped_other 52 · skipped_structured 21 · parse_failed 9). Latest `ingested_at` is 2026-10-30T21:18:10Z, so no row was written after FIX2's read at 10:57Z. |
| Before-hash | **Does not match, by construction.** Today's raw `wrangler --json` file hashes to `08afbecc…ae4e`, not `inputs.before.sha256` `1a94593c…3426`. The hash covers the whole output file, including `meta` (timings, `served_by_colo`, `size_after`), so it differs on every read. The data is shown to match by the class identity above and by every guarded statement changing exactly one row. **U6 step 2 should compare a results-only hash instead**, the canonical SHA-256 of `results` sorted by PK, as here: `cbe392e1a5e4f029bf9b7e7c6617837197fd638d0b86512917093ccabe7b6251`. |
| CR1 | 23 → 26 columns. The new columns are NULL on all 943 rows, and the old columns are unchanged. |
| `fix2-apply-run1.sql` (47749151…a7a54) | 10 batches, 945 statements (UPDATE 941 · INSERT OR IGNORE 2 · DELETE 2). **Every statement changed exactly the expected 1 row: 0 mismatches against the batch vectors.** Each batch ran in a transaction. |
| After apply | 943 rows. 638 finals, 550 with an identifier, as `final_rows`. Non-final classes and reasons identical to `after_classes`. 943 rows at `bonds-1.3.1`. 0 non-final rows without a reason. 0 `superseded_by` pointing at a non-final. `status_note` set on 0 rows, as designed. Integrity ok. |
| Apply run a second time | **0 changes** (the optimistic guards hold). |
| `fix2-rollback-run1.sql` (df0ad70f…f12b) | 10 batches, 945 statements, **every one changed exactly 1 row.** The table (every value and its type) and the schema are **identical** to the state just after CR1. |
| `ma-nov-bond-cr1-rollback.sql` | 26 → 23 columns. **The schema text (`sqlite_master`) and the full row dump (values + `typeof`) are byte-for-byte identical to before CR1** (schema `e1515120…23df`, dump `8cd4b832…e16c`). Integrity ok. |
| CR2 + rollback | Both tables are WITHOUT ROWID with no secondary index. A 300-character `value_text` is accepted and 301 is rejected; a bad `state` and a bad `role` are rejected; a duplicate PK is rejected; party `tranche_seq` defaults to 0. After the CR2 rollback, the schema is identical to before and 0 tables are left. |

No stop gate was hit.

## 6 Rollback plan

**CR1**
- **Trigger:** the FIX2 apply mismatches and can't be completed, a reader breaks on the new columns, or the Founder asks.
- **Steps:**
  1. If the FIX2 apply ran (fully or in part), run `bonds/apply/fix2-rollback-run1.sql`, batch by batch. Its guards skip rows that were never applied: rehearsed in full; a partial rollback relies on the same `parser_version='bonds-1.3.1'` guards.
  2. Run `ma-nov-bond-cr1-rollback.sql`: three `DROP COLUMN`s, about 2,830 row-writes.
  3. **Zero-write fallback:** leave the NULL columns in place. Spec v1 §5 says "no reader depends on them". This keeps the change reversible even if D1 refuses `DROP COLUMN`.
- **DROP COLUMN limits checked.** SQLite refuses DROP COLUMN for a column in a PK, UNIQUE, CHECK, index (incl. a partial index's WHERE), view, trigger or foreign key, or for a generated column. **None applies:** D1 has no view or trigger on the table (read on D1 today), and the two partial indexes name only `filing_status` and `instrument_key`. Rehearsed locally on SQLite 3.51.2.
  - **Not verified on D1:** D1 refused `sqlite_version()`, the D1 docs found do not list `DROP COLUMN` explicitly, and there is no precedent in this repo. **U6 step 0** adds a probe, so this is known before CR1 runs: `CREATE TABLE _cr1_probe(a TEXT, b TEXT); ALTER TABLE _cr1_probe DROP COLUMN b; DROP TABLE _cr1_probe;` (≈ 0 rows, under U6's write approval). If D1 refuses it, CR1 is still reversible by the fallback, and the probe result is recorded. The Control's stop gate is not triggered.
- **Verification:** `PRAGMA table_info(bond_issuance)` shows 23 columns; the results-only hash equals `cbe392e1…6251` (for a full rollback after the FIX2 apply); and the 009 explain checks (`tests/fi-009-explain.mjs`) still pass.

**CR2**
- **Trigger:** the offering run fails its checks, or the U8 verification gate fails and the release is dropped.
- **Steps:** prefer the per-run generated rollback (`DELETE … WHERE parser_version = ? AND accession_number IN (…)`, a PK search). For a full reversal, run `ma-nov-bond-cr2-rollback.sql` (`DROP TABLE` ×2; nothing references the tables). The API and UI treat a missing table as "Not read yet" (U9 code check).
- **Verification:** `SELECT name FROM sqlite_master WHERE name LIKE 'bond_offering_%'` returns 0 rows; the bond page still loads.

Rollback files are kept at least 30 days (spec v1 §6).

## 7 Implementation plan and run order

| Step | When | Owner | Content | Depends on |
|---|---|---|---|---|
| U1 (this CR) | Sun 22 | Data-Identity Lead | CR, 4 files, rehearsal | spec v2 approval ✓ |
| Founder CR approval | Sun 22 | Founder | approve CR1 (+ D-CR1 `status_note`), CR2, D-CR3 | this document |
| **U6 BOND.APPLY1** | **Thu 26 evening** | Data-Identity Lead + Tech Ops | **0.** D1 DROP COLUMN probe (§6). **1.** `ma-nov-bond-cr1.sql`. **2.** Re-SELECT `bond_issuance`; compare the **results-only** hash with `cbe392e1…6251` (raw-file hashes always differ); if D1 changed, rebuild with `fix2-build.mjs`. **3.** `fix2-apply-run1.sql` batch by batch, stopping on the first mismatch against the vector. **4.** Ops reconcile (run log ↔ D1; classes = `after_classes`). | write approval 1 · U5 review |
| **U8 BOND.VERIFY** | **Sat 28 after 08:00Z** | Data-Identity Lead | **1.** `ma-nov-bond-cr2.sql`. **2.** Offering run 1 (≤ 8k), checked against the expected vector. **3.** Offering run 2 (≤ 8k). **4.** Reconcile. Only filings whose reliability apply is final. | write approval 2 · U7 diff · the manual 20-filing check |
| U9 BOND.UI | Sun 29 | Engineering | API reads the new columns/tables; D-CR3 measurement; missing-table handling | U6, U8 |

## 8 Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| D1 changes between today's read and U6 (a run adds or changes rows) | L | M (statements mismatch) | Results-only hash compare at U6 step 2; rebuild via `fix2-build.mjs`; every statement is guarded and stops on the first mismatch |
| D1 refuses `DROP COLUMN` | L–M (unverified) | L | U6 step 0 probe; zero-write fallback (leave the NULL columns) |
| DROP COLUMN rewrite cost (≈ 2.8k writes) lands on a busy day | L | L | Only on rollback; check headroom first, or use the fallback |
| F1/F5 document queries scan the table as it grows | L | L | D-CR3: measure at U9; the index is ready (plan tested) |
| `value_text` over 300 characters stops an offering batch | M | L | CHECK rejects the row; the extractor's §6.1 check runs first and the run stops on the first mismatch |
| Someone selects `*` and breaks on the new columns | L | L | No reader uses `SELECT *` on `bond_issuance` in the Worker (`FI_BOND_COLS`); 009 plans unchanged |
| Partial apply left mid-way (a batch fails) | L | M | U6 sends each batch as one D1 call, so a batch applies whole or not at all; the rollback guards skip unapplied rows; stop and reconcile |

## 9 Monitoring

- **U6:** each batch's `meta.changes` against its vector; total `rows_written` against 1,229 (±10%); after the run, the classes against `after_classes`, 0 non-final rows without a reason, and 0 broken `superseded_by` links.
- **U8:** per run `rows_written` ≤ 8k and against the U7 estimate; 0 facts without `source_part`; the CHECK rejections listed.
- **Daily (Ops Health/DQ line, spec v1 §5):** "Bonds: N shown · N couldn't read · 0 unknown reason". A DQ ticket is raised if `unknown` > 0 or `could_not_read` rises.
- **U9:** the real `rows_read` of F1/F5 on D1 (D-CR3).

## 10 Communication

| Audience | Message | Channel | When |
|---|---|---|---|
| Founder | CR for approval: CR1 3 columns (D-CR1), CR2 2 tables, D-CR3 index deferred; rehearsal clean | packet report → Main Lane | Sun 22 |
| Main Lane | U6 needs a results-only before-hash and the DROP COLUMN probe (step 0) | report §4 | Sun 22 |
| BOND.REVIEW (U5) | Migrations + rehearsal evidence to check alongside the parser diff | this document | Thu 26 |

## 11 Approvals required

| Approver | Role | Item | Status |
|---|---|---|---|
| Founder | owner | BOND-CR1 (3 columns, incl. D-CR1 `status_note`) | Pending |
| Founder | owner | BOND-CR2 (2 tables) | Pending |
| Founder | owner | D-CR3: no index now, measure at U9 (recommended) | Pending |
| Founder | owner | Write approval 1 (U6: CR1 + FIX2 apply) | Later — Thu 26 |
| Founder | owner | Write approval 2 (U8: CR2 + offering runs) | Later — Sat 28 |
| BOND.REVIEW | Architect | migrations checked with the parser diff | Later — Thu 26 |
| Main Lane | orchestrator | records the approvals | Pending |
