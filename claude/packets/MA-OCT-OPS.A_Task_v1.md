# MA-OCT-OPS.A — Task v1 (immutable): Ops option A — all Ops views behind the signed-in console (follow-up site release)

Governing: Founder "Ops option A" (31 Oct, ML-1031-4); 005 spec rev 0 `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6` and Ops review `39b707ff7aab0a8ec4eb625f3bfe1b00c07aebfca2102705dccbc15bc24c496c` (Option B console, CSRF, no polling, ≤ 500 rows); 005 live `meridian-ops` `1109edb6`; site live from `October-2026` /docs (MA-OCT-REL.SITE). **Run only when the Founder says "run Ops A"** (usage-dependent: Mon 2 or after 013/002b).

Goal: the public terminal has **no anonymous Ops panel**. The OPS button opens the signed-in console (`/api/ops/admin/console` on `meridian-ops`) in a new tab, and the console holds **all** Ops views: Cases, DQ Tickets, System Health, Drift & Budget, Events, Sprint Board (read-only) and Release Ledger (read-only).

Do:
1. Worktree from `origin/October-2026`. Move the five read-only views into the console page (same `ma-ops.js` code where possible; keep the hidden-tab poll pause and "no polling" for Cases/DQ). Remove the public Ops panel and its tab bar from the terminal; the OPS button becomes a link to the console. **No new `meridian-ops` route** (stay 15/15). A `meridian-ops` deploy only if the console shell itself must change (record rollback `1109edb6`).
2. Tests: terminal has no Ops panel and the OPS link targets the console; console renders all seven tabs; existing Ops/005/007/009-010 suites green; new tests fail on the current tree. Headless Chromium at 1280 and 375 px on the console (signed-in checks may need the Founder) and on the terminal home (no console errors, no CSP violations).
3. Release: `node generate-docs.mjs`, commit `docs/` + sources by explicit path, push; Pages rebuilds from `October-2026`. Verify live. **Rollback:** `git revert` of this packet's commits on `October-2026` (Pages rebuilds) and, if deployed, `wrangler rollback` to `1109edb6`.
4. Note (do not fix here): the read-only Ops GET routes stay publicly reachable — logged as a November security item (lock behind Access).

Standing rules: no D1 writes; ML-1024-1; ML-1013-3; explicit-path staging only; never `September-2026`; own worktree; one production change at a time; production steps by 23:45Z.

Write `claude/packets/MA-OCT-OPS.A_Report.md`. Reply **"MA-OCT-OPS.A reported"**.
