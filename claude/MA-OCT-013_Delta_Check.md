# MA-OCT-013 — Architect Delta Check: spec rev 1 + build (REVIEW-A)

```text
ISSUED BY:    Main Lane — MA-OCT-013.CHECK Control v1 02b76656c3a8286bea87ee88d0e93b7aacd0764d4a007f5c1770f0c3918e44d7
              Task v1 d57da4719da1914e07dab4c2d2172b9c4125ec23d444a67e112683935d3a84d8 (both verified; board row 109)
              ML-1105-2: wait for the BUILD report; deadline = PASS before the Founder starts 013.RUN this evening.
EXECUTED BY:  REVIEW-A (Architect), Claude Code, Thu 5 Nov 2026 07:28–07:45Z. Read-only: 0 D1 calls (0 reads, 0 writes,
              0 EXPLAINs), no deploys, no commits, no secret files. Local replicas only, in a scratch folder.
INPUTS:       claude/MA-OCT-013_Spec.md rev 1 e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098 ✔
              claude/packets/MA-OCT-013.BUILD_Report.md (final, 07:27Z) · commit 3c8866b on origin/October-2026 ✔
              all 6 build files byte-match the report's SHA-256s (git archive of 3c8866b) ✔
              BUILD export manifest 6133c424…8b06 ✔ (re-used read-only; no new D1 export)
              Architect / Ops / ETF reviews of rev 0 (83d9c894…, 4a879de2…, 381ccb99…)
VERDICT:      FAIL (as of 07:45Z) — 1 BLOCKER, 0 other MUST-FIX, 9 NOTES.
              All 15 rev-0 MUST-FIX items are closed in the spec AND in the code, the tests and the dry run reproduce,
              and every CAS / dangling-reference guard held under attack. One runner defect (B-1) can destroy the
              rollback input for a committed batch after a read failure — a realistic event given the documented
              intermittent wrangler code 10000. The fix is small. On delivery I re-check only the delta (≈ 30 min)
              and expect PASS WITH NOTES. The run may start Thu 5 only after that re-check passes.
UPDATED:      20:40Z Thu 5 — re-check of MA-OCT-013.FIX commit 5e41e7b: PASS WITH NOTES. B-1 closed. See §7.
              (Run start: first in November, after the Main Lane re-dates 013.RUN; see N-14.)
```

## 1. MUST-FIX closure (spec rev 1 **and** code)

