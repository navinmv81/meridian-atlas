# MA-OCT-000 — Close-out Summary: Runtime Truth Baseline

```text
ISSUED BY:    Program Orchestrator (Control)
EXECUTED BY:  Operations Lead (local Claude Code, Founder's Mac)
REVIEWED BY:  Architect
APPROVED BY:  Founder
PACKET:       MA-OCT-000 — Runtime truth baseline (Build Brief rev 2)
GATE:         Close-out approval — awaiting Architect review
```

**Executed:** 2026-09-23, from `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` on `September-2026`.
**Final status:** **Complete — uncommitted by Founder decision.** Every acceptance criterion is met or its gap is named (see §12). Nothing at runtime was changed. On 2026-09-24 the Founder decided not to commit or push; the commit and its path are deferred to pre-go-live. The reviewed file state is pinned by `claude/MA-OCT-000_Review_Checksums.txt` (see §13).
**Companion outputs:**
- `claude/MA-OCT-000_Job_Manifest.md` and `claude/MA-OCT-000_job_manifest.json`: 47 jobs, 16 of them scheduled or deployed.
- `claude/MA-OCT-000_Change_Request_October_Branch.md`: drafted only.

---

## 1. Headline findings (all recorded only, not fixed, per "Do not do")

| # | Severity | Finding | Evidence | Suggested owner |
|---|---|---|---|---|
| F1 | **High — security** | **Two Cloudflare API token literals are in public git history.** Commit `c3a07c7` ("Baseline: ETF Refresh + Corporate Atlas before Sprint 2") contains hardcoded tokens in 9 files under `Corporate Atlas/` (`gleif-seed*.js`, `gate1-4*.js`, `isin-backfill*.js`). That commit is reachable from `origin/corporate-atlas-v4-deploy-clean`, and the repo is **public** (GitHub API: `"visibility": "public"`). One of the two tokens is byte-identical to the literal still in the untracked `13F Seed/gleif-seed.js`. No branch tip holds a literal. The current `13F Seed/.env` token is a **different** token. | Hashes only, compared locally; no values printed or recorded. | **Founder:** confirm both tokens are revoked in the Cloudflare dashboard → API Tokens. Scrubbing history needs its own CR. |
| F2 | High | **`meridian-entities-seed` runs on Sunday, not Monday.** Its `0 4 * * 1` was intended as "Monday 04:00 UTC, one day after holdings". Cloudflare's day-of-week field is 1–7 with **1 = Sunday**. Observed: it fired Sunday 04:00 on 30 Aug and 6/13/20 Sep, **in the same second as `meridian-holdings`**, and made zero invocations on any Monday. | `meridian-ops` `/api/ops/cf/invocations` (§6). The holdings toml notes that CF rejected `0 4 * * 0`, which corroborates the 1–7 numbering. | Data-Identity Lead + Architect (a cron change needs the three-point check). This is very likely the root cause of **Known Issue 22.1**. |
| F3 | High | **`holdings` Sunday run ends `partial` because the budget is spent at start.** On 20 Sep, `writes_today_2026-09-20` = 83,638 at 04:00:15, which is already above holdings' 80k guard. `last_run_status` = `running:31/237:partial:9`, and the state stopped updating about 30s into the run. This is consistent with F2's co-fire. | D1 `holdings_pipeline_state` | ETF Product Lead |
| F4 | High | **The GLEIF enrichment queue has stalled.** The latest `last_attempt` on any `entity_enrichment_queue` row is **2026-08-31**. **26,537 rows are `pending` and have never been attempted**, including 771 older than 90 days. 1 row has been stuck `in_progress` since 2026-06-11. Meanwhile `entities-enrich` fires successfully twice a day, and its Phase 3 processes about 44 entities per run. | D1 queries Q4 and Q5 (§9) | Data-Identity Lead → input to **MA-OCT-006** |
| F5 | High | **The pipeline health-check LaunchAgent is dead.** `com.meridianatlas.health-check` (last exit 78) has written nothing since **2026-08-22 17:15Z**. It alerts only when it runs, so the silence produced no alert. `com.meridianatlas.financialfact-backfill` (exit 78) has also been silent since 2026-08-23, with its cursor stuck at `financialfact_backfill_offset=2605` since 2026-08-06. | `launchctl list`, `13F Seed/*log*` | Operations Lead |
| F6 | Medium | **Local `wrangler d1` calls fail intermittently** with Cloudflare API code 10000. `firds-weekly-seed` errored on its first D1 call on 3 of its last 6 runs (1, 6 and 20 Sep). `entities-enrich-boost`'s **evening** run failed its headroom check every day from 18 to 23 Sep, while the morning run succeeded. The pattern suggests wrangler's OAuth session is expiring under launchd, but this is **not diagnosed**. | `App/Corporate Atlas/logs/*.log` | Operations Lead |
| F7 | Medium | **The enrich-boost write guard is blind six days a week.** Its headroom check reads `writes_today_<date>`, which only holdings writes (on Sundays). On other days the key is absent, so the job reads 0 and `headroom=100000` whatever the real usage is. | boost log and D1 key list | Operations Lead |
| F8 | Medium | **`MA-OCT-001` ID collision.** `sprintboarditems` already has `MA-OCT-001` = "Data Quality Exception Management tool" (IDEA, Entities, updated 2026-08-29). The tracked root file `MA-OCT-001_Spec.md` (commit `0f38627`) is that same August item. Register v3 reuses the ID for "Ops backend foundation". | Q8 (§9) | Program Orchestrator: rename one before any board write |
| F9 | Low | **Cron slots are 5 of 5**, and one is used by `meridian-bootstrap`. Bootstrap's `status=complete` has been set since 2026-06-11, but it still fires every 4h (`last_run` 2026-09-23T20:00:17Z). It is a Kit v2 "default-to-off where purpose is finite" candidate, and freeing it would give October one cron slot. | D1 `edgar_bootstrap_state` | ETF Product Lead + Architect |
| F10 | Low | **The `meridian-entities-delta` GLEIF delta has never run.** Its cron is held, and `delta_last_run` is absent from state. | D1, invocations | Data-Identity Lead (MA-OCT-006) |

