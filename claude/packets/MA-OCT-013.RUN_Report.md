# MA-OCT-013.RUN — Report (Engineering Lead for the Data-Identity Lead, LANE-11-ENG)

**Control v2** `96836f24e5c49ac1cf002d9a0dccbb0b18589a01d36f343081d5c8ca474a3ff6`: matches `STATUS_BOARD.md` line 110, which shows the Founder's v2 approval. **Task v2** `4d50af022d8635d0036247d15920fd693ccc819d23e30ad89e1f54ff0dd0ef0a`: matches the Control.
- **Day 1 timing:** brought forward under Main Lane ruling **ML-1106-1** (start from ~09:30Z instead of 18:30Z).
- **Runner:** `5e41e7b`, in my own worktree `~/MeridianAtlas-work/ma-oct-013/run-worktree` (detached).
- **Spec:** rev 1 `e6dc8567…f098`.
- **Repo:** no `.git/*.lock`; branch `October-2026`.

## Day 1 — Fri 6 Nov 2026

### Pre-flight (R0)
- **12:01Z:** the session opened. That is later than the ruling's ~09:30Z; the Founder invoked the lane at about 12:00Z.
- **Tooling:** `/usr/local/bin/wrangler` 4.96.0; `whoami` OK (account `ea360704…`).
- **09:00Z facts backfill: not active.**
  - `com.meridianatlas.financialfact-backfill` shows no PID and last exit **78**: launchd cannot run it, the known MA-OCT-000 finding.
  - Its logs were last written 2026-08-23 09:27Z.
  - `ops_job_run` has no event for it today.
  - Nothing is writing, and nothing can overlap the run.
- **Entities seed:** Mondays only; not in the window.
- **Boost:**
  - It **already fired today at 11:50:04Z** (`start` + `success`), inside the 11:45–12:15 band and before any 013 activity, so there was no overlap.
  - **12:02:57Z:** paused with `App/Corporate Atlas/scripts/entities-enrich-boost-pause.sh` in the shared checkout, where the LaunchAgent runs (flag `.entities-enrich-boost-paused`, as ML-1106-1 instructs).
  - **Resume after Day 2** with `entities-enrich-boost-resume.sh`.
  - A paused boost fire is a no-op: no network, no heartbeat.
- **FREEZES:** live `47874339ac23828813bae41d88ce5f7a0e1cbf6876b559d9b598e34ca7cfa0aa` (the day-1 window from 09:15Z; day 2 Sat 08:05–14:00Z).
  - The runner reads FREEZES from its own repo root, where the worktree at `5e41e7b` had the stale `4d8202bb…`.
  - So the live file was copied byte-identical into the worktree (local only, not committed).
  - The runner skips its own `013 run …` windows, and every recurring band still applies.
- **Boost flag in the worktree:** the runner checks the flag under its own `App/Corporate Atlas/` (the worktree). The shared-checkout flag was copied there (gitignored). The real pause is the shared-checkout flag.
- **`d1-today` (12:03:33Z):** `rowsWritten` **165**. 165 + 25k is far under the 60k ceiling.
- **A2:** "A2 not started, 0 writes" (FRI30.DIL report; FREEZES note ML-1030-2).
- **Other lanes:** the only report updated today is MA-OCT-002b.DEPLOY, **closed ("002b live" 08:04Z)**. No open production change.
- **R1 (Ops emitter):** not done. There is no `merge-013/ops-ingest.env`, so the runner sends no heartbeats. **Observability falls back to the R-4 run-log reconciliation**, signed by the Operations Lead (spec §9).
- **12:03Z:** `merge-013.sh init` created `~/MeridianAtlas-work/merge-013` (700) and `013.env` (600).

### R2 boost pause row (Ops domain; Founder-authorised in this session, 6 Nov ≈ 12:25Z)
- **Why:** the runner's T-16 gate requires an active `ops_job_pause` row for `local.entities-enrich-boost`, and none existed (only the 011 row, `pause_id` 1, ended 24 Oct). The Task allows D1 writes only via the runner, and the run sheet assigns this row to the Operations Lead. The Founder chose "Insert the pause row".
- **Three-point check:**
  - `NOT EXISTS` guard on `idx_ops_job_pause_job_end (job_id, ends_at)`;
  - one execution;
  - ≈ 3 writes (row, index, `sqlite_sequence`).
