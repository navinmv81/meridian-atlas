# MA-OCT-008 — Operations Lead Spec Review

```text
REVIEWER:     Operations Lead (LANE-1-OPS; not the spec author)
PACKET:       MA-OCT-008 — SEC corporate-bond ingestion (spec rev 1)
VERDICT:      PASS WITH NOTES
DATE:         2026-10-09
GATE:         Spec approval (Founder, Mon 12 Oct)
SPEC:         claude/MA-OCT-008_Spec.md rev 1, SHA-256 f3a350c1d65eff203765154e33c76590ce33ac601ad77783725bba0399551adb (re-hashed on disk; matches NEXT)
```

## Evidence checked

- Spec rev 1 in full for the Ops scope: §0, §8 (tables and writes), §9 (runner, gates, Ops reporting), §11.2 (Pack C), §12 (budget, three-point check, freezes), §15 (requirements, acceptance criteria, test plan, rollback) and Appendix B.
- Cross-checked against:
  - 001 contract v1 as amended by A1 (`claude/MA-OCT-001_Build_Brief.md`);
  - 002 rev 1.3, `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893` (§8.5 `d1-today`, outbox, wrangler pin);
  - my 006 Ops review N-1 and N-4;
  - OPS-R3 F-1 to F-5 (`claude/relays/LANE-1-OPS_REPORT.md`, 8 Oct).
- 0 D1 reads, 0 writes, no git writes.

## Assessment

The design is operationally sound, and the right shape for this platform:

- It is a **local manual runner**, so it uses no cron slot (still 5/5) and avoids Worker CPU and subrequest limits.
- **The writes are small:** about 3.8k for the initial load, declared at 6k, with a hard ceiling of 8k. Steady state is under 500 per run.
- **It writes only two new Entities-domain tables**, through one writer.
- **Writes are idempotent:** `INSERT OR IGNORE` on the primary key, batches of 100 or fewer.
- **Reversal is cheap:** a full rollback is two small-table drops.
- **Pinned wrangler** 4.96.0 by absolute path, so there is no `npx` drift (006 N-1).
- **A full control surface:** freeze, hold, pause, stop, headroom gate that fails closed, and a 1.3× declared-budget stop.
- A **mandatory dry run** with 0 writes before the first live write.

The acceptance criteria cover every Ops path: AC6 re-run with 0 writes, AC7 stop, AC8 headroom unavailable, AC9 freeze, AC10 plans, AC13 ledger.

## Budget and three-point check

| Item | Spec | Ops view |
|---|---|---|
| Initial load | ≈ 3.8k writes, declared 6k, stop at 7.8k, ceiling 8k | ✅ About 8% of one day's cap. A single day is fine, given the 70k account gate. |
| Steady state | < 500 writes, < 300 reads a run | ✅ |
| Multipliers | 4 writes per tranche, 3 per issuer, 2 per audit row | ✅ Plausible. The 001–006 measured range was 2.56–3.69×. **Record measured multipliers on the pilot** (N-1). |
| Largest single execution | ≈ 2k (009 coverage aggregate) | ✅ Far below 50k. |
| Index audit | Every runtime statement is a SEARCH; `bond_issuance` small-table scan allowed (≤ about 2k rows); Pack C aborts on `SCAN entity_master` | ✅ |
| Pack C | ≤ 150 reads, 0 writes | ✅ Pre-approved at that budget, under the standard read-lane rules. |

## Required before build (doc-only edits; Main Lane hash check, no new review needed)

**R-1. Use contract v1 as amended by A1.**
- §9.4 still says `items_processed`. Replace it with `items_attempted` (filings examined) and `items_progressed` (filings that produced at least one new row). If they can't be told apart, send `items_attempted` only.
- `detail.metrics` must be flat integer counters: at most 16 keys, each key at most 32 characters, within 2 KB. Counts by `filing_status` fit this.

**R-2. Use the A1 `skipped` reason codes.**
- §9.3 gate 2 should send `reason=hold`, not `hold`/`paused` as free text.
- Gate 3 at start should send `reason=pause`.
- A freeze-window refusal should send `skipped` with `reason=out_of_window`.
- Mid-run pause or stop stays `partial` or `killed`, which is correct.

**R-3. Name the `hold_all_jobs` source.**
- `meridian-ops` has no route that returns `hold_all_jobs` today. 002's sweep route will, after A3.
- Specify: read it from the 002 sweep or admin route if live, **otherwise** with one primary-key read of `holdings_pipeline_state` through the pinned wrangler. That is a read-only cross-domain read and is allowed.
- **If it can't be read, fail closed:** `skipped`, `reason=hold`, with the detail "unavailable".

