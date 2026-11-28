# MA-DEC-BOOT — Task v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Engineering Lead — LANE-DEC-ENG, new local Claude Code session
APPROVED BY:  Founder — Start Approval in claude/packets/MA-DEC-BOOT_Status.json
CONTROL:      claude/packets/MA-DEC-BOOT_Control_v1.md
```

## 1. Preconditions
- `ls .git/*.lock` empty.
- `git rev-parse HEAD` = `git ls-remote origin refs/heads/November-2026` = `9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d`; current branch `November-2026`.
- `December-2026` absent locally (`git branch --list December-2026`) and on origin (`git ls-remote origin refs/heads/December-2026` empty).
- `git status --porcelain` contains only: ` M claude/factory/transitions.jsonl`; untracked `.claude/settings.local.json`, `.docs-dry-run/`, `13F Seed/gleif-seed.js`, `Claude outputs/`, `MA-SEP-010_Change_Request.md`, `Meridian_Atlas_Current_State_v13.docx`, `~$ridian_Atlas_Current_State_v13.docx`, `~$ridian_Atlas_Current_State_v15.docx`, `claude/factory/backup/`, `claude/factory/runs/r-*/` directories, `claude_project_agentic_delivery_spec.md`, `meridian_atlas_agentic_delivery_factory_operating_kit.md`, `meridian_atlas_december_run_spec.md`, `meridian_atlas_november_content_scope_and_requirements.md`, `claude/meridian_atlas_december_run_spec.md`, `claude/December_Decisions_Log.md`, `claude/packets/MA-DEC-BOOT_Control_v1.md`, `claude/packets/MA-DEC-BOOT_Task_v1.md`, `claude/packets/MA-DEC-BOOT_Status.json`. Anything else → stop.

## 2. Pins
| File | sha256 |
|---|---|
| `claude/meridian_atlas_december_run_spec.md` | `9448a08a8ded958ae5053bd0f680557f860cb68f8361b90f203fe383b5ef9edb` |
| `claude/December_Decisions_Log.md` | `f5fe2b78dd8a45e63a36a8769ef80c321bd0783c2605ff477964ac4dd38c9687` |
| `claude/packets/MA-DEC-BOOT_Control_v1.md` | as in `MA-DEC-BOOT_Status.json` |

## 3. Steps
1. Preconditions and pins. Then `git switch -c December-2026`.
2. **Factory month prefix.** Add one exported list in `tools/factory/lib/util.mjs`, e.g. `export const PACKET_PREFIXES = ['MA-NOV-', 'MA-DEC-'];` plus a helper (e.g. `isFactoryPacket(id)`). Use it in place of every hard-coded `'MA-NOV-'` used for selection or ownership: `lib/eligibility.mjs` (`evaluate` default), `lib/state.mjs` (`checkOwnership` guard), `dispatch.mjs` (`running`, `statusLines`, and any other listing), `project.mjs` (listing and the board's "Projection of …" text). `listStatus` keeps its signature; filter by the list. Comments that name `MA-NOV-*` packets as history stay. No other behaviour change.
3. Tests: add tests for Control success condition 3 (a)–(d) in `tools/factory/test/pilot.test.mjs` (or a new file beside it, same harness); run `node --test tools/factory/test`; all pass. README: one paragraph "Month prefixes" naming the list and where to add the next month.
4. `CLAUDE.md`, three edits only: (a) "LOCAL_MASTER's own git branch" → `December-2026` (cut from `November-2026` `9cb8dc7`, DML-1128-2); `November-2026` `/docs` stays the live Pages source until the December go-live; (b) the "Main Lane (November)" line → "Main Lane (December)", same rule, decisions in `claude/December_Decisions_Log.md`; (c) "Current Sprint Packet": December open (DML-1128-1), run spec `claude/meridian_atlas_december_run_spec.md`. Update the "Last updated" line to 2026-11-28 (MA-DEC-BOOT). Nothing else.
5. Secret scan of every file in the commit list, counts only, for: `CF_API_TOKEN\s*=\s*\S`, `[A-Za-z0-9_-]{40}` adjacent to `token|secret|Bearer`, `-----BEGIN`, `ghp_`, `github_pat_`. Any count > 0 → stop.
6. Commit list (explicit paths, one per `git add --`): `claude/meridian_atlas_december_run_spec.md`, `claude/December_Decisions_Log.md`, `claude/packets/MA-DEC-BOOT_Control_v1.md`, `claude/packets/MA-DEC-BOOT_Task_v1.md`, `CLAUDE.md`, and each `tools/factory/` file changed or added in steps 2–3 (list them in the report). `git diff --cached --name-only` must equal this list. Commit message: `MA-DEC-BOOT: December-2026 branch, December records, factory month prefix (DML-1128-2/3)`.
7. `git push -u origin December-2026`; `git ls-remote origin refs/heads/December-2026 refs/heads/November-2026`.
8. Write the report (Control §Report-back) and stop. Reply in ≤ 5 lines: commit, test counts, ls-remote lines, report SHA-256.
