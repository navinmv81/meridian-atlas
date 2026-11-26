# MA-NOV-REL — November release Change Request

```text
PACKET:     MA-NOV-REL.GO (Control v2 6f3779da…a9a8, Task v2 f251165c…6911)
WRITTEN BY: Operations Lead + Engineering Lead (interactive Claude Code, Founder present), 2026-11-26
APPROVED:   Founder Start Approval "approve MA-NOV-REL.GO v2" (2026-11-26T21:12Z) = release approval
```

## 1 Change
One go-live for November: exposure screen (EXP), Ops cleanup, homepage (HOME) and bonds (BOND-01–12). Bond data, the exposure route and the exposure back-fill are already live; this release adds:

| Part | What | Where |
|---|---|---|
| A | Release stamp `?v=rel-20261126` on the 9 local `<script src>` tags in `App/index.html` (no local stylesheets; `ma-ops.js` is not loaded by `index.html`, only by the Ops console shell). `docs/ops-a` mirror hard check restored (11 files byte-identical + `docs/.nojekyll`). Two index SQL files. `docs/` regenerated (changes exactly `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js`). | repo, branch `November-2026` |
| B | `CREATE INDEX IF NOT EXISTS idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason);` (BOND.UI D-CR3) | D1 `meridian-etf` |
| C | Deploy `meridian-entities-api` from the Part A commit (F1 `documents`, F5 issuer document list, F2 `offering`) | Cloudflare Worker |
| D | Founder switches GitHub Pages from `October-2026` `/docs` to `November-2026` `/docs` | GitHub Settings (manual) |
| E | Front-end live checks; then CLAUDE.md DEPLOY_BRANCH entry | read-only + repo |

Order is Worker before front end (BOND.UI §6): the API change is additive, the old screen ignores the new fields.

## 2 Impact
- **Users:** new homepage, exposure screen, bond issuer footer / document list / Offering details / Who's involved; Ops console cleanup. No route removed.
- **API:** additive fields and one new route (`/api/fi/ciks/{cik}/documents`). Existing callers unchanged; 009's F1 read budget unchanged for callers without `documents=1`.
- **Caching:** Pages serves `max-age=600`; the `?v=` stamp makes the new `index.html` fetch new scripts, removing the mixed-version window for script files. Bump the stamp on every release.
- **Crons, toml, secrets, other Workers:** untouched.

## 3 D1 cost
- Part B: one index build ≈ **943 row-writes** (one per `bond_issuance` row) plus ≈ 943 reads; then one extra index write per future `bond_issuance` insert/update of those columns.
- Verification: ≤ 12 read-only statements (`EXPLAIN QUERY PLAN`, `sqlite_master`), ≤ 10,000 rows read.
- Steady state: issuer views with `documents=1` and F5 pages drop from a full scan (943 rows, growing) to the issuer's own rows (35–125 today).
- Well inside free tier (100k writes/day, 5M reads/day).

## 4 Rollback (per part)
| Part | Trigger | Rollback |
|---|---|---|
| A | suites fail / wrong files changed | do not push; `git restore` the scoped files (nothing live) |
| B | issuer-counts plan not `SEARCH … USING INDEX idx_bi_cik_status`, or any 009 F1 final-list plan off `idx_bi_cik_final_key` | `npx wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-idx1-rollback.sql"` |
| C | deploy error, bindings/routes differ, API check fails | `npx --prefix "App/Corporate Atlas" wrangler rollback <captured previous version> -c "App/Corporate Atlas/wrangler-entities-api.toml" -m "<reason>"` (index may stay — harmless) |
| D/E | Founder does not confirm / a front-end check fails | Founder switches Pages back to `October-2026` `/docs` (`98e830e`). Worker stays (additive). |

Bond data rollback order is unchanged from MA-NOV-BOND.APPLY §9 and is not part of this release.

## 5 Checks
- A: suites bond-ui, fi-009-worker, fi-010-frontend, exp-* (compute, route, ui, backfill, backfill-wiring), home-entry, ops-a (incl. mirror), ops-console, ops-health, nav-007-* green; dry-run diff = the 4 expected files; push + `ls-remote`.
- B: plans before/after for issuer counts (Dominion CIK 0000715957) and 009 P-B1 F1 final-list; `sqlite_master` shows the index.
- C: previous → new version ids; bindings/routes unchanged; the five BOND.UI §6 API checks + `GET /api/exposure/etf/SPY`.
- E: served files byte-identical to `docs/` (11) and `/.nojekyll` 200; stamps present; homepage 1280/800/375; company search; exposure; Dominion footer; AbbVie bond page; Ops `release-ledger` and `sprint-board` GETs.

## 6 In-run deviation (Founder-authorized)
The stamp broke one `ops-a.test.mjs` terminal check (it parsed `src="ma-*.js"` exactly and found 0 scripts). Founder authorized, in session 2026-11-26 ~21:15Z ("Authorize 2-line fix"), a two-line test change outside the Control's "mirror check only" scope: strip `?…` when reading script srcs, and let the "no ma-ops.js" guard match a stamped src.
