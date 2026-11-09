# MA-NOV-P1.REVIEW2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Architect — fresh session via LANE_OPENER_v2.md
REVIEWED BY:  —
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.REVIEW2_Status.json
CONTROL:      claude/packets/MA-NOV-P1.REVIEW2_Control_v1.md
```

Check claims, do not accept them from the FIX2 report.

1. **Commit:** `git show --stat eb64d22` — exactly the 20 paths the FIX2 Task allowed (9 under `tools/factory/`, the draft, 10 pinned files); pinned hashes in `claude/packets/MA-NOV-P1.FIX2_Task_v1.md` §14 match the committed blobs; nothing outside `tools/factory/` and `claude/`. (FIX2's own run was begun by pre-FIX2 code, so its `run.json` has no commit check — this step replaces it.)
2. **Each original must-fix — closed or not, with evidence:**
   - **F1:** repeat the first review's commit experiments B, C, D, H and A in a temp repo against the new code, plus: commit without `allow_commits` → BLOCKED; HEAD rewound to a non-descendant → BLOCKED; the "committed unchanged pre-dirty file" acceptance cannot be used to commit a *changed* file.
   - **F2:** repeat the concurrent `begin` race (≥ 15 trials) — exactly one winner each time; orphan-lock retirement does not release a live lock.
   - **F3 (b):** Tower states LIVE / SNAPSHOT / RUNNING (snapshot) / STALE RUN are correct at their boundaries; "OFFLINE" no longer shown for idle.
   - **F4:** the generated Tower shows `LANE_OPENER_v2.md` and its true SHA-256.
   - **F5 + F9:** this run's own `begin` records your `CLAUDE_CODE_SESSION_ID` in the lease, `run` and `before.json` (check them before you `end`); `end` from a different session id is refused (temp repo).
   - **F6:** own-Status rev change between `begin` and `end` → BLOCKED.
   - **D1–D3:** draft §4 equals `tools/factory/lib/state.mjs` transitions exactly; §3.4 verdict-copy owner; DEPLOY_BRANCH patch line.
3. **Notes F7, F10, D4–D6:** closed or not (one line each).
4. **New findings** introduced by FIX2, if any (severity B / M / N).
5. **Tests:** run the suite; record counts.
6. **Acceptance checklist** (same five rows as the first review) — re-mark each, and state plainly: *can the Founder accept the pilot (yes / yes with notes / no)*, and what remains manual or assisted.

## Report — `claude/packets/MA-NOV-P1.REVIEW2_Report.md`
Four-line header; verdict; must-fix closure table; new findings; checklist; your session id; under ~1,000 words plus tables. Then `end` and stop.
