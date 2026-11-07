# Claude.md v1.2 — proposed amendments to v1.1

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — MA-NOV-P1.DEMO Control v2 5a9934fd…b3b4, Task v2 91bdfcb4…ce7c
EXECUTED BY:  Engineering Lead (documentation) — interactive Claude Code, run r-20261107T095946Z-3762, 2026-11-07
REVISED BY:   Engineering Lead — MA-NOV-P1.FIX2 (Control v1 a261f67e…5d5c, Task v1 f16f2fbd…a992), interactive run r-20261107T202556Z-a368, 2026-11-07
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (PASS_WITH_NOTES, report 7677ad1d…cb99); revision 2 → MA-NOV-P1.REVIEW2
APPROVED BY:  Founder — pending; NML-1107-1 (4) requires this text be shown before it becomes a standing rule
STATUS:       DRAFT — not active until the Founder approves it
```

**Revision 2 (MA-NOV-P1.FIX2, 2026-11-07)** — aligns the draft with MA-NOV-P1.REVIEW findings D1–D6:
- **D1** §4 state table replaced by the transitions coded in `tools/factory/lib/state.mjs`, which the Founder chose as canonical ("D1 code", 20:23Z). `dispatcher-hold` writes only `hold`.
- **D2** §3.4: the Main Lane, not the dispatcher, copies a review verdict into `review{}`.
- **D3** CLAUDE.md patch, line 28: `October-2026` `/docs` has been the live Pages source since 2026-10-31.
- **D4** CLAUDE.md patch, line 27: the VERIFIED claim is now a placeholder filled by the packet that applies the patch.
- **D5** §7.1: a review holds the execution slot (current behaviour).
- **D6** §3.1/§3.2 conflict removed; §3.6 says refused writes throw and are not logged, and successful writes are logged to `claude/factory/transitions.jsonl`.

Only the v1.1 sections that change are listed. Every other v1.1 section stays as written.

---

## 1. Usage Model (precedence)

**v1.1 (summary):** precedence is decision log > release context > this file > archives.

**Proposed v1.2 text:**
1. When two sources conflict, the higher one wins:
   1. A Founder decision record (decision-log row, or `decision{}` / `start_approval{}` in a Status file).
   2. The packet's Control and Task, bound by SHA-256.
   3. `Claude.md` (Project governance, this file).
   4. Repository `CLAUDE.md` (environment truth only).
   5. The November spec and the operating kit (design intent, not permission).
   6. `.claude/settings*.json` (a harness enforcement layer, not a source of authority).
   7. Archives.
2. A permission that exists in only a lower layer, such as a settings pre-allow, grants nothing unless a higher layer also grants it.
3. **On disk,** v1.2 lives at `claude/governance/Claude_md_v1.2.md`. The volume is case-insensitive APFS, so a file named `Claude.md` cannot sit beside `CLAUDE.md`. No session may create, rename or overwrite the repository `CLAUDE.md` in order to install this file. The repository `CLAUDE.md` gets one pointer line to the governance file, through its own scoped packet.

**Source:** MA-NOV-000 Report §Q6.2; NML-1107-1 (5a, 5b).

---

## 2. Status Board

**v1.1 (summary):** `STATUS_BOARD.md` is the single source of truth. Its fields are Packet ID, State, Control version, Lane and tool, Write owner, Next gate, Blocker and Usage class.

**Proposed v1.2 text:**
1. The single source of truth for packet state is `claude/packets/<ID>_Status.json`. There is one state system, and it is not YAML.
2. `claude/packets/STATUS_BOARD.md` and `claude/factory/control-tower.html` are **generated projections** of the Status files. `node tools/factory/project.mjs` writes them, and nobody edits them by hand.
3. Run the generator after every Status write. Two runs on the same Status data may differ only in `generated_at`.
4. The generator refuses to overwrite a board whose first line is not its own generated title.
5. The October board is archived unchanged as `STATUS_BOARD_October_2026.md`.
6. Board columns keep the v1.1 field set. When a run is BLOCKED and the Main Lane's `blocker` field is empty, the Blocker column shows `run.blocked_reason`.
7. The D1 tables `sprintboarditems` and `releaseledger`, the October HTML board and the Project `Sprint_Board.md` mirror are **frozen legacy**. They receive no November writes.

**Source:** MA-NOV-000 Report §Q2.3, §Q2.4, §Q6.1; `tools/factory/README.md` (Day-to-day use); NML-1106-4 (3).

---

## 3. Write Ownership

**v1.1 (summary):** each file has one write owner, and the Main Lane is the sole writer of the board and the Status files.

**Proposed v1.2 text (per field, for `MA-NOV-*` and later packets):**
1. **Main Lane:** the sole writer of a packet's admission, approvals, decisions and holds, and of every state transition except the three the dispatcher makes (item 2). It may write any field.
2. **Dispatcher:** may write only `lease`, `heartbeat`, `run`, `updated` and `updated_by`. It may change `state` only for three transitions: READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED. It never writes `blocker`. A run's BLOCKED reason goes in `run.blocked_reason`.
3. **`dispatcher-hold` (sole exception):** may write `hold` only. It is used only when a worker log shows a usage or quota-limit error, and it then writes `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", reason, at}`. Nothing else can be written through this path.
4. **Reviewer run:** writes only its own review file. The Main Lane copies the verdict into `review{}`. The dispatcher does not, because `review` is not a dispatcher field.
5. **Executing session:** writes only the paths in `run_profile.allowed_write_paths`. It never writes any `_Status.json`, the board, the Tower, `claude/factory/` files, the LANE_OPENER files or Main Lane records.
6. **How every Status write is made:** a compare-and-swap on `rev`, then a temp file and `rename(2)`. A write that changes a field its writer does not own, makes a transition the table in §4 does not allow, or sees a mismatched `rev`, is refused: it throws and writes nothing, and it is not logged. Every successful write appends `{at, id, writer, from, to, rev}` to `claude/factory/transitions.jsonl` (append-only).
7. **Violations:** a raw edit to any Status file that leaves `rev` unchanged is a violation. So is a new Status file created while a run is active. During an interactive run, any change to the running packet's own Status (even through the state library) blocks the run; rev bumps on other packets are listed in the run record for Main Lane confirmation.
8. **Writer identity** passed to the state library is self-declared (an honour system). The dispatcher's scope check, not the library, is what catches a worker writing Status.

