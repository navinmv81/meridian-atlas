# MA-OCT-013.RUN — Task v2 (immutable): 013 run — November item #1, two run days (Fri 6 evening + Sat 7), 25k cap per day

Supersedes Task v1 (Thu 5 date and 33k cap no longer apply; ML-1105-3/ML-1105-4).

Governing: spec rev 1 `e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098`; runner commit **`5e41e7b`** (013.FIX report `5e7fc9e45bd5874cff98d373a2726c10a4d731b71eb01593abe35e74aa9cece4`); **CHECK PASS WITH NOTES** (`claude/packets/MA-OCT-013.CHECK_Report.md` `49603cfe54a88bc124e8f584af7a0055e5c78984bcd1d88d1599f8ea65ed6565`, delta check §7 `e63c3b9c61d6b70ad90c6b66ff366d1375f2e324f91d782cb5a3f1cd1b87c73d`, N-14); plan `ea8bace8…` (1,862 merges, 38 batches); the committed run sheet (R0–R8, kill switch, per-batch restore, "after any RUNNER ERROR: do not re-run"). The 6 sign-eligible pairs stay **held** unless a Data-Identity Lead sign-off file exists before Day 1.

**Preconditions (stop if any is missing):** the Founder's approval of **v2** on this packet's STATUS_BOARD row; the FREEZES window for the run day is present; 002b.DEPLOY closed or not mid-change; pre-flight shows no facts backfill (09:00Z daily) or entities seed (Mon 04:00Z) inside the window; `d1-today` written + planned ≤ 25k for the day.

Run days (runner default cap 25k on any date other than 2026-11-05 — no code change):
- **Day 1, Fri 6 Nov, start ≥ 18:30Z** (after the 17:45–18:15Z band): batches 1–31 (≈ 1,550 merges), stop at the cap, a batch boundary, any guard miss, or 23:30Z.
- **Day 2, Sat 7 Nov, start ≥ 08:05Z**: the remainder (≈ 7 batches / 312 merges). Never Sunday.
Each day: index preconditions → batches → read-backs → recon; post-run ETF exposure spot check (ETF M-1..M-2); 007 redirect check on 5 merged ids. Tell the Founder **"013 day N done — <merged>/<planned>"**.

Standing rules: Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`; FREEZES.json; one production change at a time; ML-1024-1; ML-1013-3; explicit-path staging; never `September-2026`; D1 writes only via the runner's guarded batches.

Write `claude/packets/MA-OCT-013.RUN_Report.md` (append Day 2). Reply **"MA-OCT-013.RUN reported"** after each day.
