# MA-OCT-A2 — Deferred GLEIF A rows (A, E-A, ECA, Q): Spec

```text
ISSUED BY:    Main Lane — packet MA-OCT-A2.SPEC (Control v1 50a9bdcd…ae93; Task v1 eb63a161…4e59), Wed 28 Oct 2026
EXECUTED BY:  Data-Identity Lead (LANE-11), spec owner. Doc-only: 0 D1, no deploys, no git writes, no secrets
REVIEWED BY:  Thu 29 Oct — Architect (REVIEW-A) + Operations Lead (separate sessions; neither wrote this)
APPROVED BY:  Founder (A2 GO after the §7 gates)
GOVERNING:    ML-1025-5 (Option C: A2 in October scope; run Fri 30 – Sat 31; gleif_006.db kept until A2 closes)
BASELINE:     branch October-2026 @ 29ddfb4; 011 code committed at 58cd922 (LANE-1-ENG, Wed 28)
STATUS:       rev 0 (Wed 28 Oct 2026)
```

A2 is the deferred remainder of MA-OCT-011, not a new design. It runs the A, ECA, E-A and Q steps from 011 spec rev 1.10, with four changes:

1. a fixed matcher (exclusion rules R-LF, R-CUR and R-FUND, §2);
2. a fresh export and a new SHA-pinned plan;
3. a fresh adjudicated sample before GO, plus a new pilot;
4. real GLEIF API spot checks.

Unless this spec says otherwise, 011 rev 1.10's rules, gates, E-1..E-5, RA-12/RA-14/RA-15 and the E-4 rule apply **unchanged**.

## 0. Inputs (SHA-256 verified before reading)

| Input | SHA-256 | Used for |
|---|---|---|
| `claude/MA-OCT-011_Spec.md` rev 1.10 | `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa` | The rules A2 inherits (§3.1 A, E-1..E-5, §3.5, §4.3, §9, §10) |
| `claude/packets/MA-OCT-011.CLOSE_Report.md` | `89dab6159c124ce7c996c4b35fff43948a8673069417808dc857bf92419b7c9a` | Deferral (3,676 / 298 / 44); 247,468 reads used; `gleif_006.db` note |
| `claude/packets/MA-OCT-011.CLOSEREV-ARC_Report.md` | `a9c1cd196c88f59ec1534bdd8606762f2e686d5d46d1a14736c44f14aba8ff54` | §3 A2 inputs 1–7; §4 `gleif_006.db`; D-1 (API spot checks) |
| `claude/packets/MA-OCT-011.DIL29_Report.md` | `958421159b2836b743400ba520552f71d20cb0033f7c0c22069d832d875737e6` | The 29-row and 16-row legal-form lists, the FUND rules, R-LF/R-CUR/R-FUND |
| `~/MeridianAtlas-work/gleif-011/a2/A2_exclusions_DIL.json` | `ac1c157202913643b21ea3adc8fbca3f3fdcc9d4de15593395f55913ba7ab4f7` | The 28 excluded IDs, by rule |
| `…/gleif-011/closeout/a-deferral-list.json` | `86ec9d99305887e26c080e1c4ea4fde8410d06fbc63a0a30f5ff23419a206d56` | The A2 population (4,018 rows) and its flags |
| `…/gleif-011/plans/release-2026-10-16/plan.json` | `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8` | Per-step statements, writes and read estimates |
| `…/gleif-011/plans/release-2026-10-16/handoff-013.json` | `0597e15dedcf50a4bcc4f8e35b3a9f826a1b0278c093699aa3808d70b3a56009` | The 392 twins (§10) |
| `…/gleif-011/holds/e4-trigger.json` | `7e3c91538951dd3c1083e2119e054e1eb1a0aeb29855c968561961ac31163094` | The E-4 rows 2303 and 2488 |
| `…/gleif-011/holds/ea-dropped.json` | `b9e18517d3fba64ba991cd2d1d91ddf65095bde9a67caf56dafb6058b186daac` | ECA and E-A dropped on 21 Oct, 0 edges written |
| `…/gleif-011/closeout/exceptions-closeout.json` | `7fe7eb2f2a0f147e59e6783fe92249f75618d25fb44a423d6a9c8953630d4a32` | The OTP pair (2019 / 467290), raced P row 502685 |
| `claude/relays/FREEZES.json` | `b6d035f67e1b0512bf5c213a45b9f1c5e4047fb346657188e869bc1a1189bc8d` | Windows (§6) |
| `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` @ `58cd922` | `830b49a807b89ad96efdc7f6d4582e4b8c87c43ff7cf1201f856c58c5c4663c7` | Runner reuse (§4) |
| `scripts/gleif-reconcile-011.mjs` / `-plan.mjs` / `-verify.mjs` / `tests/gleif-reconcile-011.test.mjs` @ `58cd922` | `29300a0e…59fa` / `02ac8c67…67b8` / `b887e2f9…bb21` / `962cef28…f9e` | Runner, plan and verify reuse |
| `claude/October_Decisions_Log.md` | read 28 Oct | ML-1021 "Defer A", ML-1025-5, ML-1028-1 |