| Item | Spec rev 1 | Code (3c8866b) | Test | My check |
|---|---|---|---|---|
| **Arch M-1** restore order | §11 key → re-insert → children/cik → LEI → redirect | `renderRestore` R1-key … R5-redirect, all gated on token T | T-1 | Full dry run: restore of all 38 batches byte-identical (table hash back to `52ac0591…d45b`); a repeat restore is a 0-write no-op |
| **Arch M-2** all-or-nothing; W1-A | §6.2 step-1 token under predicate P; steps 2–6 need T; LEI `NOT EXISTS (lei)` | `renderMerge` P (incl. exact planned `instrument_key` set, not only a count); T on every later statement; `renderLei` W1-A + `lei IS NULL` + post-merge key | T-2, T-4 | 17 race attempts on real replica rows: every one 0 changes (§3) |
| **Arch M-3** Filings/13F refs | §4.2 measured (847 rows / 8 dups); §5.4 hold | export probes mqp/ies/ips by `entity_id`, facts by `cik`; plan holds; step-1 + step-4 `NOT EXISTS` on the three indexed tables; per-batch facts probe | T-9 | Plan: 0 Filings/13F refs on merged ids; injected 13F and event rows → step-1 miss |
| **Arch M-4** column carry-over | §4.2 (only `cik`, 2 on Thu 5); step F fill-only | `cik_fill` only when survivor NULL and no other holder; restore sets NULL by CAS | T-5 | Export: 2 duplicates in the run set carry a cik; both are fills; 0 conflicts, 0 skipped (no cik lost) |
| **Arch M-5** seed re-creation | §5.3: two-way 1,868/1,868 key-equal; three-way/OTP held | `buildPlan` refuses any non-two-way candidate; N-2 key equality per pair with the live `normalizeName` | T-13 | Plan `n2_mismatch` 0 |
| **Arch M-6** disjointness, 3 hops | §5.1 plan-time assertion; hop text corrected | `assertDisjoint` (dup twice, surv∩dup, existing redirect on either side, holder is candidate) + step-1 `NOT EXISTS redirect IN (dup, surv)` | T-7, T-14 | Injected existing redirect on the survivor → 0 changes |
| **Arch M-7** partial-A2 gate | §13 A2 wrote 0; run sheet records it | run sheet R0 step 5 | — | Met (A2 deferred in full, ML-1030-2) |
| **Ops M-1** Ops identity | §9 / §15 R1, 900 s, R-4 fallback | job `manual.entity-merge-013`, emitter `merge-013`, `expected_max_duration_s` 900 in every event; emitter-mismatch env ignored | T-15 | Met |
| **Ops M-2** kill switch | §9 own dir, flags, `013.env`, one entry script | `merge-013.sh` (WORK_DIR/JOB_ID first; refuses 011/A2 dirs and wrong JOB_ID; init 600/700, never overwrites; `stop` SIGTERMs only a pid whose command is `merge-013.mjs`); runner checks flags before every batch | T-11 | Read; met |
| **Ops M-3** other writers | §9 boost pause row + flag; FREEZES window | `startGates`: active `ops_job_pause` row, boost 17:45+ end event, pause flag (remote) | T-16 | Live FREEZES has "013 run window … (ML-1104-3)" Thu 5 18:00Z → Fri 6 00:10Z; the runner skips it by name, as intended |
| **Ops M-4** dangling reference | §6.2 child-set predicate + step-4 guard; any non-merged/raced stops | step 4: `NOT EXISTS` iem, queue and the nine probes; readback breach stops; post-batch reference probes | T-3 | Token forced present + unplanned iem / edge / bond link / queue change → duplicate never deleted |
| **Ops M-5** margin, remainder, order | §8 30.4k / 33k, d1-today ≤ 38.0k; §9 remainder rule | `capsFor`: 33k / 70k only on 2026-11-05, else 25k / 60k; batch-boundary stop; `remainder.json` + SHA; 23:15 no start, 23:30 no write; 21:58–22:02 | T-10 | Read; met |
| **Ops M-6** restore calendar | §11 per-batch same day; full earliest Fri 6, ≤ 25k/day; 30-day retention | run sheet "Per-batch restore", "Retention" | — | Met |
| **ETF MF-1** | = Arch M-3 | as Arch M-3 | T-9 | as Arch M-3 |
| **ETF MF-2** allow-list; `fund_entity_link` refer | §6.4 plan and execute; §6.3 stop-and-refer | `checkStatement` at render and again in both transports; `fund_entity_link` row → merge referred, never repointed | T-8 | Holds for every statement the renderer can produce; parser gaps for hand-written SQL in N-1 |

## 2. Re-run evidence (mine, not the build lane's)

- **Tests:** `tests/merge-013.test.mjs` on a clean `git archive` of `3c8866b`: **87/87**. They fail on `f362131`, because the module is absent. Regression: nav-007-worker 58/58. 011 has the same single pre-existing failure ("heartbeats through the real 002 outbox"), which is not 013's.
- **Plan:** my own plan, from the build export (manifest `6133c424…8b06`), is identical to the build's `ea8bace8…c02d`:
  - same 1,862 merges in the same order, same iem keys and cik fills, same holds;
  - 38 batches, R = 62, 2 cik fills, 3 (iii) LEIs, **30,395** declared writes;
  - the 6 sign-eligible pairs held; 154 new pairs.
  - The SHA differs only by `created_utc`.
- **Replica dry run** (`node:sqlite`; clock Thu 18:20Z; account 5k; ops gates off):
  - pilot hold after B01, then B02–B38: **1,862 merged, 0 raced, 0 breach, 0 stops**;
  - 29,918 modeled merge writes (+ 456 heartbeat + 21 LEI = 30,395);
  - 3 / 3 LEIs applied; `verify ok: true` with every reference probe 0;
  - `restore --all`: 38 / 38 byte-identical, table hash back to `52ac0591…d45b`.

## 3. Attack results (real replica rows; each on a fresh copy)

