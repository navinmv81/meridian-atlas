# MA-OCT-MON26.ENG1 — Task v1 (immutable): Mon 26 evening — stop the `/api/ops-health` read burn

Governing: Decisions Log ML-1025-3 (D1 read limit exceeded Sun 25), ML-1025-4 (Mon evening only), ML-1025-5 (Option C, go-live Tue 3 Nov), **ML-1026-1** (this evening's scope). Window: start ≥ 19:40Z, finish before **23:45Z** (freeze 23:50–00:10Z). One production change tonight.

**Problem.** `meridian-proxy` `/api/ops-health` (`App/ETF Refresh/src/index.js`, the `enrichmentRows` query, ~l.100–105) runs `SELECT gleif_enrichment_version, COUNT(*) … FROM entity_master GROUP BY …` — a full scan (~88.8k rows) on every call. The Ops console polls it every 10 min (`ma-ops.js` `OPS_POLL_MS`). On Sun 25 it ran 65× = 5.77M rows read and took D1 past the 5M/day free limit. Note: the Cache API does not work on `*.workers.dev`, so caching is **not** a fix.

**Out of scope tonight (ML-1026-1):** the 007 front-end release, the PepsiCo R1f check, 003 deploys, the commit list, any D1 write. GitHub Pages serves `September-2026/docs` (never commit there); the October front end ships in the Mon 2 Nov site release.

Do in this order:
1. **Opener.** `wrangler whoami` (pre-flight, 7403 race). Check `.git/*.lock`. Create a **fresh worktree** from `origin/October-2026` (`76f4261`) at `~/MeridianAtlas-work/mon26-worktree`; do **not** work in the shared checkout (stale 003 copies there). Record the live `meridian-proxy` version id (rollback target).
2. **Worker fix (worktree, `App/ETF Refresh/src/index.js`).** Remove the `entity_master` GROUP BY from `/api/ops-health`. Keep the response shape backward-compatible for the **live** Ops console: read `origin/September-2026:docs/ma-ops.js` and confirm how it uses the enrichment fields; return values that render without a JS error (e.g. empty `by_version` / `null` totals plus `"enrichment_source":"removed-ML-1025-3"`). No new table, no D1 write, no new query that scans `entity_master`. Every remaining query must be a PK/indexed lookup or on a small table — show `EXPLAIN QUERY PLAN` for each (read-only, ≤ 5 queries).
3. **Three-point check** in the report: (i) index audit of every remaining ops-health query; (ii) one live call after deploy with rows-read from `meta` / D1 insights ≤ 1,000 rows per call; (iii) budget: ops-health reads per call × 144 polls/day ≤ 150k/day.
4. **Tests.** Run the existing ops-health / proxy tests if any; add a unit test asserting the handler issues no query containing `FROM entity_master`. Must fail on the old code.
5. **Deploy** `meridian-proxy` once from the worktree (`/usr/local/bin/wrangler deploy` with `App/ETF Refresh/wrangler.toml`). Then: `curl` `/api/ops-health` → 200, JSON shape keys unchanged; ETF routes smoke (`/api/etf-list` 200). Rollback = `wrangler rollback` to the step-1 version id on any failure.
6. **Front-end change, local only (no Pages release):** in the worktree, `App/ma-ops.js` — pause the 10-min poll while `document.hidden`, resume (one immediate refresh) on `visibilitychange`; clear the interval on panel close as today. Do **not** run `generate-docs.mjs` and do not touch `docs/`.
7. **Commit** by explicit path only (`App/ETF Refresh/src/index.js`, `App/ma-ops.js`, the new test file) on `October-2026` from the worktree; push. Never `git add -A`; never `September-2026`. Leave the worktree in place.

Security: ML-1024-1 applies — never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3).

Write `claude/packets/MA-OCT-MON26.ENG1_Report.md` in the **shared checkout's** `claude/packets/` (uncommitted; Main Lane commits governance later) with: versions before/after, the diff summary, EXPLAIN output, rows-read per call, test results, commit hash. Reply **"MA-OCT-MON26.ENG1 reported"**.
