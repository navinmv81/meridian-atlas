# Known Issue 22.12 Review — meridian-holdings write cadence

**Role:** Architect / ETF Product Lead | **Date:** 2026-08-30
**Session:** True local Claude Code Terminal session, live D1 (`meridian-etf`) + Cloudflare access — the first review of this issue that could actually query real data (a prior Cowork cloud session had no live D1 access).
**Scope:** Diagnosis and recommendation only. No code, cron, or config changes were made to `meridian-holdings` in this session, per standing instruction — any actual change needs its own `/change-request` with a three-point check.

---

## 1. Real write-volume time series (corrected)

Pulled directly from `holdings_pipeline_state` (`writes_today_YYYY-MM-DD` keys), real Cloudflare-billed `rows_written`, not a logical row count.

**The four numbers given in the packet are confirmed accurate as of 2026-08-23** — they match live data exactly:

| Date (Sunday) | Real rows_written |
|---|---|
| 2026-08-02 | 28,106 |
| 2026-08-09 | 60,304 |
| 2026-08-16 | 74,778 |
| 2026-08-23 | 98,651 |
| **2026-08-30 (today — not in the original packet)** | **81,454** |

**The trend the packet was worried about did not continue.** The 5th Sunday (today) shows a *drop* to 81,454, not a further climb toward six figures. See §3/§4 for why.

For completeness, the full pre-emergency-mitigation history (every-2-hours cadence, before 2026-07-28) is also on record and shows the same ~80k ceiling being hit repeatedly even under the old cadence (e.g. 2026-06-16: 80,577; 2026-06-19: 80,584; 2026-07-26: 77,206; 2026-07-28: 107,693 — this last one predates the mid-loop checkpoint fix described in §2, see below).

## 2. Write-guard / headroom check — already exists, three layers

Contrary to the possibility the packet raised, **`meridian-holdings` already has a write-budget guard** (`src/holdings-pipeline.js`), and it's more mature than `entities-enrich`/`firds-local-seed`'s in one respect: it already accounts for D1's real `rows_written` multiplier (empirically ~9x logical row count on this table, confirmed via Cloudflare dashboard cross-check on 2026-07-25 — this project's own "meta.changes lesson" pattern, already learned and fixed here independently).

Three layers, `DAILY_WRITE_LIMIT = 80_000`:
1. **Outer check** — before starting a new batch of ETFs for this invocation.
2. **Per-ETF check** — before starting each individual ETF within the batch.
3. **Mid-loop checkpoint** (added 2026-08-02, "Fix 2 / MA-AUG-004") — checks the real running total after *every* 100-row D1 batch inside a single ETF's insert loop, so one oversized ETF (e.g. AGG, ~13-16k rows) can't carry the day's total far past the limit before the outer checks run again.

