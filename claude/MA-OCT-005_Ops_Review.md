# MA-OCT-005 — Operations Lead Review (Operator console spec rev 0)

```text
REVIEWER:     Operations Lead (LANE-1-OPS; not the spec author — the 005 spec and 003/004 were written in other sessions)
PACKET:       MA-OCT-005 — Operator console redesign (`ma-ops.js`), spec rev 0
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 6 MUST-FIX before build, 8 NOTES
DATE:         Wed 28 Oct 2026
BASIS:        Founder Q1 Option B, Q2 yes, Q3 yes (25 Oct); Option C dates (ML-1025-5); ML-1025-3 / ML-1026-1; live code at origin/October-2026 = 721d093
```

## Evidence

| Input | SHA-256 (re-hashed on disk) |
|---|---|
| `claude/MA-OCT-005_Spec.md` rev 0 | `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6` ✔ |
| `claude/MA-OCT-003_Spec.md` rev 1 | `7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2` ✔ |
| `claude/MA-OCT-004_Spec.md` rev 1 | `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379` ✔ |

**Live code** was read from `origin/October-2026` = `721d093`, with `git --no-optional-locks show` (not the working copy):
- `App/Ops/src/ops-api.js` (978 lines);
- `App/Ops/src/cases.js` (440 lines; the 003 routes from `76f4261`);
- `App/ma-ops.js` `f7332bb6…1420` (812 lines);
- `App/ma-data.js`;
- `App/index.html`.

0 D1, no deploys, no git writes, no secret files.

## Checks

### 1. Actions against the live 003 routes and 004 rev 1

| Item | Live / 004 | Spec | Result |
|---|---|---|---|
| Seven case actions | `ACTIONS` = acknowledge, assign, comment, set_severity, resolve, dismiss, reopen. The `from` states match §5.2's "shown when". | §5.2 | ✅ |
| CSRF | C-2 / E-2 need `Content-Type: application/json` **and** `X-Ops-Client` ∈ {console, script, service, dq-page}, else 400 before D1 (`csrfOk`). 004 D-2 uses the same rule. | §0.2, §6.1 | ✅ (`console`) |
| request id | `request_id` must be a UUID, lower-cased; idempotency key `act:<id>`. The same id with the same action → **200 `{replay: true}`**; a different action or subject → **409 `request_id_reused`**. | §6.1, AC-7 | ✅ — mapping gap, **M-5** |
| Stale screen | `expected_status` is required. Then **409 `stale_expected_status`**, or `illegal_transition`, or **`not_applied`** (lost race). | §6.3 | ⚠ live codes not all mapped — **M-5** |
| Required fields | The server **requires a note** for comment, set_severity, resolve, dismiss and reopen. Assign needs `owner_role` (one of 8 `ROLES`) and/or `assignee` (email or `service:<name>`). Dismiss `duplicate` needs `duplicate_of` = an `EXC-` ref. | §5.2 forms | ⚠ the forms show the note as optional or unmarked — **M-4** |
| Actor attribution | `actor` and `actor_source` come from the Access JWT (`verifyAccessJwt`). `actor_role` is a free string ≤ 60, recorded but never checked. | §5.2 "Acting as", RQ-4 | ✅ (see RQ-4) |
| DQ actions (004 §7.1/§7.5) | triage, schedule fix, link exception, `member_update` (body `member`, `member_status`, **`expected_member_status`**, AC-9), force resolve with note, protected reopen `founder_supersession: {reference, decided_at}`, 409 `members_open` / `fix_not_scheduled` / `protected_decision` | §5.4, §6.3 | ⚠ `expected_member_status` is not in the spec — **M-4** |
| DQ before 004 is live | C-2 on a `DQ-` ref today answers **409 `dq_actions_arrive_with_ma_oct_004`** | §14 "if 004 slips" | NOTE N-5 |

### 2. Option B and the endpoint cap

**`meridian-ops` routes at `721d093` (path + method):**

| Group | Routes | Count |
|---|---|---|
| Public GETs | `budget-risk`, `openfigi-status`, `cf/invocations`, `cf/d1-today` | 4 |
| Admin | `GET admin/jobs` | 1 |
| Ingest | `POST ingest/run-event`, `POST ingest/sweep` | 2 |
| 003 cases | E-1 `GET admin/exceptions`, E-2 `POST admin/exceptions`, C-1 `GET admin/cases/{ref}`, C-2 `POST admin/cases/{ref}/action` | 4 |
| **Today** | (the two A6 rules — legacy POST 401, moved GETs 302 — are rules, not endpoints) | **11** |
| + 004 | D-1 `GET admin/dq-tickets`, D-2 `POST admin/dq-tickets`, D-3 `GET admin/dq/new` | 14 |
| + 005 Option B | `GET admin/console` | **15 ≤ 15** ✅, **0 headroom** |

