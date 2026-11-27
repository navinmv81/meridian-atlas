# MA-NOV-SA1 — November scope assessment — Report

```text
PACKET:   MA-NOV-SA1 · Control v1 977766a5…5139 · Task v1 2c22766b…0668 (both verified)
RUN:      r-20261110T193150Z-2119 (interactive, LANE_OPENER_v2 67913343…71d6 verified)
ROLE:     Architect + Product Lead (assessment only)
SCOPE OF RECORD: meridian_atlas_november_content_scope_and_requirements.md c16c8e19…5a03 (verified)
OUTCOME:  ASSESSMENT COMPLETE WITH GAPS. D1 was unreachable: wrangler returned 7403 "account not
          authorized" on the first query (Control stop gate → continued from code + October records).
          Every number below that would have come from D1 is taken from the last October
          record and marked [Oct]. Stops here for Founder scope approval.
```

## 1 Summary

- Baseline: Ops has 7 tabs, not 6 (`Drift & Budget` also exists). ETFs have pair overlap, compare and "who holds this stock", but there is **no multi-input, allocation-weighted exposure** anywhere. Corporate Atlas already has the entity→ETF exposure, 13F and bond layers that EXP needs to link into. The homepage is a market dashboard with no research entry.
- Bonds [Oct, 30 Oct]: 30 configured issuers. Rows: **632 final**, 184 preliminary, 52 skipped_other, 45 skipped_non_debt, 21 skipped_structured, 9 parse_failed (~943 rows). The tranche-level failure reason is **not stored in D1**; it is only in the local run log. "Partial" is not a status. Both are BOND-01/03 gaps.
- EXP data gap: `entity_exposure_monthly` (the ETF→company table) is written only by the manual local script `gate3-exposure.js`, not by any Worker. Holdings refresh weekly at ~20 ETFs/run (cycle at 133/237). Freshness therefore needs both a faster holdings cycle and a re-run of gate3.
- Capacity: MUST ≈ 21 packet-days against ~16–18 usable days to 30 Nov. MUST+SHOULD ≈ 30. **Bond enrichment (BOND-06–12) does not fit with everything else.**

