# MA-NOV-P1.REVIEW4 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-11
EXECUTED BY:  Architect — fresh session via LANE_OPENER_v2.md
REVIEWED BY:  —
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.REVIEW4_Status.json
CONTROL:      claude/packets/MA-NOV-P1.REVIEW4_Control_v1.md
```

Light review: check claims with small experiments; keep the report short.

1. **Commit:** `git show --stat f215681` — changes only under `tools/factory/`, `claude/governance/`, `CLAUDE.md` and the pinned `claude/` files listed in the FIX4 Task (committed blobs = pinned hashes); nothing in `App/`, `docs/`, `13F Seed/`; origin `November-2026` = `f215681`.
2. **H1:** in a temp repo — create a branch and finish on it → BLOCKED "branch changed"; push a new branch's remote ref with `allow_commits` → BLOCKED; `before.json` without `start_branch` → `branch_check: "unavailable"`; confirm this run's own `before.json` records `start_branch`.
3. **H2:** `closure_by` with `../x`, lowercase, or a non-CLOSED packet → refused; a valid CLOSED id → accepted.
4. **v1.2 install:** `claude/governance/Claude_md_v1.2.md` has the APPROVED header, the three updates (CHANGES_REQUESTED→APPROVED path; guard table incl. H1; record kinds incl. founder-request and plan) and Q2 yes / Q3 no / Q4 yes / Q5 yes; the draft `Claude_md_v1.2_amendments.md` is unchanged.
5. **CLAUDE.md patch:** `git diff 37ad1c2 f215681 -- CLAUDE.md` touches only the lines the Task lists plus the pointer line; line 27's VERIFIED claim matches `pwd`, `git branch --show-current`, `git remote -v` now; the cron line carries "(not re-verified in November)"; no other facts changed.
6. **Tower:** render from a temp copy; compare with `claude/factory/design/interim-tower-reference.html` — header badge, *Waiting for you* (open founder-requests), work columns (records excluded), *Start a run* with the fixed line and Copy, *Path*, *Handoffs*, *November scope*, *Recent runs*, *Recent decisions*; no network references (grep for `http`, `<link`, `@import`, `src=`).
7. **Tests:** run the suite; record counts (expect 48).
8. **New findings** (B / M / N), if any.

## Report — `claude/packets/MA-NOV-P1.REVIEW4_Report.md`
Four-line header; verdict; one closure table (item, closed?, evidence); new findings; **recommendation: may FIX4 close (yes / yes with notes / no)**; your session id; under ~600 words. Then `end` and stop.
