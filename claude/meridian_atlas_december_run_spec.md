# Meridian Atlas — December Run Specification

## 1. Status and authority

Draft for Founder approval — 27 November 2026.

Basis: `Meridian_Atlas_Current_State_v15.docx` (27 Nov 2026), including its known-issues register (Section 25.10) and December backlog (Section 25.12). Where this specification and v15 disagree, v15 records what is live; this document records what December should do.

This is a scope and requirements specification. It does not authorise production writes, deploys, scheduler changes, Pages switches or secret handling. Those follow the existing approval gates and the November rules in v15 Section 5.5. Detailed per-workstream specifications are produced after Checkpoint 1.

## 2. Objective

December makes what already shipped dependable. Exposure, bonds, holdings and the Ops console are live; December closes the gaps that limit how far users and the Founder can trust them, and hardens the platform around them.

Theme: completeness, trust and security — not new modules.

Data depth, new data sources and wider coverage are the post-December product direction. December contributes the fact base for that decision (Section 8) but does not start it.

## 3. Principles

- Depth over breadth: finish and verify before adding.
- Evidence first: every workstream starts with a read-only assessment against the live system.
- One go-live: batch releasable work into a single release, as in November, with a rollback target recorded for every change.
- Budget safety: free-tier limits are a hard design constraint.
- No silent scope growth: any addition names what it displaces.
- The delivery factory continues unchanged unless Workstream H says otherwise.

## 4. Scope

| ID | Workstream | Priority | Source (v15) |
|---|---|---|---|
| A | Security and access | P0 | Security row (25.10); 22.53 |
| B | Holdings freshness and UIT path | P0/P1 | 22.50, 22.51, 22.52 |
| C | Exposure completeness and entity identity | P1 | 22.52, 22.55; December backlog |
| D | Job health and monitoring | P1 | 22.31; Section 25.9 |
| E | Bonds finish | P2 | 22.54 |
| F | Bounded platform audit (read-only first) | P0 | Founder idea 1 |
| G | Records and documentation integrity | P0 | Document review of v15 |
| H | Delivery factory friction (measurement first) | P2 | Section 25.1 |

P0 starts immediately. Order within a priority is set at Checkpoint 1 by dependency and risk.

## 5. Workstream requirements

### A. Security and access

| ID | Requirement |
|---|---|
| SEC-01 | Establish the exposure of the read-only Ops GET routes: which routes, what data each returns, and what an anonymous caller can see. |
| SEC-02 | Recommend and, after approval, apply access control to those routes without breaking the Ops console or health-check LaunchAgent. |
| SEC-03 | Confirm whether the two historical token literals in public git history are revoked. Record the evidence. If revocation cannot be confirmed, rotate rather than assume. |
| SEC-04 | Stamp `ma-ops.js` in the Ops console shell (KI 22.53) as part of the same change set, since it needs a Worker deploy. |
| SEC-05 | Do not print or log secrets during any step. Existing secret-handling rules apply. |

Acceptance: an anonymous request to a protected route is refused; the console and sweep still work; revocation status is recorded with evidence.

### B. Holdings freshness and the UIT path

| ID | Requirement |
|---|---|
| HLD-01 | Measure holdings freshness for every ETF in `etf_master`: newest stored month, age and rank. Produce the distribution, not just the average. |
| HLD-02 | Explain why the Sunday run stops at its write guard after 8–13 ETFs, including per-ETF write cost, and project the length of a full pass at current behaviour. |
| HLD-03 | Recommend options to complete a pass within an agreed target, compatible with the daily write limit, the Sunday freeze windows and the back-fill budget. Options may include sizing, splitting across days, prioritisation by usage or staleness, or avoiding rewrites of unchanged data. Founder selects. |
| HLD-04 | Build the permanent CIK-based N-PORT path for series-less trusts (SPY, DIA, MDY) and QQQ so they refresh without a one-off load. |
| HLD-05 | Link the four UIT funds in `fund_entity_link` so they count in "who holds company X" (KI 22.52). |
| HLD-06 | Preserve existing holdings behaviour for other ETFs; no ETF number may change except through an approved, verified path. |

Acceptance: freshness distribution reported before and after; agreed pass-length target met or the shortfall explained; the four UITs refresh on schedule and appear in company-holder views; ETF PL sign-off on any change to the holdings path.

### C. Exposure completeness and entity identity

