# MA-OCT-ENT-CR1.EXEC — Task v1 (immutable): run the Entities index change

**ISSUED BY:** Main Lane (Program Orchestrator), Mon 12 Oct · **EXECUTED BY:** LANE-1-ENG, Engineering Lead (Claude Code) · **REVIEWED BY:** Architect (close-out note) · **APPROVED BY:** Founder (GATE-1012 D4, 10 Oct)

Execute **`claude/MA-OCT-ENT-CR1_Index_Change_Request.md` rev 1** (`fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20`) **§6 steps 0–8 exactly**, with its execution rules (absolute-path wrangler 4.96.0, one statement per execution, one retry after 30 s on 10000/7403, then stop), its §7 rollback (RB-1 / RB-2) and its window: **Tue 13 Oct, start ≥ 08:05 UTC, finish by 10:30 UTC**; fallback Wed 14, same hours; never 17–23 Oct.

Step 0 evidence (already on file): Founder approval = GATE-1012 D4 (`claude/packets/GATE-1012_Decision.md`); Architect PASS WITH CONDITIONS applied in rev 1 (`claude/MA-OCT-ENT-CR1_Architect_Review.md` `bb99d7c0…d750`); **Operations Lead AR-1 exception = OPS-R4** (≤ 90k reads for C1, X-1..X-7; Decisions Log 9 Oct).

## Main Lane rulings that change the CR's gates (ML-1012-1 — `d1-today` lags 25–30 min, measured 12 Oct)
- **AR-2(a), before C1:** `d1-today` `rowsWritten` **≤ 25,000** (not 30,000; 5k margin for writes the lagging figure cannot show yet).
- **AR-2(b), before each DROP:** `d1-today` **plus every row this packet has written** (C1's measured `rows_written`, and C2's before C3) **≤ 35,000**. The reading alone will not show C1 for ≈ 30 min.
- Step 4's optional lag sample becomes **required**: `d1-today` at +1, +5, +15, +30 and +45 min after C1 (timestamped GETs, 0 D1 reads). Record when C1's writes first appear.

## Added to the after-set (ML-1010-4, for 007; read-only)
- **007 R7-7:** R2 on entity **28088** at `limit=25` and at `limit=100` (the 007 rev 1.4 R2 statement), after C1 is verified. Record `rows_read` for each (expected ≈ 60–410).
- **007 R7-2:** two PK reads for `CUSIP:000000000` (`instrument_master` and `instrument_entity_map`). Record whether each row exists.

## Report and handover
- Write `claude/packets/MA-OCT-ENT-CR1.EXEC_Report.md`: steps 0–8 with times, every plan before/after, `rows_read` / `rows_written` per statement, *N*ᵢₘ, ST, gate readings, the lag table, the 007 reads, the migration file and commit SHA, any RB taken.
- Say **"ENT-CR1 verified"** in the report's first line as soon as C1 + E1, E2, E4 pass (AR-3); C2/C3 may slip to Wed 14 or after 23 Oct without blocking that.
- Git: commit only the migration file(s) and the one-line note named in step 7, by explicit path, fast-forward, then push. The 011 build session in the same folder makes **no** git writes (ML-1012-2), so this lane is the only committer.
- Stop after step 8 and reply one line: **"MA-OCT-ENT-CR1.EXEC reported"**. The 002a Tue row starts only when the Founder says "continue" afterwards.