| Attack | Result |
|---|---|
| Duplicate changed after the pre-image (`updated_at`, LEI, name, cik) | 0 changes ✔ |
| Survivor gains an LEI / is deleted / is re-keyed | 0 changes ✔ |
| Unplanned iem row on the duplicate; planned key swapped for another (same count); planned row moved away | 0 changes ✔ |
| Queue status changed / queue row deleted | 0 changes ✔ |
| Edge, ISIN, 13F position or event-stream row added on the duplicate | 0 changes ✔ |
| Existing redirect on the survivor (chain) | 0 changes ✔ |
| Existing redirect on the duplicate | 0 changes. P's `NOT EXISTS redirect` misses first, so the PK-conflict abort in the spec is never reached. Readback = breach → stop ✔ (N-3) |
| Token forced present + unplanned iem / edge / bond link / queue change (steps 2–6 only) | duplicate **not** deleted ✔ |
| `financialfact_reported` or `fund_entity_link` row written **after** the per-batch probe | merge proceeds (no guard inside the SQL) — N-2; no writer in the window |
| Allow-list on hand-written SQL: unquoted, `"quoted"`, `main.`, `INSERT OR REPLACE`, `fund_entity_link` write | refused ✔ |
| Allow-list: `` `etf_master` ``, `[fund_holdings_monthly]`, comma join `FROM entity_master, etf_master` | **passed** — N-1; the renderer never emits these |
| **Read failure after a committed batch** (injected code 10000 on the readback) | **B-1** |

## 4. Findings

### BLOCKER

**B-1 — A read failure after a committed batch leaves it unrestorable, and the natural re-run overwrites its pre-image.**

Reproduced on a replica copy by injecting one failure on the `rb-em` readback after B01's call had committed:

1. **The failure.** `executeBatch` throws out of `readState` (`scripts/merge-013.mjs` L501). 50 merges are committed, but there is **no checkpoint, no cursor and no remainder**. The pre-image file exists.
2. **Restore cannot run.** `restore --batch B01` refuses: "no checkpoint for B01" (L562).
3. **The re-run destroys the rollback input.** Re-running the same `run` command, which the run sheet tells the operator to do after a calendar stop, re-executes B01 with a new token. All 50 merges miss step 1 (0 writes, good), they are classified `breach`, and the run stops. But the re-run **rewrites `preimage-B01-<plan>.json` in place** (deterministic name, L491–493) with post-merge state: 50 survivor rows, 0 duplicate rows, 0 queue rows. The checkpoint now carries the new token and `merged: []`.
4. **Result.** The deleted duplicates' rows survive only in the R3 export. Recovering them is a manual reconstruction. No tool path exists.

**Why it is realistic:** CLAUDE.md / MA-OCT-000 record intermittent wrangler code 10000 failures. A full run makes about 114 reads after commits (rb-em, rb-redirect, ref-probes × 38). The remote transport does not retry. 011 deliberately did not rely on D1 batch atomicity (011 spec "No reliance on atomicity"; L11-14), and the run sheet's "one transaction" is an assumption.

**Required fix** (BUILD lane; small; explicit-path commit on `October-2026`):
- **(a) Write-once rollback inputs.** Create the pre-image and the checkpoint with `flag: 'wx'`. `executeBatch` must refuse with 0 writes and the outcome `failed` when this plan's batch already has a pre-image but no final checkpoint. The message should say "batch executed earlier; run `readback` / `restore`, do not re-run".
- **(b) Provisional checkpoint before the execute call:** `{batch, plan_sha256, token, preimage, preimage_sha256, state: 'executing'}`. The final checkpoint adds the classes.
- **(c) `readback` and `restore` work from a provisional checkpoint.** They classify at the time with its token, restore only merges whose class is `merged`, and list the rest.
- **(d) Retry the post-execute reads.** These reads are idempotent, so allow ≥ 3 tries with backoff before giving up. If they still fail, exit with "executed, unclassified — run `readback`". The cursor is not advanced, and (a) blocks a re-run.
- **(e) Test T-17.** Inject a read failure after a committed batch, then assert all of:
  - a provisional checkpoint exists;
  - a re-run is refused with 0 writes;
  - the pre-image SHA is unchanged;
  - `restore --batch` restores byte-identical.
