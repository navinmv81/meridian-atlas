# MA-OCT-A2.BUILD — Report (LANE-11-ENG, Engineering Lead)

- **Control:** `MA-OCT-A2.BUILD_Control_v1.md` `6334e9410bf1a81c0db1f2d02088984edc92b448155fa5fc4b8faaadd1ae8bee`, verified.
- **Task:** v1 `a14e6f94edb5bbeb80a74d9cd4f624ee0c2c5b1c90a858de1f6da35b9c2858eb`, verified.
- **Gate:** Founder "A2 option A" (ML-1029-6, board 29 Oct 20:45Z).
- **Executed:** Thu 29 night → Fri 30 00:57Z (Mac clock; see §8).

**Outcome: steps 1–6 done. C-3 is implemented, tested and reported before the Fri 30 14:00Z stop point.**
- The A2 suite passes 21/21 and the 011 suite stays green at 42/42.
- The dry run reproduces the spec §1/§3 counts exactly.
- **D1:** 0 writes, 0 reads.
- **Other:** no deploys, no secrets, no commits, 0 GLEIF calls.

## 1. Worktree and patches (step 1)

- **Worktree:** `~/MeridianAtlas-work/ma-oct-a2/build-worktree`, detached at `origin/October-2026` `71fab4b`. `58cd922..71fab4b` has **no diff** on the 011 paths (core, scripts, 011 tests), so the base is 58cd922's 011 code.
- **Patches:** each item is a separate patch in `~/MeridianAtlas-work/ma-oct-a2/patches/`, a cumulative snapshot diff applied in order.

| # | Patch | Lines + / − | sha256 |
|---|---|---|---|
| 00 | `00-C0-outbox-clock.patch` (pre-existing defect, §6) | 2 / 1 | `89186aabdc89b87d489e9d7555520cb5ab0f7964ec705c428bf426706b02df3c` |
| 01 | `01-C7-own-freeze-prefix.patch` (C-7, Arch M-1) | 65 / 6 | `cc7ac4aa35456b7c6fbc504a976b9bd3a516d4a977e05a478ded588f8b616ee1` |
| 02 | `02-C2-M5-job-id.patch` (C-2 + Arch M-5) | 64 / 10 | `b6fd356823517d5d4af203f249af7ad11533edb002b00c78b224c7b5e755032b` |
| 03 | `03-C4-exclusion-assertion.patch` (C-4) | 110 / 1 | `2c29fce521ac0f199d8a3c0b329dee45a175779b3b538455f4be0a9db57d02fb` |
| 04 | `04-C3-generate-a2-OpsM2-ArchM2.patch` (C-3 + Ops M-2 + Arch M-2/M-3) | 509 / 14 | `a6a4e8ded265106ba6cac6824bcf382dfc3aadadbc2591203327f8f17744ddfe` |
| 05 | `05-C1-C5-OpsM5-a2-env.patch` (C-1, C-5, Ops M-5) | 132 / 2 | `e679d4cb088c47a1ffa975d2adf6abd7d049df0ee77a443852955eca90c9592b` |

**Note on 04:** C-3, Ops M-2 and the Arch M-2 G-2 gate are one patch. All three edit the same two functions, the `generateA2` batching and the runner's `abGate`/`executeBatch` headroom gate. Splitting them would leave intermediate states that do not run. The tests name each item separately.

## 2. What was built (step 2)

