# MA-OCT-005.BUILD — Task v1 (immutable): 005 Operator console — build (local), Option B

Governing: `claude/MA-OCT-005_Spec.md` rev 0 `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6`; Ops review `claude/MA-OCT-005_Ops_Review.md` `39b707ff7aab0a8ec4eb625f3bfe1b00c07aebfca2102705dccbc15bc24c496c` (6 MUST-FIX, binding); Founder: **Option B** (console served by `meridian-ops` in its own tab), Sprint Board / Release Ledger read-only in October, cut order Fleet → New case → DQ member edits (Cases + DQ triage never cut).

Do (local only):
1. New worktree from your 004 build tree (004 is not yet live; rebase onto the 004 go-live commit later). Start from `721d093`'s `ma-ops.js` (hidden-tab pause, null enrichment fields — Ops M-2).
2. Build Cases + DQ Tickets tabs (and Fleet only if time), every write with CSRF header + request id, ≤ 500 rows per read, no polling; remove the dead Sprint Board / Release Ledger buttons; add the **one** console route on `meridian-ops` → endpoints **15/15** (report the count). Fix the "Entity Enrichment 0/0" wording (ML-1026-1 note).
3. Tests (contract + front-end fixture tests answered by the real Worker on a local D1), must fail on the pre-005 tree; three-point check; a Sat 31 deploy run sheet (after 004 is live) and a commit list.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (incl. the A2 window Fri 30 08:05Z → Sun 1 00:10Z for other Entities writers; 23:50–00:10Z daily). One production change at a time across lanes, announced with UTC time. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`. Own worktree only, never the shared checkout.

Write `claude/packets/MA-OCT-005.BUILD_Report.md`. Reply **"MA-OCT-005.BUILD reported"**.
