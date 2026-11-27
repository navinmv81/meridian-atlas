# MA-NOV-BOND.SPEC — Bond reliability + offering information: specification — Report

```text
PACKET:   MA-NOV-BOND.SPEC · Control v1 (912bb492…7930) · Task v1 (0e1c261e…d48d) — both verified
RUN:      r-20261121T194350Z-f724 · interactive · 2026-11-21 · LANE_OPENER_v2 (67913343…71d6 verified)
ROLE:     Data-Identity Lead + Architect (specification only)
OUTCOME:  DONE — spec written; 7 D1 SELECTs + 7 plan checks, 17,294 rows read (caps 10 / 120,000)
SPEC:     claude/specs/MA-NOV-BOND_Spec.md  sha256 b30a75ceb4f551ab873abbec50e6f55ce8b3b266bae4bd3e0bb821a5642d2e53
PINS:     content scope c16c8e19…5a03 · SA1 419e4337…ab3aea · BQ2 9b133cde…15102 — all match
AUTH:     wrangler OAuth login; CLOUDFLARE_API_TOKEN unset; repo root, --remote, no -c
```

## 1 Summary and decisions

- **The baseline holds** [D1, 21 Nov]: 943 rows. final 632 (325 filings, 130 of them multi-tranche, up to 11 tranches), preliminary 184, skipped_other 52, skipped_non_debt 45, skipped_structured 21, parse_failed 9. Latest filing 16 Oct; last write 30 Oct (R-4); gate open.
- **Three things are new compared with SA1/BQ2:**
  1. **356 of the 632 bonds shown (56%) have no CUSIP/ISIN**, so they cannot link to holdings. In the 15 Oct snapshot, 309 of these had a same-deal term sheet (FWP) attached that the parser could not read. This is the largest defect.
  2. **21 of the 23 drafts with "no final" are subsidiary-issuer cases** (NextEra parent → NextEra Capital; Welltower → Welltower OP). The 2 Boeing drafts, plus at least 4 more, are **drafts for shares or equity units**: the draft check runs before the "is this debt?" check.
  3. Tranche-level failure reasons are in `state/dryrun-2026-10-15.json`, not in the run log. They explain all 9 failures: 2 MTN programme documents, 3 unresolved maturities, 3 term-sheet disagreements and 1 with no tranche found.
- **Reprocessing needs no SEC traffic:** 845 documents are cached locally, and the runner has `--offline`.
- **Proposed target:**
  - T1: 100% of rows complete or with a visible reason.
  - T2: ≥ 95% final share of in-scope debt tranches. Today 94.0% on the new basis, 76.6% on SA1's.
  - T3: ≥ 60% of bonds with a CUSIP/ISIN (today 43.7%).
  - T4: ≤ 3 failures.
  - T5: 0 regressions.
  - T2 and T3 are re-confirmed at U3 with real offline numbers.
- **Cut line:** MUST = U0–U7 (BOND-01–05, ≈ 5.3 packet-days, Sun 22 + Tue 24 – Sat 28). STRETCH = offering parties (BOND-06/08/09/11, ≈ 2.5 days, Sat 28–Sun 29), only if the apply lands on Thu 26 and the UI by Fri 27. DECEMBER = BOND-07, BOND-10 (page references), BOND-12.

**Decisions for the Founder** (spec §11, each with a recommendation):
1. Approve the classes and scope.
2. Approve targets T1–T5.
3. Drafts are never shown as bonds; they are linked to their final at deal level.
4. BOND-CR1: two nullable columns.
5. Remarketings stay "not covered".
6. One incremental SEC run on Sat 28 (recommended yes).
7. Offering parties as stretch.
8. Thu 26 write window.
9. Accept either Wells Fargo draft outcome, restated at U3.

## 2 Measurements

