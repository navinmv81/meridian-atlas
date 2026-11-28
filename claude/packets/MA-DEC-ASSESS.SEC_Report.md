# MA-DEC-ASSESS.SEC — Report (read-only security and access assessment: SEC-01, SEC-03, AUD-01)

```text
PACKET:       MA-DEC-ASSESS.SEC · Control v1 (sha256 3c210aaa…4f27) · Task v1 (sha256 07d1d353…2c65)
EXECUTED BY:  Operations Lead (security assessment) — interactive Claude Code, LANE_OPENER_v3
RUN:          r-20261128T144208Z-95fc · 2026-11-28 (Saturday) 14:42–14:51Z
PRECONDITIONS: no .git/*.lock · branch December-2026 · HEAD 5af13515d799 = origin/December-2026 · outside both quiet windows
OUTCOME:      Complete. Nothing changed: no deploy, no secret write, no D1 command, no git write, no POST/PUT/PATCH/DELETE.
REQUESTS:     38 anonymous HTTP requests (budget 60); est. ≈ 230k D1 rows read in total (≈ 4.6 % of 5M/day)
```

Scope note: the route inventory is from source at `5af1351`. Deployed versions were listed (§5.1) but the deployed bundles were not diffed against source. `meridian-13f` (12 Aug) and `meridian-filings` (9 Aug) are the oldest deployments.

---

## 1. Route inventory (SEC-01, AUD-01)

Auth key: **none** = anonymous; **Access+JWT** = Cloudflare Access at the edge (302 to `meridian-atlas-except.cloudflareaccess.com`, seen live) plus the Worker re-verifies the JWT and fails closed if `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` are unset; **emitter key** = `X-Ops-Emitter` + `X-Ops-Ingest-Key`, sha256 compared in constant time to `OPS_INGEST_KEYS`; **bearer** = `Authorization: Bearer` compared to `RUN_AUTH_SECRET` and fails closed if unset; **hdr secret** = a named header compared to a secret and fails closed if unset.

### 1.1 meridian-ops (`App/Ops/src/ops-api.js` + `cases.js`) — deployed `d9c3c386` (2026-11-05)

| Method · path | Auth | CORS (ACAO) | D1 tables | Caller |
|---|---|---|---|---|
| GET `/api/ops/budget-risk` | **none** | `*` | `holdings_pipeline_state` (1 PK read) | console Drift & Budget tab (`ma-ops.js` → `data_opsGet`, same-origin in the console) |
| GET `/api/ops/openfigi-status` | **none** | `*` | 4× `COUNT(*)`: `instrument_master`, `instrument_entity_map`, `openfigicache` ×2 | console Drift & Budget |
| GET `/api/ops/cf/d1-today` | **none** | `*` | none (CF GraphQL with secret `CF_ANALYTICS_TOKEN`) | console Drift & Budget |
| GET `/api/ops/cf/invocations?script=` | **none** (script allow-list) | `*` | none (CF GraphQL, `CF_ANALYTICS_TOKEN`) | console Drift & Budget (3 cron scripts) |
| GET/HEAD `/api/ops/{sprint-board,release-ledger,events,drift}` | none | `*` | none (302 to meridian-control) | none current |
| POST 4 legacy paths (`/api/ops/sprint-board…`, `/release-ledger…`) | explicit 401 | `*` | none | retired `App/Ops/seed-ops-tables.js` only |
| POST `/api/ops/ingest/run-event` | emitter key | none | `ops_job_registry`, `ops_job_run` (r/w) | 4 cron Workers (`ops-heartbeat.js`), local jobs (`lib/ops-outbox.mjs`) |
| POST `/api/ops/ingest/sweep` | emitter key | none | ops_* tables (r/w), reads `openfigicache`, `instrument_*`, `entity_master`, `holdings_pipeline_state` | health-check LaunchAgent (`13F Seed/check-pipeline-health.js`, installed by `App/Ops/scripts/health-check-install.sh`) |
| GET `/api/ops/admin/jobs` | Access+JWT | none | `ops_job_registry`, `ops_job_run`, pauses | console |
| GET `/api/ops/admin/console` | Access+JWT | none | none (HTML shell, assets from GitHub Pages) | operator browser |
| GET/POST `/api/ops/admin/exceptions` (E-1/E-2) | Access+JWT (+ service-token gate `OPS_SERVICE_ACTORS`; POST needs CSRF header) | none | `ops_exception`, `ops_case_event` | console; `ops-script` service token |
| GET `/api/ops/admin/cases/:ref`, POST `…/action` (C-1/C-2) | Access+JWT (+ gate; CSRF) | none | ops_* case tables | console; `ops-script` service token |
| GET/POST `/api/ops/admin/dq-tickets`, GET `/api/ops/admin/dq/new` (D-1/D-2/D-3) | Access+JWT (+ gate; CSRF) | none | `ops_data_quality_ticket`, `ops_case_event` | console; `bond-runner` service token (D-2; its client ID is still the placeholder `__BOND_RUNNER_CLIENT_ID__`) |
| OPTIONS any | none | `*` on public paths, none on admin/ingest | none | browsers |