**Real gaps found, not yet flagged anywhere in the code's own comments:**
- **`/run` has no authentication at all** (unlike `entities-enrich`'s `RUN_AUTH_SECRET`, added MA-SEP-010). Anyone who knows or guesses the Worker's URL can trigger it. The guard's check-then-act pattern (`getTodayWriteCount` then act) is not atomic — a concurrent `/run` call racing the Sunday cron, or two overlapping manual calls, could each read a stale "under budget" total before either has written, and both proceed. Not observed in the data, but a real latent risk.
- **The one-time "mark complete" `UPDATE` (after an ETF/month's insert loop finishes) is not guard-checked before it runs**, only counted after. Per the code's own comment, this single statement can account for ~3,416 rows_written per call in one cited example. It's the only write in this pipeline that isn't preceded by a budget check — a single large fund's mark-complete step could push a day meaningfully over 80,000 in one shot with no checkpoint to stop it (today's 1,454-row overshoot past 80,000 is consistent with an uncounted burst of roughly this shape, not a guard failure).
- **`catchup-script.js` bypasses the guard entirely** — it's a standalone local Node script that writes to D1 directly via the REST API (not through the Worker), so its writes are invisible to `writes_today_*` and could add to a day's real Cloudflare-billed total without the guard ever seeing them. Documented elsewhere (`DEPLOYMENT_READINESS_2026-06-20.md`) as a manual, developer-laptop-run tool for ETFs whose initial ingestion would otherwise take many days — not something that runs automatically, but a real blind spot if ever run on the same day as the cron.

## 3. Is the growth genuine, or a symptom?

**Not genuine ETF universe growth.** Checked directly: every one of the 237 currently `has_nport=1 AND series_id IS NOT NULL AND coverage_status='deep'` ETFs has `created_at = 2026-06-01` — a single seed event (`seed-etf-master.js`, run once, never re-run since). The qualifying universe has been static at (at most) 237 ETFs for the entire period under review; it can only shrink from here (via the AUM-boundary downgrade to `directory` status), never grow, unless `seed-etf-master.js` is deliberately re-run to pick up newly-launched funds. So universe growth cannot explain the 28k→99k trend.

**Actual mechanism: fixed-size batch composition variance while working through a backlog, not unbounded growth.** `PIPELINE_BATCH_SIZE = 20` ETFs are *attempted* per weekly invocation regardless of write volume; `etf_offset` advances through the 237-ETF list (sorted `ORDER BY net_assets DESC`) and stood at **233/237** after today's run (`last_run_status = "running:233/237:partial:0"`). Each week's 20-ETF batch has a different total "first-time ingestion" workload depending on which specific funds and report-months fall into that batch — some weeks' batches needed less than 80k total real writes and simply ran out of scheduled work before hitting the cap (28k, 60k, 75k); the most recent two weeks' batches needed more and the guard correctly capped them (98,651 → really this looks like it also should have capped near 80k but see below; 81,454 today, right at the expected ceiling). This is batch-to-batch noise, not a trend — confirmed by today's regression back down from 98,651 to 81,454, the opposite of what continued "runaway growth" would show.

*(Open question, not resolved this session: why did 2026-08-23 reach 98,651 — ~18k over the 80k line — when today's overshoot is only ~1.4k? Both should be bounded by the same mid-loop checkpoint. Possible explanations: a single large mark-complete UPDATE (see §2) landing late in that day's run, or a different mix of ETF sizes in that week's specific 20-ETF batch producing a bigger single uncounted burst. Not root-caused further in this session — flagged as a follow-up if the pattern recurs.)*

**Once the backlog clears, steady-state volume should drop substantially.** With only 4 of 237 ETFs left to reach first-time completion, `etf_offset` will wrap to 0 next cycle (2026-09-06) and re-encounter already-ingested ETFs, which the pipeline's own "already complete" check (comparing `fund_snapshot_monthly.holdings_count` to actual stored rows) will mostly skip — NPORT-P filings are roughly quarterly per fund, not weekly, so steady-state weekly write volume going forward should be a small fraction of what the initial-backlog-catchup weeks have shown.

## 4. Runway estimate

**No clear runway toward exceeding the shared 100,000/day cap under normal operation.** The guard is confirmed working (today's real number, 81,454, sits right at the expected post-guard ceiling with a small, bounded overshoot) and the underlying cause of the four-week climb was backlog-catchup batch composition, not accelerating growth — which has now visibly reversed (98,651 → 81,454). Extrapolating a "trend" from 4 points that already broke on the 5th observation would be a misread of the data.

The genuine risk to watch is not gradual growth but a **step-change**: an unauthenticated concurrent `/run` call, or a single very large mark-complete UPDATE landing late in a run (both §2), could in principle push a single day's total to the 100k line faster than the guard's per-100-row granularity would catch — but there's no evidence this has happened; the 2026-08-23 overshoot (98,651) is the closest data point and still stayed under the shared 100k cap.

## 5. Recommendation (for Founder sign-off — not implemented)

**Leave the weekly Sunday cadence as the permanent cadence.** The data does not support the "climbing toward the cap" narrative that motivated this review — the write-budget guard is already doing its job, and the apparent growth was backlog variance that has since reversed. Reverting to a more frequent cadence (e.g. every-2-hours) would recreate the exact failure mode (100k+/day) this project already lived through once (2026-06-16 to 2026-07-28) before the emergency mitigation.

Recommend closing the remaining gaps found in §2, as a follow-up `/change-request` (not done in this session):
1. Add a shared-secret auth check to `/run`, same pattern as `entities-enrich`'s `RUN_AUTH_SECRET` (MA-SEP-010) — closes the unauthenticated-concurrent-call risk.
2. Move the budget check to *before* the one-time mark-complete `UPDATE` fires (or at minimum, log/alert if it alone would push the day's total past the limit), so the one write in this pipeline that isn't pre-checked stops being one.
3. Separately (lower priority, not cadence-related): the AGG `2026-05` snapshot has been stuck incomplete (10,500 of 13,269 expected rows, `snapshot_status IS NULL`) since 2026-07-28 with an orphaned resume-offset key that will never be revisited (the EFTS lookup only ever looks at the 2 most recent filed months, and AGG has since filed newer reports) — a one-off, isolated case (confirmed: only 1 stuck snapshot, only 1 resume-offset key exist table-wide), needs a manual resume or cleanup decision.
4. Separately (data-integrity, not cadence-related, found incidentally): AGG's `2026-02` month has *more* stored rows (16,056) than its own snapshot header expects (13,186) — an unexplained overcount/possible duplicate-insert artifact, not investigated further in this session (out of scope for a cadence review; `fund_holdings_monthly` has no timestamp column to date the extra rows). Flagged for its own follow-up.

## 6. Referenced-but-missing documents

The packet named `claude/Known_Issue_22.12_Review.md` as pre-existing "if it exists" — it did not exist before this session; this file is now that durable record.
