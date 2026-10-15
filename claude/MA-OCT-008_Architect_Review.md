# MA-OCT-008: Architect Review (with ETF Product Lead read)

```text
ISSUED BY:    Main Lane (REVIEW-A NEXT, Fri 9 Oct, 3rd pass; sha256 ec8d5af7d836f7db72bcf4a4048f7f812505c1fba332706ad7b4d34a902afe53)
EXECUTED BY:  Architect + ETF Product Lead (independent review session, doc-only)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Mon 12 Oct gate: spec, seed list, CR1)
PACKET:       MA-OCT-008, SEC corporate-bond ingestion (owner: Data-Identity Lead)
INPUT:        claude/MA-OCT-008_Spec.md rev 1
              f3a350c1d65eff203765154e33c76590ce33ac601ad77783725bba0399551adb (re-hashed on disk; matches the NEXT)
VERDICT:      PASS WITH NOTES. Six doc-only edits are required before Founder approval (A8-1 to A8-6).
              The domain call, the two-table design, the keyset index, the 007 join, Pack C, the local runner and CR1 are sound.
```

**Independence.** I did not write 008 or any input to it. This verdict was formed before reading the Ops review (`MA-OCT-008_Ops_Review.md` `74eb8e65…a4bf`). §6 cross-checks it afterwards and changes nothing above it.

## 0. Evidence and method

| Item | Value |
|---|---|
| Spec under review | `claude/MA-OCT-008_Spec.md` rev 1, `f3a350c1…1adb` (544 lines) |
| 007 join | `claude/MA-OCT-007_Spec.md` `8e1be2d3c5c9f1d8b581807f734de63cf958abcb59219d353363e5e921b4e703` (rev 1.2): §3.2, §3.5, §3.6 (lines 153–221), R1f (line 281), conflict rule (line 292), P10 (line 728), T9 |
| 013 | `claude/MA-OCT-013_Spec_Brief.md` rev 1.5 `8319cc092aef020f7239c0fc5643f578f028ef971ff71453395b62088d7b2085` (repoint 7; conditional precondition) |
| 011 (gate precedent) | `claude/MA-OCT-011_Spec.md` rev 1.7 `304628940eec41b2df605fc94ddeb8d5c49036752c5fd49a14ffaad4142cadf0` §4.3 (F-1..F-5) |
| Pack B evidence | `claude/ReadPacks_2026-10_Query_Ledger.md` (lines 36–62: B0 index list, B2-alt 3/30, F2) |
| Repo (read-only, `16918e0`) | `App/Corporate Atlas/migrations/corporate-atlas-v1.sql:97-113` (entity_master indexes: `idx_entity_master_lei`, `idx_entity_master_normalized` exist; no `cik` index); `App/ETF Refresh/migrations/sprint2-issuereventstream.sql:15-25` (`issuereventstream` has `entity_id INTEGER` and `cik TEXT NOT NULL`); writers of `issuereventstream`: `13F Seed/seed-issuereventstream.js` |
| Decisions Log | 9 Oct rows (L8-1..L8-6 logged; OPS-R3 F-1..F-5; ENT-CR1 enrich window 05:50–07:10, boost 10:50–10:59 / 16:50–16:59) |
| Actions | 0 D1 reads, 0 writes, 0 SEC requests, no git writes |

## 1. What I verified

