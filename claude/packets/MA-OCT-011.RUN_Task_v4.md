# MA-OCT-011.RUN — Task v4 (immutable; supersedes v3 from Mon 19: adds the B4R conditions): execute the 011 plan, Sat 17 → Thu 22 Oct

**ISSUED BY:** Main Lane, Fri 16 Oct · **EXECUTED BY:** LANE-11-ENG, Engineering Lead · **DAILY RECON:** Operations Lead (R-4) · **APPROVED BY:** Founder (release approval)

**Do not start** until `STATUS_BOARD.md` shows MA-OCT-011.RELOPS **SIGNED** and the Founder's **release approval** recorded on the MA-OCT-011.RUN row. If either is missing: stop.

Governing: spec rev 1.10 (`6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`) §4.3–§4.4, §9, §11; OPS-R9/OPS-R10 (`87d2036e7c2aade8520951cd501944dd25c82b8a80835f9358a7c88e74db6b1f`); your FRI report (`8a3385c60dcf72741c0deabfb0dddb919300ae3a375122ac15cc5bef078534ec`) §7 control commands; plan **`e3854698494d3be020c317100128902c9843ffa4c738ef050e2299d4a1a6e6a8`** only (re-check `shasum -c plan.sha256` before every run day).

1. **Pilot (Sat 17):** `run … --until B-002` (P-001, P-002, B-001; ≈ 4.3k writes). Verify read-back diffs, heartbeats delivered (first live use of `gleif-011`; if the outbox delivers nothing, the run log + R-4 recon is the record) and the checkpoint. Then continue Sat 17's schedule (≤ 24,459 writes, ≤ 25k).
2. **Run days:** Sat 17, Mon 19 (after 08:00 UTC), Tue 20, Wed 21 per the dry-run schedule; edges (E-A, ECA) Thu 22 only with the Operations Lead's OPS-R10 release `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}`. **No writes on Sun 18**, Mon before 08:00 UTC, inside any `FREEZES.json` window, or on a day whose previous run day's R-4 recon is unsigned.
3. **Gates every batch:** kill/pause flags, calendar/freeze, `d1-today` headroom (60k account ceiling; F-1 window max(45 min, since last fetch)), R9-1 read ceiling 350,000 (≤ 200k/day), ≤ 25k writes/day by 011, 1.3× stop. Never bypass a refusal.
4. **A pilot (first A batch):** stop after it for the Data-Identity Lead's 50/50 adjudication (E-4) before the next A batch. Any E-4 trigger: per RA-12/RA-15 (A stopped, batch restored, E-A and ECA dropped).
5. **Each run day, by 23:30 UTC:** write `recon/<date>/` (exports + SHA-256s, `reads_011`) and append a day section to the report: batches, writes measured vs plan, reads cumulative, events delivered, any refusal or stop.
6. **Stop at once** on: any read-back mismatch, plan hash mismatch, E-4 trigger, headroom unavailable for > 2 h, writes > 1.3× plan for a batch, or any instruction not in this Task. Report and wait.

**Not allowed:** any statement not in plan `e3854698…`; Worker deploys, `OPS_INGEST_KEYS` or `meridian-ops` changes (N-3); git writes (ML-1012-2); boost resume (after 23 Oct, separate packet); the 013 hand-off writes.

**Budget:** writes ≤ 110k total (plan ≈ 83.9k + ≈ 1.1k heartbeats); reads ≤ 350k cumulative (R9-1); GLEIF 0 calls (post-run spot checks are in the close-out packet).

Report: `claude/packets/MA-OCT-011.RUN_Report.md`, one section per run day. Reply **"MA-OCT-011.RUN day <date> reported"** each day.

## Release-review conditions (v2) — RELARC `ea75c9ec48c7a4b9775bb5b82b291167fdde82c1bd1ce906e3de9de6ab1288f1`, RELOPS `991c46290a106c4bf076fbc6f9dbc7c9219373a17fd86fcc91c8835d305ac81b`

