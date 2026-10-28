# MA-OCT-011.RECOND — Report (standing daily R-4 sign-off, 011 run days 17–22 Oct)

```text
CONTROL:      MA-OCT-011.RECOND Control v1, SHA-256 faf33c4910a273d6b761c0c46f6d41790d34c7fa9f05476db7815b696994d13f (matches STATUS_BOARD row 46)
TASK:         v1, SHA-256 269525ed08661290efba786a951743ae64574806fcff8fc5b924fed258969a48 (matches the Control)
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). 0 D1 reads/writes, no deploys, no git writes, no key file opened.
```

## Step 0 — Sat 17 sign-off file (Sun 18 Oct, 08:25 UTC)

- **Preflight:** no `.git/*.lock` files; HEAD `3989ab1` (`git --no-optional-locks`).
- **Source:** `claude/packets/MA-OCT-011.RECON17_Report.md`, SHA-256 `585bba213ef4fb29a4955eb967b878f2a12e0de9f8db440cd12d3eb0fc1adcb9` (re-hashed ✔).
- **Written:** `~/MeridianAtlas-work/gleif-011/recon/2026-10-17/ops-signoff.json`.
  - Created new: open-exclusive, so nothing was overwritten. Mode 600, 367 bytes.
  - Content: the JSON block in the RECON17 report, extracted programmatically rather than re-typed, plus `source_sha256`.
- **Read back:**

  ```json
  {"date":"2026-10-17","signed_by":"Operations Lead (LANE-1-OPS)","result":"MATCH — 24/24 run-log lines matched, 0 unmatched; writes 24,987/25,000; reads 102,575/350,000; 0 mismatches","source":"claude/packets/MA-OCT-011.RECON17_Report.md","signed_at":"2026-10-18T08:15Z","source_sha256":"585bba213ef4fb29a4955eb967b878f2a12e0de9f8db440cd12d3eb0fc1adcb9"}
  ```

  - **SHA-256 `6f5ddf9ecc3c6caebe3a9c56527fe6dabef368c7f6e2d13ec709a0291cb78a5b`**.
- **Gate check:** I checked the file against the runner's own `reconGate` rule (runner lines 291–301): `date` = `2026-10-17`, `signed_by` present, and `result` matches `^(MATCH|RECONCILED)`. **It passes.** Mon 19's first batch is no longer blocked by R-4.
- **Recon files unchanged:**
  - `manifest.json` `264c7986…05c4`;
  - `ops_job_run.json` `0865c2b7…a8f`;
  - `runlog.jsonl` `f5df9072…f17`.
- **Still gating Mon 19, outside this lane:**
  - B-1 to B-4 plus the duplicate-LEI check, with their Architect review;
  - P-1 and P-2 re-run on the new runner hash;
  - plan `shasum -c`;
  - not before 08:05 UTC.

  OPS-R11 stands.

**Sat 17: SIGNED (MATCH).** Later run days are appended below, each on the Founder's `continue <date>`.


## Mon 19 Oct 2026 — R-4 sign-off (Tue 20, 08:31 UTC; due 09:00 UTC)

**Inputs (hashes as found; all match the RUN report and manifest):**
- `claude/packets/MA-OCT-011.RUN_Report.md` `e957bfaa4a06a0784c026c2524eec05477d14169e87324e808ca6d83531fd1dd` (Mon 19 section);
- `recon/2026-10-19/manifest.json` `094e3280…6937`;
- `ops_job_run.json` `16eddea0…02aa9`;
- `runlog.jsonl` `2b2c9532…86ac`.

No locks; HEAD `3989ab1`. The read grant covers `recon/2026-10-19/` only.

