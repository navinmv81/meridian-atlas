# MA-NOV-P1.DEMO — Task v2 (supersedes Task v1 a0838d65…b453; content unchanged except the run mode)

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead (documentation) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.DEMO_Status.json
CONTROL:      claude/packets/MA-NOV-P1.DEMO_Control_v2.md
```

You are an interactive session started through `LANE_OPENER_v2.md` (which has already run `begin`). Use only reading tools, the two permitted file writes and the shell commands the Control allows. Finish with the report, then `node tools/factory/dispatch.mjs end MA-NOV-P1.DEMO`.

## Read (only these)
1. `claude/packets/MA-NOV-000_Report.md` — §Q2.2 (state names), §Q6.1 (write-ownership rule), §Q6.2 (precedence, case-insensitive file system), §Q6.3 (stale `CLAUDE.md` lines), §Q7 (capacity hold).
2. `claude/November_Decisions_Log.md` — rows NML-1106-4, NML-1106-8, NML-1107-1.
3. `claude/packets/LANE_OPENER.md`.
4. `tools/factory/README.md`.
5. `CLAUDE.md` (repository) — the lines §Q6.3 lists.
6. `claude/meridian_atlas_agentic_delivery_factory_operating_kit.md` §2, §5, §7, §8.

## Context: `Claude.md` v1.1 (Project-only; not on disk)
Its sections are: Purpose; Usage Model (precedence: decision log > release context > this file > archives); The Two Hard Rules — **Admission Rule** (board row, immutable Control version + SHA-256, declared state, one write owner or NONE) and **Founder Interface Rule** (only Start Approval, Review Request, Decision Request); Required Project Files; **Status Board** (single source of truth, fields: Packet ID, State, Control version, Lane and tool, Write owner, Next gate, Blocker, Usage class); **Control Versions** (immutable once issued; new version on change; lane stops on hash mismatch); **Write Ownership** (one write owner per file; Main Lane sole writer of board and Status files); Authority Header; **Separation of Duties**; **WIP and Usage Budget** (≤ 2 active lanes); Delivery Factory Model; Control Plane Rules; Execution Plane Rules; Packet Contract; **Packet State Machine** (READY → EXECUTING → REVIEW_NEEDED → DECISION_NEEDED → APPROVED → CLOSED; BLOCKED from any); Founder Prompt Formats; Outcome-Driven Selection; Lane Types; Git and File Discipline; Canonical Records; Session Opening Standard; Close-Out Standard; Instructions vs Reference Files; File Hygiene; Default Principle.

## Write `claude/governance/Claude_md_v1.2_amendments.md`
Header: four-line authority header; `STATUS: DRAFT — not active until the Founder approves it`.

Then one section per v1.1 section that changes (and only those), each with:
- **v1.1 (summary):** one or two lines from the context above.
- **Proposed v1.2 text:** the exact replacement or addition, written as rules.
- **Source:** the report section or decision-log row it comes from.

Must cover: the Status Board becoming a generated projection of Status JSON (`project.mjs`); write ownership per field (Q6.1 rule text, verbatim or tightened, with the `dispatcher-hold` exception from the README); the state machine with the four added states and their transitions (from the README / Q2.2); start approvals bound to Control + Task hashes and how a run starts (LANE_OPENER for interactive runs; `dispatch.mjs run` for headless runs); review independence evidence (distinct session ids, no shared transcript); capacity hold (manual vs automatic, no retries); WIP stated as one execution worker plus on-demand review; the Founder Interface Rule extended to the Tower; precedence order (Q6.2) and where v1.2 lives on disk (`claude/governance/`, never overwriting `CLAUDE.md`).

Then `## Proposed patch to repository CLAUDE.md`: for each stale line in Q6.3, the line number, the current text (quoted, short) and the proposed replacement text. Do **not** edit `CLAUDE.md`.

Then `## Open questions for the Founder` (≤ 5).

Keep the draft under ~1,800 words.

## Write `claude/packets/MA-NOV-P1.DEMO_Report.md`
Four-line header; files read (paths); file written (path, approximate words); anything you could not do with the allowed tools; stop.
