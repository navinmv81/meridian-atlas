# MA-OCT-011.CLOSE — Report (Thu 22 Oct 2026, under ML-1022-1)

**Control:** v1 `claude/packets/MA-OCT-011.CLOSE_Control_v1.md`, SHA-256 `fec9dc0b3fd60ce6fe3486b962e3307d4406694201fd41a385df8e46ff64d96a` (matches the board row).
**Task:** v1, SHA-256 `2b92a48a1d071401e5122ff8270408e5e718e30ca9fb524173f7d6ea65c9d3ef` (matches the Control).
**Lane:** LANE-11-ENG, Engineering Lead. **Plan:** `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8`.

## Result

**PASS on the completed steps (P, B, C, C-reasons, RC-15, E-C). A, ECA, E-A and Q were not written: A was deferred by the Founder (ML-1021-2).**

| Check | Result |
|---|---|
| §9 whole-table LEI-bearing rows | **16,936 observed = 16,936 expected** (nominal 16,935 + 1 traced) |
| Sampled diff vs `gleif_006.db` | **200 / 200**; E-A part not applicable |
| Invariants | all **0**: new duplicate LEIs, `normalized_name` / `type` writes, LEI / country / non-placeholder-name overwrites, wrong-LEI rows touched, A rows live; KI 22.9 edges unchanged |
| Spot checks vs the 28 Sep Golden Copy | **25 / 25** (P 7, B 6, C 6, C-reasons 6; 175 columns) |
| Totals | 76 forward batches + 1 restore; **0 mismatches** in the whole run; 54,936 D1 writes; **reads 247,468 / 350,000** |

**This packet:**
- **Writes: 0.** No A, ECA, E-A or Q action. No key, Worker or git change.
- **Reads:** 74,606 (the re-export), within the 177k remaining.
- **Run time:** 17:16–17:21 UTC, after the 16:45–17:15 freeze. It started at 17:01 inside that freeze and waited.

**Instruction:** Founder (chat): "execute it today, Thu 22, under Main Lane ruling ML-1022-1 (brought forward from Fri 23). Start after 08:05 UTC; avoid 10:45–11:15 and 16:45–17:15 UTC. Reads only."

**Preflight:** no locks; HEAD `c3c6e4a`; no git writes. Runner `29300a0e…59fa` (B-5; unchanged since Mon 19); core `830b49a8…`; plan `shasum -c` OK.

## 1. Runner state
- `status.sh` (`b04f5d8c…`): no runner running, no pause or kill flags. Holds present:

  | Hold | SHA-256 |
  |---|---|
  | `a-pilot.json` | `61af982c…` |
  | **`e4-trigger.json`** | `7e3c9153…3094` |
  | **`ea-dropped.json`** | `b9e18517…daac` |