## 1. Scope and exclusions

| Step | 011 plan (16 Oct) | Excluded by DIL29 | **A2 scope (before fresh-export withholds)** | Writes (est.) |
|---|---|---|---|---|
| **A**: Level 1 LEI + Level 2 mirrors on no-LEI rows (T1, high) | 3,676 | 28 | **3,648** | 22,951 |
| **ECA**: E-C edges whose parent is an A row (F-2) | 44 | 0 | **44** | 176 |
| **E-A**: direct `legal_parent` edges for A children (E-1..E-5) | 298 | 2 (their child or parent is excluded) | **296** | 1,184 |
| **Q**: queue rows of applied A rows → `complete` | 3,676 | 28 | **3,648** | 7,296 |
| **Total** | | | | **≈ 31,607** + Ops events ≈ 1,000 → **≈ 32.6k** |

**Excluded (never written by A2; listed for review):**
- **E-X1: the 28 DIL29 IDs** (`A2_exclusions_DIL.json` union):
  - **R-LF, 24:** 483, 517, 2303, 3262, 14771, 14864, 15441, 15538, 15589, 86996, 87094, 87745, 99017, 49221, 99194, 106283, 104374, 106235, 107708, 458583, 109643, 111083, 106444, 103765;
  - **R-CUR, 1:** 2488;
  - **R-FUND, 5:** 2488, 94734, 98894, 100695, 106444.

  This covers both APILOT E-4 rows (2303, 2488).
- **E-X2: fresh-export withholds.** Any A target whose LEI is now held by another row (W1-A `NOT EXISTS` guard). Live Phase 3 keeps creating `holding` rows (the OTP Bank pattern). Each withhold is listed for 013 (§10) and never written.
- **E-X3: inherited from 011.**
  - Report-only tiers (T1_LAPSED, T1+/T1c, N+, review; N-2).
  - The 9 D7-1 government rows.
  - KI 22.44's 24 wrong-LEI rows (A writes only where `lei IS NULL`).
  - The E-1 edge exclusion (child 99231 → `549300CZ8QS1GE53O776`).
  - The 215 deferred A edges.
  - Every row whose pre-image no longer matches (CAS refuses it).

**Out of scope:** P, B, C, C-reasons, RC-15 and E-C. They are closed and stay closed: A2 never re-plans or re-writes them. Also out of scope: any new tier, any Level 2 for non-A rows, any `updated_at` write (011 OQ-5).

## 2. Matching rules

**Base set:** 011's A base, unchanged. 006 FINAL classification `lei` category `d`, confidence `high`, tier `T1`, GC registration status not `DUPLICATE`, not a D7-1 government row (`gleif-reconcile-011-plan.mjs` A section; Q77 assertion). This is the reviewed T1 set on the pinned 28 Sep publication. **A2 does not re-match names.**

**Fix: three exclusion rules, coded in the plan generator (not just an ID list).**

| Rule | Definition (from DIL29 §3, binding) | Expected on the 16 Oct basis |
|---|---|---|
| **R-LF** legal-form compare | The D1 name ends in an explicit legal-form class (LLC · LP · PLC · LTD/LIMITED · INC/CORP/CO/COMPANY · TRUST · FUND) that differs from the GC legal name's class, **and** no GC other or previous legal name equals the D1 name (normalised and form-sensitive; PUBLIC LIMITED COMPANY = PLC) → exclude. There is an explicit deny for SPAC previous-name traps (87745). Names without a form (truncated issuer names) and non-Latin GC names are not compared. | 24 |
| **R-CUR** currency names | The D1 name equals a currency name (EURO, … DOLLAR(S), YEN, FRANC, RUPEE, WON, …) → exclude | 1 |
| **R-FUND** | GC `entity_category = 'FUND'` and the D1 name ≠ the GC legal name (normalised) → exclude. Exact-name FUND matches stay. | 5 |

