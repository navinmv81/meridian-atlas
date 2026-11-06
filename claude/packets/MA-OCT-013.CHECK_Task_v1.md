# MA-OCT-013.CHECK — Task v1 (immutable): Architect delta check — 013 spec rev 1 + build (PASS needed by 17:00Z Thu 5)

Governing: `claude/MA-OCT-013_Spec.md` **rev 1** (hash in `claude/packets/MA-OCT-013.SPEC1_Report.md`); 013.BUILD report; the Architect, Ops and ETF reviews of rev 0. **Start when `MA-OCT-013.BUILD_Report.md` exists.**

Check that every MUST-FIX (Arch M-1..M-7, Ops M-1..M-6, ETF M-1..M-2) is closed in the spec **and** in the code; re-run the 013 tests and the dry run yourself; try to break the CAS guards and the dangling-reference guard; confirm the run sheet (cap, remainder rule, kill switch, restore). Verdict PASS / PASS WITH NOTES / FAIL and whether the run may start Thu 5. **Hard stop (ML-1104-2): no PASS by 17:00Z → 013 does not run in October.**

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`. `claude/relays/FREEZES.json` (Thu 5: 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10 UTC). **One production change at a time** across lanes (announce with UTC time in your report; check the other Thu lanes' reports first). Production steps end by 23:45Z. ML-1024-1; ML-1013-3. Explicit-path staging only (commit your own files, `pull --rebase`); never `git add -A`; never `September-2026`. Own worktree only. D1 writes guarded, batched, three-point check first.

Write the delta check and `claude/packets/MA-OCT-013.CHECK_Report.md`. Reply **"MA-OCT-013.CHECK reported"**.
