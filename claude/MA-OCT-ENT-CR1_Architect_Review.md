# MA-OCT-ENT-CR1: Architect Review

```text
ISSUED BY:    Main Lane (REVIEW-A NEXT, Fri 9 Oct)
EXECUTED BY:  Architect (independent review session, doc-only)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Mon 12 Oct gate)
PACKET:       MA-OCT-ENT-CR1, Entities-domain index change (owner: Data-Identity Lead)
VERDICT:      PASS WITH CONDITIONS. Four doc-only edits to the CR are needed before Mon 12 Oct (AR-1 to AR-4).
              The design, the choice of which pair to drop, the EXPLAIN pack, the timing and the rollback are all sound.
```

## 0. Evidence and method

| Item | Value |
|---|---|
| CR under review | `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` **`c85434e221fa88042d0302079f7cbcff57e3bf4386ca58452ccbbd83f1a440ed`**. Re-hashed on disk; it matches the NEXT file. |
| Cited evidence, re-hashed | `MA-OCT-007_Spec.md` `8e1be2d3…b4e703` ✔; `ReadPacks_2026-10_Query_Ledger.md` `7683a59d…c019` ✔; `MA-OCT-013_Spec_Brief.md` `8319cc09…2085` ✔. All match the CR's §10. |
| Also used | `October_Decisions_Log.md` `26422e64…4366` (9 Oct entry: LANE-1-ENG Appendix A, *M* = 32,769, and the **standing rule that D1 counts rows through temp B-trees**); `MA-OCT-007_AppendixA_Results.md` `32bb3d1e…ee13`. |
| Code read (repo `16918e0`, read-only) | `corporate-atlas-v1.sql:39-56, 134-135`; `corporate_atlas_prompt6_execution_v3.md:310-320`; `entities-api.js:300-324`; `entities-figi.js:30-40, 184-197`; `gate2-refresh.js:127-136`; `gate3-exposure.js:78-106`; `App/ETF Refresh/src/worker-13f.js:225-238`; `seed-managerpositions.js:193-205`. Repo-wide grep for `idx_instrument_master`, `idx_instrument_(isin\|cusip6)`, `idx_iem` and `INDEXED BY`. |
| Actions | 0 D1 reads, 0 writes. No git writes (`--no-optional-locks`, no `.git/*.lock`). |

## 1. What I verified

| Claim in the CR | Check | Result |
|---|---|---|
| `instrument_entity_map` has no `entity_id` index | DDL: `instrument_key TEXT PRIMARY KEY` gives a rowid table with one autoindex on `instrument_key`. Read Pack P9 agrees. | ✔ |
| `MAX(rowid)` is a valid size gate | It is a rowid table, not `WITHOUT ROWID`. *R*ᵢ = 32,769 equals the counted *M* = 32,769 (LANE-1-ENG, 9 Oct), so there is no deletion gap. | ✔ |
| Composite `(entity_id, instrument_key)` serves R2, R4, `/instruments` and 013 | Equality on the leading column with a range or order on the second gives one ordered page with no temp B-tree (R2). It is a covering index for `SELECT instrument_key … WHERE entity_id = ?` (R4 and 013). Matches the 007 spec P6/P7 and the 5 Oct Decisions Log entry. | ✔ |
| Which pair to drop (DIL-0208-1) | `idx_instrument_isin` and `idx_instrument_cusip6` are in the migration of record (`:134-135`, `IF NOT EXISTS`). The `idx_instrument_master_*` pair was created ad hoc (`prompt6_execution_v3.md:312-318`). Dropping the ad-hoc pair keeps the repo DDL matching the live schema. | ✔ Correct choice |
| No code depends on the dropped names | Grep: no `INDEXED BY` anywhere. The only index name in code is the comment at `entities-figi.js:35`, and it names the **surviving** `idx_instrument_isin`. | ✔ No code risk |
| Same-column twins mean the planner keeps the same plan | Both pairs are single-column, non-unique and non-partial on identical columns. B4 (7 Oct) used the ad-hoc twin purely by name order. | ✔ |
| ETF-domain readers E8/E8b | `worker-13f.js` and `seed-managerpositions.js` join `im.cusip_issuer_6 = substr(h.cusip,1,6) AND im.cusip = h.cusip`. That is equality on the indexed column, so the twin swap gives the same shape. No ETF table is written. | ✔ |
| E3/E5/E9/E10 sources | Each SQL matches what the CR describes. E9/E10 join `iem` and `im` by the `instrument_key` PK only. | ✔ |
| Recurring cost | +1 write per `iem` insert, delete or `entity_id` change (figi, gate2, 013 at 2 per row, as 013 rev 1.5 already assumes); −2 per `instrument_master` insert. 011 rev 1.6 writes no `instrument_entity_map` rows, so 011's write plan is unaffected. | ✔ |

