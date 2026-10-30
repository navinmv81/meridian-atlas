# MA-OCT-A2.PREP — Report

**Control** v1 `3b296a27fae362ab0656dafb6ef931e8c18d7a0975bf12330da8b062e32f9f04` (matches the Status Board row) · **Task** v1 `f3000cd901220a475304828561059a613e2876c6cc4f63a54379cfc5455b3bd8` (matches) · **Executed by:** LANE-11-ENG, Engineering Lead · Thu 29 Oct 2026, 20:15–20:30 UTC.

## Verdict
**STOPPED before any change (Founder decision, 20:2x UTC): a scope gap.** The A2 runner code that the must-fix items modify (A2 spec §4, **C-1..C-6**) has **never been built**, and no packet owns it. Without C-3 and C-4 there is no A2 plan to run on Fri 30, so folding in the must-fixes alone cannot make A2 runnable. Nothing was written apart from this report.

**Activity:** 0 code changes, 0 worktrees, 0 D1 reads or writes, 0 wrangler calls, 0 secrets touched, 0 git writes.

## Checks
| Check | Result |
|---|---|
| Lock files | none |
| HEAD (shared checkout) | `acfd069` |
| `origin/October-2026` | `71fab4b`; ahead by `fd7b753`, `845614f`, `71fab4b` (003 / 008 only) |
| Governing inputs | all match the Task: A2 Spec `226d07db…842d`, Architect review `c95b07a7…6b36`, Ops review `883e1760…c9e` |

## The gap (evidence)
1. **No A2 code exists on the base.**
   - `git grep` over `origin/October-2026` `App/Corporate Atlas/{scripts,lib}` finds **no** `--a2`, `A2_exclusions` or A2 work-dir handling. The only "A2" hit is the string `RC-A2` in 011's plan generator.
   - The 011 files were last changed in `58cd922`, the 011 code commit.
   - `~/MeridianAtlas-work/gleif-a2/` does not exist.
2. **No packet owns C-1..C-6.** The Status Board shows A2.SPEC, A2.REVA and A2.REVO as CLOSED and A2.PREP as READY; there is no A2 build packet.
3. **Both reviews assume C-1..C-6 will be built.**
   - Architect: "C-1..C-6 are minimal and fit the code … **Missing: C-7 (M-1) and the full C-2 coverage (M-5)**"; spec §4 also says "each in its own tested commit", which the Architect reviews.
   - Ops M-5 refers to "a test (C-6)".
   - The PREP Task item 1 names only the must-fixes.

## What a corrected Control needs to cover (for the Main Lane)
| Item | Content | Where | Size |
|---|---|---|---|
| C-1 | A2 work dir via `GLEIF011_WORK_DIR=~/MeridianAtlas-work/gleif-a2` (already supported; env only). 011's dir and holds untouched. | env / `a2.env` | small |
| **C-2 + Arch M-5** | `GLEIF011_JOB_ID`, used in **all three places**: run-event payload (runner:99), R-4 recon query (core:494), recon manifest (runner:882) | core, runner | small |
| **C-3** | `generate --a2`: emits only A / ECA / EA / Q; reads `A2_exclusions_DIL.json` (SHA-checked); R-LF / R-CUR / R-FUND with the §2 STOP rule; re-computes F-2 on the fresh export; writes `a2-exclusions-applied.json`, `withheld-013.json` and the plan SHA. **Plus Ops M-2:** Q paired with each A batch the same day. | `gleif-reconcile-011-plan.mjs` | **large** |
| **C-4** | Runtime assertion: no rendered A / ECA / EA / Q statement may touch an excluded id; fail closed | core `renderStatement` caller | small |
| C-5 | A2 read-ceiling file `{ceiling: 250000, per_day_max: 200000, since}` | work dir | trivial |
| **C-6** | Tests: the three rules on the DIL29 fixtures (29 + 16 + 42 rows), the STOP rule, C-4, and the must-fix tests | `tests/` | medium |
| **C-7 = Arch M-1** | `GLEIF011_OWN_FREEZE_PREFIX` (default `011 run window`; A2 uses `A2 run window`). Tests: A2's window does not block A2; any other dated window and the recurring windows still block. | core:123–125 | small |
| Arch M-2 | One fixed G-2 design: n = 150, 0 errors, any error → STOP | runner / G-2 tooling + run sheet | small |
| Ops M-4 | Job `manual.gleif-reconcile-a2`, emitter `gleif-a2`, `expected_max_duration_s = 900` | registry (LANE-1-ENG), env | small |
| Ops M-5 | One `a2.env` sourced by every control script; `status.sh` prints `WORK_DIR` and `JOB_ID` first | control scripts | small |
| Task items 2–5 | Ops M-1 enrich-cron mechanism proposal; `gleif-a2` key step (prepare only); Fri–Sat run sheet (Arch M-3 / M-4 / M-7, Ops M-3 / M-6); commit list | docs | medium |

**Review dependency:** C-3 and C-4 are new logic over the exclusion rules. The Architect should code-review them, plus the P-1/P-2 plan-hash check (Ops N-9), **before the pilot**. That review needs a slot on Fri morning.

## Schedule effect (for the Founder and Main Lane)
- **A2's Fri 30 timeline depends on C-3/C-4 existing first.** That means: build, then tests, then Architect code review, then commit (LANE-1-ENG), then FG, export, plan, GO, pilot.
- **If they can't be built and reviewed in time,** Founder Q3 ("A2 defers to November if G-2 / FG / pilot fails", ML-1029-2) is the nearest existing ruling. It doesn't cover "not built", so the **Main Lane should rule explicitly** on whether A2 slips to November.
- **013 (Mon 2) is unaffected if A2 slips.** 013's plan is generated from a post-A2 export (A2 §10). With A2 deferred, 013 runs on the post-011 state: the 392 survivors without A2's LEIs, and no E-X2 withholds. 013 spec §5 and §13 already accept survivors with or without an LEI.

## Files
| File | SHA-256 |
|---|---|
| `claude/packets/MA-OCT-A2.PREP_Report.md` | this file (reported in the reply) |

Untracked. Nothing to commit from this packet.
