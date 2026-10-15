# MA-OCT-002: Independent Review (Architect + ETF Product Lead)

```text
ISSUED BY:    Main Lane
EXECUTED BY:  Architect + ETF Product Lead (independent review, doc-only, fresh session)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder (Fri 9 Oct)
PACKET:       MA-OCT-002, Fleet, schedules, health and drift (SPEC rev 1.2)
VERDICT:      PASS WITH CONDITIONS. Approve after rev 1.3, which is doc-only: R-A to R-E below.
              No change to scope or phasing is needed, with one possible exception. R-A may add a small
              gating item to A5 if the Founder chooses that over accepting the risk.
```

## 0. Evidence and method

| Item | Value |
|---|---|
| Spec under review | `claude/MA-OCT-002_Spec.md` **rev 1.2**, re-hashed on disk (repo, `October-2026`): **`98c0ef370e398d2a5ac0d8f39731d0e49b1eec6cf02d1d8a06446cc298c4dbf2`**, 81,600 bytes. Header: STATUS REV 1.2 (8 Oct); supersedes rev 1.1 `76ed20c4…fe203`. The Project copy was read in full and is the same revision. It was not byte-hashed, because the Project tool returns text, not bytes. |
| Explain pack | `claude/MA-OCT-002_Explain_Pack_Results.md` **`677dd3d0b60fa039ef9186fc6f4da73b10579c1518979c7b4c397e493ea268b4`**: **matches** the value the spec cites. All P1–P8 figures in spec §11.2 agree with the pack, as do the 374 reads, 0 writes and 4 contract-test rows. |
| Spec brief | `1fb5881c…a55b`: matches. |
| Self-check | `claude/MA-OCT-002_Review.md` `b970ddec…3bd5`: matches. **Opened only after §1–§3 were written** (see §4). |
| Repo | HEAD `16918e0`, branch `October-2026`, read with `--no-optional-locks`. No git, D1, deploy or secret action. **0 D1 reads, 0 writes.** No live HTTP call: a GET to an unauthenticated `/run` would start a run. |
| Code read | `bootstrap.js` (handlers, `runBootstrap`, `runWeeklySync`); `holdings-pipeline.js` (budget model, `/run` auth, state keys); `entities-seed.js`, `entities-figi.js`, `entities-delta.js`, `firds.js`, `entities-enrich.js` (fetch handlers, `checkWriteBudget`, `SUBREQUEST_CHECKPOINT`); `ops-api.js` (router, 14 endpoints, `SKIPPED_REASONS`, ingest cap, `cfD1WritesToday`, CORS); `002-ops-control-plane.sql` (`ops_exception`, `ops_case_event`); `entities-enrich-boost-run.mjs`; `firds-local-seed.mjs`; `check-pipeline-health.js`; every `wrangler*.toml` `[triggers]`; git history of `bootstrap.js` and `entities-delta.js`; `claude/MA-OCT-011_Spec.md` on disk (`ae441749…4a91`, rev 1.5); Decisions Log entries of 1 Oct and 8 Oct (Data-Identity Lead conditions). |

---

## 1. Verdict and what is required before approval

The spec is strong. The OB-1 to OB-5 binding items are each placed and tested. The read and write budgets are conservative and backed by live plans. The 002a/002b split puts what 003, 004 and 011 need first. The rev 1.2 corrections (bootstrap runs `runWeeklySync`; the AC-a4 window counted in slots) are correct against the code.

Five things must change before the Founder approves. All five are doc-only.

