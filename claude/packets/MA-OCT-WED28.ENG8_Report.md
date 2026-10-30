# MA-OCT-WED28.ENG8 — Report (LANE-8-ENG, Engineering Lead)

Control `ae0387c0…47ed` and Task `cef3af72…eff9`: both re-hashed, and both match the board row (line 76). No `.git/*.lock`. Branch `October-2026`; origin was at `721d093` on open. FREEZES `b6d035f6…b8bc` (tonight: 23:50–00:10Z only).

## Schedule correction
The Task names a 21:00Z sweep. The health-check LaunchAgent fires at local 08:00, 12:00, 18:00 and 22:00, and the clock has been GMT since 25 Oct. The log confirms 18:00:03Z tonight, so **tonight's sweep is 22:00Z**:
- step 3 is the 22:00Z sweep;
- deploy 4 goes at ≥ 22:20Z, still before the 23:45Z stop and the 23:50Z freeze.

## Change log (UTC; one production change at a time)
- 19:42Z: local only. The runner logging change is committed (`f444ce7`) and placed in the shared checkout's working tree (no production change).
- 19:44Z: **starting** 008 R-1 (PepsiCo Singapore): D1 writes to `bond_issuer_link` / `bond_issuance` only. Applied 19:44:33Z, done 19:45Z. (The SQL's `linked_at` literal reads 19:50:00Z; it was written ahead of the run.)

### 008 R-1 three-point check (recorded before the write)
1. **Indexes.**
   - UPDATE: `SEARCH bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1 (accession_number=? AND tranche_seq=?)`, with the guard's `SEARCH bond_issuer_link USING COVERING INDEX sqlite_autoindex_bond_issuer_link_1 (cik=?)`.
   - INSERT: by PK.
   - No scan.
2. **Single execution < 50k.** 4 rows plus 1 link row.
3. **Budget.** Estimated ≤ 20 row-writes:
   - link: table + PK autoindex;
   - 4 rows: table plus the `idx_bi_cik_final_key` entry move (`cik` is the leading column). `instrument_key` is NULL, so `idx_bi_instrument` is untouched.

   `d1-today` at 19:49Z: 89 written. Entities domain, bond tables only. No serving gate is touched (none exists).

**Files:**
- SQL `App/Corporate Atlas/bonds/state/r1-pepsico-sg-2026-10-28.sql` `d6f33154…79fc`;
- rollback `…/r1-pepsico-sg-2026-10-28.rollback.sql` `696f88c0…27a4`.

**Rollback:** move the 4 rows back to `0000077476` (guarded on `cik = '0002007029'`), then delete the link only if no row remains under it.

**Deviation from DIL14 R-1's literal steps** (delete the 4 rows, then re-ingest under 0002007029). This lane re-points `cik` in place instead, with one guarded UPDATE. Re-ingesting cannot produce the right result today, for two reasons:
- the parser's cover-issuer hint misses this filing (`coIssuers` is empty), so a delete followed by a PepsiCo run would re-create the rows under 0000077476;
- R-1's own `paused` link is not polled (A8-5).

The rows' other columns come from the same parse, so the end state equals R-1's. The Data-Identity Lead should confirm this at re-adjudication. Future PepsiCo incremental runs skip the accession, because `knownAccessions` is keyed on `accession_number`.

### 008 R-1 result ✅ (19:44:33Z, one batch via `--command`, per-statement meta)
| Statement | changes | rows_written |
|---|---|---|
| INSERT OR IGNORE link `0002007029` | 1 | 2 |
| guarded UPDATE of the 4 rows | 4 | 8 |

- **Total 10 writes** (estimate ≤ 20). `d1-today` 89 → 89 (D1 analytics lag).
- **Re-run:** `changes [0, 0]` (idempotent).
- **Link read-back:** `0002007029`, `entity_id` NULL, `unmatched`, confidence 1, "PepsiCo Singapore Financing I Pte. Ltd.", `paused`. PepsiCo Inc `0000077476` → 1457 (`cik`, 95, active) is unchanged.
- **Final counts:** PepsiCo Inc 19, PepsiCo Singapore 4. Table totals unchanged (final 633, parse_failed 9, preliminary 184, skipped_non_debt 45, skipped_other 51, skipped_structured 21).

### AC12 / PepsiCo re-check
**M-3 (DIL review `5bb8b8c7…2777`), exactly as defined: PASS.**
- **S1** (8 reads): all 4 rows `0001104659-24-022370` / 1–4 → **`cik = '0002007029'`**, `final`, `parse_confidence` 85, `instrument_key` NULL.
- **S2:** not needed; no S1 row has an `instrument_key`. Both PASS branches hold (cik moved, and key NULL).

**008 §16 checks:**
- **Served-row rule** (`final` and `parse_confidence ≥ 60`): the 4 rows are served under the issuer's own CIK. Its link is `unmatched` / `entity_id` NULL, so they **no longer attach to PepsiCo Inc 1457**.
- **N8-3:** 0 `instrument_key`s with more than one CIK (276 keyed finals read).
- **Guarantor check:** 0 finals reach entity 1457 through any CIK other than `0000077476`.

**AC12 overall (DIL14 §5): not passable tonight; it stays with the Data-Identity Lead.** The wrong-issuer criterion is now met for sample row 9 and for P-1, the only cover-scan hit. Three things are still open:
1. **R-2:** the 37 missing floating spreads, including sample rows 43, 44 and 46. A parser change plus a re-parse; not in this Task.
2. **R-3:** the EDGAR filer-list re-scan, needed for "0 wrong-issuer links" population-wide.
3. **The Data-Identity Lead's re-adjudication**, including confirming this lane's in-place re-point.

**Serving gate:** not opened; it does not exist yet (009 creates it Thu).

## Step 1: sweep logging ✅ (local; 19:42Z, before 21:00Z)
**Change:**
- `13F Seed/check-pipeline-health.js`: one new line per sweep, `response | HTTP <status> <full body JSON>`, for every outcome (success, 202, error), whenever a JSON body exists.
- The existing summary line is unchanged. Request headers and the ingest key are never logged. The body holds no secret.

**Test** (`App/Ops/tests/health-check.test.mjs`): +2 checks, **17/17**.
1. The full body is logged verbatim, with all 11 keys.
2. Neither the ingest key nor any request header appears in any log.

Mutation: the previous runner fails check 1 (16/17).

**Commit:** **`f444ce7`** (explicit paths: the runner and the test), pushed `721d093..f444ce7`.

**Live:**
- The LaunchAgent runs the **shared checkout's** copy (`cd …/13F Seed && node check-pipeline-health.js`).
- That file was clean and equal to `721d093`. It was overwritten in the **working tree only** with `git show f444ce7:<path>`, and its blob hash now equals `f444ce7`'s. The index is untouched.
- **For whoever fast-forwards the shared checkout:** that file now shows ` M` but equals the target. Run `git checkout -- "13F Seed/check-pipeline-health.js"` first if git refuses the merge.

## Step 4 prep: deploy-4 tree (local, 19:47Z)
- **Worktree:** fast-forwarded to `721d093`, then `f444ce7`.
- **Diff 02** (`107b0cf0…a728a`), `ops-api.js` hunks applied with `-C1`. A6 moved the context; the toml hunk failed only because `OPS_SERVICE_ACTORS` now holds the Client ID. **Verified:** the worktree diff's 41 `+`/`-` lines are **identical, in order,** to diff 02's.
- **Toml:** `OPS_SWEEP_GLEIF_CHECKS = "true"` and `OPS_SWEEP_AUTORESOLVE = "true"` added after `OPS_SERVICE_ACTORS`, with diff 02's comment.
- **Files:** `src/sweep-ext.js` `15f3f179…` and `tests/sweep-ext-contract.mjs` `476e41e1…`, the reviewed versions.
- **Suite on the deploy-4 tree:**

  | Test | Result |
  |---|---|
  | `sweep-ext-contract` | 34/34 |
  | `sweep-contract` | all passed |
  | `cases-contract` | 66/66 |
  | `migration-m1` | 29/29 |
  | A6 `control-split` | 100/100 |
  | `admin-jobs-lateness` | all passed |
  | `health-check` | all passed |
  | `lateness` | all passed |
  | `boost-heartbeat` | all passed |

- **Endpoints:** `meridian-ops` serves 7 (A6) + 4 (003) = **11 ≤ 15**. Deploy 4 adds none.
- **Dry-run build:** 85.57 KiB; bindings include both sweep switches; the bundle has 12 occurrences of `gleif_checks` / `auto_resolved` / `suppressed`, against 0 at deploy 3.
- **Not committed yet.** It is committed after the S-3 proof, so no other lane can deploy sweep code from origin before then.

## 008 code commit ✅ `16b2b10`
- **Contents:** 41 files by explicit path, pushed `29ddfb4..16b2b10` after `pull --rebase` onto LANE-1-ENG's `0352b6b`, `58cd922` and `29ddfb4`. None of those touches `App/Ops`, and the deploy-4 tree re-tested green after the rebase.
  - `App/Corporate Atlas/bonds/`: `.gitignore`, `bonds-config.json` (no secret), `bonds-{discover,ingest,lib,parse}.mjs`, `bonds-{pause,resume,status,stop}.sh`, `tests/bonds-{parse,ingest}.test.mjs`;
  - `fixtures/`: 29 gzipped public SEC documents (1.7 MB) plus `manifest.json`;
  - `App/Corporate Atlas/migrations/008-bonds.sql`.
- **Tests at commit:** parse **26/26**, ingest **17/17**, in both the shared checkout and the worktree.
- **Left untracked (data/state; `bonds/.gitignore` excludes `state/`):** `App/Corporate Atlas/bonds/state/` (38 MB): batches cache coverage-2026-10-16.json cursor.json d1-ledger.jsonl discovery-dev.json dryrun-2026-10-14.json dryrun-2026-10-14.sql dryrun-2026-10-15.json dryrun-2026-10-15.sql events.jsonl finals-2026
-10-16.json headroom-state.json heartbeat.log link-seed-2026-10-15.sql ops-recon-2026-10-16.json packc-b3.json packc-c2-leis.json packc-c2-name-leis.json packc-c2.json packc.jsonl pilot-readback.json 
r1-pepsico-sg-2026-10-28.rollback.sql r1-pepsico-sg-2026-10-28.sql report-tables-2026-10-14.txt report-tables-2026-10-15.txt runlog.jsonl sample20-2026-10-14.txt sample60-2026-10-16.json sample60-2026
-10-16.md sec-requests.jsonl. This includes tonight's `r1-pepsico-sg-2026-10-28.sql` and `.rollback.sql`.

## Step 3: S-3 proof on deploy 3 ✅ PASS
**The sweep:**
- The 22:00Z sweep fired **late, at 22:13:03Z**. The LaunchAgent fires after the Mac wakes, so the delay is likely sleep.
- It ran on `meridian-ops` `14aa968c`; the live version was re-confirmed at 07:14Z Thu as 100% `14aa968c`.
- **First run of the new `response |` line.** Full body: `HTTP 200`, run `37fac0a8…`. Its keys, all of them:

  `ok, run_id, lookback_days, hold_all_jobs, headroom, etf, findings, already_open, new, raised, overflow, raised_today_before, daily_cap, open_counts, rows_read`

- **Result: no `suppressed`, `gleif_checks`, `auto_resolved` or `autoresolve_skipped_reopened` key.** Deploy 3 carried no sweep code (BREVA S-3).

**Values:**
- raised 1: `EXC-S-7541C9FEBD5D`, `job_missed` sev3, boost's 17:50Z slot;
- findings 11, already_open 10;
- open sev2 2 / sev3 20;
- rows_read 178;
- headroom 99,897.

## Step 4: deploy 4 ❌ NOT DONE (window expired)
- **Why:** this session was next active at **07:14Z Thu 29**, after the Control's 23:45Z stop for production steps. Deploy 4 was **not** attempted. The live version is still `14aa968c`, and no rollback was needed.
- **The deploy-4 tree is ready and uncommitted** in `~/MeridianAtlas-work/ma-oct-003/eng8-worktree`, on `16b2b10`: diff 02 verified line for line, both switches, suite green, dry-run built. It stays uncommitted on purpose, so no lane deploys sweep code from origin unplanned.
- **For the Main Lane:** re-issue deploy 4 in a new window. It needs:
  - commit, then deploy (rollback `14aa968c`);
  - the `d1-today` check;
  - verification by a manual sweep. The runner does support one (`node "13F Seed/check-pipeline-health.js"` gives `trigger=manual`).
  - **Ordering with 004:** 004 goes live on `meridian-ops` Thu 29. Deploy 4 must not collide with it, and the two must land in a set order (one production change at a time).

## Step 5: note for the 004 lane
- **No deploy-4 commit exists yet.** The current base is `origin/October-2026` **`16b2b10`**, whose `App/Ops` equals deploy 3's committed tree (`76f4261`).
- If deploy 4 lands first, 004 rebases onto that commit. If 004 lands first, this lane rebases diff 02 onto 004.
- The Main Lane must choose the order.

## Close-out
**Done:**
- step 1: logging `f444ce7`;
- step 2: R-1 plus M-3 PASS (10 writes);
- step 3: S-3 PASS;
- 008 code commit `16b2b10`.

**Not done:** step 4 (window expired) and step 5 (handled as above).

**Totals:**
- **D1:** 10 row-writes by this lane, plus reads of about 2.5k.
- **Production:** one change (R-1, 19:44Z). No deploys.
- **Git:** `f444ce7` and `16b2b10`, both by explicit path. This report is not committed.

**Other open items:**
- **AC12 overall** stays with the Data-Identity Lead: R-2 spreads, R-3 filer-list scan, re-adjudication, and confirming the in-place re-point.
- **Shared checkout:** `13F Seed/check-pipeline-health.js` shows ` M` but equals `f444ce7`.