| ID | Requirement |
|---|---|
| EXP-D1 | Report the real-world match rate of exposure results (identified, unmatched, cash/derivatives, not analysed) across the supported ETFs, so quality is measured, not assumed. |
| EXP-D2 | Add a precomputed path for funds above the route caps (VXUS, BND, AGG, MBB) or show them with a clear, plain reason. Choose by cost and value. |
| EXP-D3 | Include the four UIT funds in the scheduled back-fill once linked (depends on HLD-05). |
| EXP-D4 | Measure back-fill progress and the projected completion date against the write budget. |
| EXP-D5 | Assess near-duplicate entities (KI 22.55; the October held merges: 6 unsigned pairs, 101 three-way/OTP rows, 7 Filings-linked, 154 candidate pairs). Propose a bounded cleanup that fixes visible search and exposure duplicates first. |
| EXP-D6 | Any merge or identity write follows the existing Data-Identity sign-off, batch, rollback and cap rules. |

Acceptance: match-rate report delivered; over-cap funds handled or explained; UITs in the back-fill; visible duplicates (such as the Taiwan Semiconductor case) resolved in the agreed set, with reference probes at zero.

### D. Job health and monitoring

| ID | Requirement |
|---|---|
| JOB-01 | Make the FIRDS weekly seed report to the Ops ledger so a failure raises a case (KI 22.31). |
| JOB-02 | Inventory every scheduled job against the registry: schedule, emitter, expected duration and alert path. Identify any job that can fail silently. |
| JOB-03 | Assess why the enrich phases have shown no progress for several days; decide whether to fix, pause or retire them before spending boost runs on them. |
| JOB-04 | Update registry rows and health expectations for the November changes (bootstrap cron removed, financial-facts agent retired, exposure back-fill). |
| JOB-05 | Confirm the alerting sweep raises a case for a simulated or replayed failure of each monitored job class. |

Acceptance: no scheduled job can fail without a ledger event or case; the registry matches the live schedules.

### E. Bonds finish

| ID | Requirement |
|---|---|
| BND-01 | Build the three withheld offering fields only if they meet the existing 95%-correct source check; otherwise keep them withheld and record why. |
| BND-02 | Add issuer coverage totals and `#/fi` directory counts (KI 22.54). |
| BND-03 | Keep the existing rules: extracted facts only, no generated narrative, no prices, yields or credit analytics, one exported withheld-fields constant. |
| BND-04 | Include the parser remarketing rule only if the Founder approves it as an addition (an October carry-over); it is not baseline scope. |

Acceptance: shown values remain source-linked and correct on a fresh sample; withheld fields stay withheld unless they pass the gate.

### F. Bounded platform audit

A read-only audit with a time box and a ranked findings list. It builds on MA-NOV-DIAG.HEALTH rather than repeating it.

| ID | Audit area | Question |
|---|---|---|
| AUD-01 | Security | Beyond Workstream A, what else is reachable anonymously or over-privileged? |
| AUD-02 | Cost | Which routes and jobs are the largest read and write consumers with the back-fill running? What is the worst-case polling pattern? |
| AUD-03 | Routes and code | Which backend routes and front-end code paths are now unused (for example the Events, Sprint and Release routes left in place after the tab removal)? |
| AUD-04 | Freshness | How current is each dataset: 13F, Filings, ETF, entities, bonds, news? |
| AUD-05 | Resilience | Does a restore or rollback test exist for D1 and for each Worker, and has it been run? Record what is evidenced and what is not. |
| AUD-06 | Records | Are the Sprint Board, Release Ledger and Decisions Log consistent, and is the D1 copy of the board and ledger still relied on? |

Each finding gets a severity, an owner and one of: fix now, schedule, accept. Only Critical and High findings are fixed in December without a new approval. No broad refactor is committed; code changes are justified by a specific finding.

Acceptance: a ranked findings list delivered at Checkpoint 1b; every Critical and High finding closed or explicitly accepted by the Founder.

### G. Records and documentation integrity

| ID | Requirement |
|---|---|
| REC-01 | Reconcile KI 22.38: v14 records the token literals as inert; v15 says revocation is unconfirmed. |
| REC-02 | Reconcile the FIRDS failure start date (v14: from 18 Oct; v15: five Sundays from 4 Oct). |
| REC-03 | Remove contradictory old and new text in Sections 10 and 15 of the current-state document. |
| REC-04 | Correct the budget wording in Section 25.7 so the 25 Nov read figure (2.34M of 5M, from one integrity check) is stated plainly. |
| REC-05 | Record the Ops console's fourth tab (Drift & Budget) as an approved scope change. |
| REC-06 | Archive the November Sprint Board, Release Ledger and Decisions Log at close, and publish v16. |

