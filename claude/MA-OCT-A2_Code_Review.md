# MA-OCT-A2 — Architect Code Review of the A2 build (C-3 / C-4 focus)

```text
ISSUED BY:    Main Lane — MA-OCT-A2.CODEREV Control v1 029d49610713a2fc1bce99dc700c2d1ab67fd046b6649a5e5608952b7d050e2c
              Task v1 6579adbbba4a41a7582c63b0fee476c747fe2f659ae53359a829db478fabbba7 (both verified; Control = STATUS_BOARD row)
EXECUTED BY:  REVIEW-A (Architect), Fri 30 Oct 2026, Claude Code, read-only. 0 D1, 0 GLEIF calls, no wrangler, no deploys,
              no code edits in the repo or the A2 worktree, no commits, no secret files.
VERDICT:      PASS WITH NOTES. 0 BLOCKER, 3 MUST-FIX before run, 10 NOTES.
              The Sat 31 run MAY PROCEED, once MF-1..MF-3 are closed by code or by their compensating run-sheet control.
```

**Independence.** LANE-11-ENG wrote the code, and LANE-11 wrote the spec and the DIL29 lists. I wrote none of them.

## 0. Inputs (all SHA-256 verified)

| Input | SHA-256 | |
|---|---|---|
| A2 spec rev 0 | `226d07db…7842d` | ✔ |
| A2 Architect review | `c95b07a7…6b36` | ✔ |
| A2 Ops review | `883e1760…c47c9e` | ✔ |
| A2.BUILD report | `e2cf858e…caa0` | ✔ |
| A2.BUILD run docs | `ce539336…25e7` | ✔ |
| FREEZES.json (disk = `HEAD:` at `1a59b77`) | `4d8202bb…d7fc` | ✔ (A2 window: Sat 31 07:10Z → Sun 1 00:10Z) |
| Patches 00–05 | `89186aab`, `cc7ac4aa`, `b6fd3568`, `2c29fce5`, `a6a4e8de`, `e679d4cb` | ✔ (= report §1) |
| Worktree files, 7 | `4ab39e78`, `415dd1a9`, `e84be008`, `910fe99f`, `46cf7e37` (+x), `850f946a`, `d7e44849` | ✔ (= report §7) |
| Dry-run plan / G-2 sample | `d1cb5abb…` / `8d3dc22b…` | ✔ |

**Reproducibility.** I took a `git archive` of `October-2026` HEAD `1a59b77` and applied patches 00–05 in order into my scratchpad. All 7 files came out **byte-identical** to the worktree, and the wrapper keeps its +x bit. The 011 files are unchanged between `71fab4b` and `1a59b77`: core is still `830b49a8`, which equals spec §0. The patches therefore apply cleanly to the branch as it stands now.

## 1. Test suites (re-run by me, in my scratch copy, node 24.14.1)

| Suite | Result |
|---|---|
| `tests/gleif-reconcile-a2.test.mjs` | **21 / 21 pass**, 0 fail, 0 skipped |
| `tests/gleif-reconcile-011.test.mjs` | **42 / 42 pass**, 0 fail, 0 skipped (HAVE_006 inputs present). This includes the full simulated run, the §9 checks and the full rollback. |

My first attempt ran from a scratch copy that lacked `claude/MA-OCT-006_classification.csv`, and its dry-plan tests failed with "basis input missing". I added the file from `HEAD` and re-ran both suites, with the results above.

## 2. Review by item