| # | Required (rev 1.3) | Why | Owner |
|---|---|---|---|
| **R-A** | **Anonymous run routes beyond KI 22.35/22.36.** In repo source, `meridian-entities-seed` `/run` (`entities-seed.js:489`) and `meridian-entities-figi` `/run` and `/rematch` (`entities-figi.js:404`) have **no authentication**. The only guards are `hold_all_jobs` and `checkWriteBudget`, and both budget checks read the blind `writes_today_<date>` counter. Both Workers are deployed (`ab62dc15`, `ae7fd10d`; 000 manifest). G6 ("No anonymous run routes") and §1 overstate what A5 delivers. Correct G6, §1 and §10. **Then the Founder chooses one of two options:** (i) add a CR-7b to A5: the same gate pattern (fail-closed secret) for seed and figi, with Data-Identity Lead sign-off, live by Wed 14 Oct, est. ≈ 0.25 d; or (ii) record it as an accepted risk until after 23 Oct and log a new Known Issue. **Reviewers recommend (i).** See §2, F7/011. | An anonymous seed run on a weekday reads `writes_today` ≈ 0. It passes the 65k-headroom guard and can write up to ~61k logical rows (`entities-seed.js` comment). It cannot see 011's writes. During 17–23 Oct that alone could take the account past 100k. | Operations Lead (spec); Data-Identity Lead (sign-off); Founder (choice) |
| **R-B** | **Correct the §8.5 claim that the enrich guard is "the remaining blind reader during the 011 window".** The seed and figi on-request guards are also blind (R-A). Holdings' own guard counts only holdings and seed. Restate the 011 independence argument with this list. Also re-cite 011 by **rev 1.5/1.6 section** (§4.3, §4.4, §8), not by rev 1.2 line numbers. On disk, 011 is rev 1.5 `ae441749…4a91`, and the cited lines have moved to 312/320/448. | Correctness of the F7 / 011 argument the Founder relies on. | Operations Lead |
| **R-C** | **Pre-decide the CR-7 STOP, and add the same check to CR-6.** `entities-delta.js` changed in the repo on **23 Aug (`b238e36`, +11/−1)** and **24 Aug (`1b6a7a3`, +10/−1)**. The deployed version `7d316b5e` dates from **16 Aug**. Data-Identity condition §10.1(2) (deployed = repo, else stop) will therefore almost certainly stop the Sat 10 build. Deploying from HEAD would also ship those changes, which breaks condition (1), "auth gate only". Rev 1.3 must name the path in advance: (a) apply the gate to the **deployed** source, fetched from the version, not HEAD; or (b) a new Data-Identity ACK that covers shipping the two diffs. Without a path, A5 slips and the anonymous delta `/run` stays open through 011. **CR-6:** add the same "deployed (`4cdf40f3`, 14 Jun) = repo" check before the bootstrap edit. The repo history of `bootstrap.js` starts at the 1 Aug baseline, so equality is not shown. | Avoids a predictable stop on a 011-critical build day. | Operations Lead; Data-Identity Lead (CR-7); ETF PL (CR-6) |
| **R-D** | **Data-Identity Lead conditions: complete the binding lists** in §8.6 and §10.1 against the 8 Oct sign-off (Decisions Log, 8 Oct). The substance is mostly elsewhere in the spec, but the "any change needs a new ACK" clause covers only what is listed. Add: §8.6(a) "the 3-field line layout"; §8.6(b) "unreachable `d1-today` → `error` / `headroom_unavailable`, no `/run`", "spool under `Corporate Atlas/logs/` (gitignored)" and "live by Wed 14 Oct"; §10.1(1) "**MA-SEP-009 Bug 2 untouched**"; §10.1(3) "401 ×2 and `delta_last_run` still absent". **Also fix one inconsistency in §10:** it asks for a "constant-time compare, copying enrich's MA-SEP-010 pattern", but enrich uses `!==` (`entities-enrich.js:552`). Say "fail closed when the secret binding is missing (`!env.RUN_AUTH_SECRET` → 401), plus a constant-time compare". | Answers the Architect question "are the Data-Identity Lead's conditions fully written in?": **not yet, 5 small gaps.** | Operations Lead |
| **R-E** | **Make the sweep's raise contract explicit (§7.2).** (1) `ops_exception.case_ref` is `NOT NULL UNIQUE`, and no code assigns it yet (the sweep is the first producer). Under `INSERT OR IGNORE`, a `case_ref` collision is silently ignored and looks exactly like a dedupe hit, so a real finding is lost. State the rule; for example, derive it from `exception_id` or make it a deterministic function of `dedupe_key`. (2) The paired `ops_case_event` "raised" row must be conditional: `INSERT OR IGNORE` with `idempotency_key = 'raised:'‖dedupe_key`, and `subject_id` taken by subselect on `dedupe_key`. Otherwise every sweep writes another audit row for every condition that persists. AC-a3 ("second sweep raises 0 new") would still pass, while the append-only table grows 4× a day. | 003 builds its auto-raise on this dedupe contract. Costs nothing to state now. | Operations Lead (Architect review) |

---

## 2. Architect