### H. Delivery factory

Measurement first. The factory stays assisted unless a change is approved.

| ID | Requirement |
|---|---|
| FAC-01 | Measure Founder touches per packet (approve, paste, "done") across the November record. |
| FAC-02 | Report the cost of the two manual touches and whether headless sign-in can be solved safely. |
| FAC-03 | Propose at most one friction reduction for approval. No expansion of autonomy, concurrency or scope without a decision. |

## 6. Out of scope

- New data sources, new geographies, new asset classes and wider ETF coverage (post-December).
- A broad application refactor or framework change. Vanilla JavaScript and the Workers-only constraints remain.
- New product modules and any bond valuation, yield or credit analytics.
- Paid data feeds or any recurring cost above the existing budget.
- Changing the selected model, or running parallel planning lanes.

## 7. Constraints (from v15 and existing rules)

- Free tier only: 100k writes per day, 5M reads per day, 5 GB. November's peak write day was about 49.5k.
- A production run starts only if today's rows written plus the run stay at or below 58k, including the 06:00 back-fill. Never on Sunday (holdings) or inside freeze windows.
- Writes in batches of 100 statements or fewer, with an expected-changes vector per statement, a stop on the first mismatch and a pinned rollback.
- Equality queries per fund on holdings; no whole-database integrity checks.
- One production change at a time, with a UTC time and a rollback target recorded.
- Deploy additive Workers before the front end; bump the `?v=` release stamp; the Founder switches GitHub Pages by hand.
- Domain ownership, branch discipline and the independent-review rule are unchanged. Executors never review their own work.

## 8. Post-December input: data coverage and freshness matrix

A read-only deliverable that supports your post-December product decision. It is not a new build.

For each dataset (ETF holdings, entities and LEI, bonds, 13F, Filings, news): what is covered, how fresh it is, what the gaps are, the cost to extend it, and which users' questions it limits. Produced from the Workstream B and F evidence. No recommendation on direction is made here.

## 9. Proposed sequence and checkpoints

Dates are proposals for approval, not commitments. November's demo runs 27–30 Nov.

| Checkpoint | Content | Target |
|---|---|---|
| C0 | Baseline: confirm the November close state, working branch (a December branch cut from `November-2026`) and Pages stays on `November-2026` | Mon 30 Nov – Tue 1 Dec |
| C1a | Read-only assessment for A, B, C, D and F (freshness distribution, match rate, job inventory, audit findings) | By Fri 4 Dec |
| C1b | Founder scope approval with capacity and trade-offs; ranked findings | Early in the week of 7 Dec |
| C2 | Detailed specs and work units per approved workstream | Week of 7 Dec |
| C3 | Build, independent review, verification | From 8 Dec |
| C4 | Single December go-live, then close, v16 and archives | Proposed by Thu 17 Dec, leaving a buffer to year-end |

Usage planning: your weekly resets and the one-off full-reset credit (valid to 10 Dec, unused) are inputs to sequencing. Front-load the heavy read-only assessment so it can use that window if you choose.

## 10. Decisions required from the Founder

1. Approve the theme and the eight workstreams, or remove any.
2. Confirm A, F and G are P0 and run first.
3. Confirm the December branch name and cut point.
4. Choose the holdings-freshness target at Checkpoint 1b, once the freshness distribution is known.
5. Decide whether to spend the full-reset credit before 10 Dec.
6. Confirm the proposed release date and a freeze date before year-end.
7. Decide whether the October carry-overs not listed above (A2, 007 Phase 2, parser remarketing rule, remaining held merges beyond EXP-D5) stay out of December. They are excluded unless you add them.

## 11. Definition of done

December is complete when:

- The public Ops routes are protected and token revocation is evidenced.
- Holdings freshness is measured, the agreed pass-length target is met or the shortfall is explained, and the four UITs refresh permanently.
- Exposure match rate is reported and the known gaps (over-cap funds, UIT back-fill, visible duplicates) are closed or explained.
- No scheduled job can fail silently.
- The three withheld bond fields are shown only if they pass the accuracy gate, and coverage totals are live.
- Critical and High audit findings are closed or accepted.
- Records are reconciled, v16 is published and November records are archived.
- The data coverage and freshness matrix is delivered for the post-December decision.