**Generator assertion (STOP rule):** on the A2 plan, the IDs the three rules exclude must **equal** `A2_exclusions_DIL.json`'s per-rule lists (24 / 1 / 5; union 28). A row that dropped out of the base set since 16 Oct may be missing from the plan, which is allowed and listed. If the rules exclude a row **not** in the file, the generator stops and the Data-Identity Lead rules on that row before the plan is pinned. The rules also run as a **runtime assertion**, so no A statement whose `entity_id` is in the union can be rendered.

**Unchanged guards (011 core, `renderStatement`):**
- A sets `lei` only `WHERE lei IS NULL AND name = <pre> AND normalized_name = <pre>` and `NOT EXISTS (SELECT 1 FROM entity_master o WHERE o.lei = <lei>)` (lei-free, W1-A);
- the CAS check on the full pre-image;
- `EM_NEVER_SET` (`entity_id`, `normalized_name`, `type`, `updated_at`).

## 3. Evidence basis and Level 1 freshness

- **Identity basis:** `gleif_006.db`, the 28 Sep 16:00 publication (`bd704c14…b047`, plan-SHA-checked), kept until A2 closes (ML-1025-5). Identity decisions are not re-made on a newer file.
- **Freshness gate (FG), before the first A2 write.** This replaces "refresh Level 1 from a newer GC", which would re-open 006's tiers.
  - The local lane makes **≤ 50 GLEIF API** `lei-records` calls on a seeded random sample of A2 LEIs. The **≥ 10 rows** used for the post-write spot checks (§8) are drawn from the same 50.
  - **A row is "changed"** if its legal name, registration status (ISSUED → LAPSED/RETIRED/MERGED/ANNULLED/DUPLICATE) or entity status differs from the 28 Sep record. Changed rows are withheld and listed.
  - **PASS** if ≤ 2 of the 50 changed and none changed to MERGED, RETIRED, ANNULLED or DUPLICATE.
  - **Otherwise STOP:** A2 is re-ruled by the Founder (Q1). The GC values are written as they are, with `gleif_last_updated` = the run timestamp and the provenance unchanged (`gleif_enrichment_version = 11`, `match_source = 'gc_name_t1'`).

## 4. Runner reuse (011 code at `58cd922`)

A2 runs the committed 011 runner and core library. The Architect reviews the following **minimal changes**, each in its own tested commit. Each must keep `tests/gleif-reconcile-011.test.mjs` green.

| # | Change | Where |
|---|---|---|
| C-1 | **Separate work dir:** `GLEIF011_WORK_DIR=~/MeridianAtlas-work/gleif-a2` (already supported). The 011 dir and its holds (`e4-trigger.json`, `ea-dropped.json`) stay **untouched** as 011's rollback record. A2 starts with no holds. | env only |
| C-2 | **Own job and key** (CLOSEREV-ARC CA-2, least privilege):<br>- `JOB_ID` becomes configurable (`GLEIF011_JOB_ID`, default unchanged), so A2 uses `manual.gleif-reconcile-a2`;<br>- the Operations Lead registers that job (`execution_mode 'manual'`, emitter `gleif-a2`) and issues a **new** emitter key under K-1..K-4.<br>003's sweep keeps it out of E1/E4 (not in `GLEIF_JOBS`); E5 applies. | core `JOB_ID`; Ops registry (≈ 3 writes) |
| C-3 | **`generate --a2`:**<br>- emits only A, ECA, EA and Q;<br>- reads `A2_exclusions_DIL.json` (SHA-checked);<br>- implements R-LF/R-CUR/R-FUND with the §2 STOP rule;<br>- re-computes F-2 against the fresh export (ECA parents; withholds E-X2);<br>- writes `a2-exclusions-applied.json`, `withheld-013.json` and the plan SHA. | `gleif-reconcile-011-plan.mjs` |
| C-4 | **Runtime assertion:** no rendered A, ECA, EA or Q statement may touch an excluded ID. Fail closed. | core `renderStatement` caller |
| C-5 | **New read ceiling file** in the A2 work dir: `{ceiling: 250000, per_day_max: 200000, since: <A2 export start>}` (§5) | work dir |
| C-6 | Tests: the three rules on the DIL29 fixtures (29 + 16 + 42 rows reproduce the verdicts), the STOP rule, and C-4 | `tests/` |