| Item | Finding |
|---|---|
| **C-3 `generate --a2`** | **Correct.** It needs a fresh keyset export, so the D2 export is refused. `--base` must be the released 011 plan `e3854698…`. The exclusions file is SHA-pinned. Only A, ECA, EA and Q are planned: B, C, CR, RC-15, P and E-C loops get empty inputs. The A base is 011's T1 set, and A2 does not re-match names. |
| — R-LF / R-CUR / R-FUND | They match DIL29 §3. R-LF is form-sensitive, maps PUBLIC LIMITED COMPANY to PLC, clears a row on a matching other or previous name, keeps the 87745 deny, skips form-less and non-Latin names. R-CUR uses the currency-name pattern. R-FUND compares the exact normalised name. The DIL29 fixtures (29 + 16 + 42) reproduce the verdicts in the tests. **Dry run: 24 / 1 / 5, union 28, STOP ok, 0 missing.** |
| — STOP rule | **Correct and fail-closed.** An extra id, or an expected id that is present but not hit (drift), means exit 3 and **no `plan.json` is written**. An absent id is listed and allowed. The generator also excludes the union of the rule hits and the file list. |
| — F-2 re-compute | **Correct and never widens.** ECA is 011's own released ECA set, re-validated row by row against the fresh export. It is dropped if the child is absent, the child LEI changed, the mirror changed, the parent is excluded, the parent is not an A2 target, the parent LEI is already held, or RR no longer confirms the parent. Each ECA statement depends on `A:<parent eid>`. EA drops edges to an excluded parent, and lists excluded children (`ea_child_excluded`). |
| — Q paired with A | **Correct.** A-k is followed by Q-k for exactly A-k's rows. A Q statement without its A statement throws. ECA, then EA, come after all A batches. In A2, a Q batch needs the pilot adjudication, like A. The E-2 filter keeps only Q statements whose A statement applied. |
| — per-day cap | **Correct.** An A batch's gate reserves A + paired Q + both batches' events. I recomputed it from plan `d1cb5abb`: cumulative is **23,117 through A-011 + Q-011**, and A-012 needs **25,184 > 25,000, so it is refused**. This equals RunDocs D-4. |
| — G-4 limits | Computed and recorded. **But exit 4 still writes a pinned, runnable plan.** See **MF-3**. |
| **C-4 excluded-id assertion** | **Sound in design, but I broke it twice (MF-1).** The ids come from the SHA-pinned DIL file, not from the plan. The check runs in `cmdRun` before each batch (stopped `hold`, 0 writes) and again in `executeBatch` after the E-2 filter (it throws). Any non-A2 step is refused. A plan pinning a different exclusions SHA is refused. Running the 011 release plan under the A2 job is refused, by step and by G-2. Probes are in §3. |
| **C-7 own-freeze allow-list** | **Correct.** Only `011 run window` and `A2 run window` are accepted, and the default is unchanged. `"A2"`, `""` and `"A2 run window "` (trailing space) are all refused. `calendarCheck` re-validates the prefix. The live A2 window name starts with `A2 run window`. |
| **C-2 / M-5 job id** | **Correct, in all three places.** `ctx.jobId` feeds the run-event payload, `reconQuery(date, ctx.jobId)` and the recon manifest. The id must match `^manual\.gleif-reconcile-[a-z0-9]+(-[a-z0-9]+)*$` before it reaches SQL. I probed it: `…a2' OR 1=1--` and `…A2` are both refused. |
| **C-0 outbox clock (patch 00)** | **Accepted.** `replay` now judges expiry on `ctx.now()`. In production that is the real clock, so behaviour does not change. It fixes a test-clock defect. |
| **G-2 gate** | **One fixed design: n = adjudicated = 150 and 0 errors.** The file must pin the plan's sample SHA, name a Data-Identity Lead and a *different* Ops reader, and the Ops reader must cover ≥ 15 rows. Any error writes `holds/g2-stop.json`, which blocks every A2 batch. **But an incomplete file also writes the STOP hold.** See **MF-2**. |
| **Restore ordering** | **Correct.** `restore --batch A-k` in A2 restores the dependent Q, then EA, then ECA, then A, which is spec §9's Q → E-A → ECA → A. Restore is calendar-gated, so it cannot run on a Sunday (code-enforced). See N-4. |
| **Run sheet (D-4)** | **Agreed:**<br>- G-2 before the pilot;<br>- FG ≤ 40 + 10 post-write = 50 GLEIF calls;<br>- Sat only;<br>- stop at the cap;<br>- no Sun writes (`calendarCheck` refuses Sunday);<br>- recon by 23:30Z;<br>- Arch M-7 rules carried.<br>See N-5, N-6 and N-8 for corrections. |
| **C-1 / C-5 wrapper** | **Correct.** It refuses a missing env, a wrong job id or prefix, and a work dir under `gleif-011`. Line 1 names WORK_DIR and JOB_ID. `init` never overwrites. `read-ceiling` writes once. The ingest key is never sourced. |