**Source:** MA-NOV-000 Report §Q6.1 (rule text, tightened); `tools/factory/README.md` §Ownership (`dispatcher-hold`) and §Headless step 7; NML-1107-1 (4).

---

## 4. Packet State Machine

**v1.1 (summary):** READY → EXECUTING → REVIEW_NEEDED → DECISION_NEEDED → APPROVED → CLOSED, with BLOCKED reachable from any state.

**Proposed v1.2 text:**
1. **Names:** keep EXECUTING (not RUNNING) and APPROVED (not ACCEPTED). Add four states: **DRAFT**, **CHANGES_REQUESTED**, **PAUSED** and **CAPACITY_HOLD**.
2. **Transitions** — exactly the table coded in `tools/factory/lib/state.mjs` (canonical, Founder decision D1). A write that leaves `state` unchanged is not a transition. Writer: **D** = dispatcher, **ML** = Main Lane.

   | From | Allowed next states | Writer | Trigger |
   |---|---|---|---|
   | DRAFT | READY | ML | admission complete (board row, Control and Task hashes, owner) |
   | READY | EXECUTING | D (or ML) | `begin` or `run`, with a valid `start_approval` and the lease taken |
   | READY | BLOCKED / PAUSED / CAPACITY_HOLD | ML | exception or hold, with `hold{}` (and `resume_state`) for a hold |
   | EXECUTING | REVIEW_NEEDED | D (or ML) | scope check passes and the report is present |
   | EXECUTING | BLOCKED | D (or ML) | scope violation, no report, worker failure, expired or stale lease |
   | REVIEW_NEEDED | CHANGES_REQUESTED / DECISION_NEEDED / APPROVED | ML | reviewer verdict recorded |
   | CHANGES_REQUESTED | READY | ML | a new Control or Task version is issued and approved |
   | DECISION_NEEDED | APPROVED / CHANGES_REQUESTED / BLOCKED | ML | Founder choice recorded |
   | APPROVED | CLOSED | ML | close-out |
   | CLOSED | — (terminal) | — | — |
   | BLOCKED / PAUSED / CAPACITY_HOLD | `hold.resume_state` if set, else READY (exactly one) | ML | hold or exception cleared |

   Not allowed (the v1.1 summary and revision 1 of this draft implied otherwise): EXECUTING → PAUSED or CAPACITY_HOLD; DECISION_NEEDED → CLOSED; and BLOCKED from DRAFT, REVIEW_NEEDED, CHANGES_REQUESTED or APPROVED. The dispatcher may make only READY→EXECUTING, EXECUTING→REVIEW_NEEDED and EXECUTING→BLOCKED.

   **`dispatcher-hold` writes only `hold`; the dispatcher sets BLOCKED first.** On a worker quota error the run goes EXECUTING→BLOCKED through the dispatcher, and only then is `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", …}` written. `dispatcher-hold` never changes `state`.