**Split and order: accepted, with one change of priority.** 002a holds what 003, 004 and 011 need (registry, first exception producer, route headroom, outbox). 002b holds what needs the token or Worker code changes. Correct.
- **A6 is not a hard prerequisite for A3.** `meridian-ops` has 14 endpoints, and the sweep would be the 15th, which is within the 15-route rule. Estimates total ≈ 4.0 d in 4 build days, with Founder approval now on Fri 9 morning. If anything slips, protect 011 first: **A4 → A5 (incl. R-A/R-C) → A1 → A2 → A3 → A6**. A6 only gates 003 and 004, which start after 15 Oct.
- **A4 on Tue 13**, Wed 14 as fallback. It needs the `d1-today` lag measurement, which is planned around the A1 load (Sat 10). Any known write batch would also serve.

**CR-1 to CR-11.**

| CR | View |
|---|---|
| CR-1 | Accept. Route arithmetic verified in `ops-api.js` (8 public GETs, 5 admin, 1 ingest = 14; 8 move; 6 + sweep stay = 7). 302/307 is right. After a cross-origin redirect the request `Origin` becomes `null`, so the target must answer `Access-Control-Allow-Origin: *`. `CORS_HEADERS` already does (`ops-api.js:62–63`); keep it that way in `control-api.js`, and do not echo the origin. |
| CR-2 | Accept. `ops_job_pause` is declared Ops-domain, with one writer and a bounded SCAN. |
| CR-3 | Accept with R-E. On B-1, see §4. |
| CR-4 | Accept. Removing `CF_API_TOKEN` from the health-check script is a security gain. |
| CR-5 | Accept with R-D. **Build-brief note:** network not ready on wake is a live F6 hypothesis. If it holds, the new `d1-today` pre-flight will fail the same way and record `headroom_unavailable` in place of `wrangler_auth_10000`. Count **both** classes in the AC-a4 / §20 F6 metric. Consider retrying for up to ~60 s inside the :50–:59 window instead of a single 2 s retry. |
| CR-6 | Accept (ETF PL, §3) with R-C. |
| CR-7 | Accept with R-C and R-D. |
| CR-8 | Accept, with one correction for the build brief. The cron schedules belong to **4 Workers (5 expressions)**: holdings, seed, enrich ×2, bootstrap. `GET …/schedules` is per script. To detect `unexpected_trigger` on held or retired jobs, also list `meridian-entities-delta` and `meridian-entities-figi`, which makes ≈ 6 subrequests a day. Fix "5 registered cron Workers" in §6.2 and G4. |
| CR-9 | Accept. Measurement first (B-2). Note that bootstrap has no `hold_all_jobs` check (000 manifest). |
| CR-10 | Accept (ETF PL, §3). |
| CR-11 | Accept. |
| *(gap)* | A1's registry load has no CR. It is an Ops-table data load reviewed by the Operations Lead, which is acceptable, but list it in §17 for traceability. Add CR-7b if the Founder takes R-A (i). |

**§11.3 three-point check: accepted.** Plans P4 and P5 are confirmed. The declared SCANs are bounded. No cron is added, and no large table is touched.
- Add one line for `meridian-control`: the same governance queries as today, P8 sizes, nothing new.
- Note that the existing public `GET /api/ops/openfigi-status`, which stays in `meridian-ops`, runs `COUNT(*)` over three Entities tables. This is pre-existing and not a 002 change. Do not let the admin read or the sweep call it.
- The **daily raise cap** is the one undeclared query (B-1). See §4 for a zero-read option.

**§19.4 rollback: accepted, with four additions for the build brief.**
1. Roll back in reverse dependency order, A3 → A2 → A1 → A6. A2 cannot be rolled back while the sweep (A3) is enabled.
2. Add rows for the wrangler pin (`package.json` and lockfile) and for the FIRDS runner change.
3. Rolling A4 back before 17 Oct also drops 011's outbox gate to its fallback (daily run-log reconciliation). Say so.
4. After A5, prefer roll-forward to redeploying the old delta version, which reopens anonymous `/run`.

**Does the F7 phasing protect 011? For the boost, yes. For the account budget, only with R-A.**
- F7 only changes the boost, which is paused 17–23 Oct. 011 protects itself with its own `d1-today` gate: account total + batch ≤ 70k, ≤ 25k a day, never on Sunday or before 08:00 on Monday (011 rev 1.5 §4.3–§4.4).
- What still threatens 011 are other writers whose guards are blind:
  - the seed and figi on-request routes. These are anonymous (R-A).
  - enrich's daily cron. It is small, and 011 avoids its windows.