**R-4. Adopt OPS-R3 F-1 to F-3 for the `d1-today` gate**, the same as 011. They apply to every consumer of `d1-today`:
- F-1: "unpolled rows" means this run's rows in the last 15 minutes or since the previous fetch, whichever window is longer.
- F-2: within one UTC day, if `rowsWritten` drops below the previous fetch, fail closed.
- F-3: no batch starts between 23:50 and 00:10 UTC.

Also state the 120 s fetch-age bound and the date check explicitly. §9.3 says "stale" without defining it.

**R-5. Add to the §12.3 freezes:**
- **Tue 13 Oct 08:05–10:30 UTC**, or the Wed 14 Oct fallback (ENT-CR1 window);
- **the boost slots, 10:50–10:59 and 16:50–16:59 UTC**, a cheap separation from the boost's headroom read;
- **any window the Main Lane declares in a relay NEXT file**, read at start.

## Notes (non-blocking)

- **N-1. Measure on the pilot.** Record `rows_written` per statement type on the 3-issuer pilot. If any multiplier is above 4.5×, re-declare the initial load before step 6.
- **N-2. Observability.** I accept §9.4: a local outbox where 002's module can be imported, otherwise reconciliation of the run log against `ops_job_run` by the Operations Lead after **each** live run. I commit to that reconciliation.
- **N-3. Registry and key.** `local.bonds-ingest` needs a registry row and a `local-bonds` entry in `OPS_INGEST_KEYS` before the first live write. That is a `wrangler secret put` and a new `meridian-ops` version.
  - The **Operations Lead authorises** both, and the build lane executes them. The key file goes in a gitignored `bonds/state/.env.ops-ingest` or the existing `App/Corporate Atlas/.env.ops-ingest`.
  - Record the new Worker version in the close-out.
- **N-4. SEC identity.** The User-Agent includes the Founder's email, as SEC requires, and the Founder approved it on 4 Oct. It is read from an env var, so keep it out of committed files.
- **N-5. 009 coverage aggregate.** The `GROUP BY` small-table scan is acceptable up to about 2k rows. Re-check it if `bond_issuance` passes 20k rows (Phase 2 expansion).
- **N-6. Rollback** (§15.4) is adequate. A parser-version `DELETE` is a small write, but it still runs under the headroom gate.

## Required before approval

None beyond R-1 to R-5 as doc-only edits before the build. **Ops supports Founder approval on 12 Oct** for the spec, the seed list (Q1) and CR1 (Q3). Q2 (ingest unmatched issuers with a DQ ticket) is also supported, because it creates no wrong-issuer links.

## Addendum (LANE-1-OPS, Fri 9 Oct, second pass): provenance and two additions

**Provenance.** This file was already on disk at 05:23:30 UTC on 9 Oct, as SHA-256 `101e16b4e96f7f1eab9342df6ac12739f67c06436d12b0e5c9a0274c32b02f87`, before this LANE-1-OPS session started its task. Its author isn't recorded. This session re-checked every finding above against spec rev 1 `f3a350c1…1adb`:
- §9.4 does still say `items_processed`;
- §9.3 gates 2 and 3 do use free-text `hold`/`paused`;
- §9.3 does leave "stale" undefined;
- §12.3 does lack the ENT-CR1 and boost windows;
- §12.1 budget figures match.

**The Operations Lead adopts the review above as the 008 Ops review, unchanged, plus A-1 and A-2 below.**

**A-1 (required, added to R-4).** The first **live** 008 run, not the dry run, waits until the 002 A4 analytics-lag measurement is recorded (OPS-R3 F-4). If the measured lag is over 10 minutes, the F-5 re-rule applies: the account ceiling drops from 70k to 60k, and the F-1 window becomes the lag plus 5 minutes. This is the same gate as 011, because both consume `d1-today`.

**A-2 (note).** §12.3 freezes Sunday only for 04:00–07:05 UTC. A Sunday run later in the day is allowed, but it will normally be blocked by the 70k account gate after holdings (about 70k written on 27 Sep). That is correct, fail-safe behaviour. Plan the initial load for a weekday (Tue–Fri) so it isn't wasted.

**Verdict unchanged: PASS WITH NOTES.** The required items are R-1 to R-5 plus A-1, all doc-only edits.