**Decisions for the Founder**
1. Approve the minimum complete scope in §8: OPS all, EXP all (EXP-08 period differences limited to the two stored months), HOME all, BOND-01–05. **BOND-06–12 moves to December**, with BOND-06/11 (underwriters, roles) as a SHOULD stretch only if the reliability work closes by 23 Nov.
2. Holdings option C: approve **C1** (retire `meridian-bootstrap`'s cron and give the slot to a second weekly holdings run on Wednesday). Each step needs its own CR and three-point check. Nothing has been changed.
3. `Drift & Budget` tab: keep it (recommended; it is ops-useful and not in the removal list) or remove it with the other three.
4. Bond narrative (BOND-12): November summaries are **extracted facts only**, with no generated narrative (recommended).
5. Restore D1 access (`npx wrangler whoami` / `wrangler login` from Terminal) before the specification packets. The bond failure-reason counts and the EXP coverage numbers need it (see §4 and §10).

## 2 Requirement table

Class: REUSE / EXTEND / NEW / BLOCKED. Priority: MUST / SHOULD / DEFER. Size: S ≤1, M 2–3, L >3 packet-days. Schema and Prod show whether a schema change or production processing is needed (each needs its own approval).

| ID | Baseline (today) | Class | Pri | Size | Schema | Prod | Evidence |
|---|---|---|---|---|---|---|---|
| OPS-01 | Events/Sprint/Release are entries in `OPS_TABS` | EXTEND | MUST | S | no | deploy (Pages) | `App/ma-ops.js:464-472`, loaders `:548-550` |
| OPS-02 | Health, Cases, DQ work (005 console) | REUSE | MUST | — | no | no | `ma-ops.js:462`, `ops_loadCases/ops_loadDq` |
| OPS-03 | Ops uses its own `OPS_COLORS` and 215 inline `style=` attributes, not main CSS variables | EXTEND | MUST | M | no | deploy | `ma-ops.js:29`, `grep -c style=` = 215 |
| OPS-04 | Loading/empty/error are ad hoc strings per tab; focus/mobile not aligned | EXTEND | MUST | S (with 03) | no | deploy | `ma-ops.js:567-571` |
| OPS-05 | Routes are served by `control-api.js` and stay; front-end removal only | REUSE | MUST | — | no | no | `App/Ops/src/control-api.js:8-9,88` |
| OPS-06 | Tower (`claude/factory/control-tower.html`) is the delivery view; the D1 tables are frozen legacy | REUSE | MUST | S (sync check, carry 13) | no | read-only | CLAUDE.md "Packet state…" |
| EXP-01 | No portfolio input. Building blocks: `/api/etf-list`, `/api/entities/search` | NEW | MUST | M | no | deploy | `ma-etf.js:838`; `entities-api.js:1305` |
| EXP-02 | none | NEW | MUST | S | no | — | — |
| EXP-03 | Pair overlap joins by CUSIP/security_name only (instrument level); entity→ETF route exists; **no ETF→company route** | NEW (read route + client calc) | MUST | M | no | Worker deploy | `ETF Refresh/src/index.js:470-520`; `entities-api.js:280` |
| EXP-04 | none | NEW | MUST | S | no | — | — |
| EXP-05 | none (overlap is 2 ETFs only) | NEW | MUST | S | no | — | `ma-etf.js:2018` |
| EXP-06 | Identity via `instrument_entity_map` tiers (isin 18,563 · figi 8,806 · cusip 3,751 · **heuristic 1,649** [Oct]); 013 merges open | EXTEND / partly BLOCKED | MUST | M | no | maybe (013 subset) | `October_Decisions_Log.md:120`; carry 11 |
| EXP-07 | `fund_exposure_coverage` exists (gate3) | EXTEND | MUST | S | no | — | `Corporate Atlas/gate3-exposure.js:2` |
| EXP-08 | report_month is on every row; 2 months kept; holdings 133/237 per cycle; exposure table refreshed by hand | EXTEND / BLOCKED (freshness) | MUST (dates) · SHOULD (period diff) | S + option C | no | **yes** (gate3 re-run, holdings) | `holdings-pipeline.js:3-4,117`; §5 |
| EXP-09 | Hash routes for entity/instrument/bond; 13F and ETF panels on issuer | REUSE/EXTEND | MUST | S | no | — | `ma-entities.js:1684-1732, 1582, 1394` |
| EXP-10 | 13F/ETF panels show the month/period label | EXTEND | MUST | S | no | — | `ma-entities.js:1592-1593` |
| EXP-11 | none for the new flow | NEW | MUST | S | no | — | — |
| EXP-12 | none; needs hand-checked fixtures incl. incomplete cases | NEW | MUST | M | no | — | — |
| BOND-01 | Status taxonomy exists (6 values); counts [Oct]; no "partial"; definitions spread across spec 008 | EXTEND | MUST | S | no | read-only | `migrations/008-bonds.sql:32`; `bonds-parse.mjs:122-138` |
| BOND-02 | parser bonds-1.2.0; remarketing → skipped_other (rule B-2); 184 preliminary not superseded | EXTEND | MUST | M | no | — | `bonds-parse.mjs:91`; carry 6 |
| BOND-03 | Tranche `fail_reason` is in the run log only, not a D1 column; UI hides failed/prelim rows | EXTEND | MUST | M | **yes** (reason column) or no (UI-only) | deploy | `bonds-parse.mjs:650`; carry 8 |
| BOND-04 | Guarded re-parse with rollback SQL is proven (R-2: 191 stmts; R-4) | REUSE | MUST | S | no | **yes** (writes ≤ run cap 8,000) | `bonds/state/r2-reparse-2026-10-29.sql`, `bonds-config.json run_cap_writes` |
| BOND-05 | 24 gzipped fixtures + tests incl. multi-tranche (Oracle) | EXTEND | MUST | S | no | — | `bonds/fixtures/manifest.json` |
| BOND-06 | no underwriter extraction | NEW | SHOULD (stretch) | M | **yes** | **yes** | `008-bonds.sql` (no column) |
| BOND-07 | none | NEW | DEFER | M | yes | yes | — |
| BOND-08 | tranche_seq per accession exists | EXTEND | DEFER (with 06/07) | S | yes | — | `008-bonds.sql:24-27` |
| BOND-09 | NULL only; no disclosed/n.a./not-extracted distinction | NEW | DEFER | S | yes | — | — |
| BOND-10 | `source_url` per row; no section/page | EXTEND | DEFER | S | yes | — | `008-bonds.sql` source_url |
| BOND-11 | issuer vs guarantor fixed by hand (R-1 PepsiCo SG) | NEW | SHOULD (stretch, with 06) | S | yes | — | `r1-pepsico-sg-2026-10-28.sql` |
| BOND-12 | none | NEW | DEFER (facts only, decision 4) | S | no | — | — |
| HOME-01 | Homepage = intel banner + market cards; no proposition | NEW | MUST | S | no | deploy | `App/index.html:1205,1263` |
| HOME-02 | none (depends on EXP-01) | NEW | MUST | S | no | — | — |
| HOME-03 | search exists | EXTEND | MUST | S | no | — | `App/ma-search.js` |
| HOME-04 | hash routing exists | EXTEND | MUST | S (in 02/03) | no | — | `ma-entities.js:1684` |
| HOME-05 | market/news cards | REUSE | MUST | — | no | — | `index.html:1265-1393` |
| HOME-06 | no date/coverage labels on home | EXTEND | MUST | S (in 01) | no | — | — |
| HOME-07 | phone-width button row known issue | EXTEND | MUST | S | no | — | carry 12 |

`docs/index.html` is identical to `App/index.html`; the live site matches the source baseline.

## 3 Bond inventory (BOND-01–04)

- **Source:** October records. D1 was unavailable (§10). Coverage snapshot 16 Oct (`bonds/state/coverage-2026-10-16.json`, 33 CIKs incl. co-registrants), then R-1 to R-4 (`October_Decisions_Log.md:206,215`; Release Ledger row 23).
- **Baseline as of 30 Oct 21:20Z [Oct]:** final **632** · preliminary 184 · skipped_other 52 · skipped_non_debt 45 · skipped_structured 21 · parse_failed **9** ≈ 943 rows, parser `bonds-1.2.0`, 30 configured issuers.
- **By reason (run log, all runs):**
  - skipped_other: demand_note 156 · merger_document 20 · remarketing (B-2) · exchange offers.
  - skipped_non_debt: stock_plan 4 + title rules.
  - parse_failed "no tranche found": 4–5 filing-level events.
  - Tranche-level `fail_reason` (e.g. principal missing, rule L8-14) is written to the local run log only, so it **cannot be counted from D1**.
- **Measurement baseline proposed:** for the 30 configured issuers and `lookback 2024-01-01`, "supported debt documents" = final + preliminary + parse_failed tranches.
  - Today: 632 / (632+184+9) = **76.6% final**.
  - Proposed November target, for approval at spec: ≥ 85% final, or every non-final row carrying a visible stated reason; 0 silent parse_failed.
  - Re-baseline from D1 in the first BOND packet.
- **Biggest lever:** the 184 preliminary rows (Wells Fargo alone 34 [16 Oct]). Many are preliminaries with no matching final in the FWP window. Classify them as "superseded by final", "final not filed" or "matching gap" before any parser change.

## 4 Data and identity gaps blocking EXP

1. **ETF→company table freshness.** `entity_exposure_monthly` and `fund_exposure_coverage` are written only by `Corporate Atlas/gate3-exposure.js`, a local script with a REST token and one report_month per run. No Worker refreshes them. Its latest report_month against `fund_holdings_monthly` is **unknown** because D1 was unavailable. First query of the EXP spec.
2. **Instrument→entity mapping quality** [Oct 9 Oct]: M = 32,769 links. 1,649 are heuristic (EXP-06 must show these as ambiguous). The worst issuer, entity 28088, has 871 instruments. The 013 held-identity subset (carry 11) decides which duplicate entities still split exposure.
3. **New duplicate candidates:** FIRDS run 8 Nov added +145 `entity_master` rows (CARRY obs). They are not merged, so they can split one company's exposure. Run a 013 follow-up check before the EXP-12 examples.
4. **Pair overlap is not issuer-level.** It joins on CUSIP, or on security_name when CUSIP is missing (`index.js:513-515`). The new route must aggregate through `instrument_entity_map`, not reuse this join.
5. **13F joins** are already entity-based (issuer 13F panel). Universe is 13F filers and the reporting quarter only, so EXP-10 must label it that way.
6. **Entities-seed write volume:** ~37.5k writes on Mon 9 Nov against KI 22.40's ~2.4k estimate. Not an EXP blocker. It does reduce Monday headroom, which matters if any EXP prod processing (gate3) is scheduled on a Monday.

## 5 Holdings option C (faster refresh for EXP-08)

**Constraints.** 5/5 cron slots (last verified 23 Sep). 100k writes/day soft cap. 80k guard in `holdings-pipeline.js:19`. 20 ETFs per invocation, Sunday 04:00 only. Free plan is permanent.

| Option | Change | Write budget | Effect |
|---|---|---|---|
| A (current) | none | ≤80k Sun | ~6–15 weeks per cycle |
| **C1 (recommended)** | Retire `meridian-bootstrap`'s `0 */4 * * *` (bootstrap `complete` since 2026-06-11, still firing). Add `0 4 * * wed` to `meridian-holdings`. Slots stay 5/5. | +≤80k on Wed (guarded). Wed has no seed/FIRDS run; enrich + boost run daily, so check Wed totals for 2 weeks | ≈2× throughput; remaining cycle ~3–7 weeks |
| C2 | Smaller, more frequent batches | needs extra slots, so same slot problem; more subrequest overhead | no gain without C1 |
| C3 | Local LaunchAgent calling `/run` | same writes | not allowed while an in-Cloudflare path (C1) exists (CLAUDE.md rule) |

**Sequence for C1:**
1. CR + three-point check to retire the bootstrap cron (deploy `crons = []`). Rollback: redeploy `0 */4 * * *`.
2. Re-verify slot count via the API.
3. CR + three-point check to add the `wed` holdings cron. Rollback: remove it.
4. After each completed holdings cycle, run gate3 (prod processing, separate approval) so EXP sees fresh data.

No change was made.

## 6 Carry-overs

The full 18-item numbered register is **not on disk**. Only the grouped summary in `MA-NOV-CARRY_Status.json` and items 6–13 (named in the outcome records) can be cited. Triage:

- **Enter November scope (dependency for an outcome):**
  - 6 parser remarketing rule → BOND-02
  - 8 010 display notes → BOND-03
  - 9 007 Phase 2 ETF wiring → EXP-01/03
  - 10 ETF overlap/exposure read cost + holdings icon → EXP-03
  - 11 013 held identity subset → EXP-06
  - 12 phone-width button row → OPS-04/HOME-07
  - 13 D1 sprintboard/releaseledger sync check → OPS-05/06
  - "public Ops GET routes (Access)" → OPS-05: removed tabs must not leave unguarded public reads.
- **Small operational packets, not product scope:** boost job_missed false positives (3 cases); enrich phase-1 stall; entities-seed 37.5k write check.
- **Stay in the register:**
  - 7 M4 issuer DQ tickets: SHOULD; only if BOND-02 touches those issuers.
  - FIRDS CR-11: Founder "leave", NML-1107-1.
  - A2; CR-10 steps 3–5; holdings start events; runner/registry hygiene.
  - Access session length; cosmetic markers; low-priority KIs.

## 7 Capacity

- **Days available:** Wed 11 → Mon 30 Nov is 20 calendar days. The Founder can service ~1 checkpoint/day (2–3 h), there is one worker, and weekly usage resets on Wednesdays. That gives **~16–18 usable packet-days**.

| Block | MUST (packet-days) | +SHOULD |
|---|---|---|
| Specs (checkpoint 2: OPS+HOME, EXP, BOND) | 3 | 3 |
| OPS | 3 | 3 |
| EXP (incl. EXP-12 verification) | 8 | 9 (period diff) |
| HOME | 2 | 2 |
| BOND-01–05 | 4 | 5 (M4 DQ) |
| BOND-06/11 | — | 3 |
| BOND-07–10, 12 | — | 4 (DEFER) |
| Option C1 (2 CRs) + gate3 run | 1 | 1 |
| Final demo | 1 | 1 |
| **Total** | **≈ 22** | **≈ 31** |

- **Fit:** MUST is ~4–6 days over at one checkpoint per day. It fits only by batching: the worker builds on days the Founder only reviews, with OPS+HOME specs combined and BOND-01 inventory running in parallel with the EXP spec. MUST+SHOULD does not fit.

## 8 Recommended minimum complete scope and sequence

**Scope:**
- **OPS:** all of OPS-01–06 in. Drift tab per decision 3.
- **EXP:** all of EXP-01–12 in. EXP-08 period differences use the two stored months only. No persistence.
- **HOME:** all of HOME-01–07 in. Continuation, recents and the what-changed feed stay out.
- **BOND:** BOND-01–05 in. BOND-06/11 are a stretch. BOND-07–10 and 12 are deferred to December. Schema for enrichment needs its own approval.

**Sequence** (each unit is one packet with its gates):
1. **D1 access restored** (Founder) → **EXP+BOND baseline queries** (read-only, ≤15). Gate: none beyond the Start Approval.
2. **EXP spec**: calculation, route contract, coverage labels, EXP-12 fixtures. Gate: spec approval.
3. **OPS+HOME spec** (one combined UI spec). Gate: spec approval.
4. **C1 step 1** (retire the bootstrap cron) → **C1 step 2** (Wed holdings cron). Gates: CR + three-point check + deploy approval each.
5. **OPS build**: tabs, styling, states. Gates: review, Pages release approval.
6. **EXP route**: entities-api, read-only, ETF→company by entity. Gates: review, Worker deploy approval.
7. **EXP UI** (input, results, gaps, links) → **EXP-12 verification**. Gates: UAT.
8. **gate3 refresh** after holdings. Gate: prod processing approval with a write budget.
9. **HOME build**. Gates: review, release approval.
10. **BOND spec** (taxonomy, target %, reason visibility) → **BOND fix + guarded re-parse**. Gates: spec approval, write approval, rollback SQL.
11. **(Stretch) BOND-06/11 spec.**
12. **Final demo**: Ops tabs → exposure journey → bond before/after → homepage.

**Trade-offs for the Founder:**
- (a) Bond enrichment against an on-time EXP+HOME. Recommendation: EXP+HOME.
- (b) Persist the bond fail reason (schema change) or show it only in the UI from re-parse output. Recommendation: one nullable column, which needs its own CR.
- (c) Option C1 (2 deploys) or stay on A with stale EXP dates clearly labelled.

## 9 Risks

- **D1 auth failure (7403).** If the wrangler OAuth session has lapsed, the local LaunchAgents that use wrangler (FIRDS, d1 execute) may also fail. Confirm before Sunday 15 Nov.
- `entity_exposure_monthly` may already be months stale. If so, EXP results are old until gate3 runs, and a gate3 write volume is not yet known.
- Duplicate entities (+145 FIRDS, the 013 subset) split exposure, so EXP-12 examples must include a split case.
- **Write budget:** C1 Wednesday plus daily enrich/boost could approach 100k. Monitor for 2 weeks after activation.
- Usage cap (~86% weekly) and one worker make slippage likely. Bond work is the first thing to cut.
- The Ops tab removal must not expose or orphan routes (Access carry-over).

## 10 Queries run

| # | Query | Result | rows_read |
|---|---|---|---|
| 1 | `SELECT filing_status, parser_version, COUNT(*), COUNT(DISTINCT accession_number), COUNT(DISTINCT cik) FROM bond_issuance GROUP BY 1,2` (via `-c wrangler-entities-enrich.toml`) | **failed** — APIError 7403 "account is not valid or is not authorized" | 0 |

**Total: 1 attempted, 0 rows read.** Further queries were stopped per the Control's stop gate.

Planned queries (for the first post-access packet):
- bond_issuance by status;
- preliminary rows with/without a final in the window;
- MAX(report_month) in `entity_exposure_monthly` vs `fund_holdings_monthly` (indexed MAX);
- `fund_exposure_coverage` summary;
- `instrument_entity_map` by tier;
- `holdings_pipeline_state` offset.

## 11 Boundaries kept

- **Wrote:** only this report.
- **Not done:** no other file edited; no git writes (read-only `git --no-optional-locks log` once); no `.env*` read; no secrets printed.
- **Not touched:** no deploy, no Cloudflare dashboard/API beyond the one failed SELECT, no subagents, no npm installs. `13F Seed/gleif-seed.js` was not opened.
- **Not edited:** Status, board, Tower, factory and Main Lane files.
- **Pins verified:** LANE_OPENER, Control, Task, scope document.