- Three items must be true by Fri 16 Oct. Add them to the build brief:
  1. The **`d1-today` lag is measured** (A4 gate).
  2. 011's job `manual.gleif-reconcile-011` and its emitter key are **registered** before its first write (011 §7/§11). It is not among A1's 49 rows. Name the owner and date.
  3. "**Outbox live**" is defined for 011's gate. The A4 outbox lives inside the boost runner, so it protects 011's events only if 011's runner uses the same helper. Name the helper module (path and interface) so 011 can import it; otherwise 011 uses its daily reconciliation fallback.

---

## 3. ETF Product Lead

**CR-6, bootstrap `/trigger` removal: APPROVED**, with these conditions:
- the deployed = repo check (R-C);
- deploy away from a 4-hour minute;
- after the deploy, `/trigger` returns 404 for GET and POST, and `edgar_bootstrap_state.last_run` advances at the next slot (one primary-key read).

`runWeeklySync` sets `last_run` first (`bootstrap.js:302`), so the AC-a5 check is valid. Every other path now returns 404 instead of 200 "Bootstrap Worker". No consumer depends on the old 200, because bootstrap is not in the `cf/invocations` allowlist.

**RQ-1 to RQ-4.**

| RQ | ETF PL position |
|---|---|
| RQ-1, bootstrap cron as the sweep's cloud clock | **Defer, leaning no.** Bootstrap runs a real SEC sync with no `hold_all_jobs` check, and its slot is under review (KI 22.33). Do not couple the Ops clock to it. Revisit only with B-2 evidence, and only as a post-sync `ctx.waitUntil` call under its own emitter key. |
| RQ-2, `d1-today` as the budget source for non-holdings jobs | **Yes.** Holdings keeps its in-run guard. ETF backlog note, not a 002 item: holdings should also read analytics before its run. The 20 Sep counter read 83,638 at 04:00:15, before holdings had written anything (seed co-fire, now fixed by MA-OCT-012). |
| RQ-3 | No ETF impact. Yes. |
| RQ-4 | No ETF impact. Yes, 302/307. |

**§9, ETF items (a)–(c) and D2-2: accepted.** All reads are primary-key point lookups on `holdings_pipeline_state` (P1 autoindex). Notes for the build:
- **(a)** P7 history: Sundays at 83,638 (20 Sep), 81,454 (30 Aug) and 98,651 (23 Aug) would all have raised the sev2. The thresholds are right.
- **(c)** The parser must handle both `running:<offset>/<total>:partial:<n>` and `complete:<n>ok:<m>err` (`holdings-pipeline.js:175,179`). Today it reads 71/237, which is ≈ 8.3 Sundays left in this pass.
- **D2-2** (interim read-only checks): agreed.

**KI 22.48 (bootstrap progress reads): confirmed as logged, not a 002 item.**
- `runWeeklySync` runs `SELECT series_id FROM edgar_bootstrap_progress` with no filter on every fire (`bootstrap.js:333`). At ~11.9k rows × 6 fires that is ≈ 71k reads a day, about 1.4% of the 5M cap. This is an estimate.
- The same fire also runs `… etf_master WHERE ticker LIKE 'NOTICKER_%'`. Include its plan in the measurement.
- Measure both, as one fire's `rows_read`, before any change. Keep it in the ETF backlog with KI 22.33.

**No writes to ETF tables except the CR-10 delete: confirmed.**
- Ops reads `holdings_pipeline_state` by primary key only (S2, S3).
- A1, A2, A3 and A6 write only Ops tables.
- B2 adds fetch-only heartbeats to holdings and bootstrap, under CR-9 with ETF PL sign-off.
- The existing seed write to `writes_today_*` is unchanged, and KI 22.14 rightly adds no new writer.
- CR-10's delete must name the **exact 4 enrich keys**, run a pre-count, and happen only after readers have switched. The `financialfact_*` keys stay out of scope.

---

## 4. Comparison with the author's self-check (`MA-OCT-002_Review.md`, opened after §1–§3)

**Disclosure.** Before the verdict, an incidental Project search hit showed an excerpt of the self-check's ETF table (E-1 to E-4). Its content was already restated in spec rev 1.2 (§7.5, §10, §12, §19.5) and in the 8 Oct Decisions Log entry, both of which this review used. None of R-A to R-E comes from it.