**Everything else is reused as-is:**
- the d1-today headroom gate (60k account ceiling, 25k own/day, F-1 own-row window);
- the calendar check against FREEZES;
- CAS, pre-images, read-backs and the P-3 / B-1..B-4 retry rules;
- checkpoints;
- the A-pilot hold (`--a-adjudication` needs `adjudicated ≥ 50`, `correct = adjudicated`, `data_identity_lead`, `ops_spot_check`);
- the EA/ECA release rules (RA-15: ECA only with an explicit `steps:["ECA",…]` release);
- the E-4 trigger, restore and outbox.

## 5. Budgets

**Reads** (2 rows per `IN` row, measured; `estBatchReads = 6n + 10`):

| Item | Reads | Day |
|---|---|---|
| Fresh export (X1 entity_master keyset + X2 relationships/queue; 011 measured 73,489) | ≈ 74k | Fri 30 |
| A: 15 batches (3,648) | ≈ 22.0k | Fri 30 – Sat 31 |
| ECA: 1 batch (44) | ≈ 0.3k | Sat 31 |
| E-A: 2 batches (296) | ≈ 1.8k | Sat 31 |
| Q: 15 batches (3,648) | ≈ 22.0k | Sat 31 |
| Post-run verification export (011 Thu 22 measured 74,606) | ≈ 75k | Sat 31 |
| **Total** | **≈ 195k** | |

- **The A2 ceiling is 250,000**, with a fresh `since`. 011's 247,468 / 350k is closed and does not carry over.
- Per day ≤ 200k (OPS-R9): Fri ≈ 90k, Sat ≈ 110k.
- Every execution ≤ 45,000 (core `maxReadsPerExecution`).
- That is ≈ 3.9% of one day's 5M.

**Writes:**
- ≈ 32.6k in total, in batches of ≤ 250 statements through `db.batch()`;
- ≤ **25,000 own writes per UTC day** (N-4), including the delivered Ops events (ML-1010-3);
- account `rowsWritten + unpolled own + batch ≤ 60,000` (F-5 in force);
- **Fri 30 ≈ 11k** (A2-001 pilot + A2-002..A2-007);
- **Sat 31 ≈ 21.6k** (A2-008..A2-015, ECA, E-A, Q);
- **Sun 1: 0 writes.**
- The full rollback costs about the same again (§9).

## 6. Freeze windows and concurrency

- **FREEZES `b6d035f6…`:**
  - daily 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15 and 23:50–00:10 UTC;
  - Sun 04:00–07:05;
  - Mon 03:30–08:00.

  The runner refuses a batch inside any window. Batches also keep **±2 min clear of the sweep slots** (08:00, 12:00, 18:00, 22:00 UTC) and are not started after **23:45Z**.
- **New dated window (Main Lane adds to FREEZES before Fri 30):** "A2 run — other Entities writers frozen", **Fri 30 08:05Z → Sun 1 00:10Z**.
  - Paused for the window: `cf.meridian-entities-enrich` Phase 1–3 crons, `local.entities-enrich-boost`, `cf.meridian-entities-delta`, `cf.meridian-entities-seed`, and any 013 or ENT-CR1 write. They are paused through `ops_job_pause` or holds, and confirmed in writing, as in 011.
  - **Exempt:** the one-row `fi_serving_gate` flip (009, a different table) and 008 bond-table writes (different tables). Both still count against the shared headroom gate.
- **One production change at a time** (ML-1028-1). A2 batches do not run while another lane deploys `meridian-ops` (A2 reads `d1-today` and posts `run-event` there), or while a lane runs a bulk D1 write. The Main Lane sequences A2 against the Fri/Sat 005 and 002b deploys.

## 7. GO gates and run plan

**GO requires all of the following, each recorded with path and SHA-256:**
- **G-1:** Architect + Operations Lead reviews PASS (Thu 29), with any MUST-FIX applied.
- **G-2: criterion 3 re-established on the fixed matcher.**
  - A seeded random sample of **150** rows from the post-exclusion A set (3,648), adjudicated by the Data-Identity Lead against the pinned GC (name, legal form, country, category; parents where useful).
  - **Pass with 0 errors** (one-sided 95% Clopper–Pearson lower bound 98.02%).
  - **With 1 error,** extend to **237** with ≤ 1 error in total (LB 98.01%).
  - **Otherwise STOP and re-spec.** Any error is also checked for a new matcher class.
  - The sample is drawn **Thu 29** from the 16 Oct basis minus exclusions (identity does not depend on the fresh export). Seed `MA-OCT-A2.G2`.
