# MA-OCT-ENT-CR1 — Entities index change (Tue 13 Oct 2026): add `idx_iem_entity_key`, drop the duplicate `instrument_master` pair

```text
ISSUED BY:    Main Lane (Program Orchestrator)
EXECUTED BY:  Engineering Lead (local Claude Code, Clean (v11); wrangler 4.96.0 by absolute path)
REVIEWED BY:  Architect (by Mon 12 Oct). Consulted: Operations Lead (D1 budget, three-point check, release readiness);
              ETF Product Lead (the ETF-domain 13F Worker reads instrument_master through the cusip index, §4.2)
APPROVED BY:  Founder (Mon 12 Oct gate)
PACKET:       MA-OCT-ENT-CR1 — Entities domain schema change (indexes only); owner Data-Identity Lead
GATE:         Change request → Architect review → Founder approval Mon 12 Oct → apply Tue 13 Oct
```

**Requester:** Data-Identity Lead (CR owner, Entities domain). **Drafted:** Thu 8 Oct 2026. **Priority:** High (a P1 dependency for MA-OCT-007, and a hard precondition for MA-OCT-013).
**Status:** **Rev 1 (Fri 9 Oct 2026).** It applies the Architect's conditions AR-1 to AR-4 (`claude/MA-OCT-ENT-CR1_Architect_Review.md`, `5ca5bb0ee91cb0d57c719f3cb344103b95471f954e3c16bf93fda8fadfc2d2b3`, verdict **PASS WITH CONDITIONS**). It is ready for the Main Lane hash check and Founder approval on Mon 12 Oct. Doc-only lane: no D1 queries, no git writes. Every count below comes from recorded evidence (§10).
**Supersedes:** rev 0, `c85434e221fa88042d0302079f7cbcff57e3bf4386ca58452ccbbd83f1a440ed` (8 Oct).

**Rev 1 changes:**

| Condition | Where | Change |
|---|---|---|
| **AR-1** (RA-4) | §3, §5, §7, §9 | C1 reads are declared as **32.8k–82k** (1 × to 2.5 × *R*ᵢ, under the 9 Oct temp-B-tree rule). The declared read cap rises to **≤ 90k**, with an Operations Lead exception to the 50k per-execution ceiling **granted in advance**. The S1 size gate stays. The actual `rows_read` is recorded. |
| **AR-2** (RA-5) | §3, §5, §6 | Account writes must be **≤ 30,000 before C1**. A **re-check of ≤ 35,000 before each DROP**. A large C2 figure moves C3 to another day. |
| **AR-3** (RA-6) | §6, §7 | **"ENT-CR1 verified" = C1 applied + E1, E2 and E4 passed.** C2/C3 may slip to Wed 14 Oct or to after 23 Oct without holding back the C1 release. The migration file holds only the statements actually applied. |
| **AR-4** (RA-7) | §6, §8 | Start **≥ 08:05 UTC**. ENT-CR1 runs to completion **before any 002 work** on Tue 13. No Entities Worker (A5) deploys and no figi `/run` inside the window. Optional `d1-today` lag sample at +1, +5 and +15 min after C1, handed to LANE-2. |
| Notes N-1, N-2, N-4 (non-blocking; taken up) | §4, §6 | E5's expected "before" is a `SCAN` (N-1). A `sqlite_stat1` preflight read; **no `ANALYZE`** (N-2). The ad-hoc runbook gets a "superseded by ENT-CR1" note in the close-out (N-4). |

---

## 1. What is changing, and why

