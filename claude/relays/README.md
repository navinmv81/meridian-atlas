# Relay mailbox (from 8 Oct 2026)

**Why:** chat relays were costing the Founder too much copy-paste and causing out-of-order instructions.

**How it works**
1. The Main Lane writes each lane's next instruction to `claude/relays/<LANE>_NEXT.md`. One file per lane, always the **current** instruction; it replaces anything sent earlier.
2. The Founder pastes **one line** into the lane: `Read claude/relays/<LANE>_NEXT.md and do it.`
3. The lane writes its reply to `claude/relays/<LANE>_REPORT.md` (overwrite) and tells the Founder one line: `<LANE> reported`.
4. The Founder tells the Main Lane one line: `<LANE> reported` (or `check reports`). The Main Lane reads and verifies the report from disk, logs it, and rewrites the NEXT files.
5. A NEXT file that says **"Nothing to do"** means the lane waits.

**Rules unchanged:** rule 6 (no git writes from the Cowork bridge), rule 7 (these files are committed by the next lane that commits), rule 8 (Main Lane updates Board, Ledger and Decisions Log together). Executors never review their own work. Rulings made in a lane go in the REPORT under "Rulings".

**Lanes:** LANE-1-ENG (Claude Code, Engineering Lead, D1 reads), LANE-1-OPS (Cowork, Operations Lead), LANE-2 (Cowork, 002 spec), LANE-6 (Claude Code, Data-Identity Lead), LANE-7 (Cowork, 007 spec), LANE-8 (Cowork, 008 spec), LANE-11 (Cowork, 011/013 spec), REVIEW-A (Cowork, fresh independent Architect + ETF PL session).

**From 9 Oct:** every NEXT file starts with a session opener, so the Founder's one line works in a fresh or an existing session. The Main Lane gives the Founder only the one line plus a one-sentence summary.