| Area | Check | Result |
|---|---|---|
| Domain (D4) | Two new tables, both declared **Entities/instrument**, owner Data-Identity Lead; sole inserter the 008 runner; 009 read-only. Meets the project rule for new tables (domain stated in the creation spec). No cross-domain table. | ✔ |
| Keys and idempotency | `bond_issuer_link` PK `cik`; `bond_issuance` PK `(accession_number, tranche_seq)`; every write `INSERT OR IGNORE`, batched ≤ 100. A re-run writes 0 (AC6). | ✔ |
| Keyset index (P-B1) | `idx_bi_cik_final_key (cik, maturity_date, accession_number, tranche_seq) WHERE filing_status='final'`. The step-2 query has `cik = ?` + `filing_status = 'final'` (so the partial index qualifies) + a row-value range on the remaining three columns in index order + `ORDER BY` in index order → `SEARCH … (cik=? AND (maturity_date,accession_number,tranche_seq)>(?,?,?))`, no temp B-tree. The `CHECK (filing_status <> 'final' OR maturity_date IS NOT NULL)` correctly prevents NULLs falling out of the cursor. | ✔ (P-B1 must still be run) |
| Multi-CIK merge | One keyset statement per CIK in one `db.batch()`, merged in the Worker on the global tuple; `accession_number` is globally unique, so the tuple is a total order. Avoids the `cik IN (…)` temp B-tree. Reads ≤ 27 per page for one CIK. | ✔ |
| Bond → issuer | `idx_bi_instrument` is partial `WHERE instrument_key IS NOT NULL`; `instrument_key = ?` implies NOT NULL, so the planner may use it. 007's P10 states the same plan. | ✔ |
| Write cost (§12.1) | 4 writes per keyed final row (row, PK autoindex, both partial indexes) and 2 per audit row (neither partial index holds it) are consistent with the project counting basis (011 §4.2). Initial ≈ 3.8k, declared 6k, ceiling 8k. Steady < 500. Trivial against 100k. | ✔ |
| Reads | Largest statement is the coverage `GROUP BY` over ≤ ~2k rows; under the 9 Oct 2.5 × N rule ≤ ~5k. Nothing near 50k. | ✔ |
| Runner choice (D7, §9.1) | Workers Free CPU/subrequest limits rule out a Worker; extending `meridian-filings` would put Entities writes in an ETF Refresh Worker. Local manual runner (011 precedent), no cron (5/5), no LaunchAgent. | ✔ correct call |
| SEC fair access | ≥ 200 ms (≤ 5/s, half SEC's 10/s), declared User-Agent from env, stop on 403/429, ≤ 1,500 requests per run (initial ≈ 1,000). | ✔ |
| Linkage (§11) | CIK → LEI → reviewed name → manual → unmatched; never auto-create; **never subsidiary → parent** (L8-4). S1 survivor via `entity_merge_redirect` when present; re-verification by PK. Correct. | ✔ |
| Pack C (§11.2) | C1 `issuereventstream(cik)` index confirmed live (Pack B B0) and the table has `entity_id`; C2 `idx_entity_master_lei` and C3 `idx_entity_master_normalized` are in the migration of record; EXPLAIN-first with stop on `SCAN entity_master`; Data-Identity Lead signs every C3 hit. 0 writes. | ✔ (see A8-6 on C1's estimate) |
| CR1 (§10) | `App/Corporate Atlas/bonds/` + `migrations/008-bonds.sql`; matches the Entities domain and the CLAUDE.md rule; rollback = delete folder + one `.gitignore` line. | ✔ Recommend Founder Q3 = yes |
| Rollback (§15.4) | Data delete by `parser_version` or `cik`; full `DROP TABLE` × 2; 009 treats a missing table as "no data"; 013's repoint is conditional on table existence. | ✔ |

## 2. The 007 join (L8-2, L8-3)

| Ruling | Effect on 007 rev 1.2 | Result |
|---|---|---|
| **L8-2** `filing_status` gains `skipped_structured`, `skipped_other` | 007 reads `bond_issuance` only with `filing_status = 'final'` (R1f line 281; §3.6 line 419 via 008 §8.3). It never enumerates the other values. The CHECK widening is on a table that does not exist yet, so there is no rebuild cost. Neither new value is in either partial index (`idx_bi_cik_final_key` is `final`-only; audit rows have NULL `instrument_key`). | ✔ Additive, no 007 change |
| **L8-3** `bond_issuer_link.last_polled_at TEXT NULL` | 007 selects named columns only (`entity_id, link_method, confidence, linked_at, verified_at`; line 420); `as_of = COALESCE(verified_at, linked_at)` is unaffected. Not part of NavLink, which matches 007's extensibility rule (line 158: no new state, no new key type). | ✔ Additive, no 007 change. Optional: add the column to 007 §3.6's table list (line 199) for completeness at 007's next revision. |
| NavLink | `source: "sec_bond"`, `source_table: "bond_issuer_link"`, `asset_type: "DBT"`, bands from `link_method` (cik 95 high, lei 85 medium, manual 100 high, unmatched none). T9's `sec_bond` fixture and P10 stand. | ✔ |
| Conflict | An `instrument_key` in both `instrument_entity_map` and `bond_issuance` with differing issuers → 007's existing `ambiguous / source_conflict` (line 292). | ✔ |

**One join point needs a decision (A8-5 below):** 007 §3.6 (line 215) and 008 §8.3 step 1 filter issuer→bonds on `status = 'active'`, but bond→issuer (R1f) does not filter on `status`. A `paused` issuer's bonds therefore vanish from its issuer page while each bond still links to the issuer.

## 3. Required before Founder approval (doc-only edits by the Data-Identity Lead; a Main Lane hash check, no new review)

**A8-1. Re-cite final inputs and the wrangler pin.** The header cites 011 rev 1.6, 013 rev 1.4+ and 002 rev 1.2. Re-cite the finals: 011 rev 1.7 `30462894…cadf0`, 013 brief rev 1.5 `8319cc09…2085`, 002 rev 1.3 `9ec6773a…3893` (approved 9 Oct). In §9.2, state the wrangler path the same way ENT-CR1 rev 1 step 1 does: `/usr/local/bin/wrangler` = 4.96.0 checked by `--version` before each run, or `App/Corporate Atlas/node_modules/.bin/wrangler` once 002's CR-5 pin lands. Never `npx`.

**A8-2. Align the headroom gate and the freeze calendar with what is now binding.**
- §9.3 item 5 copies 011 rev 1.6's gate. Bring in 011 rev 1.7 / OPS-R3 **F-1 to F-5**: own rows counted over max(15 min, since last fetch); a falling `rowsWritten` within a UTC day fails closed; no batch 23:50–00:10 UTC; no live batch before the A4 lag is recorded; if the lag is > 10 min, the account ceiling drops to 60k. Plus the ≤ 120 s fetch age and today's-UTC-date check (002 rev 1.3 §8.5).
- §12.3 freezes: replace "Daily 06:00–07:05 UTC (entities-enrich crons)" with **05:50–07:10** (the enrich window used by 011 §4.4 and ENT-CR1 §6). Add the boost slots **10:45–11:15 and 16:45–17:15** (011's guard bands), the **23:50–00:10 UTC** rollover (F-3), and **Tue 13 Oct 08:05–10:30** (ENT-CR1) while that CR is open. Keep 17–23 Oct if 011 is GO.

**A8-3. Make the security-type gate's precedence explicit, and catch false skips.** §7.3 lists four outcomes, but only "non-debt before any debt match" has a stated order. Market-linked notes are titled "… Notes due 2030", so they match the debt rule too.
- State the order: **other → structured → non-debt → debt**, first match wins.
- Tighten the structured pattern so plain floating-rate notes are not skipped. "Linked to" will match "interest … linked to Compounded SOFR". Exclude benchmark-rate contexts (SOFR, EFFR, Treasury, Prime), or require an underlier word (index, basket, stock, shares, ETF, commodity) within the same sentence.
- Anchor `Units` as `\bUnits\b` in the security title only, not anywhere in 6,000 characters.
- **Add AC16** (numbered after rev 1.1's AC14/AC15): a plain Compounded-SOFR floating-rate senior note from a non-G-SIB issuer (e.g. American Express or Capital One) is `final` with `rate_type = 'floating'`, not `skipped_structured`.
- **Add AC17 (to §15.3 step 2):** the dry run lists every `skipped_*` row for the 29 issuers other than Wells Fargo, and the Data-Identity Lead signs each one before the first live batch. The §14.2 sample draws only `final` rows, so a false skip is invisible to it; coverage counts it as "accounted for".

**A8-4. Say exactly what a `parse_failed` row is, and how a parser fix is re-applied.** §8.2 says skipped and parse-failed filings get **one `tranche_seq = 0` audit row with every numeric field NULL**. §7.4 ("`parse_failed` for that tranche") and §14.1 ("< 60: stored as `parse_failed`") describe **per-tranche** failures inside an otherwise good filing. Pick one and write it into §8.2. Recommended: a tranche below 60 keeps its `tranche_seq` (1..n) with `filing_status = 'parse_failed'`, its parsed fields kept for adjudication, and is outside both partial indexes (2 writes); `tranche_seq = 0` stays reserved for whole-filing outcomes. Also state in §7.1 that discovery skips any accession already present, so **a parser fix is re-applied only by `DELETE … WHERE parser_version = ?` (§15.4) followed by an incremental run**.

**A8-5. Define `status` and the writer set precisely.**
- `status` has `active`, `paused`, `unmatched`. `unmatched` duplicates `link_method = 'unmatched'` / `entity_id IS NULL`. Define `paused` as **"stop polling SEC for this CIK"** only, and decide whether its existing bonds stay visible. Recommended: they stay visible. Then issuer→bonds step 1 should filter `entity_id = ?` only (drop `AND status = 'active'`), matching R1f, which does not filter. If the Data-Identity Lead prefers "paused = hidden", R1f must filter too. Either way, tell 007 (§3.6 line 215) so both specs say the same thing.
- §8 "Sole writer: the 008 ingestion runner": change to "sole **inserter**; 013 repoints `bond_issuer_link.entity_id` under S1 (013 rev 1.5 repoint 7)". That is already agreed; the sentence just needs to say it.

**A8-6 (ETF PL). Correct the cross-domain read statement and C1's estimate.**
- §8 says "No ETF-domain table is read or written." Pack C C1 reads `issuereventstream`, whose migration lives in `App/ETF Refresh/migrations/` and whose seed is `13F Seed/seed-issuereventstream.js`, and Pack B read `issuerperiodsummary` (seeded from `App/ETF Refresh/`). Reading them is allowed (read-only, indexed, build-time only, ≤ 30 lookups), but the statement must say so: "No ETF-domain table is **written**. Pack B/C read `issuerperiodsummary` and `issuereventstream` by their `cik` indexes, once, at build."
- C1 (`WHERE cik = ? AND entity_id IS NOT NULL LIMIT 1`) uses the `cik` index only; `entity_id` is filtered after each row lookup. For a CIK with many 8-K item rows and NULL `entity_id`, one execution reads every event row for that CIK, not 1. Restate C1 as "≤ 27 executions, each ≤ that CIK's event rows (expected hundreds; ≪ 50k)", and record `rows_read` per execution.

## 4. Notes (non-blocking)

- **N8-1.** §12.2 (ii) says "measured on the dry run's first live batch". A dry run has no live batch. Say "the pilot's first live batch" (§15.3 step 5).
- **N8-2.** `wrangler d1 execute --remote --file` in wrangler 4.x may take a different server path from `--command` (an import-style upload), and may report `meta` differently. Correctness does not depend on it, because every statement is `INSERT OR IGNORE`. But the 8k/day counter does. At the pilot, confirm that `rows_written` is reported per batch; if not, count writes from the batch file's declared statements and reconcile against `d1-today`.
- **N8-3.** Bond → issuer uses `LIMIT 1` on `instrument_key`. If one `instrument_key` were ever filed by two CIKs (a co-issuer or guarantor structure), the pick is arbitrary. Acceptable for v1; a 009 check can count distinct `cik` per `instrument_key` in the coverage query.
- **N8-4.** Wrangler error-retry policy differs across the October runners (008: once after 5 s; ENT-CR1: once after 30 s; 011: 3 times at 30/120/300 s). Each is safe because every statement is idempotent. Harmonise at the next runner packet; not here.
- **N8-5.** The `local.bonds-ingest` registry row and the `local-bonds` emitter key are Operations Lead actions (as OPS-R6 T-1 for 011). The secret change carries the same conditions as ruling RA-13 (K-1..K-5) in `MA-OCT-011_Architect_Review.md` §3a (hash-only entry, constant-time compare already in `ops-api.js:637-653`, key file outside the repo, disabled when unused).

## 5. ETF Product Lead read

- **No ETF-domain table is written.** Reads of ETF-tree tables are build-time and indexed (A8-6).
- **ETF-held bonds:** an ETF-held bond with an ISIN or CUSIP reaches its issuer either through `instrument_entity_map` (today) or through 008 (`sec_bond`). Differing issuers surface as `ambiguous / source_conflict` in 007. N-PORT `asset_cat = 'DBT'` alignment is correct.
- **No change** to ETF exposure, ETF routes or `ma-etf.js`. ETF budgets are unaffected (≤ 8k writes on one non-Sunday day; never in the Sunday holdings window).
- **ETF PL: no objection.**

## 6. Cross-check with the Ops review (read after the verdict above)

Read after §0–§5 were written: `claude/MA-OCT-008_Ops_Review.md` `74eb8e653b894ea06b143ed04aa3288d70e86d4d9f8d676a772b66f238f0a4bf` (Ops PASS WITH NOTES: R-1..R-5, A-1, A-2, N-1..N-6). **My verdict is unchanged.**

| Mine | Ops | Concordance |
|---|---|---|
| A8-2 (F-1..F-5, 120 s, UTC date) | R-4 + A-1 | **Same requirement.** Either text satisfies both reviews. |
| A8-2 (freezes: ENT-CR1, boost, 23:50–00:10) | R-5 | **Same**, except the boost band: Ops asks for 10:50–10:59 / 16:50–16:59; I asked for 011's guard bands 10:45–11:15 / 16:45–17:15. **Either is acceptable; I defer to the Operations Lead** on the band, since the risk is a shared headroom read, which is Ops scope. |
| A8-2 (enrich 05:50–07:10, not 06:00–07:05) | — | **Ops did not raise it. Still required.** |
| A8-1, A8-3, A8-4, A8-5, A8-6 | — | Not in the Ops review (they are design, correctness and domain points). **Still required.** |
| — | R-1, R-2, R-3 (A1 contract fields, `skipped` reason codes, `hold_all_jobs` source + fail closed) | **I concur.** R-3's cross-domain PK read of `holdings_pipeline_state` (ETF domain) is allowed as read-only. As ETF PL I have no objection: one PK read per run. |
| N8-5 (registry + key) | N-3 | Same. |
| — | A-2 (weekday initial load) | Concur. |

## 7. Status after rev 1.1 (for the Main Lane)

- `claude/MA-OCT-008_Spec.md` changed on disk at **16:21:09 UTC** to **rev 1.1** `bfa13b616112cb69ff2425b176dd35d31e5b6480d701b1af7c65a3ed51e9cee2` (LANE-8, applying the Ops edits), **after** this review read rev 1 `f3a350c1…1adb` and before this file was finished.
- Under the stop-on-mismatch rule, **this review is of rev 1 only. I have not read rev 1.1.**
- By LANE-8's report, rev 1.1 changes only §9.3, §9.4, §12.3, §12.4 (new), §15.2 (AC8, AC13 widened; AC14, AC15 added), §15.3 steps 5–6, §18.1 and Appendix B. **None of those sections touch A8-1, A8-3, A8-4, A8-5 or A8-6.** A8-2 may be partly met by rev 1.1's R-4/R-5/A-1 text, but the enrich-window correction (05:50–07:10) is not in LANE-8's list.
- **Ask:** the Main Lane either (a) has LANE-8 apply A8-1..A8-6 as rev 1.2, and I hash-check rev 1.2 against this list (a delta check, not a new review), or (b) issues me rev 1.1's hash for a delta check of the changed sections first.

---

## 8. Rev check: 008 rev 1.2 against A8-1 to A8-6 (Fri 9 Oct, delta check only, no new scope)

| Item | Value |
|---|---|
| Spec checked | `claude/MA-OCT-008_Spec.md` **rev 1.2** `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` (652 lines), re-hashed on disk. It matches the NEXT file and `relays/LANE-8_REPORT.md` (`8ef16b4a…d2f`). |
| Other inputs | `relays/FREEZES.json` `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346` (matches the spec's citation). This review before the append: `1e91b3d3…222d`. HEAD `16918e0`, no `.git/*.lock`. 0 D1 reads, 0 writes. |
| Method | Read every §18.2 section in full: status/inputs, §7.1, §7.3, §7.4, §8, §8.1–§8.3, §9.2, §9.3, §11.2, §12.2–§12.4, §14.1, §15.2, §15.3, §18.2. Glanced at rev 1.1's Ops sections (§9.3, §9.4, §12.3, §12.4, §15.2, §15.3, §18.1) for conflicts with this review and found none. |

| # | Verdict | Where met |
|---|---|---|
| **A8-1** | **MET** | The inputs are re-cited with full hashes: 011 rev 1.8 `096f857d…b270` and 013 rev 1.6 `00ec6303…3485` (both newer than this review cited, with the supersession stated); 002 rev 1.3 `9ec6773a…3893`; and `FREEZES.json`. §9.2 sets the wrangler pin exactly as ENT-CR1 step 1 does: `--version` = 4.96.0 or the node_modules pin after CR-5, a mismatch refuses the run, and `npx` is never used. |
| **A8-2** | **MET** | §9.3 gate 5 has the ≤ 120 s fetch age, the today's-UTC-date check and F-1 to F-3. A-1/F-5 covers the lag gate, with ceiling 60k and window = lag + 5 min, read from config and never defaulted, and AC15. §12.3 is now the `FREEZES.json` table: enrich **05:50–07:10**, boost **10:45–11:15 / 16:45–17:15**, 23:50–00:10, ENT-CR1 Tue 13 08:05–10:30 (fallback Wed 14), and 011 17→24 Oct. Gate 1 reads the file at start and before every batch, and fails closed if it is missing. I checked every window against the file and they agree. |
| **A8-3** | **MET** | §7.3 limits the check to the title and states the precedence other → structured → non-debt → debt, first match wins. The structured rule needs a product word, or "linked to" with an underlier word in the same sentence, and excludes benchmark-rate objects (SOFR, EFFR, Treasury, Prime, Fed Funds, CMT). `\bUnits\b` counts only in the title. AC16 (plain SOFR FRN stays `final`, plus a Wells index note stays `skipped_structured`) and AC17 (sign-off of every non-Wells `skipped_*` row before the first live batch) are in §15.2. Both are wired into §15.3 step 2. |
| **A8-4** | **MET** | §8.2 separates whole-filing outcomes (`tranche_seq = 0`) from a per-tranche `parse_failed`. The per-tranche row keeps its `tranche_seq` and its fields, with `instrument_key` NULL, so it is outside both partial indexes at 2 writes. §7.4 (year-only maturity) and §14.1 (< 60) now say the same thing. §7.1 step 3 states the re-parse path: `DELETE … WHERE parser_version = ?` plus an incremental run, with no in-place updates. AC18 covers it. |
| **A8-5** | **MET** | §8 says "sole **inserter**" and that 013 repoints `entity_id` (rev 1.6, repoint 7). `status` ∈ (`active`, `paused`), and `paused` means stop polling only, with bonds still visible. "Unmatched" is expressed only by `link_method`/`entity_id`. §8.3 step 1 drops the status filter, matching R1f. The matching 007 §3.6 edit has been routed to LANE-7. |
| **A8-6** | **MET** | §8 now says no ETF-domain table is *written*, and names the three read-only, indexed reads: `issuerperiodsummary` and `issuereventstream` at build, and `holdings_pipeline_state` by PK per run. §11.2 C1 states the real estimate (≤ 27 executions, each ≤ that CIK's event rows, ≈ ≤ 5k in total), records `rows_read` per execution, and stops above 10k for any one execution. **ETF PL:** no objection. |

**Result: A8-1 to A8-6 are all met. Rev 1.2 is fit for the Founder on Mon 12 Oct. No further Architect review is needed.**

**Non-blocking tidy-ups (stale summary lines; the detailed sections govern):**
1. §0 **D4** still says the 008 runner is "the sole writer". §8 now says "sole inserter; 013 repoints".
2. §0 **D11** still gives the freezes as "Sun 04:00–07:05 UTC, Mon before 07:05 UTC". §12.3 and `FREEZES.json` (Mon 03:30–08:00, plus the daily windows) govern.
3. The 011 and 013 citations will be one revision behind once LANE-11 reports 011 rev 1.9 and 013 brief rev 1.7, which are wording-only per the 011 status line. Re-cite them at the build brief; no spec revision is needed.
4. EP-1: the batch files carry literal SQL built from SEC-parsed text. Quote-doubling covers SQLite string literals. The build should also cover security titles that contain a `'` in a parser unit test (AC1–AC5 fixtures).
