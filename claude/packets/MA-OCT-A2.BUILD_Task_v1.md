# MA-OCT-A2.BUILD — Task v1 (immutable): build the A2 runner changes C-1..C-7 + all review must-fix items (local)

Governing: `claude/MA-OCT-A2_Spec.md` rev 0 `226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d` §4 (C-1..C-6); Architect review `claude/MA-OCT-A2_Architect_Review.md` `c95b07a785a8d1ca4ca1b8b01fd11c025ae88128a1258c009f92489d8a7d6b36` (M-1..M-7); Ops review `claude/MA-OCT-A2_Ops_Review.md` `883e1760dc50fdc378e9c5e0bd3df61c74c7137195708c5c880b300519a47c9e` (M-1..M-6); A2.PREP gap report `41a0644b09ae460591112635424aebd28682c562b04b44d75fbb0360fbda0a6b` (its table "What a corrected Control needs" is the scope list). Supersedes A2.PREP (ML-1029-5). **Gated on the Founder's "A2 option A".**

Do (local only — no D1 writes, no deploys, no secrets set, no commits; LANE-1-ENG commits after review):
1. Worktree `~/MeridianAtlas-work/ma-oct-a2/build-worktree` from `origin/October-2026` (`71fab4b` or later). Each C-item as its own logical change (separate patch files), as spec §4 asks.
2. Build in this order, tests with each: **C-7** (own-freeze prefix), **C-2 + Arch M-5** (JOB_ID in run-event, R-4 recon query, manifest), **C-4** (fail-closed excluded-id assertion), **C-3** (`generate --a2` incl. R-LF/R-CUR/R-FUND, §2 STOP rule, F-2 re-compute, outputs + plan SHA, **Ops M-2** Q paired with A per day), C-1/C-5 (`a2.env`, read-ceiling file), **Ops M-5** (control scripts source `a2.env`; `status` prints WORK_DIR + JOB_ID), **Arch M-2** (G-2 n = 150, 0 errors, any error → STOP).
3. **C-6 tests:** the three rules on the DIL29 fixtures (29 + 16 + 42), the STOP rule, C-4, C-7, M-5, M-2; all must fail on `58cd922`'s 011 code. Full 011 suite still green.
4. A **dry-run `generate --a2` against the last local 011 export** (no D1): plan counts by step vs spec §3 table, exclusions applied, per-day write totals ≤ the runner cap.
5. Docs for the run Control: Ops M-1 enrich-cron mechanism (narrowest; production steps written separately with rollback), `gleif-a2` key step (prepare only), Ops M-4 job registration, and a **Sat 31 run sheet**: FG (≤ 50 calls) → fresh export → plan → GO → pilot → G-2 150/0 + Ops ≥ 15-row spot check → A+Q paired batches up to the per-day cap → recon by 23:30Z → **stop at the cap; remaining batches go to November** (ML-1029-5). No A2 write or restore on Sun 1.
6. Commit list.

Standing rules: Wrangler only `/usr/local/bin/wrangler` 4.96.0; ML-1024-1 (never read secret-file contents); ML-1013-3; never `git add -A`; own worktree only. If C-3 is not tested and reported by **Fri 30 14:00Z**, stop and report — A2 then moves to November (ML-1029-5).

Write `claude/packets/MA-OCT-A2.BUILD_Report.md`. Reply **"MA-OCT-A2.BUILD reported"**.
