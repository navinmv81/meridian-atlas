# MA-DEC-SEC.FIX0.BUILD — Task v2 (supersedes v1 `3a43ec56…`)

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Engineering Lead — fresh session, fixed line LANE_OPENER_v3.md
CONTROL:      claude/packets/MA-DEC-SEC.FIX0.BUILD_Control_v2.md
```

1. Preconditions: no `.git/*.lock`; branch `December-2026`; HEAD = `git ls-remote origin refs/heads/December-2026` = `833a18877e3940fe270c8df1feb616fb6dda186d`.
2. Run the existing suites first and record counts (baseline; `ingest-contract.mjs` skipped, Control v2 change 3).
3. Control A, B; then C (tests, including Control v2 change 1 in `uit/tests/uit-build.test.mjs`) until green.
4. Control D (deployments list, dry-run to a temp dir outside the repo, three-point check).
5. Control E (fingerprints only).
6. Control F (commit, push, `ls-remote`); the commit also includes `uit/tests/uit-build.test.mjs` and the v2 Control/Task files.
7. Report `claude/packets/MA-DEC-SEC.FIX0.BUILD_Report.md`: commit; diff summary per file; tests before/after; current version ids for meridian-holdings and meridian-control (rollback targets); dry-run summary; three-point check; E result (fingerprints before/after, untracked confirmed); the meridian-ops redirect note; non-actions. Full `holdings-pipeline.js` diff. If you stopped early, follow Control v2 change 2. Then `node tools/factory/dispatch.mjs end MA-DEC-SEC.FIX0.BUILD`. Reply ≤ 5 lines.