## 3. C-4 break attempts (`a2ExclusionViolations`, my own probes)

| Probe | Result |
|---|---|
| A / Q on excluded id (number or string `"2303"`, `2303.0`) | caught |
| EA child excluded; EA parent = excluded LEI; Q whose only `depends_on` is `A:517` | caught |
| Non-A2 step (`P`, lowercase `a`) | caught |
| `em_update` with `set.lei` = excluded LEI on a clean id | caught |
| **`entity_id: " 2303"` (padded string)** | **MISSED.** It renders `UPDATE entity_enrichment_queue … WHERE entity_id = ' 2303'`, and SQLite coerces that to 2303: I confirmed it with `sqlite3`, and the row matches. |
| **`kind: 'em_insert'` under step `A`, `values.lei` = excluded LEI** | **MISSED.** `values.*` is not inspected, and the kind is not tied to the step. |

Both misses need a hand-edited plan with a regenerated `plan.sha256`. `generate --a2` always emits `Number(eid)` and only `em_update` for A, so the dry-run plan contains neither. But C-4's stated purpose is to hold "even if a plan were edited", and the runner does not enforce the Founder-GO plan SHA.

## 4. Findings

### MUST-FIX before run

**MF-1 (C-4): canonicalise ids and tie each kind to its step.**
- **Fix:** in `a2ExclusionViolations`:
  - (a) refuse any `entity_id` or `child_entity_id`, and any `depends_on` suffix, that is not a safe integer. Then compare `String(Number(v))`.
  - (b) refuse a kind that does not fit its step: A → `em_update`, Q → `q_update`, ECA/EA → `edge_insert`.
- **Tests:** two cases, the padded id and the `em_insert` smuggle. Then re-run the A2 and 011 suites.
- **Compensating control,** if the code is not committed by Sat 07:10Z: before **every** `gleif-a2.sh run`, the operator checks that `plan.sha256` equals the plan SHA in the Founder GO (S-4), and logs it. Any difference means stop.

**MF-2 (G-2 gate): an incomplete G-2 file causes a false STOP.**
- **Problem:** if `errors` or `ops_spot_check` is missing, `Number(undefined)` is NaN, which is treated as "has errors". `holds/g2-stop.json` is then written, and under Arch M-2 / Founder Q3 that reads as "defer A2". I probed it: the hold is written for a missing `ops_spot_check`, and for a missing `errors`.
- **Fix:** write the STOP hold only when `errors` or `ops_spot_check.errors` is an integer > 0. A missing or non-integer field refuses without writing the hold. Add a test.
- **Compensating control:** before the pilot, check the F-5 file with `jq -e '.packet=="MA-OCT-A2.G2" and .n==150 and .adjudicated==150 and .errors==0 and .ops_spot_check.errors==0 and .ops_spot_check.rows>=15 and (.data_identity_lead|ascii_downcase)!=(.ops_spot_check.by|ascii_downcase)'`. Run `gleif-a2.sh run` only on exit 0.

**MF-3 (G-4): exit 4 is not fail-closed.**
- **Problem:** `generateA2` writes `plan.json` and `plan.sha256` even when `g4.ok` is false, and the runner would run that plan.
- **Run-sheet fix (sufficient for Sat):**
  - S-3: any non-zero exit from `generate --a2` is a STOP;
  - the G-4 plan-delta check records `plan.a2.g4.ok === true`, and that `plan.a2.g2_sample_sha256` = `8d3dc22b…f03d`.
- **Code hardening (November):** the runner refuses an A2 plan whose `a2.g4.ok !== true`.

### NOTES

