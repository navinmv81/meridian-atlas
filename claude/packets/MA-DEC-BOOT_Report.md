# MA-DEC-BOOT — Report (Engineering Lead, LANE-DEC-ENG)

Executed 2026-11-28 from `MA-DEC-BOOT_Control_v1.md` / `MA-DEC-BOOT_Task_v1.md`, directly (not dispatcher-bracketed; `dispatch.mjs` and `project.mjs` were not run against the real repo). Stopped after Task step 8 for Main Lane verification.

## Outcome
- **Commit:** `710242ee02b525947f0cd988f89d30373df8a56b` on `December-2026`, parent `9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d`.
- **Tests:** `node --test tools/factory/test` → tests 52, pass 52, fail 0 (48 existing + 4 new).
- **Push:** `origin/December-2026` = local HEAD = `710242e`; `origin/November-2026` still `9cb8dc7`.

## Preconditions (all met)
- `ls .git/*.lock`: no matches.
- HEAD = `origin/November-2026` (ls-remote) = `9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d`; branch `November-2026`.
- `December-2026` absent locally and on origin.
- `git status --porcelain` matched the Task §1 list. `.claude/settings.local.json` exists but is not shown, because the user's global gitignore (`~/.config/git/ignore`) ignores it. This is a subset of the allowed list, not an extra.
- Control hash, Task hash and `start_approval` (Founder, 2026-11-28T09:21Z, "approve MA-DEC-BOOT", both hashes) matched the Status file.

## Pins (pinned vs observed)
| File | Pinned | Observed |
|---|---|---|
| `claude/meridian_atlas_december_run_spec.md` | `9448a08a…5ef9edb` | `9448a08a8ded958ae5053bd0f680557f860cb68f8361b90f203fe383b5ef9edb` ✔ |
| `claude/December_Decisions_Log.md` | `f5fe2b78…c9687` | `f5fe2b78dd8a45e63a36a8769ef80c321bd0783c2605ff477964ac4dd38c9687` ✔ |
| `claude/packets/MA-DEC-BOOT_Control_v1.md` | `af311fd6…75f7` (Status) | `af311fd645000bae31855d0935c63adca0899ab848b02c8f7ab4fd465f1b75f7` ✔ |
| `claude/packets/MA-DEC-BOOT_Task_v1.md` | `2d591b8c…bd89` (Status) | `2d591b8c8c769c233ad3991857f4bbb001da77e68f7550c2703ae141de43bd89` ✔ |

## Staged list (= commit list; `git diff --cached --name-only` compared, identical)
```
CLAUDE.md
claude/December_Decisions_Log.md
claude/meridian_atlas_december_run_spec.md
claude/packets/MA-DEC-BOOT_Control_v1.md
claude/packets/MA-DEC-BOOT_Task_v1.md
tools/factory/README.md
tools/factory/dispatch.mjs
tools/factory/lib/eligibility.mjs
tools/factory/lib/state.mjs
tools/factory/lib/util.mjs
tools/factory/project.mjs
tools/factory/test/month-prefix.test.mjs
tools/factory/test/pilot.test.mjs
```
Each was added with its own `git add -- <path>`.

## `git show --stat`
```
commit 710242ee02b525947f0cd988f89d30373df8a56b
parent 9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d
MA-DEC-BOOT: December-2026 branch, December records, factory month prefix (DML-1128-2/3)

 CLAUDE.md                                  |   8 +-
 claude/December_Decisions_Log.md           |  32 +++++
 claude/meridian_atlas_december_run_spec.md | 204 +++++++++++++++++++++++++++++
 claude/packets/MA-DEC-BOOT_Control_v1.md   |  49 +++++++
 claude/packets/MA-DEC-BOOT_Task_v1.md      |  31 +++++
 tools/factory/README.md                    |   4 +
 tools/factory/dispatch.mjs                 |   6 +-
 tools/factory/lib/eligibility.mjs          |   4 +-
 tools/factory/lib/state.mjs                |  10 +-
 tools/factory/lib/util.mjs                 |   4 +
 tools/factory/project.mjs                  |  13 +-
 tools/factory/test/month-prefix.test.mjs   |  77 +++++++++++
 tools/factory/test/pilot.test.mjs          |   4 +-
 13 files changed, 427 insertions(+), 19 deletions(-)
```

