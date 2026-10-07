# MA-OCT-006 — Operations Lead Close-out Review

```text
REVIEWER:     Operations Lead (spec reviewer for 006; not the executing role)
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
VERDICT:      PASS WITH NOTES
DATE:         2026-10-05 (due Sat 10 Oct)
GATE:         Close-out → Founder gate Mon 12 Oct (006 close; MA-OCT-011 GO / NO-GO / DEFER)
```

## Evidence checked

1. **Hashes, re-computed on the Mac before reading.** All four match the Main Lane's list:

   | File | SHA-256 | Match |
   |---|---|---|
   | `MA-OCT-006_Closeout_Summary.md` | `f54ae3bf814d81916cc1b332a7e5e1f43b507e264fbe220ee950cfaaa7637537` | ✅ |
   | `MA-OCT-006_Evidence.md` | `0d1bbf9b69f1e6a28e3bffe4f07175e500f9293c3ee5adb3f20fbdb526ddb1bc` | ✅ |
   | `MA-OCT-006_Query_Ledger.md` | `c0fce75b36dae2d1ca53af6def4dce20bf084c1b874327528df3a3c405e507dd` | ✅ |
   | `MA-OCT-006_Remediation_Matrix.md` | `db5942247275b450536e5e2370f7e36bd12b389bb4935e9202bfaa6049f33b5a` | ✅ |

   The governing spec (`1dab3539…b273`) and Build Brief rev 2 (`9522a006…11e9`) also match the close-out manifest.
2. **The close-out summary in full**, against spec §10 (all 12 criteria), §6.3 (budget), §6.4 (sample and freshness rules) and §9.2 (011 criteria).
3. **The Query Ledger:** the running totals by day, the "Final totals" table, and every `SCAN` line. The only SCANs are `sqlite_master` (catalogue), `entity_exceptions` (small table, declared) and `SCAN … USING COVERING INDEX` on the queue. **There is no `SCAN entity_master` anywhere.**
4. **Evidence §7, rulings D7-1 to D7-5**, including the lists of affected rows (Evidence §16).
5. **Git state, read with `git --no-optional-locks`.**
   - HEAD is `658326a`, and there are no lock files.
   - The lane's outputs are all untracked files under `claude/MA-OCT-006_*`.
   - Nothing outside `claude/` belongs to 006, and the lane made no git writes.

## Budget (spec §6.3)

| Measure | Result | Limit | Status |
|---|---|---|---|
| D1 reads | **127,238** | stop at 200k; hard stop 250k | ✅ 63.6% |
| Largest single execution | **29,108** (D10, 5 Oct) | 50k | ✅ |
| D1 writes | **0** | 0 | ✅ |
| `SCAN entity_master` | **none** | none | ✅ |
| GLEIF API calls | **52** | 60 | ✅ |
| Work window | the runner refuses before 07:05 UTC | no D1 work 04:00–07:00 UTC | ✅ |

The read helper `d1q.sh` refuses anything that isn't `SELECT`/`EXPLAIN`/`WITH`, and the runner aborts on a forbidden SCAN or on any execution over 50k. That is the right control design for a read-only lane, and it is reusable.

## Acceptance criteria (spec §10)

| # | Verdict | Note |
|---|---|---|
| 1 Classification complete | ✅ | 76,624 / 76,624, 0 unclassified. D2 is within +0.49% of baseline. W rows (3,463) are listed separately. |
| 2 H1–H13 verdicts | ✅ with an accepted deviation | H4 was settled by the 30 Sep tail plus D6, not by 2 and 3 Oct tails. This is covered by ruling R7. |
| 3 F4 attributed | ✅ | Attributed on the 29 Sep queue (26,680 pending vs 26,537 at MA-OCT-000). The in_progress row (H8) and the failed rows (H3) are attributed. The 5 Oct trend shows no status change. |
| 4 F6/F10 in GLEIF terms | ✅ | About 790 lost Phase 3 advances; Level 1 fields frozen for 16,627 rows (delta never ran). |
| 5 Completeness, raw and achievable | ✅ | 5 fields × 4 cuts (Evidence §14.7, §16.4). |
| 6 Relationship check; KI 22.9 as a W row | ✅ | |
| 7 MA-SEP-017 residual | ✅ with an accepted deviation | Answered as a number under R5, not as a close action. |
| 8 Sample adjudication | ✅ by the spec's own fallback | The ≥ 95% bar was missed (357/400 = 89.25%). The failure is reported with the one permitted revision, as §6.4 allows. See note N-2. |
| 9 Freshness | ✅ | 50/50 agreement, within 52 calls. |
| 10 Ledger | ✅ | As in the budget table above. |
| 11 Matrix and 011 decision | ✅ | All ranks filled. All seven §9.2 criteria are answered for both options. |
| 12 Files and git | ✅ | Confirmed from git status. |

## Rulings D7-1 to D7-5