| # | SQL (meridian-etf, --remote) | Result | rows_read |
|---|---|---|---|
| Q1 | `SELECT cik, form_type, filing_status, parser_version, COUNT(*), COUNT(DISTINCT accession_number), MIN/MAX(filing_date), MAX(ingested_at) FROM bond_issuance GROUP BY 1,2,3,4` | 103 groups; totals = BQ2; max filing_date 2026-10-16, max ingested 2026-10-30T21:18:10Z | 1,886 |
| Q2 | `SELECT accession_number, tranche_seq, cik, form_type, filing_date, filing_status, tranche_label, parse_confidence, parser_version, principal_amount, maturity_date FROM bond_issuance WHERE filing_status <> 'final'` | 311 rows (joined locally to the 15 Oct snapshot: 295 match; 16 are WF rows from 15–16 Oct) | 943 |
| Q3 | final-row quality `GROUP BY rate_type, currency, no_id, no_cpn, no_spread, no_bm, no_sen, no_key, conf band` | no CUSIP/ISIN 356; fixed with no coupon 5; floating all have spread + benchmark; all conf ≥ 70 | 1,264 |
| Q4 | per preliminary: next final / previous final / final count for the same CIK (correlated, `idx_bi_cik_final_key`) | final ≤ 14 d 153 · > 14 d 5 · only earlier 3 · CIK has no final 23 (NextEra 18, Welltower 3, Boeing 2) | 11,898 |
| Q5 | `SELECT cik, issuer_name, entity_id, link_method, confidence, status, last_polled_at FROM bond_issuer_link` | 34 CIKs; 24 cik + 3 lei linked; 7 unmatched (3 active, 4 paused); polled 15–16 Oct | 34 |
| Q6 | tranches-per-final-filing distribution | 325 filings; 1×195, 2×61, 3×26, 4×17, 5×9, 6×7, 7×3, 8×4, 9×2, 11×1 | 1,268 |
| Q7 | `SELECT id, state, changed_at FROM fi_serving_gate` | open, 2026-10-30T21:21:43Z | 1 |

Each was plan-checked first with `EXPLAIN QUERY PLAN` (0 rows each). All are bounded by the ~943-row `bond_issuance` table. Q3 and Q4 use `idx_bi_cik_final_key`. **Total 17,294 rows read**, 0 written, 7 statements, no errors or retries.

**Local files read:** `bonds/state/runlog.jsonl` (2,725 lines; filing-level rules only), `dryrun-2026-10-15.json` (per-tranche `fail_reason`, titles, FWPs), `dryrun-2026-10-15` metrics, `coverage-2026-10-16.json`, `finals-2026-10-16.json`, `r2-fills-2026-10-29.json`, `r3-filer-scan-2026-10-29.json`, `r4-nextera-2026-10-31{,.rollback}.sql`, `cursor.json`, the cache listing (845 files, 32 MB), `bonds-config.json`, `bonds-parse.mjs`, `bonds-ingest.mjs` (grep), `migrations/008-bonds.sql`, the FI routes in `src/entities-api.js` and the FI block in `App/ma-entities.js`. Fixture text was read with gunzip/grep: UNH, ICE and Duke preliminaries; UNH, ICE, Oracle, Toyota FRN, GM, Amazon finals; UNH and Duke FWPs. Decision logs: October and November (grep).

**Tests:** `node --test` on `bonds-parse`, `bonds-ingest` and `bonds-filer-scan` → **52/52 pass**.

## 3 Deviations

1. **Parser functions were called on stored data.** To count draft titles, I called the pure function `classifyTitle()` (imported from `bonds-parse.mjs`) on the audit titles stored in the 15 Oct snapshot. It made no network request, wrote nothing and parsed no document. The Control prohibits "running the parser", so I stopped once I noticed and continued with plain text reads. The affected figure, "6 confirmed, up to 9 equity drafts", was then checked by eye against the titles: the 6 are named in spec §2 C1c. Other counts are unaffected.
2. **`/write-spec`** was loaded. Its PRD elements (problem, goals, non-goals, stories, priorities, acceptance) sit inside the Task's fixed §1–11 structure, not as a separate layout. I asked no questions: the Founder's decisions are in §11.
3. **"Fail reasons live in local run logs" (Task baseline) was corrected:** they are in the dry-run snapshot, not `runlog.jsonl`.
4. The first test invocation pointed `node --test` at the folder and reported a false failure. I re-ran it on the three files: 52/52.

## 4 Boundaries kept

- Only SELECT / EXPLAIN QUERY PLAN, from the repo root with `--remote` and no `-c`, through a scratchpad helper that refuses non-read statements. 7 statements, 17,294 rows (caps 10 / 120,000).
- No D1 writes, no SEC/EDGAR or other network fetches, no parser/discover/ingest run or re-parse (deviation 1 noted), no deploys.
- No code, `docs/`, `.env*` or secrets touched; no token printed.
- No git writes.
- Files written: only `claude/specs/MA-NOV-BOND_Spec.md` and this report. Scratch files live in the session scratchpad outside the repo.
- No Status, board, Tower, `transitions.jsonl`, factory or LANE_OPENER files touched. No LaunchAgents, no installs, no subagents. `13F Seed/gleif-seed.js` untouched.