## Per-file SHA-256 (as committed)
| File | sha256 |
|---|---|
| `CLAUDE.md` | `f7fc99f6e8404896b2f576733be5cabebafeca5b7fc85e1cc355e23b2080e3a7` |
| `claude/December_Decisions_Log.md` | `f5fe2b78dd8a45e63a36a8769ef80c321bd0783c2605ff477964ac4dd38c9687` (pinned ✔) |
| `claude/meridian_atlas_december_run_spec.md` | `9448a08a8ded958ae5053bd0f680557f860cb68f8361b90f203fe383b5ef9edb` (pinned ✔) |
| `claude/packets/MA-DEC-BOOT_Control_v1.md` | `af311fd645000bae31855d0935c63adca0899ab848b02c8f7ab4fd465f1b75f7` (pinned ✔) |
| `claude/packets/MA-DEC-BOOT_Task_v1.md` | `2d591b8c8c769c233ad3991857f4bbb001da77e68f7550c2703ae141de43bd89` (pinned ✔) |
| `tools/factory/README.md` | `c4ae6215d733b29d19187e5beef45f1196787af02cba47644b706b29ec414c54` |
| `tools/factory/dispatch.mjs` | `84a347320c712ec0a2d44d7eb66ec01cdd0ea80f89b66e000ade442d6bb67182` |
| `tools/factory/lib/eligibility.mjs` | `9f854c25e8dfaf27a35e44817ccd1075e746ab12f17919428fc574a93c6982ef` |
| `tools/factory/lib/state.mjs` | `5786642635a6b9a17ef11ccbdde328051286ba1308c5f8711d76de0cc625c08d` |
| `tools/factory/lib/util.mjs` | `6ddd50d24ddb15087ab1b3c1bf2486653bbbe29453ce62f5e73ac7302fb74b0f` |
| `tools/factory/project.mjs` | `2a3f3533c82fb623235ad3e959e0da7f63377870e7fcbda53858bb7795ae4846` |
| `tools/factory/test/month-prefix.test.mjs` | `43f8aef293afc6825151c7f537a2bd321d11bfab019ce41c4b1e75a04e95f5fe` |
| `tools/factory/test/pilot.test.mjs` | `ff5f3153d1e54c7276590108390bd6644ccd08952d27164a015537eb53302924` |

## Factory diff summary
- `lib/util.mjs`: new `export const PACKET_PREFIXES = ['MA-NOV-', 'MA-DEC-']` and `isFactoryPacket(id)` (string id that starts with any listed prefix).
- `lib/state.mjs`: `checkOwnership` guard uses `isFactoryPacket(id)` instead of `id.startsWith('MA-NOV-')`. `listStatus(prefix = '', { root })` keeps its signature; `prefix` may now also be a list, and a file matches if it starts with any entry. A string prefix works as before. The ownership comment now says it applies to every `PACKET_PREFIXES` packet.
- `lib/eligibility.mjs`: `evaluate` default `prefix` is `PACKET_PREFIXES` (was `'MA-NOV-'`). An explicit string prefix still works.
- `dispatch.mjs`: `running()` and `statusLines()` list `PACKET_PREFIXES`. `check`, `begin` and `run` reach eligibility through `evaluate`'s default, so they follow the list with no other change. No other month literal is left in `dispatch.mjs`.
- `project.mjs`: `buildSnapshot` lists `PACKET_PREFIXES`. The board's "Projection of …" line and the Tower's "Source" label are built from the list: `` `claude/packets/MA-NOV-*_Status.json` and `claude/packets/MA-DEC-*_Status.json` ``. The header comment is updated the same way.
- Unchanged on purpose: `CLOSURE_ID_RE` (`/^MA-[A-Z0-9][A-Z0-9.-]*$/`, already month-agnostic); history comments naming `MA-NOV-*` packets; `BOARD_TITLE` / `BOARD_SECTION` / `SCOPE_SECTION` still say "November 2026" (titles, not selection or ownership, so outside Task §3 step 2). They will read as "November" on the next generated board until a later packet changes them.
- `README.md`: new paragraph "Month prefixes (MA-DEC-BOOT)" names `PACKET_PREFIXES` in `lib/util.mjs` and says where to add the next month.

## Tests
- Baseline before edits: tests 48, pass 48, fail 0.
- After: **tests 52, pass 52, fail 0** (`node --test tools/factory/test`, temp repos only).
- New file `tools/factory/test/month-prefix.test.mjs` (same harness, `helpers.mjs`), tests 49–52:
  - 49 (a): an `MA-DEC-*` READY packet with a valid Founder approval is eligible in `evaluate` and `dispatch check`; `dispatch begin` takes it to EXECUTING with an interactive lease; `running` and `status` list it.
  - 50 (b): the dispatcher, `dispatcher-hold` and worker field-ownership refusals apply to `MA-DEC-*` (nothing is written). Allowed writes still pass. A month outside the list (`MA-OCT-*`) still has no guard, as before.
  - 51 (c): `project()` puts both `MA-NOV-*` and `MA-DEC-*` rows in the board's work table and the Tower, names both globs in the Projection and Source text, and leaves out a month outside the list.
  - 52 (d): `MA-NOV-*` is unchanged. It is eligible next to an unapproved `MA-DEC-*`, `evaluate`/`listStatus` with the string `'MA-NOV-'` see November only, `listStatus('')` still lists all, and the ownership guard still applies.
