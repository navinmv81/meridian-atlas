# MA-NOV-EXP.BFS.FIX — Report

```text
PACKET:   MA-NOV-EXP.BFS.FIX · Control v1 ee662dcd…8e32 · Task v1 df8cf76c…74ea — hashes verified
PINS:     BFS.REVIEW report f8272b83…2a27, addendum 20fbc060…2049, CR adfc87b1…c911, exp-backfill.js blob 693f7e60 at HEAD 9316644 — all match
RUN:      r-20261120T183102Z-d4d6 (interactive, LANE_OPENER_v2) · role Engineering Lead (Entities domain)
COMMIT:   76d8283 "MA-NOV-EXP.BFS.FIX: per-run limits (M1) and budget overrun stop (M2)" — pushed; ls-remote November-2026 = 76d8283
          exp-backfill.js blob now 43741312073597df9ac56c4769596756e243af6f
OUTCOME:  DONE — M1 and M2 fixed with tests; all suites green; nothing deployed; 0 D1 statements; 0 Ops rows
```

## 1 Changes (`App/Corporate Atlas/src/exp-backfill.js`, +33/−6)

**M1, per-run limits.** These named, documented constants sit in the module header:
- `EXPBF_MAX_BATCHES_PER_RUN = 3`
- `EXPBF_MAX_D1_CALLS_PER_RUN = 12`
- `EXPBF_MAX_ROWS_READ_PER_RUN = 150000`
- helpers `D1_CALLS_PER_BATCH = 3` and `INSERT_PAIR_READ_FACTOR = 1`

How the counting works:
- The run counts D1 calls in the new metric `d1_calls`. It starts at 1 for the controls read, whether the run or the step made that read. Then +1 for the candidates statement, +1 for each count, and +2 for each `batch()`.
- Rows read are already counted in `rows_read_total`.

Before each batch the run checks:
- that `batches + 1 ≤ 3`
- that `d1_calls + 3 ≤ 12`
- that `rows_read_total` plus the previous batch's reads stays ≤ 150,000

After the count, and before any INSERT, it checks that `rows_read_total + 1 × the count's reads ≤ 150,000`. If any check fails, the run ends `partial` with `detail.reason = 'run_limit'` and logs which limit it hit. The most a run can make is 1 + 1 + 3 × 3 = **11** D1 calls.

**M2, budget overrun.** After each batch, if `rows_written > left` (the budget before subtracting), the run stops with `failed` / `EXPBF_BUDGET_OVERRUN` and starts no further batch. This sits alongside the existing 1.25 × projection check and the 50,000-rows-read check.

Nothing else changed: no SQL, packing, guards, budget formula or step wiring.

## 2 Tests

| Suite | Result |
|---|---|
| `tests/exp-backfill.test.mjs` | 20/20 pass: the 16 existing, with the same outcomes, plus 4 new |
| `tests/exp-backfill-wiring.test.mjs` | 7/7 pass, with real Ops ingest |
| All Corporate Atlas `tests/*.test.mjs` | 117 tests: 91 pass, 26 skipped (the skips were there before this change), 0 fail |
| `wrangler deploy --dry-run --config wrangler-entities-enrich.toml` | OK. 34.44 KiB (gzip 9.46 KiB), bindings unchanged (DB `meridian-etf`, OPS_* vars) |

New tests:
- **M1 constants:** 3 / 12 / 150,000.
- **M1 60-fund synthetic (the reviewer's case):** 60 funds × 12,000 holdings × 3 months.
  - Run 1 ends `partial/run_limit` with **3 batches** and **11 D1 calls**. The calls are counted by the adapter, and that count equals `metrics.d1_calls`. 177 holder-months remain.
  - Every later run also stays ≤ 3 batches and ≤ 12 calls. The back-fill completes in exactly 60 runs with 180 coverage rows.
  - Before the fix, one run made 180 batches and 542 calls.
- **M1 rows-read limit, two cases:**
  - (a) Each count reads 40,000. The run stops after the 3rd count, before that batch's INSERTs: 2 batches written, 4 INSERTs issued, total ≤ 150,000.
  - (b) The INSERTs read a lot (≈ 80,000 per batch). The run stops before the 2nd count: 1 batch, `d1_calls` 5.
- **M2 at the 1.24× multiplier:** with cap = the first batch's projection, the run ends `failed/EXPBF_BUDGET_OVERRUN` after 1 batch, and no 2nd count is issued.
  - It wrote more than B but ≤ 1.25 × the projection, so only M2 could have caught it.
  - A cap sweep from 200 to 4,000 confirms that no run writes over its budget without failing, and that there is no false overrun.
  - With cap 50,000, the same 1.24× run does not fail.
- **Mutation check (not committed):** with the M2 condition removed, the M2 test fails. With the batch and call limits raised to 999 and 9,999, the 60-fund test fails. The source was restored before committing.

## 3 Deviations

- **D1 — "the three counters".** Batches (`batches`) and rows read (`rows_read_total`) were already heartbeat metrics, so only `d1_calls` was added. That makes 12 keys (≤ 16).
- **D2 — some existing assertions changed with the limit.** The Task said the existing 16 tests would be unchanged in outcome, and they are, but these assertions assumed one run could do more than 3 batches:
  - B2 identity now takes several run days to finish. Its token check now accepts any `g3v2s-YYYYMMDD-NN` and checks that every run made ≤ 3 batches. The identity result is unchanged.
  - The heartbeat-metrics key list gains `d1_calls`.
  - In `exp-backfill-wiring.test.mjs`, B8 + B9 now expects the Tuesday back-fill to end `partial/run_limit` with 3 batches, 11 calls and 12 metric keys, and real ingest accepts it. The B9 empty_input case runs the days Tue–Sat until the back-fill reports `success`, then fires once more.
  - These changes are the intended effect of M1, not regressions.
- **D3 — how rows read are projected.** The Task said "pre-count reads × ~1 for the INSERT pair". This build does the following:
  - After the count, it projects the INSERT pair at 1 × the count's reads.
  - Before the count, it uses the previous batch's actual reads as the estimate (0 for the first batch).
  - The count statement itself can still read up to the 50,000 per-statement hard stop past the estimate. That would be reads only: no write happens after the limit is passed.
- **D4 — `partial` now carries a reason.** `partial` events now include `detail.reason = 'run_limit'` when a limit stops the run. Ops ingest checks the reason only for `skipped`, and the wiring test confirms the real ingest accepts it (201).
- **Not a code deviation, a planning note.** At 150,000 rows read and ≈ 2.69 reads per holding for each of 3 statements (CR), one full 12,000-holding batch reads ≈ 97k. So on live data the read limit, not the 3-batch limit, will usually allow only **1–2 large batches per run**. The CR's ≈ Tue 8 – Fri 11 Dec completion estimate may slip. BFS.GO / Main Lane should re-estimate from the first live runs' `rows_read_total`.

## 4 Boundaries kept

- Files written: `App/Corporate Atlas/src/exp-backfill.js`, `App/Corporate Atlas/tests/exp-backfill.test.mjs`, `App/Corporate Atlas/tests/exp-backfill-wiring.test.mjs`, and this report.
- Not touched: `entities-enrich.js`, any toml/cron/secret, `*_Status.json`, the board, the Tower, `transitions.jsonl`, `13F Seed/gleif-seed.js`.
- One commit, with the three paths added explicitly. The other modified and untracked files already in the working tree were left untouched.
- No deploy, no D1 statements, no Ops rows, no installs, no subagents.
