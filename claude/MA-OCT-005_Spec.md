# MA-OCT-005 — Operator Console Redesign (`ma-ops.js`): Spec

```text
ISSUED BY:    Main Lane — Task MA-OCT-005.SPEC v1 (0d804183…a448d)
EXECUTED BY:  UX Lead (REVIEW-007; spec author, doc-only)
REVIEWED BY:  Operations Lead (Tue 27; ML-1024-2). Architect consulted on §4 (auth path, CSP, endpoint).
APPROVED BY:  Founder (Founder UAT before release)
PACKET:       MA-OCT-005 — Operator console redesign
GATE:         Spec → review Tue 27 → build Wed 28 – Fri 30 → last production deploy Sat 31 → release sign-off Sun 1 Nov (ML-1024-3)
STATUS:       REV 0 (Sun 25 Oct 2026). Doc-only: 0 D1, no deploys, no git writes. Secret files never opened (ML-1024-1).
DOMAIN:       Ops (front end of). No new D1 table, column, index or cron.
BASELINE:     October-2026; meridian-ops 14aa968c (003 deploy 3, Sat 24); meridian-control c442209c (A6); App/ma-ops.js 9687f759…2d9e5f (795 lines).
```

**Inputs (SHA-256 checked 25 Oct):**

| Input | SHA-256 |
|---|---|
| Scope v2 | `967bebd7…3445` |
| 003 Spec rev 1 | `7b8bba9f…80c2` |
| 004 Spec rev 1 | `570de1a5…5379` |
| 001 Spec Review | `8573326f…f5531` |
| `App/ma-ops.js` | `9687f759…2d9e5f` |
| `App/ma-data.js` | `38eb07ae…6c9ded` |

**Live facts used:** `claude/packets/MA-OCT-003.BUILD_Report.md`, `MA-OCT-SAT24.ENG8_Report.md` and `MA-OCT-002a.A6R_Report.md`.

---

## 0. Summary of decisions

1. **Two new tabs in `ma-ops.js`:**
   - **Cases**: 003 exceptions — list, detail and actions.
   - **DQ Tickets**: 004 — list, detail, members and actions.

   **One read-only Fleet tab** (002 `/api/ops/admin/jobs`) is P1 and first to cut. The existing Health, Drift/Budget, Events, Sprint and Release tabs stay.
2. **No new API.** The views use only routes that are live or go live on Tue 27:
   - 003: E-1, E-2, C-1, C-2;
   - 004: D-1, D-2, plus 004's DQ extension of C-1/C-2;
   - 002: `/api/ops/admin/jobs`.

   Every POST sends `Content-Type: application/json`, `X-Ops-Client: console`, a fresh `request_id` (`crypto.randomUUID()`) and the `expected_status` the operator saw.
3. **A front-end-only release is not possible for authenticated views.** The terminal is served from GitHub Pages; the admin routes sit behind Access on `meridian-ops`. A browser on one site can't call the other with the operator's identity without a backend-side change. Two options both keep **all view code in `ma-ops.js`** and differ only in where it runs (§4):
   - **Option B, same-origin console shell (recommended, Founder Q1):** one new **page** route on `meridian-ops`, `GET /api/ops/admin/console`. It serves a ≈ 60-line HTML shell that loads `ma-data.js` and `ma-ops.js` from GitHub Pages. All calls are then same-origin, which works in every browser, with no cookie or CORS changes. **It uses the 15th and last endpoint** (14 after 004).
   - **Option A, inside the terminal:** no new route, but credentialed CORS on `meridian-ops` for one origin, Access-app CORS settings, and the Access cookie set to `SameSite=None`. **It is expected to fail by default in Safari and in Firefox** (third-party cookies blocked or partitioned), and it loosens the cookie on every admin route.
4. **Board and Ledger actions are not restored in October** (Founder Q2). The "Change stage" and "Record event" buttons are removed: they post to the closed anonymous paths (001 Q2), always get 401, and use `prompt()`/`alert()`. The tabs stay read-only. Restoring the actions needs a CSRF rule on `meridian-control`'s POSTs (003 H-4, 002b) and a second Access cookie, which is November work.
5. **No authoritative state in the front end (D4).** Every view re-reads after an action, and nothing is cached across sessions apart from the last tab (`localStorage`, existing).
6. **Reads:** every view reuses an already-checked 003/004/002 query (≤ 102 to ≤ 500 rows per call). There is no auto-poll on admin views, only a Refresh button. Worst case ≈ 30k reads a day (0.6 % of 5M).
7. **Calendar fits** (§14):
   - Wed 28: transport + Cases;
   - Thu 29: DQ Tickets;
   - Fri 30: shell or CORS, clean-up, tests;
   - Sat 31: one `meridian-ops` deploy + the October Pages release + Founder UAT.

   Cut order is in §14.1.

