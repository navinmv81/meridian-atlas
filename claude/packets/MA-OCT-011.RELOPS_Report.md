# MA-OCT-011.RELOPS — Report

```text
CONTROL:      MA-OCT-011.RELOPS Control v1, SHA-256 4f962132fc60cd85aae04b0b87ff09556047b0fb4e75f1b712f63dd1972e7a58
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork; the session that ran MA-OCT-011.OPSR). Doc-only: 0 D1 reads, 0 D1 writes, no deploys, no git writes, no secrets opened.
DATE:         Fri 16 Oct 2026, about 21:35 UTC
RESULT:       RELEASE READINESS SIGNED — with two pre-pilot steps (P-1, P-2) that the Engineering Lead records before the first batch
```

## Preflight

- No `.git/*.lock` files. HEAD `0dd7ef0` (`git --no-optional-locks`).
- Control `4f962132…7a58` matches STATUS_BOARD row 40. Task `bc31af05…a2f2` matches the Control.
- **Prerequisites met:**
  - (a) RELARC has reported (`MA-OCT-011.RELARC_Report.md`, ≈ 21:25 UTC; PASS WITH NOTES);
  - (b) the T12 boost-flag addendum is in the T12 report (flag set 18:32:46 UTC, after the 16:50 fire and after 17:15).
- **Independence:** I wrote none of the inputs under check (FRI, RELARC, T12, the runner, the plan). My own OPSR rulings are inputs, not subjects.
- **Limit:** this lane can read the repo but not `~/MeridianAtlas-work/gleif-011/`. Work-folder artefacts are taken from the FRI report's hashes, which RELARC re-computed (15/15 ✔). Repo code hashes I checked myself.

## Inputs, as found on disk

| File | SHA-256 | Check |
|---|---|---|
| `claude/packets/MA-OCT-011.FRI_Report.md` | `8a3385c60dcf72741c0deabfb0dddb919300ae3a375122ac15cc5bef078534ec` | ✔ board row 37, RELARC |
| `claude/packets/MA-OCT-011.RELARC_Report.md` | `ea75c9ec48c7a4b9775bb5b82b291167fdde82c1bd1ce906e3de9de6ab1288f1` | as found |
| `claude/packets/MA-OCT-OPS.T12_Report.md` (with Fri addendum) | `c31a73ef8024206931764d02d6f69a23e33d92c597d6e465f52c26a26f0385ec` | ✔ board row 32 |
| `claude/packets/MA-OCT-011.OPSR_Report.md` | `87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f` | ✔ Task |
| `claude/MA-OCT-011_Spec.md` rev 1.10 | `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa` | ✔ Task |
| `claude/relays/FREEZES.json` | `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346` | ✔ spec §4.4 |
| `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` | `ce1e6623f447d02df69b110dd43651b5872b68d5569ca1082b03b4c5ad4851fe` | ✔ FRI |
| `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs` | `830b49a807b89ad96efdc7f6d4582e4b8c87c43ff7cf1201f856c58c5c4663c7` | ✔ FRI |
| `App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs` | `efd206a08d1212c239b894f6e7177f4efa0c328b15350b228b8bd86e316fc7d3` | ✔ FRI |
| Plan `plans/release-2026-10-16/plan.json` (work folder) | `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8` | FRI; RELARC re-computed ✔ |

## Release check, item by item