### 1.2 meridian-control (`App/Ops/src/control-api.js`) — deployed `c442209c` (2026-10-24), 0 secrets

| Method · path | Auth | ACAO | D1 tables | Caller |
|---|---|---|---|---|
| GET `/api/ops/sprint-board[?stage=]` | **none** | `*` | `sprintboarditems` (`SELECT *`) | **none current** (removed from console by MA-NOV-UI) |
| GET `/api/ops/release-ledger` | **none** | `*` | `releaseledger` (`SELECT *`) | none current |
| GET `/api/ops/events[?ticket_id&release_id&since&limit≤500]` | **none** | `*` | `operationalevents` (`SELECT *`, incl. `payload`) | none current |
| GET `/api/ops/drift` | **none** | `*` | `releaseledger` | none current (UD-2) |
| POST `/api/ops/admin/sprint-board[/:id/stage]`, `/api/ops/admin/release-ledger[/:id/event]` | Access+JWT | none | the 3 tables above (write) | none current (tables frozen legacy) |
| POST 4 legacy paths | explicit 401 | `*` | none | — |

### 1.3 meridian-proxy (`App/ETF Refresh/src/index.js`) — deployed `9253b611` (2026-10-26), secret `FMP_API_KEY`

All routes: **none**, ACAO `*`, `GET, OPTIONS`, read-only D1.

| Path | D1 / upstream | Caller |
|---|---|---|
| GET `/api/ops-health` | `holdings_pipeline_state`, `etf_master`, `edgar_bootstrap_state` (≈ 491 rows/call, documented ML-1025-3) | console Health tab (`data_proxyGet`, cross-origin, anonymous) |
| `/api/etf-list` (`?etflist`), `/api/etf-holdings`, `/api/etf-prospectus`, `/api/etf-snapshot`, `/api/etf-holdings-stored`, `/api/etf-changes`, `/api/etf-overlap`, `/api/etf-compare`, `/api/etf-exposure`, `/api/universe-changes`, `/api/13f-search`, `/api/13f-filings` | ETF/holdings tables | public site (`ma-etf.js`, `ma-data.js`, `ma-modal.js`, `ma-dcf.js`) |
| `?symbol`, `?search`, `?fundsymbol`, `?dcf`, `?quickprofile`, `?ipos` | upstream FMP (server-side key) / SEC / Yahoo | public site |
| `?url=` | Yahoo host allow-list (2 hosts), else 403 (seen live) | `pfetch()` in the site |

### 1.4 meridian-entities-api (`App/Corporate Atlas/src/entities-api.js`) — deployed `e35d7c55` (2026-11-26), secret `ADMIN_EXCEPTIONS_SECRET` (unused, see F7)

