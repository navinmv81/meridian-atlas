# MA-DEC-FACTORY.REVIEW — Report

```text
PACKET:     MA-DEC-FACTORY.REVIEW · Control v1 (3c35c503…1ad7) · Task v1 (39c47cf7…453a)
ROLE:       Architect (REVIEW-A), fresh interactive session 8a914f71-ce95-41ea-a965-e2d3c5ceb371 (≠ fb142bc6…)
RUN:        r-20261128T133939Z-1ca7 (dispatch begin, interactive)
DATE:       2026-11-28
SCOPE:      git diff 9cb8dc7..5af1351 -- tools/factory/  (710242e MA-DEC-BOOT, 5af1351 MA-DEC-FACTORY.LABEL)
```

## Verdict: **PASS_WITH_NOTES**

No must-fix finding. The month-prefix and month-label changes give `MA-DEC-*` the same protections `MA-NOV-*` had, the November archives match their pins, and no existing test was weakened. There are six notes. None blocks. Notes 1 and 2 should be fixed before the January rollover. Note 3 needs a Main Lane choice.

## Preconditions (Task §1–2)

| Check | Result |
|---|---|
| Branch | `December-2026` |
| HEAD = `origin/December-2026` | `5af13515d799ac1421b899270833978635e410db` both |
| `.git/*.lock` | none |
| Session ≠ `fb142bc6-270b-4f4b-b596-e2a5252b9bc4` | yes (`8a914f71…`) |
| LANE_OPENER_v3.md sha256 | `7aeefea2…6f8f`, matches the fixed line |
| Control v1 / Task v1 sha256 | match `MA-DEC-FACTORY.REVIEW_Status.json` |
| `MA-DEC-BOOT_Report.md` | `b73d04ca39ed871c18a3f2a1f100d069f099c13b1ff977ce4fb1e32e12a43449`, matches pin |
| `MA-DEC-FACTORY.LABEL_Report.md` | `5f061e25324a5d16df7eb2d36e6bdcd330303601f3e1a02144b43dc39b1fee58`, matches pin |
| Factory diff | 9 files, +233 / −30 (README, dispatch, eligibility, state, util, project, 2 new tests, pilot header) |

## Tests

Run in a temp copy (`tools/factory`, `claude/packets`, `claude/factory/config.json` copied to the session scratchpad): `node --test tools/factory/test` gave **tests 56, pass 56, fail 0**. That is 48 pilot + 4 month-prefix (49–52) + 4 month-label (53–56), the same as the LABEL report.

## Answers

### Q1. Do `MA-DEC-*` packets get the same protections? Is any path still tied to one month?
**Yes, they get the same protections.** Every gate that used to name `'MA-NOV-'` now reads `PACKET_PREFIXES` / `isFactoryPacket`: `evaluate` (check/begin/run), `checkOwnership`, `running`, `statusLines`. I tested each one on `MA-DEC-*` in temp repos:
- **Eligibility and begin:** test 49. This review's own `begin` on the live repo also worked.
- **Ownership guard:** test 50.
- **Transition table:** `READY → CLOSED` is refused with `TransitionError` (my probe).
- **O_EXCL global lock:** while an `MA-NOV-*` run held the lock, `begin MA-DEC-TA` was refused: "another run holds the global lock" (my probe).
- **End-of-run scope check:** `begin MA-DEC-SC` → write the report plus a stray file → `end` gave `BLOCKED — scope violation: stray.txt`, and the global lock was released (my probe).

The lease, lock and scope check are keyed by packet id and never had a month in them.

Month-specific code that remains is cosmetic only: the `dispatch.mjs` usage comment ("one line per November packet"), the `begin` refusal text "no such November packet" (`dispatch.mjs:309`), and the November defaults in `boardLabels()`, which are deliberate. See Note 5.

### Q2. Can the board/Tower prefix filter hide a running or eligible packet? Is that acceptable?
**Yes, it can.** `buildSnapshot` builds `packets` from `board.prefix` only, and the board's **Running** line, the Tower's lease badge and the page-status `leases` are all derived from `packets`, not from `evaluate`/`running()`. I tested this in a temp repo with the December config:
- `begin MA-NOV-LIVE`: `dispatch check` lists `running: [MA-NOV-LIVE]`, but the board says `**Running:** none (dispatcher idle)` and the Tower says "dispatcher idle (no lease)".
- An eligible `MA-NOV-ELIG` does not appear on the board or on the Tower's *Start a run* panel, while `dispatch check` lists it as eligible.

**Safety is not affected.** The global lock still stops a second run, and LANE_OPENER step 4 relies on `dispatch check`, not on the board. What can go wrong is the display: the Founder could read "idle" while a run is live. **Acceptable for December for now**, because every non-record `MA-NOV-*` packet is `CLOSED`, so none can be begun without a Main Lane write. See Note 1.

### Q3. Is the overwrite guard still safe against a hand-written board now that the title is a pattern?
**Yes.** `TITLE_RE` needs the full generated suffix `(generated — do not edit; run node tools/factory/project.mjs)` and must match the whole line.

The guard refused each of these (and test 55 also checks that the file is left untouched):
- a hand-written `# Status Board — October 2026`
- a hand-written `# Status Board — December 2026`
- `notes`
- an ASCII hyphen in place of the em dash
- a trailing space
- CRLF
- a BOM
- an empty file (refused before this change too)