- **(f) Run-sheet line:** "After any RUNNER ERROR: do not re-run. `$S status` → `$S readback --plan $P --batch <last>` → Operations Lead."

**Should-fix in the same commit (not blocking):** make restore safe on a partially applied merge or restore. Add `AND NOT EXISTS (SELECT 1 FROM entity_master WHERE entity_id = :dup)` to R2-reinsert, and the same guard on the queue row to R3-queue. Today both fail with a PK conflict if the row is already there, which is only reachable if D1 multi-statement calls are not atomic.

### NOTES (none blocks the run)

- **N-1 Allow-list parser.** `checkStatement` misses backtick- and bracket-quoted identifiers and comma-joined tables. The renderer cannot produce these, because every table name is a constant, so ETF MF-2 holds for 013's real statements. Tighten anyway: refuse `` ` `` or `[` outside literals, and parse comma lists after `FROM`. Add the cases to T-8. Fold into the B-1 commit if convenient; otherwise November.
- **N-2 Per-batch-only probes.** `fund_entity_link` and `financialfact_reported` are probed once per batch, not inside the step-1 / step-4 SQL, so there is a probe→execute window of seconds. There is no writer in the window:
  - `fund_entity_link` is written only by `meridian-entities-seed` (Monday 04:00Z since MA-OCT-012);
  - `financialfact_reported` only by `local.financialfact-backfill` (09:00Z, currently exit 78).
  - Only 2 run-set duplicates carry a cik.
  - **RUN R0:** record that neither fires in 18:15–23:30Z.
  - **November:** add `NOT EXISTS (… financialfact_reported WHERE cik = :dup_cik AND entity_id = :dup)` to step 1 for cik-bearing duplicates.
- **N-3 Spec wording (§6.2).** "INSERT, not OR IGNORE … a PK conflict aborts the whole batch" is unreachable: predicate P already excludes an existing redirect, so the result is a clean miss. A plan-time redirect is refused by M-6, and a live one gives readback `breach` → stop. Safe; correct the text.
- **N-4 Atomicity wording.** The run sheet's kill-switch row says the in-flight D1 call "is one transaction". Treat that as unverified, in line with 011. Each merge's safety does not depend on it; only partial-restore recovery does (see the should-fix above).
- **N-5 cik losses not listed.** The plan does not list duplicates whose cik conflicts with the survivor's or is held elsewhere (Arch M-4: "never silently dropped"). Thu 5: 0 of each, by my count from the export. List them for the November sets.
- **N-6 Step-7 LEI predicate.** `EXISTS (… entity_merge_redirect WHERE survivor_id = …)` has no index, so it scans the table: ≤ 1,862 rows × 3 ≈ 5.6k reads. Accept (L13-5), or key the probe on `duplicate_id = :dup`.
- **N-7 FREEZES copy.** `3c8866b` carries the 30 Oct FREEZES (`4d8202bb…7fc`). The live file with the 013 window (`38865554…26b9`) is uncommitted in the shared checkout. The recurring bands are identical and the runner skips "013 run…" windows by name, so Thu 5's calendar is the same either way. RUN records which FREEZES SHA the plan pinned (plan `inputs.freezes`).
- **N-8 Raced stop.** Any single `raced` merge stops the run, since floor(0.5 % × 50) = 0. This matches the spec's "above 0.5 %" and is acceptable with the other writers frozen. Resuming after a race is a new start, past B-1's guard.
- **N-9 Pre-existing 011 test failure.** Reproduced, identical on the base. Not 013's; already flagged to the Main Lane by BUILD.

## 5. Run sheet (Task: cap, remainder, kill switch, restore)

| Item | Result |
|---|---|
| Caps | 33k (013) / 70k (account) only on 2026-11-05; d1-today ≤ 38.0k checked at R0; 1.3× overrun stop (remote) ✔ |
| Remainder rule | batch boundary only; `remainder.json` + `.sha256` on flags, calendar, budget and failures; next eligible weekday ≥ 08:05Z under a new Control at 25k / 60k ✔. After a failed batch the remainder starts at the **next** batch; the failed batch's un-merged ids are in its checkpoint (keep that in the RUN report). |
| Kill switch | `$S stop` → flag + SIGTERM to the 013 pid only; the in-flight call completes (wrangler child is detached); exit `killed` ✔ |
| Restore | per batch, Arch M-1 order, byte-identical verification ✔ — **subject to B-1** |
| Order / gates | R0 → R1 (skippable by 18:45) → R2 → R3 → R4 → R5 pilot hold → R6 → R7 → R8 ✔; after 002b.DEPLOY closes ✔ |