All routes: **none**, ACAO `*`, `GET, OPTIONS`; read-only pre-computed tables (entity, instrument, exposure, bond). No write routes remain.
`/api/entities/search`, `/api/entities/isin/:isin`, `/api/entities/:id`, `…/:id/graph`, `…/:id/etf-exposure`, `…/:id/instruments`, `…/:id/issuer-panels`, `…/:id/exposure`, `/api/instruments/:key`, `/api/exposure/etf/:symbol` (R-EXP1, cached), `/api/fi/coverage`, `/api/fi/issuers/:k/{bonds,ladder}`, `/api/fi/ciks/:cik/{bonds,documents}`, `/api/fi/bonds/:a/:b`; `/(admin/)exceptions*` → 410 with no D1 access (seen live). Caller: the public site (`ma-entities.js`, `ma-etf.js`, `ma-data.js`).

### 1.5 meridian-13f (`worker-13f.js`, deployed `c93145c9` 2026-08-12) and meridian-filings (`worker-filings.js`, deployed `24068fab` 2026-08-09)

All routes: **none**, ACAO `*`, read-only. 13F: `/api/13f-search`, `/api/13f-filings`, `/api/13f-manager`, `/api/13f-manager-holdings` (`managermaster`, filings and holdings tables). Filings: `/api/filing-doc` (sec.gov host allow-list, 403 otherwise, seen live) and `/api/issuer-filings`. Caller: `ma-13f.js`.

### 1.6 Cron and job Workers

| Worker (deployed) | Routes | Auth | ACAO | D1 | Caller |
|---|---|---|---|---|---|
| meridian-holdings (`888af088`) | GET `/` (text), **GET `/status`**, any `/run` | `/status` **none**; `/run` hdr secret `X-Holdings-Run-Secret` (401 seen live) | none | `/status`: `holdings_pipeline_state` (full) + `COUNT(DISTINCT series_id)` on `fund_snapshot_monthly`, **`COUNT(*)` and `COUNT(DISTINCT series_id)` on `fund_holdings_monthly`** (≈ 2.03M rows) | `/status`: **no caller in repo**; `/run`: manual, Founder |
| meridian-entities-seed (`135607d4`) | `/run` (any method) | bearer (401 seen live, before any D1) | none | entity tables (write) | manual |
| meridian-entities-enrich (`aa39edf6`) | `/run` (any method) | hdr secret `X-Enrich-Run-Secret` (401 seen live, OPTIONS too) | none | entity tables (write) | manual / `entities-enrich-boost-run.mjs` |
| meridian-entities-figi (`5c8c547c`) | `/run`, `/rematch` | bearer (401 seen live) | none | `openfigicache`, map tables (write) | manual |
| meridian-entities-delta (`47c216c0`) | `/run` | bearer (401 seen live) | none | entity tables (write) | manual |
| meridian-bootstrap (`4e417f40`) | every path → 404 | n/a | none | none via fetch | — |
| meridian-firds | `/run` (**any method, no auth**: any request runs `processOneChunk`, which writes D1) | **none** | none | `firds_instrument_reference`, entity/instrument maps | **not deployed** (API code 10007, "Worker does not exist") — not probed |

---

## 2. Live anonymous probe (38 requests, no credentials, no cookies, `redirect: manual`)

Only status, type, size, top-level keys and counts were recorded. No values.

