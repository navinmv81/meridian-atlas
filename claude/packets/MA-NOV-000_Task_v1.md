# MA-NOV-000 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-06T21:05Z
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG
REVIEWED BY:  Architect (fresh read-only session, on demand)
APPROVED BY:  Founder — Start Approval; architecture approval after the report
CONTROL:      claude/packets/MA-NOV-000_Control_v1.md  (sha256 in claude/packets/MA-NOV-000_Status.json)
```

Founder design direction (NML-1106-4): **one state system, reuse the existing Status JSON, no YAML queue**; one execution worker initially; independent review on demand; no model calls for dashboard refresh or idle readiness checks; the selected model stays unchanged; current admission, immutable hashes, board/Status ownership and review safeguards stay in force until the Founder approves changes.

## Q1 Baseline (short)
Branch, HEAD, origin, lock state, untracked files (names only). Confirm `November-2026` @ `a01ffe2`.

## Q2 Existing state system
1. Inventory `claude/packets/*_Status.json`: count, the set of keys used and how consistently (e.g. % with `state`, `control.sha256`, `task`, `report`, `usage_class`, `blocker`, `updated`). Note variants.
2. State names in use vs `Claude.md` v1.1 (READY, EXECUTING, REVIEW_NEEDED, DECISION_NEEDED, APPROVED, CLOSED, BLOCKED) and the spec's proposals (DRAFT, CHANGES_REQUESTED, PAUSED, CAPACITY_HOLD).
3. `STATUS_BOARD.md` vs Status files: list every packet whose board state differs from its Status file, and every October row still not CLOSED (the Main Lane counted 10). Recommend how each is reconciled; do not edit.
4. Other state copies: D1 `sprintboarditems`/`releaseledger` and the `meridian-control` board routes (from code only, no calls), the October HTML board, the Project `Sprint_Board.md` mirror. Recommend which become read-only legacy.
5. Recommend the minimal Status JSON additions for leases, run IDs, heartbeat, phase, pause/capacity hold, approval binding (scope + artifact revision hash) and resume state, with **one owner per field** (dispatcher / Main Lane / reviewer / Founder action). Show an example document.

## Q3 Worker launch
1. Is `claude` on PATH here; version; which non-interactive or headless modes, permission modes, tool allow/deny lists, working-directory and model flags its `--help` shows. How a launch would inherit the **current** model without naming or changing it.
2. What a dispatcher would need to start one bounded run (command line, prompt source = the Task file, log capture, exit code, where evidence lands), and how duplicate launch is prevented (lease file + run ID; atomic create/rename on this filesystem).
3. Cooperative stop and interruption: what is observable (exit code, heartbeat staleness) and what is not.
4. Label each step automatic / assisted / manual, and *unproven until pilot* where only help text supports it.

## Q4 Independent review launch
Same questions for a reviewer run: a separate session with its own context, reading Control + diff + evidence, writing only its review file. Can it use a separate git worktree or read-only mode? How independence is evidenced (separate run ID, session, no shared transcript).

## Q5 Control Tower (dashboard) and Founder actions
1. Options to build the HTML view **without model calls**: a script that projects Status JSON → `STATUS_BOARD.md` + one HTML file; refresh by file watch, LaunchAgent interval or manual run. Available runtimes (`node`, `python3` versions).
2. Serving: open a local file vs a localhost listener (bind 127.0.0.1); what each allows (auto-refresh, live heartbeat). Whether a published Claude artifact could show it (it cannot read local files — state the consequence).
3. Founder actions (start, approve, reject, pause, resume): options — (a) Founder tells the Main Lane, which writes the decision record (assisted); (b) a localhost endpoint with a per-session token and revision binding; (c) the Founder edits/creates a signed decision file. For each: stale/duplicate-action rejection, approval bound to the exact revision, no secrets in client HTML. Recommend one for the pilot.
4. Stale/offline display: heartbeat source, thresholds, and what the page shows when the generator itself has stopped.

## Q6 Write ownership and precedence
1. Reconcile `Claude.md` v1.1 "Main Lane sole writer of board and Status files" with a dispatcher that writes lease/heartbeat fields: propose the exact rule text for v1.2 (draft only, in the report).
2. Instruction precedence: Project Instructions, `Claude.md` v1.1 (Project only), repo `CLAUDE.md`, `.claude/settings.local.json`, the November documents. Note that macOS's default case-insensitive file system cannot hold both `Claude.md` and `CLAUDE.md` in one folder — check and recommend how v1.2 lives on disk without overwriting the repo `CLAUDE.md` (Kit §4).
3. List the repo `CLAUDE.md` lines now stale (branch line, Current Sprint Packet, others found).

## Q7 Usage and capacity
What, if anything, can be read legitimately about usage on this machine without credentials; otherwise recommend the manual capacity-hold entry (field, who sets it, how the Tower shows it).

## Q8 Pilot proposal
One small doc/local-test pilot with no production change, within NML-1106-4. The Main Lane's starting suggestion: *generate the November board and the Control Tower HTML from Status JSON, and archive the October board*. Confirm or replace it, and list the tests it must show: invalid transition, duplicate launch, stale approval, scope violation, pause, interrupted worker, capacity hold, record-update interruption, stale/offline display.

## Report — `claude/packets/MA-NOV-000_Report.md`
Four-line header; then:
1. Answers Q1–Q8, each with evidence (command + one-line result, or path:line) or *unknown + what would settle it*.
2. **Handoff table:** dispatch → worker start → evidence → review start → verdict → Founder gate → record update → next readiness; columns: mechanism, label (automatic/assisted/manual), proven/unproven, risk.
3. Recommended architecture in ≤ 15 lines.
4. Founder decisions needed (≤ 5), each with options and a recommendation.
5. Non-actions and any deviations.

Keep the report under ~1,500 words plus tables. Stop after writing it.
