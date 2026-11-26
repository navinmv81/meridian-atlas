# MA-NOV-REL.GO — Report

```text
OUTCOME:     RELEASED
RUN:         r-20261126T211309Z-3827 (interactive, Founder present), 2026-11-26 21:13–21:30Z
CONTROL:     MA-NOV-REL.GO_Control_v2.md 6f3779da9ec447fef166807c234f2da2ef7a5c53ba14c0dfce4dfe25eda5a9a8 (match)
TASK:        MA-NOV-REL.GO_Task_v2.md   f251165c169e31e37c8975b898622d24e6ff44a9efe9d5b439028d9628c46911 (match)
PINS:        UI_Spec 4b9896de…4abd, UI.REVIEW bec0ce5d…fabc6f, BOND.UI c0456a5f…25c6, BOND.APPLY 54df631f…c634 — all match
COMMITS:     74a9a03 (Part A, pushed 21:16:12Z); second commit = CLAUDE.md + this report
WORKER:      meridian-entities-api a9ffeaae-ea82-42cb-8bd8-32ac512f1c31 → e35d7c55-013f-4bf5-8bb2-a7d75fe60eca (21:17Z)
PAGES:       October-2026 /docs (98e830e) → November-2026 /docs (74a9a03), Founder "switched" 21:22:26Z
D1:          writes 944 (index build); reads ≈ 2,110 (1,901 build + 209 verification); 8 statements (1 DDL + 7 read-only); no PRAGMA checks
DEVIATION:   one, Founder-authorized in session (§A.3)
```

## A — Prep (repo)
1. **Stamps (M-1):** `?v=rel-20261126` on all 9 local `<script src>` tags in `App/index.html` (`ma-data`, `ma-search`, `ma-research`, `ma-modal`, `ma-etf`, `ma-market`, `ma-dcf`, `ma-13f`, `ma-entities`). No local stylesheets. `ma-ops.js` is not loaded by `index.html` (only by the Ops console shell, which loads it from Pages unstamped; out of scope).
2. **Mirror hard check (M-2):** `ops-a.test.mjs` now checks all 11 files byte-identical to `App/` plus `docs/.nojekyll` (was an info line over 3 files). PASS.
3. **Deviation (Founder-authorized ~21:15Z, "Authorize 2-line fix"):** the stamp broke `[OPS.A] terminal: none of its N loaded scripts…` (the test read `src` values literally, so `ma-*.js?v=…` matched nothing: 0 scripts → FAIL). The gate "suites failing" stopped the run. With the Founder's authorization, two lines outside "mirror check only" changed: line 33 `!/src="ma-ops\.js(\?[^"]*)?"/` (the guard still catches a stamped ma-ops.js), line 34 `.map(m => m[1].split("?")[0])`. Recorded in the CR §6.
4. **Index files:** `App/Corporate Atlas/migrations/ma-nov-bond-idx1.sql` (CREATE INDEX IF NOT EXISTS idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason)), `ma-nov-bond-idx1-rollback.sql` (DROP INDEX IF EXISTS idx_bi_cik_status).
5. **generate-docs:** dry run vs `docs/` → exactly `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js` (as expected). Real run 11/11; `docs/.nojekyll` present.
6. **Suites (all green after A.3):** bond-ui 120/120 · fi-009-worker 133/133 · fi-010-frontend 71/71 · exp-compute 160 · exp-route pass · exp-ui 270 · exp-backfill pass · exp-backfill-wiring pass · home-entry 177 · nav-007-key 34/34 · nav-007-frontend 39/39 · nav-007-worker 58/58 · ops-a 41/41 (incl. M-2) · ops-console ALL PASSED · ops-health 26/26.
7. **CR:** `claude/specs/MA-NOV-REL_CR.md`.
8. **Commit/push:** `74a9a03` "MA-NOV-REL.GO: November release — docs/ regenerated, script stamps, bond index files" (9 explicit paths); `git ls-remote` = `74a9a03` on `refs/heads/November-2026`.