| # | Check | Independent result | Status |
|---|---|---|---|
| 1 | Run log ↔ Ops end events | **48 lines; 95 rows = 48 end + 47 start**, all `gleif-011` / `manual.gleif-reconcile-011` / `manual`. Every line has exactly one end event, with 0 orphans either way. Outcome and `rows_written` agree on 47 lines. The 48th, **CR-040 `budget_limit`**, maps to end `skipped`, `detail.reason = "budget"`, 0 writes, end-only. That is the designed mapping (FRI §4: refusal → heartbeat `skipped`/`budget`), not a mismatch. | ✅ MATCH |
| 2 | Writes | Run-log sum **24,403** batch writes + 95 events × ≈ 5 (ML-1010-3) ≈ 475 → **24,878 ≤ 25,000**. Largest batch 1,008. Measured ≤ declared on every batch per the RUN report (ratio ≤ 1.00), so well under 1.3×. **The cap refusal at CR-040** (24,873 + 230 > 25,000) is the 25k gate working: cursor kept, **not a stop**. **Account gate:** 34,055 (Monday seed) + 24,873 + 230 = 59,158 ≤ 60,000. **S-3 held:** the start was ≤ 45k at 09:04, and the binding limit was 011's own cap, not the account. | ✅ |
| 3 | Freezes / calendar | All lines 09:04:59–09:06:37Z, Monday ≥ 08:05, inside 07:15–10:40; clear of 07:55–08:05, 10:45–11:15, 16:45–17:15 and the seed freeze (ended 08:00). | ✅ |
| 4 | Reads | Manifest: **cumulative 158,711 / 350,000**; today **56,136 / 200,000**. Cross-check: 158,711 − 102,575 (Sat) = 56,136 exactly. Batch `rows_read` in Ops rows 55,945; recon export 190; the 1 remaining read is gate overhead. Plus Sat's 1 diagnostic read outside the ledger. | ✅ |
| 5 | Mismatches, duplicate-LEI check, C-1′/C-2 | Tally over all lines: **applied 11,059, raced 130, mismatch 0**. No `mismatch` key on any line, so the new duplicate-LEI-holder check flagged nothing. No `failed` line and no RUNNER ERROR, so C-1′ and C-2 were not triggered. | ✅ |
| 6 | Raced rows (§4.2c) | **129 B rows raced:** B-023 56/250 and B-024 73/73. Live Phase 3 drained them between the 16 Oct export and Monday; the CAS missed, so nothing was clobbered. **B-024 = 0 writes** is correct. Plan-carried fallbacks: **B-023-fb** 55 applied + 1 raced (entity 204823: Phase 3 wrote an ultimate parent, so the guard correctly missed), **B-024-fb** 72 applied. Entity 207528 had no fallback. **Both are listed for close-out.** | ✅ (designed outcome) |
| 7 | Outbox / heartbeats | **95/95 events delivered**; last received 09:06:37.854Z; nothing spooled. | ✅ |

**Notes:**
- **Runner hash changed after today (B-5)** to `29300a0e…59fa`. B-5 counts a failed write call's applied rows toward the 25k cap: Monday's under-count gap, now closed conservatively. Tue 20 runs on it under ML-1018-2, which sets the Architect's close-out check. **Ops has no objection.** B-5 only increases what is counted; P-1 and P-2 (42/0/0) were re-run on it.
- **Tue 20:** CR-040 and RC15-001 roll first, then E-C, then A up to `--until A-001`. The A pilot is Wed 21. E-A/ECA only on Thu 22, with OPS-R10's release. **No Monday-style seed load on Tue,** so the 25k cap, not the account gate, should bind again.
- Running totals: 011 writes ≈ 49,865 so far (Sat 24,987 + Mon 24,878), within the 110k ceiling and the ≈ 85k plan. Cursor CR-040.

**Mon 19: SIGNED (MATCH).**
- Sign-off file `recon/2026-10-19/ops-signoff.json` — its SHA-256 is in the line below.
- **Sign-off file written 08:31 UTC:** mode 600, SHA-256 `d150509068c1474a1eac232bbfcaa498c688204f76a7b8746b7c21cc56fe8367`. Its `source_sha256` (`44e5f25ed62b55c2778d7feef02d0cfdb26fafb0f12a9bf0f31f8f52beb123b7`) is this report as it stood before this line was added. **It passes the runner's `reconGate` rule.**


## Tue 20 Oct 2026 — R-4 sign-off (Wed 21, 10:55 UTC; **late** — due 09:00 UTC)

**Lateness:** the Founder's `continue 2026-10-20` reached this lane at about 10:54 UTC, so the sign-off is ≈ 2 h past S-2's 09:00 target. **The gate held as designed:** A-001 cannot start until this file exists, and no batch ran without it. Nothing else is affected. Today's run windows remain 11:20–16:40 and 17:20–21:00.

**Inputs (hashes as found; all match the RUN report and manifest):**
- `claude/packets/MA-OCT-011.RUN_Report.md` `a6892e3317eb4498e32f0344cd6b8061a31bbcce54e7b1f709b2eb1275be1672` (Tue 20 section);
- `recon/2026-10-20/manifest.json` `e6571bae…fb10`;
- `ops_job_run.json` `1215982e…ea01`;
- `runlog.jsonl` `30246f89…49e5`.

No locks; HEAD `3989ab1`. The read grant covers `recon/2026-10-20/` only.