- **G-3:** freshness gate FG PASS (§3).
- **G-4:** fresh export done and the `generate --a2` plan pinned (SHA). The counts are within: A ≤ 3,648 (withholds listed), ECA ≤ 44, E-A ≤ 296, Q = A, with the §2 STOP rule satisfied. Architect plan delta check (counts and SQL hash only).
- **G-5:** new job, emitter key, A2 read-ceiling file, and the dated FREEZES window, all in place. Other Entities writers confirmed paused.
- **G-6:** Founder "Approve A2 run".

| Day (UTC) | Work | Owner |
|---|---|---|
| **Thu 29** | Spec reviews (Architect, Operations Lead). C-1..C-6 code + tests (local). G-2 sample: drawn by LANE-11-ENG, adjudicated by the Data-Identity Lead (Cowork, offline GC). Ops: job registry row + key. Main Lane: FREEZES window. | REVIEW-A, Ops, LANE-11-ENG, LANE-11 |
| **Fri 30 ≥ 08:05** | FG (≤ 50 API calls) → fresh export (≈ 74k reads) → `generate --a2` → G-4 → Founder GO → **A2-001 pilot (250)** → read-back → adjudication of 50 rows by the Data-Identity Lead (50/50) and the Ops spot-check → `--a-adjudication` → **A2-002..A2-007** (≈ 11k writes in total). | LANE-11-ENG; LANE-11; Ops |
| **Sat 31 ≥ 08:05** | **A2-008..A2-015** → (ECA/EA release by the Operations Lead, RA-15) **ECA → E-A** → **Q** → post-run export → §8 verification → close-out report. Last batch by 23:45Z. | LANE-11-ENG; Ops |
| **Sun 1** | Doc only: close-out review. **No writes**; restore only with the Founder's say-so. | Main Lane |
| **Mon 2 ≥ 08:00** | 013 runs on the post-A2 state (§10). A2's rollback horizon ends at 013's first write. | 013 lane |

**Slip rule:** if G-2 or G-3 fails, or the pilot hits **E-4** (any wrong row in the 50), A2 stops:
- A2-001 is restored (RA-12), and E-A and ECA are dropped;
- **A2 is not re-planned in October** (Founder Q3).

If the pilot passes but Sat 31 runs short, the remaining A batches stop at a checkpoint. **Nothing runs Sun 1.** The Founder decides Mon 2 (resume before 013, or defer).

## 8. Acceptance criteria and spot checks

| # | Criterion | Check |
|---|---|---|
| AC-A1 | Applied A = plan A − withheld − raced; **0 read-back mismatches**; every batch inside its write estimate × 1.3 | Runner ledger, checkpoints |
| AC-A2 | **Invariants 0:**<br>- new duplicate LEIs;<br>- LEI, name, country or `type` overwrites;<br>- writes to any E-X1/E-X3 row (the 28, the 24 KI 22.44, report-only tiers, government rows);<br>- `updated_at` changes by A2. | Verify script on the post-run export |
| AC-A3 | **Pilot 50/50.** The Data-Identity Lead's adjudication of 50 seeded A2-001 rows (the APILOT method) plus the Ops spot-check. Any wrong row → E-4. | `a-adjudication` file |
| AC-A4 | **Sampled diff 200/200:** 200 random A2-touched rows against `gleif_006.db`, on every column A2 wrote | Verify script |
| AC-A5 | **API spot checks ≥ 10 A rows** (D-1), from the FG sample, after the write: the stored LEI's current GLEIF legal name and status match, or the difference is a listed post-28-Sep change | Local lane, ≤ 50 calls in total including FG |
| AC-A6 | ECA ≤ 44 and E-A ≤ 296 are written **only** where the parent's A write applied (E-2). E-3: 25 E-A edges each equal the child's RR `IS_DIRECTLY_CONSOLIDATED_BY` parent, 25/25. 0 edges for excluded rows. | Verify + sample |
| AC-A7 | Q only for applied A rows. Queue status `complete` for exactly those rows. | Verify |
| AC-A8 | **Budgets:**<br>- reads ≤ 250k cumulative and ≤ 200k/day;<br>- own writes ≤ 25k/day;<br>- account ≤ 60k at every check;<br>- 0 batches in a freeze window. | Ledgers, gate log |
| AC-A9 | **Hand-offs written:**<br>- `withheld-013.json` (E-X2) to 013;<br>- the 28 exclusions + FG-changed rows as a 004 `gleif_handoff` ticket (M5 style);<br>- the KI 22.44 note unchanged. | Close-out |

## 9. Rollback manifest