3. **What the dispatcher refuses:** it never launches a packet in PAUSED or CAPACITY_HOLD, or one with a global `claude/factory/PAUSE.json` set. It never reruns a BLOCKED packet automatically.
4. **Free text:** free-text decorations in a state field (e.g. "APPROVED (10 Oct…)") are not allowed. Put the detail in another field.

**Source:** `tools/factory/lib/state.mjs` (`TRANSITIONS`, `HELD_STATES`, `DISPATCHER_TRANSITIONS`, `DISPATCHER_HOLD_FIELDS`); `tools/factory/dispatch.mjs` (`finishRun`: BLOCKED, then `hold`); Founder decision D1 (MA-NOV-P1.FIX2 Status, 2026-11-07T20:23Z); MA-NOV-000 Report §Q2.2, §Q2.5; kit §7 (verdicts).

---

## 5. Admission Rule, extended: start approval and how a run starts

**v1.1 (summary):** a packet needs a board row, an immutable Control version with its SHA-256, a declared state, and one write owner (or NONE).

**Proposed v1.2 addition:**
1. **When a packet may run.** It may run only when its Status file carries `start_approval{by:"Founder", at, words, control_sha256, task_sha256, recorded_by:"Main Lane"}`. Both hashes must equal the Status `control.sha256` and `task.sha256` **and** the SHA-256 of the files on disk. No `_Report.md` may exist for it yet.
2. **Stale approvals.** An approval bound to superseded hashes is history (`previous_start_approval`), not consent.
3. **Interactive run (in use).**
   - The Founder opens a new Claude Code session and types the fixed line, which names `claude/packets/LANE_OPENER_v2.md` and its SHA-256.
   - The session first runs `node tools/factory/dispatch.mjs check`, then `begin <ID>`. It does no packet work before `BEGIN … run <run_id>` prints.
   - It always finishes with `end <ID>`, including when it stops early. With no report, `end` records BLOCKED.
   - One session runs one packet.
4. **Headless run (kept, not in use).** `node tools/factory/dispatch.mjs run <ID>` makes one bounded attempt with no retries. It needs a complete `run_profile` (`allowed_tools`, `permission_mode`, `allowed_write_paths`), a non-null `config.model` passed through unchanged, and a signed-in worker binary. Settings come from the project only (`--setting-sources project`), and tools are limited with `--tools` and `--allowedTools`.

**Source:** NML-1106-8 (2); NML-1107-1 (2b, 3a, 5a); `claude/packets/LANE_OPENER.md` step 3; `tools/factory/README.md` §Two run modes and §Headless dispatcher run; kit §5, §8.

---

## 6. Separation of Duties: review independence evidence

**v1.1 (summary):** the executor, the reviewer and the approver are distinct.

**Proposed v1.2 addition:**
1. A review counts only if its record shows independence:
   - The reviewer `session_id` (or `run_id`) differs from every executing run's `session_id` / `run_id` for the same packet.
   - The reviewer was started fresh, with no shared or resumed transcript. It received only the work contract, the artifact or diff revision (with SHA-256), the tests and the evidence.
2. The review file states the artifact hash it examined.
3. Verdicts are PASS, PASS_WITH_NOTES, FAIL or NEEDS_FOUNDER_DECISION.
4. A materially changed artifact needs a new review.
5. A reviewer pass is not deployment permission.

**Source:** kit §2 (Independent reviewer), §7; MA-NOV-000 Report §Q2.5 (`review{reviewer,run_id,…}`); LANE_OPENER step 5 (reviews need a fresh session).

---

## 7. WIP and Usage Budget

**v1.1 (summary):** no more than 2 active lanes.

**Proposed v1.2 text:**
1. **Execution:** at most **one run** at a time, enforced by the global O_EXCL lock (`claude/factory/leases/.global.lock`) and the per-packet lease. An independent review is a packet run like any other: it starts with `begin` in a fresh session and **holds the execution slot** until its `end` (current behaviour). The Main Lane is not a worker. There is no planning swarm.
2. **Capacity hold:**
   - **Manual (default):** the Founder states a limit and the Main Lane writes `hold{type:"CAPACITY_HOLD", set_by:"Founder", reason, reset_at}`. The Tower shows a banner marked "manual entry, not telemetry".
   - **Automatic:** a quota or usage-limit error in a worker log makes the dispatcher write the same hold through `dispatcher-hold` (`set_by:"dispatcher"`).
   - In both cases: **no retry**, and no launch while the hold is set. Only the Main Lane clears it.