## 2. Conditions (doc-only edits to the CR before Mon 12 Oct)

**AR-1 (required): declare C1's read count under the 9 Oct temp-B-tree rule, and pre-clear the per-execution ceiling.**
`CREATE INDEX` reads the table once and then sorts every entry before it builds the B-tree. The Decisions Log of 9 Oct records that D1 counts rows that pass through temp B-trees: Appendix A Q1+Q2 were reported at 65.5k and Q3 at 79.6k against ≈ 32.8k-row tables. The standing rule there is 2.5 × *N* for unindexed sorts. Nothing in the project measures what D1 reports for `CREATE INDEX`, so C1 may report anywhere from ≈ 32.8k to ≈ 82k `rows_read` **in one execution that cannot be split**.

Daily budget impact is negligible either way (≤ 1.7% of 5M). Two things break, though:
- the 50k single-execution ceiling;
- the CR's own declared cap of ≤ 40k reads (§5).

The "stop and report" rule would only fire after the index already exists.

**Edit:**
- §5 states C1 reads as **32.8k–82k (1 × to 2.5 × *R*ᵢ)**.
- Raise the declared read cap to **≤ 90k**.
- Record an Operations Lead exception, **granted in advance**, to the 50k per-execution ceiling for this one read-only-equivalent DDL statement, as §7 already does for RB-2.
- Keep the S1 gate (*R*ᵢ ≤ 45,000) as the size guard.
- Record the actual `rows_read` in the close-out. That figure becomes the project's first measured DDL cost.

**AR-2 (required): make the write gates worst-case safe, since the DDL is atomic and the caps are checked after the fact.**
Nothing in the project measures what D1 reports as `rows_written` for `CREATE INDEX` or `DROP INDEX`. The CR expects ≈ *R*ᵢ for C1 and ≈ 0–2 for each DROP. Two problems:
- The present gate (`rowsWritten` + 35,000 ≤ 70,000) lets C1 start with up to 35k already written today.
- A DROP that were billed per index entry would cost ≈ *N*ᵢₘ ≈ 55k.

The worst case is therefore 35k + 33k + 55k, which is over the 100k cap.

**Edit:**
- **(a) C1 gate:** `rowsWritten` ≤ 30,000 before C1. A Tuesday morning is normally in the hundreds, so this costs nothing. Even a 2 × surprise on C1 (≈ 65.6k) then stays under 100k.
- **(b) New gate before C2 and again before C3:** re-read `d1-today` and proceed only if `rowsWritten` ≤ 35,000. That leaves room for one DROP billed at ≈ 55k, plus margin. After a normal C1 the figure is ≈ 33.5k, so the gate passes.
- **(c)** Keep C2's "> 1,000 writes → stop before C3" rule. Add: if C2 reports a large figure, C3 moves to another day.

**AR-3 (required): decouple C1 from C2/C3 in the close-out.**
C1 is on the critical path for 007 R2/R4 and 013. C2/C3 are hygiene (DIL-0208-1) and are not on it.

