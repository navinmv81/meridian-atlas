# MA-OCT-SAT31.ENG4 — Task v1 (immutable): Sat 31: 005 Operator console deploy (+ the 004 `dq_since` one-condition fix)

Governing: 005 spec rev 0 `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6`; Ops review `39b707ff7aab0a8ec4eb625f3bfe1b00c07aebfca2102705dccbc15bc24c496c`; 005.BUILD report `b165d238dba5ec2a0fc51a2cae68a910321ef1e1c900f8c13986d050c4df9e40`; 004.GOLIVE report `e280d367a15bb97acf8a5ebce83e74a37799db1dd3202a665865e1b965a4a20e` (004 live `e8b81bf9`; `dq_since` late-start defect).

Do (any time Sat outside freezes):
1. Rebase the 005 tree onto current `origin/October-2026` (004 `df4066c` and later); resolve the four keep-both hunks; add the **`dq_since` fix** (accept the `end` row too) with a test that fails on the old code. All Ops + 007 suites green; endpoints **15/15**. Commit by explicit path; push.
2. Record live `e8b81bf9` (rollback) → one `meridian-ops` deploy → smoke: `GET /api/ops/admin/console` → Access redirect without session, 403 for a service token, 200 page with CSP header signed in (ask the Founder to sign in only if needed — prefer checks that do not need it); D-1 list unchanged; sweep after deploy carries `dq_new`/`dq_since` correctly; `d1-today`.
3. The console page shows "arrives with the 2 Nov release" until the site release. Tell the Founder **"005 live — <version>"**.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (`5b3400c03eba2fcf7026f72a4dc37aa5d2ded17a0cdc45599dc895c381f36791`; no A2 window any more). One production change at a time across lanes, announced with UTC time; check the other Sat lane's report for an open change first. Production steps end by 23:45Z. ML-1024-1: never read secret-file contents. ML-1013-3. Explicit-path staging only (you commit your own files, `pull --rebase`); never `git add -A`; never `September-2026`. Own worktree only. D1 writes guarded, batched, three-point check first.

Write `claude/packets/MA-OCT-SAT31.ENG4_Report.md`. Reply **"MA-OCT-SAT31.ENG4 reported"**.
