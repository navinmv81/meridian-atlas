# MA-OCT-009.BUILD — Task v1 (immutable): 009/010 Fixed Income — build (local) + gate migration prepared

Governing: `claude/MA-OCT-009_010_Spec.md` **rev 1** `2f83d58e0042ebfe920f5823598ee3827c21c57b6bbc103f552cef419b2841f4` (all 16 review must-fix folded); WED28.ENG1 report `20543865fe63d51be24e3d3a97220d1445c55186f890daed5d4af5bdc2bbcf07` (deploy 5 live `1e54a425`; retirement commit `29ddfb4`). Base: `origin/October-2026` at or after `acfd069` — confirm `App/Corporate Atlas/src/entities-api.js` equals the retirement version recorded in the ENG1 report.

Do (local only — **no D1 writes, no deploy, no commit today**; the Architect code review runs first):
1. Build per rev 1: `fi_serving_gate` migration (Entities domain, created **closed**), F1/F1b/F2/F3/F4 routes, R1f gated + `parse_confidence >= 60`, cache key with gate `changed_at` (M-5), cursor per M-7, closed-gate F1 returns only `has_bond_link` (DIL M-4), CIK/LEI provenance fields; 010 page as a 007 layer + "Fixed Income" nav link (front end committed later, ships in the Mon 2 Nov site release).
2. Tests T-F1..T-F10 per rev 1, incl. 007 T2 58/58 and retirement 77/77 still green; must fail on the pre-009 tree. EXPLAIN for every query (read-only, local D1).
3. **M-6:** a plan to prove Cache API hits on `workers.dev` after deploy, or the uncached read budget.
4. The pre-deploy **PepsiCo check** exactly as rev 1 defines (it may run read-only now; record reads ≤ 8).
5. A **deploy run sheet** for the 009 Worker deploy (gate migration closed → deploy → smoke → rollback rule M-4) for Fri 30 after review, and a list of files to commit.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (today UTC: 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10; health-check sweep ≈ 22:00Z). **One production change at a time** across lanes — announce "starting <change>" with UTC time in your report log and check no other lane is mid-change. Production steps end by **23:45Z**; an unfinished production step waits for a new Control, it is not skipped silently. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`; never touch `13F Seed/gleif-seed.js`, `.env.*`, `.claude/settings.local.json`. D1 writes guarded, batched, three-point check first. Work in your own worktree, never the shared checkout.

Write `claude/packets/MA-OCT-009.BUILD_Report.md`. Reply **"MA-OCT-009.BUILD reported"**.