| Self-check item | This review |
|---|---|
| R-1 bootstrap not idle (E-1) | **Agree.** Verified in code and applied correctly in rev 1.2. |
| R-2 AC-a4 in slots, excluding paused | **Agree.** Applied in rev 1.2. |
| B-1 declare the raise-cap query | **Agree on the gap; disagree with option 1.** `idx_ops_case_event_subject (subject_type, subject_id, occurred_at)` cannot serve a cross-subject daily count. **Proposed:** sum `detail.raised` from today's `local.health-check` end events. L2 already reads them, so the cost is 0 extra reads. |
| B-2 measure subrequests before B2 | Agree. |
| A-3 move A4 earlier | Agree (Tue 13). This review goes further: if time is short, A4 and A5 come before A6. |
| A-4 roll-forward after A3 | Agree. Extended with the reverse rollback order and the extra rows (§2). |
| A-5 302/307 | Agree. Adds the `Origin: null` / `*` note. |
| A-6 line estimate, A-7 non-productive streak, A-8 FIRDS timing | Agree. |
| "A6 → A1 → A2 → A3 is correct (the sweep is the 15th endpoint without A6)" | **Disagree in part.** 15 is within the limit, so A6 is a preference, not a dependency. |
| "CR-1 to CR-11 complete" | **Disagree.** Missing are the seed and figi gating (R-A) and CR-6's deployed = repo check, and the CR-7 stop is unplanned (R-C). |
| "F7 phasing protects 011: Yes; the one blind guard left is enrich's" | **Disagree.** The seed and figi on-request guards are also blind and anonymous (R-A, R-B). The two conditions it names (lag measured before 17 Oct; 011 fails closed) are agreed. |
| Three-point check accepted | Agree, with R-E (`case_ref`, conditional audit row), which the self-check did not raise. |
| RQ-1 to RQ-4 | Agree on all four. RQ-1 leans further toward "no". |
| E-2, E-3 (KI 22.48), E-4, CR-6 approved, §9 accepted | Agree. Adds the (c) parser formats and the deployed = repo check. |
| Data-Identity conditions | Not assessed by the self-check, which reviewed rev 1.1. **This review: 5 gaps (R-D).** |

---

## 5. For the Main Lane

1. **Rev 1.3 (Operations Lead): R-A to R-E.** All doc-only. A rev 1.3 that meets them needs **only a Main Lane hash check**, not another full review, unless the Founder picks R-A (i). In that case the Data-Identity Lead signs off CR-7b.
2. **Founder, Fri 9 Oct:** the R-A choice, either (i) gate seed and figi in A5 or (ii) accept the risk to 23 Oct with a new Known Issue. Then spec approval.
3. **Build brief:** B-1 (with the zero-read option), B-2, A-3 to A-8, plus this review's §2 notes:
   - CR-5: F6 metric covers both classes; retry inside the window.
   - CR-8: 4 Workers, add delta and figi to the listing.
   - Rollback: reverse order and the extra rows.
   - 011: registration, outbox helper definition, lag measured.
   - `meridian-control` CORS.
4. **Route to the Data-Identity Lead now:** the predicted CR-7 stop (R-C). Their choice of path, gate on the deployed source or a new ACK for the two diffs, should be in hand before Sat 10.
5. **Route to the 011 lane:** registration of `manual.gleif-reconcile-011` and the definition of "outbox live" (§2).

---

## 6. Rev 1.3 check (Fri 9 Oct, same reviewer session type; R-A to R-E only, no new scope)

| Item | Value |
|---|---|
| Spec checked | `claude/MA-OCT-002_Spec.md` **rev 1.3**, re-hashed on disk Fri 9 Oct 05:14 UTC: **`9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893`** (840 lines). Matches `relays/LANE-2_REPORT.md` (`0682a35a…a00a`). The earlier unreported draft `abff1f4c…a9e1` (8 Oct 19:48) is superseded and was not used for this verdict. |
| Inputs | `relays/LANE-6_REPORT.md` `54ac356e…f972` (L6-1, L6-2); 011 rev 1.6 `6f9681ab…4513c` (re-hashed, matches); `App/Ops/migrations/002-ops-control-plane.sql`; `entities-enrich.js:546-556`; `entities-seed.js:485-492`; `entities-figi.js:400-406`; `git show 1b6a7a3` (read-only, `--no-optional-locks`). HEAD `16918e0`, no `.git/*.lock`. 0 D1 reads, 0 writes. |

