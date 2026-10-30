# MA-OCT-BUILD.REVA — Task v1 (immutable): Architect code review — 004 build + 009/010 build

Claude Code is used because the code sits in worktrees outside the shared folder. **Read-only.**

Review two builds against their specs and reports:
- **004:** worktree `~/MeridianAtlas-work/ma-oct-004/build-worktree`; report `claude/packets/MA-OCT-004.BUILD_Report.md` `8eddf582f2b6e8bd05e99e0177531c5177f14c62e48f8dbc8b2c64f8dc859616`; spec `claude/MA-OCT-004_Spec.md` rev 1 `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379`. Rule on the lane's open items (B-2 `member_update → fixed` needs `fix_scheduled`; E8 bare-ISIN keys; `LIKE 'DQ-SEED-%'` on the small ticket table; B-7 AUTOINCREMENT numbering). Confirm the base is deploy 4 `fd7b753` (`meridian-ops` `2e4c3fc6`) and endpoints = 14/15. Check the Thu/Fri go-live run sheet (migration, seeds incl. D-2/D-3 re-checked against D1 first, one deploy, smoke, rollback ids).
- **009/010:** worktree `~/MeridianAtlas-work/ma-oct-009/build-worktree`; report `claude/packets/MA-OCT-009.BUILD_Report.md` `a32e8d0bede75210b1c94ef2b263bb5d3baf3683068751b932324808df336459`; spec `claude/MA-OCT-009_010_Spec.md` rev 1 `2f83d58e0042ebfe920f5823598ee3827c21c57b6bbc103f552cef419b2841f4`. Rule on the lane's six items: (1) 007 test-fixture change; (2) cache proof moved to the open-gate re-run; (3) `ambiguous` with 0 candidates on the 007 card; (4) live-browser pass incl. 375 px deferred to Fri 30; (5) spec rev 1 must be committed before the 009 commit; (6) F1 "latest filing" per page.

For each build: verdict **PASS / PASS WITH NOTES / FAIL**, findings (BLOCKER / MUST-FIX before deploy / NOTE), three-point check confirmation, and whether it may deploy Fri 30 (004 first, then 009; one change at a time).

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (incl. the A2 window Fri 30 08:05Z → Sun 1 00:10Z for other Entities writers; 23:50–00:10Z daily). One production change at a time across lanes, announced with UTC time. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`. Own worktree only, never the shared checkout.

Write `claude/MA-OCT-004_009_Code_Review.md` and `claude/packets/MA-OCT-BUILD.REVA_Report.md`. Reply **"MA-OCT-BUILD.REVA reported"**.