---

## 2. Part 0: governing docs brought into the baseline

Copied with `cp -n` from `~/Downloads/`. The Downloads copies are untouched. Source and destination checksums match.

| File (`claude/`) | SHA-256 |
|---|---|
| `meridian-october-operating-kit-v2.md` | `46629dc5f9906399aa4330bae301a633065146cc20043e0a12a27ade75270795` |
| `meridian-october-revised-scope-v2.md` | `967bebd7c1762a0389d150d96a04ae08c4f0df0cdaf127328f0f4a88e1f33445` |
| `MA-OCT-004-Bond-Spec.md` | `90531b573b8df4466c54c3a0a494350aa5e05b961082dc23bcca7df4afdc2a2a` |
| `MA-OCT-000_Build_Brief.md` (as received) | `770885cf03d5afd0d148176bf774025a16d65add7eb287a4d7b446e04b2d9abe` |
| `Meridian_October_Operating_Kit_v3_Addendum.md` (as received) | `a3f2a80de5951cb11b5d742fa09d4f4c067baf0363664c8974991a5c05974d4e` |

The August kits in `~/Downloads` (`Sept-Operating-Kit`, `Sept-Operating-Kit.md`) were not copied or used.

## 3. Part A: baseline confirmation

**Preconditions:** all three passed. The working directory is the baseline root, the branch is `September-2026`, and the brief and addendum are both present.

```text
$ pwd
/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
$ git status --short --branch   (first line)
## September-2026...origin/September-2026
$ git remote -v
origin  https://github.com/navinmv81/meridian-atlas.git (fetch)
origin  https://github.com/navinmv81/meridian-atlas.git (push)
$ git fetch && git rev-parse HEAD origin/September-2026
420487d13e3b2bcb97d0b6c4bf2cb7b98c7bfc48
420487d13e3b2bcb97d0b6c4bf2cb7b98c7bfc48
$ git merge-base --is-ancestor 472d7bf HEAD && echo OK-017   → OK-017
$ git merge-base --is-ancestor 821a48f HEAD && echo OK-013   → OK-013
```

### 3.1 Duplicate-file register

The scan covered every `*.js`, `*.mjs` and `wrangler*.toml` under `App/` plus the 11 front-end files, run with `find` across the baseline root. It excluded `.git` and `node_modules`.

