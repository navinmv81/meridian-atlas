# MA-OCT-005.REVO — Task v1 (immutable): Operations review of the 005 Operator console spec rev 0

Review `claude/MA-OCT-005_Spec.md` rev 0 as **Operations Lead**. Answer the spec's review questions addressed to Ops, and check:
1. Each of the seven case actions and the DQ actions matches the live 003 routes (commit `76f4261`) and the 004 spec rev 1 (CSRF header, request id, replay/409 behaviour, actor attribution).
2. **Option B** (console served by `meridian-ops` in its own tab): count the `meridian-ops` routes in `origin/October-2026:App/Ops/src/ops-api.js` today, add 004's routes and 005's console route, and confirm the total stays **≤ 15** (the endpoint cap). Note Access app coverage for the new path.
3. Read budget: ≤ 500 rows per call, no polling — confirm against indexes; worst case per day.
4. Operational safety: what an operator can break; protected-reopen fields; failure states (401/403/5xx) shown clearly.
5. Fit to the new dates: 004 live Thu 29; 005 build Fri 30; 005 deploy Sat 31; site release Mon 2 Nov.
6. Add a **per-query read watch** item for the Pre-Refresh Checklist (lesson from the 25 Oct D1 incident, ML-1025-3).

**Inputs (verify SHA-256 before reading; stop on mismatch):**
- `claude/MA-OCT-005_Spec.md` rev 0 `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6`
- `claude/MA-OCT-003_Spec.md` `7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2`
- `claude/MA-OCT-004_Spec.md` rev 1 `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379`
- **Code:** read live code from git, not the shared working copy (it holds stale uncommitted 003 copies): `git --no-optional-locks show origin/October-2026:<path>` at **`721d093`**.

**Founder decisions already taken (do not re-open; check the spec against them):**
- Q1 **Option B**: the console runs in its own tab, served by `meridian-ops`.
- Q2 yes: Sprint Board / Release Ledger read-only in October; buttons return in November with the `meridian-control` CSRF fix.
- Q3 yes: cut order Fleet tab → New case form → DQ member edits; Cases and DQ triage are never cut.

**Plan changes since the spec was written (check the spec still works):**
- Option C (ML-1025-5): go-live **Tue 3 Nov**; last production change **Mon 2 Nov**.
- 004 goes live **Thu 29**; 005 build Fri 30; one `meridian-ops` deploy Sat 31; front end in the **Mon 2 Nov** site release (Pages serves `September-2026/docs` today, ML-1026-1).
- `/api/ops-health` (on `meridian-proxy`) changed Mon 26 (commit `721d093`): no `entity_master` scan; enrichment fields now null; `ma-ops.js` pauses polling while hidden. The 005 design must keep this.

**Rules:** doc-only review lane (Cowork). **No D1 calls, no deploys, no git writes**, no secrets (ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`). Write only the two files named below. Keep it short: findings with severity (BLOCKER / MUST-FIX before build / NOTE), each tied to a spec section, plus a verdict **PASS / PASS WITH NOTES / FAIL**.

**Outputs:** `claude/MA-OCT-005_Ops_Review.md` and `claude/packets/MA-OCT-005.REVO_Report.md` (verdict, findings count by severity, output SHA-256). Reply **"MA-OCT-005.REVO reported"**.