| Ruling | Ops view |
|---|---|
| **D7-1** D6-1 applied to all 9 automated government LEI rows | **Accept.** It is conservative, and the larger count (9, not 6) is explained row by row. |
| **D7-2** the 8 wrong-LEI parent rows re-assessed against the correct LEI; KI 22.43 = 657 | **Accept.** It is consistent with D6-5, and the 4 removed W rows are listed. |
| **D7-3** sample re-synced to 357/400 | **Accept.** The fall is expected from routing government rows to a reviewer, and the record is honest. |
| **D7-4** `etf_offset` and `last_run_status` added to D8 | **Accept.** Cost 21 reads. The path correction (`src/`) is recorded. |
| **D7-5** transient wrangler error 7403 after `npx` fetched 4.147.0 instead of the session's 4.96.0 | **Accept** (0 reads charged). **But this is an operational finding; see N-1.** |

## Notes (binding where marked)

**N-1. Wrangler version drift is a live hypothesis for F6 (binding: goes to the F6 known issue and to 002).** D7-5 shows `npx` silently fetching a different wrangler version from the logged-in session, and that version failing with an auth error. The boost runner also calls `npx wrangler d1 execute` (`entities-enrich-boost-run.mjs:217`), and F6 is a pure auth failure (36 of 36 `[code: 10000]`) that has also occurred with the network healthy. Requirements:
- **(a)** The F6 owner checks which wrangler version the boost runner's `npx` resolves under launchd, against the version the OAuth login was made with.
- **(b)** Every local job and every read lane pins one wrangler version and never lets `npx` fetch another. The Main Lane's task-B rule already says this; it should become standing.

**N-2. Use the classification counts with care in 011 (binding on the 011 spec).** The rule engine missed its 95% agreement bar. The miss is in the direction of **under-counting** recoverable LEIs, not mislabelling them, and the T1 high-confidence tier has 150/150 precision (lower bound 98.02%). So:
- The 011 spec may size and write **only from the high-confidence tiers**: T1 4,109 rows / 3,717 LEIs, RR parents 1,529, and hydration.
- Medium tiers (T1_LAPSED, T1+/T1c, the D5-3 and D5-4 cases) need either their own sample adjudication or manual review before any write.

**N-3. Criterion 1 unit (D6-6): Ops supports counting (entity, field) gaps.** §9.2 criterion 1 says "parent gaps (direct or ultimate)", which reads naturally as gaps, not entities. 1,529 gaps clears the 1,000 bar. By entities (812) it would not. The Founder confirms at the gate, as the close-out says.

**N-4. 011 write budget and observability (binding on the 011 spec; Ops sign-off condition).**
- **Write budget.** Option 1 at about 100,373 writes is more than a day's whole D1 cap. Whatever the amended criterion 4 says, the 011 spec must have:
  - a **multi-day plan of ≤ 40k row-writes per day**, with no runs on Sundays or on Monday before 08:00 UTC (holdings and seed);
  - a **mid-loop budget checkpoint**;
  - a kill switch checked between batches;
  - an idempotent, resumable cursor.
- **Observability.** Criterion 6 is "PASS (conditional)" for good reason: the pilot lost 2 of 7 terminal events. **011's bulk job may not start until MA-OCT-002's guaranteed local delivery (the outbox) is live**, or the job writes its own run log and the Operations Lead reconciles it against `ops_job_run` after each day's batch.

**N-5. New pilot defects, beyond the MA-OCT-001 close-out window (carried to 002).**
- **Out-of-window fires report `success`.** Two out-of-window fires called `/run` and reported `success`, although Phase 3 couldn't run. The A1 enum already has `skipped` with `reason=out_of_window`. The pilot emitter sends the flag in `detail` but not as the event type. Fix it in 002 together with the `trigger='manual'` fix, under the same Data-Identity Lead sign-off.
- **A fire was missed with no trace** (4 Oct 16:50). This is what 002's lateness and missed-fire detection must catch.
- **Delivery losses:** 2 of 7 terminal events not delivered so far, against 1 of 4 in the 001 window. This reinforces the 002 outbox requirement. The rate is trending wrong and needs the fix before more emitters are wired.

**N-6. R4 retention under DEFER (for the Main Lane to confirm).** Ops agrees with the proposed reading: DEFER is treated as GO for retention. Add an **expiry**: if 011 is not opened by 31 Oct, delete `gleif_006.db` (3.69 GB) under the NO-GO rule. The rebuild source (the 4 zips in `gc/`) can be kept until then, or deleted with it.

**N-7. MA-OCT-013 (duplicates) sequencing.** Ops agrees it is a separate packet sequenced before or interleaved with bucket A. Its write cost (≈ 37,836 plus unmeasured repoints) needs measuring before its spec is approved. It is a merge across referencing tables, so it carries the highest data risk in the matrix.

## Recommendation to the Founder (12 Oct gate)

- **Close MA-OCT-006.** The investigation is complete, read-only, within budget, and its findings are evidenced and routed.
- **MA-OCT-011:** Ops does not oppose the 006 recommendation (Option 1 DEFER under the current wording, or GO with the 011 lane's amended criteria 4 and 5; Option 2 GO as the fallback). **Either GO is conditional on N-2 and N-4.**

## Required before approval

None. N-1 to N-7 are carried as conditions on later packets: the F6 known issue, 002, 011 and 013, and the Main Lane for N-6.