**Edit:**
- "ENT-CR1 verified", which releases 013's precondition and 007 R2/R4, means **C1 applied and E1/E2/E4 passed**.
- If AR-2(b) fails, the window runs out, or any C2/C3 stop rule fires, C2/C3 move to Wed 14 Oct or to after 23 Oct. That does not hold back the C1 release.
- The migration file in step 7 then holds only the statements actually applied, plus a follow-up file for the rest.

**AR-4 (required, small): set the Tue 13 sequencing against 002's build day.**
Tue 13 is also a 002 build day (A3 sweep route and health-check revival; A4 may also save on Sat 10 or Tue 13). The two don't touch the same tables, but they compete for the same Engineering Lead session and the same `d1-today` reading.

**Edit:**
- Start at **≥ 08:05 UTC**, not 08:00, so the bootstrap 4-hourly fire at 08:00 does not overlap the S1/`d1-today` gates.
- Run ENT-CR1 to completion (step 8 drafted) **before** any 002 work that day.
- No Entities Worker deploys (A5) and no figi `/run` inside 08:05–10:30.
- **Optional, recommended:** C1 is a known, isolated batch of about 33k writes. Read `d1-today` at +1, +5 and +15 min after C1 and hand the readings to LANE-2 as an extra analytics-lag sample (OPS-R3 F-4 / 002 §8.5). It costs 3 GETs and no D1 reads.

## 3. Notes (non-blocking)

- **N-1, EXPLAIN pack.**
  - E5's "before" will almost certainly be `SCAN im` plus correlated `SEARCH`es. The `OR` with the unindexed full `cusip` stops a multi-index OR, so no isin index will appear. Say so, so that a correct `SCAN` is not mistaken for a regression. The pass rule ("no new `SCAN`") already handles it.
  - For E3, `ORDER BY im.*` keeps its `USE TEMP B-TREE`, as the CR says. The new index bounds that sort to the issuer's rows (at most 871 for entity 28088). The CR's E3 "after" is correct.
- **N-2, do not run `ANALYZE`.** It is a full read of both tables and is not needed. The equality on the leading column is chosen without statistics. Add to preflight one cheap read of `SELECT tbl, idx FROM sqlite_stat1 WHERE tbl IN ('instrument_master','instrument_entity_map')`, wrapped so that a missing table is not an error. If stale statistics name the dropped twins, an RB-2 investigation starts there, not with a 55k-row recreate.
- **N-3, rollback.**
  - RB-1 is cheap and correct.
  - RB-2's limits are stated honestly: each recreate is ≈ 55k reads and writes, over the per-execution ceiling, and the two recreates cannot run on the same day.
  - Under AR-1 a recreate could report up to ≈ 137k reads. That is still harmless to the daily budget, but the Ops exception for it should say so.
  - Agreed: RB-2 runs only on the Architect's and Operations Lead's say-so.
- **N-4, the ad-hoc runbook.** `corporate_atlas_prompt6_execution_v3.md:312-318` would recreate the dropped pair if anyone replayed it. Add a one-line "superseded by ENT-CR1" note to it in the close-out commit, or log a Known Issue. Keep it out of this CR's DDL scope.
- **N-5, timing verdict.**
  - Tue 13 Oct, 08:05–10:30 UTC is clear of the Monday seed, the Sunday window, enrich (05:50–07:10), the boost slots and 17–23 Oct.
  - It is before any 013 merge, since 013 follows 011's close.
  - The Wed 14 fallback is fine. Never 17–23 Oct.
  - **Accepted.**
- **N-6, ETF-domain impact.** From an Architect reading of the code, the plans of the two ETF-domain 13F readers are unchanged in shape and no ETF table is touched. The formal ETF PL consult (§8 of the CR) was not asked of this session, so the Main Lane should route it.

## 4. Summary for the Main Lane

