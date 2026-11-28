# MA-DEC-FACTORY.LABEL — Report

```text
PACKET:    MA-DEC-FACTORY.LABEL · Control v1 (104e84e4…3d05f8) · Task v1 (b04c5ca6…7b744d5c)
EXECUTED:  Engineering Lead — LANE-DEC-ENG, interactive Claude Code via LANE_OPENER_v3.md (sha256 7aeefea2…cb9d6f8f verified)
RUN:       r-20261128T133050Z-3837 (dispatch begin 2026-11-28T13:30:50Z)
OUTCOME:   Done — all success conditions met; ready for MA-DEC-FACTORY.REVIEW
```

## Preconditions (Task step 1)
- No `.git/*.lock`. Branch `December-2026`. HEAD = `git ls-remote origin refs/heads/December-2026` = `710242ee02b525947f0cd988f89d30373df8a56b`.
- `dispatch check`: eligible = [`MA-DEC-FACTORY.LABEL`] only, running = []. `begin` printed `BEGIN MA-DEC-FACTORY.LABEL run r-20261128T133050Z-3837 — work now; …`.
- Control and Task SHA-256 match the Status file.

## Pins observed (all match, checked before work and again just before staging)
| File | sha256 |
|---|---|
| `claude/December_Decisions_Log.md` | `c96429f5c2bea0aea7c3645deb901fd048bb3ccd0640ffa1ccbdb8b4a7d51e03` ✔ |
| `claude/packets/MA-DEC-BOOT_Status.json` | `9559ca9401ba0c09c30e32b80b7b2f3232676530d3cf02a051c11e8d72dbb06c` ✔ |
| `claude/packets/MA-DEC-BOOT_Report.md` | `b73d04ca39ed871c18a3f2a1f100d069f099c13b1ff977ce4fb1e32e12a43449` ✔ |
| `claude/packets/LANE_OPENER_v3.md` | `7aeefea2132c7b619099c9558e67aa2a4d12baf501f3adccd8003a02cb9d6f8f` ✔ |
| `claude/factory/config.json` | `dbf5664d186c21997c513c7e4b805987da20769dfa8f43312bdd45be87b01176` ✔ |
| `claude/packets/MA-DEC-FACTORY.LABEL_Control_v1.md` | `104e84e41b452c04bd8b3342149b367171906738e7b793c64682922f98f05d3e` ✔ |
| `claude/packets/MA-DEC-FACTORY.LABEL_Task_v1.md` | `b04c5ca650a997fd48321bdfa072ba88c27cc7b71be39ce1669905ef7b744d5c` ✔ |

## Archives (Control §What 1, from git `710242e`, not the working copy)
| Archive | sha256 |
|---|---|
| `claude/packets/STATUS_BOARD_November_2026.md` | `44404582ce6319e9f162587d882231105d747ea5b50a659596b6e659442cd7d7` ✔ pin |
| `claude/factory/control-tower_November_2026.html` | `e23f3462913d037e2021fe3b798c5793f7919f9bcc7abca70036758e96b87aac` ✔ pin |

Not touched after writing.

## Code diff summary (`tools/factory/`, +132 / −21)
- **`project.mjs`.** New exported `boardLabels(cfg)` reads `config.board.{label, prefix, previous_archive?}`. It returns the title, section headings, Tower name, prefix list, source globs and archive sentence.
  - With `board` absent it returns the November values: label `November 2026`, Tower `November Control Tower`, all `PACKET_PREFIXES`, and the October-archive sentence.
  - `BOARD_TITLE`, `BOARD_SECTION` and `SCOPE_SECTION` are still exported and are derived from the November defaults, so the existing tests stand.
  - `buildSnapshot` lists `boardLabels(cfg).prefixes` for the board and Tower only. `evaluate()` (eligibility) is unchanged and still sees every `PACKET_PREFIXES` packet.
  - `renderBoard(snap, lab)` and `renderHtml(snap, lab)` take the labels; `project()` passes them in from config.
  - When `board` is set, the Projection line names the configured prefix glob and reads: "Previous month's board archived unchanged at `claude/packets/STATUS_BOARD_November_2026.md`; October board at `claude/packets/STATUS_BOARD_October_2026.md`." The previous-month path defaults to the November archive; an optional `board.previous_archive` overrides it for later months. It is absent from config, so the default applies.
  - **Overwrite guard:** `boardIsGenerated` now tests the first line against `/^# Status Board — .+ \(generated — do not edit; run node tools\/factory\/project\.mjs\)$/`, i.e. a generated title for any label. A hand board, such as `# Status Board — October 2026` or `# Status Board — December 2026`, is still refused.