| # | Verdict | Evidence in rev 1.3 |
|---|---|---|
| **R-A** | **MET** | §1 now lists four Workers with anonymous run routes, including seed `/run` and figi `/run` + `/rematch` (KI 22.49). G6 covers all of them. §10 has gate rows for seed and figi. §17 adds CR-7b with the Data-Identity Lead's sign-off and the Founder's 8 Oct decision. A5 is re-estimated to 0.5 d. The Founder chose option (i). |
| **R-B** | **MET** | §8.5 drops the "remaining blind reader" claim. It now has a table of every blind guard during 17–23 Oct (enrich, seed, figi, delta, holdings) and says how each is closed. The protection is stated as conditional on A5 being live before 17 Oct, with an escalation if it slips. 011 is cited as rev 1.6 `6f9681ab…4513c` by section (§4.3, §4.4, §7, §8, §11), and §21 retires the rev 1.2 line numbers. I checked §4.3 and §4.4 in 011 rev 1.6: the ≤ 70k / ≤ 25k rule, the 120 s freshness limit, fail-closed, and "no Sunday or Monday before 08:00" all match. |
| **R-C** | **MET** | The path is decided as **(ii)** (L6-1), with the stop rule amended to C1: diff the deployed script against a dry-run bundle of the repo. Delta may differ only by the `1b6a7a3` hunk; seed and figi may not differ at all. CR-6 gets the same diff with no allowed difference, and on any difference the build stops and reports to the ETF PL (L2-1). I verified `1b6a7a3` independently. It is the one-line `detail.relationships` → `detail.data.relationships` path fix (MA-SEP-009 Bug 1's twin) in `refreshParentExceptions()`. It does not touch the Bug 2 relationship-follow logic, so "Bug 2 untouched" holds. **ETF PL:** the CR-6 handling is accepted. Dropping the "edit the deployed source" fallback is right for an ETF Worker. |
| **R-D** | **MET** | §8.6(a)3 adds the 3-field layout. §8.6(b) adds unreachable → `error` / `headroom_unavailable` with no `/run` (b8), the spool under gitignored `Corporate Atlas/logs/` (b2), and "live by Wed 14 Oct" (b9). §10.1 adds (1) "MA-SEP-009 Bug 2 untouched" and (3) "401 ×2, `delta_last_run` still absent". §10 now says fail closed on a missing binding, compare in constant time by digest, and that "enrich's `!==` is not the model". C1–C6 are written in as binding. |
| **R-E** | **MET** | §7.2 sets a deterministic `case_ref = 'EXC-S-' ‖ first 12 hex of SHA-256(dedupe_key)`. On `changes = 0` it re-reads by `dedupe_key` and retries with 16 hex. A later sweep then resolves to a dedupe hit through that re-read, so nothing is lost. The audit row is `INSERT OR IGNORE … SELECT … WHERE dedupe_key = ?` with `idempotency_key = 'raised:' ‖ dedupe_key`. Both rely on `UNIQUE` columns that exist in `002-ops-control-plane.sql` (`case_ref` NOT NULL UNIQUE, `dedupe_key` UNIQUE, `idempotency_key` UNIQUE). |

**Result: all of R-A to R-E are met. Rev 1.3 is fit for the Founder's approval on Fri 9 Oct, and no further review is needed.**

**Wording nits (non-blocking; fix in the Build Brief or the next rev, no re-review):**
1. G6 says "401 (the other five)", but four routes return 401: delta `/run`, seed `/run`, figi `/run` and figi `/rematch`.
2. The §10.2 evidence table still says, for delta, "Differs — the 'deployed = repo' condition will stop the build". Under C1 that is now an allowed difference (`1b6a7a3` only), so it should read "Differs by the ACKed hunk (C1)".
3. Below the §10 table, "delta not 17–23 Oct" and "Neither change adds a D1 query" predate CR-7b. C5 governs: none of the three Entities Workers in 17–23 Oct, and none of the four changes adds a D1 query.
4. The header is `Authorization: Bearer`, while enrich uses `X-Enrich-Run-Secret`. That is fine, but the C6 runbook line should name the header so manual callers don't copy enrich's.