1. **Verdict:** PASS WITH CONDITIONS. AR-1 to AR-4 are doc-only CR edits by the Data-Identity Lead and need only a Main Lane hash check, not a new review.
2. **Founder, Mon 12 Oct:** approve ENT-CR1 once the AR edits are on disk.
3. **Operations Lead:**
   - the pre-approved 50k-ceiling exception for C1 (AR-1);
   - the tightened write gates (AR-2);
   - the optional lag sample (AR-4).
4. **Close-out (Tue 13):** record the actual `rows_read` and `rows_written` for C1, C2 and C3. These are the project's first measured DDL costs.

---

## 5. Rev 1 hash check, and the ETF Product Lead consult (appended Fri 9 Oct 2026, REVIEW-A 3rd pass)

```text
ISSUED BY:    Main Lane (REVIEW-A NEXT, Fri 9 Oct, 3rd pass; sha256 ec8d5af7d836f7db72bcf4a4048f7f812505c1fba332706ad7b4d34a902afe53)
EXECUTED BY:  Architect + ETF Product Lead (independent review session, doc-only)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Mon 12 Oct gate)
INPUT:        claude/MA-OCT-ENT-CR1_Index_Change_Request.md rev 1
              fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20 (re-hashed on disk; matches the NEXT)
VERDICT:      AR-1..AR-4 APPLIED (hash check). ETF PL consult: PASS WITH NOTES. Nothing required before approval.
```

§1–§4 above are unchanged. This section is append-only. Pre-append hash of this file: `5ca5bb0ee91cb0d57c719f3cb344103b95471f954e3c16bf93fda8fadfc2d2b3`.

### 5.1 AR-1 to AR-4: applied (hash check only, as RA-4..RA-7 asked)

| Condition | Where in rev 1 | Check | Result |
|---|---|---|---|
| AR-1 | §3 risk row 2; §5 C1 row and Total; §5 "Operations Lead exception" paragraph ("No exception on file → C1 does not run"); §6 step 0 and step 1; §8 Ops row; §9 Ops row | 32.8k–82k declared; cap ≤ 90k; exception granted in advance; S1 ≤ 45,000 kept; actual `rows_read` recorded (§5 "Measured DDL cost", §6 step 8) | ✔ |
| AR-2 | §3 risk row 3; §5 write gates (a), (b), (c); §6 step 2 and step 5 | ≤ 30,000 before C1; ≤ 35,000 before C2 **and** before C3; > 1,000 on C2 → C3 to another day | ✔ |
| AR-3 | §6 step 4, step 7, step 8; §7 last paragraph | "Verified" = C1 + E1/E2/E4; C2/C3 may slip to Wed 14 or after 23 Oct; migration file holds only applied statements, plus `ent-cr1b-…` follow-up | ✔ |
| AR-4 | §6 "Date and window" and "Sequencing on Tue 13"; step 1; step 4 (optional lag sample); §8 LANE-2 row | ≥ 08:05 UTC; ENT-CR1 before any 002 work; no A5 deploy, figi `/run`, gate2/gate3 in 08:05–10:30; +1/+5/+15 min sample | ✔ |
| N-1, N-2, N-4 (taken up) | §4.2 E5; §4.1 ST; §6 step 7 | as noted in rev 1's change table | ✔ |

The Ops exception itself is OPS-R4 (X-1..X-7, logged 9 Oct). Nothing in rev 1 conflicts with it.

### 5.2 ETF Product Lead consult (CR §8; covers N-6 and E8/E8b)

**Question put to the ETF PL:** the ETF-domain 13F Worker (`meridian-13f`) and the manager-positions seed switch from `idx_instrument_master_cusip_issuer` to the identical `idx_instrument_cusip6`. Is there any ETF impact?

**Evidence (repo `16918e0`, read-only):**