| # | Request | Status | Type · size | Top-level keys / counts | Data class | Est. D1 rows |
|---|---|---|---|---|---|---|
| O1 | ops GET budget-risk | 200 | json 56 B | ok, writes_today, daily_limit, pct | today's write counter | 1 |
| O2 | ops GET openfigi-status | 200 | json 162 B | ok + 5 count fields | table row counts / coverage % | ≈ 171,000 (4 full COUNTs: ≈ 72.8k + 41k + 28.6k + 28.6k) |
| O3 | ops GET cf/d1-today | 200 | json 142 B | ok, date, readQueries, writeQueries, rowsRead, rowsWritten, daily_cap, pct_of_cap | account-wide D1 usage today | 0 (1 CF API call) |
| O4 | ops GET cf/invocations?script=meridian-holdings | 200 | json 166 B | ok, script, date, cron_invocation_count, cron_invocations[0], all_trigger_invocation_count, matches_cron_only | cron run times and status per Worker | 0 (1 CF API call) |
| O5 | ops GET sprint-board | 302 → meridian-control same path | 0 B, ACAO * | — | redirect | 0 |
| O6–O8 | ops GET admin/jobs, admin/console, admin/exceptions | 302 → Access login | html 143 B, no ACAO | — | edge Access | 0 |
| O9 | ops OPTIONS admin/cases/X/action | 400 (Access) | html 155 B | — | edge Access | 0 |
| O10 | ops OPTIONS ingest/run-event | 204 | no ACAO | — | — | 0 |
| O11 | ops GET ingest/sweep | 404 | json 32 B | ok, error | — | 0 |
| O12 | ops OPTIONS sprint-board | 204 | ACAO * | — | — | 0 |
| C1 | control GET sprint-board | 200 | json 92,564 B | ok, items[19] | packet titles, stages, owner roles, blockers, next steps, free-text notes | ≈ 40 |
| C2 | control GET release-ledger | 200 | json 15,413 B | ok, items[12] | release ids, change summaries, file lists, deploy status | ≈ 12 |
| C3 | control GET events?limit=5 | 200 | json 1,247 B | ok, events[5] | event type, ticket/release id, actor_role, **payload** (see F3) | ≤ 1,500 (scan + sort; table size unknown) |
| C4 | control GET drift | 200 | json 40 B | ok, drift[0], has_drift | release drift flags | ≈ 12 |
| C5 | control GET admin/sprint-board | 302 → Access login | html 143 B | — | edge Access | 0 |
| C6 | control OPTIONS admin/release-ledger | 400 (Access) | html 155 B | — | edge Access | 0 |
| X1 | proxy GET ops-health | 200 | json 513 B | pipeline{7}, coverage{4}, bootstrap{2}, enrichment{5}, rows_read, snapshot_at | pipeline cursor, last-run status, coverage counts, writes today | ≈ 491 |
| X2 | proxy GET etf-list | 200 | json 65,893 B | array[264] | public product data | ≤ 5,000 |
| X3 | proxy GET etf-snapshot?symbol=SPY | 200 | json 501 B | ticker, snapshots[1], holdings_as_of, holdings_count, data_freshness | public product data | ≤ 50 |
| X4 | proxy GET ?url=example.com | 403 | json 57 B | error, status, type | allow-list works | 0 |
| X5 | proxy OPTIONS etf-list | 200 | ACAO * | — | — | 0 |
| E1 | entities GET search?q=apple | 200 | json 2,434 B | results[8] | public product data | ≈ 43,600 (LIKE '%q%' full scan of `entity_master`) |
| E2 | entities GET fi/coverage | 200 | json 6,739 B | data_type, gate, issuers[34], totals{4}, multi_cik_keys, as_of | public product data | ≤ 3,000 (edge-cached) |
| E3 | entities GET admin/exceptions | 410 | json 76 B | error, moved_to | retired surface | 0 |
| E4 | entities OPTIONS search | 204 | ACAO * | — | — | 0 |
| F1 | 13f GET 13f-search?manager=berkshire | 200 | json 373 B | manager_query, cik, name, ticker, alternatives[4], source | public product data | ≤ 10,000 (`managermaster` LIKE) |
| G1 | filings GET filing-doc?url=example.com | 403 | json 65 B | error, hostname | allow-list works | 0 |
| H1 | holdings GET / | 200 | text 24 B | — | banner | 0 |
| H2 | holdings GET /run | 401 | json 37 B | ok, message | fail-closed | 0 |
| S1 | seed GET /run | 401 | json 35 B | ok, error | fail-closed | 0 |
| N1–N2 | enrich GET /run, OPTIONS /run | 401, 401 | json 37 B | ok, message | fail-closed | 0 |
| I1–I2 | figi GET /run, /rematch | 401, 401 | json 35 B | ok, error | fail-closed | 0 |
| D1 | delta GET /run | 401 | json 35 B | ok, error | fail-closed | 0 |
| B1 | bootstrap GET / | 404 | text 9 B | — | — | 0 |