- **Retained (SHA-256 manifest written at close, like 011 R-2):**
  - plan + lists + `A2_exclusions_DIL.json`;
  - FG and G-2 files;
  - every checkpoint, pre-image and read-back;
  - `runlog.jsonl`, `events.jsonl`, `d1-ledger.jsonl` (final), `gate.jsonl`;
  - the export directory.

  All live under `~/MeridianAtlas-work/gleif-a2/`, outside the repo and iCloud, mode 600. The manifest is re-issued if any file grows after close (011 CA-1 lesson).
- **Restore order:** Q → E-A → ECA → A (runner `RESTORE_ORDER`), from pre-images, under the same CAS and headroom gates. Cost ≈ the forward writes (≈ 32k).
- **Horizon:** a restore is valid only until **013's first write (Mon 2 ≥ 08:00Z)**. After that, corrections are per-row Data-Identity Lead packets.
- **011's own rollback inputs** (`gleif-011/`) are untouched by A2.

## 10. 013 interaction (013 runs Mon 2)

- **No merge conflict:**
  - A2 writes Level 1 only on the **older (surviving) side** of the 392 twin pairs (L11-7). The newer twins are in `handoff-013.json` and are never A2 targets.
  - So 013's S1 rule ("the older row survives") is unchanged. Now some survivors **do** hold an LEI, which 013 must accept but not require (CLOSEREV-ARC 3.5(a)).
- **013's plan is generated from a post-A2 export** (3.5(b)), so its pre-images include A2's writes. **013 must not start before the A2 close-out** (or the Founder's decision under the slip rule).
- **E-A edges:** their parents are LEI-bearing rows. Twins have no LEI, so no A2 edge points at a row 013 will merge away. 013's S1 repoint of `entity_relationships` should still use `INSERT OR IGNORE`, to absorb any duplicate edge after a repoint (013's own spec).
- **Withholds (E-X2)**, e.g. LEIs that live Phase 3 placed on a new `holding` row, go to 013 as duplicate-identity inputs (OTP-Bank pattern). They are never written by A2.
- **Protected pairs:** the three `do_not_merge` pairs (931/1216, 2589/25577, 2014/25655) are LEI-bearing and not A2 targets. 013 reads them from Ops (003 §10.6).

## 11. Reviews (Thu 29)

- **Architect (REVIEW-A):** §2 rules and the STOP rule; C-1..C-6; §5 budgets; §7 gates G-2/G-4; §9 horizon; §10.
- **Operations Lead:** §5 budgets and headroom; §6 windows and the dated freeze; C-2 job and key (K-1..K-4); release files (RA-15); §9 manifest.
- Neither reviewer wrote this spec or the 011 code.

## 12. Founder questions (3)

| # | Question | Recommendation |
|---|---|---|
| **Q1** | Level 1 freshness: accept the pinned **28 Sep** values behind a **≤ 50-call freshness gate** (§3), or refresh Level 1 from a newer Golden Copy? | **The gate.** A newer GC would re-open 006's tiers and the sample, and could not be done by Fri 30. The gate catches status and name changes on a sample, and withholds them. |
| **Q2** | Freeze the other Entities writers (enrich crons, boost, delta, seed) for **Fri 30 08:05Z → Sun 1 00:10Z**, as for 011? | **Yes.** Live Phase 3 creating `holding` rows during A is exactly how the OTP Bank duplicate arose (F-2). Enrich loses about 1.5 days of drain. |
| **Q3** | If G-2, the freshness gate or the A2 pilot fails (E-4), **defer A2 to November** rather than re-plan again inside October? | **Yes.** A second re-plan would collide with 013 (Mon 2) and the 3 Nov sign-off. The October release then ships with A deferred, as already accepted on 21 Oct. |

## 13. Risks

| Risk | Mitigation |
|---|---|
| A matcher class not covered by R-LF/R-CUR/R-FUND | G-2 (150 rows, LB ≥ 98%), pilot 50/50, E-4 |
| Fresh export shows many E-X2 withholds | Listed for 013; A2 never writes them; counts reported at G-4 |
| D1 / Cloudflare 7403 or 7009 during a batch | 011 P-3 / B-1..B-4 retry rules (no blind re-send); pre-flight `wrangler whoami` (CLOSEREV-OPS) |
| Sat 31 runs short | Stop at a checkpoint; no Sunday writes; Founder decides Mon 2 before 013 |
| `gleif_006.db` retention | Kept until A2 closes (ML-1025-5); deletion date set at close (CLOSEREV-ARC suggests 30 Nov at the latest) |