| File | Copies (SHA-256, first 12 characters) | Authoritative | Note |
|---|---|---|---|
| 11 front-end files (`index.html`, `ma-*.js`) | `App/<f>` and `docs/<f>`, **byte-identical for all 11** | `App/` | `docs/` is the generated deploy mirror (`generate-docs.mjs`), not a source copy |
| `gleif-seed.js` | `App/Corporate Atlas/gleif-seed.js` `f2d49f2a1d27` (tracked) vs `13F Seed/gleif-seed.js` `17afea932e31` (**untracked**) | `App/Corporate Atlas/` copy | The two differ. The `13F Seed/` copy still holds a token literal (F1). Standing rule: leave it untouched. |
| `MA-SEP-010_Change_Request.md` | root (untracked) and `claude/` (tracked), byte-identical | `claude/` | Doc, not code; listed for completeness |
| `Meridian_Atlas_Current_State_v13.docx` | root (Sep 22, 30,256 B) vs `Claude outputs/` (Sep 19, 29,174 B), **different** | Root copy is newer | Both untracked; doc, not code |

No other duplicates. There are no root-level copies of application code.

### 3.2 Untracked-file register (none committed, moved or deleted)

| Path | In brief's known list? | Note |
|---|---|---|
| `13F Seed/gleif-seed.js` | Yes | Standing rule: untouched. **Contains a token literal (F1).** |
| `claude/MA-SEP-014_Build_Brief.md`, `claude/MA-SEP-014_Spec.md`, `claude/MA-SEP-015a_Spec.md`, `claude/MA-SEP-015b_Build_Brief.md` | Yes | — |
| `claude/September_Sprint_Testing_Runbook.md` | Yes | — |
| `~$ridian_Atlas_Current_State_v13.docx` | Yes | Word lock file (162 B) |
| `MA-OCT-001_Spec.md` (root) | Yes, **but the brief is wrong about it** | **Tracked**, not untracked (commit `0f38627`). Left in place per Addendum §5. See F8. |
| `Claude outputs/Meridian_Atlas_Current_State_v13.docx` | **No, not in the brief** | Older copy of v13 |
| `Claude outputs/Meridian_Atlas_September_Sprint_LinkedIn_Post.md` | **No** | — |
| `MA-SEP-010_Change_Request.md` (root) | **No** | Duplicate of the tracked `claude/` copy |
| `Meridian_Atlas_Current_State_v13.docx` (root) | **No** | Newest v13 |
| `claude/October_Decisions_Log.md` | No (Program Orchestrator file) | Not in this packet's commit list, so it stays untracked |
| `claude/MA-OCT-000_Build_Brief.md`, `claude/Meridian_October_Operating_Kit_v3_Addendum.md`, the three Part 0 copies | — | These are **in** this packet's commit scope |

### 3.3 CLAUDE.md Environment Truth: stale lines found and corrected

| Line | Was | Now |
|---|---|---|
| LOCAL_MASTER absolute path | "inferred, not independently re-verified" | **Verified** (`pwd`, branch, remote, HEAD) |
| DEPLOY_BRANCH | `corporate-atlas-v4-deploy-clean` + manual copy step | `September-2026` `/docs`. The rollback source and the Jekyll incident are recorded. |
| `September-2026` bullet | "has still NOT been made the GitHub Pages source" | Marked superseded |
| LOCAL_MASTER folder | "manual copy-over… live site reflects this folder" | Annotated: served directly from `/docs` |
| Frontend structure | "Flattening happens during the manual copy-to-deploy step" | Flattening is done by `generate-docs.mjs`; parity verified |
| Live credential file | (no scope info) | The token lacks Workers read scope. Wrangler OAuth is what local jobs use. |
| `gleif-seed.js` bullet | "leave untouched" | The security note (F1) is added |
| *(new)* | — | CF cron day-of-week numbering (F2) and cron capacity 5/5 (F9) |

Left unchanged, because both are outside the two sections the brief allows:
- The Non-Negotiable Rules cron note ("5/5 as of 2026-08-17"). It is still true.
- The file header "Last updated" line.

Branch, backend source locations, D1 name and `App/` structure were confirmed as still accurate.

## 4. Part B: September carry-overs