**Total ≈ 230,000 D1 rows read** (about 4.6 % of the 5M/day free allowance; 74 % of it is O2 and E1).

**Deliberately not probed:**
- `meridian-holdings GET /status`: by source, one anonymous call reads about 2–4M rows (two whole-table aggregates over `fund_holdings_monthly`, ≈ 2.03M rows). That is up to most of the daily read allowance, so the finding rests on source alone (F2).
- `meridian-firds /run`: any method runs a write chunk. The Worker is not deployed anyway.
- The remaining public product routes in §1.3–1.5 were classified from source. They are the public site's data surface and are anonymous by design. They were not probed one by one, to stay within the request and read budgets.

No probe returned anything that looked like a credential. Only keys and counts were captured, so personal data in values could not be seen live. F3 records the source evidence that it may be present.

---

## 3. Consumers if protected, and SEC-02 options

### 3.1 What breaks if the anonymous non-product GETs are closed

| Route | Current callers | Breaks if closed? |
|---|---|---|
| ops `budget-risk`, `openfigi-status`, `cf/d1-today`, `cf/invocations` | operator console only (same-origin on meridian-ops, Drift & Budget tab) | Console tab breaks **unless** the console request carries Access auth: it does if Access covers these paths, because the console is same-origin and the `CF_Authorization` cookie is sent. |
| proxy `/api/ops-health` | console Health tab (cross-origin to meridian-proxy, anonymous `fetchWithTimeout`) | Yes. It needs a code change (move it behind meridian-ops admin, or a credentialed CORS fetch). |
| control `sprint-board`, `release-ledger`, `events`, `drift` | **none** (console views removed by MA-NOV-UI; tables frozen legacy; only the retired `seed-ops-tables.js` names them) | No current caller breaks. |
| holdings `/status` | **none** in repo | No caller breaks. |
| ops ingest (`run-event`, `sweep`) | 4 cron Workers, local jobs, health-check LaunchAgent | Must stay outside Access. They are already key-authenticated, and the LaunchAgent calls only `POST /api/ops/ingest/sweep`. |
| product routes (proxy, entities-api, 13f, filings) | public site | Out of scope: public by design. |

### 3.2 Options (none applied)