| # | Check | Evidence | Result |
|---|---|---|---|
| **1** | **R9-3 outcome and read ceiling** | FRI line: export 73,489 reads (X1 44,040, X2 29,449; **multiplier 1.0**, keyset range scans bill 1 per row); projected 73,489 + 140k + 73,489 = **286,978 → PROCEED**. `read-ceiling.json` (`b6851744…5774`): ceiling **350,000**, `per_day_max` 200,000, since 20:38:47.891Z. **R9-1 is in the runner:** `executeBatch` checks the cumulative ledger total before any D1 read, `run` refuses without the ceiling record, and recon logs `reads_011` (4 tests). Max execution 5,000 (export pages); planned batches ≤ 1,010; runner cap 45k. RELARC's conservative estimator gives ≈ 299k ≤ 350k. | ✅ **Ceiling 350,000** (the 450k step is not needed). ≤ 200k/day, ≤ 50k/execution. No re-rule. |
| **2** | **Boost pause** | **Flag:** set Fri 16 **18:32:46Z** by `entities-enrich-boost-pause.sh`, after the 16:50:06Z fire; no boost process running; `.entities-enrich-boost-paused` present (65 bytes), gitignored; the live runner checks that exact path (line 55). **Row:** `ops_job_pause` id 1, `local.entities-enrich-boost`, 17 Oct 00:00Z → 24 Oct 00:00Z (T12, signed in OPSR). | ✅ Next boost fire (Sat 17 10:50Z) is a no-op. Resume after 23 Oct is a separate packet. |
| **3** | **Observability path** | Outbox live (002a A4, accepted in OPSR); the 011 runner loads `lib/ops-outbox.mjs` (`createOpsOutbox`, runner lines 87–88). R-4 daily recon is in force (spec §7; OPS-R8; RUN Task item 5, by 23:30 UTC each run day). Key `gleif-011` was proven 201/401 by T12 K-4. | ✅ **Both paths in force.** The pilot is the runner's first live heartbeat (RELARC N-6); if nothing is delivered, the run log + R-4 recon is the record. |
| **4** | **F-4 / F-5** | Lag recorded: 25–30 min (12–13 Oct; ML-1012-1). F-5 in force in code: `accountCeiling: 60000`, `ownRowWindowMinMs: 45 min`, window `max(45 min, sincePrev)` (core lines 33, 36, 218, 228). | ✅ **Confirmed as the Fri 16 release review requires** (spec §4.3). |
| **5** | **Fail-closed test** | FRI 34/34 includes `d1-today outage: 0 writes, headroom_unavailable, failed heartbeat, cursor unchanged`; CLI evidence `selftest/failclosed-2026-10-13/`. The headroom gate runs before any D1 read. | ✅ |
| **6** | **Freshness gate** | 50 GLEIF calls, 50 × 200; **50/50 agree (100%)**; **15 A rows; 0 A identity mismatches**; `holds/e4-trigger.json` not written. The comparator was tightened so C-reasons rows compare GC Level 1 fields (no trivial agreement). | ✅ No open E-4 trigger. |
| **7** | **Registry and key** | `manual.gleif-reconcile-011` (emitter `gleif-011`, 900 s per batch, active, ingest on) and key K-3/K-4 verified (T12; signed in OPSR). Key file present, mode 600 (FRI §7). | ✅ |
| **8** | **RELARC verdict** | **PASS WITH NOTES**, RELARC-1 "architecturally releasable". N-1 is a pre-pilot step and N-2 to N-7 are non-blocking. | ✅ Nothing blocking (see P-1, P-2) |
| **9** | **Freezes and N-3** | FREEZES.json has the dated window `2026-10-17T00:00Z` → `2026-10-24T00:00Z` ("011 run window (if GO) — other Entities writers frozen"; matched by name, does not block 011, OQ-9). Recurring windows cover Sunday holdings, Monday seed, enrich, the bootstrap buffer, the boost bands and midnight. Dry-run schedule: **Sat 17 · Mon 19 · Tue 20 · Wed 21; 0 calendar violations**; Sun 18 and Mon before 08:00 excluded (RUN Task item 2). N-3 is acknowledged in the RUN Task ("Not allowed: Worker deploys, `OPS_INGEST_KEYS` or `meridian-ops` changes"). 008: "No bond runs 17–23 Oct" (board row 30). | ✅ with note **N3-a** below |
| **10** | **Write budget** | Plan **83,922** + ≈ 1,060 heartbeat writes ≈ **84,982 ≤ 110k**. Day plan: Sat 17 24,459 · Mon 19 24,917 · Tue 20 24,742 · Wed 21 9,804 (each ≤ 25k). Gates in code: `ownDailyCap 25000`, `accountCeiling 60000`, `writeOverrunFactor 1.3`. | ✅ Unchanged |

**Related item, already satisfied:** spec §11's "rollback rehearsal passed" was met live on Thu 15 (20 C-reasons rows, 40 + 40 = 80/100 writes, 0 mismatches, byte-identical restore; BUILD report, Decisions Log 15 Oct). §4.4 had placed the rehearsal in the Sat 17 pilot on B rows, but the runner refuses a 20-row B rehearsal (> 100 writes), so the C-reasons rehearsal stands. **No rehearsal on Sat 17.**

## Pre-pilot steps (Engineering Lead; record in the RUN report before the first batch)

