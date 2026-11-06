# MA-OCT-013.RUN — Task v1 (immutable): 013 run on Thu 5 (≥ 18:15Z) — gated on CHECK PASS + the Founder's run approval

Governing: `claude/MA-OCT-013_Spec.md` **rev 1** (hash in `claude/packets/MA-OCT-013.SPEC1_Report.md`) run sheet as committed by 013.BUILD; 013.CHECK verdict; Founder run approval on this packet's STATUS_BOARD row ("013 run Thu 5, cap 33k, account ≤ 70k").

**Preconditions (stop if any is missing):** CHECK = PASS or PASS WITH NOTES saying the run may start; Founder approval on the board; 002b deploy not mid-change; `d1-today` written + 1.05 × planned ≤ 70k.
Do: run exactly the committed run sheet (index preconditions → batches up to the cap → read-backs → recon); stop at a batch boundary on any guard miss, the cap, or 23:30Z; record the remainder (rest → first November item). Post-run: ETF exposure spot check per ETF M-1..M-2; 007 redirect check on 5 merged ids. Tell the Founder **"013 done — <merged>/<planned>"**.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`. `claude/relays/FREEZES.json` (Thu 5: 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10 UTC). **One production change at a time** across lanes (announce with UTC time in your report; check the other Thu lanes' reports first). Production steps end by 23:45Z. ML-1024-1; ML-1013-3. Explicit-path staging only (commit your own files, `pull --rebase`); never `git add -A`; never `September-2026`. Own worktree only. D1 writes guarded, batched, three-point check first.

Write `claude/packets/MA-OCT-013.RUN_Report.md`. Reply **"MA-OCT-013.RUN reported"**.