- **N-1.** The G-2 reader check is case-sensitive: `"DIL"` vs `"dil"` passes as two different people. The MF-2 `jq` check covers this. A code fix can wait for November.
- **N-2.** `generate --a2 --g2-sample` checks only `packet` and `n`. It does not check the sample's `base_plan_sha256` or `exclusions_sha256`, and does not re-draw. The expected SHA `8d3dc22b…` (F-4) is the control, and MF-3 records it at G-4.
- **N-3.** `isA2` keys on `plan.packet` or the job id. The wrapper always sets the A2 job id, so every A2 command must go through `gleif-a2.sh`, as D-4 already says. Never run the `.mjs` directly.
- **N-4.** Per-batch A restore: if the Q restore fails, the EA restore is still attempted before the run stops as `failed`. A is not restored in that case, so this is safe, and C-1′ (c) applies.
- **N-5.** D-4's list of Sat freeze bands is incomplete. All of these apply on Sat:
  - FREEZES bands: 05:50–07:10, 07:55–08:05, **10:45–11:15**, 11:45–12:15, **16:45–17:15**, 17:45–18:15 and **23:50–00:10**;
  - the runner's run windows: **07:15–10:40, 11:20–16:40 and 17:20–21:00**.

  The **practical last batch start is before 21:00Z, not 23:45Z**. The runner enforces all of this, so plan the pilot adjudication slot with that in mind.
- **N-6.** Report §7 / D-4 "commit FREEZES `9c368fa6…`" is **stale**. FREEZES `4d8202bb…` is already committed at `1a59b77` (FRI30.ENG1). Drop that line from the A2 commit list. The checkpoints will stamp `4d8202bb`.
- **N-7.** The window starts at 07:10Z, and FG, read-ceiling, export and generate all come before GO. The export alone is about 74k reads.
- **N-8.** The Sat sheet has no post-run verification export (AC-A2/A4/A6/A7) for the rows actually applied. Schedule it, Sat after the last batch or in the November continuation. Reads: about 74k + 33k + 75k ≈ 182k, which is ≤ 200k/day and ≤ 250k in total.
- **N-9.** Restore budget: Sat's ≈ 23k forward writes leave ≈ 1.9k of own headroom. A restore of more than one or two A+Q pairs on Sat will not fit, so the Ops M-6 calendar (a full rollback moves 013) is the only path. The run sheet already states this.
- **N-10.** The C-0 fix, the patch 04 bundling (C-3 + Ops M-2 + Arch M-2/M-3 in one patch) and the "G-2 before pilot" order are all accepted.

## 5. Ruling L-A2-1 (2488 "HONG KONG DOLLAR")

**Architect: accept the currency-name FUND clause.**

**Reasons:**
- It keeps the pinned `A2_exclusions_DIL.json` (`ac1c1572…`), and so the `A2_EXCLUSIONS_SHA256` constant, unchanged.
- The alternative, removing 2488 from R-FUND's `expected_ids`, would change the file's SHA. That would mean a code constant change, a new pin and a re-review, all before Sat.
- The clause is narrow: GC category FUND **and** a D1 currency name. In the dry run, R-FUND stays exactly the DIL set of 5 and the union stays **28**.
- It encodes DIL29's own row verdict ("currency pseudo-entity; LEI is the HSBC … sub-fund").

**Joint view:** the Data-Identity Lead's view is **not yet available**. MA-OCT-FRI30.DIL is READY and no report exists, so this ruling becomes final on the Data-Identity Lead's concurrence in FRI30.DIL item 3. If the Data-Identity Lead instead rules 2488 out of R-FUND, I need a delta review of the new file SHA and constant before the plan is generated.

## 6. Verdict

**PASS WITH NOTES. The Sat 31 run may proceed**, subject to:
1. MF-1..MF-3, each closed by its code fix (with the suites re-run green and a hash-checked delta to me) or by its compensating run-sheet control;
2. the Data-Identity Lead's concurrence on L-A2-1;
3. the existing gates G-2..G-6 and RunDocs D-1..D-4.

After that, LANE-1-ENG may commit patches 00–05, as listed in report §7 minus the FREEZES line (N-6).
