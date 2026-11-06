# MA-OCT-SAT31.ENG4 — Report

> ## **005 live — `1109edb6-0ad7-448e-a67f-57a2ae123594`** (deployed 21:23:31Z Fri 30, declared 22:01Z)
> - **Rollback:** `e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be` (004).
> - **Commit:** `ca15f70`.
> - **Change closed.** Run on Fri 30 under **ML-1030-5**.
> - The console page shows "arrives with the 2 Nov release" until the site release ships the new `ma-ops.js`.

```text
CONTROL:  claude/packets/MA-OCT-SAT31.ENG4_Control_v1.md  8519a8cb4c564bceffcd798bc12894c1e033043c0ede2264bd2bb4e1a9f5f3f5 (= STATUS_BOARD row 89)
TASK:     claude/packets/MA-OCT-SAT31.ENG4_Task_v1.md     4f3ede52e8af5afb7f91e7b207b26253e95dc96afe151ab4d1deb9e6dc895907 (= Control)
GOVERNING (re-hashed ✔):
          005 spec rev 0 e5fffec6…e6de6; Ops review 39b707ff…c496c; 005.BUILD report b165d238…9e40;
          004.GOLIVE report e280d367…a20e; FREEZES.json 5b3400c0…6791
```

## Report log (UTC)

| Time | Event |
|---|---|
| Fri 21:16 | Session opened. No locks, branch `October-2026`. All hashes verified. |
| Fri 21:17 | The 005 worktree was moved onto `origin/October-2026` `058c389` (004 `df4066c` + 009/010). The 005 files were restored from scratch (hashes = BUILD report) and the 005 `ops-api.js` hunks applied. |
| Fri 21:18 | `dq_since` fix + test. All suites green. |
| Fri 21:19 | Commit **`ca15f70`**, pushed. |
| Fri 21:21 | **ML-1030-5** (Main Lane, verified in the Decisions Log): SAT31 lanes may run tonight, with production ending by 23:45Z. The Founder relayed it in chat. Waited on SAT31.ENG8's open change (R-4 21:20:25Z, gate open 21:21:42Z). |
| Fri 21:22 | Pre-flight: wrangler 4.96.0, `whoami` (workers_scripts + d1 write), FREEZES `5b3400c0…` unchanged. Worktree clean at `ca15f70` = origin tip. Dry-run bundle OK (135.22 KiB). |
| Fri 21:23 | SAT31.ENG8 report shows close-out (both changes done, smoke done, "bonds live"), so no open change. |
| **Fri 21:23** | **starting MA-OCT-005 deploy** (`meridian-ops`, from `ca15f70`). **Rollback = `e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be`** (live 100%, "MA-OCT-004 go-live (DQ ticketing, df4066c)"). |
| Fri 21:23:31 | **Deployed `1109edb6-0ad7-448e-a67f-57a2ae123594`** ("MA-OCT-005 console shell + dq_since fix (ca15f70)"), 100%. |
| Fri 21:24 | Anonymous smoke and public-route regression passed (§3). |
| Fri 22:00:06 | Scheduled health-check sweep on the new code: `dq_since` correct (§3). |
| Fri 22:01 | `d1-today` after. **005 live — `1109edb6`.** Change closed. |

## 1. Step 1: rebase, fix, tests, commit

