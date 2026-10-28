# MA-OCT-004.BUILD — Task v1 (immutable): 004 Data-quality ticketing — build (local only tonight)

Governing: `claude/MA-OCT-004_Spec.md` rev 1 (`570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379`, Founder-approved 17 Oct); 003 live routes (commit `76f4261`, `meridian-ops` `14aa968c`); ML-1025-5 (004 go-live **Thu 29**). Tonight: **build and test locally only — no deploy, no D1 writes, no migration applied, no commits** (LANE-1-ENG commits on Thu after review).

Do:
1. New worktree from `origin/October-2026` at `~/MeridianAtlas-work/ma-oct-004/build-worktree`. Never work in the shared checkout.
2. Build 004 per spec rev 1: migration (tables, indexes), routes on `meridian-ops`, seeds (KI 22.44 / 22.9 / 22.43, 008 and 011 items, plus **new** D-2 "37 Caterpillar boilerplate labels" and D-3 "duplicate CUSIP `14913UAP5` across two accessions" from the 009 DIL review). Keep `meridian-ops` total endpoints **≤ 15** — report the count (005 Option B will need one more).
3. Tests: contract tests for every route (CSRF header, request id, replay/409, actor attribution), migration test on a local D1, EXPLAIN for every query (no full scans of large tables); must fail on the pre-004 tree.
4. Three-point check written out (index audit, single-execution ≤ 50k rows, per-invocation read/write budget) and a **Thu 29 go-live run sheet**: rebase onto LANE-8-ENG's deploy-4 commit (they will give the hash), apply migration, seed writes count, one `meridian-ops` deploy, smoke, rollback ids.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (tonight: 23:50–00:10Z; sweeps 21:00Z). **One production change at a time** across all lanes — before any deploy or D1 write, check no other lane is mid-change (announce "starting <change>" in your report log with UTC time). ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret` (existence/mode/size only). Stop before any macOS permission prompt (ML-1013-3). Stage by explicit path only; never `git add -A`; never `September-2026`; never touch `13F Seed/gleif-seed.js`, `.env.*`, `.claude/settings.local.json`. D1 writes: `INSERT OR IGNORE` / guarded statements, `db.batch()`, three-point check documented first.

Write `claude/packets/MA-OCT-004.BUILD_Report.md`. Reply **"MA-OCT-004.BUILD reported"**.