- **Unchanged:** `dispatch.mjs`, `lib/*` (eligibility, lease, state, ownership).
- **Byte-identity check (no `board`):** I ran the old `project.mjs` (`git archive 710242e`) and the new one on the same temp repo (MA-NOV/MA-DEC/MA-OCT fixtures, fixed `now`). Board identical: true. HTML identical: true.
- **`test/month-label.test.mjs`:** new tests 53–56, loaded from `pilot.test.mjs` the same way as `month-prefix.test.mjs`. Header numbering comment updated.
  - 53 (a): no `board` → November title, sections, Projection line, Tower `<title>`/`<h1>`/scope exactly as today.
  - 54 (b): `board` set → December headings. Only `MA-DEC-*` rows on the board and Tower; November packets and globs are absent. `evaluate` and `dispatch check` still list both months.
  - 55 (c): the guard accepts a November-generated board under the December config and refuses three hand boards, leaving each untouched.
  - 56 (c): the November generator accepts a December-generated board.
- **`README.md`:** new paragraph "Month label (MA-DEC-FACTORY.LABEL)" says where and how to change the label each month.

## Tests
`node --test tools/factory/test` → **tests 56, pass 56, fail 0**. That is 48 pilot + 4 month-prefix + 4 month-label.

## Regeneration (Control §What 5, run once after the tests)
`node tools/factory/project.mjs` → `packets: 2 · … generated_at 2026-11-28T13:33:39Z`
- Board line 1: `# Status Board — December 2026 (generated — do not edit; run node tools/factory/project.mjs)`
- Tower: `<h1>Meridian Atlas — December 2026 Control Tower</h1>`

The board has 0 `MA-NOV-` occurrences. In the Tower, `MA-NOV-` ids remain only in the history panels: Recent runs (`runs/*/run.json`) and Recent decisions (`transitions.jsonl`). The packet lists and work columns show `MA-DEC-*` only. History filtering is not in this Control; that is a point for the reviewer to note.

## Commit and push (Control §What 6)
- Commit **`5af13515d799ac1421b899270833978635e410db`** on `December-2026`, message `MA-DEC-FACTORY.LABEL: December headings, November board/Tower archived; Main Lane records (DML-1128-4/5)`.
- Staged list = commit list, 15 files, each added with `git add -- <path>`:
  ```
  claude/December_Decisions_Log.md
  claude/factory/config.json
  claude/factory/control-tower.html
  claude/factory/control-tower_November_2026.html
  claude/packets/LANE_OPENER_v3.md
  claude/packets/MA-DEC-BOOT_Report.md
  claude/packets/MA-DEC-BOOT_Status.json
  claude/packets/MA-DEC-FACTORY.LABEL_Control_v1.md
  claude/packets/MA-DEC-FACTORY.LABEL_Task_v1.md
  claude/packets/STATUS_BOARD.md
  claude/packets/STATUS_BOARD_November_2026.md
  tools/factory/README.md
  tools/factory/project.mjs
  tools/factory/test/month-label.test.mjs
  tools/factory/test/pilot.test.mjs
  ```
- Push: `710242e..5af1351  December-2026 -> December-2026`. `git ls-remote origin refs/heads/December-2026` → `5af13515d799ac1421b899270833978635e410db` = local HEAD.
- `dispatch end` regenerates `STATUS_BOARD.md` and `control-tower.html` after the commit, so both will show as modified in the working copy again. This is expected and is left uncommitted.

## Non-actions
- No edits to any Status file, `config.json`, either LANE_OPENER, Main Lane records or the archives; the pinned records were committed as found.
- `claude/factory/transitions.jsonl` and this packet's Status/Report were not committed.
- Nothing touched in `App/`, `docs/`, `generate-docs.mjs`, `13F Seed/` or `CLAUDE.md`.
- No wrangler, D1, Cloudflare API, secrets, schedulers, installs or subagents.
- No `git add -A`/`.`/dir, amend, reset, rebase, pull, force or deletes. No other branch pushed.
- `project.mjs` was run once by hand, under the Control's explicit exception. `dispatch run` was not used, and `begin` was not run for any other packet.
