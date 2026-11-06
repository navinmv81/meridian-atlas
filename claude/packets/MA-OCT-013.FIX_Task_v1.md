# MA-OCT-013.FIX — Task v1 (immutable): fix 013 blocker B-1 (runner crash safety) — local only

Governing: `claude/packets/MA-OCT-013.CHECK_Report.md` `d8b6cdf45488c21d1f93831f62509256f802f7dc0dc1719c8b19baabbcb31412` — **B-1** and its **Routing** section (items 1–7); `claude/MA-OCT-013_Delta_Check.md` `1a2b2a6128e4330ab0de3bf9785ac05d18aa238a20b383333e2ff0388fb902a9`; 013.BUILD report `5ce5154b39e3183cdcf67c448ca208cc2e827330d7c5233316b7e0b2a0fc13cc`; spec rev 1 `e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098`. ML-1105-3: 013 is now **November item #1**; this fix lands tonight so the run can go first thing.

Do (same worktree `~/MeridianAtlas-work/ma-oct-013/build-worktree`, from `3c8866b`; **no D1 calls, no deploys**):
1. Implement Routing items 1–6 exactly (write-once pre-image and checkpoint files; provisional checkpoint on disk before each batch commits; `readback` and `restore` work from the provisional checkpoint; post-commit reads retry ≥ 3 times; T-17 + full suite green; run sheet says "after any RUNNER ERROR: do not re-run") and item 7 if feasible.
2. Tests that fail on `3c8866b` for each item; repeat the local replica dry run (one-batch run + restore byte-identical, then all 38); plan hash `ea8bace8…` unchanged.
3. One explicit-path commit; push. Report the commit SHA at the top of the report so REVIEW-A can re-check.

Standing rules: ML-1024-1; ML-1013-3; never `git add -A`; never `September-2026`; own worktree only.

Write `claude/packets/MA-OCT-013.FIX_Report.md`. Reply **"MA-OCT-013.FIX reported — <sha>"**.
