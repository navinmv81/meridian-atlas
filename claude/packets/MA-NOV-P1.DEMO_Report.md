# MA-NOV-P1.DEMO — Bracketed interactive run: Claude.md v1.2 amendments draft — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v2 5a9934fd…b3b4, Task v2 91bdfcb4…ce7c
EXECUTED BY:  Engineering Lead (documentation) — interactive Claude Code (desktop app, fresh session), run r-20261107T095946Z-3762, 2026-11-07
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (separate session, not yet run)
APPROVED BY:  Founder — Start Approval 2026-11-07T09:46Z ("approve MA-NOV-P1.DEMO"), bound to the v2 hashes
```

## Start
- The `LANE_OPENER_v2.md` SHA-256 `67913343…71d6` matched the fixed line.
- No `.git/*.lock` files were present.
- This was the session's first packet.
- `dispatch.mjs check` reported `eligible: [MA-NOV-P1.DEMO]` and `running: []`. There was one warning, which does not affect an interactive run: "no complete run_profile — headless dispatch run would refuse".
- `begin` printed `BEGIN MA-NOV-P1.DEMO run r-20261107T095946Z-3762`.
- The Control and Task SHA-256 values on disk matched the Status file.

## Files read
- `claude/packets/LANE_OPENER_v2.md` (procedure), `claude/packets/MA-NOV-P1.DEMO_Status.json`, `claude/packets/MA-NOV-P1.DEMO_Control_v2.md`, `claude/packets/MA-NOV-P1.DEMO_Task_v2.md`
- `claude/packets/MA-NOV-000_Report.md`: header, §Q2, §Q6 and §Q7 (lines 1–99 and 146–175)
- `claude/November_Decisions_Log.md`: grep for NML-1106-4, NML-1106-8 and NML-1107-1
- `claude/packets/LANE_OPENER.md`
- `tools/factory/README.md`
- `CLAUDE.md`: lines 5, 27, 28, 44, 48, 75, 79 and 100 (first 260 characters of each)
- `claude/meridian_atlas_agentic_delivery_factory_operating_kit.md`: §2, §5, §7 and §8

## Files written
- `claude/governance/Claude_md_v1.2_amendments.md`
  - About 2,140 words by `wc -w`, including table pipes and markdown. The prose is about 1,800 words, which sits at the Task's "~1,800" ceiling.
  - SHA-256 `081c2d56ca9a460e34dd3410d57f6468b41a475a945e5368fd5efd9ee8083f33`.
  - The `claude/governance/` directory did not exist before. Writing the file created it.
- `claude/packets/MA-NOV-P1.DEMO_Report.md` (this file).

## Could not do / notes
1. **State transitions.** Neither the README nor §Q2.2 defines the transitions for the four added states (DRAFT, CHANGES_REQUESTED, PAUSED, CAPACITY_HOLD). They define only the names and the three dispatcher transitions. The Main Lane transitions in draft §4 are therefore proposals, and Open question 1 in the draft asks the Founder about them. `tools/factory/lib/state.mjs` might encode them, but that file is not on the Task's read list, so it was not opened.
2. **Cron capacity (CLAUDE.md:44).** The capacity count was not re-verified, because that needs a Cloudflare API call and the Control prohibits network access. The proposed patch marks the line as unverified.
3. **Duplicate kit file.** A second, untracked copy of the operating kit sits at the repository root. The Task names the `claude/` copy, which is the one read. The two copies were not compared.
4. **Command quirk.** The opener's literal `ls .git/*.lock` errors under zsh when nothing matches ("no matches found"). That error means no lock is present, and the check was read that way.
5. **Edits outside scope.** None. `CLAUDE.md`, the Status files, the board, the Tower and the LANE_OPENER files were not edited. No git writes, network calls, D1 access or subagents were used.

## Stop
Stop gate reached. Next step: `dispatch.mjs end MA-NOV-P1.DEMO`, then the independent review (MA-NOV-P1.REVIEW).
