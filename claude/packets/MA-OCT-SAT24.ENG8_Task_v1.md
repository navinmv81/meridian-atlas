# MA-OCT-SAT24.ENG8 — Task v1 (immutable): Sat 24 go-live, part 2 (003)

**Start only after** LANE-1-ENG reports "A6 live" (MA-OCT-SAT24.ENG1 step 4).

Governing: your Sat 24 run sheet in `claude/packets/MA-OCT-003.BUILD_Report.md` (`1307bf3684f0cf8c32479f9a2bad49c4a15be384c5576a1283b7cf89fddeefba`); BREVA (`365464181ee7219cdadd1f917bd51770d078b2078422087fc485886270e1a0c1`) gates S-1..S-5 and the allowlist note; BREVD (`d630fe73b4510bbf5015d709854f3a18b73ac6a566dc3c8a196c0e25dd509e58`); ML-1021-3. Freezes (UTC) to avoid on Sat 24: 05:50–07:10, 07:55–08:05, 10:45–11:15, 16:45–17:15, 23:50–00:10.

**Main Lane confirmations:**
- **G-1 (written):** MA-OCT-011.RUN is CLOSED; no 011 batch can run (E-4 trigger and `ea-dropped.json` in place; the 011 window closed Sat 00:00Z). G-1 is met.
- **S-1:** A6 reviewed PASS (A6R) and committed (`7330a7f`); live once ENG1 reports.
- **ML-1023-1:** for this packet only, **you may commit your own 003 files by explicit path** (never `git add -A`) and push, after LANE-1-ENG's A6 commits. Nothing else.

Steps, per your run sheet:
1. Rebase onto A6 in a **separate worktree** from `origin/October-2026` (leave the shared checkout untouched); apply the **routes-only** diff (deploy 3). **S-3:** the deploy-3 tree must contain no sweep code and no sweep switches. Add the allowlist rejection of routes outside the four case routes (BREVA note) with a test. Run the full 003 suite + A6 test on the rebased tree.
2. **S-4:** commit the service-token var (Client ID from the Founder's `ops-script` token, created but **not** admitted) and the routes change; push.
3. Deploy 3 (`meridian-ops`), record versions; run your deploy-3 checks; the Founder blocks the old `/exceptions` app when you ask; then the Founder admits the token **only after** the allowlist checks pass; AC-2/AC-4 with the case the Founder picks.
4. M1/M2 per run sheet (render M1 with the commit id; ≈ 200 writes; V1–V4; 9/7/2 counts; protected pairs unchanged).
5. Watch the 17:00Z sweep: no `suppressed` / `gleif_checks` fields (S-3 proof). Deploy 4 (sweep) and deploy 5 (retirement) are **not** today (Mon 26).
Rollback per step by recorded version ids (S-5). Write `claude/packets/MA-OCT-SAT24.ENG8_Report.md`. Reply **"MA-OCT-SAT24.ENG8 reported"**.