## B — Index (D1, 21:16Z, inside the 07:10–23:45Z window)
| Query | Before | After |
|---|---|---|
| Issuer counts (F1 `documents`, Dominion CIK 0000715957) | `SCAN bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1` + temp B-tree GROUP BY | **`SEARCH bond_issuance USING INDEX idx_bi_cik_status (cik=?)`** + temp B-tree GROUP BY |
| 009 P-B1 F1 final list (CIK 0000077476) | `SEARCH … USING INDEX idx_bi_cik_final_key (cik=? AND (maturity_date,accession_number,tranche_seq)>(?,?,?))` | unchanged — still `idx_bi_cik_final_key` |

Apply: 1 query, rows written **944**, rows read 1,901, 10.3 ms. `sqlite_master` lists `idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason)` alongside the unchanged `idx_bi_cik_final_key` and `idx_bi_instrument`. No rollback trigger.

## C — Worker
- Previous (rollback target): `a9ffeaae-ea82-42cb-8bd8-32ac512f1c31` (2026-11-19 06:40Z).
- Dry run: 81.19 KiB / gzip 21.53 KiB (= BOND.UI dry run); binding `env.DB (meridian-etf)` only.
- Deploy (once, from `74a9a03`): **`e35d7c55-013f-4bf5-8bb2-a7d75fe60eca`**. Bindings unchanged (DB only); route unchanged (`meridian-entities-api.navinmv1981.workers.dev`); no crons.