| # | Change | Why | Source |
|---|---|---|---|
| C1 | `CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);` | `instrument_entity_map` has **no `entity_id` index** (P9, 7 Oct), so every `WHERE entity_id = ?` walks the whole map: about 32.8k rows per page view today (`entities-api.js:317` `/instruments`). MA-OCT-007's issuer pages (R2 keyset page, R4 count) cannot ship without the index; one view would cost about 65.6k reads, over the 50k ceiling. MA-OCT-013's repoints read `instrument_entity_map` by `entity_id`, and its runner **stops and writes nothing** if this index is missing. The index is **composite**: it serves every `entity_id = ?` lookup and also lets R2 read exactly one page in `instrument_key` order with no temp B-tree (≈ 52 reads per 25-row page). | 007 ruling A (Main Lane, 4 Oct); 007 Spec §7.3, §11, O2; composite form recorded in the Decisions Log, 5 Oct; 013 brief rev 1.5 "Hard precondition" |
| C2 | `DROP INDEX idx_instrument_master_isin;` | It duplicates `idx_instrument_isin` (both on `instrument_master(isin)`). | Read Pack finding 3 and P9 (7 Oct); Data-Identity sign-off (d), ruling **DIL-0208-1**, accepted |
| C3 | `DROP INDEX idx_instrument_master_cusip_issuer;` | It duplicates `idx_instrument_cusip6` (both on `instrument_master(cusip_issuer_6)`). | same |

**Why we drop this pair (DIL-0208-1).** `idx_instrument_isin` and `idx_instrument_cusip6` are the pair in the migration of record (`App/Corporate Atlas/migrations/corporate-atlas-v1.sql:134-135`, `CREATE INDEX IF NOT EXISTS`), and `src/entities-figi.js:35` names `idx_instrument_isin`. The `idx_instrument_master_*` pair was created ad hoc in the Gate 2 / prompt-6 steps (`corporate_atlas_prompt6_execution_v3.md:312-318`). If we dropped the migration's pair instead, any migration replay would recreate it, and the repo DDL would stop describing the live schema.

**Benefit:**
- C1 makes issuer pages and 013 possible inside the budget.
- C2/C3 remove 2 index writes from every `instrument_master` insert, and from every update that changes `isin` or `cusip_issuer_6` (FIRDS adds about 90–100 rows each Sunday; `logs/firds-seed.log`, 13 and 27 Sep).
- No query loses an index. Each surviving index is on exactly the same single column.

**Out of scope:** any other index; any data change; any code change; the `entities-figi.js:35` comment. That comment's claim that the isin path is "index-covered" is not supported by the SQL at `:186-195`, which uses `isin IS NOT NULL OR cusip IS NOT NULL`. The comment is noted for a later tidy-up and is not changed here.

## 2. Impact analysis

| Area | Impact | Details |
|---|---|---|
| Users | Low (positive) | No visible change on 13 Oct. Once 007 ships, issuer pages load in about 52–1,054 reads per view instead of about 65.6k. The current `/instruments` route also stops reading the whole map. |
| Systems | Medium | One D1 database, `meridian-etf`. Three DDL statements on two Entities-domain tables. **Readers of `instrument_master` by `cusip_issuer_6`:** `meridian-13f` (ETF domain, `App/ETF Refresh/src/worker-13f.js:229-236`) and `seed-managerpositions.js:201`. Today they use `idx_instrument_master_cusip_issuer`; afterwards the planner must use `idx_instrument_cusip6`, which has the same shape (§4.2, E6/E8). No Worker deploys and no cron changes. |
| Processes | Low | MA-OCT-013's precondition is met. 007 R2/R4 are unblocked. FIRDS and figi writes get slightly cheaper. |
| Cost (D1) | Low | **About 33.1k–82.3k reads** (AR-1) and about 32.8k writes on the day (§5); **≤ 1.7%** of the 5M daily read cap and about 33% of the 100k daily write cap. Recurring writes: +1 per `instrument_entity_map` insert or delete, or `entity_id` change; −2 per `instrument_master` insert. |
| Storage | Low | +1 index of about 32.8k entries; −2 indexes of about *N*ᵢₘ entries each (*N*ᵢₘ ≈ 55k, §5). A net reduction. |

