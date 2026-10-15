# MA-OCT-011 — Operations Lead Spec Review (with MA-OCT-013 brief)

```text
REVIEWER:     Operations Lead (LANE-1-OPS; not the spec author)
PACKET:       MA-OCT-011 — offline GLEIF reconciliation (spec rev 1.7), with MA-OCT-013 spec brief rev 1.5
VERDICT:      PASS WITH NOTES. Four doc-only required items (R-1 to R-4) before the build brief; no new review needed.
DATE:         2026-10-09 (due Sat 10 Oct)
GATE:         Spec approval and 011 GO / NO-GO / DEFER (Founder, Mon 12 Oct)
```

## Evidence checked

| File | SHA-256 (re-hashed on disk before reading) |
|---|---|
| `claude/MA-OCT-011_Spec.md` rev 1.7 | `304628940eec41b2df605fc94ddeb8d5c49036752c5fd49a14ffaad4142cadf0` ✔ (matches NEXT; LANE-11 confirmed final) |
| `claude/MA-OCT-013_Spec_Brief.md` rev 1.5 | `8319cc092aef020f7239c0fc5643f578f028ef971ff71453395b62088d7b2085` ✔ |
| Basis | 006 Ops Review `8ac07234…763e` (N-2, N-4, N-6, N-7); OPS-R2 / OPS-R3 (8 Oct, `e3917e76…5fea`); OPS-R4 to R6 (9 Oct, `7d50ed07…c70f`); 002 rev 1.3 `9ec6773a…3893` |

**What I read:**
- 011: §1–§13 in full, plus the §3.0 tier table, the §4.3 N-4 mapping, §4.4 calendar, §6 three-point check, §7 control surface, §8 live-job interactions, §9 verification, §10 rollback, §11 acceptance criteria and timeline, §12 dependencies, and L11-16.
- 013: the brief in full.

0 D1 reads, 0 writes, no git writes.

## Conditions traced (all present in rev 1.7)

