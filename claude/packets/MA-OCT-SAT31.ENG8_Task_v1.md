# MA-OCT-SAT31.ENG8 — Task v1 (immutable): Sat 31: 008 R-4 move (NextEra remarketing) → open the bond serving gate

Governing: `claude/MA-OCT-008_AC12_Readjudication.md` `8c306b726ee7342a3293983d085bd12557228010a695a53ddb621b27e290c832` §7 (R-4 move list, signed) and §8 (gate-opening statement, read-back, kill switch); 009 spec rev 1 §4; Founder: **"R-4 move"** (30 Oct, ML-1030-3) and the gate acknowledgement recorded on this packet's STATUS_BOARD row.

**Preconditions (stop if any is missing):** (a) LANE-1-ENG's FRI30.ENG1 report shows the 009 deploy live with the gate **closed** and the closed-gate smoke passed; (b) the STATUS_BOARD row for this packet shows the Founder's gate acknowledgement.

Do:
1. **R-4:** move `0001193125-25-169329` (NextEra Energy Capital, 1 row) to whole-filing `skipped_other` per 008 §7.3 rule 1 — guarded statement (`changes` must equal the expected count), read-back, rollback SQL saved under `bonds/state/`.
2. **Gate:** run §8's statement exactly (evidence string with full SHA-256s), `changes = 1`, read-back. Then smoke as an anonymous reader: F1 for PepsiCo Inc 1457 shows its bonds (not the 4 Singapore rows); R1 for `CA00206RNL29` now returns the `sec_bond` candidate; the cache proof (M-6) on two identical requests — record `x-fi-cache`. Any wrong row → run the §8 kill switch at once and report.
3. Tell the Founder **"bonds live"** with the gate `changed_at`.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (`5b3400c03eba2fcf7026f72a4dc37aa5d2ded17a0cdc45599dc895c381f36791`; no A2 window any more). One production change at a time across lanes, announced with UTC time; check the other Sat lane's report for an open change first. Production steps end by 23:45Z. ML-1024-1: never read secret-file contents. ML-1013-3. Explicit-path staging only (you commit your own files, `pull --rebase`); never `git add -A`; never `September-2026`. Own worktree only. D1 writes guarded, batched, three-point check first.

Write `claude/packets/MA-OCT-SAT31.ENG8_Report.md`. Reply **"MA-OCT-SAT31.ENG8 reported"**.