3. **Telemetry:** usage files and app usage tools are not read as telemetry until the Founder permits it.

**Source:** NML-1106-4 (6); MA-NOV-000 Report §Q7; `tools/factory/README.md` §Ownership; kit §5.

---

## 8. Founder Interface Rule, extended to the Control Tower

**v1.1 (summary):** the Founder sees only Start Approvals, Review Requests and Decision Requests.

**Proposed v1.2 addition:**
1. **What the Tower is.** The Control Tower (`claude/factory/control-tower.html`, or the interim artifact) is the Founder's read surface. It is generated from the Status files and holds no state of its own.
2. **What it shows.** It may show running packets, leases, holds and the three Founder request types, and nothing else to act on.
3. **How a Founder action is recorded.** Every action taken from the Tower is recorded by the Main Lane in the decision log and in the Status file, bound to file hashes. The Tower never writes Status.
4. **Approval needs words.** Silence, a stale approval or a viewed Tower is not consent.

**Source:** NML-1106-8 (1); NML-1107-1 (3a); kit §7; `tools/factory/README.md` (`project.mjs`).

---

## Proposed patch to repository CLAUDE.md

Do not apply this here. It needs its own scoped packet, and the line numbers are as of 2026-11-07.

| Line | Current (short) | Proposed replacement |
|---|---|---|
| 5 | "*Last updated: 2026-08-27 (Entities Product Lead + Tech Ops lane — MA-SEP-010…" | "*Last updated: <date> (<packet>) — governance now lives in `claude/governance/Claude_md_v1.2.md`; this file holds environment truth only. Earlier history: `git log -p CLAUDE.md`.*" |
| 27 | "VERIFIED 2026-09-23 (MA-OCT-000): `pwd` returned exactly this path, branch `September-2026`…" | "VERIFIED <date> (<packet that applies the patch>): `pwd` returned this path, branch `November-2026`, remote `origin` = `navinmv81/meridian-atlas`." The applying packet runs the check and fills in both placeholders; no check has been made yet. |
| 28 | "LOCAL_MASTER's own git branch: `October-2026`…" | "LOCAL_MASTER's own git branch: **`November-2026`** (NML-1106-4). `October-2026` `/docs` is the live Pages source (since 2026-10-31); `September-2026` is frozen at `420487d`." |
| 44 | "Cron Trigger capacity reconfirmed 2026-09-23: 5 of 5 in use." | "Cron Trigger capacity: last confirmed 5 of 5 on 2026-09-23. **Unverified since.** Re-check via the API before assuming room." (The number needs an API check this packet cannot make.) |
| 48 | "`Sprint_Board.md` is intentionally not a file in this repo…" | "Packet state lives in `claude/packets/*_Status.json`. `STATUS_BOARD.md` and the Control Tower are generated by `tools/factory/project.mjs`. The D1 `sprintboarditems`/`releaseledger` tables and the Project `Sprint_Board.md` mirror are frozen legacy." |
| 75 | "Master lane, designated 2026-08-15: this Control-lane session is the standing coordination thread for the September sprint…" | "Main Lane (November): the Program Orchestrator session is the sole writer of Status files and Main Lane records (see `claude/governance/Claude_md_v1.2.md` §Write Ownership). Packet work runs one packet per fresh session via `claude/packets/LANE_OPENER_v2.md`." |
| 79–100 | "## Current Sprint Packet … Active packet: MA-OCT-000…" | Replace the section with one line: "Current packets: see `claude/packets/STATUS_BOARD.md` (generated). October closed (NML-1107-2)." |

---

## Open questions for the Founder

1. ~~**Transitions:** do you accept the Main Lane transitions in §4?~~ **Resolved (D1, 2026-11-07T20:23Z):** the coded table is canonical; §4 now reproduces it.
2. **DRAFT:** should DRAFT be used for admitted-but-unapproved packets, or kept out of the Status files until admission?
3. **Telemetry:** may a later packet inspect the structure (not the contents) of the local usage-history file, to see whether an automatic capacity reading is possible (§7)?
4. **Patch timing:** should the repository `CLAUDE.md` patch ship in the same packet that installs `Claude_md_v1.2.md`, or separately?
5. **Review independence:** is a distinct `session_id` plus a fresh start (§6) enough evidence, or do you also want reviews run by a different tool or model?
