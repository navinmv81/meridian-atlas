# MA-OCT-005.BUILD — Report

```text
PACKET:      MA-OCT-005.BUILD — 005 Operator console — build (local), Option B
EXECUTED BY: Engineering Lead (LANE-4-ENG), Claude Code — Thu 29 Oct 2026, from 20:15Z
CONTROL:     claude/packets/MA-OCT-005.BUILD_Control_v1.md  145965126f44c4236358ab3d7c131bd8196c69113035439c205b19f46eb6632c  (matches STATUS_BOARD row 87)
TASK:        claude/packets/MA-OCT-005.BUILD_Task_v1.md     74af1d4b54baa5ea7f3afdde9ccd641a53f437d425eefc3d562d9d3b8f92d10a  (matches Control)
GOVERNING:   claude/MA-OCT-005_Spec.md rev 0 e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6 ✔
             claude/MA-OCT-005_Ops_Review.md   39b707ff7aab0a8ec4eb625f3bfe1b00c07aebfca2102705dccbc15bc24c496c ✔ (M-1…M-6 binding)
WORKTREE:    ~/MeridianAtlas-work/ma-oct-005/build-worktree — branched from the 004 build tree: acfd069 + the 004 working changes,
             copied file for file (tracked diff identical; 004 suites green there). ma-ops.js baseline = 721d093's f7332bb6… (M-2).
RESULT:      BUILT AND TESTED LOCALLY. 0 remote D1, 0 deploys, 0 commits, no production change, shared checkout untouched
             (only this report written there). meridian-ops endpoints: 15 of 15.
```

**Report log (one production change at a time):** no production change was started or made by this lane. No "starting <change>" announcement was needed.

---

## 1. What was built (Task items 1–2)

**005 delta** (on top of the inherited 004 changes, which the 004 go-live commits separately):