**Rebase:**
- Since 004 is committed on origin (`df4066c`), the four keep-both hunks predicted in the 005 build report collapsed to one: the `console-page.js` import beside deploy 4's `sweep-ext.js` import.
- `ma-ops.js` and `ma-data.js` are unchanged upstream since `acfd069`, so they are copied exactly: `f26862a0…`, `a28396cb…`.
- 010's `index.html` change does not overlap, because 005 does not touch `index.html`.
- Global-name collision check across all `App/*.js` (including 010's new `ma-entities.js` names): 0 collisions.

**`dq_since` fix (004.GOLIVE §7 item 2):**
- **The change:** `sweep()` now takes the previous health-check run's `started_at` from **either** phase. An `end` row carries the same `started_at`, and a `start` can arrive late through the runner's outbox; live case: Fri 30 08:00Z start received 12:00:06Z.
- **The test:** a new `sweep-contract.mjs` case, where the previous run has only its `end` row. **It fails on the old code** (`dq_since` stays 08:00:01Z, `dq_new` 1) and passes on the fix (`dq_since` 10:00:02Z, `dq_new` 0).
- **Reads:** unchanged, because the rows are the ones L2 already returns.

**Suites on the committed tree:**

| Suite | Result |
|---|---|
| `ops-console` | 58 |
| `console-shell` | 12 (endpoints **15/15**) |
| `sweep-contract` | 27 |
| `sweep-ext-contract` | 34 |
| `dq-contract` | 68 |
| `dq-page` | 19 |
| `dq-seeds` | 32 |
| `cases-contract` | 66 |
| `health-check` | 18 |
| `migration-m1` | 29 |
| `control-split` | 100 |
| `lateness` | 42 |
| `admin-jobs-lateness` | 13 |
| `boost-heartbeat-resilience` | exit 0 |
| `nav-007-frontend`, `nav-007-key`, `nav-007-worker` | exit 0 |
| `fi-009-worker`, `fi-010-frontend` | exit 0 |
| `fi-009-explain` | 14 |
| `ingest-contract` | exit 2 (live-only, as on untouched origin) |

**Commit `ca15f70`** (explicit paths, 7 files; `pull --rebase` was up to date) → pushed `058c389..ca15f70`.

| File | SHA-256 |
|---|---|
| `App/ma-ops.js` | `f26862a0bf4b2d43eb8a7d7b84c62b2f15c204d11c631b9ffa0759196a0d1ba6` |
| `App/ma-data.js` | `a28396cb88edf15bcffb5378d98b515bbdd4b029890687d9a163e880359fad9f` |
| `App/Ops/src/console-page.js` | `b412169c638f9a31385b901b58b0336443325b547837ca87e46b22089a43e7a5` |
| `App/Ops/src/ops-api.js` | `b11cf5536ec430dd04fb45cdb3cd0999aca33fb1193094f3946b82c3ac515e1e` |
| `App/Ops/tests/sweep-contract.mjs` | `10b50120a18d8707b43f813b82a26d6e0e097a55812fe151ae3f8ad699b950da` |
| `App/Ops/tests/ops-console.test.mjs` | `a7589d02…`, as built |
| `App/Ops/tests/console-shell.mjs` | `5298fbf4…`, as built |

## 3. Steps 2–3: done (Fri 30, ML-1030-5)

**Before the deploy:**
- The other lane's report was checked: SAT31.ENG8 opened R-4 at 21:20:25Z and the gate at 21:21:42Z, and its close-out (smoke done, "bonds live") was on disk at 21:23Z.
- The deploy then ran alone in its slot, clear of the 22:00Z sweep and the 23:50Z freeze.
- A dry-run bundle preceded it.

**Smoke:**

| Check | Result |
|---|---|
| `GET /api/ops/admin/console` without a session | **302 → Access login**, no `Access-Control-Allow-Origin` ✔ (also POST: 302, no ACAO) |
| D-1 `GET /api/ops/admin/dq-tickets`, E-1 without a session | 302 → Access login, no ACAO ✔ (unchanged) |
| Public routes `cf/d1-today`, `budget-risk`, `openfigi-status` | 200 ✔ |
| Moved GET `/api/ops/sprint-board` (A6 rule 2) | 302 → `meridian-control` ✔ |
| `POST /api/ops/ingest/sweep` without a key | 401 ✔ |
| Service token → console 403 | **Proven in `console-shell.mjs`** (403 before D1 for ops-script and bond-runner). Not tried live: this lane does not handle token secrets (ML-1024-1). |
| Signed-in 200 page + CSP header | **Not run tonight**, because the Task prefers checks that need no sign-in. Exact CSP, nonces and boot script are proven in `console-shell.mjs` (12/12). The live signed-in check (page, CSP, 0 violations in Chrome/Safari) is part of the **Mon 2 UAT (AC-14)**. Until then the page shows "arrives with the 2 Nov release". |
| **Sweep after deploy** (22:00:06Z, run `659c70ba`) | **`dq_since` = `2026-10-30T18:00:04.640Z`**, exactly the previous run's (`c7cae1e6`) start, so the fix holds. **`dq_new` = 0**: DQ-000036 (opened 15:59:34Z) was counted once at 18:00Z and is now outside the window, as intended. `rows_read` 239. The response field set is identical to the 18:00Z (pre-deploy) sweep: deploy 4's `suppressed`, `auto_resolved`, `gleif_checks` and `s2_rows_read` are intact. |
| `d1-today` after (22:01Z) | rowsWritten 594 (0.6%), rowsRead 425,701, account-wide for all lanes today. **The 005 deploy itself: 0 D1 reads or writes.** |
| Live version | `1109edb6-0ad7-448e-a67f-57a2ae123594` 100% |

**Rollback:**
- **Primary:** `wrangler rollback e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be`. That removes the console route and the `dq_since` fix; 004's routes are unaffected.
- **Not needed for a front-end-only defect:** the shell degrades on its own ("arrives with the 2 Nov release").

**Carried items:**
- **Mon 2 site release + Founder UAT** (005 AC-1…AC-14), including live CSP in Chrome and Safari, keyboard use, and AC-11 measured reads.
- **DQ-000036** (004 go-live test ticket) is still open: dismiss via C-2, or from the console after Mon 2.
- **The `bond-runner` Client ID** is still a placeholder.

## 2. Steps 2–3: plan (as written before ML-1030-5)

**Avoid:** the freezes 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15 and 23:50–00:10, and ±2 min around the 00/04/08/12/16/20/22Z sweep slots.

**Before the deploy:**
- Pre-flight: wrangler 4.96.0 and `whoami`.
- Re-read FREEZES.
- Check the other Sat lane's report for an open change.
- Announce "starting MA-OCT-005 deploy <UTC>".
- Record the live version **`e8b81bf9` (rollback)**.

**Then one `meridian-ops` deploy from `ca15f70`, followed by the smoke:**
1. Anonymous `GET /api/ops/admin/console` → Access redirect, no CORS header.
2. A service-token 403 is proven in `console-shell.mjs`. A live check needs the token, which this lane does not read.
3. Signed-in 200 page with the CSP header → only if needed (Founder).
4. D-1 unchanged (anonymous redirect; signed-in only if needed).
5. The next sweep's logged response carries `dq_new`/`dq_since`, with `dq_since` = the previous run's start.
6. `d1-today`.

Then **"005 live — <version>"**. The console page shows "arrives with the 2 Nov release" until the site release.