---

## 1. Problem statement

Since Sat 24, 003's case workflow is live in `meridian-ops` (8 open cases on 21 Oct), and 004's DQ tickets arrive on Tue 27 with ≈ 15 seeded tickets. **No screen can use either:**
- the Founder can only call them from the browser console or with the `ops-script` token;
- `ma-ops.js` still shows the August dashboard;
- its two action buttons have been dead since 001;
- it has no view of cases, tickets or the fleet's lateness.

Scope v2 closes October only when the control plane is "surfaced through `ma-ops.js`".

## 2. Goals (measured at Founder UAT, Sat 31)

| # | Goal | Checked by |
|---|---|---|
| G-1 | The Founder can triage every open case, and every 004 ticket action, without the browser console or a token: acknowledge, assign, comment, resolve/dismiss, reopen. | AC-3 – AC-9 |
| G-2 | Every action leaves exactly one server audit event, and a stale screen never overwrites a newer state. 409s are shown, not swallowed. | AC-6 |
| G-3 | Zero secrets, JWTs or ticket contents in front-end code or `localStorage`. | AC-12 |
| G-4 | Every admin view reads ≤ 500 D1 rows per call, with no polling. | AC-11 |
| G-5 | Each view is usable by keyboard alone, and severity is never shown only by colour. | AC-10 |

## 3. Non-goals

| Not in 005 | Why / where |
|---|---|
| New API routes, tables or queries | 003/004 own the backend. 005 consumes it. The one exception is the Option B page route, which is presentation and reads nothing from D1. |
| Board/Ledger actions | §0 item 4; Founder Q2 |
| Kill-switch or pause controls | Fallback cut list (Addendum §6): "D1 budget and kill-switch view ships read-only" |
| Notifications, live push, auto-refresh | 003 §7.4; reads |
| Consumer-site ticket raising | 007 Phase 4 → 004's D-3 page |
| Mobile layout beyond "readable at 360 px" | The operator works on the Mac |

---

## 4. Where the console runs, and how it authenticates

### 4.1 The constraint

| Fact | Source |
|---|---|
| The terminal is at `https://navinmv81.github.io/meridian-atlas/` | CLAUDE.md DEPLOY_BRANCH |
| `/api/ops/admin/*` on `meridian-ops.navinmv1981.workers.dev` is behind the Access app "meridian-ops admin". Unauthenticated calls get **302 to the Access login**. | ENG8 step 3 |
| Admin routes send **no CORS headers**. "Until 005 names the console's origin." | 001 §6.2 |
| `data_opsGet` is a plain `fetch(url)`, with no credentials and no custom headers | A6R (3) |

A `fetch` from github.io to an admin route therefore sends no Access cookie and gets a 302 it cannot follow. It fails.

### 4.2 Option B — same-origin console shell (recommended)

**The new page route:** `GET /api/ops/admin/console`.
- Access-gated by the existing app. The Worker re-verifies the JWT as on every admin route.
- **0 D1 access.**
- Returns `text/html` with `Cache-Control: no-store` and this CSP:

  ```text
  default-src 'none'; script-src https://navinmv81.github.io 'nonce-…'; style-src 'nonce-…' 'unsafe-inline';
  connect-src 'self' https://meridian-control.navinmv1981.workers.dev https://meridian-proxy.navinmv1981.workers.dev;
  img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
  ```

  `'unsafe-inline'` for styles is needed only because `ma-ops.js` sets inline `style=` attributes today (RQ-2).