| Item | Result | Evidence |
|---|---|---|
| **MA-SEP-013 Step 5** (Pages → `September-2026` `/docs`) | **Confirmed** | `gh` is not installed, and the unauthenticated Pages API returns 404, so this used the fallback. All 11 files at `https://navinmv81.github.io/meridian-atlas/` match `docs/` byte for byte. `ma-entities.js` tells the two sources apart: live = `688d16887a09` = `docs/`, while `corporate-atlas-v4-deploy-clean` = `db9beb66b502`. `/.nojekyll` is served (HTTP 200, 0 B). Live `last-modified: Sat, 19 Sep 2026 08:38:06 GMT`. Pages settings were not touched. |
| **Jekyll incident** (`git show 420487d`) | Recorded | After the Pages source flip, the live site served the stale root `README.md` instead of `docs/index.html`. Pages ran its default Jekyll build over `/docs`, a flat static SPA export that was never meant for Jekyll. Fix: an empty `.nojekyll` in `docs/` (the served folder) and at the repo root. `generate-docs.mjs` neither creates nor removes it. |
| **MA-SEP-013 Step 6** (CLAUDE.md DEPLOY_BRANCH) | **Done** in this packet | §11 diff |
| **MA-SEP-013 Step 7** | Not in scope | Program Orchestrator |
| **MA-SEP-017 residual** (`entity_master` `updated_at` / `created_at` for 14 and 21 Sep) | **Not confirmed. Needs an Architect/Founder decision.** | `entity_master` has **no index on `updated_at` or `created_at`**. The plan was `SCAN entity_master` (Q9), and the architecture constraint says a SCAN on `entity_master` means stop. A single pass would cost about 44k reads: under step 7's 50k threshold and within the budget (running total 160k), but the constraint forbids it, so it was not run. **Also, the dates are wrong:** per F2, `seedIssuerEntities` runs on **Sundays** (13 and 20 Sep), not Mondays. Indirect corroboration: a `pending` queue row was created 2026-09-20 04:00:50, which shows the Sunday seed inserting. **Decision needed:** authorise one ~44k-read SCAN for the Sunday dates, or defer to MA-OCT-006. |
| **Known Issue 22.1** (`/run` and cron history, `entities-seed` and `holdings`) | **Evidence gathered; Founder dashboard check (0.4) still open** | Table in §6. Every Sunday since at least 30 Aug, both Workers fired at 04:00 in the same second. Both were cron-only, with no `/run` calls, except that holdings had 5 invocations on 30 Aug (1 cron + 4 fetch, the day of the Known Issue 22.12 redeploy). The dashboard's "Sunday 04:00" load is two Workers, not one. |

## 5. Part C: runtime truth inventory

### 5.1 Intended state (source)

There are 12 `wrangler*.toml` files. All are under `App/`, and there are none at the root or in `13F Seed/`. Every one binds D1 `meridian-etf`. **No service bindings or custom routes exist in any config.** All are `workers.dev`.