- **12:27:17Z, starting R2 insert:** `boost-pause-row.sql` `9387ae41…24d0`. Result: success, 3 rows written.
  - Read-back: `pause_id 2`, `local.entities-enrich-boost`, `2026-11-06T12:05:00Z → 2026-11-07T14:00:00Z`, covering Day 1 and Day 2.
  - **Rollback:** `boost-pause-row.rollback.sql` `e69c007f…68e2` (in `~/MeridianAtlas-work/ma-oct-013/run1/`).
- **Consequence:** with the boost paused there is no 17:50 end event, so the runner's after-17:45 check cannot pass today. **Day 1 must finish before the 16:45Z band**, or the rest moves to Day 2.

### R3 plan (reads only)
- **12:27:28–12:28:11Z:** `export --out ~/MeridianAtlas-work/merge-013/plan-fri6/export`.
  - Counts: em 44,517 rows; iem 63; queue 1,868; fel 264; do_not_merge 3; every other child probe 0; redirects 0.
- **Plan** `plan-fri6/plan.json` sha256 **`7345e95f7e3e9a1ba4ca9131058ad7ec7ba67f4d265fac5d343940413c3a59ba`**:
  - **1,862 merges, 38 batches, R = 62, 2 cik fills, 3 LEIs, 30,395 declared writes**;
  - held: 6 `i1_unsigned`, every other hold 0;
  - refer: 0;
  - 154 new pairs → November.
- **Not material against the BUILD reference** (`ea8bace8…c02d`):
  - same 38 batch ids, pairs and order;
  - **0 per-merge field differences**;
  - same totals and holds;
  - only `created_utc` and the export input hashes differ.
- **No Data-Identity signature file exists,** so the 6 sign-eligible pairs stay **held** (Task v2).

### Log (UTC)
- **12:29:19Z — starting MA-OCT-013 run: R4 migration.** `merge-013.sh migrate` → `entity_merge_redirect` created (`IF NOT EXISTS`), 2 rows written, 1 read. **This is 013's first write: 011's rollback horizon ends here** (spec §11).
- **12:29:34Z — starting R5 pilot B01.** The runner **stopped before B01** with `headroom_unavailable "d1-today fetch age -495 ms exceeds 120000 ms"`.
  - **No batch, no pre-image, no checkpoint; cursor unchanged.**
  - The runner's own log notes: "ops-ingest.env absent (run-log fallback)".