| File | Change | SHA-256 (worktree) | Lines |
|---|---|---|---|
| `App/ma-ops.js` | Cases + DQ Tickets tabs, drawer, forms, response map; the Health-poll gate; enrichment wording; tab ARIA; Board/Ledger read-only; no inline handlers | `f26862a0bf4b2d43eb8a7d7b84c62b2f15c204d11c631b9ffa0759196a0d1ba6` | 812 → 1,568 (+956 / −100 in diff) |
| `App/ma-data.js` | `data_opsAdmin` (the console transport, §4.4 + M-5) and `data_proxyGet` (the Health read, moved out of `openOps`'s inline `fetch`, §5.6) | `a28396cb88edf15bcffb5378d98b515bbdd4b029890687d9a163e880359fad9f` | +45 |
| `App/Ops/src/console-page.js` | **new**: the shell for `GET /api/ops/admin/console` (Option B), 0 D1 | `b412169c638f9a31385b901b58b0336443325b547837ca87e46b22089a43e7a5` | 63 |
| `App/Ops/src/ops-api.js` | +1 import, +3 router lines in `handleAdmin`, header count (15/15) | `19e422d6…cbb7` (includes the 004 changes) | 993 |
| `App/Ops/tests/ops-console.test.mjs` | **new**, 58 checks | `a7589d029c81b443ca0937db9c4aa51f9af57139c7eaacd5b11456ba7500aa04` | |
| `App/Ops/tests/console-shell.mjs` | **new**, 12 checks | `5298fbf444ed9ecac9899de86e039d21fa1c195513f6adc4b9098624b08666bf` | |

`App/index.html` and `generate-docs.mjs` are **unchanged** (see decision D-1).

**Views built (the never-cut core, Founder Q3):**

| View | What |
|---|---|
| **Cases** | E-1 list: status chips; severity as text ("Sev 2") plus colour; ref; type label; title; job; relative + absolute time; Overdue; owner; status; counts "on this page"; Load more on `next_cursor`. C-1 drawer: Summary, Job and run (`run_snapshot` as key–value), Linked DQ tickets, History ("first 200 events" note at 200, N-4). All 7 actions as inline forms with only the legal transitions shown. |
| **DQ Tickets** | D-1 list: object (and "merged into"), "Protected decision" badge. C-1 drawer: Problem; Members (≤ 200 a page, **Load more members** on `members_cursor`); Linked exception; History. Actions: Triage, Schedule fix, Assign, Comment, Set severity, Link exception, Resolve, Dismiss, Reopen. **Member status edits are in**, with `expected_member_status`. |
| **Console mode** | Opens on Cases; no close button; filters and the open ref are kept in the URL hash (Back works). |
| **Terminal** (github.io) | Cases and DQ show the launcher card "Operator console — sign-in required", which opens the console in a new tab (`rel="noopener"`) and makes no admin call. |

**Cut:**
- **Fleet** and **New case** are pre-cut (Ops review M-6; Founder Q3 cut order 1 and 2).
- The DQ list's "Members (count)" column (§5.3) is not shown: D-1 returns no member count, and 005 adds no query (spec §3). The drawer shows the count.

**Other fixes in scope:**
- **Board/Ledger:** the "Change stage" and "Record event" buttons and their `prompt()`/`alert()` functions are removed. Both tabs carry the footnote "Read-only. Changes are made by the Main Lane." (Founder Q2, AC-13.)
- **Enrichment wording** (ML-1026-1 / MON26 note): null counts, or an `enrichment_source` value, now render "Enrichment counts removed (ML-1025-3) — not shown since 26 Oct", never "0 enriched · 0 pending".

**Endpoint count: 15 of 15, 0 headroom.** Measured by `console-shell.mjs`: all 15 answer non-404, and unknown admin and public paths answer 404.

| Group | Endpoints |
|---|---|
| Public GETs (4) | `budget-risk`, `openfigi-status`, `cf/invocations`, `cf/d1-today` |
| Ingest (2) | `run-event`, `sweep` |
| Admin | `jobs` |
| 003 | E-1, E-2, C-1, C-2 |
| 004 | D-1, D-2, D-3 |
| 005 | **`GET /api/ops/admin/console`** |

The next `meridian-ops` route needs a Worker split, or the P2 fold of D-3 into the console (RQ-1, N-1). The Main Lane should record that 004 §8.1's "005 must not add Worker routes" is superseded by Founder Q1 (N-1).

---

## 2. The Ops review's MUST-FIX items

| # | Item | Done | Proof |
|---|---|---|---|
| **M-1** | CSP that works; no inline handlers; path-scoped scripts | Shell CSP (exact): `default-src 'none'; script-src https://navinmv81.github.io/meridian-atlas/ 'nonce-…'; style-src 'unsafe-inline'; connect-src 'self' https://meridian-control.navinmv1981.workers.dev https://meridian-proxy.navinmv1981.workers.dev; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. `style-src` has **no nonce**, so the 145+ inline `style=` attributes work. All 6 inline `onclick=` are removed: the 4 Refresh buttons use `data-ops-refresh` and a listener, and the 2 board/ledger buttons are deleted. The console emits only `data-opsc-*` attributes with delegated listeners. | `console-shell.mjs`: exact CSP string, both inline scripts nonce'd, no `on…=`; `ops-console.test.mjs` M-1 static check (no `on…=` emitted). **A live 0-violation check in Chrome, Safari and Firefox is still AC-14 at UAT** (§6). |
| **M-2** | Start from 721d093; keep the hidden-tab pause; null enrichment | Built on `f7332bb6…`. `_opsStartPoll`/`_opsStopPoll`/`visibilitychange` are kept, and enrichment wording is fixed (§1). | Tests: hidden document stops the poll; visible again → one refresh and restart; the enrichment line. |
| **M-3** | Console mode: Health polls only while active and visible | `_opsHealthWanted()` = visible **and** (terminal **or** the active tab is Health). The console opens on Cases with **no `/api/ops-health` read and no interval**; Health starts one read plus the poll; leaving Health stops it; becoming visible on an admin tab reads nothing. | 4 checks in `ops-console.test.mjs` (mutation-checked) |
| **M-4** | Forms match the server's required fields | (a) A note is required for comment, set severity, resolve, dismiss, reopen and schedule fix. (b) The role select is exactly `cases.js ROLES` (8, test-compared). The assignee is an email or `service:<name>`, and at least one of role or assignee is required. (c) `member_update` sends `expected_member_status` from the last read. (d) Protected reopen sends `founder_supersession: {reference, decided_at}` (ISO date). (e) A duplicate needs a ref of the same kind (`EXC-`/`DQ-`). | `[AC-4 / M-4]`, `[M-4b]`, `[M-4c]`, `[M-4d]` checks |
| **M-5** | Response map complete; signed-out ≠ offline | `data_opsAdmin` uses `redirect:'manual'`. `opaqueredirect`, any 3xx and 401 map to `signed_out`. A network failure maps to `network`; `TimeoutError` to `timeout`; an HTML or empty body to `non_json`. The map has 24 rows, including `replay`, `stale_expected_status`, `not_applied`, `csrf`, `dq_actions_arrive_with_ma_oct_004`, 500, HTML 5xx, `members_open`, `fix_not_scheduled`, `protected_decision`, 429 and 503. | `[§6.3 + M-5]` (24 rows) + 5 transport checks |
| **M-6** | Option C calendar; shell checks `OPS_CONSOLE_SUPPORTED` | `ma-ops.js` sets `window.OPS_CONSOLE_SUPPORTED = true`. The shell's boot script shows "The operator console arrives with the 2 Nov release…" and opens nothing when it is absent: until Mon 2, Pages still serves the September `ma-ops.js`. Fleet and New case are pre-cut. The run sheet (§6) puts the deploy alone in its slot and the UAT on Mon 2. | `console-shell.mjs` `[M-6]` (boot script run in a vm both ways) |

**Notes:**
- **N-2:** budget restated in §4.
- **N-3:** lists always use `limit=50`.
- **N-4:** "first 200 events" shown.
- **N-5:** confirm ticks guard force-resolve, protected reopen and member → Fixed. A Sev 1/Sev 2 hint appears on Set severity and Triage. The DQ tab answers through the map (`dq_actions_arrive…` → "DQ actions are not live yet") until 004 is live.
- **N-6:** service tokens get 403 on the console before D1 (tested).
- **N-7:** the shell loads only `ma-data.js` and `ma-ops.js`. `ma-ops.js` uses `var(--bg2, #0f1117)` and `var(--mono, monospace)` with fallbacks and defines `_escapeHtml` itself. `connect-src` lists every host the console views call.
- **N-8:** the per-query read watch is in §6.
- **RQ-4:** the "Acting as" select defaults to Founder and remembers only the operator's own choice (`ops_acting_role`).

---

## 3. Build decisions (for review)

| # | Decision | Why |
|---|---|---|
| **D-1** | **No file split.** The Cases + DQ console is the last section of `ma-ops.js` (1,568 lines against the spec's "≈ 1,500" split threshold). | A 12th front-end file would change `generate-docs.mjs`'s fixed 11-file list. Its own comment requires updating MA-SEP-013's CR and CLAUDE.md, an environment change that needs `/change-request`. It would also add a third script to the shell, where §4.2 names two. I tried the split, saw the rule, and reverted it. A later split is a CR-backed packet. |
| D-2 | **One code path:** the views call only `data_opsAdmin`. In the terminal, Cases and DQ render the launcher card before any call. | §4.4. Option A stays one constant away (`MA_OPS_CONSOLE`), but it is not built. |
| D-3 | **After a successful action** the drawer re-reads C-1 and the list reloads (E-1 or D-1). | §6.1 "refresh the list row in place"; the cost is in §4 |
| D-4 | **Signed out:** "Sign in again" reloads the console tab (Option B), and the form draft is kept in memory until then. | §6.3 (Option B) |
| D-5 | **Top-level globals:** every new name (`OPSC_*`, `opsc_*`, `opscState`, `data_opsAdmin`, `data_proxyGet`, `OPS_CONSOLE_MODE` …) was checked against all `App/*.js`: **0 collisions** (classic scripts share one lexical scope). | a redeclaration would break the whole terminal |

---

## 4. Three-point check (Task item 3)

**1. Index audit.** No new query, table, index or cron. The console calls only E-1, C-1, C-2 (003), D-1, C-1/C-2 DQ (004), the public Board/Ledger/Events/Drift GETs (unchanged), and `/api/ops-health` (proxy, unchanged). Their plans are 003 AC-16 and the 004 EXPLAIN table. The console shell reads **0** D1 rows.

**2. Single execution.**

| Call | Max reads |
|---|---|
| Cases list (2 statuses / all 4) | ≤ 102 / ≤ 204 |
| DQ list (3 / all 5) | ≤ 153 / ≤ 255 |
| Case detail | ≤ 230 |
| DQ detail | ≤ 405 typical, ≤ 500 |
| DQ action (resolve probes, 004 report) | ≤ about 510 |
| Shell | 0 |

**Largest: about 510.** Fleet (≤ 1,000, RQ-5) is not built, so it is not measured.

**3. Budget per day.**

| | Reads / day |
|---|---|
| Ops review N-2 worst case | ≈ 175k |
| 005 adds a list re-read after each action (40 × ≤ 255) | + ≈ 10k |
| Removed: Fleet | − 20k |
| Removed by M-3: the console's Health poll on admin tabs | 0 |
| **Total** | **≈ 165k ≈ 3.3% of 5M** |

**Writes** are 003/004's own (≈ 6 per action; the shell writes 0). **Nothing polls** except Health, and only while it is the visible tab.

---

## 5. Tests (Task item 3)

| Suite | Result | On the **pre-005** tree (004 build tree + only the new tests copied in) |
|---|---|---|
| `ops-console.test.mjs` (new) | **58/58** | **FAIL** exit 1 — `ReferenceError: data_opsAdmin is not defined` |
| `console-shell.mjs` (new) | **12/12** | **FAIL** exit 1 — 3 fail + crash (no console route) |
| **Mutation check** of `ops-console.test.mjs` (scratch copies via `FE_DIR`) | **6/6 mutations caught:** no `redirect:'manual'` (2 fail), no `expected_status` (7), no escaping (3), no Health gate (1), no Fixed gate (1), a fresh id on Retry (2) | — |
| 004 suites in this tree: `dq-contract` 68, `dq-seeds` 32, `dq-page` 19, `sweep-contract` 26, `health-check` 18, `cases-contract` 66, `migration-m1` 29 | all pass | — |
| `control-split` 100, `lateness` 42, `admin-jobs-lateness` 13, `boost-heartbeat-resilience`; `nav-007-frontend`, `nav-007-key`, `nav-007-worker` | all exit 0 | — |
| `ingest-contract.mjs` | exit 2, **also on untouched origin** (a live-endpoint script that needs env vars). Not a regression. | — |

**How the front-end test is answered by the real Worker on a local D1:**
- The REAL `App/ma-data.js` and `App/ma-ops.js` run in a vm with a DOM stub.
- Every `fetch` goes to the REAL `ops-api.js` + `cases.js` on node:sqlite.
- That D1 is built from migrations 002–005, the real 015b/015c legacy rows, 003 M1 (rendered) and M2, and the 004 M3a, M3 template, M3c and M4.
- Access JWTs are RS256, signed in the test.

**Flows proven end to end:**
- **AC-3:** acknowledge → one POST with the right headers and body → "Saved." → one event with the Founder email.
- **AC-4 and M-4:** blocked submits send nothing.
- **AC-5:** resolve → reopen.
- **AC-6:** two tabs → the second gets the 409 copy and a refresh, and the server holds 1 event.
- **AC-7:** the response is lost → Retry re-sends the same `request_id` → replay → "Already saved.", and the server holds 1 event.
- **AC-8:** KI 22.44, member → Won't fix, 1 `member_updated` event.
- **AC-9:** the Fixed gate → Schedule fix → Resolve Fixed with Force. A protected reopen is blocked in the form; forced past the form via dev tools, it gets the 409 copy and the row is unchanged.
- **Members:** keyset Load more, 200 + 50.
- **Lists:** keyset Load more.
- **Escaping:** `<img onerror>` and `<script>` in title, summary and evidence render inert.
- **Unknown type:** shown raw.
- **AC-1:** launcher card.
- **AC-13:** Board/Ledger read-only.
- **AC-12 static checks:**
  - no `prompt(`/`alert(`;
  - no `fetch(` in `ma-ops.js`;
  - no `on…=` handler emitted;
  - only the 2 localStorage keys;
  - 0 hits for `Cf-Access-Jwt|CF_Authorization|client_secret|.meridian-secrets|OPS_INGEST` in `App/*.js|html` and `docs/`.

**Not done here, honestly:**
- **No real-browser run.** Starting a dev server through Bash is not allowed in this environment, and adding a launch config would have meant writing to the shared checkout, which the Control forbids.
- So the **live CSP check (0 violations in Chrome, Safari, Firefox; M-1/AC-14)**, keyboard-only use (AC-10) and contrast are **verified at Founder UAT (Mon 2)**.
- They are statically supported by the tests: no inline handlers, a nonce on every inline script, scripts from the scoped path, every `connect-src` host listed, ARIA tablist/dialog, Esc closes, focus moves to the heading and back to the row, and severity always carries text.

---

## 6. Sat 31 deploy run sheet (after 004 is live) and Mon 2 release

**State at 20:30Z Thu:**
- Deploy 4 is live: `meridian-ops` `2e4c3fc6` from `fd7b753` (THU29.ENG8).
- **004 is not deployed yet.** 005 rebases onto 004's go-live commit.
- A trial three-way apply of the 004+005 diff onto `origin/October-2026` (`71fab4b`) gives **4 conflict hunks, all "keep both sides"**:
  - three are 004's — the sweep's `prevSweepStart` init, the `dq_new` response fields, and the toml vars (deploy 4's `OPS_SWEEP_*` next to 004's `OPS_DQ_*`); the 004 go-live resolves those;
  - **one is 005's** — the `console-page.js` import next to deploy 4's `sweep-ext.js` import.
- 005's `handleAdmin` lines, `ma-ops.js` and `ma-data.js` apply cleanly. No front-end file has changed upstream since `721d093`.

**Gates (all before step 1):**
- **G1** — 004 is live. Its go-live commit and `meridian-ops` version id are recorded in its report. *If 004 slips to Sat 31, 005's deploy is a separate later slot the same day, or it moves with 004. Never in the same deploy unless the Main Lane says so.*
- **G2** — the Main Lane's review gate for 005 (if any) is closed.
- **G3** — LANE-1-ENG commits the 005 files (§7) on top of the 004 go-live commit, resolving the import hunk by keeping both lines. **All `App/Ops/tests/*.mjs` are green after the rebase** (`ingest-contract` excepted as live-only), and `console-shell.mjs` still counts 15.
- **G4** — no other lane is mid-change. Sat 31 also carries the **A2 run** (window Fri 30 08:05Z → Sun 1 00:10Z) and the **002b deploy**. 005 is not an Entities writer, but it runs **alone in its slot**: between A2 batches as LANE-11 announces, and not adjacent to 002b (M-6). Announce "starting MA-OCT-005 deploy <UTC>".

**Windows (FREEZES.json, re-read on the day):** avoid 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10, and ±2 min around the 08/12/18/22Z sweeps. Preferred slot: **13:00–16:30Z**.

| # | Step | Command / check | Stop rule |
|---|---|---|---|
| 1 | Pre-flight | `/usr/local/bin/wrangler --version` (4.96.0); `wrangler whoami`; re-read FREEZES; `GET /api/ops/cf/d1-today` (005 writes 0, but record it) | inside a freeze or another lane mid-change → wait |
| 2 | Record C1 | `wrangler deployments list -c App/Ops/wrangler-ops.toml` → current = **004 version id = the rollback id**; confirm the deployed code = the 004 go-live commit | mismatch → STOP |
| 3 | **One `meridian-ops` deploy** | `cd App/Ops && /usr/local/bin/wrangler deploy -c wrangler-ops.toml` from the committed tree | record the new version id |
| 4 | Smoke (production) | (a) anonymous `curl -si https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/console` → the Access redirect, no CORS header. (b) **Founder's browser:** open the same URL → Access sign-in → the page says **"The operator console arrives with the 2 Nov release…"**, because Pages still serves the September `ma-ops.js`. That proves the route, Access and the shell. (c) DevTools Console on that page: **0 CSP violations**. (d) The console exists only for humans: the `ops-script` token → 403 (only if the token holder runs it; optional). (e) E-1, D-1 and C-1 still 200 (AC-11 baseline `rows_read`). | any 5xx, a CSP violation, or a route regression → `wrangler rollback <004 version id>` and STOP |
| 5 | Record | report: version ids, smoke results, endpoint count 15 | — |

**Mon 2 Nov (the October Pages release; the releasing lane, not this one):**
- `node generate-docs.mjs` (still 11 files) → commit `docs/ma-ops.js` + `docs/ma-data.js` → push `September-2026`/the release branch as the Main Lane's release plan says.
- Then **Founder UAT AC-1…AC-14 in production**:
  - in Chrome **and** Safari (and Firefox if available): **0 CSP violations**, a styled console;
  - keyboard-only pass (AC-10);
  - **AC-11** measured `rows_read` for E-1, C-1, D-1 and DQ C-1 (the per-query read watch, N-8).
- **Timing:** before or after the 013 run, never during.
- **If UAT fails:**
  - revert the `docs/` commit and push. The shell then shows the "2 Nov release" message again, and no admin data is touched.
  - Optionally `wrangler rollback` `meridian-ops` to the 004 version.
  - Go live Tue 3 with the old dashboard (cases via the token), and record it as the go-live exception (M-6).

---

## 7. Commit list (for LANE-1-ENG; explicit paths, on top of the 004 go-live commit)

**005 only** (the 004 file set is committed by the 004 go-live, per the 004 report):

```text
App/ma-ops.js
App/ma-data.js
App/Ops/src/console-page.js
App/Ops/src/ops-api.js          (005 hunks: the console-page.js import, the 3 handleAdmin lines, the header count)
App/Ops/tests/ops-console.test.mjs
App/Ops/tests/console-shell.mjs
```

- `docs/` is regenerated on **Mon 2 only**, by `generate-docs.mjs`, never by hand.
- `App/index.html` and `generate-docs.mjs` are unchanged.
- This lane did not touch `.claude/settings.local.json`, `13F Seed/gleif-seed.js` or `.env*`.

## 8. Open items for the Main Lane

1. **N-1:** record that Founder Q1 (Option B) supersedes 004 §8.1's "005 must not add Worker routes". `meridian-ops` is now at 15/15.
2. **Live-browser checks:** M-1's 0-CSP-violation check in three browsers, AC-10 keyboard and contrast move to the Sat 31 smoke (step 4c) and the Mon 2 UAT, because this lane could not run a browser server (§5).
3. **D-1:** if a separate `ma-ops-cases.js` is wanted later, it needs a CR for `generate-docs.mjs`'s list and CLAUDE.md.
4. **Fleet and New case** (pre-cut) are November candidates. Fleet needs its one measured `/admin/jobs` call (RQ-5).

MA-OCT-005.BUILD reported.