- **P-1 (RELARC N-1).** Run `explain --plan …/release-2026-10-16 --transport remote-ro` once (0 reads). Required: 22/22 plans unchanged, `sql_sha256 = f5ae0dba…dd32`, no forbidden SCAN. **If the hash differs: stop** for the Architect.
- **P-2 (RELARC N-5).** Run `node --test "App/Corporate Atlas/tests/gleif-reconcile-011.test.mjs"` and record the summary lines: **pass 34, fail 0, skipped 0**.
  - 18 tests carry `skip: !HAVE_006`. `HAVE_006` is true only while `~/MeridianAtlas-work/gleif-006/gleif_006.db` exists, and that file is kept until 011 closes (R4 / N-6).
  - **If any test was skipped: stop.** The RA-15 and full-rollback tests have then not run against the 006 basis.
- `shasum -c plan.sha256` before every run day (already RUN Task).

## Conditions on Sat 17 (Ops; within the RUN Task, no new packet)

- **S-1. Continue past the pilot only when it passes.** The RUN Task lets Sat 17 continue to ≤ 24,459 writes, more than §4.4's pilot-only ≈ 4,570. Ops accepts this. Before B-002, all of these must be recorded:
  - read-back diffs of P-001, P-002 and B-001 with 0 mismatches;
  - the checkpoint written;
  - writes within 1.3× of declared;
  - heartbeats either seen as 201 in the runner log **or**, if not delivered, spooled to the outbox.

  An undelivered heartbeat does not stop the run (run log + R-4 cover it), but say so in the day section.
- **S-2. R-4 for Sat 17.** The `recon/2026-10-17/` export lands by 23:30 UTC Sat. I sign by **09:00 UTC Sun 18**. **Mon 19's first batch is blocked until Sat 17 is signed.**
- **S-3. Monday headroom.** With F-5, Mon 19's plan (24,917) plus the seed (≈ 33–34k) is ≈ 58–59k against the 60k gate. Also, 011 starts on Monday only if the account is ≤ 45k at the first check. **Expect the gate to refuse some Monday batches.** The work then rolls to Tue/Wed under the 25k/day cap, and A can slip within the week. This is the gate working, not a stop condition. Record refusals in the day section.

## Notes

- **N3-a (Main Lane, N-3 freeze):** board row 36 shows LANE-1-ENG's 007.P1 still EXECUTING, with `meridian-entities-api` live since Thu 15 (`73851c02`). N-3 covers the Entities Workers including **api**. **No `meridian-entities-api` deploy 17–23 Oct, except an emergency rollback to `0f475f4c`.** 007.P1's front end is local to Wed 21, so nothing should collide. Please put this line in LANE-1-ENG's next Control.
- **N-7 (RELARC, 7403):** `execWithRetry` retries any error except a non-ambiguous `D1Error`, at 30 s / 120 s / 300 s, then the batch fails. Both outcomes are safe: CAS / `INSERT OR IGNORE` statements are idempotent, and a failed batch leaves the cursor unchanged. **Ops ruling:** either is acceptable. If a 7403 ends a batch as `failed`, do not `wrangler login` mid-run. Re-check `wrangler whoami`, wait ≥ 60 s, and resume at the next batch check. Say which behaviour occurred in the day section.
- **RELARC N-2 to N-4** (NULL-name B rows, OTP Bank duplicate pair → 013/004, `lei_validation_source` on C rows → Known Issue) go to the Data-Identity Lead and the Main Lane. They need no Ops action.
- **ECA/E-A release (OPS-R10):** I issue `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}` only when the four OPSR §5 conditions hold, from the recon files. Not before the A-pilot adjudication is 50/50.

## Result

**RELEASE READINESS SIGNED** (Operations Lead, LANE-1-OPS, Fri 16 Oct 2026). All 10 checks pass. P-1 and P-2 are recorded steps before the first batch, not open evidence.

**One-line release statement for the Founder:**

> 011 is ready to release: plan `e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8` (≈ 84k writes, ≤ 110k; ≤ 25k/day; 60k account gate), read ceiling **350,000** (≤ 200k/day), pilot **Sat 17 Oct** (P-001, P-002, B-001) after P-1 (EXPLAIN hash) and P-2 (34/0/0 tests) are recorded; Architect RELARC PASS WITH NOTES; Ops RELOPS signed.

## For the Main Lane

1. Mark RELOPS **SIGNED** on the board, and record the Founder's release approval on the MA-OCT-011.RUN row.
2. Pass P-1, P-2 and S-1 to S-3 to LANE-11-ENG with the RUN start (they sit within the RUN Task's own steps).
3. N3-a to LANE-1-ENG.

## Stop point

Report written. No other files touched.