### STOP — runner defect in the headroom gate (12:31Z)
- **Cause:** `budgetGate` in `scripts/merge-013.mjs` at `5e41e7b` takes `now = ctx.now()` **before** calling `fetchD1Today`, which stamps `fetchedAt = ctx.now()` **after** the network call. So `age = now − fetchedAt` is always negative on a real network, and the 011 freshness rule (`0 ≤ age ≤ 120 s`) fails closed on **every** batch. It is not clock skew: the Mac is +0.018 s against `time.apple.com`.
- **Why tests and the dry run passed:** they used fixed clocks or `--assume-account`. The 011 runner's `headroomGate` takes `now` after the fetch; the 013 runner diverged.
- **Fail-closed worked:** nothing was written beyond the migration.
- **Fix, prepared and not applied to the run worktree or committed** (it changes the CHECK-passed runner, which is outside this lane's write ownership): `~/MeridianAtlas-work/ma-oct-013/run1/fix/budgetgate-now-order.patch` `0908af6f3e00a259e4e2955006bc5db7ee653f75570c02328b7b35c3065468e6`.
  - The change: move `const now = ctx.now()` to after the fetch (+ the `--assume-account` branch takes its own timestamp).
  - The new test **T-18** drives the real gate with a clock that advances during the fetch.
  - **On the fix: 106/106. On `5e41e7b`: T-18 fails with exactly today's symptom** (`headroom_unavailable`, 0 merged).
  - Scratch worktree: `~/MeridianAtlas-work/ma-oct-013/run1/fix/wt`.
- **Not used:** `--assume-account` (it would turn the live account gate into a typed constant for the whole run) and `--no-ops-gates`.

**State at the stop:**
- **D1 writes by this lane today:** 5 (pause row 3, migration 2). 0 merges.
- **Left in place, harmless with 0 merges:**
  - `entity_merge_redirect` (empty; 007/004 tolerate it);
  - boost paused (flag + `pause_id 2` to Sat 14:00Z);
  - plan `7345e95f…`.
- **Day 1 time limit:** the boost's after-17:45 end-event check cannot pass while it is paused, so **Day 1 batches must finish before 16:45Z**. 31 batches need roughly 3 h, so a routed fix + delta check by about 13:45Z keeps Day 1 today. After that, the batches move to Day 2 (Sat 7 ≥ 08:05Z, 25k cap → 31 batches; the last 7 then need a further eligible day, never Sunday).

### Fix routed and checked (Founder: "Route fix + delta check", ≈ 12:35Z)
- **MA-OCT-013.FIX2** (LANE-1-ENG): commit **`190ea2f`** on `origin/October-2026`, only `merge-013.mjs` (budgetGate takes `now` after the fetch) and `merge-013.test.mjs` (T-18). Report `MA-OCT-013.FIX2_Report.md` `61e2eba9…b04a`.
- **MA-OCT-013.CHECK2** (REVIEW-A, independent, read-only): **PASS WITH NOTES — Day 1 may resume today on `190ea2f`**, runner sha256 `9ee97999a30790b8ae833ef9d5491382aba6a4bb993012fc1c344abab5c98499`, plan `7345e95f…59ba` unchanged. Report `MA-OCT-013.CHECK2_Report.md` `eb04f85a…6c58`. Notes N-A..N-D are non-blocking; N-B: today's caps are 25k / 60k.
- **Verified here:**
  - `git show --stat 190ea2f` = 2 files; the 4 toml lines in `5e41e7b..190ea2f` belong to 002b's `e93d71e`.
  - Run worktree moved to `190ea2f`; `merge-013.mjs` sha256 = `9ee97999…8499`; 106/106.
  - Live FREEZES `47874339…` re-copied; both boost flags present.
- **This is a clean resume, not a re-run after a RUNNER ERROR.** The 12:29Z stop was a gate refusal before B01's pre-image, so B01 has no pre-image or checkpoint.
- **13:29:13Z — starting R5 pilot B01 (runner `190ea2f`).**
- **13:29:15Z — RUNNER ERROR:** `wrangler d1 execute failed (index-precondition)`, Cloudflare API **code 7403** ("account is not valid or is not authorized").
  - It hit on the runner's **first** read (the index-precondition catalog query), before any gate passed. **No pre-image, no checkpoint, 0 writes**; the call is not in `d1-ledger.jsonl`.
  - `status`: runner not running, flags clear, last run-log line is the 12:29Z headroom stop.
  - `readback` does not apply (no batch was executed).
- **13:29:32Z — diagnostic (not a re-run, no login):** `wrangler whoami` succeeds, same account, scopes include `d1 (write)`. So the 7403 was transient: the startup pattern OPS-R12 guards against.
  - **Lane deviation:** I did not repeat OPS-R12 (`whoami` → wait ≥ 30 s → `SELECT 1`) immediately before this resume. The last `whoami` was 12:01Z.
- **Per the run sheet ("After any RUNNER ERROR: do not re-run … → Operations Lead"), the lane stopped and asked for a decision.**
  - **Recommendation:** re-run OPS-R12 (`whoami`, wait ≥ 30 s, `SELECT 1`), then resume B01 with the same command. B01 has no pre-image, so the runner's write-once rule is not engaged.
  - **Timing:** Day 1 must finish before the 16:45Z band, so a resume by ≈ 13:45Z still fits 31 batches.

### Resume (Founder: "Yes, resume", received ≈ 16:05Z)
- **OPS-R12:** `whoami` 16:05:31Z (same account, `d1 (write)`) → wait 35 s → `SELECT 1` 16:06:06Z success (WEUR/AMS primary, 0 writes).
- **16:06:40Z — starting R5 pilot B01 (runner `190ea2f`).** **16:06:49Z: success — 50/50 merged, 0 raced, 0 breach, writes measured 300 (modeled 800), reads 850.**
  - Checkpoint `B01-7345e95f7e3e.json` final; pre-image `preimage-B01-7345e95f7e3e.json` sha256 `afd85dd7e47bb4316ec01e1d96b8a18a8158e69c7e4ca08befdd319c3faea1c4`.
  - **§10 per-batch reference probes: all 0** (iem, queue, rel_child, rel_parent, isin, exp_entity, exp_holder, bil, mqp, ies, ips, fel).
  - Runner holding: "pilot B01 done: holding for the §10 probes and the Data-Identity 20-row spot check; resume with --pilot-ok <name>".
- **Data-Identity 20-row spot-check sample** (seeded draw, sha256(plan:B01:spot20:dup) ascending): `~/MeridianAtlas-work/ma-oct-013/run1/b01-spot20-sample.json` sha256 `d5280d6c86a5a07a712d517395f8f98fcf6447a1a7305a7a9646b1954a4229ea`. This lane does not sign it (author/adjudicator independence, Arch M-3).
- **Lane writes today:** 305 (pause row 3, migration 2, B01 300). Merges 50 / 1,862.
- **Timing:** batches run in ≈ 9 s each, so the remaining Day 1 batches fit in minutes if `--pilot-ok` is given before the 16:45Z band.

### Spot check and the rest of Day 1
- **Data-Identity spot check (R5):** independent session "013 B01 Data-Identity 20-row spot check" → `claude/packets/MA-OCT-013.SPOT_B01_Report.md`: sample sha256 `d5280d6c…29ea` verified, **20/20 same legal entity, 0 errors, D1 state 20/20 (survivors present, duplicates gone, redirects correct). `VERDICT: PASS`. Signed: DI-Spot-Reviewer-B01.**
- **OPS-R12 again:** `whoami` 16:29:28Z → wait 35 s → `SELECT 1` 16:30:04Z success.
- **16:30:05Z — starting R6 B02..B38** (`run … --pilot-ok "DI-Spot-Reviewer-B01"`). **16:33:16Z: `{"done":true,"ran":37,"next":null}`**; every batch `success`.
- **16:33:28Z — starting R7 (iii) LEIs.** **16:33:47Z: 3/3 applied** — `836800A7VIET4HSVR455` → 113390, `8156008B101B97A43B02` → 110563, `213800ED5AN2J56N6Z02` → 2778 (1 change each). `lei.json` `3a34064e…dfca`. **This was the last write (R8), 16:33:47Z, before the 16:45Z band.**
- **Run totals (run log):** **38/38 batches, 1,862/1,862 merged, 0 raced, 0 breach, 11,298 merge writes** (+ 3 LEI, + 5 pause row/migration). Far under the 25k own cap; the modeled 30.4k was an upper bound (≈ 300 measured vs ≈ 812 modeled per batch).
- **R8 verify (reads):** `redirect_rows 1862`, `duplicates_still_live 0`, `survivors_missing 0`, `survivor_is_a_duplicate 0`, every reference probe 0 (iem, queue, rel_child, rel_parent, isin, exp_entity, exp_holder, bil, mqp, ies, ips, fel), `held_ids_merged 0`, **`ok: true`**.
- **R-4 recon:** `recon --date 2026-11-06` → `ops_events 0` (no emitter, as planned), `runlog_lines 39`, `runlog_writes 11298`. `recon/recon-2026-11-06.json` `221af4b1…3d9a`; `runlog.jsonl` `d5cdb72b…d1a58e2`; `d1-ledger.jsonl` `6498ac12…c4f4`. **Ops Lead to sign R-4.**
- **007 redirect check, 5 merged ids** (live `/api/entities/<dup>`): 223236 → 2368 Ferrari N.V.; 216327 → 2311 Loews; 229631 → 2363 HKT; 230898 → 2483 OCBC; 259930 → 2706 GEA Group (B38). **5/5 HTTP 200, resolved to the survivor, `packet MA-OCT-013`.**
- **Note:** the runner's last `d1-today` reading was 478 rows (16:33:11Z), which lags the run's own writes; account analytics are delayed. Not a gate issue (own writes are counted from the run log).
- **Not done by this lane (post-run, other owners):** ETF-PL post-run spot check (`/api/etf-overlap`, `/api/etf-exposure` on 3 ETFs, entity icon on 3 ISINs); Ops R-4 signature.

### Outcome
- **013 day 1 done — 1862/1862.** **No Day 2 is needed:** the whole plan ran on Day 1. The 6 `i1_unsigned` pairs, the 101 three-way/OTP rows, the 7 Filings-linked merges and the 154 new pairs stay held for November, as planned.
- **Boost:** still paused (shared-checkout flag + `pause_id 2` to 2026-11-07T14:00Z). ML-1106-1 says to resume after Day 2; since there is no Day 2, resuming now is the Founder's call (`entities-enrich-boost-resume.sh` in the shared checkout; the pause row then just expires).
- **Hygiene:** D1 writes only via the runner and the authorised pause row; no deploys; no secrets read; no git staging or commits. The run worktree's FREEZES copy and boost flag mirror are local only.

### Boost resumed (Founder: "Resume boost now", ≈ 16:43Z)
- **16:43:56Z:** `entities-enrich-boost-resume.sh` in the shared checkout removed `.entities-enrich-boost-paused`; the run worktree's mirror flag removed too. The status log's last fire is 2026-11-06T11:50:05Z; **next fire: the 17:50Z band today.**
- **`ops_job_pause` row `pause_id 2` left in place** (no extra production write). No boost code reads it; it only tells Ops monitoring not to expect boost events, until 2026-11-07T14:00Z, when it expires. If Ops wants missed-run alerting back sooner, it can end the row early (one guarded UPDATE on `ends_at`), as its own change.