The only widening: a hand-written board whose first line copies the generated title with *any* label would now be overwritten. Before, only the exact November title was overwritten. Such a line says "do not edit" by construction, so this is acceptable. I regenerated twice with labels that contain parentheses and an em dash, and the guard accepted its own output each time. See Note 4.

### Q4. Are the November archives byte-identical to `710242e`?
**Yes.**

| File | sha256 (working copy = `5af1351` blob = `git show 710242e:<source>`) |
|---|---|
| `claude/packets/STATUS_BOARD_November_2026.md` | `44404582ce6319e9f162587d882231105d747ea5b50a659596b6e659442cd7d7` |
| `claude/factory/control-tower_November_2026.html` | `e23f3462913d037e2021fe3b798c5793f7919f9bcc7abca70036758e96b87aac` |

Both match the pins in LABEL Control §What 1, and both are clean in `git status`.

### Q5. Do the new tests prove what they claim? Are any existing tests weakened?
**They prove what they claim, and nothing is weakened.**
- **`pilot.test.mjs` diff:** the header numbering comment, one comment line, and two `import` lines. No assertion was changed or removed. `helpers.mjs` is unchanged.
- **The imports are necessary:** `test/package.json` has `"main": "pilot.test.mjs"`.
- **Tests 49–52** cover BOOT success condition 3 (a)–(d).
- **Tests 53–56** cover LABEL §What 4 (a)–(c). Test 53 checks headings rather than byte-identity, so I ran an independent check. I ran the `710242e` generator and the `5af1351` generator on a copy of the live `claude/packets` with `board` removed and a fixed clock. Board and Tower came out **byte-identical** (`board identical true | html identical true`). LABEL (a) holds.

Gaps (Note 6), none of which is a weakening:
- No test covers the Q2 hidden-lease case.
- No test covers a `board.prefix` that is not in `PACKET_PREFIXES`.
- Test 49 pins `PACKET_PREFIXES` to exactly `['MA-NOV-','MA-DEC-']`. That is intentional (the README says to extend it), but it will fail on purpose at the January rollover.

### Q6. Must anything change before the first December packet that commits product code?
**No.** The commit/push path, the scope check (including the F1 committed-path checks), the run-profile gates and the lease are keyed by id and run_profile, and they behave the same for `MA-DEC-*`. The `begin`→`end` scope-check probe above confirms this.

Recommended but not blocking:
- Note 1: the Tower shows the true running state.
- Note 3: the December carry-overs are visible.

Both are about what the Founder sees, not about what the dispatcher allows.

## Findings

| # | Severity | Blocks? | Finding | Recommendation |
|---|---|---|---|---|
| 1 | note | no | The board's **Running** line, the Tower's lease badge, page status and *Start a run* use the prefix-filtered `packets`. A live or eligible `MA-NOV-*` packet shows as "idle" or is absent while `dispatch check` lists it (Q2 probe). | Derive Running and leases from `running(root)` and eligibility from `ev.eligible` across `PACKET_PREFIXES`, or list off-board live/eligible packets in a one-line "other months" row. Add a test. Fix before January. |
| 2 | note | no | If `config.board.prefix` is not in `PACKET_PREFIXES` (for example `MA-JAN-` set in config before `util.mjs` is updated), the board shows those packets as `READY` rows, but they are invisible to eligibility and the ownership guard does not apply to them. A `dispatcher` write of `blocker` was accepted. Dispatch is still fail-closed (never eligible), so there is no unsafe run. | `project.mjs` should refuse, or put a banner on the board, when `board.prefix` is not in `PACKET_PREFIXES`. Fix before the January rollover. |
| 3 | note | no — Main Lane choice | `MA-NOV-CARRY` (the carry-over register; CLAUDE.md says the December carry-overs are in it) does not appear on the December board or Tower *December scope* panel (it shows 0 times on either). | Main Lane: either open an `MA-DEC-*` carry-over record, or let the scope section include record kinds from every prefix. |
| 4 | note | no | `TITLE_RE` accepts a generated title with any label (`.+`), so a hand-written board that copies the generated title line is overwritten. Before, this applied only to the November string. | Acceptable. Optionally require the label to equal `config.board.label` or the previous month. |
| 5 | note | no | Cosmetic November wording in `dispatch.mjs`: the usage comment (line 4) and the `begin` refusal text "no such November packet" (line 309), which now prints for `MA-DEC-*` ids too. | Change to "no such factory packet" in the next factory packet. |
| 6 | note (pre-existing) | no | Not from this diff, but next to it: `writeStatus` does not validate `id`, so `writeStatus('../packets/MA-DEC-PX', …, {writer:'dispatcher'})` skips the ownership guard (`isFactoryPacket` is false for the path form) and wrote a forged `start_approval`. The same happens at `9cb8dc7` with `MA-NOV-`. The dispatcher CLI is not exposed: `begin ../packets/MA-DEC-PX` is refused. FIX4's H2 validates `closure_by` only. Test gaps from Q5 are filed here too. | Apply `CLOSURE_ID_RE` (or a stricter id regex) in `statusPath` / `writeStatus`. Add tests for Notes 1 and 2. |

## Non-actions
- No edits except this report.
- No commits or pushes.
- No `project.mjs` run against the real repo, and no `dispatch.mjs` other than `begin`/`end`.
- No wrangler, D1, network, secrets, installs or subagents.
- All experiments ran in the session scratchpad copy and in `os.tmpdir()` temp repos made by the test harness.

## Deviations
None. (The working-copy changes to `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl` and `December_Decisions_Log.md` were already present at session start or were made by `dispatch begin`. They are not mine.)