| Condition | Where in 011 rev 1.7 | Status |
|---|---|---|
| **N-2** high-confidence tiers only | §3.0 tier table. Every write line is mapped. The "never written" list covers T1_LAPSED, T1+/T1c, N+, D5-3, D7-2 and the 9 D7-1 government rows. §11 AC requires a tier tag per statement. | ✅ |
| **N-4** budget and controls | §4.3 N-4 table: ≤ 25k a day (under 40k); no Sunday, Monday before 08:00 or enrich window; per-batch checkpoint; kill switch before every batch; CAS / `INSERT OR IGNORE`; resumable cursor; 1.3× stop | ✅ |
| **N-4** observability | §7 gate: the outbox is live at bulk start, otherwise the run log is reconciled daily, weekends included. The pilot counts as a start. | ✅ (mechanics: R-4) |
| **N-6** retention | §12: the DB is deleted on 31 Oct if 011 hasn't opened. GO keeps it until 011 closes. A new publication re-runs the tiers. | ✅ (013 gap: R-3) |
| **N-7** 013 measured before approval | 013 brief: a pre-spec measurement pack, cap 25k / 35k reads, abort on SCAN, measured R replaces the 10k placeholder | ✅ |
| **E-1** LEI-only parents with exclusions | §3.1 | ✅ |
| **E-2** no edge without its A write | §3.1 | ✅ |
| **E-3** ≥ 25 E-A edges in the sampled diff | §9 | ✅ |
| **E-4** automatic drop | §3.1, §9 | ⚠ **Timing gap: see R-1** |
| **E-5** direct only | §3.1 / L11-9 | ✅ |
| **F-1 to F-3** | §4.3 | ✅ |
| **F-4** A4 lag recorded before the pilot | §4.3, §11 release check | ✅ (OPS-R4 X-7's ENT-CR1 sample counts towards it) |
| **F-5** re-rule if lag > 10 min | §4.3 | ✅ |
| **OPS-R6** T-1 registry + key, T-2 pause row | §7, §8, §11 | ✅ (wording: N-1 below) |

## Three-point check

| Point | Spec | Ops view |
|---|---|---|
| (i) Index audit | §6 X1–W4, V3–V4. All SEARCH on PK or `idx_entity_master_lei`, except V4 (covering index on the queue, as 006 D10). Aborts on `SCAN entity_master`, the queue or `fund_holdings_monthly`. V3 is computed locally, not on D1. | ✅ No unindexed sort, so the 9 Oct temp-B-tree rule doesn't apply. |
| (ii) Single execution | Largest: an X1 page ≤ 5k. A 250-statement CAS batch ≤ 1k. Abort over 50k. | ✅ |
| (iii) Declared budget | Every `d1 execute` declared in the plan; stop at > 1.3×; multipliers > 20% over §4.2 mean re-plan within 110k or Architect re-review | ✅ |
| Read budget | ≈ 195k planned, 250k ceiling, over 6 days | ✅ Under 1% of a day's 5M cap on any day. |
| Write budget | ≈ 86.5k expected (89.2k ceiling case), ≤ 25k a day by 011, account ≤ 70k, 110k hard ceiling | ✅ |

**Calendar against the account gate:**

| Day | Other writers before 011 | 011 writes | Account total |
|---|---|---|---|
| Mon 19 Oct | seed ≈ 34k (28 Sep 34,331; 5 Oct 33,097) | ≈ 23.4k | ≈ 58k ≤ 70k ✅ (the ≤ 45k start rule also holds) |
| Sat 17 Oct | none | ≈ 5.2k | ✅ |
| Tue 20 – Thu 22 Oct | small | each ≤ 25k | ✅ |

No overlap with the ENT-CR1 window (Tue 13). 008 is frozen 17–23 Oct (008 §12.3).

## Required before the build brief (doc-only; Main Lane hash check, no new review)

**R-1. Close the E-4 timing gap.**
- §4.4 puts A on Wed 21–Thu 22 and E-A on Thu 22. The Sat 17 pilot holds no A rows (P + B only). The post-run sampled diff compares against `gleif_006.db`, the plan's own source. So it checks execution, not identity.
- As written, a wrong T1 identity could only surface **after** E-A is written.

**Edit:**
- **(a)** At the Fri 16 Oct freshness gate, stratify the ≤ 50 GLEIF calls so that **≥ 15 are A rows**. Any A identity mismatch (LEI not matching the entity's legal name or country) is an **E-4 trigger evaluated before any A or E-A write**.
- **(b)** On Thu 22, the E-A batch runs only after every A batch's read-back diff has passed and no E-4 trigger is open.
- **(c)** The 25 post-run API spot checks include ≥ 10 A rows. A mismatch there triggers E-4's delete path.

**R-2. Retain the rollback inputs independently of `gleif_006.db`.**
- Per-batch rollback (§10) needs the pre-images, the plan file, the checkpoints and the run log, not the Golden Copy.
- **Edit:** these stay in `~/MeridianAtlas-work/gleif-011/` (not iCloud-synced) for **≥ 30 days after 011 closes, and until 013 closes, whichever is later**. Their SHA-256s go in the close-out. Deleting `gleif_006.db` under R4 / N-6 doesn't touch them.

**R-3. Make 013 independent of `gleif_006.db`.**
- 013 writes "the 9 deferred LEIs onto survivors (as 011 A, including Level 2)". Those Level 1 and Level 2 values come from the Golden Copy, but under R4 the DB is deleted when 011 closes, before 013's build (about 26 Oct or November).
- **Edit (011 §11 hand-off, and 013 brief):** the 011 close-out exports the **full write payload** (Level 1 and Level 2 values plus GC provenance) for the 9 deferred LEIs / 22 rows into the 013 hand-off file, with its SHA-256.
- 013 writes from that file, plus a ≤ 10-call GLEIF freshness re-check at its run. It never writes from a rebuilt DB without re-running the tiers (N-2).

**R-4. Spell out the daily reconciliation mechanics (fallback path).**
- The Operations Lead lane is Cowork, so it can't read D1 or the Access-protected admin route.
- **Edit (§7):** on each run day, weekends included, the Engineering Lead exports that day's `ops_job_run` rows for `manual.gleif-reconcile-011` (the indexed history query from the 001 Q5 pattern, ≤ 300 reads) plus the run log `runlog.jsonl`, both with SHA-256s, to `~/MeridianAtlas-work/gleif-011/recon/<date>/`.
- The Operations Lead reconciles from those files and signs a one-line result in a relay report by 09:00 UTC the next day.
- **An unsigned day blocks the next day's first batch.**

## Notes (non-blocking)

- **N-1. Wording.** §7 and §11 say the registry row and emitter key are "executed by the Operations Lead". Per OPS-R6, the Operations Lead **authorises and verifies**, and LANE-1-ENG **executes** (a reviewed `wrangler --file` batch with an `ops_case_event`, and a `wrangler secret put` with the new Worker version recorded). The secret change also needs Architect review (§7 already says so). Please align the wording.
- **N-2. Registry values.** Each batch is its own run (start and end), so set `expected_max_duration_s` for `manual.gleif-reconcile-011` from the **batch** plan, e.g. 900 s, not the day. Otherwise 002's lost-run rule won't fire on a hung batch.
- **N-3. Change freeze during the run window.** No `meridian-ops` deploys or `OPS_INGEST_KEYS` changes on 17–23 Oct except an emergency rollback. The heartbeat path and the registry are the 011 observability record. The same applies to Entities Workers (enrich, seed, figi, api), so the live-job interactions in §8 stay as reviewed.
- **N-4. Full rollback.** ≈ 85–88k writes is 4 run days at 25k under the same gates, so it can't be same-day. Per-batch restore is the default response. A full rollback is a Founder decision, taken on Ops and Architect advice, and would run 26–29 Oct.
- **N-5. 013 measurement pack.** The `GROUP BY entity_id` over an `IN` list may add a temp B-tree for grouping. The 9 Oct rule counts those rows, but at ≤ 500 ids per chunk the effect is small. The declared 25k / 35k caps stand. Record the measured reads, not only R.
- **N-6. 013 run gates.** "Under the same gates as 011" should be written out in 013's spec as: the `d1-today` gate with F-1 to F-5, ≤ 25k a day, the observability gate (outbox or daily reconciliation per R-4), and the freezes. 013 is ETF-visible (exposure repoints), so the ETF Product Lead's review stays required.

## Recommendation to the Founder (Mon 12 Oct)

- **Ops supports approving the 011 spec, and GO on Option 1 under the amended §9.2 wording.** That is conditional on R-1 to R-4 being on disk before the build brief, and on the Fri 16 Oct release check passing:
  - outbox live, or R-4 reconciliation in place;
  - A4 lag recorded (F-4/F-5);
  - registry row and key live (T-1);
  - pause row present (T-2);
  - fail-closed test passed.
- **E-A: keep**, under E-1 to E-5 and R-1. The drop path (−1,196 writes) remains the Founder's option.
- **Fallbacks Ops can also support:** partial GO (B + C, ≈ 57k), or 006's Option 2 (≈ 10k).
- **013:** Ops supports the brief as the basis for its spec lane. Spec approval stays blocked until the N-7 measurement (after ENT-CR1 on Tue 13) and R-3.

## Required before approval

None for the Founder's 12 Oct decision. R-1 to R-4 are doc-only edits before the build brief.
