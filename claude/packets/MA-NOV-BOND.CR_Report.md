# MA-NOV-BOND.CR — Change request CR1 + CR2, migrations (not run), apply rehearsal — Report

```text
PACKET:   MA-NOV-BOND.CR · Control v1 (7d9c5d4e…d55f) · Task v1 (ce6552c4…c2f0) — both verified
RUN:      r-20261122T143042Z-485e · interactive · 2026-11-22 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Architect + Tech Ops
OUTCOME:  DONE — CR document; 4 migration files written and committed, NOT RUN; local rehearsal clean
          (945/945 apply statements = 1 row each; rollback + CR1 rollback restore byte-for-byte)
PINS:     spec v2 c4281815…aef ✓ · spec v1 b30a75ce…2e53 ✓ · FIX2 report 1373dc9f…6e19 ✓ · FIX2 apply files ✓
D1:       4 of 6 allowed read-only statements · 2,050 rows read · 0 written · no migration or apply run on D1
HEAD:     f64652c = origin/November-2026 at start (as the Control states)
```

## 1 Summary and decisions

**Files**

| File | SHA-256 |
|---|---|
| `claude/specs/MA-NOV-BOND_CR.md` | (see the commit) |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql` | b2cd3751…31ff |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr1-rollback.sql` | 0a472553…2144 |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql` | 3a2050cd…4e6b |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr2-rollback.sql` | 54341630…893d |

**What the files do**
- **CR1** adds `status_reason`, `superseded_by` and `status_note` (all `TEXT NULL`, no default, CHECK or index) to `bond_issuance`. It is about 0 row-writes.
- **CR2** creates `bond_offering_fact` and `bond_offering_party`, as in spec v2 §7: WITHOUT ROWID and PK only. It adds a `length(value_text) <= 300` CHECK.
- **Rollbacks:**
  - CR1: `DROP COLUMN` ×3, about 2,830 row-writes because SQLite rewrites the table, or the zero-write fallback of leaving the columns.
  - CR2: `DROP TABLE` ×2.

**Decisions for the Founder (CR §11)**
- **D-CR1 `status_note`: yes, included** (Main Lane recommendation). It costs nothing to add, and `fix2-apply-run1.sql` doesn't reference it. If it is declined, delete one line in each CR1 file.
- **D-CR3 index for the issuer document queries: not included. Recommend measuring at U9.**
  - The F1 counts and the F5 list scan the 943-row table, because `idx_bi_cik_final_key` is partial on `final`. That is 943 reads per view, well under 50k.
  - The index `idx_bi_cik_status(cik, filing_status, filing_date, accession_number)` is plan-tested: with it the plan becomes SEARCH, ≤ 125 rows.
  - Adding it now would change FIX2's 1,229-write estimate.

## 2 Three-point check (CR §4)

- **Index audit.** All CR2 reads, rollbacks and re-parse deletes are SEARCHes on the PK. The CR1 F2 detail and the `superseded_by` link use the PK. P-B1 is unchanged (covering index).
  - The F1, F5 and F3 document queries SCAN `bond_issuance`. D1's own `EXPLAIN QUERY PLAN` gives the same shape.
  - This contradicts spec v1 §5's "≤ ~150 rows per issuer", which needs an index (D-CR3).
- **Single execution.** The largest read is 943 rows; a bond view with offering data is about 81 rows; the DDL is schema-only. All are under 50k.
- **Budget.**
  - Thu 26: about 40k back-fill + 1,229 apply ≈ 41k.
  - Sat 28: about 40k + 12k offering (two runs ≤ 8k) ≈ 53k.
  - Both are under the 60k ceiling and the 100k/day cap. No cron is added. Freeze, Monday and Sunday-morning windows are avoided.

## 3 Rehearsal results (CR §5)

Local `node:sqlite` (3.51.2), loaded from today's single `SELECT * FROM bond_issuance`: 943 rows, identical on read-back.

| Check | Result |
|---|---|
| Before state vs `fix2-summary.json` | classes identical; latest `ingested_at` 2026-10-30, so nothing has been written since FIX2's read |
| Before hash vs `inputs.before.sha256` 1a94593c…3426 | **no match, by construction**: the raw wrangler `--json` file includes per-call `meta` (today's file: 08afbecc…ae4e). The data match is shown by the class identity and the 945/945 guards. **New reference for U6: results-only canonical hash `cbe392e1a5e4f029bf9b7e7c6617837197fd638d0b86512917093ccabe7b6251`** |
| CR1 | 23 → 26 columns, new columns all NULL, old columns unchanged |
| `fix2-apply-run1.sql` | 10 batches / 945 statements; **every statement changed exactly 1 row (0 mismatches)**; after: 638 finals (550 with id), every class = `after_classes`, 0 non-final without a reason, 0 broken `superseded_by`; re-run changes 0 rows |
| `fix2-rollback-run1.sql` | 945/945 statements changed 1 row; table and schema identical to the post-CR1 state |
| CR1 rollback | schema text and full row dump (value + type) **byte-for-byte identical** to before CR1 (schema e1515120…23df, dump 8cd4b832…e16c) |
| CR2 + rollback | CHECKs behave (300 accepted / 301 rejected; bad state and role rejected; duplicate PK rejected); rollback leaves the schema as before |

Evidence is in the session scratchpad: `rehearse.mjs` 8e7da273…f3ab, `rehearsal-result.json` 102dd16b…9ca7, `d1-cr-rows.json` 08afbecc…ae4e.

No stop gate was hit.

## 4 Deviations

1. **D1 statement 1 failed.** `SELECT sqlite_version() …` was refused by D1 ("not authorized to use function: sqlite_version"). It read 0 rows and wrote 0, and it counts toward the 6. I re-ran it without the function.
2. **DROP COLUMN not verified on D1** (version unavailable; the docs found don't list it; no repo precedent). None of SQLite's DROP COLUMN restrictions apply (checked against D1's own schema: no view, trigger or index on the columns). The zero-write fallback keeps CR1 reversible, so the stop gate is not triggered. **I propose U6 step 0:** a throw-away probe table with `DROP COLUMN`, run before CR1.
3. **The FIX2 before-hash can't be re-matched** (§3). U6 step 2 should use the results-only hash instead. This is a method fix for U6, not a FIX2 defect.
4. **File names follow the Control** (`ma-nov-bond-cr1.sql`, `-cr2.sql`), not the spec working names (`…-status-reason.sql`, `…-offering.sql`).
5. **One addition to spec v2 §7's DDL:** the `value_text` length CHECK, which spec v2 §8 calls "checked by the table".

## 5 Boundaries kept

- **Files written:** only the 6 allowed paths. The rehearsal ran in the session scratchpad.
- **Not touched:** code, `docs/`, `.env*`, Status, board, Tower, transitions and logs, `13F Seed/gleif-seed.js`.
- **D1:** 4 read-only statements (1 failed, schema + count, `SELECT *`, 1 `EXPLAIN QUERY PLAN`), 2,050 rows read of ≤ 30,000, 0 writes.
- **Nothing run on D1:** no migration, apply or rollback.
- **Other:** no deploy, install or subagent. One web search of the Cloudflare D1 docs (DROP COLUMN support; no project data sent).
- **Git:** one commit with explicit paths, pushed to `November-2026`.
