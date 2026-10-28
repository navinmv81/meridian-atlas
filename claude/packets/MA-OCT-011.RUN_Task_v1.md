# MA-OCT-011.RUN — Task v1 (immutable): execute the 011 plan, Sat 17 → Thu 22 Oct

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
