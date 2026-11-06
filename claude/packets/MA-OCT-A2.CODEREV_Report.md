# MA-OCT-A2.CODEREV — Report (REVIEW-A, Architect)

- **Control:** v1 `029d49610713a2fc1bce99dc700c2d1ab67fd046b6649a5e5608952b7d050e2c`, verified on disk and against the STATUS_BOARD row.
- **Task:** v1 `6579adbbba4a41a7582c63b0fee476c747fe2f659ae53359a829db478fabbba7`, verified.
- **Opener:** folder and branch `October-2026` confirmed; no `.git/*.lock`.
- **Governing inputs:** all verified (spec, Architect and Ops reviews, BUILD report, run docs, FREEZES `4d8202bb…`).
- **Review:** `claude/MA-OCT-A2_Code_Review.md` sha256 `60e0938f93e69e7addda434ae1a300d59af63a8676c53e43ec488cf77c856a3d` (final).

## Verdict

**PASS WITH NOTES. 0 BLOCKER, 3 MUST-FIX before run, 10 NOTES. The Sat 31 run may proceed** once MF-1..MF-3 are each closed, by code or by their compensating run-sheet control, and the Data-Identity Lead concurs on L-A2-1.

| # | MUST-FIX | Close by |
|---|---|---|
| MF-1 | **C-4 can be bypassed with a hand-edited plan.**<br>- A padded string id `" 2303"` evades the check, and SQLite coerces it, so the row matches (verified with `sqlite3`).<br>- An `em_insert` under step A is not inspected.<br>**Fix:** integer-only ids, plus kind-per-step. | Code + 2 tests + suites green + delta hash to REVIEW-A; **or** a plan-SHA = Founder-GO-SHA check before every `run` |
| MF-2 | **G-2 gate:** a G-2 file missing `errors` or `ops_spot_check` writes `holds/g2-stop.json`. That is a false STOP, which under Q3 means "defer A2". Probed. | Code (STOP only on an integer > 0); **or** the `jq -e` pre-check in review §4 before the pilot |
| MF-3 | **G-4:** exit 4 still writes a pinned, runnable plan. | Run sheet: any non-zero `generate` exit = STOP; the G-4 check records `plan.a2.g4.ok = true` and `g2_sample_sha256 = 8d3dc22b…` |

**L-A2-1:** the Architect accepts the currency-name FUND clause.
- It keeps the pinned exclusions file `ac1c1572…` and the 28 total unchanged.
- The Data-Identity Lead's view is **not yet available** (FRI30.DIL READY, no report). The ruling becomes final on that concurrence.
- If the Data-Identity Lead rules 2488 out of R-FUND instead, the exclusions file's SHA and the code constant change, and I need a delta review.

## Evidence

- **Reproduction:** patches 00–05 applied to `git archive` of HEAD `1a59b77` reproduce all 7 files byte-identically. The 011 files are unchanged since `71fab4b`; core is `830b49a8`.
- **Suites, re-run by me:** A2 **21/21**, 011 **42/42**, 0 skipped, node 24.14.1.
- **Recomputed from dry-run plan `d1cb5abb…`:**
  - A / ECA / EA / Q = 3,648 / 44 / 296 / 3,648;
  - 31,607 writes;
  - rules 24 / 1 / 5, union 28, STOP ok;
  - Sat cap: A-001..A-011 + Q (23,117); A-012 refused at 25,184.
- **C-7 / C-2 probes:** the allow-list and the job-id pattern refuse loose and injected values.

## Corrections for the Main Lane

- **N-5:** the practical last batch start on Sat is before **21:00Z**, because of the runner's run windows. The Sat band list in D-4 is incomplete.
- **N-6:** FREEZES `4d8202bb` is already committed at `1a59b77`. Drop the "commit FREEZES `9c368fa6…`" line from the A2 commit list.
- **N-8:** schedule the post-run verification export.

## Hygiene and log

- **Read-only:** 0 D1 reads or writes, 0 GLEIF calls, no `wrangler` calls (none were needed), no deploys, no commits, no code edits in the repo or the A2 worktree. No production change was made, so there is no "starting <change>" entry.
- **Secrets:** none read (ML-1024-1). No macOS permission prompt.
- **Scratch:** all scratch work (HEAD archive + patches, probes) is under this session's scratchpad. Test temp dirs are in the OS tmpdir.
- **Writes:** only these two files.
- **Clock:** the Mac clock read 06:53Z at the start and 14:18Z at the end. It jumped during the run (the machine slept); the times are from `date -u`.