Before the first pilot batch, record in the report (day Sat 17 section):
- **P-1 (RELARC N-1):** run `explain --plan …/release-2026-10-16 --transport remote-ro` once (0 reads). Must show **22/22 plans unchanged, `sql_sha256 = f5ae0dba…dd32`, no SCAN**. If not: stop for the Architect.
- **P-2:** full test summary **34 passed, 0 failed, 0 skipped** (18 tests skip silently without the 006 DB: any skip = stop).
- **P-3 (RELARC note, Cloudflare 7403):** state how the runner handles a transient API error (e.g. 7403). Required behaviour: no retry inside a batch after any write; the batch either completes and checkpoints or stops with the cursor kept; a retry is allowed only before the batch's first statement. If the code does not do this, stop and report.

Run conditions (RELOPS):
- **S-1 Sat 17:** continue past the pilot (P-001, P-002, B-001) to the Saturday schedule (≤ 24,459) only after the pilot's read-back diffs and checkpoints pass.
- **S-2:** `recon/2026-10-17/` by 23:30 UTC Sat; Ops signs by 09:00 UTC Sun 18; **Mon 19's first batch waits for that signature.**
- **S-3 Mon 19:** the 60k account gate may refuse batches (plan + seed job ≈ 59k). A refusal is not a stop: leave the cursor, roll the work to later days, record it.
- Withheld row OTP Bank (entity 2019 / 467290) stays untouched (→ 013 / 004).

## P3R conditions (v3) — `claude/packets/MA-OCT-011.P3R_Report.md` (`84a1c78c6471372e303b01ad35fc48a6742affdc22e5fdbd2958e6a650e5b1ea`), PASS WITH NOTES

P-1 and P-2 are recorded (Sat 17, before the fix and after); P-3 is met by the reviewed fix. **The Sat 17 pilot may run.**

Binding operating conditions until B-1..B-3 ship:
- **C-1.** A batch that ends `failed` with any `applied` rows: run `restore --batch <id>` **first**, verify it, and only then re-run. Never re-run over a partial apply (a re-run overwrites the failed checkpoint; `restore --all` skips failed batches).
- **C-2.** If the runner exits with `RUNNER ERROR` and **no checkpoint** for a batch: stop, tell the Operations Lead and the Architect via the report, **do not re-run**. The batch's pre-image file is the only restore source.

Code before the **Mon 19 first batch** (Sun 18 has no writes, so build and test then):
- **B-1** probe again just before each retry (after the sleep), not only straight after the failure;
- **B-2** the post-failure read-back retries itself, and always writes a checkpoint plus a hold file;
- **B-3** `run` refuses a batch whose forward checkpoint is `failed` with `applied` rows until a successful restore checkpoint exists, and never overwrites a failed checkpoint;
- **B-4** tests: a B (CAS-update) batch failing after writes, a concurrent writer, a failed read-back.
Then re-run P-1 (hash unchanged) and the full suite (0 failed, 0 skipped), write a Sun 18 section with the diff (prior runner kept as `runner-prev.mjs` in the work folder for the reviewer), and **stop for an Architect review** before Mon 19's first batch. Mon 19 also still waits for the Ops R-4 signature for Sat 17 (S-2).

## B4R conditions (v4) — `claude/packets/MA-OCT-011.B4R_Report.md` (`250766600e13062aeffca5b6614629b885735d6a7fc16d51b6fcb4369dc153bc`), PASS WITH NOTES

B-1..B-4 and the duplicate-LEI check are reviewed and accepted (41/0/0; P-1 unchanged). **Mon 19's first batch (B-022) may run** from 08:05 UTC, with the Sat 17 sign-off file present (written by Ops, `6f5ddf9e…8a5b`). Before it: re-check the plan hash and the runner hash `33abb71d…e7cc`, and re-run P-1 and P-2 once.

**C-1 is replaced by C-1′** (binding):
- (a) before any `restore --all`, there must be **no pending read-back holds**;
- (b) if a restore's own read-back fails, `readback` cannot clear that hold: re-run the restore, then the **Operations Lead** removes the hold by hand and logs it;
- (c) any batch that fails with rows applied (fallback batches included) **ends that day's run** once it has been restored.
**C-2 stays** (no checkpoint after a crash, sleep or power loss → stop, do not re-run).

**B-5 before Tue 20's first batch:** when a write call fails, record the batch's applied writes (not 0) in 011's own daily count; add a test; re-run P-1/P-2; note it in the Mon 19 section. Rule C-1′(c) covers the gap until then. The Architect checks B-5 at the 011 close-out (ML-1018-2), so it does not gate Tue 20 by a separate review.