| Item | Change |
|---|---|
| **C-7** (Arch M-1) | **Core:** `ownFreezePrefix(env)` reads `GLEIF011_OWN_FREEZE_PREFIX`. It is limited to an allow-list (`011 run window`, `A2 run window`), and the default is unchanged. An unknown, empty or loose value fails closed. `calendarCheck(now, freezes, {ownPrefix})`.<br>**Runner:** passes `ctx.ownFreezePrefix`. |
| **C-2 + Arch M-5** | `configuredJobId(env)` takes `GLEIF011_JOB_ID`, validated by `^manual\.gleif-reconcile-[a-z0-9]+(-[a-z0-9]+)*$`; a malformed id fails closed. All three uses take `ctx.jobId`: the run-event payload (`eventFor`), the R-4 recon SQL (`reconQuery(date, jobId)`) and the recon manifest. |
| **C-4** | `A2_EXCLUSIONS_SHA256` pins `A2_exclusions_DIL.json` `ac1c1572…b4f7`. `loadA2Exclusions` fails closed if the file is missing, altered or not the one the plan pins. `a2ExclusionViolations` flags:<br>- an A on an excluded id;<br>- a Q/ECA/EA that depends on one;<br>- an edge to an excluded LEI;<br>- a non-A2 step.<br>It is checked **before each batch** (stopped `hold`, reason `C-4: …`, 0 writes), and again inside `executeBatch` as defence in depth. |
| **C-3** | New `lib/gleif-a2-rules.mjs` (pure functions): R-LF (form-sensitive class compare, previous/other-name clearance, deny list `87745`), R-CUR (currency-name pattern) and R-FUND, plus the §2 STOP rule.<br>`generate --a2`:<br>- requires a fresh export plus `--base` (the released 011 plan pinned `e3854698…6a8`);<br>- re-computes the exclusions (F-2);<br>- writes `a2-exclusions-applied.json`, `withheld-013.json` and `exceptions.json`;<br>- **exits 3 with no plan on STOP**;<br>- enforces the G-4 limits (A ≤ 3,648, ECA ≤ 44, EA ≤ 296; exit 4);<br>- records the plan SHA.<br>New `g2-draw` (seed `MA-OCT-A2.G2`, 150, file mode 600). |
| **Ops M-2** (option a) | A-k is followed by Q-k for that batch's rows, then ECA, then EA. Each A batch's headroom check reserves its paired Q's writes (`pair_est_writes`). Q in A2 needs the pilot adjudication, like A. `restore --batch A-k` restores Q-k (and dependent EA, then ECA) first. |
| **C-1 / C-5 / Ops M-5** | New `scripts/gleif-a2.sh` is the single A2 entry point.<br>- `init` writes `a2.env` (600; work dir 700). It holds no secrets and never overwrites a differing file.<br>- Every command sources `a2.env`. The script refuses a missing or invalid env, or a work dir pointing at `gleif-011`. Its first output line names WORK_DIR and JOB_ID.<br>- `read-ceiling` writes `{250000, 200000, since}` once.<br>- `gleif-reconcile-011-status.sh` takes `GLEIF011_JOB_ID`, prints `WORK_DIR=… JOB_ID=…` first, and shows `g2-stop`, `a-dropped` and `eca-ea-dropped` holds. |
| **Arch M-2 / M-3** | One fixed G-2 design: **n = 150, 0 errors; any error → STOP.** It writes `holds/g2-stop.json`, which blocks every A2 batch.<br>Every A2 batch, **including the pilot**, needs `--g2 <file>`. The file must be the adjudication of the sample pinned in the plan (`plan.a2.g2_sample_sha256`), with `n = adjudicated = 150`, a Data-Identity Lead, and a **different** Ops reader with ≥ 15 rows. |

**In-lane ruling L-A2-1, for the Data-Identity Lead to confirm:**
- **Problem:** R-FUND as worded ("FUND match whose D1 name is not the fund's legal name") cannot hit **2488** "HONG KONG DOLLAR", because its name equals the HSBC sub-fund's legal name. DIL29 lists it under both R-CUR and R-FUND.
- **Change:** I added one clause. A FUND match whose D1 name is a currency name is also excluded under R-FUND.
- **Effect:** the union is unchanged (2488 is already excluded by R-CUR). Only R-FUND's per-rule id set changes, so it now equals the DIL file and the STOP rule passes.
- **If the Data-Identity Lead prefers:** the clause can be dropped and 2488 removed from R-FUND's `expected_ids` instead. Either way it is a one-line change.

## 3. Tests (step 3, C-6)

`App/Corporate Atlas/tests/gleif-reconcile-a2.test.mjs`: **21 tests, 21 pass, 0 skipped** (node 24, the HAVE_006 inputs present).

| Area | Tests |
|---|---|
| C-7 | The A2 window does not block A2, while the other dated and recurring windows still block. The default prefix is unchanged (the A2 window blocks 011). An unknown, empty or loose prefix fails closed. |
| C-2 / M-5 | `manual.gleif-reconcile-a2` is used in the run event, the recon SQL (`cmdRecon` against a local `ops_job_run`) and the manifest. The default is unchanged, and a malformed id builds no SQL. |
| C-4 | The violation classes. A plan with excluded row 2303 is refused before the batch with 0 writes. A missing, altered or unpinned exclusions file fails closed. |
| C-3 | Rule units. The **DIL29 fixtures 29 + 16 + 42** reproduce the verdicts. On the released 16 Oct plan's 3,676 A rows, R-LF/R-CUR/R-FUND = **24 / 1 / 5**, union **28**, and the STOP rule is OK. The STOP rule stops on an extra id or a drifted rule, and lists an absent id. The dry-run plan structure is checked. `generate --a2` refuses the D2 export and a non-release base. |
| Arch M-2 / M-3 | G-2 gate: a missing file, wrong sample, n ≠ 150, one name for both readers or < 15 Ops rows all refuse. Any error writes the STOP hold, which then blocks every A2 batch. |
| Ops M-2 | (b) An A batch that fits the 60k ceiling is refused when A + its paired Q does not fit. (a) Pilot A-001 holds; Q-001 needs the adjudication; then Q-001 → A-002 → Q-002 run; `restore --batch A-002` restores Q-002 first. |
| Ops M-5 / C-1 / C-5 | The wrapper refuses without `a2.env`; `init` sets modes 600/700 and never overwrites. `status` line 1 and line 2 show the A2 values and A2 holds, not 011's E-4. `stop` SIGTERMs the runner whose pid is in the A2 folder (a dummy process; the shared stop flag is cleared after). `read-ceiling` writes once. The wrapper refuses an env that points at 011. |