| Item | Value |
|---|---|
| `App/ETF Refresh/src/worker-13f.js` | sha256 `da3955ba14e00406c9b848245790c44cf10257e86542e9efcde00b266aa047f9`; the only `instrument_master` / `instrument_entity_map` reader in `App/ETF Refresh/src/` (lines 230–236, route `/api/13f-manager-holdings`) |
| `App/ETF Refresh/seed-managerpositions.js` | sha256 `ea9003c63aa7f41f71baf24b423bc545d3f405e15f4a8675b4c42764112fed18`; `buildPopulateSql()` lines 196–203 |
| `App/ETF Refresh/wrangler-13f.toml` | `meridian-13f`, **no crons** (request-driven only) |
| Other ETF Workers' crons | `meridian-bootstrap` `0 */4 * * *` (08:00 fire, already cleared by AR-4's 08:05 start); `meridian-holdings` `0 4 * * sun` (not Tuesday). Neither reads `instrument_master`. |
| Repo-wide `cusip_issuer_6` readers outside `App/Corporate Atlas/` | only these two files |
| `INDEXED BY` anywhere | none |

**Findings:**
1. **Plan shape unchanged.** Both statements join `im.cusip_issuer_6 = substr(h.cusip,1,6) AND im.cusip = h.cusip` as a `LEFT JOIN`. The planner's only usable index on `instrument_master` for that join is the `cusip_issuer_6` index (there is no index on the full `cusip`). Both twins are single-column, non-unique, non-partial, on that one column; after C3 only `idx_instrument_cusip6` remains, so the plan is the same `SEARCH im USING INDEX … (cusip_issuer_6=?)`. Per-row reads are identical (all instruments sharing the issuer-6 prefix, then the `cusip` filter); this is today's cost, unchanged by the CR.
2. **No ETF table is written,** and no ETF Worker is deployed or redeployed. The `/api/13f-manager-holdings` response shape is unchanged (no new fields, no contract change).
3. **Timing.** `meridian-13f` has no cron, so the only overlap risk is a user request during the C1 build, which at worst waits behind the DDL for a moment; it cannot read a half-built index (atomic DDL). The seed is manual.
4. **C1 and the ETF side.** The new `idx_iem_entity_key` does not change the 13F join to `instrument_entity_map`, which is by its `instrument_key` PK (E8's third leg).
5. **Rollback.** RB-2 for the cusip twin is the ETF-relevant rollback. Its trigger (E8/E8b showing a `SCAN` or a worse plan) is the right one, and "stop and report first" is correct.

**Verdict: PASS WITH NOTES. The ETF PL has no objection to ENT-CR1 rev 1. Nothing required before approval.**

**Notes (non-blocking; may be taken up in the close-out, no new revision needed):**
- **EP-1 (E8b literal binds).** E8b's statement has four `?` placeholders (`report_period IN (?, ?)`, twice) and is a `WITH … ` CTE. `wrangler d1 execute --command` cannot bind parameters, so the Engineering Lead must substitute literals, e.g. `'2026-06-30'` and `'2026-03-31'`, and record the substituted text verbatim. E8's literals (`'X'`, `'0000000000'`) are already stated. Recording which literals were used keeps before/after comparable.
- **EP-2 (do-not-run list).** Add `seed-managerpositions.js` to §6's "do not run on 13 Oct until this CR closes" list. It is the one manual ETF-side job that reads the index being dropped. It is not scheduled, so this is belt and braces.
- **EP-3 (contract).** No ETF API contract change; nothing to tell the ETF UI (`ma-etf.js`) or 13F UI owners beyond the close-out line.
- **EP-4 (pre-existing cost, out of scope).** The 13F join reads every `instrument_master` row with the same issuer-6 prefix per holding (no full-`cusip` index). That is unchanged by this CR and is logged here only so nobody attributes it to ENT-CR1 later.

**For §9 of the CR:** "ETF Product Lead — Consulted (ETF reader, E8/E8b)": **PASS WITH NOTES, 9 Oct (this §5.2).**