| API check (GET) | Expected | Result |
|---|---|---|
| `/api/fi/issuers/1858/bonds?documents=1` | documents `{30,13,8,0,0,14,0}` | ✅ `{filings:30, shown:13, drafts_replaced:8, drafts_open:0, could_not_read:0, not_covered:14, unknown_reason:0}` |
| `/api/fi/issuers/1858/bonds` | no `documents` | ✅ absent |
| `/api/fi/ciks/0000715957/documents` | 22, `next_cursor` null | ✅ 22, null |
| `/api/fi/bonds/0001104659-24-027205/6` | 25 facts, 22 parties, no withheld, 99.657 | ✅ with a note: **19 served facts** + 22 parties; no `use_of_proceeds`/`proceeds_total`; `selling_restrictions.value_text` null; `issue_price_pct` 99.657. D1 holds **25 rows** for tranches (0, 6): 6 are `parties.*` state rows (served as `offering.states`) + 19 served fields. The "25" in BOND.UI §6 was the rows read (§4 scanstats), not served facts. Code is unchanged from BOND.UI. |
| `/api/fi/bonds/0001193125-24-131776/1` | trustee `not_disclosed` | ✅ |
| `/api/exposure/etf/SPY` | 200 + `newest_stored_month` | ⚠ **404 `{"error":"no_holdings","reason":"no_series_id","contract":"exp-1"}`**. The route is answered by the new version under contract exp-1; SPY has no N-PORT series id in the data. `/api/exposure/etf/IVV` (the screen's example) → **200, `newest_stored_month` 2026-09**. Not a release defect and not fixed by a rollback → not treated as a trigger. **Finding for Main Lane:** SPY has no series id. |

## D — Founder
Asked at ~21:18Z; Founder replied **"switched"**, recorded 21:22:26Z (no `gh` CLI in this session to read the Pages setting; Part E's byte-compare confirms the served source).

## E — Front-end checks (from 21:26:23Z, ≥ 10 min after the push; `cache-control: no-cache`)
| Check | Result |
|---|---|
| 11 served files byte-identical to `docs/` @ `74a9a03` | ✅ 11/11 (all 200) |
| `/.nojekyll` | ✅ 200 |
| Script tags carry `?v=rel-20261126` | ✅ 9/9 in served `index.html`; browser loaded all 9 stamped |
| Homepage 1280 / 800 / 375 | ✅ Research card visible, DELAYED shown, no sideways scroll (scrollWidth 1275 / 795 / 375) |
| Company search "Taiwan Semiconductor" → #2191 → Back | ✅ result "TW · operating · #2191" → `#/entity/2191` "Taiwan Semiconductor Manufacturing Co Ltd" → "← Back to Home" → home |
| `#/exposure` example (IVV 60 / EEM 25 / 2191 15) | ✅ "✓ Adds up to 100%" |
| Dominion issuer footer + "show list" | ✅ "From 30 SEC filings: 13 bonds shown · 8 draft documents · 14 not covered — show list"; list opens (→ "hide list") with filing rows |
| AbbVie bond page | ✅ Offering details (issuer, dates, price 99.657…) and Who's involved (Issuer AbbVie Inc; Trustee U.S. Bank Trust Company, N.A.). "What the money is for — Not read yet" is the withheld field, as designed (bond-ui test line 278) |
| O-11 Ops `release-ledger` / `sprint-board` | ✅ 200 with rows (12 / 19), after the designed A6 302 → `meridian-control`. The first, non-following curl showed the 302 itself; the repeat followed it as a browser does. |

## Founder live UAT checklist
Hard-refresh first (Pages caches 10 min).
- **Ops console (signed in):** open the console from the OPS tile (new tab) → four tabs load; Cases → open a case drawer, close it; DQ tab renders; Drift & Budget panels render; Health tab; repeat on phone width.
- **Homepage:** Research card; DELAYED badge; company search box; "See an example" link; phone width with no sideways scroll.
- **Exposure:** the example → "✓ Adds up to 100%"; add/remove a row; try your own ETF (note: SPY currently answers "no holdings").
- **Bonds:** Dominion Energy (#/entity/1858) footer + show list; AbbVie 5.400% 2054 (#/bond/0001104659-24-027205/6) Offering details + Who's involved; Verizon (#/bond/0001193125-24-131776/1) trustee shows "not disclosed".

## Rollback commands (per part)
- **E/D (front end):** Founder switches Pages back to `October-2026` `/docs` (`98e830e`) in GitHub Settings → Pages.
- **C (Worker):** `npx --prefix "App/Corporate Atlas" wrangler rollback a9ffeaae-ea82-42cb-8bd8-32ac512f1c31 -c "App/Corporate Atlas/wrangler-entities-api.toml" -m "<reason>"`.
- **B (index):** `npx --prefix "App/Corporate Atlas" wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-idx1-rollback.sql"`.
- **A (repo):** `git revert 74a9a03` on `November-2026` (only after D/E rollback).
- Bond data: MA-NOV-BOND.APPLY §9 order, unchanged.

## CLAUDE.md change
DEPLOY_BRANCH entry only: source `November-2026` `/docs` @ `74a9a03`; rollback `October-2026` `/docs` @ `98e830e`; stamp rule (bump `?v=` every release); entities-api version ids; previous state kept as history. **Follow-up for the Main Lane (out of this packet's scope):** the separate "LOCAL_MASTER's own git branch" bullet still says "`October-2026` `/docs` is the live Pages source"; it is now stale.

## Findings
1. SPY has no N-PORT series id → exposure 404 `no_holdings` (data, not code).
2. BOND.UI §6's "25 facts" counts rows read; the API serves 19 facts + 6 party states.
3. The `?v=` stamp needs test parsers that tolerate a query string (fixed in ops-a; other suites were already tolerant).

## Boundaries kept
Writes only inside the Control's paths (plus the Founder-authorized 2 lines in the allowed test file). One DDL, one deploy, no rollback needed. No GitHub settings touched by me; no toml/crons/secrets/other Workers; no other branches; no force-push; no `.env*`, tokens not printed; no Status/board/Tower/logs; no installs; no subagents; `13F Seed/gleif-seed.js` untouched. `.docs-dry-run/` left untracked (generator scratch output, not committed).
