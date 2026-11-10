# Claude.md v1.2 — standing amendments to v1.1

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — MA-NOV-P1.DEMO Control v2 5a9934fd…b3b4, Task v2 91bdfcb4…ce7c
EXECUTED BY:  Engineering Lead (documentation) — interactive Claude Code, run r-20261107T095946Z-3762, 2026-11-07
REVISED BY:   Engineering Lead — MA-NOV-P1.FIX2 (rev 2, run r-20261107T202556Z-a368, 2026-11-07);
              Engineering Lead — MA-NOV-P1.FIX4 (installed copy, run r-20261110T175937Z-9ac0, 2026-11-10)
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (PASS_WITH_NOTES, report 7677ad1d…cb99); MA-NOV-P1.REVIEW2; installed copy → MA-NOV-P1.REVIEW4 (light)
APPROVED BY:  Founder — 2026-11-10 06:51, "approved with updates", install in P1.FIX4 (NML-1110-1)
STATUS:       APPROVED — Founder 2026-11-10 06:51 (NML-1110-1); amends Claude.md v1.1 (Project)
```

**What this file is.** The approved standing amendments to `Claude.md` v1.1 (Project governance). It was built from the draft `claude/governance/Claude_md_v1.2_amendments.md` (rev 2, sha256 `f27acbcd…`), which stays on disk unchanged as history. The Founder approved rev 2 **with three updates**, all applied here:

- **(a)** §4 adds the follow-up closure path `CHANGES_REQUESTED → APPROVED` (Main Lane only, with `closure_by` naming a CLOSED follow-up packet; the id is validated).
- **(b)** §3.9 and §5.5 describe the run guards: commit, every-commit, ref, start-branch, transitions-log, global-lock and session guards (G1–G5, H1).
- **(c)** §2.8 adds DRAFT record kinds — outcome, carry-over, founder-request and plan records. Each has a `kind`, write owner NONE, and is never runnable.

The Founder's answers to the draft's open questions (Q2–Q5) are recorded in place of the questions (end of file). Only the v1.1 sections that change are listed. Every other v1.1 section stays as written.

---

## 1. Usage Model (precedence)

**v1.1 (summary):** precedence is decision log > release context > this file > archives.

**v1.2 text:**
1. When two sources conflict, the higher one wins:
   1. A Founder decision record (decision-log row, or `decision{}` / `start_approval{}` in a Status file).
   2. The packet's Control and Task, bound by SHA-256.
   3. `Claude.md` (Project governance, as amended by this file).
   4. Repository `CLAUDE.md` (environment truth only).
   5. The November spec and the operating kit (design intent, not permission).
   6. `.claude/settings*.json` (a harness enforcement layer, not a source of authority).
   7. Archives.
2. A permission that exists in only a lower layer, such as a settings pre-allow, grants nothing unless a higher layer also grants it.
3. **On disk,** v1.2 lives at `claude/governance/Claude_md_v1.2.md` (this file). The volume is case-insensitive APFS, so a file named `Claude.md` cannot sit beside `CLAUDE.md`. No session may create, rename or overwrite the repository `CLAUDE.md` in order to install this file. The repository `CLAUDE.md` carries one pointer line to this file (added by MA-NOV-P1.FIX4).

**Source:** MA-NOV-000 Report §Q6.2; NML-1107-1 (5a, 5b).

---

## 2. Status Board

**v1.1 (summary):** `STATUS_BOARD.md` is the single source of truth. Its fields are Packet ID, State, Control version, Lane and tool, Write owner, Next gate, Blocker and Usage class.

**v1.2 text:**
1. The single source of truth for packet state is `claude/packets/<ID>_Status.json`. There is one state system, and it is not YAML.
2. `claude/packets/STATUS_BOARD.md` and `claude/factory/control-tower.html` are **generated projections** of the Status files. `node tools/factory/project.mjs` writes them, and nobody edits them by hand.
3. Run the generator after every Status write. Two runs on the same Status data may differ only in `generated_at`.
4. The generator refuses to overwrite a board whose first line is not its own generated title.
5. The October board is archived unchanged as `STATUS_BOARD_October_2026.md`.
6. Board columns keep the v1.1 field set. When a run is BLOCKED and the Main Lane's `blocker` field is empty, the Blocker column shows `run.blocked_reason`.
7. The D1 tables `sprintboarditems` and `releaseledger`, the October HTML board and the Project `Sprint_Board.md` mirror are **frozen legacy**. They receive no November writes.
8. **Record kinds (update c).** A Status file may hold a *record* instead of a packet. It sets `kind` to one of the values below, `write_owner: "NONE"`, and normally `state: "DRAFT"`. A record is **never runnable**: `dispatch.mjs check`, `begin` and `run` treat it as ineligible whatever its state or approval says. Records never appear in the work table or the Tower's work columns. The Main Lane writes them.

   | `kind` | Holds | Shown |
   |---|---|---|
   | `outcome` | November outcome: `requirements[]`, `dependencies[]`, `observations[]` | Tower *November scope*; board *November scope — outcomes* |
   | `carry-over register` | queued October carry-overs, same fields | as `outcome` |
   | `founder-request` | `request_type` (start \| decision \| note), `question`, `options[]` (optional), `reply` (the exact line to send), `due`, `status` (open \| answered \| withdrawn), `answer`, `answered_at` | open → Tower *Waiting for you* (with the reply line and a Copy button) and board *Waiting for the Founder*; answered or withdrawn → Tower *Recent decisions* |
   | `plan` | `milestones[{when, title, detail, status: done\|now\|next}]`, `handoffs[{step, today: automatic\|assisted\|manual, how, target}]` | Tower *Path* and *Handoffs* (one plan record) |

   A READY packet with no `start_approval` is also shown under *Waiting for you*, as a start approval with the reply `approve <ID>`.

**Source:** MA-NOV-000 Report §Q2.3, §Q2.4, §Q6.1; `tools/factory/README.md` (Day-to-day use); NML-1106-4 (3); NML-1110-1 (update c, Q2); `tools/factory/lib/eligibility.mjs` (`RECORD_KINDS`), `tools/factory/project.mjs`.

---

## 3. Write Ownership

**v1.1 (summary):** each file has one write owner, and the Main Lane is the sole writer of the board and the Status files.

**v1.2 text (per field, for `MA-NOV-*` and later packets):**
1. **Main Lane:** the sole writer of a packet's admission, approvals, decisions and holds, of every record (§2.8), and of every state transition except the three the dispatcher makes (item 2). It may write any field.
2. **Dispatcher:** may write only `lease`, `heartbeat`, `run`, `updated` and `updated_by`. It may change `state` only for three transitions: READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED. It never writes `blocker`. A run's BLOCKED reason goes in `run.blocked_reason`.
3. **`dispatcher-hold` (sole exception):** may write `hold` only. It is used only when a worker log shows a usage or quota-limit error, and it then writes `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", reason, at}`. Nothing else can be written through this path.
4. **Reviewer run:** writes only its own review file. The Main Lane copies the verdict into `review{}`. The dispatcher does not, because `review` is not a dispatcher field.
5. **Executing session:** writes only the paths in `run_profile.allowed_write_paths`. It never writes any `_Status.json`, the board, the Tower, `claude/factory/` files, the LANE_OPENER files or Main Lane records.
6. **How every Status write is made:** a compare-and-swap on `rev`, then a temp file and `rename(2)`. A write that changes a field its writer does not own, makes a transition the table in §4 does not allow, or sees a mismatched `rev`, is refused: it throws and writes nothing, and it is not logged. Every successful write appends `{at, id, writer, from, to, rev}` to `claude/factory/transitions.jsonl` (append-only).
7. **Violations:** a raw edit to any Status file that leaves `rev` unchanged is a violation. So is a new Status file created while a run is active. During an interactive run, any change to the running packet's own Status (even through the state library) blocks the run; rev bumps on other packets are listed in the run record for Main Lane confirmation.
8. **Writer identity** passed to the state library is self-declared (an honour system). The dispatcher's scope check, not the library, is what catches a worker writing Status.
9. **Run guards (update b).** At `begin` (or headless `run`) the dispatcher records in `claude/factory/runs/<run_id>/before.json`: the git status snapshot, `head`, `start_branch` (`git symbolic-ref --short HEAD`, or `DETACHED`), every ref (`refs`), the size and SHA-256 of the transitions log (`transitions`), the Status revs, and the session id. At `end` the run is **BLOCKED** if any guard fails:

   | Guard | Rule at `end` | Recorded in `run.json` |
   |---|---|---|
   | Scope | every path changed in the working tree outside `allowed_write_paths` (and the dispatcher's own paths) is a violation | `scope_violations` |
   | Commit (F1) | new commits need `run_profile.allow_commits: true`; HEAD must descend from the start `head` | `commit_check`, `start_head`, `end_head` |
   | Every commit (G1) | the paths of **each** new commit (not just the net diff) join the scope check; a pre-dirty file is accepted only if committed byte-for-byte as it was | `committed_paths`, `committed_preexisting_unchanged` |
   | Refs (G2) | any new, moved or removed ref other than `refs/heads/<start_branch>` (and, with `allow_commits`, `refs/remotes/origin/<start_branch>`) → "ref changed: <ref>" | `ref_check`, `refs_changed` |
   | Start branch (H1) | the branch at `end` must equal `start_branch`, else "branch changed: <start> → <end>". A run that creates a branch and finishes (or pushes) there is caught by this and by the ref guard | `branch_check`, `start_branch`, `end_branch` |
   | Transitions log (G5) | the log's bytes at `begin` must be an unchanged prefix of the log at `end` (append-only) | `transitions_check` |
   | Session (F5, G4) | only the session that began the run may end it; if the lease has a session id, `end` without one is **refused** (nothing written) | `session_id`, `ended_by_session` |
   | Global lock (F2, G3) | one run at a time via `claude/factory/leases/.global.lock` (O_EXCL); an unparsable lock is retired only when its mtime is over 60 s old | — |

   A `before.json` from older code that lacks a field reports that guard as `unavailable` instead of blocking. Committed paths are always scope-checked.

**Source:** MA-NOV-000 Report §Q6.1 (rule text, tightened); `tools/factory/README.md` §Ownership (`dispatcher-hold`) and §Headless step 7; NML-1107-1 (4); MA-NOV-P1.FIX2 (F1, F2, F5), MA-NOV-P1.FIX3 (G1–G5), MA-NOV-P1.FIX4 (H1); `tools/factory/dispatch.mjs` (`finishRun`, `refChanges`, `currentBranch`).

---

## 4. Packet State Machine

**v1.1 (summary):** READY → EXECUTING → REVIEW_NEEDED → DECISION_NEEDED → APPROVED → CLOSED, with BLOCKED reachable from any state.

**v1.2 text:**
1. **Names:** keep EXECUTING (not RUNNING) and APPROVED (not ACCEPTED). Add four states: **DRAFT**, **CHANGES_REQUESTED**, **PAUSED** and **CAPACITY_HOLD**. **DRAFT** is used for records (§2.8) and for packets not yet admitted (Q2).
2. **Transitions** — exactly the table coded in `tools/factory/lib/state.mjs` (canonical, Founder decision D1). A write that leaves `state` unchanged is not a transition. Writer: **D** = dispatcher, **ML** = Main Lane.

   | From | Allowed next states | Writer | Trigger |
   |---|---|---|---|
   | DRAFT | READY | ML | admission complete (board row, Control and Task hashes, owner) |
   | READY | EXECUTING | D (or ML) | `begin` or `run`, with a valid `start_approval` and the lease taken |
   | READY | BLOCKED / PAUSED / CAPACITY_HOLD | ML | exception or hold, with `hold{}` (and `resume_state`) for a hold |
   | EXECUTING | REVIEW_NEEDED | D (or ML) | scope check and run guards pass, and the report is present |
   | EXECUTING | BLOCKED | D (or ML) | scope violation, failed run guard, no report, worker failure, expired or stale lease |
   | REVIEW_NEEDED | CHANGES_REQUESTED / DECISION_NEEDED / APPROVED | ML | reviewer verdict recorded |
   | CHANGES_REQUESTED | READY | ML | a new Control or Task version is issued and approved |
   | **CHANGES_REQUESTED** | **APPROVED** | **ML only** | **follow-up closure path (update a):** the same write sets `closure_by` to the id of a **CLOSED** follow-up packet whose review covered the requested changes. `closure_by` must match `/^MA-[A-Z0-9][A-Z0-9.-]*$/` (an id, never a path) and must differ from any earlier `closure_by`. Any other writer, a missing or invalid id, or a follow-up that is not CLOSED → refused |
   | DECISION_NEEDED | APPROVED / CHANGES_REQUESTED / BLOCKED | ML | Founder choice recorded |
   | APPROVED | CLOSED | ML | close-out |
   | CLOSED | — (terminal) | — | — |
   | BLOCKED / PAUSED / CAPACITY_HOLD | `hold.resume_state` if set, else READY (exactly one) | ML | hold or exception cleared |

   The code proves only that the `closure_by` packet exists and is CLOSED. Whether its review covered the requested changes stays a Main Lane judgment, recorded in the decision log.

   Not allowed: EXECUTING → PAUSED or CAPACITY_HOLD; DECISION_NEEDED → CLOSED; and BLOCKED from DRAFT, REVIEW_NEEDED, CHANGES_REQUESTED or APPROVED. The dispatcher may make only READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED.

   **`dispatcher-hold` writes only `hold`; the dispatcher sets BLOCKED first.** On a worker quota error the run goes EXECUTING→BLOCKED through the dispatcher, and only then is `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", …}` written. `dispatcher-hold` never changes `state`.
3. **What the dispatcher refuses:** it never launches a packet in PAUSED or CAPACITY_HOLD, a record (§2.8), or anything while a global `claude/factory/PAUSE.json` is set. It never reruns a BLOCKED packet automatically.
4. **Free text:** free-text decorations in a state field (e.g. "APPROVED (10 Oct…)") are not allowed. Put the detail in another field.

**Source:** `tools/factory/lib/state.mjs` (`TRANSITIONS`, `HELD_STATES`, `DISPATCHER_TRANSITIONS`, `DISPATCHER_HOLD_FIELDS`, `checkClosure`, `CLOSURE_ID_RE`); `tools/factory/dispatch.mjs` (`finishRun`: BLOCKED, then `hold`); Founder decision D1 (MA-NOV-P1.FIX2 Status, 2026-11-07T20:23Z); NML-1108-1 (closure path); MA-NOV-P1.REVIEW3 H2; MA-NOV-000 Report §Q2.2, §Q2.5; kit §7 (verdicts).

---

## 5. Admission Rule, extended: start approval and how a run starts

**v1.1 (summary):** a packet needs a board row, an immutable Control version with its SHA-256, a declared state, and one write owner (or NONE).

**v1.2 addition:**
1. **When a packet may run.** It may run only when its Status file carries `start_approval{by:"Founder", at, words, control_sha256, task_sha256, recorded_by:"Main Lane"}`. Both hashes must equal the Status `control.sha256` and `task.sha256` **and** the SHA-256 of the files on disk. No `_Report.md` may exist for it yet. A record (§2.8) never runs.
2. **Stale approvals.** An approval bound to superseded hashes is history (`previous_start_approval`), not consent.
3. **Interactive run (in use).**
   - The Founder opens a new Claude Code session and types the fixed line, which names `claude/packets/LANE_OPENER_v2.md` and its SHA-256.
   - The session first runs `node tools/factory/dispatch.mjs check`, then `begin <ID>`. It does no packet work before `BEGIN … run <run_id>` prints.
   - It always finishes with `end <ID>`, including when it stops early. With no report, `end` records BLOCKED.
   - One session runs one packet.
4. **Headless run (kept, not in use).** `node tools/factory/dispatch.mjs run <ID>` makes one bounded attempt with no retries. It needs a complete `run_profile` (`allowed_tools`, `permission_mode`, `allowed_write_paths`), a non-null `config.model` passed through unchanged, and a signed-in worker binary. Settings come from the project only (`--setting-sources project`), and tools are limited with `--tools` and `--allowedTools`.
5. **Commits and pushes (update b).** A packet may commit only when its `run_profile` has `allow_commits: true`, and every commit is checked by the guards in §3.9. A push is allowed only when the Control says so, and only to the start branch (`git push origin <start_branch>`); pushing any other branch fails the ref and start-branch guards. The Main Lane verifies a push with `git ls-remote` and `git show`. (Push condition: NML-1109-4, lifted by MA-NOV-P1.FIX4's H1 fix.)

**Source:** NML-1106-8 (2); NML-1107-1 (2b, 3a, 5a); NML-1109-4; `claude/packets/LANE_OPENER_v2.md`; `tools/factory/README.md` §Two run modes and §Headless dispatcher run; kit §5, §8.

---

## 6. Separation of Duties: review independence evidence

**v1.1 (summary):** the executor, the reviewer and the approver are distinct.

**v1.2 addition:**
1. A review counts only if its record shows independence:
   - The reviewer `session_id` (or `run_id`) differs from every executing run's `session_id` / `run_id` for the same packet.
   - The reviewer was started fresh, with no shared or resumed transcript. It received only the work contract, the artifact or diff revision (with SHA-256), the tests and the evidence.
   - This is sufficient evidence; a different tool or model is not required (Q5).
2. The review file states the artifact hash it examined.
3. Verdicts are PASS, PASS_WITH_NOTES, FAIL or NEEDS_FOUNDER_DECISION.
4. A materially changed artifact needs a new review.
5. A reviewer pass is not deployment permission.

**Source:** kit §2 (Independent reviewer), §7; MA-NOV-000 Report §Q2.5 (`review{reviewer,run_id,…}`); LANE_OPENER step 3 (every run gets a fresh session); NML-1110-1 (Q5).

---

## 7. WIP and Usage Budget

**v1.1 (summary):** no more than 2 active lanes.

**v1.2 text:**
1. **Execution:** at most **one run** at a time, enforced by the global O_EXCL lock (`claude/factory/leases/.global.lock`) and the per-packet lease. An independent review is a packet run like any other: it starts with `begin` in a fresh session and **holds the execution slot** until its `end`. The Main Lane is not a worker. There is no planning swarm.
2. **Capacity hold:**
   - **Manual (the rule):** the Founder states a limit and the Main Lane writes `hold{type:"CAPACITY_HOLD", set_by:"Founder", reason, reset_at}`. The Tower shows it marked "manual entry, not telemetry".
   - **Automatic:** a quota or usage-limit error in a worker log makes the dispatcher write the same hold through `dispatcher-hold` (`set_by:"dispatcher"`).
   - In both cases: **no retry**, and no launch while the hold is set. Only the Main Lane clears it.
3. **Telemetry:** usage files and app usage tools are not read as telemetry. No packet inspects the local usage-history file; capacity entries stay manual (Q3).

**Source:** NML-1106-4 (6); MA-NOV-000 Report §Q7; `tools/factory/README.md` §Ownership; kit §5; NML-1110-1 (Q3).

---

## 8. Founder Interface Rule, extended to the Control Tower

**v1.1 (summary):** the Founder sees only Start Approvals, Review Requests and Decision Requests.

**v1.2 addition:**
1. **What the Tower is.** The Control Tower (`claude/factory/control-tower.html`) is the Founder's read surface. It is generated from the Status files (and the run records and transitions log) and holds no state of its own. Its layout follows the interim design (`claude/factory/design/interim-tower-reference.html`): *Waiting for you*, *Work* (Running / Ready / In review / Blocked-held / Closed), *Start a run*, *Path*, *Handoffs*, *November scope*, *Recent runs*, *Recent decisions*. It loads nothing from the network.
2. **What it shows.** It may show running packets, leases, holds, records (§2.8) and the three Founder request types, and nothing else to act on. Founder requests appear as cards with the exact reply line and a Copy button.
3. **How a Founder action is recorded.** Every action taken from the Tower is a reply to the Main Lane, which records it in the decision log and in the Status file (for a `founder-request`: `status`, `answer`, `answered_at`), bound to file hashes where it is an approval. The Tower never writes Status.
4. **Approval needs words.** Silence, a stale approval or a viewed Tower is not consent.

**Source:** NML-1106-8 (1); NML-1107-1 (3a); NML-1110-1 (Founder design feedback); kit §7; `tools/factory/project.mjs`.

---

## Repository CLAUDE.md patch — applied by MA-NOV-P1.FIX4 (Q4: same packet)

The draft's patch table (rev 2) was applied to the repository `CLAUDE.md` on 2026-11-10, plus one pointer line near the top ("Standing operating rules: `Claude.md` v1.1 (Project) as amended by `claude/governance/Claude_md_v1.2.md`."). Line numbers below are as of 2026-11-07, before the patch:

| Line | Applied |
|---|---|
| 5 | "Last updated" now names MA-NOV-P1.FIX4 and points here; earlier history via `git log -p CLAUDE.md`. |
| 27 | VERIFIED 2026-11-10 (MA-NOV-P1.FIX4): `pwd`, `git branch --show-current` (`November-2026`) and `git remote -v` (`navinmv81/meridian-atlas`) all matched. |
| 28 | LOCAL_MASTER branch `November-2026` (NML-1106-4); `October-2026` `/docs` live since 2026-10-31; `September-2026` frozen at `420487d`. |
| 44 | Cron capacity keeps its 2026-09-23 date, marked "(not re-verified in November)" — needs a network check this packet could not make. |
| 48 | Packet state lives in the Status files; board and Tower are generated; D1 board tables and the Project mirror are frozen legacy. |
| 75 | Main Lane (November) is the sole writer of Status files and Main Lane records; one packet per fresh session via `LANE_OPENER_v2.md`. |
| 79–100 | "Current Sprint Packet" now points to the Tower, the generated board and `claude/November_Decisions_Log.md`. |

---

## Founder answers to the draft's open questions (NML-1110-1, 2026-11-10 06:51)

1. **Transitions (Q1):** resolved earlier (D1, 2026-11-07T20:23Z): the coded table is canonical; §4 reproduces it, now with the closure path.
2. **DRAFT (Q2): yes.** DRAFT is used for scope records and for un-admitted packets (§2.8, §4.1).
3. **Telemetry (Q3): no.** Capacity entries stay manual; no packet inspects the usage-history file (§7.3).
4. **Patch timing (Q4): yes.** The repository `CLAUDE.md` patch ships in the same packet that installs this file (MA-NOV-P1.FIX4; see above).
5. **Review independence (Q5): yes.** A distinct `session_id` plus a fresh start is sufficient evidence (§6.1).