## 6. Verdict and what happens next

**FAIL as of 07:45Z Thu 5. The run may not start on 3c8866b.**

- The design, the 15 fixes, the tests, the dry run and the guards are all sound.
- **The only gate is B-1 (a–f).** When the BUILD lane commits it, I re-check that delta alone: the diff, T-17 plus the full suite, a re-run of my injection, and a single-batch replica round trip. I expect **PASS WITH NOTES** within about 30 minutes of the commit, well before the ≥ 18:15Z start.
- N-1 to N-9 do not gate the run.

## 7. Delta re-check: MA-OCT-013.FIX commit `5e41e7b` (Thu 5, 20:25–20:40Z)

**Verdict: PASS WITH NOTES. B-1 is closed, and with it the FAIL above.** 0 D1 calls, no commits, no deploys. Local replicas only.

### 7.1 Inputs
- **FIX packet:** Control `b04db2a8…fa7c` and Task `4fffb849…7cab` match board row 113. The FIX report is `5e7fc9e4…cece4`.
- **Commit:** `5e41e7b` on `origin/October-2026`. Its parent is `7c0ad2e` (002b), which touches none of the 013 files.
- **Files:** all 4 changed files match the report's SHA-256s (`git archive 5e41e7b`):
  - `merge-013.mjs` `80ee9cd5…2048`;
  - core `6a5fbf12…c2f2`;
  - tests `de522afc…f5d4`;
  - run sheet `35dd8965…aca3`.

### 7.2 Routing items 1–7: closure
| # | Item | Code | My evidence | |
|---|---|---|---|---|
| 1 | Write-once rollback inputs | `writeOnce()`: tmp `wx` + `linkSync` (EEXIST, never replaces). `executeBatch` refuses before any batch read when a pre-image, provisional or final checkpoint exists. `cmdRun` returns without touching the cursor, `done` or the remainder. | Injection A/C/D: the re-run is refused. Its only D1 calls are cmdRun's 3 pre-flight reads (`index-precondition`, `redirect-table`, `hold`): **0 writes, 0 batch reads**. Database, pre-image and cursor are unchanged. | ✔ |
| 2 | Provisional checkpoint before execute | Written after the pre-image and before `merge-Bnn`. It carries the token, the pre-image name and the pre-image SHA, with `state: executing`. | A/C: `B01-<plan>.provisional.json` present; no final checkpoint. | ✔ |
| 3 | `readback` / `restore` from provisional | `loadBatchArtifacts` uses final, else provisional. It checks plan, batch, pre-image SHA **and token equality**. With a provisional checkpoint, the batch is classified now and only `merged` is restored. `restore --all` includes provisional-only batches. | A/C: readback `provisional`, 50 merged. Restore `from: provisional`, 50 restored, **byte-identical**, content hash back to the pre-run value. A repeat restore is a 0-row no-op. | ✔ |
| 4 | Bounded retry | `retryRead`: 1 + 3 tries (2 s / 5 s / 10 s). Covers `rb-em`, `rb-redirect`, ref-probes and the restore verify reads. Allow-list refusals are not retried. The final failure gives "executed, unclassified", leaves the cursor in place, and starts the remainder after the batch. | B (one transient `rb-em` failure): recovered, final checkpoint written, run continued. A (persistent `rb-em`) and C (persistent `rb-redirect`): `failed` / `unclassified` with the do-not-re-run text. | ✔ |
| 5 | T-17 + full suite | 18 new checks. | **105/105** on `5e41e7b`. The same test file on the `3c8866b` archive gives **89/105** (16 T-17 checks fail), so the tests do detect B-1. nav-007-worker 58/58. 011: 41/42, the same known N-9 failure. | ✔ |
| 6 | Run-sheet line (f) | Kill-switch table row, verbatim. R6 limits "re-run the same command" to clean batch-boundary stops. N-4's "one transaction" wording is removed. | Read in the diff. | ✔ |
| 7 | Should-fix: restore `NOT EXISTS` | R2-reinsert and R3-queue carry `AND NOT EXISTS (… WHERE entity_id = :dup)`. | T-17 partial-restore check passes. On the base it fails with `UNIQUE constraint failed: entity_master.entity_id`. | ✔ |

