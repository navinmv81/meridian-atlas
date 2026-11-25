# MA-NOV-BOND.APPLY — Report

```text
PACKET:   MA-NOV-BOND.APPLY · Control v1 (1b5fc637…16cc ✓) · Task v1 (2fbdb614…ae83 ✓)
RUN:      r-20261125T211749Z-6470 · interactive · LANE_OPENER_v2 (67913343…71d6 ✓)
ROLE:     Data-Identity Lead + Tech Ops
COMMIT:   base 5025050 (HEAD = origin); this report is the only file committed
OUTCOME:  DONE — CR1, FIX2, CR2 and offering runs 1 + 2 applied to meridian-etf; every step verified; no rollback
WRITES:   16,931 row-writes by this packet (probe 127 · CR1 3 · FIX2 1,227 · CR2 4 · offering 7,989 + 7,581)
READS:    15 read-only statements, 2,086,677 rows read — OVER the Control's 50,000 limit (see §10, deviation 1; Founder chose "Continue")
WINDOW:   all writes 21:20:08Z – 21:31:02Z (inside 08:05–23:45Z)
```

## 1 Back-fill check (record only)

Ledger query from BFS.GO §2, read-only, 1 statement, 57 rows read. Windows 05:55–08:00Z on each day.

| Day | Job | Phase / event | Started → ended | rows_read | rows_written | error_class |
|---|---|---|---|---|---|---|
| Tue 24 | phase1 | end / success | 06:00:51 → 06:01:18 | — | — | NULL |
| Tue 24 | expbf | start | 06:01:18 | — | — | NULL |
| Tue 24 | expbf | end / **partial** | 06:01:18 → 06:01:20 | 181,347 | **34,274** | NULL |
| Wed 25 | phase1 | start → end / success | 06:00:50 → 06:00:53 | — | — | NULL |
| Wed 25 | expbf | start | 06:00:53 | — | — | NULL |
| Wed 25 | expbf | end / **partial** | 06:00:53 → 06:00:54 | 136,073 | **32,420** | NULL |

- Phase 1 ended `success` before the back-fill on both days. Its Tue 24 `start` row was not in the window. It may have been received before 05:55Z. This is not checked further.
- Both back-fill runs ended `partial` with no error: Tue 24 ran 2 batches and 15 holders; Wed 25 ran 1 batch and 16 holders. Both stayed under the 40,000 cap.
- **U0** (live d1-today `rows_written` at 21:19:26Z) = **32,579**. Almost all of this is the 06:00Z back-fill.

## 2 Preflight and before-hash

| Check | Result |
|---|---|
| Folder · branch · remote | `…/Meridian Atlas Clean (v11)` · `November-2026` · `navinmv81/meridian-atlas` ✓ |
| `.git/*.lock` | none ✓ |
| HEAD = origin | `502505077efa…8c42` both ✓ |
| `wrangler whoami` | OAuth; `d1 (write)` scope ✓ |
| Task pins (5 reports) | all 5 full SHA-256 match ✓ |
| SQL pins (10 files) | all match the Task's prefixes and suffixes. `App/Corporate Atlas` is unchanged since `5025050` (`git diff --quiet`). Full hashes: cr1 `b2cd3751…31ff`, cr1-rb `0a472553…2144`, cr2 `3a2050cd…94b6`, cr2-rb `5434163d…893d`, fix2 `47749151…7a54`, fix2-rb `df0ad70f…012b`, off1 `fad02a73…8f71`, off1-rb `041ea233…4b10`, off2 `8e189ea5…3294`, off2-rb `c3979989…149a` ✓ |
| `before-hash.mjs` | `20fae3cf…4eda` (= FIX3 §1) ✓ |
| Bond suites | `node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs` → **138 pass, 0 fail** ✓ |
| Time | 21:18Z, inside the window ✓ |
| **Before-hash** | `SELECT * FROM bond_issuance` → 943 rows, 23 columns → **`d70c311a8f5f06cad69b3d3558b10eff3d4ba2233044eaa93db0e6eb514ada51`** ✓ (stop gate passed) |

## 3 DROP COLUMN probe

`CREATE TABLE _cr1_probe(a TEXT, b TEXT); ALTER TABLE _cr1_probe DROP COLUMN b; DROP TABLE _cr1_probe;` was run once, at 21:20:08Z.

- **Result: DROP COLUMN is accepted** on `meridian-etf`. All 3 statements succeeded, each in 1 attempt.
- The DROP COLUMN statement wrote 125 rows and read 915; DROP TABLE wrote 0. The probe's total of ≈ 127 writes comes from the analytics delta (§8).
- `SELECT name FROM sqlite_master WHERE name='_cr1_probe'` returned 0 rows, so the probe table is gone ✓.
- **Consequence:** CR1's real rollback (`ma-nov-bond-cr1-rollback.sql`) is usable. The zero-write fallback is not needed.

## 4 CR1

`npx wrangler d1 execute meridian-etf --remote --yes --file "App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql"` was run at 21:20:30Z. It executed 3 queries, wrote 3 rows and read 498, in 1 attempt.

