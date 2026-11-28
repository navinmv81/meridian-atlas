# MA-DEC-REC.DOC — records and current-state reconciliation (REC-01 … REC-05, AUD-06 files) + Main Lane records commit — Control v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Documentation Lead (LANE-DOC) — interactive Claude Code via LANE_OPENER_v3.md (fixed line)
REVIEWED BY:  Main Lane verification against the cited sources; the reconciliation is folded into Current State v16 at C4 (REC-06)
APPROVED BY:  Founder — run spec Workstream G (DML-1128-2); Start Approval in MA-DEC-REC.DOC_Status.json
PACKET:       MA-DEC-REC.DOC · Control v1 · usage class light · write owner Documentation Lead
```

## Objective
Settle each contradiction listed in run spec §5 G with evidence, in one reconciliation note that v16 will adopt, and check the November records for consistency. **The `.docx` files are not edited** — v16 is written once, at C4. Also commit the Main Lane records written today, exactly as they are on disk.

## Work
1. **REC-01 (KI 22.38 tokens):** v14 "inert" vs v15 "revocation unconfirmed". State the correct current wording using `MA-DEC-ASSESS.SEC_Report.md` §4/§6 F1 and DML-1128-9 (Founder statement 28 Nov 15:08 that tokens were rotated; dashboard evidence pending). Quote where each version says what.
2. **REC-02 (FIRDS failure start):** v14 "from 18 Oct" vs v15 "five Sundays from 4 Oct". Settle from repo and local evidence only: November/October Decisions Logs, packet reports, `MA-NOV-CARRY_Status.json` observations, FIRDS LaunchAgent logs under the repo (read-only). If it cannot be settled without D1, say so and hand it to MA-DEC-ASSESS.OPS with the exact query needed.
3. **REC-03:** list every place in v15 §10 and §15 where old and new text contradict; give the replacement text for each.
4. **REC-04:** replacement wording for v15 §25.7 stating plainly that the 25 Nov read figure (2.34M of 5M) came from one integrity check.
5. **REC-05:** wording recording the Ops console's fourth tab (Drift & Budget) as an approved November scope change, citing the decision row that approved it (or stating that none exists).
6. **AUD-06 (files only, no D1):** are `Sprint_Board.md` (Project mirror, frozen), `STATUS_BOARD_November_2026.md`, `Release_Ledger_November_2026.md` and `November_Decisions_Log.md` consistent on every production change and every packet close? Is anything in the repo or the front end still reading the D1 `sprintboarditems`/`releaseledger` tables (cross-check ASSESS.SEC F3)? List mismatches; do not fix November records.
7. Write `claude/Current_State_v15_Reconciliation.md`: one section per item above with: v14 text, v15 text, evidence (file + line or commit), corrected text for v16, and confidence. Then the report.
8. **Commit** (one commit, explicit paths): the reconciliation note, and the Main Lane records pinned in the Task, unedited. Message: `MA-DEC-REC.DOC: current-state reconciliation (REC-01–05, AUD-06); Main Lane records 28 Nov`. Push `December-2026`.

## Allowed
Read any repo file (text extraction from `.docx` by unzip/python, read-only); read local LaunchAgent log files inside the repo; write the reconciliation note and the report; `git add -- <path>`, one commit, push `December-2026`; `dispatch.mjs end`.

## Prohibited
Editing any `.docx`, any Main Lane record, Status file, board, Tower, LANE_OPENER, `config.json`, `CLAUDE.md`, product code, `docs/`; committing `claude/factory/transitions.jsonl`, this packet's own Status/Report, `STATUS_BOARD.md`, `control-tower.html`, or any untracked file not in the commit list (incl. `13F Seed/gleif-seed.js`, `.claude/settings.local.json`, `~$*`, root reference copies, `Meridian_Atlas_Current_State_v13.docx`); D1, wrangler, Cloudflare API, network, secrets, `.env*`; `git add -A|.|<dir>`, amend, reset, rebase, pull, force, delete; subagents.

## Stop gates
Lock; HEAD ≠ `5af1351` or ≠ origin; a pinned record's hash differs; staged list ≠ commit list; push rejected.

## Success
Reconciliation note with all six items (REC-02 may be "handed to ASSESS.OPS" with the query); one commit = origin; `end` → REVIEW_NEEDED, 0 scope violations.