The one extra change is sound: the 23:30 clock check now runs before the pre-image, so a clock stop never locks an unexecuted batch.

### 7.3 Replica round trips (my replica and plan; fixed runner)
- **Thu 5 caps (clock 18:20Z):**
  - 38/38 batches, 1,862 merged, 1,862 redirects;
  - `verify ok`;
  - `restore --all`: 38/38, 1,862 restored, all identical;
  - content hash back to the pre-run value.
- **Any other date (clock Mon 9 Nov, 09:20Z):**
  - the run stops `budget_limit` at the **25k** cap after **31 batches / 1,550 merges**;
  - `remainder.json` holds 7 batches (312 merges);
  - `verify ok`; `restore --all` 31/31 identical, back to the pre-run value.
- **Plan:**
  - The build plan `ea8bace8…c02d` is byte-identical on disk.
  - A re-plan from the same export with the fixed runner is **identical except `created_utc` and `inputs.seed_src`**, which gives SHA `c589ae7a…02c7`.
  - `seed_src` is the hash of `src/entities-seed.js`, which 002b (`7c0ad2e`) changed (heartbeats only). It is provenance only; nothing checks it at run time.

### 7.4 New notes (none blocks)
- **N-10 Orphan pre-image.** A crash in the µs between the pre-image write and the provisional write locks the batch with no checkpoint.
  - Nothing has executed at that point. The re-run is refused, and readback / restore say "no checkpoint".
  - Recovery: the Operations Lead removes the orphan pre-image, or the batch goes to a remainder plan. Accept.
- **N-11 Execute call fails before commit (injection D).**
  - The batch gets a final checkpoint with the stop "execute error …". Readback then labels all 50 merges `raced`, although nothing raced: the token is absent, and the classifier cannot tell "never committed" from "lost a race".
  - Safe: 0 rows changed, the re-run is refused, and restore is a no-op.
  - The 50 merges leave tonight's set, because the remainder starts after the batch; they return only on a re-plan.
  - Operations Lead: read the stop reason before the class counts. November: add a `not_committed` class.
- **N-12 No same-plan continuation after a failed or unclassified batch.** The cursor stays and the re-run is refused, so the day's run ends there. The rest continues through the remainder. This is the intended fail-safe; the retry in item 4 makes it rare.
- **N-13 Plan provenance after 002b.**
  - `ea8bace8…` still loads under the fixed runner.
  - A re-plan on the current tip gives a different SHA (`c589ae7a…`) with identical merges and batches.
  - RUN records which plan SHA it uses, and why.
- **N-14 Run date (ML-1105-3 moved 013 to November).**
  - `RUN_DATE = '2026-11-05'` is hard-coded. On any other day the runner applies 25k / 60k, so the set splits 31 + 7 batches over two run days, as shown in 7.3.
  - The FREEZES 013 window was removed (`66d5206f…`). The RUN Control still describes Thu 5 ≥ 18:15Z under the Thu 5 approval.
  - **Before RUN starts, the Main Lane re-dates it:**
    1. A new FREEZES window.
    2. The Founder's approval of the date and of the two-day split. Raising the cap instead is a code change and needs another re-check.
    3. R0 re-checks N-2 for the new window: `financialfact-backfill` at 09:00Z daily, `entities-seed` on Mondays at 04:00Z.
- **Still open:** N-1 (allow-list parser, November), N-2 (record at R0), N-7 (record the FREEZES SHA the plan pinned), N-9.

### 7.5 Verdict
**PASS WITH NOTES.**
- B-1 is closed; must-pass items 1–7 are verified in code, in tests and by independent injection.
- **Thu 5:** the run does not start, because the fallback (ML-1105-3) has already been applied.
- **RUN may start first in November on `5e41e7b`** (or a later commit that leaves the 4 files unchanged), once the Main Lane has re-dated it per N-14.