| Verify | Result |
|---|---|
| Column count | **26** ✓ |
| `status_reason` / `superseded_by` / `status_note` non-NULL | **0 / 0 / 0** of 943 ✓ |
| 23 original columns (explicit list, original order) | **`d70c311a…ada51`** ✓ (unchanged) |

## 5 FIX2 reconcile and H2

`fix2-apply-run1.sql` was run batch by batch, from 21:21:29Z to 21:21:48Z. Each batch was extracted verbatim from the pinned file (comment lines dropped; statement lines byte-identical) and run with `wrangler d1 execute --remote --json --command`. Each statement's `meta.changes` was compared with the batch header's vector. Every batch took 1 attempt.

| Batch | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Statements = changes | 98 | 100 | 99 | 100 | 99 | 99 | 99 | 97 | 100 | 54 | **945 / 945, 0 mismatches** |
| rows_written | 113 | 126 | 137 | 147 | 127 | 127 | 145 | 130 | 121 | 54 | **1,227** (estimate 1,229) |

The batches read 1,000 rows in total.

| Reconcile | Expected | Result |
|---|---|---|
| Rows | 943 | **943** ✓ |
| Finals | 638 | **638** ✓ |
| Finals with CUSIP/ISIN | 550 | **550** ✓ (no non-final row has one) |
| Non-final without `status_reason` | 0 | **0** ✓ |
| Finals with a `status_reason` | — | 0 |
| `superseded_by` set | — | 146 |
| `superseded_by` → not a final | 0 | **0** ✓ |
| Not at `bonds-1.3.1` | 0 | **0** ✓ |

**H2** (same method, `SELECT *`, all 26 columns) = **`801541677283cc95f03ae766bb02dcf8cbe500cbf8a1132707fbdbf85c600b01`**.

## 6 CR2

`npx wrangler d1 execute meridian-etf --remote --yes --file "App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql"` was run at 21:22:21Z. It executed 2 queries, wrote 4 rows and read 2, in 1 attempt.

- `bond_offering_fact` and `bond_offering_party` are in `sqlite_master`. Each is `WITHOUT ROWID` with its PK only, and has no other index ✓.
- Both tables are empty (0 / 0) ✓.
- `PRAGMA quick_check` = **ok** ✓. **This check read 2,031,185 rows, because it scans the whole database.** See §10, deviation 1.

## 7 Offering runs

Both runs used the same batch method as FIX2. Vector sums: run 1 = 7,989, run 2 = 7,581 (= FIX3 §5). Every batch took 1 attempt.

**Run 1.** Headroom: live `rows_written` at 21:29:40Z = 33,940, and 33,940 + 7,989 = **41,929 ≤ 58,000** ✓. Applied from 21:30:11Z to 21:30:26Z.

| Batch | 1 | 2 | 3 | 4 | 5 | Total |
|---|---|---|---|---|---|---|
| Statements · 0 mismatches | 99 | 99 | 100 | 100 | 34 | 432 ✓ |
| Changes = rows_written | 1,543 | 1,357 | 2,052 | 2,156 | 881 | **7,989** ✓ |

The batches read 10,795 rows. Verify: **5,902 facts + 2,087 parties**, all at `bonds-offering-1.2.0`; 0 withheld rows; 0 place lists ✓.

**Run 2.** Headroom: analytics still showed 33,940 at 21:30:45Z because of its lag. I used the higher figure, 33,940 + 7,989 = 41,929, and 41,929 + 7,581 = **49,510 ≤ 58,000** ✓. Applied from 21:30:56Z to 21:31:02Z.

| Batch | 1 | 2 | 3 | 4 | Total |
|---|---|---|---|---|---|
| Statements · 0 mismatches | 99 | 100 | 97 | 21 | 317 ✓ |
| Changes = rows_written | 2,390 | 2,318 | 2,391 | 482 | **7,581** ✓ |

The batches read 10,775 rows. Verify:

| Check | Expected | Result |
|---|---|---|
| Facts · at 1.2.0 | 11,576 | **11,576 · 11,576** ✓ |
| Parties · at 1.2.0 | 3,994 | **3,994 · 3,994** ✓ |
| `use_of_proceeds` / `proceeds_total` rows | 0 | **0 / 0** ✓ |
| Non-NULL `selling_restrictions` values | 0 | **0** ✓ |
| Orphan fact / party tranches (tranche 0 → accession exists; n → that row exists) | 0 | **0 / 0** ✓ |

## 8 Final state

- **`bond_issuance`:** 943 rows (638 finals / 550 with an identifier / 0 non-final without a reason), all at `bonds-1.3.1`, 26 columns. Its hash after the offering runs is **`80154167…0b01` = H2** ✓, so the offering runs did not touch it.
- **Offering tables:** 11,576 facts + 3,994 parties at `bonds-offering-1.2.0`; 0 withheld rows; 0 place lists; 0 orphans.

**Row-writes per step:**

| Step | Probe | CR1 | FIX2 | CR2 | Offering 1 | Offering 2 | Total |
|---|---|---|---|---|---|---|---|
| rows_written | ≈ 127 ¹ | 3 | 1,227 | 4 | 7,989 | 7,581 | **≈ 16,931** |

