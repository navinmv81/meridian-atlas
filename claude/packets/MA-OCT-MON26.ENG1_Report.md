# MA-OCT-MON26.ENG1 — Report: stop the `/api/ops-health` read burn

**Lane:** LANE-1-ENG, Engineering Lead (Claude Code). **Date:** Mon 26 Oct 2026, 19:43–19:50 UTC, inside the 19:40–23:45Z window.
**Opening checks:**
- Control `a88ba467…6e80` matches the STATUS_BOARD row; Task `fcea3c67…27a3` matches the Control.
- No `.git/*.lock`.
- **Pre-flight `wrangler whoami`:** logged in (OAuth), account `ea360704…`.
- Wrangler `/usr/local/bin/wrangler` 4.96.0.
- **ML-1024-1:** no secret file was read.

**Worktree:**
- Fresh `~/MeridianAtlas-work/mon26-worktree`, detached at `origin/October-2026` = **`76f4261`**.
- The shared checkout (stale 003 copies) was not used for code. It holds only this report.
- The worktree is left in place.

## Versions

| | Before | After |
|---|---|---|
| `meridian-proxy` | **`c95aa7b9-c6aa-45ca-b941-e0aeaf6623a5`** (9 Aug; the rollback target) | **`9253b611-341b-4c70-8e24-d2b3bc642553`** (19:46:36Z) |

**Live = repo before the change:**
- The deployed `c95aa7b9` script was downloaded through the script-content API (wrangler OAuth, token never printed).
- It was compared with a `--dry-run` bundle of `76f4261`: **byte-identical** (0 diff lines). So the deploy drops no live-only change.

**One production change tonight:** the deploy above. No D1 write, no other Worker, no Pages change.

## Step 2: Worker fix (`App/ETF Refresh/src/index.js`, +19/−17)

**1. Removed:** the `entity_master` query, a full scan of ≈ 88.8k rows on every call:

```sql
SELECT gleif_enrichment_version, COUNT(*) AS cnt FROM entity_master GROUP BY gleif_enrichment_version ORDER BY gleif_enrichment_version
```

**2. The response shape is kept for the live console** (`origin/September-2026:docs/ma-ops.js`, l.146–166, l.290):
- `enrichment` keeps `version_1_pending`, `version_2_complete` and `total`, now all **`null`**. It adds `by_version: {}` and `enrichment_source: "removed-ML-1025-3"`.
- The console computes `total || (v1 + v2) || 1`, so the total becomes 1 and the percentages 0. `(x || 0).toLocaleString()` handles the nulls.
- **It renders "0 enriched · 0 pending enrichment"** with no JS error (checked live, below).
- The wording can only change with a front-end release; it is a follow-up for the Mon 2 Nov release.
- `pipeline`, `coverage` and `bootstrap` are unchanged.
- **New additive field `rows_read`:** the sum of D1 `meta.rows_read` for the call, so the per-call cost can be observed.

**3. `writes_today` lookup:** `WHERE key LIKE 'writes_today_%' ORDER BY key DESC LIMIT 1` was a **full SCAN of `holdings_pipeline_state` plus a temp B-tree** (`LIKE` cannot use the PK). It is now the equivalent PK range `WHERE key >= 'writes_today_' AND key < 'writes_today\`'`, a SEARCH. It also uses `.all()` instead of `.first()`, so its `meta` counts toward `rows_read`.

**No new table, no D1 write, and no query that scans `entity_master`** (it is no longer referenced anywhere in `index.js` except a comment).

## Three-point check

**(i) Index audit**, EXPLAIN QUERY PLAN at 19:45Z (read-only, 5 statements, 0 rows read each):

| Query | Plan | Verdict |
|---|---|---|
| `holdings_pipeline_state WHERE key IN ('etf_offset','last_full_run','last_run_status', today)` | `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key=?)` | PK |
| `etf_master WHERE coverage_status='deep' GROUP BY coverage_depth ORDER BY coverage_depth` | `SEARCH etf_master USING INDEX idx_etf_master_coverage (coverage_status=?)` / `USE TEMP B-TREE FOR GROUP BY` | Index; the temp B-tree runs over the ≈ 244 deep rows only |
| `edgar_bootstrap_state ORDER BY key` | `SCAN edgar_bootstrap_state USING INDEX sqlite_autoindex_edgar_bootstrap_state_1` | Tiny state table (a few keys) |
| *(old)* `holdings_pipeline_state WHERE key LIKE 'writes_today_%' ORDER BY key DESC LIMIT 1` | `SCAN holdings_pipeline_state` / `USE TEMP B-TREE FOR ORDER BY` | **Replaced** |
| *(new)* `… WHERE key >= 'writes_today_' AND key < 'writes_today\`' ORDER BY key DESC LIMIT 1` | `SEARCH holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1 (key>? AND key<?)` | PK range |

**(ii) Live per-call rows read after the deploy:** **`rows_read` = 491** on each of 3 calls (19:47:02Z). That is ≤ 1,000. Before the change, the `entity_master` scan alone read ≈ 88.8k per call.