| Worker | Config | Crons (intended) | Vars / other |
|---|---|---|---|
| meridian-holdings | `App/ETF Refresh/wrangler-holdings.toml` | `0 4 * * sun` | — |
| meridian-entities-seed | `App/Corporate Atlas/wrangler-entities-seed.toml` | `0 4 * * 1` (commented "Monday"; see F2) | — |
| meridian-entities-enrich | `App/Corporate Atlas/wrangler-entities-enrich.toml` | `0 6 * * *`, `50 6 * * *` | secret `RUN_AUTH_SECRET` (not in file) |
| meridian-bootstrap | `App/ETF Refresh/wrangler-bootstrap.toml` | `0 */4 * * *` | — |
| meridian-entities-delta | `App/Corporate Atlas/wrangler-entities-delta.toml` | none (HOLD `0 3 1 * *` commented) | — |
| meridian-firds | `App/Corporate Atlas/wrangler-firds.toml` | none (HOLD `0 5 * * 0` commented; **RETIRED**) | KV `FIRDS_PROGRESS` (deleted) |
| meridian-entities-figi | `App/Corporate Atlas/wrangler-entities-figi.toml` | none (by design) | secret `OPENFIGI_API_KEY` |
| meridian-entities-api | `App/Corporate Atlas/wrangler-entities-api.toml` | none | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` |
| meridian-ops | `App/Ops/wrangler-ops.toml` | none (by design) | `CF_ACCOUNT_TAG`; secret `CF_ANALYTICS_TOKEN` |
| meridian-proxy | `App/ETF Refresh/wrangler.toml` | none | — |
| meridian-13f | `App/ETF Refresh/wrangler-13f.toml` | none | — |
| meridian-filings | `App/ETF Refresh/wrangler-filings.toml` | none | — |

### 5.2 Effective state (Cloudflare)

- **The `13F Seed/.env` token has insufficient scope.** `user/tokens/verify` gave `success=true, status=active`. `GET accounts/{id}/workers/scripts` gave `success=true` with **0 results**, and `GET …/workers/scripts/meridian-holdings/schedules` gave **"No access to the specified resource"**. **Missing scope: Account → Workers Scripts → Read.**
- **Fallback used:** `wrangler deployments status --name <worker>` via the `wrangler` CLI's own OAuth login (scopes include `workers_scripts (write)` and `d1 (write)`; read-only commands only). Effective schedules came from **observed invocations** through `meridian-ops`'s read-only route `/api/ops/cf/invocations`, which queries Cloudflare GraphQL Analytics with its own token.
- **Remaining gap:** wrangler has no read-only "list all scripts" or "list schedules" command, so (a) the orphan check covers the 12 known names only, and (b) `meridian-ops`'s allowlist excludes bootstrap, proxy, 13f and filings (bootstrap was corroborated from its D1 state instead).

| Worker | Deployed? | Version | Deployed at (UTC) |
|---|---|---|---|
| meridian-entities-api | Yes | `0f475f4c` | 2026-09-09 08:07 |
| meridian-entities-seed | Yes | `ab62dc15` | 2026-09-09 09:51 |
| meridian-entities-enrich | Yes | `23fd2660` | 2026-09-03 16:59 |
| meridian-entities-delta | Yes | `7d316b5e` | 2026-08-16 18:35 |
| meridian-entities-figi | Yes | `ae7fd10d` | 2026-08-16 18:35 |
| meridian-ops | Yes | `589ae24c` | 2026-08-04 07:31 (Secret Change) |
| meridian-13f | Yes | `c93145c9` | 2026-08-12 06:20 |
| meridian-filings | Yes | `24068fab` | 2026-08-09 18:04 |
| meridian-bootstrap | Yes | `4cdf40f3` | 2026-06-14 08:36 |
| meridian-proxy | Yes | `c95aa7b9` | 2026-08-09 17:18 |
| meridian-holdings | Yes | `93ab6411` | 2026-08-30 14:14 |
| meridian-firds | **No.** CF code 10007 "This Worker does not exist" | — | Retired 2026-08-22 (expected) |

**Source → deployed:** 11 of 12 configs are deployed. `meridian-firds` is not deployed, which is expected. **Deployed → source:** all 11 have source. **No orphans among the probed names**, but the account-wide list is unverified (gap).

### 5.3 Local schedules (LaunchAgents)

| Label | Program | Interval | Loaded | Last exit | Pause state | Logs |
|---|---|---|---|---|---|---|
| `com.meridianatlas.firds-weekly-seed` | `App/Corporate Atlas/firds-local-seed.mjs` | Sun 11:00 local | Yes | 0 | `.firds-seed-paused` absent (active) | `App/Corporate Atlas/logs/firds-seed*.log` |
| `com.meridianatlas.entities-enrich-boost` | `App/Corporate Atlas/entities-enrich-boost-run.mjs` | 11:50 and 17:50 local daily | Yes | 1 | `.entities-enrich-boost-paused` absent (active) | `App/Corporate Atlas/logs/entities-enrich-boost*.log` |
| `com.meridianatlas.financialfact-backfill` | `13F Seed/seed-financialfact.js --auto` (self-unloads on completion) | 09:00 local daily | Yes | **78** | — | `13F Seed/backfill-log.txt`, `launchd-std*.log` (all last written 2026-08-23) |
| `com.meridianatlas.health-check` | `13F Seed/check-pipeline-health.js` | 18:00 local daily | Yes | **78** | — | `13F Seed/health-check-log.txt` (last run 2026-08-22) |

All four plists set an explicit `PATH`, per the CLAUDE.md launchd note.

### 5.4 Manual and on-request writers

There are 31 manual scripts, each listed with the tables it writes in the Job Manifest. On-request HTTP writers:
- `/run` on seed, enrich, delta, figi and holdings
- `/rematch` on figi
- `/trigger` on bootstrap (**unauthenticated**)
- `/exceptions` on entities-api (Access-protected)
- `meridian-ops` POST routes

There are no `*.command` files in the baseline. Notable manual writers:
- `13F Seed/debug-d1-raw-shape.js` has write statements against `holding13f_normalized`, despite being a "debug" script.
- `13F Seed/seed-entity-cik.js` writes the Entities table `entity_master` from the 13F folder.

### 5.5 Controls

- **Global kill switch:** `hold_all_jobs = false` (unchanged since 2026-08-02 07:43). It is checked by holdings, seed, enrich, delta, figi, the financialfact backfill and health-check. It is **not** checked by bootstrap.
- **Guards and cursors** are per job in the manifest. Examples: holdings `DAILY_WRITE_LIMIT=80,000`; seed 65,000 headroom; enrich 5,000; figi 10,000; holdings `etf_offset=31`; bootstrap `cik_offset=11858` of 11,858; financialfact offset 2605.

### 5.6 Cron capacity

**5 of 5 in use** (Free-plan cap is 5 per account): holdings 1, entities-seed 1, entities-enrich 2, bootstrap 1. Every one was observed firing. There is no free slot.

### 5.7 D1 budget snapshot (2026-09-23 UTC, at about 21:00Z)

| Metric | Value | Cap |
|---|---|---|
| Rows read today | 95,474 (317 queries). This packet's reads are split across the UTC day boundary. | 5,000,000 |
| Rows written today | 380 (190 queries), 0.4% of cap | 100,000 |
| Storage | 447 MB, 33 tables | 5 GB |
| `writes_today_*` counters | Only Sundays are recorded: `2026-09-13` = 54,657; `2026-09-20` = 83,638. There is **no counter for any weekday** (see F7). | — |

Sources: `meridian-ops` `/api/ops/cf/d1-today` and `wrangler d1 info meridian-etf`.

## 6. Cron invocation evidence (Known Issue 22.1 and drift)

| Date | Day | entities-seed (cron) | holdings (cron / all triggers) | enrich (cron / all triggers) |
|---|---|---|---|---|
| 08-30 | Sun | 04:00:36 ✓ | 04:00:36 ✓ / 5 | 2 / 2 |
| 08-31 | Mon | — | — | 2 / 3 |
| 09-06 | Sun | 04:00:29 ✓ | 04:00:29 ✓ / 1 | 2 / 3 |
| 09-07 | Mon | — | — | — |
| 09-13 | Sun | 04:00:23 ✓ | 04:00:23 ✓ / 1 | 2 / 13 |
| 09-14 | Mon | — | — | 2 |
| 09-20 | Sun | 04:00:14 ✓ | 04:00:14 ✓ / 1 | 2 / 3 |
| 09-21 | Mon | — | — | 2 / 2 |
| 09-22 → 09-23 | Tue–Wed | — | — | 2 each; one duplicate `clientDisconnected` on 09-16 |

`entities-delta`, `-figi`, `-api` and `meridian-ops` had zero cron invocations from 14 to 23 Sep, as intended.

## 7. Part D: GLEIF job-state snapshot (input to MA-OCT-006)

| Job | Intended | Effective | Hold | Cursor / state | Last success |
|---|---|---|---|---|---|
| entities-seed | Mon 04:00 (intent) | **Sun 04:00** (F2) | `hold_all_jobs=false` | none | 2026-09-20 04:00:14Z |
| entities-enrich | 06:00 + 06:50 daily | same | false | `enrich_phase3_last_run_entities=44`, deferred 1, subrequests 44 | 2026-09-23 06:50Z (cron) / 10:59Z (boost) |
| entities-delta | none (held) | none | false | `delta_last_run` **absent (never ran)** | never |
| entities-figi | on-request | on-request | false | — | not assessed |
| firds-weekly-seed (local) | Sun 11:00 local | Sun about 10:00Z | pause flag absent | — | 2026-09-13 (failed 09-20) |
| entities-enrich-boost (local) | 11:50 and 17:50 local | morning OK, evening failing | pause flag absent | — | 2026-09-23 10:59Z |

**`entity_enrichment_queue` (28,929 rows)**, aggregate counts only. The schema has **no `retry_count` or `failure_reason` column**, so those two cuts are not possible. `retry_after` and `lookup_method` were used instead.

| status | lookup_method | age (from `created_at`) | last attempt | n |
|---|---|---|---|---|
| pending | name_search | 30–90d | never | 25,257 |
| pending | name_search | >90d | never | 771 |
| pending | name_search | 7–30d | never | 344 |
| pending | isin | >90d | never | 164 |
| pending | name_search | <7d | never | 1 |
| complete | isin | >90d | >30d (latest 2026-06-17) | 1,170 |
| failed | isin | >90d | >30d (latest 2026-08-02) | 911 |
| failed | isin | >90d | 7–30d (latest 2026-08-31) | 2 |
| failed | name_search | >90d | >30d | 43 |
| failed | (null) | >90d | >30d | 264 |
| in_progress | name_search | >90d | 2026-06-11 (stuck) | 1 |

`failed` rows by retry state: 956 due, 264 with `retry_after` in the future.

**`entity_master`:** 43,785 rows in total. **16,557 have an LEI (37.8%) and 27,228 do not.** `sqlite_sequence` max `entity_id` is 437,274, which reflects historic merges and deletes.

## 8. Part E, step 24: October ID collision check against `sprintboarditems` (read-only, no writes)

| ID | In D1? | Result |
|---|---|---|
| MA-OCT-000 | No | Free |
| **MA-OCT-001** | **Yes**: "Data Quality Exception Management tool", IDEA / ACTIVE, Entities, Entities Product Lead, updated 2026-08-29 | **Collision (F8)** |
| MA-OCT-002 to 011 | No | Free. The backlog rows "OCT-002/003" in Addendum §5 exist in the Sprint Board **mirror only**, not in D1. |

Also noted: MA-SEP-013, -016 and -017 are **absent** from D1 `sprintboarditems`. MA-AUG-003 and -004 are still at `PRODUCT_SPEC/ACTIVE` (a known hygiene gap).

## 9. D1 query ledger (every query had `EXPLAIN QUERY PLAN` run first; all via `wrangler d1 execute meridian-etf --remote`)

| # | Query (abridged) | Plan | rows_read | rows_written |
|---|---|---|---|---|
| Q1 | `sqlite_master` schemas and indexes for 4 tables | (catalog) | 119 | 0 |
| Q2 | `holdings_pipeline_state` control keys + `writes_today_>=2026-09-13` | SCAN holdings_pipeline_state (small table, 59 rows) | 59 | 0 |
| Q3 | *EXPLAIN-only batch (5 plans)* | — | 0 | 0 |
| Q4 | queue `GROUP BY status, retry_state` | SCAN USING COVERING INDEX idx_enrich_queue_status | 57,861 | 0 |
| Q5 | queue `GROUP BY status, lookup_method, age, last_attempt` | SCAN USING INDEX idx_enrich_queue_status (queue is not on the large-table list) | 57,856 | 0 |
| Q6a | `COUNT(*) entity_master WHERE lei IS NOT NULL` | SEARCH USING COVERING INDEX idx_entity_master_phase3 (lei>?) | 16,557 | 0 |
| Q6b | `COUNT(*) entity_master WHERE lei IS NULL` | SEARCH USING COVERING INDEX idx_entity_master_lei (lei=?) | 27,229 | 0 |
| Q6c | `sqlite_sequence` for entity_master | (catalog) | 13 | 0 |
| Q7 | `sprintboarditems` `ticket_id` range `MA-OCT-*` | SEARCH USING INDEX sqlite_autoindex (PK range) | 2 | 0 |
| Q7b | `sprintboarditems` `ticket_id IN (…)` | SEARCH (PK =) | 7 | 0 |
| Q8 | `sqlite_master` bootstrap tables | (catalog) | 119 | 0 |
| Q8b | `edgar_bootstrap_state` all keys | SCAN (7 rows) | 7 | 0 |
| Q9 | `entity_master GROUP BY date(updated_at)` (MA-SEP-017) | **SCAN entity_master** | **not run** (constraint) | — |
| | **Total** | | **159,829** | **0** |

Under the 250k budget, with zero writes. Cloudflare Analytics (GraphQL) calls through `meridian-ops` read no D1 rows. That route is read-only, so it wrote nothing.

## 10. Drift and orphans

- **Drift:**
  - entities-seed has semantic drift (F2).
  - enrich-boost's evening run and the two 13F Seed LaunchAgents are failing (F5, F6).
  - No expression drift in holdings, enrich or bootstrap.
- **Orphans, deployed with no source:** none among the 12 probed names. The full list is unverified (token scope).
- **Source never or no longer deployed:** `meridian-firds`, which is retired as expected.
- **Other gaps:**
  - The `.env` token lacks Workers Scripts read.
  - `gh` CLI is not installed.
  - `meridian-ops` invocations allowlist omits 4 Workers.
  - The queue has no retry/failure-reason columns.
  - The MA-SEP-017 query was blocked by the SCAN rule.

## 11. CLAUDE.md diff

Shown to the Founder in session before commit. Captured with `git diff CLAUDE.md` at commit time; the edited sections are Environment Truth and Current Sprint Packet only.

## 12. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Part 0 done, checksums recorded | ✅ §2 |
| 2 | Every `wrangler*.toml` matched or flagged "not deployed" | ✅ §5.2 (firds flagged) |
| 3 | Every deployed Worker matched or flagged "orphan" | ✅ for all probed. ⚠️ Account-wide list not possible (token scope; named gap). |
| 4 | Every job has intended, effective, drift, mode, domain and owner | ✅ Manifest (47 jobs). ⚠️ Effective schedule for proxy, 13f and filings is "not observable; no cron in source". |
| 5 | Every LaunchAgent and manual/on-request writer listed with tables | ✅ §5.3, §5.4, Manifest |
| 6 | Cron count vs the cap of 5 | ✅ 5/5 |
| 7 | GLEIF snapshot complete or gaps named | ✅ §7. Gaps: no retry/failure columns; figi last run not assessed. |
| 8 | Part B results: confirmed / not confirmed / needs Founder | ✅ §4 |
| 9 | Duplicate and untracked registers | ✅ §3.1, §3.2 |
| 10 | CLAUDE.md updated, diff shown | ✅ Updated. Diff shown in session. Uncommitted by Founder decision; hash in `MA-OCT-000_Review_Checksums.txt`. |
| 11 | Branch CR drafted | ✅ `claude/MA-OCT-000_Change_Request_October_Branch.md` |
| 12 | D1 reads < 250k, zero writes | ✅ 159,829 / 0 |

## 13. Commit evidence: replaced by review checksums (Founder decision, 2026-09-24)

**Nothing is committed, staged or pushed.** On 2026-09-24 the Founder decided not to commit or push. The commit and its target branch are deferred to pre-go-live.

- `HEAD` = `origin/September-2026` = `420487d` still holds, because no commit was made.
- The commit-SHA evidence item is replaced by **`claude/MA-OCT-000_Review_Checksums.txt`**. That file has a SHA-256 for each of the 10 in-scope files as they stand for review, plus a timestamp and the `git status --short` output.
- **The Architect should review against those hashes.** If any file changes before the deferred commit, its hash will no longer match, and that shows up immediately.
- The checksum file itself is an 11th, untracked file. It is not one of the 10.

## 14. Review request (Architect)

Please return the Addendum §3 reviewer block:

```text
REVIEWER:     Architect
PACKET:       MA-OCT-000
VERDICT:      PASS | PASS WITH NOTES | RETURN
EVIDENCE CHECKED: [list]
FINDINGS:     [numbered]
REQUIRED BEFORE APPROVAL: [numbered, or "none"]
```

Specific asks:
1. Accept the observed-invocation method (via `meridian-ops` analytics) in place of the CF schedules API, or require a Workers-Read token re-run.
2. Decide on the MA-SEP-017 SCAN: authorise about 44k reads on the Sunday dates, or defer to MA-OCT-006.
3. Review the release-path recommendation (Option A) in the October branch CR.
4. Confirm F2 routing (a cron fix packet with the three-point check) and F1 escalation to the Founder.
