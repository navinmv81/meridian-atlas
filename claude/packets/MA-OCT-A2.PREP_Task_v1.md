# MA-OCT-A2.PREP — Task v1 (immutable): A2 run preparation — fold the 13 review must-fix items into the runner; run sheet for Fri 30

Governing: `claude/MA-OCT-A2_Spec.md` rev 0 `226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d`; Architect review `claude/MA-OCT-A2_Architect_Review.md` `c95b07a785a8d1ca4ca1b8b01fd11c025ae88128a1258c009f92489d8a7d6b36` (PASS WITH NOTES, M-1..M-7); Ops review `claude/MA-OCT-A2_Ops_Review.md` `883e1760dc50fdc378e9c5e0bd3df61c74c7137195708c5c880b300519a47c9e` (PASS WITH NOTES, M-1..M-6); Founder A2 Q1 gate / Q2 freeze / Q3 defer-if-fail (ML-1029-2). Base: `origin/October-2026` (011 code `58cd922`).

Do (local only):
1. Implement every MUST-FIX that is code or config: Architect M-1 (configurable own-window prefix so the "A2 run window" does not block A2's own batches, with tests), M-2 (single fixed G-2 sample design, 150 rows / 0 errors), M-5 (`JOB_ID` drives R-4 recon + manifest); Ops M-2 (pair Q with A per day), M-4 (job `manual.gleif-reconcile-a2`, emitter `gleif-a2`, `expected_max_duration_s = 900`), M-5 (one `a2.env` sourced by every control script; `status` prints work dir + job). Tests must fail on the 011 code.
2. **Ops M-1 (enrich cron ignores FREEZES.json):** propose the narrowest safe mechanism to keep `meridian-entities-enrich` off A2's rows Fri 08:05Z → Sun 00:10Z without a global `hold_all_jobs` (e.g. a job-scoped hold key the enrich Worker already reads, or a cron-trigger change). If it needs a production change, write it as a separate step for the run Control with rollback.
3. Prepare (not apply) the `gleif-a2` ingest-key step: key file in `~/.meridian-secrets/` mode 600, hash added to `OPS_INGEST_KEYS` via `wrangler secret put` from stdin on Fri, rollback.
4. **Run sheet for Fri 30 – Sat 31** incl. Architect M-3/M-4/M-7 and Ops M-3/M-6: pilot → G-2 (150/0) + Ops ≥ 15-row spot check → batches; Fri recon by 23:30Z; Ops sign-off by Sat 08:00Z; **no A2 write or restore on Sun 1**; Q3 defer rule; `gleif_006.db` kept; 013 held if a full restore is ever started.
5. Files to commit list (LANE-1-ENG commits Fri morning).

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (incl. the A2 window Fri 30 08:05Z → Sun 1 00:10Z for other Entities writers; 23:50–00:10Z daily). One production change at a time across lanes, announced with UTC time. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`. Own worktree only, never the shared checkout.

Write `claude/packets/MA-OCT-A2.PREP_Report.md`. Reply **"MA-OCT-A2.PREP reported"**.