**(iii) Budget:** 491 × 144 polls a day = **70,704 rows/day ≤ 150k**. Sun 25 was ≈ 5.77M from this route. The poll pause (step 6) lowers it further once the front end ships.

## Step 4: Tests

- **New `App/ETF Refresh/tests/ops-health.test.mjs`: 26/26.** It runs the real handler on a recording D1 stub (no network). It checks:
  - **no query containing `FROM entity_master`**, no `LIKE` on `holdings_pipeline_state`, no write, at most 4 queries;
  - 200 + CORS;
  - every old top-level, `pipeline.*` and `enrichment.*` key is kept, with `pipeline`, `coverage` and `bootstrap` values computed as before;
  - `enrichment_source` and `by_version`, and that `rows_read` is reported;
  - **the live console's enrichment arithmetic gives finite numbers and doesn't throw.**
- **Against the old code** (`76f4261`'s `index.js` through `PROXY_SRC`): **18/26, with 8 failures**, including "no query containing `FROM entity_master`". The test fails on the old code, as required.
- **Existing proxy tests:** none in `App/ETF Refresh/`.

## Step 5: Deploy and smoke

- **Deploy:** one `/usr/local/bin/wrangler deploy --config wrangler.toml` from the worktree (`App/ETF Refresh/`), 92.20 KiB (18.49 gzip) → `9253b611`.
- **`/api/ops-health` ×3:** 200, ACAO `*`.
  - Shape compared with the pre-deploy response (`~/MeridianAtlas-work/mon26/ops-health.before.json`): every key kept, `pipeline` / `coverage` / `bootstrap` **byte-equal**, and `enrichment` plus `rows_read` added as above.
  - The pre-deploy enrichment values were `{27497, 165, 44413}`; they are now null.
- **ETF routes:** `/api/etf-list` → 200 (65,967 B); `?etflist=1` → 200.
- **Live Ops console:** `https://navinmv81.github.io/meridian-atlas/` → OPS. The Health tab renders, "Entity Enrichment Status · 0 enriched · 0 pending enrichment". **No JS error**, and no "Failed to load ops health". The only console error is the existing `meridian-proxy ?ipos=1` 402.
- **Rollback was not needed.** If ever needed: `wrangler rollback` to `c95aa7b9` (`--config "App/ETF Refresh/wrangler.toml"`).

## Step 6: `App/ma-ops.js` poll pause (local only, not released)

- New `_opsStartPoll()` / `_opsStopPoll()` and a `visibilitychange` listener.
  - Panel open and the tab becomes hidden → the interval is cleared.
  - Becomes visible → **one immediate refresh** and the interval restarts.
  - `openOps` starts the poll only if `!document.hidden`.
  - `closeOps` clears it as before, and a later visibility change doesn't restart it (the panel no longer exists).
- **Checked** by running the real file in a vm with stubbed timers and visibility (not committed; the Task asks only for the `entity_master` test):
  - **new:** open → 1 timer, 1 fetch; hidden → **0 timers**; visible → 1 timer, +1 fetch; closed → 0; visible after close → 0; open while hidden → 0;
  - **old (live):** hidden → still 1 timer (keeps polling).
- **`generate-docs.mjs` not run; `docs/` untouched.** The change ships with the Mon 2 Nov site release.

## Step 7: Commit

**`721d093d2d0448158766c2f591d3c8994a5b2166`** on `October-2026`, from the worktree, explicit paths only, pushed as a fast-forward of `76f4261`:

| File | SHA-256 |
|---|---|
| `App/ETF Refresh/src/index.js` | `0acf30bad8612f2d0d061a25be06db7707f595b06678ea8d4527a85f7696c661` |
| `App/ma-ops.js` | `f7332bb62eb79eb2d7e89e3060fee3c2d610ff659e9c92f0c3a1cbc8e83c1420` |
| `App/ETF Refresh/tests/ops-health.test.mjs` (new) | `2f8e811bc2e45d476393f9a37f19dccebafb61a01344873a07465bb0a506a3f2` |

- Not `September-2026`. This report is **uncommitted** (Main Lane commits governance).
- The shared checkout's local `October-2026` is now behind origin, as already noted for A6.

## Budget and notes

- **D1:** 0 writes. Reads: EXPLAIN × 5 (0 rows), plus the live smoke calls (3 × 491 + 1 pre-deploy call at the old cost, ≈ 88.8k).
- **One production change.** Nothing ran in a freeze window.
- **Follow-ups (not tonight):**
  - (a) In the Mon 2 Nov front-end release, `ma-ops.js` should show "enrichment counts removed (ML-1025-3)" when `enrichment_source` is set, instead of "0 enriched · 0 pending".
  - (b) If enrichment progress is still wanted, it needs a cheap source, such as a counter row written by the enrich Worker. That is a separate packet with its own three-point check.

**Stop point reached.**