## 3. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A plan that used a dropped index switches to a worse plan | Low | Medium | Each surviving index covers the same single column, so the planner sees the same choice. EXPLAIN every listed query before and after (§4). Stop rule: an "after" plan that shows `SCAN instrument_master`, or that lacks the surviving index where the "before" used its twin, triggers rollback step RB-2 for that index only. |
| C1 reads more than one table pass. D1 counts rows through the sort's temp B-tree (9 Oct standing rule). | **Medium** | Low | The single, unsplittable `CREATE INDEX` is declared at **32.8k–82k reads** (AR-1), with a cap of **≤ 90k**, under an **Operations Lead exception to the 50k per-execution ceiling granted in advance**. The size gate stays: S1 *R*ᵢ ≤ 45,000 (32,769 on 7 Oct). Daily impact is ≤ 1.7% of 5M. |
| C1 or a DROP bills more writes than expected. The DDL is atomic, so caps can only be checked afterwards. | Low | Medium | **AR-2 worst-case-safe gates:** `d1-today` `rowsWritten` **≤ 30,000 before C1**. Then **≤ 35,000 before C2 and again before C3**. So even a 2 × C1 (≈ 65.6k) or a DROP billed per entry (≈ *N*ᵢₘ ≈ 55k) stays under the 100k cap. A large C2 figure moves C3 to another day. |
| C1 runs while a writer changes `instrument_entity_map` | Low | Low | No scheduled writer touches the map on a Tuesday. figi is on-request only and must not be run on 13 Oct until this CR is closed. gate2-refresh is manual and must not be run. `CREATE INDEX` is a single atomic statement in D1. |
| The wrangler auth failure (F6 class, codes 10000/7403) interrupts the run | Medium | Low | Every statement is idempotent (`IF NOT EXISTS` / `IF EXISTS`), so retry once after 30 s. Use the pinned 4.96.0 binary by absolute path, never `npx` (006 D7-5; 002 §8.3). |
| An ETF-domain reader (13F) is affected | Low | Medium | Plans E8/E8b are checked before and after. ETF Product Lead consulted (§8). |
| 013 or 007 starts before C1 is verified | Low | High | 013's runner already stops if the index is missing. The Main Lane records C1's verified close-out before either may start. |

## 4. EXPLAIN plan pack (before and after)

All checks are `EXPLAIN QUERY PLAN` (0 rows read), except S1, S3 and P9.
- Run the **before** set immediately before C1, and the **after** set immediately after C3.
- Record each plan verbatim in the close-out.
- Use the literal values shown. They come from the 7 Oct Read Pack: entity 1662, ISIN `US0378331005`, issuer-6 `037833`.

### 4.1 Preflight measurements (reads)

| # | Statement | Expected | Reads |
|---|---|---|---|
| S1 | `SELECT MAX(rowid) AS r FROM instrument_entity_map;` | min/max seek; *R*ᵢ ≈ 32,769 | ≈ 1 |
| S3 | `SELECT MAX(rowid) AS r FROM instrument_master;` | min/max seek; gives *N*ᵢₘ (upper bound) for the rollback cost | ≈ 1 |
| P9 | `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('instrument_master','instrument_entity_map');` | before: the 5 `instrument_master` indexes + the iem autoindex; after: 3 + 2 | ≈ 150 each run |
| ST | `SELECT tbl, idx FROM sqlite_stat1 WHERE tbl IN ('instrument_master','instrument_entity_map');` (N-2). If `sqlite_stat1` does not exist, record "no stat table"; that is not an error. | Lists any statistics. If stale statistics name the dropped twins, an RB-2 investigation starts here. **Do not run `ANALYZE`**: it is a full read of both tables and is not needed. | ≈ 0–10 |

### 4.2 Plan checks

