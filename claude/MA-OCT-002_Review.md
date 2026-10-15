# MA-OCT-002 — Spec Review (Architect + ETF Product Lead)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Architect + ETF Product Lead (review only, doc-only)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Thu 8 Oct)
PACKET:       MA-OCT-002 — Fleet, schedules, health and drift (SPEC)
GATE:         Spec review → Founder spec approval
```

> **Independence disclosure (for the Main Lane).** This review was run in the same Cowork session that wrote the spec as Operations Lead. The findings below were checked against source code and the EXPLAIN pack, not against the spec's own claims, and two of them correct the spec. The Main Lane decides whether that is sufficient separation or whether a fresh session should repeat the review (Addendum §5: "Owning a packet does not make you its reviewer").

```text
REVIEWERS:    Architect; ETF Product Lead
PACKET:       MA-OCT-002 (spec rev 1.1)
VERDICT:      PASS WITH NOTES
EVIDENCE CHECKED (8 Oct, read-only, git --no-optional-locks, no .git locks, HEAD 16918e0):
  - claude/MA-OCT-002_Spec.md            76ed20c43983a1a95042e9f2e0b91e4c0c107a50d36a72fcf5cd24c6d70fe203 (re-hashed; matches the Main Lane's rev 1.1)
  - claude/MA-OCT-002_Explain_Pack_Results.md 677dd3d0b60fa039ef9186fc6f4da73b10579c1518979c7b4c397e493ea268b4 (re-hashed)
  - App/ETF Refresh/src/bootstrap.js (fetch/scheduled handlers; runBootstrap; runWeeklySync, lines 296–345)
  - App/ETF Refresh/src/holdings-pipeline.js (subrequest budget comment, lines 1–17; batch size 20; MAX_BATCHES_PER_RUN 35)
  - App/Corporate Atlas/entities-enrich-boost-run.mjs, logs (boost + heartbeat, 2–7 Oct), package.json (no wrangler dependency today)
  - claude/MA-OCT-011_Spec.md rev 1.2 lines 240, 245, 357 (F7 / 011 dependency claim)
  - EXPLAIN pack P1–P8 against spec §11.2 (verbatim transfer checked; 374 reads, 0 writes)
REQUIRED BEFORE APPROVAL (doc corrections only; no scope change; Operations Lead → rev 1.2):
  R-1  Bootstrap is not idle (ETF PL, E-1). Correct §10 (CR-6 rationale), §12 (bootstrap row) and §7.5 (RQ-1 premise).
  R-2  AC-a4's production window cannot be met as written (Architect, A-1). Restate it in fires, not days.
REQUIRED BEFORE THE NAMED BUILD STEP (carry into the Build Brief):
  B-1  Declare and EXPLAIN the daily raise-cap count query before A3 (A-2).
  B-2  Measure holdings' real subrequest use before wiring its heartbeat in B2 (E-2).
```

---

## 1. Architect

| # | Area | Finding | Severity | Required? |
|---|---|---|---|---|
| A-1 | **AC-a4 vs the 011 pause** | A4 goes live Wed 14 Oct; the boost is paused 17–23 Oct if 011 is GO. The "7 days after go-live" production window (14–21 Oct) therefore contains at most 6 boost fires (14 Oct 16:50 → 16 Oct 16:50), and the pause makes the rest impossible. **Fix (R-2):** restate as "the first **14 consecutive scheduled slots** after go-live, excluding `paused` slots" (completes ≈ 30 Oct if 011 is GO; ≈ 21 Oct if not). Same change for the §20 metric rows that say "7 days after A4". | Medium | **Before approval (R-2)** |
| A-2 | **Three-point gap: daily raise cap** | §11.1 adds `OPS_SWEEP_DAILY_RAISE_CAP` (≤ 100 a day). Enforcing it needs a count of today's raises. No query is declared: `ops_exception` has no index led by `opened_at` (`idx_ops_exception_queue` is `(status, severity, opened_at)`), so a naive `COUNT(*) WHERE opened_at >= ?` is an undeclared SCAN. Options: count `ops_case_event` rows with `event_type='raised'` through `idx_ops_case_event_subject` if its columns fit, or keep the counter in the response and cap per call only. **Declare the query and its plan before A3 is built (B-1).** | Low | Before A3 build |
| A-3 | **Build order** | A6 → A1 → A2 → A3 is correct (the sweep is the 15th endpoint without A6). But A4 is on 011's critical path (006 Ops N-4) and is scheduled on the **last** build day with only Thu 15–Fri 16 as slack, behind an external ACK. A4 has no dependency on A6/A1/A2. **Recommend:** obtain the Data-Identity Lead ACK by Fri 9 and move the A4 file save to Sat 10 or Tue 13. | Medium | Note |
| A-4 | **Rollback granularity (§19.4)** | "Redeploy the previous `meridian-ops` version" for A6 is only safe until A3 deploys; after that, the previous version also drops the sweep route and the lateness fields. After A3, A6 rollback must be a **roll-forward** (re-add the 4 governance GETs and 4 admin POSTs to `meridian-ops`), with `meridian-control` left running. Record the version IDs per item in the close-out. | Low | Note |
| A-5 | **Redirect rule (RQ-4)** | Use **302 or 307**, not 301. Browsers cache 301 permanently, which outlives a rollback and the 005 cut-over. | Low | Note (fold into rev 1.2) |
| A-6 | **Worker size** | The spec counts endpoints (7 of 15) but gives no line estimate for `ops-api.js` after 002a (001 rule: 15 routes **or** ≈ 1,500 lines). 955 today − governance code (≈ 250) + lateness/sweep/raise (≈ 350–450) ≈ 1,100. State it in the Build Brief. | Low | Note |
| A-7 | **Non-productive streaks** | A boost slot that fires late and is `skipped(out_of_window)` is counted but never raised. Three or more in a row means no Phase 3 work for 1.5 days with no alert. Suggest a P1 rule: raise `job_missed`-class sev3 after 3 consecutive non-productive slots. | Low | Note |
| A-8 | **FIRDS pin timing** | CR-5 also changes `firds-local-seed.mjs` (the pin). FIRDS runs Sundays 10:00 UTC, including Sun 18 Oct inside the 011 window. Land the FIRDS change by Wed 14 Oct or after 23 Oct. | Low | Note |

**Split and phasing.** 002a contains exactly what 003/004 and 011 need: registry rows (A1), the first `ops_exception` producer (A3), route headroom (A6) and the outbox before 011's bulk start (A4). 002b holds everything that depends on the Workers-Read token or on Worker code changes. **Accepted.**

**CR-1 to CR-11.** Complete. Each names its owner, sign-off and reviewer. CR-2 and CR-3 approved with the spec is acceptable (one new Ops table; one new route under the existing ingest auth). CR-5 bundles five changes under one ACK, which is the right trade-off for one go-live record, but its rollback reverts all five at once (§19.4 A4), including the return of the blind `writes_today` pre-flight. Accepted as emergency-only.

**Three-point check (§11.3).** Index audit evidence is real: P4 (L2) and P5 (S1) plans match; P1 confirms the `holdings_pipeline_state` PK autoindex for S2/S3. Declared SCANs are bounded (registry ≤ 60; `ops_job_pause` ≤ 100). Budgets are conservative (`ops_case_event` has 2 indexes, so ≈ 3 writes rather than 4). **Accepted, with A-2.**

**Does the F7 phasing protect 011? Yes.** Checked against 011 rev 1.2: (1) 011 reads `d1-today` before every batch and caps account total + batch at 70,000 (line 240), so it never reads `writes_today`; (2) it never runs Sunday or Monday before 08:00 (line 245), the only days the counter exists; (3) the boost is paused through the window (line 357). The one blind guard left during 011 is enrich's (KI 22.14), whose cron writes are small and fall inside 011's analytics-based total. Two conditions: the `d1-today` lag must be measured before 17 Oct (planned at the A1 load, Sat 10 — keep that date), and both consumers fail closed if the route is unreachable (the spec says so for the boost; 011 should state the same). The spec's correction to 011 line 357 (a paused boost sends nothing) is right and should reach the 011 lane.

---

## 2. ETF Product Lead

| # | Area | Finding | Severity | Required? |
|---|---|---|---|---|
| E-1 | **Bootstrap is not idle** | The spec says `runBootstrap` "exits after 1 read" once `status = complete` (§10), proposes bootstrap heartbeats as end-only `skipped`/`empty_input` (§12), and describes the cron as firing "6× a day and exits at once" (§7.5, RQ-1). **The code says otherwise:** with `status = complete`, `runBootstrap` calls **`runWeeklySync()` on every 4-hour fire** (`bootstrap.js:60–62`, `299–345`). Each run sets `last_run`, re-discovers all SEC fund series (external fetch), reads `edgar_bootstrap_progress` in full, resolves `NOTICKER_` tickers with `UPDATE etf_master`, and processes up to `BATCH_SIZE` new series into `etf_master`. It is the ETF universe's ongoing sync, not a no-op. **Effect on the spec:** CR-6 itself stands (removing `/trigger` does not touch the cron path, and AC-a5's `last_run` check still works because `runWeeklySync` sets it first). But (i) §10's rationale must change to "the cron already runs the sync every 4 h, so no manual trigger is needed"; (ii) §12's bootstrap row must be start + end with `items_attempted` = new series considered, `items_progressed` = added, `rows_written`, and its subrequest cost measured like holdings (E-2); (iii) RQ-1's premise must change — adding the sweep call to bootstrap adds to an invocation that already makes external calls and writes `etf_master`. | **High (factual)** | **Before approval (R-1)** |
| E-2 | **Holdings subrequest headroom** | §12 says holdings adds "2 (of 50; holdings uses few fetches)". The Worker's own budget comment (`holdings-pipeline.js:10–17`) models 50 subrequests per invocation shared by fetch **and** D1 calls: ~8 per ETF, ~4 fixed, and up to `MAX_BATCHES_PER_RUN = 35` insert batches, tuned close to the limit. "Few" is not shown. **Before B2 wires holdings:** take one Sunday run's actual subrequest count (tail or invocation metrics) and either reserve the heartbeat in that budget or use end-only (1 subrequest). | Medium | Before B2 build |
| E-3 | **Bootstrap read cost (outside 002)** | `runWeeklySync` reads `SELECT series_id FROM edgar_bootstrap_progress` without a filter on every fire. At the 000 manifest's 11,858 series × 6 fires, that is **an estimated ≈ 71k reads a day** (not measured). Not a 002 item; logged here for the ETF backlog and as useful input to F9/KI 22.33 (the slot is busier than "finite purpose complete" suggests). | Low | Note (ETF backlog) |
| E-4 | **No writes to ETF tables** | Confirmed. Ops only reads `holdings_pipeline_state` by primary key (S2, S3; P1 shows the autoindex). B2 changes ETF Worker code (holdings, bootstrap) but adds no write to any ETF table; those changes stay under CR-9 with ETF PL sign-off. The only ETF-table write anywhere in 002 is CR-10's guarded delete of the 4 enrich keys, done by the ETF PL. The 49 unpruned `writes_today_*` keys (P7) stay ETF PL housekeeping, outside 002. | — | Accepted |

**CR-6 (bootstrap `/trigger` removal): APPROVED by the ETF PL**, subject to the R-1 wording fix. Deploy Fri 9 Oct as planned; avoid the minute of a 4-hour fire (00/04/08/12/16/20:00 UTC) so the check of `last_run` advancing is clean.

**RQ answers:**

| RQ | ETF PL | Architect | Combined |
|---|---|---|---|
| RQ-1 bootstrap cron as a cloud clock for the sweep | Not as framed (E-1). Acceptable only as a single `ctx.waitUntil` call **after** the sync finishes, after E-2-style measurement, with its own emitter key | The gap it closes (a dead sweep is silent) is real and worth closing | **Defer to B2 with evidence**; decide when the bootstrap heartbeat is wired |
| RQ-2 analytics (`d1-today`) as the budget source for non-holdings jobs | Agree. Holdings keeps its in-run guard and counter. Seed's write to the ETF-owned counter (a cross-domain write) retires when seed moves to analytics (CR-11/B5) | Agree; lag measured before 17 Oct | **Yes** |
| RQ-3 governance tables stay Ops-domain, `meridian-control` sole writer | No ETF impact | Agree; D3's "only `meridian-ops` writes `ops_*`" is unaffected (these tables are not `ops_*`). Log it in the Decisions Log | **Yes** |
| RQ-4 redirect rule until 005 | No ETF impact | Agree, but 302/307 (A-5) | **Yes, with 302/307** |

**§9 ETF items (a)–(c) and D2-2: accepted.**
- (a) The 75k warning and 80k sev2 are right. Since MA-OCT-012 moved the seed to Monday, the Sunday counter is holdings-only, so 70,672 (27 Sep) is a like-for-like baseline; 4 Oct was 36,434 (P7).
- (c) The interim estimate is sound: offset 71 of 237 at 20 ETFs a run is ≈ 8.3 more Sundays for this pass; the full cycle is ≈ 12 weeks.
- (b) needs B2 and E-2 first.

---

## 3. Summary for the Main Lane

- **Verdict: PASS WITH NOTES.**
- **Before Founder approval:** rev 1.2 with **R-1** (bootstrap description in §10, §12, §7.5/RQ-1) and **R-2** (AC-a4 and §20 restated in slots, excluding paused). Fold in A-5 (302/307) at the same time. These are wording changes; scope, phasing and CRs are unchanged.
- **Into the Build Brief:** B-1 (declare the raise-cap query before A3), B-2 (measure holdings and bootstrap subrequests before B2), A-3 (get the Data-Identity ACK by Fri 9 and move the A4 save earlier), A-4 (roll-forward after A3), A-6 (line estimate), A-8 (FIRDS change before 14 Oct or after 23 Oct).
- **To route:** the correction to 011 rev 1.2 line 357 (a paused boost sends nothing) and the request that 011 states it fails closed if `d1-today` is unreachable; E-3 to the ETF backlog.
- **Independence:** see the disclosure at the top.