¹ 125 is from the DROP COLUMN statement's own meta. The CREATE TABLE statement's meta was not captured, so the remainder comes from the analytics delta: 33,940 − 32,579 − 3 − 1,227 − 4 = 127.

**`rows_written` today:**
- At 21:31:31Z analytics still read 33,940, because it lags 25–30 minutes.
- Counting the offering writes, the day total is **≈ 49,510**, under 58k and well under the 100k cap.
- The 06:00Z back-fill tomorrow falls on a new UTC day.

**Read-only statements (15):**

| Step | Statements | Rows read |
|---|---|---|
| Back-fill ledger | 1 | 57 |
| Before-hash | 1 | 943 |
| Probe check | 1 | 164 |
| CR1 verify | 2 | 1,912 |
| FIX2 reconcile + H2 | 2 | 2,032 |
| CR2 verify | 3 | 2,031,353 (of which `quick_check` 2,031,185) |
| Run 1 verify | 2 | 7,989 |
| Final | 3 | 42,227 |
| **Total** | **15** | **2,086,677** (55,492 without `quick_check`) |

The write statements also read rows through their guards, which is not part of the read-only budget: probe ≈ 1,081, CR1 498, FIX2 1,000, CR2 2, offering 21,570.

Account reads today at 21:31Z: 2.34M of the 5M cap.

## 9 Rollback commands for the go-live packet

Nothing was rolled back. The files are pinned as in the Task. Run them from the repo root with `--remote` and no `-c`.

Each batched file must be run batch by batch, with every statement's `changes` checked against its header vector, stopping on the first mismatch. Its header vector holds the expected changes per statement.

| Order | Command | Row-writes (headroom needed) |
|---|---|---|
| 1 | `bonds/apply/offer-rollback-run2.sql` (4 batches, 317 statements) | 7,581 |
| 2 | `bonds/apply/offer-rollback-run1.sql` (5 batches, 432 statements) | 7,989 |
| 3 | `npx wrangler d1 execute meridian-etf --remote --yes --file "App/Corporate Atlas/migrations/ma-nov-bond-cr2-rollback.sql"` | ≈ 4 (tables empty after 1–2) |
| 4 | `bonds/apply/fix2-rollback-run1.sql` (10 batches, 945 statements, reverse order) | ≈ 1,229 |
| 5 | `npx wrangler d1 execute meridian-etf --remote --yes --file "App/Corporate Atlas/migrations/ma-nov-bond-cr1-rollback.sql"` | ≈ 2,830 (943 per DROP COLUMN; the probe proved DROP COLUMN is accepted) |
| | **Full unwind** | **≈ 19,633**: start only when live `rows_written` + 19,633 ≤ 58,000 (or the part being run) |

- **Offering only** (keep the tables and the reliability data): steps 1–2, 15,570 writes.
- **After a full unwind:** `bond_issuance` should hash to `d70c311a…ada51` again, over 23 columns.

## 10 Boundaries kept, and deviations

**Kept:**
- Writes: each pinned write ran exactly once, in the Control's order.
  - The probe, then CR1, FIX2, CR2, offering run 1 and offering run 2.
  - No other SQL write. No rollback file was run.
  - No pinned file was edited. No SQL was rebuilt.
- Out of scope, untouched: Ops tables, the back-fill job and its pause row; deploys, toml, crons and secrets; other Workers; `docs/`; `.env*`; `13F Seed/gleif-seed.js`.
- Never touched: Status, the board, the Tower and `transitions.jsonl`; no installs, no subagents, no git rewriting.
- The headroom rule was applied before each offering run, and the time window was kept.
- No code-10000 error occurred.
- The OAuth token was read locally by a scratchpad script for the analytics read, and was never printed.
- Batch files, outputs and helper scripts are in the session scratchpad only, not in the repo.

**Deviations:**
1. **The read-only budget was exceeded: 2,086,677 rows read against a limit of ≤ 50,000.**
   - The cause is `PRAGMA quick_check`, which I chose for CR2's "integrity ok". It scans the whole database (2,031,185 rows).
   - Even without it, the verification reads total 55,492. Most of that is the final orphan check (32,681), which looks up each fact in `bond_issuance`.
   - Statements: 15 of the 30 allowed.
   - I stopped after CR2 and asked the Founder, who chose **"Continue"**. The offering checks then used one scan per table.
   - Effect: the account read 2.34M of its 5M daily reads. No cap was reached, and no job was affected.
   - **For later packets:** use `PRAGMA quick_check(<table>)` or a per-table check rather than a whole-database `quick_check` on `meridian-etf`.
2. **FIX2 and the offering runs used `--command` per extracted batch, not `--file`.**
   - The Task asks for a per-batch vector comparison, and `--file` returns only a file-level total.
   - The extracted statements are byte-identical to the pinned files' statement lines. The statement counts (945 / 432 / 317) and vector sums (7,989 / 7,581) match the file headers.
3. **The headroom figure for run 2 was computed, not read.** Analytics lags 25–30 minutes, so I used the larger of the analytics reading and U0 plus this packet's own writes. Both readings are recorded in §7.