- **Access coverage:** `/api/ops/admin/console` sits under the existing "meridian-ops admin" app prefix `/api/ops/admin`, so no new Access app is needed. The Worker re-verifies the JWT in `handleAdmin` before anything else.
- **Service tokens:** `adminRouteId` returns `'other'` for the console path. `serviceGate` refuses any token for a route it can't list, so **the console is human-only by construction** (403 before D1). Keep it that way (N-6).

### 3. Read budget

- **Server limits:**
  - E-1 and D-1 `limit` is clamped to ≤ 100;
  - E-1 reads ≤ limit + 1 per status;
  - C-1 events `LIMIT 200`;
  - DQ members are paged at ≤ 200 (`members_cursor`).
- **Per call, at the spec's `limit=50`:**
  - Cases list ≤ 102 (2 statuses), and ≤ 204 if all 4 chips are on;
  - DQ list ≤ 153 (3 statuses), and ≤ 255 with all 5;
  - case detail ≤ 230;
  - DQ detail ≤ 405 typical, ≤ 500;
  - action ≤ 6 + re-read;
  - console shell 0.

  **All ≤ 500.** Fleet is ≈ 300 + lateness slots per the `ops-api.js` header. RQ-5 sets a ≤ 1,000 cap; build measures it.
- **Indexes:** no new query. Every view call is one 003/004 already EXPLAINed (003 AC-16, 004 §11.2: `idx_ops_exception_queue`, `idx_ops_case_event_subject`, `idx_ops_dq_queue`, `idx_ops_dq_object`, `idx_ops_dq_member_object`; `ops_job_registry` bounded scan ≤ 60).
- **Polling:** admin tabs never poll (§8). **But the console shell also loads the Health tab,** whose 10-min poll of `/api/ops-health` costs 491 reads per call since MON26: 70.7k a day if left visible. **M-3.**
- **Worst case per day (Ops figure):**

  | Item | Reads |
  |---|---|
  | 150 list calls × ≤ 404 | 60.6k |
  | 100 detail calls × 500 | 50k |
  | 40 actions × 506 | 20.2k |
  | 20 Fleet calls × 1,000 | 20k |
  | console Health poll only while Health is shown, ≤ 8 h × 6/h × 491 | 23.6k |
  | **Total** | **≈ 175k ≈ 3.5 % of 5M** |

  The terminal panel's own poll (≤ 70.7k, MON26) comes on top. **Safe**, but the spec's §0 (30k) and §8 (50k) disagree and both are low (N-2).

### 4. Operational safety

**What an operator can break:**
- Only Ops-domain case and ticket state, through 003/004's own guarded transitions. **No D1 entity data, no kill switch, no pause, no registry** (§3 non-goals). Every action is audited (append-only `ops_case_event`).
- **Reversible:** resolve and dismiss → reopen; assign, severity and comment are additive.
- **Not freely reversible:**
  - **protected reopen** of `DQ-M-000001…3` needs a Founder supersession (409 `protected_decision`);
  - **force-resolve** with open members;
  - **member → fixed** (an Entities-data authority rule).

  These three need a confirm step (N-5).
- **Side effect:** `set_severity` to sev1/sev2 makes the A3 health-check notify (N-5).
- **Protected-reopen fields:** the spec's "Founder supersession reference" and "decided at" must be sent as `founder_supersession: {reference, decided_at}` (M-4).
- **Failure states:** 401/403/409/429/503 are mapped. **Not covered:**
  - 500 `internal error`;
  - Cloudflare HTML 5xx (e.g. 502/522/1101);
  - an Access 403 policy page;
  - a non-JSON body;
  - reliable detection of an expired Access session.

  Under `fetch`'s default `redirect: 'follow'`, an expired session's 302 to `*.cloudflareaccess.com` becomes a generic CORS `TypeError`, indistinguishable from offline. **M-5.**

### 5. Fit to the new dates (Option C)

| Spec §14 | Now | Effect |
|---|---|---|
| Build Wed 28 – Fri 30 (3 days) | **Fri 30 only** (004 live Thu 29) | **About ⅓ of the build time.** Apply Q3's cut list up front: plan Fleet and New case as cut, and add DQ member edits only if time remains. |
| Sat 31: Worker deploy + Pages release + UAT | Sat 31 **one `meridian-ops` deploy**; front end in the **Mon 2 Nov site release** (Pages serves `September-2026/docs` until then, ML-1026-1) | **Between Sat 31 and Mon 2 the shell loads the September `ma-ops.js`,** which has no console mode. Production UAT can only happen **Mon 2**, the last production-change day, so a UAT defect cannot be fixed before Tue 3. **M-6.** |
| — | Sat 31 also carries the A2 run close and the 002b deploy; Mon 2 also has the 013 run | One production change at a time. Sequence the 005 deploy separately (M-6). |
| Baseline `ma-ops.js` `9687f759…` (795 lines) | Live `f7332bb6…` (812 lines; 721d093 hidden-tab pause; enrichment fields now null) | The build must start from 721d093. **M-2.** |

