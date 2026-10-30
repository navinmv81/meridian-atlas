# MA-OCT-004.GOLIVE — Task v1 (immutable): 004 go-live on `meridian-ops` (first production change today)

Governing: 004 spec rev 1 `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379`; 004.BUILD report `8eddf582f2b6e8bd05e99e0177531c5177f14c62e48f8dbc8b2c64f8dc859616`; code review `claude/MA-OCT-004_009_Code_Review.md` `42ef70392403cffe5b8bde3bdc989d393e6f4d4b9bda27e19d9cb9fa16ffa8b8` (004: PASS WITH NOTES; **M4-1, M4-2, M4-3 binding**; B-2 upheld — `schedule_fix` before `fixed`).

Do, starting now (outside 07:55–08:05):
1. **M4-1:** rebase/merge the 004 tree onto deploy 4 **`fd7b753`** (or later origin); resolve the two conflicts by keeping both sides; the toml has **one** `OPS_SERVICE_ACTORS` line (004's). All Ops suites green on the merged tree. Endpoints 14/15. Commit the 004 files by explicit path; push. **Do not include 005 files.**
2. **D-2 / D-3 seed re-check** against live D1 (read-only) before seeding: the 37 Caterpillar rows and CUSIP `14913UAP5` (2 rows) still exist as built from the 16 Oct export; drop any that do not, and report.
3. **M4-2:** read the current `ops_dq_ticket` AUTOINCREMENT counter first; gate on **row counts**, not ticket numbers.
4. Go-live per your run sheet, re-dated (M4-3): record `meridian-ops` version **`2e4c3fc6`** (rollback) → migration 005 → M3/M3a/M3c/M3d seeds (write counts vs estimate; three-point check) → one deploy → smoke (D-1 list, D-2 create on a test ref then dismiss, D-3 page with CSP header, C-1 on a DQ ref, sweep `dq_new`), `d1-today` after.
5. Tell the Founder in chat **"004 live — <version>"** and put it at the top of your report, so LANE-1-ENG can start the 009 deploy.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. `claude/relays/FREEZES.json` is now `4d8202bbaf2cb9f854fc3870f3c4f624af963c6d3972467f5aeb2b5d9019d7fc` (A2 window re-pinned to **Sat 31 07:10Z → Sun 1 00:10Z**, ML-1030-1; today's freezes: 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10 UTC; sweep ≈ 22:00Z). **One production change at a time** across lanes: announce "starting <change>" with UTC time in your report log and check `claude/packets/*_Report.md` of the other Fri lanes for an open change first. Production steps end by 23:45Z. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`; never touch `13F Seed/gleif-seed.js`, `.env.*`, `.claude/settings.local.json`. D1 writes guarded and batched, three-point check first. Own worktree only.

Write `claude/packets/MA-OCT-004.GOLIVE_Report.md`. Reply **"MA-OCT-004.GOLIVE reported"**.