**They fail on 58cd922.** The A2 test file was run against a `git archive 58cd922` of `App/Corporate Atlas`, in a scratch tree that was deleted after the run.
- **Pure base:** the whole file fails to load (`ERR_MODULE_NOT_FOUND`, no `gleif-a2-rules.mjs`).
- **Base plus only the two new files dropped in** (`gleif-a2-rules.mjs`, `gleif-a2.sh`): **15 of 21 fail.** The 6 that pass test only those new files (rule units, the STOP rule, the wrapper's init/stop/read-ceiling), plus the one regression guard "default prefix unchanged". All C-7/C-2/C-4/C-3-generate/G-2/M-2 tests and the status test fail on the base code.

**011 suite:** `tests/gleif-reconcile-011.test.mjs` passes **42 / 42** after all patches.

## 4. Dry run (step 4): `generate --a2` against the last local 011 export, no D1

- **Inputs:**
  - export `~/MeridianAtlas-work/gleif-011/exports/2026-10-22-postrun`;
  - base `release-2026-10-16/plan.json` `e3854698…`;
  - `gleif_006.db` `bd704c14…`;
  - exclusions `ac1c1572…`.
- **Outputs:** in `~/MeridianAtlas-work/ma-oct-a2/dryrun/`. Plan `plan-a2-dry/plan.json` sha256 **`d1cb5abbfeffde9e8f7196174641bca36e2672030635070f988beba657e3a16e`**, `releasable: false` (dry run).

| Step | Spec §3 | Dry run | |
|---|---|---|---|
| A | 3,648 (3,676 − 28) | **3,648** | equals the released A minus the 28 exactly |
| ECA | 44 | **44** | ⊆ 011's released ECA set |
| EA | 296 | **296** | no parent is an excluded A row |
| Q | 3,648 | **3,648** | paired A-k → Q-k |
| Writes | ≈ 31,607 | **31,607** | A 22,951 · Q 7,296 · ECA 176 · EA 1,184 |

- **Exclusions applied:** R-LF 24 / R-CUR 1 / R-FUND 5, union 28, STOP rule OK.
- **E-X2:** 1 row (2019 OTP Bank, LEI `529900W3MOO00A18X956`, held by 467290). It is withheld to 013.
- **Batches:**
  - A-001..A-015: 14 × 250 + 148, each followed by its Q-k;
  - ECA-001 (44);
  - EA-001 (250) and EA-002 (46).
- **Pilot:** A-001.
- **G-2 sample** (dry run, same deterministic draw as on the day): `dryrun/g2-sample.json` sha256 `8d3dc22b19d898fa35a4587c23b3d85afc324e7318d6356525c23500b679f03d`, population 3,648.

**Per-day write totals vs the runner cap (25k own/day):**
- Cumulative estimated writes, with 10 event writes per batch, are 23,117 through **A-011 + Q-011**.
- A-012's gate needs 23,117 + 1,547 + 10 events + paired Q 510 = 25,184 > 25,000, so the runner **refuses** it.
- **Sat 31 can therefore run at most A-001..A-011 + Q-001..Q-011** (2,750 A rows).
- **To November (ML-1029-5):** A-012..A-015 (898 rows) + their Q, ECA (44) and EA (296), about 8,820 writes.
- **The spec's "Fri ≈ 11k + Sat" split does not happen** under option A (no Fri writes), so ECA/EA cannot run in October. The detail is in the run sheet, RunDocs D-4.

## 5. Docs for the run Control (step 5)

`claude/packets/MA-OCT-A2.BUILD_RunDocs.md`:
- **D-1, Ops M-1 enrich freeze:** a triggers-only `crons = []` change on `meridian-entities-enrich`. Apply Fri 30 ≥ 08:05Z and before Sat 05:50Z; restore Sun 1 ≥ 08:05Z from the committed toml. Each is its own production step with verify and rollback. **Never `hold_all_jobs`.** It notes that the two freed cron slots must not be taken by anyone before the restore.
- **D-2, the `gleif-a2` key:** prepare only. K-1..K-5, `OPS_INGEST_KEYS` put from stdin after deploy 4 and the 004 deploy, rollback to the three-emitter JSON. The key is never printed or read.
- **D-3, Ops M-4 registry row:** SQL in the T12 shape, emitter `gleif-a2`, 900 s per batch, with verify and rollback. It notes that `registry-sync.mjs` needs the row too.
- **D-4, Sat 31 run sheet:** FG ≤ 40 + 10 → read-ceiling + fresh export → plan → GO → pilot → A+Q pairs to the cap → recon by 23:30Z → stop. It also covers Arch M-3/M-4/M-6/M-7, Ops M-3/M-6/N-2/N-6/N-8/N-9 and the restore calendar. **No A2 write or restore on Sun 1.**

**Two points for the Main Lane:**
1. **G-2 comes before the pilot, not after it as the Task lists it.** The code requires the G-2 file for every A2 batch including the pilot, and G-2 is the Founder's GO evidence (spec criterion 3). The draw is deterministic, so the run sheet has it drawn and adjudicated **Fri 30** (F-4/F-5).
2. **Commit FREEZES first.** The runner reads `claude/relays/FREEZES.json` from its own repo. At `71fab4b` that file is `b6d035f6…`, which has no A2 window. The shared checkout's uncommitted `9c368fa6…e829` must be committed (Arch M-6 re-pin) before the run.

## 6. Pre-existing defect found (fixed as patch 00)

- **Symptom:** on the **unchanged** base, the 011 test "heartbeats through the real 002 outbox" failed.
- **Cause:** the runner called `ctx.outbox.replay()` without `now`, so replay used the real `Date.now()` (30 Oct) against the test's fixed 17 Oct clock, and expired the events (6 days).
- **Fix:** pass `now: ctx.now().getTime()` (1 line).
- **Production impact:** none. In production `ctx.now()` is the real clock, so the behaviour is identical. It is a test-clock defect, and any date-dependent test would have hit it from about 23 Oct.

## 7. Commit list (step 6, for LANE-1-ENG after the Architect review)

Stage explicit paths only, from the A2 worktree's diff (or apply patches 00–05 in order to `October-2026`):

```
App/Corporate Atlas/lib/gleif-a2-rules.mjs                    (new)     4ab39e783971dfe5dd0bcac91396bbcc165a45171f3cf758e46b427c39c6a5ce
App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs          (mod)     415dd1a938982db3be61a399162624bc083f51d31c54442a351bf4d3cf6dfa52
App/Corporate Atlas/scripts/gleif-reconcile-011.mjs           (mod)     e84be0082d61f4ff4a5fe8981699d0ce6db51a438cab6a0a7cf72407f3190dcb
App/Corporate Atlas/scripts/gleif-reconcile-011-plan.mjs      (mod)     910fe99f194243bf8fcfbb580dbf1e20b423a1cc301edfd99395b155f115825d
App/Corporate Atlas/scripts/gleif-a2.sh                       (new, +x) 46cf7e3780df7b634db715bdce1ea7d1997f55a4c274c18e9bbff84904196f17
App/Corporate Atlas/scripts/gleif-reconcile-011-status.sh     (mod)     850f946ae38e66316bd9e6ed1f7a6b46169ccc7a14f22a3c9b3c095f01abc8c0
App/Corporate Atlas/tests/gleif-reconcile-a2.test.mjs         (new)     d7e44849569ed2f1344e671c2f3b63f1b98313dfbfdc84c4ecc26c2087c38e30
claude/relays/FREEZES.json                                    (mod, shared checkout)  9c368fa6b85eb1c013647744664474be8c394f099a7f582c7e48ba7f5893e829
claude/packets/MA-OCT-A2.BUILD_Report.md                      (new)
claude/packets/MA-OCT-A2.BUILD_RunDocs.md                     (new)
```

Suggested split, one commit per logical change, following the patches:
1. C-0;
2. C-7;
3. C-2 + M-5;
4. C-4;
5. C-3 + Ops M-2 + Arch M-2/M-3;
6. C-1/C-5/M-5 wrapper + status;
7. FREEZES re-pin + docs.

Never `git add -A`, never `September-2026`, and none of `13F Seed/gleif-seed.js`, `.env*` or `.claude/settings.local.json`.

## 8. Hygiene and notes

- **D1:** 0 reads, 0 writes. No `wrangler` calls were needed (local only), so the pre-flight was not exercised.
- **Other:** 0 GLEIF calls. No deploys, secrets or commits. No macOS permission prompt.
- **Secrets:** none read (ML-1024-1). The tests use dummy ingest files only.
- **Files:** only the A2 worktree and `~/MeridianAtlas-work/ma-oct-a2/` were changed, plus these two report files in the shared checkout's `claude/packets/`. `gleif-011/` was only read. The test temp dirs are under the OS tmpdir. The stray stop flag was removed after the stop test (none left in the worktree).
- **Timestamps:** the Mac clock read 20:22Z when this packet started, against the Control's 20:35Z. Times in this report are from the Mac clock (`date -u`), and the skew is about 13 minutes.
- **Lane:** one packet, own worktree. FREEZES respected (no production step).