- **Cursor file `cursor-e3854698494d3be0.json`: next = A-001 (index 73)**; 75 done; restored = [A-001].
- Gate check (21 Oct 18:15, no D1): A-001, A-002, ECA-001, EA-001 and Q-001 are all refused ("E-4 trigger open … A, ECA, E-A and Q are stopped"). `ea-dropped.json` keeps ECA and E-A dropped even after the trigger is lifted.
- **"A-001+" vs "A-001" (Ops' note):** the run log's per-line `cursor` field is written with the forward-batch convention, where `after: "<id>+"` means "this batch completed". The runner uses it for **restore lines too**. So the A-001 restore line reads `{"before":"A-001","after":"A-001+"}`.
  - That field is a per-line marker, not the cursor.
  - **The cursor is the cursor file**, which `cmdRestore` moved back to A-001 (index 73), recording A-001 under `restored`.
  - Suggested follow-up for a later build: write `after: "<id>-restored"` on restore lines. Not changed here (reads-only packet).

## 2. Post-run re-export and §9 checks (re-based without A)

**Re-export (X1 / X2, read-only, capped at R9-1's remaining headroom):** 17:18:38–17:18:51 UTC; **74,606 reads**; max page 5,000; 0 writes.

| File (`exports/2026-10-22-postrun/`) | Rows | SHA-256 |
|---|---|---|
| `entity_master.jsonl` | 44,411 | `8a0fde9f61694d75899a8d131e576cf4b3d7ebc64614f0cccfcac35940956621` |
| `queue.jsonl` | 29,175 | `a599442b0801bbbe96dced0ef21bc041ba512fb0ff0e7fd2a0d9f6eb34974fd5` |
| `relationships.jsonl` | 1,020 | `b036254d5a3a883654ed9c4fdbbae80e19c52891524ebd8bef611f4d12a2daf6` |
| `manifest.json` | — | `a88c18ab60b7d162eb0d418f3448fb4d7fc9414e4ee930ac8ec1899b01e838a9` |

**Two failed attempts first, both reading nothing** (R9-1 unchanged):
- **17:16:14, Cloudflare 7403:** the wrangler token-refresh race (config rewritten at 17:16Z), the 3rd time (Fri 16, Sat 17, today).
- **17:16:23, Cloudflare 7009 "Upstream service unavailable"** after about 2 min: a D1 / Cloudflare-side outage.
- A `SELECT 1` probe at 17:18:32 succeeded (0 rows), and the export completed.

**§9** (`verify postrun --a-deferred --p-raced 1`, Friday's export as pre-run, today's as post-run; `closeout/postrun-2026-10-22.json` `6af4ccdfbea077d7923623eeb00497871bc2b864e19b14e826d42aff4061edf9`): **PASS**.

**LEI-bearing rows (ML-1015-1, whole table governing):** observed **16,936** = expected **16,936**, unexplained 0. The Task's nominal 20,612 − 3,677 A = **16,935**. The +1 is traced exactly:

| Term | Rows |
|---|---|
| 29 Sep LEI rows | 16,627 |
| + LEI rows live Phase 3 added before Fri 16's export | +5 (467290 OTP Bank, 467291, 497274, 502683, 502684) |
| + LEI rows other writers added during the run | +1 (502685 Goldman Sachs AM Intl Holdings, Phase 3, Sat 17 06:50:44) |
| + 011 P rows inserted | +303 |
| **= observed** | **16,936** |

Against the nominal 308 P:
- 4 P parents were already present at export (4 of the +5);
- 1 P row raced (the +1);
- so P-equivalents net to 0, and the **+1 is OTP Bank's holding row 467290**: an A-overlap parent created by Phase 3 on 6 Oct, not a P row.

29 Sep basis (traceability): 16,627 + 0 A = 16,627.

**Other §9 figures:**

| Measure | Value | Trace |
|---|---|---|
| Phase 3 pool | **0** (5,825 at Fri's export) | below the spec's ≤ 10 (see NLD) |
| `NO_LINK_DECLARED` | **165** | = 128 no-reason rows (spec list) + 24 wrong-LEI rows (never touched) + **5** live-Phase 3-created holding rows outside the 006 basis (467290, 467291, 497274, 502683) and B row 204823 (its fallback raced) + **8** rows GLEIF gives neither parent nor reason for (the 7 B "neither" rows + 1 P parent, 502793 IESI Corporation). 011 hydrated those 8 and left them in the pool; live Phase 3 then stamped its generic marker, correctly, since GLEIF has no reason. That is why the pool reads 0, not ≤ 10. 10,597 NLD markers were replaced overall. |
| `legal_parent` edges | 73 → **752** | +679 = **674 by 011's E-C** + 5 by live Phase 3: (1636, 207528), (1636, 502685), (27251, 502684), (502685, 207528), (502715, 204823). 0 removed. |
| `ultimate_parent_exception` set on pre-existing rows | **15,618** | — |
| Invariants | **0** | new duplicate LEIs; wrong-LEI rows touched; `normalized_name` / `type` changed; LEI overwritten; non-NULL country overwritten; non-placeholder name changed. **KI 22.9 edges unchanged. A rows live: 0.** |
| **Sampled diff** | **200 / 200** match `gleif_006.db` on the columns 011 wrote | E-A part: **not applicable** (A deferred) |

**Code (011 path; reads-only analysis support):** `verify postrun` gained `--a-deferred` (base A = 0; reports the nominal 16,935) and `--p-raced <n>` (plan P rows whose LEI row another writer created, counted in drift). `scripts/gleif-reconcile-011-verify.mjs` `c4c287d6…` → **`b887e2f98e28d87fb7914e36f4614af85d9c4a0fdce0f1e53be302f285c6bb21`** (258 lines). The runner is unchanged.

## 3. Spot checks (25 rows vs the 28 Sep Golden Copy)
`closeout/spot-check-25.json` `20ed4b55205ea304e13809088eb772d5ebd94cabb10c4ed3d294546b7716ba13` (seed `MA-OCT-011.CLOSE-spot-2026-10-22`).
- **25 / 25 pass**: P 7, B 6, C 6, C-reasons 6; 175 written columns. Each column equals the value written and the GC value (Level 1, parent mirrors / names, verbatim RX reasons).
- **One sampled B row took the §4.2c path:** 211195 "US EQUITY RESEARCH". Its B statement raced on Mon 19 (Phase 3 drained it), and **B-024-fb** wrote its reasons (`NON_CONSOLIDATING` ×2, = GC RX). Level 1 is not refreshed on drained rows (RC-8). It was checked against the fallback actually applied.
- A first pass of the script compared that row against the B plan and flagged it; corrected.
- **GLEIF API:** not called (reads-only packet). The Task says the API is blocked by the egress proxy. Note: from **this** lane (local Claude Code), the GLEIF API answered 50 / 50 calls with HTTP 200 on Fri 16. The block may apply to the Cowork lanes; I have not re-tested it today.

## 4. Close-out lists (SHA-256)

| File (`~/MeridianAtlas-work/gleif-011/`) | SHA-256 | Contents |
|---|---|---|
| `plans/release-2026-10-16/handoff-013.json` | `0597e15dedcf50a4bcc4f8e35b3a9f826a1b0278c093699aa3808d70b3a56009` | **013 hand-off (§11, R-3):** 392 newer twins (row + queue row) + **9 deferred LEIs / 22 rows with full payload** (Level 1, Level 2, GC provenance). **Note:** with A deferred, the 392 pairs' older (S1-survivor) rows have **no** LEI from 011 yet. 013 / A2 must not assume the survivor holds it. |
| `plans/release-2026-10-16/review-lists.json` | `db65589b046990c21205e5f5016f78a5eab7229482eb324cb246149bed1ee5e3` | Manual review: 31 LEIs / 62 rows (case iv); 9 D7-1 government rows; 128 no-reason rows; 215 deferred E-A edges; 1 E-1 exclusion; report-only tiers T1_LAPSED 1,342 / T1+ T1c 1,739 / N+ 852 / review 2,336 (OQ-12) |
| `plans/release-2026-10-16/exceptions.json` | `08417ae3366e386c042dd96ee7ae4528650a2ae76b489a9af31d31bd23d045dd` | plan exceptions incl. the **collision list (0)**, 6 F-2 deferred parents, 2 new pool rows outside the 006 basis, 6 not-in-tier fields, A withheld (2019 OTP Bank) |
| **`closeout/a-deferral-list.json`** | `86ec9d99305887e26c080e1c4ea4fde8410d06fbc63a0a30f5ff23419a206d56` | **A deferral (A2 re-plan input):** **3,676 A**, **298 E-A**, **44 ECA** (the Task says 45; the fresh-basis plan has 44, since OTP's parent row pre-existed). Per-row flags below. |
| `closeout/exceptions-closeout.json` | `7fe7eb2f2a0f147e59e6783fe92249f75618d25fb44a423d6a9c8953630d4a32` | 204823 and 207528 (Mon 19); the **OTP Bank pair** (2019 operating, no LEI / 467290 holding, `529900W3MOO00A18X956`); the Goldman Sachs raced P row 502685; collision list (0); the 6 F-2 deferred parents |
| `closeout/retained-rollback-inputs.json` | `ca6d6cc854400e96b9a6aab7f04acac1448922bdfa41ffe7874eb57a55335a28` | **R-2 / §10 retained inputs:** SHA-256 of all **268** files (140.7 MB): plan + lists, every checkpoint, pre-image and read-back, `runlog.jsonl`, `events.jsonl`, `d1-ledger.jsonl`, `recon/*`, holds, the read-ceiling record, the cursor, the Fri 16 export, the adjudication files. **Keep ≥ 30 days after 011 closes and until 013 closes, independently of `gleif_006.db`** (deleted 31 Oct under R4). |
| `closeout/postrun-2026-10-22.json`, `closeout/spot-check-25.json` | above | §9 and spot-check evidence |

**A deferral flags** (in `a-deferral-list.json`):
- **2303, 2488:** APILOT wrong identity (E-4).
- **APILOT's 6 named legal-form rows:** 483, 517, 1156, 1275, 1337, 2303. **The Data-Identity Lead's full 29-row list was not published in APILOT**; only these 6 IDs are named. **It is needed from the Data-Identity Lead for A2.** My own rule-based derivation found 16 (11 beyond the named 6), which is **not** the DIL list and is labelled non-binding.
- **New finding for A2:** **42 A rows match an LEI whose GC category is `FUND`**, the class of 2488 ("HONG KONG DOLLAR" → an HSBC sub-fund). It is mechanical and bounded, a candidate exclusion for the A2 re-plan alongside the legal-form rows.

## 5. Totals

| Day (UTC) | Forward batches | Restore | Rows applied | Raced | Mismatches | D1 writes | Ops events | 011 total | D1 reads |
|---|---|---|---|---|---|---|---|---|---|
| Fri 16 (export) | — | — | — | — | — | 0 | 0 | 0 | 73,489 |
| Sat 17 | 23 | — | 5,553 | 1 | 0 | 24,752 | 47 | 24,987 | 29,086 |
| Sun 18 | — | — | — | — | — | 0 | 0 | 0 | 0 |
| Mon 19 | 47 | — | 11,059 | 130 | 0 | 24,403 | 95 | 24,878 | 56,136 |
| Tue 20 | 5 | — | 813 | 0 | 0 | 2,945 | 10 | 2,995 | 11,637 |
| Wed 21 | 1 (A-001) | **1 (A-001)** | 250 → restored | 0 | 0 | 2,836 (1,543 + 1,293) | 4 | 2,856 | 2,514 |
| Thu 22 (re-export) | — | — | — | — | — | 0 | 0 | 0 | 74,606 |
| **Total** | **76** | **1** | **17,675** (17,425 standing) | **131** | **0** | **54,936** | **156** | **55,716** | **247,468** |

- **Final cumulative reads (R9-1): 247,468 / 350,000** (plus 1 diagnostic read outside the ledger on Sat 17 = 247,469). Below Fri 16's 286,978 projection, because A never ran.
- 011 writes never exceeded 25k on a day.
- Every run day has an Ops R-4 sign-off: Sat 17, Mon 19, Tue 20, Wed 21 (RECOND, all MATCH).
- **Standing changes:** 303 P rows; 7,436 → 5,823 planned B, **5,694** applied plus **127** fallback upgrades; 738 C; 9,860 C-reasons rows; 29 RC-15; **674 E-C edges**.

## 6. Hand-offs for Sat 24+ (not done in this packet)
- **K-5 (RA-13):** set the `gleif-011` emitter in `OPS_INGEST_KEYS` to the all-zero hash, or remove it, and record which. LANE-1-ENG with the Operations Lead; a `meridian-ops` secret change after the N-3 freeze ends (Sat 00:00 UTC). The key file `~/MeridianAtlas-work/gleif-011/ops-ingest.env` (mode 600) can then be deleted.
- **Boost resume:** after 23 Oct, by LANE-1-ENG (`ops_job_pause` row id 1 ends 24 Oct 00:00Z; then `entities-enrich-boost-resume.sh`). Separate packet.
- **A2 re-plan inputs:**
  - `closeout/a-deferral-list.json`;
  - APILOT's adjudication (`A-001_adjudication_DIL.json` `e2ee84ed…b5c`);
  - the DIL's full 29-row legal-form list (to be published);
  - the 42 GC-`FUND` rows;
  - the currency-name class (2488);
  - the requirement for a fresh 50 / 50 pilot.
  
  A re-plan also needs a **fresh export**, because the Fri 16 plan's A pre-images will have drifted. Note `gleif_006.db` retention ends **31 Oct** (R4 / N-6): an A2 after that needs a rebuilt or newer GC and re-run tiers (N-2).
- **013:** the hand-off file above. **013 rollback horizon (AR11-1):** 011 rollback stays valid until 013's first write.
- **Retention:** `~/MeridianAtlas-work/gleif-011/` per R-2 (manifest above).
- **Commit list (ML-1012-2):** the 011 code files are still untracked, for the Main Lane's commit list:

  | File | SHA-256 |
  |---|---|
  | runner | `29300a0e…59fa` |
  | core | `830b49a8…` |
  | plan generator | `02ac8c67…` |
  | verify | `b887e2f9…bb21` |
  | tests | `962cef28…` |
  | dry run | `1510c072…` |
  | 4 control scripts | status `b04f5d8c…`; pause, resume, stop as at build |

**Stop point:** after this report.