| # | Query (source) | Before (expected; 7 Oct where measured) | After (required) |
|---|---|---|---|
| E1 = **007 P6** | R2: `SELECT iem.instrument_key, iem.source, iem.confidence, iem.created_at, im.security_name, im.security_ticker, im.isin, im.cusip, im.asset_cat, im.country FROM instrument_entity_map iem JOIN instrument_master im ON im.instrument_key = iem.instrument_key WHERE iem.entity_id = 1662 AND iem.instrument_key > '' ORDER BY iem.instrument_key LIMIT 26` (007 §7.2) | `SEARCH iem USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key>?)` + `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` (measured 7 Oct, P5) | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` + `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)`; **no** `USE TEMP B-TREE` |
| E2 = **007 P7** | R4: `SELECT COUNT(*) AS n FROM (SELECT 1 FROM instrument_entity_map WHERE entity_id = 1662 LIMIT 1001)` | `SCAN instrument_entity_map` | `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` |
| E3 | Today's `/instruments` route (`src/entities-api.js:306-322`, entity 1662) | `SCAN iem` (or a PK walk) + `SEARCH im` (PK) + `USE TEMP B-TREE FOR ORDER BY` | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=?)` + `SEARCH im` (PK) + `USE TEMP B-TREE FOR ORDER BY` (it orders on `im` columns, which is expected) |
| E4 = **013 repoint lookup** | `SELECT instrument_key FROM instrument_entity_map WHERE entity_id = 1662` (013 brief rev 1.5, runner precondition) | `SCAN instrument_entity_map` | `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` |
| E5 = **entities-figi isin path** | `src/entities-figi.js:186-195`, with `LIMIT 1000` (unmapped `instrument_master` rows with an ISIN or CUSIP, `NOT EXISTS` on the iem and `openfigicache` PKs) | **Expected `SCAN instrument_master` + correlated `SEARCH`es** on the iem and `openfigicache` PKs (N-1). The `OR` with the unindexed full `cusip` rules out a multi-index OR. That `SCAN` is correct and is **not** a regression. If it does show `MULTI-INDEX OR` over an isin index, note which twin it uses. | The same shape. Any isin index named must be `idx_instrument_isin`. No new `SCAN` where the "before" had a `SEARCH`. |
| E6 = gate2 / Read Pack **B4** | `SELECT COUNT(*) FROM instrument_master WHERE cusip_issuer_6 = '037833'` | `SEARCH instrument_master USING COVERING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?)` (measured 7 Oct) | `SEARCH instrument_master USING COVERING INDEX idx_instrument_cusip6 (cusip_issuer_6=?)` |
| E7 | ISIN point lookup: `SELECT instrument_key FROM instrument_master WHERE isin = 'US0378331005'` | `SEARCH … USING INDEX idx_instrument_isin` **or** `idx_instrument_master_isin` (isin=?) | `SEARCH instrument_master USING INDEX idx_instrument_isin (isin=?)` |
| E8 | **13F holdings join, ETF domain** (`App/ETF Refresh/src/worker-13f.js:229-236`), with `accession_number = 'X'` and `cik = '0000000000'` | `SEARCH h …` + `SEARCH im USING INDEX idx_instrument_*cusip* (cusip_issuer_6=?)` + `SEARCH iem` (PK) | The same, with `idx_instrument_cusip6` |
| E8b | `seed-managerpositions.js:195-203` (the same `cusip_issuer_6` join) | as E8 | as E8 |
| E9 = gate3 exposure | `gate3-exposure.js:82` pass 2 and `:95-104` coverage (one `report_month`) | `fund_holdings_monthly` index + `SEARCH im` / `SEARCH iem` by PK (`instrument_key`) | **Unchanged.** It never uses the changed indexes. Recorded as a no-regression check. |
| E10 = gate2-refresh | `gate2-refresh.js:129-134` (`LEFT JOIN iem ON instrument_key … WHERE iem.instrument_key IS NULL`) | `SCAN im` + `SEARCH iem` (PK) | **Unchanged** |

**Pass rule.** E1, E2 and E4 must show `idx_iem_entity_key`. E6, E7, E8 and E8b must name the surviving twin with the same plan shape. E3, E5, E9 and E10 must not gain a `SCAN` or `TEMP B-TREE` they did not have before. Any failure → stop, and apply the rollback for that change only (§7).

**Note on 013's `UPDATE`.** 013's repoint is `UPDATE instrument_entity_map SET entity_id = :survivor WHERE entity_id = :dup …`. Its row-locating step is the E4 lookup. The `UPDATE` form itself is not EXPLAINed here because the lane read helpers refuse write keywords; it is EXPLAINed in 013's own three-point check.

