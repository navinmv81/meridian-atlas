# MA-DEC-FACTORY.REVIEW — independent delta review of the December factory changes — Control v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Architect (REVIEW-A) — fresh interactive Claude Code session via LANE_OPENER_v3.md; must not be the session that ran MA-DEC-BOOT or MA-DEC-FACTORY.LABEL (fb142bc6…)
REVIEWED BY:  — (this is the review); Main Lane copies the verdict into BOOT and LABEL
APPROVED BY:  Founder — Start Approval in MA-DEC-FACTORY.REVIEW_Status.json
PACKET:       MA-DEC-FACTORY.REVIEW · Control v1 · usage class light · write owner Architect (report only)
```

## Scope
The `tools/factory/` diff `9cb8dc7..5af1351` only: commit `710242e` (MA-DEC-BOOT, month prefixes) and `5af1351` (MA-DEC-FACTORY.LABEL, month label, November archives). Against: `MA-DEC-BOOT_Control_v1.md` success condition 3 and `MA-DEC-FACTORY.LABEL_Control_v1.md` §What 2–4, and the standing factory guarantees from the November pilot (eligibility, O_EXCL lease and global lock, field-ownership guard, transition table, scope check, board overwrite guard).

## Questions
1. Do `MA-DEC-*` packets get exactly the protections `MA-NOV-*` had (ownership guard, eligibility, lease, scope check)? Any path still hard-wired to one month?
2. Does the board/Tower prefix filter ever hide a packet that is running or eligible (e.g. a live `MA-NOV-*` lease)? Is that acceptable?
3. Is the overwrite guard still safe against a hand-written board after the title became a pattern?
4. Are the November archives byte-identical to `710242e` (`44404582…d7d7`, `e23f3462…aac`)?
5. Do the new tests prove what they claim; are any existing tests weakened (diff of `pilot.test.mjs` is header + one import)?
6. Anything that must change before the first December packet that commits product code?

## Allowed
Read-only git and file reads; `node --test tools/factory/test` and experiments **in temp copies only**; write `claude/packets/MA-DEC-FACTORY.REVIEW_Report.md`; `dispatch.mjs end`.

## Prohibited
Any edit outside the report; commits, pushes; running `project.mjs` or `dispatch.mjs` (other than `begin`/`end` per the opener) against the real repo; wrangler, D1, network, secrets, installs, subagents.

## Output
Report with verdict `PASS` / `PASS_WITH_NOTES` / `FAIL` / `NEEDS_FOUNDER_DECISION`, findings numbered with severity (must-fix / note) and whether each blocks, test counts, and the answer to Q6. Then `end`.
