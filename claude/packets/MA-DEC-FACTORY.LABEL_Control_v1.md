# MA-DEC-FACTORY.LABEL — December headings on the board and Control Tower; November views archived — Control v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Engineering Lead — LANE-DEC-ENG, interactive Claude Code via LANE_OPENER_v3.md (fixed line)
REVIEWED BY:  Independent light delta review MA-DEC-FACTORY.REVIEW (fresh session; covers this diff and the MA-DEC-BOOT factory diff)
APPROVED BY:  Founder — request 28 Nov 12:14 ("adjust the Nov headings"); Start Approval in MA-DEC-FACTORY.LABEL_Status.json
PACKET:       MA-DEC-FACTORY.LABEL · Control v1 · usage class light · write owner Engineering Lead (LANE-DEC-ENG)
```

## Why
`tools/factory/project.mjs` hard-codes "November" in the board title, the board's two section headings, the Tower `<title>`, `<h1>` and scope section. Since December opened, the board and Tower still read "November", which confuses which month is live (DML-1128-5).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`; branch `December-2026`, HEAD `710242e` = origin. `dispatch begin`/`end` bracket this run and regenerate the board and Tower with whatever code is on disk at that moment — that is expected.

## What
1. **Archive November views, byte-identical, from git** (not from the working copy, which `begin` regenerates): `git show 710242e:claude/packets/STATUS_BOARD.md > claude/packets/STATUS_BOARD_November_2026.md` (sha256 must be `44404582ce6319e9f162587d882231105d747ea5b50a659596b6e659442cd7d7`) and `git show 710242e:claude/factory/control-tower.html > claude/factory/control-tower_November_2026.html` (sha256 must be `e23f3462913d037e2021fe3b798c5793f7919f9bcc7abca70036758e96b87aac`).
2. **`project.mjs`: month from config.** Read `config.board.label` and `config.board.prefix` (already set by the Main Lane in `claude/factory/config.json`: `"December 2026"`, `"MA-DEC-"`). With `board` absent, behaviour stays exactly as today (label `November 2026`, all `PACKET_PREFIXES`) so the existing tests stand. With it present: board title `# Status Board — <label> (generated — do not edit; run node tools/factory/project.mjs)`; sections `## <label> — admitted packets` and `## <month word> scope — outcomes`; Tower `<title><label> Control Tower</title>`, `<h1>Meridian Atlas — <label> Control Tower</h1>`, scope section `<month word> scope`; board and Tower list only Status files starting with `board.prefix`; the "Projection of …" line names that prefix and points to `STATUS_BOARD_November_2026.md` as the previous month's archive (October archive mention kept). Eligibility, `dispatch check`/`begin` and the ownership guard keep seeing **all** `PACKET_PREFIXES` — no change there.
3. **Overwrite guard:** `project.mjs` still refuses to overwrite a hand-written `STATUS_BOARD.md`; it now accepts any first line that matches the generated title pattern (any label), not only the November string.
4. **Tests** (same harness, temp repos): (a) no `board` → output identical to today; (b) `board` set → December headings in board and Tower, only `MA-DEC-*` rows, November packets absent; (c) guard still refuses a hand board and accepts a generated board of another month; (d) all existing tests pass. README: one paragraph "Month label" (where to change it each month).
5. Run `node tools/factory/project.mjs` once after the tests pass (explicit exception to LANE_OPENER step 6 for this packet only); confirm the board's first line reads `# Status Board — December 2026 …` and the Tower `<h1>` reads `Meridian Atlas — December 2026 Control Tower`.
6. **One commit**, explicit paths: the code/test/README files changed; the two archives; `STATUS_BOARD.md`; `control-tower.html`; and these Main Lane records, committed as they are on disk (content must equal the pins in the Task; do not edit them): `claude/packets/MA-DEC-BOOT_Status.json`, `claude/packets/MA-DEC-BOOT_Report.md`, `claude/December_Decisions_Log.md`, `claude/packets/LANE_OPENER_v3.md`, `claude/factory/config.json`, `claude/packets/MA-DEC-FACTORY.LABEL_Control_v1.md`, `claude/packets/MA-DEC-FACTORY.LABEL_Task_v1.md`. Message: `MA-DEC-FACTORY.LABEL: December headings, November board/Tower archived; Main Lane records (DML-1128-4/5)`. Push `December-2026`.
7. Report, then `node tools/factory/dispatch.mjs end MA-DEC-FACTORY.LABEL`.

## Prohibited
Changing eligibility, dispatch, lease, state or ownership logic; editing any Status file, `config.json`, any LANE_OPENER, Main Lane records or the archives after writing them; committing `claude/factory/transitions.jsonl` or this packet's own Status/Report; `App/`, `docs/`, `generate-docs.mjs`, `13F Seed/`, `CLAUDE.md`; wrangler, D1, Cloudflare API, secrets, schedulers, installs, subagents; `git add -A|.|<dir>`, `commit -a`, amend, reset, rebase, pull, force, deleting anything; pushing any other branch.

## Stop gates
Lock present; HEAD ≠ `710242e` or ≠ origin; an archive hash mismatch; any test failing; a pinned record's hash differs; staged list ≠ commit list; push rejected.

## Success
Board and Tower read December 2026 and list December packets only; November board and Tower archived byte-identical; all tests pass; one commit on `December-2026` = origin; `end` → REVIEW_NEEDED with 0 scope violations.