- `pilot.test.mjs` imports `./month-prefix.test.mjs` (one import line plus a comment, and the numbering note now reads 49–52). The import is needed because `test/package.json` has `"main": "pilot.test.mjs"`, so `node --test tools/factory/test` runs that file only.

## Secret scan (commit list, counts only)
| Pattern | Count |
|---|---|
| `CF_API_TOKEN\s*=\s*\S` | 0 |
| `[A-Za-z0-9_-]{40}` within 4 chars of `token\|secret\|Bearer` (either side, case-insensitive) | 0 |
| `-----BEGIN` | 1 |
| `ghp_` | 1 |
| `github_pat_` | 1 |

All three non-zero hits are the same single line of `MA-DEC-BOOT_Task_v1.md` (§3 step 5), the line that lists the scan patterns. Checks for real token shapes (`ghp_` or `github_pat_` followed by 20 or more characters, or a full `-----BEGIN … -----` header) found 0 in that file. No other file hit. See Deviation 1.

## Push output
```
To https://github.com/navinmv81/meridian-atlas.git
 * [new branch]      December-2026 -> December-2026
branch 'December-2026' set up to track 'origin/December-2026'.
```

## `git ls-remote origin refs/heads/December-2026 refs/heads/November-2026`
```
710242ee02b525947f0cd988f89d30373df8a56b	refs/heads/December-2026
9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d	refs/heads/November-2026
```

## Final `git status --porcelain` (after commit, before this report was written)
```
 M claude/factory/transitions.jsonl
?? .docs-dry-run/
?? "13F Seed/gleif-seed.js"
?? "Claude outputs/"
?? MA-SEP-010_Change_Request.md
?? Meridian_Atlas_Current_State_v13.docx
?? claude/factory/backup/
?? claude/packets/MA-DEC-BOOT_Status.json
?? claude_project_agentic_delivery_spec.md
?? meridian_atlas_agentic_delivery_factory_operating_kit.md
?? meridian_atlas_december_run_spec.md
?? meridian_atlas_november_content_scope_and_requirements.md
?? ~$ridian_Atlas_Current_State_v13.docx
?? ~$ridian_Atlas_Current_State_v15.docx
?? claude/factory/runs/r-*/   (50 directories, unchanged)
```
After this report is written, `?? claude/packets/MA-DEC-BOOT_Report.md` is added. Per the Control, the report and Status ride with the next authorised commit. `transitions.jsonl` is still the pre-existing modification from before the session, untouched.

## Non-actions
- No commit or push to `November-2026` or any other branch. No tags, amend, force, rebase, pull, merge, stash, reset, restore, clean, rm or mv. No lock files touched.
- No `dispatch.mjs` / `project.mjs` run against the real repo, so `STATUS_BOARD.md` and `control-tower.html` were not regenerated.
- No edits to Status files, `config.json`, LANE_OPENERs, Main Lane records, `App/`, `docs/`, `generate-docs.mjs` or `13F Seed/` (`git diff HEAD~1 HEAD` over `App docs generate-docs.mjs "13F Seed"` is empty).
- No `wrangler`, D1, Cloudflare API, GitHub Pages setting, scheduler/LaunchAgent change, `.env*` read, install or subagent. No macOS permission prompt came up.
- `13F Seed/gleif-seed.js`, `.claude/settings.local.json` and the other excluded paths were not staged.

## Deviations
1. **Secret-scan stop gate (Founder decision).** The literal scan counted 3, all on the Task's own pattern-list line (see Secret scan). The gate says count ≠ 0 → stop, so I stopped and asked the Founder in-session before committing. The Founder chose "Proceed, record deviation". For future Tasks: a scan that includes the Task file will always match its own pattern list, so the scan should exclude that line or match token shapes only.
2. **Existing test count.** The Control says "existing 40"; the suite had 48 (numbered 1–48 with gaps, plus 4b/4c), all passing at baseline. All 48 still pass.
3. **Test file wiring.** The new tests are in a new file beside `pilot.test.mjs` (allowed by Task step 3). `pilot.test.mjs` imports that file so the Task's command `node --test tools/factory/test` runs it.
4. **Commit trailer.** The commit subject is the Task's message word for word. The body adds one `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer, per this session's standing commit-attribution rule.
5. **CLAUDE.md line count.** Task §4's three edits plus the "Last updated" line are 4 changed lines (`8 +-` in the stat). (b) also adds the December decisions-log pointer to the Main Lane line, as the Task asks. No other line changed.