## 5. Three-point check: reads, writes and budget

| Step | Statement | Reads | Writes | Notes |
|---|---|---|---|---|
| Preflight | S1, S3, P9 (before), ST, E1–E10 (EXPLAIN) | ≈ 162 | 0 | |
| C1 | `CREATE INDEX IF NOT EXISTS idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);` | **32.8k–82k** (1 × to 2.5 × *R*ᵢ). One table pass, plus the sort through a temp B-tree, which D1 counts under the 9 Oct rule. **One execution; it cannot be split.** | ≈ *R*ᵢ ≈ **32,769** index entries + 1 schema row (the Main Lane's "about 33k writes"). Not yet measured in this project for DDL. | **AR-1: above the 50k per-execution ceiling at worst. Runs only under the Operations Lead exception granted in advance (cap ≤ 90k).** Size gate: S1 *R*ᵢ ≤ 45,000. |
| C2 | `DROP INDEX IF EXISTS idx_instrument_master_isin;` | ≈ 0 | **Expected** ≈ 0–2 (schema row). **Not yet measured.** Worst case if D1 bills per entry: ≈ *N*ᵢₘ ≈ 55k. | Gate AR-2(b) first. Record the D1 `meta` as reported. **If C2 reports > 1,000 writes: stop. C3 moves to another day** (AR-2(c)). |
| C3 | `DROP INDEX IF EXISTS idx_instrument_master_cusip_issuer;` | ≈ 0 | as C2 | Gate AR-2(b) first (re-read `d1-today`). |
| Post | P9 (after), E1–E10 (EXPLAIN) | ≈ 150 | 0 | |
| **Total** | | **≈ 33.1k–82.3k** | **≈ 32.8k expected** | **Declared caps: ≤ 90k reads (AR-1); writes bounded by the AR-2 gates, so the day stays under 100k in the worst case.** Stop and report if the read cap is exceeded or any gate fails. |

**Operations Lead exception (AR-1), required before C1.** This is a one-time exception to the 50k per-execution ceiling for C1 only, on Tue 13 Oct (or the Wed 14 Oct fallback), with a cap of ≤ 90k `rows_read`. It covers one read-only-equivalent DDL statement that cannot be split, and it comes with the AR-2 write gates. Requested from LANE-1-OPS by the Main Lane (LANE-1-OPS NEXT, 9 Oct). **No exception on file → C1 does not run.**

**Write gates (AR-2), all from `GET meridian-ops /api/ops/cf/d1-today`, plus `hold_all_jobs` = `false` (1 PK read):**
- **(a) before C1:** `rowsWritten` **≤ 30,000**. A Tuesday morning is normally in the hundreds, so this costs nothing. Even a 2 × C1 surprise (≈ 65.6k) then stays under 100k.
- **(b) before C2, and again before C3:** re-read; proceed only if `rowsWritten` **≤ 35,000**. That leaves room for one DROP billed at ≈ 55k plus margin. After a normal C1 the figure is ≈ 33.5k, so the gate passes. **If it fails, C2/C3 move to another day** (AR-3).
- **(c)** If C2 reports > 1,000 writes, stop before C3. C3 moves to another day.

**Measured DDL cost.** The close-out records the actual `rows_read` and `rows_written` for C1, C2 and C3 from the D1 `meta`. These are the project's first measured DDL costs, and they replace the estimates above for any future index CR.
- **Recurring effect after the change:**
  - +1 write for each `instrument_entity_map` insert or delete (figi and gate2 inserts; 013 repoints become 2 writes per row, as 013's brief already assumes);
  - −2 writes for each `instrument_master` insert (FIRDS: about 100 a week);
  - no change for other tables.

## 6. Implementation plan and timing

**Date and window: Tue 13 Oct 2026, start no earlier than 08:05 UTC (AR-4) and finish by 10:30 UTC.** 08:05 keeps the S1 and `d1-today` gates clear of the bootstrap's 4-hourly fire at 08:00. The window keeps it:
- clear of the Monday seed (Mon 03:30–05:00);
- clear of the Sunday 04:00–07:00 window;
- clear of the daily enrich window (05:50–07:10);
- clear of the boost slots (10:50–10:59, 16:50–16:59);
- outside 17–23 Oct (the 011 run);
- **before any MA-OCT-013 merge** (013 also follows 011's close).

If the window is missed, the next permitted slot is Wed 14 Oct, same hours. **Never on 17–23 Oct.**

**Sequencing on Tue 13 (AR-4):**
- **ENT-CR1 runs to completion, through step 8 drafted, before any 002 work that day.** 002's A3 sweep route and health-check revival are also on Tue 13, and A4 may save then. The tables don't overlap, but the work shares the Engineering Lead session and the `d1-today` reading.
- **Inside 08:05–10:30 UTC:** no Entities Worker deploys (002 A5, including CR-7 delta gating), no figi `/run`, no gate2-refresh, no gate3-exposure.

| Step | Owner | When (UTC) | Depends on |
|---|---|---|---|
| 0. Confirm three things: the Founder's approval (12 Oct); the Architect's verdict (PASS WITH CONDITIONS, 9 Oct) with this rev 1 hash-checked by the Main Lane; and the Operations Lead's AR-1 exception on file | Engineering Lead | before 08:05 | this CR |
| 1. Tooling preflight: `/usr/local/bin/wrangler --version` = **4.96.0**, or `App/Corporate Atlas/node_modules/.bin/wrangler` once 002's pin (CR-5, §8.3) lands, checked the same way. `whoami` shows OAuth and `d1 (write)`. `ls .git/*.lock` returns nothing. **The Operations Lead's AR-1 exception is on file.** | Engineering Lead | 08:05 (tooling checks may start earlier; no D1 before 08:05) | — |
| 2. Gates: S1 (*R*ᵢ ≤ 45,000), S3 (record *N*ᵢₘ), ST (N-2), `hold_all_jobs` = false, **`d1-today` `rowsWritten` ≤ 30,000 (AR-2(a))** | Engineering Lead | 08:05 | 1 |
| 3. Before set: P9 + E1–E10, recorded verbatim | Engineering Lead | 08:10 | 2 |
| 4. **C1**, then immediately E1, E2 and E4. Record C1's `rows_read` and `rows_written`. If they fail → RB-1. **If they pass, ENT-CR1 is "verified" for release (AR-3).** *Optional (AR-4): read `d1-today` at +1, +5 and +15 min after C1, timestamped, for LANE-2's analytics-lag sample (002 §8.5 / OPS-R3 F-4); 3 GETs, 0 D1 reads.* | Engineering Lead | 08:20 | 3 |
| 5. **AR-2(b) gate** (`rowsWritten` ≤ 35,000), then **C2**, then E5 and E7. Record C2's `meta`. If C2 reports > 1,000 writes → stop, and C3 moves to another day. **AR-2(b) gate again**, then **C3**, then E6, E8 and E8b. If they fail → RB-2 for that index. **If a gate fails or the window runs out → C2/C3 move to Wed 14 Oct or to after 23 Oct (AR-3).** | Engineering Lead | 08:30 | 4 passes |
| 6. After set: P9 + E3, E9 and E10. Read and write totals from the D1 `meta` against §5's caps. | Engineering Lead | 08:40 | 5 |
| 7. Repo DDL of record: a new migration file `App/Corporate Atlas/migrations/ent-cr1-index-change.sql` holding **only the statements actually applied** (`IF NOT EXISTS` / `IF EXISTS`). If C2/C3 slipped, they go in a follow-up file `ent-cr1b-drop-duplicate-indexes.sql` that is committed when they run (AR-3). Also add a one-line note to `App/Corporate Atlas/corporate_atlas_prompt6_execution_v3.md` at `:312-318`: "superseded by MA-OCT-ENT-CR1 (13 Oct 2026); do not replay" (N-4). The note is not part of this CR's DDL scope. All of this is committed in the close-out commit by explicit path. | Engineering Lead | same day | 6 |
| 8. Close-out note: plans, the measured `rows_read` / `rows_written` for C1, C2 and C3, *N*ᵢₘ, the ST result, start and end times, the wrangler version, the optional lag readings, the commit SHA. The Main Lane records **"ENT-CR1 verified" as soon as C1 and E1/E2/E4 have passed**. That releases 013's precondition and 007's R2/R4, whether or not C2/C3 have run (AR-3). | Engineering Lead → Main Lane | same day | 7 |

**Execution rules:**
- Every statement runs as `<absolute path to wrangler 4.96.0> d1 execute meridian-etf --remote --json --config "App/Corporate Atlas/wrangler-entities-enrich.toml" --command "<SQL>"`.
- **Never `npx wrangler`**, and never a bare `wrangler` from `PATH` without the version check.
- One statement per execution.
- **On a wrangler error (10000/7403):** retry the same idempotent statement once after 30 s. A second failure → stop and report. Never improvise around it.
- **Do not run on 13 Oct until this CR closes:** figi `/run`, gate2-refresh, gate3-exposure.

## 7. Rollback plan

| ID | Trigger | Steps | Cost | Verification |
|---|---|---|---|---|
| **RB-1** (undo C1) | E1, E2 or E4 does not show `idx_iem_entity_key`; any regression on E3; or a write total over the cap | `DROP INDEX IF EXISTS idx_iem_entity_key;` | ≈ 0 reads, ≈ 0–2 writes | P9 shows no iem `entity_id` index; E3 matches its "before" plan. **Consequence:** 007 R2/R4 stay blocked, and 013's runner refuses to start. Report to the Main Lane the same day. |
| **RB-2** (undo C2 and/or C3, one index at a time) | E6, E7, E8, E8b or E5 shows a `SCAN` or a worse plan than "before", with the surviving twin present | `CREATE INDEX IF NOT EXISTS idx_instrument_master_isin ON instrument_master(isin);` and/or `CREATE INDEX IF NOT EXISTS idx_instrument_master_cusip_issuer ON instrument_master(cusip_issuer_6);` | **Each ≈ *N*ᵢₘ reads and ≈ *N*ᵢₘ writes**, about 55k each with *N*ᵢₘ measured by S3 (54,562 in July plus FIRDS additions) | The plan for that query matches its "before". P9 lists the recreated index. |

**RB-2 limits (stated so nobody is surprised):**
- Each recreate is **one execution of about 55k reads, over the 50k single-execution ceiling**. Under the AR-1 temp-B-tree rule it could report **up to ≈ 137k reads** (2.5 × *N*ᵢₘ). That is still harmless to the 5M daily budget, but it needs an explicit Operations Lead exception at the time, and the exception must state that upper figure.
- The two recreates **must not run on the same day** (about 110k writes, over the 100k daily cap). Run one per day, outside the windows in §6.
- An RB-2 trigger is very unlikely, because the surviving twin indexes the identical column. If a plan regresses anyway, the first action is to **stop and report** with the plan text. RB-2 runs only on the Architect's and Operations Lead's say-so.

**Partial failure:** each of C1–C3 is a single atomic DDL statement in D1. A failed statement leaves no half-built index, so a retry is safe.

**C2/C3 slipping is not a rollback (AR-3).** If C2/C3 do not run on Tue 13, both twins simply stay. That is today's state and costs only the existing write amplification. C1 stays applied and verified.

## 8. Communication plan

| Audience | Message | Channel | Timing |
|---|---|---|---|
| Architect | Review this CR; the EXPLAIN pack and rollback limits | Main Lane review request | by Sat 10 Oct → verdict before Mon 12 Oct |
| Operations Lead | **Grant in advance the AR-1 exception for C1** (≤ 90k reads, one execution, Tue 13 / Wed 14 only). The AR-2 write gates. The RB-2 exception (≤ ≈ 137k reads per recreate) only if it is ever needed. | Main Lane → LANE-1-OPS (NEXT, 9 Oct) | before Mon 12 Oct |
| LANE-2 (002 spec) | Optional `d1-today` lag sample at +1, +5 and +15 min after C1 (a known batch of about 33k writes) | close-out note | Tue 13 Oct |
| ETF Product Lead | The 13F Worker and the manager-positions seed switch from `idx_instrument_master_cusip_issuer` to the identical `idx_instrument_cusip6`. Plans E8/E8b are checked before and after. No ETF code change. | Main Lane | with the review request |
| Founder | Approve on Mon 12 Oct (one checkpoint, alongside the 006 close and the 011 gate) | Founder gate | Mon 12 Oct |
| 007 and 013 lanes | "ENT-CR1 verified" (or "rolled back") with the after-plans | Main Lane / Decisions Log | Tue 13 Oct, after step 8 |

## 9. Approvals required

| Approver | Role | Status |
|---|---|---|
| Data-Identity Lead | CR owner (Entities domain) | Drafted |
| Architect | Design and safety review, three-point check | **PASS WITH CONDITIONS** (9 Oct, `5ca5bb0e…d2b3`). AR-1 to AR-4 applied in rev 1; a Main Lane hash check only, no new review. |
| Operations Lead | D1 budget, release readiness, **AR-1 ceiling exception (required before C1)** | Pending (requested 9 Oct) |
| ETF Product Lead | Consulted (ETF reader, E8/E8b) | Pending |
| Founder | Gate approval | Pending (Mon 12 Oct) |

## 10. Evidence used (read-only; no D1 queries by this lane)

| Source | SHA-256 / location | Used for |
|---|---|---|
| `claude/MA-OCT-ENT-CR1_Architect_Review.md` | `5ca5bb0ee91cb0d57c719f3cb344103b95471f954e3c16bf93fda8fadfc2d2b3` | Conditions AR-1 to AR-4; notes N-1 to N-6 (rev 1) |
| `claude/relays/LANE-6_NEXT.md` (9 Oct, 2nd pass) | `82237d9359d1624abae1d5bfa682cdb42d96163f03e9748c723f0124398842ea` | Rev 1 instruction |
| `claude/MA-OCT-007_Spec.md` | `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703` | Ruling A, O2, R2/R4 SQL (§7.2), §11 read costs, plan pack P5–P7 / P9 |
| `claude/ReadPacks_2026-10_Query_Ledger.md` | `7683a59d478bec0e2d449ebf0ff1aa4a408aef2a793b41fb72b4427b58c3c019` | 7 Oct live facts: *R*ᵢ = 32,769 (S1); P9 live index list (the duplicate pair; no iem `entity_id` index); B4 uses `idx_instrument_master_cusip_issuer`; P5 actual plan |
| `claude/MA-OCT-013_Spec_Brief.md` (rev 1.5) | `8319cc092aef020f7239c0fc5643f578f028ef971ff71453395b62088d7b2085` | Hard precondition and runner check (E4); repoint write cost (2 per row with the index) |
| Data-Identity sign-off on 002 (d) and ruling DIL-0208-1 | chat record, 8 Oct; accepted by the Main Lane | Which pair is dropped |
| `App/Corporate Atlas/migrations/corporate-atlas-v1.sql:39-56, 134-135` | repo, `October-2026` @ `16918e0` | Table DDL; the surviving pair is in the migration of record |
| `App/Corporate Atlas/src/entities-api.js:306-322`, `src/entities-figi.js:30-40, 186-195` | same | E3, E5 |
| `App/Corporate Atlas/gate2-refresh.js:129-134`, `gate3-exposure.js:82, 95-104` | same | E9, E10 |
| `App/ETF Refresh/src/worker-13f.js:229-236`, `App/ETF Refresh/seed-managerpositions.js:195-203` | same | E8, E8b (ETF-domain readers of the cusip index) |
| `App/Corporate Atlas/logs/firds-seed.log` | local | FIRDS adds about 90–100 `instrument_master` rows a week |

*CR lane record: rev 0 (8 Oct) and rev 1 (9 Oct). Files written: `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` only, plus the lane report in `claude/relays/LANE-6_REPORT.md`. D1 queries: 0. Git: read-only. Committed later by the executing lane (rule 7).*