| Option | What | Console | LaunchAgent / cron ingest | Free-tier cost | Rollback |
|---|---|---|---|---|---|
| **A. Access path policies (dashboard only, no deploy)** | Add the 4 ops GET paths to the existing meridian-ops Access app. Put all of meridian-control `/api/ops/*` behind its Access app. `/api/ops/ingest/*` stays uncovered. | Works (same-origin cookie). Health tab still needs the proxy fix. | Unaffected (ingest not covered) | 0 D1. Access Free ≤ 50 seats (one operator plus the `ops-script` service token today). | Remove the paths from the Access app in the dashboard; instant. |
| **B. Code: close or move (deploys)** | Delete the zero-caller routes (control's 4 public GETs, holdings `/status`). Move the 4 ops GETs under `/api/ops/admin/` (rename, not new routes: the 15/15 route ceiling holds). Move `ops-health` into meridian-ops admin, or fold it into an existing admin route (the ceiling forces a fold). Update `ma-ops.js`/`ma-data.js` and run a site release. | Works after the front-end release | Unaffected | Removes ≈ 171k + 491 reads per anonymous hit; deploy cost only | `wrangler rollback` to the versions in §1 plus Pages rollback; needs a Change Request; no three-point check (no cron change) |
| **C. Minimal (accept + trim)** | Only delete holdings `/status` and close the control GETs (zero callers). Accept the ops metrics GETs as low-sensitivity, but drop ACAO `*` so browsers on other origins cannot read them. | Unchanged | Unaffected | Removes the multi-million-read hazard | Redeploy previous versions |

Ops Lead view, for C1b ranking only (not applied): **C now, A next**. C removes the two highest-risk anonymous routes with no consumer impact. A then closes the rest without code. B is the clean end state if the console is rebuilt.

---

## 4. Token revocation evidence (SEC-03)

Method: `git log -p --all` (every commit reachable from any local or remote ref) and a read-only scan of the untracked `13F Seed/gleif-seed.js`. Literals matched by name (`TOKEN`, `CF_API_TOKEN`, `Bearer`, …) and by Cloudflare-token shape. Each was hashed in memory, and only `sha256(literal)[0:12]` and the length were printed. No literal and no part of one was displayed, logged or written, and no API was called with any literal.

| ID | Fingerprint (sha256, 12 hex) | Length | Where | Reachable from |
|---|---|---|---|---|
| **T1** | `2de0570c16a3` | 93 | commit `c3a07c7` (2026-06-25), 4 files: `Corporate Atlas/gate1-instrument-resume.js`, `gate2-refresh.js`, `isin-backfill-step4.js`, `isin-backfill.js` | `origin/corporate-atlas-v4-deploy-clean` (on GitHub, tip `c82963e`) |
| **T2** | `0faf5d254b0a` | 93 | commit `c3a07c7`, 7 files: `Corporate Atlas/gate1-instrument-seed.js`, `gate2-instrument-entity-map.js`, `gate3-exposure.js`, `gate4-flags.js`, `gleif-seed-4a.js`, `gleif-seed-4d-fix.js`, `gleif-seed.js`; **and** untracked `13F Seed/gleif-seed.js` line 10 (`const TOKEN = …`) | same branch + local disk |
| (n/a) | `1fc1d6bf2ba9` | 36 | `App/Ops/tests/cases-contract.mjs` (commit `76f4261`): a fake `token=` value inside a redaction test | not a credential |

- **No branch or tag tip holds T1 or T2.** That covers all local and remote heads, including `origin/main` and `September-` to `December-2026`, by `git grep` on each ref. `c3a07c7` is an ancestor only of `corporate-atlas-v4-deploy-clean`. No stashes exist.
- The same untracked file also holds the account ID and D1 database ID. Those are identifiers, not credentials, and the account ID is already in `wrangler-ops.toml`.
- **The repo is public:** `gh` is not installed on this machine, so `gh repo view` could not run. The evidence: the remote is `https://github.com/navinmv81/meridian-atlas.git`; the site is served by GitHub Pages from it on a personal account (free-plan Pages requires a public repo); and CLAUDE.md records it as public (MA-OCT-000). The Founder can confirm under GitHub → repo → Settings → General → "Danger Zone: visibility".
- Whether T1/T2 equal the current `13F Seed/.env` token was **not checked**, because reading `.env*` is prohibited. CLAUDE.md records the current token as different.

### Founder checklist (Cloudflare dashboard, about 10 minutes)
1. Open **My Profile → API Tokens** (user tokens). Then open **Manage Account → Account API Tokens** (account-owned tokens).
2. For each token listed, note its **name, creation date, last-used date and status**. T1/T2 were committed **2026-06-25 21:30 BST**, so suspect any token created on or before that date whose name suggests the Corporate Atlas gate1–4 scripts, GLEIF, ISIN backfill or "13F seed".
3. A suspect token with a **last-used** date after you rotated scripts to `.env` is in active use somewhere. Find the user before revoking it.
4. If any suspect token still exists: **Roll** it (or Delete it and create a replacement with the minimum scopes: D1 Edit on the one account only). Put the new value only in `13F Seed/.env`, then confirm the local jobs still run.
5. If you **cannot tell** which listed token is T1/T2: roll every token created on or before 2026-06-25 that has D1 or Workers write scope. Revocation is then certain without identifying the literal.
6. Also confirm the scopes of `CF_ANALYTICS_TOKEN` (expected: Account Analytics Read) and `CF_WORKERS_READ_TOKEN` (expected: Workers Scripts Read), the two secrets on meridian-ops.
7. Tell the Main Lane the result: "T1/T2 revoked (date)" or "rolled N tokens". Removing the literals from public history (rewriting or deleting `corporate-atlas-v4-deploy-clean`, which is the rollback source of an older release) needs its own Change Request. Revocation makes the literals harmless without it.

---

## 5. Over-privilege (AUD-01)

### 5.1 Secrets per Worker (`wrangler secret list`, names only)

| Worker | Secrets | Note |
|---|---|---|
| meridian-ops | `CF_ANALYTICS_TOKEN`, `CF_WORKERS_READ_TOKEN`, `OPS_INGEST_KEYS` | All referenced in source. The scopes of the two CF tokens are documented as read-only but unverified (checklist step 6). |
| meridian-control | — | |
| meridian-entities-api | `ADMIN_EXCEPTIONS_SECRET` | **Orphan:** no source references it since the exception surfaces became 410 (MA-OCT-003 R-3) |
| meridian-entities-seed / -enrich | `OPS_INGEST_KEY`, `RUN_AUTH_SECRET` | used |
| meridian-entities-figi | `OPENFIGI_API_KEY`, `RUN_AUTH_SECRET` | used |
| meridian-entities-delta | `RUN_AUTH_SECRET` | used |
| meridian-holdings | `HOLDINGS_RUN_AUTH_SECRET`, `OPS_INGEST_KEY` | used |
| meridian-bootstrap | `OPS_INGEST_KEY` | used (scheduled path; no cron since 2026-11-27) |
| meridian-proxy | `FMP_API_KEY` | used server-side |
| meridian-13f, meridian-filings | — | |
| meridian-firds | Worker does not exist | |

### 5.2 Local tooling
- `.claude/settings.local.json`: **0 allow-list entries**. Nothing pre-authorizes deploys, secret writes or remote D1.
- **The `wrangler` OAuth login on this Mac** has these write scopes: `workers`, `workers_scripts`, `workers_routes`, `workers_kv`, `d1`, `pages`, `secrets_store`, `ssl_certs`, `queues`, `pipelines`, `ai`, `ai-search`, `agent-memory`; plus `account`/`zone` read. It is what the local LaunchAgents and `wrangler d1 execute` use. That is far broader than any local job needs.

### 5.3 CORS and fail-closed
- ACAO `*` on non-public data: meridian-control's 4 GETs (internal project text, events payload), meridian-ops' 4 metric GETs, proxy `/api/ops-health`. Product routes are public by design.
- Admin and trigger surfaces are fail-closed, by source and live. Edge Access sends a 302 on `/api/ops/admin/*` for both ops and control. The Worker JWT check returns 401 when `CF_ACCESS_*` is unset. Every deployed `/run`/`/rematch` returns 401 before any D1 access, and fails closed when its secret is unset. No admin route was found that is not fail-closed. The one unauthenticated trigger is the **undeployed** `meridian-firds /run`.

---

## 6. Ranked findings

| # | Severity | Finding | Owner | Disposition | Feeds |
|---|---|---|---|---|---|
| F1 | **High** (Critical if either is still live) | Two Cloudflare API token literals (T1 `2de0570c16a3`, T2 `0faf5d254b0a`, both 93 chars) are in **public** git history at `c3a07c7`, reachable from `origin/corporate-atlas-v4-deploy-clean`. T2 is also in the untracked `13F Seed/gleif-seed.js`. Revocation is unconfirmed. | Founder (dashboard), Ops Lead | **Fix now:** Founder runs the §4 checklist. Remove T2 from the untracked file only on Founder say-so (standing rule). A history rewrite is a separate CR. | SEC-03 |
| F2 | **High** | `meridian-holdings GET /status` is anonymous and runs whole-table aggregates over `fund_holdings_monthly` (≈ 2.03M rows) and `fund_snapshot_monthly`: est. 2–4M D1 rows read per call against 5M/day. Any visitor can drain the shared daily read allowance in one or two calls. No caller exists. (Source only; not probed.) | Ops Lead / ETF domain | **Fix now:** delete the route or gate it with `HOLDINGS_RUN_AUTH_SECRET` (option C) | SEC-01, SEC-02 |
| F3 | **High** (Critical if confirmed) | `meridian-control` serves `sprintboarditems`, `releaseledger` and `operationalevents` anonymously with ACAO `*`. Since MA-OCT-002a, admin writes store the Access-verified **actor email** in `operationalevents.payload` (`control-api.js` line 431 `who`), and `/api/ops/events` returns `payload`. Live presence of an email was not checked: the probe captured keys only. Notes are free text. No caller exists. | Ops Lead | **Fix now:** close the 4 GETs (option A or C). Main Lane may confirm with a counted check (`payload LIKE '%@%'`, count only) in a separate D1-allowed packet. | SEC-01, SEC-02 |
| F4 | Medium | `meridian-ops` anonymous metric GETs: `openfigi-status` costs ≈ 171k reads per call (read amplification); `budget-risk`, `cf/d1-today` and `cf/invocations` expose account usage and cron telemetry and spend the server-side `CF_ANALYTICS_TOKEN` API quota on any caller's behalf. ACAO `*`. Console is the only caller. | Ops Lead | Schedule: SEC-02 option A (or B) | SEC-01, SEC-02 |
| F5 | Medium | proxy `GET /api/ops-health` is anonymous (≈ 491 reads, pipeline state); console Health tab is the only caller | Ops Lead | Schedule with SEC-02 (needs a code change, §3.1) | SEC-01, SEC-02 |
| F6 | Medium | The local `wrangler` OAuth login has broad account-wide write scopes (Workers, D1, Pages, Secrets Store, SSL, Queues, AI…). Any local process or agent using it can deploy or write anything. | Founder | Schedule: give local jobs a scoped API token (D1 Edit + Workers Scripts Read) and keep OAuth for interactive deploys | AUD-01 |
| F7 | Low | Orphan secret `ADMIN_EXCEPTIONS_SECRET` on `meridian-entities-api` (no reader since MA-OCT-003) | Ops Lead | Schedule: `wrangler secret delete` in a fix packet | AUD-01 |
| F8 | Low (latent) | `meridian-firds` source: `/run` has no auth and no method check, so any request writes D1. The Worker is not deployed today. | Entities domain | Accept now; add `RUN_AUTH_SECRET` + POST-only before any redeploy | AUD-01 |
| F9 | Low | Public error paths echo `err.message` (ops non-private 500s, figi `/run` 500) | Ops Lead | Accept / schedule with SEC-02 code work | AUD-01 |
| F10 | Low | `OPS_SERVICE_ACTORS` keeps a placeholder `__BOND_RUNNER_CLIENT_ID__.access` entry (D-2). It is harmless but unused, so its route grant is dead config. | Ops Lead | Accept / tidy in a later Ops packet | AUD-01 |
| F11 | Info | Positives: every admin surface is behind edge Access plus a fail-closed JWT check; every deployed trigger returns 401 before D1; proxy and filings host allow-lists hold (403); legacy exception surfaces return 410; ingest is key-authenticated with hashed keys; settings allow-list is empty; the 36-char test literal is a fixture, not a credential. | — | — | — |

Critical: 0 confirmed (F1 and F3 escalate to Critical on confirmation). High: 3. Medium: 3. Low: 4.

---

## Non-actions

- No deploy, rollback, `secret put/delete`, `wrangler d1 …` of any kind, Access or dashboard change, or Cloudflare API call with any literal.
- No POST/PUT/PATCH/DELETE to any route. `meridian-holdings /status` and `meridian-firds /run` were not requested at all.
- No `.env*` file was read. No token or secret value, or any part of one, was printed or written: fingerprints and lengths only.
- `13F Seed/gleif-seed.js`: read-only fingerprint scan only. Not edited, not staged, not deleted.
- No git write (no add, commit, push, branch or stash). No file written except this report. Probe and scan helpers ran from the session scratchpad.
- No subagents. No edits to `_Status.json`, `STATUS_BOARD.md`, `claude/factory/`, LANE_OPENER or Main Lane records.
- `gh` is not installed, so the repo visibility evidence is the remote URL, GitHub Pages and the CLAUDE.md record (§4).
