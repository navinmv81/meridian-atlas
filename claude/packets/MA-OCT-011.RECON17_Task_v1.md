# MA-OCT-011.RECON17 — Task v1 (immutable): Operations Lead R-4 sign-off for 011 run day Sat 17 Oct

**ISSUED BY:** Main Lane, Sat 17 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead · **DUE:** Sun 18, 09:00 UTC (S-2)

Inputs: `claude/packets/MA-OCT-011.RUN_Report.md` (`b26206a820e4fb7a03ae2147ef7b810d85c4a7d615d1bbc86ad3c1801264ef68`) Sat 17 section; `~/MeridianAtlas-work/gleif-011/recon/2026-10-17/` (manifest, exports, SHA-256s; read grant as before, never open the key file); RELOPS conditions S-1..S-3; P3R C-1/C-2. Doc and file review only: 0 D1, no git writes.

Check and sign:
1. Every run-log line matches an Ops end event (24 lines / 47 `ops_job_run` rows, 0 unmatched), the 14:34Z 7403 startup refusal included.
2. Writes: 011 total 24,987 ≤ 25,000; each batch measured = declared (P at 1.09× ≤ 1.3×); no batch in a freeze window.
3. Reads: cumulative 102,575 (102,576 with one diagnostic read) ≤ 350,000; ≤ 200k/day.
4. S-1 held (pilot read-backs/checkpoints passed before B-002); P-002's one raced row is a Phase 3 parent (single LEI holder 502685, untouched); OTP Bank untouched; C-1/C-2 not triggered.
5. Outbox empty; heartbeats live.

Result: **SAT 17 R-4 SIGNED** or **NOT SIGNED** (Mon 19's first batch waits for SIGNED). Note the Mon 19 60k-gate expectation (S-3). Write `claude/packets/MA-OCT-011.RECON17_Report.md`. Reply **"MA-OCT-011.RECON17 reported"**.