**The shell** (≈ 60 lines in a new `src/console-page.js`, the same pattern as 004's `dq-page.js`):
- a `<div id="ops-panel">`;
- `window.MA_OPS_CONSOLE = true`;
- two `<script src>` tags: `https://navinmv81.github.io/meridian-atlas/ma-data.js` and `…/ma-ops.js`;
- a nonce'd one-liner that calls `openOps({console:true})`.

**Same origin, so:** the Access cookie is first-party. No CORS, no `SameSite` change, no Access CORS settings. It works in Safari, Chrome and Firefox. The 003/004 CSRF rule (JSON + `X-Ops-Client`) is unchanged.

**In the terminal (github.io),** the Cases and DQ tabs show a launcher card:
- **"Operator console — sign-in required"**, with a button that opens the shell URL in a new tab (`rel="noopener"`);
- one line explaining that case and ticket data are private and need sign-in.

The public tabs keep working as today.

**Costs:**
- the **15th and last** `meridian-ops` endpoint (RQ-1);
- one `meridian-ops` deploy on Sat 31;
- the admin origin runs scripts loaded from GitHub Pages. That is the same trust as Option A, where github.io scripts act with the admin session.

### 4.3 Option A — inside the terminal (not recommended unless the Founder works in Chrome)

| Step | Who | What |
|---|---|---|
| A-1 | Founder (dashboard) | "meridian-ops admin" Access app: **CORS** allow origin `https://navinmv81.github.io`, credentials on, methods GET/POST/OPTIONS, headers `Content-Type`, `X-Ops-Client`. **Cookie `SameSite=None`.** |
| A-2 | Engineering | `meridian-ops`: on `/api/ops/admin/*`, if `Origin` equals the var `OPS_CONSOLE_ORIGIN`, add `Access-Control-Allow-Origin: <that origin>`, `Access-Control-Allow-Credentials: true`, `Vary: Origin`. Otherwise no CORS, as now. No new route. |
| A-3 | Front end | Admin calls use `credentials: 'include'`. A 401/302/opaque failure shows "Sign in" (opens the admin URL in a new tab), then Retry. |

**Risks:**
- **Third-party cookie:** expected to be blocked by Safari's default and partitioned by Firefox. It works in Chrome only while Chrome allows third-party cookies.
- **`SameSite=None` applies to every admin route.** CSRF then rests entirely on the JSON + `X-Ops-Client` rule. That rule is in place on E-2, C-2 and D-2; the admin GETs have no side effects.
- **`navinmv81.github.io` is shared** by all of the Founder's Pages repos.

### 4.4 One code path for both

`ma-ops.js` gets a transport of about 40 lines:

```js
const OPS_CONSOLE_MODE = window.MA_OPS_CONSOLE === true;          // Option B shell
const OPS_ADMIN_BASE   = OPS_CONSOLE_MODE ? location.origin : OPS_WORKER_BASE;
async function ops_admin(path, { method = 'GET', body } = {}) { /* fetch with JSON, X-Ops-Client: 'console',
  credentials: OPS_CONSOLE_MODE ? 'same-origin' : 'include', 15 s timeout; maps the response (§6.3) */ }
```

The views call only `ops_admin()`. **Switching between the options is one constant** (`OPS_ADMIN_ENABLED_IN_TERMINAL`), not new code. This keeps the "network via ma-data.js" convention: `ops_admin` is added to `ma-data.js` as `data_opsAdmin`, next to `data_opsGet`.

---

## 5. Views

The tab bar becomes **Health · Cases · DQ Tickets · Fleet (P1) · Drift & Budget · Events · Sprint Board · Release Ledger**. In the console shell, the default tab is Cases.

### 5.1 Cases — list (003 E-1)

| Item | Spec |
|---|---|
| Call | `GET /api/ops/admin/exceptions?status=open,acknowledged&limit=50` (default). Filters: status (chips: Open, Acknowledged, Resolved, Dismissed), severity, type, job. Filters go in the URL hash so Back works. |
| Columns | Severity (text badge "Sev 1"…"Sev 4" with colour), Ref (`EXC-…`, monospace), Type (human label, §7), Title, Job, Opened (relative + absolute on hover), Owner, Status, **Overdue** flag (from `overdue`) |
| Order | Server order (severity, opened_at). "Load more" uses `next_cursor`. |
| Empty | "No open cases. The last sweep raised nothing new." |
| Row action | Opens the detail drawer. Enter and Space work on a focused row. |
| Header | Counts by severity (from the page; labelled "on this page" if `next_cursor` is set) and a Refresh button |

### 5.2 Case — detail drawer (003 C-1)

- **Sections:**
  - header (ref, severity, status, type, title);
  - **Summary**;
  - **Job and run**: registry row, `run_snapshot` as a key–value table, matched run rows;
  - **Linked DQ tickets** (links that open the DQ drawer);
  - **History**: events oldest first, with actor, actor role, from → to, body, time.
- **Actions:** a button row showing only the transitions legal from the current status (003 §7.1). Each opens an inline form; there are no `prompt()` or `alert()` calls:

| Action | Form fields | Shown when |
|---|---|---|
| Acknowledge | optional note | open |
| Assign | owner role (select, Addendum §2 roles), assignee (email, optional) | open, acknowledged |
| Comment | note (≤ 2,000, counter) | any |
| Set severity | severity, note | open, acknowledged |
| Resolve | resolution (fixed, replayed, transient, accepted_risk, superseded), note | open, acknowledged |
| Dismiss | resolution (false_positive, duplicate → "duplicate of" ref, not_actionable), note | open, acknowledged |
| Reopen | note (required) | resolved, dismissed |

- **Every form** has an "Acting as" role label (select; default remembered in `localStorage` as a convenience, never as authority). It is sent as `actor_role`. The identity comes from Access server-side.
- **New case** (E-2) is a "＋ New case" form: type `manual` or listed, severity, title, summary, owner role, optional job. **P1, cut second.**

### 5.3 DQ Tickets — list (004 D-1)

| Item | Spec |
|---|---|
| Call | `GET /api/ops/admin/dq-tickets?status=open,triaged,fix_pending&limit=50`. Filters: status, type, severity, and **object** (domain + key; e.g. entity `931` finds tickets *and* aggregate memberships). |
| Columns | Severity, Ref (`DQ-…`), Type (label), Title, Object (domain:key, plus "merged into" when returned), Members (count, for aggregates), Owner, Status, Age / Overdue |
| Protected | `DQ-M-000001…3` (`do_not_merge`) carry a "Protected decision" badge |

### 5.4 DQ ticket — detail drawer (004 C-1)

- **Sections:**
  - header;
  - **Problem** (summary, field, observed → expected, evidence, proposed resolution);
  - **Members** for aggregates: a table of object, proposed action, status and note, with "Load more" on `members_cursor` (≤ 200 a page);
  - **Linked exception**;
  - **History**.
- **Actions** follow 004 §7.1 and §7.5:

| Action | Fields | Gate in the UI (the server still enforces) |
|---|---|---|
| Triage | owner role, severity | open |
| Schedule fix | fix ref (packet or CR id), note | open, triaged |
| Assign / Comment / Set severity | as for cases | non-terminal (comment: any) |
| Link exception | `EXC-…` ref | non-terminal |
| Resolve | disposition (fixed, source_absence, valid_exception, pipeline_omission, job_failure), note; **"Force" checkbox** only when members are open | non-terminal. **"Fixed" is disabled with a reason** until the history has a `fix_scheduled` event. For Entities-data types the form says: "Resolve and dismiss are for the Data-Identity Lead or the Founder." |
| Dismiss | disposition (duplicate → ref, not_a_problem, wont_fix), note | non-terminal |
| Reopen | note; **for protected tickets also "Founder supersession reference" and "decided at"** (required) | resolved, dismissed |
| Member → status | per member row: status (fixed, wont_fix, not_a_problem), note | non-terminal ticket. "Fixed" asks for the applied fix packet in the note. |
| Add members | — | **Not in the UI (P2):** seeds and the Main Lane add members |

### 5.5 Fleet (P1, read-only; 002 `/api/ops/admin/jobs`)

- **Table:** job, mode, status, last run outcome, `job_state` (frozen/ok), slots of the last 7 days as a strip of cells (on time / late / missed / paused / pending / unobserved, each with a letter as well as a colour), and open cases for the job (a link to Cases filtered by job).
- **No actions.**
- **First to cut.**

### 5.6 Existing tabs

| Tab | Change |
|---|---|
| Health, Drift & Budget, Events | No change, apart from moving the inline `fetch(OPS_API_URL)` in `openOps` to `ma-data.js` (`data_proxyGet`), as the file's own comment already intends |
| Sprint Board, Release Ledger | **Remove** the "Change stage" and "Record event" buttons and `ops_changeTicketStage`/`ops_recordReleaseEvent`. Add a footnote: "Read-only. Changes are made by the Main Lane." They still read through `data_opsGet`, which follows A6's 302 to `meridian-control`. |

---

## 6. Client behaviour

### 6.1 Requests

- **Every POST** sends JSON with headers `Content-Type: application/json` and `X-Ops-Client: console`, and a body carrying `request_id` (new UUID per submit; **re-used only when the operator retries the same submit after a network error**), `expected_status` (from the drawer's last read), `actor_role`, and the action's fields.
- The submit button disables while in flight. Double-clicks cannot send twice.
- **After any 200:** re-read the detail (C-1), then refresh the list row in place.

### 6.2 Escaping and secrets

- Every server string goes through the existing `_escapeHtml` before any `innerHTML`. Event bodies and notes render as text (`textContent`).
- No token, JWT, cookie value, service-token id or ticket content is stored in `localStorage`, `sessionStorage` or a URL. The URL hash holds only filter values and a case or ticket ref.

### 6.3 Response handling and copy

| Response | Shown as |
|---|---|
| 200 / 201 | "Saved." (aria-live polite). The drawer refreshes. |
| 200 `deduplicated` (D-2) | "Already reported as DQ-…". Link to it. |
| 400 | The server's `error` field, mapped to a sentence where known (e.g. `resolution_required` → "Choose a resolution."). Otherwise "The server rejected this request: {error}." |
| 401, or a 302 to Access / opaque redirect | "Your sign-in has expired." with **Sign in again**, which opens the console URL in a new tab (Option A) or reloads (Option B). The form contents are kept. |
| 403 `service_route_not_allowed` / other 403 | "This action isn't allowed for your sign-in." |
| 409 `illegal_transition` / stale `expected_status` | "This case changed since you opened it. It has been refreshed — check it and try again." Auto re-read. |
| 409 `request_id_reused` | "That request was already sent." Re-read. |
| 409 `members_open` | "Some members are still open. Tick Force and say why, or update the members first." |
| 409 `fix_not_scheduled` | "Schedule the fix first (Schedule fix), then resolve as Fixed." |
| 409 `protected_decision` | "This is a protected Founder decision. Reopening needs a Founder supersession reference." |
| 429 | "Daily ticket limit reached. Try again tomorrow." |
| 503 (`OPS_CASES_ENABLED`/`OPS_DQ_ENABLED` off) | "Case management is switched off right now." The list stays visible if it was already loaded. |
| Network / timeout | "Couldn't reach Ops." Retry re-sends **the same `request_id`**. |

### 6.4 States

| State | Treatment |
|---|---|
| Loading | Skeleton rows (lists); a spinner and "Loading…" in the drawer header |
| Empty | Copy per view (§5) |
| Partial page | "Showing 50 · Load more" |
| Signed out | Launcher card (terminal, Option B) or Sign in (Option A) |
| Disabled | The 503 copy, with read-only content kept |

### 6.5 Accessibility

- **Tabs** are `role="tablist"` / `tab` / `tabpanel` with arrow keys. **The drawer** is `role="dialog"`, `aria-modal`, focus moves to its heading, Esc closes it, and focus returns to the row.
- Every form control has a `<label>`. Errors are linked with `aria-describedby`.
- Severity and slot states always carry text or a letter, never colour alone. Contrast ≥ 4.5:1 on the existing dark palette (`OPS_COLORS`), checked at build.

---

## 7. Labels

| Code | Label |
|---|---|
| `job_missed` | Missed run |
| `job_lost` | Lost run |
| `job_failed` | Failed run |
| `job_frozen` | No progress |
| `hold_active` | Global hold on |
| `budget_risk` | D1 budget risk |
| `schedule_drift` | Schedule drift |
| `sweep_overflow` | Too many findings |
| `gleif_no_progress` | GLEIF-E1 no progress |
| `gleif_stuck_in_progress` | GLEIF-E2 stuck row |
| `gleif_orphaned_backlog` | GLEIF-E3 orphaned backlog |
| `gleif_frozen_source` | GLEIF-E4 frozen source |
| `local_auth_failure` | Local auth failure |
| `blind_guard` | Blind write guard |
| `manual` | Manual |

**DQ ticket types:**

| Code | Label |
|---|---|
| `missing_mapping` | No issuer mapping |
| `ambiguous_mapping` | Ambiguous issuer |
| `low_confidence_mapping` | Low-confidence mapping |
| `merged_link_unresolved` | Merged link unresolved |
| `missing_entity` | Issuer has no entity |
| `wrong_lei` | Wrong LEI |
| `wrong_identifier` | Wrong identifier |
| `no_link_marker` | Wrong "no link" marker |
| `entity_merge` | Entity merge |
| `bad_relationship_edge` | Bad parent link |
| `isin_duplicate` | Duplicate ISIN |
| `gleif_handoff` | GLEIF hand-off |
| `data_error` | Data error |

Resolutions and dispositions are shown in sentence case with the code in a tooltip. **Unknown codes render as the raw code.** They are never dropped, so a new server vocabulary value still shows.

---

## 8. Reads and the three-point check

There are **no new queries.** Each view reuses a query already EXPLAINed by 002/003/004:

| View call | Reads per call | From |
|---|---|---|
| Cases list (E-1, default) | ≤ 102 (8 on Sat 24) | 003 AC-16 |
| Case detail (C-1) | ≤ 230 (6 on Sat 24) | 003 AC-16 |
| Case action (C-2) + re-read | ≤ 6 + ≤ 230 | 003 |
| DQ list (D-1) | ≤ 153 | 004 AC-15 |
| DQ detail (C-1 DQ) | ≤ 405 typical, ≤ 500 | 004 AC-15 |
| DQ action + re-read | ≤ 6 + ≤ 500 | 004 |
| Fleet (`/admin/jobs`) | as 002 (registry ≤ 60 + L2 per job; the build measures one call, budget ≤ 1,000) | 002 §11.2 |
| Console shell (Option B) | **0** | this spec |

- **No auto-refresh** on admin tabs. The Health tab keeps its existing 10-minute poll, which calls the proxy, not D1-heavy routes.
- **Day estimate:** a heavy triage day of 100 list/detail calls and 40 actions ≈ 100 × 300 + 40 × 500 ≈ 50k worst case (1 % of 5M). Writes are 003/004's own budgets: ≈ 6 per action.
- **Three-point check:**
  1. **Index audit:** no new query; all are indexed per 003/004.
  2. **Single execution:** max ≤ 1,000 (Fleet); everything else ≤ 500.
  3. **Budget:** above.

  There is **no new table** and no domain declaration is needed.

---

## 9. Files touched

| File | Change | Lines (est.) |
|---|---|---|
| `App/ma-ops.js` | Tabs, Cases, DQ, Fleet (P1), drawer, forms, response mapping; remove board/ledger actions and `prompt`/`alert` | +900 / −150. If it passes ≈ 1,500 lines, split into `ma-ops.js` (shell, tabs, existing panels) and **`ma-ops-cases.js`** (Cases + DQ), loaded by `index.html` and the shell. That is still no bundler and no module imports between domain files. |
| `App/ma-data.js` | `data_opsAdmin()` (transport, §4.4); `data_proxyGet()` | +50 |
| `App/index.html` | `<script src="ma-ops-cases.js">` only if the split happens | +1 |
| `App/Ops/src/console-page.js` + router line | **Option B only:** the shell route `GET /api/ops/admin/console` | +70 |
| `App/Ops/src/ops-api.js` | **Option A only:** CORS for `OPS_CONSOLE_ORIGIN` on admin responses | +20 |
| `docs/` | Regenerated by `generate-docs.mjs`, never by hand | — |

---

## 10. Tests

1. **Front-end unit tests** (`App/tests/ops-console.test.mjs`, node + the minimal DOM stub used by 007.P1's front-end tests; mutation-checked, as 007 did). They cover:
   - request building (headers, a fresh `request_id` per submit, the same one on retry, `expected_status`, `actor_role`);
   - legal actions per status and type (003 §7.1 and 004 §7.1 tables as fixtures);
   - "Fixed" disabled without `fix_scheduled`;
   - the protected-reopen fields;
   - every row of §6.3 mapped from a stubbed response;
   - escaping (a `<img onerror>` in title, note and evidence renders inert);
   - keyset "Load more" on lists and members;
   - unknown codes render raw.
2. **Static checks:**
   - no `prompt(` or `alert(` left in `ma-ops*.js`;
   - no `fetch(` outside `ma-data.js` in new code;
   - grep of `App/` and `docs/` for `Cf-Access-Jwt`, `CF_Authorization`, `client_secret`, `.meridian-secrets`, `OPS_INGEST` → 0;
   - no `localStorage` key other than `ops_last_tab` and `ops_acting_role`.
3. **Integration** (local `wrangler dev` of `meridian-ops` on a `node:sqlite`/`--local` D1 with 003 M1/M2 and 004 M3/M4 applied, JWT check stubbed as in 003's tests): the full Cases and DQ flows in a real browser. That means acknowledge → resolve → reopen, a 409 by acting from two tabs, members, and a protected reopen refused.
4. **Option B only:** shell route test. 401 without a JWT, 0 D1 calls, CSP header present, `script-src` exactly the Pages origin plus the nonce.
5. **Option A only:** CORS test. ACAO only for the exact origin, `Vary: Origin`, none for other origins or for public routes.
6. **Founder UAT (Sat 31, production, Founder's own browser):** §13 AC-3 – AC-10 on real cases (8+ open) and the seeded tickets (`DQ-000010…`).

---

## 11. Founder questions (3), each with a recommendation

| # | Question | Recommendation |
|---|---|---|
| **Q1** | **Where should the operator console run?** **B:** in its own tab on `meridian-ops`, opened from the terminal, which works in every browser; it uses the Worker's last free route. **A:** inside the terminal page, which needs your Access cookie to work across sites. That fails by default in Safari and Firefox, and it loosens the cookie for every admin route. | **B.** It works whatever browser you use, keeps sign-in first-party, and needs no Access CORS settings. Choose A only if you work in Chrome and want it all in one page. |
| **Q2** | **Keep Sprint Board and Release Ledger read-only in October?** The buttons have been dead since 001. Restoring them needs a CSRF rule on `meridian-control` and a second sign-in. | **Yes**, read-only in October. The Main Lane keeps making those changes, and the actions return in November with the CSRF rule. |
| **Q3** | **If the build runs late, may we cut in this order:** (1) the Fleet tab, (2) the "New case" form, (3) DQ member edits from the UI, leaving them to the Main Lane by token? | **Yes.** Cases and DQ list/detail/actions (resolve, dismiss, reopen, schedule fix) are never cut. |

## 12. Review questions (Operations Lead; Architect consulted)

| # | Question |
|---|---|
| RQ-1 | Accept Option B's use of the **15th, last** `meridian-ops` endpoint for a 0-D1 page route? Option for later (P2): fold 004's D-3 prefill page into the console (`/console#dq-new?…`) to free one endpoint. |
| RQ-2 | Accept the shell CSP: `script-src` limited to the GitHub Pages origin plus a nonce, and `style-src 'unsafe-inline'` because of `ma-ops.js`'s inline styles. That is a trust in GitHub Pages content inside the admin origin, the same as Option A. |
| RQ-3 | If Option A is chosen: accept `SameSite=None` on the "meridian-ops admin" Access cookie and credentialed CORS for `https://navinmv81.github.io` (shared by all the Founder's Pages repos)? |
| RQ-4 | Is the self-declared "Acting as" role label (recorded as `actor_role`, never as authority) acceptable for 004 §7.5's procedural rule? |
| RQ-5 | Fleet budget: confirm `/admin/jobs` ≤ 1,000 reads per call at today's 49 jobs (one measured call at build). |

## 13. Acceptance criteria (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | The terminal (github.io), not signed in | Open Cases or DQ | Option B: the launcher card; the button opens the console in a new tab, where Access asks for sign-in. Option A: "Sign in" and then data. No console error that leaks data. |
| AC-2 | Signed in to the console | Open Cases | Open and acknowledged cases listed in server order, with severity as text, overdue flags, and "Load more" when `next_cursor` is set. Reads ≤ 102. |
| AC-3 | An open case | Acknowledge from the drawer | One POST with JSON, `X-Ops-Client: console`, a UUID `request_id` and `expected_status=open`. "Saved." shown; the drawer shows status Acknowledged and one new history event with the Founder's email. |
| AC-4 | An acknowledged case | Resolve without choosing a resolution | The form blocks submit ("Choose a resolution."); no request is sent |
| AC-5 | A resolved case | Reopen with a note | Status Open, with the reopen event in history |
| AC-6 | The same case open in two tabs | Act in tab 1, then act in tab 2 | Tab 2 shows the 409 copy and refreshes; the server has one event from tab 1 only |
| AC-7 | A network failure on submit (forced offline) | Retry | The **same** `request_id` is re-sent; the server answers a 200 replay; one event |
| AC-8 | DQ ticket KI 22.44 (24 members) | Open the detail; page through the members; set one member to Wont fix | The members table pages; 1 `member_updated` event; the ticket refreshes |
| AC-9 | A DQ ticket with no `fix_scheduled` event | Try Resolve → Fixed | "Fixed" is disabled with its reason. After Schedule fix, it is enabled and resolve succeeds. Reopen on `DQ-M-000001` without a supersession is blocked in the form; if forced via the dev tools, the server's 409 copy is shown. |
| AC-10 | Keyboard only | Tab → list → Enter → drawer → action → Esc | All reachable; focus returns to the row; every badge has text |
| AC-11 | Production, one of each call | Measure | List ≤ 102 / 153, detail ≤ 230 / 500, Fleet ≤ 1,000; nothing polls |
| AC-12 | Static checks (§10.2) | Run | 0 hits; no `prompt` or `alert`; no secret strings; only the two allowed `localStorage` keys |
| AC-13 | Sprint Board and Release Ledger | Open | The data shows (through the A6 302); no action buttons; read-only footnote |
| AC-14 | Option B shell | No JWT / with JWT | 302 to Access / the console loads; 0 D1; CSP as §4.2 |

## 14. Build plan by day (Claude Code, LANE-1-ENG or as the Main Lane assigns; only that lane commits)

| Day | Work | Remote |
|---|---|---|
| **Tue 27** | Review (Operations Lead), and the Founder's answers to Q1–Q3 in the combined Decision Request (ML-1025-1). 004 goes live (needed for DQ). | — |
| **Wed 28** | `data_opsAdmin` transport; tab bar + router hash; **Cases** list, drawer, all 7 actions; §6.3 mapping; tests 1 and 2 for Cases. Local `wrangler dev` with fixtures (test 3). | 0 |
| **Thu 29** | **DQ Tickets** list, drawer, members paging, 004 actions including protected reopen and the Fixed gate; tests for DQ. | 0 |
| **Fri 30** | Option B shell route **or** Option A CORS (Q1), with its test (4 or 5). Board/ledger clean-up. Fleet (P1, if on time). Accessibility pass, contrast check. `generate-docs.mjs` dry run; the file split if needed. Report. | 0 |
| **Sat 31** (last deploy day; FREEZES re-read, clear of sweep slots 08/12/18/22 UTC and the boost bands) | 1) `meridian-ops` deploy (the shell or the CORS) with C1 deployed = repo and the previous version id recorded. 2) Option A only: Founder's Access app CORS and `SameSite` settings. 3) The front end ships in the **October Pages release** (`generate-docs.mjs` → commit `docs/` → push). 4) **Founder UAT** AC-1 – AC-14. | 1 Worker deploy + Pages |
| **Sun 1 Nov** | Release sign-off only (no deploys). | — |

### 14.1 What to cut to fit (Q3)

| Order | Cut | Effect |
|---|---|---|
| 1 | Fleet tab (§5.5) | Lateness stays visible only through `/admin/jobs` JSON. It is on Addendum §6's fallback list in spirit (read-only). |
| 2 | "New case" form (E-2) | Manual cases are raised by the Main Lane via the token |
| 3 | DQ member edits | Members stay read-only in the UI; edits are made by the token |
| **Never** | Cases + DQ list, detail, and the resolve/dismiss/reopen/acknowledge/schedule-fix actions; auth, CSRF, escaping | October acceptance ("integrated exception and data-quality case management") |

If 004 slips past Tue 27, the DQ tab ships behind a "Coming soon" card, and Cases ships alone.

## 15. Rollback

| Change | Trigger | Rollback | Check |
|---|---|---|---|
| Front end (Pages) | A console defect | Revert the `docs/` commit and push (Pages rebuild ≈ 1 min). Admin data is unaffected: the backend owns all state. | The old dashboard returns |
| Option B shell route | Defect or CSP problem | `wrangler rollback` to the recorded previous `meridian-ops` version, or remove the router line in a redeploy. The terminal's launcher card then gets 404; the copy says "Console unavailable". | `/api/ops/admin/console` 404 |
| Option A CORS | Exposure concern | The Founder removes the Access CORS settings and restores `SameSite=Lax`; redeploy without `OPS_CONSOLE_ORIGIN`, or roll back | No ACAO on admin responses |
| A wrong action from the UI | Operator error | Normal workflow: reopen, comment, or a 004 dismissal with a note. The audit trail is append-only, so nothing is lost. | History shows both events |

---

*End of spec rev 0.*