### 6. Pre-Refresh Checklist: per-query read watch (new item, ML-1025-3)

Proposed text for the Pre-Refresh Checklist (Main Lane to add; Ops owns it):

> **R-W. Per-query read watch (every release that adds or changes a route, a query or a poll).**
> 1. For each changed query, record `meta.rows_read` from one production call, or from `--remote` EXPLAIN plus one measured call, at **today's** table sizes, together with the table's row count.
> 2. Multiply by the expected calls per day. **A poll counts as one call per interval for every hour a tab might stay open (assume 24 h), and per open tab and device.** Write the product into the release notes.
> 3. **Stop and re-design** if any of these holds: a single call is > 5,000 reads; a single query projects > 100,000 reads/day; the plan shows `SCAN` on a table > 10,000 rows (`entity_master`, `fund_holdings_monthly`, `instrument_entity_map`, the queue); or a poll runs while the tab is hidden.
> 4. **Re-measure after any bulk job that grows a scanned table** (the 25 Oct case: `entity_master` grew after 011 and the same poll cost more).
> 5. After release, the next day's Cloudflare D1 "top queries by rows read" view is checked once. **Any query > 10 % of the day's reads is logged to Ops as a `budget_risk` case.**

## Findings

### MUST-FIX before build

| # | Section | Finding | Fix |
|---|---|---|---|
| **M-1** | §4.2 CSP, RQ-2 | **The shell CSP would break the console.** (a) `style-src 'nonce-…' 'unsafe-inline'`: when a nonce is present, CSP2+ browsers **ignore `'unsafe-inline'`**, so all **145 inline `style="…"` attributes** in live `ma-ops.js` are blocked. (b) Live `ma-ops.js` has **6 inline `onclick="…"` handlers** (lines 531, 540, 604, 612, 688, 729), which `script-src` without `'unsafe-inline'` blocks. (c) `script-src https://navinmv81.github.io` admits every Pages repo of the account. | `style-src 'unsafe-inline'` with **no nonce** (the shell's own CSS inline, or as a `<style>` covered by that). Replace all inline handlers with `addEventListener` (the four refresh buttons stay; the two board/ledger buttons are removed anyway). Scope `script-src` to the path: `https://navinmv81.github.io/meridian-atlas/` + nonce. Add to AC-14: the console renders styled, with **0 CSP violations** in Chrome, Safari and Firefox. |
| **M-2** | Header BASELINE, §5.6, §9 | The spec is based on `ma-ops.js` `9687f759…` (795 lines). Live is **`f7332bb6…` (812 lines, 721d093)**: the hidden-tab poll pause (ML-1025-3) and `/api/ops-health` returning **null** enrichment fields. | Build from 721d093 and keep `_opsStartPoll`/`_opsStopPoll` + `visibilitychange`. Show null enrichment as "not shown since 26 Oct", never "0 enriched · 0 pending" (the MON26 cosmetic note). Add a test that a hidden document stops the poll. |
| **M-3** | §5.6, §8 | In the console shell the Health tab would poll `/api/ops-health` (491 reads per call) every 10 min while the console tab is open. That is the 25 Oct pattern again, with a second tab next to the terminal. | **Console mode:** the Health poll runs only while the Health tab is the active tab **and** the document is visible. Admin tabs (the default Cases tab) never start it. Add a test. |
| **M-4** | §5.2, §5.4, §6.1 | The forms don't match the server's required fields. | (a) **A note is required** for comment, set severity, resolve, dismiss and reopen (block submit client-side with the server's wording). (b) Assign: the role select uses exactly `cases.js ROLES` (8); assignee is an email or `service:<name>`; at least one is required. (c) `member_update` sends **`expected_member_status`** from the last read (004 AC-9). (d) Protected reopen sends `founder_supersession: {reference, decided_at}` (ISO date). (e) Dismiss `duplicate` requires an `EXC-`/`DQ-` ref of the same kind. |
| **M-5** | §4.4, §6.3 | The response map is missing live codes and transport failures. | Add these rows: **200 `replay: true`** → "Already saved"; **409 `stale_expected_status`** and **`not_applied`** → the existing "changed since you opened it" copy with an auto re-read; **409 `dq_actions_arrive_with_ma_oct_004`** → "DQ actions are not live yet"; **400 `csrf: …`** → "Console error, reload the page"; **503 `cases_disabled`** / DQ 503; **500 `internal error`** and **any non-JSON or HTML 5xx** → "Ops is unavailable (HTTP n). Nothing was changed unless the list shows it; Refresh." In `data_opsAdmin`, use `redirect: 'manual'` and treat `response.type === 'opaqueredirect'` (or 401) as "Your sign-in has expired", so it is never confused with being offline. |
| **M-6** | §14, §15 | The calendar no longer fits as written (§5 above). | Re-plan §14 to Option C. **Fri 30:** build the never-cut core (Cases + DQ list, detail, actions; transport; mapping; tests 1–3; shell route + test 4); Fleet and New case are pre-cut. **Sat 31:** one `meridian-ops` deploy (shell), **alone** in its slot, not adjacent to 002b. The shell checks `window.OPS_CONSOLE_SUPPORTED` (set by the new `ma-ops.js`); if it is absent it shows "The console arrives with the 2 Nov release" and loads nothing else. Founder **pre-UAT on `wrangler dev`** (test 3) the same day. **Mon 2:** Pages release → production UAT AC-1 – AC-14, before the 013 run or after it, never during. If UAT fails: revert the `docs/` commit, `wrangler rollback` `meridian-ops` to the recorded version, and go live on Tue 3 with the old dashboard (cases via the token). Record that fallback as the go-live exception. |

### NOTES

| # | Section | Note |
|---|---|---|
| N-1 | §4.2, RQ-1 | **15/15 with 0 headroom.** 004 §8.1 says "005 must not add Worker routes"; the Founder's Q1 (Option B) supersedes that. The Main Lane should record it so the two specs don't contradict. The next `meridian-ops` route needs a split or RQ-1's P2 fold of D-3 into the console. |
| N-2 | §0.6, §8 | Restate the day budget as ≈ 175k worst case (§3 above), not 30k / 50k. Both are inside the free tier. |
| N-3 | §5.1, §5.3 | The client always requests `limit=50`, never 100. At 100 with all 5 DQ statuses a call would read ≈ 505. |
| N-4 | §5.2 | C-1 returns at most 200 events (`LIMIT 200`). Show "first 200 events" when 200 come back. |
| N-5 | §4, §5.4 | Add a confirm step for force-resolve, protected reopen and member → fixed. Show a hint on `set_severity` to sev1/sev2 ("this will notify"). Before 004 is live (Thu 29), the DQ tab shows the 004 card, not errors. |
| N-6 | §4.2, AC-14 | Keep the console route human-only. AC-14 adds: a service token gets 403 before D1; the shell response has 0 D1 reads. |
| N-7 | §4.2 | The shell loads only `ma-data.js` and `ma-ops.js`. Confirm nothing in them needs `index.html`'s CSS variables, fonts or other globals (`_escapeHtml` is defined in `ma-ops.js` ✔). `connect-src` must list every host `ma-data.js` calls from the console views (self, `meridian-proxy`, `meridian-control`). |
| N-8 | §6 checklist | The per-query read watch (§6 above) applies to 005's release too: one measured call each for E-1, C-1, D-1, DQ C-1 and Fleet, recorded at the Sat 31 / Mon 2 checks (AC-11). |

## Answers to the review questions

| # | Ops answer |
|---|---|
| **RQ-1** | **Accept.** The page route reads 0 D1 and is Access-gated under the existing prefix; it brings the total to **15/15**. See N-1 for the headroom consequence. |
| **RQ-2** | **Accept with M-1:** `script-src` scoped to `/meridian-atlas/` + nonce; `style-src 'unsafe-inline'` **without** a nonce; no inline event handlers. Trusting GitHub Pages content in the admin origin is accepted (same as Option A), with the path scope reducing it. |
| **RQ-3** | **Not applicable** (Founder chose B). For the record, Ops would **not** accept `SameSite=None` on the admin cookie. |
| **RQ-4** | **Accept.** `actor_role` is a label; authority is the Access identity (`actor`), which the reviewer of 004 §7.5 checks. The select uses `ROLES`, defaults to **Founder**, and remembers only the operator's own last choice. |
| **RQ-5** | **Accept ≤ 1,000** with one measured call at build. If it is > 1,000, Fleet is cut (first in Q3's order). No query change in 005. |

## Verdict

**PASS WITH NOTES.** The design is operationally sound: no new query or table, every write goes through 003/004's guarded and audited transitions, the console is human-only and Access-gated, and the read budget is inside the free tier. **M-1 to M-6 are doc/build items for the 005 build brief.** No new Ops review is needed; the Main Lane does a hash check of a rev 0.1 or the build brief.