| # | Check | Independent result | Status |
|---|---|---|---|
| 1 | Run log ↔ Ops end events | **5 lines; 10 rows = 5 start + 5 end**, all `gleif-011` / `manual.gleif-reconcile-011` / `manual`. Outcome and `rows_written` agree on every line; 0 orphans; no end-only events. | ✅ MATCH |
| 2 | Writes | Batches CR-040 220, RC15-001 29, EC-001 1,000, EC-002 1,000, EC-003 696 = **2,945**, + 10 events × ≈ 5 ≈ 50 → **2,995 ≤ 25,000**. Measured ≤ declared on every batch (EC-003 696 vs 700: the one `already_present` edge wrote nothing). Account at the gate: 70 + batch ≪ 60k. | ✅ |
| 3 | Freezes / calendar | 08:45:15–08:45:23Z Tuesday, inside 07:15–10:40; clear of 07:55–08:05 and the boost bands. | ✅ |
| 4 | Reads | Manifest: **cumulative 170,348 / 350,000**; today **11,637 / 200,000**. Cross-check: 170,348 − 158,711 = 11,637 exactly. Batch reads in Ops rows 11,616 + recon export 20 + 1 gate read. Largest execution 4,136 (EC-001). | ✅ |
| 5 | Mismatches, duplicate-LEI check, C-1′/C-2, B-5 | Tally: **applied 813, already_present 1, mismatch 0**. No failed line, so C-1′ and C-2 were not triggered and B-5 had nothing to count. | ✅ |
| 6 | The one `already_present` edge | EC-003: child **207528** → parent **502685** (LEI `984500F099E8C6A0EE90`). The same `legal_parent` edge was already present, written by live Phase 3's 06:50Z run on Sat 17. That run also created 502685 (Sat's raced P row) and drained 207528 (Mon's "no fallback" row). `INSERT OR IGNORE` matched it and wrote nothing. **Consistent across all three days.** **E-C is complete:** 675 = 674 inserted + 1 present. | ✅ (designed outcome) |
| 7 | Outbox / heartbeats | **10/10 delivered**, last received 08:45:23.571Z; nothing spooled. | ✅ |

**For Wed 21 (A pilot):**
- **Run A-001 only.** The runner holds on `holds/a-pilot.json`.
- **Ops spot-check of the ≥ 50-row adjudication (RA-14, E-4):** the Data-Identity Lead adjudicates; Ops spot-checks. A-002 onward needs `--a-adjudication` recording 50/50.
- **Any A identity mismatch triggers E-4 (RA-12/RA-15):** A stops, the batch is restored, and ECA and E-A are dropped.
- **E-A/ECA on Thu 22** only under OPS-R10's release `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}`, with its four conditions. I issue it from the recon files.
- **Status-script fix** (`b04f5d8c…a1fe`): display only, not used by the runner. No Ops objection.

**Running totals:**
- 011 writes ≈ **52,860** (Sat 24,987 + Mon 24,878 + Tue 2,995), within the 110k ceiling and the ≈ 85k plan;
- reads 170,348 / 350,000;
- cursor A-001.

**Tue 20: SIGNED (MATCH).**
- **Sign-off file written 10:55 UTC:** mode 600, open-exclusive, SHA-256 `0ef5a638abcfce15f4e6975adc5d92e9f639a6610e5512ad3590ad0bea54ec81`. Its `source_sha256` (`571f670b67696e2589e862edf219ab8d331126f6656dfae4a91679b28174b741`) is this report as it stood before this line was added. **It passes the runner's `reconGate` rule.**


## Wed 21 Oct 2026 — R-4 sign-off (Thu 22, 06:28 UTC; due 09:00 UTC)

**Inputs (hashes as found; all match the RUN report and manifest):**
- `claude/packets/MA-OCT-011.RUN_Report.md` `d032abfbb44517ae130ca10028d9417e26dc09618ae1edf22bce84dcf452b28b` (Wed 21 section, incl. the 18:14 E-4 response);
- `recon/2026-10-21/` as re-exported 18:15:19Z: `manifest.json` `fc1caaf3…2022`, `ops_job_run.json` `bf875067…ef61`, `runlog.jsonl` `d2c1ce13…01c5`. This supersedes the 13:07 export, which was never signed.
- `MA-OCT-011.APILOT_Report.md` `2f667081…4206`.

No locks; HEAD `c3c6e4a` (LANE-1-ENG 007; no 011 file). The read grant covers `recon/2026-10-21/` only.

| # | Check | Independent result | Status |
|---|---|---|---|
| 1 | Run log ↔ Ops end events | **2 lines; 4 rows = 2 start + 2 end**, all `gleif-011` / `manual.gleif-reconcile-011` / `manual`; 0 orphans; no end-only events. A-001 forward: `success` 1,543 ↔ Ops `success` 1,543. A-001 restore: `success` 1,293 ↔ Ops `success` 1,293 (start `detail.mode = "restore"`). | ✅ MATCH |
| 2 | Writes | 1,543 + 1,293 = **2,836**, + 4 events × ≈ 5 ≈ 20 → **2,856 ≤ 25,000**. Forward 1,543 = declared 1,543 (1.00×); restore 1,293 ≤ 1,543. Account far below 60k (20 rows at the start of the day). | ✅ |
| 3 | Freezes / calendar | Forward 13:07:50–52Z (window 11:20–16:40); restore 18:14:44–45Z (window 17:20–21:00). Clear of both boost bands. | ✅ |
| 4 | Reads | Manifest: **cumulative 172,862 / 350,000**; today **2,514 / 200,000**. Cross-check: 172,862 − 170,348 = 2,514 exactly. Ops rows: 1,250 + 1,250; recon exports 4 + 8; 2 gate reads. | ✅ |
| 5 | Mismatches, C-1′/C-2 | Forward 250 applied / 0 raced; restore 250 applied / 0 missed; **0 mismatches**. No failed batch: C-1′(c) does not apply and C-2 was not triggered. | ✅ |
| 6 | **E-4 response (RA-12 / RA-15)** | **Trigger:** APILOT 48/50; 2303 (Tradeweb Markets Inc ← Tradeweb Markets LLC's LEI) and 2488 ('HONG KONG DOLLAR' ← an HSBC sub-fund LEI). `holds/e4-trigger.json` written 18:07:08Z. **Response, in the correct order:** the A-001 restore ran **after** the trigger and before anything else, and it is the only operation that day after the pilot. The RUN report says the restore read-back is byte-identical to the forward pre-image (`d30f6f95…735d`; 28 columns, 0 diffs) and that 2303 and 2488 again hold no LEI. **No ECA, E-A or Q statement was ever written** (no checkpoints), so there was nothing to delete. `holds/ea-dropped.json` (`b9e18517…daac`) is in place, and the runner refuses A/ECA/E-A/Q. The checkpoint files sit outside my grant, so the byte-identity rests on the RUN report's hashes. The Ops-visible part (the restore end event, 250/250, 0 missed) agrees. | ✅ |
| 7 | Outbox / heartbeats | **4/4 delivered**; nothing spooled. | ✅ |

**Item 2 (Thu 22 edges): NO RELEASE ISSUED.** OPS-R10's four conditions **fail**:
- (1) the adjudication is 48/50, not 50/50;
- (3) an E-4 trigger is open, and `ea-dropped.json` exists.

The Operations Lead **will not issue** `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}` for this run. E-A (298) and ECA (45) are deferred with A to **MA-OCT-011.A2** (Founder "Defer A", 21 Oct ≈ 18:35Z).

**Notes for the Main Lane:**
- **MA-OCT-011.APOPS (board row 49, READY) is now moot.** Its trigger, an N/N pass, cannot occur on this plan. Please close or supersede it, with no Ops spot-check file and no A release. The A2 re-plan will need its own Ops spot-check.
- **Cosmetic:** the restore run-log line shows `cursor {before: "A-001", after: "A-001+"}`, but the RUN report says the cursor is back at A-001 (recorded under `restored`). The run state and the runner gates govern; this is not a defect in the data. **Close-out should confirm `status.sh` shows next = A-001 with A refused.**
- **No 011 batches remain runnable on this plan.** A, Q, ECA and E-A are stopped. **Thu 22 should have no run day.** If none runs, there is no Thu 22 recon to sign, and Wed 21 is the last R-4 day of the window.
- **Close-out (Fri 23):** confirm the completed steps (P, B, C, C-reasons, RC-15, E-C), with §9 re-based without A. Carry 2303, 2488 and the 29 legal-form-mismatch rows to 013 / 004. Also carry entities 204823 and 207528 (Mon 19), and K-5 (zero or remove the `gleif-011` key at close-out).
- **Boost:** still paused until after 23 Oct (separate resume packet).

**Running totals:**
- 011 writes ≈ **55,716** (24,987 + 24,878 + 2,995 + 2,856), of which 1,543 + 1,293 net to zero data change;
- reads 172,862 / 350,000.

**Wed 21: SIGNED (MATCH).** The E-4 handling is verified as above.
- **Sign-off file written 06:28 UTC:** mode 600, open-exclusive, SHA-256 `93d4d913210c9aa2603e7a6c12210dd5dc1d4078fcfad44fd4b1d70765b58fd0`. Its `source_sha256` (`f4997c925264482bcd24d2aa1594a546110029073776f4a5627fab25e0564b28`) is this report as it stood before this line was added. **It passes the runner's `reconGate` rule.**
